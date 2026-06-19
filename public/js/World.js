// ── Colour helpers ────────────────────────────────────────────────────────

function lerpColor(hex, amount) {
  // amount > 0 → lighter, < 0 → darker
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const f = amount > 0 ? amount : 0;
  const d = amount < 0 ? -amount : 0;
  return `rgb(${Math.min(255, Math.round(r + (255 - r) * f - r * d))},${
    Math.min(255, Math.round(g + (255 - g) * f - g * d))},${
    Math.min(255, Math.round(b + (255 - b) * f - b * d))})`;
}

// ── House ─────────────────────────────────────────────────────────────────

class House {
  constructor(x, y, wallColor = '#FFE58A', roofColor = '#C03020', shutterColor = '#4A8A50') {
    this.x = x;
    this.y = y;
    this._wall    = wallColor;
    this._roof    = roofColor;
    this._shutter = shutterColor;
  }

  containsPoint(wx, wy, worldH) {
    const s  = 0.72 + (this.y / worldH) * 0.48;
    const HW = 60 * s;   // half width
    const WH = 92 * s;   // wall height above y
    return wx >= this.x - HW && wx <= this.x + HW &&
           wy >= this.y - WH && wy <= this.y + 35 * s;
  }

  draw(ctx, cam, depthScaleFn) {
    const sx = Math.round(this.x - cam.x);
    const sy = Math.round(this.y - cam.y);
    if (sx < -200 || sx > ctx.canvas.width  + 200) return;
    if (sy < -300 || sy > ctx.canvas.height + 40)  return;

    const s   = depthScaleFn(this.y);
    const W   = 120 * s;   // wall half-width → full = 240*s... too big, let's use half
    const HW  = W / 2;     // half-wall width
    const WH  = 92 * s;    // wall height
    const RH  = 68 * s;    // roof height above wall
    const OV  = 14 * s;    // roof overhang
    const wallTop = sy - WH;

    // ── Ground shadow ──────────────────────────────────────────────
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(sx + 10 * s, sy + 10 * s, HW * 0.9, 16 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // ── Front garden path ─────────────────────────────────────────
    ctx.fillStyle = '#C8B888';
    ctx.beginPath();
    ctx.roundRect(sx - 14 * s, sy, 28 * s, 30 * s, 4 * s);
    ctx.fill();
    // Path stones
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1 * s;
    for (let pi = 0; pi < 3; pi++) {
      ctx.beginPath();
      ctx.moveTo(sx - 14 * s, sy + (pi + 0.5) * 10 * s);
      ctx.lineTo(sx + 14 * s, sy + (pi + 0.5) * 10 * s);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx, sy + 30 * s);
    ctx.stroke();

    // ── Fence in front ────────────────────────────────────────────
    this._drawFence(ctx, sx, sy + 28 * s, HW + 20 * s, s);

    // ── Front yard bushes ─────────────────────────────────────────
    this._drawBush(ctx, sx - HW + 10 * s, sy + 4 * s, 0.55 * s, '#3A9A40');
    this._drawBush(ctx, sx + HW - 10 * s, sy + 4 * s, 0.55 * s, '#3A9A40');

    // ── Foundation strip ──────────────────────────────────────────
    ctx.fillStyle = lerpColor(this._wall, -0.15);
    ctx.beginPath();
    ctx.roundRect(sx - HW, sy - 7 * s, W, 9 * s, 2 * s);
    ctx.fill();

    // ── Main wall ────────────────────────────────────────────────
    ctx.fillStyle = this._wall;
    ctx.strokeStyle = lerpColor(this._wall, -0.12);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(sx - HW, wallTop, W, WH, [0, 0, 2 * s, 2 * s]);
    ctx.fill();
    ctx.stroke();

    // Siding texture (horizontal lines)
    ctx.strokeStyle = `rgba(0,0,0,0.07)`;
    ctx.lineWidth = 0.9;
    for (let yl = wallTop + 8 * s; yl < sy - 8 * s; yl += 9 * s) {
      ctx.beginPath();
      ctx.moveTo(sx - HW + 2, yl);
      ctx.lineTo(sx + HW - 2, yl);
      ctx.stroke();
    }

    // Corner trim
    ctx.fillStyle = lerpColor(this._wall, 0.15);
    ctx.fillRect(sx - HW, wallTop, 7 * s, WH);
    ctx.fillRect(sx + HW - 7 * s, wallTop, 7 * s, WH);

    // Fascia board (along roof base)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(sx - HW - OV, wallTop - 5 * s, W + OV * 2, 6 * s);

    // ── Chimney (drawn before roof so roof covers base) ───────────
    const csx = sx + 26 * s;
    const cTop = wallTop - RH - 18 * s;
    const cBot = wallTop + 8 * s;
    const cW   = 16 * s;
    ctx.fillStyle = '#C04030';
    ctx.fillRect(csx - cW / 2, cTop, cW, cBot - cTop);
    // Brick rows
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 0.8;
    for (let br = 0; br * 7 * s < cBot - cTop; br++) {
      const by = cTop + br * 7 * s;
      ctx.beginPath();
      ctx.moveTo(csx - cW / 2, by); ctx.lineTo(csx + cW / 2, by); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(csx + (br % 2 ? 0 : cW / 2), by);
      ctx.lineTo(csx + (br % 2 ? 0 : cW / 2), by + 7 * s); ctx.stroke();
    }
    // Chimney cap
    ctx.fillStyle = '#901820';
    ctx.fillRect(csx - cW / 2 - 2 * s, cTop, cW + 4 * s, 5 * s);

    // Animated smoke
    const t = performance.now() * 0.001;
    for (let pi = 0; pi < 3; pi++) {
      const phase   = ((t * 0.4 + pi * 0.38) % 1);
      const puffR   = (3 + phase * 10) * s;
      const puffX   = csx + Math.sin(t * 1.2 + pi * 2) * 4 * s;
      const puffY   = cTop - phase * 28 * s;
      ctx.globalAlpha = (1 - phase) * 0.4;
      ctx.fillStyle   = '#D0C8C0';
      ctx.beginPath();
      ctx.arc(puffX, puffY, puffR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ── Roof ─────────────────────────────────────────────────────
    const roofGrad = ctx.createLinearGradient(sx, wallTop - RH, sx, wallTop);
    roofGrad.addColorStop(0, lerpColor(this._roof, -0.12));
    roofGrad.addColorStop(1, lerpColor(this._roof,  0.08));
    ctx.fillStyle = roofGrad;
    ctx.strokeStyle = lerpColor(this._roof, -0.2);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx - HW - OV, wallTop);
    ctx.lineTo(sx, wallTop - RH);
    ctx.lineTo(sx + HW + OV, wallTop);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Roof tile lines
    ctx.strokeStyle = `rgba(0,0,0,0.1)`;
    ctx.lineWidth = 1.1;
    const steps = 8;
    for (let ri = 1; ri < steps; ri++) {
      const frac = ri / steps;
      const lw   = (HW + OV) * frac;
      const ly   = wallTop - RH + RH * frac;
      ctx.beginPath();
      ctx.moveTo(sx - lw, ly);
      ctx.lineTo(sx + lw, ly);
      ctx.stroke();
    }
    // Ridge cap
    ctx.fillStyle = lerpColor(this._roof, -0.25);
    ctx.beginPath();
    ctx.roundRect(sx - 6 * s, wallTop - RH - 4 * s, 12 * s, 8 * s, 3 * s);
    ctx.fill();

    // ── Windows ──────────────────────────────────────────────────
    const winY = wallTop + WH * 0.35;
    this._drawWindow(ctx, sx - HW * 0.52, winY, s);
    this._drawWindow(ctx, sx + HW * 0.52, winY, s);

    // ── Door ─────────────────────────────────────────────────────
    this._drawDoor(ctx, sx, sy, s);

    ctx.restore();
  }

  _drawWindow(ctx, wx, wy, s) {
    const ww = 28 * s, wh = 26 * s;
    const shW = 9 * s;

    // Shutters
    ctx.fillStyle = this._shutter;
    ctx.beginPath();
    ctx.roundRect(wx - ww / 2 - shW, wy - wh / 2, shW, wh, [2 * s, 0, 0, 2 * s]);
    ctx.roundRect(wx + ww / 2, wy - wh / 2, shW, wh, [0, 2 * s, 2 * s, 0]);
    ctx.fill();
    // Shutter slats
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 0.8;
    for (let sl = 4 * s; sl < wh; sl += 5 * s) {
      ctx.beginPath();
      ctx.moveTo(wx - ww / 2 - shW + 1, wy - wh / 2 + sl);
      ctx.lineTo(wx - ww / 2 - 1, wy - wh / 2 + sl);
      ctx.moveTo(wx + ww / 2 + 1, wy - wh / 2 + sl);
      ctx.lineTo(wx + ww / 2 + shW - 1, wy - wh / 2 + sl);
      ctx.stroke();
    }

    // Outer frame (white)
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(wx - ww / 2 - 3 * s, wy - wh / 2 - 3 * s, ww + 6 * s, wh + 6 * s, 3 * s);
    ctx.fill();

    // Glass
    ctx.fillStyle = '#B8DAFF';
    ctx.fillRect(wx - ww / 2, wy - wh / 2, ww, wh);

    // Panes
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5 * s;
    ctx.beginPath();
    ctx.moveTo(wx, wy - wh / 2); ctx.lineTo(wx, wy + wh / 2);
    ctx.moveTo(wx - ww / 2, wy); ctx.lineTo(wx + ww / 2, wy);
    ctx.stroke();

    // Glass shine
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.moveTo(wx - ww / 2 + 2 * s, wy - wh / 2 + 2 * s);
    ctx.lineTo(wx - 3 * s,           wy - wh / 2 + 2 * s);
    ctx.lineTo(wx - ww / 2 + 2 * s, wy - 4 * s);
    ctx.closePath();
    ctx.fill();

    // Flower box
    ctx.fillStyle = '#7B3B10';
    ctx.beginPath();
    ctx.roundRect(wx - ww / 2 - 4 * s, wy + wh / 2, ww + 8 * s, 9 * s, 2 * s);
    ctx.fill();
    const fColors = ['#FF6B8A', '#FFD700', '#FF8C00', '#C084FC', '#FF4500'];
    for (let fi = 0; fi < 5; fi++) {
      ctx.fillStyle = fColors[fi % fColors.length];
      ctx.beginPath();
      ctx.arc(wx - ww / 2 + (fi + 0.5) * (ww / 5), wy + wh / 2 - 4 * s, 3.5 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawDoor(ctx, sx, sy, s) {
    const dw = 26 * s, dh = 46 * s;

    // Outer frame
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(sx - dw / 2 - 4 * s, sy - dh - 3 * s, dw + 8 * s, dh + 3 * s, [4 * s, 4 * s, 0, 0]);
    ctx.fill();

    // Door body
    const doorColor = lerpColor(this._shutter, -0.05);
    ctx.fillStyle = doorColor;
    ctx.beginPath();
    ctx.roundRect(sx - dw / 2, sy - dh, dw, dh, [2 * s, 2 * s, 0, 0]);
    ctx.fill();

    // Raised panels (4 panels)
    const panelColor = lerpColor(this._shutter, -0.2);
    const panelH1 = dh * 0.3;
    const panelH2 = dh * 0.33;
    ctx.fillStyle = panelColor;
    // Top-left panel
    ctx.beginPath();
    ctx.roundRect(sx - dw / 2 + 4 * s, sy - dh + 5 * s, dw / 2 - 6 * s, panelH1, 2 * s); ctx.fill();
    // Top-right panel
    ctx.beginPath();
    ctx.roundRect(sx + 2 * s, sy - dh + 5 * s, dw / 2 - 6 * s, panelH1, 2 * s); ctx.fill();
    // Bottom-left panel
    ctx.beginPath();
    ctx.roundRect(sx - dw / 2 + 4 * s, sy - dh + panelH1 + 10 * s, dw / 2 - 6 * s, panelH2, 2 * s); ctx.fill();
    // Bottom-right panel
    ctx.beginPath();
    ctx.roundRect(sx + 2 * s, sy - dh + panelH1 + 10 * s, dw / 2 - 6 * s, panelH2, 2 * s); ctx.fill();

    // Transom window (semi-circle above door)
    ctx.fillStyle = '#B8DAFF';
    ctx.beginPath();
    ctx.arc(sx, sy - dh, dw / 2, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = 1.8 * s;
    ctx.beginPath();
    ctx.arc(sx, sy - dh, dw / 2, Math.PI, 0);
    ctx.moveTo(sx - dw / 2, sy - dh); ctx.lineTo(sx + dw / 2, sy - dh);
    ctx.moveTo(sx, sy - dh - dw / 2); ctx.lineTo(sx, sy - dh);
    ctx.stroke();

    // Door handle
    ctx.fillStyle = '#FFD060';
    ctx.beginPath();
    ctx.arc(sx + dw / 2 - 6 * s, sy - dh * 0.4, 3 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#C09000';
    ctx.lineWidth = 1 * s;
    ctx.beginPath();
    ctx.arc(sx + dw / 2 - 6 * s, sy - dh * 0.4, 3 * s, 0, Math.PI * 2);
    ctx.stroke();

    // Steps
    ctx.fillStyle = '#C0B8A8';
    ctx.beginPath();
    ctx.roundRect(sx - dw / 2 - 8 * s, sy, dw + 16 * s, 7 * s, 2 * s);
    ctx.fill();
    ctx.fillStyle = '#B0A898';
    ctx.beginPath();
    ctx.roundRect(sx - dw / 2 - 5 * s, sy + 7 * s, dw + 10 * s, 6 * s, 2 * s);
    ctx.fill();
  }

  _drawFence(ctx, cx, cy, halfW, s) {
    const picketW = 7 * s, spacing = 12 * s, topH = 10 * s;
    // Rails
    ctx.fillStyle = '#D4C8A8';
    ctx.fillRect(cx - halfW, cy - 14 * s, halfW * 2, 4 * s);
    ctx.fillRect(cx - halfW, cy - 6 * s,  halfW * 2, 4 * s);
    // Pickets
    for (let px = cx - halfW; px < cx + halfW - 2; px += spacing) {
      ctx.fillStyle = '#DDD4B4';
      ctx.fillRect(px, cy - 20 * s, picketW, 22 * s);
      // Pointed top
      ctx.beginPath();
      ctx.moveTo(px, cy - 20 * s);
      ctx.lineTo(px + picketW / 2, cy - 20 * s - topH);
      ctx.lineTo(px + picketW, cy - 20 * s);
      ctx.closePath();
      ctx.fill();
      // Shading on picket
      ctx.strokeStyle = 'rgba(0,0,0,0.1)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(px + picketW - 1, cy - 20 * s);
      ctx.lineTo(px + picketW - 1, cy + 2 * s);
      ctx.stroke();
    }
  }

  _drawBush(ctx, bx, by, s, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(bx - 8 * s, by - 8 * s, 10 * s, 0, Math.PI * 2);
    ctx.arc(bx + 8 * s, by - 8 * s, 10 * s, 0, Math.PI * 2);
    ctx.arc(bx,         by - 14 * s, 12 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = lerpColor(color, 0.18);
    ctx.beginPath();
    ctx.arc(bx, by - 14 * s, 7 * s, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Tree ──────────────────────────────────────────────────────────────────

class Tree {
  constructor(x, y, scale = 1) {
    this.x = x; this.y = y; this._scale = scale;
    this._dark  = `hsl(${130 + Math.random() * 20},52%,28%)`;
    this._mid   = `hsl(${128 + Math.random() * 20},56%,38%)`;
    this._light = `hsl(${126 + Math.random() * 20},60%,48%)`;
    this._phase = Math.random() * Math.PI * 2;
  }

  draw(ctx, cam, depthScaleFn) {
    const sx = Math.round(this.x - cam.x);
    const sy = Math.round(this.y - cam.y);
    if (sx < -120 || sx > ctx.canvas.width  + 120) return;
    if (sy < -230 || sy > ctx.canvas.height + 30)  return;

    const s = depthScaleFn(this.y) * this._scale;
    const t = performance.now() * 0.001;
    const sway = Math.sin(t * 1.1 + this._phase) * 3 * s;   // wind sway (canopy)

    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(sx + 10 * s, sy + 5 * s, 34 * s, 13 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#7B4D2A';
    ctx.beginPath();
    ctx.roundRect(sx - 7 * s, sy - 52 * s, 14 * s, 55 * s, 3 * s);
    ctx.fill();

    for (const [dx, dy, r, c] of [
      [-18, -68, 28, this._dark], [18, -68, 28, this._dark],
      [0,   -80, 32, this._mid],  [-14, -58, 24, this._mid],
      [14,  -58, 24, this._mid],  [0,   -60, 20, this._light],
      [0,   -94, 18, this._light],
    ]) {
      // Higher clusters sway more (dy more negative → bigger factor)
      const f = sway * (-dy / 94);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(sx + dx * s + f, sy + dy * s, r * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ── Flower ────────────────────────────────────────────────────────────────

class Flower {
  constructor(x, y) {
    this.x = x; this.y = y;
    this._color = ['#FF6B8A','#FFD700','#FF8C00','#C084FC','#4EC9FF','#FF4500'][Math.floor(Math.random() * 6)];
    this._r = 4 + Math.random() * 4;
    this._phase = Math.random() * Math.PI * 2;
  }

  draw(ctx, cam, depthScaleFn) {
    let sx = this.x - cam.x, sy = this.y - cam.y;
    if (sx < -20 || sx > ctx.canvas.width + 20 || sy < -20 || sy > ctx.canvas.height + 20) return;
    const r = this._r * depthScaleFn(this.y);
    const t = performance.now() * 0.001;
    sx += Math.sin(t * 1.8 + this._phase) * r * 0.5;   // bob in the breeze
    ctx.fillStyle = this._color;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(sx + Math.cos(a) * r, sy + Math.sin(a) * r, r * 0.65, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#FFE870';
    ctx.beginPath();
    ctx.arc(sx, sy, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Bush ─────────────────────────────────────────────────────────────────

class Bush {
  constructor(x, y, scale = 1) {
    this.x = x; this.y = y; this._scale = scale;
    this._c1 = `hsl(${120 + Math.random() * 30},50%,${28 + Math.random() * 14}%)`;
    this._c2 = `hsl(${120 + Math.random() * 30},55%,${40 + Math.random() * 10}%)`;
    this._phase = Math.random() * Math.PI * 2;
  }

  draw(ctx, cam, depthScaleFn) {
    const sx = Math.round(this.x - cam.x), sy = Math.round(this.y - cam.y);
    if (sx < -60 || sx > ctx.canvas.width + 60 || sy < -60 || sy > ctx.canvas.height + 20) return;
    const s = depthScaleFn(this.y) * this._scale;
    const t = performance.now() * 0.001;
    const sw = Math.sin(t * 1.4 + this._phase) * 1.6 * s;   // gentle sway on the crown
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(sx + 4 * s, sy + 5 * s, 26 * s, 10 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = this._c1;
    ctx.beginPath();
    ctx.arc(sx - 14 * s, sy - 10 * s, 18 * s, 0, Math.PI * 2);
    ctx.arc(sx + 14 * s, sy - 10 * s, 18 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = this._c2;
    ctx.beginPath();
    ctx.arc(sx + sw, sy - 16 * s, 20 * s, 0, Math.PI * 2);
    ctx.arc(sx - 10 * s + sw, sy - 6 * s, 14 * s, 0, Math.PI * 2);
    ctx.arc(sx + 10 * s + sw, sy - 6 * s, 14 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ── Rock ──────────────────────────────────────────────────────────────────

class Rock {
  constructor(x, y, scale = 1) {
    this.x = x; this.y = y; this._scale = scale;
    this._pts = Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      return [Math.cos(a) * (0.65 + Math.random() * 0.35), Math.sin(a) * (0.65 + Math.random() * 0.35) * 0.55];
    });
  }

  draw(ctx, cam, depthScaleFn) {
    const sx = Math.round(this.x - cam.x), sy = Math.round(this.y - cam.y);
    if (sx < -80 || sx > ctx.canvas.width + 80 || sy < -60 || sy > ctx.canvas.height + 20) return;
    const s = depthScaleFn(this.y) * this._scale * 22;
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(sx + 4, sy + 8, s * 0.9, s * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#8A9090';
    ctx.beginPath();
    this._pts.forEach(([px, py], i) => {
      i === 0 ? ctx.moveTo(sx + px * s, sy + py * s) : ctx.lineTo(sx + px * s, sy + py * s);
    });
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#AAB8AA';
    ctx.beginPath();
    ctx.ellipse(sx - s * 0.18, sy - s * 0.18, s * 0.28, s * 0.16, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ── Lamppost ──────────────────────────────────────────────────────────────

class Lamppost {
  constructor(x, y) { this.x = x; this.y = y; }
  draw(ctx, cam, depthScaleFn) {
    const sx = Math.round(this.x - cam.x), sy = Math.round(this.y - cam.y);
    if (sx < -40 || sx > ctx.canvas.width + 40 || sy < -160 || sy > ctx.canvas.height + 20) return;
    const s = depthScaleFn(this.y);
    ctx.fillStyle = '#787888';
    ctx.beginPath();
    ctx.ellipse(sx, sy, 7 * s, 4 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8890A0';
    ctx.fillRect(sx - 2.5 * s, sy - 82 * s, 5 * s, 84 * s);
    ctx.strokeStyle = '#8890A0';
    ctx.lineWidth = 3.5 * s; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx, sy - 80 * s);
    ctx.quadraticCurveTo(sx + 18 * s, sy - 86 * s, sx + 28 * s, sy - 76 * s);
    ctx.stroke();
    const t = performance.now() * 0.001;
    const pulse = 0.85 + 0.15 * Math.sin(t * 2.2 + this.x * 0.05);
    ctx.save();
    ctx.globalAlpha = 0.14 * pulse;
    ctx.fillStyle = '#FFE860';
    ctx.beginPath();
    ctx.arc(sx + 28 * s, sy - 76 * s, 20 * s * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#FFE860';
    ctx.beginPath();
    ctx.arc(sx + 28 * s, sy - 76 * s, 7 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ── Bench ─────────────────────────────────────────────────────────────────

class Bench {
  constructor(x, y, rotated = false) { this.x = x; this.y = y; this._rot = rotated; }
  draw(ctx, cam, depthScaleFn) {
    const sx = Math.round(this.x - cam.x), sy = Math.round(this.y - cam.y);
    if (sx < -80 || sx > ctx.canvas.width + 80 || sy < -60 || sy > ctx.canvas.height + 20) return;
    const s = depthScaleFn(this.y);
    ctx.save(); ctx.translate(sx, sy);
    if (this._rot) ctx.rotate(Math.PI / 2);
    ctx.fillStyle = '#6B4226';
    ctx.fillRect(-24 * s, -4 * s, 6 * s, 14 * s);
    ctx.fillRect(18 * s, -4 * s, 6 * s, 14 * s);
    ctx.fillStyle = '#C49050';
    ctx.beginPath();
    ctx.roundRect(-27 * s, -8 * s, 54 * s, 9 * s, 3 * s); ctx.fill();
    ctx.beginPath();
    ctx.roundRect(-27 * s, -20 * s, 54 * s, 8 * s, 3 * s); ctx.fill();
    ctx.restore();
  }
}

// ── Fountain ──────────────────────────────────────────────────────────────

class Fountain {
  constructor(x, y) { this.x = x; this.y = y; }
  draw(ctx, cam, depthScaleFn) {
    const sx = Math.round(this.x - cam.x), sy = Math.round(this.y - cam.y);
    if (sx < -120 || sx > ctx.canvas.width + 120 || sy < -180 || sy > ctx.canvas.height + 50) return;
    const s = depthScaleFn(this.y);
    ctx.fillStyle = '#5BAFD0';
    ctx.beginPath();
    ctx.ellipse(sx, sy, 60 * s, 25 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7DCEF0';
    ctx.beginPath();
    ctx.ellipse(sx - 4 * s, sy - 4 * s, 46 * s, 18 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#C8C0A0'; ctx.lineWidth = 7 * s;
    ctx.beginPath();
    ctx.ellipse(sx, sy, 60 * s, 25 * s, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#D0C8B0';
    ctx.fillRect(sx - 6 * s, sy - 52 * s, 12 * s, 52 * s);
    ctx.fillStyle = '#B8B0A0';
    ctx.beginPath();
    ctx.ellipse(sx, sy - 52 * s, 20 * s, 8 * s, 0, 0, Math.PI * 2); ctx.fill();

    // ── Animated water ────────────────────────────────────────────
    const t = performance.now() * 0.001;
    const jet = 1 + Math.sin(t * 4) * 0.12;          // jet height pulse
    const topY = sy - 52 * s;
    // Central jet
    ctx.fillStyle = 'rgba(150,220,255,0.65)';
    ctx.beginPath();
    ctx.ellipse(sx, topY - 20 * s * jet, 4 * s, 22 * s * jet, 0, 0, Math.PI * 2);
    ctx.ellipse(sx - 10 * s, topY - 10 * s * jet, 3 * s, 13 * s * jet, -0.3, 0, Math.PI * 2);
    ctx.ellipse(sx + 10 * s, topY - 10 * s * jet, 3 * s, 13 * s * jet,  0.3, 0, Math.PI * 2);
    ctx.fill();
    // Falling droplets arcing into the basin
    ctx.fillStyle = 'rgba(180,235,255,0.8)';
    for (let d = 0; d < 8; d++) {
      const ph  = ((t * 0.9 + d / 8) % 1);
      const dir = d % 2 ? 1 : -1;
      const spread = (d % 4 + 1) / 4;
      const dx = dir * spread * 26 * s * ph;
      const dy = topY - 40 * s * jet + (ph * ph) * 50 * s;   // gravity arc
      const rr = (1.6 + (1 - ph) * 1.2) * s;
      ctx.beginPath();
      ctx.arc(sx + dx, dy, rr, 0, Math.PI * 2);
      ctx.fill();
    }
    // Ripple rings on the pool surface
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5 * s;
    for (let r = 0; r < 2; r++) {
      const ph = ((t * 0.6 + r * 0.5) % 1);
      ctx.globalAlpha = (1 - ph) * 0.5;
      ctx.beginPath();
      ctx.ellipse(sx, sy, (12 + ph * 44) * s, (5 + ph * 18) * s, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

// ── World ─────────────────────────────────────────────────────────────────

export class World {
  constructor(w, h) {
    this.w = w; this.h = h;
    this._objects = [];
    this._bg = this._buildBackground();
    this._buildObjects();
  }

  _buildBackground() {
    const bg = document.createElement('canvas');
    bg.width = this.w; bg.height = this.h;
    const c = bg.getContext('2d');

    // Tiled grass
    const tile = document.createElement('canvas');
    tile.width = tile.height = 256;
    const tc = tile.getContext('2d');
    tc.fillStyle = '#6CC84A'; tc.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 320; i++) {
      tc.fillStyle = Math.random() > 0.5 ? '#58B83A' : '#7ADB58';
      tc.beginPath();
      tc.ellipse(Math.random() * 256, Math.random() * 256,
        1.5 + Math.random() * 3.5, 1 + Math.random() * 2,
        Math.random() * Math.PI, 0, Math.PI * 2);
      tc.fill();
    }
    c.fillStyle = c.createPattern(tile, 'repeat');
    c.fillRect(0, 0, this.w, this.h);

    const cx = this.w / 2, cy = this.h / 2;

    // Sidewalks
    c.fillStyle = '#CECECE';
    c.fillRect(0, cy - 56, this.w, 12); c.fillRect(0, cy + 44, this.w, 12);
    c.fillRect(cx - 56, 0, 12, this.h); c.fillRect(cx + 44, 0, 12, this.h);

    // Roads
    c.fillStyle = '#B4B4B4';
    c.fillRect(0, cy - 44, this.w, 88);
    c.fillRect(cx - 44, 0, 88, this.h);

    // Road lane dash
    c.strokeStyle = '#E8E840'; c.lineWidth = 4; c.setLineDash([42, 32]);
    c.beginPath(); c.moveTo(0, cy); c.lineTo(this.w, cy); c.stroke();
    c.beginPath(); c.moveTo(cx, 0); c.lineTo(cx, this.h); c.stroke();
    c.setLineDash([]);

    // Intersection plaza
    c.fillStyle = '#D4CCB4';
    c.beginPath(); c.ellipse(cx, cy, 115, 78, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#C0B8A0'; c.lineWidth = 5;
    c.beginPath(); c.ellipse(cx, cy, 115, 78, 0, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = '#BCB4A0'; c.lineWidth = 2;
    c.beginPath(); c.ellipse(cx, cy, 90, 62, 0, 0, Math.PI * 2); c.stroke();

    // Pond
    const px = Math.round(this.w * 0.2), py = Math.round(this.h * 0.22);
    c.fillStyle = '#3898BE';
    c.beginPath(); c.ellipse(px, py, 148, 95, -0.18, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#58B8D8';
    c.beginPath(); c.ellipse(px - 8, py - 8, 114, 70, -0.18, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.22)'; c.lineWidth = 2;
    for (let r = 0; r < 4; r++) {
      c.beginPath();
      c.ellipse(px - 6, py - 6, 88 - r * 20, 53 - r * 13, -0.18, 0, Math.PI * 2); c.stroke();
    }
    c.strokeStyle = '#8EC860'; c.lineWidth = 8;
    c.beginPath(); c.ellipse(px, py, 155, 100, -0.18, 0, Math.PI * 2); c.stroke();

    // Residential road (bottom half) – horizontal sub-road
    c.fillStyle = '#C0C0C0';
    c.fillRect(0, Math.round(this.h * 0.72), this.w, 50);
    c.strokeStyle = '#E0E048'; c.lineWidth = 3; c.setLineDash([30, 24]);
    c.beginPath();
    c.moveTo(0, Math.round(this.h * 0.72) + 25);
    c.lineTo(this.w, Math.round(this.h * 0.72) + 25); c.stroke();
    c.setLineDash([]);
    // sidewalk for sub-road
    c.fillStyle = '#CECECE';
    c.fillRect(0, Math.round(this.h * 0.72) - 10, this.w, 10);
    c.fillRect(0, Math.round(this.h * 0.72) + 50, this.w, 10);

    return bg;
  }

  _buildObjects() {
    const W = this.w, H = this.h;
    const cx = W / 2, cy = H / 2;

    this._objects.push(new Fountain(cx, cy));

    // Trees
    for (const [x, y] of [
      [W*.07, H*.10], [W*.17, H*.07], [W*.10, H*.20], [W*.30, H*.09],
      [W*.07, H*.40], [W*.09, H*.58], [W*.06, H*.14], [W*.36, H*.30],
      [W*.26, H*.38], [W*.72, H*.07], [W*.83, H*.13], [W*.93, H*.09],
      [W*.87, H*.32], [W*.76, H*.20], [W*.92, H*.58], [W*.85, H*.42],
    ]) this._objects.push(new Tree(x, y, 0.7 + Math.random() * 0.6));

    // Bushes
    for (const [x, y] of [
      [W*.08, H*.28], [W*.32, H*.35], [W*.14, H*.30], [W*.12, H*.52],
      [W*.80, H*.44], [W*.90, H*.52], [W*.50, H*.08],
    ]) this._objects.push(new Bush(x, y, 0.6 + Math.random() * 0.5));

    // Rocks
    for (const [x, y] of [
      [W*.38, H*.14], [W*.65, H*.36], [W*.22, H*.62], [W*.82, H*.62],
    ]) this._objects.push(new Rock(x, y, 0.5 + Math.random() * 0.7));

    // High-quality houses (two rows in bottom half)
    const houseRow1Y = H * 0.67;  // above sub-road
    const houseRow2Y = H * 0.85;  // below sub-road

    const houseDefs = [
      // Row 1 (facing sub-road from north)
      [W * 0.12, houseRow1Y, '#FFF0C0', '#C83020', '#3A7A48'],
      [W * 0.30, houseRow1Y, '#FFD0B0', '#4A70C0', '#7A4A20'],
      [W * 0.55, houseRow1Y, '#D0F0D0', '#B82020', '#4A5A80'],
      [W * 0.75, houseRow1Y, '#E8E0FF', '#5050A0', '#488050'],
      [W * 0.92, houseRow1Y, '#FFE8C0', '#206040', '#A03020'],
      // Row 2 (facing road from south)
      [W * 0.10, houseRow2Y, '#FFC8C8', '#204080', '#6A4030'],
      [W * 0.28, houseRow2Y, '#C8F0FF', '#802020', '#38703A'],
      [W * 0.50, houseRow2Y, '#FFFFC0', '#703020', '#5A7030'],
      [W * 0.70, houseRow2Y, '#F0C8FF', '#306020', '#6020A0'],
      [W * 0.88, houseRow2Y, '#C8FFC8', '#802060', '#40507A'],
    ];
    for (const [x, y, w, r, sh] of houseDefs) {
      this._objects.push(new House(x, y, w, r, sh));
    }

    // Benches around plaza
    for (const [x, y, r] of [
      [cx-195, cy-64, false], [cx+195, cy-64, false],
      [cx-195, cy+64, false], [cx+195, cy+64, false],
      [cx-64, cy-195, true],  [cx+64, cy-195, true],
    ]) this._objects.push(new Bench(x, y, r));

    // Lampposts
    for (const [x, y] of [
      [cx-185, cy-76], [cx+185, cy-76], [cx-185, cy+76], [cx+185, cy+76],
      [cx-76, cy-185], [cx+76, cy-185], [cx-76, cy+185], [cx+76, cy+185],
      // along sub-road
      [W*.18, H*.70], [W*.38, H*.70], [W*.60, H*.70], [W*.80, H*.70],
    ]) this._objects.push(new Lamppost(x, y));

    // Flowers
    for (let i = 0; i < 90; i++) {
      const x = 80 + Math.random() * (W - 160);
      const y = 80 + Math.random() * (H - 160);
      const nearRoad = Math.abs(x - cx) < 160 || Math.abs(y - cy) < 80;
      const nearHouseRow = (y > H * 0.64 && y < H * 0.90);
      if (!nearRoad && !nearHouseRow) this._objects.push(new Flower(x, y));
    }
  }

  render(ctx, cam, vw, vh) {
    ctx.fillStyle = '#6CC84A';
    ctx.fillRect(0, 0, vw, vh);
    ctx.drawImage(this._bg, cam.x, cam.y, vw, vh, 0, 0, vw, vh);
  }

  getDrawables() { return this._objects; }

  getHouses() { return this._objects.filter(o => o instanceof House); }

  getLightSources() {
    const out = [];
    for (const obj of this._objects) {
      if (obj instanceof Lamppost) {
        const s = 0.72 + (obj.y / this.h) * 0.48;
        out.push({ worldX: obj.x + 28*s, worldY: obj.y - 76*s, radius: 150*s, color: [255, 220, 120] });
      }
      if (obj instanceof House) {
        const s   = 0.72 + (obj.y / this.h) * 0.48;
        const HW  = 60*s, WH = 92*s;
        const wY  = obj.y - WH + WH*0.35;
        out.push({ worldX: obj.x - HW*0.52, worldY: wY, radius: 60*s, color: [255, 210, 140] });
        out.push({ worldX: obj.x + HW*0.52, worldY: wY, radius: 60*s, color: [255, 210, 140] });
      }
    }
    return out;
  }

  getHouseAt(wx, wy, worldH) {
    for (const o of this._objects) {
      if (o instanceof House && o.containsPoint(wx, wy, worldH)) return o;
    }
    return null;
  }

  destroy() { this._bg = null; this._objects = []; }
}
