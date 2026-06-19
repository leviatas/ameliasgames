const TOUCH_RADIUS  = 100;
const JOYSTICK_MAX  = 110;
const DEAD_ZONE     = 10;

export class TouchControls {
  constructor(canvas) {
    this.canvas = canvas;

    this.charScreenX = window.innerWidth  / 2;
    this.charScreenY = window.innerHeight / 2;

    // Joystick
    this.moveActive    = false;
    this.moveTouchId   = null;
    this.originX       = 0;
    this.originY       = 0;
    this.screenDx      = 0;
    this.screenDy      = 0;
    this.moveIntensity = 0;

    // Pinch zoom
    this._touchCache = new Map();   // id → {x, y}
    this._pinchIds   = null;        // [id1, id2] when pinching
    this._pinchDist  = 0;
    this._onZoom     = null;        // callback(scaleFactor)

    this._ui = this._buildUI();

    const opts = { passive: false };
    this._onStart  = this._touchStart.bind(this);
    this._onMove   = this._touchMove.bind(this);
    this._onEnd    = this._touchEnd.bind(this);

    canvas.addEventListener('touchstart',  this._onStart, opts);
    canvas.addEventListener('touchmove',   this._onMove,  opts);
    canvas.addEventListener('touchend',    this._onEnd,   opts);
    canvas.addEventListener('touchcancel', this._onEnd,   opts);
  }

  onZoom(cb) { this._onZoom = cb; }

  updateCharScreenPos(sx, sy) {
    this.charScreenX = sx;
    this.charScreenY = sy;
  }

  get isMoving() { return this.moveActive && this.moveIntensity > 0; }

  // ── Touch handlers ─────────────────────────────────────────────────

  _touchStart(e) {
    e.preventDefault();

    for (const t of e.changedTouches) {
      this._touchCache.set(t.identifier, { x: t.clientX, y: t.clientY });
    }

    // If we now have 2 fingers → start pinch, cancel joystick
    if (this._touchCache.size >= 2 && !this._pinchIds) {
      const ids = [...this._touchCache.keys()].slice(0, 2);
      this._pinchIds = ids;
      const a = this._touchCache.get(ids[0]);
      const b = this._touchCache.get(ids[1]);
      this._pinchDist = Math.hypot(b.x - a.x, b.y - a.y);

      if (this.moveActive) {
        this.moveActive    = false;
        this.moveTouchId   = null;
        this.screenDx      = 0;
        this.screenDy      = 0;
        this.moveIntensity = 0;
        this._hideJoystick();
      }
      return;
    }

    // Single touch → try joystick
    for (const t of e.changedTouches) {
      if (!this.moveActive && !this._pinchIds) {
        const dx = t.clientX - this.charScreenX;
        const dy = t.clientY - this.charScreenY;
        if (Math.hypot(dx, dy) < TOUCH_RADIUS) {
          this.moveActive    = true;
          this.moveTouchId   = t.identifier;
          this.originX       = this.charScreenX;
          this.originY       = this.charScreenY;
          this.screenDx      = 0;
          this.screenDy      = 0;
          this.moveIntensity = 0;
          this._showJoystick(this.originX, this.originY);
        }
      }
    }
  }

  _touchMove(e) {
    e.preventDefault();

    // Update cache
    for (const t of e.changedTouches) {
      if (this._touchCache.has(t.identifier)) {
        this._touchCache.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
    }

    // Pinch
    if (this._pinchIds) {
      const a = this._touchCache.get(this._pinchIds[0]);
      const b = this._touchCache.get(this._pinchIds[1]);
      if (a && b) {
        const newDist = Math.hypot(b.x - a.x, b.y - a.y);
        if (this._pinchDist > 5) {
          this._onZoom && this._onZoom(newDist / this._pinchDist);
        }
        this._pinchDist = newDist;
      }
      return;
    }

    // Joystick
    for (const t of e.changedTouches) {
      if (this.moveActive && t.identifier === this.moveTouchId) {
        const dx   = t.clientX - this.originX;
        const dy   = t.clientY - this.originY;
        const dist = Math.hypot(dx, dy);
        if (dist > DEAD_ZONE) {
          const clamped      = Math.min(dist, JOYSTICK_MAX);
          this.screenDx      = dx / dist;
          this.screenDy      = dy / dist;
          this.moveIntensity = clamped / JOYSTICK_MAX;
          this._moveDot(
            this.originX + this.screenDx * clamped,
            this.originY + this.screenDy * clamped
          );
        } else {
          this.screenDx = this.screenDy = this.moveIntensity = 0;
          this._moveDot(this.originX, this.originY);
        }
      }
    }
  }

  _touchEnd(e) {
    for (const t of e.changedTouches) {
      this._touchCache.delete(t.identifier);

      if (this._pinchIds && this._pinchIds.includes(t.identifier)) {
        this._pinchIds  = null;
        this._pinchDist = 0;
      }

      if (t.identifier === this.moveTouchId) {
        this.moveActive    = false;
        this.moveTouchId   = null;
        this.screenDx      = 0;
        this.screenDy      = 0;
        this.moveIntensity = 0;
        this._hideJoystick();
      }
    }
  }

  // ── Joystick UI ────────────────────────────────────────────────────

  _buildUI() {
    const SIZE = JOYSTICK_MAX * 2 + 8, DOT = 52;
    const wrap = document.createElement('div');
    wrap.id = 'touch-joystick';
    wrap.style.cssText = 'position:fixed;pointer-events:none;z-index:20;display:none;';

    const ring = document.createElement('div');
    ring.style.cssText = `
      position:absolute;width:${SIZE}px;height:${SIZE}px;border-radius:50%;
      border:2px solid rgba(255,255,255,0.30);background:rgba(255,255,255,0.06);
      backdrop-filter:blur(3px);transform:translate(-50%,-50%);`;

    const dot = document.createElement('div');
    dot.style.cssText = `
      position:absolute;width:${DOT}px;height:${DOT}px;border-radius:50%;
      background:rgba(255,255,255,0.45);border:2.5px solid rgba(255,255,255,0.85);
      transform:translate(-50%,-50%);box-shadow:0 2px 12px rgba(0,0,0,0.4);`;

    wrap.appendChild(ring);
    wrap.appendChild(dot);
    document.body.appendChild(wrap);
    return { wrap, ring, dot };
  }

  _showJoystick(x, y) {
    this._ui.wrap.style.display = 'block';
    this._ui.ring.style.left = `${x}px`;
    this._ui.ring.style.top  = `${y}px`;
    this._ui.dot.style.left  = `${x}px`;
    this._ui.dot.style.top   = `${y}px`;
  }
  _moveDot(x, y) {
    this._ui.dot.style.left = `${x}px`;
    this._ui.dot.style.top  = `${y}px`;
  }
  _hideJoystick() { this._ui.wrap.style.display = 'none'; }

  destroy() {
    this.canvas.removeEventListener('touchstart',  this._onStart);
    this.canvas.removeEventListener('touchmove',   this._onMove);
    this.canvas.removeEventListener('touchend',    this._onEnd);
    this.canvas.removeEventListener('touchcancel', this._onEnd);
    this._ui.wrap.remove();
  }
}
