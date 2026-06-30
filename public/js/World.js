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
    // Deterministic per-house variety (stable across re-renders, varies between houses)
    const h = Math.abs(Math.round(x * 7 + y * 13)) % 30;
    this._style     = h % 5;                      // 0=classic 1=victorian 2=ranch 3=modern 4=colonial
    this._ridgeFrac = h % 3 === 0 ? 0.38 : 0;
    this._winCount  = h % 5 === 0 ? 1 : 2;
    this._hasAwning = h % 2 === 0;
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
    if (sx < -200 || sx > ctx.canvas.width / cam.zoom + 200) return;
    if (sy < -300 || sy > ctx.canvas.height / cam.zoom + 40)  return;

    const s = depthScaleFn(this.y);
    switch (this._style) {
      case 1: this._drawVictorian(ctx, sx, sy, s); break;
      case 2: this._drawRanch(ctx, sx, sy, s);     break;
      case 3: this._drawModern(ctx, sx, sy, s);    break;
      case 4: this._drawColonial(ctx, sx, sy, s);  break;
      default: this._drawClassic(ctx, sx, sy, s);  break;
    }
  }

  _drawClassic(ctx, sx, sy, s) {
    const HW  = 60 * s;
    const W   = HW * 2;
    const WH  = 92 * s;
    const RH  = 68 * s;
    const OV  = 14 * s;
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

    // ── Roof (gable or flat-topped hip, varies per house) ─────────
    const ridgeHW = (HW + OV) * this._ridgeFrac;
    const roofGrad = ctx.createLinearGradient(sx, wallTop - RH, sx, wallTop);
    roofGrad.addColorStop(0, lerpColor(this._roof, -0.12));
    roofGrad.addColorStop(1, lerpColor(this._roof,  0.08));
    ctx.fillStyle = roofGrad;
    ctx.strokeStyle = lerpColor(this._roof, -0.2);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx - HW - OV, wallTop);
    ctx.lineTo(sx - ridgeHW, wallTop - RH);
    ctx.lineTo(sx + ridgeHW, wallTop - RH);
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
      const lw   = (HW + OV) * frac + ridgeHW * (1 - frac);
      const ly   = wallTop - RH + RH * frac;
      ctx.beginPath();
      ctx.moveTo(sx - lw, ly);
      ctx.lineTo(sx + lw, ly);
      ctx.stroke();
    }
    // Ridge cap
    ctx.fillStyle = lerpColor(this._roof, -0.25);
    ctx.beginPath();
    ctx.roundRect(sx - (6 + ridgeHW) * s, wallTop - RH - 4 * s, (12 + ridgeHW * 2) * s, 8 * s, 3 * s);
    ctx.fill();

    // ── Awning over the door (some houses) ────────────────────────
    if (this._hasAwning) {
      ctx.fillStyle = lerpColor(this._shutter, -0.05);
      ctx.beginPath();
      ctx.moveTo(sx - 24 * s, sy - 50 * s);
      ctx.lineTo(sx + 24 * s, sy - 50 * s);
      ctx.lineTo(sx + 30 * s, sy - 38 * s);
      ctx.lineTo(sx - 30 * s, sy - 38 * s);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1;
      for (let ai = -1; ai <= 1; ai++) {
        ctx.beginPath();
        ctx.moveTo(sx + ai * 16 * s, sy - 50 * s);
        ctx.lineTo(sx + ai * 20 * s, sy - 38 * s);
        ctx.stroke();
      }
    }

    // ── Windows (single big window on some houses, two on others) ─
    const winY = wallTop + WH * 0.35;
    if (this._winCount === 1) {
      this._drawWindow(ctx, sx, winY, s * 1.25);
    } else {
      this._drawWindow(ctx, sx - HW * 0.52, winY, s);
      this._drawWindow(ctx, sx + HW * 0.52, winY, s);
    }

    // ── Door ─────────────────────────────────────────────────────
    this._drawDoor(ctx, sx, sy, s);

    ctx.restore();
  }

  // ── Victorian: tall, narrow, steep pointed roof, bay window ──────────────
  _drawVictorian(ctx, sx, sy, s) {
    const HW = 44 * s, WH = 115 * s, RH = 96 * s, OV = 10 * s;
    const wallTop = sy - WH;
    ctx.save();

    // shadow
    ctx.globalAlpha = 0.18; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(sx + 8*s, sy + 10*s, HW * 0.9, 14*s, 0, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;

    // garden path
    ctx.fillStyle = '#C8B888';
    ctx.beginPath(); ctx.roundRect(sx - 12*s, sy, 24*s, 28*s, 3*s); ctx.fill();

    // fence
    this._drawFence(ctx, sx, sy + 26*s, HW + 16*s, s);

    // foundation
    ctx.fillStyle = lerpColor(this._wall, -0.15);
    ctx.beginPath(); ctx.roundRect(sx - HW, sy - 7*s, HW*2, 9*s, 2*s); ctx.fill();

    // main wall
    ctx.fillStyle = this._wall; ctx.strokeStyle = lerpColor(this._wall, -0.12); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.roundRect(sx - HW, wallTop, HW*2, WH, [0,0,2*s,2*s]); ctx.fill(); ctx.stroke();

    // vertical board & batten texture
    ctx.strokeStyle = 'rgba(0,0,0,0.07)'; ctx.lineWidth = 0.9;
    for (let xl = sx - HW + 9*s; xl < sx + HW; xl += 9*s) {
      ctx.beginPath(); ctx.moveTo(xl, wallTop); ctx.lineTo(xl, sy); ctx.stroke();
    }

    // corner trim
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(sx - HW, wallTop, 6*s, WH);
    ctx.fillRect(sx + HW - 6*s, wallTop, 6*s, WH);

    // fascia
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(sx - HW - OV, wallTop - 4*s, HW*2 + OV*2, 5*s);

    // chimney (left side, tall)
    const csx = sx - 20*s, cTop = wallTop - RH + 10*s, cBot = wallTop + 6*s, cW = 14*s;
    ctx.fillStyle = '#8A3820'; ctx.fillRect(csx - cW/2, cTop, cW, cBot - cTop);
    ctx.fillStyle = '#6A2810'; ctx.fillRect(csx - cW/2 - 2*s, cTop, cW + 4*s, 5*s);

    // very steep gable roof
    ctx.fillStyle = this._roof; ctx.strokeStyle = lerpColor(this._roof, -0.2); ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx - HW - OV, wallTop);
    ctx.lineTo(sx, wallTop - RH);
    ctx.lineTo(sx + HW + OV, wallTop);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // roof tile lines
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1;
    for (let ri = 1; ri < 10; ri++) {
      const f = ri / 10, lw2 = (HW+OV)*f;
      const ly = wallTop - RH + RH*f;
      ctx.beginPath(); ctx.moveTo(sx - lw2, ly); ctx.lineTo(sx + lw2, ly); ctx.stroke();
    }
    // gingerbread ornament at peak
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.arc(sx, wallTop - RH, 7*s, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = this._roof; ctx.beginPath(); ctx.arc(sx, wallTop - RH, 4*s, 0, Math.PI*2); ctx.fill();

    // bay window (protruding center, upper half)
    const bwY = wallTop + WH * 0.20, bwH = WH * 0.35, bwW = HW * 0.9;
    ctx.fillStyle = lerpColor(this._wall, -0.06);
    ctx.beginPath(); ctx.roundRect(sx - bwW/2, bwY, bwW, bwH, [0,0,4*s,4*s]); ctx.fill();
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2.5*s;
    // three bay panes
    for (let pi = 0; pi < 3; pi++) {
      const px2 = sx - bwW/2 + bwW*(pi+0.5)/3, ph = bwH * 0.80, pw = bwW*0.26;
      ctx.fillStyle = '#B8DAFF';
      ctx.beginPath(); ctx.roundRect(px2 - pw/2, bwY + bwH*0.08, pw, ph, [3*s,3*s,0,0]); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px2, bwY + bwH*0.08); ctx.lineTo(px2, bwY + bwH*0.08 + ph); ctx.stroke();
    }
    ctx.fillStyle = lerpColor(this._wall, -0.1);
    ctx.fillRect(sx - bwW/2 - 5*s, bwY - 6*s, bwW + 10*s, 7*s);

    // lower single window
    this._drawWindow(ctx, sx, wallTop + WH*0.68, s * 0.9);

    // door
    this._drawDoor(ctx, sx, sy, s);
    ctx.restore();
  }

  // ── Ranch: wide, single-storey, shallow hip roof, porch ─────────────────
  _drawRanch(ctx, sx, sy, s) {
    const HW = 82*s, WH = 62*s, RH = 34*s, OV = 18*s;
    const ridgeHW = HW * 0.5;
    const wallTop = sy - WH;
    ctx.save();

    ctx.globalAlpha = 0.18; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(sx + 10*s, sy + 10*s, HW * 0.9, 14*s, 0, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;

    // wide garden path
    ctx.fillStyle = '#C8B888';
    ctx.beginPath(); ctx.roundRect(sx - 16*s, sy, 32*s, 30*s, 3*s); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1*s;
    for (let pi = 0; pi < 3; pi++) {
      ctx.beginPath(); ctx.moveTo(sx - 16*s, sy + (pi+0.5)*10*s); ctx.lineTo(sx + 16*s, sy + (pi+0.5)*10*s); ctx.stroke();
    }

    this._drawFence(ctx, sx, sy + 28*s, HW + 14*s, s);
    this._drawBush(ctx, sx - HW + 16*s, sy + 4*s, 0.55*s, '#3A9A40');
    this._drawBush(ctx, sx + HW - 16*s, sy + 4*s, 0.55*s, '#3A9A40');

    // foundation
    ctx.fillStyle = lerpColor(this._wall, -0.15);
    ctx.beginPath(); ctx.roundRect(sx - HW, sy - 7*s, HW*2, 9*s, 2*s); ctx.fill();

    // wall
    ctx.fillStyle = this._wall; ctx.strokeStyle = lerpColor(this._wall, -0.12); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.roundRect(sx - HW, wallTop, HW*2, WH, [0,0,2*s,2*s]); ctx.fill(); ctx.stroke();

    // horizontal siding
    ctx.strokeStyle = 'rgba(0,0,0,0.07)'; ctx.lineWidth = 0.9;
    for (let yl = wallTop + 7*s; yl < sy - 7*s; yl += 8*s) {
      ctx.beginPath(); ctx.moveTo(sx - HW + 2, yl); ctx.lineTo(sx + HW - 2, yl); ctx.stroke();
    }

    // porch columns (3 columns)
    ctx.fillStyle = '#FFFFFF';
    for (const cx2 of [sx - HW*0.5, sx, sx + HW*0.5]) {
      ctx.beginPath(); ctx.roundRect(cx2 - 4*s, sy - WH + 4*s, 8*s, WH - 4*s, 2*s); ctx.fill();
    }
    // porch beam
    ctx.fillRect(sx - HW - 4*s, wallTop, HW*2 + 8*s, 8*s);

    // shallow hip roof
    const roofGrad = ctx.createLinearGradient(sx, wallTop - RH, sx, wallTop);
    roofGrad.addColorStop(0, lerpColor(this._roof, -0.12)); roofGrad.addColorStop(1, lerpColor(this._roof, 0.08));
    ctx.fillStyle = roofGrad; ctx.strokeStyle = lerpColor(this._roof, -0.2); ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx - HW - OV, wallTop);
    ctx.lineTo(sx - ridgeHW, wallTop - RH);
    ctx.lineTo(sx + ridgeHW, wallTop - RH);
    ctx.lineTo(sx + HW + OV, wallTop);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // ridge cap
    ctx.fillStyle = lerpColor(this._roof, -0.25);
    ctx.beginPath(); ctx.roundRect(sx - ridgeHW, wallTop - RH - 4*s, ridgeHW*2, 7*s, 3*s); ctx.fill();

    // 3 windows
    for (const wx2 of [sx - HW*0.60, sx, sx + HW*0.60]) {
      this._drawWindow(ctx, wx2, wallTop + WH*0.40, s * 0.85);
    }
    this._drawDoor(ctx, sx, sy, s);
    ctx.restore();
  }

  // ── Modern: tall, flat roof, big picture windows, clean lines ────────────
  _drawModern(ctx, sx, sy, s) {
    const HW = 58*s, WH = 100*s, OV = 4*s;
    const wallTop = sy - WH;
    ctx.save();

    ctx.globalAlpha = 0.18; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(sx + 10*s, sy + 10*s, HW*0.9, 14*s, 0, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;

    // concrete path
    ctx.fillStyle = '#C0B8B0';
    ctx.beginPath(); ctx.roundRect(sx - 18*s, sy, 36*s, 30*s, 2*s); ctx.fill();

    // low hedge instead of picket fence
    ctx.fillStyle = '#2A7A2A';
    ctx.beginPath(); ctx.roundRect(sx - HW - 8*s, sy + 20*s, HW*2 + 16*s, 12*s, 6*s); ctx.fill();
    ctx.fillStyle = '#3A9A3A';
    ctx.beginPath(); ctx.roundRect(sx - HW - 6*s, sy + 18*s, HW*2 + 12*s, 8*s, 4*s); ctx.fill();

    // foundation
    ctx.fillStyle = lerpColor(this._wall, -0.15);
    ctx.beginPath(); ctx.roundRect(sx - HW, sy - 8*s, HW*2, 10*s, 2*s); ctx.fill();

    // smooth stucco wall
    ctx.fillStyle = this._wall; ctx.strokeStyle = lerpColor(this._wall, -0.08); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(sx - HW, wallTop, HW*2, WH, 2*s); ctx.fill(); ctx.stroke();

    // accent stripe (dark horizontal band across middle)
    ctx.fillStyle = lerpColor(this._wall, -0.3);
    ctx.fillRect(sx - HW, wallTop + WH*0.48, HW*2, 8*s);

    // flat roof with parapet
    ctx.fillStyle = lerpColor(this._wall, -0.18);
    ctx.beginPath(); ctx.roundRect(sx - HW - OV, wallTop - 18*s, HW*2 + OV*2, 18*s, [3*s,3*s,0,0]); ctx.fill();
    // rooftop detail line
    ctx.strokeStyle = lerpColor(this._wall, -0.3); ctx.lineWidth = 2*s;
    ctx.beginPath(); ctx.moveTo(sx - HW - OV, wallTop - 4*s); ctx.lineTo(sx + HW + OV, wallTop - 4*s); ctx.stroke();

    // large picture window upper
    const pwW = HW*1.4, pwH = WH*0.30;
    ctx.fillStyle = '#90C8E8';
    ctx.beginPath(); ctx.roundRect(sx - pwW/2, wallTop + WH*0.08, pwW, pwH, 2*s); ctx.fill();
    ctx.strokeStyle = lerpColor(this._wall, -0.2); ctx.lineWidth = 3*s;
    ctx.beginPath(); ctx.roundRect(sx - pwW/2, wallTop + WH*0.08, pwW, pwH, 2*s); ctx.stroke();
    // window panes
    ctx.strokeStyle = lerpColor(this._wall, -0.15); ctx.lineWidth = 2*s;
    ctx.beginPath();
    ctx.moveTo(sx, wallTop + WH*0.08); ctx.lineTo(sx, wallTop + WH*0.08 + pwH);
    ctx.moveTo(sx - pwW/2, wallTop + WH*0.08 + pwH*0.5); ctx.lineTo(sx + pwW/2, wallTop + WH*0.08 + pwH*0.5);
    ctx.stroke();
    // window shine
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath(); ctx.moveTo(sx - pwW/2 + 4*s, wallTop + WH*0.08 + 4*s); ctx.lineTo(sx - 4*s, wallTop + WH*0.08 + 4*s); ctx.lineTo(sx - pwW/2 + 4*s, wallTop + WH*0.08 + pwH*0.45); ctx.closePath(); ctx.fill();

    // lower window pair
    for (const wx2 of [sx - HW*0.45, sx + HW*0.45]) {
      const lwH = WH*0.22;
      ctx.fillStyle = '#90C8E8';
      ctx.beginPath(); ctx.roundRect(wx2 - 18*s, wallTop + WH*0.58, 36*s, lwH, 2*s); ctx.fill();
      ctx.strokeStyle = lerpColor(this._wall, -0.2); ctx.lineWidth = 2*s;
      ctx.beginPath(); ctx.roundRect(wx2 - 18*s, wallTop + WH*0.58, 36*s, lwH, 2*s); ctx.stroke();
    }

    // modern flush door
    const dW = 28*s, dH = 48*s;
    ctx.fillStyle = lerpColor(this._shutter, -0.1);
    ctx.beginPath(); ctx.roundRect(sx - dW/2, sy - dH, dW, dH, [2*s,2*s,0,0]); ctx.fill();
    ctx.fillStyle = '#90C8E8';
    ctx.beginPath(); ctx.roundRect(sx - dW/2 + 4*s, sy - dH + 8*s, dW - 8*s, dH*0.3, 1*s); ctx.fill();
    ctx.fillStyle = '#FFD060';
    ctx.beginPath(); ctx.arc(sx + dW/2 - 7*s, sy - dH*0.4, 3*s, 0, Math.PI*2); ctx.fill();
    // steps
    ctx.fillStyle = '#C0B8A8';
    ctx.beginPath(); ctx.roundRect(sx - dW/2 - 8*s, sy, dW+16*s, 7*s, 2*s); ctx.fill();

    ctx.restore();
  }

  // ── Colonial: tall, brick-red, two chimneys, dormer windows ─────────────
  _drawColonial(ctx, sx, sy, s) {
    const HW = 66*s, WH = 102*s, RH = 72*s, OV = 16*s;
    const wallTop = sy - WH;
    ctx.save();

    ctx.globalAlpha = 0.18; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(sx + 10*s, sy + 10*s, HW*0.9, 16*s, 0, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#C8B888';
    ctx.beginPath(); ctx.roundRect(sx - 14*s, sy, 28*s, 30*s, 4*s); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1*s;
    for (let pi = 0; pi < 3; pi++) {
      ctx.beginPath(); ctx.moveTo(sx - 14*s, sy + (pi+0.5)*10*s); ctx.lineTo(sx + 14*s, sy + (pi+0.5)*10*s); ctx.stroke();
    }

    this._drawFence(ctx, sx, sy + 28*s, HW + 20*s, s);
    this._drawBush(ctx, sx - HW + 10*s, sy + 4*s, 0.55*s, '#3A9A40');
    this._drawBush(ctx, sx + HW - 10*s, sy + 4*s, 0.55*s, '#3A9A40');

    // brick foundation
    ctx.fillStyle = '#8A3820'; ctx.beginPath(); ctx.roundRect(sx - HW, sy - 8*s, HW*2, 10*s, 2*s); ctx.fill();

    // brick wall (red hue from wallColor, with mortar lines)
    ctx.fillStyle = this._wall; ctx.strokeStyle = lerpColor(this._wall, -0.12); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.roundRect(sx - HW, wallTop, HW*2, WH, [0,0,2*s,2*s]); ctx.fill(); ctx.stroke();
    // brick rows
    ctx.strokeStyle = 'rgba(0,0,0,0.10)'; ctx.lineWidth = 0.8;
    for (let yl = wallTop + 8*s; yl < sy - 8*s; yl += 10*s) {
      ctx.beginPath(); ctx.moveTo(sx - HW + 2, yl); ctx.lineTo(sx + HW - 2, yl); ctx.stroke();
    }
    // brick columns
    for (let xl = sx - HW + 12*s; xl < sx + HW; xl += 24*s) {
      ctx.beginPath(); ctx.moveTo(xl, wallTop); ctx.lineTo(xl, sy - 8*s); ctx.stroke();
    }

    // white quoin corners
    ctx.fillStyle = '#FFFFFF';
    for (let qi = 0; qi < 5; qi++) {
      const qy = wallTop + qi * WH/5;
      ctx.fillRect(sx - HW, qy, 10*s, 8*s);
      ctx.fillRect(sx + HW - 10*s, qy, 10*s, 8*s);
    }

    // white fascia
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(sx - HW - OV, wallTop - 5*s, HW*2 + OV*2, 6*s);

    // two chimneys
    for (const cof of [-28, 28]) {
      const csx2 = sx + cof*s, cTop2 = wallTop - RH - 12*s, cBot2 = wallTop + 6*s, cW2 = 13*s;
      ctx.fillStyle = '#8A3820'; ctx.fillRect(csx2 - cW2/2, cTop2, cW2, cBot2 - cTop2);
      ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 0.8;
      for (let br = 0; br * 8*s < cBot2 - cTop2; br++) {
        const by = cTop2 + br * 8*s;
        ctx.beginPath(); ctx.moveTo(csx2 - cW2/2, by); ctx.lineTo(csx2 + cW2/2, by); ctx.stroke();
      }
      ctx.fillStyle = '#6A2010'; ctx.fillRect(csx2 - cW2/2 - 2*s, cTop2, cW2 + 4*s, 5*s);
      // smoke
      const t = performance.now() * 0.001;
      for (let pi = 0; pi < 2; pi++) {
        const ph = ((t * 0.4 + pi * 0.5) % 1);
        ctx.globalAlpha = (1 - ph) * 0.35;
        ctx.fillStyle = '#D0C8C0';
        ctx.beginPath(); ctx.arc(csx2 + Math.sin(t + pi*2)*3*s, cTop2 - ph*20*s, (2+ph*7)*s, 0, Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // gable roof
    const roofGrad = ctx.createLinearGradient(sx, wallTop - RH, sx, wallTop);
    roofGrad.addColorStop(0, lerpColor(this._roof, -0.12)); roofGrad.addColorStop(1, lerpColor(this._roof, 0.08));
    ctx.fillStyle = roofGrad; ctx.strokeStyle = lerpColor(this._roof, -0.2); ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx - HW - OV, wallTop);
    ctx.lineTo(sx, wallTop - RH);
    ctx.lineTo(sx + HW + OV, wallTop);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // tile lines
    ctx.strokeStyle = 'rgba(0,0,0,0.10)'; ctx.lineWidth = 1;
    for (let ri = 1; ri < 9; ri++) {
      const f = ri/9, lw2 = (HW+OV)*f;
      ctx.beginPath(); ctx.moveTo(sx - lw2, wallTop - RH + RH*f); ctx.lineTo(sx + lw2, wallTop - RH + RH*f); ctx.stroke();
    }

    // dormer (small gabled window in roof)
    const dmX = sx, dmY = wallTop - RH*0.45, dmW = 28*s, dmH = 22*s;
    ctx.fillStyle = this._wall;
    ctx.beginPath(); ctx.roundRect(dmX - dmW/2, dmY, dmW, dmH, 2*s); ctx.fill();
    ctx.fillStyle = '#B8DAFF'; ctx.fillRect(dmX - dmW/2 + 3*s, dmY + 3*s, dmW - 6*s, dmH - 6*s);
    ctx.fillStyle = this._roof;
    ctx.beginPath(); ctx.moveTo(dmX - dmW/2 - 4*s, dmY); ctx.lineTo(dmX, dmY - 14*s); ctx.lineTo(dmX + dmW/2 + 4*s, dmY); ctx.closePath(); ctx.fill();

    // 4 symmetrical windows (2 per floor)
    const wRow1Y = wallTop + WH*0.22, wRow2Y = wallTop + WH*0.58;
    for (const wx2 of [sx - HW*0.52, sx + HW*0.52]) {
      this._drawWindow(ctx, wx2, wRow1Y, s);
      this._drawWindow(ctx, wx2, wRow2Y, s * 0.88);
    }

    // central door with pediment
    const dW2 = 28*s, dH2 = 50*s, dX = sx - dW2/2, dY = sy - dH2;
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.roundRect(dX - 6*s, dY - 8*s, dW2 + 12*s, dH2 + 8*s, [6*s,6*s,0,0]); ctx.fill();
    ctx.fillStyle = this._shutter; ctx.beginPath(); ctx.roundRect(dX, dY, dW2, dH2, [2*s,2*s,0,0]); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath(); ctx.roundRect(dX + 3*s, dY + 5*s, dW2/2 - 5*s, dH2*0.35, 1*s); ctx.fill();
    ctx.beginPath(); ctx.roundRect(dX + dW2/2 + 2*s, dY + 5*s, dW2/2 - 5*s, dH2*0.35, 1*s); ctx.fill();
    // triangular pediment above door
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.moveTo(dX - 6*s, dY - 8*s); ctx.lineTo(sx, dY - 28*s); ctx.lineTo(dX + dW2 + 6*s, dY - 8*s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#FFD060'; ctx.beginPath(); ctx.arc(sx + dW2/2 - 7*s, sy - dH2*0.4, 3*s, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#C0B8A8'; ctx.beginPath(); ctx.roundRect(sx - dW2/2 - 8*s, sy, dW2 + 16*s, 7*s, 2*s); ctx.fill();

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
    if (sx < -120 || sx > ctx.canvas.width / cam.zoom + 120) return;
    if (sy < -230 || sy > ctx.canvas.height / cam.zoom + 30)  return;

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
    if (sx < -20 || sx > ctx.canvas.width / cam.zoom + 20 || sy < -20 || sy > ctx.canvas.height / cam.zoom + 20) return;
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
    if (sx < -60 || sx > ctx.canvas.width / cam.zoom + 60 || sy < -60 || sy > ctx.canvas.height / cam.zoom + 20) return;
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
    if (sx < -80 || sx > ctx.canvas.width / cam.zoom + 80 || sy < -60 || sy > ctx.canvas.height / cam.zoom + 20) return;
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
    if (sx < -40 || sx > ctx.canvas.width / cam.zoom + 40 || sy < -160 || sy > ctx.canvas.height / cam.zoom + 20) return;
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
    if (sx < -80 || sx > ctx.canvas.width / cam.zoom + 80 || sy < -60 || sy > ctx.canvas.height / cam.zoom + 20) return;
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
    if (sx < -120 || sx > ctx.canvas.width / cam.zoom + 120 || sy < -180 || sy > ctx.canvas.height / cam.zoom + 50) return;
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

// ── Cinema building ─────────────────────────────────────────────────────────

class CinemaBuilding {
  constructor(x, y) { this.x = x; this.y = y; }

  containsPoint(wx, wy, worldH) {
    const s  = 0.72 + (this.y / worldH) * 0.48;
    const HW = 112 * s, WH = 152 * s;
    return wx >= this.x - HW && wx <= this.x + HW &&
           wy >= this.y - WH && wy <= this.y + 40 * s;
  }

  draw(ctx, cam, depthScaleFn) {
    const sx = Math.round(this.x - cam.x), sy = Math.round(this.y - cam.y);
    if (sx < -300 || sx > ctx.canvas.width / cam.zoom + 300) return;
    if (sy < -380 || sy > ctx.canvas.height / cam.zoom + 60)  return;
    const s = depthScaleFn(this.y);
    const t = performance.now() * 0.001;
    const HW = 112 * s, WH = 152 * s, top = sy - WH;

    ctx.save();

    // ground shadow
    ctx.globalAlpha = 0.18; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(sx + 10 * s, sy + 14 * s, HW * 0.95, 22 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    // red carpet leading to the doors
    ctx.fillStyle = '#9B2235';
    ctx.beginPath(); ctx.roundRect(sx - 30 * s, sy - 4 * s, 60 * s, 44 * s, 4 * s); ctx.fill();
    ctx.strokeStyle = '#D4AF37'; ctx.lineWidth = 2 * s;
    ctx.beginPath(); ctx.moveTo(sx - 22 * s, sy - 2 * s); ctx.lineTo(sx - 22 * s, sy + 38 * s);
    ctx.moveTo(sx + 22 * s, sy - 2 * s); ctx.lineTo(sx + 22 * s, sy + 38 * s); ctx.stroke();

    // building body
    ctx.fillStyle = '#3A2E55';
    ctx.fillRect(sx - HW, top, HW * 2, WH);
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(sx - HW, top, HW * 2, WH * 0.5);
    ctx.fillStyle = 'rgba(0,0,0,0.20)'; ctx.fillRect(sx + HW - 18 * s, top, 18 * s, WH);

    // roof cornice
    ctx.fillStyle = '#241B3A';
    ctx.fillRect(sx - HW - 7 * s, top - 18 * s, HW * 2 + 14 * s, 24 * s);

    // marquee sign
    const mqY = top + 22 * s, mqH = 48 * s, mqX = sx - HW * 0.88, mqW = HW * 1.76;
    ctx.fillStyle = '#1C1530';
    ctx.beginPath(); ctx.roundRect(mqX - 4 * s, mqY - 4 * s, mqW + 8 * s, mqH + 8 * s, 10 * s); ctx.fill();
    const mg = ctx.createLinearGradient(0, mqY, 0, mqY + mqH);
    mg.addColorStop(0, '#FFE066'); mg.addColorStop(1, '#F2B705');
    ctx.fillStyle = mg;
    ctx.beginPath(); ctx.roundRect(mqX, mqY, mqW, mqH, 8 * s); ctx.fill();
    // blinking bulbs around the marquee
    const bulbs = Math.max(7, Math.round(mqW / (10 * s)));
    for (let i = 0; i <= bulbs; i++) {
      const bx = mqX + mqW * (i / bulbs);
      const on = (Math.floor(t * 4) + i) % 2 === 0;
      ctx.fillStyle = on ? '#FFF6C0' : '#9A7B16';
      ctx.beginPath(); ctx.arc(bx, mqY - 4 * s, 2.6 * s, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(bx, mqY + mqH + 4 * s, 2.6 * s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#7A1020';
    ctx.font = `900 ${30 * s}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('CINE', sx, mqY + mqH / 2);

    // two movie posters on the facade
    const posY = mqY + mqH + 16 * s, posW = 42 * s, posH = 56 * s;
    const posters = [['#E8503A', '#FFD23F'], ['#3A7BE8', '#7BD389']];
    for (let p = 0; p < 2; p++) {
      const pxp = sx + (p === 0 ? -HW * 0.55 : HW * 0.55) - posW / 2;
      ctx.fillStyle = '#0E0A1A';
      ctx.beginPath(); ctx.roundRect(pxp - 3 * s, posY - 3 * s, posW + 6 * s, posH + 6 * s, 4 * s); ctx.fill();
      const pg = ctx.createLinearGradient(0, posY, 0, posY + posH);
      pg.addColorStop(0, posters[p][0]); pg.addColorStop(1, posters[p][1]);
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.roundRect(pxp, posY, posW, posH, 3 * s); ctx.fill();
      // simple star on poster
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.arc(pxp + posW / 2, posY + posH * 0.4, posW * 0.16, 0, Math.PI * 2); ctx.fill();
    }

    // entrance doors (glassy, glowing)
    const dW = 64 * s, dH = 60 * s, dX = sx - dW / 2, dY = sy - dH;
    ctx.fillStyle = '#0E0A18';
    ctx.beginPath(); ctx.roundRect(dX - 4 * s, dY - 4 * s, dW + 8 * s, dH + 8 * s, 6 * s); ctx.fill();
    const dg = ctx.createLinearGradient(0, dY, 0, dY + dH);
    dg.addColorStop(0, '#5AC8FA'); dg.addColorStop(1, '#2A6A9A');
    ctx.fillStyle = dg;
    ctx.beginPath(); ctx.roundRect(dX, dY, dW, dH, 5 * s); ctx.fill();
    ctx.strokeStyle = '#102030'; ctx.lineWidth = 2 * s;
    ctx.beginPath(); ctx.moveTo(sx, dY); ctx.lineTo(sx, dY + dH); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath(); ctx.moveTo(dX + 6 * s, dY + 6 * s); ctx.lineTo(dX + 20 * s, dY + 6 * s);
    ctx.lineTo(dX + 8 * s, dY + dH - 6 * s); ctx.lineTo(dX + 2 * s, dY + dH - 6 * s); ctx.closePath(); ctx.fill();

    ctx.restore();
  }
}

// ── Boutique (launches the clothing store) ─────────────────────────────────

class BoutiqueBuilding {
  constructor(x, y) { this.x = x; this.y = y; }

  containsPoint(wx, wy, worldH) {
    const s  = 0.72 + (this.y / worldH) * 0.48;
    const HW = 92 * s, WH = 128 * s;
    return wx >= this.x - HW && wx <= this.x + HW &&
           wy >= this.y - WH && wy <= this.y + 40 * s;
  }

  draw(ctx, cam, depthScaleFn) {
    const sx = Math.round(this.x - cam.x), sy = Math.round(this.y - cam.y);
    if (sx < -280 || sx > ctx.canvas.width / cam.zoom + 280) return;
    if (sy < -360 || sy > ctx.canvas.height / cam.zoom + 60)  return;
    const s = depthScaleFn(this.y);
    const t = performance.now() * 0.001;
    const HW = 92 * s, WH = 128 * s, top = sy - WH;

    ctx.save();

    // ground shadow
    ctx.globalAlpha = 0.17; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(sx + 10*s, sy + 14*s, HW*0.92, 20*s, 0, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;

    // entrance carpet
    ctx.fillStyle = '#B83868';
    ctx.beginPath(); ctx.roundRect(sx - 26*s, sy - 2*s, 52*s, 40*s, 4*s); ctx.fill();
    ctx.strokeStyle = '#F0C060'; ctx.lineWidth = 2*s;
    ctx.beginPath(); ctx.roundRect(sx - 22*s, sy + 2*s, 44*s, 32*s, 3*s); ctx.stroke();

    // main wall
    ctx.fillStyle = '#FEF4F6';
    ctx.fillRect(sx - HW, top, HW * 2, WH);

    // subtle vertical siding lines
    ctx.strokeStyle = 'rgba(210,150,170,0.10)'; ctx.lineWidth = 1;
    for (let xl = sx - HW + 14*s; xl < sx + HW; xl += 14*s) {
      ctx.beginPath(); ctx.moveTo(xl, top); ctx.lineTo(xl, sy); ctx.stroke();
    }

    // cornice bar
    ctx.fillStyle = '#E8A8C0';
    ctx.fillRect(sx - HW - 6*s, top - 22*s, HW*2 + 12*s, 28*s);
    // small arch cutouts on cornice
    ctx.fillStyle = '#FEF4F6';
    const archN = 8;
    for (let i = 0; i < archN; i++) {
      const ax = sx - HW - 3*s + (i + 0.5) * ((HW*2 + 6*s) / archN);
      ctx.beginPath(); ctx.arc(ax, top - 4*s, 7*s, Math.PI, 0); ctx.fill();
    }

    // triangular pediment
    ctx.fillStyle = '#CE5878';
    ctx.beginPath();
    ctx.moveTo(sx - HW - 6*s, top - 22*s);
    ctx.lineTo(sx, top - 64*s);
    ctx.lineTo(sx + HW + 6*s, top - 22*s);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#A03858'; ctx.lineWidth = 2*s; ctx.stroke();

    // rose rosette on pediment
    const rox = sx, roy = top - 48*s;
    ctx.fillStyle = '#F8E0EC';
    ctx.beginPath(); ctx.arc(rox, roy, 9*s, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#D04870';
    for (let i = 0; i < 6; i++) {
      const a = (i/6)*Math.PI*2;
      ctx.beginPath(); ctx.arc(rox + Math.cos(a)*9*s, roy + Math.sin(a)*9*s, 4*s, 0, Math.PI*2); ctx.fill();
    }
    ctx.fillStyle = '#FFD880';
    ctx.beginPath(); ctx.arc(rox, roy, 3.5*s, 0, Math.PI*2); ctx.fill();

    // sign box
    const sgY = top + 14*s, sgH = 44*s, sgX = sx - HW*0.84, sgW = HW*1.68;
    ctx.fillStyle = '#6A1030';
    ctx.beginPath(); ctx.roundRect(sgX - 4*s, sgY - 4*s, sgW + 8*s, sgH + 8*s, 8*s); ctx.fill();
    const sgg = ctx.createLinearGradient(0, sgY, 0, sgY + sgH);
    sgg.addColorStop(0, '#E82868'); sgg.addColorStop(1, '#B01850');
    ctx.fillStyle = sgg;
    ctx.beginPath(); ctx.roundRect(sgX, sgY, sgW, sgH, 6*s); ctx.fill();
    // blinking sign dots
    const nDots = Math.max(8, Math.round(sgW / (10*s)));
    for (let i = 0; i <= nDots; i++) {
      const bx = sgX + sgW * (i / nDots);
      const on = (Math.floor(t * 5) + i) % 2 === 0;
      ctx.fillStyle = on ? '#FFE0FF' : '#901840';
      ctx.beginPath(); ctx.arc(bx, sgY - 3*s, 2.4*s, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(bx, sgY + sgH + 3*s, 2.4*s, 0, Math.PI*2); ctx.fill();
    }
    ctx.fillStyle = '#FFE8F6';
    ctx.font = `900 ${26*s}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('BOUTIQUE', sx, sgY + sgH/2);

    // two display windows
    const dWinW = 50*s, dWinH = 52*s, dWinY = sgY + sgH + 10*s;
    for (let side = -1; side <= 1; side += 2) {
      const wx2 = sx + side * HW * 0.55;
      // outer frame
      ctx.fillStyle = '#FFF';
      ctx.beginPath(); ctx.roundRect(wx2 - dWinW/2 - 4*s, dWinY - 4*s, dWinW + 8*s, dWinH + 8*s, 4*s); ctx.fill();
      // glass
      ctx.fillStyle = '#DAF0FF';
      ctx.fillRect(wx2 - dWinW/2, dWinY, dWinW, dWinH);
      // mannequin — dress
      ctx.fillStyle = side < 0 ? '#E070B0' : '#9060D0';
      // torso
      ctx.beginPath(); ctx.ellipse(wx2, dWinY + dWinH*0.34, 9*s, 14*s, 0, 0, Math.PI*2); ctx.fill();
      // skirt flare
      ctx.beginPath();
      ctx.moveTo(wx2 - 12*s, dWinY + dWinH*0.55);
      ctx.quadraticCurveTo(wx2 - 20*s, dWinY + dWinH*0.80, wx2 - 18*s, dWinY + dWinH - 4*s);
      ctx.lineTo(wx2 + 18*s, dWinY + dWinH - 4*s);
      ctx.quadraticCurveTo(wx2 + 20*s, dWinY + dWinH*0.80, wx2 + 12*s, dWinY + dWinH*0.55);
      ctx.closePath(); ctx.fill();
      // head
      ctx.fillStyle = '#EEC0A0';
      ctx.beginPath(); ctx.arc(wx2, dWinY + dWinH*0.14, 7*s, 0, Math.PI*2); ctx.fill();
      // star sparkle
      ctx.save(); ctx.globalAlpha = 0.55 + 0.3*Math.sin(t*3.5 + side*1.5);
      ctx.fillStyle = '#FFE8F8'; ctx.font = `${11*s}px system-ui`;
      ctx.textBaseline = 'middle'; ctx.fillText('✨', wx2 + 16*s, dWinY + 8*s); ctx.restore();
      // price tag
      ctx.fillStyle = '#FFE88A';
      ctx.beginPath(); ctx.roundRect(wx2 + dWinW/2 - 22*s, dWinY + dWinH*0.28, 20*s, 12*s, 3*s); ctx.fill();
      ctx.fillStyle = '#7A3800'; ctx.font = `bold ${7*s}px system-ui`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('¡SALE!', wx2 + dWinW/2 - 12*s, dWinY + dWinH*0.28 + 6*s);
    }

    // glass entrance doors
    const entW = 52*s, entH = 50*s, entX = sx - entW/2, entY = sy - entH;
    // arch frame
    ctx.fillStyle = '#F0D0DC';
    ctx.beginPath(); ctx.arc(sx, entY, entW/2 + 6*s, Math.PI, 0); ctx.fill();
    ctx.fillRect(entX - 6*s, entY, entW + 12*s, 10*s);
    // glass panels
    const dg = ctx.createLinearGradient(0, entY, 0, entY + entH);
    dg.addColorStop(0, '#DDEEFF'); dg.addColorStop(1, '#AACCEE');
    ctx.fillStyle = dg;
    ctx.beginPath(); ctx.roundRect(entX, entY, entW, entH, [4*s,4*s,0,0]); ctx.fill();
    ctx.strokeStyle = '#C0A0B8'; ctx.lineWidth = 2*s;
    ctx.beginPath(); ctx.moveTo(sx, entY); ctx.lineTo(sx, entY+entH); ctx.stroke();
    // door shine
    ctx.fillStyle = 'rgba(255,255,255,0.20)';
    ctx.beginPath(); ctx.moveTo(entX+4*s,entY+4*s); ctx.lineTo(entX+16*s,entY+4*s); ctx.lineTo(entX+6*s,entY+entH-6*s); ctx.lineTo(entX+2*s,entY+entH-6*s); ctx.closePath(); ctx.fill();

    // pink striped awning
    const awTop = entY - 10*s, awBot = entY + 10*s, awHW = 48*s;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(sx - awHW, awTop); ctx.lineTo(sx + awHW, awTop);
    ctx.lineTo(sx + awHW + 8*s, awBot); ctx.lineTo(sx - awHW - 8*s, awBot);
    ctx.closePath(); ctx.clip();
    ctx.fillStyle = '#E06090';
    ctx.fillRect(sx - awHW - 10*s, awTop, awHW*2 + 20*s, awBot - awTop);
    ctx.fillStyle = '#FFF4F8';
    for (let si = -5; si <= 5; si++) {
      ctx.fillRect(sx + si*13*s - 4*s, awTop, 7*s, awBot - awTop);
    }
    ctx.restore();
    // awning scalloped edge
    ctx.fillStyle = '#E06090';
    for (let sc2 = -4; sc2 <= 4; sc2++) {
      ctx.beginPath(); ctx.arc(sx + sc2*13*s, awBot, 6.5*s, 0, Math.PI); ctx.fill();
    }

    // steps
    ctx.fillStyle = '#EED8DC';
    ctx.beginPath(); ctx.roundRect(sx - entW/2 - 8*s, sy, entW+16*s, 7*s, 2*s); ctx.fill();
    ctx.fillStyle = '#DEC8CC';
    ctx.beginPath(); ctx.roundRect(sx - entW/2 - 5*s, sy+7*s, entW+10*s, 6*s, 2*s); ctx.fill();

    // floating label
    const bob = Math.sin(t * 2) * 3 * s;
    const lw = 138*s, lh = 30*s, lx = sx - lw/2, ly = sy - WH - 50*s + bob;
    ctx.fillStyle = 'rgba(90,20,45,0.93)';
    ctx.beginPath(); ctx.roundRect(lx, ly, lw, lh, 9*s); ctx.fill();
    ctx.beginPath(); ctx.moveTo(sx-7*s, ly+lh); ctx.lineTo(sx+7*s, ly+lh); ctx.lineTo(sx, ly+lh+8*s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#FFD8EE';
    ctx.font = `900 ${15*s}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('👗 BOUTIQUE ▶', sx, ly + lh/2);

    ctx.restore();
  }
}

// ── Hole portal (launches the hole mini-game) ───────────────────────────────

class HolePortal {
  constructor(x, y) { this.x = x; this.y = y; }

  containsPoint(wx, wy) { return Math.hypot(wx - this.x, wy - this.y) < 80; }

  draw(ctx, cam, depthScaleFn) {
    const sx = Math.round(this.x - cam.x), sy = Math.round(this.y - cam.y);
    if (sx < -180 || sx > ctx.canvas.width / cam.zoom + 180) return;
    if (sy < -240 || sy > ctx.canvas.height / cam.zoom + 90)  return;
    const s = depthScaleFn(this.y);
    const r = 62 * s;
    const t = performance.now() * 0.001;

    // pull-shadow on the grass
    const g = ctx.createRadialGradient(sx, sy, r * 0.7, sx, sy, r * 1.7);
    g.addColorStop(0, 'rgba(0,0,0,0.32)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, r * 1.7, 0, Math.PI * 2); ctx.fill();

    // dug edge
    ctx.fillStyle = '#5E7A3C';
    ctx.beginPath(); ctx.ellipse(sx, sy, r * 1.08, r * 1.0, 0, 0, Math.PI * 2); ctx.fill();

    // void
    const hg = ctx.createRadialGradient(sx, sy - r * 0.18, r * 0.05, sx, sy, r);
    hg.addColorStop(0, '#000000'); hg.addColorStop(0.55, '#080510');
    hg.addColorStop(0.85, '#170E26'); hg.addColorStop(1, '#2A1C3E');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();

    // swirling vortex
    ctx.save();
    ctx.beginPath(); ctx.arc(sx, sy, r * 0.98, 0, Math.PI * 2); ctx.clip();
    ctx.translate(sx, sy); ctx.rotate(t * 0.8);
    ctx.strokeStyle = 'rgba(150,110,200,0.18)';
    for (let k = 0; k < 3; k++) {
      ctx.lineWidth = r * 0.05; ctx.beginPath();
      for (let a = 0; a < Math.PI * 3; a += 0.3) {
        const rr = r * 0.15 + a / (Math.PI * 3) * r * 0.8;
        const px = Math.cos(a + k * 2.1) * rr, py = Math.sin(a + k * 2.1) * rr;
        a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();

    // rim highlight
    ctx.lineWidth = Math.max(1.5, r * 0.07);
    ctx.strokeStyle = 'rgba(180,160,220,0.45)';
    ctx.beginPath(); ctx.arc(sx, sy, r * 0.95, Math.PI * 1.05, Math.PI * 1.85); ctx.stroke();

    // floating label
    const bob = Math.sin(t * 2) * 3 * s;
    const lw = 116 * s, lh = 30 * s, lx = sx - lw / 2, ly = sy - r - 50 * s + bob;
    ctx.fillStyle = 'rgba(35,18,52,0.94)';
    ctx.beginPath(); ctx.roundRect(lx, ly, lw, lh, 9 * s); ctx.fill();
    ctx.beginPath(); ctx.moveTo(sx - 7 * s, ly + lh); ctx.lineTo(sx + 7 * s, ly + lh); ctx.lineTo(sx, ly + lh + 8 * s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#C9A8FF';
    ctx.font = `900 ${15 * s}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('AGUJERO ▶', sx, ly + lh / 2);
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

    // Commercial buildings (flanking the main road intersection)
    this._objects.push(new CinemaBuilding(W * 0.28, H * 0.44));
    this._objects.push(new BoutiqueBuilding(W * 0.72, H * 0.44));
    this._objects.push(new HolePortal(W * 0.50, H * 0.62));

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
      const nearCinema   = Math.abs(x - W * 0.28) < 150 && Math.abs(y - H * 0.44) < 170;
      const nearBoutique = Math.abs(x - W * 0.72) < 150 && Math.abs(y - H * 0.44) < 170;
      const nearPortal   = Math.hypot(x - W * 0.50, y - H * 0.62) < 120;
      if (!nearRoad && !nearHouseRow && !nearCinema && !nearBoutique && !nearPortal) this._objects.push(new Flower(x, y));
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
        if (obj._winCount === 1) {
          out.push({ worldX: obj.x, worldY: wY, radius: 70*s, color: [255, 210, 140] });
        } else {
          out.push({ worldX: obj.x - HW*0.52, worldY: wY, radius: 60*s, color: [255, 210, 140] });
          out.push({ worldX: obj.x + HW*0.52, worldY: wY, radius: 60*s, color: [255, 210, 140] });
        }
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

  getCinemaAt(wx, wy, worldH) {
    for (const o of this._objects) {
      if (o instanceof CinemaBuilding && o.containsPoint(wx, wy, worldH)) return o;
    }
    return null;
  }

  getBoutiqueAt(wx, wy, worldH) {
    for (const o of this._objects) {
      if (o instanceof BoutiqueBuilding && o.containsPoint(wx, wy, worldH)) return o;
    }
    return null;
  }

  getHolePortalAt(wx, wy) {
    for (const o of this._objects) {
      if (o instanceof HolePortal && o.containsPoint(wx, wy)) return o;
    }
    return null;
  }

  destroy() { this._bg = null; this._objects = []; }
}
