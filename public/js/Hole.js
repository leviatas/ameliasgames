// ── Hole mini-game: "Agujero glotón" (estilo Hole.io) ───────────────────────

const WORLD_W = 2600, WORLD_H = 1900;
const START_R  = 16;
const MAX_R    = 190;

const TYPES = [
  { kind: 'flower',   min: 9,   max: 12,  w: 14 },
  { kind: 'bush',     min: 10,  max: 14,  w: 12 },
  { kind: 'rock',     min: 11,  max: 15,  w: 9  },
  { kind: 'cone',     min: 12,  max: 16,  w: 6  },
  { kind: 'mushroom', min: 12,  max: 16,  w: 6  },
  { kind: 'hydrant',  min: 14,  max: 18,  w: 5  },
  { kind: 'barrel',   min: 16,  max: 20,  w: 6  },
  { kind: 'bench',    min: 18,  max: 24,  w: 6  },
  { kind: 'bike',     min: 20,  max: 26,  w: 5  },
  { kind: 'tree',     min: 30,  max: 40,  w: 8  },  // level 1 stops here
  { kind: 'car',      min: 32,  max: 42,  w: 7  },
  { kind: 'fountain', min: 44,  max: 56,  w: 3  },
  { kind: 'bus',      min: 56,  max: 70,  w: 3  },
  { kind: 'truck',    min: 60,  max: 76,  w: 2  },
  { kind: 'house',    min: 70,  max: 92,  w: 4  },  // level 2 stops here
  { kind: 'building', min: 110, max: 150, w: 3  },
];

// Todos los niveles tienen la misma cantidad de objetos para que el mejor
// tiempo sea comparable entre partidas.
const OBJ_COUNT = 240;
const LEVELS = [
  { n: 1, label: 'Parque',  emoji: '🌳', desc: 'Flores, árboles y bancos',        types: TYPES.slice(0, 10), count: OBJ_COUNT, key: 'hole_time_1' },
  { n: 2, label: 'Barrio',  emoji: '🏘️', desc: 'Autos, fuentes y casas',          types: TYPES.slice(0, 15), count: OBJ_COUNT, key: 'hole_time_2' },
  { n: 3, label: 'Ciudad',  emoji: '🏙️', desc: 'Edificios y todo lo que hay',     types: TYPES,              count: OBJ_COUNT, key: 'hole_time_3' },
];

function fmtTime(t) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

const PETALS = ['#FF6B9D', '#FF5D5D', '#B86DD6', '#FFFFFF', '#FFA94D'];
const CARCOL = ['#E8503A', '#3A7BE8', '#21B0A8', '#F2C037', '#F0EDE6', '#9B6DD6'];
const WALLS  = ['#FFE0A3', '#FFC9C9', '#C9E3FF', '#D7F0C2', '#F0D7F5'];
const TOWERS = ['#8FA3C4', '#A0B0B8', '#9AA6C8', '#B0A8A0'];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export class Hole {
  constructor(canvas) {
    this.canvas = canvas;
    this._phase = 'select';   // 'select' | 'playing' | 'over'
    this._level = null;
    this._selectBtns = [];
    this._replayBtns = [];
    this.t = 0;
    this.elapsed = 0;
    this.newRecord = false;
    this.score = 0;
    this.over  = false;
    this.allEaten = false;
    this.eatFlash = 0;
    this.hole  = { x: 0, y: 0, r: START_R, wob: 0, spin: 0 };
    this.dir   = { x: 0, y: 0 };
    this.touch = null;
    this.particles = [];
    this.objects   = [];
  }

  // ── Level start ────────────────────────────────────────────────────────────
  _startLevel(lvl) {
    this._level = lvl;
    this._phase = 'playing';
    this.t         = 0;
    this.elapsed   = 0;
    this.newRecord = false;
    this.score     = 0;
    this.over      = false;
    this.allEaten  = false;
    this.eatFlash  = 0;
    this.hole      = { x: WORLD_W / 2, y: WORLD_H / 2, r: START_R, wob: 0, spin: 0 };
    this.dir       = { x: 0, y: 0 };
    this.touch     = null;
    this.particles = [];
    this.objects   = [];
    this._spawn(lvl);
  }

  _spawn(lvl) {
    const types = lvl.types;
    const totalW = types.reduce((s, t) => s + t.w, 0);
    const pickType = () => {
      let r = Math.random() * totalW;
      for (const t of types) { if ((r -= t.w) <= 0) return t; }
      return types[0];
    };
    for (let i = 0; i < lvl.count; i++) {
      const t = pickType();
      const size = t.min + Math.random() * (t.max - t.min);
      const x = 60 + Math.random() * (WORLD_W - 120);
      const y = 60 + Math.random() * (WORLD_H - 120);
      const d = Math.hypot(x - WORLD_W / 2, y - WORLD_H / 2);
      if (d < 220 && size > 20) { i--; continue; }
      const o = { x, y, size, kind: t.kind, falling: false, scale: 1, spin: 0, val: Math.ceil(size / 6) };
      if (t.kind === 'flower')                      o.col = pick(PETALS);
      else if (t.kind === 'car' || t.kind === 'truck') o.col = pick(CARCOL);
      else if (t.kind === 'house')                  o.col = pick(WALLS);
      else if (t.kind === 'building')               o.col = pick(TOWERS);
      this.objects.push(o);
    }
  }

  // ── Camera ─────────────────────────────────────────────────────────────────
  _view() {
    const W = this.canvas.width, H = this.canvas.height;
    const viewW = 540 + this.hole.r * 6;
    const scale = W / viewW;
    return { W, H, scale };
  }
  _toScreen(wx, wy, V) {
    return { x: (wx - this.hole.x) * V.scale + V.W / 2, y: (wy - this.hole.y) * V.scale + V.H / 2 };
  }
  _toWorld(sx, sy, V) {
    return { x: (sx - V.W / 2) / V.scale + this.hole.x, y: (sy - V.H / 2) / V.scale + this.hole.y };
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  pointer(sx, sy) {
    if (this._phase === 'select') {
      for (const b of this._selectBtns) {
        if (sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h) {
          this._startLevel(LEVELS[b.lvl]);
          return;
        }
      }
      return;
    }
    if (this._phase === 'over') {
      for (const b of this._replayBtns) {
        if (sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h) {
          if (b.action === 'replay') this._startLevel(this._level);
          else this._phase = 'select';
          return;
        }
      }
      return;
    }
    this.touch = { x: sx, y: sy };
  }
  pointerUp() { this.touch = null; }
  setDir(x, y) { this.dir.x = x; this.dir.y = y; }

  // ── Update ─────────────────────────────────────────────────────────────────
  update(dt) {
    this.t += dt;
    if (this._phase === 'select') return;

    this.hole.wob  += dt;
    this.hole.spin += dt * 0.6;
    if (this.eatFlash > 0) this.eatFlash -= dt;

    for (const p of this.particles) {
      p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 600 * dt;
    }
    this.particles = this.particles.filter(p => p.life < p.max);

    if (this._phase === 'over') return;

    this.elapsed += dt;

    // Movement
    let mx = 0, my = 0;
    if (this.touch) {
      const V = this._view();
      const w = this._toWorld(this.touch.x, this.touch.y, V);
      mx = w.x - this.hole.x; my = w.y - this.hole.y;
    } else { mx = this.dir.x; my = this.dir.y; }
    const len = Math.hypot(mx, my);
    if (len > 0.5) {
      const speed = 230 + 60 / (1 + this.hole.r / 40);
      this.hole.x += (mx / len) * speed * dt;
      this.hole.y += (my / len) * speed * dt;
    }
    this.hole.x = Math.max(this.hole.r, Math.min(WORLD_W - this.hole.r, this.hole.x));
    this.hole.y = Math.max(this.hole.r, Math.min(WORLD_H - this.hole.r, this.hole.y));

    // Check all eaten
    if (this.objects.length > 0 && this.objects.every(o => o.eaten)) {
      this._endGame(true); return;
    }

    // Eating + vacuum pull
    for (const o of this.objects) {
      if (o.eaten) continue;
      const dx = this.hole.x - o.x, dy = this.hole.y - o.y;
      const d  = Math.hypot(dx, dy);
      const eatable = o.size <= this.hole.r * 1.02;
      if (o.falling) {
        o.x += dx * Math.min(dt * 10, 1); o.y += dy * Math.min(dt * 10, 1);
        o.scale -= dt * 2.6; o.spin += dt * 12;
        if (o.scale <= 0.06) this._consume(o);
      } else if (eatable && d < this.hole.r) {
        o.falling = true;
      } else if (eatable && d < this.hole.r * 2.1) {
        const pull = (1 - d / (this.hole.r * 2.1)) * dt * 3.2;
        o.x += dx * pull; o.y += dy * pull;
      }
    }
  }

  _endGame(allEaten) {
    this.over     = allEaten;
    this.allEaten = allEaten;
    this._phase   = 'over';
    // El récord es el menor tiempo en comerse todo
    const best = +(localStorage.getItem(this._level.key) || 0);
    if (allEaten && (best === 0 || this.elapsed < best)) {
      this.newRecord = true;
      localStorage.setItem(this._level.key, this.elapsed.toFixed(1));
    }
  }

  _consume(o) {
    o.eaten = true;
    this.score += o.val;
    this.eatFlash = 0.18;
    this.hole.r = Math.min(MAX_R, this.hole.r + o.size * 0.05);
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 120;
      this.particles.push({ x: this.hole.x, y: this.hole.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80,
        life: 0, max: 0.4 + Math.random() * 0.3, size: 2 + Math.random() * 3 });
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  render(ctx) {
    if (this._phase === 'select') { this._renderSelect(ctx); return; }

    const V = this._view(), { W, H, scale } = V;

    ctx.fillStyle = '#9CCB6B'; ctx.fillRect(0, 0, W, H);
    // Checker anchored to the world grid so tiles keep their colour as the hole moves
    const tileW = 120;
    const gx0 = Math.floor((this.hole.x - W / 2 / scale) / tileW), gx1 = Math.floor((this.hole.x + W / 2 / scale) / tileW);
    const gy0 = Math.floor((this.hole.y - H / 2 / scale) / tileW), gy1 = Math.floor((this.hole.y + H / 2 / scale) / tileW);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
      if (((gx + gy) % 2 + 2) % 2 === 0) {
        const s = this._toScreen(gx * tileW, gy * tileW, V);
        ctx.fillRect(s.x, s.y, tileW * scale + 0.5, tileW * scale + 0.5);
      }
    }
    const tl = this._toScreen(0, 0, V), br = this._toScreen(WORLD_W, WORLD_H, V);
    ctx.strokeStyle = 'rgba(90,120,60,0.6)'; ctx.lineWidth = 6;
    ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);

    const behind = [], front = [];
    for (const o of this.objects) {
      if (o.eaten) continue;
      (o.size <= this.hole.r ? behind : front).push(o);
    }
    behind.sort((a, b) => a.y - b.y);
    front.sort((a, b) => a.y - b.y);

    for (const o of behind) this._drawObj(ctx, o, V);
    this._drawHole(ctx, V);
    for (const o of front) this._drawObj(ctx, o, V);

    for (const p of this.particles) {
      const s = this._toScreen(p.x, p.y, V);
      ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
      ctx.fillStyle = '#3a2a1a';
      ctx.beginPath(); ctx.arc(s.x, s.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    this._drawHUD(ctx, V);

    if (this._phase === 'over') this._renderOver(ctx, W, H);
  }

  // ── Level select screen ────────────────────────────────────────────────────
  _renderSelect(ctx) {
    const W = this.canvas.width, H = this.canvas.height;
    const s = Math.max(0.6, Math.min(W, H) / 700);

    // Background
    ctx.fillStyle = '#9CCB6B'; ctx.fillRect(0, 0, W, H);
    // Subtle checker
    const tile = 80;
    for (let y = 0; y < H; y += tile) for (let x = 0; x < W; x += tile) {
      if (((x / tile + y / tile) % 2) === 0) { ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(x, y, tile, tile); }
    }

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    // Title
    ctx.font = `900 ${Math.round(32 * s)}px system-ui, sans-serif`;
    ctx.fillStyle = '#1d4010';
    ctx.fillText('⬤ Agujero Glotón', W / 2, H * 0.1);
    ctx.font = `bold ${Math.round(16 * s)}px system-ui, sans-serif`;
    ctx.fillStyle = '#2d5a1a';
    ctx.fillText(`Elegí un nivel — ¡comete los ${OBJ_COUNT} objetos lo más rápido que puedas!`, W / 2, H * 0.18);

    // Cards
    const cardW = Math.min(W * 0.82, 420 * s);
    const cardH = Math.round(72 * s);
    const cardX = W / 2 - cardW / 2;
    const gap   = Math.round(18 * s);
    const startY = H * 0.28;

    this._selectBtns = [];
    const BG = ['rgba(60,160,60,0.82)', 'rgba(40,120,200,0.82)', 'rgba(120,60,200,0.82)'];
    const HOVER_BG = ['rgba(60,180,60,0.92)', 'rgba(40,140,220,0.92)', 'rgba(140,80,220,0.92)'];

    for (let i = 0; i < LEVELS.length; i++) {
      const lvl  = LEVELS[i];
      const best = +(localStorage.getItem(lvl.key) || 0);
      const cy   = startY + i * (cardH + gap);
      const bx   = cardX, by = cy, bw = cardW, bh = cardH;

      this._selectBtns.push({ lvl: i, x: bx, y: by, w: bw, h: bh });

      // Card background
      ctx.fillStyle = BG[i];
      this._rrect(ctx, bx, by, bw, bh, 16 * s); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
      this._rrect(ctx, bx, by, bw, bh, 16 * s); ctx.stroke();

      // Emoji
      ctx.font = `${Math.round(28 * s)}px system-ui`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(lvl.emoji, bx + 18 * s, by + bh / 2);

      // Level name + desc
      ctx.fillStyle = '#fff';
      ctx.font = `900 ${Math.round(18 * s)}px system-ui, sans-serif`;
      ctx.fillText(`Nivel ${lvl.n} — ${lvl.label}`, bx + 62 * s, by + bh * 0.34);
      ctx.font = `${Math.round(13 * s)}px system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      ctx.fillText(lvl.desc, bx + 62 * s, by + bh * 0.68);

      // Best time badge
      if (best > 0) {
        ctx.textAlign = 'right';
        ctx.font = `bold ${Math.round(12 * s)}px system-ui, sans-serif`;
        ctx.fillStyle = '#FFD23F';
        ctx.fillText(`⏱ ${fmtTime(best)}`, bx + bw - 14 * s, by + bh / 2);
      }
    }
  }

  // ── Game over overlay ──────────────────────────────────────────────────────
  _renderOver(ctx, W, H) {
    const s = Math.max(0.7, Math.min(W, H) / 720);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    ctx.fillStyle = '#fff';
    ctx.font = `900 ${Math.round(52 * s)}px system-ui, sans-serif`;
    ctx.fillText('¡Todo comido!', W / 2, H * 0.32);

    ctx.font = `bold ${Math.round(28 * s)}px system-ui, sans-serif`;
    ctx.fillText(`⏱ Tu tiempo: ${fmtTime(this.elapsed)}`, W / 2, H * 0.44);

    const best = +(localStorage.getItem(this._level.key) || 0);
    ctx.fillStyle = '#FFD23F';
    ctx.font = `bold ${Math.round(18 * s)}px system-ui, sans-serif`;
    if (this.newRecord) ctx.fillText('🎉 ¡Nuevo récord!', W / 2, H * 0.53);
    else if (best > 0)  ctx.fillText(`Mejor en ${this._level.label}: ${fmtTime(best)}`, W / 2, H * 0.53);

    // Replay button
    const bw = Math.min(W * 0.5, 260 * s), bh = Math.round(50 * s);
    const rx = W / 2 - bw / 2, ry = H * 0.63;
    ctx.fillStyle = '#3C8A3C';
    this._rrect(ctx, rx, ry, bw, bh, 12 * s); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(17 * s)}px system-ui, sans-serif`;
    ctx.fillText(`▶ Repetir Nivel ${this._level.n}`, W / 2, ry + bh / 2);

    // Choose level button
    const cx = W / 2 - bw / 2, cy = H * 0.63 + bh + Math.round(14 * s);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    this._rrect(ctx, cx, cy, bw, bh, 12 * s); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText('Elegir nivel', W / 2, cy + bh / 2);

    this._replayBtns = [
      { action: 'replay',  x: rx, y: ry, w: bw, h: bh },
      { action: 'select',  x: cx, y: cy, w: bw, h: bh },
    ];
  }

  _rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y,     x + w, y + r,     r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x,      y + h, x, y + h - r,    r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y,   x + r, y,               r);
    ctx.closePath();
  }

  _drawHUD(ctx, V) {
    const { W, H } = V;
    const s = Math.max(0.7, Math.min(W, H) / 720);
    const best = +(localStorage.getItem(this._level?.key) || 0);

    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#1d3a12';
    ctx.font = `900 ${30 * s}px system-ui, sans-serif`;
    ctx.fillText(`⬤ ${this.score}`, 18 * s, 42 * s);
    ctx.font = `bold ${15 * s}px system-ui, sans-serif`;
    ctx.fillStyle = '#3a5a28';
    ctx.fillText(`⏱ ${fmtTime(this.elapsed)}${best > 0 ? `  ·  Mejor: ${fmtTime(best)}` : ''}`, 18 * s, 64 * s);

    // Level badge (top right)
    if (this._level) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#1d3a12';
      ctx.font = `bold ${15 * s}px system-ui, sans-serif`;
      ctx.fillText(`${this._level.emoji} Nivel ${this._level.n} — ${this._level.label}`, W - 18 * s, 42 * s);

      // Eaten progress
      const eaten  = this.objects.filter(o => o.eaten).length;
      const total  = this.objects.length;
      ctx.font = `${13 * s}px system-ui, sans-serif`;
      ctx.fillStyle = '#2d5a1a';
      ctx.fillText(`${eaten} / ${total}`, W - 18 * s, 62 * s);
    }
  }

  _drawObj(ctx, o, V) {
    const s = this._toScreen(o.x, o.y, V);
    const r = o.size * V.scale * o.scale;
    if (r < 1.2) return;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(s.x, s.y + r * 0.92, r * 0.85, r * 0.34, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(s.x, s.y);
    if (o.falling) { ctx.rotate(o.spin); ctx.globalAlpha = Math.max(0, Math.min(1, o.scale + 0.15)); }
    this._drawShape(ctx, o.kind, r, o.col);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  _drawShape(ctx, kind, r, col) {
    const lw = Math.max(1, r * 0.09);
    const line = (c) => { ctx.lineWidth = lw; ctx.strokeStyle = c || 'rgba(40,28,28,0.5)'; ctx.stroke(); };
    const blob = (x, y, rad, fill, stroke) => {
      ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fillStyle = fill; ctx.fill(); if (stroke) line(stroke);
    };
    const rrect = (x, y, w, h, rad, fill, stroke) => {
      ctx.beginPath(); ctx.roundRect(x, y, w, h, rad);
      ctx.fillStyle = fill; ctx.fill(); line(stroke);
    };
    ctx.lineJoin = 'round';

    switch (kind) {
      case 'flower': {
        ctx.lineWidth = r * 0.16; ctx.strokeStyle = '#3C8A3C';
        ctx.beginPath(); ctx.moveTo(0, r); ctx.lineTo(0, 0); ctx.stroke();
        for (let i = 0; i < 5; i++) {
          const a = i / 5 * Math.PI * 2 - Math.PI / 2;
          blob(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5 - r * 0.1, r * 0.4, col, 'rgba(120,40,80,0.35)');
        }
        blob(0, -r * 0.1, r * 0.3, '#FFD23F', 'rgba(150,110,20,0.4)');
        break;
      }
      case 'bush': {
        blob(-r * 0.45, r * 0.1, r * 0.55, '#5DAE4A');
        blob(r * 0.45,  r * 0.1, r * 0.55, '#5DAE4A');
        blob(0,        -r * 0.2, r * 0.62, '#6BC255', 'rgba(30,80,20,0.4)');
        break;
      }
      case 'rock': {
        ctx.beginPath();
        ctx.moveTo(-r * 0.8, r * 0.5); ctx.lineTo(-r * 0.5, -r * 0.4);
        ctx.lineTo(r * 0.2, -r * 0.6); ctx.lineTo(r * 0.8, r * 0.1);
        ctx.lineTo(r * 0.6,  r * 0.6); ctx.closePath();
        ctx.fillStyle = '#A7AcB2'; ctx.fill(); line('rgba(60,60,70,0.5)');
        ctx.beginPath(); ctx.moveTo(-r * 0.3, -r * 0.2); ctx.lineTo(r * 0.1, -r * 0.45);
        ctx.lineWidth = lw * 0.8; ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.stroke();
        break;
      }
      case 'cone': {
        rrect(-r * 0.75, r * 0.55, r * 1.5, r * 0.3, r * 0.1, '#FF7A1A', 'rgba(120,50,0,0.4)');
        ctx.beginPath(); ctx.moveTo(0, -r * 0.85); ctx.lineTo(r * 0.55, r * 0.55); ctx.lineTo(-r * 0.55, r * 0.55); ctx.closePath();
        ctx.fillStyle = '#FF7A1A'; ctx.fill(); line('rgba(120,50,0,0.4)');
        rrect(-r * 0.32, -r * 0.15, r * 0.64, r * 0.26, r * 0.06, '#FFFFFF', 'rgba(120,50,0,0.25)');
        break;
      }
      case 'mushroom': {
        rrect(-r * 0.28, -r * 0.1, r * 0.56, r * 0.85, r * 0.18, '#F3E4C8', 'rgba(120,90,50,0.4)');
        ctx.beginPath(); ctx.ellipse(0, -r * 0.1, r * 0.8, r * 0.55, 0, Math.PI, 0); ctx.closePath();
        ctx.fillStyle = '#E8503A'; ctx.fill(); line('rgba(120,30,20,0.4)');
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.25, r * 0.12, 0, 7);
        ctx.arc(r * 0.25, -r * 0.3, r * 0.1, 0, 7); ctx.arc(0, -r * 0.45, r * 0.09, 0, 7); ctx.fill();
        break;
      }
      case 'hydrant': {
        rrect(-r * 0.4, -r * 0.6, r * 0.8, r * 1.3, r * 0.22, '#E03A3A', 'rgba(120,20,20,0.45)');
        rrect(-r * 0.6, r * 0.05, r * 1.2, r * 0.2, r * 0.08, '#C02A2A', 'rgba(120,20,20,0.45)');
        blob(0, -r * 0.6, r * 0.22, '#E03A3A', 'rgba(120,20,20,0.45)');
        break;
      }
      case 'barrel': {
        rrect(-r * 0.55, -r * 0.7, r * 1.1, r * 1.5, r * 0.2, '#B5793F', 'rgba(80,45,20,0.5)');
        ctx.strokeStyle = '#8A5A2A'; ctx.lineWidth = lw;
        for (const yy of [-0.35, 0.05, 0.45]) { ctx.beginPath(); ctx.moveTo(-r * 0.55, yy * r); ctx.lineTo(r * 0.55, yy * r); ctx.stroke(); }
        break;
      }
      case 'bench': {
        rrect(-r * 0.85, -r * 0.5, r * 1.7, r * 0.28, r * 0.08, '#9C6B3F', 'rgba(70,40,15,0.5)');
        rrect(-r * 0.85, -r * 0.05, r * 1.7, r * 0.28, r * 0.08, '#B5793F', 'rgba(70,40,15,0.5)');
        ctx.fillStyle = '#7A5230';
        for (const xx of [-0.7, 0.55]) ctx.fillRect(xx * r, r * 0.2, r * 0.18, r * 0.55);
        break;
      }
      case 'bike': {
        blob(-r * 0.5, r * 0.35, r * 0.42, 'rgba(0,0,0,0)', '#333');
        blob(r * 0.5,  r * 0.35, r * 0.42, 'rgba(0,0,0,0)', '#333');
        ctx.strokeStyle = '#2E86C1'; ctx.lineWidth = lw * 1.2;
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, r * 0.35); ctx.lineTo(0, r * 0.35); ctx.lineTo(r * 0.2, -r * 0.3);
        ctx.lineTo(r * 0.5, r * 0.35); ctx.moveTo(0, r * 0.35); ctx.lineTo(-r * 0.15, -r * 0.3);
        ctx.lineTo(r * 0.3, -r * 0.3); ctx.stroke();
        break;
      }
      case 'tree': {
        rrect(-r * 0.14, r * 0.1, r * 0.28, r * 0.85, r * 0.05, '#8A5A33', 'rgba(60,35,15,0.5)');
        blob(-r * 0.35, -r * 0.1, r * 0.5,  '#4F9E3E');
        blob(r * 0.35,  -r * 0.1, r * 0.5,  '#4F9E3E');
        blob(0,         -r * 0.45, r * 0.58, '#62BD4C', 'rgba(30,80,20,0.4)');
        break;
      }
      case 'car': {
        rrect(-r * 0.95, -r * 0.25, r * 1.9, r * 0.75, r * 0.25, col, 'rgba(40,30,30,0.5)');
        rrect(-r * 0.5,  -r * 0.6,  r * 1.0, r * 0.5,  r * 0.18, col, 'rgba(40,30,30,0.5)');
        rrect(-r * 0.42, -r * 0.55, r * 0.84, r * 0.38, r * 0.12, '#BFE6FF', 'rgba(40,60,80,0.4)');
        blob(-r * 0.55, r * 0.5, r * 0.26, '#222');
        blob( r * 0.55, r * 0.5, r * 0.26, '#222');
        ctx.fillStyle = '#FFE08A'; ctx.beginPath(); ctx.arc(r * 0.9, r * 0.05, r * 0.12, 0, 7); ctx.fill();
        break;
      }
      case 'fountain': {
        ctx.beginPath(); ctx.ellipse(0, r * 0.35, r * 0.95, r * 0.5, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#B9BEC4'; ctx.fill(); line('rgba(70,70,80,0.5)');
        ctx.beginPath(); ctx.ellipse(0, r * 0.3, r * 0.72, r * 0.36, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#6FC3E8'; ctx.fill();
        rrect(-r * 0.16, -r * 0.5, r * 0.32, r * 0.7, r * 0.08, '#A7ACB2', 'rgba(70,70,80,0.5)');
        ctx.fillStyle = '#9BD8F0';
        ctx.beginPath(); ctx.ellipse(0, -r * 0.55, r * 0.3, r * 0.16, 0, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'bus':
      case 'truck': {
        const c = col || '#F2B705';
        if (kind === 'truck') {
          rrect(-r * 1.0,  -r * 0.45, r * 1.25, r * 0.95, r * 0.14, '#D9D2C5', 'rgba(40,30,30,0.5)');
          rrect( r * 0.25, -r * 0.45, r * 0.75, r * 0.95, r * 0.16, c,         'rgba(40,30,30,0.5)');
          rrect( r * 0.45, -r * 0.32, r * 0.5,  r * 0.4,  r * 0.1,  '#BFE6FF', 'rgba(40,60,80,0.4)');
        } else {
          rrect(-r * 1.05, -r * 0.55, r * 2.1, r * 1.1, r * 0.2, c, 'rgba(40,30,30,0.5)');
          ctx.fillStyle = '#BFE6FF';
          for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.roundRect(-r * 0.92 + i * r * 0.5, -r * 0.4, r * 0.38, r * 0.45, r * 0.06); ctx.fill(); }
        }
        blob(-r * 0.6, r * 0.55, r * 0.26, '#222');
        blob( r * 0.6, r * 0.55, r * 0.26, '#222');
        break;
      }
      case 'house': {
        rrect(-r * 0.75, -r * 0.1, r * 1.5, r * 0.85, r * 0.05, col || '#FFE0A3', 'rgba(70,50,30,0.5)');
        ctx.beginPath(); ctx.moveTo(-r * 0.9, -r * 0.05); ctx.lineTo(0, -r * 0.85); ctx.lineTo(r * 0.9, -r * 0.05); ctx.closePath();
        ctx.fillStyle = '#C0392B'; ctx.fill(); line('rgba(80,20,15,0.5)');
        rrect(-r * 0.2, r * 0.25, r * 0.4, r * 0.5, r * 0.04, '#7A5230', 'rgba(50,30,15,0.5)');
        rrect( r * 0.3, r * 0.05, r * 0.3, r * 0.3, r * 0.04, '#BFE6FF', 'rgba(40,60,80,0.4)');
        break;
      }
      case 'building': {
        rrect(-r * 0.62, -r * 0.85, r * 1.24, r * 1.7, r * 0.05, col || '#8FA3C4', 'rgba(40,45,60,0.5)');
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        for (let yy = 0; yy < 6; yy++) for (let xx = 0; xx < 3; xx++) {
          ctx.beginPath(); ctx.roundRect(-r * 0.45 + xx * r * 0.4, -r * 0.7 + yy * r * 0.27, r * 0.22, r * 0.16, r * 0.03); ctx.fill();
        }
        break;
      }
      default: blob(0, 0, r * 0.7, '#888');
    }
  }

  _drawHole(ctx, V) {
    const s = this._toScreen(this.hole.x, this.hole.y, V);
    const r = this.hole.r * V.scale * (1 + 0.02 * Math.sin(this.hole.wob * 4));
    ctx.save();
    const g = ctx.createRadialGradient(s.x, s.y, r * 0.7, s.x, s.y, r * 1.7);
    g.addColorStop(0, 'rgba(0,0,0,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, r * 1.7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6E8A48';
    ctx.beginPath(); ctx.arc(s.x, s.y, r * 1.06, 0, Math.PI * 2); ctx.fill();
    const hg = ctx.createRadialGradient(s.x, s.y - r * 0.18, r * 0.05, s.x, s.y, r);
    hg.addColorStop(0, '#000000'); hg.addColorStop(0.55, '#080510');
    hg.addColorStop(0.85, '#170E26'); hg.addColorStop(1, '#2A1C3E');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.arc(s.x, s.y, r * 0.98, 0, Math.PI * 2); ctx.clip();
    ctx.translate(s.x, s.y); ctx.rotate(this.hole.spin);
    ctx.strokeStyle = 'rgba(150,110,200,0.16)';
    for (let k = 0; k < 3; k++) {
      ctx.lineWidth = r * 0.05; ctx.beginPath();
      for (let a = 0; a < Math.PI * 3; a += 0.3) {
        const rr = r * 0.15 + a / (Math.PI * 3) * r * 0.8;
        const px = Math.cos(a + k * 2.1) * rr, py = Math.sin(a + k * 2.1) * rr;
        a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();
    ctx.lineWidth = Math.max(1.5, r * 0.07);
    ctx.strokeStyle = 'rgba(180,160,220,0.45)';
    ctx.beginPath(); ctx.arc(s.x, s.y, r * 0.95, Math.PI * 1.05, Math.PI * 1.85); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.arc(s.x, s.y, r * 0.95, Math.PI * 0.1, Math.PI * 0.8); ctx.stroke();
    if (this.eatFlash > 0) {
      ctx.globalAlpha = this.eatFlash * 3;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(s.x, s.y, r * 1.1, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  destroy() {}
}
