# PyCore Updates

## 2025-11-19: 通用线程管理架构设计

**目标**: 设计可扩展的线程管理系统，让launcher.py可灵活添加新服务（rpc_v2等）。

**核心设计**:
- 线程注册表（THREAD_REGISTRY）：声明式配置所有可启动服务
- 关闭优先级：RPC/网络(50) → 处理服务(60) → 心跳(100)
- 默认启动：pyheartbeat默认启动，其他需配置
- 通用ThreadManager：统一管理线程生命周期

**实现计划**:
1. 创建ThreadManager类和THREAD_REGISTRY
2. 在ServiceConfig添加enable_rpc_v2等扩展字段
3. 更新launcher.py使用通用机制
4. THREAD_BUS添加优先级关闭

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
