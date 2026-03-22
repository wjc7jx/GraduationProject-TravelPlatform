# Travel Project Management Backend

基于 **Node.js + Express + Sequelize + MySQL + JWT** 的微信小程序后端骨架，覆盖基本的用户登录（openid）、项目管理、内容管理示例，并预置中间件与分层结构。

## 目录结构
```
travel-backend/
├─ .env.example           # 环境变量示例
├─ package.json
├─ README.md
└─ src/
   ├─ server.js           # 启动入口
   ├─ app.js              # Express 应用与全局中间件
   ├─ config/
   │  ├─ env.js           # dotenv 加载
   │  └─ database.js      # Sequelize 初始化
   ├─ models/             # 数据模型定义
   │  ├─ index.js
   │  ├─ user.js
   │  ├─ project.js
   │  ├─ content.js
   │  ├─ location.js
   │  └─ permission.js
   ├─ services/           # 业务逻辑层
   │  ├─ authService.js
   │  ├─ projectService.js
   │  └─ contentService.js
   ├─ controllers/        # 控制器
   │  ├─ authController.js
   │  ├─ projectController.js
   │  └─ contentController.js
   ├─ routes/             # 路由注册
   │  ├─ authRoutes.js
   │  ├─ projectRoutes.js
   │  └─ contentRoutes.js
   └─ middleware/
      ├─ auth.js          # JWT 鉴权
      ├─ errorHandler.js  # 全局错误处理
      └─ notFound.js      # 404 处理
```

## 快速开始
1. 复制环境变量
```powershell
Copy-Item .env.example .env
```
2. 填写 `.env` 中的数据库和 JWT 配置。
3. 安装依赖并启动
```powershell
npm install
npm run dev
```
4. 健康检查
- `GET http://localhost:3000/health` 返回 `{ status: 'ok' }`

## 核心接口（示例）
- `POST /api/auth/login`  登录/注册（按 `openid` upsert），返回 JWT。
- `GET /api/projects`     获取当前用户的项目列表。
- `POST /api/projects`    创建项目。
- `GET /api/projects/:id/contents` 获取项目内容列表。
- `POST /api/projects/:id/contents` 创建内容节点。

> 以上接口均为示例，可直接跑通链路；根据论文/业务需求继续扩展。

## 开发说明
- Sequelize 使用 `sequelize.sync()` 简化初期开发，后续可切换到 migrations。
- 所有时间字段为 `DATE` / `DATETIME`，与数据库设计文档保持一致。
- `content_data` 使用 JSON 存储多媒体差异化字段。
- 路由前缀统一 `/api`，CORS 默认允许所有来源（生产环境请收紧）。

## 后续可扩展
- 接入 OSS / COS 做文件存储
- 增加权限/白名单校验逻辑
- 增加内容排序、分页、标签过滤
- 增加 GPX/KML 解析与地图联动接口
- 增加导出（PDF/HTML）能力
