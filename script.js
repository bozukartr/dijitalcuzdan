/* ============================================================
   Dijital Cüzdan - Uygulama mantığı
   Veri Firestore'da users/{uid} altında saklanır.
   ============================================================ */

/* ---------- Sabitler ---------- */
const CURRENCIES = [
    { code: 'TRY', symbol: '₺', name: 'TL' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'USD', symbol: '$', name: 'Dolar' },
    { code: 'GBP', symbol: '£', name: 'Pound' },
    { code: 'AED', symbol: 'د.إ', name: 'AED' }
];

const BANKS = [
    { name: 'Ziraat Bankası', img: 'img/ziraatbankasi.png' },
    { name: 'Vakıfbank', img: 'img/vakifbank.png' },
    { name: 'İş Bankası', img: 'img/isbankasi.png' },
    { name: 'Halkbank', img: 'img/halkbankasi.png' },
    { name: 'Garanti', img: 'img/garanti.png' },
    { name: 'Yapı Kredi', img: 'img/yapikredi.png' },
    { name: 'Akbank', img: 'img/akbank.png' },
    { name: 'QNB', img: 'img/qnb.png' },
    { name: 'Denizbank', img: 'img/denizbank.png' },
    { name: 'Papara', img: 'img/papara.png' },
    { name: 'Emirates NBD', img: 'img/emiratesnbd.png' }
];
const BANK_IMG = Object.fromEntries(BANKS.map(b => [b.name, b.img]));

const CARD_COLORS = ['terracotta', 'khaki', 'navy', 'plum', 'teal', 'charcoal'];

const CATEGORIES = [
    { name: 'Market', icon: 'shopping_cart', color: '#C2683B' },
    { name: 'Yemek', icon: 'restaurant', color: '#D98A4E' },
    { name: 'Ulaşım', icon: 'directions_bus', color: '#6E7355' },
    { name: 'Giyim', icon: 'checkroom', color: '#9C6B4A' },
    { name: 'Teknoloji', icon: 'devices', color: '#4E6B6E' },
    { name: 'Eğlence', icon: 'movie', color: '#8A5A7A' },
    { name: 'Oyun', icon: 'sports_esports', color: '#5E7045' },
    { name: 'Kozmetik', icon: 'spa', color: '#B08A6A' },
    { name: 'Diğer', icon: 'category', color: '#918872' }
];
const CATEGORY_ICON = Object.fromEntries(CATEGORIES.map(c => [c.name, c.icon]));
const CATEGORY_COLOR = Object.fromEntries(CATEGORIES.map(c => [c.name, c.color]));

const SUB_ICONS = ['subscriptions', 'movie', 'music_note', 'sports_esports', 'cloud', 'fitness_center', 'wifi', 'bolt', 'newspaper', 'school'];

/* ---------- Durum ---------- */
let cards = [];
let debts = [];
let subscriptions = [];
let expenses = [];
let transactions = [];
let userSettings = { defaultCurrency: 'TRY', monthlyBudget: 0 };
let selectedDate = new Date();
let exchangeRates = null;
let balanceHidden = false;
let editingCardId = null;
let activeCardId = null; // para ekle / transfer için

const EXCHANGE_API_URL = 'https://api.exchangerate-api.com/v4/latest/TRY';

/* ---------- Yardımcılar ---------- */
function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

function symbolOf(code) {
    const c = CURRENCIES.find(x => x.code === code);
    return c ? c.symbol : '';
}

function formatCurrency(amount, currency) {
    const n = Number(amount) || 0;
    return `${symbolOf(currency)} ${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function parseAmount(value) {
    if (typeof value !== 'string') return Number(value) || 0;
    return parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
}

function convertCurrency(amount, from, to) {
    if (!exchangeRates || from === to) return amount;
    const inTRY = amount * (exchangeRates[from] || 1);
    return inTRY / (exchangeRates[to] || 1);
}

async function updateExchangeRates() {
    try {
        const res = await fetch(EXCHANGE_API_URL);
        const data = await res.json();
        exchangeRates = {
            TRY: 1,
            USD: 1 / data.rates.USD,
            EUR: 1 / data.rates.EUR,
            GBP: 1 / data.rates.GBP,
            AED: 1 / data.rates.AED
        };
    } catch (e) {
        console.error('Döviz kurları alınamadı:', e);
    }
}

function toast(msg) {
    let t = $('#toast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'toast';
        t.className = 'toast';
        document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---------- Tema ---------- */
function initTheme() {
    document.documentElement.setAttribute('data-theme', localStorage.getItem('theme') || 'light');
}
function toggleTheme() {
    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
}

/* ---------- Firestore ---------- */
async function saveData() {
    const user = firebase.auth().currentUser;
    if (!user) return;
    try {
        await firebase.firestore().collection('users').doc(user.uid).set({
            cards, debts, subscriptions, expenses, transactions,
            settings: userSettings,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (e) {
        console.error('Veri kaydetme hatası:', e);
        toast('Kaydedilemedi, bağlantıyı kontrol edin');
    }
}

function normalizeCard(c) {
    return {
        id: c.id,
        bank: c.bank || c.name || 'Diğer',
        label: c.label || c.name || c.bank || 'Kart',
        last4: c.last4 || '',
        color: c.color || CARD_COLORS[(c.id || 0) % CARD_COLORS.length],
        balance: Number(c.balance) || 0,
        currency: c.currency || 'TRY',
        cardType: c.cardType || 'debit'
    };
}

async function loadData() {
    const user = firebase.auth().currentUser;
    if (!user) return;
    try {
        const doc = await firebase.firestore().collection('users').doc(user.uid).get();
        if (doc.exists) {
            const d = doc.data();
            cards = (d.cards || d.banks || []).map(normalizeCard);
            debts = d.debts || [];
            subscriptions = d.subscriptions || [];
            expenses = d.expenses || [];
            transactions = d.transactions || [];
            userSettings = Object.assign({ defaultCurrency: 'TRY', monthlyBudget: 0 }, d.settings || {});
        }
    } catch (e) {
        console.error('Veri yükleme hatası:', e);
    }
    renderAll();
}

/* ---------- Render: hepsi ---------- */
function renderAll() {
    updateSummary();
    renderCards();
    renderRecent();
    renderDebts();
    renderSubs();
    renderExpenses();
    updateMonthLabel();
}

/* ---------- Özet ---------- */
function netWorthValue() {
    const def = userSettings.defaultCurrency;
    return cards.reduce((s, c) => s + convertCurrency(c.balance, c.currency, def), 0);
}
function totalDebtValue() {
    const def = userSettings.defaultCurrency;
    return debts.filter(d => !d.isPaid).reduce((s, d) => s + convertCurrency(d.amount, d.currency, def), 0);
}
function monthlyExpenseValue(date = new Date()) {
    const def = userSettings.defaultCurrency;
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
    return expenses
        .filter(e => { const dd = new Date(e.date); return dd >= start && dd <= end; })
        .reduce((s, e) => s + convertCurrency(e.amount, e.currency, def), 0);
}

function maskMoney(text) {
    return balanceHidden ? '••••••' : text;
}

function updateSummary() {
    const def = userSettings.defaultCurrency;
    $('#netWorth').textContent = maskMoney(formatCurrency(netWorthValue(), def));
    $('#homeDebt').textContent = maskMoney(formatCurrency(totalDebtValue(), def));
    $('#homeMonthly').textContent = maskMoney(formatCurrency(monthlyExpenseValue(), def));
}

/* ---------- Kartlar (carousel + flip) ---------- */
function renderCards() {
    const wrap = $('#cardCarousel');
    const tiles = cards.map(c => {
        const logo = BANK_IMG[c.bank] ? `<img src="${BANK_IMG[c.bank]}" alt="${c.bank}">` : '';
        const last4 = c.last4 ? `•••• ${c.last4}` : '•••• ••••';
        const typeLabel = c.cardType === 'credit' ? 'Kredi Kartı' : 'Banka Kartı';
        return `
        <div class="pay-card theme-${c.color}" data-id="${c.id}">
          <div class="pay-card-inner">
            <div class="pay-card-face front">
              <div class="pc-top">
                <span class="pc-label">${c.label}</span>
                <span class="pc-logo">${logo}</span>
              </div>
              <span class="pc-chip"></span>
              <div class="pc-number">${last4}</div>
              <div class="pc-bottom">
                <div>
                  <span class="pc-type">${typeLabel}</span>
                  <div class="pc-balance">${maskMoney(formatCurrency(c.balance, c.currency))}</div>
                </div>
                <span class="pc-cur">${c.currency}</span>
              </div>
            </div>
            <div class="pay-card-face back">
              <p class="pc-back-title">${c.label}</p>
              <div class="pc-actions">
                <button data-action="addmoney" data-id="${c.id}"><span class="material-icons">add</span>Para</button>
                <button data-action="transfer" data-id="${c.id}"><span class="material-icons">swap_horiz</span>Transfer</button>
                <button data-action="spend" data-id="${c.id}"><span class="material-icons">shopping_cart</span>Harcama</button>
                <button data-action="edit" data-id="${c.id}"><span class="material-icons">edit</span>Düzenle</button>
                <button data-action="delete" data-id="${c.id}" class="danger"><span class="material-icons">delete</span>Sil</button>
              </div>
            </div>
          </div>
        </div>`;
    }).join('');

    const addTile = `
        <button class="add-card-tile" data-action="addcard">
          <span class="material-icons">add</span>
          <span>Kart Ekle</span>
        </button>`;

    wrap.innerHTML = tiles + addTile;
}

/* ---------- Son hareketler ---------- */
function activityList() {
    const exp = expenses.map(e => ({
        type: 'expense', icon: CATEGORY_ICON[e.category] || 'shopping_cart',
        title: e.title || e.category, sub: e.cardName || '', date: e.date,
        amount: e.amount, currency: e.currency, sign: -1
    }));
    const tx = transactions.map(t => ({
        type: t.type,
        icon: t.type === 'income' ? 'south_west' : 'swap_horiz',
        title: t.title, sub: t.sub || '', date: t.date,
        amount: t.amount, currency: t.currency, sign: t.type === 'income' ? 1 : 0
    }));
    return [...exp, ...tx].sort((a, b) => new Date(b.date) - new Date(a.date));
}

function renderRecent() {
    const wrap = $('#recentActivity');
    const items = activityList().slice(0, 8);
    if (!items.length) { wrap.innerHTML = emptyState('receipt_long', 'Henüz hareket yok'); return; }
    wrap.innerHTML = items.map(it => {
        const cls = it.sign < 0 ? 'neg' : it.sign > 0 ? 'pos' : '';
        const prefix = it.sign < 0 ? '-' : it.sign > 0 ? '+' : '';
        return `
        <div class="row">
          <span class="row-icon"><span class="material-icons">${it.icon}</span></span>
          <div class="row-main">
            <span class="row-title">${it.title}</span>
            <span class="row-sub">${it.sub ? it.sub + ' · ' : ''}${formatDate(it.date)}</span>
          </div>
          <span class="row-amount ${cls}">${prefix}${formatCurrency(it.amount, it.currency)}</span>
        </div>`;
    }).join('');
}

/* ---------- Borçlar ---------- */
function debtBadge(d) {
    if (d.isPaid) return '<span class="badge ok">Ödendi</span>';
    if (!d.dueDate) return '';
    const days = Math.ceil((new Date(d.dueDate) - new Date()) / 86400000);
    if (days < 0) return '<span class="badge danger">Gecikti</span>';
    if (days === 0) return '<span class="badge warn">Bugün</span>';
    if (days <= 7) return `<span class="badge warn">${days} gün kaldı</span>`;
    return `<span class="badge">${formatDate(d.dueDate)}</span>`;
}

function renderDebts() {
    const q = ($('#debtSearch')?.value || '').toLowerCase();
    const list = debts
        .filter(d => d.title.toLowerCase().includes(q))
        .sort((a, b) => (a.isPaid - b.isPaid) || (new Date(a.dueDate || '2999') - new Date(b.dueDate || '2999')));
    const wrap = $('#debtsList');
    if (!list.length) { wrap.innerHTML = emptyState('request_quote', 'Borç bulunmuyor'); return; }
    wrap.innerHTML = list.map(d => {
        const inst = (d.installments && d.installments > 1)
            ? `<span class="row-sub">${d.installments} taksit · aylık ${formatCurrency(d.amount / d.installments, d.currency)}</span>` : '';
        return `
        <div class="card-row ${d.isPaid ? 'paid' : ''}" data-detail="debt" data-id="${d.id}">
          <div class="row-main">
            <span class="row-title">${d.title}</span>
            ${inst}
            <span class="row-badges">${debtBadge(d)}</span>
          </div>
          <span class="row-amount big">${formatCurrency(d.amount, d.currency)}</span>
        </div>`;
    }).join('');
}

/* ---------- Abonelikler ---------- */
function nextPaymentDate(sub) {
    const today = new Date();
    let base = (sub.lastPaymentDate && sub.isPaid) ? new Date(sub.lastPaymentDate) : new Date(sub.paymentDate);
    const next = new Date(base);
    while (next < today) {
        if (sub.period === 'yearly') next.setFullYear(next.getFullYear() + 1);
        else next.setMonth(next.getMonth() + 1);
    }
    return next;
}
function monthlyEquivalent(sub) {
    const m = sub.period === 'yearly' ? sub.amount / 12 : sub.amount;
    return convertCurrency(m, sub.currency, userSettings.defaultCurrency);
}

function renderSubs() {
    const def = userSettings.defaultCurrency;
    const monthly = subscriptions.reduce((s, x) => s + monthlyEquivalent(x), 0);
    $('#subMonthlyTotal').textContent = formatCurrency(monthly, def);
    $('#subYearlyTotal').textContent = formatCurrency(monthly * 12, def);

    const q = ($('#subSearch')?.value || '').toLowerCase();
    const list = subscriptions.filter(s => s.title.toLowerCase().includes(q));
    const wrap = $('#subsList');
    if (!list.length) { wrap.innerHTML = emptyState('autorenew', 'Abonelik bulunmuyor'); return; }
    wrap.innerHTML = list.map(s => {
        const np = nextPaymentDate(s);
        const days = Math.ceil((np - new Date()) / 86400000);
        let badge = `<span class="badge">${days} gün sonra</span>`;
        if (days <= 3) badge = `<span class="badge warn">${days <= 0 ? 'Bugün' : days + ' gün'}</span>`;
        return `
        <div class="card-row" data-detail="sub" data-id="${s.id}">
          <span class="row-icon"><span class="material-icons">${s.icon || 'subscriptions'}</span></span>
          <div class="row-main">
            <span class="row-title">${s.title}</span>
            <span class="row-sub">${s.period === 'yearly' ? 'Yıllık' : 'Aylık'} · ${formatDate(np)}</span>
            <span class="row-badges">${badge}</span>
          </div>
          <span class="row-amount big">${formatCurrency(s.amount, s.currency)}</span>
        </div>`;
    }).join('');
}

/* ---------- Harcamalar (donut + bütçe + liste) ---------- */
function monthExpenses(date = selectedDate) {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
    return expenses.filter(e => { const dd = new Date(e.date); return dd >= start && dd <= end; });
}

function updateMonthLabel() {
    $('#selectedMonth').textContent = selectedDate.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
}

function renderDonut(monthList) {
    const def = userSettings.defaultCurrency;
    const sums = {};
    monthList.forEach(e => {
        const cat = e.category || 'Diğer';
        sums[cat] = (sums[cat] || 0) + convertCurrency(e.amount, e.currency, def);
    });
    const total = Object.values(sums).reduce((a, b) => a + b, 0);
    const donut = $('#expenseDonut');
    const legend = $('#donutLegend');
    if (total <= 0) {
        donut.style.background = 'conic-gradient(var(--input-border) 0 100%)';
        donut.innerHTML = '<div class="donut-hole"><span>—</span></div>';
        legend.innerHTML = '<p class="muted-note">Bu ay harcama yok</p>';
        return;
    }
    let acc = 0;
    const segments = Object.entries(sums).sort((a, b) => b[1] - a[1]).map(([cat, val]) => {
        const start = (acc / total) * 100;
        acc += val;
        const end = (acc / total) * 100;
        return { cat, val, start, end, color: CATEGORY_COLOR[cat] || '#918872' };
    });
    donut.style.background = `conic-gradient(${segments.map(s => `${s.color} ${s.start}% ${s.end}%`).join(', ')})`;
    donut.innerHTML = `<div class="donut-hole"><span>${formatCurrency(total, def)}</span><small>toplam</small></div>`;
    legend.innerHTML = segments.map(s => `
        <div class="legend-item">
          <span class="legend-dot" style="background:${s.color}"></span>
          <span class="legend-cat">${s.cat}</span>
          <span class="legend-val">%${Math.round((s.val / total) * 100)}</span>
        </div>`).join('');
}

function renderBudget(monthList) {
    const def = userSettings.defaultCurrency;
    const card = $('#budgetCard');
    const budget = Number(userSettings.monthlyBudget) || 0;
    if (budget <= 0) { card.style.display = 'none'; return; }
    card.style.display = 'block';
    const spent = monthList.reduce((s, e) => s + convertCurrency(e.amount, e.currency, def), 0);
    const pct = Math.min(100, (spent / budget) * 100);
    const fill = $('#budgetFill');
    fill.style.width = pct + '%';
    fill.className = 'budget-fill' + (spent > budget ? ' over' : pct > 80 ? ' warn' : '');
    $('#budgetText').textContent = `${formatCurrency(spent, def)} / ${formatCurrency(budget, def)}`;
}

function renderExpenses() {
    const monthList = monthExpenses();
    renderDonut(monthList);
    renderBudget(monthList);
    const q = ($('#expenseSearch')?.value || '').toLowerCase();
    const list = monthList
        .filter(e => (e.title || e.category || '').toLowerCase().includes(q))
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    const wrap = $('#expensesList');
    if (!list.length) { wrap.innerHTML = emptyState('receipt_long', 'Bu ay harcama kaydı yok'); return; }
    wrap.innerHTML = list.map(e => `
        <div class="card-row" data-detail="expense" data-id="${e.id}">
          <span class="row-icon"><span class="material-icons">${CATEGORY_ICON[e.category] || 'shopping_cart'}</span></span>
          <div class="row-main">
            <span class="row-title">${e.title || e.category}</span>
            <span class="row-sub">${e.cardName ? e.cardName + ' · ' : ''}${formatDate(e.date)}</span>
          </div>
          <span class="row-amount neg big">-${formatCurrency(e.amount, e.currency)}</span>
        </div>`).join('');
}

function emptyState(icon, text) {
    return `<div class="empty"><span class="material-icons">${icon}</span><p>${text}</p></div>`;
}

/* ============================================================
   Modal yardımcıları
   ============================================================ */
function openModal(id) { $('#' + id).classList.add('active'); }
function closeModal(el) { el.classList.remove('active'); }
function closeAllModals() { $all('.modal.active').forEach(m => m.classList.remove('active')); }

/* Para birimi buton gruplarını oluştur */
function buildCurrencyGroups() {
    $all('[data-currency-group]').forEach(group => {
        group.innerHTML = CURRENCIES.map(c =>
            `<button type="button" class="cur-btn" data-cur="${c.code}"><b>${c.symbol}</b><span>${c.name}</span></button>`
        ).join('');
    });
}
const CUR_HIDDEN = { card: 'cardCurrency', debt: 'debtCurrency', sub: 'subCurrency', settings: 'defaultCurrency' };
function selectCurrency(group, code) {
    const wrap = $(`[data-currency-group="${group}"]`);
    $all('.cur-btn', wrap).forEach(b => b.classList.toggle('selected', b.dataset.cur === code));
    $('#' + CUR_HIDDEN[group]).value = code;
}

/* Renk seçenekleri */
function buildColorRow() {
    $('#colorRow').innerHTML = CARD_COLORS.map(c =>
        `<button type="button" class="color-dot theme-${c}" data-color="${c}" aria-label="${c}"></button>`
    ).join('');
}
function selectColor(color) {
    $all('#colorRow .color-dot').forEach(b => b.classList.toggle('selected', b.dataset.color === color));
    $('#cardColor').value = color;
}

/* Banka ızgarası */
function buildBankGrid() {
    $('#bankGrid').innerHTML = BANKS.map(b =>
        `<button type="button" class="bank-tile" data-bank="${b.name}"><img src="${b.img}" alt="${b.name}"></button>`
    ).join('');
}

/* Kategori ızgarası */
function buildCatGrid() {
    $('#catGrid').innerHTML = CATEGORIES.map(c =>
        `<button type="button" class="cat-tile" data-cat="${c.name}"><span class="material-icons">${c.icon}</span><span>${c.name}</span></button>`
    ).join('');
}

/* Abonelik ikonları */
function buildSubIcons() {
    $('#subIconRow').innerHTML = SUB_ICONS.map(i =>
        `<button type="button" class="icon-pick" data-icon="${i}"><span class="material-icons">${i}</span></button>`
    ).join('');
}

/* Tutar inputu: sadece rakam ve virgül */
function setupAmountInputs() {
    $all('.amount-input').forEach(input => {
        input.addEventListener('input', function () {
            let v = this.value.replace(/[^\d,]/g, '');
            const parts = v.split(',');
            if (parts.length > 2) v = parts[0] + ',' + parts[1];
            if (parts[1] && parts[1].length > 2) v = parts[0] + ',' + parts[1].slice(0, 2);
            this.value = v;
        });
    });
}

/* ============================================================
   Kart işlemleri
   ============================================================ */
function openCardModal(card) {
    editingCardId = card ? card.id : null;
    $('#cardModalTitle').textContent = card ? 'Kartı Düzenle' : 'Kart Ekle';
    $('#cardBalanceLabel').style.display = card ? 'none' : 'block';
    $('#cardBalance').parentElement.style.display = card ? 'none' : 'block';

    $('#cardForm').reset();
    const def = card ? card.color : 'terracotta';
    selectColor(def);
    selectCurrency('card', card ? card.currency : userSettings.defaultCurrency);
    $('#cardBank').value = card ? card.bank : '';
    $('#cardType').value = card ? card.cardType : '';
    $('#cardLabel').value = card ? card.label : '';
    $('#cardLast4').value = card ? card.last4 : '';

    $all('#bankGrid .bank-tile').forEach(b => b.classList.toggle('selected', card && b.dataset.bank === card.bank));
    $all('#cardTypeRow .chip').forEach(b => b.classList.toggle('selected', card && b.dataset.type === card.cardType));

    openModal('cardModal');
}

function submitCard(e) {
    e.preventDefault();
    const bank = $('#cardBank').value;
    const label = $('#cardLabel').value.trim();
    const cardType = $('#cardType').value;
    const currency = $('#cardCurrency').value;
    if (!bank) return toast('Lütfen banka seçin');
    if (!label) return toast('Lütfen kart adı girin');
    if (!cardType) return toast('Lütfen kart tipi seçin');
    if (!currency) return toast('Lütfen para birimi seçin');

    if (editingCardId) {
        const c = cards.find(x => x.id === editingCardId);
        if (c) {
            c.bank = bank; c.label = label; c.cardType = cardType;
            c.currency = currency; c.color = $('#cardColor').value;
            c.last4 = $('#cardLast4').value.replace(/\D/g, '').slice(0, 4);
        }
    } else {
        cards.push({
            id: Date.now(), bank, label, cardType, currency,
            color: $('#cardColor').value,
            last4: $('#cardLast4').value.replace(/\D/g, '').slice(0, 4),
            balance: parseAmount($('#cardBalance').value)
        });
    }
    saveData();
    renderAll();
    closeAllModals();
}

function deleteCard(id) {
    if (!confirm('Bu kartı silmek istediğinize emin misiniz?')) return;
    cards = cards.filter(c => c.id !== id);
    saveData();
    renderAll();
}

function openAddMoney(id) {
    activeCardId = id;
    $('#addMoneyAmount').value = '';
    openModal('addMoneyModal');
}
function confirmAddMoney() {
    const amount = parseAmount($('#addMoneyAmount').value);
    const c = cards.find(x => x.id === activeCardId);
    if (!c || amount <= 0) return toast('Geçerli bir tutar girin');
    c.balance += amount;
    transactions.push({ id: Date.now(), type: 'income', title: 'Para yükleme', sub: c.label, amount, currency: c.currency, date: new Date().toISOString() });
    saveData(); renderAll(); closeAllModals();
    toast('Bakiye güncellendi');
}

function openTransfer(id) {
    activeCardId = id;
    $('#transferAmount').value = '';
    $('#transferTarget').innerHTML = cards.filter(c => c.id !== id)
        .map(c => `<option value="${c.id}">${c.label} (${formatCurrency(c.balance, c.currency)})</option>`).join('');
    if (cards.length < 2) return toast('Transfer için en az 2 kart gerekli');
    openModal('transferModal');
}
function confirmTransfer() {
    const amount = parseAmount($('#transferAmount').value);
    const src = cards.find(c => c.id === activeCardId);
    const dst = cards.find(c => c.id === Number($('#transferTarget').value));
    if (!src || !dst || amount <= 0) return toast('Geçerli bir tutar girin');
    if (src.balance < amount) return toast('Yetersiz bakiye');
    src.balance -= amount;
    const converted = convertCurrency(amount, src.currency, dst.currency);
    dst.balance += converted;
    transactions.push({ id: Date.now(), type: 'transfer', title: `${src.label} → ${dst.label}`, sub: 'Transfer', amount, currency: src.currency, date: new Date().toISOString() });
    saveData(); renderAll(); closeAllModals();
    toast('Transfer tamamlandı');
}

/* ============================================================
   Borç / Abonelik / Harcama formları
   ============================================================ */
function submitDebt(e) {
    e.preventDefault();
    const currency = $('#debtCurrency').value;
    if (!currency) return toast('Para birimi seçin');
    debts.push({
        id: Date.now(),
        title: $('#debtTitle').value.trim(),
        amount: parseAmount($('#debtAmount').value),
        currency,
        installments: Math.max(1, Number($('#debtInstallments').value) || 1),
        dueDate: $('#debtDueDate').value || null,
        isPaid: $('#debtIsPaid').checked
    });
    saveData(); renderAll(); closeAllModals();
}

function submitSub(e) {
    e.preventDefault();
    const currency = $('#subCurrency').value;
    if (!currency) return toast('Para birimi seçin');
    subscriptions.push({
        id: Date.now(),
        title: $('#subTitle').value.trim(),
        icon: $('#subIcon').value || 'subscriptions',
        amount: parseAmount($('#subAmount').value),
        currency,
        period: $('#subPeriod').value,
        paymentDate: $('#subDate').value,
        lastPaymentDate: null,
        isPaid: false
    });
    saveData(); renderAll(); closeAllModals();
}

function submitExpense(e) {
    e.preventDefault();
    const category = $('#expenseCategory').value;
    const amount = parseAmount($('#expenseAmount').value);
    const cardId = Number($('#expenseCard').value);
    const card = cards.find(c => c.id === cardId);
    if (!category) return toast('Kategori seçin');
    if (amount <= 0) return toast('Geçerli tutar girin');
    if (!card) return toast('Kart seçin');
    if (card.balance < amount) return toast('Kartta yeterli bakiye yok');
    card.balance -= amount;
    expenses.push({
        id: Date.now(), title: category, category, amount,
        currency: card.currency, date: new Date().toISOString(),
        cardId: card.id, cardName: card.label
    });
    saveData(); renderAll(); closeAllModals();
}

function openExpenseModal(preCardId) {
    $('#expenseForm').reset();
    $('#expenseCategory').value = '';
    $all('#catGrid .cat-tile').forEach(b => b.classList.remove('selected'));
    $('#expenseCard').innerHTML = '<option value="">Kart seçin</option>' +
        cards.map(c => `<option value="${c.id}" ${c.id === preCardId ? 'selected' : ''}>${c.label} (${formatCurrency(c.balance, c.currency)})</option>`).join('');
    openModal('expenseModal');
}

/* ============================================================
   Detay görünümü (borç / abonelik / harcama)
   ============================================================ */
function openDetail(type, id) {
    const titleEl = $('#itemDetailTitle');
    const body = $('#itemDetailBody');
    if (type === 'debt') {
        const d = debts.find(x => x.id === id); if (!d) return;
        titleEl.textContent = d.title;
        body.innerHTML = `
          <div class="detail-amount">${formatCurrency(d.amount, d.currency)}</div>
          ${d.installments > 1 ? `<p class="detail-line">${d.installments} taksit · aylık ${formatCurrency(d.amount / d.installments, d.currency)}</p>` : ''}
          ${d.dueDate ? `<p class="detail-line">Son ödeme: ${formatDate(d.dueDate)}</p>` : ''}
          <label class="checkbox"><input type="checkbox" id="detailDebtPaid" ${d.isPaid ? 'checked' : ''}> <span>Ödendi olarak işaretle</span></label>
          <div class="modal-actions">
            <button type="button" class="btn-danger" data-del="debt" data-id="${d.id}"><span class="material-icons">delete</span> Sil</button>
          </div>`;
        $('#detailDebtPaid').addEventListener('change', (ev) => {
            d.isPaid = ev.target.checked; saveData(); renderAll();
        });
    } else if (type === 'sub') {
        const s = subscriptions.find(x => x.id === id); if (!s) return;
        const np = nextPaymentDate(s);
        titleEl.textContent = s.title;
        body.innerHTML = `
          <div class="detail-amount">${formatCurrency(s.amount, s.currency)}</div>
          <p class="detail-line">${s.period === 'yearly' ? 'Yıllık' : 'Aylık'} ödeme</p>
          <p class="detail-line">Sonraki ödeme: ${formatDate(np)}</p>
          <p class="detail-line">Yıllık maliyet: ${formatCurrency(monthlyEquivalent(s) * 12, userSettings.defaultCurrency)}</p>
          <label class="checkbox"><input type="checkbox" id="detailSubPaid" ${s.isPaid ? 'checked' : ''}> <span>Bu ay ödendi</span></label>
          <div class="modal-actions">
            <button type="button" class="btn-danger" data-del="sub" data-id="${s.id}"><span class="material-icons">delete</span> Sil</button>
          </div>`;
        $('#detailSubPaid').addEventListener('change', (ev) => {
            s.isPaid = ev.target.checked;
            s.lastPaymentDate = ev.target.checked ? new Date().toISOString() : s.lastPaymentDate;
            saveData(); renderAll();
        });
    } else if (type === 'expense') {
        const e = expenses.find(x => x.id === id); if (!e) return;
        titleEl.textContent = e.title || e.category;
        body.innerHTML = `
          <div class="detail-amount neg">-${formatCurrency(e.amount, e.currency)}</div>
          <p class="detail-line">${e.cardName || ''}</p>
          <p class="detail-line">${formatDate(e.date)}</p>
          <div class="modal-actions">
            <button type="button" class="btn-danger" data-del="expense" data-id="${e.id}"><span class="material-icons">delete</span> Sil</button>
          </div>`;
    }
    openModal('itemDetailModal');
}

function deleteItem(type, id) {
    if (!confirm('Silmek istediğinize emin misiniz?')) return;
    if (type === 'debt') debts = debts.filter(d => d.id !== id);
    else if (type === 'sub') subscriptions = subscriptions.filter(s => s.id !== id);
    else if (type === 'expense') {
        const e = expenses.find(x => x.id === id);
        if (e && e.cardId) { const c = cards.find(x => x.id === e.cardId); if (c) c.balance += e.amount; }
        expenses = expenses.filter(x => x.id !== id);
    }
    saveData(); renderAll(); closeAllModals();
}

/* ============================================================
   Olay bağlama
   ============================================================ */
function wireEvents() {
    // Tema / çıkış / ayarlar
    $('#themeToggle').addEventListener('click', toggleTheme);
    $('#logoutBtn').addEventListener('click', () => {
        if (confirm('Çıkış yapmak istediğinize emin misiniz?')) {
            firebase.auth().signOut().then(() => { localStorage.clear(); location.href = 'index.html'; });
        }
    });
    $('#settingsBtn').addEventListener('click', () => {
        selectCurrency('settings', userSettings.defaultCurrency);
        $('#monthlyBudget').value = userSettings.monthlyBudget ? String(userSettings.monthlyBudget).replace('.', ',') : '';
        openModal('settingsModal');
    });
    $('#toggleBalance').addEventListener('click', () => {
        balanceHidden = !balanceHidden;
        $('#toggleBalance').querySelector('.material-icons').textContent = balanceHidden ? 'visibility_off' : 'visibility';
        renderCards(); updateSummary();
    });

    // Alt navigasyon (tab)
    $all('.tab-btn').forEach(btn => btn.addEventListener('click', () => {
        $all('.tab-btn').forEach(b => b.classList.remove('active'));
        $all('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        $('#' + btn.dataset.tab).classList.add('active');
        $('.app-main').scrollTop = 0;
        window.scrollTo(0, 0);
    }));

    // Ekle butonları
    $('#addCardBtn').addEventListener('click', () => openCardModal(null));
    $('#addDebtBtn').addEventListener('click', () => { $('#debtForm').reset(); $('#debtCurrency').value=''; selectCurrency('debt', userSettings.defaultCurrency); openModal('debtModal'); });
    $('#addSubscriptionBtn').addEventListener('click', () => {
        $('#subForm').reset(); $('#subCurrency').value=''; selectCurrency('sub', userSettings.defaultCurrency);
        $('#subPeriod').value = 'monthly'; $all('#subPeriodRow .chip').forEach((c,i)=>c.classList.toggle('selected', i===0));
        $('#subIcon').value = 'subscriptions'; $all('#subIconRow .icon-pick').forEach((c,i)=>c.classList.toggle('selected', i===0));
        openModal('subModal');
    });
    $('#addExpenseBtn').addEventListener('click', () => openExpenseModal());

    // Modal kapatma (close-btn / backdrop / data-close)
    document.addEventListener('click', (e) => {
        if (e.target.closest('[data-close]')) { closeAllModals(); return; }
        if (e.target.classList.contains('modal')) closeModal(e.target);
    });

    // Carousel (flip + aksiyonlar)
    $('#cardCarousel').addEventListener('click', (e) => {
        const actionBtn = e.target.closest('[data-action]');
        if (actionBtn) {
            const action = actionBtn.dataset.action;
            const id = Number(actionBtn.dataset.id);
            if (action === 'addcard') return openCardModal(null);
            if (action === 'addmoney') return openAddMoney(id);
            if (action === 'transfer') return openTransfer(id);
            if (action === 'spend') return openExpenseModal(id);
            if (action === 'edit') return openCardModal(cards.find(c => c.id === id));
            if (action === 'delete') return deleteCard(id);
        }
        const card = e.target.closest('.pay-card');
        if (card) card.classList.toggle('flipped');
    });

    // Liste satırı → detay
    document.addEventListener('click', (e) => {
        const row = e.target.closest('[data-detail]');
        if (row) openDetail(row.dataset.detail, Number(row.dataset.id));
        const del = e.target.closest('[data-del]');
        if (del) deleteItem(del.dataset.del, Number(del.dataset.id));
    });

    // Para birimi / renk / banka / tip / kategori / ikon / periyot seçimleri (delegasyon)
    document.addEventListener('click', (e) => {
        const cur = e.target.closest('.cur-btn');
        if (cur) { const g = cur.closest('[data-currency-group]').dataset.currencyGroup; selectCurrency(g, cur.dataset.cur); }
        const color = e.target.closest('.color-dot');
        if (color) selectColor(color.dataset.color);
        const bank = e.target.closest('.bank-tile');
        if (bank) { $all('#bankGrid .bank-tile').forEach(b=>b.classList.remove('selected')); bank.classList.add('selected'); $('#cardBank').value = bank.dataset.bank; }
        const ctype = e.target.closest('#cardTypeRow .chip');
        if (ctype) { $all('#cardTypeRow .chip').forEach(b=>b.classList.remove('selected')); ctype.classList.add('selected'); $('#cardType').value = ctype.dataset.type; }
        const cat = e.target.closest('.cat-tile');
        if (cat) { $all('#catGrid .cat-tile').forEach(b=>b.classList.remove('selected')); cat.classList.add('selected'); $('#expenseCategory').value = cat.dataset.cat; }
        const sicon = e.target.closest('.icon-pick');
        if (sicon) { $all('#subIconRow .icon-pick').forEach(b=>b.classList.remove('selected')); sicon.classList.add('selected'); $('#subIcon').value = sicon.dataset.icon; }
        const per = e.target.closest('#subPeriodRow .chip');
        if (per) { $all('#subPeriodRow .chip').forEach(b=>b.classList.remove('selected')); per.classList.add('selected'); $('#subPeriod').value = per.dataset.period; }
    });

    // Form gönderimleri
    $('#cardForm').addEventListener('submit', submitCard);
    $('#debtForm').addEventListener('submit', submitDebt);
    $('#subForm').addEventListener('submit', submitSub);
    $('#expenseForm').addEventListener('submit', submitExpense);
    $('#addMoneyConfirm').addEventListener('click', confirmAddMoney);
    $('#transferConfirm').addEventListener('click', confirmTransfer);
    $('#settingsForm').addEventListener('submit', (e) => {
        e.preventDefault();
        userSettings.defaultCurrency = $('#defaultCurrency').value || 'TRY';
        userSettings.monthlyBudget = parseAmount($('#monthlyBudget').value);
        saveData(); renderAll(); closeAllModals();
        toast('Ayarlar kaydedildi');
    });

    // Aramalar
    $('#debtSearch').addEventListener('input', renderDebts);
    $('#subSearch').addEventListener('input', renderSubs);
    $('#expenseSearch').addEventListener('input', renderExpenses);

    // Ay gezinme
    $('#prevMonth').addEventListener('click', () => { selectedDate.setMonth(selectedDate.getMonth() - 1); updateMonthLabel(); renderExpenses(); });
    $('#nextMonth').addEventListener('click', () => { selectedDate.setMonth(selectedDate.getMonth() + 1); updateMonthLabel(); renderExpenses(); });
}

/* ============================================================
   Başlangıç
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    buildCurrencyGroups();
    buildColorRow();
    buildBankGrid();
    buildCatGrid();
    buildSubIcons();
    setupAmountInputs();
    updateMonthLabel();
    wireEvents();
    renderAll();

    await updateExchangeRates();
    setInterval(updateExchangeRates, 3600000);
    renderAll();

    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            await loadData();
        } else {
            cards = []; debts = []; subscriptions = []; expenses = []; transactions = [];
            location.href = 'index.html';
        }
    });
});
