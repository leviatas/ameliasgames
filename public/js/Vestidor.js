// ── Vestidor de Moda ─────────────────────────────────────────────────────────
// Juego de 1 jugador, estilo "Avatar World": vestir a una nena combinando piel,
// peinado + color de pelo, ropa, zapatos y accesorios. Este archivo es sólo la
// pantalla (pestañas, grilla, compras); el dibujo de la muñeca vive en
// Muneca.js, que comparte con Mi Mundo. El inventario y las monedas salen de
// Wallet.js, igual que en la Tienda de Ropa.
import { getCoins, spendCoins, getWardrobe, addToWardrobe } from './Wallet.js';
import {
  SKIN_TONES, HAIR_STYLES, HAIR_COLORS, OUTFITS, SHOES, ACCESSORIES,
  loadLook, saveLook, paintDoll, drawOutfitThumb, darken,
} from './Muneca.js';

// se re-exportan para que el resto del juego (y los tests) los sigan viendo acá
export { SKIN_TONES, HAIR_STYLES, HAIR_COLORS, OUTFITS, SHOES, ACCESSORIES };

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
    this.look = loadLook();
    this._refresh();
  }

  _refresh() { this.coins = getCoins(); this.owned = getWardrobe(); }
  _save() { saveLook(this.look); }
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
    // el botón "← Menú" del overlay ocupa la esquina: dejarle lugar
    ctx.fillText(`💰 ${this.coins}`, W - 125, barH / 2);
    ctx.textBaseline = 'alphabetic';
  }

  _drawDollPanel(ctx, W, H) {
    const barH = H * 0.11;
    const leftW = W * 0.36;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.roundRect(0, barH, leftW, H - barH, [0, 14, 14, 0]); ctx.fill();
    ctx.strokeStyle = 'rgba(120,80,160,0.25)'; ctx.lineWidth = 1.5; ctx.stroke();
    // la muñeca ocupa casi todo el panel, con los pies apoyados cerca del borde
    const panelH = H - barH;
    paintDoll(ctx, this.look, leftW / 2, H - panelH * 0.06, (panelH * 0.86) / 300);
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

  // achica la tipografía hasta que el texto entre en el ancho pedido
  _fitFont(ctx, text, maxW, size, weight = 'bold') {
    let s = Math.round(size);
    ctx.font = `${weight} ${s}px sans-serif`;
    while (s > 7 && ctx.measureText(text).width > maxW) {
      s -= 1; ctx.font = `${weight} ${s}px sans-serif`;
    }
    return s;
  }

  _drawCard(ctx, cx, cy, cw, ch, item, cat, isEquipped) {
    const isOwned = this._isOwned(cat, item);
    const top = item.color || item.main || '#F0D8F0';
    const bot = item.accent || darken(top, 0.15);
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
    if (cat === 'ropa' && drawOutfitThumb(ctx, cx + cw / 2, cy + ch * 0.58, ch * 0.5, item.id)) {
      // la tarjeta muestra el sprite real de la prenda
    } else if (item.emoji) {
      ctx.font = `${Math.max(16, ch * 0.32)}px sans-serif`;
      ctx.fillText(item.emoji, cx + cw / 2, cy + ch * 0.42);
    } else {
      ctx.fillStyle = top; ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx + cw / 2, cy + ch * 0.35, ch * 0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }

    if (item.name) {
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      this._fitFont(ctx, item.name, cw - 10, Math.max(8, ch * 0.13));
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

  // Miniatura de una prenda para la tarjeta: usa las mismas fracciones que la
  // muñeca, pero sin cuerpo. `bodyH` es la altura que tendría el cuerpo.
  // Devuelve false si todavía no cargó el sprite (la tarjeta cae al emoji).
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

  // ¿Cargaron el cuerpo y TODAS las piezas de la ropa elegida? Si falta alguna
  // se dibuja todo vectorial, así no se ve el cuerpo desnudo mientras cargan.
}
