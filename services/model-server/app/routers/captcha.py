"""验证码识别端点：/v1/captcha/*（契约对齐 contracts/openapi.yaml）"""

import logging

from fastapi import APIRouter, HTTPException

from app.core import ddddocr_client
from app.schemas.contract import (
    DetRequest,
    DetResponse,
    OcrRequest,
    OcrResponse,
    SlideRequest,
    SlideResponse,
    Target,
)

logger = logging.getLogger("captcha")
router = APIRouter()


@router.post("/ocr", response_model=OcrResponse)
async def ocr(req: OcrRequest):
    try:
        text, confidence = ddddocr_client.ocr(req.image, beta=req.beta)
    except Exception as e:
        logger.exception("ocr failed")
        raise HTTPException(status_code=500, detail=f"ocr failed: {e}")
    return OcrResponse(text=text, confidence=confidence, request_id=req.request_id)


@router.post("/det", response_model=DetResponse)
async def det(req: DetRequest):
    try:
        targets = ddddocr_client.det(req.image)
    except Exception as e:
        logger.exception("det failed")
        raise HTTPException(status_code=500, detail=f"det failed: {e}")
    return DetResponse(
        targets=[Target(**t) for t in targets],
        request_id=req.request_id,
    )


@router.post("/slide", response_model=SlideResponse)
async def slide(req: SlideRequest):
    try:
        x, y, confidence = ddddocr_client.slide(req.background_image, req.slide_image)
    except Exception as e:
        logger.exception("slide failed")
        raise HTTPException(status_code=500, detail=f"slide failed: {e}")
    return SlideResponse(x=x, y=y, confidence=confidence, request_id=req.request_id)
