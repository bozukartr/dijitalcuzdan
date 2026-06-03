// 6 haneli PIN giriş bileşeni (internet bankacılığı tarzı).
// Sayfadaki her ".pin-field" için 6 kutuyu yönetir; birleşik değeri
// gizli input'a yazar. Otomatik ilerleme, geri silme ve yapıştırma desteği.
function initPinFields() {
    document.querySelectorAll('.pin-field').forEach((field) => {
        const boxes = Array.from(field.querySelectorAll('.pin-box'));
        const hidden = field.querySelector('input[type="hidden"]');
        if (!boxes.length || !hidden) return;

        const sync = () => {
            hidden.value = boxes.map((b) => b.value).join('');
        };

        boxes.forEach((box, index) => {
            box.addEventListener('input', () => {
                // Yalnızca tek bir rakama izin ver
                box.value = box.value.replace(/\D/g, '').slice(0, 1);
                box.classList.toggle('filled', box.value !== '');
                if (box.value && index < boxes.length - 1) {
                    boxes[index + 1].focus();
                }
                sync();
            });

            box.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !box.value && index > 0) {
                    boxes[index - 1].focus();
                }
            });

            box.addEventListener('focus', () => box.select());

            box.addEventListener('paste', (e) => {
                e.preventDefault();
                const digits = (e.clipboardData.getData('text') || '')
                    .replace(/\D/g, '')
                    .slice(0, boxes.length);
                if (!digits) return;
                digits.split('').forEach((d, i) => {
                    if (boxes[i]) {
                        boxes[i].value = d;
                        boxes[i].classList.add('filled');
                    }
                });
                boxes[Math.min(digits.length, boxes.length - 1)].focus();
                sync();
            });
        });
    });
}

document.addEventListener('DOMContentLoaded', initPinFields);
