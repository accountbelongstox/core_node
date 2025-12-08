# Matrix 应用完整启动流程

## 📋 概述

本文档详细追踪 `python .\pymain.py app=matrix` 的完整启动流程，包括前端编译、服务启动顺序、以及各组件的初始化过程。

**追踪日期**: 2025-12-07
**入口命令**: `python .\pymain.py app=matrix`

---

## 🔍 完整启动流程图

```
┌─────────────────────────────────────────────────────────────┐
│  python .\pymain.py app=matrix                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  pymain.py (入口文件)                                        │
│  ├─ 解析参数: app=matrix                                    │
│  └─ 调用: AppLauncher.start(app_name='matrix')              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  pycore/pyfoundations/app_launcher.py                       │
│  ├─ AppLauncher.start()                                     │
│  ├─ 查找: pyapps/matrix/matrix_main.py                     │
│  ├─ 动态导入: matrix_main 模块                             │
│  └─ 调用: matrix_main.start()                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  pyapps/matrix/matrix_main.py                               │
│  ╔═══════════════════════════════════════════════════════╗ │
│  ║ Step 1: 前端编译（Production 模式）                   ║ │
│  ╚═══════════════════════════════════════════════════════╝ │
│  ├─ 检查: Config.FRONTEND_MODE == 'production'              │
│  ├─ 调用: compile_frontend_if_needed()                      │
│  │   ↓                                                       │
│  │   pyapps/matrix/controller/frontend_compiler.py          │
│  │   ├─ 创建 FrontendConfig (Nuxt)                          │
│  │   ├─ 创建 NuxtLauncher                                   │
│  │   ├─ 检查: static_dir 是否存在                           │
│  │   ├─ 决定: 是否需要构建                                 │
│  │   └─ launcher.prepare_build() → 执行 npm run build      │
│  │                                                           │
│  ╔═══════════════════════════════════════════════════════╗ │
│  ║ Step 2: 构建启动配置                                  ║ │
│  ╚═══════════════════════════════════════════════════════╝ │
│  ├─ 调用: build_matrix_launcher_config()                    │
│  │   ↓                                                       │
│  │   pyapps/matrix/controller/launcher_builder.py           │
│  │   ├─ 确定 webview_url                                    │
│  │   │   Production: http://localhost:8000 (统一端口)       │
│  │   │   Dev: http://localhost:3000 (需手动启动)            │
│  │   ├─ 加载 i18n 翻译                                      │
│  │   ├─ 导入 Matrix API routers                             │
│  │   ├─ 获取静态文件挂载配置 (Production)                   │
│  │   │   └─ 创建 NuxtLauncher → 获取 static_dir            │
│  │   └─ 构建 LauncherConfig:                                │
│  │       services = {                                        │
│  │         'heartbeat': {},                                  │
│  │         'rpc_v2': {                                       │
│  │           fastapi_routers: [Matrix APIs],                │
│  │           static_mounts: [{ '/' → dist/ }]               │
│  │         },                                                │
│  │         'ui': { webview_url: ... },                      │
│  │         'tray': { menu_items: ... }                      │
│  │       }                                                   │
│  │                                                           │
│  ╔═══════════════════════════════════════════════════════╗ │
│  ║ Step 3: 启动服务                                      ║ │
│  ╚═══════════════════════════════════════════════════════╝ │
│  ├─ 创建: ServiceLauncher(launcher_config)                  │
│  └─ 调用: launcher.start()                                  │
│      ↓                                                       │
│      pycore/pylauncher/launcher.py                          │
│      └─ ServiceLauncher.start()                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  pycore/pylauncher/launcher.py                              │
│  ╔═══════════════════════════════════════════════════════╗ │
│  ║ ServiceLauncher.start() - 服务启动主流程             ║ │
│  ╚═══════════════════════════════════════════════════════╝ │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 阶段 1: 单例检测（如果启用）                        │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ if config.singleton:                                 │   │
│  │   SingletonDetector.detect_and_bind()               │   │
│  │   ├─ 扫描端口范围: 54000-54099                      │   │
│  │   ├─ 检测已存在实例                                 │   │
│  │   └─ 绑定端口或退出                                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                     │                                        │
│                     ▼                                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 阶段 2: 遍历启动服务                                │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ for name, cfg in config.services.items():           │   │
│  │   instance = SERVICE_STARTERS[name](cfg)            │   │
│  │   self.services[name] = instance                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                     │                                        │
│                     ├─────────────────────────────────┐     │
│                     │                                 │     │
│                     ▼                                 ▼     │
└─────────────────────┼─────────────────────────────────┼─────┘
                      │                                 │
        ┌─────────────┴────────────┐       ┌────────────┴─────────────┐
        │                          │       │                          │
        ▼                          ▼       ▼                          ▼
┌────────────────┐    ┌────────────────┐  ┌────────────────┐   ┌────────────────┐
│  Service 1:    │    │  Service 2:    │  │  Service 3:    │   │  Service 4:    │
│  heartbeat     │    │  rpc_v2        │  │  ui            │   │  tray          │
└────────┬───────┘    └────────┬───────┘  └────────┬───────┘   └────────┬───────┘
         │                     │                    │                    │
         ▼                     ▼                    ▼                    ▼
```

---

## 📊 服务启动详细顺序

### 🔹 Service 1: Heartbeat (心跳系统)

**文件**: `pycore/pythreadpool/starters.py:80`

```
start_heartbeat(config: {})
  ↓
_register_builtin_handlers()  # 首次调用：注册 app.restart 等事件
  ↓
pycore.pyheartbeat.initialize_heartbeat_system()
  ↓
instance.start()  # 启动心跳线程
  ↓
THREAD_BUS.register_shutdown_handler(stop_heartbeat, priority=100)
  ↓
✅ Heartbeat System started
```

**作用**:
- 全局心跳监控
- 注册内置事件处理器（restart、close）
- 优先级：100（最后停止）

---

### 🔹 Service 2: RPC v2 (FastAPI + Uvicorn)

**文件**: `pycore/pythreadpool/starters.py:113`

```
start_rpc_v2(config: {
  port: 8000,
  host: '0.0.0.0',
  debug: True,
  fastapi_routers: [Matrix API routers],
  static_mounts: [{ '/' → '/path/to/.output/public' }]  ⚠️ 前端静态文件挂载
})
  ↓
pycore.pyutils.rpc_v2.FastAPIRPCServerRunner(
  host='0.0.0.0',
  port=8000,
  fastapi_routers=[...],
  static_mounts=[...]
)
  ↓
instance.start()
  ├─ 创建 FastAPI app
  ├─ 注册 CORS middleware
  ├─ 注册 FastAPI routers (Matrix APIs)
  ├─ 挂载静态文件:
  │   app.mount('/', StaticFiles(directory='.output/public', html=True))
  │   ⚠️ 这里前端静态文件被挂载到根路径
  └─ 启动 Uvicorn server (阻塞在单独线程)
  ↓
THREAD_BUS.register_shutdown_handler(stop_rpc_v2, priority=50)
  ↓
✅ RPC v2 Server started on 0.0.0.0:8000
✅ HTTP: http://0.0.0.0:8000/rpc/<route>
✅ WebSocket: ws://0.0.0.0:8000/rpc/ws
⭐ 前端: http://localhost:8000/ (静态文件服务)
```

**作用**:
- 提供 Matrix 后端 API（FastAPI routes）
- 提供 WebSocket 支持
- **提供前端静态文件服务**（挂载预编译的 dist/）
- 优先级：50（中等）

**关键点**:
- ⚠️ **前端已经在 Step 1 编译好，这里只是挂载静态文件**
- ⚠️ **没有启动任何前端开发服务器（npm run dev）**
- ⚠️ **Production 模式：所有请求都通过一个端口（8000）**

---

### 🔹 Service 3: UI (PySide6 WebView)

**文件**: `pycore/pythreadpool/starters.py:205`

```
start_ui(config: {
  app_name: '星灿传媒科技-云矩阵',
  app_id: 'matrix',
  window_size: (1400, 900),
  webview_url: 'http://localhost:8000',  ⚠️ 指向 RPC v2
  show_on_start: True,
  frameless: True,
  icon_path: '.../icon.ico',
  logo_path: '.../logo.png',
  enable_webview: True,
})
  ↓
检查 PySide6 安装
  ↓
pycore.pyutils.native_ui.step5_main_ui.pyside6.PySide6UIThread(
  ui_config=ui_config,
  startup_config=startup_config,
  daemon=True
)
  ↓
ui_thread.start()
  ├─ 创建 PySide6 QApplication
  ├─ 创建 PySide6MainWindow (frameless)
  ├─ 加载 WebView: http://localhost:8000
  │   ⚠️ WebView 访问 RPC v2 服务器
  │   ⚠️ RPC v2 返回前端静态文件（index.html）
  ├─ 显示窗口
  └─ 进入 Qt 事件循环
  ↓
THREAD_BUS.register_shutdown_handler(stop_ui, priority=10)
  ↓
✅ PySide6 UI SERVICE STARTED
✅ App: 星灿传媒科技-云矩阵
✅ WebView URL: http://localhost:8000
```

**作用**:
- 创建桌面应用窗口
- 嵌入 WebView 显示前端界面
- 自定义无边框窗口
- 优先级：10（最先停止）

**关键点**:
- ⚠️ **WebView 加载 http://localhost:8000**
- ⚠️ **所有前端资源由 RPC v2 静态文件服务提供**

---

### 🔹 Service 4: Tray (系统托盘)

**文件**: `pycore/pythreadpool/starters.py:347`

```
start_tray(config: {
  app_name: '星灿传媒科技-云矩阵',
  icon_path: '.../icon.ico',
  menu_items: [
    { text: '打开前端', action_signal: 'tray_action_open_frontend' },
    { text: '打开API文档', action_signal: 'tray_action_open_api_docs' },
    { text: '退出', action_signal: 'tray_action_exit' }
  ],
  trigger_shutdown_on_exit: True
})
  ↓
检查 pystray 是否可用
  ↓
pycore.pyutils.native_ui.step6_tray.tray_thread.TkinterSystemTrayThread(
  app_name='...',
  icon_path='...',
  menu_items=[...],
  daemon=True
)
  ↓
tray_thread.start()
  ├─ 创建系统托盘图标
  ├─ 注册菜单项
  └─ 监听点击事件
  ↓
THREAD_BUS.register_shutdown_handler(stop_tray, priority=20)
  ↓
✅ System Tray started: 星灿传媒科技-云矩阵
```

**作用**:
- 显示系统托盘图标
- 提供快捷菜单
- 优先级：20

---

## 🎯 前端启动位置总结

### ❓ 前端在哪里启动？

**答案**：前端**不是在服务启动时启动的**，而是：

1. **Step 1（matrix_main.py:44）**：**预先编译**前端
   - 文件：`pyapps/matrix/controller/frontend_compiler.py`
   - 调用：`compile_frontend_if_needed()`
   - 执行：`npm run build`（如需要）
   - 输出：`.output/public/` 目录（静态文件）

2. **Step 2（launcher_builder.py:84）**：获取静态文件路径
   - 创建临时 `NuxtLauncher` 获取 `static_dir`
   - 添加到 `static_mounts` 配置

3. **Service 2（start_rpc_v2）**：**挂载静态文件**
   - RPC v2 服务器挂载 `static_dir` 到根路径 `/`
   - 用户访问 `http://localhost:8000/` 时返回 `index.html`

### ⚠️ 关键发现

1. **没有前端开发服务器**
   - Matrix 不启动 `npm run dev`
   - 完全依赖预编译的静态文件
   - Dev 模式需要**手动**运行 `npm run dev`

2. **单端口架构**
   - 前端和后端共用一个端口（8000）
   - RPC v2 同时提供 API 和静态文件
   - WebView 只需访问 `http://localhost:8000`

3. **前端编译时机**
   - 在**任何服务启动之前**完成
   - 编译失败不影响服务启动（只是静态文件不可用）

---

## 📝 完整启动时间线

```
T+0.0s  │ python pymain.py app=matrix
        │
T+0.1s  │ AppLauncher 动态加载 matrix_main.py
        │
T+0.2s  │ ╔═══════════════════════════════════════════════╗
        │ ║ Step 1: 编译前端（如需要）                   ║
        │ ╚═══════════════════════════════════════════════╝
        │ ├─ 检查 .output/public/ 是否存在
        │ ├─ 运行 npm run build（首次或更新时）
        │ └─ 验证静态文件
        │
T+30s   │ ✅ 前端编译完成（或跳过）
        │
T+30.1s │ ╔═══════════════════════════════════════════════╗
        │ ║ Step 2: 构建启动配置                        ║
        │ ╚═══════════════════════════════════════════════╝
        │ ├─ 加载 Matrix API routers
        │ ├─ 获取静态文件路径
        │ └─ 构建 LauncherConfig
        │
T+30.2s │ ╔═══════════════════════════════════════════════╗
        │ ║ Step 3: 启动服务                            ║
        │ ╚═══════════════════════════════════════════════╝
        │ ├─ 单例检测（54000-54099）
        │ └─ 遍历启动服务：
        │
T+30.3s │   ┌─────────────────────────────────────┐
        │   │ Service 1: Heartbeat               │
        │   └─────────────────────────────────────┘
        │   ✅ Heartbeat System started
        │
T+30.5s │   ┌─────────────────────────────────────┐
        │   │ Service 2: RPC v2                  │
        │   ├─ 注册 Matrix API routes            │
        │   ├─ 挂载静态文件: / → .output/public │ ⭐
        │   └─ 启动 Uvicorn: 0.0.0.0:8000       │
        │   └─────────────────────────────────────┘
        │   ✅ RPC v2 Server started
        │   ✅ Frontend: http://localhost:8000/
        │
T+31s   │   ┌─────────────────────────────────────┐
        │   │ Service 3: UI (PySide6)            │
        │   ├─ 创建窗口                          │
        │   ├─ WebView 加载: http://localhost:8000
        │   └─ 显示窗口                          │
        │   └─────────────────────────────────────┘
        │   ✅ PySide6 UI started
        │
T+31.5s │   ┌─────────────────────────────────────┐
        │   │ Service 4: Tray                    │
        │   ├─ 创建托盘图标                      │
        │   └─ 注册菜单                          │
        │   └─────────────────────────────────────┘
        │   ✅ System Tray started
        │
T+32s   │ ╔═══════════════════════════════════════════════╗
        │ ║ Step 4: 注册事件处理器                       ║
        │ ╚═══════════════════════════════════════════════╝
        │ └─ register_matrix_event_handlers()
        │
T+32s   │ ✅ Application running
        │ 🔄 进入主循环（等待 Ctrl+C）
```

---

## 🆚 当前架构 vs 新的 native_ui 集成

### 当前 Matrix 架构

```
matrix_main.py
  ├─ Step 1: compile_frontend_if_needed()  ← 预编译（旧方式）
  │   └─ NuxtLauncher.prepare_build()
  ├─ Step 2: build_matrix_launcher_config()
  │   └─ 获取 static_dir 路径
  └─ Step 3: ServiceLauncher.start()
      └─ start_rpc_v2() → 挂载静态文件
```

**特点**:
- ✅ 使用旧的 `frontend_launcher`
- ✅ 预编译模式
- ✅ 静态文件挂载
- ❌ 不支持自动启动 dev server
- ❌ 不支持阻塞等待
- ❌ 不支持多框架

### 新的 native_ui 集成（我们实现的）

```
NativeUIConfig (frontend_enabled=True)
  ↓
launch_native_app()
  ├─ Phase 4.6: _start_frontend()  ← 集成启动（新方式）
  │   ├─ FrontendLauncherThread.start()
  │   ├─ 自动安装依赖
  │   ├─ 构建或启动 dev server
  │   └─ 阻塞等待（可选）
  └─ Phase 5-7: 启动其他服务
```

**特点**:
- ✅ 集成到 `native_ui`
- ✅ 支持 7 种框架
- ✅ 自动依赖安装
- ✅ 智能构建检测
- ✅ 支持 dev 模式自动启动
- ✅ 阻塞等待前端就绪
- ✅ 单独线程运行

---

## 🔄 如何迁移到新架构

### 当前代码（matrix_main.py）

```python
# Step 1: Compile frontend
compile_frontend_if_needed(
    project_root=PROJECT_ROOT,
    skip_build=Config.FRONTEND_SKIP_BUILD,
    force_rebuild=Config.FRONTEND_FORCE_REBUILD
)

# Step 2: Build config
launcher_config = build_matrix_launcher_config(
    project_root=PROJECT_ROOT,
    frontend_port=Config.FRONTEND_PORT,
    backend_port=Config.WEB_PORT,
    frontend_mode=Config.FRONTEND_MODE
)

# Step 3: Start services
launcher = ServiceLauncher(launcher_config)
launcher.start()
```

### 迁移后（使用 native_ui 集成）

```python
from pycore.pyutils.native_ui import NativeUIConfig, launch_native_app

def start():
    """使用 native_ui 集成方式"""

    config = NativeUIConfig(
        # 基本配置
        app_id="matrix",
        app_name="Matrix Application",
        main_entry=matrix_main_entry,  # 新增：主逻辑入口

        # 前端配置（集成）
        frontend_enabled=True,
        frontend_framework="nuxt",  # 或 "vite" for React
        frontend_app_dir=PROJECT_ROOT / "poly_apps" / "nuxt_main",
        frontend_mode="production",
        frontend_port=3000,
        frontend_auto_install=True,
        frontend_skip_build=Config.FRONTEND_SKIP_BUILD,
        frontend_block_until_ready=True,  # 阻塞等待

        # UI 配置（集成）
        window_size=(1400, 900),
        frameless=True,
        show_on_start=True,

        # 调试
        debug=True,
        project_root=PROJECT_ROOT,
    )

    # 一步启动（前端+服务+UI）
    launch_native_app(config)

def matrix_main_entry():
    """应用主逻辑（新增）"""
    # 注册事件处理器
    register_matrix_event_handlers(...)

    # 保持运行
    while not THREAD_BUS.is_shutdown_requested():
        time.sleep(1)
```

**优势**:
- ✅ 代码更简洁（从 3 步 → 1 步）
- ✅ 自动处理前端生命周期
- ✅ 支持 dev 模式自动启动
- ✅ 统一的配置管理

---

## 📚 相关文件索引

### 入口和配置

| 文件 | 位置 | 作用 |
|------|------|------|
| pymain.py | 项目根目录 | 应用入口 |
| matrix_main.py | pyapps/matrix/ | Matrix 主程序 |
| matrix_config.py | pyapps/matrix/ | Matrix 配置 |

### 控制器

| 文件 | 位置 | 作用 |
|------|------|------|
| frontend_compiler.py | pyapps/matrix/controller/ | 前端编译 |
| launcher_builder.py | pyapps/matrix/controller/ | 启动配置构建 |
| event_handlers.py | pyapps/matrix/controller/ | 事件处理器 |

### 启动器

| 文件 | 位置 | 作用 |
|------|------|------|
| launcher.py | pycore/pylauncher/ | ServiceLauncher |
| starters.py | pycore/pythreadpool/ | 各服务启动函数 |

### 前端启动（旧）

| 文件 | 位置 | 作用 |
|------|------|------|
| nuxt_launcher.py | pycore/pyutils/frontend_launcher/ | Nuxt 启动器 |
| frontend_config.py | pycore/pyutils/frontend_launcher/ | 前端配置 |

### 前端启动（新）

| 文件 | 位置 | 作用 |
|------|------|------|
| step9_frontend/ | pycore/pyutils/native_ui/ | 集成前端启动 |
| app_config.py | pycore/pyutils/native_ui/step1_config/ | NativeUIConfig |

---

## ✅ 总结

### 前端启动位置

**Matrix 当前方式**:
1. ⏱️ **编译时机**: matrix_main.py Step 1（服务启动前）
2. 📍 **编译位置**: `pyapps/matrix/controller/frontend_compiler.py`
3. 🔧 **编译工具**: `NuxtLauncher`（旧的 frontend_launcher）
4. 📦 **输出**: `.output/public/`（静态文件）
5. 🌐 **服务**: RPC v2 挂载静态文件到 `/`
6. 🖥️ **访问**: WebView 加载 `http://localhost:8000`

### 服务启动顺序

```
1. Heartbeat  (心跳系统, priority=100)
   ↓
2. RPC v2     (API + 静态文件, priority=50) ⭐ 前端在这里提供
   ↓
3. UI         (PySide6 窗口, priority=10)
   ↓
4. Tray       (系统托盘, priority=20)
```

### 关键发现

- ⚠️ **前端不是在运行时启动的**，而是预先编译好的静态文件
- ⚠️ **没有前端开发服务器**（dev模式需手动启动）
- ⚠️ **单端口架构**：前端和后端共用8000端口
- ✅ **优势**：启动快、部署简单
- ❌ **缺点**：不支持热更新、不支持多框架

---

**文档版本**: v1.0
**最后更新**: 2025-12-07
**作者**: Claude Code
