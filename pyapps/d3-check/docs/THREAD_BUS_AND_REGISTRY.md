# THREAD_BUS 与线程注册中心（d3-check）

## 1. THREAD_BUS（pycore）

- **位置**：`pycore.pyfoundations.thread_bus`，全局单例 `THREAD_BUS`。
- **用途**：线程间通信唯一通道。所有事务通知通过全局 queue/信号/事件完成；线程间**禁止**直接传参或互相引用。
- **d3-check 封装**：`d3utils.event_center` 基于 THREAD_BUS 注册事件与触发器（如 `trigger_app_exit`、`trigger_extension_rosbot_start`），扩展线程通过 event_center 接收命令、上报完成。

## 2. 线程注册中心（ThreadRegistry）

- **位置**：`share/thread_registry.py`，单例 `get_thread_registry()`。
- **职责**：
  - **唯一**创建并持有所有线程实例。主线程（controller/initializer）只通过 ThreadRegistry 引用线程（如 `create_extension_threads`、`run_path_scan`、`start_timer_loop_after_ui_ready`）。
  - 禁止在任意组件内使用 `self.xxx_thread` 创建或持有线程；禁止线程互相引用。
- **长生命周期线程**：四路扩展线程（Main/Aux/D3/D4）、宏 fallback、托盘、game_interface_macro 由 registry 创建并存储，对外通过 getter 或模块级 set/get（如 `get_main_function_thread()`）供 event_center 等使用。
- **一次性任务**：路径扫描、登录检查、刷新状态、战网 UI 分析、窗口监控首次检测等，由 registry 在收到主线程请求时创建线程并 start，不存储引用。

## 3. 规范小结

| 项 | 要求 |
|----|------|
| 线程创建/持有 | 仅 ThreadRegistry；禁止 `self.xxx_thread` 定义或持有线程 |
| 线程引用 | 仅主线程通过 `get_thread_registry()` 获取并操作 |
| 线程间通信 | 仅通过 THREAD_BUS / event_center（信号、事件、队列） |
| 线程实现 | 所有后台逻辑继承 `threading.Thread`，重写 `run()`，由 registry 或 timer_manager 等统一 start |

## 4. 相关文件

- 事件中心：`d3utils/event_center.py`
- 线程注册：`share/thread_registry.py`
- 设计总览：`docs/DESIGN.md` §4
- 定时器与 UI 接线：`timers/README.md`
