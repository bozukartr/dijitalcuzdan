/* ============================================================
   Dijital Cüzdan — uygulama mantığı
   ============================================================ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const CATS = [
    { key: 'Alışveriş', icon: 'shopping_bag', bg: '#DEF7E6', fg: '#2FBF71' },
    { key: 'Yemek', icon: 'restaurant', bg: '#FFEAD2', fg: '#F2994A' },
    { key: 'Ulaşım', icon: 'directions_car', bg: '#EBE4FB', fg: '#9B6BE3' },
    { key: 'Ev', icon: 'home', bg: '#DCEBFE', fg: '#4A90E2' },
    { key: 'Eğlence', icon: 'sports_esports', bg: '#FCE0EE', fg: '#E36BA5' },
    { key: 'Sağlık', icon: 'favorite', bg: '#FBE0E0', fg: '#EB5757' },
    { key: 'Fatura', icon: 'receipt_long', bg: '#D6F2F0', fg: '#3BB3A8' },
    { key: 'Diğer', icon: 'more_horiz', bg: '#ECECEF', fg: '#9A9AA2' }
];
const CAT_MAP = Object.fromEntries(CATS.map(c => [c.key, c]));
const INCOME_CAT = { key: 'Gelir', icon: 'trending_up', bg: '#DEF7E6', fg: '#2FBF71' };
const TRANSFER_CAT = { key: 'Transfer', icon: 'swap_horiz', bg: '#ECECEF', fg: '#6B7280' };
const ACCOUNT_COLORS = ['#2FBF71', '#4A90E2', '#9B6BE3', '#F2994A', '#EB5757', '#1B1C1F'];
const ACCOUNT_ICONS = { 'Banka': 'account_balance', 'Kredi Kartı': 'credit_card', 'Nakit': 'payments' };
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

const CURRENCIES = {
    TRY: { sym: '₺', icon: 'account_balance_wallet', bg: '#DEF7E6', fg: '#2FBF71' },
    USD: { sym: '$', icon: 'attach_money', bg: '#EBE4FB', fg: '#7C5CE0' },
    EUR: { sym: '€', icon: 'euro', bg: '#FDEFD9', fg: '#F2994A' },
    GBP: { sym: '£', icon: 'currency_pound', bg: '#E2EEFD', fg: '#4A90E2' }
};
const CARD_THEMES = ['black', 'purple', 'white', 'navy', 'green', 'rose'];
const NETWORKS = ['visa', 'mastercard', 'troy', 'amex'];
let ratesTRY = { TRY: 1, USD: 32.5, EUR: 35.5, GBP: 41 }; // canlı kur gelene kadar varsayılan

/* ---------- Durum ---------- */
let cards = [];
let accounts = [];
let transactions = [];
let goals = [];
let settings = { monthlyLimit: 0, displayName: '' };
let balanceHidden = false;
let anDate = new Date();           // analizler ay seçimi
let txType = 'expense';
let accColor = ACCOUNT_COLORS[0];
let accType = 'Banka';
let accCurrency = 'TRY';
let cardTheme = 'black';
let cardNetwork = 'visa';
let editingCardId = null;
let activeCardIdx = 0;
let openAccountId = null;
let openGoalId = null;
let editingTxId = null;

/* ---------- Yardımcılar ---------- */
function nfmt(n) { return (Number(n) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmt(n) { return '₺' + nfmt(n); }
function fmtC(n, ccy) { const c = CURRENCIES[ccy] || CURRENCIES.TRY; return c.sym + nfmt(n); }
function toTRY(n, ccy) { return (Number(n) || 0) * (ratesTRY[ccy] || 1); }
function mask(text) { return balanceHidden ? '••••••' : text; }

async function updateRates() {
    try {
        const res = await fetch('https://api.exchangerate-api.com/v4/latest/TRY');
        const d = await res.json();
        ratesTRY = {
            TRY: 1,
            USD: 1 / d.rates.USD,
            EUR: 1 / d.rates.EUR,
            GBP: 1 / d.rates.GBP
        };
        renderWallet(); renderHome();
    } catch (e) { console.warn('Kur alınamadı, varsayılan kullanılıyor'); }
}
function parseNum(v) {
    if (typeof v !== 'string') return Number(v) || 0;
    return parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0;
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
function sameMonth(dateStr, ref) {
    const d = new Date(dateStr);
    return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}
function shortDate(dateStr) {
    const d = new Date(dateStr); const t = new Date();
    if (d.toDateString() === t.toDateString()) return 'Bugün';
    const y = new Date(t); y.setDate(t.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return 'Dün';
    return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
function toast(msg) {
    let t = $('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2200);
}
function catOf(key) { return CAT_MAP[key] || INCOME_CAT; }

/* ---------- Tema ---------- */
function initTheme() { document.documentElement.setAttribute('data-theme', localStorage.getItem('theme') || 'light'); }
function toggleTheme() {
    const n = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', n); localStorage.setItem('theme', n);
}

/* ---------- Firestore ---------- */
async function save() {
    const u = firebase.auth().currentUser; if (!u) return;
    try {
        await firebase.firestore().collection('users').doc(u.uid).set({
            cards, accounts, transactions, goals, settings,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (e) { console.error(e); toast('Kaydedilemedi'); }
}
async function load() {
    const u = firebase.auth().currentUser; if (!u) return;
    try {
        const doc = await firebase.firestore().collection('users').doc(u.uid).get();
        const d = doc.exists ? doc.data() : {};
        cards = d.cards || [];
        accounts = (d.accounts || []).map(a => Object.assign({ currency: 'TRY' }, a));
        transactions = (d.transactions || []).map(t => Object.assign({ currency: 'TRY' }, t));
        goals = d.goals || [];
        settings = Object.assign({ monthlyLimit: 0, displayName: '' }, d.settings || {});
    } catch (e) { console.error(e); }
    renderAll();
}

/* ---------- Hesaplamalar (hepsi TRY'ye çevrilir) ---------- */
const totalBalance = () => accounts.reduce((s, a) => s + toTRY(a.balance, a.currency || 'TRY'), 0);
function monthExpense(ref = new Date()) {
    return transactions.filter(t => t.type === 'expense' && sameMonth(t.date, ref)).reduce((s, t) => s + toTRY(t.amount, t.currency || 'TRY'), 0);
}
function monthIncome(ref = new Date()) {
    return transactions.filter(t => t.type === 'income' && sameMonth(t.date, ref)).reduce((s, t) => s + toTRY(t.amount, t.currency || 'TRY'), 0);
}

/* ============================================================
   Render
   ============================================================ */
function renderAll() {
    renderHeader();
    renderHome();
    renderAnalytics();
    renderGoals();
    renderWallet();
    renderNotifBadge();
}

function renderHeader() {
    const name = settings.displayName || (firebase.auth().currentUser && firebase.auth().currentUser.displayName) || 'Kullanıcı';
    $('#greeting').innerHTML = `Merhaba, ${name} 👋`;
    const d = new Date();
    $('#todayDate').textContent = `Bugün ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function renderHome() {
    $('#totalBalance').textContent = mask(fmt(totalBalance()));

    // Trend
    const net = monthIncome() - monthExpense();
    const prev = totalBalance() - net;
    const pct = prev > 0 ? (net / prev) * 100 : (net !== 0 ? 100 : 0);
    const trend = $('#trend');
    const up = net >= 0;
    trend.className = 'bc-trend' + (up ? '' : ' down');
    trend.innerHTML = `<span class="material-icons" style="font-size:18px">${up ? 'arrow_upward' : 'arrow_downward'}</span> %${Math.abs(pct).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} bu aya göre`;

    // Aylık harcama + ring
    const spend = monthExpense();
    const limit = Number(settings.monthlyLimit) || 0;
    $('#monthSpend').textContent = mask(fmt(spend));
    $('#monthLimit').textContent = limit > 0 ? `${fmt(limit)} limit` : 'limit ayarla';
    const C = 251.2;
    const ratio = limit > 0 ? Math.min(1, spend / limit) : 0;
    $('#ringFill').style.strokeDashoffset = C * (1 - ratio);
    $('#ringFill').style.stroke = spend > limit && limit > 0 ? 'var(--red)' : 'var(--green)';
    $('#ringLabel').textContent = limit > 0 ? '%' + Math.round(ratio * 100) : '—';

    // Kategori dağılımı
    renderCatScroll();

    // Son işlemler
    renderTxList($('#recentTx'), transactions.slice().sort(byDate).slice(0, 4), true);
}

function byDate(a, b) { return new Date(b.date) - new Date(a.date) || b.id - a.id; }

function renderCatScroll() {
    const ref = new Date();
    const exp = transactions.filter(t => t.type === 'expense' && sameMonth(t.date, ref));
    const total = exp.reduce((s, t) => s + toTRY(t.amount, t.currency || 'TRY'), 0);
    const sums = {};
    exp.forEach(t => { sums[t.category] = (sums[t.category] || 0) + toTRY(t.amount, t.currency || 'TRY'); });
    const list = Object.entries(sums).sort((a, b) => b[1] - a[1]);
    const wrap = $('#catScroll');
    if (!list.length) { wrap.innerHTML = `<div class="empty" style="width:100%"><span class="material-icons">donut_large</span><p>Bu ay harcama yok</p></div>`; return; }
    wrap.innerHTML = list.map(([key, val]) => {
        const c = catOf(key);
        const pct = total > 0 ? Math.round((val / total) * 100) : 0;
        return `
        <div class="cat-item">
          <div class="cat-ic" style="background:${c.bg};color:${c.fg}"><span class="material-icons">${c.icon}</span></div>
          <div class="cat-name">${key}</div>
          <div class="cat-amt">${fmt(val)}</div>
          <div class="cat-pct" style="color:${c.fg}">%${pct}</div>
        </div>`;
    }).join('');
}

function txRow(t) {
    const c = t.type === 'income' ? INCOME_CAT : t.type === 'transfer' ? TRANSFER_CAT : catOf(t.category);
    const title = t.note || (t.type === 'income' ? 'Gelir' : t.type === 'transfer' ? 'Transfer' : t.category);
    const sub = t.type === 'transfer' ? `${t.accountName} → ${t.targetName}` : (t.type === 'income' ? 'Gelir' : t.category);
    const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '−' : '';
    return `
        <div class="tx" data-tx="${t.id}">
          <div class="tx-ic" style="background:${c.bg};color:${c.fg}"><span class="material-icons">${c.icon}</span></div>
          <div class="tx-main">
            <div class="tx-title">${title}</div>
            <div class="tx-cat">${sub}</div>
          </div>
          <div class="tx-right">
            <div class="tx-amt ${t.type}">${sign}${fmtC(t.amount, t.currency || 'TRY')}</div>
            <div class="tx-date">${shortDate(t.date)}</div>
          </div>
        </div>`;
}

function renderTxList(wrap, list) {
    if (!list.length) { wrap.innerHTML = `<div class="empty"><span class="material-icons">receipt_long</span><p>Henüz işlem yok</p></div>`; return; }
    wrap.innerHTML = list.map(txRow).join('');
}

function renderTxGroups(wrap, list) {
    if (!list.length) { wrap.innerHTML = `<div class="empty"><span class="material-icons">receipt_long</span><p>İşlem bulunamadı</p></div>`; return; }
    const groups = [];
    list.forEach(t => {
        const label = shortDate(t.date);
        let g = groups.find(x => x.label === label);
        if (!g) { g = { label, items: [] }; groups.push(g); }
        g.items.push(t);
    });
    wrap.innerHTML = groups.map(g =>
        `<div class="tx-group-label">${g.label}</div><div class="tx-list">${g.items.map(txRow).join('')}</div>`
    ).join('');
}

function renderAnalytics() {
    $('#anMonth').textContent = `${MONTHS[anDate.getMonth()]} ${anDate.getFullYear()}`;
    const income = monthIncome(anDate);
    const expense = monthExpense(anDate);
    const net = income - expense;
    $('#anIncome').textContent = fmt(income);
    $('#anExpenseMini').textContent = fmt(expense);
    const netEl = $('#anNet');
    netEl.textContent = (net >= 0 ? '+' : '−') + fmt(Math.abs(net));
    netEl.className = 'trio-val ' + (net >= 0 ? 'income' : 'neg');

    // Donut: kategori harcamaları
    const exp = transactions.filter(t => t.type === 'expense' && sameMonth(t.date, anDate));
    const sums = {};
    exp.forEach(t => { sums[t.category] = (sums[t.category] || 0) + toTRY(t.amount, t.currency || 'TRY'); });
    const segs = Object.entries(sums).sort((a, b) => b[1] - a[1]);
    const donut = $('#anDonut');
    const legend = $('#anLegend');
    $('#anExpense').textContent = fmt(expense);
    if (!expense) {
        donut.style.background = 'conic-gradient(var(--line) 0 100%)';
        legend.innerHTML = `<p class="sub-num">Bu ay harcama kaydı yok.</p>`;
    } else {
        let acc = 0;
        const parts = segs.map(([key, val]) => {
            const c = catOf(key); const s = (acc / expense) * 100; acc += val; const e = (acc / expense) * 100;
            return { key, val, c, s, e };
        });
        donut.style.background = `conic-gradient(${parts.map(p => `${p.c.fg} ${p.s}% ${p.e}%`).join(', ')})`;
        legend.innerHTML = parts.map(p =>
            `<div class="legend-item"><span class="legend-dot" style="background:${p.c.fg}"></span><span class="legend-name">${p.key}</span><span class="legend-pct">%${Math.round((p.val / expense) * 100)}</span></div>`
        ).join('');
    }

    // İşlem listesi (arama + tarih gruplu)
    const q = ($('#anSearch')?.value || '').toLowerCase();
    const monthTx = transactions.filter(t => sameMonth(t.date, anDate))
        .filter(t => ((t.note || '') + ' ' + (t.category || '') + (t.type === 'income' ? ' gelir' : '') + (t.type === 'transfer' ? ' transfer' : '')).toLowerCase().includes(q))
        .sort(byDate);
    renderTxGroups($('#allTx'), monthTx);
}

function renderGoals() {
    const wrap = $('#goalsList');
    if (!goals.length) { wrap.innerHTML = `<div class="empty"><span class="material-icons">flag</span><p>Henüz hedef yok. Bir tasarruf hedefi oluştur!</p></div>`; return; }
    wrap.innerHTML = goals.map(g => {
        const pct = g.target > 0 ? Math.min(100, (g.saved / g.target) * 100) : 0;
        return `
        <div class="goal" data-goal="${g.id}">
          <div class="goal-top">
            <span class="goal-name">${g.name}</span>
            <span class="goal-vals"><b>${fmt(g.saved)}</b> / ${fmt(g.target)}</span>
          </div>
          <div class="bar"><span style="width:${pct}%"></span></div>
          <div class="goal-vals">%${Math.round(pct)} tamamlandı</div>
        </div>`;
    }).join('');
}

/* ---------- Gerçekçi kart görseli ---------- */
function networkMark(net) {
    if (net === 'mastercard') return `<span class="net-mc"><i></i><i></i></span>`;
    if (net === 'visa') return `<span class="net-visa">VISA</span>`;
    if (net === 'troy') return `<span class="net-troy">troy</span>`;
    if (net === 'amex') return `<span class="net-amex">AMEX</span>`;
    return '';
}
function cardEl(c) {
    const acc = accounts.find(a => a.id === c.accountId);
    const accLabel = acc ? `${acc.name} · ${mask(fmtC(acc.balance, acc.currency))}` : 'Hesap bağlı değil';
    return `
      <div class="rcard-wrap" data-card-id="${c.id}">
        <div class="rcard-inner">
          <div class="rcard front theme-${c.theme}">
            <div class="rc-blob"></div>
            <div class="rc-row1">
              <span class="rc-bank">${c.bank}</span>
              <span class="rc-net">${networkMark(c.network)}</span>
            </div>
            <div class="rc-row2">
              <span class="rc-chip"></span>
              <span class="rc-nfc"><svg viewBox="0 0 24 24" fill="none"><path d="M6 8c2.5 2.2 2.5 5.8 0 8M10 6c4 3.4 4 8.6 0 12M14 4c5.5 4.6 5.5 11.4 0 16" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></span>
            </div>
            <div class="rc-number">•••• ${c.last4 || '••••'}</div>
            <div class="rc-holder">${(c.holder || '').toUpperCase()}</div>
          </div>
          <div class="rcard back theme-${c.theme}">
            <div class="rc-blob"></div>
            <p class="rc-back-acc">${accLabel}</p>
            <div class="rc-actions">
              <button data-cact="load"><span class="material-icons">add</span>Para Ekle</button>
              <button data-cact="spend"><span class="material-icons">shopping_cart</span>Harcama</button>
              <button data-cact="transfer"><span class="material-icons">swap_horiz</span>Transfer</button>
              <button data-cact="edit"><span class="material-icons">edit</span>Düzenle</button>
              <button data-cact="delete" class="danger"><span class="material-icons">delete</span>Sil</button>
            </div>
          </div>
        </div>
      </div>`;
}
function renderWallet() {
    // Kartlar
    const carousel = $('#cardCarousel');
    const dots = $('#cardDots');
    if (carousel) {
        carousel.innerHTML = cards.map(cardEl).join('') +
            `<button class="rcard-add" data-add-card><span class="material-icons">add</span><span>Kart Ekle</span></button>`;
        dots.innerHTML = cards.map((c, i) => `<span class="card-dot${i === activeCardIdx ? ' on' : ''}"></span>`).join('');
    }

    // Hesaplar (çoklu para birimi + TL karşılığı)
    $('#walletTotal').textContent = mask(fmt(totalBalance()));
    const wrap = $('#accountsList');
    if (!accounts.length) {
        wrap.innerHTML = `<div class="empty"><span class="material-icons">account_balance_wallet</span><p>Henüz hesap yok. İlk hesabını ekle!</p></div>`;
    } else {
        wrap.innerHTML = accounts.map(a => {
            const cu = CURRENCIES[a.currency] || CURRENCIES.TRY;
            const eq = a.currency !== 'TRY' ? `<div class="acct-eq">${fmt(toTRY(a.balance, a.currency))}</div>` : '';
            return `
            <div class="acct" data-acct="${a.id}">
              <div class="acct-left">
                <div class="acct-dot" style="background:${cu.bg};color:${cu.fg}"><span class="material-icons">${cu.icon}</span></div>
                <div><div class="acct-name">${a.name}</div><div class="acct-type">${a.bank || a.type}</div></div>
              </div>
              <div class="acct-right">
                <div class="acct-bal">${mask(fmtC(a.balance, a.currency))}</div>
                ${balanceHidden ? '' : eq}
              </div>
            </div>`;
        }).join('');
    }

    // Son işlemler
    renderTxList($('#walletRecent'), transactions.slice().sort(byDate).slice(0, 4));
}

/* ============================================================
   Modal yardımcıları
   ============================================================ */
function openModal(id) { $('#' + id).classList.add('active'); }
function closeAll() { $$('.modal.active').forEach(m => m.classList.remove('active')); }

function buildCatPicker() {
    $('#txCatPicker').innerHTML = CATS.map(c => `
        <button type="button" class="cat-opt" data-cat="${c.key}">
          <span class="cdot" style="background:${c.bg};color:${c.fg}"><span class="material-icons">${c.icon}</span></span>
          ${c.key}
        </button>`).join('');
}
function buildAccColors() {
    $('#accColors').innerHTML = ACCOUNT_COLORS.map(c =>
        `<button type="button" class="color-dot" data-acc-color="${c}" style="background:${c};width:38px;height:38px;border-radius:50%;border:3px solid transparent;cursor:pointer"></button>`
    ).join('');
}
function buildCardPickers() {
    const tr = $('#cardThemeRow');
    if (tr) tr.innerHTML = CARD_THEMES.map(t => `<button type="button" class="ct-dot theme-${t}${t === 'black' ? ' selected' : ''}" data-theme="${t}" aria-label="${t}"></button>`).join('');
    const nr = $('#cardNetRow');
    if (nr) nr.innerHTML = NETWORKS.map(n => `<button type="button" class="chip${n === 'visa' ? ' active' : ''}" data-net="${n}">${n.toUpperCase()}</button>`).join('');
}
function fillAccountSelects() {
    const opts = accounts.map(a => `<option value="${a.id}">${a.name} (${fmtC(a.balance, a.currency)})</option>`).join('');
    $('#txAccount').innerHTML = opts;
    $('#txTarget').innerHTML = opts;
}

/* ============================================================
   İşlem ekle / düzenle / transfer
   ============================================================ */
function convert(n, from, to) { return toTRY(n, from) / (ratesTRY[to] || 1); }
function applyTx(t) {
    const from = accounts.find(a => a.id === t.accountId);
    if (!from) return;
    if (t.type === 'income') from.balance += t.amount;
    else if (t.type === 'expense') from.balance -= t.amount;
    else if (t.type === 'transfer') { from.balance -= t.amount; const to = accounts.find(a => a.id === t.targetId); if (to) to.balance += convert(t.amount, from.currency || 'TRY', to.currency || 'TRY'); }
}
function revertTx(t) {
    const from = accounts.find(a => a.id === t.accountId);
    if (!from) return;
    if (t.type === 'income') from.balance -= t.amount;
    else if (t.type === 'expense') from.balance += t.amount;
    else if (t.type === 'transfer') { from.balance += t.amount; const to = accounts.find(a => a.id === t.targetId); if (to) to.balance -= convert(t.amount, from.currency || 'TRY', to.currency || 'TRY'); }
}

function setTxType(type) {
    txType = type;
    $$('#txTypeSeg button').forEach(b => b.classList.toggle('active', b.dataset.type === type));
    $('#txCatField').style.display = type === 'expense' ? '' : 'none';
    $('#txTargetField').style.display = type === 'transfer' ? '' : 'none';
    $('#txAccountLabel').textContent = type === 'transfer' ? 'Kaynak Hesap' : 'Hesap';
}

function openTxModal(tx, preset) {
    if (!accounts.length) { toast('Önce bir hesap ekleyin'); openAccountModal(); return; }
    preset = preset || {};
    if (preset.type === 'transfer' && accounts.length < 2) { toast('Transfer için en az 2 hesap gerekli'); return; }
    editingTxId = tx ? tx.id : null;
    const type = tx ? tx.type : (preset.type || 'expense');
    const cat = tx && tx.type === 'expense' ? tx.category : (preset.category || '');
    $('#txModalTitle').textContent = tx ? 'İşlemi Düzenle' : 'İşlem Ekle';
    setTxType(type);
    $('#txAmount').value = tx ? String(tx.amount).replace('.', ',') : '';
    $('#txNote').value = tx ? (tx.note || '') : '';
    $('#txDate').value = tx ? tx.date : todayISO();
    $('#txCategory').value = cat;
    $$('#txCatPicker .cat-opt').forEach(b => b.classList.toggle('selected', cat && b.dataset.cat === cat));
    fillAccountSelects();
    if (tx) {
        $('#txAccount').value = tx.accountId;
        if (tx.type === 'transfer') $('#txTarget').value = tx.targetId;
    } else if (preset.accountId) {
        $('#txAccount').value = preset.accountId;
        if (type === 'transfer') {
            const other = accounts.find(a => a.id !== preset.accountId);
            if (other) $('#txTarget').value = other.id;
        }
    }
    openModal('txModal');
}

function saveTx() {
    const amount = parseNum($('#txAmount').value);
    const acc = accounts.find(a => a.id === Number($('#txAccount').value));
    if (amount <= 0) return toast('Geçerli tutar girin');
    if (!acc) return toast('Hesap seçin');

    const tx = {
        id: editingTxId || Date.now(), type: txType, amount,
        currency: acc.currency || 'TRY',
        accountId: acc.id, accountName: acc.name,
        note: $('#txNote').value.trim(),
        date: $('#txDate').value || todayISO()
    };
    if (txType === 'expense') {
        if (!$('#txCategory').value) return toast('Kategori seçin');
        tx.category = $('#txCategory').value;
    } else if (txType === 'income') {
        tx.category = 'Gelir';
    } else if (txType === 'transfer') {
        const tgt = accounts.find(a => a.id === Number($('#txTarget').value));
        if (!tgt || tgt.id === acc.id) return toast('Farklı hedef hesap seçin');
        tx.category = 'Transfer'; tx.targetId = tgt.id; tx.targetName = tgt.name;
    }

    if (editingTxId) { const old = transactions.find(x => x.id === editingTxId); if (old) revertTx(old); transactions = transactions.filter(x => x.id !== editingTxId); }
    applyTx(tx);
    transactions.push(tx);
    save(); renderAll(); closeAll();
    toast(editingTxId ? 'İşlem güncellendi' : (txType === 'income' ? 'Gelir eklendi' : txType === 'transfer' ? 'Transfer yapıldı' : 'Gider eklendi'));
    editingTxId = null;
}

function openTxDetail(id) {
    const t = transactions.find(x => x.id === id); if (!t) return;
    $('#txDetailTitle').textContent = t.note || (t.type === 'income' ? 'Gelir' : t.type === 'transfer' ? 'Transfer' : t.category);
    $('#txDetailAmount').textContent = (t.type === 'income' ? '+' : t.type === 'expense' ? '−' : '') + fmtC(t.amount, t.currency || 'TRY');
    $('#txDetailAmount').style.color = t.type === 'income' ? 'var(--green)' : 'var(--ink)';
    const meta = t.type === 'transfer' ? `${t.accountName} → ${t.targetName}` : `${t.type === 'income' ? 'Gelir' : t.category} · ${t.accountName}`;
    $('#txDetailMeta').textContent = `${meta} · ${shortDate(t.date)}`;
    $('#txEdit').onclick = () => { closeAll(); openTxModal(t); };
    $('#txDelete').onclick = () => {
        revertTx(t);
        transactions = transactions.filter(x => x.id !== id);
        save(); renderAll(); closeAll(); toast('İşlem silindi');
    };
    openModal('txDetailModal');
}

/* ============================================================
   Hesap
   ============================================================ */
function openAccountModal() {
    accType = 'Banka'; accColor = ACCOUNT_COLORS[0]; accCurrency = 'TRY';
    $('#accName').value = ''; $('#accBank').value = ''; $('#accBalance').value = '';
    $$('#accTypeSeg button').forEach(b => b.classList.toggle('active', b.dataset.type === 'Banka'));
    $$('#accCurrency button').forEach(b => b.classList.toggle('active', b.dataset.ccy === 'TRY'));
    $$('#accColors .color-dot').forEach((b, i) => b.style.borderColor = i === 0 ? 'var(--ink)' : 'transparent');
    openModal('accountModal');
}
function saveAccount() {
    const name = $('#accName').value.trim();
    if (!name) return toast('Hesap adı girin');
    accounts.push({ id: Date.now(), name, bank: $('#accBank').value.trim(), type: accType, currency: accCurrency, color: accColor, balance: parseNum($('#accBalance').value) });
    save(); renderAll(); closeAll(); toast('Hesap eklendi');
}
function openAccDetail(id) {
    const a = accounts.find(x => x.id === id); if (!a) return;
    openAccountId = id;
    $('#accDetailName').textContent = a.name;
    $('#accDetailBal').textContent = fmtC(a.balance, a.currency) + (a.currency !== 'TRY' ? ` · ${fmt(toTRY(a.balance, a.currency))}` : '');
    $('#accDetailType').textContent = `${a.bank ? a.bank + ' · ' : ''}${a.type} · ${a.currency}`;
    const txs = transactions.filter(t => t.accountId === id || t.targetId === id).sort(byDate).slice(0, 12);
    renderTxGroups($('#accDetailTx'), txs);
    openModal('accDetailModal');
}

/* ============================================================
   Kartlar (görsel)
   ============================================================ */
function openCardModal(card) {
    if (!accounts.length) { toast('Kart için önce hesap ekleyin'); openAccountModal(); return; }
    editingCardId = card ? card.id : null;
    cardTheme = card ? card.theme : 'black';
    cardNetwork = card ? card.network : 'visa';
    $('#cardModalTitle').textContent = card ? 'Kartı Düzenle' : 'Kart Ekle';
    $('#cardAccount').innerHTML = accounts.map(a => `<option value="${a.id}">${a.name} (${a.currency})</option>`).join('');
    $('#cardAccount').value = card ? card.accountId : accounts[0].id;
    $('#cardBank').value = card ? card.bank : '';
    $('#cardLast4').value = card ? card.last4 : '';
    $('#cardHolder').value = card ? card.holder : (settings.displayName || '');
    $('#cardDelete').style.display = card ? 'block' : 'none';
    $$('#cardThemeRow .ct-dot').forEach(b => b.classList.toggle('selected', b.dataset.theme === cardTheme));
    $$('#cardNetRow button').forEach(b => b.classList.toggle('active', b.dataset.net === cardNetwork));
    openModal('cardModal');
}
function saveCard() {
    const bank = $('#cardBank').value.trim();
    const accountId = Number($('#cardAccount').value);
    if (!accountId) return toast('Bağlı hesap seçin');
    if (!bank) return toast('Banka adı girin');
    const data = {
        bank, accountId, network: cardNetwork, theme: cardTheme,
        last4: $('#cardLast4').value.replace(/\D/g, '').slice(0, 4),
        holder: $('#cardHolder').value.trim()
    };
    if (editingCardId) { const c = cards.find(x => x.id === editingCardId); if (c) Object.assign(c, data); }
    else cards.push(Object.assign({ id: Date.now() }, data));
    save(); renderWallet(); closeAll(); toast(editingCardId ? 'Kart güncellendi' : 'Kart eklendi');
}
function deleteCardById(id) {
    if (!confirm('Kartı silmek istediğinize emin misiniz? (Bağlı hesap silinmez)')) return;
    cards = cards.filter(c => c.id !== id);
    if (activeCardIdx >= cards.length) activeCardIdx = Math.max(0, cards.length - 1);
    save(); renderWallet(); toast('Kart silindi');
}
function deleteCard() { if (editingCardId) { closeAll(); deleteCardById(editingCardId); } }
function activeCard() { return cards[activeCardIdx]; }

// Kart arkasındaki butonların işlemleri (bağlı hesap üzerinden)
function handleCardAction(act, cardId) {
    const card = cards.find(c => c.id === cardId); if (!card) return;
    activeCardIdx = cards.findIndex(c => c.id === cardId);
    if (act === 'edit') return openCardModal(card);
    if (act === 'delete') return deleteCardById(cardId);
    const acc = accounts.find(a => a.id === card.accountId);
    if (!acc) return toast('Bağlı hesap bulunamadı');
    if (act === 'load') return openTxModal(null, { type: 'income', accountId: acc.id });
    if (act === 'spend') return openTxModal(null, { type: 'expense', accountId: acc.id });
    if (act === 'transfer') return openTxModal(null, { type: 'transfer', accountId: acc.id });
}
function openCardDetail() {
    const c = activeCard();
    if (!c) { toast('Önce kart ekleyin'); return openCardModal(null); }
    const wrap = $(`[data-card-id="${c.id}"]`);
    if (wrap) wrap.classList.toggle('flipped');
}
function deleteAccount() {
    if (!confirm('Hesabı, ona ait kart ve işlemleri silmek istediğinize emin misiniz?')) return;
    transactions = transactions.filter(t => t.accountId !== openAccountId && t.targetId !== openAccountId);
    cards = cards.filter(c => c.accountId !== openAccountId);
    accounts = accounts.filter(a => a.id !== openAccountId);
    save(); renderAll(); closeAll(); toast('Hesap silindi');
}

/* ============================================================
   Hedefler
   ============================================================ */
function saveGoal() {
    const name = $('#goalName').value.trim();
    const target = parseNum($('#goalTarget').value);
    if (!name) return toast('Hedef adı girin');
    if (target <= 0) return toast('Hedef tutar girin');
    goals.push({ id: Date.now(), name, target, saved: 0 });
    save(); renderGoals(); closeAll(); toast('Hedef oluşturuldu');
}
function openGoalAdd(id) {
    const g = goals.find(x => x.id === id); if (!g) return;
    openGoalId = id;
    $('#goalAddTitle').textContent = g.name;
    $('#goalAddAmount').value = '';
    openModal('goalAddModal');
}
function saveGoalAdd() {
    const g = goals.find(x => x.id === openGoalId); if (!g) return;
    const amt = parseNum($('#goalAddAmount').value);
    if (amt <= 0) return toast('Tutar girin');
    g.saved += amt;
    save(); renderGoals(); closeAll();
    toast(g.saved >= g.target ? 'Tebrikler, hedefe ulaştın! 🎉' : 'Eklendi');
}
function deleteGoal() {
    goals = goals.filter(g => g.id !== openGoalId);
    save(); renderGoals(); closeAll(); toast('Hedef silindi');
}

function openGoalModal() { $('#goalName').value = ''; $('#goalTarget').value = ''; openModal('goalModal'); }

/* ============================================================
   Ekle menüsü
   ============================================================ */
function openAddMenu() { openModal('addMenuModal'); }
function handleAdd(kind) {
    closeAll();
    if (kind === 'income') openTxModal(null, { type: 'income' });
    else if (kind === 'expense') openTxModal(null, { type: 'expense' });
    else if (kind === 'transfer') openTxModal(null, { type: 'transfer' });
    else if (kind === 'account') openAccountModal();
    else if (kind === 'goal') openGoalModal();
    else if (kind === 'other') openTxModal(null, { type: 'expense', category: 'Diğer' });
}

/* ============================================================
   Bildirimler
   ============================================================ */
function computeNotifs() {
    const list = [];
    const spend = monthExpense();
    const limit = Number(settings.monthlyLimit) || 0;
    if (limit > 0 && spend > limit)
        list.push({ icon: 'warning', bg: '#FBE0E0', fg: '#EB5757', title: 'Aylık limit aşıldı', sub: `${fmt(spend)} / ${fmt(limit)}` });
    else if (limit > 0 && spend >= limit * 0.8)
        list.push({ icon: 'info', bg: '#FFEAD2', fg: '#F2994A', title: 'Limite yaklaşıyorsun', sub: `%${Math.round(spend / limit * 100)} kullanıldı` });
    goals.filter(g => g.target > 0 && g.saved >= g.target)
        .forEach(g => list.push({ icon: 'emoji_events', bg: '#DEF7E6', fg: '#2FBF71', title: `${g.name} hedefine ulaştın 🎉`, sub: fmt(g.saved) }));
    if (monthIncome() === 0 && spend > 0)
        list.push({ icon: 'savings', bg: '#EBE4FB', fg: '#9B6BE3', title: 'Bu ay gelir kaydın yok', sub: 'Bir gelir eklemek ister misin?' });
    return list;
}
function renderNotifBadge() { const d = $('#notifDot'); if (d) d.hidden = computeNotifs().length === 0; }
function openNotif() {
    const n = computeNotifs();
    $('#notifList').innerHTML = n.length ? n.map(x =>
        `<div class="notif-item"><div class="notif-ic" style="background:${x.bg};color:${x.fg}"><span class="material-icons">${x.icon}</span></div><div class="notif-text"><b>${x.title}</b><span>${x.sub}</span></div></div>`
    ).join('') : `<div class="empty"><span class="material-icons">notifications_off</span><p>Yeni bildirim yok</p></div>`;
    openModal('notifModal');
}

/* ============================================================
   Navigasyon
   ============================================================ */
function go(screen) {
    $$('.screen').forEach(s => s.classList.remove('active'));
    $('#screen-' + screen).classList.add('active');
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.screen === screen));
    window.scrollTo(0, 0);
}

/* ============================================================
   Olaylar
   ============================================================ */
function wire() {
    // Tablar
    $$('.tab').forEach(t => t.addEventListener('click', () => go(t.dataset.screen)));
    $$('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
    $('#fabAdd').addEventListener('click', openAddMenu);
    $$('#addMenuModal .am-tile').forEach(t => t.addEventListener('click', () => handleAdd(t.dataset.add)));

    // Üst bar
    $('#menuBtn').addEventListener('click', () => {
        $('#limitInput').value = settings.monthlyLimit ? String(settings.monthlyLimit).replace('.', ',') : '';
        openModal('menuModal');
    });
    $('#bellBtn').addEventListener('click', openNotif);
    $('#shareBtn').addEventListener('click', () => toast('Bakiye: ' + fmt(totalBalance())));
    $('#eyeBtn').addEventListener('click', () => {
        balanceHidden = !balanceHidden;
        $('#eyeBtn .material-icons').textContent = balanceHidden ? 'visibility_off' : 'visibility';
        renderHome(); renderWallet();
    });

    // Modal kapatma
    document.addEventListener('click', e => {
        if (e.target.closest('[data-close]')) return closeAll();
        if (e.target.classList.contains('modal')) closeAll();
    });

    // İşlem ekle modalı
    $$('#txTypeSeg button').forEach(b => b.addEventListener('click', () => setTxType(b.dataset.type)));
    $('#txCatPicker').addEventListener('click', e => {
        const opt = e.target.closest('.cat-opt'); if (!opt) return;
        $$('#txCatPicker .cat-opt').forEach(x => x.classList.remove('selected'));
        opt.classList.add('selected'); $('#txCategory').value = opt.dataset.cat;
    });
    $('#txSave').addEventListener('click', saveTx);

    // Hesap
    $('#addAccountBtn').addEventListener('click', openAccountModal);
    $$('#accTypeSeg button').forEach(b => b.addEventListener('click', () => {
        accType = b.dataset.type; $$('#accTypeSeg button').forEach(x => x.classList.toggle('active', x === b));
    }));
    $$('#accCurrency button').forEach(b => b.addEventListener('click', () => {
        accCurrency = b.dataset.ccy; $$('#accCurrency button').forEach(x => x.classList.toggle('active', x === b));
    }));
    $('#accColors').addEventListener('click', e => {
        const dot = e.target.closest('[data-acc-color]'); if (!dot) return;
        accColor = dot.dataset.accColor;
        $$('#accColors .color-dot').forEach(x => x.style.borderColor = x === dot ? 'var(--ink)' : 'transparent');
    });
    $('#accSave').addEventListener('click', saveAccount);
    $('#accDelete').addEventListener('click', deleteAccount);

    // Kartlar + hızlı eylemler
    $('#addCardBtn').addEventListener('click', () => openCardModal(null));
    $('#walletEye').addEventListener('click', () => {
        balanceHidden = !balanceHidden;
        $('#walletEye .material-icons').textContent = balanceHidden ? 'visibility_off' : 'visibility';
        renderWallet(); renderHome();
    });
    const accOfActiveCard = () => { const c = activeCard(); return c ? accounts.find(a => a.id === c.accountId) : null; };
    $('#qaSend').addEventListener('click', () => { const a = accOfActiveCard(); openTxModal(null, { type: 'transfer', accountId: a && a.id }); });
    $('#qaLoad').addEventListener('click', () => { const a = accOfActiveCard(); openTxModal(null, { type: 'income', accountId: a && a.id }); });
    $('#qaDetail').addEventListener('click', openCardDetail);
    $('#qaSettings').addEventListener('click', () => { const c = activeCard(); c ? openCardModal(c) : openCardModal(null); });
    $('#cardThemeRow').addEventListener('click', e => {
        const d = e.target.closest('.ct-dot'); if (!d) return;
        cardTheme = d.dataset.theme; $$('#cardThemeRow .ct-dot').forEach(x => x.classList.toggle('selected', x === d));
    });
    $('#cardNetRow').addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        cardNetwork = b.dataset.net; $$('#cardNetRow button').forEach(x => x.classList.toggle('active', x === b));
    });
    $('#cardSave').addEventListener('click', saveCard);
    $('#cardDelete').addEventListener('click', deleteCard);
    // Carousel kaydırınca aktif kart noktasını güncelle
    const carousel = $('#cardCarousel');
    carousel.addEventListener('scroll', () => {
        const idx = Math.round(carousel.scrollLeft / (carousel.firstElementChild ? carousel.firstElementChild.offsetWidth + 12 : 1));
        if (idx !== activeCardIdx && idx < cards.length) {
            activeCardIdx = idx;
            $$('#cardDots .card-dot').forEach((d, i) => d.classList.toggle('on', i === activeCardIdx));
        }
    });
    // Karta tıklama: arka buton → işlem; boşluk → çevir
    carousel.addEventListener('click', e => {
        if (e.target.closest('[data-add-card]')) return openCardModal(null);
        const wrap = e.target.closest('[data-card-id]');
        if (!wrap) return;
        const id = Number(wrap.dataset.cardId);
        const actBtn = e.target.closest('[data-cact]');
        if (actBtn) { handleCardAction(actBtn.dataset.cact, id); return; }
        wrap.classList.toggle('flipped');
    });

    // Hedef
    $('#addGoalBtn').addEventListener('click', openGoalModal);
    $('#goalSave').addEventListener('click', saveGoal);
    $('#goalAddSave').addEventListener('click', saveGoalAdd);
    $('#goalDelete').addEventListener('click', deleteGoal);

    // Analizler ay gezinme + arama
    $('#anPrev').addEventListener('click', () => { anDate.setMonth(anDate.getMonth() - 1); renderAnalytics(); });
    $('#anNext').addEventListener('click', () => { anDate.setMonth(anDate.getMonth() + 1); renderAnalytics(); });
    $('#anSearch').addEventListener('input', renderAnalytics);

    // Ayarlar
    $('#saveLimit').addEventListener('click', () => { settings.monthlyLimit = parseNum($('#limitInput').value); save(); renderHome(); closeAll(); toast('Limit kaydedildi'); });
    $('#themeBtn').addEventListener('click', toggleTheme);
    $('#logoutBtn').addEventListener('click', () => {
        if (confirm('Çıkış yapmak istediğinize emin misiniz?'))
            firebase.auth().signOut().then(() => { localStorage.removeItem('isLoggedIn'); location.href = 'index.html'; });
    });

    // Delegasyon: işlem / hesap / hedef tıklama
    document.addEventListener('click', e => {
        const tx = e.target.closest('[data-tx]'); if (tx) return openTxDetail(Number(tx.dataset.tx));
        const acc = e.target.closest('[data-acct]'); if (acc) return openAccDetail(Number(acc.dataset.acct));
        const goal = e.target.closest('[data-goal]'); if (goal) return openGoalAdd(Number(goal.dataset.goal));
    });
}

/* ============================================================
   Başlangıç
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    buildCatPicker();
    buildAccColors();
    buildCardPickers();
    renderHeader();
    wire();
    updateRates();
    setInterval(updateRates, 3600000);

    firebase.auth().onAuthStateChanged(user => {
        if (user) load();
        else location.href = 'index.html';
    });
});
