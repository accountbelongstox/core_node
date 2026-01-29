# 启动 ROSBOT 后的逻辑与类库索引

**启动顺序规则**：战网启动并登陆 → 暗黑3启动 → ROSBOT 启动，顺序不可乱。详见 [DESIGN.md 第 4 节：启动顺序与流程](DESIGN.md#4-启动顺序与流程)。

---

## 1. 入口：营动 ROSBOT 按钮

| 位置 | 说明 |
|------|------|
| `ui/panels/rosbot_extension_panel.py` | 按钮 `control_btn`，文案 `rosbot.start_rosbot`（i18n） |
| 绑定 | `command=self._toggle_rosbot` |

点击后调用：`_toggle_rosbot()` → 若未运行则 `_start_rosbot()`。

---

## 2. 启动 ROSBOT 的完整逻辑（主线程）

**文件**：`ui/panels/rosbot_extension_panel.py`

```
_start_rosbot()
  ├─ Step 1: 更新 UI 状态
  │    ├─ self.rosbot_running = True
  │    └─ _update_control_button()  # 按钮改为「停止ROSBOT」红色
  ├─ Step 2: 启用任务线程里的 rosbot_task
  │    └─ set_task_status('rosbot_task', TaskStatus.ENABLED)
  │         → d3utils/task_thread_manager.py
  ├─ Step 3: 执行 ROSBOT 启动（同步，仍在主线程）
  │    └─ rosbot_processor.start_rosbot_task()
  │         → d3utils/rosbot_task_processor.py
  └─ Step 4: 打日志 [ROSBOT] Started monitoring
```

**注意**：`start_rosbot_task()` 是在**主线程**里同步调用的，会阻塞到 `processor.start_rosbot()` 执行完。

---

## 3. ROSBOT 启动实现（rosbot_task_processor）

**文件**：`d3utils/rosbot_task_processor.py`

| 函数/类 | 作用 |
|---------|------|
| `start_rosbot_task()` | 模块级入口：取全局 processor，调 `processor.start_rosbot()` |
| `get_rosbot_processor()` | 返回单例 `RosbotTaskProcessor` |
| `RosbotTaskProcessor.start_rosbot()` | 实际启动逻辑 |

**start_rosbot() 内部顺序**：

1. 若未初始化：`initialize()` → `set_log_file(~\Documents\RoS-BoT\Logs\logs.txt)`
2. `set_rosbot_running(True)` → **LogMonitor** 全速监控
3. `self.game_state.set_rosbot_status(True)` → **D3State** 更新并通知回调

---

## 4. 线程：任务线程管理器

**文件**：`d3utils/task_thread_manager.py`

| 类/函数 | 说明 |
|---------|------|
| `TaskThreadManager` | 管理所有已注册的 `TaskThread` |
| `TaskThread` | 单个后台线程：按 `interval` 轮询，当 `status == ENABLED` 时执行 `task_func()` |
| `set_task_status(name, status)` | 设置任务状态（如 `rosbot_task` → `ENABLED`） |
| `get_task_manager()` | 全局单例 |

**rosbot_task 的注册**（应用启动时）：

**文件**：`d3utils/system_initializer.py` → `_init_task_thread_manager()`

```python
register_task(
    name='rosbot_task',
    task_func=rosbot_processor.process_rosbot_task,  # 每轮调用的函数
    interval=1.0
)
start_all_tasks()  # 启动所有任务线程
```

即：**后台线程**每隔 1 秒调用一次 `process_rosbot_task()`；当前 `process_rosbot_task()` 为空（`pass`），真正启动是在主线程的 `start_rosbot_task()` 里完成的。

---

## 5. 相关操作类库一览

| 模块/类 | 路径 | 职责 |
|---------|------|------|
| **RosbotExtensionPanel** | `ui/panels/rosbot_extension_panel.py` | 启动/停止按钮、配置、日志区；调 set_task_status + start_rosbot_task |
| **rosbot_task_processor** | `d3utils/rosbot_task_processor.py` | `RosbotTaskProcessor`、`start_rosbot_task()`、`stop_rosbot_task()`、`process_rosbot_task()` |
| **TaskThreadManager / TaskThread** | `d3utils/task_thread_manager.py` | 任务线程的创建、启停、状态（ENABLED/DISABLED） |
| **LogMonitor** | `d3utils/log_monitor.py` | 监控 ROSBOT 日志文件；`set_rosbot_running(True/False)` 控制是否全速轮询 |
| **GameState (D3State)** | `share/game_interface_data.py` | `set_rosbot_status(running)`，通知已注册回调（如面板的 `_on_game_state_changed`） |
| **SystemInitializer** | `d3utils/system_initializer.py` | 启动时注册 `rosbot_task` 并 `start_all_tasks()` |

---

## 6. 状态回调与 UI 更新

**文件**：`ui/panels/rosbot_extension_panel.py`

- 面板在 `__init__` 中：`self.game_state.register_callback(self._on_game_state_changed)`
- `game_state.set_rosbot_status(True)` 被调用后，会 `_notify_callbacks(state)`
- `_on_game_state_changed(state)` 在**任意线程**被调用，内部用 `self.container.after(0, lambda: self._update_ui_from_state(state))` 把 UI 更新投递到**主线程**
- `_update_ui_from_state()` 更新 ROS/D3/地图/阶段等状态显示

---

## 7. 流程简图

```
[用户点击「启动ROSBOT」]
       ↓
RosbotExtensionPanel._toggle_rosbot → _start_rosbot (主线程)
       ↓
set_task_status('rosbot_task', ENABLED)   ← 任务线程之后每 1s 会执行 process_rosbot_task()
       ↓
rosbot_processor.start_rosbot_task()     ← 主线程同步执行
       ↓
RosbotTaskProcessor.start_rosbot()
       ├─ set_log_file(...) 若未初始化
       ├─ set_rosbot_running(True)        → LogMonitor 全速监控
       └─ game_state.set_rosbot_status(True)  → D3State 通知回调
              ↓
       _on_game_state_changed(state)      → container.after(0, _update_ui_from_state)
              ↓
       UI 状态栏更新（ROS/D3/地图/阶段）
```
