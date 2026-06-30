import { addFood } from './Pantry.js';

// ── Cooking mini-game: "Cocina con Labubu" ──────────────────────────────────
// Stations: chop, boil, fry, bake, blend. Multi-step: arroz raw→boil→fry.

const CHEF_FRAMES = ['/assets/labubu_0.png', '/assets/labubu_1.png', '/assets/labubu_2.png']
  .map(src => { const im = new Image(); im.src = src; return im; });
let CHEF_READY = false, _cl = 0;
CHEF_FRAMES.forEach(im => { im.onload = () => { if (++_cl === CHEF_FRAMES.length) CHEF_READY = true; }; });

const ING = {
  tomate:    { raw: '🍅', name: 'Tomate' },
  lechuga:   { raw: '🥬', name: 'Lechuga' },
  zanahoria: { raw: '🥕', name: 'Zanahoria' },
  queso:     { raw: '🧀', name: 'Queso' },
  cebolla:   { raw: '🧅', name: 'Cebolla' },
  manzana:   { raw: '🍎', blended: '🧃', name: 'Manzana' },
  pan:       { raw: '🍞', chopped: '🍞', name: 'Pan' },
  masa:      { raw: '🫓', fried: '🥟', baked: '🥖', name: 'Masa' },
  carne:     { raw: '🥩', fried: '🍖', baked: '🥩', name: 'Carne' },
  chorizo:   { raw: '🌭', fried: '🌭', name: 'Chorizo' },
  pollo:     { raw: '🐔', fried: '🍗', baked: '🍖', name: 'Pollo' },
  huevo:     { raw: '🥚', fried: '🍳', boiled: '🥚', name: 'Huevo' },
  papa:      { raw: '🥔', fried: '🍟', boiled: '🥔', baked: '🥔', name: 'Papa' },
  maiz:      { raw: '🌽', boiled: '🌽', name: 'Maíz' },
  calabaza:  { raw: '🎃', boiled: '🥣', name: 'Calabaza' },
  agua:      { raw: '💧', boiled: '🫕', name: 'Caldo' },
  leche:     { raw: '🥛', blended: '🥤', name: 'Leche' },
  dulce:     { raw: '🍯', name: 'Dulce de leche' },
  // ── Repostería ──
  harina:    { raw: '🫙', name: 'Harina' },
  chispitas: { raw: '🍫', name: 'Chispitas' },
  mezcla:    { raw: '🥣', baked: '🎂', name: 'Mezcla' },
  // ── New ingredients ──
  pasta:     { raw: '🍝', boiled: '🍝', name: 'Pasta' },
  arroz:     { raw: '🌾', boiled: '🍚', fried: '🍛', name: 'Arroz' },
  camarones: { raw: '🦐', fried: '🍤', name: 'Camarones' },
  jamon:     { raw: '🥓', name: 'Jamón' },
  lentejas:  { raw: '🫘', boiled: '🫘', name: 'Lentejas' },
};

const CHOPPABLE        = ['tomate','lechuga','zanahoria','queso','cebolla','manzana','pan','jamon'];
const BOILABLE         = ['papa','huevo','maiz','calabaza','agua','pasta','arroz','lentejas'];
const FRYABLE_FROM_RAW = ['carne','chorizo','pollo','huevo','papa','camarones','masa'];
// arroz: MUST be boiled first, THEN can be fried (2-step mechanic)
const FRYABLE_FROM_BOILED = ['papa', 'arroz'];
const BLENDABLE        = ['manzana','leche'];
const BAKEABLE         = ['masa','carne','pollo','papa','zanahoria','calabaza','mezcla'];

const RECIPES = [
  // ── Updated existing ─────────────────────────────────────────────────────
  { name: 'Ensalada',           emoji: '🥗',  need: [['tomate','chopped'], ['lechuga','chopped']] },
  { name: 'Sándwich',           emoji: '🥪',  need: [['pan','raw'], ['tomate','chopped'], ['queso','chopped']] },
  { name: 'Hamburguesa',        emoji: '🍔',  need: [['pan','raw'], ['carne','fried'], ['lechuga','chopped']] },
  { name: 'Pizza',              emoji: '🍕',  need: [['masa','baked'], ['queso','chopped'], ['tomate','chopped'], ['carne','fried']] },
  { name: 'Sopa',               emoji: '🍲',  need: [['agua','boiled'], ['zanahoria','chopped']] },
  { name: 'Papas fritas',       emoji: '🍟',  need: [['papa','fried']] },
  { name: 'Huevo frito',        emoji: '🍳',  need: [['huevo','fried'], ['pan','raw']] },
  { name: 'Pollo con papas',    emoji: '🍗',  need: [['pollo','fried'], ['papa','fried']] },
  { name: 'Jugo',               emoji: '🧃',  need: [['manzana','blended']] },
  { name: 'Licuado',            emoji: '🥤',  need: [['manzana','blended'], ['leche','blended']] },
  { name: 'Empanadas',          emoji: '🥟',  need: [['masa','baked'], ['carne','fried'], ['cebolla','chopped'], ['huevo','boiled']] },
  { name: 'Locro',              emoji: '🍲',  need: [['maiz','boiled'], ['calabaza','boiled'], ['papa','boiled'], ['chorizo','fried']] },
  { name: 'Asado',              emoji: '🥩',  need: [['carne','fried'], ['chorizo','fried'], ['pan','raw']] },
  { name: 'Flan con dulce',     emoji: '🍮',  need: [['leche','blended'], ['huevo','boiled'], ['dulce','raw']] },
  // ── 13 New recipes ───────────────────────────────────────────────────────
  { name: 'Tortilla española',  emoji: '🍳',  need: [['papa','boiled'], ['huevo','fried'], ['cebolla','chopped']] },
  { name: 'Pasta al tomate',    emoji: '🍝',  need: [['pasta','boiled'], ['tomate','chopped']] },
  { name: 'Sopa de fideos',     emoji: '🍜',  need: [['pasta','boiled'], ['agua','boiled']] },
  { name: 'Arroz blanco',       emoji: '🍚',  need: [['arroz','boiled']] },
  { name: 'Arroz con leche',    emoji: '🍮',  need: [['arroz','boiled'], ['leche','blended'], ['dulce','raw']] },
  { name: 'Milanesa',           emoji: '🍖',  need: [['carne','fried'], ['pan','chopped']] },
  { name: 'Camarones salteados',emoji: '🍤',  need: [['camarones','fried'], ['cebolla','chopped']] },
  { name: 'Sopa de lentejas',   emoji: '🫘',  need: [['lentejas','boiled'], ['zanahoria','chopped'], ['agua','boiled']] },
  { name: 'Revuelto gramajo',   emoji: '🍳',  need: [['papa','boiled'], ['huevo','fried'], ['jamon','chopped']] },
  { name: 'Pasta con camarones',emoji: '🍝',  need: [['pasta','boiled'], ['camarones','fried'], ['tomate','chopped']] },
  { name: 'Arroz frito',        emoji: '🍛',  need: [['arroz','fried'], ['huevo','fried']] },
  { name: 'Empanada frita',     emoji: '🥟',  need: [['masa','fried'], ['carne','fried'], ['cebolla','chopped']] },
  { name: 'Caldo de verduras',  emoji: '🫕',  need: [['agua','boiled'], ['zanahoria','chopped'], ['cebolla','chopped']] },
  // ── Recipes that require the oven ────────────────────────────────────────
  { name: 'Pan casero',         emoji: '🥖',  need: [['masa','baked']] },
  { name: 'Pollo al horno',     emoji: '🍖',  need: [['pollo','baked'], ['papa','baked']] },
  { name: 'Papa al horno',      emoji: '🥔',  need: [['papa','baked'], ['carne','baked']] },
  { name: 'Tarta de verduras',  emoji: '🥧',  need: [['masa','baked'], ['zanahoria','baked'], ['queso','chopped']] },
  { name: 'Asado al horno',     emoji: '🥩',  need: [['carne','baked'], ['papa','baked'], ['chorizo','fried']] },
  { name: 'Pollo asado',        emoji: '🍗',  need: [['pollo','baked'], ['calabaza','baked']] },
  { name: 'Lasaña',             emoji: '🍝',  need: [['pasta','boiled'], ['carne','baked'], ['queso','chopped']] },
  // ── Repostería ──────────────────────────────────────────────────────────────
  // mezcla se obtiene combinando harina+huevo en la estación de Mezclar
  { name: 'Pastel de vainilla', emoji: '🎂',  need: [['mezcla','baked'], ['dulce','raw'], ['chispitas','raw']] },
];

const PROC_DUR = 1.1;

export class Cocina {
  constructor(canvas) {
    this.canvas = canvas;
    this.best = +(localStorage.getItem('cocina_best') || 0);
    this.reset();
  }

  reset() {
    this.t = 0; this.score = 0;
    this.p = { nx: 0.5, ny: 0.55 };
    this.face = 1; this.moving = false;
    this.dir = { x: 0, y: 0 };
    this.target = null;
    this.carry = null;
    this.plate = [];
    this.proc = null;
    this.served = 0; this.servedName = '';
    this.reject = 0;
    this.lastZone = null;
    this.mixHeld = null;
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
    // 8 processing stations — evenly spaced across 0.09–0.91
    const ST = 0.82 / 7;
    const nx = i => 0.09 + i * ST;
    this.stations = [
      { id: 'chop',  kind: 'chop',  icon: '🔪', label: 'Cortar',  nx: nx(0), ny: 0.34 },
      { id: 'boil',  kind: 'boil',  icon: '🫕', label: 'Hervir',  nx: nx(1), ny: 0.34 },
      { id: 'fry',   kind: 'fry',   icon: '🥘', label: 'Freír',   nx: nx(2), ny: 0.34 },
      { id: 'bake',  kind: 'bake',  icon: '🔥', label: 'Hornear', nx: nx(3), ny: 0.34 },
      { id: 'blend', kind: 'blend', icon: '🥤', label: 'Licuar',  nx: nx(4), ny: 0.34 },
      { id: 'plate', kind: 'plate', icon: '🍽️', label: 'Plato',   nx: nx(5), ny: 0.34 },
      { id: 'mix',   kind: 'mix',   icon: '🥣', label: 'Mezclar', nx: nx(6), ny: 0.34 },
      { id: 'trash', kind: 'trash', icon: '🗑️', label: 'Tirar',   nx: nx(7), ny: 0.34 },
    ];
    // Ingredient rows — rows A-C use 6-column grid; row D has 7 items with tighter step
    const rowA = ['tomate','lechuga','zanahoria','queso','cebolla','manzana'];
    const rowB = ['pan','masa','carne','chorizo','pollo','huevo'];
    const rowC = ['papa','maiz','calabaza','agua','leche','dulce'];
    const rowD = ['pasta','arroz','camarones','jamon','lentejas','harina','chispitas'];
    const STEP  = 0.82 / 5;        // 6-column grid (rows A-C)
    const STEPD = 0.82 / 6;        // 7 items in row D (slightly tighter)
    const place = (list, ny, st) => list.forEach((base, i) => {
      this.stations.push({ id: 'b_' + base, kind: 'basket', base, nx: 0.09 + i * (st ?? STEP), ny });
    });
    place(rowA, 0.62);
    place(rowB, 0.72);
    place(rowC, 0.82);
    place(rowD, 0.91, STEPD);
  }

  _geom() {
    const W = this.canvas.width, H = this.canvas.height;
    return { W, H, scale: Math.max(0.7, Math.min(W, H) / 620) };
  }
  _px(n) { return n.nx * this.canvas.width; }
  _py(n) { return n.ny * this.canvas.height; }

  setDir(x, y) { this.dir.x = x; this.dir.y = y; if (x || y) this.target = null; }
  pointer(cx, cy) { this.target = { x: cx, y: cy }; }
  pointerUp() {}

  _transformable(carry, kind) {
    if (!carry) return false;
    if (kind === 'chop')  return carry.state === 'raw'    && CHOPPABLE.includes(carry.base);
    if (kind === 'boil')  return carry.state === 'raw'    && BOILABLE.includes(carry.base);
    if (kind === 'fry') {
      if (carry.state === 'raw'    && FRYABLE_FROM_RAW.includes(carry.base))    return true;
      if (carry.state === 'boiled' && FRYABLE_FROM_BOILED.includes(carry.base)) return true;
      return false;
    }
    if (kind === 'bake')  return carry.state === 'raw'    && BAKEABLE.includes(carry.base);
    if (kind === 'blend') return carry.state === 'raw'    && BLENDABLE.includes(carry.base);
    return false;
  }

  _needRemaining(base, state) {
    const req  = this.order.need.filter(n => n[0] === base && n[1] === state).length;
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
      this.reject = 0.4;
    }
  }
  _serve() {
    this.score++;
    this.servedName = this.order.name; this.served = 1.8;
    addFood(this.order.name, this.order.emoji);
    this._burst('#FFD23A', 26);
    if (this.score > this.best) { this.best = this.score; try { localStorage.setItem('cocina_best', this.best); } catch (e) {} }
    this.newOrder();
  }
  _combineIngredients(a, b) {
    const COMBOS = [
      { a: ['harina','raw'], b: ['huevo','raw'], result: ['mezcla','raw'] },
    ];
    for (const c of COMBOS) {
      if ((a.base===c.a[0]&&a.state===c.a[1]&&b.base===c.b[0]&&b.state===c.b[1])||
          (a.base===c.b[0]&&a.state===c.b[1]&&b.base===c.a[0]&&b.state===c.a[1]))
        return { base: c.result[0], state: c.result[1] };
    }
    return null;
  }

  _burst(color, n, cx, cy) {
    const G = this._geom();
    const x = cx ?? this._px(this.stations.find(s => s.id === 'plate'));
    const y = cy ?? this._py(this.stations.find(s => s.id === 'plate'));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = (60 + Math.random() * 160) * G.scale;
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60 * G.scale,
        life: 0, max: 0.6 + Math.random() * 0.4, size: (3 + Math.random() * 4) * G.scale, color });
    }
  }
  _stationReach(s, G) { return s.kind === 'basket' ? 34 * G.scale : 100 * G.scale; }

  update(dt) {
    const G = this._geom();
    this.t += dt;
    if (this.served > 0) this.served -= dt;
    if (this.reject > 0) this.reject -= dt;

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
    this.p.ny = Math.max(0.44, Math.min(0.95, this.p.ny));
    this.moving = !!(mx || my);
    if (mx) this.face = mx < 0 ? -1 : 1;

    const px = this._px(this.p), py = this._py(this.p);
    let near = null, nd = Infinity;
    for (const s of this.stations) {
      const d = Math.hypot(this._px(s) - px, this._py(s) - py);
      const reach = this._stationReach(s, G);
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
            // Deposit first ingredient into the mixing bowl
            this.mixHeld = { ...this.carry };
            this.carry = null;
          } else if (this.carry && this.mixHeld) {
            // Try to combine the two ingredients
            const result = this._combineIngredients(this.mixHeld, this.carry);
            if (result) {
              const mixSt = this.stations.find(s => s.id === 'mix');
              this.carry = result;
              this.mixHeld = null;
              this._burst('#FFB8D0', 16, this._px(mixSt), this._py(mixSt));
            }
          } else if (!this.carry && this.mixHeld) {
            // Pick up what's in the bowl
            this.carry = { ...this.mixHeld };
            this.mixHeld = null;
          }
        }
      } else if (['chop','boil','fry','bake','blend'].includes(near.kind)) {
        if (this._transformable(this.carry, near.kind)) {
          if (!this.proc || this.proc.id !== near.id) this.proc = { id: near.id, t: 0 };
          this.proc.t += dt;
          if (this.proc.t >= PROC_DUR) {
            const stateMap = { chop: 'chopped', boil: 'boiled', fry: 'fried', bake: 'baked', blend: 'blended' };
            this.carry.state = stateMap[near.kind];
            this.proc = null;
            const burstColors = { chop: '#9ED36A', boil: '#5BC8E8', fry: '#FF8C42', blend: '#E486C0' };
            this._burst(burstColors[near.kind], 8);
          }
        } else { this.proc = null; }
      } else { this.proc = null; }
    } else { this.proc = null; }

    for (const pt of this.particles) { pt.life += dt; pt.vy += 240 * G.scale * dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; }
    this.particles = this.particles.filter(pt => pt.life < pt.max);
  }

  // ── Render ──────────────────────────────────────────────────────────────
  render(ctx) {
    const G = this._geom(), { W, H, scale } = G;

    // floor + back wall
    ctx.fillStyle = '#F3E4D0'; ctx.fillRect(0, 0, W, H);
    const wallH = H * 0.32;
    const wg = ctx.createLinearGradient(0, 0, 0, wallH);
    wg.addColorStop(0, '#F6D7E2'); wg.addColorStop(1, '#FBE9EF');
    ctx.fillStyle = wg; ctx.fillRect(0, 0, W, wallH);
    const tile = 54 * scale;
    for (let y = wallH; y < H; y += tile) for (let x = 0; x < W; x += tile) {
      const odd = (Math.floor(x / tile) + Math.floor(y / tile)) % 2;
      ctx.fillStyle = odd ? '#EAD3B6' : '#F3E4D0'; ctx.fillRect(x, y, tile, tile);
    }
    ctx.fillStyle = '#D8B48C'; ctx.fillRect(0, wallH - 6 * scale, W, 6 * scale);

    const drawables = [...this.stations].sort((a, b) => a.ny - b.ny);
    for (const s of drawables) this._drawStation(ctx, s, G);

    this._drawChef(ctx, G);

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

    if (s.id === this.nearId) {
      ctx.save();
      ctx.globalAlpha = 0.30 + 0.12 * Math.sin(this.t * 6);
      ctx.fillStyle = '#FFE066';
      ctx.beginPath(); ctx.ellipse(x, y, 52 * sc, 42 * sc, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    if (s.kind === 'basket') {
      const w = 64 * sc, h = 46 * sc;
      ctx.fillStyle = '#B07A43'; ctx.beginPath(); ctx.roundRect(x - w/2, y - h/2, w, h, 6 * sc); ctx.fill();
      ctx.fillStyle = '#C8915A'; ctx.fillRect(x - w/2 + 4*sc, y - h/2 + 4*sc, w - 8*sc, 8*sc);
      ctx.font = `${30 * sc}px serif`; ctx.fillText(ING[s.base].raw, x, y - 2*sc);
      ctx.restore(); return;
    }

    const w = 78 * sc, h = 58 * sc;
    // Counter top color varies by station type
    const topColors = { chop: '#C2D4E0', boil: '#A8D8F8', fry: '#F8C8A0', bake: '#F8D8A0', blend: '#F4A8D0', plate: '#C8F0B0', trash: '#C8C8C8', mix: '#FFE4C0' };
    ctx.fillStyle = '#9FB7C9'; ctx.beginPath(); ctx.roundRect(x - w/2, y - h/2, w, h, 8 * sc); ctx.fill();
    ctx.fillStyle = topColors[s.kind] || '#C2D4E0';
    ctx.beginPath(); ctx.roundRect(x - w/2, y - h/2, w, 12 * sc, [8*sc,8*sc,0,0]); ctx.fill();
    ctx.font = `${30 * sc}px serif`; ctx.fillText(s.icon, x, y + 2*sc);

    // mix bowl: show held ingredient + hint
    if (s.kind === 'mix') {
      if (this.mixHeld) {
        this._drawItem(ctx, this.mixHeld, x, y - h/2 - 18 * sc, 22 * sc);
        if (s.id === this.nearId && this.carry) {
          const canCombine = !!this._combineIngredients(this.mixHeld, this.carry);
          ctx.fillStyle = canCombine ? '#FF80A0' : '#AAAAAA';
          ctx.font = `bold ${12 * sc}px system-ui`;
          ctx.fillText(canCombine ? '+ Mezclar ✓' : '+ ?', x, y - h/2 - 34 * sc);
        }
      } else if (s.id === this.nearId && this.carry) {
        ctx.fillStyle = '#FF80A0'; ctx.font = `bold ${11 * sc}px system-ui`;
        ctx.fillText('Depositar aquí', x, y - h/2 - 18 * sc);
      }
    }

    // plate assembly preview
    if (s.kind === 'plate') {
      const items = this.plate;
      const span = 26 * sc, x0 = x - (items.length - 1) * span / 2;
      for (let i = 0; i < items.length; i++) this._drawItem(ctx, items[i], x0 + i * span, y - h/2 - 18 * sc, 22 * sc);
      if (this.reject > 0) {
        ctx.fillStyle = `rgba(220,40,40,${Math.min(1, this.reject * 2)})`;
        ctx.font = `900 ${34 * sc}px system-ui`; ctx.fillText('✗', x, y - h/2 - 30 * sc);
      }
    }

    // show carried item on station while processing
    if (this.proc && this.proc.id === s.id && this.carry && ['chop','boil','fry','bake','blend'].includes(s.kind)) {
      const pulse = 0.82 + 0.18 * Math.sin(this.t * 9);
      ctx.save();
      ctx.globalAlpha = pulse;
      this._drawItem(ctx, this.carry, x, y - h/2 - 22 * sc, 28 * sc);
      ctx.restore();
    }

    // processing progress ring
    if (this.proc && this.proc.id === s.id) {
      const r = 34 * sc, a = (this.proc.t / PROC_DUR) * Math.PI * 2;
      ctx.lineWidth = 6 * sc; ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      const ringColors = { chop: '#5FBF44', boil: '#4AB8E8', fry: '#FF8C42', bake: '#FF6010', blend: '#E486C0' };
      ctx.strokeStyle = ringColors[s.kind] || '#FF8C42';
      ctx.beginPath(); ctx.arc(x, y, r, -Math.PI/2, -Math.PI/2 + a); ctx.stroke();

      // boil: steam bubbles
      if (s.kind === 'boil') {
        ctx.save();
        for (let b = 0; b < 3; b++) {
          const phase = (this.t * 1.4 + b * 0.55) % 1;
          const bx = x + (b - 1) * 11 * sc;
          const by = y - h/2 - phase * 28 * sc;
          ctx.globalAlpha = Math.sin(phase * Math.PI) * 0.55;
          ctx.fillStyle = '#A8DCFF';
          ctx.beginPath(); ctx.arc(bx, by, (3 + phase * 3) * sc, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }

      // fry: sizzle sparks
      if (s.kind === 'fry') {
        ctx.save();
        for (let sp = 0; sp < 5; sp++) {
          const phase = (this.t * 3.5 + sp * 0.28) % 1;
          const angle = (sp / 5) * Math.PI * 2 + this.t * 2.2;
          const dist = 18 * sc * phase;
          const sx = x + Math.cos(angle) * dist;
          const sy = y - h/2 - Math.sin(phase * Math.PI) * 18 * sc;
          ctx.globalAlpha = Math.max(0, 1 - phase * 1.8) * 0.9;
          ctx.fillStyle = sp % 2 ? '#FF8C42' : '#FFD23A';
          ctx.beginPath(); ctx.arc(sx, sy, 2.5 * sc, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }

      // bake: rising heat waves
      if (s.kind === 'bake') {
        ctx.save();
        for (let hw = 0; hw < 4; hw++) {
          const phase = (this.t * 0.9 + hw * 0.28) % 1;
          const hx2 = x + (hw - 1.5) * 10 * sc;
          const hy = y - h/2 - phase * 36 * sc;
          const wobble = Math.sin(this.t * 5 + hw * 1.4) * 4 * sc;
          ctx.globalAlpha = Math.sin(phase * Math.PI) * 0.45;
          ctx.strokeStyle = hw % 2 ? '#FF8040' : '#FFAA20';
          ctx.lineWidth = 2.5 * sc;
          ctx.beginPath();
          ctx.moveTo(hx2, hy + 10 * sc);
          ctx.quadraticCurveTo(hx2 + wobble, hy + 5 * sc, hx2, hy);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    ctx.restore();
  }

  _drawItem(ctx, item, cx, cy, size) {
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const ing = ING[item.base];
    if (item.state === 'chopped') {
      ctx.font = `${size * 0.55}px serif`;
      ctx.fillText(ing.raw, cx - size * 0.24, cy + size * 0.10);
      ctx.fillText(ing.raw, cx + size * 0.24, cy + size * 0.10);
      ctx.fillText(ing.raw, cx, cy - size * 0.20);
    } else {
      let e = ing.raw;
      if (item.state === 'boiled'  && ing.boiled)  e = ing.boiled;
      if (item.state === 'fried'   && ing.fried)   e = ing.fried;
      if (item.state === 'baked'   && ing.baked)   e = ing.baked;
      if (item.state === 'blended' && ing.blended) e = ing.blended;
      ctx.font = `${size}px serif`; ctx.fillText(e, cx, cy);
    }
    ctx.restore();
  }

  _drawChef(ctx, G) {
    const sc = G.scale, x = this._px(this.p), y = this._py(this.p);
    ctx.save(); ctx.globalAlpha = 0.2; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(x, y + 4 * sc, 26 * sc, 8 * sc, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();

    const bob = this.moving ? Math.sin(this.t * 12) * 3 * sc : Math.sin(this.t * 3) * 1.5 * sc;
    if (CHEF_READY) {
      const fr = this.moving ? CHEF_FRAMES[Math.floor(this.t * 10) % 3] : CHEF_FRAMES[0];
      const h = 96 * sc, w = fr.naturalWidth * (h / fr.naturalHeight);
      ctx.save(); ctx.translate(x, y + bob); if (this.face < 0) ctx.scale(-1, 1);
      ctx.drawImage(fr, -w / 2, -h, w, h);
      ctx.restore();
      ctx.save(); ctx.translate(x, y + bob - h);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, -2 * sc, 16 * sc, 9 * sc, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(-13 * sc, -2 * sc, 26 * sc, 9 * sc);
      ctx.restore();
    } else {
      ctx.fillStyle = '#C8A2D8'; ctx.beginPath(); ctx.arc(x, y - 40 * sc, 26 * sc, 0, Math.PI * 2); ctx.fill();
    }

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
    const cw = Math.min(420 * scale, W - 24), ch = 78 * scale, cx = W / 2 - cw / 2, cy = 10 * scale;
    ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.strokeStyle = '#E48FB0'; ctx.lineWidth = 3 * scale;
    ctx.beginPath(); ctx.roundRect(cx, cy, cw, ch, 12 * scale); ctx.fill(); ctx.stroke();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = `${34 * scale}px serif`; ctx.fillText(this.order.emoji, cx + 14 * scale, cy + ch / 2);
    ctx.fillStyle = '#A23A66'; ctx.font = `900 ${16 * scale}px system-ui, sans-serif`;
    ctx.fillText('PEDIDO', cx + 56 * scale, cy + 22 * scale);
    ctx.fillStyle = '#22304A'; ctx.font = `bold ${20 * scale}px system-ui, sans-serif`;
    ctx.fillText(this.order.name, cx + 56 * scale, cy + 48 * scale);

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

    // Station legend strip (below HUD)
    const legendY = cy + ch + 6 * scale;
    const stations = [
      { icon: '🔪', label: 'Cortar',  color: '#9ED36A' },
      { icon: '🫕', label: 'Hervir',  color: '#4AB8E8' },
      { icon: '🥘', label: 'Freír',   color: '#FF8C42' },
      { icon: '🔥', label: 'Hornear', color: '#FF6010' },
      { icon: '🥤', label: 'Licuar',  color: '#E486C0' },
      { icon: '🥣', label: 'Mezclar', color: '#FF9040' },
    ];
    const lw = Math.min(W - 20, 320 * scale);
    const lx = W / 2 - lw / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath(); ctx.roundRect(lx, legendY, lw, 22 * scale, 6 * scale); ctx.fill();
    const seg = lw / stations.length;
    for (let i = 0; i < stations.length; i++) {
      const st = stations[i], sx = lx + seg * i + seg / 2;
      ctx.fillStyle = st.color; ctx.font = `bold ${10 * scale}px system-ui`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`${st.icon} ${st.label}`, sx, legendY + 11 * scale);
    }

    // Mix hint when recipe needs an ingredient that comes from a combo
    const HINT_COMBOS = [
      { result: 'mezcla', hint: '🥣 Mezclar: harina + huevo → mezcla' },
    ];
    for (const hc of HINT_COMBOS) {
      const needsIt  = this.order.need.some(([b]) => b === hc.result);
      const haveIt   = this.plate.some(p => p.base === hc.result);
      const carrying = this.carry && this.carry.base === hc.result;
      if (needsIt && !haveIt && !carrying) {
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#CC4488'; ctx.font = `bold ${12 * scale}px system-ui, sans-serif`;
        ctx.fillText(hc.hint, W / 2, legendY + 22 * scale + 10 * scale);
        break;
      }
    }

    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#22304A';
    ctx.font = `bold ${22 * scale}px system-ui, sans-serif`;
    ctx.fillText(`🍽️ ${this.score}`, 16, 34 * scale);
    ctx.font = `bold ${13 * scale}px system-ui, sans-serif`;
    ctx.fillText(`Mejor: ${this.best}`, 16, 54 * scale);

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
