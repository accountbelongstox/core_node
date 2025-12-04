# Matrix 群控后端 - 完整参考文档

> **文档版本**: v2.0
> **更新时间**: 2025-12-04
> **状态**: ✅ 已实现统一 WebSocket 架构
> **完成度**: 100%

---

## 📚 目录

1. [项目概述](#项目概述)
2. [快速开始](#快速开始)
3. [架构设计](#架构设计)
4. [统一 WebSocket 协议](#统一-websocket-协议)
5. [API 端点清单](#api-端点清单)
6. [代码结构](#代码结构)
7. [配置管理](#配置管理)
8. [性能指标](#性能指标)

---

## 项目概述

### 项目定位
**Android 设备群控系统后端** - 支持多台设备的远程镜像和批量控制

### 核心特性
- ✅ 设备管理：自动扫描、连接、配置
- ✅ 视频流推送：H.264 低延迟实时视频
- ✅ 设备控制：触摸、按键、文本输入、手势
- ✅ 屏幕管理：电源、亮度、旋转控制
- ✅ 文件传输：推送文件、安装/卸载 APK
- ✅ 录制截图：屏幕录制、截图保存
- ✅ 群组批量：批量操作、主从同步
- ✅ 配置管理：全局配置、设备级配置

### 技术栈
```
后端框架: FastAPI (RPC v2) + Uvicorn
设备通信: ADB + scrcpy
视频编码: H.264/H.265 硬件加速
传输协议: WebSocket (统一端点) + REST API (备用)
服务管理: pycore.pylauncher
```

---

## 快速开始

### 启动命令
```bash
# 方式1: 使用 pymain 启动
python pymain.py app=matrix

# 方式2: 直接启动
python pyapps/matrix/matrix_main.py
```

### 服务端口
- **HTTP API**: `http://localhost:8000`
- **统一 WebSocket**: `ws://localhost:8000/ws`
- **API 文档**: `http://localhost:8000/docs`

### 前端对接
前端项目位置: `poly_apps/matrix_ui_react`

---

## 架构设计

### 系统架构

```
┌─────────────────────────────────────────────┐
│              前端 (React)                    │
└──────────────────┬──────────────────────────┘
                   │ WebSocket (/ws)
┌──────────────────▼──────────────────────────┐
│          统一 WebSocket 路由                 │
│  9个命名空间 × 47个Actions = 完整功能        │
├──────────────────────────────────────────────┤
│  system  │ device  │ screen  │ control      │
│  video   │ file    │ recording │ group      │
│  config  │                                   │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│           业务服务层 (9 Services)            │
├──────────────────────────────────────────────┤
│  DeviceService | VideoStreamService         │
│  ControlService | ScreenService             │
│  RecordingService | FileService             │
│  GroupService | ConfigService               │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│      设备管理层 (ADB + scrcpy)               │
│  - ADB 设备扫描和连接                        │
│  - scrcpy 视频流和控制                       │
└──────────────────────────────────────────────┘
```

### 单一路由系统

```
pycore.pylauncher.launcher.py (统一启动器)
    ↓
launcher_builder.py (配置 RPC v2)
    ↓
pycore.pyutils.rpc_v2 (注册路由)
    ↓
unified_ws_router (/ws 统一端点)
    ↓
9 个命名空间 handlers
    ↓
9 个业务 services
```

**特点**:
- ✅ 只有一个路由系统 (RPC v2)
- ✅ 由 pylauncher 统一管理
- ✅ 单一 WebSocket 端点 `/ws`
- ✅ 命名空间隔离，清晰路由

---

## 统一 WebSocket 协议

### 设计理念

**从**: REST + 多个 WebSocket
**到**: 单一 WebSocket + 命名空间路由

**优势**:
1. ✅ 单一连接 - 前端只需一个 WebSocket
2. ✅ 双向通信 - 服务端可主动推送
3. ✅ 命名空间 - 清晰的消息路由
4. ✅ 请求/响应匹配 - 异步请求-响应模式
5. ✅ 订阅/发布 - 事件订阅机制

### WebSocket 端点

**统一端点**: `ws://localhost:8000/ws`

### 消息格式

#### 标准消息结构
```json
{
  "id": "req-001",              // 请求ID (用于匹配响应)
  "type": "request",            // 消息类型
  "namespace": "device",        // 命名空间
  "action": "list",             // 操作
  "data": {...},                // 数据
  "timestamp": 1733200000000    // 时间戳 (毫秒)
}
```

#### 消息类型
- **request**: 请求操作
- **response**: 响应结果
- **event**: 服务端推送事件
- **subscribe**: 订阅事件
- **unsubscribe**: 取消订阅
- **error**: 错误响应

### 9 个命名空间

| 命名空间 | 功能 | Actions 数量 |
|---------|------|-------------|
| **system** | 系统健康检查和信息 | 3 |
| **device** | 设备管理 | 5 |
| **screen** | 屏幕控制 | 7 |
| **file** | 文件操作 | 5 |
| **recording** | 录制截图 | 4 |
| **group** | 群组批量操作 | 7 |
| **config** | 配置管理 | 6 |
| **control** | 设备控制 | 7 |
| **video** | 视频流控制 | 3 |
| **总计** | | **47** |

### 使用示例

#### 1. 列出设备
```javascript
ws.send(JSON.stringify({
  id: 'req-001',
  type: 'request',
  namespace: 'device',
  action: 'list',
  data: {}
}));

// 响应:
{
  id: 'req-001',
  type: 'response',
  namespace: 'device',
  action: 'list',
  data: {
    devices: [...],
    count: 3
  },
  timestamp: 1733200001000
}
```

#### 2. 订阅视频流
```javascript
ws.send(JSON.stringify({
  id: 'sub-001',
  type: 'subscribe',
  namespace: 'video',
  action: 'stream',
  data: { serial: 'ABC123' }
}));

// 响应:
{
  id: 'sub-001',
  type: 'response',
  namespace: 'video',
  action: 'stream',
  data: {
    success: true,
    subscribed: true,
    serial: 'ABC123',
    codec: 'h264',
    width: 1080,
    height: 2400
  }
}

// 之后会收到二进制视频帧 (H.264)
```

#### 3. 发送触摸事件
```javascript
ws.send(JSON.stringify({
  id: 'req-002',
  type: 'request',
  namespace: 'control',
  action: 'touch',
  data: {
    serial: 'ABC123',
    action: 'down',
    x: 540,
    y: 1200,
    pointerId: 0,
    pressure: 1.0,
    screenWidth: 1080,
    screenHeight: 2400
  }
}));
```

#### 4. 批量截图
```javascript
ws.send(JSON.stringify({
  id: 'req-003',
  type: 'request',
  namespace: 'group',
  action: 'batch_screenshot',
  data: {
    groupId: 'group-01',
    format: 'png'
  }
}));
```

### 视频流协议

**二进制帧格式**:
```
[serial_len (1 byte)]
[serial (N bytes, UTF-8)]
[pts (8 bytes, big-endian)]
[size (4 bytes, big-endian)]
[H.264 NAL units]
```

**PTS 标志位**:
- Bit 63 (0x8000000000000000): `is_config` (SPS/PPS)
- Bit 62 (0x4000000000000000): `is_keyframe` (IDR)
- Bits 0-61: 时间戳 (纳秒)

---

## API 端点清单

### 统计总览

| 模块 | HTTP 端点 | WebSocket Actions | 总计 |
|------|-----------|-------------------|------|
| **健康检查** | 3 | 3 | 6 |
| **设备管理** | 5 | 5 | 10 |
| **屏幕控制** | 7 | 7 | 14 |
| **文件管理** | 5 | 5 | 10 |
| **录制截图** | 4 | 4 | 8 |
| **群控操作** | 7 | 7 | 14 |
| **配置管理** | 6 | 6 | 12 |
| **设备控制** | 0 | 7 | 7 |
| **视频流** | 0 | 3 | 3 |
| **总计** | **37** | **47** | **84** |

### 1. System 命名空间 (3 actions)

| Action | 功能 | 数据 |
|--------|------|------|
| `health` | 基础健康检查 | - |
| `health_detailed` | 详细健康检查 (含系统资源) | - |
| `info` | API 信息和版本 | - |

### 2. Device 命名空间 (5 actions)

| Action | 功能 | 数据 |
|--------|------|------|
| `list` | 列出所有设备 | - |
| `get` | 获取设备详情 | `{serial}` |
| `connect` | 连接设备 | `{serial, max_size, bit_rate, max_fps, ...}` |
| `disconnect` | 断开设备 | `{serial}` |
| `batch_configure` | 批量配置设备 | `{devices: [...]}` |

### 3. Screen 命名空间 (7 actions)

| Action | 功能 | 数据 |
|--------|------|------|
| `power` | 电源控制 | `{serial, action: "on"/"off"/"toggle"}` |
| `set_brightness` | 设置亮度 | `{serial, level: 0-255}` |
| `get_brightness` | 获取亮度 | `{serial}` |
| `set_rotation` | 设置旋转 | `{serial, rotation: 0/90/180/270}` |
| `get_rotation` | 获取旋转 | `{serial}` |
| `enable_auto_rotation` | 启用自动旋转 | `{serial}` |
| `disable_auto_rotation` | 禁用自动旋转 | `{serial}` |

### 4. File 命名空间 (5 actions)

| Action | 功能 | 数据 |
|--------|------|------|
| `push` | 推送文件 | `{serial, localPath, remotePath}` |
| `install_apk` | 安装 APK | `{serial, apkPath, reinstall}` |
| `uninstall_apk` | 卸载应用 | `{serial, packageName}` |
| `list_packages` | 列出已安装包 | `{serial, filter?}` |
| `get_transfer_status` | 获取传输状态 | `{taskId}` |

### 5. Recording 命名空间 (4 actions)

| Action | 功能 | 数据 |
|--------|------|------|
| `start` | 开始录制 | `{serial, quality, maxDuration}` |
| `stop` | 停止录制 | `{serial}` |
| `get_status` | 录制状态 | `{serial}` |
| `screenshot` | 截图 | `{serial, format}` |

### 6. Group 命名空间 (7 actions)

| Action | 功能 | 数据 |
|--------|------|------|
| `batch_screenshot` | 批量截图 | `{groupId, format}` |
| `batch_start_recording` | 批量开始录制 | `{groupId, quality, maxDuration}` |
| `batch_stop_recording` | 批量停止录制 | `{groupId}` |
| `batch_systemkey` | 批量系统按键 | `{groupId, action}` |
| `batch_screen_control` | 批量屏幕控制 | `{groupId, controlType, params}` |
| `get_tree` | 获取群组树 | - |
| `update_tree` | 更新群组树 | `{tree}` |

### 7. Config 命名空间 (6 actions)

| Action | 功能 | 数据 |
|--------|------|------|
| `get_full` | 完整配置 | - |
| `get_global` | 全局配置 | - |
| `update_global` | 更新全局配置 | `{max_size, bit_rate, ...}` |
| `get_device` | 设备配置 | `{deviceName}` |
| `update_device` | 更新设备配置 | `{deviceName, ...}` |
| `delete_device` | 删除设备配置 | `{deviceName}` |

### 8. Control 命名空间 (7 actions)

| Action | 功能 | 数据 |
|--------|------|------|
| `touch` | 触摸事件 | `{serial, action, x, y, ...}` |
| `key` | 按键事件 | `{serial, action, keyCode, ...}` |
| `text` | 文本输入 | `{serial, text}` |
| `swipe` | 滑动手势 | `{serial, startX, startY, endX, endY, ...}` |
| `systemkey` | 系统按键 | `{serial, action}` |
| `clipboard_set` | 设置剪贴板 | `{serial, text}` |
| `clipboard_get` | 获取剪贴板 | `{serial}` |

### 9. Video 命名空间 (3 actions)

| Action | 功能 | 数据 |
|--------|------|------|
| `quality` | 调整视频质量 | `{serial, max_size?, bit_rate?, max_fps?}` |
| `pause` | 暂停视频流 | `{serial}` |
| `resume` | 恢复视频流 | `{serial}` |

**注**: 视频流通过 `subscribe` 订阅，使用 `video.stream` action

---

## 代码结构

### 目录组织
```
pyapps/matrix/
├── matrix_main.py                      # ✅ 唯一入口
├── matrix_config/                      # ✅ 配置管理
│   └── config.py
├── controller/                         # ✅ 控制器
│   ├── launcher_builder.py            # 构建 LauncherConfig
│   ├── frontend_compiler.py           # 前端编译
│   └── event_handlers.py              # 事件处理
├── api/                                # ✅ API 路由
│   ├── unified_ws.py                  # ⭐ 统一 WebSocket 端点
│   ├── unified_ws_handlers/           # ⭐ 命名空间处理器
│   │   ├── __init__.py
│   │   ├── base_handler.py           # 基类和注册表
│   │   ├── system_handler.py
│   │   ├── device_handler.py
│   │   ├── screen_handler.py
│   │   ├── file_handler.py
│   │   ├── recording_handler.py
│   │   ├── group_handler.py
│   │   ├── config_handler.py
│   │   ├── control_handler.py
│   │   └── video_handler.py
│   ├── health_routes.py               # REST 健康检查
│   ├── device_routes.py               # REST 设备管理
│   ├── screen_routes.py               # REST 屏幕控制
│   ├── file_routes.py                 # REST 文件管理
│   ├── recording_routes.py            # REST 录制截图
│   ├── group_routes.py                # REST 群控操作
│   ├── config_routes.py               # REST 配置管理
│   └── ws_routes.py                   # (废弃) 旧 WebSocket 端点
└── services/                           # ✅ 服务层
    ├── device_service.py
    ├── control_service.py
    ├── screen_service.py
    ├── file_service.py
    ├── recording_service.py
    ├── group_service.py
    ├── config_service.py
    ├── video_stream_service.py
    └── logging_service.py
```

### 关键文件说明

#### unified_ws.py (384 lines)
统一 WebSocket 端点，路由所有消息到对应的命名空间处理器

**核心功能**:
- 客户端连接管理
- 消息路由 (request/subscribe/unsubscribe)
- 命名空间处理器注册
- 视频流订阅管理
- 错误处理和清理

#### base_handler.py
抽象基类和命名空间注册表

**BaseHandler**:
```python
class BaseHandler(ABC):
    def __init__(self):
        self.actions: Dict[str, Callable] = {}
        self._register_actions()

    @abstractmethod
    def _register_actions(self):
        pass

    async def handle(self, action, data, websocket) -> Dict:
        # 执行 action 并返回结果
```

**HandlerRegistry**:
```python
class HandlerRegistry:
    def __init__(self):
        self.handlers: Dict[str, BaseHandler] = {}

    def register(self, namespace: str, handler: BaseHandler):
        self.handlers[namespace] = handler
```

#### launcher_builder.py
构建 LauncherConfig，注册所有路由到 RPC v2

```python
'rpc_v2': {
    'port': backend_port,
    'host': backend_host,
    'debug': True,
    'fastapi_routers': [
        health_router,
        device_router,
        screen_router,
        file_router,
        recording_router,
        group_router,
        config_router,
        unified_ws_router  # ⭐ 统一 WebSocket
    ],
    'static_mounts': static_mounts
}
```

---

## 配置管理

### 配置文件
**位置**: `pyapps/matrix/matrix_config/config.py`

### 配置项

#### Web 服务
```python
WEB_HOST = "0.0.0.0"
WEB_PORT = 8000
```

#### 前端配置
```python
FRONTEND_DIR = PROJECT_ROOT / "poly_apps" / "matrix_ui_react"
FRONTEND_PORT = 3000
FRONTEND_MODE = "production"  # dev | production
```

#### 视频流默认参数
```python
DEFAULT_MAX_SIZE = 720          # 分辨率 (120-4320)
DEFAULT_BIT_RATE = 8000000      # 比特率 (100000-20000000)
DEFAULT_MAX_FPS = 60            # 帧率 (1-120)
DEFAULT_CODEC = "h264"          # 编码 (h264/h265/av1)
```

### 配置优先级
1. 设备级配置 (最高)
2. 全局配置
3. 默认配置 (最低)

---

## 性能指标

### 视频流性能
- **延迟**: 100-300ms (局域网)
- **编码**: H.264/H.265 硬件加速
- **分辨率**: 120p - 4K 可配置
- **帧率**: 1-120 FPS 可配置
- **比特率**: 100kbps - 20Mbps 可配置

### 并发支持
- **理论上限**: 100 台设备
- **推荐配置**: 20-50 台设备/实例
- **WebSocket 连接**: 连接池管理

### API 性能
- **响应时间**: < 100ms (设备操作)
- **控制延迟**: < 50ms (触摸/按键)
- **视频流延迟**: 100-300ms (局域网)

---

## 架构优势

### 技术优势
1. ✅ **统一 WebSocket** - 单一连接，降低开销
2. ✅ **命名空间隔离** - 清晰的功能边界
3. ✅ **RPC v2 统一后端** - 无重复代码
4. ✅ **pylauncher 管理** - 统一服务生命周期
5. ✅ **清晰分层** - Handler/Service 职责明确

### 功能完整性
- ✅ **47 个 WebSocket Actions** - 覆盖所有业务需求
- ✅ **37 个 REST 端点** - 备用访问方式
- ✅ **9 个命名空间** - 完整功能模块
- ✅ **双向通信** - 服务端可主动推送

### 可维护性
- ✅ **代码规范** - 遵循 pycore 开发标准
- ✅ **易于扩展** - 添加新 action 只需实现 handler 方法
- ✅ **文档完整** - 协议、API、架构文档齐全
- ✅ **统一入口** - 单一配置，易于管理

---

## 相关文档

### 核心文档
- **[BACKEND_API_SPECIFICATION.md](./docs/BACKEND_API_SPECIFICATION.md)** - REST API 详细规范
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - 系统架构设计

### 开发文档
- **[matrix_config/config.py](./matrix_config/config.py)** - 配置文件
- **[api/unified_ws.py](./api/unified_ws.py)** - 统一 WebSocket 实现

---

## 总结

Matrix 群控后端已完成统一 WebSocket 架构升级，提供：

- ✅ **单一 WebSocket 端点**: `ws://localhost:8000/ws`
- ✅ **9 个命名空间**: 完整功能覆盖
- ✅ **47 个 Actions**: 所有业务操作
- ✅ **双向通信**: 请求/响应 + 订阅/发布
- ✅ **高性能**: 低延迟视频流 + 快速控制响应
- ✅ **易于使用**: 清晰的协议 + 完整的文档

**可直接对接前端开发**。

---

**文档维护**: 本文档为统一参考文档，合并了以下文档内容：
- UNIFIED_WEBSOCKET_DESIGN.md (设计方案)
- BACKEND_SUMMARY.md (功能总结)
- ENDPOINT_VERIFICATION_REPORT.md (端点验证)
- MISSING_ENDPOINTS_REPORT.md (缺失分析)

**更新日期**: 2025-12-04
