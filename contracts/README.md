# contracts/ 变更流程
# 1. 修改 openapi.yaml（破坏性变更必须升 version）
# 2. 运行 scripts/generate.sh 重新生成两端代码
# 3. CI 校验契约与两端一致（见 .github/workflows/ci-contracts.yml）

# v1.0.0（冻结）：平台 ↔ 推理服务全部端点
