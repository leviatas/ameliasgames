const { WebSocketServer } = require('ws');

// Bare relay for 2-player online matches: pairs a "host" and a "guest" under
// a short room code, then blindly forwards whatever they send each other.
// No game logic lives here — the host client simulates the match and the
// server just shuttles messages between the two sockets in a room.

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L (ambiguous)
const CODE_LEN = 4;
const ROOM_TTL_MS = 10 * 60 * 1000; // unclaimed rooms expire after 10 min

function genCode() {
  let code = '';
  for (let i = 0; i < CODE_LEN; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

function attachNetRelay(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws/duo' });
  /** @type {Map<string, { gameId: string, host: WebSocket, guest: WebSocket|null, timer: NodeJS.Timeout }>} */
  const rooms = new Map();

  function send(ws, msg) {
    if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  }

  function closeRoom(code) {
    const room = rooms.get(code);
    if (!room) return;
    clearTimeout(room.timer);
    rooms.delete(code);
  }

  function peerOf(room, ws) {
    return room.host === ws ? room.guest : room.host;
  }

  wss.on('connection', ws => {
    ws._room = null;

    ws.on('message', raw => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      if (msg.type === 'create') {
        let code;
        do { code = genCode(); } while (rooms.has(code));
        const timer = setTimeout(() => closeRoom(code), ROOM_TTL_MS);
        rooms.set(code, { gameId: msg.gameId, host: ws, guest: null, timer });
        ws._room = code;
        send(ws, { type: 'created', code });
        return;
      }

      if (msg.type === 'join') {
        const room = rooms.get(msg.code);
        if (!room) { send(ws, { type: 'join-error', reason: 'not-found' }); return; }
        if (room.guest) { send(ws, { type: 'join-error', reason: 'full' }); return; }
        if (room.gameId !== msg.gameId) { send(ws, { type: 'join-error', reason: 'game-mismatch' }); return; }
        clearTimeout(room.timer);
        room.guest = ws;
        ws._room = msg.code;
        send(room.host, { type: 'ready', role: 'host' });
        send(room.guest, { type: 'ready', role: 'guest' });
        return;
      }

      if (msg.type === 'relay') {
        const room = rooms.get(ws._room);
        if (!room) return;
        send(peerOf(room, ws), { type: 'relay', data: msg.data });
        return;
      }

      if (msg.type === 'leave') {
        const room = rooms.get(ws._room);
        if (room) { send(peerOf(room, ws), { type: 'peer-left' }); closeRoom(ws._room); }
        ws._room = null;
      }
    });

    ws.on('close', () => {
      const room = rooms.get(ws._room);
      if (room) { send(peerOf(room, ws), { type: 'peer-left' }); closeRoom(ws._room); }
    });
  });

  return wss;
}

module.exports = { attachNetRelay };
