# 寸止分布式系统 API 参考文档

## Flutter 移动端 API 请求

### 1. 健康检查和探测 API

#### 系统健康检查
```typescript
GET /api/health
Response: {
  status: 'ok' | 'warning' | 'error'
  timestamp: string
  uptime: number
  services: {
    database: 'ok' | 'error'
    redis: 'ok' | 'error'
    websocket: 'ok' | 'error'
    queue: 'ok' | 'warning' | 'error'
  }
  metrics: {
    active_connections: number
    active_mcp_requests: number
    total_processed_today: number
    error_rate_24h: number
  }
}
```

#### MCP 服务状态
```typescript
GET /api/mcp/status
Response: {
  connected: boolean
  last_heartbeat: string
  active_requests: number
  total_processed: number
  error_count_24h: number
  average_response_time: number
}
```

#### 客户端连接状态
```typescript
GET /api/clients/status
Response: {
  total_clients: number
  flutter_clients: number
  web_clients: number
  mcp_server_clients: number
  last_activity: string
  client_details: Array<{
    id: string
    type: string
    connected_at: string
    last_activity: string
  }>
}
```

### 2. 应用配置管理

#### 获取应用信息
```typescript
GET /api/app/info
Response: {
  name: string
  version: string
  build: string
  environment: string
}
```

#### 获取完整配置
```typescript
GET /api/app/config
Response: AppConfig
```

#### 更新配置
```typescript
POST /api/app/config
Body: Partial<AppConfig>
Response: { success: boolean }
```

### 3. UI 设置和通知配置

#### 主题管理
```typescript
// 获取主题
GET /api/ui/theme
Response: { theme: 'light' | 'dark' | 'system' }

// 设置主题
POST /api/ui/theme
Body: { theme: 'light' | 'dark' | 'system' }
Response: { success: boolean }
```

#### 通知配置
```typescript
// 获取通知配置
GET /api/ui/notification-config
Response: {
  enabled: boolean
  sound_enabled: boolean
  vibration_enabled: boolean
  priority: 'normal' | 'high'
  custom_sound: string | null
  quiet_hours: {
    enabled: boolean
    start_time: string
    end_time: string
  }
}

// 更新通知配置
POST /api/ui/notification-config
Body: Partial<NotificationConfig>
Response: { success: boolean }
```

#### 应用 UI 配置
```typescript
// 获取应用 UI 配置
GET /api/ui/app-config
Response: {
  language: string
  auto_response_timeout: number
  show_markdown_preview: boolean
  compact_mode: boolean
  animations_enabled: boolean
}

// 更新应用 UI 配置
POST /api/ui/app-config
Body: Partial<AppUIConfig>
Response: { success: boolean }
```

### 4. MCP 交互管理

#### 响应 MCP 请求
```typescript
POST /api/mcp/response
Body: {
  request_id: string
  response: any
  response_time: number
}
Response: { success: boolean }
```

#### 获取活跃请求
```typescript
GET /api/mcp/requests
Response: {
  requests: PopupRequest[]
  total: number
}
```

#### 取消请求
```typescript
DELETE /api/mcp/requests/:id
Response: { success: boolean }
```

#### 批量响应请求
```typescript
POST /api/mcp/batch-response
Body: {
  responses: Array<{
    request_id: string
    response: any
  }>
}
Response: {
  success: boolean
  processed: number
  failed: number
}
```

### 5. 推送通知管理

#### 注册设备推送 Token
```typescript
POST /api/notifications/register-device
Body: {
  device_token: string
  platform: 'android' | 'ios'
  device_id: string
  app_version: string
}
Response: {
  success: boolean
  device_id: string
}
```

#### 获取通知历史
```typescript
GET /api/notifications/history?page=1&limit=20&type=mcp_popup
Response: {
  notifications: Array<{
    id: string
    title: string
    body: string
    type: string
    data: object
    sent_at: string
    read_at: string | null
    status: 'sent' | 'delivered' | 'read'
  }>
  pagination: {
    current_page: number
    total_pages: number
    total_items: number
    per_page: number
  }
}
```

#### 标记通知为已读
```typescript
POST /api/notifications/mark-read
Body: {
  notification_ids: string[]
}
Response: { success: boolean }
```

### 6. 设备管理

#### 获取设备列表
```typescript
GET /api/devices
Response: {
  devices: Array<{
    id: string
    device_token: string
    platform: string
    app_version: string
    last_active: string
    status: 'online' | 'offline'
  }>
  total: number
}
```

#### 同步设备状态
```typescript
POST /api/devices/sync
Body: {
  device_id: string
  last_sync: string
  app_state: {
    active_requests: number
    last_activity: string
    notification_enabled: boolean
  }
}
Response: {
  success: boolean
  sync_data: {
    server_time: string
    pending_notifications: number
    config_updates: object
  }
}
```

#### 删除设备
```typescript
DELETE /api/devices/:id
Response: { success: boolean }
```

### 7. 自定义 Prompt 管理

#### 获取 Prompt 配置
```typescript
GET /api/prompts
Response: CustomPromptConfig
```

#### 添加 Prompt
```typescript
POST /api/prompts
Body: CustomPrompt
Response: { success: boolean }
```

#### 更新 Prompt
```typescript
PUT /api/prompts/:id
Body: CustomPrompt
Response: { success: boolean }
```

#### 删除 Prompt
```typescript
DELETE /api/prompts/:id
Response: { success: boolean }
```

#### 重新排序
```typescript
POST /api/prompts/reorder
Body: { prompt_ids: string[] }
Response: { success: boolean }
```

### 5. 快捷键管理

#### 获取快捷键配置
```typescript
GET /api/shortcuts
Response: ShortcutConfig
```

#### 更新快捷键
```typescript
POST /api/shortcuts/:id
Body: ShortcutBinding
Response: { success: boolean }
```

#### 重置快捷键
```typescript
POST /api/shortcuts/reset
Response: { success: boolean }
```

### 6. 音频通知

#### 播放通知音频
```typescript
POST /api/audio/play
Body: { url?: string }
Response: { success: boolean }
```

#### 停止音频
```typescript
POST /api/audio/stop
Response: { success: boolean }
```

#### 测试音频
```typescript
POST /api/audio/test
Body: { url: string }
Response: { success: boolean }
```

## MCP 服务需要的 API 请求

### 1. 弹窗创建

#### 创建弹窗请求
```typescript
POST /api/mcp/popup
Body: PopupRequest
Response: { response: string }

// PopupRequest 结构
interface PopupRequest {
  id: string
  message: string
  predefined_options?: string[]
  is_markdown?: boolean
  timeout?: number
  source: string
}
```

### 2. 配置同步

#### 获取应用配置
```typescript
GET /api/app/config
Response: AppConfig
```

#### 更新配置
```typescript
POST /api/app/config
Body: Partial<AppConfig>
Response: { success: boolean }
```

## WebSocket 事件规范

### 客户端发送事件

#### 连接认证
```typescript
{
  type: 'auth',
  token?: string,
  client_type: 'frontend' | 'mcp_server'
}
```

#### MCP 响应
```typescript
{
  type: 'mcp_response',
  request_id: string,
  response: any
}
```

#### 配置更新
```typescript
{
  type: 'config_update',
  config: Partial<AppConfig>
}
```

#### 心跳检测
```typescript
{
  type: 'ping',
  timestamp: number
}
```

### 服务器发送事件

#### MCP 弹窗请求
```typescript
{
  type: 'mcp_popup',
  request: PopupRequest
}
```

#### 配置更新通知
```typescript
{
  type: 'config_changed',
  config: AppConfig
}
```

#### 主题更新
```typescript
{
  type: 'theme_changed',
  theme: 'light' | 'dark'
}
```

#### 系统通知
```typescript
{
  type: 'notification',
  level: 'info' | 'warning' | 'error',
  message: string
}
```

#### 心跳响应
```typescript
{
  type: 'pong',
  timestamp: number
}
```

## 错误处理

### HTTP 错误码

- `200` - 成功
- `400` - 请求参数错误
- `401` - 未授权
- `404` - 资源不存在
- `500` - 服务器内部错误
- `503` - 服务不可用

### 错误响应格式

```typescript
{
  error: string,
  code?: string,
  details?: any
}
```

## 数据类型定义

### AppConfig
```typescript
interface AppConfig {
  ui_config: UiConfig
  reply_config: ReplyConfig
  custom_prompt_config: CustomPromptConfig
  shortcut_config: ShortcutConfig
  telegram_config?: TelegramConfig
}
```

### UiConfig
```typescript
interface UiConfig {
  theme: 'light' | 'dark'
  always_on_top: boolean
  window_config: WindowConfig
  audio_notification: boolean
  audio_url?: string
}
```

### WindowConfig
```typescript
interface WindowConfig {
  fixed: boolean
  fixed_width: number
  fixed_height: number
  free_width: number
  free_height: number
}
```

### CustomPrompt
```typescript
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
```

### ShortcutBinding
```typescript
interface ShortcutBinding {
  key: string
  modifiers: string[]
  enabled: boolean
}
```
