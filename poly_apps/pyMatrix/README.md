# pyMatrix - Python Android 设备投屏与群控系统

> **Python 实现的 Android 设备投屏与多设备群控系统**
>
> 基于 SmartMatrix (C++/Qt) 架构，支持桌面端（PyQt6）和 Web 端（Nuxt.js）双模式运行

---

## 📚 文档导航（按顺序阅读）

为了方便开发，文档已按照学习和开发顺序重新组织：

### 第一步：了解项目
📄 **[00_PROJECT_OVERVIEW.md](./00_PROJECT_OVERVIEW.md)** - **从这里开始**
- 项目简介和功能特性
- 技术栈概览
- 快速开始指南
- 使用示例

### 第二步：理解架构
📄 **[01_ARCHITECTURE_DESIGN.md](./01_ARCHITECTURE_DESIGN.md)**
- 整体架构设计
- 模块划分和职责
- 桌面端 vs Web 端对比
- 核心流程图

### 第三步：Python 后端实现
📄 **[02_BACKEND_PYTHON_IMPLEMENTATION.md](./02_BACKEND_PYTHON_IMPLEMENTATION.md)**
- ADB 通信模块
- 设备管理器
- 视频流处理（Demuxer + Decoder）
- 控制消息协议
- 群控系统实现
- ~~OpenGL 渲染技术~~（Web 端不需要）

### 第四步：Nuxt 前端实现
📄 **[03_FRONTEND_NUXT_IMPLEMENTATION.md](./03_FRONTEND_NUXT_IMPLEMENTATION.md)**
- Nuxt 3 前端架构
- FastAPI 后端 API
- MSE 视频流播放
- WebSocket 实时通信
- 多设备群控 UI
- 组件设计与实现

### 第五步：部署与集成
📄 **[04_DEPLOYMENT_AND_INTEGRATION.md](./04_DEPLOYMENT_AND_INTEGRATION.md)** - **重要**
- 开发环境配置
- Nuxt 编译流程
- **Nuxt 集成到 Python 项目的方法**
- Docker 部署方案
- 生产环境优化
- 故障排查指南

---

## 🆕 Web 端专用文档（重要）

如果你只关注 **pyMatrix Web 端**（不使用 Qt 桌面版），请优先阅读：

### ⭐ 通信规范（必读）
📄 **[05_COMMUNICATION_SPECIFICATION.md](./05_COMMUNICATION_SPECIFICATION.md)** - **统一通信协议**
- **解决文档冲突问题**
- WebSocket 实现选择（原生 vs Socket.io）
- 视频流通信规范（MSE 方案）
- 单机控制通信规则
- 群控通信规范
- 完整的消息格式定义
- Python 和 Nuxt 实现示例

### ⭐ Web 端简化架构（推荐）
📄 **[06_WEB_ARCHITECTURE_SIMPLIFIED.md](./06_WEB_ARCHITECTURE_SIMPLIFIED.md)** - **去 Qt 版本**
- **移除所有 PyQt6/OpenGL 依赖**
- 简单 UI 启动器设计（tkinter/PyQt6 minimal）
- Python 后端 + Nuxt 前端一体化架构
- 轻量级部署方案
- 完整的启动器实现代码

### 💡 技术选型分析（参考）
📄 **[07_PYTHON_VS_NODE_PERFORMANCE_ANALYSIS.md](./07_PYTHON_VS_NODE_PERFORMANCE_ANALYSIS.md)** - **后端技术对比**
- Python vs Node.js 性能对比（视频处理、WebSocket、并发）
- 100 设备场景性能基准测试
- 各技术栈优缺点详解
- **结论：推荐保持 Python 后端**（视频处理性能优势明显）
- Node.js 适用场景分析

---

## 🏗️ 核心库分离架构（重要 - 新版本）

> **架构升级**：参考 `pycore/PYCORE_CONSISTENCY_REPORT.md` 设计理念，将通用功能提取到核心库

### ⭐ 核心库架构设计（必读）
📄 **[08_CORE_LIBRARY_ARCHITECTURE.md](./08_CORE_LIBRARY_ARCHITECTURE.md)** - **核心库分离架构**
- **设计原则**：pycore 完全独立，可在任何项目复用
- **依赖规则**：pycore 不依赖 poly_apps，只依赖标准库和第三方库
- **模块划分**：pyadb、pystream、pydevice、pycontrol、pygroup、pyapi
- **优势**：高内聚低耦合、易于测试、代码复用
- **迁移计划**：分阶段实施指南

### ⭐ pycore 模块实现清单（开发参考）
📄 **[09_PYCORE_MODULES_IMPLEMENTATION.md](./09_PYCORE_MODULES_IMPLEMENTATION.md)** - **完整代码实现**
- **pyadb**：ADB 通信模块（~500 行）
- **pystream**：视频流处理（H.264 解码 + fMP4 编码，~800 行）
- **pydevice**：设备抽象（~300 行）
- **pycontrol**：控制协议（触摸/按键事件，~400 行）
- **pygroup**：群控算法（~200 行）
- **pyapi**：FastAPI 工具（WebSocket 管理，~150 行）
- 每个模块包含完整代码示例和接口文档

### ⭐ 新项目结构说明（必读）
📄 **[10_NEW_PROJECT_STRUCTURE.md](./10_NEW_PROJECT_STRUCTURE.md)** - **完整目录树**
- **核心库部分**（pycore/）：6 个新增模块的完整目录结构
- **应用层部分**（poly_apps/pyMatrix/）：api、services、launcher、前端
- **依赖关系图**：清晰展示各层级依赖关系
- **数据流示例**：设备连接、视频流、触摸控制、群控的完整流程
- **文件内容示例**：config.py、main.py 完整代码
- **对比旧架构**：代码复用、测试、维护、扩展性全面提升

---

## 🚀 快速开始

### 桌面端模式（PyQt6）

```bash
# 安装依赖
pip install -r requirements.txt

# 启动桌面端
python main.py
```

### Web 端模式（Nuxt + FastAPI）

**方式一：开发模式（前后端分离）**

```bash
# 终端 1 - Python 后端
pip install -r requirements.txt -r requirements-web.txt
python main.py --mode web --port 8000

# 终端 2 - Nuxt 前端
cd pyMatrix-web
npm install
npm run dev
```

**方式二：生产模式（集成部署）**

```bash
# 1. 编译 Nuxt 并集成到 Python
python build_and_integrate.py

# 2. 启动集成服务
python main.py --mode web --port 8000

# 访问: http://localhost:8000
```

**Docker 部署**：

```bash
docker-compose up -d
```

详细说明请参考 **[04_DEPLOYMENT_AND_INTEGRATION.md](./04_DEPLOYMENT_AND_INTEGRATION.md)**

---

## 🎯 核心特性

### 桌面端（PyQt6）
- ✅ **低延迟投屏**: 30-70ms
- ✅ **硬件加速**: OpenGL YUV 渲染
- ✅ **完整控制**: 鼠标、键盘、触摸
- ✅ **群控支持**: 最多 500+ 设备
- ✅ **按键映射**: 游戏模式支持

### Web 端（Nuxt.js）
- ✅ **浏览器访问**: 无需安装客户端
- ✅ **MSE 硬解**: 100-300ms 延迟
- ✅ **多用户协作**: 团队同时操作
- ✅ **实时同步**: WebSocket 通信
- ✅ **网格布局**: 最多 64 设备同屏

---

## 📂 项目结构（核心库分离版 v2.0）

### 核心库部分（pycore/）

```
D:\programing\core_node\pycore/
├── pyadb/                              # ✨ ADB 通信（新增）
│   ├── adb_manager.py                  # ADB 管理器
│   ├── adb_device.py                   # 设备信息
│   └── adb_exceptions.py               # 异常定义
├── pystream/                           # ✨ 视频流处理（新增）
│   ├── h264_decoder.py                 # H.264 解码
│   ├── fmp4_encoder.py                 # fMP4 编码
│   └── stream_types.py                 # 类型定义
├── pydevice/                           # ✨ 设备抽象（新增）
│   ├── device_info.py                  # 设备信息
│   ├── server_params.py                # scrcpy 参数
│   └── android_device.py               # Android 设备
├── pycontrol/                          # ✨ 控制协议（新增）
│   ├── touch_event.py                  # 触摸事件
│   ├── coordinate_mapper.py            # 坐标映射
│   └── message_builder.py              # 消息构建器
├── pygroup/                            # ✨ 群控算法（新增）
│   └── group_controller.py             # 群控控制器
└── pyapi/                              # ✨ FastAPI 工具（新增）
    └── websocket_manager.py            # WebSocket 管理器
```

### 应用层部分（poly_apps/pyMatrix/）

```
D:\programing\core_node\poly_apps\pyMatrix/
├── docs/                               # 文档（新增 3 个架构文档）
│   ├── 00_PROJECT_OVERVIEW.md
│   ├── 01_ARCHITECTURE_DESIGN.md
│   ├── 02_BACKEND_PYTHON_IMPLEMENTATION.md
│   ├── 03_FRONTEND_NUXT_IMPLEMENTATION.md
│   ├── 04_DEPLOYMENT_AND_INTEGRATION.md
│   ├── 05_COMMUNICATION_SPECIFICATION.md
│   ├── 06_WEB_ARCHITECTURE_SIMPLIFIED.md
│   ├── 07_PYTHON_VS_NODE_PERFORMANCE_ANALYSIS.md
│   ├── 08_CORE_LIBRARY_ARCHITECTURE.md      # ✨ 核心库架构
│   ├── 09_PYCORE_MODULES_IMPLEMENTATION.md  # ✨ 模块实现
│   └── 10_NEW_PROJECT_STRUCTURE.md          # ✨ 项目结构
├── api/                                # FastAPI 路由（应用层）
│   ├── device_routes.py                # 设备管理 API
│   ├── video_routes.py                 # 视频流 API
│   ├── control_routes.py               # 控制 API
│   └── group_routes.py                 # 群控 API
├── services/                           # 业务服务（应用层）
│   ├── device_service.py               # 设备管理服务
│   ├── video_service.py                # 视频流服务
│   ├── control_service.py              # 控制服务
│   └── group_service.py                # 群控服务
├── launcher/                           # 启动器
│   ├── tkinter_launcher.py             # Tkinter 启动器
│   └── pyqt_launcher.py                # PyQt6 最小启动器
├── pyMatrix-web/                       # Nuxt 前端源码
│   ├── components/
│   ├── composables/
│   ├── pages/
│   ├── stores/
│   └── nuxt.config.ts
├── static/                             # Nuxt 编译输出（集成部署）
├── resources/                          # 资源文件
│   ├── adb/                            # ADB 可执行文件
│   └── scrcpy-server.jar               # Android 服务端
├── config.py                           # 配置管理
├── main.py                             # 程序入口
├── requirements.txt                    # Python 依赖
├── requirements-web.txt                # Web 模式额外依赖
├── build_and_integrate.py              # Nuxt 编译集成脚本
├── docker-compose.yml                  # Docker 部署配置
└── README.md                           # 👈 当前文件
```

**架构优势**：
- ✅ 核心库（pycore）完全独立，可在任何项目中复用
- ✅ 应用层（poly_apps/pyMatrix）专注业务逻辑
- ✅ 职责清晰，依赖规则明确
- ✅ 易于测试和维护

详细说明请参阅 **[10_NEW_PROJECT_STRUCTURE.md](./10_NEW_PROJECT_STRUCTURE.md)**

---

## 🛠️ 技术栈

### Python 后端
- **GUI**: PyQt6（桌面端）
- **Web**: FastAPI + Uvicorn（Web 端）
- **视频**: PyAV (FFmpeg)
- **渲染**: OpenGL + PyOpenGL
- **通信**: socket + WebSocket

### Nuxt 前端
- **框架**: Nuxt 3 + Vue 3 + TypeScript
- **UI**: Element Plus
- **状态**: Pinia
- **视频**: MSE (Media Source Extensions)
- **通信**: Socket.io-client

---

## 📖 开发指南

### 新手入门流程

1. **阅读文档**（按顺序）：
   - 00 → 01 → 02 → 03 → 04

2. **环境准备**：
   ```bash
   # Python 环境
   pip install -r requirements.txt -r requirements-web.txt

   # Node.js 环境（Web 端）
   cd pyMatrix-web && npm install
   ```

3. **运行示例**：
   ```bash
   # 桌面端
   python main.py

   # Web 端（开发模式）
   python main.py --mode web  # 终端 1
   cd pyMatrix-web && npm run dev  # 终端 2
   ```

4. **查看 API 文档**：
   ```
   http://localhost:8000/api/docs
   ```

---

## 🎮 使用场景

### 场景 1: 个人开发者 - 应用测试
推荐：**桌面端模式**

```python
from core.device.device_manager import DeviceManager
from core.device.device_params import ServerParams

params = ServerParams(
    serial="ABC123DEF456",
    max_size=720,
    bit_rate=8000000,
    control=True
)

DeviceManager.instance().connect_device(params)
```

### 场景 2: 测试团队 - 多设备测试
推荐：**Web 端模式 + 群控**

```bash
# 1. 启动 Web 服务
python main.py --mode web

# 2. 浏览器访问
http://localhost:8000

# 3. 连接多台设备，设置主控设备，开始群控
```

### 场景 3: 游戏工作室 - 多开群控
推荐：**桌面端 + 群控 + 按键映射**

```python
from core.group.group_controller import GroupController
from core.control.keymap import KeyMap

# 加载游戏配置
keymap = KeyMap()
keymap.load_script("resources/keymaps/game.json")

# 设置群控
group = GroupController.instance()
group.add_device("device1")
group.add_device("device2")
group.set_host("device1")

# 按 W 键 → 所有设备向前移动
```

---

## 🐛 故障排查

### 常见问题

1. **静态文件 404**
   ```bash
   # 运行集成脚本
   python build_and_integrate.py
   ```

2. **WebSocket 连接失败**
   ```bash
   # 检查环境变量
   cat pyMatrix-web/.env
   # NUXT_PUBLIC_WS_URL=ws://localhost:8000
   ```

3. **USB 设备无法访问（Docker）**
   ```yaml
   # docker-compose.yml
   services:
     pymatrix:
       privileged: true
       devices:
         - /dev/bus/usb
   ```

更多问题请参考 **[04_DEPLOYMENT_AND_INTEGRATION.md](./04_DEPLOYMENT_AND_INTEGRATION.md)** 第八章

---

## 🤝 贡献指南

### 代码规范

1. **严格参考 C++ 实现**
   - 类名、方法名对应 SmartMatrix
   - 算法逻辑保持一致
   - 注释标注对应的 C++ 源文件

2. **Python 风格**
   - PEP 8 代码风格
   - Type Hints（类型注解）
   - Docstring（文档字符串）

3. **Web 代码**
   - TypeScript 强类型
   - Vue 3 Composition API
   - ESLint + Prettier

---

## 📜 许可证

与 SmartMatrix 保持一致（请查看原项目许可证）

---

## 🙏 致谢

- **SmartMatrix (QtScrcpy)**: https://github.com/barry-ran/QtScrcpy
- **scrcpy**: https://github.com/Genymobile/scrcpy
- **PyAV**: https://github.com/PyAV-Org/PyAV
- **FastAPI**: https://fastapi.tiangolo.com/
- **Nuxt.js**: https://nuxt.com/

---

## 📞 支持

- **GitHub Issues**: 报告 Bug 或功能请求
- **文档**: 按顺序阅读上方 5 个文档
- **API 文档**: http://localhost:8000/api/docs

---

**项目状态**: 🚧 设计完成，实现进行中

**最后更新**: 2025-10-30

**技术栈**: Python 3.11+ | PyQt6 | PyAV | OpenGL | Nuxt 3 | FastAPI

**参考项目**: SmartMatrix (C++/Qt)
