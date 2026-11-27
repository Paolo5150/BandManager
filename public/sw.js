/* Minimal online-only push worker: intentionally does not cache app or API data. */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "You have a new notification." };
  }
  const title = payload.title || "BandManager";
  const options = {
    body: payload.body || "You have a new notification.",
    icon: "/icon",
    badge: "/icon",
    data: { url: typeof payload.url === "string" ? payload.url : "/dashboard" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = new URL(event.notification.data?.url || "/dashboard", self.location.origin);
  if (destination.origin !== self.location.origin) destination.href = `${self.location.origin}/dashboard`;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(self.location.origin) && "focus" in client) {
        await client.navigate(destination.href);
        return client.focus();
      }
    }
    return self.clients.openWindow(destination.href);
  })());
});