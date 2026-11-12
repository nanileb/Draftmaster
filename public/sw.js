// DraftMaster — service worker simple : application hors-ligne, images Data Dragon en cache.
// Portée : /draftmaster/ uniquement (le coach a son propre service worker, on n'y touche pas).
const SHELL = 'dm-shell-v1', IMG = 'dm-img-v1';
const BASE = new URL('./', self.location).pathname; // /draftmaster/
self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(['./', 'index.html', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => ![SHELL, IMG].includes(k)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  // Icônes Data Dragon : cache d'abord (elles ne changent pas pour une version donnée)
  if (u.hostname === 'ddragon.leagueoflegends.com' && u.pathname.includes('/img/')) {
    e.respondWith(caches.open(IMG).then(async c => (await c.match(e.request)) || fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; })));
    return;
  }
  // Seulement nos propres fichiers (pas les données du coach ni le relais Riot)
  if (u.origin !== location.origin || !u.pathname.startsWith(BASE)) return;
  // Navigation : réseau d'abord, sinon index.html en cache (routes de l'application)
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(SHELL).then(c => c.put('index.html', cp)); return r; }).catch(() => caches.match('index.html')));
    return;
  }
  // Fichiers : réseau d'abord (mises à jour), cache si hors-ligne
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const cp = r.clone(); caches.open(SHELL).then(c => c.put(e.request, cp)); } return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
