# MCP Backend → RPC v2 Migration Plan

**Date**: 2025-11-19
**Status**: 🚧 In Progress
**Priority**: P0 (架构重构)

---

https://claude.ai/oauth/authorize?code=true&client_id=9d1c250a-e61b-44d9-88ed-5944d1962f5e&response_type=code&redirect_uri=https%3A%2F%2Fconsole.anthropic.com%2Foauth%2Fcode%2Fcallback&scope=user%3Ainference&code_challenge=0uTfxYYBVo_s-Rkr-i8Ob86w6XE5wN_3WmayeFRBH0c&code_challenge_method=S256&state=FAtUGXJFoVmRBj-CHujoZDrtSqGID3sZJH7ZRI8mUzQ


unNcWiBF6nkVmxzioP0fRkjvNEnm50FSKFDpIIKoaW6tkQy7#FAtUGXJFoVmRBj-CHujoZDrtSqGID3sZJH7ZRI8mUzQ

## 当前问题

### 问题1: 架构混乱
- **Current**: MCP Backend直接实现FastAPI HTTP服务器
- **Issue**: 与RPC v2架构重复，维护两套HTTP服务器代码
- **Impact**: 数据格式不一致，前端RPC Client期待 `result` 字段但某些路由返回 `data`

### 问题2: 连接泄漏（已修复uvicorn配置，但需要RPC v2完整方案）
- **Fixed**: 添加了 `timeout_keep_alive=5` 等参数
- **Better Solution**: RPC v2内置连接管理和ACK机制

### 问题3: 缺少完整的RPC协议
- **Missing**: WebSocket支持、请求持久化、Inventory Table、ACK管理
- **Exists in**: `pycore.pyutils.rpc_v2` 已实现完整协议

---

## 迁移方案

### 第1步：配置PyLauncher支持RPC v2 ✅ (优先级最高)

**目标**: PyLauncher启动RPC v2服务器和心跳线程，而非直接启动FastAPI

**需要修改的文件**:
1. `pycore/pylauncher/launcher.py`:
   - 添加 `enable_rpc_v2: bool = False` 到 ServiceConfig
   - 添加 `rpc_v2_server: Optional[Any] = None` 到 ServiceInstances
   - 在 `launch_services()` 中检测 `enable_rpc_v2`，启动RPC v2服务器

**示例代码**:
```python
# pycore/pylauncher/launcher.py

@dataclass
class ServiceConfig:
    # ... existing fields ...

    # RPC v2 Service (NEW)
    enable_rpc_v2: bool = False
    rpc_v2_port: int = 58100
    rpc_v2_host: str = "0.0.0.0"
    rpc_v2_debug: bool = True

@dataclass
class ServiceInstances:
    # ... existing fields ...
    rpc_v2_server: Optional[Any] = None  # FastAPIRPCServer instance

def launch_services(config: ServiceConfig = None, shutdown_existing: bool = False) -> ServiceInstances:
    # ... existing code ...

    # Launch RPC v2 Server
    if config.enable_rpc_v2:
        from pycore.pyutils.rpc_v2.server import FastAPIRPCServer

        ColorPrint.blue(f"[PyLauncher] Starting RPC v2 server on {config.rpc_v2_host}:{config.rpc_v2_port}...")

        instances.rpc_v2_server = FastAPIRPCServer(options={
            "host": config.rpc_v2_host,
            "port": config.rpc_v2_port,
            "debug": config.rpc_v2_debug
        })

        # Start RPC v2 server in background thread
        # (RPC v2 has built-in threading support via start() method)
        instances.rpc_v2_server.start()

        ColorPrint.green(f"[PyLauncher] RPC v2 server started successfully")
```

---

### 第2步：MCP Backend注册路由到RPC v2

**目标**: mcpctl不自己实现HTTP服务器，只注册路由到RPC v2

**已完成**: ✅ `pycore/pyctl/mcpctl/backend/rpc_routes.py` (NEW)
- 定义了 `register_mcp_routes(rpc_server)` 函数
- 注册了23个routes (3 meta + 5 file + 7 database + 8 codebase)
- 所有routes设置为 `sync=True` (立即返回，无需ACK机制)

**需要创建的文件**:
`pycore/pyctl/mcpctl/mcp_backend_main.py` (重写):
```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MCP Backend - RPC v2 Integration

Uses pycore.pyutils.rpc_v2 architecture.
Does NOT implement HTTP server directly.
"""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore import ColorPrint, THREAD_BUS
from pycore.pylauncher import launch_services, ServiceConfig
from pycore.pygvar import (
    MCP_BACKEND_SINGLETON_PORT_START,
    MCP_BACKEND_SINGLETON_PORT_RANGE,
    MCP_BACKEND_RPC_PORT
)
from pycore.pyctl.mcpctl.backend.rpc_routes import register_mcp_routes
from pycore.pyctl.mcpctl.global_state import get_backend_state_dict
from pyapps.mcp.controller import (
    get_file_info_controller_singleton,
    get_database_controller_singleton,
    get_codebase_controller_singleton
)

def start_mcp_backend(shutdown_existing: bool = True) -> bool:
    """Start MCP backend with RPC v2 architecture"""
    ColorPrint.blue("=" * 70)
    ColorPrint.blue("MCP Backend Server (RPC v2 Architecture)")
    ColorPrint.blue("=" * 70)

    # Create service configuration
    config = ServiceConfig(
        app_id="mcp_backend",
        app_name="MCP Backend Server",

        # RPC v2 Configuration
        enable_rpc_v2=True,
        rpc_v2_port=MCP_BACKEND_RPC_PORT,
        rpc_v2_host="0.0.0.0",
        rpc_v2_debug=True,

        # Singleton Detection
        port_start=MCP_BACKEND_SINGLETON_PORT_START,
        port_range=MCP_BACKEND_SINGLETON_PORT_RANGE,
        singleton_check=True,
        force_launch=False,
        state_checker=get_backend_state_dict,

        # Services
        enable_heartbeat=True,
        enable_ui=False,
        enable_speech=False
    )

    # Launch services via pylauncher (includes RPC v2)
    ColorPrint.blue("[MCP Backend] Launching services...")
    instances = launch_services(config=config, shutdown_existing=shutdown_existing)

    if not instances.singleton_detector:
        ColorPrint.red("[FAILED] Could not become PRIMARY instance")
        return False

    if not instances.rpc_v2_server:
        ColorPrint.red("[FAILED] RPC v2 server not started")
        return False

    ColorPrint.green(f"[SUCCESS] Backend is PRIMARY instance")
    ColorPrint.green(f"[SUCCESS] RPC v2 server running on port {MCP_BACKEND_RPC_PORT}")

    # Initialize controllers
    file_controller = get_file_info_controller_singleton()
    db_controller = get_database_controller_singleton()
    codebase_controller = get_codebase_controller_singleton()

    # Set global controllers for handlers
    from pycore.pyctl.mcpctl.backend import handlers
    handlers.file_processing.file_controller = file_controller
    handlers.database.db_controller = db_controller
    handlers.codebase.codebase_controller = codebase_controller

    # Register MCP routes to RPC v2 server
    register_mcp_routes(instances.rpc_v2_server)

    # Add Web UI static files
    web_dir = Path(__file__).parent / "web"
    if web_dir.exists():
        instances.rpc_v2_server.add_static_dir("/", str(web_dir))
        ColorPrint.green(f"[MCP Backend] Web UI mounted at http://localhost:{MCP_BACKEND_RPC_PORT}/")

    # Keep running
    try:
        while True:
            if THREAD_BUS.is_shutdown_requested():
                break
            time.sleep(1)
    except KeyboardInterrupt:
        ColorPrint.blue("\n[MCP Backend] Shutting down...")

    # Cleanup
    stop_services(instances)
    return True

def main():
    import argparse
    parser = argparse.ArgumentParser(description="MCP Backend (RPC v2)")
    parser.add_argument("--no-shutdown-existing", action="store_true")
    args = parser.parse_args()

    success = start_mcp_backend(shutdown_existing=not args.no_shutdown_existing)
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
```

---

### 第3步：前端RPC Client对接RPC v2协议

**目标**: Web UI使用RPC v2的统一客户端

**Option A: 使用完整的RPC v2 Client** (推荐)
- 文件: `pycore/pyutils/rpc_v2/client/unified_rpc_client.js`
- 支持: WebSocket优先、HTTP fallback、请求持久化、回调注册表
- 复杂度: 905行，功能完整

**Option B: 简化版Client** (当前使用)
- 文件: `pycore/pyctl/mcpctl/web/static/js/rpc_client.js`
- 支持: 仅HTTP POST
- 复杂度: 133行，简单直接
- **已修复**: 支持 `data.result` 字段提取

**建议**: 当前先保持简化版，未来需要WebSocket时切换到完整版

---

## 架构对比

### Before (当前架构 - 混乱)
```
MCP Backend (mcp_backend_main.py)
  ├── 直接创建 FastAPI app
  ├── 直接创建 uvicorn server
  ├── 手动注册23个routes (routes.py)
  ├── 手动管理连接泄漏
  └── 缺少 WebSocket/ACK/Inventory

前端Web UI (rpc_client.js)
  ├── HTTP POST only
  └── 期待 {result: ...} 格式
```

### After (RPC v2架构 - 清晰)
```
PyLauncher
  ├── Singleton Detection
  ├── Heartbeat Thread
  └── RPC v2 Server (FastAPIRPCServer)
      ├── HTTP Routes (内置)
      ├── WebSocket Support (内置)
      ├── ACK Manager (内置)
      ├── Inventory Table (内置)
      ├── Client Registry (内置)
      └── Routes Manager
          └── MCP Routes (register_mcp_routes)
              ├── Meta: 3 routes
              ├── File: 5 routes
              ├── Database: 7 routes
              └── Codebase: 8 routes

前端Web UI
  ├── 使用 RPC v2 Client (可选)
  ├── 或继续使用简化版 Client
  └── 统一数据格式 {result: ...}
```

---

## 待完成任务

### Step 1: PyLauncher RPC v2 Support (IN PROGRESS)
- [ ] 添加 `enable_rpc_v2`, `rpc_v2_port` 等配置到 ServiceConfig
- [ ] 在 `launch_services()` 中启动 FastAPIRPCServer
- [ ] 添加 `rpc_v2_server` 到 ServiceInstances
- [ ] 测试 PyLauncher 能否启动RPC v2服务器

### Step 2: MCP Backend Integration (READY)
- [x] 创建 `rpc_routes.py` (已完成)
- [ ] 重写 `mcp_backend_main.py` 使用RPC v2
- [ ] 删除 `routes.py` (旧的FastAPI路由文件)
- [ ] 测试所有23个routes是否正常工作

### Step 3: Web UI Client (WORKING)
- [x] 修复 `rpc_client.js` 支持 `result` 字段 (已完成)
- [ ] 测试Web UI与RPC v2后端通信
- [ ] (可选) 切换到完整版 RPC v2 Client (WebSocket支持)

### Step 4: Testing & Cleanup
- [ ] 完整系统测试: `python .\pymain.py app=mcp`
- [ ] 验证无连接泄漏 (netstat检查)
- [ ] 清理旧代码 (备份后删除旧FastAPI实现)
- [ ] 更新 `doc/PYCORE_UP.md`

---

## 相关文档

- **RPC v2 Specification**: `pycore/pyutils/rpc_v2/RPC_PROTOCOL_SPECIFICATION.md`
- **RPC v2 Fixes**: `pycore/pyutils/rpc_v2/FIX.md`
- **Connection Leak Fix**: `WEBSOCKET_CONNECTION_LEAK_FIX_2025-11-19.md`
- **PyLauncher Architecture**: `pycore/pylauncher/launcher.py` (docstring)

---

## 下一步行动

**立即执行**: 修改PyLauncher支持RPC v2服务器启动

```bash
# 1. 修改 pycore/pylauncher/launcher.py
# 2. 测试RPC v2服务器能否启动
# 3. 重写 mcp_backend_main.py
# 4. 测试完整系统
```
