// ── Conecta 4 (2P, por turnos): soltá fichas y alineá 4 para ganar ───────────

const COLS = 7, ROWS = 6;

export class Conecta4 {
  constructor(canvas) {
    this.canvas = canvas;
    this._reset();
  }

  _reset() {
    const W = this.canvas.width, H = this.canvas.height;
    this.W = W; this.H = H;
    this.phase = 'playing';   // 'playing' | 'over'
    this.turn = Math.random() < 0.5 ? 'p1' : 'p2';
    this.board = Array(COLS * ROWS).fill(null);
    this.winner = null;
    this.winCells = null;
    this.dropAnim = null;

    const marginTop = H * 0.12;
    const availW = W * 0.92, availH = H - marginTop - H * 0.04;
    const cell = Math.min(availW / COLS, availH / ROWS);
    const gw = cell * COLS, gh = cell * ROWS;
    this._grid = { cell, x0: W / 2 - gw / 2, y0: marginTop, gw, gh };
  }

  _checkWin(row, col, player) {
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (const [dr, dc] of dirs) {
      const cells = [[row, col]];
      for (const s of [1, -1]) {
        let r = row + dr * s, c = col + dc * s;
        while (r >= 0 && r < ROWS && c >= 0 && c < COLS && this.board[r * COLS + c] === player) {
          cells.push([r, c]); r += dr * s; c += dc * s;
        }
      }
      if (cells.length >= 4) { this.winCells = cells.map(([r, c]) => r * COLS + c); return true; }
    }
    return false;
  }

  update(dt) {
    if (!this.dropAnim) return;
    const d = this.dropAnim;
    const targetY = this._grid.y0 + d.row * this._grid.cell + this._grid.cell / 2;
    d.vy += this.H * 3.4 * dt;
    d.y += d.vy * dt;
    if (d.y >= targetY) {
      d.y = targetY;
      const idx = d.row * COLS + d.col;
      this.board[idx] = d.player;
      this.dropAnim = null;
      if (this._checkWin(d.row, d.col, d.player)) { this.phase = 'over'; this.winner = d.player; }
      else if (this.board.every(v => v)) { this.phase = 'over'; this.winner = 'empate'; }
      else this.turn = this.turn === 'p1' ? 'p2' : 'p1';
    }
  }

  pointerDown(cx, cy, player) {
    if (this.phase === 'over') { this._reset(); return; }
    if (player && player !== this.turn) return;
    if (this.dropAnim) return;
    const { cell, x0, y0, gw, gh } = this._grid;
    if (cx < x0 || cx > x0 + gw) return;
    if (cy < y0 - cell || cy > y0 + gh) return;
    const col = Math.floor((cx - x0) / cell);
    if (col < 0 || col >= COLS) return;
    let row = -1;
    for (let r = ROWS - 1; r >= 0; r--) { if (!this.board[r * COLS + col]) { row = r; break; } }
    if (row < 0) return; // column full
    this.dropAnim = { col, row, player: this.turn, y: y0 - cell * 0.6, vy: 0 };
  }
  pointerMove() {}
  pointerUp() {}

  render(ctx) {
    const { W, H } = this;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1a1030'); bg.addColorStop(1, '#0d0818');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    ctx.textBaseline = 'top'; ctx.textAlign = 'center';
    ctx.font = `900 ${H * 0.05}px system-ui`;
    if (this.phase === 'playing') {
      const cfg = this.turn === 'p1' ? { color: '#FF88BB', name: 'P1' } : { color: '#88BBFF', name: 'P2' };
      ctx.fillStyle = cfg.color;
      ctx.fillText(`Turno de ${cfg.name}`, W / 2, 10);
    }

    const { cell, x0, y0, gw, gh } = this._grid;
    ctx.fillStyle = '#2A3FA0';
    ctx.beginPath(); ctx.roundRect(x0 - cell * 0.15, y0 - cell * 0.15, gw + cell * 0.3, gh + cell * 0.3, cell * 0.2); ctx.fill();

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const idx = r * COLS + c, v = this.board[idx];
        const cx = x0 + c * cell + cell / 2, cy = y0 + r * cell + cell / 2;
        const rad = cell * 0.38;
        const isWin = this.winCells && this.winCells.includes(idx);
        ctx.globalAlpha = this.winCells && !isWin ? 0.45 : 1;
        ctx.fillStyle = v === 'p1' ? '#FF4488' : v === 'p2' ? '#4488FF' : 'rgba(0,0,0,0.35)';
        ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
        if (isWin) { ctx.strokeStyle = '#FFD700'; ctx.lineWidth = cell * 0.06; ctx.stroke(); }
        ctx.globalAlpha = 1;
      }
    }

    if (this.dropAnim) {
      const d = this.dropAnim;
      const cx = x0 + d.col * cell + cell / 2;
      ctx.fillStyle = d.player === 'p1' ? '#FF4488' : '#4488FF';
      ctx.beginPath(); ctx.arc(cx, d.y, cell * 0.38, 0, Math.PI * 2); ctx.fill();
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
      winner: this.winner, winCells: this.winCells, dropAnim: this.dropAnim,
    };
  }

  setNetState(s) {
    this.W = s.W; this.H = s.H; this._grid = s.grid;
    this.phase = s.phase; this.turn = s.turn; this.board = s.board;
    this.winner = s.winner; this.winCells = s.winCells; this.dropAnim = s.dropAnim;
  }
}
