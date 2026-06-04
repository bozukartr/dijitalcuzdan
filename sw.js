// Dijital Cüzdan - Service Worker
const CACHE = 'dijital-cuzdan-v6';
const SHELL = [
    './', 'index.html', 'register.html', 'dashboard.html',
    'styles.css', 'auth.js', 'app.js', 'pwa.js',
    'firebase-config.js', 'manifest.json', 'logo.png', 'applogo.png'
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE)
            .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', e => {
    const { request } = e;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);

    // Firebase/dinamik istekleri önbellekleme
    if (/googleapis\.com$|firebaseio\.com$|firebaseapp\.com$/.test(url.hostname) ||
        (/gstatic\.com$/.test(url.hostname) && url.pathname.includes('/firebasejs/'))) {
        return;
    }

    if (request.mode === 'navigate') {
        e.respondWith(
            fetch(request).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(request, cp)); return r; })
                .catch(() => caches.match(request).then(c => c || caches.match('index.html')))
        );
        return;
    }

    if (url.origin === self.location.origin) {
        e.respondWith(
            caches.match(request).then(cached => {
                const net = fetch(request).then(r => {
                    if (r && r.status === 200) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(request, cp)); }
                    return r;
                }).catch(() => cached);
                return cached || net;
            })
        );
        return;
    }

    e.respondWith(
        caches.match(request).then(cached => cached || fetch(request).then(r => {
            if (r && r.status === 200 && r.type === 'basic') { const cp = r.clone(); caches.open(CACHE).then(c => c.put(request, cp)); }
            return r;
        }).catch(() => cached))
    );
});
