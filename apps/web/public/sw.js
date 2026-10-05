// MAD O MEDIA • Agency OS Service Worker
// Handles background web push notifications and offline shell support

const CACHE_NAME = 'agency-os-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    clients.claim().then(() => {
      // Clean up old caches if needed
      return caches.keys().then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        );
      });
    })
  );
});

// Background Push Notification Event
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch (e) {
    payload = {
      title: 'Agency OS Alert',
      body: event.data.text(),
      url: '/'
    };
  }

  const title = payload.title || 'Agency OS';
  const options = {
    body: payload.body || 'You have a new update in Agency OS',
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/icon-192.png',
    tag: payload.tag || payload.key || payload.id || 'agency-os-notification',
    data: {
      url: payload.url || payload.href || '/'
    },
    vibrate: [200, 100, 200],
    renotify: true
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// User clicks on notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const rawUrl = event.notification.data?.url || '/';
  const targetUrl = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
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
