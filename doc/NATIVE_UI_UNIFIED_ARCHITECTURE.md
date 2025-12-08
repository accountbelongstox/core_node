# Native UI 统一架构设计

## 问题分析

### 当前存在的问题

#### 1. 重复的 Debug 窗口机制
- **TkinterStartupThread** (step4_startup/startup_window_thread.py)
  - 线程化实现
  - 支持 ColorPrint 回调
  - 支持语言选择器
  - 支持系统托盘

- **StartupWindow** (step4_startup/startup_window.py)
  - 非线程化实现
  - 使用 ColorPrintCapture
  - 旧版实现，与 TkinterStartupThread 功能重复

- **framework.py 内置 StartupWindow**
  - PySide6Framework 默认创建 StartupWindow
  - 与 launcher_with_startup.py 的 TkinterStartupThread 冲突
  - 导致双窗口问题

#### 2. 关闭事件未统一
从日志可见关闭顺序混乱：
```
[ThreadBus] Executing shutdown handlers...
[NativeLauncher] Handling app.close event...  # 晚于 shutdown handlers
[CallbackManager] Executing closing callbacks...
[TkinterStartupThread] Close request received...
```

**问题**：
- 多个关闭触发点：主窗口、Ctrl+C、托盘退出、Debug 窗口
- 没有统一的关闭入口
- shutdown handlers、app.close、closing callbacks 顺序不一致
- 没有防止重复执行的机制

#### 3. ColorPrint 注册未统一
- TkinterStartupThread 使用 `ColorPrint.register_callback()`
- StartupWindow 使用 `ColorPrintCapture`
- 注册/注销时机不统一

#### 4. 配置混乱
- `NativeUIConfig.show_debug_window` 控制 launcher_with_startup
- `StartupWindowConfig.show_startup` 控制 framework 内置窗口
- 两者可能冲突

## 统一架构设计

### 设计原则

1. **单一职责**
   - launcher_with_startup.py 负责启动流程和 Debug 窗口
   - framework.py 只负责 PySide6 UI，不创建启动窗口

2. **统一入口**
   - 所有窗口关闭都触发 `app.close` 事件
   - `app.close` 是唯一的全局关闭事件
   - 所有清理逻辑通过 `app.close` 事件处理器执行

3. **单一窗口机制**
   - 只保留 TkinterStartupThread（功能完整、线程化）
   - 废弃 StartupWindow（旧实现）
   - 禁用 framework.py 的内置窗口

4. **明确的生命周期**
   ```
   启动 → Debug窗口 → 初始化 → 主窗口 → 运行 → app.close → 清理 → 退出
   ```

### 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    launch_native_app()                       │
│  (pycore/pyutils/native_ui/step3_launcher/launch_native_app.py) │
└────────────┬────────────────────────────────────────────────┘
             │
             ├─> 判断 show_debug_window
             │   ├─ True:  调用 launch_app_with_startup()
             │   │         └─> TkinterStartupThread (唯一Debug窗口)
             │   │             ├─ ColorPrint.register_callback()
             │   │             ├─ 监听 frontend.ready 自动关闭
             │   │             └─ 监听 app.close 强制关闭
             │   │
             │   └─ False: 直接启动，无 Debug 窗口
             │
             ├─> 创建 PySide6Framework(ui_config, startup_config)
             │   └─> startup_config.show_startup = False (强制禁用)
             │
             └─> 注册 app.close 事件处理器 (priority=90)
                 └─> 停止 frontend_thread、rpc_service

┌─────────────────────────────────────────────────────────────┐
│                   全局关闭流程 (app.close)                    │
└─────────────────────────────────────────────────────────────┘

触发源：
  - 主窗口 closeEvent (main_window.py:461)
  - Ctrl+C (framework.py:363)
  - 托盘退出 (system_tray.py:390)
  - TkinterStartupThread 用户关闭 (应该添加)

       │
       ▼
   app.close 事件触发 (THREAD_BUS, async_mode=False, 同步执行)
       │
       ├─> Priority 90: launch_native_app 服务清理
       │   ├─ frontend_thread.stop()
       │   └─ rpc_service.stop()
       │
       ├─> Priority 50: 其他中等优先级处理器
       │
       ├─> Priority 10: 低优先级处理器
       │
       └─> Qt quit() / 线程退出
```

## 实施方案

### 1. 统一 Debug 窗口机制

#### 文件：`pycore/pyutils/native_ui/step5_main_ui/pyside6/config.py`

```python
@dataclass
class StartupWindowConfig:
    """
    Startup Window Configuration (DEPRECATED in favor of TkinterStartupThread)

    This config is kept for backward compatibility but should not be used.
    Use NativeUIConfig.show_debug_window instead.
    """
    app_name: str = "Application"
    width: int = 500
    height: int = 400
    icon_path: Optional[str] = None
    show_startup: bool = False  # ← 改为默认 False
    auto_close: bool = True
    daemon: bool = True
    on_complete: Optional[Callable] = None
```

#### 文件：`pycore/pyutils/native_ui/step5_main_ui/pyside6/framework.py`

```python
def __init__(self, config, startup_config=None):
    self.config = config or PySide6UIConfig()
    # 默认 show_startup=False，不再自动创建启动窗口
    self.startup_config = startup_config or StartupWindowConfig(
        app_name=self.config.app_name,
        show_startup=False,  # ← 改为默认 False
        auto_close=True
    )
```

**说明**：framework.py 不再主动创建启动窗口，所有 Debug 窗口由 launcher_with_startup.py 统一管理。

### 2. 统一关闭事件流程

#### 2.1 TkinterStartupThread 触发 app.close

**文件**: `pycore/pyutils/native_ui/step4_startup/startup_window_thread.py`

在 `_on_user_close()` 中添加：

```python
def _on_user_close(self):
    """Handle user attempting to close window"""
    self.log("User closed debug window, triggering app shutdown...", "warning")

    # Trigger global app.close event
    from pycore import THREAD_BUS
    THREAD_BUS.trigger_event('app.close', {
        'source': 'debug_window_close',
        'window': 'TkinterStartupThread'
    }, async_mode=False)

    # Close this window
    self._close_window()
```

**说明**：用户关闭 Debug 窗口 → 触发 app.close → 全局关闭流程

#### 2.2 统一 app.close 优先级

所有 app.close 处理器按优先级执行：

| Priority | 处理器 | 功能 |
|----------|--------|------|
| 100 | launcher_with_startup cleanup | 注销 ColorPrint 回调、关闭 Debug 窗口 |
| 90 | launch_native_app cleanup | 停止 frontend、RPC v2 |
| 50 | 窗口/UI 清理 | 隐藏窗口、保存状态 |
| 10 | 最终清理 | 数据库连接、文件关闭 |

#### 2.3 防止重复执行

**文件**: `pycore/pyutils/native_ui/step3_launcher/launch_native_app.py`

已实现：
```python
_cleanup_executed = [False]  # 防止重复执行

def handle_app_close(event_data):
    if _cleanup_executed[0]:
        ColorPrint.gray("[NativeLauncher] Cleanup already executed, skipping")
        return
    _cleanup_executed[0] = True
    # ... 执行清理
```

**其他位置也需要类似机制**。

### 3. 统一 ColorPrint 注册机制

#### 文件：`pycore/pyutils/native_ui/step3_launcher/launcher_with_startup.py`

当前实现（正确）：
```python
# Line 102: 注册 ColorPrint callback
ColorPrint.register_callback(startup_thread._colorprint_callback)

# Line 119-120: 注销 ColorPrint callback (在 frontend.ready 事件处理器中)
ColorPrint.unregister_callback(startup_thread._colorprint_callback)

# Line 179: 注销 ColorPrint callback (在 finally 块中，作为兜底)
ColorPrint.unregister_callback(startup_thread._colorprint_callback)
```

**规则**：
- 注册：TkinterStartupThread 启动后立即注册
- 注销：frontend.ready 时注销（正常流程）
- 兜底：finally 块再次注销（异常流程）

### 4. 清理废弃代码

#### 标记为废弃
- `pycore/pyutils/native_ui/step4_startup/startup_window.py`
  - 非线程化实现，已被 TkinterStartupThread 替代
  - 添加 DEPRECATED 标记

- `framework.py` 中的 StartupWindow 相关代码
  - show_startup()、close_startup()、log_startup()
  - 保留但默认不使用

## 实施检查清单

- [x] framework.py 默认 show_startup=False
- [ ] TkinterStartupThread 用户关闭触发 app.close
- [ ] 统一 app.close 优先级（文档化）
- [ ] 防止所有 app.close 处理器重复执行
- [ ] 标记 StartupWindow 为废弃
- [ ] 更新文档和注释
- [ ] 测试所有关闭场景：
  - [ ] 主窗口关闭
  - [ ] Ctrl+C
  - [ ] 托盘退出
  - [ ] Debug 窗口关闭

## 测试场景

### 场景 1：正常启动和关闭
```
启动 → Debug 窗口显示 → Frontend 就绪 → Debug 窗口自动关闭 → 主窗口显示 → 用户关闭主窗口 → app.close → 退出
```

### 场景 2：Ctrl+C 中断
```
启动 → Debug 窗口显示 → Ctrl+C → app.close → 清理 → 退出
```

### 场景 3：用户关闭 Debug 窗口
```
启动 → Debug 窗口显示 → 用户点击 X → app.close → 全局关闭 → 退出
```

### 场景 4：托盘退出
```
启动 → 主窗口运行 → 托盘"退出" → app.close → 清理 → 退出
```

## 预期效果

1. **单一 Debug 窗口**
   - 只有 TkinterStartupThread
   - 捕获所有 ColorPrint 输出
   - 支持语言选择器

2. **统一关闭流程**
   - 所有关闭源都触发 app.close
   - 按优先级执行清理
   - 防止重复执行
   - 日志清晰可追踪

3. **配置清晰**
   - NativeUIConfig.show_debug_window 控制一切
   - 无配置冲突
   - 无隐藏逻辑

4. **代码简洁**
   - 无重复实现
   - 职责明确
   - 易于维护
