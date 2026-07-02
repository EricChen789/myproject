#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
myproject 功能菜单 — 调用 run.py 引擎执行 workflows.yaml 中的工作流
用法: python menu.py
"""
import sys
import io
import os
import subprocess

# 强制 UTF-8
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

PROJECT = r"D:\myproject"

MENU = """
╔══════════════════════════════════════════════╗
║        🧠 myproject 功能菜单                  ║
╠══════════════════════════════════════════════╣
║  [1] 🤖 DeepSeek 主控问答                     ║
║  [2] 📸 剪贴板截图识别（千问）                 ║
║  [3] 🎤 语音识别转书面语                       ║
║  [4] 💬 启动 WUZAPI + 公网隧道                ║
║  [5] 🚀 部署 Cloudflare Worker                ║
║  [6] 🌐 打开 Worker 网页                      ║
║  [7] 📱 打开 WUZAPI 管理界面                  ║
║  [8] 📡 查看所有服务地址                       ║
║  [9] 🎤 语音完整处理(转写→书面→英译→朗读)      ║
║  [0] ❌ 退出                                   ║
╚══════════════════════════════════════════════╝
"""

# 菜单选项 → run.py 工作流名
ACTIONS = {
    "1": "deepseek-qa",
    "2": "clipboard-ocr",
    "3": "audio-translate",
    "4": "wuzapi-tunnel",
    "5": "deploy-worker",
    "6": "open-worker",
    "7": "open-wuzapi",
    "8": "service-info",
    "9": "audio-full",
}


def main():
    # 确保环境变量可用
    env = os.environ.copy()

    while True:
        print(MENU)
        choice = input("👉 输入数字: ").strip()
        if choice == "0":
            print("👋 再见！")
            break
        if choice in ACTIONS:
            wf_name = ACTIONS[choice]
            print(f"\n{'='*40}")
            print(f"  执行: {wf_name}")
            print(f"{'='*40}\n")
            subprocess.run(
                ["python", "run.py", wf_name],
                cwd=PROJECT,
                env=env
            )
            print()
        else:
            print("❌ 无效选项\n")


if __name__ == "__main__":
    main()
