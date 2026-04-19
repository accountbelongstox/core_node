# MCP Server 启动调试输出解决方案 — 总结文档

对用户提供的 `<content>`（MCP Server 启动调试输出解决方案）的简明总结。

## 结构
- Markdown 文档：问题分析 → 解决方案 → 已添加的调试输出 → 启动输出示例（PRIMARY/SECONDARY）→ 检查后端状态 → 推荐使用方式 → 注意事项 → 文件修改记录。
- 含代码块（bash、batch、PowerShell）与示例输出。

## 要点
- **问题**：运行 `python .\pymain.py app=mcp` 无显示，原因包括 Python stdout 缓冲、以及已有 PRIMARY 实例时新进程以 SECONDARY 启动。
- **解决**：使用 `python -u` 或设置 `PYTHONUNBUFFERED=1`；可选创建 start_mcp.bat/ps1 脚本。
- **调试改进**：pymain.py 增加启动横幅（工作目录、项目根、参数）；mcpserver_main.py 增加启动时间、PID、CWD、配置（端口 19997 singleton、8767 RPC、调试模式）等。
- **实例模式**：PRIMARY 运行 MCP 后端；SECONDARY 仅作客户端连接已有后端；可用 netstat/lsof 查端口、taskkill/pkill 停止。

## 用途
解决 MCP Server 启动时无输出的问题，并说明如何查看启动状态、区分 PRIMARY/SECONDARY 及重启方式；供开发与调试使用。
