export class Globos2P {
  constructor(canvas) {
    this.canvas = canvas;
    this._reset();
  }

  _reset() {
    const W = this.canvas.width, H = this.canvas.height;
    this.W = W; this.H = H;
    this.score     = { p1: 0, p2: 0 };
    this.timeLeft  = 60;
    this.phase     = 'playing';
    this.balloons  = [];
    this.particles = [];
    this.spawnTimer = 0.05;
    // Pre-fill with a dense wave
    for (let i = 0; i < 8; i++) this._spawnBatch();
  }

  _spawnBatch() {
    const { W, H } = this;
    // Spawn 4 balloons per player per batch
    for (const player of ['p1', 'p2']) {
      const xBase  = player === 'p1' ? W * 0.04 : W * 0.54;
      for (let i = 0; i < 4; i++) {
        this.balloons.push({
          x: xBase + Math.random() * W * 0.40,
          y: H + 20 + Math.random() * H * 0.6,
          vy: -(60 + Math.random() * 60),
          r:  14 + Math.random() * 12,
          player,
          t:   Math.random() * Math.PI * 2,
          popped: false,
          popT:   0,
          alpha:  1,
        });
      }
    }
  }

  update(dt) {
    if (this.phase !== 'playing') return;

    this.timeLeft -= dt;
    if (this.timeLeft <= 0) { this.timeLeft = 0; this.phase = 'over'; return; }

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this._spawnBatch();
      this.spawnTimer = 0.18 + Math.random() * 0.12;
    }

    for (let i = this.balloons.length - 1; i >= 0; i--) {
      const b = this.balloons[i];
      b.t += dt;
      b.x += Math.sin(b.t * 0.9) * 20 * dt;
      if (!b.popped) {
        b.y += b.vy * dt;
        if (b.y + b.r < -20) this.balloons.splice(i, 1);
      } else {
        b.popT += dt;
        b.alpha = Math.max(0, 1 - b.popT / 0.3);
        if (b.alpha <= 0) this.balloons.splice(i, 1);
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 120 * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  _pop(balloon, player) {
    balloon.popped = true;
    if (balloon.player === player) this.score[player]++;
    const colors = balloon.player === 'p1'
      ? ['#FF4488', '#FF88BB', '#FFAACC']
      : ['#4488FF', '#88BBFF', '#AACCFF'];
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 80 + Math.random() * 130;
      this.particles.push({
        x: balloon.x, y: balloon.y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60,
        life: 0.4 + Math.random() * 0.3,
        r: 3 + Math.random() * 4,
        clr: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  render(ctx) {
    const { W, H } = this;

    // Background
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#120830');
    sky.addColorStop(1, '#0a1840');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Stars
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    for (let i = 0; i < 40; i++) {
      const sx = ((i * 137.5) % W);
      const sy = ((i * 91.3) % (H * 0.7));
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }

    // Center divider
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.setLineDash([8, 10]);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
    ctx.setLineDash([]);

    // Balloons
    for (const b of this.balloons) {
      ctx.globalAlpha = b.alpha;
      const p1 = b.player === 'p1';
      const c1 = p1 ? '#FF88BB' : '#88BBFF';
      const c2 = p1 ? '#FF3366' : '#3366FF';

      if (!b.popped) {
        const bg = ctx.createRadialGradient(
          b.x - b.r * 0.3, b.y - b.r * 0.4, b.r * 0.08,
          b.x, b.y, b.r);
        bg.addColorStop(0, c1); bg.addColorStop(1, c2);
        ctx.fillStyle = bg;
        ctx.beginPath(); ctx.ellipse(b.x, b.y, b.r, b.r * 1.2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.32)';
        ctx.beginPath(); ctx.ellipse(b.x - b.r * 0.28, b.y - b.r * 0.38, b.r * 0.26, b.r * 0.18, -0.4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y + b.r * 1.2);
        ctx.quadraticCurveTo(b.x + b.r * 0.35, b.y + b.r * 2, b.x, b.y + b.r * 3);
        ctx.stroke();
      } else {
        const scale = 1 + b.popT * 4;
        ctx.strokeStyle = c2; ctx.lineWidth = 3;
        ctx.globalAlpha = b.alpha;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r * scale, 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    // Particles
    for (const p of this.particles) {
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.fillStyle = p.clr;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Scores
    const fs = Math.max(28, H * 0.14);
    ctx.font = `900 ${fs}px system-ui, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';  ctx.fillStyle = '#FF88BB'; ctx.fillText(this.score.p1, 12, 42);
    ctx.textAlign = 'right'; ctx.fillStyle = '#88BBFF'; ctx.fillText(this.score.p2, W - 12, 42);

    // Timer
    ctx.font = `bold ${Math.max(18, H * 0.08)}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const t = Math.ceil(this.timeLeft);
    ctx.fillStyle = t <= 10 ? '#FF5555' : 'rgba(255,255,255,0.65)';
    ctx.fillText(t, W / 2, 10);

    // Player labels
    ctx.font = `bold ${Math.max(12, H * 0.048)}px system-ui`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';  ctx.fillStyle = '#FF88BB'; ctx.fillText('P1', 12, 10);
    ctx.textAlign = 'right'; ctx.fillStyle = '#88BBFF'; ctx.fillText('P2', W - 12, 10);

    if (this.phase === 'over') {
      ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      let msg, clr;
      if      (this.score.p1 > this.score.p2) { msg = '¡Ganó P1!'; clr = '#FF88BB'; }
      else if (this.score.p2 > this.score.p1) { msg = '¡Ganó P2!'; clr = '#88BBFF'; }
      else                                      { msg = '¡Empate!';  clr = '#FFD700'; }
      ctx.font = `900 ${H * 0.18}px system-ui`; ctx.fillStyle = clr;
      ctx.fillText(msg, W / 2, H * 0.38);
      ctx.font = `bold ${H * 0.09}px system-ui`; ctx.fillStyle = '#ffffffaa';
      ctx.fillText(`${this.score.p1}  :  ${this.score.p2}`, W / 2, H * 0.56);
      ctx.font = `${H * 0.07}px system-ui`; ctx.fillStyle = '#ffffff55';
      ctx.fillText('Tocá para jugar de nuevo', W / 2, H * 0.71);
    }
  }

  pointerDown(cx, cy, player) {
    if (this.phase === 'over') { this._reset(); return; }
    for (const b of this.balloons) {
      if (b.popped) continue;
      if (Math.hypot(cx - b.x, cy - b.y) < b.r * 1.5) {
        this._pop(b, player);
        return;
      }
    }
  }

  pointerMove() {}
  pointerUp() {}
}
