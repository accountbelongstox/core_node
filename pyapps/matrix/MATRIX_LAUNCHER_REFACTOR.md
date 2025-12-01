# Matrix 应用 Launcher 重构总结

## ✅ 完成时间
2025-12-01

## 🎯 重构目标
将 Matrix 应用从自定义启动方式改造为完全使用 `pycore/pylauncher` 统一管理，符合 `PYTHON_PYCORE.md` 规范。

---

## 📐 新架构

### 服务架构
```
matrix_main.py (入口)
    ↓
ServiceLauncher (pylauncher)
    ├── heartbeat (系统心跳)
    ├── matrix_service (自定义 - 管理前后端生命周期)
    ├── rpc_v2 (FastAPI backend API - Matrix routes)
    ├── ui (PySide6 webview)
    └── tray (系统托盘 - tkinter + pystray)
```

### 启动流程
```
1. matrix_main.start()
2. ├── 动态注册 matrix_service starter
3. ├── 构建 LauncherConfig (launcher_config.py)
4. ├── ServiceLauncher.start()
5. │   ├── heartbeat (priority 100)
6. │   ├── matrix_service (priority 45)
7. │   │   ├── FrontendController.start_and_wait()
8. │   │   │   ├── Step 1: node switch-app.js pymatrix
9. │   │   │   ├── Step 2: node switch-app.js pymatrix --mode dev (NUXT_PORT=3007)
10. │   │   │   └── wait_for_ready() → http://localhost:3007
11. │   │   └── BackendController.start()
12. │   ├── rpc_v2 (priority 50) → 注册 Matrix API routes
13. │   ├── ui (priority 70) → PySide6 webview (http://localhost:3007)
14. │   └── tray (priority 85) → 系统托盘
15. ├── register_matrix_event_handlers() ← 启动后注册
16. └── while not THREAD_BUS.is_shutdown_requested()
```

---

## 🔧 改造内容

### 1. 新增文件

#### `pyapps/matrix/launcher_config.py`
- 构建 LauncherConfig
- 配置所有服务（heartbeat, rpc_v2, ui, tray）
- 构建 TrayMenuItem 列表（纯数据，无事件注册）

#### `pyapps/matrix/event_handlers.py`
- 注册 THREAD_BUS 事件处理器
- 托盘菜单回调：`tray_action_open_frontend`, `tray_action_open_api_docs`, `tray_action_exit`

#### `pyapps/matrix/matrix_service_starter.py`
- 自定义服务启动器
- 管理 Matrix 前后端生命周期
- 在 matrix_main.py 中动态注册到 SERVICE_STARTERS

### 2. 修改文件

#### `pyapps/matrix/matrix_main.py`
**修改前**：使用 `launch_native_app()` + BackendController
**修改后**：使用 `ServiceLauncher` + 动态注册 matrix_service

**关键改动**：
```python
# 动态注册 matrix_service starter（不污染 pycore 公共库）
SERVICE_STARTERS['matrix_service'] = start_matrix_service

# 使用 LauncherConfig 配置所有服务
launcher_config = build_matrix_launcher_config(...)
launcher_config.services['matrix_service'] = {...}

# 启动 launcher
launcher = ServiceLauncher(launcher_config)
launcher.start()

# 注册事件处理器（启动后）
register_matrix_event_handlers(...)

# 保持主线程运行
while not THREAD_BUS.is_shutdown_requested():
    time.sleep(1)
```

#### `pyapps/matrix/controller/frontend_controller.py`
**修改前**：使用旧脚本 `switch-app-entry.js`, `switch-app-entry-plus.js`
**修改后**：使用新脚本 `switch-app.js`

**关键改动**：
```python
# 旧脚本（不存在）
self.switch_entry_script = "switch-app-entry.js"
self.switch_plus_script = "switch-app-entry-plus.js"

# 新脚本（存在）
self.switch_app_script = "switch-app.js"

# 设置正确的端口
set NUXT_PORT=3007
node switch-app.js pymatrix --mode dev
```

#### `pyapps/matrix/controller/matrix_service.py`
**修改前**：`MatrixServiceConfig` 包含 `enable_ui` 和 `enable_tray`
**修改后**：移除 UI/Tray 相关字段（由 pylauncher 管理）

**关键改动**：
```python
@dataclass
class MatrixServiceConfig:
    # 移除：
    # enable_ui: bool = True
    # enable_tray: bool = True

    # MatrixService 现在只负责前后端生命周期
    # UI 和 Tray 由 pylauncher 管理
```

---

## 🌟 架构优势

### 1. ✅ 符合规范
完全按照 `PYTHON_PYCORE.md` 规范使用 pylauncher 组织 UI, Tray, RPC v2

### 2. ✅ 不污染公共库
- `matrix_service` 在 matrix_main.py 中动态注册
- 所有 Matrix 特有代码都在 `pyapps/matrix/` 中
- pycore 公共代码保持干净

### 3. ✅ 统一生命周期管理
- 所有服务通过 THREAD_BUS 统一管理
- 优雅关闭：按优先级顺序关闭 (45 → 50 → 70 → 85 → 100)
- 单例检测：自动支持

### 4. ✅ 模块化解耦
- UI (PySide6 webview) - 独立服务
- Tray (tkinter + pystray) - 独立服务
- RPC v2 (FastAPI) - 独立服务
- Matrix 业务逻辑 (前后端) - 自定义服务

### 5. ✅ 事件驱动通信
- 托盘菜单通过 THREAD_BUS 事件驱动
- 使用 `THREAD_BUS.register_event_handler()` 注册回调
- 线程安全的跨线程通信

### 6. ✅ 前端集成 Nuxt Multi-App
- 使用统一的 `switch-app.js` 脚本
- 支持 factory sync + dev server
- 自动设置 `NUXT_PORT=3007`

---

## 📊 服务关闭顺序

```
1. matrix_service (45) → 关闭前后端
   ├── frontend.stop() → 终止 Nuxt dev server
   └── backend.stop() → 关闭 FastAPI 线程
2. rpc_v2 (50) → 关闭 FastAPI uvicorn
3. ui (70) → 关闭 PySide6 窗口
4. tray (85) → 关闭托盘图标
5. heartbeat (100) → 最后关闭心跳
```

---

## 🔌 端口配置

| 服务 | 端口 | 说明 |
|------|------|------|
| Frontend (Nuxt) | 3007 | Matrix 前端（poly_apps/nuxt_main/apps/app_pymatrix） |
| Backend (FastAPI) | 8000 | Matrix 后端 API |

---

## 📝 注意事项

### 1. 前端启动流程
1. **Step 1**: 切换 pages 目录到 pymatrix
   ```bash
   node switch-app.js pymatrix
   ```

2. **Step 2**: 启动 factory sync 和 dev server（新窗口）
   ```bash
   set NUXT_PORT=3007
   node switch-app.js pymatrix --mode dev
   ```

3. **Step 3**: 等待前端就绪（最多 120 秒）
   ```python
   wait_for_ready(timeout=120) → http://localhost:3007
   ```

### 2. 托盘菜单事件
- `tray_action_open_frontend` → 打开 http://localhost:3007
- `tray_action_open_api_docs` → 打开 http://0.0.0.0:8000/docs
- `tray_action_exit` → THREAD_BUS.request_shutdown()

### 3. UI 和 Tray 分离
- UI service: `enable_tray=False` （不让 PySide6 创建托盘）
- Tray service: 独立的托盘服务（使用 tkinter + pystray）
- 避免两个托盘系统冲突

---

## 🎯 符合的规范

- ✅ `development-guides/PYTHON_PYCORE.md` - 使用 pylauncher 组织服务
- ✅ `development-guides/NUXT_MULTI_APP_ARCHITECTURE.md` - 使用 switch-app.js
- ✅ `pycore/callmodule` - 参考模式（动态注册服务、事件驱动）

---

## 🚀 启动命令

```bash
# 方式 1: 通过 pymain.py
python pymain.py app=matrix

# 方式 2: 直接运行
python pyapps/matrix/matrix_main.py
```

---

## ✅ 测试清单

- [ ] matrix_service 成功启动
- [ ] 前端 Nuxt dev server 启动在 3007 端口
- [ ] 后端 FastAPI 启动在 8000 端口
- [ ] PySide6 webview 加载 http://localhost:3007
- [ ] 托盘图标显示并可点击
- [ ] 托盘菜单项功能正常
- [ ] Ctrl+C 优雅关闭所有服务
- [ ] 托盘 Exit 正常关闭应用

---

## 🎉 重构完成！

Matrix 应用现在完全符合 pylauncher 架构规范，实现了模块化、可扩展、统一管理的服务架构！
