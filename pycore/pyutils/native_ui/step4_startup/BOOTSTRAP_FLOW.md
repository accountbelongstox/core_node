# TK 引导启动流程 (Bootstrap Flow)

## 确认：tk 引导 + 第三方包引用时自动安装 + PySide6 引用后构建

- **tk 用途**：引导窗，用于等待/展示第三方包安装过程；不依赖 PySide6，仅需 tkinter（或系统 python3-tk）。
- **第三方包**：通过 `pycore.pyfoundations.third_party` 的 `get_third_package_*` 引用；**引用时自动检查并安装**（`_lazy_import`：先 `import`，失败则查 `DEPENDENCY_MAP` 后 `pip install` 再重试）。PySide6 在 `DEPENDENCY_MAP` 中为 `"PySide6": "PySide6"`。
- **PySide6 构建**：在 tk 就绪后**才引用** PySide6（`get_third_package_pyside6()`），引用完成后才 `from .framework import PySide6Framework` 并 `framework.start()`，即**先引用（可能安装）再构建主窗口**。

当前代码对应关系：
- `ui_thread.run()`：先显示 tk → `wait_signal('TkinterStartup_ready')` → `get_third_package_pyside6()`（引用时可能安装）→ 再创建 framework 并 `framework.start()`（构建大窗口）。
- `third_party.py`：`get_third_package_pyside6()` 使用 `_lazy_import('PySide6', 'import PySide6')`，若未安装会 `pip install PySide6` 后重试导入。
- `system.third_party_packages_loaded`：由 launcher 在所有服务 **start** 完成后触发；framework 监听后若 `auto_close` 则关闭 tk 引导窗。

## 正确顺序

1. **先出现 tk 小窗**（引导窗）
   - 不依赖 PySide6，仅需 tkinter（或系统 python3-tk）
   - 用于显示启动日志、依赖安装进度
   - 标题带 `debug #1` 等标识

2. **引导过程中**
   - 可在 tk 窗中显示「正在检查/安装依赖…」
   - 如需 PySide6，在此时检查/安装，日志输出到 tk 窗

3. **引导完成后**
   - 收到 `system.third_party_packages_loaded` 或等价就绪信号
   - 若配置了 auto_close，关闭 tk 引导窗
   - **再**创建并显示 PySide6 主窗口（大窗口 "Voice Subtitle"）

## 错误顺序（当前曾出现的问题）

- 先加载/检查 PySide6（start_ui 或 ui_thread 入口处）
- 再启动 UI 线程并跑 framework.start()
- framework 里先 show_startup() 再立刻创建 QApplication/主窗口，**未等待** tk 就绪
- 结果：大窗口先被创建和显示，tk 小窗后出现或几乎同时出现

## 修复要点（已实现）

1. **framework.start()**  
   在 `show_startup()` 之后、创建 Qt 应用/主窗口之前：
   - `THREAD_BUS.wait_signal('TkinterStartup_ready', timeout=10.0)`  
   保证「先 tk 可见，再大窗口」。

2. **PySide6 检查/安装时机**  
   - **start_ui()**（starters.py）：不再在入口处调用 `get_third_package_pyside6()`。  
   - **PySide6UIThread.run()**（ui_thread.py）：先显示 tk 引导窗并 `wait_signal('TkinterStartup_ready')`，再调用 `get_third_package_pyside6()`，再 `from .framework import PySide6Framework` 并创建 framework。  
   这样引导过程（含安装 PySide6）都在 tk 窗可见，顺序为：tk 先出现 → 再加载/安装 PySide6 → 再创建大窗口。

3. **existing_startup_thread**  
   framework 支持 `existing_startup_thread` 参数：当 ui_thread 已在 run() 里先创建并显示了 TkinterStartupThread 时，将该 thread 传入 framework，framework 不再重复 show_startup()，直接使用该 tk 窗做 log_startup。

4. **单例 tk 构建**  
   仅保留一处 tk 构建实现：`TkinterStartupThread`（startup_window_thread.py），launcher 与 framework 共用，关闭统一走 THREAD_BUS。
