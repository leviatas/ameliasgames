// ── Mob Control ───────────────────────────────────────────────────────────────
// Tocá para disparar. Las puertas ×N multiplican tus balas.
// 2 jugadores: cada toque dispara (multitouch).

const COLS      = 3;
const SHOT_SPD  = 520;
const SHOT_R    = 5;
const GATE_H    = 52;
const GATE_SPD  = 42;
const MAX_SHOTS = 300;

export class Mob {
  constructor(canvas) {
    this.canvas = canvas;
    this._stars = Array.from({ length: 60 }, () => ({
      x: Math.random(), y: Math.random(),
      r: 0.4 + Math.random() * 1.8, s: 0.12 + Math.random() * 0.7
    }));
    this._init();
    this._bindInput();
  }

  _sc() {
    const { width: W, height: H } = this.canvas;
    return Math.max(0.55, Math.min(1.3, Math.min(W, H) / 680));
  }

  _layout() {
    const { width: W, height: H } = this.canvas;
    const s    = this._sc();
    const colW = W / COLS;
    const shooterY = H - 72 * s;
    return { W, H, s, colW, shooterY };
  }

  _init() {
    const L = this._layout();
    this.L = L;
    this.state = 'playing';
    this.wave  = 1;
    this.score = 0;
    this.t     = 0;
    this.kills = 0;
    this.killsNeeded = 8;
    this.shots   = [];
    this.enemies = [];
    this.gates   = [];
    this.sparks  = [];
    this.rings   = [];
    this.spawnT  = 0.8;
    this.gateT   = 5.5;   // first gate delayed — fewer gates overall

    // Single initial gate
    this._spawnGate(L.H * 0.42);
    // 3 initial enemies for a denser start
    this._spawnEnemy(); this._spawnEnemy(); this._spawnEnemy();
  }

  _randSections() {
    const pool = [2, 3, 5, 10];
    return Array.from({ length: COLS }, (_, c) => ({
      col: c, mult: pool[Math.floor(Math.random() * pool.length)], flash: 0
    }));
  }

  _spawnGate(atY) {
    this.gates.push({
      id: Math.random(),
      y:  atY ?? -GATE_H * this.L.s,
      h:  GATE_H * this.L.s,
      sections: this._randSections(),
      phase: Math.random() * Math.PI * 2
    });
  }

  _spawnEnemy() {
    const { L, wave } = this;
    const n    = Math.random() < 0.5 && wave >= 2 ? 2 : 1;
    const cols = this._pickCols(n);
    for (const col of cols) {
      const count = Math.ceil(16 + wave * 14 * (0.5 + Math.random() * 0.8));
      const w = L.colW * 0.72, h = 60 * L.s;
      this.enemies.push({
        col, x: L.colW * (col + 0.5), y: -h,
        count, maxCount: count, w, h,
        t: Math.random() * 10
      });
    }
  }

  _pickCols(n) {
    const a = [0, 1, 2];
    for (let i = 2; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, n);
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  update(dt) {
    if (this.state !== 'playing') return;
    this.t  += dt;
    this.L   = this._layout();
    const { L } = this;
    const s  = L.s;

    for (const g of this.gates) {
      for (const sec of g.sections) sec.flash = Math.max(0, sec.flash - dt);
      g.phase += dt;
    }

    // Gates — spawn every 5–8.5 s (much less frequent)
    this.gateT -= dt;
    if (this.gateT <= 0) {
      this._spawnGate();
      this.gateT = 5.0 + Math.random() * 3.5;
    }
    const gSPD = GATE_SPD * s;
    for (const g of this.gates) g.y += gSPD * dt;
    this.gates = this.gates.filter(g => g.y - g.h * 0.5 < L.shooterY + 10 * s);

    // Enemies — spawn faster and in higher quantity
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this._spawnEnemy();
      this.spawnT = Math.max(0.45, 2.2 - this.wave * 0.15);
    }
    const eSPD = (26 + this.wave * 2.5) * s;
    for (const e of this.enemies) {
      e.y += eSPD * dt;
      e.t += dt;
      if (e.y - e.h * 0.45 > L.shooterY) { this.state = 'gameover'; return; }
    }
    this.enemies = this.enemies.filter(e => e.count > 0 && e.y < L.H + 100);

    this._updateShots(dt);

    for (const p of this.sparks) {
      p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt;
    }
    this.sparks = this.sparks.filter(p => p.life < p.max);
    for (const r of this.rings) r.life += dt;
    this.rings  = this.rings.filter(r => r.life < r.max);

    if (this.kills >= this.killsNeeded && this.enemies.length === 0) {
      this.wave++;
      this.kills       = 0;
      this.killsNeeded = 6 + this.wave * 3;
    }
  }

  _updateShots(dt) {
    const { L } = this;
    const toAdd = [], alive = [];

    for (const sh of this.shots) {
      if (!sh.trail) sh.trail = [];
      sh.trail.push({ x: sh.x, y: sh.y });
      if (sh.trail.length > 7) sh.trail.shift();

      sh.x += sh.vx * dt;
      sh.y += sh.vy * dt;

      if (sh.y < -20 || sh.y > L.shooterY + 20 || sh.x < -20 || sh.x > L.W + 20) continue;

      let consumed = false;

      for (const g of this.gates) {
        if (sh.passedGates.has(g.id)) continue;
        const gy1 = g.y - g.h * 0.5, gy2 = g.y + g.h * 0.5;
        if (sh.y >= gy1 && sh.y <= gy2) {
          sh.passedGates.add(g.id);
          const col = Math.min(COLS - 1, Math.max(0, Math.floor(sh.x / L.colW)));
          const sec = g.sections[col];
          if (sec && sec.mult > 1 && toAdd.length + alive.length < MAX_SHOTS) {
            sec.flash = 0.4;
            const baseAngle = Math.atan2(sh.vy, sh.vx);
            const spd       = Math.hypot(sh.vx, sh.vy);
            const spread    = Math.min(0.55, 0.15 * sec.mult);
            for (let i = 0; i < sec.mult; i++) {
              const a = baseAngle + (sec.mult > 1 ? (i / (sec.mult - 1) - 0.5) * spread * 2 : 0);
              toAdd.push({
                x: sh.x, y: sh.y,
                vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
                passedGates: new Set(sh.passedGates), trail: []
              });
            }
            consumed = true;
          }
          break;
        }
      }
      if (consumed) continue;

      for (const e of this.enemies) {
        if (e.count <= 0) continue;
        const hw = e.w * 0.5, hh = e.h * 0.5;
        if (sh.x > e.x - hw && sh.x < e.x + hw && sh.y > e.y - hh && sh.y < e.y + hh) {
          e.count--;
          if (e.count <= 0) { this._burst(e.x, e.y); this.score += Math.ceil(e.maxCount * 8); this.kills++; }
          else               { this._pop(sh.x, sh.y); }
          consumed = true; break;
        }
      }
      if (!consumed) alive.push(sh);
    }
    this.shots = [...alive, ...toAdd];
  }

  _burst(x, y) {
    const colors = ['#FF5050', '#FF9030', '#FFD030', '#FF70C0', '#FFFFFF'];
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2 + Math.random() * 0.3;
      const sp = 75 + Math.random() * 170;
      this.sparks.push({ x, y, color: colors[i % colors.length],
        vx: Math.cos(a)*sp, vy: Math.sin(a)*sp - 95, life: 0,
        max: 0.5 + Math.random()*0.4, size: 3 + Math.random()*5 });
    }
    this.rings.push({ x, y, life: 0, max: 0.4, maxR: 60 });
  }

  _pop(x, y) {
    for (let i = 0; i < 3; i++) {
      this.sparks.push({ x, y, color: i === 0 ? '#FFE066' : '#FFA020',
        vx: (Math.random()-0.5)*60, vy: -55-Math.random()*30,
        life: 0, max: 0.14+i*0.03, size: 2.5 + i });
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  render(ctx) {
    const { L, t } = this;
    ctx.save();

    this._drawBg(ctx);

    // Explosion rings
    for (const r of this.rings) {
      const prog = r.life / r.max;
      ctx.globalAlpha = (1 - prog) * 0.65;
      ctx.strokeStyle = '#FF7040'; ctx.lineWidth = (1 - prog) * 6 * L.s;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.maxR * prog * L.s, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    for (const g of this.gates)   this._drawGate(ctx, g);
    for (const e of this.enemies) this._drawEnemy(ctx, e);

    // Shots with trails
    const sr = SHOT_R * L.s;
    for (const sh of this.shots) {
      if (sh.trail) {
        for (let ti = 0; ti < sh.trail.length; ti++) {
          const tp   = sh.trail[ti];
          const frac = (ti + 1) / sh.trail.length;
          ctx.globalAlpha = frac * 0.32;
          ctx.fillStyle   = '#FFA020';
          ctx.beginPath(); ctx.arc(tp.x, tp.y, sr * frac * 0.65, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#FFE066';
      ctx.beginPath(); ctx.arc(sh.x, sh.y, sr * 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      const sg = ctx.createRadialGradient(sh.x - sr*.3, sh.y - sr*.3, sr*.1, sh.x, sh.y, sr);
      sg.addColorStop(0, '#FFF8C0'); sg.addColorStop(0.55, '#FFD040'); sg.addColorStop(1, '#EE7000');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(sh.x, sh.y, sr, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const p of this.sparks) {
      ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
      ctx.fillStyle   = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * L.s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    this._drawShooter(ctx, L.W * 0.5, L.shooterY, t);
    this._drawHUD(ctx);
    if (this.state === 'gameover') this._drawGameOver(ctx);

    ctx.restore();
  }

  _drawBg(ctx) {
    const { L, t } = this;
    const s = L.s;

    // Deep space gradient
    const bg = ctx.createLinearGradient(0, 0, 0, L.H);
    bg.addColorStop(0, '#020810'); bg.addColorStop(0.55, '#081020'); bg.addColorStop(1, '#0C1830');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, L.W, L.H);

    // Scrolling star field
    ctx.save();
    for (const star of this._stars) {
      const y = ((star.y + t * star.s * 0.035) % 1) * L.H;
      ctx.globalAlpha = 0.25 + 0.4 * Math.sin(t * star.s * 1.8 + star.x * 9);
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(star.x * L.W, y, star.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // Subtle lane glow
    for (let c = 0; c < COLS; c++) {
      const cx = L.colW * (c + 0.5);
      const inten = 0.05 + 0.022 * Math.sin(t * 0.6 + c * 1.2);
      const lg = ctx.createLinearGradient(cx - L.colW*.44, 0, cx + L.colW*.44, 0);
      lg.addColorStop(0, 'transparent');
      lg.addColorStop(0.5, `rgba(28,68,180,${inten})`);
      lg.addColorStop(1, 'transparent');
      ctx.fillStyle = lg; ctx.fillRect(cx - L.colW*.44, 0, L.colW * .88, L.H);
    }

    // Lane dividers
    ctx.strokeStyle = 'rgba(50,100,220,0.22)'; ctx.lineWidth = 1.5;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath(); ctx.moveTo(L.colW*c, 0); ctx.lineTo(L.colW*c, L.H); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(30,70,160,0.10)'; ctx.lineWidth = 1;
    ctx.setLineDash([14*s, 14*s]);
    for (let c = 0; c < COLS; c++) {
      ctx.beginPath(); ctx.moveTo(L.colW*(c+.5), 55*s); ctx.lineTo(L.colW*(c+.5), L.H); ctx.stroke();
    }
    ctx.setLineDash([]);

    // Danger zone gradient
    const dg = ctx.createLinearGradient(0, L.shooterY - 28*s, 0, L.H);
    dg.addColorStop(0, 'rgba(200,25,25,0)'); dg.addColorStop(1, 'rgba(180,18,18,0.15)');
    ctx.fillStyle = dg; ctx.fillRect(0, L.shooterY - 28*s, L.W, L.H - L.shooterY + 28*s);

    // Danger line
    ctx.strokeStyle = 'rgba(255,50,50,0.55)'; ctx.lineWidth = 2*s;
    ctx.setLineDash([10*s, 7*s]);
    ctx.beginPath(); ctx.moveTo(0, L.shooterY); ctx.lineTo(L.W, L.shooterY); ctx.stroke();
    ctx.setLineDash([]);
  }

  _drawGate(ctx, g) {
    const { L } = this;
    const s = L.s, y = g.y, gh = g.h;
    const COLORS = ['#00AAFF', '#CC40FF', '#30EE80'];

    for (let i = 0; i < COLS; i++) {
      const sec   = g.sections[i];
      const x1    = i * L.colW + 5 * s;
      const w     = L.colW - 10 * s;
      const cx    = x1 + w / 2;
      const col   = COLORS[i];
      const fl    = sec.flash > 0;
      const pulse = Math.sin(g.phase * 2.5 + i * 1.1) * 0.5 + 0.5;

      // Halo glow behind gate
      if (!fl) {
        ctx.globalAlpha = 0.10 + pulse * 0.08;
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.roundRect(x1 - 5*s, y - gh*0.95, w + 10*s, gh*1.9, 14*s); ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Gate body
      const bodyG = ctx.createLinearGradient(x1, y - gh*.5, x1, y + gh*.5);
      if (fl) {
        bodyG.addColorStop(0, 'rgba(255,245,70,0.95)'); bodyG.addColorStop(1, 'rgba(255,195,10,0.95)');
      } else {
        bodyG.addColorStop(0, col + '1A'); bodyG.addColorStop(0.5, col + '55'); bodyG.addColorStop(1, col + '1A');
      }
      ctx.fillStyle = bodyG;
      ctx.beginPath(); ctx.roundRect(x1, y - gh*.5, w, gh, 10*s); ctx.fill();

      // Border
      ctx.strokeStyle  = fl ? '#FFDF30' : col;
      ctx.lineWidth    = fl ? 3*s : (1.5 + pulse*0.8)*s;
      ctx.globalAlpha  = fl ? 1 : 0.5 + pulse*0.5;
      ctx.beginPath(); ctx.roundRect(x1, y - gh*.5, w, gh, 10*s); ctx.stroke();
      ctx.globalAlpha  = 1;

      // Center energy line
      if (!fl) {
        ctx.globalAlpha  = 0.28 + pulse * 0.28;
        ctx.strokeStyle  = col; ctx.lineWidth = 1.5*s;
        ctx.beginPath(); ctx.moveTo(x1+6*s, y); ctx.lineTo(x1+w-6*s, y); ctx.stroke();
        ctx.globalAlpha  = 1;
      }

      // Multiplier text with glow
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (!fl) {
        ctx.shadowColor = col; ctx.shadowBlur = 10*s;
        ctx.fillStyle = '#FFFFFF'; ctx.font = `900 ${21*s}px system-ui`;
        ctx.fillText(`×${sec.mult}`, cx, y);
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = '#1A1000'; ctx.font = `900 ${21*s}px system-ui`;
        ctx.fillText(`×${sec.mult}`, cx, y);
      }
    }
  }

  _drawEnemy(ctx, e) {
    const { L } = this;
    const s     = L.s;
    const ratio = e.count / e.maxCount;
    const bob   = Math.sin(e.t * 3.5) * 3 * s;
    const ey    = e.y + bob;
    const r     = Math.min(e.w, e.h) * 0.44;

    // Color: green → yellow → red based on remaining HP
    const hue    = Math.round(ratio * 120);
    const col    = `hsl(${hue},82%,52%)`;
    const darkC  = `hsl(${hue},82%,28%)`;
    const lightC = `hsl(${hue},70%,72%)`;

    // Shadow
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(e.x, ey + r*.95, r*.65, r*.18, 0, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;

    // Body ambient glow
    const glow = ctx.createRadialGradient(e.x, ey, r*.2, e.x, ey, r*1.65);
    glow.addColorStop(0, `hsla(${hue},82%,52%,0.28)`);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(e.x, ey, r*1.65, 0, Math.PI*2); ctx.fill();

    // Body with squish animation
    const sq = Math.abs(Math.sin(e.t * 3.5)) * 0.07;
    ctx.save(); ctx.translate(e.x, ey); ctx.scale(1 + sq*.4, 1 - sq*.25);
    const bodyG = ctx.createRadialGradient(-r*.28, -r*.22, r*.05, 0, r*.1, r*1.05);
    bodyG.addColorStop(0, lightC); bodyG.addColorStop(0.5, col); bodyG.addColorStop(1, darkC);
    ctx.fillStyle = bodyG; ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1.5*s;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.restore();

    // Tentacle bumps at base
    for (let ti = -1; ti <= 1; ti++) {
      const tx = e.x + ti * r * .44, ty = ey + r * .82;
      const tR = r * .2 - Math.abs(ti) * r * .03;
      ctx.fillStyle = darkC; ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = s;
      ctx.beginPath(); ctx.arc(tx, ty, tR, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    }

    // Eyes
    const eSpread = r * .33, eyeY = ey - r * .1, eR = r * .28;
    for (const sgn of [-1, 1]) {
      const ex2 = e.x + sgn * eSpread;
      ctx.fillStyle = '#FFF'; ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = .5*s;
      ctx.beginPath(); ctx.arc(ex2, eyeY, eR, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#18080A';
      ctx.beginPath(); ctx.arc(ex2 + sgn*eR*.2, eyeY + eR*.18, eR*.6, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.beginPath(); ctx.arc(ex2 - eR*.18, eyeY - eR*.24, eR*.3, 0, Math.PI*2); ctx.fill();
    }

    // Angry eyebrows when HP ≤ 50%
    if (ratio < 0.5) {
      ctx.strokeStyle = '#3A0808'; ctx.lineWidth = 2*s; ctx.lineCap = 'round';
      for (const sgn of [-1, 1]) {
        const ex2 = e.x + sgn * eSpread;
        ctx.beginPath();
        ctx.moveTo(ex2 - sgn*eR*.7, eyeY - eR*.9);
        ctx.lineTo(ex2 + sgn*eR*.45, eyeY - eR*1.3);
        ctx.stroke();
      }
    }

    // Mouth: smile (healthy) → frown (hurt)
    ctx.strokeStyle = ratio < 0.4 ? '#7A1010' : '#3A2818';
    ctx.lineWidth = 1.8*s; ctx.lineCap = 'round';
    if (ratio >= 0.5) {
      ctx.beginPath(); ctx.arc(e.x, ey + r*.3, r*.17, 0.1, Math.PI - 0.1); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(e.x, ey + r*.48, r*.17, Math.PI+.12, -.12); ctx.stroke();
    }

    // Count badge
    const bR = r * .36, bX = e.x + r*.68, bY = ey - r*.68;
    ctx.fillStyle   = ratio < 0.3 ? '#CC0C0C' : 'rgba(255,255,255,0.95)';
    ctx.strokeStyle = darkC; ctx.lineWidth = 1.5*s;
    ctx.beginPath(); ctx.arc(bX, bY, bR, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = ratio < 0.3 ? '#FFF' : '#1A1A1A';
    ctx.font = `900 ${Math.round(bR*1.55)}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(e.count), bX, bY + .5);
  }

  _drawShooter(ctx, cx, cy, t) {
    const { L } = this;
    const s = L.s;

    // Platform base
    const pw = L.colW * .65, ph = 16*s;
    const plG = ctx.createLinearGradient(cx-pw/2, cy, cx+pw/2, cy+ph);
    plG.addColorStop(0, '#3A6A9A'); plG.addColorStop(1, '#152540');
    ctx.fillStyle = plG; ctx.strokeStyle = '#50A0D0'; ctx.lineWidth = 1.5*s;
    ctx.beginPath(); ctx.roundRect(cx-pw/2, cy, pw, ph, 5*s); ctx.fill(); ctx.stroke();

    // Barrel
    const bW = 10*s, bH = 40*s;
    const bG = ctx.createLinearGradient(cx-bW/2, cy-bH, cx+bW/2, cy);
    bG.addColorStop(0, '#70C0E0'); bG.addColorStop(1, '#1A4060');
    ctx.fillStyle = bG; ctx.strokeStyle = '#48A0C8'; ctx.lineWidth = 1.5*s;
    ctx.beginPath(); ctx.roundRect(cx-bW/2, cy-bH, bW, bH, 3*s); ctx.fill(); ctx.stroke();

    // Barrel glow tip
    ctx.globalAlpha = .35 + .28*Math.sin(t*8);
    const tipG = ctx.createRadialGradient(cx, cy-bH, 0, cx, cy-bH, 18*s);
    tipG.addColorStop(0, '#A0F0FF'); tipG.addColorStop(1, 'transparent');
    ctx.fillStyle = tipG; ctx.beginPath(); ctx.arc(cx, cy-bH, 18*s, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#C8F4FF'; ctx.strokeStyle = '#50D0FF'; ctx.lineWidth = 2*s;
    ctx.beginPath(); ctx.arc(cx, cy-bH, 5*s, 0, Math.PI*2); ctx.fill(); ctx.stroke();

    // Body orb
    const r = 20*s;
    const orbG = ctx.createRadialGradient(cx-r*.28, cy-r*.28, r*.08, cx, cy, r);
    orbG.addColorStop(0, '#90D8FF'); orbG.addColorStop(0.6, '#2070A8'); orbG.addColorStop(1, '#0A2038');
    ctx.fillStyle = orbG; ctx.strokeStyle = '#40A8D8'; ctx.lineWidth = 2*s;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath(); ctx.arc(cx-r*.28, cy-r*.28, r*.28, 0, Math.PI*2); ctx.fill();

    // Pulse ring
    const pr = r + 8*s + Math.sin(t*5)*4*s;
    ctx.globalAlpha = .22 + Math.sin(t*5)*.14;
    ctx.strokeStyle = '#60D0FF'; ctx.lineWidth = 1.5*s;
    ctx.beginPath(); ctx.arc(cx, cy, pr, 0, Math.PI*2); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  _drawHUD(ctx) {
    const { L, t } = this;
    const s = L.s;

    // Bar background
    ctx.fillStyle = 'rgba(4,8,20,0.82)'; ctx.fillRect(0, 0, L.W, 52*s);
    const hudLine = ctx.createLinearGradient(0, 50*s, 0, 54*s);
    hudLine.addColorStop(0, 'rgba(40,100,220,0.5)'); hudLine.addColorStop(1, 'transparent');
    ctx.fillStyle = hudLine; ctx.fillRect(0, 50*s, L.W, 4*s);

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';  ctx.fillStyle = '#80C8FF'; ctx.font = `bold ${13*s}px system-ui`;
    ctx.fillText(`Ola ${this.wave}`, 12*s, 26*s);
    ctx.textAlign = 'right'; ctx.fillStyle = '#FFE066'; ctx.font = `bold ${14*s}px system-ui`;
    ctx.fillText(`⭐ ${this.score}`, L.W-12*s, 26*s);
    ctx.textAlign = 'center'; ctx.fillStyle = '#7AB8FF'; ctx.font = `${10*s}px system-ui`;
    ctx.fillText(`${this.kills} / ${this.killsNeeded} eliminados`, L.W/2, 26*s);

    if (Math.sin(t*2.5) > 0.2) {
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#70B0FF'; ctx.font = `${9*s}px system-ui`;
      ctx.fillText('Tocá para disparar · 2 jugadores', L.W/2, L.H-8*s);
      ctx.globalAlpha = 1;
    }
  }

  _drawGameOver(ctx) {
    const { L } = this;
    const s = L.s;
    ctx.fillStyle = 'rgba(2,5,14,0.88)'; ctx.fillRect(0, 0, L.W, L.H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FF5070'; ctx.font = `900 ${28*s}px system-ui`;
    ctx.fillText('¡Los amigos llegaron! 😅', L.W/2, L.H*.38);
    ctx.fillStyle = '#FFE066'; ctx.font = `bold ${17*s}px system-ui`;
    ctx.fillText(`Ola ${this.wave} · ${this.score} ⭐`, L.W/2, L.H*.38+40*s);
    ctx.fillStyle = '#80C0FF'; ctx.font = `${13*s}px system-ui`;
    ctx.fillText('Toca para reintentar', L.W/2, L.H*.38+74*s);
  }

  // ── Input — multitouch ────────────────────────────────────────────────────

  _bindInput() {
    const cv = this.canvas;

    const pos = (touch) => {
      const r = cv.getBoundingClientRect();
      return {
        x: (touch.clientX - r.left) * (cv.width  / r.width),
        y: (touch.clientY - r.top)  * (cv.height / r.height)
      };
    };

    const onMouseDown = (e) => {
      e.preventDefault();
      if (this.state === 'gameover') { this._init(); return; }
      if (this.state !== 'playing') return;
      const r = cv.getBoundingClientRect();
      this._shoot({
        x: (e.clientX - r.left) * (cv.width  / r.width),
        y: (e.clientY - r.top)  * (cv.height / r.height)
      });
    };

    const onTouchStart = (e) => {
      e.preventDefault();
      if (this.state === 'gameover') { this._init(); return; }
      if (this.state !== 'playing') return;
      for (let i = 0; i < e.changedTouches.length; i++) this._shoot(pos(e.changedTouches[i]));
    };

    cv.addEventListener('mousedown',  onMouseDown);
    cv.addEventListener('touchstart', onTouchStart, { passive: false });

    this._unbind = () => {
      cv.removeEventListener('mousedown',  onMouseDown);
      cv.removeEventListener('touchstart', onTouchStart);
    };
  }

  _shoot(p) {
    const { L } = this;
    const col = Math.min(COLS-1, Math.max(0, Math.floor(p.x / L.colW)));
    const sx  = L.colW * (col + 0.5);
    const sy  = L.shooterY;
    const dx  = p.x - sx, dy = p.y - sy;
    if (dy > -20) return;
    const spd = SHOT_SPD * L.s;
    const len = Math.hypot(dx, dy);
    this.shots.push({
      x: sx, y: sy,
      vx: (dx/len)*spd, vy: (dy/len)*spd,
      passedGates: new Set(), trail: []
    });
  }

  destroy() { if (this._unbind) this._unbind(); }
}
