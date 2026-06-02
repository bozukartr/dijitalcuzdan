// Service Worker kaydı - PWA desteği için.
// Tüm sayfalarda (index, register, dashboard) yüklenir.
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .catch((error) => {
                console.error('Service Worker kaydı başarısız:', error);
            });
    });
}
