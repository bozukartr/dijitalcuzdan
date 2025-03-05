// Oturum kontrolü
function checkAuth() {
    firebase.auth().onAuthStateChanged((user) => {
        const currentPage = window.location.pathname.split('/').pop();
        
        if (!user && currentPage !== 'index.html' && currentPage !== 'register.html') {
            // Kullanıcı giriş yapmamışsa ve login/register sayfasında değilse
            window.location.href = 'index.html';
        } else if (user && (currentPage === 'index.html' || currentPage === 'register.html')) {
            // Kullanıcı giriş yapmışsa ve login/register sayfasındaysa
            window.location.href = 'dashboard.html';
        }
    });
}

// Çıkış işlemi
function logout() {
    firebase.auth().signOut().then(() => {
        localStorage.clear(); // Tüm localStorage verilerini temizle
        window.location.href = 'index.html';
    }).catch((error) => {
        console.error('Çıkış hatası:', error);
    });
}

// Sayfa yüklendiğinde oturum kontrolü yap
document.addEventListener('DOMContentLoaded', checkAuth); 