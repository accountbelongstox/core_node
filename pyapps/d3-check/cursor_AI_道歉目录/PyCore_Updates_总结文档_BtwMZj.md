# PyCore Updates — 总结文档 [BtwMZj]

对用户提供的 `<content>`（PyCore 更新记录，多条 2025-11-19 条目）的简明总结。

## 结构
- 文档标题为 PyCore Updates，下有多条按日期组织的更新条目。
- 每条含：完成状态、变更说明、代码/目录片段、测试命令或文档路径。
- 主题覆盖：pythreadpool 统一与 launcher 职责、Connection Leak、端口配置、系统集成、Web UI 监控、智能单例、MCP 模块化与 19 工具、工具名长度与 RPC 同步、Flutter 设计文档、MCP RPC 化、线程管理、Proxy-Backend、Singleton 关闭修复等。

## 要点
- **pythreadpool**：删除 thread_pool.py，统一使用 pythreadpool（registry、starters、pool）；launcher 仅负责单例检测与线程调度；通过 get_service 获取 RPC/heartbeat 等实例。
- **连接与端口**：Uvicorn 增加 timeout_keep_alive、limit_max_requests、limit_concurrency 等防 CLOSE_WAIT 泄漏；单例端口 58000–58099，RPC 固定 58100。
- **MCP**：后端单入口 mcp_backend_main.py + backend/（config、handlers、routes）；19 工具分 File/Database/Codebase；智能单例依 MCPGlobalState IDLE/BUSY 决定是否接受 SHUTDOWN；工具名缩短以满足协议长度；RPC v2 支持 sync 路由与 sync_response。
- **单例关闭**：SingletonDetector 的 on_message 在收到 SHUTDOWN 时调用 THREAD_BUS.request_shutdown()，主程序监听后退出。

## 用途
作为 PyCore 在线程池、launcher、MCP 后端、单例、RPC 与连接管理等方面的变更记录，便于维护与问题排查。
