import { Character, onSpriteReady } from './Character.js';
import { getCoins, spendCoins, getWardrobe, addToWardrobe, getEquippedId, setEquippedId } from './Wallet.js';

export const CATALOG = [
  { id:'base',             name:'Ropa Base',       emoji:'👕', price:0,   topColor:'#B8D8F0', botColor:'#88B8E0', cfg:{ outfitSprite: null } },
  { id:'vestido_rosa',     name:'Vestido Rosa',    emoji:'👗', price:90,  topColor:'#F9C8D8', botColor:'#E89AB8', cfg:{ outfitSprite:'/assets/outfits/vestido_rosa.png' } },
  { id:'mariposa_dorada',  name:'Mariposa Dorada', emoji:'🦋', price:120, topColor:'#F5D060', botColor:'#C89010', cfg:{ outfitSprite:'/assets/outfits/mariposa_dorada.png' } },
  { id:'rock_star',        name:'Rock Star',        emoji:'🎸', price:100, topColor:'#3A3A3A', botColor:'#222222', cfg:{ outfitSprite:'/assets/outfits/rock_star.png' } },
];

const COLS = 4;
const ROWS = 4;
const PAD  = 14;

export class Tienda {
  constructor(canvas, getLook, setLook) {
    this.canvas  = canvas;
    this.getLook = getLook;
    this.setLook = setLook;
    this.t        = 0;
    this.selected = null;
    this.toast    = null;
    this._refreshState();
    this._previewChar = null;
    onSpriteReady(() => { this._previewChar = new Character(0, 0, {}); });
  }

  _refreshState() {
    this.coins    = getCoins();
    this.owned    = getWardrobe();
    this.equipped = getEquippedId();
  }

  update(dt) {
    this.t += dt;
    if (this.toast) {
      this.toast.life += dt;
      if (this.toast.life >= this.toast.maxLife) this.toast = null;
    }
    this._refreshState();
  }

  _toast(msg) { this.toast = { msg, life: 0, maxLife: 1.8 }; }

  _buy() {
    const item = CATALOG[this.selected];
    if (!item) return;
    if (this.owned[item.id]) { this._equip(); return; }
    if (!spendCoins(item.price)) { this._toast('Sin monedas 😢'); return; }
    addToWardrobe(item.id);
    this._refreshState();
    this._toast(`¡Comprado! 💰-${item.price}`);
  }

  _equip() {
    const item = CATALOG[this.selected];
    if (!item || !this.owned[item.id]) return;
    setEquippedId(item.id);
    const newLook = Object.assign({}, this.getLook(), item.cfg);
    this.setLook(newLook);
    this._refreshState();
    this._toast('¡Puesto! ✓');
  }

  pointer(px, py) {
    const W = this.canvas.width, H = this.canvas.height;
    const barH    = H * 0.11;
    const leftW   = W * 0.28;
    const gridX   = leftW + PAD;
    const gridW   = W - gridX - PAD;
    const gridY   = barH + PAD * 2;
    const gridH   = H - gridY - PAD;
    const cardW   = (gridW - (COLS - 1) * PAD) / COLS;
    const cardH   = (gridH - (ROWS - 1) * PAD) / ROWS;

    // Check grid cards
    for (let i = 0; i < CATALOG.length; i++) {
      const col = i % COLS, row = Math.floor(i / COLS);
      const cx = gridX + col * (cardW + PAD);
      const cy = gridY + row * (cardH + PAD);
      if (px >= cx && px <= cx + cardW && py >= cy && py <= cy + cardH) {
        this.selected = i;
        return;
      }
    }

    // Check buy/use button in left panel
    if (this.selected !== null && px < leftW) {
      const btnH = 46, btnW = leftW * 0.8, btnX = leftW * 0.1;
      const btnY = H - 80;
      if (px >= btnX && px <= btnX + btnW && py >= btnY && py <= btnY + btnH) {
        const item = CATALOG[this.selected];
        if (!item) return;
        if (this.equipped === item.id) return;
        if (this.owned[item.id]) { this._equip(); } else { this._buy(); }
      }
    }
  }

  render(ctx) {
    const W = this.canvas.width, H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);
    this._drawBg(ctx, W, H);
    this._drawTopBar(ctx, W, H);
    this._drawLeftPanel(ctx, W, H);
    this._drawGrid(ctx, W, H);
    if (this.toast) this._drawToast(ctx, W, H);
  }

  _drawBg(ctx, W, H) {
    const barH = H * 0.11;

    // Wall
    const wallG = ctx.createLinearGradient(0, barH, 0, H * 0.62);
    wallG.addColorStop(0, '#FFE0EE');
    wallG.addColorStop(1, '#FFC8DE');
    ctx.fillStyle = wallG;
    ctx.fillRect(0, barH, W, H * 0.62 - barH);

    // Clothes hangers on back wall
    ctx.save();
    ctx.strokeStyle = 'rgba(200,120,160,0.35)';
    const positions = [W * 0.12, W * 0.35, W * 0.58, W * 0.81];
    for (const hx of positions) {
      const railY = barH + H * 0.07;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(hx - 30, railY); ctx.lineTo(hx + 30, railY); ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(hx, railY); ctx.lineTo(hx, railY + 18); ctx.stroke();
      // 3 hangers
      for (let hi = -1; hi <= 1; hi++) {
        const hgx = hx + hi * 18;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(hgx, railY); ctx.moveTo(hgx - 8, railY + 16); ctx.lineTo(hgx, railY + 4); ctx.lineTo(hgx + 8, railY + 16); ctx.stroke();
        ctx.beginPath(); ctx.arc(hgx, railY, 3, 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.restore();

    // "BOUTIQUE" neon sign
    ctx.save();
    ctx.textAlign = 'center';
    const signY = barH + H * 0.065;
    ctx.shadowColor = '#FF40A0';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#FF80C0';
    ctx.font = `bold ${Math.max(12, H * 0.038)}px sans-serif`;
    ctx.fillText('✨ BOUTIQUE ✨', W / 2, signY);
    ctx.shadowBlur = 0;
    ctx.restore();

    // Checkerboard floor
    const floorY = H * 0.62;
    const tileS = Math.max(20, H * 0.055);
    for (let fy = floorY; fy < H; fy += tileS) {
      for (let fx = 0; fx < W; fx += tileS) {
        const even = (Math.floor(fx / tileS) + Math.floor(fy / tileS)) % 2 === 0;
        ctx.fillStyle = even ? '#FFF0F6' : '#FFE0EE';
        ctx.fillRect(fx, fy, tileS, tileS);
      }
    }

    // Shop counter bottom strip
    ctx.fillStyle = '#E0607A';
    ctx.fillRect(0, H - 28, W, 28);
    ctx.fillStyle = '#F0809A';
    ctx.fillRect(0, H - 28, W, 6);
  }

  _drawTopBar(ctx, W, H) {
    const barH = H * 0.11;
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, '#C02080');
    g.addColorStop(1, '#E040A0');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, barH);

    // Shine
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(0, 0, W, barH * 0.35);

    const fSize = Math.max(14, Math.min(22, barH * 0.42));
    ctx.textBaseline = 'middle';

    // Title
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${fSize}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('👗 TIENDA DE ROPA', 20, barH / 2);

    // Coins
    ctx.fillStyle = '#FFE060';
    ctx.textAlign = 'right';
    ctx.font = `bold ${fSize * 0.9}px sans-serif`;
    ctx.fillText(`💰 ${this.coins} monedas`, W - 70, barH / 2);

    ctx.textBaseline = 'alphabetic';
  }

  _drawLeftPanel(ctx, W, H) {
    const barH = H * 0.11;
    const leftW = W * 0.28;

    // Panel bg
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.roundRect(0, barH, leftW, H - barH, [0, 14, 14, 0]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,100,160,0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Label: "Vista previa" si hay selección, "Tu personaje" si no
    const selectedItem = this.selected !== null ? CATALOG[this.selected] : null;
    const isEquippedSelected = selectedItem && this.equipped === selectedItem.id;
    ctx.fillStyle = '#C02080';
    ctx.font = `bold ${Math.max(11, H * 0.025)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(selectedItem && !isEquippedSelected ? 'Vista previa' : 'Tu personaje', leftW / 2, barH + H * 0.055);

    // Character preview — siempre muestra el outfit seleccionado
    const previewCx = leftW / 2;
    const previewCyFeet = barH + H * 0.44;
    const previewScale = (H * 0.28) / 132;
    if (this._previewChar) {
      const previewLook = this.getLook();
      if (selectedItem) {
        Object.assign(this._previewChar.cfg, previewLook, selectedItem.cfg);
      } else {
        Object.assign(this._previewChar.cfg, previewLook);
      }
      ctx.save();
      this._previewChar.drawPreview(ctx, previewCx, previewCyFeet, previewScale);
      ctx.restore();
    }

    // Selected item info
    const item = this.selected !== null ? CATALOG[this.selected] : null;
    const infoY = barH + H * 0.52;

    if (item) {
      // Item name + emoji
      ctx.font = `${Math.max(22, H * 0.05)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#333';
      ctx.fillText(item.emoji, leftW / 2, infoY);

      ctx.font = `bold ${Math.max(11, H * 0.024)}px sans-serif`;
      ctx.fillStyle = '#222';
      ctx.fillText(item.name, leftW / 2, infoY + H * 0.06);

      ctx.font = `${Math.max(10, H * 0.022)}px sans-serif`;
      ctx.fillStyle = '#B8860B';
      ctx.fillText(`💰 ${item.price}`, leftW / 2, infoY + H * 0.1);

      // Buy/Use button
      const isOwned    = !!this.owned[item.id];
      const isEquipped = this.equipped === item.id;
      const canAfford  = this.coins >= item.price;

      const btnW = leftW * 0.8, btnH = 46;
      const btnX = leftW * 0.1, btnY = H - 88;

      let btnColor, btnText, btnTextColor;
      if (isEquipped) {
        btnColor = '#A0A0A0'; btnText = '✓ PUESTO'; btnTextColor = '#fff';
      } else if (isOwned) {
        btnColor = '#4CAF50'; btnText = 'USAR ✓'; btnTextColor = '#fff';
      } else if (!canAfford) {
        btnColor = '#CCC'; btnText = 'SIN MONEDAS'; btnTextColor = '#888';
      } else {
        btnColor = '#E040A0'; btnText = `COMPRAR 💰${item.price}`; btnTextColor = '#fff';
      }

      ctx.fillStyle = btnColor;
      ctx.beginPath();
      ctx.roundRect(btnX, btnY, btnW, btnH, 10);
      ctx.fill();

      ctx.fillStyle = btnTextColor;
      ctx.font = `bold ${Math.max(11, H * 0.022)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(btnText, btnX + btnW / 2, btnY + btnH / 2 + 5);
    } else {
      ctx.font = `${Math.max(10, H * 0.022)}px sans-serif`;
      ctx.fillStyle = '#999';
      ctx.textAlign = 'center';
      ctx.fillText('Tocá un outfit', leftW / 2, infoY + H * 0.04);
      ctx.fillText('para ver detalles', leftW / 2, infoY + H * 0.08);
    }
  }

  _drawGrid(ctx, W, H) {
    const barH  = H * 0.11;
    const leftW = W * 0.28;
    const gridX = leftW + PAD;
    const gridW = W - gridX - PAD;
    const gridY = barH + PAD * 2;
    const gridH = H - gridY - PAD;
    const cardW = (gridW - (COLS - 1) * PAD) / COLS;
    const cardH = (gridH - (ROWS - 1) * PAD) / ROWS;

    for (let i = 0; i < CATALOG.length; i++) {
      const item = CATALOG[i];
      const col = i % COLS, row = Math.floor(i / COLS);
      const cx = gridX + col * (cardW + PAD);
      const cy = gridY + row * (cardH + PAD);

      const isSelected = this.selected === i;
      const isOwned    = !!this.owned[item.id];
      const isEquipped = this.equipped === item.id;

      // Card gradient
      const cg = ctx.createLinearGradient(cx, cy, cx + cardW, cy + cardH);
      cg.addColorStop(0, item.topColor);
      cg.addColorStop(1, item.botColor);
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.roundRect(cx, cy, cardW, cardH, 10);
      ctx.fill();

      // Border
      if (isEquipped) {
        // Animated dashed pink border
        ctx.save();
        ctx.strokeStyle = '#FF80C0';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 5]);
        ctx.lineDashOffset = -this.t * 18;
        ctx.beginPath(); ctx.roundRect(cx, cy, cardW, cardH, 10); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      } else if (isSelected) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.roundRect(cx, cy, cardW, cardH, 10); ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(cx, cy, cardW, cardH, 10); ctx.stroke();
      }

      // Owned badge top-right
      if (isOwned) {
        ctx.fillStyle = '#2E7D32';
        ctx.beginPath();
        ctx.arc(cx + cardW - 12, cy + 12, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.max(8, cardH * 0.11)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('✓', cx + cardW - 12, cy + 16);
      }

      // Emoji
      const emojiSize = Math.max(18, cardH * 0.32);
      ctx.font = `${emojiSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(item.emoji, cx + cardW / 2, cy + cardH * 0.42);

      // Name
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.font = `bold ${Math.max(9, cardH * 0.13)}px sans-serif`;
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 3;
      ctx.fillText(item.name, cx + cardW / 2, cy + cardH * 0.66);

      // Price
      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      ctx.font = `${Math.max(8, cardH * 0.11)}px sans-serif`;
      ctx.fillText(`💰${item.price}`, cx + cardW / 2, cy + cardH * 0.84);
      ctx.shadowBlur = 0;
    }
  }

  _drawToast(ctx, W, H) {
    const t = this.toast;
    const frac = t.life / t.maxLife;
    const alpha = frac < 0.15 ? frac / 0.15 : frac > 0.75 ? 1 - (frac - 0.75) / 0.25 : 1;

    ctx.save();
    ctx.globalAlpha = alpha;

    const tw = Math.min(320, W * 0.5);
    const th = 44;
    const tx = W / 2 - tw / 2;
    const ty = H * 0.11 + 18;

    ctx.fillStyle = '#FFE44D';
    ctx.beginPath();
    ctx.roundRect(tx, ty, tw, th, 10);
    ctx.fill();

    ctx.strokeStyle = '#C8A000';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#3A2800';
    ctx.font = `bold ${Math.max(13, th * 0.38)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t.msg, W / 2, ty + th / 2);
    ctx.textBaseline = 'alphabetic';

    ctx.restore();
  }
}
