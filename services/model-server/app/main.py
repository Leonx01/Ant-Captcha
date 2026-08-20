"""Ant-Captcha 自建推理服务（M0 骨架）。

M0 目标：/healthz /readyz 可用，captcha 端点返回 501（M1 接入 ddddocr）。
契约：contracts/openapi.yaml（唯一来源）。
"""

from fastapi import FastAPI
from fastapi.responses import JSONResponse

app = FastAPI(
    title="Ant-Captcha Model Server",
    description="自建推理服务（ddddocr），契约见 contracts/openapi.yaml",
    version="0.1.0",
)


@app.get("/healthz")
async def healthz():
    """存活探针"""
    return JSONResponse({"status": "ok"})


@app.get("/readyz")
async def readyz():
    """就绪探针：M0 无模型加载，直接 ok"""
    return JSONResponse({"status": "ok", "models": {}})


# M1 接入 ddddocr 后实现；M0 返回 501 占位
@app.post("/v1/captcha/ocr")
async def captcha_ocr():
    return JSONResponse({"code": 10008, "msg": "not implemented yet (M1)"}, status_code=501)


@app.post("/v1/captcha/det")
async def captcha_det():
    return JSONResponse({"code": 10008, "msg": "not implemented yet (M1)"}, status_code=501)


@app.post("/v1/captcha/slide")
async def captcha_slide():
    return JSONResponse({"code": 10008, "msg": "not implemented yet (M1)"}, status_code=501)


@app.post("/v1/custom/{model_id}")
async def custom_infer(model_id: str):
    return JSONResponse({"code": 10008, "msg": f"model {model_id} not implemented yet (M1)"}, status_code=501)
