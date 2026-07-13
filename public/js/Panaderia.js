// ── Panadería: granja → molino → horno → mostrador ──────────────────────────
// Juego de 1 jugador estilo granja de Android: tu personaje camina hasta
// cada estación para hacer la acción que tocaste.
//   1. Tocá el arbusto: el personaje va, lo sacude y suelta semillas.
//   2. Tocá las semillas para que las junte; tocá un campo para plantar.
//   3. Cosechá el trigo maduro y llevalo al molino → harina.
//   4. Horneá la harina en el horno → pan.
//   5. Los clientes llegan al mostrador y compran pan → dinero 💰.
//   6. Con el dinero comprás más campos o trabajadores que automatizan
//      cada tarea (granjero, molinero, panadero, vendedor).
// El progreso (dinero, campos, trabajadores e inventario) se guarda solo.
//
// Niveles: la misma clase corre la Panadería (nivel 1) y la Pastelería
// (nivel 2, se desbloquea al comprar todo lo del 1). Cada nivel es una entrada
// de LEVELS con su tienda, fuentes, productos y paleta. El dinero se comparte
// entre niveles; el resto del progreso vive en el saveKey de cada nivel.

import { Sound }     from './Sound.js';
import { addCoins }  from './Wallet.js';
import { Character } from './Character.js';

// ── Sprites PNG ilustrados (con fallback vectorial mientras cargan) ──────────
const ASSET = (name) => `/assets/panaderia/${name}.png`;
function loadImg(name) { const im = new Image(); im.src = ASSET(name); return im; }
function ready(img) { return img && img.complete && img.naturalWidth > 0; }
const IMG = {
  molino: loadImg('molino'), aspas: loadImg('aspas'), horno: loadImg('horno'),
  mostrador: loadImg('mostrador'), arbusto: loadImg('arbusto'),
  trigo: [loadImg('trigo_1'), loadImg('trigo_2'), loadImg('trigo_3')],
  semilla: loadImg('semilla'), harina: loadImg('harina'), pan: loadImg('pan'),
  granjero: loadImg('granjero'), molinero: loadImg('molinero'),
  panadero: loadImg('panadero'), vendedor: loadImg('vendedor'),
  clientes: [loadImg('cliente1'), loadImg('cliente2'), loadImg('cliente3'), loadImg('cliente4')],
  jugadora: loadImg('jugadora'),
  gallinero: loadImg('gallinero'), gallina: loadImg('gallina'), huevo: loadImg('huevo'),
  cacaotero: loadImg('cacaotero'), chocolate: loadImg('chocolate'),
  vaca: loadImg('vaca'), leche: loadImg('leche'),
  torta: loadImg('torta'), galletas: loadImg('galletas'), chocoleche: loadImg('chocoleche'),
  panqueques: loadImg('panqueques'),
};
// sprites propios de la pastelería (nivel 2); mientras no existan los PNG,
// ready() nunca da true y se dibuja el respaldo vectorial/emoji
const ASSET2 = (name) => `/assets/pasteleria/${name}.png`;
function loadImg2(name) { const im = new Image(); im.src = ASSET2(name); return im; }
const IMG2 = {
  colmena: loadImg2('colmena'), miel: loadImg2('miel'),
  frutillar: loadImg2('frutillar'), frutilla: loadImg2('frutilla'),
  medialunas: loadImg2('medialunas'), tarta: loadImg2('tarta'),
  alfajores: loadImg2('alfajores'), licuado: loadImg2('licuado'),
};
// sprite de cada producto vendible por nivel (para burbujas, mostrador y HUD)
const PROD_IMG = {
  panaderia: () => ({ pan: IMG.pan, torta: IMG.torta, galleta: IMG.galletas, chocoleche: IMG.chocoleche, panqueque: IMG.panqueques }),
  pasteleria: () => ({ medialuna: IMG2.medialunas, tarta: IMG2.tarta, alfajor: IMG2.alfajores, licuado: IMG2.licuado }),
};
// sprite de cada ícono del HUD (si no cargó, se usa el emoji)
const CHIP_IMG = () => ({
  '🌱': IMG.semilla, '🍞': IMG.pan, '🥚': IMG.huevo, '🎂': IMG.torta,
  '🍫': IMG.chocolate, '🍪': IMG.galletas, '🥛': IMG.leche, '☕': IMG.chocoleche,
  '🥞': IMG.panqueques,
  '🍯': IMG2.miel, '🍓': IMG2.frutilla, '🥐': IMG2.medialunas,
  '🍰': IMG2.tarta, '🍬': IMG2.alfajores, '🥤': IMG2.licuado,
});
// cómo se muestra cada ingrediente de las recetas (sprite con emoji de respaldo)
const ING = {
  flour: { emoji: 'H',  word: 'harina', img: () => IMG.harina },
  egg:   { emoji: '🥚', img: () => IMG.huevo },
  choc:  { emoji: '🍫', img: () => IMG.chocolate },
  milk:  { emoji: '🥛', img: () => IMG.leche },
  honey: { emoji: '🍯', img: () => IMG2.miel },
  straw: { emoji: '🍓', img: () => IMG2.frutilla },
};
// dibuja una imagen contenida en un cuadrado centrado en (cx, cy)
function drawIconImg(ctx, img, cx, cy, size) {
  const ar = img.naturalWidth / img.naturalHeight;
  let w = size, h = w / ar;
  if (h > size) { h = size; w = h * ar; }
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
}

const MONEY_KEY  = 'panaderia_money';   // dinero compartido entre los dos niveles
const MAX_PLOTS  = 4;
const GROW_TIME  = 10;    // seg. para que el trigo madure
const MILL_TIME  = 3.5;   // seg. de molienda por trigo
const MILL_TIME_FAST = 1.8;   // con la mejora ⭐
const OVEN_TIME  = 4.5;   // seg. de horneado por pan
const OVEN_TIME_FAST = 2.3;   // con la mejora ⭐
const MAX_GROUND_SEEDS = 6;

const COW_MILK_COOLDOWN = 8;   // seg. hasta que la vaca vuelve a dar leche
const HONEY_COOLDOWN    = 9;   // seg. hasta que la colmena vuelve a dar miel
const MAX_GROUND_EGGS   = 3;
const MAX_GROUND_CHOCS  = 3;
const MAX_GROUND_STRAWS = 3;

// Productos horneables por nivel. `ing` es la receta (se descuenta tal cual en
// _loadOven, sea cual sea el ingrediente) y `req` las fuentes que la desbloquean.
const PRODUCTS = {
  pan:        { name: 'Pan',           emoji: '🍞', inv: 'bread',     ing: { flour: 1 },          req: [],                priceBase: 12, priceVar: 5,  coins: 5,  timeMul: 1 },
  galleta:    { name: 'Galletas',      emoji: '🍪', inv: 'cookie',    ing: { flour: 1, choc: 1 }, req: ['cacao'],         priceBase: 25, priceVar: 6,  coins: 8,  timeMul: 1.5 },
  panqueque:  { name: 'Panqueques',    emoji: '🥞', inv: 'pancake',   ing: { flour: 1, milk: 1 }, req: ['vaca'],          priceBase: 22, priceVar: 6,  coins: 7,  timeMul: 1.2 },
  chocoleche: { name: 'Choco c/leche', emoji: '☕', inv: 'chocomilk', ing: { choc: 1, milk: 1 },  req: ['cacao', 'vaca'], priceBase: 30, priceVar: 8,  coins: 9,  timeMul: 0.8 },
  torta:      { name: 'Torta',         emoji: '🎂', inv: 'cake',      ing: { flour: 2, egg: 1 },  req: ['coop'],          priceBase: 45, priceVar: 10, coins: 12, timeMul: 2.2 },
};
const PRODUCTS2 = {
  medialuna: { name: 'Medialunas', emoji: '🥐', inv: 'croissant', ing: { flour: 1, honey: 1 },          req: [],                     priceBase: 24, priceVar: 8,  coins: 8,  timeMul: 1 },
  alfajor:   { name: 'Alfajores',  emoji: '🍬', inv: 'alfajor',   ing: { flour: 1, choc: 1, honey: 1 }, req: ['cacao'],              priceBase: 55, priceVar: 12, coins: 14, timeMul: 1.5 },
  licuado:   { name: 'Licuado',    emoji: '🥤', inv: 'licuado',   ing: { milk: 1, straw: 1 },           req: ['vaca', 'frutillar'],  priceBase: 45, priceVar: 10, coins: 12, timeMul: 0.8 },
  tarta:     { name: 'Tarta',      emoji: '🍰', inv: 'tart',      ing: { flour: 2, egg: 1, straw: 1 },  req: ['coop', 'frutillar'],  priceBase: 90, priceVar: 20, coins: 22, timeMul: 2.2 },
};

// ── Niveles ──────────────────────────────────────────────────────────────────
// `sources` son las fuentes de ingredientes: las free vienen de regalo con el
// nivel, el resto se compra en la tienda. `starter` es el producto básico que
// se hornea tocando el horno directo (y el que el panadero hace por defecto).
const LEVELS = {
  panaderia: {
    key: 'panaderia',
    saveKey: 'panaderia_state',
    title: '🍞 PANADERÍA',
    starter: 'pan',
    fieldPrices: [60, 120],   // campos 3 y 4 (arrancás con 2)
    sources: {
      coop:  { name: 'Gallinero', emoji: '🐔', ing: 'egg',  price: 200, done: '✓ ¡hay tortas!',    already: 'Ya tenés gallinero 🐔', buy: '¡Gallinero! Ahora hay tortas 🎂' },
      cacao: { name: 'Cacaotero', emoji: '🍫', ing: 'choc', price: 300, done: '✓ ¡hay galletas!',  already: 'Ya tenés cacaotero 🍫', buy: '¡Cacaotero! Ahora hay galletas 🍪' },
      vaca:  { name: 'Vaca',      emoji: '🐄', ing: 'milk', price: 250, done: '✓ ¡hay panqueques!', already: 'Ya tenés vaca 🐄',
               buy: (g) => g.cacao ? '¡Vaca! Panqueques y choco c/leche 🥞☕' : '¡Vaca! Ahora hay panqueques 🥞' },
    },
    workers: [
      { key: 'granjero', name: 'Granjero', emoji: '🧑‍🌾', price: 180, desc: 'Junta, planta y cosecha' },
      { key: 'molinero', name: 'Molinero', emoji: '🧑‍🏭', price: 220, desc: 'Muele el trigo solo' },
      { key: 'panadero', name: 'Panadero', emoji: '🧑‍🍳', price: 260, desc: 'Hornea el pan solo' },
      { key: 'vendedor', name: 'Vendedor', emoji: '🧑‍💼', price: 300, desc: 'Atiende el mostrador' },
    ],
    upgrades: [
      { key: 'molino', name: 'Molino', price: 250, desc: 'Muele el doble de rápido' },
      { key: 'horno',  name: 'Horno',  price: 300, desc: 'Hornea el doble de rápido' },
    ],
    products: PRODUCTS,
    palette: { sky0: '#8ED0F5', sky1: '#C8EAFB', grass0: '#9BD26E', grass1: '#7CBB52', path: '#D8B478', sign: '#E0A050', signText: '#B06A20' },
  },
  pasteleria: {
    key: 'pasteleria',
    saveKey: 'pasteleria_state',
    title: '🧁 PASTELERÍA',
    starter: 'medialuna',
    fieldPrices: [120, 240],
    sources: {
      colmena:   { name: 'Colmena',   emoji: '🐝', ing: 'honey', price: 0, free: true },
      frutillar: { name: 'Frutillar', emoji: '🍓', ing: 'straw', price: 350, done: '✓ ¡hay frutillas!', already: 'Ya tenés frutillar 🍓', buy: '¡Frutillar! Frutillas para tartas y licuados 🍓' },
      coop:  { name: 'Gallinero', emoji: '🐔', ing: 'egg',  price: 400, done: '✓ ¡hay tartas!',    already: 'Ya tenés gallinero 🐔', buy: '¡Gallinero! Huevos para las tartas 🥚' },
      cacao: { name: 'Cacaotero', emoji: '🍫', ing: 'choc', price: 550, done: '✓ ¡hay alfajores!', already: 'Ya tenés cacaotero 🍫', buy: '¡Cacaotero! Ahora hay alfajores 🍬' },
      vaca:  { name: 'Vaca',      emoji: '🐄', ing: 'milk', price: 500, done: '✓ ¡hay licuados!',  already: 'Ya tenés vaca 🐄',      buy: '¡Vaca! Leche para los licuados 🥛' },
    },
    workers: [
      { key: 'granjero', name: 'Granjero',  emoji: '🧑‍🌾', price: 350, desc: 'Junta, planta y cosecha' },
      { key: 'molinero', name: 'Molinero',  emoji: '🧑‍🏭', price: 420, desc: 'Muele el trigo solo' },
      { key: 'panadero', name: 'Pastelero', emoji: '🧑‍🍳', price: 500, desc: 'Hornea solo' },
      { key: 'vendedor', name: 'Vendedor',  emoji: '🧑‍💼', price: 580, desc: 'Atiende el mostrador' },
    ],
    upgrades: [
      { key: 'molino', name: 'Molino', price: 500, desc: 'Muele el doble de rápido' },
      { key: 'horno',  name: 'Horno',  price: 600, desc: 'Hornea el doble de rápido' },
    ],
    products: PRODUCTS2,
    palette: { sky0: '#F8CCE4', sky1: '#FDEAF4', grass0: '#A8E0C0', grass1: '#86C9A6', path: '#D8B8E0', sign: '#E080B0', signText: '#B05080' },
  },
};

const CUSTOMER_COLORS = [
  ['#C49BE0', '#7A4FA8'], ['#8FD0F0', '#3A7AA8'], ['#FFB6A0', '#C06040'],
  ['#A8E0A0', '#4E9048'], ['#F6D080', '#B08828'], ['#F0A0C8', '#B04878'],
];

export class Panaderia {
  // opts: { level: 'panaderia'|'pasteleria', onLevelUnlocked(), onSwitchLevel(target) }
  constructor(canvas, look, opts = {}) {
    this.canvas = canvas;
    this.opts = opts;
    this.cfg = LEVELS[opts.level] || LEVELS.panaderia;
    this.t = 0;
    // personaje jugable: camina hasta el objetivo tocado y hace la acción
    this.player = new Character(canvas.width * 0.30, canvas.height * 0.55, look);
    this.dest = null;      // {x, y} destino de caminata
    this.task = null;      // acción pendiente al llegar: {type, ...}
    this.msg = ''; this.msgT = 0;
    this.floats = [];          // textos flotantes de feedback
    this.groundSeeds = [];     // semillas sueltas para juntar
    this.bushShake = 0;
    this.bushCooldown = 0;
    this.seedAutoT = 4;        // el arbusto suelta una semilla solo cada tanto
    this.millAngle = 0;
    this.customers = [];
    this.custSpawnT = 3;
    this.workerT = { granjero: 0, molinero: 0, panadero: 0, vendedor: 0 };
    this.saveT = 4;

    // granjero contratado: camina hasta semillas y campos para trabajar
    this.farmer = { x: 0, y: 0, seeded: false, dest: null, task: null, pauseT: 0, facing: 1 };

    // gallinero: pone huevos en el piso que se juntan como las semillas
    this.eggs = [];
    this.eggSpawnT = 6;
    // cacaotero: suelta chocolates; también se puede sacudir como el arbusto
    this.chocs = [];
    this.chocSpawnT = 8;
    this.cacaoShake = 0;
    this.cacaoCooldown = 0;

    // vaca: se ordeña cuando está lista (cada tanto) y da leche directa
    this.cowReadyT = 0;

    // colmena (pastelería): junta miel que se cosecha directa, como la leche
    this.honeyReadyT = 0;
    // frutillar (pastelería): suelta frutillas; también se sacude como el arbusto
    this.straws = [];
    this.strawSpawnT = 8;
    this.frutShake = 0;
    this.frutCooldown = 0;

    // estado persistente
    this.money   = 0;
    this.inv     = { seed: 0, wheat: 0, flour: 0, bread: 0, egg: 0, cake: 0, choc: 0, cookie: 0, milk: 0, chocomilk: 0, pancake: 0,
                     honey: 0, straw: 0, croissant: 0, tart: 0, alfajor: 0, licuado: 0 };
    this.workers = { granjero: false, molinero: false, panadero: false, vendedor: false };
    this.upgrades = { molino: false, horno: false };
    this.coop    = false;
    this.cacao   = false;
    this.vaca    = false;
    this.colmena   = false;
    this.frutillar = false;
    this.won = false;        // ya completó todas las compras del nivel
    this.celebrate = null;   // overlay de festejo activo (confetti + botones)
    this.plots   = [];
    let nPlots = 2;
    try {
      const s = JSON.parse(localStorage.getItem(this.cfg.saveKey));
      if (s) {
        this.money = s.money | 0;
        if (s.inv) for (const k of Object.keys(this.inv)) this.inv[k] = s.inv[k] | 0;
        if (s.workers) for (const k of Object.keys(this.workers)) this.workers[k] = !!s.workers[k];
        if (s.upgrades) for (const k of Object.keys(this.upgrades)) this.upgrades[k] = !!s.upgrades[k];
        this.coop = !!s.coop;
        this.cacao = !!s.cacao;
        this.vaca = !!s.vaca;
        this.colmena = !!s.colmena;
        this.frutillar = !!s.frutillar;
        this.won = !!s.won;
        nPlots = Math.max(2, Math.min(MAX_PLOTS, s.plots | 0 || 2));
      }
    } catch (e) {}
    // dinero compartido entre niveles; los saves viejos lo tenían adentro de
    // panaderia_state, así que la primera vez se migra desde ahí
    try {
      const m = localStorage.getItem(MONEY_KEY);
      if (m !== null) {
        this.money = parseInt(m, 10) | 0;
      } else {
        const legacy = JSON.parse(localStorage.getItem(LEVELS.panaderia.saveKey));
        if (legacy) this.money = legacy.money | 0;
      }
    } catch (e) {}
    // fuentes de regalo del nivel (la colmena de la pastelería)
    for (const [k, src] of Object.entries(this.cfg.sources)) if (src.free) this[k] = true;
    for (let i = 0; i < nPlots; i++) this.plots.push({ state: 'empty', t: 0 });

    this.mill = { busy: false, t: 0 };
    this.oven = { busy: false, t: 0 };

    // cámara de zoom (pinza en mobile): screen = world * z + (x, y)
    this.cam = { z: 1, x: 0, y: 0 };
    this._pinch = null;

    // un save de antes de los niveles puede tener ya todo comprado:
    // el festejo aparece al abrir (una sola vez, won queda guardado)
    this._checkWin();
  }

  _millDur() { return this.upgrades.molino ? MILL_TIME_FAST : MILL_TIME; }
  _ovenDur(prod = this.cfg.starter) {
    return (this.upgrades.horno ? OVEN_TIME_FAST : OVEN_TIME) * this.cfg.products[prod].timeMul;
  }
  _canBake(prod) {
    const P = this.cfg.products[prod];
    return Object.entries(P.ing).every(([k, n]) => this.inv[k] >= n);
  }
  _unlocked(prod) {
    return this.cfg.products[prod].req.every(k => this[k]);
  }

  // ¿Compró todo lo del nivel? (campos, fuentes, trabajadores y mejoras)
  _isComplete() {
    return this.plots.length >= MAX_PLOTS &&
      Object.entries(this.cfg.sources).every(([k, src]) => src.free || this[k]) &&
      this.cfg.workers.every(w => this.workers[w.key]) &&
      this.cfg.upgrades.every(u => this.upgrades[u.key]);
  }

  // Al completar todas las compras se gana el nivel: festejo con confetti y,
  // en la panadería, la invitación a pasar a la pastelería. Una sola vez.
  _checkWin() {
    if (this.won || !this._isComplete()) return;
    this.won = true;
    this._save();
    this.opts.onLevelUnlocked?.(this.cfg.key);
    const W = this.canvas.width, H = this.canvas.height;
    this.celebrate = {
      t: 0,
      confetti: Array.from({ length: 70 }, () => ({
        x: Math.random() * W, y: -Math.random() * H * 0.6,
        vx: (Math.random() - 0.5) * 60, vy: 90 + Math.random() * 140,
        r: 3 + Math.random() * 4, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 6,
        color: ['#FF6B9C', '#FFD24A', '#7ED957', '#6BC5FF', '#C49BE0'][Math.floor(Math.random() * 5)],
      })),
    };
    Sound.serveGood();
  }

  // Borra SOLO el progreso del nivel actual (el dinero compartido, el otro
  // nivel y el resto del juego no se tocan). Tras llamarlo hay que crear una
  // instancia nueva para arrancar de cero.
  wipeSave() {
    try { localStorage.removeItem(this.cfg.saveKey); } catch (e) {}
  }

  _save() {
    try {
      localStorage.setItem(this.cfg.saveKey, JSON.stringify({
        money: this.money, inv: this.inv, workers: this.workers,
        upgrades: this.upgrades, coop: this.coop, cacao: this.cacao, vaca: this.vaca,
        colmena: this.colmena, frutillar: this.frutillar, won: this.won, plots: this.plots.length,
      }));
      localStorage.setItem(MONEY_KEY, String(this.money));
    } catch (e) {}
  }

  // sprite del producto según el nivel (puede no haber cargado: usar ready())
  _prodImg(prod) { return PROD_IMG[this.cfg.key]()[prod]; }

  // ── Layout (recalculado por frame; independiente de la resolución) ─────────
  _layout() {
    const W = this.canvas.width, H = this.canvas.height;
    const s = Math.max(0.5, Math.min(1.0, Math.min(W, H) / 720));

    // campos: grilla 2×2 a la izquierda
    const fa = { x: W * 0.03, y: H * 0.27, w: W * 0.40, h: H * 0.40 };
    const cols = 2;
    const gap = 10 * s;
    const pw = (fa.w - gap * (cols - 1)) / cols;
    const ph = (fa.h - gap) / 2;
    const plotRects = [];
    for (let i = 0; i < MAX_PLOTS; i++) {
      const c = i % cols, r = Math.floor(i / cols);
      plotRects.push({ x: fa.x + c * (pw + gap), y: fa.y + r * (ph + gap), w: pw, h: ph });
    }

    const bush = { x: W * 0.095, y: H * 0.76, r: Math.min(W, H) * 0.075 };
    const seedZone = { x: W * 0.17, y: H * 0.68, w: W * 0.24, h: H * 0.17 };

    const mill = { x: W * 0.525, y: H * 0.47, w: W * 0.105, h: H * 0.34 };
    // gallinero (se compra en la tienda), entre la zona de semillas y el molino
    const coop = { x: W * 0.435, y: H * 0.685, w: W * 0.08, h: H * 0.14 };
    // cacaotero (se compra en la tienda), arriba del gallinero
    const cacao = { x: W * 0.468, y: H * 0.50, r: Math.min(W, H) * 0.060 };
    const chocZone = { x: W * 0.435, y: H * 0.585, w: W * 0.075, h: H * 0.065 };
    // vaca (se compra en la tienda), arriba del cacaotero
    const vaca = { x: W * 0.472, y: H * 0.315, r: Math.min(W, H) * 0.052 };

    // colmena y frutillar (pastelería): en la franja de pasto sobre los campos
    const colmena = { x: W * 0.115, y: H * 0.215, r: Math.min(W, H) * 0.048 };
    const frutillar = { x: W * 0.315, y: H * 0.215, r: Math.min(W, H) * 0.052 };
    const strawZone = { x: W * 0.19, y: H * 0.18, w: W * 0.15, h: H * 0.06 };

    // edificio de la panadería (derecha): mostrador arriba, horno abajo
    const bld = { x: W * 0.655, y: H * 0.10, w: W * 0.335, h: H * 0.585 };
    const counter = { x: bld.x + W * 0.012, y: bld.y + H * 0.235, w: bld.w - W * 0.024, h: H * 0.065 };
    const oven = { x: bld.x + bld.w * 0.5 - W * 0.065, y: bld.y + bld.h * 0.62, w: W * 0.13, h: H * 0.20 };

    // caja de dibujo del mostrador (sprite ~1.82:1) centrada en su zona
    const cbH = H * 0.19;
    const counterBox = { cx: counter.x + counter.w / 2, w: cbH * 1.82, h: cbH, bottom: counter.y + counter.h + 40 * s };
    // clientes en fila detrás del mostrador
    const custXs = [counterBox.cx - counterBox.w * 0.32, counterBox.cx, counterBox.cx + counterBox.w * 0.32];
    const custY  = counter.y - 6 * s;

    // botones de la tienda: barra única a lo ancho, pegada abajo (no tapa nada)
    const shop = [];
    const sgap = 6 * s;
    const sy = H * 0.885, bh = H * 0.10;
    const items = [
      { kind: 'field' },
      ...Object.entries(this.cfg.sources)
        .filter(([, src]) => !src.free)
        .map(([key, src]) => ({ kind: 'source', src: { key, ...src } })),
      ...this.cfg.workers.map(w => ({ kind: 'worker', worker: w })),
      ...this.cfg.upgrades.map(u => ({ kind: 'upgrade', upgrade: u })),
    ];
    const bw = (W * 0.96 - sgap * (items.length - 1)) / items.length;
    items.forEach((it, i) => {
      shop.push({ ...it, x: W * 0.02 + i * (bw + sgap), y: sy, w: bw, h: bh });
    });

    // recetas del horno: botones fijos en columna al costado derecho del horno;
    // tocar una receta manda a la protagonista a cocinarla directamente
    const omX = oven.x + oven.w + 8 * s;
    const omW = Math.min(W * 0.098, bld.x + bld.w - omX - 6 * s);
    const omGap = 6 * s;
    const avail = Object.keys(this.cfg.products).filter(p => this._unlocked(p));
    // la columna se comprime si hay muchas recetas, para no salirse del edificio
    const omTop = oven.y - H * 0.015;
    const omH = Math.min(H * 0.048,
      (bld.y + bld.h - omTop - omGap * (avail.length - 1)) / Math.max(1, avail.length));
    const ovenMenu = avail.map((prod, i) => ({
      prod, x: omX, y: omTop + i * (omH + omGap), w: omW, h: omH,
    }));

    return { W, H, s, plotRects, bush, seedZone, mill, coop, cacao, chocZone, vaca, colmena, frutillar, strawZone, bld, counter, counterBox, oven, ovenMenu, custXs, custY, shop };
  }

  // dibuja una imagen anclada abajo-centro con una altura dada (mantiene aspecto)
  _imgH(ctx, img, cx, bottomY, h) {
    const w = h * (img.naturalWidth / img.naturalHeight);
    ctx.drawImage(img, cx - w / 2, bottomY - h, w, h);
    return w;
  }

  // dibuja una imagen contenida en una caja (sin desbordar), anclada abajo-centro
  _imgFit(ctx, img, x, y, w, h) {
    const ar = img.naturalWidth / img.naturalHeight;
    let dw = w, dh = dw / ar;
    if (dh > h) { dh = h; dw = dh * ar; }
    ctx.drawImage(img, x + (w - dw) / 2, y + h - dh, dw, dh);
  }

  _inRect(px, py, r) { return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h; }

  _flash(msg) { this.msg = msg; this.msgT = 1.6; Sound.serveBad(); }
  _float(x, y, txt, color = '#2B8A3E') {
    this.floats.push({ x, y, txt, color, life: 0, max: 1.3 });
  }

  // ── Acciones del juego (compartidas por el jugador y los trabajadores) ────
  _dropSeeds(L, n) {
    for (let i = 0; i < n && this.groundSeeds.length < MAX_GROUND_SEEDS; i++) {
      const z = L.seedZone;
      this.groundSeeds.push({
        x: L.bush.x + L.bush.r * 0.6,
        y: L.bush.y,
        tx: z.x + Math.random() * z.w,
        ty: z.y + z.h * 0.25 + Math.random() * z.h * 0.65,
        t: 0, wob: Math.random() * 6.28,
      });
    }
  }
  _collectSeed(i, silent = false) {
    this.groundSeeds.splice(i, 1);
    this.inv.seed++;
    if (!silent) Sound.pick();
  }
  _ingText(prod) {
    const P = this.cfg.products[prod];
    return Object.entries(P.ing)
      .map(([k, n]) => ING[k].word ? `${n} ${ING[k].word}` : `${n}${ING[k].emoji}`)
      .join(' + ');
  }
  _dropChocs(L, n) {
    for (let i = 0; i < n && this.chocs.length < MAX_GROUND_CHOCS; i++) {
      const z = L.chocZone;
      this.chocs.push({
        x: z.x + Math.random() * z.w,
        y: z.y + Math.random() * z.h,
        t: 0, wob: Math.random() * 6.28,
      });
    }
  }
  _dropStraws(L, n) {
    for (let i = 0; i < n && this.straws.length < MAX_GROUND_STRAWS; i++) {
      const z = L.strawZone;
      this.straws.push({
        x: z.x + Math.random() * z.w,
        y: z.y + Math.random() * z.h,
        t: 0, wob: Math.random() * 6.28,
      });
    }
  }
  _plant(pi) {
    this.inv.seed--;
    this.plots[pi] = { state: 'grow', t: 0 };
    Sound.add();
  }
  _harvest(pi, L) {
    this.plots[pi] = { state: 'empty', t: 0 };
    this.inv.wheat++;
    const r = L.plotRects[pi];
    this._float(r.x + r.w / 2, r.y, '+1 🌾');
    Sound.add();
  }
  _loadMill(L) {
    this.inv.wheat--;
    this.mill.busy = true; this.mill.t = 0;
    this._float(L.mill.x + L.mill.w / 2, L.mill.y, '🌾 moliendo…', '#8A6A20');
    Sound.pick();
  }
  _loadOven(L, prod = this.cfg.starter) {
    const P = this.cfg.products[prod];
    // descuenta exactamente la receta, sea cual sea el ingrediente
    for (const [k, n] of Object.entries(P.ing)) this.inv[k] -= n;
    this.oven.busy = true; this.oven.t = 0; this.oven.product = prod;
    this._float(L.oven.x + L.oven.w / 2, L.oven.y, `horneando ${P.name.toLowerCase()}…`, '#B05020');
    Sound.pick();
  }
  _sell(ci, L) {
    const c = this.customers[ci];
    const P = this.cfg.products[c.prod];
    this.inv[P.inv] -= c.want;
    const gain = c.want * (P.priceBase + Math.floor(Math.random() * P.priceVar));
    this.money += gain;
    addCoins(P.coins * c.want);
    c.leaving = true; c.happy = true;
    this._float(L.custXs[Math.min(ci, L.custXs.length - 1)], L.custY - 90 * L.s, `+$${gain}`, '#1E7A2E');
    Sound.serveGood();
    this._save();
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  // Los botones de la tienda responden al instante (son UI); todo lo demás
  // manda al personaje caminando hasta el objetivo y la acción se hace al llegar.
  _goTo(x, y, task = null) {
    const H = this.canvas.height;
    // no dejar que camine detrás de la barra de la tienda (y > 0.87H)
    this.dest = { x, y: Math.max(H * 0.24, Math.min(H * 0.865, y)) };
    this.task = task;
  }

  // ── Zoom con pinza (mobile) ────────────────────────────────────────────────
  // game.js manda los dos dedos en coordenadas del canvas. El mundo se escala
  // alrededor del centro del gesto y arrastrar los dedos panea; la tienda, el
  // HUD y los avisos quedan fijos en pantalla.
  pinchStart(a, b) {
    this._pinch = {
      d: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
      mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2,
      z0: this.cam.z,
    };
    this.dest = null; this.task = null;   // cancela el toque accidental del primer dedo
    this.player.isMoving = false;
  }

  pinchMove(a, b) {
    const p = this._pinch;
    if (!p) return;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const nz = Math.max(1, Math.min(2.5, p.z0 * (Math.hypot(b.x - a.x, b.y - a.y) / p.d)));
    // el punto del mundo bajo el centro del gesto sigue al gesto (zoom + paneo)
    const wx = (p.mx - this.cam.x) / this.cam.z;
    const wy = (p.my - this.cam.y) / this.cam.z;
    this.cam.z = nz;
    this.cam.x = mx - wx * nz;
    this.cam.y = my - wy * nz;
    p.mx = mx; p.my = my;
    this._clampCam();
  }

  pinchEnd() { this._pinch = null; }

  _clampCam() {
    const W = this.canvas.width, H = this.canvas.height, c = this.cam;
    // casi sin zoom → volver a la vista completa
    if (c.z <= 1.02) { c.z = 1; c.x = 0; c.y = 0; return; }
    // que nunca se vea más allá de los bordes del mapa
    c.x = Math.max(W * (1 - c.z), Math.min(0, c.x));
    c.y = Math.max(H * (1 - c.z), Math.min(0, c.y));
  }

  // Tienda (UI instantánea, sin caminar). Devuelve true si el toque cayó en
  // un botón; se llama con coordenadas de pantalla porque la barra no se
  // escala con el zoom.
  _shopPointer(px, py, L) {
    // los textos flotantes viven en el mundo: convertir el botón a esas coordenadas
    const fl = (b, txt) => this._float(
      (b.x + b.w / 2 - this.cam.x) / this.cam.z, (b.y - this.cam.y) / this.cam.z, txt);
    for (const b of L.shop) {
      if (!this._inRect(px, py, b)) continue;
      if (b.kind === 'field') {
        if (this.plots.length >= MAX_PLOTS) { this._flash('¡Ya tenés todos los campos!'); return true; }
        const price = this.cfg.fieldPrices[this.plots.length - 2];
        if (this.money < price) { this._flash('Te falta dinero 💰'); return true; }
        this.money -= price;
        this.plots.push({ state: 'empty', t: 0 });
        fl(b, '¡Nuevo campo!');
        Sound.serveGood();
        this._save();
      } else if (b.kind === 'source') {
        const src = b.src;
        if (this[src.key]) { this._flash(src.already); return true; }
        if (this.money < src.price) { this._flash('Te falta dinero 💰'); return true; }
        this.money -= src.price;
        this[src.key] = true;
        if (src.key === 'vaca') this.cowReadyT = 0;        // llega lista para ordeñar
        if (src.key === 'colmena') this.honeyReadyT = 0;   // llega con miel lista
        fl(b, typeof src.buy === 'function' ? src.buy(this) : src.buy);
        Sound.serveGood();
        this._save();
      } else if (b.kind === 'worker') {
        if (this.workers[b.worker.key]) { this._flash(`Ya tenés ${b.worker.name.toLowerCase()} ✓`); return true; }
        if (this.money < b.worker.price) { this._flash('Te falta dinero 💰'); return true; }
        this.money -= b.worker.price;
        this.workers[b.worker.key] = true;
        fl(b, `¡${b.worker.name} contratado!`);
        Sound.serveGood();
        this._save();
      } else {
        if (this.upgrades[b.upgrade.key]) { this._flash(`El ${b.upgrade.key} ya está mejorado ⭐`); return true; }
        if (this.money < b.upgrade.price) { this._flash('Te falta dinero 💰'); return true; }
        this.money -= b.upgrade.price;
        this.upgrades[b.upgrade.key] = true;
        fl(b, `¡${b.upgrade.name} mejorado! ⭐`);
        Sound.serveGood();
        this._save();
      }
      this._checkWin();   // ¿fue la última compra del nivel?
      return true;
    }
    return false;
  }

  pointer(px, py) {
    if (this._pinch) return;   // mientras se hace zoom no hay taps

    // durante el festejo solo responden los botones del overlay
    if (this.celebrate) {
      for (const b of this._celebrateRects()) {
        if (!this._inRect(px, py, b)) continue;
        if (b.action === 'switch') {
          this.opts.onSwitchLevel?.('pasteleria');
        } else {
          this.celebrate = null;
          Sound.pick();
        }
        return;
      }
      return;
    }

    const L = this._layout();
    const { s } = L;

    // la tienda es UI fija: se toca en coordenadas de pantalla, antes del zoom
    if (this._shopPointer(px, py, L)) return;

    // el resto del mapa se toca en coordenadas del mundo (deshace el zoom)
    px = (px - this.cam.x) / this.cam.z;
    py = (py - this.cam.y) / this.cam.z;

    // recetas al costado del horno: tocar una arranca la cocción directa
    for (const mb of L.ovenMenu) {
      if (!this._inRect(px, py, mb)) continue;
      if (this.oven.busy) { this._flash('El horno está ocupado 🔥'); return; }
      if (!this._canBake(mb.prod)) {
        this._flash(`Faltan ingredientes (${this._ingText(mb.prod)})`);
        return;
      }
      this._goTo(L.oven.x + L.oven.w / 2, L.oven.y + L.oven.h + 14 * s, { type: 'oven', product: mb.prod });
      return;
    }

    // semillas sueltas → ir a juntarla
    for (let i = this.groundSeeds.length - 1; i >= 0; i--) {
      const g = this.groundSeeds[i];
      const gx = g.t < 1 ? g.x + (g.tx - g.x) * g.t : g.tx;
      const gy = g.t < 1 ? g.y + (g.ty - g.y) * g.t : g.ty;
      if (Math.hypot(px - gx, py - gy) < 26 * s) {
        this._goTo(gx, gy + 8 * s, { type: 'seed', seed: g });
        return;
      }
    }

    // huevos del gallinero → ir a juntarlos
    for (let i = this.eggs.length - 1; i >= 0; i--) {
      const e = this.eggs[i];
      if (e.t < 1) continue;
      if (Math.hypot(px - e.x, py - e.y) < 24 * s) {
        this._goTo(e.x, e.y + 6 * s, { type: 'egg', egg: e });
        return;
      }
    }

    // chocolates del cacaotero → ir a juntarlos
    for (let i = this.chocs.length - 1; i >= 0; i--) {
      const c = this.chocs[i];
      if (c.t < 1) continue;
      if (Math.hypot(px - c.x, py - c.y) < 24 * s) {
        this._goTo(c.x, c.y + 6 * s, { type: 'choc', choc: c });
        return;
      }
    }

    // frutillas del frutillar → ir a juntarlas
    for (let i = this.straws.length - 1; i >= 0; i--) {
      const f = this.straws[i];
      if (f.t < 1) continue;
      if (Math.hypot(px - f.x, py - f.y) < 24 * s) {
        this._goTo(f.x, f.y + 6 * s, { type: 'straw', straw: f });
        return;
      }
    }

    // cacaotero → ir a sacudirlo
    if (this.cacao && Math.hypot(px - L.cacao.x, py - L.cacao.y) < L.cacao.r * 1.3) {
      this._goTo(L.cacao.x + L.cacao.r * 1.0, L.cacao.y + L.cacao.r * 1.15, { type: 'cacao' });
      return;
    }

    // frutillar → ir a sacudirlo
    if (this.frutillar && Math.hypot(px - L.frutillar.x, py - L.frutillar.y) < L.frutillar.r * 1.3) {
      this._goTo(L.frutillar.x + L.frutillar.r * 1.0, L.frutillar.y + L.frutillar.r * 1.15, { type: 'frutillar' });
      return;
    }

    // colmena → ir a cosechar la miel cuando está lista
    if (this.colmena && Math.hypot(px - L.colmena.x, py - L.colmena.y) < L.colmena.r * 1.4) {
      if (this.honeyReadyT > 0) { this._flash('Las abejas siguen trabajando 🐝'); return; }
      this._goTo(L.colmena.x + L.colmena.r * 1.2, L.colmena.y + L.colmena.r * 1.1, { type: 'colmena' });
      return;
    }

    // vaca → ir a ordeñarla cuando está lista
    if (this.vaca && Math.hypot(px - L.vaca.x, py - L.vaca.y) < L.vaca.r * 1.4) {
      if (this.cowReadyT > 0) { this._flash('La vaca todavía no tiene leche 🐄'); return; }
      this._goTo(L.vaca.x + L.vaca.r * 1.2, L.vaca.y + L.vaca.r * 0.9, { type: 'vaca' });
      return;
    }

    // arbusto → ir a sacudirlo
    if (Math.hypot(px - L.bush.x, py - L.bush.y) < L.bush.r * 1.25) {
      this._goTo(L.bush.x + L.bush.r * 1.1, L.bush.y + L.bush.r * 0.55, { type: 'bush' });
      return;
    }

    // campos → ir a plantar / cosechar
    for (let i = 0; i < this.plots.length; i++) {
      const r = L.plotRects[i];
      if (!this._inRect(px, py, r)) continue;
      const p = this.plots[i];
      if (p.state === 'empty' && this.inv.seed <= 0) { this._flash('Necesitás semillas 🌱'); return; }
      if (p.state === 'grow') return;   // todavía está creciendo
      this._goTo(r.x + r.w / 2, r.y + r.h + 12 * s, { type: 'plot', idx: i });
      return;
    }

    // molino → llevar el trigo
    if (this._inRect(px, py, L.mill)) {
      if (this.mill.busy) return;
      if (this.inv.wheat <= 0) { this._flash('No tenés trigo 🌾'); return; }
      this._goTo(L.mill.x + L.mill.w / 2, L.mill.y + L.mill.h + 14 * s, { type: 'mill' });
      return;
    }

    // horno → con un solo producto hornea el básico directo; si hay varios, señala las recetas
    if (this._inRect(px, py, L.oven)) {
      if (this.oven.busy) return;
      if (L.ovenMenu.length <= 1) {
        const st = this.cfg.starter;
        if (!this._canBake(st)) { this._flash(`Faltan ingredientes (${this._ingText(st)})`); return; }
        this._goTo(L.oven.x + L.oven.w / 2, L.oven.y + L.oven.h + 14 * s, { type: 'oven', product: st });
      } else {
        this._flash('Elegí una receta a la derecha ➡️');
      }
      return;
    }

    // clientes → llevar su producto al mostrador
    for (let i = 0; i < this.customers.length && i < 3; i++) {
      const c = this.customers[i];
      if (c.leaving) continue;
      const cx = L.custXs[i], cy = L.custY - 55 * s;
      if (Math.hypot(px - cx, py - cy) < 55 * s) {
        const P = this.cfg.products[c.prod];
        if (this.inv[P.inv] < c.want) { this._flash(`Falta ${P.name.toLowerCase()} ${P.emoji}`); return; }
        this._goTo(cx, L.counter.y + L.counter.h + 52 * s, { type: 'customer', cust: c });
        return;
      }
    }

    // pasto libre → caminar hasta ahí
    this._goTo(px, py, null);
  }

  // Ejecuta la acción pendiente cuando el personaje llega al destino,
  // revalidando el estado (un trabajador pudo habérsela adelantado).
  _doTask(L) {
    const task = this.task;
    this.task = null;
    if (!task) return;
    switch (task.type) {
      case 'bush': {
        if (this.bushCooldown > 0) return;
        this.bushCooldown = 0.35;
        this.bushShake = 0.4;
        this._dropSeeds(L, 1 + (Math.random() < 0.35 ? 1 : 0));
        Sound.undo();
        break;
      }
      case 'seed': {
        const i = this.groundSeeds.indexOf(task.seed);
        if (i < 0) return;                       // ya la juntó el granjero
        const g = this.groundSeeds[i];
        this._collectSeed(i);
        this._float(g.tx, g.ty, '+1 🌱');
        break;
      }
      case 'egg': {
        const i = this.eggs.indexOf(task.egg);
        if (i < 0) return;                       // ya lo juntó el granjero
        this.eggs.splice(i, 1);
        this.inv.egg++;
        this._float(task.egg.x, task.egg.y, '+1 🥚');
        Sound.pick();
        break;
      }
      case 'choc': {
        const i = this.chocs.indexOf(task.choc);
        if (i < 0) return;                       // ya lo juntó el granjero
        this.chocs.splice(i, 1);
        this.inv.choc++;
        this._float(task.choc.x, task.choc.y, '+1 🍫');
        Sound.pick();
        break;
      }
      case 'cacao': {
        if (this.cacaoCooldown > 0) return;
        this.cacaoCooldown = 0.35;
        this.cacaoShake = 0.4;
        this._dropChocs(L, 1 + (Math.random() < 0.3 ? 1 : 0));
        Sound.undo();
        break;
      }
      case 'straw': {
        const i = this.straws.indexOf(task.straw);
        if (i < 0) return;                       // ya la juntó el granjero
        this.straws.splice(i, 1);
        this.inv.straw++;
        this._float(task.straw.x, task.straw.y, '+1 🍓');
        Sound.pick();
        break;
      }
      case 'frutillar': {
        if (this.frutCooldown > 0) return;
        this.frutCooldown = 0.35;
        this.frutShake = 0.4;
        this._dropStraws(L, 1 + (Math.random() < 0.3 ? 1 : 0));
        Sound.undo();
        break;
      }
      case 'colmena': {
        if (this.honeyReadyT > 0) return;        // se le adelantó el granjero
        this.honeyReadyT = HONEY_COOLDOWN;
        this.inv.honey++;
        this._float(L.colmena.x, L.colmena.y - L.colmena.r, '+1 🍯');
        Sound.pick();
        break;
      }
      case 'vaca': {
        if (this.cowReadyT > 0) return;          // se le adelantó el granjero
        this.cowReadyT = COW_MILK_COOLDOWN;
        this.inv.milk++;
        this._float(L.vaca.x, L.vaca.y - L.vaca.r, '+1 🥛');
        Sound.pick();
        break;
      }
      case 'plot': {
        const p = this.plots[task.idx];
        if (!p) return;
        if (p.state === 'ready') this._harvest(task.idx, L);
        else if (p.state === 'empty' && this.inv.seed > 0) this._plant(task.idx);
        break;
      }
      case 'mill': {
        if (!this.mill.busy && this.inv.wheat > 0) this._loadMill(L);
        break;
      }
      case 'oven': {
        const prod = task.product || this.cfg.starter;
        if (!this.oven.busy && this._canBake(prod)) this._loadOven(L, prod);
        break;
      }
      case 'customer': {
        const i = this.customers.indexOf(task.cust);
        if (i < 0 || task.cust.leaving) return;  // se fue o ya lo atendieron
        const P = this.cfg.products[task.cust.prod];
        if (this.inv[P.inv] >= task.cust.want) {
          this._sell(i, L);
          this.player.playGesture('jump');
        } else this._flash(`Falta ${P.name.toLowerCase()} ${P.emoji}`);
        break;
      }
    }
  }

  // ── Update ─────────────────────────────────────────────────────────────────
  update(dt) {
    this.t += dt;

    // durante el festejo el juego queda pausado (los clientes no se van
    // detrás del overlay); solo cae el confetti
    if (this.celebrate) {
      const W = this.canvas.width, H = this.canvas.height;
      this.celebrate.t += dt;
      for (const c of this.celebrate.confetti) {
        c.x += c.vx * dt; c.y += c.vy * dt; c.rot += c.vr * dt;
        if (c.y > H + 12) { c.y = -12; c.x = Math.random() * W; }
      }
      return;
    }

    const L = this._layout();

    if (this.msgT > 0) this.msgT -= dt;
    if (this.bushShake > 0) this.bushShake -= dt;
    if (this.bushCooldown > 0) this.bushCooldown -= dt;
    if (this.cacaoShake > 0) this.cacaoShake -= dt;
    if (this.cacaoCooldown > 0) this.cacaoCooldown -= dt;
    if (this.frutShake > 0) this.frutShake -= dt;
    if (this.frutCooldown > 0) this.frutCooldown -= dt;

    // ── personaje: caminar hasta el destino y hacer la acción al llegar ──
    if (this.dest) {
      const dx = this.dest.x - this.player.x, dy = this.dest.y - this.player.y;
      const dist = Math.hypot(dx, dy);
      const speed = 330 * L.s;
      if (dist <= Math.max(6, speed * dt)) {
        this.player.x = this.dest.x; this.player.y = this.dest.y;
        this.player.isMoving = false;
        this.dest = null;
        this._doTask(L);
      } else {
        this.player.x += (dx / dist) * speed * dt;
        this.player.y += (dy / dist) * speed * dt;
        this.player.isMoving = true;
        if (Math.abs(dx) > 2) this.player.facingDir = dx < 0 ? -1 : 1;
      }
    } else {
      this.player.isMoving = false;
    }
    this.player.update(dt);

    // el arbusto suelta semillas solo, despacito
    this.seedAutoT -= dt;
    if (this.seedAutoT <= 0) {
      this.seedAutoT = 5 + Math.random() * 4;
      this._dropSeeds(L, 1);
    }
    for (const g of this.groundSeeds) { g.t = Math.min(1, g.t + dt * 2.2); g.wob += dt * 3; }

    // el gallinero pone huevos cada tanto
    if (this.coop) {
      this.eggSpawnT -= dt;
      if (this.eggSpawnT <= 0 && this.eggs.length < MAX_GROUND_EGGS) {
        this.eggSpawnT = 7 + Math.random() * 4;
        const cp = L.coop;
        this.eggs.push({
          x: cp.x - 14 * L.s + Math.random() * (cp.w + 28 * L.s),
          y: cp.y + cp.h + 4 * L.s + Math.random() * 14 * L.s,
          t: 0, wob: Math.random() * 6.28,
        });
      }
      for (const e of this.eggs) { e.t = Math.min(1, e.t + dt * 3); e.wob += dt * 3; }
    }

    // la vaca recarga leche con el tiempo
    if (this.vaca && this.cowReadyT > 0) this.cowReadyT -= dt;

    // el cacaotero suelta chocolates cada tanto
    if (this.cacao) {
      this.chocSpawnT -= dt;
      if (this.chocSpawnT <= 0 && this.chocs.length < MAX_GROUND_CHOCS) {
        this.chocSpawnT = 8 + Math.random() * 5;
        this._dropChocs(L, 1);
      }
      for (const c of this.chocs) { c.t = Math.min(1, c.t + dt * 3); c.wob += dt * 3; }
    }

    // la colmena junta miel con el tiempo (como la leche de la vaca)
    if (this.colmena && this.honeyReadyT > 0) this.honeyReadyT -= dt;

    // el frutillar suelta frutillas cada tanto (como el cacaotero)
    if (this.frutillar) {
      this.strawSpawnT -= dt;
      if (this.strawSpawnT <= 0 && this.straws.length < MAX_GROUND_STRAWS) {
        this.strawSpawnT = 8 + Math.random() * 5;
        this._dropStraws(L, 1);
      }
      for (const f of this.straws) { f.t = Math.min(1, f.t + dt * 3); f.wob += dt * 3; }
    }

    // crecimiento del trigo
    for (const p of this.plots) {
      if (p.state === 'grow') {
        p.t += dt;
        if (p.t >= GROW_TIME) { p.state = 'ready'; p.t = 0; }
      } else if (p.state === 'ready') {
        p.t += dt;
      }
    }

    // molino
    this.millAngle += dt * (this.mill.busy ? (this.upgrades.molino ? 5.5 : 3.2) : 0.45);
    if (this.mill.busy) {
      this.mill.t += dt;
      if (this.mill.t >= this._millDur()) {
        this.mill.busy = false;
        this.inv.flour++;
        this._float(L.mill.x + L.mill.w / 2, L.mill.y, '+1 harina', '#8A6A20');
        Sound.add();
      }
    }

    // horno
    if (this.oven.busy) {
      this.oven.t += dt;
      const prod = this.oven.product || this.cfg.starter;
      if (this.oven.t >= this._ovenDur(prod)) {
        this.oven.busy = false;
        const P = this.cfg.products[prod];
        this.inv[P.inv]++;
        this._float(L.oven.x + L.oven.w / 2, L.oven.y, `+1 ${P.emoji}`, '#B05020');
        Sound.add();
      }
    }

    // clientes — piden más a medida que el negocio crece
    // (con granjero y molinero contratados los pedidos llegan a ×3 y ×4)
    this.custSpawnT -= dt;
    if (this.custSpawnT <= 0 && this.customers.length < 3) {
      this.custSpawnT = 7 + Math.random() * 5;
      // los productos desbloqueados entran al pedido (el básico pesa doble)
      const st = this.cfg.starter;
      const pool = [st];
      for (const key of Object.keys(this.cfg.products)) {
        if (this._unlocked(key)) pool.push(key);
      }
      const prod = pool[Math.floor(Math.random() * pool.length)];
      const tm = this.cfg.products[prod].timeMul;
      let want;
      if (tm >= 2) {
        // los productos lentos (torta, tarta) se piden de a poco
        want = 1 + (this.workers.granjero && this.workers.molinero && Math.random() < 0.4 ? 1 : 0);
      } else if (prod !== st) {
        want = 1 + Math.floor(Math.random() * (this.workers.granjero && this.workers.molinero ? 3 : 2));
      } else {
        const maxWant = Math.min(4, 2 + (this.workers.granjero ? 1 : 0) + (this.workers.molinero ? 1 : 0));
        want = 1 + Math.floor(Math.random() * maxWant);
      }
      const pat = (prod === st ? 26 : 34) + want * 5;
      this.customers.push({
        prod, want, patience: pat, maxPatience: pat,
        seed: Math.floor(Math.random() * 1000),
        appear: 0, leaving: false, happy: false, gone: 0,
      });
    }
    for (let i = this.customers.length - 1; i >= 0; i--) {
      const c = this.customers[i];
      c.appear = Math.min(1, c.appear + dt * 2.5);
      if (c.leaving) {
        c.gone += dt;
        if (c.gone > 0.8) this.customers.splice(i, 1);
        continue;
      }
      c.patience -= dt;
      if (c.patience <= 0) {
        c.leaving = true; c.happy = false;
        this._float(L.custXs[Math.min(i, 2)], L.custY - 90 * L.s, 'se fue 😢', '#D7263D');
        Sound.timeout();
      }
    }

    // ── trabajadores ──
    // El granjero camina de verdad: va hasta las semillas para juntarlas y
    // hasta los campos para plantar y cosechar.
    if (this.workers.granjero) {
      const f = this.farmer;
      if (!f.seeded) {
        f.x = L.bush.x + L.bush.r * 1.8;
        f.y = L.bush.y + L.bush.r * 0.95;
        f.seeded = true;
      }
      if (f.pauseT > 0) {
        f.pauseT -= dt;
      } else if (!f.dest) {
        // elegir tarea: cosechar > plantar > juntar semillas > huevos > chocolates > frutillas
        const ri = this.plots.findIndex(p => p.state === 'ready');
        const ei = this.plots.findIndex(p => p.state === 'empty');
        const gi = this.groundSeeds.findIndex(g => g.t >= 1);
        const eg = this.eggs.findIndex(e => e.t >= 1);
        const ch = this.chocs.findIndex(c => c.t >= 1);
        const fr = this.straws.findIndex(f => f.t >= 1);
        if (ri >= 0) {
          const r = L.plotRects[ri];
          f.task = { type: 'harvest', idx: ri };
          f.dest = { x: r.x + r.w / 2, y: r.y + r.h + 10 * L.s };
        } else if (ei >= 0 && this.inv.seed > 0) {
          const r = L.plotRects[ei];
          f.task = { type: 'plant', idx: ei };
          f.dest = { x: r.x + r.w / 2, y: r.y + r.h + 10 * L.s };
        } else if (gi >= 0) {
          const g = this.groundSeeds[gi];
          f.task = { type: 'seed', seed: g };
          f.dest = { x: g.tx, y: g.ty + 6 * L.s };
        } else if (eg >= 0) {
          const e = this.eggs[eg];
          f.task = { type: 'egg', egg: e };
          f.dest = { x: e.x, y: e.y + 6 * L.s };
        } else if (ch >= 0) {
          const c = this.chocs[ch];
          f.task = { type: 'choc', choc: c };
          f.dest = { x: c.x, y: c.y + 6 * L.s };
        } else if (fr >= 0) {
          const f2 = this.straws[fr];
          f.task = { type: 'straw', straw: f2 };
          f.dest = { x: f2.x, y: f2.y + 6 * L.s };
        } else if (this.vaca && this.cowReadyT <= 0) {
          f.task = { type: 'vaca' };
          f.dest = { x: L.vaca.x + L.vaca.r * 1.2, y: L.vaca.y + L.vaca.r * 0.9 };
        } else if (this.colmena && this.honeyReadyT <= 0) {
          f.task = { type: 'colmena' };
          f.dest = { x: L.colmena.x + L.colmena.r * 1.2, y: L.colmena.y + L.colmena.r * 1.1 };
        }
      } else {
        const dx = f.dest.x - f.x, dy = f.dest.y - f.y;
        const dist = Math.hypot(dx, dy);
        const spd = 240 * L.s;
        if (Math.abs(dx) > 2) f.facing = dx < 0 ? -1 : 1;
        if (dist <= Math.max(5, spd * dt)) {
          f.x = f.dest.x; f.y = f.dest.y;
          f.dest = null;
          const task = f.task;
          f.task = null;
          f.pauseT = 0.5;
          if (task) {
            if (task.type === 'harvest' && this.plots[task.idx]?.state === 'ready') this._harvest(task.idx, L);
            else if (task.type === 'plant' && this.plots[task.idx]?.state === 'empty' && this.inv.seed > 0) this._plant(task.idx);
            else if (task.type === 'seed') {
              const i = this.groundSeeds.indexOf(task.seed);
              if (i >= 0) { this._collectSeed(i, true); this._float(f.x, f.y - 40 * L.s, '+1 🌱'); }
            }
            else if (task.type === 'egg') {
              const i = this.eggs.indexOf(task.egg);
              if (i >= 0) { this.eggs.splice(i, 1); this.inv.egg++; this._float(f.x, f.y - 40 * L.s, '+1 🥚'); }
            }
            else if (task.type === 'choc') {
              const i = this.chocs.indexOf(task.choc);
              if (i >= 0) { this.chocs.splice(i, 1); this.inv.choc++; this._float(f.x, f.y - 40 * L.s, '+1 🍫'); }
            }
            else if (task.type === 'straw') {
              const i = this.straws.indexOf(task.straw);
              if (i >= 0) { this.straws.splice(i, 1); this.inv.straw++; this._float(f.x, f.y - 40 * L.s, '+1 🍓'); }
            }
            else if (task.type === 'vaca') {
              if (this.cowReadyT <= 0) {
                this.cowReadyT = COW_MILK_COOLDOWN;
                this.inv.milk++;
                this._float(f.x, f.y - 40 * L.s, '+1 🥛');
              }
            }
            else if (task.type === 'colmena') {
              if (this.honeyReadyT <= 0) {
                this.honeyReadyT = HONEY_COOLDOWN;
                this.inv.honey++;
                this._float(f.x, f.y - 40 * L.s, '+1 🍯');
              }
            }
          }
        } else {
          f.x += (dx / dist) * spd * dt;
          f.y += (dy / dist) * spd * dt;
        }
      }
    }
    if (this.workers.molinero && !this.mill.busy && this.inv.wheat > 0) {
      this.workerT.molinero -= dt;
      if (this.workerT.molinero <= 0) { this.workerT.molinero = 0.9; this._loadMill(L); }
    }
    if (this.workers.panadero && !this.oven.busy) {
      this.workerT.panadero -= dt;
      if (this.workerT.panadero <= 0) {
        this.workerT.panadero = 0.9;
        // prioriza el producto que espera algún cliente y todavía no está en stock
        const st = this.cfg.starter;
        const wanted = Object.keys(this.cfg.products).filter(pr => pr !== st).find(pr =>
          this.customers.some(c => !c.leaving && c.prod === pr && this.inv[this.cfg.products[pr].inv] < c.want) && this._canBake(pr));
        if (wanted) this._loadOven(L, wanted);
        else if (this._canBake(st)) this._loadOven(L, st);
      }
    }
    if (this.workers.vendedor) {
      this.workerT.vendedor -= dt;
      if (this.workerT.vendedor <= 0) {
        this.workerT.vendedor = 1.3;
        const i = this.customers.findIndex(c => !c.leaving && this.inv[this.cfg.products[c.prod].inv] >= c.want);
        if (i >= 0) this._sell(i, L);
      }
    }

    // textos flotantes
    for (const f of this.floats) { f.life += dt; f.y -= 34 * dt; }
    this.floats = this.floats.filter(f => f.life < f.max);

    // autosave
    this.saveT -= dt;
    if (this.saveT <= 0) { this.saveT = 4; this._save(); }
  }

  // ── Hint contextual para guiar el circuito completo ────────────────────────
  _hint() {
    if (this.inv.seed === 0 && this.groundSeeds.length === 0 &&
        this.plots.every(p => p.state === 'empty')) return 'Tocá el arbusto y juntá semillas 🌱';
    if (this.groundSeeds.length > 0 && this.inv.seed === 0) return 'Tocá las semillas para juntarlas 🌱';
    if (this.inv.seed > 0 && this.plots.some(p => p.state === 'empty')) return 'Tocá un campo marrón para plantar 🌱';
    if (this.plots.some(p => p.state === 'ready')) return '¡Trigo listo! Tocalo para cosechar 🌾';
    if (this.coop && this.eggs.some(e => e.t >= 1) && this.inv.egg === 0) return 'Juntá los huevos del gallinero 🥚';
    if (this.cacao && this.chocs.some(c => c.t >= 1) && this.inv.choc === 0) return 'Juntá los chocolates del cacaotero 🍫';
    if (this.vaca && this.cowReadyT <= 0 && this.inv.milk === 0) return 'La vaca está lista, ¡ordeñala! 🥛';
    if (this.colmena && this.honeyReadyT <= 0 && this.inv.honey === 0) return '¡La colmena tiene miel lista! 🍯';
    if (this.frutillar && this.straws.some(f => f.t >= 1) && this.inv.straw === 0) return 'Juntá las frutillas 🍓';
    if (this.inv.wheat > 0 && !this.mill.busy) return 'Llevá el trigo al molino ⚙️';
    if (this.inv.flour > 0 && !this.oven.busy) return 'Horneá la harina en el horno 🔥';
    if (this.customers.some(c => !c.leaving && this.inv[this.cfg.products[c.prod].inv] >= c.want)) return '¡Tocá al cliente para entregar su pedido! 🧺';
    return '';
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  render(ctx) {
    const L = this._layout(), { W, H, s } = L;

    // el mundo se dibuja con la cámara del zoom; la UI va fija encima
    ctx.save();
    ctx.translate(this.cam.x, this.cam.y);
    ctx.scale(this.cam.z, this.cam.z);

    this._drawBackground(ctx, L);
    this._drawFields(ctx, L);
    this._drawBush(ctx, L);
    this._drawSeeds(ctx, L);
    this._drawCoop(ctx, L);
    this._drawCacao(ctx, L);
    this._drawVaca(ctx, L);
    this._drawColmena(ctx, L);
    this._drawFrutillar(ctx, L);
    this._drawFarmer(ctx, L);
    this._drawMill(ctx, L);
    this._drawBakery(ctx, L);
    this._drawOvenMenu(ctx, L);
    this._drawPlayer(ctx, L);

    // textos flotantes (viven en coordenadas del mundo)
    for (const f of this.floats) {
      ctx.globalAlpha = Math.max(0, 1 - f.life / f.max);
      ctx.fillStyle = f.color;
      ctx.font = `900 ${20 * s}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(f.txt, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // UI fija en pantalla (no se escala con el zoom)
    this._drawShop(ctx, L);
    this._drawHUD(ctx, L);

    // mensaje de error / aviso
    if (this.msgT > 0) {
      ctx.globalAlpha = Math.min(1, this.msgT * 2);
      ctx.fillStyle = '#D7263D';
      ctx.font = `900 ${26 * s}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(this.msg, W / 2, H * 0.155);
      ctx.globalAlpha = 1;
    } else {
      const hint = this._hint();
      if (hint) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = `bold ${16 * s}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        const tw = ctx.measureText(hint).width;
        ctx.beginPath(); ctx.roundRect(W / 2 - tw / 2 - 12 * s, H * 0.125, tw + 24 * s, 26 * s, 13 * s); ctx.fill();
        ctx.fillStyle = '#6A4A20';
        ctx.fillText(hint, W / 2, H * 0.125 + 18 * s);
      }
    }

    // festejo por completar el nivel (encima de todo)
    if (this.celebrate) this._drawCelebrate(ctx, L);
  }

  // botones del overlay de festejo (en coordenadas de pantalla)
  _celebrateRects() {
    const W = this.canvas.width, H = this.canvas.height;
    const canSwitch = this.cfg.key === 'panaderia' && this.opts.onSwitchLevel;
    const btns = canSwitch
      ? [{ action: 'switch', label: '🧁 ¡Ir a la Pastelería!' }, { action: 'stay', label: '🍞 Seguir acá' }]
      : [{ action: 'stay', label: '🎈 ¡Seguir jugando!' }];
    const bw = Math.min(W * 0.56, 480), bh = H * 0.115, gap = H * 0.04;
    let y = H * 0.52;
    return btns.map(b => { const r = { ...b, x: W / 2 - bw / 2, y, w: bw, h: bh }; y += bh + gap; return r; });
  }

  _drawCelebrate(ctx, L) {
    const { W, H, s } = L;
    ctx.fillStyle = 'rgba(30,10,25,0.68)';
    ctx.fillRect(0, 0, W, H);

    // confetti
    for (const c of this.celebrate.confetti) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.fillStyle = c.color;
      ctx.fillRect(-c.r * s, -c.r * s * 0.6, c.r * 2 * s, c.r * 1.2 * s);
      ctx.restore();
    }

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const isL1 = this.cfg.key === 'panaderia';
    ctx.fillStyle = '#FFD84A';
    ctx.font = `900 ${Math.min(H * 0.075, W * 0.052)}px system-ui, sans-serif`;
    ctx.fillText(isL1 ? '🎉 ¡Completaste la Panadería!' : '🏆 ¡Completaste TODO!', W / 2, H * 0.26);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.min(H * 0.042, W * 0.03)}px system-ui, sans-serif`;
    ctx.fillText(isL1 ? '¡Compraste todo! Se desbloqueó la Pastelería 🧁' : '¡Sos genial! Tu pastelería tiene todo ⭐', W / 2, H * 0.37);
    if (isL1) {
      ctx.fillText('¿Querés pasar al siguiente nivel?', W / 2, H * 0.44);
    }

    for (const b of this._celebrateRects()) {
      ctx.fillStyle = b.action === 'switch' ? '#FF6B9C' : '#7ED957';
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3 * s;
      ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 18 * s); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = `900 ${Math.min(24 * s, b.h * 0.42)}px system-ui, sans-serif`;
      ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1 * s);
    }
    ctx.textBaseline = 'alphabetic';
  }

  _drawBackground(ctx, L) {
    const { W, H, s } = L;
    const pal = this.cfg.palette;
    const skyH = H * 0.16;
    const sky = ctx.createLinearGradient(0, 0, 0, skyH);
    sky.addColorStop(0, pal.sky0); sky.addColorStop(1, pal.sky1);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, skyH);

    // sol
    ctx.fillStyle = '#FFE27A';
    ctx.beginPath(); ctx.arc(W * 0.06, skyH * 0.55, 26 * s, 0, Math.PI * 2); ctx.fill();

    // nubes
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (const [nx, ny, nr] of [[0.3, 0.4, 16], [0.34, 0.5, 20], [0.38, 0.42, 15], [0.62, 0.55, 14], [0.66, 0.45, 18]]) {
      ctx.beginPath(); ctx.arc(W * nx + Math.sin(this.t * 0.15) * 12 * s, skyH * ny, nr * s, 0, Math.PI * 2); ctx.fill();
    }

    // pasto
    const grass = ctx.createLinearGradient(0, skyH, 0, H);
    grass.addColorStop(0, pal.grass0); grass.addColorStop(1, pal.grass1);
    ctx.fillStyle = grass; ctx.fillRect(0, skyH, W, H - skyH);

    // caminito de tierra: campos → molino → panadería
    ctx.strokeStyle = pal.path; ctx.lineWidth = 22 * s; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(W * 0.43, H * 0.50);
    ctx.quadraticCurveTo(W * 0.48, H * 0.60, W * 0.575, H * 0.62);
    ctx.quadraticCurveTo(W * 0.66, H * 0.64, W * 0.72, H * 0.58);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // cartel del juego
    ctx.fillStyle = '#fff'; ctx.strokeStyle = pal.sign; ctx.lineWidth = 3.5 * s;
    ctx.beginPath(); ctx.roundRect(W / 2 - 130 * s, 8 * s, 260 * s, 40 * s, 12 * s); ctx.fill(); ctx.stroke();
    ctx.fillStyle = pal.signText; ctx.font = `900 ${23 * s}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(this.cfg.title, W / 2, 29 * s);
    ctx.textBaseline = 'alphabetic';
  }

  _drawFields(ctx, L) {
    const { s } = L;
    ctx.textBaseline = 'alphabetic';
    for (let i = 0; i < MAX_PLOTS; i++) {
      const r = L.plotRects[i];
      if (i >= this.plots.length) {
        // lote todavía no comprado
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = '#7A5A30'; ctx.lineWidth = 2 * s; ctx.setLineDash([7 * s, 6 * s]);
        ctx.strokeRect(r.x, r.y, r.w, r.h);
        ctx.setLineDash([]);
        ctx.fillStyle = '#5A4020'; ctx.font = `900 ${22 * s}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('🔒', r.x + r.w / 2, r.y + r.h / 2 + 8 * s);
        ctx.globalAlpha = 1;
        continue;
      }
      const p = this.plots[i];
      // tierra con surcos
      ctx.fillStyle = '#9A6B3B';
      ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 6 * s); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 2 * s;
      for (let k = 1; k < 4; k++) {
        ctx.beginPath(); ctx.moveTo(r.x + 5 * s, r.y + (r.h * k) / 4); ctx.lineTo(r.x + r.w - 5 * s, r.y + (r.h * k) / 4); ctx.stroke();
      }
      ctx.strokeStyle = '#7A5228'; ctx.lineWidth = 2.5 * s;
      ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 6 * s); ctx.stroke();

      if (p.state === 'grow') {
        const frac = p.t / GROW_TIME;
        const stage = frac < 0.5 ? 0 : 1;
        if (ready(IMG.trigo[stage])) {
          const grow = 0.72 + 0.28 * Math.min(1, (frac - stage * 0.5) * 2 + 0.35);
          const boxH = (r.h - 16 * s) * (stage === 0 ? 0.58 : 0.9) * grow;
          this._imgFit(ctx, IMG.trigo[stage], r.x + 6 * s, r.y + r.h - 12 * s - boxH, r.w - 12 * s, boxH);
        } else {
          this._drawWheatRows(ctx, r, frac, s);
        }
        // barrita de progreso
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath(); ctx.roundRect(r.x + 6 * s, r.y + r.h - 10 * s, r.w - 12 * s, 6 * s, 3 * s); ctx.fill();
        ctx.fillStyle = '#8FE36B';
        ctx.beginPath(); ctx.roundRect(r.x + 6 * s, r.y + r.h - 10 * s, (r.w - 12 * s) * frac, 6 * s, 3 * s); ctx.fill();
      } else if (p.state === 'ready') {
        if (ready(IMG.trigo[2])) {
          const sway = Math.sin(p.t * 3) * 1.5 * s;
          this._imgFit(ctx, IMG.trigo[2], r.x + 4 * s + sway, r.y + 4 * s, r.w - 8 * s, r.h - 10 * s);
        } else {
          this._drawWheatRows(ctx, r, 1, s, true);
        }
        // brillito de "listo"
        const pulse = 0.5 + Math.sin(p.t * 5) * 0.5;
        ctx.strokeStyle = `rgba(255,235,110,${0.35 + pulse * 0.5})`;
        ctx.lineWidth = 4 * s;
        ctx.beginPath(); ctx.roundRect(r.x - 2 * s, r.y - 2 * s, r.w + 4 * s, r.h + 4 * s, 8 * s); ctx.stroke();
      }
    }
  }

  _drawWheatRows(ctx, r, frac, s, ready = false) {
    const stalkH = (r.h * 0.55) * (0.25 + frac * 0.75);
    const col = frac < 0.55 ? '#5FAE4A' : ready ? '#E8C04A' : '#B8B84E';
    ctx.strokeStyle = col; ctx.lineWidth = 2.5 * s;
    for (let row = 0; row < 2; row++) {
      const baseY = r.y + r.h * (row === 0 ? 0.45 : 0.85);
      for (let k = 0; k < 5; k++) {
        const x = r.x + r.w * (0.14 + k * 0.18);
        const sway = Math.sin(this.t * 2 + x * 0.05 + row) * 2 * s * frac;
        ctx.beginPath();
        ctx.moveTo(x, baseY);
        ctx.quadraticCurveTo(x + sway, baseY - stalkH * 0.6, x + sway, baseY - stalkH);
        ctx.stroke();
        if (frac > 0.5) {
          // espiga
          ctx.fillStyle = ready ? '#F2CE5A' : '#C8C860';
          ctx.beginPath();
          ctx.ellipse(x + sway, baseY - stalkH, 3.2 * s, 7 * s * Math.min(1, (frac - 0.5) * 2 + 0.3), 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  _drawBush(ctx, L) {
    const { s } = L;
    const b = L.bush;
    const shake = this.bushShake > 0 ? Math.sin(this.t * 40) * 4 * s : 0;
    if (ready(IMG.arbusto)) {
      this._imgH(ctx, IMG.arbusto, b.x + shake, b.y + b.r, b.r * 2.15);
    } else {
      // tronquito
      ctx.fillStyle = '#8A5A30';
      ctx.fillRect(b.x - 5 * s, b.y + b.r * 0.3, 10 * s, b.r * 0.55);
      // follaje
      for (const [dx, dy, rr] of [[-0.45, 0.05, 0.62], [0.45, 0.05, 0.62], [0, -0.35, 0.72], [0, 0.15, 0.8]]) {
        ctx.fillStyle = '#4E9048';
        ctx.beginPath(); ctx.arc(b.x + dx * b.r + shake, b.y + dy * b.r, b.r * rr, 0, Math.PI * 2); ctx.fill();
      }
      // espiguitas doradas asomando (para que se entienda que da semillas)
      ctx.fillStyle = '#F2CE5A';
      for (const [dx, dy] of [[-0.4, -0.4], [0.15, -0.65], [0.5, -0.25], [-0.05, -0.1]]) {
        ctx.beginPath(); ctx.ellipse(b.x + dx * b.r + shake, b.y + dy * b.r, 4 * s, 8 * s, 0.4, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.fillStyle = '#3A5A20'; ctx.font = `bold ${13 * s}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Semillas', b.x, b.y + b.r + 18 * s);

  }

  // gallinero comprado: casita con gallina que pone huevos alrededor
  _drawCoop(ctx, L) {
    if (!this.coop) return;
    const { s } = L;
    const c = L.coop;
    if (ready(IMG.gallinero)) {
      this._imgH(ctx, IMG.gallinero, c.x + c.w / 2, c.y + c.h, c.h * 1.12);
    } else {
      // casita
      ctx.fillStyle = '#C98A5A';
      ctx.beginPath(); ctx.roundRect(c.x, c.y + c.h * 0.32, c.w, c.h * 0.68, 5 * s); ctx.fill();
      ctx.strokeStyle = '#8A5A30'; ctx.lineWidth = 2 * s; ctx.stroke();
      // tablones
      ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1.5 * s;
      for (let k = 1; k < 4; k++) {
        const lx = c.x + (c.w * k) / 4;
        ctx.beginPath(); ctx.moveTo(lx, c.y + c.h * 0.35); ctx.lineTo(lx, c.y + c.h * 0.97); ctx.stroke();
      }
      // techo
      ctx.fillStyle = '#B0563A';
      ctx.beginPath();
      ctx.moveTo(c.x - 6 * s, c.y + c.h * 0.35);
      ctx.lineTo(c.x + c.w / 2, c.y - c.h * 0.08);
      ctx.lineTo(c.x + c.w + 6 * s, c.y + c.h * 0.35);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#7A3A24'; ctx.stroke();
      // puertita oscura
      ctx.fillStyle = '#4A2A14';
      ctx.beginPath(); ctx.arc(c.x + c.w / 2, c.y + c.h * 0.78, c.w * 0.2, Math.PI, 0);
      ctx.lineTo(c.x + c.w / 2 + c.w * 0.2, c.y + c.h); ctx.lineTo(c.x + c.w / 2 - c.w * 0.2, c.y + c.h);
      ctx.closePath(); ctx.fill();
    }
    // gallina al lado, con un saltito de vez en cuando
    const hop = Math.abs(Math.sin(this.t * 2.2)) < 0.12 ? 3 * s : 0;
    if (ready(IMG.gallina)) {
      this._imgH(ctx, IMG.gallina, c.x + c.w + 16 * s, c.y + c.h - hop, 34 * s);
    } else {
      ctx.font = `${24 * s}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🐔', c.x + c.w + 12 * s, c.y + c.h * 0.82 - hop);
      ctx.textBaseline = 'alphabetic';
    }
    ctx.fillStyle = '#5A4020'; ctx.font = `bold ${12 * s}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Gallinero', c.x + c.w / 2, c.y + c.h + 15 * s);

    // huevos en el piso
    for (const e of this.eggs) {
      const pop = Math.min(1, e.t);
      const bob = e.t >= 1 ? Math.sin(e.wob) * 1.5 * s : 0;
      if (ready(IMG.huevo)) {
        drawIconImg(ctx, IMG.huevo, e.x, e.y + bob, 17 * s * pop);
      } else {
        ctx.fillStyle = '#FFF8EC';
        ctx.strokeStyle = '#C8B890'; ctx.lineWidth = 1.5 * s;
        ctx.beginPath(); ctx.ellipse(e.x, e.y + bob, 6.5 * s * pop, 8.5 * s * pop, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      }
      if (e.t >= 1) {
        ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.5 * s;
        ctx.beginPath(); ctx.arc(e.x, e.y + bob, 12 * s + Math.sin(this.t * 4 + e.wob) * 2 * s, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }

  // cacaotero comprado: árbol con chocolates que caen alrededor
  _drawCacao(ctx, L) {
    if (!this.cacao) return;
    const { s } = L;
    const c = L.cacao;
    const shake = this.cacaoShake > 0 ? Math.sin(this.t * 40) * 4 * s : 0;
    if (ready(IMG.cacaotero)) {
      this._imgH(ctx, IMG.cacaotero, c.x + shake, c.y + c.r * 1.45, c.r * 2.9);
    } else {
      // tronco
      ctx.fillStyle = '#8A5A30';
      ctx.fillRect(c.x - 5 * s, c.y + c.r * 0.4, 10 * s, c.r * 0.85);
      // copa
      for (const [dx, dy, rr] of [[-0.45, 0.0, 0.6], [0.45, 0.0, 0.6], [0, -0.4, 0.7], [0, 0.1, 0.75]]) {
        ctx.fillStyle = '#5A8A3C';
        ctx.beginPath(); ctx.arc(c.x + dx * c.r + shake, c.y + dy * c.r, c.r * rr, 0, Math.PI * 2); ctx.fill();
      }
      // vainas de cacao colgando
      ctx.fillStyle = '#7A4A22';
      ctx.strokeStyle = '#5A3416'; ctx.lineWidth = 1.5 * s;
      for (const [dx, dy] of [[-0.45, 0.25], [0.1, -0.35], [0.5, 0.1], [-0.05, 0.35]]) {
        ctx.beginPath();
        ctx.ellipse(c.x + dx * c.r + shake, c.y + dy * c.r, 5 * s, 9 * s, 0.3, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      }
    }
    ctx.fillStyle = '#4A3A1A'; ctx.font = `bold ${12 * s}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Cacao', c.x, c.y + c.r * 1.45 + 12 * s);

    // chocolates en el piso
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const ch of this.chocs) {
      const pop = Math.min(1, ch.t);
      const bob = ch.t >= 1 ? Math.sin(ch.wob) * 1.5 * s : 0;
      if (ready(IMG.chocolate)) {
        drawIconImg(ctx, IMG.chocolate, ch.x, ch.y + bob, 20 * s * pop);
      } else {
        ctx.font = `${18 * s * pop}px system-ui, sans-serif`;
        ctx.fillText('🍫', ch.x, ch.y + bob);
      }
      if (ch.t >= 1) {
        ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.5 * s;
        ctx.beginPath(); ctx.arc(ch.x, ch.y + bob, 13 * s + Math.sin(this.t * 4 + ch.wob) * 2 * s, 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.textBaseline = 'alphabetic';
  }

  // vaca comprada: se ordeña cuando muestra la burbuja de leche
  _drawVaca(ctx, L) {
    if (!this.vaca) return;
    const { s } = L;
    const v = L.vaca;
    const bob = Math.sin(this.t * 1.8) * 2 * s;
    if (ready(IMG.vaca)) {
      this._imgH(ctx, IMG.vaca, v.x, v.y + v.r + bob * 0.5, v.r * 2.1);
    } else {
      // sombra
      ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(v.x, v.y + v.r * 0.95, v.r * 1.1, v.r * 0.28, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.font = `${v.r * 1.9}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🐄', v.x, v.y + bob);
      ctx.textBaseline = 'alphabetic';
    }
    ctx.fillStyle = '#4A3A1A'; ctx.font = `bold ${12 * s}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Vaca', v.x, v.y + v.r * 1.25 + 12 * s);

    // burbuja de "leche lista"
    if (this.cowReadyT <= 0) {
      const pulse = 1 + Math.sin(this.t * 5) * 0.1;
      const by = v.y - v.r * 1.5 + Math.sin(this.t * 3) * 2 * s;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.strokeStyle = '#8FB8D8'; ctx.lineWidth = 2 * s;
      ctx.beginPath(); ctx.arc(v.x, by, 14 * s * pulse, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (ready(IMG.leche)) {
        drawIconImg(ctx, IMG.leche, v.x, by, 19 * s * pulse);
      } else {
        ctx.font = `${15 * s * pulse}px system-ui, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('🥛', v.x, by + 1 * s);
        ctx.textBaseline = 'alphabetic';
      }
    }
  }

  // colmena (pastelería): junta miel sola; se cosecha cuando muestra el tarrito
  _drawColmena(ctx, L) {
    if (!this.colmena) return;
    const { s } = L;
    const c = L.colmena;
    if (ready(IMG2.colmena)) {
      this._imgH(ctx, IMG2.colmena, c.x, c.y + c.r * 1.15, c.r * 2.3);
    } else {
      // panal dorado de pisos con puertita
      ctx.fillStyle = '#F2B93C'; ctx.strokeStyle = '#B07A18'; ctx.lineWidth = 2 * s;
      for (const [dy, rr] of [[0.55, 0.62], [0.05, 0.78], [-0.45, 0.62], [-0.8, 0.4]]) {
        ctx.beginPath(); ctx.ellipse(c.x, c.y + dy * c.r, c.r * rr, c.r * 0.32, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = '#6A4A10';
      ctx.beginPath(); ctx.arc(c.x, c.y + c.r * 0.55, c.r * 0.18, 0, Math.PI * 2); ctx.fill();
      // abejita dando vueltas
      const ang = this.t * 2.2;
      ctx.font = `${13 * s}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🐝', c.x + Math.cos(ang) * c.r * 1.5, c.y - c.r * 0.3 + Math.sin(ang * 1.7) * c.r * 0.5);
      ctx.textBaseline = 'alphabetic';
    }
    ctx.fillStyle = '#8A6A10'; ctx.font = `bold ${12 * s}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Colmena', c.x, c.y + c.r * 1.15 + 14 * s);

    // burbuja de "miel lista" (como la leche de la vaca)
    if (this.honeyReadyT <= 0) {
      const pulse = 1 + Math.sin(this.t * 5) * 0.1;
      const by = c.y - c.r * 1.6 + Math.sin(this.t * 3) * 2 * s;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.strokeStyle = '#E0B040'; ctx.lineWidth = 2 * s;
      ctx.beginPath(); ctx.arc(c.x, by, 14 * s * pulse, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (ready(IMG2.miel)) {
        drawIconImg(ctx, IMG2.miel, c.x, by, 19 * s * pulse);
      } else {
        ctx.font = `${15 * s * pulse}px system-ui, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('🍯', c.x, by + 1 * s);
        ctx.textBaseline = 'alphabetic';
      }
    }
  }

  // frutillar (pastelería): mata de frutillas que se sacude como el cacaotero
  _drawFrutillar(ctx, L) {
    if (!this.frutillar) return;
    const { s } = L;
    const c = L.frutillar;
    const shake = this.frutShake > 0 ? Math.sin(this.t * 40) * 4 * s : 0;
    if (ready(IMG2.frutillar)) {
      this._imgH(ctx, IMG2.frutillar, c.x + shake, c.y + c.r * 1.15, c.r * 2.3);
    } else {
      // mata verde con frutillas asomando
      ctx.fillStyle = '#4E9048';
      for (const [dx, dy, rr] of [[-0.5, 0.25, 0.55], [0.5, 0.25, 0.55], [0, 0, 0.7], [0, 0.35, 0.75]]) {
        ctx.beginPath(); ctx.arc(c.x + dx * c.r + shake, c.y + dy * c.r, c.r * rr, 0, Math.PI * 2); ctx.fill();
      }
      ctx.font = `${13 * s}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const [dx, dy] of [[-0.5, 0.1], [0.1, -0.25], [0.55, 0.2], [-0.05, 0.45]]) {
        ctx.fillText('🍓', c.x + dx * c.r + shake, c.y + dy * c.r);
      }
      ctx.textBaseline = 'alphabetic';
    }
    ctx.fillStyle = '#8A2A3A'; ctx.font = `bold ${12 * s}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Frutillas', c.x, c.y + c.r * 1.15 + 14 * s);

    // frutillas en el piso
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const f of this.straws) {
      const pop = Math.min(1, f.t);
      const bob = f.t >= 1 ? Math.sin(f.wob) * 1.5 * s : 0;
      if (ready(IMG2.frutilla)) {
        drawIconImg(ctx, IMG2.frutilla, f.x, f.y + bob, 18 * s * pop);
      } else {
        ctx.font = `${16 * s * pop}px system-ui, sans-serif`;
        ctx.fillText('🍓', f.x, f.y + bob);
      }
      if (f.t >= 1) {
        ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.5 * s;
        ctx.beginPath(); ctx.arc(f.x, f.y + bob, 12 * s + Math.sin(this.t * 4 + f.wob) * 2 * s, 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.textBaseline = 'alphabetic';
  }

  // recetas del horno: columna fija de botones al costado derecho.
  // Cada botón muestra el producto y sus ingredientes; tocar = cocinar.
  _drawOvenMenu(ctx, L) {
    const { s } = L;
    ctx.textBaseline = 'middle';
    for (const mb of L.ovenMenu) {
      const P = this.cfg.products[mb.prod];
      const can = this._canBake(mb.prod) && !this.oven.busy;
      const cooking = this.oven.busy && this.oven.product === mb.prod;
      ctx.fillStyle = can ? '#FFF8EC' : '#E4DCCB';
      ctx.strokeStyle = cooking ? '#FF8A3A' : '#E0A050';
      ctx.lineWidth = (cooking ? 3.5 : 2) * s;
      ctx.beginPath(); ctx.roundRect(mb.x, mb.y, mb.w, mb.h, 8 * s); ctx.fill(); ctx.stroke();

      ctx.globalAlpha = can || cooking ? 1 : 0.55;
      // producto a la izquierda
      const pimg = this._prodImg(mb.prod);
      const cy = mb.y + mb.h / 2;
      if (pimg && ready(pimg)) {
        drawIconImg(ctx, pimg, mb.x + 15 * s, cy, 22 * s);
      } else {
        ctx.font = `${16 * s}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(P.emoji, mb.x + 15 * s, cy);
      }
      // ingredientes a la derecha (iconito + cantidad si es más de 1)
      let ix = mb.x + 32 * s;
      for (const [k, n] of Object.entries(P.ing)) {
        const img = ING[k].img();
        if (ready(img)) drawIconImg(ctx, img, ix + 7 * s, cy, 15 * s);
        else {
          ctx.font = `bold ${11 * s}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(ING[k].emoji, ix + 7 * s, cy);
        }
        if (n > 1) {
          ctx.fillStyle = '#7A4A18';
          ctx.font = `900 ${10 * s}px system-ui, sans-serif`;
          ctx.textAlign = 'left';
          ctx.fillText(`×${n}`, ix + 14 * s, cy + 1 * s);
          ix += 10 * s;
        }
        ix += 18 * s;
      }
      ctx.globalAlpha = 1;
    }
    ctx.textBaseline = 'alphabetic';
  }

  // granjero contratado: se dibuja donde esté caminando, mirando hacia su destino
  _drawFarmer(ctx, L) {
    if (!this.workers.granjero || !this.farmer.seeded) return;
    const { s } = L;
    const f = this.farmer;
    const moving = !!f.dest;
    const bob = moving ? Math.abs(Math.sin(this.t * 9)) * 4 * s : Math.sin(this.t * 3) * 2 * s;
    // sombra
    ctx.save(); ctx.globalAlpha = 0.20; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(f.x, f.y, 16 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.save();
    ctx.translate(f.x, f.y - bob);
    if (f.facing < 0) ctx.scale(-1, 1);
    if (ready(IMG.granjero)) {
      const h = 82 * s, w = h * (IMG.granjero.naturalWidth / IMG.granjero.naturalHeight);
      ctx.drawImage(IMG.granjero, -w / 2, -h, w, h);
    } else {
      ctx.font = `${30 * s}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🧑‍🌾', 0, -15 * s);
      ctx.textBaseline = 'alphabetic';
    }
    ctx.restore();
  }

  _drawSeeds(ctx, L) {
    const { s } = L;
    for (const g of this.groundSeeds) {
      const t = g.t;
      // vuelo en arco desde el arbusto hasta el piso
      const gx = g.x + (g.tx - g.x) * t;
      const gy = g.y + (g.ty - g.y) * t - Math.sin(t * Math.PI) * 55 * s;
      const bob = t >= 1 ? Math.sin(g.wob) * 2.5 * s : 0;
      ctx.save();
      ctx.translate(gx, gy + bob);
      ctx.rotate(0.5);
      if (ready(IMG.semilla)) {
        const h = 24 * s, w = h * (IMG.semilla.naturalWidth / IMG.semilla.naturalHeight);
        ctx.drawImage(IMG.semilla, -w / 2, -h / 2, w, h);
      } else {
        ctx.fillStyle = '#C89A50';
        ctx.beginPath(); ctx.ellipse(0, 0, 6.5 * s, 10 * s, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#8A6A30'; ctx.lineWidth = 1.5 * s;
        ctx.beginPath(); ctx.moveTo(0, -8 * s); ctx.lineTo(0, 8 * s); ctx.stroke();
      }
      ctx.restore();
      // aura para invitar el tap
      if (t >= 1) {
        ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.5 * s;
        ctx.beginPath(); ctx.arc(gx, gy + bob, 13 * s + Math.sin(this.t * 4 + g.wob) * 2 * s, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }

  _drawMill(ctx, L) {
    const { s } = L;
    const m = L.mill;
    const cx = m.x + m.w / 2, topY = m.y + m.h * 0.18;

    if (ready(IMG.molino) && ready(IMG.aspas)) {
      // torre ilustrada (anclada al piso del rect del molino)
      const towerH = m.h;
      const towerW = this._imgH(ctx, IMG.molino, cx, m.y + m.h, towerH);
      // aspas giratorias delante del techo
      const hubX = cx, hubY = m.y + towerH * 0.16;
      const bladeH = towerH * 0.78;
      const bladeW = bladeH * (IMG.aspas.naturalWidth / IMG.aspas.naturalHeight);
      ctx.save();
      ctx.translate(hubX, hubY);
      ctx.rotate(this.millAngle);
      ctx.drawImage(IMG.aspas, -bladeW / 2, -bladeH / 2, bladeW, bladeH);
      ctx.restore();
    } else {
      // torre
      ctx.fillStyle = '#E8D5B0';
      ctx.beginPath();
      ctx.moveTo(m.x + m.w * 0.12, m.y + m.h);
      ctx.lineTo(m.x + m.w * 0.28, topY);
      ctx.lineTo(m.x + m.w * 0.72, topY);
      ctx.lineTo(m.x + m.w * 0.88, m.y + m.h);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#B09060'; ctx.lineWidth = 2.5 * s; ctx.stroke();
      // techo
      ctx.fillStyle = '#C0563A';
      ctx.beginPath();
      ctx.moveTo(m.x + m.w * 0.2, topY);
      ctx.lineTo(cx, m.y);
      ctx.lineTo(m.x + m.w * 0.8, topY);
      ctx.closePath(); ctx.fill();
      // puerta y ventana
      ctx.fillStyle = '#7A5228';
      ctx.beginPath(); ctx.roundRect(cx - 10 * s, m.y + m.h - 30 * s, 20 * s, 30 * s, [8 * s, 8 * s, 0, 0]); ctx.fill();
      ctx.fillStyle = '#F8ECC8';
      ctx.beginPath(); ctx.arc(cx, m.y + m.h * 0.45, 8 * s, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#B09060'; ctx.lineWidth = 2 * s; ctx.stroke();

      // aspas giratorias
      const hubX = cx, hubY = topY + 6 * s;
      ctx.save();
      ctx.translate(hubX, hubY);
      ctx.rotate(this.millAngle);
      for (let k = 0; k < 4; k++) {
        ctx.rotate(Math.PI / 2);
        ctx.fillStyle = '#F5E8CC';
        ctx.strokeStyle = '#B09060'; ctx.lineWidth = 2 * s;
        ctx.beginPath(); ctx.roundRect(-6 * s, -m.h * 0.46, 12 * s, m.h * 0.44, 5 * s); ctx.fill(); ctx.stroke();
        // travesaños
        ctx.strokeStyle = 'rgba(176,144,96,0.6)'; ctx.lineWidth = 1.5 * s;
        for (let j = 1; j < 4; j++) {
          ctx.beginPath(); ctx.moveTo(-6 * s, -m.h * 0.46 + (m.h * 0.44 * j) / 4);
          ctx.lineTo(6 * s, -m.h * 0.46 + (m.h * 0.44 * j) / 4); ctx.stroke();
        }
      }
      ctx.restore();
      ctx.fillStyle = '#7A5228';
      ctx.beginPath(); ctx.arc(hubX, hubY, 6 * s, 0, Math.PI * 2); ctx.fill();
    }

    // progreso de molienda
    if (this.mill.busy) {
      const frac = this.mill.t / this._millDur();
      this._progressBar(ctx, cx - 34 * s, m.y + m.h + 8 * s, 68 * s, 9 * s, frac, '#E0A050', s);
    }
    ctx.fillStyle = '#5A4020'; ctx.font = `bold ${13 * s}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    const millLabelY = m.y + m.h + (this.mill.busy ? 30 : 16) * s;
    ctx.fillText('Molino', cx, millLabelY);
    // estrella de mejora al lado del nombre
    if (this.upgrades.molino) {
      const tw = ctx.measureText('Molino').width;
      this._drawStar(ctx, cx + tw / 2 + 12 * s, millLabelY - 4 * s, s);
    }

    if (this.workers.molinero) this._drawWorker(ctx, m.x - 18 * s, m.y + m.h, 'molinero', L);
  }

  _drawBakery(ctx, L) {
    const { W, s } = L;
    const b = L.bld;

    // edificio
    ctx.fillStyle = '#F5DFC0';
    ctx.beginPath(); ctx.roundRect(b.x, b.y + b.h * 0.12, b.w, b.h * 0.88, [0, 0, 8 * s, 8 * s]); ctx.fill();
    ctx.strokeStyle = '#C09868'; ctx.lineWidth = 2.5 * s; ctx.stroke();
    // techo / toldo a rayas
    const awnY = b.y + b.h * 0.12;
    ctx.fillStyle = '#C0563A';
    ctx.beginPath();
    ctx.moveTo(b.x - 10 * s, awnY); ctx.lineTo(b.x + b.w * 0.5, b.y - 6 * s); ctx.lineTo(b.x + b.w + 10 * s, awnY);
    ctx.closePath(); ctx.fill();
    const stripes = 7;
    for (let k = 0; k < stripes; k++) {
      if (k % 2 === 0) continue;
      ctx.fillStyle = '#F0E0D0';
      const x0 = b.x - 10 * s + ((b.w + 20 * s) * k) / stripes;
      const x1 = b.x - 10 * s + ((b.w + 20 * s) * (k + 1)) / stripes;
      const apex = b.x + b.w * 0.5;
      ctx.beginPath();
      ctx.moveTo(x0, awnY); ctx.lineTo(x1, awnY);
      const f1 = 1 - Math.abs((x1 - b.x + 10 * s) / (b.w + 20 * s) - 0.5) * 2;
      const f0 = 1 - Math.abs((x0 - b.x + 10 * s) / (b.w + 20 * s) - 0.5) * 2;
      ctx.lineTo(apex + (x1 - apex) * 0.12, awnY - (awnY - b.y + 6 * s) * f1 * 0.88);
      ctx.lineTo(apex + (x0 - apex) * 0.12, awnY - (awnY - b.y + 6 * s) * f0 * 0.88);
      ctx.closePath(); ctx.fill();
    }

    // ── clientes (detrás del mostrador) ──
    for (let i = 0; i < this.customers.length && i < 3; i++) {
      this._drawCustomer(ctx, L, i);
    }

    // ── mostrador ──
    const c = L.counter;
    const cb = L.counterBox;
    let shelfY;   // línea donde se apoyan los panes
    if (ready(IMG.mostrador)) {
      this._imgH(ctx, IMG.mostrador, cb.cx, cb.bottom, cb.h);
      shelfY = cb.bottom - cb.h * 0.62;
    } else {
      ctx.fillStyle = '#B07840';
      ctx.beginPath(); ctx.roundRect(cb.cx - cb.w / 2, cb.bottom - cb.h * 0.75, cb.w, cb.h * 0.75, 6 * s); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(cb.cx - cb.w / 2, cb.bottom - cb.h * 0.75, cb.w, cb.h * 0.2);
      ctx.strokeStyle = '#7A5228'; ctx.lineWidth = 2 * s;
      ctx.beginPath(); ctx.roundRect(cb.cx - cb.w / 2, cb.bottom - cb.h * 0.75, cb.w, cb.h * 0.75, 6 * s); ctx.stroke();
      shelfY = cb.bottom - cb.h * 0.75;
    }

    // el producto básico en fila sobre el mostrador
    const stKey = this.cfg.starter;
    const stInv = this.inv[this.cfg.products[stKey].inv];
    const nShow = Math.min(stInv, 6);
    for (let k = 0; k < nShow; k++) {
      this._drawShelfProd(ctx, stKey, cb.cx - cb.w * 0.36 + k * 28 * s, shelfY, s);
    }
    if (stInv > 6) {
      ctx.fillStyle = '#7A4A18'; ctx.font = `900 ${14 * s}px system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(`×${stInv}`, cb.cx - cb.w * 0.36 + 6 * 28 * s, shelfY - 2 * s);
    }
    // el resto de los productos en el estante de arriba (sprite o emoji)
    const shelf2Y = cb.bottom - cb.h * 0.92;
    const shelfItem = (img, emoji, x, size) => {
      if (img && ready(img)) drawIconImg(ctx, img, x, shelf2Y - 6 * s, size);
      else {
        ctx.font = `${size}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(emoji, x, shelf2Y);
      }
    };
    const shelfCount = (n, x) => {
      ctx.fillStyle = '#7A4A18'; ctx.font = `900 ${13 * s}px system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(`×${n}`, x, shelf2Y);
    };
    const others = Object.keys(this.cfg.products).filter(p => p !== stKey);
    others.forEach((p, idx) => {
      const P = this.cfg.products[p];
      const n = this.inv[P.inv];
      if (n <= 0) return;
      const x = cb.cx + cb.w * (-0.34 + idx * (0.7 / Math.max(1, others.length - 1)));
      shelfItem(this._prodImg(p), P.emoji, x, 22 * s);
      if (n > 1) shelfCount(n, x + 12 * s);
    });
    ctx.fillStyle = '#7A4A18'; ctx.font = `bold ${12 * s}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Mostrador', cb.cx, cb.bottom + 14 * s);

    if (this.workers.vendedor) this._drawWorker(ctx, cb.cx - cb.w * 0.62, cb.bottom - 4 * s, 'vendedor', L);

    // ── horno ──
    const o = L.oven;
    const dx = o.x + o.w / 2;
    if (ready(IMG.horno)) {
      const oh = o.h * 1.28;
      this._imgH(ctx, IMG.horno, dx, o.y + o.h, oh);
      // brillo pulsante en la boca cuando hornea
      if (this.oven.busy) {
        const pulse = 0.25 + Math.abs(Math.sin(this.t * 6)) * 0.25;
        const g = ctx.createRadialGradient(dx, o.y + o.h * 0.62, 2 * s, dx, o.y + o.h * 0.62, o.w * 0.32);
        g.addColorStop(0, `rgba(255,190,80,${pulse})`);
        g.addColorStop(1, 'rgba(255,190,80,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(dx, o.y + o.h * 0.62, o.w * 0.32, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      ctx.fillStyle = '#A65A38';
      ctx.beginPath(); ctx.roundRect(o.x, o.y, o.w, o.h, 8 * s); ctx.fill();
      // ladrillos
      ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1.5 * s;
      for (let ry = o.y + o.h * 0.2; ry < o.y + o.h; ry += o.h * 0.2) {
        ctx.beginPath(); ctx.moveTo(o.x + 3 * s, ry); ctx.lineTo(o.x + o.w - 3 * s, ry); ctx.stroke();
      }
      // boca del horno
      const doorW = o.w * 0.62, doorH = o.h * 0.52;
      const dy0 = o.y + o.h * 0.72;
      ctx.fillStyle = '#3A2010';
      ctx.beginPath();
      ctx.moveTo(dx - doorW / 2, dy0);
      ctx.lineTo(dx - doorW / 2, dy0 - doorH * 0.4);
      ctx.arc(dx, dy0 - doorH * 0.4, doorW / 2, Math.PI, 0);
      ctx.lineTo(dx + doorW / 2, dy0);
      ctx.closePath(); ctx.fill();
      // fuego cuando hornea
      if (this.oven.busy) {
        for (let k = 0; k < 3; k++) {
          const fx = dx + (k - 1) * doorW * 0.22;
          const fh = (10 + Math.sin(this.t * 9 + k * 2.4) * 4) * s;
          ctx.fillStyle = k === 1 ? '#FFD24A' : '#FF8A3A';
          ctx.beginPath();
          ctx.moveTo(fx - 6 * s, dy0);
          ctx.quadraticCurveTo(fx, dy0 - fh * 2, fx + 6 * s, dy0);
          ctx.closePath(); ctx.fill();
        }
      }
      // chimenea
      ctx.fillStyle = '#8A4A28';
      ctx.fillRect(o.x + o.w * 0.7, o.y - 16 * s, 12 * s, 18 * s);
    }
    if (this.oven.busy) {
      // la duración depende del producto que se está horneando
      const frac = this.oven.t / this._ovenDur(this.oven.product);
      this._progressBar(ctx, dx - 34 * s, o.y + o.h + 8 * s, 68 * s, 9 * s, frac, '#FF8A3A', s);
      // humo de la chimenea
      for (let k = 0; k < 3; k++) {
        const ph = (this.t * 30 + k * 26) % 80;
        ctx.globalAlpha = 0.5 * (1 - ph / 80);
        ctx.fillStyle = 'rgba(220,220,220,0.8)';
        ctx.beginPath();
        ctx.arc(o.x + o.w * 0.72 + Math.sin((ph + k * 20) * 0.1) * 5 * s, o.y - o.h * 0.34 - ph * s * 0.5, (6 + ph * 0.12) * s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = '#7A4A18'; ctx.font = `bold ${13 * s}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    const ovenLabelY = o.y + o.h + (this.oven.busy ? 30 : 16) * s;
    ctx.fillText('Horno', dx, ovenLabelY);
    // estrella de mejora al lado del nombre
    if (this.upgrades.horno) {
      const tw = ctx.measureText('Horno').width;
      this._drawStar(ctx, dx + tw / 2 + 12 * s, ovenLabelY - 4 * s, s);
    }

    if (this.workers.panadero) this._drawWorker(ctx, o.x - 20 * s, o.y + o.h, 'panadero', L);
  }

  // un producto apoyado en el mostrador (el pan conserva su dibujo vectorial)
  _drawShelfProd(ctx, prod, x, y, s) {
    if (prod === 'pan') return this._drawBread(ctx, x, y, s);
    const img = this._prodImg(prod);
    if (img && ready(img)) {
      const w = 30 * s, h = w * (img.naturalHeight / img.naturalWidth);
      ctx.drawImage(img, x - w / 2, y - h, w, h);
    } else {
      ctx.font = `${22 * s}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(this.cfg.products[prod].emoji, x, y);
    }
  }

  _drawBread(ctx, x, y, s) {
    if (ready(IMG.pan)) {
      const w = 30 * s, h = w * (IMG.pan.naturalHeight / IMG.pan.naturalWidth);
      ctx.drawImage(IMG.pan, x - w / 2, y - h, w, h);
      return;
    }
    ctx.fillStyle = '#E0A050';
    ctx.beginPath(); ctx.ellipse(x, y - 8 * s, 12 * s, 8 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#B87828'; ctx.lineWidth = 1.5 * s;
    for (const k of [-1, 0, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + k * 5 * s - 2 * s, y - 13 * s);
      ctx.lineTo(x + k * 5 * s + 2 * s, y - 6 * s);
      ctx.stroke();
    }
  }

  _drawCustomer(ctx, L, i) {
    const { s } = L;
    const c = this.customers[i];
    const cx = L.custXs[i];
    const slide = (1 - c.appear) * 60 * s + (c.leaving ? c.gone * 120 * s : 0);
    const x = cx + slide;
    const y = L.custY;
    const [body, dark] = CUSTOMER_COLORS[c.seed % CUSTOMER_COLORS.length];
    ctx.globalAlpha = c.leaving ? Math.max(0, 1 - c.gone / 0.8) : c.appear;

    const bounce = c.leaving && c.happy ? Math.abs(Math.sin(this.t * 10)) * 5 * s : 0;
    const sprite = IMG.clientes[c.seed % IMG.clientes.length];
    if (ready(sprite)) {
      this._imgH(ctx, sprite, x, y - bounce, 112 * s);
    } else {
      // cuerpo
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.ellipse(x, y - 24 * s - bounce, 20 * s, 26 * s, 0, 0, Math.PI * 2); ctx.fill();
      // cabeza
      ctx.fillStyle = '#FFE0C8';
      ctx.beginPath(); ctx.arc(x, y - 62 * s - bounce, 17 * s, 0, Math.PI * 2); ctx.fill();
      // pelo
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.arc(x, y - 66 * s - bounce, 17 * s, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
      // cara
      ctx.fillStyle = '#4A3020';
      ctx.beginPath(); ctx.arc(x - 6 * s, y - 63 * s - bounce, 2 * s, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 6 * s, y - 63 * s - bounce, 2 * s, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#4A3020'; ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      if (c.leaving && !c.happy) ctx.arc(x, y - 52 * s - bounce, 5 * s, Math.PI * 1.15, Math.PI * 1.85);
      else ctx.arc(x, y - 58 * s - bounce, 5 * s, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    }

    // burbuja de pedido + barra de paciencia
    if (!c.leaving) {
      const bw = 62 * s, bh = 44 * s, bx = x, by = y - 108 * s;
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#E0A050'; ctx.lineWidth = 2 * s;
      ctx.beginPath(); ctx.roundRect(bx - bw / 2, by - bh / 2, bw, bh, 9 * s); ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(bx - 6 * s, by + bh / 2); ctx.lineTo(bx + 6 * s, by + bh / 2); ctx.lineTo(bx, by + bh / 2 + 8 * s);
      ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#7A4A18'; ctx.font = `900 ${15 * s}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const pimg = this._prodImg(c.prod);
      if (pimg && ready(pimg)) {
        drawIconImg(ctx, pimg, bx - 11 * s, by - 6 * s, 20 * s);
        ctx.fillText(`×${c.want}`, bx + 12 * s, by - 5 * s);
      } else {
        ctx.fillText(`${this.cfg.products[c.prod].emoji}×${c.want}`, bx, by - 5 * s);
      }
      ctx.textBaseline = 'alphabetic';
      const frac = Math.max(0, c.patience / c.maxPatience);
      const col = frac > 0.5 ? '#5AC85A' : frac > 0.22 ? '#F2B705' : '#E0353A';
      this._progressBar(ctx, bx - bw / 2 + 6 * s, by + bh / 2 - 11 * s, bw - 12 * s, 6 * s, frac, col, s);
    }
    ctx.globalAlpha = 1;
  }

  _drawPlayer(ctx, L) {
    const { H, s } = L;
    // leve perspectiva: más chico arriba (lejos), más grande abajo (cerca)
    const scaleOf = (wy) => s * (0.42 + 0.28 * (wy / H));
    // marcador del destino mientras camina
    if (this.dest) {
      const pulse = 0.6 + Math.sin(this.t * 6) * 0.4;
      ctx.strokeStyle = `rgba(255,255,255,${0.35 + pulse * 0.35})`;
      ctx.lineWidth = 2.5 * s;
      ctx.beginPath(); ctx.ellipse(this.dest.x, this.dest.y, 16 * s * pulse + 6 * s, (16 * s * pulse + 6 * s) * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
    }
    if (ready(IMG.jugadora)) {
      // protagonista ilustrada, con la animación de caminar/saltar del avatar
      const p = this.player;
      const sc = scaleOf(p.y);
      const hgt = 168 * sc;
      let ox = 0, oy = 0, rot = 0, scaleY = 1, shadowScale = 1;
      if (p.isMoving) { oy += p.bobOffset * sc; rot += Math.sin(p.walkPhase) * 0.05; }
      if (p.gesture === 'jump') {
        const t = Math.min(p.gestureTime / p.gestureDur, 1);
        if (t < 0.13) { const f = t / 0.13; oy += 12 * f * sc; scaleY = 1 - 0.18 * f; }
        else if (t < 0.87) {
          const f = (t - 0.13) / 0.74;
          const arc = Math.sin(f * Math.PI);
          oy -= 80 * arc * sc; scaleY = 1 + 0.14 * arc; rot += Math.sin(f * Math.PI * 2) * 0.08;
          shadowScale = 1 - 0.5 * arc;
        } else { const f = (t - 0.87) / 0.13; oy += 12 * (1 - f) * sc; scaleY = 0.82 + 0.18 * f; }
      }
      // sombra
      ctx.save(); ctx.globalAlpha = 0.22 * shadowScale; ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(p.x + ox, p.y, 24 * sc * shadowScale, 7 * sc * shadowScale, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      // sprite (espejado según hacia dónde mira)
      const w = hgt * (IMG.jugadora.naturalWidth / IMG.jugadora.naturalHeight);
      ctx.save();
      ctx.translate(p.x + ox, p.y + oy);
      ctx.rotate(rot);
      if (p.facingDir < 0) ctx.scale(-1, 1);
      ctx.scale(1, scaleY);
      ctx.drawImage(IMG.jugadora, -w / 2, -hgt, w, hgt);
      ctx.restore();
    } else {
      this.player.draw(ctx, { x: 0, y: 0 }, scaleOf);
    }
    // burbujita con lo que va a hacer/llevar
    if (this.task) {
      const prods = this.cfg.products;
      const label = {
        bush: '🌳', seed: '🌱', egg: '🥚', choc: '🍫', cacao: '🌳', vaca: '🥛',
        straw: '🍓', frutillar: '🌳', colmena: '🍯',
        plot: this.plots[this.task.idx]?.state === 'ready' ? '🌾' : '🌱',
        mill: '🌾',
        oven: this.task.product !== this.cfg.starter ? prods[this.task.product]?.emoji : null,
        customer: prods[this.task.cust?.prod]?.emoji || prods[this.cfg.starter].emoji,
      }[this.task.type];
      const sc = scaleOf(this.player.y);
      const bx = this.player.x, by = this.player.y - 190 * sc;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(bx, by, 15 * s, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#E0A050'; ctx.lineWidth = 2 * s; ctx.stroke();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      // sprite de lo que lleva/va a hacer (con el emoji como respaldo)
      const tk = this.task;
      const bubbleImg = tk.type === 'seed' ? IMG.semilla
        : tk.type === 'egg' ? IMG.huevo
        : tk.type === 'choc' ? IMG.chocolate
        : tk.type === 'vaca' ? IMG.leche
        : tk.type === 'straw' ? IMG2.frutilla
        : tk.type === 'colmena' ? IMG2.miel
        : tk.type === 'plot' ? (this.plots[tk.idx]?.state === 'ready' ? null : IMG.semilla)
        : tk.type === 'oven' ? (tk.product === this.cfg.starter ? IMG.harina : this._prodImg(tk.product))
        : tk.type === 'customer' ? this._prodImg(tk.cust?.prod)
        : null;
      if (bubbleImg && ready(bubbleImg)) {
        drawIconImg(ctx, bubbleImg, bx, by, 21 * s);
      } else if (label) {
        ctx.font = `${16 * s}px system-ui, sans-serif`;
        ctx.fillText(label, bx, by + 1 * s);
      } else {
        // bolsita de harina para el horno (respaldo dibujado)
        ctx.fillStyle = '#F5EFE0';
        ctx.beginPath(); ctx.roundRect(bx - 7 * s, by - 5 * s, 14 * s, 11 * s, 3 * s); ctx.fill();
        ctx.strokeStyle = '#B09060'; ctx.lineWidth = 1.5 * s; ctx.stroke();
        ctx.fillStyle = '#E8D5B0';
        ctx.beginPath(); ctx.ellipse(bx, by - 6 * s, 5 * s, 2.5 * s, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.textBaseline = 'alphabetic';
    }
  }

  // Dibuja un trabajador contratado en su estación (sprite, con emoji de respaldo).
  // x = centro, bottomY = línea de piso donde apoyan los pies.
  _drawWorker(ctx, x, bottomY, key, L) {
    const { s } = L;
    const bob = Math.sin(this.t * 3 + x * 0.05) * 3 * s;
    const sprite = IMG[key];
    if (ready(sprite)) {
      this._imgH(ctx, sprite, x, bottomY + bob, 82 * s);
      return;
    }
    const emoji = { granjero: '🧑‍🌾', molinero: '🧑‍🏭', panadero: '🧑‍🍳', vendedor: '🧑‍💼' }[key] || '🧑';
    ctx.font = `${30 * s}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(emoji, x, bottomY - 15 * s + bob);
    ctx.textBaseline = 'alphabetic';
  }

  _drawShop(ctx, L) {
    const { s } = L;
    // con 11 botones (pastelería) los textos se achican hasta entrar
    const fitFont = (txt, base, weight, maxW) => {
      let fs = base;
      ctx.font = `${weight} ${fs}px system-ui, sans-serif`;
      while (fs > 8 * s && ctx.measureText(txt).width > maxW) {
        fs -= 0.5;
        ctx.font = `${weight} ${fs}px system-ui, sans-serif`;
      }
    };
    for (const b of L.shop) {
      let label1, label2, afford, owned = false;
      if (b.kind === 'field') {
        if (this.plots.length >= MAX_PLOTS) { owned = true; label1 = '🌾 Campos'; label2 = 'MÁX'; afford = false; }
        else {
          const price = this.cfg.fieldPrices[this.plots.length - 2];
          label1 = '🌾 + Campo'; label2 = `$${price}`; afford = this.money >= price;
        }
      } else if (b.kind === 'source') {
        owned = this[b.src.key];
        label1 = `${b.src.emoji} ${b.src.name}`;
        label2 = owned ? b.src.done : `$${b.src.price}`;
        afford = this.money >= b.src.price;
      } else if (b.kind === 'worker') {
        owned = this.workers[b.worker.key];
        label1 = `${b.worker.emoji} ${b.worker.name}`;
        label2 = owned ? '✓ contratado' : `$${b.worker.price}`;
        afford = this.money >= b.worker.price;
      } else {
        owned = this.upgrades[b.upgrade.key];
        label1 = `⭐ ${b.upgrade.name}`;
        label2 = owned ? '✓ mejorado' : `$${b.upgrade.price}`;
        afford = this.money >= b.upgrade.price;
      }
      ctx.fillStyle = owned ? '#D8EFC8' : afford ? '#7BC86B' : '#C8C0B0';
      ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 10 * s); ctx.fill();
      ctx.strokeStyle = owned ? '#7BAE5B' : 'rgba(0,0,0,0.18)'; ctx.lineWidth = 2 * s; ctx.stroke();
      ctx.fillStyle = owned ? '#4E7A38' : '#fff';
      ctx.textAlign = 'center';
      fitFont(label1, 14 * s, '900', b.w - 8 * s);
      ctx.fillText(label1, b.x + b.w / 2, b.y + b.h * 0.42);
      fitFont(label2, 13 * s, 'bold', b.w - 8 * s);
      ctx.fillText(label2, b.x + b.w / 2, b.y + b.h * 0.78);
    }
  }

  _drawHUD(ctx, L) {
    const { s } = L;
    const prods = this.cfg.products;
    const st = this.cfg.starter;
    const chips = [
      ['🌱', this.inv.seed],
      ['🌾', this.inv.wheat],
      ['sack', this.inv.flour],
      [prods[st].emoji, this.inv[prods[st].inv]],
      // el ingrediente de cada fuente que ya se tiene
      ...Object.entries(this.cfg.sources)
        .filter(([k]) => this[k])
        .map(([, src]) => [ING[src.ing].emoji, this.inv[src.ing]]),
      // los productos desbloqueados (el básico ya está arriba)
      ...Object.keys(prods)
        .filter(p => p !== st && this._unlocked(p))
        .map(p => [prods[p].emoji, this.inv[prods[p].inv]]),
      ['💰', `$${this.money}`],
    ];
    let x = 10 * s;
    const y = 56 * s, h = 34 * s;
    ctx.textBaseline = 'middle';
    for (const [icon, val] of chips) {
      ctx.font = `900 ${16 * s}px system-ui, sans-serif`;
      const txt = `${val}`;
      const iconW = 22 * s;
      const w = iconW + ctx.measureText(txt).width + 22 * s;
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
      if (icon === 'sack') {
        const bx = x + 12 * s, by = y + h / 2;
        if (ready(IMG.harina)) {
          const ih = 22 * s, iw = ih * (IMG.harina.naturalWidth / IMG.harina.naturalHeight);
          ctx.drawImage(IMG.harina, bx - iw / 2, by - ih / 2, iw, ih);
        } else {
          // bolsita de harina dibujada (no hay emoji lindo de harina)
          ctx.fillStyle = '#F5EFE0';
          ctx.beginPath(); ctx.roundRect(bx - 7 * s, by - 6 * s, 14 * s, 13 * s, 4 * s); ctx.fill();
          ctx.strokeStyle = '#B09060'; ctx.lineWidth = 1.5 * s; ctx.stroke();
          ctx.fillStyle = '#E8D5B0';
          ctx.beginPath(); ctx.ellipse(bx, by - 7 * s, 5 * s, 3 * s, 0, 0, Math.PI * 2); ctx.fill();
        }
      } else {
        const cimg = CHIP_IMG()[icon];
        if (cimg && ready(cimg)) {
          drawIconImg(ctx, cimg, x + 12 * s, y + h / 2, 20 * s);
        } else {
          ctx.textAlign = 'left';
          ctx.fillText(icon, x + 6 * s, y + h / 2 + 1 * s);
        }
      }
      ctx.fillStyle = '#6A4A20';
      ctx.textAlign = 'left';
      ctx.fillText(txt, x + iconW + 8 * s, y + h / 2 + 1 * s);
      x += w + 6 * s;
    }
    ctx.textBaseline = 'alphabetic';
  }

  // estrella dorada pulsante: marca una máquina mejorada (junto a su nombre)
  _drawStar(ctx, x, y, s) {
    const pulse = 1 + Math.sin(this.t * 4) * 0.12;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(pulse, pulse);
    ctx.font = `${15 * s}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⭐', 0, 0);
    ctx.restore();
    ctx.textBaseline = 'alphabetic';
  }

  _progressBar(ctx, x, y, w, h, frac, color, s) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(x, y, Math.max(h, w * Math.min(1, frac)), h, h / 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5 * s;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.stroke();
  }

  destroy() { this._save(); }
}
