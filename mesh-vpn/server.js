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
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml'
};

// Free servers (VPN Gate + hardcoded)
const FREE_SERVERS = [
  { id: 'eu-1', name: 'Europe #1 (Germany)', region: 'EU', ip: '10.0.1.1', ping: 25, load: 34 },
  { id: 'eu-2', name: 'Europe #2 (Netherlands)', region: 'EU', ip: '10.0.1.2', ping: 30, load: 67 },
  { id: 'us-1', name: 'USA East (New York)', region: 'US', ip: '10.0.2.1', ping: 120, load: 45 },
  { id: 'us-2', name: 'USA West (Los Angeles)', region: 'US', ip: '10.0.2.2', ping: 150, load: 23 },
  { id: 'asia-1', name: 'Asia (Singapore)', region: 'ASIA', ip: '10.0.3.1', ping: 80, load: 56 },
  { id: 'ru-1', name: 'Russia (Moscow)', region: 'RU', ip: '10.0.4.1', ping: 15, load: 78 },
  { id: 'ru-2', name: 'Russia (St. Petersburg)', region: 'RU', ip: '10.0.4.2', ping: 20, load: 41 }
];

const rooms = new Map();
const connections = new Map();

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
    if (err) { res.writeHead(404); res.end('Not Found'); return; }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

function broadcastToRoom(roomKey, event, data) {
  const conns = connections.get(roomKey) || [];
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  conns.forEach(c => c.res.write(message));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'GET' && url.pathname === '/api/servers') {
    return sendJson(res, { servers: FREE_SERVERS });
  }

  if (req.method === 'POST' && url.pathname === '/api/rooms/create') {
    const body = await parseBody(req);
    const { name, serverId, username, maxUsers } = body;
    if (!name || !username) return sendJson(res, { error: 'Fill all fields' }, 400);

    const key = generateKey();
    const userId = generateUserId();
    const roomId = rooms.size + 1;

    const room = {
      id: roomId, name, key, serverId: serverId || 'auto',
      maxUsers: maxUsers || 10, owner: userId,
      members: [{ userId, username, virtualIP: generateVirtualIP(roomId, 0), online: true }],
      messages: [{ id: 1, type: 'system', text: `Room "${name}" created. Key: ${key}`, time: Date.now() }]
    };

    rooms.set(key, room);
    connections.set(key, []);
    return sendJson(res, { success: true, key, userId, room: { ...room } });
  }

  if (req.method === 'POST' && url.pathname === '/api/rooms/join') {
    const body = await parseBody(req);
    const { key, username } = body;
    if (!key || !username) return sendJson(res, { error: 'Fill all fields' }, 400);

    const room = rooms.get(key.toUpperCase());
    if (!room) return sendJson(res, { error: 'Room not found' }, 404);
    if (room.members.length >= room.maxUsers) return sendJson(res, { error: 'Room is full' }, 403);

    const userId = generateUserId();
    const member = { userId, username, virtualIP: generateVirtualIP(room.id, room.members.length), online: true };
    room.members.push(member);

    const sysMsg = { id: room.messages.length + 1, type: 'system', text: `${username} joined`, time: Date.now() };
    room.messages.push(sysMsg);
    broadcastToRoom(key.toUpperCase(), 'member_joined', { member, message: sysMsg });

    return sendJson(res, { success: true, userId, room: { ...room, messages: room.messages.slice(-50) } });
  }

  if (req.method === 'POST' && url.pathname === '/api/rooms/message') {
    const body = await parseBody(req);
    const { key, userId, text } = body;
    if (!key || !userId || !text) return sendJson(res, { error: 'Invalid data' }, 400);

    const room = rooms.get(key.toUpperCase());
    if (!room) return sendJson(res, { error: 'Room not found' }, 404);

    const member = room.members.find(m => m.userId === userId);
    if (!member) return sendJson(res, { error: 'Not in room' }, 403);

    const msg = { id: room.messages.length + 1, type: 'user', userId, username: member.username, text: text.substring(0, 500), time: Date.now() };
    room.messages.push(msg);
    if (room.messages.length > 200) room.messages = room.messages.slice(-100);
    broadcastToRoom(key.toUpperCase(), 'new_message', msg);

    return sendJson(res, { success: true });
  }

  if (req.method === 'POST' && url.pathname === '/api/rooms/leave') {
    const body = await parseBody(req);
    const { key, userId } = body;
    const room = rooms.get(key);
    if (!room) return sendJson(res, { success: true });

    const idx = room.members.findIndex(m => m.userId === userId);
    if (idx !== -1) {
      const member = room.members[idx];
      room.members.splice(idx, 1);
      const sysMsg = { id: room.messages.length + 1, type: 'system', text: `${member.username} left`, time: Date.now() };
      room.messages.push(sysMsg);
      broadcastToRoom(key, 'member_left', { userId, message: sysMsg });
      if (room.members.length === 0) { rooms.delete(key); connections.delete(key); }
    }
    return sendJson(res, { success: true });
  }

  if (req.method === 'GET' && url.pathname === '/api/rooms/events') {
    const key = url.searchParams.get('key');
    const userId = url.searchParams.get('userId');
    const room = rooms.get(key);
    if (!room) { res.writeHead(404); res.end(); return; }

    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
    res.write(`event: connected\ndata: {"status":"ok"}\n\n`);

    if (!connections.has(key)) connections.set(key, []);
    connections.get(key).push({ res, userId });

    req.on('close', () => {
      const conns = connections.get(key);
      if (conns) { const i = conns.findIndex(c => c.res === res); if (i !== -1) conns.splice(i, 1); }
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/rooms/info') {
    const key = url.searchParams.get('key');
    const room = rooms.get(key);
    if (!room) return sendJson(res, { error: 'Not found' }, 404);
    return sendJson(res, { name: room.name, members: room.members, messages: room.messages.slice(-50) });
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`MeshVPN Server running at http://localhost:${PORT}`);
});
