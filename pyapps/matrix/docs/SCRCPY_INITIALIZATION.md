# Matrix - Scrcpy 初始化流程文档

## 概述

Matrix 使用 scrcpy-server 实现 Android 设备的视频流传输和控制。本文档详细说明 scrcpy 的初始化过程和命令构建逻辑。

---

## 架构层次

```
matrix_main.py (入口)
    ↓
DeviceManager (设备管理器)
    ↓
ScrcpyDevice (scrcpy 设备实现)
    ↓
scrcpy-server.jar (运行在 Android 设备上)
```

---

## 1. 配置层 (Config)

**文件**: `pyapps/matrix/matrix_config/config.py`

### 关键配置

```python
# scrcpy-server JAR 文件位置
SCRCPY_SERVER_JAR = RESOURCES_DIR / "scrcpy-server.jar"
SCRCPY_SERVER_VERSION = "3.3.3"

# ADB 路径获取（优先级）
# 1. 本地 resources/adb/{platform}/adb
# 2. 系统 PATH 中的 adb
# 3. 回退到 "adb"

# 默认参数
DEFAULT_MAX_SIZE = 720          # 最大分辨率（短边）
DEFAULT_BIT_RATE = 8000000      # 8 Mbps
DEFAULT_MAX_FPS = 60            # 最大帧率
DEFAULT_CODEC = "h264"          # 视频编码
```

---

## 2. DeviceManager 初始化流程

**文件**: `pycore/pyutils/device_manager.py`

### 2.1 连接设备 (`connect_device`)

```python
async def connect_device(self, serial: str, params: Optional[ServerParams] = None):
    """连接设备的完整流程"""

    # 1. 检查设备是否已连接
    if serial in self.devices:
        return self.devices[serial]

    # 2. 获取 ADB 路径
    adb_path = Config.get_adb_path()

    # 3. 获取设备信息（通过 ADB）
    info = ADBManager.get_device_info(serial, adb_path)

    # 4. 准备服务器参数
    if params is None:
        params = ServerParams(
            max_size=Config.DEFAULT_MAX_SIZE,
            bit_rate=Config.DEFAULT_BIT_RATE,
            max_fps=Config.DEFAULT_MAX_FPS,
            codec=VideoCodec(Config.DEFAULT_CODEC),
            control=True,
            locked_video_orientation=-1  # -1 = 自动
        )

    # 5. 创建 ScrcpyDevice 实例
    device = ScrcpyDevice(serial, params, adb_path)

    # 6. 启动 scrcpy-server（关键步骤）
    await asyncio.to_thread(device.start_server)

    # 7. 验证连接
    if not device.is_connected():
        raise RuntimeError("scrcpy-server started but sockets not connected")

    # 8. 存储设备
    self.devices[serial] = device

    return device
```

---

## 3. ScrcpyDevice 启动流程

**文件**: `pycore/pyutils/device/scrcpy_device.py`

### 3.1 start_server() 完整流程

```python
def start_server(self) -> int:
    """启动 scrcpy-server 的完整流程"""

    # 步骤 1: 生成随机 SCID (Session ID)
    scid = random.randint(0, 0x7FFFFFFF)  # 31-bit 随机数

    # 步骤 2: 找到空闲端口
    tunnel_port = self._find_free_port()

    # 步骤 3: 设置 REVERSE 隧道
    # adb reverse localabstract:scrcpy_<SCID> tcp:<PORT>
    abstract_addr = f"scrcpy_{scid:08x}"
    self._setup_reverse_tunnel(tunnel_port, abstract_addr)

    # 步骤 4: 创建监听 socket (在启动 server 之前)
    listen_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    listen_socket.bind(('127.0.0.1', tunnel_port))
    listen_socket.listen(2)  # video + control
    listen_socket.settimeout(30.0)

    # 步骤 5: 构建 scrcpy-server 命令
    server_cmd = self._build_server_command(scid)

    # 步骤 6: 通过 ADB 启动 server 进程
    adb_cmd = [
        self.adb_path,
        "-s", self.serial,
        "shell",
        *server_cmd
    ]
    self._server_process = subprocess.Popen(adb_cmd, ...)

    # 步骤 7: 接受设备连接
    # 7.1 接受视频 socket
    self._video_socket, _ = listen_socket.accept()

    # 7.2 接受控制 socket（如果启用）
    if self.params.control:
        self._control_socket, _ = listen_socket.accept()

    listen_socket.close()

    # 步骤 8: 读取设备元数据
    self._read_device_metadata()  # 64 bytes: 设备名称

    # 步骤 9: 读取视频编解码器元数据
    self._read_video_codec_metadata()  # 12 bytes: codec_id + width + height

    # 步骤 10: 切换到阻塞模式
    self._video_socket.settimeout(None)
    self._control_socket.settimeout(None)

    return tunnel_port
```

### 3.2 _build_server_command() - 命令构建

**这是获取 scrcpy 命令的核心方法！**

```python
def _build_server_command(self, scid: int) -> list:
    """
    构建 scrcpy-server shell 命令 (v3.3.3)

    返回的命令列表会被传递给 adb shell
    """

    cmd = [
        "CLASSPATH=/data/local/tmp/scrcpy-server.jar",
        "app_process",
        "/",
        "com.genymobile.scrcpy.Server",
        "3.3.3",  # 版本号 - 必须与 scrcpy-server.jar 匹配
        f"scid={scid:08x}",
        "log_level=debug",
        "audio=false",  # 当前禁用音频流
        f"max_size={self.params.max_size}",
        f"max_fps={self.params.max_fps}",
    ]

    # 可选参数
    if self.params.bit_rate:
        cmd.append(f"video_bit_rate={self.params.bit_rate}")

    if self.params.codec:
        cmd.append(f"video_codec={self.params.codec.value}")

    if not self.params.control:
        cmd.append("control=false")

    if self.params.locked_video_orientation != -1:
        cmd.append(f"locked_video_orientation={self.params.locked_video_orientation}")

    return cmd
```

### 3.3 实际执行的完整 ADB 命令示例

```bash
adb -s <SERIAL> shell \
    CLASSPATH=/data/local/tmp/scrcpy-server.jar \
    app_process / com.genymobile.scrcpy.Server \
    3.3.3 \
    scid=1a2b3c4d \
    log_level=debug \
    audio=false \
    max_size=720 \
    max_fps=60 \
    video_bit_rate=8000000 \
    video_codec=h264
```

---

## 4. 隧道模式说明

### REVERSE 模式（默认，推荐）

```
PC 监听端口 ← 设备连接到 PC
adb reverse localabstract:scrcpy_<SCID> tcp:<PORT>

优点：
- 更可靠
- 无需轮询
- 不发送 dummy byte
```

### FORWARD 模式（回退）

```
设备监听抽象 socket ← PC 连接到设备
adb forward tcp:<PORT> localabstract:scrcpy_<SCID>

特点：
- 需要轮询等待 server 准备好
- 发送 dummy byte 检测连接错误
```

---

## 5. 关键参数说明

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `scid` | hex | 随机 | Session ID (31-bit 随机数) |
| `max_size` | int | 720 | 最大分辨率（短边，像素） |
| `max_fps` | int | 60 | 最大帧率 |
| `video_bit_rate` | int | 8000000 | 视频比特率（8 Mbps） |
| `video_codec` | string | "h264" | 视频编解码器 (h264/h265/av1) |
| `log_level` | string | "debug" | 日志级别 |
| `audio` | bool | false | 音频流（当前禁用） |
| `control` | bool | true | 控制功能 |
| `locked_video_orientation` | int | -1 | 锁定视频方向 (-1=自动) |

---

## 6. 获取命令的方法

### 方法 1: 查看代码

```python
from pycore.pyutils.device.scrcpy_device import ScrcpyDevice
from pycore.pyutils.device.server_params import ServerParams, VideoCodec

# 创建参数
params = ServerParams(
    max_size=720,
    bit_rate=8000000,
    max_fps=60,
    codec=VideoCodec.H264,
    control=True
)

# 创建设备实例
device = ScrcpyDevice("DEVICE_SERIAL", params, "adb")

# 生成命令（模拟）
scid = 0x1a2b3c4d  # 示例 SCID
cmd = device._build_server_command(scid)
print(' '.join(cmd))
```

### 方法 2: 查看日志

启动 Matrix 应用时，DeviceManager 会输出完整命令：

```
[ScrcpyDevice] Command: adb -s <SERIAL> shell CLASSPATH=/data/local/tmp/scrcpy-server.jar app_process / com.genymobile.scrcpy.Server 3.3.3 scid=... ...
```

### 方法 3: 直接调用

```python
from pyapps.matrix.matrix_config import Config
from pycore.pyutils.device_manager import DeviceManager

# 获取 DeviceManager 实例
manager = DeviceManager.instance()

# 连接设备（会自动打印命令）
device = await manager.connect_device("DEVICE_SERIAL")

# 或者手动获取设备后查看参数
device = manager.get_device("DEVICE_SERIAL")
print(f"Max size: {device.params.max_size}")
print(f"Bit rate: {device.params.bit_rate}")
print(f"Max FPS: {device.params.max_fps}")
```

---

## 7. 调试技巧

### 7.1 查看 scrcpy-server 日志

```bash
# 查看设备上的 scrcpy-server 日志
adb -s <SERIAL> logcat | grep scrcpy
```

### 7.2 验证 JAR 文件

```bash
# 检查 scrcpy-server.jar 是否已推送到设备
adb -s <SERIAL> shell ls -l /data/local/tmp/scrcpy-server.jar
```

### 7.3 手动测试命令

```bash
# 手动执行 scrcpy-server 命令
adb -s <SERIAL> shell CLASSPATH=/data/local/tmp/scrcpy-server.jar app_process / com.genymobile.scrcpy.Server 3.3.3 scid=12345678 log_level=debug audio=false max_size=720 max_fps=60
```

---

## 8. 常见问题

### Q1: scrcpy-server 启动失败

**可能原因:**
1. `scrcpy-server.jar` 未推送到 `/data/local/tmp/`
2. ADB 连接不稳定
3. 设备权限问题

**解决方法:**
```bash
# 重新推送 JAR 文件
adb -s <SERIAL> push resources/scrcpy-server.jar /data/local/tmp/
```

### Q2: Socket 连接超时

**可能原因:**
1. 端口被占用
2. 防火墙阻止连接
3. REVERSE 隧道未正确设置

**解决方法:**
```bash
# 检查 REVERSE 隧道
adb -s <SERIAL> reverse --list

# 清理所有 REVERSE 隧道
adb -s <SERIAL> reverse --remove-all
```

### Q3: 视频分辨率不符合预期

**原因:**
- `max_size` 参数限制了短边分辨率
- 设备实际分辨率可能更低

**查看实际分辨率:**
```python
device = manager.get_device("SERIAL")
print(f"Resolution: {device.info.resolution.width}x{device.info.resolution.height}")
```

---

## 9. 参考资料

- scrcpy 官方文档: https://github.com/Genymobile/scrcpy
- scrcpy develop.md: https://github.com/Genymobile/scrcpy/blob/master/doc/develop.md
- Matrix 实现: `pycore/pyutils/device/scrcpy_device.py`
- 参数配置: `pyapps/matrix/matrix_config/config.py`

---

**文档版本**: 1.0
**更新日期**: 2025-12-08
**scrcpy-server 版本**: 3.3.3
