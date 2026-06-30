const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'visits.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT,
    device TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  )
`);

const insertStmt = db.prepare(
  'INSERT INTO visits (ip, device, user_agent) VALUES (?, ?, ?)'
);

function detectDevice(userAgent = '') {
  if (/ipad|tablet/i.test(userAgent)) return 'tablet';
  if (/mobi|android|iphone/i.test(userAgent)) return 'mobile';
  return 'desktop';
}

function logVisit(req) {
  const userAgent = req.headers['user-agent'] || '';
  insertStmt.run(req.ip, detectDevice(userAgent), userAgent);
}

function listVisits(limit = 50) {
  return db
    .prepare('SELECT * FROM visits ORDER BY id DESC LIMIT ?')
    .all(limit);
}

module.exports = { logVisit, listVisits };
