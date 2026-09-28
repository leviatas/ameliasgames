// ── Dash 3D — runner en 3D real (Three.js / WebGL) ──────────────────────────
// Labubu (en 3D) corre por una pista de caramelo flotando entre las nubes.
// ◀ ▶ (o deslizar) cambia de carril, ⬆ / tocar salta. Pasteles y conos se
// saltan, las gelatinas altas se esquivan. Monedas → billetera global.
//
// Render: WebGLRenderer propio sobre un <canvas> que se superpone al canvas 2D
// del orquestador (game.js sigue llamando update(dt) / render()). Luces físicas,
// sombras suaves, mapa de entorno (reflejos), bloom y MSAA — nada pixelado.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { addCoins } from './Wallet.js';

const LANE_W   = 2.4;
const LANES    = [-LANE_W, 0, LANE_W];
const TILE_L   = 4;
const N_ROWS   = 40;               // filas de pista visibles (160 m)
const GRAV     = 40, JUMP_V = 14;  // salto ≈ 2.45 de alto, 0.7 s en el aire
const PAD_V    = 20;               // trampolín: súper salto
const SPEED0   = 14, SPEED_MAX = 27;
const THEME_M  = 600;              // metros por escenario
const HEARTS   = 3;
const HERO_CY  = 0.8;              // altura del centro de giro del héroe
const N_DECOR  = 26, DECOR_GAP = 7;
const DECOR_SPAN = N_DECOR * DECOR_GAP;

const THEMES = [
  { name: '🍭 Algodón de azúcar', skyTop: 0x4f9dff, skyBot: 0xffc6e2, sun: 0xfff0d8, sunI: 2.2,
    hemiSky: 0xd8ebff, hemiGnd: 0xe89ac0, hemiI: 0.85, tileA: 0xff7fb8, tileB: 0xffd6ea,
    base: 0xb45c8e, rail: 0xfff6fb, cloud: 0xffffff, night: 0 },
  { name: '🌅 Atardecer', skyTop: 0x4a3fb8, skyBot: 0xff9a6e, sun: 0xffb87a, sunI: 2.0,
    hemiSky: 0xffcfae, hemiGnd: 0x7a4ba0, hemiI: 0.8, tileA: 0xff9a5c, tileB: 0xffdcb4,
    base: 0xa04868, rail: 0xfff0dc, cloud: 0xffc8b8, night: 0.25 },
  { name: '🌙 Noche estrellada', skyTop: 0x080c2e, skyBot: 0x3b2c80, sun: 0xa8b8ff, sunI: 1.3,
    hemiSky: 0x7d86ff, hemiGnd: 0x2a1a55, hemiI: 0.9, tileA: 0x7b68ee, tileB: 0xb8acff,
    base: 0x3a2a7a, rail: 0xdcd6ff, cloud: 0x8e86c8, night: 1 },
  { name: '🌿 Menta fresca', skyTop: 0x2fb4e0, skyBot: 0xc4f7e6, sun: 0xffffff, sunI: 2.2,
    hemiSky: 0xdcfff4, hemiGnd: 0x78c8aa, hemiI: 0.85, tileA: 0x4fd0a8, tileB: 0xd4fbec,
    base: 0x2f8a70, rail: 0xffffff, cloud: 0xffffff, night: 0 },
];

const CANDY = [0xff7eb6, 0xb58cff, 0x6fd6ff, 0xffd84d, 0x7fe0a8, 0xff9f6b];

const rand  = (a, b) => a + Math.random() * (b - a);
const pick  = arr => arr[(Math.random() * arr.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = t => t * t * (3 - 2 * t);
const $ = id => (typeof document !== 'undefined' ? document.getElementById(id) : null);

// ── Geometrías compartidas ──────────────────────────────────────────────────
function starShape(rOut, rIn, n = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i <= n * 2; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / n, r = i % 2 ? rIn : rOut;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  return s;
}
function coinGeometry() {
  const pts = [[0, -0.07], [0.36, -0.07], [0.42, -0.035], [0.42, 0.035], [0.36, 0.07],
               [0.29, 0.07], [0.27, 0.05], [0, 0.05]].map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.LatheGeometry(pts, 36);
  g.rotateX(Math.PI / 2);     // de canto hacia la cámara
  return g;
}
function cloudGeometry() {
  const parts = [[0, 0, 0, 1.3], [1.2, -0.2, 0.1, 0.95], [-1.25, -0.25, 0, 0.9],
                 [0.45, 0.55, -0.1, 0.85], [-0.5, 0.4, 0.2, 0.8], [2.1, -0.45, 0, 0.6]];
  const gs = parts.map(([x, y, z, r]) => {
    const g = new THREE.SphereGeometry(r, 20, 14);
    g.translate(x, y, z);
    return g;
  });
  const m = mergeGeometries(gs);
  m.scale(1, 0.8, 0.9);
  gs.forEach(g => g.dispose());
  return m;
}
function softDotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Dash3D {
  constructor(canvas) {
    this.hostCanvas = canvas;
    this.best = +(localStorage.getItem('dash3d_best') || 0);
    this._disposables = [];
    this._t = 0;
    this._initRenderer();
    this._initScene();
    this._initTrack();
    this._initHero();
    this._initDecor();
    this._initFx();
    this._initInput();
    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize);
    this._resize();
    this.reset();
  }

  // ── Setup ─────────────────────────────────────────────────────────────────
  _geo(g)  { this._disposables.push(g); return g; }
  _mat(m) {
    // el entorno de estudio es muy brillante: a media intensidad salvo que se pida otra
    if (m.envMapIntensity === 1) m.envMapIntensity = 0.5;
    this._disposables.push(m);
    return m;
  }

  _initRenderer() {
    const c = document.createElement('canvas');
    c.id = 'dash3d-canvas';
    document.body.appendChild(c);
    this.el = c;
    c.addEventListener('webglcontextlost', ev => { ev.preventDefault(); this.showError(new Error('la placa de video cortó el 3D (tocá ← Menú y volvé a entrar)')); });
    const touch = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in window);
    this.touch = touch;
    const r = new THREE.WebGLRenderer({ canvas: c, antialias: true, powerPreference: 'high-performance' });
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, touch ? 1.75 : 2);
    r.setPixelRatio(this.pixelRatio);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.92;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = r;
    this.quality = 2;          // 2 = bloom + MSAA, 1 = sin bloom, 0 = resolución reducida
    this._slowT = 0;
    this._fpsAcc = 0; this._fpsN = 0;
  }

  _initScene() {
    const scene = this.scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xffd9ec, 45, 150);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment(this.renderer);
    this.envTex = pmrem.fromScene(room, 0.04).texture;
    room.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    pmrem.dispose();
    scene.environment = this.envTex;

    this.camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 500);

    // Cielo: degradé + sol con halo (shader), sigue a la cámara
    this.skyU = {
      top: { value: new THREE.Color() }, bot: { value: new THREE.Color() },
      sunCol: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(-0.38, 0.2, -1).normalize() },
    };
    const sky = new THREE.Mesh(this._geo(new THREE.SphereGeometry(300, 40, 20)), this._mat(new THREE.ShaderMaterial({
      uniforms: this.skyU, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: `varying vec3 vDir;
        void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 bot; uniform vec3 sunCol; uniform vec3 sunDir; varying vec3 vDir;
        void main(){
          vec3 d = normalize(vDir);
          float h = clamp(d.y * 1.6 + 0.05, 0.0, 1.0);
          vec3 c = mix(bot, top, pow(h, 0.75));
          float s = max(dot(d, sunDir), 0.0);
          c += sunCol * (smoothstep(0.9985, 0.9993, s) * 2.2 + pow(s, 24.0) * 0.35 + pow(s, 4.0) * 0.08);
          gl_FragColor = vec4(c, 1.0);
        }`,
    })));
    sky.frustumCulled = false; sky.renderOrder = -10;
    scene.add(sky); this.sky = sky;

    // Estrellas (se encienden de noche)
    const sp = new Float32Array(900 * 3);
    for (let i = 0; i < 900; i++) {
      const v = new THREE.Vector3(rand(-1, 1), rand(0.02, 1), rand(-1, 1)).normalize().multiplyScalar(280);
      sp.set([v.x, v.y, v.z], i * 3);
    }
    const sg = this._geo(new THREE.BufferGeometry());
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.dotTex = softDotTexture(); this._disposables.push(this.dotTex);
    this.starMat = this._mat(new THREE.PointsMaterial({ size: 3.2, sizeAttenuation: false, map: this.dotTex,
      transparent: true, depthWrite: false, fog: false, color: 0xffffff, opacity: 0 }));
    this.stars = new THREE.Points(sg, this.starMat);
    this.stars.frustumCulled = false;
    scene.add(this.stars);

    // Luces
    this.hemi = new THREE.HemisphereLight(0xffffff, 0xffc4de, 1.2);
    scene.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight(0xffffff, 2.5);
    sun.castShadow = true;
    const sz = this.touch ? 1024 : 2048;
    sun.shadow.mapSize.set(sz, sz);
    const sc = sun.shadow.camera;
    sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 70;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 5;
    scene.add(sun, sun.target);

    // Post-proceso: MSAA en el render target + bloom suave
    const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.3, 0.45, 1.0);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    // Colores de tema (mezclados por frame)
    this.col = {};
    for (const k of ['skyTop', 'skyBot', 'sun', 'hemiSky', 'hemiGnd', 'tileA', 'tileB', 'base', 'rail', 'cloud'])
      this.col[k] = new THREE.Color();
    this.themeIdx = -1;
  }

  // Pista: todo instanciado (pocas draw calls). El grupo avanza de a 2 filas
  // para mantener el damero sin reciclar fila por fila.
  _initTrack() {
    const track = this.track = new THREE.Group();
    this.scene.add(track);
    const nT = N_ROWS * 3;
    this.tileMat = this._mat(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, envMapIntensity: 0.35 }));
    this.tiles = new THREE.InstancedMesh(this._geo(new RoundedBoxGeometry(LANE_W - 0.08, 0.34, TILE_L - 0.08, 3, 0.1)), this.tileMat, nT);
    this.baseMat = this._mat(new THREE.MeshStandardMaterial({ color: 0xd97aa8, roughness: 0.7, envMapIntensity: 0.4 }));
    const baseW = LANE_W * 3 + 0.9;
    this.base = new THREE.InstancedMesh(this._geo(new RoundedBoxGeometry(baseW, 1.1, TILE_L + 0.02, 3, 0.18)), this.baseMat, N_ROWS);
    this.railMat = this._mat(new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 }));
    this.rails = new THREE.InstancedMesh(this._geo(new RoundedBoxGeometry(0.34, 0.34, TILE_L + 0.02, 3, 0.12)), this.railMat, N_ROWS * 2);
    this.bulbMat = this._mat(new THREE.MeshBasicMaterial({ color: 0xffffff }));
    this.bulbs = new THREE.InstancedMesh(this._geo(new THREE.SphereGeometry(0.13, 16, 12)), this.bulbMat, N_ROWS * 2);

    const m = new THREE.Matrix4();
    const railX = LANE_W * 1.5 + 0.28;
    for (let r = 0; r < N_ROWS; r++) {
      const z = -r * TILE_L;
      for (let l = 0; l < 3; l++) {
        m.makeTranslation(LANES[l], -0.17, z);
        this.tiles.setMatrixAt(r * 3 + l, m);
      }
      m.makeTranslation(0, -0.78, z); this.base.setMatrixAt(r, m);
      for (let s = 0; s < 2; s++) {
        const x = s ? railX : -railX;
        m.makeTranslation(x, 0.1, z); this.rails.setMatrixAt(r * 2 + s, m);
        m.makeTranslation(x, 0.36, z); this.bulbs.setMatrixAt(r * 2 + s, m);
      }
    }
    for (const im of [this.tiles, this.base, this.rails, this.bulbs]) {
      im.instanceMatrix.needsUpdate = true;
      im.frustumCulled = false;
      track.add(im);
    }
    this.tiles.receiveShadow = this.base.receiveShadow = this.rails.receiveShadow = true;
    this.rails.castShadow = true;
    // colores iniciales (se re-pintan con el tema)
    const w = new THREE.Color(1, 1, 1);
    for (let i = 0; i < nT; i++) this.tiles.setColorAt(i, w);
    for (let i = 0; i < N_ROWS * 2; i++) this.bulbs.setColorAt(i, w);
    this._trackSnap = null;
  }

  _initHero() {
    // Labubu en 3D (el mismo personaje del runner 2D "Corre Labubu corre"):
    // capucha violeta de peluche con orejas de gato, carita color piel, ojos
    // grandes, sonrisa de dientes en zigzag y trajecito de volados.
    // Todo cuelga de `rig` con el origen en los pies; `pivot` está a la altura
    // del centro del cuerpo para que la voltereta y el aplastar giren ahí.
    const hero = this.hero = new THREE.Group();
    const pivot = this.heroPivot = new THREE.Group();
    pivot.position.y = HERO_CY;
    hero.add(pivot);
    const rig = new THREE.Group();
    rig.position.y = -HERO_CY;
    pivot.add(rig);
    const mesh = (g, m, x = 0, y = 0, z = 0, parent = rig, shadow = true) => {
      const o = new THREE.Mesh(g, m);
      o.position.set(x, y, z);
      o.castShadow = shadow;
      parent.add(o);
      return o;
    };
    // Peluche: sheen da el brillo aterciopelado en los bordes
    const fur = this.heroMat = this._mat(new THREE.MeshPhysicalMaterial({
      color: 0x6a2fd0, roughness: 0.8, sheen: 0.7, sheenRoughness: 0.5,
      sheenColor: new THREE.Color(0xb890ff), envMapIntensity: 0.35,
    }));
    const furLight = this._mat(new THREE.MeshPhysicalMaterial({
      color: 0x9a6ae6, roughness: 0.78, sheen: 0.6, sheenColor: new THREE.Color(0xd8c0ff), envMapIntensity: 0.35,
    }));
    const furDark = this._mat(new THREE.MeshStandardMaterial({ color: 0x3e1a82, roughness: 0.85 }));
    const skin = this._mat(new THREE.MeshPhysicalMaterial({
      color: 0xf3cfb0, roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color(0xffe8e0), envMapIntensity: 0.4,
    }));

    // ── Cuerpo: vestidito de tres volados (torno + ondas) ──
    const prof = [
      [0.001, 0.3], [0.33, 0.3], [0.37, 0.34], [0.33, 0.4], [0.25, 0.46],
      [0.31, 0.49], [0.3, 0.55], [0.23, 0.62], [0.27, 0.65], [0.26, 0.7],
      [0.2, 0.8], [0.15, 0.9], [0.001, 0.93],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const bodyG = new THREE.LatheGeometry(prof, 48);
    const pos = bodyG.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const r = Math.hypot(x, z);
      if (r < 0.01) continue;
      const k = 1 + Math.max(0, r - 0.22) * 0.55 * Math.sin(Math.atan2(z, x) * 9 + y * 20);
      pos.setX(i, x * k); pos.setZ(i, z * k);
    }
    bodyG.computeVertexNormals();
    mesh(this._geo(bodyG), fur);

    // ── Piernas y pies (se balancean al correr) ──
    const legG = this._geo(new THREE.CapsuleGeometry(0.085, 0.14, 6, 14));
    const footG = this._geo(new THREE.SphereGeometry(0.1, 18, 12));
    this.legs = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(0.13 * s, 0.36, 0);
      rig.add(hip);
      mesh(legG, fur, 0, -0.13, 0, hip);
      const f = mesh(footG, furLight, 0, -0.29, -0.04, hip);
      f.scale.set(1, 0.7, 1.45);
      this.legs.push(hip);
    }
    // ── Bracitos con puños ──
    const armG = this._geo(new THREE.CapsuleGeometry(0.075, 0.2, 6, 14));
    const fistG = this._geo(new THREE.SphereGeometry(0.095, 18, 14));
    this.arms = [];
    for (const s of [-1, 1]) {
      const sh = new THREE.Group();
      sh.position.set(0.21 * s, 0.8, 0);
      sh.rotation.z = 0.35 * s;
      rig.add(sh);
      mesh(armG, fur, 0, -0.15, 0, sh);
      mesh(fistG, furLight, 0, -0.3, 0, sh);
      this.arms.push(sh);
    }

    // ── Cabeza: capucha + orejas de gato ──
    const head = this.head = new THREE.Group();
    head.position.y = 1.2;
    rig.add(head);
    const hood = mesh(this._geo(new THREE.SphereGeometry(0.45, 40, 30)), fur, 0, 0, 0, head);
    hood.scale.set(1.02, 0.94, 0.95);
    // Oreja: cono de torno con la punta curvita, adentro violeta oscuro mirando al frente
    const earProf = [[0.001, 0.44], [0.035, 0.41], [0.08, 0.32], [0.13, 0.17], [0.165, 0.05], [0.17, 0]]
      .map(([x, y]) => new THREE.Vector2(x, y));
    const earG = this._geo(new THREE.LatheGeometry(earProf, 32));
    const innerG = this._geo(new THREE.LatheGeometry(earProf.map(v => new THREE.Vector2(v.x * 0.62, v.y * 0.8)), 16));
    this.ears = [];
    for (const s of [-1, 1]) {
      const ear = new THREE.Group();
      ear.position.set(0.25 * s, 0.24, 0.02);
      ear.rotation.z = -0.42 * s;
      head.add(ear);
      const e = mesh(earG, fur, 0, 0, 0, ear);
      e.scale.z = 0.7;
      const inn = mesh(innerG, furDark, 0, 0.04, -0.055, ear, false);
      inn.scale.z = 0.35;
      this.ears.push(ear);
    }

    // ── Carita (mira hacia adelante, -z) ──
    const face = this.face = new THREE.Group();
    face.position.z = -0.3;
    head.add(face);
    const faceM = mesh(this._geo(new THREE.SphereGeometry(0.31, 36, 24)), skin, 0, -0.03, 0, face, false);
    faceM.scale.set(1.05, 0.9, 0.5);
    // borde de la capucha alrededor de la cara
    const rim = mesh(this._geo(new THREE.TorusGeometry(0.315, 0.055, 12, 40)), fur, 0, -0.03, -0.035, face);
    rim.scale.set(1.05, 0.9, 1);

    const eyeW = this._mat(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }));
    const iris = this._mat(new THREE.MeshStandardMaterial({ color: 0x6b54c8, roughness: 0.2 }));
    const eyeB = this._mat(new THREE.MeshStandardMaterial({ color: 0x1e1230, roughness: 0.15 }));
    const shine = this._mat(new THREE.MeshBasicMaterial({ color: 0xffffff }));
    const eyeG = this._geo(new THREE.SphereGeometry(0.095, 22, 16));
    const irisG = this._geo(new THREE.SphereGeometry(0.072, 20, 14));
    const pupG = this._geo(new THREE.SphereGeometry(0.04, 14, 10));
    const shG  = this._geo(new THREE.SphereGeometry(0.02, 10, 8));
    this.eyes = [];
    for (const s of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.set(0.125 * s, 0.04, -0.135);
      const w = new THREE.Mesh(eyeG, eyeW); w.scale.set(0.95, 1.15, 0.5);
      const ir = new THREE.Mesh(irisG, iris); ir.position.set(0, -0.008, -0.025); ir.scale.set(1, 1.18, 0.45);
      const p = new THREE.Mesh(pupG, eyeB); p.position.set(0, -0.006, -0.05); p.scale.set(1, 1.15, 0.4);
      const h = new THREE.Mesh(shG, shine); h.position.set(0.026 * s, 0.038, -0.06);
      eye.add(w, ir, p, h);
      face.add(eye);
      this.eyes.push(eye);
    }
    // cejitas
    const browG = this._geo(new THREE.CapsuleGeometry(0.009, 0.05, 4, 8));
    const brow = this._mat(new THREE.MeshStandardMaterial({ color: 0x6b3e2e, roughness: 0.6 }));
    for (const s of [-1, 1]) {
      const b = mesh(browG, brow, 0.13 * s, 0.165, -0.105, face, false);
      b.rotation.z = Math.PI / 2 + 0.25 * s;
    }
    // naricita
    mesh(this._geo(new THREE.SphereGeometry(0.018, 10, 8)), skin, 0, -0.035, -0.158, face, false);
    // cachetes
    const blush = this._mat(new THREE.MeshBasicMaterial({ color: 0xff8fa8, transparent: true, opacity: 0.4, depthWrite: false }));
    const blG = this._geo(new THREE.CircleGeometry(0.045, 20));
    for (const s of [-1, 1]) {
      const b = mesh(blG, blush, 0.21 * s, -0.07, -0.118, face, false);
      b.rotation.set(0, Math.PI - 0.55 * s, 0); b.scale.y = 0.6;
    }
    // Sonrisa con dientes en zigzag: medialuna oscura + dos filas de triangulitos
    const MW = 0.14, N_T = 8;
    const top = x => -0.012 + 0.03 * (x / MW) ** 2;                         // comisuras arriba
    const bot = x => top(x) - 0.085 * Math.sqrt(Math.max(0, 1 - (x / MW) ** 2));
    const smile = new THREE.Shape();
    smile.moveTo(-MW, top(-MW));
    for (let i = 1; i <= 20; i++) { const x = -MW + (2 * MW * i) / 20; smile.lineTo(x, top(x)); }
    for (let i = 19; i >= 1; i--) { const x = -MW + (2 * MW * i) / 20; smile.lineTo(x, bot(x)); }
    smile.closePath();
    const mouthM = mesh(this._geo(new THREE.ShapeGeometry(smile, 1)),
      this._mat(new THREE.MeshBasicMaterial({ color: 0x3b1c48, side: THREE.DoubleSide })), 0, -0.1, -0.152, face, false);
    const teeth = [];
    const span = MW * 0.9, tw = (2 * span) / N_T;
    for (let i = 0; i < N_T; i++) {
      const x0 = -span + tw * i, x1 = x0 + tw, xm = (x0 + x1) / 2;
      const up = new THREE.Shape();                       // fila de arriba (apuntan abajo)
      up.moveTo(x0, top(x0) + 0.004); up.lineTo(x1, top(x1) + 0.004);
      up.lineTo(xm, top(xm) - 0.03); up.closePath();
      teeth.push(up);
      if (i > 0 && i < N_T - 1) {                          // fila de abajo (apuntan arriba)
        const lo = new THREE.Shape();
        lo.moveTo(x0, bot(x0) - 0.004); lo.lineTo(xm, bot(xm) + 0.028); lo.lineTo(x1, bot(x1) - 0.004); lo.closePath();
        teeth.push(lo);
      }
    }
    const teethM = new THREE.Mesh(this._geo(new THREE.ShapeGeometry(teeth)),
      this._mat(new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })));
    teethM.position.z = 0.002;     // hacia afuera (la boca se gira 180°)
    mouthM.add(teethM);
    mouthM.rotation.y = Math.PI;   // la forma mira a +z; la cara, a -z
    mouthM.rotation.x = 0.12;      // acompaña la curva de la cara

    // Burbuja escudo (iridiscente)
    this.shieldMesh = new THREE.Mesh(this._geo(new THREE.SphereGeometry(0.98, 32, 24)), this._mat(new THREE.MeshPhysicalMaterial({
      color: 0x9fe8ff, transparent: true, opacity: 0.28, roughness: 0.05, iridescence: 1, iridescenceIOR: 1.6,
      clearcoat: 1, depthWrite: false, emissive: 0x3aa8ff, emissiveIntensity: 0.25,
    })));
    this.shieldMesh.visible = false;
    pivot.add(this.shieldMesh);

    this.scene.add(hero);
  }

  _initDecor() {
    const g = {
      cloud: this._geo(cloudGeometry()),
      island: this._geo(new THREE.CylinderGeometry(1.5, 0.25, 1.9, 24, 1)),
      grass: this._geo(new RoundedBoxGeometry(3.1, 0.34, 3.1, 3, 0.16)),
      stick: this._geo(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 10)),
      candy: this._geo(new THREE.SphereGeometry(0.62, 28, 20)),
      swirl: this._geo(new THREE.TorusGeometry(0.62, 0.09, 12, 40)),
      crystal: this._geo(new THREE.OctahedronGeometry(0.7, 0)),
      balloon: this._geo(new THREE.SphereGeometry(0.55, 28, 20)),
      knot: this._geo(new THREE.ConeGeometry(0.1, 0.16, 12)),
      string: this._geo(new THREE.CylinderGeometry(0.012, 0.012, 1.5, 4)),
    };
    g.string.translate(0, -0.75, 0);
    this.cloudMat  = this._mat(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.08, envMapIntensity: 0.25 }));
    const rockMat  = this._mat(new THREE.MeshStandardMaterial({ color: 0xe8b890, roughness: 0.8 }));
    this.grassMat  = this._mat(new THREE.MeshStandardMaterial({ color: 0x8fe3b0, roughness: 0.6 }));
    const stickMat = this._mat(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 }));
    this.decorGeo = g;
    this.decor = [];
    const kinds = ['cloud', 'island', 'cloudLow', 'balloon', 'crystal', 'cloud', 'island', 'balloon', 'cloudLow'];
    for (let i = 0; i < N_DECOR; i++) {
      const kind = kinds[i % kinds.length];
      const o = new THREE.Group();
      o.userData = { kind, z0: -i * DECOR_GAP - rand(0, DECOR_GAP), phase: rand(0, 6.28) };
      if (kind === 'cloud' || kind === 'cloudLow') {
        o.add(new THREE.Mesh(g.cloud, this.cloudMat));
      } else if (kind === 'island') {
        const mat = this._mat(new THREE.MeshPhysicalMaterial({ color: pick(CANDY), roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 }));
        const rock = new THREE.Mesh(g.island, rockMat); rock.position.y = -1.1;
        const grass = new THREE.Mesh(g.grass, this.grassMat); grass.position.y = -0.1; grass.scale.set(1, 1, 1);
        const stick = new THREE.Mesh(g.stick, stickMat); stick.position.y = 1.05;
        const candy = new THREE.Mesh(g.candy, mat); candy.position.y = 2.2; candy.scale.z = 0.45;
        const swirl = new THREE.Mesh(g.swirl, stickMat); swirl.position.y = 2.2; swirl.scale.setScalar(0.62);
        o.add(rock, grass, stick, candy, swirl);
        o.userData.mat = mat;
      } else if (kind === 'balloon') {
        const mat = this._mat(new THREE.MeshPhysicalMaterial({ color: pick(CANDY), roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 }));
        const b = new THREE.Mesh(g.balloon, mat); b.scale.y = 1.18;
        const k = new THREE.Mesh(g.knot, mat); k.position.y = -0.68; k.rotation.x = Math.PI;
        const s = new THREE.Mesh(g.string, stickMat); s.position.y = -0.74;
        o.add(b, k, s);
        o.userData.mat = mat;
      } else {
        const col = pick(CANDY);
        const mat = this._mat(new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.1, metalness: 0.1, clearcoat: 1,
          emissive: col, emissiveIntensity: 0.15, flatShading: true }));
        for (let k = 0; k < 3; k++) {
          const c = new THREE.Mesh(g.crystal, mat);
          c.position.set(rand(-0.8, 0.8), rand(-0.4, 0.8), rand(-0.8, 0.8));
          c.scale.set(0.55 + k * 0.2, 1.3 + k * 0.4, 0.55 + k * 0.2);
          c.rotation.y = rand(0, 3);
          o.add(c);
        }
        o.userData.mat = mat;
      }
      this._placeDecor(o, o.userData.z0);
      this.decor.push(o);
      this.scene.add(o);
    }
  }

  _placeDecor(o, z) {
    const d = o.userData, side = Math.random() < 0.5 ? -1 : 1;
    o.position.z = z;
    o.rotation.set(0, rand(0, 6.28), 0);
    if (d.mat && d.kind !== 'crystal') d.mat.color.setHex(pick(CANDY));
    switch (d.kind) {
      case 'cloud':    o.position.set(side * rand(13, 28), rand(0, 10), z); o.scale.setScalar(rand(1.1, 2.1)); break;
      case 'cloudLow': o.position.set(rand(-22, 22), rand(-9, -5), z); o.scale.setScalar(rand(1.8, 3.2)); break;
      case 'island':   o.position.set(side * rand(8.5, 17), rand(-2.4, 0.4), z); o.scale.setScalar(rand(0.8, 1.2)); break;
      case 'balloon':  o.position.set(side * rand(6.5, 14), rand(2, 7), z); o.scale.setScalar(rand(0.9, 1.3)); break;
      default:         o.position.set(side * rand(7.5, 15), rand(-1.5, 2.5), z); o.scale.setScalar(rand(0.8, 1.4)); break;
    }
    d.y0 = o.position.y;
  }

  _initFx() {
    // Partículas: una sola InstancedMesh (chispas, polvo, confites)
    this.pMax = 260;
    this.pMesh = new THREE.InstancedMesh(this._geo(new THREE.SphereGeometry(1, 10, 8)),
      this._mat(new THREE.MeshBasicMaterial({ color: 0xffffff })), this.pMax);
    this.pMesh.frustumCulled = false;
    this.parts = [];
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < this.pMax; i++) {
      this.parts.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 0.1, g: 0 });
      this.pMesh.setMatrixAt(i, zero);
      this.pMesh.setColorAt(i, new THREE.Color(1, 1, 1));
    }
    this.pNext = 0;
    this.scene.add(this.pMesh);
    this._m4 = new THREE.Matrix4();
    this._c = new THREE.Color();

    // Brillitos flotando alrededor de la pista
    const n = 170, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) pos.set([rand(-16, 16), rand(-2, 9), rand(-60, 8)], i * 3);
    const gg = this._geo(new THREE.BufferGeometry());
    gg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.glitterMat = this._mat(new THREE.PointsMaterial({ size: 0.22, map: this.dotTex, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending, color: 0xfff0fa, opacity: 0.85 }));
    this.glitter = new THREE.Points(gg, this.glitterMat);
    this.glitter.frustumCulled = false;
    this.scene.add(this.glitter);

    // Geometrías/materiales de obstáculos y objetos
    const G = this.G = {
      cake:   this._geo(new RoundedBoxGeometry(1.7, 0.9, 1.5, 4, 0.18)),
      cream:  this._geo(new RoundedBoxGeometry(1.84, 0.3, 1.64, 4, 0.14)),
      cherry: this._geo(new THREE.SphereGeometry(0.21, 24, 18)),
      stem:   this._geo(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 6)),
      cone:   this._geo(new THREE.ConeGeometry(0.33, 0.62, 28)),
      coneMid:this._geo(new THREE.CylinderGeometry(0.2, 0.33, 0.01, 28)),
      tip:    this._geo(new THREE.ConeGeometry(0.2, 0.36, 28)),
      jelly:  this._geo(new RoundedBoxGeometry(2.05, 2.8, 1.0, 5, 0.34)),
      jEye:   this._geo(new THREE.SphereGeometry(0.16, 18, 14)),
      jPup:   this._geo(new THREE.SphereGeometry(0.09, 14, 10)),
      pad:    this._geo(new THREE.CylinderGeometry(0.75, 0.82, 0.16, 36)),
      padRing:this._geo(new THREE.TorusGeometry(0.62, 0.06, 10, 40)),
      coin:   this._geo(coinGeometry()),
      star:   this._geo((() => { const s = new THREE.ExtrudeGeometry(starShape(0.55, 0.24), { depth: 0.14, bevelEnabled: true,
                bevelThickness: 0.08, bevelSize: 0.07, bevelSegments: 4, curveSegments: 4 }); s.center(); return s; })()),
    };
    this.M = {
      cream:  this._mat(new THREE.MeshPhysicalMaterial({ color: 0xfffaf4, roughness: 0.55, sheen: 1, sheenColor: new THREE.Color(0xffffff) })),
      cherry: this._mat(new THREE.MeshPhysicalMaterial({ color: 0xff2d55, roughness: 0.12, clearcoat: 1 })),
      stem:   this._mat(new THREE.MeshStandardMaterial({ color: 0x4f9a4a, roughness: 0.6 })),
      cone:   this._mat(new THREE.MeshPhysicalMaterial({ color: 0xffa630, roughness: 0.35, clearcoat: 0.8 })),
      coneMid:this._mat(new THREE.MeshPhysicalMaterial({ color: 0xffe066, roughness: 0.35, clearcoat: 0.8 })),
      tip:    this._mat(new THREE.MeshPhysicalMaterial({ color: 0xfffaf0, roughness: 0.35, clearcoat: 0.8 })),
      eyeW:   this._mat(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 })),
      eyeB:   this._mat(new THREE.MeshStandardMaterial({ color: 0x2a1830, roughness: 0.2 })),
      pad:    this._mat(new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.3, emissive: 0xffc000, emissiveIntensity: 0.6 })),
      padRing:this._mat(new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.9, 0.9) })),
      coin:   this._mat(new THREE.MeshStandardMaterial({ color: 0xffc83d, metalness: 1, roughness: 0.22, emissive: 0xb86b00, emissiveIntensity: 0.35 })),
      star:   this._mat(new THREE.MeshStandardMaterial({ color: 0xfff080, metalness: 0.5, roughness: 0.2, emissive: 0xffb000, emissiveIntensity: 0.9 })),
    };
    this.pool = { cake: [], cone: [], jelly: [], pad: [], coin: [], star: [] };
    this.objs = [];
  }

  _makeObj(type) {
    const G = this.G, M = this.M;
    const o = new THREE.Group();
    const add = (geo, mat, x, y, z, shadow = true) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; o.add(m); return m;
    };
    const d = { type, hw: 0, h: 0, hd: 0 };
    if (type === 'cake') {
      d.mat = this._mat(new THREE.MeshPhysicalMaterial({ color: 0xff9ccc, roughness: 0.5, sheen: 0.6, sheenColor: new THREE.Color(0xffffff) }));
      add(G.cake, d.mat, 0, 0.45, 0);
      add(G.cream, M.cream, 0, 0.95, 0);
      add(G.cherry, M.cherry, 0, 1.3, 0);
      const st = add(G.stem, M.stem, 0.06, 1.52, 0, false); st.rotation.z = -0.4;
      Object.assign(d, { hw: 0.9, h: 1.1, hd: 0.8 });
    } else if (type === 'cone') {
      for (const x of [-0.72, 0, 0.72]) {
        add(G.cone, M.cone, x, 0.31, 0);
        add(G.tip, M.tip, x, 0.62 + 0.14, 0);
      }
      Object.assign(d, { hw: 1.05, h: 0.85, hd: 0.33 });
    } else if (type === 'jelly') {
      d.mat = this._mat(new THREE.MeshPhysicalMaterial({ color: 0x7fd8ff, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05,
        transparent: true, opacity: 0.82, sheen: 0.4, emissive: 0x7fd8ff, emissiveIntensity: 0.08 }));
      const b = add(G.jelly, d.mat, 0, 1.4, 0);
      d.body = b;
      for (const s of [-1, 1]) {   // ojitos mirando a la jugadora (+z)
        const e = add(G.jEye, M.eyeW, 0.36 * s, 1.95, 0.46, false); e.scale.z = 0.5;
        const p = add(G.jPup, M.eyeB, 0.36 * s, 1.93, 0.54, false); p.scale.z = 0.5;
      }
      Object.assign(d, { hw: 1.02, h: 2.8, hd: 0.5 });
    } else if (type === 'pad') {
      add(G.pad, M.pad, 0, 0.08, 0, false);
      const r = add(G.padRing, M.padRing, 0, 0.17, 0, false); r.rotation.x = Math.PI / 2;
      Object.assign(d, { hw: 0.8, h: 0.3, hd: 0.8 });
    } else if (type === 'coin') {
      add(G.coin, M.coin, 0, 0, 0);
      Object.assign(d, { hw: 0.75, h: 0, hd: 0.8 });
    } else if (type === 'star') {
      add(G.star, M.star, 0, 0, 0);
      Object.assign(d, { hw: 0.8, h: 0, hd: 0.8 });
    }
    o.userData = d;
    return o;
  }

  _spawn(type, lane, dist, y = 0) {
    const o = this.pool[type].pop() || this._makeObj(type);
    const d = o.userData;
    d.lane = lane; d.dist = dist; d.y = y; d.alive = true; d.spin = rand(0, 6.28);
    o.position.set(LANES[lane], y, -dist);
    o.rotation.set(0, 0, 0);
    o.scale.setScalar(1);
    o.visible = true;
    if (d.mat) d.mat.color.setHex(type === 'jelly' ? pick([0x7fd8ff, 0xb58cff, 0x7fe0a8, 0xff9ccc]) : pick([0xff9ccc, 0xc9a0ff, 0x8fd8ff, 0xffd27a]));
    if (d.mat && type === 'jelly') d.mat.emissive.copy(d.mat.color);
    this.scene.add(o);
    this.objs.push(o);
    return o;
  }
  _free(o) {
    o.visible = false;
    o.userData.alive = false;
    this.scene.remove(o);
    this.pool[o.userData.type].push(o);
  }

  // ── Estado ────────────────────────────────────────────────────────────────
  reset() {
    for (const o of this.objs) this._free(o);
    this.objs = [];
    this.state = 'ready';
    this.dist = 0;
    this.speed = SPEED0;
    this.lane = 1; this.hx = 0;
    this.hy = 0; this.vy = 0; this.onGround = true;
    this.flip = 0; this.flipDur = 0.7;
    this.coins = 0;
    this.hearts = HEARTS;
    this.invuln = 0;
    this.shield = 0;
    this.squash = 0;
    this.shake = 0;
    this.overT = 0;
    this.camBlend = 0;
    this.nextRow = 45;
    this.coyote = 0; this.jumpBuf = 0;
    this.tilt = 0;
    this.hero.position.set(0, 0, 0);
    this.hero.rotation.set(0, 0, 0);
    this.heroPivot.rotation.set(0, 0, 0);
    this.shieldMesh.visible = false;
    this.themeIdx = -1;
    this._hud = {};
    this._ensureRows();
    this._msg('ready');
    this._updateHud(true);
  }

  start() {
    if (this.state === 'ready') { this.state = 'run'; this._msg(null); this._toast(THEMES[0].name); }
    else if (this.state === 'over' && this.overT > 0.8) { this.reset(); this.start(); }
  }

  // ── Entrada ──────────────────────────────────────────────────────────────
  _initInput() {
    let sx = 0, sy = 0, st = 0, done = true;
    this._pd = e => {
      sx = e.clientX; sy = e.clientY; st = performance.now(); done = false;
      e.preventDefault();
    };
    this._pm = e => {
      if (done) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      const th = 28;
      if (Math.abs(dx) > th && Math.abs(dx) > Math.abs(dy)) { done = true; this.move(dx > 0 ? 1 : -1); }
      else if (dy < -th && Math.abs(dy) > Math.abs(dx)) { done = true; this.jump(); }
    };
    this._pu = e => {
      if (done) return;
      done = true;
      if (performance.now() - st < 450) {
        const r = this.el.getBoundingClientRect();
        this.pointer(e.clientX - r.left, e.clientY - r.top);
      }
    };
    this.el.addEventListener('pointerdown', this._pd);
    window.addEventListener('pointermove', this._pm);
    window.addEventListener('pointerup', this._pu);
  }

  // Tap: arranca / salta (la entrada estándar de los mini-juegos)
  pointer() {
    if (this.state === 'run') this.jump();
    else this.start();
  }

  move(dir) {
    if (this.state === 'ready') { this.start(); return; }
    if (this.state !== 'run') return;
    const nl = clamp(this.lane + dir, 0, 2);
    if (nl !== this.lane) { this.lane = nl; this.tilt = -dir; }
    else this.shake = Math.max(this.shake, 0.08);   // tope del borde
  }

  jump() {
    if (this.state === 'ready') { this.start(); return; }
    if (this.state !== 'run') return;
    if (this.onGround || this.coyote > 0) this._doJump(JUMP_V);
    else this.jumpBuf = 0.14;     // si toca justo antes de aterrizar, salta igual
  }

  _doJump(v) {
    this.vy = v; this.onGround = false; this.coyote = 0; this.jumpBuf = 0;
    this.flip = 0; this.flipDur = (2 * v) / GRAV;
    this.squash = -0.25;
    this._burst(this.hx, 0.1, -this.dist, 8, [1, 1, 1], 2.2, 0.35, 0.09);
  }

  // ── Generación de filas ──────────────────────────────────────────────────
  _ensureRows() {
    while (this.nextRow < this.dist + N_ROWS * TILE_L - 12) {
      this._makeRow(this.nextRow);
      const gapT = rand(0.95, 1.55) - clamp(this.dist / 4000, 0, 0.25);
      this.nextRow += Math.max(12, this.speed * gapT);
    }
  }

  _makeRow(d) {
    const lvl = clamp(d / 1500, 0, 1);
    const r = Math.random();
    const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
    const jumpable = () => (Math.random() < 0.55 ? 'cake' : 'cone');
    if (r < 0.07 && d > 200) {             // estrella → escudo
      this._spawn('star', lanes[0], d, 1.1);
      this._coinLine(lanes[1], d - 4, 4);
      return;
    }
    if (r < 0.17) {                        // trampolín + arco de monedas en el aire
      this._spawn('pad', lanes[0], d);
      this._coinArc(lanes[0], d, PAD_V, 9);
      if (Math.random() < 0.6) this._spawn(jumpable(), lanes[1], d + 3);
      return;
    }
    if (r < 0.42) {                        // un obstáculo saltable con arco de monedas
      this._spawn(jumpable(), lanes[0], d);
      this._coinArc(lanes[0], d, JUMP_V, 7);
      if (Math.random() < 0.35 + lvl * 0.4) this._spawn('jelly', lanes[1], d);
      return;
    }
    if (r < 0.7) {                         // dos gelatinas: hay que ir al carril libre
      this._spawn('jelly', lanes[0], d);
      this._spawn('jelly', lanes[1], d);
      this._coinLine(lanes[2], d - 5, 5);
      return;
    }
    // tres carriles ocupados: al menos uno saltable
    const sp = Math.random() < lvl ? 2 : 1;   // cuántas gelatinas
    for (let i = 0; i < 3; i++) this._spawn(i < sp ? 'jelly' : jumpable(), lanes[i], d);
    this._coinArc(lanes[2], d, JUMP_V, 7);
  }

  _coinLine(lane, d0, n) {
    for (let i = 0; i < n; i++) this._spawn('coin', lane, d0 + i * 2.2, 0.75);
  }

  // Monedas siguiendo la parábola real del salto centrada en d
  _coinArc(lane, d, v, n) {
    const air = (2 * v) / GRAV, span = air * this._speedAt(d) * 0.92;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);                  // 0..1 a lo largo del salto
      const tt = t * air;
      const y = v * tt - 0.5 * GRAV * tt * tt;
      this._spawn('coin', lane, d - span / 2 + t * span, 0.7 + y);
    }
  }

  _speedAt(d) { return clamp(SPEED0 + d * 0.0065, SPEED0, SPEED_MAX); }

  // ── Update ───────────────────────────────────────────────────────────────
  update(dt) {
    dt = clamp(dt || 0, 0, 0.05);   // el primer frame puede venir negativo (rAF vs. performance.now)
    this._t += dt;
    this._adaptQuality(dt);

    if (this.state === 'run') {
      this.speed = this._speedAt(this.dist);
      this.dist += this.speed * dt;
    } else if (this.state === 'over') {
      this.overT += dt;
      this.speed = Math.max(0, this.speed - 30 * dt);
      this.dist += this.speed * dt;
      if (this.overT > 0.9 && !this._overShown) { this._overShown = true; this._msg('over'); }
    }

    // Héroe: carril (suave), salto, giro
    const tx = LANES[this.lane];
    this.hx += (tx - this.hx) * Math.min(1, dt * 14);
    this.tilt *= Math.pow(0.02, dt);
    if (this.state === 'run' || this.state === 'over') {
      if (!this.onGround) {
        this.vy -= GRAV * dt;
        this.hy += this.vy * dt;
        this.flip += dt;
        if (this.hy <= 0) {
          this.hy = 0; this.vy = 0; this.onGround = true; this.squash = 0.35;
          this._burst(this.hx, 0.05, -this.dist + 0.3, 10, [1, 0.95, 1], 2.6, 0.45, 0.1);
          if (this.jumpBuf > 0 && this.state === 'run') this._doJump(JUMP_V);
        }
      }
      this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    }
    this.coyote = this.onGround ? 0.1 : Math.max(0, this.coyote - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    if (this.shield > 0) { this.shield = Math.max(0, this.shield - dt); }

    if (this.state === 'run') {
      this._ensureRows();
      this._collide();
    }
    this._updateObjs(dt);
    this._updateHero(dt);
    this._updateTheme();
    this._updateWorld(dt);
    this._updateParticles(dt);
    this._updateCamera(dt);
    this._updateHud();
  }

  _collide() {
    const pz = this.dist;
    for (const o of this.objs) {
      const d = o.userData;
      if (!d.alive) continue;
      const dz = Math.abs(d.dist - pz);
      if (dz > 1.6) continue;
      const dx = Math.abs(o.position.x - this.hx);
      if (d.type === 'coin') {
        if (dx < 0.85 && dz < 0.8 && Math.abs(d.y - (this.hy + 0.5)) < 1.05) {
          this.coins++; addCoins(1);
          this._burst(o.position.x, d.y, o.position.z, 10, [2.2, 1.7, 0.5], 3, 0.4, 0.07);
          this._free(o);
        }
        continue;
      }
      if (d.type === 'star') {
        if (dx < 0.9 && dz < 0.9 && Math.abs(d.y - (this.hy + 0.5)) < 1.2) {
          this.shield = 8;
          this._burst(o.position.x, d.y, o.position.z, 26, [2.4, 2.1, 0.8], 5, 0.7, 0.1);
          this._toast('✨ ¡Escudo de burbuja!');
          this._free(o);
        }
        continue;
      }
      if (d.type === 'pad') {
        if (dx < 0.95 && dz < d.hd + 0.3 && this.hy < 0.3 && this.vy <= 0) {
          this._doJump(PAD_V);
          this._burst(o.position.x, 0.3, o.position.z, 18, [2.2, 1.9, 0.7], 4, 0.5, 0.09);
        }
        continue;
      }
      // obstáculo sólido: AABB 3D, un poco generosa (es para chicos)
      if (dx < d.hw + 0.36 && dz < d.hd + 0.36 && this.hy < d.h - 0.2) this._hit(o);
    }
  }

  _hit(o) {
    const d = o.userData;
    const col = d.type === 'cone' ? [2, 1.2, 0.4] : d.mat ? d.mat.color.toArray() : [1, 0.6, 0.8];
    this._burst(o.position.x, d.h * 0.5, o.position.z, 30, col, 6, 0.8, 0.13);
    this._free(o);
    if (this.shield > 0) {           // la burbuja absorbe el golpe
      this.shield = 0;
      this._burst(this.hx, this.hy + 0.5, -this.dist, 24, [0.8, 1.8, 2.4], 5, 0.6, 0.09);
      this.shake = 0.25;
      return;
    }
    if (this.invuln > 0) return;
    this.hearts--;
    this.shake = 0.45;
    this.invuln = 1.6;
    this.speed *= 0.8;
    if (this.hearts <= 0) this._gameOver();
  }

  _gameOver() {
    this.state = 'over';
    this.overT = 0;
    this._overShown = false;
    this.vy = 9; this.onGround = false;
    const m = this.finalDist = Math.floor(this.dist);
    this.newBest = m > this.best;
    if (this.newBest) { this.best = m; try { localStorage.setItem('dash3d_best', String(m)); } catch (e) {} }
  }

  _updateObjs(dt) {
    const pz = this.dist;
    for (let i = this.objs.length - 1; i >= 0; i--) {
      const o = this.objs[i], d = o.userData;
      if (!d.alive) { this.objs.splice(i, 1); continue; }
      // lo que ya pasó se achica ("puf") para no tapar la cámara
      const gone = clamp((pz - d.dist - 1.2) / 2.5, 0, 1);
      if (gone >= 1) { this._free(o); this.objs.splice(i, 1); continue; }
      d.spin += dt;
      o.scale.setScalar(1);
      if (d.type === 'coin') {
        o.rotation.y = d.spin * 3.2;
        o.position.y = d.y + Math.sin(d.spin * 4) * 0.06;
      } else if (d.type === 'star') {
        o.rotation.y = d.spin * 2.2;
        o.position.y = d.y + Math.sin(d.spin * 3) * 0.15;
      } else if (d.type === 'jelly') {
        const w = Math.sin(d.spin * 5);              // bamboleo de gelatina
        o.scale.set(1 + w * 0.03, 1 - w * 0.03, 1 + w * 0.03);
      } else if (d.type === 'pad') {
        o.children[1].scale.setScalar(1 + (Math.sin(d.spin * 8) * 0.5 + 0.5) * 0.2);
      }
      if (gone > 0) o.scale.multiplyScalar(1 - smooth(gone));
    }
  }

  _updateHero(dt) {
    const h = this.hero, p = this.heroPivot;
    h.position.set(this.hx, this.hy, -this.dist);
    // Giro completo en el aire (homenaje a Geometry Dash, pero siempre cae parado)
    if (this.state === 'over') {
      p.rotation.x -= dt * 6; p.rotation.z += dt * 3;
    } else if (!this.onGround) {
      const t = clamp(this.flip / this.flipDur, 0, 1);
      p.rotation.x = -Math.PI * 2 * smooth(t);
    } else {
      p.rotation.x = this.state === 'run' ? -0.12 : 0;
    }
    if (this.state !== 'over') p.rotation.z = this.tilt * 0.35;
    // Rebote al correr + aplastar/estirar
    this.squash += (0 - this.squash) * Math.min(1, dt * 10);
    const bob = this.state === 'run' && this.onGround ? Math.abs(Math.sin(this._t * 13)) * 0.09 : 0;
    const idle = this.state === 'ready' ? Math.abs(Math.sin(this._t * 3.2)) * 0.25 : 0;
    const sq = this.squash;
    p.scale.set(1 + sq * 0.35, 1 - sq * 0.45, 1 + sq * 0.35);
    p.position.y = HERO_CY - sq * HERO_CY * 0.45 + bob + idle;
    // Piernas y brazos: trote al correr, bolita en el aire, saludo al esperar
    const ph = this._t * 13;
    const running = this.state === 'run' && this.onGround;
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1;
      let leg, armX, armZ;
      if (running)            { leg = Math.sin(ph) * 0.85 * s; armX = -Math.sin(ph) * 0.9 * s; armZ = 0.35; }
      else if (!this.onGround) { leg = 0.9; armX = 2.5; armZ = 0.5; }
      else if (this.state === 'ready') {
        leg = 0; armX = i ? 2.7 + Math.sin(this._t * 7) * 0.3 : -0.1; armZ = i ? 0.5 : 0.25;
      } else                  { leg = 0; armX = 0; armZ = 0.3; }
      const k = Math.min(1, dt * 18);
      this.legs[i].rotation.x += (leg - this.legs[i].rotation.x) * k;
      this.arms[i].rotation.x += (armX - this.arms[i].rotation.x) * k;
      this.arms[i].rotation.z += (armZ * s - this.arms[i].rotation.z) * k;
    }
    this.head.rotation.z = running ? Math.sin(ph) * 0.06 : 0;
    // Orejas: se sacuden con el movimiento
    const flap = this.onGround ? Math.sin(ph) * 0.12 : -0.35;
    this.ears[0].rotation.x = this.ears[1].rotation.x = 0.1 + flap;
    // Parpadeo
    const blink = (this._t % 3.4) < 0.12 ? 0.1 : 1;
    this.eyes[0].scale.y = this.eyes[1].scale.y = blink;
    // Invulnerable: parpadea
    h.visible = !(this.invuln > 0 && this.state === 'run' && Math.floor(this.invuln * 12) % 2 === 0);
    // Escudo
    this.shieldMesh.visible = this.shield > 0 && (this.shield > 1.5 || Math.floor(this.shield * 10) % 2 === 0);
    if (this.shieldMesh.visible) {
      const s = 1 + Math.sin(this._t * 6) * 0.04;
      this.shieldMesh.scale.set(s, s * 1.08, s);
    }
    // Estela de chispitas
    if (this.state === 'run' && Math.random() < dt * 30) {
      this._burst(this.hx + rand(-0.3, 0.3), this.hy + rand(0.2, 0.9), -this.dist + 0.6, 1,
        pick([[2, 1.2, 1.8], [1.6, 1.4, 2.4], [2.2, 2, 1.2]]), 0.6, 0.5, 0.05, 0);
    }
  }

  _updateTheme() {
    const f = this.dist / THEME_M;
    const i = Math.floor(f) % THEMES.length;
    const a = THEMES[i], b = THEMES[(i + 1) % THEMES.length];
    const frac = f - Math.floor(f);
    const t = smooth(clamp((frac - 0.85) / 0.15, 0, 1));   // transición en el último 15%
    if (i !== this.themeIdx) {
      if (this.themeIdx >= 0 && this.state === 'run') this._toast(a.name);
      this.themeIdx = i;
    }
    const C = this.col, tmp = this._c;
    for (const k in C) C[k].setHex(a[k]).lerp(tmp.setHex(b[k]), t);
    const night = a.night + (b.night - a.night) * t;
    this.night = night;
    this.skyU.top.value.copy(C.skyTop);
    this.skyU.bot.value.copy(C.skyBot);
    this.skyU.sunCol.value.copy(C.sun);
    this.scene.fog.color.copy(C.skyBot);
    this.hemi.color.copy(C.hemiSky);
    this.hemi.groundColor.copy(C.hemiGnd);
    this.hemi.intensity = a.hemiI + (b.hemiI - a.hemiI) * t;
    this.sun.color.copy(C.sun);
    this.sun.intensity = a.sunI + (b.sunI - a.sunI) * t;
    this.baseMat.color.copy(C.base);
    this.railMat.color.copy(C.rail);
    this.railMat.emissive.copy(C.rail).multiplyScalar(night * 0.25);
    this.cloudMat.color.copy(C.cloud);
    this.cloudMat.emissive.copy(C.cloud);
    this.starMat.opacity = night;
    this.glitterMat.opacity = 0.55 + night * 0.4;
    this.bloom.strength = 0.28 + night * 0.3;
    // Damero de la pista
    const key = C.tileA.getHexString() + C.tileB.getHexString();
    if (key !== this._tileKey) {
      this._tileKey = key;
      for (let r = 0; r < N_ROWS; r++)
        for (let l = 0; l < 3; l++) this.tiles.setColorAt(r * 3 + l, (r + l) % 2 ? C.tileB : C.tileA);
      this.tiles.instanceColor.needsUpdate = true;
    }
  }

  _updateWorld(dt) {
    // Pista: avanza de a 2 filas (conserva el damero)
    const step = TILE_L * 2;
    const snap = Math.floor((this.dist - 10) / step);
    if (snap !== this._trackSnap) {
      this._trackSnap = snap;
      this.track.position.z = -snap * step;
      // lucecitas de colores alternados por fila global
      const bulbCols = [[2.4, 1.2, 1.9], [1.4, 1.6, 2.6], [2.4, 2.1, 1.0], [1.2, 2.3, 1.7]];
      for (let r = 0; r < N_ROWS; r++) {
        const c = bulbCols[(((snap * 2 + r) % 4) + 4) % 4];
        this._c.setRGB(c[0], c[1], c[2]);
        this.bulbs.setColorAt(r * 2, this._c);
        this.bulbs.setColorAt(r * 2 + 1, this._c);
      }
      this.bulbs.instanceColor.needsUpdate = true;
    }
    // Decoración: reciclar lo que quedó atrás
    const camZ = -this.dist + 12;
    for (const o of this.decor) {
      const d = o.userData;
      if (o.position.z > camZ) this._placeDecor(o, o.position.z - DECOR_SPAN);
      if (d.kind === 'balloon' || d.kind === 'island') o.position.y = d.y0 + Math.sin(this._t * 1.2 + d.phase) * 0.35;
      if (d.kind === 'crystal') { o.rotation.y += dt * 0.6; o.position.y = d.y0 + Math.sin(this._t * 1.5 + d.phase) * 0.4; }
      if (d.kind === 'crystal' && d.mat) d.mat.emissiveIntensity = 0.15 + this.night * 0.9;
    }
    // Brillitos: envolver alrededor de la jugadora
    const pos = this.glitter.geometry.attributes.position;
    const baseZ = -this.dist;
    for (let i = 0; i < pos.count; i++) {
      let z = pos.getZ(i);
      if (z > baseZ + 10) z -= 72;
      else if (z < baseZ - 62) z += 72;
      pos.setZ(i, z);
      pos.setY(i, pos.getY(i) + Math.sin(this._t + i) * dt * 0.2);
    }
    pos.needsUpdate = true;
    // Sol: sigue a la jugadora (sombras siempre nítidas cerca)
    this.sun.position.set(this.hx - 7, 18, -this.dist - 12);
    this.sun.target.position.set(this.hx * 0.5, 0, -this.dist - 6);
  }

  _burst(x, y, z, n, col, spd, life, size, grav = 9) {
    for (let k = 0; k < n; k++) {
      const idx = this.pNext, p = this.parts[idx];
      this.pNext = (idx + 1) % this.pMax;
      const a = Math.random() * Math.PI * 2, u = rand(-0.3, 1);
      p.x = x; p.y = y; p.z = z;
      p.vx = Math.cos(a) * spd * rand(0.3, 1);
      p.vy = u * spd * rand(0.4, 1);
      p.vz = Math.sin(a) * spd * rand(0.3, 1);
      p.life = p.max = life * rand(0.6, 1.2);
      p.s = size * rand(0.7, 1.3);
      p.g = grav;
      this._c.setRGB(col[0], col[1], col[2]);
      this.pMesh.setColorAt(idx, this._c);
    }
    this.pMesh.instanceColor.needsUpdate = true;
  }

  _updateParticles(dt) {
    const m = this._m4;
    let any = false;
    for (let i = 0; i < this.pMax; i++) {
      const p = this.parts[i];
      if (p.life <= 0) continue;
      any = true;
      p.life -= dt;
      p.vy -= p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const s = p.life > 0 ? p.s * (p.life / p.max) : 0;
      m.makeScale(s, s, s).setPosition(p.x, p.y, p.z);
      this.pMesh.setMatrixAt(i, m);
    }
    if (any || this._pAny) this.pMesh.instanceMatrix.needsUpdate = true;
    this._pAny = any;
  }

  _updateCamera(dt) {
    const cam = this.camera, pz = -this.dist;
    // Cámara de presentación (de frente, girando suave) → cámara de carrera
    const a = Math.sin(this._t * 0.5) * 0.55;
    const introPos = new THREE.Vector3(this.hx + Math.sin(a) * 4.3, 1.45, pz - Math.cos(a) * 4.3);
    const introLook = new THREE.Vector3(this.hx, 0.45, pz);
    const runPos = new THREE.Vector3(this.hx * 0.55, 3.4 + this.hy * 0.35, pz + 7.4);
    const runLook = new THREE.Vector3(this.hx * 0.7, 1 + this.hy * 0.3, pz - 8);
    let target = 0;
    if (this.state === 'run') target = 1;
    else if (this.state === 'over') target = 1 - smooth(clamp((this.overT - 0.3) / 1.4, 0, 1)) * 0.8;
    this.camBlend += (target - this.camBlend) * Math.min(1, dt * (this.state === 'run' ? 2.6 : 1.4));
    const k = smooth(clamp(this.camBlend, 0, 1));
    cam.position.lerpVectors(introPos, runPos, k);
    // Un arco por arriba durante la transición (para no atravesar al héroe)
    cam.position.y += Math.sin(k * Math.PI) * 2.2;
    const look = introLook.lerp(runLook, k);
    if (this.shake > 0) {
      const s = this.shake;
      cam.position.x += rand(-s, s); cam.position.y += rand(-s, s) * 0.6;
      this.shake = Math.max(0, this.shake - dt * 1.4);
    }
    cam.lookAt(look);
    const fov = this._baseFov + (this.speed - SPEED0) * 0.45 * k;
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
    this.sky.position.copy(cam.position);
    this.stars.position.copy(cam.position);
  }

  // ── HUD (DOM en #dash3d-ui) ──────────────────────────────────────────────
  _updateHud(force) {
    const H = this._hud;
    const m = Math.floor(this.dist);
    if (force || H.m !== m) { H.m = m; const e = $('dash3d-dist'); if (e) e.textContent = m + ' m'; }
    if (force || H.c !== this.coins) { H.c = this.coins; const e = $('dash3d-coins'); if (e) e.textContent = '🪙 ' + this.coins; }
    if (force || H.h !== this.hearts) {
      H.h = this.hearts;
      const e = $('dash3d-hearts');
      if (e) e.textContent = '💖'.repeat(Math.max(0, this.hearts)) + '🤍'.repeat(HEARTS - Math.max(0, this.hearts));
    }
  }

  _msg(kind) {
    const e = $('dash3d-msg');
    if (!e) return;
    if (!kind) { e.classList.add('hidden'); return; }
    e.classList.remove('hidden');
    if (kind === 'ready') {
      e.innerHTML = `<div class="d3-title">Dash 3D</div>
        <div class="d3-sub">Tocá para empezar</div>
        <div class="d3-help">⬅️ ➡️ deslizá para cambiar de carril<br>⬆️ tocá para saltar · ⭐ = escudo</div>
        ${this.best ? `<div class="d3-best">Récord: ${this.best} m</div>` : ''}`;
    } else {
      e.innerHTML = `<div class="d3-title">${this.newBest ? '🏆 ¡Nuevo récord!' : '¡Uy, chocaste!'}</div>
        <div class="d3-stats"><span>📏 ${this.finalDist} m</span><span>🪙 ${this.coins}</span></div>
        <div class="d3-best">Récord: ${this.best} m</div>
        <button id="dash3d-again" class="d3-again">↻ Otra vez</button>`;
      const b = $('dash3d-again');
      if (b) b.addEventListener('click', ev => { ev.stopPropagation(); this.reset(); this.start(); });
    }
  }

  _toast(text) {
    const e = $('dash3d-toast');
    if (!e) return;
    e.textContent = text;
    e.classList.remove('show'); void e.offsetWidth; e.classList.add('show');
  }

  // Compila los shaders antes de mostrar el juego (en celulares puede tardar
  // unos segundos: mejor con el cartel de "Preparando…" que con la pantalla congelada)
  async warmup() {
    this.update(0);
    try {
      if (this.renderer.compileAsync) {
        await Promise.race([this.renderer.compileAsync(this.scene, this.camera), new Promise(r => setTimeout(r, 8000))]);
      }
    } catch (e) { /* si falla, se compila en el primer frame */ }
    this.render();
    const gl = this.renderer.getContext();
    if (gl.isContextLost && gl.isContextLost()) throw new Error('la placa de video cortó el 3D (contexto WebGL perdido)');
  }
  showReady() { this._msg(this.state === 'ready' ? 'ready' : null); }
  showError(err) {
    const e = $('dash3d-msg');
    if (!e) return;
    e.classList.remove('hidden');
    e.innerHTML = `<div class="d3-title">Ups 😿</div><div class="d3-sub">El 3D se trabó</div>
      <div class="d3-help"><small>${String((err && err.message) || err).replace(/</g, '&lt;')}</small></div>`;
  }

  // ── Render / calidad ─────────────────────────────────────────────────────
  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w / 2, h / 2);
    this.camera.aspect = w / h;
    this._baseFov = w / h < 1 ? 78 : w / h < 1.4 ? 66 : 58;
    this.camera.fov = this._baseFov;
    this.camera.updateProjectionMatrix();
  }

  // Si el equipo no llega a ~40 fps, bajamos calidad (primero bloom, después resolución)
  _adaptQuality(dt) {
    this._fpsAcc += dt; this._fpsN++;
    if (this._fpsAcc < 2) return;
    const avg = this._fpsAcc / this._fpsN;
    this._fpsAcc = 0; this._fpsN = 0;
    if (avg > 1 / 40 && this.quality > 0) {
      this.quality--;
      if (this.quality === 0) {
        this.renderer.setPixelRatio(Math.max(1, this.pixelRatio * 0.7));
        this._resize();
      }
    }
  }

  render() {
    if (this.quality >= 2) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('pointermove', this._pm);
    window.removeEventListener('pointerup', this._pu);
    this.el.removeEventListener('pointerdown', this._pd);
    for (const d of this._disposables) { try { d.dispose(); } catch (e) {} }
    try { this.envTex.dispose(); } catch (e) {}
    try { this.composer.dispose && this.composer.dispose(); } catch (e) {}
    try { this.bloom.dispose(); } catch (e) {}
    try { this.renderer.dispose(); this.renderer.forceContextLoss(); } catch (e) {}
    this.el.remove();
    const m = $('dash3d-msg'); if (m) m.classList.add('hidden');
  }
}
