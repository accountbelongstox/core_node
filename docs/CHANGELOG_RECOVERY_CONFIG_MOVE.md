# 修改记录（便于恢复）

- 单例在 launcher：非 primary 时 `launcher.start()` 返回 False，main() return，不启动任何服务、不进入 framework。
- `pycore_module_caller.py`：在 `update_tray_menu_with_singleton` 前加 `time.sleep(0.5)`（托盘 handler 注册时序）。恢复：删该行即可。
