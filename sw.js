// Rutina de Volumen: guarda la app en el móvil para que abra sin conexión.
// Estrategia: responde con lo guardado y actualiza en segundo plano, así que
// los cambios publicados llegan en la siguiente apertura.
// GitHub Pages deja que el navegador reutilice cada archivo durante 10 minutos;
// por eso las descargas de aquí piden siempre la copia del servidor.
const CACHE = 'rutina-volumen-v17';
const INDEX = new URL('./index.html', self.location).href;
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './fonts/figtree-latin.woff2',
  './fonts/big-shoulders-display-latin.woff2'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('rutina-volumen-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Safari rechaza páginas servidas desde el service worker si la respuesta
// guardada vino de una redirección; se copia sin ese rastro.
async function withoutRedirect(res) {
  if (!res.redirected) return res;
  const body = await res.clone().blob();
  return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
}

async function fetchAndStore(request, key, isPage) {
  try {
    const res = await fetch(isPage ? new Request(INDEX, { cache: 'no-cache' }) : new Request(request, { cache: 'no-cache' }));
    if (!res || !res.ok || res.type !== 'basic') return res;
    const clean = isPage ? await withoutRedirect(res) : res;
    const cache = await caches.open(CACHE);
    await cache.put(key, clean.clone());
    return clean;
  } catch (e) {
    return null;
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  const isPage = request.mode === 'navigate';
  const key = isPage ? INDEX : request;
  const network = fetchAndStore(request, key, isPage);
  event.waitUntil(network);
  event.respondWith(
    caches.match(key, { ignoreSearch: isPage })
      .then(cached => cached || network)
      .then(res => res || (isPage ? caches.match(INDEX) : undefined))
      .then(res => res || Response.error())
  );
});
