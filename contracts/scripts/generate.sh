# 契约生成脚本
# 前置：Node 侧需要 @openapitools/openapi-typescript 或 openapi-generator（M1 接入时安装）
# 当前 M0：先以手工镜像方式对齐，M1 用生成器替换。

## Node 侧（生成类型化 client）
# npx openapi-typescript openapi.yaml -o ../apps/api-server/src/gen/model-server.ts

## Python 侧（生成校验模型）
# 使用 fastapi 的 pydantic 手动镜像；或引入 openapi-python-client
# openapi-python-client generate --path openapi.yaml --output-path ../services/model-server/app/gen
