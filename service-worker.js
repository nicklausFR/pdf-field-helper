const CACHE_NAME = 'pdf-field-helper-v1.3';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './version.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];
const RUNTIME_LIBS = [
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js',
  'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(APP_SHELL.map(async url => {
      try {
        const r = await fetch(url, {cache:'no-store'});
        if (r.ok) await cache.put(url, r.clone());
      } catch (_) {}
    }));
    await Promise.all(RUNTIME_LIBS.map(async url => {
      try {
        const response = await fetch(url, {mode:'cors'});
        if (response.ok) await cache.put(url, response.clone());
      } catch (_) {}
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => (k.startsWith('pdf-field-helper-v') || k.startsWith('pdf-overlay-editor-v')) && k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const sameOrigin = url.origin === self.location.origin;
  const isNavigation = event.request.mode === 'navigate';
  const isCoreFile = sameOrigin && (url.pathname.endsWith('/index.html') || url.pathname.endsWith('/manifest.json') || url.pathname.endsWith('/version.json') || url.pathname === new URL('./', self.location.href).pathname);

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    if (isNavigation || isCoreFile) {
      try {
        const response = await fetch(event.request, {cache:'no-store'});
        if (response && response.ok) await cache.put(event.request, response.clone());
        return response;
      } catch (_) {
        return (await cache.match(event.request)) || (await cache.match('./index.html')) || Response.error();
      }
    }

    const cached = await cache.match(event.request);
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response && (response.ok || response.type === 'opaque')) cache.put(event.request, response.clone()).catch(() => {});
      return response;
    } catch (_) {
      return Response.error();
    }
  })());
});
