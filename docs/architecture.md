# Ant-Captcha 架构设计

> 版本：v0.5 · 配套文档：[requirements.md](requirements.md) · [repository-layout.md](repository-layout.md)

---

## 1. 架构总览

```
┌────────────────────────────────────────────────────────────────────┐
│  调用方（任意语言：curl / Python / JS / RPA 平台 / 浏览器自动化）      │
│  职责：取图取音频、把答案变成界面操作（自行执行/校验）                 │
└──────────────────────────┬─────────────────────────────────────────┘
                           │ HTTP (POST /api/solve, 仅 JSON/form)
                           ▼
┌─ apps/api-server（Node.js + TypeScript + Cordis）＝平台服务 ─────────┐
│                                                                     │
│  HTTP 层        token 鉴权 → type 路由 → 配额(可选) → 限流           │
│  Solver 层      Solver 注册表（type ↔ 定义，含内置 + 定制）           │
│  Provider 层    本地推理 / 百炼 VLM+ASR（同构、降级链、waterfall）    │
│  Observability  请求 ID · 结构化日志 · 指标                           │
│                                                                     │
└──────────────────────────┬─────────────────────────────────────────┘
                           │ 内部契约（OpenAPI, HTTP/JSON）
                           ▼
┌─ services/model-server（Python FastAPI + ddddocr）＝自建推理服务 ────┐
│  /v1/captcha/ocr   /v1/captcha/det   /v1/captcha/slide              │
│  /v1/custom/{model_id}   /healthz   /readyz                         │
│  底座：ddddocr（OCR / det / 滑块 / 自定义 ONNX 导入）                │
└─────────────────────────────────────────────────────────────────────┘

外部依赖（仅百炼）：
┌─ 阿里云百炼 ─────────────────────────────────────────────┐
│  VLM（点选语义理解） · ASR（语音验证码转文本）· AK 驱动      │
└──────────────────────────────────────────────────────────┘
```

**三条铁律**：
1. 平台服务只做"媒体 → 答案"，零浏览器依赖；
2. 平台与推理服务之间只通过契约（OpenAPI）通信；
3. Provider 对 Solver 同构——本地/百炼只是配置差异。

---

## 2. 分层职责

| 层 | 载体 | 职责 | 不做什么 |
|---|---|---|---|
| 调用方 | 任意 | 取图/取音频、执行答案、校验结果 | 无（在架构外） |
| 平台服务 | Node + Cordis | 鉴权、路由、编排、降级、观测 | 不做推理，不碰浏览器 |
| 推理服务 | Python FastAPI | ddddocr 推理、自定义 ONNX | 不做业务编排 |
| 外部百炼 | 云服务 | VLM/ASR | 仅被动调用 |

---

## 3. 核心概念映射

### 3.1 Solver = type 代码（行业惯例统一）

| 概念 | 平台内部 | 对外表现 |
|---|---|---|
| 验证码类别（数英/滑块/点选/语音） | Solver 插件 | type 代码（1001/2001/3001/4001...） |
| 针对具体验证码的定制 | 定制 Solver（自定义 ONNX） | 9xxx 定制类型 |
| 求解后端 | Provider（local / bailian） | 无感知（降级链配置） |

### 3.2 Cordis 中的服务与事件

```
ctx.auth           服务：token 签发/校验（插件：auth）
ctx.solverRegistry 服务：type ↔ Solver 定义注册表（插件：registry）
ctx.solver         服务：solve(type, media) → Answer（插件：core）
ctx.providers      服务：provider 注册与选择（插件：provider-local / provider-bailian）
ctx.metrics        服务：计数/耗时/命中率（插件：observability）

事件（waterfall，可插拔策略）：
  solver/preprocess   监听器：图片缩放/去噪/颜色过滤（可短路）
  solver/postprocess  监听器：答案规范化/置信度修正
  solver/route        监听器：降级链决策（短路 = 选定后端）
```

**为什么 waterfall**：降级链是"先本地后百炼"的决策链，`next()` 委托、短路即选定——与 DSH 文档中"单决策事件短路是设计意图"完全一致。

---

## 4. 请求生命周期（时序）

```
调用方          平台服务 (Node)              推理服务 (Python)          百炼
  │  POST /api/solve  │                          │                     │
  ├──────────────────►│                          │                     │
  │                   │ 1. 校验 token            │                     │
  │                   │ 2. 解析 type → Solver    │                     │
  │                   │ 3. solver/route 选 provider (waterfall)        │
  │                   │ 4a. local: 契约请求 ─────►│  ddddocr 推理      │
  │                   │◄─────────────────────────│  返回答案           │
  │                   │ 4b. bailian: AK 请求 ─────────────────────────►│
  │                   │◄──────────────────────────────────────────────┤
  │                   │ 5. solver/postprocess 规范化                   │
  │                   │ 6. 记录指标/日志（请求 ID 贯穿）                │
  │◄──────────────────┤                          │                     │
  │  10000 + 答案     │                          │                     │
```

失败路径：provider 异常 → 降级链下一后端（同媒体，不重新取图）→ 全失败返回对应错误码。

---

## 5. 推理服务内部设计（Python）

```
services/model-server/
└── app/
    ├── main.py                # FastAPI 入口，挂载 routers
    ├── routers/
    │   ├── ocr.py             # POST /v1/captcha/ocr
    │   ├── det.py             # POST /v1/captcha/det
    │   ├── slide.py           # POST /v1/captcha/slide
    │   └── custom.py          # POST /v1/custom/{model_id}（动态加载）
    ├── core/
    │   ├── ddddocr_client.py  # ddddocr 封装（单例、并发控制）
    │   └── model_registry.py  # 定制 ONNX 模型注册表（热加载）
    └── schemas/               # 契约生成/校验模型（从 contracts/ 生成）
```

要点：
- ddddocr 单例 + 线程安全并发控制（ddddocr 非线程安全，需锁/池）；
- 定制模型按需加载、LRU 卸载、显存预算（VLM/ASR 不自建，压力小）；
- 所有响应带请求 ID（平台传入，透传返回）。

---

## 6. 契约层设计

```
contracts/
└── openapi.yaml      # 唯一来源（v1 冻结）
        │
        ├── 生成 → apps/api-server/src/gen/（openapi-typescript，类型化 client）
        └── 生成 → services/model-server/app/schemas/（fastapi 校验模型）
```

- 契约只约束"平台 ↔ 推理服务"；百炼的 schema 由供应商提供，平台内部适配；
- CI 中契约变更触发两端生成 + 校验 + 契约测试，不一致禁止合并（FR-27）。

---

## 7. 部署拓扑

```
生产：
  [api-server: Node] ──► [model-server: Python + GPU]（内网）
        │                        ▲
        └────────► [百炼 API]（公网，AK 注入）

Docker：
  ant-captcha-api      # apps/api-server/Dockerfile（node:20-slim）
  ant-captcha-model    # services/model-server/Dockerfile（python:3.11 + onnxruntime-gpu 变体）
  docker compose up    # 本地一键起全栈（含 mock 验证码测试页）

扩展性：平台无状态可多副本；推理服务单机 GPU×1（A2），横向扩展为后续演进。
```

---

## 8. 演进路线

| 阶段 | 内容 |
|---|---|
| v1.0 | 协议冻结、内置 Solver 全类型、定制类型、百炼接入、可观测性 |
| v1.x | PaddleOCR 备选 provider（复杂中文语义验证码时启用） |
| v2.x | reCAPTCHA 凭证类（异步端点）、配额计费、Web 管理页 |
| v3.x | 推理服务多实例/GPU 池、契约 v2 |

---

## 9. 设计决策记录（ADR 摘要）

| 决策 | 理由 | 备选 |
|---|---|---|
| 产品 = 打码平台服务（HTTP API） | 语言无关、行业惯例、可商业化 | SDK/库形态（否决：绑定语言） |
| 核心粒度 = 媒体→答案 | 界面探索下沉会绑死浏览器框架、不可单测 | page 级 API（否决） |
| Node + Cordis 编排 / Python 推理 | 各取所长；Cordis 插件化契合 Solver/provider 抽象 | 单语言（否决：模型生态） |
| 百炼为唯一外部供应商 | 国内生态成熟；AK 驱动与打码平台同构 | 多供应商（否决：首发复杂度） |
| 不接第三方打码平台 | 我们是服务提供方而非代理方 | 代理模式（否决：无差异化） |
| ddddocr 为底座 | 通用能力强 + 自定义 ONNX 导入（定制类型基础） | PaddleOCR（备选，文档 OCR 定位） |
| 协议参数对齐云码 | 现有打码用户零成本迁移 | 自造协议（否决：迁移成本） |
