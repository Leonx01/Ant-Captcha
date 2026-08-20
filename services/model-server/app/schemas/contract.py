"""契约请求/响应模型（M1 手写镜像 contracts/openapi.yaml，M2 切换为生成）"""

from pydantic import BaseModel, Field


class MediaImage(BaseModel):
    image: str = Field(description="图片 base64（不含 data: 前缀）")
    request_id: str | None = Field(default=None, description="平台传入的请求 ID")


class OcrRequest(MediaImage):
    beta: bool = False
    charset: str | None = None


class OcrResponse(BaseModel):
    text: str
    confidence: float = Field(ge=0, le=1)
    request_id: str | None = None


class DetRequest(MediaImage):
    pass


class Target(BaseModel):
    x: int
    y: int
    confidence: float = Field(ge=0, le=1)


class DetResponse(BaseModel):
    targets: list[Target]
    request_id: str | None = None


class SlideRequest(BaseModel):
    background_image: str
    slide_image: str
    request_id: str | None = None


class SlideResponse(BaseModel):
    x: int
    y: int | None = None
    confidence: float = Field(ge=0, le=1)
    request_id: str | None = None


class CustomRequest(MediaImage):
    pass


class CustomResponse(BaseModel):
    result: str
    confidence: float = Field(ge=0, le=1)
    request_id: str | None = None
