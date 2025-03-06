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
messaging.onBackgroundMessage((payload) => {
    logDebug('Arka planda mesaj alındı:', payload);

    // Bildirim verilerini kontrol et
    if (!payload || (!payload.notification && !payload.data)) {
        logDebug('Geçersiz bildirim verisi:', payload);
        return;
    }

    try {
        const notificationTitle = payload.notification?.title || 'Dijital Cüzdan';
        const notificationOptions = {
            body: payload.notification?.body || payload.data?.message || 'Yeni bir bildiriminiz var!',
            icon: '/dijitalcuzdan/applogo.png',
            badge: '/dijitalcuzdan/applogo.png',
            tag: `notification-${Date.now()}`,
            data: payload.data,
            requireInteraction: true,
            actions: [
                {
                    action: 'open',
                    title: 'Aç'
                }
            ]
        };

        logDebug('Bildirim gösteriliyor:', { title: notificationTitle, options: notificationOptions });

        return self.registration.showNotification(notificationTitle, notificationOptions);
    } catch (error) {
        logDebug('Bildirim gösterme hatası:', error);
    }
});

// Bildirime tıklama olayı
self.addEventListener('notificationclick', (event) => {
    logDebug('Bildirime tıklandı:', event);
    event.notification.close();

    const urlToOpen = new URL('/dijitalcuzdan/dashboard.html', self.location.origin).href;

    const promiseChain = clients.matchAll({
        type: 'window',
        includeUncontrolled: true
    })
    .then((windowClients) => {
        let matchingClient = null;

        for (let client of windowClients) {
            if (client.url === urlToOpen) {
                matchingClient = client;
                break;
            }
        }

        if (matchingClient) {
            logDebug('Mevcut pencere bulundu, odaklanılıyor');
            return matchingClient.focus();
        } else {
            logDebug('Yeni pencere açılıyor');
            return clients.openWindow(urlToOpen);
        }
    });

    event.waitUntil(promiseChain);
});

// Service worker kurulum olayı
self.addEventListener('install', (event) => {
    logDebug('Service Worker kuruldu');
    self.skipWaiting();
});

// Service worker aktivasyon olayı
self.addEventListener('activate', (event) => {
    logDebug('Service Worker aktif edildi');
    event.waitUntil(clients.claim());
}); 