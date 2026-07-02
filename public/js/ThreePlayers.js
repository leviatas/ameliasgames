// ── Juegos para 3 jugadores (multijugador local en una pantalla) ─────────────
// Tres jugadores comparten el dispositivo. Cada uno tiene un botón grande abajo
// (izquierda / centro / derecha) o una tecla (A / Espacio / L). El mismo control
// sirve para todos los juegos: Carrera, Reflejos, La Bomba, Cazaestrellas,
// Globo Gigante (riesgo), Fiesta de Baile (ritmo), Memoria Mágica (memoria
// cooperativa) y Justo al Corazón (precisión por turnos).
//
// La clase recibe (canvas, mode). game.js llama a press(i) cuando el jugador i
// toca su botón. Durante la pantalla de "fin", tocar cualquier botón reinicia.

const PLAYERS = [
  { name: 'Jugador 1', short: 'J1', color: '#FF5D8F', racer: '🦄', key: 'A' },
  { name: 'Jugador 2', short: 'J2', color: '#39C7B4', racer: '🐰', key: 'Espacio' },
  { name: 'Jugador 3', short: 'J3', color: '#8E7BFF', racer: '🦋', key: 'L' },
];

const MODES = {
  carrera:   { name: 'Carrera',       emoji: '🏁', desc: 'Tocá tu botón lo más rápido que puedas y llegá primero a la meta.' },
  reflejos:  { name: 'Reflejos',      emoji: '⚡', desc: 'Esperá a que la pantalla se ponga VERDE y tocá. ¡El más rápido gana!' },
  bomba:     { name: 'La Bomba',      emoji: '💣', desc: 'Si tenés la bomba, ¡pasala rápido! El que la tenga al explotar pierde.' },
  estrellas: { name: 'Cazaestrellas', emoji: '⭐', desc: 'Cuando aparezca la estrella, ¡tocá primero! Si tocás antes de tiempo, perdés un punto.' },
  globo:     { name: 'Globo Gigante',  emoji: '🎈', desc: 'Cada toque infla tu globo: más grande, más puntos. Pero si lo inflás de más… ¡PUM! Sabé cuándo parar.' },
  baile:     { name: 'Fiesta de Baile', emoji: '💃', desc: 'Tocá tu botón justo cuando tu figura llegue a tu aro. ¡Al ritmo, sin apurarse!' },
  memoria:   { name: 'Memoria Mágica', emoji: '🧠', desc: 'Miren la secuencia de colores y repítanla en orden entre las tres. ¡Juego en equipo!' },
  centro:    { name: 'Justo al Corazón', emoji: '💘', desc: 'Por turnos: pará la flecha lo más cerca del corazón que puedas. Gana la más precisa.' },
};

const REFLEJOS_TARGET = 3;   // rondas ganadas para ganar el juego
const CARRERA_STEP    = 0.028; // avance por toque (~36 toques para la meta)
const ESTRELLAS_TIME  = 30;    // segundos de partida
const GLOBO_ROUNDS    = 3;     // rondas de inflado
const GLOBO_TIME      = 10;    // segundos por ronda
const BAILE_TIME      = 45;    // segundos de partida
const CENTRO_TURNS    = 3;     // turnos por jugador

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export class ThreePlayers {
  constructor(canvas, mode) {
    this.canvas = canvas;
    this.mode = MODES[mode] ? mode : 'carrera';
    this.reset();
  }

  reset() {
    this.t = 0;
    this.phase = 'countdown';   // 'countdown' | 'play' | 'over'  (reflejos usa su propia máquina)
    this.cd = 3.2;              // cuenta regresiva genérica
    this.winner = null;         // índice ganador
    this.loser = null;          // índice perdedor (La Bomba)
    this.scores = [0, 0, 0];
    this.floats = [];           // textos flotantes (+1 / -1)
    this.parts = [];            // partículas (explosión)
    this.flash = [0, 0, 0];     // realce por toque de cada jugador

    if (this.mode === 'carrera') {
      this.pos = [0, 0, 0];
    } else if (this.mode === 'reflejos') {
      this.phase = 'play';
      this._newReflejoRound();
    } else if (this.mode === 'bomba') {
      this.holder = Math.floor(Math.random() * 3);
      this.fuse = 5 + Math.random() * 4.5;
      this.passPulse = 0;
    } else if (this.mode === 'estrellas') {
      this.timeLeft = ESTRELLAS_TIME;
      this.star = { on: false, t: 0, delay: 0.8 + Math.random() * 1.2 };
    } else if (this.mode === 'globo') {
      this.round = 1;
      this._newGloboRound();
    } else if (this.mode === 'baile') {
      this.timeLeft = BAILE_TIME;
      this.notes = [];        // { col, p: 0..1 progreso hacia el aro, hit }
      this.beatT = 0;
    } else if (this.mode === 'memoria') {
      this.level = 1;
      this.seq = [Math.floor(Math.random() * 3), Math.floor(Math.random() * 3)];
      this.mem = { st: 'show', i: 0, t: 0, idx: 0 };   // 'show' | 'input' | 'levelup'
    } else if (this.mode === 'centro') {
      this.turn = 0;             // turno global: jugador = turn % 3
      this.markT = Math.random() * Math.PI;
      this.stopAt = null;        // dónde quedó la flecha al parar (0..1)
      this.pauseT = 0;
    }
  }

  _newGloboRound() {
    this.size = [0, 0, 0];
    this.popped = [false, false, false];
    this.limit = [0, 1, 2].map(() => 10 + Math.floor(Math.random() * 12));  // límite oculto de explosión
    this.roundTime = GLOBO_TIME;
    this.interT = 0;             // pausa entre rondas
  }

  _finishByScore() {
    this.phase = 'over';
    const max = Math.max(...this.scores);
    const leaders = [0, 1, 2].filter(k => this.scores[k] === max);
    this.winner = leaders.length === 1 ? leaders[0] : 'empate';
  }

  restart() { this.reset(); }

  _newReflejoRound() {
    this.rf = { st: 'wait', t: 0, delay: 1.4 + Math.random() * 3.0, out: [false, false, false], winner: null };
  }

  // ── Geometría ──
  _geom() {
    const W = this.canvas.width, H = this.canvas.height;
    const sc = Math.max(0.62, Math.min(W, H) / 620);
    const padH = Math.min(200, Math.max(108, H * 0.30));   // reserva para los botones HTML (26–30vh); un poco de más para no dibujar debajo
    return { W, H, sc, padH, contentH: H - padH };
  }
  _colX(i, W) { return (i + 0.5) * W / 3; }

  // ── Input ──
  press(i) {
    if (i < 0 || i > 2) return;
    this.flash[i] = 0.25;

    if (this.phase === 'over') { this.restart(); return; }

    if (this.mode === 'reflejos') return this._pressReflejos(i);
    if (this.phase !== 'play') return;   // ignorar toques durante la cuenta regresiva

    if (this.mode === 'carrera') {
      this.pos[i] = Math.min(1, this.pos[i] + CARRERA_STEP);
      if (this.pos[i] >= 1) { this.phase = 'over'; this.winner = i; this._burst(this._colX(i, this.canvas.width), this._geom().contentH * 0.5, PLAYERS[i].color, 30); }
    } else if (this.mode === 'bomba') {
      if (i === this.holder) {
        const others = [0, 1, 2].filter(k => k !== i);
        this.holder = others[Math.floor(Math.random() * others.length)];
        this.passPulse = 0.3;
      }
    } else if (this.mode === 'estrellas') {
      const G = this._geom();
      if (this.star.on) {
        this.scores[i]++;
        this.star.on = false; this.star.t = 0; this.star.delay = 0.35 + Math.random() * 1.1;
        this._addFloat(G.W / 2, G.contentH * 0.42, '+1', PLAYERS[i].color);
        this._burst(G.W / 2, G.contentH * 0.42, '#FFD23A', 14);
      } else {
        this.scores[i] = Math.max(0, this.scores[i] - 1);
        this._addFloat(this._colX(i, G.W), G.contentH * 0.5, '-1', '#E24C4C');
      }
    } else if (this.mode === 'globo') {
      if (this.interT > 0 || this.popped[i]) return;
      this.size[i]++;
      if (this.size[i] >= this.limit[i]) {
        this.popped[i] = true;
        const G = this._geom();
        this._burst(this._colX(i, G.W), G.contentH * 0.45, PLAYERS[i].color, 26);
        this._addFloat(this._colX(i, G.W), G.contentH * 0.4, '💥', '#fff');
      }
    } else if (this.mode === 'baile') {
      const G = this._geom();
      let best = null, bd = 1;
      for (const n of this.notes) if (n.col === i && !n.hit) {
        const d = Math.abs(n.p - 1);
        if (d < bd) { bd = d; best = n; }
      }
      if (best && bd <= 0.13) {
        best.hit = true;
        const perfect = bd <= 0.055;
        this.scores[i] += perfect ? 2 : 1;
        this._addFloat(this._colX(i, G.W), G.contentH * 0.72, perfect ? '¡Perfecto! +2' : '+1', PLAYERS[i].color);
        if (perfect) this._burst(this._colX(i, G.W), G.contentH * 0.8, PLAYERS[i].color, 10);
      } else {
        this.scores[i] = Math.max(0, this.scores[i] - 1);
        this._addFloat(this._colX(i, G.W), G.contentH * 0.5, '-1', '#E24C4C');
      }
    } else if (this.mode === 'memoria') {
      const mem = this.mem;
      if (mem.st !== 'input') return;
      const G = this._geom();
      if (this.seq[mem.idx] === i) {
        mem.idx++;
        this._burst(this._colX(i, G.W), G.contentH * 0.5, PLAYERS[i].color, 10);
        if (mem.idx >= this.seq.length) { mem.st = 'levelup'; mem.t = 0; }
      } else {
        this.phase = 'over';
        this.winner = 'coop';
      }
    } else if (this.mode === 'centro') {
      if (this.stopAt !== null || i !== this.turn % 3) return;
      const p = this._centroPos();
      this.stopAt = p;
      this.pauseT = 1.3;
      const acc = Math.max(0, Math.round((1 - Math.abs(p - 0.5) * 2) * 100));
      this.scores[i] += acc;
      const G = this._geom();
      this._addFloat(G.W / 2, G.contentH * 0.4, `+${acc}`, PLAYERS[i].color);
      if (acc >= 90) this._burst(G.W / 2, G.contentH * 0.5, '#FF5D8F', 22);
    }
  }

  _centroPos() {
    const speed = 2.0 + Math.floor(this.turn / 3) * 0.7;   // cada ronda va más rápido
    return 0.5 + 0.5 * Math.sin(this.markT * speed);
  }

  _pressReflejos(i) {
    const rf = this.rf;
    if (rf.st === 'wait') {
      if (!rf.out[i]) { rf.out[i] = true; this.flash[i] = 0.4; }
      if (rf.out.every(Boolean)) { rf.st = 'result'; rf.t = 0; rf.winner = null; }  // todos se adelantaron
    } else if (rf.st === 'go') {
      if (rf.winner === null && !rf.out[i]) {
        rf.winner = i; rf.st = 'result'; rf.t = 0;
        this.scores[i]++;
        this._burst(this._colX(i, this.canvas.width), this._geom().contentH * 0.5, PLAYERS[i].color, 24);
        if (this.scores[i] >= REFLEJOS_TARGET) { this.phase = 'over'; this.winner = i; }
      }
    }
  }

  // ── Partículas / textos ──
  _addFloat(x, y, text, color) { this.floats.push({ x, y, text, color, life: 0, max: 0.9 }); }
  _burst(x, y, color, n) {
    const sc = this._geom().sc;
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, sp = (70 + Math.random() * 200) * sc;
      this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80 * sc, life: 0, max: 0.6 + Math.random() * 0.5, size: (3 + Math.random() * 4) * sc, color });
    }
  }

  // ── Lógica ──
  update(dt) {
    this.t += dt;
    for (let i = 0; i < 3; i++) if (this.flash[i] > 0) this.flash[i] = Math.max(0, this.flash[i] - dt);

    // cuenta regresiva genérica (carrera / bomba / estrellas)
    if (this.phase === 'countdown') {
      this.cd -= dt;
      if (this.cd <= 0) this.phase = 'play';
    } else if (this.phase === 'play') {
      if (this.mode === 'reflejos') this._updateReflejos(dt);
      else if (this.mode === 'bomba') {
        if (this.passPulse > 0) this.passPulse = Math.max(0, this.passPulse - dt);
        this.fuse -= dt;
        if (this.fuse <= 0) {
          this.phase = 'over'; this.loser = this.holder;
          this._burst(this._colX(this.holder, this.canvas.width), this._geom().contentH * 0.45, '#FF7A2A', 40);
        }
      } else if (this.mode === 'estrellas') {
        this.timeLeft -= dt;
        const st = this.star;
        if (!st.on) { st.t += dt; if (st.t >= st.delay) { st.on = true; st.t = 0; } }
        if (this.timeLeft <= 0) { this.timeLeft = 0; this._finishByScore(); }
      } else if (this.mode === 'globo') {
        if (this.interT > 0) {
          this.interT -= dt;
          if (this.interT <= 0) {
            if (this.round >= GLOBO_ROUNDS) this._finishByScore();
            else { this.round++; this._newGloboRound(); }
          }
        } else {
          this.roundTime -= dt;
          if (this.roundTime <= 0 || this.popped.every(Boolean)) {
            for (let i = 0; i < 3; i++) if (!this.popped[i]) this.scores[i] += this.size[i];
            this.interT = 1.6;
          }
        }
      } else if (this.mode === 'baile') {
        this.timeLeft -= dt;
        this.beatT -= dt;
        if (this.beatT <= 0 && this.timeLeft > 2.5) {
          this.beatT = 0.75;
          const cols = [0, 1, 2].sort(() => Math.random() - 0.5).slice(0, Math.random() < 0.35 ? 2 : 1);
          for (const c of cols) this.notes.push({ col: c, p: 0, hit: false });
        }
        for (const n of this.notes) n.p += dt / 2.0;
        this.notes = this.notes.filter(n => !n.hit && n.p < 1.18);
        if (this.timeLeft <= 0) { this.timeLeft = 0; this._finishByScore(); }
      } else if (this.mode === 'memoria') {
        const mem = this.mem;
        mem.t += dt;
        if (mem.st === 'show') {
          if (mem.t >= 0.62) { mem.t = 0; mem.i++; if (mem.i >= this.seq.length) { mem.st = 'input'; mem.idx = 0; } }
        } else if (mem.st === 'levelup') {
          if (mem.t >= 0.9) {
            this.level++;
            this.seq.push(Math.floor(Math.random() * 3));
            mem.st = 'show'; mem.i = 0; mem.t = 0;
          }
        }
      } else if (this.mode === 'centro') {
        if (this.stopAt !== null) {
          this.pauseT -= dt;
          if (this.pauseT <= 0) {
            this.stopAt = null;
            this.turn++;
            this.markT = Math.random() * Math.PI;
            if (this.turn >= CENTRO_TURNS * 3) this._finishByScore();
          }
        } else {
          this.markT += dt;
        }
      }
    }

    // partículas y textos
    const g = this._geom();
    for (const p of this.parts) { p.life += dt; p.vy += 260 * g.sc * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    this.parts = this.parts.filter(p => p.life < p.max);
    for (const f of this.floats) { f.life += dt; f.y -= 40 * g.sc * dt; }
    this.floats = this.floats.filter(f => f.life < f.max);
  }

  _updateReflejos(dt) {
    const rf = this.rf;
    rf.t += dt;
    if (rf.st === 'wait') {
      if (rf.t >= rf.delay) { rf.st = 'go'; rf.t = 0; }
    } else if (rf.st === 'result') {
      if (rf.t >= 1.6 && this.phase === 'play') this._newReflejoRound();
    }
  }

  // ── Render ──
  render(ctx) {
    const G = this._geom();
    ctx.fillStyle = '#12123a';
    ctx.fillRect(0, 0, G.W, G.H);

    if (this.mode === 'carrera')        this._renderCarrera(ctx, G);
    else if (this.mode === 'reflejos')  this._renderReflejos(ctx, G);
    else if (this.mode === 'bomba')     this._renderBomba(ctx, G);
    else if (this.mode === 'estrellas') this._renderEstrellas(ctx, G);
    else if (this.mode === 'globo')     this._renderGlobo(ctx, G);
    else if (this.mode === 'baile')     this._renderBaile(ctx, G);
    else if (this.mode === 'memoria')   this._renderMemoria(ctx, G);
    else if (this.mode === 'centro')    this._renderCentro(ctx, G);

    // partículas
    for (const p of this.parts) {
      ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // textos flotantes
    for (const f of this.floats) {
      ctx.globalAlpha = Math.max(0, 1 - f.life / f.max);
      ctx.fillStyle = f.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `900 ${34 * G.sc}px system-ui, sans-serif`;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    this._drawCountdown(ctx, G);
    this._drawOver(ctx, G);
  }

  _drawTitle(ctx, G, sub) {
    const m = MODES[this.mode], sc = G.sc;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = '#FFD700';
    ctx.font = `900 ${26 * sc}px system-ui, sans-serif`;
    ctx.fillText(`${m.emoji}  ${m.name}`, G.W / 2, 10 * sc);
    if (sub) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = `600 ${14 * sc}px system-ui, sans-serif`;
      ctx.fillText(sub, G.W / 2, 42 * sc);
    }
  }

  _drawScoreChips(ctx, G, labelFn) {
    const sc = G.sc, y = 72 * sc, gap = 10 * sc;
    const cw = Math.min(132 * sc, (G.W - 20 * sc - gap * 2) / 3);   // se achica para no desbordar en horizontal angosto
    const total = cw * 3 + gap * 2, x0 = G.W / 2 - total / 2;
    for (let i = 0; i < 3; i++) {
      const x = x0 + i * (cw + gap);
      ctx.fillStyle = hexA(PLAYERS[i].color, 0.9 - (this.flash[i] > 0 ? 0 : 0.15));
      ctx.strokeStyle = this.flash[i] > 0 ? '#fff' : hexA(PLAYERS[i].color, 1);
      ctx.lineWidth = 2 * sc;
      ctx.beginPath(); ctx.roundRect(x, y, cw, 40 * sc, 12 * sc); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `800 ${14 * sc}px system-ui, sans-serif`;
      ctx.fillText(PLAYERS[i].name, x + cw / 2, y + 13 * sc);
      ctx.font = `900 ${16 * sc}px system-ui, sans-serif`;
      ctx.fillText(labelFn(i), x + cw / 2, y + 29 * sc);
    }
  }

  // ── Carrera ──
  _renderCarrera(ctx, G) {
    const sc = G.sc;
    this._drawTitle(ctx, G, 'Tocá rápido para avanzar');
    this._drawScoreChips(ctx, G, i => `${Math.round(this.pos[i] * 100)}%`);

    const top = 130 * sc, laneH = (G.contentH - top - 20 * sc) / 3;
    const x0 = 30 * sc, x1 = G.W - 70 * sc;
    for (let i = 0; i < 3; i++) {
      const ly = top + i * laneH + laneH / 2;
      // pista
      ctx.fillStyle = hexA(PLAYERS[i].color, 0.12);
      ctx.beginPath(); ctx.roundRect(x0, ly - laneH * 0.38, x1 - x0 + 40 * sc, laneH * 0.76, 14 * sc); ctx.fill();
      // línea de meta
      ctx.strokeStyle = '#fff'; ctx.setLineDash([6 * sc, 6 * sc]); ctx.lineWidth = 3 * sc;
      ctx.beginPath(); ctx.moveTo(x1, ly - laneH * 0.34); ctx.lineTo(x1, ly + laneH * 0.34); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = `${26 * sc}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🏁', x1 + 20 * sc, ly);
      // corredor
      const rx = x0 + (x1 - x0) * this.pos[i];
      if (this.flash[i] > 0) { ctx.fillStyle = hexA(PLAYERS[i].color, 0.5); ctx.beginPath(); ctx.arc(rx, ly, 26 * sc, 0, Math.PI * 2); ctx.fill(); }
      ctx.font = `${36 * sc}px serif`;
      ctx.fillText(PLAYERS[i].racer, rx, ly);
    }
  }

  // ── Reflejos ──
  _renderReflejos(ctx, G) {
    const sc = G.sc, rf = this.rf;
    const green = rf.st === 'go';
    // fondo según estado
    ctx.fillStyle = green ? '#1FA84E' : (rf.st === 'wait' ? '#8E2130' : '#20204a');
    ctx.fillRect(0, 100 * sc, G.W, G.contentH - 100 * sc);

    this._drawTitle(ctx, G, `Primero a ${REFLEJOS_TARGET} gana`);
    this._drawScoreChips(ctx, G, i => '★'.repeat(this.scores[i]) || '–');

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const cy = 100 * sc + (G.contentH - 100 * sc) / 2;
    if (rf.st === 'wait') {
      ctx.fillStyle = '#fff'; ctx.font = `900 ${44 * sc}px system-ui, sans-serif`;
      ctx.fillText('Esperá…', G.W / 2, cy);
      ctx.font = `600 ${18 * sc}px system-ui, sans-serif`;
      const out = [0, 1, 2].filter(i => rf.out[i]);
      if (out.length) ctx.fillText(`${out.map(i => PLAYERS[i].name).join(', ')} se adelantó 🚫`, G.W / 2, cy + 46 * sc);
    } else if (rf.st === 'go') {
      ctx.fillStyle = '#fff'; ctx.font = `900 ${72 * sc}px system-ui, sans-serif`;
      ctx.fillText('¡YA!', G.W / 2, cy);
    } else {
      ctx.fillStyle = '#fff'; ctx.font = `900 ${40 * sc}px system-ui, sans-serif`;
      if (rf.winner === null) ctx.fillText('Nadie ganó la ronda', G.W / 2, cy);
      else { ctx.fillStyle = PLAYERS[rf.winner].color; ctx.fillText(`¡${PLAYERS[rf.winner].name}!`, G.W / 2, cy); }
    }
  }

  // ── La Bomba ──
  _renderBomba(ctx, G) {
    const sc = G.sc;
    this._drawTitle(ctx, G, '¡Pasá la bomba antes de que explote!');
    this._drawScoreChips(ctx, G, i => (i === this.holder ? '💣 ¡Vos!' : '—'));

    const top = 130 * sc;
    for (let i = 0; i < 3; i++) {
      const cx = this._colX(i, G.W);
      const held = i === this.holder;
      ctx.fillStyle = hexA(PLAYERS[i].color, held ? 0.28 : 0.10);
      ctx.beginPath(); ctx.roundRect(cx - G.W / 6 + 8 * sc, top, G.W / 3 - 16 * sc, G.contentH - top - 16 * sc, 16 * sc); ctx.fill();
    }
    // bomba con la mecha (que se agota) en la columna del que la tiene
    const cx = this._colX(this.holder, G.W), by = top + (G.contentH - top) * 0.42;
    const bob = Math.sin(this.t * 10) * 6 * sc + (this.passPulse > 0 ? 10 * sc : 0);
    const danger = this.fuse < 2.2;
    if (danger && Math.floor(this.t * 10) % 2 === 0) { ctx.fillStyle = hexA('#FF3B30', 0.35); ctx.beginPath(); ctx.arc(cx, by, 70 * sc, 0, Math.PI * 2); ctx.fill(); }
    ctx.font = `${72 * sc}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('💣', cx, by - bob);
    // barra de mecha
    const totalMax = 9.5, frac = Math.max(0, Math.min(1, this.fuse / totalMax));
    const bw = 200 * sc, bx = G.W / 2 - bw / 2, byy = top + 6 * sc;
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.roundRect(bx, byy, bw, 14 * sc, 7 * sc); ctx.fill();
    ctx.fillStyle = danger ? '#FF3B30' : '#FFC83A'; ctx.beginPath(); ctx.roundRect(bx, byy, bw * frac, 14 * sc, 7 * sc); ctx.fill();

    ctx.fillStyle = PLAYERS[this.holder].color; ctx.font = `900 ${22 * sc}px system-ui, sans-serif`;
    ctx.fillText(`${PLAYERS[this.holder].name}: ¡tocá para pasarla!`, cx, by + 70 * sc);
  }

  // ── Cazaestrellas ──
  _renderEstrellas(ctx, G) {
    const sc = G.sc;
    this._drawTitle(ctx, G, `Tiempo: ${Math.ceil(this.timeLeft)}s`);
    this._drawScoreChips(ctx, G, i => `⭐ ${this.scores[i]}`);

    const cx = G.W / 2, cy = 130 * sc + (G.contentH - 130 * sc) * 0.42;
    if (this.star.on) {
      const pulse = 1 + Math.sin(this.t * 12) * 0.08;
      ctx.fillStyle = hexA('#FFD23A', 0.3); ctx.beginPath(); ctx.arc(cx, cy, 80 * sc * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.font = `${96 * sc * pulse}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('⭐', cx, cy);
      ctx.fillStyle = '#fff'; ctx.font = `900 ${24 * sc}px system-ui, sans-serif`;
      ctx.fillText('¡TOCÁ!', cx, cy + 90 * sc);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `700 ${22 * sc}px system-ui, sans-serif`;
      ctx.fillText('Preparados…', cx, cy);
    }
  }

  // ── Globo Gigante ──
  _renderGlobo(ctx, G) {
    const sc = G.sc;
    this._drawTitle(ctx, G, `Ronda ${this.round}/${GLOBO_ROUNDS} — ${Math.ceil(Math.max(0, this.roundTime))}s`);
    this._drawScoreChips(ctx, G, i => `${this.scores[i] + (this.popped[i] ? 0 : this.size[i])} pts`);

    const top = 130 * sc, floorY = G.contentH - 14 * sc;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < 3; i++) {
      const cx = this._colX(i, G.W);
      if (this.popped[i]) {
        ctx.font = `${44 * sc}px serif`;
        ctx.fillText('💥', cx, (top + floorY) / 2);
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = `700 ${14 * sc}px system-ui, sans-serif`;
        ctx.fillText('¡Explotó!', cx, (top + floorY) / 2 + 40 * sc);
        continue;
      }
      const r = (14 + this.size[i] * 3.2) * sc;
      const wob = Math.sin(this.t * (4 + this.size[i] * 0.35) + i * 2) * this.size[i] * 0.35 * sc;
      const by = floorY - r - 30 * sc;
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5 * sc;
      ctx.beginPath(); ctx.moveTo(cx + wob, by + r); ctx.quadraticCurveTo(cx, by + r + 15 * sc, cx, floorY); ctx.stroke();
      ctx.fillStyle = hexA(PLAYERS[i].color, 0.9);
      ctx.beginPath(); ctx.ellipse(cx + wob, by, r * 0.92, r, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.ellipse(cx + wob - r * 0.3, by - r * 0.35, r * 0.22, r * 0.3, -0.5, 0, Math.PI * 2); ctx.fill();
    }
    if (this.interT > 0) {
      ctx.fillStyle = 'rgba(10,10,30,0.6)'; ctx.fillRect(0, 0, G.W, G.contentH);
      ctx.fillStyle = '#FFD700'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `900 ${34 * sc}px system-ui, sans-serif`;
      ctx.fillText(this.round >= GLOBO_ROUNDS ? '¡Fin!' : 'Fin de la ronda', G.W / 2, G.contentH * 0.45);
    }
  }

  // ── Fiesta de Baile ──
  _renderBaile(ctx, G) {
    const sc = G.sc;
    this._drawTitle(ctx, G, `Tiempo: ${Math.ceil(this.timeLeft)}s`);
    this._drawScoreChips(ctx, G, i => `✨ ${this.scores[i]}`);

    const top = 128 * sc, targetY = G.contentH - 34 * sc;
    for (let i = 0; i < 3; i++) {
      const cx = this._colX(i, G.W);
      ctx.fillStyle = hexA(PLAYERS[i].color, 0.08);
      ctx.fillRect(cx - G.W / 6 + 6 * sc, top, G.W / 3 - 12 * sc, G.contentH - top);
      ctx.strokeStyle = hexA(PLAYERS[i].color, this.flash[i] > 0 ? 1 : 0.55);
      ctx.lineWidth = 3 * sc;
      ctx.beginPath(); ctx.arc(cx, targetY, 20 * sc, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `${26 * sc}px serif`;
    for (const n of this.notes) {
      const y = top + (targetY - top) * n.p;
      ctx.fillText(['💖', '🌟', '🦋'][n.col], this._colX(n.col, G.W), y);
    }
  }

  // ── Memoria Mágica ──
  _renderMemoria(ctx, G) {
    const sc = G.sc, mem = this.mem;
    const sub = mem.st === 'show' ? '¡Miren y memoricen!' : mem.st === 'input' ? '¡Repitan la secuencia!' : '¡Muy bien! Sigue una más…';
    this._drawTitle(ctx, G, sub);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `900 ${20 * sc}px system-ui, sans-serif`;
    ctx.fillText(`Nivel ${this.level} — ${this.seq.length} colores`, G.W / 2, 84 * sc);

    const cy = 120 * sc + (G.contentH - 120 * sc) * 0.42;
    for (let i = 0; i < 3; i++) {
      const cx = this._colX(i, G.W);
      const lit = (mem.st === 'show' && mem.i < this.seq.length && this.seq[mem.i] === i && mem.t < 0.45) || this.flash[i] > 0;
      ctx.fillStyle = hexA(PLAYERS[i].color, lit ? 1 : 0.25);
      ctx.beginPath(); ctx.arc(cx, cy, (34 + (lit ? 10 : 0)) * sc, 0, Math.PI * 2); ctx.fill();
      if (lit) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3 * sc; ctx.stroke(); }
      ctx.font = `${30 * sc}px serif`;
      ctx.fillText(PLAYERS[i].racer, cx, cy);
    }
    // puntos de progreso de la secuencia (no revelan los colores)
    const n = this.seq.length, gap = Math.min(26 * sc, (G.W - 60 * sc) / n);
    const x0 = G.W / 2 - (n - 1) * gap / 2, py = cy + 84 * sc;
    for (let k = 0; k < n; k++) {
      const done = mem.st === 'input' ? k < mem.idx : (mem.st === 'levelup' ? true : k < mem.i);
      ctx.fillStyle = done ? '#FFD23A' : 'rgba(255,255,255,0.25)';
      ctx.beginPath(); ctx.arc(x0 + k * gap, py, 6 * sc, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ── Justo al Corazón ──
  _renderCentro(ctx, G) {
    const sc = G.sc;
    const cur = this.turn % 3, roundNo = Math.min(CENTRO_TURNS, Math.floor(this.turn / 3) + 1);
    this._drawTitle(ctx, G, `Ronda ${roundNo}/${CENTRO_TURNS}`);
    this._drawScoreChips(ctx, G, i => `${this.scores[i]}`);

    const cy = 130 * sc + (G.contentH - 130 * sc) * 0.45;
    const bw = Math.min(G.W - 80 * sc, 560 * sc), bx = G.W / 2 - bw / 2;
    const grad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    grad.addColorStop(0, '#4A5580'); grad.addColorStop(0.5, '#FF5D8F'); grad.addColorStop(1, '#4A5580');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.roundRect(bx, cy - 12 * sc, bw, 24 * sc, 12 * sc); ctx.fill();
    // marca del centro + corazón
    ctx.fillStyle = '#fff';
    ctx.fillRect(G.W / 2 - 1.5 * sc, cy - 16 * sc, 3 * sc, 32 * sc);
    ctx.font = `${30 * sc}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('💘', G.W / 2, cy + 38 * sc);
    // flecha del jugador de turno
    const p = this.stopAt !== null ? this.stopAt : this._centroPos();
    const mx = bx + bw * p;
    ctx.fillStyle = PLAYERS[cur].color;
    ctx.beginPath(); ctx.moveTo(mx, cy - 20 * sc); ctx.lineTo(mx - 10 * sc, cy - 38 * sc); ctx.lineTo(mx + 10 * sc, cy - 38 * sc); ctx.closePath(); ctx.fill();
    ctx.fillRect(mx - 2 * sc, cy - 20 * sc, 4 * sc, 36 * sc);

    ctx.fillStyle = PLAYERS[cur].color; ctx.font = `900 ${24 * sc}px system-ui, sans-serif`;
    ctx.fillText(`Turno de ${PLAYERS[cur].name} ${PLAYERS[cur].racer}`, G.W / 2, cy + 84 * sc);
  }

  // ── Overlays comunes ──
  _drawCountdown(ctx, G) {
    if (this.phase !== 'countdown') return;
    const sc = G.sc, m = MODES[this.mode];
    ctx.fillStyle = 'rgba(10,10,30,0.82)'; ctx.fillRect(0, 0, G.W, G.H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFD700'; ctx.font = `900 ${34 * sc}px system-ui, sans-serif`;
    ctx.fillText(`${m.emoji}  ${m.name}`, G.W / 2, G.H * 0.28);
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = `600 ${16 * sc}px system-ui, sans-serif`;
    this._wrapText(ctx, m.desc, G.W / 2, G.H * 0.38, Math.min(G.W - 60 * sc, 520 * sc), 24 * sc);
    const n = Math.ceil(this.cd - 0.2);
    ctx.fillStyle = '#fff'; ctx.font = `900 ${120 * sc}px system-ui, sans-serif`;
    ctx.fillText(n > 0 ? String(n) : '¡YA!', G.W / 2, G.H * 0.62);
  }

  _drawOver(ctx, G) {
    if (this.phase !== 'over') return;
    const sc = G.sc;
    ctx.fillStyle = 'rgba(10,10,30,0.86)'; ctx.fillRect(0, 0, G.W, G.H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    if (this.mode === 'bomba') {
      ctx.font = `${80 * sc}px serif`; ctx.fillText('💥', G.W / 2, G.H * 0.30);
      ctx.fillStyle = PLAYERS[this.loser].color; ctx.font = `900 ${40 * sc}px system-ui, sans-serif`;
      ctx.fillText(`${PLAYERS[this.loser].name} perdió`, G.W / 2, G.H * 0.46);
    } else if (this.winner === 'coop') {
      ctx.font = `${80 * sc}px serif`; ctx.fillText('🧠', G.W / 2, G.H * 0.30);
      ctx.fillStyle = '#FFD700'; ctx.font = `900 ${40 * sc}px system-ui, sans-serif`;
      ctx.fillText(`¡Llegaron al nivel ${this.level}!`, G.W / 2, G.H * 0.46);
    } else if (this.winner === 'empate') {
      ctx.fillStyle = '#FFD700'; ctx.font = `900 ${44 * sc}px system-ui, sans-serif`;
      ctx.fillText('🤝 ¡Empate!', G.W / 2, G.H * 0.36);
    } else {
      ctx.font = `${80 * sc}px serif`; ctx.fillText('🏆', G.W / 2, G.H * 0.30);
      ctx.fillStyle = PLAYERS[this.winner].color; ctx.font = `900 ${44 * sc}px system-ui, sans-serif`;
      ctx.fillText(`¡Gana ${PLAYERS[this.winner].name}!`, G.W / 2, G.H * 0.46);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = `700 ${20 * sc}px system-ui, sans-serif`;
    ctx.fillText('Tocá tu botón para jugar de nuevo', G.W / 2, G.H * 0.60);
  }

  _wrapText(ctx, text, cx, y, maxW, lh) {
    const words = text.split(' '); let line = '', yy = y;
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, cx, yy); line = w; yy += lh; }
      else line = test;
    }
    ctx.fillText(line, cx, yy);
  }

  destroy() {}
}
