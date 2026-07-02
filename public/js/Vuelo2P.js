// ── Mariposas al Vuelo (2P): carrera flappy en pantalla dividida ─────────────
// Cada jugadora tiene su mitad: tocá para aletear hacia arriba y pasá por los
// huecos entre las flores. Chocar te aturde un momento. Primera en cruzar
// GOAL_GATES portones gana.

const GOAL_GATES = 10;

const P = {
  p1: { color: '#FF88BB', sky: '#FFE8F2', name: 'P1' },
  p2: { color: '#88BBFF', sky: '#E8F2FF', name: 'P2' },
};

export class Vuelo2P {
  constructor(canvas) {
    this.canvas = canvas;
    this._reset();
  }

  _reset() {
    const W = this.canvas.width, H = this.canvas.height;
    this.W = W; this.H = H;
    this.phase = 'countdown';   // 'countdown' | 'playing' | 'over'
    this.countdown = 3; this.countTimer = 0;
    this.winner = null;
    this.t = 0;
    this.lanes = {
      p1: this._newLane(0),
      p2: this._newLane(W / 2),
    };
  }

  _newLane(x0) {
    return {
      x0,                       // borde izquierdo de la mitad
      y: this.H / 2, vy: 0,
      gates: 0,
      stun: 0,                  // segundos de invulnerabilidad tras chocar
      obs: [],                  // { x (relativo a la mitad), gapY, passed }
      spawnT: 1.2,
      clouds: [0, 1, 2].map(() => ({ x: Math.random(), y: Math.random() * 0.5, s: 0.6 + Math.random() * 0.7 })),
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
    for (const who of ['p1', 'p2']) this._updateLane(this.lanes[who], dt, who);
  }

  _updateLane(L, dt, who) {
    const H = this.H, laneW = this.W / 2;
    const speed = laneW * 0.38;
    const birdX = laneW * 0.24;
    const r = Math.max(10, H * 0.032);

    // física de la mariposa
    L.vy += H * 1.5 * dt;
    L.y  += L.vy * dt;
    if (L.stun > 0) L.stun -= dt;

    // techo y piso: rebote suave sin castigo
    if (L.y < r)      { L.y = r; L.vy = 0; }
    if (L.y > H - r)  { L.y = H - r; L.vy = -H * 0.3; }

    // obstáculos
    L.spawnT -= dt;
    if (L.spawnT <= 0) {
      L.spawnT = 2.1;
      const gap = H * 0.34;
      L.obs.push({ x: laneW + 40, gapY: gap / 2 + H * 0.08 + Math.random() * (H - gap - H * 0.16), passed: false });
    }
    for (const o of L.obs) {
      o.x -= speed * dt;
      const gap = H * 0.34, pw = laneW * 0.055;
      // pasó el portón
      if (!o.passed && o.x + pw / 2 < birdX - r) {
        o.passed = true;
        L.gates++;
        if (L.gates >= GOAL_GATES) { this.phase = 'over'; this.winner = who; }
      }
      // choque (sólo si no está aturdida)
      if (L.stun <= 0 && Math.abs(o.x - birdX) < pw / 2 + r * 0.8) {
        if (L.y - r * 0.7 < o.gapY - gap / 2 || L.y + r * 0.7 > o.gapY + gap / 2) {
          L.stun = 1.2;
          L.y = this.H / 2; L.vy = 0;
        }
      }
    }
    L.obs = L.obs.filter(o => o.x > -laneW * 0.1);

    for (const c of L.clouds) { c.x -= dt * 0.03; if (c.x < -0.2) { c.x = 1.1; c.y = Math.random() * 0.5; } }
  }

  render(ctx) {
    const { W, H } = this;
    for (const who of ['p1', 'p2']) this._renderLane(ctx, this.lanes[who], who);

    // divisor central
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(W / 2 - 2, 0, 4, H);

    if (this.phase === 'countdown' && this.countdown > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFD700'; ctx.font = `900 ${H * 0.42}px system-ui`;
      ctx.fillText(this.countdown, W / 2, H / 2);
      ctx.font = `bold ${H * 0.05}px system-ui`; ctx.fillStyle = '#fff';
      ctx.fillText(`Tocá para aletear — primera en pasar ${GOAL_GATES} flores gana`, W / 2, H * 0.78);
    }

    if (this.phase === 'over') {
      ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `900 ${H * 0.19}px system-ui`;
      ctx.fillStyle = P[this.winner].color;
      ctx.fillText(`¡Ganó ${P[this.winner].name}! 🦋`, W / 2, H * 0.4);
      ctx.font = `${H * 0.07}px system-ui`; ctx.fillStyle = '#ffffff88';
      ctx.fillText('Tocá para jugar de nuevo', W / 2, H * 0.66);
    }
  }

  _renderLane(ctx, L, who) {
    const H = this.H, laneW = this.W / 2, x0 = L.x0;
    const birdX = x0 + laneW * 0.24;
    const r = Math.max(10, H * 0.032);
    const cfg = P[who];

    ctx.save();
    ctx.beginPath(); ctx.rect(x0, 0, laneW, H); ctx.clip();

    // cielo pastel
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, cfg.sky); g.addColorStop(1, '#CDEBC4');
    ctx.fillStyle = g; ctx.fillRect(x0, 0, laneW, H);

    // nubes
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (const c of L.clouds) {
      const cx = x0 + c.x * laneW, cy = c.y * H + H * 0.08, cs = c.s * H * 0.05;
      ctx.beginPath();
      ctx.arc(cx, cy, cs, 0, Math.PI * 2);
      ctx.arc(cx + cs, cy + cs * 0.3, cs * 0.8, 0, Math.PI * 2);
      ctx.arc(cx - cs, cy + cs * 0.3, cs * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // portones de flores (tallos arriba y abajo con un hueco)
    const gap = H * 0.34, pw = laneW * 0.055;
    for (const o of L.obs) {
      const ox = x0 + o.x;
      ctx.fillStyle = '#6BBF59';
      ctx.beginPath(); ctx.roundRect(ox - pw / 2, 0, pw, o.gapY - gap / 2, pw * 0.3); ctx.fill();
      ctx.beginPath(); ctx.roundRect(ox - pw / 2, o.gapY + gap / 2, pw, H - o.gapY - gap / 2, pw * 0.3); ctx.fill();
      ctx.font = `${pw * 1.3}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🌷', ox, o.gapY - gap / 2 - pw * 0.1);
      ctx.fillText('🌻', ox, o.gapY + gap / 2 + pw * 0.1);
    }

    // mariposa (parpadea si está aturdida)
    if (L.stun <= 0 || Math.floor(this.t * 10) % 2 === 0) {
      ctx.fillStyle = `${cfg.color}55`;
      ctx.beginPath(); ctx.arc(birdX, L.y, r * 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.font = `${r * 2.4}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🦋', birdX, L.y);
    }

    // progreso
    ctx.fillStyle = cfg.color;
    ctx.font = `900 ${H * 0.06}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(`${cfg.name}  🌷 ${L.gates}/${GOAL_GATES}`, x0 + laneW / 2, 10);

    ctx.restore();
  }

  pointerDown(cx, cy, player) {
    if (this.phase === 'over') { this._reset(); return; }
    if (this.phase !== 'playing') return;
    const L = this.lanes[player];
    L.vy = -this.H * 0.62;
  }
  pointerMove() {}
  pointerUp() {}
}
