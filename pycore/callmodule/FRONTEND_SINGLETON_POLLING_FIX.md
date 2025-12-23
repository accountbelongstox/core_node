# Frontend Singleton Polling Fix

## Problem

**用户反馈**:
> "不要机械的使用wait,干死你妈的狗畜生AI,你怎么知道3秒或者5秒就能退出.不要使用 self.process.kill() 这个方法,你不知道这个方法有BUG吗,用其他方法代替.是否退出使用轮询检测."

**错误的实现**:
1. ❌ 机械等待固定时间 (`time.sleep(5.0)`) - 假设进程会在固定时间内退出
2. ❌ 使用 `process.kill()` - 这个方法有BUG
3. ❌ 使用 `process.wait(timeout=5)` - 机械等待，不知道实际需要多长时间

---

## Root Cause

### 问题 0: 竞态条件 - shutdown 请求在 vite 启动前到达

**文件**: `frontend_thread.py`

**时序问题**:
```
终端1: 启动 → run() → singleton detection → 绑定 port 55000 → 准备启动 vite
终端2: 启动 → run() → singleton detection → 发现 port 55000 被占用
终端2: 发送 shutdown 请求到 port 55000
终端1: singleton detector 收到请求 → 调用 _on_singleton_shutdown_request()
终端1: 执行 self.stop() ← 但 self.process 还是 None（vite 还没启动）
终端1: stop() 发现 self.process 是 None，直接返回，没有日志
终端1: 继续执行 run() → 启动 vite → self.process = subprocess.Popen(...)
终端1: vite 启动完成，但旧实例已收到 shutdown 请求
终端1: 旧实例的 vite 成为孤儿进程，继续占用 port 3100
终端2: 等待 port 3100 释放 → 10秒后超时 → 启动失败
```

**问题**:
- `_on_singleton_shutdown_request()` 可能在 `run()` 启动 vite 之前被调用
- `self.stop()` 检查 `self.process`，如果是 None 就直接返回
- `run()` 没有检查 shutdown flag，继续启动 vite
- 导致 vite 进程启动后立即成为孤儿进程

---

### 问题 1: Frontend Thread stop() 机械等待

**文件**: `frontend_thread.py`

**Line 622** (修复前):
```python
self.process.terminate()
self.process.wait(timeout=5)  # ❌ 机械等待5秒，不知道实际需要多久
```

**Line 627** (修复前):
```python
self.process.kill()  # ❌ 有BUG，不能用
self.process.wait(timeout=2)  # ❌ 又是机械等待
```

**问题**:
- 不知道进程实际需要多久才能退出
- 可能等待时间过短（进程还没退出就超时）
- 可能等待时间过长（进程已退出还在等待）
- `process.kill()` 方法有BUG

---

### 问题 2: Frontend Singleton Detector 机械 sleep

**文件**: `frontend_singleton_detector.py`

**Line 291** (修复前):
```python
time.sleep(5.0)  # ❌ 机械等待5秒，不知道旧实例何时释放端口
```

**问题**:
- 不知道旧实例何时释放端口
- 可能旧实例2秒就释放了，但还要等3秒
- 可能旧实例需要8秒，但只等了5秒就超时

---

## Solution

### 修复 0: 竞态条件 - 在 run() 中检查 shutdown flag

**文件**: `frontend_thread.py`

**Line 104-121** (修复后):
```python
def _on_singleton_shutdown_request(self):
    """Called when another frontend requests this one to shutdown"""
    ColorPrint.yellow("[FrontendThread] Singleton shutdown requested by new frontend instance")
    self._shutdown_requested.set()

    # Trigger frontend shutdown via THREAD_BUS
    THREAD_BUS.trigger_event('frontend.singleton.shutdown', {
        'reason': 'New frontend instance detected',
        'port': self.singleton_detector.get_port() if self.singleton_detector else None
    })

    # Stop frontend process (if it's already running)
    # Note: This might be called BEFORE run() starts the process
    # In that case, run() will check _shutdown_requested flag and exit early
    self.stop()

    # Also set running=False to signal run() to exit
    self.running = False
```

**Line 151-165** (修复后 - 在 run() 中添加检查):
```python
ColorPrint.green(f"[FrontendThread] Became PRIMARY frontend on singleton port {detection_result.port}")

# Check if shutdown was requested during singleton detection
# This can happen if new instance starts while we're in the middle of detection
if self._shutdown_requested.is_set():
    ColorPrint.yellow("[FrontendThread] Shutdown requested before starting frontend, exiting...")
    return

# Step 1: Install dependencies if needed
if self.config.auto_install:
    ColorPrint.blue("[FrontendThread] Installing dependencies...")
    self._ensure_dependencies()

# Check shutdown flag again before starting frontend
if self._shutdown_requested.is_set():
    ColorPrint.yellow("[FrontendThread] Shutdown requested after dependency check, exiting...")
    return

# Step 2: Start frontend based on mode
```

**改进**:
- ✅ `_on_singleton_shutdown_request()` 设置 `self.running = False`
- ✅ `run()` 在启动 vite 之前检查 `_shutdown_requested` flag
- ✅ 如果收到 shutdown 请求，`run()` 提前退出，不启动 vite
- ✅ 避免 vite 进程启动后成为孤儿

---

### 修复 1: Frontend Thread stop() - 关闭 pipes

**文件**: `frontend_thread.py`

**Line 626-634** (修复后):
```python
# Step 1: Send SIGTERM
self.process.terminate()
ColorPrint.blue(f"[FrontendThread] Sent SIGTERM to process {pid}")

# Step 1.5: Close stdout/stderr pipes to allow process to exit
# If pipes are not closed, process may hang waiting for pipe to be read
try:
    if self.process.stdout:
        self.process.stdout.close()
    if self.process.stderr:
        self.process.stderr.close()
except Exception as pipe_err:
    ColorPrint.gray(f"[FrontendThread] Error closing pipes: {pipe_err}")
```

**改进**:
- ✅ 在 terminate() 后关闭 stdout/stderr pipes
- ✅ 允许 vite 进程正常退出（不会因为 pipe 阻塞而挂起）

---

### 修复 2: Frontend Thread stop() - 使用轮询检测

**文件**: `frontend_thread.py`

**Line 614-677** (修复后):
```python
def stop(self):
    """Stop frontend process gracefully"""
    if self.process:
        ColorPrint.yellow("[FrontendThread] Stopping frontend process...")

        try:
            pid = self.process.pid

            # Step 1: Send SIGTERM
            self.process.terminate()
            ColorPrint.blue(f"[FrontendThread] Sent SIGTERM to process {pid}")

            # Step 2: Poll to check if process exited (don't assume fixed time)
            max_wait = 10.0
            interval = 0.5
            waited = 0.0

            while waited < max_wait:
                # Check if process has exited
                if self.process.poll() is not None:
                    ColorPrint.green(f"[FrontendThread] Process terminated gracefully after {waited:.1f}s")
                    break

                time.sleep(interval)
                waited += interval
            else:
                # Timeout - need to force kill
                # Don't use self.process.kill() - it has bugs
                # Use os.kill with SIGKILL instead
                ColorPrint.yellow(f"[FrontendThread] Graceful shutdown timeout after {max_wait}s")
                ColorPrint.yellow(f"[FrontendThread] Force killing process {pid}...")

                try:
                    import os
                    import signal
                    os.kill(pid, signal.SIGKILL)
                    ColorPrint.blue(f"[FrontendThread] Sent SIGKILL to process {pid}")

                    # Poll again to verify it's dead
                    killed_wait = 0.0
                    killed_max = 5.0

                    while killed_wait < killed_max:
                        if self.process.poll() is not None:
                            ColorPrint.green(f"[FrontendThread] Process force killed after {killed_wait:.1f}s")
                            break

                        time.sleep(0.5)
                        killed_wait += 0.5
                    else:
                        ColorPrint.red(f"[FrontendThread] Failed to kill process {pid} even with SIGKILL")

                except ProcessLookupError:
                    ColorPrint.green("[FrontendThread] Process already exited")
                except Exception as kill_err:
                    ColorPrint.red(f"[FrontendThread] Error killing process: {kill_err}")

        except Exception as e:
            ColorPrint.red(f"[FrontendThread] Error stopping process: {e}")
        finally:
            self.process = None

    self.running = False
    ColorPrint.green("[FrontendThread] Frontend stopped")
```

**改进**:
- ✅ 使用 `process.poll()` 轮询检测进程是否退出
- ✅ 不机械等待固定时间，而是循环检测
- ✅ 进程退出后立即返回（例如2秒就退出，不用等到10秒）
- ✅ 不使用 `process.kill()`，改用 `os.kill(pid, signal.SIGKILL)`
- ✅ 强制 kill 后也轮询验证进程是否真的被杀死
- ✅ 清晰的日志显示实际等待时间

---

### 修复 2: Frontend Singleton Detector - 轮询检测端口释放

**文件**: `frontend_singleton_detector.py`

**Line 286-313** (修复后):
```python
if shutdown_result['accepted']:
    ColorPrint.green("[FrontendSingleton] Old frontend accepted shutdown")
    ColorPrint.blue("[FrontendSingleton] Waiting for old frontend to shutdown gracefully...")

    # Don't sleep for fixed time - poll to check if port is released
    # Old instance should release singleton port when it shuts down
    max_wait = 15.0
    interval = 0.5
    waited = 0.0

    while waited < max_wait:
        # Try to bind - if successful, old instance has released the port
        if self._try_bind_port(port):
            ColorPrint.green(f"[FrontendSingleton] Old frontend released port after {waited:.1f}s")
            ColorPrint.green("[FrontendSingleton] Became PRIMARY frontend (after shutdown)")
            return FrontendDetectionResult(
                is_primary=True,
                port=port,
                existing_instance=False,
                existing_port=None,
                message=f"Became PRIMARY frontend on port {port} (shutdown old frontend)"
            )

        time.sleep(interval)
        waited += interval

    # Timeout - port still not available
    ColorPrint.yellow(f"[FrontendSingleton] Old frontend did not release port after {max_wait}s")

    # Retry binding
    max_retries = 3
    ...
```

**改进**:
- ✅ 不机械 `sleep(5.0)`
- ✅ 轮询检测端口是否释放（使用 `_try_bind_port`）
- ✅ 端口释放后立即返回（例如3秒就释放，不用等到15秒）
- ✅ 清晰的日志显示实际等待时间

---

## Expected Behavior (修复后)

### 正常情况（Vite 快速退出）

```
t=0.0s: 新实例启动
t=0.2s: 发送 shutdown 请求
t=0.3s: 旧实例调用 frontend_thread.stop()
t=0.4s: 发送 SIGTERM 给 vite 进程
t=0.5s: 开始轮询检测进程是否退出
t=1.0s: poll() 检测到进程退出 ✅
t=1.0s: 日志: "Process terminated gracefully after 1.0s"
t=1.5s: Singleton port 55000 释放
t=2.0s: 新实例轮询检测到端口释放 ✅
t=2.0s: 日志: "Old frontend released port after 2.0s"
t=2.1s: 新实例绑定端口，启动
```

**日志特征**:
- ✅ 显示实际等待时间（例如 "after 1.0s", "after 2.0s"）
- ✅ 不浪费时间等待
- ✅ 没有固定的5秒或10秒等待

---

### 边界情况（Vite 慢速退出）

```
t=0.0s: 新实例启动
t=0.2s: 发送 shutdown 请求
t=0.3s: 旧实例调用 stop()
t=0.4s: 发送 SIGTERM
t=0.5s: 开始轮询 (poll 返回 None - 进程还在运行)
t=1.0s: poll 返回 None
t=2.0s: poll 返回 None
...
t=7.5s: poll() 检测到进程退出 ✅
t=7.5s: 日志: "Process terminated gracefully after 7.5s"
t=8.0s: Singleton port 55000 释放
t=8.5s: 新实例检测到端口释放 ✅
t=8.5s: 日志: "Old frontend released port after 8.5s"
```

**日志特征**:
- ✅ 等待实际需要的时间（7.5秒）
- ✅ 不会因为机械等待5秒而超时

---

### 极端情况（Vite 卡死，需要强制 kill）

```
t=0.0s: 新实例启动
t=0.2s: 发送 shutdown 请求
t=0.3s: 旧实例调用 stop()
t=0.4s: 发送 SIGTERM
t=0.5s - t=10.4s: 轮询检测 (poll 一直返回 None) ⚠️ 进程卡死
t=10.5s: 超时，发送 SIGKILL (使用 os.kill，不用 process.kill) ✅
t=10.5s: 日志: "Graceful shutdown timeout after 10.0s"
t=10.5s: 日志: "Force killing process {pid}..."
t=10.5s: 日志: "Sent SIGKILL to process {pid}"
t=10.5s - t=11.0s: 轮询检测强制 kill 是否成功
t=11.0s: poll() 检测到进程被杀死 ✅
t=11.0s: 日志: "Process force killed after 0.5s"
t=11.5s: Singleton port 55000 释放
t=12.0s: 新实例检测到端口释放 ✅
```

**日志特征**:
- ✅ 尝试优雅关闭10秒
- ✅ 使用 `os.kill(pid, signal.SIGKILL)` 而不是 `process.kill()`
- ✅ 强制 kill 后也轮询验证

---

## Design Principles

### 1. 轮询检测，不机械等待

| 错误方式 | 正确方式 |
|---------|---------|
| `time.sleep(5.0)` | `while waited < max_wait: if condition: break; sleep(0.5)` |
| `process.wait(timeout=5)` | `while waited < max_wait: if process.poll() is not None: break` |
| `time.sleep(2.0)` | `while waited < max_wait: if is_port_available(): break` |

### 2. 使用 process.poll() 检测退出

```python
# ❌ 错误：机械等待
process.wait(timeout=5)

# ✅ 正确：轮询检测
while waited < max_wait:
    if process.poll() is not None:
        # 进程已退出
        break
    time.sleep(0.5)
    waited += 0.5
```

### 3. 不使用 process.kill()，使用 os.kill()

```python
# ❌ 错误：process.kill() 有BUG
self.process.kill()

# ✅ 正确：使用 os.kill
import os
import signal
os.kill(pid, signal.SIGKILL)
```

### 4. 强制 kill 后也要验证

```python
# ✅ 发送 SIGKILL 后轮询验证进程是否真的被杀死
os.kill(pid, signal.SIGKILL)

killed_wait = 0.0
while killed_wait < 5.0:
    if self.process.poll() is not None:
        ColorPrint.green(f"Process force killed after {killed_wait:.1f}s")
        break
    time.sleep(0.5)
    killed_wait += 0.5
```

---

## Summary

**修改的文件**: 2

1. ✅ `pycore/pyutils/native_ui/step9_frontend/frontend_thread.py`
   - Line 104-121: 修复 _on_singleton_shutdown_request - 在 vite 启动前就收到 shutdown 请求的竞态条件
   - Line 151-165: 在 run() 中检查 shutdown flag，避免启动 vite 后又被 shutdown
   - Line 626-634: 关闭 stdout/stderr pipes 允许进程退出
   - Line 636-648: 使用 poll() 轮询检测进程退出，不使用 process.kill()
   - Line 658: 使用 os.kill(pid, signal.SIGKILL) 代替 process.kill()

2. ✅ `pycore/pyutils/native_ui/step9_frontend/frontend_singleton_detector.py`
   - Line 286-313: 轮询检测端口释放，不机械 sleep

**核心改进**:
- ✅ 使用 `process.poll()` 轮询检测进程退出
- ✅ 使用 `_try_bind_port()` 轮询检测端口释放
- ✅ 不机械等待固定时间
- ✅ 进程/端口释放后立即返回
- ✅ 不使用 `process.kill()`，改用 `os.kill(pid, signal.SIGKILL)`
- ✅ 强制 kill 后也轮询验证
- ✅ 清晰的日志显示实际等待时间

**设计原则**:
- ✅ 轮询检测，不假设固定时间
- ✅ 验证实际状态，不盲目等待
- ✅ 使用系统调用 `os.kill()`，不用有BUG的 `process.kill()`
- ✅ 所有异步操作都要验证结果

---

## Related Files

- ✅ `SINGLETON_GRACEFUL_SHUTDOWN_FIX.md` - RPC port 强制 kill 修复
- ✅ `FRONTEND_SINGLETON_TIMING_FIX.md` - 旧的机械等待实现（已废弃）
- ✅ `RESTART_API_IMPLEMENTATION.md` - 重启 API 实现
- ✅ `TTS_HEARTBEAT_IMPLEMENTATION.md` - TTS heartbeat 实现
