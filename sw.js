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
    url: '/poka/parent.html'
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
      icon: '/poka/icons/icon-192.png',
      badge: '/poka/icons/icon-192.png',
      data: {
        url: data.url || '/poka/parent.html'
      }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification?.data?.url || '/poka/parent.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        const currentUrl = new URL(client.url);

        if (currentUrl.origin === self.location.origin) {
          if ('navigate' in client) {
            return client.navigate(targetUrl).then(() => client.focus());
          }
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});