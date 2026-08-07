// ── Mancala (2P, por turnos) ─────────────────────────────────────────────────
// Se levanta todo lo que hay en un hoyo propio y se va sembrando de a una
// semilla en sentido antihorario, salteando el granero del rival. Si la última
// cae en tu granero, volvés a jugar; si cae en un hoyo tuyo que estaba vacío,
// te llevás esa semilla y todas las de enfrente. Gana quien junta más.
//
// Índices: 0..5 hoyos de P1 (fila de abajo, izq→der), 6 granero de P1,
// 7..12 hoyos de P2 (fila de arriba, der→izq), 13 granero de P2.
// El opuesto de cualquier hoyo i es 12 - i.

const P1_STORE = 6, P2_STORE = 13;
const SOW_DT = 0.16;            // segundos entre semilla y semilla

const isP1Pit = (i) => i >= 0 && i <= 5;
const isP2Pit = (i) => i >= 7 && i <= 12;
const ownPit = (p, i) => (p === 'p1' ? isP1Pit(i) : isP2Pit(i));
const storeOf = (p) => (p === 'p1' ? P1_STORE : P2_STORE);

export class Mancala {
  constructor(canvas) {
    this.canvas = canvas;
    this._reset();
  }

  _reset() {
    const W = this.canvas.width, H = this.canvas.height;
    this.W = W; this.H = H;
    this.phase = 'playing';   // 'playing' | 'over'
    this.turn = Math.random() < 0.5 ? 'p1' : 'p2';
    this.pits = Array(14).fill(4);
    this.pits[P1_STORE] = 0; this.pits[P2_STORE] = 0;
    this.sow = null;          // {hand, left, player} mientras siembra
    this.sowT = 0;
    this.msg = null;          // cartelito del último efecto
    this.msgT = 0;
    this.winner = null;

    this._layout();
  }

  _layout() {
    const W = this.W, H = this.H;
    const boardW = W * 0.94, boardH = Math.min(H * 0.46, boardW * 0.42);
    const x0 = W / 2 - boardW / 2, y0 = H / 2 - boardH / 2;
    const storeW = boardW * 0.13;
    const pitArea = boardW - storeW * 2 - boardW * 0.06;
    const pitR = Math.min(pitArea / 6, boardH / 2) * 0.40;
    const gap = pitArea / 6;
    const firstX = x0 + storeW + boardW * 0.03 + gap / 2;
    this._geo = { boardW, boardH, x0, y0, storeW, pitR, gap, firstX,
                  topY: y0 + boardH * 0.27, botY: y0 + boardH * 0.73 };
  }

  // Centro en pantalla de cada hoyo/granero.
  _pitPos(i) {
    const g = this._geo;
    if (i === P1_STORE) return { x: g.x0 + g.boardW - g.storeW / 2, y: g.y0 + g.boardH / 2 };
    if (i === P2_STORE) return { x: g.x0 + g.storeW / 2, y: g.y0 + g.boardH / 2 };
    if (isP1Pit(i)) return { x: g.firstX + i * g.gap, y: g.botY };
    return { x: g.firstX + (12 - i) * g.gap, y: g.topY };   // fila de arriba, al revés
  }

  // Siguiente índice en sentido antihorario, salteando el granero del rival.
  _next(i, player) {
    let n = (i + 1) % 14;
    if (player === 'p1' && n === P2_STORE) n = 0;
    if (player === 'p2' && n === P1_STORE) n = 7;
    return n;
  }

  _sideEmpty(player) {
    const [a, b] = player === 'p1' ? [0, 5] : [7, 12];
    for (let i = a; i <= b; i++) if (this.pits[i] > 0) return false;
    return true;
  }

  // Un lado vacío termina la partida: el otro se lleva lo que le quedó.
  _checkEnd() {
    if (!this._sideEmpty('p1') && !this._sideEmpty('p2')) return false;
    for (let i = 0; i <= 5; i++)  { this.pits[P1_STORE] += this.pits[i]; this.pits[i] = 0; }
    for (let i = 7; i <= 12; i++) { this.pits[P2_STORE] += this.pits[i]; this.pits[i] = 0; }
    this.phase = 'over';
    const a = this.pits[P1_STORE], b = this.pits[P2_STORE];
    this.winner = a === b ? 'empate' : a > b ? 'p1' : 'p2';
    return true;
  }

  // La última semilla ya cayó: se resuelve turno extra, captura o cambio.
  _finishSow(landed, player) {
    this.sow = null;
    if (landed === storeOf(player)) {
      this.msg = '¡Otra vez!'; this.msgT = 1.1;
      if (!this._checkEnd()) this.turn = player;   // el turno no cambia
      return;
    }
    // captura: la última cayó en un hoyo propio que estaba vacío
    if (ownPit(player, landed) && this.pits[landed] === 1) {
      const opp = 12 - landed;
      if (this.pits[opp] > 0) {
        const got = this.pits[opp] + 1;         // las de enfrente más la que cayó
        this.pits[opp] = 0; this.pits[landed] = 0;
        this.pits[storeOf(player)] += got;
        this.msg = `¡Captura de ${got}!`; this.msgT = 1.3;
      }
    }
    if (this._checkEnd()) return;
    this.turn = player === 'p1' ? 'p2' : 'p1';
  }

  update(dt) {
    if (this.msgT > 0) this.msgT = Math.max(0, this.msgT - dt);
    if (!this.sow) return;
    this.sowT -= dt;
    if (this.sowT > 0) return;
    this.sowT = SOW_DT;
    const s = this.sow;
    s.hand = this._next(s.hand, s.player);
    this.pits[s.hand]++;
    s.left--;
    if (s.left <= 0) this._finishSow(s.hand, s.player);
  }

  pointerDown(cx, cy, player) {
    if (this.phase === 'over') { this._reset(); return; }
    if (player && player !== this.turn) return;
    if (this.sow) return;                       // no se toca mientras siembra
    const g = this._geo;
    for (let i = 0; i < 14; i++) {
      if (i === P1_STORE || i === P2_STORE) continue;
      if (!ownPit(this.turn, i)) continue;
      if (this.pits[i] === 0) continue;
      const p = this._pitPos(i);
      const dx = cx - p.x, dy = cy - p.y;
      if (dx * dx + dy * dy > (g.pitR * 1.35) ** 2) continue;
      this.sow = { hand: i, left: this.pits[i], player: this.turn };
      this.pits[i] = 0;
      this.sowT = SOW_DT;
      this.msg = null; this.msgT = 0;
      return;
    }
  }
  pointerMove() {}
  pointerUp() {}

  // Posiciones fijas (pero desordenadas) para las semillas dentro de un hoyo.
  _seedSpot(pitIdx, k, r) {
    const a = Math.sin(pitIdx * 12.9898 + k * 78.233) * 43758.5453;
    const b = Math.sin(pitIdx * 39.3467 + k * 11.135) * 24634.6345;
    const ang = (a - Math.floor(a)) * Math.PI * 2;
    const rad = Math.sqrt(b - Math.floor(b)) * r;
    return { dx: Math.cos(ang) * rad, dy: Math.sin(ang) * rad };
  }

  render(ctx) {
    const { W, H } = this;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#132a1c'); bg.addColorStop(1, '#08150e');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    if (this.phase === 'playing') {
      const cfg = this.turn === 'p1' ? { color: '#FF88BB', name: 'P1' } : { color: '#88BBFF', name: 'P2' };
      ctx.font = `900 ${H * 0.05}px system-ui`;
      ctx.fillStyle = cfg.color;
      ctx.fillText(`Turno de ${cfg.name}`, W / 2, H * 0.05);
    }
    ctx.font = `${H * 0.032}px system-ui`; ctx.fillStyle = '#ffffff55';
    ctx.fillText(this.turn === 'p1' ? 'tocá un hoyo de abajo' : 'tocá un hoyo de arriba', W / 2, H * 0.115);

    const g = this._geo;
    ctx.fillStyle = '#7A4B22';
    ctx.beginPath(); ctx.roundRect(g.x0, g.y0, g.boardW, g.boardH, g.boardH * 0.22); ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,170,0.25)'; ctx.lineWidth = Math.max(2, g.boardH * 0.012);
    ctx.beginPath(); ctx.roundRect(g.x0, g.y0, g.boardW, g.boardH, g.boardH * 0.22); ctx.stroke();

    // graneros
    for (const [idx, color] of [[P1_STORE, '#FF4488'], [P2_STORE, '#4488FF']]) {
      const p = this._pitPos(idx);
      const rw = g.storeW * 0.72, rh = g.boardH * 0.66;
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.beginPath(); ctx.roundRect(p.x - rw / 2, p.y - rh / 2, rw, rh, rw * 0.45); ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, g.pitR * 0.10);
      ctx.beginPath(); ctx.roundRect(p.x - rw / 2, p.y - rh / 2, rw, rh, rw * 0.45); ctx.stroke();
      this._drawSeeds(ctx, idx, p, Math.min(rw, rh) * 0.36);
      ctx.fillStyle = color; ctx.font = `900 ${g.pitR * 0.75}px system-ui`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(this.pits[idx]), p.x, p.y + rh / 2 + g.pitR * 0.62);
    }

    // hoyos
    for (let i = 0; i < 14; i++) {
      if (i === P1_STORE || i === P2_STORE) continue;
      const p = this._pitPos(i);
      const playable = this.phase === 'playing' && !this.sow &&
                       ownPit(this.turn, i) && this.pits[i] > 0;
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.beginPath(); ctx.arc(p.x, p.y, g.pitR, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = playable ? (this.turn === 'p1' ? '#FF88BB' : '#88BBFF') : 'rgba(255,220,170,0.18)';
      ctx.lineWidth = playable ? Math.max(2, g.pitR * 0.12) : Math.max(1, g.pitR * 0.05);
      ctx.beginPath(); ctx.arc(p.x, p.y, g.pitR, 0, Math.PI * 2); ctx.stroke();
      this._drawSeeds(ctx, i, p, g.pitR * 0.62);
      ctx.fillStyle = '#ffffffcc'; ctx.font = `900 ${g.pitR * 0.52}px system-ui`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const off = isP1Pit(i) ? g.pitR * 1.5 : -g.pitR * 1.5;
      ctx.fillText(String(this.pits[i]), p.x, p.y + off);
    }

    // la mano que va sembrando
    if (this.sow) {
      const p = this._pitPos(this.sow.hand);
      ctx.fillStyle = '#FFD700';
      ctx.beginPath(); ctx.arc(p.x, p.y, g.pitR * 0.22, 0, Math.PI * 2); ctx.fill();
    }

    if (this.msgT > 0 && this.msg) {
      ctx.globalAlpha = Math.min(1, this.msgT * 2);
      ctx.fillStyle = '#FFD700'; ctx.font = `900 ${H * 0.055}px system-ui`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(this.msg, W / 2, this._geo.y0 - H * 0.045);
      ctx.globalAlpha = 1;
    }

    if (this.phase === 'over') {
      ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `900 ${H * 0.13}px system-ui`;
      if (this.winner === 'empate') { ctx.fillStyle = '#FFD700'; ctx.fillText('🤝 ¡Empate!', W / 2, H * 0.4); }
      else {
        const cfg = this.winner === 'p1' ? { color: '#FF88BB', name: 'P1' } : { color: '#88BBFF', name: 'P2' };
        ctx.fillStyle = cfg.color; ctx.fillText(`¡Ganó ${cfg.name}!`, W / 2, H * 0.4);
      }
      ctx.font = `900 ${H * 0.06}px system-ui`; ctx.fillStyle = '#ffffffcc';
      ctx.fillText(`${this.pits[P1_STORE]} — ${this.pits[P2_STORE]}`, W / 2, H * 0.52);
      ctx.font = `${H * 0.05}px system-ui`; ctx.fillStyle = '#ffffff66';
      ctx.fillText('Tocá para jugar de nuevo', W / 2, H * 0.62);
    }
  }

  _drawSeeds(ctx, idx, p, spread) {
    const n = Math.min(this.pits[idx], 14);   // más de 14 no entran ni se distinguen
    const sr = Math.max(1.5, this._geo.pitR * 0.15);
    for (let k = 0; k < n; k++) {
      const s = this._seedSpot(idx, k, spread);
      ctx.fillStyle = k % 3 === 0 ? '#FFD98A' : k % 3 === 1 ? '#FF9E6B' : '#9BE38A';
      ctx.beginPath(); ctx.arc(p.x + s.dx, p.y + s.dy, sr, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ── Online sync: host broadcasts this every frame, guest applies it ──────
  getNetState() {
    return {
      W: this.W, H: this.H, geo: this._geo,
      phase: this.phase, turn: this.turn, pits: this.pits,
      sow: this.sow, sowT: this.sowT, msg: this.msg, msgT: this.msgT, winner: this.winner,
    };
  }

  setNetState(s) {
    this.W = s.W; this.H = s.H; this._geo = s.geo;
    this.phase = s.phase; this.turn = s.turn; this.pits = s.pits;
    this.sow = s.sow; this.sowT = s.sowT; this.msg = s.msg; this.msgT = s.msgT; this.winner = s.winner;
  }
}
