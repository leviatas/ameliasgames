// ── Shared fridge inventory ─────────────────────────────────────────────────
// Dishes cooked in "Cocina con Labubu" are stored here and show up in the
// fridge inside the houses, where they can be eaten.

const KEY = 'fridge_foods';

export function getFridge() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
}
function save(f) { try { localStorage.setItem(KEY, JSON.stringify(f)); } catch (e) {} }

export function addFood(name, emoji) {
  const f = getFridge();
  if (!f[name]) f[name] = { emoji, count: 0 };
  f[name].emoji = emoji;
  f[name].count++;
  save(f);
}

export function eatFood(name) {
  const f = getFridge();
  if (f[name] && f[name].count > 0) {
    f[name].count--;
    if (f[name].count <= 0) delete f[name];
    save(f);
    return true;
  }
  return false;
}

export function fridgeTotal() {
  return Object.values(getFridge()).reduce((a, b) => a + b.count, 0);
}
