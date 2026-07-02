// ============================================================
// myproject Cloudflare Worker
// 首页 → 高科技控制面板 | API → DeepSeek + 千问代理 | D1 → 日志
// ============================================================

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>myproject | AI Control Panel</title>
<style>
/* ===== RESET & BASE ===== */
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --bg:#06060f;
  --panel:rgba(12,12,40,0.85);
  --border:rgba(100,140,255,0.15);
  --cyan:#00e5ff;
  --purple:#a855f7;
  --blue:#3b82f6;
  --green:#22c55e;
  --orange:#f59e0b;
  --text:#c8d0e0;
  --dim:#6b7280;
  --glow-cyan:0 0 20px rgba(0,229,255,0.3);
  --glow-purple:0 0 20px rgba(168,85,247,0.3);
  --radius:12px;
}
body{
  font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;
  background:var(--bg);
  color:var(--text);
  min-height:100vh;
  overflow-x:hidden;
}
/* ===== ANIMATED BG ===== */
.bg-grid{
  position:fixed;inset:0;z-index:0;
  background-image:
    linear-gradient(rgba(59,130,246,0.04) 1px,transparent 1px),
    linear-gradient(90deg,rgba(59,130,246,0.04) 1px,transparent 1px);
  background-size:60px 60px;
  animation:gridMove 20s linear infinite;
}
@keyframes gridMove{0%{transform:translate(0,0)}100%{transform:translate(60px,60px)}}
.bg-orb{
  position:fixed;border-radius:50%;filter:blur(120px);opacity:0.12;z-index:0;
  animation:orbFloat 8s ease-in-out infinite;
}
.bg-orb1{width:600px;height:600px;background:var(--cyan);top:-200px;left:-100px;animation-delay:0s}
.bg-orb2{width:500px;height:500px;background:var(--purple);bottom:-150px;right:-100px;animation-delay:3s}
.bg-orb3{width:400px;height:400px;background:var(--blue);top:50%;left:50%;animation-delay:6s}
@keyframes orbFloat{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(30px,-30px) scale(1.1)}66%{transform:translate(-20px,20px) scale(0.9)}}

/* ===== LAYOUT ===== */
.app{position:relative;z-index:1;max-width:1100px;margin:0 auto;padding:20px}
header{
  display:flex;align-items:center;justify-content:space-between;
  padding:20px 28px;background:var(--panel);border:1px solid var(--border);
  border-radius:var(--radius);margin-bottom:20px;backdrop-filter:blur(20px);
  flex-wrap:wrap;gap:12px;
}
.logo{display:flex;align-items:center;gap:12px}
.logo-icon{
  width:40px;height:40px;border-radius:10px;
  background:linear-gradient(135deg,var(--cyan),var(--purple));
  display:flex;align-items:center;justify-content:center;font-size:20px;
}
.logo h1{font-size:20px;font-weight:700;background:linear-gradient(90deg,var(--cyan),var(--purple));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.status-dot{width:8px;height:8px;background:var(--green);border-radius:50%;margin-right:6px;animation:pulse 2s infinite;}
@keyframes pulse{0%,100%{opacity:1;box-shadow:0 0 8px var(--green)}50%{opacity:0.4;box-shadow:0 0 2px var(--green)}}

/* ===== NAV TABS ===== */
nav{display:flex;gap:6px;margin-bottom:20px;flex-wrap:wrap}
.nav-btn{
  padding:10px 20px;border:1px solid var(--border);border-radius:8px;
  background:var(--panel);color:var(--dim);cursor:pointer;
  font-size:14px;transition:all 0.3s;backdrop-filter:blur(10px);
}
.nav-btn:hover{color:var(--text);border-color:rgba(255,255,255,0.25)}
.nav-btn.active{
  color:var(--cyan);border-color:var(--cyan);
  box-shadow:0 0 15px rgba(0,229,255,0.15);background:rgba(0,229,255,0.08);
}

/* ===== CARDS ===== */
.card{
  background:var(--panel);border:1px solid var(--border);
  border-radius:var(--radius);padding:24px;backdrop-filter:blur(20px);
  transition:all 0.3s;
}
.card:hover{border-color:rgba(255,255,255,0.2)}
.card-header{font-size:14px;color:var(--dim);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px}
.card-value{font-size:36px;font-weight:700;background:linear-gradient(135deg,var(--cyan),var(--blue));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.card-sub{font-size:12px;color:var(--dim);margin-top:4px}

.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px}

/* ===== CHAT ===== */
.chat-container{display:flex;flex-direction:column;height:500px}
.chat-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px}
.chat-msg{max-width:85%;padding:12px 18px;border-radius:16px;font-size:14px;line-height:1.6;animation:msgIn 0.3s ease-out}
@keyframes msgIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.chat-msg.user{align-self:flex-end;background:linear-gradient(135deg,rgba(59,130,246,0.3),rgba(168,85,247,0.3));border:1px solid rgba(168,85,247,0.3);border-bottom-right-radius:4px}
.chat-msg.assistant{align-self:flex-start;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-bottom-left-radius:4px}
.chat-msg.system{align-self:center;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.2);font-size:12px;color:var(--orange);max-width:95%}
.chat-input-area{display:flex;gap:10px;padding:16px;border-top:1px solid var(--border)}
.chat-input-area textarea{
  flex:1;padding:12px 16px;border-radius:10px;border:1px solid var(--border);
  background:rgba(0,0,0,0.4);color:var(--text);font-size:14px;resize:none;
  font-family:inherit;min-height:44px;max-height:120px;outline:none;
  transition:border-color 0.3s;
}
.chat-input-area textarea:focus{border-color:var(--cyan);box-shadow:0 0 10px rgba(0,229,255,0.1)}
.btn{
  padding:10px 20px;border-radius:8px;border:none;cursor:pointer;font-size:14px;
  font-weight:600;transition:all 0.3s;display:inline-flex;align-items:center;gap:6px;
}
.btn-primary{background:linear-gradient(135deg,var(--cyan),var(--blue));color:#fff;box-shadow:var(--glow-cyan)}
.btn-primary:hover{transform:translateY(-1px);box-shadow:0 0 30px rgba(0,229,255,0.4)}
.btn-purple{background:linear-gradient(135deg,var(--purple),#7c3aed);color:#fff;box-shadow:var(--glow-purple)}
.btn-purple:hover{transform:translateY(-1px);box-shadow:0 0 30px rgba(168,85,247,0.4)}
.btn-outline{
  background:transparent;border:1px solid var(--border);color:var(--text);
}
.btn-outline:hover{background:rgba(255,255,255,0.05);border-color:rgba(255,255,255,0.3)}
.btn:disabled{opacity:0.5;cursor:not-allowed;transform:none!important}

/* ===== WORKFLOW GRID ===== */
.wf-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
.wf-card{
  background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);
  padding:20px;cursor:pointer;transition:all 0.3s;backdrop-filter:blur(10px);
  display:flex;align-items:flex-start;gap:14px;
}
.wf-card:hover{border-color:var(--cyan);box-shadow:0 0 20px rgba(0,229,255,0.1);transform:translateY(-2px)}
.wf-icon{font-size:28px;flex-shrink:0}
.wf-info{flex:1}
.wf-info h3{font-size:15px;margin-bottom:4px;color:#e0e0e0}
.wf-info p{font-size:12px;color:var(--dim);line-height:1.5}
.wf-badge{
  display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;
  margin-top:6px;font-weight:500;
}
.wf-badge.ai{background:rgba(0,229,255,0.15);color:var(--cyan)}
.wf-badge.voice{background:rgba(168,85,247,0.15);color:var(--purple)}
.wf-badge.vision{background:rgba(34,197,94,0.15);color:var(--green)}
.wf-badge.service{background:rgba(245,158,11,0.15);color:var(--orange)}
.wf-badge.system{background:rgba(107,114,128,0.15);color:var(--dim)}

/* ===== MODAL ===== */
.modal-overlay{
  position:fixed;inset:0;z-index:100;background:rgba(0,0,0,0.7);
  display:flex;align-items:center;justify-content:center;
  backdrop-filter:blur(4px);
}
.modal{
  background:var(--panel);border:1px solid var(--border);border-radius:16px;
  padding:32px;max-width:600px;width:90%;max-height:80vh;overflow-y:auto;
  box-shadow:0 20px 60px rgba(0,0,0,0.5);
}
.modal h2{font-size:20px;margin-bottom:12px}
.modal-close{
  float:right;background:none;border:none;color:var(--dim);font-size:24px;
  cursor:pointer;transition:color 0.2s;
}
.modal-close:hover{color:#fff}

/* ===== TOAST ===== */
.toast{
  position:fixed;top:20px;right:20px;z-index:200;
  padding:12px 20px;border-radius:8px;font-size:13px;
  animation:slideIn 0.3s ease-out;pointer-events:none;
}
.toast.success{background:rgba(34,197,94,0.2);border:1px solid rgba(34,197,94,0.3);color:var(--green)}
.toast.error{background:rgba(239,68,68,0.2);border:1px solid rgba(239,68,68,0.3);color:#ef4444}
@keyframes slideIn{from{opacity:0;transform:translateX(100px)}to{opacity:1;transform:translateX(0)}}

/* ===== RESPONSIVE ===== */
@media(max-width:768px){
  header{flex-direction:column;align-items:flex-start}
  .stats-grid{grid-template-columns:1fr 1fr}
  .wf-grid{grid-template-columns:1fr}
  .card-value{font-size:28px}
}

/* ===== SCROLLBAR ===== */
::-webkit-scrollbar{width:6px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.2)}

/* ===== SECTION PANELS ===== */
.section{display:none}
.section.active{display:block}

/* ===== API DOC BLOCK ===== */
.code-block{
  background:rgba(0,0,0,0.5);border:1px solid var(--border);border-radius:8px;
  padding:16px;font-family:'JetBrains Mono','Fira Code',monospace;font-size:13px;
  overflow-x:auto;white-space:pre-wrap;line-height:1.7;color:var(--cyan);
}
.code-block .key{color:var(--purple)}
.code-block .str{color:var(--green)}
</style>
</head>
<body>

<div class="bg-grid"></div>
<div class="bg-orb bg-orb1"></div>
<div class="bg-orb bg-orb2"></div>
<div class="bg-orb bg-orb3"></div>

<div class="app">

<!-- HEADER -->
<header>
  <div class="logo">
    <div class="logo-icon">🧠</div>
    <h1>myproject</h1>
  </div>
  <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
    <span style="display:flex;align-items:center;font-size:13px">
      <span class="status-dot"></span> 运行中
    </span>
    <span style="font-size:12px;color:var(--dim)" id="workerUrl"></span>
  </div>
</header>

<!-- NAV -->
<nav>
  <button class="nav-btn active" data-section="overview">📊 控制台</button>
  <button class="nav-btn" data-section="chat">💬 AI 对话</button>
  <button class="nav-btn" data-section="workflows">⚡ 工作流</button>
  <button class="nav-btn" data-section="api">📡 API</button>
</nav>

<!-- SECTION: OVERVIEW -->
<div class="section active" id="sec-overview">
  <div class="stats-grid">
    <div class="card"><div class="card-header">今日 API 调用</div><div class="card-value" id="statCalls">--</div><div class="card-sub">次请求</div></div>
    <div class="card"><div class="card-header">总消耗 Token</div><div class="card-value" id="statTokens">--</div><div class="card-sub">全部累计</div></div>
    <div class="card"><div class="card-header">活跃工作流</div><div class="card-value" id="statWfs">9</div><div class="card-sub">个可用</div></div>
    <div class="card"><div class="card-header">Worker 版本</div><div class="card-value" style="font-size:24px" id="statVer">v2.0</div><div class="card-sub">Control Panel</div></div>
  </div>

  <div class="card" style="margin-bottom:16px">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
      <div>
        <h3 style="font-size:16px;margin-bottom:4px">🚀 快速操作</h3>
        <p style="font-size:12px;color:var(--dim)">常用工作流一键触发（本地服务需运行中）</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" onclick="switchTab('chat')">💬 AI 对话</button>
        <button class="btn btn-purple btn-sm" onclick="switchTab('workflows')">⚡ 工作流</button>
        <button class="btn btn-outline btn-sm" onclick="window.open('https://github.com/EricChen789/myproject')">📦 GitHub</button>
      </div>
    </div>
  </div>

  <!-- Service Status -->
  <div class="card">
    <h3 style="font-size:16px;margin-bottom:16px">🖥️ 服务状态</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">
      <div style="padding:14px;background:rgba(34,197,94,0.05);border:1px solid rgba(34,197,94,0.15);border-radius:8px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px"><span class="status-dot"></span><strong style="font-size:14px">Cloudflare Worker</strong></div>
        <p style="font-size:11px;color:var(--dim)">API 代理 + 控制面板</p>
      </div>
      <div style="padding:14px;background:rgba(245,158,11,0.05);border:1px solid rgba(245,158,11,0.15);border-radius:8px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px"><span style="width:8px;height:8px;background:var(--orange);border-radius:50%"></span><strong style="font-size:14px">WUZAPI</strong></div>
        <p style="font-size:11px;color:var(--dim)">localhost:8080（手动启动）</p>
      </div>
      <div style="padding:14px;background:rgba(0,229,255,0.05);border:1px solid rgba(0,229,255,0.15);border-radius:8px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px"><span style="width:8px;height:8px;background:var(--cyan);border-radius:50%"></span><strong style="font-size:14px">D1 Database</strong></div>
        <p style="font-size:11px;color:var(--dim)">SQLite · APAC 区域</p>
      </div>
      <div style="padding:14px;background:rgba(168,85,247,0.05);border:1px solid rgba(168,85,247,0.15);border-radius:8px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px"><span style="width:8px;height:8px;background:var(--purple);border-radius:50%"></span><strong style="font-size:14px">GitHub</strong></div>
        <p style="font-size:11px;color:var(--dim)">EricChen789/myproject</p>
      </div>
    </div>
  </div>
</div>

<!-- SECTION: CHAT -->
<div class="section" id="sec-chat">
  <div class="card">
    <div class="chat-container">
      <div class="chat-messages" id="chatMsgs">
        <div class="chat-msg assistant">
          👋 你好！我是 <strong>DeepSeek × 千问</strong> AI 助手。<br>
          直接提问，我会全力回答。如需识别图片，请提及图片 URL。
        </div>
      </div>
      <div class="chat-input-area">
        <textarea id="chatInput" placeholder="输入你的问题..." rows="1" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendMsg()}"></textarea>
        <button class="btn btn-primary" onclick="sendMsg()" id="sendBtn">发送</button>
      </div>
    </div>
  </div>
</div>

<!-- SECTION: WORKFLOWS -->
<div class="section" id="sec-workflows">
  <div class="wf-grid" id="wfGrid"></div>
</div>

<!-- SECTION: API -->
<div class="section" id="sec-api">
  <div class="card" style="margin-bottom:16px">
    <h3 style="font-size:16px;margin-bottom:12px">📡 API 端点</h3>
    <div class="code-block"><span class="key">POST</span> <span class="str">/v1/chat/completions</span>
Content-Type: application/json
{
  "model": "deepseek-chat",
  "messages": [{"role": "user", "content": "你的问题"}]
}</div>
  </div>
  <div class="card" style="margin-bottom:16px">
    <h3 style="font-size:16px;margin-bottom:12px">📊 统计端点</h3>
    <div class="code-block"><span class="key">GET</span> <span class="str">/api/stats</span>
→ { "calls_today": 42, "total_tokens": 15000, "workflows": [...] }</div>
  </div>
  <div class="card">
    <h3 style="font-size:16px;margin-bottom:12px">🧠 工作流程</h3>
    <p style="font-size:13px;color:var(--dim);line-height:1.8">
      纯文字 → <code style="color:var(--cyan)">DeepSeek V4</code> 直接回答<br>
      含图片 → <code style="color:var(--purple)">千问 VL</code> 看图 → <code style="color:var(--cyan)">DeepSeek</code> 综合回答
    </p>
  </div>
</div>

</div><!-- /app -->

<!-- TOAST -->
<div id="toast" class="toast" style="display:none"></div>

<script>
// ===== 初始化 =====
document.getElementById('workerUrl').textContent = window.location.origin;

// ===== Tab 切换 =====
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.section));
});

function switchTab(name){
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const btn = document.querySelector('[data-section="'+name+'"]');
  if(btn) btn.classList.add('active');
  const sec = document.getElementById('sec-'+name);
  if(sec) sec.classList.add('active');
}

// ===== Toast =====
function toast(msg, type='success'){
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast '+type; t.style.display='block';
  setTimeout(() => t.style.display='none', 3000);
}

// ===== 加载统计 =====
async function loadStats(){
  try{
    const r = await fetch('/api/stats');
    const d = await r.json();
    document.getElementById('statCalls').textContent = d.calls_today || 0;
    document.getElementById('statTokens').textContent = (d.total_tokens || 0).toLocaleString();
  }catch(e){}
}

// ===== 加载工作流 =====
async function loadWorkflows(){
  try{
    const r = await fetch('/api/workflows');
    const wfs = await r.json();
    const grid = document.getElementById('wfGrid');
    grid.innerHTML = wfs.map(w => \`
      <div class="wf-card" onclick="triggerWf('\${w.name}')">
        <div class="wf-icon">\${w.display_name.slice(0,2)}</div>
        <div class="wf-info">
          <h3>\${w.display_name}</h3>
          <p>\${w.description || ''}</p>
          <span class="wf-badge \${w.category}">\${w.category}</span>
        </div>
      </div>
    \`).join('');
  }catch(e){}
}

function triggerWf(name){
  toast('工作流 "'+name+'" 需要在本地终端运行：python run.py '+name, 'success');
}

// ===== AI 聊天 =====
async function sendMsg(){
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if(!text) return;

  const msgs = document.getElementById('chatMsgs');
  const btn = document.getElementById('sendBtn');

  // 用户消息
  msgs.appendChild(createMsg('user', text));
  input.value = '';
  msgs.scrollTop = msgs.scrollHeight;

  btn.disabled = true;
  btn.textContent = '思考中...';

  // 加载动画
  const loadMsg = createMsg('assistant', '<span style="color:var(--dim)">⏳ 思考中...</span>');
  msgs.appendChild(loadMsg);

  try{
    const r = await fetch('/v1/chat/completions', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        model:'deepseek-chat',
        messages:[{role:'user',content:text}]
      })
    });
    const d = await r.json();
    loadMsg.remove();

    if(d.error){
      msgs.appendChild(createMsg('system', '❌ 错误: '+ (d.error.message || JSON.stringify(d.error))));
    }else{
      msgs.appendChild(createMsg('assistant', d.choices[0].message.content));
    }
    loadStats();
  }catch(e){
    loadMsg.remove();
    msgs.appendChild(createMsg('system', '❌ 网络错误: '+e.message));
  }

  btn.disabled = false;
  btn.textContent = '发送';
  msgs.scrollTop = msgs.scrollHeight;
}

function createMsg(role, content){
  const div = document.createElement('div');
  div.className = 'chat-msg '+role;
  div.innerHTML = content;
  return div;
}

loadStats();
loadWorkflows();
setInterval(loadStats, 30000);
</script>
</body>
</html>`;

// ============================================================
// WORKER LOGIC
// ============================================================

export default {
  async fetch(request, env) {
    // CORS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Allow-Methods": "*"
        }
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // ===== 首页 — 控制面板 =====
    if (path === "/" && method === "GET") {
      return new Response(DASHBOARD_HTML, {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    // ===== API 统计 =====
    if (path === "/api/stats" && method === "GET") {
      try {
        const today = new Date().toISOString().split('T')[0];
        let callsToday = 0, totalTokens = 0;

        if (env.myproject_db) {
          const { results: cr } = await env.myproject_db
            .prepare("SELECT COUNT(*) as count FROM usage_logs WHERE date(timestamp) = ?")
            .bind(today).all();
          callsToday = cr[0]?.count || 0;

          const { results: tr } = await env.myproject_db
            .prepare("SELECT COALESCE(SUM(total_tokens), 0) as total FROM usage_logs")
            .all();
          totalTokens = tr[0]?.total || 0;
        }

        return new Response(JSON.stringify({ calls_today: callsToday, total_tokens: totalTokens }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
      }
    }

    // ===== 工作流列表 =====
    if (path === "/api/workflows" && method === "GET") {
      try {
        let workflows = [];
        if (env.myproject_db) {
          const { results } = await env.myproject_db
            .prepare("SELECT name, display_name, description, category FROM workflow_configs WHERE enabled = 1")
            .all();
          workflows = results;
        }
        return new Response(JSON.stringify(workflows), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
      }
    }

    // ===== API — /v1/chat/completions =====
    if (path === "/v1/chat/completions" && method === "POST") {
      const DEEPSEEK_KEY = env.DEEPSEEK_API_KEY;
      const QWEN_KEY = env.QWEN_API_KEY;

      try {
        const body = await request.json();
        let hasImage = false;
        let imageContent = null;
        let originalTextPrompt = "";
        let modelUsed = "deepseek-chat";
        let totalPromptTokens = 0;
        let totalCompletionTokens = 0;

        // 检测图片
        if (body.messages && body.messages.length > 0) {
          const lastMessage = body.messages[body.messages.length - 1];
          if (Array.isArray(lastMessage.content)) {
            for (const item of lastMessage.content) {
              if (item.type === "image_url" || item.type === "image") {
                hasImage = true;
                imageContent = item;
              } else if (item.type === "text") {
                originalTextPrompt += item.text;
              }
            }
          }
        }

        // 有图片：先调千问
        if (hasImage) {
          const qwenResponse = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${QWEN_KEY}`
            },
            body: JSON.stringify({
              model: "qwen-vl-max",
              messages: [{
                role: "user",
                content: [
                  { type: "text", text: "请扮演视觉大师极其详细地描述这张图片" },
                  imageContent
                ]
              }]
            })
          });

          const qwenData = await qwenResponse.json();
          if (qwenData.usage) {
            totalPromptTokens += qwenData.usage.prompt_tokens || 0;
            totalCompletionTokens += qwenData.usage.completion_tokens || 0;
          }
          const qwenReport = qwenData.choices[0].message.content;
          modelUsed = "qwen-vl-max + deepseek-chat";

          body.messages = body.messages.map((msg, i) => {
            if (i === body.messages.length - 1) {
              return {
                role: "user",
                content: `【千问视觉报告】\n${qwenReport}\n\n【用户原话】：${originalTextPrompt}`
              };
            }
            return msg;
          });
        }

        // 调 DeepSeek
        body.model = "deepseek-chat";
        const dsResponse = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${DEEPSEEK_KEY}`
          },
          body: JSON.stringify(body)
        });

        const dsData = await dsResponse.json();
        if (dsData.usage) {
          totalPromptTokens += dsData.usage.prompt_tokens || 0;
          totalCompletionTokens += dsData.usage.completion_tokens || 0;
        }

        // 记录到 D1
        if (env.myproject_db) {
          const ip = request.headers.get("cf-connecting-ip") || "unknown";
          const ua = (request.headers.get("user-agent") || "").slice(0, 200);
          await env.myproject_db.prepare(
            "INSERT INTO usage_logs (type, model, prompt_tokens, completion_tokens, total_tokens, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)"
          ).bind(
            hasImage ? "vision" : "chat",
            modelUsed,
            totalPromptTokens,
            totalCompletionTokens,
            totalPromptTokens + totalCompletionTokens,
            ip,
            ua
          ).run();
        }

        return new Response(JSON.stringify(dsData), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });

      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    // 其他请求：转发 DeepSeek
    const fetchUrl = `https://api.deepseek.com${path}${url.search}`;
    const newRequest = new Request(fetchUrl, request);
    return fetch(newRequest);
  }
};