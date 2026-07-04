// ── Tres en Raya (2P, por turnos): clásico 3×3, X rosa vs O celeste ──────────

const LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6],
];

export class TresEnRaya {
  constructor(canvas) {
    this.canvas = canvas;
    this._reset();
  }

  _reset() {
    const W = this.canvas.width, H = this.canvas.height;
    this.W = W; this.H = H;
    this.phase = 'playing';   // 'playing' | 'over'
    this.turn = Math.random() < 0.5 ? 'p1' : 'p2';
    this.board = Array(9).fill(null);
    this.winner = null;
    this.winLine = null;

    const size = Math.min(W, H) * 0.62;
    const cell = size / 3;
    this._grid = { cell, x0: W / 2 - size / 2, y0: H / 2 - size / 2, size };
  }

  update() {}

  _cellAt(cx, cy) {
    const { cell, x0, y0, size } = this._grid;
    if (cx < x0 || cx > x0 + size || cy < y0 || cy > y0 + size) return -1;
    const col = Math.floor((cx - x0) / cell);
    const row = Math.floor((cy - y0) / cell);
    if (col < 0 || col > 2 || row < 0 || row > 2) return -1;
    return row * 3 + col;
  }

  pointerDown(cx, cy, player) {
    if (this.phase === 'over') { this._reset(); return; }
    if (player && player !== this.turn) return;
    const i = this._cellAt(cx, cy);
    if (i < 0 || this.board[i]) return;

    this.board[i] = this.turn;
    for (const line of LINES) {
      const [a, b, c] = line;
      if (this.board[a] && this.board[a] === this.board[b] && this.board[b] === this.board[c]) {
        this.phase = 'over'; this.winner = this.board[a]; this.winLine = line;
        return;
      }
    }
    if (this.board.every(v => v)) { this.phase = 'over'; this.winner = 'empate'; return; }
    this.turn = this.turn === 'p1' ? 'p2' : 'p1';
  }
  pointerMove() {}
  pointerUp() {}

  render(ctx) {
    const { W, H } = this;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#241030'); g.addColorStop(1, '#12081e');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    ctx.textBaseline = 'top';
    ctx.font = `900 ${H * 0.05}px system-ui`;
    if (this.phase === 'playing') {
      const cfg = this.turn === 'p1' ? { color: '#FF88BB', name: 'P1' } : { color: '#88BBFF', name: 'P2' };
      ctx.textAlign = 'center'; ctx.fillStyle = cfg.color;
      ctx.fillText(`Turno de ${cfg.name}`, W / 2, 14);
    }

    const { cell, x0, y0, size } = this._grid;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = Math.max(3, cell * 0.03);
    ctx.beginPath();
    for (let i = 1; i < 3; i++) {
      ctx.moveTo(x0 + i * cell, y0); ctx.lineTo(x0 + i * cell, y0 + size);
      ctx.moveTo(x0, y0 + i * cell); ctx.lineTo(x0 + size, y0 + i * cell);
    }
    ctx.stroke();

    for (let i = 0; i < 9; i++) {
      const v = this.board[i]; if (!v) continue;
      const col = i % 3, row = Math.floor(i / 3);
      const cx = x0 + col * cell + cell / 2, cy = y0 + row * cell + cell / 2;
      const r = cell * 0.28;
      const highlighted = this.winLine && this.winLine.includes(i);
      ctx.globalAlpha = this.winLine && !highlighted ? 0.35 : 1;
      if (v === 'p1') {
        ctx.strokeStyle = '#FF4488'; ctx.lineWidth = cell * 0.10; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx - r, cy - r); ctx.lineTo(cx + r, cy + r); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + r, cy - r); ctx.lineTo(cx - r, cy + r); ctx.stroke();
      } else {
        ctx.strokeStyle = '#4488FF'; ctx.lineWidth = cell * 0.10;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    if (this.phase === 'over') {
      ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `900 ${H * 0.17}px system-ui`;
      if (this.winner === 'empate') { ctx.fillStyle = '#FFD700'; ctx.fillText('🤝 ¡Empate!', W / 2, H * 0.4); }
      else {
        const cfg = this.winner === 'p1' ? { color: '#FF88BB', name: 'P1' } : { color: '#88BBFF', name: 'P2' };
        ctx.fillStyle = cfg.color; ctx.fillText(`¡Ganó ${cfg.name}!`, W / 2, H * 0.4);
      }
      ctx.font = `${H * 0.06}px system-ui`; ctx.fillStyle = '#ffffff66';
      ctx.fillText('Tocá para jugar de nuevo', W / 2, H * 0.58);
    }
  }

  // ── Online sync: host broadcasts this every frame, guest applies it ──────
  getNetState() {
    return {
      W: this.W, H: this.H, grid: this._grid,
      phase: this.phase, turn: this.turn, board: this.board,
      winner: this.winner, winLine: this.winLine,
    };
  }

  setNetState(s) {
    this.W = s.W; this.H = s.H; this._grid = s.grid;
    this.phase = s.phase; this.turn = s.turn; this.board = s.board;
    this.winner = s.winner; this.winLine = s.winLine;
  }
}
