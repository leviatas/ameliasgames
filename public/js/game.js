import { World }               from './World.js';
import { Interior, INTERIOR_W, INTERIOR_H, interiorDepthScale } from './Interior.js';
import { Character, onSpriteReady, DEFAULT_CFG } from './Character.js';
import { Controls }              from './Controls.js';
import { TouchControls }         from './TouchControls.js';
import { Runner }                from './Runner.js';
import { Cocina }                from './Cocina.js';
import { Match3 }                from './Match3.js';
import { Hole }                  from './Hole.js';
import { Hole2 }                 from './Hole2.js';
import { Galaga }                from './Galaga.js';
import { Cinema }                from './Cinema.js';
import { Helado }                from './Helado.js';
import { Tienda, CATALOG as TIENDA_CATALOG } from './Tienda.js';
import { Mob }                               from './Mob.js';
import { PongChibi }      from './PongChibi.js';
import { Globos2P }       from './Globos2P.js';
import { Sumo2P }         from './Sumo2P.js';
import { Cocinas2P }      from './Cocinas2P.js';
import { Vuelo2P }        from './Vuelo2P.js';
import { Corazones2P }    from './Corazones2P.js';
import { Memoria2P }      from './Memoria2P.js';
import { TresEnRaya }     from './TresEnRaya.js';
import { Conecta4 }       from './Conecta4.js';
import { PiedraPapelTijera } from './PiedraPapelTijera.js';
import { Ahorcado }       from './Ahorcado.js';
import { ThreePlayers }   from './ThreePlayers.js';
import { FourPlayers }    from './FourPlayers.js';
import { NetSession }     from './Net.js';
import { getFridge, eatFood }    from './Pantry.js';
import { getCoins, getWardrobe, getEquippedId, setEquippedId } from './Wallet.js';

// ── Canvas ─────────────────────────────────────────────────────────────────
const canvas = document.getElementById('game-canvas');
const ctx    = canvas.getContext('2d');

const WORLD_W  = 2200;
const WORLD_H  = 2200;
const ZOOM_MIN = 0.30;
const ZOOM_MAX = 2.8;

// ── State ──────────────────────────────────────────────────────────────────
let world, character, controls, touchControls;
let interior = null;
let runner   = null;
let cocina   = null;
let match3   = null;
let hole     = null;
let hole2    = null;
let galaga   = null;
let theater  = null;
let helado   = null;
let tienda   = null;
let mob      = null;
let pong     = null;
let globos   = null;
let sumo     = null;
let cocinas  = null;
let vuelo    = null;
let corazones = null;
let memoria2p = null;
let tresenraya = null;
let conecta4  = null;
let ppt       = null;
let ahorcado  = null;
let tres     = null;
let cuatro   = null;
const _2pTouches = new Map(); // pointerId → 'p1' | 'p2'

// ── Online 2P (WebSocket relay, room-code pairing) ───────────────────────────
let netSession     = null;         // NetSession instance, or null when playing locally
let netRole        = null;         // 'host' | 'guest' | null
let netGameKey     = null;         // 'globos' | 'sumo' — which 2P game is networked
let netPendingGameKey = null;      // game the online-setup screen currently targets
let netScale       = null;         // guest-only: {scale, offX, offY} to map host↔local canvas
let netSendAccum   = 0;            // host-only: throttle accumulator for state broadcasts
const NET_STATE_HZ = 30;
// guest-only: rolling buffer of {recvT, s} snapshots, drawn from a point slightly
// in the past so we always have two real snapshots to interpolate between —
// this is what turns "new position every 33ms" into smooth per-frame motion.
let netSnapshots      = [];
const NET_RENDER_DELAY_MS = 90;
// guest-only: top-level getNetState() keys touched by our own optimistic
// pointer echo, held fresh for a short TTL so the smoothing above never makes
// the guest's own paddle/drag feel laggy — only the *other* entities (which
// we don't control locally) render from the delayed/interpolated buffer.
let netLocalOverrides = new Map(); // key → { value, expiresAt }
const NET_LOCAL_OVERRIDE_TTL_MS = 200;
let holeFrom = 'hub';        // 'hub' | 'world'
let mode     = 'exterior';   // 'exterior' | 'interior' | 'runner' | 'cocina' | 'match3' | 'hole' | 'hole2' | 'cinema' | 'helado' | 'tienda' | 'mob' | 'galaga' | 'pong' | 'globos' | 'sumo' | 'cocinas' | 'tres'
let savedPos = null;         // exterior pos when inside a house

let lastTime    = 0;
let animFrameId = null;

// Fade transition
let fadeAlpha  = 0;
let fadingIn   = false;
let fadingOut  = false;
let onFadeEnd  = null;

// Day / Night
let isNight    = false;
let nightAlpha = 0;          // 0 = full day, 1 = full night

// Pre-generated stars (normalized 0-1 coords)
const STARS = Array.from({ length: 220 }, () => ({
  x:  Math.random(),
  y:  Math.random() * 0.55,
  r:  0.5 + Math.random() * 1.8,
  b:  0.3 + Math.random() * 0.7,   // brightness
}));

const cam = { x: 0, y: 0, zoom: 0.55 };

// ── Particles & ambient effects ──────────────────────────────────────────────
const particles = [];                 // transient: dust puffs + drifting petals
const MAX_PARTICLES = 90;
let dustTimer  = 0;
let petalTimer = 0;

// Wandering fireflies (world-anchored, shown at night outdoors)
const fireflies = Array.from({ length: 16 }, () => ({
  x: 0, y: 0, t: Math.random() * Math.PI * 2,
  ox: Math.random() * 2 - 1, oy: Math.random() * 2 - 1,
  seeded: false,
}));

function spawnParticle(p) {
  if (particles.length >= MAX_PARTICLES) particles.shift();
  particles.push(p);
}

function spawnDust(x, y) {
  spawnParticle({
    type: 'dust', x, y,
    vx: (Math.random() - 0.5) * 36, vy: -12 - Math.random() * 22,
    life: 0, maxLife: 0.45 + Math.random() * 0.3,
    size: 2.5 + Math.random() * 3,
  });
}

function spawnPetal() {
  const vw = canvas.width / cam.zoom, vh = canvas.height / cam.zoom;
  spawnParticle({
    type: 'petal',
    x: cam.x + Math.random() * vw,
    y: cam.y - 20 + Math.random() * vh * 0.25,
    vx: 12 + Math.random() * 18, vy: 16 + Math.random() * 14,
    life: 0, maxLife: 6 + Math.random() * 4,
    size: 3 + Math.random() * 3,
    color: ['#FFB6C8', '#FFFFFF', '#FFD0E0', '#FFE0A0'][Math.floor(Math.random() * 4)],
    seed: Math.random() * 6.28, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 5,
  });
}

function updateParticles(delta) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life += delta;
    if (p.life >= p.maxLife) { particles.splice(i, 1); continue; }
    p.x += p.vx * delta;
    p.y += p.vy * delta;
    if (p.type === 'dust')  { p.vy += 34 * delta; p.vx *= 0.93; }
    if (p.type === 'petal') { p.x += Math.sin(p.life * 2 + p.seed) * 10 * delta; }
  }
}

function updateFireflies(delta) {
  if (mode !== 'exterior') return;
  const vw = canvas.width / cam.zoom, vh = canvas.height / cam.zoom;
  for (const f of fireflies) {
    if (!f.seeded) {
      f.x = cam.x + Math.random() * vw;
      f.y = cam.y + Math.random() * vh;
      f.seeded = true;
    }
    f.t += delta;
    f.x += Math.sin(f.t * 0.8 + f.ox * 5) * 16 * delta;
    f.y += Math.cos(f.t * 0.6 + f.oy * 5) * 13 * delta;
    const sx = f.x - cam.x, sy = f.y - cam.y;
    if (sx < -60 || sx > vw + 60 || sy < -60 || sy > vh + 60) f.seeded = false;
  }
}

function drawParticles() {
  for (const p of particles) {
    const a = 1 - p.life / p.maxLife;
    if (p.type === 'dust') {
      ctx.globalAlpha = a * 0.5;
      ctx.fillStyle = '#CFC3AE';
      ctx.beginPath();
      ctx.arc(p.x - cam.x, p.y - cam.y, p.size * (1 + p.life * 2), 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.save();
      ctx.globalAlpha = a * 0.85;
      ctx.translate(p.x - cam.x, p.y - cam.y);
      ctx.rotate(p.rot + p.life * p.vr);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
}

// ── Depth helpers ──────────────────────────────────────────────────────────
function depthScale(worldY)    { return 0.72 + (worldY / WORLD_H)    * 0.48; }

// ── Resize ─────────────────────────────────────────────────────────────────
function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 150));
resize();

// ── Camera helpers ─────────────────────────────────────────────────────────
function clampCam() {
  const maxW = mode === 'interior' ? INTERIOR_W : WORLD_W;
  const maxH = mode === 'interior' ? INTERIOR_H : WORLD_H;
  const vw = canvas.width  / cam.zoom;
  const vh = canvas.height / cam.zoom;
  cam.x = Math.max(0, Math.min(Math.max(0, maxW - vw), cam.x));
  cam.y = Math.max(0, Math.min(Math.max(0, maxH - vh), cam.y));
}

// ── Fade helpers ───────────────────────────────────────────────────────────
function fadeToBlack(cb) {
  fadingIn  = true;
  fadingOut = false;
  fadeAlpha = 0;
  onFadeEnd = cb;
}
function fadeFromBlack() {
  fadingIn  = false;
  fadingOut = true;
}

// ── Enter / Exit house ─────────────────────────────────────────────────────
function enterHouse(house) {
  hideFridgeMenu();
  savedPos = { x: character.x, y: character.y };
  fadeToBlack(() => {
    interior = new Interior(house._wall, house._roof, house.x + house.y);
    mode     = 'interior';
    character.x = INTERIOR_W / 2;
    character.y = INTERIOR_H - 200;   // inside room, not near door
    cam.zoom    = 1;
    cam.x = character.x - canvas.width  / (2 * cam.zoom);
    cam.y = character.y - canvas.height / (2 * cam.zoom);
    clampCam();
    fadeFromBlack();
    document.getElementById('controls-hint').textContent =
      'W A S D  Mover  |  Clic en el personaje para gestos  |  Acércate a la puerta para salir';
  });
}

function exitHouse() {
  hideFridgeMenu();
  fadeToBlack(() => {
    if (interior) { interior.destroy(); interior = null; }
    mode            = 'exterior';
    character.state = 'walk';
    if (savedPos) { character.x = savedPos.x; character.y = savedPos.y; }
    cam.zoom = 0.55;
    cam.x = character.x - canvas.width  / (2 * cam.zoom);
    cam.y = character.y - canvas.height / (2 * cam.zoom);
    clampCam();
    fadeFromBlack();
    document.getElementById('controls-hint').innerHTML =
      '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Mover &nbsp;|&nbsp; <kbd>Shift</kbd> Correr &nbsp;|&nbsp; <kbd>Clic</kbd> en casa para entrar &nbsp;|&nbsp; <kbd>Clic</kbd> en el personaje para gestos';
  });
}

// ── Persistence ──────────────────────────────────────────────────────────────
const SAVE_KEY = 'mimundo_state_v2';
let inGame = false;
let look = Object.assign({}, DEFAULT_CFG);   // current avatar customization
function loadState() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; }
}
function saveState() {
  try {
    const st = {
      played: inGame, look,
      night: isNight,
    };
    if (character) { st.x = Math.round(character.x); st.y = Math.round(character.y); st.facing = character.facingDir; }
    else { const p = loadState(); if (p) { st.x = p.x; st.y = p.y; st.facing = p.facing; } }
    localStorage.setItem(SAVE_KEY, JSON.stringify(st));
  } catch (e) {}
}
// hydrate look from save at boot
{ const p = loadState(); if (p && p.look) look = Object.assign({}, DEFAULT_CFG, p.look); }

// ── Game hub (main menu: choose which game to play) ─────────────────────────
let runnerFrom  = 'tv';    // 'tv' (from a house) | 'hub' (standalone)
let cocinaFrom  = 'hub';   // 'kitchen' (from a house) | 'hub' (standalone)

function showHub(menuId = 'hub-screen') {
  if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
  inGame = false;
  mode   = 'exterior';
  _resetNetState();
  runner = null;
  cocina = null;
  match3 = null;
  hole = null;
  theater = null;
  helado = null;
  tienda = null;
  if (mob)    { mob.destroy(); mob = null; }
  if (galaga) { galaga.destroy(); galaga = null; }
  hideHoleSubmenu();
  hideUnoSubmenu();
  hideVersusSubmenu();
  hideTresSubmenu();
  hideCuatroSubmenu();
  pong = null; globos = null; sumo = null; cocinas = null; tres = null; cuatro = null;
  vuelo = null; corazones = null; memoria2p = null;
  tresenraya = null; conecta4 = null; ppt = null; ahorcado = null;
  _2pTouches.clear();
  document.getElementById('pong-ui').classList.add('hidden');
  document.getElementById('globos-ui').classList.add('hidden');
  document.getElementById('sumo-ui').classList.add('hidden');
  document.getElementById('cocinas-ui').classList.add('hidden');
  document.getElementById('vuelo-ui').classList.add('hidden');
  document.getElementById('corazones-ui').classList.add('hidden');
  document.getElementById('memoria2p-ui').classList.add('hidden');
  document.getElementById('tresenraya-ui').classList.add('hidden');
  document.getElementById('conecta4-ui').classList.add('hidden');
  document.getElementById('ppt-ui').classList.add('hidden');
  document.getElementById('ahorcado-ui').classList.add('hidden');
  document.getElementById('tres-ui').classList.add('hidden');
  document.getElementById('cuatro-ui').classList.add('hidden');
  hideGestureMenu();
  hideFridgeMenu();
  hideWardrobeMenu();
  document.getElementById('cust-panel').classList.add('hidden');
  document.getElementById('runner-ui').classList.add('hidden');
  document.getElementById('cocina-ui').classList.add('hidden');
  document.getElementById('match3-ui').classList.add('hidden');
  document.getElementById('hole-ui').classList.add('hidden');
  document.getElementById('cinema-ui').classList.add('hidden');
  document.getElementById('helado-ui').classList.add('hidden');
  document.getElementById('tienda-ui').classList.add('hidden');
  document.getElementById('mob-ui').classList.add('hidden');
  document.getElementById('galaga-ui').classList.add('hidden');
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('select-screen').classList.add('hidden');
  document.getElementById('online-setup').classList.add('hidden');
  document.getElementById('online-disconnect-banner').classList.add('hidden');
  document.getElementById(menuId).classList.remove('hidden');
}

function launchWorld() {
  document.getElementById('hub-screen').classList.add('hidden');
  document.getElementById('select-screen').classList.remove('hidden');
  drawSelectionPreviews();
}

function launchRunner() {
  if (isTouch) forceLandscape();
  document.getElementById('hub-screen').classList.add('hidden');
  document.getElementById('select-screen').classList.add('hidden');
  runnerFrom = 'hub';
  runner = new Runner(canvas);
  mode   = 'runner';
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('runner-ui').classList.remove('hidden');
  lastTime = performance.now();
  if (!animFrameId) animFrameId = requestAnimationFrame(gameLoop);
}

// ── Cooking mini-game ────────────────────────────────────────────────────────
function launchCocina() {
  if (isTouch) forceLandscape();
  cocinaFrom = 'hub';
  document.getElementById('hub-screen').classList.add('hidden');
  document.getElementById('select-screen').classList.add('hidden');
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('cocina-ui').classList.remove('hidden');
  cocina = new Cocina(canvas);
  mode   = 'cocina';
  lastTime = performance.now();
  if (!animFrameId) animFrameId = requestAnimationFrame(gameLoop);
}
// ── Match-3 mini-game ────────────────────────────────────────────────────────
function launchMatch3() {
  if (isTouch) forceLandscape();
  document.getElementById('hub-screen').classList.add('hidden');
  document.getElementById('select-screen').classList.add('hidden');
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('match3-ui').classList.remove('hidden');
  match3 = new Match3(canvas);
  mode   = 'match3';
  lastTime = performance.now();
  if (!animFrameId) animFrameId = requestAnimationFrame(gameLoop);
}
function exitMatch3() {
  document.getElementById('match3-ui').classList.add('hidden');
  match3 = null;
  showHub('uno-submenu');
}

// ── Ice-cream shop mini-game ─────────────────────────────────────────────────
function launchHelado() {
  if (isTouch) forceLandscape();
  document.getElementById('hub-screen').classList.add('hidden');
  document.getElementById('select-screen').classList.add('hidden');
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('helado-ui').classList.remove('hidden');
  helado = new Helado(canvas);
  mode   = 'helado';
  lastTime = performance.now();
  if (!animFrameId) animFrameId = requestAnimationFrame(gameLoop);
}
function exitHelado() {
  document.getElementById('helado-ui').classList.add('hidden');
  helado = null;
  showHub();
}

// ── Clothing store ───────────────────────────────────────────────────────────
function launchTienda() {
  if (isTouch) forceLandscape();
  document.getElementById('hub-screen').classList.add('hidden');
  document.getElementById('select-screen').classList.add('hidden');
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('tienda-ui').classList.remove('hidden');
  tienda = new Tienda(canvas,
    () => look,
    (newLook) => { look = Object.assign({}, newLook); if (character) Object.assign(character.cfg, look); drawSelectionPreviews(); updateHUDPortrait(); saveState(); }
  );
  mode = 'tienda';
  lastTime = performance.now();
  if (!animFrameId) animFrameId = requestAnimationFrame(gameLoop);
}
function exitTienda() {
  document.getElementById('tienda-ui').classList.add('hidden');
  tienda = null;
  showHub();
}

// ── Mob Control mini-game ─────────────────────────────────────────────────────
function launchMob() {
  if (isTouch) forceLandscape();
  document.getElementById('hub-screen').classList.add('hidden');
  document.getElementById('select-screen').classList.add('hidden');
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('mob-ui').classList.remove('hidden');
  mob  = new Mob(canvas);
  mode = 'mob';
  lastTime = performance.now();
  if (!animFrameId) animFrameId = requestAnimationFrame(gameLoop);
}
function exitMob() {
  document.getElementById('mob-ui').classList.add('hidden');
  if (mob) { mob.destroy(); mob = null; }
  showHub('uno-submenu');
}

// ── Hole mini-game ───────────────────────────────────────────────────────────
function _openHole() {
  if (isTouch) forceLandscape();
  document.getElementById('hub-screen').classList.add('hidden');
  document.getElementById('select-screen').classList.add('hidden');
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('hole-ui').classList.remove('hidden');
  hole = new Hole(canvas);
  mode = 'hole';
  lastTime = performance.now();
  if (!animFrameId) animFrameId = requestAnimationFrame(gameLoop);
}
function showHoleSubmenu() {
  document.getElementById('hub-screen').classList.add('hidden');
  document.getElementById('hole-submenu').classList.remove('hidden');
}
function hideHoleSubmenu() {
  document.getElementById('hole-submenu').classList.add('hidden');
}
function launchHole() { holeFrom = 'hub'; hideHoleSubmenu(); _openHole(); }    // from the game chooser
function enterHoleFromWorld() { holeFrom = 'world'; _openHole(); }  // from the world portal
function exitHole() {
  document.getElementById('hole-ui').classList.add('hidden');
  hole = null;
  if (holeFrom === 'world') {
    mode = 'exterior';
    document.getElementById('hud').classList.remove('hidden');
    lastTime = performance.now();
  } else {
    showHub('hole-submenu');
  }
}

// ── Hole2 — Festín de comidas ─────────────────────────────────────────────────
function launchHole2() {
  if (isTouch) forceLandscape();
  hideHoleSubmenu();
  document.getElementById('hub-screen').classList.add('hidden');
  document.getElementById('select-screen').classList.add('hidden');
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('hole2-ui').classList.remove('hidden');
  hole2 = new Hole2(canvas);
  mode = 'hole2';
  lastTime = performance.now();
  if (!animFrameId) animFrameId = requestAnimationFrame(gameLoop);
}
function exitHole2() {
  document.getElementById('hole2-ui').classList.add('hidden');
  hole2 = null;
  showHub('hole-submenu');
}

// ── Galaga — space shooter ────────────────────────────────────────────────────
function launchGalaga() {
  if (isTouch) forceLandscape();
  document.getElementById('hub-screen').classList.add('hidden');
  document.getElementById('select-screen').classList.add('hidden');
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('galaga-ui').classList.remove('hidden');
  galaga = new Galaga(canvas);
  mode = 'galaga';
  lastTime = performance.now();
  if (!animFrameId) animFrameId = requestAnimationFrame(gameLoop);
}
function exitGalaga() {
  document.getElementById('galaga-ui').classList.add('hidden');
  if (galaga) { galaga.destroy(); galaga = null; }
  showHub('uno-submenu');
}

// ── 2-Player shared pointer router ───────────────────────────────────────────
function _active2P() {
  if (mode === 'pong'    && pong)   return pong;
  if (mode === 'globos'  && globos) return globos;
  if (mode === 'sumo'    && sumo)   return sumo;
  if (mode === 'cocinas' && cocinas) return cocinas;
  if (mode === 'vuelo'   && vuelo)  return vuelo;
  if (mode === 'corazones' && corazones) return corazones;
  if (mode === 'memoria2p' && memoria2p) return memoria2p;
  if (mode === 'tresenraya' && tresenraya) return tresenraya;
  if (mode === 'conecta4' && conecta4) return conecta4;
  if (mode === 'ppt'     && ppt)     return ppt;
  if (mode === 'ahorcado' && ahorcado) return ahorcado;
  return null;
}
// Games with one shared centered board (not split left/right on a single
// device) — any local tap should count for whoever's turn it is, not
// whichever half of the screen it lands on.
const SHARED_BOARD_MODES = new Set(['memoria2p', 'tresenraya', 'conecta4', 'ahorcado']);
canvas.addEventListener('pointerdown', e => {
  const g = _active2P(); if (!g) return;
  e.preventDefault();
  const p = canvasPoint(e);
  if (netRole) {
    _2pTouches.set(e.pointerId, true);
    const hp = netToHostPoint(p.x, p.y);
    if (netRole === 'host') { g.pointerDown(hp.x, hp.y, 'p1'); }
    else {
      netSession.send({ k: 'i', op: 'd', x: hp.x, y: hp.y });
      // optimistic local echo — masks round-trip lag; _captureLocalEcho keeps
      // whatever this touches rendering from our fresh local value instead of
      // the network-smoothed one until the host's broadcast catches up.
      _captureLocalEcho(g, () => g.pointerDown(hp.x, hp.y, 'p2'));
    }
    return;
  }
  const who = p.x < canvas.width / 2 ? 'p1' : 'p2';
  _2pTouches.set(e.pointerId, who);
  g.pointerDown(p.x, p.y, SHARED_BOARD_MODES.has(mode) ? undefined : who);
});
canvas.addEventListener('pointermove', e => {
  const g = _active2P(); if (!g) return;
  const who = _2pTouches.get(e.pointerId); if (!who) return;
  const p = canvasPoint(e);
  if (netRole) {
    const hp = netToHostPoint(p.x, p.y);
    if (netRole === 'host') { g.pointerMove(hp.x, hp.y, 'p1'); }
    else {
      netSession.send({ k: 'i', op: 'm', x: hp.x, y: hp.y });
      _captureLocalEcho(g, () => g.pointerMove(hp.x, hp.y, 'p2'));
    }
    return;
  }
  g.pointerMove(p.x, p.y, who);
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(ev =>
  canvas.addEventListener(ev, e => {
    const g = _active2P(); if (!g) return;
    const who = _2pTouches.get(e.pointerId); if (!who) return;
    if (netRole) {
      if (netRole === 'host') { g.pointerUp('p1'); }
      else { netSession.send({ k: 'i', op: 'u' }); _captureLocalEcho(g, () => g.pointerUp('p2')); }
    } else {
      g.pointerUp(who);
    }
    _2pTouches.delete(e.pointerId);
  })
);

// ── Online 2P networking helpers ─────────────────────────────────────────────
// Host-authoritative: the room's host runs the real simulation for both
// players and streams snapshots to the guest; the guest only forwards its
// own touches (mapped into the host's coordinate space) and renders whatever
// the host last sent.
function _updateNetScale(hostW, hostH) {
  const scale = Math.min(canvas.width / hostW, canvas.height / hostH);
  netScale = {
    scale, W: hostW, H: hostH,
    offX: (canvas.width  - hostW * scale) / 2,
    offY: (canvas.height - hostH * scale) / 2,
  };
}
function netToHostPoint(x, y) {
  if (netRole !== 'guest' || !netScale) return { x, y };
  return { x: (x - netScale.offX) / netScale.scale, y: (y - netScale.offY) / netScale.scale };
}
// Only leaf fields named like a physics/animation quantity get interpolated —
// picking this by *value* (e.g. "both endpoints are integers") looked
// appealing but false-positives the moment a continuous value lands on a
// round number (a ball reset dead-center at x=300.0 would freeze instead of
// glide). Discrete state (scores, turns, board cells, win counts, indices)
// always snaps straight to the newer value.
const NET_LERP_KEYS = new Set(['x', 'y', 'vx', 'vy', 't']);
function _lerpValue(a, b, t, key) {
  if (typeof a === 'number' && typeof b === 'number') {
    return key !== undefined && !NET_LERP_KEYS.has(key) ? b : a + (b - a) * t;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return b;
    return b.map((v, i) => _lerpValue(a[i], v, t, key));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const out = {};
    for (const k of Object.keys(b)) out[k] = _lerpValue(a[k], b[k], t, k);
    return out;
  }
  return b;
}
// Runs a local optimistic pointer echo (guest only) and remembers whichever
// top-level state keys it changed, so render-time smoothing (see
// _sampleNetState/_renderGuestFrame) can keep showing the fresh local edit
// instead of a stale, delayed one for exactly those keys.
function _captureLocalEcho(g, mutate) {
  // Compare serialized content, not references: several games mutate their
  // net-state objects (e.g. this.p2.y = ...) in place, so a reference check
  // would never see the change.
  const before = g.getNetState();
  const beforeJSON = {};
  for (const k of Object.keys(before)) beforeJSON[k] = JSON.stringify(before[k]);
  mutate();
  const after = g.getNetState();
  const now = performance.now();
  for (const k of Object.keys(after)) {
    if (JSON.stringify(after[k]) !== beforeJSON[k]) {
      netLocalOverrides.set(k, { value: after[k], expiresAt: now + NET_LOCAL_OVERRIDE_TTL_MS });
    }
  }
}
function _applyNetLocalOverrides(s) {
  if (netLocalOverrides.size === 0) return s;
  const now = performance.now();
  const out = { ...s };
  for (const [k, o] of netLocalOverrides) {
    if (o.expiresAt < now) { netLocalOverrides.delete(k); continue; }
    out[k] = o.value;
  }
  return out;
}
function _sampleNetState() {
  const buf = netSnapshots;
  if (buf.length === 0) return null;
  if (buf.length === 1) return buf[0].s;
  const renderT = performance.now() - NET_RENDER_DELAY_MS;
  if (renderT <= buf[0].recvT) return buf[0].s;
  for (let i = 0; i < buf.length - 1; i++) {
    const a = buf[i], b = buf[i + 1];
    if (renderT <= b.recvT) {
      const span = b.recvT - a.recvT;
      const t = span > 0 ? (renderT - a.recvT) / span : 1;
      return _lerpValue(a.s, b.s, t);
    }
  }
  return buf[buf.length - 1].s; // buffer underrun (network hiccup) — hold newest
}
function _renderGuestFrame(g) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!netScale) return;
  const s = _sampleNetState();
  if (s) g.setNetState(_applyNetLocalOverrides(s));
  ctx.setTransform(netScale.scale, 0, 0, netScale.scale, netScale.offX, netScale.offY);
  g.render(ctx);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
function _run2PFrame(g, delta) {
  if (!netRole) { g.update(delta); g.render(ctx); return; }
  if (netRole === 'host') {
    g.update(delta);
    netSendAccum += delta;
    if (netSendAccum >= 1 / NET_STATE_HZ) {
      netSendAccum = 0;
      netSession.send({ k: 's', s: g.getNetState() });
    }
    g.render(ctx);
  } else {
    _renderGuestFrame(g);
  }
}
function _resetNetState() {
  if (netSession) { netSession.close(); netSession = null; }
  netRole = null; netGameKey = null; netScale = null; netSendAccum = 0;
  netSnapshots = []; netLocalOverrides.clear();
}
function _showOnlineDisconnect() {
  document.getElementById('online-disconnect-banner').classList.remove('hidden');
}

// ── 1-Player submenu ──────────────────────────────────────────────────────────
function showUnoSubmenu() {
  document.getElementById('hub-screen').classList.add('hidden');
  document.getElementById('uno-submenu').classList.remove('hidden');
}
function hideUnoSubmenu() {
  document.getElementById('uno-submenu').classList.add('hidden');
}

// ── Versus submenu & 2P game launchers ───────────────────────────────────────
function showVersusSubmenu() {
  document.getElementById('hub-screen').classList.add('hidden');
  document.getElementById('versus-submenu').classList.remove('hidden');
}
function hideVersusSubmenu() {
  document.getElementById('versus-submenu').classList.add('hidden');
}
function _launchVersus(uiId, modeStr) {
  if (isTouch) forceLandscape();
  hideVersusSubmenu();
  document.getElementById('hub-screen').classList.add('hidden');
  document.getElementById('hud').classList.add('hidden');
  document.getElementById(uiId).classList.remove('hidden');
  _2pTouches.clear();
  mode = modeStr;
  lastTime = performance.now();
  if (!animFrameId) animFrameId = requestAnimationFrame(gameLoop);
}
function _exitVersus(uiId, menuId = 'versus-submenu') {
  document.getElementById(uiId).classList.add('hidden');
  _2pTouches.clear();
  showHub(menuId);
}
function launchPong()    { pong    = new PongChibi(canvas); _launchVersus('pong-ui',    'pong');   }
function launchGlobos()  { globos  = new Globos2P(canvas);  _launchVersus('globos-ui',  'globos'); }
function launchSumo()    { sumo    = new Sumo2P(canvas);    _launchVersus('sumo-ui',    'sumo');   }
function launchCocinas() { cocinas = new Cocinas2P(canvas); _launchVersus('cocinas-ui', 'cocinas');}
function exitPong()    { _resetNetState(); pong    = null; _exitVersus('pong-ui');    }
function exitGlobos()  { _resetNetState(); globos  = null; _exitVersus('globos-ui');  }
function exitSumo()    { _resetNetState(); sumo    = null; _exitVersus('sumo-ui');    }
function exitCocinas() { _resetNetState(); cocinas = null; _exitVersus('cocinas-ui'); }
function launchVuelo()     { vuelo     = new Vuelo2P(canvas);     _launchVersus('vuelo-ui',     'vuelo');     }
function launchCorazones() { corazones = new Corazones2P(canvas); _launchVersus('corazones-ui', 'corazones'); }
function launchMemoria2P() { memoria2p = new Memoria2P(canvas);   _launchVersus('memoria2p-ui', 'memoria2p'); }
function exitVuelo()     { _resetNetState(); vuelo     = null; _exitVersus('vuelo-ui');     }
function exitCorazones() { _resetNetState(); corazones = null; _exitVersus('corazones-ui'); }
function exitMemoria2P() { _resetNetState(); memoria2p = null; _exitVersus('memoria2p-ui'); }
function launchTresEnRaya() { tresenraya = new TresEnRaya(canvas); _launchVersus('tresenraya-ui', 'tresenraya'); }
function launchConecta4()   { conecta4   = new Conecta4(canvas);   _launchVersus('conecta4-ui',   'conecta4');   }
function launchPPT()        { ppt        = new PiedraPapelTijera(canvas); _launchVersus('ppt-ui', 'ppt');        }
function launchAhorcado()   { ahorcado   = new Ahorcado(canvas);   _launchVersus('ahorcado-ui',   'ahorcado');   }
function exitTresEnRaya() { _resetNetState(); tresenraya = null; _exitVersus('tresenraya-ui'); }
function exitConecta4()   { _resetNetState(); conecta4   = null; _exitVersus('conecta4-ui');   }
function exitPPT()        { _resetNetState(); ppt        = null; _exitVersus('ppt-ui');        }
function exitAhorcado()   { _resetNetState(); ahorcado   = null; _exitVersus('ahorcado-ui');   }

// ── 3-Players submenu & launchers (share the versus launch/exit helpers) ─────
function showTresSubmenu() {
  document.getElementById('hub-screen').classList.add('hidden');
  document.getElementById('tres-submenu').classList.remove('hidden');
}
function hideTresSubmenu() {
  document.getElementById('tres-submenu').classList.add('hidden');
}
function launchTres(gameMode) {
  hideTresSubmenu();
  tres = new ThreePlayers(canvas, gameMode);
  _launchVersus('tres-ui', 'tres');
}
function exitTres() { tres = null; _exitVersus('tres-ui', 'tres-submenu'); }

// ── 4-Players submenu & launchers ─────────────────────────────────────────────
function showCuatroSubmenu() {
  document.getElementById('hub-screen').classList.add('hidden');
  document.getElementById('cuatro-submenu').classList.remove('hidden');
}
function hideCuatroSubmenu() {
  document.getElementById('cuatro-submenu').classList.add('hidden');
}
function launchCuatro(gameMode) {
  hideCuatroSubmenu();
  cuatro = new FourPlayers(canvas, gameMode);
  _launchVersus('cuatro-ui', 'cuatro');
}
function exitCuatro() { cuatro = null; _exitVersus('cuatro-ui', 'cuatro-submenu'); }

// ── Cinema (watch movies, entered from the world) ────────────────────────────
function enterCinema() {
  if (mode !== 'exterior') return;
  if (isTouch) forceLandscape();
  hideGestureMenu(); hideFridgeMenu();
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('cinema-ui').classList.remove('hidden');
  theater = new Cinema(canvas);
  mode = 'cinema';
  lastTime = performance.now();
  if (!animFrameId) animFrameId = requestAnimationFrame(gameLoop);
}
function exitCinema() {
  document.getElementById('cinema-ui').classList.add('hidden');
  theater = null;
  mode = 'exterior';
  document.getElementById('hud').classList.remove('hidden');
  lastTime = performance.now();
}
function toggleLie() {
  if (!character) return;
  if (character.state === 'lie') {
    character.state = 'walk';
  } else {
    character.state = 'lie';
    // Snap to bed center; y=252 > bed.y=250 so character sorts on top in depth order
    character.x = INTERIOR_W - 300;
    character.y = 252;
  }
}
function enterCocina() {              // launched from the kitchen counter inside a house
  if (mode !== 'interior') return;
  hideGestureMenu();
  hideFridgeMenu();
  cocinaFrom = 'kitchen';
  cocina = new Cocina(canvas);
  mode = 'cocina';
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('cocina-ui').classList.remove('hidden');
}
function exitCocina() {
  document.getElementById('cocina-ui').classList.add('hidden');
  cocina = null;
  if (cocinaFrom === 'kitchen') {
    mode = 'interior';
    document.getElementById('hud').classList.remove('hidden');
  } else {
    showHub();
  }
}

// ── Dog runner mini-game ─────────────────────────────────────────────────────
function enterRunner() {              // launched from the TV inside a house
  if (mode !== 'interior') return;
  hideGestureMenu();
  hideFridgeMenu();
  runnerFrom = 'tv';
  runner = new Runner(canvas);
  mode = 'runner';
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('runner-ui').classList.remove('hidden');
}
function exitRunner() {
  document.getElementById('runner-ui').classList.add('hidden');
  runner = null;
  if (runnerFrom === 'tv') {
    mode = 'interior';
    document.getElementById('hud').classList.remove('hidden');
  } else {
    showHub();
  }
}

// ── Game start / stop ──────────────────────────────────────────────────────
function startGame() {
  if (character)     character.destroy();
  if (controls)      controls.destroy();
  if (touchControls) touchControls.destroy();
  if (world)         world.destroy();
  if (interior)      { interior.destroy(); interior = null; }
  if (animFrameId)   cancelAnimationFrame(animFrameId);

  mode     = 'exterior';
  fadeAlpha = 0; fadingIn = false; fadingOut = false;

  world         = new World(WORLD_W, WORLD_H);
  character     = new Character(WORLD_W * 0.5, WORLD_H * 0.70, look);
  controls      = new Controls();
  touchControls = new TouchControls(canvas);
  cam.zoom      = 0.55;

  // Restore saved state (position / facing / time of day)
  const saved = loadState();
  if (saved) {
    if (typeof saved.x === 'number') character.x = saved.x;
    if (typeof saved.y === 'number') character.y = saved.y;
    if (saved.facing) character.facingDir = saved.facing;
    if (typeof saved.night === 'boolean') {
      isNight = saved.night;
      nightAlpha = isNight ? 1 : 0;
      document.getElementById('time-btn').textContent = isNight ? '☀️' : '🌙';
    }
  }

  touchControls.onZoom(scale => {
    cam.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, cam.zoom * scale));
  });

  cam.x = character.x - canvas.width  / (2 * cam.zoom);
  cam.y = character.y - canvas.height / (2 * cam.zoom);
  clampCam();

  // HUD
  document.getElementById('char-hud-name').textContent   = 'Niña';
  document.getElementById('char-hud-element').textContent = '¡A jugar!';
  document.getElementById('char-hud-element').style.color = '#FFB6C8';
  document.getElementById('hud').classList.remove('hidden');

  inGame = true;
  saveState();
  lastTime    = performance.now();
  animFrameId = requestAnimationFrame(gameLoop);
}

function stopGame() {
  inGame = false;
  saveState();
  if (animFrameId)   cancelAnimationFrame(animFrameId);
  if (character)     { character.destroy();     character     = null; }
  if (controls)      { controls.destroy();      controls      = null; }
  if (touchControls) { touchControls.destroy(); touchControls = null; }
  if (interior)      { interior.destroy();      interior      = null; }
  if (world)         { world.destroy();         world         = null; }
  animFrameId = null;
  mode        = 'exterior';
  showHub();
}

// HUD portrait — draw the composite avatar onto the small canvas
function updateHUDPortrait() {
  const c = document.getElementById('char-portrait');
  if (!c) return;
  const ctx2 = c.getContext('2d');
  ctx2.clearRect(0, 0, c.width, c.height);
  const tmp = character || new Character(0, 0, look);
  tmp.drawPreview(ctx2, c.width / 2, c.height - 3, (c.height - 6) / 132);
  const coinEl = document.getElementById('coin-count');
  if (coinEl) coinEl.textContent = getCoins();
}

// Selection preview — composite avatar with the current look
function drawSelectionPreviews() {
  document.querySelectorAll('.char-preview').forEach(c => {
    const ctx2 = c.getContext('2d');
    ctx2.clearRect(0, 0, c.width, c.height);
    const tmp = new Character(0, 0, look);
    tmp.drawPreview(ctx2, c.width / 2, c.height - 4, (c.height - 8) / 132);
  });
}

// ── Game loop ──────────────────────────────────────────────────────────────
function gameLoop(now) {
  animFrameId = requestAnimationFrame(gameLoop);
  const delta = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  // Full-screen mini-games own the whole canvas; start from a clean transform
  // (defends against any residual transform left by the world/interior render).
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (mode === 'runner' && runner) { runner.update(delta); runner.render(ctx); return; }
  if (mode === 'cocina' && cocina) { cocina.update(delta); cocina.render(ctx); return; }
  if (mode === 'match3' && match3) { match3.update(delta); match3.render(ctx); return; }
  if (mode === 'hole'  && hole)  { hole.update(delta);  hole.render(ctx);  return; }
  if (mode === 'hole2'  && hole2)  { hole2.update(delta);  hole2.render(ctx);  return; }
  if (mode === 'galaga' && galaga) { galaga.update(delta); galaga.render(ctx); return; }
  if (mode === 'cinema' && theater) { theater.update(delta); theater.render(ctx); return; }
  if (mode === 'helado' && helado) { helado.update(delta); helado.render(ctx); return; }
  if (mode === 'tienda' && tienda) { tienda.update(delta); tienda.render(ctx); return; }
  if (mode === 'mob'    && mob)    { mob.update(delta);    mob.render(ctx);    return; }
  if (mode === 'pong'   && pong)   { _run2PFrame(pong, delta);   return; }
  if (mode === 'globos' && globos) { _run2PFrame(globos, delta); return; }
  if (mode === 'sumo'   && sumo)   { _run2PFrame(sumo, delta);   return; }
  if (mode === 'cocinas' && cocinas) { _run2PFrame(cocinas, delta); return; }
  if (mode === 'vuelo'  && vuelo)  { _run2PFrame(vuelo, delta);  return; }
  if (mode === 'corazones' && corazones) { _run2PFrame(corazones, delta); return; }
  if (mode === 'memoria2p' && memoria2p) { _run2PFrame(memoria2p, delta); return; }
  if (mode === 'tresenraya' && tresenraya) { _run2PFrame(tresenraya, delta); return; }
  if (mode === 'conecta4' && conecta4) { _run2PFrame(conecta4, delta); return; }
  if (mode === 'ppt'     && ppt)     { _run2PFrame(ppt, delta);     return; }
  if (mode === 'ahorcado' && ahorcado) { _run2PFrame(ahorcado, delta); return; }
  if (mode === 'tres'   && tres)   { tres.update(delta);   tres.render(ctx);   return; }
  if (mode === 'cuatro' && cuatro) { cuatro.update(delta); cuatro.render(ctx); return; }
  update(delta);
  render();
}

function update(delta) {
  if (!character || !controls) return;

  // Day / Night smooth lerp
  const tgt = isNight ? 1 : 0;
  nightAlpha += (tgt - nightAlpha) * Math.min(delta * 1.2, 1);
  if (Math.abs(nightAlpha - tgt) < 0.005) nightAlpha = tgt;

  // Fade
  if (fadingIn) {
    fadeAlpha = Math.min(1, fadeAlpha + delta * 4);
    if (fadeAlpha >= 1 && onFadeEnd) {
      onFadeEnd();
      onFadeEnd = null;
    }
  }
  if (fadingOut) {
    fadeAlpha = Math.max(0, fadeAlpha - delta * 4);
    if (fadeAlpha <= 0) fadingOut = false;
  }

  if (fadingIn) return;   // freeze movement during fade-to-black

  let dx = 0, dy = 0;
  if (controls.moveForward)  dy -= 1;
  if (controls.moveBackward) dy += 1;
  if (controls.moveLeft)     dx -= 1;
  if (controls.moveRight)    dx += 1;

  if (touchControls && touchControls.isMoving) {
    dx += touchControls.screenDx * touchControls.moveIntensity;
    dy += touchControls.screenDy * touchControls.moveIntensity;
  }

  const len      = Math.sqrt(dx * dx + dy * dy);
  const moving   = len > 0.01;

  // Stand up / get out of bed when the player moves
  if (moving && character.state !== 'walk') {
    character.state = 'walk';
  }
  if (moving) hideGestureMenu();
  if (moving) hideFridgeMenu();
  if (moving) hideWardrobeMenu();

  if (moving) {
    const spd  = controls.sprint ? character.sprintSpeed : character.speed;
    const maxX = mode === 'interior' ? INTERIOR_W - 60 : WORLD_W - 60;
    const maxY = mode === 'interior' ? INTERIOR_H - 60 : WORLD_H - 60;
    character.x = Math.max(60, Math.min(maxX, character.x + (dx / len) * spd * delta));
    character.y = Math.max(60, Math.min(maxY, character.y + (dy / len) * spd * delta));
    character.isMoving = true;
    if (Math.abs(dx) > 0.05) character.facingDir = dx < 0 ? -1 : 1;
  } else {
    character.isMoving = false;

    // Proximity check for sitting/lying (interior only)
    if (mode === 'interior' && interior && character.state === 'walk') {
      const SEAT_R = 55, BED_R = 85;

      for (const seat of interior.getSeats()) {
        if (Math.hypot(character.x - seat.x, character.y - seat.y) < SEAT_R) {
          character.state = 'sit';
          character.x = seat.x;
          character.y = seat.y;
          break;
        }
      }

      if (character.state === 'walk') {
        for (const bed of interior.getBeds()) {
          if (Math.hypot(character.x - bed.x, character.y - bed.y) < BED_R) {
            character.state = 'lie';
            character.x = bed.x;
            character.y = bed.y;  // already 252, above bed's draw y=250
            break;
          }
        }
      }
    }
  }

  character.update(delta);

  // ── Particle spawns ──────────────────────────────────────────────
  dustTimer -= delta;
  if (moving && controls.sprint && character.state === 'walk' && dustTimer <= 0) {
    spawnDust(character.x - character.facingDir * 8, character.y);
    dustTimer = 0.05;
  }
  if (mode === 'exterior') {
    petalTimer -= delta;
    if (petalTimer <= 0) { spawnPetal(); petalTimer = 0.7 + Math.random() * 0.6; }
  }
  updateParticles(delta);
  updateFireflies(delta);

  // Exit house when near door
  if (mode === 'interior' && interior && interior.isNearDoor(character.x, character.y)) {
    exitHouse();
  }

  if (touchControls) {
    touchControls.updateCharScreenPos(
      (character.x - cam.x) * cam.zoom,
      (character.y - cam.y) * cam.zoom
    );
  }

  // Smooth camera follow
  const vw = canvas.width  / cam.zoom;
  const vh = canvas.height / cam.zoom;
  cam.x += (character.x - vw / 2 - cam.x) * 0.1;
  cam.y += (character.y - vh / 2 - cam.y) * 0.1;
  clampCam();

  // Refresh HUD portrait
  updateHUDPortrait();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const vw = canvas.width  / cam.zoom;
  const vh = canvas.height / cam.zoom;

  ctx.save();
  ctx.scale(cam.zoom, cam.zoom);

  if (mode === 'interior' && interior) {
    interior.render(ctx, cam, vw, vh);
    const list = [...interior.getDrawables(), character].filter(Boolean);
    list.sort((a, b) => a.y - b.y);
    for (const d of list) d.draw(ctx, cam, interiorDepthScale);
  } else if (world) {
    world.render(ctx, cam, vw, vh);
    const list = [...world.getDrawables(), character].filter(Boolean);
    list.sort((a, b) => a.y - b.y);
    for (const d of list) d.draw(ctx, cam, depthScale);
  }

  drawParticles();

  ctx.restore();

  // Night effects (screen space)
  if (nightAlpha > 0.01) {
    _renderNight();
  }

  // Fade overlay (screen space, always on top)
  if (fadeAlpha > 0) {
    ctx.fillStyle = `rgba(0,0,0,${fadeAlpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function _renderNight() {
  const W = canvas.width, H = canvas.height;

  // Stars + moon (drawn first, below the dark overlay)
  if (nightAlpha > 0.15) {
    for (const st of STARS) {
      ctx.globalAlpha = st.b * nightAlpha * 0.9;
      ctx.fillStyle   = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(st.x * W, st.y * H, st.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Moon
    const mx = W * 0.82, my = H * 0.11;
    ctx.save();
    ctx.globalAlpha  = nightAlpha * 0.95;
    ctx.shadowBlur   = 28;
    ctx.shadowColor  = 'rgba(240,230,160,0.55)';
    ctx.fillStyle    = '#F2E8B8';
    ctx.beginPath();
    ctx.arc(mx, my, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(180,170,120,0.35)';
    ctx.beginPath(); ctx.arc(mx + 7, my - 5, 8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(mx - 8, my + 7, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Dark blue overlay
  ctx.fillStyle = `rgba(4, 6, 32, ${nightAlpha * 0.72})`;
  ctx.fillRect(0, 0, W, H);

  // Light halos – additive blending punches through darkness
  ctx.globalCompositeOperation = 'lighter';
  const t = performance.now() * 0.001;

  if (mode === 'exterior' && world) {
    for (const src of world.getLightSources()) {
      const sx = (src.worldX - cam.x) * cam.zoom;
      const sy = (src.worldY - cam.y) * cam.zoom;
      const r  = src.radius * cam.zoom;
      if (sx < -r || sx > W + r || sy < -r || sy > H + r) continue;
      const fl = 0.9 + 0.1 * Math.sin(t * 3 + src.worldX * 0.04);
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      const [cr, cg, cb] = src.color;
      g.addColorStop(0,   `rgba(${cr},${cg},${cb},${nightAlpha * 0.85 * fl})`);
      g.addColorStop(0.35,`rgba(${cr},${cg},${cb},${nightAlpha * 0.35 * fl})`);
      g.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fireflies (drift over the night scene)
    if (nightAlpha > 0.2) {
      for (const f of fireflies) {
        if (!f.seeded) continue;
        const sx = (f.x - cam.x) * cam.zoom;
        const sy = (f.y - cam.y) * cam.zoom;
        const blink = 0.45 + 0.55 * Math.sin(f.t * 4 + f.ox * 3);
        const a = nightAlpha * Math.max(0, blink);
        const r = 13 * cam.zoom;
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
        g.addColorStop(0,   `rgba(200,255,120,${a * 0.9})`);
        g.addColorStop(0.4, `rgba(150,220,80,${a * 0.3})`);
        g.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(225,255,170,${a})`;
        ctx.beginPath(); ctx.arc(sx, sy, 2 * cam.zoom, 0, Math.PI * 2); ctx.fill();
      }
    }
  } else if (mode === 'interior' && interior) {
    for (const src of interior.getLightSources(cam, interiorDepthScale)) {
      const sx = src.sx * cam.zoom;
      const sy = src.sy * cam.zoom;
      const r  = src.r  * cam.zoom;
      if (sx < -r || sx > W + r || sy < -r || sy > H + r) continue;
      const fl = 0.88 + 0.12 * Math.sin(t * 3.5 + src.sx * 0.05);
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      const [cr, cg, cb] = src.color;
      g.addColorStop(0,   `rgba(${cr},${cg},${cb},${nightAlpha * 0.9 * fl})`);
      g.addColorStop(0.4, `rgba(${cr},${cg},${cb},${nightAlpha * 0.4 * fl})`);
      g.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.globalCompositeOperation = 'source-over';
}

// ── Hit-test: was the character tapped? ─────────────────────────────────────
function characterAt(worldX, worldY) {
  if (!character) return false;
  const s  = mode === 'interior' ? interiorDepthScale(character.y) : depthScale(character.y);
  const dx = worldX - character.x;
  const dy = worldY - character.y;
  if (character.state === 'lie') return Math.abs(dx) < 80 * s && Math.abs(dy) < 44 * s;
  return dx > -36 * s && dx < 36 * s && dy > -150 * s && dy < 14 * s;
}

// ── Gesture menu ────────────────────────────────────────────────────────────
const gestureMenu = document.getElementById('gesture-menu');
let gestureMenuOpen = false;
function showGestureMenu() { gestureMenu.classList.remove('hidden'); gestureMenuOpen = true; }
function hideGestureMenu() {
  if (!gestureMenuOpen) return;
  gestureMenu.classList.add('hidden');
  gestureMenuOpen = false;
}
document.querySelectorAll('.gesture-btn').forEach(b => {
  const fire = e => { e.stopPropagation(); if (character) character.playGesture(b.dataset.gesture); };
  b.addEventListener('click', fire);
  b.addEventListener('touchend', e => { e.preventDefault(); fire(e); }, { passive: false });
});
document.getElementById('gesture-close').addEventListener('click', hideGestureMenu);

// ── Fridge menu ─────────────────────────────────────────────────────────────
const fridgeMenu = document.getElementById('fridge-menu');
const fridgeItems = document.getElementById('fridge-items');
let fridgeMenuOpen = false;

function renderFridgeMenu() {
  const foods = getFridge();
  const entries = Object.entries(foods).sort((a, b) => a[0].localeCompare(b[0]));
  fridgeItems.textContent = '';
  if (!entries.length) {
    const empty = document.createElement('div');
    empty.className = 'fridge-empty';
    empty.textContent = 'Todavía no hay comida. Cociná platos en Cocina con Labubu y van a aparecer acá.';
    fridgeItems.appendChild(empty);
    return;
  }
  for (const [name, item] of entries) {
    const row = document.createElement('div');
    row.className = 'fridge-item';
    const emoji = document.createElement('div');
    emoji.className = 'fridge-emoji';
    emoji.textContent = item.emoji;
    const meta = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'fridge-name';
    title.textContent = name;
    const count = document.createElement('div');
    count.className = 'fridge-count';
    count.textContent = `x${item.count}`;
    const eat = document.createElement('button');
    eat.className = 'fridge-eat';
    eat.dataset.food = name;
    eat.textContent = 'Comer';
    meta.append(title, count);
    row.append(emoji, meta, eat);
    fridgeItems.appendChild(row);
  }
}

function showFridgeMenu() {
  hideGestureMenu();
  renderFridgeMenu();
  fridgeMenu.classList.remove('hidden');
  fridgeMenuOpen = true;
}

function hideFridgeMenu() {
  if (!fridgeMenuOpen) return;
  fridgeMenu.classList.add('hidden');
  fridgeMenuOpen = false;
}

// ── Wardrobe menu ────────────────────────────────────────────────────────────
const wardrobeMenu  = document.getElementById('wardrobe-menu');
const wardrobeItems = document.getElementById('wardrobe-items');
let wardrobeMenuOpen = false;

function renderWardrobeMenu() {
  const owned = getWardrobe();
  const equippedId = getEquippedId();
  wardrobeItems.textContent = '';
  if (!Object.keys(owned).length) {
    const empty = document.createElement('div');
    empty.className = 'fridge-empty';
    empty.textContent = 'Tu placard está vacío. Comprá ropa en la Tienda de Ropa.';
    wardrobeItems.appendChild(empty);
    return;
  }
  for (const item of TIENDA_CATALOG) {
    if (!owned[item.id]) continue;
    const row = document.createElement('div');
    row.className = 'fridge-item';
    const emoji = document.createElement('div');
    emoji.className = 'fridge-emoji'; emoji.textContent = item.emoji;
    const meta = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'fridge-name'; title.textContent = item.name;
    const eq = equippedId === item.id;
    const status = document.createElement('div');
    status.className = 'fridge-count'; status.textContent = eq ? '✓ Puesto' : '';
    const btn = document.createElement('button');
    btn.className = 'fridge-eat'; btn.dataset.id = item.id;
    btn.textContent = eq ? 'Puesto' : 'Usar';
    if (eq) btn.disabled = true;
    meta.append(title, status);
    row.append(emoji, meta, btn);
    wardrobeItems.appendChild(row);
  }
}

function openWardrobeMenu() {
  hideGestureMenu(); hideFridgeMenu();
  renderWardrobeMenu();
  wardrobeMenu.classList.remove('hidden');
  wardrobeMenuOpen = true;
}
function hideWardrobeMenu() {
  if (!wardrobeMenuOpen) return;
  wardrobeMenu.classList.add('hidden');
  wardrobeMenuOpen = false;
}
document.getElementById('wardrobe-close').addEventListener('click', hideWardrobeMenu);
wardrobeItems.addEventListener('click', e => {
  const btn = e.target.closest('.fridge-eat');
  if (!btn || btn.disabled) return;
  const id = btn.dataset.id;
  const item = TIENDA_CATALOG.find(c => c.id === id);
  if (!item) return;
  setEquippedId(id);
  look = Object.assign({}, look, item.cfg);
  if (character) Object.assign(character.cfg, look);
  drawSelectionPreviews(); updateHUDPortrait(); saveState();
  renderWardrobeMenu();
});

document.getElementById('fridge-close').addEventListener('click', hideFridgeMenu);
fridgeItems.addEventListener('click', e => {
  const btn = e.target.closest('.fridge-eat');
  if (!btn) return;
  if (eatFood(btn.dataset.food)) {
    if (character) character.playGesture('dance');
    renderFridgeMenu();
  }
});

// ── Click: tap character → gesture menu, else tap house → enter ─────────────
canvas.addEventListener('click', e => {
  if (fadingIn || fadingOut) return;
  if (mode !== 'exterior' && mode !== 'interior') return;   // mini-game modes handle their own input
  const rect  = canvas.getBoundingClientRect();
  const worldX = (e.clientX - rect.left)  / cam.zoom + cam.x;
  const worldY = (e.clientY - rect.top)   / cam.zoom + cam.y;
  if (mode === 'interior' && interior && interior.containsTV(worldX, worldY)) { enterRunner(); return; }
  if (mode === 'interior' && interior && interior.containsFridge(worldX, worldY)) { showFridgeMenu(); return; }
  if (mode === 'interior' && interior && interior.containsKitchen(worldX, worldY)) { enterCocina(); return; }
  if (mode === 'interior' && interior && interior.containsBed(worldX, worldY)) { toggleLie(); return; }
  if (mode === 'interior' && interior && interior.containsWardrobe(worldX, worldY)) { openWardrobeMenu(); return; }
  if (characterAt(worldX, worldY)) { hideFridgeMenu(); hideWardrobeMenu(); showGestureMenu(); return; }
  hideGestureMenu();
  hideFridgeMenu();
  hideWardrobeMenu();
  if (mode !== 'exterior' || !world) return;
  if (world.getHolePortalAt(worldX, worldY)) { enterHoleFromWorld(); return; }
  if (world.getCinemaAt(worldX, worldY, WORLD_H)) { enterCinema(); return; }
  if (world.getBoutiqueAt(worldX, worldY, WORLD_H)) { launchTienda(); return; }
  const house = world.getHouseAt(worldX, worldY, WORLD_H);
  if (house) enterHouse(house);
});

// Touch tap: same behaviour
canvas.addEventListener('touchend', e => {
  if (fadingIn || fadingOut) return;
  if (mode !== 'exterior' && mode !== 'interior') return;   // mini-game modes handle their own input
  const t     = e.changedTouches[0];
  const rect  = canvas.getBoundingClientRect();
  const worldX = (t.clientX - rect.left) / cam.zoom + cam.x;
  const worldY = (t.clientY - rect.top)  / cam.zoom + cam.y;
  if (mode === 'interior' && interior && interior.containsTV(worldX, worldY)) { e.preventDefault(); enterRunner(); return; }
  if (mode === 'interior' && interior && interior.containsFridge(worldX, worldY)) { e.preventDefault(); showFridgeMenu(); return; }
  if (mode === 'interior' && interior && interior.containsKitchen(worldX, worldY)) { e.preventDefault(); enterCocina(); return; }
  if (mode === 'interior' && interior && interior.containsBed(worldX, worldY)) { e.preventDefault(); toggleLie(); return; }
  if (mode === 'interior' && interior && interior.containsWardrobe(worldX, worldY)) { e.preventDefault(); openWardrobeMenu(); return; }
  if (characterAt(worldX, worldY)) { e.preventDefault(); hideFridgeMenu(); hideWardrobeMenu(); showGestureMenu(); return; }
  hideGestureMenu();
  hideFridgeMenu();
  hideWardrobeMenu();
  if (mode !== 'exterior' || !world) return;
  if (world.getHolePortalAt(worldX, worldY)) { e.preventDefault(); enterHoleFromWorld(); return; }
  if (world.getCinemaAt(worldX, worldY, WORLD_H)) { e.preventDefault(); enterCinema(); return; }
  if (world.getBoutiqueAt(worldX, worldY, WORLD_H)) { e.preventDefault(); launchTienda(); return; }
  const house = world.getHouseAt(worldX, worldY, WORLD_H);
  if (house) { e.preventDefault(); enterHouse(house); }
}, { passive: false });

// ── Zoom (mouse wheel) ─────────────────────────────────────────────────────
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.1 : 0.9;
  cam.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, cam.zoom * factor));
}, { passive: false });

// ── Day / Night toggle ───────────────────────────────────────────────────────
document.getElementById('time-btn').addEventListener('click', () => {
  isNight = !isNight;
  document.getElementById('time-btn').textContent = isNight ? '☀️' : '🌙';
  saveState();
});

// ── Dog runner controls ──────────────────────────────────────────────────────
function bindHold(el, on, off) {
  if (!el) return;
  el.addEventListener('pointerdown', e => { e.preventDefault(); on(); });
  if (off) ['pointerup','pointerleave','pointercancel'].forEach(ev => el.addEventListener(ev, e => { e.preventDefault(); off(); }));
}
bindHold(document.getElementById('runner-jump'), () => { if (runner) runner.jump(); });
bindHold(document.getElementById('runner-duck'), () => { if (runner) runner.setDuck(true); }, () => { if (runner) runner.setDuck(false); });
const rExit = document.getElementById('runner-exit');
if (rExit) rExit.addEventListener('click', exitRunner);

window.addEventListener('keydown', e => {
  if (mode !== 'runner' || !runner) return;
  if (e.code==='ArrowUp' || e.code==='Space' || e.code==='KeyW') { runner.jump(); e.preventDefault(); }
  else if (e.code==='ArrowDown' || e.code==='KeyS') { runner.setDuck(true); e.preventDefault(); }
  else if (e.code==='Escape') exitRunner();
});
window.addEventListener('keyup', e => {
  if (mode !== 'runner' || !runner) return;
  if (e.code==='ArrowDown' || e.code==='KeyS') runner.setDuck(false);
});

// ── Cooking controls (tap / drag to move; WASD or arrows) ────────────────────
const cExit = document.getElementById('cocina-exit');
if (cExit) cExit.addEventListener('click', exitCocina);

function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  const t = (e.touches && e.touches[0]) || e;
  return {
    x: (t.clientX - rect.left) * (canvas.width / rect.width),
    y: (t.clientY - rect.top) * (canvas.height / rect.height),
  };
}
let cocinaPointerDown = false;
canvas.addEventListener('pointerdown', e => {
  if (mode !== 'cocina' || !cocina) return;
  cocinaPointerDown = true; const p = canvasPoint(e); cocina.pointer(p.x, p.y);
});
canvas.addEventListener('pointermove', e => {
  if (mode !== 'cocina' || !cocina || !cocinaPointerDown) return;
  const p = canvasPoint(e); cocina.pointer(p.x, p.y);
});
['pointerup','pointerleave','pointercancel'].forEach(ev =>
  canvas.addEventListener(ev, () => { if (mode === 'cocina' && cocina) { cocinaPointerDown = false; cocina.pointerUp(); } }));

const cocinaKeys = { up:false, down:false, left:false, right:false };
function cocinaApplyKeys() {
  if (cocina) cocina.setDir((cocinaKeys.right?1:0) - (cocinaKeys.left?1:0), (cocinaKeys.down?1:0) - (cocinaKeys.up?1:0));
}
window.addEventListener('keydown', e => {
  if (mode !== 'cocina' || !cocina) return;
  if (e.code==='Escape') { exitCocina(); return; }
  if (e.code==='ArrowUp'||e.code==='KeyW') cocinaKeys.up = true;
  else if (e.code==='ArrowDown'||e.code==='KeyS') cocinaKeys.down = true;
  else if (e.code==='ArrowLeft'||e.code==='KeyA') cocinaKeys.left = true;
  else if (e.code==='ArrowRight'||e.code==='KeyD') cocinaKeys.right = true;
  else return;
  e.preventDefault(); cocinaApplyKeys();
});
window.addEventListener('keyup', e => {
  if (mode !== 'cocina' || !cocina) return;
  if (e.code==='ArrowUp'||e.code==='KeyW') cocinaKeys.up = false;
  else if (e.code==='ArrowDown'||e.code==='KeyS') cocinaKeys.down = false;
  else if (e.code==='ArrowLeft'||e.code==='KeyA') cocinaKeys.left = false;
  else if (e.code==='ArrowRight'||e.code==='KeyD') cocinaKeys.right = false;
  else return;
  cocinaApplyKeys();
});

// ── Match-3 controls (tap / drag to swap; arrows + Enter on desktop) ──────────
const m3Exit = document.getElementById('match3-exit');
if (m3Exit) m3Exit.addEventListener('click', exitMatch3);

let match3PointerDown = false;
canvas.addEventListener('pointerdown', e => {
  if (mode !== 'match3' || !match3) return;
  match3PointerDown = true; const p = canvasPoint(e); match3.pointerDown(p.x, p.y);
});
canvas.addEventListener('pointermove', e => {
  if (mode !== 'match3' || !match3 || !match3PointerDown) return;
  const p = canvasPoint(e); match3.pointerMove(p.x, p.y);
});
['pointerup','pointerleave','pointercancel'].forEach(ev =>
  canvas.addEventListener(ev, () => { if (mode === 'match3' && match3) { match3PointerDown = false; match3.pointerUp(); } }));

window.addEventListener('keydown', e => {
  if (mode !== 'match3' || !match3) return;
  if (e.code==='Escape') { exitMatch3(); return; }
  if (e.code==='ArrowUp'||e.code==='KeyW') match3.moveCursor(0, -1);
  else if (e.code==='ArrowDown'||e.code==='KeyS') match3.moveCursor(0, 1);
  else if (e.code==='ArrowLeft'||e.code==='KeyA') match3.moveCursor(-1, 0);
  else if (e.code==='ArrowRight'||e.code==='KeyD') match3.moveCursor(1, 0);
  else if (e.code==='Enter'||e.code==='Space') match3.selectCursor();
  else return;
  e.preventDefault();
});

// ── Hole controls (tap / drag to steer; WASD or arrows) ──────────────────────
// Hole submenu buttons
const holeSubmenuBack  = document.getElementById('hole-submenu-back');
const holeSubmenuClassic = document.getElementById('hole-submenu-classic');
const holeSubmenuFeast   = document.getElementById('hole-submenu-feast');
if (holeSubmenuBack)    holeSubmenuBack.addEventListener('click',    () => { hideHoleSubmenu(); document.getElementById('hub-screen').classList.remove('hidden'); });
if (holeSubmenuClassic) { holeSubmenuClassic.addEventListener('click', launchHole); holeSubmenuClassic.addEventListener('touchend', e => { e.preventDefault(); launchHole(); }, { passive: false }); }
if (holeSubmenuFeast)   { holeSubmenuFeast.addEventListener('click', launchHole2);  holeSubmenuFeast.addEventListener('touchend',   e => { e.preventDefault(); launchHole2(); },  { passive: false }); }

const holeExit = document.getElementById('hole-exit');
if (holeExit) holeExit.addEventListener('click', exitHole);

let holePointerDown = false;
canvas.addEventListener('pointerdown', e => {
  if (mode !== 'hole' || !hole) return;
  holePointerDown = true; const p = canvasPoint(e); hole.pointer(p.x, p.y);
});
canvas.addEventListener('pointermove', e => {
  if (mode !== 'hole' || !hole || !holePointerDown) return;
  const p = canvasPoint(e); hole.pointer(p.x, p.y);
});
['pointerup','pointerleave','pointercancel'].forEach(ev =>
  canvas.addEventListener(ev, () => { if (mode === 'hole' && hole) { holePointerDown = false; hole.pointerUp(); } }));

const holeKeys = { up:false, down:false, left:false, right:false };
function holeApplyKeys() {
  if (hole) hole.setDir((holeKeys.right?1:0) - (holeKeys.left?1:0), (holeKeys.down?1:0) - (holeKeys.up?1:0));
}
window.addEventListener('keydown', e => {
  if (mode !== 'hole' || !hole) return;
  if (e.code==='Escape') { exitHole(); return; }
  if (e.code==='ArrowUp'||e.code==='KeyW') holeKeys.up = true;
  else if (e.code==='ArrowDown'||e.code==='KeyS') holeKeys.down = true;
  else if (e.code==='ArrowLeft'||e.code==='KeyA') holeKeys.left = true;
  else if (e.code==='ArrowRight'||e.code==='KeyD') holeKeys.right = true;
  else return;
  e.preventDefault(); holeApplyKeys();
});
window.addEventListener('keyup', e => {
  if (mode !== 'hole' || !hole) return;
  if (e.code==='ArrowUp'||e.code==='KeyW') holeKeys.up = false;
  else if (e.code==='ArrowDown'||e.code==='KeyS') holeKeys.down = false;
  else if (e.code==='ArrowLeft'||e.code==='KeyA') holeKeys.left = false;
  else if (e.code==='ArrowRight'||e.code==='KeyD') holeKeys.right = false;
  else return;
  holeApplyKeys();
});

// ── Hole2 controls ───────────────────────────────────────────────────────────
const hole2Exit = document.getElementById('hole2-exit');
if (hole2Exit) hole2Exit.addEventListener('click', exitHole2);

let hole2PointerDown = false;
canvas.addEventListener('pointerdown', e => {
  if (mode !== 'hole2' || !hole2) return;
  hole2PointerDown = true; const p = canvasPoint(e); hole2.pointer(p.x, p.y);
});
canvas.addEventListener('pointermove', e => {
  if (mode !== 'hole2' || !hole2 || !hole2PointerDown) return;
  const p = canvasPoint(e); hole2.pointer(p.x, p.y);
});
['pointerup','pointerleave','pointercancel'].forEach(ev =>
  canvas.addEventListener(ev, () => { if (mode === 'hole2' && hole2) { hole2PointerDown = false; hole2.pointerUp(); } }));

const hole2Keys = { up:false, down:false, left:false, right:false };
function hole2ApplyKeys() {
  if (hole2) hole2.setDir((hole2Keys.right?1:0)-(hole2Keys.left?1:0),(hole2Keys.down?1:0)-(hole2Keys.up?1:0));
}
window.addEventListener('keydown', e => {
  if (mode !== 'hole2' || !hole2) return;
  if (e.code==='Escape') { exitHole2(); return; }
  if (e.code==='ArrowUp'||e.code==='KeyW') hole2Keys.up = true;
  else if (e.code==='ArrowDown'||e.code==='KeyS') hole2Keys.down = true;
  else if (e.code==='ArrowLeft'||e.code==='KeyA') hole2Keys.left = true;
  else if (e.code==='ArrowRight'||e.code==='KeyD') hole2Keys.right = true;
  else return;
  e.preventDefault(); hole2ApplyKeys();
});
window.addEventListener('keyup', e => {
  if (mode !== 'hole2' || !hole2) return;
  if (e.code==='ArrowUp'||e.code==='KeyW') hole2Keys.up = false;
  else if (e.code==='ArrowDown'||e.code==='KeyS') hole2Keys.down = false;
  else if (e.code==='ArrowLeft'||e.code==='KeyA') hole2Keys.left = false;
  else if (e.code==='ArrowRight'||e.code==='KeyD') hole2Keys.right = false;
  else return;
  hole2ApplyKeys();
});

// ── Galaga controls ───────────────────────────────────────────────────────────
const gExit = document.getElementById('galaga-exit');
if (gExit) gExit.addEventListener('click', exitGalaga);

bindHold(document.getElementById('galaga-left'),  () => { if (galaga) galaga.setDir(-1); }, () => { if (galaga) galaga.setDir(0); });
bindHold(document.getElementById('galaga-right'), () => { if (galaga) galaga.setDir(1);  }, () => { if (galaga) galaga.setDir(0); });
bindHold(document.getElementById('galaga-fire'),  () => { if (galaga) galaga.startFire(); }, () => { if (galaga) galaga.stopFire(); });

// Canvas tap for game-over "play again" button
canvas.addEventListener('pointerdown', e => {
  if (mode !== 'galaga' || !galaga) return;
  const p = canvasPoint(e); galaga.tap(p.x, p.y);
});

window.addEventListener('keydown', e => {
  if (mode !== 'galaga' || !galaga) return;
  if (e.code === 'Escape')                            { exitGalaga(); return; }
  if (e.code === 'ArrowLeft'  || e.code === 'KeyA')  { galaga.setDir(-1); e.preventDefault(); }
  else if (e.code === 'ArrowRight' || e.code === 'KeyD') { galaga.setDir(1);  e.preventDefault(); }
  else if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { galaga.startFire(); e.preventDefault(); }
});
window.addEventListener('keyup', e => {
  if (mode !== 'galaga' || !galaga) return;
  if (e.code === 'ArrowLeft'  || e.code === 'KeyA')  galaga.setDir(0);
  else if (e.code === 'ArrowRight' || e.code === 'KeyD') galaga.setDir(0);
  else if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') galaga.stopFire();
});

// ── Cinema controls (‹ › to change movie; tap screen sides) ──────────────────
const cinExit = document.getElementById('cinema-exit');
if (cinExit) cinExit.addEventListener('click', exitCinema);
const cinPrev = document.getElementById('cinema-prev');
if (cinPrev) cinPrev.addEventListener('click', () => { if (theater) theater.prev(); });
const cinNext = document.getElementById('cinema-next');
if (cinNext) cinNext.addEventListener('click', () => { if (theater) theater.next(); });

canvas.addEventListener('pointerdown', e => {
  if (mode !== 'cinema' || !theater) return;
  const p = canvasPoint(e); theater.pointer(p.x, p.y);
});
window.addEventListener('keydown', e => {
  if (mode !== 'cinema' || !theater) return;
  if (e.code === 'Escape') exitCinema();
  else if (e.code === 'ArrowLeft' || e.code === 'KeyA') theater.prev();
  else if (e.code === 'ArrowRight' || e.code === 'KeyD') theater.next();
  else return;
  e.preventDefault();
});

// ── Ice-cream shop controls (tap palette / scoops / buttons) ─────────────────
const heladoExit = document.getElementById('helado-exit');
if (heladoExit) heladoExit.addEventListener('click', exitHelado);
canvas.addEventListener('pointerdown', e => {
  if (mode !== 'helado' || !helado) return;
  const p = canvasPoint(e); helado.pointer(p.x, p.y);
});
window.addEventListener('keydown', e => {
  if (mode === 'helado' && helado && e.code === 'Escape') { exitHelado(); e.preventDefault(); }
});

// ── Tienda controls ──────────────────────────────────────────────────────────
const tiendaExit = document.getElementById('tienda-exit');
if (tiendaExit) tiendaExit.addEventListener('click', exitTienda);
canvas.addEventListener('pointerdown', e => {
  if (mode !== 'tienda' || !tienda) return;
  const p = canvasPoint(e); tienda.pointer(p.x, p.y);
});
window.addEventListener('keydown', e => {
  if (mode === 'tienda' && tienda && e.code === 'Escape') { exitTienda(); e.preventDefault(); }
});

// ── Mob Control controls ──────────────────────────────────────────────────────
const mobExit = document.getElementById('mob-exit');
if (mobExit) mobExit.addEventListener('click', exitMob);
window.addEventListener('keydown', e => {
  if (mode === 'mob' && mob && e.code === 'Escape') { exitMob(); e.preventDefault(); }
});

// ── Customization panel — now redirects to wardrobe (purchased looks) ────────
['cust-btn', 'customize-btn'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', openWardrobeMenu);
});

function applyLook(cat, value) {
  look[cat] = value;
  if (character) character.cfg[cat] = value;
  drawSelectionPreviews();
  updateHUDPortrait();
  saveState();
}
function markActive(sel, cat, el) {
  document.querySelectorAll(`${sel}[data-cat="${cat}"]`).forEach(x => x.classList.remove('active'));
  el.classList.add('active');
}
document.querySelectorAll('.cust-opt').forEach(b => {
  b.addEventListener('click', () => { applyLook(b.dataset.cat, b.dataset.value); markActive('.cust-opt', b.dataset.cat, b); });
});
document.querySelectorAll('.cust-color').forEach(s => {
  s.addEventListener('click', () => { applyLook(s.dataset.cat, s.dataset.color); markActive('.cust-color', s.dataset.cat, s); });
});
// reflect saved look in the panel's active states
function syncCustActive() {
  document.querySelectorAll('.cust-opt').forEach(b => b.classList.toggle('active', look[b.dataset.cat] === b.dataset.value));
  document.querySelectorAll('.cust-color').forEach(s => s.classList.toggle('active', look[s.dataset.cat] === s.dataset.color));
}

// ── Force landscape on touch devices (fullscreen + orientation lock) ─────────
const isTouch = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in window);
function forceLandscape() {
  const lock = () => { try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(()=>{}); } catch (e) {} };
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
  try {
    if (req && !document.fullscreenElement) {
      const p = req.call(el);
      if (p && p.then) p.then(lock).catch(lock); else lock();
    } else lock();
  } catch (e) { lock(); }
}
if (isTouch) window.addEventListener('pointerdown', () => forceLandscape(), { once: true });

// ── Selection screen UI ───────────────────────────────────────────────────
function beginPlay() {
  if (isTouch) forceLandscape();
  document.getElementById('cust-panel').classList.add('hidden');
  document.getElementById('select-screen').classList.add('hidden');
  startGame();
}
const playBtn = document.getElementById('play-btn');
playBtn.addEventListener('click', beginPlay);
playBtn.addEventListener('touchend', e => { e.preventDefault(); beginPlay(); }, { passive: false });

// ── Versus submenu buttons ────────────────────────────────────────────────────
const vsBack    = document.getElementById('versus-back');
const vsPong    = document.getElementById('versus-pong');
const vsGlobos  = document.getElementById('versus-globos');
const vsSumo    = document.getElementById('versus-sumo');
const vsCocinas = document.getElementById('versus-cocinas');
const vsVuelo     = document.getElementById('versus-vuelo');
const vsCorazones = document.getElementById('versus-corazones');
const vsMemoria   = document.getElementById('versus-memoria');
const vsTresEnRaya = document.getElementById('versus-tresenraya');
const vsConecta4   = document.getElementById('versus-conecta4');
const vsPPT        = document.getElementById('versus-ppt');
const vsAhorcado   = document.getElementById('versus-ahorcado');
if (vsBack)    vsBack.addEventListener('click',    () => { hideVersusSubmenu(); document.getElementById('hub-screen').classList.remove('hidden'); });
if (vsPong)    { vsPong.addEventListener('click',    launchPong);    vsPong.addEventListener('touchend',    e => { e.preventDefault(); launchPong();    }, { passive: false }); }
if (vsGlobos)  { vsGlobos.addEventListener('click',  launchGlobos);  vsGlobos.addEventListener('touchend',  e => { e.preventDefault(); launchGlobos();  }, { passive: false }); }
if (vsSumo)    { vsSumo.addEventListener('click',    launchSumo);    vsSumo.addEventListener('touchend',    e => { e.preventDefault(); launchSumo();    }, { passive: false }); }
if (vsCocinas) { vsCocinas.addEventListener('click', launchCocinas); vsCocinas.addEventListener('touchend', e => { e.preventDefault(); launchCocinas(); }, { passive: false }); }
if (vsVuelo)     { vsVuelo.addEventListener('click',     launchVuelo);     vsVuelo.addEventListener('touchend',     e => { e.preventDefault(); launchVuelo();     }, { passive: false }); }
if (vsCorazones) { vsCorazones.addEventListener('click', launchCorazones); vsCorazones.addEventListener('touchend', e => { e.preventDefault(); launchCorazones(); }, { passive: false }); }
if (vsMemoria)   { vsMemoria.addEventListener('click',   launchMemoria2P); vsMemoria.addEventListener('touchend',   e => { e.preventDefault(); launchMemoria2P(); }, { passive: false }); }
if (vsTresEnRaya) { vsTresEnRaya.addEventListener('click', launchTresEnRaya); vsTresEnRaya.addEventListener('touchend', e => { e.preventDefault(); launchTresEnRaya(); }, { passive: false }); }
if (vsConecta4)   { vsConecta4.addEventListener('click',   launchConecta4);   vsConecta4.addEventListener('touchend',   e => { e.preventDefault(); launchConecta4();   }, { passive: false }); }
if (vsPPT)        { vsPPT.addEventListener('click',        launchPPT);        vsPPT.addEventListener('touchend',        e => { e.preventDefault(); launchPPT();        }, { passive: false }); }
if (vsAhorcado)   { vsAhorcado.addEventListener('click',   launchAhorcado);   vsAhorcado.addEventListener('touchend',   e => { e.preventDefault(); launchAhorcado();   }, { passive: false }); }

// ── Online play: room-code create/join (all 11 versus games) ─────────────────
const ONLINE_GAMES = {
  pong:      { title: '🏓 Pong Chibi — Online',        build: () => new PongChibi(canvas),  uiId: 'pong-ui',      apply: v => { pong      = v; } },
  globos:    { title: '🎈 Tiro al Globo — Online',      build: () => new Globos2P(canvas),   uiId: 'globos-ui',    apply: v => { globos    = v; } },
  sumo:      { title: '🥊 Sumo Chibi — Online',         build: () => new Sumo2P(canvas),     uiId: 'sumo-ui',      apply: v => { sumo      = v; } },
  cocinas:   { title: '👨‍🍳 Batalla Cocinas — Online',   build: () => new Cocinas2P(canvas),  uiId: 'cocinas-ui',   apply: v => { cocinas   = v; } },
  vuelo:     { title: '🦋 Mariposas al Vuelo — Online', build: () => new Vuelo2P(canvas),    uiId: 'vuelo-ui',     apply: v => { vuelo     = v; } },
  corazones: { title: '💖 Lluvia de Corazones — Online',build: () => new Corazones2P(canvas),uiId: 'corazones-ui', apply: v => { corazones = v; } },
  memoria2p: { title: '🎴 Memoria Duelo — Online',      build: () => new Memoria2P(canvas),  uiId: 'memoria2p-ui', apply: v => { memoria2p = v; } },
  tresenraya:{ title: '❌ Tres en Raya — Online',       build: () => new TresEnRaya(canvas), uiId: 'tresenraya-ui',apply: v => { tresenraya = v; } },
  conecta4:  { title: '🔵 Conecta 4 — Online',          build: () => new Conecta4(canvas),   uiId: 'conecta4-ui',  apply: v => { conecta4  = v; } },
  ppt:       { title: '✊ Piedra, Papel o Tijera — Online', build: () => new PiedraPapelTijera(canvas), uiId: 'ppt-ui', apply: v => { ppt = v; } },
  ahorcado:  { title: '🎪 Ahorcado — Online',           build: () => new Ahorcado(canvas),   uiId: 'ahorcado-ui',  apply: v => { ahorcado  = v; } },
};

function _wireOnlineBtn(id, gameKey) {
  const el = document.getElementById(id);
  if (!el) return;
  const open = () => _openOnlineSetup(gameKey);
  el.addEventListener('click', open);
  el.addEventListener('touchend', e => { e.preventDefault(); open(); }, { passive: false });
}
_wireOnlineBtn('versus-pong-online',      'pong');
_wireOnlineBtn('versus-globos-online',    'globos');
_wireOnlineBtn('versus-sumo-online',      'sumo');
_wireOnlineBtn('versus-cocinas-online',   'cocinas');
_wireOnlineBtn('versus-vuelo-online',     'vuelo');
_wireOnlineBtn('versus-corazones-online', 'corazones');
_wireOnlineBtn('versus-memoria-online',   'memoria2p');
_wireOnlineBtn('versus-tresenraya-online','tresenraya');
_wireOnlineBtn('versus-conecta4-online',  'conecta4');
_wireOnlineBtn('versus-ppt-online',       'ppt');
_wireOnlineBtn('versus-ahorcado-online',  'ahorcado');

function _showOnlineStep(stepId) {
  ['online-choose', 'online-waiting', 'online-join-form', 'online-status']
    .forEach(id => document.getElementById(id).classList.toggle('hidden', id !== stepId));
}

function _openOnlineSetup(gameKey) {
  netPendingGameKey = gameKey;
  document.getElementById('online-title').textContent = ONLINE_GAMES[gameKey].title;
  _showOnlineStep('online-choose');
  document.getElementById('hub-screen').classList.add('hidden');
  hideVersusSubmenu();
  document.getElementById('online-setup').classList.remove('hidden');
}

function _closeOnlineSetup() {
  _resetNetState();
  document.getElementById('online-setup').classList.add('hidden');
  showHub('versus-submenu');
}

const ONLINE_ERROR_MESSAGES = {
  'not-found':      'Código no encontrado. Revisalo e intentá de nuevo.',
  'full':           'Esa sala ya tiene dos jugadores.',
  'game-mismatch':  'Ese código es de otro juego.',
  'connect-failed': 'No se pudo conectar. Probá de nuevo.',
};
function _showOnlineError(reason) {
  if (netSession) { netSession.close(); netSession = null; }
  _showOnlineStep('online-status');
  document.getElementById('online-status-msg').textContent = ONLINE_ERROR_MESSAGES[reason] || 'Ocurrió un error.';
  document.getElementById('online-status-back').classList.remove('hidden');
}

function _startOnlineMatch(gameKey, role) {
  netRole = role;
  netGameKey = gameKey;
  document.getElementById('online-setup').classList.add('hidden');
  const g = ONLINE_GAMES[gameKey];
  g.apply(g.build());
  _launchVersus(g.uiId, gameKey);
}

document.getElementById('online-back').addEventListener('click', _closeOnlineSetup);
document.getElementById('online-cancel-wait').addEventListener('click', _closeOnlineSetup);
document.getElementById('online-cancel-join').addEventListener('click', () => _showOnlineStep('online-choose'));
document.getElementById('online-status-back').addEventListener('click', () => _showOnlineStep('online-choose'));

document.getElementById('online-create-btn').addEventListener('click', async () => {
  _resetNetState();
  netSession = new NetSession(netPendingGameKey);
  _showOnlineStep('online-waiting');
  document.getElementById('online-code-display').textContent = '····';
  netSession.onCode     = code => { document.getElementById('online-code-display').textContent = code; };
  netSession.onReady    = role => _startOnlineMatch(netPendingGameKey, role);
  netSession.onPeerLeft = () => _showOnlineDisconnect();
  netSession.onError    = reason => _showOnlineError(reason);
  netSession.onMessage  = data => _handleNetMessage(data);
  try { await netSession.createRoom(); } catch { _showOnlineError('connect-failed'); }
});

document.getElementById('online-join-btn').addEventListener('click', () => {
  _showOnlineStep('online-join-form');
  const input = document.getElementById('online-code-input');
  input.value = '';
  setTimeout(() => input.focus(), 50);
});

document.getElementById('online-join-confirm').addEventListener('click', async () => {
  const code = document.getElementById('online-code-input').value.trim().toUpperCase();
  if (code.length !== 4) { alert('Ingresá el código de 4 letras/números'); return; }
  _resetNetState();
  netSession = new NetSession(netPendingGameKey);
  _showOnlineStep('online-status');
  document.getElementById('online-status-msg').textContent = 'Conectando…';
  document.getElementById('online-status-back').classList.add('hidden');
  netSession.onReady    = role => _startOnlineMatch(netPendingGameKey, role);
  netSession.onPeerLeft = () => _showOnlineDisconnect();
  netSession.onError    = reason => _showOnlineError(reason);
  netSession.onMessage  = data => _handleNetMessage(data);
  try { await netSession.joinRoom(code); } catch { _showOnlineError('connect-failed'); }
});

function _handleNetMessage(data) {
  const g = _active2P(); if (!g) return;
  if (data.k === 's') {
    netSnapshots.push({ recvT: performance.now(), s: data.s });
    // Drop snapshots that fall entirely before the current render window,
    // keeping one extra as the left bracket for interpolation.
    const cutoff = performance.now() - NET_RENDER_DELAY_MS - (1000 / NET_STATE_HZ) * 2;
    while (netSnapshots.length > 2 && netSnapshots[1].recvT < cutoff) netSnapshots.shift();
    _updateNetScale(data.s.W, data.s.H);
  } else if (data.k === 'i' && netRole === 'host') {
    if (data.op === 'd') g.pointerDown(data.x, data.y, 'p2');
    else if (data.op === 'm') g.pointerMove(data.x, data.y, 'p2');
    else if (data.op === 'u') g.pointerUp('p2');
  }
}

const ONLINE_EXIT_FNS = {
  pong: () => exitPong(), globos: () => exitGlobos(), sumo: () => exitSumo(),
  cocinas: () => exitCocinas(), vuelo: () => exitVuelo(),
  corazones: () => exitCorazones(), memoria2p: () => exitMemoria2P(),
  tresenraya: () => exitTresEnRaya(), conecta4: () => exitConecta4(),
  ppt: () => exitPPT(), ahorcado: () => exitAhorcado(),
};
document.getElementById('online-disconnect-back').addEventListener('click', () => {
  document.getElementById('online-disconnect-banner').classList.add('hidden');
  const exitFn = ONLINE_EXIT_FNS[netGameKey];
  if (exitFn) exitFn();
});

const pongExitBtn    = document.getElementById('pong-exit');
const globosExitBtn  = document.getElementById('globos-exit');
const sumoExitBtn    = document.getElementById('sumo-exit');
const cocinasExitBtn = document.getElementById('cocinas-exit');
if (pongExitBtn)    pongExitBtn.addEventListener('click',    exitPong);
if (globosExitBtn)  globosExitBtn.addEventListener('click',  exitGlobos);
if (sumoExitBtn)    sumoExitBtn.addEventListener('click',    exitSumo);
if (cocinasExitBtn) cocinasExitBtn.addEventListener('click', exitCocinas);
const vueloExitBtn     = document.getElementById('vuelo-exit');
const corazonesExitBtn = document.getElementById('corazones-exit');
const memoria2pExitBtn = document.getElementById('memoria2p-exit');
if (vueloExitBtn)     vueloExitBtn.addEventListener('click',     exitVuelo);
if (corazonesExitBtn) corazonesExitBtn.addEventListener('click', exitCorazones);
if (memoria2pExitBtn) memoria2pExitBtn.addEventListener('click', exitMemoria2P);
const tresenrayaExitBtn = document.getElementById('tresenraya-exit');
const conecta4ExitBtn   = document.getElementById('conecta4-exit');
const pptExitBtn        = document.getElementById('ppt-exit');
const ahorcadoExitBtn   = document.getElementById('ahorcado-exit');
if (tresenrayaExitBtn) tresenrayaExitBtn.addEventListener('click', exitTresEnRaya);
if (conecta4ExitBtn)   conecta4ExitBtn.addEventListener('click',   exitConecta4);
if (pptExitBtn)        pptExitBtn.addEventListener('click',        exitPPT);
if (ahorcadoExitBtn)   ahorcadoExitBtn.addEventListener('click',   exitAhorcado);

window.addEventListener('keydown', e => {
  if (e.code !== 'Escape') return;
  if      (mode === 'pong'    && pong)   { exitPong();    e.preventDefault(); }
  else if (mode === 'globos'  && globos) { exitGlobos();  e.preventDefault(); }
  else if (mode === 'sumo'    && sumo)   { exitSumo();    e.preventDefault(); }
  else if (mode === 'cocinas' && cocinas){ exitCocinas(); e.preventDefault(); }
  else if (mode === 'vuelo'   && vuelo)  { exitVuelo();   e.preventDefault(); }
  else if (mode === 'corazones' && corazones) { exitCorazones(); e.preventDefault(); }
  else if (mode === 'memoria2p' && memoria2p) { exitMemoria2P(); e.preventDefault(); }
  else if (mode === 'tresenraya' && tresenraya) { exitTresEnRaya(); e.preventDefault(); }
  else if (mode === 'conecta4' && conecta4) { exitConecta4(); e.preventDefault(); }
  else if (mode === 'ppt'     && ppt)     { exitPPT();      e.preventDefault(); }
  else if (mode === 'ahorcado' && ahorcado) { exitAhorcado(); e.preventDefault(); }
  else if (mode === 'tres'    && tres)   { exitTres();    e.preventDefault(); }
  else if (mode === 'cuatro'  && cuatro) { exitCuatro();  e.preventDefault(); }
});

// ── 3-Players submenu buttons ─────────────────────────────────────────────────
const tresBack = document.getElementById('tres-back');
if (tresBack) tresBack.addEventListener('click', () => { hideTresSubmenu(); document.getElementById('hub-screen').classList.remove('hidden'); });
[['tres-go-carrera', 'carrera'], ['tres-go-reflejos', 'reflejos'], ['tres-go-bomba', 'bomba'], ['tres-go-estrellas', 'estrellas'],
 ['tres-go-globo', 'globo'], ['tres-go-baile', 'baile'], ['tres-go-memoria', 'memoria'], ['tres-go-centro', 'centro']].forEach(([id, m]) => {
  const btn = document.getElementById(id);
  if (!btn) return;
  const go = () => launchTres(m);
  btn.addEventListener('click', go);
  btn.addEventListener('touchend', e => { e.preventDefault(); go(); }, { passive: false });
});
const tresExitBtn = document.getElementById('tres-exit');
if (tresExitBtn) tresExitBtn.addEventListener('click', exitTres);

// Player buttons: pointerdown (not click) so taps feel instant in the tap races
for (let i = 0; i < 3; i++) {
  const btn = document.getElementById(`tres-btn-${i}`);
  if (btn) btn.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (mode === 'tres' && tres) tres.press(i);
  });
}
// Keyboard: A / Space / L map to players 1 / 2 / 3
window.addEventListener('keydown', e => {
  if (mode !== 'tres' || !tres || e.repeat) return;
  if      (e.code === 'KeyA')  { tres.press(0); e.preventDefault(); }
  else if (e.code === 'Space') { tres.press(1); e.preventDefault(); }
  else if (e.code === 'KeyL')  { tres.press(2); e.preventDefault(); }
});

// ── 1-Player submenu buttons ──────────────────────────────────────────────────
const unoBack = document.getElementById('uno-back');
if (unoBack) unoBack.addEventListener('click', () => { hideUnoSubmenu(); document.getElementById('hub-screen').classList.remove('hidden'); });
[['uno-match3', launchMatch3], ['uno-mob', launchMob], ['uno-galaga', launchGalaga]].forEach(([id, launch]) => {
  const btn = document.getElementById(id);
  if (!btn) return;
  const go = () => { hideUnoSubmenu(); launch(); };
  btn.addEventListener('click', go);
  btn.addEventListener('touchend', e => { e.preventDefault(); go(); }, { passive: false });
});

// ── 4-Players submenu buttons ─────────────────────────────────────────────────
const cuatroBack = document.getElementById('cuatro-back');
if (cuatroBack) cuatroBack.addEventListener('click', () => { hideCuatroSubmenu(); document.getElementById('hub-screen').classList.remove('hidden'); });
[['cuatro-go-soga', 'soga'], ['cuatro-go-caramelos', 'caramelos'], ['cuatro-go-sillas', 'sillas'], ['cuatro-go-jardin', 'jardin']].forEach(([id, m]) => {
  const btn = document.getElementById(id);
  if (!btn) return;
  const go = () => launchCuatro(m);
  btn.addEventListener('click', go);
  btn.addEventListener('touchend', e => { e.preventDefault(); go(); }, { passive: false });
});
const cuatroExitBtn = document.getElementById('cuatro-exit');
if (cuatroExitBtn) cuatroExitBtn.addEventListener('click', exitCuatro);

for (let i = 0; i < 4; i++) {
  const btn = document.getElementById(`cuatro-btn-${i}`);
  if (btn) btn.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (mode === 'cuatro' && cuatro) cuatro.press(i);
  });
}
// Keyboard: A / F / J / L map to players 1 / 2 / 3 / 4
window.addEventListener('keydown', e => {
  if (mode !== 'cuatro' || !cuatro || e.repeat) return;
  if      (e.code === 'KeyA') { cuatro.press(0); e.preventDefault(); }
  else if (e.code === 'KeyF') { cuatro.press(1); e.preventDefault(); }
  else if (e.code === 'KeyJ') { cuatro.press(2); e.preventDefault(); }
  else if (e.code === 'KeyL') { cuatro.press(3); e.preventDefault(); }
});

// Hub (game chooser)
document.querySelectorAll('.hub-card').forEach(card => {
  if (card.closest('#hole-submenu'))   return;
  if (card.closest('#uno-submenu'))    return;
  if (card.closest('#versus-submenu')) return;
  if (card.closest('#tres-submenu'))   return;
  if (card.closest('#cuatro-submenu')) return;
  const go = () => {
    const g = card.dataset.game;
    if (g === 'runner') launchRunner();
    else if (g === 'cocina')  launchCocina();
    else if (g === 'match3')  launchMatch3();
    else if (g === 'hole')    showHoleSubmenu();
    else if (g === 'galaga')  launchGalaga();
    else if (g === 'helado')  launchHelado();
    else if (g === 'tienda')  launchTienda();
    else if (g === 'mob')     launchMob();
    else if (g === 'uno')     showUnoSubmenu();
    else if (g === 'versus')  showVersusSubmenu();
    else if (g === 'tres')    showTresSubmenu();
    else if (g === 'cuatro')  showCuatroSubmenu();
    else launchWorld();
  };
  card.addEventListener('click', go);
  card.addEventListener('touchend', e => { e.preventDefault(); go(); }, { passive: false });
});
const selBack = document.getElementById('select-back');
if (selBack) selBack.addEventListener('click', () => {
  document.getElementById('select-screen').classList.add('hidden');
  document.getElementById('hub-screen').classList.remove('hidden');
});

document.getElementById('back-btn').addEventListener('click', stopGame);
document.getElementById('back-btn').addEventListener('touchend', e => {
  e.preventDefault();
  stopGame();
}, { passive: false });

// Persist state periodically and when leaving the page
setInterval(saveState, 2000);
window.addEventListener('beforeunload', saveState);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveState(); });

// ── Bootstrap ──────────────────────────────────────────────────────────────
const loading = document.getElementById('loading');
loading.classList.add('hidden');
setTimeout(() => loading.remove(), 600);

syncCustActive();
onSpriteReady(() => { drawSelectionPreviews(); updateHUDPortrait(); });
drawSelectionPreviews();

// Start at the game-chooser hub (kept visible by default in the HTML)
