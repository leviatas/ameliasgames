// ── Memoria Duelo (2P): encontrá más parejas que tu rival ────────────────────
// Tablero compartido de 4×4 cartas boca abajo. Por turnos: la jugadora de
// turno da vuelta dos cartas; si son iguales se las lleva y sigue jugando,
// si no, vuelven boca abajo y pasa el turno. Cualquier toque cuenta para la
// jugadora de turno (¡jueguen por turnos de verdad!).

const EMOJIS = ['🦄', '🌈', '🍓', '🌸', '🐱', '⭐', '🍭', '💖'];

const P = {
  p1: { color: '#FF88BB', name: 'P1' },
  p2: { color: '#88BBFF', name: 'P2' },
};

export class Memoria2P {
  constructor(canvas) {
    this.canvas = canvas;
    this._reset();
  }

  _reset() {
    const W = this.canvas.width, H = this.canvas.height;
    this.W = W; this.H = H;
    this.phase = 'playing';     // 'playing' | 'over'
    this.turn = Math.random() < 0.5 ? 'p1' : 'p2';
    this.score = { p1: 0, p2: 0 };
    this.picks = [];            // índices de cartas dadas vuelta este turno
    this.lock = 0;              // pausa mientras se muestran dos cartas
    this.lockAction = null;     // 'match' | 'fail'
    this.winner = null;
    this.t = 0;

    const deck = [...EMOJIS, ...EMOJIS];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    this.cards = deck.map(e => ({ emoji: e, st: 'down' }));   // 'down' | 'up' | 'gone'
  }

  // tablero 4×4 centrado
  _grid() {
    const { W, H } = this;
    const gap = Math.max(6, H * 0.018);
    const cell = Math.min(H * 0.19, W * 0.105);
    const gw = cell * 4 + gap * 3, gh = cell * 4 + gap * 3;
    return { cell, gap, x0: W / 2 - gw / 2, y0: H / 2 - gh / 2 + H * 0.03, gw, gh };
  }

  update(dt) {
    this.t += dt;
    if (this.lock > 0) {
      this.lock -= dt;
      if (this.lock <= 0) {
        const [a, b] = this.picks;
        if (this.lockAction === 'match') {
          this.cards[a].st = 'gone'; this.cards[b].st = 'gone';
          this.score[this.turn]++;
          if (this.cards.every(c => c.st === 'gone')) {
            this.phase = 'over';
            const s1 = this.score.p1, s2 = this.score.p2;
            this.winner = s1 === s2 ? 'empate' : (s1 > s2 ? 'p1' : 'p2');
          }
        } else {
          this.cards[a].st = 'down'; this.cards[b].st = 'down';
          this.turn = this.turn === 'p1' ? 'p2' : 'p1';
        }
        this.picks = [];
        this.lockAction = null;
      }
    }
  }

  render(ctx) {
    const { W, H } = this;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2A1040'); g.addColorStop(1, '#12123a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // marcadores y turno
    ctx.textBaseline = 'top';
    ctx.font = `900 ${H * 0.06}px system-ui`;
    ctx.textAlign = 'left';
    ctx.fillStyle = P.p1.color;
    ctx.fillText(`P1: ${this.score.p1} 🎀`, 16, 12);
    ctx.textAlign = 'right';
    ctx.fillStyle = P.p2.color;
    ctx.fillText(`🎀 ${this.score.p2} :P2`, W - 16, 12);

    if (this.phase === 'playing') {
      const cfg = P[this.turn];
      const pulse = 1 + Math.sin(this.t * 5) * 0.04;
      ctx.textAlign = 'center';
      ctx.fillStyle = cfg.color;
      ctx.font = `900 ${H * 0.055 * pulse}px system-ui`;
      ctx.fillText(`Turno de ${cfg.name}`, W / 2, 14);
    }

    // cartas
    const G = this._grid();
    ctx.textBaseline = 'middle';
    for (let i = 0; i < this.cards.length; i++) {
      const c = this.cards[i];
      if (c.st === 'gone') continue;
      const col = i % 4, row = Math.floor(i / 4);
      const x = G.x0 + col * (G.cell + G.gap), y = G.y0 + row * (G.cell + G.gap);
      if (c.st === 'down') {
        ctx.fillStyle = '#4A2D7A';
        ctx.beginPath(); ctx.roundRect(x, y, G.cell, G.cell, G.cell * 0.16); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(x, y, G.cell, G.cell, G.cell * 0.16); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.textAlign = 'center';
        ctx.font = `900 ${G.cell * 0.42}px system-ui`;
        ctx.fillText('?', x + G.cell / 2, y + G.cell / 2);
      } else {
        ctx.fillStyle = '#FDF3FF';
        ctx.beginPath(); ctx.roundRect(x, y, G.cell, G.cell, G.cell * 0.16); ctx.fill();
        ctx.strokeStyle = P[this.turn].color; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.roundRect(x, y, G.cell, G.cell, G.cell * 0.16); ctx.stroke();
        ctx.textAlign = 'center';
        ctx.font = `${G.cell * 0.6}px serif`;
        ctx.fillText(c.emoji, x + G.cell / 2, y + G.cell / 2 + G.cell * 0.04);
      }
    }

    if (this.lockAction === 'match') {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFD700'; ctx.font = `900 ${H * 0.08}px system-ui`;
      ctx.fillText('✨ ¡Pareja! ✨', W / 2, G.y0 - H * 0.02);
    }

    if (this.phase === 'over') {
      ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `900 ${H * 0.17}px system-ui`;
      if (this.winner === 'empate') { ctx.fillStyle = '#FFD700'; ctx.fillText('🤝 ¡Empate!', W / 2, H * 0.38); }
      else { ctx.fillStyle = P[this.winner].color; ctx.fillText(`¡Ganó ${P[this.winner].name}! 🎀`, W / 2, H * 0.38); }
      ctx.font = `bold ${H * 0.08}px system-ui`; ctx.fillStyle = '#ffffffaa';
      ctx.fillText(`${this.score.p1}  :  ${this.score.p2}`, W / 2, H * 0.56);
      ctx.font = `${H * 0.06}px system-ui`; ctx.fillStyle = '#ffffff66';
      ctx.fillText('Tocá para jugar de nuevo', W / 2, H * 0.72);
    }
  }

  pointerDown(cx, cy) {
    if (this.phase === 'over') { this._reset(); return; }
    if (this.lock > 0 || this.picks.length >= 2) return;

    const G = this._grid();
    const col = Math.floor((cx - G.x0) / (G.cell + G.gap));
    const row = Math.floor((cy - G.y0) / (G.cell + G.gap));
    if (col < 0 || col > 3 || row < 0 || row > 3) return;
    // que el toque caiga dentro de la carta y no en el espacio entre cartas
    if (cx - G.x0 - col * (G.cell + G.gap) > G.cell) return;
    if (cy - G.y0 - row * (G.cell + G.gap) > G.cell) return;

    const i = row * 4 + col;
    const c = this.cards[i];
    if (c.st !== 'down') return;

    c.st = 'up';
    this.picks.push(i);
    if (this.picks.length === 2) {
      const [a, b] = this.picks;
      const match = this.cards[a].emoji === this.cards[b].emoji;
      this.lockAction = match ? 'match' : 'fail';
      this.lock = match ? 0.7 : 1.2;
    }
  }
  pointerMove() {}
  pointerUp() {}
}
