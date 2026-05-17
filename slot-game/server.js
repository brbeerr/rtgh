const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = 3000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg'
};

// Символы игры и их веса (вероятности)
const SYMBOLS = ['crown', 'diamond', 'ruby', 'emerald', 'sapphire', 'heart', 'club', 'spade'];
const SYMBOL_VALUES = {
  crown: 50, diamond: 25, ruby: 15, emerald: 12,
  sapphire: 10, heart: 5, club: 3, spade: 2
};
const WEIGHTS = [5, 8, 12, 15, 18, 20, 25, 30];

// RNG - выбор символа по весу
function getRandomSymbol() {
  const totalWeight = WEIGHTS.reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;
  for (let i = 0; i < SYMBOLS.length; i++) {
    random -= WEIGHTS[i];
    if (random <= 0) return SYMBOLS[i];
  }
  return SYMBOLS[SYMBOLS.length - 1];
}

// Генерация сетки 5x3
function generateGrid() {
  const grid = [];
  for (let col = 0; col < 5; col++) {
    const reel = [];
    for (let row = 0; row < 3; row++) {
      reel.push(getRandomSymbol());
    }
    grid.push(reel);
  }
  return grid;
}

// Проверка выигрышных линий (20 линий)
const PAYLINES = [
  [1,1,1,1,1], [0,0,0,0,0], [2,2,2,2,2],
  [0,1,2,1,0], [2,1,0,1,2], [0,0,1,2,2],
  [2,2,1,0,0], [1,0,0,0,1], [1,2,2,2,1],
  [0,1,0,1,0], [2,1,2,1,2], [1,0,1,0,1],
  [1,2,1,2,1], [0,1,1,1,0], [2,1,1,1,2],
  [0,2,0,2,0], [2,0,2,0,2], [1,0,1,2,1],
  [1,2,1,0,1], [0,0,2,2,0]
];

function checkWins(grid, bet) {
  const wins = [];
  const betPerLine = bet / PAYLINES.length;

  for (let i = 0; i < PAYLINES.length; i++) {
    const line = PAYLINES[i];
    const firstSymbol = grid[0][line[0]];
    let count = 1;

    for (let col = 1; col < 5; col++) {
      if (grid[col][line[col]] === firstSymbol) {
        count++;
      } else {
        break;
      }
    }

    if (count >= 3) {
      const multiplier = SYMBOL_VALUES[firstSymbol] * (count - 2);
      const winAmount = betPerLine * multiplier;
      wins.push({
        line: i,
        symbol: firstSymbol,
        count: count,
        amount: Math.round(winAmount * 100) / 100
      });
    }
  }

  return wins;
}

// Хранилище сессий (в памяти)
const sessions = {};

// Парсинг JSON body
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

// Отправка JSON
function sendJson(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// Раздача статических файлов
function serveStatic(req, res) {
  let filePath = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

// HTTP Сервер
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // API: Инициализация игры
  if (req.method === 'POST' && url.pathname === '/api/game/init') {
    const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    sessions[sessionId] = {
      balance: 10000,
      currency: 'RUB',
      totalBet: 0,
      totalWin: 0
    };

    return sendJson(res, {
      success: true,
      sessionId: sessionId,
      balance: sessions[sessionId].balance,
      currency: 'RUB',
      minBet: 10,
      maxBet: 5000,
      lines: PAYLINES.length,
      symbols: SYMBOLS
    });
  }

  // API: Спин
  if (req.method === 'POST' && url.pathname === '/api/game/spin') {
    const body = await parseBody(req);
    const { sessionId, bet } = body;

    if (!sessions[sessionId]) {
      return sendJson(res, { error: 'Invalid session' }, 400);
    }

    const session = sessions[sessionId];

    if (bet > session.balance) {
      return sendJson(res, { error: 'Insufficient balance' }, 400);
    }

    if (bet < 10 || bet > 5000) {
      return sendJson(res, { error: 'Invalid bet amount' }, 400);
    }

    // Списываем ставку
    session.balance -= bet;
    session.totalBet += bet;

    // Генерируем результат
    const grid = generateGrid();
    const wins = checkWins(grid, bet);
    const totalWin = wins.reduce((sum, w) => sum + w.amount, 0);

    // Начисляем выигрыш
    session.balance += totalWin;
    session.totalWin += totalWin;

    return sendJson(res, {
      success: true,
      grid: grid,
      wins: wins,
      totalWin: totalWin,
      balance: Math.round(session.balance * 100) / 100,
      spinId: Date.now().toString(36)
    });
  }

  // API: Баланс
  if (req.method === 'GET' && url.pathname === '/api/game/balance') {
    const sessionId = url.searchParams.get('sessionId');
    if (!sessions[sessionId]) {
      return sendJson(res, { error: 'Invalid session' }, 400);
    }
    return sendJson(res, { balance: sessions[sessionId].balance });
  }

  // Статические файлы
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Slot Game Server running at http://localhost:${PORT}`);
});
