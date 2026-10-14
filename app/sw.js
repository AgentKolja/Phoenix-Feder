// Offline-Betrieb für die App. Netz zuerst, Zwischenspeicher nur als Rückfall –
// so sieht niemand veraltete Inhalte, solange er online ist.
const VERSION = "routinen-__VERSION__";
const DATEIEN = ["./", "app.js", "app.css", "daten.json", "manifest.webmanifest", "icon-192.png",
  "../stil.css", "../thema.js", "../favicon.svg", "../schriften/fraunces.woff2", "../schriften/source-sans-3.woff2",
  "../schriften/source-sans-3-italic.woff2"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((namen) => Promise.all(namen.filter((n) => n !== VERSION).map((n) => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const anfrage = e.request;
  if (anfrage.method !== "GET" || new URL(anfrage.url).origin !== location.origin) return;
  e.respondWith(fetch(anfrage).then((antwort) => {
    if (antwort.ok) {
      const kopie = antwort.clone();
      caches.open(VERSION).then((c) => c.put(anfrage, kopie));
    }
    return antwort;
  }).catch(() => caches.match(anfrage, { ignoreSearch: true }).then((treffer) => treffer || caches.match("./"))));
});
