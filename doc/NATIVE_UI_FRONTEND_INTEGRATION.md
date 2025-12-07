# Native UI Frontend Integration 总结文档

## 📋 概述

本次重构将 `frontend_launcher` 功能完全集成到 `native_ui` 模块中，作为 `step9_frontend` 子模块。外部调用者无需再直接使用 `frontend_launcher`，所有前端管理由 `native_ui` 内部处理。

**重构日期**: 2025-12-07
**架构标准**: 遵循 `development-guides/PYTHON_PYCORE.md`

---

## 🎯 主要改动

### 1. 新增模块：`step9_frontend`

**位置**: `pycore/pyutils/native_ui/step9_frontend/`

**文件结构**:
```
step9_frontend/
├── __init__.py              # 模块导出
├── frontend_config.py       # 前端配置类
├── frontend_thread.py       # 线程实现（继承 threading.Thread）
├── frontend_starter.py      # 启动辅助函数
└── README.md               # 详细使用文档
```

### 2. 扩展 `NativeUIConfig`

**文件**: `pycore/pyutils/native_ui/step1_config/app_config.py`

**新增字段**:
```python
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

### 3. 修改 `launch_native_app`

**文件**: `pycore/pyutils/native_ui/step3_launcher/launch_native_app.py`

**新增逻辑**:
- Phase 4.6: 启动前端服务（如果启用）
- 自动更新 `final_url`（dev 模式）
- 阻塞等待前端就绪（可选）

### 4. 更新 `native_ui` 导出

**文件**: `pycore/pyutils/native_ui/__init__.py`

**新增导出**:
```python
from pycore.pyutils.native_ui.step9_frontend import (
    FrontendConfig,
    FrontendLauncherThread,
    start_frontend_if_needed
)
```

---

## ✨ 新功能特性

### 1. 支持的前端框架

- ✅ **React** (Create React App)
- ✅ **React + Vite**
- ✅ **React Native** (Expo Web)
- ✅ **Vue.js**
- ✅ **Nuxt.js**
- ✅ **Next.js**
- ✅ **Nexus**
- ✅ **Vite** (通用)

### 2. 自动依赖管理

- ✅ 自动检测 `node_modules/` 是否存在
- ✅ 自动运行 `pnpm install`（如需要）
- ✅ 检测 `pnpm-lock.yaml` 更新
- ✅ 可自定义安装命令

### 3. 智能构建系统

- ✅ 智能构建检测（仅源码更新时重新构建）
- ✅ 强制重新构建选项
- ✅ 跳过构建选项（使用现有构建）
- ✅ 构建进度实时输出

### 4. Debug 模式阻塞等待

- ✅ 可配置阻塞等待前端就绪
- ✅ HTTP 健康检查（可配置超时）
- ✅ 错误状态检测
- ✅ 详细的日志输出

### 5. 线程管理

- ✅ 单独线程运行（不阻塞主线程）
- ✅ 遵循 pycore 标准（直接继承 threading.Thread）
- ✅ Event 同步机制
- ✅ 优雅停止支持

---

## 🚀 使用方式

### 方式 1: 简化 API（推荐）

```python
from pycore.pyutils.native_ui import NativeUIConfig, launch_native_app
from pathlib import Path

def main():
    """启动带前端的 Native UI 应用"""
    project_root = Path(__file__).parent.parent

    config = NativeUIConfig(
        # 基本配置
        app_id="matrix",
        app_name="Matrix Application",
        main_entry=matrix_main_entry,

        # 前端配置（一体化）
        frontend_enabled=True,
        frontend_framework="vite",
        frontend_app_dir=project_root / "poly_apps" / "matrix_ui_react",
        frontend_mode="production",  # dev | production
        frontend_port=3000,
        frontend_auto_install=True,
        frontend_skip_build=False,
        frontend_block_until_ready=True,  # Debug模式阻塞等待

        # UI 配置
        window_size=(1400, 900),
        frameless=True,
        show_on_start=True,
        debug=True,  # 启用调试输出
        project_root=project_root,
    )

    launch_native_app(config)

def matrix_main_entry():
    """应用主逻辑"""
    print("Matrix application started!")
    # 启动 RPC 服务等...
```

### 方式 2: 高级 API

```python
from pathlib import Path
from pycore.pyutils.native_ui.step9_frontend import (
    FrontendConfig,
    start_frontend_if_needed
)

# 直接使用 Frontend API
frontend_config = FrontendConfig(
    enabled=True,
    framework="vite",
    app_dir=Path("poly_apps/matrix_ui_react"),
    mode="production",
    port=3000,
    auto_install=True,
    block_until_ready=True,
)

# 启动前端
frontend_thread = start_frontend_if_needed(frontend_config)

if frontend_thread and frontend_thread.is_ready():
    print(f"Frontend URL: {frontend_thread.get_url()}")

    # 获取静态文件挂载配置（生产模式）
    mount = frontend_thread.get_static_mount()
    # {
    #     'url_prefix': '/',
    #     'directory': '/path/to/dist',
    #     'name': 'vite-frontend'
    # }
```

---

## 📝 配置参数详解

### NativeUIConfig 前端字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `frontend_enabled` | bool | False | 是否启用前端服务 |
| `frontend_framework` | str | None | 前端框架类型 |
| `frontend_app_dir` | Path | None | 前端项目目录 |
| `frontend_mode` | str | "production" | dev 或 production |
| `frontend_port` | int | 3000 | Dev server 端口 |
| `frontend_auto_install` | bool | True | 自动安装依赖 |
| `frontend_skip_build` | bool | False | 跳过构建 |
| `frontend_block_until_ready` | bool | False | 阻塞等待就绪 |

### FrontendConfig 完整字段

详见: `pycore/pyutils/native_ui/step9_frontend/README.md`

---

## 🔧 工作模式

### Production 模式（推荐）

**特点**:
- 执行生产构建 (`npm run build`)
- 生成静态文件
- 可挂载到 FastAPI
- 智能构建（仅源码更新时）

**流程**:
```
1. 检查依赖 → pnpm install（如需要）
2. 检查构建 → npm run build（如需要）
3. 验证输出 → dist/ 目录
4. 返回挂载配置
```

### Dev 模式

**特点**:
- 启动开发服务器
- 热模块替换（HMR）
- 实时代码更新

**流程**:
```
1. 检查依赖 → pnpm install（如需要）
2. 启动 dev server → npm run dev
3. HTTP 健康检查
4. 保持线程运行
```

---

## 🐛 修复的不一致性

### 1. 类型提示修复

**问题**: `launch_native_app.py` 中使用字符串类型提示但未导入

**修复**:
```python
# 添加 TYPE_CHECKING 导入
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from pycore.pyutils.native_ui.step9_frontend import FrontendLauncherThread

def _start_frontend(config: NativeUIConfig) -> Optional['FrontendLauncherThread']:
    ...
```

### 2. ColorPrint 使用风格统一

**问题**: 混用 `ColorPrint.red()` 和 `ColorPrint.print_error()`

**修复**: 统一使用 `print_*` 系列方法
```python
# 修改前
ColorPrint.red("[Error]...")
ColorPrint.green("[Success]...")

# 修改后
ColorPrint.print_error("[Error]...")
ColorPrint.print_info("[Success]...")
```

### 3. 配置验证增强

**问题**: `NativeUIConfig.validate()` 缺少前端配置验证

**修复**: 添加验证逻辑
```python
def validate(self) -> None:
    # ... 其他验证 ...

    # 前端验证
    if self.frontend_enabled:
        if not self.frontend_framework:
            raise ValueError("frontend_framework is required")
        if not self.frontend_app_dir:
            raise ValueError("frontend_app_dir is required")

        valid_frameworks = ("nuxt", "react", "react-native", "vite", "vue", "next", "nexus")
        if self.frontend_framework not in valid_frameworks:
            raise ValueError(f"frontend_framework must be one of: {valid_frameworks}")
```

---

## 📊 架构图

### 调用流程

```
用户代码
  ↓
NativeUIConfig (frontend_enabled=True)
  ↓
launch_native_app()
  ├─ Phase 1: 端口分配
  ├─ Phase 2: URL 处理
  ├─ Phase 3: 回调管理
  ├─ Phase 4: 定时器管理
  ├─ Phase 4.6: 启动前端 ←──────┐
  │    ↓                        │
  │  _start_frontend()         │
  │    ↓                        │
  │  FrontendConfig             │
  │    ↓                        │
  │  FrontendLauncherThread     │ 单独线程
  │    ├─ 安装依赖              │
  │    ├─ 构建/启动 dev server  │
  │    ├─ 健康检查              │
  │    └─ 设置 ready_event ─────┘
  │                             │
  ├─ Phase 5: 单例检测          │
  ├─ Phase 6: UI 创建           │
  └─ 应用运行                   │
                               │
  (可选) 阻塞等待前端就绪 ←─────┘
```

### 目录结构

```
pycore/pyutils/native_ui/
├── step0_i18n/                  # 国际化
├── step1_config/                # 配置（已扩展）
│   └── app_config.py           # NativeUIConfig + frontend 字段
├── step2_port_url/              # 端口和 URL 处理
├── step3_launcher/              # 启动器（已修改）
│   └── launch_native_app.py    # 集成前端启动
├── step4_startup/               # 启动窗口
├── step5_main_ui/               # 主 UI
├── step6_tray/                  # 系统托盘
├── step7_managers/              # 管理器
├── step8_utils/                 # 工具
├── step9_frontend/              # 🆕 前端启动（新增）
│   ├── __init__.py
│   ├── frontend_config.py
│   ├── frontend_thread.py
│   ├── frontend_starter.py
│   └── README.md
└── __init__.py                  # 已更新导出
```

---

## 📚 相关文档

1. **详细使用文档**: `pycore/pyutils/native_ui/step9_frontend/README.md`
2. **开发规范**: `development-guides/PYTHON_PYCORE.md`
3. **Matrix 项目架构**: `doc/MATRIX_PROJECT_ARCHITECTURE.md`
4. **Native UI 架构**: `pycore/pyutils/native_ui/doc.md`

---

## ✅ 测试验证

### 导入测试

```python
# 测试基本导入
from pycore.pyutils.native_ui import (
    NativeUIConfig,
    FrontendConfig,
    FrontendLauncherThread,
    start_frontend_if_needed
)
print("✓ 导入成功")
```

### 配置验证测试

```python
# 测试有效配置
config = NativeUIConfig(
    app_id='test',
    app_name='Test',
    main_entry=lambda: None,
    frontend_enabled=True,
    frontend_framework='vite',
    frontend_app_dir='test_dir'
)
config.validate()
print("✓ 配置验证通过")
```

### 语法检查

```bash
# 检查语法错误
cd pycore/pyutils/native_ui/step9_frontend
python -m py_compile *.py
# 无输出 = 语法正确
```

---

## 🎓 最佳实践

### 1. 生产环境

```python
config = NativeUIConfig(
    # ... 其他配置 ...
    frontend_enabled=True,
    frontend_framework="vite",
    frontend_app_dir="poly_apps/my_frontend",
    frontend_mode="production",
    frontend_auto_install=True,
    frontend_skip_build=False,  # 确保构建最新代码
    frontend_block_until_ready=False,  # 非阻塞启动
)
```

### 2. 开发环境

```python
config = NativeUIConfig(
    # ... 其他配置 ...
    frontend_enabled=True,
    frontend_framework="vite",
    frontend_app_dir="poly_apps/my_frontend",
    frontend_mode="dev",  # 开发模式
    frontend_port=3000,
    frontend_auto_install=True,
    frontend_block_until_ready=True,  # 阻塞等待（便于调试）
    debug=True,  # 显示详细日志
)
```

### 3. 快速启动（使用现有构建）

```python
config = NativeUIConfig(
    # ... 其他配置 ...
    frontend_enabled=True,
    frontend_framework="vite",
    frontend_app_dir="poly_apps/my_frontend",
    frontend_mode="production",
    frontend_skip_build=True,  # 跳过构建
    frontend_auto_install=False,  # 假设依赖已安装
    frontend_block_until_ready=False,
)
# 启动时间：<1秒
```

---

## 🔄 迁移指南

### 从旧的 frontend_launcher 迁移

**旧代码**:
```python
from pycore.pyutils.frontend_launcher import (
    UniversalFrontendLauncher,
    UniversalFrontendConfig
)

config = UniversalFrontendConfig(
    app_name='matrix',
    framework='vite',
    app_dir=Path('poly_apps/matrix_ui_react'),
    mode='production'
)

launcher = UniversalFrontendLauncher(config)
launcher.build_production()
mount = launcher.get_static_mount()
```

**新代码**:
```python
from pycore.pyutils.native_ui import NativeUIConfig, launch_native_app

config = NativeUIConfig(
    app_id='matrix',
    app_name='Matrix',
    main_entry=main_function,

    # 前端配置集成到 NativeUIConfig
    frontend_enabled=True,
    frontend_framework='vite',
    frontend_app_dir='poly_apps/matrix_ui_react',
    frontend_mode='production',
)

# 一步启动（前端自动处理）
launch_native_app(config)
```

---

## ⚠️ 注意事项

1. **依赖要求**: 需要安装 `pnpm`（或自定义 `install_command` 使用 `npm`）
2. **端口占用**: 确保 `frontend_port` 未被占用
3. **项目结构**: 前端项目必须包含 `package.json`
4. **构建输出**: 确保框架的输出目录符合预期（可自定义 `static_dir`）
5. **线程安全**: 前端线程是 daemon 线程，主程序退出时会自动停止

---

## 📞 问题排查

### 问题 1: 前端无法启动

**检查**:
- `frontend_app_dir` 是否存在
- `package.json` 是否存在
- 端口是否被占用

**解决**:
```python
config = NativeUIConfig(
    # ...
    frontend_app_dir=Path("poly_apps/my_app").resolve(),  # 使用绝对路径
    debug=True,  # 启用调试输出
)
```

### 问题 2: 构建失败

**检查**:
- 源码是否有错误
- 依赖是否正确安装

**手动测试**:
```bash
cd poly_apps/matrix_ui_react
npm run build
```

### 问题 3: 健康检查超时

**解决**:
```python
config = FrontendConfig(
    # ...
    health_check_timeout=300,  # 增加超时
    port=3001,  # 更换端口
)
```

---

## 🎉 总结

本次重构实现了完整的前端启动功能集成，主要优势：

✅ **简化使用**: 一个配置类搞定所有
✅ **内部处理**: native_ui 自动管理前端生命周期
✅ **功能完整**: 支持主流框架和开发模式
✅ **遵循规范**: 符合 pycore 架构标准
✅ **易于维护**: 清晰的模块结构和文档

**下一步**:
- 测试与各种前端框架的集成
- 优化构建性能
- 添加更多框架支持
- 完善错误提示信息

---

**文档版本**: v1.0
**最后更新**: 2025-12-07
**作者**: Claude Code
