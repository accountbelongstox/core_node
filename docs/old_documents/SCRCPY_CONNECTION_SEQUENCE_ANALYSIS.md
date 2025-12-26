# Scrcpy FORWARD 模式连接顺序分析

## 源码：DesktopConnection.java (line 64-90)

```java
if (tunnelForward) {  // tunnel_forward=true
    try (LocalServerSocket localServerSocket = new LocalServerSocket(socketName)) {
        if (video) {
            videoSocket = localServerSocket.accept();  // 1️⃣ 等待第一个连接
            if (sendDummyByte) {
                videoSocket.getOutputStream().write(0);  // 2️⃣ 发送 dummy byte
                sendDummyByte = false;
            }
        }
        if (audio) {
            audioSocket = localServerSocket.accept();  // 3️⃣ 等待第二个连接
            if (sendDummyByte) {
                audioSocket.getOutputStream().write(0);
                sendDummyByte = false;
            }
        }
        if (control) {
            controlSocket = localServerSocket.accept();  // 4️⃣ 等待第三个连接
            if (sendDummyByte) {
                controlSocket.getOutputStream().write(0);
                sendDummyByte = false;
            }
        }
    }  // 5️⃣ LocalServerSocket 关闭
}
```

## 关键发现

### 1. 服务器使用**单个** LocalServerSocket
- 所有连接（video, audio, control）都通过**同一个** abstract socket
- 服务器按顺序 `accept()` 多个连接

### 2. Try-with-resources 块
```java
try (LocalServerSocket localServerSocket = ...) {
    // accept all sockets
}  // ← LocalServerSocket 在这里关闭
```
- 当所有 socket accept 完成后，`LocalServerSocket` 关闭
- 但**已建立的连接不受影响**

### 3. Dummy byte 发送时机
- 在**第一个** socket accept 后**立即**发送
- 使用 `sendDummyByte` 标志确保只发送一次
- 后续 socket 不再发送 dummy byte

## 正确的客户端连接流程

### 配置：video=true, audio=false, control=true

```
步骤 1: PC 连接 video socket
       ↓
步骤 2: 服务器 accept video socket
       ↓
步骤 3: 服务器发送 dummy byte (0x00)
       ↓
步骤 4: 【PC 必须立即读取 dummy byte】
       ↓
步骤 5: PC 连接 control socket (跳过 audio)
       ↓
步骤 6: 服务器 accept control socket
       ↓
步骤 7: LocalServerSocket 关闭 (但连接保持)
       ↓
步骤 8: 服务器发送 device metadata (64 bytes) 到 video socket
       ↓
步骤 9: PC 读取 device metadata
```

## 错误流程（导致失败）

```
步骤 1: PC 连接 video socket ✓
步骤 2: 服务器 accept video socket ✓
步骤 3: 服务器发送 dummy byte ✓
步骤 4: ❌ PC 没有读取 dummy byte！
步骤 5: PC 连接 control socket ✓
步骤 6: 服务器 accept control socket ✓
步骤 7: LocalServerSocket 关闭
步骤 8: ❌ 服务器尝试发送 metadata，但 socket 缓冲区可能有问题
步骤 9: ❌ PC 尝试读取 metadata → Connection closed
```

## 为什么必须读取 dummy byte？

1. **流量同步**：dummy byte 必须从 socket 读出，否则后续数据读取会错位
2. **缓冲区管理**：如果不读取，metadata 可能被阻塞在缓冲区
3. **协议约定**：官方协议要求客户端读取 dummy byte

## 测试验证

使用 `debug_server_startup.py` 验证：
1. 连接 video socket
2. **立即读取 dummy byte**
3. 连接 control socket
4. 读取 metadata

应该能成功！
