// ── 5 en Línea / Gomoku (2P, por turnos) ─────────────────────────────────────
// Como el Tres en Raya pero en tablero grande: se pone una ficha por turno en
// cualquier casilla libre y gana quien alinea cinco.

const N = 10;                   // tablero N×N
const NEED = 5;

export class CincoEnLinea {
  constructor(canvas) {
    this.canvas = canvas;
    this._reset();
  }

  _reset() {
    const W = this.canvas.width, H = this.canvas.height;
    this.W = W; this.H = H;
    this.phase = 'playing';   // 'playing' | 'over'
    this.turn = Math.random() < 0.5 ? 'p1' : 'p2';
    this.board = Array(N * N).fill(null);
    this.winner = null;
    this.winCells = null;
    this.last = -1;

    const size = Math.min(W * 0.94, H * 0.78);
    const cell = size / N;
    this._grid = { cell, x0: W / 2 - size / 2, y0: H * 0.17, size };
  }

  update() {}

  // ¿La ficha recién puesta cierra cinco en alguna de las cuatro direcciones?
  _checkWin(row, col, player) {
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (const [dr, dc] of dirs) {
      const cells = [[row, col]];
      for (const s of [1, -1]) {
        let r = row + dr * s, c = col + dc * s;
        while (r >= 0 && r < N && c >= 0 && c < N && this.board[r * N + c] === player) {
          cells.push([r, c]); r += dr * s; c += dc * s;
        }
      }
      if (cells.length >= NEED) { this.winCells = cells.map(([r, c]) => r * N + c); return true; }
    }
    return false;
  }

  pointerDown(cx, cy, player) {
    if (this.phase === 'over') { this._reset(); return; }
    if (player && player !== this.turn) return;
    const { cell, x0, y0, size } = this._grid;
    if (cx < x0 || cx > x0 + size || cy < y0 || cy > y0 + size) return;
    const col = Math.floor((cx - x0) / cell), row = Math.floor((cy - y0) / cell);
    if (col < 0 || col >= N || row < 0 || row >= N) return;
    const idx = row * N + col;
    if (this.board[idx]) return;

    this.board[idx] = this.turn;
    this.last = idx;
    if (this._checkWin(row, col, this.turn)) { this.phase = 'over'; this.winner = this.turn; return; }
    if (this.board.every(v => v)) { this.phase = 'over'; this.winner = 'empate'; return; }
    this.turn = this.turn === 'p1' ? 'p2' : 'p1';
  }
  pointerMove() {}
  pointerUp() {}

  render(ctx) {
    const { W, H } = this;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#2a1e10'); bg.addColorStop(1, '#150f08');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    if (this.phase === 'playing') {
      const cfg = this.turn === 'p1' ? { color: '#FF88BB', name: 'P1' } : { color: '#88BBFF', name: 'P2' };
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.font = `900 ${H * 0.05}px system-ui`;
      ctx.fillStyle = cfg.color;
      ctx.fillText(`Turno de ${cfg.name}`, W / 2, H * 0.04);
    }

    const { cell, x0, y0, size } = this._grid;

    // tablero de madera con la grilla por dentro de las casillas
    ctx.fillStyle = '#C89A5B';
    ctx.beginPath(); ctx.roundRect(x0 - cell * 0.2, y0 - cell * 0.2, size + cell * 0.4, size + cell * 0.4, cell * 0.25); ctx.fill();
    ctx.strokeStyle = 'rgba(70,40,15,0.55)'; ctx.lineWidth = Math.max(1, cell * 0.03);
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      ctx.moveTo(x0 + i * cell, y0); ctx.lineTo(x0 + i * cell, y0 + size);
      ctx.moveTo(x0, y0 + i * cell); ctx.lineTo(x0 + size, y0 + i * cell);
    }
    ctx.stroke();

    for (let i = 0; i < N * N; i++) {
      const v = this.board[i]; if (!v) continue;
      const col = i % N, row = Math.floor(i / N);
      const cx = x0 + col * cell + cell / 2, cy = y0 + row * cell + cell / 2;
      const isWin = this.winCells && this.winCells.includes(i);
      ctx.globalAlpha = this.winCells && !isWin ? 0.4 : 1;
      ctx.fillStyle = v === 'p1' ? '#FF4488' : '#4488FF';
      ctx.beginPath(); ctx.arc(cx, cy, cell * 0.38, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.beginPath(); ctx.ellipse(cx - cell * 0.11, cy - cell * 0.13, cell * 0.15, cell * 0.09, -0.5, 0, Math.PI * 2); ctx.fill();
      if (isWin) { ctx.strokeStyle = '#FFD700'; ctx.lineWidth = cell * 0.08; ctx.beginPath(); ctx.arc(cx, cy, cell * 0.38, 0, Math.PI * 2); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }

    // marquita en la última ficha, que en un tablero grande cuesta encontrarla
    if (this.last >= 0 && !this.winCells) {
      const col = this.last % N, row = Math.floor(this.last / N);
      ctx.strokeStyle = '#FFE9A8'; ctx.lineWidth = Math.max(2, cell * 0.05);
      ctx.beginPath(); ctx.arc(x0 + col * cell + cell / 2, y0 + row * cell + cell / 2, cell * 0.17, 0, Math.PI * 2); ctx.stroke();
    }

    if (this.phase === 'over') {
      ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `900 ${H * 0.15}px system-ui`;
      if (this.winner === 'empate') { ctx.fillStyle = '#FFD700'; ctx.fillText('🤝 ¡Empate!', W / 2, H * 0.42); }
      else {
        const cfg = this.winner === 'p1' ? { color: '#FF88BB', name: 'P1' } : { color: '#88BBFF', name: 'P2' };
        ctx.fillStyle = cfg.color; ctx.fillText(`¡Ganó ${cfg.name}!`, W / 2, H * 0.42);
      }
      ctx.font = `${H * 0.055}px system-ui`; ctx.fillStyle = '#ffffff66';
      ctx.fillText('Tocá para jugar de nuevo', W / 2, H * 0.58);
    }
  }

  // ── Online sync: host broadcasts this every frame, guest applies it ──────
  getNetState() {
    return {
      W: this.W, H: this.H, grid: this._grid,
      phase: this.phase, turn: this.turn, board: this.board,
      winner: this.winner, winCells: this.winCells, last: this.last,
    };
  }

  setNetState(s) {
    this.W = s.W; this.H = s.H; this._grid = s.grid;
    this.phase = s.phase; this.turn = s.turn; this.board = s.board;
    this.winner = s.winner; this.winCells = s.winCells; this.last = s.last;
  }
}
