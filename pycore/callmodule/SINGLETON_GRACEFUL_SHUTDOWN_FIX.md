# Singleton Graceful Shutdown - Force Kill Fix

## Problem

**问题**: 当启动新的 callmodule 实例时，旧实例被**强制杀死 (SIGKILL)**，而不是通过 THREAD_BUS 优雅退出。

**用户反馈**:
> "两个客户端是使用端口沟通，不是使用kill，而且旧客户端收到通知后是通过thread bus通知所有进程自行退出"

**错误日志**:
```
[PortKiller] Killing PID 460535 (signal -9)...          # ❌ 强制杀死
[PortUtils] Sending SIGKILL to PID 460389...            # ❌ 强制杀死
```

---

## Root Cause

### 单例检测流程（正确设计）

```
新实例启动
  ↓
检测到旧实例在 port 55000 (frontend singleton)
  ↓
发送 HTTP shutdown 请求到 port 55000
  ↓
旧实例收到请求，回复 ACK
  ↓
旧实例触发 THREAD_BUS.request_shutdown()
  ↓
执行所有 shutdown handlers (frontend, rpc, heartbeat, etc.)
  ↓
旧实例优雅退出，释放端口 3100, 59000, 55000
  ↓
新实例检测端口可用，启动服务
```

### 实际问题（错误实现）

**问题 1**: RPC 端口检查强制杀死进程

**文件**: `pycore/pyutils/native_ui/step3_launcher/launch_native_app.py`

**Line 660** (修复前):
```python
if not ensure_ports_available(ports_to_check, timeout=3.0, force_kill=True):
    # ❌ timeout 只有 3 秒
    # ❌ force_kill=True 会强制杀死占用端口的进程
```

**问题**:
- Timeout 只有 3 秒，不足以让旧实例完成优雅关闭
- `force_kill=True` 导致直接发送 SIGKILL
- 违反了单例检测的设计：应该等待优雅退出，而不是强制杀死

---

**问题 2**: Frontend 端口检查强制杀死进程

**文件**: `pycore/pyutils/native_ui/step9_frontend/frontend_thread.py`

**Line 406** (修复前):
```python
if not is_port_available(self.config.port, self.config.host):
    ColorPrint.yellow(f"[FrontendThread] Port {self.config.port} is occupied, cleaning...")
    if kill_process_on_port(self.config.port, force=True):
        # ❌ 立即强制杀死占用端口的进程
```

**问题**:
- 不等待旧实例优雅关闭
- 直接强制杀死进程
- Frontend singleton 已经发送了 shutdown 请求，应该等待而不是杀死

---

## Solution

### 修复 1: RPC 端口等待（不强制杀死）

**文件**: `pycore/pyutils/native_ui/step3_launcher/launch_native_app.py`

**Line 658-668** (修复后):
```python
ColorPrint.blue(f"[NativeLauncher] Ensuring ports are available: {ports_to_check}")
ColorPrint.blue(f"[NativeLauncher] Waiting for old instance to shutdown gracefully...")

# Wait for old instance to shutdown gracefully (via singleton detection)
# Singleton detection already sent shutdown request, so old instance should exit
# Give it reasonable time (15s) to complete shutdown handlers
if not ensure_ports_available(ports_to_check, timeout=15.0, force_kill=False):
    ColorPrint.print_error(f"[NativeLauncher] Failed to release ports: {ports_to_check}")
    ColorPrint.print_error("[NativeLauncher] Old instance did not shutdown within 15 seconds")
    ColorPrint.print_error("[NativeLauncher] Please manually stop the old instance or check for hanging processes")
    return None
```

**改进**:
- ✅ Timeout 从 3 秒增加到 15 秒
- ✅ `force_kill=False` - 禁用强制杀死
- ✅ 清晰的错误信息，提示用户手动处理

---

### 修复 2: Frontend 端口等待（不强制杀死）

**文件**: `pycore/pyutils/native_ui/step9_frontend/frontend_thread.py`

**Line 400-429** (修复后):
```python
# Step 0: Wait for frontend port to be available
# Frontend singleton detection should have already triggered old instance shutdown
# Wait for graceful shutdown instead of force killing
ColorPrint.blue(f"[FrontendThread] Checking if port {self.config.port} is occupied...")
from .port_killer import is_port_available

if not is_port_available(self.config.port, self.config.host):
    ColorPrint.yellow(f"[FrontendThread] Port {self.config.port} is occupied")
    ColorPrint.blue(f"[FrontendThread] Waiting for old frontend instance to release port...")

    # Wait up to 10 seconds for port to be released (old instance shutting down)
    max_wait = 10.0
    wait_interval = 0.5
    waited = 0.0

    while waited < max_wait:
        time.sleep(wait_interval)
        waited += wait_interval

        if is_port_available(self.config.port, self.config.host):
            ColorPrint.green(f"[FrontendThread] Port {self.config.port} released after {waited:.1f}s")
            break
    else:
        # Port still occupied after timeout
        ColorPrint.red(f"[FrontendThread] Port {self.config.port} still occupied after {max_wait}s")
        ColorPrint.red(f"[FrontendThread] Old instance may not have shutdown properly")
        ColorPrint.red(f"[FrontendThread] Please manually check and stop processes on port {self.config.port}")
        raise RuntimeError(f"Port {self.config.port} still in use after waiting {max_wait}s")
else:
    ColorPrint.green(f"[FrontendThread] Port {self.config.port} is available")
```

**改进**:
- ✅ 等待 10 秒让旧实例释放端口
- ✅ 不使用 `kill_process_on_port(force=True)`
- ✅ 超时后抛出异常，提示用户手动处理
- ✅ 清晰的进度日志

---

## Expected Behavior (修复后)

### 正常情况（旧实例优雅退出）

```
新实例启动
  ↓
[FrontendSingleton] Found existing frontend at port 55000
[FrontendSingleton] Sending shutdown request to old frontend...
  ↓
旧实例收到请求
  ↓
[Singleton] Received shutdown request from new instance (PID 461395)
[ThreadBus] Executing shutdown stack: Shutdown by new instance
[ThreadBus] Shutdown order: ['frontend', 'singleton_detector', 'heartbeat', 'rpc_v2']
  ↓
旧实例优雅关闭（2-5秒）
  ↓
[NativeLauncher] Waiting for old instance to shutdown gracefully...
[PortUtils] Waiting for 1 ports to be released: [59000]
[PortUtils] Port 59000 released after 2.3s                    # ✅ 自然释放
  ↓
新实例接管端口，启动服务
```

**日志特征**:
- ✅ 没有 "SIGKILL" 或 "Killing PID"
- ✅ 显示 "Port released after X.Xs"
- ✅ 旧实例通过 THREAD_BUS 优雅退出

---

### 异常情况（旧实例卡死）

```
新实例启动
  ↓
发送 shutdown 请求到旧实例
  ↓
旧实例卡死，没有退出（可能是bug或死锁）
  ↓
[NativeLauncher] Waiting for old instance to shutdown gracefully...
[PortUtils] Waiting for 1 ports to be released: [59000]
... 等待 15 秒 ...
  ↓
[PortUtils] Timeout: 1 ports still in use: [59000]
[NativeLauncher] Failed to release ports: [59000]
[NativeLauncher] Old instance did not shutdown within 15 seconds
[NativeLauncher] Please manually stop the old instance or check for hanging processes
  ↓
新实例启动失败，返回 None                                   # ✅ 不强制杀死，报错退出
```

**日志特征**:
- ✅ 没有强制杀死
- ✅ 清晰的错误信息
- ✅ 提示用户手动处理

---

## Testing

### 测试 1: 正常重启

```bash
# 启动实例1
python pycore_module_caller.py

# 在另一个终端启动实例2（触发单例检测）
python pycore_module_caller.py

# 预期：
# - 实例1 收到 shutdown 请求
# - 实例1 通过 THREAD_BUS 优雅退出（2-5秒）
# - 实例2 等待端口释放（不强制杀死）
# - 实例2 启动成功
```

**预期日志**:
```
[FrontendSingleton] Sending shutdown request to old frontend...
[FrontendSingleton] Old frontend accepted shutdown
[NativeLauncher] Waiting for old instance to shutdown gracefully...
[PortUtils] Port 59000 released after 3.2s          # ✅ 优雅释放
[NativeLauncher] RPC v2 started on 0.0.0.0:59000
```

---

### 测试 2: 快速连续启动

```bash
# 快速启动多个实例
for i in {1..3}; do
  python pycore_module_caller.py &
  sleep 1
done
```

**预期**:
- 只有最后一个实例存活
- 所有旧实例通过 THREAD_BUS 优雅退出
- 没有 SIGKILL 或强制杀死

---

### 测试 3: API 重启

```bash
# 启动服务
python pycore_module_caller.py

# 触发重启 API
curl -X POST http://localhost:59000/api/manage/control/restart

# 预期：
# - 服务通过 THREAD_BUS 优雅关闭
# - os.execv() 替换进程
# - 新实例启动（同一个 PID）
# - 没有强制杀死
```

---

## Design Principles

### 1. 单例检测职责分离

| 组件 | 职责 |
|------|------|
| **Singleton Detector** | 通过端口通信，发送 shutdown 请求 |
| **THREAD_BUS** | 协调所有线程优雅关闭 |
| **Port Utils** | **等待**端口释放，不负责杀进程 |

### 2. 优雅关闭流程

```
HTTP Shutdown Request (端口通信)
  ↓
THREAD_BUS.request_shutdown()
  ↓
Shutdown Handlers (priority order)
  ↓
All threads stop gracefully
  ↓
Process exits naturally
  ↓
Ports released automatically
```

### 3. 超时策略

| 阶段 | Timeout | 失败处理 |
|------|---------|----------|
| **Frontend port** | 10 秒 | 抛出异常，报错退出 |
| **RPC port** | 15 秒 | 返回 None，报错退出 |
| **不使用强制杀死** | - | 让用户手动处理 |

---

## Summary

**修改的文件**: 2

1. ✅ `pycore/pyutils/native_ui/step3_launcher/launch_native_app.py`
   - Line 658-668: RPC 端口等待改为 15 秒，禁用 force_kill

2. ✅ `pycore/pyutils/native_ui/step9_frontend/frontend_thread.py`
   - Line 400-429: Frontend 端口等待 10 秒，移除强制杀死逻辑

**核心改进**:
- ✅ 禁用所有强制杀死 (`force_kill=False`)
- ✅ 增加等待时间（Frontend 10s, RPC 15s）
- ✅ 超时报错而不是强制杀死
- ✅ 依赖单例检测的优雅关闭机制
- ✅ 清晰的错误信息和用户提示

**设计原则**:
- ✅ 通过端口通信，不使用 kill
- ✅ 旧实例通过 THREAD_BUS 自行退出
- ✅ 新实例等待端口释放
- ✅ 超时报错让用户处理，不强制破坏

---

## Next Steps

1. **测试正常重启**: 验证优雅关闭流程
2. **测试快速连续启动**: 验证单例检测稳定性
3. **监控日志**: 确认没有 SIGKILL 或强制杀死
4. **边界测试**: 验证卡死情况下的错误提示
