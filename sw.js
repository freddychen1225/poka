self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

self.addEventListener('push', (event) => {
  let data = {
    title: 'Poka 通知',
    body: '你有一則新的孩子回報',
    url: '/'
  };

  try {
    if (event.data) {
      const json = event.data.json();
      data = {
        ...data,
        ...json
      };
    }
  } catch (err) {
    console.error('Push payload parse error:', err);
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Poka 通知', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: {
        url: data.url || '/'
      }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification?.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});