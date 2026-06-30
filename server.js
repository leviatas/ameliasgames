const express = require('express');
const path = require('path');
const { logVisit, listVisits } = require('./visits-db');

const app = express();
const PORT = process.env.PORT || 3000;
const VISITS_PASSWORD = 'Labubu';

// Trust the cloudflared/reverse-proxy headers so req.ip is the real visitor IP
app.set('trust proxy', true);

app.use(express.json());

// Serve assets without caching so every deploy is picked up immediately
app.use(express.static(path.join(__dirname, 'public'), {
  index: false,
  etag: false,
  lastModified: false,
  setHeaders: (res) => res.setHeader('Cache-Control', 'no-store, must-revalidate'),
}));
app.use('/three', express.static(path.join(__dirname, 'node_modules/three')));

app.get('/', (req, res) => {
  // Skip Docker's own healthcheck pings so they don't pollute the visit log
  if (!/wget/i.test(req.headers['user-agent'] || '')) {
    logVisit(req);
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/visits', (req, res) => {
  if (req.body?.password !== VISITS_PASSWORD) {
    return res.status(401).json({ error: 'Contraseña incorrecta' });
  }
  res.json(listVisits(100));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Avatar World running at http://0.0.0.0:${PORT}`);
});
