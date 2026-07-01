// ── Galaga — retro space shooter ─────────────────────────────────────────────

const _COLS = 10, _ROWS = 5;
const _MAX_LIVES   = 3;
const _PLAYER_SPD  = 280;
const _PBULLET_SPD = 540;
const _EBULLET_SPD = 200;
const _FIRE_CD     = 0.28;
const _MAX_PB      = 2;
const _FORM_BASE   = 50;
const _FORM_DROP   = 16;
const _INV_TIME    = 2.0;
const _STAR_N      = 140;

// Row specs — row 0 = bottom of formation (first to be eaten), row 4 = top (commanders)
const _ROW = [
  { kind:'bee',       pts:40,  col:'#FACC15', alt:'#A16207' },
  { kind:'bee',       pts:40,  col:'#FB923C', alt:'#C2410C' },
  { kind:'fighter',   pts:80,  col:'#60A5FA', alt:'#1E40AF' },
  { kind:'fighter',   pts:80,  col:'#A78BFA', alt:'#5B21B6' },
  { kind:'commander', pts:160, col:'#F87171', alt:'#991B1B' },
];

function _r(a, b) { return a + Math.random() * (b - a); }

export class Galaga {
  constructor(canvas) {
    this.canvas = canvas;
    this.best   = +(localStorage.getItem('galaga_best') || 0);
    this._stars = this._mkStars();
    this.reset();
  }

  _mkStars() {
    return Array.from({ length: _STAR_N }, () => ({
      x: Math.random(), y: Math.random(),
      r:   0.5 + Math.random() * 1.5,
      spd: [16, 38, 70][Math.floor(Math.random() * 3)],
      alpha: 0.3 + Math.random() * 0.7,
      phase: Math.random() * Math.PI * 2,
    }));
  }

  reset() {
    const W = this.canvas.width, H = this.canvas.height;
    this.score = 0;
    this.lives = _MAX_LIVES;
    this.wave  = 1;
    this.t     = 0;
    this.phase = 'entry';
    this.phaseTimer = 0;

    this.player = { x: W / 2, y: H - 48, w: 22, h: 26, fireCD: 0, invTimer: 0 };
    this.dirL    = false;
    this.dirR    = false;
    this.autoFire = false;

    this.pBullets = [];
    this.eBullets = [];
    this.parts    = [];

    this._nextDive  = _r(2.5, 4.5);
    this._nextEShot = _r(1.8, 3.5);
    this._replayBtn = null;

    this._spawnFormation();
  }

  _spawnFormation() {
    const W = this.canvas.width, H = this.canvas.height;
    const cW = Math.min(38, (W * 0.88) / _COLS);
    const cH = Math.min(30, cW * 0.80);
    const fW  = _COLS * cW;
    const bX  = (W - fW) / 2 + cW / 2;
    const bY  = H * 0.06;

    this._cW = cW; this._cH = cH;
    this._bX = bX; this._bY = bY;
    this._fX = 0; this._fDir = 1; this._fDrop = 0;
    this._fSpd = _FORM_BASE + (this.wave - 1) * 8;

    const ENTRY_GAP = 0.055;
    this.enemies = [];
    for (let row = 0; row < _ROWS; row++) {
      const spec = _ROW[row];
      for (let col = 0; col < _COLS; col++) {
        const idx = row * _COLS + col;
        const slotX = bX + col * cW;
        const slotY = bY + row * cH;
        this.enemies.push({
          row, col, idx,
          kind: spec.kind, pts: spec.pts, clr: spec.col, alt: spec.alt,
          alive: true,
          entryDelay: idx * ENTRY_GAP,
          entryDone: false,
          startY: slotY - H,
          slotX, slotY,
          x: slotX, y: slotY - H,
          diving: false, diveT: 0, diveSpd: _r(0.5, 0.7), diveP: null,
          wobble: Math.random() * Math.PI * 2,
        });
      }
    }
    this.phase = 'entry';
    this.phaseTimer = 0;
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  setDir(dx)    { this.dirL = dx < 0; this.dirR = dx > 0; }
  startFire()   { this.autoFire = true; }
  stopFire()    { this.autoFire = false; }
  fire()        { this._shoot(); }

  _shoot() {
    if (this.phase !== 'playing') return;
    if (this.player.fireCD > 0) return;
    if (this.pBullets.length >= _MAX_PB) return;
    const pl = this.player;
    this.pBullets.push({ x: pl.x, y: pl.y - pl.h / 2 - 2 });
    pl.fireCD = _FIRE_CD;
  }

  tap(sx, sy) {
    if (this.phase === 'over' && this._replayBtn) {
      const b = this._replayBtn;
      if (sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h) this.reset();
    }
  }

  // ── Update ─────────────────────────────────────────────────────────────────
  update(dt) {
    const W = this.canvas.width, H = this.canvas.height;
    this.t += dt;

    for (const s of this._stars) { s.y += (s.spd * dt) / H; if (s.y > 1) s.y -= 1; }

    for (const p of this.parts) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 90 * dt; p.life -= dt;
    }
    this.parts = this.parts.filter(p => p.life > 0);

    if (this.phase === 'entry')     { this._updateEntry(dt, H);    return; }
    if (this.phase === 'dying')     {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        if (this.lives <= 0) {
          this.phase = 'over';
          if (this.score > this.best) { this.best = this.score; localStorage.setItem('galaga_best', this.best); }
        } else {
          this.player.x = W / 2; this.player.invTimer = _INV_TIME; this.phase = 'playing';
        }
      }
      return;
    }
    if (this.phase === 'waveClear') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) { this.wave++; this._spawnFormation(); }
      return;
    }
    if (this.phase === 'over') return;

    // ── PLAYING ──
    const pl = this.player;
    if (this.dirL) pl.x = Math.max(pl.w / 2,      pl.x - _PLAYER_SPD * dt);
    if (this.dirR) pl.x = Math.min(W - pl.w / 2,  pl.x + _PLAYER_SPD * dt);
    pl.fireCD   = Math.max(0, pl.fireCD   - dt);
    pl.invTimer = Math.max(0, pl.invTimer - dt);
    if (this.autoFire) this._shoot();

    this._updateFormation(dt, W);

    for (const e of this.enemies) {
      if (!e.alive || !e.diving) continue;
      e.diveT = Math.min(1, e.diveT + e.diveSpd * dt);
      const t = e.diveT, mt = 1 - t;
      const [p0, p1, p2, p3] = e.diveP;
      e.x = mt**3*p0.x + 3*mt**2*t*p1.x + 3*mt*t**2*p2.x + t**3*p3.x;
      e.y = mt**3*p0.y + 3*mt**2*t*p1.y + 3*mt*t**2*p2.y + t**3*p3.y;
      if (e.diveT >= 1) e.alive = false;
    }

    this._nextDive  -= dt; if (this._nextDive  <= 0) { this._triggerDive(W, H); this._nextDive  = _r(2, 4); }
    this._nextEShot -= dt; if (this._nextEShot <= 0) { this._enemyShoot();       this._nextEShot = _r(1.5, 3.5); }

    this.pBullets = this.pBullets.filter(b => { b.y -= _PBULLET_SPD * dt; return b.y > -10; });
    this.eBullets = this.eBullets.filter(b => { b.y += _EBULLET_SPD * dt; return b.y < H + 10; });

    // Player bullets vs enemies
    outer: for (let i = this.pBullets.length - 1; i >= 0; i--) {
      const b = this.pBullets[i];
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (Math.hypot(b.x - e.x, b.y - e.y) < this._R(e) + 5) {
          this.score += e.diving ? e.pts * 2 : e.pts;
          this._boom(e.x, e.y, e.clr);
          e.alive = false;
          this.pBullets.splice(i, 1);
          continue outer;
        }
      }
    }

    // Enemy bullets vs player
    if (pl.invTimer <= 0) {
      for (let i = this.eBullets.length - 1; i >= 0; i--) {
        const b = this.eBullets[i];
        if (Math.abs(b.x - pl.x) < pl.w / 2 + 3 && Math.abs(b.y - pl.y) < pl.h / 2 + 4) {
          this.eBullets.splice(i, 1); this._hitPlayer(W); break;
        }
      }
    }

    // Diving enemy vs player
    if (pl.invTimer <= 0) {
      for (const e of this.enemies) {
        if (!e.alive || !e.diving) continue;
        if (Math.hypot(e.x - pl.x, e.y - pl.y) < this._R(e) + pl.w / 2 - 4) {
          this._boom(e.x, e.y, e.clr); e.alive = false; this._hitPlayer(W); break;
        }
      }
    }

    if (this.enemies.every(e => !e.alive)) {
      this.score += 500; this.phase = 'waveClear'; this.phaseTimer = 2.5;
    }

    for (const e of this.enemies) { if (e.alive && !e.diving) e.wobble += dt * 1.8; }
  }

  _updateEntry(dt, H) {
    let allDone = true;
    for (const e of this.enemies) {
      if (!e.alive || e.entryDone) continue;
      const elapsed = this.t - e.entryDelay;
      if (elapsed < 0) { allDone = false; continue; }
      const tE = Math.min(1, elapsed / 0.45);
      const ease = 1 - (1 - tE) ** 3;
      e.y = e.startY + (e.slotY - e.startY) * ease;
      e.x = e.slotX;
      if (tE >= 1) { e.entryDone = true; e.y = e.slotY; } else allDone = false;
    }
    if (allDone) this.phase = 'playing';
  }

  _updateFormation(dt, W) {
    const fixed = this.enemies.filter(e => e.alive && !e.diving);
    if (!fixed.length) return;

    this._fX += this._fDir * this._fSpd * dt;

    let minX = Infinity, maxX = -Infinity;
    for (const e of fixed) {
      const x = this._bX + e.col * this._cW + this._fX;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
    const R = this._R(fixed[0]);
    if (maxX + R > W - 10 && this._fDir > 0) { this._fDir = -1; this._fDrop += _FORM_DROP; }
    if (minX - R < 10    && this._fDir < 0) { this._fDir =  1; this._fDrop += _FORM_DROP; }

    const aliveN = this.enemies.filter(e => e.alive).length;
    this._fSpd = (_FORM_BASE + (this.wave - 1) * 8) * (1 + (1 - aliveN / (_ROWS * _COLS)) * 2.2);

    for (const e of this.enemies) {
      if (!e.alive || e.diving) continue;
      e.x = this._bX + e.col * this._cW + this._fX;
      e.y = this._bY + e.row * this._cH + this._fDrop;
    }
  }

  _triggerDive(W, H) {
    const cands = this.enemies.filter(e => e.alive && !e.diving);
    if (!cands.length) return;
    const count = Math.random() < 0.3 ? 2 : 1;
    for (let i = 0; i < count && cands.length; i++) {
      const idx = Math.floor(Math.random() * cands.length);
      const e   = cands.splice(idx, 1)[0];
      e.diving  = true; e.diveT = 0;
      const side = (Math.random() < 0.5 ? 1 : -1) * _r(W * 0.25, W * 0.45);
      e.diveP = [
        { x: e.x, y: e.y },
        { x: e.x + side,                    y: e.y + H * 0.28 },
        { x: this.player.x + _r(-50, 50),  y: H * 0.70 },
        { x: this.player.x + _r(-25, 25),  y: H + 65 },
      ];
    }
  }

  _enemyShoot() {
    const alive = this.enemies.filter(e => e.alive);
    if (!alive.length) return;
    const e = alive[Math.floor(Math.random() * alive.length)];
    this.eBullets.push({ x: e.x, y: e.y + this._R(e) });
  }

  _hitPlayer(W) {
    this.lives--;
    this._boom(this.player.x, this.player.y, '#C084FC');
    for (let i = 0; i < 8; i++)
      this._boom(this.player.x + _r(-20, 20), this.player.y + _r(-20, 20),
        ['#F0ABFC', '#7C3AED', '#DB2777'][i % 3]);
    this.pBullets = [];
    this.phase = 'dying'; this.phaseTimer = 1.6;
    if (this.score > this.best) { this.best = this.score; localStorage.setItem('galaga_best', this.best); }
  }

  _R(e) { return { bee: 7, fighter: 9, commander: 11 }[e.kind] ?? 8; }

  _boom(x, y, col) {
    const N = 7 + Math.floor(Math.random() * 5);
    for (let i = 0; i < N; i++) {
      const a = (Math.PI * 2 * i) / N + Math.random() * 0.5;
      const spd = _r(50, 150);
      this.parts.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 40,
        r: _r(2, 5), col, life: _r(0.4, 0.85), maxLife: 0.85 });
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  render(ctx) {
    const W = this.canvas.width, H = this.canvas.height;

    ctx.fillStyle = '#04091A';
    ctx.fillRect(0, 0, W, H);

    // Stars
    for (const s of this._stars) {
      const flicker = 0.75 + 0.25 * Math.sin(this.t * 2.5 + s.phase);
      ctx.globalAlpha = s.alpha * flicker;
      ctx.fillStyle = '#FFF';
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Enemies
    for (const e of this.enemies) { if (e.alive) this._drawEnemy(ctx, e); }

    // Player bullets
    ctx.save();
    ctx.shadowColor = '#80FFFF'; ctx.shadowBlur = 10;
    ctx.fillStyle   = '#C0FFFF';
    for (const b of this.pBullets) ctx.fillRect(b.x - 2, b.y - 10, 4, 20);
    ctx.restore();

    // Enemy bullets
    ctx.save();
    ctx.shadowColor = '#FF8060'; ctx.shadowBlur = 10;
    ctx.fillStyle   = '#FF8060';
    for (const b of this.eBullets) {
      ctx.beginPath(); ctx.ellipse(b.x, b.y, 3, 5, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // Particles
    for (const p of this.parts) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle   = p.col;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Player (blink when invincible)
    if (this.phase !== 'dying') {
      const pl  = this.player;
      const vis = pl.invTimer <= 0 || Math.floor(pl.invTimer * 8) % 2 === 0;
      if (vis) this._drawPlayer(ctx, pl.x, pl.y, pl.w, pl.h);
    }

    this._drawHUD(ctx, W, H);
    this._drawPhase(ctx, W, H);
  }

  _drawHUD(ctx, W, H) {
    ctx.save();
    const fs = Math.max(12, Math.round(W * 0.032));
    ctx.font = `bold ${fs}px monospace`;
    ctx.textAlign = 'left';  ctx.fillStyle = '#80FFFF'; ctx.fillText(`${this.score}`, 14, 30);
    ctx.textAlign = 'center'; ctx.fillStyle = '#FDE047'; ctx.fillText(`MEJOR: ${this.best}`, W / 2, 30);
    ctx.textAlign = 'right';  ctx.fillStyle = '#C4B5FD'; ctx.fillText(`W${this.wave}`, W - 14, 30);
    for (let i = 0; i < this.lives; i++) {
      ctx.save();
      ctx.translate(14 + i * 24, H - 22);
      ctx.scale(0.48, 0.48);
      this._drawPlayer(ctx, 0, 0, 32, 38);
      ctx.restore();
    }
    ctx.restore();
  }

  _drawPhase(ctx, W, H) {
    ctx.textAlign = 'center';
    if (this.phase === 'entry') {
      const fs = Math.max(18, Math.round(W * 0.055));
      ctx.font = `bold ${fs}px monospace`;
      ctx.shadowColor = '#00FFFF'; ctx.shadowBlur = 18;
      ctx.fillStyle = '#80FFFF';
      ctx.fillText(`WAVE ${this.wave}`, W / 2, H / 2);
      ctx.shadowBlur = 0;
    }
    if (this.phase === 'waveClear') {
      const fs = Math.max(16, Math.round(W * 0.048));
      ctx.font = `bold ${fs}px monospace`;
      ctx.shadowColor = '#FACC15'; ctx.shadowBlur = 14;
      ctx.fillStyle = '#FDE047';
      ctx.fillText(`¡WAVE ${this.wave} CLEAR! +500`, W / 2, H / 2 - 22);
      ctx.shadowBlur = 0;
      ctx.font = `${Math.max(13, Math.round(W * 0.035))}px monospace`;
      ctx.fillStyle = '#80FFFF';
      ctx.fillText(`Próxima ola: WAVE ${this.wave + 1}`, W / 2, H / 2 + 28);
    }
    if (this.phase === 'over') {
      ctx.fillStyle = 'rgba(0,0,16,0.78)';
      ctx.fillRect(0, 0, W, H);
      const bigFs = Math.max(20, Math.round(W * 0.065));
      ctx.font = `bold ${bigFs}px monospace`;
      ctx.shadowColor = '#EF4444'; ctx.shadowBlur = 22;
      ctx.fillStyle = '#F87171';
      ctx.fillText('GAME OVER', W / 2, H * 0.36);
      ctx.shadowBlur = 0;
      const mFs = Math.max(14, Math.round(W * 0.04));
      ctx.font = `bold ${mFs}px monospace`;
      ctx.fillStyle = '#E2E8F0'; ctx.fillText(`Puntaje: ${this.score}`, W / 2, H * 0.47);
      ctx.fillStyle = '#FDE047'; ctx.fillText(`Mejor: ${this.best}`,    W / 2, H * 0.55);
      const bw = Math.min(W * 0.55, 280), bh = 48, bx = W / 2 - Math.min(W * 0.55, 280) / 2, by = H * 0.64;
      ctx.fillStyle = '#6D28D9';
      this._rrect(ctx, bx, by, bw, bh, 10); ctx.fill();
      ctx.fillStyle = '#FFF';
      ctx.font = `bold ${Math.max(13, Math.round(W * 0.036))}px monospace`;
      ctx.fillText('▶ JUGAR DE NUEVO', W / 2, by + bh * 0.65);
      this._replayBtn = { x: bx, y: by, w: bw, h: bh };
    }
  }

  _rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y,     x + w, y + r,     r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x,     y + h, x, y + h - r,     r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y,                 r);
    ctx.closePath();
  }

  _drawPlayer(ctx, cx, cy, PW, PH) {
    ctx.save(); ctx.translate(cx, cy);
    // Engine glow
    const gg = ctx.createRadialGradient(0, PH / 2 + 8, 0, 0, PH / 2 + 8, 18);
    gg.addColorStop(0, 'rgba(160,100,255,0.7)'); gg.addColorStop(1, 'rgba(160,100,255,0)');
    ctx.fillStyle = gg; ctx.fillRect(-18, PH / 2, 36, 22);
    // Body
    ctx.fillStyle = '#C084FC';
    ctx.beginPath(); ctx.moveTo(0, -PH / 2); ctx.lineTo(PW / 2 - 1, PH / 2); ctx.lineTo(-PW / 2 + 1, PH / 2); ctx.closePath(); ctx.fill();
    // Highlight
    ctx.fillStyle = '#E9D5FF';
    ctx.beginPath(); ctx.moveTo(0, -PH / 2); ctx.lineTo(PW / 8, 0); ctx.lineTo(0, PH / 5); ctx.lineTo(-PW / 8, 0); ctx.closePath(); ctx.fill();
    // Wings
    ctx.fillStyle = '#7C3AED';
    ctx.beginPath(); ctx.moveTo(-PW / 2 + 2, PH / 2); ctx.lineTo(-PW / 2 - 8, PH / 2 + 9); ctx.lineTo(-PW / 4, PH / 5); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(PW / 2 - 2,  PH / 2); ctx.lineTo(PW / 2 + 8,  PH / 2 + 9); ctx.lineTo(PW / 4,  PH / 5); ctx.closePath(); ctx.fill();
    // Cockpit
    ctx.fillStyle = '#38BDF8';
    ctx.beginPath(); ctx.ellipse(0, -PH / 7, PW / 8, PH / 9, 0, 0, Math.PI * 2); ctx.fill();
    // Gun barrel
    ctx.fillStyle = '#DDD6FE'; ctx.fillRect(-2, -PH / 2 - 9, 4, 10);
    // Flame (animated)
    const fc = Math.floor(180 + Math.random() * 75);
    ctx.fillStyle = `rgba(${fc},80,255,0.9)`;
    ctx.beginPath(); ctx.ellipse(0, PH / 2 + 5, (8 + Math.random() * 5) / 2, (10 + Math.random() * 5) / 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  _drawEnemy(ctx, e) {
    ctx.save();
    ctx.translate(e.x, e.y + (e.diving ? 0 : Math.sin(e.wobble) * 2));
    const R = this._R(e);
    if      (e.kind === 'bee')       this._drawBee(ctx, R, e.clr, e.alt);
    else if (e.kind === 'fighter')   this._drawFighter(ctx, R, e.clr, e.alt);
    else                             this._drawCommander(ctx, R, e.clr, e.alt);
    ctx.restore();
  }

  _drawBee(ctx, R, col, alt) {
    // Striped oval body (clipped)
    ctx.save();
    ctx.beginPath(); ctx.ellipse(0, 0, R * 0.68, R, 0, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = col; ctx.fillRect(-R, -R, R * 2, R * 2);
    ctx.fillStyle = alt;
    for (let i = -2; i <= 2; i++) ctx.fillRect(-R, i * R * 0.42 - R * 0.11, R * 2, R * 0.22);
    ctx.restore();
    // Wings
    ctx.fillStyle = 'rgba(200,240,255,0.55)';
    ctx.beginPath(); ctx.ellipse(-R * 1.05, -R * 0.15, R * 0.55, R * 0.32,  Math.PI * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse( R * 1.05, -R * 0.15, R * 0.55, R * 0.32, -Math.PI * 0.12, 0, Math.PI * 2); ctx.fill();
    // Eyes
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(-R * 0.28, -R * 0.28, R * 0.18, 0, Math.PI * 2);
                     ctx.arc( R * 0.28, -R * 0.28, R * 0.18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFF';
    ctx.beginPath(); ctx.arc(-R * 0.2, -R * 0.36, R * 0.07, 0, Math.PI * 2);
                     ctx.arc( R * 0.36,-R * 0.36, R * 0.07, 0, Math.PI * 2); ctx.fill();
    // Antennae
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-R * 0.2, -R); ctx.lineTo(-R * 0.42, -R * 1.45); ctx.stroke();
    ctx.beginPath(); ctx.moveTo( R * 0.2, -R); ctx.lineTo( R * 0.42, -R * 1.45); ctx.stroke();
  }

  _drawFighter(ctx, R, col, alt) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, -R); ctx.lineTo(R * 0.82, R * 0.35);
    ctx.lineTo(R * 0.38, R); ctx.lineTo(-R * 0.38, R); ctx.lineTo(-R * 0.82, R * 0.35); ctx.closePath(); ctx.fill();
    // Inner detail
    ctx.fillStyle = alt;
    ctx.beginPath(); ctx.moveTo(0, -R * 0.45); ctx.lineTo(R * 0.42, R * 0.65); ctx.lineTo(-R * 0.42, R * 0.65); ctx.closePath(); ctx.fill();
    // Cockpit
    ctx.fillStyle = '#BFDBFE';
    ctx.beginPath(); ctx.ellipse(0, -R * 0.1, R * 0.24, R * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    // Side fins
    ctx.fillStyle = alt;
    ctx.beginPath(); ctx.moveTo( R * 0.82, R * 0.35); ctx.lineTo( R * 1.28, R); ctx.lineTo( R * 0.38, R); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-R * 0.82, R * 0.35); ctx.lineTo(-R * 1.28, R); ctx.lineTo(-R * 0.38, R); ctx.closePath(); ctx.fill();
    // Sensor glow
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath(); ctx.arc(0, -R * 0.1, R * 0.14, 0, Math.PI * 2); ctx.fill();
  }

  _drawCommander(ctx, R, col, alt) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, -R * 1.1); ctx.lineTo(R, R * 0.45);
    ctx.lineTo(R * 0.5, R); ctx.lineTo(-R * 0.5, R); ctx.lineTo(-R, R * 0.45); ctx.closePath(); ctx.fill();
    // Wings
    ctx.fillStyle = alt;
    ctx.beginPath(); ctx.moveTo( R, R * 0.45); ctx.lineTo( R * 1.5, -R * 0.2); ctx.lineTo( R * 1.35, R); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-R, R * 0.45); ctx.lineTo(-R * 1.5, -R * 0.2); ctx.lineTo(-R * 1.35, R); ctx.closePath(); ctx.fill();
    // Cockpit
    ctx.fillStyle = '#FDA4AF';
    ctx.beginPath(); ctx.ellipse(0, -R * 0.12, R * 0.3, R * 0.34, 0, 0, Math.PI * 2); ctx.fill();
    // Crown spikes
    ctx.fillStyle = '#FCD34D';
    for (const s of [-0.5, -0.25, 0, 0.25, 0.5]) {
      ctx.beginPath();
      ctx.moveTo(s * R * 0.7, -R * 0.7);
      ctx.lineTo((s - 0.12) * R * 0.7, -R * 1.1);
      ctx.lineTo((s + 0.12) * R * 0.7, -R * 1.1);
      ctx.closePath(); ctx.fill();
    }
    // Eyes
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(-R * 0.28, -R * 0.08, R * 0.14, 0, Math.PI * 2);
                     ctx.arc( R * 0.28, -R * 0.08, R * 0.14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFF';
    ctx.beginPath(); ctx.arc(-R * 0.22, -R * 0.14, R * 0.055, 0, Math.PI * 2);
                     ctx.arc( R * 0.34, -R * 0.14, R * 0.055, 0, Math.PI * 2); ctx.fill();
  }

  destroy() {}
}
