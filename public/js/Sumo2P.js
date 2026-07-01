export class Sumo2P {
  constructor(canvas) {
    this.canvas = canvas;
    this._init();
  }

  _init() {
    this.wins = { p1: 0, p2: 0 };
    this.WIN_ROUNDS = 3;
    this._startRound();
  }

  _startRound() {
    const W = this.canvas.width, H = this.canvas.height;
    this.W = W; this.H = H;
    const cx = W / 2, cy = H / 2;
    const ringR = Math.min(W * 0.36, H * 0.42);
    this.ring = { cx, cy, r: ringR };
    const off = ringR * 0.36;
    this.p1 = { x: cx - off, y: cy, vx: 0, vy: 0, r: Math.max(20, H * 0.065) };
    this.p2 = { x: cx + off, y: cy, vx: 0, vy: 0, r: Math.max(20, H * 0.065) };
    this.phase      = 'countdown';
    this.countdown  = 3;
    this.countTimer = 0;
    this.flashMsg   = '';
    this.flashTimer = 0;
    this._p1Drag    = null;
    this._p2Drag    = null;
  }

  update(dt) {
    if (this.phase === 'countdown') {
      this.countTimer += dt;
      if (this.countTimer >= 1) {
        this.countdown--;
        this.countTimer = 0;
        if (this.countdown <= 0) this.phase = 'playing';
      }
      return;
    }
    if (this.phase === 'point' || this.phase === 'over') {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0 && this.phase === 'point') this._startRound();
      return;
    }

    const FRIC = Math.pow(0.02, dt);
    for (const p of [this.p1, this.p2]) {
      p.x  += p.vx * dt;
      p.y  += p.vy * dt;
      p.vx *= FRIC;
      p.vy *= FRIC;
    }

    // Circle–circle collision
    const dx   = this.p2.x - this.p1.x;
    const dy   = this.p2.y - this.p1.y;
    const dist = Math.hypot(dx, dy);
    const minD = this.p1.r + this.p2.r;
    if (dist < minD && dist > 0.01) {
      const nx = dx / dist, ny = dy / dist;
      const ov = (minD - dist) / 2;
      this.p1.x -= nx * ov; this.p1.y -= ny * ov;
      this.p2.x += nx * ov; this.p2.y += ny * ov;
      const rv = (this.p2.vx - this.p1.vx) * nx + (this.p2.vy - this.p1.vy) * ny;
      if (rv < 0) {
        const imp = rv * 0.88;
        this.p1.vx += imp * nx; this.p1.vy += imp * ny;
        this.p2.vx -= imp * nx; this.p2.vy -= imp * ny;
      }
    }

    // Ring out check
    const { cx, cy, r } = this.ring;
    for (const [p, who] of [[this.p1, 'p1'], [this.p2, 'p2']]) {
      if (Math.hypot(p.x - cx, p.y - cy) > r - p.r) {
        const winner = who === 'p1' ? 'p2' : 'p1';
        this.wins[winner]++;
        this.flashMsg = `¡OUT!\n¡Punto para P${winner === 'p1' ? 1 : 2}!`;
        this.flashTimer = 2.2;
        this.phase = this.wins[winner] >= this.WIN_ROUNDS ? 'over' : 'point';
        return;
      }
    }
  }

  _drawChar(ctx, p, isP1) {
    const clrA = isP1 ? '#FF88BB' : '#88BBFF';
    const clrB = isP1 ? '#FF3366' : '#3366DD';
    const bg = ctx.createRadialGradient(p.x - p.r * 0.2, p.y - p.r * 0.25, p.r * 0.05, p.x, p.y, p.r);
    bg.addColorStop(0, clrA); bg.addColorStop(1, clrB);
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();

    // Eyes
    const ey = p.y - p.r * 0.14;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(p.x - p.r * 0.27, ey, p.r * 0.17, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(p.x + p.r * 0.27, ey, p.r * 0.17, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(p.x - p.r * 0.27, ey + p.r * 0.04, p.r * 0.09, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(p.x + p.r * 0.27, ey + p.r * 0.04, p.r * 0.09, 0, Math.PI * 2); ctx.fill();

    // Blush
    ctx.fillStyle = isP1 ? 'rgba(255,80,130,0.35)' : 'rgba(80,130,255,0.35)';
    ctx.beginPath(); ctx.ellipse(p.x - p.r * 0.43, ey + p.r * 0.22, p.r * 0.16, p.r * 0.10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(p.x + p.r * 0.43, ey + p.r * 0.22, p.r * 0.16, p.r * 0.10, 0, 0, Math.PI * 2); ctx.fill();

    // Label
    ctx.font = `bold ${p.r * 0.55}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(isP1 ? 'P1' : 'P2', p.x, p.y + p.r * 0.44);
  }

  render(ctx) {
    const { W, H } = this;
    const { cx, cy, r } = this.ring;

    // Background
    ctx.fillStyle = '#1a0828';
    ctx.fillRect(0, 0, W, H);

    // Ring shadow
    const shadow = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 1.4);
    shadow.addColorStop(0, 'rgba(0,0,0,0)'); shadow.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = shadow;
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.42, 0, Math.PI * 2); ctx.fill();

    // Ring floor
    const floor = ctx.createRadialGradient(cx - r * 0.18, cy - r * 0.18, r * 0.1, cx, cy, r);
    floor.addColorStop(0, '#e8d8a0'); floor.addColorStop(1, '#c0a055');
    ctx.fillStyle = floor;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();

    // Decorative lines on ring surface
    ctx.strokeStyle = 'rgba(100,70,20,0.3)'; ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath(); ctx.arc(cx, cy, r * (i / 4), 0, Math.PI * 2); ctx.stroke();
    }

    // Ring border
    ctx.strokeStyle = '#5a3a10'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r - 5, 0, Math.PI * 2); ctx.stroke();

    // Center mark
    ctx.strokeStyle = 'rgba(100,70,20,0.5)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(cx - r * 0.1, cy); ctx.lineTo(cx + r * 0.1, cy); ctx.stroke();

    // Characters
    this._drawChar(ctx, this.p1, true);
    this._drawChar(ctx, this.p2, false);

    // Win dots
    const DOT_R = Math.max(7, H * 0.025);
    for (let i = 0; i < this.WIN_ROUNDS; i++) {
      ctx.beginPath(); ctx.arc(16 + i * (DOT_R * 2.4), 16, DOT_R, 0, Math.PI * 2);
      ctx.fillStyle = i < this.wins.p1 ? '#FF88BB' : 'rgba(255,136,187,0.22)'; ctx.fill();
    }
    for (let i = 0; i < this.WIN_ROUNDS; i++) {
      ctx.beginPath(); ctx.arc(W - 16 - i * (DOT_R * 2.4), 16, DOT_R, 0, Math.PI * 2);
      ctx.fillStyle = i < this.wins.p2 ? '#88BBFF' : 'rgba(136,187,255,0.22)'; ctx.fill();
    }

    // Countdown
    if (this.phase === 'countdown' && this.countdown > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.52)'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `900 ${H * 0.42}px system-ui`; ctx.fillStyle = '#FFD700';
      ctx.fillText(this.countdown, W / 2, H / 2);
    }

    // Flash message
    if ((this.phase === 'point' || this.phase === 'over') && this.flashTimer > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const lines = this.flashMsg.split('\n');
      ctx.font = `900 ${H * 0.14}px system-ui`; ctx.fillStyle = '#FFD700';
      ctx.fillText(lines[0], W / 2, H / 2 - H * 0.08);
      if (lines[1]) {
        ctx.font = `bold ${H * 0.09}px system-ui`; ctx.fillStyle = '#ffffffcc';
        ctx.fillText(lines[1], W / 2, H / 2 + H * 0.06);
      }
      if (this.phase === 'over') {
        ctx.font = `${H * 0.07}px system-ui`; ctx.fillStyle = '#ffffff55';
        ctx.fillText('Tocá para jugar de nuevo', W / 2, H * 0.80);
      }
    }
  }

  pointerDown(cx, cy, player) {
    if (this.phase === 'over')  { this._init();   return; }
    if (this.phase !== 'playing') return;
    if (player === 'p1') this._p1Drag = { lx: cx, ly: cy };
    else                  this._p2Drag = { lx: cx, ly: cy };
  }

  pointerMove(cx, cy, player) {
    if (this.phase !== 'playing') return;
    if (player === 'p1' && this._p1Drag) {
      const dx = cx - this._p1Drag.lx, dy = cy - this._p1Drag.ly;
      this.p1.vx += dx * 6; this.p1.vy += dy * 6;
      const s = Math.hypot(this.p1.vx, this.p1.vy);
      if (s > 720) { this.p1.vx = this.p1.vx / s * 720; this.p1.vy = this.p1.vy / s * 720; }
      this._p1Drag.lx = cx; this._p1Drag.ly = cy;
    } else if (player === 'p2' && this._p2Drag) {
      const dx = cx - this._p2Drag.lx, dy = cy - this._p2Drag.ly;
      this.p2.vx += dx * 6; this.p2.vy += dy * 6;
      const s = Math.hypot(this.p2.vx, this.p2.vy);
      if (s > 720) { this.p2.vx = this.p2.vx / s * 720; this.p2.vy = this.p2.vy / s * 720; }
      this._p2Drag.lx = cx; this._p2Drag.ly = cy;
    }
  }

  pointerUp(player) {
    if (player === 'p1') this._p1Drag = null;
    else                  this._p2Drag = null;
  }
}
