// ── Sopa Loca (2P, simultáneo, olla compartida) ──────────────────────────────
// La vuelta de tuerca: acá NO hay pantalla partida ni turnos. Hay UNA sola olla
// en el medio y un carrusel de ingredientes que gira alrededor, a la vista de
// las dos. Cada una sólo puede manotear lo que está pasando por SU mitad, así
// que el ingrediente que te sirve tarda en llegarte… y mientras tanto la otra
// puede quemártelo (le cuesta un poquito, pero te lo saca).
//
// La sopa tiene un sabor que va de dulce 🍓 (izquierda, P1) a salado 🧀
// (derecha, P2). Tirás algo de tu sabor y la sopa se corre para tu lado; ganás
// la olla cuando llega del todo a tu punta. La cuchara tarda medio segundo en
// volver, así que no sirve tocar como loca: hay que elegir qué agarrar.

import { Sound } from './Sound.js';

const SWEET  = ['🍓', '🍰', '🍫', '🍌', '🍎', '🧁', '🍇', '🍒'];
const SALTY  = ['🧀', '🥓', '🫒', '🥨', '🍟', '🥒', '🍅', '🌭'];
const POWERS = [
  { e: '🌶️', k: 'spicy', txt: '¡PICANTE! doble empujón' },
  { e: '🧊', k: 'ice',   txt: '¡Cuchara congelada!' },
  { e: '🌀', k: 'swirl', txt: '¡Se dio vuelta el carrusel!' },
  { e: '🍯', k: 'honey', txt: '¡Miel! todo más lento' },
];

const SLOTS   = 9;      // puestos del carrusel
const PUSH    = 0.13;   // cuánto corre la sopa un ingrediente de tu sabor
const BURN    = 0.055;  // lo que te cuesta tirar algo que no es tuyo
const SPICY   = 0.26;   // el 🌶️ vale como dos
const COOL    = 0.5;    // recarga de la cuchara
const FREEZE  = 1.6;    // cuánto congela el 🧊
const HONEY   = 3.0;    // cuánto frena la 🍯
const FLY     = 0.34;   // vuelo del ingrediente hasta la olla
const RESPAWN = 0.85;   // cuánto tarda en aparecer uno nuevo en el puesto vacío
const DRIFT   = 0.012;  // la sopa vuelve sola al centro: nadie se duerme ganando
const SPIN0   = 0.55, SPIN_MAX = 1.7;
const POT_T   = 45;     // reloj de la olla
const WIN     = 3;      // ollas para ganar el partido

const rnd = a => a[Math.floor(Math.random() * a.length)];

export class SopaLoca {
  constructor(canvas) {
    this.canvas = canvas;
    this._init();
  }

  _init() {
    this.wins = { p1: 0, p2: 0 };
    this.phase = 'play';         // 'play' | 'round' (cartel entre ollas) | 'over'
    this.roundWinner = null;
    this.bannerT = 0;
    this._newPot();
  }

  _newPot() {
    this.W = this.canvas.width; this.H = this.canvas.height;
    this.flavor = 0;             // -1 = toda dulce (gana P1), +1 = toda salada (gana P2)
    // El ángulo del carrusel va adentro de un objeto y se llama `x` a propósito:
    // el interpolador de red de game.js sólo suaviza las claves x/y/vx/vy/t
    // (NET_LERP_KEYS). Con cualquier otro nombre el invitado vería el carrusel
    // moverse a los tirones, a 20 fps.
    this.spinner = { x: 0, spin: SPIN0, dir: 1 };
    this.ring = Array.from({ length: SLOTS }, () => this._newItem());
    this.fly = [];               // ingredientes en el aire, camino a la olla
    this.splash = [];            // salpicaduras (puro adorno)
    this.cool = { p1: 0, p2: 0 };
    this.froze = { p1: 0, p2: 0 };
    this.honeyT = 0;
    this.potT = POT_T;           // cuando llega a 0 gana la que tenga la sopa de su lado
    this.t = 0;                  // reloj corrido, para burbujas y vapor
    this.msg = null;             // { txt, t, side }
    this.phase = 'play';
    this._layout();
  }

  // 42% dulce, 42% salado, 16% poder: la olla queda pareja y de a ratos aparece
  // algo raro que la da vuelta.
  _newItem() {
    const r = Math.random();
    if (r < 0.42) return { kind: 'sweet', e: rnd(SWEET), dead: 0 };
    if (r < 0.84) return { kind: 'salty', e: rnd(SALTY), dead: 0 };
    const p = rnd(POWERS);
    return { kind: p.k, e: p.e, dead: 0 };
  }

  _layout() {
    const W = this.W, H = this.H;
    const s = Math.max(0.5, Math.min(1, Math.min(W, H) / 720));
    const cx = W / 2, cy = H * 0.52;
    const potW = Math.min(W * 0.40, H * 0.34);
    this._geo = {
      s, cx, cy, potW, potH: potW * 0.60,
      rx: Math.min(W * 0.36, W / 2 - potW * 0.12), ry: H * 0.29,
      ri: Math.min(W, H) * 0.055,          // radio de cada ingrediente
      barY: H * 0.94, barW: Math.min(W * 0.56, 560 * s), barH: Math.max(14, H * 0.032),
    };
  }

  _itemPos(i) {
    const g = this._geo;
    const a = this.spinner.x + i * Math.PI * 2 / SLOTS;
    return { x: g.cx + Math.cos(a) * g.rx, y: g.cy - g.ry * 0.12 + Math.sin(a) * g.ry };
  }

  _other(p) { return p === 'p1' ? 'p2' : 'p1'; }

  update(dt) {
    if (this.canvas.width !== this.W || this.canvas.height !== this.H) {
      this.W = this.canvas.width; this.H = this.canvas.height; this._layout();
    }
    this.t += dt;

    if (this.phase === 'round') {
      this.bannerT -= dt;
      if (this.bannerT <= 0) this._newPot();
      return;
    }
    if (this.phase === 'over') return;

    // carrusel
    const g = this._geo;
    this.honeyT = Math.max(0, this.honeyT - dt);
    const spin = this.spinner.spin * (this.honeyT > 0 ? 0.45 : 1);
    this.spinner.x += spin * this.spinner.dir * dt;

    for (const p of ['p1', 'p2']) {
      this.cool[p] = Math.max(0, this.cool[p] - dt);
      this.froze[p] = Math.max(0, this.froze[p] - dt);
    }

    // puestos vacíos que vuelven a llenarse
    for (let i = 0; i < this.ring.length; i++) {
      const it = this.ring[i];
      if (it.dead > 0) {
        it.dead -= dt;
        if (it.dead <= 0) this.ring[i] = this._newItem();
      }
    }

    // La sopa se enfría hacia el centro ANTES de resolver los impactos: si no, a
    // la cucharada que llega justo a la punta el enfriado se la come y la olla
    // no se gana nunca.
    if (this.flavor > 0) this.flavor = Math.max(0, this.flavor - DRIFT * dt);
    else if (this.flavor < 0) this.flavor = Math.min(0, this.flavor + DRIFT * dt);

    // ingredientes volando hacia la olla
    for (const f of this.fly) {
      f.t -= dt;
      f.x += f.vx * dt; f.y += f.vy * dt; f.vy += g.ry * 3.2 * dt;
      if (f.t <= 0) this._impact(f);
    }
    this.fly = this.fly.filter(f => f.t > 0);
    for (const s of this.splash) s.t -= dt;
    this.splash = this.splash.filter(s => s.t > 0);
    if (this.msg) { this.msg.t -= dt; if (this.msg.t <= 0) this.msg = null; }

    if (Math.abs(this.flavor) >= 1) { this._potWon(this.flavor < 0 ? 'p1' : 'p2'); return; }

    // El reloj de la olla: sin esto, dos que juegan igual de bien se pasan la
    // tarde empatando en el centro. Al llegar a 0 gana la que tiene la sopa de
    // su lado; si está justo en el medio, muerte súbita — la próxima cucharada
    // que la corra para algún lado decide.
    this.potT = Math.max(0, this.potT - dt);
    if (this.potT <= 0 && this.flavor !== 0) this._potWon(this.flavor < 0 ? 'p1' : 'p2');
  }

  _impact(f) {
    const g = this._geo;
    this.splash.push({ x: g.cx, y: g.cy - g.potH * 0.28, t: 0.45, kind: f.kind });
    const mine = (f.by === 'p1' && f.kind === 'sweet') || (f.by === 'p2' && f.kind === 'salty');
    const toMe = f.by === 'p1' ? -1 : 1;      // hacia dónde empuja lo que le sirve a f.by

    if (f.kind === 'sweet' || f.kind === 'salty') {
      if (mine) { this.flavor += toMe * PUSH; Sound.serveGood(); }
      else {
        // se quemó: no le sirve a nadie y encima la sopa se te va para el otro lado
        this.flavor -= toMe * BURN;
        this.msg = { txt: '🔥 ¡Se quemó!', t: 1.0, side: f.by };
        Sound.serveBad();
      }
    } else if (f.kind === 'spicy') {
      this.flavor += toMe * SPICY;
      this.msg = { txt: '🌶️ ¡Picante! doble empujón', t: 1.2, side: f.by };
      Sound.serveGood();
    } else if (f.kind === 'ice') {
      this.froze[this._other(f.by)] = FREEZE;
      this.msg = { txt: '🧊 ¡Cuchara congelada!', t: 1.2, side: f.by };
      Sound.pick();
    } else if (f.kind === 'swirl') {
      this.spinner.dir *= -1;
      this.msg = { txt: '🌀 ¡Se dio vuelta!', t: 1.2, side: f.by };
      Sound.pick();
    } else if (f.kind === 'honey') {
      this.honeyT = HONEY;
      this.msg = { txt: '🍯 ¡Todo más lento!', t: 1.2, side: f.by };
      Sound.pick();
    }

    this.flavor = Math.max(-1, Math.min(1, this.flavor));
    // cada cucharada apura un poco el carrusel: las ollas no se eternizan
    this.spinner.spin = Math.min(SPIN_MAX, this.spinner.spin * 1.035);
  }

  _potWon(p) {
    this.wins[p]++;
    this.roundWinner = p;
    this.fly = [];
    this.phase = this.wins[p] >= WIN ? 'over' : 'round';
    this.bannerT = 1.8;
    Sound.serveGood();
  }

  // Sólo se puede manotear lo que está pasando por la mitad propia: ahí está
  // toda la gracia del carrusel.
  pointerDown(x, y, player) {
    if (this.phase === 'over') { this._init(); return; }
    if (this.phase !== 'play') return;
    const who = player || (x < this.W / 2 ? 'p1' : 'p2');
    if (this.cool[who] > 0 || this.froze[who] > 0) return;

    const g = this._geo;
    let best = -1, bestD = g.ri * 2.1;
    for (let i = 0; i < this.ring.length; i++) {
      if (this.ring[i].dead > 0) continue;
      const p = this._itemPos(i);
      const mine = who === 'p1' ? p.x < this.W / 2 : p.x >= this.W / 2;
      if (!mine) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best < 0) return;                      // tocó al aire: no gasta la cuchara

    const it = this.ring[best], p = this._itemPos(best);
    const ty = g.cy - g.potH * 0.30;
    this.fly.push({
      x: p.x, y: p.y, kind: it.kind, e: it.e, by: who, t: FLY,
      vx: (g.cx - p.x) / FLY,
      vy: (ty - p.y) / FLY - 0.5 * (g.ry * 3.2) * FLY,
    });
    this.ring[best] = { kind: it.kind, e: it.e, dead: RESPAWN };
    this.cool[who] = COOL;
    Sound.pick();
  }
  pointerMove() {}
  pointerUp() {}

  // ── Dibujo ────────────────────────────────────────────────────────────────
  // El invitado online nunca corre update(): todo lo que se mueve sale del
  // estado sincronizado (this.t, ángulos, posiciones), nunca de contadores
  // propios del render.

  _mix(a, b, u) {   // interpola dos [r,g,b]
    u = Math.max(0, Math.min(1, u));
    return `rgb(${Math.round(a[0] + (b[0] - a[0]) * u)},${Math.round(a[1] + (b[1] - a[1]) * u)},${Math.round(a[2] + (b[2] - a[2]) * u)})`;
  }

  render(ctx) {
    const { W, H } = this, g = this._geo;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    this._drawKitchen(ctx);
    this._drawPot(ctx);
    this._drawRing(ctx);
    this._drawFlying(ctx);
    this._drawSpoons(ctx);
    this._drawBar(ctx);
    this._drawMsg(ctx);
    if (this.phase === 'round' || this.phase === 'over') this._drawBanner(ctx);
  }

  _drawKitchen(ctx) {
    const { W, H } = this, g = this._geo;
    const wall = ctx.createLinearGradient(0, 0, 0, H);
    wall.addColorStop(0, '#2E2440'); wall.addColorStop(1, '#171024');
    ctx.fillStyle = wall; ctx.fillRect(0, 0, W, H);

    // azulejos
    ctx.strokeStyle = 'rgba(255,255,255,0.045)'; ctx.lineWidth = 2;
    const tile = Math.min(W, H) * 0.11;
    for (let x = 0; x < W; x += tile) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += tile) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // cada mitad tiene su color, para que se entienda de quién es cada lado
    const l = ctx.createLinearGradient(0, 0, W / 2, 0);
    l.addColorStop(0, 'rgba(255,90,160,0.22)'); l.addColorStop(1, 'rgba(255,90,160,0)');
    ctx.fillStyle = l; ctx.fillRect(0, 0, W / 2, H);
    const r = ctx.createLinearGradient(W, 0, W / 2, 0);
    r.addColorStop(0, 'rgba(80,150,255,0.22)'); r.addColorStop(1, 'rgba(80,150,255,0)');
    ctx.fillStyle = r; ctx.fillRect(W / 2, 0, W / 2, H);

    ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 2;
    ctx.setLineDash([10, 12]);
    ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
    ctx.setLineDash([]);

    // marcador de ollas ganadas, uno por punta
    ctx.font = `900 ${g.s * 34}px system-ui`;
    for (const [pl, emo, col, x] of [['p1', '🍓', '#FF6FB0', W * 0.06], ['p2', '🧀', '#6FA8FF', W * 0.94]]) {
      ctx.fillStyle = col;
      ctx.font = `${g.s * 40}px system-ui`;
      ctx.fillText(emo, x, H * 0.055);
      let stars = '';
      for (let i = 0; i < WIN; i++) stars += i < this.wins[pl] ? '★' : '☆';
      ctx.font = `900 ${g.s * 26}px system-ui`;
      ctx.fillStyle = col; ctx.fillText(stars, x, H * 0.105);
    }

    // reloj de la olla (en los carteles molesta)
    if (this.phase !== 'play') return;
    const sudden = this.potT <= 0;
    const hurry = this.potT <= 10;
    const cw = g.s * (sudden ? 260 : 130), ch = g.s * 46;
    const k = hurry ? 1 + Math.sin(this.t * 9) * 0.05 : 1;
    ctx.save(); ctx.translate(W / 2, H * 0.075); ctx.scale(k, k);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.roundRect(-cw / 2, -ch / 2, cw, ch, ch / 2); ctx.fill();
    ctx.strokeStyle = sudden ? '#FFD34F' : hurry ? '#FF6B6B' : 'rgba(255,255,255,0.30)';
    ctx.lineWidth = g.s * 4;
    ctx.beginPath(); ctx.roundRect(-cw / 2, -ch / 2, cw, ch, ch / 2); ctx.stroke();
    ctx.font = `900 ${g.s * 26}px system-ui`;
    ctx.fillStyle = sudden ? '#FFD34F' : hurry ? '#FF9E9E' : '#FFFFFF';
    ctx.fillText(sudden ? '🔥 ¡MUERTE SÚBITA!' : `⏱ ${Math.ceil(this.potT)}`, 0, 0);
    ctx.restore();
  }

  _drawPot(ctx) {
    const { W, H } = this, g = this._geo;
    const u = (this.flavor + 1) / 2;                 // 0 = dulce, 1 = salado
    const liquid = this._mix([255, 95, 165], [70, 150, 255], u);
    const foam   = this._mix([255, 190, 220], [180, 220, 255], u);
    const pw = g.potW, ph = g.potH, cx = g.cx, cy = g.cy;

    // Hornalla: la llama crece a medida que el carrusel se apura. Arranca por
    // debajo del fondo de la olla, si no queda tapada y no se ve nada.
    const base = cy + ph * 0.84;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(cx, base, pw * 0.52, ph * 0.12, 0, 0, Math.PI * 2); ctx.fill();
    const heat = (this.spinner.spin - SPIN0) / (SPIN_MAX - SPIN0);
    const glow = ctx.createRadialGradient(cx, base, ph * 0.05, cx, base, pw * 0.6);
    glow.addColorStop(0, `rgba(255,150,40,${0.35 + heat * 0.3})`);
    glow.addColorStop(1, 'rgba(255,150,40,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.ellipse(cx, base, pw * 0.6, ph * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    for (let i = -3; i <= 3; i++) {
      const k = 1 - Math.abs(i) * 0.18;
      const fx = cx + i * pw * 0.13;
      const fh = ph * (0.55 + heat * 0.55) * k * (0.85 + Math.sin(this.t * 13 + i) * 0.15);
      ctx.fillStyle = i % 2 ? 'rgba(255,130,30,0.85)' : 'rgba(255,205,70,0.9)';
      ctx.beginPath();
      ctx.moveTo(fx - pw * 0.06 * k, base);
      ctx.quadraticCurveTo(fx, base - fh, fx + pw * 0.06 * k, base);
      ctx.closePath(); ctx.fill();
    }

    // asas
    ctx.strokeStyle = '#8A8FA8'; ctx.lineWidth = ph * 0.13; ctx.lineCap = 'round';
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + sgn * pw * 0.52, cy - ph * 0.10, ph * 0.20, 0, Math.PI * 2);
      ctx.stroke();
    }

    // cuerpo
    const body = ctx.createLinearGradient(cx - pw / 2, 0, cx + pw / 2, 0);
    body.addColorStop(0, '#5A607A'); body.addColorStop(0.35, '#C3C9DD');
    body.addColorStop(0.6, '#8E94AC'); body.addColorStop(1, '#4C5268');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(cx - pw / 2, cy - ph * 0.35);
    ctx.lineTo(cx - pw * 0.42, cy + ph * 0.45);
    ctx.quadraticCurveTo(cx, cy + ph * 0.72, cx + pw * 0.42, cy + ph * 0.45);
    ctx.lineTo(cx + pw / 2, cy - ph * 0.35);
    ctx.closePath(); ctx.fill();

    // sopa
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy - ph * 0.35, pw / 2 - ph * 0.04, ph * 0.20, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = liquid;
    ctx.fillRect(cx - pw, cy - ph, pw * 2, ph * 2);
    // burbujas
    for (let i = 0; i < 9; i++) {
      const ph2 = (this.t * (0.5 + i * 0.09) + i * 0.31) % 1;
      const bx = cx + Math.sin(i * 2.7 + this.t * 0.6) * pw * 0.32;
      const by = cy - ph * 0.35 + ph * 0.18 - ph2 * ph * 0.34;
      const br = (ph * 0.05) * (0.5 + ph2 * 0.9);
      ctx.fillStyle = `rgba(255,255,255,${0.45 * (1 - ph2)})`;
      ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = foam; ctx.lineWidth = Math.max(2, ph * 0.05);
    ctx.beginPath();
    ctx.ellipse(cx, cy - ph * 0.35, pw / 2 - ph * 0.04, ph * 0.20, 0, 0, Math.PI * 2);
    ctx.stroke();

    // borde de la olla
    ctx.strokeStyle = '#E4E8F5'; ctx.lineWidth = ph * 0.08;
    ctx.beginPath();
    ctx.ellipse(cx, cy - ph * 0.35, pw / 2, ph * 0.21, 0, 0, Math.PI * 2);
    ctx.stroke();

    // vapor
    for (let i = 0; i < 3; i++) {
      const k = (this.t * 0.55 + i * 0.33) % 1;
      ctx.fillStyle = `rgba(255,255,255,${0.22 * (1 - k)})`;
      ctx.beginPath();
      ctx.arc(cx + Math.sin(k * 6 + i * 2) * pw * 0.16, cy - ph * 0.5 - k * ph * 1.5,
              ph * (0.10 + k * 0.22), 0, Math.PI * 2);
      ctx.fill();
    }

    // salpicaduras
    for (const s of this.splash) {
      const k = 1 - s.t / 0.45;
      const col = s.kind === 'sweet' ? '#FF6FB0' : s.kind === 'salty' ? '#6FA8FF' : '#FFD34F';
      ctx.fillStyle = col;
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4 - Math.PI;
        const d = k * pw * 0.42;
        ctx.globalAlpha = 1 - k;
        ctx.beginPath();
        ctx.arc(s.x + Math.cos(a) * d, s.y + Math.sin(a) * d * 0.55 - k * ph * 0.25,
                ph * 0.07 * (1 - k * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  _drawRing(ctx) {
    const g = this._geo;
    // la cinta por la que orbitan los ingredientes
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = g.ri * 1.9;
    ctx.beginPath();
    ctx.ellipse(g.cx, g.cy - g.ry * 0.12, g.rx, g.ry, 0, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < this.ring.length; i++) {
      const it = this.ring[i];
      const p = this._itemPos(i);
      const r = g.ri;
      if (it.dead > 0) {   // puesto vacío: un platito esperando
        ctx.strokeStyle = 'rgba(255,255,255,0.13)'; ctx.lineWidth = Math.max(2, r * 0.1);
        ctx.setLineDash([r * 0.4, r * 0.4]);
        ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.75, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        continue;
      }
      const power = it.kind !== 'sweet' && it.kind !== 'salty';
      const col = it.kind === 'sweet' ? '#FF6FB0' : it.kind === 'salty' ? '#6FA8FF' : '#FFD34F';
      const bob = Math.sin(this.t * 3 + i) * r * 0.08;

      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath(); ctx.ellipse(p.x, p.y + r * 0.95, r * 0.7, r * 0.22, 0, 0, Math.PI * 2); ctx.fill();

      if (power) {   // los poderes brillan para que se noten
        const glow = 0.5 + Math.sin(this.t * 6 + i) * 0.3;
        ctx.fillStyle = `rgba(255,211,79,${0.35 * glow})`;
        ctx.beginPath(); ctx.arc(p.x, p.y + bob, r * 1.5, 0, Math.PI * 2); ctx.fill();
      }
      const grad = ctx.createRadialGradient(p.x - r * 0.3, p.y + bob - r * 0.35, r * 0.1, p.x, p.y + bob, r);
      grad.addColorStop(0, '#FFFFFF'); grad.addColorStop(1, power ? '#FFF0C0' : '#F3F5FF');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(p.x, p.y + bob, r * 0.92, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = r * 0.17;
      ctx.beginPath(); ctx.arc(p.x, p.y + bob, r * 0.92, 0, Math.PI * 2); ctx.stroke();
      ctx.font = `${r * 1.05}px system-ui`;
      ctx.fillText(it.e, p.x, p.y + bob + r * 0.04);
    }
  }

  _drawFlying(ctx) {
    const g = this._geo;
    for (const f of this.fly) {
      const spin = (FLY - f.t) * 9;
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(spin);
      ctx.font = `${g.ri * 1.15}px system-ui`;
      ctx.fillText(f.e, 0, 0);
      ctx.restore();
    }
  }

  // Cucharas: muestran la recarga y el hielo. Son el "reloj" de cada jugadora.
  _drawSpoons(ctx) {
    const { W, H } = this, g = this._geo;
    for (const [pl, col, x] of [['p1', '#FF6FB0', W * 0.10], ['p2', '#6FA8FF', W * 0.90]]) {
      const y = H * 0.86, r = g.s * 34;
      const frozen = this.froze[pl] > 0;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = frozen ? '#9FE8FF' : col; ctx.lineWidth = r * 0.16;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();

      const busy = frozen ? this.froze[pl] / FREEZE : this.cool[pl] / COOL;
      if (busy > 0) {   // el sector que falta para volver a jugar
        ctx.fillStyle = frozen ? 'rgba(159,232,255,0.45)' : 'rgba(255,255,255,0.30)';
        ctx.beginPath(); ctx.moveTo(x, y);
        ctx.arc(x, y, r * 0.92, -Math.PI / 2, -Math.PI / 2 + busy * Math.PI * 2);
        ctx.closePath(); ctx.fill();
      }
      ctx.font = `${r * 1.0}px system-ui`;
      ctx.fillText(frozen ? '🧊' : '🥄', x, y);
    }
  }

  // Barra de sabor: el corazón del juego, hay que mirarla todo el tiempo.
  _drawBar(ctx) {
    const { W, H } = this, g = this._geo;
    const w = g.barW, h = g.barH, x = W / 2 - w / 2, y = g.barY - h / 2;
    const grad = ctx.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, '#FF3E97'); grad.addColorStop(0.5, '#B478E0'); grad.addColorStop(1, '#3E8CFF');
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.roundRect(x - h * 0.25, y - h * 0.25, w + h * 0.5, h * 1.5, h); ctx.fill();
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();

    // marcas de las puntas y del centro
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(W / 2, y); ctx.lineTo(W / 2, y + h); ctx.stroke();

    const px = x + (this.flavor + 1) / 2 * w;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.arc(px, g.barY, h * 0.95, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = this.flavor <= 0 ? '#FF3E97' : '#3E8CFF';
    ctx.beginPath(); ctx.arc(px, g.barY, h * 0.68, 0, Math.PI * 2); ctx.fill();
    ctx.font = `${h * 0.95}px system-ui`;
    ctx.fillText('🥄', px, g.barY);

    ctx.font = `900 ${g.s * 20}px system-ui`;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#FF9EC8'; ctx.fillText('🍓 dulce', x - h * 0.9, g.barY);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#9EC8FF'; ctx.fillText('salado 🧀', x + w + h * 0.9, g.barY);
    ctx.textAlign = 'center';
  }

  _drawMsg(ctx) {
    const { W, H } = this, g = this._geo;
    if (!this.msg) return;
    ctx.globalAlpha = Math.min(1, this.msg.t * 3);
    ctx.font = `900 ${g.s * 28}px system-ui`;
    const y = H * 0.155 - (1 - Math.min(1, this.msg.t)) * g.s * 18;
    const bw = ctx.measureText(this.msg.txt).width + g.s * 40, bh = g.s * 48;
    ctx.fillStyle = 'rgba(20,10,30,0.80)';
    ctx.beginPath(); ctx.roundRect(W / 2 - bw / 2, y - bh / 2, bw, bh, bh / 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,211,79,0.7)'; ctx.lineWidth = g.s * 3;
    ctx.beginPath(); ctx.roundRect(W / 2 - bw / 2, y - bh / 2, bw, bh, bh / 2); ctx.stroke();
    ctx.fillStyle = '#FFF3C4';
    ctx.fillText(this.msg.txt, W / 2, y);
    ctx.globalAlpha = 1;
  }

  _drawBanner(ctx) {
    const { W, H } = this, g = this._geo;
    const over = this.phase === 'over';
    const pl = this.roundWinner;
    const cfg = pl === 'p1' ? { c: '#FF6FB0', n: 'P1', e: '🍓', s: 'dulce' }
                            : { c: '#6FA8FF', n: 'P2', e: '🧀', s: 'salada' };
    ctx.fillStyle = over ? 'rgba(10,6,20,0.78)' : 'rgba(10,6,20,0.55)';
    ctx.fillRect(0, 0, W, H);

    if (over) {   // confeti de comida
      for (let i = 0; i < 40; i++) {
        const bx = ((i * 97) % 100) / 100, sp = 0.12 + ((i * 37) % 100) / 400;
        const y = ((i / 40 + this.t * sp) % 1.15 - 0.1) * H;
        ctx.font = `${g.s * 30}px system-ui`;
        ctx.fillText(pl === 'p1' ? SWEET[i % SWEET.length] : SALTY[i % SALTY.length],
                     bx * W + Math.sin(this.t + i) * W * 0.02, y);
      }
    }

    ctx.font = `${Math.min(H * 0.16, W * 0.18)}px system-ui`;
    ctx.fillText(cfg.e, W / 2, H * 0.36);
    ctx.font = `900 ${Math.min(H * 0.09, W * 0.10)}px system-ui`;
    ctx.fillStyle = cfg.c;
    ctx.fillText(over ? `🏆 ¡Ganó ${cfg.n}!` : `¡Olla ${cfg.s} para ${cfg.n}!`, W / 2, H * 0.55);
    ctx.font = `900 ${g.s * 30}px system-ui`;
    ctx.fillStyle = '#FFFFFFAA';
    ctx.fillText(`${this.wins.p1} — ${this.wins.p2}`, W / 2, H * 0.64);
    if (over) {
      ctx.font = `${g.s * 26}px system-ui`;
      ctx.fillStyle = `rgba(255,255,255,${0.5 + Math.sin(this.t * 3) * 0.3})`;
      ctx.fillText('Tocá para jugar de nuevo', W / 2, H * 0.74);
    }
  }

  // ── Online sync: host broadcasts this every frame, guest applies it ──────
  getNetState() {
    return {
      W: this.W, H: this.H, geo: this._geo,
      phase: this.phase, wins: this.wins, flavor: this.flavor, spinner: this.spinner,
      ring: this.ring, fly: this.fly, splash: this.splash,
      cool: this.cool, froze: this.froze, honeyT: this.honeyT, potT: this.potT,
      t: this.t, msg: this.msg, roundWinner: this.roundWinner, bannerT: this.bannerT,
    };
  }

  setNetState(s) {
    this.W = s.W; this.H = s.H; this._geo = s.geo;
    this.phase = s.phase; this.wins = s.wins; this.flavor = s.flavor; this.spinner = s.spinner;
    this.ring = s.ring; this.fly = s.fly; this.splash = s.splash;
    this.cool = s.cool; this.froze = s.froze; this.honeyT = s.honeyT; this.potT = s.potT;
    this.t = s.t; this.msg = s.msg; this.roundWinner = s.roundWinner; this.bannerT = s.bannerT;
  }
}
