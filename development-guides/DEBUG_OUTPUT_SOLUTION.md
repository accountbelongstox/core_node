# MCP Server 启动调试输出解决方案

## 问题分析

运行 `python .\pymain.py app=mcp` 时没有任何显示的原因：

### 1. Python 输出缓冲问题
- Python 默认会缓冲标准输出（stdout）
- 在某些终端环境下，缓冲的输出不会立即显示
- **解决方案**：使用 `python -u` 参数禁用输出缓冲

### 2. 后端已经在运行
从测试输出可以看到：
```
[WARNING] SingletonRPC: Existing instance detected
[WARNING] SingletonRPC: Primary instance detected, starting as secondary instance
✓ Started as SECONDARY instance (reusing MCP backend)
```

这说明已经有一个 MCP Server PRIMARY 实例在运行，新启动的实例自动成为 SECONDARY（客户端模式）。

## 解决方案

### 方案 1：使用 -u 参数禁用缓冲（推荐）
```bash
python -u .\pymain.py app=mcp
```

### 方案 2：设置环境变量
```bash
# Windows CMD
set PYTHONUNBUFFERED=1
python .\pymain.py app=mcp

# Windows PowerShell
$env:PYTHONUNBUFFERED=1
python .\pymain.py app=mcp

# Git Bash / Linux
export PYTHONUNBUFFERED=1
python ./pymain.py app=mcp
```

### 方案 3：创建启动脚本
在项目根目录创建 `start_mcp.bat`：
```batch
@echo off
python -u pymain.py app=mcp
```

或创建 `start_mcp.ps1`（PowerShell）：
```powershell
python -u pymain.py app=mcp
```

## 已添加的调试输出

### pymain.py 改进
✅ 添加了启动横幅，显示：
- 工作目录
- 项目根目录
- 命令行参数

### mcpserver_main.py 改进
✅ 添加了详细的启动信息，显示：
- 启动时间和进程 ID
- 当前工作目录
- 配置信息（端口、调试模式等）

## 启动输出示例

### PRIMARY 实例（首次启动）
```
======================================================================
Python Application Launcher - Starting...
======================================================================
Working Directory: D:\programing\core_node
Project Root: D:\programing\core_node
Command Line Args: ['pymain.py', 'app=mcp']
======================================================================

Matched 'mcp' to app: mcpserver

=== Starting Python App: mcpserver ===
App Directory: D:\programing\core_node\pyapps\mcpserver
App Entry: D:\programing\core_node\pyapps\mcpserver\mcpserver_main.py

======================================================================
MCP Server Main - Entry Point Called
======================================================================
Time: 2025-11-09 19:57:52
PID: 14432
CWD: D:\programing\core_node
Project Root: D:\programing\core_node
======================================================================

Unified MCP Server - Singleton Pattern + WebSocket RPC
All MCP services integrated into single backend:
  • Codebase Scanner
  • File Processor
  • Placeholder Image Generator
  • Database Operations
  • AI Collaboration

Configuration:
  • Singleton Port: 19997
  • RPC Port: 8767
  • Debug Mode: True

✓ Started as PRIMARY instance (running MCP backend)

Role: PRIMARY (Backend Running)
RPC Server: ws://localhost:8767
Singleton Detection: localhost:19997
```

### SECONDARY 实例（后端已运行）
```
======================================================================
MCP Server Main - Entry Point Called
======================================================================
Time: 2025-11-09 19:57:52
PID: 14432

Unified MCP Server - Singleton Pattern + WebSocket RPC

[WARNING] Existing instance detected
[WARNING] Primary instance detected, starting as secondary instance

✓ Started as SECONDARY instance (reusing MCP backend)

Role: SECONDARY (Client Only)
Connected to: ws://localhost:8767

Multiple instances can run - they share the same backend.
Press Ctrl+C to stop.
```

## 检查后端状态

### 查看是否有 PRIMARY 实例在运行
```bash
# Windows
netstat -ano | findstr "19997"
netstat -ano | findstr "8767"

# Linux/Mac
lsof -i :19997
lsof -i :8767
```

### 停止所有 MCP Server 实例
```bash
# Windows
taskkill /F /IM python.exe

# Linux/Mac
pkill -f mcpserver
```

## 推荐使用方式

1. **首次启动（PRIMARY）**：
   ```bash
   python -u pymain.py app=mcp
   ```

2. **检查状态**：查看输出中的 "Role: PRIMARY" 或 "Role: SECONDARY"

3. **如需重启**：
   - Ctrl+C 停止当前实例
   - 如果是 PRIMARY 实例，等待几秒后台服务完全停止
   - 重新运行启动命令

## 注意事项

1. ✅ 所有启动状态现在都会清晰显示
2. ✅ PRIMARY 和 SECONDARY 模式有明确的区分
3. ✅ 配置信息在启动时会打印
4. ⚠️ 必须使用 `python -u` 或设置 `PYTHONUNBUFFERED=1` 才能看到实时输出
5. ⚠️ 如果看到 "SECONDARY instance"，说明后端已经在运行

## 文件修改记录

- `pymain.py:25-64` - 添加启动横幅和详细日志
- `mcpserver_main.py:440-473` - 添加启动信息和配置显示
