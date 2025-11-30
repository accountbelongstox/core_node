# 寸止 MCP 服务完整 API 规范

基于现有 Tauri 命令的完整分析，以下是所有需要实现的 Laravel API 端点。

## 数据类型定义

### WindowConfig
```php
{
  "fixed": boolean,
  "fixed_width": number,
  "fixed_height": number,
  "free_width": number,
  "free_height": number
}
```

### ReplyConfig
```php
{
  "default_reply": string,
  "quick_replies": string[],
  "auto_reply_enabled": boolean
}
```

### CustomPrompt
```php
{
  "id": string,
  "name": string,
  "content": string,
  "sort_order": number,
  "enabled": boolean,
  "is_conditional": boolean,
  "current_state": boolean,
  "created_at": string,
  "updated_at": string
}
```

### PopupRequest
```php
{
  "id": string,
  "message": string,
  "predefined_options": string[] | null,
  "is_markdown": boolean | null,
  "timeout": number | null,
  "source": string
}
```

### ImageAttachment
```php
{
  "data": string,
  "mime_type": string,
  "filename": string | null
}
```

### ShortcutBinding
```php
{
  "key": string,
  "modifiers": string[],
  "enabled": boolean
}
```

### TelegramConfig
```php
{
  "enabled": boolean,
  "bot_token": string | null,
  "chat_id": string | null,
  "hide_frontend_popup": boolean
}
```

## 基础应用 API

### 1. 应用信息
```php
GET /api/app/info
Response: {"version": "寸止 v1.0.0"}
```

### 2. 窗口置顶控制
```php
GET /api/app/always-on-top
Response: {"enabled": boolean}

POST /api/app/always-on-top
Body: {"enabled": boolean}
Response: {"success": boolean}
```

### 3. 窗口状态同步
```php
POST /api/app/sync-window-state
Response: {"success": boolean}
```

### 4. 配置重载
```php
POST /api/app/reload-config
Response: {"success": boolean}
```

## 主题和 UI 配置 API

### 5. 主题管理
```php
GET /api/ui/theme
Response: {"theme": "light|dark"}

POST /api/ui/theme
Body: {"theme": "light|dark"}
Response: {"success": boolean}
```

### 6. 窗口配置
```php
GET /api/ui/window-config
Response: {
  "fixed": boolean,
  "fixed_width": number,
  "fixed_height": number,
  "free_width": number,
  "free_height": number
}

POST /api/ui/window-config
Body: WindowConfig
Response: {"success": boolean}
```

### 7. 回复配置
```php
GET /api/ui/reply-config
Response: {
  "default_reply": string,
  "quick_replies": string[],
  "auto_reply_enabled": boolean
}

POST /api/ui/reply-config
Body: ReplyConfig
Response: {"success": boolean}
```

### 8. 窗口设置
```php
GET /api/ui/window-settings
Response: {
  "fixed": boolean,
  "current_width": number,
  "current_height": number,
  "fixed_width": number,
  "fixed_height": number,
  "free_width": number,
  "free_height": number
}

POST /api/ui/window-settings
Body: WindowSettings
Response: {"success": boolean}

GET /api/ui/window-settings/{mode}
Params: mode = "fixed|free"
Response: {
  "width": number,
  "height": number,
  "fixed": boolean
}
```

### 9. 窗口约束和尺寸
```php
GET /api/ui/window-constraints
Response: {
  "min_width": number,
  "min_height": number,
  "max_width": number,
  "max_height": number,
  "ui_timings": object
}

GET /api/ui/current-window-size
Response: {
  "width": number,
  "height": number
}

POST /api/ui/apply-window-constraints
Response: {"success": boolean}

POST /api/ui/update-window-size
Body: {"width": number, "height": number}
Response: {"success": boolean}
```

## 音频通知 API

### 10. 音频通知控制
```php
GET /api/audio/notification-enabled
Response: {"enabled": boolean}

POST /api/audio/notification-enabled
Body: {"enabled": boolean}
Response: {"success": boolean}
```

### 11. 音频 URL 管理
```php
GET /api/audio/url
Response: {"url": string}

POST /api/audio/url
Body: {"url": string}
Response: {"success": boolean}
```

### 12. 音频播放控制
```php
POST /api/audio/play-notification
Response: {"success": boolean}

POST /api/audio/test
Response: {"success": boolean}

POST /api/audio/stop
Response: {"success": boolean}
```

### 13. 音频资源管理
```php
GET /api/audio/available-assets
Response: {
  "assets": [
    {
      "id": string,
      "name": string,
      "filename": string
    }
  ]
}

POST /api/audio/refresh-assets
Response: {"success": boolean}
```

## MCP 交互 API

### 14. MCP 响应处理
```php
POST /api/mcp/response
Body: {"response": object}
Response: {"success": boolean}
```

### 15. CLI 参数获取
```php
GET /api/mcp/cli-args
Response: {
  "mcp_request": string | null
}
```

### 16. MCP 请求读取
```php
POST /api/mcp/read-request
Body: {"file_path": string}
Response: object
```

### 17. 图片文件选择
```php
GET /api/mcp/select-images
Response: {"images": string[]}
```

### 18. MCP 响应构建
```php
POST /api/mcp/build-send-response
Body: {
  "user_input": string | null,
  "selected_options": string[],
  "images": ImageAttachment[],
  "request_id": string | null,
  "source": string
}
Response: {"response": string}

POST /api/mcp/build-continue-response
Body: {
  "request_id": string | null,
  "source": string
}
Response: {"response": string}
```

### 19. 测试弹窗
```php
POST /api/mcp/create-test-popup
Body: PopupRequest
Response: {"response": string}
```

## 自定义 Prompt API

### 20. Prompt 配置管理
```php
GET /api/prompts/config
Response: {
  "enabled": boolean,
  "max_prompts": number,
  "prompts": CustomPrompt[]
}
```

### 21. Prompt CRUD 操作
```php
POST /api/prompts
Body: CustomPrompt
Response: {"success": boolean}

PUT /api/prompts/{id}
Body: CustomPrompt
Response: {"success": boolean}

DELETE /api/prompts/{id}
Response: {"success": boolean}
```

### 22. Prompt 状态管理
```php
POST /api/prompts/enabled
Body: {"enabled": boolean}
Response: {"success": boolean}

POST /api/prompts/reorder
Body: {"prompt_ids": string[]}
Response: {"success": boolean}

POST /api/prompts/{id}/conditional-state
Body: {"state": boolean}
Response: {"success": boolean}
```

## 快捷键配置 API

### 23. 快捷键管理
```php
GET /api/shortcuts/config
Response: {
  "shortcuts": {
    [key: string]: {
      "key": string,
      "modifiers": string[],
      "enabled": boolean
    }
  }
}

POST /api/shortcuts/{id}
Body: ShortcutBinding
Response: {"success": boolean}

POST /api/shortcuts/reset
Response: {"success": boolean}
```

## Telegram 集成 API

### 24. Telegram 配置
```php
GET /api/telegram/config
Response: {
  "enabled": boolean,
  "bot_token": string | null,
  "chat_id": string | null,
  "hide_frontend_popup": boolean
}

POST /api/telegram/config
Body: TelegramConfig
Response: {"success": boolean}
```

### 25. Telegram 连接测试
```php
POST /api/telegram/test-connection
Response: {"success": boolean, "message": string}

POST /api/telegram/auto-get-chat-id
Response: {"chat_id": string | null}

POST /api/telegram/start-sync
Response: {"success": boolean}
```

## 系统控制 API

### 26. 外部链接和退出
```php
POST /api/system/open-url
Body: {"url": string}
Response: {"success": boolean}

POST /api/system/exit
Response: {"success": boolean}

POST /api/system/handle-exit-request
Response: {"exited": boolean}

POST /api/system/force-exit
Response: {"success": boolean}

POST /api/system/reset-exit-attempts
Response: {"success": boolean}
```

## 更新管理 API

### 27. 应用更新
```php
GET /api/update/check
Response: {
  "available": boolean,
  "version": string | null,
  "download_url": string | null
}

POST /api/update/download-install
Response: {"success": boolean}

GET /api/update/current-version
Response: {"version": string}

POST /api/update/restart
Response: {"success": boolean}
```

## 配置文件 API

### 28. 配置文件路径
```php
GET /api/config/file-path
Response: {"path": string}
```

## WebSocket 事件规范

### 客户端发送事件
```javascript
// 连接认证
{
  "event": "auth",
  "data": {
    "token": string | null,
    "client_type": "frontend" | "mcp_server"
  }
}

// MCP 响应
{
  "event": "mcp_response", 
  "data": {
    "request_id": string,
    "response": any
  }
}

// 配置更新
{
  "event": "config_update",
  "data": {
    "config": object
  }
}

// 心跳
{
  "event": "ping",
  "data": {
    "timestamp": number
  }
}
```

### 服务器发送事件
```javascript
// MCP 弹窗请求
{
  "event": "mcp_popup",
  "data": PopupRequest
}

// 配置更新通知
{
  "event": "config_changed", 
  "data": AppConfig
}

// 主题更新
{
  "event": "theme_changed",
  "data": {
    "theme": "light" | "dark"
  }
}

// 系统通知
{
  "event": "notification",
  "data": {
    "level": "info" | "warning" | "error",
    "message": string
  }
}

// 心跳响应
{
  "event": "pong",
  "data": {
    "timestamp": number
  }
}
```
