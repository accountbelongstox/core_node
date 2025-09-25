# 寸止 MCP 服务分布式架构开发文档

## 项目概述

本文档描述了寸止 MCP 服务的分布式架构设计，采用三层分离架构：
- **MCP 服务层**: Rust 实现，专注于 MCP 协议处理和业务逻辑
- **Laravel 中间层**: PHP Laravel 框架，提供 API 服务、WebSocket 通信和数据管理
- **Flutter 移动端**: Dart/Flutter 实现，提供用户交互界面和推送通知

## 架构对比

### 旧架构（Tauri 桌面应用）
```
MCP Client → Rust MCP Server → Tauri Bridge → Vue Desktop UI
                                    ↕️
                            Tauri Commands/Events
```

### 新架构（分布式移动优先）
```
MCP Client → Rust MCP Server → HTTP API → Laravel Bridge → WebSocket/Push → Flutter Mobile App
                                              ↕️                              ↕️
                                    Laravel + Broadcasting        Firebase/Local Notifications
                                              ↕️
                                        MySQL/SQLite Database
```

## 架构优势

### 1. 分布式部署
- **服务解耦**: 各组件可独立部署和扩展
- **跨平台支持**: Flutter 支持 iOS/Android/Web/Desktop
- **云端同步**: 配置和状态可在多设备间同步

### 2. 移动优先
- **随时响应**: 移动端推送通知，随时随地响应 AI 请求
- **离线支持**: 本地缓存，网络恢复后自动同步
- **更好的用户体验**: 原生移动端交互体验

### 3. 可扩展性
- **水平扩展**: Laravel 后端支持负载均衡
- **插件化**: 支持第三方插件和扩展
- **API 开放**: 提供完整的 REST API 供第三方集成

## 技术栈

### MCP 服务层 (Rust)
- **语言**: Rust 1.70+
- **HTTP 客户端**: reqwest
- **JSON 处理**: serde_json
- **异步运行时**: tokio
- **功能**: MCP 协议处理、业务逻辑、与 Laravel 通信

### Laravel 中间层 (PHP)
- **语言**: PHP 8.2+
- **框架**: Laravel 11.x
- **数据库**: MySQL 8.0+ / SQLite 3.x
- **WebSocket**: Laravel Broadcasting + Pusher/Soketi
- **队列**: Redis + Laravel Queue
- **缓存**: Redis
- **功能**: API 服务、WebSocket 管理、数据持久化、推送通知

### Flutter 移动端 (Dart)
- **语言**: Dart 3.0+
- **框架**: Flutter 3.10+
- **状态管理**: Riverpod
- **网络**: Dio + Retrofit
- **WebSocket**: socket_io_client
- **推送通知**: firebase_messaging + flutter_local_notifications
- **本地存储**: Hive + SharedPreferences
- **功能**: 用户界面、通知接收、离线缓存

## 项目结构

```
wait_please/
├── src/
│   ├── rust/                    # MCP 服务层
│   │   ├── mcp/                 # MCP 协议处理
│   │   │   ├── server.rs        # MCP 服务器实现
│   │   │   ├── handlers/        # 请求处理器
│   │   │   └── types.rs         # 数据类型定义
│   │   ├── api/                 # Laravel API 客户端
│   │   │   ├── client.rs        # HTTP 客户端
│   │   │   └── models.rs        # API 数据模型
│   │   ├── config/              # 配置管理
│   │   └── main.rs              # 应用入口
│   ├── laravel_bridge/          # Laravel 中间层
│   │   ├── app/
│   │   │   ├── Http/Controllers/    # API 控制器
│   │   │   ├── Models/              # 数据模型
│   │   │   ├── Events/              # 事件定义
│   │   │   ├── Services/            # 业务服务
│   │   │   ├── Jobs/                # 队列任务
│   │   │   └── Notifications/       # 推送通知
│   │   ├── routes/
│   │   │   ├── api.php              # API 路由
│   │   │   ├── channels.php         # WebSocket 频道
│   │   │   └── web.php              # Web 路由
│   │   ├── config/                  # Laravel 配置
│   │   ├── database/                # 数据库迁移
│   │   └── composer.json            # PHP 依赖
│   └── flutter_app/             # Flutter 移动端
│       ├── lib/
│       │   ├── core/                # 核心功能
│       │   ├── data/                # 数据层
│       │   ├── domain/              # 业务层
│       │   └── presentation/        # 表现层
│       ├── android/                 # Android 配置
│       ├── ios/                     # iOS 配置
│       └── pubspec.yaml             # Flutter 依赖
├── docs/                        # 开发文档
├── scripts/                     # 构建脚本
├── docker/                      # Docker 配置
└── docker-compose.yml           # 容器化部署
```

## API 接口设计

### Laravel 后端 API

#### 1. 健康检查和探测 API

**GET /api/health**
- 描述: 系统健康检查
- 响应:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00Z",
  "uptime": 3600,
  "services": {
    "database": "ok",
    "redis": "ok",
    "websocket": "ok"
  }
}
```

**GET /api/mcp/status**
- 描述: MCP 服务状态探测
- 响应:
```json
{
  "connected": true,
  "last_heartbeat": "2024-01-01T00:00:00Z",
  "active_requests": 2,
  "total_processed": 150
}
```

**GET /api/clients/status**
- 描述: 客户端连接状态
- 响应:
```json
{
  "total_clients": 5,
  "flutter_clients": 3,
  "web_clients": 2,
  "last_activity": "2024-01-01T00:00:00Z"
}
```

**POST /api/mcp/heartbeat**
- 描述: MCP 服务心跳上报
- 请求体: `{ service_id: string, status: string, timestamp: string }`
- 响应: `{ success: boolean, next_heartbeat: number }`

#### 2. 应用配置 API

**GET /api/app/info**
- 描述: 获取应用信息
- 响应: `{ name: string, version: string, build: string }`

**GET /api/app/config**
- 描述: 获取完整应用配置
- 响应: `AppConfig`

**POST /api/app/config**
- 描述: 更新应用配置
- 请求体: `Partial<AppConfig>`
- 响应: `{ success: boolean }`

#### 3. UI 设置 API (Flutter 专用)

**GET /api/ui/theme**
- 描述: 获取当前主题
- 响应: `{ theme: 'light' | 'dark' | 'system' }`

**POST /api/ui/theme**
- 描述: 设置主题
- 请求体: `{ theme: 'light' | 'dark' | 'system' }`
- 响应: `{ success: boolean }`

**GET /api/ui/notification-config**
- 描述: 获取通知配置
- 响应:
```json
{
  "enabled": true,
  "sound_enabled": true,
  "vibration_enabled": true,
  "priority": "high",
  "custom_sound": null
}
```

**POST /api/ui/notification-config**
- 描述: 更新通知配置
- 请求体: `Partial<NotificationConfig>`
- 响应: `{ success: boolean }`

**GET /api/ui/app-config**
- 描述: 获取应用配置
- 响应: `AppUIConfig`

**POST /api/ui/app-config**
- 描述: 更新应用配置
- 请求体: `Partial<AppUIConfig>`
- 响应: `{ success: boolean }`

#### 4. MCP 交互 API

**POST /api/mcp/popup**
- 描述: 创建 MCP 弹窗请求 (由 Rust MCP 服务调用)
- 请求体:
```json
{
  "id": "uuid",
  "message": "string",
  "predefined_options": ["option1", "option2"],
  "is_markdown": false,
  "timeout": 300,
  "source": "mcp_server",
  "priority": "high"
}
```
- 响应: `{ request_id: string, status: 'pending', estimated_response_time: number }`

**POST /api/mcp/response**
- 描述: 提交用户响应 (由 Flutter 应用调用)
- 请求体: `{ request_id: string, response: any, response_time: number }`
- 响应: `{ success: boolean }`

**GET /api/mcp/requests**
- 描述: 获取活跃的 MCP 请求列表
- 响应: `{ requests: PopupRequest[], total: number }`

**DELETE /api/mcp/requests/:id**
- 描述: 取消 MCP 请求
- 响应: `{ success: boolean }`

**POST /api/mcp/batch-response**
- 描述: 批量响应多个 MCP 请求
- 请求体: `{ responses: [{ request_id: string, response: any }] }`
- 响应: `{ success: boolean, processed: number, failed: number }`

#### 4. 自定义 Prompt API

**GET /api/prompts**
- 描述: 获取自定义 prompt 配置
- 响应: `CustomPromptConfig`

**POST /api/prompts**
- 描述: 添加自定义 prompt
- 请求体: `CustomPrompt`
- 响应: `{ success: boolean }`

**PUT /api/prompts/:id**
- 描述: 更新自定义 prompt
- 请求体: `CustomPrompt`
- 响应: `{ success: boolean }`

**DELETE /api/prompts/:id**
- 描述: 删除自定义 prompt
- 响应: `{ success: boolean }`

**POST /api/prompts/reorder**
- 描述: 重新排序 prompts
- 请求体: `{ prompt_ids: string[] }`
- 响应: `{ success: boolean }`

#### 5. 快捷键配置 API

**GET /api/shortcuts**
- 描述: 获取快捷键配置
- 响应: `ShortcutConfig`

**POST /api/shortcuts/:id**
- 描述: 更新快捷键绑定
- 请求体: `ShortcutBinding`
- 响应: `{ success: boolean }`

**POST /api/shortcuts/reset**
- 描述: 重置快捷键为默认值
- 响应: `{ success: boolean }`

#### 6. 音频通知 API

**POST /api/audio/play**
- 描述: 播放通知音频
- 请求体: `{ url?: string }`
- 响应: `{ success: boolean }`

**POST /api/audio/stop**
- 描述: 停止音频播放
- 响应: `{ success: boolean }`

**POST /api/audio/test**
- 描述: 测试音频播放
- 请求体: `{ url: string }`
- 响应: `{ success: boolean }`

#### 7. 推送通知 API

**POST /api/notifications/register-device**
- 描述: 注册设备推送 Token
- 请求体:
```json
{
  "device_token": "fcm_token_or_apns_token",
  "platform": "android|ios",
  "device_id": "unique_device_id",
  "app_version": "1.0.0"
}
```
- 响应: `{ success: boolean, device_id: string }`

**POST /api/notifications/send**
- 描述: 发送推送通知 (内部 API)
- 请求体:
```json
{
  "device_tokens": ["token1", "token2"],
  "title": "通知标题",
  "body": "通知内容",
  "data": { "type": "mcp_popup", "request_id": "uuid" },
  "priority": "high"
}
```
- 响应: `{ success: boolean, sent_count: number }`

**GET /api/notifications/history**
- 描述: 获取通知历史
- 查询参数: `?page=1&limit=20&type=mcp_popup`
- 响应: `{ notifications: NotificationHistory[], pagination: PaginationInfo }`

**POST /api/notifications/mark-read**
- 描述: 标记通知为已读
- 请求体: `{ notification_ids: ["id1", "id2"] }`
- 响应: `{ success: boolean }`

#### 8. 设备管理 API

**GET /api/devices**
- 描述: 获取用户设备列表
- 响应: `{ devices: Device[], total: number }`

**POST /api/devices/sync**
- 描述: 同步设备状态
- 请求体: `{ device_id: string, last_sync: string, app_state: object }`
- 响应: `{ success: boolean, sync_data: object }`

**DELETE /api/devices/:id**
- 描述: 删除设备
- 响应: `{ success: boolean }`

### MCP 服务需要的 API

#### 1. 弹窗创建 API

**POST http://localhost:8000/api/mcp/popup**
- 用途: Rust MCP 服务创建弹窗请求
- 请求体:
```typescript
interface PopupRequest {
  id: string
  message: string
  predefined_options?: string[]
  is_markdown?: boolean
  timeout?: number
  source: string
}
```

#### 2. 响应等待机制

**WebSocket 连接**: `ws://localhost:8000/ws`
- 用途: 监听用户响应事件
- 事件类型:
```typescript
interface McpResponseEvent {
  type: 'mcp_response'
  request_id: string
  response: string
  timestamp: string
}
```

#### 3. 配置同步 API

**GET http://localhost:8000/api/app/config**
- 用途: 获取应用配置用于 MCP 处理逻辑

**POST http://localhost:8000/api/app/config**
- 用途: 更新配置后同步到前端

## WebSocket 事件设计

### 客户端 → 服务器事件

```typescript
// 连接认证
interface AuthEvent {
  type: 'auth'
  token?: string
  client_type: 'flutter_app' | 'mcp_server' | 'web_admin'
  device_info: {
    platform: string
    version: string
    device_id: string
  }
}

// MCP 响应提交
interface McpResponseEvent {
  type: 'mcp_response'
  request_id: string
  response: any
  response_time: number
  client_id: string
}

// 心跳检测
interface PingEvent {
  type: 'ping'
  timestamp: number
  client_id: string
}

// 配置更新请求
interface ConfigUpdateEvent {
  type: 'config_update'
  config: Partial<AppConfig>
  client_id: string
}

// 设备状态同步
interface DeviceSyncEvent {
  type: 'device_sync'
  device_id: string
  app_state: object
  last_activity: string
}

// 通知确认
interface NotificationAckEvent {
  type: 'notification_ack'
  notification_id: string
  action: 'received' | 'opened' | 'dismissed'
  timestamp: number
}
```

### 服务器 → 客户端事件

```typescript
// MCP 弹窗请求
interface McpPopupEvent {
  type: 'mcp_popup'
  request: PopupRequest
  target_clients?: string[]  // 指定目标客户端
  broadcast: boolean
}

// 配置更新通知
interface ConfigChangedEvent {
  type: 'config_changed'
  config: AppConfig
  changed_by: string
  timestamp: string
}

// 推送通知事件
interface PushNotificationEvent {
  type: 'push_notification'
  notification: {
    title: string
    body: string
    data: object
    priority: 'normal' | 'high'
  }
  target_devices: string[]
}

// 系统通知
interface SystemNotificationEvent {
  type: 'system_notification'
  level: 'info' | 'warning' | 'error' | 'success'
  message: string
  title?: string
  persistent?: boolean
  action_buttons?: Array<{
    text: string
    action: string
  }>
}

// 心跳响应
interface PongEvent {
  type: 'pong'
  timestamp: number
  server_status: {
    active_connections: number
    active_requests: number
    uptime: number
  }
}

// 服务状态更新
interface ServiceStatusEvent {
  type: 'service_status'
  service: 'mcp_server' | 'database' | 'redis' | 'notification'
  status: 'online' | 'offline' | 'degraded'
  message?: string
  timestamp: string
}

// 设备同步响应
interface DeviceSyncResponseEvent {
  type: 'device_sync_response'
  device_id: string
  sync_data: object
  conflicts?: Array<{
    key: string
    local_value: any
    remote_value: any
  }>
}

// 强制重连通知
interface ForceReconnectEvent {
  type: 'force_reconnect'
  reason: string
  delay_seconds: number
}
```

## 数据类型定义

### 核心类型

```typescript
// 应用配置
interface AppConfig {
  ui_config: UiConfig
  reply_config: ReplyConfig
  custom_prompt_config: CustomPromptConfig
  shortcut_config: ShortcutConfig
  telegram_config?: TelegramConfig
}

// UI 配置
interface UiConfig {
  theme: 'light' | 'dark'
  always_on_top: boolean
  window_config: WindowConfig
  audio_notification: boolean
  audio_url?: string
}

// 窗口配置
interface WindowConfig {
  fixed: boolean
  fixed_width: number
  fixed_height: number
  free_width: number
  free_height: number
}

// 回复配置
interface ReplyConfig {
  default_reply: string
  quick_replies: string[]
  auto_reply_enabled: boolean
}

// 自定义 Prompt 配置
interface CustomPromptConfig {
  enabled: boolean
  max_prompts: number
  prompts: CustomPrompt[]
}

// 自定义 Prompt
interface CustomPrompt {
  id: string
  name: string
  content: string
  sort_order: number
  enabled: boolean
  is_conditional: boolean
  current_state: boolean
  created_at: string
  updated_at: string
}

// 快捷键配置
interface ShortcutConfig {
  shortcuts: Record<string, ShortcutBinding>
}

// 快捷键绑定
interface ShortcutBinding {
  key: string
  modifiers: string[]
  enabled: boolean
}

// MCP 弹窗请求
interface PopupRequest {
  id: string
  message: string
  predefined_options?: string[]
  is_markdown?: boolean
  timeout?: number
  source: string
}

// 图片附件
interface ImageAttachment {
  data: string
  mime_type: string
  filename?: string
}
```

## 实现步骤

### 第一阶段: Node.js 中间层开发

#### 1. 项目初始化

```bash
# 创建 Node.js 项目
mkdir src/node_bridge
cd src/node_bridge
npm init -y

# 安装依赖
npm install express socket.io cors helmet morgan
npm install -D @types/node @types/express typescript ts-node nodemon
npm install -D @types/cors @types/morgan

# 创建 TypeScript 配置
npx tsc --init
```

#### 2. 核心服务实现

**src/node_bridge/src/app.ts**
```typescript
import express from 'express'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'

import { setupRoutes } from './routes'
import { setupWebSocket } from './websocket'
import { AppState } from './services/state'

const app = express()
const server = createServer(app)
const io = new SocketIOServer(server, {
  cors: {
    origin: ["http://localhost:8080", "http://localhost:5173"],
    methods: ["GET", "POST"]
  }
})

// 中间件
app.use(helmet())
app.use(cors())
app.use(morgan('combined'))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// 初始化应用状态
const appState = new AppState()

// 设置路由
setupRoutes(app, appState)

// 设置 WebSocket
setupWebSocket(io, appState)

// 启动服务器
const PORT = process.env.PORT || 8000
server.listen(PORT, () => {
  console.log(`🚀 Node.js Bridge 服务启动在端口 ${PORT}`)
  console.log(`📡 WebSocket 服务已启用`)
  console.log(`🌐 前端地址: http://localhost:8080`)
})

export { app, server, io }
```

#### 3. 状态管理服务

**src/node_bridge/src/services/state.ts**
```typescript
import { EventEmitter } from 'events'
import { PopupRequest, AppConfig, McpRequestState } from '../types'

export class AppState extends EventEmitter {
  private config: AppConfig
  private activeRequests: Map<string, McpRequestState> = new Map()
  private connectedClients: Map<string, any> = new Map()

  constructor() {
    super()
    this.config = this.getDefaultConfig()
  }

  // 配置管理
  getConfig(): AppConfig {
    return { ...this.config }
  }

  updateConfig(updates: Partial<AppConfig>): void {
    this.config = { ...this.config, ...updates }
    this.emit('config_changed', this.config)
  }

  // MCP 请求管理
  addMcpRequest(request: PopupRequest): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.activeRequests.delete(request.id)
        reject(new Error('Request timeout'))
      }, (request.timeout || 300) * 1000)

      this.activeRequests.set(request.id, {
        request,
        resolve,
        reject,
        timeout,
        createdAt: new Date()
      })

      // 广播到前端
      this.emit('mcp_popup', request)
    })
  }

  resolveMcpRequest(requestId: string, response: string): boolean {
    const requestState = this.activeRequests.get(requestId)
    if (requestState) {
      clearTimeout(requestState.timeout)
      requestState.resolve(response)
      this.activeRequests.delete(requestId)
      return true
    }
    return false
  }

  getActiveMcpRequests(): PopupRequest[] {
    return Array.from(this.activeRequests.values()).map(state => state.request)
  }

  // 客户端连接管理
  addClient(clientId: string, socket: any): void {
    this.connectedClients.set(clientId, socket)
  }

  removeClient(clientId: string): void {
    this.connectedClients.delete(clientId)
  }

  getConnectedClients(): Map<string, any> {
    return this.connectedClients
  }

  private getDefaultConfig(): AppConfig {
    return {
      ui_config: {
        theme: 'light',
        always_on_top: false,
        window_config: {
          fixed: true,
          fixed_width: 600,
          fixed_height: 800,
          free_width: 600,
          free_height: 800
        },
        audio_notification: true,
        audio_url: undefined
      },
      reply_config: {
        default_reply: '',
        quick_replies: [],
        auto_reply_enabled: false
      },
      custom_prompt_config: {
        enabled: true,
        max_prompts: 50,
        prompts: []
      },
      shortcut_config: {
        shortcuts: {}
      }
    }
  }
}
```

#### 4. API 路由实现

**src/node_bridge/src/routes/index.ts**
```typescript
import { Express } from 'express'
import { AppState } from '../services/state'
import { setupAppRoutes } from './app'
import { setupUiRoutes } from './ui'
import { setupMcpRoutes } from './mcp'
import { setupPromptRoutes } from './prompts'
import { setupShortcutRoutes } from './shortcuts'
import { setupAudioRoutes } from './audio'

export function setupRoutes(app: Express, appState: AppState): void {
  // 健康检查
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    })
  })

  // API 路由
  setupAppRoutes(app, appState)
  setupUiRoutes(app, appState)
  setupMcpRoutes(app, appState)
  setupPromptRoutes(app, appState)
  setupShortcutRoutes(app, appState)
  setupAudioRoutes(app, appState)

  // 404 处理
  app.use('*', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' })
  })
}
```

**src/node_bridge/src/routes/mcp.ts**
```typescript
import { Express, Request, Response } from 'express'
import { AppState } from '../services/state'
import { PopupRequest } from '../types'

export function setupMcpRoutes(app: Express, appState: AppState): void {
  // 创建 MCP 弹窗请求 (由 Rust MCP 服务调用)
  app.post('/api/mcp/popup', async (req: Request, res: Response) => {
    try {
      const request: PopupRequest = req.body

      // 验证请求数据
      if (!request.id || !request.message) {
        return res.status(400).json({ error: 'Missing required fields' })
      }

      // 添加到状态管理并等待响应
      const response = await appState.addMcpRequest(request)

      res.json({ response })
    } catch (error) {
      console.error('MCP popup creation failed:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  // 提交用户响应 (由 Vue 前端调用)
  app.post('/api/mcp/response', (req: Request, res: Response) => {
    try {
      const { request_id, response } = req.body

      if (!request_id || response === undefined) {
        return res.status(400).json({ error: 'Missing required fields' })
      }

      const success = appState.resolveMcpRequest(request_id, response)

      if (success) {
        res.json({ success: true })
      } else {
        res.status(404).json({ error: 'Request not found' })
      }
    } catch (error) {
      console.error('MCP response submission failed:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  // 获取活跃的 MCP 请求列表
  app.get('/api/mcp/requests', (req: Request, res: Response) => {
    try {
      const requests = appState.getActiveMcpRequests()
      res.json({ requests })
    } catch (error) {
      console.error('Failed to get MCP requests:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  // 取消 MCP 请求
  app.delete('/api/mcp/requests/:id', (req: Request, res: Response) => {
    try {
      const requestId = req.params.id
      const success = appState.resolveMcpRequest(requestId, 'CANCELLED')

      if (success) {
        res.json({ success: true })
      } else {
        res.status(404).json({ error: 'Request not found' })
      }
    } catch (error) {
      console.error('Failed to cancel MCP request:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  })
}
```

#### 5. WebSocket 处理

**src/node_bridge/src/websocket/index.ts**
```typescript
import { Server as SocketIOServer, Socket } from 'socket.io'
import { AppState } from '../services/state'
import { v4 as uuidv4 } from 'uuid'

export function setupWebSocket(io: SocketIOServer, appState: AppState): void {
  io.on('connection', (socket: Socket) => {
    const clientId = uuidv4()
    console.log(`🔌 客户端连接: ${clientId}`)

    // 注册客户端
    appState.addClient(clientId, socket)

    // 发送连接确认
    socket.emit('connected', { clientId, timestamp: new Date().toISOString() })

    // 处理认证
    socket.on('auth', (data) => {
      console.log(`🔐 客户端认证: ${clientId}`, data)
      socket.emit('auth_success', { clientId })
    })

    // 处理 MCP 响应
    socket.on('mcp_response', (data) => {
      const { request_id, response } = data
      const success = appState.resolveMcpRequest(request_id, response)

      socket.emit('mcp_response_ack', {
        request_id,
        success,
        timestamp: new Date().toISOString()
      })
    })

    // 处理配置更新
    socket.on('config_update', (data) => {
      try {
        appState.updateConfig(data.config)
        socket.emit('config_update_ack', { success: true })
      } catch (error) {
        socket.emit('config_update_ack', { success: false, error: error.message })
      }
    })

    // 处理心跳
    socket.on('ping', (data) => {
      socket.emit('pong', { timestamp: Date.now() })
    })

    // 处理断开连接
    socket.on('disconnect', (reason) => {
      console.log(`🔌 客户端断开: ${clientId}, 原因: ${reason}`)
      appState.removeClient(clientId)
    })
  })

  // 监听应用状态事件并广播
  appState.on('mcp_popup', (request) => {
    io.emit('mcp_popup', request)
  })

  appState.on('config_changed', (config) => {
    io.emit('config_changed', config)
  })

  console.log('📡 WebSocket 事件监听器已设置')
}
```

### 第二阶段: Vue 前端改造

#### 1. API 客户端实现

**src/frontend/src/api/client.ts**
```typescript
import axios, { AxiosInstance, AxiosResponse } from 'axios'
import { io, Socket } from 'socket.io-client'

class ApiClient {
  private http: AxiosInstance
  private socket: Socket | null = null
  private eventHandlers: Map<string, Function[]> = new Map()

  constructor(baseURL = 'http://localhost:8000') {
    this.http = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    this.setupInterceptors()
  }

  // HTTP 请求方法
  async get<T>(url: string): Promise<T> {
    const response: AxiosResponse<T> = await this.http.get(url)
    return response.data
  }

  async post<T>(url: string, data?: any): Promise<T> {
    const response: AxiosResponse<T> = await this.http.post(url, data)
    return response.data
  }

  async put<T>(url: string, data?: any): Promise<T> {
    const response: AxiosResponse<T> = await this.http.put(url, data)
    return response.data
  }

  async delete<T>(url: string): Promise<T> {
    const response: AxiosResponse<T> = await this.http.delete(url)
    return response.data
  }

  // WebSocket 连接
  connectSocket(url = 'ws://localhost:8000/ws'): void {
    if (this.socket?.connected) {
      return
    }

    this.socket = io(url, {
      transports: ['websocket'],
      autoConnect: true
    })

    this.setupSocketEvents()
  }

  disconnectSocket(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  // Socket 事件发送
  emitSocket(event: string, data?: any): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data)
    } else {
      console.warn('Socket not connected')
    }
  }

  // 事件监听
  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, [])
    }
    this.eventHandlers.get(event)!.push(handler)
  }

  off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    }
  }

  private setupInterceptors(): void {
    // 请求拦截器
    this.http.interceptors.request.use(
      (config) => {
        console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`)
        return config
      },
      (error) => {
        console.error('❌ API Request Error:', error)
        return Promise.reject(error)
      }
    )

    // 响应拦截器
    this.http.interceptors.response.use(
      (response) => {
        console.log(`✅ API Response: ${response.status} ${response.config.url}`)
        return response
      },
      (error) => {
        console.error('❌ API Response Error:', error.response?.data || error.message)
        return Promise.reject(error)
      }
    )
  }

  private setupSocketEvents(): void {
    if (!this.socket) return

    this.socket.on('connect', () => {
      console.log('🔌 Socket 连接成功')
      this.emit('socket:connected')
    })

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Socket 断开连接:', reason)
      this.emit('socket:disconnected', reason)
    })

    this.socket.on('mcp_popup', (data) => {
      this.emit('mcp:popup', data)
    })

    this.socket.on('config_changed', (data) => {
      this.emit('config:changed', data)
    })

    this.socket.on('theme_changed', (data) => {
      this.emit('theme:changed', data)
    })

    this.socket.on('notification', (data) => {
      this.emit('notification', data)
    })
  }

  private emit(event: string, data?: any): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.forEach(handler => handler(data))
    }
  }
}

export const apiClient = new ApiClient()
```

#### 2. Composables 改造

**src/frontend/src/composables/useApiClient.ts**
```typescript
import { ref, onMounted, onUnmounted } from 'vue'
import { apiClient } from '@/api/client'

export function useApiClient() {
  const isConnected = ref(false)
  const isSocketConnected = ref(false)
  const connectionError = ref<string | null>(null)

  const connect = () => {
    try {
      apiClient.connectSocket()
    } catch (error) {
      connectionError.value = error instanceof Error ? error.message : '连接失败'
    }
  }

  const disconnect = () => {
    apiClient.disconnectSocket()
  }

  // 事件处理器
  const handleSocketConnected = () => {
    isSocketConnected.value = true
    connectionError.value = null
  }

  const handleSocketDisconnected = (reason: string) => {
    isSocketConnected.value = false
    if (reason !== 'io client disconnect') {
      connectionError.value = `连接断开: ${reason}`
    }
  }

  onMounted(() => {
    apiClient.on('socket:connected', handleSocketConnected)
    apiClient.on('socket:disconnected', handleSocketDisconnected)
    connect()
  })

  onUnmounted(() => {
    apiClient.off('socket:connected', handleSocketConnected)
    apiClient.off('socket:disconnected', handleSocketDisconnected)
    disconnect()
  })

  return {
    isConnected,
    isSocketConnected,
    connectionError,
    connect,
    disconnect,
    apiClient
  }
}
```

### 第三阶段: Rust MCP 服务改造

#### 1. HTTP 客户端集成

**src/rust/mcp/handlers/popup.rs** (修改)
```rust
use anyhow::Result;
use reqwest::Client;
use serde_json::json;
use tokio::time::{timeout, Duration};

use crate::mcp::types::PopupRequest;

/// 创建弹窗 - 通过 Node.js Bridge API
pub async fn create_popup(request: &PopupRequest) -> Result<String> {
    let client = Client::new();

    // 调用 Node.js Bridge API
    let response = client
        .post("http://127.0.0.1:8000/api/mcp/popup")
        .json(request)
        .send()
        .await?;

    if response.status().is_success() {
        let result: serde_json::Value = response.json().await?;

        if let Some(response_str) = result.get("response").and_then(|r| r.as_str()) {
            Ok(response_str.to_string())
        } else {
            Ok("NO_RESPONSE".to_string())
        }
    } else {
        let error_text = response.text().await.unwrap_or_default();
        anyhow::bail!("Node.js Bridge API 请求失败: {}", error_text);
    }
}

/// 带超时的弹窗创建
pub async fn create_popup_with_timeout(
    request: &PopupRequest,
    timeout_secs: u64
) -> Result<String> {
    match timeout(Duration::from_secs(timeout_secs), create_popup(request)).await {
        Ok(result) => result,
        Err(_) => Ok("TIMEOUT".to_string())
    }
}
```

## 部署配置

### Docker Compose 配置

**docker-compose.yml**
```yaml
version: '3.8'

services:
  node-bridge:
    build:
      context: ./src/node_bridge
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    volumes:
      - ./config:/app/config
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  vue-frontend:
    build:
      context: ./src/frontend
      dockerfile: Dockerfile
    ports:
      - "8080:80"
    depends_on:
      - node-bridge
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:80"]
      interval: 30s
      timeout: 10s
      retries: 3

  mcp-service:
    build:
      context: ./src/rust
      dockerfile: Dockerfile
    environment:
      - RUST_LOG=info
      - BRIDGE_URL=http://node-bridge:3000
    depends_on:
      - node-bridge
    restart: unless-stopped
    volumes:
      - ./config:/app/config

networks:
  default:
    name: cunzhi-network
```

### 开发脚本

**scripts/dev.sh**
```bash
#!/bin/bash

echo "🚀 启动寸止开发环境..."

# 启动 Node.js Bridge
echo "📡 启动 Node.js Bridge..."
cd src/node_bridge
npm run dev &
NODE_PID=$!

# 等待 Bridge 启动
sleep 3

# 启动 Vue 前端
echo "🎨 启动 Vue 前端..."
cd ../frontend
npm run dev &
VUE_PID=$!

# 启动 Rust MCP 服务 (开发模式)
echo "🦀 Rust MCP 服务已准备就绪 (手动启动)"

# 等待中断信号
trap "echo '🛑 停止所有服务...'; kill $NODE_PID $VUE_PID 2>/dev/null; exit" INT TERM

echo "✅ 开发环境启动完成!"
echo "📡 Node.js Bridge: http://localhost:3000"
echo "🎨 Vue 前端: http://localhost:8080"
echo "🦀 MCP 服务: 使用 'cargo run --mcp-request <file>' 启动"

wait
```

## 测试策略

### 单元测试

#### Node.js 测试
```bash
# 安装测试依赖
npm install -D jest @types/jest supertest

# 运行测试
npm test
```

#### Vue 测试
```bash
# 安装测试依赖
npm install -D @vue/test-utils vitest jsdom

# 运行测试
npm run test
```

### 集成测试

**tests/integration/mcp-flow.test.ts**
```typescript
import { apiClient } from '@/api/client'
import { PopupRequest } from '@/types'

describe('MCP 完整流程测试', () => {
  test('创建弹窗并响应', async () => {
    const request: PopupRequest = {
      id: 'test-123',
      message: '测试消息',
      predefined_options: ['选项1', '选项2'],
      is_markdown: false,
      source: 'test'
    }

    // 模拟 MCP 服务创建弹窗
    const createPromise = apiClient.post('/api/mcp/popup', request)

    // 模拟前端响应
    setTimeout(() => {
      apiClient.post('/api/mcp/response', {
        request_id: 'test-123',
        response: '选项1'
      })
    }, 100)

    const result = await createPromise
    expect(result.response).toBe('选项1')
  })
})
```

## 性能优化

### 1. 连接池管理
- HTTP 客户端连接复用
- WebSocket 连接心跳检测
- 自动重连机制

### 2. 缓存策略
- 配置缓存
- API 响应缓存
- 静态资源缓存

### 3. 错误处理
- 优雅降级
- 超时处理
- 重试机制

## 监控和日志

### 1. 日志配置
- 结构化日志
- 日志级别控制
- 日志轮转

### 2. 性能监控
- API 响应时间
- WebSocket 连接状态
- 内存使用情况

### 3. 错误追踪
- 错误堆栈收集
- 用户行为追踪
- 性能瓶颈分析

这个架构方案保持了现有功能的完整性，同时实现了三层分离，提供了更好的可扩展性和维护性。
```
