const defaultCategories = [
    { id: 'cat1', name: 'Salario', planned: 0, type: 'income' },
    { id: 'cat2', name: 'Mercado', planned: 0, type: 'expense' },
    { id: 'cat3', name: 'Servicios', planned: 0, type: 'expense' },
    { id: 'cat13', name: 'Esparcimiento', planned: 0, type: 'expense' }
];

let categories = JSON.parse(localStorage.getItem('gastos_categories')) || defaultCategories;
let transactions = JSON.parse(localStorage.getItem('gastos_transactions')) || [];

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

    transactions.push({
        id: Date.now().toString(),
        categoryId: catId,
        amount: finalAmount,
        date,
        note
    });

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
}

function formatMoney(amount) {
    return '$' + parseFloat(amount).toFixed(2);
}

function renderApp() {
    let totalIncome = 0;
    let totalSpent = 0;
    
    document.getElementById('current-month-label').textContent = `${monthNames[currentViewMonth]} ${currentViewYear}`;

    // Filtrar transacciones del mes seleccionado
    const txMesActual = transactions.filter(t => {
        const [year, month, day] = t.date.split('-');
        return parseInt(year) === currentViewYear && (parseInt(month) - 1) === currentViewMonth;
    });

    // Calcular Saldo Acumulado (Disponible Global)
    let globalAvailable = 0;
    transactions.forEach(t => {
        const cat = categories.find(c => c.id === t.categoryId);
        if (cat) {
            if (cat.type === 'income') globalAvailable += t.amount;
            else globalAvailable -= t.amount;
        }
    });

    // Calcular montos reales del mes actual
    const catTotals = {};
    categories.forEach(c => catTotals[c.id] = 0);

    txMesActual.forEach(t => {
        if(catTotals[t.categoryId] !== undefined) {
            catTotals[t.categoryId] += t.amount;
            const catType = categories.find(c => c.id === t.categoryId).type;
            if(catType === 'income') totalIncome += t.amount;
            else totalSpent += t.amount;
        }
    });

    // Header totals
    totalIncomeEl.textContent = formatMoney(totalIncome);
    totalSpentEl.textContent = formatMoney(totalSpent);
    totalAvailableEl.textContent = formatMoney(globalAvailable);
    
    // Guardar global para el cálculo en Bs
    window.lastGlobalAvailable = globalAvailable;
    updateBsBalance();

    // Render Categories
    categoriesContainer.innerHTML = '';
    categories.forEach(cat => {
        const spent = catTotals[cat.id] || 0;
        const remaining = cat.planned - spent;
        const percent = Math.min((spent / cat.planned) * 100, 100) || 0;
        
        let progressClass = 'progress-fill';
        let remainingText = '';

        if (cat.type === 'income') {
            progressClass += ' income';
            remainingText = `${formatMoney(spent)} / ${formatMoney(cat.planned)} cobrado`;
        } else {
            if (percent >= 100) progressClass += ' over';
            else if (percent >= 80) progressClass += ' warning';
            
            if (remaining < 0) remainingText = `Te excediste por ${formatMoney(Math.abs(remaining))}`;
            else remainingText = `Faltan ${formatMoney(remaining)}`;
        }

        const html = `
            <div class="cat-card">
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

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(reg => console.log('SW Registered'))
            .catch(err => console.log('SW Error', err));
    });
}
