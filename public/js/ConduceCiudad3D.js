// ── Conduce por la Ciudad (ConduceCiudad3D.js) — manejo arcade en 3D real (Three.js) ────
// Elegís un auto y manejás por una ciudad en cuadrícula (casas, puestos de comida,
// heladerías y algún edificio alto) haciendo entregas: ir al puesto marcado, recoger el
// pedido y llevarlo a la casa marcada, una y otra vez. Sin corazones ni choques que
// "maten" — chocar contra algo sólo te frena, así la nena/el que elijas puede manejar
// tranquila.
//
// Render: WebGLRenderer propio sobre un <canvas> que se superpone al canvas 2D del
// orquestador (game.js sigue llamando update(dt)/render()). Cámara en tercera persona
// detrás del auto, luces con sombra, mapa de entorno para los materiales.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { addCoins } from './Wallet.js';

const rand  = (a, b) => a + Math.random() * (b - a);
const pick  = arr => arr[(Math.random() * arr.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const $ = id => (typeof document !== 'undefined' ? document.getElementById(id) : null);
function wrapDeg(d) { d = d % 360; if (d > 180) d -= 360; if (d < -180) d += 360; return d; }

// ── Ciudad: cuadrícula de N×N manzanas separadas por calles ─────────────────────
const N        = 5;                 // manzanas por lado
const BLOCK    = 16;                 // tamaño de una manzana (m)
const ROAD_W   = 7.5;                // ancho de calle
const CELL     = BLOCK + ROAD_W;
const CITY_HALF = (N * CELL) / 2;
const blockPos = i => (i - (N - 1) / 2) * CELL;

// Layout fijo (fila = z, columna = x), 25 manzanas para una grilla de 5×5
const BLOCK_TYPES = [
  'house', 'house', 'tower', 'house', 'park',
  'food',  'house', 'house', 'house', 'helado',
  'house', 'tower', 'park',  'tower', 'house',
  'helado','house', 'house', 'house', 'food',
  'house', 'food',  'house', 'tower', 'house',
];

const HOUSE_COLORS = [0xffb3c6, 0xa8d8ff, 0xffe39a, 0xb8f0c0, 0xd8b8ff, 0xffc89a, 0x9ad8d0, 0xffa8a8];
const CARS = [
  { id: 'rosa',    name: 'Auto Rosa',     emoji: '🚗', body: 0xff6fa8, roof: 0xffe3ee, kind: 'sedan' },
  { id: 'combi',   name: 'Combi Celeste', emoji: '🚐', body: 0x4fb0e0, roof: 0xffffff, kind: 'van' },
  { id: 'pickup',  name: 'Camioneta',     emoji: '🚙', body: 0xffcc3a, roof: 0x3a3a46, kind: 'truck' },
];
const FOOD_ITEMS   = [{ emoji: '🌭', name: 'Pancho' }, { emoji: '🍔', name: 'Hamburguesa' }, { emoji: '🌮', name: 'Taco' }, { emoji: '🍕', name: 'Pizza' }];
const HELADO_ITEMS = [{ emoji: '🍦', name: 'Helado' }, { emoji: '🍨', name: 'Copa de helado' }];

// Física arcade del auto
const MAX_SPEED = 15, REV_SPEED = 7, ACCEL = 13, BRAKE = 20, FRICTION = 9, STEER_RATE = 2.3;
const CAR_RADIUS = 1.15;

export class ConduceCiudad3D {
  constructor(canvas) {
    this.hostCanvas = canvas;
    this.best = 0;
    try { this.best = +(localStorage.getItem('conducir3d_best') || 0) || 0; } catch (e) { /* sin storage */ }
    this._disposables = [];
    this._spriteCache = new Map();
    this._t = 0;
    this.steerDir = 0; this.gas = false; this.brake = false;

    this._initRenderer();
    this._initScene();
    this._buildCity();
    this._buildCars();
    this._initFx();
    this._initInput();
    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize);
    this._resize();

    let carId = null;
    try { carId = localStorage.getItem('conducir3d_car'); } catch (e) { /* sin storage */ }
    this.setCar(CARS.some(c => c.id === carId) ? carId : CARS[0].id);
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
    c.id = 'conducir3d-canvas';
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
    this.quality = 2;
    this._fpsAcc = 0; this._fpsN = 0;
  }

  _initScene() {
    const scene = this.scene = new THREE.Scene();
    const skyColor = 0xbfe6ff;
    scene.background = new THREE.Color(skyColor);
    scene.fog = new THREE.Fog(skyColor, 42, 150);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment(this.renderer);
    this.envTex = pmrem.fromScene(room, 0.04).texture;
    room.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    pmrem.dispose();
    scene.environment = this.envTex;

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x8fae7a, 0.65);
    scene.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight(0xfff6e0, 1.5);
    sun.castShadow = true;
    const sz = this.touch ? 1024 : 2048;
    sun.shadow.mapSize.set(sz, sz);
    const sc = sun.shadow.camera;
    sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 70;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; sun.shadow.radius = 4;
    scene.add(sun, sun.target);

    this.camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.1, 400);

    const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.18, 0.5, 1.05);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  // ── Texturas ─────────────────────────────────────────────────────────────
  _speckleTexture(colA, colB, n) {
    const size = 256, cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const g = cv.getContext('2d');
    g.fillStyle = colA; g.fillRect(0, 0, size, size);
    g.fillStyle = colB;
    for (let i = 0; i < n; i++) { const s = rand(2, 6); g.fillRect(Math.random() * size, Math.random() * size, s, s); }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    this._disposables.push(tex);
    return tex;
  }
  _windowTexture(baseColor, winColor) {
    const key = 'win:' + baseColor + '|' + winColor;
    let tex = this._spriteCache.get(key);
    if (tex) return tex;
    const size = 128, cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const g = cv.getContext('2d');
    g.fillStyle = baseColor; g.fillRect(0, 0, size, size);
    g.fillStyle = winColor;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 3; x++) g.fillRect(14 + x * 38, 10 + y * 30, 20, 18);
    tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    this._disposables.push(tex);
    this._spriteCache.set(key, tex);
    return tex;
  }
  _iconTexture(str) {
    const key = 'icon:' + str;
    let tex = this._spriteCache.get(key);
    if (tex) return tex;
    const size = 128, cv = document.createElement('canvas');
    cv.width = cv.height = size;
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
  _makeSprite(tex, size = 1) {
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    this._disposables.push(mat);
    const spr = new THREE.Sprite(mat);
    spr.scale.set(size, size, 1);
    return spr;
  }

  // ── Ciudad ───────────────────────────────────────────────────────────────
  _buildCity() {
    const span = N * CELL + ROAD_W;
    const roadTex = this._speckleTexture('#8a8f98', '#7d828b', 900);
    roadTex.repeat.set(span / 6, span / 6);
    const road = new THREE.Mesh(
      this._geo(new THREE.PlaneGeometry(span, span)),
      this._mat(new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.95 })),
    );
    road.rotation.x = -Math.PI / 2;
    road.receiveShadow = true;
    this.scene.add(road);

    this.obstacles = [];   // {x,z,r} — colisión sólida (círculo)
    this.houses = [];      // {x,z,color,marker}
    this.stands = [];      // {x,z,kind:'food'|'helado',marker}

    const grassTex = this._speckleTexture('#8fe0a0', '#7fd092', 500);
    const lotGeo = this._geo(new RoundedBoxGeometry(BLOCK, 0.3, BLOCK, 3, 0.3));

    for (let row = 0; row < N; row++) {
      for (let col = 0; col < N; col++) {
        const type = BLOCK_TYPES[row * N + col];
        const cx = blockPos(col), cz = blockPos(row);
        const lotMat = type === 'tower'
          ? this._mat(new THREE.MeshStandardMaterial({ color: 0xb8bcc4, roughness: 0.85 }))
          : this._mat(new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.9 }));
        const lot = new THREE.Mesh(lotGeo, lotMat);
        lot.position.set(cx, 0.15, cz);
        lot.receiveShadow = true;
        this.scene.add(lot);

        if (type === 'house') this._buildHouse(cx, cz);
        else if (type === 'food') this._buildStand(cx, cz, 'food');
        else if (type === 'helado') this._buildStand(cx, cz, 'helado');
        else if (type === 'tower') this._buildTower(cx, cz);
        else if (type === 'park') this._buildPark(cx, cz);
      }
    }
    this._bounds = { min: -CITY_HALF - ROAD_W * 0.4, max: CITY_HALF + ROAD_W * 0.4 };
  }

  _buildHouse(cx, cz) {
    const color = pick(HOUSE_COLORS);
    const x = cx + rand(-2.5, 2.5), z = cz + rand(-2.5, 2.5);
    const yaw = Math.round(rand(0, 3)) * (Math.PI / 2);
    const grp = new THREE.Group();
    grp.position.set(x, 0.3, z);
    grp.rotation.y = yaw;
    const wallM = this._mat(new THREE.MeshStandardMaterial({ color, roughness: 0.75 }));
    const roofM = this._mat(new THREE.MeshStandardMaterial({ color: 0x8a5a42, roughness: 0.7 }));
    const doorM = this._mat(new THREE.MeshStandardMaterial({ color: 0x5a3a28, roughness: 0.6 }));
    const winM  = this._mat(new THREE.MeshStandardMaterial({ color: 0xcdeeff, roughness: 0.3, emissive: 0x6ab0c8, emissiveIntensity: 0.2 }));
    const body = new THREE.Mesh(this._geo(new RoundedBoxGeometry(3.4, 2.2, 3.0, 3, 0.1)), wallM);
    body.position.y = 1.1; body.castShadow = body.receiveShadow = true;
    grp.add(body);
    const roof = new THREE.Mesh(this._geo(new THREE.ConeGeometry(2.7, 1.5, 4)), roofM);
    roof.position.y = 2.95; roof.rotation.y = Math.PI / 4; roof.castShadow = true;
    grp.add(roof);
    const door = new THREE.Mesh(this._geo(new RoundedBoxGeometry(0.7, 1.3, 0.1, 2, 0.05)), doorM);
    door.position.set(0, 0.65, 1.52);
    grp.add(door);
    for (const s of [-1, 1]) {
      const win = new THREE.Mesh(this._geo(new RoundedBoxGeometry(0.6, 0.6, 0.08, 2, 0.05)), winM);
      win.position.set(1.1 * s, 1.4, 1.52);
      grp.add(win);
    }
    this.scene.add(grp);
    this.obstacles.push({ x, z, r: 2.3 });

    // marcador flotante (se prende cuando esta casa es el destino del pedido actual)
    const marker = this._buildMarker(0x4ab8ff);
    marker.position.set(x, 0, z);
    this.scene.add(marker);
    this.houses.push({ x, z, marker });
  }

  _buildStand(cx, cz, kind) {
    const x = cx, z = cz;
    const grp = new THREE.Group();
    grp.position.set(x, 0.3, z);
    const kiosk = kind === 'food' ? 0xffb15e : 0xff9ccc;
    const kioskM = this._mat(new THREE.MeshStandardMaterial({ color: kiosk, roughness: 0.6 }));
    const awningM = this._mat(new THREE.MeshStandardMaterial({ color: kind === 'food' ? 0xe84c3d : 0x4fc3e8, roughness: 0.6 }));
    const body = new THREE.Mesh(this._geo(new RoundedBoxGeometry(2.4, 1.6, 2.0, 2, 0.15)), kioskM);
    body.position.y = 0.8; body.castShadow = body.receiveShadow = true;
    grp.add(body);
    const awning = new THREE.Mesh(this._geo(new THREE.ConeGeometry(2.0, 0.9, 4)), awningM);
    awning.position.y = 2.0; awning.rotation.y = Math.PI / 4; awning.castShadow = true;
    grp.add(awning);
    const sign = this._makeSprite(this._iconTexture(kind === 'food' ? '🌭' : '🍦'), 1.1);
    sign.position.set(0, 2.7, 0);
    grp.add(sign);
    this.scene.add(grp);
    this.obstacles.push({ x, z, r: 1.9 });
    const marker = this._buildMarker(kind === 'food' ? 0xff6a3d : 0xff6ab0);
    marker.position.set(x, 0, z);
    this.scene.add(marker);
    this.stands.push({ x, z, kind, marker });
  }

  _buildTower(cx, cz) {
    const h = rand(7, 13);
    const color = pick([0x9fb0c8, 0xb0a8c8, 0xa8c0b8, 0xc8b0a0]);
    const winTex = this._windowTexture('#' + color.toString(16).padStart(6, '0'), '#fff6c8');
    winTex.repeat.set(2, Math.round(h / 2.2));
    const body = new THREE.Mesh(
      this._geo(new RoundedBoxGeometry(6.5, h, 6.5, 2, 0.15)),
      this._mat(new THREE.MeshStandardMaterial({ map: winTex, roughness: 0.6 })),
    );
    body.position.set(cx, h / 2, cz);
    body.castShadow = body.receiveShadow = true;
    this.scene.add(body);
    this.obstacles.push({ x: cx, z: cz, r: 4.3 });
  }

  _buildPark(cx, cz) {
    const trunkM = this._mat(new THREE.MeshStandardMaterial({ color: 0x8a5a3a, roughness: 0.8 }));
    const leafM = this._mat(new THREE.MeshStandardMaterial({ color: 0x4fae5a, roughness: 0.7 }));
    const trunkG = this._geo(new THREE.CylinderGeometry(0.22, 0.26, 1.4, 10));
    const leafG = this._geo(new THREE.SphereGeometry(1.3, 16, 12));
    for (let i = 0; i < 4; i++) {
      const x = cx + rand(-5, 5), z = cz + rand(-5, 5);
      const trunk = new THREE.Mesh(trunkG, trunkM); trunk.position.set(x, 0.7, z); trunk.castShadow = true;
      const leaf = new THREE.Mesh(leafG, leafM); leaf.position.set(x, 1.9, z); leaf.castShadow = true;
      leaf.scale.setScalar(rand(0.8, 1.15));
      this.scene.add(trunk, leaf);
      this.obstacles.push({ x, z, r: 0.55 });
    }
  }

  // Flechita/baliza flotante que marca el puesto o la casa del pedido actual
  _buildMarker(color) {
    const grp = new THREE.Group();
    const cone = new THREE.Mesh(
      this._geo(new THREE.ConeGeometry(0.4, 0.8, 16)),
      this._mat(new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.3 })),
    );
    cone.rotation.x = Math.PI;
    grp.add(cone);
    grp.visible = false;
    grp.userData.baseY = 4.2;
    return grp;
  }

  // ── Autos ────────────────────────────────────────────────────────────────
  _buildCars() {
    this.cars = {};
    this.carRoot = new THREE.Group();
    this.scene.add(this.carRoot);
    for (const c of CARS) {
      const rig = new THREE.Group();
      rig.visible = false;
      this.carRoot.add(rig);
      this['_build_' + c.kind](rig, c);
      this.cars[c.id] = rig;
    }
  }
  _wheels(rig, wheelPositions) {
    const wheelG = this._geo(new THREE.CylinderGeometry(0.42, 0.42, 0.32, 18));
    const wheelM = this._mat(new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.7 }));
    const hubM = this._mat(new THREE.MeshStandardMaterial({ color: 0xcfd4da, metalness: 0.5, roughness: 0.3 }));
    const hubG = this._geo(new THREE.CylinderGeometry(0.16, 0.16, 0.34, 12));
    const wheels = [];
    for (const [x, y, z] of wheelPositions) {
      const w = new THREE.Mesh(wheelG, wheelM); w.rotation.z = Math.PI / 2; w.position.set(x, y, z); w.castShadow = true;
      const hub = new THREE.Mesh(hubG, hubM); hub.rotation.z = Math.PI / 2;
      w.add(hub);
      rig.add(w);
      wheels.push(w);
    }
    return wheels;
  }
  _build_sedan(rig, c) {
    const bodyM = this._mat(new THREE.MeshPhysicalMaterial({ color: c.body, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15 }));
    const roofM = this._mat(new THREE.MeshPhysicalMaterial({ color: c.roof, roughness: 0.35, transparent: true, opacity: 0.92 }));
    const lightM = this._mat(new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.9 }));
    const base = new THREE.Mesh(this._geo(new RoundedBoxGeometry(2.1, 0.7, 3.6, 3, 0.25)), bodyM);
    base.position.y = 0.6; base.castShadow = true; rig.add(base);
    const cabin = new THREE.Mesh(this._geo(new RoundedBoxGeometry(1.7, 0.65, 1.9, 3, 0.3)), roofM);
    cabin.position.set(0, 1.12, -0.15); cabin.castShadow = true; rig.add(cabin);
    for (const s of [-1, 1]) {
      const l = new THREE.Mesh(this._geo(new THREE.SphereGeometry(0.14, 12, 10)), lightM);
      l.position.set(0.7 * s, 0.6, 1.78); rig.add(l);
    }
    rig.userData.wheels = this._wheels(rig, [[-1.1, 0.42, 1.15], [1.1, 0.42, 1.15], [-1.1, 0.42, -1.15], [1.1, 0.42, -1.15]]);
    rig.userData.carryY = 1.9;
  }
  _build_van(rig, c) {
    const bodyM = this._mat(new THREE.MeshPhysicalMaterial({ color: c.body, roughness: 0.32, clearcoat: 0.9, clearcoatRoughness: 0.15 }));
    const winM = this._mat(new THREE.MeshPhysicalMaterial({ color: c.roof, roughness: 0.35, transparent: true, opacity: 0.85 }));
    const lightM = this._mat(new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.9 }));
    const base = new THREE.Mesh(this._geo(new RoundedBoxGeometry(2.2, 1.5, 4.2, 3, 0.3)), bodyM);
    base.position.y = 1.05; base.castShadow = true; rig.add(base);
    const windshield = new THREE.Mesh(this._geo(new RoundedBoxGeometry(2.0, 0.9, 0.1, 2, 0.15)), winM);
    windshield.position.set(0, 1.4, 1.95); rig.add(windshield);
    for (const s of [-1, 1]) {
      const l = new THREE.Mesh(this._geo(new THREE.SphereGeometry(0.15, 12, 10)), lightM);
      l.position.set(0.8 * s, 0.75, 2.08); rig.add(l);
    }
    rig.userData.wheels = this._wheels(rig, [[-1.18, 0.42, 1.4], [1.18, 0.42, 1.4], [-1.18, 0.42, -1.4], [1.18, 0.42, -1.4]]);
    rig.userData.carryY = 2.6;
  }
  _build_truck(rig, c) {
    const bodyM = this._mat(new THREE.MeshPhysicalMaterial({ color: c.body, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15 }));
    const cabM  = this._mat(new THREE.MeshPhysicalMaterial({ color: c.roof, roughness: 0.4 }));
    const bedM  = this._mat(new THREE.MeshStandardMaterial({ color: 0x55585f, roughness: 0.6 }));
    const lightM = this._mat(new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.9 }));
    const cab = new THREE.Mesh(this._geo(new RoundedBoxGeometry(2.1, 1.3, 1.7, 3, 0.25)), bodyM);
    cab.position.set(0, 0.95, 1.1); cab.castShadow = true; rig.add(cab);
    const cabTop = new THREE.Mesh(this._geo(new RoundedBoxGeometry(1.8, 0.6, 1.4, 2, 0.2)), cabM);
    cabTop.position.set(0, 1.75, 1.2); cabTop.castShadow = true; rig.add(cabTop);
    const bed = new THREE.Mesh(this._geo(new RoundedBoxGeometry(2.1, 0.8, 2.1, 2, 0.15)), bedM);
    bed.position.set(0, 0.7, -0.95); bed.castShadow = true; rig.add(bed);
    for (const s of [-1, 1]) {
      const l = new THREE.Mesh(this._geo(new THREE.SphereGeometry(0.14, 12, 10)), lightM);
      l.position.set(0.7 * s, 0.55, 1.96); rig.add(l);
    }
    rig.userData.wheels = this._wheels(rig, [[-1.15, 0.42, 1.2], [1.15, 0.42, 1.2], [-1.15, 0.42, -1.2], [1.15, 0.42, -1.2]]);
    rig.userData.carryY = 1.55;
  }

  setCar(id) {
    if (!this.cars[id]) return;
    this.carId = id;
    for (const k in this.cars) this.cars[k].visible = k === id;
    this.carRig = this.cars[id];
    try { localStorage.setItem('conducir3d_car', id); } catch (e) { /* sin storage */ }
  }

  // ── Sprites/partículas ───────────────────────────────────────────────────
  _initFx() {
    this.carrySprite = this._makeSprite(this._iconTexture('🌭'), 1.1);
    this.carrySprite.visible = false;
    this.scene.add(this.carrySprite);

    this.pMax = 120;
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
  _burst(x, y, z, n, col, spd = 3, life = 0.5, size = 0.08, grav = 9) {
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

  // ── Entrada: botones de volante/pedales (los wirea game.js) + teclado ──────
  // El manejo llega por setSteer/setGas/setBrake (botones de game.js); acá sólo el
  // toque en pantalla para arrancar desde el cartel de "Tocá para empezar".
  _initInput() {
    this._pd = () => this.pointer();
    this.el.addEventListener('pointerdown', this._pd);
  }
  setSteer(x) { this.steerDir = clamp(x, -1, 1); }
  setGas(on) { this.gas = !!on; }
  setBrake(on) { this.brake = !!on; }

  // ── Estado del juego ─────────────────────────────────────────────────────
  reset() {
    this._t = 0;
    this.score = 0;
    this.pos = { x: -CELL / 2, z: -CELL / 2 };   // nace en un cruce de calles, no arriba de una manzana
    this.heading = Math.PI;      // mirando hacia -z al arrancar
    this.speed = 0;
    this.steerDir = 0; this.gas = false; this.brake = false;
    this.carrying = null;
    this.order = null;
    this.state = 'ready';
    this._hud = {};
    this.shake = 0;
    if (this.carRig) { this.carRig.position.set(this.pos.x, 0, this.pos.z); this.carRig.rotation.set(0, this.heading, 0); }
    this.newOrder();
    this._msg('ready');
    this._updateHud(true);
  }
  start() {
    if (this.state === 'ready') { this.state = 'run'; this._msg(null); }
  }
  newOrder() {
    const kind = Math.random() < 0.6 ? 'food' : 'helado';
    const candidates = this.stands.filter(s => s.kind === kind);
    const stand = pick(candidates.length ? candidates : this.stands);
    const house = pick(this.houses);
    const item = pick(kind === 'food' ? FOOD_ITEMS : HELADO_ITEMS);
    for (const s of this.stands) s.marker.visible = false;
    for (const h of this.houses) h.marker.visible = false;
    stand.marker.visible = true;
    house.marker.visible = true;
    this.order = { stand, house, item };
    this.carrying = null;
    this.carrySprite.visible = false;
  }

  // ── Update ───────────────────────────────────────────────────────────────
  update(dt) {
    dt = clamp(dt || 0, 0, 0.05);
    this._t += dt;
    this._adaptQuality(dt);

    if (this.state === 'run') {
      const accel = this.gas ? ACCEL : (this.brake ? -BRAKE : 0);
      this.speed += accel * dt;
      if (!this.gas && !this.brake) {
        const f = FRICTION * dt;
        this.speed = Math.abs(this.speed) <= f ? 0 : this.speed - Math.sign(this.speed) * f;
      }
      this.speed = clamp(this.speed, -REV_SPEED, MAX_SPEED);
      const turnFactor = clamp(Math.abs(this.speed) / 3, 0, 1);
      if (this.steerDir) this.heading += this.steerDir * STEER_RATE * turnFactor * dt * (this.speed < 0 ? -1 : 1);
      const fx = Math.sin(this.heading), fz = -Math.cos(this.heading);
      this.pos.x += fx * this.speed * dt;
      this.pos.z += fz * this.speed * dt;
      this.pos.x = clamp(this.pos.x, this._bounds.min, this._bounds.max);
      this.pos.z = clamp(this.pos.z, this._bounds.min, this._bounds.max);
      this._resolveCollisions();
      this._checkPickupDelivery();
    }
    this._updateCar(dt);
    this._updateMarkers(dt);
    this._updateParticles(dt);
    this._updateCamera(dt);
    this._updateHud();
  }

  _resolveCollisions() {
    for (const o of this.obstacles) {
      const dx = this.pos.x - o.x, dz = this.pos.z - o.z;
      const d = Math.hypot(dx, dz), r = o.r + CAR_RADIUS;
      if (d < r) {
        const k = d < 1e-4 ? 1 : r / d;
        this.pos.x = o.x + dx * k;
        this.pos.z = o.z + dz * k;
        this.speed *= 0.55;
        this.shake = Math.max(this.shake, 0.12);
      }
    }
  }

  _checkPickupDelivery() {
    if (!this.order) return;
    if (!this.carrying) {
      const s = this.order.stand;
      if (Math.hypot(this.pos.x - s.x, this.pos.z - s.z) < 2.6) {
        this.carrying = this.order.item;
        this.carrySprite.visible = true;
        this._burst(s.x, 2.2, s.z, 14, [1, 1, 0.6], 3, 0.4, 0.07);
        this._toast(`${this.order.item.emoji} ¡Pedido listo! Llevalo a la casa 🏠`);
      }
    } else {
      const h = this.order.house;
      if (Math.hypot(this.pos.x - h.x, this.pos.z - h.z) < 2.8) {
        this.score++;
        addCoins(1);
        this._burst(h.x, 2.2, h.z, 24, [1, 0.82, 0.23], 4, 0.6, 0.08);
        this._toast(`🏠 ¡Entregado! +1 · ${this.order.item.name}`);
        if (this.score > this.best) { this.best = this.score; try { localStorage.setItem('conducir3d_best', this.best); } catch (e) {} }
        this.newOrder();
      }
    }
  }

  _updateCar(dt) {
    if (!this.carRig) return;
    this.carRig.position.set(this.pos.x, 0, this.pos.z);
    this.carRig.rotation.y = this.heading;
    for (const w of this.carRig.userData.wheels || []) w.rotation.x -= this.speed * dt * 1.6;
    const steerVis = clamp(this.steerDir * 0.5, -0.5, 0.5);
    const wheels = this.carRig.userData.wheels;
    if (wheels && wheels.length >= 2) { wheels[0].rotation.y = steerVis; wheels[1].rotation.y = steerVis; }
    if (this.carrying) {
      const cy = (this.carRig.userData.carryY || 2) + Math.sin(this._t * 3) * 0.08;
      this.carrySprite.position.set(this.pos.x, cy, this.pos.z);
      const tex = this._iconTexture(this.carrying.emoji);
      if (this.carrySprite.material.map !== tex) { this.carrySprite.material.map = tex; this.carrySprite.material.needsUpdate = true; }
    }
  }

  _updateMarkers(dt) {
    const bob = Math.sin(this._t * 3) * 0.3;
    for (const h of this.houses) if (h.marker.visible) h.marker.position.y = h.marker.userData.baseY + bob;
    for (const s of this.stands) if (s.marker.visible) s.marker.position.y = s.marker.userData.baseY + bob;
  }

  _updateCamera(dt) {
    const cam = this.camera;
    const fx = Math.sin(this.heading), fz = -Math.cos(this.heading);
    const camDist = 8.2, camHeight = 4.0, lookAhead = 6.5;
    const targetPos = new THREE.Vector3(this.pos.x - fx * camDist, camHeight, this.pos.z - fz * camDist);
    const targetLook = new THREE.Vector3(this.pos.x + fx * lookAhead, 1.2, this.pos.z + fz * lookAhead);
    if (!this._camPos) { this._camPos = targetPos.clone(); this._camLook = targetLook.clone(); }
    this._camPos.lerp(targetPos, Math.min(1, dt * 4.5));
    this._camLook.lerp(targetLook, Math.min(1, dt * 6));
    cam.position.copy(this._camPos);
    if (this.shake > 0) {
      const s = this.shake;
      cam.position.x += rand(-s, s); cam.position.y += rand(-s, s) * 0.6;
      this.shake = Math.max(0, this.shake - dt * 2);
    }
    cam.lookAt(this._camLook);
  }

  // ── HUD (DOM en #conducir3d-ui) ──────────────────────────────────────────
  _updateHud(force) {
    const H = this._hud || (this._hud = {});
    if (force || H.score !== this.score) { H.score = this.score; const e = $('cc3-score'); if (e) e.textContent = '📦 ' + this.score; }
    if (force || H.best !== this.best) { H.best = this.best; const e = $('cc3-best'); if (e) e.textContent = 'Mejor: ' + this.best; }
    if (this.order) {
      const label = this.carrying
        ? `${this.carrying.emoji} Llevalo a la casa 🏠`
        : `Buscá ${this.order.item.emoji} ${this.order.item.name} en ${this.order.stand.kind === 'food' ? '🌭' : '🍦'}`;
      if (force || H.label !== label) { H.label = label; const e = $('cc3-order'); if (e) e.textContent = label; }
      const target = this.carrying ? this.order.house : this.order.stand;
      const dx = target.x - this.pos.x, dz = target.z - this.pos.z;
      const bearing = Math.atan2(dx, -dz) * 180 / Math.PI;
      const rel = wrapDeg(bearing - this.heading * 180 / Math.PI);
      const arrow = $('cc3-arrow');
      if (arrow) arrow.style.transform = `rotate(${rel}deg)`;
      const dist = Math.hypot(dx, dz);
      const e2 = $('cc3-dist');
      if (e2) e2.textContent = Math.round(dist) + ' m';
    }
    const toast = $('cc3-toast');
    if (toast && this._toastT > 0) { this._toastT -= 1 / 60; if (this._toastT <= 0) toast.classList.remove('show'); }
  }
  _toast(text) {
    const e = $('cc3-toast');
    if (!e) return;
    e.textContent = text;
    e.classList.remove('show'); void e.offsetWidth; e.classList.add('show');
    this._toastT = 2.2;
  }
  _msg(kind) {
    const e = $('conducir3d-msg');
    if (!e) return;
    if (!kind) { e.classList.add('hidden'); return; }
    e.classList.remove('hidden');
    if (kind === 'ready') {
      e.innerHTML = `<div class="cc3-msg-title">Conduce por la Ciudad</div>
        <div class="cc3-pick">${CARS.map(c => `<button class="cc3-car${c.id === this.carId ? ' on' : ''}"
          data-car="${c.id}"><span>${c.emoji}</span>${c.name}</button>`).join('')}</div>
        <div class="cc3-msg-sub">Tocá para empezar</div>
        <div class="cc3-msg-help">⬅️➡️ girar · 🟢 acelerar · 🔴 frenar/retroceder<br>Buscá el puesto marcado, recogé el pedido y llevalo a la casa marcada</div>
        <div class="cc3-msg-best">${this.best ? `Mejor entrega: ${this.best}` : ''}</div>`;
      for (const b of e.querySelectorAll('.cc3-car')) {
        b.addEventListener('pointerdown', ev => ev.stopPropagation());
        b.addEventListener('click', ev => {
          ev.stopPropagation();
          this.setCar(b.dataset.car);
          for (const o of e.querySelectorAll('.cc3-car')) o.classList.toggle('on', o === b);
        });
      }
    }
  }
  pointer() { this.start(); }
  showReady() { this._msg(this.state === 'ready' ? 'ready' : null); }
  showError(err) {
    const e = $('conducir3d-msg');
    if (!e) return;
    e.classList.remove('hidden');
    e.innerHTML = `<div class="cc3-msg-title">Ups 😿</div><div class="cc3-msg-sub">El 3D se trabó</div>
      <div class="cc3-msg-help"><small>${String((err && err.message) || err).replace(/</g, '&lt;')}</small></div>`;
  }

  // ── Render / calidad ─────────────────────────────────────────────────────
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
  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w / 2, h / 2);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 1 ? 70 : w / h < 1.4 ? 62 : 58;
    this.camera.updateProjectionMatrix();
  }
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
    this.el.removeEventListener('pointerdown', this._pd);
    for (const d of this._disposables) { try { d.dispose(); } catch (e) {} }
    try { this.envTex.dispose(); } catch (e) {}
    try { this.composer.dispose && this.composer.dispose(); } catch (e) {}
    try { this.bloom.dispose(); } catch (e) {}
    try { this.renderer.dispose(); this.renderer.forceContextLoss(); } catch (e) {}
    this.el.remove();
    const m = $('conducir3d-msg'); if (m) m.classList.add('hidden');
  }
}
