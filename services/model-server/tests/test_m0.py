"""M0 出口条件测试：healthz/readyz 可用，captcha 端点 501 占位。"""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_healthz():
    res = client.get("/healthz")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_readyz():
    res = client.get("/readyz")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_captcha_ocr_not_implemented():
    res = client.post("/v1/captcha/ocr", json={"image": "ZmFrZQ=="})
    assert res.status_code == 501


def test_custom_model_not_implemented():
    res = client.post("/v1/custom/my-model", json={"image": "ZmFrZQ=="})
    assert res.status_code == 501
