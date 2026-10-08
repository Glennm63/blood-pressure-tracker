// Remove the device-only version's offline cache when upgrading this origin.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const key of await caches.keys())if(key.startsWith('pressure-app-'))await caches.delete(key);
 await self.clients.claim();await self.registration.unregister();
})()));
