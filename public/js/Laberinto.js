// ── Laberinto / Quoridor (2P, por turnos) ────────────────────────────────────
// Cada una tiene un peón y tiene que llegar a la fila de enfrente. En tu turno
// hacés UNA de dos cosas: movés el peón un casillero, o plantás una pared para
// estorbar a la otra. La pared nunca puede dejar a nadie sin camino a su meta:
// siempre tiene que quedar alguna vuelta posible.
//
// Tablero 7×7 y 7 paredes por jugadora (el clásico es 9×9 con 10, pero en un
// teléfono los casilleros quedan muy chicos para el dedo de una nena).

const N = 7;
const WALLS_EACH = 7;
const S = N - 1;              // intersecciones donde entra una pared

export class Laberinto {
  constructor(canvas) {
    this.canvas = canvas;
    this._reset();
  }

  _reset() {
    const W = this.canvas.width, H = this.canvas.height;
    this.W = W; this.H = H;
    this.phase = 'playing';   // 'playing' | 'over'
    this.turn = Math.random() < 0.5 ? 'p1' : 'p2';
    // P1 abajo y sube; P2 arriba y baja
    this.pawn = { p1: { r: N - 1, c: (N - 1) / 2 }, p2: { r: 0, c: (N - 1) / 2 } };
    this.goalRow = { p1: 0, p2: N - 1 };
    this.walls = { p1: WALLS_EACH, p2: WALLS_EACH };
    this.hw = Array(S * S).fill(false);   // paredes horizontales
    this.vw = Array(S * S).fill(false);   // paredes verticales
    this.msg = null;
    this.msgT = 0;
    this.winner = null;

    this._layout();
  }

  _layout() {
    const size = Math.min(this.W * 0.80, this.H * 0.80);
    const cell = size / N;
    this._geo = { size, cell, x0: this.W / 2 - size / 2, y0: this.H * 0.15 };
  }

  _cellPos(r, c) {
    const g = this._geo;
    return { x: g.x0 + c * g.cell + g.cell / 2, y: g.y0 + r * g.cell + g.cell / 2 };
  }

  // ── Reglas de bloqueo ───────────────────────────────────────────────────
  // Una pared horizontal en (r,c) tapa el paso entre las filas r y r+1 en las
  // columnas c y c+1; por eso hay que mirar también la de la columna anterior.
  _blocked(r, c, nr, nc) {
    if (nr === r + 1) return (c < S && this.hw[r * S + c]) || (c > 0 && this.hw[r * S + c - 1]);
    if (nr === r - 1) return (c < S && this.hw[(r - 1) * S + c]) || (c > 0 && this.hw[(r - 1) * S + c - 1]);
    if (nc === c + 1) return (r < S && this.vw[r * S + c]) || (r > 0 && this.vw[(r - 1) * S + c]);
    if (nc === c - 1) return (r < S && this.vw[r * S + c - 1]) || (r > 0 && this.vw[(r - 1) * S + c - 1]);
    return true;
  }

  _inside(r, c) { return r >= 0 && r < N && c >= 0 && c < N; }

  // Casilleros a los que puede ir el peón, con la regla del salto: si el rival
  // está pegado se lo salta; si atrás del rival hay pared o borde, se sale por
  // los costados.
  _moves(player) {
    const me = this.pawn[player], other = this.pawn[player === 'p1' ? 'p2' : 'p1'];
    const out = [];
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dr, dc] of DIRS) {
      const nr = me.r + dr, nc = me.c + dc;
      if (!this._inside(nr, nc) || this._blocked(me.r, me.c, nr, nc)) continue;
      if (other.r !== nr || other.c !== nc) { out.push({ r: nr, c: nc }); continue; }
      // hay que saltar al rival
      const jr = nr + dr, jc = nc + dc;
      if (this._inside(jr, jc) && !this._blocked(nr, nc, jr, jc)) { out.push({ r: jr, c: jc }); continue; }
      for (const [sr, sc] of (dr !== 0 ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]])) {
        const ar = nr + sr, ac = nc + sc;
        if (this._inside(ar, ac) && !this._blocked(nr, nc, ar, ac)) out.push({ r: ar, c: ac });
      }
    }
    return out;
  }

  // ¿Le queda camino a la meta? Sin esto se podría encerrar al rival y el juego
  // se rompe: es la única regla que hay que validar de verdad.
  _hasPath(player) {
    const start = this.pawn[player], goal = this.goalRow[player];
    const seen = new Set([start.r * N + start.c]);
    const q = [start];
    while (q.length) {
      const cur = q.shift();
      if (cur.r === goal) return true;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = cur.r + dr, nc = cur.c + dc;
        if (!this._inside(nr, nc)) continue;
        if (this._blocked(cur.r, cur.c, nr, nc)) continue;
        const k = nr * N + nc;
        if (seen.has(k)) continue;
        seen.add(k); q.push({ r: nr, c: nc });
      }
    }
    return false;
  }

  _canPlace(kind, r, c) {
    if (r < 0 || r >= S || c < 0 || c >= S) return false;
    const i = r * S + c;
    if (this.hw[i] || this.vw[i]) return false;          // ya hay una cruzada acá
    if (kind === 'h') {
      if (c > 0 && this.hw[i - 1]) return false;
      if (c < S - 1 && this.hw[i + 1]) return false;
    } else {
      if (r > 0 && this.vw[i - S]) return false;
      if (r < S - 1 && this.vw[i + S]) return false;
    }
    return true;
  }

  update(dt) { if (this.msgT > 0) this.msgT = Math.max(0, this.msgT - dt); }

  pointerDown(cx, cy, player) {
    if (this.phase === 'over') { this._reset(); return; }
    if (player && player !== this.turn) return;
    const me = this.turn;
    const g = this._geo;

    // 1) ¿tocó un casillero al que puede mover?
    for (const m of this._moves(me)) {
      const p = this._cellPos(m.r, m.c);
      if (Math.abs(cx - p.x) <= g.cell * 0.5 && Math.abs(cy - p.y) <= g.cell * 0.5) {
        this.pawn[me] = { r: m.r, c: m.c };
        if (m.r === this.goalRow[me]) { this.phase = 'over'; this.winner = me; return; }
        this._pass();
        return;
      }
    }

    // 2) si no, la intersección más cercana: plantar pared. La orientación sale
    //    de para qué lado del cruce cayó el dedo (a los costados = acostada).
    if (this.walls[me] <= 0) { this.msg = 'no te quedan paredes'; this.msgT = 1.6; return; }
    const fc = Math.round((cx - g.x0) / g.cell) - 1;
    const fr = Math.round((cy - g.y0) / g.cell) - 1;
    if (fr < 0 || fr >= S || fc < 0 || fc >= S) return;
    const ix = g.x0 + (fc + 1) * g.cell, iy = g.y0 + (fr + 1) * g.cell;
    const dx = cx - ix, dy = cy - iy;
    if (Math.abs(dx) > g.cell * 0.75 || Math.abs(dy) > g.cell * 0.75) return;
    const kind = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';

    if (!this._canPlace(kind, fr, fc)) { this.msg = 'ahí no entra'; this.msgT = 1.6; return; }
    const arr = kind === 'h' ? this.hw : this.vw;
    arr[fr * S + fc] = true;
    if (!this._hasPath('p1') || !this._hasPath('p2')) {
      arr[fr * S + fc] = false;
      this.msg = 'no podés dejar a nadie sin camino'; this.msgT = 2.2;
      return;
    }
    this.walls[me]--;
    this._pass();
  }
  pointerMove() {}
  pointerUp() {}

  _pass() {
    this.msg = null; this.msgT = 0;
    this.turn = this.turn === 'p1' ? 'p2' : 'p1';
  }

  render(ctx) {
    const { W, H } = this;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#101c2e'); bg.addColorStop(1, '#070d16');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    const g = this._geo;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    if (this.phase !== 'over') {
      const cfg = this.turn === 'p1' ? { color: '#FF88BB', name: 'P1' } : { color: '#88BBFF', name: 'P2' };
      ctx.font = `900 ${H * 0.046}px system-ui`; ctx.fillStyle = cfg.color;
      ctx.fillText(`Turno de ${cfg.name}`, W / 2, H * 0.05);
      ctx.font = `${H * 0.030}px system-ui`; ctx.fillStyle = '#ffffff66';
      ctx.fillText('movete a un casillero marcado, o tocá un cruce para poner pared', W / 2, H * 0.095);
    }

    // metas
    ctx.fillStyle = 'rgba(255,136,187,0.13)';
    ctx.fillRect(g.x0, g.y0, g.size, g.cell);                       // meta de P1 (arriba)
    ctx.fillStyle = 'rgba(136,187,255,0.13)';
    ctx.fillRect(g.x0, g.y0 + g.size - g.cell, g.size, g.cell);     // meta de P2 (abajo)

    // casilleros
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1.5;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const x = g.x0 + c * g.cell, y = g.y0 + r * g.cell;
        ctx.fillStyle = 'rgba(255,255,255,0.045)';
        ctx.beginPath(); ctx.roundRect(x + 2, y + 2, g.cell - 4, g.cell - 4, g.cell * 0.14); ctx.fill();
        ctx.beginPath(); ctx.roundRect(x + 2, y + 2, g.cell - 4, g.cell - 4, g.cell * 0.14); ctx.stroke();
      }
    }

    // cruces donde entra una pared
    if (this.phase !== 'over' && this.walls[this.turn] > 0) {
      ctx.fillStyle = 'rgba(255,215,0,0.16)';
      for (let r = 0; r < S; r++) {
        for (let c = 0; c < S; c++) {
          if (!this._canPlace('h', r, c) && !this._canPlace('v', r, c)) continue;
          ctx.beginPath();
          ctx.arc(g.x0 + (c + 1) * g.cell, g.y0 + (r + 1) * g.cell, g.cell * 0.09, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // destinos posibles
    if (this.phase !== 'over') {
      ctx.fillStyle = this.turn === 'p1' ? 'rgba(255,68,136,0.30)' : 'rgba(68,136,255,0.30)';
      for (const m of this._moves(this.turn)) {
        const p = this._cellPos(m.r, m.c);
        ctx.beginPath(); ctx.arc(p.x, p.y, g.cell * 0.22, 0, Math.PI * 2); ctx.fill();
      }
    }

    // paredes
    const th = g.cell * 0.16;
    ctx.fillStyle = '#E8B45C';
    for (let r = 0; r < S; r++) {
      for (let c = 0; c < S; c++) {
        if (this.hw[r * S + c]) {
          const x = g.x0 + c * g.cell, y = g.y0 + (r + 1) * g.cell;
          ctx.beginPath(); ctx.roundRect(x + 2, y - th / 2, g.cell * 2 - 4, th, th * 0.4); ctx.fill();
        }
        if (this.vw[r * S + c]) {
          const x = g.x0 + (c + 1) * g.cell, y = g.y0 + r * g.cell;
          ctx.beginPath(); ctx.roundRect(x - th / 2, y + 2, th, g.cell * 2 - 4, th * 0.4); ctx.fill();
        }
      }
    }

    // peones
    for (const [pl, color] of [['p1', '#FF4488'], ['p2', '#4488FF']]) {
      const p = this._cellPos(this.pawn[pl].r, this.pawn[pl].c);
      const r = g.cell * 0.30;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(p.x, p.y + r * 0.85, r * 0.85, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffffffaa'; ctx.lineWidth = Math.max(1.5, r * 0.15);
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
    }

    // paredes que le quedan a cada una
    ctx.font = `900 ${H * 0.034}px system-ui`;
    for (const [pl, color, x] of [['p1', '#FF4488', W * 0.07], ['p2', '#4488FF', W * 0.93]]) {
      ctx.fillStyle = color;
      ctx.fillText(pl === 'p1' ? 'P1' : 'P2', x, g.y0 + g.cell * 0.4);
      ctx.font = `${H * 0.028}px system-ui`;
      ctx.fillText('🧱 ' + this.walls[pl], x, g.y0 + g.cell * 1.0);
      ctx.font = `900 ${H * 0.034}px system-ui`;
    }

    if (this.msgT > 0 && this.msg) {
      ctx.globalAlpha = Math.min(1, this.msgT * 2);
      ctx.fillStyle = '#FFD700'; ctx.font = `900 ${H * 0.040}px system-ui`;
      ctx.fillText(this.msg, W / 2, g.y0 + g.size + H * 0.05);
      ctx.globalAlpha = 1;
    }

    if (this.phase === 'over') {
      ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, W, H);
      ctx.font = `900 ${H * 0.14}px system-ui`;
      const cfg = this.winner === 'p1' ? { color: '#FF88BB', name: 'P1' } : { color: '#88BBFF', name: 'P2' };
      ctx.fillStyle = cfg.color; ctx.fillText(`¡Llegó ${cfg.name}!`, W / 2, H * 0.42);
      ctx.font = `${H * 0.05}px system-ui`; ctx.fillStyle = '#ffffff66';
      ctx.fillText('Tocá para jugar de nuevo', W / 2, H * 0.58);
    }
  }

  // ── Online sync: host broadcasts this every frame, guest applies it ──────
  getNetState() {
    return {
      W: this.W, H: this.H, geo: this._geo,
      phase: this.phase, turn: this.turn, pawn: this.pawn, walls: this.walls,
      hw: this.hw, vw: this.vw, msg: this.msg, msgT: this.msgT, winner: this.winner,
    };
  }

  setNetState(s) {
    this.W = s.W; this.H = s.H; this._geo = s.geo;
    this.phase = s.phase; this.turn = s.turn; this.pawn = s.pawn; this.walls = s.walls;
    this.hw = s.hw; this.vw = s.vw; this.msg = s.msg; this.msgT = s.msgT; this.winner = s.winner;
  }
}
