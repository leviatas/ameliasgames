// ── Cinema: "Cine de Labubu" ────────────────────────────────────────────────
// A little movie theatre. The screen plays short animated "movies" drawn on the
// canvas; switch between them with the ‹ › arrows (or tap the screen sides).

export class Cinema {
  constructor(canvas) {
    this.canvas = canvas;
    this.t = 0;
    this.idx = 0;
    this.flash = 0;
    this.movies = [movieRunner, movieSpace, movieSea];
  }

  prev() { this.idx = (this.idx - 1 + this.movies.length) % this.movies.length; this.flash = 0.5; }
  next() { this.idx = (this.idx + 1) % this.movies.length; this.flash = 0.5; }

  pointer(x, y) {
    const W = this.canvas.width;
    if (x < W * 0.22) this.prev();
    else if (x > W * 0.78) this.next();
  }

  update(dt) { this.t += dt; if (this.flash > 0) this.flash -= dt; }

  render(ctx) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const s = Math.max(0.7, Math.min(W, H) / 720);

    // auditorium
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0B0A18'); bg.addColorStop(1, '#171130');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // screen rect
    let sw = W * 0.72, sh = sw * 0.5;
    const maxH = H * 0.56;
    if (sh > maxH) { sh = maxH; sw = sh * 2; }
    const sx = (W - sw) / 2, sy = H * 0.10;

    // screen glow + black base
    ctx.save();
    ctx.shadowColor = 'rgba(170,195,255,0.55)'; ctx.shadowBlur = 45 * s;
    ctx.fillStyle = '#000';
    ctx.fillRect(sx, sy, sw, sh);
    ctx.restore();

    // movie (clipped to the screen)
    ctx.save();
    ctx.beginPath(); ctx.rect(sx, sy, sw, sh); ctx.clip();
    this.movies[this.idx](ctx, this.t, { x: sx, y: sy, w: sw, h: sh });
    if (this.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${this.flash})`; ctx.fillRect(sx, sy, sw, sh); }
    ctx.restore();

    // screen frame
    ctx.strokeStyle = '#000'; ctx.lineWidth = 9 * s; ctx.strokeRect(sx, sy, sw, sh);
    ctx.strokeStyle = '#2A2440'; ctx.lineWidth = 2 * s; ctx.strokeRect(sx, sy, sw, sh);

    // curtains framing the screen
    this._curtains(ctx, sx, sy, sw, sh, s);

    // title + status
    const titles = ['Labubu corre', 'Viaje espacial', 'Mundo submarino'];
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFD23F'; ctx.font = `900 ${30 * s}px system-ui, sans-serif`;
    ctx.fillText(titles[this.idx], W / 2, sy + sh + 34 * s);
    ctx.fillStyle = '#A8A6C0'; ctx.font = `bold ${15 * s}px system-ui, sans-serif`;
    ctx.fillText(`▶ Reproduciendo  ·  ${this.idx + 1} / ${this.movies.length}`, W / 2, sy + sh + 60 * s);

    // seats + audience silhouettes
    this._seats(ctx, W, H, sy + sh + 78 * s, s);
  }

  _curtains(ctx, sx, sy, sw, sh, s) {
    const cw = sw * 0.12;
    for (const side of [0, 1]) {
      const x0 = side === 0 ? sx - cw * 0.6 : sx + sw - cw * 0.4;
      const folds = 4;
      for (let f = 0; f < folds; f++) {
        const fx = x0 + (cw / folds) * f;
        const g = ctx.createLinearGradient(fx, 0, fx + cw / folds, 0);
        g.addColorStop(0, '#6E1020'); g.addColorStop(0.5, '#A21D32'); g.addColorStop(1, '#6E1020');
        ctx.fillStyle = g;
        ctx.fillRect(fx, sy - 6 * s, cw / folds + 1, sh + 12 * s);
      }
    }
    // valance across the top
    const vg = ctx.createLinearGradient(0, sy - 26 * s, 0, sy + 6 * s);
    vg.addColorStop(0, '#A21D32'); vg.addColorStop(1, '#6E1020');
    ctx.fillStyle = vg;
    ctx.beginPath();
    ctx.moveTo(sx - sw * 0.08, sy - 26 * s);
    ctx.lineTo(sx + sw + sw * 0.08, sy - 26 * s);
    ctx.lineTo(sx + sw + sw * 0.08, sy + 2 * s);
    for (let i = 8; i >= 0; i--) {
      const xx = sx - sw * 0.08 + (sw * 1.16) * (i / 8);
      ctx.quadraticCurveTo(xx + sw * 0.073, sy + 22 * s, xx, sy + 2 * s);
    }
    ctx.closePath(); ctx.fill();
  }

  _seats(ctx, W, H, y0, s) {
    const rows = 3;
    for (let r = 0; r < rows; r++) {
      const y = y0 + r * 30 * s;
      const seatW = 46 * s, gap = 10 * s, n = Math.ceil(W / (seatW + gap)) + 1;
      const shade = 30 - r * 6;
      ctx.fillStyle = `rgb(${shade},${shade - 6},${shade + 8})`;
      for (let i = 0; i < n; i++) {
        const x = (i - 0.5) * (seatW + gap) + ((r % 2) * (seatW / 2));
        ctx.beginPath(); ctx.roundRect(x, y, seatW, 26 * s, 8 * s); ctx.fill();
      }
      // audience heads peeking over the front row
      if (r === 0) {
        ctx.fillStyle = '#0A0814';
        for (let i = 0; i < n; i++) {
          if ((i * 7 + 3) % 3 === 0) continue;
          const x = (i - 0.5) * (seatW + gap) + seatW / 2;
          ctx.beginPath(); ctx.arc(x, y - 2 * s, 11 * s, Math.PI, 0); ctx.fill();
          ctx.beginPath(); ctx.arc(x - 7 * s, y - 6 * s, 4 * s, 0, Math.PI * 2);
          ctx.arc(x + 7 * s, y - 6 * s, 4 * s, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  }

  destroy() {}
}

// ── Movies (each draws an animated scene inside the screen rect R) ────────────

function movieRunner(ctx, t, R) {
  const sky = ctx.createLinearGradient(R.x, R.y, R.x, R.y + R.h);
  sky.addColorStop(0, '#8FD3FF'); sky.addColorStop(1, '#E3F7FF');
  ctx.fillStyle = sky; ctx.fillRect(R.x, R.y, R.w, R.h);

  // sun
  ctx.fillStyle = '#FFE066';
  ctx.beginPath(); ctx.arc(R.x + R.w * 0.82, R.y + R.h * 0.22, R.h * 0.1, 0, Math.PI * 2); ctx.fill();

  // clouds
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  for (let i = 0; i < 3; i++) {
    const cx = R.x + ((R.w * (0.3 + i * 0.34) - t * 24) % (R.w + 120) + R.w + 120) % (R.w + 120) - 60;
    const cy = R.y + R.h * (0.18 + i * 0.07);
    ctx.beginPath();
    ctx.arc(cx, cy, R.h * 0.05, 0, 7); ctx.arc(cx + R.h * 0.05, cy + R.h * 0.01, R.h * 0.04, 0, 7);
    ctx.arc(cx - R.h * 0.05, cy + R.h * 0.01, R.h * 0.04, 0, 7); ctx.fill();
  }

  const groundY = R.y + R.h * 0.72;
  // parallax hills
  for (let layer = 0; layer < 2; layer++) {
    ctx.fillStyle = layer ? '#5FB84A' : '#86D86A';
    const speed = layer ? 70 : 38, amp = R.h * (layer ? 0.14 : 0.20), step = R.w * 0.28;
    const off = (t * speed) % step;
    ctx.beginPath(); ctx.moveTo(R.x, groundY);
    for (let x = -step; x < R.w + step; x += step) {
      ctx.quadraticCurveTo(R.x + x - off + step / 2, groundY - amp, R.x + x - off + step, groundY);
    }
    ctx.lineTo(R.x + R.w, R.y + R.h); ctx.lineTo(R.x, R.y + R.h); ctx.fill();
  }
  // ground
  ctx.fillStyle = '#C8A86A'; ctx.fillRect(R.x, groundY, R.w, R.h);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = R.h * 0.012; ctx.setLineDash([R.w * 0.05, R.w * 0.04]);
  ctx.beginPath(); ctx.moveTo(R.x, groundY + R.h * 0.12); ctx.lineTo(R.x + R.w, groundY + R.h * 0.12);
  ctx.lineTo(R.x + R.w, groundY + R.h * 0.12); ctx.stroke(); ctx.setLineDash([]);

  // running Labubu
  const u = R.h * 0.16;
  const bob = Math.abs(Math.sin(t * 9)) * u * 0.25;
  const cx = R.x + R.w * 0.34, cy = groundY - u * 0.1 - bob;
  ctx.save(); ctx.translate(cx, cy);
  // legs (alternating)
  const sw = Math.sin(t * 16);
  ctx.strokeStyle = '#8A5BB0'; ctx.lineWidth = u * 0.22; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(sw * u * 0.35, u * 0.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-sw * u * 0.35, u * 0.5); ctx.stroke();
  // body
  ctx.fillStyle = '#A06BCB'; ctx.beginPath(); ctx.ellipse(0, -u * 0.35, u * 0.42, u * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  // arm
  ctx.strokeStyle = '#8A5BB0'; ctx.lineWidth = u * 0.18;
  ctx.beginPath(); ctx.moveTo(0, -u * 0.45); ctx.lineTo(-sw * u * 0.4, -u * 0.2); ctx.stroke();
  // head
  ctx.fillStyle = '#C49BE0'; ctx.beginPath(); ctx.arc(u * 0.1, -u * 0.95, u * 0.4, 0, Math.PI * 2); ctx.fill();
  // ears
  ctx.beginPath(); ctx.ellipse(u * -0.05, -u * 1.35, u * 0.12, u * 0.28, -0.2, 0, 7);
  ctx.ellipse(u * 0.28, -u * 1.35, u * 0.12, u * 0.28, 0.2, 0, 7); ctx.fill();
  // eyes
  ctx.fillStyle = '#2A1A3A';
  ctx.beginPath(); ctx.arc(u * 0.0, -u * 0.95, u * 0.06, 0, 7); ctx.arc(u * 0.24, -u * 0.95, u * 0.06, 0, 7); ctx.fill();
  ctx.restore();
}

function movieSpace(ctx, t, R) {
  const sky = ctx.createLinearGradient(R.x, R.y, R.x, R.y + R.h);
  sky.addColorStop(0, '#05030F'); sky.addColorStop(1, '#1A1040');
  ctx.fillStyle = sky; ctx.fillRect(R.x, R.y, R.w, R.h);

  // stars (twinkle)
  for (let i = 0; i < 60; i++) {
    const sxp = R.x + ((i * 73) % 100) / 100 * R.w;
    const syp = R.y + ((i * 137) % 100) / 100 * R.h;
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i));
    ctx.fillStyle = `rgba(255,255,255,${tw})`;
    ctx.beginPath(); ctx.arc(sxp, syp, ((i % 3) + 1) * R.h * 0.004, 0, Math.PI * 2); ctx.fill();
  }

  // ringed planet
  ctx.save(); ctx.translate(R.x + R.w * 0.78, R.y + R.h * 0.30);
  ctx.fillStyle = '#E08A4A'; ctx.beginPath(); ctx.arc(0, 0, R.h * 0.16, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#C06A2A'; ctx.beginPath(); ctx.arc(R.h * 0.05, R.h * 0.04, R.h * 0.05, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,220,160,0.7)'; ctx.lineWidth = R.h * 0.03;
  ctx.beginPath(); ctx.ellipse(0, 0, R.h * 0.28, R.h * 0.09, -0.4, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();

  // moon
  ctx.fillStyle = '#D8D8E8'; ctx.beginPath(); ctx.arc(R.x + R.w * 0.16, R.y + R.h * 0.7, R.h * 0.08, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(150,150,170,0.5)';
  ctx.beginPath(); ctx.arc(R.x + R.w * 0.14, R.y + R.h * 0.68, R.h * 0.02, 0, 7); ctx.arc(R.x + R.w * 0.18, R.y + R.h * 0.72, R.h * 0.015, 0, 7); ctx.fill();

  // rocket flying across (bobbing)
  const px = R.x + ((t * 90) % (R.w + 160)) - 80;
  const py = R.y + R.h * 0.5 + Math.sin(t * 2) * R.h * 0.08;
  const u = R.h * 0.12;
  ctx.save(); ctx.translate(px, py); ctx.rotate(0.4);
  // flame
  const fl = 1 + Math.sin(t * 30) * 0.3;
  ctx.fillStyle = '#FFB02E'; ctx.beginPath(); ctx.moveTo(-u * 0.5, u * 0.5); ctx.lineTo(0, u * (1.1 * fl)); ctx.lineTo(u * 0.5, u * 0.5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#FF5D5D'; ctx.beginPath(); ctx.moveTo(-u * 0.28, u * 0.55); ctx.lineTo(0, u * (0.85 * fl)); ctx.lineTo(u * 0.28, u * 0.55); ctx.closePath(); ctx.fill();
  // body
  ctx.fillStyle = '#EDEDF5'; ctx.beginPath();
  ctx.moveTo(0, -u * 1.1); ctx.quadraticCurveTo(u * 0.6, -u * 0.2, u * 0.5, u * 0.55);
  ctx.lineTo(-u * 0.5, u * 0.55); ctx.quadraticCurveTo(-u * 0.6, -u * 0.2, 0, -u * 1.1); ctx.fill();
  // fins
  ctx.fillStyle = '#E8503A';
  ctx.beginPath(); ctx.moveTo(-u * 0.5, u * 0.2); ctx.lineTo(-u * 0.85, u * 0.6); ctx.lineTo(-u * 0.45, u * 0.55); ctx.fill();
  ctx.beginPath(); ctx.moveTo(u * 0.5, u * 0.2); ctx.lineTo(u * 0.85, u * 0.6); ctx.lineTo(u * 0.45, u * 0.55); ctx.fill();
  // window
  ctx.fillStyle = '#5AC8FA'; ctx.beginPath(); ctx.arc(0, -u * 0.25, u * 0.26, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#9AA'; ctx.lineWidth = u * 0.08; ctx.stroke();
  ctx.restore();
}

function movieSea(ctx, t, R) {
  const sea = ctx.createLinearGradient(R.x, R.y, R.x, R.y + R.h);
  sea.addColorStop(0, '#1E6E9E'); sea.addColorStop(1, '#0A3A5A');
  ctx.fillStyle = sea; ctx.fillRect(R.x, R.y, R.w, R.h);

  // light rays
  ctx.save(); ctx.globalAlpha = 0.12; ctx.fillStyle = '#CFF0FF';
  for (let i = 0; i < 4; i++) {
    const x = R.x + R.w * (0.2 + i * 0.2) + Math.sin(t * 0.5 + i) * R.w * 0.02;
    ctx.beginPath(); ctx.moveTo(x, R.y); ctx.lineTo(x + R.w * 0.06, R.y); ctx.lineTo(x + R.w * 0.18, R.y + R.h); ctx.lineTo(x + R.w * 0.06, R.y + R.h); ctx.fill();
  }
  ctx.restore();

  // sandy bottom
  ctx.fillStyle = '#D9C18A';
  ctx.beginPath(); ctx.moveTo(R.x, R.y + R.h);
  for (let x = 0; x <= R.w; x += R.w * 0.1) ctx.lineTo(R.x + x, R.y + R.h * 0.86 + Math.sin(x * 0.05) * R.h * 0.03);
  ctx.lineTo(R.x + R.w, R.y + R.h); ctx.fill();

  // seaweed swaying
  ctx.strokeStyle = '#3FA34D'; ctx.lineWidth = R.h * 0.02; ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const bx = R.x + R.w * (0.1 + i * 0.2);
    ctx.beginPath(); ctx.moveTo(bx, R.y + R.h * 0.9);
    for (let k = 1; k <= 4; k++) {
      const yy = R.y + R.h * (0.9 - k * 0.12);
      ctx.lineTo(bx + Math.sin(t * 2 + i + k * 0.6) * R.w * 0.02, yy);
    }
    ctx.stroke();
  }

  // bubbles rising
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 14; i++) {
    const bx = R.x + ((i * 53) % 100) / 100 * R.w;
    const ph = (t * (0.2 + (i % 3) * 0.1) + i * 0.3) % 1;
    const by = R.y + R.h - ph * R.h;
    ctx.beginPath(); ctx.arc(bx + Math.sin(ph * 6) * R.w * 0.01, by, R.h * (0.008 + (i % 3) * 0.004), 0, Math.PI * 2); ctx.fill();
  }

  // fish swimming across
  const fishCols = ['#FF8C42', '#FFD23F', '#FF5D8F'];
  for (let i = 0; i < 3; i++) {
    const dir = i % 2 === 0 ? 1 : -1;
    const span = R.w + 120;
    let fx = (t * (60 + i * 20) * dir);
    fx = ((fx % span) + span) % span;
    const px = dir === 1 ? R.x - 60 + fx : R.x + R.w + 60 - fx;
    const py = R.y + R.h * (0.3 + i * 0.18) + Math.sin(t * 2 + i) * R.h * 0.04;
    const u = R.h * 0.07;
    ctx.save(); ctx.translate(px, py); ctx.scale(dir, 1);
    ctx.fillStyle = fishCols[i];
    ctx.beginPath(); ctx.ellipse(0, 0, u * 1.4, u, 0, 0, Math.PI * 2); ctx.fill();
    // tail (flapping)
    const flap = Math.sin(t * 10 + i) * u * 0.3;
    ctx.beginPath(); ctx.moveTo(-u * 1.3, 0); ctx.lineTo(-u * 2.1, -u * 0.6 + flap); ctx.lineTo(-u * 2.1, u * 0.6 + flap); ctx.closePath(); ctx.fill();
    // eye
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(u * 0.7, -u * 0.2, u * 0.22, 0, 7); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(u * 0.75, -u * 0.2, u * 0.1, 0, 7); ctx.fill();
    ctx.restore();
  }
}
