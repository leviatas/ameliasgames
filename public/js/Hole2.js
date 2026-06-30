// ── Hole2: "Agujero Glotón — Festín de comidas" ───────────────────────────────
// Same mechanics as Hole.js but with a restaurant / kitchen theme.
// Eat foods from tiny grapes up to giant birthday cakes.

const WORLD_W2 = 2600, WORLD_H2 = 1900;
const GAME_TIME2 = 90;
const START_R2   = 14;
const MAX_R2     = 200;

const FOOD_TYPES = [
  { kind: 'grape',       min: 6,  max: 9,  w: 16 },
  { kind: 'cherry',      min: 7,  max: 10, w: 15 },
  { kind: 'blueberry',   min: 6,  max: 9,  w: 14 },
  { kind: 'candy',       min: 8,  max: 12, w: 13 },
  { kind: 'strawberry',  min: 10, max: 14, w: 13 },
  { kind: 'apple',       min: 12, max: 17, w: 11 },
  { kind: 'donut',       min: 13, max: 18, w: 10 },
  { kind: 'cookie',      min: 12, max: 17, w: 11 },
  { kind: 'cupcake',     min: 14, max: 20, w: 9  },
  { kind: 'burger',      min: 20, max: 28, w: 8  },
  { kind: 'pizza_slice', min: 22, max: 32, w: 7  },
  { kind: 'taco',        min: 24, max: 34, w: 7  },
  { kind: 'cake_slice',  min: 28, max: 40, w: 6  },
  { kind: 'sandwich',    min: 30, max: 42, w: 5  },
  { kind: 'watermelon',  min: 40, max: 56, w: 4  },
  { kind: 'cake',        min: 60, max: 82, w: 3  },
  { kind: 'pizza',       min: 72, max: 98, w: 2  },
];

const CANDY_COLS = ['#FF4FA0', '#FF9E18', '#3ACFCF', '#9B59F5', '#56D464'];
const DONUT_COLS = ['#FF6B9D', '#A78BFA', '#34D399', '#FB923C', '#60A5FA'];
const ICING_COLS = ['#FDE68A', '#FBCFE8', '#BBF7D0', '#BFDBFE', '#FED7AA'];

function pick2(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export class Hole2 {
  constructor(canvas) {
    this.canvas = canvas;
    this.best = +(localStorage.getItem('hole2_best') || 0);
    this.reset();
  }

  reset() {
    this.t = 0;
    this.timeLeft = GAME_TIME2;
    this.score = 0;
    this.over = false;
    this.allEaten = false;
    this.eatFlash = 0;
    this.hole = { x: WORLD_W2 / 2, y: WORLD_H2 / 2, r: START_R2, wob: 0, spin: 0 };
    this.dir = { x: 0, y: 0 };
    this.touch = null;
    this.particles = [];
    this.objects = [];
    this._spawn();
  }

  _spawn() {
    const totalW = FOOD_TYPES.reduce((s, t) => s + t.w, 0);
    const pickType = () => {
      let r = Math.random() * totalW;
      for (const t of FOOD_TYPES) { if ((r -= t.w) <= 0) return t; }
      return FOOD_TYPES[0];
    };
    for (let i = 0; i < 270; i++) {
      const t = pickType();
      const size = t.min + Math.random() * (t.max - t.min);
      const x = 60 + Math.random() * (WORLD_W2 - 120);
      const y = 60 + Math.random() * (WORLD_H2 - 120);
      const d = Math.hypot(x - WORLD_W2 / 2, y - WORLD_H2 / 2);
      if (d < 220 && size > 18) { i--; continue; }
      const o = { x, y, size, kind: t.kind, falling: false, scale: 1, spin: 0, val: Math.ceil(size / 6) };
      if (t.kind === 'candy')   o.col = pick2(CANDY_COLS);
      if (t.kind === 'donut')   o.col = pick2(DONUT_COLS);
      if (t.kind === 'cupcake') o.icing = pick2(ICING_COLS);
      this.objects.push(o);
    }
  }

  // ── Camera ───────────────────────────────────────────────────────────────────
  _view() {
    const W = this.canvas.width, H = this.canvas.height;
    const viewW = 520 + this.hole.r * 6;
    const scale = W / viewW;
    return { W, H, scale };
  }
  _toScreen(wx, wy, V) {
    return { x: (wx - this.hole.x) * V.scale + V.W / 2, y: (wy - this.hole.y) * V.scale + V.H / 2 };
  }
  _toWorld(sx, sy, V) {
    return { x: (sx - V.W / 2) / V.scale + this.hole.x, y: (sy - V.H / 2) / V.scale + this.hole.y };
  }

  // ── Input ────────────────────────────────────────────────────────────────────
  pointer(sx, sy) { if (this.over) { this.reset(); return; } this.touch = { x: sx, y: sy }; }
  pointerUp() { this.touch = null; }
  setDir(x, y) { this.dir.x = x; this.dir.y = y; }

  // ── Update ───────────────────────────────────────────────────────────────────
  update(dt) {
    this.t += dt;
    this.hole.wob += dt;
    this.hole.spin += dt * 0.55;
    if (this.eatFlash > 0) this.eatFlash -= dt;

    const PCOLS = ['#FF6B9D', '#FFB347', '#56D464', '#60A5FA', '#FBBF24'];
    for (const p of this.particles) {
      p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt;
    }
    this.particles = this.particles.filter(p => p.life < p.max);

    if (this.over) return;

    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0; this.over = true; this.allEaten = false;
      if (this.score > this.best) { this.best = this.score; localStorage.setItem('hole2_best', this.best); }
      return;
    }

    let mx = 0, my = 0;
    if (this.touch) {
      const V = this._view();
      const w = this._toWorld(this.touch.x, this.touch.y, V);
      mx = w.x - this.hole.x; my = w.y - this.hole.y;
    } else { mx = this.dir.x; my = this.dir.y; }
    const len = Math.hypot(mx, my);
    if (len > 0.5) {
      const speed = 220 + 55 / (1 + this.hole.r / 40);
      this.hole.x += (mx / len) * speed * dt;
      this.hole.y += (my / len) * speed * dt;
    }
    this.hole.x = Math.max(this.hole.r, Math.min(WORLD_W2 - this.hole.r, this.hole.x));
    this.hole.y = Math.max(this.hole.r, Math.min(WORLD_H2 - this.hole.r, this.hole.y));

    if (this.objects.length > 0 && this.objects.every(o => o.eaten)) {
      this.timeLeft = 0; this.over = true; this.allEaten = true;
      if (this.score > this.best) { this.best = this.score; localStorage.setItem('hole2_best', this.best); }
      return;
    }

    for (const o of this.objects) {
      if (o.eaten) continue;
      const dx = this.hole.x - o.x, dy = this.hole.y - o.y;
      const d = Math.hypot(dx, dy);
      const eatable = o.size <= this.hole.r * 1.02;
      if (o.falling) {
        o.x += dx * Math.min(dt * 10, 1);
        o.y += dy * Math.min(dt * 10, 1);
        o.scale -= dt * 2.6; o.spin += dt * 12;
        if (o.scale <= 0.06) this._consume(o, PCOLS);
      } else if (eatable && d < this.hole.r) {
        o.falling = true;
      } else if (eatable && d < this.hole.r * 2.1) {
        const pull = (1 - d / (this.hole.r * 2.1)) * dt * 3.2;
        o.x += dx * pull; o.y += dy * pull;
      }
    }
  }

  _consume(o, PCOLS) {
    o.eaten = true;
    this.score += o.val;
    this.eatFlash = 0.18;
    this.hole.r = Math.min(MAX_R2, this.hole.r + o.size * 0.055);
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2, sp = 50 + Math.random() * 130;
      this.particles.push({
        x: this.hole.x, y: this.hole.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 90,
        col: pick2(PCOLS),
        life: 0, max: 0.4 + Math.random() * 0.35, size: 2.5 + Math.random() * 3.5,
      });
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  render(ctx) {
    const V = this._view(), { W, H, scale } = V;

    // ── Kitchen floor ───────────────────────────────────────────────────────
    ctx.fillStyle = '#FFF8F0'; ctx.fillRect(0, 0, W, H);
    const tile = 100 * scale;
    const ox = ((-this.hole.x * scale + W / 2) % tile + tile) % tile;
    const oy = ((-this.hole.y * scale + H / 2) % tile + tile) % tile;
    for (let y = oy - tile; y < H; y += tile) {
      for (let x = ox - tile; x < W; x += tile) {
        const gx = Math.round((x - ox) / tile), gy = Math.round((y - oy) / tile);
        if ((gx + gy) % 2 === 0) {
          ctx.fillStyle = '#FDEBD0';
          ctx.fillRect(x, y, tile, tile);
        }
      }
    }
    // grout lines
    ctx.strokeStyle = 'rgba(200,170,140,0.35)'; ctx.lineWidth = 1;
    for (let x = ox - tile; x < W; x += tile) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = oy - tile; y < H; y += tile) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // world border
    const tl = this._toScreen(0, 0, V), br = this._toScreen(WORLD_W2, WORLD_H2, V);
    ctx.strokeStyle = 'rgba(200,140,80,0.55)'; ctx.lineWidth = 6;
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

    // particles
    for (const p of this.particles) {
      const s = this._toScreen(p.x, p.y, V);
      ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
      ctx.fillStyle = p.col || '#FF6B9D';
      ctx.beginPath(); ctx.arc(s.x, s.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    this._drawHUD(ctx, V);
  }

  _drawObj(ctx, o, V) {
    const s = this._toScreen(o.x, o.y, V);
    const r = o.size * V.scale * o.scale;
    if (r < 1.2) return;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(s.x, s.y + r * 0.9, r * 0.8, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(s.x, s.y);
    if (o.falling) { ctx.rotate(o.spin); ctx.globalAlpha = Math.max(0, Math.min(1, o.scale + 0.15)); }
    this._drawFood(ctx, o, r);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  _drawFood(ctx, o, r) {
    const { kind, col, icing } = o;
    const lw = Math.max(0.8, r * 0.08);
    const stroke = (c) => { ctx.lineWidth = lw; ctx.strokeStyle = c || 'rgba(60,30,10,0.45)'; ctx.stroke(); };
    const blob = (x, y, rad, fill, sc) => {
      ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fillStyle = fill; ctx.fill(); if (sc !== false) stroke(sc);
    };
    const rrect = (x, y, w, h, rad, fill, sc) => {
      ctx.beginPath(); ctx.roundRect(x, y, w, h, rad);
      ctx.fillStyle = fill; ctx.fill(); if (sc !== false) stroke(sc);
    };
    ctx.lineJoin = 'round';

    switch (kind) {

      case 'grape': {
        // cluster of 5 grapes
        const gc = '#9B59F5';
        const gd = '#7D3FC8';
        blob(-r*0.38, r*0.15, r*0.38, gc, gd);
        blob(r*0.38,  r*0.15, r*0.38, gc, gd);
        blob(0,       r*0.32, r*0.38, gc, gd);
        blob(-r*0.2, -r*0.22, r*0.36, gc, gd);
        blob(r*0.2,  -r*0.22, r*0.36, gc, gd);
        // stem
        ctx.strokeStyle = '#5A8A3A'; ctx.lineWidth = lw * 1.1;
        ctx.beginPath(); ctx.moveTo(0, -r*0.55); ctx.quadraticCurveTo(r*0.22, -r*0.75, r*0.3, -r*0.88); ctx.stroke();
        // shine on each
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        for (const [bx, by] of [[-r*.38, r*.15],[r*.38, r*.15],[0, r*.32],[-r*.2,-r*.22],[r*.2,-r*.22]]) {
          ctx.beginPath(); ctx.arc(bx - r*0.12, by - r*0.12, r*0.1, 0, Math.PI*2); ctx.fill();
        }
        break;
      }

      case 'cherry': {
        blob(-r*0.3, r*0.15, r*0.45, '#E8253A', '#8B1020');
        blob( r*0.3, r*0.15, r*0.45, '#E8253A', '#8B1020');
        ctx.strokeStyle = '#3C8A3C'; ctx.lineWidth = lw * 1.2;
        ctx.beginPath();
        ctx.moveTo(-r*0.3, -r*0.28); ctx.quadraticCurveTo(0, -r*0.9, r*0.3, -r*0.28); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.beginPath(); ctx.arc(-r*0.42, r*0.04, r*0.12, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(r*0.18, r*0.04, r*0.12, 0, Math.PI*2); ctx.fill();
        break;
      }

      case 'blueberry': {
        blob(0, 0, r*0.82, '#3A60C8', '#1A2E80');
        // crown at top
        ctx.strokeStyle = '#1A2E80'; ctx.lineWidth = lw;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI/2 + (i/5)*Math.PI*2;
          ctx.moveTo(0, -r*0.55);
          ctx.lineTo(Math.cos(a)*r*0.28, -r*0.55 + Math.sin(a)*r*0.18);
        }
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath(); ctx.arc(-r*0.22, -r*0.22, r*0.18, 0, Math.PI*2); ctx.fill();
        break;
      }

      case 'candy': {
        // lollipop
        ctx.strokeStyle = '#888'; ctx.lineWidth = lw * 0.9;
        ctx.beginPath(); ctx.moveTo(0, r*0.3); ctx.lineTo(0, r); ctx.stroke();
        blob(0, -r*0.08, r*0.65, col || '#FF4FA0', 'rgba(140,20,60,0.4)');
        // spiral stripe
        ctx.save(); ctx.beginPath(); ctx.arc(0,-r*0.08,r*0.65,0,Math.PI*2); ctx.clip();
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = r*0.18;
        ctx.beginPath();
        for (let a = 0; a < Math.PI*4; a += 0.3) {
          const rr = r*0.05 + a/(Math.PI*4)*r*0.6;
          a===0 ? ctx.moveTo(Math.cos(a)*rr, -r*0.08+Math.sin(a)*rr)
                : ctx.lineTo(Math.cos(a)*rr, -r*0.08+Math.sin(a)*rr);
        }
        ctx.stroke();
        ctx.restore();
        break;
      }

      case 'strawberry': {
        // body
        ctx.beginPath();
        ctx.moveTo(0, r*0.9);
        ctx.bezierCurveTo(-r*0.8, r*0.3, -r*0.8, -r*0.3, 0, -r*0.4);
        ctx.bezierCurveTo(r*0.8, -r*0.3, r*0.8, r*0.3, 0, r*0.9);
        ctx.fillStyle = '#E8253A'; ctx.fill(); stroke('#8B1020');
        // seeds
        ctx.fillStyle = '#FFFADE';
        for (const [sx2, sy2] of [[-r*.22, r*.1],[r*.22, r*.1],[0, r*.45],[-r*.3, r*.5],[r*.3, r*.5],[0, r*.05]]) {
          ctx.beginPath(); ctx.ellipse(sx2, sy2, r*0.045, r*0.07, -0.4, 0, Math.PI*2); ctx.fill();
        }
        // leaves
        ctx.fillStyle = '#4CAF50';
        for (let i = 0; i < 3; i++) {
          const a = -Math.PI/2 + (i-1)*0.45;
          ctx.beginPath();
          ctx.moveTo(0,-r*0.4);
          ctx.quadraticCurveTo(Math.cos(a)*r*0.55, -r*0.4+Math.sin(a)*r*0.45, Math.cos(a)*r*0.42, -r*0.4+Math.sin(a)*r*0.65);
          ctx.quadraticCurveTo(0, -r*0.55, 0, -r*0.4);
          ctx.fill();
        }
        break;
      }

      case 'apple': {
        blob(0, r*0.05, r*0.82, '#E8253A', '#8B1020');
        // indent at top
        ctx.fillStyle = '#C01828';
        ctx.beginPath(); ctx.arc(0, -r*0.72, r*0.14, 0, Math.PI*2); ctx.fill();
        // stem & leaf
        ctx.strokeStyle = '#5A3A1A'; ctx.lineWidth = lw;
        ctx.beginPath(); ctx.moveTo(0, -r*0.72); ctx.lineTo(0, -r*1.02); ctx.stroke();
        ctx.fillStyle = '#4CAF50';
        ctx.beginPath(); ctx.moveTo(0,-r*0.88); ctx.quadraticCurveTo(r*0.45,-r*0.92,r*0.3,-r*0.72); ctx.quadraticCurveTo(r*0.18,-r*0.82,0,-r*0.88); ctx.fill();
        ctx.fillStyle='rgba(255,255,255,0.35)';
        ctx.beginPath(); ctx.ellipse(-r*0.24, -r*0.1, r*0.12, r*0.28, -0.5, 0, Math.PI*2); ctx.fill();
        break;
      }

      case 'donut': {
        // outer ring
        blob(0, 0, r*0.9, col || '#FF6B9D', 'rgba(140,20,60,0.4)');
        // hole
        ctx.fillStyle = '#FFF8F0'; ctx.beginPath(); ctx.arc(0,0,r*0.4,0,Math.PI*2); ctx.fill();
        // icing drips
        ctx.fillStyle = icing || '#FDEBD0';
        ctx.beginPath(); ctx.arc(0, 0, r*0.82, -Math.PI*0.6, -Math.PI*0.1); ctx.arc(0,0,r*0.46,Math.PI*(-0.1),Math.PI*(-0.6),true); ctx.closePath(); ctx.fill();
        // sprinkles
        const spCols = ['#FF4FA0','#3ACFCF','#FBBF24','#9B59F5','#56D464'];
        for (let i = 0; i < 8; i++) {
          const a = i/8*Math.PI*2, rad = r*(0.5+Math.random()*0.28);
          ctx.save(); ctx.translate(Math.cos(a)*rad, Math.sin(a)*rad); ctx.rotate(a+1);
          ctx.fillStyle = spCols[i%5];
          ctx.beginPath(); ctx.roundRect(-r*0.06,-r*0.02,r*0.12,r*0.04,r*0.02); ctx.fill();
          ctx.restore();
        }
        break;
      }

      case 'cookie': {
        blob(0, 0, r*0.88, '#C8843A', 'rgba(80,40,10,0.5)');
        blob(0, 0, r*0.72, '#D4924A', false);
        ctx.fillStyle = '#5A3010';
        for (const [cx2, cy2, cr] of [[-r*.35,-r*.2,r*.1],[r*.28,-r*.3,r*.08],[0,r*.3,r*.1],[-r*.15,r*.1,r*.09],[r*.35,r*.15,r*.09],[r*.05,-r*.45,r*.08]]) {
          ctx.beginPath(); ctx.arc(cx2,cy2,cr,0,Math.PI*2); ctx.fill();
        }
        break;
      }

      case 'cupcake': {
        // wrapper
        rrect(-r*0.6, r*0.1, r*1.2, r*0.75, [r*0.05, r*0.05, r*0.25, r*0.25], '#F5A623', 'rgba(140,70,10,0.5)');
        // stripes on wrapper
        ctx.strokeStyle='rgba(200,120,20,0.4)'; ctx.lineWidth=lw*0.7;
        for(const xx of [-r*.3,0,r*.3]){ ctx.beginPath(); ctx.moveTo(xx,r*.1); ctx.lineTo(xx,r*.85); ctx.stroke(); }
        // cake body
        blob(0, r*0.0, r*0.65, '#FDEBD0', 'rgba(140,90,40,0.4)');
        // frosting peak
        const icC = icing || pick2(ICING_COLS);
        ctx.fillStyle = icC;
        ctx.beginPath();
        ctx.moveTo(-r*0.62, r*0.02);
        ctx.quadraticCurveTo(-r*0.5, -r*0.5, 0, -r*0.82);
        ctx.quadraticCurveTo(r*0.5, -r*0.5, r*0.62, r*0.02);
        ctx.closePath(); ctx.fill(); stroke('rgba(160,80,40,0.3)');
        // cherry on top
        blob(0, -r*0.88, r*0.16, '#E8253A', false);
        break;
      }

      case 'burger': {
        // bottom bun
        rrect(-r*0.82, r*0.38, r*1.64, r*0.48, [r*0.08, r*0.08, r*0.28, r*0.28], '#C8843A', 'rgba(80,40,10,0.5)');
        // patty
        rrect(-r*0.82, r*0.06, r*1.64, r*0.34, r*0.08, '#7A3A18', 'rgba(40,15,5,0.6)');
        // cheese
        rrect(-r*0.88, -r*0.08, r*1.76, r*0.22, r*0.04, '#F5C842', 'rgba(160,100,10,0.4)');
        // lettuce
        ctx.fillStyle = '#5DB85D';
        ctx.beginPath(); ctx.moveTo(-r*0.9,r*0.0);
        for(let i=0;i<=8;i++) ctx.lineTo(-r*0.9+i*r*0.225, r*0.0 - (i%2===0?0:r*0.14));
        ctx.lineTo(r*0.9, r*0.0); ctx.lineTo(r*0.82, -r*0.08); ctx.lineTo(-r*0.82,-r*0.08); ctx.closePath(); ctx.fill();
        // top bun
        ctx.fillStyle = '#D4924A';
        ctx.beginPath(); ctx.ellipse(0, -r*0.3, r*0.88, r*0.48, 0, Math.PI, 0); ctx.fill();
        stroke('rgba(80,40,10,0.5)');
        // sesame seeds
        ctx.fillStyle = '#FDE68A';
        for(const [sx2,sy2] of [[-r*.3,-r*.52],[0,-r*.7],[r*.32,-r*.52],[r*.5,-r*.35],[-r*.5,-r*.35]]) {
          ctx.save(); ctx.translate(sx2,sy2); ctx.rotate(Math.random()*0.6-0.3);
          ctx.beginPath(); ctx.ellipse(0,0,r*0.05,r*0.09,0,0,Math.PI*2); ctx.fill();
          ctx.restore();
        }
        break;
      }

      case 'pizza_slice': {
        ctx.beginPath(); ctx.moveTo(0,-r*0.92); ctx.lineTo(-r*0.82,r*0.78); ctx.lineTo(r*0.82,r*0.78); ctx.closePath();
        ctx.fillStyle = '#F5C842'; ctx.fill(); stroke('rgba(140,80,10,0.5)');
        // crust
        ctx.beginPath(); ctx.moveTo(-r*0.82,r*0.78); ctx.quadraticCurveTo(0,r*1.05,r*0.82,r*0.78);
        ctx.lineWidth=r*0.22; ctx.strokeStyle='#D4924A'; ctx.stroke();
        // sauce
        ctx.beginPath(); ctx.moveTo(0,-r*0.78); ctx.lineTo(-r*0.65,r*0.62); ctx.lineTo(r*0.65,r*0.62); ctx.closePath();
        ctx.fillStyle='#E83A2A'; ctx.fill();
        // cheese
        ctx.fillStyle='#F5E642';
        const topping_polys=[[-r*.12,-r*.55,r*.25,-r*.3],[r*.15,-r*.5,-r*.2,-r*.1],[0,r*.1,r*.28,r*.42],[-r*.22,r*.2,-r*.05,r*.48]];
        for(const [ax,ay,bx,by] of topping_polys){ ctx.beginPath(); ctx.ellipse((ax+bx)/2,(ay+by)/2,r*0.18,r*0.11,-0.5,0,Math.PI*2); ctx.fill(); }
        // pepperoni
        ctx.fillStyle='#C0392B';
        for(const [px,py] of [[-r*.08,-r*.35],[r*.2,-r*.18],[-.18,r*.18],[r*.02,r*.38]]) blob(px,py,r*0.1,'#C0392B',false);
        break;
      }

      case 'taco': {
        // shell
        ctx.fillStyle = '#E8B84B';
        ctx.beginPath(); ctx.arc(0, r*0.15, r*0.9, Math.PI*1.08, Math.PI*1.92); ctx.fill();
        ctx.beginPath(); ctx.arc(0, r*0.15, r*0.9, Math.PI*1.08, Math.PI*1.92);
        ctx.lineWidth=r*0.09; ctx.strokeStyle='#C8843A'; ctx.stroke();
        // fillings
        ctx.fillStyle='#5DB85D';
        ctx.beginPath(); ctx.ellipse(0,-r*0.12,r*0.6,r*0.22,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#E83A2A';
        ctx.beginPath(); ctx.ellipse(-r*0.18,-r*0.04,r*0.28,r*0.16,0.3,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(r*0.22,-r*0.04,r*0.28,r*0.16,-0.3,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#F5E642';
        ctx.beginPath(); ctx.ellipse(0,-r*0.2,r*0.35,r*0.14,0,0,Math.PI*2); ctx.fill();
        break;
      }

      case 'cake_slice': {
        // side face
        ctx.beginPath(); ctx.moveTo(-r*0.7,r*0.82); ctx.lineTo(-r*0.7,-r*0.32); ctx.lineTo(0,-r*0.82); ctx.lineTo(r*0.7,-r*0.32); ctx.lineTo(r*0.7,r*0.82); ctx.closePath();
        ctx.fillStyle='#FDEBD0'; ctx.fill(); stroke('rgba(140,80,40,0.4)');
        // layers
        for(const [ly, lc] of [[0.1,'#FF8FAB'],[-r*.0,'#FDEBD0'],[-r*.28,'#FF8FAB']]) {
          ctx.fillStyle=lc; ctx.fillRect(-r*0.7,ly,r*1.4,r*0.22);
        }
        // top frosting
        ctx.fillStyle='#FFF0F6';
        ctx.beginPath(); ctx.moveTo(-r*0.7,-r*0.32); ctx.lineTo(0,-r*0.82); ctx.lineTo(r*0.7,-r*0.32); ctx.closePath(); ctx.fill();
        // drip
        ctx.fillStyle='#FFB8D0';
        ctx.beginPath(); ctx.roundRect(-r*0.12,-r*0.4,r*0.25,r*0.28,r*0.08); ctx.fill();
        break;
      }

      case 'sandwich': {
        rrect(-r*0.88,-r*0.9,r*1.76,r*0.38,[r*0.18,r*0.18,r*0.04,r*0.04],'#D4924A','rgba(80,40,10,0.5)');
        rrect(-r*0.88,-r*0.52,r*1.76,r*0.22,r*0.04,'#FDE68A','rgba(160,100,10,0.4)');
        rrect(-r*0.88,-r*0.3,r*1.76,r*0.22,r*0.04,'#4CAF50','rgba(20,80,20,0.4)');
        rrect(-r*0.88,-r*0.08,r*1.76,r*0.24,r*0.04,'#E8503A','rgba(120,20,10,0.4)');
        rrect(-r*0.88,r*0.16,r*1.76,r*0.24,r*0.04,'#F5E0C8','rgba(120,80,40,0.4)');
        rrect(-r*0.88,r*0.4,r*1.76,r*0.42,[r*0.04,r*0.04,r*0.2,r*0.2],'#D4924A','rgba(80,40,10,0.5)');
        break;
      }

      case 'watermelon': {
        // green rind
        ctx.beginPath(); ctx.arc(0,0,r*0.95,Math.PI,0); ctx.closePath();
        ctx.fillStyle='#4CAF50'; ctx.fill(); stroke('rgba(20,80,20,0.5)');
        // white layer
        ctx.beginPath(); ctx.arc(0,0,r*0.85,Math.PI,0); ctx.closePath();
        ctx.fillStyle='#E8F5E9'; ctx.fill();
        // red flesh
        ctx.beginPath(); ctx.arc(0,0,r*0.74,Math.PI,0); ctx.closePath();
        ctx.fillStyle='#E8403A'; ctx.fill();
        // seeds
        ctx.fillStyle='#1A1A1A';
        for(const [sx2,sy2] of [[-r*.5,-r*.3],[-r*.25,-r*.5],[r*.25,-r*.5],[r*.5,-r*.3],[0,-r*.32],[-r*.1,-r*.6],[r*.1,-r*.6]]) {
          ctx.save(); ctx.translate(sx2,sy2); ctx.rotate(Math.random()*0.8-0.4);
          ctx.beginPath(); ctx.ellipse(0,0,r*0.04,r*0.07,0,0,Math.PI*2); ctx.fill();
          ctx.restore();
        }
        // stripes on rind
        ctx.strokeStyle='#388E3C'; ctx.lineWidth=lw*0.8;
        for(const a of [-1.1,-1.4,-1.7,Math.PI+1.1,Math.PI+1.4,Math.PI+1.7]) {
          ctx.beginPath(); ctx.moveTo(Math.cos(a)*r*0.74,Math.sin(a)*r*0.74); ctx.lineTo(Math.cos(a)*r*0.95,Math.sin(a)*r*0.95); ctx.stroke();
        }
        break;
      }

      case 'cake': {
        // bottom tier
        rrect(-r*0.88,r*0.12,r*1.76,r*0.72,[r*0.06,r*0.06,r*0.2,r*0.2],'#FDEBD0','rgba(140,80,40,0.45)');
        // layer lines bottom
        ctx.strokeStyle='#FFB8D0'; ctx.lineWidth=r*0.1;
        ctx.beginPath(); ctx.moveTo(-r*0.88,r*0.42); ctx.lineTo(r*0.88,r*0.42); ctx.stroke();
        // top tier
        rrect(-r*0.55,-r*0.5,r*1.1,r*0.65,[r*0.06,r*0.06,r*0.14,r*0.14],'#FFF0F6','rgba(140,80,40,0.35)');
        ctx.strokeStyle='#FFB8D0'; ctx.lineWidth=r*0.08;
        ctx.beginPath(); ctx.moveTo(-r*0.55,-r*0.2); ctx.lineTo(r*0.55,-r*0.2); ctx.stroke();
        // frosting drips
        ctx.fillStyle='#FFB8D0';
        for(const bx of [-r*0.6,-r*0.22,r*0.18,r*0.55]) {
          ctx.beginPath(); ctx.roundRect(bx,-r*0.55,r*0.25,r*0.2,r*0.06); ctx.fill();
        }
        // candles
        const candleCols=['#FF4FA0','#FBBF24','#3ACFCF','#9B59F5'];
        for(let i=0;i<4;i++) {
          const cx2=-r*0.35+i*r*0.22;
          rrect(cx2-r*0.05,-r*0.88,r*0.1,r*0.38,r*0.03,candleCols[i],false);
          // flame
          ctx.fillStyle='#FFA500';
          ctx.beginPath(); ctx.ellipse(cx2,-r*0.94,r*0.06,r*0.1,0,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='#FFE000';
          ctx.beginPath(); ctx.ellipse(cx2,-r*0.95,r*0.03,r*0.06,0,0,Math.PI*2); ctx.fill();
        }
        // decorative dots on bottom tier
        ctx.fillStyle='#FF6B9D';
        for(const [dx,dy] of [[-r*.6,r*.55],[r*.6,r*.55],[-r*.35,r*.7],[r*.35,r*.7],[0,r*.72]]) {
          ctx.beginPath(); ctx.arc(dx,dy,r*0.06,0,Math.PI*2); ctx.fill();
        }
        break;
      }

      case 'pizza': {
        blob(0, 0, r*0.92, '#F5C842', 'rgba(140,80,10,0.5)');
        // crust ring
        blob(0, 0, r*0.92, 'rgba(0,0,0,0)', '#D4924A');
        ctx.lineWidth=r*0.16; ctx.strokeStyle='#D4924A';
        ctx.beginPath(); ctx.arc(0,0,r*0.82,0,Math.PI*2); ctx.stroke();
        // sauce
        blob(0, 0, r*0.72, '#E83A2A', false);
        // cheese
        ctx.fillStyle='#F5E642';
        for(const [cx2,cy2,cwr,chr,ca] of [[0,-r*.35,r*.42,r*.28,0.3],[-r*.38,r*.25,r*.35,r*.25,-0.5],[r*.32,r*.28,r*.38,r*.26,0.4],[0,r*.5,r*.3,r*.22,0]]) {
          ctx.beginPath(); ctx.ellipse(cx2,cy2,cwr,chr,ca,0,Math.PI*2); ctx.fill();
        }
        // pepperoni
        ctx.fillStyle='#C0392B';
        for(const [px,py] of [[-r*.4,-r*.15],[r*.38,-r*.2],[-r*.1,r*.42],[r*.15,r*.42],[-r*.5,r*.35],[r*.48,r*.28],[0,-r*.55]]) blob(px,py,r*0.12,'#C0392B',false);
        // slice lines
        ctx.strokeStyle='rgba(140,80,10,0.3)'; ctx.lineWidth=lw*0.7;
        for(let i=0;i<6;i++) {
          const a=i/6*Math.PI*2;
          ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(a)*r*0.92,Math.sin(a)*r*0.92); ctx.stroke();
        }
        break;
      }

      default:
        ctx.beginPath(); ctx.arc(0,0,r*0.7,0,Math.PI*2); ctx.fillStyle='#FF6B9D'; ctx.fill();
    }
  }

  _drawHole(ctx, V) {
    const s = this._toScreen(this.hole.x, this.hole.y, V);
    const r = this.hole.r * V.scale * (1 + 0.02 * Math.sin(this.hole.wob * 4));
    ctx.save();

    // pull shadow
    const g = ctx.createRadialGradient(s.x, s.y, r * 0.7, s.x, s.y, r * 1.7);
    g.addColorStop(0, 'rgba(0,0,0,0.32)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, r * 1.7, 0, Math.PI * 2); ctx.fill();

    // edge ring — warm brown like a bite hole in food
    ctx.fillStyle = '#8B5230';
    ctx.beginPath(); ctx.arc(s.x, s.y, r * 1.06, 0, Math.PI * 2); ctx.fill();

    // the void
    const hg = ctx.createRadialGradient(s.x, s.y - r * 0.18, r * 0.05, s.x, s.y, r);
    hg.addColorStop(0, '#000000');
    hg.addColorStop(0.55, '#0A0508');
    hg.addColorStop(0.85, '#1A0A10');
    hg.addColorStop(1, '#2A1018');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); ctx.fill();

    // swirl — pink/candy tones
    ctx.save();
    ctx.beginPath(); ctx.arc(s.x, s.y, r * 0.98, 0, Math.PI * 2); ctx.clip();
    ctx.translate(s.x, s.y); ctx.rotate(this.hole.spin);
    ctx.strokeStyle = 'rgba(255,140,180,0.18)';
    for (let k = 0; k < 3; k++) {
      ctx.lineWidth = r * 0.05;
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 3; a += 0.3) {
        const rr = r * 0.15 + a / (Math.PI * 3) * r * 0.8;
        const px = Math.cos(a + k * 2.1) * rr, py = Math.sin(a + k * 2.1) * rr;
        a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();

    // rim highlight
    ctx.lineWidth = Math.max(1.5, r * 0.07);
    ctx.strokeStyle = 'rgba(255,180,140,0.4)';
    ctx.beginPath(); ctx.arc(s.x, s.y, r * 0.95, Math.PI * 1.05, Math.PI * 1.85); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.arc(s.x, s.y, r * 0.95, Math.PI * 0.1, Math.PI * 0.8); ctx.stroke();

    if (this.eatFlash > 0) {
      ctx.globalAlpha = this.eatFlash * 3;
      ctx.strokeStyle = '#FFB347'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(s.x, s.y, r * 1.1, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  _drawHUD(ctx, V) {
    const { W, H } = V;
    const s = Math.max(0.7, Math.min(W, H) / 720);

    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#7A3A10'; ctx.font = `900 ${30 * s}px system-ui, sans-serif`;
    ctx.fillText(`🍕 ${this.score}`, 18 * s, 42 * s);
    ctx.fillStyle = '#A05030'; ctx.font = `bold ${15 * s}px system-ui, sans-serif`;
    ctx.fillText(`Mejor: ${this.best}`, 18 * s, 64 * s);

    const danger = this.timeLeft <= 10;
    ctx.textAlign = 'center';
    ctx.fillStyle = danger ? '#D7263D' : '#7A3A10';
    ctx.font = `900 ${34 * s}px system-ui, sans-serif`;
    ctx.fillText(`${Math.ceil(this.timeLeft)}`, W / 2, 44 * s);

    if (this.over) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff'; ctx.font = `900 ${56 * s}px system-ui, sans-serif`;
      ctx.fillText(this.allEaten ? '¡Todo comido! 🍕' : '¡Se acabó la comida!', W / 2, H * 0.4);
      ctx.font = `bold ${30 * s}px system-ui, sans-serif`;
      ctx.fillText(`Puntaje: ${this.score}`, W / 2, H * 0.52);
      ctx.font = `bold ${20 * s}px system-ui, sans-serif`;
      ctx.fillStyle = '#FFD23F';
      ctx.fillText('Tocá para jugar de nuevo', W / 2, H * 0.62);
    }
  }

  destroy() {}
}
