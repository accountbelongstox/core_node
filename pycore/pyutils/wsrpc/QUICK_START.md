# WebSocket RPC Singleton Extension - Quick Start
# WebSocket RPC 单例扩展 - 快速开始

[English](#english) | [中文](#中文)

---

## English

### What is this?

An extension to the `wsrpc` framework that allows multiple client instances to share a single backend process using singleton pattern. This reduces resource usage and startup time.

### Key Features

- ✅ Automatic singleton detection via socket port
- ✅ Dual-thread architecture (backend + client communication)
- ✅ Pure Python standard library (no external dependencies for singleton logic)
- ✅ Seamless integration with WebSocket RPC
- ✅ Resource sharing among multiple clients

### Files Created

```
pycore/pyutils/wsrpc/
├── singleton_backend.py           # Core singleton detection module
├── singleton_rpc_example.py       # RPC integration example
├── test_singleton.py              # Test script
├── SINGLETON_README.md            # Full documentation
└── QUICK_START.md                 # This file

pycore/pyutils/
└── singleton_launcher_template.py # Standalone template (copy to any project)
```

### Quick Start

#### 1. Simple Test (No Dependencies)

```bash
# Terminal 1: Start first instance (becomes primary)
cd D:\programing\core_node\pycore\pyutils\wsrpc
python test_singleton.py

# Terminal 2: Start second instance (becomes secondary)
python test_singleton.py

# You'll see only one backend running, shared by both instances!
```

#### 2. With WebSocket RPC

```bash
# Start the RPC example
python singleton_rpc_example.py

# In another terminal
python singleton_rpc_example.py

# First instance: Runs RPC server + client
# Second instance: Only runs client (reuses server)
```

#### 3. Copy Template to Your Project

```python
# Copy singleton_launcher_template.py to your project
from singleton_launcher_template import SingletonLauncher

class MyApp(SingletonLauncher):
    def run_backend(self):
        while self._running:
            print("Backend working...")
            time.sleep(1)

    def run_client_communication(self):
        while self._running:
            print("Client working...")
            time.sleep(1)

app = MyApp(port=19999)
app.start()
```

### Commands

```bash
# Run test
python test_singleton.py

# Query status
python test_singleton.py status

# Send shutdown signal
python test_singleton.py shutdown
```

### Usage in Your Code

```python
# Import
from pycore.pyutils.wsrpc import SingletonBackendDetector

# Or for RPC integration
from pycore.pyutils.wsrpc.singleton_rpc_example import SingletonRpcBackend

# Check if instance exists
from pycore.pyutils.wsrpc import get_instance_status, send_shutdown_signal

status = get_instance_status(port=19999)
send_shutdown_signal(port=19999)
```

### Configuration

```python
backend = SingletonBackendDetector(
    host='localhost',      # Singleton detection host
    port=19999,            # Singleton detection port
    timeout=2,             # Detection timeout (seconds)
    debug=True             # Enable debug logging
)
```

---

## 中文

### 这是什么？

这是对 `wsrpc` 框架的扩展，使用单例模式允许多个客户端实例共享单个后端进程。这可以减少资源使用和启动时间。

### 主要特性

- ✅ 通过socket端口自动检测单例
- ✅ 双线程架构（后端 + 客户端通信）
- ✅ 纯Python标准库（单例逻辑无外部依赖）
- ✅ 与WebSocket RPC无缝集成
- ✅ 多客户端共享资源

### 创建的文件

```
pycore/pyutils/wsrpc/
├── singleton_backend.py           # 核心单例检测模块
├── singleton_rpc_example.py       # RPC集成示例
├── test_singleton.py              # 测试脚本
├── SINGLETON_README.md            # 完整文档
└── QUICK_START.md                 # 本文件

pycore/pyutils/
└── singleton_launcher_template.py # 独立模板（可复制到任何项目）
```

### 快速开始

#### 1. 简单测试（无依赖）

```bash
# 终端1：启动第一个实例（成为主实例）
cd D:\programing\core_node\pycore\pyutils\wsrpc
python test_singleton.py

# 终端2：启动第二个实例（成为次要实例）
python test_singleton.py

# 你会看到只有一个后端在运行，两个实例共享！
```

#### 2. 使用WebSocket RPC

```bash
# 启动RPC示例
python singleton_rpc_example.py

# 在另一个终端
python singleton_rpc_example.py

# 第一个实例：运行RPC服务器 + 客户端
# 第二个实例：只运行客户端（复用服务器）
```

#### 3. 复制模板到你的项目

```python
# 复制 singleton_launcher_template.py 到你的项目
from singleton_launcher_template import SingletonLauncher

class MyApp(SingletonLauncher):
    def run_backend(self):
        while self._running:
            print("后端工作中...")
            time.sleep(1)

    def run_client_communication(self):
        while self._running:
            print("客户端工作中...")
            time.sleep(1)

app = MyApp(port=19999)
app.start()
```

### 命令

```bash
# 运行测试
python test_singleton.py

# 查询状态
python test_singleton.py status

# 发送关闭信号
python test_singleton.py shutdown
```

### 在代码中使用

```python
# 导入
from pycore.pyutils.wsrpc import SingletonBackendDetector

# 或用于RPC集成
from pycore.pyutils.wsrpc.singleton_rpc_example import SingletonRpcBackend

# 检查实例是否存在
from pycore.pyutils.wsrpc import get_instance_status, send_shutdown_signal

status = get_instance_status(port=19999)
send_shutdown_signal(port=19999)
```

### 配置

```python
backend = SingletonBackendDetector(
    host='localhost',      # 单例检测主机
    port=19999,            # 单例检测端口
    timeout=2,             # 检测超时（秒）
    debug=True             # 启用调试日志
)
```

---

## Architecture | 架构

```
┌─────────────────────────────────────────────────────────┐
│           First Instance (Primary) | 第一个实例（主）     │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────┐      ┌─────────────────────────┐  │
│  │ Singleton       │      │ Backend Thread          │  │
│  │ Detection       │◄─────┤ 单例检测                 │  │
│  │ Port: 19999     │      │ - RPC Server            │  │
│  └─────────────────┘      │ - Business Logic        │  │
│                            └─────────────────────────┘  │
│                            ┌─────────────────────────┐  │
│                            │ Communication Thread    │  │
│                            │ 通信线程                 │  │
│                            │ - RPC Client            │  │
│                            └─────────────────────────┘  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│      Second Instance (Secondary) | 第二个实例（次要）    │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────┐                                    │
│  │ Singleton       │───► Detects Existing              │
│  │ Detection       │     检测到已存在                   │
│  └─────────────────┘                                    │
│                            ┌─────────────────────────┐  │
│                            │ Communication Thread    │  │
│                            │ 通信线程                 │  │
│                            │ - RPC Client            │  │
│                            └──────────┬──────────────┘  │
│                                       │                 │
│                                       ▼                 │
│                          Connects to Primary Backend   │
│                          连接到主后端                    │
└─────────────────────────────────────────────────────────┘
```

## Benefits | 优势

| Aspect | Traditional | With Singleton | 方面 | 传统方式 | 使用单例 |
|--------|-------------|----------------|------|---------|---------|
| Startup Time | 5s per instance | First: 5s, Others: 1s | 启动时间 | 每个实例5秒 | 首个5秒，其他1秒 |
| Memory Usage | 100MB per instance | First: 100MB, Others: 20MB | 内存使用 | 每个100MB | 首个100MB，其他20MB |
| Resource Usage | High | Shared, Lower | 资源使用 | 高 | 共享，更低 |
| Complexity | Simple | Moderate | 复杂度 | 简单 | 中等 |

## Use Cases | 使用场景

### English
- Desktop apps with multiple windows
- Services with multiple client tools
- Background workers with shared resources
- Development tools with hot-reload clients

### 中文
- 多窗口桌面应用
- 带多个客户端工具的服务
- 共享资源的后台工作进程
- 带热重载客户端的开发工具

## Next Steps | 下一步

### English
1. Read `SINGLETON_README.md` for detailed documentation
2. Run `test_singleton.py` to see it in action
3. Check `singleton_rpc_example.py` for RPC integration
4. Copy `singleton_launcher_template.py` to your project

### 中文
1. 阅读 `SINGLETON_README.md` 获取详细文档
2. 运行 `test_singleton.py` 查看实际效果
3. 查看 `singleton_rpc_example.py` 了解RPC集成
4. 复制 `singleton_launcher_template.py` 到你的项目

## Troubleshooting | 故障排除

### English
- **Port in use**: Change port or shutdown existing instance
- **Detection fails**: Check firewall, try '127.0.0.1' instead of 'localhost'
- **RPC connection fails**: Wait for server startup, check port

### 中文
- **端口被占用**：更改端口或关闭现有实例
- **检测失败**：检查防火墙，尝试用'127.0.0.1'代替'localhost'
- **RPC连接失败**：等待服务器启动，检查端口

## Support | 支持

For issues and questions, please check:
如有问题，请查看：

- Full documentation: `SINGLETON_README.md`
- Example code: `singleton_rpc_example.py`
- Test script: `test_singleton.py`
