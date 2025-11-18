# PyCore Updates

## 2025-11-19: Flutter 设计文档三层体系 ✅ 完成

**完成**: 建立三层设计文档结构（概念图→粗页面图→细页面图），实现自动扩展。

**核心内容**:
- 第一层：概念图（1_concept_designs/）- 架构、流程、数据模型
- 第二层：粗页面图（2_page_designs_cn/）- 中文页面设计
- 第三层：细页面图（3_page_designs_en/）- 英文页面名 + pageview_map.json

**自动扩展**: 启动 design_doc_tool 时自动创建缺失结构，跳过已存在文件。

**文档**: `doc/DESIGN_DOCS_STRUCTURE.md` + `utils/design_structure_auto_expand.py`

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

## 2025-11-19: MCP Proxy-Backend Prototype (hello ok!)

**完成**: 后端集成单例检测，两个独立端口分别用于单例检测和HTTP服务。

**端口分配**:
- 单例检测端口: 58000-58099（检查是否已有后端）
- HTTP服务端口: 58100（后端API，代理连接此端口）

**后端**:
- 使用pylauncher单例检测（port 58000-58099）
- 通过后启动HTTP服务器（port 58100，独立线程）
- 唯一ID验证单例，模拟工具返回"hello ok!"

**代理**:
- 连接HTTP端口58100
- 启动时显示Backend ID（验证单例）
- 对AI完全透明

**测试**:
```bash
# 1. 启动后端（会显示单例端口和HTTP端口）
python -m pycore.pyctl.mcpctl.mcp_backend

# 2. 启动代理（连接到后端，显示Backend ID）
python pymain.py app=mcp
```

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
