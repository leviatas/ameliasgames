// ── Puntos y Cajas (2P, por turnos) ──────────────────────────────────────────
// Cada turno se pinta una rayita entre dos puntos vecinos. El que cierra un
// cuadradito se lo queda y vuelve a jugar. Gana quien tiene más cuadraditos.

const DOTS = 6;                 // puntos por lado → 5×5 = 25 cajas
const CELLS = DOTS - 1;
const NH = DOTS * CELLS;        // rayitas horizontales
const NV = CELLS * DOTS;        // rayitas verticales

export class PuntosYCajas {
  constructor(canvas) {
    this.canvas = canvas;
    this._reset();
  }

  _reset() {
    const W = this.canvas.width, H = this.canvas.height;
    this.W = W; this.H = H;
    this.phase = 'playing';   // 'playing' | 'over'
    this.turn = Math.random() < 0.5 ? 'p1' : 'p2';
    this.h = Array(NH).fill(null);      // quién pintó cada rayita
    this.v = Array(NV).fill(null);
    this.boxes = Array(CELLS * CELLS).fill(null);
    this.score = { p1: 0, p2: 0 };
    this.lastLine = null;               // {kind,i} para resaltar la última jugada
    this.winner = null;

    const size = Math.min(W * 0.92, H * 0.74);
    const cell = size / CELLS;
    this._grid = { cell, x0: W / 2 - size / 2, y0: H * 0.20, size };
  }

  update() {}

  // Centro de cada rayita, que es contra lo que se mide el toque.
  _hPos(i) {
    const { cell, x0, y0 } = this._grid;
    const r = Math.floor(i / CELLS), c = i % CELLS;
    return { x: x0 + c * cell + cell / 2, y: y0 + r * cell };
  }
  _vPos(i) {
    const { cell, x0, y0 } = this._grid;
    const r = Math.floor(i / DOTS), c = i % DOTS;
    return { x: x0 + c * cell, y: y0 + r * cell + cell / 2 };
  }

  // La rayita libre más cercana al dedo, si está lo bastante cerca.
  _lineAt(cx, cy) {
    const { cell } = this._grid;
    const maxD = cell * 0.42;
    let best = null, bestD = maxD * maxD;
    for (let i = 0; i < NH; i++) {
      if (this.h[i]) continue;
      const p = this._hPos(i), dx = cx - p.x, dy = cy - p.y, d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = { kind: 'h', i }; }
    }
    for (let i = 0; i < NV; i++) {
      if (this.v[i]) continue;
      const p = this._vPos(i), dx = cx - p.x, dy = cy - p.y, d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = { kind: 'v', i }; }
    }
    return best;
  }

  // ¿Está cerrada la caja (r,c)? Necesita sus cuatro rayitas.
  _boxClosed(r, c) {
    return !!(this.h[r * CELLS + c] && this.h[(r + 1) * CELLS + c] &&
              this.v[r * DOTS + c] && this.v[r * DOTS + c + 1]);
  }

  pointerDown(cx, cy, player) {
    if (this.phase === 'over') { this._reset(); return; }
    if (player && player !== this.turn) return;
    const hit = this._lineAt(cx, cy);
    if (!hit) return;

    if (hit.kind === 'h') this.h[hit.i] = this.turn; else this.v[hit.i] = this.turn;
    this.lastLine = hit;

    // Sólo las cajas que tocan esta rayita pueden haberse cerrado recién.
    let closed = 0;
    const cand = hit.kind === 'h'
      ? [[Math.floor(hit.i / CELLS) - 1, hit.i % CELLS], [Math.floor(hit.i / CELLS), hit.i % CELLS]]
      : [[Math.floor(hit.i / DOTS), hit.i % DOTS - 1], [Math.floor(hit.i / DOTS), hit.i % DOTS]];
    for (const [r, c] of cand) {
      if (r < 0 || r >= CELLS || c < 0 || c >= CELLS) continue;
      if (this.boxes[r * CELLS + c]) continue;
      if (!this._boxClosed(r, c)) continue;
      this.boxes[r * CELLS + c] = this.turn;
      this.score[this.turn]++;
      closed++;
    }

    if (this.boxes.every(b => b)) {
      this.phase = 'over';
      this.winner = this.score.p1 === this.score.p2 ? 'empate'
                  : this.score.p1 > this.score.p2 ? 'p1' : 'p2';
      return;
    }
    // el que cierra vuelve a jugar: sólo se cambia de turno si no cerró nada
    if (!closed) this.turn = this.turn === 'p1' ? 'p2' : 'p1';
  }
  pointerMove() {}
  pointerUp() {}

  render(ctx) {
    const { W, H } = this;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#10202c'); bg.addColorStop(1, '#081218');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    if (this.phase === 'playing') {
      const cfg = this.turn === 'p1' ? { color: '#FF88BB', name: 'P1' } : { color: '#88BBFF', name: 'P2' };
      ctx.font = `900 ${H * 0.048}px system-ui`;
      ctx.fillStyle = cfg.color;
      ctx.fillText(`Turno de ${cfg.name}`, W / 2, H * 0.03);
    }
    ctx.font = `900 ${H * 0.042}px system-ui`;
    ctx.fillStyle = '#FF4488'; ctx.textAlign = 'left';
    ctx.fillText(`P1  ${this.score.p1}`, W * 0.06, H * 0.115);
    ctx.fillStyle = '#4488FF'; ctx.textAlign = 'right';
    ctx.fillText(`${this.score.p2}  P2`, W * 0.94, H * 0.115);

    const { cell, x0, y0 } = this._grid;

    // cajas ganadas
    for (let r = 0; r < CELLS; r++) {
      for (let c = 0; c < CELLS; c++) {
        const owner = this.boxes[r * CELLS + c];
        if (!owner) continue;
        ctx.fillStyle = owner === 'p1' ? 'rgba(255,68,136,0.30)' : 'rgba(68,136,255,0.30)';
        ctx.fillRect(x0 + c * cell, y0 + r * cell, cell, cell);
        ctx.fillStyle = owner === 'p1' ? '#FF88BB' : '#88BBFF';
        ctx.font = `900 ${cell * 0.42}px system-ui`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(owner === 'p1' ? 'P1' : 'P2', x0 + c * cell + cell / 2, y0 + r * cell + cell / 2);
      }
    }

    // rayitas: las libres apenas insinuadas, las pintadas del color del dueño
    const lw = Math.max(3, cell * 0.10);
    ctx.lineCap = 'round';
    for (let i = 0; i < NH; i++) {
      const r = Math.floor(i / CELLS), c = i % CELLS;
      const ax = x0 + c * cell, ay = y0 + r * cell;
      this._stroke(ctx, ax, ay, ax + cell, ay, this.h[i], lw, this.lastLine, 'h', i);
    }
    for (let i = 0; i < NV; i++) {
      const r = Math.floor(i / DOTS), c = i % DOTS;
      const ax = x0 + c * cell, ay = y0 + r * cell;
      this._stroke(ctx, ax, ay, ax, ay + cell, this.v[i], lw, this.lastLine, 'v', i);
    }

    // puntos
    ctx.fillStyle = '#FFE9A8';
    for (let r = 0; r < DOTS; r++) {
      for (let c = 0; c < DOTS; c++) {
        ctx.beginPath(); ctx.arc(x0 + c * cell, y0 + r * cell, Math.max(2.5, cell * 0.09), 0, Math.PI * 2); ctx.fill();
      }
    }

    if (this.phase === 'over') {
      ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `900 ${H * 0.13}px system-ui`;
      if (this.winner === 'empate') { ctx.fillStyle = '#FFD700'; ctx.fillText('🤝 ¡Empate!', W / 2, H * 0.4); }
      else {
        const cfg = this.winner === 'p1' ? { color: '#FF88BB', name: 'P1' } : { color: '#88BBFF', name: 'P2' };
        ctx.fillStyle = cfg.color; ctx.fillText(`¡Ganó ${cfg.name}!`, W / 2, H * 0.4);
      }
      ctx.font = `900 ${H * 0.06}px system-ui`; ctx.fillStyle = '#ffffffcc';
      ctx.fillText(`${this.score.p1} — ${this.score.p2}`, W / 2, H * 0.52);
      ctx.font = `${H * 0.05}px system-ui`; ctx.fillStyle = '#ffffff66';
      ctx.fillText('Tocá para jugar de nuevo', W / 2, H * 0.62);
    }
  }

  _stroke(ctx, x1, y1, x2, y2, owner, lw, last, kind, i) {
    const isLast = last && last.kind === kind && last.i === i;
    ctx.strokeStyle = owner ? (owner === 'p1' ? '#FF4488' : '#4488FF') : 'rgba(255,255,255,0.10)';
    ctx.lineWidth = owner ? lw : Math.max(1.5, lw * 0.35);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    if (isLast) {
      ctx.strokeStyle = '#FFD700'; ctx.lineWidth = lw * 0.4;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
  }

  // ── Online sync: host broadcasts this every frame, guest applies it ──────
  getNetState() {
    return {
      W: this.W, H: this.H, grid: this._grid,
      phase: this.phase, turn: this.turn, h: this.h, v: this.v,
      boxes: this.boxes, score: this.score, lastLine: this.lastLine, winner: this.winner,
    };
  }

  setNetState(s) {
    this.W = s.W; this.H = s.H; this._grid = s.grid;
    this.phase = s.phase; this.turn = s.turn; this.h = s.h; this.v = s.v;
    this.boxes = s.boxes; this.score = s.score; this.lastLine = s.lastLine; this.winner = s.winner;
  }
}
