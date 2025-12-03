# Matrix - Android 设备群控系统

> **版本**: v2.0
> **状态**: ✅ 生产就绪
> **架构**: 统一 WebSocket + RPC v2

---

## 📖 快速导航

### 核心文档

| 文档 | 说明 | 适用场景 |
|------|------|----------|
| **[docs/COMPLETE_GUIDE.md](docs/COMPLETE_GUIDE.md)** | 📘 **完整指南** - 架构、配置、初始化 | ⭐ 新用户必读 |
| **[BACKEND_REFERENCE.md](BACKEND_REFERENCE.md)** | 📗 **后端参考** - 统一 WebSocket 协议规范 | 前端对接、API 集成 |
| **[docs/BACKEND_API_SPECIFICATION.md](docs/BACKEND_API_SPECIFICATION.md)** | 📙 **API 规范** - 详细端点文档 | API 开发参考 |

### 参考文档

| 文档 | 说明 |
|------|------|
| **[docs/C++_REFERENCE.md](docs/C++_REFERENCE.md)** | C++ 版本参考（SmartMatrix） |
| **[docs/archive/](docs/archive/)** | 归档的设计文档 |

---

## 🚀 快速开始

### 1. 初始化依赖

```bash
# 首次使用，下载 ADB 和 scrcpy-server
python pyapps/matrix/init.py
```

### 2. 启动应用

```bash
# 使用 pymain 启动
python pymain.py app=matrix

# 或直接启动
python pyapps/matrix/matrix_main.py
```

### 3. 访问服务

- **Webview UI**: 自动打开
- **HTTP API**: http://localhost:8000
- **WebSocket**: ws://localhost:8000/ws
- **API 文档**: http://localhost:8000/docs

---

## 🎯 核心特性

- ✅ **设备管理** - 自动扫描、连接、配置
- ✅ **视频流推送** - H.264 低延迟实时视频
- ✅ **设备控制** - 触摸、按键、文本输入
- ✅ **屏幕管理** - 电源、亮度、旋转控制
- ✅ **文件传输** - 推送文件、安装/卸载 APK
- ✅ **录制截图** - 屏幕录制、截图保存
- ✅ **群组批量** - 批量操作、主从同步
- ✅ **配置管理** - 全局配置、设备级配置

---

## 🏗️ 技术架构

### 统一 WebSocket 架构

```
┌─────────────────────────────────┐
│     前端 (React/Nuxt.js)        │
└───────────────┬─────────────────┘
                │ WebSocket /ws
┌───────────────▼─────────────────┐
│    统一 WebSocket 路由           │
│  9 Namespaces × 47 Actions      │
├──────────────────────────────────┤
│ system | device | screen | file │
│ video | recording | group       │
│ config | control                │
└───────────────┬─────────────────┘
                │
┌───────────────▼─────────────────┐
│    业务服务层 (9 Services)       │
└───────────────┬─────────────────┘
                │
┌───────────────▼─────────────────┐
│   ADB + scrcpy (v3.3.3)         │
└─────────────────────────────────┘
```

### 技术栈

- **后端**: FastAPI (RPC v2) + Uvicorn
- **设备通信**: ADB + scrcpy v3.3.3
- **视频编码**: H.264/H.265
- **传输协议**: WebSocket (统一端点) + REST API
- **UI**: PySide6 Webview
- **服务管理**: pycore.pylauncher

---

## 📚 文档索引

### 使用指南

1. **[完整指南](docs/COMPLETE_GUIDE.md)** - 从安装到配置的完整流程
   - 快速开始
   - 系统架构
   - 初始化配置
   - 前端配置
   - 文件结构
   - 常见问题

### API 文档

2. **[后端参考](BACKEND_REFERENCE.md)** - 统一 WebSocket 协议详细规范
   - 项目概述
   - 架构设计
   - WebSocket 消息协议
   - 47个 Action 详细说明
   - 代码结构
   - 性能指标

3. **[API 规范](docs/BACKEND_API_SPECIFICATION.md)** - REST API 详细文档
   - 37个 HTTP 端点
   - 请求/响应格式
   - 数据模型
   - 错误处理

### 参考资料

4. **[C++ 参考](docs/C++_REFERENCE.md)** - SmartMatrix C++ 版本参考

---

## 🔧 配置说明

### 核心配置文件

配置位置: `pyapps/matrix/matrix_config/config.py`

#### 生产模式（推荐）
```python
FRONTEND_MODE = "production"      # 使用编译后的前端
FRONTEND_SKIP_BUILD = True        # 跳过编译，快速启动
FRONTEND_FORCE_REBUILD = False    # 不强制重建
```

#### 开发模式
```python
FRONTEND_MODE = "dev"             # 使用开发服务器
# 支持热重载，适合前端开发
```

详细配置说明请参考: [完整指南 - 前端配置](docs/COMPLETE_GUIDE.md#前端配置)

---

## 🐛 故障排除

### 常见问题

| 问题 | 解决方案 |
|------|----------|
| **启动卡住** | 检查前端编译输出，参考[完整指南 Q1](docs/COMPLETE_GUIDE.md#q1-启动卡在等待前端初始化) |
| **页面404** | 设置 `FRONTEND_SKIP_BUILD = False`，参考[完整指南 Q2](docs/COMPLETE_GUIDE.md#q2-页面显示-404) |
| **设备连接失败** | 运行 `python pyapps/matrix/init.py --adb-only`，参考[完整指南 Q4](docs/COMPLETE_GUIDE.md#q4-设备连接失败) |
| **视频流问题** | 验证 scrcpy 版本，参考[完整指南 Q5](docs/COMPLETE_GUIDE.md#q5-视频流黑屏或花屏) |

完整故障排除指南: [完整指南 - 常见问题](docs/COMPLETE_GUIDE.md#常见问题)

---

## 📦 依赖组件

| 组件 | 版本 | 说明 |
|------|------|------|
| Python | 3.10+ | 运行环境 |
| scrcpy-server | v3.3.3 | Android 镜像服务 |
| ADB | v36.0.0 | 设备通信工具 |
| pycore | latest | 核心服务框架 |

---

## 🔗 相关链接

### 官方资源
- **scrcpy 官方**: https://github.com/Genymobile/scrcpy
- **ADB 下载**: https://developer.android.com/studio/releases/platform-tools

### 项目文档
- **pycore 开发规范**: `development-guides/PYTHON_PYCORE.md`
- **pylauncher 使用指南**: `pycore/pylauncher/README.md`
- **RPC v2 实现**: `pycore/pyutils/rpc_v2/`

---

## 📄 项目结构

```
pyapps/matrix/
├── README.md                    # ⭐ 本文档（项目主页）
├── BACKEND_REFERENCE.md         # 📗 后端参考（WebSocket 协议）
├── matrix_main.py              # 主入口
├── init.py                     # 初始化脚本
├── matrix_config/              # 配置目录
├── controller/                 # 控制器
├── api/                        # API 路由
├── services/                   # 业务服务
├── middleware/                 # 中间件
├── resources/                  # 资源文件
└── docs/                       # 文档目录
    ├── COMPLETE_GUIDE.md       # 📘 完整指南
    ├── BACKEND_API_SPECIFICATION.md  # 📙 API 规范
    ├── C++_REFERENCE.md        # C++ 参考
    └── archive/                # 归档文档
```

---

## 🎓 推荐阅读顺序

### 新用户
1. 阅读本 README（了解项目概况）
2. 阅读 **[完整指南](docs/COMPLETE_GUIDE.md)**（完成初始化和配置）
3. 启动应用
4. 访问 http://localhost:8000/docs 查看交互式 API 文档

### 前端开发者
1. 阅读 **[后端参考](BACKEND_REFERENCE.md)**（了解 WebSocket 协议）
2. 阅读 **[API 规范](docs/BACKEND_API_SPECIFICATION.md)**（了解 REST API）
3. 参考代码示例开始对接

### 后端开发者
1. 阅读 **[完整指南](docs/COMPLETE_GUIDE.md)**（了解架构）
2. 查看 `services/` 目录的服务实现
3. 查看 `api/` 目录的路由定义

---

**维护者**: Matrix 开发团队
**最后更新**: 2025-12-04
**文档版本**: v2.0
