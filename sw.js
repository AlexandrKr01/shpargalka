const CACHE_NAME = 'megashpargalka-v1';

// Файлы, которые кэшируются сразу при установке
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json'
];

// Установка: кэшируем основные файлы
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PRECACHE_URLS);
    }).then(function() {
      // Активируемся сразу, не ждём закрытия вкладок
      return self.skipWaiting();
    })
  );
});

// Активация: удаляем старые кэши
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.filter(function(name) {
          return name !== CACHE_NAME;
        }).map(function(name) {
          return caches.delete(name);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Fetch: сначала кэш, при промахе — сеть, затем снова кэшируем
self.addEventListener('fetch', function(event) {
  // Пропускаем не-GET запросы и chrome-extension
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  // Для Google Fonts — сначала сеть, потом кэш (чтобы шрифты обновлялись)
  if (event.request.url.includes('fonts.googleapis.com') ||
      event.request.url.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(function(cache) {
        return fetch(event.request).then(function(response) {
          cache.put(event.request, response.clone());
          return response;
        }).catch(function() {
          return caches.match(event.request);
        });
      })
    );
    return;
  }

  // Для всего остального — сначала кэш
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;

      // Не нашли в кэше — идём в сеть и сохраняем
      return fetch(event.request).then(function(response) {
        // Кэшируем только успешные ответы
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        var responseClone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, responseClone);
        });
        return response;
      }).catch(function() {
        // Нет сети и нет в кэше — возвращаем главную страницу
        return caches.match('./index.html');
      });
    })
  );
});
