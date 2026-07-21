// ── Vestidor de Moda ─────────────────────────────────────────────────────────
// Juego de 1 jugador, estilo "Avatar World": vestir a una nena combinando piel,
// peinado + color de pelo, ropa, zapatos y accesorios. La muñeca se dibuja
// entera en canvas (sin sprites PNG) para poder tener muchas combinaciones sin
// arte nuevo; el inventario y las monedas se comparten con el resto del juego
// (Wallet.js), igual que en la Tienda de Ropa.
import { getCoins, spendCoins, getWardrobe, addToWardrobe } from './Wallet.js';

// ── Colour helpers (paleta pastel + sombreado suave, como Character.js) ──────
function _lc(hex, amt) {
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return `rgb(${Math.min(255,Math.round(r+(255-r)*amt))},${Math.min(255,Math.round(g+(255-g)*amt))},${Math.min(255,Math.round(b+(255-b)*amt))})`;
}
function _dc(hex, amt) {
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return `rgb(${Math.max(0,Math.round(r*(1-amt)))},${Math.max(0,Math.round(g*(1-amt)))},${Math.max(0,Math.round(b*(1-amt)))})`;
}
const OC = 'rgba(40,20,10,0.55)';

const SAVE_KEY = 'vestidor_look';

// ── Catálogo ──────────────────────────────────────────────────────────────
export const SKIN_TONES = [
  { id:'clara',   color:'#FFE0C4', price:0 },
  { id:'dorada',  color:'#F5C89A', price:0 },
  { id:'canela',  color:'#D9A066', price:0 },
  { id:'morena',  color:'#A9744F', price:0 },
  { id:'oscura',  color:'#6E4A2E', price:0 },
];

export const HAIR_STYLES = [
  { id:'colitas', name:'Colitas', emoji:'🎀',   price:0  },
  { id:'corto',   name:'Corto',   emoji:'✂️',   price:20 },
  { id:'rodete',  name:'Rodete',  emoji:'🍡',   price:30 },
  { id:'largo',   name:'Suelto',  emoji:'💁‍♀️', price:40 },
  { id:'trenza',  name:'Trenza',  emoji:'🧵',   price:40 },
];

export const HAIR_COLORS = [
  { id:'negro',    color:'#2A1A10', price:0  },
  { id:'castano',  color:'#7B3F00', price:0  },
  { id:'rubio',    color:'#D4A044', price:0  },
  { id:'plateado', color:'#EDEDED', price:0  },
  { id:'fucsia',   color:'#C03060', price:20 },
  { id:'azul',     color:'#3060C0', price:20 },
  { id:'menta',    color:'#8ED9C0', price:35 },
  { id:'lavanda',  color:'#C9A8F5', price:35 },
  { id:'chicle',   color:'#FF8AC8', price:35 },
];

export const OUTFITS = [
  { id:'flores', name:'Vestido Flores',  emoji:'👗', price:0,   kind:'vestido',        main:'#F9C8D8', accent:'#E89AB8', pattern:'flores'   },
  { id:'casual', name:'Remera y Jean',   emoji:'👕', price:40,  kind:'remera_pollera', main:'#F2A7BB', accent:'#3F5C8C', pattern:'ninguno'  },
  { id:'overol', name:'Overol',          emoji:'🧑‍🌾', price:60, kind:'overol',        main:'#5B7FBF', accent:'#FFE0C4', pattern:'ninguno'  },
  { id:'pijama', name:'Pijama Estrella', emoji:'🌙', price:50,  kind:'remera_pollera', main:'#8FD0F0', accent:'#3A7AA8', pattern:'estrellas'},
  { id:'tutu',   name:'Tutú Bailarina',  emoji:'🩰', price:90,  kind:'tutu',           main:'#FFB6D9', accent:'#FF80C0', pattern:'ninguno'  },
  { id:'fiesta', name:'Vestido Fiesta',  emoji:'✨', price:100, kind:'vestido',        main:'#C9A8F5', accent:'#8B5FBF', pattern:'brillos'  },
  { id:'sirena', name:'Sirena',          emoji:'🧜‍♀️', price:150,kind:'sirena',        main:'#4ED0C8', accent:'#2A9A90', pattern:'escamas'  },
];

export const SHOES = [
  { id:'zapatillas', name:'Zapatillas', emoji:'👟', price:0,  color:'#FFFFFF', accent:'#FF6090' },
  { id:'sandalias',  name:'Sandalias',  emoji:'🩴', price:20, color:'#F5C89A', accent:'#C08050' },
  { id:'botas',      name:'Botas',      emoji:'🥾', price:40, color:'#8B5A2B', accent:'#5A3A1B' },
  { id:'fiesta',     name:'Fiesta',     emoji:'👠', price:60, color:'#E040A0', accent:'#A02070' },
];

export const ACCESSORIES = [
  { id:'ninguno', name:'Ninguno', emoji:'🚫', price:0   },
  { id:'moño',    name:'Moño',    emoji:'🎀', price:0   },
  { id:'lentes',  name:'Lentes',  emoji:'👓', price:25  },
  { id:'flor',    name:'Flores',  emoji:'🌸', price:40  },
  { id:'collar',  name:'Collar',  emoji:'📿', price:50  },
  { id:'cartera', name:'Cartera', emoji:'👜', price:60  },
  { id:'corona',  name:'Corona',  emoji:'👑', price:100 },
];

const TABS = [
  { id:'piel',       name:'Piel',       emoji:'🎨' },
  { id:'pelo',       name:'Pelo',       emoji:'💇' },
  { id:'ropa',       name:'Ropa',       emoji:'👗' },
  { id:'zapatos',    name:'Zapatos',    emoji:'👟' },
  { id:'accesorios', name:'Accesorios', emoji:'🎀' },
];

function idOf(cat, itemId) { return `vd_${cat}_${itemId}`; }

export class Vestidor {
  constructor(canvas) {
    this.canvas = canvas;
    this.t = 0;
    this.tab = 'ropa';
    this.toast = null;
    this.look = {
      skin: SKIN_TONES[0].color,
      hair: HAIR_STYLES[0].id, hairColor: HAIR_COLORS[0].color,
      outfit: OUTFITS[0].id, shoes: SHOES[0].id, accessory: ACCESSORIES[0].id,
    };
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (s) Object.assign(this.look, s);
    } catch (e) {}
    this._refresh();
  }

  _refresh() { this.coins = getCoins(); this.owned = getWardrobe(); }
  _save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.look)); } catch (e) {} }
  _toast(msg) { this.toast = { msg, life: 0, maxLife: 1.6 }; }

  update(dt) {
    this.t += dt;
    if (this.toast) { this.toast.life += dt; if (this.toast.life >= this.toast.maxLife) this.toast = null; }
  }

  destroy() {}

  _isOwned(cat, item) { return item.price === 0 || !!this.owned[idOf(cat, item.id)]; }

  _pick(cat, key, item) {
    const value = (key === 'hairColor' || key === 'skin') ? item.color : item.id;
    if (this._isOwned(cat, item)) {
      this.look[key] = value; this._save(); this._toast('¡Listo! ✓');
      return;
    }
    if (!spendCoins(item.price)) { this._toast('Sin monedas 😢'); return; }
    addToWardrobe(idOf(cat, item.id));
    this._refresh();
    this.look[key] = value; this._save();
    this._toast(`¡Comprado! 💰-${item.price}`);
  }

  _catFor(tab) {
    if (tab === 'piel')    return { list: SKIN_TONES,   cat:'piel',       key:'skin' };
    if (tab === 'ropa')    return { list: OUTFITS,      cat:'ropa',       key:'outfit' };
    if (tab === 'zapatos') return { list: SHOES,        cat:'zapatos',    key:'shoes' };
    return { list: ACCESSORIES, cat:'accesorios', key:'accessory' };
  }

  // ── Entrada ────────────────────────────────────────────────────────────
  pointer(px, py) {
    this._refresh();
    const W = this.canvas.width, H = this.canvas.height;
    const barH = H * 0.11;
    const leftW = W * 0.36;

    const tabsY = barH + 8, tabsH = H * 0.09;
    if (py >= tabsY && py <= tabsY + tabsH && px >= leftW) {
      const tabW = (W - leftW) / TABS.length;
      const idx = Math.floor((px - leftW) / tabW);
      if (TABS[idx]) this.tab = TABS[idx].id;
      return;
    }

    const gridY = tabsY + tabsH + 8;
    const gridH = H - gridY - 12;
    const gridX = leftW + 12;
    const gridW = W - gridX - 12;
    if (px < gridX || py < gridY) return;

    if (this.tab === 'pelo') { this._hitPelo(px, py, gridX, gridY, gridW, gridH); return; }
    const { list, cat, key } = this._catFor(this.tab);
    this._hitGrid(px, py, gridX, gridY, gridW, gridH, list, cat, key);
  }

  _hitGrid(px, py, gx, gy, gw, gh, list, cat, key) {
    const cols = 5, pad = 10;
    const rows = Math.max(1, Math.ceil(list.length / cols));
    const cw = (gw - (cols - 1) * pad) / cols;
    const ch = Math.min((gh - (rows - 1) * pad) / rows, cw * 1.15);
    for (let i = 0; i < list.length; i++) {
      const col = i % cols, row = Math.floor(i / cols);
      const cx = gx + col * (cw + pad), cy = gy + row * (ch + pad);
      if (px >= cx && px <= cx + cw && py >= cy && py <= cy + ch) { this._pick(cat, key, list[i]); return; }
    }
  }

  _hitPelo(px, py, gx, gy, gw, gh) {
    const styleH = gh * 0.42;
    {
      const cols = 5, pad = 10, cw = (gw - (cols - 1) * pad) / cols;
      for (let i = 0; i < HAIR_STYLES.length; i++) {
        const cx = gx + i * (cw + pad), cy = gy;
        if (px >= cx && px <= cx + cw && py >= cy && py <= cy + styleH) { this._pick('pelo_estilo', 'hair', HAIR_STYLES[i]); return; }
      }
    }
    const colY = gy + styleH + 14, colH = gh - styleH - 14;
    {
      const cols = 5, pad = 10, cw = (gw - (cols - 1) * pad) / cols;
      const rows = Math.max(1, Math.ceil(HAIR_COLORS.length / cols));
      const ch = (colH - (rows - 1) * pad) / rows;
      for (let i = 0; i < HAIR_COLORS.length; i++) {
        const col = i % cols, row = Math.floor(i / cols);
        const cx = gx + col * (cw + pad), cy = colY + row * (ch + pad);
        if (px >= cx && px <= cx + cw && py >= cy && py <= cy + ch) { this._pick('pelo_color', 'hairColor', HAIR_COLORS[i]); return; }
      }
    }
  }

  // ── Render ────────────────────────────────────────────────────────────
  render(ctx) {
    const W = this.canvas.width, H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);
    this._drawBg(ctx, W, H);
    this._drawTopBar(ctx, W, H);
    this._drawDollPanel(ctx, W, H);
    this._drawTabs(ctx, W, H);
    if (this.tab === 'pelo') this._drawPeloGrid(ctx, W, H);
    else { const { list, cat, key } = this._catFor(this.tab); this._drawGrid(ctx, W, H, list, cat, key); }
    if (this.toast) this._drawToast(ctx, W, H);
  }

  _drawBg(ctx, W, H) {
    const barH = H * 0.11;
    const wallG = ctx.createLinearGradient(0, barH, 0, H * 0.62);
    wallG.addColorStop(0, '#EDE0FA'); wallG.addColorStop(1, '#F6E8FA');
    ctx.fillStyle = wallG; ctx.fillRect(0, barH, W, H * 0.62 - barH);
    const floorY = H * 0.62;
    ctx.fillStyle = '#E8D8C8';
    ctx.fillRect(0, floorY, W, H - floorY);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(0, floorY, W, 4);
  }

  _drawTopBar(ctx, W, H) {
    const barH = H * 0.11;
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, '#7A4FA8'); g.addColorStop(1, '#C49BE0');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, barH);
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(0, 0, W, barH * 0.35);
    const fSize = Math.max(14, Math.min(22, barH * 0.42));
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff'; ctx.font = `bold ${fSize}px sans-serif`;
    ctx.textAlign = 'left'; ctx.fillText('👗 VESTIDOR', 20, barH / 2);
    ctx.fillStyle = '#FFE060'; ctx.textAlign = 'right'; ctx.font = `bold ${fSize * 0.9}px sans-serif`;
    ctx.fillText(`💰 ${this.coins} monedas`, W - 70, barH / 2);
    ctx.textBaseline = 'alphabetic';
  }

  _drawDollPanel(ctx, W, H) {
    const barH = H * 0.11;
    const leftW = W * 0.36;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.roundRect(0, barH, leftW, H - barH, [0, 14, 14, 0]); ctx.fill();
    ctx.strokeStyle = 'rgba(120,80,160,0.25)'; ctx.lineWidth = 1.5; ctx.stroke();
    const scale = (H * 0.62) / 300;
    this._paintDoll(ctx, leftW / 2, barH + H * 0.9, scale);
  }

  _drawTabs(ctx, W, H) {
    const barH = H * 0.11, leftW = W * 0.36;
    const tabsY = barH + 8, tabsH = H * 0.09;
    const tabW = (W - leftW) / TABS.length;
    for (let i = 0; i < TABS.length; i++) {
      const tab = TABS[i];
      const tx = leftW + i * tabW, active = this.tab === tab.id;
      ctx.fillStyle = active ? '#7A4FA8' : 'rgba(122,79,168,0.12)';
      ctx.beginPath(); ctx.roundRect(tx + 4, tabsY, tabW - 8, tabsH, 10); ctx.fill();
      ctx.fillStyle = active ? '#fff' : '#7A4FA8';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `${Math.max(14, tabsH * 0.4)}px sans-serif`;
      ctx.fillText(tab.emoji, tx + tabW / 2, tabsY + tabsH * 0.38);
      ctx.font = `bold ${Math.max(9, tabsH * 0.22)}px sans-serif`;
      ctx.fillText(tab.name, tx + tabW / 2, tabsY + tabsH * 0.78);
    }
    ctx.textBaseline = 'alphabetic';
  }

  _cardGeom(W, H) {
    const barH = H * 0.11, leftW = W * 0.36;
    const tabsY = barH + 8, tabsH = H * 0.09;
    const gridY = tabsY + tabsH + 8, gridH = H - gridY - 12;
    const gridX = leftW + 12, gridW = W - gridX - 12;
    return { gridX, gridY, gridW, gridH };
  }

  _drawGrid(ctx, W, H, list, cat, key) {
    const { gridX, gridY, gridW, gridH } = this._cardGeom(W, H);
    const cols = 5, pad = 10;
    const rows = Math.max(1, Math.ceil(list.length / cols));
    const cw = (gridW - (cols - 1) * pad) / cols;
    const ch = Math.min((gridH - (rows - 1) * pad) / rows, cw * 1.15);
    const equipped = this.look[key];
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const col = i % cols, row = Math.floor(i / cols);
      const cx = gridX + col * (cw + pad), cy = gridY + row * (ch + pad);
      this._drawCard(ctx, cx, cy, cw, ch, item, cat, equipped === (item.color || item.id));
    }
  }

  _drawCard(ctx, cx, cy, cw, ch, item, cat, isEquipped) {
    const isOwned = this._isOwned(cat, item);
    const top = item.color || item.main || '#F0D8F0';
    const bot = item.accent || _dc(top, 0.15);
    const cg = ctx.createLinearGradient(cx, cy, cx + cw, cy + ch);
    cg.addColorStop(0, top); cg.addColorStop(1, bot);
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.roundRect(cx, cy, cw, ch, 10); ctx.fill();

    if (isEquipped) {
      ctx.save(); ctx.strokeStyle = '#FF80C0'; ctx.lineWidth = 3;
      ctx.setLineDash([8, 5]); ctx.lineDashOffset = -this.t * 18;
      ctx.beginPath(); ctx.roundRect(cx, cy, cw, ch, 10); ctx.stroke();
      ctx.setLineDash([]); ctx.restore();
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(cx, cy, cw, ch, 10); ctx.stroke();
    }

    ctx.textAlign = 'center';
    if (item.emoji) {
      ctx.font = `${Math.max(16, ch * 0.32)}px sans-serif`;
      ctx.fillText(item.emoji, cx + cw / 2, cy + ch * 0.42);
    } else {
      ctx.fillStyle = top; ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx + cw / 2, cy + ch * 0.35, ch * 0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }

    if (item.name) {
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.font = `bold ${Math.max(8, ch * 0.13)}px sans-serif`;
      ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 3;
      ctx.fillText(item.name, cx + cw / 2, cy + ch * 0.68);
      ctx.shadowBlur = 0;
    }

    if (!isOwned) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.font = `bold ${Math.max(8, ch * 0.15)}px sans-serif`;
      ctx.fillText(`🔒 💰${item.price}`, cx + cw / 2, cy + ch * (item.name ? 0.9 : 0.75));
    } else if (isEquipped) {
      ctx.fillStyle = '#2E7D32';
      ctx.beginPath(); ctx.arc(cx + cw - 11, cy + 11, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.max(8, ch * 0.11)}px sans-serif`;
      ctx.fillText('✓', cx + cw - 11, cy + 15);
    }
  }

  _drawPeloGrid(ctx, W, H) {
    const { gridX, gridY, gridW, gridH } = this._cardGeom(W, H);
    const styleH = gridH * 0.42;
    ctx.fillStyle = '#7A4FA8'; ctx.font = `bold ${Math.max(10, gridH * 0.05)}px sans-serif`;
    ctx.textAlign = 'left'; ctx.fillText('Peinado', gridX, gridY - 4);

    const cols = 5, pad = 10;
    const cw = (gridW - (cols - 1) * pad) / cols;
    for (let i = 0; i < HAIR_STYLES.length; i++) {
      const item = HAIR_STYLES[i];
      const cx = gridX + i * (cw + pad), cy = gridY;
      this._drawCard(ctx, cx, cy, cw, styleH, item, 'pelo_estilo', this.look.hair === item.id);
    }

    const colY = gridY + styleH + 22, colH = gridH - styleH - 22;
    ctx.fillStyle = '#7A4FA8'; ctx.font = `bold ${Math.max(10, gridH * 0.05)}px sans-serif`;
    ctx.fillText('Color', gridX, colY - 4);
    const rows = Math.max(1, Math.ceil(HAIR_COLORS.length / cols));
    const ch = (colH - (rows - 1) * pad) / rows;
    for (let i = 0; i < HAIR_COLORS.length; i++) {
      const item = HAIR_COLORS[i];
      const col = i % cols, row = Math.floor(i / cols);
      const cx = gridX + col * (cw + pad) + cw / 2, cy = colY + row * (ch + pad) + ch / 2;
      const r = Math.min(cw, ch) * 0.42;
      const isOwned = this._isOwned('pelo_color', item);
      const isEquipped = this.look.hairColor === item.color;
      ctx.fillStyle = item.color;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = isEquipped ? '#FF80C0' : 'rgba(0,0,0,0.25)';
      ctx.lineWidth = isEquipped ? 3 : 1.5;
      ctx.stroke();
      if (!isOwned) {
        ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.max(8, r * 0.6)}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('🔒', cx, cy);
        ctx.font = `bold ${Math.max(7, r * 0.42)}px sans-serif`;
        ctx.fillStyle = '#7A4FA8';
        ctx.fillText(`💰${item.price}`, cx, cy + r + 9);
        ctx.textBaseline = 'alphabetic';
      }
    }
  }

  _drawToast(ctx, W, H) {
    const t = this.toast;
    const frac = t.life / t.maxLife;
    const alpha = frac < 0.15 ? frac / 0.15 : frac > 0.75 ? 1 - (frac - 0.75) / 0.25 : 1;
    ctx.save(); ctx.globalAlpha = alpha;
    const tw = Math.min(320, W * 0.5), th = 44;
    const tx = W / 2 - tw / 2, ty = H * 0.11 + 18;
    ctx.fillStyle = '#FFE44D';
    ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, 10); ctx.fill();
    ctx.strokeStyle = '#C8A000'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#3A2800'; ctx.font = `bold ${Math.max(13, th * 0.38)}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(t.msg, W / 2, ty + th / 2);
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  // ── Muñeca (dibujo vectorial, cuerpo entero) ────────────────────────────
  _paintDoll(ctx, cx, cyFeet, scale) {
    const L = this.look;
    const H = 300 * scale;
    ctx.save();
    ctx.translate(cx, cyFeet);

    const headR = H * 0.145, headCy = -H * 0.83;
    const neckY = headCy + headR * 0.85;
    const shY = neckY + H * 0.02;
    const hipY = -H * 0.44;
    const kneeY = -H * 0.22;
    const footY = -H * 0.02;
    const shHalf = H * 0.16, hipHalf = H * 0.14, legHalf = H * 0.055;
    const u = Math.max(1, H * 0.01);

    ctx.save(); ctx.globalAlpha = 0.2; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(0, 2, H * 0.16, H * 0.03, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();

    this._hairBack(ctx, L, headCy, headR, hipY, u);

    ctx.fillStyle = L.skin; ctx.strokeStyle = OC; ctx.lineWidth = u;
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sgn * hipHalf * 0.55, hipY);
      ctx.quadraticCurveTo(sgn * legHalf * 1.3, kneeY, sgn * legHalf, footY - H * 0.05);
      ctx.lineTo(sgn * legHalf * 0.3, footY - H * 0.05);
      ctx.quadraticCurveTo(sgn * legHalf * 0.5, kneeY, sgn * hipHalf * 0.15, hipY);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }

    this._shoes(ctx, L, footY, legHalf, u);
    this._outfitBottom(ctx, L, hipY, kneeY, hipHalf, u);

    ctx.fillStyle = L.skin; ctx.strokeStyle = OC; ctx.lineWidth = u;
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sgn * shHalf * 0.85, shY + H * 0.01);
      ctx.quadraticCurveTo(sgn * shHalf * 1.5, hipY * 0.55, sgn * shHalf * 1.15, hipY * 0.25);
      ctx.quadraticCurveTo(sgn * shHalf * 0.9, hipY * 0.5, sgn * shHalf * 0.55, shY + H * 0.05);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(sgn * shHalf * 1.13, hipY * 0.28, H * 0.028, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }

    this._outfitTop(ctx, L, shY, hipY, kneeY, shHalf, hipHalf, u);

    ctx.fillStyle = L.skin; ctx.strokeStyle = OC; ctx.lineWidth = u;
    ctx.beginPath(); ctx.roundRect(-headR * 0.28, neckY - 2 * u, headR * 0.56, shY - neckY + 4 * u, 4 * u); ctx.fill(); ctx.stroke();

    ctx.beginPath(); ctx.arc(0, headCy, headR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    this._face(ctx, headCy, headR, u);
    this._hairFront(ctx, L, headCy, headR, u);
    this._accessory(ctx, L, headCy, headR, neckY, hipY, u);

    ctx.restore();
  }

  _shoes(ctx, L, footY, legHalf, u) {
    const S = SHOES.find(s => s.id === L.shoes) || SHOES[0];
    ctx.strokeStyle = OC; ctx.lineWidth = u;
    for (const sgn of [-1, 1]) {
      ctx.fillStyle = S.color;
      ctx.beginPath(); ctx.ellipse(sgn * legHalf * 0.6, footY, legHalf * 1.25, legHalf * 0.85, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = S.accent;
      ctx.beginPath(); ctx.ellipse(sgn * legHalf * 0.6, footY + legHalf * 0.5, legHalf * 1.1, legHalf * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  _outfitBottom(ctx, L, hipY, kneeY, hipHalf, u) {
    const O = OUTFITS.find(o => o.id === L.outfit) || OUTFITS[0];
    ctx.strokeStyle = OC; ctx.lineWidth = u;
    if (O.kind === 'vestido') return;
    if (O.kind === 'remera_pollera') {
      const bottomHalf = hipHalf * 1.7;
      ctx.fillStyle = O.accent;
      ctx.beginPath();
      ctx.moveTo(-hipHalf, hipY); ctx.lineTo(hipHalf, hipY);
      ctx.quadraticCurveTo(bottomHalf, (hipY + kneeY) / 2, bottomHalf * 0.9, kneeY);
      ctx.lineTo(-bottomHalf * 0.9, kneeY);
      ctx.quadraticCurveTo(-bottomHalf, (hipY + kneeY) / 2, -hipHalf, hipY);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      this._pattern(ctx, O.pattern, 0, hipY, kneeY, bottomHalf);
    } else if (O.kind === 'overol') {
      const ankleY = kneeY - (hipY - kneeY) * 0.9;
      ctx.fillStyle = O.main;
      for (const sgn of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sgn * hipHalf * 0.15, hipY); ctx.lineTo(sgn * hipHalf * 0.95, hipY);
        ctx.quadraticCurveTo(sgn * hipHalf * 0.85, (hipY + ankleY) / 2, sgn * hipHalf * 0.6, ankleY);
        ctx.lineTo(sgn * hipHalf * 0.1, ankleY);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    } else if (O.kind === 'tutu') {
      for (let i = 0; i < 3; i++) {
        const r = hipHalf * (1.5 + i * 0.35);
        ctx.globalAlpha = 0.85 - i * 0.15;
        ctx.fillStyle = O.accent;
        ctx.beginPath(); ctx.ellipse(0, hipY + (kneeY - hipY) * 0.2, r, r * 0.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (O.kind === 'sirena') {
      ctx.fillStyle = O.main;
      ctx.beginPath();
      ctx.moveTo(-hipHalf, hipY); ctx.lineTo(hipHalf, hipY);
      ctx.lineTo(hipHalf * 0.75, kneeY); ctx.lineTo(-hipHalf * 0.75, kneeY);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      const finY = kneeY - (hipY - kneeY) * 0.55;
      ctx.fillStyle = O.accent;
      ctx.beginPath();
      ctx.moveTo(-hipHalf * 0.75, kneeY);
      ctx.quadraticCurveTo(-hipHalf * 1.5, (kneeY + finY) / 2, -hipHalf * 0.3, finY);
      ctx.lineTo(hipHalf * 0.3, finY);
      ctx.quadraticCurveTo(hipHalf * 1.5, (kneeY + finY) / 2, hipHalf * 0.75, kneeY);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      this._pattern(ctx, O.pattern, 0, hipY, kneeY, hipHalf);
    }
  }

  _outfitTop(ctx, L, shY, hipY, kneeY, shHalf, hipHalf, u) {
    const O = OUTFITS.find(o => o.id === L.outfit) || OUTFITS[0];
    ctx.strokeStyle = OC; ctx.lineWidth = u;
    if (O.kind === 'vestido') {
      const bottomHalf = hipHalf * 1.6;
      ctx.fillStyle = O.main;
      ctx.beginPath();
      ctx.moveTo(-shHalf * 0.9, shY); ctx.lineTo(shHalf * 0.9, shY);
      ctx.quadraticCurveTo(hipHalf * 1.1, (shY + hipY) / 2, hipHalf * 1.05, hipY);
      ctx.quadraticCurveTo(bottomHalf, (hipY + kneeY) / 2, bottomHalf * 0.9, kneeY);
      ctx.lineTo(-bottomHalf * 0.9, kneeY);
      ctx.quadraticCurveTo(-bottomHalf, (hipY + kneeY) / 2, -hipHalf * 1.05, hipY);
      ctx.quadraticCurveTo(-hipHalf * 1.1, (shY + hipY) / 2, -shHalf * 0.9, shY);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = O.accent;
      ctx.fillRect(-hipHalf * 1.05, hipY - hipHalf * 0.1, hipHalf * 2.1, hipHalf * 0.2);
      this._pattern(ctx, O.pattern, 0, shY, kneeY, bottomHalf);
    } else if (O.kind === 'remera_pollera') {
      ctx.fillStyle = O.main;
      ctx.beginPath();
      ctx.moveTo(-shHalf * 0.9, shY); ctx.lineTo(shHalf * 0.9, shY);
      ctx.quadraticCurveTo(hipHalf * 1.05, (shY + hipY) / 2, hipHalf * 0.95, hipY);
      ctx.lineTo(-hipHalf * 0.95, hipY);
      ctx.quadraticCurveTo(-hipHalf * 1.05, (shY + hipY) / 2, -shHalf * 0.9, shY);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      this._pattern(ctx, O.pattern, 0, shY, hipY, shHalf);
    } else if (O.kind === 'overol') {
      ctx.fillStyle = O.accent;
      ctx.beginPath();
      ctx.moveTo(-shHalf * 0.9, shY); ctx.lineTo(shHalf * 0.9, shY);
      ctx.quadraticCurveTo(hipHalf * 1.0, (shY + hipY) / 2, hipHalf * 0.9, hipY);
      ctx.lineTo(-hipHalf * 0.9, hipY);
      ctx.quadraticCurveTo(-hipHalf * 1.0, (shY + hipY) / 2, -shHalf * 0.9, shY);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = O.main;
      const bibHalf = shHalf * 0.55, bibBot = hipY - (shY - hipY) * 0.05;
      ctx.beginPath(); ctx.roundRect(-bibHalf, shY + 2 * u, bibHalf * 2, bibBot - shY, 4 * u); ctx.fill(); ctx.stroke();
      for (const sgn of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(sgn * bibHalf * 0.7, shY + 2 * u); ctx.lineTo(sgn * shHalf * 0.75, shY - 6 * u);
        ctx.lineWidth = 5 * u; ctx.strokeStyle = O.main; ctx.stroke();
        ctx.strokeStyle = OC; ctx.lineWidth = u;
      }
    } else if (O.kind === 'tutu' || O.kind === 'sirena') {
      ctx.fillStyle = O.main;
      ctx.beginPath();
      ctx.moveTo(-shHalf * 0.85, shY); ctx.lineTo(shHalf * 0.85, shY);
      ctx.quadraticCurveTo(hipHalf * 0.9, (shY + hipY) / 2, hipHalf * 0.8, hipY);
      ctx.lineTo(-hipHalf * 0.8, hipY);
      ctx.quadraticCurveTo(-hipHalf * 0.9, (shY + hipY) / 2, -shHalf * 0.85, shY);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }

  _pattern(ctx, kind, cx, top, bottom, halfW) {
    if (kind === 'ninguno') return;
    const n = 6;
    for (let i = 0; i < n; i++) {
      const fx = cx + (Math.sin(i * 2.4) + (i % 2 ? 0.4 : -0.4)) * halfW * 0.7;
      const fy = top + (bottom - top) * ((i + 0.5) / n);
      if (kind === 'flores') this._miniFlower(ctx, fx, fy, halfW * 0.09);
      else if (kind === 'estrellas') this._miniStar(ctx, fx, fy, halfW * 0.08);
      else if (kind === 'brillos') this._miniSpark(ctx, fx, fy, halfW * 0.07);
      else if (kind === 'escamas') { ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(fx, fy, halfW * 0.12, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke(); }
    }
  }
  _miniFlower(ctx, x, y, r) {
    ctx.fillStyle = '#FFFFFF';
    for (let p = 0; p < 5; p++) { const a = p / 5 * Math.PI * 2; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7, r * 0.55, r * 0.35, a, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#FFD24A'; ctx.beginPath(); ctx.arc(x, y, r * 0.35, 0, Math.PI * 2); ctx.fill();
  }
  _miniStar(ctx, x, y, r) {
    ctx.fillStyle = '#FFE066';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + i * (Math.PI * 2 / 5), a2 = a + Math.PI / 5;
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      ctx.lineTo(x + Math.cos(a2) * r * 0.45, y + Math.sin(a2) * r * 0.45);
    }
    ctx.closePath(); ctx.fill();
  }
  _miniSpark(ctx, x, y, r) {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = Math.max(1, r * 0.3);
    ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke();
  }

  _face(ctx, headCy, headR, u) {
    const eR = headR * 0.22, eyeDX = headR * 0.38, eyeY = headCy + headR * 0.05;
    ctx.lineCap = 'round';
    for (const sgn of [-1, 1]) {
      const ex = sgn * eyeDX;
      ctx.fillStyle = '#fff'; ctx.strokeStyle = OC; ctx.lineWidth = 1.4 * u;
      ctx.beginPath(); ctx.ellipse(ex, eyeY, eR, eR * 1.1, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#7A4B2A';
      ctx.beginPath(); ctx.ellipse(ex, eyeY + eR * 0.1, eR * 0.75, eR * 0.9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2A1608';
      ctx.beginPath(); ctx.ellipse(ex, eyeY + eR * 0.15, eR * 0.36, eR * 0.46, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(ex - eR * 0.28, eyeY - eR * 0.35, eR * 0.3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = '#B5536A'; ctx.lineWidth = 2 * u;
    ctx.beginPath(); ctx.arc(0, headCy + headR * 0.42, headR * 0.2, 0.15, Math.PI - 0.15); ctx.stroke();
    ctx.fillStyle = 'rgba(255,130,120,0.28)';
    for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sgn * eyeDX * 1.15, eyeY + eR * 1.15, eR * 0.85, eR * 0.55, 0, 0, Math.PI * 2); ctx.fill(); }
  }

  _hairBack(ctx, L, headCy, headR, hipY, u) {
    if (L.hair !== 'largo' && L.hair !== 'trenza') return;
    const hC = L.hairColor;
    ctx.strokeStyle = OC; ctx.lineWidth = u;
    const g = ctx.createLinearGradient(-headR, headCy, headR, hipY);
    g.addColorStop(0, _lc(hC, 0.2)); g.addColorStop(0.5, hC); g.addColorStop(1, _dc(hC, 0.2));
    ctx.fillStyle = g;
    if (L.hair === 'largo') {
      const halfW = headR * 1.05, bottom = hipY * 0.65;
      ctx.beginPath();
      ctx.moveTo(-headR * 0.5, headCy - headR * 0.3);
      ctx.quadraticCurveTo(-halfW, headCy, -halfW, headCy + headR * 0.8);
      ctx.quadraticCurveTo(-halfW, bottom, -halfW * 0.5, bottom + headR * 0.2);
      ctx.quadraticCurveTo(0, bottom + headR * 0.35, halfW * 0.5, bottom + headR * 0.2);
      ctx.quadraticCurveTo(halfW, bottom, halfW, headCy + headR * 0.8);
      ctx.quadraticCurveTo(halfW, headCy, headR * 0.5, headCy - headR * 0.3);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else {
      const topY = headCy + headR * 0.5, botY = hipY * 0.55, midW = headR * 0.22;
      ctx.beginPath();
      ctx.moveTo(-midW, topY);
      ctx.quadraticCurveTo(-midW * 1.3, (topY + botY) / 2, -midW * 0.5, botY);
      ctx.quadraticCurveTo(0, botY + headR * 0.15, midW * 0.5, botY);
      ctx.quadraticCurveTo(midW * 1.3, (topY + botY) / 2, midW, topY);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = u * 0.8;
      for (let i = 1; i < 5; i++) { const py = topY + (botY - topY) * i / 5; ctx.beginPath(); ctx.moveTo(-midW * 0.8, py); ctx.lineTo(midW * 0.8, py); ctx.stroke(); }
      ctx.fillStyle = '#E08CB0';
      ctx.beginPath(); ctx.arc(0, botY + headR * 0.05, headR * 0.12, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = OC; ctx.lineWidth = u; ctx.stroke();
    }
  }

  _hairFront(ctx, L, headCy, headR, u) {
    const hC = L.hairColor, hL = _lc(hC, 0.3), hD = _dc(hC, 0.15);
    ctx.strokeStyle = OC; ctx.lineWidth = u; ctx.lineJoin = 'round';
    const cap = ctx.createLinearGradient(-headR, headCy - headR, headR, headCy);
    cap.addColorStop(0, hL); cap.addColorStop(0.5, hC); cap.addColorStop(1, hD);
    const topY = headCy - headR, browY = headCy - headR * 0.05;
    ctx.fillStyle = cap;
    ctx.beginPath();
    ctx.moveTo(-headR * 1.02, headCy);
    ctx.quadraticCurveTo(-headR * 1.05, topY + headR * 0.2, -headR * 0.4, topY - 2 * u);
    ctx.quadraticCurveTo(0, topY - 6 * u, headR * 0.4, topY - 2 * u);
    ctx.quadraticCurveTo(headR * 1.05, topY + headR * 0.2, headR * 1.02, headCy);
    ctx.quadraticCurveTo(headR * 0.7, browY + 8 * u, headR * 0.4, browY);
    ctx.quadraticCurveTo(headR * 0.18, browY + 9 * u, 0, browY);
    ctx.quadraticCurveTo(-headR * 0.18, browY + 9 * u, -headR * 0.4, browY);
    ctx.quadraticCurveTo(-headR * 0.7, browY + 8 * u, -headR * 1.02, headCy);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    if (L.hair === 'colitas') {
      for (const sgn of [-1, 1]) {
        ctx.fillStyle = cap;
        ctx.beginPath(); ctx.arc(sgn * headR * 0.95, headCy + headR * 0.05, headR * 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sgn * headR * 1.1, headCy + headR * 0.2);
        ctx.quadraticCurveTo(sgn * headR * 1.35, headCy + headR * 0.9, sgn * headR * 0.85, headCy + headR * 1.5);
        ctx.quadraticCurveTo(sgn * headR * 0.65, headCy + headR * 0.9, sgn * headR * 0.65, headCy + headR * 0.2);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    } else if (L.hair === 'rodete') {
      ctx.fillStyle = cap;
      ctx.beginPath(); ctx.arc(0, topY - headR * 0.12, headR * 0.34, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (L.hair === 'corto') {
      for (const sgn of [-1, 1]) {
        ctx.fillStyle = cap;
        ctx.beginPath(); ctx.ellipse(sgn * headR * 0.92, headCy + headR * 0.15, headR * 0.2, headR * 0.36, sgn * -0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.ellipse(-headR * 0.4, topY + headR * 0.4, headR * 0.3, headR * 0.18, -0.5, 0, Math.PI * 2); ctx.fill();
  }

  _accessory(ctx, L, headCy, headR, neckY, hipY, u) {
    const a = L.accessory;
    ctx.strokeStyle = OC; ctx.lineWidth = u; ctx.lineJoin = 'round';
    if (a === 'moño') {
      const bx = -headR * 0.5, by = headCy - headR * 0.75, r = headR * 0.32;
      ctx.fillStyle = '#E84B7A';
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - r, by - r * 0.7); ctx.lineTo(bx - r, by + r * 0.7); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + r, by - r * 0.7); ctx.lineTo(bx + r, by + r * 0.7); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(bx, by, r * 0.34, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (a === 'lentes') {
      const eyeY = headCy + headR * 0.05, eyeDX = headR * 0.38;
      ctx.strokeStyle = '#222'; ctx.lineWidth = 2 * u; ctx.fillStyle = 'rgba(150,200,255,0.25)';
      for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sgn * eyeDX, eyeY, headR * 0.28, headR * 0.26, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(-eyeDX * 0.4, eyeY); ctx.lineTo(eyeDX * 0.4, eyeY); ctx.stroke();
    } else if (a === 'corona') {
      const cw = headR * 0.9, cy = headCy - headR * 1.0;
      ctx.fillStyle = '#FFD33A';
      ctx.beginPath();
      ctx.moveTo(-cw, cy); ctx.lineTo(-cw, cy - headR * 0.3); ctx.lineTo(-cw * 0.5, cy - headR * 0.05);
      ctx.lineTo(0, cy - headR * 0.4); ctx.lineTo(cw * 0.5, cy - headR * 0.05); ctx.lineTo(cw, cy - headR * 0.3); ctx.lineTo(cw, cy);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#E8403A';
      for (const f of [-0.55, 0, 0.55]) { ctx.beginPath(); ctx.arc(f * cw, cy - headR * 0.02, headR * 0.08, 0, Math.PI * 2); ctx.fill(); }
    } else if (a === 'flor') {
      for (const f of [-0.55, -0.2, 0.2, 0.55]) this._miniFlower(ctx, f * headR, headCy - headR * 0.85, headR * 0.16);
    } else if (a === 'collar') {
      ctx.strokeStyle = '#F0C040'; ctx.lineWidth = headR * 0.08;
      ctx.beginPath(); ctx.arc(0, neckY + headR * 0.15, headR * 0.5, 0.15, Math.PI - 0.15); ctx.stroke();
      ctx.fillStyle = '#FF6090';
      ctx.beginPath(); ctx.arc(0, neckY + headR * 0.55, headR * 0.14, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = OC; ctx.lineWidth = u * 0.8; ctx.stroke();
    } else if (a === 'cartera') {
      const bx = headR * 1.9, by = hipY * 0.3;
      ctx.fillStyle = '#C0407A';
      ctx.beginPath(); ctx.roundRect(bx - headR * 0.32, by, headR * 0.64, headR * 0.5, 6 * u); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(bx, by, headR * 0.28, Math.PI, 0); ctx.stroke();
    }
  }
}
