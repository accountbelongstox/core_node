# Matrix API Documentation

**Version:** 2.0.0
**Protocol:** RPC v2 WebSocket
**Endpoint:** `ws://localhost:48000/rpc/ws`

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
- ✅ **44 个端点** - 覆盖设备管理、屏幕控制、文件管理、录制、分组、配置、控制、视频流

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

**总计：44 个端点**

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

### 6. Group Batch Operations (7)
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
- `control.touch` - 触摸事件
- `control.key` - 按键事件
- `control.text` - 文本输入
- `control.swipe` - 滑动手势
- `control.systemkey` - 系统按键
- `control.clipboard_set` - 设置剪贴板
- `control.clipboard_get` - 获取剪贴板

### 9. Video Stream (3)
- `video.quality` - 调整视频质量
- `video.pause` - 暂停视频流
- `video.resume` - 恢复视频流

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

### 6. Group Batch Operations

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

#### `config.full`
获取完整配置

#### `config.global`
获取全局配置

#### `config.global_update`
更新全局配置

**请求参数:**
- 配置对象（动态参数）

#### `config.device`
获取设备特定配置

**请求参数:**
- `deviceName` (string, 必需) - 设备名称

#### `config.device_update`
更新设备特定配置

**请求参数:**
- `deviceName` (string, 必需) - 设备名称
- `config` (object, 必需) - 配置对象

#### `config.device_delete`
删除设备特定配置

**请求参数:**
- `deviceName` (string, 必需) - 设备名称

---

### 8. Device Control

#### `control.touch`
发送触摸事件

**请求参数:**
- `serial` (string, 必需) - 设备序列号
- `action` (string, 必需) - 动作 (down/up/move)
- `pointerId` (int, 可选, 默认: 0) - 指针 ID
- `x` (int, 必需) - X 坐标
- `y` (int, 必需) - Y 坐标
- `pressure` (float, 可选, 默认: 1.0) - 压力
- `screenWidth` (int, 必需) - 屏幕宽度
- `screenHeight` (int, 必需) - 屏幕高度

#### `control.key`
发送按键事件

**请求参数:**
- `serial` (string, 必需) - 设备序列号
- `action` (string, 必需) - 动作 (down/up)
- `keyCode` (int, 必需) - 按键码
- `metaState` (int, 可选, 默认: 0) - Meta 状态

#### `control.text`
发送文本输入

**请求参数:**
- `serial` (string, 必需) - 设备序列号
- `text` (string, 必需) - 文本内容

#### `control.swipe`
发送滑动手势

**请求参数:**
- `serial` (string, 必需) - 设备序列号
- `startX` (int, 必需) - 起始 X 坐标
- `startY` (int, 必需) - 起始 Y 坐标
- `endX` (int, 必需) - 结束 X 坐标
- `endY` (int, 必需) - 结束 Y 坐标
- `duration` (int, 可选, 默认: 300) - 持续时间（毫秒）
- `screenWidth` (int, 必需) - 屏幕宽度
- `screenHeight` (int, 必需) - 屏幕高度

#### `control.systemkey`
发送系统按键

**请求参数:**
- `serial` (string, 必需) - 设备序列号
- `action` (string, 必需) - 操作 (home/back/recent/power/volume_up/volume_down)

#### `control.clipboard_set`
设置设备剪贴板

**请求参数:**
- `serial` (string, 必需) - 设备序列号
- `text` (string, 必需) - 剪贴板文本

#### `control.clipboard_get`
获取设备剪贴板

**请求参数:**
- `serial` (string, 必需) - 设备序列号

---

### 9. Video Stream

#### `video.quality`
调整视频流质量

**请求参数:**
- `serial` (string, 必需) - 设备序列号
- `max_size` (int, 可选) - 最大分辨率
- `bit_rate` (int, 可选) - 比特率
- `max_fps` (int, 可选) - 最大帧率

#### `video.pause`
暂停视频流

**请求参数:**
- `serial` (string, 必需) - 设备序列号

#### `video.resume`
恢复视频流

**请求参数:**
- `serial` (string, 必需) - 设备序列号

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

**文档版本:** 2.0.0
**最后更新:** 2025-12-08
**维护者:** Matrix Team
