# Matrix多设备视频流系统 - 技术规范

> **版本**: 1.0
> **最后更新**: 2025-12-20
> **适用**: Android 5.0+ (重点：Android 7.0兼容性)

---

## 目录

1. [系统架构](#系统架构)
2. [官方scrcpy通信协议](#官方scrcpy通信协议)
3. [多设备并发连接](#多设备并发连接)
4. [Android 7.0兼容性](#android-70兼容性)
5. [实现规范](#实现规范)
6. [故障排查](#故障排查)

---

## 系统架构

### 整体架构

```
┌────────────────────────────────────────────────────────────┐
│                     Matrix System                          │
├────────────────────────────────────────────────────────────┤
│                                                            │
│   ┌──────────────┐         ┌──────────────┐              │
│   │  Frontend    │  HTTP   │   Backend    │              │
│   │   (Nuxt)     │◄───────►│  (FastAPI)   │              │
│   └──────────────┘         └───────┬──────┘              │
│                                    │                       │
│                            ┌───────▼─────────┐            │
│                            │  DeviceManager  │            │
│                            │  (Async Pool)   │            │
│                            └───────┬─────────┘            │
│                                    │                       │
│              ┌─────────────────────┼──────────────────┐   │
│              │                     │                  │   │
│         ┌────▼─────┐         ┌────▼─────┐     ┌─────▼───┐│
│         │ Device 1 │         │ Device 2 │ ... │Device 17││
│         │ (Scrcpy) │         │ (Scrcpy) │     │(Scrcpy) ││
│         └────┬─────┘         └────┬─────┘     └─────┬───┘│
│              │                    │                  │    │
└──────────────┼────────────────────┼──────────────────┼────┘
               │ ADB                │ ADB              │ ADB
               │                    │                  │
        ┌──────▼──────┐      ┌──────▼──────┐   ┌──────▼──────┐
        │  Android    │      │  Android    │   │  Android    │
        │  Device 1   │      │  Device 2   │   │  Device 17  │
        │ (SM-G9200)  │      │ (SM-G9200)  │   │ (SM-G9200)  │
        │ Android 7.0 │      │ Android 7.0 │   │ Android 7.0 │
        └─────────────┘      └─────────────┘   └─────────────┘
```

### 技术栈

| 层级 | 技术 | 说明 |
|-----|------|-----|
| **前端** | Nuxt 3 + WebSocket | 实时视频流显示 |
| **后端** | FastAPI + AsyncIO | 异步设备管理 |
| **设备通信** | scrcpy 3.3.3 | 官方协议实现 |
| **传输** | ADB + Socket | 本地socket隧道 |
| **视频编码** | H.264 (MediaCodec) | 硬件加速 |

---

## 官方scrcpy通信协议

### 三通道架构

**官方设计**（基于scrcpy 3.3.3源码）：

```
Client (PC)                          Server (Android Device)
┌─────────────┐                      ┌──────────────────┐
│             │  ① Video Socket      │                  │
│  Decoder    │◄─────────────────────│ MediaCodec       │
│  (H.264)    │    Raw H.264/H.265   │ Encoder          │
│             │                      │                  │
│             │  ② Audio Socket      │                  │
│  Audio      │◄─────────────────────│ AudioCapture     │
│  Player     │    OPUS Stream       │ (Android 11+)    │
│             │                      │                  │
│             │  ③ Control Socket    │                  │
│  Input      │◄────────────────────►│ Input            │
│  Controller │   (Bidirectional)    │ Injection        │
└─────────────┘                      └──────────────────┘
```

**关键特点**：
1. **三个独立socket** - 防止head-of-line blocking
2. **Video socket**: 单向，H.264/H.265编码帧
3. **Audio socket**: 单向，OPUS音频（可选）
4. **Control socket**: 双向，touch/key事件 + 设备消息

### Socket命名

**官方规范**（DesktopConnection.java）：
```java
private static String getSocketName(int scid) {
    if (scid == -1) {
        return "scrcpy";  // 默认
    }
    return String.format("scrcpy_%08x", scid);  // 带SCID
}
```

**SCID (Socket Connection ID)**：
- **用途**: 在同一设备上区分多个scrcpy实例
- **格式**: 32位整数，格式化为8位16进制
- **示例**: `scrcpy_a1b2c3d4`, `scrcpy_5e6f7890`

### 隧道模式

#### REVERSE模式（官方默认）

```bash
adb reverse localabstract:scrcpy_<SCID> tcp:27183
```

**特点**：
- PC监听，设备连接
- 无需dummy byte
- 性能更优

**限制**：
- ❌ Windows多设备bug：`adb.exe: error: more than one device/emulator`

#### FORWARD模式（fallback）

```bash
adb forward tcp:27183 localabstract:scrcpy_<SCID>
```

**特点**：
- 设备监听，PC连接
- 需要dummy byte检测连接
- **Windows多设备唯一选择**

**Dummy Byte机制**：
```python
# 连接后第一个操作
dummy = video_socket.recv(1)  # 必须是 b'\x00'

# 作用：检测设备端是否真正监听
# 如果设备端未启动，recv会超时或返回EOF
```

### 数据协议

#### 连接建立顺序

```python
# FORWARD模式标准流程
1. 启动服务器
   cmd: app_process ... scid=a1b2c3d4 tunnel_forward=true

2. 服务器监听socket
   localabstract:scrcpy_a1b2c3d4

3. PC建立forward
   adb forward tcp:27183 localabstract:scrcpy_a1b2c3d4

4. PC连接socket
   - video_socket = connect(27183)
   - control_socket = connect(27183)  # 相同abstract名称，按顺序accept

5. 读取dummy byte
   dummy = video_socket.recv(1)  # 0x00

6. 读取device metadata (64字节)
   device_name = video_socket.recv(64)  # UTF-8，null-terminated

7. 读取codec metadata (12字节)
   # 字节0-3: codec_id (0=H264, 1=H265, 2=AV1)
   # 字节4-7: width (big-endian)
   # 字节8-11: height (big-endian)

8. 视频流开始
   while True:
       packet = read_video_packet()
```

#### 视频包格式

```
每个H.264包：
┌─────────────┬──────────────────┐
│ Header (12B)│  Payload (可变)   │
└─────────────┴──────────────────┘

Header:
- 8字节: PTS (Presentation Timestamp, big-endian)
- 4字节: Packet size (big-endian)

Payload:
- H.264 NAL units (可能跨多个包)
```

---

## 多设备并发连接

### 官方架构（基于MCP查询scrcpy 3.3源码）

**核心原则**：**一个进程对应一个设备**

scrcpy官方设计：
- ❌ **不是**：一个进程管理多个设备（多线程）
- ✅ **是**：每个设备独立的scrcpy进程实例
- ✅ **是**：每个AndroidDevice对象独立管理一个设备

```bash
# 官方多设备连接方式
# Terminal 1
scrcpy -s 192.168.31.117:5555

# Terminal 2
scrcpy -s 192.168.31.119:5555

# Terminal 3
scrcpy -s 192.168.31.120:5555
```

### SCID（Socket Connection ID）隔离机制

**官方定义**（scrcpy源码）：
- **类型**：31位随机正整数
- **生成**：scrcpy自动生成（客户端）
- **作用**：防止同一设备上多个scrcpy实例的socket冲突
- **格式**：8位十六进制字符串

**Socket命名规则**：

```python
if scid == 0:
    socket_name = "localabstract:scrcpy"
else:
    socket_name = f"localabstract:scrcpy_{scid:08x}"

# 示例
scid = 305419896  # 十进制
socket_name = "localabstract:scrcpy_12345678"  # 8位十六进制
```

**我们的实现**：

```python
# 设备1
scid1 = random.randint(1, 0x7FFFFFFF)  # 31位正整数
socket_name1 = f"scrcpy_{scid1:08x}"   # 例如: scrcpy_a1b2c3d4

# 设备2
scid2 = random.randint(1, 0x7FFFFFFF)
socket_name2 = f"scrcpy_{scid2:08x}"   # 例如: scrcpy_5e6f7890

# 设备17
scid17 = random.randint(1, 0x7FFFFFFF)
socket_name17 = f"scrcpy_{scid17:08x}"  # 例如: scrcpy_1a2b3c4d
```

**隔离保证**：
- ✅ 每个设备使用唯一的SCID
- ✅ 不同socket名称 → 独立的localabstract地址空间
- ✅ 即使在同一物理设备上启动多个scrcpy，也不冲突
- ✅ 17台设备，每台一个AndroidDevice实例

### 端口管理策略

**官方端口范围**（scrcpy源码）：
- **默认起始端口**：27183
- **端口范围**：27183-27199（共17个端口）
- **自动选择**：scrcpy自动从范围中选择第一个可用端口

**我们的实现**（17台设备）：

```python
# 不需要手动分配端口！
# scrcpy会自动处理端口选择

# 每个AndroidDevice独立连接
devices = []
for serial in device_serials:
    scid = random.randint(1, 0x7FFFFFFF)

    device = AndroidDevice(
        serial=serial,
        scid=scid,
        # 端口由scrcpy自动选择，无需指定
        control_port=ports['control']
    )
    devices.append(device)
```

### 官方vs我们的实现对照

| 方面 | 官方scrcpy | 我们的实现 |
|------|-----------|----------|
| **进程模型** | 每设备一个独立进程 | 每设备一个`AndroidDevice`对象 |
| **并发方式** | 多进程（OS级别） | AsyncIO并发（Python级别） |
| **SCID生成** | 客户端自动生成31位随机数 | `random.randint(1, 0x7FFFFFFF)` |
| **Socket隔离** | SCID作为socket名称后缀 | 同官方，使用`scrcpy_{scid:08x}` |
| **端口分配** | 自动从27183-27199选择 | scrcpy自动处理 |
| **设备指定** | 命令行`-s`参数 | `AndroidDevice(serial=...)` |
| **视频接收** | 独立线程per设备 | `asyncio.create_task()`per设备 |

**关键等价性**：
```python
# 官方scrcpy（多进程）
subprocess.Popen(["scrcpy", "-s", "192.168.31.117:5555"])  # 进程1
subprocess.Popen(["scrcpy", "-s", "192.168.31.119:5555"])  # 进程2
subprocess.Popen(["scrcpy", "-s", "192.168.31.120:5555"])  # 进程3

# 我们的实现（AsyncIO对象）
device1 = AndroidDevice(serial="192.168.31.117:5555", scid=...)  # 对象1
device2 = AndroidDevice(serial="192.168.31.119:5555", scid=...)  # 对象2
device3 = AndroidDevice(serial="192.168.31.120:5555", scid=...)  # 对象3

# 等价的并发
await asyncio.gather(
    device1.connect(),
    device2.connect(),
    device3.connect()
)
```

### 并发启动流程

```python
async def start_all_devices():
    """并发启动所有设备（模拟官方多进程）"""

    # 1. 推送服务器文件（并发）
    push_tasks = [
        server_manager.push_jar_to_device(serial)
        for serial in serials
    ]
    await asyncio.gather(*push_tasks)

    # 2. 启动服务器进程（并发）
    # 每个AndroidDevice独立启动，类似多个scrcpy进程
    start_tasks = [
        device.start_server(tunnel_mode="forward")
        for device in devices
    ]
    await asyncio.gather(*start_tasks)

    # 3. 建立socket连接（并发）
    connect_tasks = [
        device.connect_sockets()
        for device in devices
    ]
    results = await asyncio.gather(*connect_tasks, return_exceptions=True)

    # 4. 启动视频流接收（并发）
    # 每个设备独立的异步任务，类似独立进程
    for device in devices:
        asyncio.create_task(device.receive_video_stream())

    return results
```

### Windows多设备限制

**问题**（官方FAQ确认）：
```bash
$ adb -s 192.168.31.117:5555 reverse localabstract:scrcpy tcp:27183
adb.exe: error: more than one device/emulator
```

**根因**：Windows ADB实现bug，`adb reverse`忽略`-s`参数

**解决方案**：
- ✅ 统一使用FORWARD模式
- ❌ 不要尝试修复REVERSE（ADB问题，非我们代码问题）

---

## Android 7.0兼容性

### 问题发现

**症状**：
```
[ScrcpyDevice] [DEBUG] Connection closed, server poll result: None
[ScrcpyDevice] [SERVER STDOUT]: (empty)
[ScrcpyDevice] [SERVER STDERR]: (empty)
```

**Logcat关键错误**：
```
ClassNotFoundException: Didn't find class "com.genymobile.scrcpy.Server"
on path: DexPathList[[],nativeLibraryDirectories=[/system/lib64, ...]]
```

**根本原因**：DexPathList为空 → CLASSPATH未加载

### 三个致命问题

#### 问题1：Git Bash路径翻译

**现象**：jar文件推送失败，无错误提示

```python
# 错误写法
["adb", "push", jar, "/data/local/tmp/scrcpy-server"]
# Git Bash翻译为：
["adb", "push", jar, "D:/Git/data/local/tmp/scrcpy-server"]

# 正确写法（双斜杠）
["adb", "push", jar, "//data/local/tmp/scrcpy-server"]
```

**修复文件**：
- `pycore/pyutils/device/scrcpy_server_manager.py:444`
- `pyapps/matrix/services/device_service.py:130`

#### 问题2：无效参数

**错误参数**（MCP文档验证）：
- ❌ `send_dummy_byte=true` - 不存在
- ❌ `send_device_meta=false` - 不支持

**正确参数**（官方文档）：
- ✅ `tunnel_forward=true` - 唯一需要的隧道参数
- ✅ dummy byte和device_meta自动发送

**修复**：删除无效参数（`scrcpy_device.py:818`）

#### 问题3：Android 7.0 CLASSPATH限制

**官方标准方式**（scrcpy develop.md）：
```bash
CLASSPATH=/data/local/tmp/scrcpy-server.jar app_process / com.genymobile.scrcpy.Server 3.3.3
```

**Android 7.0实际需求**：

| 要素 | 官方方式 | Android 7.0 |
|------|---------|------------|
| 工作目录 | 无需切换 | **`cd /data/local/tmp`** |
| CLASSPATH | 绝对路径 `/data/local/tmp/scrcpy-server.jar` | **相对路径 `scrcpy-server`** |
| app_process | root `/` | **当前目录 `.`** |
| 文件名 | 可用`.jar` | **无后缀 `scrcpy-server`** |

**正确命令**：
```bash
cd /data/local/tmp && CLASSPATH=scrcpy-server app_process . com.genymobile.scrcpy.Server 3.3.3 scid=a1b2c3d4 log_level=debug audio=false max_size=720 tunnel_forward=true
```

### 修复实现

```python
# pycore/pyutils/device/scrcpy_device.py
def _build_server_command(self, scid: int, tunnel_mode: str):
    """Android 7.0兼容的服务器启动命令"""

    cmd = [
        "cd", "/data/local/tmp", "&&",  # 切换目录
        "CLASSPATH=scrcpy-server",       # 相对路径，无.jar
        "app_process",
        ".",                              # 当前目录
        "com.genymobile.scrcpy.Server",
        "3.3.3",
        f"scid={scid:08x}",
        "log_level=debug",
        "audio=false",
        f"max_size={self.params.max_size}",
        f"max_fps={self.params.max_fps}",
        f"video_bit_rate={self.params.bit_rate}",
        f"video_codec={self.params.codec.value}",
    ]

    if tunnel_mode == "forward":
        cmd.append("tunnel_forward=true")  # 唯一隧道参数

    return cmd
```

### 兼容性验证

**测试矩阵**：

| Android版本 | 绝对路径 | 相对路径 | 结果 |
|-----------|---------|---------|-----|
| 7.0 | ❌ Aborted | ✅ Success | 必须相对路径 |
| 8.0+ | ✅ Success | ✅ Success | 两种都可 |

**结论**：统一使用相对路径，向后兼容 ✅

---

## 实现规范

### 文件结构

```
pycore/pyutils/device/
├── scrcpy_device.py          # 单设备管理
├── scrcpy_server_manager.py  # 服务器文件管理
└── adb_manager.py             # ADB命令队列

pyapps/matrix/services/
├── device_service.py          # 设备服务
└── video_stream_manager.py    # 视频流管理
```

### 代码规范

#### 1. SCID生成

```python
import random

def generate_scid() -> int:
    """
    生成随机SCID

    Returns:
        32位正整数，用于socket命名
    """
    return random.randint(0x00000000, 0xFFFFFFFF)
```

#### 2. 服务器启动

```python
class ScrcpyDevice:
    async def start_server(self, tunnel_mode: str = "forward"):
        """
        启动scrcpy服务器

        Args:
            tunnel_mode: "forward" (Windows多设备) 或 "reverse"
        """
        # 1. 构建命令（Android 7.0兼容）
        cmd = self._build_server_command(self.scid, tunnel_mode)

        # 2. 通过ADB启动
        shell_cmd = ' '.join(cmd)
        adb_cmd = [
            self.adb_path,
            "-s", self.serial,
            "shell", shell_cmd
        ]

        # 3. 启动进程（非阻塞）
        self._server_process = await asyncio.create_subprocess_exec(
            *adb_cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        # 4. 等待socket就绪
        await asyncio.sleep(1.0)
```

#### 3. Socket连接

```python
async def connect_sockets(self):
    """建立socket连接（FORWARD模式）"""

    # 1. 建立ADB forward
    await self._setup_forward(self.video_port, self.scid)
    await self._setup_forward(self.control_port, self.scid)

    # 2. 连接socket
    self._video_socket = socket.socket()
    self._control_socket = socket.socket()

    self._video_socket.connect(('127.0.0.1', self.video_port))
    self._control_socket.connect(('127.0.0.1', self.control_port))

    # 3. 读取dummy byte（FORWARD模式必须）
    dummy = self._video_socket.recv(1)
    if dummy != b'\x00':
        raise ConnectionError(f"Invalid dummy byte: {dummy.hex()}")

    # 4. 读取device metadata
    name_bytes = self._video_socket.recv(64)
    device_name = name_bytes.split(b'\x00')[0].decode('utf-8')

    # 5. 读取codec metadata
    codec_data = self._video_socket.recv(12)
    codec_id, width, height = struct.unpack('>III', codec_data)

    print(f"[ScrcpyDevice] Connected: {device_name} ({width}x{height})")
```

#### 4. 视频流接收

```python
async def receive_video_stream(self):
    """接收并处理视频流"""

    while self._running:
        try:
            # 1. 读取包头（12字节）
            header = await self._recv_exactly(12)
            pts, packet_size = struct.unpack('>QI', header)

            # 2. 读取payload
            payload = await self._recv_exactly(packet_size)

            # 3. 发送到前端
            await self._send_to_frontend({
                'type': 'video_packet',
                'device_id': self.serial,
                'pts': pts,
                'data': base64.b64encode(payload).decode()
            })

        except Exception as e:
            print(f"[ScrcpyDevice] Stream error: {e}")
            break
```

### 参数规范

**有效参数**（scrcpy 3.3.3官方）：

| 参数 | 类型 | 说明 | 默认值 |
|------|------|------|-------|
| `scid` | hex | Socket连接ID | 随机生成 |
| `log_level` | debug\|info\|warn | 日志级别 | info |
| `audio` | true\|false | 音频开关 | false（我们不用） |
| `max_size` | number | 最大分辨率 | 720 |
| `max_fps` | number | 最大帧率 | 60 |
| `video_bit_rate` | number | 视频比特率（bps） | 8000000 |
| `video_codec` | h264\|h265\|av1 | 视频编码 | h264 |
| `tunnel_forward` | true\|false | FORWARD模式 | true（我们用） |

**禁用参数**：
- ❌ `send_dummy_byte` - 不存在
- ❌ `send_device_meta` - 不支持

---

## 故障排查

### 问题1：所有设备连接失败，stderr空

**症状**：
```
[ScrcpyDevice] [SERVER STDERR]: (empty)
```

**排查步骤**：

1. **检查jar文件是否存在**
   ```bash
   adb -s <serial> shell "ls -la /data/local/tmp/scrcpy-server"
   ```
   - 如果不存在 → Git Bash路径翻译问题
   - 解决：使用双斜杠 `//data/local/tmp/`

2. **检查logcat**
   ```bash
   adb -s <serial> logcat -d -s "DEBUG:F" | grep "Abort message"
   ```
   - 看到 `ClassNotFoundException` + `DexPathList[[]]` → CLASSPATH未加载
   - 解决：使用相对路径方式

3. **手动测试服务器**
   ```bash
   adb shell "cd /data/local/tmp && CLASSPATH=scrcpy-server app_process . com.genymobile.scrcpy.Server 3.3.3 --help"
   ```
   - 应该输出帮助信息
   - 如果Aborted → Android 7.0问题

### 问题2：REVERSE模式失败

**症状**：
```
adb.exe: error: more than one device/emulator
```

**解决**：
- 不要用REVERSE模式
- 统一使用FORWARD模式

### 问题3：Dummy byte EOF

**症状**：
```
[ScrcpyDevice] Connection closed while reading dummy byte
```

**原因**：服务器未启动或已崩溃

**排查**：
1. 检查服务器进程是否运行
   ```bash
   adb shell "ps | grep app_process"
   ```

2. 检查服务器stdout/stderr
   ```python
   stdout, stderr = await self._server_process.communicate()
   print(f"STDOUT: {stdout}")
   print(f"STDERR: {stderr}")
   ```

3. 检查参数是否有效
   - 移除 `send_dummy_byte`、`send_device_meta`

### 问题4：设备间串流

**症状**：设备A显示设备B的画面

**原因**：SCID冲突或端口冲突

**排查**：
1. 检查SCID唯一性
   ```python
   scids = [device.scid for device in devices]
   assert len(scids) == len(set(scids))  # 无重复
   ```

2. 检查端口唯一性
   ```python
   ports = [device.video_port for device in devices]
   assert len(ports) == len(set(ports))  # 无重复
   ```

3. 检查socket名称
   ```bash
   adb shell "netstat -anp | grep scrcpy"
   # 每个设备应显示不同的scrcpy_XXXXXXXX
   ```

---

## 附录

### A. 测试命令

```bash
# 1. 验证jar推送
adb -s 192.168.31.117:5555 push scrcpy-server //data/local/tmp/scrcpy-server

# 2. 验证文件存在
adb -s 192.168.31.117:5555 shell "ls -la /data/local/tmp/scrcpy-server"

# 3. 验证MD5
adb -s 192.168.31.117:5555 shell "md5sum /data/local/tmp/scrcpy-server"

# 4. 手动启动服务器
adb -s 192.168.31.117:5555 shell "cd /data/local/tmp && CLASSPATH=scrcpy-server app_process . com.genymobile.scrcpy.Server 3.3.3 scid=12345678 log_level=debug audio=false max_size=720 tunnel_forward=true"

# 预期输出：
# [server] INFO: Device: [samsung] samsung SM-G9200 (Android 7.0)
```

### B. 成功日志示例

```
[DeviceManager] Starting 17 devices...

[ScrcpyServerManager] Skipping push for 192.168.31.117:5555 (jar exists)
[ScrcpyServerManager] ✓ jar on 192.168.31.117:5555 (hash: 3c0efc25)

[ScrcpyDevice] Shell command: cd /data/local/tmp && CLASSPATH=scrcpy-server app_process . com.genymobile.scrcpy.Server 3.3.3 scid=a1b2c3d4 log_level=debug audio=false max_size=720 max_fps=60 video_bit_rate=8000000 video_codec=h264 tunnel_forward=true

[ScrcpyDevice] [OK] Video socket connected (FORWARD)
[ScrcpyDevice] [OK] Control socket connected (FORWARD)
[ScrcpyDevice] [OK] Consumed dummy byte: 00
[ScrcpyDevice] Device name: SM-G9200
[ScrcpyDevice] [OK] Resolution: 1920x1080
[ScrcpyDevice] [OK] Server started successfully

... (重复16次，所有设备)

[DeviceManager] ✅ 17/17 devices connected
```

### C. 参考资料

**官方文档**：
- [scrcpy develop.md](https://github.com/genymobile/scrcpy/blob/master/doc/develop.md) - 核心协议
- [scrcpy FAQ.md](https://github.com/genymobile/scrcpy/blob/master/FAQ.md) - 多设备问题
- [scrcpy connection.md](https://github.com/genymobile/scrcpy/blob/master/doc/connection.md) - 连接方式

**源码参考**：
- `server/src/main/java/com/genymobile/scrcpy/DesktopConnection.java` - Socket管理
- `server/src/main/java/com/genymobile/scrcpy/Options.java` - 参数解析

**验证工具**：
- MCP Context7 - 官方文档查询
- logcat - Android运行时日志
- Wireshark - 网络包分析（可选）

---

**文档版本历史**：
- v1.0 (2025-12-20): 初始版本，整合多设备+Android 7.0方案
