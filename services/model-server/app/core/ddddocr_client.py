"""ddddocr 封装：单例 + 并发控制。

ddddocr 不是线程安全的：DdddOcr 实例必须在单一线程中使用，
因此这里用全局锁串行化推理（自用规模足够；吞吐不足时再上池）。
"""

import base64
import threading

import ddddocr

_lock = threading.Lock()
_ocr: ddddocr.DdddOcr | None = None
_det: ddddocr.DdddOcr | None = None
_slide: ddddocr.DdddOcr | None = None


def _get_ocr() -> ddddocr.DdddOcr:
    global _ocr
    if _ocr is None:
        _ocr = ddddocr.DdddOcr(show_ad=False)
    return _ocr


def _get_det() -> ddddocr.DdddOcr:
    global _det
    if _det is None:
        _det = ddddocr.DdddOcr(det=True, show_ad=False)
    return _det


def _get_slide() -> ddddocr.DdddOcr:
    global _slide
    if _slide is None:
        _slide = ddddocr.DdddOcr(ocr=False, show_ad=False)
    return _slide


def _decode_b64(data: str) -> bytes:
    return base64.b64decode(data)


def ocr(image_b64: str, beta: bool = False) -> tuple[str, float]:
    """OCR 识别：返回 (文本, 置信度)。

    ddddocr 不返回置信度，M1 统一给 1.0，M2 可接入自定义模型获取置信度。
    """
    with _lock:
        return _get_ocr().classification(_decode_b64(image_b64)), 1.0


def det(image_b64: str) -> list[dict]:
    """目标检测：返回 [{x, y, confidence}, ...]（取每个框中心点）

    ddddocr 的 detection() 返回 [x1, y1, x2, y2] 四元组（无置信度），
    置信度统一给 1.0；M2 接入自定义检测模型时可返回真实置信度。
    """
    with _lock:
        boxes = _get_det().detection(_decode_b64(image_b64))
    targets = []
    for box in boxes:
        x1, y1, x2, y2 = box
        targets.append({"x": (x1 + x2) // 2, "y": (y1 + y2) // 2, "confidence": 1.0})
    return targets


def slide(background_b64: str, slide_b64: str) -> tuple[int, int | None, float]:
    """滑块缺口检测：返回 (x, y, confidence)。

    使用 slide_match 的 target 字段作为缺口位置。
    """
    with _lock:
        result = _get_slide().slide_match(
            _decode_b64(slide_b64),
            _decode_b64(background_b64),
        )
    target = result.get("target", [0, 0])
    conf = result.get("confidence", 1.0)
    x, y = int(target[0]), int(target[1])
    return x, y, float(conf)
