<div align="center">

<img src="assets/logo.png" alt="Ant-Captcha Logo" width="200" />

# Ant-Captcha 🐜

**Ant-Captcha is a self-hosted CAPTCHA-solving platform for robotic process automation (RPA).**

自托管打码平台：媒体进，答案出。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## 📖 简介

Ant-Captcha 是一套**可自托管的打码平台服务**：通过 HTTP API 接收验证码媒体（图片 / 音频 / 语义描述），返回结构化答案（文本 / 坐标 / 选择）。形态对标行业打码平台，但**完全自托管、自控成本、可定制**。

**核心边界**：只做「媒体 → 答案」。不探索界面、不操作浏览器——取图、执行、校验全部由调用方负责，调用方与平台之间只隔一层 HTTP 协议，**语言无关、框架无关**。

> ⚠️ **声明**：本项目仅供学习研究与合法的 RPA 自动化场景使用，请遵守目标网站的条款与相关法律法规。

## ✨ 能力

- **多类型验证码**：数英 OCR / 中文字符 / 计算题 / 滑块缺口 / 点选（det + VLM）/ 语音（ASR）
- **定制类型**：针对具体验证码训练 ONNX 模型，注册后获得专属 type 代码（行业惯例，如「定制-xxx」）
- **多后端**：本地推理（ddddocr）+ 百炼外部 API（VLM / ASR），配置切换与降级链
- **协议友好**：HTTP 仅 POST，参数对齐行业惯例，现有打码用户可零成本迁移

## 📚 文档

| 文档 | 说明 |
|---|---|
| [需求文档](docs/requirements.md) | 完整需求 v0.5，含 API 协议规范与 type 代码表 |
| [架构设计](docs/architecture.md) | 分层架构、请求生命周期、设计决策（ADR） |
| [仓库布局](docs/repository-layout.md) | monorepo 结构与关键约定 |

## 🚀 快速开始

项目代码正在建设中，`Quick Start` 将在 M0 骨架完成后补充。

```bash
# TODO: M0 后补充 docker compose up 一键起服务
```

## 📁 目录结构

```
Ant-Captcha/
├── apps/api-server/       # 打码平台服务（Node.js + Cordis）
├── services/model-server/ # 自建推理服务（Python FastAPI + ddddocr）
├── contracts/             # OpenAPI 契约（两端唯一共识）
├── packages/              # 共享 Node 包（客户端 SDK 可选）
├── examples/              # 参考集成（curl / Playwright / Python）
├── tools/                 # 管理 CLI / 训练脚本
├── docker/                # docker compose 编排
├── docs/                  # 文档
└── assets/                # Logo 等静态资源
```

## 🤝 贡献

欢迎通过 [Issue](https://github.com/Leonx01/Ant-Captcha/issues) 提交反馈，或提交 Pull Request 参与开发。

## 📄 许可证

[MIT](LICENSE) © Leonx01
