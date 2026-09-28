# pyMatrix - Python版Android设备投屏与群控系统

## 项目概述

pyMatrix 是参考 SmartMatrix (C++/Qt) 实现的 Python 版本 Android 设备投屏与群控系统。严格遵循 C++ 版本的架构设计和技术方案，使用 Python 生态系统的优秀库进行实现。

---

## 一、技术栈选型

### 1.1 核心依赖库

| 功能模块 | C++ 版本 | Python 版本 | 说明 |
|---------|----------|-------------|------|
| **ADB通信** | QProcess | `subprocess` + `adb-shell` | ADB命令执行 |
| **视频解码** | FFmpeg (libavcodec) | `av` (PyAV) | FFmpeg Python绑定 |
| **视频渲染** | OpenGL (QOpenGLWidget) | `OpenGL` + `PyQt6` | GPU加速渲染 |
| **GUI框架** | Qt 6 | `PyQt6` | 跨平台GUI |
| **网络通信** | QTcpSocket/QTcpServer | `socket` (标准库) | TCP Socket |
| **多线程** | QThread | `threading` + `queue` | 线程管理 |
| **异步编程** | Qt 信号槽 | `PyQt6 信号槽` | 事件驱动 |
| **图像处理** | - | `numpy` + `opencv-python` | 图像数据处理 |
| **配置管理** | Qt Settings | `configparser` + `json` | 配置文件 |

### 1.2 依赖包版本

```txt
# requirements.txt
PyQt6>=6.6.0
PyQt6-WebEngine>=6.6.0
av>=11.0.0              # PyAV - FFmpeg Python绑定
numpy>=1.24.0
opencv-python>=4.8.0
adb-shell>=0.4.4        # Pure Python ADB implementation
pyopengl>=3.1.7         # OpenGL bindings
pillow>=10.0.0          # 图像处理
pydantic>=2.5.0         # 数据验证
loguru>=0.7.2           # 日志
```

---

## 二、项目架构设计

### 2.1 目录结构

```
pyMatrix/
├── core/                           # 核心功能模块
│   ├── __init__.py
│   ├── adb/                        # ADB通信模块
│   │   ├── __init__.py
│   │   ├── adb_process.py          # ADB命令封装 (参考: adbprocess.cpp)
│   │   ├── adb_executor.py         # ADB命令执行器 (参考: adbprocessimpl.cpp)
│   │   └── adb_types.py            # ADB类型定义
│   ├── device/                     # 设备管理模块
│   │   ├── __init__.py
│   │   ├── device.py               # 设备抽象类 (参考: device.cpp)
│   │   ├── device_manager.py       # 设备管理器 (参考: devicemanage.cpp)
│   │   ├── device_params.py        # 设备参数配置
│   │   └── server/                 # 服务端管理
│   │       ├── __init__.py
│   │       ├── server.py           # 服务启动流程 (参考: server.cpp)
│   │       ├── tcp_server.py       # TCP服务器 (参考: tcpserver.cpp)
│   │       └── video_socket.py     # 视频Socket (参考: videosocket.cpp)
│   ├── stream/                     # 视频流处理模块
│   │   ├── __init__.py
│   │   ├── demuxer.py              # 视频流解复用 (参考: demuxer.cpp)
│   │   ├── decoder.py              # FFmpeg解码器 (参考: decoder.cpp)
│   │   ├── video_buffer.py         # 视频缓冲区 (参考: videobuffer.cpp)
│   │   └── fps_counter.py          # FPS计数器 (参考: fpscounter.cpp)
│   ├── control/                    # 控制模块
│   │   ├── __init__.py
│   │   ├── controller.py           # 控制器 (参考: controller.cpp)
│   │   ├── control_msg.py          # 控制消息协议 (参考: controlmsg.cpp)
│   │   ├── input_converter.py      # 输入转换器 (参考: inputconvertbase.cpp)
│   │   ├── input_converter_normal.py  # 普通模式 (参考: inputconvertnormal.cpp)
│   │   ├── input_converter_game.py    # 游戏模式 (参考: inputconvertgame.cpp)
│   │   ├── keymap.py               # 按键映射 (参考: keymap.cpp)
│   │   └── receiver.py             # 设备消息接收 (参考: receiver.cpp)
│   ├── render/                     # 渲染模块
│   │   ├── __init__.py
│   │   ├── video_renderer.py       # 视频渲染器
│   │   ├── opengl_widget.py        # OpenGL渲染组件
│   │   └── yuv_shader.py           # YUV→RGB着色器
│   └── group/                      # 群控模块
│       ├── __init__.py
│       └── group_controller.py     # 群控管理器 (参考: groupcontroller.cpp)
├── ui/                             # 用户界面模块
│   ├── __init__.py
│   ├── main_window.py              # 主窗口 (参考: dialog.cpp)
│   ├── video_widget.py             # 视频显示组件 (参考: videoform.cpp)
│   ├── device_tree_widget.py       # 设备列表树
│   ├── control_panel.py            # 控制面板
│   └── resources/                  # UI资源
│       ├── icons/
│       └── styles/
├── utils/                          # 工具模块
│   ├── __init__.py
│   ├── config.py                   # 配置管理
│   ├── logger.py                   # 日志系统
│   ├── exceptions.py               # 自定义异常
│   └── helpers.py                  # 辅助函数
├── resources/                      # 资源文件
│   ├── scrcpy-server.jar           # Android服务端
│   ├── adb/                        # ADB可执行文件
│   │   ├── windows/
│   │   │   └── adb.exe
│   │   ├── linux/
│   │   │   └── adb
│   │   └── macos/
│   │       └── adb
│   └── keymaps/                    # 按键映射配置
│       └── example.json
├── tests/                          # 测试模块
│   ├── __init__.py
│   ├── test_adb.py
│   ├── test_device.py
│   └── test_decoder.py
├── docs/                           # 文档
│   ├── API.md
│   ├── ARCHITECTURE.md
│   └── DEVELOPMENT.md
├── main.py                         # 程序入口
├── requirements.txt                # 依赖清单
├── setup.py                        # 安装脚本
├── README.md                       # 项目说明
└── .gitignore
```

---

## 三、核心模块设计

### 3.1 ADB通信模块

#### 3.1.1 AdbProcess 类设计

```python
# core/adb/adb_process.py
from enum import Enum
from typing import Optional, List, Callable
from PyQt6.QtCore import QObject, pyqtSignal
import subprocess

class AdbExecResult(Enum):
    """ADB执行结果 (参考: adbprocess.h:14-21)"""
    SUCCESS_START = 0       # 启动成功
    ERROR_START = 1         # 启动失败
    SUCCESS_EXEC = 2        # 执行成功
    ERROR_EXEC = 3          # 执行失败
    ERROR_MISSING_BINARY = 4  # ADB文件不存在

class AdbProcess(QObject):
    """
    ADB进程封装类
    参考: adbprocess.cpp
    """
    # 信号定义
    adb_process_result = pyqtSignal(AdbExecResult, str)  # (结果, 输出)

    def __init__(self, parent=None):
        super().__init__(parent)
        self._process: Optional[subprocess.Popen] = None
        self._stdout: str = ""
        self._stderr: str = ""

    @staticmethod
    def set_adb_path(adb_path: str):
        """设置ADB路径"""
        global g_adb_path
        g_adb_path = adb_path

    @staticmethod
    def get_adb_path() -> str:
        """
        获取ADB路径
        参考: adbprocessimpl.cpp:28-54
        查找顺序:
        1. 环境变量 PyMatrix_ADB_PATH
        2. 全局变量 g_adb_path
        3. 应用目录下的 adb/adb.exe
        """
        # 实现逻辑...
        pass

    def execute(self, serial: str, args: List[str]):
        """
        执行ADB命令
        参考: adbprocess.cpp:34-37
        """
        cmd = [self.get_adb_path()]
        if serial:
            cmd.extend(["-s", serial])
        cmd.extend(args)

        try:
            self._process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            # 异步读取输出...
        except Exception as e:
            self.adb_process_result.emit(AdbExecResult.ERROR_START, str(e))

    def forward(self, serial: str, local_port: int, device_socket_name: str):
        """
        端口转发
        参考: adbprocessimpl.cpp:198-205
        命令: adb -s <serial> forward tcp:<localPort> localabstract:<socketName>
        """
        args = ["forward", f"tcp:{local_port}", f"localabstract:{device_socket_name}"]
        self.execute(serial, args)

    def reverse(self, serial: str, device_socket_name: str, local_port: int):
        """
        反向代理
        参考: adbprocessimpl.cpp:216-223
        命令: adb -s <serial> reverse localabstract:<socketName> tcp:<localPort>
        """
        args = ["reverse", f"localabstract:{device_socket_name}", f"tcp:{local_port}"]
        self.execute(serial, args)

    def push(self, serial: str, local: str, remote: str):
        """
        推送文件到设备
        参考: adbprocessimpl.cpp:234-241
        命令: adb -s <serial> push <local> <remote>
        """
        args = ["push", local, remote]
        self.execute(serial, args)

    def get_devices_serial(self) -> List[str]:
        """
        获取已连接设备列表
        参考: adbprocessimpl.cpp:131-147
        解析 adb devices 输出
        """
        args = ["devices"]
        self.execute("", args)
        # 解析输出格式:
        # List of devices attached
        # ABC123DEF456    device
        # GHI789JKL012    device
        pass

    def install(self, serial: str, apk_path: str):
        """
        安装APK
        参考: adbprocessimpl.cpp:243-250
        命令: adb -s <serial> install -r <apk_path>
        """
        args = ["install", "-r", apk_path]
        self.execute(serial, args)
```

---

### 3.2 服务端启动模块

#### 3.2.1 Server 类设计

```python
# core/device/server/server.py
from dataclasses import dataclass
from enum import Enum
from PyQt6.QtCore import QObject, pyqtSignal
from PyQt6.QtNetwork import QTcpServer
import socket

class ServerStartStep(Enum):
    """
    服务启动步骤
    参考: server.h:16-24
    """
    NULL = 0
    PUSH = 1                      # 推送服务端JAR
    ENABLE_TUNNEL_REVERSE = 2     # 启用反向代理
    ENABLE_TUNNEL_FORWARD = 3     # 启用端口转发
    EXECUTE_SERVER = 4            # 执行服务端
    RUNNING = 5                   # 运行中

@dataclass
class ServerParams:
    """
    服务器参数配置
    参考: server.h:27-56
    """
    # 必需参数
    serial: str = ""                    # 设备序列号
    server_local_path: str = ""         # 本地server路径

    # 可选参数
    server_remote_path: str = "/data/local/tmp/scrcpy-server.jar"
    local_port: int = 27183            # 本地监听端口
    max_size: int = 720                # 视频分辨率 (短边)
    bit_rate: int = 8000000            # 比特率 (8Mbps)
    max_fps: int = 60                  # 最大帧率
    use_reverse: bool = True           # 使用反向代理
    capture_orientation_lock: int = 0  # 采集方向锁定
    capture_orientation: int = 0       # 采集方向
    stay_awake: bool = False           # 保持唤醒
    server_version: str = "3.3.1"      # server版本
    log_level: str = "debug"           # 日志级别
    codec_options: str = ""            # 编码选项
    codec_name: str = ""               # 编码器名称
    crop: str = ""                     # 视频裁剪
    control: bool = True               # 是否接收控制
    scid: int = -1                     # socket名字后缀

class Server(QObject):
    """
    Android服务端管理器
    参考: server.cpp
    """
    # 信号定义
    server_started = pyqtSignal(bool, str, tuple)  # (成功, 设备名, 分辨率(w,h))
    server_stopped = pyqtSignal()

    DEVICE_NAME_FIELD_LENGTH = 64
    SOCKET_NAME_PREFIX = "scrcpy"
    MAX_CONNECT_COUNT = 30

    def __init__(self, parent=None):
        super().__init__(parent)
        self._params = ServerParams()
        self._work_process = AdbProcess()
        self._server_process = AdbProcess()
        self._server_socket = QTcpServer()
        self._video_socket: Optional[socket.socket] = None
        self._control_socket: Optional[socket.socket] = None
        self._server_start_step = ServerStartStep.NULL
        self._tunnel_forward = False
        self._tunnel_enabled = False
        self._device_name = ""
        self._device_size = (0, 0)

        # 连接信号槽
        self._work_process.adb_process_result.connect(self._on_work_process_result)
        self._server_process.adb_process_result.connect(self._on_work_process_result)

    def start(self, params: ServerParams) -> bool:
        """
        启动服务
        参考: server.cpp:225-283
        """
        self._params = params
        self._server_start_step = ServerStartStep.PUSH
        return self._start_server_by_step()

    def _start_server_by_step(self) -> bool:
        """
        按步骤启动服务
        参考: server.cpp:285-317
        """
        if self._server_start_step == ServerStartStep.PUSH:
            return self._push_server()
        elif self._server_start_step == ServerStartStep.ENABLE_TUNNEL_REVERSE:
            return self._enable_tunnel_reverse()
        elif self._server_start_step == ServerStartStep.ENABLE_TUNNEL_FORWARD:
            return self._enable_tunnel_forward()
        elif self._server_start_step == ServerStartStep.EXECUTE_SERVER:
            return self._execute()
        return False

    def _push_server(self) -> bool:
        """
        推送服务端JAR到设备
        参考: server.cpp:55-62
        """
        if self._work_process.is_running():
            self._work_process.kill()

        self._work_process.push(
            self._params.serial,
            self._params.server_local_path,
            self._params.server_remote_path
        )
        return True

    def _enable_tunnel_reverse(self) -> bool:
        """
        启用反向代理
        参考: server.cpp:64-71

        原理:
        - PC监听本地端口 (默认27183)
        - Android连接到 localabstract:scrcpy_<scid>
        - 数据流: Android → PC
        """
        if self._work_process.is_running():
            self._work_process.kill()

        socket_name = f"{self.SOCKET_NAME_PREFIX}_{self._params.scid:08x}"
        self._work_process.reverse(
            self._params.serial,
            socket_name,
            self._params.local_port
        )
        return True

    def _enable_tunnel_forward(self) -> bool:
        """
        启用端口转发 (备用方案)
        参考: server.cpp:88-95

        原理:
        - PC转发本地端口到设备
        - PC主动连接本地端口
        - 数据流: PC → ADB → Android socket
        """
        if self._work_process.is_running():
            self._work_process.kill()

        socket_name = f"{self.SOCKET_NAME_PREFIX}_{self._params.scid:08x}"
        self._work_process.forward(
            self._params.serial,
            self._params.local_port,
            socket_name
        )
        return True

    def _execute(self) -> bool:
        """
        启动Android服务端
        参考: server.cpp:111-223

        完整命令示例:
        adb -s <serial> shell CLASSPATH=/data/local/tmp/scrcpy-server.jar \\
            app_process / com.genymobile.scrcpy.Server 3.3.1 \\
            video_bit_rate=8000000 \\
            max_size=720 \\
            max_fps=60 \\
            log_level=debug \\
            control=true \\
            audio=false \\
            scid=00000001
        """
        args = ["shell"]
        args.append(f"CLASSPATH={self._params.server_remote_path}")
        args.append("app_process")
        args.append("/")  # unused
        args.append("com.genymobile.scrcpy.Server")
        args.append(self._params.server_version)

        # 视频参数
        args.append(f"video_bit_rate={self._params.bit_rate}")
        args.append(f"max_size={self._params.max_size}")
        args.append(f"max_fps={self._params.max_fps}")
        args.append(f"log_level={self._params.log_level}")

        # 采集方向
        if self._params.capture_orientation_lock == 1:
            args.append(f"capture_orientation=@{self._params.capture_orientation}")

        if self._tunnel_forward:
            args.append("tunnel_forward=true")

        if not self._params.control:
            args.append("control=false")

        if self._params.stay_awake:
            args.append("stay_awake=true")

        # 编码配置
        if self._params.codec_options:
            args.append(f"codec_options={self._params.codec_options}")
        if self._params.codec_name:
            args.append(f"encoder_name={self._params.codec_name}")

        args.append("audio=false")

        if self._params.scid != -1:
            args.append(f"scid={self._params.scid:08x}")

        # 执行阻塞命令 (需要在新线程中执行)
        self._server_process.execute(self._params.serial, args)
        return True

    def _read_device_info(self, video_socket: socket.socket) -> tuple[str, tuple[int, int]]:
        """
        读取设备信息
        参考: server.cpp:336-363

        数据包格式 (76字节):
        | 设备名称 (64字节) | AVCodecID (4字节) | 宽度 (4字节) | 高度 (4字节) |
        """
        try:
            # 读取76字节
            buf = video_socket.recv(self.DEVICE_NAME_FIELD_LENGTH + 12)

            if len(buf) < self.DEVICE_NAME_FIELD_LENGTH + 12:
                return "", (0, 0)

            # 解析设备名称 (64字节, UTF-8编码)
            device_name = buf[:self.DEVICE_NAME_FIELD_LENGTH].decode('utf-8', errors='ignore').rstrip('\x00')

            # 解析视频尺寸 (大端序)
            # 跳过AVCodecID (4字节)
            offset = self.DEVICE_NAME_FIELD_LENGTH + 4
            width = int.from_bytes(buf[offset:offset+4], byteorder='big')
            height = int.from_bytes(buf[offset+4:offset+8], byteorder='big')

            return device_name, (width, height)
        except Exception as e:
            print(f"Error reading device info: {e}")
            return "", (0, 0)
```

---

### 3.3 视频流处理模块

#### 3.3.1 Demuxer 类设计

```python
# core/stream/demuxer.py
from PyQt6.QtCore import QThread, pyqtSignal
import av
import socket

class Demuxer(QThread):
    """
    视频流解复用器
    参考: demuxer.cpp

    功能:
    - 从VideoSocket接收H.264流
    - 使用PyAV解析AVPacket
    - 区分配置帧(SPS/PPS)和普通帧
    - 通过信号发送到Decoder
    """
    # 信号定义
    got_frame = pyqtSignal(object)          # 普通帧
    got_config_frame = pyqtSignal(object)   # 配置帧

    def __init__(self, parent=None):
        super().__init__(parent)
        self._video_socket: Optional[socket.socket] = None
        self._frame_size = (0, 0)
        self._running = False

    def install_video_socket(self, video_socket: socket.socket):
        """
        安装视频Socket
        参考: demuxer.cpp:17-19
        """
        self._video_socket = video_socket

    def set_frame_size(self, size: tuple[int, int]):
        """设置帧尺寸"""
        self._frame_size = size

    def start_decode(self):
        """开始解码"""
        self._running = True
        self.start()  # 启动线程

    def stop_decode(self):
        """停止解码"""
        self._running = False
        self.wait()  # 等待线程结束

    def run(self):
        """
        线程主循环
        参考: demuxer.cpp:43-80
        """
        try:
            # 使用PyAV创建容器
            # av.open() 支持从socket读取
            container = av.open(
                self._video_socket.makefile('rb'),
                format='h264'
            )

            for packet in container.demux(video=0):
                if not self._running:
                    break

                # 判断是否为配置帧
                if self._is_config_packet(packet):
                    self.got_config_frame.emit(packet)
                else:
                    self.got_frame.emit(packet)

        except Exception as e:
            print(f"Demuxer error: {e}")
        finally:
            if self._video_socket:
                self._video_socket.close()

    def _is_config_packet(self, packet) -> bool:
        """
        判断是否为配置帧 (SPS/PPS)
        H.264 NAL类型:
        - 7 (0x07): SPS (Sequence Parameter Set)
        - 8 (0x08): PPS (Picture Parameter Set)
        """
        if not packet.buffer:
            return False

        data = bytes(packet.buffer)
        if len(data) < 5:
            return False

        # 查找NAL起始码: 0x00 0x00 0x00 0x01
        if data[:4] == b'\x00\x00\x00\x01':
            nal_type = data[4] & 0x1F
            return nal_type == 7 or nal_type == 8

        return False
```

#### 3.3.2 Decoder 类设计

```python
# core/stream/decoder.py
from PyQt6.QtCore import QObject, pyqtSignal
import av
import numpy as np
from typing import Callable

class Decoder(QObject):
    """
    视频解码器
    参考: decoder.cpp

    功能:
    - 使用PyAV解码H.264
    - 输出YUV420平面数据
    - 通过回调传递给渲染器
    """
    # 信号定义
    update_fps = pyqtSignal(int)
    new_frame = pyqtSignal()

    def __init__(self, on_frame: Callable, parent=None):
        """
        参数:
            on_frame: 帧回调函数
                      签名: on_frame(width, height, data_y, data_u, data_v,
                                    linesize_y, linesize_u, linesize_v)
        """
        super().__init__(parent)
        self._codec_context: Optional[av.CodecContext] = None
        self._on_frame = on_frame
        self._fps_counter = FPSCounter()

    def open(self) -> bool:
        """
        打开解码器
        参考: decoder.cpp:27-56
        """
        try:
            # 查找H.264解码器
            codec = av.Codec('h264', 'r')
            self._codec_context = av.CodecContext.create(codec)

            # 配置解码器
            self._codec_context.thread_count = 0  # 自动检测CPU核心数
            self._codec_context.thread_type = 'AUTO'

            # 打开解码器
            self._codec_context.open()

            return True
        except Exception as e:
            print(f"Failed to open decoder: {e}")
            return False

    def close(self):
        """关闭解码器"""
        if self._codec_context:
            self._codec_context.close()
            self._codec_context = None

    def push(self, packet) -> bool:
        """
        推送数据包进行解码
        参考: decoder.cpp:58-83
        """
        if not self._codec_context:
            return False

        try:
            # 发送packet到解码器
            self._codec_context.decode(packet)

            # 接收解码后的帧
            for frame in self._codec_context.decode():
                self._process_frame(frame)

            return True
        except Exception as e:
            print(f"Decode error: {e}")
            return False

    def _process_frame(self, frame: av.VideoFrame):
        """
        处理解码后的帧
        参考: decoder.cpp:85-115
        """
        # 更新FPS
        fps = self._fps_counter.add_frame()
        if fps > 0:
            self.update_fps.emit(fps)

        # 转换为YUV420格式
        if frame.format.name != 'yuv420p':
            frame = frame.reformat(format='yuv420p')

        # 提取YUV平面数据
        width = frame.width
        height = frame.height

        # PyAV frame.planes[0/1/2] 对应 Y/U/V平面
        data_y = np.frombuffer(frame.planes[0], dtype=np.uint8)
        data_u = np.frombuffer(frame.planes[1], dtype=np.uint8)
        data_v = np.frombuffer(frame.planes[2], dtype=np.uint8)

        linesize_y = frame.planes[0].line_size
        linesize_u = frame.planes[1].line_size
        linesize_v = frame.planes[2].line_size

        # 调用回调函数
        self._on_frame(
            width, height,
            data_y, data_u, data_v,
            linesize_y, linesize_u, linesize_v
        )

        # 发射信号
        self.new_frame.emit()
```

---

### 3.4 控制模块设计

#### 3.4.1 ControlMsg 类设计

```python
# core/control/control_msg.py
from enum import IntEnum
from dataclasses import dataclass
import struct

class ControlMsgType(IntEnum):
    """
    控制消息类型
    参考: controlmsg.h:30-45
    """
    NULL = -1
    INJECT_KEYCODE = 0              # 按键注入
    INJECT_TEXT = 1                 # 文本注入
    INJECT_TOUCH = 2                # 触摸注入
    INJECT_SCROLL = 3               # 滚动注入
    BACK_OR_SCREEN_ON = 4           # 返回键/点亮屏幕
    EXPAND_NOTIFICATION_PANEL = 5   # 展开通知栏
    EXPAND_SETTINGS_PANEL = 6       # 展开设置面板
    COLLAPSE_PANELS = 7             # 折叠面板
    GET_CLIPBOARD = 8               # 获取剪贴板
    SET_CLIPBOARD = 9               # 设置剪贴板
    SET_DISPLAY_POWER = 10          # 设置屏幕电源
    ROTATE_DEVICE = 11              # 旋转设备

class AndroidKeycode(IntEnum):
    """Android按键码"""
    KEYCODE_HOME = 3
    KEYCODE_BACK = 4
    KEYCODE_MENU = 82
    KEYCODE_VOLUME_UP = 24
    KEYCODE_VOLUME_DOWN = 25
    KEYCODE_POWER = 26
    KEYCODE_APP_SWITCH = 187

class AndroidMotionEventAction(IntEnum):
    """Android触摸动作"""
    ACTION_DOWN = 0
    ACTION_UP = 1
    ACTION_MOVE = 2
    ACTION_CANCEL = 3
    ACTION_POINTER_DOWN = 5
    ACTION_POINTER_UP = 6

@dataclass
class InjectTouchData:
    """
    触摸注入数据
    参考: controlmsg.h:98-106
    """
    pointer_id: int                     # 触摸点ID [0-9] 或虚拟ID
    action: AndroidMotionEventAction    # 触摸动作
    action_buttons: int                 # 动作按钮
    buttons: int                        # 按钮状态
    x: int                              # X坐标
    y: int                              # Y坐标
    width: int                          # 屏幕宽度
    height: int                         # 屏幕高度
    pressure: float                     # 压力值

class ControlMsg:
    """
    控制消息
    参考: controlmsg.cpp
    """
    # 虚拟触摸点ID
    POINTER_ID_MOUSE = -1
    POINTER_ID_GENERIC_FINGER = -2
    POINTER_ID_VIRTUAL_MOUSE = -3
    POINTER_ID_VIRTUAL_FINGER = -4

    def __init__(self, msg_type: ControlMsgType):
        self.type = msg_type
        self.data = None

    def set_inject_touch_data(self, touch_data: InjectTouchData):
        """设置触摸注入数据"""
        self.data = touch_data

    def serialize(self) -> bytes:
        """
        序列化为二进制数据
        参考: controlmsg.cpp 序列化逻辑

        格式: [消息类型(1字节)][数据...]
        """
        buffer = bytearray()

        # 写入消息类型
        buffer.append(self.type.value)

        if self.type == ControlMsgType.INJECT_TOUCH:
            # 序列化触摸数据
            td: InjectTouchData = self.data

            # 触摸消息格式:
            # [type(1)] [action(1)] [pointer_id(8)] [x(4)] [y(4)]
            # [width(2)] [height(2)] [pressure(2)] [action_buttons(4)] [buttons(4)]

            buffer.append(td.action.value)
            buffer.extend(struct.pack('>Q', td.pointer_id & 0xFFFFFFFFFFFFFFFF))
            buffer.extend(struct.pack('>I', td.x))
            buffer.extend(struct.pack('>I', td.y))
            buffer.extend(struct.pack('>H', td.width))
            buffer.extend(struct.pack('>H', td.height))

            # 压力值转换为uint16 (0-65535)
            pressure_uint = int(td.pressure * 65535)
            buffer.extend(struct.pack('>H', pressure_uint))

            buffer.extend(struct.pack('>I', td.action_buttons))
            buffer.extend(struct.pack('>I', td.buttons))

        elif self.type == ControlMsgType.INJECT_KEYCODE:
            # 序列化按键数据
            # 格式: [type(1)] [action(1)] [keycode(4)] [repeat(4)] [metastate(4)]
            pass

        return bytes(buffer)
```

---

### 3.5 群控模块设计

```python
# core/group/group_controller.py
from PyQt6.QtCore import QObject
from typing import List, Optional

class GroupController(QObject):
    """
    群控管理器
    参考: groupcontroller.cpp

    设计模式: 单例 + 观察者

    功能:
    - 管理群控设备列表
    - 拦截主控设备操作
    - 广播到所有从属设备
    - 坐标映射与分辨率适配
    """
    _instance = None

    @classmethod
    def instance(cls):
        """单例模式"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self):
        super().__init__()
        self._devices: List[str] = []  # 设备序列号列表

    def add_device(self, serial: str):
        """
        添加设备到群组
        参考: groupcontroller.cpp:55-62
        """
        if serial not in self._devices:
            self._devices.append(serial)

    def remove_device(self, serial: str):
        """移除设备"""
        if serial in self._devices:
            self._devices.remove(serial)

    def update_device_state(self, serial: str):
        """
        更新设备状态
        参考: groupcontroller.cpp:37-53

        - 如果是主控设备: 注册为观察者
        - 如果是从属设备: 取消注册
        """
        if serial not in self._devices:
            return

        device = self._get_device(serial)
        if not device:
            return

        if self._is_host(serial):
            # 主控设备: 注册观察者
            device.register_observer(self)
        else:
            # 从属设备: 取消注册
            device.deregister_observer(self)

    def mouse_event(self, event, frame_size: tuple, show_size: tuple):
        """
        鼠标事件广播
        参考: groupcontroller.cpp:82-96

        关键技术:
        - 跳过主控设备
        - 使用各设备自己的frame_size
        - 共享show_size保证比例一致
        """
        for serial in self._devices:
            if self._is_host(serial):
                continue  # 跳过主控设备

            device = self._get_device(serial)
            if not device:
                continue

            # 使用从属设备自己的分辨率
            device_frame_size = self._get_frame_size(serial)
            device.mouse_event(event, device_frame_size, show_size)

    def key_event(self, event, frame_size: tuple, show_size: tuple):
        """
        按键事件广播
        参考: groupcontroller.cpp:114-128
        """
        for serial in self._devices:
            if self._is_host(serial):
                continue

            device = self._get_device(serial)
            if not device:
                continue

            device_frame_size = self._get_frame_size(serial)
            device.key_event(event, device_frame_size, show_size)

    def post_go_back(self):
        """
        返回键广播
        参考: groupcontroller.cpp:130-143
        """
        for serial in self._devices:
            if self._is_host(serial):
                continue

            device = self._get_device(serial)
            if device:
                device.post_go_back()

    def _is_host(self, serial: str) -> bool:
        """
        判断是否为主控设备
        参考: groupcontroller.cpp:11-19
        """
        device = self._get_device(serial)
        if not device:
            return True

        return device.is_host()

    def _get_frame_size(self, serial: str) -> tuple:
        """
        获取设备帧尺寸
        参考: groupcontroller.cpp:21-29
        """
        device = self._get_device(serial)
        if not device:
            return (0, 0)

        return device.get_frame_size()

    def _get_device(self, serial: str):
        """从DeviceManager获取设备对象"""
        from core.device.device_manager import DeviceManager
        return DeviceManager.instance().get_device(serial)
```

---

## 四、视频渲染技术

### 4.1 OpenGL YUV渲染

```python
# core/render/opengl_widget.py
from PyQt6.QtWidgets import QOpenGLWidget
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QSurfaceFormat
from OpenGL.GL import *
import numpy as np

class YUVOpenGLWidget(QOpenGLWidget):
    """
    OpenGL YUV渲染组件
    参考: qyuvopenglwidget.cpp

    功能:
    - 使用OpenGL着色器渲染YUV420
    - GPU执行YUV→RGB转换
    - 硬件加速提高性能
    """

    # YUV→RGB转换矩阵 (BT.601标准)
    YUV_MATRIX = np.array([
        [1.164,  0.000,  1.596],
        [1.164, -0.391, -0.813],
        [1.164,  2.018,  0.000]
    ], dtype=np.float32)

    def __init__(self, parent=None):
        super().__init__(parent)

        # 设置OpenGL格式
        fmt = QSurfaceFormat()
        fmt.setVersion(3, 3)
        fmt.setProfile(QSurfaceFormat.OpenGLContextProfile.CoreProfile)
        self.setFormat(fmt)

        self._program = None
        self._texture_y = None
        self._texture_u = None
        self._texture_v = None
        self._vao = None
        self._vbo = None

        self._frame_data = None
        self._frame_size = (0, 0)

    def initializeGL(self):
        """初始化OpenGL资源"""
        # 编译着色器程序
        self._program = self._create_shader_program()

        # 创建纹理
        self._texture_y = glGenTextures(1)
        self._texture_u = glGenTextures(1)
        self._texture_v = glGenTextures(1)

        # 创建顶点数组对象 (VAO)
        self._vao = glGenVertexArrays(1)
        glBindVertexArray(self._vao)

        # 创建顶点缓冲对象 (VBO)
        # 全屏四边形顶点: [x, y, u, v]
        vertices = np.array([
            -1.0, -1.0, 0.0, 1.0,  # 左下
             1.0, -1.0, 1.0, 1.0,  # 右下
            -1.0,  1.0, 0.0, 0.0,  # 左上
             1.0,  1.0, 1.0, 0.0   # 右上
        ], dtype=np.float32)

        self._vbo = glGenBuffers(1)
        glBindBuffer(GL_ARRAY_BUFFER, self._vbo)
        glBufferData(GL_ARRAY_BUFFER, vertices.nbytes, vertices, GL_STATIC_DRAW)

        # 设置顶点属性
        glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 16, ctypes.c_void_p(0))
        glEnableVertexAttribArray(0)
        glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 16, ctypes.c_void_p(8))
        glEnableVertexAttribArray(1)

        glBindVertexArray(0)

    def paintGL(self):
        """渲染帧"""
        if not self._frame_data:
            return

        glClearColor(0.0, 0.0, 0.0, 1.0)
        glClear(GL_COLOR_BUFFER_BIT)

        # 使用着色器程序
        glUseProgram(self._program)

        # 上传YUV纹理
        self._upload_yuv_texture()

        # 绑定纹理单元
        glActiveTexture(GL_TEXTURE0)
        glBindTexture(GL_TEXTURE_2D, self._texture_y)
        glActiveTexture(GL_TEXTURE1)
        glBindTexture(GL_TEXTURE_2D, self._texture_u)
        glActiveTexture(GL_TEXTURE2)
        glBindTexture(GL_TEXTURE_2D, self._texture_v)

        # 设置uniform
        glUniform1i(glGetUniformLocation(self._program, "tex_y"), 0)
        glUniform1i(glGetUniformLocation(self._program, "tex_u"), 1)
        glUniform1i(glGetUniformLocation(self._program, "tex_v"), 2)

        # 绘制四边形
        glBindVertexArray(self._vao)
        glDrawArrays(GL_TRIANGLE_STRIP, 0, 4)
        glBindVertexArray(0)

    def update_frame(self, width, height, data_y, data_u, data_v,
                    linesize_y, linesize_u, linesize_v):
        """
        更新帧数据
        从Decoder接收YUV420数据
        """
        self._frame_size = (width, height)
        self._frame_data = {
            'y': (data_y, linesize_y),
            'u': (data_u, linesize_u),
            'v': (data_v, linesize_v)
        }
        self.update()  # 触发重绘

    def _upload_yuv_texture(self):
        """上传YUV数据到GPU纹理"""
        width, height = self._frame_size
        data = self._frame_data

        # Y平面 (全分辨率)
        glBindTexture(GL_TEXTURE_2D, self._texture_y)
        glTexImage2D(GL_TEXTURE_2D, 0, GL_RED, width, height, 0,
                    GL_RED, GL_UNSIGNED_BYTE, data['y'][0])
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR)
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR)

        # U平面 (1/4分辨率)
        glBindTexture(GL_TEXTURE_2D, self._texture_u)
        glTexImage2D(GL_TEXTURE_2D, 0, GL_RED, width//2, height//2, 0,
                    GL_RED, GL_UNSIGNED_BYTE, data['u'][0])
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR)
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR)

        # V平面 (1/4分辨率)
        glBindTexture(GL_TEXTURE_2D, self._texture_v)
        glTexImage2D(GL_TEXTURE_2D, 0, GL_RED, width//2, height//2, 0,
                    GL_RED, GL_UNSIGNED_BYTE, data['v'][0])
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR)
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR)

    def _create_shader_program(self):
        """创建着色器程序"""
        # 顶点着色器
        vertex_shader = """
        #version 330 core
        layout(location = 0) in vec2 position;
        layout(location = 1) in vec2 texcoord;
        out vec2 v_texcoord;

        void main() {
            gl_Position = vec4(position, 0.0, 1.0);
            v_texcoord = texcoord;
        }
        """

        # 片段着色器 (YUV→RGB转换)
        fragment_shader = """
        #version 330 core
        in vec2 v_texcoord;
        out vec4 frag_color;

        uniform sampler2D tex_y;
        uniform sampler2D tex_u;
        uniform sampler2D tex_v;

        void main() {
            float y = texture(tex_y, v_texcoord).r;
            float u = texture(tex_u, v_texcoord).r - 0.5;
            float v = texture(tex_v, v_texcoord).r - 0.5;

            // YUV→RGB转换 (BT.601)
            float r = y + 1.13983 * v;
            float g = y - 0.39465 * u - 0.58060 * v;
            float b = y + 2.03211 * u;

            frag_color = vec4(r, g, b, 1.0);
        }
        """

        # 编译着色器...
        # (具体实现省略,使用OpenGL.GL.shaders)
        pass
```

---

## 五、使用示例

### 5.1 基本投屏示例

```python
# examples/basic_mirroring.py
from PyQt6.QtWidgets import QApplication
from core.device.device_manager import DeviceManager
from core.device.device_params import ServerParams
import sys

def main():
    app = QApplication(sys.argv)

    # 1. 获取设备管理器
    device_manager = DeviceManager.instance()

    # 2. 配置服务参数
    params = ServerParams(
        serial="ABC123DEF456",           # 设备序列号
        server_local_path="resources/scrcpy-server.jar",
        max_size=720,                    # 720p分辨率
        bit_rate=8000000,                # 8Mbps
        max_fps=60,                      # 60fps
        control=True,                    # 启用控制
        use_reverse=True                 # 使用reverse模式
    )

    # 3. 连接设备
    success = device_manager.connect_device(params)

    if success:
        print("设备连接成功")
    else:
        print("设备连接失败")
        return

    sys.exit(app.exec())

if __name__ == '__main__':
    main()
```

### 5.2 群控示例

```python
# examples/group_control.py
from core.group.group_controller import GroupController
from core.device.device_manager import DeviceManager

def setup_group_control():
    # 1. 设备列表
    devices = [
        "ABC123DEF456",  # 主控设备
        "GHI789JKL012",  # 从属设备1
        "MNO345PQR678"   # 从属设备2
    ]

    # 2. 添加到群组
    group_controller = GroupController.instance()
    for serial in devices:
        group_controller.add_device(serial)

    # 3. 设置主控设备
    host_device = DeviceManager.instance().get_device(devices[0])
    host_device.set_as_host(True)

    # 4. 更新所有设备状态
    for serial in devices:
        group_controller.update_device_state(serial)

    print("群控配置完成")
    print(f"主控设备: {devices[0]}")
    print(f"从属设备: {devices[1:]}")

if __name__ == '__main__':
    setup_group_control()
```

---

## 六、关键技术对比

### 6.1 C++ vs Python 实现对比

| 技术点 | C++ (SmartMatrix) | Python (pyMatrix) |
|--------|-------------------|-------------------|
| **ADB通信** | QProcess | subprocess |
| **视频解码** | FFmpeg C API | PyAV (FFmpeg绑定) |
| **渲染** | QOpenGLWidget | PyQt6 + PyOpenGL |
| **线程** | QThread | threading |
| **信号槽** | Qt signals/slots | PyQt6 signals/slots |
| **性能** | 编译优化,更快 | 解释执行,较慢 |
| **开发效率** | 较低 | 较高 |
| **部署** | 需编译 | 无需编译 |
| **扩展性** | 静态类型 | 动态类型,更灵活 |

---

## 七、性能优化建议

### 7.1 多线程优化

```python
# 独立线程模型
# - 主线程: GUI渲染
# - Demuxer线程: 视频流解复用
# - Decoder线程池: 多设备并行解码
# - Network线程: Socket通信

from concurrent.futures import ThreadPoolExecutor

class DeviceManager:
    def __init__(self):
        self._decoder_pool = ThreadPoolExecutor(max_workers=10)
```

### 7.2 内存优化

```python
# 使用numpy.array共享内存
# 避免数据拷贝

import numpy as np

class VideoBuffer:
    def __init__(self, size):
        self._buffer = np.zeros(size, dtype=np.uint8)

    def update(self, data):
        # 原地更新,避免分配新内存
        np.copyto(self._buffer, data)
```

### 7.3 GIL限制应对

```python
# Python的GIL会影响多线程性能
# 解决方案:
# 1. 使用C扩展 (Cython)
# 2. 使用多进程 (multiprocessing)
# 3. I/O密集型任务用asyncio

import asyncio

async def async_demux():
    # 异步I/O避免GIL阻塞
    pass
```

---

## 八、开发路线图

### Phase 1: 核心功能 (4周)
- [x] 项目架构设计
- [ ] ADB通信模块 (1周)
- [ ] 服务端启动流程 (1周)
- [ ] 视频流处理 (Demuxer + Decoder) (1周)
- [ ] 基础渲染 (OpenGL) (1周)

### Phase 2: 控制功能 (3周)
- [ ] 控制消息协议 (1周)
- [ ] 输入转换器 (鼠标/键盘) (1周)
- [ ] 按键映射系统 (1周)

### Phase 3: 高级功能 (3周)
- [ ] 群控系统 (1周)
- [ ] 设备管理UI (1周)
- [ ] 配置系统 (1周)

### Phase 4: 优化与测试 (2周)
- [ ] 性能优化
- [ ] 单元测试
- [ ] 文档完善

---

## 九、参考资料

### 9.1 SmartMatrix C++ 源码

```
关键文件索引:
- adbprocess.cpp:34-37        # ADB命令执行
- server.cpp:55-62            # 推送服务端
- server.cpp:64-71            # Reverse模式
- server.cpp:111-223          # 启动服务端
- demuxer.cpp:43-80           # 视频流解复用
- decoder.cpp:27-56           # FFmpeg解码
- groupcontroller.cpp:82-96   # 群控鼠标事件
- controlmsg.cpp              # 控制消息序列化
```

### 9.2 技术文档

- [SmartMatrix技术分析文档.md](SmartMatrix技术分析文档.md)
- [SmartMatrix多设备群控技术补充文档.md](SmartMatrix多设备群控技术补充文档.md)
- [PyAV官方文档](https://pyav.org/)
- [PyQt6官方文档](https://www.riverbankcomputing.com/static/Docs/PyQt6/)

---

---

## 十、Web 前端支持 (Nuxt.js)

### 10.1 架构概述

pyMatrix 支持两种运行模式：

1. **桌面端模式**: PyQt6 GUI，本地运行，性能最优
2. **Web端模式**: Nuxt.js 前端 + FastAPI 后端，浏览器访问，部署灵活

### 10.2 Web 架构关键技术

| 技术点 | 方案 | 说明 |
|--------|------|------|
| **前端框架** | Nuxt 3 (Vue 3 + TypeScript) | SSR支持，SEO友好 |
| **后端API** | FastAPI + Socket.io | 高性能异步框架 |
| **视频流** | MSE (Media Source Extensions) | H.264硬解，低延迟 |
| **实时通信** | WebSocket | 设备状态同步，群控广播 |
| **多设备渲染** | Canvas Grid Layout | 网格布局，最多64设备同屏 |

### 10.3 视频流传输方案

```
Android (H.264) → Python Backend (PyAV封装fMP4)
                ↓
            WebSocket Binary Stream
                ↓
        Browser MSE API → <video> 硬解播放
```

**延迟对比**：
- 桌面端: 30-70ms
- Web端 MSE: 100-300ms
- Web端 WebRTC: 50-150ms (可选方案)

### 10.4 群控实现差异

**桌面端 (Qt)**：
```python
# 直接调用
group_controller.mouse_event(qt_event, frame_size, show_size)
```

**Web端 (Nuxt)**：
```typescript
// WebSocket广播
socket.emit('control:mouse', {
  hostSerial: 'ABC123',
  x: 100, y: 200,
  type: 'down'
})
```

```python
# 后端处理
@sio.event
async def control_mouse(sid, data):
    # 坐标映射
    # 广播到群组所有设备
    await ws_handler.on_mouse_event(sid, data)
```

### 10.5 详细文档

完整的 Web 架构设计请参考：

📄 **[pyMatrix_Web架构设计.md](./pyMatrix_Web架构设计.md)**

包含内容：
- 三层架构详解
- FastAPI 后端实现
- Nuxt.js 前端组件
- MSE 视频流技术
- 多设备群控 WebSocket 实现
- Docker 部署方案

---

## 十一、双模式对比

### 11.1 功能对比矩阵

| 功能 | 桌面端 (PyQt6) | Web端 (Nuxt.js) |
|------|----------------|-----------------|
| **投屏延迟** | ⭐⭐⭐⭐⭐ (30-70ms) | ⭐⭐⭐⭐ (100-300ms) |
| **群控支持** | ✅ 完整支持 | ✅ 完整支持 |
| **多用户协作** | ❌ 单机单用户 | ✅ 多用户同时访问 |
| **部署难度** | ⭐⭐⭐ (需安装) | ⭐⭐⭐⭐⭐ (浏览器即用) |
| **跨平台** | ✅ Win/Mac/Linux | ✅ 任意浏览器 |
| **性能** | ⭐⭐⭐⭐⭐ (原生) | ⭐⭐⭐⭐ (MSE硬解) |
| **设备数量** | 最多500+ (OTG模式) | 建议64设备 (网格显示) |
| **录屏功能** | ✅ 本地录制 | ✅ 服务端录制 |
| **按键映射** | ✅ 游戏模式 | ✅ 游戏模式 |
| **开发效率** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

### 11.2 使用场景推荐

**桌面端适用场景**：
- 单用户个人使用
- 对延迟要求极高 (游戏、实时交互)
- 大规模设备测试 (100+设备)
- 离线环境使用

**Web端适用场景**：
- 团队协作 (多人同时控制不同设备)
- 远程设备管理
- 设备展示 (展会、演示)
- 云端部署 (SaaS服务)

### 11.3 混合部署架构

```
                    用户A (桌面端)
                         ↓
                    PyQt6 GUI
                         ↓
    ┌────────────────────┼────────────────────┐
    │                                          │
    │          pyMatrix Core (共享)            │
    │    - Device Manager                     │
    │    - Group Controller                   │
    │    - ADB Communication                  │
    │                                          │
    └────────────────────┬────────────────────┘
                         │
                         ├─────────────────────┐
                         ▼                     ▼
                  FastAPI Backend    用户B/C/D (Web端)
                         │                     ↓
                         │               Nuxt.js Frontend
                         │                     ↓
                         └─────────────────────┘
                               WebSocket
```

**优势**：
- 桌面端用户享受低延迟
- Web端用户远程访问
- 共享设备池和群控逻辑

---

## 十二、完整技术栈总结

### 12.1 Python 核心层

```python
# 核心依赖
PyQt6==6.6.1              # 桌面GUI (可选)
FastAPI==0.104.1          # Web后端 (可选)
PyAV==11.0.0              # 视频编解码 (必需)
numpy==1.24.4             # 数值计算 (必需)
opencv-python==4.8.1      # 图像处理 (必需)
adb-shell==0.4.4          # ADB通信 (必需)
python-socketio==5.10.0   # WebSocket (Web模式)
aiortc==1.6.0             # WebRTC (可选)
```

### 12.2 Web 前端层

```json
{
  "dependencies": {
    "nuxt": "^3.8.0",
    "vue": "^3.3.8",
    "typescript": "^5.2.2",
    "element-plus": "^2.4.3",
    "socket.io-client": "^4.7.2",
    "@vueuse/core": "^10.6.1",
    "pinia": "^2.1.7"
  }
}
```

---

**文档版本**: 1.0
**创建时间**: 2025-10-30
**技术栈**: Python 3.11+ / PyQt6 / PyAV / OpenGL / Nuxt 3 / FastAPI
**参考项目**: SmartMatrix (C++/Qt)

---

## 附录

### A. 文档索引

1. **本文档** - 核心技术方案 (桌面端为主)
2. **[pyMatrix_Web架构设计.md](./pyMatrix_Web架构设计.md)** - Web前端完整方案
3. **[SmartMatrix技术分析文档.md](../SmartMatrix/SmartMatrix技术分析文档.md)** - C++原版分析
4. **[SmartMatrix多设备群控技术补充文档.md](../SmartMatrix/SmartMatrix多设备群控技术补充文档.md)** - 群控技术细节

### B. 快速开始

**桌面端运行**:
```bash
pip install -r requirements.txt
python main.py
```

**Web端运行**:
```bash
# 后端
pip install -r requirements.txt -r requirements-web.txt
python main.py --mode web

# 前端 (另一个终端)
cd pyMatrix-web
npm install
npm run dev
```

### C. API文档

Web模式下，访问 `http://localhost:8000/docs` 查看自动生成的 Swagger API 文档。
