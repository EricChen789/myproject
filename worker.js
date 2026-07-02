const HTML_PAGE = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DeepSeek × 千问 | AI 服务</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%);
      color: #e0e0e0;
      min-height: 100vh;
      display: flex; align-items: center; justify-content: center;
    }
    .card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px;
      padding: 48px;
      max-width: 520px;
      text-align: center;
      backdrop-filter: blur(10px);
    }
    h1 {
      font-size: 28px; margin-bottom: 8px;
      background: linear-gradient(90deg, #4f8cf7, #a855f7);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .badge {
      display: inline-block;
      background: rgba(79,140,247,0.2);
      color: #4f8cf7;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 13px;
      margin-bottom: 24px;
    }
    .info {
      text-align: left;
      background: rgba(0,0,0,0.3);
      border-radius: 10px;
      padding: 20px;
      margin: 20px 0;
      line-height: 1.8;
      font-size: 14px;
    }
    .info code {
      color: #a855f7;
      background: rgba(168,85,247,0.15);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 13px;
    }
    .status {
      display: flex; align-items: center; justify-content: center;
      gap: 6px; color: #4ade80; font-size: 13px;
    }
    .dot {
      width: 8px; height: 8px;
      background: #4ade80; border-radius: 50%;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>DeepSeek × 千问</h1>
    <div class="badge">多模型 AI 服务</div>
    <div class="status"><span class="dot"></span> 服务运行中</div>
    <div class="info">
      <p>📡 <strong>API 地址</strong></p>
      <p><code>POST /v1/chat/completions</code></p>
      <br>
      <p>🧠 <strong>工作流程</strong></p>
      <p>纯文字 → <code>DeepSeek V4</code> 直接回答</p>
      <p>含图片 → <code>千问 VL</code> 看图 → <code>DeepSeek</code> 综合回答</p>
    </div>
    <p style="font-size:12px; color:#666; margin-top:16px;">
      此页面只展示信息，API 需用 POST 调用
    </p>
  </div>
</body>
</html>`;

export default {
  async fetch(request, env) {
    // 允许跨域
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Allow-Methods": "*"
        }
      });
    }

    const DEEPSEEK_KEY = env.DEEPSEEK_API_KEY;
    const QWEN_KEY = env.QWEN_API_KEY;
    const url = new URL(request.url);

    // 首页 — 展示给浏览器访问者
    if (url.pathname === "/" && request.method === "GET") {
      return new Response(HTML_PAGE, {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    // API 路由 — /v1/chat/completions
    if (url.pathname === "/v1/chat/completions" && request.method === "POST") {
      try {
        const body = await request.json();
        let hasImage = false;
        let imageContent = null;
        let originalTextPrompt = "";

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

        // 有图片：先调千问看图
        if (hasImage) {
          console.log("检测到图片！正在调用通义千问进行视觉分析...");

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
                  { type: "text", text: "请扮演视觉大师极其详细地描述这张图片里的一切细节、所有的文字、代码或报错信息，不要遗漏蛛丝马迹。" },
                  imageContent
                ]
              }]
            })
          });

          const qwenData = await qwenResponse.json();
          const qwenReport = qwenData.choices[0].message.content;
          console.log("千问报告生成完毕。");

          const modifiedMessages = body.messages.map((msg, index) => {
            if (index === body.messages.length - 1) {
              return {
                role: "user",
                content: `【自动化系统提示：以下是通义千问为你详细解析的用户上传图片内容】\n${qwenReport}\n\n【用户原话】：${originalTextPrompt}`
              };
            }
            return msg;
          });
          body.messages = modifiedMessages;
        }

        // 统一交 DeepSeek 回答
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

    // 其他请求：转发 DeepSeek 官方
    const fetchUrl = `https://api.deepseek.com${url.pathname}${url.search}`;
    const newRequest = new Request(fetchUrl, request);
    return fetch(newRequest);
  }
};