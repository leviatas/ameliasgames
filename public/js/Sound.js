// ── Tiny synthesized SFX (no audio assets needed) ──────────────────────────
// A handful of short WebAudio tones for UI feedback. Lazily creates the
// AudioContext on first use (browsers block autoplay before a user gesture).

let ctx = null;
function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, type = 'sine', gain = 0.16, delay = 0) {
  const c = getCtx();
  if (!c) return;
  try {
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = type; osc.frequency.value = freq;
    osc.connect(g); g.connect(c.destination);
    const t0 = c.currentTime + delay;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.start(t0); osc.stop(t0 + dur + 0.03);
  } catch (e) { /* ignore — sound is a nice-to-have */ }
}

// ── Loop de música (ej: Sillas Musicales) ──
// Reprograma una melodía corta una y otra vez con setTimeout. Un contador de
// "generación" invalida los timers viejos al detener o reiniciar, para que
// nunca queden dos loops sonando a la vez.
const MUSIC_NOTES = [523.25, 587.33, 659.25, 523.25, 659.25, 587.33, 523.25, 392.0];
const MUSIC_NOTE_DUR = 0.26;
let musicTimer = null;
let musicGen = 0;

function scheduleMusic(gen) {
  if (gen !== musicGen) return;
  MUSIC_NOTES.forEach((f, i) => tone(f, MUSIC_NOTE_DUR * 0.85, 'triangle', 0.07, i * MUSIC_NOTE_DUR));
  musicTimer = setTimeout(() => scheduleMusic(gen), MUSIC_NOTES.length * MUSIC_NOTE_DUR * 1000);
}

export const Sound = {
  pick()      { tone(540, 0.07, 'sine', 0.12); },
  add()       { tone(660, 0.08, 'triangle', 0.15); tone(900, 0.07, 'triangle', 0.1, 0.05); },
  undo()      { tone(280, 0.1, 'sine', 0.12); },
  serveGood() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.15, 'triangle', 0.14, i * 0.07)); },
  serveBad()  { tone(190, 0.22, 'sawtooth', 0.1); },
  timeout()   { tone(240, 0.16, 'sawtooth', 0.1); tone(160, 0.22, 'sawtooth', 0.09, 0.13); },
  musicStart() {
    musicGen++;
    if (musicTimer) clearTimeout(musicTimer);
    scheduleMusic(musicGen);
  },
  musicStop() {
    musicGen++;
    if (musicTimer) { clearTimeout(musicTimer); musicTimer = null; }
  },
};
