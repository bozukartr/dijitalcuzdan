/* Giriş & kayıt mantığı (index.html + register.html ortak) */
(function () {
    const db = () => firebase.firestore();

    function showMsg(text, type) {
        const box = document.getElementById('authMsg');
        if (!box) return;
        box.innerHTML = `<div class="msg ${type}"><span class="material-icons">${type === 'ok' ? 'check_circle' : 'error'}</span>${text}</div>`;
        if (type === 'error') setTimeout(() => { box.innerHTML = ''; }, 4000);
    }

    // Şifre göster/gizle
    document.querySelectorAll('[data-toggle]').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.parentElement.querySelector('input');
            const show = input.type === 'password';
            input.type = show ? 'text' : 'password';
            btn.querySelector('.material-icons').textContent = show ? 'visibility' : 'visibility_off';
        });
    });

    async function emailForUsername(username) {
        const snap = await db().collection('users').doc(username).get();
        return snap.exists ? snap.data().email : null;
    }

    /* ---------- LOGIN ---------- */
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;
            try {
                const email = await emailForUsername(username);
                if (!email) { showMsg('Kullanıcı bulunamadı.', 'error'); return; }
                await firebase.auth().signInWithEmailAndPassword(email, password);
                location.href = 'dashboard.html';
            } catch (err) {
                const map = {
                    'auth/wrong-password': 'Hatalı şifre.',
                    'auth/invalid-credential': 'Kullanıcı adı veya şifre hatalı.',
                    'auth/too-many-requests': 'Çok fazla deneme. Sonra tekrar deneyin.'
                };
                showMsg(map[err.code] || 'Giriş yapılamadı.', 'error');
                console.error(err);
            }
        });

        firebase.auth().onAuthStateChanged(u => { if (u) location.href = 'dashboard.html'; });
    }

    /* ---------- REGISTER ---------- */
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        let captcha = '';
        const captchaBox = document.getElementById('captchaBox');
        function genCaptcha() {
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            captcha = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
            captchaBox.textContent = captcha;
        }
        genCaptcha();
        document.getElementById('captchaRefresh').addEventListener('click', genCaptcha);

        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;
            const confirm = document.getElementById('passwordConfirm').value;
            const captchaInput = document.getElementById('captchaInput').value.trim();

            if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) { showMsg('Kullanıcı adı 3-20 karakter; harf, rakam, _', 'error'); return; }
            if (password.length < 6) { showMsg('Şifre en az 6 karakter olmalı.', 'error'); return; }
            if (password !== confirm) { showMsg('Şifreler eşleşmiyor.', 'error'); return; }
            if (captchaInput.toUpperCase() !== captcha) { showMsg('Güvenlik kodu hatalı.', 'error'); genCaptcha(); return; }

            try {
                const exists = await db().collection('users').doc(username).get();
                if (exists.exists) { showMsg('Bu kullanıcı adı kullanımda.', 'error'); return; }

                const email = `${username}_${Date.now()}@users.digitalcuzdan.app`;
                const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
                await db().collection('users').doc(username).set({
                    uid: cred.user.uid, username, email,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                await cred.user.updateProfile({ displayName: username });
                showMsg('Kayıt başarılı! Yönlendiriliyorsun...', 'ok');
                setTimeout(() => location.href = 'dashboard.html', 1200);
            } catch (err) {
                const map = {
                    'auth/email-already-in-use': 'Sistem hatası, tekrar deneyin.',
                    'auth/weak-password': 'Şifre çok zayıf.',
                    'auth/operation-not-allowed': 'Kayıt şu anda kapalı.'
                };
                showMsg(map[err.code] || 'Kayıt yapılamadı.', 'error');
                console.error(err);
            }
        });
    }
})();
