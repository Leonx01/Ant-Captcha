"""M0 出口条件测试：healthz/readyz 可用（M1 后 captcha 端点已实现，此处保留基础断言）。"""

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
