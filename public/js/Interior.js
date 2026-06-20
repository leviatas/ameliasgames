// ── Interior room constants ───────────────────────────────────────────────
export const INTERIOR_W = 1200;
export const INTERIOR_H = 900;

export function interiorDepthScale(worldY) {
  return 0.78 + (worldY / INTERIOR_H) * 0.36;
}

// ── Colour helper ─────────────────────────────────────────────────────────
function shade(hex, amt) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  const f = amt > 0 ? amt : 0, d = amt < 0 ? -amt : 0;
  return `rgb(${Math.min(255,Math.round(r+(255-r)*f-r*d))},${Math.min(255,Math.round(g+(255-g)*f-g*d))},${Math.min(255,Math.round(b+(255-b)*f-b*d))})`;
}

// ── TV + Stand ────────────────────────────────────────────────────────────
class TV {
  constructor(x, y) { this.x = x; this.y = y; this._t = 0; }
  draw(ctx, cam, ds) {
    const sx = Math.round(this.x-cam.x), sy = Math.round(this.y-cam.y), s = ds(this.y);
    this._t = performance.now() * 0.001;

    // Stand base
    ctx.fillStyle = '#3A2A1A';
    ctx.beginPath();
    ctx.roundRect(sx-55*s, sy-6*s, 110*s, 12*s, 3*s); ctx.fill();
    // Stand neck
    ctx.fillStyle = '#2A1A0A';
    ctx.fillRect(sx-6*s, sy-26*s, 12*s, 22*s);
    // Screen frame
    ctx.fillStyle = '#151520';
    ctx.beginPath();
    ctx.roundRect(sx-70*s, sy-90*s, 140*s, 68*s, 6*s); ctx.fill();
    // Screen content (gradient)
    const sg = ctx.createLinearGradient(sx-64*s, sy-84*s, sx+64*s, sy-28*s);
    sg.addColorStop(0,'#0D2060');
    sg.addColorStop(0.4,'#1A4080');
    sg.addColorStop(0.7,'#102050');
    sg.addColorStop(1,'#0A1840');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.roundRect(sx-64*s, sy-84*s, 128*s, 60*s, 3*s); ctx.fill();
    // "Content" lines (shift around like a changing scene)
    ctx.strokeStyle='rgba(120,180,255,0.3)'; ctx.lineWidth=1.5*s;
    for(let i=0;i<4;i++){
      const wob = Math.sin(this._t * 1.7 + i * 1.3) * 18 * s;
      ctx.beginPath();
      ctx.moveTo(sx-50*s, sy-72*s+i*14*s);
      ctx.lineTo(sx+(20+i*10)*s + wob, sy-72*s+i*14*s); ctx.stroke();
    }
    // Screen glow (flickering broadcast light)
    const flick = 0.5 + 0.5 * Math.abs(Math.sin(this._t * 6.0)) * (0.6 + 0.4 * Math.sin(this._t * 13.0));
    ctx.save();
    ctx.globalAlpha = 0.10 + 0.10 * flick;
    ctx.fillStyle = flick > 0.6 ? '#80B0FF' : '#4080FF';
    ctx.beginPath();
    ctx.ellipse(sx,sy-56*s,80*s,40*s,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
    // Speaker bar
    ctx.fillStyle='#252535';
    ctx.beginPath();
    ctx.roundRect(sx-55*s, sy-28*s, 110*s, 6*s, 2*s); ctx.fill();
  }
}

// ── Sofa ──────────────────────────────────────────────────────────────────
class Sofa {
  constructor(x, y, color='#B03030') { this.x=x; this.y=y; this._c=color; }
  draw(ctx, cam, ds) {
    const sx=Math.round(this.x-cam.x), sy=Math.round(this.y-cam.y), s=ds(this.y);
    const c=this._c, dark=shade(c,-0.18), light=shade(c,0.2);
    // Arms
    ctx.fillStyle=dark;
    ctx.beginPath();
    ctx.roundRect(sx-100*s, sy-50*s, 18*s, 62*s, 4*s);
    ctx.roundRect(sx+82*s,  sy-50*s, 18*s, 62*s, 4*s); ctx.fill();
    // Back cushion
    ctx.fillStyle=dark;
    ctx.beginPath();
    ctx.roundRect(sx-84*s, sy-54*s, 168*s, 30*s, 5*s); ctx.fill();
    // Seat
    ctx.fillStyle=c;
    ctx.beginPath();
    ctx.roundRect(sx-84*s, sy-26*s, 168*s, 40*s, [0,0,5*s,5*s]); ctx.fill();
    // Seat dividers
    ctx.strokeStyle='rgba(0,0,0,0.12)'; ctx.lineWidth=1.5*s;
    ctx.beginPath();
    ctx.moveTo(sx-28*s, sy-26*s); ctx.lineTo(sx-28*s, sy+14*s);
    ctx.moveTo(sx+28*s, sy-26*s); ctx.lineTo(sx+28*s, sy+14*s); ctx.stroke();
    // Pillows
    for(const [px,pc] of [[-56,light],[0,'#FFF8F0'],[56,light]]){
      ctx.fillStyle=pc;
      ctx.beginPath();
      ctx.roundRect(sx+(px-22)*s, sy-50*s, 44*s, 30*s, 4*s); ctx.fill();
    }
    // Legs
    ctx.fillStyle='#3A2010';
    for(const lx of [-88, -60, 60, 88]){
      ctx.beginPath();
      ctx.roundRect(sx+lx*s, sy+12*s, 8*s, 12*s, 2*s); ctx.fill();
    }
    // Shadow
    ctx.save();
    ctx.globalAlpha=0.15;
    ctx.fillStyle='#000';
    ctx.beginPath();
    ctx.ellipse(sx, sy+22*s, 90*s, 10*s, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

// ── Coffee table ──────────────────────────────────────────────────────────
class CoffeeTable {
  constructor(x, y) { this.x=x; this.y=y; }
  draw(ctx, cam, ds) {
    const sx=Math.round(this.x-cam.x), sy=Math.round(this.y-cam.y), s=ds(this.y);
    ctx.fillStyle='#7A5232';
    ctx.beginPath();
    ctx.roundRect(sx-50*s, sy-26*s, 100*s, 50*s, 6*s); ctx.fill();
    // Wood grain
    ctx.strokeStyle='rgba(0,0,0,0.07)'; ctx.lineWidth=1*s;
    for(let l=0;l<4;l++){
      ctx.beginPath();
      ctx.moveTo(sx-48*s, sy-20*s+l*11*s); ctx.lineTo(sx+48*s, sy-20*s+l*11*s); ctx.stroke();
    }
    // Items: remote
    ctx.fillStyle='#222'; ctx.beginPath();
    ctx.roundRect(sx-30*s, sy-18*s, 20*s, 35*s, 4*s); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.15)';
    for(let b=0;b<3;b++){ ctx.beginPath(); ctx.arc(sx-20*s, sy-12*s+b*10*s, 3*s, 0, Math.PI*2); ctx.fill(); }
    // Coffee mug
    ctx.fillStyle='#E8E8E8'; ctx.beginPath();
    ctx.ellipse(sx+20*s, sy-14*s, 10*s, 7*s, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle='#C0C0C0'; ctx.beginPath();
    ctx.roundRect(sx+10*s, sy-14*s, 20*s, 22*s, 3*s); ctx.fill();
    ctx.fillStyle='#60300A'; ctx.beginPath();
    ctx.ellipse(sx+20*s, sy-15*s, 8*s, 5*s, 0, 0, Math.PI*2); ctx.fill();
    // Handle
    ctx.strokeStyle='#C0C0C0'; ctx.lineWidth=2.5*s; ctx.beginPath();
    ctx.arc(sx+30*s, sy-4*s, 8*s, -0.8, 0.8); ctx.stroke();
    // Legs
    ctx.fillStyle='#5A3818';
    for(const [lx,ly] of [[-46,-24],[-46,22],[42,-24],[42,22]]){
      ctx.fillRect(sx+lx*s, sy+ly*s, 7*s, 10*s);
    }
  }
}

// ── Bookshelf ─────────────────────────────────────────────────────────────
class Bookshelf {
  constructor(x, y) {
    this.x=x; this.y=y;
    const cols=['#C03030','#3060C0','#308030','#C08030','#8030C0','#C06060',
                '#6080C0','#60A060','#C09040','#A060A0','#205080','#804020'];
    // Pre-generate book widths/colors
    this._books = Array.from({length:3}, (_,sh)=>
      Array.from({length:8}, (_,bi)=>({
        w: 9+Math.random()*5,
        c: cols[(sh*8+bi)%cols.length]
      }))
    );
  }
  draw(ctx, cam, ds) {
    const sx=Math.round(this.x-cam.x), sy=Math.round(this.y-cam.y), s=ds(this.y);
    // Cabinet
    ctx.fillStyle='#5A3818';
    ctx.beginPath();
    ctx.roundRect(sx-50*s, sy-130*s, 100*s, 134*s, 3*s); ctx.fill();
    // Back panel
    ctx.fillStyle='#4A2808';
    ctx.fillRect(sx-46*s, sy-126*s, 92*s, 126*s);
    // Shelves
    for(let sh=0;sh<4;sh++){
      ctx.fillStyle='#6A4020';
      ctx.fillRect(sx-46*s, sy-126*s+sh*34*s, 92*s, 5*s);
    }
    // Books
    for(let sh=0;sh<3;sh++){
      let bx=sx-44*s;
      for(const b of this._books[sh]){
        if(bx+b.w*s > sx+44*s) break;
        ctx.fillStyle=b.c;
        ctx.fillRect(bx, sy-120*s+sh*34*s, b.w*s, 28*s);
        ctx.strokeStyle='rgba(0,0,0,0.2)'; ctx.lineWidth=0.5;
        ctx.strokeRect(bx, sy-120*s+sh*34*s, b.w*s, 28*s);
        bx += (b.w+1)*s;
      }
    }
    // Top decor: small plant + photo frame
    ctx.fillStyle='#C05020'; ctx.beginPath();
    ctx.roundRect(sx-38*s, sy-142*s, 12*s, 16*s, 2*s); ctx.fill();
    ctx.fillStyle='#40A030'; ctx.beginPath();
    ctx.arc(sx-32*s, sy-148*s, 10*s, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle='#D0C8B0'; ctx.beginPath();
    ctx.roundRect(sx+14*s, sy-145*s, 20*s, 16*s, 2*s); ctx.fill();
    ctx.fillStyle='#8090C0'; ctx.fillRect(sx+16*s, sy-143*s, 16*s, 12*s);
    ctx.fillStyle='rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.arc(sx+24*s, sy-138*s, 4*s, 0, Math.PI*2); ctx.fill();
    // Shadow
    ctx.save(); ctx.globalAlpha=0.15; ctx.fillStyle='#000';
    ctx.beginPath(); ctx.ellipse(sx, sy+2*s, 50*s, 10*s, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

// ── Plant ─────────────────────────────────────────────────────────────────
class Plant {
  constructor(x, y, big=false) { this.x=x; this.y=y; this._big=big; this._phase=Math.random()*Math.PI*2; }
  draw(ctx, cam, ds) {
    const sx=Math.round(this.x-cam.x), sy=Math.round(this.y-cam.y), s=ds(this.y);
    const sc=this._big?1.4:1;
    const sway=Math.sin(performance.now()*0.001*1.3+this._phase)*1.3*s;
    // Pot
    const g=ctx.createLinearGradient(sx-14*s*sc, sy, sx+14*s*sc, sy);
    g.addColorStop(0,'#C84820'); g.addColorStop(1,'#E06030');
    ctx.fillStyle=g;
    ctx.beginPath();
    ctx.moveTo(sx-14*s*sc, sy+2*s);
    ctx.lineTo(sx+14*s*sc, sy+2*s);
    ctx.lineTo(sx+10*s*sc, sy-22*s*sc);
    ctx.lineTo(sx-10*s*sc, sy-22*s*sc);
    ctx.closePath(); ctx.fill();
    // Rim
    ctx.fillStyle='#D05028';
    ctx.beginPath();
    ctx.ellipse(sx, sy-22*s*sc, 12*s*sc, 4*s*sc, 0, 0, Math.PI*2); ctx.fill();
    // Soil
    ctx.fillStyle='#2A1808';
    ctx.beginPath();
    ctx.ellipse(sx, sy-22*s*sc, 10*s*sc, 3.5*s*sc, 0, 0, Math.PI*2); ctx.fill();
    // Leaves (sway gently; higher leaves move more)
    const leafPairs=this._big?7:5;
    for(let i=0;i<leafPairs;i++){
      const a=(i/leafPairs)*Math.PI*2;
      const r=(18+i%3*4)*s*sc;
      const lc=`hsl(${125+i*8},${55+i%3*5}%,${34+i%2*8}%)`;
      ctx.fillStyle=lc;
      ctx.beginPath();
      ctx.ellipse(sx+Math.cos(a)*r*0.7 + sway, sy-28*s*sc+Math.sin(a)*r*0.45,
        r*0.55, r*0.25, a, 0, Math.PI*2); ctx.fill();
    }
    // Top center
    ctx.fillStyle='#3AB840';
    ctx.beginPath();
    ctx.arc(sx + sway*1.3, sy-36*s*sc, 14*s*sc, 0, Math.PI*2); ctx.fill();
  }
}

// ── Rug ───────────────────────────────────────────────────────────────────
class Rug {
  constructor(x, y) { this.x=x; this.y=y; }
  draw(ctx, cam, ds) {
    const sx=Math.round(this.x-cam.x), sy=Math.round(this.y-cam.y), s=ds(this.y);
    // Outer ring
    ctx.fillStyle='#6A1A8A';
    ctx.beginPath();
    ctx.ellipse(sx, sy, 130*s, 72*s, 0, 0, Math.PI*2); ctx.fill();
    // Middle ring
    ctx.fillStyle='#B050D8';
    ctx.beginPath();
    ctx.ellipse(sx, sy, 108*s, 60*s, 0, 0, Math.PI*2); ctx.fill();
    // Inner ring
    ctx.fillStyle='#8030B0';
    ctx.beginPath();
    ctx.ellipse(sx, sy, 84*s, 46*s, 0, 0, Math.PI*2); ctx.fill();
    // Center
    ctx.fillStyle='#E090FF';
    ctx.beginPath();
    ctx.ellipse(sx, sy, 40*s, 22*s, 0, 0, Math.PI*2); ctx.fill();
    // Cross lines
    ctx.strokeStyle='rgba(255,255,255,0.2)'; ctx.lineWidth=2*s;
    ctx.beginPath();
    ctx.moveTo(sx-128*s, sy); ctx.lineTo(sx+128*s, sy);
    ctx.moveTo(sx, sy-70*s); ctx.lineTo(sx, sy+70*s); ctx.stroke();
    // Fringe
    ctx.strokeStyle='#5A1880'; ctx.lineWidth=2*s;
    for(let fi=-9;fi<=9;fi++){
      const fx=sx+fi*13*s;
      if(Math.abs(fi*13*s)>128*s) continue;
      ctx.beginPath();
      ctx.moveTo(fx, sy-71*s); ctx.lineTo(fx, sy-80*s);
      ctx.moveTo(fx, sy+71*s); ctx.lineTo(fx, sy+80*s); ctx.stroke();
    }
  }
}

// ── Dining table + chairs ─────────────────────────────────────────────────
class DiningSet {
  constructor(x, y) { this.x=x; this.y=y; }
  draw(ctx, cam, ds) {
    const sx=Math.round(this.x-cam.x), sy=Math.round(this.y-cam.y), s=ds(this.y);
    // Chairs behind table
    for(const [cx,cy] of [[-58,-52],[58,-52]]){
      this._drawChair(ctx, sx+cx*s, sy+cy*s, s, 0);
    }
    // Table
    const tg=ctx.createRadialGradient(sx-10*s, sy-10*s, 5*s, sx, sy, 65*s);
    tg.addColorStop(0,'#D4A060'); tg.addColorStop(1,'#A87040');
    ctx.fillStyle=tg;
    ctx.beginPath();
    ctx.ellipse(sx, sy, 65*s, 44*s, 0, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle='#8A5830'; ctx.lineWidth=2.5*s;
    ctx.beginPath();
    ctx.ellipse(sx, sy, 65*s, 44*s, 0, 0, Math.PI*2); ctx.stroke();
    // Wood grain
    ctx.strokeStyle='rgba(0,0,0,0.06)'; ctx.lineWidth=1*s;
    for(let l=0;l<4;l++){
      ctx.beginPath();
      ctx.moveTo(sx-60*s, sy-18*s+l*11*s); ctx.lineTo(sx+60*s, sy-18*s+l*11*s); ctx.stroke();
    }
    // Table center: candle + flowers
    ctx.fillStyle='#F0EEE0';
    ctx.beginPath();
    ctx.ellipse(sx, sy-8*s, 14*s, 9*s, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle='#F0F0E8';
    ctx.beginPath();
    ctx.roundRect(sx-4*s, sy-26*s, 8*s, 18*s, 2*s); ctx.fill();
    // Candle flame (flickering)
    const ct = performance.now() * 0.001;
    const fl = 1 + Math.sin(ct * 11) * 0.18 + Math.sin(ct * 23) * 0.08;
    const fx = sx + Math.sin(ct * 9) * 0.8 * s;
    ctx.fillStyle='#FF8800';
    ctx.beginPath();
    ctx.ellipse(fx, sy-28*s, 3*s, 6*s*fl, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle='#FFCC00';
    ctx.beginPath();
    ctx.ellipse(fx, sy-28*s+1*s, 2*s, 4*s*fl, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle='#FFF0B0';
    ctx.beginPath();
    ctx.arc(fx, sy-26*s, 1.4*s, 0, Math.PI*2); ctx.fill();
    // Candle glow
    ctx.save(); ctx.globalAlpha = 0.12 + 0.06 * fl; ctx.fillStyle='#FFE060';
    ctx.beginPath(); ctx.arc(fx, sy-28*s, 16*s*fl, 0, Math.PI*2); ctx.fill(); ctx.restore();
    // Plates
    for(const [ox,oy] of [[0,-30],[0,30],[-40,0],[40,0]]){
      ctx.fillStyle='#F5F0E8';
      ctx.beginPath(); ctx.ellipse(sx+ox*s, sy+oy*s, 12*s, 8*s, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,0.12)'; ctx.lineWidth=1*s;
      ctx.beginPath(); ctx.ellipse(sx+ox*s, sy+oy*s, 12*s, 8*s, 0, 0, Math.PI*2); ctx.stroke();
      // Food
      ctx.fillStyle='#C08040'; ctx.beginPath();
      ctx.ellipse(sx+ox*s, sy+oy*s, 7*s, 5*s, 0, 0, Math.PI*2); ctx.fill();
    }
    // Table leg
    ctx.fillStyle='#8A5830';
    ctx.fillRect(sx-4*s, sy+40*s, 8*s, 14*s);
    // Chairs in front
    for(const [cx,cy] of [[-58,52],[58,52]]){
      this._drawChair(ctx, sx+cx*s, sy+cy*s, s, Math.PI);
    }
    // Shadow
    ctx.save(); ctx.globalAlpha=0.12; ctx.fillStyle='#000';
    ctx.beginPath(); ctx.ellipse(sx+4*s, sy+54*s, 60*s, 14*s, 0, 0, Math.PI*2); ctx.fill(); ctx.restore();
  }
  _drawChair(ctx, sx, sy, s, angle) {
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(angle);
    ctx.fillStyle='#7A4828'; ctx.beginPath();
    ctx.roundRect(-14*s, -24*s, 28*s, 30*s, 3*s); ctx.fill();
    ctx.fillStyle='#A06840'; ctx.beginPath();
    ctx.roundRect(-14*s, 4*s, 28*s, 16*s, 3*s); ctx.fill();
    ctx.fillStyle='#C08060';
    ctx.fillRect(-12*s, 8*s, 24*s, 10*s);
    ctx.restore();
  }
}

// ── Kitchen counter ───────────────────────────────────────────────────────
class KitchenCounter {
  constructor(x, y) { this.x=x; this.y=y; }
  draw(ctx, cam, ds) {
    const sx=Math.round(this.x-cam.x), sy=Math.round(this.y-cam.y), s=ds(this.y);
    // Counter base
    ctx.fillStyle='#7A7060';
    ctx.beginPath();
    ctx.roundRect(sx-85*s, sy-36*s, 170*s, 40*s, [0,0,4*s,4*s]); ctx.fill();
    // Counter top
    ctx.fillStyle='#E0D8D0';
    ctx.beginPath();
    ctx.roundRect(sx-88*s, sy-42*s, 176*s, 10*s, [2*s,2*s,0,0]); ctx.fill();
    ctx.strokeStyle='#C8C0B8'; ctx.lineWidth=1*s;
    ctx.beginPath();
    ctx.roundRect(sx-88*s, sy-42*s, 176*s, 10*s, [2*s,2*s,0,0]); ctx.stroke();
    // Cabinet doors
    for(let d=0;d<3;d++){
      ctx.fillStyle='#8A8070';
      ctx.strokeStyle='rgba(0,0,0,0.15)'; ctx.lineWidth=1*s;
      ctx.beginPath();
      ctx.roundRect(sx-80*s+d*58*s, sy-32*s, 50*s, 30*s, 2*s);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle='#C8C0B0'; ctx.beginPath();
      ctx.arc(sx-55*s+d*58*s, sy-18*s, 3*s, 0, Math.PI*2); ctx.fill();
    }
    // Sink
    ctx.fillStyle='#C0B8B0';
    ctx.beginPath();
    ctx.roundRect(sx-30*s, sy-40*s, 60*s, 6*s, 2*s); ctx.fill();
    ctx.fillStyle='#A8A0A0';
    ctx.beginPath();
    ctx.roundRect(sx-26*s, sy-40*s, 52*s, 5*s, 1*s); ctx.fill();
    // Faucet
    ctx.fillStyle='#C8C0B8';
    ctx.fillRect(sx-2*s, sy-56*s, 4*s, 18*s);
    ctx.beginPath();
    ctx.roundRect(sx-8*s, sy-58*s, 16*s, 5*s, 2*s); ctx.fill();
    // Items: fruit bowl
    ctx.fillStyle='#D0C070'; ctx.beginPath();
    ctx.ellipse(sx+50*s, sy-46*s, 14*s, 6*s, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle='#E04030'; ctx.beginPath(); ctx.arc(sx+46*s, sy-52*s, 5*s, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle='#F0C020'; ctx.beginPath(); ctx.arc(sx+54*s, sy-53*s, 5*s, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle='#30A030'; ctx.beginPath(); ctx.arc(sx+50*s, sy-55*s, 4*s, 0, Math.PI*2); ctx.fill();
    // Wall tiles (above counter)
    ctx.save();
    ctx.strokeStyle='rgba(0,0,0,0.1)'; ctx.lineWidth=0.8*s;
    for(let tx=-8;tx<=8;tx++) for(let ty=0;ty<2;ty++){
      ctx.beginPath();
      ctx.rect(sx+tx*20*s, sy-80*s+ty*18*s, 20*s, 18*s); ctx.stroke();
    }
    ctx.restore();
    // Shadow
    ctx.save(); ctx.globalAlpha=0.12; ctx.fillStyle='#000';
    ctx.beginPath(); ctx.ellipse(sx+4*s, sy+2*s, 84*s, 12*s, 0, 0, Math.PI*2); ctx.fill(); ctx.restore();
  }
}

// ── Floor lamp ────────────────────────────────────────────────────────────
class FloorLamp {
  constructor(x, y) { this.x=x; this.y=y; }
  get lightX() { return this.x; }
  get lightY() { return this.y - 72; }
  draw(ctx, cam, ds) {
    const sx=Math.round(this.x-cam.x), sy=Math.round(this.y-cam.y), s=ds(this.y);
    ctx.fillStyle='#4A3A2A';
    ctx.beginPath(); ctx.ellipse(sx, sy+4*s, 10*s, 5*s, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle='#6A5A4A';
    ctx.fillRect(sx-2.5*s, sy-72*s, 5*s, 76*s);
    // Shade
    ctx.fillStyle='#FFE090';
    ctx.beginPath();
    ctx.moveTo(sx-20*s, sy-56*s);
    ctx.lineTo(sx+20*s, sy-56*s);
    ctx.lineTo(sx+13*s, sy-74*s);
    ctx.lineTo(sx-13*s, sy-74*s);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#C0A050'; ctx.lineWidth=1.5*s; ctx.stroke();
    // Glow (gentle breathing pulse)
    const lt = performance.now() * 0.001;
    const lp = 0.9 + 0.1 * Math.sin(lt * 3 + this.x * 0.03);
    ctx.save(); ctx.globalAlpha = 0.2 * lp; ctx.fillStyle='#FFE870';
    ctx.beginPath(); ctx.arc(sx, sy-62*s, 30*s*lp, 0, Math.PI*2); ctx.fill(); ctx.restore();
  }
}

// ── Fridge (heladera) — stores the dishes cooked in the kitchen game ────────
class Fridge {
  constructor(x, y) { this.x=x; this.y=y; this._t=Math.random()*9; }
  draw(ctx, cam, ds) {
    const sx=Math.round(this.x-cam.x), sy=Math.round(this.y-cam.y), s=ds(this.y);
    const w=64*s, h=128*s;
    // shadow
    ctx.save(); ctx.globalAlpha=0.14; ctx.fillStyle='#000';
    ctx.beginPath(); ctx.ellipse(sx+3*s, sy+4*s, 40*s, 11*s, 0, 0, Math.PI*2); ctx.fill(); ctx.restore();
    // body
    ctx.fillStyle='#E9F0F4';
    ctx.beginPath(); ctx.roundRect(sx-w/2, sy-h, w, h, 8*s); ctx.fill();
    ctx.strokeStyle='#C2CDD4'; ctx.lineWidth=2*s; ctx.stroke();
    // side shading
    ctx.fillStyle='rgba(0,0,0,0.05)';
    ctx.beginPath(); ctx.roundRect(sx+w/2-10*s, sy-h, 10*s, h, [0,8*s,8*s,0]); ctx.fill();
    // freezer / fridge split
    const split = sy - h + 44*s;
    ctx.strokeStyle='#C8D2D8'; ctx.lineWidth=2*s;
    ctx.beginPath(); ctx.moveTo(sx-w/2+3*s, split); ctx.lineTo(sx+w/2-3*s, split); ctx.stroke();
    // door panels
    ctx.fillStyle='#F6FAFC';
    ctx.beginPath(); ctx.roundRect(sx-w/2+5*s, sy-h+5*s, w-10*s, 34*s, 4*s); ctx.fill();
    ctx.beginPath(); ctx.roundRect(sx-w/2+5*s, split+5*s, w-10*s, h-54*s, 4*s); ctx.fill();
    // handles
    ctx.fillStyle='#9AA7AE';
    ctx.beginPath(); ctx.roundRect(sx+w/2-12*s, sy-h+12*s, 4*s, 20*s, 2*s); ctx.fill();
    ctx.beginPath(); ctx.roundRect(sx+w/2-12*s, split+12*s, 4*s, 40*s, 2*s); ctx.fill();
    // little heart magnet 💜
    ctx.fillStyle='#C86A9A';
    const hx=sx-w/2+18*s, hy=split+22*s, r=4*s;
    ctx.beginPath(); ctx.arc(hx-r*0.5, hy-r*0.3, r*0.55, 0, Math.PI*2); ctx.arc(hx+r*0.5, hy-r*0.3, r*0.55, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(hx-r, hy); ctx.lineTo(hx+r, hy); ctx.lineTo(hx, hy+r); ctx.closePath(); ctx.fill();
    // subtle highlight sweep
    ctx.save(); ctx.globalAlpha=0.5; ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.roundRect(sx-w/2+8*s, sy-h+8*s, 6*s, h-16*s, 3*s); ctx.fill(); ctx.restore();
  }
}

// ── Exit door ─────────────────────────────────────────────────────────────
class ExitDoor {
  constructor() { this.x=INTERIOR_W/2; this.y=INTERIOR_H-50; }
  draw(ctx, cam, ds) {
    const sx=Math.round(this.x-cam.x), sy=Math.round(this.y-cam.y), s=ds(this.y);
    // Door frame
    ctx.fillStyle='#C8B890';
    ctx.beginPath();
    ctx.roundRect(sx-26*s, sy-58*s, 52*s, 60*s, [5*s,5*s,0,0]); ctx.fill();
    // Door
    ctx.fillStyle='#8B5A30';
    ctx.beginPath();
    ctx.roundRect(sx-22*s, sy-54*s, 44*s, 56*s, [4*s,4*s,0,0]); ctx.fill();
    // Panels
    ctx.fillStyle='#7A4A20';
    ctx.beginPath();
    ctx.roundRect(sx-17*s, sy-50*s, 34*s, 22*s, 2*s);
    ctx.roundRect(sx-17*s, sy-24*s, 34*s, 20*s, 2*s); ctx.fill();
    // Window insert
    ctx.fillStyle='#A8CCFF';
    ctx.beginPath();
    ctx.roundRect(sx-14*s, sy-50*s, 28*s, 10*s, 2*s); ctx.fill();
    // Handle
    ctx.fillStyle='#FFD060'; ctx.beginPath();
    ctx.arc(sx+12*s, sy-30*s, 3.5*s, 0, Math.PI*2); ctx.fill();
    // SALIR label
    ctx.save();
    ctx.fillStyle='rgba(255,255,255,0.85)';
    ctx.font=`bold ${11*s}px sans-serif`;
    ctx.textAlign='center';
    ctx.fillText('SALIR', sx, sy+10*s);
    ctx.restore();
  }
}

// ── Bed (for bedroom corner) ──────────────────────────────────────────────
class Bed {
  constructor(x, y, color='#4060A0') { this.x=x; this.y=y; this._c=color; }
  draw(ctx, cam, ds) {
    const sx=Math.round(this.x-cam.x), sy=Math.round(this.y-cam.y), s=ds(this.y);
    // Frame
    ctx.fillStyle='#6B4226';
    ctx.beginPath();
    ctx.roundRect(sx-54*s, sy-80*s, 108*s, 88*s, 4*s); ctx.fill();
    // Headboard
    ctx.fillStyle='#7B4E32';
    ctx.beginPath();
    ctx.roundRect(sx-52*s, sy-86*s, 104*s, 18*s, [0,0,3*s,3*s]); ctx.fill();
    // Mattress
    ctx.fillStyle='#E8E0D0';
    ctx.beginPath();
    ctx.roundRect(sx-48*s, sy-76*s, 96*s, 76*s, 3*s); ctx.fill();
    // Blanket
    ctx.fillStyle=this._c;
    ctx.beginPath();
    ctx.roundRect(sx-46*s, sy-46*s, 92*s, 44*s, 3*s); ctx.fill();
    // Pillow(s)
    ctx.fillStyle='#FFFFF0';
    ctx.beginPath();
    ctx.roundRect(sx-40*s, sy-74*s, 36*s, 26*s, 4*s); ctx.fill();
    ctx.beginPath();
    ctx.roundRect(sx+4*s, sy-74*s, 36*s, 26*s, 4*s); ctx.fill();
    // Footboard
    ctx.fillStyle='#7B4E32';
    ctx.beginPath();
    ctx.roundRect(sx-52*s, sy-2*s, 104*s, 10*s, 2*s); ctx.fill();
    // Shadow
    ctx.save(); ctx.globalAlpha=0.12; ctx.fillStyle='#000';
    ctx.beginPath(); ctx.ellipse(sx+4*s, sy+8*s, 52*s, 10*s, 0, 0, Math.PI*2); ctx.fill(); ctx.restore();
  }
}

// ── Interior ──────────────────────────────────────────────────────────────

export class Interior {
  constructor(wallColor='#F0EAE0', accentColor='#B03030') {
    this._wallColor   = wallColor;
    this._accentColor = accentColor;
    this._objects     = [];
    this._bg          = this._buildBackground();
    this._buildFurniture();
  }

  _buildBackground() {
    const bg = document.createElement('canvas');
    bg.width = INTERIOR_W; bg.height = INTERIOR_H;
    const c = bg.getContext('2d');

    const W = INTERIOR_W, H = INTERIOR_H;
    const wallH = 130;

    // ── Floor (wood planks) ──
    const floorBase = document.createElement('canvas');
    floorBase.width = 128; floorBase.height = 40;
    const fc = floorBase.getContext('2d');
    // Base plank color
    const plankColors = ['#C49060','#BA8850','#CC9868','#B88048','#D4A070'];
    for(let row=0; row<2; row++){
      const pc = plankColors[(row*2)%plankColors.length];
      fc.fillStyle=pc; fc.fillRect(0, row*20, 128, 20);
      fc.fillStyle=plankColors[(row*2+1)%plankColors.length];
      fc.fillRect(row===0?64:0, row*20, 64, 20);
      // Grain lines
      fc.strokeStyle='rgba(0,0,0,0.06)'; fc.lineWidth=1;
      for(let g=2;g<128;g+=16){
        fc.beginPath(); fc.moveTo(g, row*20); fc.lineTo(g, row*20+20); fc.stroke();
      }
      // Edge seam
      fc.strokeStyle='rgba(0,0,0,0.15)'; fc.lineWidth=1.5;
      fc.beginPath(); fc.moveTo(0, row*20); fc.lineTo(128, row*20); fc.stroke();
    }
    const floorPat = c.createPattern(floorBase, 'repeat');
    c.fillStyle = floorPat;
    c.fillRect(0, wallH, W, H - wallH);

    // ── Wall (top section) ──
    const wg = c.createLinearGradient(0, 0, 0, wallH);
    wg.addColorStop(0, '#6A5848');
    wg.addColorStop(0.4, this._wallColor);
    wg.addColorStop(1, '#D8CCC0');
    c.fillStyle = wg;
    c.fillRect(0, 0, W, wallH);

    // Wallpaper stripe pattern
    c.strokeStyle = 'rgba(0,0,0,0.06)'; c.lineWidth = 1;
    for(let wx=0; wx<W; wx+=28){
      c.beginPath(); c.moveTo(wx, 0); c.lineTo(wx, wallH); c.stroke();
    }

    // Wall-floor divider (baseboard)
    c.fillStyle = '#E8E0D0';
    c.fillRect(0, wallH-10, W, 14);
    c.strokeStyle = '#D0C8C0'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(0, wallH-10); c.lineTo(W, wallH-10); c.stroke();
    c.beginPath(); c.moveTo(0, wallH+4);  c.lineTo(W, wallH+4);  c.stroke();

    // Ceiling shadow (depth feel)
    const ceilShadow = c.createLinearGradient(0, 0, 0, 40);
    ceilShadow.addColorStop(0, 'rgba(0,0,0,0.35)');
    ceilShadow.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = ceilShadow;
    c.fillRect(0, 0, W, 40);

    // Left/right wall shadows
    for(const [x, dir] of [[0,1],[W,-1]]){
      const sg = c.createLinearGradient(x, 0, x+dir*60, 0);
      sg.addColorStop(0, 'rgba(0,0,0,0.2)');
      sg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle=sg; c.fillRect(x, 0, dir*60, H);
    }

    // Room border (walls)
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 4;
    c.strokeRect(2, 2, W-4, H-4);

    // Floor ambient occlusion at walls
    for(const [x, y, rx, ry] of [
      [0, H-1, W/2, 30], [W/2, wallH, W/2, 20]
    ]){
      const sg = c.createRadialGradient(x, y, 0, x, y, rx);
      sg.addColorStop(0, 'rgba(0,0,0,0.12)');
      sg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle=sg;
      c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI*2); c.fill();
    }

    // Door opening at bottom
    c.fillStyle = '#2A1808';
    c.beginPath();
    c.roundRect(W/2-28, H-55, 56, 55, [5,5,0,0]); c.fill();
    // Door frame
    c.strokeStyle = '#C8B890'; c.lineWidth = 8;
    c.beginPath();
    c.roundRect(W/2-32, H-58, 64, 58, [6,6,0,0]); c.stroke();

    return bg;
  }

  _buildFurniture() {
    const W = INTERIOR_W, H = INTERIOR_H;
    const cx = W / 2;

    // TV unit on north wall
    this._objects.push(new TV(cx, 155));
    // Sofa facing TV
    this._objects.push(new Sofa(cx, 330, this._accentColor));
    // Coffee table between sofa and TV
    this._objects.push(new CoffeeTable(cx, 240));
    // Rug under living area
    this._objects.push(new Rug(cx, 280));
    // Bookshelf left wall
    this._objects.push(new Bookshelf(100, 280));
    // Bookshelf right wall
    this._objects.push(new Bookshelf(W-100, 280));
    // Plants in corners
    this._objects.push(new Plant(70, 180, true));
    this._objects.push(new Plant(W-70, 180, true));
    this._objects.push(new Plant(180, 500));
    this._objects.push(new Plant(W-200, 520));
    // Dining set - right side
    this._objects.push(new DiningSet(W*0.75, 500));
    // Kitchen counter - left side
    this._objects.push(new Fridge(W*0.34, 500));
    this._objects.push(new KitchenCounter(W*0.22, 480));
    // Bed - top right corner (bedroom vibe)
    this._objects.push(new Bed(W-140, 250, this._accentColor));
    // Floor lamps
    this._objects.push(new FloorLamp(cx-160, 400));
    this._objects.push(new FloorLamp(cx+160, 420));
    // Exit door
    this._objects.push(new ExitDoor());
  }

  render(ctx, cam, vw, vh) {
    ctx.fillStyle = '#6A5848';
    ctx.fillRect(0, 0, vw, vh);
    ctx.drawImage(this._bg, cam.x, cam.y, vw, vh, 0, 0, vw, vh);
  }

  getDrawables() { return this._objects; }

  // Returns screen-space light positions (inside zoom-scaled context)
  getLightSources(cam, ds) {
    const out = [];
    for(const obj of this._objects){
      if(obj instanceof FloorLamp){
        const s = ds(obj.y);
        out.push({
          sx: obj.x - cam.x,
          sy: obj.y - cam.y - 62 * s,
          r: 100 * s,
          color: [255, 235, 140]
        });
      }
    }
    return out;
  }

  isNearDoor(x, y) {
    return Math.abs(x - INTERIOR_W / 2) < 60 && y > INTERIOR_H - 130;
  }

  // Hit-test the TV (to launch the dog runner mini-game)
  containsTV(wx, wy) {
    const tx = INTERIOR_W / 2, ty = 155, s = interiorDepthScale(ty);
    return wx >= tx - 74*s && wx <= tx + 74*s && wy >= ty - 94*s && wy <= ty + 10*s;
  }

  containsFridge(wx, wy) {
    const fx = INTERIOR_W * 0.34, fy = 500, s = interiorDepthScale(fy);
    return wx >= fx - 40*s && wx <= fx + 40*s && wy >= fy - 136*s && wy <= fy + 16*s;
  }

  containsKitchen(wx, wy) {
    const kx = INTERIOR_W * 0.22, ky = 480, s = interiorDepthScale(ky);
    return wx >= kx - 92*s && wx <= kx + 92*s && wy >= ky - 48*s && wy <= ky + 8*s;
  }

  // Seat positions for character sitting detection
  getSeats() {
    const W = INTERIOR_W, cx = W / 2;
    return [
      { x: cx,           y: 310 },  // sofa
      { x: W*0.75 - 58,  y: 448 },  // dining chair back-left
      { x: W*0.75 + 58,  y: 448 },  // dining chair back-right
      { x: W*0.75 - 58,  y: 552 },  // dining chair front-left
      { x: W*0.75 + 58,  y: 552 },  // dining chair front-right
    ];
  }

  getBeds() {
    return [{ x: INTERIOR_W - 140, y: 250 }];
  }

  destroy() { this._bg = null; this._objects = []; }
}
