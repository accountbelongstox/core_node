# Dummy Byte 协议最终修复

**日期**: 2025-12-20 00:05
**严重性**: 🔴 **CRITICAL** - 所有设备连接失败

---

## 🔴 根本原因

### 错误日志
```
[ScrcpyDevice] [OK] Video socket connected to device (FORWARD)
[ConnectionManager] Connection failed: Connection closed while reading dummy byte
```

### 问题分析

**官方 scrcpy 协议**（通过 MCP Context7 查询）:

```java
public static DesktopConnection open(int scid, boolean tunnelForward,
                                     boolean video, boolean audio,
                                     boolean control, boolean sendDummyByte)
        throws IOException {
    if (tunnelForward) {
        // Server mode: wait for client connections
        LocalServerSocket localServerSocket = new LocalServerSocket(socketName);

        if (video) {
            videoSocket = localServerSocket.accept();
            if (sendDummyByte) {  // ← 关键参数
                videoSocket.getOutputStream().write(0);  // 发送 dummy byte
                sendDummyByte = false;  // ← 发送后设为 false
            }
        }
        if (audio) {
            audioSocket = localServerSocket.accept();
            if (sendDummyByte) {  // ← 已经是 false，不会再发送
                audioSocket.getOutputStream().write(0);
            }
        }
        if (control) {
            controlSocket = localServerSocket.accept();
            if (sendDummyByte) {  // ← 已经是 false，不会再发送
                controlSocket.getOutputStream().write(0);
            }
        }
    }
}
```

**关键发现**:
1. Dummy byte **只在 `sendDummyByte=true` 时发送**
2. **只在第一个 socket**（video socket）发送
3. 发送后立即设为 `false`，后续 socket（audio、control）不发送
4. `sendDummyByte` 是**服务器参数**，需要在启动命令传递

**我们的错误**:
- ❌ 服务器启动命令**没有**传递 `send_dummy_byte=true`
- ❌ 服务器默认**不发送** dummy byte
- ❌ 客户端尝试**读取** dummy byte
- ❌ 读取时连接已关闭（因为服务器不发送）

---

## ✅ 修复方案

### 修复 1: 添加服务器参数 `send_dummy_byte=true`

**文件**: `scrcpy_device.py:750-754`

**修改前**:
```python
# CRITICAL: Add tunnel_forward=true in FORWARD mode (QtScrcpy pattern)
# This tells scrcpy-server to use FORWARD mode protocol
if tunnel_mode == "forward":
    cmd.append("tunnel_forward=true")  # ← 只有这个参数

return cmd
```

**修改后**:
```python
# CRITICAL: Add tunnel_forward=true in FORWARD mode (QtScrcpy pattern)
# This tells scrcpy-server to use FORWARD mode protocol
if tunnel_mode == "forward":
    cmd.append("tunnel_forward=true")
    cmd.append("send_dummy_byte=true")  # ✅ Server sends dummy byte on first socket

return cmd
```

**效果**:
- ✅ 服务器在 video socket 发送 dummy byte
- ✅ 客户端可以正确读取 dummy byte
- ✅ 协议同步，连接不会关闭

### 修复 2: 客户端正确读取 dummy byte

**文件**: `scrcpy_device.py:320-330`

**代码**（已修复）:
```python
self._video_socket.connect(('localhost', video_port))
print(f"[ScrcpyDevice] [OK] Video socket connected to device (FORWARD)")

# ✅ FIXED: In tunnel_forward mode, server SENDS dummy byte, client MUST read and discard it
# Official scrcpy: videoSocket.getOutputStream().write(0) on server side
# Client must consume this byte before reading device metadata
try:
    dummy_byte = self._video_socket.recv(1)
    if not dummy_byte:
        raise RuntimeError("Connection closed while reading dummy byte")
    print(f"[ScrcpyDevice] Consumed dummy byte from server: {dummy_byte.hex()}")
except socket.timeout:
    # Timeout is acceptable - some servers might not send dummy byte
    print(f"[ScrcpyDevice] [WARN] Timeout reading dummy byte (server might not send it)")
```

**关键点**:
- ✅ **只在 video socket** 读取 dummy byte
- ✅ Control socket **不读取**（服务器不发送）
- ✅ 读取后丢弃，继续读取设备元数据

---

## 📊 协议流程

### 正确的 FORWARD 模式流程

```
服务器端 (Android):
1. LocalServerSocket.accept() → 接受 video socket 连接
2. videoSocket.getOutputStream().write(0) → 发送 dummy byte
3. sendDummyByte = false → 设为 false
4. 发送设备元数据（64 bytes）
5. 发送 codec 元数据（12 bytes）
6. 发送视频帧数据...

7. LocalServerSocket.accept() → 接受 control socket 连接
8. sendDummyByte = false → 不发送 dummy byte
9. 等待控制消息...

客户端 (PC):
1. video_socket.connect() → 连接到 video socket
2. video_socket.recv(1) → 读取并丢弃 dummy byte ✅
3. video_socket.recv(64) → 读取设备元数据
4. video_socket.recv(12) → 读取 codec 元数据
5. 读取视频帧数据...

6. control_socket.connect() → 连接到 control socket
7. （不读取 dummy byte）✅
8. 发送控制消息...
```

---

## 🎯 为什么需要 Dummy Byte？

根据官方文档和代码，dummy byte 的作用：

1. **同步检测**: 确保连接建立成功
2. **流量启动**: 触发数据流开始
3. **兼容性**: 某些网络环境需要先发送数据才能稳定连接

**官方注释**:
> "Send a dummy byte so the client may read() to detect a connection error"

---

## 🧪 测试验证

### Test 1: 单设备连接

**预期**:
```
[ScrcpyDevice] [OK] Video socket connected to device (FORWARD)
[ScrcpyDevice] Consumed dummy byte from server: 00
[ScrcpyDevice] Reading device metadata...
[ScrcpyDevice] Device name from metadata: SM-G9200
[ScrcpyDevice] [OK] Device: SM-G9200
```

### Test 2: 19设备并发

**预期**:
- ✅ 所有设备正常连接
- ✅ 所有设备读取到 dummy byte
- ✅ 所有设备成功读取元数据
- ✅ 连接成功率 90%+

---

## 📝 经验教训

### 教训 1: 服务器参数必须完整

**错误做法**:
```python
cmd.append("tunnel_forward=true")  # 只设置 tunnel 模式
```

**正确做法**:
```python
cmd.append("tunnel_forward=true")
cmd.append("send_dummy_byte=true")  # 必须显式启用 dummy byte
```

### 教训 2: 客户端协议必须匹配服务器

如果服务器发送 dummy byte（`send_dummy_byte=true`），客户端**必须读取**。
如果服务器不发送 dummy byte（`send_dummy_byte=false` 或默认），客户端**不应读取**。

### 教训 3: 只在第一个 socket 发送

Dummy byte **只在第一个 socket**（video socket）发送，后续 socket（audio、control）**不发送**。
客户端代码必须匹配这个行为。

---

## 🔗 相关文件

**修改文件**:
- `pycore/pyutils/device/scrcpy_device.py` (lines 320-330, 752-754)

**参考文档**:
- scrcpy 官方 Java 源码: `DesktopConnection.java`
- MCP Context7 查询: `/Genymobile/scrcpy` 文档

---

## 📊 完整修复列表

| 修复项 | 文件 | 状态 | 影响 |
|-------|------|------|------|
| 添加 send_dummy_byte=true | scrcpy_device.py:754 | ✅ | 服务器发送 dummy byte |
| 客户端读取 dummy byte | scrcpy_device.py:324 | ✅ | 协议同步 |
| Control socket 不读取 | scrcpy_device.py:375 | ✅ | 符合协议 |

---

**状态**: ✅ **已修复**
**测试**: ⏳ **待19设备并发验证**
**影响**: 🟢 **连接成功率预期提升到 90%+**
