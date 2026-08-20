# Ant-Captcha 仓库布局（Repository Layout）

> 版本：v0.5 · 多语言 monorepo：Node.js（平台）+ Python（推理服务），pnpm 与 uv 各自独立 lockfile。

---

## 顶层结构

```
Ant-Captcha/
├── apps/                        # Node.js 应用（pnpm workspace）
├── services/                    # Python 服务（uv workspace）
├── contracts/                   # ★ 契约：两端的唯一共识
├── packages/                    # 共享 Node 包（可选）
├── examples/                    # 参考集成（非核心交付）
├── tools/                       # 开发/训练工具
├── docker/                      # 容器编排与配置
├── docs/                        # 文档（需求/架构/布局/ADR）
├── .github/                     # CI/CD
├── README.md
├── LICENSE                      # MIT
└── .gitignore
```

---

## 逐目录说明

### `apps/api-server` — 打码平台服务（Node.js + TypeScript + Cordis）

```
apps/api-server/
├── src/
│   ├── http/                    # HTTP 层
│   │   ├── routes/solve.ts      # POST /api/solve 路由
│   │   ├── auth.ts              # token 鉴权（服务）
│   │   └── middleware.ts        # 限流、请求 ID、日志
│   ├── solvers/                 # Solver 插件（内置）
│   │   ├── numeric.ts           # type 1xxx 数英/中文/计算题
│   │   ├── slider.ts            # type 2xxx 滑块缺口
│   │   ├── click.ts             # type 3xxx 点选（det + VLM）
│   │   ├── voice.ts             # type 4xxx 语音（ASR）
│   │   └── custom.ts            # type 9xxx 定制类型注册器
│   ├── providers/               # Provider 插件
│   │   ├── local.ts             # 本地推理服务 client（契约生成）
│   │   └── bailian.ts           # 百炼 VLM/ASR client（AK 注入）
│   ├── registry/                # Solver 注册表（type ↔ 定义）
│   ├── events/                  # waterfall 事件声明（preprocess/route/postprocess）
│   ├── metrics/                 # 指标与结构化日志
│   ├── gen/                     # ★ 契约生成代码（不入库手改）
│   └── index.ts                 # 入口
├── cordis.yml                   # 插件树组装（配置驱动）
├── package.json
├── tsconfig.json
└── Dockerfile                   # node:20-slim
```

### `services/model-server` — 自建推理服务（Python FastAPI + ddddocr）

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
│   │   ├── ddddocr_client.py    # ddddocr 封装（单例 + 并发控制）
│   │   └── model_registry.py    # 定制 ONNX 模型注册表（热加载/LRU）
│   ├── schemas/                 # ★ 契约生成模型（不入库手改）
│   └── health.py                # /healthz /readyz
├── models/                      # 模型文件（.gitignore，下载脚本或 LFS）
│   └── README.md                # 模型来源与下载说明
├── tests/                       # pytest 单元/契约测试
├── pyproject.toml               # uv 管理
├── Dockerfile                   # python:3.11-slim（+ GPU 变体）
└── docker-entrypoint.sh
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

### `packages` — 共享 Node 包（可选，渐进启用）

```
packages/
└── client/                      # 官方 HTTP 客户端 SDK（npm 包，可选交付）
    ├── src/
    ├── package.json
    └── README.md
```

### `examples` — 参考集成（非核心，展示"调用方如何用"）

```
examples/
├── curl/                        # 协议示例：solve.sh（各 type 一个）
│   └── solve-slider.sh
├── playwright/                  # 浏览器自动化参考：取图 → solve → 执行
│   └── login-flow.ts
├── python/                      # Python 调用方示例
│   └── solve.py
└── mock-captcha/                # mock 验证码测试页（集成测试/演示用）
    └── index.html
```

### `tools` — 开发/训练工具

```
tools/
├── train/                       # 定制模型训练脚本（M2，可选交付）
│   └── README.md
├── trajectory/                  # 轨迹生成纯数据工具（可选模块）
│   └── generate.ts
└── manage/                      # CLI 管理：token 签发/吊销、type 列表（首发 CLI）
    └── cli.ts
```

### `docker` — 容器编排

```
docker/
├── docker-compose.yml           # api-server + model-server + mock-captcha
└── .env.example                 # 全部环境变量样例（AK/token/端口）
```

### `.github/workflows` — CI 按路径分流

```
.github/workflows/
├── ci-api-server.yml            # paths: apps/api-server/**, contracts/** → pnpm lint+test+build
├── ci-model-server.yml          # paths: services/model-server/**, contracts/** → uv pytest + docker build
├── ci-contracts.yml             # paths: contracts/** → 契约校验 + 双端生成验证 + 契约测试
└── ci-docs.yml                  # paths: docs/**, README.md → 文档链接检查（可选）
```

### `docs` — 文档

```
docs/
├── requirements.md              # 需求文档 v0.5（含 API 协议规范）
├── architecture.md              # 架构设计（含 ADR 摘要）
├── repository-layout.md         # 本文档
└── adr/                         # 完整 ADR（按需拆分）
    └── 0001-product-form.md     # 产品形态决策：打码平台服务 vs SDK
```

---

## 关键约定

| 约定 | 说明 |
|---|---|
| 契约唯一来源 | `contracts/openapi.yaml`，生成代码禁手改（目录内放 `DO NOT EDIT` 说明） |
| 独立 lockfile | pnpm-workspace.yaml 只管 `apps/`、`packages/`；uv 只管 `services/` |
| CI 路径分流 | 改 Python 不触发 Node 构建，契约变更触发全量 |
| 模型文件不入库 | `services/model-server/models/` gitignore + 下载脚本 |
| 密钥不入库 | 全部走环境变量 / 密钥库（.env.example 只给占位） |
| 核心零浏览器 | 浏览器相关只允许出现在 `examples/` |
