const CACHE_NAME = 'poka-v1';

// 安裝時觸發
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// 啟動時觸發
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// 攔截網路請求 (目前設定為直接放行，滿足 PWA 基本要求)
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});