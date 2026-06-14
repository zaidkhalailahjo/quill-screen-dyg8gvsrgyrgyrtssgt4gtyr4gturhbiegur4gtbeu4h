const CACHE_NAME = 'quill-sender-v2';
const urlsToCache = [
    '/',
    '/index.html',
    '/manifest.json'
];

// تثبيت الـ Service Worker وحفظ الملفات الأساسية في الكاش
self.addEventListener('install', event => {
    // التخطي الفوري لتثبيت النسخة الجديدة دون انتظار
    self.skipWaiting();
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

// اعتراض الطلبات واسترجاعها من الكاش إن وجدت
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response; // عودة من الكاش
                }
                return fetch(event.request); // جلب من الشبكة
            })
    );
});

// تحديث الـ Service Worker وحذف الكاش القديم
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // تفعيل النسخة الجديدة فوراً للعملاء
            return self.clients.claim();
        })
    );
});
