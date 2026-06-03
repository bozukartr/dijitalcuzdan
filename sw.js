// Dijital Cüzdan - Service Worker
// Uygulama kabuğunu (app shell) önbelleğe alır, çevrimdışı çalışmayı ve
// PWA olarak kurulabilmeyi sağlar.

const CACHE_VERSION = 'v6';
const CACHE_NAME = `dijital-cuzdan-${CACHE_VERSION}`;

// Kurulum sırasında önbelleğe alınacak temel dosyalar (app shell).
const APP_SHELL = [
    './',
    'index.html',
    'dashboard.html',
    'register.html',
    'style.css',
    'login.css',
    'script.js',
    'login.js',
    'register.js',
    'auth.js',
    'pin.js',
    'pwa.js',
    'firebase-config.js',
    'manifest.json',
    'logo.png',
    'applogo.png',
    'img/akbank.png',
    'img/denizbank.png',
    'img/emiratesnbd.png',
    'img/garanti.png',
    'img/halkbankasi.png',
    'img/isbankasi.png',
    'img/papara.png',
    'img/qnb.png',
    'img/vakifbank.png',
    'img/yapikredi.png',
    'img/ziraatbankasi.png'
];

// Kurulum: app shell'i önbelleğe al.
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            // Tek bir dosya bile 404 verirse addAll tüm kurulumu bozmasın diye
            // dosyaları tek tek, hataya dayanıklı şekilde ekliyoruz.
            .then((cache) => Promise.allSettled(
                APP_SHELL.map((url) => cache.add(url))
            ))
            .then(() => self.skipWaiting())
    );
});

// Etkinleşme: eski sürüm önbelleklerini temizle.
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

// İstekleri karşıla.
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Yalnızca GET isteklerini ele al.
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Firebase (auth/firestore) ve diğer dinamik API isteklerini ASLA önbellekleme;
    // her zaman ağdan getir. Aksi halde eski/yanlış veri dönebilir.
    const isFirebase = /(^|\.)googleapis\.com$/.test(url.hostname) ||
                       /(^|\.)firebaseio\.com$/.test(url.hostname) ||
                       /(^|\.)firebaseapp\.com$/.test(url.hostname) ||
                       /(^|\.)gstatic\.com$/.test(url.hostname) && url.pathname.includes('/firebasejs/');
    if (isFirebase) {
        return; // varsayılan ağ davranışına bırak
    }

    // Sayfa gezinmeleri (HTML): önce ağ, başarısız olursa önbellek (offline fallback).
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                    return response;
                })
                .catch(() => caches.match(request).then((cached) => cached || caches.match('index.html')))
        );
        return;
    }

    // Aynı kaynaktan gelen statik dosyalar (css/js/img): önce önbellek, sonra ağ
    // (stale-while-revalidate: önbellekten ver, arka planda güncelle).
    if (url.origin === self.location.origin) {
        event.respondWith(
            caches.match(request).then((cached) => {
                const networkFetch = fetch(request)
                    .then((response) => {
                        if (response && response.status === 200) {
                            const copy = response.clone();
                            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                        }
                        return response;
                    })
                    .catch(() => cached);
                return cached || networkFetch;
            })
        );
        return;
    }

    // Diğer kaynaklar (ör. Google Fonts ikonları): önce önbellek, sonra ağ.
    event.respondWith(
        caches.match(request).then((cached) => cached || fetch(request).then((response) => {
            if (response && response.status === 200 && response.type === 'basic') {
                const copy = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
        }).catch(() => cached))
    );
});
