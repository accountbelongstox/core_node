# THREAD_BUS 与线程注册中心（d3-check）

## 1. THREAD_BUS（pycore）

- **位置**：`pycore.pyfoundations.thread_bus`，全局单例 `THREAD_BUS`。
- **用途**：线程间通信**唯一通道**。所有事务通知通过全局 queue/信号/事件完成；线程间**禁止**直接传参、互相引用或**互相卡住**（禁止 `queue.get()`、`join()` 等等待另一线程）。
- **d3-check 封装**：`d3utils.event_center` 基于 THREAD_BUS 注册事件与触发器（如 `trigger_app_exit`、`trigger_extension_rosbot_start`）；扩展线程通过 event_center 接收命令、上报完成；主线程通过 `root.after(0, ...)` 调度 UI 更新。

## 2. 禁止线程互相卡住

- **正常运行时**：任意线程不得通过 `queue.get()`、`join()` 等等待另一线程的返回或结束；否则会导致主线程/UI **卡住**。
- **关闭阶段**：主线程可对工作线程 `join(timeout)` 做收尾（如 ShutdownManager、ThreadRegistry.stop_macro_fallback / stop_game_interface_macro）；除此以外禁止跨线程卡住。
- **通信方式**：通过**事件中心**（event_center / THREAD_BUS）发事件；目标线程或主线程在自身 tick/循环中处理事件或通过注册的 handler 响应。
- **命令/状态更新**：对任务线程、Timer、扩展线程等的「启停/状态设置」一律**不卡住入队**（fire-and-forget），由对应 worker 在自身循环中处理；需要「当前状态」时从**共享状态**（如 `D3InterfaceData.rosbot_flow_master_enabled`）读取，不从另一线程同步等待返回值。

## 3. 线程注册中心（ThreadRegistry）

- **位置**：`share/thread_registry.py`，单例 `get_thread_registry()`。
- **职责**：
  - **唯一**创建并持有所有线程实例；**禁止在运行中动态创建线程**。
  - **启动时初始化所有线程**：所有后台线程（TaskThreadManager 及 rosbot_task、TimerManager、扩展线程 Main/Aux/D3/D4、托盘、宏线程等）在 UI 就绪后**一次性创建并启动**。
  - 禁止在任意组件内使用 `self.xxx_thread` 创建或持有线程；禁止线程互相引用、互相卡住。
- **启动与驱动**：**所有线程随 UI 同步启动**；执行仅由**全局状态与 tick**（timer_manager 周期、任务线程 1s tick、rosbot_flow_master_enabled 等）驱动。
- **每线程管理自身状态**：每个线程/任务只维护自己的状态（如 TaskThread 的 status、D3InterfaceData 的 rosbot_flow_master_enabled）；状态更新通过事件或不卡住入队，禁止卡住等待另一线程返回。
- **长生命周期线程**：四路扩展线程（Main/Aux/D3/D4）、宏 fallback、托盘、game_interface_macro、TaskThreadManager 的 worker 与任务线程，由 registry / system_initializer 在启动时创建并启动。
- **线程实现为原生类**：禁止 A 的 run() 仅调用 B.xxx()。组件直接继承 `threading.Thread` 且 `run()` 内实现循环/逻辑。
- **一次性工作**：路径扫描、登录检查、刷新状态、战网 UI 分析、窗口监控首次检测等，通过 **timer_manager.submit_one_shot(callback)** 投递到定时器线程执行，不新建线程。

## 4. 规范小结

| 项 | 要求 |
|----|------|
| 线程互相卡住 | **正常运行时禁止**；一律通过事件中心通信；状态从共享状态读取；**关闭时**主线程可 join(timeout) 收尾 |
| 线程创建/持有 | 仅 ThreadRegistry / system_initializer；禁止动态创建线程 |
| 启动 | 启动时**初始化所有线程**，随 UI 就绪一次性启动 |
| 驱动 | tick 驱动；每线程管理自身状态 |
| 一次性工作 | timer_manager.submit_one_shot 投递到定时器线程，不新建线程 |
| 线程间通信 | 仅通过 THREAD_BUS / event_center（信号、事件、不卡住队列） |
| 线程实现 | 原生类：直接继承 Thread，run() 内直接实现逻辑 |

**TaskThreadManager**：对外 API 均为 fire-and-forget（_fire 不传 result_q）；需要任务状态时通过 `get_task_status(name)` 读 `_status_snapshot`，不跨线程等待。其内部 worker 的 `_cmd_queue.get()` 仅 worker 自身会卡住，调用方不会卡住。

## 5. 相关文件

- 事件中心：`d3utils/event_center.py`
- 线程注册：`share/thread_registry.py`
- 宏 fallback 线程类：`controller/d3_macro_controller.py`（MacroLoopThread、create_macro_fallback_thread）
- 游戏界面宏线程类：`controller/game_interface_controller.py`（GameInterfaceMacroThread、create_macro_thread）
- 托盘：`ui/components/system_tray.py`（SystemTray 直接继承 threading.Thread，run() 内实现托盘循环；无包装类）
- 设计总览：`docs/DESIGN.md` §4
- 定时器与 UI 接线：`timers/README.md`
