# Native UI + RPC v2 完整整合方案

## 1. 整合目标

将 RPC v2 后端服务和前端管理完全集成到 `pycore.pyutils.native_ui` 模块中，实现：

1. **统一入口点**：应用层只需配置 `NativeUIConfig`，一键启动完整应用
2. **前端自动化**：生产模式自动编译 + 挂载，开发模式自动启动 dev server
3. **RPC v2 集成**：native_ui 负责 RPC v2 服务启动和静态文件协调
4. **代码简化**：Matrix 应用从 ~350 行简化到 ~120 行

## 2. 当前架构分析

### 2.1 当前 Matrix 启动流程

```
matrix_main.py
├── Step 1: compile_frontend_if_needed()          ← frontend_compiler.py
├── Step 2: build_matrix_launcher_config()        ← launcher_builder.py
│   ├── 导入所有 API routers
│   ├── 使用 NuxtLauncher 获取 static_dir
│   ├── 构建 LauncherConfig
│   │   ├── services['rpc_v2']['fastapi_routers'] = [routers...]
│   │   └── services['rpc_v2']['static_mounts'] = [static_mount_config]
│   └── services['ui']['webview_url'] = url
├── Step 3: ServiceLauncher.start()               ← pylauncher.launcher
│   └── SERVICE_STARTERS['rpc_v2'](config)        ← pythreadpool.starters
│       └── FastAPIRPCServer(options)             ← rpc_v2.server
│           ├── app.include_router(router)        ← 挂载路由
│           └── app.mount(prefix, StaticFiles)    ← 挂载静态文件
└── Step 4: register_matrix_event_handlers()
```

### 2.2 数据流分析

```
前端编译：
  frontend_compiler.py → frontend_launcher.NuxtLauncher → compile → .output/public/

静态挂载信息流：
  launcher_builder.py
    → NuxtLauncher.static_dir
    → static_mounts = [{"url_prefix": "/", "directory": "...", "name": "frontend"}]
    → LauncherConfig.services['rpc_v2']['static_mounts']
    → SERVICE_STARTERS['rpc_v2'](config)
    → FastAPIRPCServer(options={'static_mounts': [...]})
    → app.mount(url_prefix, StaticFiles(directory=...))
```

### 2.3 关键集成点

| 集成点 | 当前位置 | 目标位置 |
|-------|---------|---------|
| 前端编译 | `frontend_compiler.py` | `native_ui/step9_frontend` |
| 静态路径获取 | `launcher_builder.py` | `native_ui/step9_frontend` |
| RPC v2 配置 | `launcher_builder.py` | `native_ui/launch_native_app.py` |
| RPC v2 启动 | `ServiceLauncher` | `native_ui/launch_native_app.py` |
| 静态挂载协调 | `launcher_builder.py` → `starters.py` | `native_ui` 内部协调 |

## 3. 整合方案设计

### 3.1 扩展 NativeUIConfig

在 `pycore/pyutils/native_ui/step1_config/app_config.py` 中添加 RPC v2 配置字段：

```python
@dataclass
class NativeUIConfig:
    # ... 现有字段 ...

    # ========== RPC v2 配置（新增）==========
    rpc_enabled: bool = False
    """启用 RPC v2 后端服务"""

    rpc_port: int = 8000
    """RPC v2 服务端口"""

    rpc_host: str = "0.0.0.0"
    """RPC v2 服务主机"""

    rpc_debug: bool = True
    """RPC v2 调试模式"""

    rpc_routers: List[Any] = field(default_factory=list)
    """FastAPI 路由器列表（传递给 RPC v2）"""

    rpc_allow_origins: List[str] = field(default_factory=lambda: ["*"])
    """CORS 允许的源列表"""

    rpc_auto_mount_frontend: bool = True
    """自动挂载前端静态文件（从 frontend_thread 获取）"""
```

### 3.2 新增 Phase 4.7: RPC v2 集成

在 `pycore/pyutils/native_ui/step3_launcher/launch_native_app.py` 中添加：

```python
def launch_native_app(config: NativeUIConfig) -> None:
    # ... Phase 1-4.6 现有代码 ...

    # ========== Phase 4.7: Start RPC v2 (if enabled) ==========
    rpc_service = None
    if config.rpc_enabled:
        rpc_service = _start_rpc_v2_service(config, frontend_thread)

    # Update final_url if RPC v2 is serving frontend
    if rpc_service and config.rpc_auto_mount_frontend:
        if config.frontend_mode == "production":
            final_url = f"http://localhost:{config.rpc_port}"
            ColorPrint.cyan(f"[NativeLauncher] Updated URL to RPC v2: {final_url}")

    # ... Phase 5-7 现有代码 ...
```

### 3.3 RPC v2 启动函数

```python
def _start_rpc_v2_service(
    config: NativeUIConfig,
    frontend_thread: Optional['FrontendLauncherThread']
) -> Any:
    """
    启动 RPC v2 服务，协调静态文件挂载

    Args:
        config: Native UI 配置
        frontend_thread: 前端线程（用于获取静态挂载配置）

    Returns:
        RPC v2 服务实例
    """
    from pycore.pylauncher import LauncherConfig, ServiceLauncher

    # 准备静态挂载配置
    static_mounts = []

    # 1. 从 frontend_thread 获取静态挂载配置（如果启用）
    if config.rpc_auto_mount_frontend and frontend_thread:
        frontend_static_mount = frontend_thread.get_static_mount()
        if frontend_static_mount:
            static_mounts.append(frontend_static_mount)
            if config.debug:
                ColorPrint.green(
                    f"[NativeLauncher] Frontend static mount: "
                    f"{frontend_static_mount['url_prefix']} -> {frontend_static_mount['directory']}"
                )

    # 2. 创建 RPC v2 服务配置
    rpc_v2_config = {
        'port': config.rpc_port,
        'host': config.rpc_host,
        'debug': config.rpc_debug,
        'fastapi_routers': config.rpc_routers,
        'static_mounts': static_mounts,
        'allow_origins': config.rpc_allow_origins
    }

    # 3. 使用 ServiceLauncher 启动 RPC v2
    launcher_config = LauncherConfig(
        app_id=config.app_id,
        app_name=config.app_name,
        singleton=False,  # native_ui 已经处理了单例
        services={
            'heartbeat': {},
            'rpc_v2': rpc_v2_config
        }
    )

    launcher = ServiceLauncher(launcher_config)
    launcher.start()

    if config.debug:
        ColorPrint.print_info(f"[NativeLauncher] Phase 4.7: RPC v2 started on {config.rpc_host}:{config.rpc_port}")

    # 4. 注册关闭回调（清理 RPC v2）
    def cleanup_rpc_v2():
        if config.debug:
            ColorPrint.print_info("[NativeLauncher] Stopping RPC v2...")
        launcher.stop()

    callback_manager.add_closing_callback(cleanup_rpc_v2)

    # 5. 返回 RPC v2 服务实例（用户可以通过 launcher.get_service('rpc_v2') 获取）
    return launcher.get_service('rpc_v2')
```

### 3.4 前端静态挂载协调

在 `pycore/pyutils/native_ui/step9_frontend/frontend_thread.py` 中已实现：

```python
class FrontendLauncherThread(threading.Thread):
    def get_static_mount(self) -> Optional[dict]:
        """
        获取静态文件挂载配置（用于 RPC v2）

        Returns:
            静态挂载配置字典:
            {
                'url_prefix': '/',
                'directory': '/path/to/static',
                'name': 'frontend'
            }
            如果不适用则返回 None
        """
        if self.config.mode != "production":
            return None

        if not self._static_dir or not self._static_dir.exists():
            return None

        return {
            'url_prefix': '/',
            'directory': str(self._static_dir),
            'name': f'{self.config.framework}_frontend'
        }
```

## 4. 应用层简化示例

### 4.1 简化后的 Matrix 启动代码

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Matrix Application - Simplified with Native UI Integration
"""
from pathlib import Path
from pycore.pyutils.native_ui import NativeUIConfig, launch_native_app
from pyapps.matrix.matrix_config import Config

# Import Matrix API routers
from pyapps.matrix.api import (
    health_router,
    device_router,
    screen_router,
    file_router,
    recording_router,
    group_router,
    config_router,
    unified_ws_router
)

PROJECT_ROOT = Path(__file__).parent.parent.parent

def matrix_main_entry():
    """Matrix 主入口（在 native_ui 初始化后调用）"""
    from pyapps.matrix.controller.event_handlers import register_matrix_event_handlers
    register_matrix_event_handlers(
        frontend_port=Config.FRONTEND_PORT,
        backend_port=Config.WEB_PORT,
        backend_host=Config.WEB_HOST,
        frontend_mode=Config.FRONTEND_MODE
    )

def start():
    """统一启动入口"""
    # 创建 Native UI 配置（集成所有功能）
    config = NativeUIConfig(
        # ========== 基础配置 ==========
        app_id="matrix",
        app_name="星灿传媒-云矩阵",
        main_entry=matrix_main_entry,
        project_root=PROJECT_ROOT,

        # ========== 前端配置 ==========
        frontend_enabled=True,
        frontend_framework="nuxt",
        frontend_app_dir=PROJECT_ROOT / "poly_apps" / "pymatrix",
        frontend_mode=Config.FRONTEND_MODE,  # 'production' or 'dev'
        frontend_port=Config.FRONTEND_PORT,
        frontend_auto_install=True,
        frontend_skip_build=Config.FRONTEND_SKIP_BUILD,
        frontend_block_until_ready=Config.FRONTEND_MODE == "dev",

        # ========== RPC v2 配置 ==========
        rpc_enabled=True,
        rpc_port=Config.WEB_PORT,
        rpc_host=Config.WEB_HOST,
        rpc_debug=True,
        rpc_routers=[
            health_router,
            device_router,
            screen_router,
            file_router,
            recording_router,
            group_router,
            config_router,
            unified_ws_router
        ],
        rpc_auto_mount_frontend=True,  # 自动协调静态文件挂载

        # ========== UI 配置 ==========
        window_size=(1400, 900),
        show_on_start=True,
        frameless=True,
        icon_path=str(PROJECT_ROOT / "pyapps" / "matrix" / "resources" / "icon.ico"),
        logo_path=str(PROJECT_ROOT / "pyapps" / "matrix" / "resources" / "logo.png"),

        # ========== Tray 配置 ==========
        enable_tray=True,
        tray_menu_items=[
            {"text": "打开前端", "callback": lambda: ...},
            {"text": "打开 API 文档", "callback": lambda: ...},
            {"text": "退出", "callback": lambda: ...}
        ],

        # ========== Debug 配置 ==========
        show_debug_window=True,
        debug=True,
        force=False
    )

    # 一键启动（native_ui 处理所有事情）
    launch_native_app(config)

if __name__ == '__main__':
    start()
```

**代码行数对比：**
- 原 Matrix 代码：~350 行（matrix_main.py + frontend_compiler.py + launcher_builder.py）
- 新 Matrix 代码：~120 行（仅 matrix_main.py）
- **减少 65% 代码**

### 4.2 配置模式对比

| 模式 | 前端行为 | RPC v2 行为 | URL |
|-----|---------|------------|-----|
| **生产模式** | 1. 自动编译 Nuxt<br>2. 生成 `.output/public/`<br>3. 传递 static_mount 给 RPC v2 | 挂载静态文件到 `/` | `http://localhost:{rpc_port}` |
| **开发模式** | 1. 自动启动 `npm run dev`<br>2. 等待 dev server ready<br>3. 不传递 static_mount | 仅启动 API 服务 | `http://localhost:{frontend_port}` |
| **仅 RPC** | 前端禁用 | 仅启动 API 服务 | 无 WebView |

## 5. 架构流程图

### 5.1 整合后的启动流程

```
launch_native_app(config)
│
├─ Phase 1: Auto Port Allocation
│  └─ get_port_range(app_id) → 54000-54099
│
├─ Phase 2: Process URL
│  └─ process_url(config.url) → final_url
│
├─ Phase 3: Initialize Callback Manager
│  └─ CallbackManager(on_ready, on_closing, on_closed)
│
├─ Phase 4.5: Auto-start Timer Manager (if enabled)
│
├─ Phase 4.6: Start Frontend (if enabled)
│  ├─ FrontendLauncherThread.start()
│  ├─ Production Mode:
│  │  ├─ Check if .output/public/ exists
│  │  ├─ If not: Block and compile
│  │  └─ Return static_mount config
│  └─ Dev Mode:
│     ├─ Auto pnpm install
│     ├─ Auto npm run dev
│     └─ Wait for http://localhost:{port} ready
│
├─ Phase 4.7: Start RPC v2 (if enabled)  ← 新增！
│  ├─ Get static_mount from frontend_thread
│  ├─ Build LauncherConfig:
│  │  ├─ services['rpc_v2']['fastapi_routers'] = config.rpc_routers
│  │  └─ services['rpc_v2']['static_mounts'] = [frontend_static_mount]
│  ├─ ServiceLauncher.start()
│  │  └─ FastAPIRPCServer(options)
│  │     ├─ app.include_router(router) for each router
│  │     └─ app.mount('/', StaticFiles(directory=static_dir))
│  └─ Register cleanup callback
│
├─ Phase 5: Singleton Detection
│  └─ SingletonDetector.detect_and_bind()
│
├─ Phase 6: Launch with/without Startup Window
│  ├─ Create _wrapped_main_entry()
│  │  ├─ Call user's main_entry()
│  │  └─ Create PySide6 UI
│  └─ If show_debug_window:
│     └─ launch_app_with_startup()
│
└─ Phase 7: Create PySide6 UI
   ├─ PySide6Framework(config)
   ├─ Wire callbacks to CallbackManager
   └─ framework.start() → QApplication.exec()
```

### 5.2 信息流：静态文件协调

```
┌─────────────────────────────────────────────────────────────┐
│                     launch_native_app                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Phase 4.6: Start Frontend                                 │
│  ┌───────────────────────────────────────────────────┐    │
│  │ FrontendLauncherThread                            │    │
│  │                                                   │    │
│  │ [Production Mode]                                 │    │
│  │  1. Check .output/public/ exists                  │    │
│  │  2. If not: compile_and_wait()                    │    │
│  │  3. _static_dir = .output/public/                 │    │
│  │                                                   │    │
│  │ [get_static_mount()]                              │    │
│  │  return {                                         │    │
│  │    'url_prefix': '/',                             │    │
│  │    'directory': str(_static_dir),    ───────────┐│    │
│  │    'name': 'nuxt_frontend'                      ││    │
│  │  }                                              ││    │
│  └─────────────────────────────────────────────────┘│    │
│                                                     ↓│    │
│  Phase 4.7: Start RPC v2                            │    │
│  ┌─────────────────────────────────────────────────┐│    │
│  │ _start_rpc_v2_service()                         ││    │
│  │                                                 ││    │
│  │ 1. frontend_static_mount = ←───────────────────┘│    │
│  │      frontend_thread.get_static_mount()         │    │
│  │                                                  │    │
│  │ 2. static_mounts = [frontend_static_mount]      │    │
│  │                                                  │    │
│  │ 3. LauncherConfig(                               │    │
│  │      services={                                  │    │
│  │        'rpc_v2': {                               │    │
│  │          'fastapi_routers': config.rpc_routers, │    │
│  │          'static_mounts': static_mounts ────────┐│    │
│  │        }                                        ││    │
│  │      }                                          ││    │
│  │    )                                            ││    │
│  │                                                 ↓│    │
│  │ 4. ServiceLauncher.start()                     ││    │
│  │      └─> SERVICE_STARTERS['rpc_v2'](config)    ││    │
│  │           └─> FastAPIRPCServer(options)        ││    │
│  │                ├─ app.include_router(...)      ││    │
│  │                └─ app.mount('/', StaticFiles)←─┘│    │
│  └─────────────────────────────────────────────────┘     │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

### 5.3 对比：整合前后

**整合前（当前架构）：**
```
matrix_main.py
  ├─ compile_frontend_if_needed()          ← frontend_compiler.py
  │   └─ NuxtLauncher.prepare_build()
  │
  ├─ build_matrix_launcher_config()        ← launcher_builder.py
  │   ├─ Import API routers (hard-coded)
  │   ├─ NuxtLauncher.static_dir
  │   └─ Build LauncherConfig
  │       ├─ services['rpc_v2']['fastapi_routers']
  │       └─ services['rpc_v2']['static_mounts']
  │
  ├─ ServiceLauncher.start()
  │   └─ SERVICE_STARTERS['rpc_v2'](config)
  │       └─ FastAPIRPCServer(options)
  │           └─ app.mount('/', StaticFiles)
  │
  └─ register_matrix_event_handlers()
```

**整合后（目标架构）：**
```
matrix_main.py (simplified)
  └─ launch_native_app(config)             ← native_ui.launch_native_app
      ├─ Phase 4.6: _start_frontend()
      │   └─ FrontendLauncherThread
      │       ├─ Auto compile (production)
      │       ├─ Auto npm run dev (dev)
      │       └─ get_static_mount()
      │
      ├─ Phase 4.7: _start_rpc_v2_service()  ← 新增！
      │   ├─ Get static_mount from frontend_thread
      │   ├─ Build LauncherConfig (internal)
      │   └─ ServiceLauncher.start() (internal)
      │       └─ FastAPIRPCServer
      │           └─ app.mount('/', StaticFiles)
      │
      └─ Phase 7: _create_pyside6_ui()
```

## 6. 实施步骤

### 6.1 Phase 1: 扩展 NativeUIConfig
- [ ] 修改 `pycore/pyutils/native_ui/step1_config/app_config.py`
- [ ] 添加 RPC v2 配置字段
- [ ] 添加配置验证逻辑
- [ ] 更新文档字符串

### 6.2 Phase 2: 实现 RPC v2 集成
- [ ] 修改 `pycore/pyutils/native_ui/step3_launcher/launch_native_app.py`
- [ ] 添加 `_start_rpc_v2_service()` 函数
- [ ] 添加 Phase 4.7 到 `launch_native_app()`
- [ ] 添加静态挂载协调逻辑
- [ ] 添加 RPC v2 关闭回调

### 6.3 Phase 3: 更新 native_ui 导出
- [ ] 修改 `pycore/pyutils/native_ui/__init__.py`
- [ ] 确保所有新功能正确导出

### 6.4 Phase 4: 重构 Matrix 应用
- [ ] 简化 `pyapps/matrix/matrix_main.py`
- [ ] 删除 `pyapps/matrix/controller/frontend_compiler.py`
- [ ] 删除 `pyapps/matrix/controller/launcher_builder.py`
- [ ] 保留 `pyapps/matrix/controller/event_handlers.py`
- [ ] 更新 Matrix 配置使用 NativeUIConfig

### 6.5 Phase 5: 测试验证
- [ ] 测试生产模式：自动编译 + 静态挂载
- [ ] 测试开发模式：自动 dev server
- [ ] 测试仅 RPC 模式：无前端
- [ ] 测试 Matrix 应用完整流程
- [ ] 验证代码行数减少 (~65%)

### 6.6 Phase 6: 文档更新
- [ ] 更新 `NATIVE_UI_FRONTEND_INTEGRATION.md`
- [ ] 更新 `PYTHON_PYCORE.md`
- [ ] 创建迁移指南
- [ ] 更新 API 文档

## 7. 兼容性保证

### 7.1 向后兼容
- 所有现有 native_ui 功能保持不变
- RPC v2 和前端功能均为可选（默认禁用）
- 不影响现有使用 native_ui 的应用

### 7.2 渐进式迁移
应用可以逐步迁移：
1. **第一步**：只启用前端管理（`frontend_enabled=True`）
2. **第二步**：启用 RPC v2（`rpc_enabled=True`）
3. **第三步**：删除旧的 frontend_compiler 和 launcher_builder

## 8. 优势总结

| 维度 | 整合前 | 整合后 | 改进 |
|-----|--------|--------|------|
| **代码行数** | ~350 行 | ~120 行 | ↓ 65% |
| **文件数量** | 3 个文件 | 1 个文件 | ↓ 67% |
| **配置复杂度** | 3 步配置 | 1 步配置 | ↓ 67% |
| **前端编译** | 手动调用 | 自动处理 | 全自动 |
| **静态挂载** | 手动协调 | 自动协调 | 全自动 |
| **开发体验** | 需要理解 3 层架构 | 单一配置入口 | 大幅简化 |

## 9. 风险评估

| 风险 | 等级 | 缓解措施 |
|-----|------|---------|
| 破坏现有 native_ui 功能 | 低 | 所有新功能可选，默认禁用 |
| 增加 native_ui 复杂度 | 中 | 模块化设计，保持各 step 独立 |
| RPC v2 启动失败 | 低 | 完整的错误处理和回退机制 |
| 前端编译阻塞 | 低 | 已在 step9_frontend 中实现 |

## 10. 下一步

1. **实现 Phase 1-3**：完成 native_ui 扩展
2. **测试验证**：创建测试用例
3. **重构 Matrix**：应用新架构
4. **文档更新**：完整的迁移指南
5. **其他应用迁移**：将方案推广到其他 pyapps

---

**文档版本**: v1.0
**创建时间**: 2025-12-07
**作者**: Claude (AI Assistant)
**状态**: 设计方案（待实施）
