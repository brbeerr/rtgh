// ============================================
// SLOT GAME ENGINE - Canvas Based
// ============================================

const Game = {
  canvas: null,
  ctx: null,
  sessionId: null,
  balance: 0,
  bet: 100,
  betSteps: [10, 20, 50, 100, 200, 500, 1000, 2000, 5000],
  betIndex: 3,
  spinning: false,
  grid: null,
  reels: [],
  wins: [],

  // Символы и их цвета/эмодзи
  symbolConfig: {
    crown:    { color: '#ffd700', icon: '👑', label: 'Crown' },
    diamond:  { color: '#b9f2ff', icon: '💎', label: 'Diamond' },
    ruby:     { color: '#ff4444', icon: '🔴', label: 'Ruby' },
    emerald:  { color: '#44ff44', icon: '🟢', label: 'Emerald' },
    sapphire: { color: '#4488ff', icon: '🔵', label: 'Sapphire' },
    heart:    { color: '#ff6699', icon: '♥', label: 'Heart' },
    club:     { color: '#88ff88', icon: '♣', label: 'Club' },
    spade:    { color: '#aaaaff', icon: '♠', label: 'Spade' }
  },

  // Константы рендеринга
  REEL_WIDTH: 150,
  SYMBOL_HEIGHT: 120,
  GRID_OFFSET_X: 25,
  GRID_OFFSET_Y: 20,
  COLS: 5,
  ROWS: 3,

  // Состояние анимации
  reelPositions: [0, 0, 0, 0, 0],
  reelTargets: [0, 0, 0, 0, 0],
  reelSpeeds: [0, 0, 0, 0, 0],
  reelStopped: [true, true, true, true, true],
  animationFrame: null,
  spinSymbols: [[], [], [], [], []], // символы для анимации

  // Инициализация
  async init() {
    await this.showLoader();
    await this.initSession();
    this.setupCanvas();
    this.setupControls();
    this.drawGrid();
    this.showGame();
  },

  // Загрузчик с прогрессом
  async showLoader() {
    const progress = document.getElementById('loadProgress');
    const text = document.getElementById('loadText');
    const steps = [
      { pct: 20, msg: 'Загрузка движка...' },
      { pct: 40, msg: 'Подключение к серверу...' },
      { pct: 60, msg: 'Загрузка ресурсов...' },
      { pct: 80, msg: 'Инициализация...' },
      { pct: 100, msg: 'Готово!' }
    ];

    for (const step of steps) {
      progress.style.width = step.pct + '%';
      text.textContent = step.msg;
      await this.delay(400);
    }
    await this.delay(300);
  },

  // Инициализация сессии с сервером
  async initSession() {
    try {
      const res = await fetch('/api/game/init', { method: 'POST' });
      const data = await res.json();
      this.sessionId = data.sessionId;
      this.balance = data.balance;
      this.updateUI();
    } catch (e) {
      console.error('Failed to init session', e);
    }
  },

  // Настройка Canvas
  setupCanvas() {
    this.canvas = document.getElementById('slotCanvas');
    this.ctx = this.canvas.getContext('2d');

    // Начальная сетка (случайные символы для отображения)
    const symbols = Object.keys(this.symbolConfig);
    this.grid = [];
    for (let col = 0; col < this.COLS; col++) {
      const reel = [];
      for (let row = 0; row < this.ROWS; row++) {
        reel.push(symbols[Math.floor(Math.random() * symbols.length)]);
      }
      this.grid.push(reel);
    }
  },

  // Настройка кнопок
  setupControls() {
    document.getElementById('spinBtn').addEventListener('click', () => this.spin());
    document.getElementById('betUp').addEventListener('click', () => this.changeBet(1));
    document.getElementById('betDown').addEventListener('click', () => this.changeBet(-1));

    // Пробел для спина
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !this.spinning) {
        e.preventDefault();
        this.spin();
      }
    });
  },

  // Изменение ставки
  changeBet(dir) {
    this.betIndex = Math.max(0, Math.min(this.betSteps.length - 1, this.betIndex + dir));
    this.bet = this.betSteps[this.betIndex];
    document.getElementById('betAmount').textContent = this.bet;
  },

  // Обновление UI
  updateUI() {
    document.getElementById('balance').textContent = this.balance.toFixed(2);
    document.getElementById('betAmount').textContent = this.bet;
  },

  // Показать игру, скрыть загрузчик
  showGame() {
    document.getElementById('loader').style.display = 'none';
    document.getElementById('game').style.display = 'flex';
    this.updateUI();
  },

  // СПИН
  async spin() {
    if (this.spinning) return;
    if (this.bet > this.balance) return;

    this.spinning = true;
    this.wins = [];
    document.getElementById('spinBtn').disabled = true;
    document.getElementById('winAmount').textContent = '0';
    document.getElementById('winAmount').parentElement.classList.remove('win-animation');

    // Генерируем случайные символы для анимации прокрутки
    const symbols = Object.keys(this.symbolConfig);
    for (let col = 0; col < this.COLS; col++) {
      this.spinSymbols[col] = [];
      for (let i = 0; i < 20; i++) {
        this.spinSymbols[col].push(symbols[Math.floor(Math.random() * symbols.length)]);
      }
      this.reelPositions[col] = 0;
      this.reelSpeeds[col] = 15 + col * 2;
      this.reelStopped[col] = false;
    }

    // Запрос к серверу
    const response = await fetch('/api/game/spin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: this.sessionId, bet: this.bet })
    });
    const data = await response.json();

    if (!data.success) {
      this.spinning = false;
      document.getElementById('spinBtn').disabled = false;
      return;
    }

    // Устанавливаем целевую сетку
    this.grid = data.grid;
    this.balance = data.balance;

    // Добавляем целевые символы в конец анимации
    for (let col = 0; col < this.COLS; col++) {
      for (let row = 0; row < this.ROWS; row++) {
        this.spinSymbols[col].push(this.grid[col][row]);
      }
      this.reelTargets[col] = (this.spinSymbols[col].length - this.ROWS) * this.SYMBOL_HEIGHT;
    }

    // Запуск анимации
    this.animateReels(data);
  },

  // Анимация барабанов
  animateReels(data) {
    const stopDelays = [300, 500, 700, 900, 1100]; // мс задержки остановки
    const startTime = Date.now();

    const animate = () => {
      let allStopped = true;

      for (let col = 0; col < this.COLS; col++) {
        if (this.reelStopped[col]) continue;

        const elapsed = Date.now() - startTime;
        if (elapsed < stopDelays[col]) {
          // Ещё крутится быстро
          this.reelPositions[col] += this.reelSpeeds[col];
          allStopped = false;
        } else {
          // Замедление и остановка
          const progress = Math.min(1, (elapsed - stopDelays[col]) / 600);
          const eased = this.easeOutBack(progress);
          this.reelPositions[col] = this.reelTargets[col] * eased;

          if (progress >= 1) {
            this.reelPositions[col] = this.reelTargets[col];
            this.reelStopped[col] = true;
          } else {
            allStopped = false;
          }
        }
      }

      this.drawAnimatedReels();

      if (allStopped) {
        this.onSpinComplete(data);
      } else {
        this.animationFrame = requestAnimationFrame(animate);
      }
    };

    this.animationFrame = requestAnimationFrame(animate);
  },

  // Easing функция (отскок)
  easeOutBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },

  // Отрисовка анимированных барабанов
  drawAnimatedReels() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Фон
    ctx.fillStyle = '#0d0520';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Разделители барабанов
    for (let i = 1; i < this.COLS; i++) {
      const x = this.GRID_OFFSET_X + i * this.REEL_WIDTH;
      ctx.strokeStyle = '#2a1a4e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.canvas.height);
      ctx.stroke();
    }

    for (let col = 0; col < this.COLS; col++) {
      const offset = this.reelPositions[col] % (this.spinSymbols[col].length * this.SYMBOL_HEIGHT);
      const startIdx = Math.floor(offset / this.SYMBOL_HEIGHT);

      for (let i = -1; i < this.ROWS + 1; i++) {
        const symIdx = (startIdx + i) % this.spinSymbols[col].length;
        const symbol = this.spinSymbols[col][Math.abs(symIdx)] || 'heart';
        const y = this.GRID_OFFSET_Y + i * this.SYMBOL_HEIGHT - (offset % this.SYMBOL_HEIGHT);

        if (y > -this.SYMBOL_HEIGHT && y < this.canvas.height) {
          this.drawSymbol(ctx, symbol, col, y, false);
        }
      }
    }
  },

  // Завершение спина
  onSpinComplete(data) {
    this.spinning = false;
    document.getElementById('spinBtn').disabled = false;
    this.updateUI();
    this.drawGrid();

    // Показать выигрыш
    if (data.totalWin > 0) {
      document.getElementById('winAmount').textContent = data.totalWin.toFixed(2);
      document.getElementById('winAmount').parentElement.classList.add('win-animation');
      this.wins = data.wins;
      this.highlightWins();
    }
  },

  // Подсветка выигрышных символов
  highlightWins() {
    if (this.wins.length === 0) return;

    let flash = 0;
    const flashInterval = setInterval(() => {
      flash++;
      this.drawGrid(flash % 2 === 0);
      if (flash > 6) {
        clearInterval(flashInterval);
        this.drawGrid();
      }
    }, 250);
  },

  // Отрисовка статичной сетки
  drawGrid(highlight = false) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Фон
    ctx.fillStyle = '#0d0520';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Разделители
    for (let i = 1; i < this.COLS; i++) {
      const x = this.GRID_OFFSET_X + i * this.REEL_WIDTH;
      ctx.strokeStyle = '#2a1a4e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.canvas.height);
      ctx.stroke();
    }

    // Символы
    for (let col = 0; col < this.COLS; col++) {
      for (let row = 0; row < this.ROWS; row++) {
        const symbol = this.grid[col][row];
        const y = this.GRID_OFFSET_Y + row * this.SYMBOL_HEIGHT;
        const isWin = highlight && this.isWinPosition(col, row);
        this.drawSymbol(ctx, symbol, col, y, isWin);
      }
    }
  },

  // Проверка позиции на выигрыш
  isWinPosition(col, row) {
    const PAYLINES = [
      [1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],
      [0,1,2,1,0],[2,1,0,1,2],[0,0,1,2,2],
      [2,2,1,0,0],[1,0,0,0,1],[1,2,2,2,1],
      [0,1,0,1,0],[2,1,2,1,2],[1,0,1,0,1],
      [1,2,1,2,1],[0,1,1,1,0],[2,1,1,1,2],
      [0,2,0,2,0],[2,0,2,0,2],[1,0,1,2,1],
      [1,2,1,0,1],[0,0,2,2,0]
    ];

    for (const win of this.wins) {
      const line = PAYLINES[win.line];
      if (col < win.count && line[col] === row) return true;
    }
    return false;
  },

  // Отрисовка одного символа
  drawSymbol(ctx, symbol, col, y, isWin) {
    const config = this.symbolConfig[symbol];
    if (!config) return;

    const x = this.GRID_OFFSET_X + col * this.REEL_WIDTH;
    const centerX = x + this.REEL_WIDTH / 2;
    const centerY = y + this.SYMBOL_HEIGHT / 2;

    // Фон ячейки при выигрыше
    if (isWin) {
      ctx.fillStyle = 'rgba(255, 215, 0, 0.2)';
      ctx.fillRect(x + 5, y + 5, this.REEL_WIDTH - 10, this.SYMBOL_HEIGHT - 10);
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 5, y + 5, this.REEL_WIDTH - 10, this.SYMBOL_HEIGHT - 10);
    }

    // Символ (эмодзи/текст)
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = config.color;
    ctx.fillText(config.icon, centerX, centerY);

    // Название под символом
    ctx.font = '11px Arial';
    ctx.fillStyle = '#666';
    ctx.fillText(config.label, centerX, centerY + 35);
  },

  // Утилита задержки
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

// Запуск
window.addEventListener('load', () => Game.init());
