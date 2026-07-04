// ── Piedra, Papel o Tijera (2P): mejor de 5, elegís en privado y se revela ───

const CHOICES = ['piedra', 'papel', 'tijera'];
const EMOJI = { piedra: '✊', papel: '🖐', tijera: '✌️' };
const BEATS = { piedra: 'tijera', papel: 'piedra', tijera: 'papel' }; // key vence a value

export class PiedraPapelTijera {
  constructor(canvas) {
    this.canvas = canvas;
    this._reset();
  }

  _reset() {
    const W = this.canvas.width, H = this.canvas.height;
    this.W = W; this.H = H;
    this.ROUNDS_TO_WIN = 3;
    this.score = { p1: 0, p2: 0 };
    this.phase = 'choosing';   // 'choosing' | 'reveal' | 'over'
    this.p1Choice = null; this.p2Choice = null;
    this.roundWinner = null; this.revealTimer = 0; this.winner = null;
  }

  _buttons(player) {
    const W = this.W, H = this.H, half = W / 2;
    const bw = Math.min(half * 0.26, H * 0.18);
    const gap = bw * 0.25;
    const totalW = bw * 3 + gap * 2;
    const x0 = player === 'p1' ? (half - totalW) / 2 : half + (half - totalW) / 2;
    const y0 = H * 0.62;
    return CHOICES.map((choice, i) => ({ x: x0 + i * (bw + gap), y: y0, w: bw, h: bw, choice }));
  }

  _resolveRound() {
    const a = this.p1Choice, b = this.p2Choice;
    if (a === b) this.roundWinner = 'empate';
    else if (BEATS[a] === b) { this.roundWinner = 'p1'; this.score.p1++; }
    else { this.roundWinner = 'p2'; this.score.p2++; }
    this.phase = 'reveal'; this.revealTimer = 1.8;
  }

  update(dt) {
    if (this.phase !== 'reveal') return;
    this.revealTimer -= dt;
    if (this.revealTimer <= 0) {
      if (this.score.p1 >= this.ROUNDS_TO_WIN || this.score.p2 >= this.ROUNDS_TO_WIN) {
        this.phase = 'over'; this.winner = this.score.p1 > this.score.p2 ? 'p1' : 'p2';
      } else {
        this.p1Choice = null; this.p2Choice = null; this.roundWinner = null; this.phase = 'choosing';
      }
    }
  }

  pointerDown(cx, cy, player) {
    if (this.phase === 'over') { this._reset(); return; }
    if (this.phase !== 'choosing' || !player) return;
    const already = player === 'p1' ? this.p1Choice : this.p2Choice;
    if (already) return;
    for (const b of this._buttons(player)) {
      if (cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h) {
        if (player === 'p1') this.p1Choice = b.choice; else this.p2Choice = b.choice;
        break;
      }
    }
    if (this.p1Choice && this.p2Choice) this._resolveRound();
  }
  pointerMove() {}
  pointerUp() {}

  render(ctx) {
    const { W, H } = this;
    ctx.fillStyle = '#12081e'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,68,136,0.06)'; ctx.fillRect(0, 0, W / 2, H);
    ctx.fillStyle = 'rgba(68,136,255,0.06)'; ctx.fillRect(W / 2, 0, W / 2, H);
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(W / 2 - 1, 0, 2, H);

    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.font = `900 ${H * 0.06}px system-ui`;
    ctx.fillStyle = '#FF88BB'; ctx.fillText('P1', W * 0.25, 10);
    ctx.fillStyle = '#88BBFF'; ctx.fillText('P2', W * 0.75, 10);

    const dotR = Math.max(7, H * 0.022);
    for (let i = 0; i < this.ROUNDS_TO_WIN; i++) {
      ctx.beginPath(); ctx.arc(W * 0.25 - (this.ROUNDS_TO_WIN - 1) * dotR * 1.2 + i * dotR * 2.4, H * 0.15, dotR, 0, Math.PI * 2);
      ctx.fillStyle = i < this.score.p1 ? '#FF88BB' : 'rgba(255,136,187,0.25)'; ctx.fill();
    }
    for (let i = 0; i < this.ROUNDS_TO_WIN; i++) {
      ctx.beginPath(); ctx.arc(W * 0.75 - (this.ROUNDS_TO_WIN - 1) * dotR * 1.2 + i * dotR * 2.4, H * 0.15, dotR, 0, Math.PI * 2);
      ctx.fillStyle = i < this.score.p2 ? '#88BBFF' : 'rgba(136,187,255,0.25)'; ctx.fill();
    }

    for (const player of ['p1', 'p2']) {
      const chosen = player === 'p1' ? this.p1Choice : this.p2Choice;
      const btns = this._buttons(player);
      for (const b of btns) {
        const isChosenBtn = chosen === b.choice;
        ctx.globalAlpha = chosen && !isChosenBtn ? 0.35 : 1;
        ctx.fillStyle = isChosenBtn ? 'rgba(255,215,0,0.25)' : 'rgba(255,255,255,0.08)';
        ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, b.w * 0.18); ctx.fill();
        ctx.strokeStyle = isChosenBtn ? '#FFD700' : 'rgba(255,255,255,0.25)';
        ctx.lineWidth = isChosenBtn ? 3 : 1.5;
        ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, b.w * 0.18); ctx.stroke();
        ctx.font = `${b.w * 0.55}px serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.fillText(EMOJI[b.choice], b.x + b.w / 2, b.y + b.h / 2);
        ctx.globalAlpha = 1;
      }
      if (this.phase === 'choosing') {
        ctx.font = `bold ${H * 0.038}px system-ui`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        const labelX = player === 'p1' ? W * 0.25 : W * 0.75;
        if (chosen) { ctx.fillStyle = '#FFD700'; ctx.fillText('✓ ¡Elegiste!', labelX, btns[0].y - H * 0.03); }
        else { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillText('Elegí:', labelX, btns[0].y - H * 0.03); }
      }
    }

    if (this.phase === 'reveal') {
      ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `${H * 0.2}px serif`;
      ctx.fillText(EMOJI[this.p1Choice], W * 0.30, H * 0.42);
      ctx.fillText(EMOJI[this.p2Choice], W * 0.70, H * 0.42);
      let msg, color;
      if (this.roundWinner === 'empate') { msg = '¡Empate!'; color = '#FFD700'; }
      else {
        const cfg = this.roundWinner === 'p1' ? { c: '#FF88BB', n: 'P1' } : { c: '#88BBFF', n: 'P2' };
        msg = `¡Punto para ${cfg.n}!`; color = cfg.c;
      }
      ctx.font = `bold ${H * 0.08}px system-ui`; ctx.fillStyle = color;
      ctx.fillText(msg, W / 2, H * 0.68);
    }

    if (this.phase === 'over') {
      ctx.fillStyle = 'rgba(0,0,0,0.78)'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const cfg = this.winner === 'p1' ? { c: '#FF88BB', n: 'P1' } : { c: '#88BBFF', n: 'P2' };
      ctx.font = `900 ${H * 0.16}px system-ui`; ctx.fillStyle = cfg.c;
      ctx.fillText(`¡Ganó ${cfg.n}!`, W / 2, H * 0.4);
      ctx.font = `bold ${H * 0.08}px system-ui`; ctx.fillStyle = '#ffffffaa';
      ctx.fillText(`${this.score.p1}  :  ${this.score.p2}`, W / 2, H * 0.56);
      ctx.font = `${H * 0.055}px system-ui`; ctx.fillStyle = '#ffffff66';
      ctx.fillText('Tocá para jugar de nuevo', W / 2, H * 0.7);
    }
  }

  // ── Online sync: host broadcasts this every frame, guest applies it ──────
  getNetState() {
    return {
      W: this.W, H: this.H, ROUNDS_TO_WIN: this.ROUNDS_TO_WIN,
      score: this.score, phase: this.phase,
      p1Choice: this.p1Choice, p2Choice: this.p2Choice,
      roundWinner: this.roundWinner, revealTimer: this.revealTimer, winner: this.winner,
    };
  }

  setNetState(s) {
    this.W = s.W; this.H = s.H; this.ROUNDS_TO_WIN = s.ROUNDS_TO_WIN;
    this.score = s.score; this.phase = s.phase;
    this.p1Choice = s.p1Choice; this.p2Choice = s.p2Choice;
    this.roundWinner = s.roundWinner; this.revealTimer = s.revealTimer; this.winner = s.winner;
  }
}
