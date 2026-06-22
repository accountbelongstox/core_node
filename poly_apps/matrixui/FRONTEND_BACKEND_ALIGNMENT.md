# Matrix 前后端功能对齐文档

> **版本**: v2.0
> **更新时间**: 2025-12-04
> **状态**: 📋 基于实际代码分析

---

## 📊 执行摘要

### 当前状态

| 指标 | 后端提供 | 前端实现 | 对齐率 |
|------|---------|---------|--------|
| **REST API** | 37个端点 | 0个 | 🔴 0% |
| **WebSocket Actions** | 47个动作 | 0个 | 🔴 0% |
| **API 客户端** | ✅ 完整 | ❌ 空文件 | 🔴 0% |
| **实时视频流** | ✅ H.264 | ❌ Mock显示 | 🔴 0% |
| **设备控制** | ✅ 完整 | ❌ Mock按钮 | 🔴 0% |

---

## 📋 目录

1. [REST API 端点详细参数](#rest-api-端点详细参数)
2. [WebSocket Actions 详细参数](#websocket-actions-详细参数)
3. [通用数据结构](#通用数据结构)
4. [前端实施建议](#前端实施建议)

---

## REST API 端点详细参数

### 1. 健康检查 API (3个端点)

#### 1.1 `GET /health`
**说明**: 基础健康检查
**请求参数**: 无
**响应格式**:
```
{
  "status": "healthy",
  "service": "pyMatrix",
  "version": "1.0.0",
  "timestamp": "ISO8601时间戳"
}
```

#### 1.2 `GET /health/detailed`
**说明**: 详细健康信息
**请求参数**: 无
**响应格式**:
```
{
  "status": "healthy",
  "service": {
    "name": "pyMatrix",
    "version": "1.1.0",
    "description": "Android Device Mirroring and Group Control System"
  },
  "timestamp": "ISO8601时间戳",
  "uptime_seconds": 整数,
  "system": {
    "platform": "系统平台",
    "platform_version": "平台版本",
    "python_version": "Python版本",
    "architecture": "系统架构"
  },
  "resources": {
    "cpu": {
      "usage_percent": 浮点数,
      "cores": 整数
    },
    "memory": {
      "total_mb": 浮点数,
      "available_mb": 浮点数,
      "used_percent": 浮点数
    },
    "disk": {
      "total_gb": 浮点数,
      "free_gb": 浮点数,
      "used_percent": 浮点数
    }
  }
}
```

#### 1.3 `GET /`
**说明**: 根端点API信息
**请求参数**: 无
**响应格式**: 同 `/health/detailed`

---

### 2. 设备管理 API (5个端点)

#### 2.1 `GET /api/devices`
**说明**: 列出所有已连接的设备
**请求参数**: 无
**响应格式**:
```
{
  "devices": [
    {
      "serial": "设备序列号",
      "status": "device" | "offline" | "unauthorized",
      "model": "设备型号",
      "manufacturer": "制造商" | null,
      "android_version": null
    }
  ],
  "count": 整数
}
```

#### 2.2 `GET /api/devices/{serial}/info`
**说明**: 获取指定设备的详细信息
**路径参数**:
- `serial`: 设备序列号 (字符串, 必需)
**响应格式**:
```
{
  "device": {
    "serial": "设备序列号",
    "model": "设备型号",
    "manufacturer": "制造商",
    "android_version": "Android版本",
    "sdk_version": "SDK版本号",
    "resolution": {
      "width": 整数,
      "height": 整数
    },
    "dpi": 整数
  }
}
```
**特殊要求**: 设备必须已连接

#### 2.3 `POST /api/devices/{serial}/connect`
**说明**: 连接指定设备并开始镜像
**路径参数**:
- `serial`: 设备序列号 (字符串, 必需)
**请求体参数** (JSON, 所有参数均为可选):
```
{
  "device_name": 字符串 | null,
  "max_size": 整数 | null (默认: 720),
  "bit_rate": 整数 | null (默认: 8000000),
  "max_fps": 整数 | null (默认: 60),
  "codec": 字符串 | null,
  "control": 布尔 | null,
  "locked_video_orientation": 整数 | null
}
```
**参数说明**:
- `device_name`: 设备自定义名称
- `max_size`: 最大分辨率 (短边像素值)
- `bit_rate`: 视频比特率 (bps)
- `max_fps`: 最大帧率
- `codec`: 视频编码格式
- `control`: 是否启用设备控制
- `locked_video_orientation`: 锁定视频方向
**响应格式**:
```
{
  "success": true,
  "message": "Device {serial} connected successfully"
}
```

#### 2.4 `POST /api/devices/{serial}/disconnect`
**说明**: 断开指定设备连接
**路径参数**:
- `serial`: 设备序列号 (字符串, 必需)
**请求参数**: 无
**响应格式**:
```
{
  "success": true,
  "message": "Device {serial} disconnected successfully"
}
```

#### 2.5 `POST /api/devices/batch/configure`
**说明**: 批量配置多个设备
**请求体参数** (JSON):
```
{
  "serials": [字符串数组, 必需],
  "config": {
    任意键值对 (灵活配置)
  }
}
```
**特殊要求**: `serials` 必须是非空数组

---

### 3. 屏幕控制 API (7个端点)

#### 3.1 `POST /api/devices/{serial}/screen/power`
**说明**: 控制设备屏幕电源
**路径参数**:
- `serial`: 设备序列号 (字符串, 必需)
**请求体参数** (JSON):
```
{
  "action": "on" | "off" | "toggle" (必需)
}
```
**验证规则**: `action` 必须是 "on", "off", 或 "toggle" 之一
**响应格式**:
```
{
  "success": true,
  "message": "Screen power controlled successfully"
}
```

#### 3.2 `POST /api/devices/{serial}/screen/brightness`
**说明**: 设置设备屏幕亮度
**路径参数**:
- `serial`: 设备序列号 (字符串, 必需)
**请求体参数** (JSON):
```
{
  "level": 整数 (必需, 范围: 0-255)
}
```
**验证规则**:
- `level` 必须在 0-255 之间
- 违反此规则返回 400 错误
**响应格式**:
```
{
  "success": true,
  "message": "Brightness set to {level}"
}
```

#### 3.3 `GET /api/devices/{serial}/screen/brightness`
**说明**: 获取当前屏幕亮度
**路径参数**:
- `serial`: 设备序列号 (字符串, 必需)
**请求参数**: 无
**响应格式**:
```
{
  "success": true,
  "level": 整数 (0-255)
}
```

#### 3.4 `POST /api/devices/{serial}/screen/rotation`
**说明**: 设置屏幕旋转角度
**路径参数**:
- `serial`: 设备序列号 (字符串, 必需)
**请求体参数** (JSON):
```
{
  "rotation": 0 | 90 | 180 | 270 (必需)
}
```
**验证规则**:
- `rotation` 必须是 0, 90, 180, 或 270 之一
- 违反此规则返回 400 错误
**响应格式**:
```
{
  "success": true,
  "message": "Screen rotation set to {rotation}"
}
```

#### 3.5 `GET /api/devices/{serial}/screen/rotation`
**说明**: 获取当前屏幕旋转角度
**路径参数**:
- `serial`: 设备序列号 (字符串, 必需)
**请求参数**: 无
**响应格式**:
```
{
  "success": true,
  "rotation": 0 | 90 | 180 | 270
}
```

#### 3.6 `POST /api/devices/{serial}/screen/auto-rotation/enable`
**说明**: 启用屏幕自动旋转
**路径参数**:
- `serial`: 设备序列号 (字符串, 必需)
**请求参数**: 无
**响应格式**:
```
{
  "success": true,
  "message": "Auto-rotation enabled"
}
```

#### 3.7 `POST /api/devices/{serial}/screen/auto-rotation/disable`
**说明**: 禁用屏幕自动旋转
**路径参数**:
- `serial`: 设备序列号 (字符串, 必需)
**请求参数**: 无
**响应格式**:
```
{
  "success": true,
  "message": "Auto-rotation disabled"
}
```

---

### 4. 文件管理 API (5个端点)

#### 4.1 `POST /api/devices/{serial}/push`
**说明**: 推送文件到设备
**路径参数**:
- `serial`: 设备序列号 (字符串, 必需)
**请求格式**: `multipart/form-data`
**表单字段**:
- `file`: 文件对象 (必需)
- `remotePath`: 字符串 (必需, 目标路径)
**特殊要求**: 使用 multipart/form-data 格式上传
**响应格式**:
```
{
  "success": true,
  "message": "File pushed successfully",
  "taskId": "任务ID"
}
```

#### 4.2 `POST /api/devices/{serial}/install`
**说明**: 安装 APK 到设备
**路径参数**:
- `serial`: 设备序列号 (字符串, 必需)
**请求格式**: `multipart/form-data`
**表单字段**:
- `file`: APK文件对象 (必需)
- `reinstall`: 布尔字符串 (可选, 默认: false)
**验证规则**:
- 文件扩展名必须是 `.apk`
- 违反此规则返回 400 错误
**响应格式**:
```
{
  "success": true,
  "message": "APK installed successfully",
  "package": "包名"
}
```

#### 4.3 `POST /api/devices/{serial}/uninstall`
**说明**: 从设备卸载应用
**路径参数**:
- `serial`: 设备序列号 (字符串, 必需)
**请求体参数** (JSON):
```
{
  "packageName": 字符串 (必需)
}
```
**响应格式**:
```
{
  "success": true,
  "message": "Package uninstalled successfully"
}
```

#### 4.4 `GET /api/devices/{serial}/packages`
**说明**: 列出设备上安装的应用包
**路径参数**:
- `serial`: 设备序列号 (字符串, 必需)
**查询参数**:
- `filter`: 字符串 (可选, 过滤包名)
**响应格式**:
```
{
  "success": true,
  "packages": [字符串数组],
  "count": 整数
}
```

#### 4.5 `GET /api/devices/{serial}/files/transfer/{taskId}`
**说明**: 获取文件传输任务状态
**路径参数**:
- `serial`: 设备序列号 (字符串, 必需)
- `taskId`: 任务ID (字符串, 必需)
**请求参数**: 无
**响应格式**:
```
{
  "success": true,
  "taskId": "任务ID",
  "status": "pending" | "in_progress" | "completed" | "failed",
  "progress": 浮点数 (0-100),
  "error": 字符串 | null
}
```

---

### 5. 录制截图 API (4个端点)

#### 5.1 `POST /api/devices/{serial}/recording/start`
**说明**: 开始屏幕录制
**路径参数**:
- `serial`: 设备序列号 (字符串, 必需)
**请求体参数** (JSON, 所有参数可选):
```
{
  "quality": "high" | "medium" | "low" (默认: "high"),
  "maxDuration": 整数 (默认: 1800)
}
```
**参数说明**:
- `quality`: 录制质量
- `maxDuration`: 最大录制时长（秒），默认 1800 秒（30分钟）
**响应格式**:
```
{
  "success": true,
  "message": "Recording started",
  "recordingId": "录制ID"
}
```

#### 5.2 `POST /api/devices/{serial}/recording/stop`
**说明**: 停止屏幕录制
**路径参数**:
- `serial`: 设备序列号 (字符串, 必需)
**请求参数**: 无
**响应格式**:
```
{
  "success": true,
  "message": "Recording stopped",
  "filePath": "录制文件路径"
}
```

#### 5.3 `GET /api/devices/{serial}/recording/status`
**说明**: 获取录制状态
**路径参数**:
- `serial`: 设备序列号 (字符串, 必需)
**请求参数**: 无
**响应格式**:
```
{
  "success": true,
  "isRecording": 布尔,
  "recordingInfo": {
    "recordingId": "录制ID",
    "startTime": "开始时间",
    "duration": 整数 (秒)
  } | null
}
```

#### 5.4 `POST /api/devices/{serial}/screenshot`
**说明**: 截取设备屏幕截图
**路径参数**:
- `serial`: 设备序列号 (字符串, 必需)
**请求体参数** (JSON, 所有参数可选):
```
{
  "format": "png" | "jpg" (默认: "png")
}
```
**响应格式**:
```
{
  "success": true,
  "filePath": "截图文件路径",
  "timestamp": "时间戳"
}
```

---

### 6. 群组批量 API (7个端点)

#### 6.1 `POST /api/group/{group_id}/batch/screenshot`
**说明**: 批量截图群组内所有设备
**路径参数**:
- `group_id`: 群组ID (字符串, 必需)
**请求体参数** (JSON, 可选):
```
{
  "format": "png" | "jpg" (默认: "png")
}
```
**响应格式**:
```
{
  "success": true,
  "results": [
    {
      "serial": "设备序列号",
      "success": 布尔,
      "filePath": "文件路径" | null,
      "error": "错误信息" | null
    }
  ]
}
```

#### 6.2 `POST /api/group/{group_id}/batch/recording/start`
**说明**: 批量开始录制群组内所有设备
**路径参数**:
- `group_id`: 群组ID (字符串, 必需)
**请求体参数** (JSON, 所有参数可选):
```
{
  "quality": "high" | "medium" | "low" (默认: "high"),
  "maxDuration": 整数 (默认: 1800)
}
```
**响应格式**:
```
{
  "success": true,
  "results": [
    {
      "serial": "设备序列号",
      "success": 布尔,
      "recordingId": "录制ID" | null,
      "error": "错误信息" | null
    }
  ]
}
```

#### 6.3 `POST /api/group/{group_id}/batch/recording/stop`
**说明**: 批量停止录制群组内所有设备
**路径参数**:
- `group_id`: 群组ID (字符串, 必需)
**请求参数**: 无
**响应格式**:
```
{
  "success": true,
  "results": [
    {
      "serial": "设备序列号",
      "success": 布尔,
      "filePath": "文件路径" | null,
      "error": "错误信息" | null
    }
  ]
}
```

#### 6.4 `POST /api/group/{group_id}/batch/systemkey`
**说明**: 批量发送系统按键到群组内所有设备
**路径参数**:
- `group_id`: 群组ID (字符串, 必需)
**请求体参数** (JSON):
```
{
  "action": "home" | "back" | "recent" | "power" | "volume_up" | "volume_down" (必需)
}
```
**验证规则**:
- `action` 必须是以下之一: home, back, recent, power, volume_up, volume_down
- 违反此规则返回 400 错误
**响应格式**:
```
{
  "success": true,
  "results": [
    {
      "serial": "设备序列号",
      "success": 布尔,
      "error": "错误信息" | null
    }
  ]
}
```

#### 6.5 `POST /api/group/{group_id}/batch/screen-control`
**说明**: 批量屏幕控制群组内所有设备
**路径参数**:
- `group_id`: 群组ID (字符串, 必需)
**请求体参数** (JSON):
```
{
  "controlType": "power" | "brightness" | "rotation" (必需),
  "params": 对象 (必需, 内容根据 controlType 而定)
}
```
**验证规则**:
1. `controlType` 必须是 power, brightness, 或 rotation 之一
2. 根据 `controlType`, `params` 的要求如下:
   - **power**: `params.action` 必需, 值为 "on" | "off" | "toggle"
   - **brightness**: `params.level` 必需, 值为 0-255 的整数
   - **rotation**: `params.rotation` 必需, 值为 0 | 90 | 180 | 270
**响应格式**:
```
{
  "success": true,
  "results": [
    {
      "serial": "设备序列号",
      "success": 布尔,
      "error": "错误信息" | null
    }
  ]
}
```

#### 6.6 `GET /api/group/tree`
**说明**: 获取群组树结构
**请求参数**: 无
**响应格式**:
```
{
  "success": true,
  "tree": {
    "id": "root",
    "name": "所有设备",
    "children": [
      {
        "id": "群组ID",
        "name": "群组名称",
        "type": "group",
        "children": [...]
      },
      {
        "id": "设备序列号",
        "name": "设备名称",
        "type": "device",
        "serial": "设备序列号"
      }
    ]
  }
}
```

#### 6.7 `POST /api/group/tree`
**说明**: 更新整个群组树结构
**请求体参数** (JSON):
```
{
  "tree": {
    树结构对象 (格式同GET响应)
  }
}
```
**响应格式**:
```
{
  "success": true,
  "message": "Group tree updated successfully"
}
```

---

### 7. 配置管理 API (6个端点)

#### 7.1 `GET /api/config`
**说明**: 获取完整配置（全局 + 所有设备）
**请求参数**: 无
**响应格式**:
```
{
  "success": true,
  "config": {
    "global": {全局配置对象},
    "devices": {
      "设备名称": {设备配置对象}
    }
  }
}
```

#### 7.2 `GET /api/config/global`
**说明**: 获取全局默认配置
**请求参数**: 无
**响应格式**:
```
{
  "success": true,
  "config": {
    "max_size": 整数 | null,
    "bit_rate": 整数 | null,
    "max_fps": 整数 | null,
    "codec": 字符串 | null,
    "control": 布尔 | null,
    "locked_video_orientation": 整数 | null
  }
}
```

#### 7.3 `PATCH /api/config/global`
**说明**: 更新全局默认配置
**请求体参数** (JSON, 所有参数可选):
```
{
  "max_size": 整数 (范围: 120-4320),
  "bit_rate": 整数 (范围: 100000-20000000),
  "max_fps": 整数 (范围: 1-120),
  "codec": "h264" | "h265" | "av1",
  "control": 布尔,
  "locked_video_orientation": 整数 (范围: -1 到 3)
}
```
**验证规则**:
- `max_size`: 必须在 120-4320 之间
- `bit_rate`: 必须在 100000-20000000 之间
- `max_fps`: 必须在 1-120 之间
- `codec`: 必须是 h264, h265, 或 av1 之一
- `locked_video_orientation`: 必须在 -1 到 3 之间
- 违反任何规则返回 400 错误
**响应格式**:
```
{
  "success": true,
  "config": {更新后的配置对象}
}
```

#### 7.4 `GET /api/config/device/{device_name}`
**说明**: 获取设备特定配置
**路径参数**:
- `device_name`: 设备名称 (字符串, 必需)
**请求参数**: 无
**响应格式**:
```
{
  "success": true,
  "device": "设备名称",
  "config": {
    "max_size": 整数 | null,
    "bit_rate": 整数 | null,
    "max_fps": 整数 | null,
    "codec": 字符串 | null,
    "control": 布尔 | null,
    "locked_video_orientation": 整数 | null
  }
}
```

#### 7.5 `PATCH /api/config/device/{device_name}`
**说明**: 更新设备特定配置
**路径参数**:
- `device_name`: 设备名称 (字符串, 必需)
**请求体参数** (JSON, 所有参数可选):
```
{
  "max_size": 整数 (范围: 120-4320),
  "bit_rate": 整数 (范围: 100000-20000000),
  "max_fps": 整数 (范围: 1-120),
  "codec": "h264" | "h265" | "av1",
  "control": 布尔,
  "locked_video_orientation": 整数 (范围: -1 到 3)
}
```
**验证规则**: 同全局配置
**响应格式**:
```
{
  "success": true,
  "device": "设备名称",
  "config": {更新后的配置对象}
}
```

#### 7.6 `DELETE /api/config/device/{device_name}`
**说明**: 删除设备特定配置（恢复为全局配置）
**路径参数**:
- `device_name`: 设备名称 (字符串, 必需)
**请求参数**: 无
**响应格式**:
```
{
  "success": true,
  "device": "设备名称"
}
```

---

## WebSocket Actions 详细参数

### WebSocket 连接信息

**端点**: `ws://localhost:8000/ws`
**协议**: 统一 WebSocket 协议
**消息格式**:
```
{
  "namespace": "命名空间名称",
  "action": "动作名称",
  "data": {动作特定数据},
  "messageId": "可选的消息ID，用于匹配响应"
}
```

**响应格式**:
```
{
  "namespace": "命名空间名称",
  "action": "动作名称",
  "data": {响应数据},
  "messageId": "与请求相同的messageId (如果有)"
}
```

**错误响应格式**:
```
{
  "namespace": "命名空间名称",
  "action": "动作名称",
  "data": {
    "error": {
      "code": "错误代码",
      "message": "错误消息"
    }
  },
  "messageId": "与请求相同的messageId (如果有)"
}
```

---

### 1. System 命名空间 (3个动作)

#### 1.1 `system:health`
**说明**: 基础健康检查
**请求数据**: 无需 `data` 字段
**响应数据**:
```
{
  "status": "healthy",
  "service": "pyMatrix",
  "version": "1.1.0",
  "timestamp": "ISO8601时间戳"
}
```

#### 1.2 `system:health_detailed`
**说明**: 详细健康检查
**请求数据**: 无需 `data` 字段
**响应数据**: 同 REST API `/health/detailed`

#### 1.3 `system:info`
**说明**: API 信息
**请求数据**: 无需 `data` 字段
**响应数据**:
```
{
  "message": "pyMatrix API Server",
  "version": "1.1.0",
  "description": "Android Device Mirroring and Group Control System",
  "protocol": "Unified WebSocket",
  "endpoints": {
    "websocket": "/ws",
    "documentation": "/docs"
  },
  "namespaces": [字符串数组]
}
```

---

### 2. Device 命名空间 (5个动作)

#### 2.1 `device:list`
**说明**: 列出所有设备
**请求数据**: 无需 `data` 字段
**响应数据**:
```
{
  "devices": [
    {
      "serial": "设备序列号",
      "status": "device" | "offline" | "unauthorized",
      "model": "设备型号",
      "manufacturer": "制造商" | null,
      "android_version": null
    }
  ],
  "count": 整数
}
```

#### 2.2 `device:get`
**说明**: 获取设备详细信息
**请求数据**:
```
{
  "serial": "设备序列号" (必需)
}
```
**响应数据**:
```
{
  "device": {
    "serial": "设备序列号",
    "model": "设备型号",
    "manufacturer": "制造商",
    "android_version": "Android版本",
    "sdk_version": "SDK版本号",
    "resolution": {
      "width": 整数,
      "height": 整数
    },
    "dpi": 整数
  }
}
```
**错误情况**:
- 缺少 `serial`: `MISSING_SERIAL`
- 设备未找到: `DEVICE_NOT_FOUND`

#### 2.3 `device:connect`
**说明**: 连接设备
**请求数据**:
```
{
  "serial": "设备序列号" (必需),
  "max_size": 整数 (可选, 默认: 720),
  "bit_rate": 整数 (可选, 默认: 8000000),
  "max_fps": 整数 (可选, 默认: 60),
  "codec": 字符串 (可选),
  "control": 布尔 (可选),
  "locked_video_orientation": 整数 (可选),
  "device_name": 字符串 (可选)
}
```
**响应数据**:
```
{
  "success": true,
  "message": "Device {serial} connected successfully"
}
```
**错误情况**:
- 缺少 `serial`: `MISSING_SERIAL`
- 连接失败: `CONNECT_FAILED`

#### 2.4 `device:disconnect`
**说明**: 断开设备连接
**请求数据**:
```
{
  "serial": "设备序列号" (必需)
}
```
**响应数据**:
```
{
  "success": true,
  "message": "Device {serial} disconnected successfully"
}
```
**错误情况**:
- 缺少 `serial`: `MISSING_SERIAL`
- 断开失败: `DISCONNECT_FAILED`

#### 2.5 `device:batch_configure`
**说明**: 批量配置设备（未完全实现）
**请求数据**:
```
{
  配置参数 (待完全实现)
}
```
**响应数据**:
```
{
  "success": true,
  "message": "Batch configuration not fully implemented yet"
}
```

---

### 3. Screen 命名空间 (7个动作)

#### 3.1 `screen:power`
**说明**: 控制屏幕电源
**请求数据**:
```
{
  "serial": "设备序列号" (必需),
  "action": "on" | "off" | "toggle" (必需)
}
```
**验证规则**: `action` 必须是 on, off, 或 toggle 之一
**响应数据**:
```
{
  "success": true,
  "message": "Screen power controlled"
}
```
**错误情况**:
- 缺少 `serial`: `MISSING_SERIAL`
- 缺少 `action`: `MISSING_ACTION`
- 无效的 `action`: `INVALID_ACTION`
- 控制失败: `POWER_CONTROL_FAILED`

#### 3.2 `screen:set_brightness`
**说明**: 设置屏幕亮度
**请求数据**:
```
{
  "serial": "设备序列号" (必需),
  "level": 整数 (必需, 范围: 0-255)
}
```
**验证规则**: `level` 必须在 0-255 之间
**响应数据**:
```
{
  "success": true,
  "message": "Brightness set"
}
```
**错误情况**:
- 缺少 `serial`: `MISSING_SERIAL`
- 缺少 `level`: `MISSING_LEVEL`
- `level` 超出范围: `INVALID_LEVEL`
- 设置失败: `BRIGHTNESS_CONTROL_FAILED`

#### 3.3 `screen:get_brightness`
**说明**: 获取当前屏幕亮度
**请求数据**:
```
{
  "serial": "设备序列号" (必需)
}
```
**响应数据**:
```
{
  "success": true,
  "level": 整数 (0-255)
}
```
**错误情况**:
- 缺少 `serial`: `MISSING_SERIAL`
- 获取失败: `BRIGHTNESS_GET_FAILED`

#### 3.4 `screen:set_rotation`
**说明**: 设置屏幕旋转
**请求数据**:
```
{
  "serial": "设备序列号" (必需),
  "rotation": 0 | 90 | 180 | 270 (必需)
}
```
**验证规则**: `rotation` 必须是 0, 90, 180, 或 270 之一
**响应数据**:
```
{
  "success": true,
  "message": "Rotation set"
}
```
**错误情况**:
- 缺少 `serial`: `MISSING_SERIAL`
- 缺少 `rotation`: `MISSING_ROTATION`
- 无效的 `rotation`: `INVALID_ROTATION`
- 设置失败: `ROTATION_CONTROL_FAILED`

#### 3.5 `screen:get_rotation`
**说明**: 获取当前屏幕旋转
**请求数据**:
```
{
  "serial": "设备序列号" (必需)
}
```
**响应数据**:
```
{
  "success": true,
  "rotation": 0 | 90 | 180 | 270
}
```
**错误情况**:
- 缺少 `serial`: `MISSING_SERIAL`
- 获取失败: `ROTATION_GET_FAILED`

#### 3.6 `screen:enable_auto_rotation`
**说明**: 启用自动旋转
**请求数据**:
```
{
  "serial": "设备序列号" (必需)
}
```
**响应数据**:
```
{
  "success": true,
  "message": "Auto-rotation enabled"
}
```
**错误情况**:
- 缺少 `serial`: `MISSING_SERIAL`
- 启用失败: `AUTO_ROTATION_ENABLE_FAILED`

#### 3.7 `screen:disable_auto_rotation`
**说明**: 禁用自动旋转
**请求数据**:
```
{
  "serial": "设备序列号" (必需)
}
```
**响应数据**:
```
{
  "success": true,
  "message": "Auto-rotation disabled"
}
```
**错误情况**:
- 缺少 `serial`: `MISSING_SERIAL`
- 禁用失败: `AUTO_ROTATION_DISABLE_FAILED`

---

### 4. File 命名空间 (5个动作)

**注意**: 文件传输涉及二进制数据，推荐使用 REST API 端点。WebSocket 主要用于状态查询。

#### 4.1 `file:push`
**说明**: 推送文件到设备（推荐使用 REST API）
**请求数据**:
```
{
  "serial": "设备序列号" (必需),
  "localPath": "本地文件路径" (必需),
  "remotePath": "远程目标路径" (必需)
}
```
**响应数据**:
```
{
  "success": true,
  "message": "File pushed"
}
```
**错误情况**:
- 缺少 `serial`: `MISSING_SERIAL`
- 缺少路径: `MISSING_PATHS`
- 推送失败: `PUSH_FAILED`

#### 4.2 `file:install_apk`
**说明**: 安装 APK（推荐使用 REST API）
**请求数据**:
```
{
  "serial": "设备序列号" (必需),
  "apkPath": "APK文件路径" (必需),
  "reinstall": 布尔 (可选, 默认: false)
}
```
**响应数据**:
```
{
  "success": true,
  "message": "APK installed"
}
```
**错误情况**:
- 缺少 `serial`: `MISSING_SERIAL`
- 缺少 `apkPath`: `MISSING_APK_PATH`
- 安装失败: `INSTALL_FAILED`

#### 4.3 `file:uninstall_apk`
**说明**: 卸载 APK
**请求数据**:
```
{
  "serial": "设备序列号" (必需),
  "packageName": "包名" (必需)
}
```
**响应数据**:
```
{
  "success": true,
  "message": "APK uninstalled"
}
```
**错误情况**:
- 缺少 `serial`: `MISSING_SERIAL`
- 缺少 `packageName`: `MISSING_PACKAGE_NAME`
- 卸载失败: `UNINSTALL_FAILED`

#### 4.4 `file:list_packages`
**说明**: 列出已安装的应用包
**请求数据**:
```
{
  "serial": "设备序列号" (必需),
  "filter": "过滤字符串" (可选)
}
```
**响应数据**:
```
{
  "success": true,
  "packages": [字符串数组],
  "count": 整数
}
```
**错误情况**:
- 缺少 `serial`: `MISSING_SERIAL`
- 列举失败: `LIST_PACKAGES_FAILED`

#### 4.5 `file:get_transfer_status`
**说明**: 获取文件传输任务状态
**请求数据**:
```
{
  "taskId": "任务ID" (必需)
}
```
**响应数据**:
```
{
  "success": true,
  "taskId": "任务ID",
  "status": "pending" | "in_progress" | "completed" | "failed",
  "progress": 浮点数,
  "error": 字符串 | null
}
```
**错误情况**:
- 缺少 `taskId`: `MISSING_TASK_ID`
- 任务未找到: `TASK_NOT_FOUND`

---

### 5. Recording 命名空间 (4个动作)

#### 5.1 `recording:start`
**说明**: 开始屏幕录制
**请求数据**:
```
{
  "serial": "设备序列号" (必需),
  "quality": "high" | "medium" | "low" (可选, 默认: "high"),
  "maxDuration": 整数 (可选, 默认: 1800)
}
```
**响应数据**:
```
{
  "success": true,
  "message": "Recording started",
  "recordingId": "录制ID"
}
```
**错误情况**:
- 缺少 `serial`: `MISSING_SERIAL`
- 启动失败: `RECORDING_START_FAILED`

#### 5.2 `recording:stop`
**说明**: 停止屏幕录制
**请求数据**:
```
{
  "serial": "设备序列号" (必需)
}
```
**响应数据**:
```
{
  "success": true,
  "message": "Recording stopped",
  "filePath": "文件路径"
}
```
**错误情况**:
- 缺少 `serial`: `MISSING_SERIAL`
- 停止失败: `RECORDING_STOP_FAILED`

#### 5.3 `recording:get_status`
**说明**: 获取录制状态
**请求数据**:
```
{
  "serial": "设备序列号" (必需)
}
```
**响应数据**:
```
{
  "success": true,
  "isRecording": 布尔,
  "recordingInfo": {
    "recordingId": "录制ID",
    "startTime": "开始时间",
    "duration": 整数
  } | null
}
```
**错误情况**:
- 缺少 `serial`: `MISSING_SERIAL`

#### 5.4 `recording:screenshot`
**说明**: 截取屏幕截图
**请求数据**:
```
{
  "serial": "设备序列号" (必需),
  "format": "png" | "jpg" (可选, 默认: "png")
}
```
**响应数据**:
```
{
  "success": true,
  "filePath": "文件路径",
  "timestamp": "时间戳"
}
```
**错误情况**:
- 缺少 `serial`: `MISSING_SERIAL`
- 截图失败: `SCREENSHOT_FAILED`

---

### 6. Group 命名空间 (7个动作)

#### 6.1 `group:batch_screenshot`
**说明**: 批量截图群组内所有设备
**请求数据**:
```
{
  "groupId": "群组ID" (必需),
  "format": "png" | "jpg" (可选, 默认: "png")
}
```
**响应数据**:
```
{
  "success": true,
  "results": [
    {
      "serial": "设备序列号",
      "success": 布尔,
      "filePath": "文件路径" | null,
      "error": "错误信息" | null
    }
  ]
}
```
**错误情况**:
- 缺少 `groupId`: `MISSING_GROUP_ID`
- 批量操作失败: `BATCH_SCREENSHOT_FAILED`

#### 6.2 `group:batch_start_recording`
**说明**: 批量开始录制
**请求数据**:
```
{
  "groupId": "群组ID" (必需),
  "quality": "high" | "medium" | "low" (可选, 默认: "high"),
  "maxDuration": 整数 (可选, 默认: 1800)
}
```
**响应数据**:
```
{
  "success": true,
  "results": [
    {
      "serial": "设备序列号",
      "success": 布尔,
      "recordingId": "录制ID" | null,
      "error": "错误信息" | null
    }
  ]
}
```
**错误情况**:
- 缺少 `groupId`: `MISSING_GROUP_ID`
- 批量操作失败: `BATCH_START_RECORDING_FAILED`

#### 6.3 `group:batch_stop_recording`
**说明**: 批量停止录制
**请求数据**:
```
{
  "groupId": "群组ID" (必需)
}
```
**响应数据**:
```
{
  "success": true,
  "results": [
    {
      "serial": "设备序列号",
      "success": 布尔,
      "filePath": "文件路径" | null,
      "error": "错误信息" | null
    }
  ]
}
```
**错误情况**:
- 缺少 `groupId`: `MISSING_GROUP_ID`
- 批量操作失败: `BATCH_STOP_RECORDING_FAILED`

#### 6.4 `group:batch_systemkey`
**说明**: 批量发送系统按键
**请求数据**:
```
{
  "groupId": "群组ID" (必需),
  "action": "home" | "back" | "recent" | "power" | "volume_up" | "volume_down" (必需)
}
```
**验证规则**: `action` 必须是有效的系统按键之一
**响应数据**:
```
{
  "success": true,
  "results": [
    {
      "serial": "设备序列号",
      "success": 布尔,
      "error": "错误信息" | null
    }
  ]
}
```
**错误情况**:
- 缺少 `groupId`: `MISSING_GROUP_ID`
- 缺少 `action`: `MISSING_ACTION`
- 无效的 `action`: `INVALID_ACTION`
- 批量操作失败: `BATCH_SYSTEMKEY_FAILED`

#### 6.5 `group:batch_screen_control`
**说明**: 批量屏幕控制
**请求数据**:
```
{
  "groupId": "群组ID" (必需),
  "controlType": "power" | "brightness" | "rotation" (必需),
  "params": 对象 (必需)
}
```
**验证规则**:
- `controlType` 必须是有效类型
- `params` 内容根据 `controlType` 验证:
  - **power**: `params.action` 必需, 值为 "on" | "off" | "toggle"
  - **brightness**: `params.level` 必需, 值为 0-255 的整数
  - **rotation**: `params.rotation` 必需, 值为 0 | 90 | 180 | 270
**响应数据**:
```
{
  "success": true,
  "results": [
    {
      "serial": "设备序列号",
      "success": 布尔,
      "error": "错误信息" | null
    }
  ]
}
```
**错误情况**:
- 缺少 `groupId`: `MISSING_GROUP_ID`
- 缺少 `controlType`: `MISSING_CONTROL_TYPE`
- 无效的 `controlType`: `INVALID_CONTROL_TYPE`
- 缺少 `params`: `MISSING_PARAMS`
- 无效的 `params`: `INVALID_PARAMS`
- 批量操作失败: `BATCH_SCREEN_CONTROL_FAILED`

#### 6.6 `group:get_tree`
**说明**: 获取群组树结构
**请求数据**: 无需 `data` 字段
**响应数据**:
```
{
  "success": true,
  "tree": {
    "id": "root",
    "name": "所有设备",
    "children": [节点数组]
  }
}
```
**错误情况**:
- 获取失败: `GET_TREE_FAILED`

#### 6.7 `group:update_tree`
**说明**: 更新群组树结构
**请求数据**:
```
{
  "tree": {
    树结构对象
  }
}
```
**响应数据**:
```
{
  "success": true,
  "message": "Tree updated"
}
```
**错误情况**:
- 缺少 `tree`: `MISSING_TREE`
- 更新失败: `UPDATE_TREE_FAILED`

---

### 7. Config 命名空间 (6个动作)

#### 7.1 `config:get_full`
**说明**: 获取完整配置
**请求数据**: 无需 `data` 字段
**响应数据**:
```
{
  "success": true,
  "config": {
    "global": {全局配置},
    "devices": {设备配置字典}
  }
}
```

#### 7.2 `config:get_global`
**说明**: 获取全局配置
**请求数据**: 无需 `data` 字段
**响应数据**:
```
{
  "success": true,
  "config": {
    "max_size": 整数 | null,
    "bit_rate": 整数 | null,
    "max_fps": 整数 | null,
    "codec": 字符串 | null,
    "control": 布尔 | null,
    "locked_video_orientation": 整数 | null
  }
}
```

#### 7.3 `config:update_global`
**说明**: 更新全局配置
**请求数据** (所有字段可选):
```
{
  "max_size": 整数 (范围: 120-4320),
  "bit_rate": 整数 (范围: 100000-20000000),
  "max_fps": 整数 (范围: 1-120),
  "codec": "h264" | "h265" | "av1",
  "control": 布尔,
  "locked_video_orientation": 整数 (范围: -1 到 3)
}
```
**验证规则**:
- `max_size`: 必须在 120-4320 之间
- `bit_rate`: 必须在 100000-20000000 之间
- `max_fps`: 必须在 1-120 之间
- `codec`: 必须是 h264, h265, 或 av1 之一
- `locked_video_orientation`: 必须在 -1 到 3 之间
**响应数据**:
```
{
  "success": true,
  "config": {更新后的配置}
}
```
**错误情况**:
- 缺少配置负载: `MISSING_PAYLOAD`
- 无效的 `max_size`: `INVALID_MAX_SIZE`
- 无效的 `bit_rate`: `INVALID_BIT_RATE`
- 无效的 `max_fps`: `INVALID_MAX_FPS`
- 无效的 `codec`: `INVALID_CODEC`
- 无效的 `locked_video_orientation`: `INVALID_ORIENTATION`

#### 7.4 `config:get_device`
**说明**: 获取设备配置
**请求数据**:
```
{
  "deviceName": "设备名称" (必需)
}
```
**响应数据**:
```
{
  "success": true,
  "device": "设备名称",
  "config": {设备配置对象}
}
```
**错误情况**:
- 缺少 `deviceName`: `MISSING_DEVICE_NAME`
- 设备未找到: `DEVICE_NOT_FOUND`

#### 7.5 `config:update_device`
**说明**: 更新设备配置
**请求数据** (除 deviceName 外所有字段可选):
```
{
  "deviceName": "设备名称" (必需),
  "max_size": 整数 (范围: 120-4320),
  "bit_rate": 整数 (范围: 100000-20000000),
  "max_fps": 整数 (范围: 1-120),
  "codec": "h264" | "h265" | "av1",
  "control": 布尔,
  "locked_video_orientation": 整数 (范围: -1 到 3)
}
```
**验证规则**: 同全局配置更新
**响应数据**:
```
{
  "success": true,
  "device": "设备名称",
  "config": {更新后的配置}
}
```
**错误情况**: 同全局配置更新，加上 `MISSING_DEVICE_NAME`

#### 7.6 `config:delete_device`
**说明**: 删除设备配置
**请求数据**:
```
{
  "deviceName": "设备名称" (必需)
}
```
**响应数据**:
```
{
  "success": true,
  "device": "设备名称"
}
```
**错误情况**:
- 缺少 `deviceName`: `MISSING_DEVICE_NAME`
- 设备未找到: `DEVICE_NOT_FOUND`

---

### 8. Control 命名空间 (7个动作)

#### 8.1 `control:touch`
**说明**: 发送触摸事件
**请求数据**:
```
{
  "serial": "设备序列号" (必需),
  "action": 动作类型,
  "pointerId": 整数 (可选, 默认: 0),
  "x": 浮点数 (必需),
  "y": 浮点数 (必需),
  "pressure": 浮点数 (可选, 默认: 1.0),
  "screenWidth": 整数 (必需),
  "screenHeight": 整数 (必需)
}
```
**响应数据**:
```
{
  "success": true
}
```
**错误情况**:
- 缺少 `serial`: `MISSING_SERIAL`
- 发送失败: `TOUCH_FAILED`

#### 8.2 `control:key`
**说明**: 发送按键事件
**请求数据**:
```
{
  "serial": "设备序列号" (必需),
  "action": 动作类型,
  "keyCode": 整数 (必需),
  "metaState": 整数 (可选, 默认: 0)
}
```
**响应数据**:
```
{
  "success": true
}
```
**错误情况**:
- 缺少 `serial`: `MISSING_SERIAL`
- 发送失败: `KEY_FAILED`

#### 8.3 `control:text`
**说明**: 发送文本输入
**请求数据**:
```
{
  "serial": "设备序列号" (必需),
  "text": "文本内容" (必需)
}
```
**响应数据**:
```
{
  "success": true
}
```
**错误情况**:
- 缺少 `serial`: `MISSING_SERIAL`
- 缺少 `text`: `MISSING_TEXT`
- 发送失败: `TEXT_FAILED`

#### 8.4 `control:swipe`
**说明**: 发送滑动手势
**请求数据**:
```
{
  "serial": "设备序列号" (必需),
  "startX": 浮点数 (必需),
  "startY": 浮点数 (必需),
  "endX": 浮点数 (必需),
  "endY": 浮点数 (必需),
  "duration": 整数 (可选, 默认: 300),
  "screenWidth": 整数 (必需),
  "screenHeight": 整数 (必需)
}
```
**响应数据**:
```
{
  "success": true
}
```
**错误情况**:
- 缺少 `serial`: `MISSING_SERIAL`
- 发送失败: `SWIPE_FAILED`

#### 8.5 `control:systemkey`
**说明**: 发送系统按键
**请求数据**:
```
{
  "serial": "设备序列号" (必需),
  "action": "home" | "back" | "recent" | "power" | "volume_up" | "volume_down" (必需)
}
```
**验证规则**: `action` 必须是有效的系统按键之一
**响应数据**:
```
{
  "success": true,
  "action": "动作名称"
}
```
**错误情况**:
- 缺少 `serial`: `MISSING_SERIAL`
- 缺少 `action`: `MISSING_ACTION`
- 无效的 `action`: `INVALID_ACTION`
- 发送失败: `SYSTEMKEY_FAILED`

#### 8.6 `control:clipboard_set`
**说明**: 设置设备剪贴板
**请求数据**:
```
{
  "serial": "设备序列号" (必需),
  "text": "剪贴板文本" (必需)
}
```
**响应数据**:
```
{
  "success": true,
  "message": "Clipboard set successfully"
}
```
**错误情况**:
- 缺少 `serial`: `MISSING_SERIAL`
- 缺少 `text`: `MISSING_TEXT`
- 设置失败: `CLIPBOARD_SET_FAILED`

#### 8.7 `control:clipboard_get`
**说明**: 获取设备剪贴板
**请求数据**:
```
{
  "serial": "设备序列号" (必需)
}
```
**响应数据**:
```
{
  "success": true,
  "text": "剪贴板文本"
}
```
**错误情况**:
- 缺少 `serial`: `MISSING_SERIAL`

---

### 9. Video 命名空间 (3个动作)

**注意**: 视频流订阅通过 `unified_ws.py` 中的 `subscribe`/`unsubscribe` 消息处理，不在命名空间动作中。

#### 9.1 `video:quality`
**说明**: 改变视频流质量
**请求数据**:
```
{
  "serial": "设备序列号" (必需),
  "max_size": 整数 (可选),
  "bit_rate": 整数 (可选),
  "max_fps": 整数 (可选)
}
```
**特殊要求**: 至少提供一个质量参数
**响应数据**:
```
{
  "success": true,
  "message": "Video quality updated",
  "params": {提供的质量参数}
}
```
**错误情况**:
- 缺少 `serial`: `MISSING_SERIAL`
- 缺少质量参数: `MISSING_QUALITY_PARAMS`

#### 9.2 `video:pause`
**说明**: 暂停视频流
**请求数据**:
```
{
  "serial": "设备序列号" (必需)
}
```
**响应数据**:
```
{
  "success": true,
  "message": "Video stream paused"
}
```
**错误情况**:
- 缺少 `serial`: `MISSING_SERIAL`

#### 9.3 `video:resume`
**说明**: 恢复视频流
**请求数据**:
```
{
  "serial": "设备序列号" (必需)
}
```
**响应数据**:
```
{
  "success": true,
  "message": "Video stream resumed"
}
```
**错误情况**:
- 缺少 `serial`: `MISSING_SERIAL`

---

## 通用数据结构

### 配置对象结构
```
{
  "max_size": 整数 | null (范围: 120-4320),
  "bit_rate": 整数 | null (范围: 100000-20000000),
  "max_fps": 整数 | null (范围: 1-120),
  "codec": "h264" | "h265" | "av1" | null,
  "control": 布尔 | null,
  "locked_video_orientation": 整数 | null (范围: -1 到 3)
}
```

### 设备信息对象结构
```
{
  "serial": "设备序列号",
  "model": "设备型号",
  "manufacturer": "制造商",
  "android_version": "Android版本",
  "sdk_version": "SDK版本号",
  "resolution": {
    "width": 整数,
    "height": 整数
  },
  "dpi": 整数
}
```

### 错误响应结构
```
{
  "error": {
    "code": "错误代码",
    "message": "错误消息"
  }
}
```

---

## 前端实施建议

### 1. API 客户端实现

#### 需要实现的文件:
1. `services/api/client.ts` - HTTP 和 WebSocket 客户端封装
2. `services/api/endpoints.ts` - REST API 端点函数
3. `services/api/websocket.ts` - WebSocket 消息处理
4. `services/api/types.ts` - TypeScript 类型定义

### 2. 核心功能优先级

**P0 (关键功能)**:
- WebSocket 连接管理
- 设备列表和连接
- 视频流接收和解码
- 基础设备控制（触摸、按键）

**P1 (重要功能)**:
- 屏幕控制（亮度、旋转、电源）
- 文件推送和 APK 安装
- 截图功能
- 配置管理

**P2 (增强功能)**:
- 屏幕录制
- 群组批量操作
- 剪贴板同步
- 高级控制（滑动手势）

### 3. 视频流实现

**技术方案**: H.264 二进制流 + Broadway.js 解码器
**实现步骤**:
1. 建立 WebSocket 连接到 `/ws`
2. 发送视频流订阅消息
3. 接收 H.264 二进制帧数据
4. 使用 Broadway.js 解码为 Canvas 渲染

### 4. 状态管理建议

**推荐使用**: Zustand 或 Redux Toolkit
**需要管理的状态**:
- 设备列表和连接状态
- 视频流状态
- 配置数据
- UI 交互状态

---

**文档版本**: v2.0
**最后更新**: 2025-12-04
**维护者**: Matrix 开发团队
