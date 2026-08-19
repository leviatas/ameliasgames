// ── Piedra, Papel o Tijera (2P) ─────────────────────────────────────────────
// El problema de jugar en una sola pantalla es que la que elige segunda ve el
// dedo (y el botón resaltado) de la otra y gana siempre. Por eso:
//   1. hay una cuenta "3, 2, 1, ¡YA!" y los botones SÓLO responden en la
//      ventana del ¡YA! — como hay que apurarse, no queda tiempo de espiar;
//   2. al elegir no se resalta nada: los tres botones se tapan con "🔒 ¡Listo!";
//   3. el orden de los tres íconos se baraja por jugadora y por ronda, así que
//      mirar DÓNDE tocó la otra no dice QUÉ eligió;
//   4. online, el estado que viaja no lleva las elecciones hasta el reveal
//      (sólo "ya eligió / no eligió"), así que la invitada no las puede ver.
import { Sound } from './Sound.js';

const CHOICES = ['piedra', 'papel', 'tijera'];
const EMOJI = { piedra: '✊', papel: '🖐', tijera: '✌️' };
const BEATS = { piedra: 'tijera', papel: 'piedra', tijera: 'papel' }; // key vence a value

const COUNT_STEP = 0.75;              // cuánto dura cada número de la cuenta
const COUNT_T    = COUNT_STEP * 3;    // "3, 2, 1"
const GO_T       = 3.2;               // ventana del ¡YA! para elegir
const REVEAL_T   = 1.8;

function shuffled() {
  const a = CHOICES.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class PiedraPapelTijera {
  constructor(canvas) {
    this.canvas = canvas;
    this._reset();
  }

  _reset() {
    const W = this.canvas.width, H = this.canvas.height;
    this.W = W; this.H = H;
    this.ROUNDS_TO_WIN = 3;
    this.score = { p1: 0, p2: 0 };
    this.winner = null;
    this._newRound();
  }

  _newRound() {
    this.phase = 'count';   // 'count' | 'go' | 'reveal' | 'over'
    this.t = COUNT_T;
    this.p1Choice = null; this.p2Choice = null;
    this.p1Ready = false;  this.p2Ready = false;
    this.p1Auto = false;   this.p2Auto = false;   // le salió al azar por tardar
    this.roundWinner = null;
    this.order = { p1: shuffled(), p2: shuffled() };
  }

  _buttons(player) {
    const W = this.W, H = this.H, half = W / 2;
    const bw = Math.min(half * 0.26, H * 0.18);
    const gap = bw * 0.25;
    const totalW = bw * 3 + gap * 2;
    const x0 = player === 'p1' ? (half - totalW) / 2 : half + (half - totalW) / 2;
    const y0 = H * 0.62;
    const order = (this.order && this.order[player]) || CHOICES;
    return order.map((choice, i) => ({ x: x0 + i * (bw + gap), y: y0, w: bw, h: bw, choice }));
  }

  // Caja que cubre los tres botones (la tapa "🔒 ¡Listo!")
  _panel(player) {
    const b = this._buttons(player);
    const first = b[0], last = b[b.length - 1];
    return { x: first.x, y: first.y, w: last.x + last.w - first.x, h: first.h };
  }

  _resolveRound() {
    const a = this.p1Choice, b = this.p2Choice;
    if (a === b) this.roundWinner = 'empate';
    else if (BEATS[a] === b) { this.roundWinner = 'p1'; this.score.p1++; }
    else { this.roundWinner = 'p2'; this.score.p2++; }
    this.phase = 'reveal'; this.t = REVEAL_T;
  }

  update(dt) {
    if (this.phase === 'over') return;
    this.t -= dt;

    if (this.phase === 'count') {
      if (this.t <= 0) { this.phase = 'go'; this.t = GO_T; }
      return;
    }

    if (this.phase === 'go') {
      if (this.p1Ready && this.p2Ready) { this._resolveRound(); return; }
      if (this.t <= 0) {
        // La que no llegó a elegir juega al azar: nadie se queda esperando.
        if (!this.p1Ready) { this.p1Choice = CHOICES[Math.floor(Math.random() * 3)]; this.p1Ready = true; this.p1Auto = true; }
        if (!this.p2Ready) { this.p2Choice = CHOICES[Math.floor(Math.random() * 3)]; this.p2Ready = true; this.p2Auto = true; }
        this._resolveRound();
      }
      return;
    }

    if (this.phase === 'reveal' && this.t <= 0) {
      if (this.score.p1 >= this.ROUNDS_TO_WIN || this.score.p2 >= this.ROUNDS_TO_WIN) {
        this.phase = 'over'; this.winner = this.score.p1 > this.score.p2 ? 'p1' : 'p2';
      } else {
        this._newRound();
      }
    }
  }

  pointerDown(cx, cy, player) {
    if (this.phase === 'over') { this._reset(); return; }
    if (this.phase !== 'go' || !player) return;          // durante la cuenta no cuenta
    if (player === 'p1' ? this.p1Ready : this.p2Ready) return;
    for (const b of this._buttons(player)) {
      if (cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h) {
        if (player === 'p1') { this.p1Choice = b.choice; this.p1Ready = true; }
        else                 { this.p2Choice = b.choice; this.p2Ready = true; }
        break;
      }
    }
  }
  pointerMove() {}
  pointerUp() {}

  // Sonidos disparados desde el render (mirando cambios de estado) y no desde
  // update(), porque la invitada del modo online nunca corre update().
  _sfx() {
    const num = this.phase === 'count' ? Math.max(1, Math.ceil(this.t / COUNT_STEP)) : 0;
    if (num && num !== this._sndNum) Sound.pick();
    this._sndNum = num;
    if (this.phase !== this._sndPhase) {
      if (this.phase === 'go') Sound.add();
      else if (this.phase === 'reveal') { if (this.roundWinner === 'empate') Sound.undo(); else Sound.serveGood(); }
      else if (this.phase === 'over') Sound.serveGood();
      this._sndPhase = this.phase;
    }
  }

  render(ctx) {
    const { W, H } = this;
    this._sfx();

    ctx.fillStyle = '#12081e'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,68,136,0.06)'; ctx.fillRect(0, 0, W / 2, H);
    ctx.fillStyle = 'rgba(68,136,255,0.06)'; ctx.fillRect(W / 2, 0, W / 2, H);
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(W / 2 - 1, 0, 2, H);

    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.font = `900 ${H * 0.06}px system-ui`;
    ctx.fillStyle = '#FF88BB'; ctx.fillText('P1', W * 0.25, 10);
    ctx.fillStyle = '#88BBFF'; ctx.fillText('P2', W * 0.75, 10);

    const dotR = Math.max(7, H * 0.022);
    for (let i = 0; i < this.ROUNDS_TO_WIN; i++) {
      ctx.beginPath(); ctx.arc(W * 0.25 - (this.ROUNDS_TO_WIN - 1) * dotR * 1.2 + i * dotR * 2.4, H * 0.15, dotR, 0, Math.PI * 2);
      ctx.fillStyle = i < this.score.p1 ? '#FF88BB' : 'rgba(255,136,187,0.25)'; ctx.fill();
    }
    for (let i = 0; i < this.ROUNDS_TO_WIN; i++) {
      ctx.beginPath(); ctx.arc(W * 0.75 - (this.ROUNDS_TO_WIN - 1) * dotR * 1.2 + i * dotR * 2.4, H * 0.15, dotR, 0, Math.PI * 2);
      ctx.fillStyle = i < this.score.p2 ? '#88BBFF' : 'rgba(136,187,255,0.25)'; ctx.fill();
    }

    this._renderCountdown(ctx);

    // En el reveal / final manda el cartel de arriba: los botones sólo se
    // verían apagados atrás del velo negro y ensucian el texto.
    if (this.phase === 'count' || this.phase === 'go') this._renderChoosers(ctx);

    if (this.phase === 'reveal') this._renderReveal(ctx);
    if (this.phase === 'over')   this._renderOver(ctx);
  }

  _renderChoosers(ctx) {
    const { W, H } = this;
    for (const player of ['p1', 'p2']) {
      const ready = player === 'p1' ? this.p1Ready : this.p2Ready;
      const btns = this._buttons(player);
      const labelX = player === 'p1' ? W * 0.25 : W * 0.75;

      if (ready) {
        // Tapa: ni el ícono elegido ni la posición quedan a la vista.
        const p = this._panel(player);
        ctx.fillStyle = 'rgba(255,215,0,0.16)';
        ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, p.h, p.h * 0.22); ctx.fill();
        ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, p.h, p.h * 0.22); ctx.stroke();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `${p.h * 0.42}px serif`; ctx.fillStyle = '#fff';
        ctx.fillText('🔒', p.x + p.w / 2, p.y + p.h * 0.42);
        ctx.font = `bold ${p.h * 0.22}px system-ui`; ctx.fillStyle = '#FFD700';
        ctx.fillText('¡Listo!', p.x + p.w / 2, p.y + p.h * 0.78);
      } else {
        const dim = this.phase === 'count';
        for (const b of btns) {
          ctx.globalAlpha = dim ? 0.4 : 1;
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, b.w * 0.18); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, b.w * 0.18); ctx.stroke();
          ctx.font = `${b.w * 0.55}px serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = '#fff';
          ctx.fillText(EMOJI[b.choice], b.x + b.w / 2, b.y + b.h / 2);
          ctx.globalAlpha = 1;
        }
      }

      ctx.font = `bold ${H * 0.038}px system-ui`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      let msg, color;
      if (ready)                    { msg = '✓ ¡Ya elegiste!'; color = '#FFD700'; }
      else if (this.phase === 'go') { msg = '¡Elegí ahora!';    color = '#fff'; }
      else                          { msg = 'Esperá el ¡YA!';   color = 'rgba(255,255,255,0.5)'; }
      ctx.fillStyle = color;
      ctx.fillText(msg, labelX, btns[0].y - H * 0.03);
    }
  }

  _renderCountdown(ctx) {
    const { W, H } = this;
    const cy = H * 0.33;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    if (this.phase === 'count') {
      const num = Math.max(1, Math.min(3, Math.ceil(this.t / COUNT_STEP)));
      const frac = (this.t % COUNT_STEP) / COUNT_STEP;   // 1 → 0 dentro del número
      ctx.save();
      ctx.translate(W / 2, cy);
      ctx.scale(1 + frac * 0.35, 1 + frac * 0.35);
      ctx.globalAlpha = Math.min(1, 0.35 + frac * 1.2);
      ctx.font = `900 ${H * 0.16}px system-ui`;
      ctx.fillStyle = '#FFD700';
      ctx.fillText(String(num), 0, 0);
      ctx.restore();
      ctx.font = `bold ${H * 0.04}px system-ui`;
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText('Piedra, papel o…', W / 2, cy + H * 0.12);
      return;
    }

    if (this.phase === 'go') {
      const elapsed = GO_T - this.t;
      const pop = 1 + 0.45 * Math.max(0, 1 - elapsed * 4);
      const hurry = this.t < 1.2;
      ctx.save();
      ctx.translate(W / 2, cy);
      ctx.scale(pop, pop);
      ctx.font = `900 ${H * 0.14}px system-ui`;
      ctx.fillStyle = hurry ? '#FF6688' : '#7CFFB2';
      ctx.fillText('¡YA!', 0, 0);
      ctx.restore();
      // Barra de tiempo
      const bw = W * 0.34, bh = Math.max(8, H * 0.018);
      const bx = W / 2 - bw / 2, by = cy + H * 0.12;
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, bh / 2); ctx.fill();
      const k = Math.max(0, Math.min(1, this.t / GO_T));
      ctx.fillStyle = hurry ? '#FF6688' : '#7CFFB2';
      ctx.beginPath(); ctx.roundRect(bx, by, bw * k, bh, bh / 2); ctx.fill();
    }
  }

  _renderReveal(ctx) {
    const { W, H } = this;
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `${H * 0.2}px serif`;
    ctx.fillStyle = '#fff';
    ctx.fillText(EMOJI[this.p1Choice] || '❓', W * 0.30, H * 0.42);
    ctx.fillText(EMOJI[this.p2Choice] || '❓', W * 0.70, H * 0.42);
    ctx.font = `bold ${H * 0.032}px system-ui`;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    if (this.p1Auto) ctx.fillText('(al azar, tardaste)', W * 0.30, H * 0.55);
    if (this.p2Auto) ctx.fillText('(al azar, tardaste)', W * 0.70, H * 0.55);
    let msg, color;
    if (this.roundWinner === 'empate') { msg = '¡Empate!'; color = '#FFD700'; }
    else {
      const cfg = this.roundWinner === 'p1' ? { c: '#FF88BB', n: 'P1' } : { c: '#88BBFF', n: 'P2' };
      msg = `¡Punto para ${cfg.n}!`; color = cfg.c;
    }
    ctx.font = `bold ${H * 0.08}px system-ui`; ctx.fillStyle = color;
    ctx.fillText(msg, W / 2, H * 0.68);
  }

  _renderOver(ctx) {
    const { W, H } = this;
    ctx.fillStyle = 'rgba(0,0,0,0.78)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const cfg = this.winner === 'p1' ? { c: '#FF88BB', n: 'P1' } : { c: '#88BBFF', n: 'P2' };
    ctx.font = `900 ${H * 0.16}px system-ui`; ctx.fillStyle = cfg.c;
    ctx.fillText(`¡Ganó ${cfg.n}!`, W / 2, H * 0.4);
    ctx.font = `bold ${H * 0.08}px system-ui`; ctx.fillStyle = '#ffffffaa';
    ctx.fillText(`${this.score.p1}  :  ${this.score.p2}`, W / 2, H * 0.56);
    ctx.font = `${H * 0.055}px system-ui`; ctx.fillStyle = '#ffffff66';
    ctx.fillText('Tocá para jugar de nuevo', W / 2, H * 0.7);
  }

  // ── Online sync: host broadcasts this every frame, guest applies it ──────
  // OJO: las elecciones sólo viajan una vez que se revelan. Si se mandaran
  // durante la cuenta, la invitada las vería en su propia pantalla.
  getNetState() {
    const open = this.phase === 'reveal' || this.phase === 'over';
    return {
      W: this.W, H: this.H, ROUNDS_TO_WIN: this.ROUNDS_TO_WIN,
      score: this.score, phase: this.phase, t: this.t, order: this.order,
      p1Ready: this.p1Ready, p2Ready: this.p2Ready,
      p1Choice: open ? this.p1Choice : null,
      p2Choice: open ? this.p2Choice : null,
      p1Auto: open ? this.p1Auto : false,
      p2Auto: open ? this.p2Auto : false,
      roundWinner: this.roundWinner, winner: this.winner,
    };
  }

  setNetState(s) {
    this.W = s.W; this.H = s.H; this.ROUNDS_TO_WIN = s.ROUNDS_TO_WIN;
    this.score = s.score; this.phase = s.phase; this.t = s.t; this.order = s.order;
    this.p1Ready = s.p1Ready; this.p2Ready = s.p2Ready;
    this.p1Choice = s.p1Choice; this.p2Choice = s.p2Choice;
    this.p1Auto = s.p1Auto; this.p2Auto = s.p2Auto;
    this.roundWinner = s.roundWinner; this.winner = s.winner;
  }
}
