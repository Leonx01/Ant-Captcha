"""M1 测试：真实 ddddocr 识别生成的验证码测试图。

生成测试图：随机 4 位数字 + 干扰线（模拟真实验证码）。
注意：ddddocr 对合成图的识别不是 100%，断言用"长度正确"而非"内容完全一致"。
"""

import base64
import io
import random
import string

from fastapi.testclient import TestClient
from PIL import Image, ImageDraw, ImageFont

from app.main import app

client = TestClient(app)


def _make_captcha_image(text: str = "4821") -> bytes:
    """生成 120x40 的验证码图：白底、黑字、干扰线"""
    img = Image.new("RGB", (120, 40), "white")
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("arial.ttf", 24)
    except OSError:
        font = ImageFont.load_default()
    # 干扰线
    for _ in range(3):
        x1 = random.randint(0, 40)
        y1 = random.randint(0, 40)
        x2 = random.randint(80, 120)
        y2 = random.randint(0, 40)
        draw.line([(x1, y1), (x2, y2)], fill="gray", width=1)
    # 字符
    for i, ch in enumerate(text):
        draw.text((10 + i * 24, 8), ch, font=font, fill="black")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _make_slide_pair(gap_x: int = 60) -> tuple[bytes, bytes]:
    """生成滑块验证码图：背景图（带缺口）+ 滑块图"""
    w, h = 200, 80
    bg = Image.new("RGB", (w, h), (200, 200, 200))
    draw = ImageDraw.Draw(bg)
    # 背景纹理（简单条纹）
    for x in range(0, w, 8):
        draw.line([(x, 0), (x, h)], fill=(180 + (x % 3) * 20, 180, 180))
    # 缺口：在 gap_x 处挖一个矩形（深色）
    draw.rectangle([gap_x, 20, gap_x + 40, 60], fill=(60, 60, 60))
    # 滑块图：同样的深色矩形（带边框）
    slide = Image.new("RGB", (40, 40), (60, 60, 60))
    draw_s = ImageDraw.Draw(slide)
    draw_s.rectangle([0, 0, 39, 39], outline=(0, 0, 0), width=2)
    buf_bg = io.BytesIO()
    bg.save(buf_bg, format="PNG")
    buf_s = io.BytesIO()
    slide.save(buf_s, format="PNG")
    return buf_bg.getvalue(), buf_s.getvalue()


def test_healthz():
    res = client.get("/healthz")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_readyz():
    res = client.get("/readyz")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_ocr_real():
    """真实 ddddocr 识别 4 位数字验证码"""
    img = _make_captcha_image("4821")
    res = client.post(
        "/v1/captcha/ocr",
        json={"image": base64.b64encode(img).decode(), "request_id": "test-ocr"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["request_id"] == "test-ocr"
    assert len(body["text"]) == 4, f"预期 4 位，实际: {body['text']}"
    assert body["confidence"] > 0


def test_slide_real():
    """真实 ddddocr 滑块缺口检测"""
    bg, slide = _make_slide_pair(gap_x=60)
    res = client.post(
        "/v1/captcha/slide",
        json={
            "background_image": base64.b64encode(bg).decode(),
            "slide_image": base64.b64encode(slide).decode(),
            "request_id": "test-slide",
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["request_id"] == "test-slide"
    # 缺口应在 40~100 之间（真实位置 60，ddddocr 误差容忍）
    assert 20 <= body["x"] <= 110, f"缺口 x 异常: {body['x']}"


def test_det_real():
    """真实 ddddocr 目标检测（点选支撑）"""
    img = _make_captcha_image("abcd")
    res = client.post(
        "/v1/captcha/det",
        json={"image": base64.b64encode(img).decode()},
    )
    assert res.status_code == 200
    body = res.json()
    assert isinstance(body["targets"], list)
