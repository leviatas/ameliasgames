// ── Molino / Nine Men's Morris (2P, por turnos) ──────────────────────────────
// Tres anillos de 8 puntos unidos por cuatro radios. Primero cada una pone sus
// 9 fichas; después se mueven de a un punto vecino. Cada vez que alineás tres
// (un "molino") le comés una ficha al rival. Perdés si te quedan 2 fichas o si
// no te queda ningún movimiento. Con 3 fichas podés "volar" a cualquier punto
// libre, que es la regla que le da chance al que va perdiendo.

// Los 24 puntos, en coordenadas de una grilla 0..6. Anillo exterior 0-7,
// intermedio 8-15, interior 16-23; cada uno arranca arriba a la izquierda y
// sigue en sentido horario.
const PTS = [
  [0,0],[3,0],[6,0],[6,3],[6,6],[3,6],[0,6],[0,3],          // 0..7   exterior
  [1,1],[3,1],[5,1],[5,3],[5,5],[3,5],[1,5],[1,3],          // 8..15  intermedio
  [2,2],[3,2],[4,2],[4,3],[4,4],[3,4],[2,4],[2,3],          // 16..23 interior
];

// Los 16 molinos: 4 lados por anillo + los 4 radios.
const MILLS = [
  [0,1,2],[2,3,4],[4,5,6],[6,7,0],
  [8,9,10],[10,11,12],[12,13,14],[14,15,8],
  [16,17,18],[18,19,20],[20,21,22],[22,23,16],
  [1,9,17],[3,11,19],[5,13,21],[7,15,23],
];

// Vecinos: dentro de cada anillo se avanza de a uno, y los puntos del medio de
// cada lado (1,3,5,7 y sus equivalentes) se enganchan con el anillo de al lado.
const ADJ = (() => {
  const a = Array.from({ length: 24 }, () => []);
  for (const base of [0, 8, 16]) {
    for (let k = 0; k < 8; k++) {
      a[base + k].push(base + (k + 1) % 8, base + (k + 7) % 8);
    }
  }
  for (const k of [1, 3, 5, 7]) {
    a[k].push(k + 8); a[k + 8].push(k, k + 16); a[k + 16].push(k + 8);
  }
  return a;
})();

const PER_PLAYER = 9;

export class Molino {
  constructor(canvas) {
    this.canvas = canvas;
    this._reset();
  }

  _reset() {
    const W = this.canvas.width, H = this.canvas.height;
    this.W = W; this.H = H;
    this.phase = 'placing';   // 'placing' | 'moving' | 'removing' | 'over'
    this.turn = Math.random() < 0.5 ? 'p1' : 'p2';
    this.board = Array(24).fill(null);
    this.toPlace = { p1: PER_PLAYER, p2: PER_PLAYER };
    this.onBoard = { p1: 0, p2: 0 };
    this.sel = -1;            // ficha propia elegida en la fase de movimiento
    this.lastMill = null;
    this.msg = null;
    this.msgT = 0;
    this.winner = null;

    this._layout();
  }

  _layout() {
    const size = Math.min(this.W * 0.86, this.H * 0.78);
    this._geo = { size, x0: this.W / 2 - size / 2, y0: this.H * 0.155, u: size / 6 };
  }

  _pos(i) {
    const g = this._geo;
    return { x: g.x0 + PTS[i][0] * g.u, y: g.y0 + PTS[i][1] * g.u };
  }

  _pointAt(cx, cy) {
    const r = this._geo.u * 0.45;
    for (let i = 0; i < 24; i++) {
      const p = this._pos(i);
      const dx = cx - p.x, dy = cy - p.y;
      if (dx * dx + dy * dy <= r * r) return i;
    }
    return -1;
  }

  _millsWith(i, player) {
    return MILLS.filter(m => m.includes(i) && m.every(k => this.board[k] === player));
  }
  _inAnyMill(i, player) {
    return MILLS.some(m => m.includes(i) && m.every(k => this.board[k] === player));
  }

  // ¿Puede volar? Con 3 fichas se mueve a cualquier punto libre.
  _canFly(player) {
    return this.toPlace[player] === 0 && this.onBoard[player] === 3;
  }

  _hasMove(player) {
    if (this.toPlace[player] > 0) return true;
    if (this._canFly(player)) return this.board.some(v => !v);
    for (let i = 0; i < 24; i++) {
      if (this.board[i] !== player) continue;
      if (ADJ[i].some(j => !this.board[j])) return true;
    }
    return false;
  }

  _other(p) { return p === 'p1' ? 'p2' : 'p1'; }

  // Después de cada jugada: ¿alguien perdió?
  _checkOver(justMoved) {
    const rival = this._other(justMoved);
    if (this.toPlace[rival] === 0 && this.onBoard[rival] < 3) {
      this.phase = 'over'; this.winner = justMoved; return true;
    }
    if (!this._hasMove(rival)) {
      this.phase = 'over'; this.winner = justMoved;
      this.msg = 'sin movimientos posibles';
      return true;
    }
    return false;
  }

  _afterPlay(player, formedMill) {
    if (formedMill) {
      // Comer sólo se puede si al rival le queda alguna ficha fuera de molino;
      // si están todas en molinos, se puede comer cualquiera.
      const rival = this._other(player);
      const targets = this._removable(rival);
      if (targets.length) {
        this.phase = 'removing';
        this.msg = '¡Molino! Tocá una ficha del rival';
        this.msgT = 2.2;
        return;
      }
    }
    this._passTurn(player);
  }

  _removable(rival) {
    const all = [];
    for (let i = 0; i < 24; i++) if (this.board[i] === rival) all.push(i);
    const free = all.filter(i => !this._inAnyMill(i, rival));
    return free.length ? free : all;
  }

  _passTurn(player) {
    if (this._checkOver(player)) return;
    this.turn = this._other(player);
    this.sel = -1;
    this.phase = (this.toPlace.p1 === 0 && this.toPlace.p2 === 0) ? 'moving' : 'placing';
  }

  update(dt) { if (this.msgT > 0) this.msgT = Math.max(0, this.msgT - dt); }

  pointerDown(cx, cy, player) {
    if (this.phase === 'over') { this._reset(); return; }
    if (player && player !== this.turn) return;
    const i = this._pointAt(cx, cy);
    if (i < 0) return;
    const me = this.turn, rival = this._other(me);

    if (this.phase === 'removing') {
      if (this.board[i] !== rival) return;
      if (!this._removable(rival).includes(i)) {
        this.msg = 'esa está en un molino'; this.msgT = 1.6; return;
      }
      this.board[i] = null;
      this.onBoard[rival]--;
      this.msg = null; this.msgT = 0;
      this._passTurn(me);
      return;
    }

    if (this.phase === 'placing') {
      if (this.board[i]) return;
      this.board[i] = me;
      this.toPlace[me]--;
      this.onBoard[me]++;
      const mills = this._millsWith(i, me);
      this.lastMill = mills.length ? mills[0] : null;
      this._afterPlay(me, mills.length > 0);
      return;
    }

    // fase de movimiento: primero se elige la ficha, después el destino
    if (this.board[i] === me) { this.sel = this.sel === i ? -1 : i; return; }
    if (this.sel < 0 || this.board[i]) return;
    if (!this._canFly(me) && !ADJ[this.sel].includes(i)) {
      this.msg = 'sólo a un punto pegado'; this.msgT = 1.6; return;
    }
    this.board[this.sel] = null;
    this.board[i] = me;
    this.sel = -1;
    const mills = this._millsWith(i, me);
    this.lastMill = mills.length ? mills[0] : null;
    this._afterPlay(me, mills.length > 0);
  }
  pointerMove() {}
  pointerUp() {}

  render(ctx) {
    const { W, H } = this;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1c1430'); bg.addColorStop(1, '#0c0818');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    const g = this._geo;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    if (this.phase !== 'over') {
      const cfg = this.turn === 'p1' ? { color: '#FF88BB', name: 'P1' } : { color: '#88BBFF', name: 'P2' };
      ctx.font = `900 ${H * 0.048}px system-ui`; ctx.fillStyle = cfg.color;
      ctx.fillText(`Turno de ${cfg.name}`, W / 2, H * 0.055);
      ctx.font = `${H * 0.032}px system-ui`; ctx.fillStyle = '#ffffff66';
      const hint = this.phase === 'removing' ? 'comé una ficha del rival'
                 : this.phase === 'placing'  ? `te quedan ${this.toPlace[this.turn]} por poner`
                 : this._canFly(this.turn)   ? '¡podés volar a donde quieras!'
                 : this.sel >= 0 ? 'tocá a dónde la movés' : 'tocá una ficha tuya';
      ctx.fillText(hint, W / 2, H * 0.105);
    }

    // los tres cuadrados y los cuatro radios
    ctx.strokeStyle = 'rgba(255,220,170,0.30)';
    ctx.lineWidth = Math.max(2, g.u * 0.05);
    for (const k of [0, 8, 16]) {
      ctx.beginPath();
      for (let n = 0; n < 8; n++) {
        const p = this._pos(k + n);
        if (n === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath(); ctx.stroke();
    }
    ctx.beginPath();
    for (const k of [1, 3, 5, 7]) {
      const a = this._pos(k), b = this._pos(k + 16);
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();

    // destinos posibles de la ficha elegida
    if (this.phase === 'moving' && this.sel >= 0) {
      const dests = this._canFly(this.turn)
        ? this.board.map((v, i) => (v ? -1 : i)).filter(i => i >= 0)
        : ADJ[this.sel].filter(j => !this.board[j]);
      ctx.fillStyle = 'rgba(255,215,0,0.25)';
      for (const d of dests) {
        const p = this._pos(d);
        ctx.beginPath(); ctx.arc(p.x, p.y, g.u * 0.26, 0, Math.PI * 2); ctx.fill();
      }
    }

    const rival = this._other(this.turn);
    const comibles = this.phase === 'removing' ? this._removable(rival) : [];

    for (let i = 0; i < 24; i++) {
      const p = this._pos(i), v = this.board[i];
      if (!v) {
        ctx.fillStyle = 'rgba(255,255,255,0.13)';
        ctx.beginPath(); ctx.arc(p.x, p.y, g.u * 0.09, 0, Math.PI * 2); ctx.fill();
        continue;
      }
      const r = g.u * 0.28;
      const enMolino = this.lastMill && this.lastMill.includes(i);
      ctx.fillStyle = v === 'p1' ? '#FF4488' : '#4488FF';
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.beginPath(); ctx.ellipse(p.x - r * 0.3, p.y - r * 0.34, r * 0.4, r * 0.24, -0.5, 0, Math.PI * 2); ctx.fill();
      if (i === this.sel) {
        ctx.strokeStyle = '#FFD700'; ctx.lineWidth = g.u * 0.09;
        ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.25, 0, Math.PI * 2); ctx.stroke();
      } else if (comibles.includes(i)) {
        ctx.strokeStyle = '#FF5050'; ctx.lineWidth = g.u * 0.07;
        ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.2, 0, Math.PI * 2); ctx.stroke();
      } else if (enMolino) {
        ctx.strokeStyle = '#FFD700'; ctx.lineWidth = g.u * 0.06;
        ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.15, 0, Math.PI * 2); ctx.stroke();
      }
    }

    // fichas que quedan por poner, a los costados
    ctx.font = `900 ${H * 0.032}px system-ui`;
    for (const [pl, color, x] of [['p1', '#FF4488', W * 0.06], ['p2', '#4488FF', W * 0.94]]) {
      ctx.fillStyle = color;
      ctx.fillText(pl === 'p1' ? 'P1' : 'P2', x, this._geo.y0);
      const n = this.toPlace[pl];
      for (let k = 0; k < n; k++) {
        ctx.beginPath();
        ctx.arc(x, this._geo.y0 + g.u * 0.42 + k * g.u * 0.30, g.u * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (this.msgT > 0 && this.msg) {
      ctx.globalAlpha = Math.min(1, this.msgT * 2);
      ctx.fillStyle = '#FFD700'; ctx.font = `900 ${H * 0.042}px system-ui`;
      ctx.fillText(this.msg, W / 2, g.y0 + g.size + H * 0.055);
      ctx.globalAlpha = 1;
    }

    if (this.phase === 'over') {
      ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, W, H);
      ctx.font = `900 ${H * 0.14}px system-ui`;
      const cfg = this.winner === 'p1' ? { color: '#FF88BB', name: 'P1' } : { color: '#88BBFF', name: 'P2' };
      ctx.fillStyle = cfg.color; ctx.fillText(`¡Ganó ${cfg.name}!`, W / 2, H * 0.4);
      if (this.msg) { ctx.font = `${H * 0.045}px system-ui`; ctx.fillStyle = '#ffffff99'; ctx.fillText(this.msg, W / 2, H * 0.52); }
      ctx.font = `${H * 0.05}px system-ui`; ctx.fillStyle = '#ffffff66';
      ctx.fillText('Tocá para jugar de nuevo', W / 2, H * 0.62);
    }
  }

  // ── Online sync: host broadcasts this every frame, guest applies it ──────
  getNetState() {
    return {
      W: this.W, H: this.H, geo: this._geo,
      phase: this.phase, turn: this.turn, board: this.board,
      toPlace: this.toPlace, onBoard: this.onBoard, sel: this.sel,
      lastMill: this.lastMill, msg: this.msg, msgT: this.msgT, winner: this.winner,
    };
  }

  setNetState(s) {
    this.W = s.W; this.H = s.H; this._geo = s.geo;
    this.phase = s.phase; this.turn = s.turn; this.board = s.board;
    this.toPlace = s.toPlace; this.onBoard = s.onBoard; this.sel = s.sel;
    this.lastMill = s.lastMill; this.msg = s.msg; this.msgT = s.msgT; this.winner = s.winner;
  }
}
