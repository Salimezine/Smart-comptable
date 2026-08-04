// SW de nettoyage — remplace l'ancien Service Worker Workbox puis se désinstalle
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    await self.clients.claim();
    // Supprime tous les caches Workbox
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    // Désenregistre ce SW après nettoyage
    const reg = await self.registration;
    await reg.unregister();
  })());
});
