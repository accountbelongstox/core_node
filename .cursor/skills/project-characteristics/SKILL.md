---
name: project-characteristics
description: Describes pycore (Python core library of core_node) requirements, conventions, and architecture. Use when developing or modifying code under pycore (pycore_module_caller, callmodule, pylauncher, pythreadpool, native_ui). Enforces three-layer separation, THREAD_BUS-only cross-thread communication, step-based native_ui, and shutdown priority. This skill defines pycore requirements only.
---

# pycore 项目特性（框架与约定）

本 skill 描述的是 **pycore** 的要求与约定（项目特性即 pycore 的框架与开发规范），不涉及项目其他部分。

## When to Use

- Use this skill when developing or modifying code under **pycore** (pycore_module_caller, callmodule, pylauncher, pythreadpool, native_ui).
- Use when adding services, changing tray/startup/main window behavior, or touching THREAD_BUS / launcher / config.

## Instructions

### 入口与三层职责

- **根入口**：`pycore_module_caller.py` → `build_launcher_config()` → `ServiceLauncher(config).start()` → `register_event_handlers()`；主循环等 `THREAD_BUS.is_shutdown_requested()` 后 `launcher.stop()`。
- **callmodule**：只做配置与事件注册（`config.build_launcher_config`、`event_handlers.register_event_handlers`），不启动线程。
- **pylauncher**：单例检测 + 按 `config.services` 调用 pythreadpool 的 starter；不实现具体服务逻辑。
- **pythreadpool**：`SERVICE_STARTERS[name](config)` 启动各服务线程（heartbeat / rpc_v2 / ui / tray），并注册 `register_shutdown_handler`；关机时发 `tray.request_stop`、`{app_id}.close` 等事件。

### THREAD_BUS 通信

- 线程间**不直接调用**，全部通过 THREAD_BUS：`trigger_event`、`register_event_handler`、`signal`/`wait_signal`、`set_thread_state`、`register_shutdown_handler`、`request_shutdown`。
- 事件命名带命名空间（如 `ui.tray.show`、`app.close`、`tray.request_stop`）；需要时 event_data 带 `source`。
- 关机按 `THREAD_REGISTRY` 的 `shutdown_priority` 逆序执行（数字小的先关）。

### Native UI 结构（step0–step10）

- 对外只通过 `pycore.pyutils.native_ui` 的 `__init__.py` 暴露；内部按 step 绝对引用。
- **step0_i18n**：国际化。**step1_config**：NativeUIConfig、TrayConfig。**step2_port_url**：端口与 URL。**step3_launcher**：`launch_native_app`、`launcher_with_startup`。**step4_startup**：TkinterStartupThread（唯一 tk 引导窗）。**step5_main_ui**：PySide6 主窗、WebView、托盘。**step6_tray**：pystray、AppIndicator（Ubuntu）。**step7_managers**：thread_bus_manager、shutdown_manager 等。**step9_frontend**：前端进程。

### 启动顺序（含 UI 时）

1. 先起 TkinterStartupThread（tk 引导），发 `TkinterStartup_ready`。
2. UI 线程内 `wait_signal('TkinterStartup_ready')` 后再 `get_third_package_pyside6()`，再创建 PySide6Framework 与主窗口。
3. 引导结束后可发 `STARTUP_REQUEST_CLOSE` 关 tk；若启用托盘则进 tray（pystray 或 AppIndicator）。
4. 关机：`request_shutdown` → 执行 shutdown handler（如 stop_ui 发 `{app_id}.close`，stop_tray 发 `tray.request_stop`）。

### 平台与托盘

- **platform_adapter**：根据 OS、X11、`XDG_CURRENT_DESKTOP` 给出 `recommended_tray_backend`（APPINDICATOR / PYSTRAY / PYSIDE6 / NONE）。
- Ubuntu/GNOME 桌面优先用 AppIndicator，不可用时退回 pystray。Linux 无 X11 则无托盘。
- `start_tray()` 与 `_run_tray_mode()` 根据推荐后端选择 AppIndicatorSystemTrayThread 或 TkinterSystemTrayThread；菜单用 `build_appindicator_menu_items` 或 `_build_tray_menu_items` 从 TrayConfig 生成。

### 关键文件

- 配置：`pycore/callmodule/config.py`。事件：`pycore/callmodule/event_handlers.py`。
- 启动器：`pycore/pylauncher/launcher.py`。starter 与 registry：`pycore/pythreadpool/starters.py`、`registry.py`。
- THREAD_BUS：`pycore/pyfoundations/thread_bus.py`。Native UI 入口：`pycore/pyutils/native_ui/step3_launcher/launch_native_app.py`。
- tk 引导：`pycore/pyutils/native_ui/step4_startup/startup_window_thread.py`。主窗：`step5_main_ui/pyside6/framework.py`。平台：`pycore/pyutils/native_ui/platform_adapter.py`。

### 开发约定

- 新增服务：在 `registry.py` 的 THREAD_REGISTRY 加条目并设 `shutdown_priority`，在 `starters.py` 中实现 starter 并注册到 SERVICE_STARTERS；关机通过 THREAD_BUS 事件或 shutdown handler，不直接调其他线程。
- 修改托盘/引导/主窗：保持「tk 先于 PySide6」「THREAD_BUS 关窗/关托盘」；Ubuntu 桌面优先 AppIndicator，失败再 pystray。
