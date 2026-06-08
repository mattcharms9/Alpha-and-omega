self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Alpha & Omega", body: event.data.text() };
  }

  const { title, body, url, tag } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-72.png",
      tag: tag ?? "alpha-omega",
      data: { url: url ?? "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.focus();
            client.navigate(url);
            return;
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});
