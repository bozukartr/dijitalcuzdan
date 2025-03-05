document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    const togglePasswordBtns = document.querySelectorAll('.toggle-password');
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    const captchaBox = document.getElementById('captchaBox');
    const refreshCaptchaBtn = document.getElementById('refreshCaptcha');

    let captchaText = '';

    // Şifre göster/gizle fonksiyonu
    togglePasswordBtns.forEach((btn, index) => {
        btn.addEventListener('click', () => {
            const type = passwordInputs[index].getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInputs[index].setAttribute('type', type);
            
            const icon = btn.querySelector('.material-icons');
            icon.textContent = type === 'password' ? 'visibility_off' : 'visibility';
        });
    });

    // Captcha oluşturma fonksiyonu
    function generateCaptcha() {
        const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
        captchaText = Array(6).fill(0).map(() => chars[Math.floor(Math.random() * chars.length)]).join('');
        captchaBox.textContent = captchaText;
    }

    // Kullanıcı adı kontrolü
    async function isUsernameAvailable(username) {
        try {
            const snapshot = await firebase.firestore()
                .collection('users')
                .where('username', '==', username)
                .get();
            return snapshot.empty;
        } catch (error) {
            console.error('Username check error:', error);
            return false;
        }
    }

    // Captcha yenileme
    refreshCaptchaBtn.addEventListener('click', generateCaptcha);

    // Form gönderme işlemi
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const passwordConfirm = document.getElementById('passwordConfirm').value;
        const captchaInput = document.getElementById('captchaInput').value;

        // Validasyonlar
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
            showError('Kullanıcı adı 3-20 karakter arasında olmalı ve sadece harf, rakam ve alt çizgi içermelidir.');
            return;
        }

        if (password !== passwordConfirm) {
            showError('Şifreler eşleşmiyor!');
            return;
        }

        if (captchaInput.toLowerCase() !== captchaText.toLowerCase()) {
            showError('Güvenlik kodu hatalı!');
            generateCaptcha();
            document.getElementById('captchaInput').value = '';
            return;
        }

        try {
            // Kullanıcı adı kontrolü
            const userDoc = await firebase.firestore().collection('users').doc(username).get();
            if (userDoc.exists) {
                showError('Bu kullanıcı adı zaten kullanımda.');
                return;
            }

            // Benzersiz bir email oluştur
            const email = `${username}_${Date.now()}@users.digitalcuzdan.app`;
            
            // Firebase ile kayıt ol
            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            
            if (userCredential.user) {
                // Kullanıcı bilgilerini Firestore'a kaydet
                await firebase.firestore().collection('users').doc(username).set({
                    uid: userCredential.user.uid,
                    username: username,
                    email: email,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                // Kullanıcı adını görünen ad olarak ayarla
                await userCredential.user.updateProfile({
                    displayName: username
                });
                
                // Başarılı kayıt sonrası login sayfasına yönlendir
                showSuccess('Kayıt başarılı! Giriş sayfasına yönlendiriliyorsunuz...');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 2000);
            }
        } catch (error) {
            let errorMessage = 'Bir hata oluştu. Lütfen tekrar deneyin.';
            
            switch (error.code) {
                case 'auth/email-already-in-use':
                    errorMessage = 'Sistem hatası oluştu, lütfen tekrar deneyin.';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Geçersiz kullanıcı adı.';
                    break;
                case 'auth/operation-not-allowed':
                    errorMessage = 'Kayıt işlemi şu anda devre dışı.';
                    break;
                case 'auth/weak-password':
                    errorMessage = 'Şifre çok zayıf. En az 6 karakter kullanın.';
                    break;
            }
            
            showError(errorMessage);
            console.error('Register error:', error);
        }
    });

    // Hata mesajı gösterme fonksiyonu
    function showError(message) {
        const existingMessage = document.querySelector('.error-message, .success-message');
        if (existingMessage) existingMessage.remove();

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

    // Başarı mesajı gösterme fonksiyonu
    function showSuccess(message) {
        const existingMessage = document.querySelector('.error-message, .success-message');
        if (existingMessage) existingMessage.remove();

        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.innerHTML = `
            <span class="material-icons">check_circle</span>
            ${message}
        `;
        
        const form = document.querySelector('.login-form');
        form.insertBefore(successDiv, form.firstChild);
    }

    // İlk captcha'yı oluştur
    generateCaptcha();
}); 