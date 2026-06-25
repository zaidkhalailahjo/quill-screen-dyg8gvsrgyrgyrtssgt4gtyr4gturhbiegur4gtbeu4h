// sw.js

self.addEventListener('install', (event) => {
    console.log('Service Worker: تم التثبيت بنجاح');
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker: تم التفعيل بنجاح');
});

self.addEventListener('fetch', (event) => {
    // يمكنك لاحقاً إضافة أكواد التخزين المؤقت (Caching) هنا لدعم العمل بدون إنترنت
});
