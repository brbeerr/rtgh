// ==================== STATE ====================
let state = {
  userId: null,
  username: null,
  roomKey: null,
  roomName: null,
  eventSource: null
};

// ==================== SCREENS ====================
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (id === 'screen-servers') loadServers();
  if (id === 'screen-create') loadServerSelect();
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  event.target.classList.add('active');
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}



// ==================== SERVERS ====================
async function loadServers() {
  const res = await fetch('/api/servers');
  const data = await res.json();
  const list = document.getElementById('server-list');
  list.innerHTML = data.servers.map(s => `
    <div class="server-item">
      <div>
        <div class="name">${s.name}</div>
        <div class="details">${s.region} &bull; ${s.ip}</div>
        <div class="load-bar"><div class="load-fill" style="width:${s.load}%"></div></div>
      </div>
      <div style="text-align:right">
        <div class="ping">${s.ping}ms</div>
        <div class="details">${s.load}% нагрузка</div>
      </div>
    </div>
  `).join('');
}

async function loadServerSelect() {
  const res = await fetch('/api/servers');
  const data = await res.json();
  const sel = document.getElementById('create-server');
  sel.innerHTML = data.servers.map(s =>
    `<option value="${s.id}">${s.name} (${s.ping}ms)</option>`
  ).join('');
}

// ==================== ROOMS ====================
async function createRoom() {
  const name = document.getElementById('create-name').value.trim();
  const username = document.getElementById('create-username').value.trim();
  const serverId = document.getElementById('create-server').value;
  const maxUsers = parseInt(document.getElementById('create-max').value);

  if (!name || !username) { toast('Заполните все поля'); return; }

  const res = await fetch('/api/rooms/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, username, serverId, maxUsers })
  });
  const data = await res.json();

  if (data.error) { toast(data.error); return; }

  state.userId = data.userId;
  state.username = username;
  state.roomKey = data.key;
  state.roomName = data.room.name;

  enterRoom(data.room);
  toast('Комната создана! Ключ: ' + data.key);
}

async function joinRoom() {
  const key = document.getElementById('join-key').value.trim().toUpperCase();
  const username = document.getElementById('join-username').value.trim();

  if (!key || !username) { toast('Заполните все поля'); return; }
  if (key.length !== 8) { toast('Ключ должен быть 8 символов'); return; }

  const res = await fetch('/api/rooms/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, username })
  });
  const data = await res.json();

  if (data.error) { toast(data.error); return; }

  state.userId = data.userId;
  state.username = username;
  state.roomKey = data.room.key;
  state.roomName = data.room.name;

  enterRoom(data.room);
  toast('Подключено!');
}

function enterRoom(room) {
  document.getElementById('room-name').textContent = room.name;
  document.getElementById('room-key-display').textContent = 'Ключ: ' + state.roomKey;

  renderMembers(room.members);
  renderMessages(room.messages);
  showScreen('screen-room');
  connectSSE();
}

async function leaveRoom() {
  if (state.eventSource) { state.eventSource.close(); state.eventSource = null; }

  await fetch('/api/rooms/leave', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: state.roomKey, userId: state.userId })
  });

  state.userId = null;
  state.roomKey = null;
  state.roomName = null;
  showScreen('screen-home');
  toast('Вы вышли из комнаты');
}

// ==================== CHAT ====================
async function sendMessage() {
  const input = document.getElementById('chat-text');
  const text = input.value.trim();
  if (!text) return;

  await fetch('/api/rooms/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: state.roomKey, userId: state.userId, text })
  });

  input.value = '';
}

function renderMessages(messages) {
  const container = document.getElementById('chat-messages');
  container.innerHTML = messages.map(m => {
    if (m.type === 'system') {
      return `<div class="msg system">${m.text}</div>`;
    }
    const isMine = m.userId === state.userId;
    const time = new Date(m.time).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
    return `<div class="msg ${isMine ? 'mine' : 'user'}">
      ${!isMine ? `<div class="author">${m.username}</div>` : ''}
      <div>${m.text}</div>
      <div class="time">${time}</div>
    </div>`;
  }).join('');
  container.scrollTop = container.scrollHeight;
}

function appendMessage(msg) {
  const container = document.getElementById('chat-messages');
  let html;
  if (msg.type === 'system') {
    html = `<div class="msg system">${msg.text}</div>`;
  } else {
    const isMine = msg.userId === state.userId;
    const time = new Date(msg.time).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
    html = `<div class="msg ${isMine ? 'mine' : 'user'}">
      ${!isMine ? `<div class="author">${msg.username}</div>` : ''}
      <div>${msg.text}</div>
      <div class="time">${time}</div>
    </div>`;
  }
  container.insertAdjacentHTML('beforeend', html);
  container.scrollTop = container.scrollHeight;
}

// ==================== MEMBERS ====================
function renderMembers(members) {
  const list = document.getElementById('members-list');
  document.getElementById('members-count').textContent = members.length;
  list.innerHTML = members.map(m => `
    <div class="member-item">
      <div class="member-avatar">${m.username[0].toUpperCase()}</div>
      <div class="member-info">
        <div class="member-name">${m.username}${m.userId === state.userId ? ' (вы)' : ''}</div>
        <div class="member-ip">${m.virtualIP}</div>
      </div>
      <div class="member-status"></div>
    </div>
  `).join('');
}

// ==================== SSE (реальное время) ====================
function connectSSE() {
  if (state.eventSource) state.eventSource.close();

  const es = new EventSource(`/api/rooms/events?key=${state.roomKey}&userId=${state.userId}`);
  state.eventSource = es;

  es.addEventListener('new_message', (e) => {
    const msg = JSON.parse(e.data);
    appendMessage(msg);
  });

  es.addEventListener('member_joined', (e) => {
    const data = JSON.parse(e.data);
    appendMessage(data.message);
    refreshMembers();
  });

  es.addEventListener('member_left', (e) => {
    const data = JSON.parse(e.data);
    appendMessage(data.message);
    refreshMembers();
  });

  es.onerror = () => {
    setTimeout(() => { if (state.roomKey) connectSSE(); }, 3000);
  };
}

async function refreshMembers() {
  const res = await fetch(`/api/rooms/info?key=${state.roomKey}`);
  const data = await res.json();
  if (data.members) renderMembers(data.members);
}

// ==================== UTILS ====================
function copyKey() {
  navigator.clipboard.writeText(state.roomKey).then(() => toast('Ключ скопирован!'));
}
