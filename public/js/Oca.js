// ── La Oca (2P, por turnos) ──────────────────────────────────────────────────
// Se tira el dado y se avanza por un recorrido serpenteante lleno de premios y
// castigos. Es puro azar a propósito: una nena chica le puede ganar a un grande.
// Llegar a la última casilla (o pasarse) gana — sin la regla de la vuelta atrás,
// que para chicos es sólo frustrante.

const CELLS = 32;               // 0 = salida, 31 = meta
const COLS = 8, ROWS = 4;

// Casillas especiales. 'oca' salta a la oca siguiente y regala otra tirada.
const SPECIAL = {
  4:  { k: 'oca' },   9:  { k: 'oca' },   14: { k: 'oca' },
  19: { k: 'oca' },   24: { k: 'oca' },   28: { k: 'oca' },
  6:  { k: 'puente', to: 12 },
  11: { k: 'dado',   to: 17 },
  17: { k: 'pozo',   skip: 2 },
  21: { k: 'laberinto', to: 15 },
  26: { k: 'calavera', to: 0 },
};
const LABEL = {
  oca: '🦢', puente: '🌉', dado: '🎲', pozo: '🕳️', laberinto: '🌀', calavera: '💀',
};
const HOP_DT = 0.13;            // segundos por casilla saltada
const ROLL_T = 0.55;            // cuánto dura la animación del dado

export class Oca {
  constructor(canvas) {
    this.canvas = canvas;
    this._reset();
  }

  _reset() {
    const W = this.canvas.width, H = this.canvas.height;
    this.W = W; this.H = H;
    this.phase = 'playing';   // 'playing' | 'over'
    this.turn = Math.random() < 0.5 ? 'p1' : 'p2';
    this.pos = { p1: 0, p2: 0 };
    this.skip = { p1: 0, p2: 0 };     // turnos que debe perder en el pozo
    this.state = 'idle';      // 'idle' | 'rolling' | 'hopping' | 'effect'
    this.die = 1;
    this.t = 0;
    this.hopLeft = 0;
    this.again = false;       // el efecto regala otra tirada
    this.msg = null;
    this.winner = null;

    this._layout();
  }

  _layout() {
    const W = this.W, H = this.H;
    const boardW = W * 0.94;
    const cell = Math.min(boardW / COLS, H * 0.62 / ROWS);
    const gw = cell * COLS, gh = cell * ROWS;
    this._geo = { cell, x0: W / 2 - gw / 2, y0: H * 0.30, gw, gh };
  }

  // El recorrido serpentea: fila 0 de izq a der, fila 1 al revés, etc.
  _cellPos(i) {
    const g = this._geo;
    const row = Math.floor(i / COLS);
    const inRow = i % COLS;
    const col = row % 2 === 0 ? inRow : COLS - 1 - inRow;
    return { x: g.x0 + col * g.cell + g.cell / 2, y: g.y0 + row * g.cell + g.cell / 2 };
  }

  _otherPlayer(p) { return p === 'p1' ? 'p2' : 'p1'; }

  // Cierra el turno: pasa al rival, salteando a quien esté en el pozo.
  _endTurn(player) {
    if (this.again) { this.again = false; this.state = 'idle'; this.turn = player; return; }
    let next = this._otherPlayer(player);
    if (this.skip[next] > 0) {
      this.skip[next]--;
      this.msg = `${next === 'p1' ? 'P1' : 'P2'} está en el pozo 🕳️`;
      next = player;                 // vuelve a jugar el mismo
    } else {
      this.msg = null;
    }
    this.turn = next;
    this.state = 'idle';
  }

  // Aplica la casilla donde cayó y arma el cartelito.
  _applySpecial(player) {
    const at = this.pos[player];
    if (at >= CELLS - 1) {
      this.phase = 'over'; this.winner = player; this.state = 'idle'; return;
    }
    const sp = SPECIAL[at];
    if (!sp) { this.msg = null; this._endTurn(player); return; }

    if (sp.k === 'oca') {
      const next = Object.keys(SPECIAL)
        .map(Number).filter(n => n > at && SPECIAL[n].k === 'oca').sort((a, b) => a - b)[0];
      this.pos[player] = next === undefined ? CELLS - 1 : next;
      this.msg = '🦢 De oca a oca ¡y tiro porque me toca!';
      this.again = true;
    } else if (sp.k === 'puente') {
      this.pos[player] = sp.to;
      this.msg = '🌉 ¡Del puente al puente y tiro porque me lleva la corriente!';
      this.again = true;
    } else if (sp.k === 'dado') {
      this.pos[player] = sp.to;
      this.msg = '🎲 ¡De dado a dado y tiro porque me ha tocado!';
      this.again = true;
    } else if (sp.k === 'pozo') {
      this.skip[player] = sp.skip;
      this.msg = '🕳️ ¡Al pozo! Perdés 2 turnos';
    } else if (sp.k === 'laberinto') {
      this.pos[player] = sp.to;
      this.msg = '🌀 ¡Al laberinto! Volvés a la ' + (sp.to + 1);
    } else if (sp.k === 'calavera') {
      this.pos[player] = sp.to;
      this.msg = '💀 ¡A empezar de nuevo!';
    }

    if (this.pos[player] >= CELLS - 1) { this.phase = 'over'; this.winner = player; this.state = 'idle'; return; }
    this.state = 'effect';
    this.t = 1.4;
  }

  update(dt) {
    if (this.phase === 'over') return;
    if (this.state === 'rolling') {
      this.t -= dt;
      // el dado va cambiando de cara mientras rueda
      if (Math.floor(this.t * 22) % 2 === 0) this.die = 1 + Math.floor(Math.random() * 6);
      if (this.t <= 0) {
        this.die = 1 + Math.floor(Math.random() * 6);
        this.hopLeft = this.die;
        this.state = 'hopping';
        this.t = HOP_DT;
      }
    } else if (this.state === 'hopping') {
      this.t -= dt;
      if (this.t > 0) return;
      this.t = HOP_DT;
      const p = this.turn;
      this.pos[p] = Math.min(CELLS - 1, this.pos[p] + 1);
      this.hopLeft--;
      if (this.hopLeft <= 0 || this.pos[p] >= CELLS - 1) this._applySpecial(p);
    } else if (this.state === 'effect') {
      this.t -= dt;
      if (this.t <= 0) this._endTurn(this.turn);
    }
  }

  pointerDown(cx, cy, player) {
    if (this.phase === 'over') { this._reset(); return; }
    if (player && player !== this.turn) return;
    if (this.state !== 'idle') return;      // sólo se tira cuando está quieto
    this.msg = null;
    this.state = 'rolling';
    this.t = ROLL_T;
  }
  pointerMove() {}
  pointerUp() {}

  render(ctx) {
    const { W, H } = this;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#2b1836'); bg.addColorStop(1, '#140a1c');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    const g = this._geo;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    if (this.phase === 'playing') {
      const cfg = this.turn === 'p1' ? { color: '#FF88BB', name: 'P1' } : { color: '#88BBFF', name: 'P2' };
      ctx.font = `900 ${H * 0.05}px system-ui`; ctx.fillStyle = cfg.color;
      ctx.fillText(`Turno de ${cfg.name}`, W / 2, H * 0.055);
      if (this.state === 'idle') {
        ctx.font = `${H * 0.034}px system-ui`; ctx.fillStyle = '#ffffff66';
        ctx.fillText('tocá para tirar el dado', W / 2, H * 0.105);
      }
    }

    // el dado, arriba del tablero
    const dS = Math.min(W, H) * 0.10;
    const dx = W / 2 - dS / 2, dy = H * 0.145;
    ctx.fillStyle = '#FFF6E0';
    ctx.beginPath(); ctx.roundRect(dx, dy, dS, dS, dS * 0.2); ctx.fill();
    ctx.fillStyle = '#2A1A10';
    const pipR = dS * 0.09;
    const PIPS = {
      1: [[.5,.5]], 2: [[.28,.28],[.72,.72]], 3: [[.26,.26],[.5,.5],[.74,.74]],
      4: [[.28,.28],[.72,.28],[.28,.72],[.72,.72]],
      5: [[.26,.26],[.74,.26],[.5,.5],[.26,.74],[.74,.74]],
      6: [[.28,.24],[.72,.24],[.28,.5],[.72,.5],[.28,.76],[.72,.76]],
    };
    for (const [px, py] of PIPS[this.die] || PIPS[1]) {
      ctx.beginPath(); ctx.arc(dx + px * dS, dy + py * dS, pipR, 0, Math.PI * 2); ctx.fill();
    }

    // La senda por debajo de las casillas. Sin esto el recorrido serpenteante no
    // se entiende: la meta queda justo abajo de la salida y parecen vecinas.
    ctx.strokeStyle = 'rgba(255,220,120,0.22)';
    ctx.lineWidth = g.cell * 0.30; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < CELLS; i++) {
      const p = this._cellPos(i);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    // flechitas en los codos, para que se vea hacia dónde sigue
    ctx.fillStyle = 'rgba(255,220,120,0.55)';
    for (let i = 3; i < CELLS - 1; i += 4) {
      const a = this._cellPos(i), b = this._cellPos(i + 1);
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, s = g.cell * 0.13;
      ctx.save(); ctx.translate(mx, my); ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(-s * 0.7, s * 0.7); ctx.lineTo(-s * 0.7, -s * 0.7);
      ctx.closePath(); ctx.fill(); ctx.restore();
    }

    // recorrido
    for (let i = 0; i < CELLS; i++) {
      const p = this._cellPos(i);
      const r = g.cell * 0.42;
      const sp = SPECIAL[i];
      ctx.fillStyle = i === CELLS - 1 ? '#FFD700'
                    : i === 0 ? '#7ED9A0'
                    : sp ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.07)';
      ctx.beginPath(); ctx.roundRect(p.x - r, p.y - r, r * 2, r * 2, r * 0.35); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(p.x - r, p.y - r, r * 2, r * 2, r * 0.35); ctx.stroke();

      if (i === CELLS - 1) { ctx.font = `${r * 1.1}px system-ui`; ctx.fillText('🏆', p.x, p.y); }
      else if (i === 0) { ctx.font = `${r * 0.95}px system-ui`; ctx.fillText('🏁', p.x, p.y); }
      else if (sp) { ctx.font = `${r * 0.95}px system-ui`; ctx.fillText(LABEL[sp.k], p.x, p.y); }
      else {
        ctx.fillStyle = '#ffffff44'; ctx.font = `700 ${r * 0.55}px system-ui`;
        ctx.fillText(String(i + 1), p.x, p.y);
      }
    }

    // fichas: si comparten casilla se corren un poco para que se vean las dos
    const same = this.pos.p1 === this.pos.p2;
    for (const [pl, color] of [['p1', '#FF4488'], ['p2', '#4488FF']]) {
      const p = this._cellPos(this.pos[pl]);
      const off = same ? (pl === 'p1' ? -g.cell * 0.16 : g.cell * 0.16) : 0;
      const r = g.cell * 0.22;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(p.x + off, p.y + r * 0.9, r * 0.9, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(p.x + off, p.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffffffaa'; ctx.lineWidth = Math.max(1.5, r * 0.16);
      ctx.beginPath(); ctx.arc(p.x + off, p.y, r, 0, Math.PI * 2); ctx.stroke();
    }

    if (this.msg) {
      ctx.font = `900 ${Math.min(H * 0.038, W * 0.042)}px system-ui`;
      ctx.fillStyle = '#FFD700';
      ctx.fillText(this.msg, W / 2, g.y0 + g.gh + H * 0.055);
    }

    if (this.phase === 'over') {
      ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, W, H);
      ctx.font = `900 ${H * 0.14}px system-ui`;
      const cfg = this.winner === 'p1' ? { color: '#FF88BB', name: 'P1' } : { color: '#88BBFF', name: 'P2' };
      ctx.fillStyle = cfg.color; ctx.fillText(`🏆 ¡Ganó ${cfg.name}!`, W / 2, H * 0.42);
      ctx.font = `${H * 0.055}px system-ui`; ctx.fillStyle = '#ffffff66';
      ctx.fillText('Tocá para jugar de nuevo', W / 2, H * 0.58);
    }
  }

  // ── Online sync: host broadcasts this every frame, guest applies it ──────
  getNetState() {
    return {
      W: this.W, H: this.H, geo: this._geo,
      phase: this.phase, turn: this.turn, pos: this.pos, skip: this.skip,
      state: this.state, die: this.die, t: this.t, hopLeft: this.hopLeft,
      again: this.again, msg: this.msg, winner: this.winner,
    };
  }

  setNetState(s) {
    this.W = s.W; this.H = s.H; this._geo = s.geo;
    this.phase = s.phase; this.turn = s.turn; this.pos = s.pos; this.skip = s.skip;
    this.state = s.state; this.die = s.die; this.t = s.t; this.hopLeft = s.hopLeft;
    this.again = s.again; this.msg = s.msg; this.winner = s.winner;
  }
}
