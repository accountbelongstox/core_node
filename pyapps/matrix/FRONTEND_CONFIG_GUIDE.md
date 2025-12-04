# Matrix Frontend Configuration Guide

## 配置位置

所有配置参数都硬编码在 `pyapps/matrix/config.py` 中。

## 配置参数

### FRONTEND_MODE
**位置**: `config.py:81`
**类型**: `str`
**可选值**: `"dev"` | `"production"`
**默认值**: `"production"`

控制前端运行模式：

- **`"production"`** (推荐) - 生产模式
  - 编译Nuxt项目到 `.output`
  - 后端serve静态文件
  - 统一端口 (8000)
  - 启动速度快
  - 适合正式使用

- **`"dev"`** - 开发模式
  - 启动Nuxt开发服务器
  - 热重载，实时编译
  - 独立端口 (38007)
  - 启动速度慢
  - 适合前端开发调试

### FRONTEND_SKIP_BUILD
**位置**: `config.py:84`
**类型**: `bool`
**可选值**: `True` | `False`
**默认值**: `True`

控制是否跳过编译（仅在production模式生效）：

- **`True`** (推荐) - 跳过编译
  - 使用已存在的 `.output`
  - 启动速度极快 (~5秒)
  - 需要先编译过一次

- **`False`** - 编译
  - 每次启动都重新编译
  - 启动速度慢 (~2-5分钟)
  - 确保使用最新代码

### FRONTEND_FORCE_REBUILD
**位置**: `config.py:87`
**类型**: `bool`
**可选值**: `True` | `False`
**默认值**: `False`

控制是否强制重新编译（仅在production模式生效）：

- **`False`** (推荐) - 正常行为
  - 如果 `.output` 存在，则跳过编译
  - 如果不存在，则编译

- **`True`** - 强制重新编译
  - 无论 `.output` 是否存在都重新编译
  - 用于确保完全重新构建

**注意**: `FRONTEND_SKIP_BUILD` 和 `FRONTEND_FORCE_REBUILD` 不能同时为 `True`

## 使用场景

### 场景1: 日常使用（最快启动）
```python
FRONTEND_MODE = "production"
FRONTEND_SKIP_BUILD = True
FRONTEND_FORCE_REBUILD = False
```
**效果**: 使用已编译的前端，启动速度极快

### 场景2: 前端代码更新后
```python
FRONTEND_MODE = "production"
FRONTEND_SKIP_BUILD = False
FRONTEND_FORCE_REBUILD = False
```
**效果**: 重新编译前端，然后启动

### 场景3: 前端开发调试
```python
FRONTEND_MODE = "dev"
# skip_build 和 force_rebuild 在 dev 模式下无效
```
**效果**: 启动开发服务器，支持热重载

### 场景4: 完全重新构建
```python
FRONTEND_MODE = "production"
FRONTEND_SKIP_BUILD = False
FRONTEND_FORCE_REBUILD = True
```
**效果**: 强制重新编译，确保干净构建

## 端口说明

### Production模式（统一端口）
```
┌─────────────────────────────────────┐
│ Backend (FastAPI)                   │
│ 端口: 8000                          │
│ ├─ /api/*  → API路由                │
│ └─ /*      → 静态文件 (.output)     │
└─────────────────────────────────────┘
          ↑
┌─────────────────────────────────────┐
│ PySide6 Webview                     │
│ 加载: http://localhost:8000         │
└─────────────────────────────────────┘
```

### Dev模式（独立端口）
```
┌─────────────────────────────────────┐
│ Frontend (Nuxt Dev Server)          │
│ 端口: 38007                          │
│ 热重载、实时编译                      │
└─────────────────────────────────────┘
          ↑ HTTP调用
┌─────────────────────────────────────┐
│ Backend (FastAPI)                   │
│ 端口: 8000                          │
│ API路由                              │
└─────────────────────────────────────┘
          ↑
┌─────────────────────────────────────┐
│ PySide6 Webview                     │
│ 加载: http://localhost:38007        │
└─────────────────────────────────────┘
```

## 启动流程

### Production模式 (统一端口)
1. **验证/编译前端**
   - 如果 `skip_build=True`：检查 `.output` 目录是否存在
   - 如果 `skip_build=False`：编译前端到 `.output`
   - 输出到 `D:/programing/.build_dir/nuxt_factory/_app_pymatrix/.output`
   - **不启动独立前端服务器**
2. **启动后端** (FastAPI on port 8000)
3. **挂载静态文件** (Backend serve `.output/public`)
4. **启动UI** (PySide6 加载 http://localhost:8000)

**特点**：
- ✅ 无需等待前端服务器启动
- ✅ 启动速度快（skip_build=True时~5秒）
- ✅ 统一端口，简化部署

### Dev模式 (独立端口)
1. **启动前端** (Nuxt Dev Server on port 38007)
   - 显示启动进度到startup window
   - 新窗口运行dev server
2. **等待前端就绪** (HTTP健康检查 http://localhost:38007)
3. **启动后端** (FastAPI on port 8000)
4. **启动UI** (PySide6 加载 http://localhost:38007)

**特点**：
- ✅ 热重载，实时编译
- ✅ 支持前端开发调试
- ⚠️ 启动速度慢（需要等待dev server）

## 技术架构

### 新增模块
- `pycore/pyutils/frontend_launcher/` - 通用前端启动器
  - `NuxtLauncher` - Nuxt专用启动器
  - `FrontendConfig` - 前端配置数据类
  - `OutputCapturer` - 实时输出捕获

### 修改模块
- `pyapps/matrix/controller/frontend_controller.py` - 使用新launcher
- `pyapps/matrix/controller/backend_controller.py` - 支持静态文件挂载
- `pyapps/matrix/controller/matrix_service.py` - 协调前后端启动
- `pyapps/matrix/config.py` - 硬编码配置参数

## 故障排除

### 问题: 启动卡在"等待前端初始化"
**原因**: 前端编译失败或启动失败
**解决**:
1. 检查编译输出（显示在startup window）
2. 手动运行编译: `python poly_apps/nuxt_main/scripts/start_production.py pymatrix 38007`

### 问题: 页面404
**原因**: Production模式下 `.output` 不存在
**解决**:
1. 设置 `FRONTEND_SKIP_BUILD = False`
2. 重新启动应用

### 问题: 前端代码修改不生效
**原因**: Production模式使用的是编译后的代码
**解决**:
1. 方案A: 切换到dev模式 (`FRONTEND_MODE = "dev"`)
2. 方案B: 重新编译 (`FRONTEND_SKIP_BUILD = False`)

## 推荐配置

**日常使用**:
```python
FRONTEND_MODE = "production"
FRONTEND_SKIP_BUILD = True
FRONTEND_FORCE_REBUILD = False
```

**前端开发**:
```python
FRONTEND_MODE = "dev"
```

**首次安装**:
```python
FRONTEND_MODE = "production"
FRONTEND_SKIP_BUILD = False
FRONTEND_FORCE_REBUILD = False
```
