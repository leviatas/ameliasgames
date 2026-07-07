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
};

const SAVE_KEY   = 'panaderia_state';
const MAX_PLOTS  = 8;
const GROW_TIME  = 10;    // seg. para que el trigo madure
const MILL_TIME  = 3.5;   // seg. de molienda por trigo
const OVEN_TIME  = 4.5;   // seg. de horneado por pan
const MAX_GROUND_SEEDS = 6;
const FIELD_PRICES = [60, 100, 170, 280, 450, 700];   // campos 3..8 (arrancás con 2)

const WORKERS = [
  { key: 'granjero', name: 'Granjero', emoji: '🧑‍🌾', price: 180, desc: 'Junta, planta y cosecha' },
  { key: 'molinero', name: 'Molinero', emoji: '🧑‍🏭', price: 220, desc: 'Muele el trigo solo' },
  { key: 'panadero', name: 'Panadero', emoji: '🧑‍🍳', price: 260, desc: 'Hornea el pan solo' },
  { key: 'vendedor', name: 'Vendedor', emoji: '🧑‍💼', price: 300, desc: 'Atiende el mostrador' },
];

const CUSTOMER_COLORS = [
  ['#C49BE0', '#7A4FA8'], ['#8FD0F0', '#3A7AA8'], ['#FFB6A0', '#C06040'],
  ['#A8E0A0', '#4E9048'], ['#F6D080', '#B08828'], ['#F0A0C8', '#B04878'],
];

export class Panaderia {
  constructor(canvas, look) {
    this.canvas = canvas;
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

    // estado persistente
    this.money   = 0;
    this.inv     = { seed: 0, wheat: 0, flour: 0, bread: 0 };
    this.workers = { granjero: false, molinero: false, panadero: false, vendedor: false };
    this.plots   = [];
    let nPlots = 2;
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (s) {
        this.money = s.money | 0;
        if (s.inv) for (const k of Object.keys(this.inv)) this.inv[k] = s.inv[k] | 0;
        if (s.workers) for (const k of Object.keys(this.workers)) this.workers[k] = !!s.workers[k];
        nPlots = Math.max(2, Math.min(MAX_PLOTS, s.plots | 0 || 2));
      }
    } catch (e) {}
    for (let i = 0; i < nPlots; i++) this.plots.push({ state: 'empty', t: 0 });

    this.mill = { busy: false, t: 0 };
    this.oven = { busy: false, t: 0 };
  }

  _save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        money: this.money, inv: this.inv, workers: this.workers, plots: this.plots.length,
      }));
    } catch (e) {}
  }

  // ── Layout (recalculado por frame; independiente de la resolución) ─────────
  _layout() {
    const W = this.canvas.width, H = this.canvas.height;
    const s = Math.max(0.5, Math.min(1.0, Math.min(W, H) / 720));

    // campos: grilla 4×2 a la izquierda
    const fa = { x: W * 0.03, y: H * 0.27, w: W * 0.40, h: H * 0.40 };
    const cols = 4, rows = 2;
    const gap = 8 * s;
    const pw = (fa.w - gap * (cols - 1)) / cols;
    const ph = (fa.h - gap * (rows - 1)) / rows;
    const plotRects = [];
    for (let i = 0; i < MAX_PLOTS; i++) {
      const c = i % cols, r = Math.floor(i / cols);
      plotRects.push({ x: fa.x + c * (pw + gap), y: fa.y + r * (ph + gap), w: pw, h: ph });
    }

    const bush = { x: W * 0.095, y: H * 0.76, r: Math.min(W, H) * 0.075 };
    const seedZone = { x: W * 0.17, y: H * 0.68, w: W * 0.26, h: H * 0.17 };

    const mill = { x: W * 0.525, y: H * 0.47, w: W * 0.105, h: H * 0.34 };

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
    const sgap = 8 * s;
    const sy = H * 0.885, bh = H * 0.10;
    const bw = (W * 0.96 - sgap * 4) / 5;
    const items = [{ kind: 'field' }, ...WORKERS.map(w => ({ kind: 'worker', worker: w }))];
    items.forEach((it, i) => {
      shop.push({ ...it, x: W * 0.02 + i * (bw + sgap), y: sy, w: bw, h: bh });
    });

    return { W, H, s, plotRects, bush, seedZone, mill, bld, counter, counterBox, oven, custXs, custY, shop };
  }

  // dibuja una imagen anclada abajo-centro con una altura dada (mantiene aspecto)
  _imgH(ctx, img, cx, bottomY, h) {
    const w = h * (img.naturalWidth / img.naturalHeight);
    ctx.drawImage(img, cx - w / 2, bottomY - h, w, h);
    return w;
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
  _loadOven(L) {
    this.inv.flour--;
    this.oven.busy = true; this.oven.t = 0;
    this._float(L.oven.x + L.oven.w / 2, L.oven.y, 'horneando…', '#B05020');
    Sound.pick();
  }
  _sell(ci, L) {
    const c = this.customers[ci];
    this.inv.bread -= c.want;
    const gain = c.want * (12 + Math.floor(Math.random() * 5));
    this.money += gain;
    addCoins(5 * c.want);
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

  pointer(px, py) {
    const L = this._layout();
    const { s } = L;

    // tienda (UI instantánea, sin caminar)
    for (const b of L.shop) {
      if (!this._inRect(px, py, b)) continue;
      if (b.kind === 'field') {
        if (this.plots.length >= MAX_PLOTS) { this._flash('¡Ya tenés todos los campos!'); return; }
        const price = FIELD_PRICES[this.plots.length - 2];
        if (this.money < price) { this._flash('Te falta dinero 💰'); return; }
        this.money -= price;
        this.plots.push({ state: 'empty', t: 0 });
        this._float(b.x + b.w / 2, b.y, '¡Nuevo campo!');
        Sound.serveGood();
        this._save();
      } else {
        if (this.workers[b.worker.key]) { this._flash(`Ya tenés ${b.worker.name.toLowerCase()} ✓`); return; }
        if (this.money < b.worker.price) { this._flash('Te falta dinero 💰'); return; }
        this.money -= b.worker.price;
        this.workers[b.worker.key] = true;
        this._float(b.x + b.w / 2, b.y, `¡${b.worker.name} contratado!`);
        Sound.serveGood();
        this._save();
      }
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

    // horno → llevar la harina
    if (this._inRect(px, py, L.oven)) {
      if (this.oven.busy) return;
      if (this.inv.flour <= 0) { this._flash('No tenés harina'); return; }
      this._goTo(L.oven.x + L.oven.w / 2, L.oven.y + L.oven.h + 14 * s, { type: 'oven' });
      return;
    }

    // clientes → llevar el pan al mostrador
    for (let i = 0; i < this.customers.length && i < 3; i++) {
      const c = this.customers[i];
      if (c.leaving) continue;
      const cx = L.custXs[i], cy = L.custY - 55 * s;
      if (Math.hypot(px - cx, py - cy) < 55 * s) {
        if (this.inv.bread < c.want) { this._flash('Falta pan 🍞'); return; }
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
        if (!this.oven.busy && this.inv.flour > 0) this._loadOven(L);
        break;
      }
      case 'customer': {
        const i = this.customers.indexOf(task.cust);
        if (i < 0 || task.cust.leaving) return;  // se fue o ya lo atendieron
        if (this.inv.bread >= task.cust.want) {
          this._sell(i, L);
          this.player.playGesture('jump');
        } else this._flash('Falta pan 🍞');
        break;
      }
    }
  }

  // ── Update ─────────────────────────────────────────────────────────────────
  update(dt) {
    this.t += dt;
    const L = this._layout();

    if (this.msgT > 0) this.msgT -= dt;
    if (this.bushShake > 0) this.bushShake -= dt;
    if (this.bushCooldown > 0) this.bushCooldown -= dt;

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
    this.millAngle += dt * (this.mill.busy ? 3.2 : 0.45);
    if (this.mill.busy) {
      this.mill.t += dt;
      if (this.mill.t >= MILL_TIME) {
        this.mill.busy = false;
        this.inv.flour++;
        this._float(L.mill.x + L.mill.w / 2, L.mill.y, '+1 harina', '#8A6A20');
        Sound.add();
      }
    }

    // horno
    if (this.oven.busy) {
      this.oven.t += dt;
      if (this.oven.t >= OVEN_TIME) {
        this.oven.busy = false;
        this.inv.bread++;
        this._float(L.oven.x + L.oven.w / 2, L.oven.y, '+1 🍞', '#B05020');
        Sound.add();
      }
    }

    // clientes
    this.custSpawnT -= dt;
    if (this.custSpawnT <= 0 && this.customers.length < 3) {
      this.custSpawnT = 7 + Math.random() * 5;
      this.customers.push({
        want: 1 + Math.floor(Math.random() * Math.min(3, 1 + Math.floor(this.money / 150))),
        patience: 30, maxPatience: 30,
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
    if (this.workers.granjero) {
      this.workerT.granjero -= dt;
      if (this.workerT.granjero <= 0) {
        this.workerT.granjero = 1.1;
        const ready = this.plots.findIndex(p => p.state === 'ready');
        const empty = this.plots.findIndex(p => p.state === 'empty');
        if (ready >= 0) this._harvest(ready, L);
        else if (empty >= 0 && this.inv.seed > 0) this._plant(empty);
        else if (this.groundSeeds.length > 0) this._collectSeed(this.groundSeeds.length - 1, true);
      }
    }
    if (this.workers.molinero && !this.mill.busy && this.inv.wheat > 0) {
      this.workerT.molinero -= dt;
      if (this.workerT.molinero <= 0) { this.workerT.molinero = 0.9; this._loadMill(L); }
    }
    if (this.workers.panadero && !this.oven.busy && this.inv.flour > 0) {
      this.workerT.panadero -= dt;
      if (this.workerT.panadero <= 0) { this.workerT.panadero = 0.9; this._loadOven(L); }
    }
    if (this.workers.vendedor) {
      this.workerT.vendedor -= dt;
      if (this.workerT.vendedor <= 0) {
        this.workerT.vendedor = 1.3;
        const i = this.customers.findIndex(c => !c.leaving && this.inv.bread >= c.want);
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
    if (this.inv.wheat > 0 && !this.mill.busy) return 'Llevá el trigo al molino ⚙️';
    if (this.inv.flour > 0 && !this.oven.busy) return 'Horneá la harina en el horno 🔥';
    if (this.customers.some(c => !c.leaving) && this.inv.bread > 0) return '¡Tocá al cliente para venderle pan! 🍞';
    return '';
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  render(ctx) {
    const L = this._layout(), { W, H, s } = L;

    this._drawBackground(ctx, L);
    this._drawFields(ctx, L);
    this._drawBush(ctx, L);
    this._drawSeeds(ctx, L);
    this._drawMill(ctx, L);
    this._drawBakery(ctx, L);
    this._drawPlayer(ctx, L);
    this._drawShop(ctx, L);
    this._drawHUD(ctx, L);

    // textos flotantes
    for (const f of this.floats) {
      ctx.globalAlpha = Math.max(0, 1 - f.life / f.max);
      ctx.fillStyle = f.color;
      ctx.font = `900 ${20 * s}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(f.txt, f.x, f.y);
    }
    ctx.globalAlpha = 1;

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
  }

  _drawBackground(ctx, L) {
    const { W, H, s } = L;
    const skyH = H * 0.16;
    const sky = ctx.createLinearGradient(0, 0, 0, skyH);
    sky.addColorStop(0, '#8ED0F5'); sky.addColorStop(1, '#C8EAFB');
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
    grass.addColorStop(0, '#9BD26E'); grass.addColorStop(1, '#7CBB52');
    ctx.fillStyle = grass; ctx.fillRect(0, skyH, W, H - skyH);

    // caminito de tierra: campos → molino → panadería
    ctx.strokeStyle = '#D8B478'; ctx.lineWidth = 22 * s; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(W * 0.43, H * 0.50);
    ctx.quadraticCurveTo(W * 0.48, H * 0.60, W * 0.575, H * 0.62);
    ctx.quadraticCurveTo(W * 0.66, H * 0.64, W * 0.72, H * 0.58);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // cartel del juego
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#E0A050'; ctx.lineWidth = 3.5 * s;
    ctx.beginPath(); ctx.roundRect(W / 2 - 130 * s, 8 * s, 260 * s, 40 * s, 12 * s); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#B06A20'; ctx.font = `900 ${23 * s}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🍞 PANADERÍA', W / 2, 29 * s);
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
          this._imgH(ctx, IMG.trigo[stage], r.x + r.w / 2, r.y + r.h - 4 * s,
            Math.min(r.h * (stage === 0 ? 0.52 : 0.86) * grow, r.h));
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
          this._imgH(ctx, IMG.trigo[2], r.x + r.w / 2 + sway, r.y + r.h - 4 * s, r.h * 0.98);
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

    // granjero contratado, al lado del arbusto
    if (this.workers.granjero) this._drawWorker(ctx, b.x + b.r * 1.8, b.y + b.r * 0.95, 'granjero', L);
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
      const frac = this.mill.t / MILL_TIME;
      this._progressBar(ctx, cx - 34 * s, m.y + m.h + 8 * s, 68 * s, 9 * s, frac, '#E0A050', s);
    }
    ctx.fillStyle = '#5A4020'; ctx.font = `bold ${13 * s}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Molino', cx, m.y + m.h + (this.mill.busy ? 30 : 16) * s);

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

    // panes sobre el mostrador
    const nShow = Math.min(this.inv.bread, 6);
    for (let k = 0; k < nShow; k++) {
      this._drawBread(ctx, cb.cx - cb.w * 0.36 + k * 28 * s, shelfY, s);
    }
    if (this.inv.bread > 6) {
      ctx.fillStyle = '#7A4A18'; ctx.font = `900 ${14 * s}px system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(`×${this.inv.bread}`, cb.cx - cb.w * 0.36 + 6 * 28 * s, shelfY - 2 * s);
    }
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
      const frac = this.oven.t / OVEN_TIME;
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
    ctx.fillText('Horno', dx, o.y + o.h + (this.oven.busy ? 30 : 16) * s);

    if (this.workers.panadero) this._drawWorker(ctx, o.x - 20 * s, o.y + o.h, 'panadero', L);
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
      ctx.fillText(`🍞×${c.want}`, bx, by - 5 * s);
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
    this.player.draw(ctx, { x: 0, y: 0 }, scaleOf);
    // burbujita con lo que va a hacer/llevar
    if (this.task) {
      const label = this.task.type === 'oven' ? null : {
        bush: '🌳', seed: '🌱',
        plot: this.plots[this.task.idx]?.state === 'ready' ? '🌾' : '🌱',
        mill: '🌾', customer: '🍞',
      }[this.task.type];
      const sc = scaleOf(this.player.y);
      const bx = this.player.x, by = this.player.y - 168 * sc;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(bx, by, 15 * s, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#E0A050'; ctx.lineWidth = 2 * s; ctx.stroke();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (this.task.type === 'oven' && ready(IMG.harina)) {
        // bolsita de harina rumbo al horno
        const h = 22 * s, w = h * (IMG.harina.naturalWidth / IMG.harina.naturalHeight);
        ctx.drawImage(IMG.harina, bx - w / 2, by - h / 2, w, h);
      } else if (this.task.type === 'customer' && ready(IMG.pan)) {
        const w = 22 * s, h = w * (IMG.pan.naturalHeight / IMG.pan.naturalWidth);
        ctx.drawImage(IMG.pan, bx - w / 2, by - h / 2, w, h);
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
    for (const b of L.shop) {
      let label1, label2, afford, owned = false;
      if (b.kind === 'field') {
        if (this.plots.length >= MAX_PLOTS) { owned = true; label1 = '🌾 Campos'; label2 = 'MÁX'; afford = false; }
        else {
          const price = FIELD_PRICES[this.plots.length - 2];
          label1 = '🌾 + Campo'; label2 = `$${price}`; afford = this.money >= price;
        }
      } else {
        owned = this.workers[b.worker.key];
        label1 = `${b.worker.emoji} ${b.worker.name}`;
        label2 = owned ? '✓ contratado' : `$${b.worker.price}`;
        afford = this.money >= b.worker.price;
      }
      ctx.fillStyle = owned ? '#D8EFC8' : afford ? '#7BC86B' : '#C8C0B0';
      ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 10 * s); ctx.fill();
      ctx.strokeStyle = owned ? '#7BAE5B' : 'rgba(0,0,0,0.18)'; ctx.lineWidth = 2 * s; ctx.stroke();
      ctx.fillStyle = owned ? '#4E7A38' : '#fff';
      ctx.textAlign = 'center';
      ctx.font = `900 ${14 * s}px system-ui, sans-serif`;
      ctx.fillText(label1, b.x + b.w / 2, b.y + b.h * 0.42);
      ctx.font = `bold ${13 * s}px system-ui, sans-serif`;
      ctx.fillText(label2, b.x + b.w / 2, b.y + b.h * 0.78);
    }
  }

  _drawHUD(ctx, L) {
    const { s } = L;
    const chips = [
      ['🌱', this.inv.seed],
      ['🌾', this.inv.wheat],
      ['sack', this.inv.flour],
      ['🍞', this.inv.bread],
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
        ctx.textAlign = 'left';
        ctx.fillText(icon, x + 6 * s, y + h / 2 + 1 * s);
      }
      ctx.fillStyle = '#6A4A20';
      ctx.textAlign = 'left';
      ctx.fillText(txt, x + iconW + 8 * s, y + h / 2 + 1 * s);
      x += w + 6 * s;
    }
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
