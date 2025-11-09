# Matrix Application - Complete Startup Flow

## Overview

Matrix 应用采用前后端分离架构，通过 `python ./pymain.py app=matrix` 统一启动前端和后端。

## Architecture

```
matrix/
├── matrix_main.py          # 标准入口点（pymain.py 调用）
├── frontend_launcher.py    # 前端启动器
├── config.py              # 配置文件
├── api/                   # FastAPI 路由
├── services/              # 业务逻辑
└── middleware/            # 中间件

poly_apps/nuxt_main/
├── apps/app_pymatrix/
│   └── app-config.json    # 前端配置（端口 3007）
├── pages/
│   ├── index.pymatrix.vue # pyMatrix 入口页面
│   └── index.vue          # 当前激活的入口（由脚本切换）
└── scripts/
    ├── start.ps1          # 前端启动器
    └── switch-app-entry-plus.js  # 目录同步和入口切换
```

## Startup Flow

### 1. 启动命令

```bash
python ./pymain.py app=matrix
```

### 2. 执行流程

#### Step 1: pymain.py 查找应用

```
pymain.py
  → 扫描 pyapps/ 目录
  → 找到 pyapps/matrix/
  → 查找入口点：matrix_main.py（优先）或 main.py
  → 导入并调用 start() 函数
```

#### Step 2: matrix_main.py 启动流程（Windows）

```python
# matrix_main.py:start()

1. 过滤 app=matrix 参数
2. 解析命令行参数（--host, --port, --reload, --backend-only）
3. 检查平台（Windows 或 Linux）

# Windows 流程：
4. 调用 frontend_launcher.launch_frontend_with_wait()
   ├── 创建临时 .bat 脚本
   ├── 内容：powershell.exe -File start.ps1 pymatrix debug
   ├── 使用 CREATE_NEW_CONSOLE 在新窗口启动
   └── 等待前端就绪（http://localhost:3007）

5. 前端启动完成后，在主线程启动后端：
   uvicorn.run(create_app(), host=0.0.0.0, port=8000)
```

#### Step 3: 前端启动详细流程

```
临时.bat脚本执行
  ↓
powershell.exe start.ps1 pymatrix debug
  ↓
start.ps1 解析参数
  ├── AppName: pymatrix
  ├── Mode: debug
  └── 读取 apps/app_pymatrix/app-config.json
  ↓
执行 switch-app-entry.js pymatrix
  ├── 复制 index.pymatrix.vue → index.vue
  └── 打印确认信息
  ↓
执行 switch-app-entry-plus.js pymatrix --mode dev
  ├── 创建工厂目录：.build_dir/nuxt_factory/_app_pymatrix
  ├── 镜像整个项目到工厂目录
  ├── 启动文件监控（每2秒同步变化）
  └── 在工厂目录执行：pnpm dev:pymatrix
  ↓
Nuxt 开发服务器启动
  ├── Host: 0.0.0.0
  ├── Port: 3007
  └── 热重载开启
```

#### Step 4: 后端启动流程

```python
# FastAPI Application

create_app()
  ├── 配置 CORS（允许 localhost:3007）
  ├── 添加中间件（日志、性能监控）
  ├── 注册路由
  │   ├── /api/health
  │   ├── /api/devices
  │   ├── /api/config
  │   ├── /ws/video/{serial}
  │   └── /ws/control/{serial}
  └── 启动事件
      ├── 检查 ADB 可用性
      ├── 扫描连接的设备
      └── 打印服务器信息

uvicorn.run()
  ├── Host: 0.0.0.0
  ├── Port: 8000
  └── 支持 WebSocket
```

## URL Endpoints

### 前端 (Nuxt)
- **开发服务器**: http://localhost:3007
- **网络访问**: http://0.0.0.0:3007

### 后端 (FastAPI)
- **API 根路径**: http://localhost:8000/api
- **API 文档**: http://localhost:8000/docs
- **健康检查**: http://localhost:8000/api/health
- **WebSocket 视频流**: ws://localhost:8000/ws/video/{serial}
- **WebSocket 控制**: ws://localhost:8000/ws/control/{serial}

## 启动选项

### 默认启动（前端 + 后端）

```bash
python ./pymain.py app=matrix
```

### 仅启动后端

```bash
python ./pymain.py app=matrix --backend-only
```

### 自定义端口

```bash
python ./pymain.py app=matrix --host=127.0.0.1 --port=9000
```

### 开发模式（自动重载）

```bash
python ./pymain.py app=matrix --reload
```

## 关键配置文件

### 1. pyapps/matrix/config.py
```python
APP_NAME = "matrix"
WEB_HOST = "0.0.0.0"
WEB_PORT = 8000
FRONTEND_URL = "http://localhost:3007"
```

### 2. poly_apps/nuxt_main/apps/app_pymatrix/app-config.json
```json
{
  "displayName": "pyMatrix",
  "port": 3007,
  "devCommand": "dev:pymatrix",
  "buildCommand": "build:pymatrix"
}
```

## 工作目录结构

### 运行时目录

```
.build_dir/
└── nuxt_factory/
    └── _app_pymatrix/          # 前端工厂构建目录
        ├── pages/
        │   └── index.vue       # 已切换到 pymatrix
        ├── apps/
        │   └── app_pymatrix/   # pyMatrix 应用代码
        ├── node_modules/       # 依赖（符号链接）
        └── package.json
```

### 临时文件

```
C:\Users\{user}\AppData\Local\Temp\
└── tmp*.bat                    # 前端启动临时脚本
```

## 故障排查

### 前端启动失败

1. 检查 Node.js 和 pnpm 是否安装
2. 确认端口 3007 未被占用
3. 检查 `poly_apps/nuxt_main/package.json` 中的 `dev:pymatrix` 脚本
4. 手动测试：
   ```bash
   cd poly_apps/nuxt_main/scripts
   ./start.ps1 pymatrix
   ```

### 后端启动失败

1. 检查 Python 依赖是否完整
2. 确认端口 8000 未被占用
3. 检查 ADB 是否可用
4. 手动测试：
   ```bash
   python ./pymain.py app=matrix --backend-only
   ```

### 前后端无法通信

1. 检查 CORS 配置（config.py）
2. 确认两个服务都在运行
3. 使用浏览器开发工具检查网络请求

## 开发工作流

### 前端开发

1. 前端代码位置：`poly_apps/nuxt_main/apps/app_pymatrix/`
2. 修改代码后自动热重载（Factory Sync 监控）
3. 访问 http://localhost:3007 查看效果

### 后端开发

1. 后端代码位置：`pyapps/matrix/`
2. 使用 `--reload` 参数启用自动重载
3. API 文档：http://localhost:8000/docs

### 全栈开发

```bash
# 终端 1：启动完整应用
python ./pymain.py app=matrix --reload

# 浏览器访问
# 前端：http://localhost:3007
# 后端文档：http://localhost:8000/docs
```

## 与 scrcpy_web_test 的对比

| 特性 | scrcpy_web_test | matrix |
|------|----------------|--------|
| 前端框架 | 无（纯 HTML） | Nuxt 3 |
| 前端端口 | 27880 | 3007 |
| 后端框架 | aiohttp | FastAPI |
| 后端端口 | 27880 | 8000 |
| 启动方式 | 仅后端 | 前后端分离 |
| 入口点 | main.py | matrix_main.py |
| 构建系统 | 无 | Factory Sync |

## 参考文档

- Python pycore 开发指南：`development-guides/PYTHON_PYCORE_BASE_GUIDE_THIS_FILE_NO_AI_EDIT.md`
- Nuxt 启动脚本：`poly_apps/nuxt_main/scripts/start.ps1`
- 迁移文档：`pyapps/matrix/MIGRATION_TO_PYMAIN.md`
