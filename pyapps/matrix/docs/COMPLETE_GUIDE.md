# Matrix 完整指南

> **版本**: v1.0
> **更新**: 2025-12-04
> **状态**: ✅ 生产就绪

---

## 📑 目录

1. [快速开始](#快速开始)
2. [系统架构](#系统架构)
3. [初始化配置](#初始化配置)
4. [前端配置](#前端配置)
5. [文件结构](#文件结构)
6. [常见问题](#常见问题)

---

## 快速开始

### 1. 初始化依赖

首次使用前，运行初始化脚本下载所需依赖：

```bash
# 下载所有依赖 (ADB + scrcpy-server)
python pyapps/matrix/init.py

# 或强制重新下载
python pyapps/matrix/init.py --force
```

### 2. 启动应用

```bash
# 使用 pymain 启动（推荐）
python pymain.py app=matrix

# 或直接启动
python pyapps/matrix/matrix_main.py
```

### 3. 访问服务

- **Webview UI**: 自动打开
- **HTTP API**: http://localhost:8000
- **WebSocket**: ws://localhost:8000/ws
- **API 文档**: http://localhost:8000/docs

---

## 系统架构

### 核心原则

1. **单一 RPC v2 服务** - 所有后端 API 通过共享的 RPC v2 服务处理
2. **无重复定义** - 不创建独立的 FastAPI app，复用 pycore 基础设施
3. **pylauncher 管理** - 所有服务通过 pylauncher 统一管理
4. **配置驱动** - 通过配置注入 routers 和 static mounts

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
│                     │  - unified_ws_router   │ │
│                     └────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### 数据流

```
User Request
    ↓
PySide6 Webview (UI service)
    ↓
Frontend (Nuxt.js, served by RPC v2)
    ↓
FastAPI Routers (registered to RPC v2)
    ↓
Service Layer
    ↓
ADB / scrcpy-server
```

### 技术栈

- **后端框架**: FastAPI (RPC v2) + Uvicorn
- **设备通信**: ADB + scrcpy v3.3.3
- **视频编码**: H.264/H.265
- **传输协议**: WebSocket (统一端点) + REST API
- **启动器**: pycore.pylauncher
- **UI框架**: PySide6 (Webview)

---

## 初始化配置

### 依赖组件

Matrix 依赖以下组件：

| 组件 | 版本 | 位置 | 用途 |
|------|------|------|------|
| **scrcpy-server** | v3.3.3 | `resources/scrcpy-server.jar` | Android 屏幕镜像服务 |
| **ADB** | v36.0.0 | `resources/adb/{platform}/` | Android 设备通信 |

### 自动下载

`init.py` 脚本会自动：

1. **下载 scrcpy-server v3.3.3**
   - 来源: GitHub Releases
   - URL: https://github.com/Genymobile/scrcpy/releases/download/v3.3.3/scrcpy-server-v3.3.3
   - 大小: ~72 KB

2. **下载 ADB Platform Tools v36.0.0**
   - 来源: Google Android Developer Tools
   - 平台特定文件:
     - Windows: `adb.exe`, `AdbWinApi.dll`, `AdbWinUsbApi.dll`
     - Linux/macOS: `adb` (可执行文件)

3. **SHA256 校验**
   - 自动验证下载文件完整性
   - 校验失败自动重试

### 初始化选项

```bash
# 下载所有依赖
python pyapps/matrix/init.py

# 强制重新下载
python pyapps/matrix/init.py --force

# 只下载 ADB
python pyapps/matrix/init.py --adb-only

# 只下载 scrcpy-server
python pyapps/matrix/init.py --server-only
```

### 验证安装

```bash
python pyapps/matrix/test_init.py
```

预期输出：
```
[PASS] Configuration test passed
[PASS] All versions consistent: 3.3.3
[PASS] All tests passed!
```

### 离线安装

1. 在有网络的机器上下载依赖
2. 复制 `resources/` 目录到目标机器
3. 运行验证: `python pyapps/matrix/test_init.py`

---

## 前端配置

### 配置位置

所有配置在 `pyapps/matrix/matrix_config/config.py`

### 核心配置参数

#### 1. FRONTEND_MODE

**类型**: `str`
**可选值**: `"dev"` | `"production"`
**默认值**: `"production"`

- **production** (推荐) - 生产模式
  - 编译 Nuxt 项目到 `.output`
  - 后端 serve 静态文件
  - 统一端口 (8000)
  - 启动速度快

- **dev** - 开发模式
  - 启动 Nuxt 开发服务器
  - 热重载，实时编译
  - 独立端口 (38007)
  - 适合前端开发

#### 2. FRONTEND_SKIP_BUILD

**类型**: `bool`
**默认值**: `True`

控制是否跳过编译（仅 production 模式）：

- `True` - 使用已存在的 `.output`，启动极快 (~5秒)
- `False` - 每次启动重新编译 (~2-5分钟)

#### 3. FRONTEND_FORCE_REBUILD

**类型**: `bool`
**默认值**: `False`

控制是否强制重新编译：

- `False` - 正常行为（`.output` 存在则跳过）
- `True` - 强制重新编译（确保完全重新构建）

### 使用场景

#### 场景1: 日常使用（最快启动）
```python
FRONTEND_MODE = "production"
FRONTEND_SKIP_BUILD = True
FRONTEND_FORCE_REBUILD = False
```

#### 场景2: 前端代码更新后
```python
FRONTEND_MODE = "production"
FRONTEND_SKIP_BUILD = False
FRONTEND_FORCE_REBUILD = False
```

#### 场景3: 前端开发调试
```python
FRONTEND_MODE = "dev"
```

#### 场景4: 完全重新构建
```python
FRONTEND_MODE = "production"
FRONTEND_SKIP_BUILD = False
FRONTEND_FORCE_REBUILD = True
```

### 端口架构

#### Production 模式（统一端口）
```
┌─────────────────────────────────────┐
│ Backend (FastAPI) - Port 8000      │
│ ├─ /api/*  → API 路由              │
│ ├─ /ws     → WebSocket             │
│ └─ /*      → 静态文件 (.output)     │
└─────────────────────────────────────┘
          ↑
┌─────────────────────────────────────┐
│ PySide6 Webview                     │
│ 加载: http://localhost:8000         │
└─────────────────────────────────────┘
```

#### Dev 模式（独立端口）
```
┌─────────────────────────────────────┐
│ Frontend (Nuxt Dev) - Port 38007   │
│ 热重载、实时编译                      │
└─────────────────────────────────────┘
          ↑ HTTP 调用
┌─────────────────────────────────────┐
│ Backend (FastAPI) - Port 8000      │
│ API 路由 + WebSocket                │
└─────────────────────────────────────┘
          ↑
┌─────────────────────────────────────┐
│ PySide6 Webview                     │
│ 加载: http://localhost:38007        │
└─────────────────────────────────────┘
```

---

## 文件结构

### 项目根目录

```
pyapps/matrix/
├── matrix_main.py              # 主入口点（唯一入口）
├── init.py                     # 初始化脚本（依赖下载）
├── _path_setup.py              # 路径设置
│
├── matrix_config/              # 配置目录
│   ├── __init__.py
│   └── config.py               # 统一配置文件
│
├── resources/                  # 资源目录
│   ├── icon.ico               # 应用图标
│   ├── logo.png               # 应用 Logo
│   ├── scrcpy-server.jar      # scrcpy 服务端
│   └── adb/                   # ADB 工具
│       ├── windows/
│       ├── linux/
│       └── macos/
│
├── controller/                 # 控制器目录
│   ├── __init__.py
│   ├── launcher_builder.py    # 构建 LauncherConfig
│   ├── frontend_compiler.py   # 前端编译逻辑
│   └── event_handlers.py      # THREAD_BUS 事件处理
│
├── api/                        # API 路由目录
│   ├── __init__.py
│   ├── health_routes.py       # 健康检查
│   ├── device_routes.py       # 设备管理
│   ├── screen_routes.py       # 屏幕控制
│   ├── file_routes.py         # 文件管理
│   ├── recording_routes.py    # 录制截图
│   ├── group_routes.py        # 群控批量
│   ├── config_routes.py       # 配置管理
│   └── unified_ws.py          # 统一 WebSocket 端点
│       └── unified_ws_handlers/  # WebSocket 处理器
│           ├── base_handler.py
│           ├── system_handler.py
│           ├── device_handler.py
│           ├── screen_handler.py
│           ├── file_handler.py
│           ├── recording_handler.py
│           ├── group_handler.py
│           ├── config_handler.py
│           ├── control_handler.py
│           └── video_handler.py
│
├── services/                   # 业务逻辑层
│   ├── __init__.py
│   ├── adb_manager.py         # ADB 管理器
│   ├── device_service.py      # 设备服务
│   ├── screen_service.py      # 屏幕服务
│   ├── video_stream_service.py # 视频流服务
│   ├── control_service.py     # 控制服务
│   ├── file_service.py        # 文件服务
│   ├── recording_service.py   # 录制服务
│   ├── group_service.py       # 群组服务
│   ├── config_service.py      # 配置服务
│   └── logging_service.py     # 日志服务
│
├── middleware/                 # 中间件
│   ├── __init__.py
│   └── logging_middleware.py
│
└── docs/                       # 文档目录
    ├── COMPLETE_GUIDE.md       # ⭐ 本文档（完整指南）
    ├── BACKEND_REFERENCE.md    # 后端参考（WebSocket 协议）
    ├── BACKEND_API_SPECIFICATION.md  # API 详细规范
    ├── C++_REFERENCE.md        # C++ 版本参考
    └── archive/                # 归档文档
```

### 关键文件说明

#### matrix_main.py
- 唯一入口点
- 负责：前端编译、配置构建、launcher 启动、事件注册

#### matrix_config/config.py
- 集中配置管理
- 所有配置参数统一管理

#### controller/launcher_builder.py
- 构建 LauncherConfig
- 注入 routers 到 RPC v2
- 配置 UI 和 Tray

#### controller/frontend_compiler.py
- 管理前端编译
- 使用 `pycore.pyutils.frontend_launcher`

#### controller/event_handlers.py
- 注册 THREAD_BUS 事件处理器
- 处理 tray 菜单动作

#### api/*.py
- FastAPI router 定义
- 业务 API endpoints

#### api/unified_ws.py
- 统一 WebSocket 端点 `/ws`
- 命名空间路由到对应处理器
- 9个命名空间 × 47个 Actions

---

## 常见问题

### Q1: 启动卡在"等待前端初始化"

**原因**: 前端编译失败或启动失败

**解决**:
1. 检查编译输出（显示在 startup window）
2. 手动运行编译: `python poly_apps/nuxt_main/scripts/start_production.py pymatrix 38007`

### Q2: 页面显示 404

**原因**: Production 模式下 `.output` 不存在

**解决**:
1. 设置 `FRONTEND_SKIP_BUILD = False`
2. 重新启动应用

### Q3: 前端代码修改不生效

**原因**: Production 模式使用的是编译后的代码

**解决**:
- 方案A: 切换到 dev 模式 (`FRONTEND_MODE = "dev"`)
- 方案B: 重新编译 (`FRONTEND_SKIP_BUILD = False`)

### Q4: 设备连接失败

**原因**: ADB 未找到或设备未授权

**解决**:
1. 运行初始化: `python pyapps/matrix/init.py --adb-only`
2. 启用 USB 调试
3. 授权计算机连接
4. 运行 `adb devices` 验证

### Q5: 视频流黑屏或花屏

**原因**: scrcpy-server 版本不匹配

**解决**:
1. 强制重新下载: `python pyapps/matrix/init.py --server-only --force`
2. 验证版本: `python pyapps/matrix/test_init.py`

### Q6: WebSocket 连接失败

**原因**: 使用了旧的分离式端点

**解决**:
- 使用新的统一端点: `ws://localhost:8000/ws`
- 参考 `BACKEND_REFERENCE.md` 查看协议规范

### Q7: 依赖下载失败

**原因**: 网络问题或校验失败

**解决**:
1. 检查网络连接
2. 使用 VPN/代理
3. 手动下载后放入 `resources/` 目录

---

## 参考文档

- **[BACKEND_REFERENCE.md](./BACKEND_REFERENCE.md)** - 统一 WebSocket 协议规范
- **[BACKEND_API_SPECIFICATION.md](./BACKEND_API_SPECIFICATION.md)** - 详细 API 规范
- **[C++_REFERENCE.md](./C++_REFERENCE.md)** - C++ 版本参考

## 外部资源

- **scrcpy 官方**: https://github.com/Genymobile/scrcpy
- **ADB 下载**: https://developer.android.com/studio/releases/platform-tools
- **pycore 文档**: `development-guides/PYTHON_PYCORE.md`

---

**文档维护**: 本文档包含 Matrix 项目的完整设置、配置和架构信息。如有更新，请同步修改本文档。
