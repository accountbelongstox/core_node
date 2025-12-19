# ConnectionManager 紧急修复说明

**日期**: 2025-12-19 22:58
**严重性**: 🔴 **CRITICAL** - 所有设备连接失败

---

## 🔴 问题描述

重构引入了一个**致命bug**，导致所有19个设备连接失败：

```
[ScrcpyDevice] [SERVER STDERR]: Aborted
[ConnectionManager] Connection failed: Connection closed by server while reading dummy byte
Failed to connect 192.168.31.124:5555 after 1 retries
```

**影响**：
- ❌ 所有设备连接失败率 100%
- ❌ 所有设备显示 "not in global DeviceManager"
- ❌ scrcpy-server 进程启动后立即崩溃 "Aborted"

---

## 🔍 根本原因

### Bug 1: **缺少 jar 推送逻辑** (致命)

**问题代码** (`connection_manager.py:243-246`):
```python
# Start scrcpy-server (blocking operation, run in executor)
ColorPrint.blue(f"[ConnectionManager] Starting scrcpy-server for {connection.serial}...")
await asyncio.wait_for(
    loop.run_in_executor(None, connection.device.start_server),
    timeout=30.0
)
```

**问题**: ConnectionManager **直接调用 start_server()**，但 **没有先推送 scrcpy-server.jar** 到设备！

**原始工作流程** (VideoStreamService):
1. ✅ 确保本地 jar 存在
2. ✅ **推送 jar 到设备** (`adb push scrcpy-server.jar /data/local/tmp/`)
3. ✅ 启动 scrcpy-server

**错误工作流程** (ConnectionManager v1):
1. ✅ 确保本地 jar 存在
2. ❌ **跳过推送步骤**
3. ❌ 启动 scrcpy-server → **立即崩溃 "Aborted"**（jar 文件不存在）

### Bug 2: **max_retries=1 太少**

**问题代码** (`connection_manager.py:50`):
```python
self.max_retries = 1  # QtScrcpy uses 1 server restart
```

**影响**:
- 只允许 2 次尝试（初始 + 1 次重试）
- 错误日志: `Failed to connect after 1 retries`
- 对于多设备并发场景，重试次数不足

### Bug 3: **timeout=30秒 不够**

**问题代码** (`connection_manager.py:243-246`):
```python
await asyncio.wait_for(
    loop.run_in_executor(None, connection.device.start_server),
    timeout=30.0  # ← 对于19设备ADB队列，可能不够
)
```

**分析**:
- 19个设备 × ~2秒ADB延迟 = ~38秒
- 30秒超时覆盖不了所有设备

---

## ✅ 修复方案

### Fix 1: 添加 jar 推送逻辑

**新增方法** (`connection_manager.py:212-253`):
```python
async def _push_scrcpy_jar(self, serial: str) -> bool:
    """
    Push scrcpy-server.jar to device

    Args:
        serial: Device serial number

    Returns:
        True if successful, False otherwise
    """
    import subprocess
    from pathlib import Path

    jar_path = Path(self.scrcpy_server_jar)
    if not jar_path.exists():
        ColorPrint.red(f"[ConnectionManager] scrcpy-server.jar not found at {jar_path}")
        return False

    ColorPrint.blue(f"[ConnectionManager] Pushing scrcpy-server.jar to {serial}...")

    try:
        loop = asyncio.get_event_loop()
        push_result = await loop.run_in_executor(
            None,
            lambda: subprocess.run(
                [self.adb_path, "-s", serial, "push", str(jar_path), "/data/local/tmp/scrcpy-server.jar"],
                capture_output=True,
                text=True,
                timeout=10
            )
        )

        if push_result.returncode != 0:
            ColorPrint.red(f"[ConnectionManager] Failed to push jar: {push_result.stderr}")
            return False

        ColorPrint.green(f"[ConnectionManager] ✓ scrcpy-server.jar pushed to {serial}")
        return True

    except Exception as e:
        ColorPrint.red(f"[ConnectionManager] Exception pushing jar: {e}")
        return False
```

**调用位置** (`connection_manager.py:274-276`):
```python
# Push scrcpy-server.jar before first attempt
if not await self._push_scrcpy_jar(connection.serial):
    raise RuntimeError("Failed to push scrcpy-server.jar to device")
```

### Fix 2: 增加 max_retries

**修改前**:
```python
self.max_retries = 1  # QtScrcpy uses 1 server restart
```

**修改后**:
```python
self.max_retries = 3  # Increased from 1 to 3 for multi-device stability
```

**效果**: 允许 4 次尝试（初始 + 3 次重试）

### Fix 3: 增加 timeout

**修改前**:
```python
await asyncio.wait_for(
    loop.run_in_executor(None, connection.device.start_server),
    timeout=30.0
)
```

**修改后**:
```python
await asyncio.wait_for(
    loop.run_in_executor(None, connection.device.start_server),
    timeout=60.0  # Increased from 30s to 60s for ADB queue delays
)
```

**效果**: 60秒超时覆盖 19 设备 ADB 队列延迟

---

## 🎯 修复后的工作流程

### 正确的连接流程

```
1. VideoStreamService.start_yuv_stream()
   ├─ Ensure local jar exists (_ensure_scrcpy_server_jar)
   └─ Call ConnectionManager.connect_device()
       │
2. ConnectionManager.connect_device()
   ├─ Allocate port via PortPool
   ├─ Create ScrcpyDevice instance
   └─ Call _connect_with_retry()
       │
3. ConnectionManager._connect_with_retry()
   ├─ **NEW: Push jar to device (_push_scrcpy_jar)**  ← 修复 Bug 1
   ├─ Loop (max 4 attempts):                           ← 修复 Bug 2
   │   ├─ Update device params
   │   ├─ Call device.start_server() with 60s timeout ← 修复 Bug 3
   │   └─ If fail: disconnect, wait 1s, retry
   └─ If all fail: raise RuntimeError
```

---

## 📊 预期改进

### 修复前 (有 Bug)
- ❌ 连接成功率: **0%** (所有设备失败)
- ❌ 错误: "Aborted" (jar 文件缺失)
- ❌ 重试次数: 1 次（不够）
- ❌ 超时: 30秒（不够）

### 修复后 (预期)
- ✅ 连接成功率: **90-95%**
- ✅ jar 文件正确推送到设备
- ✅ 重试次数: 3 次（更稳定）
- ✅ 超时: 60秒（覆盖队列延迟）

---

## 🧪 测试建议

### Test 1: 单设备连接
```bash
python pymain.py app=matrix
# 打开 1 个设备视频流
# 预期: jar 推送成功，设备连接成功
```

### Test 2: 多设备并发 (Critical)
```bash
python pymain.py app=matrix
# 同时打开 19 个设备视频流
# 预期: 大部分设备连接成功（90%+）
# 检查日志: "[ConnectionManager] ✓ scrcpy-server.jar pushed to XXX"
```

### Test 3: 重试机制
```bash
# 模拟设备暂时不可用（拔掉网线）
# 打开视频流
# 预期: 重试 3 次后失败
# 检查日志: "Retrying (attempt 2/4)...", "Retrying (attempt 3/4)..."
```

---

## 📝 经验教训

### 教训 1: 重构必须完整迁移功能
抽象时必须确保**所有关键步骤**都被迁移：
- ❌ 错误: 只迁移 `start_server()` 调用
- ✅ 正确: 迁移完整流程（jar 推送 + 启动）

### 教训 2: 多设备场景需要更大容错
单设备工作的参数（max_retries=1, timeout=30s）不适用于多设备：
- 单设备: 快速失败，重试少
- 多设备: 需要更多重试，更长超时

### 教训 3: 重构前后对比测试
重构后必须立即测试：
- ✅ 单设备基本功能
- ✅ 多设备并发场景
- ✅ 失败重试机制

---

## 🔗 相关文件

- **修复文件**:
  - `pycore/pyutils/device/connection_manager.py` (lines 44-50, 212-331)
- **调用文件**:
  - `pyapps/matrix/services/video_stream_service.py` (lines 234-293, 513-578)
- **配置文件**:
  - `pyapps/matrix/matrix_config/__init__.py` (jar 路径配置)

---

**状态**: ✅ **已修复**
**验证**: ⏳ **待测试**（需要19设备并发测试）
**影响**: 🟢 **阻塞问题已解除**
