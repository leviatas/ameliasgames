// ── Dash 3D — corredor infinito de 3 carriles ───────────────────────────────
// Todo se dibuja en canvas 2D pero con una cámara en perspectiva de verdad:
// cada punto del mundo (x = costado, y = altura, z = distancia hacia adelante)
// se proyecta con `_p()` dividiendo por la profundidad, así que los obstáculos
// nacen chiquitos en el horizonte y crecen encima nuestro. Los cajones se
// dibujan con sus tres caras visibles (frente, techo y un costado) para que se
// lean como cuerpos y no como stickers.
//
// Controles (los gestos se detectan acá adentro, game.js sólo reenvía):
//   deslizar ⬅ ➡ cambia de carril · ⬆ salta · ⬇ se agacha.
import { addCoins } from './Wallet.js';
import { Sound } from './Sound.js';

// ── Sprite del personaje (con fallback vectorial mientras carga) ────────────
const ASSET = (name) => `/assets/dash/${name}.png`;
function loadImg(name) { const im = new Image(); im.src = ASSET(name); return im; }
function ready(img) { return img && img.complete && img.naturalWidth > 0; }
const IMG = {
  jugadora: loadImg('jugadora'),         // salto / agachada: una pose, se anima por código
  corre1: loadImg('corre_1'), corre2: loadImg('corre_2'), // corrida: 2 cuadros alternados
};

// ── Mundo (unidades ≈ metros) ──
const LANE_X    = [-2.2, 0, 2.2];
const ROAD_HALF = 3.6;
const CAM_Y     = 3.6;    // altura de la cámara
const CAM_Z     = 8.5;    // cuánto atrás del personaje va la cámara
                          // (atrás y arriba: si se le pega, el cuerpo tapa la ruta)
const DRAW_Z    = 130;    // hasta dónde se dibuja
const NEAR_Z    = -CAM_Z + 4.5;  // plano cercano: más acá de esto no se dibuja
const CULL_Z    = NEAR_Z - 0.5;  // y ahí se tira el objeto

const RUN_H     = 1.7;    // alto del personaje corriendo
const SLIDE_H   = 0.85;   // agachado
const GRAVITY   = 26;
const JUMP_V    = 9.2;    // pico ≈ 1.63 m, ≈ 0.7 s en el aire
const SLIDE_T   = 0.62;

const SPD0      = 13;     // velocidad inicial
const SPD_MAX   = 34;     // techo: más rápido que esto no se puede reaccionar
const LEVEL_M   = 350;    // metros por nivel — no hay último nivel
const RAMP_L    = 4.5;    // niveles en los que la dificultad se acerca al techo
const HURT_T    = 1.4;    // invulnerabilidad tras un golpe
const MAX_LIVES = 3;

const SEG       = 6;      // largo del segmento de asfalto (rayas y banquina)

// Paletas: cada nivel usa la siguiente y vuelven a empezar, así que aunque los
// niveles no se terminen nunca, siempre hay algo distinto para mirar.
const THEMES = [
  { name: 'Día',       emoji: '☀️', skyTop: '#4FA8FF', skyBot: '#CFEEFF', sun: '#FFF3B0', sunY: 0.20,
    hills: '#8FBF6E', grass: '#7FC96B', road: '#6B6F8A', rumble: '#FF6B8B', tree: '#4CAF50',
    cloud: 0.75, star: 0, lamp: 0 },
  { name: 'Atardecer', emoji: '🌅', skyTop: '#3B2C6B', skyBot: '#FF9E6B', sun: '#FF7043', sunY: 0.06,
    hills: '#5E4E72', grass: '#6E8F5E', road: '#56506E', rumble: '#C4506E', tree: '#3C7A46',
    cloud: 0.45, star: 0.15, lamp: 0.5 },
  { name: 'Noche',     emoji: '🌙', skyTop: '#080B26', skyBot: '#2B2F63', sun: '#E8ECFF', sunY: 0.26,
    hills: '#252546', grass: '#2C4740', road: '#2E2C42', rumble: '#8E3A55', tree: '#1F4632',
    cloud: 0.18, star: 1, lamp: 1 },
  { name: 'Amanecer',  emoji: '🌄', skyTop: '#6E5AA8', skyBot: '#FFC9A0', sun: '#FFD9A0', sunY: 0.11,
    hills: '#7A8F6E', grass: '#6FA36A', road: '#5A5A78', rumble: '#E0708E', tree: '#3F8A4E',
    cloud: 0.6, star: 0.25, lamp: 0.35 },
];
function mixTheme(a, b, t) {
  const out = {};
  for (const k of Object.keys(a)) {
    const va = a[k], vb = b[k];
    out[k] = typeof va === 'number' ? lerp(va, vb, t)
           : (typeof va === 'string' && va[0] === '#') ? mixHex(va, vb, t)
           : (t < 0.5 ? va : vb);
  }
  return out;
}

// Tipos de obstáculo: qué son y cómo se esquivan.
const KINDS = {
  valla:  { y0: 0,    h: 0.95, w: 1.9, d: 0.55, front: '#FF5E7A', top: '#FF93A6', side: '#D93A57', how: 'saltar' },
  viga:   { y0: 1.55, h: 1.15, w: 2.1, d: 0.55, front: '#4FC3F7', top: '#9BE0FF', side: '#2E93C4', how: 'agacharse' },
  bloque: { y0: 0,    h: 2.5,  w: 1.9, d: 1.3,  front: '#B07CFF', top: '#D3B4FF', side: '#7E4FD1', how: 'esquivar' },
  tren:   { y0: 0,    h: 2.8,  w: 2.0, d: 9,    front: '#FFB74D', top: '#FFD79A', side: '#D98E28', how: 'esquivar' },
};

function hash(i) { const v = Math.sin(i * 12.9898) * 43758.5453; return v - Math.floor(v); }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function mixHex(a, b, t) {
  const pa = [1, 3, 5].map(i => parseInt(a.substr(i, 2), 16));
  const pb = [1, 3, 5].map(i => parseInt(b.substr(i, 2), 16));
  return '#' + pa.map((v, i) => Math.round(lerp(v, pb[i], t)).toString(16).padStart(2, '0')).join('');
}

export class Dash {
  constructor(canvas, look) {
    this.canvas = canvas;
    this.look = look || {};
    this.best = +(localStorage.getItem('dash_best') || 0);
    this.reset();
  }

  reset() {
    this.state   = 'intro';       // 'intro' | 'run' | 'over'
    this.time    = 0;             // segundos corriendo (mueve la dificultad)
    this.dist    = 0;             // metros recorridos
    this.speed   = SPD0;
    this.lives   = MAX_LIVES;
    this.coins   = 0;
    this.banked  = false;
    this.level   = 1;
    this.toast   = null;          // { txt, t }
    this.shake   = 0;
    this.flash   = 0;
    this.hurtT   = 0;

    this.lane    = 1;
    this.px      = LANE_X[1];
    this.camX    = 0;
    this.py      = 0;             // altura de los pies
    this.vy      = 0;
    this.air     = false;
    this.slideT  = 0;
    this.runPhase = 0;

    this.obs     = [];            // obstáculos y monedas, en coordenadas de mundo
    this.nextWz  = 40;            // dónde se genera la próxima fila
    this.laneFree = [0, 0, 0];    // hasta qué wz está ocupado cada carril
    this._sw     = null;          // gesto en curso
  }

  // ── Layout / proyección ───────────────────────────────────────────────────
  _layout() {
    const W = this.canvas.width, H = this.canvas.height;
    this.W = W; this.H = H;
    this.s = clamp(Math.min(W, H) / 720, 0.5, 1);
    this.horizon = H * 0.42;
    this.focal   = H * 0.95;
  }

  // Proyecta un punto del mundo a pantalla. `s` es la escala (px por metro).
  _p(x, y, z) {
    const d = z + CAM_Z;
    const s = this.focal / d;
    return { x: this.W / 2 + (x - this.camX) * s, y: this.horizon + (CAM_Y - y) * s, s, d };
  }

  get _playerH() { return this.slideT > 0 ? SLIDE_H : RUN_H; }
  // Niveles transcurridos, con decimales. No tiene tope: el nivel sube cada
  // LEVEL_M metros para siempre.
  get _prog()    { return this.dist / LEVEL_M; }
  // La dificultad se acerca al techo sin llegar nunca. Así los niveles pueden
  // ser infinitos sin que el juego se vuelva imposible: siempre queda un
  // poquito más de velocidad y un poquito menos de margen, pero nunca cruza el
  // límite de lo que una nena puede reaccionar.
  get _diff()    { return 1 - Math.exp(-this._prog / RAMP_L); }

  // Paleta del nivel actual, mezclada con la del siguiente sobre el final del
  // nivel para que el cambio de luz sea un fundido y no un salto.
  _theme() {
    const p = this._prog;
    const i = Math.floor(p) % THEMES.length;
    const frac = p - Math.floor(p);
    const t = clamp((frac - 0.65) / 0.35, 0, 1);
    return mixTheme(THEMES[i], THEMES[(i + 1) % THEMES.length], t);
  }
  _themeAt(level) { return THEMES[(level - 1) % THEMES.length]; }

  // ── Entrada ───────────────────────────────────────────────────────────────
  swipe(dir) {
    if (this.state === 'intro') { this.state = 'run'; return; }
    if (this.state === 'over')  { this.reset(); this.state = 'run'; return; }
    if (dir === 'left'  && this.lane > 0) { this.lane--; Sound.pick(); }
    else if (dir === 'right' && this.lane < 2) { this.lane++; Sound.pick(); }
    else if (dir === 'up')   this._jump();
    else if (dir === 'down') this._slide();
  }

  _jump() {
    if (this.air) return;
    this.air = true; this.vy = JUMP_V; this.slideT = 0;
    Sound.add();
  }

  _slide() {
    if (this.air) { this.vy = Math.min(this.vy, -6); return; }  // caída rápida
    this.slideT = SLIDE_T;
    Sound.undo();
  }

  // Los gestos se resuelven acá para que game.js sólo tenga que reenviar los
  // eventos del canvas: un movimiento corto es un toque, uno largo un swipe.
  pointerDown(x, y) { this._sw = { x, y, t: performance.now(), fired: false }; }

  pointerMove(x, y) {
    const s = this._sw;
    if (!s || s.fired) return;
    const dx = x - s.x, dy = y - s.y;
    const thr = Math.min(this.W, this.H) * 0.055;
    if (Math.abs(dx) < thr && Math.abs(dy) < thr) return;
    s.fired = true;
    if (Math.abs(dx) > Math.abs(dy)) this.swipe(dx > 0 ? 'right' : 'left');
    else                            this.swipe(dy > 0 ? 'down' : 'up');
  }

  pointerUp() {
    const s = this._sw; this._sw = null;
    if (!s || s.fired) return;
    if (this.state === 'intro') this.state = 'run';
    else if (this.state === 'over') { this.reset(); this.state = 'run'; }
  }

  // ── Generación de obstáculos ──────────────────────────────────────────────
  // Cada "fila" deja siempre una salida: o un carril libre, o los tres con el
  // mismo obstáculo (y ahí se pasa saltando o agachándose).
  _spawnRow() {
    const diff = this._diff;
    const wz = this.nextWz;

    // Carriles todavía tapados por un tren de la fila anterior
    const busy = [0, 1, 2].filter(l => this.laneFree[l] > wz);

    const pool = diff < 0.15 ? ['valla']
               : diff < 0.30 ? ['valla', 'bloque']
               : diff < 0.50 ? ['valla', 'viga', 'bloque']
               :               ['valla', 'viga', 'bloque', 'tren'];
    const pick = () => pool[Math.floor(Math.random() * pool.length)];

    let used = [];
    if (busy.length === 0 && diff > 0.45 && Math.random() < 0.18) {
      // Fila completa del mismo tipo: se pasa con la acción correcta.
      const kind = Math.random() < 0.5 ? 'valla' : 'viga';
      for (const l of [0, 1, 2]) { this._add(kind, l, wz); used.push(l); }
    } else {
      // Con dos carriles tapados se tapan SIEMPRE los de los costados, así el
      // libre es el del medio: desde cualquier lado se sale con un solo swipe.
      // Tapar dos pegados (0 y 1) obligaría a encadenar dos gestos seguidos y
      // es imposible para una nena a la velocidad final.
      let want = diff > 0.25 && Math.random() < 0.45
        ? [0, 2]
        : [Math.floor(Math.random() * 3)];
      want = want.filter(l => !busy.includes(l));
      while (busy.length + want.length >= 3) want.pop();   // nunca los 3 tapados
      for (const l of want) { this._add(pick(), l, wz); used.push(l); }
    }

    // La próxima fila se separa por tiempo de reacción, no por distancia fija:
    // cuanto más rápido va, más lejos nace, pero el margen se va achicando.
    const react = lerp(1.55, 0.78, diff);
    this.nextWz = wz + this.speed * react + 4 + Math.random() * 6;

    // Monedas en un carril que quede libre (a veces en arco, para saltarlas).
    // Se recortan para no meterse adentro de los obstáculos de la fila siguiente.
    const free = [0, 1, 2].filter(l => !used.includes(l) && this.laneFree[l] <= wz);
    if (free.length && Math.random() < 0.75) {
      const l = free[Math.floor(Math.random() * free.length)];
      const room = Math.floor((this.nextWz - 3 - wz) / 1.9) + 1;
      const arc = Math.random() < 0.35 && room >= 5;
      const n = Math.min(arc ? 5 + Math.floor(Math.random() * 2) : 3 + Math.floor(Math.random() * 4),
                         Math.max(0, room));
      for (let i = 0; i < n; i++) {
        const t = n > 1 ? i / (n - 1) : 0;
        this.obs.push({
          coin: true, x: LANE_X[l], wz: wz + i * 1.9,
          y: arc ? 1.0 + Math.sin(t * Math.PI) * 1.9 : 1.0, got: false,
        });
      }
    }
  }

  _add(kind, lane, wz) {
    const k = KINDS[kind];
    this.obs.push({ kind, x: LANE_X[lane], wz, lane });
    this.laneFree[lane] = wz + k.d + 2;
  }

  // ── Update ────────────────────────────────────────────────────────────────
  update(dt) {
    this._layout();
    if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }
    this.shake = Math.max(0, this.shake - dt * 3);
    this.flash = Math.max(0, this.flash - dt * 2.2);
    if (this.state !== 'run') { this.runPhase += dt * 6; return; }

    this.time += dt;
    const diff = this._diff;

    // Velocidad: sube con el tiempo y baja un ratito después de un golpe.
    const target = lerp(SPD0, SPD_MAX, diff);
    const hurtMul = this.hurtT > 0 ? lerp(0.55, 1, 1 - this.hurtT / HURT_T) : 1;
    this.speed += (target * hurtMul - this.speed) * Math.min(1, dt * 1.6);
    this.dist  += this.speed * dt;
    if (this.hurtT > 0) this.hurtT = Math.max(0, this.hurtT - dt);

    const lvl = 1 + Math.floor(this.dist / LEVEL_M);
    if (lvl > this.level) {
      this.level = lvl;
      const th = this._themeAt(lvl);
      this.toast = { txt: `¡Nivel ${lvl}!`, sub: `${th.emoji} ${th.name}`, t: 1.8 };
      Sound.serveGood();
    }

    // Carril + salto + agachada
    this.px += (LANE_X[this.lane] - this.px) * Math.min(1, dt * 13);
    this.camX += (this.px * 0.55 - this.camX) * Math.min(1, dt * 6);
    if (this.air) {
      this.vy -= GRAVITY * dt;
      this.py += this.vy * dt;
      if (this.py <= 0) { this.py = 0; this.vy = 0; this.air = false; }
    }
    if (this.slideT > 0) this.slideT = Math.max(0, this.slideT - dt);
    this.runPhase += dt * (6 + this.speed * 0.45);

    while (this.nextWz - this.dist < DRAW_Z) this._spawnRow();
    this._collide();
    this.obs = this.obs.filter(o => o.wz + (o.kind ? KINDS[o.kind].d : 0) - this.dist > CULL_Z);
  }

  _collide() {
    const ph = this._playerH, py = this.py;
    const pw = 1.0, pz0 = -0.45, pz1 = 0.45;
    for (const o of this.obs) {
      const z = o.wz - this.dist;
      if (o.coin) {
        if (o.got || z > 1.2 || z < -1.2) continue;
        if (Math.abs(o.x - this.px) > 1.15) continue;
        // Se agarra lo que está al alcance de la mano: de los pies hasta un
        // poquito más arriba de la cabeza. Con más tolerancia que esto, las
        // monedas del arco se juntaban sin saltar y el arco no servía de nada.
        if (o.y < py - 0.35 || o.y > py + ph + 0.15) continue;
        o.got = true; this.coins++; Sound.add();
        continue;
      }
      const k = KINDS[o.kind];
      if (z > pz1 || z + k.d < pz0) continue;                 // todavía no / ya pasó
      if (Math.abs(o.x - this.px) > (k.w + pw) / 2) continue; // otro carril
      if (py + ph <= k.y0 + 0.02 || py >= k.y0 + k.h - 0.02) continue; // por arriba / por abajo
      if (this.hurtT > 0) continue;
      this._hit(o);
    }
  }

  _hit(o) {
    this.lives--;
    this.hurtT = HURT_T;
    this.shake = 1;
    this.flash = 1;
    // Empuja al personaje fuera del obstáculo para que no lo golpee dos veces.
    o.wz = this.dist - 6;
    Sound.serveBad();
    if (this.lives <= 0) this._gameOver();
  }

  _gameOver() {
    this.state = 'over';
    const m = Math.floor(this.dist);
    if (m > this.best) { this.best = m; try { localStorage.setItem('dash_best', m); } catch (e) {} }
    this._bank();
    Sound.timeout();
  }

  _bank() {
    if (this.banked || this.coins <= 0) return;
    this.banked = true;
    addCoins(this.coins);
  }

  // ── Dibujo de primitivas 3D ───────────────────────────────────────────────
  _quad(ctx, pts, fill) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
  }

  // Cajón con las tres caras que se ven desde la cámara.
  _box(ctx, x, y0, w, h, d, z, c) {
    if (z + d < NEAR_Z) return;
    const xl = x - w / 2, xr = x + w / 2, yb = y0, yt = y0 + h;
    const zn = Math.max(z, NEAR_Z), zf = z + d;
    const nbl = this._p(xl, yb, zn), nbr = this._p(xr, yb, zn);
    const ntl = this._p(xl, yt, zn), ntr = this._p(xr, yt, zn);
    const fbl = this._p(xl, yb, zf), fbr = this._p(xr, yb, zf);
    const ftl = this._p(xl, yt, zf), ftr = this._p(xr, yt, zf);

    // Sombra en el piso
    const sh = this._p(x, 0, (zn + zf) / 2);
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(sh.x, sh.y, w * 0.62 * sh.s, w * 0.2 * sh.s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (CAM_Y > yt) this._quad(ctx, [ntl, ntr, ftr, ftl], c.top);      // techo
    else            this._quad(ctx, [nbl, nbr, fbr, fbl], c.side);     // piso (vigas altas)
    if (x > this.camX)      this._quad(ctx, [nbl, ntl, ftl, fbl], c.side);
    else if (x < this.camX) this._quad(ctx, [nbr, ntr, ftr, fbr], c.side);
    this._quad(ctx, [nbl, ntl, ntr, nbr], c.front);                    // frente

    // Detalle del frente para que no sea un rectángulo plano
    const fw = ntr.x - ntl.x, fh = nbl.y - ntl.y;
    if (fw > 6) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(ntl.x, ntl.y, fw, fh);
      ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(ntl.x, ntl.y, fw, fh * 0.16);
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      for (let i = 1; i < 4; i++) ctx.fillRect(ntl.x + fw * i / 4 - fw * 0.012, ntl.y, fw * 0.024, fh);
      ctx.restore();
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  render(ctx) {
    this._layout();
    const { W, H } = this;
    ctx.save();
    if (this.shake > 0) {
      const k = this.shake * this.shake * 14 * this.s;
      ctx.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
    }

    const T = this._theme();
    this._sky(ctx, T);
    this._ground(ctx, T);
    this._scenery(ctx, T);

    // Painter: de lejos a cerca. El personaje va en z = 0, así que lo que ya
    // pasó de largo (z < 0) se dibuja después y tapa como corresponde.
    const items = this.obs.map(o => ({ o, z: o.wz - this.dist }))
                          .filter(it => it.z < DRAW_Z && !(it.o.coin && it.o.got));
    items.push({ player: true, z: 0 });
    items.sort((a, b) => b.z - a.z);
    for (const it of items) {
      if (it.player) this._runner(ctx);
      else if (it.o.coin) this._coin(ctx, it.o, it.z);
      else { const k = KINDS[it.o.kind]; this._box(ctx, it.o.x, k.y0, k.w, k.h, k.d, it.z, k); }
    }

    this._speedLines(ctx);
    ctx.restore();

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,60,90,${this.flash * 0.35})`;
      ctx.fillRect(0, 0, W, H);
    }
    this._hud(ctx);
    if (this.state === 'intro') this._intro(ctx);
    if (this.state === 'over')  this._over(ctx);
  }

  _sky(ctx, T) {
    const { W, H } = this;
    const g = ctx.createLinearGradient(0, 0, 0, this.horizon + 2);
    g.addColorStop(0, T.skyTop); g.addColorStop(1, T.skyBot);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, this.horizon + 2);

    // Estrellas (se encienden de noche)
    if (T.star > 0.02) {
      ctx.fillStyle = '#FFFFFF';
      for (let i = 0; i < 70; i++) {
        const sx = ((hash(i) + this.camX * 0.0012) % 1) * W;
        const sy = hash(i + 77) * this.horizon * 0.92;
        ctx.globalAlpha = T.star * (0.35 + hash(i + 5) * 0.65) *
                          (0.7 + 0.3 * Math.sin(this.time * 2 + i));
        ctx.fillRect(sx, sy, 2, 2);
      }
      ctx.globalAlpha = 1;
    }

    const sunX = W * 0.72 - this.camX * 12, sunY = this.horizon - H * T.sunY;
    ctx.fillStyle = T.sun;
    ctx.beginPath(); ctx.arc(sunX, sunY, H * 0.075, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.25;
    ctx.beginPath(); ctx.arc(sunX, sunY, H * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    // Nubes con parallax lento
    ctx.fillStyle = `rgba(255,255,255,${T.cloud})`;
    for (let i = 0; i < 5; i++) {
      const cx = ((i * 0.27 + this.dist * 0.0008) % 1.3 - 0.15) * W - this.camX * 8;
      const cy = this.horizon - H * (0.12 + hash(i) * 0.2);
      const r  = H * (0.026 + hash(i + 9) * 0.022);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.arc(cx + r, cy + r * 0.2, r * 0.8, 0, Math.PI * 2);
      ctx.arc(cx - r, cy + r * 0.25, r * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cerros del fondo
    ctx.fillStyle = T.hills;
    ctx.beginPath();
    ctx.moveTo(0, this.horizon + 2);
    for (let x = 0; x <= W; x += W / 28) {
      const t = x / W + this.dist * 0.00035 + this.camX * 0.004;
      const y = this.horizon - H * (0.02 + 0.055 * (Math.sin(t * 9) * 0.5 + 0.5) * (0.6 + 0.4 * Math.sin(t * 23)));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, this.horizon + 2);
    ctx.closePath(); ctx.fill();
  }

  _ground(ctx, T) {
    const { W, H } = this;
    ctx.fillStyle = T.grass;
    ctx.fillRect(0, this.horizon, W, H - this.horizon);

    const zN = -CAM_Z + 1.2, zF = DRAW_Z;
    const road = T.road;
    this._quad(ctx, [this._p(-ROAD_HALF, 0, zN), this._p(ROAD_HALF, 0, zN),
                     this._p(ROAD_HALF, 0, zF), this._p(-ROAD_HALF, 0, zF)], road);

    // Banquina a rayas + rayas de carril: se mueven con `dist`, y eso es lo que
    // da la sensación de velocidad.
    const first = Math.floor(this.dist / SEG);
    const n = Math.ceil(DRAW_Z / SEG);
    // Se arranca dos segmentos "atrás" y se recorta contra el plano de la
    // cámara: el tramo que ya pasamos todavía se ve al pie de la pantalla, y
    // sin el recorte la proyección se da vuelta y deja la banquina cortada.
    for (let i = n; i >= -2; i--) {
      const idx = first + i;
      const zRaw = idx * SEG - this.dist, z1 = zRaw + SEG;
      if (z1 <= zN) continue;
      const z0 = Math.max(zRaw, zN);
      const alt = (idx & 1) === 0;
      const rum = alt ? T.rumble : mixHex('#FFFFFF', '#C9CEE8', T.star);
      for (const sgn of [-1, 1]) {
        this._quad(ctx, [this._p(sgn * ROAD_HALF, 0, z0), this._p(sgn * (ROAD_HALF + 0.9), 0, z0),
                         this._p(sgn * (ROAD_HALF + 0.9), 0, z1), this._p(sgn * ROAD_HALF, 0, z1)], rum);
      }
      if (alt) {
        const zm = zRaw + SEG * 0.55;
        if (zm <= z0) continue;
        for (const lx of [-1.1, 1.1]) {
          this._quad(ctx, [this._p(lx - 0.09, 0.01, z0), this._p(lx + 0.09, 0.01, z0),
                           this._p(lx + 0.09, 0.01, zm), this._p(lx - 0.09, 0.01, zm)], 'rgba(255,255,255,0.85)');
        }
      }
    }
  }

  // Árboles y farolas al costado, generados por segmento (sin estado).
  _scenery(ctx, T) {
    const first = Math.floor(this.dist / SEG);
    const n = Math.ceil(DRAW_Z / SEG);
    for (let i = n; i >= 0; i--) {
      const idx = first + i;
      const z = idx * SEG - this.dist;
      if (z + CAM_Z < 1) continue;
      for (const sgn of [-1, 1]) {
        const hv = hash(idx * 2 + (sgn > 0 ? 1 : 0));
        if (hv > 0.55) continue;
        // Bien lejos del asfalto a propósito: un árbol o un poste pegado al
        // borde queda, al pasar al lado nuestro, como una barra vertical que
        // parece un error de dibujo. A esta distancia ya salió de cuadro.
        const x = sgn * (ROAD_HALF + 4.6 + hv * 4.5);
        if (hv < 0.14) {                                  // farola
          const p0 = this._p(x, 0, z), p1 = this._p(x, 4.2, z);
          ctx.strokeStyle = mixHex('#55506B', '#2A2740', T.lamp); ctx.lineWidth = Math.max(1, 0.16 * p0.s);
          ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
          const bulbR = Math.max(1.5, 0.34 * p0.s);
          if (T.lamp > 0.05) {                            // halo de la luz prendida
            ctx.globalAlpha = T.lamp * 0.35; ctx.fillStyle = '#FFE9A8';
            ctx.beginPath(); ctx.arc(p1.x, p1.y, bulbR * 2.6, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
          }
          ctx.fillStyle = mixHex('#DDE3EE', '#FFE9A8', T.lamp);
          ctx.beginPath(); ctx.arc(p1.x, p1.y, bulbR, 0, Math.PI * 2); ctx.fill();
        } else {                                          // arbolito
          const th = 2.6 + hash(idx + 31) * 2.2;
          const p0 = this._p(x, 0, z), p1 = this._p(x, th, z);
          ctx.strokeStyle = mixHex('#7A4B2A', '#2E2436', T.star); ctx.lineWidth = Math.max(1, 0.26 * p0.s);
          ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
          ctx.fillStyle = hv < 0.34 ? T.tree : mixHex(T.tree, '#FFFFFF', 0.12);
          const r = Math.max(2, (0.75 + hash(idx + 7) * 0.4) * p0.s);
          ctx.beginPath();
          ctx.arc(p1.x, p1.y, r, 0, Math.PI * 2);
          ctx.arc(p1.x - r * 0.6, p1.y + r * 0.5, r * 0.7, 0, Math.PI * 2);
          ctx.arc(p1.x + r * 0.6, p1.y + r * 0.5, r * 0.7, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  _coin(ctx, o, z) {
    if (z < -1) return;
    const p = this._p(o.x, o.y, z);
    const r = 0.42 * p.s;
    if (r < 0.7) return;
    const spin = Math.abs(Math.cos(this.time * 4 + o.wz * 0.6));   // moneda girando
    ctx.save();
    ctx.fillStyle = '#FFC93C';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, Math.max(0.6, r * spin), r, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#E09B12'; ctx.lineWidth = Math.max(1, r * 0.16); ctx.stroke();
    if (r > 5 && spin > 0.35) {
      ctx.fillStyle = '#FFE8A3';
      ctx.beginPath(); ctx.ellipse(p.x, p.y, Math.max(0.4, r * spin * 0.45), r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  _runner(ctx) {
    const feet = this._p(this.px, this.py, 0);
    const gp   = this._p(this.px, 0, 0);
    const sliding = this.slideT > 0;
    const h = (sliding ? SLIDE_H : RUN_H) * feet.s;

    // Sombra (se achica al saltar)
    const shrink = clamp(1 - this.py / 2.6, 0.35, 1);
    ctx.save();
    ctx.globalAlpha = 0.3 * shrink;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(gp.x, gp.y, 0.62 * gp.s * shrink, 0.2 * gp.s * shrink, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Corriendo en el piso: alterna los dos cuadros de zancada. Saltando o
    // agachada usa la pose única (no hay dibujo para esas poses) y se anima
    // por código, como antes.
    let img = null;
    if (!this.air && !sliding) {
      img = Math.sin(this.runPhase) >= 0 ? IMG.corre1 : IMG.corre2;
      if (!ready(img)) img = ready(IMG.jugadora) ? IMG.jugadora : null;
    } else if (ready(IMG.jugadora)) {
      img = IMG.jugadora;
    }

    if (img) this._runnerSprite(ctx, feet, h, sliding, img);
    else      this._runnerVector(ctx, feet, h, sliding);
  }

  // Sprite ilustrado, visto de espaldas (encaja con la cámara al hombro).
  // Corriendo alterna 2 cuadros; saltando/agachada usa la pose única de
  // `jugadora.png` y la corrida/salto/agachada se fingen por código
  // (bamboleo, inclinación y estirado/achicado), como en Panaderia.js.
  _runnerSprite(ctx, feet, h, sliding, img) {
    const blink = this.hurtT > 0 && Math.floor(this.hurtT * 12) % 2 === 0;
    const w = h * (img.naturalWidth / img.naturalHeight);
    const ph = this.runPhase;

    let oy = 0, rot = 0, scaleX = 1, scaleY = 1;
    if (sliding) {
      // `h` ya viene achicado a SLIDE_H: sólo hace falta ensanchar un poco,
      // sin volver a aplastar (si no, se aplasta dos veces) ni levantar los
      // pies del piso.
      scaleX = 1.18;
    } else if (this.air) {
      const t = clamp(this.vy / JUMP_V, -1, 1);                // >0 subiendo, <0 cayendo
      scaleY = 1 + 0.12 * t; scaleX = 1 - 0.06 * t;             // estirado al subir, achicado al caer
      rot = t * 0.05;
    } else {
      oy = Math.abs(Math.sin(ph)) * h * 0.045;                 // pique al pisar
      rot = Math.sin(ph) * 0.045;
    }

    ctx.save();
    if (blink) ctx.globalAlpha = 0.35;
    ctx.translate(feet.x, feet.y - oy);
    ctx.rotate(rot);
    ctx.scale(scaleX, scaleY);
    ctx.drawImage(img, -w / 2, -h, w, h);
    ctx.restore();
  }

  // Personaje chibi dibujado por código (fallback mientras carga el sprite):
  // se personaliza con los colores del vestidor y se anima por código
  // (piernas, brazos, salto y panza al agacharse).
  _runnerVector(ctx, feet, h, sliding) {
    const blink = this.hurtT > 0 && Math.floor(this.hurtT * 12) % 2 === 0;
    const look = this.look || {};
    const skin = '#F7D5B5';
    const hair = look.hairColor || '#EDEDED';
    const top  = look.topColor  || '#F2A7BB';
    const bot  = look.bottomColor || '#7EC8E3';
    const ph   = this.runPhase;
    const swing = this.air ? 0.5 : Math.sin(ph);
    const swing2 = this.air ? -0.9 : Math.sin(ph + Math.PI);

    ctx.save();
    if (blink) ctx.globalAlpha = 0.35;                      // titila, pero no desaparece
    ctx.translate(feet.x, feet.y);
    if (sliding) { ctx.scale(1.25, 1); }                    // agachado: más ancho y bajo
    const bob = this.air ? 0 : Math.abs(Math.sin(ph)) * h * 0.04;
    ctx.translate(0, -bob);

    const bodyW = h * 0.42, bodyH = h * 0.34, legH = h * 0.28;
    const hipY = -legH;
    const headR = h * 0.23;

    // Piernas: la que va adelante también se levanta, si no en el cuadro en que
    // se cruzan se ven como una sola.
    const foot = (side, sw) => ({
      hx: side * bodyW * 0.28,
      x: side * bodyW * 0.28 + sw * h * 0.17,
      y: hipY + legH * (this.air ? 0.62 : 1 - Math.max(0, sw) * 0.3),
    });
    ctx.lineCap = 'round';
    for (const [side, sw] of [[-1, swing], [1, swing2]]) {
      const f = foot(side, sw);
      ctx.strokeStyle = bot; ctx.lineWidth = h * 0.095;
      ctx.beginPath(); ctx.moveTo(f.hx, hipY); ctx.lineTo(f.x, f.y); ctx.stroke();
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = h * 0.075;   // zapatilla
      ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + h * 0.07, f.y); ctx.stroke();
    }
    // Cuerpo
    ctx.fillStyle = top;
    ctx.beginPath();
    ctx.roundRect(-bodyW / 2, hipY - bodyH, bodyW, bodyH + h * 0.03, bodyW * 0.35);
    ctx.fill();
    // Brazos: salen del hombro hacia afuera del cuerpo, si no quedan tapados
    ctx.strokeStyle = skin; ctx.lineWidth = h * 0.085;
    for (const [side, sw] of [[-1, swing2], [1, swing]]) {
      const shX = side * bodyW * 0.42, shY = hipY - bodyH * 0.88;
      ctx.beginPath();
      ctx.moveTo(shX, shY);
      ctx.lineTo(shX + side * h * 0.07, this.air ? shY - bodyH * 0.5 : shY + bodyH * (0.5 + sw * 0.35));
      ctx.stroke();
    }
    // Cabeza
    const headY = hipY - bodyH - headR * 0.85;
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(0, headY, headR, 0, Math.PI * 2); ctx.fill();
    // Pelo (visto de atrás: se ve casi toda la nuca)
    ctx.fillStyle = hair;
    ctx.beginPath(); ctx.arc(0, headY - headR * 0.12, headR * 0.97, Math.PI * 0.92, Math.PI * 2.08); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, headY + headR * 0.1, headR * 0.9, headR * 0.75, 0, 0, Math.PI); ctx.fill();
    if ((look.hair || 'buns') === 'buns') {
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(sx * headR * 0.95, headY - headR * 0.55, headR * 0.42, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  _speedLines(ctx) {
    const k = (this.speed - SPD0) / (SPD_MAX - SPD0);
    if (this.state !== 'run' || k < 0.25) return;
    const { W, H } = this;
    ctx.save();
    ctx.strokeStyle = `rgba(255,255,255,${0.06 + k * 0.16})`;
    ctx.lineWidth = Math.max(1, 2 * this.s);
    const cx = W / 2, cy = this.horizon;
    for (let i = 0; i < 14; i++) {
      const a = hash(i) * Math.PI * 2 + this.dist * 0.02;
      const r0 = H * (0.25 + hash(i + 5) * 0.3);
      const r1 = r0 + H * 0.16 * (0.5 + k);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.8);
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 0.8);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── HUD y carteles ────────────────────────────────────────────────────────
  _heart(ctx, cx, cy, r, fill) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + r * 0.72);
    ctx.bezierCurveTo(cx - r * 1.45, cy - r * 0.35, cx - r * 0.5, cy - r * 1.2, cx, cy - r * 0.3);
    ctx.bezierCurveTo(cx + r * 0.5, cy - r * 1.2, cx + r * 1.45, cy - r * 0.35, cx, cy + r * 0.72);
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
  }

  _hud(ctx) {
    const { W, H } = this;
    const s = this.s;
    ctx.textBaseline = 'top';

    // Vidas
    const r = 13 * s;
    for (let i = 0; i < MAX_LIVES; i++) {
      this._heart(ctx, 22 * s + i * r * 2.6, 30 * s, r, i < this.lives ? '#FF4D6D' : 'rgba(255,255,255,0.22)');
    }

    // Metros y monedas
    ctx.textAlign = 'right';
    ctx.font = `900 ${34 * s}px system-ui`;
    ctx.fillStyle = '#fff';
    ctx.fillText(`${Math.floor(this.dist)} m`, W - 18 * s, 14 * s);
    ctx.font = `bold ${22 * s}px system-ui`;
    ctx.fillStyle = '#FFD84D';
    ctx.fillText(`🪙 ${this.coins}`, W - 18 * s, 52 * s);
    if (this.best > 0) {
      ctx.font = `${16 * s}px system-ui`;
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fillText(`récord ${this.best} m`, W - 18 * s, 80 * s);
    }

    // Nivel (no hay último: sigue subiendo cada LEVEL_M metros)
    const th = this._themeAt(this.level);
    ctx.textAlign = 'left';
    ctx.font = `bold ${18 * s}px system-ui`;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(`Nivel ${this.level}  ${th.emoji}`, 22 * s, 48 * s);
    // Barrita de lo que falta para el próximo
    const pw2 = 86 * s, px2 = 22 * s, py2 = 72 * s, phh = 5 * s;
    const frac = (this.dist % LEVEL_M) / LEVEL_M;
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath(); ctx.roundRect(px2, py2, pw2, phh, phh / 2); ctx.fill();
    ctx.fillStyle = '#FFD84D';
    ctx.beginPath(); ctx.roundRect(px2, py2, pw2 * frac, phh, phh / 2); ctx.fill();

    if (this.toast) {
      const a = clamp(this.toast.t / 0.4, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `900 ${54 * s}px system-ui`;
      ctx.fillStyle = '#FFD84D';
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 6 * s;
      ctx.strokeText(this.toast.txt, W / 2, H * 0.24);
      ctx.fillText(this.toast.txt, W / 2, H * 0.24);
      if (this.toast.sub) {
        ctx.font = `bold ${26 * s}px system-ui`;
        ctx.lineWidth = 4 * s;
        ctx.fillStyle = '#fff';
        ctx.strokeText(this.toast.sub, W / 2, H * 0.24 + 46 * s);
        ctx.fillText(this.toast.sub, W / 2, H * 0.24 + 46 * s);
      }
      ctx.restore();
    }
  }

  _panel(ctx, h) {
    const { W, H } = this;
    ctx.fillStyle = 'rgba(10,6,22,0.72)';
    ctx.fillRect(0, 0, W, H);
    const pw = Math.min(W * 0.8, 560 * this.s), ph = h * this.s;
    const px = W / 2 - pw / 2, py = H / 2 - ph / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 26 * this.s); ctx.fill(); ctx.stroke();
    return { px, py, pw, ph };
  }

  _intro(ctx) {
    const { W } = this;
    const s = this.s;
    const { py, ph } = this._panel(ctx, 330);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `900 ${44 * s}px system-ui`;
    ctx.fillStyle = '#7CFFB2';
    ctx.fillText('DASH 3D', W / 2, py + 46 * s);
    ctx.font = `bold ${21 * s}px system-ui`;
    ctx.fillStyle = '#fff';
    const lines = [
      '⬅ ➡  deslizá para cambiar de carril',
      '⬆  deslizá para arriba y saltá la valla',
      '⬇  deslizá para abajo y pasá por debajo',
      '🪙 juntá monedas · ❤️ tenés 3 vidas',
    ];
    lines.forEach((t, i) => ctx.fillText(t, W / 2, py + 110 * s + i * 40 * s));
    ctx.font = `bold ${24 * s}px system-ui`;
    ctx.fillStyle = '#FFD84D';
    ctx.fillText('Tocá para arrancar', W / 2, py + ph - 34 * s);
  }

  _over(ctx) {
    const { W } = this;
    const s = this.s;
    const { py, ph } = this._panel(ctx, 300);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `900 ${48 * s}px system-ui`;
    ctx.fillStyle = '#FF6B8B';
    ctx.fillText('¡Chocaste!', W / 2, py + 52 * s);
    ctx.font = `bold ${30 * s}px system-ui`;
    ctx.fillStyle = '#fff';
    ctx.fillText(`${Math.floor(this.dist)} metros`, W / 2, py + 116 * s);
    ctx.font = `bold ${24 * s}px system-ui`;
    ctx.fillStyle = '#FFD84D';
    ctx.fillText(`🪙 ${this.coins} monedas`, W / 2, py + 158 * s);
    ctx.font = `${19 * s}px system-ui`;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(Math.floor(this.dist) >= this.best ? '¡Nuevo récord!' : `récord: ${this.best} m`, W / 2, py + 198 * s);
    ctx.font = `bold ${23 * s}px system-ui`;
    ctx.fillStyle = '#7CFFB2';
    ctx.fillText('Tocá para jugar de nuevo', W / 2, py + ph - 34 * s);
  }

  destroy() { this._bank(); }
}
