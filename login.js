document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const togglePassword = document.querySelector('.toggle-password');
    const passwordInput = document.getElementById('password');
    const rememberMe = document.getElementById('rememberMe');

    // Şifre göster/gizle fonksiyonu
    togglePassword.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        
        const icon = togglePassword.querySelector('.material-icons');
        icon.textContent = type === 'password' ? 'visibility_off' : 'visibility';
    });

    // Kullanıcı adından email bulma
    async function getEmailByUsername(username) {
        try {
            const snapshot = await firebase.firestore()
                .collection('users')
                .doc(username)  // Doğrudan kullanıcı adını belge ID'si olarak kullan
                .get();

            if (snapshot.exists) {
                return snapshot.data().email;
            }
            return null;
        } catch (error) {
            console.error('Kullanıcı adı arama hatası:', error);
            return null;
        }
    }

    // Form gönderme işlemi
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = passwordInput.value;
        
        try {
            // Kullanıcı adına karşılık gelen email'i bul
            const email = await getEmailByUsername(username);
            
            if (!email) {
                showError('Kullanıcı bulunamadı.');
                return;
            }

            // Firebase ile giriş yap
            const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
            
            if (userCredential.user) {
                // Beni hatırla seçeneği işaretliyse bilgileri kaydet
                if (rememberMe.checked) {
                    localStorage.setItem('rememberedUsername', username);
                } else {
                    localStorage.removeItem('rememberedUsername');
                }
                
                // Oturum durumunu kaydet
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('userId', userCredential.user.uid);
                
                // Başarılı giriş sonrası dashboard sayfasına yönlendir
                window.location.href = 'dashboard.html';
            }
        } catch (error) {
            let errorMessage = 'Bir hata oluştu. Lütfen tekrar deneyin.';
            
            switch (error.code) {
                case 'auth/user-not-found':
                    errorMessage = 'Kullanıcı bulunamadı.';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'Hatalı şifre.';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = 'Çok fazla başarısız deneme. Lütfen daha sonra tekrar deneyin.';
                    break;
            }
            
            showError(errorMessage);
            console.error('Login error:', error);
        }
    });

    // Hatırlanmış kullanıcı adı varsa doldur
    const rememberedUsername = localStorage.getItem('rememberedUsername');
    if (rememberedUsername) {
        document.getElementById('username').value = rememberedUsername;
        rememberMe.checked = true;
    }

    // Hata mesajı gösterme fonksiyonu
    function showError(message) {
        const existingError = document.querySelector('.error-message');
        if (existingError) existingError.remove();

        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `
            <span class="material-icons">error</span>
            ${message}
        `;
        
        const form = document.querySelector('.login-form');
        form.insertBefore(errorDiv, form.firstChild);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 3000);
    }

    // Oturum durumu kontrolü
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            window.location.href = 'dashboard.html';
        }
    });
});

// Tema yönetimi
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

// Tema başlatma
initTheme(); 