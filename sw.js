// Guarda los archivos de la app para que abra rápido y funcione sin internet.
// Los datos los maneja Firebase; este archivo no los toca.
const CACHE = "shepos-v5";
const SHELL = ["./", "index.html", "app.js", "seed.js", "config.js", "xlsx.mini.min.js", "logo.webp", "icon-192.png", "icon-512.png", "manifest.webmanifest"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const mine = url.origin === self.location.origin;
  const sdk = url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/");
  const fonts = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!mine && !sdk && !fonts) return; // Firebase (datos e inicio de sesión) va directo a internet
  // Primero internet (para recibir actualizaciones); si no hay, la copia guardada.
  e.respondWith(fetch(req).then(res => {
    if (res && (res.ok || res.type === "opaque")) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then(r => r || (mine && req.mode === "navigate" ? caches.match("index.html") : undefined))));
});
