# Matrix API Documentation

**Version:** 2.3.0
**更新日期:** 2025-12-09
**Protocol:** RPC v2 WebSocket
**Endpoint:** `ws://localhost:48000/rpc/ws`

**视频流方案（双模式支持）:**
- ✅ **H.264 直传模式** - 推荐（已验证，基于scrcpy_web_test）
  - WebSocket端点: `ws://localhost:48000/video/{serial}`
  - 直接传输H.264数据，前端WebCodecs解码
  - 低延迟（~30-50ms），低带宽（0.5-2 Mbps）
  - 浏览器兼容性：Chrome/Edge 94+

- ⚠️ **YUV 解码模式** - 实验性（需要PyAV）
  - WebSocket端点: `ws://localhost:48000/video/yuv/{serial}`
  - 后端FFmpeg解码H.264→YUV，前端WebGL渲染
  - 低延迟（~40-60ms），高带宽（~90 Mbps，仅限局域网）
  - 浏览器兼容性：所有支持WebGL的浏览器
  - 需要安装: `pip install av`

---

## 目录

1. [概览](#概览)
2. [架构与参数传递](#架构与参数传递)
3. [协议格式](#协议格式)
4. [API端点清单](#api端点清单)
5. [详细端点文档](#详细端点文档)
6. [客户端实现示例](#客户端实现示例)
7. [错误代码](#错误代码)

---

## 概览

Matrix 应用已完全迁移到 **RPC v2 WebSocket 协议**。所有 HTTP REST API 和自定义 WebSocket 端点已被移除，统一使用 RPC v2 WebSocket。

### 关键特性

- ✅ **统一协议** - 所有端点使用 RPC v2 WebSocket
- ✅ **完全 WebSocket** - 移除所有 HTTP REST 端点
- ✅ **ACK 机制** - 可靠的消息确认
- ✅ **请求/响应模式** - 基于请求 ID 的异步响应
- ✅ **50 个端点** - 覆盖设备管理、屏幕控制、文件管理、录制、分组、配置、控制、视频流
- ✅ **Host/Slave 同步** - 实时输入事件广播（QtScrcpy 风格）

---

## 架构与参数传递

### 启动流程

```
1. python pymain.py app=matrix
   ↓
2. matrix_main.py
   ├── 定义 rpc_init_callback(rpc_server)
   └── 创建 NativeUIConfig(rpc_init_callback=rpc_init_callback)
   ↓
3. launch_native_app(config)
   ├── native_ui 系统初始化
   └── 启动 RPC v2 服务（通过 pylauncher）
   ↓
4. pycore/pythreadpool/starters.py: start_rpc_v2(config)
   ├── 创建 FastAPIRPCServerRunner
   ├── instance.start()
   └── 调用 init_callback(instance.server)  ← 传递 callback
   ↓
5. matrix_main.py: rpc_init_callback(rpc_server)
   └── 调用 api/main.py: register_all_routes(rpc_server)
   ↓
6. api/main.py: register_all_routes()
   ├── _register_health_routes()
   ├── _register_device_routes()
   ├── _register_screen_routes()
   ├── _register_file_routes()
   ├── _register_recording_routes()
   ├── _register_group_routes()
   ├── _register_config_routes()
   ├── _register_control_routes()
   └── _register_video_routes()
   ↓
7. 44 个端点注册完成，服务可用
```

### 文件结构

```
pyapps/matrix/
├── matrix_main.py                  # 入口（配置 + callback 定义）
├── api/
│   ├── __init__.py                # 导出 register_all_routes
│   └── main.py                    # 44个RPC路由定义
├── services/                       # 业务逻辑
│   ├── device_service.py
│   ├── screen_service.py
│   ├── file_service.py
│   ├── recording_service.py
│   ├── group_service.py
│   ├── config_service.py
│   ├── control_service.py
│   └── video_stream_service.py
└── docs/
    └── API_DOCUMENTATION.md       # 本文档
```

### 配置传递链路

```python
# 1. matrix_main.py
def rpc_init_callback(rpc_server):
    from pyapps.matrix.api.main import register_all_routes
    register_all_routes(rpc_server)

config = NativeUIConfig(
    rpc_enabled=True,
    rpc_port=48000,
    rpc_init_callback=rpc_init_callback  # ← 关键：传递 callback
)

# 2. pycore/pyutils/native_ui/step3_launcher/launch_native_app.py
rpc_v2_config = {
    'port': config.rpc_port,
    'host': config.rpc_host,
    'init_callback': config.rpc_init_callback  # ← 传递给 pylauncher
}

# 3. pycore/pythreadpool/starters.py
def start_rpc_v2(config):
    instance = FastAPIRPCServerRunner(...)
    instance.start()

    if init_callback and callable(init_callback):
        init_callback(instance.server)  # ← 调用 callback
```

---

## 协议格式

### 请求格式

```json
{
  "type": "request",
  "id": "req-001",
  "route": "device.list",
  "data": {
    "param1": "value1"
  },
  "timestamp": 1733200000000
}
```

### 响应格式

```json
{
  "type": "response",
  "id": "req-001",
  "route": "device.list",
  "success": true,
  "data": {
    "devices": [],
    "count": 0
  },
  "timestamp": 1733200000100,
  "requires_ack": true
}
```

### 错误格式

```json
{
  "type": "response",
  "id": "req-001",
  "route": "device.list",
  "success": false,
  "error": {
    "code": "DEVICE_NOT_FOUND",
    "message": "Device not found or offline"
  }
}
```

---

## API端点清单

**总计：50 个端点**

### 1. Health & System (2)
- `health` - 基础健康检查
- `health.detailed` - 详细健康检查

### 2. Device Management (5)
- `device.list` - 列出所有设备
- `device.info` - 获取设备详情
- `device.connect` - 连接设备
- `device.disconnect` - 断开设备
- `device.batch_configure` - 批量配置设备

### 3. Screen Control (7)
- `screen.power` - 控制屏幕电源
- `screen.brightness.set` - 设置屏幕亮度
- `screen.brightness.get` - 获取屏幕亮度
- `screen.rotation.set` - 设置屏幕旋转
- `screen.rotation.get` - 获取屏幕旋转
- `screen.rotation.auto_enable` - 启用自动旋转
- `screen.rotation.auto_disable` - 禁用自动旋转

### 4. File Management (3)
- `file.packages` - 列出已安装包
- `file.apk_uninstall` - 卸载 APK
- `file.transfer_status` - 获取文件传输状态

### 5. Recording & Screenshot (4)
- `recording.start` - 开始录屏
- `recording.stop` - 停止录屏
- `recording.status` - 获取录屏状态
- `screenshot.capture` - 截图

### 6. Group Management & Sync (13) ⭐ 新增
#### 6.1 Group Management (6)
- `group.create` - 创建设备组（指定 master）
- `group.add_slave` - 添加 slave 设备到组
- `group.remove_slave` - 从组中移除 slave 设备
- `group.enable_sync` - 启用 Host/Slave 输入同步
- `group.disable_sync` - 禁用 Host/Slave 输入同步
- `group.get_state` - 获取组状态（master/slaves/sync 状态）

#### 6.2 Batch Operations (7)
- `group.batch_screenshot` - 批量截图
- `group.batch_start_recording` - 批量开始录屏
- `group.batch_stop_recording` - 批量停止录屏
- `group.batch_system_key` - 批量系统按键
- `group.batch_screen_control` - 批量屏幕控制
- `group.tree` - 获取分组树
- `group.tree_update` - 更新分组树

### 7. Configuration (6)
- `config.full` - 获取完整配置
- `config.global` - 获取全局配置
- `config.global_update` - 更新全局配置
- `config.device` - 获取设备配置
- `config.device_update` - 更新设备配置
- `config.device_delete` - 删除设备配置

### 8. Device Control (7)
- `control.touch` - 触摸事件（自动同步到 slaves）⭐
- `control.key` - 按键事件（自动同步到 slaves）⭐
- `control.text` - 文本输入（自动同步到 slaves）⭐
- `control.swipe` - 滑动手势（自动同步到 slaves）⭐
- `control.systemkey` - 系统按键（自动同步到 slaves）⭐
- `control.clipboard_set` - 设置剪贴板（自动同步到 slaves）⭐
- `control.clipboard_get` - 获取剪贴板

### 9. Video Stream (5)
- `video.quality` - 调整视频质量
- `video.pause` - 暂停视频流
- `video.resume` - 恢复视频流
- `video.stream.h264` - H.264 原始流推送（当前默认方式）
- `video.stream.yuv` - YUV420P 推流（WebGL 优化，低延迟）⭐ 新增

---

## 详细端点文档

### 1. Health & System

#### `health`
基础健康检查

**请求:**
```json
{
  "type": "request",
  "id": "req-001",
  "route": "health",
  "data": {}
}
```

**响应:**
```json
{
  "status": "healthy",
  "service": "Matrix",
  "version": "2.0.0",
  "protocol": "RPC v2 WebSocket",
  "timestamp": "2025-12-08T12:00:00"
}
```

#### `health.detailed`
详细健康检查（包含系统资源信息）

**响应包含:**
- 服务信息（名称、版本、描述）
- 系统信息（平台、Python版本）
- 资源信息（CPU、内存、磁盘使用率）

---

### 2. Device Management

#### `device.list`
列出所有 ADB 设备

**请求:**
```json
{
  "type": "request",
  "id": "req-001",
  "route": "device.list",
  "data": {}
}
```

**响应:**
```json
{
  "devices": [
    {
      "serial": "ABC123",
      "status": "device",
      "model": "SM-G950F",
      "manufacturer": "samsung"
    }
  ],
  "count": 1
}
```

#### `device.info`
获取设备详细信息

**请求参数:**
- `serial` (string, 必需) - 设备序列号

**响应:**
```json
{
  "device": {
    "serial": "ABC123",
    "model": "SM-G950F",
    "manufacturer": "samsung",
    "android_version": "9.0",
    "sdk_version": 28,
    "resolution": {
      "width": 1080,
      "height": 1920
    },
    "dpi": 480
  }
}
```

#### `device.connect`
连接设备进行镜像

**请求参数:**
- `serial` (string, 必需) - 设备序列号
- `max_size` (int, 可选, 默认: 720) - 最大分辨率
- `bit_rate` (int, 可选, 默认: 8000000) - 比特率
- `max_fps` (int, 可选, 默认: 60) - 最大帧率
- `codec` (string, 可选) - 编解码器 (h264/h265/av1)
- `control` (bool, 可选) - 是否启用控制
- `locked_video_orientation` (int, 可选) - 锁定视频方向
- `device_name` (string, 可选) - 设备名称

#### `device.disconnect`
断开设备连接

**请求参数:**
- `serial` (string, 必需) - 设备序列号

#### `device.batch_configure`
批量配置多个设备

**请求参数:**
- `devices` (array, 必需) - 设备序列号列表
- `config` (object, 必需) - 配置对象
  - `screenPower` (string, 可选) - 屏幕电源 (on/off/toggle)
  - `brightness` (int, 可选) - 亮度 (0-255)
  - `screenRotation` (int, 可选) - 屏幕旋转 (0/90/180/270)

---

### 3. Screen Control

#### `screen.power`
控制屏幕电源

**请求参数:**
- `serial` (string, 必需) - 设备序列号
- `action` (string, 必需) - 操作 (on/off/toggle)

#### `screen.brightness.set`
设置屏幕亮度

**请求参数:**
- `serial` (string, 必需) - 设备序列号
- `level` (int, 必需) - 亮度级别 (0-255)

#### `screen.brightness.get`
获取当前屏幕亮度

**请求参数:**
- `serial` (string, 必需) - 设备序列号

#### `screen.rotation.set`
设置屏幕旋转

**请求参数:**
- `serial` (string, 必需) - 设备序列号
- `rotation` (int, 必需) - 旋转角度 (0/90/180/270)

#### `screen.rotation.get`
获取当前屏幕旋转

**请求参数:**
- `serial` (string, 必需) - 设备序列号

#### `screen.rotation.auto_enable`
启用自动旋转

**请求参数:**
- `serial` (string, 必需) - 设备序列号

#### `screen.rotation.auto_disable`
禁用自动旋转

**请求参数:**
- `serial` (string, 必需) - 设备序列号

---

### 4. File Management

#### `file.packages`
列出已安装的包

**请求参数:**
- `serial` (string, 必需) - 设备序列号
- `filter` (string, 可选) - 过滤模式 (例如: "com.example")

#### `file.apk_uninstall`
卸载 APK

**请求参数:**
- `serial` (string, 必需) - 设备序列号
- `packageName` (string, 必需) - 包名

#### `file.transfer_status`
获取文件传输任务状态

**请求参数:**
- `taskId` (string, 必需) - 任务 ID

---

### 5. Recording & Screenshot

#### `recording.start`
开始屏幕录制

**请求参数:**
- `serial` (string, 必需) - 设备序列号
- `quality` (string, 可选, 默认: "high") - 质量 (high/medium/low)
- `maxDuration` (int, 可选, 默认: 1800) - 最大时长（秒）

#### `recording.stop`
停止屏幕录制

**请求参数:**
- `serial` (string, 必需) - 设备序列号

#### `recording.status`
获取录制状态

**请求参数:**
- `serial` (string, 必需) - 设备序列号

**响应:**
```json
{
  "success": true,
  "isRecording": true,
  "recordingInfo": {
    "recordingId": "rec-001",
    "startTime": "2025-12-08T12:00:00"
  }
}
```

#### `screenshot.capture`
捕获截图

**请求参数:**
- `serial` (string, 必需) - 设备序列号
- `format` (string, 可选, 默认: "png") - 格式 (png/jpg)

---

### 6. Group Management & Sync

Matrix 支持 Host/Slave 设备组管理和实时输入同步。当启用同步后，master 设备的触摸、按键、文本输入等事件会自动广播到所有 slave 设备（类似 QtScrcpy 的 GroupController 功能）。

#### 6.1 Group Management

##### `group.create`
创建设备组并指定 master 设备

**请求参数:**
- `groupId` (string, 必需) - 分组唯一 ID
- `hostSerial` (string, 必需) - Master 设备序列号

**请求示例:**
```json
{
  "type": "request",
  "id": "req-001",
  "route": "group.create",
  "data": {
    "groupId": "group-001",
    "hostSerial": "ABC123"
  }
}
```

**响应:**
```json
{
  "success": true,
  "groupId": "group-001",
  "hostSerial": "ABC123"
}
```

##### `group.add_slave`
添加 slave 设备到组

**请求参数:**
- `groupId` (string, 必需) - 分组 ID
- `slaveSerial` (string, 必需) - Slave 设备序列号

**请求示例:**
```json
{
  "route": "group.add_slave",
  "data": {
    "groupId": "group-001",
    "slaveSerial": "DEF456"
  }
}
```

**响应:**
```json
{
  "success": true,
  "groupId": "group-001",
  "slaveSerial": "DEF456"
}
```

##### `group.remove_slave`
从组中移除 slave 设备

**请求参数:**
- `groupId` (string, 必需) - 分组 ID
- `slaveSerial` (string, 必需) - Slave 设备序列号

**响应:**
```json
{
  "success": true,
  "groupId": "group-001",
  "slaveSerial": "DEF456"
}
```

##### `group.enable_sync`
启用 Host/Slave 实时输入同步

**请求参数:**
- `groupId` (string, 必需) - 分组 ID

**请求示例:**
```json
{
  "route": "group.enable_sync",
  "data": {
    "groupId": "group-001"
  }
}
```

**响应:**
```json
{
  "success": true,
  "groupId": "group-001",
  "syncEnabled": true
}
```

**说明:**
启用后，发送到 master 设备的以下事件会自动广播到所有 slave 设备：
- `control.touch` - 触摸事件
- `control.key` - 按键事件
- `control.text` - 文本输入
- `control.swipe` - 滑动手势

##### `group.disable_sync`
禁用 Host/Slave 实时输入同步

**请求参数:**
- `groupId` (string, 必需) - 分组 ID

**响应:**
```json
{
  "success": true,
  "groupId": "group-001",
  "syncEnabled": false
}
```

##### `group.get_state`
获取组状态（master/slaves/sync 状态）

**请求参数:**
- `groupId` (string, 必需) - 分组 ID

**请求示例:**
```json
{
  "route": "group.get_state",
  "data": {
    "groupId": "group-001"
  }
}
```

**响应:**
```json
{
  "success": true,
  "groupId": "group-001",
  "hostSerial": "ABC123",
  "slaveSerials": ["DEF456", "GHI789"],
  "totalDevices": 3,
  "enabled": true
}
```

**响应字段说明:**
- `hostSerial` - Master 设备序列号
- `slaveSerials` - Slave 设备序列号列表
- `totalDevices` - 总设备数（master + slaves）
- `enabled` - 是否启用实时同步

#### 6.2 Batch Operations

#### `group.batch_screenshot`
批量截图

**请求参数:**
- `groupId` (string, 必需) - 分组 ID
- `format` (string, 可选, 默认: "png") - 格式 (png/jpg)

#### `group.batch_start_recording`
批量开始录屏

**请求参数:**
- `groupId` (string, 必需) - 分组 ID
- `quality` (string, 可选, 默认: "high") - 质量
- `maxDuration` (int, 可选, 默认: 1800) - 最大时长（秒）

#### `group.batch_stop_recording`
批量停止录屏

**请求参数:**
- `groupId` (string, 必需) - 分组 ID

#### `group.batch_system_key`
批量发送系统按键

**请求参数:**
- `groupId` (string, 必需) - 分组 ID
- `action` (string, 必需) - 操作 (home/back/recent/power/volume_up/volume_down)

#### `group.batch_screen_control`
批量屏幕控制

**请求参数:**
- `groupId` (string, 必需) - 分组 ID
- `controlType` (string, 必需) - 控制类型 (power/brightness/rotation)
- `params` (object, 必需) - 参数对象
  - 对于 power: `{"action": "on"}`
  - 对于 brightness: `{"level": 200}`
  - 对于 rotation: `{"rotation": 90}`

#### `group.tree`
获取分组树结构

**请求:**
```json
{
  "type": "request",
  "id": "req-001",
  "route": "group.tree",
  "data": {}
}
```

#### `group.tree_update`
更新分组树结构

**请求参数:**
- `tree` (array, 必需) - 新的树结构

---

### 7. Configuration

Matrix 配置系统支持全局配置和设备级配置，配置会持久化到本地文件。

**配置文件路径:**
- **Windows**: `%USERPROFILE%/.core_node/scrcpy/config/settings.json`
- **Linux**: `/var/_core_node/scrcpy/config/settings.json`

**配置加载机制:**
1. 应用启动时从配置文件加载配置
2. 如果文件不存在，使用默认配置
3. 更新配置时，立即写入内存并同步到文件

**支持的配置项:**

| 配置键 | 类型 | 默认值 | 说明 |
|-------|------|--------|------|
| `max_size` | int | 720 | 视频最大分辨率（短边） |
| `bit_rate` | int | 8000000 | 视频比特率（8 Mbps） |
| `max_fps` | int | 60 | 最大帧率 |
| `codec` | string | "h264" | 视频编解码器 |
| `control` | boolean | true | 是否启用控制 |
| `locked_video_orientation` | int | -1 | 锁定视频方向（-1=自动，0/90/180/270） |
| `video_stream_mode` | string | "h264" | **视频流模式** ("h264" or "yuv") |

**视频流模式说明:**
- **`"h264"`** - H.264 直传模式（推荐）
  - 低延迟（~30-50ms）
  - 低带宽（0.5-2 Mbps）
  - 适合生产环境和远程访问
  - 前端使用 WebCodecs 解码

- **`"yuv"`** - YUV 解码模式（实验性）
  - 低延迟（~40-60ms）
  - 高带宽（~90 Mbps）
  - 仅适合局域网调试
  - 前端使用 WebGL 渲染
  - 需要后端安装 PyAV: `pip install av`

---

#### `config.full`
获取完整配置（包含全局配置和所有设备配置）

**请求:**
```json
{
  "type": "request",
  "id": "req-config-001",
  "route": "config.full",
  "data": {}
}
```

**响应:**
```json
{
  "type": "response",
  "id": "req-config-001",
  "data": {
    "global": {
      "max_size": 720,
      "bit_rate": 8000000,
      "max_fps": 60,
      "codec": "h264",
      "control": true,
      "locked_video_orientation": -1,
      "video_stream_mode": "h264"
    },
    "devices": {
      "ABC123": {
        "max_size": 1080,
        "bit_rate": 4000000,
        "video_stream_mode": "yuv"
      }
    }
  }
}
```

---

#### `config.global`
获取全局配置

**请求:**
```json
{
  "type": "request",
  "id": "req-config-002",
  "route": "config.global",
  "data": {}
}
```

**响应:**
```json
{
  "type": "response",
  "id": "req-config-002",
  "data": {
    "max_size": 720,
    "bit_rate": 8000000,
    "max_fps": 60,
    "codec": "h264",
    "control": true,
    "locked_video_orientation": -1,
    "video_stream_mode": "h264"
  }
}
```

---

#### `config.global_update`
更新全局配置（立即写入内存并同步到文件）

**请求参数:**
- 配置对象（动态参数，只需包含要更新的字段）

**切换视频流模式示例:**
```json
{
  "type": "request",
  "id": "req-config-003",
  "route": "config.global_update",
  "data": {
    "video_stream_mode": "yuv"
  }
}
```

**批量更新示例:**
```json
{
  "type": "request",
  "id": "req-config-004",
  "route": "config.global_update",
  "data": {
    "max_size": 1080,
    "bit_rate": 4000000,
    "max_fps": 30,
    "video_stream_mode": "h264"
  }
}
```

**响应:**
```json
{
  "type": "response",
  "id": "req-config-003",
  "data": {
    "max_size": 720,
    "bit_rate": 8000000,
    "max_fps": 60,
    "codec": "h264",
    "control": true,
    "locked_video_orientation": -1,
    "video_stream_mode": "yuv"
  }
}
```

---

#### `config.device`
获取设备特定配置

**请求参数:**
- `deviceName` (string, 必需) - 设备名称或序列号

**请求示例:**
```json
{
  "type": "request",
  "id": "req-config-005",
  "route": "config.device",
  "data": {
    "deviceName": "ABC123"
  }
}
```

**响应:**
```json
{
  "type": "response",
  "id": "req-config-005",
  "data": {
    "max_size": 1080,
    "bit_rate": 4000000,
    "video_stream_mode": "yuv"
  }
}
```

**说明:**
- 如果设备配置不存在，返回 `null`
- 设备配置会覆盖全局配置
- 只返回设备特定的配置项（不包含全局默认值）

---

#### `config.device_update`
更新设备特定配置（立即写入内存并同步到文件）

**请求参数:**
- `deviceName` (string, 必需) - 设备名称或序列号
- `config` (object, 必需) - 配置对象

**为特定设备切换视频流模式:**
```json
{
  "type": "request",
  "id": "req-config-006",
  "route": "config.device_update",
  "data": {
    "deviceName": "ABC123",
    "config": {
      "video_stream_mode": "yuv",
      "max_size": 1080
    }
  }
}
```

**响应:**
```json
{
  "type": "response",
  "id": "req-config-006",
  "data": {
    "max_size": 1080,
    "bit_rate": 4000000,
    "video_stream_mode": "yuv"
  }
}
```

---

#### `config.device_delete`
删除设备特定配置（恢复为使用全局配置）

**请求参数:**
- `deviceName` (string, 必需) - 设备名称或序列号

**请求示例:**
```json
{
  "type": "request",
  "id": "req-config-007",
  "route": "config.device_delete",
  "data": {
    "deviceName": "ABC123"
  }
}
```

**响应:**
```json
{
  "type": "response",
  "id": "req-config-007",
  "data": {
    "success": true
  }
}
```

---

**配置优先级:**
1. 运行时传入的参数（如 `device.connect` 的参数）
2. 设备级配置（`config.device_update`）
3. 全局配置（`config.global_update`）
4. 默认配置（硬编码在 Config 类中）

**使用场景示例:**

**场景1: 全局切换到 H.264 模式**
```javascript
// 适用于生产环境，所有设备使用低带宽模式
await client.request('config.global_update', {
  video_stream_mode: 'h264',
  bit_rate: 2000000,
  max_fps: 30
});
```

**场景2: 特定设备使用 YUV 模式调试**
```javascript
// 仅对特定设备启用 YUV 模式，用于局域网调试
await client.request('config.device_update', {
  deviceName: 'ABC123',
  config: {
    video_stream_mode: 'yuv',
    max_size: 1080
  }
});
```

**场景3: 检查当前配置**
```javascript
// 获取完整配置，查看全局和设备级设置
const fullConfig = await client.request('config.full');
console.log('Global mode:', fullConfig.global.video_stream_mode);
console.log('Device configs:', fullConfig.devices);
```

---

### 8. Device Control

#### `control.touch`
发送触摸事件

**自动广播**: ✅ 如果设备是 master，自动同步到所有 slave 设备（并发广播，自动坐标映射）

**请求参数:**
- `serial` (string, 必需) - 设备序列号
- `action` (string, 必需) - 动作 (down/up/move)
- `pointerId` (int, 可选, 默认: 0) - 指针 ID
- `x` (int, 必需) - X 坐标
- `y` (int, 必需) - Y 坐标
- `pressure` (float, 可选, 默认: 1.0) - 压力
- `screenWidth` (int, 必需) - 屏幕宽度
- `screenHeight` (int, 必需) - 屏幕高度

**请求示例:**
```json
{
  "type": "request",
  "id": "req-001",
  "route": "control.touch",
  "data": {
    "serial": "ABC123",
    "action": "down",
    "x": 500,
    "y": 1000,
    "screenWidth": 1080,
    "screenHeight": 1920
  }
}
```

**响应示例:**
```json
{
  "type": "response",
  "id": "req-001",
  "data": {
    "success": true,
    "broadcasted_to": ["device2", "device3"]
  }
}
```

---

#### `control.key`
发送按键事件

**自动广播**: ✅ 如果设备是 master，自动同步到所有 slave 设备（并发广播）

**请求参数:**
- `serial` (string, 必需) - 设备序列号
- `action` (string, 必需) - 动作 (down/up)
- `keyCode` (int, 必需) - 按键码（Android KeyEvent keycodes）
- `metaState` (int, 可选, 默认: 0) - Meta 状态

**支持的特殊按键码:**
- `278` - KEYCODE_COPY (复制)
- `277` - KEYCODE_CUT (剪切)
- `279` - KEYCODE_PASTE (粘贴)

**请求示例:**
```json
{
  "type": "request",
  "id": "req-002",
  "route": "control.key",
  "data": {
    "serial": "ABC123",
    "action": "down",
    "keyCode": 4
  }
}
```

**响应示例:**
```json
{
  "type": "response",
  "id": "req-002",
  "data": {
    "success": true,
    "broadcasted_to": ["device2"]
  }
}
```

---

#### `control.text`
发送文本输入

**自动广播**: ✅ 如果设备是 master，自动同步到所有 slave 设备（并发广播）

**请求参数:**
- `serial` (string, 必需) - 设备序列号
- `text` (string, 必需) - 文本内容（支持 Unicode、中文、emoji）

**请求示例:**
```json
{
  "type": "request",
  "id": "req-003",
  "route": "control.text",
  "data": {
    "serial": "ABC123",
    "text": "Hello 世界 👋"
  }
}
```

**响应示例:**
```json
{
  "type": "response",
  "id": "req-003",
  "data": {
    "success": true,
    "broadcasted_to": ["device2", "device3"]
  }
}
```

---

#### `control.swipe`
发送滑动手势

**自动广播**: ✅ 如果设备是 master，自动同步到所有 slave 设备（并发广播，自动坐标映射）

**请求参数:**
- `serial` (string, 必需) - 设备序列号
- `startX` (int, 必需) - 起始 X 坐标
- `startY` (int, 必需) - 起始 Y 坐标
- `endX` (int, 必需) - 结束 X 坐标
- `endY` (int, 必需) - 结束 Y 坐标
- `duration` (int, 可选, 默认: 300) - 持续时间（毫秒）
- `screenWidth` (int, 必需) - 屏幕宽度
- `screenHeight` (int, 必需) - 屏幕高度

**请求示例:**
```json
{
  "type": "request",
  "id": "req-004",
  "route": "control.swipe",
  "data": {
    "serial": "ABC123",
    "startX": 500,
    "startY": 1500,
    "endX": 500,
    "endY": 500,
    "duration": 300,
    "screenWidth": 1080,
    "screenHeight": 1920
  }
}
```

**响应示例:**
```json
{
  "type": "response",
  "id": "req-004",
  "data": {
    "success": true,
    "broadcasted_to": ["device2"]
  }
}
```

---

#### `control.systemkey`
发送系统按键

**自动广播**: ✅ 如果设备是 master，自动同步到所有 slave 设备（并发广播）

**请求参数:**
- `serial` (string, 必需) - 设备序列号
- `action` (string, 必需) - 操作

**支持的操作:**
- `home` - Home 键 (KEYCODE_HOME = 3)
- `back` - Back 键 (KEYCODE_BACK = 4)
- `recent` - Recent/App Switch 键 (KEYCODE_APP_SWITCH = 187)
- `menu` - Menu 键 (KEYCODE_MENU = 82) ← 新增
- `power` - 电源键 (KEYCODE_POWER = 26)
- `volume_up` - 音量+ (KEYCODE_VOLUME_UP = 24)
- `volume_down` - 音量- (KEYCODE_VOLUME_DOWN = 25)
- `notification` - 展开通知栏 (cmd statusbar expand-notifications) ← 新增
- `notification_close` - 收起通知栏 (cmd statusbar collapse) ← 新增

**请求示例:**
```json
{
  "type": "request",
  "id": "req-005",
  "route": "control.systemkey",
  "data": {
    "serial": "ABC123",
    "action": "home"
  }
}
```

**展开通知栏示例:**
```json
{
  "type": "request",
  "id": "req-006",
  "route": "control.systemkey",
  "data": {
    "serial": "ABC123",
    "action": "notification"
  }
}
```

**响应示例:**
```json
{
  "type": "response",
  "id": "req-005",
  "data": {
    "success": true,
    "broadcasted_to": ["device2", "device3"]
  }
}
```

---

#### `control.clipboard_set`
设置设备剪贴板

**自动广播**: ✅ 如果设备是 master，自动同步到所有 slave 设备（并发广播）

**请求参数:**
- `serial` (string, 必需) - 设备序列号
- `text` (string, 必需) - 剪贴板文本（支持 Unicode、特殊字符自动转义）

**请求示例:**
```json
{
  "type": "request",
  "id": "req-007",
  "route": "control.clipboard_set",
  "data": {
    "serial": "ABC123",
    "text": "Copied text with \"quotes\" and 'special' chars"
  }
}
```

**响应示例:**
```json
{
  "type": "response",
  "id": "req-007",
  "data": {
    "success": true,
    "broadcasted_to": ["device2"]
  }
}
```

---

#### `control.clipboard_get`
获取设备剪贴板

**自动广播**: ⚠️ 无需广播（读取操作）

**请求参数:**
- `serial` (string, 必需) - 设备序列号

**请求示例:**
```json
{
  "type": "request",
  "id": "req-008",
  "route": "control.clipboard_get",
  "data": {
    "serial": "ABC123"
  }
}
```

**响应示例:**
```json
{
  "type": "response",
  "id": "req-008",
  "data": {
    "text": "Current clipboard content"
  }
}
```

---

### 9. Video Stream

Matrix 支持两种视频流模式，根据使用场景选择：

| 特性 | H.264 直传模式 ✅ | YUV 解码模式 ⚠️ |
|------|-----------------|----------------|
| **推荐度** | **推荐（已验证）** | 实验性 |
| **端点** | `ws://localhost:48000/video/{serial}` | `ws://localhost:48000/video/yuv/{serial}` |
| **延迟** | ~30-50ms | ~40-60ms |
| **带宽** | 0.5-2 Mbps | ~90 Mbps |
| **前端复杂度** | 中等（WebCodecs） | 低（WebGL） |
| **浏览器兼容性** | Chrome/Edge 94+ | 所有现代浏览器 |
| **后端依赖** | 无 | PyAV (pip install av) |
| **适用场景** | 生产环境 | 局域网调试 |

---

#### `video.quality`
调整视频流质量

**请求参数:**
- `serial` (string, 必需) - 设备序列号
- `max_size` (int, 可选) - 最大分辨率
- `bit_rate` (int, 可选) - 比特率
- `max_fps` (int, 可选) - 最大帧率

**请求示例:**
```json
{
  "type": "request",
  "id": "req-video-001",
  "route": "video.quality",
  "data": {
    "serial": "ABC123",
    "max_size": 720,
    "bit_rate": 2000000,
    "max_fps": 30
  }
}
```

**响应示例:**
```json
{
  "type": "response",
  "id": "req-video-001",
  "data": {
    "success": true,
    "message": "Quality settings updated. Reconnect video stream to apply changes."
  }
}
```

---

#### `video.pause`
暂停视频流

**请求参数:**
- `serial` (string, 必需) - 设备序列号

**请求示例:**
```json
{
  "type": "request",
  "id": "req-video-002",
  "route": "video.pause",
  "data": {
    "serial": "ABC123"
  }
}
```

**响应示例:**
```json
{
  "type": "response",
  "id": "req-video-002",
  "data": {
    "success": true,
    "message": "Video stream paused"
  }
}
```

---

#### `video.resume`
恢复视频流

**请求参数:**
- `serial` (string, 必需) - 设备序列号

**请求示例:**
```json
{
  "type": "request",
  "id": "req-video-003",
  "route": "video.resume",
  "data": {
    "serial": "ABC123"
  }
}
```

**响应示例:**
```json
{
  "type": "response",
  "id": "req-video-003",
  "data": {
    "success": true,
    "message": "Video stream resumed"
  }
}
```

---

#### `video.stream.h264` ✅ 推荐
H.264 直传模式（基于 scrcpy_web_test 验证方案）

**说明**:
- 直接传输 H.264 NAL units，前端使用 WebCodecs API 解码
- 协议来自 scrcpy_web_test（已验证可用）
- 低延迟、低带宽、适合生产环境

**WebSocket 连接**: `ws://localhost:48000/video/{serial}`

**协议流程**:
1. 客户端连接 WebSocket
2. 后端接受连接
3. 开始推送二进制 H.264 帧
4. 每 60 帧推送一次元数据 (JSON)

**H.264 帧协议** (Binary):
```
[serial_len (1 byte)]     # 序列号长度
[serial (N bytes)]        # 设备序列号
[pts (8 bytes, BE)]       # Presentation Timestamp (big-endian uint64)
                          # Bit 63 (0x8000000000000000): is_config frame (SPS/PPS)
                          # Bit 62 (0x4000000000000000): is_keyframe (IDR)
                          # Bits 0-61: 实际时间戳（纳秒）
[size (4 bytes, BE)]      # H.264 数据长度 (big-endian uint32)
[H.264 data (N bytes)]    # 原始 NAL units (Annex-B 格式)
```

**PTS 编码解析**:
```javascript
// 读取 PTS
const view = new DataView(event.data);
const ptsRaw = view.getBigUint64(offset, false); // false = big-endian

// 提取标志位
const isConfig = (ptsRaw & 0x8000000000000000n) !== 0n;
const isKeyframe = (ptsRaw & 0x4000000000000000n) !== 0n;

// 提取实际时间戳（清除标志位）
const timestamp = Number(ptsRaw & 0x3FFFFFFFFFFFFFFFn);
```

**元数据消息** (每 60 帧):
```json
{
  "type": "video.metadata",
  "timestamp": 1000,
  "data": {
    "fps": 58.5,
    "frames": 3540,
    "bytes": 12582912,
    "mbps": 1.5
  }
}
```

**前端实现 - WebCodecs H.264 解码**:

```typescript
// 1. 创建 VideoDecoder
let decoder: VideoDecoder | null = null;

function initDecoder(width: number, height: number) {
  decoder = new VideoDecoder({
    output: (frame: VideoFrame) => {
      // 渲染到 Canvas
      const canvas = document.getElementById('video-canvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(frame, 0, 0, canvas.width, canvas.height);
      frame.close();
    },
    error: (error: DOMException) => {
      console.error('[VideoDecoder] Error:', error);
    }
  });

  decoder.configure({
    codec: 'avc1.42C01E', // H.264 Baseline Profile Level 3.0
    codedWidth: width,
    codedHeight: height,
    optimizeForLatency: true
  });
}

// 2. 连接 WebSocket
const ws = new WebSocket('ws://localhost:48000/video/ABC123');
ws.binaryType = 'arraybuffer';

ws.onmessage = (event) => {
  if (event.data instanceof ArrayBuffer) {
    const data = new Uint8Array(event.data);
    let offset = 0;

    // 解析协议头
    const serialLen = data[offset++];
    const serial = new TextDecoder().decode(data.slice(offset, offset + serialLen));
    offset += serialLen;

    const view = new DataView(event.data);
    const ptsRaw = view.getBigUint64(offset, false); // big-endian
    offset += 8;

    // 提取 PTS 标志位
    const isConfig = (ptsRaw & 0x8000000000000000n) !== 0n;
    const isKeyframe = (ptsRaw & 0x4000000000000000n) !== 0n;
    const timestamp = Number(ptsRaw & 0x3FFFFFFFFFFFFFFFn);

    const size = view.getUint32(offset, false); // big-endian
    offset += 4;

    // 提取 H.264 数据
    const h264Data = data.slice(offset, offset + size);

    // 初始化解码器（首次收到 config 帧）
    if (!decoder && isConfig) {
      initDecoder(1080, 1920); // 使用实际分辨率
    }

    // 解码 H.264 帧
    if (decoder && decoder.state === 'configured') {
      const chunk = new EncodedVideoChunk({
        type: isKeyframe ? 'key' : 'delta',
        timestamp: timestamp / 1000, // 转换为微秒
        data: h264Data
      });
      decoder.decode(chunk);
    }
  } else {
    // JSON 元数据消息
    const message = JSON.parse(event.data);
    if (message.type === 'video.metadata') {
      console.log(`FPS: ${message.data.fps}, Mbps: ${message.data.mbps}`);
    }
  }
};

// 3. 清理
ws.onclose = () => {
  decoder?.close();
  decoder = null;
};
```

**浏览器兼容性**:
- ✅ Chrome/Edge 94+
- ✅ Opera 80+
- ❌ Firefox (WebCodecs 未完全支持)
- ❌ Safari (WebCodecs 未支持)

**特点**:
- ✅ **低延迟** (~30-50ms)
- ✅ **低带宽** (0.5-2 Mbps，适合远程)
- ✅ **已验证** (基于 scrcpy_web_test)
- ✅ **无后端依赖** (无需 PyAV)
- ⚠️ 需要 WebCodecs 支持（Chrome/Edge）
- ⚠️ 前端实现较复杂（需要处理 SPS/PPS/IDR 帧）

---

#### `video.stream.yuv` ⭐ 新增
YUV420P 推流（WebGL 优化，低延迟）

**说明**:
- 基于 QtScrcpy OpenGL 实现的 Web 版高效推流方案
- 后端 FFmpeg 解码 H.264 → YUV420P
- WebSocket 推送 YUV 数据
- 前端 WebGL 着色器渲染（GPU 加速）

**依赖**: 后端需要安装 PyAV
```bash
pip install av
```

**WebSocket 连接**: `ws://localhost:48000/video/yuv/{serial}`

**可选参数**:
- `hwaccel` (query parameter): 硬件加速类型
  - `cuda` - NVIDIA GPU
  - `qsv` - Intel Quick Sync Video
  - `dxva2` - DirectX Video Acceleration (Windows)
  - `vaapi` - Video Acceleration API (Linux)
  - 默认: 软件解码

**连接示例**:
```javascript
// 软件解码
const ws = new WebSocket('ws://localhost:48000/video/yuv/ABC123');

// 硬件加速 (NVIDIA CUDA)
const ws = new WebSocket('ws://localhost:48000/video/yuv/ABC123?hwaccel=cuda');
```

**初始化消息** (JSON):
```json
{
  "type": "video.init",
  "timestamp": 0,
  "data": {
    "serial": "ABC123",
    "codec": "yuv420p",
    "format": "yuv",
    "width": 1080,
    "height": 1920,
    "fps": 60,
    "hwaccel": "cuda"
  }
}
```

**YUV 帧协议** (Binary):
```
[Header]
    [serial_len (1 byte)]
    [serial (N bytes)]
    [pts (8 bytes)]           # Presentation timestamp
    [width (2 bytes)]         # Video width
    [height (2 bytes)]        # Video height
    [y_size (4 bytes)]        # Y plane size
    [u_size (4 bytes)]        # U plane size
    [v_size (4 bytes)]        # V plane size
[YUV Data]
    [Y plane (width * height bytes)]
    [U plane (width/2 * height/2 bytes)]
    [V plane (width/2 * height/2 bytes)]
```

**元数据消息** (每 60 帧):
```json
{
  "type": "video.metadata",
  "timestamp": 1000,
  "data": {
    "fps": 58.5,
    "frames": 3540,
    "bytes": 189000000,
    "mbps": 25.2,
    "format": "yuv420p"
  }
}
```

**前端实现** (WebGL):
```javascript
// 1. 创建 WebGL 渲染器
import { WebGLYUVRenderer } from '@/utils/WebGLYUVRenderer';

const canvas = document.getElementById('video-canvas');
const renderer = new WebGLYUVRenderer(canvas);

// 2. 连接 WebSocket
const ws = new WebSocket('ws://localhost:48000/video/yuv/ABC123');

// 3. 接收并渲染 YUV 帧
ws.onmessage = (event) => {
  if (event.data instanceof ArrayBuffer) {
    const data = new Uint8Array(event.data);

    // 解析协议头
    let offset = 0;
    const serialLen = data[offset++];
    const serial = new TextDecoder().decode(data.slice(offset, offset + serialLen));
    offset += serialLen;

    const view = new DataView(event.data);
    const pts = view.getBigUint64(offset); offset += 8;
    const width = view.getUint16(offset); offset += 2;
    const height = view.getUint16(offset); offset += 2;
    const ySize = view.getInt32(offset); offset += 4;
    const uSize = view.getInt32(offset); offset += 4;
    const vSize = view.getInt32(offset); offset += 4;

    // 提取 YUV 平面
    const yPlane = data.slice(offset, offset + ySize); offset += ySize;
    const uPlane = data.slice(offset, offset + uSize); offset += uSize;
    const vPlane = data.slice(offset, offset + vSize);

    // WebGL 渲染（GPU 加速 YUV→RGB 转换）
    renderer.renderFrame(yPlane, uPlane, vPlane, width, height);
  } else {
    // JSON 消息（初始化、元数据）
    const message = JSON.parse(event.data);
    console.log(message);
  }
};
```

**WebGL 渲染器** (完整实现参见 MATRIX_VS_QTSCRCPY_IMPLEMENTATION_COMPARISON.md):
- 基于 QtScrcpy `qyuvopenglwidget.cpp` 实现
- GLSL 着色器 YUV→RGB 转换（BT.709 色彩空间）
- GPU 加速渲染
- 零拷贝纹理上传

**特点**:
- ✅ 延迟更低 (~40-60ms vs ~50-100ms)
- ✅ 简化前端（只需 WebGL，无需 WebCodecs/MSE）
- ✅ 兼容性好（WebGL 支持所有现代浏览器）
- ✅ GPU 加速（着色器 YUV→RGB 转换）
- ✅ CPU 占用低（后端解码）
- ⚠️ 带宽需求大（~90 Mbps 原始 YUV，适合局域网）
- ⚠️ 需要安装 PyAV（`pip install av`）

**性能对比**:

| 方案 | 延迟 | 带宽 (1080p@30fps) | 前端复杂度 | 兼容性 |
|-----|------|-------------------|-----------|-------|
| H.264 | ~50-100ms | ~0.3-1.5 Mbps | 高 (WebCodecs/MSE) | ⚠️ 部分浏览器 |
| YUV | **~40-60ms** | ~90 Mbps | **低 (WebGL)** | **✅ 全支持** |

**推荐使用场景**:
- ✅ 局域网环境（带宽充足）
- ✅ 低延迟要求场景
- ✅ 需要广泛浏览器兼容
- ✅ 低端设备（前端解码负担重）

**不推荐场景**:
- ❌ 广域网/移动网络（带宽受限）
- ❌ 后端计算资源紧张

**自动检测和回退**:
```javascript
// 检测 WebGL 支持
function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    );
  } catch (e) {
    return false;
  }
}

// 根据支持情况选择推流方式
const streamType = supportsWebGL() ? 'yuv' : 'h264';
const wsUrl = streamType === 'yuv'
  ? `ws://localhost:48000/video/yuv/${serial}`
  : `ws://localhost:48000/video/${serial}`;
```

---

## 客户端实现示例

### JavaScript/TypeScript

```javascript
class MatrixRPCClient {
  constructor(url = 'ws://localhost:48000/rpc/ws') {
    this.url = url;
    this.ws = null;
    this.requestId = 0;
    this.callbacks = new Map();
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => resolve();
      this.ws.onerror = (error) => reject(error);
      this.ws.onmessage = (event) => this.handleMessage(event);
    });
  }

  request(route, data = {}) {
    return new Promise((resolve, reject) => {
      const id = `req-${++this.requestId}`;

      this.callbacks.set(id, { resolve, reject });

      this.ws.send(JSON.stringify({
        type: 'request',
        id,
        route,
        data,
        timestamp: Date.now()
      }));
    });
  }

  handleMessage(event) {
    const response = JSON.parse(event.data);
    const callback = this.callbacks.get(response.id);

    if (callback) {
      if (response.error) {
        callback.reject(response.error);
      } else {
        callback.resolve(response.data);
      }
      this.callbacks.delete(response.id);
    }
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// 使用示例
const client = new MatrixRPCClient();
await client.connect();

// 列出设备
const devices = await client.request('device.list');
console.log(devices);

// 连接设备
await client.request('device.connect', {
  serial: 'ABC123',
  max_size: 720,
  bit_rate: 8000000
});

// 截图
const screenshot = await client.request('screenshot.capture', {
  serial: 'ABC123',
  format: 'png'
});
```

---

## 错误代码

| 代码 | 描述 |
|------|------|
| `MISSING_SERIAL` | 缺少设备序列号 |
| `MISSING_GROUP_ID` | 缺少分组 ID |
| `MISSING_PARAMETERS` | 缺少必需参数 (groupId/hostSerial/slaveSerial) |
| `MISSING_DEVICE_NAME` | 缺少设备名称 |
| `MISSING_TASK_ID` | 缺少任务 ID |
| `MISSING_PACKAGE` | 缺少包名 |
| `MISSING_TREE` | 缺少树结构 |
| `MISSING_TEXT` | 缺少文本内容 |
| `MISSING_ACTION` | 缺少操作参数 |
| `MISSING_QUALITY_PARAMS` | 缺少质量参数 |
| `DEVICE_NOT_FOUND` | 设备未找到或离线 |
| `CONFIG_NOT_FOUND` | 配置未找到 |
| `TASK_NOT_FOUND` | 任务未找到 |
| `CONNECT_FAILED` | 连接设备失败 |
| `DISCONNECT_FAILED` | 断开设备失败 |
| `INVALID_ACTION` | 无效的操作参数 |
| `INVALID_LEVEL` | 无效的亮度级别 (必须 0-255) |
| `INVALID_ROTATION` | 无效的旋转值 (必须 0/90/180/270) |
| `INVALID_CONTROL_TYPE` | 无效的控制类型 |
| `POWER_CONTROL_FAILED` | 屏幕电源控制失败 |
| `BRIGHTNESS_FAILED` | 亮度控制失败 |
| `ROTATION_FAILED` | 旋转控制失败 |
| `TOUCH_FAILED` | 发送触摸事件失败 |
| `KEY_FAILED` | 发送按键事件失败 |
| `TEXT_FAILED` | 发送文本失败 |
| `SWIPE_FAILED` | 发送滑动失败 |
| `SYSTEMKEY_FAILED` | 发送系统按键失败 |
| `CLIPBOARD_SET_FAILED` | 设置剪贴板失败 |
| `START_RECORDING_FAILED` | 开始录屏失败 |
| `STOP_RECORDING_FAILED` | 停止录屏失败 |
| `SCREENSHOT_FAILED` | 截图失败 |
| `LIST_PACKAGES_FAILED` | 列出包失败 |
| `UNINSTALL_FAILED` | 卸载失败 |
| `CREATE_GROUP_FAILED` | 创建分组失败 |
| `ADD_SLAVE_FAILED` | 添加 slave 失败 |
| `REMOVE_SLAVE_FAILED` | 移除 slave 失败 |
| `ENABLE_SYNC_FAILED` | 启用同步失败 |
| `DISABLE_SYNC_FAILED` | 禁用同步失败 |
| `BATCH_*_FAILED` | 批量操作失败 |

---

## 迁移指南

### 从 HTTP REST API 迁移

**旧方式 (已移除):**
```javascript
// HTTP GET
const response = await fetch('http://localhost:48000/api/devices');
const data = await response.json();

// HTTP POST
const response = await fetch('http://localhost:48000/api/devices/ABC123/connect', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ max_size: 720 })
});
```

**新方式 (RPC v2 WebSocket):**
```javascript
const client = new MatrixRPCClient();
await client.connect();

// 列出设备
const devices = await client.request('device.list');

// 连接设备
await client.request('device.connect', {
  serial: 'ABC123',
  max_size: 720
});
```

### 从自定义 WebSocket 迁移

**旧方式 (已移除):**
```javascript
const ws = new WebSocket('ws://localhost:48000/ws');
ws.send(JSON.stringify({
  namespace: 'device',
  action: 'list'
}));
```

**新方式 (RPC v2):**
```javascript
const client = new MatrixRPCClient();
await client.connect();
const devices = await client.request('device.list');
```

---

**文档版本:** 2.3.0
**最后更新:** 2025-12-09
**维护者:** Matrix Team

**更新内容 (v2.3.0):**
- ✅ 新增 H.264 直传模式（基于 scrcpy_web_test 验证方案）
- ✅ 新增 YUV 解码模式（实验性，基于 QtScrcpy）
- ✅ 完整 WebCodecs H.264 解码前端实现示例
- ✅ 完整 WebGL YUV 渲染前端实现示例
- ✅ 双模式对比表和使用场景推荐
- ✅ 视频流协议详细说明（二进制格式）

**更新内容 (v2.1.0):**
- ✅ 新增 Host/Slave 输入同步功能（6个新端点）
- ✅ ControlService 集成 GroupController 实时广播
- ✅ 自动同步 touch/key/text/swipe 事件到 slave 设备
- ✅ 总端点数量：44 → 50
