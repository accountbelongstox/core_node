# pyMatrix - pycore 模块实现清单

> **目标**：提供 pycore 核心库中 pyMatrix 相关模块的完整实现参考
>
> **基于**：`08_CORE_LIBRARY_ARCHITECTURE.md` 的架构设计

**日期**：2025-11-12
**版本**：2.0（统一架构）

---

## 📋 目录

1. [模块概览](#模块概览)
2. [pyadb - ADB 通信](#pyadb---adb-通信)
3. [pystream - 视频流处理](#pystream---视频流处理)
4. [pydevice - 设备抽象](#pydevice---设备抽象)
5. [pycontrol - 控制协议](#pycontrol---控制协议)
6. [pygroup - 群控算法](#pygroup---群控算法)
7. [pyapi - FastAPI 工具](#pyapi---fastapi-工具)

---

## 📦 模块概览

### pycore 统一模块结构

```
D:\programing\core_node\pycore\
├── pyfoundations/
│   └── device/              # 设备抽象（核心）✅ 已实现
├── pyutils/
│   ├── adb/                 # ADB 通信（统一）✅ 已实现
│   ├── device/              # 设备工具（便捷导出）✅ 已实现
│   ├── video_stream/        # 视频流处理 ✅ 已实现
│   ├── control/             # 控制协议 ✅ 已实现
│   ├── group/               # 群控算法 ✅ 已实现
│   └── api/                 # FastAPI 工具 ✅ 已实现
└── pygvar/                  # 全局变量（已有）
```

### 实现状态

| 模块 | 位置 | 状态 | 说明 |
|------|------|------|------|
| **adb** | `pycore.pyutils.device` | ✅ 已实现 | ADB 通信，所有功能已完成 |
| **device** | `pycore.pyutils.device` | ✅ 已实现 | 设备抽象，核心数据结构 |
| **video_stream** | `pycore.pyutils.video_stream` | ✅ 已实现 | 视频流处理 |
| **control** | `pycore.pyutils.control` | ✅ 已实现 | 设备控制功能 |
| **group** | `pycore.pyutils.group` | ✅ 已实现 | 群控高级功能 |
| **api** | `pycore.pyutils.api` | ✅ 已实现 | Web API 工具 |

---

## 🔧 pyutils.device - ADB 通信

### 模块结构

```
pycore/pyutils/adb/
├── __init__.py
├── adb_manager.py          # ADB 管理器（主要类）
├── adb_device.py           # 设备信息数据类
├── adb_types.py            # 类型定义
├── adb_commands.py         # 命令封装
└── adb_exceptions.py       # 异常定义
```

---

### __init__.py

```python
"""
pyutils.device - ADB 通信模块（统一）

功能：
- ADB 设备管理
- 文件推送/拉取
- Shell 命令执行
- 端口转发
- 增强类型定义

依赖：
- 标准库：subprocess, pathlib, typing
- 外部工具：adb（需在 PATH 或指定路径）

迁移说明：
- 旧路径：pycore.pyadb (已删除)
- 新路径：pycore.pyutils.device
"""

from .adb_manager import ADBManager
from .adb_device import ADBDevice, DeviceState
from .adb_exceptions import ADBException, DeviceNotFoundException

__all__ = [
    'ADBManager',
    'ADBDevice',
    'DeviceState',
    'ADBException',
    'DeviceNotFoundException'
]
```

---

### adb_device.py

```python
"""ADB 设备信息数据类"""

from dataclasses import dataclass
from enum import Enum
from typing import Optional

class DeviceState(Enum):
    """设备状态枚举"""
    DEVICE = "device"           # 设备正常连接
    OFFLINE = "offline"         # 设备离线
    UNAUTHORIZED = "unauthorized"  # 未授权
    UNKNOWN = "unknown"         # 未知状态

@dataclass
class ADBDevice:
    """ADB 设备信息"""
    serial: str                 # 设备序列号（唯一标识）
    state: DeviceState          # 设备状态
    model: Optional[str] = None # 设备型号（需额外查询）
    product: Optional[str] = None  # 产品名称

    @property
    def is_available(self) -> bool:
        """是否可用（已授权且在线）"""
        return self.state == DeviceState.DEVICE

    def __repr__(self) -> str:
        return f"ADBDevice(serial='{self.serial}', state={self.state.value}, model='{self.model}')"
```

---

### adb_exceptions.py

```python
"""ADB 相关异常定义"""

class ADBException(Exception):
    """ADB 操作基础异常"""
    pass

class DeviceNotFoundException(ADBException):
    """设备未找到异常"""
    def __init__(self, serial: str):
        super().__init__(f"Device not found: {serial}")
        self.serial = serial

class ADBCommandFailedException(ADBException):
    """ADB 命令执行失败异常"""
    def __init__(self, command: str, return_code: int, stderr: str):
        super().__init__(
            f"ADB command failed: {command}\n"
            f"Return code: {return_code}\n"
            f"Error: {stderr}"
        )
        self.command = command
        self.return_code = return_code
        self.stderr = stderr
```

---

### adb_manager.py（核心）

```python
"""ADB 管理器 - 无状态工具类"""

import subprocess
import re
from pathlib import Path
from typing import List, Optional
from .adb_device import ADBDevice, DeviceState
from .adb_exceptions import (
    ADBException,
    DeviceNotFoundException,
    ADBCommandFailedException
)

class ADBManager:
    """
    ADB 管理器（无状态，纯静态方法）

    设计原则：
    1. 不保存状态，每次调用都是独立的
    2. adb 路径通过参数传递（默认使用 PATH 中的 adb）
    3. 所有方法都是类方法或静态方法
    """

    @staticmethod
    def _run_command(
        command: List[str],
        check: bool = True,
        timeout: Optional[int] = None
    ) -> subprocess.CompletedProcess:
        """
        执行 ADB 命令

        Args:
            command: 命令列表，如 ['adb', 'devices']
            check: 是否检查返回码
            timeout: 超时时间（秒）

        Returns:
            subprocess.CompletedProcess

        Raises:
            ADBCommandFailedException: 命令执行失败
        """
        try:
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                check=False,
                timeout=timeout
            )

            if check and result.returncode != 0:
                raise ADBCommandFailedException(
                    command=' '.join(command),
                    return_code=result.returncode,
                    stderr=result.stderr
                )

            return result

        except subprocess.TimeoutExpired as e:
            raise ADBException(f"Command timeout: {' '.join(command)}") from e

    @classmethod
    def list_devices(cls, adb_path: str = "adb") -> List[ADBDevice]:
        """
        列出所有 ADB 设备

        Args:
            adb_path: adb 可执行文件路径

        Returns:
            设备列表

        示例输出（adb devices）：
            List of devices attached
            ABC123DEF456    device
            XYZ789GHI012    offline
        """
        result = cls._run_command([adb_path, "devices"])
        return cls._parse_devices(result.stdout)

    @staticmethod
    def _parse_devices(output: str) -> List[ADBDevice]:
        """解析 adb devices 输出"""
        devices = []
        lines = output.strip().split('\n')

        for line in lines[1:]:  # 跳过第一行 "List of devices attached"
            line = line.strip()
            if not line:
                continue

            # 格式：serial\tstate
            match = re.match(r'^(\S+)\s+(\S+)$', line)
            if match:
                serial, state_str = match.groups()
                try:
                    state = DeviceState(state_str)
                except ValueError:
                    state = DeviceState.UNKNOWN

                devices.append(ADBDevice(serial=serial, state=state))

        return devices

    @classmethod
    def get_device_info(cls, serial: str, adb_path: str = "adb") -> ADBDevice:
        """
        获取设备详细信息

        Args:
            serial: 设备序列号
            adb_path: adb 路径

        Returns:
            设备信息（包含 model, product）
        """
        # 检查设备是否存在
        devices = cls.list_devices(adb_path)
        device = next((d for d in devices if d.serial == serial), None)

        if not device:
            raise DeviceNotFoundException(serial)

        # 获取详细信息
        if device.is_available:
            model = cls.get_prop(serial, "ro.product.model", adb_path).strip()
            product = cls.get_prop(serial, "ro.product.name", adb_path).strip()
            device.model = model
            device.product = product

        return device

    @classmethod
    def get_prop(cls, serial: str, prop: str, adb_path: str = "adb") -> str:
        """
        获取设备属性

        Args:
            serial: 设备序列号
            prop: 属性名（如 ro.product.model）
            adb_path: adb 路径

        Returns:
            属性值
        """
        result = cls._run_command([
            adb_path, "-s", serial, "shell", "getprop", prop
        ])
        return result.stdout.strip()

    @classmethod
    def push_file(
        cls,
        serial: str,
        local_path: Path,
        remote_path: str,
        adb_path: str = "adb"
    ) -> bool:
        """
        推送文件到设备

        Args:
            serial: 设备序列号
            local_path: 本地文件路径
            remote_path: 远程路径
            adb_path: adb 路径

        Returns:
            是否成功

        示例：
            ADBManager.push_file(
                "ABC123",
                Path("scrcpy-server.jar"),
                "/data/local/tmp/scrcpy-server.jar"
            )
        """
        if not local_path.exists():
            raise FileNotFoundError(f"Local file not found: {local_path}")

        result = cls._run_command([
            adb_path, "-s", serial, "push",
            str(local_path), remote_path
        ], check=False)

        return result.returncode == 0

    @classmethod
    def execute_shell(
        cls,
        serial: str,
        command: str,
        adb_path: str = "adb",
        timeout: Optional[int] = None
    ) -> str:
        """
        执行 shell 命令

        Args:
            serial: 设备序列号
            command: shell 命令
            adb_path: adb 路径
            timeout: 超时时间（秒）

        Returns:
            命令输出

        示例：
            output = ADBManager.execute_shell("ABC123", "wm size")
            # 输出：Physical size: 1440x3120
        """
        result = cls._run_command(
            [adb_path, "-s", serial, "shell", command],
            timeout=timeout
        )
        return result.stdout

    @classmethod
    def forward_port(
        cls,
        serial: str,
        local_port: int,
        remote_port: int,
        adb_path: str = "adb"
    ):
        """
        端口转发

        Args:
            serial: 设备序列号
            local_port: 本地端口
            remote_port: 远程端口
            adb_path: adb 路径

        示例：
            # 将设备的 27183 端口转发到本地 27183
            ADBManager.forward_port("ABC123", 27183, 27183)
        """
        cls._run_command([
            adb_path, "-s", serial, "forward",
            f"tcp:{local_port}", f"tcp:{remote_port}"
        ])

    @classmethod
    def remove_forward(
        cls,
        serial: str,
        local_port: int,
        adb_path: str = "adb"
    ):
        """移除端口转发"""
        cls._run_command([
            adb_path, "-s", serial, "forward", "--remove",
            f"tcp:{local_port}"
        ], check=False)
```

---

## 🎬 pyutils.stream - 视频流处理

### 模块结构

```
pycore/pyutils/stream/
├── __init__.py
├── video_decoder.py        # 视频解码器抽象
├── h264_decoder.py         # H.264 解码器（PyAV）
├── fmp4_encoder.py         # fMP4 编码器
└── stream_types.py         # 类型定义
```

---

### __init__.py

```python
"""
pyutils.stream - 视频流处理模块（统一）

功能：
- H.264 解码（PyAV）
- fMP4 编码（浏览器 MSE 兼容）
- 视频帧处理

依赖：
- 标准库：abc, typing
- 第三方库：av (PyAV), numpy

迁移说明：
- 旧路径：pycore.pystream (已删除)
- 新路径：pycore.pyutils.video_stream
"""

from .video_decoder import VideoDecoder
from .h264_decoder import H264Decoder
from .fmp4_encoder import FMP4Encoder
from .stream_types import VideoFrame, VideoFormat

__all__ = [
    'VideoDecoder',
    'H264Decoder',
    'FMP4Encoder',
    'VideoFrame',
    'VideoFormat'
]
```

---

### stream_types.py

```python
"""视频流类型定义"""

from dataclasses import dataclass
from enum import Enum
import numpy as np

class VideoFormat(Enum):
    """视频格式"""
    YUV420P = "yuv420p"
    RGB24 = "rgb24"
    BGR24 = "bgr24"

@dataclass
class VideoFrame:
    """视频帧数据"""
    data: np.ndarray        # 帧数据（NumPy 数组）
    width: int              # 宽度
    height: int             # 高度
    format: VideoFormat     # 像素格式
    pts: int                # 时间戳（Presentation Timestamp）
    key_frame: bool = False # 是否为关键帧

    @property
    def shape(self) -> tuple:
        """帧形状"""
        return self.data.shape

    @property
    def size(self) -> int:
        """数据大小（字节）"""
        return self.data.nbytes
```

---

### video_decoder.py

```python
"""视频解码器抽象基类"""

from abc import ABC, abstractmethod
from typing import Generator, Optional
from .stream_types import VideoFrame

class VideoDecoder(ABC):
    """
    视频解码器抽象基类

    设计原则：
    1. 使用生成器模式（避免内存累积）
    2. 支持流式解码（边接收边解码）
    3. 零拷贝优先
    """

    @abstractmethod
    def feed(self, data: bytes):
        """
        输入编码数据

        Args:
            data: H.264 编码数据
        """
        pass

    @abstractmethod
    def decode(self) -> Generator[VideoFrame, None, None]:
        """
        解码视频帧

        Yields:
            VideoFrame: 解码后的视频帧
        """
        pass

    @abstractmethod
    def flush(self) -> Generator[VideoFrame, None, None]:
        """
        刷新解码器缓冲区

        Yields:
            VideoFrame: 缓冲区中的剩余帧
        """
        pass

    @abstractmethod
    def close(self):
        """关闭解码器，释放资源"""
        pass
```

---

### h264_decoder.py（核心）

```python
"""H.264 解码器（PyAV 实现）"""

import av
import numpy as np
from typing import Generator, Optional
from io import BytesIO

from .video_decoder import VideoDecoder
from .stream_types import VideoFrame, VideoFormat

class H264Decoder(VideoDecoder):
    """
    H.264 解码器（基于 PyAV）

    特性：
    - 零拷贝解码（直接访问 FFmpeg 内存）
    - 硬件加速支持（如果可用）
    - 流式解码

    性能：
    - 单个 720p 流：~5-10ms 延迟
    - CPU 占用：~20%（单核）
    """

    def __init__(self, hwaccel: Optional[str] = None):
        """
        初始化解码器

        Args:
            hwaccel: 硬件加速类型
                - None: 软件解码
                - 'cuda': NVIDIA GPU
                - 'qsv': Intel Quick Sync
                - 'videotoolbox': macOS 硬件加速
        """
        self.hwaccel = hwaccel
        self.codec = av.CodecContext.create("h264", "r")

        # 硬件加速配置
        if hwaccel:
            self.codec.options = {"hwaccel": hwaccel}

        self.buffer = BytesIO()

    def feed(self, data: bytes):
        """输入 H.264 数据"""
        self.buffer.write(data)

    def decode(self) -> Generator[VideoFrame, None, None]:
        """
        解码视频帧

        Yields:
            VideoFrame: 解码后的帧
        """
        # 将缓冲区数据构建为 Packet
        self.buffer.seek(0)
        packet_data = self.buffer.read()
        self.buffer = BytesIO()  # 重置缓冲区

        if not packet_data:
            return

        packet = av.Packet(packet_data)

        try:
            frames = self.codec.decode(packet)

            for frame in frames:
                # 零拷贝：直接访问 FFmpeg 内存
                yuv_array = frame.to_ndarray(format='yuv420p')

                yield VideoFrame(
                    data=yuv_array,
                    width=frame.width,
                    height=frame.height,
                    format=VideoFormat.YUV420P,
                    pts=frame.pts or 0,
                    key_frame=frame.key_frame
                )

        except av.AVError as e:
            # 解码错误（跳过损坏的帧）
            print(f"Decode error: {e}")

    def flush(self) -> Generator[VideoFrame, None, None]:
        """刷新解码器"""
        try:
            frames = self.codec.decode(None)  # None 触发 flush
            for frame in frames:
                yuv_array = frame.to_ndarray(format='yuv420p')
                yield VideoFrame(
                    data=yuv_array,
                    width=frame.width,
                    height=frame.height,
                    format=VideoFormat.YUV420P,
                    pts=frame.pts or 0,
                    key_frame=frame.key_frame
                )
        except av.AVError:
            pass

    def close(self):
        """关闭解码器"""
        self.codec.close()
```

---

### fmp4_encoder.py（核心）

```python
"""fMP4 编码器（浏览器 MSE 兼容）"""

import av
import numpy as np
from typing import Optional
from io import BytesIO

from .stream_types import VideoFrame, VideoFormat

class FMP4Encoder:
    """
    fMP4 (Fragmented MP4) 编码器

    用途：
    - 将 YUV 帧编码为 fMP4 格式
    - 兼容浏览器 MSE (Media Source Extensions)
    - 支持流式传输

    MSE 播放流程：
    1. 发送初始化片段（Init Segment）一次
    2. 持续发送媒体片段（Media Segment）

    参考：
    - https://developer.mozilla.org/en-US/docs/Web/API/Media_Source_Extensions_API
    """

    def __init__(
        self,
        width: int,
        height: int,
        fps: int = 30,
        bitrate: int = 2000000
    ):
        """
        初始化编码器

        Args:
            width: 视频宽度
            height: 视频高度
            fps: 帧率
            bitrate: 码率（bps）
        """
        self.width = width
        self.height = height
        self.fps = fps
        self.bitrate = bitrate

        self.codec: Optional[av.CodecContext] = None
        self.init_segment: Optional[bytes] = None
        self._frame_count = 0

        self._init_encoder()

    def _init_encoder(self):
        """初始化 H.264 编码器"""
        self.codec = av.CodecContext.create("libx264", "w")
        self.codec.width = self.width
        self.codec.height = self.height
        self.codec.pix_fmt = "yuv420p"
        self.codec.time_base = av.Fraction(1, self.fps)
        self.codec.framerate = self.fps
        self.codec.bit_rate = self.bitrate

        # H.264 配置（低延迟）
        self.codec.options = {
            "preset": "ultrafast",      # 快速编码
            "tune": "zerolatency",      # 零延迟优化
            "profile": "baseline",       # 基准配置（兼容性最好）
        }

        self.codec.open()

    def get_init_segment(self) -> bytes:
        """
        获取 fMP4 初始化片段

        这个片段只需发送一次，包含：
        - ftyp box (文件类型)
        - moov box (媒体元数据)

        Returns:
            初始化片段（bytes）
        """
        if self.init_segment:
            return self.init_segment

        # 创建临时容器生成初始化片段
        buffer = BytesIO()
        container = av.open(buffer, mode="w", format="mp4")

        stream = container.add_stream("h264", rate=self.fps)
        stream.width = self.width
        stream.height = self.height
        stream.pix_fmt = "yuv420p"

        # 写入头部（生成 ftyp + moov）
        container.close()

        self.init_segment = buffer.getvalue()
        return self.init_segment

    def encode(self, video_frame: VideoFrame) -> Optional[bytes]:
        """
        编码单个视频帧

        Args:
            video_frame: YUV420P 格式的视频帧

        Returns:
            fMP4 媒体片段（bytes），如果帧被缓冲则返回 None
        """
        if video_frame.format != VideoFormat.YUV420P:
            raise ValueError("Only YUV420P format is supported")

        # 创建 AVFrame
        frame = av.VideoFrame.from_ndarray(
            video_frame.data,
            format='yuv420p'
        )
        frame.pts = self._frame_count
        self._frame_count += 1

        # 编码
        packets = self.codec.encode(frame)

        if not packets:
            return None

        # 封装为 fMP4 片段（moof + mdat）
        buffer = BytesIO()
        container = av.open(buffer, mode="w", format="mp4")
        stream = container.add_stream(template=self.codec)

        for packet in packets:
            container.mux(packet)

        container.close()

        return buffer.getvalue()

    def flush(self) -> bytes:
        """刷新编码器，返回剩余数据"""
        packets = self.codec.encode(None)

        if not packets:
            return b""

        buffer = BytesIO()
        container = av.open(buffer, mode="w", format="mp4")
        stream = container.add_stream(template=self.codec)

        for packet in packets:
            container.mux(packet)

        container.close()

        return buffer.getvalue()

    def close(self):
        """关闭编码器"""
        if self.codec:
            self.codec.close()
```

---

## 📱 pyutils.device - 设备抽象

### 模块结构

```
pycore/pyfoundations/device/
├── __init__.py
├── device_info.py          # 设备信息
├── server_params.py        # scrcpy-server 参数
├── android_device.py       # Android 设备抽象
└── scrcpy_device.py        # Scrcpy 设备

便捷导出（pycore/pyutils/device/）:
└── __init__.py             # 从 pyutils.device 重新导出
```

---

### __init__.py

```python
"""
pydevice - 设备抽象模块

功能：
- Android 设备信息封装
- scrcpy-server 参数管理
- 设备生命周期管理

依赖：
- pycore.pyadb
"""

from .device_info import DeviceInfo, Resolution
from .server_params import ServerParams, VideoCodec
from .android_device import AndroidDevice

__all__ = [
    'DeviceInfo',
    'Resolution',
    'ServerParams',
    'VideoCodec',
    'AndroidDevice'
]
```

---

### device_info.py

```python
"""设备信息数据类"""

from dataclasses import dataclass
from typing import Tuple

@dataclass
class Resolution:
    """分辨率"""
    width: int
    height: int

    @property
    def aspect_ratio(self) -> float:
        """宽高比"""
        return self.width / self.height

    def __str__(self) -> str:
        return f"{self.width}x{self.height}"

@dataclass
class DeviceInfo:
    """Android 设备完整信息"""
    serial: str                     # 序列号
    model: str                      # 型号
    resolution: Resolution          # 分辨率
    dpi: int                        # DPI
    android_version: str            # Android 版本
    sdk_version: int                # SDK 版本

    def __repr__(self) -> str:
        return (
            f"DeviceInfo(serial='{self.serial}', model='{self.model}', "
            f"resolution={self.resolution}, android={self.android_version})"
        )
```

---

### server_params.py

```python
"""scrcpy-server 参数配置"""

from dataclasses import dataclass
from enum import Enum

class VideoCodec(Enum):
    """视频编码格式"""
    H264 = "h264"
    H265 = "h265"
    AV1 = "av1"

@dataclass
class ServerParams:
    """
    scrcpy-server 启动参数

    参考：https://github.com/Genymobile/scrcpy/blob/master/SERVER.md
    """
    max_size: int = 720             # 最大分辨率（短边）
    bit_rate: int = 8000000         # 码率（8Mbps）
    max_fps: int = 60               # 最大帧率
    codec: VideoCodec = VideoCodec.H264  # 视频编码
    control: bool = True            # 是否启用控制
    lockedVideoOrientation: int = -1  # 锁定方向（-1=自动）

    def to_scrcpy_args(self) -> str:
        """
        转换为 scrcpy-server 命令行参数

        Returns:
            参数字符串，如：
            "log_level=info max_size=720 bit_rate=8000000 ..."
        """
        args = [
            "log_level=info",
            f"max_size={self.max_size}",
            f"bit_rate={self.bit_rate}",
            f"max_fps={self.max_fps}",
            f"codec={self.codec.value}",
            f"control={str(self.control).lower()}",
            f"locked_video_orientation={self.lockedVideoOrientation}"
        ]
        return " ".join(args)
```

---

## 🎮 pycontrol - 控制协议

### 模块结构

```
pycore/pycontrol/
├── __init__.py
├── touch_event.py          # 触摸事件
├── key_event.py            # 按键事件
├── coordinate_mapper.py    # 坐标映射
└── message_builder.py      # scrcpy 协议消息构建器
```

---

### coordinate_mapper.py（重要）

```python
"""坐标映射器（分辨率适配）"""

from typing import Tuple

class CoordinateMapper:
    """
    坐标映射器

    功能：
    - 将浏览器坐标映射到设备坐标
    - 适配不同分辨率
    - 支持旋转

    示例：
        # 浏览器显示 720x1280，设备实际 1440x3120
        x, y = CoordinateMapper.map(
            360, 640,               # 浏览器坐标（点击中心）
            from_width=720,
            from_height=1280,
            to_width=1440,
            to_height=3120
        )
        # 结果：(720, 1560)
    """

    @staticmethod
    def map(
        x: int,
        y: int,
        from_width: int,
        from_height: int,
        to_width: int,
        to_height: int
    ) -> Tuple[int, int]:
        """
        映射坐标

        Args:
            x, y: 源坐标
            from_width, from_height: 源分辨率
            to_width, to_height: 目标分辨率

        Returns:
            映射后的坐标 (x, y)
        """
        mapped_x = int(x * to_width / from_width)
        mapped_y = int(y * to_height / from_height)

        # 边界检查
        mapped_x = max(0, min(mapped_x, to_width - 1))
        mapped_y = max(0, min(mapped_y, to_height - 1))

        return mapped_x, mapped_y

    @staticmethod
    def map_batch(
        points: list[Tuple[int, int]],
        from_width: int,
        from_height: int,
        to_width: int,
        to_height: int
    ) -> list[Tuple[int, int]]:
        """批量映射坐标"""
        return [
            CoordinateMapper.map(
                x, y, from_width, from_height, to_width, to_height
            )
            for x, y in points
        ]
```

---

## 👥 pygroup - 群控算法

### group_controller.py（完整实现）

```python
"""群控控制器"""

from typing import Set, Optional, Callable, Dict
from abc import ABC, abstractmethod
from dataclasses import dataclass

@dataclass
class SyncEvent:
    """同步事件"""
    from_device: str    # 来源设备
    event_type: str     # 事件类型（touch/key）
    event_data: dict    # 事件数据

class SyncStrategy(ABC):
    """同步策略抽象"""

    @abstractmethod
    def should_sync(
        self,
        event: SyncEvent,
        master_serial: str,
        slave_serial: str
    ) -> bool:
        """判断是否应该同步到从设备"""
        pass

class AllSyncStrategy(SyncStrategy):
    """全部同步策略"""

    def should_sync(
        self,
        event: SyncEvent,
        master_serial: str,
        slave_serial: str
    ) -> bool:
        return True

class GroupController:
    """
    群控控制器（核心算法）

    功能：
    - 管理主从设备关系
    - 事件广播策略
    - 同步规则

    特点：
    - 无状态（不依赖 WebSocket）
    - 纯算法逻辑
    - 易于测试
    """

    def __init__(self, strategy: Optional[SyncStrategy] = None):
        self.strategy = strategy or AllSyncStrategy()
        self.master_device: Optional[str] = None
        self.slave_devices: Set[str] = set()
        self._device_metadata: Dict[str, dict] = {}

    def set_master(self, serial: str, metadata: Optional[dict] = None):
        """
        设置主控设备

        Args:
            serial: 设备序列号
            metadata: 设备元数据（如分辨率）
        """
        self.master_device = serial
        self.slave_devices.discard(serial)

        if metadata:
            self._device_metadata[serial] = metadata

    def add_slave(self, serial: str, metadata: Optional[dict] = None):
        """添加从设备"""
        if serial != self.master_device:
            self.slave_devices.add(serial)

            if metadata:
                self._device_metadata[serial] = metadata

    def remove_device(self, serial: str):
        """移除设备"""
        if serial == self.master_device:
            self.master_device = None

        self.slave_devices.discard(serial)
        self._device_metadata.pop(serial, None)

    def get_sync_targets(self, event: SyncEvent) -> Set[str]:
        """
        获取需要同步的目标设备

        Args:
            event: 同步事件

        Returns:
            目标设备序列号集合
        """
        # 只有主设备的事件才会同步
        if event.from_device != self.master_device:
            return set()

        if not self.master_device:
            return set()

        # 根据策略筛选设备
        targets = {
            slave for slave in self.slave_devices
            if self.strategy.should_sync(
                event, self.master_device, slave
            )
        }

        return targets

    def is_master(self, serial: str) -> bool:
        """是否为主设备"""
        return serial == self.master_device

    def is_slave(self, serial: str) -> bool:
        """是否为从设备"""
        return serial in self.slave_devices

    def get_device_count(self) -> int:
        """获取设备总数"""
        count = len(self.slave_devices)
        if self.master_device:
            count += 1
        return count
```

---

## 🌐 pyapi - FastAPI 工具

### websocket_manager.py（完整实现）

```python
"""WebSocket 连接管理器"""

from fastapi import WebSocket
from typing import Dict, Set, Optional, Callable
import asyncio
from loguru import logger

class WebSocketManager:
    """
    WebSocket 连接管理器（通用工具）

    功能：
    - 连接管理（按 key 分组）
    - 广播消息
    - 自动清理断开连接
    - 线程安全

    使用场景：
    - 视频流广播（一个设备 → 多个客户端）
    - 控制消息路由（客户端 → 设备）
    - 群控事件广播（主设备 → 从设备）
    """

    def __init__(self):
        self._connections: Dict[str, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()
        self._connection_metadata: Dict[WebSocket, dict] = {}

    async def connect(
        self,
        key: str,
        websocket: WebSocket,
        metadata: Optional[dict] = None
    ):
        """
        添加连接

        Args:
            key: 分组 key（如设备序列号）
            websocket: WebSocket 连接
            metadata: 连接元数据（可选）
        """
        await websocket.accept()

        async with self._lock:
            if key not in self._connections:
                self._connections[key] = set()

            self._connections[key].add(websocket)

            if metadata:
                self._connection_metadata[websocket] = metadata

        logger.info(f"WebSocket connected: key={key}, total={self.get_connection_count(key)}")

    async def disconnect(self, key: str, websocket: WebSocket):
        """移除连接"""
        async with self._lock:
            if key in self._connections:
                self._connections[key].discard(websocket)

                if not self._connections[key]:
                    del self._connections[key]

            self._connection_metadata.pop(websocket, None)

        logger.info(f"WebSocket disconnected: key={key}")

    async def broadcast(
        self,
        key: str,
        data: bytes,
        exclude: Optional[Set[WebSocket]] = None
    ):
        """
        广播数据

        Args:
            key: 目标组
            data: 数据（bytes）
            exclude: 排除的连接（可选）
        """
        if key not in self._connections:
            return

        exclude = exclude or set()
        disconnected = set()

        for ws in self._connections[key]:
            if ws in exclude:
                continue

            try:
                await ws.send_bytes(data)
            except Exception as e:
                logger.warning(f"Broadcast error: {e}")
                disconnected.add(ws)

        # 清理断开的连接
        for ws in disconnected:
            await self.disconnect(key, ws)

    async def send_json(
        self,
        key: str,
        websocket: WebSocket,
        data: dict
    ):
        """发送 JSON 数据到指定连接"""
        try:
            await websocket.send_json(data)
        except Exception as e:
            logger.error(f"Send JSON error: {e}")
            await self.disconnect(key, websocket)

    def get_connection_count(self, key: str) -> int:
        """获取连接数"""
        return len(self._connections.get(key, set()))

    def get_all_keys(self) -> list[str]:
        """获取所有 key"""
        return list(self._connections.keys())

    def get_metadata(self, websocket: WebSocket) -> Optional[dict]:
        """获取连接元数据"""
        return self._connection_metadata.get(websocket)
```

---

## 📝 总结

### 实现清单

| 模块 | 文件数 | 代码行数（估算） | 状态 |
|------|-------|----------------|------|
| pyadb | 4 | ~500 | 📝 待实现 |
| pystream | 5 | ~800 | 📝 待实现 |
| pydevice | 4 | ~300 | 📝 待实现 |
| pycontrol | 4 | ~400 | 📝 待实现 |
| pygroup | 1 | ~200 | 📝 待实现 |
| pyapi | 1 | ~150 | 📝 待实现 |
| **总计** | **19** | **~2350** | - |

### 下一步

1. 按优先级实现模块（pyadb → pydevice → pystream → pycontrol）
2. 编写单元测试
3. 集成到 poly_apps/pyMatrix
4. 性能测试和优化

---

**文档版本**：1.0
**最后更新**：2025-10-30
