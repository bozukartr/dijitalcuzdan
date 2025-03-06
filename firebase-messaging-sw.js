importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Firebase yapılandırması
const firebaseConfig = {
    apiKey: "AIzaSyDwqTl0pWINInc0DDFXbTNOSAoi7PyETM8",
    authDomain: "digitalwallet-45a8a.firebaseapp.com",
    projectId: "digitalwallet-45a8a",
    storageBucket: "digitalwallet-45a8a.firebasestorage.app",
    messagingSenderId: "351579695434",
    appId: "1:351579695434:web:f515645efa80ac6f8db9b3"
};

// Firebase'i başlat
firebase.initializeApp(firebaseConfig);

// Messaging nesnesini al
const messaging = firebase.messaging();

// Hata ayıklama için log fonksiyonu
function logDebug(message, data) {
    console.log(`[FCM Debug] ${message}`, data);
}

// Arka planda bildirim alma
messaging.onBackgroundMessage(async (payload) => {
    logDebug('Arka planda mesaj alındı:', payload);

    // Bildirim verilerini kontrol et
    if (!payload || (!payload.notification && !payload.data)) {
        logDebug('Geçersiz bildirim verisi:', payload);
        return;
    }

    try {
        const registration = await self.registration;
        
        const notificationTitle = payload.notification?.title || 'Dijital Cüzdan';
        const notificationOptions = {
            body: payload.notification?.body || payload.data?.message || 'Yeni bir bildiriminiz var!',
            icon: 'applogo.png',
            badge: 'applogo.png',
            tag: `notification-${Date.now()}`,
            data: {
                ...payload.data,
                timestamp: Date.now()
            },
            requireInteraction: true,
            renotify: true,
            actions: [
                {
                    action: 'open',
                    title: 'Aç'
                }
            ]
        };

        logDebug('Bildirim gösteriliyor:', { title: notificationTitle, options: notificationOptions });

        await registration.showNotification(notificationTitle, notificationOptions);
        logDebug('Bildirim başarıyla gösterildi');
    } catch (error) {
        logDebug('Bildirim gösterme hatası:', error);
        console.error('Detaylı hata:', error);
    }
});

// Bildirime tıklama olayı
self.addEventListener('notificationclick', async (event) => {
    logDebug('Bildirime tıklandı:', event);
    event.notification.close();

    try {
        const urlToOpen = new URL('dashboard.html', self.location.origin).href;

        const windowClients = await clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        });

        // Açık pencere var mı kontrol et
        for (const client of windowClients) {
            if (client.url === urlToOpen && 'focus' in client) {
                logDebug('Mevcut pencere bulundu, odaklanılıyor');
                await client.focus();
                return;
            }
        }

        // Açık pencere yoksa yeni pencere aç
        logDebug('Yeni pencere açılıyor');
        await clients.openWindow(urlToOpen);
    } catch (error) {
        logDebug('Pencere açma hatası:', error);
        console.error('Detaylı hata:', error);
    }
});

// Service worker kurulum olayı
self.addEventListener('install', (event) => {
    logDebug('Service Worker kuruldu');
    event.waitUntil(self.skipWaiting());
});

// Service worker aktivasyon olayı
self.addEventListener('activate', (event) => {
    logDebug('Service Worker aktif edildi');
    event.waitUntil(
        Promise.all([
            self.clients.claim(),
            // Eski önbellekleri temizle
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => caches.delete(cacheName))
                );
            })
        ])
    );
}); 