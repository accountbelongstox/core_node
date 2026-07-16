# Step 9: Integrated Frontend Launcher

## 概述

`step9_frontend` 是 `native_ui` 的集成前端启动模块，提供了统一的前端项目管理和启动功能。

**主要特性：**
- ✅ 支持多种前端框架（React, Vue, Nuxt, Next.js, React Native, Vite, Nexus）
- ✅ 自动依赖安装（pnpm install）
- ✅ 智能构建检测（仅在源码更新时重新构建）
- ✅ Dev 模式和 Production 模式
- ✅ HTTP 健康检查
- ✅ Debug 模式阻塞等待
- ✅ 单独线程运行（不阻塞主线程）
- ✅ 完整的错误处理

---

## 架构设计

### 核心组件

```
step9_frontend/
├── __init__.py              # 模块导出
├── frontend_config.py       # 配置类
├── frontend_thread.py       # 线程实现
├── frontend_starter.py      # 启动辅助函数
└── README.md               # 本文档
```

### 调用流程

```
NativeUIConfig (frontend_enabled=True)
  ↓
launch_native_app()
  ↓
_start_frontend()
  ↓
FrontendLauncherThread.start()
  ├── _ensure_dependencies()      # 自动安装依赖
  ├── _handle_production_mode()   # 生产模式：构建
  │   ├── _should_run_build()     # 智能构建检测
  │   ├── _run_build()            # 执行构建
  │   └── 验证输出目录
  └── _handle_dev_mode()          # 开发模式：启动dev server
      ├── _resolve_dev_command()  # 解析dev命令
      └── _wait_for_http()        # HTTP 健康检查
```

---

## 使用方式

### 方式 1: 通过 NativeUIConfig（推荐）

```python
from pathlib import Path
from pycore.pyutils.native_ui import NativeUIConfig, launch_native_app

def main():
    """启动带前端的 Native UI 应用"""
    config = NativeUIConfig(
        # 基本配置
        app_id="matrix",
        app_name="Matrix Application",
        main_entry=main_app_entry,

        # 前端配置（集成）
        frontend_enabled=True,
        frontend_framework="vite",  # react|vue|nuxt|next|react-native|nexus
        frontend_app_dir="poly_apps/matrix_ui_react",
        frontend_mode="production",  # dev|production
        frontend_port=3000,
        frontend_auto_install=True,
        frontend_skip_build=False,
        frontend_block_until_ready=True,  # Debug模式阻塞等待

        # UI 配置
        window_size=(1400, 900),
        frameless=True,
        show_on_start=True,
    )

    launch_native_app(config)

def main_app_entry():
    """应用主逻辑"""
    print("App is running...")
```

### 方式 2: 直接使用 Frontend API

```python
from pathlib import Path
from pycore.pyutils.native_ui.step9_frontend import (
    FrontendConfig,
    start_frontend_if_needed
)

# 配置前端
frontend_config = FrontendConfig(
    enabled=True,
    framework="vite",
    app_dir=Path("poly_apps/matrix_ui_react"),
    mode="production",
    port=3000,
    auto_install=True,
    block_until_ready=True,  # 阻塞等待前端就绪
)

# 启动前端
frontend_thread = start_frontend_if_needed(frontend_config)

if frontend_thread and frontend_thread.is_ready():
    print(f"Frontend ready at: {frontend_thread.get_url()}")

    # 获取静态文件挂载配置（生产模式）
    mount = frontend_thread.get_static_mount()
    if mount:
        print(f"Static mount: {mount}")
```

---

## 支持的框架

### 1. React (Create React App)

```python
frontend_framework="react"
frontend_app_dir="poly_apps/my_react_app"

# Dev命令: npm run start
# Build命令: npm run build
# 输出目录: dist/
```

### 2. React + Vite

```python
frontend_framework="vite"
frontend_app_dir="poly_apps/matrix_ui_react"

# Dev命令: npx vite dev --host 0.0.0.0 --port 3000
# Build命令: npx vite build
# 输出目录: dist/
```

### 3. Vue.js

```python
frontend_framework="vue"
frontend_app_dir="poly_apps/my_vue_app"

# Dev命令: npm run serve -- --host 0.0.0.0 --port 3000
# Build命令: npm run build
# 输出目录: dist/
```

### 4. Nuxt.js

```python
frontend_framework="nuxt"
frontend_app_dir="poly_apps/my_nuxt_app"

# Dev命令: npx nuxi dev --hostname 0.0.0.0 --port 3000
# Build命令: npx nuxi build
# 输出目录: .output/public/
```

### 5. Next.js

```python
frontend_framework="next"
frontend_app_dir="poly_apps/my_next_app"

# Dev命令: npx next dev -H 0.0.0.0 -p 3000
# Build命令: npx next build
# 输出目录: .next/static/
```

### 6. React Native (Expo Web)

```python
frontend_framework="react-native"
frontend_app_dir="poly_apps/my_rn_app"

# Dev命令: npx expo start --web --port 3000
# Build命令: npx expo export:web
# 输出目录: web-build/
```

### 7. Nexus (假设的框架)

```python
frontend_framework="nexus"
frontend_app_dir="poly_apps/my_nexus_app"

# Dev命令: npx nexus dev --host 0.0.0.0 --port 3000
# Build命令: npx nexus build
# 输出目录: .next/static/
```

---

## 配置参数详解

### FrontendConfig

```python
@dataclass
class FrontendConfig:
    # 核心配置
    enabled: bool = False                    # 是否启用前端服务
    framework: Literal[...] = "vite"         # 前端框架类型
    app_dir: Optional[Path] = None           # 前端项目目录
    mode: Literal["dev", "production"] = "production"  # 运行模式

    # 网络配置
    port: int = 3000                         # Dev server 端口
    host: str = "0.0.0.0"                    # Dev server 监听地址

    # 构建配置
    auto_install: bool = True                # 自动安装依赖
    skip_build: bool = False                 # 跳过构建（生产模式）
    force_rebuild: bool = False              # 强制重新构建
    smart_build: bool = True                 # 智能构建（仅源码更新时）

    # 自定义命令（可选）
    dev_command: Optional[List[str]] = None      # 自定义dev命令
    build_command: Optional[List[str]] = None    # 自定义build命令
    install_command: Optional[List[str]] = None  # 自定义install命令

    # 输出目录
    static_dir: Optional[Path] = None        # 静态文件目录（自动检测）
    output_dir: Optional[Path] = None        # 输出目录（自动检测）

    # 健康检查
    health_path: str = "/"                   # HTTP 健康检查路径
    health_check_timeout: int = 120          # 健康检查超时（秒）

    # 调试配置
    show_output: bool = True                 # 显示前端进程输出
    block_until_ready: bool = False          # 阻塞等待前端就绪
```

### NativeUIConfig 前端配置字段

```python
@dataclass
class NativeUIConfig:
    # ... 其他配置 ...

    # 前端管理
    frontend_enabled: bool = False
    frontend_framework: Optional[str] = None
    frontend_app_dir: Optional[Path] = None
    frontend_mode: str = "production"
    frontend_port: int = 3000
    frontend_auto_install: bool = True
    frontend_skip_build: bool = False
    frontend_block_until_ready: bool = False
```

---

## 工作模式

### Production 模式（推荐）

**特点：**
- 执行生产构建（`npm run build`）
- 生成静态文件（dist/）
- 可挂载到 FastAPI 服务器
- 智能构建：仅在源码更新时重新构建
- 性能最佳

**流程：**
```
1. 检查 node_modules/ 是否存在
   └─ 不存在 → 运行 pnpm install

2. 检查是否需要构建
   ├─ force_rebuild=True → 强制构建
   ├─ skip_build=True → 跳过构建
   └─ smart_build=True → 比较源码和输出时间

3. 执行构建（如需要）
   └─ 运行 npm run build

4. 验证输出目录
   ├─ 检查 output_dir/
   └─ 检查 static_dir/

5. 返回静态文件挂载配置
```

**示例：**
```python
config = FrontendConfig(
    enabled=True,
    framework="vite",
    app_dir=Path("poly_apps/matrix_ui_react"),
    mode="production",
    auto_install=True,
    smart_build=True,
)

frontend = start_frontend_if_needed(config)

# 获取静态文件挂载配置（用于FastAPI）
mount = frontend.get_static_mount()
# {
#     'url_prefix': '/',
#     'directory': '/path/to/dist',
#     'name': 'vite-frontend'
# }
```

### Dev 模式

**特点：**
- 启动前端开发服务器
- 支持热模块替换（HMR）
- 实时代码更新
- 适合开发调试

**流程：**
```
1. 检查并安装依赖（如需要）

2. 启动 dev server
   └─ 运行 npm run dev（或框架特定命令）

3. HTTP 健康检查
   ├─ 每2秒检查一次
   ├─ 最长等待 health_check_timeout 秒
   └─ 成功 → 标记为 ready

4. 保持线程运行
   └─ 监听 dev server 进程
```

**示例：**
```python
config = FrontendConfig(
    enabled=True,
    framework="vite",
    app_dir=Path("poly_apps/matrix_ui_react"),
    mode="dev",
    port=3000,
    block_until_ready=True,  # 阻塞等待
)

frontend = start_frontend_if_needed(config)

if frontend.is_ready():
    print(f"Dev server ready at: {frontend.get_url()}")
    # 输出: Dev server ready at: http://localhost:3000
```

---

## Debug 模式阻塞等待

### 使用场景

在开发调试时，你可能希望程序等待前端完全启动后再继续：

```python
config = NativeUIConfig(
    # ... 其他配置 ...

    frontend_enabled=True,
    frontend_framework="vite",
    frontend_app_dir="poly_apps/matrix_ui_react",
    frontend_mode="dev",
    frontend_block_until_ready=True,  # 🔥 关键：阻塞等待

    debug=True,  # 启用调试输出
)

launch_native_app(config)

# 程序会在这里等待，直到前端就绪
# 输出：
# [Frontend] ========================================
# [Frontend] STARTING FRONTEND SERVICE
# [Frontend] ========================================
# [Frontend] Framework: vite
# [Frontend] Mode: dev
# ...
# [FrontendThread] Waiting for frontend at http://localhost:3000
# [FrontendThread] Frontend ready at http://localhost:3000
# [Frontend] ========================================
# [Frontend] FRONTEND READY
# [Frontend] ========================================
# [Frontend] Dev URL: http://localhost:3000
```

### 实现原理

```python
class FrontendLauncherThread(threading.Thread):
    def __init__(self, config: FrontendConfig):
        self.ready_event = threading.Event()
        self.error_event = threading.Event()

    def run(self):
        # ... 启动前端 ...
        self.ready = True
        self.ready_event.set()  # 🔥 信号：前端已就绪

    def wait_for_ready(self, timeout: float) -> bool:
        """阻塞等待前端就绪"""
        return self.ready_event.wait(timeout=timeout)

# 使用
frontend.start()  # 启动线程（非阻塞）
frontend.wait_for_ready(timeout=120)  # 阻塞等待（最长120秒）
```

---

## 自动依赖安装

### 触发条件

自动运行 `pnpm install` 的情况：

1. **node_modules/ 不存在**
2. **pnpm-lock.yaml 更新**（比 node_modules/ 新）

### Installation流程

```python
def _ensure_dependencies(self) -> bool:
    """确保依赖已安装"""
    node_modules = self.config.app_dir / "node_modules"
    package_json = self.config.app_dir / "package.json"

    # 1. 检查 package.json
    if not package_json.exists():
        return True  # 无 package.json，跳过

    # 2. 检查 node_modules
    if not node_modules.exists():
        return self._run_install()  # 不存在，安装

    # 3. 检查 lock 文件是否更新
    lock_file = self.config.app_dir / "pnpm-lock.yaml"
    if lock_file.exists():
        if lock_file.stat().st_mtime > node_modules.stat().st_mtime:
            return self._run_install()  # Lock更新，重新安装

    # 4. 依赖已是最新
    return True
```

### 自定义安装命令

```python
config = FrontendConfig(
    # ... 其他配置 ...

    auto_install=True,
    install_command=["npm", "install"],  # 使用 npm 而不是 pnpm
)
```

---

## 智能构建检测

### 原理

仅在必要时重新构建，避免浪费时间：

```python
def _should_run_build(self) -> bool:
    """是否需要构建"""

    # 1. 强制重新构建
    if self.config.force_rebuild:
        return True

    # 2. 跳过构建
    if self.config.skip_build:
        return False

    # 3. 输出不存在
    if not self.config.output_dir.exists():
        return True

    # 4. 智能检测（比较源码和输出时间）
    if self.config.smart_build:
        src_dir = self.config.app_dir / "src"
        if src_dir.exists():
            # 找到最新的源文件
            src_mtime = max(
                f.stat().st_mtime
                for f in src_dir.rglob("*")
                if f.is_file()
            )
            # 输出目录的修改时间
            output_mtime = self.config.output_dir.stat().st_mtime

            # 源码更新了吗？
            if src_mtime <= output_mtime:
                return False  # 源码没更新，不需要构建

    return True
```

### 配置选项

```python
# 场景 1: 总是重新构建（CI/CD）
config = FrontendConfig(
    force_rebuild=True,
    smart_build=False,
)

# 场景 2: 使用现有构建（快速启动）
config = FrontendConfig(
    skip_build=True,
)

# 场景 3: 智能构建（推荐）
config = FrontendConfig(
    smart_build=True,  # 默认值
    force_rebuild=False,
    skip_build=False,
)
```

---

## 线程管理

### Design Principles

遵循 pycore 规范：

1. **直接继承 threading.Thread**
2. **使用 daemon=True**
3. **不使用 try-except**（AI 代码规则）
4. **使用 Event 进行同步**

### 线程生命周期

```python
class FrontendLauncherThread(threading.Thread):
    def __init__(self, config, daemon=True):
        super().__init__(name="FrontendLauncher-vite", daemon=daemon)
        self.ready_event = threading.Event()
        self.error_event = threading.Event()
        self.running = False

    def start(self):
        """启动线程（非阻塞）"""
        self.running = True
        super().start()

    def run(self):
        """线程执行（在单独线程中）"""
        # 1. 安装依赖
        # 2. 启动前端
        # 3. 设置 ready_event
        self.ready = True
        self.ready_event.set()

        # 4. 保持运行（dev模式）
        if self.process:
            self.process.wait()

    def stop(self):
        """停止线程"""
        if self.process:
            self.process.terminate()
        self.running = False

    def wait_for_ready(self, timeout=120) -> bool:
        """阻塞等待（主线程）"""
        return self.ready_event.wait(timeout=timeout)
```

### 使用示例

```python
# 1. 创建线程
thread = FrontendLauncherThread(config=frontend_config, daemon=True)

# 2. 启动（非阻塞）
thread.start()

# 3. 等待就绪（阻塞）
if thread.wait_for_ready(timeout=120):
    print("Frontend ready!")
else:
    print("Frontend failed to start")

# 4. 检查状态
if thread.is_ready():
    url = thread.get_url()

# 5. 停止
thread.stop()
```

---

## Error Handling

### 错误类型

```python
# 1. 配置错误
if not config.app_dir:
    raise ValueError("app_dir is required")

# 2. 依赖安装失败
if not self._run_install():
    self.error_message = "pnpm install failed"
    self.error_event.set()
    return

# 3. 构建失败
if process.returncode != 0:
    self.error_message = f"Build failed with exit code {process.returncode}"
    return False

# 4. 健康检查超时
if time.time() >= deadline:
    self.error_message = "Frontend health check timeout"
    return False
```

### 错误检查

```python
thread = start_frontend_if_needed(config)

if thread:
    # 方式 1: 检查错误标志
    if thread.has_error():
        print(f"Error: {thread.error_message}")

    # 方式 2: 检查就绪状态
    if not thread.is_ready():
        print("Frontend not ready")

    # 方式 3: 等待并检查
    if not thread.wait_for_ready(timeout=120):
        print("Timeout or error")
```

---

## 集成示例

### 完整的 Matrix 应用

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Matrix Application with Integrated Frontend
"""

from pathlib import Path
from pycore.pyutils.native_ui import NativeUIConfig, launch_native_app

def main():
    """Matrix 主函数"""

    # 获取项目根目录
    project_root = Path(__file__).parent.parent.parent

    # 配置
    config = NativeUIConfig(
        # ========== 应用基本信息 ==========
        app_id="matrix",
        app_name="Matrix Cloud Platform",
        main_entry=matrix_main_entry,

        # ========== 前端配置（集成） ==========
        frontend_enabled=True,
        frontend_framework="vite",
        frontend_app_dir=project_root / "poly_apps" / "matrix_ui_react",
        frontend_mode="production",
        frontend_port=3000,
        frontend_auto_install=True,
        frontend_skip_build=False,
        frontend_block_until_ready=True,  # Debug模式阻塞

        # ========== UI 配置 ==========
        window_size=(1400, 900),
        frameless=True,
        show_on_start=True,
        icon_path=str(project_root / "pyapps" / "matrix" / "resources" / "icon.ico"),

        # ========== 系统托盘 ==========
        enable_tray=True,
        tray_menu_items=[
            {"text": "Open Frontend", "callback": open_frontend},
            {"text": "Exit", "callback": exit_app}
        ],

        # ========== 调试 ==========
        debug=True,
        project_root=project_root,
    )

    # 启动应用
    launch_native_app(config)


def matrix_main_entry():
    """Matrix 主逻辑"""
    print("Matrix application started!")

    # 启动 RPC 服务器
    # ...

    # 注册业务逻辑
    # ...


def open_frontend():
    """打开前端页面"""
    import webbrowser
    webbrowser.open("http://localhost:8000")


def exit_app():
    """退出应用"""
    import sys
    sys.exit(0)


if __name__ == "__main__":
    main()
```

---

## Performance优化

### 1. 使用智能构建

```python
config = FrontendConfig(
    smart_build=True,  # 默认启用
)

# 首次启动：构建（~30秒）
# 后续启动：跳过构建（<1秒）
```

### 2. 跳过构建（快速启动）

```python
config = FrontendConfig(
    skip_build=True,  # 使用现有构建
)

# 启动时间：<1秒
# 适用场景：开发测试，频繁重启
```

### 3. 非阻塞启动

```python
config = FrontendConfig(
    block_until_ready=False,  # 非阻塞
)

# 主程序立即继续执行
# 前端在后台启动
```

### 4. 使用 Dev 模式

```python
config = FrontendConfig(
    mode="dev",  # 开发模式
)

# 优势：
# - 热模块替换（HMR）
# - 实时更新
# - 无需重新构建
```

---

## 常见问题

### Q1: 前端无法启动？

**检查清单：**
1. `app_dir` 是否存在
2. `package.json` 是否存在
3. `node_modules/` 是否已安装
4. 端口是否被占用
5. 命令是否正确

**解决方案：**
```python
config = FrontendConfig(
    enabled=True,
    framework="vite",
    app_dir=Path("poly_apps/matrix_ui_react").resolve(),  # 使用绝对路径
    auto_install=True,  # 自动安装依赖
    show_output=True,   # 显示输出
    debug=True,  # 启用调试
)
```

### Q2: 构建失败？

**检查：**
- 源码是否有错误
- 依赖是否正确安装
- 构建命令是否正确

**手动测试：**
```bash
cd poly_apps/matrix_ui_react
npm run build
```

### Q3: 健康检查超时？

**原因：**
- Dev server 启动慢
- 端口被占用
- 防火墙阻止

**解决：**
```python
config = FrontendConfig(
    health_check_timeout=300,  # 增加超时时间
    port=3001,  # 尝试不同端口
)
```

### Q4: 如何自定义命令？

```python
config = FrontendConfig(
    framework="vite",
    dev_command=["pnpm", "run", "dev", "--host", "0.0.0.0"],
    build_command=["pnpm", "run", "build"],
    install_command=["pnpm", "install", "--frozen-lockfile"],
)
```

---

## 总结

`step9_frontend` 提供了完整的前端启动解决方案：

✅ **易用性**: 一行配置即可集成
✅ **功能完整**: 支持主流框架和模式
✅ **智能化**: 自动安装、智能构建
✅ **可靠性**: 完整错误处理和健康检查
✅ **性能**: 智能构建节省时间
✅ **符合规范**: 遵循 pycore 架构标准

**推荐使用场景：**
- 桌面应用 + Web UI
- 开发工具 + 管理界面
- 本地服务 + 前端控制台

**下一步：**
- 查看 `../README.md` 了解完整 native_ui 架构
- 查看示例项目：`pyapps/matrix/`
- 阅读开发规范：`development-guides/PYTHON_PYCORE.md`
