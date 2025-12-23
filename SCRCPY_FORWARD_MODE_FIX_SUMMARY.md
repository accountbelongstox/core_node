# Scrcpy FORWARD 模式连接问题 - 完整分析与解决方案

## 问题现象

在 FORWARD 模式下启动 scrcpy-server 时，连接总是失败并报错：
```
Connection closed while reading dummy byte from first socket (FORWARD mode)
```

## 根本原因

通过分析 scrcpy 官方源码 (`poly_apps/scrcpy/server`) 发现：

### 1. SCID 参数格式错误（主要问题）

**源码位置**：`Options.java` 第 315 行

```java
int scid = Integer.parseInt(value, 0x10);  // 0x10 = 16 (十六进制基数)
```

**问题**：
- 服务器期望接收**十六进制字符串**（如 "1a2b3c4d"）
- 我们之前传递的是**十进制数字**（如 "1038041919"）
- 导致 `NumberFormatException`，服务器启动失败

**错误日志**：
```
[server] ERROR: For input string: "1038041919"
java.lang.NumberFormatException: For input string: "1038041919"
at java.lang.Integer.parseInt(Integer.java)
at com.genymobile.scrcpy.Options.parse(Options.java:315)
```

### 2. FORWARD 模式连接顺序（次要问题）

**源码位置**：`DesktopConnection.java` 第 64-90 行

```java
if (tunnelForward) {
    try (LocalServerSocket localServerSocket = new LocalServerSocket(socketName)) {
        if (video) {
            videoSocket = localServerSocket.accept();
            if (sendDummyByte) {
                videoSocket.getOutputStream().write(0);  // 立即发送 dummy byte
                sendDummyByte = false;
            }
        }
        if (audio) {
            audioSocket = localServerSocket.accept();
            // ...
        }
        if (control) {
            controlSocket = localServerSocket.accept();  // 等待 control socket
            // ...
        }
    }
}
```

**关键点**：
- 服务器在 FORWARD 模式下创建 `LocalServerSocket` 监听连接
- 按顺序 `accept()`：video → audio → control
- Dummy byte 在 **第一个 socket accept 后立即发送**
- 服务器会等待所有启用的 socket 连接完成

## 解决方案

### 修改 1：使用十六进制 SCID 字符串

**文件**：`pycore/pyutils/device/scrcpy_device.py`

**修改前**：
```python
scid = random.randint(0, 0x7FFFFFFF)
device_socket_name = f"scrcpy_{scid:08x}"
server_cmd = [..., f"scid={scid}", ...]  # 错误：传递十进制数字
```

**修改后**：
```python
scid = random.randint(0, 0x7FFFFFFF)
scid_hex = f"{scid:08x}"  # 生成十六进制字符串
device_socket_name = f"scrcpy_{scid_hex}"
server_cmd = [..., f"scid={scid_hex}", ...]  # 正确：传递十六进制字符串
```

### 修改 2：更新方法签名

**文件**：`pycore/pyutils/device/scrcpy_device.py`

```python
def _build_server_command(self, scid_hex: str, tunnel_mode: str) -> list:
    """
    Args:
        scid_hex: Session ID in 8-digit hex format (e.g., "1a2b3c4d")
        tunnel_mode: "reverse" or "forward"
    """
    cmd = [
        # ...
        f"scid={scid_hex}",  # CRITICAL: Must be HEX string!
        # ...
    ]
```

## Android 7.0 兼容性要点

从源码分析，Android 7.0 需要注意以下几点：

1. **CLASSPATH 必须是相对路径**：
   ```bash
   cd /data/local/tmp && CLASSPATH=scrcpy-server app_process . ...
   # 不能是 CLASSPATH=/data/local/tmp/scrcpy-server
   ```

2. **文件名不能带 .jar 扩展名**：
   - 推送时：`adb push scrcpy-server.jar /data/local/tmp/scrcpy-server`
   - CLASSPATH：`scrcpy-server`（不是 `scrcpy-server.jar`）

3. **SCID 格式**：
   - 必须是 8 位十六进制字符串（如 `"1a2b3c4d"`）
   - 服务器用 `Integer.parseInt(value, 0x10)` 解析

4. **参数顺序和格式**（scrcpy 3.3.3）：
   ```bash
   app_process . com.genymobile.scrcpy.Server 3.3.3 \
     scid=<hex_string> \
     log_level=debug \
     audio=false \
     max_size=720 \
     max_fps=60 \
     video_bit_rate=8000000 \
     video_codec=h264 \
     tunnel_forward=true
   ```

## OTG 模式和 Root 模式

### OTG 模式（USB On-The-Go）

OTG 模式主要用于无屏幕控制（如将手机作为键盘/鼠标控制设备）：
- 不涉及视频流传输
- 不需要 scrcpy-server
- 使用 HID (Human Interface Device) 协议
- 与本次修复无关

### Root 模式

Root 权限主要影响：
1. **屏幕录制权限**（Android 10+）
2. **音频捕获权限**（Android 11+）
3. **系统级控制**

但对于 **Android 7.0**：
- 不需要 root 即可使用 scrcpy
- 本次修复的 SCID 格式问题与 root 无关
- root 不会改变 scrcpy-server 的参数解析逻辑

## 重要发现：tunnel_forward 参数的反直觉命名

### 源码逻辑（DesktopConnection.java:64-101）

```java
if (tunnelForward) {
    // 服务器创建 LocalServerSocket 并等待连接
    LocalServerSocket localServerSocket = new LocalServerSocket(socketName);
    videoSocket = localServerSocket.accept();
    // ...
} else {
    // 服务器作为客户端主动连接
    videoSocket = connect(socketName);
    // ...
}
```

### 正确的参数含义

| tunnel_forward | 服务器行为 | ADB 隧道模式 | PC 行为 | 设备行为 |
|----------------|------------|--------------|---------|----------|
| `true` | LocalServerSocket.accept() **等待** | `adb forward` | 连接到本地端口 | 监听抽象 socket |
| `false` | LocalSocket.connect() **主动连接** | `adb reverse` | 监听本地端口 | 连接到 PC |

### 为什么命名反直觉？

- FORWARD 模式应该用 `tunnel_forward=true`（服务器**等待**）
- REVERSE 模式应该用 `tunnel_forward=false`（服务器**主动连接**）

这个命名看起来与模式名称相反，但实际上：
- `tunnel_forward` 描述的是"隧道是否采用 forward 方式"
- Forward 隧道：PC 通过 `adb forward` 转发端口到设备，设备监听
- Reverse 隧道：设备通过 `adb reverse` 转发到 PC，PC 监听

## 验证测试

### 测试脚本

创建了以下诊断脚本：
- `debug_server_startup.py`：完整的连接测试（包括 dummy byte 和元数据读取）
- `debug_server_simple.py`：简单的服务器启动测试（捕获 stderr）

### 成功输出

修复后的成功输出：
```
SCID: 46c2fd70 (hex string), 1187183984 (decimal value)
Starting scrcpy-server...

[STDOUT] [server] INFO: Device: [samsung] samsung SM-G9200 (Android 7.0)
```

## 总结

### 问题根源
SCID 参数格式错误（十进制 vs 十六进制）导致服务器启动失败，连接从未建立。

### 解决方法
将 SCID 从十进制数字改为 8 位十六进制字符串传递给 scrcpy-server。

### 经验教训
1. **查看源码是解决问题的最佳途径**
2. **参数格式必须严格匹配服务器期望**
3. **错误日志要完整捕获**（包括 stderr）
4. **分步调试**（从简单测试开始）

## 相关文件

修改的文件：
- `pycore/pyutils/device/scrcpy_device.py`

诊断脚本：
- `debug_server_startup.py`
- `debug_server_simple.py`

源码参考：
- `poly_apps/scrcpy/server/src/main/java/com/genymobile/scrcpy/Options.java`
- `poly_apps/scrcpy/server/src/main/java/com/genymobile/scrcpy/device/DesktopConnection.java`
- `poly_apps/scrcpy/server/src/main/java/com/genymobile/scrcpy/Server.java`
