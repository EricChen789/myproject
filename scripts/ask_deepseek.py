import sys
import io
import os
import json
import base64
from openai import OpenAI

# 强制 UTF-8，解决 Windows GBK 乱码
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# 1. 配置（从环境变量读取，与 audio_tool.py 共用密钥）
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY")
DEEPSEEK_BASE_URL = "https://api.deepseek.com"
QWEN_API_KEY = os.environ.get("QWEN_API_KEY")

if not DEEPSEEK_API_KEY:
    print("❌ 请设置环境变量 DEEPSEEK_API_KEY")
    sys.exit(1)
if not QWEN_API_KEY:
    print("❌ 请设置环境变量 QWEN_API_KEY")
    sys.exit(1)

ds_client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)
qwen_client = OpenAI(api_key=QWEN_API_KEY, base_url="https://dashscope.aliyuncs.com/compatible-mode/v1")

# 千问支持的图片 MIME 类型
VALID_IMAGE_EXTS = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg",
                    "webp": "image/webp", "gif": "image/gif", "bmp": "image/bmp"}


def qwen_analyze_image(image_path):
    """让千问以最详细的视角看图，返回描述文本"""
    print(f"\n📸 [Agent 自动化中] DeepSeek 看不懂图，已派【通义千问】扫描图片: {image_path}...")

    if not os.path.exists(image_path):
        return f"错误：找不到图片文件 {image_path}"

    try:
        with open(image_path, "rb") as f:
            base64_image = base64.b64encode(f.read()).decode("utf-8")
    except Exception as e:
        return f"错误：读取图片文件失败 — {e}"

    ext = os.path.splitext(image_path)[1].lower().lstrip(".")
    mime_type = VALID_IMAGE_EXTS.get(ext, "image/jpeg")

    try:
        response = qwen_client.chat.completions.create(
            model="qwen-vl-max",
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": "请扮演一个视觉大师，仔细观察这张图片，并告诉我们你看到的所有东西。要求：尽可能详细地描述，包括但不限于所有的文字（特别是代码、报错信息）、界面布局、颜色、甚至各种微小的细节，不要漏掉任何蛛丝马迹。"},
                    {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{base64_image}"}}
                ]
            }]
        )
        description = response.choices[0].message.content
        qwen_usage = response.usage
        print(f"🎯 千问返回了详细图片描述！(input={qwen_usage.prompt_tokens}, output={qwen_usage.completion_tokens})")
        return description
    except Exception as e:
        return f"调用千问视觉模型失败：{e}"


def ask_agent(user_prompt):
    """DeepSeek 主控：自动判断是否需要调千问看图"""

    tools = [{
        "type": "function",
        "function": {
            "name": "qwen_analyze_image",
            "description": "当用户提到图片、截图、或者需要分析某个图片文件时，调用此函数让通义千问帮你极其详细地识别图片内容。",
            "parameters": {
                "type": "object",
                "properties": {
                    "image_path": {"type": "string", "description": "图片的本地路径，例如 image.png"}
                },
                "required": ["image_path"]
            }
        }
    }]

    messages = [
        {"role": "system", "content": "你是一个全能的AI助手（由 DeepSeek 驱动）。你可以使用工具调动通义千问来帮你'看图'。如果用户给出了图片路径或者提到了看图，请务必调用 qwen_analyze_image 工具，拿到千问的详细描述后，再结合你的强大逻辑回答用户。"},
        {"role": "user", "content": user_prompt}
    ]

    print("🤖 DeepSeek（主大脑）正在思考...")
    total_tokens = 0

    # 第一阶段：问 DeepSeek
    response = ds_client.chat.completions.create(
        model="deepseek-v4-pro",  # 修复: 使用正确的模型名
        messages=messages,
        tools=tools
    )
    total_tokens += response.usage.total_tokens

    message = response.choices[0].message

    if message.tool_calls:
        # 修复: 支持多次 tool call（遍历所有）
        for tool_call in message.tool_calls:
            args = json.loads(tool_call.function.arguments)
            qwen_result = qwen_analyze_image(args["image_path"])

            messages.append(message)
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "name": "qwen_analyze_image",
                "content": qwen_result
            })

        # 第二阶段：DeepSeek 结合千问报告做最终回答
        print("\n🧠 DeepSeek 正在结合千问的详细视觉报告进行最终深度思考...")
        final_response = ds_client.chat.completions.create(
            model="deepseek-v4-pro",
            messages=messages
        )
        total_tokens += final_response.usage.total_tokens
        print(f"\n💡 [DeepSeek 最终结论]：\n{final_response.choices[0].message.content}")
    else:
        print(f"\n💡 [DeepSeek 直接回答]：\n{message.content}")

    print(f"\n📊 [Token 统计] 总计: {total_tokens} (DeepSeek)")
    return total_tokens


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="DeepSeek 主控 + 千问视觉 Agent")
    parser.add_argument("prompt", nargs="?", default=None,
                        help="你的问题（提及图片路径可触发千问看图）")
    parser.add_argument("--image", "-i", default=None,
                        help="快捷方式：指定图片路径，自动生成 prompt")
    args = parser.parse_args()

    if args.image:
        prompt = f"帮我看看这个图片 {args.image} 里面有什么内容？详细描述一下。"
    elif args.prompt:
        prompt = args.prompt
    else:
        # 默认交互模式
        prompt = input("请输入你的问题（提及图片路径触发看图）: ").strip()
        if not prompt:
            print("未输入任何内容，退出。")
            sys.exit(0)

    ask_agent(prompt)
