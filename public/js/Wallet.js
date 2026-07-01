const COINS_KEY    = 'wallet_coins';
const WARDROBE_KEY = 'wardrobe_items';
const EQUIPPED_KEY = 'wardrobe_equipped';

export function getCoins() {
  const v = parseInt(localStorage.getItem(COINS_KEY));
  return isNaN(v) ? 0 : v;
}
export function addCoins(n) {
  const c = getCoins() + n;
  try { localStorage.setItem(COINS_KEY, c); } catch(e){}
  return c;
}
export function spendCoins(n) {
  const c = getCoins();
  if (c < n) return false;
  try { localStorage.setItem(COINS_KEY, c - n); } catch(e){}
  return true;
}
export function getWardrobe() {
  try { const w = JSON.parse(localStorage.getItem(WARDROBE_KEY)) || {}; w['base'] = true; return w; } catch(e) { return { base: true }; }
}
export function addToWardrobe(id) {
  const w = getWardrobe(); w[id] = true;
  try { localStorage.setItem(WARDROBE_KEY, JSON.stringify(w)); } catch(e){}
}
export function getEquippedId()   { return localStorage.getItem(EQUIPPED_KEY) || null; }
export function setEquippedId(id) {
  try { if (id) localStorage.setItem(EQUIPPED_KEY, id); else localStorage.removeItem(EQUIPPED_KEY); } catch(e){}
}
