# THREAD_BUS 与线程注册中心（d3-check）

## 1. THREAD_BUS（pycore）

- **位置**：`pycore.pyfoundations.thread_bus`，全局单例 `THREAD_BUS`。
- **用途**：线程间通信唯一通道。所有事务通知通过全局 queue/信号/事件完成；线程间**禁止**直接传参或互相引用。
- **d3-check 封装**：`d3utils.event_center` 基于 THREAD_BUS 注册事件与触发器（如 `trigger_app_exit`、`trigger_extension_rosbot_start`），扩展线程通过 event_center 接收命令、上报完成。

## 2. 线程注册中心（ThreadRegistry）

- **位置**：`share/thread_registry.py`，单例 `get_thread_registry()`。
- **职责**：
  - **唯一**创建并持有所有线程实例；**禁止在运行中动态创建线程**（防止卡住）。主线程只通过 ThreadRegistry 引用线程（如 `create_extension_threads`、`run_path_scan`、`start_timer_loop_after_ui_ready`）。
  - 禁止在任意组件内使用 `self.xxx_thread` 创建或持有线程；禁止线程互相引用。
- **启动与驱动**：**所有线程随 UI 同步启动**；执行仅由**全局状态与 tick**（timer_manager 周期 + 命令队列）驱动。
- **长生命周期线程**：四路扩展线程（Main/Aux/D3/D4）、宏 fallback、托盘、game_interface_macro 由 registry 在启动时创建并存储，对外通过 getter 或模块级 set/get 供 event_center 等使用。
- **线程实现为原生类**：禁止使用一个类对另一个类做简单封装（如 A 的 run() 仅调用 B.xxx()）。须满足其一：(1) 需在后台运行的组件**直接继承 threading.Thread**（如 `SystemTray(threading.Thread)`，其 `run()` 内实现托盘循环；无单独 TrayRunnerThread 包装类）；(2) 线程类的 **run() 内直接实现循环/逻辑**，仅将控制器等作为数据或回调使用，不单纯转发到另一对象的一个方法。例如：`MacroLoopThread.run()`、`GameInterfaceMacroThread.run()` 内直接写宏循环；Registry 通过 controller.create_macro_fallback_thread()、controller.create_macro_thread() 获取实例，托盘则 tray 自身为 Thread 由 registry.start_tray(tray) 直接 start。
- **一次性工作**：路径扫描、登录检查、刷新状态、战网 UI 分析、窗口监控首次检测等，通过 **timer_manager.submit_one_shot(callback)** 投递到定时器线程执行，**不新建线程**。

## 3. 规范小结

| 项 | 要求 |
|----|------|
| 线程创建/持有 | 仅 ThreadRegistry；禁止 `self.xxx_thread`；**禁止动态创建线程** |
| 启动与驱动 | 所有线程随 UI 同步启动；仅由全局状态与 tick 驱动 |
| 一次性工作 | 通过 timer_manager.submit_one_shot 投递到定时器线程，不新建线程 |
| 线程引用 | 仅主线程通过 `get_thread_registry()` 获取并操作 |
| 线程间通信 | 仅通过 THREAD_BUS / event_center（信号、事件、队列） |
| 线程实现 | 原生类：禁止 A 仅包装 B；组件直接继承 Thread 或线程 run() 内直接实现逻辑，不单纯调用另一对象单方法 |

## 4. 相关文件

- 事件中心：`d3utils/event_center.py`
- 线程注册：`share/thread_registry.py`
- 宏 fallback 线程类：`controller/d3_macro_controller.py`（MacroLoopThread、create_macro_fallback_thread）
- 游戏界面宏线程类：`controller/game_interface_controller.py`（GameInterfaceMacroThread、create_macro_thread）
- 托盘：`ui/components/system_tray.py`（SystemTray 直接继承 threading.Thread，run() 内实现托盘循环；无包装类）
- 设计总览：`docs/DESIGN.md` §4
- 定时器与 UI 接线：`timers/README.md`
