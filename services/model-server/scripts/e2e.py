"""端到端链路验证脚本：生成验证码图 → api-server /api/solve → model-server ddddocr → 答案。

用法：
  python scripts/e2e.py
前置：model-server 已在 8000 运行，api-server 已在 8080 运行。
"""

import base64
import io
import random
import urllib.request

from PIL import Image, ImageDraw, ImageFont

API = "http://127.0.0.1:8080/api/solve"
TOKEN = "demo-token"


def make_captcha(text: str = "4821") -> bytes:
    img = Image.new("RGB", (120, 40), "white")
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("arial.ttf", 24)
    except OSError:
        font = ImageFont.load_default()
    for _ in range(3):
        draw.line(
            [(random.randint(0, 40), random.randint(0, 40)), (random.randint(80, 120), random.randint(0, 40))],
            fill="gray", width=1,
        )
    for i, ch in enumerate(text):
        draw.text((10 + i * 24, 8), ch, font=font, fill="black")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def solve(payload: dict) -> dict:
    data = json.dumps(payload).encode()
    req = urllib.request.Request(API, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


if __name__ == "__main__":
    import json

    print("=== 全链路验证：数英 OCR (type=1001) ===")
    img = make_captcha("4821")
    res = solve({"token": TOKEN, "type": "1001", "image": base64.b64encode(img).decode()})
    print(json.dumps(res, ensure_ascii=False, indent=2))
    assert res["code"] == 10000, f"OCR 链路失败: {res}"
    print(f"[OK] OCR 识别结果: {res['data']['data']} (provider={res['data']['provider']}, 耗时 {res['data']['time']}ms)")

    print("\n=== 全链路验证：未知类型 (type=9999) ===")
    res = solve({"token": TOKEN, "type": "9999", "image": "x"})
    print(json.dumps(res, ensure_ascii=False))
    assert res["code"] == 10004

    print("\n[OK] 全链路验证通过")
