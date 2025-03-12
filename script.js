// Uygulama verilerini Firestore'da saklayacağız
let banks = [];
let debts = [];
let subscriptions = [];
let expenses = [];

// Döviz kurları için API URL'leri
const EXCHANGE_API_URL = 'https://api.exchangerate-api.com/v4/latest/TRY';

// Döviz kurlarını saklayacağımız global değişken
let exchangeRates = null;

// Seçili ay için global değişken
let selectedDate = new Date();

// Global değişkenlere ekle
let userSettings = {
    defaultCurrency: 'TRY'
};

// Global değişken olarak kullanıcı bilgisini tut
let currentUser = null;

// Para girişi kontrolü için fonksiyon
function setupAmountInputs() {
    document.querySelectorAll('.amount-input').forEach(input => {
        input.addEventListener('input', function(e) {
            // Sadece sayılar ve virgül karakterine izin ver
            let value = this.value.replace(/[^\d,]/g, '');
            
            // Virgül kontrolü
            if (value.includes(',')) {
                const parts = value.split(',');
                // Sadece bir virgül ve virgülden sonra en fazla 2 basamak
                if (parts.length > 2) {
                    value = parts[0] + ',' + parts[1];
                }
                if (parts[1] && parts[1].length > 2) {
                    value = parts[0] + ',' + parts[1].substring(0, 2);
                }
            }
            
            // Değeri güncelle
            this.value = value;
        });

        // Mobil klavyede decimal klavye açılması için
        input.setAttribute('inputmode', 'decimal');
    });
}

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

// Kart tipi seçimi
document.querySelectorAll('.card-type-btn').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.card-type-btn').forEach(btn => btn.classList.remove('selected'));
        button.classList.add('selected');
        document.getElementById('cardType').value = button.dataset.type;
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

    const cardType = document.getElementById('cardType').value;
    if (!cardType) {
        alert('Lütfen kart tipini seçin');
        return;
    }
    
    const bank = {
        id: Date.now(),
        name: bankName,
        iban: formatIBAN(iban),
        balance: 0,
        currency: currency,
        cardType: cardType // Yeni alan
    };
    
    banks.push(bank);
    saveData();
    renderBanks();
    bankForm.reset();
    document.querySelectorAll('.bank-select-btn').forEach(btn => btn.classList.remove('selected'));
    document.querySelectorAll('.card-type-btn').forEach(btn => btn.classList.remove('selected'));
    bankModal.classList.remove('active');
});

// Para birimi seçimi için event listener'ları ekle
document.querySelectorAll('#debtModal .currency-select-btn').forEach(button => {
    button.addEventListener('click', function() {
        document.querySelectorAll('#debtModal .currency-select-btn').forEach(btn => 
            btn.classList.remove('selected'));
        this.classList.add('selected');
        document.getElementById('debtCurrency').value = this.dataset.currency;
    });
});

document.querySelectorAll('#subscriptionModal .currency-select-btn').forEach(button => {
    button.addEventListener('click', function() {
        document.querySelectorAll('#subscriptionModal .currency-select-btn').forEach(btn => 
            btn.classList.remove('selected'));
        this.classList.add('selected');
        document.getElementById('subscriptionCurrency').value = this.dataset.currency;
    });
});

// Form submit olaylarında virgüllü değerleri parse et
function parseAmount(value) {
    if (typeof value === 'string') {
        return parseFloat(value.replace(',', '.'));
    }
    return value;
}

// Form submit olaylarını güncelle
debtForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const currency = document.getElementById('debtCurrency').value;
    if (!currency) {
        alert('Lütfen bir para birimi seçin');
        return;
    }
    
    const debt = {
        id: Date.now(),
        title: document.getElementById('debtTitle').value,
        amount: parseAmount(document.getElementById('debtAmount').value),
        currency: currency,
        dueDate: document.getElementById('dueDate').value || null,
        isPaid: document.getElementById('isPaid').checked
    };
    
    debts.push(debt);
    saveData();
    renderDebts();
    debtForm.reset();
    document.querySelectorAll('#debtModal .currency-select-btn').forEach(btn => 
        btn.classList.remove('selected'));
    debtModal.classList.remove('active');
});

// Abonelik ekleme formunu güncelle
subscriptionForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const currency = document.getElementById('subscriptionCurrency').value;
    if (!currency) {
        alert('Lütfen bir para birimi seçin');
        return;
    }
    
    const subscription = {
        id: Date.now(),
        title: document.getElementById('subscriptionTitle').value,
        amount: parseAmount(document.getElementById('subscriptionAmount').value),
        currency: currency,
        period: document.getElementById('subscriptionPeriod').value,
        paymentDate: document.getElementById('subscriptionDate').value,
        lastPaymentDate: null,
        isPaid: false
    };
    
    subscriptions.push(subscription);
    saveData();
    renderSubscriptions();
    subscriptionForm.reset();
    document.querySelectorAll('#subscriptionModal .currency-select-btn').forEach(btn => 
        btn.classList.remove('selected'));
    subscriptionModal.classList.remove('active');
});

expenseForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const amount = parseAmount(document.getElementById('expenseAmount').value);
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
                    <small class="card-type">${bank.cardType === 'debit' ? 'Debit Kart' : 'Kredi Kartı'}</small>
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
            <p class="amount">${formatCurrency(debt.amount, debt.currency)}</p>
            ${debt.dueDate ? `<p class="due-date">Son Ödeme: ${formatDate(debt.dueDate)}</p>` : ''}
        </div>
    `).join('');
    updateTotals();
}

function renderSubscriptions() {
    subscriptionsList.innerHTML = subscriptions.map(subscription => {
        const nextPayment = getNextPaymentDate(subscription);
        const isOverdue = isPaymentOverdue(subscription);
        const isPaid = subscription.isPaid && subscription.lastPaymentDate;
        
        return `
            <div class="subscription-card ${isOverdue ? 'overdue' : ''} ${isPaid ? 'paid-subscription' : ''}" 
                 onclick="showSubscriptionDetail(${subscription.id})">
                <h3>${subscription.title}</h3>
                <p class="amount">${formatCurrency(subscription.amount, subscription.currency)}</p>
                <div class="subscription-info">
                    <span>${subscription.period === 'monthly' ? 'Aylık' : 'Yıllık'}</span>
                    <div class="payment-date">
                        <span class="material-icons">${isOverdue ? 'warning' : isPaid ? 'check_circle' : 'event'}</span>
                        <span>${isOverdue ? 'Ödeme Gecikti!' : 
                               isPaid ? 'Bu Ay Ödendi - Sonraki: ' + formatDate(nextPayment) :
                               'Sonraki Ödeme: ' + formatDate(nextPayment)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Toplam abonelik miktarını hesapla ve göster (varsayılan para birimine çevirerek)
    const totalMonthly = subscriptions.reduce((total, subscription) => {
        const amount = parseFloat(subscription.amount) || 0;
        const amountInDefaultCurrency = convertCurrency(amount, subscription.currency, userSettings.defaultCurrency);
        if (subscription.period === 'monthly') {
            return total + amountInDefaultCurrency;
        } else { // yearly
            return total + (amountInDefaultCurrency / 12);
        }
    }, 0);

    document.getElementById('totalSubscriptionAmount').textContent = formatCurrency(totalMonthly, userSettings.defaultCurrency);
    updateTotals();
}

// Ay seçici butonları için event listener'lar
document.getElementById('prevMonth').addEventListener('click', () => {
    selectedDate.setMonth(selectedDate.getMonth() - 1);
    updateSelectedMonthDisplay();
    renderExpenses();
});

document.getElementById('nextMonth').addEventListener('click', () => {
    selectedDate.setMonth(selectedDate.getMonth() + 1);
    updateSelectedMonthDisplay();
    renderExpenses();
});

// Seçili ayı görüntüleme
function updateSelectedMonthDisplay() {
    const options = { year: 'numeric', month: 'long' };
    document.getElementById('selectedMonth').textContent = selectedDate.toLocaleDateString('tr-TR', options);
}

// Harcamaları render etme fonksiyonunu güncelle
function renderExpenses() {
    const expensesList = document.getElementById('expensesList');
    expensesList.innerHTML = '';
    
    // Seçili ayın başlangıç ve bitiş tarihleri
    const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
    
    // Seçili aya ait harcamaları filtrele
    const filteredExpenses = expenses.filter(expense => {
        const expenseDate = new Date(expense.date);
        return expenseDate >= startOfMonth && expenseDate <= endOfMonth;
    });
    
    // Harcamaları tarihe göre sırala (en yeni en üstte)
    filteredExpenses.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    filteredExpenses.forEach(expense => {
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

// Toplam harcamaları güncelleme fonksiyonunu güncelle
function updateTotalExpenses() {
    // Seçili ayın başlangıç ve bitiş tarihleri
    const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
    
    // Seçili aya ait toplam harcama
    const monthlyTotal = expenses
        .filter(expense => {
            const expenseDate = new Date(expense.date);
            return expenseDate >= startOfMonth && expenseDate <= endOfMonth;
        })
        .reduce((sum, expense) => {
            // Harcama tutarını varsayılan para birimine çevir
            const amountInDefaultCurrency = convertCurrency(expense.amount, expense.currency, userSettings.defaultCurrency);
            return sum + amountInDefaultCurrency;
        }, 0);
    
    monthlyExpensesElement.textContent = formatCurrency(monthlyTotal, userSettings.defaultCurrency);
    updateTotals();
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
    const detailAmount = document.getElementById('debtDetailAmount');
    const detailDate = document.getElementById('debtDetailDate');
    const detailIsPaid = document.getElementById('detailIsPaid');
    const detailDeleteBtn = document.getElementById('detailDeleteBtn');

    detailTitle.textContent = debt.title;
    detailAmount.value = debt.amount;
    detailDate.value = debt.dueDate || '';
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
    const detailBalance = document.getElementById('bankDetailBalanceDisplay');
    const deleteBtn = document.getElementById('bankDetailDelete');
    currentBankId = bankId; // Global değişken olarak sakla

    detailTitle.textContent = bank.name;
    detailIban.textContent = formatIBAN(bank.iban);
    detailBalance.textContent = formatCurrency(bank.balance, bank.currency);

    // Transfer için diğer bankaları listele
    const targetBankSelect = document.getElementById('targetBank');
    targetBankSelect.innerHTML = '<option value="">Hedef Hesap Seçin</option>' +
        banks.filter(b => b.id !== bankId)
            .map(b => `<option value="${b.id}">${b.name} (${formatCurrency(b.balance, b.currency)})</option>`)
            .join('');

    deleteBtn.onclick = () => {
        if (confirm('Bu bankayı silmek istediğinizden emin misiniz?')) {
            banks = banks.filter(b => b.id !== bankId);
            saveData();
            renderBanks();
            bankDetailModal.classList.remove('active');
        }
    };

    bankDetailModal.classList.add('active');
    hideAddMoneyForm();
    hideTransferForm();
}

// Para ekleme formunu göster
function showAddMoneyForm() {
    document.getElementById('addMoneyForm').style.display = 'block';
    document.getElementById('transferForm').style.display = 'none';
    document.getElementById('addAmount').value = '';
}

// Para ekleme formunu gizle
function hideAddMoneyForm() {
    document.getElementById('addMoneyForm').style.display = 'none';
}

// Transfer formunu göster
function showTransferForm() {
    document.getElementById('transferForm').style.display = 'block';
    document.getElementById('addMoneyForm').style.display = 'none';
    document.getElementById('transferAmount').value = '';
}

// Transfer formunu gizle
function hideTransferForm() {
    document.getElementById('transferForm').style.display = 'none';
}

// Para ekleme işlemi
function addMoney() {
    const amount = parseAmount(document.getElementById('addAmount').value);
    if (!amount || amount <= 0) {
        alert('Lütfen geçerli bir miktar girin');
        return;
    }

    const bankIndex = banks.findIndex(b => b.id === currentBankId);
    if (bankIndex === -1) return;

    banks[bankIndex].balance += amount;
    saveData();
    renderBanks();
    showBankDetail(currentBankId); // Detay görünümünü güncelle
    hideAddMoneyForm();
}

// Para transferi işlemi
function transferMoney() {
    const amount = parseAmount(document.getElementById('transferAmount').value);
    const targetBankId = document.getElementById('targetBank').value;

    if (!amount || amount <= 0) {
        alert('Lütfen geçerli bir miktar girin');
        return;
    }

    if (!targetBankId) {
        alert('Lütfen hedef hesap seçin');
        return;
    }

    const sourceBankIndex = banks.findIndex(b => b.id === currentBankId);
    const targetBankIndex = banks.findIndex(b => b.id === parseInt(targetBankId));

    if (sourceBankIndex === -1 || targetBankIndex === -1) return;

    const sourceBank = banks[sourceBankIndex];
    const targetBank = banks[targetBankIndex];

    if (sourceBank.balance < amount) {
        alert('Yetersiz bakiye');
        return;
    }

    // Para birimlerini kontrol et ve gerekirse dönüşüm yap
    let transferAmount = amount;
    if (sourceBank.currency !== targetBank.currency) {
        // Önce TRY'ye çevir
        const amountInTRY = convertToTRY(amount, sourceBank.currency);
        // Hedef para birimine çevir
        transferAmount = convertCurrency(amountInTRY, 'TRY', targetBank.currency);
    }

    // Transfer işlemini gerçekleştir
    sourceBank.balance -= amount;
    targetBank.balance += transferAmount;

    saveData();
    renderBanks();
    showBankDetail(currentBankId); // Detay görünümünü güncelle
    hideTransferForm();
}

// Global değişken olarak currentBankId'yi tanımla
let currentBankId = null;

// Abonelik detay modalını güncelle
function showSubscriptionDetail(subscriptionId) {
    const subscription = subscriptions.find(s => s.id === subscriptionId);
    if (!subscription) return;

    const detailTitle = document.getElementById('subscriptionDetailTitle');
    const detailAmount = document.getElementById('subscriptionDetailAmount');
    const detailPeriod = document.getElementById('subscriptionDetailPeriod');
    const detailDate = document.getElementById('subscriptionDetailDate');
    const detailPaid = document.getElementById('subscriptionDetailPaid');
    const saveBtn = document.getElementById('subscriptionDetailSave');
    const deleteBtn = document.getElementById('subscriptionDetailDelete');

    detailTitle.textContent = subscription.title;
    detailAmount.value = subscription.amount;
    detailPeriod.value = subscription.period;
    detailDate.value = subscription.paymentDate;
    detailPaid.checked = subscription.isPaid;

    saveBtn.onclick = () => {
        const newAmount = parseAmount(detailAmount.value);
        if (!isNaN(newAmount) && newAmount >= 0) {
            const index = subscriptions.findIndex(s => s.id === subscriptionId);
            if (index !== -1) {
                const isPaidChanged = detailPaid.checked !== subscriptions[index].isPaid;
                
                subscriptions[index] = {
                    ...subscriptions[index],
                    amount: newAmount,
                    period: detailPeriod.value,
                    paymentDate: detailDate.value,
                    isPaid: detailPaid.checked,
                    lastPaymentDate: isPaidChanged && detailPaid.checked ? new Date().toISOString() : subscriptions[index].lastPaymentDate
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

// Sonraki ödeme tarihini hesaplama fonksiyonunu güncelle
function getNextPaymentDate(subscription) {
    const today = new Date();
    let baseDate;

    // Eğer son ödeme yapıldıysa, son ödeme tarihini baz al
    if (subscription.lastPaymentDate && subscription.isPaid) {
        baseDate = new Date(subscription.lastPaymentDate);
    } else {
        baseDate = new Date(subscription.paymentDate);
    }

    const nextPayment = new Date(baseDate);

    if (subscription.period === 'monthly') {
        // Aylık abonelik için
        while (nextPayment < today) {
            nextPayment.setMonth(nextPayment.getMonth() + 1);
        }
    } else {
        // Yıllık abonelik için
        while (nextPayment < today) {
            nextPayment.setFullYear(nextPayment.getFullYear() + 1);
        }
    }

    return nextPayment;
}

// Ödeme gecikme kontrolünü güncelle
function isPaymentOverdue(subscription) {
    const today = new Date();
    const nextPayment = getNextPaymentDate(subscription);
    
    // Eğer bu ay ödendiyse, gecikme yok
    if (subscription.isPaid && subscription.lastPaymentDate) {
        const lastPayment = new Date(subscription.lastPaymentDate);
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        const paymentMonth = lastPayment.getMonth();
        const paymentYear = lastPayment.getFullYear();
        
        // Aynı ay içindeyse veya gelecek bir tarihse gecikme yok
        if ((currentYear === paymentYear && currentMonth === paymentMonth) || 
            lastPayment > today) {
            return false;
        }
    }
    
    return today > nextPayment;
}

function updateTotals() {
    const today = new Date();
    
    // Ödenmemiş borçların toplamını varsayılan para birimine çevir
    const totalDebt = debts
        .filter(debt => !debt.isPaid)
        .reduce((sum, debt) => {
            const amountInDefaultCurrency = convertCurrency(debt.amount, debt.currency, userSettings.defaultCurrency);
            return sum + amountInDefaultCurrency;
        }, 0);
    
    // Vadesi geçmiş ve ödenmemiş aboneliklerin toplamını varsayılan para birimine çevir
    const overdueSubscriptions = subscriptions
        .filter(s => isPaymentOverdue(s) && !s.isPaid)
        .reduce((sum, s) => {
            const amountInDefaultCurrency = convertCurrency(s.amount, s.currency, userSettings.defaultCurrency);
            if (s.period === 'monthly') {
                return sum + amountInDefaultCurrency;
            } else { // yearly
                return sum + (amountInDefaultCurrency / 12);
            }
        }, 0);
    
    // Tüm varlıkları varsayılan para birimine çevir
    const totalAssetsInDefaultCurrency = calculateTotalAssetsInCurrency(userSettings.defaultCurrency);
    
    // Toplam borcu varsayılan para biriminde göster
    const totalDebtInDefaultCurrency = totalDebt + overdueSubscriptions;
    
    totalDebtElement.textContent = formatCurrency(totalDebtInDefaultCurrency, userSettings.defaultCurrency);
    totalAssetsElement.textContent = formatCurrency(totalAssetsInDefaultCurrency - totalDebtInDefaultCurrency, userSettings.defaultCurrency);
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
            settings: userSettings,
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
            userSettings = data.settings || { defaultCurrency: 'TRY' };
            
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
    const expenseDetailModal = document.getElementById('expenseDetailModal');
    
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
            expenseDetailModal.classList.remove('active');
        }
    };
    
    // Modal'ı göster
    expenseDetailModal.classList.add('active');
    
    // Kapatma butonuna tıklama olayını ekle
    const closeBtn = expenseDetailModal.querySelector('.close-btn');
    closeBtn.onclick = () => {
        expenseDetailModal.classList.remove('active');
    };
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

// Kullanıcı ayarları modalı
document.getElementById('settingsBtn').addEventListener('click', () => {
    document.getElementById('settingsModal').classList.add('active');
    // Mevcut varsayılan para birimini seç
    document.querySelectorAll('#settingsModal .currency-select-btn').forEach(btn => {
        if (btn.dataset.currency === userSettings.defaultCurrency) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });
});

// Ayarlar modalındaki iptal butonuna tıklandığında modalı kapat
document.querySelector('#settingsModal .cancel-btn').addEventListener('click', () => {
    document.getElementById('settingsModal').classList.remove('active');
});

// Para birimi seçimi için event listener
document.querySelectorAll('#settingsModal .currency-select-btn').forEach(button => {
    button.addEventListener('click', function() {
        document.querySelectorAll('#settingsModal .currency-select-btn').forEach(btn => 
            btn.classList.remove('selected'));
        this.classList.add('selected');
        document.getElementById('defaultCurrency').value = this.dataset.currency;
    });
});

// Ayarları kaydet
document.getElementById('settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const defaultCurrency = document.getElementById('defaultCurrency').value;
    
    if (!defaultCurrency) {
        alert('Lütfen varsayılan para birimini seçin');
        return;
    }

    userSettings.defaultCurrency = defaultCurrency;
    
    try {
        await saveUserSettings();
        document.getElementById('settingsModal').classList.remove('active');
    } catch (error) {
        alert('Ayarlar kaydedilirken bir hata oluştu');
    }
});

// Firebase Auth state değişikliğini dinle ve ayarları yükle
firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        await loadUserSettings(); // Önce ayarları yükle
        await loadData(); // Sonra verileri yükle
    } else {
        currentUser = null;
        banks = [];
        debts = [];
        subscriptions = [];
        expenses = [];
        userSettings = { defaultCurrency: 'TRY' };
    }
});

// DOM yüklendiğinde input kontrollerini başlat
document.addEventListener('DOMContentLoaded', () => {
    setupAmountInputs();
    initTheme();
    updateSelectedMonthDisplay();
});

// Modal açıldığında yeni eklenen inputlar için kontrolleri tekrar başlat
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('shown', setupAmountInputs);
});

async function saveUserSettings() {
    try {
        if (!currentUser) {
            throw new Error('Kullanıcı oturum açmamış');
        }

        // Önce kullanıcı dokümanını oluştur
        const userDocRef = firebase.firestore().collection('users').doc(currentUser.uid);
        await userDocRef.set({
            email: currentUser.email,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Sonra ayarları kaydet
        const userSettingsRef = userDocRef.collection('settings').doc('preferences');
        await userSettingsRef.set({
            defaultCurrency: userSettings.defaultCurrency,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Başarılı kayıt sonrası totalleri güncelle
        updateTotals();
        renderExpenses();
    } catch (error) {
        console.error('Ayarlar kaydedilemedi:', error);
        throw error;
    }
}

async function loadUserSettings() {
    try {
        if (!currentUser) {
            throw new Error('Kullanıcı oturum açmamış');
        }

        const userSettingsRef = firebase.firestore()
            .collection('users')
            .doc(currentUser.uid)
            .collection('settings')
            .doc('preferences');

        const doc = await userSettingsRef.get();
        
        if (doc.exists) {
            userSettings = {
                defaultCurrency: doc.data().defaultCurrency || 'TRY'
            };
        } else {
            // Varsayılan ayarları kaydet
            await userSettingsRef.set({
                defaultCurrency: 'TRY',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            userSettings = { defaultCurrency: 'TRY' };
        }

        // Ayarlar modalındaki seçili para birimini güncelle
        document.querySelectorAll('#settingsModal .currency-select-btn').forEach(btn => {
            if (btn.dataset.currency === userSettings.defaultCurrency) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });

    } catch (error) {
        console.error('Kullanıcı ayarları yüklenemedi:', error);
        userSettings = { defaultCurrency: 'TRY' };
    }
}

// Para birimi dönüştürme fonksiyonunu güncelle
function convertCurrency(amount, fromCurrency, toCurrency) {
    if (!exchangeRates || fromCurrency === toCurrency) return amount;
    
    // Önce TRY'ye çevir
    const amountInTRY = amount * exchangeRates[fromCurrency];
    
    // Sonra hedef para birimine çevir
    return amountInTRY / exchangeRates[toCurrency];
}

// Toplam varlıkları hesaplama fonksiyonunu güncelle
function calculateTotalAssetsInCurrency(targetCurrency) {
    return banks.reduce((total, bank) => {
        const amountInTargetCurrency = convertCurrency(bank.balance, bank.currency, targetCurrency);
        return total + amountInTargetCurrency;
    }, 0);
}