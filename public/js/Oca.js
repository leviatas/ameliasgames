// ── La Oca (2P, por turnos) ──────────────────────────────────────────────────
// Se tira el dado y se avanza por un recorrido serpenteante lleno de premios y
// castigos. Es puro azar a propósito: una nena chica le puede ganar a un grande.
// Llegar a la última casilla (o pasarse) gana — sin la regla de la vuelta atrás,
// que para chicos es sólo frustrante.

const CELLS = 32;               // 0 = salida, 31 = meta

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
// [color de fondo, color del brillo] de cada tipo de casilla.
const SPECIAL_COL = {
  oca:       ['#F5A623', '#FFE9A8'],
  puente:    ['#4FA8E8', '#CFE9FF'],
  dado:      ['#E86FAE', '#FFD3E8'],
  pozo:      ['#7B68B6', '#C7BCE8'],
  laberinto: ['#3FBF9B', '#B6F0DF'],
  calavera:  ['#E85F55', '#FFC0B9'],
};
const PLAIN_COL = [
  ['#F0C46A', '#FFEFC2'], ['#9FD167', '#E0F5BE'],
  ['#6FC0DE', '#D3EFFA'], ['#E8A0C8', '#FCDDEE'],
];
const START_COL = ['#3EB878', '#B6F0D0'];
const GOAL_COL  = ['#F2B705', '#FFF0A0'];

const HOP_DT = 0.13;            // segundos por casilla saltada
const ROLL_T = 0.55;            // cuánto dura la animación del dado

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;

// PRNG con semilla fija: el decorado del jardín queda igual en las dos pantallas
// (y entre partidas) sin tener que mandarlo por la red.
function seeded(n) {
  let s = 20260819 + n * 7919;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

export class Oca {
  constructor(canvas) {
    this.canvas = canvas;
    this._deco = this._makeDeco();
    this._reset();
  }

  // Todo el decorado en coordenadas 0..1 para que no dependa del tamaño real
  // del canvas (el invitado online tiene otro).
  _makeDeco() {
    const r = seeded(3);
    const clouds = Array.from({ length: 4 }, () => ({
      x: r(), y: 0.02 + r() * 0.13, s: 0.7 + r() * 0.6, v: 0.004 + r() * 0.006,
    }));
    const flowers = Array.from({ length: 22 }, () => ({
      x: r(), y: 0.30 + r() * 0.68, s: 0.6 + r() * 0.7, c: Math.floor(r() * 4),
    }));
    const bushes = Array.from({ length: 7 }, () => ({ x: r(), s: 0.7 + r() * 0.6 }));
    return { clouds, flowers, bushes };
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

  // En pantalla vertical el recorrido pasa a 4×8: si no, las casillas quedan
  // diminutas porque el ancho manda.
  _layout() {
    const W = this.W, H = this.H;
    const cols = W / H < 1.15 ? 4 : 8, rows = CELLS / cols;
    const cell = Math.min(W * 0.92 / cols, H * 0.63 / rows);
    const gw = cell * cols, gh = cell * rows;
    const top = H * 0.26, bottom = H * 0.93;
    this._geo = {
      cell, cols, rows, gw, gh,
      x0: W / 2 - gw / 2,
      y0: Math.max(top, top + (bottom - top - gh) / 2),
    };
  }

  // El recorrido serpentea: fila 0 de izq a der, fila 1 al revés, etc.
  _cellPos(i) {
    const g = this._geo, cols = g.cols || 8;
    const row = Math.floor(i / cols);
    const inRow = i % cols;
    const col = row % 2 === 0 ? inRow : cols - 1 - inRow;
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

  // ── Dibujo ────────────────────────────────────────────────────────────────
  // Ojo: el invitado online nunca corre update(), sólo render(). Por eso toda la
  // animación decorativa sale del reloj (T) o se deduce del estado sincronizado,
  // nunca de variables que se acumulen frame a frame.

  render(ctx) {
    const { W, H } = this;
    const T = now();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    this._drawGarden(ctx, T);
    this._drawHud(ctx, T);
    this._drawPath(ctx);
    for (let i = 0; i < CELLS; i++) this._drawCell(ctx, i, T);
    this._drawPieces(ctx, T);
    this._drawMsg(ctx);
    if (this.phase === 'over') this._drawWin(ctx, T);
  }

  // Jardín de fondo: cielo, sol, nubes que derivan, colinas, pasto y florcitas.
  _drawGarden(ctx, T) {
    const { W, H } = this;
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.42);
    sky.addColorStop(0, '#7FD4F5'); sky.addColorStop(1, '#D6F2FF');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

    // sol con halo, bien en la esquina para no pelearse con el chip de P2
    const sx = W * 0.965, sy = H * 0.022, sr = Math.min(W, H) * 0.05;
    const halo = ctx.createRadialGradient(sx, sy, sr * 0.4, sx, sy, sr * 2.2);
    halo.addColorStop(0, 'rgba(255,240,150,0.45)'); halo.addColorStop(1, 'rgba(255,240,150,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(sx, sy, sr * 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFE477';
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();

    // nubes
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    for (const c of this._deco.clouds) {
      const cx = ((c.x + T * c.v) % 1.25 - 0.12) * W, cy = c.y * H, r = Math.min(W, H) * 0.035 * c.s;
      for (const [ox, oy, rr] of [[-1, .15, .8], [0, -.2, 1], [1, .1, .75], [.4, .3, .6]]) {
        ctx.beginPath(); ctx.arc(cx + ox * r, cy + oy * r, r * rr, 0, Math.PI * 2); ctx.fill();
      }
    }

    // colinas + pasto
    const hy = H * 0.235;
    ctx.fillStyle = '#7CC96B';
    ctx.beginPath(); ctx.ellipse(W * 0.22, hy + H * 0.06, W * 0.42, H * 0.10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(W * 0.80, hy + H * 0.05, W * 0.38, H * 0.09, 0, 0, Math.PI * 2); ctx.fill();
    const grass = ctx.createLinearGradient(0, hy, 0, H);
    grass.addColorStop(0, '#8FD97A'); grass.addColorStop(1, '#59B45C');
    ctx.fillStyle = grass; ctx.fillRect(0, hy + H * 0.03, W, H - hy);

    // arbolitos apoyados en la línea del horizonte
    for (const b of this._deco.bushes) {
      const r = Math.min(W, H) * 0.028 * b.s;
      const bx = b.x * W, by = hy + H * 0.035 - r * 0.4;
      ctx.fillStyle = '#8A5A32';
      ctx.fillRect(bx - r * 0.16, by, r * 0.32, r * 1.5);
      ctx.fillStyle = '#4FA255';
      for (const [ox, oy, rr] of [[-.8, .1, .75], [.8, .1, .7], [0, -.45, .95], [0, .2, .85]]) {
        ctx.beginPath(); ctx.arc(bx + ox * r, by + oy * r, r * rr, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath(); ctx.arc(bx - r * 0.3, by - r * 0.6, r * 0.35, 0, Math.PI * 2); ctx.fill();
    }

    // florcitas sobre el pasto (quedan alrededor del tablero)
    const FL = ['#FFFFFF', '#FFE066', '#FF9EC4', '#C39BFF'];
    for (const f of this._deco.flowers) {
      const fx = f.x * W, fy = f.y * H, r = Math.min(W, H) * 0.008 * f.s;
      ctx.fillStyle = FL[f.c];
      for (let k = 0; k < 5; k++) {
        const a = k * Math.PI * 2 / 5;
        ctx.beginPath(); ctx.arc(fx + Math.cos(a) * r, fy + Math.sin(a) * r, r * 0.85, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#FFC93C';
      ctx.beginPath(); ctx.arc(fx, fy, r * 0.7, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Chips de cada jugadora arriba + el dado en el medio.
  _drawHud(ctx, T) {
    const { W, H } = this;
    const s = Math.min(W, H);

    for (const [pl, name, col] of [['p1', 'P1', '#FF4488'], ['p2', 'P2', '#3D7BE8']]) {
      const active = this.phase === 'playing' && this.turn === pl;
      const cw = s * 0.30, ch = s * 0.085;
      const cx = pl === 'p1' ? W * 0.03 + cw / 2 : W * 0.97 - cw / 2, cy = H * 0.075;
      const k = active ? 1 + Math.sin(T * 4) * 0.03 : 1;
      ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k);
      ctx.fillStyle = active ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.55)';
      ctx.beginPath(); ctx.roundRect(-cw / 2, -ch / 2, cw, ch, ch / 2); ctx.fill();
      ctx.strokeStyle = active ? '#FFC93C' : 'rgba(120,90,50,0.25)';
      ctx.lineWidth = active ? ch * 0.13 : ch * 0.06;
      ctx.beginPath(); ctx.roundRect(-cw / 2, -ch / 2, cw, ch, ch / 2); ctx.stroke();
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(-cw / 2 + ch * 0.55, 0, ch * 0.32, 0, Math.PI * 2); ctx.fill();
      ctx.font = `900 ${ch * 0.44}px system-ui`;
      ctx.fillStyle = active ? '#3B2A16' : 'rgba(59,42,22,0.6)';
      ctx.fillText(`${name}  ${Math.min(CELLS, Math.round(this.pos[pl]) + 1)}/${CELLS}`, ch * 0.35, 0);
      if (this.skip[pl] > 0) { ctx.font = `${ch * 0.4}px system-ui`; ctx.fillText('🕳️', cw / 2 - ch * 0.42, 0); }
      ctx.restore();
    }

    // el dado, arriba del tablero
    const dS = s * 0.115;
    const rolling = this.state === 'rolling';
    const bounce = rolling ? Math.abs(Math.sin(T * 11)) * dS * 0.30 : 0;
    const rot = rolling ? Math.sin(T * 17) * 0.35 : 0;
    const cx = W / 2, cy = H * 0.10 - bounce;

    ctx.fillStyle = 'rgba(40,60,25,0.28)';
    ctx.beginPath(); ctx.ellipse(cx, H * 0.10 + dS * 0.62, dS * (0.48 - bounce / dS * 0.1), dS * 0.13, 0, 0, Math.PI * 2); ctx.fill();

    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
    const face = ctx.createLinearGradient(-dS / 2, -dS / 2, dS / 2, dS / 2);
    face.addColorStop(0, '#FFFFFF'); face.addColorStop(1, '#FFE7B8');
    ctx.fillStyle = face;
    ctx.beginPath(); ctx.roundRect(-dS / 2, -dS / 2, dS, dS, dS * 0.22); ctx.fill();
    ctx.strokeStyle = '#D8A85E'; ctx.lineWidth = dS * 0.045;
    ctx.beginPath(); ctx.roundRect(-dS / 2, -dS / 2, dS, dS, dS * 0.22); ctx.stroke();
    ctx.fillStyle = '#3A2412';
    const pipR = dS * 0.085;
    const PIPS = {
      1: [[.5,.5]], 2: [[.28,.28],[.72,.72]], 3: [[.26,.26],[.5,.5],[.74,.74]],
      4: [[.28,.28],[.72,.28],[.28,.72],[.72,.72]],
      5: [[.26,.26],[.74,.26],[.5,.5],[.26,.74],[.74,.74]],
      6: [[.28,.24],[.72,.24],[.28,.5],[.72,.5],[.28,.76],[.72,.76]],
    };
    for (const [px, py] of PIPS[this.die] || PIPS[1]) {
      ctx.beginPath(); ctx.arc((px - .5) * dS, (py - .5) * dS, pipR, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    if (this.phase === 'playing' && this.state === 'idle') {
      const a = 0.65 + Math.sin(T * 3) * 0.25;
      ctx.font = `900 ${s * 0.035}px system-ui`;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.strokeStyle = 'rgba(60,45,20,0.45)'; ctx.lineWidth = s * 0.008; ctx.lineJoin = 'round';
      const y = H * 0.10 + dS * 0.95;
      ctx.strokeText('tocá para tirar el dado', W / 2, y);
      ctx.fillText('tocá para tirar el dado', W / 2, y);
    }
  }

  // La senda por debajo de las casillas. Sin esto el recorrido serpenteante no
  // se entiende: la meta queda justo abajo de la salida y parecen vecinas.
  _drawPath(ctx) {
    const g = this._geo;

    // claro de pasto más clarito debajo del tablero: separa el recorrido del
    // fondo sin tapar el jardín
    const pad = g.cell * 0.32, rad = g.cell * 0.5;
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.roundRect(g.x0 - pad, g.y0 - pad, g.gw + pad * 2, g.gh + pad * 2, rad); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.30)'; ctx.lineWidth = Math.max(2, g.cell * 0.03);
    ctx.beginPath();
    ctx.roundRect(g.x0 - pad, g.y0 - pad, g.gw + pad * 2, g.gh + pad * 2, rad); ctx.stroke();

    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const trace = () => {
      ctx.beginPath();
      for (let i = 0; i < CELLS; i++) {
        const p = this._cellPos(i);
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    };
    ctx.strokeStyle = 'rgba(90,62,30,0.30)'; ctx.lineWidth = g.cell * 0.50; trace();
    ctx.strokeStyle = '#EFD9A8';             ctx.lineWidth = g.cell * 0.40; trace();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = g.cell * 0.16; trace();

    // flechitas en los codos, para que se vea hacia dónde sigue
    ctx.fillStyle = 'rgba(150,105,50,0.55)';
    for (let i = 3; i < CELLS - 1; i += 4) {
      const a = this._cellPos(i), b = this._cellPos(i + 1);
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, s = g.cell * 0.13;
      ctx.save(); ctx.translate(mx, my); ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(-s * 0.7, s * 0.7); ctx.lineTo(-s * 0.7, -s * 0.7);
      ctx.closePath(); ctx.fill(); ctx.restore();
    }
  }

  _drawCell(ctx, i, T) {
    const g = this._geo, p = this._cellPos(i), sp = SPECIAL[i];
    const goal = i === CELLS - 1, start = i === 0;
    const [base, light] = goal ? GOAL_COL : start ? START_COL
                        : sp ? SPECIAL_COL[sp.k] : PLAIN_COL[i % PLAIN_COL.length];
    const R = g.cell * (goal ? 0.48 : sp ? 0.44 : 0.40);

    // las casillas premiadas y la meta laten despacito
    const pulse = goal || (sp && sp.k === 'oca') ? 1 + Math.sin(T * 2.5 + i) * 0.035 : 1;
    const r = R * pulse;

    if (goal) {   // rayos de brillo girando detrás de la meta
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(T * 0.5);
      ctx.fillStyle = 'rgba(255,236,150,0.45)';
      for (let k = 0; k < 8; k++) {
        ctx.rotate(Math.PI / 4);
        ctx.beginPath(); ctx.moveTo(0, -r * 0.9); ctx.lineTo(r * 0.26, -r * 1.9); ctx.lineTo(-r * 0.26, -r * 1.9);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }

    ctx.fillStyle = 'rgba(60,45,20,0.28)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + r * 0.42, r * 0.95, r * 0.85, 0, 0, Math.PI * 2); ctx.fill();

    const grad = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.42, r * 0.1, p.x, p.y, r * 1.1);
    grad.addColorStop(0, light); grad.addColorStop(1, base);
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#FFFCF2'; ctx.lineWidth = r * 0.13;
    ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.94, 0, Math.PI * 2); ctx.stroke();
    // reflejo superior
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.ellipse(p.x - r * 0.22, p.y - r * 0.42, r * 0.42, r * 0.22, -0.5, 0, Math.PI * 2); ctx.fill();

    if (goal || start || sp) {
      ctx.font = `${r * (goal ? 1.05 : 0.95)}px system-ui`;
      ctx.fillText(goal ? '🏆' : start ? '🏁' : LABEL[sp.k], p.x, p.y + r * 0.04);
    } else {
      ctx.fillStyle = 'rgba(90,62,25,0.75)'; ctx.font = `900 ${r * 0.6}px system-ui`;
      ctx.fillText(String(i + 1), p.x, p.y);
    }
  }

  // Dónde se dibuja la ficha: durante el salto interpola hacia la casilla que
  // viene (pos todavía es la anterior) y le agrega el arco.
  _pieceXY(pl) {
    const g = this._geo;
    const at = Math.min(CELLS - 1, Math.max(0, Math.round(this.pos[pl])));
    const p = this._cellPos(at);
    if (this.state === 'hopping' && this.turn === pl && this.hopLeft > 0) {
      const u = Math.min(1, Math.max(0, 1 - this.t / HOP_DT));
      const n = this._cellPos(Math.min(CELLS - 1, at + 1));
      const gx = p.x + (n.x - p.x) * u, gy = p.y + (n.y - p.y) * u;
      return { x: gx, y: gy - Math.sin(u * Math.PI) * g.cell * 0.55, gx, gy, air: Math.sin(u * Math.PI) };
    }
    return { x: p.x, y: p.y, gx: p.x, gy: p.y, air: 0 };
  }

  _drawPieces(ctx, T) {
    const g = this._geo;
    // si comparten casilla se corren un poco para que se vean las dos
    const same = Math.round(this.pos.p1) === Math.round(this.pos.p2);
    for (const [pl, dark, mid, lite] of [
      ['p1', '#C41E5C', '#FF4488', '#FFA8C8'],
      ['p2', '#1E4FA8', '#4488FF', '#A8C8FF'],
    ]) {
      const q = this._pieceXY(pl);
      const off = same ? (pl === 'p1' ? -g.cell * 0.18 : g.cell * 0.18) : 0;
      const r = g.cell * (same ? 0.21 : 0.25);
      const x = q.x + off, y = q.y;
      const active = this.phase === 'playing' && this.turn === pl && this.state === 'idle';

      // sombra en el piso (se achica cuando está en el aire)
      const k = 1 - q.air * 0.45;
      ctx.fillStyle = `rgba(50,35,15,${0.35 - q.air * 0.15})`;
      ctx.beginPath();
      ctx.ellipse(q.gx + off, q.gy + r * 0.85, r * 0.95 * k, r * 0.36 * k, 0, 0, Math.PI * 2);
      ctx.fill();

      if (active) {   // aro dorado para saber quién tiene que tirar
        ctx.strokeStyle = `rgba(255,201,60,${0.5 + Math.sin(T * 4) * 0.3})`;
        ctx.lineWidth = r * 0.22;
        ctx.beginPath(); ctx.arc(x, y, r * (1.5 + Math.sin(T * 4) * 0.08), 0, Math.PI * 2); ctx.stroke();
      }

      // peón: base + cuerpo + cabeza con carita
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.ellipse(x, y + r * 0.78, r * 0.85, r * 0.32, 0, 0, Math.PI * 2); ctx.fill();
      const body = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
      body.addColorStop(0, lite); body.addColorStop(0.5, mid); body.addColorStop(1, dark);
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.75, y + r * 0.8);
      ctx.quadraticCurveTo(x - r * 0.30, y + r * 0.25, x - r * 0.55, y - r * 0.15);
      ctx.lineTo(x + r * 0.55, y - r * 0.15);
      ctx.quadraticCurveTo(x + r * 0.30, y + r * 0.25, x + r * 0.75, y + r * 0.8);
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(x, y - r * 0.42, r * 0.62, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = Math.max(1.2, r * 0.11);
      ctx.beginPath(); ctx.arc(x, y - r * 0.42, r * 0.62, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath(); ctx.ellipse(x - r * 0.22, y - r * 0.62, r * 0.24, r * 0.15, -0.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2B1A0E';
      ctx.beginPath(); ctx.arc(x - r * 0.22, y - r * 0.45, r * 0.10, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + r * 0.22, y - r * 0.45, r * 0.10, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#2B1A0E'; ctx.lineWidth = Math.max(1, r * 0.09);
      ctx.beginPath(); ctx.arc(x, y - r * 0.30, r * 0.22, 0.25 * Math.PI, 0.75 * Math.PI); ctx.stroke();
    }
  }

  _drawMsg(ctx) {
    if (!this.msg) return;
    const { W, H } = this, g = this._geo;
    const fs = Math.min(H * 0.036, W * 0.036);
    ctx.font = `900 ${fs}px system-ui`;
    const w = Math.min(W * 0.94, ctx.measureText(this.msg).width + fs * 1.6), h = fs * 1.9;
    const y = Math.min(H - h / 2 - fs * 0.3, g.y0 + g.gh + h * 0.75);
    ctx.fillStyle = 'rgba(60,40,15,0.30)';
    ctx.beginPath(); ctx.roundRect(W / 2 - w / 2, y - h / 2 + h * 0.10, w, h, h / 2); ctx.fill();
    ctx.fillStyle = '#FFFBEC';
    ctx.beginPath(); ctx.roundRect(W / 2 - w / 2, y - h / 2, w, h, h / 2); ctx.fill();
    ctx.strokeStyle = '#F2B705'; ctx.lineWidth = h * 0.09;
    ctx.beginPath(); ctx.roundRect(W / 2 - w / 2, y - h / 2, w, h, h / 2); ctx.stroke();
    ctx.fillStyle = '#7A4E12';
    ctx.fillText(this.msg, W / 2, y);
  }

  _drawWin(ctx, T) {
    const { W, H } = this;
    ctx.fillStyle = 'rgba(20,10,30,0.66)'; ctx.fillRect(0, 0, W, H);

    // confeti: determinístico a partir del reloj, así también lo ve el invitado
    const CC = ['#FF4488', '#4488FF', '#FFD700', '#7ED9A0', '#FF9E4F'];
    const r = seeded(11);
    for (let i = 0; i < 70; i++) {
      const bx = r(), sp = 0.10 + r() * 0.22, ph = r(), sz = (0.010 + r() * 0.012) * Math.min(W, H);
      const x = bx * W + Math.sin(T * 1.6 + i) * W * 0.03;
      const y = ((ph + T * sp) % 1.15 - 0.1) * H;
      ctx.save(); ctx.translate(x, y); ctx.rotate(T * 3 + i);
      ctx.fillStyle = CC[i % CC.length];
      ctx.fillRect(-sz / 2, -sz / 4, sz, sz / 2);
      ctx.restore();
    }

    const cfg = this.winner === 'p1' ? { color: '#FF88BB', name: 'P1' } : { color: '#88BBFF', name: 'P2' };
    const k = 1 + Math.sin(T * 3) * 0.05;
    ctx.save(); ctx.translate(W / 2, H * 0.40); ctx.scale(k, k);
    ctx.font = `${Math.min(H * 0.17, W * 0.22)}px system-ui`;
    ctx.fillText('🏆', 0, -H * 0.06);
    ctx.font = `900 ${Math.min(H * 0.11, W * 0.13)}px system-ui`;
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = H * 0.012; ctx.lineJoin = 'round';
    ctx.strokeText(`¡Ganó ${cfg.name}!`, 0, H * 0.09);
    ctx.fillStyle = cfg.color;
    ctx.fillText(`¡Ganó ${cfg.name}!`, 0, H * 0.09);
    ctx.restore();

    ctx.font = `${H * 0.05}px system-ui`;
    ctx.fillStyle = `rgba(255,255,255,${0.5 + Math.sin(T * 3) * 0.3})`;
    ctx.fillText('Tocá para jugar de nuevo', W / 2, H * 0.70);
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
