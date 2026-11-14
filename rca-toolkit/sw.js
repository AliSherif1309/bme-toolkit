const CACHE_NAME = 'rca-toolkit-v3';
const APP_ROOT = new URL('./', self.location.href);
const APP_FILES = ['index.html', 'styles.css', 'app.js', 'manifest.json',
  'icons/icon-192.png', 'icons/icon-512.png'];
const APP_URLS = new Set([APP_ROOT.href, ...APP_FILES.map(path => new URL(path, APP_ROOT).href)]);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll([...APP_URLS])));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('rca-toolkit-') && key !== CACHE_NAME)
      .map(key => caches.delete(key))
  )));
});

// Network-first for app files; cached copies remain available offline.
// Never cache user data, arbitrary requests, or other apps on the same origin.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  url.search = '';
  if (event.request.method !== 'GET' || !APP_URLS.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(event.request);
      if (response.ok && response.type !== 'opaque') {
        await cache.put(url.href, response.clone());
        return response;
      }
      return (await cache.match(url.href)) || response;
    } catch (error) {
      const cached = await cache.match(url.href);
      if (cached) return cached;
      throw error;
    }
  })());
});
