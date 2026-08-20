"""Ant-Captcha 自建推理服务。

M1：ddddocr 底座接入（OCR / det / 滑块缺口）。
契约：contracts/openapi.yaml（唯一来源，app/schemas/contract.py 为手写镜像）。
"""

import logging

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from app.routers import captcha

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Ant-Captcha Model Server",
    description="自建推理服务（ddddocr），契约见 contracts/openapi.yaml",
    version="0.2.0",
)


@app.get("/healthz")
async def healthz():
    """存活探针"""
    return JSONResponse({"status": "ok"})


@app.get("/readyz")
async def readyz():
    """就绪探针：M1 模型懒加载，未加载前也算 ok（首次请求时加载）"""
    return JSONResponse({"status": "ok", "models": {"ddddocr": "lazy"}})


@app.post("/v1/custom/{model_id}")
async def custom_infer(model_id: str):
    """定制 ONNX 模型推理（M2 接入自定义模型注册表，M1 占位）"""
    return JSONResponse({"code": 10008, "msg": f"model {model_id} not implemented yet (M2)"}, status_code=501)


app.include_router(captcha.router, prefix="/v1/captcha")
