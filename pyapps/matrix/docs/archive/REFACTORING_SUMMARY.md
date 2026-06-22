# Matrix Application Refactoring Summary

**Date**: 2025-12-03
**Task**: 合并重复配置，统一使用共用 RPC v2，清理过时代码

## 问题分析

### 原有问题
1. **重复定义**：多个地方定义启动器和服务（`frontend_launcher.py`, `launcher/`, `matrix_service_starter.py` 等）
2. **配置分散**：配置文件分散在多个地方（`config.py`, `launcher_config.py`, `matrix_config/`）
3. **架构混乱**：新旧架构混合，有些代码使用旧的直接启动方式，有些使用新的 pylauncher
4. **代码重复**：多处重复实现相似功能（UI 控制器、前端控制器等）

## 重构内容

### 1. 删除的文件（旧架构）

#### 启动器相关
- ❌ `frontend_launcher.py` - 旧的前端启动器（dev 模式）
- ❌ `launcher/webview_launcher.py` - 旧的 webview 启动器
- ❌ `launcher/__init__.py` - 旧的 launcher 目录
- ❌ `matrix_service_starter.py` - 旧的服务启动器

#### 控制器相关
- ❌ `controller/backend_controller.py` - 旧的后端控制器
- ❌ `controller/frontend_controller.py` - 旧的前端控制器
- ❌ `controller/ui_controller.py` - 旧的 UI 控制器（tkinter）
- ❌ `controller/matrix_service.py` - 旧的 Matrix 服务
- ❌ `event_handlers.py` - 根目录下的旧事件处理器

#### 配置相关
- ❌ `launcher_config.py` - 旧的启动配置
- ❌ `matrix_config/ui_config.py` - 旧的 UI 配置
- ❌ `matrix_config/__init__.py` - 旧的配置目录

### 2. 保留/新增的文件（新架构）

#### 主入口（唯一）
- ✅ `matrix_main.py` - **唯一主入口**，遵循 `{appname}_main.py` 标准

#### 配置（唯一）
- ✅ `config.py` - **唯一配置文件**，集中管理所有配置

#### Controller（功能控制器）
- ✅ `controller/launcher_builder.py` - 构建 `LauncherConfig` 配置
- ✅ `controller/frontend_compiler.py` - 前端编译逻辑
- ✅ `controller/event_handlers.py` - THREAD_BUS 事件处理器
- ✅ `controller/__init__.py` - 统一导出接口

#### API & Services
- ✅ `api/` - FastAPI 路由（注册到 RPC v2）
- ✅ `services/` - 业务逻辑服务层

## 架构改进

### 旧架构（已废弃）
```
matrix/
├── frontend_launcher.py          ❌ 直接启动前端
├── launcher/webview_launcher.py  ❌ 直接启动 webview
├── matrix_service_starter.py     ❌ 直接启动服务
├── launcher_config.py            ❌ 重复配置
└── matrix_config/                ❌ 重复配置
```

### 新架构（当前）
```
matrix/
├── matrix_main.py                ✅ 唯一主入口
├── config.py                     ✅ 唯一配置
├── controller/                   ✅ 功能控制器
│   ├── launcher_builder.py      - 构建 LauncherConfig
│   ├── frontend_compiler.py     - 前端编译
│   └── event_handlers.py        - 事件处理
├── api/                          ✅ FastAPI 路由
└── services/                     ✅ 业务逻辑
```

## RPC v2 使用统一

### ✅ 正确使用方式
所有服务通过 `launcher_builder.py` 中的配置统一使用共用 RPC v2：

```python
services = {
    'rpc_v2': {
        'port': backend_port,
        'host': backend_host,
        'fastapi_routers': [
            health_router,
            device_router,
            # ... 所有 Matrix API 路由
        ],
        'static_mounts': static_mounts  # 前端静态文件
    }
}
```

### ❌ 避免的错误模式
- 不要在 Matrix 应用中重复定义 `FastAPI()` 实例
- 不要创建自定义的 RPC 服务器
- 不要绕过 pylauncher 直接启动服务

## 启动流程

### 标准启动命令
```bash
python .\pymain.py app=matrix
```

### 启动流程
1. `pymain.py` 调用 `pyapps.matrix.matrix_main.start()`
2. `matrix_main.py` 执行：
   - 编译前端（production 模式）
   - 构建 `LauncherConfig`（通过 `build_matrix_launcher_config`）
   - 创建 `ServiceLauncher` 并启动服务
   - 注册事件处理器（通过 `register_matrix_event_handlers`）
   - 等待 Ctrl+C 信号
3. `ServiceLauncher` 自动管理：
   - Heartbeat 服务
   - RPC v2 服务（FastAPI + 所有路由 + 静态文件）
   - UI 服务（PySide6 webview）
   - Tray 服务（系统托盘）

## 配置管理

### 单一配置源
所有配置集中在 `config.py`，包括：
- 应用信息（APP_NAME）
- 项目路径（PROJECT_ROOT, APP_ROOT）
- ADB 配置（get_adb_path()）
- Web 服务配置（WEB_HOST, WEB_PORT）
- 前端配置（FRONTEND_DIR, FRONTEND_PORT, FRONTEND_MODE）
- 视频流配置（DEFAULT_MAX_SIZE, DEFAULT_BIT_RATE）
- WebSocket 配置（WS_BASE_PATH, WS_VIDEO_PATH）
- CORS 配置（CORS_ALLOW_ORIGINS）

### 配置使用
```python
from pyapps.matrix.config import Config

# 直接使用配置
port = Config.WEB_PORT
adb_path = Config.get_adb_path()
```

## 代码重用原则

### ✅ 遵循的标准
1. **单一入口**：只有 `matrix_main.py`
2. **单一配置**：只有 `config.py`
3. **统一服务**：所有服务通过 pylauncher 管理
4. **共用 RPC**：使用 pycore 提供的 RPC v2
5. **功能分离**：controller 负责配置构建，api 负责路由，services 负责业务逻辑

### ✅ 代码重用
- 使用 `pycore.pylauncher` 管理服务生命周期
- 使用 `pycore.pyutils.rpc` 提供的 RPC v2 服务
- 使用 `pycore.pyutils.frontend_launcher` 管理前端
- 使用 `pycore.pyutils.native_ui` 提供的 UI 组件
- 使用 `pycore.pyfoundations.THREAD_BUS` 进行线程间通信

## 验证结果

### ✅ 验证通过
1. **RPC v2 统一**：搜索代码，没有重复定义 FastAPI 实例
2. **配置统一**：只有一个 `config.py` 配置文件
3. **入口唯一**：只有 `matrix_main.py` 作为入口
4. **架构清晰**：controller 只负责配置构建和事件处理
5. **符合标准**：遵循 `development-guides/PYTHON_PYCORE.md` 规范

### 文件统计
- **删除**：13 个过时文件/目录
- **保留**：4 个核心 controller 文件
- **新增**：1 个架构文档（ARCHITECTURE.md）

## 下一步建议

1. ✅ **测试启动**：运行 `python .\pymain.py app=matrix` 验证功能
2. ✅ **代码审查**：确保所有依赖都正确导入
3. ✅ **文档更新**：更新相关开发文档
4. ✅ **提交代码**：提交清理后的代码到版本控制

## 总结

此次重构完成了以下目标：
- ✅ 合并了所有重复配置到单一 `config.py`
- ✅ 统一使用共用 RPC v2（无重复定义）
- ✅ 清理了所有过时的启动器和控制器
- ✅ 建立了清晰的单一入口架构
- ✅ 遵循了 pycore 开发标准

**架构更简洁，代码更规范，维护更容易！**
