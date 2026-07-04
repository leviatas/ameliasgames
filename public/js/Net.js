// Thin client for the /ws/duo relay: pairs two browsers under a short room
// code, then lets them exchange arbitrary JSON payloads (inputs, state
// snapshots) via send()/onMessage. No game logic here.

export class NetSession {
  constructor(gameId) {
    this.gameId = gameId;
    this.ws = null;
    this.role = null;      // 'host' | 'guest'
    this.code = null;
    this.onCode = null;    // (code) => void          — host got its room code
    this.onReady = null;   // (role) => void           — both peers paired, go!
    this.onMessage = null; // (data) => void           — payload from peer
    this.onPeerLeft = null;
    this.onError = null;   // (reason) => void
    this._closing = false; // true once we initiated our own close — suppress onPeerLeft for it
  }

  _connect() {
    return new Promise((resolve, reject) => {
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${location.host}/ws/duo`);
      this.ws = ws;
      ws.addEventListener('open', () => resolve(ws));
      ws.addEventListener('error', () => reject(new Error('connect-failed')));
      // Only a self-initiated close skips onPeerLeft; an unexpected drop
      // (our own network dying, or the peer's socket closing — which the
      // server also reports via an explicit 'peer-left' message) should
      // still surface as a disconnect.
      ws.addEventListener('close', () => { if (!this._closing && this.onPeerLeft) this.onPeerLeft(); });
      ws.addEventListener('message', ev => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch { return; }
        if (msg.type === 'created') { this.code = msg.code; if (this.onCode) this.onCode(msg.code); }
        else if (msg.type === 'ready') { this.role = msg.role; if (this.onReady) this.onReady(msg.role); }
        else if (msg.type === 'relay') { if (this.onMessage) this.onMessage(msg.data); }
        else if (msg.type === 'peer-left') { if (this.onPeerLeft) this.onPeerLeft(); }
        else if (msg.type === 'join-error') { if (this.onError) this.onError(msg.reason); }
      });
    });
  }

  async createRoom() {
    await this._connect();
    this.ws.send(JSON.stringify({ type: 'create', gameId: this.gameId }));
  }

  async joinRoom(code) {
    await this._connect();
    this.ws.send(JSON.stringify({ type: 'join', gameId: this.gameId, code: code.toUpperCase() }));
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'relay', data }));
    }
  }

  close() {
    if (this.ws) {
      this._closing = true;
      try { this.ws.send(JSON.stringify({ type: 'leave' })); } catch { /* already closed */ }
      this.ws.close();
      this.ws = null;
    }
  }
}
