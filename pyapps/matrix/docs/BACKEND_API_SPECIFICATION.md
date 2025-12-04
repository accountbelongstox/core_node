# Matrix 后端 API 规范文档

**版本**: v1.0.0
**最后更新**: 2025-12-03
**架构**: RPC v2 (FastAPI + Uvicorn)
**协议**: REST API + WebSocket

---

## 📊 项目概述

Matrix 是一个 Android 设备群控系统后端，提供设备镜像、批量控制、文件传输等功能。

### 核心特性
- ✅ **设备管理**: 扫描、连接、断开 Android 设备
- ✅ **视频流**: 基于 scrcpy 的 H.264 视频流推送
- ✅ **设备控制**: 触摸、按键、滑动、系统键、剪贴板
- ✅ **屏幕管理**: 电源、亮度、旋转控制
- ✅ **文件传输**: 文件推送、APK 安装/卸载、包列表
- ✅ **录制截图**: 屏幕录制、截图功能
- ✅ **群控操作**: 批量截图、录制、控制
- ✅ **配置管理**: 全局配置、设备配置
- ✅ **健康检查**: 系统状态、资源监控

---

## 🏗️ 架构设计

### 技术栈
```
后端框架: FastAPI (RPC v2)
Web 服务器: Uvicorn
设备通信: ADB + scrcpy
视频编码: H.264 / H.265
传输协议: WebSocket (视频流) + REST API (控制)
启动器: pycore.pylauncher (统一服务管理)
```

### 服务架构
```
┌─────────────────────────────────────────────────┐
│              pylauncher 统一管理                 │
├─────────────────────────────────────────────────┤
│  ┌───────────────┐  ┌────────────────────────┐ │
│  │  Heartbeat    │  │  RPC v2 Service        │ │
│  │  (心跳服务)    │  │  (FastAPI + 所有路由)   │ │
│  └───────────────┘  └─────────┬──────────────┘ │
│  ┌───────────────┐            │                 │
│  │  UI Service   │  ┌─────────▼──────────────┐ │
│  │  (PySide6)    │  │  Matrix API Routers    │ │
│  └───────────────┘  │  - health_router       │ │
│  ┌───────────────┐  │  - device_router       │ │
│  │  Tray Service │  │  - screen_router       │ │
│  │  (系统托盘)    │  │  - file_router         │ │
│  └───────────────┘  │  - recording_router    │ │
│                     │  - group_router        │ │
│                     │  - config_router       │ │
│                     │  - unified_ws_router           │ │
│                     └────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### 目录结构
```
pyapps/matrix/
├── matrix_main.py              # 唯一主入口
├── matrix_config/              # 配置
│   └── config.py               # 统一配置
├── api/                        # API 路由
│   ├── health_routes.py        # 健康检查
│   ├── device_routes.py        # 设备管理
│   ├── screen_routes.py        # 屏幕控制
│   ├── file_routes.py          # 文件管理
│   ├── recording_routes.py     # 录制截图
│   ├── group_routes.py         # 群控批量
│   ├── config_routes.py        # 配置管理
│   └── unified_ws.py           # Unified WebSocket endpoint
├── services/                   # 业务逻辑
│   ├── device_service.py       # 设备服务
│   ├── control_service.py      # 控制服务
│   ├── screen_service.py       # 屏幕服务
│   ├── file_service.py         # 文件服务
│   ├── recording_service.py    # 录制服务
│   ├── group_service.py        # 群控服务
│   ├── config_service.py       # 配置服务
│   └── video_stream_service.py # 视频流服务
└── controller/                 # 控制器
    ├── launcher_builder.py     # 构建 LauncherConfig
    ├── frontend_compiler.py    # 前端编译
    └── event_handlers.py       # 事件处理
```

---

## 🌐 API 端点总览

### Base URL
```
HTTP: http://localhost:8000
WebSocket: ws://localhost:8000
```

### API 分类统计
| 分类 | 端点数 | 状态 |
|-----|-------|------|
| **健康检查** | 3 | ✅ 完成 |
| **设备管理** | 5 | ✅ 完成 |
| **屏幕控制** | 7 | ✅ 完成 |
| **文件管理** | 5 | ✅ 完成 |
| **录制截图** | 4 | ✅ 完成 |
| **群控操作** | 7 | ✅ 完成 |
| **配置管理** | 6 | ✅ 完成 |
| **WebSocket** | 3 | ✅ 完成 |
| **总计** | **40** | **100%** |

---

## 📡 详细 API 规范

## 1. 健康检查 (Health Check)

### 1.1 基础健康检查
```http
GET /health
```

**响应**:
```json
{
  "status": "healthy",
  "service": "pyMatrix",
  "version": "1.0.0",
  "timestamp": "2025-12-03T10:00:00Z"
}
```

### 1.2 详细健康检查
```http
GET /health/detailed
```

**响应**:
```json
{
  "status": "healthy",
  "service": {
    "name": "pyMatrix",
    "version": "1.0.0",
    "description": "Android Device Mirroring and Group Control System"
  },
  "timestamp": "2025-12-03T10:00:00Z",
  "uptime_seconds": 3600,
  "system": {
    "platform": "Windows",
    "platform_version": "10.0.19045",
    "python_version": "3.10.0",
    "architecture": "AMD64"
  },
  "resources": {
    "cpu": {
      "usage_percent": 25.5,
      "cores": 8
    },
    "memory": {
      "total_mb": 16384.0,
      "available_mb": 8192.0,
      "used_percent": 50.0
    },
    "disk": {
      "total_gb": 500.0,
      "free_gb": 250.0,
      "used_percent": 50.0
    }
  }
}
```

### 1.3 根端点
```http
GET /
```

---

## 2. 设备管理 (Device Management)

### 2.1 列出所有设备
```http
GET /api/devices
```

**响应**:
```json
{
  "devices": [
    {
      "serial": "ABC123DEF456",
      "status": "online",
      "model": "SM-G9900",
      "manufacturer": "samsung",
      "android_version": null
    }
  ],
  "count": 1
}
```

### 2.2 获取设备详细信息
```http
GET /api/devices/{serial}/info
```

**响应**:
```json
{
  "device": {
    "serial": "ABC123DEF456",
    "model": "SM-G9900",
    "manufacturer": "samsung",
    "android_version": "11",
    "sdk_version": "30",
    "resolution": {
      "width": 1080,
      "height": 2400
    },
    "dpi": 480
  }
}
```

### 2.3 连接设备
```http
POST /api/devices/{serial}/connect
Content-Type: application/json

{
  "device_name": "device1",
  "max_size": 720,
  "bit_rate": 8000000,
  "max_fps": 60,
  "codec": "h264",
  "control": true,
  "locked_video_orientation": -1
}
```

### 2.4 断开设备
```http
POST /api/devices/{serial}/disconnect
```

### 2.5 批量配置设备
```http
POST /api/devices/batch/configure
Content-Type: application/json

{
  "serials": ["ABC123", "DEF456"],
  "max_size": 720,
  "bit_rate": 8000000
}
```

---

## 3. 屏幕控制 (Screen Control)

### 3.1 控制屏幕电源
```http
POST /api/devices/{serial}/screen/power
Content-Type: application/json

{
  "action": "on"  // "on", "off", "toggle"
}
```

**响应**:
```json
{
  "success": true,
  "state": "on"
}
```

### 3.2 设置屏幕亮度
```http
POST /api/devices/{serial}/screen/brightness
Content-Type: application/json

{
  "level": 128  // 0-255
}
```

### 3.3 获取屏幕亮度
```http
GET /api/devices/{serial}/screen/brightness
```

### 3.4 设置屏幕旋转
```http
POST /api/devices/{serial}/screen/rotation
Content-Type: application/json

{
  "rotation": 0  // 0, 90, 180, 270
}
```

### 3.5 获取屏幕旋转
```http
GET /api/devices/{serial}/screen/rotation
```

### 3.6 启用自动旋转
```http
POST /api/devices/{serial}/screen/auto-rotation/enable
```

### 3.7 禁用自动旋转
```http
POST /api/devices/{serial}/screen/auto-rotation/disable
```

---

## 4. 文件管理 (File Management)

### 4.1 推送文件到设备
```http
POST /api/files/devices/{serial}/push
Content-Type: multipart/form-data

file: [binary file data]
remotePath: /sdcard/Download/file.txt
```

**响应**:
```json
{
  "success": true,
  "taskId": "task_abc123_file.txt",
  "localPath": "/tmp/file.txt",
  "remotePath": "/sdcard/Download/file.txt",
  "fileSize": 1024
}
```

### 4.2 安装 APK
```http
POST /api/files/devices/{serial}/apk/install
Content-Type: multipart/form-data

file: [apk file data]
```

### 4.3 卸载应用
```http
DELETE /api/files/devices/{serial}/apk/uninstall
Content-Type: application/json

{
  "packageName": "com.example.app"
}
```

### 4.4 列出已安装包
```http
GET /api/files/devices/{serial}/packages
```

**响应**:
```json
{
  "success": true,
  "packages": [
    "com.android.settings",
    "com.example.app"
  ],
  "count": 2
}
```

### 4.5 获取传输状态
```http
GET /api/files/transfer/{task_id}
```

---

## 5. 录制截图 (Recording & Screenshot)

### 5.1 开始录制
```http
POST /api/devices/{serial}/recording/start
Content-Type: application/json

{
  "quality": "high",      // "high", "medium", "low"
  "maxDuration": 1800     // seconds (30 minutes default)
}
```

**响应**:
```json
{
  "success": true,
  "recordingId": "rec_abc123_20251203",
  "startTime": "2025-12-03T10:00:00Z"
}
```

### 5.2 停止录制
```http
POST /api/devices/{serial}/recording/stop
```

**响应**:
```json
{
  "success": true,
  "recordingId": "rec_abc123_20251203",
  "duration": 120.5,
  "fileSize": 10485760,
  "filePath": "/recordings/rec_abc123_20251203.mp4"
}
```

### 5.3 获取录制状态
```http
GET /api/devices/{serial}/recording/status
```

### 5.4 截图
```http
POST /api/devices/{serial}/screenshot
Content-Type: application/json

{
  "format": "png"  // "png" or "jpg"
}
```

**响应**:
```json
{
  "success": true,
  "screenshotId": "shot_abc123_20251203",
  "timestamp": "2025-12-03T10:00:00Z",
  "fileSize": 204800,
  "filePath": "/screenshots/shot_abc123_20251203.png",
  "format": "png"
}
```

---

## 6. 群控操作 (Group Batch Operations)

### 6.1 批量截图
```http
POST /api/groups/{group_id}/batch/screenshot
Content-Type: application/json

{
  "format": "png"
}
```

**响应**:
```json
{
  "success": true,
  "groupId": "group1",
  "totalDevices": 5,
  "successful": 4,
  "failed": 1,
  "results": [
    {
      "serial": "ABC123",
      "success": true,
      "screenshotId": "shot_abc123_20251203"
    }
  ]
}
```

### 6.2 批量开始录制
```http
POST /api/groups/{group_id}/batch/recording/start
Content-Type: application/json

{
  "quality": "high",
  "maxDuration": 1800
}
```

### 6.3 批量停止录制
```http
POST /api/groups/{group_id}/batch/recording/stop
```

### 6.4 批量系统按键
```http
POST /api/groups/{group_id}/batch/systemkey
Content-Type: application/json

{
  "action": "home"  // "home", "back", "recent", "power", "volume_up", "volume_down"
}
```

### 6.5 批量屏幕控制
```http
POST /api/groups/{group_id}/batch/screen-control
Content-Type: application/json

{
  "controlType": "brightness",
  "params": {
    "level": 128
  }
}
```

### 6.6 获取群组树
```http
GET /api/groups/tree
```

**响应**:
```json
{
  "success": true,
  "tree": [
    {
      "id": "node1",
      "type": "folder",
      "name": "Production Devices",
      "children": []
    }
  ]
}
```

### 6.7 更新群组树
```http
POST /api/groups/tree/update
Content-Type: application/json

{
  "tree": [
    {
      "id": "node1",
      "type": "folder",
      "name": "Updated Folder"
    }
  ]
}
```

---

## 7. 配置管理 (Configuration)

### 7.1 获取完整配置
```http
GET /config
```

**响应**:
```json
{
  "success": true,
  "config": {
    "global": {
      "max_size": 720,
      "bit_rate": 8000000,
      "max_fps": 60,
      "codec": "h264"
    },
    "devices": {
      "device1": {
        "max_size": 1080
      }
    }
  }
}
```

### 7.2 获取全局配置
```http
GET /config/global
```

### 7.3 更新全局配置
```http
PATCH /config/global
Content-Type: application/json

{
  "max_size": 1080,
  "bit_rate": 10000000
}
```

### 7.4 获取设备配置
```http
GET /config/device/{device_name}
```

### 7.5 更新设备配置
```http
PATCH /config/device/{device_name}
Content-Type: application/json

{
  "max_size": 1080
}
```

### 7.6 删除设备配置
```http
DELETE /config/device/{device_name}
```

---

## 8. WebSocket 协议

> **⚠️ 弃用警告**: 本节描述的分离式 WebSocket 端点（/ws/video, /ws/control, /ws/group）已被弃用。
>
> **✅ 请使用新的统一 WebSocket 架构**: 单一端点 `/ws` + 命名空间路由
>
> **📖 详细文档**: 请参考 [BACKEND_REFERENCE.md](../BACKEND_REFERENCE.md) 获取最新的统一 WebSocket 协议规范

---


### 8.1 统一 WebSocket 端点

**新架构**: 单一端点 `/ws` + 命名空间路由

详细协议规范请参考: **[BACKEND_REFERENCE.md](../BACKEND_REFERENCE.md)**

**主要特性**:
- ✅ 单一 WebSocket 连接
- ✅ 9个命名空间 (system, device, screen, file, recording, group, config, control, video)
- ✅ 47个 WebSocket Actions
- ✅ 请求/响应匹配机制
- ✅ 订阅/发布模式

**连接示例**:
```javascript
const ws = new WebSocket('ws://localhost:8000/ws')

// 发送请求
ws.send(JSON.stringify({
  id: "req-001",
  type: "request",
  namespace: "device",
  action: "list",
  data: {},
  timestamp: Date.now()
}))

// 接收响应
ws.onmessage = (event) => {
  const message = JSON.parse(event.data)
  console.log(message)
}
```

---

## 📊 数据模型

### DeviceInfo
```typescript
interface DeviceInfo {
  serial: string
  model: string
  manufacturer: string
  android_version: string
  sdk_version: string
  resolution: {
    width: number
    height: number
  }
  dpi: number
}
```

### DeviceConfig
```typescript
interface DeviceConfig {
  max_size?: number        // 120-4320
  bit_rate?: number        // 100000-20000000
  max_fps?: number         // 1-120
  codec?: 'h264' | 'h265' | 'av1'
  control?: boolean
  locked_video_orientation?: -1 | 0 | 1 | 2 | 3  // -1=auto
}
```

---

## 🔒 错误处理

### HTTP 状态码
- `200`: 成功
- `400`: 请求错误
- `404`: 资源不存在
- `500`: 服务器错误

### 错误响应格式
```json
{
  "success": false,
  "error": {
    "code": "DEVICE_NOT_FOUND",
    "detail": "Device ABC123 not found or offline"
  },
  "timestamp": "2025-12-04T00:00:00Z"
}
```

### 常见错误码
| 错误码 | 说明 |
|-------|------|
| `DEVICE_NOT_FOUND` | 设备不存在或离线 |
| `DEVICE_BUSY` | 设备忙碌中 |
| `INVALID_PARAMETER` | 参数无效 |
| `OPERATION_FAILED` | 操作失败 |
| `RECORDING_IN_PROGRESS` | 录制进行中 |
| `FILE_TRANSFER_ERROR` | 文件传输错误 |

---

## 🔗 相关文档

- **[COMPLETE_GUIDE.md](./COMPLETE_GUIDE.md)** - 完整指南（架构、配置、初始化）
- **[BACKEND_REFERENCE.md](../BACKEND_REFERENCE.md)** - 统一 WebSocket 协议详细规范
- **[C++_REFERENCE.md](./C++_REFERENCE.md)** - C++ 版本参考

---

**文档状态**: ✅ 已更新
**协议版本**: v2.0 (统一 WebSocket)
**更新日期**: 2025-12-04
