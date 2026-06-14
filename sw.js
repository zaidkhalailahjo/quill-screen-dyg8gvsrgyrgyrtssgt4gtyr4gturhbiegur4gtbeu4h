// هذا الملف ضروري فقط لإظهار رسالة التثبيت (PWA).
// بناءً على طلبك، تم إلغاء الكاش ليعمل الموقع فقط مع الإنترنت دائماً.

self.addEventListener('install', event => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    return caches.delete(cacheName); // حذف أي كاش قديم
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    // جلب الملفات من الإنترنت دائماً ولا نستخدم الكاش أبداً
    event.respondWith(fetch(event.request));
});
