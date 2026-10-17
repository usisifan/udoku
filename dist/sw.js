const CACHE='udoku-v0.3.0';
const FILES=['./','index.html','style.css','theme.js','app.js','engine.js','levels.js','pwa.js','manifest.webmanifest','assets/ushishi.png','assets/ayadan.png','assets/favicon.png','assets/app-icon-192.png','assets/app-icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('udoku-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE),hit=await cache.match(event.request);if(hit)return hit;try{return await fetch(event.request);}catch(error){if(event.request.mode==='navigate')return cache.match('index.html');throw error;}})());
});
