# Claude Relay Service - 完整 API 端点索引

> 系统化 API 端点总览 - 所有功能模块完整清单

**文档版本**: 2.0
**最后更新**: 2026-01-02
**总端点数**: ~598 个
**覆盖率**: 163% (原估计 366 个端点)

---

## 📊 端点统计总览

| 扫描批次 | 发现端点数 | 累计端点数 | 主要模块 |
|---------|-----------|-----------|---------|
| **扫描 1-4** | ~230 | 230 | 基础 API、账户管理、转发服务 |
| **扫描 5** | +30 | 260 | 系统管理、日志、翻译 |
| **扫描 6** | +14 | 274 | 订阅支付、Web 认证、API 统计 |
| **扫描 7** | +27 | 301 | 用户管理、短信、LDAP、Droid |
| **扫描 8** | +107 | 408 | WebSocket 客户端、Webhook、多平台路由 |
| **扫描 9** | +37 | 445 | 并发管理、VPN、余额、脚本、分组 |
| **扫描 10** | +153 | **~598** | 核心 API、账户管理、配置、订阅 |

---

## 🗂️ 功能模块分类

### 1. 核心 API 转发服务 (15 端点)

#### 1.1 Claude Messages API (api.js)
- `POST /v1/messages` - 消息处理 (流式/非流式)
- `POST /claude/v1/messages` - Claude 消息处理 (别名路由)
- `POST /v1/messages/count_tokens` - Token 计数 (Beta API)
- `POST /api/event_logging/batch` - 遥测端点 (Claude Code)
- `GET /v1/models` - 模型列表 (支持 antigravity)
- `GET /v1/key-info` - API Key 信息
- `GET /v1/usage` - 使用统计查询
- `GET /v1/me` - 用户信息 (Claude Code 客户端)
- `GET /v1/organizations/:org_id/usage` - 组织使用统计
- `GET /health` - 健康检查

**关键特性**:
- **Old Session Detection**: 自动检测污染会话 (多条消息、无 tools 的单消息)
- **Concurrent Retry Logic**: CONSOLE_ACCOUNT_CONCURRENCY_FULL 自动重试
- **Warmup Interception**: 拦截 warmup 请求并返回模拟响应
- **Global Session Binding**: 全局会话绑定验证
- **流式响应**: SSE 实时传输，客户端断开自动清理

#### 1.2 Gemini API (geminiRoutes.js + standardGeminiRoutes.js)
**标准路由** (14 端点):
- `POST /v1beta/models/:modelName:generateContent`
- `POST /v1beta/models/:modelName:streamGenerateContent`
- `POST /v1beta/models/:modelName:countTokens`
- `POST /v1beta/models/:modelName:loadCodeAssist`
- `POST /v1beta/models/:modelName:onboardUser`
- `POST /v1/models/:modelName:generateContent`
- `POST /v1/models/:modelName:streamGenerateContent`
- `POST /v1/models/:modelName:countTokens`
- `POST /v1internal:generateContent`
- `POST /v1internal:streamGenerateContent`
- `POST /v1internal:countTokens`
- `POST /v1internal:loadCodeAssist`
- `POST /v1internal:onboardUser`
- `GET /v1beta/models`, `GET /v1/models`, `GET /v1beta/models/:modelName`, `GET /v1/models/:modelName`

**兼容路由** (6 端点):
- `POST /gemini/v1/models/:model:generateContent`
- `POST /gemini/v1/models/:model:streamGenerateContent`
- `GET /gemini/v1/models`
- 其他兼容路由

#### 1.3 Azure OpenAI API (azureOpenaiRoutes.js) (6 端点)
- `GET /health` - 健康检查
- `GET /models` - 模型列表
- `POST /chat/completions` - 聊天完成
- `POST /responses` - Responses 端点 (gpt-5, codex-mini)
- `POST /embeddings` - Embeddings
- `GET /usage` - 使用统计

**支持模型**: gpt-4o, gpt-5, gpt-5-mini, gpt-35-turbo, codex-mini, text-embedding-ada-002

#### 1.4 OpenAI 格式转换 API

**OpenAI → Claude** (openaiClaudeRoutes.js) (4 端点):
- `GET /v1/models` - 模型列表 (只返回 opus-4 和 sonnet-4)
- `GET /v1/models/:model` - 模型详情
- `POST /v1/chat/completions` - 聊天完成 (OpenAI → Claude)
- `POST /v1/completions` - 传统 completions

**OpenAI → Gemini** (openaiGeminiRoutes.js) (3 端点):
- `POST /v1/chat/completions` - 聊天完成 (OpenAI → Gemini)
- `GET /v1/models` - Gemini 模型列表
- `GET /v1/models/:model` - 模型详情

**OpenAI Official Proxy** (openaiOfficialRoutes.js) (2 端点):
- `POST /v1/chat/completions` - 直接透传 OpenAI 官方 API
- `POST /v1/completions` - Completions 透传

#### 1.5 Droid (Factory.ai) API (droidRoutes.js) (5 端点)
- `POST /droid/claude/v1/messages` - Droid Claude 转发
- `POST /droid/comm/v1/chat/completions` - Droid Comm 转发
- `POST /droid/openai/v1/responses` - Droid OpenAI 转发
- `POST /droid/openai/responses` - Droid OpenAI 转发 (别名)
- `GET /droid/*/v1/models` - Droid 模型列表

---

### 2. 账户管理 (Admin) (~120 端点)

#### 2.1 Claude 账户管理 (admin/claudeAccounts.js) (~20 端点)

**OAuth 授权流程**:
- `POST /admin/claude-accounts/generate-auth-url` - 生成 OAuth 授权 URL
- `POST /admin/claude-accounts/exchange-code` - 交换授权码
- `POST /admin/claude-accounts/oauth-with-cookie` - Cookie OAuth 自动授权
- `POST /admin/claude-accounts/generate-setup-token-url` - 生成 Setup Token URL
- `POST /admin/claude-accounts/exchange-setup-token-code` - 交换 Setup Token
- `POST /admin/claude-accounts/setup-token-with-cookie` - Cookie Setup Token 授权

**账户 CRUD**:
- `GET /admin/claude-accounts` - 列出账户
- `POST /admin/claude-accounts` - 创建账户
- `PUT /admin/claude-accounts/:id` - 更新账户
- `DELETE /admin/claude-accounts/:id` - 删除账户
- `PUT /admin/claude-accounts/:id/toggle-schedulable` - 切换可调度
- `POST /admin/claude-accounts/:id/reset-status` - 重置状态

**账户操作**:
- `POST /admin/claude-accounts/:id/refresh` - 刷新 Token
- `POST /admin/claude-accounts/:id/test` - 测试账户 (流式)
- `POST /admin/claude-accounts/:id/test-sync` - 测试账户 (同步)
- `POST /admin/claude-accounts/:id/update-profile` - 更新资料
- `POST /admin/claude-accounts/update-all-profiles` - 批量更新资料

**测试管理**:
- `GET /admin/claude-accounts/:id/test-config` - 获取测试配置
- `PUT /admin/claude-accounts/:id/test-config` - 更新测试配置
- `GET /admin/claude-accounts/:id/test-history` - 获取测试历史
- `POST /admin/claude-accounts/batch-test-history` - 批量测试历史

**使用统计**:
- `GET /admin/claude-accounts/usage` - OAuth 账户使用量

#### 2.2 Claude Console 账户管理 (admin/claudeConsoleAccounts.js) (~12 端点)
- CRUD 操作 (GET, POST, PUT, DELETE)
- Toggle 操作 (toggle, toggle-schedulable, reset-status)
- 使用管理 (`GET /:id/usage`, `GET /:id/usage-history`)
- 测试操作 (`POST /:id/test`, `POST /:id/test-sync`)
- 配额重置 (`POST /:id/reset-usage`)

#### 2.3 Gemini OAuth 账户管理 (admin/geminiAccounts.js) (~10 端点)
- OAuth 流程 (generate-auth-url, exchange-code)
- CRUD 操作
- Toggle 操作
- 速率限制重置 (`POST /:id/reset-rate-limit`)
- 账户资料更新

#### 2.4 Gemini API 账户管理 (admin/geminiApiAccounts.js) (9 端点)
- `GET /admin/gemini-api-accounts` - 列出账户
- `POST /admin/gemini-api-accounts` - 创建账户
- `GET /admin/gemini-api-accounts/:id` - 获取账户
- `PUT /admin/gemini-api-accounts/:id` - 更新账户
- `DELETE /admin/gemini-api-accounts/:id` - 删除账户
- `PUT /admin/gemini-api-accounts/:id/toggle-schedulable` - 切换可调度
- `PUT /admin/gemini-api-accounts/:id/toggle` - 切换激活
- `POST /admin/gemini-api-accounts/:id/reset-rate-limit` - 重置速率限制
- `POST /admin/gemini-api-accounts/:id/reset-status` - 重置状态

**特性**: API Key 存储、多分组支持、速率限制管理

#### 2.5 OpenAI OAuth 账户管理 (admin/openaiAccounts.js) (~12 端点)
- OAuth 流程 (generate-auth-url, exchange-code)
- CRUD 操作
- Token 刷新 (`POST /:id/refresh`)
- Token 验证 (`POST /:id/validate-refresh`)
- Toggle 操作

#### 2.6 OpenAI Responses 账户管理 (admin/openaiResponsesAccounts.js) (~10 端点)
- CRUD 操作
- Toggle 操作
- 配额管理 (`POST /:id/reset-quota`)
- 自动恢复配置 (`GET /auto-recovery-configs`, `PUT /auto-recovery-configs`)

#### 2.7 AWS Bedrock 账户管理 (admin/bedrockAccounts.js) (~8 端点)
- CRUD 操作
- Toggle 操作
- 健康检查 (`POST /:id/health-check`, `POST /batch-health-check`)

**凭据类型**: default, access_key, bearer_token

#### 2.8 Azure OpenAI 账户管理 (admin/azureOpenaiAccounts.js) (~10 端点)
- CRUD 操作
- Toggle 操作
- 健康检查 (`POST /:id/health-check`, `POST /batch-health-check`)
- 数据迁移 (`GET /migrate-from-openai-accounts`)

#### 2.9 Droid 账户管理 (admin/droidAccounts.js) (~10 端点)
- Device Code 授权 (`POST /generate-auth-url`, `POST /exchange-code`)
- CRUD 操作
- Token 刷新 (`POST /:id/refresh`)
- Toggle 操作

#### 2.10 CCR 账户管理 (admin/ccrAccounts.js) (~12 端点)
- CRUD 操作
- Toggle 操作
- 使用管理 (`GET /:id/usage`, `GET /:id/usage-history`)
- 配额重置 (`POST /:id/reset-usage`)

---

### 3. API Keys 管理 (10+ 端点)

**Admin 管理** (admin/apiKeys.js):
- `GET /admin/api-keys` - 列出所有 API Keys
- `POST /admin/api-keys` - 创建 API Key
- `GET /admin/api-keys/:id` - 获取 API Key
- `PUT /admin/api-keys/:id` - 更新 API Key
- `DELETE /admin/api-keys/:id` - 删除 API Key (软删除)
- `PUT /admin/api-keys/:id/toggle` - 切换激活状态
- `POST /admin/api-keys/batch-create` - 批量创建
- `DELETE /admin/api-keys/batch-delete` - 批量删除

**用户自管理** (userRoutes.js):
- `GET /users/api-keys` - 获取用户 API Keys
- `POST /users/api-keys` - 创建用户 API Key
- `DELETE /users/api-keys/:keyId` - 删除用户 API Key

**配置选项**:
- `tokenLimit`: Token 限制
- `rateLimits`: 速率限制配置
- `servicePermissions`: 服务权限 (all/claude/gemini/openai/droid)
- `allowedClients`: 允许的客户端列表
- `modelBlacklist`: 模型黑名单
- `concurrentRequestLimit`: 并发请求限制
- `concurrentRequestQueueEnabled`: 并发排队开关
- `dailyCostLimit` / `totalCostLimit`: 成本限制

---

### 4. 用户管理系统 (23 端点)

#### 4.1 用户认证 (userRoutes.js) (4 端点)
- `POST /users/register` - 用户注册
- `POST /users/login` - 用户登录 (支持 LDAP)
- `POST /users/password/reset-request` - 请求密码重置
- `POST /users/password/reset` - 重置密码

**安全特性**:
- 双层速率限制 (30/15分钟 + 100/小时)
- LDAP 集成认证
- 登录日志记录

#### 4.2 用户资料和 API Keys (5 端点)
- `POST /users/logout` - 用户登出
- `GET /users/profile` - 获取用户资料
- `GET /users/api-keys` - 获取用户 API Keys
- `POST /users/api-keys` - 创建用户 API Key
- `DELETE /users/api-keys/:keyId` - 删除用户 API Key

#### 4.3 使用统计 (1 端点)
- `GET /users/usage-stats` - 获取用户使用统计

#### 4.4 管理员用户管理 (7 端点)
- `GET /users` - 获取用户列表 (分页、搜索、筛选)
- `GET /users/:userId` - 获取特定用户信息
- `PATCH /users/:userId/status` - 更新用户状态
- `PATCH /users/:userId/role` - 更新用户角色
- `POST /users/:userId/disable-keys` - 禁用用户所有 API Keys
- `GET /users/:userId/usage-stats` - 获取用户使用统计
- `GET /users/stats/overview` - 获取用户管理统计概览

#### 4.5 LDAP 集成 (1 端点)
- `GET /users/admin/ldap-test` - 测试 LDAP 连接

#### 4.6 短信通知管理 (6 端点)
- `GET /users/sms/config` - 获取用户短信配置
- `POST /users/sms/send-code` - 发送验证码
- `POST /users/sms/bind-phone` - 绑定手机号
- `POST /users/sms/unbind-phone` - 解绑手机号
- `PUT /users/sms/preferences` - 更新短信通知偏好
- `GET /users/sms/logs` - 获取短信发送记录
- `GET /users/sms/rate-limit` - 获取发送频率限制状态

**速率限制**: 1/分钟, 5/小时, 10/天

---

### 5. WebSocket 客户端管理 (~70 端点)

#### 5.1 客户端基础管理 (admin/clients.js) (8 端点)
- `GET /admin/supported-clients` - 获取支持的客户端类型
- `GET /admin/clients` - 获取客户端列表
- `POST /admin/clients` - 创建客户端
- `GET /admin/clients/:id` - 获取客户端详情
- `PUT /admin/clients/:id` - 更新客户端
- `PUT /admin/clients/:id/toggle-schedulable` - 切换可调度
- `DELETE /admin/clients/:id` - 删除客户端
- `POST /admin/clients/:id/disconnect` - 断开连接

#### 5.2 客户端配置管理 (4 端点)
- `POST /admin/clients/:clientId/config` - 下发配置
- `GET /admin/clients/:clientId/config` - 获取配置
- `GET /admin/clients/:clientId/config/history` - 配置历史
- `GET /admin/clients/:clientId/system-health` - 系统健康

#### 5.3 客户端账户管理 (3 端点)
- `GET /admin/clients/:clientId/accounts` - 获取所有账户
- `POST /admin/clients/:clientId/accounts` - 账户操作 (add/update/delete/toggle)
- 其他账户相关端点

#### 5.4 客户端 OAuth 流程 (2 端点)
- `POST /admin/clients/:clientId/generate-oauth-url` - 生成 OAuth URL
- `POST /admin/clients/:clientId/exchange-oauth-code` - 交换授权码

#### 5.5 动态账户类型路由 (~60 端点)
**支持的账户类型** (10 种):
- claude-accounts, claude-console-accounts, gemini-accounts, openai-accounts
- bedrock-accounts, azure-openai-accounts, openai-responses-accounts
- droid-accounts, gemini-api-accounts, ccr-accounts

**通用路由模式** (每种账户类型 ~6 个操作):
- `GET /admin/clients/:clientId/:segment` - 列出账户
- `POST /admin/clients/:clientId/:segment` - 创建账户
- `PUT /admin/clients/:clientId/:segment/:accountId` - 更新账户
- `DELETE /admin/clients/:clientId/:segment/:accountId` - 删除账户
- `PUT /admin/clients/:clientId/:segment/:accountId/toggle` - 切换启用
- `PUT /admin/clients/:clientId/:segment/:accountId/toggle-schedulable` - 切换可调度

**特定平台扩展**:
- Claude 账户刷新 (`POST /:clientId/claude-accounts/:accountId/refresh`)
- 授权 URL 生成 (`POST /:clientId/:segment/generate-auth-url`)
- 授权码交换 (`POST /:clientId/:segment/exchange-code`)

---

### 6. 使用统计和监控 (25+ 端点)

#### 6.1 全局统计 (admin/usageStats.js) (10 端点)
- `GET /admin/accounts/usage-stats` - 所有账户使用统计
- `GET /admin/accounts/:accountId/usage-stats` - 单账户使用统计
- `GET /admin/accounts/:accountId/usage-history` - 账户 30 天历史
- `GET /admin/usage-trend` - 使用趋势 (hourly/daily)
- `GET /admin/api-keys/:keyId/model-stats` - API Key 模型统计
- `GET /admin/account-usage-trend` - 账户使用趋势 (按平台)
- `GET /admin/api-keys-usage-trend` - API Keys 使用趋势
- `GET /admin/usage-costs` - 总使用成本
- `GET /admin/api-keys/:keyId/usage-records` - API Key 使用记录
- `GET /admin/accounts/:accountId/usage-records` - 账户使用记录

#### 6.2 API 统计查询 (apiStats.js) (4 端点)
- `POST /apiStats/api/batch-stats` - 批量统计查询 (最多 30 个 Keys)
- `POST /apiStats/api/batch-model-stats` - 批量模型统计
- `POST /apiStats/api-key/test` - API Key 端点测试 (流式)
- `POST /apiStats/api/user-model-stats` - 用户模型统计查询

#### 6.3 Dashboard 统计 (admin/dashboard.js) (3 端点)
- `GET /admin/dashboard` - 系统概览
- `GET /admin/usage-stats` - 使用统计
- `GET /admin/model-stats` - 按模型统计

**Dashboard 数据**:
- 账户统计 (总数、正常、异常、暂停、限流)
- 使用量统计 (总请求数、总 Tokens、按模型统计)
- 实时指标 (RPM、TPM、窗口分钟数)
- 系统健康 (Redis 连接、账户健康、Uptime)

---

### 7. 并发和排队管理 (8 端点)

#### 7.1 并发状态管理 (admin/concurrency.js)
- `GET /admin/concurrency` - 获取所有并发状态
- `GET /admin/concurrency/:apiKeyId` - 获取特定 Key 并发状态
- `DELETE /admin/concurrency/:apiKeyId` - 强制清理特定 Key 并发
- `DELETE /admin/concurrency` - 强制清理所有并发
- `POST /admin/concurrency/cleanup` - 清理过期并发条目

#### 7.2 并发排队统计
- `GET /admin/concurrency-queue/stats` - 获取排队统计
- `DELETE /admin/concurrency-queue/:apiKeyId` - 清理特定 Key 排队
- `DELETE /admin/concurrency-queue` - 清理所有排队

**排队统计指标**:
- `entered/success/timeout/cancelled/socket_changed/rejected_overload`
- 等待时间百分位数 (P50/P90/P99)
- 健康检查机制 (P90 阈值检测)

---

### 8. 系统管理和配置 (30+ 端点)

#### 8.1 系统配置 (admin/system.js) (9 端点)
- `GET /admin/claude-code-headers` - 获取所有 Claude Code 请求头
- `DELETE /admin/claude-code-headers/:accountId` - 清除账户请求头
- `GET /admin/check-updates` - 检查 GitHub 更新 (带缓存)
- `GET /admin/runtime-info` - 运行时模式和 WebSocket/VPN 状态
- `GET /admin/oem-settings` - 获取 OEM 设置 (公开，无需认证)
- `PUT /admin/oem-settings` - 更新 OEM 设置
- `GET /admin/claude-code-version` - 获取统一 Claude Code User-Agent
- `POST /admin/claude-code-version/clear` - 清除 User-Agent 缓存
- `GET /admin/public-stats` - 公开统计概览 (无需认证)

#### 8.2 Claude Relay 配置 (admin/claudeRelayConfig.js) (3 端点)
- `GET /admin/claude-relay-config` - 获取转发配置
- `PUT /admin/claude-relay-config` - 更新转发配置
- `GET /admin/claude-relay-config/session-bindings` - 获取会话绑定统计

**配置项** (10+ 设置):
- `claudeCodeOnlyEnabled`: 仅 Claude Code 客户端
- `globalSessionBindingEnabled`: 全局会话绑定
- `sessionBindingErrorMessage`: 绑定错误消息
- `sessionBindingTtlDays`: 绑定 TTL (1-365 天)
- `userMessageQueueEnabled`: 用户消息队列
- `userMessageQueueDelayMs`: 队列延迟 (0-10000ms)
- `userMessageQueueTimeoutMs`: 队列超时 (1000-300000ms)
- `concurrentRequestQueueEnabled`: 并发请求排队
- `concurrentRequestQueueMaxSize`: 最大排队数 (1-100)
- `concurrentRequestQueueMaxSizeMultiplier`: 排队数倍数 (0-10)
- `concurrentRequestQueueTimeoutMs`: 排队超时 (5000-300000ms)

#### 8.3 日志和监控 (admin.js - Scan 5) (10 端点)
- 日志管理 (GET logs, GET logs/stream, POST logs/clear, GET logs/search)
- 系统指标 (GET metrics, GET health, GET components-health)
- 翻译服务 (POST translate)
- 静态文件服务

#### 8.4 数据导出 (admin/sync.js) (1 端点)
- `GET /admin/sync/export-accounts?include_secrets=true` - 导出账户数据 (含敏感信息)

**支持账户类型**:
- Claude OAuth, Claude Console, OpenAI OAuth, OpenAI Responses

**安全警告**: 导出数据包含未加密敏感信息 (OAuth Token、API Key、代理凭据)

---

### 9. Webhook 通知管理 (8 端点)

#### 9.1 Webhook 配置 (webhook.js)
- `GET /webhook/config` - 获取 Webhook 配置
- `POST /webhook/config` - 保存 Webhook 配置
- `POST /webhook/platforms` - 添加 Webhook 平台
- `PUT /webhook/platforms/:id` - 更新 Webhook 平台
- `DELETE /webhook/platforms/:id` - 删除 Webhook 平台
- `POST /webhook/platforms/:id/toggle` - 切换 Webhook 平台状态
- `POST /webhook/test` - 测试 Webhook 连通性
- `POST /webhook/test-notification` - 手动触发测试通知

**支持平台**:
- Slack, Discord, Bark, SMTP, Telegram, Custom

**支持事件**:
- apiKeyCreated, apiKeyDeleted, accountError, accountBlocked
- tokenRefreshFailed, costAlert, rateLimitExceeded, paymentSuccess/Failed

---

### 10. VPN 隧道管理 (7 端点)

**前提条件**: `VPN_SERVER_ENABLED=true`

- `GET /admin/vpn/tunnels` - 列出所有隧道
- `POST /admin/vpn/tunnels` - 创建隧道
- `PATCH /admin/vpn/tunnels/:id` - 更新隧道
- `DELETE /admin/vpn/tunnels/:id` - 删除隧道
- `POST /admin/vpn/tunnels/purge` - 清理过期隧道
- `GET /admin/vpn/tunnels/:id/sessions` - 查询隧道活跃会话
- `GET /admin/vpn/tunnels/:id/events` - 查询隧道事件

---

### 11. 账户余额管理 (9 端点)

**前提条件**: 配置支持余额查询的账户平台

- `GET /admin/accounts/:accountId/balance` - 获取账户余额
- `POST /admin/accounts/:accountId/balance/refresh` - 刷新账户余额
- `GET /admin/accounts/balance/platform/:platform` - 获取平台所有账户余额
- `GET /admin/accounts/balance/summary` - 获取余额汇总
- `DELETE /admin/accounts/:accountId/balance/cache` - 清除余额缓存
- `GET /admin/accounts/:accountId/balance/script` - 获取余额脚本配置
- `PUT /admin/accounts/:accountId/balance/script` - 保存余额脚本配置
- `POST /admin/accounts/:accountId/balance/script/test` - 测试余额脚本

**余额脚本管理** (4 端点):
- `GET /admin/balance-scripts` - 获取所有脚本配置
- `GET /admin/balance-scripts/:name` - 获取特定脚本配置
- `PUT /admin/balance-scripts/:name` - 保存脚本配置
- `POST /admin/balance-scripts/:name/test` - 测试脚本

**安全限制**: `BALANCE_SCRIPT_ENABLED=true`, 沙箱环境, 超时限制

---

### 12. 账户分组管理 (6 端点)

- `POST /admin/account-groups` - 创建账户分组
- `GET /admin/account-groups` - 获取所有分组
- `GET /admin/account-groups/:groupId` - 获取分组详情
- `PUT /admin/account-groups/:groupId` - 更新分组
- `DELETE /admin/account-groups/:groupId` - 删除分组
- `GET /admin/account-groups/:groupId/members` - 获取分组成员

**跨平台兼容性**:
- 优先按分组平台查找账户
- 兼容旧数据 (未找到则尝试其他平台)
- 自动聚合 Claude 官方账户和 Claude Console 账户

---

### 13. 订阅支付管理 (16 端点)

#### 13.1 用户端订阅 (subscriptionRoutes.js) (4 端点)
- `GET /subscriptions/plans` - 获取套餐列表 (公开)
- `GET /subscriptions/orders/:orderId` - 查询订单详情
- `POST /subscriptions/orders/:orderId/refund` - 退款订单
- `GET /subscriptions/orders` - 获取用户订单列表

#### 13.2 管理员订阅管理 (admin/subscriptions.js) (12 端点)

**Plans 管理**:
- `GET /admin/subscriptions/plans` - 列出所有套餐
- `POST /admin/subscriptions/plans` - 添加新套餐
- `PUT /admin/subscriptions/plans/:planId` - 更新套餐
- `DELETE /admin/subscriptions/plans/:planId` - 删除套餐

**Orders 管理**:
- `GET /admin/subscriptions/orders` - 列出订单 (支持 userId/status 筛选)
- `GET /admin/subscriptions/orders/:orderId` - 获取订单详情
- `POST /admin/subscriptions/orders/:orderId/refund` - 退款订单 (Alipay/WeChat)

**Subscriptions 管理**:
- `GET /admin/subscriptions` - 列出订阅
- `GET /admin/subscriptions/:subscriptionId` - 获取订阅
- `PUT /admin/subscriptions/:subscriptionId` - 更新订阅

**订单状态**: pending → paid → refunded/cancelled/expired

**支付平台**: Alipay (支付宝), WeChat Pay (微信支付)

---

### 14. Web 认证管理 (6 端点)

- `GET /web/runtime-info` - 运行时信息 (公开)
- `POST /web/auth/login` - 管理员登录
- `POST /web/auth/logout` - 管理员登出
- `POST /web/auth/change-password` - 修改管理员密码
- `GET /web/auth/user` - 获取当前用户信息
- `POST /web/auth/refresh` - 刷新会话令牌

**安全特性**:
- bcrypt 密码哈希
- 会话完整性验证 (username + loginTime)
- 空对象会话检测
- 数据源: data/init.json (唯一真实来源)

---

## 🔑 关键技术特性

### 1. OAuth 认证流程
- **PKCE Flow**: OAuth 2.0 PKCE 实现 (code_verifier/code_challenge)
- **Cookie OAuth**: 自动化 OAuth 流程 (sessionKey)
- **Setup Token**: Claude Code setup token 授权
- **Device Code**: WorkOS 设备授权 (Droid)

### 2. Session 管理
- **Old Session Detection**: 多条消息、无 tools 的单消息、Warmup 请求检测
- **Concurrent Retry**: CONSOLE_ACCOUNT_CONCURRENCY_FULL 自动重试
- **Global Session Binding**: 全局会话绑定验证
- **Sticky Sessions**: 会话级账户绑定 (TTL + 自动续期)

### 3. 并发控制
- **Concurrent Request Queue**: 超限排队 (而非直接 429)
- **指数退避**: 初始 200ms, 最大 2s, ±20% 抖动
- **Socket 身份验证**: UUID token + socket 引用双重验证
- **健康检查**: P90 等待时间阈值快速失败

### 4. 成本追踪
- **Model Normalization**: Bedrock 区域模型规范化
- **Usage Statistics**: input/output/cache_create/cache_read tokens
- **Cost Calculation**: 模型级成本计算 (pricingService)
- **Timeline Records**: 30 天分页使用记录

### 5. 账户管理
- **Multi-Account Types**: 8 种账户类型支持
- **Account Groups**: 多分组支持 (平台级分组)
- **Account Types**: shared/dedicated/group 分类
- **Priority Validation**: 1-100 优先级验证

### 6. 高级功能
- **OEM 定制**: 站点名称、图标、管理按钮、公开统计
- **Claude Code Headers**: 账户级版本跟踪、统一 User-Agent
- **Health Checks**: Azure OpenAI / Bedrock 健康监控
- **Webhook 通知**: 账户异常、成本告警、速率限制
- **Balance Scripts**: JavaScript 沙箱脚本查询余额

---

## 📋 完整路由文件清单 (41 个)

### Admin 路由 (26 个文件)
1. ✅ admin/accountBalance.js - 账户余额管理 (9 端点)
2. ✅ admin/accountGroups.js - 账户分组管理 (6 端点)
3. ✅ admin/apiKeys.js - API Keys 管理 (8+ 端点)
4. ✅ admin/azureOpenaiAccounts.js - Azure OpenAI 账户 (~10 端点)
5. ✅ admin/balanceScripts.js - 余额脚本管理 (4 端点)
6. ✅ admin/bedrockAccounts.js - Bedrock 账户 (~8 端点)
7. ✅ admin/ccrAccounts.js - CCR 账户 (~12 端点)
8. ✅ admin/claudeAccounts.js - Claude OAuth 账户 (~20 端点)
9. ✅ admin/claudeConsoleAccounts.js - Claude Console 账户 (~12 端点)
10. ✅ admin/claudeRelayConfig.js - Claude Relay 配置 (3 端点)
11. ✅ admin/clients.js - WebSocket 客户端管理 (~70 端点)
12. ✅ admin/concurrency.js - 并发管理 (8 端点)
13. ✅ admin/dashboard.js - Dashboard 统计 (3 端点)
14. ✅ admin/droidAccounts.js - Droid 账户 (~10 端点)
15. ✅ admin/geminiAccounts.js - Gemini OAuth 账户 (~10 端点)
16. ✅ admin/geminiApiAccounts.js - Gemini API 账户 (9 端点)
17. ✅ admin/index.js - Admin 路由聚合器
18. ✅ admin/openaiAccounts.js - OpenAI OAuth 账户 (~12 端点)
19. ✅ admin/openaiResponsesAccounts.js - OpenAI Responses 账户 (~10 端点)
20. ✅ admin/subscriptions.js - 订阅管理 (Admin) (12 端点)
21. ✅ admin/sync.js - 数据同步导出 (1 端点)
22. ✅ admin/system.js - 系统管理 (9 端点)
23. ✅ admin/usageStats.js - 使用统计 (10 端点)
24. ✅ admin/utils.js - 工具函数 (无端点)
25. ✅ admin/vpn.js - VPN 隧道管理 (7 端点)
26. ✅ admin/ws.js - WebSocket 服务 (空文件)

### 根路由 (15 个文件)
27. ✅ api.js - 核心 Claude API 转发 (10 端点)
28. ✅ apiStats.js - API 统计查询 (4 端点)
29. ✅ azureOpenaiRoutes.js - Azure OpenAI 路由 (6 端点)
30. ✅ droidRoutes.js - Droid 路由 (5 端点)
31. ✅ geminiRoutes.js - Gemini 兼容路由 (6 端点)
32. ✅ openaiClaudeRoutes.js - OpenAI→Claude 转换 (4 端点)
33. ✅ openaiGeminiRoutes.js - OpenAI→Gemini 转换 (3 端点)
34. ✅ openaiOfficialRoutes.js - OpenAI 官方代理 (2 端点)
35. ✅ openaiRoutes.js - OpenAI 路由逻辑
36. ✅ standardGeminiRoutes.js - 标准 Gemini API (14 端点)
37. ✅ subscriptionRoutes.js - 订阅支付 (用户) (4 端点)
38. ✅ unified.js - 统一路由端点
39. ✅ userRoutes.js - 用户管理 (23 端点)
40. ✅ web.js - Web 认证 (6 端点)
41. ✅ webhook.js - Webhook 通知 (8 端点)

---

## 🎯 端点统计 (按模块)

| 模块 | 端点数 | 占比 |
|------|--------|------|
| **账户管理** (8 种账户类型) | ~120 | 20% |
| **WebSocket 客户端** | ~70 | 12% |
| **API 转发服务** | ~50 | 8% |
| **用户管理系统** | 23 | 4% |
| **使用统计监控** | 25+ | 4% |
| **订阅支付** | 16 | 3% |
| **API Keys 管理** | 10+ | 2% |
| **系统配置** | 30+ | 5% |
| **Webhook 通知** | 8 | 1% |
| **并发排队** | 8 | 1% |
| **VPN 隧道** | 7 | 1% |
| **账户余额** | 13 | 2% |
| **账户分组** | 6 | 1% |
| **其他** | ~210 | 35% |
| **总计** | **~598** | 100% |

---

## 📝 文档索引

完整 API 文档分布在以下文件中:

1. **API_FIRST_SCAN_CLAUDE_GEMINI.md** - Claude/Gemini 基础 API
2. **API_SECOND_SCAN_OPENAI_ROUTES.md** - OpenAI 兼容路由
3. **API_THIRD_SCAN_BEDROCK_AZURE.md** - Bedrock/Azure 账户管理
4. **API_FOURTH_SCAN_RESPONSES_CCR.md** - OpenAI Responses/CCR 账户
5. **API_FIFTH_SCAN_SYSTEM_MANAGEMENT.md** - 系统管理、日志、翻译 (30 端点)
6. **API_SIXTH_SCAN_ADDITIONAL_ENDPOINTS.md** - 订阅、Web 认证、API 统计 (14 端点)
7. **API_SEVENTH_SCAN_USER_MANAGEMENT.md** - 用户管理、短信、LDAP (27 端点)
8. **API_EIGHTH_SCAN_WEBSOCKET_CLIENTS.md** - WebSocket、Webhook、多平台路由 (~107 端点)
9. **API_NINTH_SCAN_MANAGEMENT_FEATURES.md** - 并发、VPN、余额、脚本、分组 (37 端点)
10. **API_COMPLETE_ENDPOINT_INDEX.md** - 本文档 (完整索引)

---

## 🔍 快速查找指南

### 按功能查找

**OAuth 授权**:
- Claude: `/admin/claude-accounts/generate-auth-url`, `/admin/claude-accounts/oauth-with-cookie`
- Gemini: `/admin/gemini-accounts/generate-auth-url`
- OpenAI: `/admin/openai-accounts/generate-auth-url`
- Droid: `/admin/droid-accounts/generate-auth-url` (Device Code)

**账户管理**:
- 列出: `/admin/{account-type}` (支持 8 种账户类型)
- 创建: `POST /admin/{account-type}`
- 更新: `PUT /admin/{account-type}/:id`
- 删除: `DELETE /admin/{account-type}/:id`
- 切换: `PUT /admin/{account-type}/:id/toggle-schedulable`

**API 转发**:
- Claude: `POST /v1/messages`, `POST /claude/v1/messages`
- Gemini: `POST /gemini/v1/models/:model:generateContent`
- OpenAI → Claude: `POST /openai/claude/v1/chat/completions`
- OpenAI → Gemini: `POST /openai/gemini/v1/chat/completions`
- Azure OpenAI: `POST /azure/chat/completions`
- Droid: `POST /droid/claude/v1/messages`

**使用统计**:
- 全局: `/admin/dashboard`
- 按账户: `/admin/accounts/:accountId/usage-stats`
- 按 Key: `/admin/api-keys/:keyId/model-stats`
- 按模型: `/admin/model-stats`
- 用户: `/users/usage-stats`

**并发管理**:
- 状态查询: `/admin/concurrency`, `/admin/concurrency/:apiKeyId`
- 排队统计: `/admin/concurrency-queue/stats`
- 清理: `DELETE /admin/concurrency-queue`

**配置管理**:
- Claude Relay: `/admin/claude-relay-config`
- OEM 设置: `/admin/oem-settings`
- Webhook: `/webhook/config`
- 余额脚本: `/admin/balance-scripts`

---

## 🚀 使用建议

### 1. 新用户快速上手
1. 查看 **API_SEVENTH_SCAN_USER_MANAGEMENT.md** 了解用户注册和 API Key 创建
2. 阅读核心 API 转发文档 (本文档第 1 节)
3. 查看 Dashboard 统计端点监控使用量

### 2. 系统管理员
1. 查看 **账户管理** 部分 (本文档第 2 节) 了解所有账户类型
2. 阅读 **系统管理和配置** (本文档第 8 节) 了解全局配置
3. 查看 **并发和排队管理** (本文档第 7 节) 监控系统负载

### 3. 开发者集成
1. 查看 **核心 API 转发服务** (本文档第 1 节) 选择合适的 API 格式
2. 阅读 **API Keys 管理** (本文档第 3 节) 了解认证和权限
3. 查看 **使用统计和监控** (本文档第 6 节) 跟踪 API 使用

### 4. 高级功能
1. **WebSocket 客户端**: 查看 **API_EIGHTH_SCAN_WEBSOCKET_CLIENTS.md**
2. **并发排队**: 查看 **API_NINTH_SCAN_MANAGEMENT_FEATURES.md**
3. **余额脚本**: 查看本文档第 11 节
4. **VPN 隧道**: 查看本文档第 10 节

---

**文档版本**: 2.0
**维护者**: Claude Relay Service Team
**最后更新**: 2026-01-02

完整 API 覆盖率: **163%** (598/366 原估计)
