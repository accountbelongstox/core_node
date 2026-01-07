# 智链会员门户 - 开发规范文档

> 基于 API 文档的完整开发指南

**文档版本**: 2.0  
**最后更新**: 2026-01-08  
**项目**: nexusai-membership-portal

---

## 📋 目录

1. [项目概述](#项目概述)
2. [开发进度](#开发进度)
3. [API 系统](#api-系统)
4. [页面开发清单](#页面开发清单)
5. [开发规范](#开发规范)

---

## 项目概述

**智链会员门户**是基于 React + TypeScript + Vite 的前端应用，作为 Claude Relay Service (CRS) 的用户端和管理端门户。

### 技术栈

- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **路由**: React Router DOM
- **状态管理**: React Context API
- **样式**: Tailwind CSS
- **国际化**: 自定义 i18n（支持 en/zh/ja/ko）
- **API 系统**: 多端点自动切换（参考 `MULTI_API_URL_SYSTEM.md`）

---

## 开发进度

### ✅ 已完成

1. **项目基础架构**
   - [x] React + TypeScript + Vite 项目搭建
   - [x] 路由系统（React Router DOM）
   - [x] 全局状态管理（Context API）
   - [x] 国际化系统（4 种语言）
   - [x] 主题切换（dark/light）

2. **API 中心** ✅
   - [x] API 端点配置（`config/api-endpoints.ts`）
   - [x] API 管理器（`services/api/ApiManager.ts`）
   - [x] API 客户端（`services/api/client.ts`）
   - [x] 数据模型定义（`types/models.ts`）
   - [x] API 类型定义（`types/api.ts`）
   - [x] 认证服务（`services/api/authService.ts`）
   - [x] API Key 服务（`services/api/apiKeyService.ts`）
   - [x] 仪表板服务（`services/api/dashboardService.ts`）
   - [x] 使用统计服务（`services/api/usageStatsService.ts`）

3. **页面基础实现**
   - [x] LoginPage - 登录页面（UI 完成）
   - [x] DashboardPage - 仪表板（UI 完成）
   - [x] KeysPage - API Key 管理（UI 完成）
   - [x] MembershipPage - 会员页面（UI 完成）
   - [x] DocsPage - 文档页面（UI 完成）
   - [x] SettingsPage - 设置页面（UI 完成）
   - [x] SubscribeCenterPage - 订阅中心（UI 完成）
   - [x] ModelPricingPage - 模型价格（UI 完成）

### 🚧 进行中

1. **API 对接**
   - [ ] LoginPage - 对接登录 API
   - [ ] DashboardPage - 对接仪表板 API
   - [ ] KeysPage - 对接 API Key CRUD

### 📋 待开发

1. **页面扩展**
   - [ ] AccountManagementPage - 账户管理
   - [ ] UsageStatsPage - 使用统计
   - [ ] ApiKeyDetailPage - API Key 详情
   - [ ] AccountBalancePage - 余额查询
   - [ ] WebhookConfigPage - Webhook 配置
   - [ ] SystemSettingsPage - 系统设置
   - [ ] AccountGroupsPage - 账户组管理

2. **功能完善**
   - [ ] 订阅购买流程
   - [ ] 支付对接
   - [ ] 文档内容展示
   - [ ] 系统监控

---

## API 系统

### 多端点自动切换

系统使用多端点自动切换架构（参考 `development-guides/MULTI_API_URL_SYSTEM.md`）：

- **配置层**: `config/api-endpoints.ts` - 定义所有可用端点
- **管理层**: `services/api/ApiManager.ts` - 自动检测和切换端点
- **应用层**: `services/api/client.ts` - 统一 API 客户端

### API 服务模块

所有 API 服务位于 `services/api/` 目录：

- `authService.ts` - 认证相关
- `apiKeyService.ts` - API Key 管理
- `dashboardService.ts` - 仪表板数据
- `usageStatsService.ts` - 使用统计

### 使用方式

```typescript
import { apiManager, authService } from './services/api';

// 初始化 API 管理器（应用启动时）
await apiManager.initialize({ autoDetect: true, timeout: 1000 });

// 使用服务
const result = await authService.login({ username, password });
```

### 数据模型

所有数据模型定义在 `types/models.ts`：
- User, LoginRequest, LoginResponse
- ApiKey, CreateApiKeyRequest, UpdateApiKeyRequest
- Account, ClaudeAccount, GeminiAccount
- UsageStats, DashboardData, SystemMetrics
- WebhookConfig, AccountGroup, AccountBalance

---

## 页面开发清单

### 已实现页面（需 API 对接）

1. **LoginPage** - 登录页面
   - [x] UI 完成
   - [ ] 对接 `POST /admin/login`
   - [ ] Token 管理

2. **DashboardPage** - 仪表板
   - [x] UI 完成
   - [ ] 对接 `GET /admin/dashboard`
   - [ ] 对接 `GET /metrics`

3. **KeysPage** - API Key 管理
   - [x] UI 完成
   - [ ] 对接 `GET /admin/api-keys`
   - [ ] 对接 `POST /admin/api-keys`
   - [ ] 对接 `PUT /admin/api-keys/:id`
   - [ ] 对接 `DELETE /admin/api-keys/:id`

### 待开发页面

参考 `PAGE_DEVELOPMENT_CHECKLIST.md` 获取完整清单。

---

## 开发规范

### 文件结构

```
nexusai-membership-portal/
├── pages/              # 页面组件
├── components/         # 可复用组件
├── services/api/       # API 服务（多文件结构）
├── types/              # TypeScript 类型
│   ├── api.ts         # API 相关类型
│   └── models.ts      # 数据模型
├── config/             # 配置文件
│   └── api-endpoints.ts
├── i18n/              # 国际化
└── App.tsx            # 根组件
```

### 命名规范

- **组件**: PascalCase，如 `DashboardPage.tsx`
- **服务**: camelCase，如 `apiKeyService.ts`
- **类型**: PascalCase，如 `ApiKey`, `User`
- **常量**: UPPER_SNAKE_CASE，如 `API_BASE_URL`

### API 服务规范

1. 所有 API 调用使用 `services/api/` 下的服务模块
2. 使用 `apiClient` 进行 HTTP 请求
3. 统一错误处理
4. 类型安全（使用 TypeScript 类型）

### 代码风格

- 使用 TypeScript，避免 `any`
- 使用函数组件和 Hooks
- 使用 Tailwind CSS，支持暗黑模式
- 所有文本使用国际化（`t.key`）

### 开发流程

1. 阅读 API 文档（`docs/API_OVERVIEW.md`）
2. 定义类型（`types/models.ts`）
3. 创建服务函数（`services/api/`）
4. 在组件中使用服务
5. 实现错误处理和加载状态

---

## 参考文档

- **API 总览**: `docs/API_OVERVIEW.md`
- **API 详细参考**: `docs/API_REFERENCE_DETAILED.md`
- **完整端点索引**: `docs/API_COMPLETE_ENDPOINT_INDEX.md`
- **页面开发清单**: `docs/PAGE_DEVELOPMENT_CHECKLIST.md`
- **多端点系统**: `development-guides/MULTI_API_URL_SYSTEM.md`

---

**文档维护**: 开发团队  
**最后更新**: 2026-01-08
