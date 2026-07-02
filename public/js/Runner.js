// ── Endless runner mini-game (the dog 🐕) ───────────────────────────────────
// Launched from the TV inside a house. Auto-runs forward; jump / duck to dodge.
import { addCoins } from './Wallet.js';

function lerp(a, b, t) { return a + (b - a) * t; }
function lerpHex(h1, h2, t) {
  const a = [parseInt(h1.slice(1,3),16), parseInt(h1.slice(3,5),16), parseInt(h1.slice(5,7),16)];
  const b = [parseInt(h2.slice(1,3),16), parseInt(h2.slice(3,5),16), parseInt(h2.slice(5,7),16)];
  return `rgb(${Math.round(lerp(a[0],b[0],t))},${Math.round(lerp(a[1],b[1],t))},${Math.round(lerp(a[2],b[2],t))})`;
}
function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function roman(n) {
  const map = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
  let s = '';
  for (const [v, sym] of map) while (n >= v) { s += sym; n -= v; }
  return s || 'I';
}

const LEVEL_M = 1600;   // metres per level (longer levels)

// Obstacle sprites (cut from the uploaded art)
const OB_IMG = {};
['ob_forest_0','ob_forest_1','ob_city_0','ob_city_1','ob_city_2'].forEach(n => {
  const im = new Image(); im.src = '/assets/' + n + '.png'; OB_IMG[n] = im;
});

// Scenarios — cycle one per level; each restyles obstacles + background
const SCENARIOS = [
  { name:'Bosque',   kind:'day',    skyTop:'#9BD9F0', skyBot:'#E6F7FF', ground:'#5FBF44', groundDark:'#46962F', hill:'#9BE08A',
    lows:[{img:'ob_forest_0',h:66},{img:'ob_forest_1',h:58}], hole:'water',     plat:'wood'      },
  { name:'Ciudad',   kind:'day',    skyTop:'#AEB9C8', skyBot:'#E9EEF4', ground:'#9A9AA2', groundDark:'#74747E', hill:'#C2C6CE',
    lows:[{img:'ob_city_0',h:46},{img:'ob_city_1',h:54},{img:'ob_city_2',h:62}], hole:'stones', plat:'stone'     },
  { name:'Desierto', kind:'desert', skyTop:'#C86020', skyBot:'#F0B048', ground:'#C89A50', groundDark:'#A07832', hill:'#C8A868',
    lows:[{kind:'cactus',h:68},{kind:'cactus',h:52},{kind:'rock',h:44}], hole:'quicksand', plat:'sandstone' },
  { name:'Cueva',    kind:'cave',   skyTop:'#141020', skyBot:'#1E1A2C', ground:'#3A3040', groundDark:'#24202E', hill:'#24203C',
    lows:[{kind:'stalagmite',h:62},{kind:'stalagmite',h:46},{kind:'boulder',h:48}], hole:'pit', plat:'crystal'  },
];

const GRAV = 2700, JUMP_V = 600;   // lower, snappier jump
const SPEED = 430;                 // constant speed (does not ramp up)
const GROUND = '#5FBF44', GROUND_DARK = '#46962F';   // floor is the SAME in every scenario

// Runner character sprites (Labubu): 0/1/2 = run cycle, 3 = duck/crouch
const HERO_FRAMES = ['/assets/labubu_0.png','/assets/labubu_1.png','/assets/labubu_2.png','/assets/labubu_3.png']
  .map(src => { const im = new Image(); im.src = src; return im; });
let HERO_READY = false, _heroLoaded = 0;
HERO_FRAMES.forEach(im => { im.onload = () => { if (++_heroLoaded === HERO_FRAMES.length) HERO_READY = true; }; });

export class Runner {
  constructor(canvas) {
    this.canvas = canvas;
    this.stars = Array.from({ length: 60 }, () => ({ x: Math.random(), y: Math.random()*0.6, r: 0.6+Math.random()*1.6 }));
    this.clouds = Array.from({ length: 5 }, () => ({ x: Math.random(), y: 0.1+Math.random()*0.3, s: 0.6+Math.random()*0.8 }));
    this.best = +(localStorage.getItem('runner_best') || 0);
    this.hearts = +(localStorage.getItem('runner_hearts') || 0);   // all-time collected hearts 💜
    this.reset();
  }

  reset() {
    this.t = 0; this.dist = 0;                                  // continuous scroll for visuals
    this.savedLevel = +(localStorage.getItem('runner_level') || 0);  // highest level unlocked
    this.startLevel(this.savedLevel);                           // resume at the last level reached
  }

  // Set up a fresh run of a single level (does NOT reset the visual scroll)
  startLevel(lvl) {
    this.level = lvl; this.speed = SPEED;
    this.curScene = SCENARIOS[lvl % SCENARIOS.length];
    this.prevScene = this.curScene; this.sceneBlend = 1;
    this.levelDist = 0;
    this.dog = { y: 0, vy: 0, onGround: true, ducking: false, platform: null, jumpsLeft: 2 };
    this.obstacles = []; this.spawnTimer = 1.0;
    this.coins = []; this.coinTimer = 1.4;                      // collectible hearts 💜
    this.particles = []; this.wasAir = false; this.heartsLevel = 0;
    this.boostTime = 0; this.falling = false;
    this.finishSpawned = false; this.finished = false; this.finishWait = 0;
    this.gameOver = false; this.deadFlash = 0;
    this.levelFlash = 1.8;                                      // "Nivel N · escenario" intro
  }

  get levelLen() { return LEVEL_M * 10; }   // metres → internal dist units

  // ── Input ──
  jump() {
    if (this.finished) { if (this.finishWait > 0.5) this.startLevel(this.level + 1); return; }   // next level
    if (this.gameOver) { if (this.deadFlash > 0.4) this.startLevel(this.savedLevel); return; }    // retry current
    if (this.dog.jumpsLeft > 0) {
      const G = this._geom();
      const isDouble = !this.dog.onGround;
      this.dog.vy = -JUMP_V * G.scale;
      this.dog.jumpsLeft--;
      if (isDouble) {
        this._doubleJumpFX(G.dogX, G.groundY + this.dog.y, G.scale);
      } else {
        this.dog.onGround = false; this.dog.platform = null;
        this._dust(G.dogX, G.groundY + this.dog.y, G.scale);
      }
    }
  }
  setDuck(on) { if (!this.gameOver && !this.finished) this.dog.ducking = on; }
  _die() { this.gameOver = true; this.deadFlash = 0; }
  _completeLevel() {
    this.finished = true; this.finishWait = 0;
    this.dog.y = 0; this.dog.vy = 0; this.dog.onGround = true; this.dog.jumpsLeft = 2; this.falling = false; this.dog.ducking = false;
    const next = this.level + 1;
    if (next > this.savedLevel) { this.savedLevel = next; try { localStorage.setItem('runner_level', next); } catch(e){} }
  }

  _geom() {
    const W = this.canvas.width, H = this.canvas.height;
    return { W, H, groundY: Math.round(H * 0.80), scale: Math.max(0.7, H / 620), dogX: Math.max(90, W * 0.18) };
  }

  _dogBox(G) {
    const sc = G.scale, w = 70*sc, h = this.dog.ducking ? 30*sc : 50*sc;
    const feetY = G.groundY + this.dog.y;
    return { x: G.dogX - w*0.45, y: feetY - h, w, h };
  }
  _lowDims(o, G) {
    const sc = G.scale;
    const h = (o.oh || 50) * sc;
    if (o.kind) {
      const kw = { cactus: 28, rock: 56, stalagmite: 22, boulder: 56 };
      return { w: (kw[o.kind] || 36) * sc, h };
    }
    const im = OB_IMG[o.imgName];
    const w = (im && im.naturalHeight) ? im.naturalWidth * (h / im.naturalHeight) : 40*sc;
    return { w, h };
  }
  _obsBox(o, G) {
    const sc = G.scale;
    if (o.type === 'low') {
      const d = this._lowDims(o, G);
      const hbw = d.w * 0.7, hbh = d.h * 0.86;          // forgiving hitbox
      return { x: o.x + (d.w - hbw)/2, y: G.groundY - hbh, w: hbw, h: hbh };
    }
    if (o.type === 'platform') return { x: o.x, y: G.groundY - 50*sc, w: 165*sc, h: 15*sc }; // long: jump on / duck under
    if (o.type === 'hole')     return { x: o.x, y: G.groundY, w: o.w, h: 10*sc };
    return { x: o.x, y: G.groundY - 36*sc, w: 34*sc, h: 32*sc };                              // skate pickup
  }

  _spawn(G) {
    const r = Math.random();
    let type;
    if (r < 0.10)      type = 'skate';
    else if (r < 0.46) type = 'low';
    else if (r < 0.72) type = 'platform';
    else               type = 'hole';
    const o = { x: G.W + 40, type, seed: Math.random(), scene: this.curScene };
    if (type === 'hole') o.w = (80 + Math.random()*55) * G.scale;
    if (type === 'low')  { const p = this.curScene.lows[Math.floor(Math.random()*this.curScene.lows.length)]; if (p.img) o.imgName = p.img; else o.kind = p.kind; o.oh = p.h; }
    this.obstacles.push(o);
  }

  // Collectible hearts 💜 — single row or a jump-arc of a few
  _spawnCoins(G) {
    const sc = G.scale, n = 1 + Math.floor(Math.random()*4);
    const arc = Math.random() < 0.5;                  // arc → encourages a jump
    const baseY = G.groundY - (arc ? 70 : 22 + Math.random()*80) * sc;
    const gap = 30*sc, x0 = G.W + 40;
    for (let i = 0; i < n; i++) {
      let y = baseY;
      if (arc) { const t = n > 1 ? i/(n-1) : 0.5; y = G.groundY - (50 + Math.sin(t*Math.PI)*70) * sc; }
      this.coins.push({ x: x0 + i*gap, y, seed: Math.random(), got: false });
    }
  }

  _dust(x, feetY, sc) {
    for (let i = 0; i < 7; i++) {
      this.particles.push({
        x: x - 12*sc + Math.random()*24*sc, y: feetY,
        vx: -(30 + Math.random()*70)*sc, vy: -(20 + Math.random()*70)*sc,
        life: 0, max: 0.35 + Math.random()*0.25, size: (3 + Math.random()*3)*sc,
        grav: 280*sc, kind: 'dust',
      });
    }
  }
  _doubleJumpFX(x, feetY, sc) {
    const colors = ['#C080FF', '#FF80E0', '#80C0FF', '#FFFFFF'];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const sp = (60 + Math.random() * 80) * sc;
      this.particles.push({
        x: x + Math.cos(a) * 10 * sc, y: feetY - 14 * sc,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 50 * sc,
        life: 0, max: 0.38 + Math.random() * 0.22, size: (2.5 + Math.random() * 3) * sc,
        grav: 120 * sc, kind: 'spark', color: colors[i % colors.length],
      });
    }
  }
  _heartBurst(x, y, sc) {
    for (let i = 0; i < 9; i++) {
      const a = Math.random()*Math.PI*2, sp = (40 + Math.random()*90)*sc;
      this.particles.push({
        x, y, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp - 40*sc,
        life: 0, max: 0.5 + Math.random()*0.3, size: (3 + Math.random()*4)*sc,
        grav: 60*sc, kind: 'spark',
      });
    }
  }
  _drawCoin(ctx, cx, cy, r) {
    ctx.save();
    ctx.fillStyle = '#C8881A'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();          // rim
    ctx.fillStyle = '#FFD23A'; ctx.beginPath(); ctx.arc(cx, cy, r*0.78, 0, Math.PI*2); ctx.fill();      // face
    ctx.fillStyle = '#C8881A'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `900 ${r*1.15}px system-ui, sans-serif`; ctx.fillText('$', cx, cy + r*0.08);
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.arc(cx - r*0.34, cy - r*0.36, r*0.2, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
  _drawHeart(ctx, cx, cy, r, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(cx - r*0.5, cy - r*0.32, r*0.55, 0, Math.PI*2);
    ctx.arc(cx + r*0.5, cy - r*0.32, r*0.55, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - r*1.0, cy - r*0.05);
    ctx.lineTo(cx + r*1.0, cy - r*0.05);
    ctx.lineTo(cx, cy + r*0.95);
    ctx.closePath(); ctx.fill();
  }

  update(dt) {
    const G = this._geom();
    if (this.finished) { this.finishWait += dt; this.t += dt; return; }   // celebrate, world frozen
    if (this.gameOver) { this.deadFlash += dt; this.t += dt; return; }

    // falling into a pit (hole) — drop, then game over
    if (this.falling) {
      this.t += dt;
      this.dog.vy += GRAV * G.scale * dt; this.dog.y += this.dog.vy * dt;
      if (this.dog.y > 180 * G.scale) this._die();
      return;
    }

    this.t += dt;
    if (this.boostTime > 0) this.boostTime = Math.max(0, this.boostTime - dt);
    const boosting = this.boostTime > 0;
    const eff = this.speed * (boosting ? 1.7 : 1);   // skates speed-up

    this.dist += eff * dt;        // never-reset scroll (parallax / dashes)
    this.levelDist += eff * dt;   // progress within this level (0 → 400 m)

    // spawn the finish gate once the level distance is covered
    if (!this.finishSpawned && this.levelDist >= this.levelLen) {
      this.finishSpawned = true;
      this.obstacles.push({ x: G.W + 80, type: 'finish', scene: this.curScene });
    }

    if (this.sceneBlend < 1) this.sceneBlend = Math.min(1, this.sceneBlend + dt * 0.7);
    if (this.levelFlash > 0) this.levelFlash -= dt;

    const dog = this.dog;
    const prevAir = !dog.onGround;
    const feetPrev = G.groundY + dog.y;
    if (!dog.onGround) { dog.vy += GRAV * G.scale * dt; dog.y += dog.vy * dt; }
    let feet = G.groundY + dog.y;

    // ── Floating platforms: land on top from above, ride along ──
    let onPlat = null;
    for (const o of this.obstacles) {
      if (o.type !== 'platform') continue;
      const b = this._obsBox(o, G), top = b.y;
      const within = G.dogX >= b.x && G.dogX <= b.x + b.w;
      if (within && dog.vy >= 0 && feetPrev <= top + 2 && feet >= top) {
        dog.y = top - G.groundY; dog.vy = 0; dog.onGround = true; dog.jumpsLeft = 2; feet = top; onPlat = o;
      }
      if (dog.platform === o && within) { dog.y = top - G.groundY; dog.vy = 0; dog.onGround = true; dog.jumpsLeft = 2; feet = top; onPlat = o; }
    }
    if (onPlat) dog.platform = onPlat;
    else if (dog.platform) {            // walked off the edge or it vanished
      const b = this._obsBox(dog.platform, G);
      const within = G.dogX >= b.x && G.dogX <= b.x + b.w && this.obstacles.includes(dog.platform);
      if (!within) { dog.platform = null; if (dog.y < 0) dog.onGround = false; }
    }
    // ground landing — unless there's a hole right under the feet (skates fly over holes)
    const overHole = !boosting && this.obstacles.some(o => o.type === 'hole' && G.dogX > o.x + 6 && G.dogX < o.x + o.w - 6);
    if (!dog.platform) {
      if (overHole) {
        if (dog.y >= -1) { this.falling = true; dog.onGround = false; if (dog.vy < 0) dog.vy = 0; }
      } else if (dog.y >= 0) { dog.y = 0; dog.vy = 0; dog.onGround = true; dog.jumpsLeft = 2; }
    }

    // landing puff (came down onto ground or a platform)
    if (prevAir && dog.onGround && !this.falling) this._dust(G.dogX, feet, G.scale);

    // spawn — stop early so there's a clean runway up to the finish line
    const nearEnd = this.levelDist >= this.levelLen - 700;
    if (!nearEnd) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this._spawn(G);
        this.spawnTimer = 0.9 + Math.random() * 0.7;   // constant pacing
      }
      this.coinTimer -= dt;
      if (this.coinTimer <= 0) {
        this._spawnCoins(G);
        this.coinTimer = 1.3 + Math.random() * 1.4;
      }
    }

    // move + cull (drop platform ref if it leaves)
    for (const o of this.obstacles) o.x -= eff * dt;
    this.obstacles = this.obstacles.filter(o => { if (o.x > -180) return true; if (dog.platform === o) dog.platform = null; return false; });

    // hearts: scroll, collect on overlap, cull
    const db0 = this._dogBox(G), hr = 16 * G.scale;
    for (const c of this.coins) {
      c.x -= eff * dt;
      if (!c.got && c.x > db0.x - hr && c.x < db0.x + db0.w + hr && c.y > db0.y - hr && c.y < db0.y + db0.h + hr) {
        c.got = true; this.hearts++; this.heartsLevel++;
        try { localStorage.setItem('runner_hearts', this.hearts); } catch(e){}
        addCoins(1);
        this._heartBurst(c.x, c.y, G.scale);
      }
    }
    this.coins = this.coins.filter(c => !c.got && c.x > -40);

    // particles
    for (const p of this.particles) {
      p.life += dt;
      if (p.grav) p.vy += p.grav * dt;
      p.x += p.vx * dt - eff * dt; p.y += p.vy * dt;
    }
    this.particles = this.particles.filter(p => p.life < p.max);

    // finish line reached the runner → level complete
    for (const o of this.obstacles) { if (o.type === 'finish' && o.x <= G.dogX) { this._completeLevel(); return; } }

    // collisions + pickups
    const db = this._dogBox(G);
    for (let k = this.obstacles.length - 1; k >= 0; k--) {
      const o = this.obstacles[k];
      if (o.type === 'hole' || o.type === 'finish') continue;   // holes via fall logic; finish is harmless
      const b = this._obsBox(o, G);
      if (!aabb(db, b)) continue;
      if (o.type === 'skate')      { this.boostTime = 5; this.obstacles.splice(k, 1); continue; }
      if (o.type === 'platform')   {
        // Sólo muere al chocar de frente contra el costado de la plataforma;
        // bajarse por el borde (la caja aún se solapa mientras cae) no mata.
        const frontHit = db.x + db.w < b.x + 30 * G.scale;
        if (dog.platform !== o && frontHit && feet > b.y + 4 && !boosting) { this._die(); }
        continue;
      }
      // low / high obstacle
      if (boosting) { this.obstacles.splice(k, 1); }   // invulnerable → smash through
      else { this._die(); break; }
    }
  }

  // ── Render ──
  render(ctx) {
    const G = this._geom(); const { W, H, groundY, scale, dogX } = G;
    const A = this.prevScene, Bs = this.curScene, bf = this.sceneBlend;
    const skyTop = lerpHex(A.skyTop, Bs.skyTop, bf);
    const skyBot = lerpHex(A.skyBot, Bs.skyBot, bf);
    const grnd   = lerpHex(A.ground, Bs.ground, bf);
    const grndD  = lerpHex(A.groundDark, Bs.groundDark, bf);
    const hill   = lerpHex(A.hill, Bs.hill, bf);
    const night  = false;

    // sky
    const sg = ctx.createLinearGradient(0, 0, 0, groundY);
    sg.addColorStop(0, skyTop); sg.addColorStop(1, skyBot);
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, groundY);

    // sky decorations — scene-specific
    if (Bs.kind === 'cave') {
      // floating crystals on cave ceiling
      const crystalCols = ['#6040C0','#4060E0','#8050D0','#5070E8'];
      for (let i = 0; i < 7; i++) {
        const cx = ((i * W / 6.5 + this.dist * 0.06) % W + W) % W;
        const cy = groundY * (0.12 + (i % 3) * 0.12);
        const cr = (5 + (i % 3) * 3) * scale;
        ctx.save();
        ctx.globalAlpha = 0.28 + 0.14 * Math.sin(this.t * 1.8 + i * 1.1);
        ctx.fillStyle = crystalCols[i % 4];
        ctx.beginPath();
        ctx.moveTo(cx, cy - cr * 2.4); ctx.lineTo(cx + cr * 0.65, cy); ctx.lineTo(cx, cy + cr * 0.7); ctx.lineTo(cx - cr * 0.65, cy);
        ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 0.10 + 0.05 * Math.sin(this.t * 2 + i);
        ctx.fillStyle = '#A090FF';
        ctx.beginPath(); ctx.arc(cx, cy - cr * 0.8, cr * 2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      // bats
      for (let i = 0; i < 4; i++) {
        const bx = ((i * W * 0.26 + this.dist * (0.07 + i * 0.03)) % W + W) % W;
        const by = groundY * (0.36 + Math.sin(this.t * (1.1 + i * 0.2) + i * 0.8) * 0.14 + i * 0.06);
        const flap = Math.sin(this.t * 8 + i * 1.5);
        ctx.save(); ctx.globalAlpha = 0.45; ctx.fillStyle = '#120C1A';
        ctx.beginPath(); ctx.ellipse(bx, by, 4*scale, 2.5*scale, 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(bx-4*scale,by); ctx.quadraticCurveTo(bx-11*scale, by-5*scale*flap, bx-13*scale, by+2*scale); ctx.quadraticCurveTo(bx-8*scale, by+2*scale, bx-4*scale, by); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(bx+4*scale,by); ctx.quadraticCurveTo(bx+11*scale, by-5*scale*flap, bx+13*scale, by+2*scale); ctx.quadraticCurveTo(bx+8*scale, by+2*scale, bx+4*scale, by); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    } else if (Bs.kind === 'desert') {
      // scorching sun with corona
      ctx.save();
      ctx.globalAlpha = 0.35; ctx.fillStyle = '#FFB020';
      ctx.beginPath(); ctx.arc(W*0.80, groundY*0.20, 50*scale, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1; ctx.fillStyle = '#FFE050';
      ctx.beginPath(); ctx.arc(W*0.80, groundY*0.20, 36*scale, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      // heat shimmer near horizon
      ctx.save();
      for (let i = 0; i < 5; i++) {
        const hy = groundY * (0.72 + i * 0.055);
        const w0 = Math.sin(this.t * (2.5 + i * 0.4) + i * 1.2) * (7 + i * 3) * scale;
        ctx.strokeStyle = `rgba(255,${155 + i * 10},40,${0.055 - i * 0.008})`;
        ctx.lineWidth = (2.5 - i * 0.35) * scale;
        ctx.beginPath(); ctx.moveTo(0, hy);
        ctx.quadraticCurveTo(W * 0.3, hy + w0, W * 0.65, hy - w0);
        ctx.quadraticCurveTo(W * 0.82, hy + w0 * 0.5, W, hy); ctx.stroke();
      }
      ctx.restore();
    } else {
      // default day: sun + clouds
      ctx.fillStyle = 'rgba(255,245,200,0.9)'; ctx.beginPath(); ctx.arc(W*0.82, groundY*0.24, 30*scale, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (const c of this.clouds) {
        const cx = ((c.x - (this.dist*0.00004)) % 1 + 1) % 1 * W, cy = c.y*groundY, r = 18*scale*c.s;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.arc(cx+r, cy+4, r*0.8, 0, Math.PI*2); ctx.arc(cx-r, cy+4, r*0.8, 0, Math.PI*2); ctx.fill();
      }
    }

    // parallax hills / dunes / cave stalactites
    if (Bs.kind === 'cave') {
      ctx.fillStyle = hill;
      const stOff = (this.dist * 0.14) % (W * 0.55);
      for (let i = -1; i < 3; i++) {
        const bx = i * (W * 0.55) - stOff;
        ctx.beginPath(); ctx.moveTo(bx + W*0.10, 0); ctx.lineTo(bx + W*0.28, 0); ctx.lineTo(bx + W*0.19, (54 + Math.sin(i * 1.3) * 16) * scale); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(bx + W*0.31, 0); ctx.lineTo(bx + W*0.42, 0); ctx.lineTo(bx + W*0.365, (36 + Math.sin(i * 2.1) * 11) * scale); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(bx + W*0.45, 0); ctx.lineTo(bx + W*0.52, 0); ctx.lineTo(bx + W*0.485, (24 + Math.sin(i * 1.7) * 7) * scale); ctx.closePath(); ctx.fill();
      }
      ctx.fillRect(0, 0, W, 10 * scale); // solid ceiling edge
    } else if (Bs.kind === 'desert') {
      // wide, flat sand dunes
      ctx.fillStyle = hill;
      const hillOff = (this.dist * 0.17) % (W * 0.72);
      for (let i = -1; i < 3; i++) {
        const bx = i * (W * 0.72) - hillOff;
        ctx.beginPath(); ctx.ellipse(bx + W * 0.36, groundY, W * 0.42, 34 * scale, 0, Math.PI, 0); ctx.fill();
      }
    } else {
      ctx.fillStyle = hill;
      const hillOff = (this.dist * 0.2) % (W/2);
      for (let i = -1; i < 3; i++) {
        const bx = i*(W/2) - hillOff;
        ctx.beginPath(); ctx.ellipse(bx + W/4, groundY, W*0.32, 70*scale, 0, Math.PI, 0); ctx.fill();
      }
    }

    // ground
    ctx.fillStyle = grnd; ctx.fillRect(0, groundY, W, H - groundY);
    ctx.fillStyle = grndD; ctx.fillRect(0, groundY, W, 6*scale);
    // ground dashes (motion)
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 3*scale;
    const dash = 46*scale, off = (this.dist) % dash;
    for (let x = -off; x < W; x += dash) { ctx.beginPath(); ctx.moveTo(x, groundY + 18*scale); ctx.lineTo(x + dash*0.5, groundY + 18*scale); ctx.stroke(); }

    // obstacles
    for (const o of this.obstacles) this._drawObstacle(ctx, o, G);

    // collectible coins 🪙 (bob + glow)
    for (const c of this.coins) {
      const bob = Math.sin(this.t*4 + c.seed*7) * 4*scale, cx = c.x, cy = c.y + bob;
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.15*Math.sin(this.t*6 + c.seed*5); ctx.fillStyle = '#FFE9A8';
      ctx.beginPath(); ctx.arc(cx, cy, 15*scale, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      this._drawCoin(ctx, cx, cy, 10*scale);
    }

    // particles (dust + coin sparkles)
    for (const p of this.particles) {
      const a = Math.max(0, 1 - p.life / p.max);
      ctx.globalAlpha = a;
      if (p.kind === 'spark') { ctx.fillStyle = p.color || '#FFD23A'; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill(); }
      else { ctx.fillStyle = '#CDBFA6'; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;

    // dog
    this._drawDog(ctx, dogX, groundY + this.dog.y, scale);

    // level progress bar (across the top) — fills as you near the finish line
    const prog = Math.min(1, this.levelDist / this.levelLen);
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(0, 0, W, 6*scale);
    ctx.fillStyle = '#FFD23A'; ctx.fillRect(0, 0, W*prog, 6*scale);
    ctx.fillStyle = '#fff'; ctx.font = `${10*scale}px system-ui`; ctx.textAlign = 'right'; ctx.fillText('🏁', W - 4, 13*scale);

    // HUD
    const m = Math.min(LEVEL_M, Math.floor(this.levelDist / 10));
    ctx.fillStyle = '#22304A';
    ctx.font = `bold ${22*scale}px system-ui, sans-serif`; ctx.textAlign = 'left';
    ctx.fillText(`${m} / ${LEVEL_M} m`, 18, 44*scale);
    ctx.font = `bold ${13*scale}px system-ui, sans-serif`;
    ctx.fillText(`Récord: Nivel ${roman(this.savedLevel + 1)}`, 18, 64*scale);
    ctx.textAlign = 'center';
    ctx.font = `bold ${13*scale}px system-ui, sans-serif`;
    ctx.fillText(`Nivel ${roman(this.level + 1)} · ${this.curScene.name}`, W/2, 40*scale);
    // coins collected (all-time)
    this._drawCoin(ctx, W - 78*scale, 36*scale, 10*scale);
    ctx.fillStyle = '#22304A'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = `bold ${20*scale}px system-ui, sans-serif`;
    ctx.fillText(`${this.hearts}`, W - 62*scale, 43*scale);

    // boost (skates) timer
    if (this.boostTime > 0) {
      const bw = 140*scale, bh = 11*scale, bx = W/2 - bw/2, by = 54*scale;
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 5*scale); ctx.fill();
      ctx.fillStyle = '#FFD23A'; ctx.beginPath(); ctx.roundRect(bx, by, bw*(this.boostTime/5), bh, 5*scale); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `bold ${12*scale}px system-ui, sans-serif`;
      ctx.fillText(`🛼 ¡Patines! ${this.boostTime.toFixed(1)}s`, W/2, by + bh + 14*scale);
    }

    // level-up banner
    if (this.levelFlash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.levelFlash * 1.3);
      const by = H * 0.32;
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, by - 34*scale, W, 76*scale);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
      ctx.font = `900 ${30*scale}px system-ui, sans-serif`;
      ctx.fillText(`¡Nivel ${roman(this.level + 1)}!`, W/2, by);
      ctx.font = `bold ${18*scale}px system-ui, sans-serif`;
      ctx.fillText(this.curScene.name, W/2, by + 26*scale);
      ctx.restore();
    }

    // level complete — congratulate and offer the next level
    if (this.finished) {
      ctx.fillStyle = 'rgba(10,40,20,0.62)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#FFE066'; ctx.textAlign = 'center';
      ctx.font = `900 ${42*scale}px system-ui, sans-serif`;
      ctx.fillText('🏁 ¡Meta! 🎉', W/2, H*0.34);
      ctx.fillStyle = '#fff';
      ctx.font = `900 ${28*scale}px system-ui, sans-serif`;
      ctx.fillText(`¡Nivel ${roman(this.level + 1)} completado!`, W/2, H*0.34 + 46*scale);
      ctx.font = `bold ${16*scale}px system-ui, sans-serif`;
      ctx.fillText(`🪙 ${this.heartsLevel} monedas en este nivel`, W/2, H*0.34 + 70*scale);
      ctx.font = `bold ${18*scale}px system-ui, sans-serif`;
      ctx.fillText(`Próximo: Nivel ${roman(this.level + 2)} · ${SCENARIOS[(this.level + 1) % SCENARIOS.length].name}`, W/2, H*0.34 + 98*scale);
      if (this.finishWait > 0.5 && Math.sin(this.t*6) > -0.3) {
        ctx.font = `900 ${20*scale}px system-ui, sans-serif`;
        ctx.fillText('Toca SALTAR para el siguiente nivel ▶', W/2, H*0.34 + 132*scale);
      }
    }

    // game over
    if (this.gameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
      ctx.font = `900 ${40*scale}px system-ui, sans-serif`;
      ctx.fillText('¡Auch! 💜', W/2, H*0.4);
      ctx.font = `bold ${22*scale}px system-ui, sans-serif`;
      ctx.fillText(`Nivel ${roman(this.level + 1)} · ${m} m`, W/2, H*0.4 + 40*scale);
      if (this.deadFlash > 0.4 && Math.sin(this.t*6) > -0.3) {
        ctx.font = `bold ${18*scale}px system-ui, sans-serif`;
        ctx.fillText('Toca SALTAR para reintentar el nivel', W/2, H*0.4 + 78*scale);
      }
    }
  }

  _drawObstacle(ctx, o, G) {
    const sc = G.scale, scene = o.scene || this.curScene, H = this.canvas.height;
    ctx.save(); ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(20,12,6,0.8)'; ctx.lineWidth = 2*sc;

    if (o.type === 'finish') {
      const postH = 130*sc, span = 96*sc, x = o.x, topY = G.groundY - postH, pw = 8*sc;
      ctx.fillStyle = '#B0341F';
      ctx.fillRect(x, topY, pw, postH); ctx.fillRect(x + span, topY, pw, postH);
      // checkered banner
      const bw = span + pw, bh = 26*sc, cols = 8, rows = 2, cw = bw/cols, ch = bh/rows;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        ctx.fillStyle = ((r + c) % 2) ? '#1A1A1A' : '#FFFFFF';
        ctx.fillRect(x + c*cw, topY + r*ch, Math.ceil(cw)+1, ch);
      }
      ctx.fillStyle = '#FFE066'; ctx.textAlign = 'center';
      ctx.font = `900 ${16*sc}px system-ui, sans-serif`;
      ctx.fillText('META', x + bw/2, topY + bh + 22*sc);
      ctx.restore(); return;
    }

    if (o.type === 'hole') {
      const x0 = o.x, w = o.w;
      if (scene.hole === 'water') {
        ctx.fillStyle = '#2E6B86'; ctx.fillRect(x0, G.groundY, w, H - G.groundY);
        ctx.fillStyle = '#4FA6C6'; ctx.fillRect(x0, G.groundY, w, 12*sc);
        ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2*sc;
        for (let i = 0; i < 3; i++) { const yy = G.groundY + (5 + i*7)*sc; ctx.beginPath(); ctx.moveTo(x0+6*sc, yy + Math.sin(this.t*4+i)*2*sc); ctx.lineTo(x0+w-6*sc, yy + Math.cos(this.t*4+i)*2*sc); ctx.stroke(); }
        ctx.fillStyle = '#3E7A2E'; ctx.fillRect(x0-4*sc, G.groundY, 5*sc, 7*sc); ctx.fillRect(x0+w-1*sc, G.groundY, 5*sc, 7*sc);
      } else if (scene.hole === 'quicksand') {
        ctx.fillStyle = '#C4924A'; ctx.fillRect(x0, G.groundY, w, H - G.groundY);
        ctx.strokeStyle = 'rgba(155,105,38,0.65)'; ctx.lineWidth = 2*sc;
        for (let i = 0; i < 3; i++) {
          const phase = (this.t * 1.0 + i * 0.4) % 1;
          const ry = G.groundY + (7 + i * 9) * sc;
          ctx.save(); ctx.globalAlpha = Math.sin(phase * Math.PI) * 0.75;
          ctx.beginPath(); ctx.ellipse(x0 + w/2, ry, (w/2 - 4*sc) * (0.4 + phase * 0.6), 5*sc, 0, 0, Math.PI*2);
          ctx.stroke(); ctx.restore();
        }
        ctx.fillStyle = '#A87030'; ctx.fillRect(x0, G.groundY, w, 5*sc);
        ctx.fillRect(x0-3*sc, G.groundY, 4*sc, 6*sc); ctx.fillRect(x0+w-1*sc, G.groundY, 4*sc, 6*sc);
      } else if (scene.hole === 'pit') {
        ctx.fillStyle = '#0C0810'; ctx.fillRect(x0, G.groundY, w, H - G.groundY);
        ctx.fillStyle = '#26203A'; ctx.fillRect(x0, G.groundY, w, 5*sc);
        ctx.save();
        ctx.globalAlpha = 0.22 + 0.10 * Math.sin(this.t * 2.5);
        const pg = ctx.createLinearGradient(x0, G.groundY + 16*sc, x0, H);
        pg.addColorStop(0, 'rgba(0,0,0,0)'); pg.addColorStop(1, 'rgba(90,50,170,0.55)');
        ctx.fillStyle = pg; ctx.fillRect(x0, G.groundY + 16*sc, w, H - G.groundY - 16*sc);
        ctx.restore();
        ctx.fillStyle = '#26203A'; ctx.fillRect(x0-3*sc, G.groundY, 4*sc, 6*sc); ctx.fillRect(x0+w-1*sc, G.groundY, 4*sc, 6*sc);
      } else { // stones
        ctx.fillStyle = '#2C2C32'; ctx.fillRect(x0, G.groundY, w, H - G.groundY);
        ctx.fillStyle = '#74747C';
        const n = Math.max(3, Math.floor(w / (16*sc)));
        for (let i = 0; i < n; i++) {
          const cx = x0 + (i + 0.5) * (w / n), cy = G.groundY + (8 + ((i*7 + o.seed*10) % 5))*sc, rr = (6 + (i % 3)*2)*sc;
          ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        }
        ctx.fillStyle = '#5A5A62'; ctx.fillRect(x0, G.groundY, w, 4*sc);
      }
      ctx.restore(); return;
    }

    if (o.type === 'platform') {
      const b = this._obsBox(o, G);
      ctx.save(); ctx.globalAlpha = 0.16; ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(b.x + b.w/2, b.y + b.h + 8*sc, b.w*0.5, 7*sc, 0, 0, Math.PI*2); ctx.fill(); ctx.restore();
      if (scene.plat === 'stone') {
        ctx.fillStyle = '#9A9AA2'; ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 4*sc); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#B6B6BE'; ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, 6*sc, [4*sc,4*sc,0,0]); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1*sc;
        for (let x = b.x + 20*sc; x < b.x + b.w; x += 22*sc) { ctx.beginPath(); ctx.moveTo(x, b.y + 6*sc); ctx.lineTo(x, b.y + b.h); ctx.stroke(); }
      } else if (scene.plat === 'sandstone') {
        ctx.fillStyle = '#C89A50'; ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 4*sc); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#DEB060'; ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, 6*sc, [4*sc,4*sc,0,0]); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.13)'; ctx.lineWidth = 1*sc;
        for (let x = b.x + 24*sc; x < b.x + b.w; x += 26*sc) { ctx.beginPath(); ctx.moveTo(x, b.y + 6*sc); ctx.lineTo(x, b.y + b.h); ctx.stroke(); }
      } else if (scene.plat === 'crystal') {
        ctx.fillStyle = '#28203A'; ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 4*sc); ctx.fill(); ctx.stroke();
        const cg = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y);
        cg.addColorStop(0,'#7050C0'); cg.addColorStop(0.5,'#B090FF'); cg.addColorStop(1,'#7050C0');
        ctx.fillStyle = cg; ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, 6*sc, [4*sc,4*sc,0,0]); ctx.fill();
        ctx.save(); ctx.globalAlpha = 0.14 + 0.07 * Math.sin(this.t * 3);
        ctx.fillStyle = '#9070E0'; ctx.beginPath(); ctx.roundRect(b.x-2*sc, b.y-2*sc, b.w+4*sc, b.h+4*sc, 6*sc); ctx.fill(); ctx.restore();
      } else { // wood + grass
        ctx.fillStyle = '#A9743E'; ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 4*sc); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#6FC457'; ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, 6*sc, [4*sc,4*sc,0,0]); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.14)'; ctx.lineWidth = 1*sc;
        for (let x = b.x + 22*sc; x < b.x + b.w; x += 24*sc) { ctx.beginPath(); ctx.moveTo(x, b.y + 7*sc); ctx.lineTo(x, b.y + b.h); ctx.stroke(); }
      }
      ctx.restore(); return;
    }

    if (o.type === 'skate') {
      const b = this._obsBox(o, G);
      const bob = Math.sin(this.t*6 + o.seed*6) * 4*sc;
      const cx = b.x + b.w/2, cy = b.y + b.h/2 + bob;
      ctx.save(); ctx.globalAlpha = 0.45 + 0.15*Math.sin(this.t*8); ctx.fillStyle = '#FFE066';
      ctx.beginPath(); ctx.arc(cx, cy, b.w*0.75, 0, Math.PI*2); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#E84B7A';
      ctx.beginPath();
      ctx.moveTo(cx-11*sc, cy-11*sc); ctx.lineTo(cx-11*sc, cy+3*sc); ctx.lineTo(cx+13*sc, cy+3*sc);
      ctx.lineTo(cx+13*sc, cy-3*sc); ctx.quadraticCurveTo(cx+1*sc, cy-3*sc, cx-3*sc, cy-11*sc); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(cx-11*sc, cy+3*sc, 24*sc, 4*sc, 2*sc); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#333';
      for (const wx of [-7, 0, 7]) { ctx.beginPath(); ctx.arc(cx+wx*sc, cy+9*sc, 4*sc, 0, Math.PI*2); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = '#FFD23A'; for (const wx of [-7,0,7]) { ctx.beginPath(); ctx.arc(cx+wx*sc, cy+9*sc, 1.6*sc, 0, Math.PI*2); ctx.fill(); }
      ctx.restore(); return;
    }

    // low obstacle — procedural (desert/cave) or image-based (bosque/ciudad)
    const d = this._lowDims(o, G);
    if (o.kind === 'cactus') {
      const bx = o.x + d.w/2, by = G.groundY, h = d.h;
      ctx.strokeStyle = 'rgba(20,50,10,0.7)'; ctx.lineWidth = 1.5*sc;
      ctx.fillStyle = '#3A7A2A';
      ctx.beginPath(); ctx.roundRect(bx - 8*sc, by - h, 16*sc, h, 4*sc); ctx.fill(); ctx.stroke();
      if (h > 42*sc) {
        ctx.beginPath(); ctx.roundRect(bx - 22*sc, by - h*0.60, 14*sc, 8*sc, 4*sc); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.roundRect(bx - 22*sc, by - h*0.84, 8*sc, h*0.24+2*sc, 4*sc); ctx.fill(); ctx.stroke();
      }
      if (h > 50*sc) {
        ctx.beginPath(); ctx.roundRect(bx + 8*sc, by - h*0.50, 14*sc, 8*sc, 4*sc); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.roundRect(bx + 14*sc, by - h*0.74, 8*sc, h*0.24+2*sc, 4*sc); ctx.fill(); ctx.stroke();
      }
      ctx.strokeStyle = '#8AAA60'; ctx.lineWidth = sc;
      for (let i = 0; i < 5; i++) {
        const sy = by - h * (0.14 + i * 0.15);
        ctx.beginPath(); ctx.moveTo(bx - 9*sc, sy); ctx.lineTo(bx - 14*sc, sy - 3*sc); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(bx + 9*sc, sy); ctx.lineTo(bx + 14*sc, sy - 3*sc); ctx.stroke();
      }
    } else if (o.kind === 'rock') {
      const bx = o.x + d.w/2, by = G.groundY, h = d.h, w2 = d.w;
      const rg = ctx.createLinearGradient(bx - w2/2, by - h, bx + w2/2, by);
      rg.addColorStop(0, '#C09060'); rg.addColorStop(1, '#886040');
      ctx.fillStyle = rg; ctx.strokeStyle = 'rgba(20,12,6,0.8)'; ctx.lineWidth = 2*sc;
      ctx.beginPath();
      ctx.moveTo(bx - w2*0.40, by); ctx.lineTo(bx - w2*0.46, by - h*0.50);
      ctx.lineTo(bx - w2*0.24, by - h*0.86); ctx.lineTo(bx + w2*0.10, by - h*0.96);
      ctx.lineTo(bx + w2*0.40, by - h*0.60); ctx.lineTo(bx + w2*0.46, by);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.13)';
      ctx.beginPath(); ctx.moveTo(bx - w2*0.18, by - h*0.70); ctx.lineTo(bx + w2*0.08, by - h*0.88); ctx.lineTo(bx + w2*0.20, by - h*0.60); ctx.closePath(); ctx.fill();
    } else if (o.kind === 'stalagmite') {
      const bx = o.x + d.w/2, by = G.groundY, h = d.h, w2 = d.w;
      const sg = ctx.createLinearGradient(bx, by, bx, by - h);
      sg.addColorStop(0, '#4A4050'); sg.addColorStop(1, '#7060A0');
      ctx.fillStyle = sg; ctx.strokeStyle = 'rgba(20,12,6,0.7)'; ctx.lineWidth = 2*sc;
      ctx.beginPath();
      ctx.moveTo(bx - w2*0.48, by); ctx.lineTo(bx - w2*0.16, by - h*0.78); ctx.lineTo(bx, by - h); ctx.lineTo(bx + w2*0.16, by - h*0.78); ctx.lineTo(bx + w2*0.48, by);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.globalAlpha = 0.5 + 0.2 * Math.sin(this.t * 3 + (o.seed || 0) * 5);
      ctx.fillStyle = '#C0A0FF'; ctx.beginPath(); ctx.arc(bx, by - h, 3*sc, 0, Math.PI*2); ctx.fill(); ctx.restore();
    } else if (o.kind === 'boulder') {
      const bx = o.x + d.w/2, by = G.groundY, h = d.h, w2 = d.w;
      const bg = ctx.createRadialGradient(bx - w2*0.15, by - h*0.62, 4*sc, bx, by - h*0.48, w2*0.52);
      bg.addColorStop(0, '#5A5070'); bg.addColorStop(1, '#2A2030');
      ctx.fillStyle = bg; ctx.strokeStyle = 'rgba(20,12,6,0.7)'; ctx.lineWidth = 2*sc;
      ctx.beginPath(); ctx.ellipse(bx, by - h*0.46, w2*0.46, h*0.46, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(180,160,220,0.14)';
      ctx.beginPath(); ctx.ellipse(bx - w2*0.14, by - h*0.66, w2*0.19, h*0.17, -0.3, 0, Math.PI*2); ctx.fill();
    } else {
      const im = OB_IMG[o.imgName];
      if (im && im.naturalHeight) {
        ctx.drawImage(im, o.x, G.groundY - d.h, d.w, d.h);
      } else {
        ctx.fillStyle = '#7A5230'; ctx.beginPath(); ctx.roundRect(o.x, G.groundY - d.h, d.w, d.h, 6*sc); ctx.fill(); ctx.stroke();
      }
    }
    ctx.restore();
  }

  _drawDog(ctx, x, feetY, sc) {
    const duck = this.dog.ducking, air = !this.dog.onGround;
    const run = Math.sin(this.t * 18);

    // shadow
    ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(x, feetY + 2*sc, 30*sc, 6*sc, 0, 0, Math.PI*2); ctx.fill(); ctx.restore();

    // boost aura + speed lines (skates)
    if (this.boostTime > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,220,80,0.7)'; ctx.lineWidth = 3*sc;
      for (let i = 0; i < 4; i++) { const yy = feetY - 18*sc - i*16*sc, len = (20 + Math.random()*22)*sc; ctx.beginPath(); ctx.moveTo(x - 32*sc - len, yy); ctx.lineTo(x - 32*sc, yy); ctx.stroke(); }
      ctx.globalAlpha = 0.3 + 0.15*Math.sin(this.t*20); ctx.fillStyle = '#FFE066';
      ctx.beginPath(); ctx.ellipse(x, feetY - 46*sc, 42*sc, 56*sc, 0, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    if (!HERO_READY) return;

    const ref = HERO_FRAMES[0];
    const baseH = 96*sc;
    const scl = baseH / ref.naturalHeight;        // common scale → keeps poses' relative sizes
    let img, rot = 0;
    if (duck)      { img = HERO_FRAMES[3]; }                      // crouch frame
    else if (air)  { img = HERO_FRAMES[1]; rot = 0.12; }          // leaping frame
    else {
      const fps = Math.min(20, 9 + this.speed * 0.012);          // run cycle, faster when faster
      img = HERO_FRAMES[Math.floor(this.t * fps) % 3];
    }
    const dw = img.naturalWidth * scl, dh = img.naturalHeight * scl;
    ctx.save();
    ctx.translate(x, feetY);
    ctx.rotate(rot);
    ctx.drawImage(img, -dw/2, -dh, dw, dh);        // anchor bottom-centre at the feet
    ctx.restore();
  }

  destroy() {}
}
