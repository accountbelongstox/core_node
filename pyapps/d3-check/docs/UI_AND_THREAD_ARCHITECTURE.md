# D3Check UI 架构与线程规范（梳理文档）

本文档仅描述当前实现的架构与约定，用于分析「切到 D3 Rosbot 扩展 TAB 后卡住」等问题。不包含代码修改建议。

---

## 一、UI 架构

### 1.1 入口与构建顺序

- **入口**: `main.py` → `D3MacroController.run()` → `Diablo3MacroUI(initial_config)` 创建主窗口。
- **主窗口**: `Diablo3MacroUI.root` 为 `tk.Tk()`；所有 UI 构建在 `__init__` 内通过 `_create_ui()` 完成，**未进入 mainloop 前**完成。
- **构建顺序**（`_create_ui` → `_create_main_tabs`）:
  1. `_create_table1_tab()` — 主功能（技能配置等）
  2. `_create_table2_tab()` — 辅助功能
  3. `_create_rosbot_tab()` — D3 Rosbot 扩展（index=2）
  4. `_create_d4_tab()` — D4 功能（index=3）
  5. `_create_coordinate_calibration_tab()` — 坐标校准（index=4）
  6. `_create_table3_tab()` — 测试与日志（index=5）
- 然后: `main_notebook.bind('<<NotebookTabChanged>>', _on_tab_changed)`，再 `main_notebook.select(self.last_selected_tab)`、`bottom_bar.show_tab_content(last_selected_tab)`、`_reregister_log_callback()`。
- **重要**: `select(last_selected_tab)` 会立即触发 `<<NotebookTabChanged>>`，即 **在 mainloop 之前**、仍在 `_create_main_tabs()` 的调用栈内就会执行 `_on_tab_changed(selected_tab)`。

### 1.2 Tab 索引约定

| index | 面板 |
|-------|------|
| 0 | 主功能 (MainFunctionsPanel) |
| 1 | 辅助功能 (AuxiliaryFunctionsPanel) |
| 2 | D3 Rosbot 扩展 (RosbotExtensionPanel) |
| 3 | D4 (D4Panel) |
| 4 | 坐标校准 (CoordinateCalibrationPanel) |
| 5 | 测试与日志 (LogPanel) |

### 1.3 主线程与 after()

- **唯一主线程**: Tk 的 mainloop 所在线程；所有 Tk 控件创建、事件回调、`widget.after(cb)` 的 `cb` 均在该线程执行。
- **规范**: 任何会阻塞主线程的操作（I/O、大量计算、等待其他线程）都不应放在事件回调或 `after` 回调中；若必须做，应改为 `timer_manager.submit_one_shot(fn)` 在 timer 线程执行，再用 `root.after(0, lambda: update_ui(...))` 回主线程更新 UI。

### 1.4 Rosbot 面板当前实现（与卡顿相关）

- **懒加载**: `RosbotExtensionPanel.__init__` 不调用 `create_content()`，设 `_content_created = False`。
- **首次创建**（snapshot 路径）: `_on_tab_changed` 中当 `selected_tab == 2` 时 `root.after(50, ensure_content)`；50ms 后主线程执行 `ensure_content()` → `timer_manager.submit_one_shot(_fetch_rosbot_config_then_create)`。
  - **Timer 线程**：`_fetch_rosbot_config_then_create` 内对 `ROSBOT_PANEL_CONFIG_KEYS` 逐项 `get_config_value_safe(...)` 得到 snapshot，再 `panel.container.after(0, on_main)`。
  - **主线程**：`on_main` 调用 `_create_content_with_snapshot(snapshot)` → `_create_config_panel(snapshot)`（路径区用 `create_input_binding_with_initial(..., snapshot.get(...))`，不触发主线程 config 读）、`_create_control_panel()`、`_create_log_display_row()`，最后 `after(100, _sync_status_ui_once)`。
- **不一致点**：`_create_config_panel(snapshot)` 会调用 `_create_bot_settings(config_frame, snapshot)`，但 `_create_bot_settings(self, parent)` 当前未接受 snapshot，内部仍用 `create_checkbox_binding` / `create_spinbox_binding`，会再次在主线程调用 `get_config_value_safe`（详见第六章）。另存在无参的 `create_content()` 调用 `_create_config_panel()` 无参，签名不匹配。
- **ConfigBinding 通则**：未使用 `*_with_initial` 的 `create_*_binding` 会在创建时调用 `get_config_value_safe`，主线程阻塞一次；批量创建即主线程连续阻塞。

---

## 二、线程模型

### 2.1 线程一览

| 线程 | 用途 | 入口/驱动 |
|------|------|-----------|
| **主线程** | Tk mainloop、所有 UI 创建与事件、after 回调 | `ui.run()` → `root.mainloop()` |
| **Config 线程** | 串行处理 CONFIG 的 get/set，写 CONFIG 并往 SAVE_QUEUE 投递保存 | `_config_worker()`，CONFIG_QUEUE.get() |
| **Save 线程** | 从 SAVE_QUEUE 取任务，执行 `save_config()`（fix_template + 写文件） | `_save_worker()`，SAVE_QUEUE.get() |
| **Timer 线程** | 周期 tick、one-shot 任务（如 do_window_monitor_initial_check） | `timer_manager.start()`；`submit_one_shot(fn)` 在此线程执行 fn |
| **Extension 线程** | MainFunction / Auxiliary / D3Extension / D4Extension 等业务线程 | `ThreadRegistry.create_extension_threads()` 创建并启动 |
| **Tray 线程** | 系统托盘图标与菜单 | `SystemTray.start()` 内 pystray 的 `run()` |

### 2.2 Config 读写约定（providor_index）

- **CONFIG**: 全局 dict；**写**仅由 config 线程在 `_config_set_by_path` 中执行；**读**有两种:
  - **主线程/其他线程**: `get_config_value_safe(key_path, default)` → 投递到 CONFIG_QUEUE，主线程在 `result_q.get()` 上**阻塞**直到 config 线程处理完该 get。
  - **直接读**: 部分代码（如 `_load_last_tab`）使用 `CONFIG.get("ui_settings", {}).get("last_selected_tab", 0)`，不经过 config 线程，存在与 config 线程写 CONFIG 的竞态（当前仅在启动/简单读时使用）。
- **写 CONFIG 并触发保存**:
  - **不阻塞主线程**: `set_config_value_async(key_path, value)` — 仅 `CONFIG_QUEUE.put(("set", ...))`，config 线程处理 set 后 `SAVE_QUEUE.put_nowait(None)`。
  - **主线程已改 CONFIG 后请求保存**: `queue_config_save()` — 仅 `SAVE_QUEUE.put_nowait(None)`，由 save 线程执行 `save_config()`。
- **禁止**: 主线程（或任何非 save 线程）**不得**直接调用 `save_config()`，否则会在此线程执行 fix_config_with_template + 写文件，阻塞 UI。

### 2.3 状态与主线程轮询（game_interface_data）

- **GameInterfaceData**: 单例，持有 Battle.net/D3/ROSBOT 等状态；由 timer/extension 线程写入（如 `refresh_battlenet_status`、`refresh_rosbot_status`），通过 **主线程轮询** 通知 UI。
- **轮询**: `start_main_thread_poll(after_fn, interval_ms=100)` 用 `root.after(100, _drain_and_notify)` 启动；每 100ms 在主线程执行一次 `_drain_and_notify`：取 `get_state_snapshot()`，然后对已注册的 callback（如 Rosbot 的 `_on_game_state_changed`）逐个调用 `callback(state)`。
- **约定**: 所有状态变更的 UI 更新必须经此主线程轮询或经 `root.after(0, ...)` 调度到主线程；后台线程不得直接操作 Tk 控件或调用会阻塞主线程的 config API。

### 2.4 启动完成后的事件顺序（与 Rosbot 卡顿相关）

1. **Controller.run()** 中: 创建 `Diablo3MacroUI` → 注册 window_monitor、`start_main_thread_poll(root.after, 100)`、`create_extension_threads`、`register_extension_handlers` → **start_timer_loop_after_ui_ready()**（启动 timer 并 `submit_one_shot(do_window_monitor_initial_check)`）→ `start_system_tray_if_needed()` → **ui.run()**（mainloop）。
2. 若上次关闭时 **last_selected_tab == 2**：在 `_create_main_tabs()` 里已执行过 `select(2)`，从而已同步执行过 `_on_tab_changed(2)`，其中安排了 **after(50, ensure_content)**。
3. 进入 mainloop 后，很快会依次出现:
   - **约 50ms 后**: `ensure_content()` 在主线程执行 → `create_content()` → 多次 `get_config_value_safe`（路径 + 多个 checkbox/spinbox 绑定），**主线程在每次 get 上阻塞**，直到 config 线程处理完对应请求。
   - **100ms 后**: `_drain_and_notify` 第一次运行，对 Rosbot 的 `_on_game_state_changed(state)` 调用（若 `_content_created` 已为 True 且控件已存在，会更新 UI）。
   - Timer 线程中: `do_window_monitor_initial_check` 执行 `run_full_status_refresh()`（Battle.net + D3 + ROSBOT 检测），不阻塞主线程；结果通过 game_interface_data 由主线程轮询反映到 UI。

---

## 三、规范小结（与卡顿相关的约束）

1. **主线程禁止**:
   - 直接调用 `save_config()`。
   - 在短时间或单次回调内连续多次调用 `get_config_value_safe()`（例如在创建大量 ConfigBinding 控件时），会导致主线程多次阻塞，表现为「切到某 TAB 后卡住」。
2. **主线程允许**:
   - 使用 `set_config_value_async`、`queue_config_save` 触发配置更新与保存。
   - 在控件创建时偶尔单次 `get_config_value_safe`；**批量创建绑定控件** 应视为高风险（当前 Rosbot 面板懒加载后，首次进入 TAB 时集中创建 13+ 个绑定，即 13+ 次主线程阻塞）。
3. **后台线程**:
   - 不得直接操作 Tk 控件或调用会阻塞主线程的 config 读（`get_config_value_safe` 会阻塞调用者所在线程，若在 timer 线程调用则阻塞 timer 线程，一般不在此线程调用）。
   - 状态更新通过 game_interface_data 写入，由主线程轮询或 `root.after(0, ...)` 回主线程更新 UI。

---

## 四、「切到 D3 Rosbot 扩展 TAB 后卡住」的成因归纳

- **现象**: 启动后一旦切换到（或上次关闭时停留在）D3 Rosbot 扩展 TAB，界面无响应一段时间。
- **直接原因**: 
  - 当前 Rosbot 面板采用 **懒加载**：首次选中 TAB 2 时通过 `after(50, ensure_content)` 在主线程执行 `ensure_content()` → `create_content()`。
  - `create_content()` 内会创建 **十余个** ConfigBinding 控件（路径 3 个 input + 多个 checkbox + spinbox），每个创建时调用一次 `get_config_value_safe()`，**主线程在每次调用上阻塞** 等待 config 线程返回。
  - 因此主线程会连续阻塞 13+ 次，总时间 = 13 ×（单次 config 处理延迟）。若 config 线程此时还有此前 `set_config_value_async("ui_settings.last_selected_tab", 2)` 的 set 和 SAVE_QUEUE 的写入压力，或单次处理偏慢，则总阻塞时间可达数百毫秒甚至更长，表现为「卡住」。
- **与架构/规范的关系**:
  - UI 规范：所有 Tk 控件必须在主线程创建；Rosbot 面板内容集中在一次 `create_content()` 中创建，符合「主线程创建」。
  - 线程规范：主线程应避免在单次回调中批量调用 `get_config_value_safe`；当前 ConfigBinding 的设计是「每控件一次 get」，在批量创建时违反该约定，导致卡顿。
- **为何偏偏是 Rosbot TAB**: 因为 Rosbot 面板的 ConfigBinding 数量多（路径 + 多选项 + 超时等），且当前实现为「首次选中 TAB 2 时才创建内容」，于是所有绑定的创建集中发生在一次 `after(50, ...)` 回调中，主线程连续多次阻塞；其他 TAB 要么绑定较少，要么在启动时已创建（分散在不同 tab 的创建顺序中），单次回调内阻塞次数较少，不易形成明显卡顿。

---

## 五、文档与代码位置索引

- 主 UI 构建与 Tab 切换: `ui/diablo3_macro_ui.py`（`_create_ui`, `_create_main_tabs`, `_on_tab_changed`）
- Rosbot 面板: `ui/panels/rosbot_extension_panel.py`（`__init__`, `ensure_content`, `create_content`, `_create_config_panel`）
- Config 线程与 API: `providor/providor_index.py`（`_config_worker`, `_save_worker`, `get_config_value_safe`, `set_config_value_async`, `queue_config_save`）
- ConfigBinding: `ui/utils/config_binding.py`（`get_config_value` → `get_config_value_safe`）
- 主线程轮询: `share/game_interface_data.py`（`start_main_thread_poll`, `_drain_and_notify`）
- 启动与 timer: `controller/d3_macro_controller.py`（`run()`）；`runtime/thread_registry.py`（`start_timer_loop_after_ui_ready`）；`timers/one_shot_tasks.py`（`do_window_monitor_initial_check`）

---

## 六、不合理与规范不一致之处

以下为当前实现中与文档约定不符或容易导致问题的点，**仅做罗列，不改代码**。

### 6.1 CONFIG 写：双写来源，与「仅 config 线程写」不一致

- **约定**：CONFIG 的写应仅由 config 线程在 `_config_set_by_path` 中执行（来自 `set_config_value_async`）。
- **实际**：多处由**主线程**直接写 CONFIG，再调用 `queue_config_save()`，形成「主线程写 CONFIG + save 线程写文件」的第二条写路径。
  - `controller/d3_macro_controller.py`：`update_skill_config` / `update_auxiliary_config` 中 `CONFIG['macro_configs']... = ...` 后 `queue_config_save()`。
  - `ui/panels/main_functions_panel.py`：技能参数/热键等多处 `CONFIG["macro_configs"]["skill_configs"]... = ...` 后 `queue_config_save()`。
  - `ui/panels/auxiliary_functions_panel.py`：热键、spinbox、combobox 等 `CONFIG[...] = ...` 后 `queue_config_save()`。
  - `ui/panels/d4_panel.py`：`CONFIG["d4_settings"]["exp_farming_running"] = ...` 后 `queue_config_save()`。
- **问题**：主线程与 config 线程都可能写 CONFIG，存在竞态；若先 `set_config_value_async("a", 1)` 再主线程 `CONFIG["b"]=2` + `queue_config_save()`，save 线程看到的 CONFIG 同时包含两者，顺序依赖调度，语义不清晰。

### 6.2 CONFIG 读：混用直接读与队列读，无统一规范

- **约定**：若强调线程安全，应通过 `get_config_value_safe` 经 config 线程读；主线程会阻塞。
- **实际**：大量代码**直接** `CONFIG.get(...)`，不经过 config 线程。
  - 主线程：`diablo3_macro_ui.py`（initial_geos、app_icon、`_load_last_tab`）、`main_functions_panel.py`（skill_configs、current_config）、`auxiliary_functions_panel.py`（bag_offset、hotkey）、`controller`（get_skill_config、get_auxiliary_config）等。
  - 后台：`rosbot_flow_state`、`rosbot_manager`、`path_scanner`、`log_analyzer`、`battlenet_status_provider` 等大量 `CONFIG.get(...)`。
- **问题**：直接读与 config 线程写（或主线程写）之间无锁，存在读撕裂/可见性；且「何时用 get_config_value_safe、何时用 CONFIG.get」无成文规则，规范不一致。

### 6.3 Rosbot 面板：create_content 与 _create_config_panel 签名/调用不一致

- **实际**：
  - `ensure_content()` 已改为 `timer_manager.submit_one_shot(_fetch_rosbot_config_then_create)`，在 timer 线程拉取 snapshot 后 `after(0, _create_content_with_snapshot(snapshot))`，符合「主线程不批量 get」的思路。
  - 但 `create_content()` 仍存在且内部调用 `self._create_config_panel()` **无参**，而 `_create_config_panel(self, snapshot: dict)` 需要必选参数 `snapshot`，若被调用会 `TypeError`。
  - `_create_config_panel(snapshot)` 内部调用 `self._create_bot_settings(config_frame, snapshot)`，而 `_create_bot_settings(self, parent)` 当前仅接受 `(self, parent)`，未声明 `snapshot`，调用处多传了一个参数，存在签名与调用不一致。
- **问题**：要么 `create_content()` 已废弃却仍可被误调，要么需统一「仅 snapshot 路径」并让 `_create_bot_settings` 接受并使用 snapshot；当前处于半迁移状态，易出错。

### 6.4 Rosbot 面板：bot_settings 仍用会阻塞主线程的 Binding

- **实际**：`_create_bot_settings(parent)` 内使用 `ConfigBinding.create_checkbox_binding`、`ConfigBinding.create_spinbox_binding`，二者内部会调用 `ConfigBinding.get_config_value` → `get_config_value_safe`，即在**主线程**上阻塞。
- **问题**：若实际走的是 `_create_content_with_snapshot(snapshot)`，且 `_create_bot_settings` 被改成接收 snapshot 并改用 `create_checkbox_binding_with_initial` / `create_spinbox_binding_with_initial`，则不会在主线程再打 config；若未改，则 snapshot 路径下 bot 区仍会在主线程多次调用 get_config_value_safe，与「用 snapshot 避免主线程阻塞」的目标不一致。

### 6.5 主线程在「单次回调内」多次 get_config_value_safe

- **约定**：主线程应避免在单次回调中**批量**调用 `get_config_value_safe`（见第三章）。
- **实际**：除 Rosbot 已部分改为 snapshot 外，其余面板在**创建时**若大量使用 `create_*_binding`（未提供 `*_with_initial`），仍会在一次创建流程中多次调用 `get_config_value_safe`（如 main_functions_panel、auxiliary_functions_panel、log_panel 的 ConfigBinding 创建）。
- **问题**：这些创建发生在启动阶段，若集中在一帧或同一回调中，会拉长主线程阻塞时间，加重「启动或首次切某 TAB 卡一下」的观感；与「主线程不批量阻塞」的规范不一致。

### 6.6 其他零散不一致

- **providor_index**：`save_config()` 内直接 `del CONFIG["skill_configs"]`、写文件等，仅应在 save 线程调用；若某处误在主线程调用（已改为 queue_config_save 的除外），仍会阻塞。当前主流程已改为 queue，但约定应明确「禁止主线程调用 save_config」。
- **unified_config**：存在同名方法 `save_config(self, config_path)`，与 providor 的 `save_config()` 语义不同，易混淆。
- **HTTP bridge**：`_handle_config_save` 调 `queue_config_save()`，未写 CONFIG，仅触发保存；若运行在 uvicorn 工作线程，则「从非主线程调 queue_config_save」是可接受的（不阻塞），但与「配置变更应由主线程或 config 线程写入」的叙事不完全一致（此处是「仅请求保存」）。

---

以上为基于当前代码梳理的**不合理与规范不一致**项，便于后续统一约定或重构时对标。
