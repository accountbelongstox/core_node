# Scrcpy Tunnel Modes - 完整解析

**Date**: 2025-12-22
**Based on**: Official scrcpy source code and documentation

---

## 概述

Scrcpy使用两种tunnel模式来实现PC和Android设备之间的通信：

1. **REVERSE模式（默认，优先）** - 推荐使用
2. **FORWARD模式（fallback）** - 兼容性fallback

---

## 模式对比表

| 特性 | REVERSE模式（优先） | FORWARD模式（fallback） |
|------|-------------------|----------------------|
| **优先级** | 0（最高） | 1（较低） |
| **ADB命令** | `adb reverse localabstract:scrcpy_XXX tcp:PORT` | `adb forward tcp:PORT localabstract:scrcpy_XXX` |
| **Server参数** | `tunnel_forward=false`（默认，可省略） | `tunnel_forward=true`（必须！） |
| **Server行为** | 作为客户端`connect(socketName)` | 创建`LocalServerSocket`并`accept()` |
| **PC行为** | 创建ServerSocket监听 | 作为客户端连接 |
| **Dummy Byte** | ❌ 不发送 | ✅ 发送（在第一个socket的accept()后） |
| **效率** | 更高效 | 略低 |
| **兼容性** | Android 8以下Wi-Fi ADB不支持 | 全兼容 |
| **网络设备** | 可能失败 | 推荐使用 |

---

## REVERSE模式（优先）

### 工作原理

```
┌──────────┐                           ┌──────────┐
│   PC     │                           │  Device  │
│          │                           │          │
│ Server   │◄─── adb reverse tunnel ───│  Client  │
│ Socket   │                           │  Socket  │
│ (listen) │                           │(connect) │
└──────────┘                           └──────────┘

1. PC执行: adb reverse localabstract:scrcpy_12345678 tcp:27183
2. PC创建ServerSocket，监听端口27183
3. Server（设备）参数: tunnelForward=false（默认）
4. Server作为客户端connect("scrcpy_12345678")
5. ADB将设备的连接反向转发到PC的27183端口
6. PC的ServerSocket.accept()接受连接
7. ❌ 不发送dummy byte（Server是客户端）
```

### 源码证据

**DesktopConnection.java line 92-100**:
```java
} else {  // tunnelForward == false (REVERSE mode)
    if (video) {
        videoSocket = connect(socketName);  // ✅ Server作为客户端连接
    }
    if (audio) {
        audioSocket = connect(socketName);
    }
    if (control) {
        controlSocket = connect(socketName);
    }
}
```

### 优点

- ✅ 官方默认模式
- ✅ 更高效（Server直接连接）
- ✅ 推荐使用

### 缺点

- ❌ Android 8及以下Wi-Fi ADB不支持
- ❌ 某些自定义ADB传输不支持
- ❌ 网络设备可能失败（Windows ADB bug）

### 使用代码

```python
from pycore.pyutils.device import REVERSE_MODE, TunnelConfig

mode = REVERSE_MODE
config = TunnelConfig(
    device_serial="192.168.31.119:5555",
    scid_hex="1a2b3c4d",
    local_port=27183,
    device_socket_name="scrcpy_1a2b3c4d"
)

# 1. Setup ADB tunnel
cmd = mode.get_adb_tunnel_command(adb_path, config)
# ['adb', '-s', '192.168.31.119:5555', 'reverse',
#  'localabstract:scrcpy_1a2b3c4d', 'tcp:27183']

# 2. Get server parameter (None for REVERSE)
param = mode.get_server_parameter()  # None

# 3. Check dummy byte
should_read_dummy = mode.should_send_dummy_byte()  # False

# 4. Create listening socket
listen_socket = mode.create_client_socket(config, timeout=10.0)
# Returns ServerSocket listening on port 27183
```

---

## FORWARD模式（fallback）

### 工作原理

```
┌──────────┐                           ┌──────────┐
│   PC     │                           │  Device  │
│          │                           │          │
│  Client  │──── adb forward tunnel ───►│  Server  │
│  Socket  │                           │  Socket  │
│(connect) │                           │ (listen) │
└──────────┘                           └──────────┘

1. PC执行: adb forward tcp:27183 localabstract:scrcpy_12345678
2. Server（设备）参数: tunnel_forward=true（必须！）
3. Server创建LocalServerSocket("scrcpy_12345678")并监听
4. Server调用localServerSocket.accept()等待连接
5. PC作为客户端连接localhost:27183
6. ADB将PC的连接转发到设备的localabstract socket
7. Server的accept()返回连接
8. ✅ Server发送dummy byte (0x00) 到第一个socket
9. PC必须读取这个dummy byte
```

### 源码证据

**DesktopConnection.java line 64-90**:
```java
if (tunnelForward) {  // tunnelForward == true (FORWARD mode)
    try (LocalServerSocket localServerSocket = new LocalServerSocket(socketName)) {
        if (video) {
            videoSocket = localServerSocket.accept();  // ✅ Server等待连接
            if (sendDummyByte) {
                // send one byte so the client may read() to detect a connection error
                videoSocket.getOutputStream().write(0);  // ✅ 发送dummy byte
                sendDummyByte = false;
            }
        }
        // ... audio and control sockets similar
    }
}
```

### 优点

- ✅ 全兼容（支持Android 8以下Wi-Fi ADB）
- ✅ 网络设备推荐使用
- ✅ 可靠性高

### 缺点

- ❌ 略低效（Server需要创建ServerSocket并等待）
- ❌ 必须正确设置`tunnel_forward=true`
- ❌ 必须读取dummy byte

### 使用代码

```python
from pycore.pyutils.device import FORWARD_MODE, TunnelConfig

mode = FORWARD_MODE
config = TunnelConfig(
    device_serial="192.168.31.119:5555",
    scid_hex="1a2b3c4d",
    local_port=27183,
    device_socket_name="scrcpy_1a2b3c4d"
)

# 1. Setup ADB tunnel
cmd = mode.get_adb_tunnel_command(adb_path, config)
# ['adb', '-s', '192.168.31.119:5555', 'forward',
#  'tcp:27183', 'localabstract:scrcpy_1a2b3c4d']

# 2. Get server parameter (CRITICAL!)
param = mode.get_server_parameter()  # "tunnel_forward=true"
# Must append to server command!

# 3. Check dummy byte
should_read_dummy = mode.should_send_dummy_byte()  # True

# 4. Create client socket
sock = mode.create_client_socket(config, timeout=10.0)
# Returns regular socket (not listening)

# 5. Connect to forwarded port
sock.connect(('localhost', config.local_port))

# 6. Read dummy byte (CRITICAL!)
dummy = sock.recv(1)
if not dummy:
    raise RuntimeError("No dummy byte received!")
```

---

## 自动Fallback策略

官方scrcpy使用REVERSE优先，FORWARD fallback的策略：

```python
from pycore.pyutils.device import TunnelModeFactory

# 获取所有模式，按优先级排序
modes = TunnelModeFactory.get_all_modes_by_priority()
# [ReverseTunnelMode(priority=0), ForwardTunnelMode(priority=1)]

for mode in modes:
    try:
        # 尝试setup tunnel
        cmd = mode.get_adb_tunnel_command(adb_path, config)
        result = subprocess.run(cmd, ...)

        if result.returncode == 0:
            print(f"✅ {mode.get_mode_name()} mode succeeded!")
            break  # 成功，使用此模式
    except Exception as e:
        print(f"❌ {mode.get_mode_name()} mode failed: {e}")
        continue  # 失败，尝试下一个模式
```

---

## 常见错误和修复

### 错误1：参数映射反了

❌ **错误代码**:
```python
# WRONG!
if tunnel_mode == "reverse":
    cmd.append("tunnel_forward=true")  # 反了！
```

✅ **正确代码**:
```python
# CORRECT!
if tunnel_mode == "reverse":
    # tunnelForward默认false，不需要设置
    pass
elif tunnel_mode == "forward":
    cmd.append("tunnel_forward=true")  # 正确
```

### 错误2：FORWARD模式没读dummy byte

❌ **错误代码**:
```python
# FORWARD mode
sock.connect(('localhost', port))
# 直接读metadata - WRONG!
metadata = sock.recv(64)  # ❌ 会读到dummy byte!
```

✅ **正确代码**:
```python
# FORWARD mode
sock.connect(('localhost', port))
# 先读dummy byte
dummy = sock.recv(1)  # ✅ 读取0x00
if not dummy:
    raise RuntimeError("No dummy byte!")
# 再读metadata
metadata = sock.recv(64)  # ✅ 正确的metadata
```

### 错误3：REVERSE模式尝试读dummy byte

❌ **错误代码**:
```python
# REVERSE mode
client_sock, _ = server_socket.accept()
# 尝试读dummy byte - WRONG!
dummy = client_sock.recv(1)  # ❌ 会阻塞或读到metadata!
```

✅ **正确代码**:
```python
# REVERSE mode
client_sock, _ = server_socket.accept()
# 直接读metadata，不读dummy byte
metadata = client_sock.recv(64)  # ✅ 正确
```

---

## 新类库使用示例

### 方式1：使用工厂类

```python
from pycore.pyutils.device import TunnelModeFactory, TunnelConfig

config = TunnelConfig(
    device_serial="192.168.31.119:5555",
    scid_hex="1a2b3c4d",
    local_port=27183,
    device_socket_name="scrcpy_1a2b3c4d"
)

# 获取优先模式列表
modes = TunnelModeFactory.get_all_modes_by_priority()

for mode in modes:
    try:
        setup_tunnel(mode, config)
        print(f"✅ Using {mode.get_mode_name()} mode")
        break
    except Exception as e:
        print(f"❌ {mode.get_mode_name()} failed: {e}")
        continue
```

### 方式2：直接使用预定义实例

```python
from pycore.pyutils.device import REVERSE_MODE, FORWARD_MODE

# 尝试REVERSE
try:
    mode = REVERSE_MODE
    setup_tunnel(mode, config)
except:
    # Fallback to FORWARD
    mode = FORWARD_MODE
    setup_tunnel(mode, config)
```

### 方式3：按名称获取

```python
from pycore.pyutils.device import TunnelModeFactory

mode = TunnelModeFactory.get_mode_by_name("reverse")
if mode:
    setup_tunnel(mode, config)
```

---

## 多设备场景推荐

对于18台Android 7.0网络设备（如`192.168.31.119:5555`），推荐策略：

```python
from pycore.pyutils.device import TunnelModeFactory

# 1. 网络设备优先使用FORWARD（更可靠）
# 2. 如果FORWARD也失败，尝试REVERSE

# 但使用工厂类会自动处理fallback
modes = TunnelModeFactory.get_all_modes_by_priority()
for mode in modes:
    try:
        result = setup_tunnel_with_mode(mode)
        if result.success:
            break
    except:
        continue
```

**注意**：网络设备在Windows上REVERSE有已知bug，FORWARD更可靠。

---

## 参考资料

### 官方文档

- [Scrcpy Tunnels Documentation](https://github.com/Genymobile/scrcpy/blob/master/doc/tunnels.md)
- [Scrcpy Development Guide](https://github.com/Genymobile/scrcpy/blob/master/doc/develop.md)

### 源码

- `poly_apps/scrcpy/server/src/main/java/com/genymobile/scrcpy/device/DesktopConnection.java`
- `poly_apps/scrcpy/server/src/main/java/com/genymobile/scrcpy/Options.java`

### 项目实现

- `pycore/pyutils/device/tunnel_mode.py` - Tunnel模式抽象类库
- `pycore/pyutils/device/scrcpy_device.py` - ScrcpyDevice实现

---

**总结**：

1. ✅ **REVERSE优先**（默认，高效）
2. ✅ **FORWARD fallback**（兼容，可靠）
3. ✅ **自动fallback**（官方推荐策略）
4. ⚠️ **正确映射参数**（tunnel_forward=true for FORWARD）
5. ⚠️ **正确处理dummy byte**（FORWARD发送，REVERSE不发送）
