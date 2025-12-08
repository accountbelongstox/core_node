# Native UI 与 RPC v2 完整整合方案

## 📋 问题分析

### 当前架构问题

**1. 代码分散**
```
matrix_main.py
  ├─ 手动调用 compile_frontend_if_needed()
  ├─ launcher_builder.py 手动创建 static_mounts
  └─ start_rpc_v2() 被动接收 static_mounts
```

**2. 职责不清**
- Matrix 应用层需要关心前端编译
- RPC v2 不知道前端从哪来
- native_ui 没有被充分利用

**3. 不符合规范**
- 违反 "pyutils 统一管理" 原则
- 前端管理逻辑分散在应用层

---

## 🎯 整合方案架构

### 核心原则

1. **native_ui 统一管理前端**
   - 编译、dev server、静态文件路径
   - 阻塞等待编译完成
   - 提供挂载配置

2. **RPC v2 保持被动**
   - 只负责挂载静态文件
   - 不关心前端来源
   - 通过配置接收挂载信息

3. **应用层简化**
   - Matrix 只需配置，不需要手动处理
   - 一个配置对象搞定所有

---

## 🏗️ 新架构设计

### 方案：集成模式（推荐）

```
┌────────────────────────────────────────────────────────┐
│  matrix_main.py (应用层)                                │
│  ├─ 创建 NativeUIConfig                                 │
│  │   frontend_enabled = True                            │
│  │   frontend_framework = 'vite'                        │
│  │   frontend_mode = 'production'                       │
│  │   rpc_enabled = True  ←─────┐ 新增：RPC 配置       │
│  │   rpc_port = 8000           │                        │
│  │   rpc_routers = [...]       │                        │
│  └─ launch_native_app(config)  │                        │
└────────────────────────────────┴────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│  native_ui (pyutils)                                    │
│  ├─ Phase 1: 处理前端                                   │
│  │   ├─ 启动 FrontendLauncherThread                    │
│  │   ├─ 阻塞等待编译/启动 (如配置)                     │
│  │   └─ 获取 static_mount 配置                         │
│  │                                                       │
│  ├─ Phase 2: 配置 RPC v2                                │
│  │   ├─ 将 static_mount 添加到 RPC 配置                │
│  │   ├─ 创建 LauncherConfig                            │
│  │   │   services = {                                   │
│  │   │     'rpc_v2': {                                  │
│  │   │       'static_mounts': [static_mount],  ←─ 自动  │
│  │   │       'fastapi_routers': [...]                   │
│  │   │     }                                             │
│  │   │   }                                               │
│  │   └─ 启动 ServiceLauncher                            │
│  │                                                       │
│  └─ Phase 3: 启动 UI                                    │
│      └─ WebView 加载相应 URL                            │
└────────────────────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│  RPC v2 (pycore 后端服务)                              │
│  ├─ 接收 static_mounts 配置                             │
│  ├─ 挂载静态文件到 FastAPI                              │
│  └─ 提供 HTTP/WebSocket 服务                           │
└────────────────────────────────────────────────────────┘
```

---

## 💡 详细实现方案

### 步骤 1: 扩展 NativeUIConfig

**文件**: `pycore/pyutils/native_ui/step1_config/app_config.py`

**新增字段**:
```python
@dataclass
class NativeUIConfig:
    # ... 现有字段 ...

    # ========== RPC v2 配置（新增）==========
    rpc_enabled: bool = False
    """是否启用 RPC v2 服务"""

    rpc_port: int = 8000
    """RPC v2 服务端口"""

    rpc_host: str = "0.0.0.0"
    """RPC v2 监听地址"""

    rpc_debug: bool = True
    """RPC v2 调试模式"""

    rpc_routers: List[Any] = field(default_factory=list)
    """FastAPI 路由列表"""

    rpc_allow_origins: List[str] = field(default_factory=lambda: ["*"])
    """CORS 允许的源"""

    # ========== 前端配置（已有）==========
    frontend_enabled: bool = False
    frontend_framework: Optional[str] = None
    frontend_app_dir: Optional[Path] = None
    frontend_mode: str = "production"
    # ...
```

### 步骤 2: 修改 launch_native_app 逻辑

**文件**: `pycore/pyutils/native_ui/step3_launcher/launch_native_app.py`

**新增 Phase**: 集成 RPC v2 和前端

```python
def launch_native_app(config: NativeUIConfig) -> None:
    """启动 Native UI 应用（集成版）"""

    # ... 现有 Phase 1-4 ...

    # ========== Phase 4.6: 启动前端（如果启用）==========
    frontend_thread = None
    frontend_static_mount = None

    if config.frontend_enabled:
        frontend_thread = _start_frontend(config)

        # 获取静态文件挂载配置（生产模式）
        if frontend_thread and config.frontend_mode == "production":
            frontend_static_mount = frontend_thread.get_static_mount()
            if frontend_static_mount:
                ColorPrint.print_info(
                    f"[NativeLauncher] Frontend static mount ready: "
                    f"{frontend_static_mount['directory']}"
                )

        # 更新 URL（dev 模式）
        if frontend_thread and config.frontend_mode == "dev":
            final_url = f"http://localhost:{config.frontend_port}"
            ColorPrint.cyan(f"[NativeLauncher] Updated URL to dev server: {final_url}")

    # ========== Phase 4.7: 配置并启动 RPC v2（如果启用）==========
    if config.rpc_enabled:
        _start_rpc_v2_service(config, frontend_static_mount)

    # ... 现有 Phase 5+ ...
```

**新增函数**: `_start_rpc_v2_service`

```python
def _start_rpc_v2_service(
    config: NativeUIConfig,
    frontend_static_mount: Optional[dict]
) -> None:
    """
    启动 RPC v2 服务

    Args:
        config: Native UI 配置
        frontend_static_mount: 前端静态文件挂载配置（可选）
    """
    from pycore.pylauncher import LauncherConfig, ServiceLauncher

    # 构建 static_mounts
    static_mounts = []
    if frontend_static_mount:
        static_mounts.append(frontend_static_mount)
        ColorPrint.print_info(
            f"[NativeLauncher] Will mount frontend: {frontend_static_mount['url_prefix']} "
            f"-> {frontend_static_mount['directory']}"
        )

    # 构建 RPC v2 配置
    rpc_v2_config = {
        'port': config.rpc_port,
        'host': config.rpc_host,
        'debug': config.rpc_debug,
        'allow_origins': config.rpc_allow_origins,
        'fastapi_routers': config.rpc_routers,
        'static_mounts': static_mounts
    }

    # 创建 LauncherConfig
    launcher_config = LauncherConfig(
        app_id=config.app_id,
        app_name=config.app_name,
        singleton=True,
        services={
            'heartbeat': {},
            'rpc_v2': rpc_v2_config
        }
    )

    # 启动服务
    launcher = ServiceLauncher(launcher_config)
    success = launcher.start()

    if success:
        ColorPrint.print_info(f"[NativeLauncher] RPC v2 service started on {config.rpc_host}:{config.rpc_port}")
        if frontend_static_mount:
            ColorPrint.print_info(f"[NativeLauncher] Frontend URL: http://localhost:{config.rpc_port}/")
    else:
        ColorPrint.print_error("[NativeLauncher] Failed to start RPC v2 service")
```

### 步骤 3: 修改 Matrix 应用

**文件**: `pyapps/matrix/matrix_main.py`

**简化为**:

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Matrix Application - Integrated with Native UI"""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore.pyutils.native_ui import NativeUIConfig, launch_native_app
from pyapps.matrix.matrix_config import Config

def start():
    """使用 native_ui 集成方式启动 Matrix"""

    # 导入 Matrix API routers
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

    # 配置
    config = NativeUIConfig(
        # ========== 基本配置 ==========
        app_id="matrix",
        app_name="星灿传媒-云矩阵",
        main_entry=matrix_main_entry,  # 主逻辑入口

        # ========== 前端配置（集成）==========
        frontend_enabled=True,
        frontend_framework="nuxt",  # 或 "vite" for React
        frontend_app_dir=PROJECT_ROOT / "poly_apps" / "nuxt_main",
        frontend_mode=Config.FRONTEND_MODE,
        frontend_port=Config.FRONTEND_PORT,
        frontend_auto_install=True,
        frontend_skip_build=Config.FRONTEND_SKIP_BUILD,
        frontend_block_until_ready=True,  # 阻塞等待编译

        # ========== RPC v2 配置（集成）==========
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

        # ========== UI 配置 ==========
        window_size=(1400, 900),
        frameless=True,
        show_on_start=True,
        icon_path=str(PROJECT_ROOT / "pyapps" / "matrix" / "resources" / "icon.ico"),
        logo_path=str(PROJECT_ROOT / "pyapps" / "matrix" / "resources" / "logo.png"),

        # ========== 系统托盘 ==========
        enable_tray=True,
        tray_menu_items=[
            {"text": "打开前端", "callback": open_frontend},
            {"text": "打开API文档", "callback": open_api_docs},
            {"text": "退出", "callback": exit_app}
        ],

        # ========== 调试 ==========
        debug=True,
        project_root=PROJECT_ROOT,
    )

    # 一步启动（前端+RPC+UI+托盘）
    launch_native_app(config)


def matrix_main_entry():
    """Matrix 主逻辑"""
    from pyapps.matrix.controller.event_handlers import register_matrix_event_handlers
    from pycore import THREAD_BUS
    import time

    # 注册事件处理器
    register_matrix_event_handlers(
        frontend_port=Config.FRONTEND_PORT,
        backend_port=Config.WEB_PORT,
        backend_host=Config.WEB_HOST,
        frontend_mode=Config.FRONTEND_MODE
    )

    # 保持运行
    while not THREAD_BUS.is_shutdown_requested():
        time.sleep(1)


def open_frontend():
    """打开前端"""
    import webbrowser
    webbrowser.open(f"http://localhost:{Config.WEB_PORT}")


def open_api_docs():
    """打开 API 文档"""
    import webbrowser
    webbrowser.open(f"http://localhost:{Config.WEB_PORT}/docs")


def exit_app():
    """退出应用"""
    from pycore import THREAD_BUS
    THREAD_BUS.request_shutdown(reason="User requested exit")


if __name__ == '__main__':
    start()
```

**删除的文件**:
- `pyapps/matrix/controller/frontend_compiler.py` ❌（不再需要）
- `pyapps/matrix/controller/launcher_builder.py` ❌（不再需要）

**保留的文件**:
- `pyapps/matrix/controller/event_handlers.py` ✅

---

## 📊 新旧架构对比

### 旧架构

```python
# matrix_main.py (70+ 行)
compile_frontend_if_needed()  # 手动编译
launcher_config = build_matrix_launcher_config()  # 手动配置
launcher = ServiceLauncher(launcher_config)
launcher.start()
register_matrix_event_handlers()

# launcher_builder.py (200+ 行)
def build_matrix_launcher_config():
    # 手动创建 NuxtLauncher
    # 手动获取 static_dir
    # 手动构建 static_mounts
    # 手动构建 services 配置
    # ...

# frontend_compiler.py (80+ 行)
def compile_frontend_if_needed():
    # 手动创建 NuxtLauncher
    # 手动调用 prepare_build()
    # ...
```

**总代码行数**: ~350 行（分散在 3 个文件）

### 新架构

```python
# matrix_main.py (120 行)
config = NativeUIConfig(
    frontend_enabled=True,
    frontend_framework='nuxt',
    rpc_enabled=True,
    rpc_routers=[...],
    # ... 所有配置
)
launch_native_app(config)

# native_ui 内部处理：
# - 前端编译/启动
# - RPC v2 配置和启动
# - UI 创建
# - 托盘管理
```

**总代码行数**: ~120 行（1 个文件）

**优势**:
- ✅ 代码减少 66%
- ✅ 职责清晰
- ✅ 易于维护
- ✅ 符合规范

---

## 🔄 迁移步骤

### 1. 扩展 NativeUIConfig（已完成）

```bash
# 已在前面实现
pycore/pyutils/native_ui/step1_config/app_config.py
```

### 2. 修改 launch_native_app

```bash
# 需要实现
pycore/pyutils/native_ui/step3_launcher/launch_native_app.py
```

**新增**:
- `_start_rpc_v2_service()` 函数
- Phase 4.7 逻辑

### 3. 修改 Matrix 应用

```bash
# 需要修改
pyapps/matrix/matrix_main.py
```

**修改**:
- 使用 `NativeUIConfig` 配置所有
- 删除手动编译代码
- 删除手动配置构建代码

**删除文件**:
```bash
pyapps/matrix/controller/frontend_compiler.py
pyapps/matrix/controller/launcher_builder.py
```

### 4. 测试验证

```bash
python pymain.py app=matrix
```

**检查**:
- ✅ 前端是否自动编译（首次）
- ✅ RPC v2 是否启动（8000 端口）
- ✅ 静态文件是否挂载（http://localhost:8000/）
- ✅ WebView 是否正常显示
- ✅ 托盘是否正常工作

---

## ⚙️ 配置示例

### 生产模式（默认）

```python
config = NativeUIConfig(
    # 前端
    frontend_enabled=True,
    frontend_framework='nuxt',
    frontend_mode='production',  # 编译模式
    frontend_skip_build=False,  # 确保构建
    frontend_block_until_ready=True,  # 阻塞等待

    # RPC
    rpc_enabled=True,
    rpc_port=8000,
    rpc_routers=[...],
)

# 启动流程：
# 1. 检查 .output/public/ 是否存在
# 2. 如不存在 → 运行 npm run build（阻塞）
# 3. 启动 RPC v2，挂载 .output/public/ 到 /
# 4. WebView 加载 http://localhost:8000/
```

### 开发模式

```python
config = NativeUIConfig(
    # 前端
    frontend_enabled=True,
    frontend_framework='nuxt',
    frontend_mode='dev',  # dev server 模式
    frontend_port=3000,
    frontend_block_until_ready=True,  # 阻塞等待 dev server

    # RPC
    rpc_enabled=True,
    rpc_port=8000,
    rpc_routers=[...],
)

# 启动流程：
# 1. 启动 npm run dev（阻塞等待就绪）
# 2. 启动 RPC v2（不挂载静态文件）
# 3. WebView 加载 http://localhost:3000/ (直连 dev server)
```

### 仅 RPC 模式（无前端）

```python
config = NativeUIConfig(
    # 前端
    frontend_enabled=False,  # 不启动前端

    # RPC
    rpc_enabled=True,
    rpc_port=8000,
    rpc_routers=[...],

    # UI
    url="http://localhost:8000/docs",  # 加载 API 文档
)
```

---

## 🎯 核心优势

### 1. 统一管理
- **native_ui** 统一管理前端和 RPC
- 代码集中，易于维护
- 符合 pycore 规范

### 2. 简化应用层
- Matrix 只需配置，不需手动处理
- 从 350 行 → 120 行
- 删除 2 个控制器文件

### 3. 灵活配置
- 支持生产/开发模式
- 支持多种前端框架
- 支持独立 RPC 模式

### 4. 自动化
- 自动编译前端
- 自动配置挂载
- 自动阻塞等待

### 5. 错误处理
- 前端编译失败 → 阻塞并报错
- RPC 启动失败 → 清晰提示
- 静态文件不存在 → 警告

---

## 📝 开发规范遵循

### ✅ 符合 PYTHON_PYCORE.md

1. **职责分离**
   - ✅ pyutils 管理工具（native_ui, rpc_v2）
   - ✅ pyapps 使用工具（matrix）

2. **避免重复**
   - ✅ 不在应用层重新实现前端管理
   - ✅ 复用 native_ui 的 step9_frontend

3. **统一导出**
   - ✅ native_ui 导出统一的 API
   - ✅ 应用层通过配置使用

4. **错误处理**
   - ✅ 使用 ColorPrint 而非 Exception
   - ✅ AI 代码不使用 try-except

---

## 🚀 下一步行动

### Phase 1: 实现 RPC 集成（优先）
- [ ] 修改 `NativeUIConfig`（已完成）
- [ ] 修改 `launch_native_app.py`
  - [ ] 新增 `_start_rpc_v2_service()`
  - [ ] 新增 Phase 4.7
  - [ ] 传递 `frontend_static_mount`

### Phase 2: 重构 Matrix（优先）
- [ ] 修改 `matrix_main.py`
- [ ] 删除 `frontend_compiler.py`
- [ ] 删除 `launcher_builder.py`
- [ ] 保留 `event_handlers.py`

### Phase 3: 测试验证
- [ ] 测试生产模式启动
- [ ] 测试开发模式启动
- [ ] 测试前端编译阻塞
- [ ] 测试静态文件挂载

### Phase 4: 文档更新
- [ ] 更新 Matrix README
- [ ] 更新 native_ui 文档
- [ ] 添加迁移指南

---

## 📞 FAQ

### Q1: RPC v2 必须和 native_ui 一起用吗？

**A**: 不是。两种模式：

**模式 1: 集成模式（推荐）**
```python
config = NativeUIConfig(
    frontend_enabled=True,
    rpc_enabled=True,  # native_ui 管理 RPC
    rpc_routers=[...],
)
launch_native_app(config)
```

**模式 2: 独立模式**
```python
# 自己管理 RPC v2
from pycore.pylauncher import LauncherConfig, ServiceLauncher

launcher_config = LauncherConfig(
    services={'rpc_v2': {...}}
)
ServiceLauncher(launcher_config).start()
```

### Q2: 可以不启动前端，只用 RPC v2 吗？

**A**: 可以。

```python
config = NativeUIConfig(
    frontend_enabled=False,  # 不启动前端
    rpc_enabled=True,  # 只启动 RPC
    rpc_routers=[...],
    url="http://localhost:8000/docs",  # UI 加载 API 文档
)
```

### Q3: 如何自定义静态文件挂载路径？

**A**: 通过 `frontend_static_dir`：

```python
config = NativeUIConfig(
    frontend_enabled=True,
    frontend_framework='vite',
    frontend_app_dir='custom/path',
    # 前端自动提供挂载配置
)
```

或手动添加额外挂载：

```python
config = NativeUIConfig(
    rpc_enabled=True,
    rpc_routers=[...],
)

# 在 launch_native_app 前手动添加
# (需要扩展 API)
```

---

**方案版本**: v1.0
**最后更新**: 2025-12-07
**作者**: Claude Code
