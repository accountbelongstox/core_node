---
name: project-characteristics
description: Describes pycore (Python core library of core_node) requirements, conventions, and architecture. Use when developing or modifying code under pycore (pycore_module_caller, callmodule, pylauncher, pythreadpool, native_ui). Enforces three-layer separation, THREAD_BUS-only cross-thread communication, step-based native_ui, and shutdown priority. This skill defines pycore requirements only.
---

# pycore 规范

- 三层职责固定：callmodule 只做配置+事件注册；pylauncher 只做单例检测+按 config.services 分发；pythreadpool 才启动/管理服务线程——不得越层实现业务逻辑。
- 线程间禁止直接调用，一律走 THREAD_BUS（trigger_event/register_event_handler/signal/wait_signal/request_shutdown），事件名带命名空间。
- 关机按 THREAD_REGISTRY.shutdown_priority **数字小的先关**（与启动顺序相反）。
- Native UI：tk 引导发出 `TkinterStartup_ready` 后才可初始化 PySide6；关闭一律走 THREAD_BUS 事件，禁止直接销毁窗口/托盘。
- 托盘后端：Ubuntu/GNOME 优先 AppIndicator，不可用退回 pystray；无 X11 不建托盘。
- 新增服务：THREAD_REGISTRY 加条目定 shutdown_priority + starters.py 注册 SERVICE_STARTERS；关机只能走 THREAD_BUS/shutdown handler。
