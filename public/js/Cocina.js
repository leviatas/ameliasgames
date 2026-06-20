import { addFood } from './Pantry.js';

// ── Cooking mini-game: "Cocina con Labubu" ──────────────────────────────────
// Top-down kitchen. Move Labubu (tap / WASD), grab ingredients from baskets,
// take them to stations to transform them (chop / cook), then drop them on the
// plate to assemble the order. Complete the order → served, score up, new order.

const CHEF_FRAMES = ['/assets/labubu_0.png', '/assets/labubu_1.png', '/assets/labubu_2.png']
  .map(src => { const im = new Image(); im.src = src; return im; });
let CHEF_READY = false, _cl = 0;
CHEF_FRAMES.forEach(im => { im.onload = () => { if (++_cl === CHEF_FRAMES.length) CHEF_READY = true; }; });

// Ingredients — raw emoji + emoji once cooked/blended (chopped is drawn as pieces)
const ING = {
  tomate:    { raw: '🍅', name: 'Tomate' },
  lechuga:   { raw: '🥬', name: 'Lechuga' },
  zanahoria: { raw: '🥕', name: 'Zanahoria' },
  queso:     { raw: '🧀', name: 'Queso' },
  cebolla:   { raw: '🧅', name: 'Cebolla' },
  manzana:   { raw: '🍎', blended: '🧃', name: 'Manzana' },
  pan:       { raw: '🍞', name: 'Pan' },
  masa:      { raw: '🫓', name: 'Masa' },
  carne:     { raw: '🥩', cooked: '🍖', name: 'Carne' },
  chorizo:   { raw: '🌭', cooked: '🌭', name: 'Chorizo' },
  pollo:     { raw: '🐔', cooked: '🍗', name: 'Pollo' },
  huevo:     { raw: '🥚', cooked: '🍳', name: 'Huevo' },
  papa:      { raw: '🥔', cooked: '🍟', name: 'Papa' },
  maiz:      { raw: '🌽', cooked: '🍲', name: 'Maíz' },
  calabaza:  { raw: '🎃', cooked: '🥣', name: 'Calabaza' },
  agua:      { raw: '💧', cooked: '🍵', name: 'Caldo' },
  leche:     { raw: '🥛', blended: '🥤', name: 'Leche' },
  dulce:     { raw: '🍯', name: 'Dulce' },
};
const CHOPPABLE = ['tomate', 'lechuga', 'zanahoria', 'queso', 'cebolla', 'manzana'];
const COOKABLE  = ['carne', 'chorizo', 'pollo', 'huevo', 'papa', 'maiz', 'calabaza', 'agua'];
const BLENDABLE = ['manzana', 'leche'];

const RECIPES = [
  { name: 'Ensalada',        emoji: '🥗', need: [['tomate','chopped'], ['lechuga','chopped']] },
  { name: 'Sándwich',        emoji: '🥪', need: [['pan','raw'], ['tomate','chopped'], ['queso','chopped']] },
  { name: 'Hamburguesa',     emoji: '🍔', need: [['pan','raw'], ['carne','cooked'], ['lechuga','chopped']] },
  { name: 'Pizza',           emoji: '🍕', need: [['pan','raw'], ['queso','chopped'], ['carne','cooked']] },
  { name: 'Sopa',            emoji: '🍲', need: [['agua','cooked'], ['zanahoria','chopped']] },
  { name: 'Papas fritas',    emoji: '🍟', need: [['papa','cooked']] },
  { name: 'Huevo frito',     emoji: '🍳', need: [['huevo','cooked'], ['pan','raw']] },
  { name: 'Pollo con papas', emoji: '🍗', need: [['pollo','cooked'], ['papa','cooked']] },
  { name: 'Jugo',            emoji: '🧃', need: [['manzana','blended']] },
  { name: 'Licuado',         emoji: '🥤', need: [['manzana','blended'], ['leche','blended']] },
  { name: 'Empanadas',       emoji: '🥟', need: [['masa','raw'], ['carne','cooked'], ['cebolla','chopped'], ['huevo','cooked']] },
  { name: 'Locro',           emoji: '🍲', need: [['maiz','cooked'], ['calabaza','cooked'], ['papa','cooked'], ['chorizo','cooked']] },
  { name: 'Asado',           emoji: '🥩', need: [['carne','cooked'], ['chorizo','cooked'], ['pan','raw']] },
  { name: 'Flan con dulce',  emoji: '🍮', need: [['leche','blended'], ['huevo','cooked'], ['dulce','raw']] },
];

const PROC_DUR = 1.1;   // seconds to chop / cook one item

export class Cocina {
  constructor(canvas) {
    this.canvas = canvas;
    this.best = +(localStorage.getItem('cocina_best') || 0);
    this.reset();
  }

  reset() {
    this.t = 0; this.score = 0;
    this.p = { nx: 0.5, ny: 0.55 };   // player position (normalised)
    this.face = 1; this.moving = false;
    this.dir = { x: 0, y: 0 };
    this.target = null;
    this.carry = null;                // { base, state }
    this.plate = [];                  // deposited { base, state }
    this.proc = null;                 // { id, t }
    this.served = 0; this.servedName = '';
    this.reject = 0;                  // wrong-deposit shake timer
    this.lastZone = null;
    this.particles = [];
    this.newOrder();
    this._buildStations();
  }

  newOrder() {
    const pick = RECIPES[Math.floor(Math.random() * RECIPES.length)];
    this.order = pick;
    this.plate = [];
  }

  _buildStations() {
    // normalised positions; rebuilt once (layout is resolution-independent)
    // top counters (against the back wall)
    this.stations = [
      { id: 'chop',  kind: 'chop',  icon: '🔪', label: 'Cortar',   nx: 0.15, ny: 0.34 },
      { id: 'cook',  kind: 'cook',  icon: '🍳', label: 'Cocinar',  nx: 0.33, ny: 0.34 },
      { id: 'blend', kind: 'blend', icon: '🥤', label: 'Licuar',   nx: 0.51, ny: 0.34 },
      { id: 'plate', kind: 'plate', icon: '🍽️', label: 'Plato',    nx: 0.70, ny: 0.34 },
      { id: 'trash', kind: 'trash', icon: '🗑️', label: 'Tirar',    nx: 0.89, ny: 0.34 },
    ];
    // ingredient baskets in rows along the bottom
    const rowA = ['tomate', 'lechuga', 'zanahoria', 'queso', 'cebolla', 'manzana'];
    const rowB = ['pan', 'masa', 'carne', 'chorizo', 'pollo', 'huevo'];
    const rowC = ['papa', 'maiz', 'calabaza', 'agua', 'leche', 'dulce'];
    const place = (list, ny) => list.forEach((base, i) => {
      const nx = 0.10 + i * (0.80 / (list.length - 1));
      this.stations.push({ id: 'b_' + base, kind: 'basket', base, nx, ny });
    });
    place(rowA, 0.64);
    place(rowB, 0.75);
    place(rowC, 0.86);
  }

  _geom() {
    const W = this.canvas.width, H = this.canvas.height;
    return { W, H, scale: Math.max(0.7, Math.min(W, H) / 620) };
  }
  _px(n)  { return n.nx * this.canvas.width; }
  _py(n)  { return n.ny * this.canvas.height; }

  // ── Input ──
  setDir(x, y) { this.dir.x = x; this.dir.y = y; if (x || y) this.target = null; }
  pointer(cx, cy) { this.target = { x: cx, y: cy }; }
  pointerUp() {}

  // ── Logic ──
  _transformable(carry, kind) {
    if (!carry || carry.state !== 'raw') return false;
    if (kind === 'chop')  return CHOPPABLE.includes(carry.base);
    if (kind === 'cook')  return COOKABLE.includes(carry.base);
    if (kind === 'blend') return BLENDABLE.includes(carry.base);
    return false;
  }
  _needRemaining(base, state) {
    const req = this.order.need.filter(n => n[0] === base && n[1] === state).length;
    const have = this.plate.filter(p => p.base === base && p.state === state).length;
    return req - have;
  }
  _orderComplete() {
    return this.order.need.every(([b, s]) => this.plate.some(p => p.base === b && p.state === s));
  }
  _deposit() {
    if (!this.carry) return;
    if (this._needRemaining(this.carry.base, this.carry.state) > 0) {
      this.plate.push({ ...this.carry });
      this.carry = null;
      this._burst('#7CD957', 6);
      if (this._orderComplete()) this._serve();
    } else {
      this.reject = 0.4;   // not needed (or already enough) → bounce
    }
  }
  _serve() {
    this.score++;
    this.servedName = this.order.name; this.served = 1.8;
    addFood(this.order.name, this.order.emoji);   // store it in the fridge
    this._burst('#FFD23A', 26);
    if (this.score > this.best) { this.best = this.score; try { localStorage.setItem('cocina_best', this.best); } catch (e) {} }
    this.newOrder();
  }
  _burst(color, n) {
    const G = this._geom(), x = this._px(this.stations.find(s => s.id === 'plate')), y = this._py(this.stations.find(s => s.id === 'plate'));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = (60 + Math.random() * 160) * G.scale;
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60 * G.scale, life: 0, max: 0.6 + Math.random() * 0.4, size: (3 + Math.random() * 4) * G.scale, color });
    }
  }
  _stationReach(s, G) {
    return s.kind === 'basket' ? 34 * G.scale : 100 * G.scale;
  }

  update(dt) {
    const G = this._geom();
    this.t += dt;
    if (this.served > 0) this.served -= dt;
    if (this.reject > 0) this.reject -= dt;

    // movement (keys take priority over tap target)
    let mx = this.dir.x, my = this.dir.y;
    if (mx || my) { const l = Math.hypot(mx, my) || 1; mx /= l; my /= l; }
    else if (this.target) {
      const dx = this.target.x - this._px(this.p), dy = this.target.y - this._py(this.p), d = Math.hypot(dx, dy);
      if (d > 6 * G.scale) { mx = dx / d; my = dy / d; } else this.target = null;
    }
    const sp = 320 * G.scale;
    this.p.nx += (mx * sp * dt) / G.W;
    this.p.ny += (my * sp * dt) / G.H;
    this.p.nx = Math.max(0.05, Math.min(0.95, this.p.nx));
    this.p.ny = Math.max(0.46, Math.min(0.92, this.p.ny));   // walk up to just below the counters
    this.moving = !!(mx || my);
    if (mx) this.face = mx < 0 ? -1 : 1;

    // nearest station within reach
    const px = this._px(this.p), py = this._py(this.p);
    let near = null, nd = Infinity;
    for (const s of this.stations) {
      const d = Math.hypot(this._px(s) - px, this._py(s) - py);
      const reach = this._stationReach(s, G);
      if (d < reach && d < nd) { nd = d; near = s; }
    }
    const entered = near && near.id !== this.lastZone;
    this.lastZone = near ? near.id : null;
    this.nearId = near ? near.id : null;

    if (near) {
      if (near.kind === 'basket' && !this.carry && !this.moving) {
        this.carry = { base: near.base, state: 'raw' };
      } else if (near.kind === 'trash' && entered && this.carry) {
        this.carry = null;
      } else if (near.kind === 'plate' && entered && this.carry) {
        this._deposit();
      } else if (near.kind === 'chop' || near.kind === 'cook' || near.kind === 'blend') {
        if (this._transformable(this.carry, near.kind)) {
          if (!this.proc || this.proc.id !== near.id) this.proc = { id: near.id, t: 0 };
          this.proc.t += dt;
          if (this.proc.t >= PROC_DUR) {
            this.carry.state = near.kind === 'chop' ? 'chopped' : near.kind === 'blend' ? 'blended' : 'cooked';
            this.proc = null;
            this._burst(near.kind === 'chop' ? '#9ED36A' : near.kind === 'blend' ? '#E486C0' : '#FF8C42', 8);
          }
        } else { this.proc = null; }
      } else { this.proc = null; }
    } else { this.proc = null; }

    // particles
    for (const pt of this.particles) { pt.life += dt; pt.vy += 240 * G.scale * dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; }
    this.particles = this.particles.filter(pt => pt.life < pt.max);
  }

  // ── Render ──
  render(ctx) {
    const G = this._geom(), { W, H, scale } = G;

    // floor (checkered tiles) + back wall
    ctx.fillStyle = '#F3E4D0'; ctx.fillRect(0, 0, W, H);
    const wallH = H * 0.34;
    const wg = ctx.createLinearGradient(0, 0, 0, wallH);
    wg.addColorStop(0, '#F6D7E2'); wg.addColorStop(1, '#FBE9EF');
    ctx.fillStyle = wg; ctx.fillRect(0, 0, W, wallH);
    const tile = 54 * scale;
    for (let y = wallH; y < H; y += tile) for (let x = 0; x < W; x += tile) {
      const odd = (Math.floor(x / tile) + Math.floor(y / tile)) % 2;
      ctx.fillStyle = odd ? '#EAD3B6' : '#F3E4D0'; ctx.fillRect(x, y, tile, tile);
    }
    ctx.fillStyle = '#D8B48C'; ctx.fillRect(0, wallH - 6 * scale, W, 6 * scale);

    // stations (drawn back-to-front by y so the player can overlap)
    const drawables = [...this.stations].sort((a, b) => a.ny - b.ny);
    for (const s of drawables) this._drawStation(ctx, s, G);

    // player
    this._drawChef(ctx, G);

    // particles
    for (const pt of this.particles) {
      ctx.globalAlpha = Math.max(0, 1 - pt.life / pt.max);
      ctx.fillStyle = pt.color; ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    this._drawHUD(ctx, G);
  }

  _drawStation(ctx, s, G) {
    const sc = G.scale, x = this._px(s), y = this._py(s);
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    // highlight when Labubu is close enough to interact
    if (s.id === this.nearId) {
      ctx.save();
      ctx.globalAlpha = 0.30 + 0.12 * Math.sin(this.t * 6);
      ctx.fillStyle = '#FFE066';
      ctx.beginPath(); ctx.ellipse(x, y, 52 * sc, 42 * sc, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    if (s.kind === 'basket') {
      // wooden crate
      const w = 64 * sc, h = 46 * sc;
      ctx.fillStyle = '#B07A43'; ctx.beginPath(); ctx.roundRect(x - w/2, y - h/2, w, h, 6 * sc); ctx.fill();
      ctx.fillStyle = '#C8915A'; ctx.fillRect(x - w/2 + 4*sc, y - h/2 + 4*sc, w - 8*sc, 8*sc);
      ctx.font = `${30 * sc}px serif`; ctx.fillText(ING[s.base].raw, x, y - 2*sc);
      ctx.fillStyle = '#5A3D22'; ctx.font = `bold ${11 * sc}px system-ui, sans-serif`;
      ctx.fillText(ING[s.base].name, x, y + h/2 + 11 * sc);
      ctx.restore(); return;
    }

    // counter pedestal
    const w = 78 * sc, h = 58 * sc;
    ctx.fillStyle = '#9FB7C9'; ctx.beginPath(); ctx.roundRect(x - w/2, y - h/2, w, h, 8 * sc); ctx.fill();
    ctx.fillStyle = '#C2D4E0'; ctx.beginPath(); ctx.roundRect(x - w/2, y - h/2, w, 12 * sc, [8*sc,8*sc,0,0]); ctx.fill();
    ctx.font = `${30 * sc}px serif`; ctx.fillText(s.icon, x, y + 2*sc);
    ctx.fillStyle = '#33485A'; ctx.font = `bold ${12 * sc}px system-ui, sans-serif`;
    ctx.fillText(s.label, x, y + h/2 + 12 * sc);

    // plate shows what's been assembled
    if (s.kind === 'plate') {
      const items = this.plate;
      const span = 26 * sc, x0 = x - (items.length - 1) * span / 2;
      for (let i = 0; i < items.length; i++) this._drawItem(ctx, items[i], x0 + i * span, y - h/2 - 18 * sc, 22 * sc);
      if (this.reject > 0) {            // wrong drop → red ✗ flash
        ctx.fillStyle = `rgba(220,40,40,${Math.min(1, this.reject * 2)})`;
        ctx.font = `900 ${34 * sc}px system-ui`; ctx.fillText('✗', x, y - h/2 - 30 * sc);
      }
    }

    // processing ring on chop/cook
    if (this.proc && this.proc.id === s.id) {
      const r = 34 * sc, a = (this.proc.t / PROC_DUR) * Math.PI * 2;
      ctx.lineWidth = 6 * sc; ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = s.kind === 'chop' ? '#5FBF44' : s.kind === 'blend' ? '#E486C0' : '#FF8C42';
      ctx.beginPath(); ctx.arc(x, y, r, -Math.PI/2, -Math.PI/2 + a); ctx.stroke();
    }
    ctx.restore();
  }

  _drawItem(ctx, item, cx, cy, size) {
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const ing = ING[item.base];
    if (item.state === 'chopped') {       // three little pieces
      ctx.font = `${size * 0.55}px serif`;
      ctx.fillText(ing.raw, cx - size * 0.24, cy + size * 0.10);
      ctx.fillText(ing.raw, cx + size * 0.24, cy + size * 0.10);
      ctx.fillText(ing.raw, cx, cy - size * 0.20);
    } else {
      let e = ing.raw;
      if (item.state === 'cooked'  && ing.cooked)  e = ing.cooked;
      if (item.state === 'blended' && ing.blended) e = ing.blended;
      ctx.font = `${size}px serif`; ctx.fillText(e, cx, cy);
    }
    ctx.restore();
  }

  _drawChef(ctx, G) {
    const sc = G.scale, x = this._px(this.p), y = this._py(this.p);
    // shadow
    ctx.save(); ctx.globalAlpha = 0.2; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(x, y + 4 * sc, 26 * sc, 8 * sc, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();

    const bob = this.moving ? Math.sin(this.t * 12) * 3 * sc : Math.sin(this.t * 3) * 1.5 * sc;
    if (CHEF_READY) {
      const fr = this.moving ? CHEF_FRAMES[Math.floor(this.t * 10) % 3] : CHEF_FRAMES[0];
      const h = 96 * sc, w = fr.naturalWidth * (h / fr.naturalHeight);
      ctx.save(); ctx.translate(x, y + bob); if (this.face < 0) ctx.scale(-1, 1);
      ctx.drawImage(fr, -w / 2, -h, w, h);
      ctx.restore();
      // chef hat
      ctx.save(); ctx.translate(x, y + bob - h);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, -2 * sc, 16 * sc, 9 * sc, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(-13 * sc, -2 * sc, 26 * sc, 9 * sc);
      ctx.restore();
    } else {
      ctx.fillStyle = '#C8A2D8'; ctx.beginPath(); ctx.arc(x, y - 40 * sc, 26 * sc, 0, Math.PI * 2); ctx.fill();
    }

    // carried item floating above the head
    if (this.carry) {
      const cy = y - 112 * sc + bob;
      ctx.save(); ctx.globalAlpha = 0.9; ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x, cy, 22 * sc, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1; ctx.restore();
      this._drawItem(ctx, this.carry, x, cy, 30 * sc);
    }
  }

  _drawHUD(ctx, G) {
    const { W, scale } = G;
    // order card (top centre)
    const cw = Math.min(420 * scale, W - 24), ch = 78 * scale, cx = W / 2 - cw / 2, cy = 10 * scale;
    ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.strokeStyle = '#E48FB0'; ctx.lineWidth = 3 * scale;
    ctx.beginPath(); ctx.roundRect(cx, cy, cw, ch, 12 * scale); ctx.fill(); ctx.stroke();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = `${34 * scale}px serif`; ctx.fillText(this.order.emoji, cx + 14 * scale, cy + ch / 2);
    ctx.fillStyle = '#A23A66'; ctx.font = `900 ${16 * scale}px system-ui, sans-serif`;
    ctx.fillText('PEDIDO', cx + 56 * scale, cy + 22 * scale);
    ctx.fillStyle = '#22304A'; ctx.font = `bold ${20 * scale}px system-ui, sans-serif`;
    ctx.fillText(this.order.name, cx + 56 * scale, cy + 48 * scale);
    // needed components with ✓
    const ix0 = cx + cw - 18 * scale;
    for (let i = 0; i < this.order.need.length; i++) {
      const [b, s] = this.order.need[this.order.need.length - 1 - i];
      const ix = ix0 - i * 44 * scale, iy = cy + ch / 2;
      const done = this.plate.some(p => p.base === b && p.state === s);
      ctx.globalAlpha = done ? 1 : 0.4;
      this._drawItem(ctx, { base: b, state: s }, ix, iy - 4 * scale, 26 * scale);
      ctx.globalAlpha = 1;
      if (done) { ctx.fillStyle = '#2B8A3E'; ctx.font = `900 ${16 * scale}px system-ui`; ctx.textAlign = 'center'; ctx.fillText('✓', ix, iy + 18 * scale); ctx.textAlign = 'left'; }
    }

    // score (top left)
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#22304A';
    ctx.font = `bold ${22 * scale}px system-ui, sans-serif`;
    ctx.fillText(`🍽️ ${this.score}`, 16, 34 * scale);
    ctx.font = `bold ${13 * scale}px system-ui, sans-serif`;
    ctx.fillText(`Mejor: ${this.best}`, 16, 54 * scale);

    // served banner
    if (this.served > 0) {
      ctx.save(); ctx.globalAlpha = Math.min(1, this.served * 1.4);
      ctx.textAlign = 'center'; ctx.fillStyle = '#2B8A3E';
      ctx.font = `900 ${40 * scale}px system-ui, sans-serif`;
      ctx.fillText('¡Servido! 🎉', W / 2, G.H * 0.5);
      ctx.fillStyle = '#22304A'; ctx.font = `bold ${20 * scale}px system-ui, sans-serif`;
      ctx.fillText(`+1 · ${this.servedName}`, W / 2, G.H * 0.5 + 34 * scale);
      ctx.restore();
    }
  }

  destroy() {}
}
