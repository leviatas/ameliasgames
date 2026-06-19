import { World }               from './World.js';
import { Interior, INTERIOR_W, INTERIOR_H, interiorDepthScale } from './Interior.js';
import { Character, onSpriteReady, DEFAULT_CFG } from './Character.js';
import { Controls }              from './Controls.js';
import { TouchControls }         from './TouchControls.js';
import { Runner }                from './Runner.js';
import { Cocina }                from './Cocina.js';

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
let mode     = 'exterior';   // 'exterior' | 'interior' | 'runner' | 'cocina'
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
  savedPos = { x: character.x, y: character.y };
  fadeToBlack(() => {
    interior = new Interior(house._wall, house._roof);
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
let runnerFrom = 'tv';   // 'tv' (from a house) | 'hub' (standalone)

function showHub() {
  if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
  inGame = false;
  mode   = 'exterior';
  runner = null;
  cocina = null;
  hideGestureMenu();
  document.getElementById('cust-panel').classList.add('hidden');
  document.getElementById('runner-ui').classList.add('hidden');
  document.getElementById('cocina-ui').classList.add('hidden');
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('select-screen').classList.add('hidden');
  document.getElementById('hub-screen').classList.remove('hidden');
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
  document.getElementById('hub-screen').classList.add('hidden');
  document.getElementById('select-screen').classList.add('hidden');
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('cocina-ui').classList.remove('hidden');
  cocina = new Cocina(canvas);
  mode   = 'cocina';
  lastTime = performance.now();
  if (!animFrameId) animFrameId = requestAnimationFrame(gameLoop);
}
function exitCocina() {
  document.getElementById('cocina-ui').classList.add('hidden');
  cocina = null;
  showHub();
}

// ── Dog runner mini-game ─────────────────────────────────────────────────────
function enterRunner() {              // launched from the TV inside a house
  if (mode !== 'interior') return;
  hideGestureMenu();
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
  if (mode === 'runner' && runner) { runner.update(delta); runner.render(ctx); return; }
  if (mode === 'cocina' && cocina) { cocina.update(delta); cocina.render(ctx); return; }
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
            character.y = bed.y;
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

// ── Click: tap character → gesture menu, else tap house → enter ─────────────
canvas.addEventListener('click', e => {
  if (fadingIn || fadingOut) return;
  if (mode === 'cocina' || mode === 'runner') return;   // these modes handle their own input
  const rect  = canvas.getBoundingClientRect();
  const worldX = (e.clientX - rect.left)  / cam.zoom + cam.x;
  const worldY = (e.clientY - rect.top)   / cam.zoom + cam.y;
  if (mode === 'interior' && interior && interior.containsTV(worldX, worldY)) { enterRunner(); return; }
  if (characterAt(worldX, worldY)) { showGestureMenu(); return; }
  hideGestureMenu();
  if (mode !== 'exterior' || !world) return;
  const house = world.getHouseAt(worldX, worldY, WORLD_H);
  if (house) enterHouse(house);
});

// Touch tap: same behaviour
canvas.addEventListener('touchend', e => {
  if (fadingIn || fadingOut) return;
  if (mode === 'cocina' || mode === 'runner') return;   // these modes handle their own input
  const t     = e.changedTouches[0];
  const rect  = canvas.getBoundingClientRect();
  const worldX = (t.clientX - rect.left) / cam.zoom + cam.x;
  const worldY = (t.clientY - rect.top)  / cam.zoom + cam.y;
  if (mode === 'interior' && interior && interior.containsTV(worldX, worldY)) { e.preventDefault(); enterRunner(); return; }
  if (characterAt(worldX, worldY)) { e.preventDefault(); showGestureMenu(); return; }
  hideGestureMenu();
  if (mode !== 'exterior' || !world) return;
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

// ── Customization panel ─────────────────────────────────────────────────────
const custPanel = document.getElementById('cust-panel');
function openCust()  { custPanel.classList.remove('hidden'); }
function closeCust() { custPanel.classList.add('hidden'); }
['cust-btn', 'customize-btn'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', openCust);
});
const custClose = document.getElementById('cust-close');
if (custClose) custClose.addEventListener('click', closeCust);

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
  closeCust();
  document.getElementById('select-screen').classList.add('hidden');
  startGame();
}
const playBtn = document.getElementById('play-btn');
playBtn.addEventListener('click', beginPlay);
playBtn.addEventListener('touchend', e => { e.preventDefault(); beginPlay(); }, { passive: false });

// Hub (game chooser)
document.querySelectorAll('.hub-card').forEach(card => {
  const go = () => {
    const g = card.dataset.game;
    if (g === 'runner') launchRunner();
    else if (g === 'cocina') launchCocina();
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
