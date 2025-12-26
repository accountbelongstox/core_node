# Frontend Singleton Timing Fix

## Problem

**症状**: 新实例启动时，Frontend port 3100 被旧实例占用，等待 10 秒后仍未释放。

```
[FrontendThread] Port 3100 is occupied
[FrontendThread] Waiting for old frontend instance to release port...
[FrontendThread] Port 3100 still occupied after 10.0s
RuntimeError: Port 3100 still in use after waiting 10.0s
```

---

## Root Cause Analysis

### 问题 1: Frontend Singleton Detector 等待时间太短

**文件**: `pycore/pyutils/native_ui/step9_frontend/frontend_singleton_detector.py`

**Line 289** (修复前):
```python
if shutdown_result['accepted']:
    ColorPrint.green("[FrontendSingleton] Old frontend accepted shutdown")
    time.sleep(1.5)  # ❌ 只等待 1.5 秒
```

**问题**:
- Singleton port 55000 可以很快释放（只是 socket 监听）
- 但 Vite dev server (port 3100) 需要更长时间停止
  - 关闭 HTTP 连接
  - 清理 WebSocket 连接
  - 停止文件监听
  - 释放端口

**实际时序**:
```
t=0.0s: 新实例发送 SHUTDOWN 请求
t=0.1s: 旧实例接受，开始关闭
t=0.5s: Singleton port 55000 释放
t=1.5s: Frontend singleton detector 停止等待 ❌ 太早了！
t=2.0s: 新实例尝试启动 vite，发现 port 3100 still 被占用
t=3.0s: 旧 vite 进程实际才完全退出
```

---

### 问题 2: Frontend Thread stop() 没有处理超时异常

**文件**: `pycore/pyutils/native_ui/step9_frontend/frontend_thread.py`

**Line 618-619** (修复前):
```python
def stop(self):
    if self.process:
        ColorPrint.yellow("[FrontendThread] Stopping frontend process...")
        self.process.terminate()  # 发送 SIGTERM
        self.process.wait(timeout=5)  # ❌ 没有处理 TimeoutExpired
        self.process = None
```

**问题**:
- `wait(timeout=5)` 如果超时会抛出 `subprocess.TimeoutExpired` 异常
- 异常未被捕获，导致：
  1. `self.process = None` 不会执行
  2. 进程仍在运行，但引用丢失
  3. 端口继续被占用，无法被新实例使用

**边界情况**: 如果 Vite 进程卡死（例如文件锁、死循环、僵尸进程），会导致：
```
terminate() → 发送 SIGTERM
wait(5) → 超时 → 抛出 TimeoutExpired
异常未处理 → stop() 中断
进程仍在运行 → 端口 3100 继续被占用
新实例等待 10 秒 → 超时 → 启动失败
```

---

## Solution

### 修复 1: 增加 Frontend Singleton Detector 等待时间

**文件**: `frontend_singleton_detector.py`

**Line 287-291** (修复后):
```python
if shutdown_result['accepted']:
    ColorPrint.green("[FrontendSingleton] Old frontend accepted shutdown")
    ColorPrint.blue("[FrontendSingleton] Waiting for old frontend to shutdown gracefully...")
    # Wait longer for old instance to shutdown (including vite process)
    # Vite process needs time to clean up connections and release port
    time.sleep(5.0)  # ✅ 从 1.5 秒增加到 5 秒
```

**改进**:
- ✅ 等待 5 秒，给 Vite 进程足够时间优雅关闭
- ✅ 覆盖大多数正常情况（Vite 通常 2-4 秒可以完全停止）

---

### 修复 2: Frontend Thread stop() 添加超时处理和强制 kill

**文件**: `frontend_thread.py`

**Line 614-636** (修复后):
```python
def stop(self):
    """Stop frontend process gracefully"""
    if self.process:
        ColorPrint.yellow("[FrontendThread] Stopping frontend process...")

        try:
            # First try graceful shutdown (SIGTERM)
            self.process.terminate()
            self.process.wait(timeout=5)
            ColorPrint.green("[FrontendThread] Frontend process terminated gracefully")
        except subprocess.TimeoutExpired:
            # Force kill if graceful shutdown failed
            ColorPrint.yellow("[FrontendThread] Graceful shutdown timeout, force killing...")
            self.process.kill()  # ✅ 强制 kill (SIGKILL)
            self.process.wait(timeout=2)
            ColorPrint.green("[FrontendThread] Frontend process force killed")
        except Exception as e:
            ColorPrint.red(f"[FrontendThread] Error stopping process: {e}")
        finally:
            self.process = None  # ✅ 确保总是清理引用

    self.running = False
    ColorPrint.green("[FrontendThread] Frontend stopped")
```

**改进**:
- ✅ 捕获 `subprocess.TimeoutExpired` 异常
- ✅ 超时后发送 SIGKILL 强制杀死进程
- ✅ 使用 finally 确保 `self.process = None` 总是执行
- ✅ 处理所有异常情况

---

## Expected Behavior (修复后)

### 正常情况（Vite 优雅退出）

```
t=0.0s: 新实例启动
t=0.1s: Frontend singleton detector 发现旧实例 (port 55000)
t=0.2s: 发送 SHUTDOWN 请求
t=0.3s: 旧实例接受，调用 frontend_thread.stop()
t=0.4s: 旧 frontend_thread 发送 SIGTERM 给 vite 进程
t=1.0s: Singleton port 55000 释放
t=3.5s: Vite 进程优雅退出，port 3100 释放           ✅ 优雅关闭
t=5.0s: Frontend singleton detector 停止等待
t=5.1s: 新实例成功绑定 port 55000
t=5.2s: 新 frontend_thread 启动
t=5.3s: 检查 port 3100 → 可用 ✅
t=5.4s: 启动新 vite 进程
t=6.0s: 新实例完全启动
```

**日志**:
```
[FrontendSingleton] Old frontend accepted shutdown
[FrontendSingleton] Waiting for old frontend to shutdown gracefully...
[FrontendThread] Stopping frontend process...
[FrontendThread] Frontend process terminated gracefully        ✅ 优雅退出
[FrontendSingleton] Became PRIMARY frontend (after shutdown)
[FrontendThread] Checking if port 3100 is occupied...
[FrontendThread] Port 3100 is available                       ✅ 端口已释放
[FrontendThread] STARTING VITE DEV SERVER
```

---

### 边界情况（Vite 卡死，需要强制 kill）

```
t=0.0s: 新实例启动
t=0.2s: 发送 SHUTDOWN 请求
t=0.3s: 旧实例调用 frontend_thread.stop()
t=0.4s: 发送 SIGTERM 给 vite 进程
t=5.4s: wait(5) 超时 → 捕获 TimeoutExpired        ⚠️ Vite 卡死
t=5.5s: 发送 SIGKILL 强制杀死进程                  ✅ 强制 kill
t=6.0s: Vite 进程被杀死，port 3100 释放
t=7.0s: Frontend singleton detector 停止等待 (已等待 5s)
t=7.1s: 新实例绑定 port 55000
t=7.2s: 新 frontend_thread 检查 port 3100 → 可用 ✅
t=7.3s: 启动新 vite 进程
t=8.0s: 新实例完全启动
```

**日志**:
```
[FrontendSingleton] Old frontend accepted shutdown
[FrontendSingleton] Waiting for old frontend to shutdown gracefully...
[FrontendThread] Stopping frontend process...
[FrontendThread] Graceful shutdown timeout, force killing...   ⚠️ 超时
[FrontendThread] Frontend process force killed                 ✅ 强制 kill
[FrontendSingleton] Became PRIMARY frontend (after shutdown)
[FrontendThread] Port 3100 is available                       ✅ 端口已释放
[FrontendThread] STARTING VITE DEV SERVER
```

---

### 极端情况（进程完全卡死，无法 kill）

```
t=0.0s: 新实例启动
t=0.2s: 发送 SHUTDOWN 请求
t=0.3s: 旧实例调用 stop()
t=5.4s: terminate() 超时 → 捕获异常
t=5.5s: 发送 SIGKILL
t=7.5s: kill() 也超时（僵尸进程或内核 bug）     ⚠️ 极端情况
t=7.6s: Frontend singleton detector 停止等待
t=7.7s: 新实例绑定 port 55000
t=7.8s: 新 frontend_thread 检查 port 3100 → 仍被占用 ❌
t=17.8s: 等待 10 秒后仍被占用
t=17.9s: 抛出 RuntimeError → 启动失败          ❌ 需要手动处理
```

**日志**:
```
[FrontendThread] Graceful shutdown timeout, force killing...
[FrontendThread] Frontend process force killed
[FrontendThread] Port 3100 is occupied
[FrontendThread] Waiting for old frontend instance to release port...
[FrontendThread] Port 3100 still occupied after 10.0s
[FrontendThread] Old instance may not have shutdown properly
RuntimeError: Port 3100 still in use after waiting 10.0s
```

**解决方案**: 用户需要手动 kill 僵尸进程
```bash
# 查找占用 port 3100 的进程
lsof -i :3100
# 强制杀死
kill -9 <PID>
```

---

## Timing Summary

| 阶段 | 时间 | 说明 |
|------|------|------|
| **Frontend singleton wait** | 5.0s | 等待旧实例关闭 |
| **terminate() + wait()** | 5.0s | 优雅关闭 vite (SIGTERM) |
| **kill() + wait()** | 2.0s | 强制 kill (SIGKILL，仅超时时) |
| **新实例 port 等待** | 10.0s | 等待 port 3100 释放 |

**正常情况总时长**: 5s (singleton wait) + 3s (vite 优雅退出) = **8 秒**

**超时强制 kill**: 5s (singleton wait) + 5s (terminate timeout) + 2s (kill) = **12 秒**

**新实例等待缓冲**: 10 秒（足够覆盖强制 kill 场景）

---

## Testing

### 测试 1: 正常重启

```bash
# 启动实例 1
python pycore_module_caller.py

# 启动实例 2（触发单例检测）
python pycore_module_caller.py
```

**预期**:
- 旧实例 vite 优雅退出（3-4秒）
- 新实例成功启动（总耗时 8-10秒）
- 日志显示 "Frontend process terminated gracefully"

---

### 测试 2: Vite 进程卡死（模拟）

```bash
# 启动实例 1
python pycore_module_caller.py

# 在另一个终端，手动暂停 vite 进程（模拟卡死）
kill -STOP $(pgrep -f "vite.*3100")

# 启动实例 2
python pycore_module_caller.py
```

**预期**:
- terminate() 5秒超时
- 自动发送 SIGKILL 强制杀死
- 新实例成功启动（总耗时 12-15秒）
- 日志显示 "Graceful shutdown timeout, force killing..."

---

### 测试 3: 快速连续启动

```bash
for i in {1..3}; do
  python pycore_module_caller.py &
  sleep 2
done
```

**预期**:
- 只有最后一个实例存活
- 所有旧实例优雅退出
- 没有端口冲突错误

---

## Summary

**修改的文件**: 2

1. ✅ `pycore/pyutils/native_ui/step9_frontend/frontend_singleton_detector.py`
   - Line 287-291: 等待时间从 1.5s 增加到 5.0s

2. ✅ `pycore/pyutils/native_ui/step9_frontend/frontend_thread.py`
   - Line 614-636: 添加 TimeoutExpired 处理和强制 kill

**核心改进**:
- ✅ 增加等待时间（1.5s → 5.0s）
- ✅ 添加异常处理（捕获 TimeoutExpired）
- ✅ 强制 kill 机制（SIGTERM 超时后 SIGKILL）
- ✅ 使用 finally 确保资源清理
- ✅ 清晰的日志信息

**设计原则**:
- ✅ 优先优雅关闭（SIGTERM，5秒）
- ✅ 超时后强制 kill（SIGKILL，2秒）
- ✅ 新实例等待足够长（10秒）
- ✅ 极端情况报错让用户处理

---

## Related Files

- ✅ `SINGLETON_GRACEFUL_SHUTDOWN_FIX.md` - RPC port 强制 kill 修复
- ✅ `RESTART_API_IMPLEMENTATION.md` - 重启 API 实现
- ✅ `TTS_HEARTBEAT_IMPLEMENTATION.md` - TTS heartbeat 实现
