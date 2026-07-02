#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
myproject 通用工作流引擎 — 读取 workflows.yaml，按配置执行步骤
用法:
  python run.py                交互菜单
  python run.py <流程名>        直接执行
  python run.py --list          列出所有流程
"""

import sys
import io
import os
import re
import time
import json
import base64
import subprocess
import webbrowser
import yaml
from typing import Any

# ===== 强制 UTF-8 =====
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# ===== OpenAI SDK 客户端（懒加载）=====
_deepseek_client = None
_qwen_client = None

def get_ds_client():
    global _deepseek_client
    if _deepseek_client is None:
        from openai import OpenAI
        _deepseek_client = OpenAI(
            api_key=os.environ["DEEPSEEK_API_KEY"],
            base_url="https://api.deepseek.com"
        )
    return _deepseek_client

def get_qwen_client():
    global _qwen_client
    if _qwen_client is None:
        from openai import OpenAI
        _qwen_client = OpenAI(
            api_key=os.environ["QWEN_API_KEY"],
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1"
        )
    return _qwen_client

# ===== 配置 =====
PROJECT_DIR = r"D:\myproject"
WORKFLOWS_FILE = os.path.join(PROJECT_DIR, "workflows.yaml")

VALID_IMAGE_EXTS = {
    "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg",
    "webp": "image/webp", "gif": "image/gif", "bmp": "image/bmp"
}


# ==================== 模板引擎 ====================

def render(template: str, ctx: dict) -> str:
    """替换 {{var}} 和 {{args.x}} 和 {{steps.name.output}}（简化：直接用 ctx 的 key）"""
    def replace(match):
        key = match.group(1).strip()
        # 支持点号路径：args.xxx, steps.xxx.output
        parts = key.split(".")
        val = ctx
        for p in parts:
            if isinstance(val, dict) and p in val:
                val = val[p]
            else:
                return f"{{{{{key}}}}}"
        return str(val) if val is not None else ""
    return re.sub(r"\{\{(.+?)\}\}", replace, template)


# ==================== 动作处理器 ====================

def action_deepseek_chat(step: dict, ctx: dict) -> str:
    """简单 DeepSeek 对话"""
    client = get_ds_client()
    model = step.get("model", "deepseek-v4-pro")
    messages = []
    if step.get("system"):
        messages.append({"role": "system", "content": render(step["system"], ctx)})
    messages.append({"role": "user", "content": render(step["prompt"], ctx)})

    print(f"🤖 DeepSeek 思考中...")
    resp = client.chat.completions.create(model=model, messages=messages)
    content = resp.choices[0].message.content
    usage = resp.usage
    print(f"📊 [DeepSeek] input={usage.prompt_tokens}, output={usage.completion_tokens}, total={usage.total_tokens}")

    # 累计 token
    ctx["_total_tokens"] = ctx.get("_total_tokens", 0) + usage.total_tokens
    return content


def action_qwen_vision(step: dict, ctx: dict) -> str:
    """千问视觉识别图片"""
    client = get_qwen_client()
    image_path = render(step["image"], ctx)

    if not os.path.exists(image_path):
        return f"错误：找不到图片 {image_path}"

    with open(image_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")

    ext = os.path.splitext(image_path)[1].lower().lstrip(".")
    mime = VALID_IMAGE_EXTS.get(ext, "image/jpeg")
    prompt = render(step.get("prompt", "请详细描述这张图片"), ctx)

    print(f"📸 千问正在识别图片: {os.path.basename(image_path)} ...")
    resp = client.chat.completions.create(
        model="qwen-vl-max",
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}}
            ]
        }]
    )
    content = resp.choices[0].message.content
    usage = resp.usage
    print(f"📊 [千问视觉] input={usage.prompt_tokens}, output={usage.completion_tokens}, total={usage.total_tokens}")
    ctx["_total_tokens"] = ctx.get("_total_tokens", 0) + usage.total_tokens
    return content


def action_qwen_audio(step: dict, ctx: dict) -> str:
    """千问语音识别（dashscope MultiModalConversation）"""
    import dashscope
    from dashscope import MultiModalConversation

    dashscope.api_key = os.environ.get("QWEN_API_KEY")
    audio_path = render(step["audio"], ctx)

    if not os.path.exists(audio_path):
        return f"错误：找不到音频 {audio_path}"

    prompt = render(step.get("prompt", "请将这段语音转换为文本"), ctx)
    print(f"🔊 千问正在听取语音: {os.path.basename(audio_path)} ...")

    resp = MultiModalConversation.call(
        model="qwen-audio-turbo-latest",
        messages=[{
            "role": "user",
            "content": [
                {"text": prompt},
                {"audio": f"file://{audio_path}"}
            ]
        }]
    )
    text = resp.output.choices[0].message.content[0]["text"]
    usage = resp.usage
    total = usage.input_tokens + usage.output_tokens
    print(f"✅ 千问听到：{text}")
    print(f"📊 [千问语音] input={usage.input_tokens}, output={usage.output_tokens}, total={total}")
    ctx["_total_tokens"] = ctx.get("_total_tokens", 0) + total
    return text


def action_deepseek_agent(step: dict, ctx: dict) -> str:
    """DeepSeek 主控 + function calling 循环"""
    client = get_ds_client()
    model = step.get("model", "deepseek-v4-pro")
    tools_def = step.get("tools", [])

    # 构建 OpenAI function calling 格式
    tools = []
    tool_map = {}  # name → tool config
    for t in tools_def:
        props = {}
        for pname, pinfo in t.get("params", {}).items():
            props[pname] = {"type": pinfo.get("type", "string"), "description": pinfo.get("description", "")}
        tools.append({
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t.get("description", ""),
                "parameters": {
                    "type": "object",
                    "properties": props,
                    "required": list(props.keys())
                }
            }
        })
        tool_map[t["name"]] = t

    messages = []
    if step.get("system"):
        messages.append({"role": "system", "content": render(step["system"], ctx)})
    messages.append({"role": "user", "content": render(step["prompt"], ctx)})

    print("🤖 DeepSeek（主大脑）正在思考...")

    # 第一轮
    resp = client.chat.completions.create(model=model, messages=messages, tools=tools)
    ctx["_total_tokens"] = ctx.get("_total_tokens", 0) + resp.usage.total_tokens
    msg = resp.choices[0].message

    # 如果调用了工具
    if msg.tool_calls:
        for tc in msg.tool_calls:
            tool_cfg = tool_map.get(tc.function.name)
            if not tool_cfg:
                result = f"未知工具: {tc.function.name}"
            else:
                # 解析参数
                args = json.loads(tc.function.arguments)
                # 执行工具对应的 action
                tool_action = dict(tool_cfg)  # 复制
                # 把参数注入到 step 里
                for k, v in args.items():
                    tool_action["image"] = v  # qwen_vision 用 image 参数
                tool_action["prompt"] = tool_cfg.get("prompt", "请详细描述")
                result = dispatch(tool_action, ctx)

            messages.append(msg)
            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "name": tc.function.name,
                "content": result
            })

        # 第二轮：结合工具结果
        print("\n🧠 DeepSeek 正在结合千问报告进行最终思考...")
        resp2 = client.chat.completions.create(model=model, messages=messages)
        ctx["_total_tokens"] = ctx.get("_total_tokens", 0) + resp2.usage.total_tokens
        final = resp2.choices[0].message.content
        print(f"\n💡 [DeepSeek 最终结论]：\n{final}")
        return final
    else:
        content = msg.content
        print(f"\n💡 [DeepSeek 直接回答]：\n{content}")
        return content


def action_select_file(step: dict, ctx: dict) -> str:
    """选择文件：自动选最新或按模式匹配"""
    directory = render(step.get("dir", "."), ctx)
    pattern_str = step.get("pattern", "*")
    latest = step.get("latest", False)
    message = step.get("message", "")

    patterns = [p.strip() for p in pattern_str.split(",")]

    # 收集匹配的文件
    files = []
    for f in os.listdir(directory):
        full = os.path.join(directory, f)
        if not os.path.isfile(full):
            continue
        for pat in patterns:
            # 简单 glob：*.ogg → 检查后缀
            if pat.startswith("*."):
                ext = pat[1:]  # .ogg
                if f.lower().endswith(ext.lower()):
                    files.append(full)
                    break
            elif f == pat:
                files.append(full)
                break

    if not files:
        raise FileNotFoundError(f"在 {directory} 中没有匹配 {pattern_str} 的文件")

    if latest:
        files.sort(key=lambda x: os.path.getmtime(x), reverse=True)

    chosen = files[0]
    if message:
        print(f"{message}: {os.path.basename(chosen)}")
    return chosen


def action_capture_clipboard(step: dict, ctx: dict) -> str:
    """捕获剪贴板图片"""
    from PIL import ImageGrab

    save_dir = render(step.get("save_dir", "D:/myproject/captures"), ctx)
    filename = step.get("filename", "copied_image.png")

    img = ImageGrab.grabclipboard()
    if img is None:
        raise RuntimeError("⚠️ 剪贴板里没有图片，请先复制一张。")

    if isinstance(img, list):
        if len(img) == 0:
            raise RuntimeError("⚠️ 剪贴板里没有图片。")
        print(f"📋 检测到 {len(img)} 张图片，保存第一张。")
        img = img[0]

    os.makedirs(save_dir, exist_ok=True)
    save_path = os.path.join(save_dir, filename)
    img.save(save_path)
    print(f"✅ 已捕获剪贴板图片: {save_path}")
    return save_path


def action_shell(step: dict, ctx: dict) -> Any:
    """执行 shell 命令，可选后台运行"""
    command = render(step["command"], ctx)
    cwd = render(step.get("cwd", PROJECT_DIR), ctx)
    background = step.get("background", False)

    print(f"⚡ 执行: {command}")

    if background:
        proc = subprocess.Popen(command, shell=True, cwd=cwd)
        print(f"   (后台运行, PID={proc.pid})")
        return proc  # 返回 Popen 对象，可用于 terminate
    else:
        result = subprocess.run(command, shell=True, cwd=cwd, capture_output=False)
        return result.returncode


def action_print(step: dict, ctx: dict) -> str:
    """打印模板内容"""
    text = render(step["template"], ctx)
    print(text)
    return text


def action_open_url(step: dict, ctx: dict) -> str:
    """打开 URL"""
    url = render(step["url"], ctx)
    webbrowser.open(url)
    print(f"🌐 已打开 {url}")
    return url


def action_sleep(step: dict, ctx: dict) -> None:
    """等待"""
    seconds = step.get("seconds", 1)
    time.sleep(seconds)


def action_wait_enter(step: dict, ctx: dict) -> str:
    """等待用户按 Enter"""
    input()
    return ""


def action_tts_speak(step: dict, ctx: dict) -> str:
    """edge-tts 语音朗读"""
    import asyncio
    import tempfile
    import edge_tts

    text = render(step["text"], ctx)
    voice = step.get("voice", "en-US-JennyNeural")
    rate = step.get("rate", "+0%")

    print(f"🔊 正在合成语音 ({voice})...")

    async def speak():
        temp_path = os.path.join(tempfile.gettempdir(), "myproject_tts.mp3")
        comm = edge_tts.Communicate(text, voice, rate=rate)
        await comm.save(temp_path)
        return temp_path

    mp3_path = asyncio.run(speak())
    print(f"▶️  正在朗读...")
    os.startfile(mp3_path)  # Windows: 用默认播放器打开
    return text


def action_terminate(step: dict, ctx: dict) -> None:
    """终止后台进程"""
    proc_ref = step.get("process")
    if proc_ref is None:
        return
    # 支持 {{var}} 模板
    if isinstance(proc_ref, str):
        proc_ref = render(proc_ref, ctx)
        # 从 ctx 中取
        key = step["process"].strip("{} ")
        proc = ctx.get(key)
    else:
        proc = proc_ref

    if proc and hasattr(proc, "terminate"):
        proc.terminate()
        print(f"🛑 已终止进程")


# ==================== 动作分发 ====================

ACTION_MAP = {
    "deepseek_chat": action_deepseek_chat,
    "deepseek_agent": action_deepseek_agent,
    "qwen_vision": action_qwen_vision,
    "qwen_audio": action_qwen_audio,
    "select_file": action_select_file,
    "capture_clipboard": action_capture_clipboard,
    "shell": action_shell,
    "print": action_print,
    "open_url": action_open_url,
    "sleep": action_sleep,
    "wait_enter": action_wait_enter,
    "terminate": action_terminate,
    "tts_speak": action_tts_speak,
}


def dispatch(step: dict, ctx: dict) -> Any:
    """执行单个步骤"""
    action = step["action"]
    handler = ACTION_MAP.get(action)
    if handler is None:
        raise ValueError(f"未知 action 类型: {action}。支持: {list(ACTION_MAP.keys())}")
    return handler(step, ctx)


# ==================== 工作流执行 ====================

def run_workflow(name: str, wf: dict, args: dict | None = None):
    """执行一个工作流"""
    steps = wf.get("steps", [])
    if not steps:
        print("⚠️ 该工作流没有步骤")
        return

    # 上下文初始化
    ctx: dict[str, Any] = {"_total_tokens": 0}
    if args:
        # 合并到 ctx.args
        ctx["args"] = {}
        for arg_def in wf.get("args", []):
            arg_name = arg_def["name"]
            ctx["args"][arg_name] = args.get(arg_name, "")

    ctx["prev_output"] = ""

    for i, step in enumerate(steps):
        action = step.get("action", "?")
        output_as = step.get("output_as")

        try:
            result = dispatch(step, ctx)
        except Exception as e:
            print(f"❌ 步骤 [{action}] 执行失败: {e}")
            import traceback
            traceback.print_exc()
            return

        # 保存结果
        ctx["prev_output"] = result
        if output_as:
            ctx[output_as] = result

    # 打印总 token
    total = ctx.get("_total_tokens", 0)
    if total:
        print(f"\n💰 === 总计 Token: {total} ===")


# ==================== 交互菜单 ====================

def show_menu(workflows: dict):
    """显示交互菜单"""
    wf_list = list(workflows.items())

    menu_text = """
╔══════════════════════════════════════════════╗
║        🧠 myproject 功能菜单（YAML 驱动）      ║
╠══════════════════════════════════════════════╣"""
    for i, (key, wf) in enumerate(wf_list, 1):
        name = wf.get("name", key)
        menu_text += f"\n║  [{i}] {name}"
        # 填充空格对齐
        padding = 42 - len(name) - 4  # 4 = " [i] "
        menu_text += " " * max(0, padding) + "║"

    menu_text += """
║  [0] ❌ 退出                                   ║
╚══════════════════════════════════════════════╝"""

    while True:
        print(menu_text)
        choice = input("👉 输入数字: ").strip()

        if choice == "0":
            print("👋 再见！")
            break

        try:
            idx = int(choice) - 1
            if 0 <= idx < len(wf_list):
                key, wf = wf_list[idx]
                name = wf.get("name", key)
                print(f"\n{'='*40}")
                print(f"  {name}")
                print(f"{'='*40}\n")

                # 收集参数
                wf_args = {}
                for arg_def in wf.get("args", []):
                    prompt_text = arg_def.get("prompt", f"输入 {arg_def['name']}: ")
                    wf_args[arg_def["name"]] = input(prompt_text).strip()
                    if not wf_args[arg_def["name"]]:
                        print("未输入内容，取消。")
                        break
                else:
                    run_workflow(key, wf, wf_args)
                print()
            else:
                print("❌ 无效选项\n")
        except ValueError:
            print("❌ 请输入数字\n")


# ==================== 入口 ====================

def main():
    # 加载 YAML
    if not os.path.exists(WORKFLOWS_FILE):
        print(f"❌ 找不到 {WORKFLOWS_FILE}")
        sys.exit(1)

    with open(WORKFLOWS_FILE, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)

    workflows = config.get("workflows", {})

    # 命令行参数
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        if arg == "--list":
            for key, wf in workflows.items():
                print(f"  {key:25s} {wf.get('name', '')}")
            return
        if arg in workflows:
            # 直接执行工作流
            wf_args = {}
            wf = workflows[arg]
            for arg_def in wf.get("args", []):
                prompt_text = arg_def.get("prompt", f"输入 {arg_def['name']}: ")
                val = input(prompt_text).strip()
                if not val:
                    print("未输入，取消。")
                    return
                wf_args[arg_def["name"]] = val
            run_workflow(arg, wf, wf_args)
            return
        else:
            print(f"❌ 未知工作流: {arg}")
            print(f"   可用: {list(workflows.keys())}")
            sys.exit(1)

    # 默认：交互菜单
    show_menu(workflows)


if __name__ == "__main__":
    main()
