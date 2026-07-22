/* Service worker de UXIA — habilita la instalación como app (PWA) y las notificaciones push.
   No cachea la app (siempre red) para no servir versiones viejas; su rol es push + arranque. */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Notificación push del servidor (api/notify-cron). El payload es JSON: { title, body, url, tag }.
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
  const title = data.title || "UXIA";
  const options = {
    body: data.body || "Tienes novedades pendientes.",
    icon: "/web-app-manifest-192x192.png",
    badge: "/web-app-manifest-192x192.png",
    tag: data.tag || "uxia",
    renotify: true,
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Al tocar la notificación: enfoca una pestaña abierta de la app o abre una nueva en la URL dada.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate && client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
