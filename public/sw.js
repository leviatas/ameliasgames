const CACHE = 'avatarworld-v5';
const SHELL = [
  '/', '/js/game.js', '/js/Character.js', '/js/World.js', '/js/Interior.js',
  '/js/Runner.js', '/js/Cocina.js', '/js/Match3.js', '/js/Hole.js', '/js/Cinema.js',
  '/js/Helado.js', '/js/Sound.js', '/js/Controls.js', '/js/TouchControls.js', '/js/Pantry.js',
  '/css/style.css', '/manifest.json',
  '/assets/chibi_sprite.png', '/assets/chibi_sit.png', '/assets/chibi_lie.png',
  '/assets/chibi_main.png', '/icons/icon-192.png', '/icons/icon-512.png',
  '/assets/icecream/scoop_frutilla.png', '/assets/icecream/scoop_vainilla.png',
  '/assets/icecream/scoop_chocolate.png', '/assets/icecream/scoop_menta.png',
  '/assets/icecream/scoop_arandano.png', '/assets/icecream/scoop_naranja.png',
  '/assets/icecream/cone.png', '/assets/icecream/cherries.png',
  '/assets/icecream/sprinkles.png', '/assets/icecream/syrup.png',
  '/assets/icecream/wafersticks.png', '/assets/icecream/marshmallow.png',
  '/assets/icecream/customer1.png', '/assets/icecream/customer2.png',
  '/assets/icecream/customer3.png', '/assets/icecream/customer4.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first for same-origin GET: always try the freshest version, fall back
// to cache only when offline. Keeps the cache warm for offline play while making
// sure new deploys are picked up on the next load.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;   // let cross-origin go to network
  if (url.pathname.startsWith('/api/')) return;       // never cache API calls

  e.respondWith(
    fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return res;
    }).catch(() => caches.match(e.request).then(c => c || caches.match('/')))
  );
});
