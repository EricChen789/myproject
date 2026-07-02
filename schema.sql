-- myproject D1 数据库表结构
CREATE TABLE IF NOT EXISTS usage_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  type TEXT NOT NULL,           -- 'chat', 'vision', 'api'
  model TEXT,                    -- 使用的模型
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  ip TEXT,
  user_agent TEXT
);

CREATE TABLE IF NOT EXISTS workflow_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  enabled INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 预置工作流数据
INSERT OR IGNORE INTO workflow_configs (name, display_name, description, category) VALUES
  ('deepseek-qa', '🤖 DeepSeek 问答', 'DeepSeek 主控，自动调千问看图', 'ai'),
  ('audio-translate', '🎤 语音转书面语', '粤语语音 → 繁体书面语', 'voice'),
  ('audio-full', '🎤 语音完整处理', '转写 → 书面语 → 英译 → 朗读', 'voice'),
  ('clipboard-ocr', '📸 截图识别', '剪贴板捕获 + 千问识别', 'vision'),
  ('wuzapi-tunnel', '💬 WUZAPI 隧道', '启动 WhatsApp 网关 + 公网', 'service'),
  ('deploy-worker', '🚀 部署 Worker', '更新 Cloudflare Worker', 'service'),
  ('service-info', '📡 服务地址', '查看所有服务 URL', 'system');
