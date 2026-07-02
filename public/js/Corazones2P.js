// ── Lluvia de Corazones (2P): atrapá lo bueno, esquivá las arañas ────────────
// Cada jugadora arrastra su canasta por la base de su mitad. Caen corazones
// (+1), estrellas (+2) y arañas (-2). Gana la que junte más puntos en GAME_TIME.

const GAME_TIME = 45;

const P = {
  p1: { color: '#FF88BB', sky: '#FFE8F2', name: 'P1' },
  p2: { color: '#88BBFF', sky: '#E8F2FF', name: 'P2' },
};

const DROPS = [
  { emoji: '💖', pts: 1,  w: 62 },
  { emoji: '🌟', pts: 2,  w: 14 },
  { emoji: '🕷️', pts: -2, w: 24 },
];

function pickDrop() {
  const total = DROPS.reduce((s, d) => s + d.w, 0);
  let r = Math.random() * total;
  for (const d of DROPS) { if ((r -= d.w) <= 0) return d; }
  return DROPS[0];
}

export class Corazones2P {
  constructor(canvas) {
    this.canvas = canvas;
    this._reset();
  }

  _reset() {
    const W = this.canvas.width, H = this.canvas.height;
    this.W = W; this.H = H;
    this.phase = 'countdown';   // 'countdown' | 'playing' | 'over'
    this.countdown = 3; this.countTimer = 0;
    this.timeLeft = GAME_TIME;
    this.t = 0;
    this.winner = null;
    this.floats = [];
    this.lanes = {
      p1: { x0: 0,     bx: W * 0.25, score: 0, items: [], spawnT: 0.6 },
      p2: { x0: W / 2, bx: W * 0.75, score: 0, items: [], spawnT: 0.6 },
    };
  }

  update(dt) {
    if (this.phase === 'countdown') {
      this.countTimer += dt;
      if (this.countTimer >= 1) {
        this.countdown--; this.countTimer = 0;
        if (this.countdown <= 0) this.phase = 'playing';
      }
      return;
    }
    if (this.phase === 'over') return;

    this.t += dt;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.phase = 'over';
      const a = this.lanes.p1.score, b = this.lanes.p2.score;
      this.winner = a === b ? 'empate' : (a > b ? 'p1' : 'p2');
      return;
    }

    // la lluvia se acelera con el tiempo
    const fallSpeed = this.H * (0.28 + 0.2 * (1 - this.timeLeft / GAME_TIME));
    const spawnEvery = 0.62 - 0.22 * (1 - this.timeLeft / GAME_TIME);

    for (const who of ['p1', 'p2']) {
      const L = this.lanes[who], laneW = this.W / 2;
      L.spawnT -= dt;
      if (L.spawnT <= 0 && this.timeLeft > 1.5) {
        L.spawnT = spawnEvery;
        const d = pickDrop();
        L.items.push({ x: L.x0 + laneW * 0.08 + Math.random() * laneW * 0.84, y: -20, drop: d, wob: Math.random() * 6 });
      }
      const basketY = this.H - this.H * 0.09;
      const bw = laneW * 0.24;
      for (const it of L.items) {
        it.y += fallSpeed * dt;
        it.x += Math.sin(this.t * 2 + it.wob) * 14 * dt;
        if (!it.done && it.y >= basketY - 8 && it.y <= basketY + this.H * 0.06 && Math.abs(it.x - L.bx) < bw / 2 + 8) {
          it.done = true;
          L.score = Math.max(0, L.score + it.drop.pts);
          this.floats.push({ x: it.x, y: basketY - 20, text: it.drop.pts > 0 ? `+${it.drop.pts}` : `${it.drop.pts}`, color: it.drop.pts > 0 ? P[who].color : '#E24C4C', life: 0 });
        }
      }
      L.items = L.items.filter(it => !it.done && it.y < this.H + 30);
    }

    for (const f of this.floats) { f.life += dt; f.y -= 45 * dt; }
    this.floats = this.floats.filter(f => f.life < 0.8);
  }

  render(ctx) {
    const { W, H } = this;
    for (const who of ['p1', 'p2']) this._renderLane(ctx, this.lanes[who], who);

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(W / 2 - 2, 0, 4, H);

    // reloj al centro
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.roundRect(W / 2 - 44, 8, 88, 34, 12); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `900 ${Math.max(16, H * 0.045)}px system-ui`;
    ctx.fillText(`⏱ ${Math.ceil(this.timeLeft)}`, W / 2, 26);

    for (const f of this.floats) {
      ctx.globalAlpha = Math.max(0, 1 - f.life / 0.8);
      ctx.fillStyle = f.color; ctx.font = `900 ${H * 0.05}px system-ui`;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    if (this.phase === 'countdown' && this.countdown > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFD700'; ctx.font = `900 ${H * 0.42}px system-ui`;
      ctx.fillText(this.countdown, W / 2, H / 2);
      ctx.font = `bold ${H * 0.05}px system-ui`; ctx.fillStyle = '#fff';
      ctx.fillText('Arrastrá tu canasta: 💖 +1 · 🌟 +2 · 🕷️ -2', W / 2, H * 0.78);
    }

    if (this.phase === 'over') {
      ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `900 ${H * 0.17}px system-ui`;
      if (this.winner === 'empate') { ctx.fillStyle = '#FFD700'; ctx.fillText('🤝 ¡Empate!', W / 2, H * 0.38); }
      else { ctx.fillStyle = P[this.winner].color; ctx.fillText(`¡Ganó ${P[this.winner].name}! 💖`, W / 2, H * 0.38); }
      ctx.font = `bold ${H * 0.08}px system-ui`; ctx.fillStyle = '#ffffffaa';
      ctx.fillText(`${this.lanes.p1.score}  :  ${this.lanes.p2.score}`, W / 2, H * 0.56);
      ctx.font = `${H * 0.06}px system-ui`; ctx.fillStyle = '#ffffff66';
      ctx.fillText('Tocá para jugar de nuevo', W / 2, H * 0.72);
    }
  }

  _renderLane(ctx, L, who) {
    const H = this.H, laneW = this.W / 2, cfg = P[who];
    ctx.save();
    ctx.beginPath(); ctx.rect(L.x0, 0, laneW, H); ctx.clip();

    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, cfg.sky); g.addColorStop(1, '#FFF6DE');
    ctx.fillStyle = g; ctx.fillRect(L.x0, 0, laneW, H);

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const itemR = Math.max(14, H * 0.038);
    ctx.font = `${itemR * 2}px serif`;
    for (const it of L.items) ctx.fillText(it.drop.emoji, it.x, it.y);

    // canasta
    const basketY = H - H * 0.09, bw = laneW * 0.24, bh = H * 0.07;
    ctx.fillStyle = cfg.color;
    ctx.beginPath(); ctx.roundRect(L.bx - bw / 2, basketY - bh / 2, bw, bh, bh * 0.4); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(L.bx - bw / 2, basketY - bh / 2, bw, bh, bh * 0.4); ctx.stroke();
    ctx.font = `${bh * 1.1}px serif`;
    ctx.fillText('🧺', L.bx, basketY - bh * 0.55);

    // puntaje
    ctx.fillStyle = cfg.color;
    ctx.font = `900 ${H * 0.06}px system-ui`;
    ctx.textBaseline = 'top';
    ctx.fillText(`${cfg.name}  💖 ${L.score}`, L.x0 + laneW / 2, 10);

    ctx.restore();
  }

  _moveBasket(cx, player) {
    const L = this.lanes[player], laneW = this.W / 2, bw = laneW * 0.24;
    L.bx = Math.max(L.x0 + bw / 2, Math.min(L.x0 + laneW - bw / 2, cx));
  }

  pointerDown(cx, cy, player) {
    if (this.phase === 'over') { this._reset(); return; }
    this._moveBasket(cx, player);
  }
  pointerMove(cx, cy, player) { this._moveBasket(cx, player); }
  pointerUp() {}
}
