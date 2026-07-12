const LEVELS = {
  facil:   { label: 'Fácil',   emoji: '😊', desc: '+15% por golpe',       inc: 0.15, multi: false, color: '#7ED957' },
  normal:  { label: 'Normal',  emoji: '🙂', desc: '+30% por golpe',       inc: 0.30, multi: false, color: '#FFC93C' },
  dificil: { label: 'Difícil', emoji: '🔥', desc: '+30% ¡y más pelotas!', inc: 0.30, multi: true,  color: '#FF6B6B' },
};
const LEVEL_KEYS = ['facil', 'normal', 'dificil'];

export class PongChibi {
  constructor(canvas) {
    this.canvas = canvas;
    this._reset();
  }

  _reset() {
    const W = this.canvas.width, H = this.canvas.height;
    this.W = W; this.H = H;
    this.PADDLE_W = Math.max(10, W * 0.018);
    this.PADDLE_H = H * 0.22;
    this.BALL_R   = Math.max(7, H * 0.025);
    this.P1_X     = 28;
    this.P2_X     = W - 28 - this.PADDLE_W;
    this.WIN_SCORE = 5;
    this.BASE_SPEED = W * 0.42;
    this.MAX_SPEED  = this.BASE_SPEED * 3;   // evita que atraviese las paletas
    this.MAX_BALLS  = 6;

    this.score     = { p1: 0, p2: 0 };
    this.level     = null;
    this.phase     = 'select';
    this.countdown = 3;
    this.countTimer = 0;
    this.goalTimer  = 0;

    this.p1 = { y: H / 2, vy: 0 };
    this.p2 = { y: H / 2, vy: 0 };
    this._p1Drag = null;
    this._p2Drag = null;

    this.balls = [];
  }

  _selectRects() {
    const { W, H } = this;
    const bw = Math.min(W * 0.52, H * 1.0);
    const bh = H * 0.15, gap = H * 0.045;
    const x = W / 2 - bw / 2;
    let y = H * 0.28;
    return LEVEL_KEYS.map(key => { const r = { key, x, y, w: bw, h: bh }; y += bh + gap; return r; });
  }

  _initBalls() {
    const W = this.W, H = this.H;
    const angle = (Math.random() * 50 - 25) * (Math.PI / 180);
    const dir   = Math.random() < 0.5 ? 1 : -1;
    const speed = this.BASE_SPEED;
    this.balls = [{
      x: W / 2, y: H / 2,
      vx: Math.cos(angle) * speed * dir,
      vy: Math.sin(angle) * speed,
    }];
  }

  update(dt) {
    const { W, H, PADDLE_W, PADDLE_H, BALL_R, P1_X, P2_X } = this;

    if (this.phase === 'select') return;
    if (this.phase === 'countdown') {
      this.countTimer += dt;
      if (this.countTimer >= 1) {
        this.countdown--;
        this.countTimer = 0;
        if (this.countdown <= 0) this.phase = 'playing';
      }
      return;
    }
    if (this.phase === 'goal') {
      this.goalTimer -= dt;
      if (this.goalTimer <= 0) { this._initBalls(); this.phase = 'countdown'; this.countdown = 2; this.countTimer = 0; }
      return;
    }
    if (this.phase === 'over') return;

    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.y - BALL_R < 0)  { b.y = BALL_R;      b.vy =  Math.abs(b.vy); }
      if (b.y + BALL_R > H)  { b.y = H - BALL_R;  b.vy = -Math.abs(b.vy); }

      // P1 paddle collision
      if (b.vx < 0 &&
          b.x - BALL_R < P1_X + PADDLE_W && b.x > P1_X &&
          b.y > this.p1.y - PADDLE_H / 2 - BALL_R &&
          b.y < this.p1.y + PADDLE_H / 2 + BALL_R) {
        this._bounce(b, this.p1, 1);
      }
      // P2 paddle collision
      if (b.vx > 0 &&
          b.x + BALL_R > P2_X && b.x < P2_X + PADDLE_W &&
          b.y > this.p2.y - PADDLE_H / 2 - BALL_R &&
          b.y < this.p2.y + PADDLE_H / 2 + BALL_R) {
        this._bounce(b, this.p2, -1);
      }

      if (b.x < 0)      { this.score.p2++; this.balls.splice(i, 1); this._afterScore(); }
      else if (b.x > W) { this.score.p1++; this.balls.splice(i, 1); this._afterScore(); }
      if (this.phase !== 'playing') return;
    }
  }

  // dir: 1 = rebote hacia la derecha (paleta P1), -1 = hacia la izquierda (P2)
  _bounce(b, pad, dir) {
    const { PADDLE_W, PADDLE_H, BALL_R, P1_X, P2_X } = this;
    const lvl = LEVELS[this.level] || LEVELS.normal;
    b.x = dir > 0 ? P1_X + PADDLE_W + BALL_R : P2_X - BALL_R;
    const speed = Math.min(Math.hypot(b.vx, b.vy) + this.BASE_SPEED * lvl.inc, this.MAX_SPEED);
    const rel   = (b.y - pad.y) / (PADDLE_H / 2);
    const ang   = rel * Math.PI * 0.36;
    b.vx = dir * Math.cos(ang) * speed;
    b.vy = Math.sin(ang) * speed + pad.vy * 0.3;

    if (lvl.multi && this.balls.length < this.MAX_BALLS) {
      let angC = ang + (Math.random() < 0.5 ? -0.5 : 0.5);
      angC = Math.max(-1.1, Math.min(1.1, angC));
      this.balls.push({
        x: b.x, y: b.y,
        vx: dir * Math.cos(angC) * speed,
        vy: Math.sin(angC) * speed,
      });
    }
  }

  _afterScore() {
    if (this.score.p1 >= this.WIN_SCORE || this.score.p2 >= this.WIN_SCORE) {
      this.phase = 'over';
    } else if (this.balls.length === 0) {
      this.phase = 'goal';
      this.goalTimer = 1.5;
    }
  }

  render(ctx) {
    const { W, H, PADDLE_W, PADDLE_H, BALL_R, P1_X, P2_X } = this;

    ctx.fillStyle = '#06061a';
    ctx.fillRect(0, 0, W, H);

    // Center dashes
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.setLineDash([8, 10]);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
    ctx.setLineDash([]);

    // Center circle
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(W / 2, H / 2, H * 0.13, 0, Math.PI * 2); ctx.stroke();

    // Scores (large, faded)
    ctx.font = `900 ${H * 0.18}px system-ui, sans-serif`;
    ctx.textBaseline = 'top'; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillText(this.score.p1, W * 0.25, H * 0.05);
    ctx.fillText(this.score.p2, W * 0.75, H * 0.05);

    // P1 paddle
    const p1top = this.p1.y - PADDLE_H / 2;
    const g1 = ctx.createLinearGradient(P1_X, 0, P1_X + PADDLE_W, 0);
    g1.addColorStop(0, '#FF4488'); g1.addColorStop(1, '#FF88BB');
    ctx.fillStyle = g1;
    ctx.beginPath(); ctx.roundRect(P1_X, p1top, PADDLE_W, PADDLE_H, 5); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(P1_X, p1top, PADDLE_W, PADDLE_H, 5); ctx.stroke();

    // P2 paddle
    const p2top = this.p2.y - PADDLE_H / 2;
    const g2 = ctx.createLinearGradient(P2_X, 0, P2_X + PADDLE_W, 0);
    g2.addColorStop(0, '#88BBFF'); g2.addColorStop(1, '#4488FF');
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.roundRect(P2_X, p2top, PADDLE_W, PADDLE_H, 5); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(P2_X, p2top, PADDLE_W, PADDLE_H, 5); ctx.stroke();

    // Balls (blink during goal pause)
    const showBall = this.phase !== 'goal' || (Math.floor(Date.now() / 200) % 2 === 0);
    if (showBall) {
      for (const b of this.balls) {
        const bg = ctx.createRadialGradient(
          b.x - BALL_R * 0.3, b.y - BALL_R * 0.3, 1,
          b.x, b.y, BALL_R);
        bg.addColorStop(0, '#ffffff'); bg.addColorStop(1, '#c0d8ff');
        ctx.fillStyle = bg;
        ctx.beginPath(); ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Player labels
    ctx.font = `bold ${Math.max(12, H * 0.045)}px system-ui`;
    ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    ctx.fillStyle = '#FF88BB'; ctx.fillText('P1', P1_X + PADDLE_W + 6, 10);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#88BBFF'; ctx.fillText('P2', P2_X - 6, 10);

    // Level chip
    if (this.level) {
      const lvl = LEVELS[this.level];
      ctx.font = `bold ${Math.max(11, H * 0.038)}px system-ui`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillText(`${lvl.emoji} ${lvl.label}`, W / 2, 10);
    }

    // Level select overlay
    if (this.phase === 'select') {
      ctx.fillStyle = 'rgba(0,0,0,0.68)'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `900 ${H * 0.085}px system-ui`;
      ctx.fillStyle = '#FFD700';
      ctx.fillText('🏓 Elegí el nivel', W / 2, H * 0.16);
      for (const r of this._selectRects()) {
        const lvl = LEVELS[r.key];
        ctx.fillStyle = lvl.color;
        ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, r.h * 0.3); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, r.h * 0.3); ctx.stroke();
        ctx.fillStyle = '#3a2410';
        ctx.font = `900 ${r.h * 0.38}px system-ui`;
        ctx.fillText(`${lvl.emoji} ${lvl.label}`, r.x + r.w / 2, r.y + r.h * 0.36);
        ctx.font = `bold ${r.h * 0.22}px system-ui`;
        ctx.fillStyle = 'rgba(58,36,16,0.75)';
        ctx.fillText(lvl.desc, r.x + r.w / 2, r.y + r.h * 0.74);
      }
    }

    // Countdown overlay
    if (this.phase === 'countdown' && this.countdown > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `900 ${H * 0.42}px system-ui`;
      ctx.fillStyle = '#FFD700';
      ctx.fillText(this.countdown, W / 2, H / 2);
    }

    // Goal flash
    if (this.phase === 'goal') {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `900 ${H * 0.18}px system-ui`;
      ctx.fillStyle = '#FFD700';
      ctx.fillText('¡GOL!', W / 2, H / 2);
    }

    // Game-over overlay
    if (this.phase === 'over') {
      ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const winner = this.score.p1 >= this.WIN_SCORE ? 'P1' : 'P2';
      ctx.font = `900 ${H * 0.19}px system-ui`;
      ctx.fillStyle = winner === 'P1' ? '#FF88BB' : '#88BBFF';
      ctx.fillText(`¡Ganó ${winner}!`, W / 2, H * 0.38);
      ctx.font = `bold ${H * 0.09}px system-ui`;
      ctx.fillStyle = '#ffffffaa';
      ctx.fillText(`${this.score.p1}  :  ${this.score.p2}`, W / 2, H * 0.57);
      ctx.font = `${H * 0.07}px system-ui`;
      ctx.fillStyle = '#ffffff55';
      ctx.fillText('Tocá para jugar de nuevo', W / 2, H * 0.73);
    }
  }

  pointerDown(cx, cy, player) {
    if (this.phase === 'over') { this._reset(); return; }
    if (this.phase === 'select') {
      for (const r of this._selectRects()) {
        if (cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) {
          this.level = r.key;
          this._initBalls();
          this.phase = 'countdown';
          this.countdown = 3;
          this.countTimer = 0;
          return;
        }
      }
      return;
    }
    if (player === 'p1') this._p1Drag = { lastY: cy };
    else                  this._p2Drag = { lastY: cy };
  }

  pointerMove(cx, cy, player) {
    const { H, PADDLE_H } = this;
    const half = PADDLE_H / 2;
    if (player === 'p1' && this._p1Drag) {
      const dy = cy - this._p1Drag.lastY;
      this.p1.vy = dy * 60;
      this.p1.y  = Math.max(half, Math.min(H - half, this.p1.y + dy));
      this._p1Drag.lastY = cy;
    } else if (player === 'p2' && this._p2Drag) {
      const dy = cy - this._p2Drag.lastY;
      this.p2.vy = dy * 60;
      this.p2.y  = Math.max(half, Math.min(H - half, this.p2.y + dy));
      this._p2Drag.lastY = cy;
    }
  }

  pointerUp(player) {
    if (player === 'p1') { this._p1Drag = null; this.p1.vy = 0; }
    else                  { this._p2Drag = null; this.p2.vy = 0; }
  }

  // ── Online sync: host broadcasts this every frame, guest applies it ──────
  getNetState() {
    return {
      W: this.W, H: this.H,
      PADDLE_W: this.PADDLE_W, PADDLE_H: this.PADDLE_H, BALL_R: this.BALL_R,
      P1_X: this.P1_X, P2_X: this.P2_X,
      score: this.score, phase: this.phase, level: this.level,
      countdown: this.countdown, countTimer: this.countTimer, goalTimer: this.goalTimer,
      p1: this.p1, p2: this.p2, balls: this.balls,
    };
  }

  setNetState(s) {
    this.W = s.W; this.H = s.H;
    this.PADDLE_W = s.PADDLE_W; this.PADDLE_H = s.PADDLE_H; this.BALL_R = s.BALL_R;
    this.P1_X = s.P1_X; this.P2_X = s.P2_X;
    this.score = s.score; this.phase = s.phase; this.level = s.level;
    this.countdown = s.countdown; this.countTimer = s.countTimer; this.goalTimer = s.goalTimer;
    this.p1 = s.p1; this.p2 = s.p2; this.balls = s.balls || [];
  }
}
