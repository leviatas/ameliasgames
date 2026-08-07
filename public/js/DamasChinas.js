// ── Damas Chinas (2P, por turnos) ────────────────────────────────────────────
// Estrella de seis puntas. Cada una arranca con sus fichas en una punta y tiene
// que meterlas todas en la punta de enfrente. Se mueve de a un hoyo pegado, o se
// salta por arriba de una ficha (de cualquiera) hasta el hoyo vacío de atrás, y
// los saltos se pueden encadenar: ahí está toda la gracia del juego.
//
// La estrella clásica tiene 121 hoyos y 10 fichas por jugadora; acá se usa la de
// triángulos de lado 3 (73 hoyos, 6 fichas) para que los hoyos sigan siendo
// tocables con el dedo en un teléfono y la partida no se haga eterna.

// Cada fila con las posiciones horizontales de sus hoyos, en medias unidades.
// Los vecinos son (fila, x±2) y (fila±1, x±1): así se arma la red triangular.
const ROWS = [
  [9],                                    // 0  ┐
  [8, 10],                                // 1  ├ punta de arriba (meta de P1)
  [7, 9, 11],                             // 2  ┘
  [0, 2, 4, 6, 8, 10, 12, 14, 16, 18],    // 3  ┐
  [1, 3, 5, 7, 9, 11, 13, 15, 17],        // 4  │
  [2, 4, 6, 8, 10, 12, 14, 16],           // 5  │
  [3, 5, 7, 9, 11, 13, 15],               // 6  ├ el cuerpo de la estrella
  [2, 4, 6, 8, 10, 12, 14, 16],           // 7  │
  [1, 3, 5, 7, 9, 11, 13, 15, 17],        // 8  │
  [0, 2, 4, 6, 8, 10, 12, 14, 16, 18],    // 9  ┘
  [7, 9, 11],                             // 10 ┐
  [8, 10],                                // 11 ├ punta de abajo (meta de P2)
  [9],                                    // 12 ┘
];
const TOP_ROWS = [0, 1, 2], BOT_ROWS = [10, 11, 12];
const DIRS = [[0, 2], [0, -2], [-1, 1], [-1, -1], [1, 1], [1, -1]];

// Los hoyos aplanados, más un índice (fila,x) → número de hoyo.
const HOLES = [];
const AT = new Map();
ROWS.forEach((xs, r) => xs.forEach(x => { AT.set(r * 100 + x, HOLES.length); HOLES.push({ r, x }); }));
const idxAt = (r, x) => (AT.has(r * 100 + x) ? AT.get(r * 100 + x) : -1);

const HOME = {
  p1: HOLES.map((h, i) => (BOT_ROWS.includes(h.r) ? i : -1)).filter(i => i >= 0),
  p2: HOLES.map((h, i) => (TOP_ROWS.includes(h.r) ? i : -1)).filter(i => i >= 0),
};
const GOAL = { p1: HOME.p2, p2: HOME.p1 };

export class DamasChinas {
  constructor(canvas) {
    this.canvas = canvas;
    this._reset();
  }

  _reset() {
    const W = this.canvas.width, H = this.canvas.height;
    this.W = W; this.H = H;
    this.phase = 'playing';   // 'playing' | 'over'
    this.turn = Math.random() < 0.5 ? 'p1' : 'p2';
    this.board = Array(HOLES.length).fill(null);
    for (const i of HOME.p1) this.board[i] = 'p1';
    for (const i of HOME.p2) this.board[i] = 'p2';
    this.sel = -1;
    this.dests = [];
    this.last = null;         // {from,to} para marcar la última jugada
    this.winner = null;

    this._layout();
  }

  _layout() {
    // Red triangular: el paso vertical es √3 veces la media unidad horizontal.
    const hx = Math.min(this.W * 0.86 / 18, this.H * 0.76 / (12 * Math.sqrt(3)));
    const hy = hx * Math.sqrt(3);
    this._geo = { hx, hy, x0: this.W / 2 - 9 * hx, y0: this.H * 0.155, r: hx * 0.62 };
  }

  _pos(i) {
    const g = this._geo, h = HOLES[i];
    return { x: g.x0 + h.x * g.hx, y: g.y0 + h.r * g.hy };
  }

  _holeAt(cx, cy) {
    const rr = this._geo.r * 1.5;
    let best = -1, bestD = rr * rr;
    for (let i = 0; i < HOLES.length; i++) {
      const p = this._pos(i), dx = cx - p.x, dy = cy - p.y, d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  // Un paso a un hoyo pegado, más todos los hoyos alcanzables encadenando
  // saltos. Un salto pasa por arriba de una ficha de cualquiera de las dos.
  _destinations(from) {
    const out = new Set();
    const h = HOLES[from];
    for (const [dr, dx] of DIRS) {
      const j = idxAt(h.r + dr, h.x + dx);
      if (j >= 0 && !this.board[j]) out.add(j);
    }
    const seen = new Set([from]);
    const stack = [from];
    while (stack.length) {
      const cur = stack.pop(), c = HOLES[cur];
      for (const [dr, dx] of DIRS) {
        const mid = idxAt(c.r + dr, c.x + dx);
        const land = idxAt(c.r + dr * 2, c.x + dx * 2);
        if (mid < 0 || land < 0) continue;
        if (!this.board[mid] || this.board[land]) continue;
        if (seen.has(land)) continue;
        seen.add(land); out.add(land); stack.push(land);
      }
    }
    out.delete(from);
    return [...out];
  }

  _won(player) { return GOAL[player].every(i => this.board[i] === player); }

  update() {}

  pointerDown(cx, cy, player) {
    if (this.phase === 'over') { this._reset(); return; }
    if (player && player !== this.turn) return;
    const i = this._holeAt(cx, cy);
    if (i < 0) return;
    const me = this.turn;

    if (this.board[i] === me) {
      // elegir (o desmarcar) una ficha propia
      if (this.sel === i) { this.sel = -1; this.dests = []; }
      else { this.sel = i; this.dests = this._destinations(i); }
      return;
    }
    if (this.sel < 0 || !this.dests.includes(i)) return;

    this.board[i] = me;
    this.board[this.sel] = null;
    this.last = { from: this.sel, to: i };
    this.sel = -1; this.dests = [];
    if (this._won(me)) { this.phase = 'over'; this.winner = me; return; }
    this.turn = me === 'p1' ? 'p2' : 'p1';
  }
  pointerMove() {}
  pointerUp() {}

  render(ctx) {
    const { W, H } = this;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#221436'); bg.addColorStop(1, '#0e0718');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    const g = this._geo;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    if (this.phase !== 'over') {
      const cfg = this.turn === 'p1' ? { color: '#FF88BB', name: 'P1' } : { color: '#88BBFF', name: 'P2' };
      ctx.font = `900 ${H * 0.046}px system-ui`; ctx.fillStyle = cfg.color;
      ctx.fillText(`Turno de ${cfg.name}`, W / 2, H * 0.05);
      ctx.font = `${H * 0.030}px system-ui`; ctx.fillStyle = '#ffffff66';
      ctx.fillText(this.sel >= 0 ? 'tocá a dónde la mandás' : 'tocá una ficha tuya', W / 2, H * 0.095);
    }

    // las dos puntas que son meta, pintadas flojito
    for (const [pl, color] of [['p1', 'rgba(255,68,136,0.16)'], ['p2', 'rgba(68,136,255,0.16)']]) {
      ctx.fillStyle = color;
      for (const i of GOAL[pl]) {
        const p = this._pos(i);
        ctx.beginPath(); ctx.arc(p.x, p.y, g.r * 1.45, 0, Math.PI * 2); ctx.fill();
      }
    }

    // hoyos
    for (let i = 0; i < HOLES.length; i++) {
      const p = this._pos(i);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.arc(p.x, p.y, g.r * 0.72, 0, Math.PI * 2); ctx.fill();
    }

    // a dónde puede ir la ficha elegida
    ctx.fillStyle = 'rgba(255,215,0,0.35)';
    for (const d of this.dests) {
      const p = this._pos(d);
      ctx.beginPath(); ctx.arc(p.x, p.y, g.r * 0.45, 0, Math.PI * 2); ctx.fill();
    }

    // fichas
    for (let i = 0; i < HOLES.length; i++) {
      const v = this.board[i]; if (!v) continue;
      const p = this._pos(i);
      ctx.fillStyle = v === 'p1' ? '#FF4488' : '#4488FF';
      ctx.beginPath(); ctx.arc(p.x, p.y, g.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.30)';
      ctx.beginPath(); ctx.ellipse(p.x - g.r * 0.28, p.y - g.r * 0.32, g.r * 0.36, g.r * 0.22, -0.5, 0, Math.PI * 2); ctx.fill();
      if (i === this.sel) {
        ctx.strokeStyle = '#FFD700'; ctx.lineWidth = g.r * 0.3;
        ctx.beginPath(); ctx.arc(p.x, p.y, g.r * 1.25, 0, Math.PI * 2); ctx.stroke();
      } else if (this.last && i === this.last.to) {
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = g.r * 0.18;
        ctx.beginPath(); ctx.arc(p.x, p.y, g.r * 1.2, 0, Math.PI * 2); ctx.stroke();
      }
    }

    // cuántas fichas metió cada una en su meta
    ctx.font = `900 ${H * 0.034}px system-ui`;
    for (const [pl, color, x] of [['p1', '#FF4488', W * 0.08], ['p2', '#4488FF', W * 0.92]]) {
      const n = GOAL[pl].filter(i => this.board[i] === pl).length;
      ctx.fillStyle = color;
      ctx.fillText(`${pl === 'p1' ? 'P1' : 'P2'}  ${n}/${GOAL[pl].length}`, x, H * 0.5);
    }

    if (this.phase === 'over') {
      ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, W, H);
      ctx.font = `900 ${H * 0.14}px system-ui`;
      const cfg = this.winner === 'p1' ? { color: '#FF88BB', name: 'P1' } : { color: '#88BBFF', name: 'P2' };
      ctx.fillStyle = cfg.color; ctx.fillText(`¡Ganó ${cfg.name}!`, W / 2, H * 0.42);
      ctx.font = `${H * 0.05}px system-ui`; ctx.fillStyle = '#ffffff66';
      ctx.fillText('Tocá para jugar de nuevo', W / 2, H * 0.58);
    }
  }

  // ── Online sync: host broadcasts this every frame, guest applies it ──────
  getNetState() {
    return {
      W: this.W, H: this.H, geo: this._geo,
      phase: this.phase, turn: this.turn, board: this.board,
      sel: this.sel, dests: this.dests, last: this.last, winner: this.winner,
    };
  }

  setNetState(s) {
    this.W = s.W; this.H = s.H; this._geo = s.geo;
    this.phase = s.phase; this.turn = s.turn; this.board = s.board;
    this.sel = s.sel; this.dests = s.dests; this.last = s.last; this.winner = s.winner;
  }
}
