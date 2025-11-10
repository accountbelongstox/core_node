# Native UI Framework Migration Guide

## 重构完成日期: 2025-11-10

## 概述

本次重构清理了重复的Tkinter框架实现，统一使用PySide6作为主UI框架，tkinter仅用于启动窗口。

---

## ✅ 已完成的改动

### 1. 删除的文件

以下文件已被删除（重复的Tkinter框架）：

```
pycore/pyutils/native_ui/
├── framework.py              ❌ 已删除
├── framework_v2.py           ❌ 已删除
├── thread_framework.py       ❌ 已删除
├── webview_framework.py      ❌ 已删除
├── system_tray.py            ❌ 已删除（使用pyside6版本）
├── title_bar.py              ❌ 已删除（使用pyside6版本）
├── threads.py                ❌ 已删除
└── examples/
    ├── selenium_style_example.py  ❌ 已删除
    └── thread_based_example.py    ❌ 已删除
```

### 2. 保留的核心文件

```
pycore/pyutils/native_ui/
├── __init__.py               ✅ 已更新导出
├── config.py                 ✅ 保留（基础配置）
├── signals.py                ✅ 保留（信号系统）
├── timer_manager.py          ✅ 保留（定时器管理）
├── file_monitor.py           ✅ 保留（文件监控）
├── shutdown_manager.py       ✅ 保留（关闭管理）
├── startup_window.py         ✅ 保留（tkinter启动窗口）
├── launcher_with_startup.py  ✅ 保留（启动器）
└── pyside6/                  ✅ 主框架目录
    ├── __init__.py           ✅ PySide6组件导出
    ├── framework.py          ✅ 主框架
    ├── config.py             ✅ 配置类
    ├── main_window.py        ✅ 主窗口
    ├── title_bar.py          ✅ 标题栏
    ├── system_tray.py        ✅ 系统托盘
    ├── webview.py            ✅ WebView组件
    ├── example.py            ✅ 示例代码
    └── README.md             ✅ 文档
```

---

## 🔄 迁移指南

### 旧代码 → 新代码

#### 1. 基础框架导入

**旧代码 (已废弃)**:
```python
from pycore.pyutils.native_ui import NativeUIFramework, create_ui_framework
from pycore.pyutils.native_ui import NativeUIFrameworkV2, create_ui_framework_v2
from pycore.pyutils.native_ui import WebViewFramework
from pycore.pyutils.native_ui import NativeUIThread, NativeUIThreadConfig
```

**新代码 (推荐)**:
```python
from pycore.pyutils.native_ui.pyside6 import (
    PySide6Framework,
    PySide6UIConfig,
    create_framework
)
```

#### 2. 系统托盘

**旧代码 (已废弃)**:
```python
from pycore.pyutils.native_ui import SystemTray, TrayMenuItem
```

**新代码 (推荐)**:
```python
from pycore.pyutils.native_ui.pyside6 import PySide6SystemTray, PySide6TrayMenuItem
```

#### 3. 标题栏

**旧代码 (已废弃)**:
```python
from pycore.pyutils.native_ui import CustomTitleBar
```

**新代码 (推荐)**:
```python
from pycore.pyutils.native_ui.pyside6 import PySide6TitleBar
```

#### 4. 启动窗口 (无需改动)

```python
# 启动窗口仍然使用tkinter，保持不变
from pycore.pyutils.native_ui import (
    StartupWindow,
    ColorPrintCapture,
    launch_app_with_startup
)
```

---

## 📚 使用示例

### 完整的应用启动流程

```python
from pycore.pyutils.native_ui import launch_app_with_startup
from pycore.pyutils.native_ui.pyside6 import create_framework

def main_app_entry():
    """主应用入口（PySide6）"""
    # 创建PySide6框架
    app = create_framework(
        app_name="My Application",
        window_size=(1280, 800),
        webview_url="http://localhost:3000",
        enable_tray=True,
        enable_loading_page=True
    )

    # 启动应用
    app.start()

if __name__ == "__main__":
    # 使用启动窗口包装
    launch_app_with_startup(
        app_name="My Application",
        main_entry=main_app_entry,
        min_display_time=2.0
    )
```

---

## 🎯 架构说明

### 统一的线程模型

**PySide6 Framework 线程架构**:
- **Main Thread**: Qt事件循环（UI）
- **Tick Thread**: 定时任务（可选，1秒间隔）

**为什么删除Tkinter版本？**
1. **重复实现**: 5个不同的Tkinter框架版本（framework.py, framework_v2.py, thread_framework.py, webview_framework.py, threads.py）
2. **功能完整**: PySide6版本已实现所有功能
3. **性能更好**: Qt事件循环比Tkinter手动轮询效率高
4. **原生体验**: PySide6提供更好的原生外观

### 启动流程

```
1. [Python原生] startup_window.py (tkinter)
   ↓ 显示启动窗口
   ↓ 安装依赖

2. [PySide6] launcher_with_startup.py
   ↓ 关闭启动窗口
   ↓ 调用主应用入口

3. [PySide6] pyside6/framework.py
   ↓ 创建Qt应用
   ↓ 创建主窗口
   ↓ 加载WebView
   ↓ 显示loading页面
   ↓ 加载目标URL
```

---

## 🔍 验证清单

如果你的代码依赖native_ui，请检查：

- [ ] 不再使用 `NativeUIFramework`, `NativeUIFrameworkV2`, `WebViewFramework`, `NativeUIThread`
- [ ] SystemTray 改为 `PySide6SystemTray`
- [ ] CustomTitleBar 改为 `PySide6TitleBar`
- [ ] 启动窗口相关代码无需改动（StartupWindow, launch_app_with_startup）
- [ ] 基础组件无需改动（UIConfig, SignalManager, TaskTimer等）

---

## 📦 依赖要求

### 必需依赖
```
# 启动窗口（无外部依赖）
tkinter  # Python内置

# 主应用
PySide6>=6.0.0
PySide6-WebEngine>=6.0.0  # 用于WebView
```

### 可选依赖
```
pywebview  # 备选WebView引擎
tkinterweb  # 备选HTML渲染
tkhtmlview  # 备选HTML渲染
```

---

## ⚠️ 注意事项

1. **向后兼容性**: 基础组件（UIConfig, SignalManager等）保持不变
2. **启动窗口**: 仍使用tkinter（无依赖），符合设计要求
3. **PySide6优先**: 主应用统一使用PySide6框架
4. **examples**: 旧的example文件已删除，参考 `pyside6/example.py`

---

## 📖 参考文档

- [PySide6 Framework README](./pyside6/README.md)
- [PySide6 Example](./pyside6/example.py)
- [项目开发规范](../../../development-guides/PYTHON_PYCORE_BASE_GUIDE_THIS_FILE_NO_AI_EDIT.md)

---

## 🆘 遇到问题？

### Q: 导入 NativeUIFramework 失败
**A**: 已删除，使用 `from pycore.pyutils.native_ui.pyside6 import PySide6Framework`

### Q: SystemTray 找不到
**A**: 已删除根目录版本，使用 `from pycore.pyutils.native_ui.pyside6 import PySide6SystemTray`

### Q: 启动窗口无法使用
**A**: 启动窗口保持不变，直接使用 `from pycore.pyutils.native_ui import StartupWindow`

### Q: 如何运行示例？
**A**: 运行 `python -m pycore.pyutils.native_ui.pyside6.example`

---

**重构完成**: 2025-11-10
**负责人**: Claude AI Assistant
**版本**: v2.0 (PySide6统一框架)
