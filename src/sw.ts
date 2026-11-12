/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { clientsClaim } from 'workbox-core';

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
// The whole app shell, fonts and icons are precached: the app opens fully offline.
precacheAndRoute(self.__WB_MANIFEST);
// Any navigation inside the scope gets the cached app shell (hash routing does the rest)
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

// Web Push (only used when sync and push reminders are switched on).
self.addEventListener('push', (event) => {
  let data: { title?: string; body?: string; tag?: string; url?: string } = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { body: event.data?.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Elbow Rehab', {
      body: data.body ?? 'Time for your rehab check-in.',
      tag: data.tag ?? 'elbow-reminder',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      data: { url: data.url ?? './' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data?.url as string) ?? './', self.registration.scope).href;
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of all) {
        if ('focus' in c) {
          await (c as WindowClient).navigate(url).catch(() => undefined);
          return (c as WindowClient).focus();
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
