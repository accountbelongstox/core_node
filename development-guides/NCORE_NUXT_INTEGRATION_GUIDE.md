<!-- ### AI SPECIAL ATTENTION RULES START ### -->
<!-- When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES: -->
<!-- - Write all code in English only. -->
<!-- - Never execute, create, or modify test code. -->
<!-- - Never create or update documentation (*.md). -->
<!-- - Never write summaries during development or thinking process. -->
<!-- 5. Declare all variables at the beginning of the file. -->
<!-- 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path). -->
<!-- 7. Do not modify these rules. -->
<!-- VIOLATION OF THESE RULES IS STRICTLY PROHIBITED -->
<!-- ### AI SPECIAL ATTENTION RULES END ### -->

# NCORE-NUXT 联动开发规范指南

## 项目架构概述

### 核心项目结构
```
ncore/ (项目根目录)
├── ncore/                    # Node.js 核心框架
├── apps/                     # Node.js 应用集合
│   ├── DevOps/              # DevOps 管理应用
│   ├── VoiceClientAndCaddy/ # 语音客户端应用
│   └── ...                  # 其他 Node.js 应用
├── poly_apps/               # 多技术栈应用集合
│   ├── nuxt_main/          # Nuxt.js 主应用 (Web入口)
│   ├── laravel_main/       # Laravel 主应用 (API后端)
│   └── ...                 # 其他技术栈应用
└── document_exchange_area/  # 应用间数据交换文档区
```

## 联动开发规范

### 1. 应用命名规范

#### Nuxt应用命名
- **格式**: `{功能名}-{类型}` (如: `dev-dashboard`, `codemart-marketplace`)
- **页面文件**: `{page}-{app}.vue` (如: `dashboard-dev.vue`)
- **配置文件**: `{app}.config.ts` (如: `dev.config.ts`)

#### NCore应用命名
- **目录名**: PascalCase (如: `DevOps`, `VoiceClientAndCaddy`)
- **API路由**: `/api/{app}/{service}` (如: `/api/devops/tools`)
- **服务类**: `{App}{Service}Service` (如: `DevOpsToolsService`)

#### Laravel应用命名
- **控制器**: `{App}{Feature}Controller` (如: `DevOpsToolsController`)
- **模型**: `{App}{Entity}` (如: `DevOpsTool`)
- **路由组**: `{app}.{version}` (如: `devops.v1`)

### 2. API联动规范

#### 请求流程
```
Nuxt Frontend → NCore API → Laravel API (可选)
     ↓              ↓            ↓
  用户界面      业务逻辑      数据持久化
```

#### API端点规范
- **NCore API**: `http://localhost:3000/api/{app}/{service}/{action}`
- **Laravel API**: `http://localhost:8000/api/{app}/v1/{resource}`

#### 数据交换格式
```typescript
// 标准API响应格式
interface APIResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;
  requestId: string;
}
```

### 3. 文档交换区规范

#### 文档命名格式
```
NUXT_APP_{NUXT_APP_NAME}_WITH_NCORE_APP_{NCORE_APP_NAME}_GUIDE.md
```

#### 示例文档名
- `NUXT_APP_DEV_WITH_NCORE_APP_DEVOPS_GUIDE.md`
- `NUXT_APP_CODEMART_WITH_NCORE_APP_PROJECTMANAGER_GUIDE.md`

#### 文档内容结构
```markdown
# NUXT APP {NUXT_APP_NAME} WITH NCORE APP {NCORE_APP_NAME} GUIDE

## 应用概述
- Nuxt应用功能描述
- NCore应用功能描述
- 联动目标和场景

## 数据模型定义
### Nuxt端数据模型
### NCore端数据模型
### 共享数据模型

## API接口规范
### NCore提供的API
### Nuxt调用的API
### 数据流向图

## 开发协作规范
### 开发顺序
### 测试规范
### 部署规范
```

### 4. 开发工作流程

#### 单AI开发流程
1. **需求分析**: 阅读交换区文档，理解联动需求
2. **NCore开发**: 实现API服务和业务逻辑
3. **Nuxt开发**: 实现前端界面和API调用
4. **联调测试**: 端到端功能测试
5. **文档更新**: 更新交换区文档

#### 多AI协作流程
1. **AI-A**: 负责NCore应用开发，更新API文档
2. **AI-B**: 负责Nuxt应用开发，更新前端文档
3. **协作点**: 通过交换区文档同步接口变更
4. **集成测试**: 双方完成后进行联调

### 5. 技术栈集成

#### NCore (Node.js) 技术栈
- **框架**: Express.js + 自定义路由管理
- **数据库**: SQLite/MySQL (通过 #@dbtools)
- **日志**: 统一日志系统 (#@logger)
- **工具**: 丰富的工具库 (#@btools, #@ftools)

#### Nuxt (Vue.js) 技术栈
- **框架**: Nuxt 4.0 + Vue 3
- **状态管理**: Pinia
- **UI框架**: Tailwind CSS
- **HTTP客户端**: $fetch (Nuxt内置)

#### Laravel (PHP) 技术栈
- **框架**: Laravel 11.x
- **数据库**: MySQL/PostgreSQL
- **API**: RESTful API + Sanctum认证
- **队列**: Redis/Database队列

### 6. 环境配置

#### 开发环境启动
```bash
# 启动NCore应用 (端口3000)
npm run dev app=DevOps

# 启动Nuxt应用 (端口3001)
cd poly_apps/nuxt_main
yarn dev:dev

# 启动Laravel应用 (端口8000)
cd poly_apps/laravel_main
php artisan serve
```

#### 环境变量配置
```bash
# NCore环境变量
NODE_ENV=development
APP_PORT=3000

# Nuxt环境变量
APP_ENTRY=dev
NUXT_API_BASE_URL=http://localhost:3000

# Laravel环境变量
APP_ENV=local
APP_URL=http://localhost:8000
```

### 7. 数据流向和安全

#### 认证流程
1. **用户认证**: Nuxt → Laravel (获取JWT Token)
2. **API调用**: Nuxt → NCore (携带Token)
3. **权限验证**: NCore → Laravel (验证Token)

#### 数据安全
- **传输加密**: HTTPS/WSS
- **数据验证**: 输入验证和输出过滤
- **权限控制**: 基于角色的访问控制(RBAC)

## 最佳实践

### 1. 错误处理
- 统一错误码和错误信息
- 完整的错误日志记录
- 用户友好的错误提示

### 2. 性能优化
- API响应缓存
- 数据库查询优化
- 前端资源懒加载

### 3. 监控和调试
- API调用链路追踪
- 性能指标监控
- 实时日志查看

本规范确保ncore项目中不同技术栈应用间的高效协作和数据交换。
