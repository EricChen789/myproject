const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');

const API_KEY = process.env.WHATSAPP_API_KEY || crypto.randomBytes(16).toString('hex');

const app = express();
app.use(express.json());
const server = createServer(app);
const io = new Server(server);

function requireAuth(req, res, next) {
  const token = req.headers['x-api-key'] || req.query.api_key;
  if (!token || token !== API_KEY) {
    return res.status(401).json({ error: '未授权：需要有效的 API Key（Header: x-api-key）' });
  }
  next();
}

let qrCodeData = '';
let qrRawString = '';
let clientStatus = 'connecting';
let readyClient = null;

// ==================== WhatsApp 客户端 ====================

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './whatsapp-session' }),
  puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

client.on('qr', async (qr) => {
  console.log('📱 新二维码已生成！');
  qrRawString = qr;
  qrCodeData = await qrcode.toDataURL(qr);
  clientStatus = 'waiting_scan';
  io.emit('status', { status: clientStatus, qr: qrCodeData });
});

client.on('authenticated', () => {
  console.log('✅ 认证成功！');
  clientStatus = 'authenticated';
  qrCodeData = '';
  qrRawString = '';
  io.emit('status', { status: clientStatus, qr: null });
});

client.on('ready', () => {
  console.log('🟢 WhatsApp 已就绪！');
  clientStatus = 'ready';
  readyClient = client;
  io.emit('status', { status: clientStatus, qr: null });
});

client.on('disconnected', (reason) => {
  console.log('🔴 断开连接:', reason);
  clientStatus = 'disconnected';
  readyClient = null;
  io.emit('status', { status: clientStatus, qr: null });
});

client.on('message', async (msg) => {
  console.log(`📩 [${msg.from}] ${msg.body}`);
  io.emit('incoming_message', {
    from: msg.from, body: msg.body, timestamp: msg.timestamp, hasMedia: msg.hasMedia
  });
});

client.initialize();

// ==================== Web 页面（扫码 + 聊天界面） ====================

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WhatsApp Bot</title>
  <script src="/socket.io/socket.io.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #111b21; color: #e9edef; height: 100vh; overflow: hidden; }
    /* 登录页面 */
    #login-page { display: flex; align-items: center; justify-content: center; height: 100vh; }
    .login-card { background: #202c33; border-radius: 12px; padding: 48px; max-width: 420px; text-align: center; }
    .login-card h1 { color: #00a884; font-size: 24px; margin-bottom: 20px; }
    #qr-container { background: white; padding: 16px; border-radius: 8px; display: inline-block; margin: 16px 0; }
    #qr-container img { width: 220px; height: 220px; }
    .spinner { border: 3px solid #2a3942; border-top: 3px solid #00a884; border-radius: 50%; width: 32px; height: 32px; animation: spin 1s linear infinite; margin: 16px auto; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .tip { margin-top: 20px; font-size: 13px; color: #667781; line-height: 1.6; }
    /* 聊天界面 */
    #chat-page { display: none; height: 100vh; }
    .sidebar { width: 380px; background: #111b21; border-right: 1px solid #2a3942; height: 100vh; overflow-y: auto; float: left; }
    .sidebar-header { padding: 16px; background: #202c33; font-size: 18px; font-weight: bold; color: #00a884; display: flex; justify-content: space-between; align-items: center; }
    .logout-btn { background: #2a3942; color: #e9edef; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 13px; }
    .logout-btn:hover { background: #3a4952; }
    .chat-item { padding: 14px 16px; cursor: pointer; border-bottom: 1px solid #1a2a30; display: flex; align-items: center; gap: 12px; }
    .chat-item:hover { background: #202c33; }
    .chat-item.active { background: #2a3942; }
    .chat-avatar { width: 48px; height: 48px; border-radius: 50%; background: #2a3942; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
    .chat-info { flex: 1; min-width: 0; }
    .chat-name { font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .chat-last { font-size: 13px; color: #667781; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
    .main-area { margin-left: 380px; height: 100vh; display: flex; flex-direction: column; }
    .main-header { padding: 16px 20px; background: #202c33; font-size: 17px; font-weight: bold; border-bottom: 1px solid #2a3942; }
    .messages { flex: 1; overflow-y: auto; padding: 20px; background: #0b141a; }
    .msg { max-width: 65%; margin-bottom: 8px; padding: 8px 12px; border-radius: 8px; font-size: 14px; line-height: 1.4; word-wrap: break-word; }
    .msg.in { background: #202c33; margin-right: auto; border-top-left-radius: 0; }
    .msg.out { background: #005c4b; margin-left: auto; border-top-right-radius: 0; }
    .msg .meta { font-size: 11px; color: #8696a0; margin-top: 4px; }
    .input-bar { padding: 12px 16px; background: #202c33; display: flex; gap: 10px; }
    .input-bar input { flex: 1; padding: 10px 16px; border: none; border-radius: 8px; background: #2a3942; color: #e9edef; font-size: 14px; outline: none; }
    .input-bar button { padding: 10px 20px; background: #00a884; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; }
    .input-bar button:hover { background: #06cf9c; }
    .no-chat { display: flex; align-items: center; justify-content: center; height: 100%; color: #667781; font-size: 16px; }
    .empty-chats { padding: 40px; text-align: center; color: #667781; font-size: 14px; }
  </style>
</head>
<body>

<!-- 登录页面 -->
<div id="login-page">
  <div class="login-card">
    <h1>WhatsApp Bot</h1>
    <div id="qrcode-area">
      <div class="spinner"></div>
      <p style="color:#8696a0; margin-top:12px;">生成二维码中...</p>
    </div>
    <div class="tip">
      1. 打开手机 WhatsApp<br>
      2. 设置 → 已关联设备 → 关联设备<br>
      3. 扫描二维码
    </div>
  </div>
</div>

<!-- 聊天界面 -->
<div id="chat-page">
  <div class="sidebar">
    <div class="sidebar-header">
      <span>💬 聊天</span>
      <button class="logout-btn" onclick="logout()">登出</button>
    </div>
    <div id="chat-list"><div class="empty-chats">加载中...</div></div>
  </div>
  <div class="main-area">
    <div class="main-header" id="main-title">选择一个聊天</div>
    <div class="messages" id="messages"><div class="no-chat">👈 选择左侧聊天开始</div></div>
    <div class="input-bar">
      <input id="msg-input" placeholder="输入消息..." disabled>
      <button id="send-btn" onclick="sendMessage()" disabled>发送</button>
    </div>
  </div>
</div>

<script>
  const socket = io();
  let activeChat = null;
  let chatsData = [];

  // ---- 状态切换 ----
  socket.on('status', (data) => {
    if (data.status === 'ready') {
      document.getElementById('login-page').style.display = 'none';
      document.getElementById('chat-page').style.display = 'block';
      loadChats();
    } else if (data.qr) {
      document.getElementById('qrcode-area').innerHTML = '<div id="qr-container"><img src="' + data.qr + '" alt="QR"></div><p style="color:#8696a0; margin-top:12px;">请扫描二维码</p>';
    }
  });

  // ---- 新消息 ----
  socket.on('incoming_message', (msg) => {
    if (activeChat === msg.from) appendMessage(msg);
    loadChats(); // 刷新列表
  });

  // ---- 加载聊天列表 ----
  function loadChats() {
    socket.emit('get_chats');
  }
  socket.on('chats_list', (chats) => {
    chatsData = chats;
    const list = document.getElementById('chat-list');
    if (!chats.length) { list.innerHTML = '<div class="empty-chats">暂无聊天</div>'; return; }
    list.innerHTML = chats.map(c => \`
      <div class="chat-item \${c.id === activeChat ? 'active' : ''}" onclick="openChat('\${c.id}','\${c.name.replace(/'/g,"&#39;")}')">
        <div class="chat-avatar">\${c.isGroup ? '👥' : '👤'}</div>
        <div class="chat-info">
          <div class="chat-name">\${c.name || c.id}</div>
          <div class="chat-last">\${c.unreadCount ? c.unreadCount + ' 条未读' : ''}</div>
        </div>
      </div>
    \`).join('');
  });

  // ---- 打开聊天 ----
  function openChat(id, name) {
    activeChat = id;
    document.getElementById('main-title').textContent = name || id;
    document.getElementById('messages').innerHTML = '<div style="text-align:center;color:#667781;padding:20px;">加载中...</div>';
    document.getElementById('msg-input').disabled = false;
    document.getElementById('send-btn').disabled = false;
    document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
    event.currentTarget.classList.add('active');
    socket.emit('get_messages', id);
  }

  socket.on('messages_list', (msgs) => {
    const container = document.getElementById('messages');
    container.innerHTML = '';
    (msgs || []).reverse().forEach(m => appendMessage(m));
    container.scrollTop = container.scrollHeight;
  });

  // ---- 显示消息 ----
  function appendMessage(m) {
    const container = document.getElementById('messages');
    const div = document.createElement('div');
    div.className = 'msg ' + (m.fromMe ? 'out' : 'in');
    div.innerHTML = m.body.replace(/\\n/g,'<br>') + '<div class="meta">' + new Date(m.timestamp*1000).toLocaleString('zh-CN') + '</div>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  // ---- 发送消息 ----
  function sendMessage() {
    const input = document.getElementById('msg-input');
    const text = input.value.trim();
    if (!text || !activeChat) return;
    socket.emit('send_message', { to: activeChat, message: text });
    input.value = '';
  }

  document.getElementById('msg-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
  });

  socket.on('message_sent', (msg) => {
    appendMessage({ fromMe: true, body: msg.body || msg.message, timestamp: Date.now()/1000 });
  });

  socket.on('send_error', (err) => {
    alert('发送失败: ' + err);
  });

  // ---- 登出 ----
  function logout() {
    if (confirm('确定要登出 WhatsApp 吗？')) {
      socket.emit('logout');
      location.reload();
    }
  }
</script>
</body>
</html>`);
});

// ==================== Socket.io 事件（网页聊天界面用） ====================

io.on('connection', (socket) => {
  socket.on('get_chats', async () => {
    if (!readyClient) { socket.emit('chats_list', []); return; }
    try {
      const chats = await readyClient.getChats();
      socket.emit('chats_list', chats.map(c => ({
        id: c.id._serialized, name: c.name, isGroup: c.isGroup,
        unreadCount: c.unreadCount, timestamp: c.timestamp
      })));
    } catch (e) { socket.emit('chats_list', []); }
  });

  socket.on('get_messages', async (chatId) => {
    if (!readyClient) { socket.emit('messages_list', []); return; }
    try {
      const chat = await readyClient.getChatById(chatId);
      const msgs = await chat.fetchMessages({ limit: 50 });
      socket.emit('messages_list', msgs.map(m => ({
        from: m.from, body: m.body, timestamp: m.timestamp, fromMe: m.fromMe
      })));
    } catch (e) { socket.emit('messages_list', []); }
  });

  socket.on('send_message', async ({ to, message }) => {
    if (!readyClient) { socket.emit('send_error', '未登录'); return; }
    try {
      const msg = await readyClient.sendMessage(to, message);
      socket.emit('message_sent', { id: msg.id._serialized, to, body: message });
    } catch (e) { socket.emit('send_error', e.message); }
  });

  socket.on('logout', async () => {
    try { if (readyClient) await readyClient.logout(); } catch (e) {}
  });
});

// ==================== REST API ====================

app.use('/api', requireAuth);

app.get('/api/status', (req, res) => {
  res.json({ status: clientStatus, qr: qrCodeData || null, info: readyClient ? readyClient.info : null });
});

app.get('/api/qr', (req, res) => {
  if (!qrRawString) return res.json({ error: 'no QR available', status: clientStatus });
  res.json({ qr: qrRawString, qr_image: qrCodeData });
});

app.post('/api/send', async (req, res) => {
  if (!readyClient) return res.status(503).json({ error: 'WhatsApp 未登录', status: clientStatus });
  const { to, message } = req.body;
  if (!to || !message) return res.status(400).json({ error: '缺少参数 to 和 message' });
  try {
    const chatId = to.includes('@') ? to : to + '@c.us';
    const msg = await readyClient.sendMessage(chatId, message);
    console.log('📤 已发送 → ' + to + ': ' + message);
    res.json({ success: true, id: msg.id._serialized, to: chatId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/chats', async (req, res) => {
  if (!readyClient) return res.status(503).json({ error: 'WhatsApp 未登录', status: clientStatus });
  try {
    const chats = await readyClient.getChats();
    res.json(chats.map(c => ({
      id: c.id._serialized, name: c.name, isGroup: c.isGroup,
      unreadCount: c.unreadCount, timestamp: c.timestamp
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/messages/:chatId', async (req, res) => {
  if (!readyClient) return res.status(503).json({ error: 'WhatsApp 未登录', status: clientStatus });
  try {
    const chatId = req.params.chatId.includes('@') ? req.params.chatId : req.params.chatId + '@c.us';
    const chat = await readyClient.getChatById(chatId);
    const messages = await chat.fetchMessages({ limit: 50 });
    res.json(messages.map(m => ({
      id: m.id._serialized, from: m.from, body: m.body, timestamp: m.timestamp, fromMe: m.fromMe
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/logout', async (req, res) => {
  if (!readyClient) return res.json({ message: '无需登出，未登录' });
  try { await readyClient.logout(); res.json({ message: '已登出' }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== 启动 ====================

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('\n🌐 本地: http://localhost:' + PORT);
  console.log('📡 API: http://localhost:' + PORT + '/api/status');
  console.log('🔑 API Key: ' + API_KEY);
  if (!process.env.WHATSAPP_API_KEY) {
    console.log('⚠️  未设置 WHATSAPP_API_KEY，重启 Key 会变。固定 Key: setx WHATSAPP_API_KEY "你的密钥"');
  }
  console.log('📱 扫码页面已就绪\n');
});