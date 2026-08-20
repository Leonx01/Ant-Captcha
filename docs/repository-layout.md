# Ant-Captcha 仓库布局（Repository Layout）

> 版本：v0.6（精简版）· 多语言 monorepo：Node.js（平台）+ Python（推理服务），pnpm 与 uv 各自独立 lockfile。
> 原则：**只保留核心链路**——`packages/`（SDK）、`tools/`（管理 CLI/训练脚本）等后置，见 §5。

---

## 1. 顶层结构

```
Ant-Captcha/
├── apps/                        # Node.js 应用（pnpm workspace）
├── services/                    # Python 服务（uv workspace）
├── contracts/                   # ★ 契约：两端唯一共识
├── examples/                    # 参考集成（curl / Playwright）
├── docker/                      # docker compose 编排
├── docs/                        # 文档
├── .github/                     # CI
├── README.md
├── LICENSE                      # MIT
└── .gitignore
```

---

## 2. 逐目录说明

### `apps/api-server` — 打码平台服务（Node.js + TypeScript + Cordis）

```
apps/api-server/
├── src/
│   ├── http/
│   │   ├── routes/solve.ts      # POST /api/solve
│   │   ├── auth.ts              # 共享密钥校验
│   │   └── middleware.ts        # 限流、请求 ID、日志
│   ├── solvers/                 # Solver 插件（内置）
│   │   ├── text.ts              # type 1xxx 数英/中文/计算题
│   │   ├── slider.ts            # type 2xxx 滑块缺口
│   │   ├── click.ts             # type 3xxx 点选（det + VLM）
│   │   ├── voice.ts             # type 4xxx 语音（ASR）
│   │   └── custom.ts            # type 9xxx 定制类型注册器
│   ├── providers/
│   │   ├── local.ts             # 本地推理服务 client（契约生成）
│   │   └── bailian.ts           # 百炼 VLM/ASR client（AK 注入）
│   ├── registry/                # Solver 注册表（type ↔ 定义）
│   ├── events/                  # waterfall 事件（preprocess/route/postprocess）
│   ├── gen/                     # ★ 契约生成代码（禁手改）
│   └── index.ts
├── cordis.yml                   # 插件树组装（配置驱动）
├── package.json
└── Dockerfile                   # node:20-slim
```

### `services/model-server` — 推理服务（Python FastAPI + ddddocr）

```
services/model-server/
├── app/
│   ├── main.py                  # FastAPI 入口
│   ├── routers/
│   │   ├── ocr.py               # POST /v1/captcha/ocr
│   │   ├── det.py               # POST /v1/captcha/det
│   │   ├── slide.py             # POST /v1/captcha/slide
│   │   └── custom.py            # POST /v1/custom/{model_id}
│   ├── core/
│   │   ├── ddddocr_client.py    # ddddocr 封装（单例 + 锁/池）
│   │   └── model_registry.py    # 定制 ONNX 模型注册表（按需加载）
│   ├── schemas/                 # ★ 契约生成模型（禁手改）
│   └── health.py                # /healthz /readyz
├── models/                      # 模型文件（.gitignore，下载脚本或 LFS）
│   └── README.md                # 模型来源与下载说明
├── tests/                       # pytest 单元/集成测试
├── pyproject.toml               # uv 管理
└── Dockerfile                   # python:3.11-slim
```

### `contracts` — 契约（唯一来源）

```
contracts/
├── openapi.yaml                 # ★ v1 冻结：平台 ↔ 推理服务全部端点
├── README.md                    # 变更流程：破坏性变更升版本、CI 校验
└── scripts/
    ├── generate-node.sh         # → apps/api-server/src/gen/
    └── generate-python.sh       # → services/model-server/app/schemas/
```

### `examples` — 参考集成（展示"调用方如何用"）

```
examples/
├── curl/
│   └── solve.sh                 # 协议示例（各 type 一个命令）
├── playwright/
│   └── login-flow.ts            # 取图 → solve → 执行
└── mock-captcha/                # mock 验证码测试页/测试图（集成测试用）
```

### `docker` — 容器编排

```
docker/
├── docker-compose.yml           # api-server + model-server
└── .env.example                 # 环境变量样例（TOKEN/AK/端口）
```

### `.github/workflows` — CI（最小两路）

```
.github/workflows/
├── ci-node.yml                  # paths: apps/api-server/**, contracts/** → pnpm lint+test+build
└── ci-python.yml                # paths: services/model-server/**, contracts/** → uv pytest + docker build
```

---

## 3. 关键约定

| 约定 | 说明 |
|---|---|
| 契约唯一来源 | `contracts/openapi.yaml`，生成代码禁手改 |
| 独立 lockfile | pnpm-workspace.yaml 只管 `apps/`；uv 只管 `services/` |
| CI 路径分流 | 改 Python 不触发 Node 构建，契约变更触发两端 |
| 模型文件不入库 | `services/model-server/models/` gitignore + 下载脚本 |
| 密钥不入库 | 全部走环境变量（`.env.example` 只给占位） |
| 核心零浏览器 | 浏览器相关只允许出现在 `examples/` |

---

## 4. 目录规划 vs 里程碑

| 目录 | 里程碑 | 说明 |
|---|---|---|
| `contracts/` | M0 | 先定契约再写两端 |
| `apps/api-server/` | M0 骨架 → M1 核心 | M0 只留 http/auth/registry 空壳 |
| `services/model-server/` | M0 骨架 → M1 核心 | M0 只留 health + 空端点 |
| `examples/` | M1（curl）→ M2（playwright） | 随功能逐步补充 |
| `docker/` | M0 | 第一天就要能 compose up |

---

## 5. 后置目录（现在不建）

| 目录 | 触发条件 |
|---|---|
| `packages/client`（SDK） | 调用方超过 2 个语言时 |
| `tools/manage`（管理 CLI） | 需要批量签发 token 时 |
| `tools/train`（训练脚本） | 首次需要自己训模型时 |
| `apps/web`（管理页） | 决定对外商业化时 |
