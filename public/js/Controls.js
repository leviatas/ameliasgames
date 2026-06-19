export class Controls {
  constructor() {
    this.keys = {};
    this.cameraYaw = 0; // radians, camera rotation around Y axis

    this._onKeyDown = (e) => {
      this.keys[e.code] = true;
      // Prevent arrow keys from scrolling
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    };
    this._onKeyUp = (e) => { this.keys[e.code] = false; };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  get moveForward() { return !!(this.keys['KeyW'] || this.keys['ArrowUp']); }
  get moveBackward() { return !!(this.keys['KeyS'] || this.keys['ArrowDown']); }
  get moveLeft() { return !!(this.keys['KeyA'] || this.keys['ArrowLeft']); }
  get moveRight() { return !!(this.keys['KeyD'] || this.keys['ArrowRight']); }
  get rotateLeft() { return !!(this.keys['KeyQ']); }
  get rotateRight() { return !!(this.keys['KeyE']); }
  get sprint() { return !!(this.keys['ShiftLeft'] || this.keys['ShiftRight']); }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }
}
