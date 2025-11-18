# PyCore Updates

## 2025-11-19: MCP Backend 迁移至 RPC v2 ✅ 完成

**完成**: MCP Backend 从 RPC v1 (UnifiedRpcServer) 完全迁移至 RPC v2 (FastAPIRPCServer)。

**问题根因**:
- Backend 使用 RPC v1 → 强制 `requires_ack: true` → 3秒延迟
- Cursor/Claude 期望 < 1秒响应 → 第二个工具超时失败
- RPC v2 同步模式已实现但未被使用

**迁移实施**:
- 完全重写 `mcp_backend.py` (260行)
- 直接使用 FastAPIRPCServer + SingletonDetector
- 移除 launcher.py RPC 集成依赖
- 在 daemon thread 中运行 uvicorn

**路由配置**:
- `backend_info`: `sync=True` → 立即返回 (< 100ms)
- `get_file_info`: `sync=False` → ACK机制 (为未来真实实现预留)

**代理端适配**:
- `mcp_main.py` 检测 `sync_response` 标记
- 同步响应立即返回，异步响应走重试逻辑

**性能对比**:
- 迁移前: 两个工具都超时（RPC v1 强制 3秒延迟）
- 迁移后: `backend_info` < 100ms，两个工具均可用

**文件**: `pycore/pyctl/mcpctl/mcp_backend.py`, `pyapps/mcp/mcp_main.py`

---

## 2025-11-19: RPC v2 同步调用支持 ✅ 实施完成

**完成**: 全面扩展 RPC v2 架构，实施路由级别同步调用支持。

**问题诊断**:
- 所有 RPC 响应强制添加 `requires_ack: true`
- 客户端等待 1.5秒 + 重试3次（每次0.5秒）= 总耗时~3秒
- MCP 工具期望 < 1秒响应，导致超时

**核心实现** (方案 A - 路由标记):
- 新增 `RouteConfig` 类型存储路由元数据（sync, is_coroutine, description）
- RoutesManager 支持 `register_route(name, handler, sync=True)`
- FastAPIRPCServer 检测 `is_sync_route()` 并 await 处理立即返回
- 响应标记 `sync_response: true`（无 `requires_ack`）

**代码修改**:
- `common/typing.py`: 添加 `RouteConfig` dataclass
- `server/routes_manager.py`: 路由配置存储 + `is_sync_route()` 方法
- `server/fastapi_server.py`: HTTP 处理逻辑分支（sync vs async）
- `scripts/test_rpc_v2_sync_mode.py`: 测试脚本验证性能

**性能提升**:
- 同步路由: < 100ms ✅ (立即返回)
- 异步路由: ~3秒（保持 ACK 机制）

**向后兼容**: 默认 `sync=False`，现有路由保持异步行为。

**文档**: `pycore/pyutils/rpc_v2/SYNC_MODE_IMPLEMENTATION.md`

---

## 2025-11-19: Flutter Design Docs System (3-Layer + Smart Examples) ✅ COMPLETED

**Completed**: Three-layer design docs structure + smart example image management + English codebase.

**Three-Layer Structure** (by precision, not language):
- Layer 1: Concept Designs (`1_concept_designs/`) - High-level architecture, flows, data models
- Layer 2: Rough Page Designs (`2_page_designs_rough/`) - Page wireframes and layouts
- Layer 3: Detailed Page Designs (`3_page_designs_detailed/`) - Detailed specs + pageview_map.json

**Smart Example Images** (context-aware naming):
- Empty dir → Generate example image (e.g., `example_architecture.png`, `example_home_wireframe.png`)
- Has actual images → Auto-remove all example images
- Images removed → Regenerate example image

**Deprecated File Cleanup**:
- Auto-remove old directories: `2_page_designs_cn`, `3_page_designs_en`
- Auto-remove old fixed placeholder: `_placeholder.png`
- Auto-remove Chinese example files: `示例_*.md`

**Auto-Expansion**: Runs on design_doc_tool startup, creates missing structure + examples.

**Docs**: `doc/DESIGN_DOCS_STRUCTURE.md` + `doc/DESIGN_IMAGES_PLACEMENT.md`

---

## 2025-11-19: MCP Backend RPC化 ✅ 完成

**完成**: MCP后端从FastAPI迁移到UnifiedRpcServer，集成launcher.py线程管理。

**核心改进**:
- mcp_backend.py 使用 UnifiedRpcServer (HTTP + WebSocket)
- 通过 launcher.py 启动，集成单例检测和线程池管理
- RPC路由: `/rpc/get_file_info`, `/rpc/backend_info`
- 关闭优先级: RPC(50) 与其他RPC服务同级

**架构统一**: 所有后端服务使用统一RPC架构，无需独立HTTP服务器。

---

## 2025-11-19: 通用线程管理架构 ✅ 实现完成

**完成**: 扩展 GlobalThreadPool 实现优先级关闭，launcher.py 集成线程池管理。

**核心改进**:
- thread_pool.py 添加 THREAD_REGISTRY + shutdown_by_priority()
- launcher.py 所有服务注册到线程池，按优先级关闭
- 关闭顺序：RPC(50) → Speech(60) → Heartbeat(100)

**扩展性**: 添加新服务只需在 THREAD_REGISTRY 声明 + 注册到线程池。

**文档**: `pycore/pylauncher/THREAD_MANAGEMENT_DESIGN.md`

---

## 2025-11-19: MCP Proxy-Backend 完整架构 ✅ 完成

**完成**: 代理-后端分离架构，代理多实例，后端单例RPC服务。

**架构**:
- **后端**: `python -m pycore.pyctl.mcpctl.mcp_backend` (单例，RPC端口58100)
- **代理**: `python pymain.py app=mcp` (多实例，连接后端RPC)
- **RPC异步处理**: 代理端await等待 + 重试机制（无轮询）

**核心改进**:
- 代理端处理 `requires_ack` 响应：await 1.5s → 重试3次查询结果
- RPC路径: `/rpc/get_file_info`, `/rpc/backend_info`
- 后端mock工具返回 "hello ok!" 验证通信

**文件**:
- `pycore/pyctl/mcpctl/mcp_backend.py`: 后端RPC服务
- `pyapps/mcp/mcp_main.py`: 代理（替换原完整MCP）
- `pyapps/mcp/mcp_main_backup_*.py`: 原MCP备份

---

## 2025-11-19: Singleton Detection Complete Solution

**Problem Solved**: Two instances could start simultaneously without proper singleton detection.

**Root Cause**: SingletonDetector received SHUTDOWN but didn't notify main program via THREAD_BUS.

**Complete Solution**:
1. Added `on_message` callback to SingletonDetector in launcher.py
2. Callback triggers `THREAD_BUS.request_shutdown()` when SHUTDOWN received
3. Main program monitors THREAD_BUS and exits properly
4. THREAD_BUS is queue system - supports stack events for ordered shutdown (子进程先关，主进程后关)

**Testing**:
```bash
# Terminal 1: Run as PRIMARY (wait for shutdown)
python scripts/test_singleton_shutdown.py --mode=primary

# Terminal 2: Send shutdown and become new PRIMARY
python scripts/test_singleton_shutdown.py --mode=secondary
```

**Key Files**:
- `pycore/pylauncher/launcher.py`: Added on_message callback (3 locations)
- `pycore/pylauncher/singleton_detector.py`: SHUTDOWN handler with on_message support
- `scripts/test_singleton_shutdown.py`: Complete integration test

**Note**: Singleton is UNIVERSAL (not MCP-specific). Any service can use via pylauncher.

---

## 2025-11-19: Singleton Detection Shutdown Fix

**Problem**: When second instance sends SHUTDOWN message, first instance's detector stopped but main program didn't exit.

**Solution**: Added `on_message` callback to SingletonDetector in launcher.py that triggers THREAD_BUS global shutdown when receiving SHUTDOWN message.

**Key Changes**:
- `launcher.py`: Added message handler to trigger `THREAD_BUS.request_shutdown()` on SHUTDOWN
- Applied to all three SingletonDetector instantiation points (NativeUILauncher, launch_services x2)
- THREAD_BUS shutdown is a queue system - can add stack events to control shutdown order (close sub-processes first, then main)

**Files Modified**:
- `pycore/pylauncher/launcher.py`: Added on_message callback for SHUTDOWN handling

**Test**:
```bash
# Terminal 1
set SINGLETON_DEBUG=1
python pyapps/mcp/main_with_singleton.py

# Terminal 2 (should shutdown Terminal 1 and become new PRIMARY)
set SINGLETON_DEBUG=1
python pyapps/mcp/main_with_singleton.py
```
