// === ИНИЦИАЛИЗАЦИЯ ДАННЫХ ===
const currencies = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];
let currentCurrency = 'BTC/USDT';
let balance = parseFloat(localStorage.getItem('balance')) || 1000;
let leverage = parseInt(localStorage.getItem('leverage')) || 5;
let openPosition = JSON.parse(localStorage.getItem('openPosition')) || null;
let tradeHistory = JSON.parse(localStorage.getItem('tradeHistory')) || [];

// Начальные цены с небольшим рандомом
let prices = {
  'BTC/USDT': 60000 + Math.random() * 1000,
  'ETH/USDT': 3000 + Math.random() * 50,
  'SOL/USDT': 150 + Math.random() * 10
};

// История цен для графика — заполняем начальными значениями
let chartData = {};
currencies.forEach(symbol => {
  if (!chartData[symbol]) {
    chartData[symbol] = Array(50).fill(prices[symbol]);
  }
});

// Волатильность
const volatility = { 'BTC/USDT': 0.015, 'ETH/USDT': 0.02, 'SOL/USDT': 0.035 };

// === ИНИЦИАЛИЗАЦИЯ ГРАФИКА ===
let chart = null;

function initChart() {
  const ctx = document.getElementById('priceChart');
  if (!ctx) {
    console.error('Canvas с id="priceChart" не найден!');
    return;
  }

  // Убедимся, что canvas имеет размеры
  ctx.width = 800;
  ctx.height = 300;

  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: Array(50).fill(''),
      datasets: [{
        label: `${currentCurrency} Цена`,
        data: chartData[currentCurrency],
        borderColor: '#00f3ff',
        backgroundColor: 'rgba(0, 243, 255, 0.1)',
        tension: 0.3,
        fill: true,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      scales: {
        y: {
          beginAtZero: false,
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#00f3ff' }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#888' }
        }
      },
      plugins: {
        legend: { labels: { color: '#00f3ff' } }
      }
    }
  });
}

// === ОБНОВЛЕНИЕ ГРАФИКА ===
function updateChart() {
  if (!chart) return;

  chart.data.datasets[0].label = `${currentCurrency} Цена`;
  chart.data.datasets[0].data = chartData[currentCurrency];
  chart.update();
}

// === ГЕНЕРАЦИЯ ЦЕН ===
function updatePrice() {
  Object.keys(prices).forEach(symbol => {
    const vol = volatility[symbol];
    const change = (Math.random() - 0.48) * 2 * vol;
    prices[symbol] *= (1 + change);
    prices[symbol] = parseFloat(prices[symbol].toFixed(2));

    chartData[symbol].push(prices[symbol]);
    if (chartData[symbol].length > 50) chartData[symbol].shift();
  });

  document.getElementById('currentPrice').textContent = prices[currentCurrency].toFixed(2);
  updateChart();
}

// === СМЕНА ВАЛЮТЫ ===
function changeCurrency(symbol) {
  currentCurrency = symbol;
  updateUI();
}

// === ОТКРЫТИЕ СДЕЛКИ ===
function openTrade(type) {
  if (openPosition) {
    alert('Сначала закройте текущую позицию!');
    return;
  }

  const price = prices[currentCurrency];
  const amount = (balance * leverage) / price;
  openPosition = { type, price, amount, symbol: currentCurrency };
  saveToStorage();
  updateUI();
}

// === ЗАКРЫТИЕ СДЕЛКИ ===
function closeTrade() {
  if (!openPosition) return;

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
    profit: parseFloat(profit.toFixed(2))
  });

  openPosition = null;
  saveToStorage();
  updateUI();
}

// === СМЕНА ПЛЕЧА ===
function setLev() {
  leverage = parseInt(document.getElementById('leverageSelect').value);
  saveToStorage();
}

// === ОБНОВЛЕНИЕ ИНТЕРФЕЙСА ===
function updateUI() {
  document.getElementById('balance').textContent = balance.toFixed(2);
  document.getElementById('leverageSelect').value = leverage;
  document.getElementById('currentPrice').textContent = prices[currentCurrency].toFixed(2);

  const posEl = document.getElementById('openPosition');
  if (openPosition) {
    posEl.innerHTML = `<strong>${openPosition.type}</strong> ${openPosition.symbol} @ ${openPosition.price} (объём: ${openPosition.amount.toFixed(4)})`;
    document.getElementById('btn-close').style.background = '#ff297b';
  } else {
    posEl.textContent = '—';
    document.getElementById('btn-close').style.background = '#888';
  }

  // Обновление табов
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.currency === currentCurrency);
  });

  updateChart();

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
      <td style="color: ${trade.profit > 0 ? '#05d484' : '#ff297b'}">${trade.profit}</td>
    `;
    historyBody.appendChild(row);
  });
}

// === СОХРАНЕНИЕ ===
function saveToStorage() {
  localStorage.setItem('balance', balance);
  localStorage.setItem('leverage', leverage);
  localStorage.setItem('openPosition', JSON.stringify(openPosition));
  localStorage.setItem('tradeHistory', JSON.stringify(tradeHistory));
}

// === ЗАПУСК ===
window.onload = function () {
  initChart(); // Инициализация графика
  updateUI(); // Обновление интерфейса

  // Обновление цен каждые 2 секунды
  setInterval(updatePrice, 2000);

  // Активация первого таба
  document.querySelector('[data-currency="BTC/USDT"]').classList.add('active');
};
