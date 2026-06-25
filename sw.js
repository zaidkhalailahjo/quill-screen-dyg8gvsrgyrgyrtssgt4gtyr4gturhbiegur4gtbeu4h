// Service Worker - Network Only (No Caching)
self.addEventListener('install', event => {
  self.skipWaiting(); // تفعيل فوراً
});

self.addEventListener('activate', event => {
  event.waitUntil(clients.claim()); // تطبيق على كل الصفحات
});

self.addEventListener('fetch', event => {
  // جلب البيانات دائماً من الإنترنت مباشرة بدون استخدام الكاش
  event.respondWith(fetch(event.request));
});
