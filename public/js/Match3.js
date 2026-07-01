// ── Match-3 mini-game: "Dulces de Labubu" ───────────────────────────────────
// Candy-crush style. Swap two adjacent candies (tap-tap or drag) to line up 3+
// of the same kind. Matches pop, candies above fall down, new ones drop in from
// the top, and cascades chain into combos. Endless & relaxed — no fail state.

const COLS = 8, ROWS = 8;

// Candy kinds: distinct colour + emoji so they read clearly at small sizes.
const KINDS = [
  { c: '#FF5D73', s: '🍓' },   // strawberry
  { c: '#FFD23F', s: '🍋' },   // lemon
  { c: '#B66DD6', s: '🍇' },   // grape
  { c: '#FF9F45', s: '🍊' },   // orange
  { c: '#5AA9E6', s: '🫐' },   // blueberry
  { c: '#7BD389', s: '🍏' },   // apple
];

const SWAP_DUR  = 0.18;   // seconds for a swap / swap-back animation
const CLEAR_DUR = 0.22;   // seconds for matched candies to pop

export class Match3 {
  constructor(canvas) {
    this.canvas = canvas;
    this.best = +(localStorage.getItem('match3_best') || 0);
    this.reset();
  }

  reset() {
    this.t = 0;
    this.score = 0;
    this.combo = 0;
    this.level = 1;
    this.levelFlash = 0;
    this.phase = 'ready';          // ready | swap | clear | fall
    this.sel = null;               // selected cell {r,c}
    this.down = null;              // pointer-down cell (for drag swaps)
    this.cursor = { r: 3, c: 3 };  // keyboard cursor
    this.anim = null;              // active swap animation
    this.particles = [];
    this.comboBanner = 0;
    this.comboText = '';

    // grid[r][c] = kind index ; vis[r][c] = { off, scale } visual state
    this.grid = [];
    this.vis  = [];
    for (let r = 0; r < ROWS; r++) {
      this.grid[r] = [];
      this.vis[r]  = [];
      for (let c = 0; c < COLS; c++) {
        this.grid[r][c] = this._safeRandType(r, c);
        this.vis[r][c]  = { off: 0, scale: 1 };
      }
    }
    if (!this._hasMove()) this._reshuffle();
  }

  // ── Geometry (recomputed each frame; resolution independent) ───────────────
  _geom() {
    const W = this.canvas.width, H = this.canvas.height;
    const topPad = Math.max(72, H * 0.13);
    const margin = Math.min(W, H) * 0.04;
    const cell = Math.floor(Math.min(
      (W - margin * 2) / COLS,
      (H - topPad - margin) / ROWS,
    ));
    const boardW = cell * COLS, boardH = cell * ROWS;
    const x0 = (W - boardW) / 2;
    const y0 = topPad + (H - topPad - margin - boardH) / 2;
    return { W, H, cell, x0, y0, boardW, boardH };
  }

  _cellAt(px, py) {
    const { cell, x0, y0 } = this._geom();
    const c = Math.floor((px - x0) / cell);
    const r = Math.floor((py - y0) / cell);
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
    return { r, c };
  }

  // ── Board helpers ──────────────────────────────────────────────────────────
  _randType() { return Math.floor(Math.random() * KINDS.length); }

  // Pick a type that doesn't immediately form a 3-line with the two cells
  // already placed above / to the left of (r,c).
  _safeRandType(r, c) {
    let t, guard = 0;
    do {
      t = this._randType();
      const h = c >= 2 && this.grid[r][c - 1] === t && this.grid[r][c - 2] === t;
      const v = r >= 2 && this.grid[r - 1][c] === t && this.grid[r - 2][c] === t;
      if (!h && !v) break;
    } while (++guard < 20);
    return t;
  }

  _adjacent(a, b) {
    return a && b && Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
  }

  // Returns a Set of "r,c" strings for every candy in a run of 3+.
  _findMatches() {
    const hits = new Set();
    for (let r = 0; r < ROWS; r++) {
      let run = 1;
      for (let c = 1; c <= COLS; c++) {
        if (c < COLS && this.grid[r][c] != null && this.grid[r][c] === this.grid[r][c - 1]) {
          run++;
        } else {
          if (run >= 3) for (let k = 1; k <= run; k++) hits.add(`${r},${c - k}`);
          run = 1;
        }
      }
    }
    for (let c = 0; c < COLS; c++) {
      let run = 1;
      for (let r = 1; r <= ROWS; r++) {
        if (r < ROWS && this.grid[r][c] != null && this.grid[r][c] === this.grid[r - 1][c]) {
          run++;
        } else {
          if (run >= 3) for (let k = 1; k <= run; k++) hits.add(`${r - k},${c}`);
          run = 1;
        }
      }
    }
    return hits;
  }

  // Is there any single adjacent swap that creates a match?
  _hasMove() {
    const swap = (r1, c1, r2, c2) => {
      const tmp = this.grid[r1][c1]; this.grid[r1][c1] = this.grid[r2][c2]; this.grid[r2][c2] = tmp;
    };
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (c < COLS - 1) {
          swap(r, c, r, c + 1);
          const ok = this._findMatches().size > 0;
          swap(r, c, r, c + 1);
          if (ok) return true;
        }
        if (r < ROWS - 1) {
          swap(r, c, r + 1, c);
          const ok = this._findMatches().size > 0;
          swap(r, c, r + 1, c);
          if (ok) return true;
        }
      }
    }
    return false;
  }

  _reshuffle() {
    let guard = 0;
    do {
      const flat = [];
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) flat.push(this.grid[r][c]);
      for (let i = flat.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [flat[i], flat[j]] = [flat[j], flat[i]];
      }
      let i = 0;
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) this.grid[r][c] = flat[i++];
    } while ((this._findMatches().size > 0 || !this._hasMove()) && ++guard < 40);
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  pointerDown(px, py) {
    if (this.phase !== 'ready') return;
    const cell = this._cellAt(px, py);
    if (!cell) return;
    this.down = cell;
    if (this.sel && this._adjacent(this.sel, cell)) {
      this._trySwap(this.sel, cell); this.sel = null; this.down = null;
    } else if (this.sel && this.sel.r === cell.r && this.sel.c === cell.c) {
      this.sel = null;            // tap same cell → deselect
    } else {
      this.sel = cell;            // select / re-select
    }
  }

  pointerMove(px, py) {
    if (this.phase !== 'ready' || !this.down) return;
    const cell = this._cellAt(px, py);
    if (cell && this._adjacent(this.down, cell)) {
      this._trySwap(this.down, cell); this.down = null; this.sel = null;
    }
  }

  pointerUp() { this.down = null; }

  moveCursor(dx, dy) {
    this.cursor.c = Math.max(0, Math.min(COLS - 1, this.cursor.c + dx));
    this.cursor.r = Math.max(0, Math.min(ROWS - 1, this.cursor.r + dy));
  }

  selectCursor() {
    if (this.phase !== 'ready') return;
    const cell = { r: this.cursor.r, c: this.cursor.c };
    if (this.sel && this._adjacent(this.sel, cell)) { this._trySwap(this.sel, cell); this.sel = null; }
    else if (this.sel && this.sel.r === cell.r && this.sel.c === cell.c) this.sel = null;
    else this.sel = cell;
  }

  _trySwap(a, b) {
    const swap = () => {
      const tmp = this.grid[a.r][a.c];
      this.grid[a.r][a.c] = this.grid[b.r][b.c];
      this.grid[b.r][b.c] = tmp;
    };
    swap();                                   // tentatively swap
    const valid = this._findMatches().size > 0;
    if (!valid) swap();                        // no match → put it back
    this.phase = 'swap';
    this.anim = { a, b, t: 0, revert: !valid };
  }

  // ── Update ───────────────────────────────────────────────────────────────
  update(dt) {
    this.t += dt;
    if (this.levelFlash > 0) this.levelFlash -= dt;
    if (this.comboBanner > 0) this.comboBanner -= dt;

    // particles
    for (const p of this.particles) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 900 * dt; }
    this.particles = this.particles.filter(p => p.life < p.max);

    if (this.phase === 'swap') {
      this.anim.t += dt / SWAP_DUR;
      if (this.anim.t >= 1) {
        const wasRevert = this.anim.revert;
        this.anim = null;
        if (wasRevert) { this.phase = 'ready'; }
        else { this.combo = 0; this._beginClear(); }
      }
      return;
    }

    if (this.phase === 'clear') {
      let done = true;
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const v = this.vis[r][c];
        if (v.scale < 1 || this.grid[r][c] == null) {
          v.scale = Math.max(0, v.scale - dt / CLEAR_DUR);
          if (v.scale > 0) done = false;
        }
      }
      if (done) this._collapse();
      return;
    }

    if (this.phase === 'fall') {
      const { cell } = this._geom();
      const grav = cell * 42;
      let moving = false;
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const v = this.vis[r][c];
        if (v.off < 0) {
          v.vy = (v.vy || 0) + grav * dt;
          v.off += v.vy * dt;
          if (v.off >= 0) { v.off = 0; v.vy = 0; }
          else moving = true;
        }
      }
      if (!moving) {
        const matches = this._findMatches();
        if (matches.size > 0) { this.combo++; this._beginClear(matches); }
        else {
          this.phase = 'ready';
          this.combo = 0;
          if (!this._hasMove()) this._reshuffle();
        }
      }
    }
  }

  _beginClear(precomputed) {
    const matches = precomputed || this._findMatches();
    if (matches.size === 0) { this.phase = 'ready'; return; }

    const { cell, x0, y0 } = this._geom();
    const gain = matches.size * 10 * Math.max(1, this.combo);
    this.score += gain;
    if (this.score > this.best) { this.best = this.score; localStorage.setItem('match3_best', this.best); }

    // level up every 600 points
    const newLevel = 1 + Math.floor(this.score / 600);
    if (newLevel > this.level) { this.level = newLevel; this.levelFlash = 1.6; }

    if (this.combo >= 2) { this.comboBanner = 1.1; this.comboText = `¡Combo x${this.combo}!`; }

    for (const key of matches) {
      const [r, c] = key.split(',').map(Number);
      const v = this.vis[r][c];
      v.scale = 0.999;                 // start shrinking (handled in update)
      this.grid[r][c] = null;
      // candy-coloured pop particles
      const cx = x0 + c * cell + cell / 2, cy = y0 + r * cell + cell / 2;
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * Math.PI * 2, sp = 80 + Math.random() * 180;
        this.particles.push({
          x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120,
          life: 0, max: 0.5 + Math.random() * 0.3, size: cell * (0.08 + Math.random() * 0.06),
          color: '#fff',
        });
      }
    }
    this.phase = 'clear';
  }

  _collapse() {
    const { cell } = this._geom();
    for (let c = 0; c < COLS; c++) {
      const stack = [];
      for (let r = 0; r < ROWS; r++) if (this.grid[r][c] != null) stack.push({ t: this.grid[r][c], from: r });
      const n = stack.length;
      for (let i = 0; i < ROWS; i++) {
        const row = ROWS - 1 - i;
        if (i < n) {
          const piece = stack[n - 1 - i];
          this.grid[row][c] = piece.t;
          this.vis[row][c] = { off: (piece.from - row) * cell, scale: 1, vy: 0 };
        } else {
          this.grid[row][c] = this._randType();
          this.vis[row][c] = { off: -(i - n + 1) * cell - cell, scale: 1, vy: 0 };
        }
      }
    }
    this.phase = 'fall';
  }

  // ── Render ───────────────────────────────────────────────────────────────
  render(ctx) {
    const G = this._geom(), { W, H, cell, x0, y0, boardW, boardH } = G;

    // background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#FFE6F2'); bg.addColorStop(1, '#E7D5FF');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // board frame + checkered cells
    const pad = cell * 0.18;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    this._roundRect(ctx, x0 - pad, y0 - pad, boardW + pad * 2, boardH + pad * 2, cell * 0.3); ctx.fill();
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      ctx.fillStyle = (r + c) % 2 ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.18)';
      ctx.fillRect(x0 + c * cell, y0 + r * cell, cell, cell);
    }

    // candies
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = this.grid[r][c];
      if (t == null) continue;
      const v = this.vis[r][c];
      let cx = x0 + c * cell + cell / 2;
      let cy = y0 + r * cell + cell / 2 + (v.off || 0);

      // swap animation offset
      if (this.anim) {
        const ease = this.anim.revert ? Math.sin(this.anim.t * Math.PI) : this.anim.t;
        const { a, b } = this.anim;
        const move = (from, to) => {
          const fx = x0 + from.c * cell + cell / 2, fy = y0 + from.r * cell + cell / 2;
          const tx = x0 + to.c * cell + cell / 2, ty = y0 + to.r * cell + cell / 2;
          cx = fx + (tx - fx) * ease; cy = fy + (ty - fy) * ease;
        };
        if (r === a.r && c === a.c) { this.anim.revert ? move(a, b) : move(b, a); }
        else if (r === b.r && c === b.c) { this.anim.revert ? move(b, a) : move(a, b); }
      }

      const selected = this.sel && this.sel.r === r && this.sel.c === c;
      const scale = (v.scale != null ? v.scale : 1) * (selected ? 1.08 + 0.04 * Math.sin(this.t * 8) : 1);
      this._drawCandy(ctx, t, cx, cy, cell * 0.84 * scale, selected);
    }

    // keyboard cursor
    if (this.phase === 'ready') {
      const cx = x0 + this.cursor.c * cell, cy = y0 + this.cursor.r * cell;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(2, cell * 0.05);
      ctx.globalAlpha = 0.6 + 0.3 * Math.sin(this.t * 5);
      this._roundRect(ctx, cx + 2, cy + 2, cell - 4, cell - 4, cell * 0.2); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // particles
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    this._drawHUD(ctx, G);
  }

  _drawCandy(ctx, t, x, y, size, selected) {
    const k = KINDS[t], hs = size / 2;
    ctx.save();
    ctx.translate(x, y);
    // drop shadow
    ctx.fillStyle = 'rgba(80,40,80,0.18)';
    this._roundRect(ctx, -hs + size * 0.06, -hs + size * 0.1, size, size, size * 0.28); ctx.fill();
    // body gradient
    const g = ctx.createLinearGradient(0, -hs, 0, hs);
    g.addColorStop(0, this._lighten(k.c, 0.25));
    g.addColorStop(1, k.c);
    ctx.fillStyle = g;
    if (selected) { ctx.shadowColor = '#fff'; ctx.shadowBlur = size * 0.4; }
    this._roundRect(ctx, -hs, -hs, size, size, size * 0.28); ctx.fill();
    ctx.shadowBlur = 0;
    // glossy highlight
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.ellipse(-size * 0.16, -size * 0.2, size * 0.26, size * 0.16, -0.5, 0, Math.PI * 2); ctx.fill();
    // emoji symbol
    ctx.font = `${size * 0.5}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(k.s, 0, size * 0.04);
    ctx.restore();
  }

  _drawHUD(ctx, G) {
    const { W, H } = G;
    const s = Math.max(0.7, Math.min(W, H) / 720);

    // score (left) + best
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#8A2A6A'; ctx.font = `900 ${30 * s}px system-ui, sans-serif`;
    ctx.fillText(`🍬 ${this.score}`, 18 * s, 42 * s);
    ctx.fillStyle = '#A85A8A'; ctx.font = `bold ${15 * s}px system-ui, sans-serif`;
    ctx.fillText(`Mejor: ${this.best}`, 18 * s, 64 * s);
    ctx.fillStyle = '#6A3A9A'; ctx.font = `900 ${16 * s}px system-ui, sans-serif`;
    ctx.fillText(`Nivel ${this.level}`, 18 * s, 86 * s);

    // combo banner
    if (this.comboBanner > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.comboBanner * 1.6);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FF3D9A';
      ctx.font = `900 ${44 * s}px system-ui, sans-serif`;
      ctx.fillText(this.comboText, W / 2, H * 0.42);
      ctx.restore();
    }
    // level-up flash
    if (this.levelFlash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.levelFlash);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#2B8A3E';
      ctx.font = `900 ${52 * s}px system-ui, sans-serif`;
      ctx.fillText(`¡Nivel ${this.level}! 🎉`, W / 2, H * 0.55);
      ctx.restore();
    }
  }

  // ── Small helpers ──────────────────────────────────────────────────────────
  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  }

  _lighten(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.round(r + (255 - r) * amt); g = Math.round(g + (255 - g) * amt); b = Math.round(b + (255 - b) * amt);
    return `rgb(${r},${g},${b})`;
  }

  destroy() {}
}
