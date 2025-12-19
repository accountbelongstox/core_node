# Matrix 视频问题分析

**日期**: 2025-12-19
**问题**: 大量设备连接失败、重连、waiting for keyframe

---

## 📋 核心问题（从日志分析）

### 问题1: Device not in DeviceManager

```
[VideoStreamHealth] Checking 9 active devices...
[VideoStreamHealth] Device 192.168.31.117:5555 not in DeviceManager
[VideoStreamHealth] Device 192.168.31.135:5555 not in DeviceManager
[VideoStreamHealth] Device 192.168.31.136:5555 not in DeviceManager
... (8个设备)
```

**现象**：
- VideoStreamHealth认为设备是active的
- 但DeviceManager里找不到这些设备

**可能原因**：
1. VideoStreamService创建了ScrcpyDevice但没有注册到DeviceManager
2. 设备连接失败后从DeviceManager移除，但VideoStreamHealth没有同步

### 问题2: 连接被拒绝 (Connection Refused)

```
[VideoStreamService] Failed to start device: Failed to connect to device after 50 retries:
[WinError 10061] 由于目标计算机积极拒绝，无法连接。

File "D:\programing\core_node\pycore\pyutils\device\scrcpy_device.py", line 316
    self._video_socket.connect(('localhost', video_port))
ConnectionRefusedError: [WinError 10061]
```

**现象**：
- scrcpy-server启动后
- Python客户端尝试连接localhost的video_port
- 连接被拒绝，重试50次失败

**可能原因**：
1. scrcpy-server进程启动失败
2. scrcpy-server端口监听失败
3. 端口冲突
4. ADB tunnel没有建立成功

### 问题3: 大量设备waiting for keyframe

```
[SmartDrop YUV] 192.168.31.117:5555: 1 clients waiting for keyframe
[SmartDrop YUV] 192.168.31.132:5555: 1 clients waiting for keyframe
... (持续输出)
```

**现象**：
- 客户端连接成功
- 但一直等待keyframe
- 视频无法开始显示

**可能原因**：
1. scrcpy-server没有发送I帧
2. RESET_VIDEO消息没有发送/失败
3. 视频流已断开但客户端不知道

### 问题4: 设备断开重连

```
[VideoStreamService] Failed to send YUV frame to client:
[VideoStreamService] YUV streaming loop ended for 192.168.31.119:5555
[VideoDecoder] Decoder closed for 192.168.31.119:5555
```

**现象**：
- 正在工作的设备突然断开
- 发送失败导致流结束

---

## 🔍 深入分析

让我查看代码中的关键点...
