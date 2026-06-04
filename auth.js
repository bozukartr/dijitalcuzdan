/* Giriş & kayıt mantığı (index.html + register.html ortak) */
(function () {
    const db = () => firebase.firestore();

    function showMsg(text, type) {
        const box = document.getElementById('authMsg');
        if (!box) return;
        box.innerHTML = `<div class="msg ${type}"><span class="material-icons">${type === 'ok' ? 'check_circle' : 'error'}</span>${text}</div>`;
        if (type === 'error') setTimeout(() => { box.innerHTML = ''; }, 4000);
    }

    // 6 haneli PIN giriş bileşeni
    function initPinFields() {
        document.querySelectorAll('.pin-field').forEach(field => {
            const boxes = Array.from(field.querySelectorAll('.pin-box'));
            const hidden = field.querySelector('input[type="hidden"]');
            if (!boxes.length || !hidden) return;
            const sync = () => { hidden.value = boxes.map(b => b.value).join(''); };
            boxes.forEach((box, i) => {
                box.addEventListener('input', () => {
                    box.value = box.value.replace(/\D/g, '').slice(0, 1);
                    box.classList.toggle('filled', box.value !== '');
                    if (box.value && i < boxes.length - 1) boxes[i + 1].focus();
                    sync();
                });
                box.addEventListener('keydown', e => {
                    if (e.key === 'Backspace' && !box.value && i > 0) boxes[i - 1].focus();
                });
                box.addEventListener('focus', () => box.select());
                box.addEventListener('paste', e => {
                    e.preventDefault();
                    const digits = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, boxes.length);
                    if (!digits) return;
                    digits.split('').forEach((d, idx) => { if (boxes[idx]) { boxes[idx].value = d; boxes[idx].classList.add('filled'); } });
                    boxes[Math.min(digits.length, boxes.length - 1)].focus();
                    sync();
                });
            });
        });
    }
    initPinFields();

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
            if (!/^\d{6}$/.test(password)) { showMsg('6 haneli PIN kodunu girin.', 'error'); return; }
            try {
                const email = await emailForUsername(username);
                if (!email) { showMsg('Kullanıcı bulunamadı.', 'error'); return; }
                await firebase.auth().signInWithEmailAndPassword(email, password);
                location.href = 'dashboard.html';
            } catch (err) {
                const map = {
                    'auth/wrong-password': 'Hatalı PIN.',
                    'auth/invalid-credential': 'Kullanıcı adı veya PIN hatalı.',
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
            if (!/^\d{6}$/.test(password)) { showMsg('PIN 6 haneli ve yalnızca rakam olmalı.', 'error'); return; }
            if (password !== confirm) { showMsg('PIN kodları eşleşmiyor.', 'error'); return; }
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
                    'auth/weak-password': 'PIN çok zayıf, farklı bir PIN deneyin.',
                    'auth/operation-not-allowed': 'Kayıt şu anda kapalı.'
                };
                showMsg(map[err.code] || 'Kayıt yapılamadı.', 'error');
                console.error(err);
            }
        });
    }
})();
