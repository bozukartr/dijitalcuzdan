importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyDwqTl0pWINInc0DDFXbTNOSAoi7PyETM8",
    authDomain: "digitalwallet-45a8a.firebaseapp.com",
    projectId: "digitalwallet-45a8a",
    storageBucket: "digitalwallet-45a8a.firebasestorage.app",
    messagingSenderId: "351579695434",
    appId: "1:351579695434:web:f515645efa80ac6f8db9b3"
});

const messaging = firebase.messaging();

// Arka planda bildirim alma
messaging.onBackgroundMessage((payload) => {
    console.log('Arka planda mesaj alındı:', payload);
    
    const notificationTitle = payload.notification?.title || 'Dijital Cüzdan';
    const notificationOptions = {
        body: payload.notification?.body || payload.data?.message || 'Yeni bir bildiriminiz var!',
        icon: '/dijitalcuzdan/applogo.png',
        badge: '/dijitalcuzdan/applogo.png',
        tag: 'notification-1',
        data: payload.data,
        actions: [
            {
                action: 'open',
                title: 'Aç'
            }
        ]
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    if (event.action === 'open') {
        clients.openWindow('/dijitalcuzdan/dashboard.html');
    }
}); 