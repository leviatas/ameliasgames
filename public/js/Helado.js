// ── Ice-cream shop mini-game: "Heladería de Labubu" ─────────────────────────
// A customer asks for an ice-cream with scoops of certain colours (flavours)
// and sometimes a topping. Pick a colour, add scoops to the cone (or tap a
// scoop to repaint it), pick a topping, match the order before the customer's
// patience runs out, and serve it. Relaxed & endless; orders grow as you go.
//
// Art: scoops / cone / cherries / toppings / customers are illustrated PNGs
// (public/assets/icecream/) instead of hand-drawn vectors, for a richer look.
// Vector fallbacks are kept in case an image hasn't finished loading yet.

import { Sound }    from './Sound.js';
import { addCoins } from './Wallet.js';

const ASSET = (name) => `/assets/icecream/${name}.png`;
function loadImg(name) { const im = new Image(); im.src = ASSET(name); return im; }
function ready(img) { return img && img.complete && img.naturalWidth > 0; }

const FLAVORS = [
  { c: '#FF7EB3', name: 'Frutilla',  img: loadImg('scoop_frutilla')  },
  { c: '#F6E08A', name: 'Vainilla',  img: loadImg('scoop_vainilla')  },
  { c: '#8A5A3B', name: 'Chocolate', img: loadImg('scoop_chocolate') },
  { c: '#8FE3C2', name: 'Menta',     img: loadImg('scoop_menta')     },
  { c: '#7FA7F0', name: 'Arándano',  img: loadImg('scoop_arandano')  },
  { c: '#FF9F45', name: 'Naranja',   img: loadImg('scoop_naranja')   },
];
const TOPPINGS = [
  { key: 'none',       name: 'Sin topping' },
  { key: 'sprinkles',  name: 'Chips',       img: loadImg('sprinkles')   },
  { key: 'syrup',      name: 'Salsa',       img: loadImg('syrup')      },
  { key: 'wafer',      name: 'Barquillo',   img: loadImg('wafersticks') },
  { key: 'marshmallow',name: 'Merengues',   img: loadImg('marshmallow') },
];
const CONE_IMG    = loadImg('cone');
const CHERRY_IMG  = loadImg('cherries');
const CUSTOMER_IMGS = [loadImg('customer1'), loadImg('customer2'), loadImg('customer3'), loadImg('customer4')];

const MAX_SCOOPS = 5;

export class Helado {
  constructor(canvas) {
    this.canvas = canvas;
    this.best = +(localStorage.getItem('helado_best') || 0);
    this.reset();
  }

  reset() {
    this.t = 0;
    this.score = 0;
    this.served = 0;
    this.missed = 0;
    this.active = null;        // selected flavour index
    this.topping = 0;          // currently-applied topping index (0 = none)
    this.scoops = [];          // built scoops (flavour indices), bottom-up
    this.order = [];           // requested flavours, bottom-up
    this.orderTopping = 0;
    this.result = 0;           // >0 success anim, <0 fail shake
    this.resultMsg = '';
    this.pendingNew = false;
    this.custSeed = 0;
    this.timeLeft = 0;
    this.maxTime = 1;
    this.particles = [];
    this.newOrder();
  }

  newOrder() {
    const n = Math.min(4, 1 + Math.floor(this.served / 3));
    this.order = Array.from({ length: n }, () => Math.floor(Math.random() * FLAVORS.length));
    this.orderTopping = this.served >= 2 && Math.random() < 0.55
      ? 1 + Math.floor(Math.random() * (TOPPINGS.length - 1)) : 0;
    this.scoops = [];
    this.topping = 0;
    this.active = null;
    this.custSeed = Math.floor(Math.random() * 1000);
    this.maxTime = 13 + n * 4 + (this.orderTopping ? 3 : 0);
    this.timeLeft = this.maxTime;
  }

  // ── Layout (recomputed each frame; resolution independent) ──────────────────
  _layout() {
    const W = this.canvas.width, H = this.canvas.height;
    const s = Math.max(0.5, Math.min(1.0, Math.min(W, H) / 720));

    const scoopR = 40 * s;
    const cone = { x: W * 0.28, baseY: H * 0.63, scoopR };

    // flavour swatches along the bottom
    const pr = 30 * s, gap = pr * 2.7;
    const total = (FLAVORS.length - 1) * gap;
    const px0 = W / 2 - total / 2, py = H - 56 * s;
    const palette = FLAVORS.map((f, i) => ({ x: px0 + i * gap, y: py, r: pr, i }));

    // topping swatches, smaller row just above the flavour row
    const tr = 24 * s, tgap = tr * 2.5;
    const ttotal = (TOPPINGS.length - 1) * tgap;
    const tx0 = W / 2 - ttotal / 2, tpy = py - 80 * s;
    const toppingPalette = TOPPINGS.map((t, i) => ({ x: tx0 + i * tgap, y: tpy, r: tr, i }));

    // buttons
    const bx = cone.x + scoopR + 40 * s, bw = 128 * s, bh = 52 * s;
    const add  = { x: bx, y: cone.baseY - 96 * s, w: bw, h: bh, label: '➕ Bocha' };
    const undo = { x: bx, y: cone.baseY - 36 * s, w: bw, h: bh, label: '↩ Deshacer' };
    const serve = { x: W - 184 * s, y: H * 0.40, w: 160 * s, h: 78 * s, label: 'SERVIR' };

    const cust = { x: W * 0.16, y: H * 0.68, s };
    const bubble = { x: W * 0.16, y: H * 0.24, s };

    return { W, H, s, cone, palette, toppingPalette, add, undo, serve, cust, bubble };
  }

  _scoopCenters(cone, n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push({ x: cone.x, y: cone.baseY - cone.scoopR * 0.55 - i * cone.scoopR * 1.0, r: cone.scoopR });
    }
    return out;
  }

  _inRect(px, py, r) { return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h; }

  // ── Input ──────────────────────────────────────────────────────────────────
  pointer(px, py) {
    if (this.result > 0) return;            // wait out the success animation
    const L = this._layout();

    // topping palette → set the topping directly (single decorative layer)
    for (const tp of L.toppingPalette) {
      if (Math.hypot(px - tp.x, py - tp.y) <= tp.r * 1.2) { this.topping = tp.i; Sound.pick(); return; }
    }
    // flavour palette → select active flavour
    for (const p of L.palette) {
      if (Math.hypot(px - p.x, py - p.y) <= p.r * 1.15) { this.active = p.i; Sound.pick(); return; }
    }
    // tap a built scoop → repaint with active flavour
    const centers = this._scoopCenters(L.cone, this.scoops.length);
    for (let i = 0; i < centers.length; i++) {
      if (Math.hypot(px - centers[i].x, py - centers[i].y) <= centers[i].r) {
        if (this.active != null) { this.scoops[i] = this.active; Sound.pick(); }
        return;
      }
    }
    // buttons
    if (this._inRect(px, py, L.add)) {
      if (this.active == null) { this._flash('Elegí un color 🎨'); return; }
      if (this.scoops.length >= MAX_SCOOPS) { this._flash('¡Cono lleno!'); return; }
      this.scoops.push(this.active);
      Sound.add();
      return;
    }
    if (this._inRect(px, py, L.undo)) {
      if (this.scoops.length) Sound.undo();
      this.scoops.pop();
      return;
    }
    if (this._inRect(px, py, L.serve)) { this._serve(L); return; }
  }

  _flash(msg) { this.resultMsg = msg; this.result = -0.5; Sound.serveBad(); }

  _serve(L) {
    const ok = this.scoops.length === this.order.length &&
               this.scoops.every((c, i) => c === this.order[i]) &&
               this.topping === this.orderTopping;
    if (ok) {
      const gain = this.order.length * 10 + 5 + (this.orderTopping ? 8 : 0);
      this.score += gain;
      this.served++;
      addCoins(15);
      if (this.score > this.best) { this.best = this.score; localStorage.setItem('helado_best', this.best); }
      this.resultMsg = `¡Gracias! +${gain}`;
      this.result = 1.4;
      this.pendingNew = true;
      Sound.serveGood();
      // confetti from the cone
      const cy = L.cone.baseY - L.cone.scoopR * (this.scoops.length);
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2, sp = 90 + Math.random() * 220;
        this.particles.push({ x: L.cone.x, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120,
          life: 0, max: 0.7 + Math.random() * 0.5, size: 3 + Math.random() * 4,
          color: FLAVORS[Math.floor(Math.random() * FLAVORS.length)].c });
      }
    } else {
      const why = this.scoops.length !== this.order.length ? 'Faltan/sobran bochas'
        : this.topping !== this.orderTopping ? 'Falta el topping correcto'
        : 'No son los colores';
      this._flash(why);
    }
  }

  _timeoutOrder() {
    this.missed++;
    this.resultMsg = 'Se fue sin esperar 😢';
    this.result = -0.9;
    this.pendingNew = true;
    Sound.timeout();
  }

  // ── Update ───────────────────────────────────────────────────────────────
  update(dt) {
    this.t += dt;
    if (this.result > 0) {
      this.result -= dt;
      if (this.result <= 0 && this.pendingNew) { this.pendingNew = false; this.newOrder(); }
    } else if (this.result < 0) {
      this.result += dt;
      if (this.result >= 0) { this.result = 0; if (this.pendingNew) { this.pendingNew = false; this.newOrder(); } }
    } else {
      // patience ticks down only while the customer is actively waiting
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) { this.timeLeft = 0; this._timeoutOrder(); }
    }
    for (const p of this.particles) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 520 * dt; }
    this.particles = this.particles.filter(p => p.life < p.max);
  }

  // ── Render ───────────────────────────────────────────────────────────────
  render(ctx) {
    const L = this._layout(), { W, H, s } = L;

    // ── Shop background ──
    this._drawShopBackground(ctx, L);

    // ── Ice-cream display freezer ──
    this._drawFreezer(ctx, L);

    // ── Customer + order bubble (with patience bar) ──
    this._drawCustomer(ctx, L.cust.x, L.cust.y, s, this.result > 0, this.custSeed);
    this._drawOrderBubble(ctx, L);

    // ── Your cone ──
    const shake = this.result < 0 ? Math.sin(this.t * 50) * 5 * s : 0;
    this._drawCone(ctx, L.cone.x + shake, L.cone.baseY, L.cone.scoopR, this.scoops, s, this.topping);
    ctx.fillStyle = '#9A5A7A'; ctx.font = `bold ${15 * s}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Tu helado', L.cone.x, L.cone.baseY + 64 * s);

    // ── Topping palette ──
    for (const tp of L.toppingPalette) {
      if (this.topping === tp.i) {
        ctx.strokeStyle = '#333'; ctx.lineWidth = 3 * s;
        ctx.beginPath(); ctx.arc(tp.x, tp.y, tp.r + 5 * s, 0, Math.PI * 2); ctx.stroke();
      }
      this._toppingSwatch(ctx, tp.x, tp.y, tp.r, tp.i, s);
    }

    // ── Flavour palette ──
    for (const p of L.palette) {
      if (this.active === p.i) {
        ctx.strokeStyle = '#333'; ctx.lineWidth = 4 * s;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 6 * s, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#FFF6BC';
        ctx.beginPath(); ctx.arc(p.x, p.y - p.r - 16 * s, 4 * s, 0, Math.PI * 2); ctx.fill();
      }
      this._scoop(ctx, p.x, p.y, p.r, p.i, s);
    }

    // ── Buttons ──
    this._button(ctx, L.add, '#7BC86B', s);
    this._button(ctx, L.undo, '#E0A050', s);
    this._button(ctx, L.serve, '#FF5D8F', s, true);

    // ── Particles ──
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ── HUD (placed below the HELADERÍA sign which ends near 68*s) ──
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.roundRect(8 * s, 72 * s, 290 * s, 52 * s, 10 * s); ctx.fill();
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#A2356A'; ctx.font = `900 ${26 * s}px system-ui, sans-serif`;
    ctx.fillText(`🍨 ${this.score}`, 18 * s, 102 * s);
    ctx.fillStyle = '#B86A92'; ctx.font = `bold ${13 * s}px system-ui, sans-serif`;
    ctx.fillText(`Servidos: ${this.served}  ·  Perdidos: ${this.missed}  ·  Mejor: ${this.best}`, 18 * s, 118 * s);

    // ── Result banner ──
    if (this.result !== 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, Math.abs(this.result) * 1.6 + 0.3);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = this.result > 0 ? '#2B8A3E' : '#D7263D';
      ctx.font = `900 ${40 * s}px system-ui, sans-serif`;
      ctx.fillText(this.resultMsg, W / 2, H * 0.30);
      ctx.restore();
    }
  }

  // ── Drawing helpers ──────────────────────────────────────────────────────
  _scoop(ctx, x, y, r, flavorIdx, s) {
    const f = FLAVORS[flavorIdx];
    if (f && ready(f.img)) {
      const d = r * 2.05;
      ctx.drawImage(f.img, x - d / 2, y - d / 2, d, d);
      return;
    }
    // fallback vector circle while the sprite is still loading
    ctx.fillStyle = f ? f.c : '#ccc';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = Math.max(1, r * 0.06); ctx.stroke();
  }

  // Icon shown inside a topping palette swatch.
  _toppingSwatch(ctx, x, y, r, idx, s) {
    ctx.fillStyle = '#FFF8EC'; ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = Math.max(1, r * 0.08);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    const t = TOPPINGS[idx];
    if (t.key === 'none') {
      ctx.strokeStyle = '#D7263D'; ctx.lineWidth = Math.max(1.5, r * 0.16);
      ctx.beginPath(); ctx.arc(x, y, r * 0.62, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - r * 0.5, y + r * 0.5); ctx.lineTo(x + r * 0.5, y - r * 0.5); ctx.stroke();
      return;
    }
    if (ready(t.img)) {
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, r * 0.92, 0, Math.PI * 2); ctx.clip();
      const d = r * 1.7;
      ctx.drawImage(t.img, x - d / 2, y - d / 2, d, d);
      ctx.restore();
    }
  }

  // Draws the chosen topping decoration over the top scoop of a cone.
  _applyTopping(ctx, x, topY, r, idx) {
    const t = TOPPINGS[idx];
    if (!t || t.key === 'none' || !ready(t.img)) return;
    const ar = t.img.naturalWidth / t.img.naturalHeight;
    let w, h;
    if (t.key === 'wafer') {
      h = r * 2.3; w = h * ar;
      ctx.save(); ctx.translate(x + r * 0.7, topY - r * 0.55); ctx.rotate(0.5);
      ctx.drawImage(t.img, -w / 2, -h / 2, w, h);
      ctx.restore();
    } else {
      w = r * 2.0; h = w / ar;
      ctx.drawImage(t.img, x - w / 2, topY - h * 0.55, w, h);
    }
  }

  _drawCone(ctx, x, baseY, scoopR, flavorArr, s, topping = 0) {
    // waffle cone (image, with vector fallback while loading)
    const coneW = scoopR * 1.95;
    if (ready(CONE_IMG)) {
      const coneH = coneW * (CONE_IMG.naturalHeight / CONE_IMG.naturalWidth);
      ctx.drawImage(CONE_IMG, x - coneW / 2, baseY - coneH * 0.16, coneW, coneH);
    } else {
      const cw = scoopR * 0.95, ch = scoopR * 1.7;
      ctx.fillStyle = '#E0A55A';
      ctx.beginPath(); ctx.moveTo(x - cw, baseY); ctx.lineTo(x + cw, baseY); ctx.lineTo(x, baseY + ch); ctx.closePath(); ctx.fill();
    }

    // scoops bottom-up; if empty, show a dashed placeholder for the first slot
    if (flavorArr.length === 0) {
      const cy = baseY - scoopR * 0.55;
      ctx.strokeStyle = 'rgba(150,90,120,0.5)'; ctx.setLineDash([6 * s, 6 * s]); ctx.lineWidth = 2 * s;
      ctx.beginPath(); ctx.arc(x, cy, scoopR, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
    for (let i = 0; i < flavorArr.length; i++) {
      const cy = baseY - scoopR * 0.55 - i * scoopR * 1.0;
      this._scoop(ctx, x, cy, scoopR, flavorArr[i], s);
    }
    // cherry + topping on top
    if (flavorArr.length > 0) {
      const topCy = baseY - scoopR * 0.55 - (flavorArr.length - 1) * scoopR;
      this._applyTopping(ctx, x, topCy - scoopR * 0.25, scoopR, topping);
      const ty = topCy - scoopR * 0.7;
      if (ready(CHERRY_IMG)) {
        const cw2 = scoopR * 0.6, ch2 = cw2 * (CHERRY_IMG.naturalHeight / CHERRY_IMG.naturalWidth);
        ctx.drawImage(CHERRY_IMG, x - cw2 / 2, ty - ch2 * 0.55, cw2, ch2);
      } else {
        ctx.fillStyle = '#E23B5A'; ctx.beginPath(); ctx.arc(x, ty, scoopR * 0.22, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  // Full shop scene: striped wall, scalloped awning, window, candy-jar shelf,
  // pennant banner, tiled floor and the hanging sign.
  _drawShopBackground(ctx, L) {
    const { W, H, s } = L;
    const wallH = H * 0.78;

    // back wall gradient
    const wall = ctx.createLinearGradient(0, 0, 0, wallH);
    wall.addColorStop(0, '#FFE3F1'); wall.addColorStop(1, '#FFD0E6');
    ctx.fillStyle = wall; ctx.fillRect(0, 0, W, wallH);

    // vertical candy-stripe wallpaper (faint)
    const stripeW = 46 * s;
    for (let x = 0, i = 0; x < W; x += stripeW, i++) {
      if (i % 2 === 0) { ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(x, 0, stripeW, wallH); }
    }

    // wainscot band just above the floor
    const wainH = 30 * s;
    ctx.fillStyle = '#FBC7DE'; ctx.fillRect(0, wallH - wainH, W, wainH);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2 * s;
    ctx.beginPath(); ctx.moveTo(0, wallH - wainH); ctx.lineTo(W, wallH - wainH); ctx.stroke();

    // scalloped awning across the very top
    const scW = 38 * s, scH = 26 * s;
    const awningCols = ['#FF8FB8', '#FFFFFF'];
    ctx.fillStyle = '#E8508F'; ctx.fillRect(0, 0, W, scH * 0.6);
    for (let x = -scW, i = 0; x < W + scW; x += scW, i++) {
      ctx.fillStyle = awningCols[i % 2];
      ctx.beginPath(); ctx.arc(x + scW / 2, scH * 0.6, scW / 2, 0, Math.PI); ctx.fill();
    }

    // pennant banner string below the awning
    const penY = scH * 0.6 + 14 * s, penW = 30 * s, penH = 22 * s;
    const penCols = ['#FF7EB3', '#8FE3C2', '#F6E08A', '#7FA7F0', '#FF9F45'];
    ctx.strokeStyle = 'rgba(120,80,100,0.4)'; ctx.lineWidth = 1.5 * s;
    ctx.beginPath(); ctx.moveTo(0, penY); for (let x = 0; x <= W; x += penW) { ctx.lineTo(x, penY + Math.sin(x * 0.05) * 2 * s); } ctx.stroke();
    for (let x = penW * 0.5, i = 0; x < W; x += penW, i++) {
      const dip = Math.sin(x * 0.05) * 2 * s;
      ctx.fillStyle = penCols[i % penCols.length];
      ctx.beginPath();
      ctx.moveTo(x - penW * 0.32, penY + dip); ctx.lineTo(x + penW * 0.32, penY + dip); ctx.lineTo(x, penY + dip + penH); ctx.closePath();
      ctx.fill();
    }

    // window with café-curtain (left side)
    const winX = W * 0.04, winY = scH * 0.6 + 36 * s, winW = W * 0.16, winH = H * 0.30;
    ctx.fillStyle = '#BFE6FF'; ctx.fillRect(winX, winY, winW, winH);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(winX, winY, winW, winH * 0.42);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    const scallops = 5, sw = winW / scallops;
    ctx.moveTo(winX, winY);
    for (let i = 0; i < scallops; i++) ctx.arc(winX + sw * (i + 0.5), winY, sw * 0.5, Math.PI, 0);
    ctx.lineTo(winX + winW, winY); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#8A5A3B'; ctx.lineWidth = 7 * s; ctx.strokeRect(winX, winY, winW, winH);
    ctx.lineWidth = 3 * s;
    ctx.beginPath(); ctx.moveTo(winX + winW / 2, winY); ctx.lineTo(winX + winW / 2, winY + winH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(winX, winY + winH / 2); ctx.lineTo(winX + winW, winY + winH / 2); ctx.stroke();

    // candy-jar shelf (right side)
    const shX = W * 0.78, shY = scH * 0.6 + 50 * s, shW = W * 0.18;
    ctx.fillStyle = '#C98A5A'; ctx.beginPath(); ctx.roundRect(shX, shY, shW, 10 * s, 3 * s); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.ellipse(shX + shW / 2, shY + 12 * s, shW * 0.46, 5 * s, 0, 0, Math.PI * 2); ctx.fill();
    const jarCols = [['#FF7EB3', '#FFD3E6'], ['#7FA7F0', '#D6E6FF'], ['#8FE3C2', '#DFF7EC']];
    for (let i = 0; i < 3; i++) {
      const jx = shX + shW * (0.2 + i * 0.3), jw = shW * 0.22, jh = 30 * s;
      ctx.fillStyle = jarCols[i][1];
      ctx.beginPath(); ctx.roundRect(jx - jw / 2, shY - jh, jw, jh, 5 * s); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1.5 * s; ctx.stroke();
      // candies inside
      ctx.fillStyle = jarCols[i][0];
      for (let k = 0; k < 6; k++) {
        ctx.beginPath();
        ctx.arc(jx + ((k * 37) % 100 - 50) / 100 * jw * 0.6, shY - 4 * s - ((k * 53) % 100) / 100 * jh * 0.7, 2.6 * s, 0, Math.PI * 2);
        ctx.fill();
      }
      // lid
      ctx.fillStyle = '#E0A55A'; ctx.beginPath(); ctx.roundRect(jx - jw * 0.55, shY - jh - 7 * s, jw * 1.1, 8 * s, 3 * s); ctx.fill();
    }

    // floor (tiled, with a subtle perspective shading band near the wall)
    ctx.fillStyle = '#E7B98A'; ctx.fillRect(0, wallH, W, H - wallH);
    const tile = 60 * s;
    for (let gy = wallH, ry = 0; gy < H; gy += tile, ry++) {
      for (let gx = (ry % 2) * tile * 0.5; gx < W; gx += tile) {
        ctx.fillStyle = (Math.round(gx / tile) + ry) % 2 === 0 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.04)';
        ctx.fillRect(gx, gy, tile, tile);
      }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(0, wallH, W, 14 * s);

    // counter trim
    ctx.fillStyle = '#C98A5A'; ctx.fillRect(0, wallH - 10 * s, W, 10 * s);

    // hanging sign
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#FF7EB3'; ctx.lineWidth = 4 * s;
    const signY = scH * 0.6 + 6 * s;
    ctx.beginPath(); ctx.roundRect(W / 2 - 150 * s, signY, 300 * s, 46 * s, 14 * s); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#E8508F'; ctx.font = `900 ${28 * s}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🍦 HELADERÍA', W / 2, signY + 24 * s);
  }

  _drawCustomer(ctx, x, y, s, happy, seed) {
    const img = CUSTOMER_IMGS[seed % CUSTOMER_IMGS.length];
    const bounce = happy ? Math.sin(this.t * 16) * 4 * s : 0;
    if (ready(img)) {
      const h = 188 * s + bounce, w = h * (img.naturalWidth / img.naturalHeight);
      ctx.drawImage(img, x - w / 2, y - h + 56 * s, w, h);
      return;
    }
    // fallback simple silhouette while the sprite loads
    ctx.fillStyle = '#C49BE0';
    ctx.beginPath(); ctx.ellipse(x, y + 36 * s, 36 * s, 44 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y - 18 * s, 34 * s, 0, Math.PI * 2); ctx.fill();
  }

  _drawOrderBubble(ctx, L) {
    const s = L.s, bx = L.bubble.x, by = L.bubble.y;
    const w = 154 * s, h = 150 * s, x = bx - w / 2, y = by - h / 2;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#FF9EC2'; ctx.lineWidth = 3 * s;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 16 * s); ctx.fill(); ctx.stroke();
    // tail pointing down toward the customer
    ctx.beginPath(); ctx.moveTo(bx - 12 * s, y + h); ctx.lineTo(bx + 12 * s, y + h); ctx.lineTo(bx - 2 * s, y + h + 18 * s); ctx.closePath();
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke();
    // label
    ctx.fillStyle = '#A2356A'; ctx.font = `900 ${14 * s}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('Quiero…', bx, y + 20 * s);
    // mini cone of the order
    this._drawCone(ctx, bx, y + h - 38 * s, 16 * s, this.order, s, this.orderTopping);

    // patience bar across the bottom of the bubble
    const frac = Math.max(0, this.timeLeft / this.maxTime);
    const barW = w - 24 * s, barH = 10 * s, barX = x + 12 * s, barY = y + h - 16 * s;
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, barH / 2); ctx.fill();
    const col = frac > 0.5 ? '#5AC85A' : frac > 0.22 ? '#F2B705' : '#E0353A';
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.roundRect(barX, barY, Math.max(barH, barW * frac), barH, barH / 2); ctx.fill();
  }

  _button(ctx, b, color, s, big = false) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 12 * s); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 2 * s; ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = `900 ${(big ? 26 : 17) * s}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2);
  }

  // ── Ice-cream display freezer ────────────────────────────────────────────
  // Drawn behind the palettes so flavor scoops / topping swatches appear
  // sitting inside the glass case and on the shelf.
  _drawFreezer(ctx, L) {
    const { W, H, s } = L;
    const py  = L.palette[0].y,        pr = L.palette[0].r;
    const tpy = L.toppingPalette[0].y, tr = L.toppingPalette[0].r;

    // Derive freezer width from the actual content extent (palettes + padding)
    const paletteL  = L.palette[0].x - pr - 20 * s;
    const paletteR  = L.palette[L.palette.length - 1].x + pr + 20 * s;
    const toppingL  = L.toppingPalette[0].x - tr - 20 * s;
    const toppingR  = L.toppingPalette[L.toppingPalette.length - 1].x + tr + 20 * s;
    const fL = Math.max(8 * s, Math.min(paletteL, toppingL));
    const fR = Math.min(W - 8 * s, Math.max(paletteR, toppingR));
    const fW = fR - fL;
    // Top of the unit sits just above the topping swatches
    const unitTop = tpy - tr - 30 * s;
    const unitBot = H - 3 * s;
    // Divider between the topping shelf (upper) and ice-cream case (lower)
    const divY = py - pr - 16 * s;

    // ── Drop shadow ──────────────────────────────────────────────────────
    ctx.save();
    ctx.shadowColor   = 'rgba(0,0,0,0.24)';
    ctx.shadowBlur    = 18 * s;
    ctx.shadowOffsetY = 6 * s;
    ctx.fillStyle = '#ECF3FA';
    ctx.beginPath();
    ctx.roundRect(fL, unitTop, fW, unitBot - unitTop, [10*s,10*s,6*s,6*s]);
    ctx.fill();
    ctx.restore();

    // ── Body (stainless gradient) ─────────────────────────────────────────
    const bodyG = ctx.createLinearGradient(fL, unitTop, fR, unitTop);
    bodyG.addColorStop(0,    '#B0C6D8');
    bodyG.addColorStop(0.04, '#EBF3FA');
    bodyG.addColorStop(0.5,  '#F6FAFF');
    bodyG.addColorStop(0.96, '#EBF3FA');
    bodyG.addColorStop(1,    '#A8BED0');
    ctx.fillStyle = bodyG;
    ctx.beginPath();
    ctx.roundRect(fL, unitTop, fW, unitBot - unitTop, [10*s,10*s,6*s,6*s]);
    ctx.fill();
    ctx.strokeStyle = '#86A2B4'; ctx.lineWidth = 2.5 * s; ctx.stroke();

    // Subtle horizontal brushed-metal lines
    ctx.save();
    ctx.strokeStyle = 'rgba(150,180,200,0.18)'; ctx.lineWidth = s;
    for (let y = unitTop + 18*s; y < unitBot - 6*s; y += 7*s) {
      ctx.beginPath(); ctx.moveTo(fL+5*s,y); ctx.lineTo(fR-5*s,y); ctx.stroke();
    }
    ctx.restore();

    // ── Horizontal divider (separates toppings shelf from ice-cream case) ─
    ctx.fillStyle = '#6A8EA4';
    ctx.fillRect(fL + 6*s, divY, fW - 12*s, 3.5 * s);
    // Divider highlight
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(fL + 6*s, divY, fW - 12*s, 1 * s);

    // ── Helper: draw a glass panel (shared for both sections) ─────────────
    const drawPane = (gTop, gBot, cold) => {
      const gL = fL + 10*s, gW = fW - 20*s, gH = gBot - gTop;
      const radii = cold ? [0,0,5*s,5*s] : [5*s,5*s,0,0];

      // Tinted glass fill
      const gg = ctx.createLinearGradient(gL, gTop, gL, gBot);
      if (cold) {
        gg.addColorStop(0,   'rgba(185,220,255,0.55)');
        gg.addColorStop(0.45,'rgba(210,236,255,0.28)');
        gg.addColorStop(1,   'rgba(195,228,255,0.52)');
      } else {
        gg.addColorStop(0, 'rgba(255,242,205,0.30)');
        gg.addColorStop(1, 'rgba(255,252,232,0.16)');
      }
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.roundRect(gL, gTop, gW, gH, radii); ctx.fill();

      if (cold) {
        // Frost gradient at top opening
        const fg = ctx.createLinearGradient(gL, gTop, gL, gTop + 14*s);
        fg.addColorStop(0, 'rgba(215,242,255,0.72)');
        fg.addColorStop(1, 'rgba(215,242,255,0)');
        ctx.fillStyle = fg;
        ctx.beginPath(); ctx.roundRect(gL, gTop, gW, 14*s, [0,0,0,0]); ctx.fill();

        // Frost crystals along the top edge
        ctx.save();
        ctx.strokeStyle = 'rgba(168,215,255,0.75)'; ctx.lineWidth = s;
        for (let fx = gL + 24*s; fx < gL + gW - 18*s; fx += 30*s) {
          const fy = gTop + 6*s;
          ctx.beginPath();
          ctx.moveTo(fx-5*s,fy); ctx.lineTo(fx+5*s,fy);
          ctx.moveTo(fx,fy-5*s); ctx.lineTo(fx,fy+5*s);
          ctx.moveTo(fx-3.5*s,fy-3.5*s); ctx.lineTo(fx+3.5*s,fy+3.5*s);
          ctx.moveTo(fx+3.5*s,fy-3.5*s); ctx.lineTo(fx-3.5*s,fy+3.5*s);
          ctx.stroke();
        }
        ctx.restore();

        // Flavor slot dividers (one per flavor)
        ctx.save();
        ctx.strokeStyle = 'rgba(88,144,200,0.30)'; ctx.lineWidth = 1.5 * s;
        const n = L.palette.length;
        for (let i = 1; i < n; i++) {
          const dx = gL + (i / n) * gW;
          ctx.beginPath(); ctx.moveTo(dx, gTop+7*s); ctx.lineTo(dx, gBot-6*s); ctx.stroke();
        }
        ctx.restore();
      } else {
        // Topping slot dividers
        ctx.save();
        ctx.strokeStyle = 'rgba(180,150,80,0.25)'; ctx.lineWidth = 1.5 * s;
        const n = L.toppingPalette.length;
        for (let i = 1; i < n; i++) {
          const dx = gL + (i / n) * gW;
          ctx.beginPath(); ctx.moveTo(dx, gTop+6*s); ctx.lineTo(dx, gBot-4*s); ctx.stroke();
        }
        ctx.restore();
      }

      // Diagonal glass reflection
      ctx.save(); ctx.globalAlpha = 0.20; ctx.fillStyle = '#fff';
      const hw = 15 * s;
      ctx.beginPath();
      ctx.moveTo(gL+11*s, gTop+2*s); ctx.lineTo(gL+11*s+hw, gTop+2*s);
      ctx.lineTo(gL+11*s+hw*0.55, gBot-2*s); ctx.lineTo(gL+11*s-hw*0.45, gBot-2*s);
      ctx.closePath(); ctx.fill(); ctx.restore();

      // Metal bezel around glass
      ctx.strokeStyle = cold ? '#6080A0' : '#A08840';
      ctx.lineWidth = 2.5 * s;
      ctx.beginPath(); ctx.roundRect(gL, gTop, gW, gH, radii); ctx.stroke();
    };

    drawPane(unitTop + 13*s, divY - 2*s, false);  // upper: topping shelf
    drawPane(divY + 4*s, unitBot - 8*s,  true);   // lower: ice-cream case (cold)

    // ── Top rail / counter surface ─────────────────────────────────────────
    const railG = ctx.createLinearGradient(fL, unitTop, fL, unitTop + 16*s);
    railG.addColorStop(0,   '#9EC0D0');
    railG.addColorStop(0.45,'#D5E8F2');
    railG.addColorStop(1,   '#82A0B4');
    ctx.fillStyle = railG;
    ctx.beginPath(); ctx.roundRect(fL, unitTop, fW, 16*s, [10*s,10*s,0,0]); ctx.fill();
    ctx.strokeStyle = '#648098'; ctx.lineWidth = 1.5*s; ctx.stroke();
    // Rail highlight
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.roundRect(fL + 8*s, unitTop + 1.5*s, fW - 16*s, 2.5*s, [8*s,8*s,0,0]); ctx.fill();

    // ── Digital thermometer on the rail ──────────────────────────────────
    ctx.fillStyle = '#07140C';
    ctx.beginPath(); ctx.roundRect(W/2 - 42*s, unitTop + 2.5*s, 84*s, 12*s, 3*s); ctx.fill();
    ctx.save();
    ctx.fillStyle = '#18FF88'; ctx.font = `bold ${7.5*s}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('❄  -18 °C  ❄', W/2, unitTop + 8.5*s);
    ctx.restore();

    // ── Flavor labels at the bottom of the cold glass case ───────────────
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    for (const p of L.palette) {
      ctx.fillStyle = 'rgba(20,52,108,0.85)';
      ctx.font = `bold ${Math.max(7, 8 * s)}px system-ui, sans-serif`;
      ctx.fillText(FLAVORS[p.i].name, p.x, unitBot - 11*s);
    }
    ctx.restore();

    // ── "TOPPINGS" micro-label in the upper shelf ─────────────────────────
    ctx.save();
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(120,95,30,0.55)';
    ctx.font = `bold ${8*s}px system-ui, sans-serif`;
    ctx.fillText('TOPPINGS', fL + 18*s, unitTop + 18*s);
    ctx.restore();

    // ── "HELADOS" watermark inside the cold glass case ────────────────────
    ctx.save();
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(40,80,150,0.22)';
    ctx.font = `bold ${10*s}px system-ui, sans-serif`;
    ctx.fillText('HELADOS ❄', fL + 18*s, divY + 7*s);
    ctx.restore();
  }

  destroy() {}
}
