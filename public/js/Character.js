// ── Colour helpers ──────────────────────────────────────────────────────────
function _lc(hex, amt) {
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return `rgb(${Math.min(255,Math.round(r+(255-r)*amt))},${Math.min(255,Math.round(g+(255-g)*amt))},${Math.min(255,Math.round(b+(255-b)*amt))})`;
}
function _dc(hex, amt) {
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return `rgb(${Math.max(0,Math.round(r*(1-amt)))},${Math.max(0,Math.round(g*(1-amt)))},${Math.max(0,Math.round(b*(1-amt)))})`;
}
const OC   = 'rgba(25,12,5,0.78)';
const BROW = '#3A2418';

// ── Sprites ──────────────────────────────────────────────────────────────────
let SPRITE     = null;   // standing
let SPRITE_SIT = null;   // sitting
let SPRITE_LIE = null;   // lying
let SPRITE_READY = false;
let ANCH = null;
const _readyCbs = [];
export function onSpriteReady(cb) { SPRITE_READY ? cb() : _readyCbs.push(cb); }

function loadTrimmed(src, onDone) {
  const img = new Image();
  img.onload = () => {
    const TW = 320, TH = Math.round(img.naturalHeight * TW / img.naturalWidth);
    const cv = document.createElement('canvas'); cv.width = TW; cv.height = TH;
    const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0, TW, TH);
    const im = cx.getImageData(0, 0, TW, TH); const d = im.data;
    let minx=TW,miny=TH,maxx=0,maxy=0;
    for (let p=0;p<TW*TH;p++){ if(d[p*4+3]>10){ const px=p%TW,py=(p/TW)|0; if(px<minx)minx=px;if(px>maxx)maxx=px;if(py<miny)miny=py;if(py>maxy)maxy=py; } }
    const w=maxx-minx+1, h=maxy-miny+1;
    const sc=document.createElement('canvas'); sc.width=w; sc.height=h;
    sc.getContext('2d').drawImage(cv, minx,miny,w,h, 0,0,w,h);
    onDone(sc);
  };
  img.src = src;
}

let _loaded = 0;
function _onLoad() { if (++_loaded === 3) { SPRITE_READY = true; _readyCbs.splice(0).forEach(c => c()); } }

// ── Outfit sprite cache (trimmed like base sprites) ───────────────────────────
const _outfitCache = {};
function _loadOutfit(url) {
  if (!url || url in _outfitCache) return;
  _outfitCache[url] = null; // mark as loading
  loadTrimmed(url, sc => { _outfitCache[url] = sc; });
}
function _outfitReady(url) { return !!(url && _outfitCache[url] && _outfitCache[url].width > 0); }


loadTrimmed('/assets/chibi_sprite.png', sc => { SPRITE = sc; ANCH = { w: sc.width, h: sc.height, headCxF: 0.50, neckF: 0.35, headRxF: 0.21, shoulderHalfF: 0.21, hipYF: 0.63, hipHalfF: 0.17 }; _onLoad(); });
loadTrimmed('/assets/chibi_sit.png',    sc => { SPRITE_SIT = sc; _onLoad(); });
loadTrimmed('/assets/chibi_lie.png',    sc => { SPRITE_LIE = sc; _onLoad(); });

export { SPRITE };

// ── Default look ────────────────────────────────────────────────────────────
export const DEFAULT_CFG = {
  hair: 'buns', hairColor: '#EDEDED',
  eyes: 'round', eyeColor: '#3A6EA5',
  accessory: 'none',
};

export class Character {
  constructor(startX, startY, cfg) {
    this.x = startX; this.y = startY;
    this.cfg = Object.assign({}, DEFAULT_CFG, cfg || {});
    if (this.cfg.outfitSprite) _loadOutfit(this.cfg.outfitSprite);
    this.isMoving = false; this.facingDir = 1;
    this.bobTime = 0; this.bobOffset = 0; this.walkPhase = 0;
    this.speed = 260; this.sprintSpeed = 520;
    this.state = 'walk';
    this.animTime = 0; this.poseT = 0;
    this.gesture = null; this.gestureTime = 0; this.gestureDur = 0;
  }

  update(delta) {
    this.animTime += delta;
    if (this.isMoving && this.state === 'walk') {
      this.bobTime += delta*10; this.bobOffset = Math.sin(this.bobTime)*5; this.walkPhase = this.bobTime;
    } else {
      this.bobOffset *= 0.75; if (Math.abs(this.bobOffset)<0.1) this.bobOffset=0;
    }
    const pt = (this.state==='sit'||this.state==='lie')?1:0;
    this.poseT += (pt-this.poseT)*Math.min(delta*7,1);
    if (Math.abs(this.poseT-pt)<0.01) this.poseT=pt;
    if (this.gesture){ this.gestureTime+=delta; if (this.gestureTime>this.gestureDur){ this.gesture=null; this.gestureTime=0; } }
  }

  playGesture(name){ if (this.state==='lie') return; this.gesture=name; this.gestureTime=0; this.gestureDur = name==='wave'?2.5: name==='dance'?6: name==='jump'?1.1: 4.5; }

  draw(ctx, cam, depthScaleFn) {
    const sx=this.x-cam.x, sy=this.y-cam.y, s=depthScaleFn(this.y);
    const isSit = this.state==='sit', isLie = this.state==='lie';

    const H = 152*s;
    let ox=0, oy=0, rot=0, scaleY=1, shadowScale=1;
    const walking = this.isMoving && this.state==='walk';
    if (walking){ oy+=this.bobOffset*s; rot+=Math.sin(this.walkPhase)*0.05; }
    if (this.gesture==='sing')        { oy+=Math.sin(this.animTime*7)*2.5*s; }
    else if (this.gesture==='dance')  { oy+=Math.abs(Math.sin(this.animTime*8))*4*s; ox+=Math.sin(this.animTime*4)*9*s; rot+=Math.sin(this.animTime*8)*0.07; }
    else if (this.gesture==='wave')   { rot+=Math.sin(this.animTime*9)*0.12; }
    else if (this.gesture==='jump') {
      const t = Math.min(this.gestureTime / this.gestureDur, 1);
      if (t < 0.13) {
        // Crouch
        const p = t / 0.13;
        oy += 12 * p * s; scaleY = 1 - 0.18*p;
      } else if (t < 0.87) {
        // Air: parabolic arc
        const p = (t - 0.13) / 0.74;
        const arc = Math.sin(p * Math.PI);
        oy -= 80 * arc * s;
        scaleY = 1 + 0.14 * arc;
        rot += Math.sin(p * Math.PI * 2) * 0.08;
        shadowScale = 1 - 0.5 * arc;   // shadow shrinks while airborne
      } else {
        // Land squash
        const p = (t - 0.87) / 0.13;
        oy += 12 * (1-p) * s; scaleY = 0.82 + 0.18*p;
      }
    }

    // Shadow (skip for lie/sit where shadow is handled differently)
    if (!isLie && !isSit) {
      ctx.save(); ctx.globalAlpha=0.22*shadowScale; ctx.fillStyle='#000';
      ctx.beginPath(); ctx.ellipse(sx+ox, sy, 22*s*shadowScale, 6*s*shadowScale, 0,0,Math.PI*2); ctx.fill(); ctx.restore();
    } else {
      ctx.save(); ctx.globalAlpha=0.22; ctx.fillStyle='#000';
      ctx.beginPath(); ctx.ellipse(sx, sy, (isLie?52:32)*s, 6*s, 0,0,Math.PI*2); ctx.fill(); ctx.restore();
    }

    if (!SPRITE_READY || !SPRITE) return;

    ctx.save();
    ctx.translate(sx,sy); ctx.translate(ox,oy); ctx.rotate(rot);
    if (this.facingDir<0) ctx.scale(-1,1);
    ctx.scale(1, scaleY);
    this._paint(ctx, H);
    ctx.restore();

    if (this.gesture==='sing'||this.gesture==='dance') this._drawNotes(ctx, sx+ox, sy+oy-H+10*s, s);
    if (this.state==='lie') this._drawZzz(ctx, sx, sy, H, s);
  }

  drawPreview(ctx, cx, cyFeet, scale) {
    if (!SPRITE_READY || !SPRITE) return;
    const H = 132*scale;
    ctx.save(); ctx.translate(cx, cyFeet);
    this._paint(ctx, H);
    ctx.restore();
  }

  // ── Draw chibi sprite (feet at origin) ─────────────────────────────────────
  _paint(ctx, H) {
    const oUrl = this.cfg.outfitSprite;
    if (oUrl && this.state !== 'sit' && this.state !== 'lie') {
      _loadOutfit(oUrl);
      if (_outfitReady(oUrl)) {
        const sc = _outfitCache[oUrl];
        const Wd = sc.width * (H / sc.height);
        ctx.drawImage(sc, -Wd/2, -H, Wd, H);
        return;
      }
    }
    const sp = (this.state==='sit' && SPRITE_SIT) ? SPRITE_SIT
             : (this.state==='lie' && SPRITE_LIE) ? SPRITE_LIE
             : SPRITE;
    if (!sp) return;
    const Wd = sp.width*(H/sp.height);
    ctx.drawImage(sp, -Wd/2, -H, Wd, H);
  }

  // ── Face — FIXED eyes (brown, like the reference) ──────────────────────────
  _drawFace(ctx, G) {
    const { hx, eyeY, eyeDX, headRx, headRy, headCy, u } = G;
    const eR   = headRx*0.27;          // big, cute eyes
    const iris = '#7A4B2A';
    ctx.lineCap = 'round';
    for (const sgn of [-1,1]) {
      const ex = hx + sgn*eyeDX;
      // soft thick brow
      ctx.strokeStyle = '#7A4A2C'; ctx.lineWidth = 3.3*u;
      ctx.beginPath(); ctx.arc(ex, eyeY-eR*1.5, eR*0.95, Math.PI*1.12, Math.PI*1.92); ctx.stroke();
      // white
      ctx.fillStyle='#fff'; ctx.strokeStyle=OC; ctx.lineWidth=1.6*u;
      ctx.beginPath(); ctx.ellipse(ex, eyeY, eR, eR*1.12, 0,0,Math.PI*2); ctx.fill(); ctx.stroke();
      // iris (large brown)
      const ig=ctx.createRadialGradient(ex-eR*0.3,eyeY-eR*0.4,eR*0.2, ex,eyeY+eR*0.1,eR*0.95);
      ig.addColorStop(0,_lc(iris,0.45)); ig.addColorStop(0.5,iris); ig.addColorStop(1,_dc(iris,0.45));
      ctx.fillStyle=ig;
      ctx.beginPath(); ctx.ellipse(ex, eyeY+eR*0.08, eR*0.82, eR*0.95, 0,0,Math.PI*2); ctx.fill();
      // pupil
      ctx.fillStyle='#2A1608';
      ctx.beginPath(); ctx.ellipse(ex, eyeY+eR*0.1, eR*0.4, eR*0.5, 0,0,Math.PI*2); ctx.fill();
      // highlights
      ctx.fillStyle='rgba(255,255,255,0.95)';
      ctx.beginPath(); ctx.arc(ex-eR*0.32, eyeY-eR*0.4, eR*0.34, 0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.6)';
      ctx.beginPath(); ctx.arc(ex+eR*0.3, eyeY+eR*0.45, eR*0.16, 0,Math.PI*2); ctx.fill();
      // upper lash
      ctx.strokeStyle=BROW; ctx.lineWidth=2.2*u;
      ctx.beginPath(); ctx.arc(ex, eyeY, eR*1.1, Math.PI+0.35, -0.35); ctx.stroke();
    }
    // small smile
    ctx.strokeStyle='#B5536A'; ctx.lineWidth=2.4*u;
    ctx.beginPath(); ctx.arc(hx, headCy+headRy*0.42, headRx*0.18, 0.18, Math.PI-0.18); ctx.stroke();
    // blush
    ctx.fillStyle='rgba(255,130,120,0.28)';
    ctx.beginPath(); ctx.ellipse(hx-eyeDX*1.2, eyeY+eR*1.2, eR*0.95, eR*0.6, 0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(hx+eyeDX*1.2, eyeY+eR*1.2, eR*0.95, eR*0.6, 0,0,Math.PI*2); ctx.fill();
  }

  // ── Hair (behind) ──────────────────────────────────────────────────────────
  _drawBackHair(ctx, G) {
    const { hx, headCy, headRx, headRy, neckY, hipY, u } = G;
    const cfg=this.cfg; if (cfg.hair!=='largo'&&cfg.hair!=='coleta') return;
    const hC=cfg.hairColor, ow=Math.max(1,1.5*u);
    ctx.strokeStyle=OC; ctx.lineWidth=ow;
    const g=ctx.createLinearGradient(hx-headRx, headCy, hx+headRx, hipY);
    g.addColorStop(0,_lc(hC,0.18)); g.addColorStop(0.5,hC); g.addColorStop(1,_dc(hC,0.2));
    ctx.fillStyle=g;
    const bottom = cfg.hair==='largo' ? hipY+(neckY-headCy)*0.2 : neckY+(hipY-neckY)*0.5;
    const halfW = headRx*1.15;
    ctx.beginPath();
    ctx.moveTo(hx-headRx*0.5, headCy-headRy*0.4);
    ctx.quadraticCurveTo(hx-halfW, headCy, hx-halfW, headCy+headRy*0.6);
    ctx.quadraticCurveTo(hx-halfW, bottom-10*u, hx-halfW*0.7, bottom);
    ctx.quadraticCurveTo(hx, bottom+8*u, hx+halfW*0.7, bottom);
    ctx.quadraticCurveTo(hx+halfW, bottom-10*u, hx+halfW, headCy+headRy*0.6);
    ctx.quadraticCurveTo(hx+halfW, headCy, hx+headRx*0.5, headCy-headRy*0.4);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  // ── Hair (front: cap + style) ──────────────────────────────────────────────
  _drawFrontHair(ctx, G) {
    const { hx, headTopY, headCy, headRx, headRy, u } = G;
    const cfg=this.cfg, hC=cfg.hairColor, ow=Math.max(1,1.5*u);
    const hL=_lc(hC,0.28), hD=_dc(hC,0.16);
    ctx.strokeStyle=OC; ctx.lineWidth=ow; ctx.lineJoin='round';
    const cap=ctx.createLinearGradient(hx-headRx, headTopY, hx+headRx, headCy);
    cap.addColorStop(0,hL); cap.addColorStop(0.5,hC); cap.addColorStop(1,hD);

    // Crown cap with fringe across the forehead
    const browY = headCy - headRy*0.05;
    ctx.fillStyle=cap;
    ctx.beginPath();
    ctx.moveTo(hx-headRx*1.02, headCy);
    ctx.quadraticCurveTo(hx-headRx*1.05, headTopY+headRy*0.2, hx-headRx*0.4, headTopY-2*u);
    ctx.quadraticCurveTo(hx, headTopY-6*u, hx+headRx*0.4, headTopY-2*u);
    ctx.quadraticCurveTo(hx+headRx*1.05, headTopY+headRy*0.2, hx+headRx*1.02, headCy);
    // fringe (zigzag) back across forehead
    ctx.quadraticCurveTo(hx+headRx*0.7, browY+8*u, hx+headRx*0.4, browY);
    ctx.quadraticCurveTo(hx+headRx*0.18, browY+9*u, hx, browY);
    ctx.quadraticCurveTo(hx-headRx*0.18, browY+9*u, hx-headRx*0.4, browY);
    ctx.quadraticCurveTo(hx-headRx*0.7, browY+8*u, hx-headRx*1.02, headCy);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    if (cfg.hair==='buns') {
      const fluff=(bx,by,Rr)=>{
        const fg=ctx.createRadialGradient(bx-Rr*0.35,by-Rr*0.35,Rr*0.2,bx,by,Rr);
        fg.addColorStop(0,_lc(hC,0.42)); fg.addColorStop(1,hC);
        ctx.fillStyle=fg; ctx.strokeStyle=OC; ctx.lineWidth=ow;
        ctx.beginPath(); ctx.arc(bx,by,Rr,0,Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.lineWidth=ow*0.8;
        for(let i=0;i<7;i++){const a=i/7*Math.PI*2;const px=bx+Math.cos(a)*Rr*0.6,py=by+Math.sin(a)*Rr*0.6;ctx.beginPath();ctx.arc(px,py,Rr*0.36,0,Math.PI*2);ctx.fill();ctx.stroke();}
        ctx.strokeStyle='rgba(0,0,0,0.16)';ctx.beginPath();ctx.arc(bx,by,Rr*0.32,0.2,Math.PI*1.6);ctx.stroke();ctx.strokeStyle=OC;ctx.lineWidth=ow;
      };
      const Rr=headRx*0.42;
      fluff(hx-headRx*0.62, headTopY+headRy*0.12, Rr);
      fluff(hx+headRx*0.62, headTopY+headRy*0.12, Rr);
    } else if (cfg.hair==='corto') {
      for (const sgn of [-1,1]){ ctx.fillStyle=cap; ctx.beginPath(); ctx.ellipse(hx+sgn*headRx*0.92, headCy+headRy*0.1, headRx*0.18, headRy*0.32, sgn*-0.2,0,Math.PI*2); ctx.fill(); ctx.stroke(); }
    } else { // largo / coleta : front side locks
      const endY = headCy + headRy*(cfg.hair==='largo'?1.4:0.8);
      for (const sgn of [-1,1]){
        ctx.fillStyle=cap;
        ctx.beginPath();
        ctx.moveTo(hx+sgn*headRx*0.96, headCy-headRy*0.3);
        ctx.quadraticCurveTo(hx+sgn*headRx*1.15, (headCy+endY)/2, hx+sgn*headRx*0.85, endY);
        ctx.quadraticCurveTo(hx+sgn*headRx*0.62, (headCy+endY)/2, hx+sgn*headRx*0.6, headCy);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      if (cfg.hair==='coleta') { // side ponytail tie
        ctx.fillStyle='#E08CB0'; ctx.beginPath(); ctx.arc(hx+headRx*0.9, headCy-headRy*0.1, headRx*0.12, 0,Math.PI*2); ctx.fill(); ctx.stroke();
      }
    }
    // gloss
    ctx.fillStyle='rgba(255,255,255,0.16)';
    ctx.beginPath(); ctx.ellipse(hx-headRx*0.4, headTopY+headRy*0.4, headRx*0.3, headRy*0.18, -0.5,0,Math.PI*2); ctx.fill();
  }

  // ── Accessory ────────────────────────────────────────────────────────────
  _drawAccessory(ctx, G) {
    const { hx, headTopY, headCy, headRx, headRy, eyeY, eyeDX, u } = G;
    const a=this.cfg.accessory, ow=Math.max(1,1.5*u);
    ctx.strokeStyle=OC; ctx.lineWidth=ow; ctx.lineJoin='round';
    if (a==='moño') {
      const bx=hx-headRx*0.55, by=headTopY+headRy*0.05, r=headRx*0.3;
      ctx.fillStyle='#E84B7A';
      ctx.beginPath(); ctx.moveTo(bx,by); ctx.lineTo(bx-r,by-r*0.7); ctx.lineTo(bx-r,by+r*0.7); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx,by); ctx.lineTo(bx+r,by-r*0.7); ctx.lineTo(bx+r,by+r*0.7); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(bx,by,r*0.34,0,Math.PI*2); ctx.fill(); ctx.stroke();
    } else if (a==='lentes') {
      ctx.strokeStyle='#222'; ctx.lineWidth=2.4*u; ctx.fillStyle='rgba(150,200,255,0.25)';
      for (const sgn of [-1,1]){ ctx.beginPath(); ctx.ellipse(hx+sgn*eyeDX, eyeY, headRx*0.26, headRx*0.24, 0,0,Math.PI*2); ctx.fill(); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(hx-eyeDX*0.4, eyeY); ctx.lineTo(hx+eyeDX*0.4, eyeY); ctx.stroke();
    } else if (a==='corona') {
      const cw=headRx*0.9, cy=headTopY+headRy*0.02;
      ctx.fillStyle='#FFD33A';
      ctx.beginPath();
      ctx.moveTo(hx-cw, cy);
      ctx.lineTo(hx-cw, cy-headRy*0.3); ctx.lineTo(hx-cw*0.5, cy-headRy*0.05);
      ctx.lineTo(hx, cy-headRy*0.4); ctx.lineTo(hx+cw*0.5, cy-headRy*0.05);
      ctx.lineTo(hx+cw, cy-headRy*0.3); ctx.lineTo(hx+cw, cy);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#E8403A';
      for (const f of [-0.55,0,0.55]){ ctx.beginPath(); ctx.arc(hx+f*cw, cy-headRy*0.02, headRx*0.07,0,Math.PI*2); ctx.fill(); }
    }
  }

  _drawZzz(ctx, cx, cy, H, s) {
    ctx.save(); ctx.textAlign='center';
    // 3 Z's staggered in time, each floats up and fades
    for (let i=0;i<3;i++){
      const period = 2.2;
      const ph = ((this.animTime * 0.5 + i * (period/3)) % period) / period; // 0..1
      const size = (22 + i*8) * s;
      const nx = cx + (22 + i*14) * s;
      const ny = cy - H * 0.85 - ph * 55 * s;
      ctx.globalAlpha = (1 - ph) * 0.95;
      ctx.fillStyle = '#222222';
      ctx.font = `bold ${size}px sans-serif`;
      ctx.fillText('z', nx, ny);
    }
    ctx.globalAlpha = 1; ctx.restore();
  }

  _drawNotes(ctx, cx, headY, s) {
    const glyph=['♪','♫','♬'], cols=['#FF66AA','#66CCFF','#FFCC44'];
    const intro=Math.min(1,this.gestureTime*2);
    ctx.save(); ctx.textAlign='center';
    for (let i=0;i<4;i++){
      const ph=(this.gestureTime*0.65+i*0.27)%1, side=i%2?1:-1;
      const nx=cx+side*(16+ph*26)*s, ny=headY-ph*46*s+Math.sin(ph*6.28)*3*s;
      ctx.globalAlpha=intro*(1-ph)*0.95; ctx.fillStyle=cols[i%3];
      ctx.font=`bold ${(11+(i%3)*3)*s}px sans-serif`; ctx.fillText(glyph[i%3],nx,ny);
    }
    ctx.globalAlpha=1; ctx.restore();
  }

  destroy() {}
}
