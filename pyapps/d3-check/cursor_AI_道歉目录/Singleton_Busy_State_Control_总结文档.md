# Singleton Busy State Control Example 总结文档

对用户提供的《Singleton Busy State Control Example》的简明总结。

## 结构
- 概述、架构图、三个完整示例（RPC 处理、数据库事务、主线程手动）、测试步骤（双终端）、两种单例模式、API 小结与决策流程、最佳实践、故障排查、总结。

## 要点
- **流程**：新实例发送 SHUTDOWN → 已有实例检查 THREAD_BUS.is_busy() → busy 则拒绝（新实例停止），否则接受（新实例启动）。
- **THREAD_BUS**：set_busy(True/False)、is_busy()、get_busy_reason()；任意线程可调用。
- **LauncherConfig**：singleton、shutdown_existing（尝试替换）、force_launch（忽略已有实例）。
- **实践**：在 try/finally 中清除 busy；提供有意义的 reason；仅用于真正关键操作。

## 用途
说明在单例 + shutdown_existing 场景下，用 THREAD_BUS 避免在关键任务执行时被新实例替换，保证任务不中断。
