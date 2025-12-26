## Debug TK Window Close Fix - Summary

### 问题描述

用户点击debug窗口关闭按钮后，窗口虽然关闭了，但程序没有退出，而是继续在tray模式下运行。用户认为"关闭无效"。

### 根本原因

**launch_native_app.py:216** 在处理 `app.close` 事件时，调用了 `thread.request_close()` 而不是 `thread.stop()`。

#### 问题流程：

1. **用户点击关闭按钮**
   - `_on_user_close()` 被调用
   - 触发 `app.close` 事件（同步）
   - 调用 `_close_window()` 关闭窗口，退出mainloop

2. **app.close事件处理器执行**
   - `handle_app_close()` 收到事件
   - 调用 `thread.request_close()` ❌ **BUG在这里**
   - `request_close()` 只设置 `_close_requested` 标志
   - **但 `_stop_event` 未设置**

3. **窗口mainloop结束后**
   - 执行 `startup_window_thread.py:159-177`
   - 检查: `if self.enable_tray and not self._stop_event.is_set()`
   - **`_stop_event` 未设置** → 条件为True
   - 进入 `_run_tray_mode()` → 程序继续运行
   - **用户看到窗口关闭了，但程序没有退出** ❌

### 修复方案

将 `launch_native_app.py:216` 的 `thread.request_close()` 改为 `thread.stop()`

#### request_close() vs stop() 的差别：

| 方法 | 行为 | 适用场景 |
|-----|------|---------|
| `request_close()` | 1. 设置 `_close_requested` 标志<br>2. 依赖 `_process_logs()` 检查标志并关闭窗口<br>3. **不设置 `_stop_event`**<br>4. 如果tray正在运行，立即停止tray | 窗口运行时的外部关闭请求 |
| `stop()` | 1. **设置 `_stop_event`**（阻止进入tray模式）<br>2. 停止tray（如果正在运行）<br>3. 调用 `request_close()` 关闭窗口 | 完全停止整个线程（窗口+tray） |

### 修复后的流程：

1. **用户点击关闭按钮**
   - `_on_user_close()` 被调用
   - 触发 `app.close` 事件（同步）
   - 调用 `_close_window()` 关闭窗口，退出mainloop

2. **app.close事件处理器执行** ✅ **修复后**
   - `handle_app_close()` 收到事件
   - 调用 `thread.stop()` ✓
   - `stop()` 设置 `_stop_event.set()` ✓
   - `stop()` 停止tray（如果运行）✓
   - `stop()` 调用 `request_close()`（窗口已关闭，无影响）

3. **窗口mainloop结束后** ✅ **修复后**
   - 执行 `startup_window_thread.py:159-177`
   - 检查: `if self.enable_tray and not self._stop_event.is_set()`
   - **`_stop_event` 已设置** → 条件为False ✓
   - **跳过 `_run_tray_mode()`** ✓
   - 线程正常退出 ✓
   - **程序完全退出** ✓

### 代码变更

**文件**: `/www/programing/core_node/pycore/pyutils/native_ui/step3_launcher/launch_native_app.py`

**行号**: 210-220

**变更前**:
```python
        # CRITICAL FIX: Stop startup thread (if it exists and is running)
        # This must be done manually as it's not registered in shutdown stack
        if startup_thread_ref and startup_thread_ref.get('thread'):
            thread = startup_thread_ref['thread']
            if thread and thread.is_alive():
                ColorPrint.blue("[NativeLauncher] Stopping startup thread (debug window/tray)...")
                thread.request_close()  # ❌ BUG: 不会设置 _stop_event
```

**变更后**:
```python
        # CRITICAL FIX: Stop startup thread (if it exists and is running)
        # This must be done manually as it's not registered in shutdown stack
        if startup_thread_ref and startup_thread_ref.get('thread'):
            thread = startup_thread_ref['thread']
            if thread and thread.is_alive():
                ColorPrint.blue("[NativeLauncher] Stopping startup thread (debug window/tray)...")
                # Use stop() instead of request_close() to ensure:
                # 1. _stop_event is set (prevents entering tray mode after window closes)
                # 2. Tray is stopped if running
                # 3. Window is closed if still open
                thread.stop()  # ✅ 修复: 设置 _stop_event，阻止进入tray模式
```

### THREAD_BUS事件系统的使用

修复确认了debug窗口**正确使用了THREAD_BUS事件系统**：

1. ✅ `_on_user_close()` 触发 `app.close` 事件
2. ✅ `handle_app_close()` 注册为事件处理器
3. ✅ `THREAD_BUS.trigger_event()` 同步触发事件
4. ✅ `THREAD_BUS.request_shutdown()` 触发全局shutdown

**唯一的问题**是在事件处理器中调用了错误的方法（`request_close()` 而不是 `stop()`）。

### 测试验证

创建了测试脚本：`test_debug_window_close.py`

测试场景：
- 启动应用（带debug窗口和tray）
- 5秒后触发 `app.close` 事件
- 验证程序正确退出（不hang在tray模式）

### 总结

- **问题**: Debug窗口关闭后进入tray模式，程序不退出
- **原因**: `handle_app_close()` 调用了 `request_close()` 而不是 `stop()`，导致 `_stop_event` 未设置
- **修复**: 改为调用 `stop()`，确保设置 `_stop_event` 阻止进入tray模式
- **验证**: THREAD_BUS事件系统使用正确 ✓

### 相关文件

1. `/www/programing/core_node/pycore/pyutils/native_ui/step3_launcher/launch_native_app.py` - 修复位置
2. `/www/programing/core_node/pycore/pyutils/native_ui/step4_startup/startup_window_thread.py` - debug窗口实现
3. `/www/programing/core_node/test_debug_window_close.py` - 测试脚本（新增）
