# pyMatrix 核心库分离架构设计

> **设计原则**：参考 `pycore/PYCORE_CONSISTENCY_REPORT.md` 的核心库设计理念
>
> **目标**：将通用功能提取到 `pycore/`，业务逻辑保留在 `poly_apps/pyMatrix/`

**日期**：2025-10-30
**版本**：2.0（核心库分离版）

---

## 📋 目录

1. [核心设计原则](#核心设计原则)
2. [依赖关系规则](#依赖关系规则)
3. [模块划分](#模块划分)
4. [pycore 核心库部分](#pycore-核心库部分)
5. [poly_apps/pyMatrix 应用部分](#poly_appspymatrix-应用部分)
6. [迁移计划](#迁移计划)
7. [代码示例](#代码示例)

---

## 🎯 核心设计原则

参考 `pycore/PYCORE_CONSISTENCY_REPORT.md`，我们遵循以下原则：

### ✅ pycore 核心库原则

1. **完全独立**
   - 不依赖任何 `apps/` 或 `poly_apps/` 的代码
   - 只依赖标准库和第三方库（如 `av`, `numpy`, `opencv`）
   - 可以被任何项目复用

2. **高内聚低耦合**
   - 每个模块职责单一
   - 模块间通过明确的接口通信
   - 使用抽象基类（ABC）定义接口

3. **零配置启动**
   - 不依赖外部配置文件
   - 所有参数通过函数/类参数传递
   - 提供合理的默认值

4. **可测试性**
   - 纯函数优先
   - 依赖注入模式
   - 提供 mock 工具

---

### ✅ poly_apps 应用原则

1. **业务逻辑集中**
   - FastAPI 路由和服务
   - WebSocket 会话管理
   - 前端集成
   - 启动器和配置

2. **依赖 pycore**
   ```python
   # ✅ 应用可以引用核心库
   from pycore.pyadb.adb_manager import ADBManager
   from pycore.pystream.video_processor import H264ToFMP4Processor
   ```

3. **项目特定配置**
   - 端口、路径等配置
   - Nuxt 编译产物
   - Docker 部署脚本

---

## 🔗 依赖关系规则

```
┌─────────────────────────────────────────────┐
│  第三方库                                    │
│  - PyAV (av)                                │
│  - OpenCV (cv2)                             │
│  - NumPy                                    │
│  - FastAPI（仅 pycore.pyapi 使用）          │
└──────────────┬──────────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────────┐
│  pycore/                                    │
│  ├── pyfoundations/   (基础工具)            │
│  ├── pygvar/          (全局变量)            │
│  ├── pyadb/           (ADB 通信) ✨ 新增     │
│  ├── pystream/        (视频流处理) ✨ 新增   │
│  ├── pydevice/        (设备抽象) ✨ 新增     │
│  ├── pycontrol/       (控制协议) ✨ 新增     │
│  ├── pygroup/         (群控算法) ✨ 新增     │
│  └── pyapi/           (FastAPI 工具) ✨ 新增 │
└──────────────┬──────────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────────┐
│  poly_apps/pyMatrix/                        │
│  ├── api/             (FastAPI 路由)        │
│  ├── services/        (业务服务)            │
│  ├── launcher/        (启动器)              │
│  ├── pyMatrix-web/    (Nuxt 前端)           │
│  ├── main.py          (入口)                │
│  └── config.py        (配置)                │
└─────────────────────────────────────────────┘
```

### 依赖规则总结

| 从 ↓ 到 → | 标准库 | 第三方库 | pycore | poly_apps |
|-----------|-------|---------|--------|-----------|
| **pycore** | ✅ | ✅ | ✅ (内部) | ❌ |
| **poly_apps** | ✅ | ✅ | ✅ | ✅ (内部) |

---

## 📦 模块划分

### 核心库部分（移至 pycore）

| 模块 | 位置 | 职责 | 对外接口 |
|------|------|------|---------|
| **pyadb** | `pycore/pyadb/` | ADB 命令封装 | `ADBManager`, `ADBDevice` |
| **pystream** | `pycore/pystream/` | 视频流处理 | `VideoDecoder`, `FMP4Encoder` |
| **pydevice** | `pycore/pydevice/` | 设备抽象 | `AndroidDevice`, `DeviceInfo` |
| **pycontrol** | `pycore/pycontrol/` | 控制协议 | `ControlMessage`, `TouchEvent` |
| **pygroup** | `pycore/pygroup/` | 群控算法 | `GroupController`, `SyncStrategy` |
| **pyapi** | `pycore/pyapi/` | FastAPI 工具 | `WebSocketManager`, `VideoStreamRoute` |

---

### 应用部分（保留在 poly_apps/pyMatrix）

| 模块 | 位置 | 职责 | 依赖 |
|------|------|------|------|
| **api** | `poly_apps/pyMatrix/api/` | 路由定义 | pycore.pyapi |
| **services** | `poly_apps/pyMatrix/services/` | 业务逻辑 | pycore.* |
| **launcher** | `poly_apps/pyMatrix/launcher/` | 启动器 | pycore.pyadb |
| **pyMatrix-web** | `poly_apps/pyMatrix/pyMatrix-web/` | 前端 | 无 |
| **resources** | `poly_apps/pyMatrix/resources/` | 资源文件 | 无 |

---

## 🔧 pycore 核心库部分

### 1. pyadb - ADB 通信模块

**位置**: `D:\programing\core_node\pycore\pyadb\`

#### 文件结构
```
pycore/pyadb/
├── __init__.py
├── adb_manager.py          # ADB 管理器
├── adb_device.py           # 设备对象
├── adb_types.py            # 类型定义
└── adb_commands.py         # 命令封装
```

#### 核心类
```python
from typing import List, Optional
from dataclasses import dataclass
import subprocess

@dataclass
class ADBDevice:
    """ADB 设备信息"""
    serial: str
    model: str
    state: str  # 'device', 'offline', 'unauthorized'

class ADBManager:
    """ADB 管理器（无状态工具类）"""

    @staticmethod
    def list_devices() -> List[ADBDevice]:
        """列出所有设备"""
        pass

    @staticmethod
    def push_file(serial: str, local_path: str, remote_path: str) -> bool:
        """推送文件到设备"""
        pass

    @staticmethod
    def execute_shell(serial: str, command: str) -> str:
        """执行 shell 命令"""
        pass

    @staticmethod
    def forward_port(serial: str, local_port: int, remote_port: int):
        """端口转发"""
        pass
```

**依赖**：
- ✅ 标准库：`subprocess`, `typing`, `dataclasses`
- ✅ 第三方库：无
- ❌ 不依赖 poly_apps

---

### 2. pystream - 视频流处理模块

**位置**: `D:\programing\core_node\pycore\pystream\`

#### 文件结构
```
pycore/pystream/
├── __init__.py
├── video_decoder.py        # H.264 解码器
├── fmp4_encoder.py         # fMP4 编码器
├── stream_demuxer.py       # 流分离器
└── video_types.py          # 类型定义
```

#### 核心类
```python
import av
import numpy as np
from abc import ABC, abstractmethod
from typing import Generator, Optional

class VideoDecoder(ABC):
    """视频解码器抽象基类"""

    @abstractmethod
    def decode(self, data: bytes) -> Generator[np.ndarray, None, None]:
        """解码视频数据，返回帧生成器"""
        pass

class H264Decoder(VideoDecoder):
    """H.264 解码器（PyAV 实现）"""

    def __init__(self):
        self.container: Optional[av.container.Container] = None
        self.codec_ctx: Optional[av.codec.context.CodecContext] = None

    def decode(self, data: bytes) -> Generator[np.ndarray, None, None]:
        """解码 H.264 数据"""
        # PyAV 零拷贝解码
        packet = av.Packet(data)
        frames = self.codec_ctx.decode(packet)

        for frame in frames:
            yuv_array = frame.to_ndarray(format='yuv420p')
            yield yuv_array

class FMP4Encoder:
    """fMP4 编码器（浏览器 MSE 兼容）"""

    def __init__(self, width: int, height: int, fps: int = 30):
        self.width = width
        self.height = height
        self.fps = fps
        self._init_encoder()

    def encode(self, yuv_frame: np.ndarray) -> bytes:
        """将 YUV 帧编码为 fMP4 片段"""
        pass

    def get_init_segment(self) -> bytes:
        """获取 fMP4 初始化片段（发送一次）"""
        pass
```

**依赖**：
- ✅ 标准库：`abc`, `typing`
- ✅ 第三方库：`av` (PyAV), `numpy`
- ❌ 不依赖 poly_apps

---

### 3. pydevice - 设备抽象模块

**位置**: `D:\programing\core_node\pycore\pydevice\`

#### 文件结构
```
pycore/pydevice/
├── __init__.py
├── android_device.py       # Android 设备抽象
├── device_info.py          # 设备信息
└── server_params.py        # 服务器参数
```

#### 核心类
```python
from dataclasses import dataclass
from typing import Optional
from abc import ABC, abstractmethod

@dataclass
class DeviceInfo:
    """设备信息"""
    serial: str
    model: str
    width: int
    height: int
    dpi: int
    android_version: str

@dataclass
class ServerParams:
    """scrcpy-server 参数"""
    max_size: int = 720
    bit_rate: int = 8000000
    max_fps: int = 60
    codec: str = 'h264'
    control: bool = True

class AndroidDevice(ABC):
    """Android 设备抽象"""

    def __init__(self, serial: str, params: ServerParams):
        self.serial = serial
        self.params = params
        self.info: Optional[DeviceInfo] = None

    @abstractmethod
    def start_server(self) -> int:
        """启动 scrcpy-server，返回本地端口"""
        pass

    @abstractmethod
    def stop_server(self):
        """停止服务器"""
        pass

    @abstractmethod
    def get_video_socket(self) -> int:
        """获取视频流 socket"""
        pass

    @abstractmethod
    def get_control_socket(self) -> int:
        """获取控制 socket"""
        pass
```

**依赖**：
- ✅ 标准库：`dataclasses`, `typing`, `abc`
- ✅ pycore 内部：`pyadb`
- ❌ 不依赖 poly_apps

---

### 4. pycontrol - 控制协议模块

**位置**: `D:\programing\core_node\pycore\pycontrol\`

#### 文件结构
```
pycore/pycontrol/
├── __init__.py
├── control_message.py      # 控制消息基类
├── touch_event.py          # 触摸事件
├── key_event.py            # 按键事件
├── coordinate_mapper.py    # 坐标映射
└── message_parser.py       # 消息解析器
```

#### 核心类
```python
from dataclasses import dataclass
from enum import Enum
from typing import Tuple

class TouchAction(Enum):
    DOWN = 0
    UP = 1
    MOVE = 2

@dataclass
class TouchEvent:
    """触摸事件"""
    action: TouchAction
    x: int
    y: int
    pressure: float = 1.0
    pointer_id: int = 0

class CoordinateMapper:
    """坐标映射器（分辨率适配）"""

    @staticmethod
    def map(
        x: int, y: int,
        from_width: int, from_height: int,
        to_width: int, to_height: int
    ) -> Tuple[int, int]:
        """映射坐标"""
        mapped_x = int(x * to_width / from_width)
        mapped_y = int(y * to_height / from_height)
        return mapped_x, mapped_y

class MessageParser:
    """scrcpy 控制消息解析器"""

    @staticmethod
    def parse_touch(event: TouchEvent) -> bytes:
        """将触摸事件转换为 scrcpy 协议"""
        # 参考 scrcpy 的控制协议格式
        pass

    @staticmethod
    def parse_keycode(keycode: int, action: int) -> bytes:
        """将按键事件转换为 scrcpy 协议"""
        pass
```

**依赖**：
- ✅ 标准库：`dataclasses`, `enum`, `typing`
- ❌ 不依赖 poly_apps

---

### 5. pygroup - 群控算法模块

**位置**: `D:\programing\core_node\pycore\pygroup\`

#### 文件结构
```
pycore/pygroup/
├── __init__.py
├── group_controller.py     # 群控控制器
├── sync_strategy.py        # 同步策略
└── event_broadcaster.py    # 事件广播器
```

#### 核心类
```python
from typing import Set, Optional, Callable
from abc import ABC, abstractmethod

class SyncStrategy(ABC):
    """同步策略抽象"""

    @abstractmethod
    def should_sync(self, master_serial: str, slave_serial: str) -> bool:
        """判断是否应该同步"""
        pass

class AllSyncStrategy(SyncStrategy):
    """全部同步策略（所有从设备跟随主设备）"""

    def should_sync(self, master_serial: str, slave_serial: str) -> bool:
        return True

class GroupController:
    """群控控制器（无状态，不依赖 WebSocket）"""

    def __init__(self, strategy: SyncStrategy = None):
        self.strategy = strategy or AllSyncStrategy()
        self.master_device: Optional[str] = None
        self.slave_devices: Set[str] = set()

    def set_master(self, serial: str):
        """设置主控设备"""
        self.master_device = serial
        self.slave_devices.discard(serial)

    def add_slave(self, serial: str):
        """添加从设备"""
        if serial != self.master_device:
            self.slave_devices.add(serial)

    def get_sync_targets(self, event_from: str) -> Set[str]:
        """获取需要同步的目标设备"""
        if event_from != self.master_device:
            return set()

        return {
            slave for slave in self.slave_devices
            if self.strategy.should_sync(self.master_device, slave)
        }
```

**依赖**：
- ✅ 标准库：`typing`, `abc`
- ❌ 不依赖 WebSocket（由应用层处理）
- ❌ 不依赖 poly_apps

---

### 6. pyapi - FastAPI 工具模块

**位置**: `D:\programing\core_node\pycore\pyapi\`

#### 文件结构
```
pycore/pyapi/
├── __init__.py
├── websocket_manager.py    # WebSocket 管理器
├── video_route.py          # 视频流路由基类
└── api_types.py            # API 类型定义
```

#### 核心类
```python
from fastapi import WebSocket
from typing import Dict, Set, Optional, Callable
import asyncio

class WebSocketManager:
    """WebSocket 连接管理器（通用工具）"""

    def __init__(self):
        self._connections: Dict[str, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, key: str, websocket: WebSocket):
        """添加连接"""
        await websocket.accept()
        async with self._lock:
            if key not in self._connections:
                self._connections[key] = set()
            self._connections[key].add(websocket)

    async def disconnect(self, key: str, websocket: WebSocket):
        """移除连接"""
        async with self._lock:
            if key in self._connections:
                self._connections[key].discard(websocket)
                if not self._connections[key]:
                    del self._connections[key]

    async def broadcast(self, key: str, data: bytes):
        """广播数据到所有连接"""
        if key not in self._connections:
            return

        disconnected = set()
        for ws in self._connections[key]:
            try:
                await ws.send_bytes(data)
            except Exception:
                disconnected.add(ws)

        # 清理断开的连接
        for ws in disconnected:
            await self.disconnect(key, ws)

    def get_connections(self, key: str) -> int:
        """获取连接数"""
        return len(self._connections.get(key, set()))
```

**依赖**：
- ✅ 标准库：`typing`, `asyncio`
- ✅ 第三方库：`fastapi`
- ❌ 不依赖具体业务逻辑
- ❌ 不依赖 poly_apps

---

## 🚀 poly_apps/pyMatrix 应用部分

### 目录结构

```
poly_apps/pyMatrix/
├── api/                                # FastAPI 路由
│   ├── __init__.py
│   ├── device_routes.py                # 设备管理路由
│   ├── video_routes.py                 # 视频流路由
│   ├── control_routes.py               # 控制路由
│   └── group_routes.py                 # 群控路由
├── services/                           # 业务服务
│   ├── __init__.py
│   ├── device_service.py               # 设备管理服务
│   ├── video_service.py                # 视频流服务
│   ├── control_service.py              # 控制服务
│   └── group_service.py                # 群控服务
├── launcher/                           # 启动器
│   ├── __init__.py
│   ├── tkinter_launcher.py             # Tkinter 启动器
│   └── pyqt_launcher.py                # PyQt6 最小启动器
├── pyMatrix-web/                       # Nuxt 前端
│   ├── components/
│   ├── composables/
│   ├── pages/
│   ├── stores/
│   └── nuxt.config.ts
├── resources/                          # 资源文件
│   ├── adb/
│   │   └── windows/
│   │       ├── adb.exe
│   │       └── AdbWinApi.dll
│   └── scrcpy-server.jar
├── static/                             # Nuxt 编译输出
├── config.py                           # 配置文件
├── main.py                             # 程序入口
├── build_and_integrate.py              # 编译脚本
└── requirements.txt                    # 依赖清单
```

---

### 应用层代码示例

#### 1. main.py（入口）

```python
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
import uvicorn
from pathlib import Path

# ✅ 引用 pycore
from pycore.pyadb import ADBManager
from pycore.pyapi import WebSocketManager

# ✅ 引用本地模块
from api import device_routes, video_routes, control_routes, group_routes
from services import DeviceService, VideoStreamService
from config import Config

app = FastAPI(title="pyMatrix API")

# 初始化服务
device_service = DeviceService()
video_service = VideoStreamService()

# 注册路由
app.include_router(device_routes.router, prefix="/api")
app.include_router(video_routes.router, prefix="/api")
app.include_router(control_routes.router, prefix="/api")
app.include_router(group_routes.router, prefix="/api")

# 静态文件（Nuxt 编译产物）
static_dir = Path(__file__).parent / "static"
if static_dir.exists():
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

if __name__ == '__main__':
    # 检查 ADB
    devices = ADBManager.list_devices()
    print(f"发现 {len(devices)} 个设备")

    # 启动服务
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

---

#### 2. services/device_service.py（业务服务）

```python
from typing import List, Dict, Optional
from pathlib import Path

# ✅ 引用 pycore
from pycore.pyadb import ADBManager, ADBDevice
from pycore.pydevice import AndroidDevice, DeviceInfo, ServerParams
from pycore.pystream import H264Decoder, FMP4Encoder

class DeviceService:
    """设备管理服务（有状态，管理设备实例）"""

    def __init__(self, resources_dir: Path):
        self.resources_dir = resources_dir
        self.scrcpy_server_path = resources_dir / "scrcpy-server.jar"
        self.devices: Dict[str, AndroidDevice] = {}

    def list_devices(self) -> List[ADBDevice]:
        """列出所有 ADB 设备"""
        return ADBManager.list_devices()

    def connect_device(self, serial: str, params: ServerParams) -> DeviceInfo:
        """连接设备并启动 scrcpy-server"""
        # 1. 推送 scrcpy-server
        ADBManager.push_file(
            serial,
            str(self.scrcpy_server_path),
            "/data/local/tmp/scrcpy-server.jar"
        )

        # 2. 创建设备实例
        device = AndroidDevice(serial, params)
        local_port = device.start_server()

        # 3. 保存设备
        self.devices[serial] = device

        return device.info

    def disconnect_device(self, serial: str):
        """断开设备"""
        if serial in self.devices:
            self.devices[serial].stop_server()
            del self.devices[serial]

    def get_device(self, serial: str) -> Optional[AndroidDevice]:
        """获取设备实例"""
        return self.devices.get(serial)
```

---

#### 3. api/video_routes.py（路由）

```python
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi import Depends

# ✅ 引用 pycore
from pycore.pyapi import WebSocketManager
from pycore.pystream import H264Decoder, FMP4Encoder

# ✅ 引用本地服务
from services.video_stream_service import VideoStreamService

router = APIRouter()
ws_manager = WebSocketManager()

# 依赖注入
def get_video_service() -> VideoStreamService:
    return VideoStreamService.instance()

@router.websocket("/ws/video/{serial}")
async def video_stream(
    websocket: WebSocket,
    serial: str,
    video_service: VideoStreamService = Depends(get_video_service)
):
    """视频流 WebSocket"""
    await ws_manager.connect(serial, websocket)

    try:
        # 发送 fMP4 初始化片段
        init_segment = video_service.get_init_segment(serial)
        await websocket.send_bytes(init_segment)

        # 订阅视频流
        async for fmp4_chunk in video_service.subscribe(serial):
            await websocket.send_bytes(fmp4_chunk)

    except WebSocketDisconnect:
        await ws_manager.disconnect(serial, websocket)
```

---

## 🔄 迁移计划

### 阶段 1：创建 pycore 核心库（1-2 天）

#### 任务清单

- [ ] **创建目录结构**
  ```bash
  mkdir -p pycore/pyadb
  mkdir -p pycore/pystream
  mkdir -p pycore/pydevice
  mkdir -p pycore/pycontrol
  mkdir -p pycore/pygroup
  mkdir -p pycore/pyapi
  ```

- [ ] **实现核心模块**
  - [ ] `pyadb/adb_manager.py` - ADB 命令封装
  - [ ] `pystream/video_decoder.py` - H.264 解码
  - [ ] `pystream/fmp4_encoder.py` - fMP4 编码
  - [ ] `pydevice/android_device.py` - 设备抽象
  - [ ] `pycontrol/coordinate_mapper.py` - 坐标映射
  - [ ] `pygroup/group_controller.py` - 群控算法
  - [ ] `pyapi/websocket_manager.py` - WebSocket 管理

- [ ] **单元测试**
  ```bash
  pycore/tests/
  ├── test_adb_manager.py
  ├── test_video_decoder.py
  ├── test_coordinate_mapper.py
  └── test_group_controller.py
  ```

---

### 阶段 2：调整 pyMatrix 应用层（1 天）

- [ ] **重构导入语句**
  ```python
  # 修改前
  from core.adb.adb_process import ADBManager

  # 修改后
  from pycore.pyadb import ADBManager
  ```

- [ ] **创建服务层**
  - [ ] `services/device_service.py`
  - [ ] `services/video_service.py`
  - [ ] `services/control_service.py`
  - [ ] `services/group_service.py`

- [ ] **重构路由**
  - [ ] `api/device_routes.py`
  - [ ] `api/video_routes.py`
  - [ ] `api/control_routes.py`
  - [ ] `api/group_routes.py`

---

### 阶段 3：集成测试（0.5 天）

- [ ] **测试场景**
  - [ ] 单设备连接 + 视频流播放
  - [ ] 多设备（5 台）并发连接
  - [ ] 群控功能（1 主 + 4 从）
  - [ ] 长时间运行稳定性（30 分钟）

- [ ] **性能测试**
  - [ ] 内存占用（100 设备场景）
  - [ ] 延迟测试（P50, P99）
  - [ ] CPU 占用率

---

## 📝 代码示例对比

### 迁移前（旧架构）

```python
# poly_apps/pyMatrix/core/adb/adb_process.py
class ADBProcess:
    def __init__(self):
        self.adb_path = "D:/programing/core_node/poly_apps/pyMatrix/resources/adb/adb.exe"

    def list_devices(self):
        result = subprocess.run([self.adb_path, 'devices'], ...)
        return result

# poly_apps/pyMatrix/core/device/device_manager.py
from core.adb.adb_process import ADBProcess  # ❌ 紧耦合

class DeviceManager:
    def __init__(self):
        self.adb = ADBProcess()  # ❌ 硬编码依赖
```

**问题**：
- ❌ ADB 路径硬编码
- ❌ 无法在其他项目中复用
- ❌ 难以单元测试

---

### 迁移后（新架构）

```python
# pycore/pyadb/adb_manager.py
class ADBManager:
    """ADB 管理器（无状态，纯工具）"""

    @staticmethod
    def list_devices(adb_path: str = "adb") -> List[ADBDevice]:
        """列出设备（可指定 adb 路径）"""
        result = subprocess.run([adb_path, 'devices'], ...)
        return ADBManager._parse_devices(result.stdout)

# poly_apps/pyMatrix/services/device_service.py
from pycore.pyadb import ADBManager  # ✅ 引用核心库
from config import Config  # ✅ 配置在应用层

class DeviceService:
    def __init__(self):
        self.adb_path = Config.get_adb_path()  # ✅ 依赖注入

    def list_devices(self):
        return ADBManager.list_devices(self.adb_path)  # ✅ 参数传递
```

**优势**：
- ✅ pycore 完全独立，可在其他项目中复用
- ✅ 配置在应用层，核心库零配置
- ✅ 易于测试（mock adb_path）

---

## 🎯 核心优势总结

### 对开发者

1. **代码复用**
   - pycore 可用于其他 Android 设备控制项目
   - 不同前端（PyQt6/Nuxt/Flutter）可共享核心库

2. **易于测试**
   - 核心库纯函数优先
   - 无状态工具类易于单元测试
   - Mock 友好

3. **清晰的职责分离**
   - 核心库：纯算法和协议
   - 应用层：业务逻辑和 UI

---

### 对项目

1. **可维护性提升**
   - 核心库稳定，应用层灵活
   - Bug 修复在核心库，所有项目受益

2. **扩展性强**
   - 添加新功能（如录屏）只需扩展核心库
   - 应用层无需大改

3. **部署灵活**
   - 核心库可打包为独立 wheel
   - 应用层只需 `pip install pycore-android`

---

## 📚 参考文档

- `pycore/PYCORE_CONSISTENCY_REPORT.md` - pycore 设计原则
- `05_COMMUNICATION_SPECIFICATION.md` - 通信协议
- `06_WEB_ARCHITECTURE_SIMPLIFIED.md` - Web 端架构
- `07_PYTHON_VS_NODE_PERFORMANCE_ANALYSIS.md` - 技术选型

---

## 🔗 相关资源

- **pycore 示例**：
  - `pycore/pyutils/ultralytics/` - 参考模块结构
  - `pycore/pyfoundations/` - 参考工具库设计

- **单元测试示例**：
  - `pycore/tests/` - 测试规范

---

**文档版本**：1.0
**最后更新**：2025-10-30
**作者**：架构设计团队
