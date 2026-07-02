import sys
import io
import os
import base64
import json
from openai import OpenAI
from dashscope import MultiModalConversation
import dashscope
from PIL import ImageGrab

# 强制设置 stdout 为 UTF-8，解决 Windows GBK 终端乱码问题
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# 配置 API 密钥（优先从环境变量读取，避免硬编码泄露）
QWEN_API_KEY = os.environ.get("QWEN_API_KEY")
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY")
DEEPSEEK_BASE_URL = "https://api.deepseek.com"

if not QWEN_API_KEY:
    print("❌ 请设置环境变量 QWEN_API_KEY")
    sys.exit(1)
if not DEEPSEEK_API_KEY:
    print("❌ 请设置环境变量 DEEPSEEK_API_KEY")
    sys.exit(1)

dashscope.api_key = QWEN_API_KEY
ds_client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)
qwen_client = OpenAI(api_key=QWEN_API_KEY, base_url="https://dashscope.aliyuncs.com/compatible-mode/v1")

VALID_IMAGE_EXTS = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg",
                    "webp": "image/webp", "gif": "image/gif", "bmp": "image/bmp"}


# ==================== 语音处理（按需调用） ====================

def process_whatsapp_audio(audio_path):
    """用千问识别粤语语音 -> DeepSeek 转为书面语"""

    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"音频文件不存在: {audio_path}")

    print("🔊 [1/2] 正在派遣【通义千问】听取 WhatsApp 语音...")

    try:
        response = MultiModalConversation.call(
            model="qwen-audio-turbo-latest",
            messages=[{
                "role": "user",
                "content": [
                    {"text": "请一字不漏地将这段粤语语音转换为文本（保留原汁原味的粤语口语字，如 咩、唔、係）。"},
                    {"audio": f"file://{audio_path}"}
                ]
            }]
        )
        cantonese_cant = response.output.choices[0].message.content[0]["text"]
        qwen_usage = response.usage
        qwen_total = qwen_usage.input_tokens + qwen_usage.output_tokens

        print(f"✅ 千问听到的原话（粤语口语）：{cantonese_cant}")
        print(f"📊 [千问 Token] input={qwen_usage.input_tokens}, output={qwen_usage.output_tokens}, total={qwen_total}")

    except Exception as e:
        print(f"❌ 千问语音识别失败: {e}")
        raise

    print("\n🤖 [2/2] 正在派遣【DeepSeek】将口语转换为标准书面语...")

    try:
        completion_ds = ds_client.chat.completions.create(
            model="deepseek-v4-pro",
            messages=[
                {"role": "system", "content": "你是一个精通粤语的书面语转换专家。请将输入的粤语口语（白话）转换为流畅、标准的中文书面语（如将'佢寻日同我讲咩'转换为'他昨天跟我说了什么'）。不要输出任何多余的解释，直接给出书面语结果。"},
                {"role": "user", "content": cantonese_cant}
            ]
        )
        final_text = completion_ds.choices[0].message.content
        ds_usage = completion_ds.usage

        print(f"\n{'='*50}")
        print(f"🎤 粤语原文（千问听到的）：{cantonese_cant}")
        print(f"📝 书面语（DeepSeek 翻译）：{final_text}")
        print(f"{'='*50}")
        print(f"\n📊 [DeepSeek Token] input={ds_usage.prompt_tokens}, output={ds_usage.completion_tokens}, total={ds_usage.total_tokens}")
        print(f"💰 === 总计 Token: {qwen_total + ds_usage.total_tokens} ===")
        return final_text

    except Exception as e:
        print(f"❌ DeepSeek 翻译失败: {e}")
        raise


# ==================== 图片识别（识别剪贴板图片后自动调用） ====================

def recognize_image(image_path):
    """用千问视觉模型识别图片内容"""

    if not os.path.exists(image_path):
        print(f"❌ 图片不存在: {image_path}")
        return None

    try:
        with open(image_path, "rb") as f:
            b64_data = base64.b64encode(f.read()).decode("utf-8")
    except Exception as e:
        print(f"❌ 读取图片失败: {e}")
        return None

    ext = os.path.splitext(image_path)[1].lower().lstrip(".")
    mime_type = VALID_IMAGE_EXTS.get(ext, "image/jpeg")

    print(f"🔍 正在派遣【通义千问】识别图片: {os.path.basename(image_path)} ...")

    try:
        response = qwen_client.chat.completions.create(
            model="qwen-vl-max",
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": "请详细描述这张图片的内容，包括所有文字、界面元素、颜色、布局等细节，不要遗漏任何信息。"},
                    {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{b64_data}"}}
                ]
            }]
        )
        description = response.choices[0].message.content
        qwen_usage = response.usage

        print(f"✅ 千问识别结果：\n{description}")
        print(f"\n📊 [千问视觉 Token] input={qwen_usage.prompt_tokens}, output={qwen_usage.completion_tokens}, "
              f"total={qwen_usage.total_tokens}")
        return description

    except Exception as e:
        print(f"❌ 千问图片识别失败: {e}")
        return None


# ==================== 剪贴板捕获 ====================

def capture_clipboard_image(save_dir="D:/myproject/captures", filename="copied_image.png"):
    """从剪贴板捕获图片并保存，有图片则自动识别"""
    try:
        img = ImageGrab.grabclipboard()
    except Exception as e:
        print(f"❌ 访问剪贴板失败: {e}")
        return None

    if img is None:
        print("⚠️ 剪贴板里没有图片，请先去复制一张。")
        return None

    if isinstance(img, list):
        if len(img) == 0:
            print("⚠️ 剪贴板里没有图片，请先去复制一张。")
            return None
        print(f"📋 检测到剪贴板中有 {len(img)} 张图片，保存第一张。")
        img = img[0]

    os.makedirs(save_dir, exist_ok=True)
    save_path = os.path.join(save_dir, filename)

    try:
        img.save(save_path)
        print(f"✅ 成功从剪贴板捕获图片: {save_path}")
    except Exception as e:
        print(f"❌ 图片保存失败: {e}")
        return None

    # 自动识别图片内容
    print()
    recognize_image(save_path)

    return save_path


# ==================== 入口 ====================

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="WhatsApp 语音转书面语 | 剪贴板捕获+识别")
    parser.add_argument("--clipboard", "-c", action="store_true",
                        help="捕获剪贴板图片并自动识别")
    parser.add_argument("--audio", "-a", nargs="*",
                        help="AI 识别+翻译语音：不接参数自动选最新文件；也可指定路径")
    parser.add_argument("--output", "-o", default="copied_image.png",
                        help="剪贴板图片保存文件名")
    args = parser.parse_args()

    if args.audio is not None:
        # 自动选最新文件 or 用指定路径
        if len(args.audio) == 0:
            mp3_dir = r"D:\myproject\mp3"
            files = [f for f in os.listdir(mp3_dir) if f.lower().endswith(('.ogg', '.mp3', '.wav', '.m4a'))]
            if not files:
                print(f"❌ {mp3_dir} 中没有找到音频文件")
                sys.exit(1)
            # 按修改时间排序，取最新
            files.sort(key=lambda f: os.path.getmtime(os.path.join(mp3_dir, f)), reverse=True)
            audio_path = os.path.join(mp3_dir, files[0])
            print(f"📂 自动选择最新文件: {files[0]}")
        else:
            audio_path = args.audio[0]

        process_whatsapp_audio(audio_path)

    if args.clipboard:
        if args.audio is not None:
            print()
        capture_clipboard_image(filename=args.output)

    if args.audio is None and not args.clipboard:
        parser.print_help()
