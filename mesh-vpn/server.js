const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

// ==================== ДАННЫЕ ====================

// Бесплатные серверы (регионы)
const FREE_SERVERS = [
  { id: 'eu-1', name: 'Европа #1', region: 'EU', ip: '10.0.1.1', ping: 25, load: 34, maxUsers: 100 },
  { id: 'eu-2', name: 'Европа #2', region: 'EU', ip: '10.0.1.2', ping: 30, load: 67, maxUsers: 100 },
  { id: 'us-1', name: 'США Восток', region: 'US', ip: '10.0.2.1', ping: 120, load: 45, maxUsers: 100 },
  { id: 'us-2', name: 'США Запад', region: 'US', ip: '10.0.2.2', ping: 150, load: 23, maxUsers: 100 },
  { id: 'asia-1', name: 'Азия (Сингапур)', region: 'ASIA', ip: '10.0.3.1', ping: 80, load: 56, maxUsers: 100 },
  { id: 'ru-1', name: 'Россия (Москва)', region: 'RU', ip: '10.0.4.1', ping: 15, load: 78, maxUsers: 100 },
  { id: 'ru-2', name: 'Россия (СПб)', region: 'RU', ip: '10.0.4.2', ping: 20, load: 41, maxUsers: 100 }
];

// Хранилище комнат
const rooms = new Map();

// Хранилище подключений (SSE)
const connections = new Map(); // roomKey -> [{res, userId, username}]

// ==================== УТИЛИТЫ ====================

function generateKey() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

function generateUserId() {
  return crypto.randomBytes(8).toString('hex');
}

function generateVirtualIP(roomId, index) {
  return `192.168.${(roomId % 255)}.${index + 1}`;
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
  });
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

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

// Рассылка SSE события в комнату
function broadcastToRoom(roomKey, event, data) {
  const conns = connections.get(roomKey) || [];
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  conns.forEach(c => c.res.write(message));
}

// ==================== API ====================

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // --- API: Список серверов ---
  if (req.method === 'GET' && url.pathname === '/api/servers') {
    return sendJson(res, { servers: FREE_SERVERS });
  }

  // --- API: Создать комнату ---
  if (req.method === 'POST' && url.pathname === '/api/rooms/create') {
    const body = await parseBody(req);
    const { name, serverId, username, maxUsers } = body;

    if (!name || !serverId || !username) {
      return sendJson(res, { error: 'Укажите имя комнаты, сервер и ваш никнейм' }, 400);
    }

    const key = generateKey();
    const userId = generateUserId();
    const roomId = rooms.size + 1;

    const room = {
      id: roomId,
      name,
      key,
      serverId,
      maxUsers: maxUsers || 10,
      createdAt: Date.now(),
      owner: userId,
      members: [{
        userId,
        username,
        virtualIP: generateVirtualIP(roomId, 0),
        joinedAt: Date.now(),
        online: true
      }],
      messages: [{
        id: 1,
        type: 'system',
        text: `Комната "${name}" создана. Ключ: ${key}`,
        time: Date.now()
      }]
    };

    rooms.set(key, room);
    connections.set(key, []);

    return sendJson(res, {
      success: true,
      key,
      userId,
      room: {
        id: room.id,
        name: room.name,
        serverId: room.serverId,
        maxUsers: room.maxUsers,
        members: room.members,
        messages: room.messages
      }
    });
  }

  // --- API: Войти в комнату по ключу ---
  if (req.method === 'POST' && url.pathname === '/api/rooms/join') {
    const body = await parseBody(req);
    const { key, username } = body;

    if (!key || !username) {
      return sendJson(res, { error: 'Укажите ключ комнаты и никнейм' }, 400);
    }

    const room = rooms.get(key.toUpperCase());
    if (!room) {
      return sendJson(res, { error: 'Комната не найдена. Проверьте ключ.' }, 404);
    }

    if (room.members.length >= room.maxUsers) {
      return sendJson(res, { error: 'Комната заполнена' }, 403);
    }

    const userId = generateUserId();
    const member = {
      userId,
      username,
      virtualIP: generateVirtualIP(room.id, room.members.length),
      joinedAt: Date.now(),
      online: true
    };

    room.members.push(member);

    const sysMsg = {
      id: room.messages.length + 1,
      type: 'system',
      text: `${username} присоединился к комнате`,
      time: Date.now()
    };
    room.messages.push(sysMsg);

    broadcastToRoom(key.toUpperCase(), 'member_joined', { member, message: sysMsg });

    return sendJson(res, {
      success: true,
      userId,
      room: {
        id: room.id,
        name: room.name,
        key: room.key,
        serverId: room.serverId,
        maxUsers: room.maxUsers,
        members: room.members,
        messages: room.messages.slice(-50)
      }
    });
  }

  // --- API: Отправить сообщение ---
  if (req.method === 'POST' && url.pathname === '/api/rooms/message') {
    const body = await parseBody(req);
    const { key, userId, text } = body;

    if (!key || !userId || !text) {
      return sendJson(res, { error: 'Неверные данные' }, 400);
    }

    const room = rooms.get(key.toUpperCase());
    if (!room) return sendJson(res, { error: 'Комната не найдена' }, 404);

    const member = room.members.find(m => m.userId === userId);
    if (!member) return sendJson(res, { error: 'Вы не в этой комнате' }, 403);

    const msg = {
      id: room.messages.length + 1,
      type: 'user',
      userId,
      username: member.username,
      text: text.substring(0, 500),
      time: Date.now()
    };

    room.messages.push(msg);
    if (room.messages.length > 200) room.messages = room.messages.slice(-100);

    broadcastToRoom(key.toUpperCase(), 'new_message', msg);

    return sendJson(res, { success: true });
  }

  // --- API: Покинуть комнату ---
  if (req.method === 'POST' && url.pathname === '/api/rooms/leave') {
    const body = await parseBody(req);
    const { key, userId } = body;

    const room = rooms.get(key);
    if (!room) return sendJson(res, { error: 'Комната не найдена' }, 404);

    const idx = room.members.findIndex(m => m.userId === userId);
    if (idx === -1) return sendJson(res, { error: 'Вы не в комнате' }, 404);

    const member = room.members[idx];
    room.members.splice(idx, 1);

    const sysMsg = {
      id: room.messages.length + 1,
      type: 'system',
      text: `${member.username} покинул комнату`,
      time: Date.now()
    };
    room.messages.push(sysMsg);

    broadcastToRoom(key, 'member_left', { userId, message: sysMsg });

    // Удалить пустую комнату
    if (room.members.length === 0) {
      rooms.delete(key);
      connections.delete(key);
    }

    return sendJson(res, { success: true });
  }

  // --- API: SSE подключение для реального времени ---
  if (req.method === 'GET' && url.pathname === '/api/rooms/events') {
    const key = url.searchParams.get('key');
    const userId = url.searchParams.get('userId');

    const room = rooms.get(key);
    if (!room) { res.writeHead(404); res.end(); return; }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    res.write(`event: connected\ndata: {"status":"ok"}\n\n`);

    const conn = { res, userId };
    if (!connections.has(key)) connections.set(key, []);
    connections.get(key).push(conn);

    req.on('close', () => {
      const conns = connections.get(key);
      if (conns) {
        const idx = conns.findIndex(c => c.res === res);
        if (idx !== -1) conns.splice(idx, 1);
      }
    });

    return;
  }

  // --- API: Информация о комнате ---
  if (req.method === 'GET' && url.pathname === '/api/rooms/info') {
    const key = url.searchParams.get('key');
    const room = rooms.get(key);
    if (!room) return sendJson(res, { error: 'Комната не найдена' }, 404);

    return sendJson(res, {
      id: room.id,
      name: room.name,
      serverId: room.serverId,
      maxUsers: room.maxUsers,
      membersCount: room.members.length,
      members: room.members,
      messages: room.messages.slice(-50)
    });
  }

  // Статические файлы
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`MeshVPN Server running at http://localhost:${PORT}`);
});
