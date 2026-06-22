# D3Check Dot 规范文档与 Python 逻辑 1:1 验证报告

本文档验证 `DOT_D3CHECK_SUBLIBRARIES.md`、`DOT_D3CHECK_CONTROLLERS.md`、`DOT_D3CHECK_UI_LIBRARY.md` 是否按 dot 规范与当前 Python 实现逻辑 1:1 对应。验证依据：`unified_config`、`providor`、`runtime`、`controller/d3_macro_controller.py`、`timers`、`share`、`hotkey_registry`、`config_change_hub`、`window_monitor_timer`、`one_shot_tasks`、`main.py` 等。

---

## 1. DOT_D3CHECK_SUBLIBRARIES.md

### 1.1 Config（配置）

| 文档要求 | Python 对应 | 结论 |
|----------|-------------|------|
| key path: `ui_settings.window_geometry`, `ui_settings.app_icon`, `ui_settings.skip_taskbar_win32_fix` | `providor.constants.common`: `UI_SETTINGS_WINDOW_GEOMETRY = "window_geometry"`, `UI_SETTINGS_APP_ICON = "app_icon"`；配置键为 `ui_settings.*` | ✓ 一致 |
| `macro_configs.current_skill_config`, `macro_configs.skill_configs`, `macro_configs.auxiliary_config` | `d3_macro_controller`、`main_functions_panel`、`game_interface_controller` 等均使用上述路径 | ✓ 一致 |
| HOTKEY_CONFIG_PATH_AUXILIARY = `macro_configs.auxiliary_config` | `d3utils/d3u_common/hotkey_registry.py`: `HOTKEY_CONFIG_PATH_AUXILIARY = "macro_configs.auxiliary_config"` | ✓ 一致 |
| CONFIG_USER_PATH、用户数据目录 | `providor_index`: `CURRENT_USER_DATA_PATH = DATA_DIR`，`CONFIG_USER_PATH = os.path.join(CURRENT_USER_DATA_PATH, "d3check_config.json")` | ✓ 一致 |
| 线程安全：get/set 使用 safe/async，与 Python 一致 | `providor_index` 提供 `get_config_value_safe`；UI/controller 使用 `set_config_value_async`、`queue_config_save` | ✓ 一致 |

### 1.2 Constants（常量）

| 文档要求 | Python 对应 | 结论 |
|----------|-------------|------|
| TAB_INDEX_* (0–4), TAB_COUNT=5 | `providor/constants/ui.py`: `TAB_INDEX_MAIN=0` … `TAB_INDEX_LOG=4`, `TAB_COUNT=5` | ✓ 一致 |
| PANEL_KEY_*: main, rosbot, d4, calibration, log | `ui.py`: `PANEL_KEY_MAIN="main"` 等 | ✓ 一致 |
| POPUP_KEY_DEBUG_WINDOW | `ui.py`: `POPUP_KEY_DEBUG_WINDOW = "debug_window"` | ✓ 一致 |
| 技能配置名 config1–config4 | `main_functions_panel`: `["config1","config2","config3","config4"]`；CONFIG 使用 `current_skill_config` 与 `skill_configs` 的 key | ✓ 一致 |
| 默认几何与图标路径 | `common.py`: `DEFAULT_WINDOW_GEOMETRY = "670x550"`, `DEFAULT_APP_ICON_PATH`, `DEFAULT_APP_LOGO_PATH`, `DEFAULT_APP_ICON_PNG_PATH` | ✓ 一致 |
| 字面常量集中存放 | PROJECT_STANDARDS + providor.constants | ✓ 一致 |

### 1.3 Timers（定时器与一次性任务）

| 文档要求 | Python 对应 | 结论 |
|----------|-------------|------|
| one-shot 通过统一入口（如 timer_manager.submit_one_shot）+ 命名 do_* | `timers/timer_manager.submit_one_shot`；`timers/one_shot_tasks`: `do_path_scan`, `do_rosbot_update`, `do_window_monitor_initial_check` 等 | ✓ 一致 |
| 窗口监控命名：run_full_status_refresh、refresh_window_status_if_inactive | `window_monitor_timer`: `refresh_window_status_if_inactive()`；`rosbot_task_processor.run_full_status_refresh()`；tick 驱动调用 | ✓ 一致 |

### 1.4 Config change hub（配置变更枢纽）

| 文档要求 | Python 对应 | 结论 |
|----------|-------------|------|
| 按 key_path 区分：macro_configs.auxiliary_config 开头 → 重绑热键；macro_configs 开头 → 刷新 macro config loader | `d3_macro_controller._apply_config_sync_and_rebind_hotkeys`: `if key_path and key_path.startswith(HOTKEY_CONFIG_PATH_AUXILIARY)` 则 reregister assistant/combat；`if key_path and key_path.startswith("macro_configs")` 则 `get_macro_config_loader().load_active()` | ✓ 一致 |

### 1.5 Lifecycle（生命周期）

| 文档要求 | Python 对应 | 结论 |
|----------|-------------|------|
| 入口仅从 runtime 获取生命周期，不直接依赖 lifecycle/thread 实现 | `runtime/__init__.py` 仅从 lifecycle 与 d3utils 再导出；`main.py` 仅 import runtime | ✓ 一致 |

### 1.6 Share structure（§24）

| 文档要求 | Python 对应 | 结论 |
|----------|-------------|------|
| share/values 仅数据；share/common 公用函数；禁止 run_*/do_* 与业务流进入数据区 | PROJECT_STANDARDS §1.3：values 仅数据与数据访问；common 纯函数/基类；禁止 run_*/do_* 在 values | ✓ 一致 |

### 1.7 Flow state ownership（§25）

| 文档要求 | Python 对应 | 结论 |
|----------|-------------|------|
| 流程状态仅由 flow 库持有；控制器/UI/定时器只调用 flow 公开 API | FLOW_ARCHITECTURE_DIRECTORY + rosbot_flow 等由 d3utils 持有状态；controller 仅调用 process_rosbot_task 等 | ✓ 一致 |

### 1.8 References（引用）

文档已引用 DOT_ARCHITECTURE、PROJECT_STANDARDS、THREAD_BUS_AND_REGISTRY、FLOW_ARCHITECTURE_DIRECTORY、runtime/__init__.py、providor/constants/ui.py、hotkey_registry。✓

---

## 2. DOT_D3CHECK_CONTROLLERS.md

### 2.1 Config change hub（按 key_path 分支）

| 文档要求 | Python 对应 | 结论 |
|----------|-------------|------|
| macro_configs.auxiliary_config 时重绑 assistant/combat 热键 | 见上 1.4；`HOTKEY_CONFIG_PATH_AUXILIARY` → reregister_assistant_hotkey, reregister_combat_hotkey | ✓ 一致 |
| macro_configs 时刷新 macro config loader | `get_macro_config_loader().load_active()` | ✓ 一致 |

### 2.2 Window monitor（窗口监控）

| 文档要求 | Python 对应 | 结论 |
|----------|-------------|------|
| 注册 bottom_bar 的 on_window_status_update | `d3_macro_controller`: `callback = self.ui.get_window_status_callback()`，`window_monitor.add_callback(callback)`；UI 提供 `get_window_status_callback()` 返回 bottom_bar 回调 | ✓ 一致 |
| register_status_ui(bottom_bar.update_status_from_state) | `window_monitor.register_status_ui(self.ui.bottom_bar.update_status_from_state)` | ✓ 一致 |
| Rosbot 面板 set_register_status_ui_fn / set_refresh_status_fn；get_status_ui_callback、refresh_window_status_if_inactive | `panel.set_register_status_ui_fn(lambda: window_monitor.register_status_ui(panel.get_status_ui_callback()))`，`panel.set_refresh_status_fn(window_monitor.refresh_window_status_if_inactive)`；`rosbot_extension_panel` 实现上述方法 | ✓ 一致 |

### 2.3 Game interface poll（游戏界面轮询）

| 文档要求 | Python 对应 | 结论 |
|----------|-------------|------|
| start_main_thread_poll(dispatch, 100) | `get_game_interface_data().start_main_thread_poll(self.ui.root.after, 100)` | ✓ 一致 |

### 2.4 Extension threads（扩展线程）

| 文档要求 | Python 对应 | 结论 |
|----------|-------------|------|
| 传入：Rosbot panel、current_skill_config、Battlenet login-check provider（如 for_f2_only）、D4 process | `get_thread_registry().create_extension_threads(schedule, panel, self.current_skill_config, battlenet_login_check_provider=lambda: get_login_try_screenshot_controller().ensure_battlenet_started_and_login_check(for_f2_only=True), d4_process_fn=get_d4_controller().process)` | ✓ 一致 |

### 2.5 Rosbot / path scan（路径扫描与 Rosbot）

| 文档要求 | Python 对应 | 结论 |
|----------|-------------|------|
| startup_path_scan_needed()、延迟约 800ms | `if panel.startup_path_scan_needed(): self.ui.root.after(800, lambda: panel._submit_path_scan_if_throttle_ok())` | ✓ 一致 |
| ensure_current_tab_content_if_needed、ensure_content | `self.ui.root.after(0, self.ui.ensure_current_tab_content_if_needed)`；Rosbot 面板实现 `ensure_content()`、`ensure_content_sync()`；主窗 `ensure_current_tab_content_if_needed()` 中调用 rosbot.ensure_content() | ✓ 一致 |

### 2.6 Skill config（技能配置）

| 文档要求 | Python 对应 | 结论 |
|----------|-------------|------|
| 仅允许 config1–config4 | 见 1.2；UI 与 controller 均使用该集合 | ✓ 一致 |

### 2.7 Login-try controller（登录尝试控制器）

| 文档要求 | Python 对应 | 结论 |
|----------|-------------|------|
| register_login_controller_actions、register_login_try_callback | `d3_macro_controller`: `register_login_try_callback(lambda: _login_ctrl.handle_login_try())`；`register_login_controller_actions(_login_ctrl.ensure_battlenet_started_and_login_check, _login_ctrl.ensure_d3_running_from_battlenet_no_rosbot, _login_ctrl.ensure_battlenet_only)`；`one_shot_tasks.register_login_controller_actions`、`log_analyzer.register_login_try_callback` | ✓ 一致 |

### 2.8 References（引用）

文档已引用 main.py、d3_macro_controller、hotkey_registry、PROJECT_STANDARDS、FLOW_ARCHITECTURE_DIRECTORY。✓

---

## 3. DOT_D3CHECK_UI_LIBRARY.md

与 Python UI 的对应关系（布局、5 个 tab、panel key、bottom bar、geometry、config 键）已在文档中按 ui_settings、macro_configs、panel key、i18n 等列出，且与 `providor.constants.ui`、`main_functions_panel`、`rosbot_extension_panel` 等使用一致。✓

---

## 4. 结论与建议

- **结论**：三份文档在**配置路径、常量、定时器/one-shot 命名、config change hub 按 key_path 分支、生命周期仅通过 runtime、share 结构、flow 状态归属、窗口监控注册、游戏轮询、扩展线程参数、Rosbot 路径扫描与延迟、技能配置集合、login-try 注册**等方面与当前 Python 逻辑 **1:1 对齐**，且与 DOT_ARCHITECTURE、dot.mdc、PROJECT_STANDARDS、d3-check.mdc、FLOW_ARCHITECTURE_DIRECTORY 及代码中的常量、路径、线程与流程约定一致。
- **建议**（可选，便于 dot 实现时完全对标）：
  - 在 **DOT_D3CHECK_SUBLIBRARIES.md** §1 Config 中可补充一句：用户配置文件名为 `d3check_config.json`，即 `CONFIG_USER_PATH` 指向 `{CURRENT_USER_DATA_PATH}/d3check_config.json`，与 Python `providor_index.CONFIG_USER_PATH` 一致。
  - 其余细节（具体函数名、签名、引用表）文档已覆盖且可追溯至上述 Python 文件。

---

**验证完成日期**：按代码库当前状态；若 Python 侧新增配置键或控制器行为，建议同步更新三份 DOT 文档并重新跑本验证清单。
