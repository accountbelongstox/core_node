# PyCore Updates

## 2025-11-19: MCP Backend 模块化重构 (单一入口+路由系统) ✅ 完成

**完成**: Backend 重构为模块化架构，单一入口文件 + 清晰的模块分离。

**模块化结构**:
```
pycore/pyctl/mcpctl/
├── mcp_backend_main.py       # 单一入口文件（190行）
└── backend/                   # Backend模块
    ├── config.py             # 配置（端口、工具列表）
    ├── handlers/             # Handler模块
    │   ├── file_processing.py  # 文件处理 handlers (4+1)
    │   ├── database.py         # 数据库 handlers (7)
    │   └── codebase.py         # 代码库 handlers (8)
    └── routes.py             # FastAPI路由注册系统
```

**清理**: 删除旧文件 `mcp_backend.py`，保留 `mcp_launcher.py` (为proxy使用)

---

## 2025-11-19: MCP Backend 完整工具迁移 (19工具全集成) ✅ 完成

**完成**: Backend 完成 19 个工具的完整迁移，三大子系统全部集成。

**迁移工具统计** (from `pyapps/mcp/main_backup_20251119_010805.py`):
- ✅ File Processing: 4 tools
  - `img_ocr_doc_allfile_parser_info_tool` (OCR + 文档解析 + 颜色分析)
  - `generate_placeholder_image_with_ocr_tool`
  - `query_file_processing_history_tool`
  - `clear_file_cache_tool`
- ✅ Database: 7 tools
  - `database_namespace_negotiation_tool`
  - `database_register_and_connect_tool`
  - `database_execute_query_with_safety_tool`
  - `database_batch_operations_tool`
  - `database_schema_inspection_tool`
  - `database_get_statistics_tool`
  - `database_health_check_tool`
- ✅ Codebase: 8 tools
  - `codebase_get_directory_tree_tool`
  - `codebase_find_files_by_pattern_tool`
  - `codebase_search_content_tool`
  - `codebase_get_file_content_tool`
  - `codebase_analyze_statistics_tool`
  - `codebase_describe_directory_tool`
  - `codebase_scan_framework_apps_tool`
  - `codebase_health_check_tool`

**Controller集成**:
- `FileInfoController`: 文件处理 (OCR, 文档解析, 颜色分析)
- `DatabaseController`: 数据库操作 (namespace管理, 安全查询, 批量操作)
- `CodebaseController`: 代码库分析 (目录树, 文件搜索, 框架检测)

**架构 (PyCore标准模式)**:
- ✅ 单入口文件: `mcp_backend_main.py`
- ✅ Singleton检测: `pycore.pylauncher` (端口 58000-58099)
- ✅ Heartbeat系统: 自动启动心跳线程
- ✅ Thread_bus通信: 优雅关闭协调
- ✅ RPC服务: 最小化 FastAPI (端口 58100, 20个路由)
- ✅ Controller集成: 三大Controller共享单例模式

**关键发现**:
1. RPC v2循环依赖: `pycore.pyutils.rpc_v2` 存在循环导入 → 改用最小化 FastAPI
2. 对称性处理: Backend与Proxy使用相同Controller（避免代码重复）

**测试验证**:
```bash
# Backend info (元数据，显示全部19工具)
curl -s -X POST http://localhost:58100/rpc/backend_info -d '{}' | python -m json.tool
# → {"backend_id": "773b07c0", "tools": [19 tools], "sync_response": true} ✅

# 单个工具测试 (以 get_file_info 为例)
curl -X POST http://localhost:58100/rpc/get_file_info -d '{"file_path": "test.txt"}'
# → 调用 FileInfoController 进行实际文件分析 ✅
```

**文件**: `pycore/pyctl/mcpctl/mcp_backend_main.py`

---

## 2025-11-19: MCP Backend + 工具名长度修复 ✅ 完成

**完成**: MCP Backend 使用最小化 FastAPI 服务器 + 修复工具名超长问题。

**问题1: Backend 3秒延迟**
- Backend 使用 RPC v1 (UnifiedRpcServer) → 强制 `requires_ack: true` → 3秒延迟
- Cursor/Claude 期望 < 1秒响应 → 工具超时失败
- RPC v2 (FastAPIRPCServer) 存在循环依赖问题

**问题2: 工具名超长被过滤 ⭐ 关键发现**
- 原工具名: `get_file_info_with_ocr_and_document_parsing_tool` = 53字符
- 加服务器前缀: `MCPUnifiedServer:get_file_info_with_ocr_and_document_parsing_tool` = 64字符
- **MCP 协议限制: 60字符** → 工具被 Cursor 过滤，无法使用 ❌

**解决方案**:
1. **Backend**: 创建最小化 FastAPI 应用（避免 RPC v2 循环依赖）
2. **工具名**: 缩短为 `get_file_info_tool` (18字符) ✅

**路由实现**:
- `/rpc/backend_info`: 返回 `sync_response: true` → 立即响应 (< 100ms)
- `/rpc/get_file_info`: 返回 `requires_ack: false` → 简化异步 (立即响应)

**测试验证**:
```bash
# Backend info (sync)
curl -X POST http://localhost:58100/rpc/backend_info -d '{}'
# → "sync_response":true ✅

# Get file info (simplified async)
curl -X POST http://localhost:58100/rpc/get_file_info -d '{"file_path":"test.txt"}'
# → "message":"hello ok!" ✅
```

**工具名对比**:
- 修复前: `get_file_info_with_ocr_and_document_parsing_tool` (53字符, 被过滤 ❌)
- 修复后: `img_ocr_doc_allfile_parser_info_tool` (38字符, 全面表达功能, 可用 ✅)
  - img: 图片
  - ocr: 光学字符识别
  - doc: 文档
  - allfile: 所有文件类型
  - parser: 解析器
  - info: 信息提取

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
