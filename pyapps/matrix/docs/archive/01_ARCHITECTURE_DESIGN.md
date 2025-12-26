# pyMatrix 架构总览

## 项目简介

pyMatrix 是基于 **SmartMatrix (C++/Qt)** 架构的 Python 实现，提供 Android 设备投屏与多设备群控功能。

**核心特性**：
- ✅ **严格参考 C++ 实现**：架构、类设计、算法逻辑完全对应
- 🎯 **双模式支持**：桌面端 (PyQt6) + Web端 (Nuxt.js)
- 📱 **多设备群控**：最多支持 1000 台设备理论上限
- ⚡ **低延迟投屏**：桌面端 30-70ms，Web端 100-300ms
- 🎮 **完整控制**：鼠标、键盘、触摸、按键映射

---

## 文档结构

### 1. 核心技术方案 (桌面端)

📄 **[pyMatrix技术方案设计.md](./pyMatrix技术方案设计.md)**

**涵盖内容**：
- Python 技术栈选型
- 核心模块设计 (ADB、Device、Stream、Control、Render、Group)
- 代码实现示例 (严格参考 C++)
- 性能优化建议
- 开发路线图

**参考映射**：
```
SmartMatrix C++              →  pyMatrix Python
─────────────────────────────────────────────────
adbprocess.cpp               →  adb/adb_process.py
server.cpp                   →  device/server/server.py
demuxer.cpp                  →  stream/demuxer.py
decoder.cpp                  →  stream/decoder.py
controlmsg.cpp               →  control/control_msg.py
groupcontroller.cpp          →  group/group_controller.py
qyuvopenglwidget.cpp         →  render/opengl_widget.py
```

---

### 2. Web 架构设计 (Nuxt.js)

📄 **[pyMatrix_Web架构设计.md](./pyMatrix_Web架构设计.md)**

**涵盖内容**：
- 三层架构 (Browser → FastAPI → pyMatrix Core)
- 视频流传输方案 (MSE / WebRTC)
- 多设备群控 Web 实现
- FastAPI 后端代码
- Nuxt.js 前端组件
- Docker 部署方案

**核心技术**：
```
视频流： Android H.264 → PyAV 封装 fMP4 → WebSocket → MSE API → <video>
控制流： Nuxt UI → Socket.io → FastAPI → pyMatrix Core → ADB → Android
群控：  主控设备事件 → WebSocket 广播 → 坐标映射 → 多设备同步执行
```

---

### 3. SmartMatrix C++ 参考文档

#### 3.1 核心技术分析
📄 **[SmartMatrix技术分析文档.md](../SmartMatrix/SmartMatrix技术分析文档.md)**

**关键章节**：
- ADB连接机制 (USB/WiFi)
- 服务端启动流程 (Push JAR → Reverse/Forward → Execute)
- 视频流传输架构 (Demuxer → Decoder → Render)
- 控制技术 (ControlMsg 协议)
- 性能优化技术

#### 3.2 群控技术详解
📄 **[SmartMatrix多设备群控技术补充文档.md](../SmartMatrix/SmartMatrix多设备群控技术补充文档.md)**

**关键章节**：
- 设备管理器 (DeviceManage) - 最多 1000 台设备
- 群控器架构 (GroupController) - 观察者模式
- 端口分配策略 (27183-28183)
- 坐标映射与分辨率适配
- 性能基准测试数据

---

## 技术对比

### C++ vs Python vs Web

| 维度 | SmartMatrix (C++) | pyMatrix 桌面端 | pyMatrix Web端 |
|------|------------------|----------------|----------------|
| **语言** | C++ | Python 3.11+ | Python + TS |
| **GUI** | Qt 6 | PyQt6 | Nuxt 3 |
| **视频解码** | FFmpeg C API | PyAV | MSE/WebRTC |
| **渲染** | QOpenGLWidget | PyOpenGLWidget | Canvas/Video |
| **延迟** | 30-70ms | 30-70ms | 100-300ms |
| **性能** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **开发效率** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **部署** | 需编译 | 无需编译 | Docker |
| **多用户** | ❌ | ❌ | ✅ |
| **最大设备数** | 500+ | 500+ | 64 (推荐) |

---

## 架构对应关系

### 1. 整体架构

```
SmartMatrix C++ 架构                    pyMatrix 架构
─────────────────────────────────────────────────────────

┌─────────────────────────┐            ┌─────────────────────────┐
│   Qt GUI (dialog.cpp)   │    →       │   PyQt6 GUI / Nuxt UI   │
└───────────┬─────────────┘            └───────────┬─────────────┘
            │                                      │
            ▼                                      ▼
┌─────────────────────────┐            ┌─────────────────────────┐
│  Device Management      │    →       │  Device Management      │
│  (devicemanage.cpp)     │            │  (device_manager.py)    │
└───────────┬─────────────┘            └───────────┬─────────────┘
            │                                      │
            ▼                                      ▼
┌─────────────────────────┐            ┌─────────────────────────┐
│  Group Controller       │    →       │  Group Controller       │
│  (groupcontroller.cpp)  │            │  (group_controller.py)  │
└───────────┬─────────────┘            └───────────┬─────────────┘
            │                                      │
            ▼                                      ▼
┌─────────────────────────┐            ┌─────────────────────────┐
│  Video Stream           │    →       │  Video Stream           │
│  Demuxer → Decoder      │            │  Demuxer → Decoder      │
└───────────┬─────────────┘            └───────────┬─────────────┘
            │                                      │
            ▼                                      ▼
┌─────────────────────────┐            ┌─────────────────────────┐
│  ADB Communication      │    →       │  ADB Communication      │
│  (adbprocess.cpp)       │            │  (adb_process.py)       │
└─────────────────────────┘            └─────────────────────────┘
```

### 2. 群控流程对应

```
C++ 群控流程                             Python 群控流程
───────────────────────────────────────────────────────────

用户操作主控设备                           用户操作主控设备
    ↓                                         ↓
VideoForm::mouseEvent()            →      VideoWidget.handleMouse()
    ↓                                         ↓
GroupController::mouseEvent()      →      GroupController.mouse_event()
    ↓                                         ↓
遍历从属设备                               遍历从属设备
    ↓                                         ↓
坐标映射 (getFrameSize)            →      坐标映射 (get_frame_size)
    ↓                                         ↓
Controller::mouseEvent()           →      Controller.send_mouse_event()
    ↓                                         ↓
ControlMsg::serialize()            →      ControlMsg.serialize()
    ↓                                         ↓
ControlSocket 发送                 →      ControlSocket.send()
    ↓                                         ↓
Android 执行触摸                           Android 执行触摸
```

---

## 模块映射表

### 核心类对应

| C++ 类 | Python 类 | 文件位置 |
|--------|----------|---------|
| `AdbProcess` | `AdbProcess` | `core/adb/adb_process.py` |
| `Server` | `Server` | `core/device/server/server.py` |
| `DeviceManage` | `DeviceManager` | `core/device/device_manager.py` |
| `GroupController` | `GroupController` | `core/group/group_controller.py` |
| `Demuxer` | `Demuxer` | `core/stream/demuxer.py` |
| `Decoder` | `Decoder` | `core/stream/decoder.py` |
| `Controller` | `Controller` | `core/control/controller.py` |
| `ControlMsg` | `ControlMsg` | `core/control/control_msg.py` |
| `QYUVOpenGLWidget` | `YUVOpenGLWidget` | `core/render/opengl_widget.py` |

### 关键方法对应

| C++ 方法 | Python 方法 | 功能 |
|---------|------------|------|
| `DeviceManage::connectDevice()` | `DeviceManager.connect_device()` | 连接设备 |
| `GroupController::addDevice()` | `GroupController.add_device()` | 添加到群组 |
| `GroupController::mouseEvent()` | `GroupController.mouse_event()` | 鼠标事件广播 |
| `Server::pushServer()` | `Server._push_server()` | 推送服务端 |
| `Server::enableTunnelReverse()` | `Server._enable_tunnel_reverse()` | 反向代理 |
| `Demuxer::run()` | `Demuxer.run()` | 解复用线程 |
| `Decoder::push()` | `Decoder.push()` | 推送数据包 |
| `ControlMsg::serializeData()` | `ControlMsg.serialize()` | 序列化控制消息 |

---

## 快速开始

### 桌面端 (PyQt6)

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 运行
python main.py

# 3. 连接设备
# - USB: 直接连接并启用 USB 调试
# - WiFi: 使用界面中的"无线连接"功能
```

### Web端 (Nuxt.js)

```bash
# 1. 安装后端依赖
pip install -r requirements.txt -r requirements-web.txt

# 2. 启动后端
python main.py --mode web
# 访问: http://localhost:8000

# 3. 启动前端 (新终端)
cd pyMatrix-web
npm install
npm run dev
# 访问: http://localhost:3000
```

---

## 使用场景

### 场景 1: 个人开发者测试应用

**推荐**: 桌面端

```python
# 快速连接并投屏
from core.device.device_manager import DeviceManager
from core.device.device_params import ServerParams

params = ServerParams(
    serial="ABC123DEF456",
    max_size=720,
    control=True
)

DeviceManager.instance().connect_device(params)
```

### 场景 2: 测试团队多设备测试

**推荐**: Web端 + 群控

```bash
# 1. 启动 Web 服务
python main.py --mode web

# 2. 浏览器访问
http://server-ip:8000

# 3. 连接多台设备
# 4. 设置主控设备
# 5. 开始群控操作
```

### 场景 3: 游戏工作室多开

**推荐**: 桌面端 + 群控 + 按键映射

```python
# 加载游戏按键配置
from core.control.keymap import KeyMap

keymap = KeyMap()
keymap.load_script("resources/keymaps/game.json")

# 设置群控
group = GroupController.instance()
group.add_device("device1")
group.add_device("device2")
group.set_host("device1")

# 按W键 → 所有设备执行向前移动
```

---

## 开发计划

### Phase 1: 核心功能 ✅ (完成设计)
- [x] 架构设计
- [x] ADB 通信模块设计
- [x] 视频流处理设计
- [x] 控制系统设计
- [x] 群控系统设计

### Phase 2: 桌面端实现 (进行中)
- [x] ADB 通信实现
- [ ] 服务端启动流程
- [ ] 视频解码与渲染
- [ ] 控制消息处理
- [ ] 群控功能实现

### Phase 3: Web端实现 (设计完成)
- [x] Web 架构设计
- [ ] FastAPI 后端实现
- [ ] MSE 视频流服务器
- [ ] Nuxt.js 前端组件
- [ ] WebSocket 群控

### Phase 4: 测试与优化
- [ ] 单元测试
- [ ] 性能测试 (延迟、CPU、内存)
- [ ] 大规模设备测试 (50+)
- [ ] 用户体验优化

---

## 贡献指南

### 代码规范

1. **严格参考 C++ 实现**
   - 类名、方法名对应
   - 算法逻辑一致
   - 注释标注对应的 C++ 源文件

2. **Python 风格**
   - PEP 8 代码风格
   - Type Hints (类型注解)
   - Docstring (文档字符串)

3. **Web 代码**
   - TypeScript 强类型
   - Vue 3 Composition API
   - ESLint + Prettier

### 示例

```python
# ✅ 正确示例
def connect_device(self, params: ServerParams) -> bool:
    """
    连接设备
    参考: devicemanage.cpp:35-70

    Args:
        params: 服务器参数

    Returns:
        是否连接成功
    """
    # 实现逻辑...
    pass

# ❌ 错误示例 (缺少类型注解和参考注释)
def connect_device(self, params):
    # 实现逻辑...
    pass
```

---

## 许可证

与 SmartMatrix 保持一致 (检查原项目许可证)

---

## 鸣谢

- **SmartMatrix (QtScrcpy)**: https://github.com/barry-ran/QtScrcpy
- **scrcpy**: https://github.com/Genymobile/scrcpy
- **PyAV**: https://github.com/PyAV-Org/PyAV
- **FastAPI**: https://fastapi.tiangolo.com/
- **Nuxt.js**: https://nuxt.com/

---

**项目状态**: 🚧 设计完成，实现进行中

**最后更新**: 2025-10-30
