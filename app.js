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
const ACCOUNT_COLORS = ['#2FBF71', '#4A90E2', '#9B6BE3', '#F2994A', '#EB5757', '#1B1C1F'];
const ACCOUNT_ICONS = { 'Banka': 'account_balance', 'Kredi Kartı': 'credit_card', 'Nakit': 'payments' };
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

/* ---------- Durum ---------- */
let accounts = [];
let transactions = [];
let goals = [];
let settings = { monthlyLimit: 0, displayName: '' };
let balanceHidden = false;
let anDate = new Date();           // analizler ay seçimi
let txType = 'expense';
let accColor = ACCOUNT_COLORS[0];
let accType = 'Banka';
let openAccountId = null;
let openGoalId = null;

/* ---------- Yardımcılar ---------- */
function fmt(n) {
    return '₺' + (Number(n) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function mask(text) { return balanceHidden ? '₺ ••••••' : text; }
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
            accounts, transactions, goals, settings,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (e) { console.error(e); toast('Kaydedilemedi'); }
}
async function load() {
    const u = firebase.auth().currentUser; if (!u) return;
    try {
        const doc = await firebase.firestore().collection('users').doc(u.uid).get();
        const d = doc.exists ? doc.data() : {};
        accounts = d.accounts || [];
        transactions = d.transactions || [];
        goals = d.goals || [];
        settings = Object.assign({ monthlyLimit: 0, displayName: '' }, d.settings || {});
    } catch (e) { console.error(e); }
    renderAll();
}

/* ---------- Hesaplamalar ---------- */
const totalBalance = () => accounts.reduce((s, a) => s + (Number(a.balance) || 0), 0);
function monthExpense(ref = new Date()) {
    return transactions.filter(t => t.type === 'expense' && sameMonth(t.date, ref)).reduce((s, t) => s + t.amount, 0);
}
function monthIncome(ref = new Date()) {
    return transactions.filter(t => t.type === 'income' && sameMonth(t.date, ref)).reduce((s, t) => s + t.amount, 0);
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
    const total = exp.reduce((s, t) => s + t.amount, 0);
    const sums = {};
    exp.forEach(t => { sums[t.category] = (sums[t.category] || 0) + t.amount; });
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

function renderTxList(wrap, list, allowEmpty) {
    if (!list.length) {
        wrap.innerHTML = `<div class="empty"><span class="material-icons">receipt_long</span><p>Henüz işlem yok</p></div>`;
        return;
    }
    wrap.innerHTML = list.map(t => {
        const c = t.type === 'income' ? INCOME_CAT : catOf(t.category);
        const title = t.note || (t.type === 'income' ? 'Gelir' : t.category);
        const sign = t.type === 'income' ? '+' : '−';
        return `
        <div class="tx" data-tx="${t.id}">
          <div class="tx-ic" style="background:${c.bg};color:${c.fg}"><span class="material-icons">${c.icon}</span></div>
          <div class="tx-main">
            <div class="tx-title">${title}</div>
            <div class="tx-cat">${t.type === 'income' ? 'Gelir' : t.category}</div>
          </div>
          <div class="tx-right">
            <div class="tx-amt ${t.type}">${sign}${fmt(t.amount)}</div>
            <div class="tx-date">${shortDate(t.date)}</div>
          </div>
        </div>`;
    }).join('');
}

function renderAnalytics() {
    $('#anMonth').textContent = `${MONTHS[anDate.getMonth()]} ${anDate.getFullYear()}`;
    const exp = transactions.filter(t => t.type === 'expense' && sameMonth(t.date, anDate));
    const total = exp.reduce((s, t) => s + t.amount, 0);
    $('#anExpense').textContent = fmt(total);

    const sums = {};
    exp.forEach(t => { sums[t.category] = (sums[t.category] || 0) + t.amount; });
    const list = Object.entries(sums).sort((a, b) => b[1] - a[1]);
    const bars = $('#anBars');
    bars.innerHTML = list.length ? list.map(([key, val]) => {
        const c = catOf(key);
        const pct = total > 0 ? (val / total) * 100 : 0;
        return `
        <div class="bar-row">
          <span>${key}</span>
          <div class="bar-track"><span style="width:${pct}%;background:${c.fg}"></span></div>
          <b>${fmt(val)}</b>
        </div>`;
    }).join('') : `<p class="sub-num">Bu ay harcama kaydı yok.</p>`;

    const monthTx = transactions.filter(t => sameMonth(t.date, anDate)).sort(byDate);
    renderTxList($('#allTx'), monthTx);
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

function renderWallet() {
    const wrap = $('#accountsList');
    if (!accounts.length) { wrap.innerHTML = `<div class="empty"><span class="material-icons">account_balance_wallet</span><p>Henüz hesap yok. İlk hesabını ekle!</p></div>`; return; }
    wrap.innerHTML = accounts.map(a => `
        <div class="acct" data-acct="${a.id}">
          <div class="acct-left">
            <div class="acct-dot" style="background:${a.color}"><span class="material-icons">${ACCOUNT_ICONS[a.type] || 'account_balance'}</span></div>
            <div><div class="acct-name">${a.name}</div><div class="acct-type">${a.type}</div></div>
          </div>
          <div class="acct-bal">${mask(fmt(a.balance))}</div>
        </div>`).join('');
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
function fillAccountSelect() {
    $('#txAccount').innerHTML = accounts.map(a => `<option value="${a.id}">${a.name} (${fmt(a.balance)})</option>`).join('');
}

/* ============================================================
   İşlem ekle
   ============================================================ */
function openTxModal() {
    if (!accounts.length) { toast('Önce bir hesap ekleyin'); openAccountModal(); return; }
    txType = 'expense';
    $$('#txTypeSeg button').forEach(b => b.classList.toggle('active', b.dataset.type === 'expense'));
    $('#txCatField').style.display = 'block';
    $('#txAmount').value = '';
    $('#txNote').value = '';
    $('#txCategory').value = '';
    $$('#txCatPicker .cat-opt').forEach(b => b.classList.remove('selected'));
    $('#txDate').value = todayISO();
    fillAccountSelect();
    openModal('txModal');
}
function saveTx() {
    const amount = parseNum($('#txAmount').value);
    const accId = Number($('#txAccount').value);
    const acc = accounts.find(a => a.id === accId);
    if (amount <= 0) return toast('Geçerli tutar girin');
    if (!acc) return toast('Hesap seçin');
    if (txType === 'expense' && !$('#txCategory').value) return toast('Kategori seçin');

    const tx = {
        id: Date.now(), type: txType, amount,
        category: txType === 'expense' ? $('#txCategory').value : 'Gelir',
        accountId: acc.id, accountName: acc.name,
        note: $('#txNote').value.trim(),
        date: $('#txDate').value || todayISO()
    };
    acc.balance += txType === 'income' ? amount : -amount;
    transactions.push(tx);
    save(); renderAll(); closeAll();
    toast(txType === 'income' ? 'Gelir eklendi' : 'Gider eklendi');
}

function openTxDetail(id) {
    const t = transactions.find(x => x.id === id); if (!t) return;
    $('#txDetailTitle').textContent = t.note || (t.type === 'income' ? 'Gelir' : t.category);
    $('#txDetailAmount').textContent = (t.type === 'income' ? '+' : '−') + fmt(t.amount);
    $('#txDetailAmount').style.color = t.type === 'income' ? 'var(--green)' : 'var(--ink)';
    $('#txDetailMeta').textContent = `${t.type === 'income' ? 'Gelir' : t.category} · ${t.accountName} · ${shortDate(t.date)}`;
    $('#txDelete').onclick = () => {
        const acc = accounts.find(a => a.id === t.accountId);
        if (acc) acc.balance += t.type === 'income' ? -t.amount : t.amount;
        transactions = transactions.filter(x => x.id !== id);
        save(); renderAll(); closeAll(); toast('İşlem silindi');
    };
    openModal('txDetailModal');
}

/* ============================================================
   Hesap
   ============================================================ */
function openAccountModal() {
    accType = 'Banka'; accColor = ACCOUNT_COLORS[0];
    $('#accName').value = ''; $('#accBalance').value = '';
    $$('#accTypeSeg button').forEach(b => b.classList.toggle('active', b.dataset.type === 'Banka'));
    $$('#accColors .color-dot').forEach((b, i) => b.style.borderColor = i === 0 ? 'var(--ink)' : 'transparent');
    openModal('accountModal');
}
function saveAccount() {
    const name = $('#accName').value.trim();
    if (!name) return toast('Hesap adı girin');
    accounts.push({ id: Date.now(), name, type: accType, color: accColor, balance: parseNum($('#accBalance').value) });
    save(); renderAll(); closeAll(); toast('Hesap eklendi');
}
function openAccDetail(id) {
    const a = accounts.find(x => x.id === id); if (!a) return;
    openAccountId = id;
    $('#accDetailName').textContent = a.name;
    $('#accDetailBal').textContent = fmt(a.balance);
    $('#accDetailType').textContent = a.type;
    const txs = transactions.filter(t => t.accountId === id).sort(byDate).slice(0, 8);
    renderTxList($('#accDetailTx'), txs);
    openModal('accDetailModal');
}
function deleteAccount() {
    if (!confirm('Hesabı ve ona ait işlemleri silmek istediğinize emin misiniz?')) return;
    transactions = transactions.filter(t => t.accountId !== openAccountId);
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
    $('#fabAdd').addEventListener('click', openTxModal);

    // Üst bar
    $('#menuBtn').addEventListener('click', () => {
        $('#limitInput').value = settings.monthlyLimit ? String(settings.monthlyLimit).replace('.', ',') : '';
        openModal('menuModal');
    });
    $('#bellBtn').addEventListener('click', () => toast('Yeni bildirim yok'));
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
    $$('#txTypeSeg button').forEach(b => b.addEventListener('click', () => {
        txType = b.dataset.type;
        $$('#txTypeSeg button').forEach(x => x.classList.toggle('active', x === b));
        $('#txCatField').style.display = txType === 'expense' ? 'block' : 'none';
    }));
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
    $('#accColors').addEventListener('click', e => {
        const dot = e.target.closest('[data-acc-color]'); if (!dot) return;
        accColor = dot.dataset.accColor;
        $$('#accColors .color-dot').forEach(x => x.style.borderColor = x === dot ? 'var(--ink)' : 'transparent');
    });
    $('#accSave').addEventListener('click', saveAccount);
    $('#accDelete').addEventListener('click', deleteAccount);

    // Hedef
    $('#addGoalBtn').addEventListener('click', () => { $('#goalName').value = ''; $('#goalTarget').value = ''; openModal('goalModal'); });
    $('#goalSave').addEventListener('click', saveGoal);
    $('#goalAddSave').addEventListener('click', saveGoalAdd);
    $('#goalDelete').addEventListener('click', deleteGoal);

    // Analizler ay gezinme
    $('#anPrev').addEventListener('click', () => { anDate.setMonth(anDate.getMonth() - 1); renderAnalytics(); });
    $('#anNext').addEventListener('click', () => { anDate.setMonth(anDate.getMonth() + 1); renderAnalytics(); });

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
    renderHeader();
    wire();

    firebase.auth().onAuthStateChanged(user => {
        if (user) load();
        else location.href = 'index.html';
    });
});
