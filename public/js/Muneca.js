// ── Muñeca ───────────────────────────────────────────────────────────────────
// Dibujo de la nena vestida, compartido por el Vestidor (donde se la arma) y
// por Mi Mundo (donde se la camina). El cuerpo y la ropa son sprites PNG; el
// pelo acepta PNG por peinado (HAIR_ART) y cae a vectorial el que no lo tenga;
// zapatos y accesorios siguen siendo vectoriales. Si los PNG no cargaron
// todavía se dibuja todo vectorial, para no mostrarla desnuda.
// El look elegido vive en localStorage y es la única fuente de verdad.

// ── Colour helpers (paleta pastel + sombreado suave, como Character.js) ──────
function _lc(hex, amt) {
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return `rgb(${Math.min(255,Math.round(r+(255-r)*amt))},${Math.min(255,Math.round(g+(255-g)*amt))},${Math.min(255,Math.round(b+(255-b)*amt))})`;
}
function _dc(hex, amt) {
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return `rgb(${Math.max(0,Math.round(r*(1-amt)))},${Math.max(0,Math.round(g*(1-amt)))},${Math.max(0,Math.round(b*(1-amt)))})`;
}
const OC = 'rgba(40,20,10,0.55)';
export { _dc as darken };   // lo usa la grilla del Vestidor para las tarjetas


// ── Sprites PNG ─────────────────────────────────────────────────────────────
// El cuerpo y la ropa son PNG generados con IA (ver public/assets/vestidor/).
// Mientras no cargan —o si faltan— se cae al dibujo vectorial de más abajo,
// igual que hacen Helado.js y Panaderia.js.
const ASSET = (p) => `/assets/vestidor/${p}.png`;
const _imgs = {};
function loadImg(path) {
  if (path in _imgs) return _imgs[path];
  let img = null;
  try {
    if (typeof Image !== 'undefined') {
      img = new Image();
      img.onload = _flushReady;
      img.src = ASSET(path);
    }
  } catch (e) { img = null; }
  _imgs[path] = img;
  return img;
}

// Avisa cuando la muñeca ya se puede dibujar con sprites. Lo necesitan los
// dibujos de una sola pasada (retrato del HUD, vista previa del menú), que no
// están en un bucle de animación.
const _readyCbs = [];
function _flushReady() {
  if (!spriteReady(currentLook())) return;
  _readyCbs.splice(0).forEach(cb => { try { cb(); } catch (e) {} });
}
export function onDollReady(cb) {
  if (spriteReady(currentLook())) cb(); else _readyCbs.push(cb);
}
function ready(img) { return !!(img && img.complete && img.naturalWidth > 0); }

// Puntos de referencia medidos sobre base/cuerpo.png (238x483 recortado).
// Ojo: la IA dibujó una nena de ~2.3 cabezas de alto, así que el cuello cae al
// 43% y no al 30% — estos valores salen de medir el PNG, no del prompt.
const BODY = {
  ar:        238 / 483,   // ancho/alto del sprite
  headCy:    0.2153,      // centro de la cabeza (fracción de la altura)
  headR:     0.2112,      // radio de la cabeza
  neckY:     0.4306,
  shoulderY: 0.4555,
  hipY:      0.7412,
  footY:     0.975,
  footDx:    0.111,       // separación de cada pie (fracción del ancho)
};
// color de piel dominante del PNG: la base contra la que se calculan los tonos
const BASE_SKIN = [0xF8, 0xC8, 0xA8];

// Calibración de cada prenda: [ruta, yTop, yBot, xs?] en fracciones de la altura
// del cuerpo (`xs` ensancha aparte). Los valores salen de superponer y mirar: no
// hay forma de deducirlos, cada imagen viene centrada en su propio cuadro.
const OUTFIT_ART = {
  flores: { full: ['ropa_completa/flores', 0.44, 0.93] },
  casual: { full: ['ropa_completa/casual', 0.44, 0.93] },
  overol: { full: ['ropa_completa/overol', 0.44, 0.99] },
  pijama: { full: ['ropa_completa/pijama', 0.44, 0.88] },
  tutu:   { full: ['ropa_completa/tutu',   0.44, 0.90] },
  fiesta: { full: ['ropa_completa/fiesta', 0.44, 0.90] },
  // la cola viene angosta arriba: sin ensanchar se ven las piernas a los lados
  sirena: { bot: ['ropa/sirena_bot', 0.68, 1.05, 1.4], top: ['ropa/sirena_top', 0.44, 0.79] },
};

// Calibración de cada peinado: mismas fracciones que OUTFIT_ART (0 = corona de
// la cabeza, 1 = pies). `front` va sobre la cara, `back` detrás del cuerpo.
// Mientras un peinado no tenga PNG se dibuja con el pelo vectorial de más abajo,
// así que la tabla puede ir creciendo de a un peinado por vez.
// Referencias del cuerpo: corona 0.004, mentón 0.43, hombros 0.4555, cadera 0.74.
// Ejemplo: colitas: { front:['pelo/colitas_frente',0,0.46], back:['pelo/colitas_atras',0.10,0.62] }
const HAIR_ART = {};

// Los PNG de pelo se generan en gris neutro (#C8C8C8 de base, ver
// docs/prompts-pelo.md) para poder teñirlos con cualquiera de los HAIR_COLORS
// sin generar una imagen por color.
const BASE_HAIR = 0xC8;
const _hairCache = {};
function tintHair(path, color) {
  const img = loadImg(path);
  if (!ready(img)) return null;
  const key = path + color;
  if (_hairCache[key]) return _hairCache[key];
  let cv;
  try { cv = document.createElement('canvas'); } catch (e) { return null; }
  cv.width = img.naturalWidth; cv.height = img.naturalHeight;
  const cx = cv.getContext('2d');
  cx.drawImage(img, 0, 0);
  const kr = parseInt(color.slice(1, 3), 16) / BASE_HAIR;
  const kg = parseInt(color.slice(3, 5), 16) / BASE_HAIR;
  const kb = parseInt(color.slice(5, 7), 16) / BASE_HAIR;
  try {
    const d = cx.getImageData(0, 0, cv.width, cv.height), p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      if (p[i + 3] < 8) continue;
      const r = p[i], g = p[i + 1], b = p[i + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      // sólo lo desaturado es pelo: los contornos marrones y los moños de color
      // se dibujaron saturados justamente para que el teñido no los toque
      if (mx > 0 && (mx - mn) / mx > 0.18) continue;
      p[i]     = Math.min(255, r * kr);
      p[i + 1] = Math.min(255, g * kg);
      p[i + 2] = Math.min(255, b * kb);
    }
    cx.putImageData(d, 0, 0);
  } catch (e) {}
  _hairCache[key] = cv;
  return cv;
}

// Las dos capas de pelo salen juntas o ninguna: si sólo cargó una se vería un
// peinado mitad PNG mitad vectorial.
function hairSpriteReady(look) {
  const art = HAIR_ART[look.hair];
  if (!art) return false;
  return ['back', 'front'].every(k => !art[k] || ready(loadImg(art[k][0])));
}

function hairSprite(ctx, look, layer, H) {
  const piece = (HAIR_ART[look.hair] || {})[layer];
  if (!piece) return;
  const [path, yTop, yBot, xs] = piece;
  const img = loadImg(path);
  if (!ready(img)) return;
  const gh = (yBot - yTop) * H;
  const gw = img.naturalWidth * (gh / img.naturalHeight) * (xs || 1);
  ctx.drawImage(tintHair(path, look.hairColor) || img, -gw / 2, -(1 - yTop) * H, gw, gh);
}

// Cuerpo teñido según el tono de piel. Se recolorean sólo los píxeles cálidos y
// claros (piel y rubor); los contornos y los ojos quedan intactos.
const _skinCache = {};
function skinBody(tone) {
  const img = loadImg('base/cuerpo');
  if (!ready(img)) return null;
  if (_skinCache[tone]) return _skinCache[tone];
  let cv;
  try { cv = document.createElement('canvas'); } catch (e) { return null; }
  cv.width = img.naturalWidth; cv.height = img.naturalHeight;
  const cx = cv.getContext('2d');
  cx.drawImage(img, 0, 0);
  const kr = parseInt(tone.slice(1, 3), 16) / BASE_SKIN[0];
  const kg = parseInt(tone.slice(3, 5), 16) / BASE_SKIN[1];
  const kb = parseInt(tone.slice(5, 7), 16) / BASE_SKIN[2];
  if (Math.abs(kr - 1) > 0.02 || Math.abs(kg - 1) > 0.02 || Math.abs(kb - 1) > 0.02) {
    try {
      const d = cx.getImageData(0, 0, cv.width, cv.height), p = d.data;
      for (let i = 0; i < p.length; i += 4) {
        if (p[i + 3] < 8) continue;
        const r = p[i], g = p[i + 1], b = p[i + 2];
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        if (mx < 115 || r <= b) continue;          // contornos, ojos, tonos fríos
        if ((mx - mn) / mx < 0.10) continue;       // blancos del ojo
        p[i]     = Math.min(255, r * kr);
        p[i + 1] = Math.min(255, g * kg);
        p[i + 2] = Math.min(255, b * kb);
      }
      cx.putImageData(d, 0, 0);
    } catch (e) {}
  }
  _skinCache[tone] = cv;
  return cv;
}

// ── Catálogo ──────────────────────────────────────────────────────────────
export const SKIN_TONES = [
  { id:'clara',   color:'#FFE0C4', price:0 },
  { id:'dorada',  color:'#F5C89A', price:0 },
  { id:'canela',  color:'#D9A066', price:0 },
  { id:'morena',  color:'#A9744F', price:0 },
  { id:'oscura',  color:'#6E4A2E', price:0 },
];

export const HAIR_STYLES = [
  { id:'colitas', name:'Colitas', emoji:'🎀',   price:0  },
  { id:'corto',   name:'Corto',   emoji:'✂️',   price:20 },
  { id:'rodete',  name:'Rodete',  emoji:'🍡',   price:30 },
  { id:'largo',   name:'Suelto',  emoji:'💁‍♀️', price:40 },
  { id:'trenza',  name:'Trenza',  emoji:'🧵',   price:40 },
];

export const HAIR_COLORS = [
  { id:'negro',    color:'#2A1A10', price:0  },
  { id:'castano',  color:'#7B3F00', price:0  },
  { id:'rubio',    color:'#D4A044', price:0  },
  { id:'plateado', color:'#EDEDED', price:0  },
  { id:'fucsia',   color:'#C03060', price:20 },
  { id:'azul',     color:'#3060C0', price:20 },
  { id:'menta',    color:'#8ED9C0', price:35 },
  { id:'lavanda',  color:'#C9A8F5', price:35 },
  { id:'chicle',   color:'#FF8AC8', price:35 },
];

export const OUTFITS = [
  { id:'flores', name:'Vestido Flores',  emoji:'👗', price:0,   kind:'vestido',        main:'#F9C8D8', accent:'#E89AB8', pattern:'flores'   },
  { id:'casual', name:'Remera y Jean',   emoji:'👕', price:40,  kind:'remera_pollera', main:'#F2A7BB', accent:'#3F5C8C', pattern:'ninguno'  },
  { id:'overol', name:'Overol',          emoji:'🧑‍🌾', price:60, kind:'overol',        main:'#5B7FBF', accent:'#FFE0C4', pattern:'ninguno'  },
  { id:'pijama', name:'Pijama Estrella', emoji:'🌙', price:50,  kind:'remera_pollera', main:'#8FD0F0', accent:'#3A7AA8', pattern:'estrellas'},
  { id:'tutu',   name:'Tutú Bailarina',  emoji:'🩰', price:90,  kind:'tutu',           main:'#FFB6D9', accent:'#FF80C0', pattern:'ninguno'  },
  { id:'fiesta', name:'Vestido Fiesta',  emoji:'✨', price:100, kind:'vestido',        main:'#C9A8F5', accent:'#8B5FBF', pattern:'brillos'  },
  { id:'sirena', name:'Sirena',          emoji:'🧜‍♀️', price:150,kind:'sirena',        main:'#4ED0C8', accent:'#2A9A90', pattern:'escamas'  },
];

export const SHOES = [
  { id:'zapatillas', name:'Zapatillas', emoji:'👟', price:0,  color:'#FFFFFF', accent:'#FF6090' },
  { id:'sandalias',  name:'Sandalias',  emoji:'🩴', price:20, color:'#F5C89A', accent:'#C08050' },
  { id:'botas',      name:'Botas',      emoji:'🥾', price:40, color:'#8B5A2B', accent:'#5A3A1B' },
  { id:'fiesta',     name:'Fiesta',     emoji:'👠', price:60, color:'#E040A0', accent:'#A02070' },
];

export const ACCESSORIES = [
  { id:'ninguno', name:'Ninguno', emoji:'🚫', price:0   },
  { id:'moño',    name:'Moño',    emoji:'🎀', price:0   },
  { id:'lentes',  name:'Lentes',  emoji:'👓', price:25  },
  { id:'flor',    name:'Flores',  emoji:'🌸', price:40  },
  { id:'collar',  name:'Collar',  emoji:'📿', price:50  },
  { id:'cartera', name:'Cartera', emoji:'👜', price:60  },
  { id:'corona',  name:'Corona',  emoji:'👑', price:100 },
];

// ── Look guardado ───────────────────────────────────────────────────────────
export const DEFAULT_LOOK = {
  skin: SKIN_TONES[0].color,
  hair: HAIR_STYLES[0].id, hairColor: HAIR_COLORS[0].color,
  outfit: OUTFITS[0].id, shoes: SHOES[0].id, accessory: ACCESSORIES[0].id,
};
export const SAVE_KEY = 'vestidor_look';
export function loadLook() {
  const l = Object.assign({}, DEFAULT_LOOK);
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s) Object.assign(l, s); } catch (e) {}
  return l;
}
export function saveLook(look) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(look)); } catch (e) {}
  _cachedLook = look;   // que Mi Mundo vea el cambio sin releer localStorage
}

export function drawOutfitThumb(ctx, cx, cyFeet, bodyH, outfitId) {
  const art = OUTFIT_ART[outfitId];
  if (!art) return false;
  const pieces = ['full', 'bot', 'top'].filter(k => art[k]);
  if (!pieces.every(k => ready(loadImg(art[k][0])))) return false;
  for (const k of pieces) {
    const [path, yTop, yBot, xs] = art[k];
    const img = loadImg(path);
    const gh = (yBot - yTop) * bodyH;
    const gw = img.naturalWidth * (gh / img.naturalHeight) * (xs || 1);
    ctx.drawImage(img, cx - gw / 2, cyFeet - (1 - yTop) * bodyH, gw, gh);
  }
  return true;
}

export function spriteReady(look) {
  if (!ready(loadImg('base/cuerpo'))) return false;
  const art = OUTFIT_ART[look.outfit];
  if (!art) return false;
  for (const k of ['full', 'bot', 'top']) if (art[k] && !ready(loadImg(art[k][0]))) return false;
  return true;
}

export function paintDoll(ctx, look, cx, cyFeet, scale, opts = {}) {
  if (spriteReady(look)) paintDollSprite(ctx, look, cx, cyFeet, scale, opts);
  else paintDollVector(ctx, look, cx, cyFeet, scale, opts);
}

// ── Muñeca con sprites PNG ──────────────────────────────────────────────
// El pelo, los zapatos y los accesorios siguen siendo vectoriales (todavía no
// hay PNG de esas partes) y se ubican con los landmarks medidos del cuerpo.
function paintDollSprite(ctx, look, cx, cyFeet, scale, opts = {}) {
  const L = look;
  const H = 300 * scale;              // misma altura que la muñeca vectorial
  const BW = H * BODY.ar;
  const u = Math.max(1, H * 0.01);
  const yOf = (f) => -(1 - f) * H;
  const headCy = yOf(BODY.headCy), headR = BODY.headR * H;
  const neckY = yOf(BODY.neckY), hipY = yOf(BODY.hipY);

  ctx.save();
  ctx.translate(cx, cyFeet);

  if (opts.shadow !== false) {
    ctx.save(); ctx.globalAlpha = 0.2; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(0, 2, H * 0.16, H * 0.03, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }

  const hairPng = hairSpriteReady(L);
  if (hairPng) hairSprite(ctx, L, 'back', H);
  else hairBack(ctx, L, headCy, headR, hipY, u);

  const body = skinBody(L.skin);
  if (body) ctx.drawImage(body, -BW / 2, -H, BW, H);

  shoesSprite(ctx, L, H, BW);

  const art = OUTFIT_ART[L.outfit];
  if (art) {
    // orden: primero la pieza de abajo, después el top (o la prenda entera)
    for (const k of ['full', 'bot', 'top']) {
      if (!art[k]) continue;
      const [path, yTop, yBot, xs] = art[k];
      const img = loadImg(path);
      if (!ready(img)) continue;
      const gh = (yBot - yTop) * H;
      const gw = img.naturalWidth * (gh / img.naturalHeight) * (xs || 1);
      ctx.drawImage(img, -gw / 2, yOf(yTop), gw, gh);
    }
  }

  if (hairPng) hairSprite(ctx, L, 'front', H);
  else hairFront(ctx, L, headCy, headR, u);
  accessory(ctx, L, headCy, headR, neckY, hipY, u);
  ctx.restore();
}

function shoesSprite(ctx, L, H, BW) {
  const S = SHOES.find(s => s.id === L.shoes) || SHOES[0];
  const y = -(1 - BODY.footY) * H;
  const rx = H * 0.062, ry = H * 0.032;
  ctx.strokeStyle = OC; ctx.lineWidth = Math.max(1, H * 0.01);
  for (const sgn of [-1, 1]) {
    const x = sgn * BODY.footDx * BW;
    ctx.fillStyle = S.color;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = S.accent;
    ctx.beginPath(); ctx.ellipse(x, y + ry * 0.5, rx * 0.88, ry * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  }
}

// ── Muñeca vectorial (respaldo mientras cargan los PNG) ─────────────────
function paintDollVector(ctx, look, cx, cyFeet, scale, opts = {}) {
  const L = look;
  const H = 300 * scale;
  ctx.save();
  ctx.translate(cx, cyFeet);

  const headR = H * 0.145, headCy = -H * 0.83;
  const neckY = headCy + headR * 0.85;
  const shY = neckY + H * 0.02;
  const hipY = -H * 0.44;
  const kneeY = -H * 0.22;
  const footY = -H * 0.02;
  const shHalf = H * 0.16, hipHalf = H * 0.14, legHalf = H * 0.055;
  const u = Math.max(1, H * 0.01);

  if (opts.shadow !== false) {
    ctx.save(); ctx.globalAlpha = 0.2; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(0, 2, H * 0.16, H * 0.03, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }

  hairBack(ctx, L, headCy, headR, hipY, u);

  ctx.fillStyle = L.skin; ctx.strokeStyle = OC; ctx.lineWidth = u;
  for (const sgn of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sgn * hipHalf * 0.55, hipY);
    ctx.quadraticCurveTo(sgn * legHalf * 1.3, kneeY, sgn * legHalf, footY - H * 0.05);
    ctx.lineTo(sgn * legHalf * 0.3, footY - H * 0.05);
    ctx.quadraticCurveTo(sgn * legHalf * 0.5, kneeY, sgn * hipHalf * 0.15, hipY);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  shoes(ctx, L, footY, legHalf, u);
  outfitBottom(ctx, L, hipY, kneeY, hipHalf, u);

  ctx.fillStyle = L.skin; ctx.strokeStyle = OC; ctx.lineWidth = u;
  for (const sgn of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sgn * shHalf * 0.85, shY + H * 0.01);
    ctx.quadraticCurveTo(sgn * shHalf * 1.5, hipY * 0.55, sgn * shHalf * 1.15, hipY * 0.25);
    ctx.quadraticCurveTo(sgn * shHalf * 0.9, hipY * 0.5, sgn * shHalf * 0.55, shY + H * 0.05);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(sgn * shHalf * 1.13, hipY * 0.28, H * 0.028, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  outfitTop(ctx, L, shY, hipY, kneeY, shHalf, hipHalf, u);

  ctx.fillStyle = L.skin; ctx.strokeStyle = OC; ctx.lineWidth = u;
  ctx.beginPath(); ctx.roundRect(-headR * 0.28, neckY - 2 * u, headR * 0.56, shY - neckY + 4 * u, 4 * u); ctx.fill(); ctx.stroke();

  ctx.beginPath(); ctx.arc(0, headCy, headR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  face(ctx, headCy, headR, u);
  hairFront(ctx, L, headCy, headR, u);
  accessory(ctx, L, headCy, headR, neckY, hipY, u);

  ctx.restore();
}

function shoes(ctx, L, footY, legHalf, u) {
  const S = SHOES.find(s => s.id === L.shoes) || SHOES[0];
  ctx.strokeStyle = OC; ctx.lineWidth = u;
  for (const sgn of [-1, 1]) {
    ctx.fillStyle = S.color;
    ctx.beginPath(); ctx.ellipse(sgn * legHalf * 0.6, footY, legHalf * 1.25, legHalf * 0.85, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = S.accent;
    ctx.beginPath(); ctx.ellipse(sgn * legHalf * 0.6, footY + legHalf * 0.5, legHalf * 1.1, legHalf * 0.35, 0, 0, Math.PI * 2); ctx.fill();
  }
}

function outfitBottom(ctx, L, hipY, kneeY, hipHalf, u) {
  const O = OUTFITS.find(o => o.id === L.outfit) || OUTFITS[0];
  ctx.strokeStyle = OC; ctx.lineWidth = u;
  if (O.kind === 'vestido') return;
  if (O.kind === 'remera_pollera') {
    const bottomHalf = hipHalf * 1.7;
    ctx.fillStyle = O.accent;
    ctx.beginPath();
    ctx.moveTo(-hipHalf, hipY); ctx.lineTo(hipHalf, hipY);
    ctx.quadraticCurveTo(bottomHalf, (hipY + kneeY) / 2, bottomHalf * 0.9, kneeY);
    ctx.lineTo(-bottomHalf * 0.9, kneeY);
    ctx.quadraticCurveTo(-bottomHalf, (hipY + kneeY) / 2, -hipHalf, hipY);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    pattern(ctx, O.pattern, 0, hipY, kneeY, bottomHalf);
  } else if (O.kind === 'overol') {
    const ankleY = kneeY - (hipY - kneeY) * 0.9;
    ctx.fillStyle = O.main;
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sgn * hipHalf * 0.15, hipY); ctx.lineTo(sgn * hipHalf * 0.95, hipY);
      ctx.quadraticCurveTo(sgn * hipHalf * 0.85, (hipY + ankleY) / 2, sgn * hipHalf * 0.6, ankleY);
      ctx.lineTo(sgn * hipHalf * 0.1, ankleY);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  } else if (O.kind === 'tutu') {
    for (let i = 0; i < 3; i++) {
      const r = hipHalf * (1.5 + i * 0.35);
      ctx.globalAlpha = 0.85 - i * 0.15;
      ctx.fillStyle = O.accent;
      ctx.beginPath(); ctx.ellipse(0, hipY + (kneeY - hipY) * 0.2, r, r * 0.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (O.kind === 'sirena') {
    ctx.fillStyle = O.main;
    ctx.beginPath();
    ctx.moveTo(-hipHalf, hipY); ctx.lineTo(hipHalf, hipY);
    ctx.lineTo(hipHalf * 0.75, kneeY); ctx.lineTo(-hipHalf * 0.75, kneeY);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    const finY = kneeY - (hipY - kneeY) * 0.55;
    ctx.fillStyle = O.accent;
    ctx.beginPath();
    ctx.moveTo(-hipHalf * 0.75, kneeY);
    ctx.quadraticCurveTo(-hipHalf * 1.5, (kneeY + finY) / 2, -hipHalf * 0.3, finY);
    ctx.lineTo(hipHalf * 0.3, finY);
    ctx.quadraticCurveTo(hipHalf * 1.5, (kneeY + finY) / 2, hipHalf * 0.75, kneeY);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    pattern(ctx, O.pattern, 0, hipY, kneeY, hipHalf);
  }
}

function outfitTop(ctx, L, shY, hipY, kneeY, shHalf, hipHalf, u) {
  const O = OUTFITS.find(o => o.id === L.outfit) || OUTFITS[0];
  ctx.strokeStyle = OC; ctx.lineWidth = u;
  if (O.kind === 'vestido') {
    const bottomHalf = hipHalf * 1.6;
    ctx.fillStyle = O.main;
    ctx.beginPath();
    ctx.moveTo(-shHalf * 0.9, shY); ctx.lineTo(shHalf * 0.9, shY);
    ctx.quadraticCurveTo(hipHalf * 1.1, (shY + hipY) / 2, hipHalf * 1.05, hipY);
    ctx.quadraticCurveTo(bottomHalf, (hipY + kneeY) / 2, bottomHalf * 0.9, kneeY);
    ctx.lineTo(-bottomHalf * 0.9, kneeY);
    ctx.quadraticCurveTo(-bottomHalf, (hipY + kneeY) / 2, -hipHalf * 1.05, hipY);
    ctx.quadraticCurveTo(-hipHalf * 1.1, (shY + hipY) / 2, -shHalf * 0.9, shY);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = O.accent;
    ctx.fillRect(-hipHalf * 1.05, hipY - hipHalf * 0.1, hipHalf * 2.1, hipHalf * 0.2);
    pattern(ctx, O.pattern, 0, shY, kneeY, bottomHalf);
  } else if (O.kind === 'remera_pollera') {
    ctx.fillStyle = O.main;
    ctx.beginPath();
    ctx.moveTo(-shHalf * 0.9, shY); ctx.lineTo(shHalf * 0.9, shY);
    ctx.quadraticCurveTo(hipHalf * 1.05, (shY + hipY) / 2, hipHalf * 0.95, hipY);
    ctx.lineTo(-hipHalf * 0.95, hipY);
    ctx.quadraticCurveTo(-hipHalf * 1.05, (shY + hipY) / 2, -shHalf * 0.9, shY);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    pattern(ctx, O.pattern, 0, shY, hipY, shHalf);
  } else if (O.kind === 'overol') {
    ctx.fillStyle = O.accent;
    ctx.beginPath();
    ctx.moveTo(-shHalf * 0.9, shY); ctx.lineTo(shHalf * 0.9, shY);
    ctx.quadraticCurveTo(hipHalf * 1.0, (shY + hipY) / 2, hipHalf * 0.9, hipY);
    ctx.lineTo(-hipHalf * 0.9, hipY);
    ctx.quadraticCurveTo(-hipHalf * 1.0, (shY + hipY) / 2, -shHalf * 0.9, shY);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = O.main;
    const bibHalf = shHalf * 0.55, bibBot = hipY - (shY - hipY) * 0.05;
    ctx.beginPath(); ctx.roundRect(-bibHalf, shY + 2 * u, bibHalf * 2, bibBot - shY, 4 * u); ctx.fill(); ctx.stroke();
    for (const sgn of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(sgn * bibHalf * 0.7, shY + 2 * u); ctx.lineTo(sgn * shHalf * 0.75, shY - 6 * u);
      ctx.lineWidth = 5 * u; ctx.strokeStyle = O.main; ctx.stroke();
      ctx.strokeStyle = OC; ctx.lineWidth = u;
    }
  } else if (O.kind === 'tutu' || O.kind === 'sirena') {
    ctx.fillStyle = O.main;
    ctx.beginPath();
    ctx.moveTo(-shHalf * 0.85, shY); ctx.lineTo(shHalf * 0.85, shY);
    ctx.quadraticCurveTo(hipHalf * 0.9, (shY + hipY) / 2, hipHalf * 0.8, hipY);
    ctx.lineTo(-hipHalf * 0.8, hipY);
    ctx.quadraticCurveTo(-hipHalf * 0.9, (shY + hipY) / 2, -shHalf * 0.85, shY);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
}

function pattern(ctx, kind, cx, top, bottom, halfW) {
  if (kind === 'ninguno') return;
  const n = 6;
  for (let i = 0; i < n; i++) {
    const fx = cx + (Math.sin(i * 2.4) + (i % 2 ? 0.4 : -0.4)) * halfW * 0.7;
    const fy = top + (bottom - top) * ((i + 0.5) / n);
    if (kind === 'flores') miniFlower(ctx, fx, fy, halfW * 0.09);
    else if (kind === 'estrellas') miniStar(ctx, fx, fy, halfW * 0.08);
    else if (kind === 'brillos') miniSpark(ctx, fx, fy, halfW * 0.07);
    else if (kind === 'escamas') { ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(fx, fy, halfW * 0.12, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke(); }
  }
}
function miniFlower(ctx, x, y, r) {
  ctx.fillStyle = '#FFFFFF';
  for (let p = 0; p < 5; p++) { const a = p / 5 * Math.PI * 2; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7, r * 0.55, r * 0.35, a, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#FFD24A'; ctx.beginPath(); ctx.arc(x, y, r * 0.35, 0, Math.PI * 2); ctx.fill();
}
function miniStar(ctx, x, y, r) {
  ctx.fillStyle = '#FFE066';
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * (Math.PI * 2 / 5), a2 = a + Math.PI / 5;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    ctx.lineTo(x + Math.cos(a2) * r * 0.45, y + Math.sin(a2) * r * 0.45);
  }
  ctx.closePath(); ctx.fill();
}
function miniSpark(ctx, x, y, r) {
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = Math.max(1, r * 0.3);
  ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke();
}

function face(ctx, headCy, headR, u) {
  const eR = headR * 0.22, eyeDX = headR * 0.38, eyeY = headCy + headR * 0.05;
  ctx.lineCap = 'round';
  for (const sgn of [-1, 1]) {
    const ex = sgn * eyeDX;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = OC; ctx.lineWidth = 1.4 * u;
    ctx.beginPath(); ctx.ellipse(ex, eyeY, eR, eR * 1.1, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7A4B2A';
    ctx.beginPath(); ctx.ellipse(ex, eyeY + eR * 0.1, eR * 0.75, eR * 0.9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2A1608';
    ctx.beginPath(); ctx.ellipse(ex, eyeY + eR * 0.15, eR * 0.36, eR * 0.46, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(ex - eR * 0.28, eyeY - eR * 0.35, eR * 0.3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = '#B5536A'; ctx.lineWidth = 2 * u;
  ctx.beginPath(); ctx.arc(0, headCy + headR * 0.42, headR * 0.2, 0.15, Math.PI - 0.15); ctx.stroke();
  ctx.fillStyle = 'rgba(255,130,120,0.28)';
  for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sgn * eyeDX * 1.15, eyeY + eR * 1.15, eR * 0.85, eR * 0.55, 0, 0, Math.PI * 2); ctx.fill(); }
}

function hairBack(ctx, L, headCy, headR, hipY, u) {
  if (L.hair !== 'largo' && L.hair !== 'trenza') return;
  const hC = L.hairColor;
  ctx.strokeStyle = OC; ctx.lineWidth = u;
  const g = ctx.createLinearGradient(-headR, headCy, headR, hipY);
  g.addColorStop(0, _lc(hC, 0.2)); g.addColorStop(0.5, hC); g.addColorStop(1, _dc(hC, 0.2));
  ctx.fillStyle = g;
  if (L.hair === 'largo') {
    const halfW = headR * 1.05, bottom = hipY * 0.65;
    ctx.beginPath();
    ctx.moveTo(-headR * 0.5, headCy - headR * 0.3);
    ctx.quadraticCurveTo(-halfW, headCy, -halfW, headCy + headR * 0.8);
    ctx.quadraticCurveTo(-halfW, bottom, -halfW * 0.5, bottom + headR * 0.2);
    ctx.quadraticCurveTo(0, bottom + headR * 0.35, halfW * 0.5, bottom + headR * 0.2);
    ctx.quadraticCurveTo(halfW, bottom, halfW, headCy + headR * 0.8);
    ctx.quadraticCurveTo(halfW, headCy, headR * 0.5, headCy - headR * 0.3);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  } else {
    const topY = headCy + headR * 0.5, botY = hipY * 0.55, midW = headR * 0.22;
    ctx.beginPath();
    ctx.moveTo(-midW, topY);
    ctx.quadraticCurveTo(-midW * 1.3, (topY + botY) / 2, -midW * 0.5, botY);
    ctx.quadraticCurveTo(0, botY + headR * 0.15, midW * 0.5, botY);
    ctx.quadraticCurveTo(midW * 1.3, (topY + botY) / 2, midW, topY);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = u * 0.8;
    for (let i = 1; i < 5; i++) { const py = topY + (botY - topY) * i / 5; ctx.beginPath(); ctx.moveTo(-midW * 0.8, py); ctx.lineTo(midW * 0.8, py); ctx.stroke(); }
    ctx.fillStyle = '#E08CB0';
    ctx.beginPath(); ctx.arc(0, botY + headR * 0.05, headR * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = OC; ctx.lineWidth = u; ctx.stroke();
  }
}

function hairFront(ctx, L, headCy, headR, u) {
  const hC = L.hairColor, hL = _lc(hC, 0.3), hD = _dc(hC, 0.15);
  ctx.strokeStyle = OC; ctx.lineWidth = u; ctx.lineJoin = 'round';
  const cap = ctx.createLinearGradient(-headR, headCy - headR, headR, headCy);
  cap.addColorStop(0, hL); cap.addColorStop(0.5, hC); cap.addColorStop(1, hD);
  const topY = headCy - headR, browY = headCy - headR * 0.05;
  ctx.fillStyle = cap;
  ctx.beginPath();
  ctx.moveTo(-headR * 1.02, headCy);
  ctx.quadraticCurveTo(-headR * 1.05, topY + headR * 0.2, -headR * 0.4, topY - 2 * u);
  ctx.quadraticCurveTo(0, topY - 6 * u, headR * 0.4, topY - 2 * u);
  ctx.quadraticCurveTo(headR * 1.05, topY + headR * 0.2, headR * 1.02, headCy);
  ctx.quadraticCurveTo(headR * 0.7, browY + 8 * u, headR * 0.4, browY);
  ctx.quadraticCurveTo(headR * 0.18, browY + 9 * u, 0, browY);
  ctx.quadraticCurveTo(-headR * 0.18, browY + 9 * u, -headR * 0.4, browY);
  ctx.quadraticCurveTo(-headR * 0.7, browY + 8 * u, -headR * 1.02, headCy);
  ctx.closePath(); ctx.fill(); ctx.stroke();

  if (L.hair === 'colitas') {
    for (const sgn of [-1, 1]) {
      ctx.fillStyle = cap;
      ctx.beginPath(); ctx.arc(sgn * headR * 0.95, headCy + headR * 0.05, headR * 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sgn * headR * 1.1, headCy + headR * 0.2);
      ctx.quadraticCurveTo(sgn * headR * 1.35, headCy + headR * 0.9, sgn * headR * 0.85, headCy + headR * 1.5);
      ctx.quadraticCurveTo(sgn * headR * 0.65, headCy + headR * 0.9, sgn * headR * 0.65, headCy + headR * 0.2);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  } else if (L.hair === 'rodete') {
    ctx.fillStyle = cap;
    ctx.beginPath(); ctx.arc(0, topY - headR * 0.12, headR * 0.34, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (L.hair === 'corto') {
    for (const sgn of [-1, 1]) {
      ctx.fillStyle = cap;
      ctx.beginPath(); ctx.ellipse(sgn * headR * 0.92, headCy + headR * 0.15, headR * 0.2, headR * 0.36, sgn * -0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath(); ctx.ellipse(-headR * 0.4, topY + headR * 0.4, headR * 0.3, headR * 0.18, -0.5, 0, Math.PI * 2); ctx.fill();
}

function accessory(ctx, L, headCy, headR, neckY, hipY, u) {
  const a = L.accessory;
  ctx.strokeStyle = OC; ctx.lineWidth = u; ctx.lineJoin = 'round';
  if (a === 'moño') {
    const bx = -headR * 0.5, by = headCy - headR * 0.75, r = headR * 0.32;
    ctx.fillStyle = '#E84B7A';
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - r, by - r * 0.7); ctx.lineTo(bx - r, by + r * 0.7); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + r, by - r * 0.7); ctx.lineTo(bx + r, by + r * 0.7); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(bx, by, r * 0.34, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (a === 'lentes') {
    const eyeY = headCy + headR * 0.05, eyeDX = headR * 0.38;
    ctx.strokeStyle = '#222'; ctx.lineWidth = 2 * u; ctx.fillStyle = 'rgba(150,200,255,0.25)';
    for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sgn * eyeDX, eyeY, headR * 0.28, headR * 0.26, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-eyeDX * 0.4, eyeY); ctx.lineTo(eyeDX * 0.4, eyeY); ctx.stroke();
  } else if (a === 'corona') {
    const cw = headR * 0.9, cy = headCy - headR * 1.0;
    ctx.fillStyle = '#FFD33A';
    ctx.beginPath();
    ctx.moveTo(-cw, cy); ctx.lineTo(-cw, cy - headR * 0.3); ctx.lineTo(-cw * 0.5, cy - headR * 0.05);
    ctx.lineTo(0, cy - headR * 0.4); ctx.lineTo(cw * 0.5, cy - headR * 0.05); ctx.lineTo(cw, cy - headR * 0.3); ctx.lineTo(cw, cy);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#E8403A';
    for (const f of [-0.55, 0, 0.55]) { ctx.beginPath(); ctx.arc(f * cw, cy - headR * 0.02, headR * 0.08, 0, Math.PI * 2); ctx.fill(); }
  } else if (a === 'flor') {
    for (const f of [-0.55, -0.2, 0.2, 0.55]) miniFlower(ctx, f * headR, headCy - headR * 0.85, headR * 0.16);
  } else if (a === 'collar') {
    ctx.strokeStyle = '#F0C040'; ctx.lineWidth = headR * 0.08;
    ctx.beginPath(); ctx.arc(0, neckY + headR * 0.15, headR * 0.5, 0.15, Math.PI - 0.15); ctx.stroke();
    ctx.fillStyle = '#FF6090';
    ctx.beginPath(); ctx.arc(0, neckY + headR * 0.55, headR * 0.14, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = OC; ctx.lineWidth = u * 0.8; ctx.stroke();
  } else if (a === 'cartera') {
    // colgada al costado, a la altura de la cadera y justo por fuera de la mano
    const bx = headR * 1.35, by = hipY * 0.85;
    ctx.fillStyle = '#C0407A';
    ctx.beginPath(); ctx.roundRect(bx - headR * 0.32, by, headR * 0.64, headR * 0.5, 6 * u); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(bx, by, headR * 0.28, Math.PI, 0); ctx.stroke();
  }
}

// ── Look vigente (cacheado) ─────────────────────────────────────────────────
// Mi Mundo consulta esto por frame, así que no conviene releer localStorage
// cada vez; saveLook() refresca la caché.
let _cachedLook = null;
export function currentLook() {
  if (!_cachedLook) _cachedLook = loadLook();
  return _cachedLook;
}

// ── Sprite de la muñeca para Mi Mundo ───────────────────────────────────────
// Devuelve un canvas recortado (pies abajo, centrada) listo para dibujar como
// cualquier otro sprite del personaje. null mientras los PNG no cargaron.
const _dollCache = {};
export function dollSprite(look) {
  if (!spriteReady(look)) return null;
  const key = `${look.skin}|${look.hair}|${look.hairColor}|${look.outfit}|${look.shoes}|${look.accessory}`;
  if (key in _dollCache) return _dollCache[key];
  let cv;
  try { cv = document.createElement('canvas'); } catch (e) { return null; }
  const H = 300;                       // resolución interna
  const MX = H * 0.45, MT = H * 0.30;  // margen para polleras anchas y pelo alto
  cv.width  = Math.round(H * BODY.ar + MX * 2);
  cv.height = Math.round(H + MT + 12);
  const cx = cv.getContext('2d');
  paintDoll(cx, look, cv.width / 2, MT + H, 1, { shadow: false });
  const out = _trim(cv);
  _dollCache[key] = out;
  return out;
}

// recorta un canvas a la caja de sus píxeles visibles
function _trim(cv) {
  const cx = cv.getContext('2d');
  let d;
  try { d = cx.getImageData(0, 0, cv.width, cv.height); } catch (e) { return cv; }
  const p = d.data;
  let x0 = cv.width, y0 = cv.height, x1 = -1, y1 = -1;
  for (let y = 0; y < cv.height; y++) {
    for (let x = 0; x < cv.width; x++) {
      if (p[(y * cv.width + x) * 4 + 3] > 12) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return cv;
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  out.getContext('2d').drawImage(cv, x0, y0, w, h, 0, 0, w, h);
  return out;
}
