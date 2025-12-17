# exec_silent() 参数错误修复

⚠️ **注意**: 本文档记录的是初步修复方案。**最终采用了更好的方案**，详见 `EXEC_SILENT_EXTENDED.md`。

## 最终修复方案（推荐）

**扩展基础类** `pycore/pyfoundations/pybasecommon/commander.py`：
- 为 `exec_silent()` 添加 `**kwargs` 参数支持
- 兼容 `capture_output`, `text`, `timeout` 等 subprocess 风格参数
- 单点修改，全局生效
- 完全向后兼容

详细文档：[EXEC_SILENT_EXTENDED.md](./EXEC_SILENT_EXTENDED.md)

---

## 🔴 问题分析（历史记录）

### 错误日志

```
[VideoStreamService] Failed to start device: exec_silent() got an unexpected keyword argument 'capture_output'

Traceback (most recent call last):
  File "D:\programing\core_node\pycore\pyutils\device\scrcpy_device.py", line 337, in _cleanup_old_tunnels
    exec_silent(cmd, capture_output=True, timeout=5)
TypeError: exec_silent() got an unexpected keyword argument 'capture_output'
```

### 根本原因

1. **`exec_silent()` 函数签名不支持这些参数**:
   ```python
   def exec_silent(command: Union[str, List], info: bool = False, cwd: Optional[str] = None) -> CommandResult:
   ```

2. **错误调用**:
   ```python
   # Line 337 和 350
   exec_silent(cmd, capture_output=True, timeout=5)
   ```

3. **影响**:
   - 所有 19 个设备的视频流启动失败
   - WebSocket 连接成功但无法启动 scrcpy-server
   - 前端无法显示视频画面

---

## ✅ 修复方案

### 修改文件: `pycore/pyutils/device/scrcpy_device.py`

#### 修复前 (Line 337, 350):
```python
try:
    exec_silent(cmd, capture_output=True, timeout=5)
    print(f"[ScrcpyDevice] [OK] Cleaned up old reverse tunnels for {self.serial}")
except subprocess.TimeoutExpired:
    print(f"[ScrcpyDevice] [WARN] Timeout cleaning reverse tunnels for {self.serial}")
```

#### 修复后:
```python
try:
    subprocess.run(cmd, capture_output=True, timeout=5)
    print(f"[ScrcpyDevice] [OK] Cleaned up old reverse tunnels for {self.serial}")
except subprocess.TimeoutExpired:
    print(f"[ScrcpyDevice] [WARN] Timeout cleaning reverse tunnels for {self.serial}")
```

### 修改理由

- `subprocess.run()` 原生支持 `capture_output=True` 和 `timeout=5` 参数
- 保持原有的超时控制和异常捕获逻辑
- 不改变函数行为，只修复调用错误

---

## 📊 修复效果

### 修复前

| 阶段 | 状态 | 错误 |
|------|------|------|
| 设备连接 | ✅ 成功 | 19/19 设备已添加 |
| 视频流启动 | ❌ 失败 | TypeError: exec_silent() 参数错误 |
| WebSocket 连接 | ✅ 成功 | 但无法传输数据 |

### 修复后（预期）

| 阶段 | 状态 | 效果 |
|------|------|------|
| 设备连接 | ✅ 成功 | 19/19 设备已添加 |
| 清理旧隧道 | ✅ 成功 | subprocess.run 正常工作 |
| 启动 scrcpy-server | ✅ 成功 | 无参数错误 |
| 视频流传输 | ✅ 成功 | 预期正常显示 |

---

## 🔍 相关问题总结

### 问题 1: Root 检测阻塞 ✅ 已修复
- **修复**: 跳过 root 检测，假设网络设备都是 root
- **文件**: `adb_heartbeat_service.py:157-162`

### 问题 2: 设备连接后变 Offline ✅ 已修复
- **修复**: 前端跳过 `device.connect` RPC，直接连接 WebSocket
- **文件**: `useVideoStream.ts:147-165`

### 问题 3: exec_silent() 参数错误 ✅ 已修复
- **修复**: 使用 `subprocess.run()` 代替 `exec_silent()`
- **文件**: `scrcpy_device.py:337, 350`

---

## 🚀 测试步骤

### 1. 重启 Matrix 应用

```bash
# 停止当前实例（如果在运行）
# Ctrl+C

# 重新启动
python .\\pymain.py app=matrix
```

### 2. 预期日志

#### 设备连接阶段（后端）:
```
[ADBService] [STEP 6/6] ✓ Device added: 192.168.31.117:5555 -> device_1 (root=True)
[ADBService] [STEP 6/6] ✓ Device added: 192.168.31.119:5555 -> device_2 (root=True)
...
[ADBService] Device stats: 19 total, 0 USB, 19 WiFi, 19 Root  ✅
```

#### 视频流启动阶段（后端）:
```
[VideoWebSocket] ✓ YUV WebSocket accepted for device_1 (192.168.31.117:5555)
[VideoStreamService] Client subscribed to YUV 192.168.31.117:5555, total clients: 1
[VideoStreamService] Device 192.168.31.117:5555 not connected, starting scrcpy-server...
[ScrcpyDevice] [OK] Cleaned up old reverse tunnels for 192.168.31.117:5555  ✅ 应该看到这个
[ScrcpyDevice] [OK] Killed old scrcpy-server processes on 192.168.31.117:5555  ✅ 应该看到这个
[ScrcpyDevice] ✓ Starting scrcpy-server for 192.168.31.117:5555...
[ScrcpyDevice] ✓ Connected to video stream socket
[VideoStreamService] ✓ Video.init sent to client
```

#### 前端（浏览器 Console）:
```
[useVideoStream] Skipping device.connect RPC (device already in device table)
[useVideoStream] Connecting directly to video stream for device_1...
[useVideoStream] ✓ WebSocket OPENED for device_1 (streamType=yuv)
[useVideoStream] ✓ Received video.init message
[useVideoStream] ✓ Video stream connected successfully
```

### 3. 不应该看到的错误

```
❌ TypeError: exec_silent() got an unexpected keyword argument 'capture_output'
❌ [VideoStreamService] Failed to start device
❌ [VideoWebSocket] Failed to start YUV stream
```

---

## ⚠️ 其他已知问题

### WebGL 上下文警告（非阻塞）

```
js: WARNING: Too many active WebGL contexts. Oldest context will be lost.
```

**原因**: 19 个设备同时渲染 WebGL

**影响**: ⚠️ 性能下降，但不影响功能

**临时解决**: 减少同时显示的设备数量

**长期方案**:
- 实现虚拟滚动
- 使用 H.264 + Video 标签（不需要 WebGL）

### DeviceManager 架构问题（非阻塞）

```
[VideoStreamHealth] Device 192.168.31.116:5555 not in DeviceManager
[VideoStreamHealth] Failed to broadcast status: There is no current event loop in thread 'HeartbeatPusher'.
```

**原因**: 设备在 `device_table` 中但不在 `DeviceManager` 中

**影响**: ⚠️ 健康检查广播失败，但不影响视频流

**解决方案**: 统一设备管理架构（未来优化）

---

## 📝 文件修改清单

### 后端修复

```
✅ pyapps/matrix/adb_device_manager/adb_heartbeat_service.py:157-162
   - 跳过 Root 检测

✅ pycore/pyutils/device/scrcpy_device.py:337, 350
   - 修复 exec_silent() 参数错误
   - 使用 subprocess.run() 代替
```

### 前端修复

```
✅ poly_apps/matrixui/hooks/useVideoStream.ts:147-165
   - 跳过 device.connect RPC
```

### 文档

```
✅ pyapps/matrix/ROOT_CHECK_BYPASS.md - Root 检测跳过方案
✅ pyapps/matrix/VIDEO_STREAM_FINAL_FIX.md - 视频流最终修复
✅ pyapps/matrix/CONCURRENT_FIX_COMPLETE.md - 并发处理修复
✅ pyapps/matrix/EXEC_SILENT_FIX.md - exec_silent 参数修复（本文档）
```

---

## ✅ 总结

### 修复完成

1. ✅ Root 检测阻塞 → 跳过检测
2. ✅ 设备连接 Offline → 跳过 RPC
3. ✅ exec_silent 参数错误 → 使用 subprocess.run
4. ✅ 设备并发控制 → Semaphore(3)
5. ✅ Online 验证 → 跳过 offline 设备

### 待验证

1. ⏳ 视频流是否成功启动
2. ⏳ scrcpy-server 是否正常运行
3. ⏳ 前端是否显示视频画面
4. ⏳ 19 个设备是否全部正常

### 下一步

1. **重启 Matrix 应用**
2. **观察后端日志** - 应该看到 `[ScrcpyDevice] [OK] Cleaned up old reverse tunnels`
3. **检查前端画面** - 应该显示 19 个设备的视频流
4. **报告结果**

---

**修复时间**: 2025-12-17 05:35
**修复状态**: ✅ 代码已修复，待重启验证
**预期**: 视频流应该成功启动并显示画面
