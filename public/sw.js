// Recebe as notificações de vencimento e abre o app ao tocar nelas.
self.addEventListener("push", (event) => {
  let d = { titulo: "Jarvis Finance", corpo: "", url: "/app" };
  try {
    d = { ...d, ...event.data.json() };
  } catch (_) {}
  event.waitUntil(
    self.registration.showNotification(d.titulo, {
      body: d.corpo,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: d.url },
      tag: "vencimentos",
      renotify: true,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/app";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((lista) => {
      for (const c of lista) if ("focus" in c) return c.focus().then(() => ("navigate" in c ? c.navigate(url) : undefined));
      return self.clients.openWindow(url);
    }),
  );
});
