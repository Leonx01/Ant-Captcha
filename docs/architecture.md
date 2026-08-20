# Ant-Captcha 架构设计

> 版本：v0.6（精简版）· 配套文档：[requirements.md](requirements.md) · [repository-layout.md](repository-layout.md)

---

## 1. 架构总览

```
调用方（我们自己的 RPA 脚本 / Playwright 流程 / curl）
  职责：取图取音频、执行答案、校验结果
        │  HTTP (POST /api/solve)
        ▼
┌─ apps/api-server（Node.js + TypeScript + Cordis）＝平台服务 ─┐
│                                                              │
│  HTTP 层      共享密钥校验 → type 路由 → 限流                 │
│  Solver 层    Solver 注册表（type ↔ 定义，内置 + 定制）        │
│  Provider 层  本地推理 / 百炼（同构、降级链、waterfall）       │
│  日志         请求 ID · 结构化日志                            │
│                                                              │
└──────────────────────────┬───────────────────────────────────┘
                           │ 内部契约（OpenAPI, HTTP/JSON）
                           ▼
┌─ services/model-server（Python FastAPI + ddddocr）＝推理服务 ─┐
│  /v1/captcha/ocr  /v1/captcha/det  /v1/captcha/slide         │
│  /v1/custom/{model_id}  /healthz  /readyz                    │
└──────────────────────────────────────────────────────────────┘

外部依赖（仅百炼）：VLM（语义点选）· ASR（语音）· AK 驱动
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
| 平台服务 | Node + Cordis | 鉴权、路由、编排、降级、日志 | 不做推理，不碰浏览器 |
| 推理服务 | Python FastAPI | ddddocr 推理、自定义 ONNX | 不做业务编排 |
| 外部百炼 | 云服务 | VLM/ASR | 仅被动调用 |

---

## 3. 核心概念映射

### 3.1 Solver = type 代码

| 概念 | 平台内部 | 对外表现 |
|---|---|---|
| 验证码类别（数英/滑块/点选/语音） | Solver 插件 | type 代码（1001/2001/3001/4001...） |
| 针对具体验证码的定制 | 定制 Solver（自定义 ONNX） | 9xxx 定制类型 |
| 求解后端 | Provider（local / bailian） | 无感知（降级链配置） |

### 3.2 Cordis 中的服务与事件

```
ctx.auth           服务：共享密钥校验（插件：auth）
ctx.solverRegistry 服务：type ↔ Solver 注册表（插件：registry）
ctx.solver         服务：solve(type, media) → Answer（插件：core）
ctx.providers      服务：provider 注册与选择（插件：provider-local / provider-bailian）

事件（waterfall，可插拔策略）：
  solver/preprocess   监听器：图片缩放/去噪/颜色过滤（可短路）
  solver/postprocess  监听器：答案规范化
  solver/route        监听器：降级链决策（短路 = 选定后端）
```

**为什么 waterfall**：降级链是"先本地后百炼"的决策链，`next()` 委托、短路即选定——与 DSH 文档中"单决策事件短路是设计意图"一致。

---

## 4. 请求生命周期

```
调用方          平台服务 (Node)              推理服务 (Python)          百炼
  │  POST /api/solve  │                          │                     │
  ├──────────────────►│                          │                     │
  │                   │ 1. 校验共享密钥           │                     │
  │                   │ 2. 解析 type → Solver    │                     │
  │                   │ 3. solver/route 选 provider (waterfall)        │
  │                   │ 4a. local: 契约请求 ─────►│  ddddocr 推理      │
  │                   │◄─────────────────────────│  返回答案           │
  │                   │ 4b. bailian: AK 请求 ─────────────────────────►│
  │                   │◄──────────────────────────────────────────────┤
  │                   │ 5. solver/postprocess 规范化                   │
  │                   │ 6. 记录日志（请求 ID 贯穿）                     │
  │◄──────────────────┤                          │                     │
  │  10000 + 答案     │                          │                     │
```

失败路径：provider 异常 → 降级链下一后端（同媒体，不重新取图）→ 全失败返回对应错误码。

---

## 5. 推理服务内部（Python）

```
services/model-server/
└── app/
    ├── main.py                # FastAPI 入口，挂载 routers
    ├── routers/
    │   ├── ocr.py             # POST /v1/captcha/ocr
    │   ├── det.py             # POST /v1/captcha/det
    │   ├── slide.py           # POST /v1/captcha/slide
    │   └── custom.py          # POST /v1/custom/{model_id}
    ├── core/
    │   ├── ddddocr_client.py  # ddddocr 封装（单例 + 锁/池，非线程安全）
    │   └── model_registry.py  # 定制 ONNX 模型注册表（按需加载）
    └── schemas/               # 契约生成模型（从 contracts/ 生成，禁手改）
```

要点：
- ddddocr 单例 + 并发控制（ddddocr 非线程安全）；
- 定制模型按需加载（自用规模，LRU/显存调度后置）；
- 所有响应带请求 ID（平台传入，透传返回）。

---

## 6. 契约层

```
contracts/
└── openapi.yaml      # 唯一来源（v1 冻结）
        │
        ├── 生成 → apps/api-server/src/gen/（openapi-typescript）
        └── 生成 → services/model-server/app/schemas/（fastapi 校验）
```

- 契约只约束"平台 ↔ 推理服务"；百炼的 schema 由供应商提供，平台内部适配；
- 契约变更 → CI 触发两端重新生成 + 校验，不一致禁止合并。

---

## 7. 部署

```
本地/自用（docker compose）：
  api-server（node:20-slim）──► model-server（python:3.11 + onnxruntime）[内网]
                                      │
                                      └──► 百炼 API（公网，AK 环境变量注入）

单机单实例即可；平台无状态，必要时可多副本（后置）。
```

---

## 8. 设计决策记录（ADR 摘要）

| 决策 | 理由 | 备选 |
|---|---|---|
| 产品 = 打码平台服务（HTTP API） | 语言无关、协议可复用 | SDK/库形态（否决：绑定语言） |
| 核心粒度 = 媒体→答案 | 界面探索下沉会绑死浏览器框架、不可单测 | page 级 API（否决） |
| Node + Cordis 编排 / Python 推理 | 各取所长；插件化契合 Solver/provider 抽象 | 单语言（否决：模型生态） |
| 百炼为唯一外部供应商 | 国内生态成熟；AK 驱动与打码平台同构 | 多供应商（否决：首发复杂度） |
| ddddocr 为底座 | 通用能力强 + 自定义 ONNX 导入（定制类型基础） | PaddleOCR（备选，文档 OCR 定位） |
| 协议参数对齐云码 | 现有打码用户零成本迁移 | 自造协议（否决：迁移成本） |
| 自用优先、不做商业化 | 无计费/配额/多租户/管理页，聚焦核心链路 | 商业化形态（否决：YAGNI） |
