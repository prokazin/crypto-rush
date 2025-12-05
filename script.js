// === КОНСТАНТЫ И ПЕРЕМЕННЫЕ ===
const currencies = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];
let currentCurrency = 'BTC/USDT';
let balance = parseFloat(localStorage.getItem('balance')) || 1000;
let leverage = parseInt(localStorage.getItem('leverage')) || 3;
let openPosition = JSON.parse(localStorage.getItem('openPosition')) || null;
let tradeHistory = JSON.parse(localStorage.getItem('tradeHistory')) || [];
let stopLoss = parseFloat(localStorage.getItem('stopLoss')) || 0;
let takeProfit = parseFloat(localStorage.getItem('takeProfit')) || 0;
let soundEnabled = localStorage.getItem('soundEnabled') !== 'false';

// Начальные цены
let prices = {
  'BTC/USDT': 60000 + Math.random() * 1000,
  'ETH/USDT': 3000 + Math.random() * 50,
  'SOL/USDT': 150 + Math.random() * 10
};

// Волатильность для каждой пары
const volatility = { 
  'BTC/USDT': 0.015, 
  'ETH/USDT': 0.02, 
  'SOL/USDT': 0.035 
};

// История цен для графиков
let chartData = {};
currencies.forEach(symbol => {
  chartData[symbol] = Array(50).fill(prices[symbol]);
});

// График
let chart = null;

// === ИНИЦИАЛИЗАЦИЯ ГРАФИКА ===
function initChart() {
  const ctx = document.getElementById('priceChart');
  
  // Уничтожаем старый график, если существует
  if (chart) {
    chart.destroy();
  }
  
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
        borderWidth: 2,
        pointRadius: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 0 },
      scales: {
        y: {
          beginAtZero: false,
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#00f3ff' }
        },
        x: {
          grid: { display: false },
          ticks: { display: false }
        }
      },
      plugins: {
        legend: { 
          display: false
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(25, 25, 35, 0.9)',
          titleColor: '#00f3ff',
          bodyColor: '#fff',
          borderColor: '#00f3ff',
          borderWidth: 1
        }
      }
    }
  });
}

// === ОБНОВЛЕНИЕ ГРАФИКА ===
function updateChart() {
  if (!chart) {
    initChart();
    return;
  }
  
  chart.data.datasets[0].label = `${currentCurrency} Цена`;
  chart.data.datasets[0].data = chartData[currentCurrency];
  chart.update('none');
}

// === ОБНОВЛЕНИЕ ЦЕН ===
function updatePrice() {
  Object.keys(prices).forEach(symbol => {
    const vol = volatility[symbol];
    
    // Более реалистичное изменение цены
    const random1 = Math.random();
    const random2 = Math.random();
    const random3 = Math.random();
    const normalizedRandom = (random1 + random2 + random3) / 3;
    
    const change = (normalizedRandom - 0.5) * 2 * vol;
    
    // Ограничение максимального изменения
    const maxChange = vol * 0.5;
    const limitedChange = Math.max(Math.min(change, maxChange), -maxChange);
    
    // Применяем изменение
    prices[symbol] *= (1 + limitedChange);
    
    // Защита от отрицательных цен
    if (prices[symbol] < 0.01) prices[symbol] = 0.01;
    
    prices[symbol] = parseFloat(prices[symbol].toFixed(2));
    
    // Обновляем историю цен
    if (!chartData[symbol]) chartData[symbol] = [];
    chartData[symbol].push(prices[symbol]);
    if (chartData[symbol].length > 100) chartData[symbol].shift();
  });
  
  // Обновление UI
  document.getElementById('currentPrice').textContent = prices[currentCurrency].toFixed(2);
  
  // Проверка стоп-лосса и тейк-профита
  checkStopLossTakeProfit();
  
  // Обновление графика, если он видим
  if (chart && document.getElementById('priceChart').offsetParent !== null) {
    updateChart();
  }
  
  // Обновление PnL в реальном времени
  if (openPosition) {
    updatePositionPnL();
  }
}

// === СМЕНА ВАЛЮТНОЙ ПАРЫ ===
function changeCurrency(symbol) {
  currentCurrency = symbol;
  
  // Обновляем активные табы
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.currency === symbol);
  });
  
  updateUI();
  updateChart();
}

// === ОТКРЫТИЕ СДЕЛКИ ===
function openTrade(type) {
  if (openPosition) {
    showNotification('Сначала закройте текущую позицию!', 'warning');
    return;
  }
  
  // Проверка минимального баланса
  const minBalance = 50;
  if (balance < minBalance) {
    showNotification(`Минимальный баланс: ${minBalance} USDT`, 'error');
    return;
  }
  
  // Рассчет объема
  const price = prices[currentCurrency];
  const amount = (balance * leverage) / price;
  
  // Проверка маржинальных требований
  const marginRequired = (amount * price) / leverage;
  const maintenanceMargin = marginRequired * 0.1; // 10% maintenance margin
  
  if (marginRequired + maintenanceMargin > balance) {
    showNotification('Недостаточно средств для открытия позиции!', 'error');
    return;
  }
  
  // Открытие позиции
  openPosition = { 
    type, 
    price, 
    amount, 
    symbol: currentCurrency,
    timestamp: new Date().toISOString()
  };
  
  playSound('open');
  showNotification(`Позиция ${type} открыта по цене ${price.toFixed(2)}`, 'success');
  saveToStorage();
  updateUI();
}

// === ЗАКРЫТИЕ СДЕЛКИ ===
function closeTrade() {
  if (!openPosition) {
    showNotification('Нет открытой позиции', 'warning');
    return;
  }
  
  const exitPrice = prices[openPosition.symbol];
  let profit = 0;
  let percentProfit = 0;
  
  if (openPosition.type === 'Long') {
    profit = (exitPrice - openPosition.price) * openPosition.amount;
  } else {
    profit = (openPosition.price - exitPrice) * openPosition.amount;
  }
  
  percentProfit = (profit / (openPosition.amount * openPosition.price / leverage)) * 100;
  
  // Обновляем баланс
  balance += profit;
  
  // Сохраняем в историю
  tradeHistory.push({
    type: openPosition.type,
    symbol: openPosition.symbol,
    entryPrice: openPosition.price,
    exitPrice: exitPrice,
    profit: parseFloat(profit.toFixed(2)),
    percentProfit: parseFloat(percentProfit.toFixed(2)),
    timestamp: new Date().toISOString()
  });
  
  // Ограничиваем размер истории
  if (tradeHistory.length > 100) {
    tradeHistory = tradeHistory.slice(-100);
  }
  
  // Показываем результат
  const profitType = profit >= 0 ? 'прибылью' : 'убытком';
  showNotification(`Позиция закрыта с ${profitType}: ${profit.toFixed(2)} USDT (${percentProfit.toFixed(2)}%)`, 
                   profit >= 0 ? 'success' : 'error');
  
  // Звук
  playSound(profit >= 0 ? 'profit' : 'loss');
  
  // Сбрасываем позицию
  openPosition = null;
  
  // Сохраняем
  saveToStorage();
  updateUI();
}

// === УСТАНОВКА СТОП-ЛОССА И ТЕЙК-ПРОФИТА ===
function setStopLossTakeProfit() {
  const sl = parseFloat(document.getElementById('stopLossInput').value);
  const tp = parseFloat(document.getElementById('takeProfitInput').value);
  
  if (sl > 0) {
    stopLoss = sl;
    showNotification(`Stop Loss установлен на ${sl}%`, 'info');
  }
  
  if (tp > 0) {
    takeProfit = tp;
    showNotification(`Take Profit установлен на ${tp}%`, 'info');
  }
  
  saveToStorage();
}

// === ПРОВЕРКА СТОП-ЛОССА И ТЕЙК-ПРОФИТА ===
function checkStopLossTakeProfit() {
  if (!openPosition) return;
  
  const currentPrice = prices[openPosition.symbol];
  const entryPrice = openPosition.price;
  let percentChange = 0;
  
  if (openPosition.type === 'Long') {
    percentChange = ((currentPrice - entryPrice) / entryPrice) * 100;
  } else {
    percentChange = ((entryPrice - currentPrice) / entryPrice) * 100;
  }
  
  if (stopLoss > 0 && percentChange <= -stopLoss) {
    showNotification(`Сработал Stop Loss! Убыток: ${percentChange.toFixed(2)}%`, 'error');
    closeTrade();
  }
  
  if (takeProfit > 0 && percentChange >= takeProfit) {
    showNotification(`Сработал Take Profit! Прибыль: ${percentChange.toFixed(2)}%`, 'success');
    closeTrade();
  }
}

// === ОБНОВЛЕНИЕ PnL ПОЗИЦИИ ===
function updatePositionPnL() {
  const currentPrice = prices[openPosition.symbol];
  let unrealizedPnL = 0;
  let percentPnL = 0;
  
  if (openPosition.type === 'Long') {
    unrealizedPnL = (currentPrice - openPosition.price) * openPosition.amount;
  } else {
    unrealizedPnL = (openPosition.price - currentPrice) * openPosition.amount;
  }
  
  percentPnL = (unrealizedPnL / (openPosition.amount * openPosition.price / leverage)) * 100;
  
  const posEl = document.getElementById('openPosition');
  const pnlColor = unrealizedPnL >= 0 ? '#05d484' : '#ff297b';
  const pnlText = unrealizedPnL >= 0 ? `+${unrealizedPnL.toFixed(2)}` : unrealizedPnL.toFixed(2);
  
  posEl.innerHTML = `
    <div style="text-align: left;">
      <strong>${openPosition.type}</strong> ${openPosition.symbol}<br>
      <small>Вход: ${openPosition.price.toFixed(2)} | Текущая: ${currentPrice.toFixed(2)}</small><br>
      <small>Объём: ${openPosition.amount.toFixed(4)} | x${leverage}</small><br>
      <strong style="color: ${pnlColor}">PnL: ${pnlText} USDT (${percentPnL.toFixed(2)}%)</strong>
    </div>
  `;
}

// === УСТАНОВКА ПЛЕЧА ===
function setLev() {
  leverage = parseInt(document.getElementById('leverageSelect').value);
  
  // Если есть открытая позиция, пересчитываем
  if (openPosition) {
    const price = prices[openPosition.symbol];
    const amount = (balance * leverage) / price;
    openPosition.amount = amount;
    showNotification(`Плечо изменено на ${leverage}x. Объем позиции пересчитан.`, 'info');
  }
  
  saveToStorage();
}

// === ОЧИСТКА ИСТОРИИ ===
function clearHistory() {
  if (tradeHistory.length === 0) {
    showNotification('История сделок уже пуста', 'warning');
    return;
  }
  
  if (confirm('Вы уверены, что хотите очистить историю сделок?')) {
    tradeHistory = [];
    saveToStorage();
    updateUI();
    showNotification('История сделок очищена', 'success');
  }
}

// === СБРОС АККАУНТА ===
function resetAccount() {
  if (!confirm('ВЫ УВЕРЕНЫ?\n\nВсе данные будут сброшены:\n• Баланс вернется к 1000 USDT\n• Открытые позиции закроются\n• История сделок очистится\n• Все настройки сбросятся')) {
    return;
  }
  
  balance = 1000;
  leverage = 3;
  openPosition = null;
  tradeHistory = [];
  stopLoss = 0;
  takeProfit = 0;
  
  // Сброс полей ввода
  document.getElementById('stopLossInput').value = '';
  document.getElementById('takeProfitInput').value = '';
  document.getElementById('soundToggle').checked = true;
  
  saveToStorage();
  updateUI();
  showNotification('Аккаунт успешно сброшен!', 'success');
}

// === УПРАВЛЕНИЕ ЗВУКОМ ===
function toggleSound() {
  soundEnabled = document.getElementById('soundToggle').checked;
  localStorage.setItem('soundEnabled', soundEnabled);
  
  if (soundEnabled) {
    playSound('toggle');
    showNotification('Звук включен', 'info');
  } else {
    showNotification('Звук выключен', 'info');
  }
}

// === ВОСПРОИЗВЕДЕНИЕ ЗВУКОВ ===
function playSound(soundName) {
  if (!soundEnabled) return;
  
  const sounds = {
    'open': 'https://assets.mixkit.co/sfx/preview/mixkit-unlock-game-notification-253.mp3',
    'close': 'https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3',
    'profit': 'https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3',
    'loss': 'https://assets.mixkit.co/sfx/preview/mixkit-sad-game-over-trombone-471.mp3',
    'toggle': 'https://assets.mixkit.co/sfx/preview/mixkit-select-click-1109.mp3',
    'notification': 'https://assets.mixkit.co/sfx/preview/mixkit-correct-answer-tone-2870.mp3'
  };
  
  if (sounds[soundName]) {
    try {
      const audio = new Audio(sounds[soundName]);
      audio.volume = 0.3;
      audio.play().catch(e => console.log("Автовоспроизведение звука заблокировано"));
    } catch (e) {
      console.error("Ошибка воспроизведения звука:", e);
    }
  }
}

// === УВЕДОМЛЕНИЯ ===
function showNotification(message, type = 'info') {
  const notification = document.getElementById('notification');
  
  // Цвета для разных типов уведомлений
  const colors = {
    'success': '#05d484',
    'error': '#ff4757',
    'warning': '#ffa502',
    'info': '#00f3ff'
  };
  
  notification.textContent = message;
  notification.style.borderLeftColor = colors[type] || colors.info;
  notification.classList.add('show');
  
  // Автоматическое скрытие
  setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
  
  // Звук уведомления
  if (type === 'success' || type === 'error') {
    playSound('notification');
  }
}

// === ОБНОВЛЕНИЕ ВСЕГО ИНТЕРФЕЙСА ===
function updateUI() {
  // Баланс и плечо
  document.getElementById('balance').textContent = balance.toFixed(2);
  document.getElementById('leverageSelect').value = leverage;
  document.getElementById('currentPrice').textContent = prices[currentCurrency].toFixed(2);
  
  // Позиция
  const posEl = document.getElementById('openPosition');
  if (openPosition) {
    updatePositionPnL();
    document.getElementById('btn-close').style.background = '#ff4757';
  } else {
    posEl.innerHTML = '—';
    document.getElementById('btn-close').style.background = '#888';
  }
  
  // История сделок
  const historyBody = document.getElementById('tradeHistoryBody');
  historyBody.innerHTML = '';
  
  if (tradeHistory.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = `
      <td colspan="5" style="text-align: center; color: #888; padding: 40px;">
        <i class="fas fa-history" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
        История сделок пуста
      </td>
    `;
    historyBody.appendChild(emptyRow);
  } else {
    [...tradeHistory].reverse().forEach(trade => {
      const row = document.createElement('tr');
      const typeClass = trade.type === 'Long' ? 'type-long' : 'type-short';
      const profitColor = trade.profit > 0 ? '#05d484' : '#ff4757';
      const profitSign = trade.profit > 0 ? '+' : '';
      
      row.innerHTML = `
        <td><span class="${typeClass}">${trade.type}</span></td>
        <td>${trade.symbol}</td>
        <td>${trade.entryPrice.toFixed(2)}</td>
        <td>${trade.exitPrice ? trade.exitPrice.toFixed(2) : '-'}</td>
        <td style="color: ${profitColor}; font-weight: 700;">
          ${profitSign}${trade.profit.toFixed(2)}<br>
          <small style="font-size: 0.8em; opacity: 0.8;">(${profitSign}${trade.percentProfit.toFixed(2)}%)</small>
        </td>
      `;
      historyBody.appendChild(row);
    });
  }
  
  // Статистика
  document.getElementById('totalTrades').textContent = tradeHistory.length;
  
  if (tradeHistory.length > 0) {
    const winningTrades = tradeHistory.filter(t => t.profit > 0).length;
    const winRate = Math.round((winningTrades / tradeHistory.length) * 100);
    const totalProfit = tradeHistory.reduce((sum, trade) => sum + trade.profit, 0);
    
    document.getElementById('winRate').textContent = `${winRate}%`;
    document.getElementById('winRate').className = `stat-value ${winRate >= 50 ? 'win' : ''}`;
    document.getElementById('totalProfit').textContent = `${totalProfit.toFixed(2)} USDT`;
    document.getElementById('totalProfit').style.color = totalProfit >= 0 ? '#05d484' : '#ff4757';
  } else {
    document.getElementById('winRate').textContent = '0%';
    document.getElementById('totalProfit').textContent = '0.00 USDT';
  }
  
  // Обновление стилей типов позиций
  const style = document.createElement('style');
  style.textContent = `
    .type-long { 
      background: rgba(5, 212, 132, 0.2); 
      color: #05d484; 
      padding: 3px 8px; 
      border-radius: 4px; 
      font-weight: 600; 
    }
    .type-short { 
      background: rgba(255, 71, 87, 0.2); 
      color: #ff4757; 
      padding: 3px 8px; 
      border-radius: 4px; 
      font-weight: 600; 
    }
  `;
  document.head.appendChild(style);
}

// === СОХРАНЕНИЕ ДАННЫХ ===
function saveToStorage() {
  localStorage.setItem('balance', balance);
  localStorage.setItem('leverage', leverage);
  localStorage.setItem('openPosition', JSON.stringify(openPosition));
  localStorage.setItem('tradeHistory', JSON.stringify(tradeHistory));
  localStorage.setItem('stopLoss', stopLoss);
  localStorage.setItem('takeProfit', takeProfit);
  localStorage.setItem('soundEnabled', soundEnabled);
}

// === ПОМОЩЬ ===
function showHelp() {
  document.getElementById('helpModal').classList.add('active');
  playSound('toggle');
}

function closeHelp() {
  document.getElementById('helpModal').classList.remove('active');
}

// === ЗАГРУЗКА ===
window.onload = function () {
  // Инициализация
  initChart();
  updateUI();
  
  // Восстановление настроек
  document.getElementById('soundToggle').checked = soundEnabled;
  document.getElementById('stopLossInput').value = stopLoss || '';
  document.getElementById('takeProfitInput').value = takeProfit || '';
  
  // Активация первого таба
  document.querySelector('[data-currency="BTC/USDT"]').classList.add('active');
  
  // Обновление цен каждые 2 секунды
  setInterval(updatePrice, 2000);
  
  // Первое обновление цен
  updatePrice();
  
  // Закрытие модального окна по клику вне его
  document.getElementById('helpModal').addEventListener('click', function(e) {
    if (e.target === this) {
      closeHelp();
    }
  });
  
  // Закрытие модального окна по ESC
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeHelp();
    }
  });
  
  showNotification('Добро пожаловать в Crypto Trading Simulator!', 'info');
};