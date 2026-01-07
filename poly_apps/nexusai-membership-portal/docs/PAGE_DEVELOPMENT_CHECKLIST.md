# 页面开发清单

> 基于 API 文档的页面开发任务清单

**最后更新**: 2026-01-08  
**API 中心状态**: ✅ 已完成（多文件结构）

---

## 📋 已实现页面（需要扩展）

### 1. LoginPage ✅
- [x] 基础登录表单
- [x] 公告中心展示
- [x] 顶部导航栏
- [x] 主题/语言切换
- [ ] **对接登录 API** (`POST /admin/login` 或 `POST /users/login`)
- [ ] Token 存储和管理
- [ ] 错误处理
- [ ] 记住我功能

### 2. DashboardPage ✅
- [x] 基础布局和样式
- [x] 静态数据展示
- [ ] **对接仪表板 API** (`GET /admin/dashboard`)
- [ ] 实时数据更新
- [ ] 使用趋势图表数据对接
- [ ] 错误处理和加载状态

### 3. KeysPage ✅
- [x] API Key 列表展示
- [ ] **对接 API Key API** (`GET /admin/api-keys`)
- [ ] **创建 API Key 功能** (`POST /admin/api-keys`)
  - [ ] 基本信息表单
  - [ ] 权限配置
  - [ ] 速率限制设置
  - [ ] 并发限制设置
  - [ ] 客户端限制
  - [ ] 模型黑名单
  - [ ] 过期时间设置
- [ ] **编辑 API Key** (`PUT /admin/api-keys/:id`)
- [ ] **删除 API Key** (`DELETE /admin/api-keys/:id`)
- [ ] 查看使用详情
- [ ] 搜索和筛选
- [ ] 分页功能

### 4. MembershipPage ✅
- [x] 订阅计划展示
- [ ] 订阅计划 API 对接
- [ ] 订阅购买流程
- [ ] 支付对接
- [ ] 当前订阅状态

### 5. DocsPage ✅
- [x] 文档列表
- [ ] 文档内容展示（Markdown）
- [ ] 文档搜索
- [ ] 文档分类导航

### 6. SettingsPage ✅
- [x] 基础框架
- [ ] 用户资料设置
- [ ] 偏好设置扩展
- [ ] 通知设置
- [ ] 安全设置

### 7. SubscribeCenterPage ✅
- [x] 基础页面
- [ ] 订阅计划列表 API
- [ ] 计划对比
- [ ] 购买流程
- [ ] 支付集成

### 8. ModelPricingPage ✅
- [x] 价格表格
- [ ] 动态价格数据
- [ ] 价格更新历史
- [ ] 价格计算器

---

## 🆕 需要新开发的页面

### 用户端页面

#### 1. AccountManagementPage 🆕
**路由**: `/accounts`  
**功能**:
- [ ] 多平台账户列表展示
- [ ] 账户状态监控
- [ ] 添加账户（OAuth 流程）
  - [ ] Claude 账户 OAuth
  - [ ] Gemini 账户 OAuth
  - [ ] OpenAI 账户（API Key）
  - [ ] AWS Bedrock 账户
  - [ ] Azure OpenAI 账户
  - [ ] Droid 账户
  - [ ] CCR 账户
- [ ] 账户编辑
- [ ] 账户删除
- [ ] 代理配置
- [ ] Token 刷新

**API 端点**:
- `GET /admin/claude-accounts`
- `POST /admin/claude-accounts/generate-auth-url`
- `POST /admin/claude-accounts/exchange-code`
- `PUT /admin/claude-accounts/:id`
- `DELETE /admin/claude-accounts/:id`
- 其他平台类似端点

**优先级**: P1

---

#### 2. UsageStatsPage 🆕
**路由**: `/usage-stats`  
**功能**:
- [ ] 使用统计概览
- [ ] 按模型统计
- [ ] 按 API Key 统计
- [ ] 按账户统计
- [ ] 按时间统计（日/周/月）
- [ ] 成本分析图表
- [ ] 数据导出

**API 端点**:
- `GET /admin/usage-stats/overview`
- `GET /admin/usage-stats/models`
- `GET /admin/usage-stats/keys`
- `GET /admin/usage-stats/accounts`
- `GET /admin/usage-stats/daily`

**优先级**: P1

---

#### 3. ApiKeyDetailPage 🆕
**路由**: `/keys/:id`  
**功能**:
- [ ] API Key 详情展示
- [ ] 使用统计详情
- [ ] Token 使用明细
- [ ] 成本统计
- [ ] 按模型统计
- [ ] 按时间统计
- [ ] 重置使用统计

**API 端点**:
- `GET /admin/api-keys/:id`
- `GET /admin/api-keys/:id/usage`
- `POST /admin/api-keys/:id/reset-usage`

**优先级**: P0

---

#### 4. AccountBalancePage 🆕
**路由**: `/account-balance`  
**功能**:
- [ ] 账户余额查询
- [ ] 多平台余额展示
- [ ] 余额历史记录

**API 端点**:
- `POST /admin/account-balance/query`

**优先级**: P2

---

#### 5. WebhookConfigPage 🆕
**路由**: `/webhooks`  
**功能**:
- [ ] Webhook 配置列表
- [ ] 创建 Webhook
- [ ] 编辑 Webhook
- [ ] 删除 Webhook
- [ ] 事件类型配置
- [ ] Webhook 测试

**API 端点**:
- `GET /admin/webhook/configs`
- `POST /admin/webhook/configs`
- `PUT /admin/webhook/configs/:id`
- `DELETE /admin/webhook/configs/:id`

**优先级**: P2

---

#### 6. SystemSettingsPage 🆕
**路由**: `/system-settings`  
**功能**:
- [ ] 系统信息展示
- [ ] 系统参数配置
- [ ] 缓存管理
- [ ] 日志查看

**API 端点**:
- `GET /admin/system/info`
- `POST /admin/system/clear-cache`
- `GET /admin/logs`

**优先级**: P2

---

#### 7. AccountGroupsPage 🆕
**路由**: `/account-groups`  
**功能**:
- [ ] 账户组列表
- [ ] 创建账户组
- [ ] 编辑账户组
- [ ] 删除账户组
- [ ] 账户分组管理

**API 端点**:
- `GET /admin/account-groups`
- `POST /admin/account-groups`
- `PUT /admin/account-groups/:id`
- `DELETE /admin/account-groups/:id`

**优先级**: P2

---

### 管理端页面（可选）

#### 8. AdminDashboardPage 🆕
**路由**: `/admin/dashboard`  
**功能**:
- [ ] 系统概览（账户数、API Key 数、使用量）
- [ ] 实时监控（内存、uptime、缓存命中率）
- [ ] 使用趋势图表
- [ ] 成本分析

**API 端点**:
- `GET /admin/dashboard`
- `GET /metrics`

**优先级**: P1

---

#### 9. UserManagementPage 🆕
**路由**: `/admin/users`  
**功能**:
- [ ] 用户列表
- [ ] 用户详情
- [ ] 用户 API Key 管理

**API 端点**:
- `GET /users` (如果支持)
- `GET /users/:id`
- `GET /users/:id/api-keys`

**优先级**: P2

---

## 📊 开发优先级总结

### P0 - 高优先级（核心功能）
1. ✅ LoginPage - API 对接
2. ✅ KeysPage - 完整 CRUD 功能
3. 🆕 ApiKeyDetailPage - API Key 详情

### P1 - 中优先级（重要功能）
1. ✅ DashboardPage - API 对接
2. 🆕 AccountManagementPage - 账户管理
3. 🆕 UsageStatsPage - 使用统计
4. 🆕 AdminDashboardPage - 管理仪表板

### P2 - 低优先级（辅助功能）
1. ✅ MembershipPage - 订阅购买
2. ✅ SubscribeCenterPage - 订阅中心
3. ✅ ModelPricingPage - 动态价格
4. ✅ DocsPage - 文档内容
5. ✅ SettingsPage - 完整设置
6. 🆕 AccountBalancePage - 余额查询
7. 🆕 WebhookConfigPage - Webhook 配置
8. 🆕 SystemSettingsPage - 系统设置
9. 🆕 AccountGroupsPage - 账户组管理
10. 🆕 UserManagementPage - 用户管理

---

## 📝 开发建议

1. **先实现 P0 功能**，确保核心功能可用
2. **逐步扩展 P1 功能**，完善用户体验
3. **最后实现 P2 功能**，提供完整功能集

4. **每个页面开发时**:
   - 先实现基础布局和样式
   - 再对接 API
   - 最后优化用户体验

5. **API 对接时**:
   - 先定义 TypeScript 类型
   - 创建服务函数
   - 在组件中使用
   - 实现错误处理

---

**参考文档**: `DEVELOPMENT_GUIDE.md`

