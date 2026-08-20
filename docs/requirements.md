# Ant-Captcha 需求文档（Requirements）

> 版本：v0.6（精简版）· 状态：待评审
> 定位：**自用打码平台服务**——HTTP 打码 API，媒体进、答案出，基于 ddddocr 底座 + 百炼外部能力。
> 演进策略：**从小往大长**——只做现在需要的，其余后置（见 §10）。

---

## 1. 项目概述

### 1.1 定位

Ant-Captcha 是一套**自用的打码平台服务**：通过 HTTP API 接收验证码媒体（图片 / 音频 / 语义描述），返回结构化答案（文本 / 坐标 / 选择）。自己部署、自己控制成本、可针对具体验证码定制。

### 1.2 边界（最高优先级约束）

- 核心**只做"媒体 → 答案"**，不探索界面、不操作浏览器、不管理页面状态；
- 取图、执行、校验由**调用方**负责（我们自己的 RPA / 浏览器自动化流程）；
- 调用方与平台之间只隔一层 HTTP 协议，语言无关。

### 1.3 目标用户

| 用户 | 角色 |
|---|---|
| 我们自己（RPA 开发者） | 通过 HTTP API 接入自家流程 |
| 我们自己（运维） | docker compose 部署、看日志 |
| 我们自己（算法） | 为特定验证码训练模型，注册定制类型 |

> 单用户、单部署，**不做多租户、不做商业化**。

### 1.4 设计目标

| # | 目标 | 验收口径 |
|---|---|---|
| G1 | 简单够用 | 一条 `docker compose up` 起服务；curl 一行可调 |
| G2 | 开箱即用 | 内置常用类型：数英 / 中文 / 计算题 / 滑块 / 点选 / 语音 |
| G3 | 可定制 | 针对具体验证码注册定制类型（自定义 ONNX），与内置同接口 |
| G4 | 后端可插拔 | 本地推理 / 百炼可配置切换与降级 |
| G5 | 可控 | 自托管、密钥自管、日志可见 |

### 1.5 非目标（明确不做）

| 条目 | 说明 |
|---|---|
| 浏览器自动化 | 不做页面级 API；Playwright 仅为参考示例 |
| 第三方打码平台接入 | 我们是服务提供方，不代理外部打码服务 |
| **商业化能力** | ❌ 无计费 / 配额 / 多租户 / 用户中心 / Web 管理页 |
| reCAPTCHA 凭证类 | 浏览器内凭证型，后置（§10） |
| 通用模型训练平台 | 训练是独立工作流，仓库只给文档/脚本（后置） |
| 100% 通过率承诺 | 验证码本质是概率问题 |

---

## 2. 术语表

| 术语 | 定义 |
|---|---|
| Solver | 针对某一类具体验证码的求解器封装；对外表现为一个 **type 代码** |
| 定制类型 | 用户针对特定验证码注册的 Solver，动态分配 9xxx type 代码 |
| 底座（Base） | ddddocr 通用能力：OCR / det / 滑块缺口 / 自定义 ONNX 导入 |
| Provider | 能力后端：本地推理 / 百炼，对 Solver 同构 |
| 百炼（Bailian） | 阿里云百炼：唯一外部 AI 供应商（VLM + ASR） |
| 契约（Contract） | 平台（Node）与推理服务（Python）之间的 OpenAPI 接口定义 |
| 媒体 / 答案 | Solver 输入（image/audio/description）/ 输出（text/coordinates/choice + 置信度） |

---

## 3. 能力模型：Solver = type 代码

```
调用方（我们自己的 RPA 脚本 / Playwright 流程 / curl）
  POST /api/solve  { token, type, media... }
        │ 媒体进
        ▼
Ant-Captcha：type 路由 → Solver（识别 + 降级链）→ Answer
        │ 答案出（text / coordinates / choice）
        ▼
调用方自行执行（拖动 / 点击 / 输入 / 校验）
```

**输入输出契约（冻结）：**

| Solver 类型 | 输入 | 输出 |
|---|---|---|
| 数英 / 中文 / 计算题 | image | text + 置信度 |
| 滑块缺口 | image(背景) + image(滑块) | coordinates + 置信度 |
| 点选（det） | image | coordinates[] |
| 点选（语义 VLM） | image + extra(描述) | coordinates / choice |
| 语音（ASR） | audio | text + 置信度 |
| 自定义 ONNX | image | text / coordinates |

---

## 4. 用户场景

| # | 场景 | 关键诉求 |
|---|---|---|
| UC-1 | 登录页遇滑块 | 截图 → API 返回缺口坐标 → 自己拖动 |
| UC-2 | 批量采集遇数英验证码 | 传图 → 返回文本，高吞吐 |
| UC-3 | 遇点选验证码 | det 定位 + 百炼 VLM 语义，返回坐标 |
| UC-4 | 遇语音验证码 | 传音频 → 百炼 ASR 返回文本 |
| UC-5 | 自家特殊验证码 | 训练 ONNX → 注册定制类型 → 专属 type |
| UC-6 | 本地调试 | docker compose 起服务；curl 直测 |

---

## 5. API 协议（核心交付）

> 仅 POST；Content-Type：`application/json` 或 `application/x-www-form-urlencoded`。参数名对齐行业惯例（云码），便于迁移与工具复用。

### 5.1 端点

```
POST /api/solve
```

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| token | string | 是 | 共享密钥（环境变量配置，见 FR-3） |
| type | string | 是 | 类型代码（见 5.4） |
| image | string | 视类型 | 图片 base64 |
| slide_image | string | 滑块 | 滑块小图 base64 |
| background_image | string | 滑块 | 背景图 base64 |
| extra | string | 语义点选 | 描述，如"请点击包含红绿灯的图片" |
| audio | string | 语音 | 音频 base64 |

### 5.2 响应

```json
{
  "code": 10000,
  "msg": "请求成功",
  "data": {
    "code": 200,
    "data": "答案文本 | 坐标 x,y,x,y | 序号",
    "time": 312,
    "provider": "local | bailian",
    "confidence": 0.96,
    "meta": {}
  }
}
```

### 5.3 错误码

| code | 说明 |
|---|---|
| 10000 | 识别成功 |
| 10001 | 参数错误 |
| 10003 | 无权限（token 无效） |
| 10004 | 无此验证类型 |
| 10005 | 服务繁忙（内部限流/排队满） |
| 10006 | 数据包过载（媒体过大） |
| 10008 | 内部错误 |
| 10009 | 结果准备中（异步扩展位，暂不使用） |

### 5.4 type 代码表（Solver 注册表）

| 区间 | 类型 | 首发 |
|---|---|---|
| 1xxx | 图形文本：1001 数英 · 1002 中文 · 1003 计算题 | ✅ |
| 2xxx | 2001 滑块缺口 | ✅ |
| 3xxx | 3001 点选(det) · 3002 语义点选(VLM, extra) | ✅ |
| 4xxx | 4001 语音(ASR) | ✅ |
| 9xxx | 定制类型（动态分配） | ✅ |

---

## 6. 功能需求

### 6.1 平台服务（Node.js + Cordis）

| # | 需求 | 验收要点 |
|---|---|---|
| FR-1 | 打码 API | `POST /api/solve` 按 §5 实现；JSON 与 form 均支持 |
| FR-2 | type 路由 | type → Solver 精确路由；未知 type 返回 10004 |
| FR-3 | 共享密钥鉴权 | 单一 token 经环境变量配置；不匹配返回 10003；日志不记录 token |
| FR-4 | 插件化架构 | 核心能力以 Cordis 插件提供（Solver/provider 可插拔） |
| FR-5 | 配置驱动 | 行为经 `cordis.yml` 组合，无硬编码 |
| FR-6 | 结构化日志 | 每请求 type/provider/耗时/成败 + 请求 ID 可追溯 |

### 6.2 Solver 层

| # | 需求 | 验收要点 |
|---|---|---|
| FR-7 | 声明式定义 | name/type/模型/降级链全声明化 |
| FR-8 | 内置 Solver | 数英、中文、计算题、滑块、点选(det)、点选(VLM)、语音 7 类 |
| FR-9 | 定制类型注册 | 自定义 ONNX + 字符集导入；自动分配 9xxx 代码，与内置同接口 |
| FR-10 | 预处理/后处理 | 图片缩放/去噪/颜色过滤可配置（waterfall 事件） |

### 6.3 Provider 层

| # | 需求 | 验收要点 |
|---|---|---|
| FR-11 | 本地推理 provider | 调自建推理服务（FastAPI + ddddocr），契约见 6.5 |
| FR-12 | 百炼 provider | VLM（语义点选）+ ASR（语音）；AK 环境变量注入 |
| FR-13 | 统一 provider 抽象 | 本地/百炼同构；新增 provider 不改 Solver 代码 |
| FR-14 | 降级链 | Solver 级配置如 `[local, bailian]`；同媒体重试不重新取图 |
| FR-15 | 重试与容错 | 重试次数/间隔可配；单次失败返回可识别错误码 |

### 6.4 自建推理服务（Python FastAPI + ddddocr）

| # | 需求 | 验收要点 |
|---|---|---|
| FR-16 | OCR 端点 | image → text（数英/中文；beta 模型可选） |
| FR-17 | det 端点 | image → 目标坐标列表 |
| FR-18 | 滑块缺口端点 | bg+fg → 缺口坐标（双算法可选） |
| FR-19 | 自定义 ONNX 端点 | 按注册模型推理 |
| FR-20 | 健康探针 | `/healthz`、`/readyz` |
| FR-21 | 并发控制 | ddddocr 非线程安全 → 锁/池；并发数可配 |

### 6.5 契约层

| # | 需求 | 验收要点 |
|---|---|---|
| FR-22 | OpenAPI 契约 | 唯一来源 `contracts/`；Node 生成类型化 client；Python 校验请求/响应 |
| FR-23 | 契约版本化 | 破坏性变更升版本；v1 冻结不静默改语义 |

### 6.6 工程化

| # | 需求 | 验收要点 |
|---|---|---|
| FR-24 | monorepo | `apps/api-server` + `services/model-server` + `contracts/`；pnpm / uv 独立 lockfile |
| FR-25 | Docker | 平台镜像 + 推理镜像；`docker compose up` 一键起全栈 |
| FR-26 | CI | Node 与 Python 路径分流；契约变更触发两端校验 |
| FR-27 | 测试 | 单元（两端）+ 集成（curl 直测 mock 验证码图） |
| FR-28 | 文档 | README + 三份 docs + 快速上手 |

---

## 7. 非功能需求

| # | 需求 | 指标 |
|---|---|---|
| NFR-1 | 性能 | 底座 OCR P95 ≤ 1s；滑块缺口 P95 ≤ 2s；≥ 10 并发 |
| NFR-2 | 可用性 | 百炼故障自动降级本地；服务无状态可多副本 |
| NFR-3 | 安全 | token/AK 环境变量注入；推理服务内网；日志脱敏 |
| NFR-4 | 合规 | 合法使用声明；日志不含凭据 |
| NFR-5 | 可扩展性 | 新验证码类型 = 注册新 Solver；新能力 = 新 provider |
| NFR-6 | 可观测性 | 请求 ID 贯穿；耗时/成功率/后端命中率可查 |
| NFR-7 | 兼容性 | Node ≥ 20；Python ≥ 3.11（ddddocr 上限 3.12） |

---

## 8. 假设与边界

| # | 假设 |
|---|---|
| A1 | 技术栈：Node.js + TypeScript（平台）+ Python（推理服务） |
| A2 | 推理服务单机部署（GPU×1 或纯 CPU），横向扩展后置 |
| A3 | 百炼为第三方服务，可用性/价格不在本项目控制 |
| A4 | 不内置浏览器下载/管理 |
| A5 | PaddleOCR 列为备选 provider，遇复杂中文语义验证码再评估 |

---

## 9. 里程碑（从小往大）

| 阶段 | 内容 | 出口条件 |
|---|---|---|
| M0 | 骨架：monorepo + 契约 + docker compose + 空 API | 两端 hello 打通，`/api/solve` 返回 10004 |
| M1 | 底座 + 数英/滑块 Solver + 平台 API | curl 传图返回答案；滑块演示通过率 ≥ 80% |
| M2 | 定制类型（ONNX 导入）+ 点选(det) | 自定义模型跑通 demo |
| M3 | 百炼接入（VLM + ASR）+ 降级链 | 多 provider 切换可用 |
| M4 | 可观测性完善 + 文档 + v1.0 | 达 NFR 发布 |

---

## 10. 演进策略（后置项，现在不做）

> 原则：**只做当下需要的**。以下明确后置，需求确认时不讨论、不设计：

| 后置项 | 触发条件 |
|---|---|
| 计费 / 配额 / 多租户 / Web 管理页 | 决定对外商业化时 |
| reCAPTCHA 凭证类（异步端点） | 真实遇到需要时 |
| 客户端 SDK（npm/python 包） | 调用方超过 2 个语言时 |
| Solver 版本化/回退 | 定制类型数量变多、需要 A/B 时 |
| 训练脚本 `tools/train/` | 首次需要自己训模型时 |
| 指标导出（Prometheus） | 需要监控告警时 |
| 推理服务多实例 / GPU 池 | 吞吐不够时 |

---

*本文档与 [architecture.md](architecture.md)、[repository-layout.md](repository-layout.md) 配套使用。*
