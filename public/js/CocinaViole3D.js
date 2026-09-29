// ── Cocina con Viole 3D (CocinaViole3D.js) — versión 3D real (Three.js/WebGL) ───────────
// La misma cocina de "Cocina con Viole" (mismas recetas y estaciones: se importan de
// Cocina.js para que ambas versiones no se desincronicen), pero en una cocinita 3D vista
// en isométrica: Viole (la chef Labubu) camina tocando el piso, agarra ingredientes de las
// canastas y los lleva a cada estación hasta armar el plato del pedido.
//
// Render: WebGLRenderer propio sobre un <canvas> que se superpone al canvas 2D del
// orquestador (game.js sigue llamando update(dt)/render()). Cámara ortográfica fija (así
// se ve toda la cocina de un vistazo, sin distorsión de perspectiva en los bordes), luces
// con sombra suave y mapa de entorno para los materiales. Los ingredientes son sprites con
// el emoji dibujado en un canvas (igual que la versión 2D), parados en el mundo 3D.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { addFood } from './Pantry.js';
import {
  ING, RECIPES, CHOPPABLE, BOILABLE, FRYABLE_FROM_RAW, FRYABLE_FROM_BOILED,
  BLENDABLE, BAKEABLE, PROC_DUR, buildStationLayout,
} from './Cocina.js';

const rand   = (a, b) => a + Math.random() * (b - a);
const clamp  = (v, a, b) => Math.max(a, Math.min(b, v));
const $ = id => document.getElementById(id);
function lerpAngle(a, b, k) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

// ── Mundo: convierte las coordenadas normalizadas (0..1) del layout 2D en posiciones 3D ──
const WORLD_X = 15;                 // ancho total del piso (mundo)
const Z_BACK  = -9.4;               // fondo, mostrador de estaciones (ny chico)
const Z_FRONT = 3.2;                // borde cercano a cámara, última fila de canastas (ny grande)
const wx = nx => (nx - 0.5) * WORLD_X;
const wz = ny => Z_BACK + ny * (Z_FRONT - Z_BACK);

const PROC_KINDS = ['chop', 'boil', 'fry', 'bake', 'blend'];
const STATE_MAP  = { chop: 'chopped', boil: 'boiled', fry: 'fried', bake: 'baked', blend: 'blended' };
const KIND_BY_STATE = { chopped: 'chop', boiled: 'boil', fried: 'fry', baked: 'bake', blended: 'blend' };
const STATE_LABEL = { chopped: 'cortado', boiled: 'hervido', fried: 'frito', baked: 'horneado', blended: 'licuado' };
const KIND_LABEL = { chop: 'Cortar 🔪', boil: 'Hervir 🫕', fry: 'Freír 🥘', bake: 'Hornear 🔥', blend: 'Licuar 🥤', mix: 'Mezclar 🥣', plate: 'el Plato 🍽️' };
// Alcance para interactuar (podés estar así de lejos y ya cuenta) y radio de colisión
// (no se puede caminar más cerca que esto: las mesas y canastas son sólidas). El de
// colisión siempre es menor al de alcance, así se puede usar la estación sin traspasarla.
const BASKET_REACH = 0.72, STATION_REACH = 1.45;
const BASKET_COLLIDE = 0.52, STATION_COLLIDE = 1.02;
const TOP_COLORS  = {
  chop: 0xC2D4E0, boil: 0xA8D8F8, fry: 0xF8C8A0, bake: 0xF8D8A0,
  blend: 0xF4A8D0, plate: 0xC8F0B0, trash: 0xC8C8C8, mix: 0xFFE4C0,
};
const RING_COLORS  = { chop: 0x5FBF44, boil: 0x4AB8E8, fry: 0xFF8C42, bake: 0xFF6010, blend: 0xE486C0 };
const BURST_COLORS = {
  chop: [0.62, 0.85, 0.42], boil: [0.36, 0.78, 0.93], fry: [1.4, 0.62, 0.3],
  bake: [1.5, 0.5, 0.12], blend: [0.95, 0.55, 0.78],
};

export class CocinaViole3D {
  constructor(canvas) {
    this.hostCanvas = canvas;
    this.best = 0;
    try { this.best = +(localStorage.getItem('cocina3d_best') || 0) || 0; } catch (e) { /* sin storage */ }
    this._disposables = [];
    this._spriteCache = new Map();
    this._t = 0;
    this.dir = { x: 0, z: 0 };
    this._target = null;

    this._initRenderer();
    this._initScene();

    this.stations = buildStationLayout();
    this._stationById = {};
    for (const s of this.stations) { s.wx = wx(s.nx); s.wz = wz(s.ny); this._stationById[s.id] = s; }
    this._bounds = { minX: wx(0.05), maxX: wx(0.95), minZ: wz(0.44), maxZ: wz(0.95) };

    this._buildKitchen();
    this._buildChef();
    this._initFx();
    this._initInput();
    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize);
    this._resize();
    this.reset();
  }

  // ── Setup ─────────────────────────────────────────────────────────────────
  _geo(g) { this._disposables.push(g); return g; }
  _mat(m) {
    if (m.envMapIntensity === 1) m.envMapIntensity = 0.5;
    this._disposables.push(m);
    return m;
  }

  _initRenderer() {
    const c = document.createElement('canvas');
    c.id = 'cocinaviole3d-canvas';
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
    r.toneMappingExposure = 0.85;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = r;
    this.quality = 2;          // 2 = bloom + MSAA, 1 = sin bloom, 0 = resolución reducida
    this._fpsAcc = 0; this._fpsN = 0;
  }

  _initScene() {
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(0xFBE9EF);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment(this.renderer);
    this.envTex = pmrem.fromScene(room, 0.04).texture;
    room.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    pmrem.dispose();
    scene.environment = this.envTex;

    this.hemi = new THREE.HemisphereLight(0xffffff, 0xe8b48c, 0.55);
    scene.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight(0xfff3e0, 1.15);
    sun.position.set(6, 12, 5);
    sun.target.position.set(0, 0, -3);
    sun.castShadow = true;
    const sz = this.touch ? 1024 : 2048;
    sun.shadow.mapSize.set(sz, sz);
    const sc = sun.shadow.camera;
    sc.left = -10; sc.right = 10; sc.top = 9; sc.bottom = -9; sc.near = 1; sc.far = 32;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4;
    scene.add(sun, sun.target);

    // Cámara ortográfica fija en isométrica: toda la cocina entra siempre en pantalla,
    // sin la distorsión de una perspectiva ancha (_fitCamera recalcula el frustum en resize).
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    const elev = THREE.MathUtils.degToRad(44), azim = THREE.MathUtils.degToRad(-26);
    const dir = new THREE.Vector3(Math.sin(azim) * Math.cos(elev), Math.sin(elev), Math.cos(azim) * Math.cos(elev));
    const target = new THREE.Vector3(0, 0.6, (Z_BACK + Z_FRONT) / 2 - 1);
    this.camera.position.copy(target).addScaledVector(dir, 30);
    this.camera.lookAt(target);

    const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.16, 0.5, 1.05);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._raycaster = new THREE.Raycaster();
  }

  // ── Texturas (canvas 2D → CanvasTexture, cacheadas) ─────────────────────────
  _checkerTexture(colA, colB, n) {
    const size = 256, cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const g = cv.getContext('2d'), cell = size / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { g.fillStyle = (x + y) % 2 ? colB : colA; g.fillRect(x * cell, y * cell, cell, cell); }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    this._disposables.push(tex);
    return tex;
  }
  _gradientTexture(top, bottom) {
    const cv = document.createElement('canvas'); cv.width = 8; cv.height = 256;
    const g = cv.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, top); gr.addColorStop(1, bottom);
    g.fillStyle = gr; g.fillRect(0, 0, 8, 256);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    this._disposables.push(tex);
    return tex;
  }
  _itemTexture(base, state) {
    const key = 'i:' + base + '|' + state;
    let tex = this._spriteCache.get(key);
    if (tex) return tex;
    const ing = ING[base], size = 128;
    const cv = document.createElement('canvas'); cv.width = cv.height = size;
    const g = cv.getContext('2d');
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (state === 'chopped') {
      g.font = `${size * 0.34}px serif`;
      g.fillText(ing.raw, size * 0.34, size * 0.6);
      g.fillText(ing.raw, size * 0.66, size * 0.6);
      g.fillText(ing.raw, size * 0.5, size * 0.28);
    } else {
      let e = ing.raw;
      if (state === 'boiled'  && ing.boiled)  e = ing.boiled;
      if (state === 'fried'   && ing.fried)   e = ing.fried;
      if (state === 'baked'   && ing.baked)   e = ing.baked;
      if (state === 'blended' && ing.blended) e = ing.blended;
      g.font = `${size * 0.74}px serif`;
      g.fillText(e, size / 2, size / 2 + size * 0.02);
    }
    tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    this._disposables.push(tex);
    this._spriteCache.set(key, tex);
    return tex;
  }
  _iconTexture(str) {
    const key = 'g:' + str;
    let tex = this._spriteCache.get(key);
    if (tex) return tex;
    const size = 128;
    const cv = document.createElement('canvas'); cv.width = cv.height = size;
    const g = cv.getContext('2d');
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `${size * 0.72}px serif`;
    g.fillText(str, size / 2, size / 2 + size * 0.03);
    tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    this._disposables.push(tex);
    this._spriteCache.set(key, tex);
    return tex;
  }
  _makeSprite(tex, size = 0.5) {
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    this._disposables.push(mat);
    const spr = new THREE.Sprite(mat);
    spr.scale.set(size, size, 1);
    return spr;
  }
  _setSpriteTexture(spr, base, state) {
    const tex = this._itemTexture(base, state);
    if (spr.material.map !== tex) { spr.material.map = tex; spr.material.needsUpdate = true; }
  }

  // ── Cocina (piso, pared, estaciones) ─────────────────────────────────────────
  _buildKitchen() {
    const floorTex = this._checkerTexture('#F3E4D0', '#EAD3B6', 8);
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set((WORLD_X + 6) / 2, (Z_FRONT - Z_BACK + 6) / 2);
    const floor = new THREE.Mesh(
      this._geo(new THREE.PlaneGeometry(WORLD_X + 6, Z_FRONT - Z_BACK + 6)),
      this._mat(new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85 })),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, (Z_BACK + Z_FRONT) / 2);
    floor.receiveShadow = true;
    this.scene.add(floor);

    const wallTex = this._gradientTexture('#F6D7E2', '#FBE9EF');
    const wall = new THREE.Mesh(
      this._geo(new THREE.PlaneGeometry(WORLD_X + 6, 5)),
      this._mat(new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 })),
    );
    wall.position.set(0, 2.5, Z_BACK - 0.9);
    wall.receiveShadow = true;
    this.scene.add(wall);
    const wallBase = new THREE.Mesh(
      this._geo(new RoundedBoxGeometry(WORLD_X + 6, 0.3, 0.3, 2, 0.05)),
      this._mat(new THREE.MeshStandardMaterial({ color: 0xD8B48C, roughness: 0.7 })),
    );
    wallBase.position.set(0, 0.15, Z_BACK - 0.75);
    this.scene.add(wallBase);

    this._buildKitchenStations();

    // Un par de lamparitas colgantes, solo por ambiente
    const lampM = this._mat(new THREE.MeshStandardMaterial({ color: 0xfff3d6, emissive: 0xffdf9e, emissiveIntensity: 0.9, roughness: 0.4 }));
    const cordM = this._mat(new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.6 }));
    for (const x of [-4.6, 4.6]) {
      const lamp = new THREE.Mesh(this._geo(new THREE.SphereGeometry(0.22, 16, 12)), lampM);
      lamp.position.set(x, 3.1, Z_BACK + 1.7);
      this.scene.add(lamp);
      const cord = new THREE.Mesh(this._geo(new THREE.CylinderGeometry(0.015, 0.015, 0.9, 6)), cordM);
      cord.position.set(x, 3.6, Z_BACK + 1.7);
      this.scene.add(cord);
    }
  }

  _buildKitchenStations() {
    const counterBody = this._mat(new THREE.MeshStandardMaterial({ color: 0x9FB7C9, roughness: 0.55, envMapIntensity: 0.4 }));
    const basketBody  = this._mat(new THREE.MeshStandardMaterial({ color: 0xB07A43, roughness: 0.8 }));
    const basketBand  = this._mat(new THREE.MeshStandardMaterial({ color: 0xC8915A, roughness: 0.8 }));
    const counterGeo  = this._geo(new RoundedBoxGeometry(1.5, 0.9, 1.05, 3, 0.09));
    const topGeo       = this._geo(new RoundedBoxGeometry(1.5, 0.14, 1.05, 3, 0.05));
    const basketGeo    = this._geo(new RoundedBoxGeometry(0.82, 0.56, 0.72, 2, 0.08));
    const basketBandGeo = this._geo(new RoundedBoxGeometry(0.86, 0.12, 0.76, 2, 0.05));
    const glowGeoBasket  = this._geo(new THREE.CircleGeometry(0.6, 24));
    const glowGeoCounter = this._geo(new THREE.CircleGeometry(0.95, 24));

    for (const s of this.stations) {
      const grp = new THREE.Group();
      grp.position.set(s.wx, 0, s.wz);
      this.scene.add(grp);
      s.group = grp;

      const glow = new THREE.Mesh(
        s.kind === 'basket' ? glowGeoBasket : glowGeoCounter,
        this._mat(new THREE.MeshBasicMaterial({ color: 0xFFE066, transparent: true, opacity: 0, depthWrite: false })),
      );
      glow.rotation.x = -Math.PI / 2; glow.position.y = 0.015;
      grp.add(glow);
      s.glow = glow;

      if (s.kind === 'basket') {
        const body = new THREE.Mesh(basketGeo, basketBody); body.position.y = 0.28; body.castShadow = body.receiveShadow = true;
        const band = new THREE.Mesh(basketBandGeo, basketBand); band.position.y = 0.5; band.castShadow = true;
        grp.add(body, band);
        const spr = this._makeSprite(this._itemTexture(s.base, 'raw'), 0.5);
        spr.position.set(0, 0.86, 0);
        grp.add(spr);
        continue;
      }

      const body = new THREE.Mesh(counterGeo, counterBody); body.position.y = 0.45; body.castShadow = body.receiveShadow = true;
      const top = new THREE.Mesh(topGeo, this._mat(new THREE.MeshStandardMaterial({ color: TOP_COLORS[s.kind] || 0xC2D4E0, roughness: 0.45, envMapIntensity: 0.4 })));
      top.position.y = 0.97; top.castShadow = top.receiveShadow = true;
      grp.add(body, top);
      this._addStationProp(grp, s.kind);
      const icon = this._makeSprite(this._iconTexture(s.icon), 0.5);
      icon.position.set(0, 1.55, 0);
      grp.add(icon);

      if (PROC_KINDS.includes(s.kind)) {
        const gauge = new THREE.Mesh(
          this._geo(new RoundedBoxGeometry(0.12, 1, 0.12, 2, 0.03)),
          this._mat(new THREE.MeshStandardMaterial({ color: RING_COLORS[s.kind], emissive: RING_COLORS[s.kind], emissiveIntensity: 0.6 })),
        );
        gauge.position.set(0.5, 1.04, 0.42);
        gauge.visible = false;
        grp.add(gauge);
        s.gauge = gauge;
      }
    }
  }

  // Un pequeño detalle 3D por tipo de estación, para que se distinga a simple vista.
  _addStationProp(grp, kind) {
    const m = (g, mat, x, y, z) => { const o = new THREE.Mesh(g, mat); o.position.set(x, y, z); o.castShadow = true; grp.add(o); return o; };
    // Todas las mesas comparten la misma altura de mostrador (top.y = 0.97); los objetos
    // de arriba se mantienen en una banda pareja (pico ≈ 1.18–1.32) para que la fila se
    // vea alineada en vez de ondulada (antes el horno/tacho/licuadora sobresalían mucho más).
    if (kind === 'chop') {
      m(this._geo(new RoundedBoxGeometry(0.6, 0.05, 0.4, 2, 0.03)), this._mat(new THREE.MeshStandardMaterial({ color: 0xE0B87A, roughness: 0.7 })), 0, 1.05, 0.15);
      const blade = m(this._geo(new THREE.BoxGeometry(0.32, 0.02, 0.08)), this._mat(new THREE.MeshStandardMaterial({ color: 0xDDE6EC, metalness: 0.8, roughness: 0.25 })), -0.05, 1.09, 0.1);
      blade.rotation.y = 0.35;
      m(this._geo(new THREE.CapsuleGeometry(0.03, 0.14, 4, 8)), this._mat(new THREE.MeshStandardMaterial({ color: 0x7a4a2a, roughness: 0.6 })), 0.15, 1.09, 0.1).rotation.z = Math.PI / 2;
    } else if (kind === 'boil') {
      m(this._geo(new THREE.CylinderGeometry(0.34, 0.3, 0.28, 24)), this._mat(new THREE.MeshStandardMaterial({ color: 0xC0C8D0, metalness: 0.6, roughness: 0.3 })), 0, 1.11, 0);
      m(this._geo(new THREE.TorusGeometry(0.34, 0.03, 8, 24)), this._mat(new THREE.MeshStandardMaterial({ color: 0x9AA6B0, metalness: 0.7, roughness: 0.25 })), 0, 1.25, 0).rotation.x = Math.PI / 2;
    } else if (kind === 'fry') {
      m(this._geo(new THREE.CylinderGeometry(0.36, 0.34, 0.08, 28)), this._mat(new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.7, roughness: 0.35 })), 0, 1.08, 0);
      m(this._geo(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 8)), this._mat(new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 })), 0.42, 1.11, 0).rotation.z = Math.PI / 2;
    } else if (kind === 'bake') {
      m(this._geo(new RoundedBoxGeometry(0.62, 0.34, 0.4, 3, 0.05)), this._mat(new THREE.MeshStandardMaterial({ color: 0x5a4a42, roughness: 0.6 })), 0, 1.14, 0.3);
      m(this._geo(new THREE.CircleGeometry(0.14, 24)), this._mat(new THREE.MeshStandardMaterial({ color: 0xFF7A2E, emissive: 0xFF5010, emissiveIntensity: 0.8, roughness: 0.4 })), 0, 1.14, 0.51);
    } else if (kind === 'blend') {
      m(this._geo(new THREE.CylinderGeometry(0.22, 0.16, 0.32, 20)), this._mat(new THREE.MeshPhysicalMaterial({ color: 0xBEE8FF, transparent: true, opacity: 0.55, roughness: 0.1 })), 0, 1.14, 0);
      m(this._geo(new THREE.CylinderGeometry(0.24, 0.24, 0.06, 20)), this._mat(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })), 0, 1.33, 0);
    } else if (kind === 'plate') {
      for (let i = 0; i < 3; i++) m(this._geo(new THREE.CylinderGeometry(0.3, 0.32, 0.045, 28)), this._mat(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })), 0, 1.05 + i * 0.05, 0);
    } else if (kind === 'mix') {
      m(this._geo(new THREE.SphereGeometry(0.26, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.55)), this._mat(new THREE.MeshStandardMaterial({ color: 0xFFE9CC, roughness: 0.4 })), 0, 1.03, 0);
    } else if (kind === 'trash') {
      m(this._geo(new THREE.CylinderGeometry(0.28, 0.24, 0.28, 20)), this._mat(new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.6 })), 0, 1.11, 0);
      m(this._geo(new THREE.TorusGeometry(0.29, 0.025, 8, 20)), this._mat(new THREE.MeshStandardMaterial({ color: 0x6b7076, roughness: 0.5 })), 0, 1.25, 0).rotation.x = Math.PI / 2;
    }
  }

  // ── Viole (chef Labubu con gorro y delantal) ─────────────────────────────────
  _buildChef() {
    const fur = this._mat(new THREE.MeshPhysicalMaterial({
      color: 0x6a2fd0, roughness: 0.8, sheen: 0.7, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xb890ff), envMapIntensity: 0.35,
    }));
    const furLight = this._mat(new THREE.MeshPhysicalMaterial({
      color: 0x9a6ae6, roughness: 0.78, sheen: 0.6, sheenColor: new THREE.Color(0xd8c0ff), envMapIntensity: 0.35,
    }));
    const furDark = this._mat(new THREE.MeshStandardMaterial({ color: 0x3e1a82, roughness: 0.85 }));
    const skin = this._mat(new THREE.MeshPhysicalMaterial({
      color: 0xf3cfb0, roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color(0xffe8e0), envMapIntensity: 0.4,
    }));
    const hatM = this._mat(new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.55, sheen: 0.5, sheenColor: new THREE.Color(0xffffff), envMapIntensity: 0.4 }));
    const apronM = this._mat(new THREE.MeshPhysicalMaterial({ color: 0xffe3ee, roughness: 0.7, sheen: 0.5, sheenColor: new THREE.Color(0xffffff), envMapIntensity: 0.3 }));
    const bowM = this._mat(new THREE.MeshStandardMaterial({ color: 0xff6fa8, roughness: 0.5 }));
    const eyeW = this._mat(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }));
    const iris = this._mat(new THREE.MeshStandardMaterial({ color: 0x6b54c8, roughness: 0.2 }));
    const eyeB = this._mat(new THREE.MeshStandardMaterial({ color: 0x1e1230, roughness: 0.15 }));
    const shine = this._mat(new THREE.MeshBasicMaterial({ color: 0xffffff }));

    const P = this.chefParts = { legs: [], arms: [], ears: [], eyes: [] };
    const root = this.chef = new THREE.Group();
    const rig = this.chefRig = new THREE.Group();
    root.add(rig);
    this.scene.add(root);

    const mesh = (g, m, x = 0, y = 0, z = 0, parent = rig, shadow = true) => {
      const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = shadow; parent.add(o); return o;
    };

    // Piernas y pies
    const legG = this._geo(new THREE.CapsuleGeometry(0.09, 0.16, 6, 14));
    const footG = this._geo(new THREE.SphereGeometry(0.105, 16, 12));
    for (const s of [-1, 1]) {
      const hip = new THREE.Group(); hip.position.set(0.14 * s, 0.42, 0); rig.add(hip);
      mesh(legG, fur, 0, -0.14, 0, hip);
      const f = mesh(footG, furLight, 0, -0.3, -0.045, hip); f.scale.set(1, 0.7, 1.45);
      P.legs.push(hip);
    }
    // Vestidito (torno)
    const bodyProf = [[0.001, 0.34], [0.34, 0.34], [0.38, 0.4], [0.32, 0.5], [0.24, 0.64], [0.19, 0.78], [0.001, 0.86]]
      .map(([x, y]) => new THREE.Vector2(x, y));
    mesh(this._geo(new THREE.LatheGeometry(bodyProf, 36)), fur);
    // Delantal de cocinera + moñito
    const apron = mesh(this._geo(new RoundedBoxGeometry(0.4, 0.42, 0.05, 2, 0.08)), apronM, 0, 0.5, -0.27, rig, false);
    apron.rotation.x = -0.15;
    mesh(this._geo(new THREE.TorusGeometry(0.05, 0.018, 8, 16)), bowM, 0, 0.74, -0.29, rig, false);
    // Brazos con puños
    const armG = this._geo(new THREE.CapsuleGeometry(0.08, 0.22, 6, 14));
    const fistG = this._geo(new THREE.SphereGeometry(0.1, 18, 14));
    for (const s of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(0.22 * s, 0.82, 0); sh.rotation.z = 0.3 * s; rig.add(sh);
      mesh(armG, fur, 0, -0.16, 0, sh);
      mesh(fistG, furLight, 0, -0.32, 0, sh);
      P.arms.push(sh);
    }
    // Cabeza: capucha + orejas de gato + gorro de cocinera
    const head = new THREE.Group(); head.position.y = 1.24; rig.add(head);
    const hood = mesh(this._geo(new THREE.SphereGeometry(0.46, 32, 24)), fur, 0, 0, 0, head); hood.scale.set(1.02, 0.94, 0.95);
    const earProf = [[0.001, 0.42], [0.035, 0.39], [0.08, 0.3], [0.13, 0.16], [0.165, 0.04], [0.17, 0]].map(([x, y]) => new THREE.Vector2(x, y));
    const earG = this._geo(new THREE.LatheGeometry(earProf, 20));
    const innerG = this._geo(new THREE.LatheGeometry(earProf.map(v => new THREE.Vector2(v.x * 0.6, v.y * 0.8)), 12));
    for (const s of [-1, 1]) {
      const ear = new THREE.Group(); ear.position.set(0.25 * s, 0.23, 0.02); ear.rotation.z = -0.4 * s; head.add(ear);
      const e = mesh(earG, fur, 0, 0, 0, ear); e.scale.z = 0.7;
      mesh(innerG, furDark, 0, 0.04, -0.05, ear, false).scale.z = 0.35;
      P.ears.push(ear);
    }
    mesh(this._geo(new THREE.CylinderGeometry(0.34, 0.36, 0.14, 24)), hatM, 0, 0.42, 0.02, head);
    const puff = mesh(this._geo(new THREE.SphereGeometry(0.3, 24, 16)), hatM, 0, 0.62, 0, head); puff.scale.set(1, 0.8, 1);
    // Carita
    const face = new THREE.Group(); face.position.z = -0.31; head.add(face);
    const faceM = mesh(this._geo(new THREE.SphereGeometry(0.31, 32, 22)), skin, 0, -0.03, 0, face, false); faceM.scale.set(1.05, 0.9, 0.5);
    const rim = mesh(this._geo(new THREE.TorusGeometry(0.315, 0.055, 10, 32)), fur, 0, -0.03, -0.035, face); rim.scale.set(1.05, 0.9, 1);
    const eyeG = this._geo(new THREE.SphereGeometry(0.09, 20, 14));
    const irisG = this._geo(new THREE.SphereGeometry(0.068, 18, 12));
    const pupG = this._geo(new THREE.SphereGeometry(0.038, 12, 10));
    const shG = this._geo(new THREE.SphereGeometry(0.019, 8, 8));
    for (const s of [-1, 1]) {
      const eye = new THREE.Group(); eye.position.set(0.12 * s, 0.04, -0.13); face.add(eye); P.eyes.push(eye);
      const w = new THREE.Mesh(eyeG, eyeW); w.scale.set(0.95, 1.15, 0.5);
      const ir = new THREE.Mesh(irisG, iris); ir.position.set(0, -0.008, -0.023); ir.scale.set(1, 1.18, 0.45);
      const p = new THREE.Mesh(pupG, eyeB); p.position.set(0, -0.006, -0.048); p.scale.set(1, 1.15, 0.4);
      const h = new THREE.Mesh(shG, shine); h.position.set(0.025 * s, 0.036, -0.058);
      eye.add(w, ir, p, h);
    }
    const blush = this._mat(new THREE.MeshBasicMaterial({ color: 0xff8fa8, transparent: true, opacity: 0.4, depthWrite: false }));
    const blG = this._geo(new THREE.CircleGeometry(0.043, 16));
    for (const s of [-1, 1]) {
      const b = mesh(blG, blush, 0.2 * s, -0.07, -0.115, face, false);
      b.rotation.set(0, Math.PI - 0.55 * s, 0); b.scale.y = 0.6;
    }
    const mouth = mesh(this._geo(new THREE.TorusGeometry(0.045, 0.013, 8, 20, Math.PI)), eyeB, 0, -0.1, -0.148, face, false);
    mouth.rotation.set(0.25, Math.PI, Math.PI);
  }

  // ── Sprites dinámicos + partículas ───────────────────────────────────────────
  _initFx() {
    this._carrySprite = this._makeSprite(this._itemTexture('tomate', 'raw'), 0.5); this._carrySprite.visible = false; this.scene.add(this._carrySprite);
    this._mixSprite   = this._makeSprite(this._itemTexture('tomate', 'raw'), 0.42); this._mixSprite.visible = false; this.scene.add(this._mixSprite);
    this._procSprite  = this._makeSprite(this._itemTexture('tomate', 'raw'), 0.5); this._procSprite.visible = false; this.scene.add(this._procSprite);
    this._plateSprites = [];
    for (let i = 0; i < 6; i++) {
      const s = this._makeSprite(this._itemTexture('tomate', 'raw'), 0.34);
      s.visible = false; this.scene.add(s); this._plateSprites.push(s);
    }

    this.pMax = 140;
    this.pMesh = new THREE.InstancedMesh(this._geo(new THREE.SphereGeometry(1, 8, 6)), this._mat(new THREE.MeshBasicMaterial({ color: 0xffffff })), this.pMax);
    this.pMesh.frustumCulled = false;
    this.parts = [];
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < this.pMax; i++) {
      this.parts.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 0.1, g: 9 });
      this.pMesh.setMatrixAt(i, zero);
      this.pMesh.setColorAt(i, new THREE.Color(1, 1, 1));
    }
    this.pNext = 0;
    this.scene.add(this.pMesh);
    this._m4 = new THREE.Matrix4(); this._c = new THREE.Color();
  }

  _burst(x, y, z, n, col, spd = 3, life = 0.5, size = 0.07, grav = 9) {
    for (let k = 0; k < n; k++) {
      const idx = this.pNext, p = this.parts[idx];
      this.pNext = (idx + 1) % this.pMax;
      const a = Math.random() * Math.PI * 2, u = rand(0.1, 1);
      p.x = x; p.y = y; p.z = z;
      p.vx = Math.cos(a) * spd * rand(0.3, 1);
      p.vy = u * spd * rand(0.5, 1.1);
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

  // ── Entrada: tocar/arrastrar en el piso mueve a Viole; flechas/WASD las maneja game.js ──
  _initInput() {
    let id = null;
    const ndc = new THREE.Vector2();
    const hit = new THREE.Vector3();
    const setTargetFromEvent = e => {
      const r = this.el.getBoundingClientRect();
      ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      this._raycaster.setFromCamera(ndc, this.camera);
      if (this._raycaster.ray.intersectPlane(this._groundPlane, hit)) {
        this._target = { x: clamp(hit.x, this._bounds.minX, this._bounds.maxX), z: clamp(hit.z, this._bounds.minZ, this._bounds.maxZ) };
        this.dir.x = 0; this.dir.z = 0;
      }
    };
    this._pd = e => { e.preventDefault(); id = e.pointerId; setTargetFromEvent(e); };
    this._pm = e => { if (e.pointerId !== id) return; setTargetFromEvent(e); };
    this._pu = e => { if (e.pointerId === id) id = null; };
    this.el.addEventListener('pointerdown', this._pd);
    window.addEventListener('pointermove', this._pm);
    window.addEventListener('pointerup', this._pu);
    window.addEventListener('pointercancel', this._pu);
  }
  setDir(x, z) { this.dir.x = x; this.dir.z = z; if (x || z) this._target = null; }

  // ── Estado del juego (recetas/estaciones idénticas a Cocina.js) ─────────────
  reset() {
    this._t = 0; this.score = 0;
    this.p = { x: 0, z: wz(0.55) };
    this.moving = false;
    this.dir = { x: 0, z: 0 };
    this._target = null;
    this.carry = null;
    this.plate = [];
    this.proc = null;
    this.served = 0; this.servedName = '';
    this.reject = 0;
    this.lastZone = null; this.nearId = null;
    this.mixHeld = null;
    this._hud = {};
    this.newOrder();
    if (this.chef) this.chef.position.set(this.p.x, 0, this.p.z);
    this._updateHud(true);
  }
  newOrder() { this.order = RECIPES[(Math.random() * RECIPES.length) | 0]; this.plate = []; }

  _transformable(carry, kind) {
    if (!carry) return false;
    if (kind === 'chop')  return carry.state === 'raw'    && CHOPPABLE.includes(carry.base);
    if (kind === 'boil')  return carry.state === 'raw'    && BOILABLE.includes(carry.base);
    if (kind === 'fry') {
      if (carry.state === 'raw'    && FRYABLE_FROM_RAW.includes(carry.base))    return true;
      if (carry.state === 'boiled' && FRYABLE_FROM_BOILED.includes(carry.base)) return true;
      return false;
    }
    if (kind === 'bake')  return carry.state === 'raw' && BAKEABLE.includes(carry.base);
    if (kind === 'blend') return carry.state === 'raw' && BLENDABLE.includes(carry.base);
    return false;
  }
  _needRemaining(base, state) {
    const req  = this.order.need.filter(n => n[0] === base && n[1] === state).length;
    const have = this.plate.filter(p => p.base === base && p.state === state).length;
    return req - have;
  }
  _orderComplete() { return this.order.need.every(([b, s]) => this.plate.some(p => p.base === b && p.state === s)); }
  _deposit() {
    if (!this.carry) return;
    if (this._needRemaining(this.carry.base, this.carry.state) > 0) {
      this.plate.push({ ...this.carry }); this.carry = null;
      const plateSt = this._stationById.plate;
      this._burst(plateSt.wx, 1.3, plateSt.wz, 8, [0.49, 0.85, 0.34], 2.6, 0.4, 0.05);
      if (this._orderComplete()) this._serve();
    } else { this.reject = 0.4; }
  }
  _serve() {
    this.score++;
    this.servedName = this.order.name; this.served = 1.8;
    addFood(this.order.name, this.order.emoji);
    const plateSt = this._stationById.plate;
    this._burst(plateSt.wx, 1.6, plateSt.wz, 30, [1, 0.82, 0.23], 3.4, 0.6, 0.07);
    if (this.score > this.best) { this.best = this.score; try { localStorage.setItem('cocina3d_best', this.best); } catch (e) { /* sin storage */ } }
    this.newOrder();
  }
  _combineIngredients(a, b) {
    const COMBOS = [{ a: ['harina', 'raw'], b: ['huevo', 'raw'], result: ['mezcla', 'raw'] }];
    for (const c of COMBOS) {
      if ((a.base === c.a[0] && a.state === c.a[1] && b.base === c.b[0] && b.state === c.b[1]) ||
          (a.base === c.b[0] && a.state === c.b[1] && b.base === c.a[0] && b.state === c.a[1]))
        return { base: c.result[0], state: c.result[1] };
    }
    return null;
  }

  // Las mesas y canastas son sólidas: si el movimiento la mete adentro de una, la empuja
  // de vuelta al borde (círculo vs. círculo). El radio de colisión es menor al de alcance,
  // así se puede usar la estación de cerca sin poder pisarla/atravesarla.
  _resolveCollisions() {
    for (const s of this.stations) {
      const r = s.kind === 'basket' ? BASKET_COLLIDE : STATION_COLLIDE;
      const dx = this.p.x - s.wx, dz = this.p.z - s.wz;
      const d = Math.hypot(dx, dz);
      if (d < r) {
        if (d < 1e-4) { this.p.x = s.wx + r; this.p.z = s.wz; }
        else { const k = r / d; this.p.x = s.wx + dx * k; this.p.z = s.wz + dz * k; }
      }
    }
    this.p.x = clamp(this.p.x, this._bounds.minX, this._bounds.maxX);
    this.p.z = clamp(this.p.z, this._bounds.minZ, this._bounds.maxZ);
  }

  // ── Update ───────────────────────────────────────────────────────────────
  update(dt) {
    dt = clamp(dt || 0, 0, 0.05);
    this._t += dt;
    this._adaptQuality(dt);
    if (this.served > 0) this.served -= dt;
    if (this.reject > 0) this.reject -= dt;

    let mx = this.dir.x, mz = this.dir.z;
    if (mx || mz) { const l = Math.hypot(mx, mz) || 1; mx /= l; mz /= l; }
    else if (this._target) {
      const dx = this._target.x - this.p.x, dz = this._target.z - this.p.z, d = Math.hypot(dx, dz);
      if (d > 0.08) { mx = dx / d; mz = dz / d; } else this._target = null;
    }
    const speed = 4.6;
    this.p.x = clamp(this.p.x + mx * speed * dt, this._bounds.minX, this._bounds.maxX);
    this.p.z = clamp(this.p.z + mz * speed * dt, this._bounds.minZ, this._bounds.maxZ);
    this.moving = !!(mx || mz);
    this._resolveCollisions();

    let near = null, nd = Infinity;
    for (const s of this.stations) {
      const dx = s.wx - this.p.x, dz = s.wz - this.p.z, d = Math.hypot(dx, dz);
      const reach = s.kind === 'basket' ? BASKET_REACH : STATION_REACH;
      if (d < reach && d < nd) { nd = d; near = s; }
    }
    const entered = near && near.id !== this.lastZone;
    this.lastZone = near ? near.id : null;
    this.nearId   = near ? near.id : null;

    if (near) {
      if (near.kind === 'basket' && !this.carry && !this.moving) {
        this.carry = { base: near.base, state: 'raw' };
      } else if (near.kind === 'trash' && entered && this.carry) {
        this.carry = null;
      } else if (near.kind === 'plate' && entered && this.carry) {
        this._deposit();
      } else if (near.kind === 'mix') {
        this.proc = null;
        if (entered) {
          if (this.carry && !this.mixHeld) {
            this.mixHeld = { ...this.carry }; this.carry = null;
          } else if (this.carry && this.mixHeld) {
            const result = this._combineIngredients(this.mixHeld, this.carry);
            if (result) { this.carry = result; this.mixHeld = null; this._burst(near.wx, 1.5, near.wz, 16, [1, 0.72, 0.82], 3, 0.5, 0.05); }
          } else if (!this.carry && this.mixHeld) {
            this.carry = { ...this.mixHeld }; this.mixHeld = null;
          }
        }
      } else if (PROC_KINDS.includes(near.kind)) {
        if (this._transformable(this.carry, near.kind)) {
          if (!this.proc || this.proc.id !== near.id) this.proc = { id: near.id, t: 0, fx: 0 };
          this.proc.t += dt; this.proc.fx += dt;
          if (this.proc.fx > 0.26) { this.proc.fx = 0; this._burst(near.wx, 1.3, near.wz, 4, BURST_COLORS[near.kind] || [1, 1, 1], 1.3, 0.35, 0.045); }
          if (this.proc.t >= PROC_DUR) {
            this.carry.state = STATE_MAP[near.kind];
            this.proc = null;
            this._burst(near.wx, 1.3, near.wz, 10, BURST_COLORS[near.kind] || [1, 1, 1], 2.3, 0.4, 0.06);
          }
        } else this.proc = null;
      } else this.proc = null;
    } else this.proc = null;

    this._updateChef(dt, mx, mz);
    this._updateStationFx(dt);
    this._syncItems();
    this._updateParticles(dt);
    this._updateHud();
  }

  _updateChef(dt, mx, mz) {
    this.chef.position.set(this.p.x, 0, this.p.z);
    if (mx || mz) {
      const yaw = Math.atan2(-mx, -mz);
      this.chefRig.rotation.y = lerpAngle(this.chefRig.rotation.y, yaw, Math.min(1, dt * 10));
    }
    const P = this.chefParts;
    const ph = this._t * 11;
    const bob = this.moving ? Math.abs(Math.sin(ph)) * 0.09 : Math.sin(this._t * 2.6) * 0.02;
    this.chefRig.position.y = bob;
    for (let i = 0; i < 2; i++) {
      const flip = i ? 0 : Math.PI;
      const leg  = this.moving ? Math.sin(ph + flip) * 0.6 : 0;
      const armX = this.moving ? -Math.sin(ph + flip) * 0.55 : Math.sin(this._t * 2.2 + i) * 0.05;
      const k = Math.min(1, dt * 14);
      P.legs[i].rotation.x += (leg - P.legs[i].rotation.x) * k;
      P.arms[i].rotation.x += (armX - P.arms[i].rotation.x) * k;
    }
    const flap = Math.sin(ph * 0.5) * 0.08;
    for (const e of P.ears) e.rotation.x = 0.05 + flap;
    const blink = (this._t % 3.2) < 0.12 ? 0.08 : 1;
    for (const e of P.eyes) e.scale.y = blink;
  }

  _updateStationFx(dt) {
    for (const s of this.stations) {
      const target = s.id === this.nearId ? 0.32 + 0.1 * Math.sin(this._t * 6) : 0;
      s.glow.material.opacity += (target - s.glow.material.opacity) * Math.min(1, dt * 10);
      if (s.gauge) {
        const active = !!(this.proc && this.proc.id === s.id);
        s.gauge.visible = active;
        if (active) {
          const frac = clamp(this.proc.t / PROC_DUR, 0.02, 1);
          s.gauge.scale.y = frac;
          s.gauge.position.y = 0.54 + 0.5 * frac;
        }
      }
    }
  }

  _syncItems() {
    if (this.carry) {
      this._carrySprite.visible = true;
      this._setSpriteTexture(this._carrySprite, this.carry.base, this.carry.state);
      this._carrySprite.position.set(this.p.x, 2.2 + Math.sin(this._t * 3) * 0.05, this.p.z);
    } else this._carrySprite.visible = false;

    const mixSt = this._stationById.mix;
    if (this.mixHeld) {
      this._mixSprite.visible = true;
      this._setSpriteTexture(this._mixSprite, this.mixHeld.base, this.mixHeld.state);
      this._mixSprite.position.set(mixSt.wx, 1.5, mixSt.wz);
    } else this._mixSprite.visible = false;

    if (this.proc && this.carry) {
      const st = this._stationById[this.proc.id];
      this._procSprite.visible = true;
      this._setSpriteTexture(this._procSprite, this.carry.base, this.carry.state);
      const pulse = 0.85 + 0.15 * Math.sin(this._t * 9);
      this._procSprite.position.set(st.wx, 1.62, st.wz);
      this._procSprite.scale.set(0.46 * pulse, 0.46 * pulse, 1);
    } else this._procSprite.visible = false;

    const plateSt = this._stationById.plate;
    const items = this.plate, span = 0.42;
    const x0 = plateSt.wx - (items.length - 1) * span / 2;
    for (let i = 0; i < this._plateSprites.length; i++) {
      const spr = this._plateSprites[i];
      if (i < items.length) {
        spr.visible = true;
        this._setSpriteTexture(spr, items[i].base, items[i].state);
        spr.position.set(x0 + i * span, 1.5, plateSt.wz);
      } else spr.visible = false;
    }
  }

  // ── HUD (DOM en #cocinaviole3d-ui) ──────────────────────────────────────────
  _needChipHTML([base, state]) {
    const ing = ING[base];
    let glyph = ing.raw;
    if (state === 'boiled'  && ing.boiled)  glyph = ing.boiled;
    if (state === 'fried'   && ing.fried)   glyph = ing.fried;
    if (state === 'baked'   && ing.baked)   glyph = ing.baked;
    if (state === 'blended' && ing.blended) glyph = ing.blended;
    const done = this.plate.some(p => p.base === base && p.state === state);
    const label = STATE_LABEL[state];
    return `<span class="cv3-chip${done ? ' done' : ''}"><span class="cv3-chip-icon">${glyph}</span>${label ? `<span class="cv3-chip-state">${label}</span>` : ''}</span>`;
  }
  // Pista permanente de qué hacer para el próximo paso de la receta (se recalcula según
  // lo que lleva en la mano, lo que ya está en el plato y lo que quedó en el bowl de mezclar).
  _nextStepHint() {
    const needsMezcla = this.order.need.some(([b, s]) => b === 'mezcla' && this._needRemaining(b, s) > 0);
    if (this.carry) {
      const c = this.carry;
      if (this._needRemaining(c.base, c.state) > 0) return `Llevá ${ING[c.base].name} a ${KIND_LABEL.plate}`;
      if (needsMezcla && (c.base === 'harina' || c.base === 'huevo') && c.state === 'raw') return `Llevá ${ING[c.base].name} a ${KIND_LABEL.mix}`;
      for (const [b, s] of this.order.need) {
        if (b !== c.base || this._needRemaining(b, s) <= 0) continue;
        const kind = KIND_BY_STATE[s];
        if (kind && this._transformable(c, kind)) return `Llevá ${ING[c.base].name} a ${KIND_LABEL[kind]}`;
      }
      return 'Eso no hace falta para este pedido: tiralo en 🗑️ Tirar';
    }
    if (this.mixHeld && needsMezcla) {
      const other = this.mixHeld.base === 'harina' ? 'huevo' : 'harina';
      return `Buscá 🧺 ${ING[other].name} y llevalo a ${KIND_LABEL.mix}`;
    }
    for (const [b, s] of this.order.need) {
      if (this._needRemaining(b, s) <= 0) continue;
      if (b === 'mezcla') return `Buscá 🧺 Harina y 🧺 Huevo, y llevalos a ${KIND_LABEL.mix}`;
      if (s === 'raw') return `Andá a buscar 🧺 ${ING[b].name}`;
      const kind = KIND_BY_STATE[s];
      return `Buscá 🧺 ${ING[b].name} y llevalo a ${KIND_LABEL[kind]}`;
    }
    return `¡Llevalo a ${KIND_LABEL.plate}!`;
  }
  _updateHud(force) {
    const H = this._hud || (this._hud = {});
    if (force || H.score !== this.score) { H.score = this.score; const e = $('cv3-score'); if (e) e.textContent = '🍽️ ' + this.score; }
    if (force || H.best !== this.best)   { H.best = this.best;   const e = $('cv3-best');  if (e) e.textContent = 'Mejor: ' + this.best; }
    const hint = this._nextStepHint();
    if (force || H.hint !== hint) { H.hint = hint; const e = $('cv3-hint'); if (e) e.textContent = '👉 ' + hint; }
    if (force || H.order !== this.order) {
      H.order = this.order;
      const e = $('cv3-order');
      if (e) {
        e.innerHTML = `<span class="cv3-order-emoji">${this.order.emoji}</span>
          <div class="cv3-order-info"><div class="cv3-order-label">PEDIDO</div><div class="cv3-order-name">${this.order.name}</div></div>
          <div class="cv3-order-need">${this.order.need.map(n => this._needChipHTML(n)).join('')}</div>`;
      }
    } else {
      const e = $('cv3-order');
      if (e) {
        const chips = e.querySelectorAll('.cv3-chip');
        this.order.need.forEach(([b, s], i) => {
          if (chips[i]) chips[i].classList.toggle('done', this.plate.some(p => p.base === b && p.state === s));
        });
      }
    }
    const toast = $('cv3-toast');
    if (toast) {
      if (this.served > 0) { toast.textContent = `¡Servido! 🎉 +1 · ${this.servedName}`; toast.classList.add('show'); }
      else toast.classList.remove('show');
    }
    const rej = $('cv3-reject');
    if (rej) rej.classList.toggle('show', this.reject > 0);
  }

  // Compila los shaders antes de mostrar el juego (evita el "tirón" del primer frame).
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
  showReady() { const e = $('cocinaviole3d-msg'); if (e) e.classList.add('hidden'); }
  showError(err) {
    const e = $('cocinaviole3d-msg');
    if (!e) return;
    e.classList.remove('hidden');
    e.innerHTML = `<div class="cv3-msg-title">Ups 😿</div><div class="cv3-msg-sub">El 3D se trabó</div>
      <div class="cv3-msg-help"><small>${String((err && err.message) || err).replace(/</g, '&lt;')}</small></div>`;
  }

  // ── Render / calidad ─────────────────────────────────────────────────────
  // Ajusta el frustum ortográfico para que la cocina entera entre siempre en pantalla,
  // sin importar el aspecto (celular parado, acostado o pantalla ancha).
  _fitCamera() {
    const cam = this.camera;
    cam.updateMatrixWorld(true);
    const xs = [-WORLD_X / 2 - 1.6, WORLD_X / 2 + 1.6];
    const zs = [Z_BACK - 2.2, Z_FRONT + 2.4];
    const ys = [0, 3.4];
    let maxX = 0.1, maxY = 0.1;
    const v = new THREE.Vector3();
    for (const x of xs) for (const y of ys) for (const z of zs) {
      v.set(x, y, z);
      cam.worldToLocal(v);
      maxX = Math.max(maxX, Math.abs(v.x));
      maxY = Math.max(maxY, Math.abs(v.y));
    }
    const w = window.innerWidth, h = window.innerHeight, aspect = w / h;
    let halfW = maxX, halfH = maxY;
    if (halfW / halfH > aspect) halfH = halfW / aspect; else halfW = halfH * aspect;
    cam.left = -halfW; cam.right = halfW; cam.top = halfH; cam.bottom = -halfH;
    cam.near = 0.1; cam.far = 100;
    cam.updateProjectionMatrix();
  }
  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w / 2, h / 2);
    this._fitCamera();
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
    window.removeEventListener('pointercancel', this._pu);
    this.el.removeEventListener('pointerdown', this._pd);
    for (const d of this._disposables) { try { d.dispose(); } catch (e) {} }
    try { this.envTex.dispose(); } catch (e) {}
    try { this.composer.dispose && this.composer.dispose(); } catch (e) {}
    try { this.bloom.dispose(); } catch (e) {}
    try { this.renderer.dispose(); this.renderer.forceContextLoss(); } catch (e) {}
    this.el.remove();
    const m = $('cocinaviole3d-msg'); if (m) m.classList.add('hidden');
  }
}
