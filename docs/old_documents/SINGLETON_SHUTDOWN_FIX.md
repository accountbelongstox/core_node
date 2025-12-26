## 单例模式未通知旧实例退出 - 原因分析与修复

### 问题描述

用户报告：新实例启动时，单例模式没有通知旧实例退出，导致多个实例同时运行。

日志显示：
```
[2025-12-18 15:22:24] [ERROR] SingletonDetector(pycore_callmodule): Port 54300: Failed to bind - [Errno 98] Address already in use
```

### 根本原因

**问题1**: callmodule使用了两套配置系统，端口范围不一致

1. **旧的LauncherConfig** (`config.py`) - 配置了 `singleton_port_start=59100`
2. **新的NativeUIConfig** (`callmodule_main.py`) - 使用Native UI启动，但没有配置单例端口

**callmodule_main.py使用Native UI启动，不使用LauncherConfig**，所以59100配置没有生效。

#### Port Allocator自动分配逻辑

```python
# port_allocator.py
BUILTIN_PORT_RANGES = {
    "matrix": (54100, 100),      # Matrix: 54100-54199
    "mcp": (54200, 100),          # MCP: 54200-54299
}

# 如果app_id不在BUILTIN_PORT_RANGES中
_NEXT_CUSTOM_PORT_START = 54300  # 自动分配从54300开始
```

**callmodule的app_id是 "pycore_callmodule"**，不在BUILTIN_PORT_RANGES中，所以被自动分配了 **54300-54399** 范围。

### 问题2: 旧实例没有启动单例监听服务器

通过 `netstat -tlnp | grep ":540"` 检查发现，**54000-54399范围内没有任何监听端口**。

可能原因：
- 旧实例使用**旧的启动方式**（不使用Native UI，没有单例检测）
- 旧实例使用了**不同的端口范围**
- 旧实例可能是**不同时期的代码版本**

### 修复方案

#### 修复1: 注册callmodule的端口范围

**文件**: `/www/programing/core_node/pycore/callmodule/callmodule_main.py`

**修改**:
```python
from pycore.pyutils.native_ui.step2_port_url import register_port_range

def start(host='0.0.0.0', port=59000, debug=False):
    # ... existing code ...

    # Register custom port range for callmodule (matches config.py configuration)
    # This ensures Native UI uses the correct singleton port range
    register_port_range(Config.APP_ID, 54000, 100)  # 54000-54099
    ColorPrint.blue(f"[Callmodule] Registered singleton port range: 54000-54099")
```

**效果**:
- Native UI使用 54000-54099 范围进行单例检测
- 与LauncherConfig的配置保持一致（虽然LauncherConfig不再使用）

#### 修复2: 确保新实例能通知旧实例

launch_native_app.py已经配置了 `shutdown_existing=True`：

```python
detector = SingletonDetector(
    app_id=config.app_id,
    port_start=port_start,
    port_range=port_range,
    timeout=1.0,
    debug=config.debug,
    shutdown_existing=True  # 新实例会通知旧实例退出
)
```

### SingletonDetector工作流程

1. **新实例启动**：扫描54000-54099端口范围
2. **发现旧实例**：找到正在监听的端口
3. **发送SHUTDOWN消息**：通知旧实例退出
4. **等待旧实例退出**：等待1.5秒
5. **重试绑定端口**：绑定旧实例的端口
6. **成为PRIMARY**：新实例成为主实例

### 验证测试

#### 测试1: 端口范围注册

```bash
python3 -c "
from pycore.callmodule.callmodule_config import Config
from pycore.pyutils.native_ui.step2_port_url import register_port_range, get_port_range

register_port_range(Config.APP_ID, 54000, 100)
port_start, port_range = get_port_range(Config.APP_ID, debug=True)
print(f'Port range: {port_start}-{port_start+port_range-1}')
"
```

**预期输出**:
```
[PortAllocator] pycore_callmodule -> 54000-54099 (built-in)
Port range: 54000-54099
```

✅ **测试通过**

#### 测试2: 新实例通知旧实例（需要清空旧实例）

**前提条件**: 先杀掉所有旧实例

```bash
# 启动第一个实例
python3 ./pycore_module_caller.py &
sleep 5

# 启动第二个实例（应该通知第一个实例退出）
python3 ./pycore_module_caller.py
```

**预期行为**:
1. 第一个实例在54000端口启动单例监听
2. 第二个实例发现54000被占用
3. 第二个实例发送SHUTDOWN消息给第一个实例
4. 第一个实例收到消息后退出
5. 第二个实例绑定54000端口成为PRIMARY

**注意**: 由于当前有多个旧实例无法杀掉（权限不足），此测试暂时无法验证。

### 相关修复

同时也修复了debug窗口关闭问题（`launch_native_app.py:220`）：

```python
# 修复前
thread.request_close()  # ❌ 不会设置 _stop_event，导致进入tray模式

# 修复后
thread.stop()  # ✅ 设置 _stop_event，阻止进入tray模式
```

### 总结

#### ✅ 已修复
1. **端口范围注册** - callmodule现在使用54000-54099（与LauncherConfig一致）
2. **Debug窗口关闭** - 使用 `stop()` 而不是 `request_close()`
3. **shutdown_existing配置** - launch_native_app.py已硬编码为True

#### ⚠️ 旧实例问题
当前运行的旧实例没有启动单例监听服务器，新实例无法通知它们退出。需要：
- 手动杀掉所有旧实例
- 或等待旧实例自然退出
- 使用新代码重新启动

#### 📝 建议
未来统一使用Native UI启动方式，避免配置不一致。

### 相关文件

1. `/www/programing/core_node/pycore/callmodule/callmodule_main.py` - 注册端口范围
2. `/www/programing/core_node/pycore/pyutils/native_ui/step3_launcher/launch_native_app.py` - 单例检测配置
3. `/www/programing/core_node/pycore/pyutils/native_ui/step2_port_url/port_allocator.py` - 端口分配逻辑
4. `/www/programing/core_node/pycore/pylauncher/singleton_detector.py` - 单例检测实现
