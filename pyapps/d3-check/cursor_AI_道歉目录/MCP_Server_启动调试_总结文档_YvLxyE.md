# MCP Server 启动调试输出解决方案 — 总结文档 [YvLxyE]

对用户提供的 `<content>`（MCP Server 启动调试 Markdown 文档）的简明总结。

## 结构
- 标题与问题分析：运行 python pymain.py app=mcp 无显示的两类原因——(1) Python stdout 缓冲，(2) 后端已运行、新实例为 SECONDARY。
- 解决方案：方案 1 使用 python -u；方案 2 设置 PYTHONUNBUFFERED（CMD/PowerShell/Git Bash）；方案 3 创建 start_mcp.bat 或 start_mcp.ps1。
- 已添加调试输出：pymain.py 启动横幅（工作目录、项目根、命令行参数）；mcpserver_main.py 启动信息（时间、PID、CWD、配置如端口、调试模式）。
- 启动输出示例：PRIMARY（首次）与 SECONDARY（后端已运行）的完整输出示例；Singleton 19997、RPC 8767。
- 检查后端状态：netstat/lsof 查端口；taskkill/pkill 停止实例。
- 推荐使用方式、注意事项、文件修改记录（pymain.py、mcpserver_main.py 行号）。

## 要点
- 必须使用 python -u 或 PYTHONUNBUFFERED=1 才能看到实时输出；PRIMARY/SECONDARY 由 Singleton 检测决定。

## 用途
说明 MCP Server 启动无显示的原因与解决办法，以及如何区分主从实例、检查端口与安全重启。
