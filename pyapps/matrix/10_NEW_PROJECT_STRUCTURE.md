# pyMatrix 新项目结构（核心库分离版）

> **基于**：`08_CORE_LIBRARY_ARCHITECTURE.md` 的核心库分离架构
>
> **目标**：清晰展示新的目录结构和文件组织

**日期**：2025-10-30
**版本**：2.0（核心库分离）

---

## 📂 完整目录结构

```
D:\programing\core_node\
│
├── pycore/                                 # 核心库（通用）
│   ├── pyfoundations/                      # 基础工具（已有）
│   │   ├── __init__.py
│   │   ├── color_print.py
│   │   └── encyclopedia.py
│   │
│   ├── pygvar/                             # 全局变量（已有）
│   │   ├── __init__.py
│   │   └── global_var_manager.py
│   │
│   ├── pyutils/                            # 工具集合（已有）
│   │   ├── common/
│   │   ├── ultralytics/
│   │   └── [各种工具]
│   │
│   ├── pyadb/                              # ✨ ADB 通信（新增）
│   │   ├── __init__.py
│   │   ├── adb_manager.py                  # ADB 管理器
│   │   ├── adb_device.py                   # 设备信息
│   │   └── adb_exceptions.py               # 异常定义
│   │
│   ├── pystream/                           # ✨ 视频流处理（新增）
│   │   ├── __init__.py
│   │   ├── video_decoder.py                # 解码器抽象
│   │   ├── h264_decoder.py                 # H.264 解码
│   │   ├── fmp4_encoder.py                 # fMP4 编码
│   │   └── stream_types.py                 # 类型定义
│   │
│   ├── pydevice/                           # ✨ 设备抽象（新增）
│   │   ├── __init__.py
│   │   ├── device_info.py                  # 设备信息
│   │   ├── server_params.py                # scrcpy 参数
│   │   └── android_device.py               # Android 设备
│   │
│   ├── pycontrol/                          # ✨ 控制协议（新增）
│   │   ├── __init__.py
│   │   ├── touch_event.py                  # 触摸事件
│   │   ├── key_event.py                    # 按键事件
│   │   ├── coordinate_mapper.py            # 坐标映射
│   │   └── message_builder.py              # 消息构建器
│   │
│   ├── pygroup/                            # ✨ 群控算法（新增）
│   │   ├── __init__.py
│   │   └── group_controller.py             # 群控控制器
│   │
│   └── pyapi/                              # ✨ FastAPI 工具（新增）
│       ├── __init__.py
│       └── websocket_manager.py            # WebSocket 管理器
│
│
├── poly_apps/pyMatrix/                     # pyMatrix 应用
│   │
│   ├── api/                                # FastAPI 路由（应用层）
│   │   ├── __init__.py
│   │   ├── device_routes.py                # 设备管理 API
│   │   ├── video_routes.py                 # 视频流 API
│   │   ├── control_routes.py               # 控制 API
│   │   └── group_routes.py                 # 群控 API
│   │
│   ├── services/                           # 业务服务（应用层）
│   │   ├── __init__.py
│   │   ├── device_service.py               # 设备管理服务
│   │   ├── video_service.py                # 视频流服务
│   │   ├── control_service.py              # 控制服务
│   │   └── group_service.py                # 群控服务
│   │
│   ├── launcher/                           # 启动器（应用层）
│   │   ├── __init__.py
│   │   ├── tkinter_launcher.py             # Tkinter 启动器
│   │   └── pyqt_launcher.py                # PyQt6 最小启动器（可选）
│   │
│   ├── pyMatrix-web/                       # Nuxt 前端
│   │   ├── components/                     # Vue 组件
│   │   │   ├── DeviceCard.vue              # 设备卡片
│   │   │   ├── VideoPlayer.vue             # MSE 播放器
│   │   │   ├── ControlPanel.vue            # 控制面板
│   │   │   └── GroupControlPanel.vue       # 群控面板
│   │   │
│   │   ├── composables/                    # 组合式函数
│   │   │   ├── useWebSocket.ts             # WebSocket 钩子
│   │   │   ├── useDeviceControl.ts         # 设备控制
│   │   │   └── useGroupControl.ts          # 群控逻辑
│   │   │
│   │   ├── pages/                          # 页面
│   │   │   ├── index.vue                   # 首页（设备列表）
│   │   │   ├── device/[serial].vue         # 单设备页面
│   │   │   └── group.vue                   # 群控页面
│   │   │
│   │   ├── stores/                         # Pinia 状态
│   │   │   ├── device.ts                   # 设备状态
│   │   │   └── group.ts                    # 群控状态
│   │   │
│   │   ├── types/                          # TypeScript 类型
│   │   │   ├── device.ts
│   │   │   ├── control.ts
│   │   │   └── websocket.ts
│   │   │
│   │   ├── nuxt.config.ts                  # Nuxt 配置
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── static/                             # Nuxt 编译输出（生产模式）
│   │   ├── _nuxt/
│   │   ├── index.html
│   │   └── ...
│   │
│   ├── resources/                          # 资源文件
│   │   ├── adb/                            # ADB 可执行文件
│   │   │   ├── windows/
│   │   │   │   ├── adb.exe
│   │   │   │   ├── AdbWinApi.dll
│   │   │   │   └── AdbWinUsbApi.dll
│   │   │   ├── linux/
│   │   │   │   └── adb
│   │   │   └── macos/
│   │   │       └── adb
│   │   │
│   │   └── scrcpy-server.jar               # Android 服务端
│   │
│   ├── tests/                              # 测试（应用层）
│   │   ├── test_device_service.py
│   │   ├── test_video_service.py
│   │   └── test_api.py
│   │
│   ├── docs/                               # 文档
│   │   ├── 00_PROJECT_OVERVIEW.md
│   │   ├── 01_ARCHITECTURE_DESIGN.md
│   │   ├── 02_BACKEND_PYTHON_IMPLEMENTATION.md
│   │   ├── 03_FRONTEND_NUXT_IMPLEMENTATION.md
│   │   ├── 04_DEPLOYMENT_AND_INTEGRATION.md
│   │   ├── 05_COMMUNICATION_SPECIFICATION.md
│   │   ├── 06_WEB_ARCHITECTURE_SIMPLIFIED.md
│   │   ├── 07_PYTHON_VS_NODE_PERFORMANCE_ANALYSIS.md
│   │   ├── 08_CORE_LIBRARY_ARCHITECTURE.md      # ✨ 新增
│   │   ├── 09_PYCORE_MODULES_IMPLEMENTATION.md  # ✨ 新增
│   │   └── 10_NEW_PROJECT_STRUCTURE.md          # ✨ 当前文件
│   │
│   ├── config.py                           # 配置管理
│   ├── main.py                             # 程序入口
│   ├── build_and_integrate.py              # Nuxt 编译集成脚本
│   │
│   ├── requirements.txt                    # Python 依赖（基础）
│   ├── requirements-web.txt                # Web 模式额外依赖
│   ├── requirements-dev.txt                # 开发依赖
│   │
│   ├── docker-compose.yml                  # Docker 部署
│   ├── Dockerfile                          # Docker 镜像
│   │
│   ├── README.md                           # 项目说明（更新）
│   └── pyMatrix_tree.md                    # 项目树（更新）
│
│
└── development-guides/                     # 开发指南（参考）
    ├── PYCORE_CONSISTENCY_REPORT.md        # pycore 一致性报告
    └── NCORE_NUXT_INTEGRATION_GUIDE.md     # Nuxt 集成指南
```

---

## 🎯 目录职责说明

### pycore/ - 核心库（完全独立）

#### 特点：
- ✅ 不依赖 poly_apps
- ✅ 可在任何 Android 设备控制项目中复用
- ✅ 只依赖标准库和第三方库

#### 模块职责：

| 模块 | 职责 | 对外接口 |
|------|------|---------|
| **pyadb** | ADB 命令封装 | `ADBManager`, `ADBDevice` |
| **pystream** | 视频流处理 | `H264Decoder`, `FMP4Encoder` |
| **pydevice** | 设备抽象 | `AndroidDevice`, `DeviceInfo` |
| **pycontrol** | 控制协议 | `TouchEvent`, `CoordinateMapper` |
| **pygroup** | 群控算法 | `GroupController`, `SyncStrategy` |
| **pyapi** | FastAPI 工具 | `WebSocketManager` |

---

### poly_apps/pyMatrix/ - 应用层

#### 特点：
- ✅ 依赖 pycore
- ✅ 包含业务逻辑
- ✅ 包含 Web 服务和前端

#### 模块职责：

| 目录 | 职责 | 依赖 |
|------|------|------|
| **api/** | FastAPI 路由定义 | pycore.pyapi, services/ |
| **services/** | 业务逻辑和服务 | pycore.* |
| **launcher/** | 启动器（tkinter/PyQt6） | pycore.pyadb |
| **pyMatrix-web/** | Nuxt 前端 | 无（纯前端） |
| **resources/** | 资源文件（ADB、scrcpy） | 无 |
| **static/** | Nuxt 编译产物 | 无 |
| **tests/** | 应用层测试 | pycore.*, services/ |

---

## 📦 依赖关系图

```
┌──────────────────────────────────────────────────────┐
│  第三方库                                             │
│  - PyAV (av)                                         │
│  - NumPy (numpy)                                     │
│  - OpenCV (cv2)                                      │
│  - FastAPI (fastapi)                                 │
│  - Uvicorn (uvicorn)                                 │
└────────────────┬─────────────────────────────────────┘
                 │
                 ↓
┌──────────────────────────────────────────────────────┐
│  pycore/                                             │
│  ├── pyfoundations/     (基础工具)                   │
│  ├── pygvar/            (全局变量)                   │
│  ├── pyadb/             (ADB 通信) ✨                │
│  ├── pystream/          (视频流) ✨                  │
│  ├── pydevice/          (设备抽象) ✨                │
│  ├── pycontrol/         (控制协议) ✨                │
│  ├── pygroup/           (群控算法) ✨                │
│  └── pyapi/             (FastAPI 工具) ✨            │
└────────────────┬─────────────────────────────────────┘
                 │
                 ↓
┌──────────────────────────────────────────────────────┐
│  poly_apps/pyMatrix/                                 │
│  ├── services/          (业务服务)                   │
│  │   ├── DeviceService   → pycore.pyadb              │
│  │   ├── VideoStreamService → pycore.pystream        │
│  │   ├── ControlService  → pycore.pycontrol          │
│  │   └── GroupService    → pycore.pygroup            │
│  │                                                    │
│  ├── api/               (FastAPI 路由)               │
│  │   ├── device_routes   → services.DeviceService    │
│  │   ├── video_routes    → services.VideoStreamService │
│  │   ├── control_routes  → services.ControlService   │
│  │   └── group_routes    → services.GroupService     │
│  │                                                    │
│  ├── launcher/          (启动器)                     │
│  │   └── tkinter_launcher → pycore.pyadb             │
│  │                                                    │
│  └── main.py            (入口)                       │
│      └── 引用 api.*, services.*                      │
└──────────────────────────────────────────────────────┘
                 │
                 ↓
┌──────────────────────────────────────────────────────┐
│  pyMatrix-web/ (Nuxt 前端)                           │
│  - 通过 HTTP API 与后端通信                          │
│  - 通过 WebSocket 接收视频流和控制消息                │
└──────────────────────────────────────────────────────┘
```

---

## 🔄 数据流示例

### 场景 1：连接设备并启动视频流

```
用户操作（浏览器）
    ↓
POST /api/devices/{serial}/connect
    ↓
api/device_routes.py
    ↓
services/DeviceService
    ├─→ pycore.pyadb.ADBManager.push_file()
    │   (推送 scrcpy-server.jar)
    │
    ├─→ pycore.pyadb.ADBManager.execute_shell()
    │   (启动 scrcpy-server)
    │
    └─→ pycore.pyadb.ADBManager.forward_port()
        (端口转发)
    ↓
VideoStreamService 启动视频流处理任务
    ├─→ 从 TCP socket 读取 H.264 数据
    │
    ├─→ pycore.pystream.H264Decoder.decode()
    │   (解码为 YUV 帧)
    │
    ├─→ pycore.pystream.FMP4Encoder.encode()
    │   (编码为 fMP4)
    │
    └─→ pycore.pyapi.WebSocketManager.broadcast()
        (广播到所有客户端)
    ↓
浏览器通过 WebSocket 接收 fMP4 数据
    ↓
MSE 播放器解码并显示
```

---

### 场景 2：触摸控制

```
用户点击（浏览器）
    ↓
触摸事件通过 WebSocket 发送
    {
      type: "touch",
      data: {
        action: "down",
        x: 500,
        y: 1000,
        screenWidth: 720,
        screenHeight: 1280
      }
    }
    ↓
api/control_routes.py (WebSocket 路由)
    ↓
services/ControlService
    ├─→ pycore.pycontrol.CoordinateMapper.map()
    │   (映射坐标：720x1280 → 1440x3120)
    │
    └─→ pycore.pycontrol.MessageBuilder.build_touch()
        (构建 scrcpy 协议消息)
    ↓
通过控制 socket 发送到设备
    ↓
Android 设备执行触摸操作
```

---

### 场景 3：群控（1 主 + 4 从）

```
主设备触摸事件
    ↓
api/control_routes.py
    ↓
services/GroupService
    ├─→ pycore.pygroup.GroupController.get_sync_targets()
    │   (获取需要同步的从设备列表)
    │   返回：["device2", "device3", "device4", "device5"]
    │
    └─→ 循环发送触摸事件到所有从设备
        ├─→ ControlService.send_touch("device2", event)
        ├─→ ControlService.send_touch("device3", event)
        ├─→ ControlService.send_touch("device4", event)
        └─→ ControlService.send_touch("device5", event)
    ↓
5 台设备同时执行相同操作
```

---

## 📝 文件内容示例

### config.py（配置管理）

```python
"""配置管理"""

from pathlib import Path
import os

class Config:
    """pyMatrix 配置"""

    # 项目根目录
    PROJECT_ROOT = Path(__file__).parent

    # 资源目录
    RESOURCES_DIR = PROJECT_ROOT / "resources"

    # ADB 路径（根据操作系统）
    @staticmethod
    def get_adb_path() -> str:
        """获取 ADB 可执行文件路径"""
        if os.name == 'nt':  # Windows
            return str(Config.RESOURCES_DIR / "adb" / "windows" / "adb.exe")
        elif os.name == 'posix':
            if os.uname().sysname == 'Darwin':  # macOS
                return str(Config.RESOURCES_DIR / "adb" / "macos" / "adb")
            else:  # Linux
                return str(Config.RESOURCES_DIR / "adb" / "linux" / "adb")

    # scrcpy-server 路径
    SCRCPY_SERVER_JAR = RESOURCES_DIR / "scrcpy-server.jar"

    # Web 服务配置
    WEB_HOST = "0.0.0.0"
    WEB_PORT = 8000

    # Nuxt 静态文件目录
    STATIC_DIR = PROJECT_ROOT / "static"

    # 视频流配置
    DEFAULT_MAX_SIZE = 720
    DEFAULT_BIT_RATE = 8000000
    DEFAULT_MAX_FPS = 60
```

---

### main.py（入口）

```python
"""pyMatrix 程序入口"""

import argparse
from pathlib import Path
import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

# ✅ 引用 pycore
from pycore.pyadb import ADBManager
from pycore.pyfoundations import ColorPrint

# ✅ 引用应用层
from api import device_routes, video_routes, control_routes, group_routes
from services import DeviceService, VideoStreamService
from config import Config

# 初始化 FastAPI
app = FastAPI(
    title="pyMatrix API",
    description="Android 设备投屏与群控系统",
    version="2.0"
)

# 注册路由
app.include_router(device_routes.router, prefix="/api", tags=["设备管理"])
app.include_router(video_routes.router, prefix="/api", tags=["视频流"])
app.include_router(control_routes.router, prefix="/api", tags=["设备控制"])
app.include_router(group_routes.router, prefix="/api", tags=["群控"])

# 静态文件（Nuxt 编译产物）
if Config.STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=Config.STATIC_DIR, html=True), name="static")
    ColorPrint.print_green("✓ 静态文件目录已挂载")
else:
    ColorPrint.print_yellow("⚠ 静态文件目录不存在，请先运行 build_and_integrate.py")

@app.on_event("startup")
async def startup():
    """启动时初始化"""
    ColorPrint.print_blue("=== pyMatrix 启动中 ===")

    # 检查 ADB
    adb_path = Config.get_adb_path()
    try:
        devices = ADBManager.list_devices(adb_path)
        ColorPrint.print_green(f"✓ 发现 {len(devices)} 个 ADB 设备")
    except Exception as e:
        ColorPrint.print_red(f"✗ ADB 检查失败: {e}")

    # 初始化服务
    DeviceService.initialize(Config.RESOURCES_DIR)
    VideoStreamService.initialize()

    ColorPrint.print_green("✓ pyMatrix 启动完成")
    ColorPrint.print_blue(f"✓ API 文档: http://{Config.WEB_HOST}:{Config.WEB_PORT}/docs")

def main():
    """主函数"""
    parser = argparse.ArgumentParser(description="pyMatrix - Android 投屏与群控")
    parser.add_argument("--host", default=Config.WEB_HOST, help="服务器地址")
    parser.add_argument("--port", type=int, default=Config.WEB_PORT, help="服务器端口")
    parser.add_argument("--reload", action="store_true", help="开发模式（自动重载）")

    args = parser.parse_args()

    uvicorn.run(
        "main:app",
        host=args.host,
        port=args.port,
        reload=args.reload
    )

if __name__ == '__main__':
    main()
```

---

## 🚀 启动方式

### 开发模式（前后端分离）

```bash
# 终端 1 - Python 后端
cd poly_apps/pyMatrix
pip install -r requirements.txt -r requirements-web.txt
python main.py --reload

# 终端 2 - Nuxt 前端
cd poly_apps/pyMatrix/pyMatrix-web
npm install
npm run dev
```

### 生产模式（集成部署）

```bash
# 1. 编译 Nuxt 并集成
cd poly_apps/pyMatrix
python build_and_integrate.py

# 2. 启动服务
python main.py

# 访问: http://localhost:8000
```

---

## 📚 相关文档

- `08_CORE_LIBRARY_ARCHITECTURE.md` - 核心库架构设计
- `09_PYCORE_MODULES_IMPLEMENTATION.md` - pycore 模块实现清单
- `05_COMMUNICATION_SPECIFICATION.md` - 通信协议规范
- `06_WEB_ARCHITECTURE_SIMPLIFIED.md` - Web 端简化架构

---

## ✅ 核心优势

### 对比旧架构

| 方面 | 旧架构 | 新架构（核心库分离） |
|------|--------|---------------------|
| **代码复用** | ❌ 紧耦合，难以复用 | ✅ pycore 可在任何项目使用 |
| **测试** | ❌ 依赖复杂，难以测试 | ✅ 核心库纯函数，易于测试 |
| **维护** | ❌ 职责混乱 | ✅ 职责清晰，核心库独立维护 |
| **扩展** | ❌ 添加功能影响全局 | ✅ 核心库稳定，应用层灵活 |
| **部署** | ❌ 整体打包 | ✅ 核心库可单独打包为 wheel |

---

**文档版本**：1.0
**最后更新**：2025-10-30
