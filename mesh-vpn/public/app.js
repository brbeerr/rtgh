let state = { userId: null, username: null, roomKey: null, eventSource: null };

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (id === 'screen-servers') loadServers();
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  event.target.classList.add('active');
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

async function loadServers() {
  const res = await fetch('/api/servers');
  const data = await res.json();
  document.getElementById('server-list').innerHTML = data.servers.map(s => `
    <div class="server-item"><div><div class="name">${s.name}</div><div class="details">${s.region} - ${s.ip}</div></div>
    <div style="text-align:right"><div class="ping">${s.ping}ms</div><div class="details">${s.load}% load</div></div></div>`).join('');
}

async function createRoom() {
  const name = document.getElementById('create-name').value.trim();
  const username = document.getElementById('create-username').value.trim();
  if (!name || !username) { toast('Fill all fields'); return; }
  const res = await fetch('/api/rooms/create', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({name, username, serverId:'auto', maxUsers:10}) });
  const data = await res.json();
  if (data.error) { toast(data.error); return; }
  state.userId = data.userId; state.username = username; state.roomKey = data.key;
  enterRoom(data.room); toast('Room created! Key: ' + data.key);
}

async function joinRoom() {
  const key = document.getElementById('join-key').value.trim().toUpperCase();
  const username = document.getElementById('join-username').value.trim();
  if (!key || !username) { toast('Fill all fields'); return; }
  if (key.length !== 8) { toast('Key must be 8 characters'); return; }
  const res = await fetch('/api/rooms/join', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({key, username}) });
  const data = await res.json();
  if (data.error) { toast(data.error); return; }
  state.userId = data.userId; state.username = username; state.roomKey = data.room.key;
  enterRoom(data.room); toast('Connected!');
}

function enterRoom(room) {
  document.getElementById('room-name').textContent = room.name;
  document.getElementById('room-key-display').textContent = 'Key: ' + state.roomKey;
  renderMembers(room.members); renderMessages(room.messages);
  showScreen('screen-room'); connectSSE();
}

async function leaveRoom() {
  if (state.eventSource) { state.eventSource.close(); state.eventSource = null; }
  await fetch('/api/rooms/leave', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({key:state.roomKey, userId:state.userId}) });
  state.userId = null; state.roomKey = null; showScreen('screen-home'); toast('You left the room');
}

async function sendMessage() {
  const input = document.getElementById('chat-text');
  const text = input.value.trim(); if (!text) return;
  await fetch('/api/rooms/message', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({key:state.roomKey, userId:state.userId, text}) });
  input.value = '';
}

function renderMessages(messages) {
  const c = document.getElementById('chat-messages');
  c.innerHTML = messages.map(m => {
    if (m.type === 'system') return `<div class="msg system">${m.text}</div>`;
    const mine = m.userId === state.userId;
    const time = new Date(m.time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    return `<div class="msg ${mine?'mine':'user'}">${!mine?`<div class="author">${m.username}</div>`:''}<div>${m.text}</div><div class="time">${time}</div></div>`;
  }).join(''); c.scrollTop = c.scrollHeight;
}

function appendMessage(msg) {
  const c = document.getElementById('chat-messages');
  let html;
  if (msg.type === 'system') html = `<div class="msg system">${msg.text}</div>`;
  else { const mine = msg.userId === state.userId; const time = new Date(msg.time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    html = `<div class="msg ${mine?'mine':'user'}">${!mine?`<div class="author">${msg.username}</div>`:''}<div>${msg.text}</div><div class="time">${time}</div></div>`; }
  c.insertAdjacentHTML('beforeend', html); c.scrollTop = c.scrollHeight;
}

function renderMembers(members) {
  document.getElementById('members-count').textContent = members.length;
  document.getElementById('members-list').innerHTML = members.map(m => `
    <div class="member-item"><div class="member-avatar">${m.username[0].toUpperCase()}</div>
    <div class="member-info"><div class="member-name">${m.username}${m.userId===state.userId?' (you)':''}</div><div class="member-ip">${m.virtualIP}</div></div>
    <div class="member-status"></div></div>`).join('');
}

function connectSSE() {
  if (state.eventSource) state.eventSource.close();
  const es = new EventSource(`/api/rooms/events?key=${state.roomKey}&userId=${state.userId}`);
  state.eventSource = es;
  es.addEventListener('new_message', e => appendMessage(JSON.parse(e.data)));
  es.addEventListener('member_joined', e => { const d = JSON.parse(e.data); appendMessage(d.message); refreshMembers(); });
  es.addEventListener('member_left', e => { const d = JSON.parse(e.data); appendMessage(d.message); refreshMembers(); });
  es.onerror = () => { setTimeout(() => { if (state.roomKey) connectSSE(); }, 3000); };
}

async function refreshMembers() {
  const res = await fetch(`/api/rooms/info?key=${state.roomKey}`);
  const data = await res.json();
  if (data.members) renderMembers(data.members);
}

function copyKey() { navigator.clipboard.writeText(state.roomKey).then(() => toast('Key copied!')); }
