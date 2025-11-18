# MCP 心跳代理架构设计文档

## 1. 架构概览

### 1.1 核心思想

通过**心跳线程**管理**共享MCP HTTP服务器**，本地MCP代理作为**STDIO接口**，实现：
- ✅ **单服务器多客户端**：1个MCP HTTP服务器服务所有AI客户端
- ✅ **自动启动**：首次调用时自动启动，后续跳过
- ✅ **健康监控**：心跳线程持续检查服务器状态
- ✅ **文件访问**：本地代理在客户端进程，可访问客户端文件
- ✅ **透明转发**：本地代理透明转发请求到HTTP服务器

### 1.2 架构图

```
┌────────────────────────────────────────────────────────────────┐
│  Cursor/Claude Desktop (多个客户端)                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│  │ Client 1 │  │ Client 2 │  │ Client N │                      │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                      │
│       │ STDIO       │ STDIO       │ STDIO                       │
└───────┼─────────────┼─────────────┼────────────────────────────┘
        │             │             │
        ▼             ▼             ▼
┌───────────────────────────────────────────────────────────────┐
│  本地MCP代理进程 (每个客户端一个)                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  MCPProxyServer (STDIO Interface)                       │  │
│  │  - 接收客户端STDIO请求                                    │  │
│  │  - 访问本地文件 (继承客户端权限)                           │  │
│  │  - 转发请求到HTTP服务器 (通过RPC client)                  │  │
│  └──────────────────────────┬──────────────────────────────┘  │
│                             │ HTTP                             │
└─────────────────────────────┼──────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PyHeartbeat System (全局单例)                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  HeartbeatPusher (1秒心跳循环线程)                          │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │  每秒检查：                                           │  │ │
│  │  │  1. MCP HTTP服务器是否运行？                          │  │ │
│  │  │  2. 如果未运行 → 启动 UnifiedRpcServerRunner          │  │ │
│  │  │  3. 如果已运行 → 跳过，更新心跳时间                   │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  MCPServerManager (MCP HTTP服务器管理器)                    │ │
│  │  - start() : 启动HTTP服务器 (跳过已启动)                   │ │
│  │  - stop()  : 停止HTTP服务器                                │ │
│  │  - restart(): 重启HTTP服务器                               │ │
│  │  - is_running(): 检查状态                                  │ │
│  │  - get_heartbeat(): 获取心跳时间                           │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  UnifiedRpcServerRunner (RPC HTTP服务器)                         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  HTTP Routes:                                              │ │
│  │  - GET  /mcp/heartbeat → 返回心跳时间                      │ │
│  │  - POST /mcp/tools/{tool_name} → 执行工具                  │ │
│  │  - GET  /mcp/tools → 列出所有工具                          │ │
│  │  - POST /mcp/resources/{uri} → 访问资源                    │ │
│  │  - WS  /mcp/ws → WebSocket (可选)                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  MCP业务逻辑 (19个工具)                                     │ │
│  │  - File Processing (OCR, 图像分析, PDF解析)                │ │
│  │  - Database (查询, 命名空间管理)                            │ │
│  │  - Codebase (扫描, 搜索, 分析)                              │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 核心组件设计

### 2.1 MCPServerManager (MCP服务器管理器)

**位置**: `pycore/pyheartbeat/mcp_server_manager.py`

**职责**:
- 管理 MCP HTTP 服务器的生命周期
- 提供启动/停止/重启接口
- 防止重复启动
- 记录心跳时间

**接口设计**:
```python
class MCPServerManager:
    """MCP HTTP服务器管理器 - 单例模式"""

    def __init__(self, host='0.0.0.0', port=8000):
        self._host = host
        self._port = port
        self._server_runner = None  # UnifiedRpcServerRunner 实例
        self._running = False
        self._last_heartbeat = None
        self._start_time = None
        self._lock = threading.Lock()

    def start(self, skip_if_running=True) -> bool:
        """启动MCP HTTP服务器

        Args:
            skip_if_running: 如果已运行则跳过 (默认True)

        Returns:
            True: 启动成功或已运行
            False: 启动失败
        """
        with self._lock:
            if self._running:
                if skip_if_running:
                    # 更新心跳时间
                    self._last_heartbeat = time.time()
                    return True
                else:
                    raise RuntimeError("MCP server already running")

            try:
                # 创建RPC服务器 (包含MCP路由)
                self._server_runner = UnifiedRpcServerRunner(
                    host=self._host,
                    port=self._port,
                    debug=False
                )

                # 启动服务器 (在后台线程)
                self._server_runner.start()

                # 等待启动完成
                time.sleep(1)

                self._running = True
                self._start_time = time.time()
                self._last_heartbeat = time.time()

                ColorPrint.green(f"[MCPServerManager] Started at {self._host}:{self._port}")
                return True

            except Exception as e:
                ColorPrint.red(f"[MCPServerManager] Start failed: {e}")
                self._running = False
                return False

    def stop(self) -> bool:
        """停止MCP HTTP服务器"""
        with self._lock:
            if not self._running:
                ColorPrint.yellow("[MCPServerManager] Not running, skip stop")
                return True

            try:
                if self._server_runner:
                    self._server_runner.stop()
                    self._server_runner = None

                self._running = False
                ColorPrint.blue("[MCPServerManager] Stopped")
                return True

            except Exception as e:
                ColorPrint.red(f"[MCPServerManager] Stop failed: {e}")
                return False

    def restart(self) -> bool:
        """重启MCP HTTP服务器"""
        ColorPrint.yellow("[MCPServerManager] Restarting...")
        self.stop()
        time.sleep(1)
        return self.start(skip_if_running=False)

    def is_running(self) -> bool:
        """检查服务器是否运行"""
        return self._running

    def get_heartbeat(self) -> dict:
        """获取心跳信息"""
        return {
            'running': self._running,
            'host': self._host,
            'port': self._port,
            'start_time': self._start_time,
            'last_heartbeat': self._last_heartbeat,
            'uptime': time.time() - self._start_time if self._running else 0
        }

    def update_heartbeat(self):
        """更新心跳时间 (由心跳线程调用)"""
        if self._running:
            self._last_heartbeat = time.time()


# 全局单例
_mcp_server_manager_instance = None

def get_mcp_server_manager(host='0.0.0.0', port=8000) -> MCPServerManager:
    """获取全局MCP服务器管理器单例"""
    global _mcp_server_manager_instance
    if _mcp_server_manager_instance is None:
        _mcp_server_manager_instance = MCPServerManager(host, port)
    return _mcp_server_manager_instance
```

---

### 2.2 HeartbeatMCPKeeper (心跳MCP守护任务)

**位置**: `pycore/pyheartbeat/mcp_keeper.py`

**职责**:
- 注册到 PyHeartbeat 系统
- 每秒检查 MCP HTTP 服务器状态
- 自动启动服务器 (如果未运行)
- 更新心跳时间

**实现**:
```python
from pycore.pyheartbeat import GlobalThreadPool, Task
from pycore.pyheartbeat.mcp_server_manager import get_mcp_server_manager

class HeartbeatMCPKeeper:
    """心跳MCP守护者 - 通过心跳系统自动管理MCP服务器"""

    def __init__(self, host='0.0.0.0', port=8000):
        self.manager = get_mcp_server_manager(host, port)
        self._registered = False

    def register_to_heartbeat(self):
        """注册到心跳系统"""
        if self._registered:
            return

        # 注册虚拟线程 (不是真实线程，只是任务处理器)
        thread_pool = GlobalThreadPool.get_instance()
        thread_pool.register_thread(
            name='mcp_keeper',
            instance=None,  # 不需要真实线程
            task_handlers={
                'mcp_check': self._handle_mcp_check_task
            },
            metadata={
                'description': 'MCP HTTP Server Keeper',
                'auto_check': True  # 标记为自动检查任务
            }
        )

        self._registered = True
        ColorPrint.green("[HeartbeatMCPKeeper] Registered to heartbeat system")

    def _handle_mcp_check_task(self, task: Task) -> bool:
        """处理MCP检查任务 (由心跳线程调用)"""
        try:
            # 检查服务器状态
            if not self.manager.is_running():
                # 未运行 → 启动
                ColorPrint.yellow("[HeartbeatMCPKeeper] MCP server not running, starting...")
                self.manager.start(skip_if_running=True)
            else:
                # 已运行 → 更新心跳
                self.manager.update_heartbeat()

            # 标记任务完成
            task.mark_completed()
            return True  # 接受任务

        except Exception as e:
            ColorPrint.red(f"[HeartbeatMCPKeeper] Check task failed: {e}")
            task.mark_failed(str(e))
            return True

    def start_with_heartbeat(self):
        """启动心跳监控"""
        # 1. 注册到心跳系统
        self.register_to_heartbeat()

        # 2. 提交首次检查任务 (立即启动MCP服务器)
        from pycore.pyheartbeat import UnifiedTaskAPI
        task = UnifiedTaskAPI.add_task(
            task_type='mcp_check',
            task_data={'action': 'initial_check'},
            metadata={'priority': 'high'}
        )

        ColorPrint.green(f"[HeartbeatMCPKeeper] Initial check task submitted: {task.task_id}")

    def submit_periodic_check(self):
        """提交周期性检查任务 (每10秒一次)"""
        from pycore.pyheartbeat import UnifiedTaskAPI
        import threading

        def periodic_submit():
            while True:
                time.sleep(10)  # 每10秒检查一次
                UnifiedTaskAPI.add_task(
                    task_type='mcp_check',
                    task_data={'action': 'periodic_check'}
                )

        thread = threading.Thread(target=periodic_submit, daemon=True)
        thread.start()


# 全局单例
_mcp_keeper_instance = None

def initialize_mcp_heartbeat_keeper(host='0.0.0.0', port=8000) -> HeartbeatMCPKeeper:
    """初始化MCP心跳守护者"""
    global _mcp_keeper_instance
    if _mcp_keeper_instance is None:
        _mcp_keeper_instance = HeartbeatMCPKeeper(host, port)
    return _mcp_keeper_instance
```

---

### 2.3 MCPProxyServer (本地MCP代理)

**位置**: `pyapps/mcp_proxy/mcp_proxy_main.py`

**职责**:
- 提供 STDIO 接口 (与 Cursor/Claude Desktop 通信)
- 访问客户端本地文件 (继承客户端进程权限)
- 转发工具调用到 MCP HTTP 服务器
- 本地文件操作不转发 (直接处理)

**架构**:
```python
from fastmcp import FastMCP
import requests
import os
from pathlib import Path

class MCPProxyServer:
    """MCP代理服务器 - STDIO接口 + HTTP转发"""

    def __init__(self, remote_host='localhost', remote_port=8000):
        self.remote_url = f"http://{remote_host}:{remote_port}"
        self.mcp = FastMCP("MCP Proxy")

        # 注册本地工具 (直接处理，不转发)
        self._register_local_tools()

        # 注册远程工具 (转发到HTTP服务器)
        self._register_remote_tools()

    def _register_local_tools(self):
        """注册本地工具 (文件操作)"""

        @self.mcp.tool()
        def read_local_file(file_path: str) -> str:
            """读取本地文件 (客户端文件系统)"""
            # 支持相对路径 (继承客户端CWD)
            path = Path(file_path).expanduser()
            if not path.is_absolute():
                path = Path.cwd() / path

            with open(path, 'r', encoding='utf-8') as f:
                return f.read()

        @self.mcp.tool()
        def write_local_file(file_path: str, content: str) -> str:
            """写入本地文件 (客户端文件系统)"""
            path = Path(file_path).expanduser()
            if not path.is_absolute():
                path = Path.cwd() / path

            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)

            return f"Written {len(content)} bytes to {path}"

        @self.mcp.tool()
        def list_local_directory(dir_path: str) -> list:
            """列出本地目录"""
            path = Path(dir_path).expanduser()
            if not path.is_absolute():
                path = Path.cwd() / path

            return [str(p) for p in path.iterdir()]

    def _register_remote_tools(self):
        """注册远程工具 (转发到HTTP服务器)"""

        # 首先获取远程服务器的工具列表
        try:
            resp = requests.get(f"{self.remote_url}/mcp/tools", timeout=5)
            remote_tools = resp.json()
        except Exception as e:
            ColorPrint.yellow(f"[MCPProxy] Cannot fetch remote tools: {e}")
            remote_tools = []

        # 动态注册远程工具
        for tool_info in remote_tools:
            self._create_remote_tool(tool_info)

    def _create_remote_tool(self, tool_info: dict):
        """动态创建远程工具"""
        tool_name = tool_info['name']
        tool_desc = tool_info.get('description', 'Remote tool')

        def remote_tool_handler(**kwargs):
            """远程工具处理器"""
            try:
                # 转发到HTTP服务器
                resp = requests.post(
                    f"{self.remote_url}/mcp/tools/{tool_name}",
                    json=kwargs,
                    timeout=30
                )
                resp.raise_for_status()
                return resp.json()
            except Exception as e:
                return {'error': str(e)}

        # 动态注册
        remote_tool_handler.__name__ = tool_name
        remote_tool_handler.__doc__ = tool_desc
        self.mcp.tool()(remote_tool_handler)

    def _register_heartbeat_tool(self):
        """注册心跳检查工具"""

        @self.mcp.tool()
        def get_mcp_server_heartbeat() -> dict:
            """获取MCP HTTP服务器心跳信息"""
            try:
                resp = requests.get(
                    f"{self.remote_url}/mcp/heartbeat",
                    timeout=5
                )
                resp.raise_for_status()
                return resp.json()
            except Exception as e:
                return {
                    'error': str(e),
                    'status': 'unreachable'
                }

    def start(self):
        """启动代理服务器 (STDIO模式)"""
        from pycore.pyfoundations.stdio_utils import ensure_stdio_has_buffer_attributes

        # 确保STDIO正常
        ensure_stdio_has_buffer_attributes()

        ColorPrint.green(f"[MCPProxy] Starting proxy to {self.remote_url}")

        # 运行STDIO服务器
        self.mcp.run(transport="stdio")


def main():
    """启动MCP代理"""
    proxy = MCPProxyServer(
        remote_host=os.getenv('MCP_REMOTE_HOST', 'localhost'),
        remote_port=int(os.getenv('MCP_REMOTE_PORT', '8000'))
    )
    proxy.start()


if __name__ == "__main__":
    main()
```

---

## 3. 启动流程

### 3.1 应用启动时初始化

**位置**: `pymain.py` 或应用入口

```python
from pycore.pyheartbeat import initialize_heartbeat_system
from pycore.pyheartbeat.mcp_keeper import initialize_mcp_heartbeat_keeper

def initialize_application():
    """应用初始化"""

    # 1. 启动心跳系统
    heartbeat_system = initialize_heartbeat_system()
    heartbeat_system.start(tick_interval=1.0)

    # 2. 初始化MCP心跳守护者
    mcp_keeper = initialize_mcp_heartbeat_keeper(
        host='0.0.0.0',
        port=8000
    )

    # 3. 注册到心跳系统 + 提交首次检查
    mcp_keeper.start_with_heartbeat()

    # 4. 启动周期性检查 (可选)
    mcp_keeper.submit_periodic_check()

    ColorPrint.green("[App] MCP Heartbeat Keeper initialized")
```

### 3.2 客户端启动代理

**Cursor配置** (`.cursor/config.json`):
```json
{
  "mcpServers": {
    "unified-proxy": {
      "command": "python",
      "args": [
        "D:/programing/core_node/pymain.py",
        "app=mcp_proxy"
      ],
      "env": {
        "MCP_REMOTE_HOST": "localhost",
        "MCP_REMOTE_PORT": "8000"
      }
    }
  }
}
```

---

## 4. 工作流程

### 4.1 首次启动流程

```
1. 应用启动
   ↓
2. initialize_heartbeat_system() → HeartbeatPusher 启动
   ↓
3. initialize_mcp_heartbeat_keeper() → 注册到心跳系统
   ↓
4. mcp_keeper.start_with_heartbeat()
   ↓
5. 提交 mcp_check 任务到心跳队列
   ↓
6. HeartbeatPusher 1秒后执行任务
   ↓
7. MCPServerManager.start(skip_if_running=True)
   ↓
8. 创建 UnifiedRpcServerRunner
   ↓
9. 启动 HTTP 服务器 (0.0.0.0:8000)
   ↓
10. MCP HTTP 服务器运行中
```

### 4.2 客户端调用流程

```
Cursor/Claude Desktop
   ↓ 启动 MCP Proxy (STDIO)
MCPProxyServer.start()
   ↓ 用户: "读取 ./README.md"
read_local_file("./README.md")
   ↓ 本地处理 (不转发)
返回文件内容
   ↓ 用户: "查询数据库 users 表"
database_query(table="users")  ← 远程工具
   ↓ HTTP POST localhost:8000/mcp/tools/database_query
MCP HTTP Server 处理
   ↓ 返回结果
MCPProxyServer 返回给客户端
```

### 4.3 心跳监控流程

```
HeartbeatPusher 每秒循环
   ↓
检查 GlobalTaskQueue 中的 mcp_check 任务
   ↓
找到 mcp_keeper 处理器
   ↓
调用 _handle_mcp_check_task()
   ↓
MCPServerManager.is_running()?
   ├─ False → MCPServerManager.start()
   └─ True  → MCPServerManager.update_heartbeat()
```

---

## 5. 优势分析

### 5.1 vs 纯STDIO模式

| 特性 | 纯STDIO | 心跳代理模式 |
|------|---------|-------------|
| 进程数量 | N个客户端 = N个MCP | N个代理 + 1个共享MCP |
| 内存占用 | 高 (N × 重量级MCP) | 低 (N × 轻量代理 + 1 × MCP) |
| 启动时间 | 慢 (每次加载数据库等) | 快 (代理轻量) |
| 数据库连接 | N个连接池 | 1个连接池 |
| 文件访问 | ✅ 完全支持 | ✅ 完全支持 |

### 5.2 vs 纯HTTP模式

| 特性 | 纯HTTP | 心跳代理模式 |
|------|--------|-------------|
| 文件访问 | ⚠️ 绝对路径 | ✅ 相对路径 |
| 客户端CWD | ❌ 不继承 | ✅ 继承 |
| 配置复杂度 | 简单 | 中等 |
| 透明性 | 低 (用户感知HTTP) | 高 (用户感知STDIO) |

---

## 6. 关键接口

### 6.1 心跳检查接口

**HTTP GET `/mcp/heartbeat`**

**响应**:
```json
{
  "running": true,
  "host": "0.0.0.0",
  "port": 8000,
  "start_time": 1700000000.123,
  "last_heartbeat": 1700001000.456,
  "uptime": 1000.333
}
```

### 6.2 MCP工具调用接口

**HTTP POST `/mcp/tools/{tool_name}`**

**请求体**:
```json
{
  "arg1": "value1",
  "arg2": "value2"
}
```

**响应**:
```json
{
  "result": "success",
  "data": {...}
}
```

---

## 7. 部署清单

### 7.1 文件清单

```
pycore/pyheartbeat/
├── mcp_server_manager.py        # NEW - MCP服务器管理器
└── mcp_keeper.py                # NEW - 心跳MCP守护者

pyapps/mcp_proxy/
├── __init__.py                  # NEW
└── mcp_proxy_main.py            # NEW - MCP代理服务器

pyapps/mcp/
└── routes/                      # NEW - MCP HTTP路由
    ├── __init__.py
    ├── heartbeat_route.py       # 心跳路由
    ├── tools_route.py           # 工具路由
    └── resources_route.py       # 资源路由
```

### 7.2 配置文件

**Cursor配置** (`.cursor/config.json`):
```json
{
  "mcpServers": {
    "unified-proxy": {
      "command": "python",
      "args": ["D:/programing/core_node/pymain.py", "app=mcp_proxy"],
      "env": {
        "MCP_REMOTE_HOST": "localhost",
        "MCP_REMOTE_PORT": "8000"
      }
    }
  }
}
```

**环境变量** (`.env`):
```bash
# MCP HTTP服务器配置
MCP_SERVER_HOST=0.0.0.0
MCP_SERVER_PORT=8000

# 心跳检查间隔 (秒)
MCP_HEARTBEAT_INTERVAL=10

# RPC服务器配置
RPC_HOST=0.0.0.0
RPC_PORT=8080
```

---

## 8. 下一步实现

### 8.1 优先级1 - 核心组件
- [ ] `MCPServerManager` - 服务器管理器
- [ ] `HeartbeatMCPKeeper` - 心跳守护者
- [ ] 集成到 `pymain.py` 启动流程

### 8.2 优先级2 - 代理服务器
- [ ] `MCPProxyServer` - 代理服务器
- [ ] 本地文件工具
- [ ] 远程工具动态注册

### 8.3 优先级3 - HTTP路由
- [ ] `/mcp/heartbeat` 路由
- [ ] `/mcp/tools/*` 路由
- [ ] `/mcp/tools` 工具列表

### 8.4 优先级4 - 测试验证
- [ ] 单元测试
- [ ] 集成测试 (Cursor连接)
- [ ] 性能测试 (多客户端)

---

## 9. 故障处理

### 9.1 MCP服务器崩溃

**检测**:
- 心跳线程检查 `is_running()` 返回 False

**恢复**:
- 自动调用 `MCPServerManager.start()`
- 日志记录崩溃原因

### 9.2 端口占用

**检测**:
- `UnifiedRpcServerRunner.start()` 抛出异常

**恢复**:
- 尝试备用端口 (8001, 8002, ...)
- 或清理占用端口的进程

### 9.3 代理无法连接HTTP服务器

**检测**:
- `requests.get(f"{remote_url}/mcp/heartbeat")` 超时

**恢复**:
- 本地降级模式 (仅提供本地工具)
- 显示错误提示给用户

---

## 10. 监控指标

### 10.1 服务器指标

- `mcp_server.uptime` - 运行时长
- `mcp_server.last_heartbeat` - 最后心跳时间
- `mcp_server.request_count` - 请求计数
- `mcp_server.error_count` - 错误计数

### 10.2 代理指标

- `mcp_proxy.client_count` - 活跃代理数量
- `mcp_proxy.local_calls` - 本地调用次数
- `mcp_proxy.remote_calls` - 远程调用次数
- `mcp_proxy.failed_calls` - 失败调用次数

---

**文档版本**: v1.0
**创建时间**: 2025-11-19
**作者**: Claude Code
**状态**: 设计完成，待实现
