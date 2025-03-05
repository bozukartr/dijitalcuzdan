// Uygulama verilerini Firestore'da saklayacağız
let banks = [];
let debts = [];
let subscriptions = [];
let expenses = [];

// Döviz kurları için API URL'leri
const EXCHANGE_API_URL = 'https://api.exchangerate-api.com/v4/latest/TRY';

// Döviz kurlarını saklayacağımız global değişken
let exchangeRates = null;

// Döviz kurlarını güncelleme fonksiyonu
async function updateExchangeRates() {
    try {
        const response = await fetch(EXCHANGE_API_URL);
        const data = await response.json();
        // TRY baz alındığı için tersini alıyoruz
        exchangeRates = {
            TRY: 1,
            USD: 1 / data.rates.USD,
            EUR: 1 / data.rates.EUR,
            GBP: 1 / data.rates.GBP,
            AED: 1 / data.rates.AED
        };
        return true;
    } catch (error) {
        console.error('Döviz kurları alınamadı:', error);
        return false;
    }
}

// Belirli bir döviz cinsinden TL'ye çevirme
function convertToTRY(amount, currency) {
    if (!exchangeRates) return amount; // Kurlar yüklenmediyse direkt miktarı döndür
    return amount * exchangeRates[currency];
}

// Toplam varlıkları TL cinsinden hesaplama
function calculateTotalAssetsInTRY() {
    return banks.reduce((total, bank) => {
        const amountInTRY = convertToTRY(bank.balance, bank.currency);
        return total + amountInTRY;
    }, 0);
}

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

// Tema değiştirme butonu olayı
document.getElementById('themeToggle').addEventListener('click', toggleTheme);

// Tema başlatma
initTheme();

// DOM elementleri
const banksList = document.getElementById('banksList');
const debtsList = document.getElementById('debtsList');
const subscriptionsList = document.getElementById('subscriptionsList');
const expensesList = document.getElementById('expensesList');
const totalDebtElement = document.getElementById('totalDebt');
const totalAssetsElement = document.getElementById('totalAssets');
const bankModal = document.getElementById('bankModal');
const debtModal = document.getElementById('debtModal');
const subscriptionModal = document.getElementById('subscriptionModal');
const expenseModal = document.getElementById('expenseModal');
const debtDetailModal = document.getElementById('debtDetailModal');
const bankDetailModal = document.getElementById('bankDetailModal');
const subscriptionDetailModal = document.getElementById('subscriptionDetailModal');
const bankForm = document.getElementById('bankForm');
const debtForm = document.getElementById('debtForm');
const subscriptionForm = document.getElementById('subscriptionForm');
const expenseForm = document.getElementById('expenseForm');
const expenseDetailModal = document.getElementById('expenseDetailModal');
const expenseDetailTitle = document.getElementById('expenseDetailTitle');
const expenseDetailAmount = document.getElementById('expenseDetailAmount');
const expenseDetailDate = document.getElementById('expenseDetailDate');
const expenseDetailDelete = document.getElementById('expenseDetailDelete');
const monthlyExpensesElement = document.getElementById('monthlyExpenses');

// Kategori ikonları
const categoryIcons = {
    'Market': 'shopping_cart',
    'Yemek': 'restaurant',
    'Oyun': 'sports_esports',
    'Ulaşım': 'directions_bus',
    'Giyim': 'checkroom',
    'Teknoloji': 'devices',
    'Eğlence': 'movie',
    'Kozmetik': 'spa'
};

// Para birimi formatlama fonksiyonu
function formatCurrency(amount, currency) {
    const symbols = {
        'TRY': '₺',
        'EUR': '€',
        'USD': '$',
        'GBP': '£',
        'AED': 'د.إ'
    };
    
    return `${symbols[currency] || ''} ${amount.toLocaleString('tr-TR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}

// IBAN formatla
function formatIBAN(iban) {
    // Sadece sayıları al
    iban = iban.replace(/[^\d]/g, '');
    
    // Maximum 24 karakter (TR hariç)
    iban = iban.slice(0, 24);
    
    // TR ekle
    iban = 'TR' + iban;

    // Gruplar halinde formatla (2-4-4-4-4-4-2)
    return iban.replace(/(.{2})(.{4})(.{4})(.{4})(.{4})(.{4})(.+)/, '$1 $2 $3 $4 $5 $6 $7');
}

// IBAN input olayını dinle
document.getElementById('iban').addEventListener('input', function(e) {
    // Sadece sayıları al
    let value = e.target.value.replace(/[^\d]/g, '');
    
    // Maximum 24 karakter (TR hariç)
    value = value.slice(0, 24);
    
    // TR ekle ve formatla
    let formattedIBAN = formatIBAN(value);
    e.target.value = formattedIBAN;
});

// Tab işlemleri
document.querySelectorAll('.tab-btn').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        button.classList.add('active');
        document.getElementById(button.dataset.tab).classList.add('active');
    });
});

// Modal işlemleri
document.getElementById('addBankBtn').addEventListener('click', () => {
    bankModal.classList.add('active');
});

document.getElementById('addDebtBtn').addEventListener('click', () => {
    debtModal.classList.add('active');
});

document.getElementById('addSubscriptionBtn').addEventListener('click', () => {
    subscriptionModal.classList.add('active');
});

document.getElementById('addExpenseBtn').addEventListener('click', () => {
    // Banka seçeneklerini güncelle
    const bankSelect = document.getElementById('expenseBank');
    bankSelect.innerHTML = '<option value="">Ödeme Yapılan Hesap</option>' +
        banks.map(bank => `
            <option value="${bank.id}">${bank.name} (${formatCurrency(bank.balance, bank.currency)})</option>
        `).join('');
    
    expenseModal.classList.add('active');
});

document.querySelectorAll('.cancel-btn').forEach(button => {
    button.addEventListener('click', () => {
        bankModal.classList.remove('active');
        debtModal.classList.remove('active');
        subscriptionModal.classList.remove('active');
        expenseModal.classList.remove('active');
    });
});

// Banka seçimi
document.querySelectorAll('.bank-select-btn').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.bank-select-btn').forEach(btn => btn.classList.remove('selected'));
        button.classList.add('selected');
        document.getElementById('bankName').value = button.dataset.bank;
    });
});

// Form işlemleri
bankForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const bankName = document.getElementById('bankName').value;
    if (!bankName) {
        alert('Lütfen bir banka seçin');
        return;
    }
    
    const iban = document.getElementById('iban').value;
    if (iban.replace(/[^\d]/g, '').length < 24) {
        alert('Lütfen geçerli bir IBAN girin');
        return;
    }
    
    const currency = document.getElementById('bankCurrency').value;
    if (!currency) {
        alert('Lütfen bir döviz cinsi seçin');
        return;
    }
    
    const bank = {
        id: Date.now(),
        name: bankName,
        iban: formatIBAN(iban),
        balance: 0,
        currency: currency
    };
    
    banks.push(bank);
    saveData();
    renderBanks();
    bankForm.reset();
    document.querySelectorAll('.bank-select-btn').forEach(btn => btn.classList.remove('selected'));
    bankModal.classList.remove('active');
});

debtForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const debt = {
        id: Date.now(),
        title: document.getElementById('debtTitle').value,
        amount: parseFloat(document.getElementById('debtAmount').value),
        dueDate: document.getElementById('dueDate').value || null,
        isPaid: document.getElementById('isPaid').checked
    };
    debts.push(debt);
    saveData();
    renderDebts();
    debtForm.reset();
    debtModal.classList.remove('active');
});

subscriptionForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const subscription = {
        id: Date.now(),
        title: document.getElementById('subscriptionTitle').value,
        amount: parseFloat(document.getElementById('subscriptionAmount').value),
        period: document.getElementById('subscriptionPeriod').value,
        paymentDate: document.getElementById('subscriptionDate').value
    };
    subscriptions.push(subscription);
    saveData();
    renderSubscriptions();
    subscriptionForm.reset();
    subscriptionModal.classList.remove('active');
});

expenseForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const bankId = document.getElementById('expenseBank').value;
    
    // Seçilen bankayı bul
    const bankIndex = banks.findIndex(b => b.id.toString() === bankId);
    if (bankIndex === -1) {
        alert('Lütfen bir hesap seçin');
        return;
    }
    
    // Yeterli bakiye kontrolü
    if (banks[bankIndex].balance < amount) {
        alert('Seçilen hesapta yeterli bakiye yok');
        return;
    }
    
    // Bankadan tutarı düş
    banks[bankIndex].balance -= amount;
    
    const expense = {
        id: Date.now(),
        title: document.getElementById('expenseCategory').value,
        category: document.getElementById('expenseCategory').value,
        amount: amount,
        date: new Date().toISOString(),
        bankId: bankId,
        bankName: banks[bankIndex].name,
        currency: banks[bankIndex].currency
    };
    
    expenses.push(expense);
    saveData();
    renderExpenses();
    renderBanks(); // Banka bakiyelerini güncelle
    expenseForm.reset();
    document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('selected'));
    expenseModal.classList.remove('active');
});

// Render fonksiyonları
function renderBanks() {
    banksList.innerHTML = banks.map(bank => `
        <div class="bank-card" data-iban="${bank.iban}" onclick="showBankDetail(${bank.id})">
            <div class="bank-card-content">
                <div class="bank-info">
                    <h3>${bank.name}</h3>
                    <div class="amount">${formatCurrency(bank.balance, bank.currency)}</div>
                </div>
                <div class="bank-logo">
                    <img src="img/${bank.name.toLowerCase().replace(/\s+/g, '').replace(/ı/g, 'i')}.png" alt="${bank.name}">
                </div>
            </div>
        </div>
    `).join('');
    updateTotals();
}

function renderDebts() {
    debtsList.innerHTML = debts.map(debt => `
        <div class="debt-card ${debt.isPaid ? 'paid-debt' : ''}" onclick="showDebtDetail(${debt.id})">
            <h3>${debt.title}</h3>
            <p class="amount">${formatCurrency(debt.amount, 'TRY')}</p>
            ${debt.dueDate ? `<p class="due-date">Son Ödeme: ${formatDate(debt.dueDate)}</p>` : ''}
        </div>
    `).join('');
    updateTotals();
}

function renderSubscriptions() {
    subscriptionsList.innerHTML = subscriptions.map(subscription => {
        const nextPayment = getNextPaymentDate(subscription);
        const isOverdue = isPaymentOverdue(subscription);
        
        return `
            <div class="subscription-card ${isOverdue ? 'overdue' : ''}" onclick="showSubscriptionDetail(${subscription.id})">
                <h3>${subscription.title}</h3>
                <p class="amount">${formatCurrency(subscription.amount, 'TRY')}</p>
                <div class="subscription-info">
                    <span>${subscription.period === 'monthly' ? 'Aylık' : 'Yıllık'}</span>
                    <div class="payment-date">
                        <span class="material-icons">${isOverdue ? 'warning' : 'event'}</span>
                        <span>${isOverdue ? 'Ödeme Gecikti!' : 'Sonraki Ödeme: ' + formatDate(nextPayment)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    updateTotals();
}

function renderExpenses() {
    const expensesList = document.getElementById('expensesList');
    expensesList.innerHTML = '';
    
    expenses.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(expense => {
        const card = document.createElement('div');
        card.className = 'expense-card';
        card.innerHTML = `
            <h3>
                <span class="material-icons">${categoryIcons[expense.category]}</span>
                ${expense.title}
            </h3>
            <p class="amount">${formatCurrency(expense.amount, expense.currency)}</p>
            <p class="expense-date">
                ${formatDate(expense.date)}
                <br>
                <small class="bank-name">${expense.bankName || 'Bilinmeyen Hesap'}</small>
            </p>
        `;
        
        card.onclick = () => showExpenseDetail(expense);
        expensesList.appendChild(card);
    });
    
    updateTotalExpenses();
}

// Borç silme fonksiyonu
function deleteDebt(debtId) {
    if (confirm('Bu borcu silmek istediğinizden emin misiniz?')) {
        debts = debts.filter(debt => debt.id !== debtId);
        saveData();
        renderDebts();
    }
}

// Borç ödeme durumunu değiştirme
function toggleDebtPaid(debtId) {
    const debtIndex = debts.findIndex(debt => debt.id === debtId);
    if (debtIndex !== -1) {
        debts[debtIndex].isPaid = !debts[debtIndex].isPaid;
        saveData();
        renderDebts();
    }
}

// Borç detay modalı
function showDebtDetail(debtId) {
    const debt = debts.find(d => d.id === debtId);
    if (!debt) return;

    const detailTitle = document.getElementById('detailTitle');
    const detailAmount = document.querySelector('.detail-amount');
    const detailDueDate = document.querySelector('.detail-due-date');
    const detailIsPaid = document.getElementById('detailIsPaid');
    const detailDeleteBtn = document.getElementById('detailDeleteBtn');

    detailTitle.textContent = debt.title;
    detailAmount.textContent = formatCurrency(debt.amount, 'TRY');
    detailDueDate.textContent = debt.dueDate ? `Son Ödeme: ${formatDate(debt.dueDate)}` : '';
    detailIsPaid.checked = debt.isPaid;

    detailIsPaid.onchange = () => {
        toggleDebtPaid(debtId);
        debtDetailModal.classList.remove('active');
    };

    detailDeleteBtn.onclick = () => {
        deleteDebt(debtId);
        debtDetailModal.classList.remove('active');
    };

    debtDetailModal.classList.add('active');
}

// Banka detay modalı
function showBankDetail(bankId) {
    const bank = banks.find(b => b.id === bankId);
    if (!bank) return;

    const detailTitle = document.getElementById('bankDetailTitle');
    const detailIban = document.getElementById('bankDetailIban');
    const detailBalance = document.getElementById('bankDetailBalance');
    const saveBtn = document.getElementById('bankDetailSave');
    const deleteBtn = document.getElementById('bankDetailDelete');

    detailTitle.textContent = bank.name;
    detailIban.textContent = formatIBAN(bank.iban);
    detailBalance.value = bank.balance;

    saveBtn.onclick = () => {
        const newBalance = parseFloat(detailBalance.value);
        if (!isNaN(newBalance) && newBalance >= 0) {
            const bankIndex = banks.findIndex(b => b.id === bankId);
            if (bankIndex !== -1) {
                banks[bankIndex].balance = newBalance;
                saveData();
                renderBanks();
                bankDetailModal.classList.remove('active');
            }
        }
    };

    deleteBtn.onclick = () => {
        if (confirm('Bu bankayı silmek istediğinizden emin misiniz?')) {
            banks = banks.filter(b => b.id !== bankId);
            saveData();
            renderBanks();
            bankDetailModal.classList.remove('active');
        }
    };

    bankDetailModal.classList.add('active');
}

function showSubscriptionDetail(subscriptionId) {
    const subscription = subscriptions.find(s => s.id === subscriptionId);
    if (!subscription) return;

    const detailTitle = document.getElementById('subscriptionDetailTitle');
    const detailAmount = document.getElementById('subscriptionDetailAmount');
    const detailPeriod = document.getElementById('subscriptionDetailPeriod');
    const detailDate = document.getElementById('subscriptionDetailDate');
    const saveBtn = document.getElementById('subscriptionDetailSave');
    const deleteBtn = document.getElementById('subscriptionDetailDelete');

    detailTitle.textContent = subscription.title;
    detailAmount.value = subscription.amount;
    detailPeriod.value = subscription.period;
    detailDate.value = subscription.paymentDate;

    saveBtn.onclick = () => {
        const newAmount = parseFloat(detailAmount.value);
        if (!isNaN(newAmount) && newAmount >= 0) {
            const index = subscriptions.findIndex(s => s.id === subscriptionId);
            if (index !== -1) {
                subscriptions[index] = {
                    ...subscriptions[index],
                    amount: newAmount,
                    period: detailPeriod.value,
                    paymentDate: detailDate.value
                };
                saveData();
                renderSubscriptions();
                subscriptionDetailModal.classList.remove('active');
            }
        }
    };

    deleteBtn.onclick = () => {
        if (confirm('Bu aboneliği silmek istediğinizden emin misiniz?')) {
            subscriptions = subscriptions.filter(s => s.id !== subscriptionId);
            saveData();
            renderSubscriptions();
            subscriptionDetailModal.classList.remove('active');
        }
    };

    subscriptionDetailModal.classList.add('active');
}

// Yardımcı fonksiyonlar
function getNextPaymentDate(subscription) {
    const paymentDate = new Date(subscription.paymentDate);
    const today = new Date();
    const nextPayment = new Date(paymentDate);

    // Ayın gününü ayarla
    nextPayment.setDate(paymentDate.getDate());

    // Eğer bu ayki ödeme tarihi geçtiyse, sonraki aya geç
    if (today > nextPayment) {
        nextPayment.setMonth(nextPayment.getMonth() + 1);
    }

    return nextPayment;
}

function isPaymentOverdue(subscription) {
    const today = new Date();
    const paymentDate = new Date(subscription.paymentDate);
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // Ödeme gününü bu ay için ayarla
    const thisMonthPayment = new Date(currentYear, currentMonth, paymentDate.getDate());
    
    // Eğer bugün, bu ayki ödeme gününden sonraysa, ödeme gecikmiş demektir
    return today > thisMonthPayment;
}

function updateTotals() {
    const today = new Date();
    
    // Ödenmemiş borçların toplamı
    const totalDebt = debts
        .filter(debt => !debt.isPaid)
        .reduce((sum, debt) => sum + debt.amount, 0);
    
    // Vadesi geçmiş aboneliklerin toplamı
    const overdueSubscriptions = subscriptions
        .filter(s => isPaymentOverdue(s))
        .reduce((sum, s) => {
            if (s.period === 'monthly') {
                return sum + s.amount;
            } else { // yearly
                return sum + (s.amount / 12);
            }
        }, 0);
    
    // Tüm varlıkları TL'ye çevir
    const totalAssetsInTRY = calculateTotalAssetsInTRY();
    
    totalDebtElement.textContent = formatCurrency(totalDebt + overdueSubscriptions, 'TRY');
    totalAssetsElement.textContent = formatCurrency(totalAssetsInTRY - totalDebt, 'TRY');
}

function updateTotalExpenses() {
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    
    // Aylık harcamaları hesapla
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const monthlyTotal = expenses
        .filter(expense => {
            const expenseDate = new Date(expense.date);
            return expenseDate.getMonth() === currentMonth && 
                   expenseDate.getFullYear() === currentYear;
        })
        .reduce((sum, expense) => sum + expense.amount, 0);
    
    monthlyExpensesElement.textContent = formatCurrency(monthlyTotal, 'TRY');
    updateTotals();
}

// Verileri kaydetme fonksiyonu
async function saveData() {
    const user = firebase.auth().currentUser;
    if (!user) return;

    try {
        // Firestore'a kaydet
        await firebase.firestore().collection('users').doc(user.uid).set({
            banks: banks,
            debts: debts,
            subscriptions: subscriptions,
            expenses: expenses,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Veri kaydetme hatası:', error);
    }
}

// Verileri yükleme fonksiyonu
async function loadData() {
    const user = firebase.auth().currentUser;
    if (!user) return;

    try {
        const doc = await firebase.firestore().collection('users').doc(user.uid).get();
        if (doc.exists) {
            const data = doc.data();
            banks = data.banks || [];
            debts = data.debts || [];
            subscriptions = data.subscriptions || [];
            expenses = data.expenses || [];
            
            // Verileri görüntüle
            renderBanks();
            renderDebts();
            renderSubscriptions();
            renderExpenses();
        }
    } catch (error) {
        console.error('Veri yükleme hatası:', error);
    }
}

function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('tr-TR', options);
}

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        alert('IBAN kopyalandı!');
    } catch (err) {
        console.error('Kopyalama başarısız:', err);
    }
}

// Modal kapatma işlemleri
document.querySelectorAll('.close-btn, .cancel-btn').forEach(button => {
    button.addEventListener('click', () => {
        bankModal.classList.remove('active');
        debtModal.classList.remove('active');
        subscriptionModal.classList.remove('active');
        expenseModal.classList.remove('active');
        debtDetailModal.classList.remove('active');
        bankDetailModal.classList.remove('active');
        subscriptionDetailModal.classList.remove('active');
    });
});

// Modal dışına tıklandığında kapatma
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
    }
});

// Kategori seçimi
document.querySelectorAll('.category-btn').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('selected'));
        button.classList.add('selected');
        document.getElementById('expenseCategory').value = button.dataset.category;
    });
});

function showExpenseDetail(expense) {
    const expenseDetailTitle = document.getElementById('expenseDetailTitle');
    const detailAmount = document.querySelector('#expenseDetailModal .detail-amount');
    const detailDate = document.querySelector('#expenseDetailModal .expense-detail-date');
    
    expenseDetailTitle.textContent = expense.title;
    detailAmount.textContent = formatCurrency(expense.amount, expense.currency);
    detailDate.textContent = `${formatDate(expense.date)}${expense.bankName ? ' - ' + expense.bankName : ''}`;
    
    expenseDetailDelete.onclick = () => {
        if (confirm('Bu harcamayı silmek istediğinizden emin misiniz?')) {
            // Harcama silindiğinde bankaya parayı geri ekle
            if (expense.bankId) {
                const bankIndex = banks.findIndex(b => b.id.toString() === expense.bankId.toString());
                if (bankIndex !== -1) {
                    banks[bankIndex].balance += expense.amount;
                }
            }
            
            expenses = expenses.filter(e => e.id !== expense.id);
            saveData();
            renderExpenses();
            renderBanks(); // Banka bakiyelerini güncelle
            expenseDetailModal.style.display = 'none';
        }
    };
    
    expenseDetailModal.style.display = 'flex';
}

// Başlangıç render
renderBanks();
renderDebts();
renderSubscriptions();
renderExpenses();

// Döviz seçimi için event listener
const currencyButtons = document.querySelectorAll('.currency-select-btn');
const bankCurrencyInput = document.getElementById('bankCurrency');

currencyButtons.forEach(button => {
    button.addEventListener('click', function() {
        currencyButtons.forEach(btn => btn.classList.remove('selected'));
        this.classList.add('selected');
        bankCurrencyInput.value = this.dataset.currency;
    });
});

// Uygulama başlangıcında döviz kurlarını güncelle
async function initializeApp() {
    await updateExchangeRates();
    // Her saat başı kurları güncelle
    setInterval(updateExchangeRates, 3600000);
    
    renderBanks();
    renderDebts();
    renderSubscriptions();
    renderExpenses();
}

// Başlangıç render işlemlerini güncelle
document.addEventListener('DOMContentLoaded', initializeApp);

// Çıkış yap butonu olayı
document.getElementById('logoutBtn').addEventListener('click', () => {
    if (confirm('Çıkış yapmak istediğinizden emin misiniz?')) {
        firebase.auth().signOut().then(() => {
            localStorage.clear();
            window.location.href = 'index.html';
        }).catch((error) => {
            console.error('Çıkış hatası:', error);
        });
    }
});

// Firebase Auth state değişikliğini dinle
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        loadData(); // Kullanıcı girişi yapıldığında verileri yükle
    } else {
        // Kullanıcı çıkış yaptığında verileri temizle
        banks = [];
        debts = [];
        subscriptions = [];
        expenses = [];
    }
}); 