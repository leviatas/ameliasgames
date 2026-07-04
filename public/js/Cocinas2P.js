const RECIPES = [
  { name: 'Hamburguesa', items: ['🍞', '🥩', '🧀', '🥬'] },
  { name: 'Tacos',       items: ['🌮', '🥩', '🫑', '🥑'] },
  { name: 'Ensalada',    items: ['🥬', '🍅', '🥕', '🥚'] },
  { name: 'Sándwich',    items: ['🍞', '🥚', '🧅', '🥬'] },
  { name: 'Hot Dog',     items: ['🌭', '🧅', '🍅'] },
  { name: 'Stir Fry',   items: ['🥦', '🥕', '🍄', '🫑'] },
  { name: 'Omelette',   items: ['🥚', '🧀', '🫑', '🧅'] },
];

const ALL_INGR = ['🍞','🥩','🧀','🥬','🍅','🥚','🧅','🥕','🍄','🫑','🌮','🥑','🌭','🥦','🌽'];

function pickRecipe() {
  return RECIPES[Math.floor(Math.random() * RECIPES.length)];
}

function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class Cocinas2P {
  constructor(canvas) {
    this.canvas = canvas;
    this._init();
  }

  _init() {
    this.wins  = { p1: 0, p2: 0 };
    this.WIN   = 5;
    this._newRound();
  }

  _newRound() {
    const W = this.canvas.width, H = this.canvas.height;
    this.W = W; this.H = H;
    this.recipe = pickRecipe();

    // Grid of ingredients — recipe items + random fillers, shuffled
    const extras = ALL_INGR.filter(e => !this.recipe.items.includes(e));
    const fillers = shuffled(extras).slice(0, 12 - this.recipe.items.length);
    this.grid = shuffled([...this.recipe.items, ...fillers]);

    this.p1tray = [];
    this.p2tray = [];
    this.phase  = 'playing';
    this.roundWinner = null;
    this.roundTimer  = 0;

    this._buildLayout();
  }

  _buildLayout() {
    const { W, H } = this;
    const HALF = W / 2;
    const BANNER_H = Math.round(H * 0.18);
    const TRAY_H   = Math.round(H * 0.20);
    const GRID_Y   = BANNER_H;
    const GRID_H   = H - BANNER_H - TRAY_H;

    const COLS = 4;
    const ROWS = Math.ceil(this.grid.length / COLS);
    const cellW = Math.floor((HALF - 8) / COLS);
    const cellH = Math.floor(GRID_H / ROWS);

    this._layout = { HALF, BANNER_H, TRAY_H, GRID_Y, GRID_H, COLS, ROWS, cellW, cellH };

    // Tray slots: centred in bottom strip
    const maxSlots = this.recipe.items.length;
    const slotW = Math.min(cellW, Math.floor((HALF - 8) / maxSlots));
    this._trayLayout = { slotW, y: H - TRAY_H, h: TRAY_H, maxSlots };
  }

  _cellRect(idx, side) {
    const { COLS, cellW, cellH, GRID_Y, HALF } = this._layout;
    const col = idx % COLS, row = Math.floor(idx / COLS);
    const ox = side === 'p1' ? 4 : HALF + 4;
    return { x: ox + col * cellW, y: GRID_Y + row * cellH, w: cellW, h: cellH };
  }

  _trayRect(idx, side) {
    const { slotW, y, h } = this._trayLayout;
    const { HALF } = this._layout;
    const ox = side === 'p1' ? 4 + idx * slotW : HALF + 4 + idx * slotW;
    return { x: ox, y, w: slotW, h };
  }

  update(dt) {
    if (this.phase === 'roundEnd') {
      this.roundTimer -= dt;
      if (this.roundTimer <= 0) {
        if (this.wins.p1 >= this.WIN || this.wins.p2 >= this.WIN) {
          this.phase = 'over';
        } else {
          this._newRound();
        }
      }
      return;
    }
    if (this.phase !== 'playing') return;
  }

  _checkRecipe(tray) {
    if (tray.length < this.recipe.items.length) return false;
    for (let i = 0; i < this.recipe.items.length; i++) {
      if (tray[i] !== this.recipe.items[i]) return false;
    }
    return true;
  }

  render(ctx) {
    const { W, H, recipe } = this;
    const { HALF, BANNER_H, TRAY_H, GRID_Y, GRID_H, COLS, ROWS, cellW, cellH } = this._layout;

    // Background — two kitchens
    const g1 = ctx.createLinearGradient(0, 0, 0, H);
    g1.addColorStop(0, '#7a1a3a'); g1.addColorStop(1, '#4a0a22');
    ctx.fillStyle = g1; ctx.fillRect(0, 0, HALF, H);
    const g2 = ctx.createLinearGradient(0, 0, 0, H);
    g2.addColorStop(0, '#1a3a7a'); g2.addColorStop(1, '#0a1e48');
    ctx.fillStyle = g2; ctx.fillRect(HALF, 0, HALF, H);

    // Center divider
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(HALF - 1, 0, 2, H);

    // Recipe banner (full width)
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.fillRect(0, 0, W, BANNER_H);
    ctx.strokeStyle = 'rgba(255,215,0,0.4)'; ctx.lineWidth = 1;
    ctx.strokeRect(0, BANNER_H - 1, W, 1);

    const emojiSize = Math.round(BANNER_H * 0.40);
    const recipeItems = recipe.items;
    const itemW  = emojiSize * 1.6;
    const totalW = recipeItems.length * itemW + (recipeItems.length - 1) * 6;
    let rx = (W - totalW) / 2;
    const ry = BANNER_H / 2;

    ctx.font = `bold ${Math.round(BANNER_H * 0.24)}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFD700';
    ctx.fillText(recipe.name, W / 2, ry * 0.32);

    ctx.font = `${emojiSize}px system-ui`;
    for (let i = 0; i < recipeItems.length; i++) {
      ctx.fillText(recipeItems[i], rx + itemW / 2, ry * 1.08);
      if (i < recipeItems.length - 1) {
        ctx.font = `bold ${Math.round(emojiSize * 0.5)}px system-ui`;
        ctx.fillStyle = '#ffffff55';
        ctx.fillText('→', rx + itemW + 3, ry * 1.08);
        ctx.font = `${emojiSize}px system-ui`;
        ctx.fillStyle = 'rgba(255,255,255,1)';
      }
      rx += itemW + 6;
    }

    // Ingredient grids — P1 and P2
    for (const side of ['p1', 'p2']) {
      const tray = side === 'p1' ? this.p1tray : this.p2tray;
      for (let i = 0; i < this.grid.length; i++) {
        const r = this._cellRect(i, side);
        const emoji = this.grid[i];
        const inRecipe = recipe.items.includes(emoji);
        const alreadyInTray = tray.includes(emoji);

        // Cell background
        ctx.fillStyle = alreadyInTray
          ? 'rgba(255,255,255,0.10)'
          : (inRecipe ? 'rgba(255,235,120,0.22)' : 'rgba(255,255,255,0.16)');
        ctx.beginPath(); ctx.roundRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4, 8); ctx.fill();
        ctx.strokeStyle = alreadyInTray ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.40)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4, 8); ctx.stroke();

        // Emoji
        const fs = Math.round(Math.min(r.w, r.h) * 0.52);
        ctx.font = `${fs}px system-ui`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.globalAlpha = alreadyInTray ? 0.4 : 1;
        ctx.fillText(emoji, r.x + r.w / 2, r.y + r.h / 2);
        ctx.globalAlpha = 1;
      }

      // Tray
      const trayBg = ctx.createLinearGradient(0, H - TRAY_H, 0, H);
      trayBg.addColorStop(0, 'rgba(0,0,0,0.18)'); trayBg.addColorStop(1, 'rgba(0,0,0,0.35)');
      const ox = side === 'p1' ? 0 : HALF;
      ctx.fillStyle = trayBg;
      ctx.fillRect(ox, H - TRAY_H, HALF, TRAY_H);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ox, H - TRAY_H); ctx.lineTo(ox + HALF, H - TRAY_H); ctx.stroke();

      const maxSlots = recipe.items.length;
      for (let i = 0; i < maxSlots; i++) {
        const sr = this._trayRect(i, side);
        ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(sr.x + 3, sr.y + 4, sr.w - 6, sr.h - 8, 6); ctx.stroke();
        if (tray[i]) {
          const sf = Math.round(Math.min(sr.w, sr.h) * 0.50);
          ctx.font = `${sf}px system-ui`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(tray[i], sr.x + sr.w / 2, sr.y + sr.h / 2);
        }
      }

      // Round winner celebration
      const isWinner = this.roundWinner === side;
      if (isWinner && this.phase === 'roundEnd') {
        ctx.fillStyle = 'rgba(255,215,0,0.18)';
        ctx.fillRect(ox, 0, HALF, H);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `900 ${Math.round(H * 0.12)}px system-ui`;
        ctx.fillStyle = '#FFD700';
        ctx.fillText('¡LISTO!', ox + HALF / 2, H / 2);
      }
    }

    // Player labels & win dots
    const dotR = Math.max(6, H * 0.022);
    ctx.font = `bold ${Math.round(BANNER_H * 0.22)}px system-ui`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';  ctx.fillStyle = '#FF88BB'; ctx.fillText('P1', 8, GRID_Y + 14);
    ctx.textAlign = 'right'; ctx.fillStyle = '#88BBFF'; ctx.fillText('P2', W - 8, GRID_Y + 14);

    for (let i = 0; i < this.WIN; i++) {
      ctx.beginPath(); ctx.arc(8 + (dotR * 2.2) * i + dotR, GRID_Y + 32, dotR, 0, Math.PI * 2);
      ctx.fillStyle = i < this.wins.p1 ? '#FF88BB' : 'rgba(255,136,187,0.2)'; ctx.fill();
    }
    for (let i = 0; i < this.WIN; i++) {
      ctx.beginPath(); ctx.arc(W - 8 - (dotR * 2.2) * i - dotR, GRID_Y + 32, dotR, 0, Math.PI * 2);
      ctx.fillStyle = i < this.wins.p2 ? '#88BBFF' : 'rgba(136,187,255,0.2)'; ctx.fill();
    }

    // Over screen
    if (this.phase === 'over') {
      ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const winner = this.wins.p1 >= this.WIN ? 'P1' : 'P2';
      ctx.font = `900 ${H * 0.18}px system-ui`;
      ctx.fillStyle = winner === 'P1' ? '#FF88BB' : '#88BBFF';
      ctx.fillText(`¡Ganó ${winner}!`, W / 2, H * 0.38);
      ctx.font = `bold ${H * 0.09}px system-ui`; ctx.fillStyle = '#ffffffaa';
      ctx.fillText(`${this.wins.p1}  :  ${this.wins.p2}`, W / 2, H * 0.57);
      ctx.font = `${H * 0.07}px system-ui`; ctx.fillStyle = '#ffffff55';
      ctx.fillText('Tocá para jugar de nuevo', W / 2, H * 0.72);
    }
  }

  pointerDown(cx, cy, player) {
    if (this.phase === 'over') { this._init(); return; }
    if (this.phase !== 'playing') return;

    const tray  = player === 'p1' ? this.p1tray : this.p2tray;
    const maxSl = this.recipe.items.length;

    // Check tray slots first (remove item)
    for (let i = 0; i < tray.length; i++) {
      const sr = this._trayRect(i, player);
      if (cx >= sr.x && cx < sr.x + sr.w && cy >= sr.y && cy < sr.y + sr.h) {
        tray.splice(i, 1);
        return;
      }
    }

    // Check ingredient grid
    for (let i = 0; i < this.grid.length; i++) {
      const r = this._cellRect(i, player);
      if (cx >= r.x && cx < r.x + r.w && cy >= r.y && cy < r.y + r.h) {
        const emoji = this.grid[i];
        if (!tray.includes(emoji) && tray.length < maxSl) {
          tray.push(emoji);
          if (this._checkRecipe(tray)) this._winRound(player);
        }
        return;
      }
    }
  }

  _winRound(player) {
    this.wins[player]++;
    this.roundWinner = player;
    this.phase       = 'roundEnd';
    this.roundTimer  = 1.6;
  }

  pointerMove() {}
  pointerUp() {}

  // ── Online sync: host broadcasts this every frame, guest applies it ──────
  getNetState() {
    return {
      W: this.W, H: this.H,
      recipe: this.recipe, grid: this.grid,
      p1tray: this.p1tray, p2tray: this.p2tray,
      phase: this.phase, roundWinner: this.roundWinner, roundTimer: this.roundTimer,
      wins: this.wins,
      layout: this._layout, trayLayout: this._trayLayout,
    };
  }

  setNetState(s) {
    this.W = s.W; this.H = s.H;
    this.recipe = s.recipe; this.grid = s.grid;
    this.p1tray = s.p1tray; this.p2tray = s.p2tray;
    this.phase = s.phase; this.roundWinner = s.roundWinner; this.roundTimer = s.roundTimer;
    this.wins = s.wins;
    this._layout = s.layout; this._trayLayout = s.trayLayout;
  }
}
