// Инициализация данных
const currencies = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];
let currentCurrency = 'BTC/USDT';
let balance = parseFloat(localStorage.getItem('balance')) || 1000;
let leverage = parseInt(localStorage.getItem('leverage')) || 5;
let openPosition = JSON.parse(localStorage.getItem('openPosition')) || null;
let tradeHistory = JSON.parse(localStorage.getItem('tradeHistory')) || [];

let prices = { 'BTC/USDT': 60000, 'ETH/USDT': 3000, 'SOL/USDT': 150 };
let chartData = { 'BTC/USDT': [], 'ETH/USDT': [], 'SOL/USDT': [] };

// Волатильность (в долях от 1)
const volatility = { 'BTC/USDT': 0.015, 'ETH/USDT': 0.02, 'SOL/USDT': 0.035 };

// Настройка графика
const ctx = document.getElementById('priceChart').getContext('2d');
let chart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: Array(50).fill(''),
        datasets: [{
            label: `${currentCurrency} Цена`,
            data: Array(50).fill(0),
            borderColor: 'rgb(75, 192, 192)',
            tension: 0.1,
            fill: false
        }]
    },
    options: {
        animation: false,
        scales: {
            y: { beginAtZero: false }
        }
    }
});

// Обновление интерфейса
function updateUI() {
    document.getElementById('balance').textContent = balance.toFixed(2);
    document.getElementById('leverageSelect').value = leverage;
    document.getElementById('currentCurrency').textContent = currentCurrency;
    document.getElementById('openPosition').textContent = openPosition 
        ? `${openPosition.type} @ ${openPosition.price} (Объём: ${openPosition.amount})` 
        : 'Нет открытой позиции';

    // Обновление графика
    chart.data.datasets[0].label = `${currentCurrency} Цена`;
    chart.data.datasets[0].data = chartData[currentCurrency];
    chart.update();

    // Обновление истории
    const historyBody = document.getElementById('tradeHistoryBody');
    historyBody.innerHTML = '';
    [...tradeHistory].reverse().forEach(trade => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${trade.type}</td>
            <td>${trade.symbol}</td>
            <td>${trade.entryPrice}</td>
            <td>${trade.exitPrice || '-'}</td>
            <td>${trade.profit ? trade.profit.toFixed(2) : '-'}</td>
        `;
        historyBody.appendChild(row);
    });
}

// Генерация новой цены
function updatePrice() {
    Object.keys(prices).forEach(symbol => {
        const vol = volatility[symbol];
        prices[symbol] *= (1 + (Math.random() - 0.5) * vol * 2);
        prices[symbol] = parseFloat(prices[symbol].toFixed(2));

        // Добавляем в историю графика
        chartData[symbol].push(prices[symbol]);
        if (chartData[symbol].length > 50) chartData[symbol].shift();
    });
    document.getElementById('currentPrice').textContent = prices[currentCurrency];
}

// Смена валюты
function changeCurrency(symbol) {
    currentCurrency = symbol;
    updateUI();
}

// Открытие сделки
function openTrade(type) {
    if (openPosition) {
        alert('Сначала закройте текущую сделку!');
        return;
    }

    const price = prices[currentCurrency];
    const amount = (balance * leverage) / price; // Расчёт объёма с плечом
    openPosition = { type, price, amount, symbol: currentCurrency };
    saveToStorage();
    updateUI();
}

// Закрытие сделки
function closeTrade() {
    if (!openPosition) {
        alert('Нет открытой позиции!');
        return;
    }

    const exitPrice = prices[currentCurrency];
    let profit = 0;

    if (openPosition.type === 'Long') {
        profit = (exitPrice - openPosition.price) * openPosition.amount;
    } else {
        profit = (openPosition.price - exitPrice) * openPosition.amount;
    }

    balance += profit;
    tradeHistory.push({
        type: openPosition.type,
        symbol: openPosition.symbol,
        entryPrice: openPosition.price,
        exitPrice: exitPrice,
        profit: profit
    });

    openPosition = null;
    saveToStorage();
    updateUI();
}

// Смена плеча
function setLev() {
    leverage = parseInt(document.getElementById('leverageSelect').value);
    saveToStorage();
}

// Сохранение в localStorage
function saveToStorage() {
    localStorage.setItem('balance', balance);
    localStorage.setItem('leverage', leverage);
    localStorage.setItem('openPosition', JSON.stringify(openPosition));
    localStorage.setItem('tradeHistory', JSON.stringify(tradeHistory));
}

// Инициализация
function init() {
    currencies.forEach(symbol => {
        if (!chartData[symbol].length) {
            for (let i = 0; i < 50; i++) {
                const price = prices[symbol] * (0.95 + Math.random() * 0.1);
                chartData[symbol].push(parseFloat(price.toFixed(2)));
            }
        }
    });
    updateUI();
    setInterval(updatePrice, 2000); // Обновление каждые 2 секунды
}

// Запуск
init();
