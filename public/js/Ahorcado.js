// ── Ahorcado (2P, por turnos): adivinen la palabra alternando letras ─────────

const WORDS = [
  'GATO', 'PERRO', 'LUNA', 'SOL', 'FLOR', 'MAR', 'CIELO', 'NUBE', 'PLAYA',
  'MANZANA', 'CONEJO', 'TIGRE', 'LEON', 'PATO', 'OSO', 'CABALLO', 'PAJARO',
  'LIBRO', 'ESTRELLA', 'ARBOL', 'CASA', 'PELOTA', 'GLOBO', 'HELADO', 'CORAZON',
  'MARIPOSA', 'JARDIN', 'COCINA', 'ROBOT', 'DINOSAURIO', 'UNICORNIO', 'RATON',
  'ABEJA', 'VACA', 'RANA', 'PEZ', 'QUESO', 'PAN', 'LECHE', 'HUEVO', 'FRESA',
  'LIMON', 'UVA', 'PIZZA', 'TREN', 'AVION', 'BARCO', 'COCHE', 'BICICLETA',
  'GUITARRA', 'PIANO', 'RELOJ', 'ZAPATO', 'SOMBRERO', 'PARAGUAS', 'VENTANA',
  'PUERTA', 'SILLA', 'MESA', 'LAMPARA',
];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const MAX_WRONG = 6;

export class Ahorcado {
  constructor(canvas) {
    this.canvas = canvas;
    this._reset();
  }

  _reset() {
    const W = this.canvas.width, H = this.canvas.height;
    this.W = W; this.H = H;
    this.word = WORDS[Math.floor(Math.random() * WORDS.length)];
    this.guessed = [];
    this.wrongCount = 0;
    this.turn = Math.random() < 0.5 ? 'p1' : 'p2';
    this.score = { p1: 0, p2: 0 };
    this.phase = 'playing';   // 'playing' | 'over'
    this.winner = null;
  }

  _keyboardLayout() {
    const W = this.W, H = this.H;
    const cols = 13, rows = 2;
    const areaW = W * 0.88, areaH = H * 0.26;
    const key = Math.min(areaW / cols, areaH / rows);
    const gw = key * cols, gh = key * rows;
    return { cols, rows, key, x0: W / 2 - gw / 2, y0: H - gh - H * 0.04 };
  }

  _keyAt(cx, cy) {
    const { cols, rows, key, x0, y0 } = this._keyboardLayout();
    const col = Math.floor((cx - x0) / key), row = Math.floor((cy - y0) / key);
    if (col < 0 || col >= cols || row < 0 || row >= rows) return null;
    const idx = row * cols + col;
    return idx < LETTERS.length ? LETTERS[idx] : null;
  }

  update() {}

  pointerDown(cx, cy, player) {
    if (this.phase === 'over') { this._reset(); return; }
    if (player && player !== this.turn) return;
    const letter = this._keyAt(cx, cy);
    if (!letter || this.guessed.includes(letter)) return;

    this.guessed.push(letter);
    if (this.word.includes(letter)) {
      let count = 0;
      for (const ch of this.word) if (ch === letter) count++;
      this.score[this.turn] += count;
      if ([...this.word].every(ch => this.guessed.includes(ch))) {
        this.phase = 'over';
        this.winner = this.score.p1 === this.score.p2 ? 'empate' : (this.score.p1 > this.score.p2 ? 'p1' : 'p2');
        return;
      }
    } else {
      this.wrongCount++;
      if (this.wrongCount >= MAX_WRONG) {
        this.phase = 'over';
        this.winner = this.score.p1 === this.score.p2 ? 'empate' : (this.score.p1 > this.score.p2 ? 'p1' : 'p2');
        return;
      }
    }
    this.turn = this.turn === 'p1' ? 'p2' : 'p1';
  }
  pointerMove() {}
  pointerUp() {}

  _drawHangman(ctx, x0, y0, scale) {
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = Math.max(2, scale * 0.05); ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y0 + scale); ctx.lineTo(x0 + scale * 0.6, y0 + scale);
    ctx.moveTo(x0 + scale * 0.2, y0 + scale); ctx.lineTo(x0 + scale * 0.2, y0);
    ctx.lineTo(x0 + scale * 0.55, y0); ctx.lineTo(x0 + scale * 0.55, y0 + scale * 0.15);
    ctx.stroke();

    const n = this.wrongCount;
    const hx = x0 + scale * 0.55, hy = y0 + scale * 0.15, r = scale * 0.1;
    ctx.strokeStyle = '#FF7A7A';
    if (n >= 1) { ctx.beginPath(); ctx.arc(hx, hy + r, r, 0, Math.PI * 2); ctx.stroke(); }
    if (n >= 2) { ctx.beginPath(); ctx.moveTo(hx, hy + r * 2); ctx.lineTo(hx, hy + r * 2 + scale * 0.3); ctx.stroke(); }
    if (n >= 3) { ctx.beginPath(); ctx.moveTo(hx, hy + r * 2 + scale * 0.08); ctx.lineTo(hx - scale * 0.18, hy + r * 2 + scale * 0.2); ctx.stroke(); }
    if (n >= 4) { ctx.beginPath(); ctx.moveTo(hx, hy + r * 2 + scale * 0.08); ctx.lineTo(hx + scale * 0.18, hy + r * 2 + scale * 0.2); ctx.stroke(); }
    if (n >= 5) { ctx.beginPath(); ctx.moveTo(hx, hy + r * 2 + scale * 0.3); ctx.lineTo(hx - scale * 0.18, hy + r * 2 + scale * 0.52); ctx.stroke(); }
    if (n >= 6) { ctx.beginPath(); ctx.moveTo(hx, hy + r * 2 + scale * 0.3); ctx.lineTo(hx + scale * 0.18, hy + r * 2 + scale * 0.52); ctx.stroke(); }
  }

  render(ctx) {
    const { W, H } = this;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#241030'); g.addColorStop(1, '#12081e');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.font = `900 ${H * 0.05}px system-ui`;
    if (this.phase === 'playing') {
      const cfg = this.turn === 'p1' ? { color: '#FF88BB', name: 'P1' } : { color: '#88BBFF', name: 'P2' };
      ctx.fillStyle = cfg.color;
      ctx.fillText(`Turno de ${cfg.name}`, W / 2, 10);
    }
    ctx.font = `bold ${H * 0.035}px system-ui`;
    ctx.textAlign = 'left'; ctx.fillStyle = '#FF88BB'; ctx.fillText(`P1: ${this.score.p1}`, 12, 44);
    ctx.textAlign = 'right'; ctx.fillStyle = '#88BBFF'; ctx.fillText(`P2: ${this.score.p2}`, W - 12, 44);

    this._drawHangman(ctx, W * 0.08, H * 0.1, Math.min(W * 0.22, H * 0.34));

    const letters = [...this.word];
    const fs = Math.min(W * 0.055, H * 0.09);
    ctx.font = `900 ${fs}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const spacing = fs * 0.95;
    let sx = W / 2 - (letters.length * spacing) / 2 + spacing / 2;
    for (const ch of letters) {
      const shown = this.guessed.includes(ch);
      ctx.fillStyle = shown ? '#fff' : 'rgba(255,255,255,0.28)';
      ctx.fillText(shown ? ch : '_', sx, H * 0.34);
      sx += spacing;
    }

    const { cols, rows, key, x0, y0 } = this._keyboardLayout();
    ctx.font = `bold ${key * 0.42}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < LETTERS.length; i++) {
      const col = i % cols, row = Math.floor(i / cols);
      const kx = x0 + col * key, ky = y0 + row * key;
      const L = LETTERS[i];
      const guessedIt = this.guessed.includes(L);
      const correct = guessedIt && this.word.includes(L);
      ctx.fillStyle = !guessedIt ? 'rgba(255,255,255,0.10)' : (correct ? 'rgba(120,255,150,0.28)' : 'rgba(255,90,90,0.28)');
      ctx.beginPath(); ctx.roundRect(kx + 2, ky + 2, key - 4, key - 4, 6); ctx.fill();
      ctx.strokeStyle = !guessedIt ? 'rgba(255,255,255,0.3)' : (correct ? '#7CFF9A' : '#FF6B6B');
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(kx + 2, ky + 2, key - 4, key - 4, 6); ctx.stroke();
      ctx.fillStyle = guessedIt ? 'rgba(255,255,255,0.5)' : '#fff';
      ctx.fillText(L, kx + key / 2, ky + key / 2);
    }

    if (this.phase === 'over') {
      ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `900 ${H * 0.14}px system-ui`;
      if (this.winner === 'empate') { ctx.fillStyle = '#FFD700'; ctx.fillText('🤝 ¡Empate!', W / 2, H * 0.36); }
      else {
        const cfg = this.winner === 'p1' ? { color: '#FF88BB', name: 'P1' } : { color: '#88BBFF', name: 'P2' };
        ctx.fillStyle = cfg.color; ctx.fillText(`¡Ganó ${cfg.name}!`, W / 2, H * 0.36);
      }
      ctx.font = `bold ${H * 0.07}px system-ui`; ctx.fillStyle = '#ffffffaa';
      ctx.fillText(`La palabra era: ${this.word}`, W / 2, H * 0.52);
      ctx.font = `${H * 0.055}px system-ui`; ctx.fillStyle = '#ffffff66';
      ctx.fillText('Tocá para jugar de nuevo', W / 2, H * 0.66);
    }
  }

  // ── Online sync: host broadcasts this every frame, guest applies it ──────
  getNetState() {
    return {
      W: this.W, H: this.H,
      word: this.word, guessed: this.guessed, wrongCount: this.wrongCount,
      turn: this.turn, score: this.score, phase: this.phase, winner: this.winner,
    };
  }

  setNetState(s) {
    this.W = s.W; this.H = s.H;
    this.word = s.word; this.guessed = s.guessed; this.wrongCount = s.wrongCount;
    this.turn = s.turn; this.score = s.score; this.phase = s.phase; this.winner = s.winner;
  }
}
