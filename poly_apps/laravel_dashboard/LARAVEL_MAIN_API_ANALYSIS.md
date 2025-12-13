# Laravel Main API 端点完整分析

## 文档说明

根据 Laravel Main 项目的开发规范 (`LARAVEL_GUIDE_THIS_FILE_NO_AI_EDIT.md`)，本文档详细分析了所有已实现的 API 端点。

### Laravel Main 项目架构规范

**核心规范摘要**:
- **框架**: Laravel 12，纯无头 (Headless) API 模式
- **多应用聚合**: 采用 `app/Apps/{AppNameVx}/` 目录结构
- **API 文档化**: 每个应用必须提供 `{AppNameVx}ApiInfo` 类
- **端点收集**: 通过 `/api_info` 统一端点获取所有应用的 API 信息
- **应用命名**: `{appName}{Vx}` 格式，如 `ItToolsV1`, `McpV1`

---

## 已发现的应用模块

通过扫描 `app/Apps` 目录，发现以下 11 个应用模块：

| 应用名称 | 版本 | API前缀 | 状态 |
|---------|------|---------|------|
| AChatV1 | V1 | `/api/achat/v1` | ✅ 有ApiInfo |
| AppQyV1 | V1 | `/api/appqy/v1` | ✅ 有ApiInfo |
| AwyV0 | V0 | `/api/awy/v0` | ✅ 有ApiInfo |
| BankV1 | V1 | `/api/bank/v1` | ✅ 有ApiInfo |
| CodeMartV1 | V1 | `/api/codemart/v1` | ✅ 有ApiInfo |
| ItToolsV1 | V1 | `/api/ittools/v1` | ✅ 有ApiInfo |
| McpV1 | V1 | `/api/mcp/v1` | ✅ 有ApiInfo |
| ServerManagerV1 | V1 | `/api/servermanager/v1` | ✅ 有ApiInfo |
| VipClubV1 | V1 | `/api/vipclub/v1` | ✅ 有ApiInfo |
| VoiceSubtitleV1 | V1 | `/api/voice-subtitle/v1` | ✅ 有ApiInfo (McpV1子模块) |
| Common APIs | - | `/translation`, `/tts`, `/clipboard` 等 | ✅ 公共端点 |

**总计**: 11 个应用模块，预估 **300+ API 端点**

---

## 1. Common APIs (公共端点)

### 分类
这些端点不属于任何特定应用，是跨应用共享的公共服务。

### 端点列表

#### 1.1 Translation API（翻译服务）

```typescript
POST /translation/translate
POST /translation/batch
POST /translation/detect
POST /translation/learning
POST /translation/simple/google
GET  /translation/languages
GET  /translation/types
GET  /translation/templates
GET  /translation/models
GET  /translation/task/{taskId}
POST /translation/process-next
```

**使用场景**:
- Vocabulary Learning 模块
- AppQyV1 词典应用
- 多语言内容处理

---

#### 1.2 TTS API（文本转语音）

```typescript
POST /tts/generate
POST /tts/batch-generate
POST /tts/check
POST /tts/batch-check
GET  /tts/audio/{language}/{type}/{speed}/{filename}
GET  /tts/audio/{language}/{type}/{filename}
GET  /tts/sentence/{language}/{md5}
GET  /tts/voices
GET  /tts/cache/stats
POST /tts/cache/clear
```

**使用场景**:
- Vocabulary Learning 模块
- Voice Subtitle 系统
- 语音辅助学习

---

#### 1.3 Clipboard API（剪贴板服务）

```typescript
GET  /clipboard/namespace
POST /clipboard/text
GET  /clipboard/data
POST /clipboard/upload
GET  /clipboard/download
POST /clipboard/delete-file
POST /clipboard/new
POST /clipboard/restore
```

**使用场景**:
- 开发工具
- 跨设备内容同步
- 临时数据存储

---

#### 1.4 Code Browser API（代码浏览器）

```typescript
GET  /code-browser/auth-check
GET  /code-browser/file-tree
GET  /code-browser/read-file
POST /code-browser/save-file
POST /code-browser/delete-file
POST /code-browser/restore-file
POST /code-browser/rename-item
POST /code-browser/auto-rename-to-english
POST /code-browser/clean-broken-symlinks
GET  /code-browser/prompts
POST /code-browser/prompts/create
POST /code-browser/prompts/translate
POST /code-browser/prompts/translate-name
POST /code-browser/prompts/translate-line
```

**使用场景**:
- Code Browser 视图
- 文件管理和编辑
- Prompt 管理

---

#### 1.5 Static Resources API（静态资源管理）

```typescript
GET  /static-resources/file-tree
GET  /static-resources/read-file
GET  /static-resources/stream-file
POST /static-resources/upload
POST /static-resources/rename
POST /static-resources/create-directory
POST /static-resources/delete-preview
POST /static-resources/delete
```

**分块上传端点**:
```typescript
POST /static-resources/chunked-upload/init
POST /static-resources/chunked-upload/chunk
POST /static-resources/chunked-upload/check
POST /static-resources/chunked-upload/merge
POST /static-resources/chunked-upload/cancel
```

**使用场景**:
- Media Browser 视图
- 大文件上传
- 资源管理

---

#### 1.6 Octane Timer Tasks API（定时任务监控）

```typescript
GET /octane-tasks/status
GET /octane-tasks/task/{taskName}
GET /octane-tasks/basic
GET /octane-tasks/verify
```

**使用场景**:
- Octane Tasks 视图
- 系统任务监控
- 性能监控

---

#### 1.7 Startup Monitor API（启动监控）

```typescript
GET /startup-monitor/logs
GET /startup-monitor/view
GET /startup-monitor/health
```

**使用场景**:
- 系统启动日志查看
- 健康检查
- 故障排查

---

#### 1.8 System Initialization API（系统初始化）

```typescript
GET  /system/init/status
GET  /system/init/apps
POST /system/init/all
POST /system/init/{appName}
POST /system/init/{appName}/reset
```

**使用场景**:
- 应用初始化
- 系统配置
- 重置应用数据

---

## 2. McpV1 (MCP Bridge Application)

### 应用说明
MCP (Model Context Protocol) 桥接应用，提供 OCR、截图管理、任务分发和占位图生成等功能。

### 2.1 OCR APIs

```typescript
POST /api/mcp/v1/ocr/recognize
POST /api/mcp/v1/ocr/smart-recognize
POST /api/mcp/v1/ocr/batch
GET  /api/mcp/v1/ocr/engines
GET  /api/mcp/v1/ocr/engine-info
```

---

### 2.2 Screenshot Management APIs

```typescript
POST   /api/mcp/v1/screenshots/upload
POST   /api/mcp/v1/screenshots/upload-merge
POST   /api/mcp/v1/screenshots/upload-batch
GET    /api/mcp/v1/screenshots/latest
GET    /api/mcp/v1/screenshots/search
GET    /api/mcp/v1/screenshots/stats
GET    /api/mcp/v1/screenshots/
GET    /api/mcp/v1/screenshots/{id}.{ext}
GET    /api/mcp/v1/screenshots/{id}
GET    /api/mcp/v1/screenshots/{id}/file
DELETE /api/mcp/v1/screenshots/{id}
DELETE /api/mcp/v1/screenshots/clear-all/confirm
```

---

### 2.3 Task Dispatch APIs

```typescript
GET    /api/mcp/v1/task-dispatch/categories
GET    /api/mcp/v1/task-dispatch/categories/{categoryId}/files
POST   /api/mcp/v1/task-dispatch/categories
POST   /api/mcp/v1/task-dispatch/queue/add-file
GET    /api/mcp/v1/task-dispatch/queue/{categoryId}/tasks
GET    /api/mcp/v1/task-dispatch/queue/{categoryId}/last-task
GET    /api/mcp/v1/task-dispatch/queue/{categoryId}/has-latest
GET    /api/mcp/v1/task-dispatch/queue/{categoryId}/search
PUT    /api/mcp/v1/task-dispatch/queue/{categoryId}/tasks/{taskId}/status
GET    /api/mcp/v1/task-dispatch/queue/{categoryId}/stats
GET    /api/mcp/v1/task-dispatch/mappings
GET    /api/mcp/v1/task-dispatch/mappings/{categoryId}
PUT    /api/mcp/v1/task-dispatch/mappings/{categoryId}
POST   /api/mcp/v1/task-dispatch/mappings/{categoryId}/reset
DELETE /api/mcp/v1/task-dispatch/mappings/{categoryId}
```

---

### 2.4 Placeholder Generator APIs

```typescript
POST   /api/mcp/v1/placeholders/generate
GET    /api/mcp/v1/placeholders/
GET    /api/mcp/v1/placeholders/stats
POST   /api/mcp/v1/placeholders/cleanup
GET    /api/mcp/v1/placeholders/{uuid}/download
DELETE /api/mcp/v1/placeholders/{uuid}
```

---

### 2.5 Voice Subtitle APIs (VoiceSubtitleV1 子模块)

```typescript
POST /api/mcp/v1/voice-subtitle/add
GET  /api/mcp/v1/voice-subtitle/queue
GET  /api/mcp/v1/voice-subtitle/current
POST /api/mcp/v1/voice-subtitle/next
POST /api/mcp/v1/voice-subtitle/previous
```

---

### 2.6 Health Check

```typescript
GET /api/mcp/v1/health
```

**McpV1 统计**: **约 50+ 端点**

---

## 3. ItToolsV1 (IT 开发工具集)

### 应用说明
提供 100+ IT 开发工具，包括加密、转换、格式化、生成器等。

### 3.1 Crypto & Security Tools

```typescript
POST /api/ittools/v1/crypto/hash
POST /api/ittools/v1/crypto/bcrypt/hash
POST /api/ittools/v1/crypto/bcrypt/verify
POST /api/ittools/v1/crypto/uuid/generate
POST /api/ittools/v1/crypto/ulid/generate
POST /api/ittools/v1/crypto/token/generate
POST /api/ittools/v1/crypto/basic-auth
POST /api/ittools/v1/crypto/hmac
POST /api/ittools/v1/crypto/rsa/generate
POST /api/ittools/v1/crypto/bip39/generate
POST /api/ittools/v1/crypto/otp/generate
POST /api/ittools/v1/crypto/otp/verify
POST /api/ittools/v1/crypto/password/analyze
POST /api/ittools/v1/crypto/encrypt
POST /api/ittools/v1/crypto/decrypt
```

---

### 3.2 Converter Tools

```typescript
POST /api/ittools/v1/converter/base64/encode
POST /api/ittools/v1/converter/base64/decode
POST /api/ittools/v1/converter/case
POST /api/ittools/v1/converter/url/encode
POST /api/ittools/v1/converter/url/decode
POST /api/ittools/v1/converter/json-to-yaml
POST /api/ittools/v1/converter/yaml-to-json
POST /api/ittools/v1/converter/temperature
POST /api/ittools/v1/converter/roman/to-arabic
POST /api/ittools/v1/converter/datetime
```

---

### 3.3 Web Tools

```typescript
POST /api/ittools/v1/web/json/prettify
POST /api/ittools/v1/web/json/minify
POST /api/ittools/v1/web/jwt/parse
POST /api/ittools/v1/web/markdown/to-html
POST /api/ittools/v1/web/sql/format
POST /api/ittools/v1/web/qr-code/generate
POST /api/ittools/v1/web/wifi-qr-code/generate
POST /api/ittools/v1/web/xml/format
POST /api/ittools/v1/web/yaml/format
```

---

### 3.4 Text Tools

```typescript
POST /api/ittools/v1/text/encode
POST /api/ittools/v1/text/decode
```

---

### 3.5 Advanced Tools

```typescript
POST /api/ittools/v1/advanced/image/compress
POST /api/ittools/v1/advanced/image/crop
POST /api/ittools/v1/advanced/pdf/split
```

---

### 3.6 其他工具

```typescript
POST /api/ittools/v1/hash/generate
POST /api/ittools/v1/json/format
GET  /api/ittools/v1/uuid/generate
POST /api/ittools/v1/timestamp/convert
POST /api/ittools/v1/color/convert
POST /api/ittools/v1/regex/test
```

**ItToolsV1 统计**: **约 50+ 端点** (实际可能有 100+ 工具)

---

## 4. ServerManagerV1 (服务器管理)

### 应用说明
全面的服务器管理和运维工具。

### 4.1 API Information

```typescript
GET /api/servermanager/v1/info
```

---

### 4.2 System Information

```typescript
GET /api/servermanager/v1/system/info
GET /api/servermanager/v1/system/processes
GET /api/servermanager/v1/system/services
GET /api/servermanager/v1/system/permissions
GET /api/servermanager/v1/system/storage
```

---

### 4.3 File Management

```typescript
GET /api/servermanager/v1/files/browse
GET /api/servermanager/v1/files/download
GET /api/servermanager/v1/files/info
GET /api/servermanager/v1/files/preview
```

---

### 4.4 Code Execution

```typescript
GET  /api/servermanager/v1/executor/scripts
POST /api/servermanager/v1/executor/run
GET  /api/servermanager/v1/executor/logs
GET  /api/servermanager/v1/executor/status
```

---

### 4.5 Nginx Management

```typescript
GET  /api/servermanager/v1/nginx/sites
GET  /api/servermanager/v1/nginx/config
POST /api/servermanager/v1/nginx/enable
POST /api/servermanager/v1/nginx/disable
POST /api/servermanager/v1/nginx/reload
POST /api/servermanager/v1/nginx/test
```

---

### 4.6 SSL Management

```typescript
GET  /api/servermanager/v1/ssl/certificates
POST /api/servermanager/v1/ssl/generate
POST /api/servermanager/v1/ssl/install
GET  /api/servermanager/v1/ssl/renew
```

---

### 4.7 Deployment

```typescript
POST /api/servermanager/v1/deploy/start
GET  /api/servermanager/v1/deploy/status
POST /api/servermanager/v1/deploy/rollback
```

**ServerManagerV1 统计**: **约 30+ 端点**

---

## 5. AppQyV1 (词典与学习应用)

### 应用说明
个人词典、词组管理和单词学习系统。

### 5.1 Authentication

```typescript
POST /api/appqy/v1/auth/register
POST /api/appqy/v1/auth/login
POST /api/appqy/v1/auth/logout
POST /api/appqy/v1/auth/user-generation
POST /api/appqy/v1/auth/session
```

---

### 5.2 Dictionary Management

```typescript
GET    /api/appqy/v1/dictionaries
POST   /api/appqy/v1/dictionaries
GET    /api/appqy/v1/dictionaries/{id}
PUT    /api/appqy/v1/dictionaries/{id}
DELETE /api/appqy/v1/dictionaries/{id}
GET    /api/appqy/v1/dictionaries/query
```

---

### 5.3 Personal Dictionary

```typescript
GET    /api/appqy/v1/personal-dict
POST   /api/appqy/v1/personal-dict
GET    /api/appqy/v1/personal-dict/{id}
DELETE /api/appqy/v1/personal-dict/{id}
GET    /api/appqy/v1/personal-dict/query
POST   /api/appqy/v1/personal-dict/process
```

---

### 5.4 Word Groups

```typescript
GET    /api/appqy/v1/word-groups
POST   /api/appqy/v1/word-groups
GET    /api/appqy/v1/word-groups/{id}
PUT    /api/appqy/v1/word-groups/{id}
DELETE /api/appqy/v1/word-groups/{id}
GET    /api/appqy/v1/word-groups/query
POST   /api/appqy/v1/word-groups/tools
```

---

### 5.5 Word Operations

```typescript
POST /api/appqy/v1/words/weight
POST /api/appqy/v1/words/reading-status
POST /api/appqy/v1/words/review-status
POST /api/appqy/v1/words/learning-status
```

---

### 5.6 User & Initialization

```typescript
GET  /api/appqy/v1/user/init
POST /api/appqy/v1/user/init
```

**AppQyV1 统计**: **约 35+ 端点**

---

## 6. AwyV0 (社交/聊天应用)

### 应用说明
类似微信的社交通讯应用。

### 6.1 Authentication

```typescript
POST /api/awy/v0/auth/register
POST /api/awy/v0/auth/login
POST /api/awy/v0/auth/logout
```

---

### 6.2 User Management

```typescript
GET  /api/awy/v0/user/profile
PUT  /api/awy/v0/user/profile
POST /api/awy/v0/user/avatar
```

---

### 6.3 Friend Management

```typescript
GET    /api/awy/v0/friends
POST   /api/awy/v0/friends/request
POST   /api/awy/v0/friends/accept
DELETE /api/awy/v0/friends/{id}
GET    /api/awy/v0/friends/search
```

---

### 6.4 Device Management

```typescript
GET    /api/awy/v0/devices
POST   /api/awy/v0/devices/register
DELETE /api/awy/v0/devices/{id}
```

---

### 6.5 Chat

```typescript
GET  /api/awy/v0/chat/conversations
POST /api/awy/v0/chat/messages
GET  /api/awy/v0/chat/messages/{conversationId}
POST /api/awy/v0/chat/read
```

---

### 6.6 Search

```typescript
GET /api/awy/v0/search/users
GET /api/awy/v0/search/groups
```

---

### 6.7 Dashboard

```typescript
GET /api/awy/v0/dashboard/stats
GET /api/awy/v0/dashboard/recent
```

**AwyV0 统计**: **约 25+ 端点**

---

## 7. BankV1 (银行/金融应用)

### 应用说明
金融账户管理系统。

```typescript
GET    /api/bank/v1/accounts
POST   /api/bank/v1/accounts
GET    /api/bank/v1/accounts/{id}
POST   /api/bank/v1/transactions
GET    /api/bank/v1/transactions
GET    /api/bank/v1/balance
POST   /api/bank/v1/transfer
```

**BankV1 统计**: **约 15+ 端点**

---

## 8. CodeMartV1 (代码市场)

### 应用说明
代码片段和模板市场。

```typescript
GET    /api/codemart/v1/snippets
POST   /api/codemart/v1/snippets
GET    /api/codemart/v1/snippets/{id}
GET    /api/codemart/v1/search
GET    /api/codemart/v1/categories
POST   /api/codemart/v1/purchase
```

**CodeMartV1 统计**: **约 20+ 端点**

---

## 9. VipClubV1 (会员系统)

### 应用说明
VIP 会员管理和权益系统。

```typescript
GET    /api/vipclub/v1/memberships
POST   /api/vipclub/v1/memberships/purchase
GET    /api/vipclub/v1/benefits
GET    /api/vipclub/v1/tiers
POST   /api/vipclub/v1/upgrade
GET    /api/vipclub/v1/history
```

**VipClubV1 统计**: **约 15+ 端点**

---

## 10. AChatV1 (AI 聊天)

### 应用说明
AI 对话和聊天机器人服务。

```typescript
POST /api/achat/v1/chat/send
GET  /api/achat/v1/chat/history
POST /api/achat/v1/chat/stream
GET  /api/achat/v1/models
POST /api/achat/v1/context/save
```

**AChatV1 统计**: **约 10+ 端点**

---

## 总体统计

| 应用模块 | API 端点数 | Dashboard 缺失 |
|---------|----------|---------------|
| Common APIs | ~80 | ✅ 部分已实现 (Translation, TTS) |
| McpV1 | ~50 | ❌ 完全缺失 |
| ItToolsV1 | ~50 | ⚠️ 部分实现 (仅基础工具) |
| ServerManagerV1 | ~30 | ❌ 完全缺失 |
| AppQyV1 | ~35 | ❌ 完全缺失 |
| AwyV0 | ~25 | ❌ 完全缺失 |
| BankV1 | ~15 | ❌ 完全缺失 |
| CodeMartV1 | ~20 | ❌ 完全缺失 |
| VipClubV1 | ~15 | ❌ 完全缺失 |
| AChatV1 | ~10 | ❌ 完全缺失 |
| **总计** | **~330+ 端点** | **需补充 250+ 端点** |

---

## Dashboard 缺失的关键 API 端点

### 高优先级 (P0)

1. **System Information** (已在文档中)
   - `GET /api_info` ✅

2. **MCP Manager** (完全缺失)
   - **50+ MCP 端点**需要添加到 `endpoints.ts`

3. **Octane Tasks** (已部分实现)
   - 4 个端点已在 Common APIs

### 中优先级 (P1)

4. **Vocabulary Learning** (部分实现)
   - Translation API ✅ (11个端点)
   - TTS API ✅ (10个端点)
   - 缺失: AppQyV1 的 35+ 词典端点

5. **ITTools 完整集成** (仅部分实现)
   - 当前仅 10+ 端点
   - 缺失: 40+ 工具端点

### 低优先级 (P2)

6. **ServerManager** (完全缺失)
   - 30+ 端点

7. **其他应用** (AwyV0, BankV1, CodeMartV1, VipClubV1, AChatV1)
   - 85+ 端点

---

## 建议的实施计划

### 阶段 1: 核心功能补充

1. 将 McpV1 的 50+ 端点添加到 `endpoints.ts`
2. 补充 Octane Tasks 端点定义
3. 完善 ITTools 端点列表

### 阶段 2: 应用专属端点

4. 添加 AppQyV1 词典端点
5. 添加 ServerManagerV1 端点

### 阶段 3: 扩展应用

6. 根据需求逐步添加其他应用端点

---

## 端点格式规范 (根据 Laravel Guide)

Laravel Main 使用的 ApiInfo 格式:

```php
[
    'path' => 'http://localhost/api/xxx',
    'feature' => 'auth_type/method|description|controller|params:param_list|response:response_list|tags:tag_list'
]
```

**参数格式**: `param_name(type,requirement,example)`

**响应格式**: `field_name(type,description)`

**示例**:
```php
'feature' => 'auth_required/POST|Generate UUID|IttoolsV1UuidCtl@generate|params:count(int,optional,1)|response:uuids(array)|tags:uuid,generator'
```

---

## 下一步行动

1. ✅ 更新 `TYPES_MODELS_EXTENSION.md` 补充缺失的类型
2. ✅ 更新 `API_ENDPOINTS_DETAILED.md` 补充所有端点
3. ⏳ 更新 `poly_apps/laravel_dashboard/endpoints.ts` 添加所有缺失端点
4. ⏳ 实现对应的 Service 层和 UI 组件

---

**文档生成时间**: 2025-12-13
**分析基于**: Laravel Main 项目代码扫描和 ApiInfo 类分析
