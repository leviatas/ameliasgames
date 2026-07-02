// ── Juegos para 4 jugadores (multijugador local en una pantalla) ─────────────
// Cuatro jugadores comparten el dispositivo. Cada uno tiene un botón grande
// abajo o una tecla (A / F / J / L). Juegos: Tira y Afloja (equipos), Frasco de
// Caramelos (riesgo por turnos), Sillas Musicales (eliminación) y Jardín de
// Flores (timing). game.js llama a press(i) cuando el jugador i toca su botón.

const PLAYERS = [
  { name: 'Jugador 1', color: '#FF5D8F', racer: '🦄', key: 'A' },
  { name: 'Jugador 2', color: '#39C7B4', racer: '🐰', key: 'F' },
  { name: 'Jugador 3', color: '#8E7BFF', racer: '🦋', key: 'J' },
  { name: 'Jugador 4', color: '#FFA036', racer: '🐱', key: 'L' },
];

const MODES = {
  soga:      { name: 'Tira y Afloja',    emoji: '🎀', desc: 'Equipo Rosa (J1 y J2) contra Equipo Violeta (J3 y J4). ¡Tiren de la soga tocando su botón!' },
  caramelos: { name: 'Frasco de Caramelos', emoji: '🍭', desc: 'En tu turno, cada toque saca un caramelo. Si dejás de tocar, los guardás. ¡Pero si sacás el ácido perdés todo el turno!' },
  sillas:    { name: 'Sillas Musicales', emoji: '🧁', desc: 'Bailen mientras suena la música. Cuando aparezcan los cupcakes, ¡agarrá uno! Siempre falta uno…' },
  jardin:    { name: 'Jardín de Flores', emoji: '🌸', desc: 'Tu flor crece y luego se marchita. Cortala justo cuando esté más grande para ganar más puntos.' },
};

const SOGA_STEP     = 0.022;  // tirón por toque
const SOGA_WIN      = 0.45;   // desplazamiento para ganar
const CANDY_TURNS   = 2;      // vueltas completas de turnos
const CANDY_IDLE    = 2.2;    // segundos sin tocar para guardar y pasar el turno
const JARDIN_TIME   = 45;     // segundos de partida

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export class FourPlayers {
  constructor(canvas, mode) {
    this.canvas = canvas;
    this.mode = MODES[mode] ? mode : 'soga';
    this.reset();
  }

  reset() {
    this.t = 0;
    this.phase = 'countdown';   // 'countdown' | 'play' | 'over'
    this.cd = 3.2;
    this.winner = null;         // índice ganador | 'teamL' | 'teamR' | 'empate'
    this.scores = [0, 0, 0, 0];
    this.floats = [];
    this.parts = [];
    this.flash = [0, 0, 0, 0];

    if (this.mode === 'soga') {
      this.pos = 0;             // -SOGA_WIN (gana Rosa) .. +SOGA_WIN (gana Violeta)
    } else if (this.mode === 'caramelos') {
      this.turn = 0;            // jugador = turn % 4
      this.stash = 0;           // caramelos sin guardar del turno actual
      this.takenTurn = 0;       // sacados en este turno (sube el riesgo)
      this.idleT = 3.2;
      this.pauseT = 0;          // pausa tras un caramelo ácido
    } else if (this.mode === 'sillas') {
      this.alive = [true, true, true, true];
      this.frozen = [false, false, false, false];
      this._newSillasRound();
    } else if (this.mode === 'jardin') {
      this.timeLeft = JARDIN_TIME;
      this.flowers = PLAYERS.map(() => ({ st: 'wait', t: 0, delay: 0.5 + Math.random() * 1.5, kind: pick(['🌸', '🌷', '🌼', '🌺']) }));
    }
  }

  restart() { this.reset(); }

  _newSillasRound() {
    this.sil = { st: 'dance', t: 0, danceLen: 2 + Math.random() * 3, grabbed: [], out: null };
    this.frozen = [false, false, false, false];
  }

  _aliveCount() { return this.alive.filter(Boolean).length; }

  // ── Geometría ──
  _geom() {
    const W = this.canvas.width, H = this.canvas.height;
    const sc = Math.max(0.62, Math.min(W, H) / 620);
    const padH = Math.min(200, Math.max(108, H * 0.30));
    return { W, H, sc, padH, contentH: H - padH };
  }
  _colX(i, W) { return (i + 0.5) * W / 4; }

  _finishByScore() {
    this.phase = 'over';
    const max = Math.max(...this.scores);
    const leaders = [0, 1, 2, 3].filter(k => this.scores[k] === max);
    this.winner = leaders.length === 1 ? leaders[0] : 'empate';
  }

  // ── Input ──
  press(i) {
    if (i < 0 || i > 3) return;
    this.flash[i] = 0.25;

    if (this.phase === 'over') { this.restart(); return; }
    if (this.phase !== 'play') return;

    if (this.mode === 'soga') {
      this.pos += i < 2 ? -SOGA_STEP : SOGA_STEP;
      if (this.pos <= -SOGA_WIN) { this.phase = 'over'; this.winner = 'teamL'; }
      if (this.pos >= SOGA_WIN)  { this.phase = 'over'; this.winner = 'teamR'; }
    } else if (this.mode === 'caramelos') {
      if (this.pauseT > 0 || i !== this.turn % 4) return;
      const G = this._geom();
      const sourChance = 0.05 + this.takenTurn * 0.055;
      this.takenTurn++;
      if (Math.random() < sourChance) {
        this._addFloat(G.W / 2, G.contentH * 0.42, '🤢 ¡Ácido!', '#8BC34A');
        this._burst(G.W / 2, G.contentH * 0.45, '#8BC34A', 24);
        this.stash = 0;
        this.pauseT = 1.3;      // al terminar la pausa pasa el turno
      } else {
        this.stash++;
        this.idleT = CANDY_IDLE;
        this._addFloat(G.W / 2 + (Math.random() - 0.5) * 60, G.contentH * 0.4, '🍬 +1', PLAYERS[i].color);
      }
    } else if (this.mode === 'sillas') {
      const sil = this.sil;
      if (!this.alive[i]) return;
      if (sil.st === 'dance') {
        if (!this.frozen[i]) {
          this.frozen[i] = true;   // se adelantó: no puede agarrar en esta ronda
          const G = this._geom();
          this._addFloat(this._colX(i, G.W), G.contentH * 0.5, '🚫 ¡Muy pronto!', '#E24C4C');
        }
      } else if (sil.st === 'grab') {
        if (this.frozen[i] || sil.grabbed.includes(i)) return;
        if (sil.grabbed.length < this._aliveCount() - 1) {
          sil.grabbed.push(i);
          const G = this._geom();
          this._burst(this._colX(i, G.W), G.contentH * 0.55, PLAYERS[i].color, 14);
          if (sil.grabbed.length >= this._aliveCount() - 1) this._resolveSillas();
        }
      }
    } else if (this.mode === 'jardin') {
      const G = this._geom(), f = this.flowers[i];
      const size = this._flowerSize(f);
      if (size <= 0.05) {
        this.scores[i] = Math.max(0, this.scores[i] - 2);
        this._addFloat(this._colX(i, G.W), G.contentH * 0.5, '-2', '#E24C4C');
        return;
      }
      const pts = Math.max(1, Math.round(size * 10));
      this.scores[i] += pts;
      this._addFloat(this._colX(i, G.W), G.contentH * 0.5, pts === 10 ? '¡Perfecta! +10' : `+${pts}`, PLAYERS[i].color);
      this._burst(this._colX(i, G.W), G.contentH * 0.55, PLAYERS[i].color, pts >= 8 ? 20 : 8);
      f.st = 'wait'; f.t = 0; f.delay = 0.6 + Math.random() * 1.6; f.kind = pick(['🌸', '🌷', '🌼', '🌺']);
    }
  }

  _resolveSillas() {
    const sil = this.sil;
    const losers = [0, 1, 2, 3].filter(i => this.alive[i] && !sil.grabbed.includes(i));
    // si nadie agarró nada, se repite la ronda sin eliminar
    sil.out = losers.length === this._aliveCount() ? null : losers;
    if (sil.out) for (const k of sil.out) this.alive[k] = false;
    sil.st = 'result'; sil.t = 0;
  }

  _flowerSize(f) {
    if (f.st === 'grow') return Math.min(1, f.t / 2.2);
    if (f.st === 'peak') return 1;
    if (f.st === 'wilt') return Math.max(0, 1 - f.t / 1.1);
    return 0;
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
    for (let i = 0; i < 4; i++) if (this.flash[i] > 0) this.flash[i] = Math.max(0, this.flash[i] - dt);

    if (this.phase === 'countdown') {
      this.cd -= dt;
      if (this.cd <= 0) this.phase = 'play';
    } else if (this.phase === 'play') {
      if (this.mode === 'caramelos') {
        if (this.pauseT > 0) {
          this.pauseT -= dt;
          if (this.pauseT <= 0) this._nextCandyTurn();
        } else {
          this.idleT -= dt;
          if (this.idleT <= 0) {
            if (this.stash > 0) {
              const cur = this.turn % 4, G = this._geom();
              this.scores[cur] += this.stash;
              this._addFloat(G.W / 2, G.contentH * 0.35, `¡${this.stash} guardados!`, PLAYERS[cur].color);
            }
            this._nextCandyTurn();
          }
        }
      } else if (this.mode === 'sillas') {
        const sil = this.sil;
        sil.t += dt;
        if (sil.st === 'dance') {
          if (sil.t >= sil.danceLen) { sil.st = 'grab'; sil.t = 0; }
        } else if (sil.st === 'grab') {
          if (sil.t >= 3) this._resolveSillas();
        } else if (sil.st === 'result') {
          if (sil.t >= 1.5) {
            if (this._aliveCount() <= 1) {
              this.phase = 'over';
              this.winner = this.alive.findIndex(Boolean);
              if (this.winner < 0) this.winner = 'empate';
            } else this._newSillasRound();
          }
        }
      } else if (this.mode === 'jardin') {
        this.timeLeft -= dt;
        for (const f of this.flowers) {
          f.t += dt;
          if (f.st === 'wait' && f.t >= f.delay) { f.st = 'grow'; f.t = 0; }
          else if (f.st === 'grow' && f.t >= 2.2) { f.st = 'peak'; f.t = 0; }
          else if (f.st === 'peak' && f.t >= 0.5) { f.st = 'wilt'; f.t = 0; }
          else if (f.st === 'wilt' && f.t >= 1.1) { f.st = 'wait'; f.t = 0; f.delay = 0.6 + Math.random() * 1.6; }
        }
        if (this.timeLeft <= 0) { this.timeLeft = 0; this._finishByScore(); }
      }
    }

    const g = this._geom();
    for (const p of this.parts) { p.life += dt; p.vy += 260 * g.sc * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    this.parts = this.parts.filter(p => p.life < p.max);
    for (const f of this.floats) { f.life += dt; f.y -= 40 * g.sc * dt; }
    this.floats = this.floats.filter(f => f.life < f.max);
  }

  _nextCandyTurn() {
    this.turn++;
    this.stash = 0;
    this.takenTurn = 0;
    this.idleT = 3.2;
    this.pauseT = 0;
    if (this.turn >= CANDY_TURNS * 4) this._finishByScore();
  }

  // ── Render ──
  render(ctx) {
    const G = this._geom();
    ctx.fillStyle = '#12123a';
    ctx.fillRect(0, 0, G.W, G.H);

    if (this.mode === 'soga')           this._renderSoga(ctx, G);
    else if (this.mode === 'caramelos') this._renderCaramelos(ctx, G);
    else if (this.mode === 'sillas')    this._renderSillas(ctx, G);
    else if (this.mode === 'jardin')    this._renderJardin(ctx, G);

    for (const p of this.parts) {
      ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const f of this.floats) {
      ctx.globalAlpha = Math.max(0, 1 - f.life / f.max);
      ctx.fillStyle = f.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `900 ${30 * G.sc}px system-ui, sans-serif`;
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
    const sc = G.sc, y = 72 * sc, gap = 8 * sc;
    const cw = Math.min(110 * sc, (G.W - 20 * sc - gap * 3) / 4);
    const total = cw * 4 + gap * 3, x0 = G.W / 2 - total / 2;
    for (let i = 0; i < 4; i++) {
      const x = x0 + i * (cw + gap);
      ctx.fillStyle = hexA(PLAYERS[i].color, 0.9 - (this.flash[i] > 0 ? 0 : 0.15));
      ctx.strokeStyle = this.flash[i] > 0 ? '#fff' : hexA(PLAYERS[i].color, 1);
      ctx.lineWidth = 2 * sc;
      ctx.beginPath(); ctx.roundRect(x, y, cw, 40 * sc, 12 * sc); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `800 ${13 * sc}px system-ui, sans-serif`;
      ctx.fillText(`${PLAYERS[i].racer} J${i + 1}`, x + cw / 2, y + 13 * sc);
      ctx.font = `900 ${15 * sc}px system-ui, sans-serif`;
      ctx.fillText(labelFn(i), x + cw / 2, y + 29 * sc);
    }
  }

  // ── Tira y Afloja ──
  _renderSoga(ctx, G) {
    const sc = G.sc;
    this._drawTitle(ctx, G, 'Rosa (J1+J2) contra Violeta (J3+J4)');

    const cy = 130 * sc + (G.contentH - 130 * sc) * 0.5;
    const bw = G.W - 100 * sc, bx = 50 * sc;
    // zonas de victoria
    ctx.fillStyle = hexA('#FF5D8F', 0.18);
    ctx.fillRect(bx, cy - 40 * sc, bw * 0.12, 80 * sc);
    ctx.fillStyle = hexA('#8E7BFF', 0.18);
    ctx.fillRect(bx + bw * 0.88, cy - 40 * sc, bw * 0.12, 80 * sc);
    // soga
    ctx.strokeStyle = '#C89B5A'; ctx.lineWidth = 8 * sc; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(bx, cy); ctx.lineTo(bx + bw, cy); ctx.stroke();
    // moño marcador (pos ∈ -WIN..WIN → mitad de la soga)
    const mx = G.W / 2 + (this.pos / SOGA_WIN) * bw * 0.38;
    ctx.font = `${44 * sc}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🎀', mx, cy - 2 * sc);
    // equipos
    ctx.font = `${40 * sc}px serif`;
    ctx.fillText(PLAYERS[0].racer, bx + 10 * sc, cy - 50 * sc);
    ctx.fillText(PLAYERS[1].racer, bx + 55 * sc, cy - 50 * sc);
    ctx.fillText(PLAYERS[2].racer, bx + bw - 55 * sc, cy - 50 * sc);
    ctx.fillText(PLAYERS[3].racer, bx + bw - 10 * sc, cy - 50 * sc);
    ctx.fillStyle = '#FF5D8F'; ctx.font = `900 ${20 * sc}px system-ui, sans-serif`;
    ctx.fillText('Equipo Rosa ←', G.W * 0.25, cy + 64 * sc);
    ctx.fillStyle = '#8E7BFF';
    ctx.fillText('→ Equipo Violeta', G.W * 0.75, cy + 64 * sc);
  }

  // ── Frasco de Caramelos ──
  _renderCaramelos(ctx, G) {
    const sc = G.sc, cur = this.turn % 4;
    const vuelta = Math.min(CANDY_TURNS, Math.floor(this.turn / 4) + 1);
    this._drawTitle(ctx, G, `Vuelta ${vuelta}/${CANDY_TURNS}`);
    this._drawScoreChips(ctx, G, i => `🍬 ${this.scores[i]}`);

    const cy = 130 * sc + (G.contentH - 130 * sc) * 0.48;
    // frasco
    ctx.font = `${86 * sc}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🫙', G.W / 2, cy);
    ctx.font = `${30 * sc}px serif`;
    const bob = Math.sin(this.t * 6) * 3 * sc;
    ctx.fillText('🍭', G.W / 2, cy - 8 * sc + bob);

    ctx.fillStyle = PLAYERS[cur].color; ctx.font = `900 ${22 * sc}px system-ui, sans-serif`;
    ctx.fillText(`Turno de ${PLAYERS[cur].name} ${PLAYERS[cur].racer}`, G.W / 2, cy - 76 * sc);
    ctx.fillStyle = '#fff'; ctx.font = `800 ${18 * sc}px system-ui, sans-serif`;
    ctx.fillText(`En la mano: ${this.stash}`, G.W / 2, cy + 68 * sc);
    // barra de "guardado" (si no tocás, se guardan)
    if (this.pauseT <= 0 && this.stash > 0) {
      const frac = Math.max(0, Math.min(1, this.idleT / CANDY_IDLE));
      const bw = 180 * sc, bx = G.W / 2 - bw / 2, by = cy + 88 * sc;
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.roundRect(bx, by, bw, 10 * sc, 5 * sc); ctx.fill();
      ctx.fillStyle = '#FFD23A'; ctx.beginPath(); ctx.roundRect(bx, by, bw * (1 - frac), 10 * sc, 5 * sc); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = `600 ${12 * sc}px system-ui, sans-serif`;
      ctx.fillText('quedate quieta para guardarlos', G.W / 2, by + 22 * sc);
    }
  }

  // ── Sillas Musicales ──
  _renderSillas(ctx, G) {
    const sc = G.sc, sil = this.sil;
    const sub = sil.st === 'dance' ? '♪ ♫ Bailen… esperen los cupcakes ♫ ♪'
              : sil.st === 'grab' ? '¡AHORA! ¡Agarrá tu cupcake!'
              : '…';
    this._drawTitle(ctx, G, sub);

    // fondo según fase
    if (sil.st === 'grab') { ctx.fillStyle = 'rgba(255,210,58,0.10)'; ctx.fillRect(0, 100 * sc, G.W, G.contentH - 100 * sc); }

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const cy = 120 * sc + (G.contentH - 120 * sc) * 0.45;
    for (let i = 0; i < 4; i++) {
      const cx = this._colX(i, G.W);
      if (!this.alive[i]) {
        ctx.globalAlpha = 0.4;
        ctx.font = `${40 * sc}px serif`; ctx.fillText('😢', cx, cy);
        ctx.globalAlpha = 1;
        continue;
      }
      const dance = sil.st === 'dance' ? Math.sin(this.t * 7 + i * 1.7) * 10 * sc : 0;
      ctx.font = `${48 * sc}px serif`;
      ctx.fillText(PLAYERS[i].racer, cx + dance * 0.4, cy + Math.abs(dance) * -1);
      if (this.frozen[i]) { ctx.font = `${20 * sc}px serif`; ctx.fillText('🚫', cx + 26 * sc, cy - 26 * sc); }
      if (sil.st !== 'dance' && sil.grabbed.includes(i)) { ctx.font = `${26 * sc}px serif`; ctx.fillText('🧁', cx, cy + 44 * sc); }
    }
    // cupcakes disponibles al centro
    if (sil.st === 'grab') {
      const left = this._aliveCount() - 1 - sil.grabbed.length;
      ctx.font = `${34 * sc}px serif`;
      for (let k = 0; k < left; k++) ctx.fillText('🧁', G.W / 2 + (k - (left - 1) / 2) * 46 * sc, 128 * sc);
    }
    if (sil.st === 'result' && sil.out) {
      ctx.fillStyle = '#E24C4C'; ctx.font = `900 ${26 * sc}px system-ui, sans-serif`;
      ctx.fillText(`${sil.out.map(k => PLAYERS[k].name).join(' y ')} sin cupcake 😢`, G.W / 2, G.contentH - 30 * sc);
    }
    if (sil.st === 'result' && !sil.out) {
      ctx.fillStyle = '#FFD700'; ctx.font = `900 ${26 * sc}px system-ui, sans-serif`;
      ctx.fillText('¡Nadie agarró! Se repite…', G.W / 2, G.contentH - 30 * sc);
    }
  }

  // ── Jardín de Flores ──
  _renderJardin(ctx, G) {
    const sc = G.sc;
    this._drawTitle(ctx, G, `Tiempo: ${Math.ceil(this.timeLeft)}s — cortá tu flor bien grande`);
    this._drawScoreChips(ctx, G, i => `🌸 ${this.scores[i]}`);

    const floorY = G.contentH - 20 * sc;
    ctx.fillStyle = '#1E4020';
    ctx.fillRect(0, floorY, G.W, 20 * sc);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < 4; i++) {
      const cx = this._colX(i, G.W), f = this.flowers[i];
      ctx.fillStyle = hexA(PLAYERS[i].color, 0.08);
      ctx.fillRect(cx - G.W / 8 + 5 * sc, 120 * sc, G.W / 4 - 10 * sc, G.contentH - 120 * sc);
      const size = this._flowerSize(f);
      if (size <= 0) continue;
      const fs = (14 + size * 44) * sc;
      const droop = f.st === 'wilt' ? (1 - size) * 0.6 : 0;   // se inclina al marchitarse
      // tallo
      ctx.strokeStyle = '#3E8E41'; ctx.lineWidth = 3 * sc;
      ctx.beginPath(); ctx.moveTo(cx, floorY);
      ctx.quadraticCurveTo(cx, floorY - fs * 0.8, cx + droop * 20 * sc, floorY - fs * 1.3);
      ctx.stroke();
      ctx.save();
      ctx.translate(cx + droop * 20 * sc, floorY - fs * 1.3);
      ctx.rotate(droop);
      if (f.st === 'wilt') ctx.globalAlpha = 0.5 + size * 0.5;
      ctx.font = `${fs}px serif`;
      ctx.fillText(f.kind, 0, 0);
      ctx.restore();
      if (f.st === 'peak') {
        ctx.fillStyle = '#FFD23A'; ctx.font = `900 ${15 * sc}px system-ui, sans-serif`;
        ctx.fillText('✨ ¡AHORA! ✨', cx, floorY - fs * 2 - 16 * sc);
      }
    }
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

    if (this.winner === 'teamL' || this.winner === 'teamR') {
      const left = this.winner === 'teamL';
      ctx.font = `${80 * sc}px serif`; ctx.fillText('🏆', G.W / 2, G.H * 0.30);
      ctx.fillStyle = left ? '#FF5D8F' : '#8E7BFF'; ctx.font = `900 ${44 * sc}px system-ui, sans-serif`;
      ctx.fillText(left ? '¡Gana el Equipo Rosa!' : '¡Gana el Equipo Violeta!', G.W / 2, G.H * 0.46);
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
