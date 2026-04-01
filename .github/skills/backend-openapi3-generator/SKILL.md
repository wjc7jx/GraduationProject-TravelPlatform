---
name: backend-openapi3-generator
description: 根据当前后端项目代码自动生成或更新 OpenAPI 3.0 接口文档（YAML/JSON）。当用户提到“生成接口文档”“根据 routes/controller 反推 API”“补齐请求参数和响应 schema”“输出 swagger/openapi3”时，务必优先使用此技能，即使用户没有明确说“OpenAPI”。
---

# Backend OpenAPI 3.0 Generator

把现有 Node.js/Express 后端代码转换为可用的 OpenAPI 3.0 文档，目标是“可读、可对接、可导入 Swagger UI”。

## 适用场景

- 用户要从已有后端代码自动生成接口文档。
- 用户要把零散接口说明整理成标准 OpenAPI 3.0。
- 用户要补充请求参数、鉴权头、状态码、错误响应、数据模型定义。
- 用户要对接口进行“增量更新”，保证文档和代码一致。

## 输入与输出

输入通常包括：

- 项目路径（默认当前工作区）
- 是否全量生成或仅生成某个模块（如 auth/projects/contents）
- 输出格式（yaml 或 json）
- 服务基础地址（如 http://localhost:3000）

输出必须包括：

1. OpenAPI 3.0 文档正文（优先 YAML）
2. 路由到文档条目的映射摘要（便于人工核对）
3. 不确定项列表（比如字段类型无法从代码唯一确定）

## 核心工作流

按以下顺序执行，不要跳步：

1. 收集接口入口
2. 解析请求与响应结构
3. 归纳鉴权与通用错误
4. 生成组件 schemas
5. 产出 OpenAPI 3.0 文档
6. 自检并标记不确定项

### 1) 收集接口入口

优先扫描：

- `src/routes/index.js`
- `src/routes/*.js`

提取信息：

- HTTP 方法（GET/POST/PUT/PATCH/DELETE）
- 完整路径（含父路由前缀）
- 对应 controller 方法
- 是否挂载鉴权中间件

### 2) 解析请求与响应结构

结合以下位置推断 schema：

- `src/controllers/*.js`：`req.params`、`req.body`、`req.query`、`res.json`、`res.status(...).json(...)`
- `src/services/*.js`：字段校验逻辑（必填项、枚举、默认值）
- `src/models/*.js`：字段类型、长度、allowNull、enum、默认值

推断规则：

- Sequelize `STRING` -> OpenAPI `type: string`
- `BIGINT` / `INTEGER` -> `type: integer`
- `DATE` / `DATEONLY` -> `type: string` + `format: date-time` 或 `date`
- `JSON` -> `type: object`（必要时 `additionalProperties: true`）
- `ENUM` -> `type: string` + `enum: [...]`

### 3) 归纳鉴权与错误

从中间件提取安全方案，例如 `Authorization: Bearer <token>`：

- 在 `components.securitySchemes` 中定义 `bearerAuth`
- 给需要登录的接口添加 `security: [{ bearerAuth: [] }]`

错误响应至少覆盖：

- `400` 参数错误
- `401` 未授权或 token 无效
- `404` 资源不存在
- `500` 服务器错误

### 4) 生成组件 schemas

至少包含：

- 请求体模型（如 `LoginRequest`, `CreateProjectRequest`）
- 响应体模型（如 `LoginResponse`, `Project`, `Content`）
- 通用错误模型（`ErrorResponse`）

当字段不确定时：

- 保留最小可用结构
- 在描述中注明“需后端确认”

### 5) 产出 OpenAPI 3.0 文档

始终使用 OpenAPI 3.0.x 头部：

```yaml
openapi: 3.0.3
info:
  title: Travel Backend API
  version: 1.0.0
servers:
  - url: http://localhost:3000
```

并包含：

- `paths`
- `components.schemas`
- `components.securitySchemes`

### 6) 自检清单

输出前检查：

- 每个路由都能在 `paths` 找到
- 路径参数（如 `projectId`）在 `parameters` 中声明
- `requestBody.required` 与代码校验一致
- 成功响应与失败响应都声明 `content.application/json`
- 需要鉴权的接口都配置了 `security`

## 输出模板

先给“核对摘要”，再给完整文档：

```text
接口映射摘要：
- POST /api/auth/login -> authController.login
- GET /api/projects -> projectController.getProjects
...

不确定项：
- Content.content_data 的细粒度字段结构未在代码中固定，当前按 object 处理。

OpenAPI 3.0 YAML：
<完整 YAML>
```

## 项目专用默认值（当前仓库）

如果用户没有额外说明，默认按以下项生成：

- API 前缀：`/api`
- 模块：`/auth`、`/projects`、`/projects/{projectId}/contents`
- 登录接口通常不鉴权，其余项目/内容接口使用 Bearer Token
- Dev bypass（`x-dev-user-id`）属于开发便捷机制，不写入正式生产接口规范，仅可在描述中备注

## 示例

示例请求：

“根据当前 Express 项目代码，生成完整 OpenAPI 3.0 YAML，包含 auth、projects、contents 三组接口，并补齐 schema。”

示例输出要点：

- OpenAPI 版本正确
- 三组接口齐全
- `projectId` 路径参数正确声明为 integer
- `content_type` 含 enum：`photo|note|audio|track`
