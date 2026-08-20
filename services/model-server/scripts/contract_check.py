"""契约对齐校验：FastAPI 实际路由表 ↔ contracts/openapi.yaml 的 paths。

用法：uv run python scripts/contract_check.py
返回非 0 表示契约与实现不一致（CI 拦截）。
"""

import sys
from pathlib import Path

import yaml

# 保证从任意目录运行都能导入 app（scripts/ 的上级即项目根）
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]  # Ant-Captcha 根
CONTRACT = ROOT / "contracts" / "openapi.yaml"


def contract_paths() -> set[str]:
    spec = yaml.safe_load(CONTRACT.read_text(encoding="utf-8"))
    return set(spec["paths"].keys())


def app_paths() -> set[str]:
    """FastAPI 实际注册的路由 path（递归展开 include_router 前缀）。"""
    paths: set[str] = set()
    IGNORE = {"/openapi.json", "/docs", "/docs/oauth2-redirect", "/redoc"}

    def walk(routes, prefix: str = ""):
        for route in routes:
            # 新版 FastAPI 惰性 include：_IncludedRouter 持有 original_router
            if hasattr(route, "original_router"):
                sub_prefix = getattr(route.include_context, "prefix", "") or ""
                walk(route.original_router.routes, prefix + sub_prefix)
                continue
            p = getattr(route, "path", None)
            if p:
                full = prefix + p
                if full not in IGNORE:
                    paths.add(full)

    walk(app.router.routes)
    return paths


def main() -> int:
    cp = contract_paths()
    ap = app_paths()
    missing = sorted(cp - ap)
    extra = sorted(ap - cp)
    if missing:
        print(f"[FAIL] 契约中但未实现的路由: {missing}")
        return 1
    if extra:
        print(f"[WARN] 已实现但不在契约中的路由: {extra}")
    print(f"[OK] 契约对齐：{len(cp)} 个契约路由全部实现")
    return 0


if __name__ == "__main__":
    sys.exit(main())
