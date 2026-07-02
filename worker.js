// myproject Cloudflare Worker v3
// 控制面板 + AI对话 + 语音处理(上传→千问→DeepSeek→TTS) + 图片识别 + D1日志
// https://twilight-sun-e930.czijun59.workers.dev

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>myproject | AI Control Panel</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#06060f;--panel:rgba(12,12,40,0.85);--border:rgba(100,140,255,0.15);--cyan:#00e5ff;--purple:#a855f7;--blue:#3b82f6;--green:#22c55e;--orange:#f59e0b;--red:#ef4444;--text:#c8d0e0;--dim:#6b7280;--radius:12px}
body{font-family:'Inter',-apple-system,sans-serif;background:var(--bg);color:var(--text);min-height:100vh}
.bg-grid{position:fixed;inset:0;z-index:0;background-image:linear-gradient(rgba(59,130,246,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(59,130,246,0.04) 1px,transparent 1px);background-size:60px 60px;animation:gM 20s linear infinite}
@keyframes gM{0%{transform:translate(0,0)}to{transform:translate(60px,60px)}}
.bg-orb{position:fixed;border-radius:50%;filter:blur(120px);opacity:0.12;z-index:0}
.bg-orb1{width:600px;height:600px;background:var(--cyan);top:-200px;left:-100px}
.bg-orb2{width:500px;height:500px;background:var(--purple);bottom:-150px;right:-100px}
.bg-orb3{width:400px;height:400px;background:var(--blue);top:50%;left:50%}
.app{position:relative;z-index:1;max-width:1100px;margin:0 auto;padding:20px}
header{display:flex;align-items:center;justify-content:space-between;padding:20px 28px;background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:16px;backdrop-filter:blur(20px);flex-wrap:wrap;gap:12px}
.logo{display:flex;align-items:center;gap:12px}
.logo-icon{width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,var(--cyan),var(--purple));display:flex;align-items:center;justify-content:center;font-size:20px}
.logo h1{font-size:20px;font-weight:700;background:linear-gradient(90deg,var(--cyan),var(--purple));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.status-dot{width:8px;height:8px;background:var(--green);border-radius:50%;margin-right:6px;animation:pulse 2s infinite}
@keyframes pulse{0%,to{opacity:1;box-shadow:0 0 8px var(--green)}50%{opacity:.4;box-shadow:0 0 2px var(--green)}}
nav{display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap}
.nav-btn{padding:10px 20px;border:1px solid var(--border);border-radius:8px;background:var(--panel);color:var(--dim);cursor:pointer;font-size:14px;transition:all .3s;backdrop-filter:blur(10px);white-space:nowrap}
.nav-btn:hover{color:var(--text);border-color:rgba(255,255,255,.25)}
.nav-btn.active{color:var(--cyan);border-color:var(--cyan);box-shadow:0 0 15px rgba(0,229,255,.15);background:rgba(0,229,255,.08)}
.card{background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);padding:24px;backdrop-filter:blur(20px);transition:all .3s;margin-bottom:16px}
.card:hover{border-color:rgba(255,255,255,.2)}
.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-bottom:16px}
.stat-card{background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);padding:20px;text-align:center}
.stat-label{font-size:12px;color:var(--dim);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px}
.stat-value{font-size:32px;font-weight:700;background:linear-gradient(135deg,var(--cyan),var(--blue));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.section{display:none}
.section.active{display:block}
/* Chat */
.chat-box{display:flex;flex-direction:column;height:460px}
.chat-msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px}
.chat-msg{max-width:85%;padding:12px 16px;border-radius:14px;font-size:14px;line-height:1.6;animation:msgIn .3s ease-out}
@keyframes msgIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.msg-user{align-self:flex-end;background:linear-gradient(135deg,rgba(59,130,246,.35),rgba(168,85,247,.35));border:1px solid rgba(168,85,247,.3);border-bottom-right-radius:4px}
.msg-bot{align-self:flex-start;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-bottom-left-radius:4px}
.msg-sys{align-self:center;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.2);font-size:12px;color:var(--orange);max-width:95%}
.chat-bar{display:flex;gap:10px;padding:16px;border-top:1px solid var(--border);align-items:flex-end}
.chat-bar textarea{flex:1;padding:12px 16px;border-radius:10px;border:1px solid var(--border);background:rgba(0,0,0,.4);color:var(--text);font-size:14px;resize:none;font-family:inherit;min-height:44px;max-height:100px;outline:none;line-height:1.4}
.chat-bar textarea:focus{border-color:var(--cyan);box-shadow:0 0 10px rgba(0,229,255,.1)}
/* Buttons */
.btn{padding:10px 20px;border-radius:8px;border:none;cursor:pointer;font-size:13px;font-weight:600;transition:all .3s;display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.btn-primary{background:linear-gradient(135deg,var(--cyan),var(--blue));color:#fff;box-shadow:0 0 20px rgba(0,229,255,.3)}
.btn-primary:hover{transform:translateY(-1px);box-shadow:0 0 30px rgba(0,229,255,.5)}
.btn-purple{background:linear-gradient(135deg,var(--purple),#7c3aed);color:#fff;box-shadow:0 0 20px rgba(168,85,247,.3)}
.btn-outline{background:transparent;border:1px solid var(--border);color:var(--text)}
.btn-outline:hover{background:rgba(255,255,255,.05)}
.btn-sm{padding:6px 14px;font-size:12px}
.btn:disabled{opacity:.5;cursor:not-allowed}
/* Upload */
.upload-zone{border:2px dashed var(--border);border-radius:var(--radius);padding:40px;text-align:center;cursor:pointer;transition:all .3s}
.upload-zone:hover{border-color:var(--cyan);background:rgba(0,229,255,.03)}
.upload-zone.drag{border-color:var(--purple);background:rgba(168,85,247,.05)}
.upload-icon{font-size:40px;margin-bottom:8px}
.upload-hint{font-size:13px;color:var(--dim)}
/* Result panel */
.result-panel{display:none;margin-top:16px}
.result-panel.show{display:block}
.result-row{display:flex;align-items:flex-start;gap:12px;padding:14px;margin-bottom:8px;background:rgba(0,0,0,.3);border-radius:8px;border-left:3px solid transparent}
.result-row.r1{border-left-color:var(--cyan)}
.result-row.r2{border-left-color:var(--purple)}
.result-row.r3{border-left-color:var(--green)}
.result-label{font-size:11px;color:var(--dim);text-transform:uppercase;letter-spacing:1px;width:80px;flex-shrink:0}
.result-text{font-size:14px;line-height:1.6;flex:1}
/* Loading spinner */
.spinner{width:24px;height:24px;border:2px solid rgba(255,255,255,.1);border-top-color:var(--cyan);border-radius:50%;animation:spin .8s linear infinite;display:inline-block}
@keyframes spin{to{transform:rotate(360deg)}}
/* Toast */
.toast{position:fixed;top:20px;right:20px;z-index:200;padding:12px 20px;border-radius:8px;font-size:13px;animation:slideIn .3s ease-out;pointer-events:none}
.toast.ok{background:rgba(34,197,94,.2);border:1px solid rgba(34,197,94,.3);color:var(--green)}
.toast.err{background:rgba(239,68,68,.2);border:1px solid rgba(239,68,68,.3);color:#ef4444}
@keyframes slideIn{from{opacity:0;transform:translateX(100px)}to{opacity:1;transform:translateX(0)}}
/* Scroll */
::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:3px}
/* Code block */
.cb{background:rgba(0,0,0,.5);border:1px solid var(--border);border-radius:8px;padding:16px;font-family:'JetBrains Mono',monospace;font-size:13px;overflow-x:auto;white-space:pre-wrap;line-height:1.7;color:var(--cyan)}
.cb .k{color:var(--purple)}.cb .s{color:var(--green)}
/* Workflow grid */
.wfg{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}
.wfc{background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);padding:18px;transition:all .3s;display:flex;align-items:flex-start;gap:12px}
.wfc:hover{border-color:var(--cyan);transform:translateY(-2px);box-shadow:0 0 20px rgba(0,229,255,.1)}
.wfc.web-ready{border-color:rgba(34,197,94,.3)}
.wfc.web-ready:hover{border-color:var(--green);box-shadow:0 0 20px rgba(34,197,94,.15)}
.wfi{font-size:26px;flex-shrink:0}
.wft h3{font-size:14px;margin-bottom:4px}
.wft p{font-size:11px;color:var(--dim);line-height:1.5}
.wft .tag{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;margin:4px 4px 0 0}
.tag.ai{background:rgba(0,229,255,.15);color:var(--cyan)}
.tag.voice{background:rgba(168,85,247,.15);color:var(--purple)}
.tag.vision{background:rgba(34,197,94,.15);color:var(--green)}
.tag.service{background:rgba(245,158,11,.15);color:var(--orange)}
.tag.system{background:rgba(107,114,128,.15);color:var(--dim)}
.tag.web{background:rgba(34,197,94,.2);color:var(--green);font-weight:600}
/* Status indicators */
.svc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
.svc-item{padding:14px;border-radius:8px;border:1px solid}
.svc-item.online{background:rgba(34,197,94,.05);border-color:rgba(34,197,94,.2)}
.svc-item.offline{background:rgba(245,158,11,.05);border-color:rgba(245,158,11,.2)}
.svc-item .dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:6px}
.svc-item .dot.g{background:var(--green);box-shadow:0 0 6px var(--green)}
.svc-item .dot.o{background:var(--orange);box-shadow:0 0 6px var(--orange)}
.svc-item strong{font-size:14px}
@media(max-width:768px){.stats-grid{grid-template-columns:1fr 1fr}.wfg{grid-template-columns:1fr}.stat-value{font-size:24px}}
</style>
</head>
<body>
<div class="bg-grid"></div><div class="bg-orb bg-orb1"></div><div class="bg-orb bg-orb2"></div><div class="bg-orb bg-orb3"></div>

<div class="app">
<header>
  <div class="logo"><div class="logo-icon">🧠</div><h1>myproject</h1></div>
  <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
    <span style="display:flex;align-items:center;font-size:13px"><span class="status-dot"></span>运行中</span>
    <span style="font-size:11px;color:var(--dim)" id="u"></span>
  </div>
</header>

<nav>
  <button class="nav-btn active" data-s="overview">📊 控制台</button>
  <button class="nav-btn" data-s="chat">💬 AI 对话</button>
  <button class="nav-btn" data-s="voice">🎤 语音处理</button>
  <button class="nav-btn" data-s="vision">📸 图片识别</button>
  <button class="nav-btn" data-s="workflows">⚡ 工作流</button>
  <button class="nav-btn" data-s="api">📡 API</button>
</nav>

<!-- OVERVIEW -->
<div class="section active" id="s-overview">
  <div class="stats-grid">
    <div class="stat-card"><div class="stat-label">今日调用</div><div class="stat-value" id="sc">--</div></div>
    <div class="stat-card"><div class="stat-label">总 Token</div><div class="stat-value" id="st">--</div></div>
    <div class="stat-card"><div class="stat-label">Web 工作流</div><div class="stat-value" style="background:linear-gradient(135deg,var(--green),var(--cyan));-webkit-background-clip:text;-webkit-text-fill-color:transparent">3</div></div>
    <div class="stat-card"><div class="stat-label">本地工作流</div><div class="stat-value" style="background:linear-gradient(135deg,var(--orange),var(--purple));-webkit-background-clip:text;-webkit-text-fill-color:transparent">6</div></div>
  </div>

  <!-- 服务状态 -->
  <div class="card">
    <h3 style="font-size:15px;margin-bottom:14px">🖥️ 服务状态</h3>
    <div class="svc-grid">
      <div class="svc-item online"><span class="dot g"></span><strong>Cloudflare Worker</strong><p style="font-size:11px;color:var(--dim);margin-top:4px">API 代理 + 控制面板</p></div>
      <div class="svc-item online"><span class="dot g"></span><strong>D1 Database</strong><p style="font-size:11px;color:var(--dim);margin-top:4px">SQLite · APAC · 用量日志</p></div>
      <div class="svc-item online"><span class="dot g"></span><strong>GitHub</strong><p style="font-size:11px;color:var(--dim);margin-top:4px">EricChen789/myproject</p></div>
      <div class="svc-item offline"><span class="dot o"></span><strong>WUZAPI</strong><p style="font-size:11px;color:var(--dim);margin-top:4px">本地 :8080 · 需手动启动</p></div>
    </div>
  </div>

  <!-- 快捷入口 -->
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
      <div><h3 style="font-size:15px;margin-bottom:4px">🚀 Web 工作流（可直接使用）</h3><p style="font-size:12px;color:var(--dim)">以下功能无需本地环境，上传文件即可运行</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" onclick="st('voice')">🎤 语音处理</button>
        <button class="btn btn-purple btn-sm" onclick="st('vision')">📸 图片识别</button>
        <button class="btn btn-outline btn-sm" onclick="st('chat')">💬 AI 对话</button>
      </div>
    </div>
  </div>
</div>

<!-- AI CHAT -->
<div class="section" id="s-chat">
  <div class="card">
    <div class="chat-box">
      <div class="chat-msgs" id="chatMsgs">
        <div class="chat-msg msg-bot">👋 你好！我是 <strong>DeepSeek × 千问</strong>。<br>纯文字 → DeepSeek 直接回答<br>含图片 URL → 千问看图 → DeepSeek 总结</div>
      </div>
      <div class="chat-bar">
        <textarea id="chatIn" placeholder="输入问题... (Enter 发送, Shift+Enter 换行)" rows="1" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendChat()}"></textarea>
        <button class="btn btn-primary" onclick="sendChat()" id="chatBtn">发送</button>
      </div>
    </div>
  </div>
</div>

<!-- VOICE -->
<div class="section" id="s-voice">
  <div class="card">
    <h3 style="font-size:16px;margin-bottom:6px">🎤 粤语语音完整处理</h3>
    <p style="font-size:12px;color:var(--dim);margin-bottom:20px">上传音频 → 千问转写 → DeepSeek 书面语 → 英译 → 浏览器朗读</p>

    <div class="upload-zone" id="voiceZone" onclick="document.getElementById('voiceFile').click()">
      <div class="upload-icon">🎙️</div>
      <div class="upload-hint">点击或拖拽上传音频 (.ogg .mp3 .m4a .wav .mpeg)</div>
      <input type="file" id="voiceFile" accept="audio/*" style="display:none" onchange="handleVoice(this.files[0])">
    </div>

    <div id="voiceProgress" style="display:none;text-align:center;padding:20px">
      <span class="spinner"></span> <span id="voiceStatus" style="margin-left:8px;font-size:13px;color:var(--dim)">处理中...</span>
    </div>

    <div class="result-panel" id="voiceResult">
      <div class="result-row r1"><div class="result-label">🎤 粤语原文</div><div class="result-text" id="vr1"></div></div>
      <div class="result-row r2"><div class="result-label">📝 粤语书面语</div><div class="result-text" id="vr2"></div></div>
      <div class="result-row r3"><div class="result-label">🌐 英文翻译</div><div class="result-text" id="vr3"></div></div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn btn-primary btn-sm" onclick="speakEnglish()">🔊 朗读英文</button>
        <button class="btn btn-outline btn-sm" onclick="resetVoice()">🔄 重新上传</button>
      </div>
    </div>
    <p id="voiceError" style="display:none;color:var(--red);margin-top:12px;font-size:13px"></p>
  </div>
</div>

<!-- VISION -->
<div class="section" id="s-vision">
  <div class="card">
    <h3 style="font-size:16px;margin-bottom:6px">📸 图片智能识别</h3>
    <p style="font-size:12px;color:var(--dim);margin-bottom:20px">上传图片 → 千问 VL 详细描述（文字、布局、代码…）</p>

    <div class="upload-zone" id="imgZone" onclick="document.getElementById('imgFile').click()">
      <div class="upload-icon">🖼️</div>
      <div class="upload-hint">点击上传 或 直接 Ctrl+V 粘贴剪贴板图片</div>
      <input type="file" id="imgFile" accept="image/*" style="display:none" onchange="handleImage(this.files[0])">
    </div>

    <div id="imgPreview" style="display:none;text-align:center;margin-top:16px">
      <img id="imgThumb" style="max-width:100%;max-height:300px;border-radius:8px;border:1px solid var(--border)">
    </div>

    <div id="imgProgress" style="display:none;text-align:center;padding:20px">
      <span class="spinner"></span> <span style="margin-left:8px;font-size:13px;color:var(--dim)">千问正在识别...</span>
    </div>

    <div class="result-panel" id="imgResult">
      <div class="result-row r1"><div class="result-label">📸 识别结果</div><div class="result-text" id="ir1" style="white-space:pre-wrap"></div></div>
      <button class="btn btn-outline btn-sm" onclick="resetImage()" style="margin-top:8px">🔄 重新上传</button>
    </div>
    <p id="imgError" style="display:none;color:var(--red);margin-top:12px;font-size:13px"></p>
  </div>
</div>

<!-- WORKFLOWS -->
<div class="section" id="s-workflows">
  <p style="font-size:12px;color:var(--dim);margin-bottom:14px">
    <span style="color:var(--green)">● Web</span> = 可直接在网页使用 &nbsp;
    <span style="color:var(--orange)">● 本地</span> = 需 <code style="color:var(--purple)">python run.py</code> 启动
  </p>
  <div class="wfg" id="wfg"></div>
</div>

<!-- API -->
<div class="section" id="s-api">
  <div class="card">
    <h3 style="font-size:15px;margin-bottom:12px">📡 API 端点</h3>
    <div class="cb"><span class="k">POST</span> <span class="s">/v1/chat/completions</span>   → DeepSeek + 千问 代理（OpenAI 兼容）
<span class="k">POST</span> <span class="s">/api/audio</span>                → 上传音频 → 千问转写
<span class="k">POST</span> <span class="s">/api/vision</span>               → 上传图片 → 千问识别
<span class="k">GET</span>  <span class="s">/api/stats</span>                → 调用统计
<span class="k">GET</span>  <span class="s">/api/workflows</span>            → 工作流列表</div>
  </div>
</div>
</div>

<div id="toast" class="toast" style="display:none"></div>

<script>
// ========== INIT ==========
document.getElementById('u').textContent = location.origin;
let lastEnglish = '';

// ========== TABS ==========
function st(name){document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.s===name));document.querySelectorAll('.section').forEach(s=>s.classList.toggle('active',s.id==='s-'+name))}
document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',()=>st(b.dataset.s)));

// ========== TOAST ==========
function toast(m,t){const e=document.getElementById('toast');e.textContent=m;e.className='toast '+(t||'ok');e.style.display='block';setTimeout(()=>e.style.display='none',3000)}

// ========== STATS & WF ==========
async function loadStats(){try{const r=await fetch('/api/stats'),d=await r.json();document.getElementById('sc').textContent=d.calls_today||0;document.getElementById('st').textContent=(d.total_tokens||0).toLocaleString()}catch(e){}}
async function loadWf(){try{const r=await fetch('/api/workflows'),w=await r.json();document.getElementById('wfg').innerHTML=w.map(wf=>\`<div class="wfc \${wf.web_ready?'web-ready':''}" onclick="\${wf.web_ready?'st(\\'\'+wf.name+'\\')':'toast(\\'本地工作流：python run.py '+wf.name+'\\')'}"><div class="wfi">\${wf.display_name.slice(0,2)}</div><div class="wft"><h3>\${wf.display_name}</h3><p>\${wf.description}</p>\${wf.web_ready?'<span class="tag web">🌐 Web</span>':'<span class="tag service">💻 本地</span>'}<span class="tag \${wf.category}">\${wf.category}</span></div></div>\`).join('')}catch(e){}}

// ========== CHAT ==========
async function sendChat(){const i=document.getElementById('chatIn'),t=i.value.trim();if(!t)return;const m=document.getElementById('chatMsgs'),b=document.getElementById('chatBtn');m.appendChild(me('user',t));i.value='';m.scrollTop=m.scrollHeight;b.disabled=true;b.textContent='...';const ld=me('bot','<span class="spinner"></span>');m.appendChild(ld);try{const r=await fetch('/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'deepseek-chat',messages:[{role:'user',content:t}]})}),d=await r.json();ld.remove();m.appendChild(me('bot',d.choices[0].message.content));loadStats()}catch(e){ld.remove();m.appendChild(me('sys','❌ '+e.message))}b.disabled=false;b.textContent='发送';m.scrollTop=m.scrollHeight}
function me(r,c){const d=document.createElement('div');d.className='chat-msg msg-'+(r==='user'?'user':r==='system'?'sys':'bot');d.textContent=c;return d}

// ========== DRAG & DROP ==========
['voiceZone','imgZone'].forEach(id=>{const z=document.getElementById(id);z.addEventListener('dragover',e=>{e.preventDefault();z.classList.add('drag')});z.addEventListener('dragleave',()=>z.classList.remove('drag'));z.addEventListener('drop',e=>{e.preventDefault();z.classList.remove('drag');const f=e.dataTransfer.files[0];if(id==='voiceZone')handleVoice(f);else handleImage(f)})});

// ========== VOICE PIPELINE ==========
async function handleVoice(file){
  if(!file){return}
  document.getElementById('voiceZone').style.display='none';
  document.getElementById('voiceResult').classList.remove('show');
  document.getElementById('voiceError').style.display='none';
  const prog=document.getElementById('voiceProgress'),stat=document.getElementById('voiceStatus');
  prog.style.display='block';

  try{
    stat.textContent='[1/4] 上传音频...';
    const fd=new FormData();fd.append('file',file);
    const r=await fetch('/api/audio',{method:'POST',body:fd}),d=await r.json();
    if(d.error)throw new Error(d.error);

    stat.textContent='[2/4] DeepSeek 转书面语...';
    const r2=await fetch('/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'deepseek-chat',messages:[{role:'system',content:'你是粤语书面语转换专家。将粤语口语转为繁体中文书面语（書面語）。只输出结果。'},{role:'user',content:d.text}]})}),d2=await r2.json();
    const written=d2.choices[0].message.content;

    stat.textContent='[3/4] 翻译英文...';
    const r3=await fetch('/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'deepseek-chat',messages:[{role:'system',content:'Translate to natural English. Output only the translation.'},{role:'user',content:written}]})}),d3=await r3.json();
    const eng=d3.choices[0].message.content;
    lastEnglish=eng;

    document.getElementById('vr1').textContent=d.text;
    document.getElementById('vr2').textContent=written;
    document.getElementById('vr3').textContent=eng;
    prog.style.display='none';
    document.getElementById('voiceResult').classList.add('show');
    loadStats();
    toast('✅ 语音处理完成');
  }catch(e){
    prog.style.display='none';
    document.getElementById('voiceError').textContent='❌ '+e.message;
    document.getElementById('voiceError').style.display='block';
    document.getElementById('voiceZone').style.display='block';
  }
}

function speakEnglish(){
  if(!lastEnglish)return;
  if('speechSynthesis' in window){
    const u=new SpeechSynthesisUtterance(lastEnglish);
    u.lang='en-US';u.rate=1;u.pitch=1;
    const voices=speechSynthesis.getVoices();
    const en=voices.find(v=>v.lang.startsWith('en'))||voices[0];
    if(en)u.voice=en;
    speechSynthesis.speak(u);
    toast('🔊 正在朗读...');
  }else{toast('浏览器不支持语音合成','err')}
}

function resetVoice(){
  document.getElementById('voiceZone').style.display='block';
  document.getElementById('voiceResult').classList.remove('show');
  document.getElementById('voiceFile').value='';
  lastEnglish='';
}

// ========== VISION ==========
async function handleImage(file){
  if(!file)return;
  document.getElementById('imgZone').style.display='none';
  document.getElementById('imgResult').classList.remove('show');
  document.getElementById('imgError').style.display='none';
  document.getElementById('imgProgress').style.display='block';

  // Preview
  const reader=new FileReader();
  reader.onload=e=>{document.getElementById('imgThumb').src=e.target.result;document.getElementById('imgPreview').style.display='block'};
  reader.readAsDataURL(file);

  try{
    const fd=new FormData();fd.append('file',file);
    const r=await fetch('/api/vision',{method:'POST',body:fd}),d=await r.json();
    if(d.error)throw new Error(d.error);

    document.getElementById('ir1').textContent=d.description;
    document.getElementById('imgProgress').style.display='none';
    document.getElementById('imgResult').classList.add('show');
    loadStats();
    toast('✅ 图片识别完成');
  }catch(e){
    document.getElementById('imgProgress').style.display='none';
    document.getElementById('imgError').textContent='❌ '+e.message;
    document.getElementById('imgError').style.display='block';
    document.getElementById('imgZone').style.display='block';
    document.getElementById('imgPreview').style.display='none';
  }
}

function resetImage(){
  document.getElementById('imgZone').style.display='block';
  document.getElementById('imgResult').classList.remove('show');
  document.getElementById('imgPreview').style.display='none';
  document.getElementById('imgFile').value='';
}

// ========== CLIPBOARD PASTE (图片) ==========
document.addEventListener('paste', e => {
  const s = document.querySelector('#s-vision');
  if (!s || !s.classList.contains('active')) return;  // 只在图片识别页生效
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault();
      const blob = item.getAsFile();
      handleImage(blob);
      toast('📋 已粘贴剪贴板图片');
      return;
    }
  }
});

loadStats();loadWf();setInterval(loadStats,30000);
</script>
</body>
</html>`;

// ============================================================
// WORKER
// ============================================================
export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*" }
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const DEEPSEEK_KEY = env.DEEPSEEK_API_KEY;
    const QWEN_KEY = env.QWEN_API_KEY;

    // ===== 首页 =====
    if (path === "/" && method === "GET") {
      return new Response(DASHBOARD_HTML, {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    // ===== 统计 =====
    if (path === "/api/stats" && method === "GET") {
      try {
        const today = new Date().toISOString().split('T')[0];
        let callsToday = 0, totalTokens = 0;
        if (env.myproject_db) {
          const { results: cr } = await env.myproject_db.prepare("SELECT COUNT(*) as c FROM usage_logs WHERE date(timestamp) = ?").bind(today).all();
          callsToday = cr[0]?.c || 0;
          const { results: tr } = await env.myproject_db.prepare("SELECT COALESCE(SUM(total_tokens),0) as t FROM usage_logs").all();
          totalTokens = tr[0]?.t || 0;
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
          const { results } = await env.myproject_db.prepare("SELECT name, display_name, description, category FROM workflow_configs WHERE enabled = 1").all();
          workflows = results.map(w => ({
            ...w,
            web_ready: ["deepseek-qa"].includes(w.name) || w.category === "ai"
          }));
        }
        // 自定义 web_ready 标记
        workflows = workflows.map(w => ({
          ...w,
          web_ready: w.name === "deepseek-qa"
        }));
        return new Response(JSON.stringify(workflows), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
      }
    }

    // ===== 音频处理 =====
    if (path === "/api/audio" && method === "POST") {
      try {
        const formData = await request.formData();
        const file = formData.get("file");
        if (!file || !(file instanceof File)) {
          return new Response(JSON.stringify({ error: "请上传音频文件" }), { status: 400 });
        }

        // 限制 25MB
        if (file.size > 50 * 1024 * 1024) {
          return new Response(JSON.stringify({ error: "文件太大（最大 50MB）" }), { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        const ext = (file.name.split('.').pop() || 'ogg').toLowerCase();
        const mimeMap = { ogg: 'audio/ogg', mp3: 'audio/mpeg', mpeg: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', opus: 'audio/ogg', oga: 'audio/ogg' };
        const mime = mimeMap[ext] || 'audio/ogg';

        // 调用千问音频 API
        const qwenResp = await fetch("https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${QWEN_KEY}`
          },
          body: JSON.stringify({
            model: "qwen-audio-turbo-latest",
            input: {
              messages: [{
                role: "user",
                content: [
                  { text: "请一字不漏地将这段粤语语音转换为文本，使用繁体中文（繁體字），保留原汁原味的粤语口语字如 咩、唔、係、佢、乜、冇、嘅、啲、喺、嗰 等。" },
                  { audio: `data:${mime};base64,${base64}` }
                ]
              }]
            }
          })
        });

        const qwenData = await qwenResp.json();
        if (qwenData.code || qwenData.error) {
          return new Response(JSON.stringify({ error: qwenData.message || qwenData.error?.message || "千问 API 错误" }), { status: 500 });
        }

        const text = qwenData.output?.choices?.[0]?.message?.content?.[0]?.text || "";
        const usage = qwenData.usage || {};
        const totalTokens = (usage.input_tokens || 0) + (usage.output_tokens || 0);

        // 记录到 D1
        if (env.myproject_db) {
          const ip = request.headers.get("cf-connecting-ip") || "unknown";
          const ua = (request.headers.get("user-agent") || "").slice(0, 200);
          await env.myproject_db.prepare(
            "INSERT INTO usage_logs (type, model, prompt_tokens, completion_tokens, total_tokens, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)"
          ).bind("audio", "qwen-audio-turbo-latest", usage.input_tokens || 0, usage.output_tokens || 0, totalTokens, ip, ua).run();
        }

        return new Response(JSON.stringify({ text, tokens: totalTokens }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
      }
    }

    // ===== 图片识别 =====
    if (path === "/api/vision" && method === "POST") {
      try {
        const formData = await request.formData();
        const file = formData.get("file");
        if (!file || !(file instanceof File)) {
          return new Response(JSON.stringify({ error: "请上传图片文件" }), { status: 400 });
        }

        if (file.size > 10 * 1024 * 1024) {
          return new Response(JSON.stringify({ error: "文件太大（最大 10MB）" }), { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        const ext = (file.name.split('.').pop() || 'png').toLowerCase();
        const mimeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp' };
        const mime = mimeMap[ext] || 'image/jpeg';

        // 千问视觉
        const qwenResp = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
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
                { type: "text", text: "请扮演一个视觉大师，仔细观察这张图片，并详细描述你看到的所有内容。包括但不限于：所有文字（特别是代码、报错信息）、界面布局、颜色、以及各种微小的细节，不要漏掉任何蛛丝马迹。" },
                { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } }
              ]
            }]
          })
        });

        const qwenData = await qwenResp.json();
        if (qwenData.error) {
          return new Response(JSON.stringify({ error: qwenData.error.message || "千问 API 错误" }), { status: 500 });
        }

        const description = qwenData.choices?.[0]?.message?.content || "";
        const usage = qwenData.usage || {};
        const totalTokens = (usage.prompt_tokens || 0) + (usage.completion_tokens || 0);

        // 记录到 D1
        if (env.myproject_db) {
          const ip = request.headers.get("cf-connecting-ip") || "unknown";
          const ua = (request.headers.get("user-agent") || "").slice(0, 200);
          await env.myproject_db.prepare(
            "INSERT INTO usage_logs (type, model, prompt_tokens, completion_tokens, total_tokens, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)"
          ).bind("vision", "qwen-vl-max", usage.prompt_tokens || 0, usage.completion_tokens || 0, totalTokens, ip, ua).run();
        }

        return new Response(JSON.stringify({ description, tokens: totalTokens }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
      }
    }

    // ===== API — /v1/chat/completions =====
    if (path === "/v1/chat/completions" && method === "POST") {
      try {
        const body = await request.json();
        let hasImage = false, imageContent = null, originalTextPrompt = "", modelUsed = "deepseek-chat";
        let totalPromptTokens = 0, totalCompletionTokens = 0;

        if (body.messages?.length > 0) {
          const last = body.messages[body.messages.length - 1];
          if (Array.isArray(last.content)) {
            for (const item of last.content) {
              if (item.type === "image_url" || item.type === "image") { hasImage = true; imageContent = item; }
              else if (item.type === "text") { originalTextPrompt += item.text; }
            }
          }
        }

        if (hasImage) {
          const qr = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
            method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${QWEN_KEY}` },
            body: JSON.stringify({ model: "qwen-vl-max", messages: [{ role: "user", content: [{ type: "text", text: "详细描述这张图片" }, imageContent] }] })
          });
          const qd = await qr.json();
          if (qd.usage) { totalPromptTokens += qd.usage.prompt_tokens || 0; totalCompletionTokens += qd.usage.completion_tokens || 0; }
          modelUsed = "qwen-vl-max + deepseek-chat";
          body.messages = body.messages.map((m, i) => i === body.messages.length - 1 ? { role: "user", content: `【千问视觉报告】\n${qd.choices[0].message.content}\n\n【用户原话】：${originalTextPrompt}` } : m);
        }

        body.model = "deepseek-chat";
        const dr = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${DEEPSEEK_KEY}` }, body: JSON.stringify(body)
        });
        const dd = await dr.json();
        if (dd.usage) { totalPromptTokens += dd.usage.prompt_tokens || 0; totalCompletionTokens += dd.usage.completion_tokens || 0; }

        if (env.myproject_db) {
          const ip = request.headers.get("cf-connecting-ip") || "unknown";
          const ua = (request.headers.get("user-agent") || "").slice(0, 200);
          await env.myproject_db.prepare(
            "INSERT INTO usage_logs (type, model, prompt_tokens, completion_tokens, total_tokens, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)"
          ).bind(hasImage ? "vision" : "chat", modelUsed, totalPromptTokens, totalCompletionTokens, totalPromptTokens + totalCompletionTokens, ip, ua).run();
        }

        return new Response(JSON.stringify(dd), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    // 其他请求
    const fetchUrl = `https://api.deepseek.com${path}${url.search}`;
    return fetch(new Request(fetchUrl, request));
  }
};