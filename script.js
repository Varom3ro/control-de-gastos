const defaultCategories = [
    { id: 'cat1', name: 'Salario', planned: 0, type: 'income' },
    { id: 'cat2', name: 'Mercado', planned: 0, type: 'expense' },
    { id: 'cat3', name: 'Servicios', planned: 0, type: 'expense' },
    { id: 'cat13', name: 'Esparcimiento', planned: 0, type: 'expense' }
];

let categories = JSON.parse(localStorage.getItem('gastos_categories')) || defaultCategories;
let transactions = JSON.parse(localStorage.getItem('gastos_transactions')) || [];
let wallets = JSON.parse(localStorage.getItem('gastos_wallets')) || [
    { id: 'w1', name: 'Efectivo', balance: 0 }
];
let amountsHidden = localStorage.getItem('gastos_hidden') === 'true';

// Migración: initialBalance -> balance
wallets.forEach(w => {
    if (w.initialBalance !== undefined && w.balance === undefined) {
        w.balance = w.initialBalance;
        delete w.initialBalance;
    }
    if (w.balance === undefined) w.balance = 0;
});

// Migración: Asegurar que todas las transacciones tengan un walletId
transactions.forEach(t => {
    if (!t.walletId) t.walletId = wallets[0].id;
});

function toggleVisibility() {
    amountsHidden = !amountsHidden;
    localStorage.setItem('gastos_hidden', amountsHidden);
    if(document.getElementById('visibility-btn')) {
        document.getElementById('visibility-btn').textContent = amountsHidden ? '🔒' : '👁️';
    }
    renderApp();
}

const currentDateObj = new Date();
let currentViewMonth = currentDateObj.getMonth();
let currentViewYear = currentDateObj.getFullYear();
const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

if (!localStorage.getItem('gastos_categories')) {
    localStorage.setItem('gastos_categories', JSON.stringify(categories));
}

// DOM Elements
const totalAvailableEl = document.getElementById('total-available');
const totalIncomeEl = document.getElementById('total-income');
const totalSpentEl = document.getElementById('total-spent');
const categoriesContainer = document.getElementById('categories-container');
const historyContainer = document.getElementById('history-container');
const tabBtns = document.querySelectorAll('.tab-btn');
const views = document.querySelectorAll('.view');
const modal = document.getElementById('transaction-modal');
const form = document.getElementById('transaction-form');

// Tabs logic
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        views.forEach(v => v.classList.add('hidden'));
        
        btn.classList.add('active');
        document.getElementById(btn.dataset.target).classList.remove('hidden');
    });
});

// Month navigation
document.getElementById('prev-month-btn').addEventListener('click', () => {
    currentViewMonth--;
    if (currentViewMonth < 0) {
        currentViewMonth = 11;
        currentViewYear--;
    }
    renderApp();
});
document.getElementById('next-month-btn').addEventListener('click', () => {
    currentViewMonth++;
    if (currentViewMonth > 11) {
        currentViewMonth = 0;
        currentViewYear++;
    }
    renderApp();
});

// Modal Logic
document.getElementById('add-fab').addEventListener('click', openAddModal);

function openAddModal() {
    // Populate select
    const select = document.getElementById('t-category');
    select.innerHTML = '<option value="" disabled selected>Selecciona Categoría...</option>';
    
    // Group categories
    const incomes = categories.filter(c => c.type === 'income');
    const expenses = categories.filter(c => c.type === 'expense');

    const expGroup = document.createElement('optgroup');
    expGroup.label = "Gastos (Presupuesto)";
    expenses.forEach(c => expGroup.innerHTML += `<option value="${c.id}">${c.name}</option>`);
    
    const incGroup = document.createElement('optgroup');
    incGroup.label = "Ingresos";
    incomes.forEach(c => incGroup.innerHTML += `<option value="${c.id}">${c.name}</option>`);

    select.appendChild(expGroup);
    select.appendChild(incGroup);

    // Set today's date
    document.getElementById('t-date').valueAsDate = new Date();
    form.reset();
    document.getElementById('t-date').valueAsDate = new Date();

    // Default to Esparcimiento
    const esparcimiento = categories.find(c => c.name.toLowerCase() === 'esparcimiento');
    if (esparcimiento) document.getElementById('t-category').value = esparcimiento.id;
    
    modal.classList.remove('hidden');
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

// Form Submit
form.addEventListener('submit', (e) => {
    e.preventDefault();
    const catId = document.getElementById('t-category').value;
    const amountInput = parseFloat(document.getElementById('t-amount').value);
    const currency = document.getElementById('t-currency').value;
    const date = document.getElementById('t-date').value;
    let note = document.getElementById('t-note').value;

    let finalAmount = amountInput;

    if (currency === 'VES') {
        if (!window.lastBCVRate) {
            alert("No hay una tasa BCV cargada. Activa tu internet para bajar la tasa, o toca el espacio vacío del BCV arriba para ingresarla a mano.");
            return;
        }
        finalAmount = amountInput / window.lastBCVRate;
        const formattedBs = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2 }).format(amountInput);
        const bsNote = `(Pagó Bs. ${formattedBs})`;
        note = note.trim() ? `${note} - ${bsNote}` : bsNote;
    }

    const walletId = document.getElementById('t-wallet').value;

    transactions.push({
        id: Date.now().toString(),
        categoryId: catId,
        walletId: walletId,
        amount: finalAmount,
        note: note,
        date: date
    });

    // Actualizar saldo de la billetera directamente
    const wallet = wallets.find(w => w.id === walletId);
    if (wallet) {
        const catType = categories.find(c => c.id === catId);
        if (catType && catType.type === 'income') wallet.balance += finalAmount;
        else wallet.balance -= finalAmount;
    }

    saveData();
    renderApp();
    closeModal('transaction-modal');
});

function deleteTx(id) {
    if(confirm('¿Eliminar este registro?')) {
        transactions = transactions.filter(t => t.id !== id);
        saveData();
        renderApp();
    }
}

function saveData() {
    localStorage.setItem('gastos_transactions', JSON.stringify(transactions));
    localStorage.setItem('gastos_categories', JSON.stringify(categories));
    localStorage.setItem('gastos_wallets', JSON.stringify(wallets));
}

function formatMoney(amount) {
    if (amountsHidden) return '***';
    return '$' + parseFloat(amount).toFixed(2);
}

function renderApp() {
    let totalIncome = 0;
    let totalSpent = 0;
    
    if(document.getElementById('visibility-btn')) {
        document.getElementById('visibility-btn').textContent = amountsHidden ? '🔒' : '👁️';
    }
    
    document.getElementById('current-month-label').textContent = `${monthNames[currentViewMonth]} ${currentViewYear}`;

    // Filtrar transacciones del mes seleccionado
    const txMesActual = transactions.filter(t => {
        const [year, month, day] = t.date.split('-');
        return parseInt(year) === currentViewYear && (parseInt(month) - 1) === currentViewMonth;
    });

    // Saldo directo de billeteras
    const walletBalances = {};
    wallets.forEach(w => walletBalances[w.id] = w.balance);

    let globalAvailable = Object.values(walletBalances).reduce((a, b) => a + b, 0);

    // Calcular montos reales del mes actual
    const catTotals = {};
    categories.forEach(c => catTotals[c.id] = 0);

    txMesActual.forEach(t => {
        const cat = categories.find(c => c.id === t.categoryId);
        if (!cat) return;

        if(catTotals[t.categoryId] !== undefined) {
            catTotals[t.categoryId] += t.amount;
            
            // Excluir transferencias de los totales mensuales
            if (cat.name.includes("Transferencia")) return;

            if(cat.type === 'income') totalIncome += t.amount;
            else totalSpent += t.amount;
        }
    });

    // Guardar balances para la vista de billeteras
    window.currentWalletBalances = walletBalances;
    renderWallets();

    // Llenar selector de billeteras en el form
    const walletSelect = document.getElementById('t-wallet');
    walletSelect.innerHTML = wallets.map(w => `<option value="${w.id}">${w.name}</option>`).join('');

    // Header: Billetera principal (Efectivo) y secundarias
    const efectivo = wallets.find(w => w.name.toLowerCase() === 'efectivo');
    const mainBalance = efectivo ? efectivo.balance : globalAvailable;
    totalAvailableEl.textContent = formatMoney(mainBalance);
    totalIncomeEl.textContent = formatMoney(totalIncome);
    totalSpentEl.textContent = formatMoney(totalSpent);
    window.lastGlobalAvailable = mainBalance;
    updateBsBalance();

    // Billeteras secundarias (las que no son Efectivo)
    const secundarias = wallets.filter(w => w.name.toLowerCase() !== 'efectivo');
    const leftWallet = secundarias[0];
    const rightWallet = secundarias[1];

    if (leftWallet) {
        document.getElementById('wallet-left-name').textContent = leftWallet.name;
        document.getElementById('wallet-left-balance').textContent = formatMoney(leftWallet.balance);
    }
    if (rightWallet) {
        document.getElementById('wallet-right-name').textContent = rightWallet.name;
        document.getElementById('wallet-right-balance').textContent = formatMoney(rightWallet.balance);
    }

    // Lógica dinámica para Esparcimiento
    const salarioCat = categories.find(c => c.name.toLowerCase() === 'salario');
    const esparcimientoCat = categories.find(c => c.name.toLowerCase() === 'esparcimiento');
    if (salarioCat && esparcimientoCat) {
        let expenseMetas = 0;
        categories.forEach(c => {
            if (c.type === 'expense' && c.id !== esparcimientoCat.id && !c.name.includes('Transferencia')) {
                expenseMetas += c.planned;
            }
        });
        esparcimientoCat.planned = Math.max(0, salarioCat.planned - expenseMetas);
        saveData();
    }

    // Render Categories
    categoriesContainer.innerHTML = '';
    const visibleCats = categories.filter(cat => {
        if (cat.type === 'income') return false;
        if (cat.name.includes('Transferencia')) return false;
        return true;
    });
    // Las que llegan al 100% van al final
    visibleCats.sort((a, b) => {
        const pA = a.planned > 0 ? (catTotals[a.id] || 0) / a.planned : 0;
        const pB = b.planned > 0 ? (catTotals[b.id] || 0) / b.planned : 0;
        const aFull = pA >= 1 ? 1 : 0;
        const bFull = pB >= 1 ? 1 : 0;
        return aFull - bFull;
    });
    visibleCats.forEach(cat => {

        const spent = catTotals[cat.id] || 0;
        const remaining = cat.planned - spent;
        const percent = Math.min((spent / cat.planned) * 100, 100) || 0;
        
        let progressClass = 'progress-fill';
        let remainingText = '';

        if (cat.type === 'income') {
            progressClass += ' income';
            remainingText = `${formatMoney(spent)} / ${formatMoney(cat.planned)} cobrado`;
        } else {
            if (percent > 100) progressClass += ' over';
            else if (percent === 100) progressClass += ' income'; // Usamos el verde de income para el 100% exacto
            else if (percent >= 80) progressClass += ' warning';
            
            if (remaining < 0) remainingText = `Te excediste por ${formatMoney(Math.abs(remaining))}`;
            else remainingText = `Faltan ${formatMoney(remaining)}`;
        }

        const html = `
            <div class="cat-card" draggable="true" data-id="${cat.id}">
                <div class="cat-header">
                    <span class="cat-name">${cat.name}</span>
                    <span class="cat-amounts">
                        <strong>${formatMoney(spent)}</strong> <span style="font-size:12px">/ ${formatMoney(cat.planned)}</span>
                    </span>
                </div>
                <div class="progress-bg">
                    <div class="${progressClass}" style="width: ${percent}%"></div>
                </div>
                <div class="cat-footer">
                    <span>${percent.toFixed(0)}%</span>
                    <span>${remainingText}</span>
                </div>
            </div>
        `;
        categoriesContainer.innerHTML += html;
    });

    // Render History
    historyContainer.innerHTML = '';
    if(txMesActual.length === 0) {
        historyContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #94a3b8;">No hay gastos este mes</div>';
    } else {
        // Sort by date desc
        const sortedTx = [...txMesActual].sort((a, b) => new Date(b.date) - new Date(a.date));
        
        sortedTx.forEach(t => {
            const cat = categories.find(c => c.id === t.categoryId);
            if(!cat) return;
            
            const isInc = cat.type === 'income';
            
            const html = `
                <div class="history-item">
                    <div class="history-info">
                        <span class="history-cat">${cat.name}</span>
                        ${t.note ? `<span class="history-note">${t.note}</span>` : ''}
                        <span class="history-date">${t.date}</span>
                    </div>
                    <div class="history-right">
                        <span class="history-amount ${isInc ? 'income' : 'expense'}">
                            ${isInc ? '+' : '-'}${formatMoney(t.amount)}
                        </span>
                        <button class="del-btn" onclick="deleteTx('${t.id}')">×</button>
                    </div>
                </div>
            `;
            historyContainer.innerHTML += html;
        });
    }
}

// Settings Modals
document.getElementById('settings-btn').addEventListener('click', () => {
    renderSettingsCats();
    document.getElementById('settings-modal').classList.remove('hidden');
});

// Fetch BCV
async function fetchBCVRate() {
    const rateEl = document.getElementById('bcv-rate');
    const today = new Date().toISOString().split('T')[0];
    
    // Validar manual override for today
    const override = JSON.parse(localStorage.getItem('bcv_override'));
    if (override && override.date === today) {
        window.lastBCVRate = override.amount;
        rateEl.textContent = `BCV: Bs. ${override.amount.toFixed(4)}`;
        updateBsBalance();
        return;
    }

    try {
        const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
        const data = await res.json();
        if (data && data.promedio) {
            window.lastBCVRate = data.promedio;
            rateEl.textContent = `BCV: Bs. ${data.promedio.toFixed(4)}`;
            updateBsBalance();
        }
    } catch (e) {
        rateEl.textContent = `BCV: -`;
    }
}

function updateBsBalance() {
    const el = document.getElementById('total-available-bs');
    if (el && window.lastBCVRate && window.lastGlobalAvailable !== undefined) {
        if (amountsHidden) {
            el.textContent = 'Bs. ***';
            return;
        }
        const totalBs = window.lastGlobalAvailable * window.lastBCVRate;
        const formattedBs = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalBs);
        el.textContent = `Bs. ${formattedBs}`;
    }
}

document.getElementById('bcv-rate').addEventListener('click', () => {
    const override = JSON.parse(localStorage.getItem('bcv_override'));
    const initial = override ? override.amount : '';
    const manualRate = prompt('Ingresa la tasa BCV manual para el día de hoy (usa punto para decimales):', initial);
    
    if (manualRate !== null) {
        if (!isNaN(parseFloat(manualRate)) && parseFloat(manualRate) > 0) {
            const today = new Date().toISOString().split('T')[0];
            localStorage.setItem('bcv_override', JSON.stringify({
                amount: parseFloat(manualRate),
                date: today
            }));
        } else if (manualRate.trim() === '') {
            // Permitir borrar el override
            localStorage.removeItem('bcv_override');
        }
        fetchBCVRate();
    }
});

function renderSettingsCats() {
    const list = document.getElementById('settings-cat-list');
    let html = '<h4 style="margin-bottom: 8px; color: var(--income); font-size: 14px;">Ingresos (Ej: Salario)</h4>';
    
    categories.filter(c => c.type === 'income').forEach(cat => {
        html += generateCatRow(cat);
    });

    html += '<h4 style="margin-top: 24px; margin-bottom: 8px; color: var(--expense); font-size: 14px;">Gastos Fijos</h4>';
    categories.filter(c => c.type === 'expense').forEach(cat => {
        html += generateCatRow(cat);
    });
    
    list.innerHTML = html;
}

function generateCatRow(cat) {
    return `
        <div class="cat-edit-item">
            <div class="cat-edit-info">
                <strong>${cat.name}</strong>
                <span style="font-size: 12px; color: var(--text-muted)">
                    ${cat.type === 'income' ? 'Ingreso mensual' : 'Presupuesto'} - ${formatMoney(cat.planned)}
                </span>
            </div>
            <div class="cat-edit-actions">
                <button class="edit-btn" onclick="openCatForm('${cat.id}')">✎</button>
                <button class="del-btn" onclick="deleteCat('${cat.id}')">×</button>
            </div>
        </div>
    `;
}

function openBackupModal() {
    const data = JSON.stringify({ transactions, categories });
    document.getElementById('backup-data').value = btoa(unescape(encodeURIComponent(data)));
    document.getElementById('backup-modal').classList.remove('hidden');
}

function importData() {
    try {
        const raw = document.getElementById('backup-data').value;
        const data = JSON.parse(decodeURIComponent(escape(atob(raw))));
        if (data.transactions && data.categories) {
            transactions = data.transactions;
            categories = data.categories;
            saveData();
            renderApp();
            closeModal('backup-modal');
            closeModal('settings-modal');
        }
    } catch (e) {
        alert('Código inválido');
    }
}

function openCatForm(id = null) {
    const form = document.getElementById('category-form');
    form.reset();
    document.getElementById('cat-modal-title').textContent = id ? 'Editar Categoría' : 'Nueva Categoría';
    
    if (id) {
        const cat = categories.find(c => c.id === id);
        document.getElementById('c-id').value = cat.id;
        document.getElementById('c-name').value = cat.name;
        document.getElementById('c-type').value = cat.type;
        document.getElementById('c-planned').value = cat.planned || '';
    } else {
        document.getElementById('c-id').value = '';
    }
    
    togglePlannedRequired();
    document.getElementById('category-form-modal').classList.remove('hidden');
}

function togglePlannedRequired() {
    const type = document.getElementById('c-type').value;
    const plannedInput = document.getElementById('c-planned');
    if (type === 'income') {
        plannedInput.required = false;
        plannedInput.placeholder = "Opcional (Ej: 0.00)";
    } else {
        plannedInput.required = true;
        plannedInput.placeholder = "0.00";
    }
}

document.getElementById('c-type').addEventListener('change', togglePlannedRequired);

document.getElementById('category-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('c-id').value;
    const name = document.getElementById('c-name').value;
    const type = document.getElementById('c-type').value;
    const planned = parseFloat(document.getElementById('c-planned').value) || 0;

    if (id) {
        const cat = categories.find(c => c.id === id);
        cat.name = name;
        cat.type = type;
        cat.planned = planned;
    } else {
        categories.push({
            id: 'cat_' + Date.now(),
            name, type, planned
        });
    }

    saveData();
    renderSettingsCats();
    renderApp();
    closeModal('category-form-modal');
});

function deleteCat(id) {
    if (confirm('¿Eliminar categoría? Los gastos asociados podrían dejar de aparecer en las estadísticas.')) {
        categories = categories.filter(c => c.id !== id);
        saveData();
        renderSettingsCats();
        renderApp();
    }
}

// Auto-run
renderApp();
fetchBCVRate();

// Drag & Drop Reordering
let draggedItem = null;

categoriesContainer.addEventListener('dragstart', (e) => {
    draggedItem = e.target.closest('.cat-card');
    if (draggedItem) {
        draggedItem.classList.add('dragging');
        setTimeout(() => (draggedItem.style.display = 'none'), 0);
    }
});

categoriesContainer.addEventListener('dragend', (e) => {
    if (draggedItem) {
        draggedItem.classList.remove('dragging');
        draggedItem.style.display = 'block';
        draggedItem = null;
        
        // Update array order based on DOM
        const currentCards = [...categoriesContainer.querySelectorAll('.cat-card')];
        const newOrderIds = currentCards.map(c => c.dataset.id);
        categories.sort((a, b) => newOrderIds.indexOf(a.id) - newOrderIds.indexOf(b.id));
        saveData();
    }
});

categoriesContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    const afterElement = getDragAfterElement(categoriesContainer, e.clientY);
    if (afterElement == null) {
        categoriesContainer.appendChild(draggedItem);
    } else {
        categoriesContainer.insertBefore(draggedItem, afterElement);
    }
});

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.cat-card:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// WALLET LOGIC
function renderWallets() {
    const container = document.getElementById('wallets-container');
    if (!container) return;
    
    container.innerHTML = '';
    wallets.forEach(w => {
        const html = `
            <div class="cat-card">
                <div class="cat-header" style="margin-bottom: 0;">
                    <span class="cat-name">${w.name}</span>
                    <div style="text-align: right; display: flex; align-items: center; gap: 12px;">
                        <span class="history-amount ${w.balance >= 0 ? 'income' : 'expense'}" style="font-size: 18px;">
                            ${formatMoney(w.balance)}
                        </span>
                        <button class="edit-btn" onclick="editWallet('${w.id}')" style="font-size: 14px;">Editar</button>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
}

function openWalletModal() {
    document.getElementById('wallet-modal-title').textContent = 'Nueva Cuenta';
    document.getElementById('wallet-form').reset();
    document.getElementById('w-id').value = '';
    document.getElementById('wallet-modal').classList.remove('hidden');
}

function editWallet(id) {
    const w = wallets.find(wallet => wallet.id === id);
    if (!w) return;
    document.getElementById('wallet-modal-title').textContent = 'Editar Cuenta';
    document.getElementById('w-id').value = w.id;
    document.getElementById('w-name').value = w.name;
    document.getElementById('w-balance').value = w.balance;
    document.getElementById('wallet-modal').classList.remove('hidden');
}

document.getElementById('wallet-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('w-id').value;
    const name = document.getElementById('w-name').value.trim();
    const balance = parseFloat(document.getElementById('w-balance').value) || 0;

    if (!name) return;

    if (id) {
        const index = wallets.findIndex(w => w.id === id);
        if (index !== -1) {
            wallets[index].name = name;
            wallets[index].balance = balance;
        }
    } else {
        wallets.push({ id: 'w' + Date.now(), name: name, balance: balance });
    }

    saveData();
    renderApp();
    closeModal('wallet-modal');
});

// TRANSFER LOGIC
function openTransferModal() {
    const fromSelect = document.getElementById('tr-from');
    const toSelect = document.getElementById('tr-to');
    const options = wallets.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
    
    fromSelect.innerHTML = options;
    toSelect.innerHTML = options;
    
    document.getElementById('transfer-form').reset();
    document.getElementById('transfer-modal').classList.remove('hidden');
}

document.getElementById('transfer-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fromId = document.getElementById('tr-from').value;
    const toId = document.getElementById('tr-to').value;
    const amount = parseFloat(document.getElementById('tr-amount').value);

    if (fromId === toId) {
        alert("La cuenta de origen y destino no pueden ser la misma.");
        return;
    }

    if (amount <= 0) return;

    // Asegurar categoría de transferencia
    let transferCat = categories.find(c => c.name === "Transferencia (Interna)");
    if (!transferCat) {
        transferCat = { id: 'cat_transfer', name: "Transferencia (Interna)", type: 'expense', planned: 0 };
        categories.push(transferCat);
    }

    const timestamp = Date.now().toString();
    const date = new Date().toISOString().split('T')[0];
    const fromWallet = wallets.find(w => w.id === fromId);
    const toWallet = wallets.find(w => w.id === toId);

    // Registrar en historial
    transactions.push({
        id: 't_tr_' + timestamp,
        categoryId: transferCat.id,
        walletId: fromId,
        amount: amount,
        note: `${fromWallet.name} → ${toWallet.name}`,
        date: date
    });

    // Actualizar saldos directamente
    fromWallet.balance -= amount;
    toWallet.balance += amount;

    saveData();
    renderApp();
    closeModal('transfer-modal');
});
