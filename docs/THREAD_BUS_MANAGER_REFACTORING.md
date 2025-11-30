# THREAD_BUS Manager 重构
**日期**: 2025-11-12
**目的**: 建立作用域管理，避免全局THREAD_BUS污染

---

## 问题描述

**重构前**:
- `pycore/__init__.py` 直接操作 THREAD_BUS
- 键名无组织，容易冲突
- 全局状态污染
- 难以维护和调试

```python
# ❌ 重构前 - pycore/__init__.py
from pycore.pyfoundations.thread_bus import THREAD_BUS

THREAD_BUS.set("pycore_dependencies_checked", True)
THREAD_BUS.set("pycore_total_packages", count)
THREAD_BUS.emit("pycore_dependencies_complete", {...})
```

**问题**:
1. 键名扁平，无命名空间
2. 逻辑分散在不同文件
3. 难以跟踪哪些键被使用
4. 作用域不清晰

---

## 解决方案

### 创建专门的 THREAD_BUS Manager

**文件**: `pycore/pyutils/native_ui/thread_bus_manager.py`

**核心概念**:
1. **命名空间 (Namespaces)** - 逻辑分组
2. **标准化键名 (BusKeys)** - 类型安全
3. **标准化信号 (BusSignals)** - 清晰的事件
4. **单例模式** - 全局访问点
5. **作用域管理** - 清理和隔离

---

## 架构设计

### 命名空间组织

```
THREAD_BUS (全局总线)
│
├── pycore.deps.*              # PyCore 依赖检查
│   ├── pycore.deps.checked
│   ├── pycore.deps.all_packages
│   ├── pycore.deps.installed
│   ├── pycore.deps.missing
│   ├── pycore.deps.total
│   └── pycore.deps.platform
│
├── ui.config.*                # UI 配置
│
├── ui.tray.*                  # 托盘系统
│   ├── ui.tray.config
│   ├── ui.tray.backend
│   ├── ui.tray.ready
│   └── ui.tray.visible
│
├── ui.startup.*               # 启动窗口
│   ├── ui.startup.mode
│   └── ui.startup.thread_id
│
└── app.state.*                # 应用状态
```

### BusNamespaces 类

```python
class BusNamespaces:
    """THREAD_BUS namespace organization"""
    PYCORE_DEPS = "pycore.deps"
    UI_CONFIG = "ui.config"
    UI_TRAY = "ui.tray"
    APP_STATE = "app.state"
    UI_STARTUP = "ui.startup"
```

### BusKeys 类

```python
class BusKeys:
    """Standardized THREAD_BUS keys with namespaces"""

    # PyCore dependency keys
    DEPS_CHECKED = "pycore.deps.checked"
    DEPS_ALL_PACKAGES = "pycore.deps.all_packages"
    DEPS_INSTALLED = "pycore.deps.installed"
    DEPS_MISSING = "pycore.deps.missing"
    DEPS_TOTAL = "pycore.deps.total"
    DEPS_PLATFORM = "pycore.deps.platform"

    # Tray configuration keys
    TRAY_CONFIG = "ui.tray.config"
    TRAY_BACKEND = "ui.tray.backend"
    # ...
```

### BusSignals 类

```python
class BusSignals:
    """Standardized THREAD_BUS signal names"""

    # PyCore signals
    DEPS_COMPLETE = "pycore.deps.complete"
    DEPS_INSTALL_START = "pycore.deps.install_start"
    DEPS_INSTALL_SUCCESS = "pycore.deps.install_success"

    # Tray signals
    TRAY_STARTED = "ui.tray.started"
    TRAY_SHOW = "ui.tray.show"
    TRAY_EXIT = "ui.tray.exit"
    # ...
```

---

## NativeUIBusManager API

### 初始化

```python
from pycore.pyutils.native_ui import get_bus_manager

# 获取单例实例
bus_mgr = get_bus_manager()
```

### 依赖检查方法

#### 记录依赖信息

```python
bus_mgr.record_dependency_check(
    all_packages=["pkg1", "pkg2", "pkg3"],
    installed=["pkg1", "pkg2", "pkg3"],
    missing=[],
    platform="Windows"
)
```

**内部操作**:
1. 设置所有命名空间键
2. 发射 `pycore.deps.complete` 信号
3. 数据可从任何地方访问

#### 获取依赖信息

```python
dep_info = bus_mgr.get_dependency_info()

# 返回 DependencyInfo 对象
print(dep_info.checked)      # True/False
print(dep_info.total)        # 总包数
print(dep_info.installed)    # 已安装列表
print(dep_info.missing)      # 缺失列表
print(dep_info.platform)     # 平台名
```

#### 监听完成事件

```python
def on_complete(data):
    print(f"Dependencies ready: {data['installed']}/{data['total']}")

bus_mgr.on_dependency_complete(on_complete)
```

### 托盘配置方法

```python
from pycore.pyutils.native_ui.tray_config import TrayConfig

# 存储托盘配置
bus_mgr.set_tray_config(tray_config)

# 获取托盘配置
config = bus_mgr.get_tray_config()

# 设置活动后端
bus_mgr.set_tray_backend("tkinter")

# 监听托盘事件
bus_mgr.on_tray_show(lambda data: show_window())
bus_mgr.on_tray_exit(lambda data: exit_app())
```

### 作用域管理方法

#### 获取命名空间下的所有键

```python
# 获取所有依赖相关的键
keys = bus_mgr.get_all_keys(BusNamespaces.PYCORE_DEPS)
# 返回: ["pycore.deps.checked", "pycore.deps.total", ...]
```

#### 导出状态（调试用）

```python
# 导出特定命名空间
state = bus_mgr.dump_state(BusNamespaces.PYCORE_DEPS)
# 返回: {"pycore.deps.checked": True, "pycore.deps.total": 10, ...}

# 导出所有状态
all_state = bus_mgr.dump_state()
```

#### 清理命名空间

```python
# 清理托盘命名空间的所有键
bus_mgr.clear_namespace(BusNamespaces.UI_TRAY)
```

---

## 修改总结

### 1. 新建文件

| 文件 | 说明 |
|------|------|
| `pycore/pyutils/native_ui/thread_bus_manager.py` | THREAD_BUS Manager核心实现 |
| `test_thread_bus_manager.py` | 测试套件 |
| `docs/THREAD_BUS_MANAGER_REFACTORING.md` | 本文档 |

### 2. 修改文件

| 文件 | 修改内容 |
|------|---------|
| `pycore/__init__.py` | - 移除直接 THREAD_BUS 导入<br>- 使用延迟导入调用 manager<br>- 保持向后兼容 |
| `pycore/pyutils/native_ui/__init__.py` | - 导出 NativeUIBusManager<br>- 导出命名空间和键常量 |
| `pycore/pyutils/native_ui/tray_config.py` | - 更新 TrayBusKeys 为命名空间键<br>- 标记为 DEPRECATED |

### 3. pycore/__init__.py 的改进

**重构前**:
```python
from pycore.pyfoundations.thread_bus import THREAD_BUS

THREAD_BUS.set("pycore_dependencies_checked", True)
THREAD_BUS.set("pycore_all_packages", sorted(...))
THREAD_BUS.set("pycore_installed_packages", sorted(...))
THREAD_BUS.set("pycore_missing_packages", sorted(...))
THREAD_BUS.emit("pycore_dependencies_complete", {...})
```

**重构后**:
```python
# 延迟导入避免循环依赖
try:
    from pycore.pyutils.native_ui.thread_bus_manager import get_bus_manager
    bus_mgr = get_bus_manager()
    bus_mgr.record_dependency_check(
        all_packages=sorted(...),
        installed=sorted(...),
        missing=sorted(...),
        platform=current_platform
    )
except ImportError:
    # NativeUIBusManager 不可用（最小安装）
    pass
```

**优势**:
- ✅ 不再直接依赖 THREAD_BUS
- ✅ 逻辑委托给专门的 manager
- ✅ 兼容最小化安装（ImportError 处理）
- ✅ 更清晰的意图表达

---

## 使用示例

### 示例 1: 在启动窗口中显示依赖信息

```python
from pycore.pyutils.native_ui import get_bus_manager, BusSignals

class TkinterStartupThread(threading.Thread):
    def __init__(self):
        # ...
        self.bus_mgr = get_bus_manager()

        # 监听依赖完成事件
        self.bus_mgr.on_dependency_complete(self._on_deps_complete)

    def _on_deps_complete(self, data):
        """依赖检查完成回调"""
        total = data['total']
        installed = data['installed']
        missing = data['missing']

        if missing == 0:
            self.log(f"✓ All {total} packages installed", "success")
        else:
            self.log(f"✓ {installed}/{total} ready", "success")
```

### 示例 2: 在主应用中访问依赖信息

```python
from pycore.pyutils.native_ui import get_bus_manager

def main_app_entry():
    bus_mgr = get_bus_manager()

    # 获取依赖信息（无需传参）
    dep_info = bus_mgr.get_dependency_info()

    if dep_info.checked:
        print(f"Dependencies: {len(dep_info.installed)}/{dep_info.total}")
    else:
        print("Dependencies not checked yet")
```

### 示例 3: 调试 - 查看所有依赖相关键

```python
from pycore.pyutils.native_ui import get_bus_manager, BusNamespaces

bus_mgr = get_bus_manager()

# 获取所有依赖键
keys = bus_mgr.get_all_keys(BusNamespaces.PYCORE_DEPS)
print(f"Dependency keys: {keys}")

# 导出完整状态
state = bus_mgr.dump_state(BusNamespaces.PYCORE_DEPS)
for key, value in state.items():
    print(f"  {key}: {value}")
```

---

## 测试

### 运行测试

```bash
python test_thread_bus_manager.py
```

### 测试覆盖

1. ✅ 依赖信息记录和检索
2. ✅ 命名空间键验证
3. ✅ 信号发射和监听
4. ✅ 命名空间隔离
5. ✅ 状态导出
6. ✅ 命名空间清理

---

## 优势总结

### 1. 清晰的组织结构 ✅
- 命名空间防止键冲突
- 易于查找和理解
- 标准化的命名约定

### 2. 作用域管理 ✅
- 可以清理特定命名空间
- 调试时可以导出特定作用域
- 避免全局污染

### 3. 类型安全 ✅
- `DependencyInfo` 数据类
- 明确的方法签名
- IDE 自动补全支持

### 4. 易于维护 ✅
- 所有 THREAD_BUS 逻辑集中管理
- 单一职责原则
- 清晰的 API 接口

### 5. 向后兼容 ✅
- `pycore/__init__.py` 优雅降级
- 不影响现有功能
- 渐进式迁移路径

---

## 迁移指南

### 旧代码

```python
# ❌ 旧方式 - 直接使用 THREAD_BUS
from pycore import THREAD_BUS

THREAD_BUS.set("some_key", value)
data = THREAD_BUS.get("some_key")
THREAD_BUS.emit("some_signal", {})
```

### 新代码

```python
# ✅ 新方式 - 使用 Manager
from pycore.pyutils.native_ui import get_bus_manager, BusKeys

bus_mgr = get_bus_manager()

# 使用标准化的键
dep_info = bus_mgr.get_dependency_info()

# 使用标准化的信号
bus_mgr.on_dependency_complete(callback)
```

---

## 最佳实践

### 1. 总是使用命名空间

```python
# ✅ 正确 - 使用命名空间
CUSTOM_KEY = "app.myfeature.config"

# ❌ 错误 - 扁平键名
CUSTOM_KEY = "myfeature_config"
```

### 2. 使用 BusKeys 常量

```python
# ✅ 正确 - 使用常量
key = BusKeys.DEPS_TOTAL

# ❌ 错误 - 硬编码字符串
key = "pycore.deps.total"
```

### 3. 通过 Manager 访问

```python
# ✅ 正确 - 通过 Manager
bus_mgr = get_bus_manager()
deps = bus_mgr.get_dependency_info()

# ❌ 错误 - 直接访问 THREAD_BUS
deps = THREAD_BUS.get("pycore.deps.installed")
```

### 4. 清理命名空间

```python
# 在组件销毁时清理
def cleanup():
    bus_mgr = get_bus_manager()
    bus_mgr.clear_namespace(BusNamespaces.UI_TRAY)
```

---

## 下一步

### 待完成
1. ⏳ 扩展 TkinterStartupThread 使用 Manager
2. ⏳ 更新其他组件使用 Manager
3. ⏳ 添加更多命名空间（如果需要）
4. ⏳ 性能优化和缓存策略

### 未来改进
- 添加命名空间权限控制
- 实现键的过期机制
- 添加变更通知（watch 模式）
- 提供序列化/反序列化支持

---

**状态**: ✅ 完成
**影响**: 架构级改进
**向后兼容**: ✅ 是

---

## 相关文档
- [THREAD_BUS 统一通信架构](THREAD_BUS_ARCHITECTURE_2025-11-12.md)
- [完整架构分析](ARCHITECTURE_ANALYSIS_2025-11-12.md)
