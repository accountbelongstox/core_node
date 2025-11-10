# Matrix Application 启动检查清单

**日期**: 2025-11-10
**状态**: ✅ 准备启动

---

## 启动流程配置验证

### ✅ 1. 依赖管理
- **pycore/__init__.py**: 自动依赖检查 (Line 181-187)
- **ENCYCLOPEDIA 缓存**: 避免重复检查
- **PySide6**: 自动安装

### ✅ 2. 启动窗口 (Tkinter)
- **文件**: `pycore/pyutils/native_ui/startup_window.py`
- **功能**:
  - Logo 显示
  - 语言选择器 (跟随系统/English/简体中文/日本語)
  - 实时日志捕获
  - 进度条动画
  - 窗口闪现修复 (withdraw/deiconify)
  - 进度条定时器清理

### ✅ 3. i18n 多语言
- **文件**: `pycore/pyutils/native_ui/i18n/i18n_manager.py`
- **语言包**: en/zh/ja
- **位置**:
  - Native UI: `pycore/pyutils/native_ui/i18n/translations/`
  - Matrix App: `pyapps/matrix/i18n/`
- **系统语言检测**: locale.getdefaultlocale()

### ✅ 4. 主应用入口
- **文件**: `pyapps/matrix/matrix_main.py`
- **函数**:
  - `start()`: 启动入口
  - `main_app_entry()`: PySide6 主应用
  - `create_launcher_config()`: 启动器配置
  - `create_matrix_service_config()`: 服务配置

### ✅ 5. PySide6 主窗口
- **框架**: PySide6Framework
- **配置**: PySide6UIConfig
- **组件**:
  - 无边框窗口
  - 自定义标题栏 + Logo
  - WebEngine (QtWebEngineWidgets)
  - Loading 页面
  - 系统托盘菜单

### ✅ 6. Matrix 服务
- **Frontend**: Nuxt dev server (Port 3007)
- **Backend**: FastAPI server (Port 8000)
- **服务入口**: `pyapps/matrix/controller/matrix_service.py`

### ✅ 7. 配置文件
- **文件**: `pyapps/matrix/config.py`
- **配置**:
  - `FRONTEND_PORT = 3007`
  - `WEB_HOST = 0.0.0.0`
  - `WEB_PORT = 8000`
  - `MODE = "dev"`

---

## 完整启动流程

```
┌─────────────────────────────────────────────────────────────┐
│ 1. python pymain.py app=matrix                               │
├─────────────────────────────────────────────────────────────┤
│ 2. pymain.py 导入 pycore                                     │
│    ↓                                                         │
│    pycore/__init__.py:181-187                               │
│    check_and_install_dependencies()                         │
│    - 检查 PySide6 (安装如果缺失)                            │
│    - ENCYCLOPEDIA['pycore_dependencies_checked'] = True     │
├─────────────────────────────────────────────────────────────┤
│ 3. pymain.py → matrix_main.start()                          │
│    ↓                                                         │
│    - 初始化 i18n_manager                                     │
│    - 加载语言包 (en/zh/ja)                                   │
│    - 检测系统语言                                            │
├─────────────────────────────────────────────────────────────┤
│ 4. launch_app_with_startup()                                │
│    ↓                                                         │
│    启动窗口显示 (StartupWindow)                              │
│    - Tkinter 原生窗口                                        │
│    - Logo: "星灿传媒科技-云矩阵"                             │
│    - 语言选择器 (4个单选按钮)                                │
│    - 实时日志输出                                            │
│    - 进度条动画                                              │
│    ↓                                                         │
│    check_and_install_dependencies() [第2次]                 │
│    - 缓存命中，立即返回 (< 1ms)                             │
│    ↓                                                         │
│    等待最小显示时间 (2秒)                                    │
│    ↓                                                         │
│    startup.close()                                          │
├─────────────────────────────────────────────────────────────┤
│ 5. main_app_entry()                                         │
│    ↓                                                         │
│    导入 PySide6 组件                                         │
│    from pycore.pyutils.native_ui.pyside6 import (           │
│        PySide6Framework,                                    │
│        PySide6UIConfig,                                     │
│        PySide6TrayMenuItem                                  │
│    )                                                         │
│    ↓                                                         │
│    创建 UnifiedLauncher                                      │
│    ↓                                                         │
│    注册 Matrix 服务                                          │
│    launcher.register_custom_service(                        │
│        service_name='matrix_service',                       │
│        entry_point=matrix_service_entry,                    │
│        config=matrix_config                                 │
│    )                                                         │
│    ↓                                                         │
│    启动 Matrix 服务                                          │
│    launcher.start_service('matrix_service')                 │
│    - Frontend: Nuxt (Port 3007)                             │
│    - Backend: FastAPI (Port 8000)                           │
│    ↓                                                         │
│    等待服务启动 (5秒)                                        │
├─────────────────────────────────────────────────────────────┤
│ 6. 创建 PySide6 UI                                           │
│    ↓                                                         │
│    ui_config = PySide6UIConfig(                             │
│        app_name="星灿传媒科技-云矩阵",                       │
│        window_size=(1280, 900),                             │
│        frameless=True,                                      │
│        enable_webview=True,                                 │
│        webview_url="http://localhost:3007",  ← WebEngine   │
│        enable_loading_page=True,                            │
│        enable_tray=True,                                    │
│        tray_menu_items=[...]                                │
│    )                                                         │
│    ↓                                                         │
│    app = PySide6Framework(ui_config)                        │
│    ↓                                                         │
│    app.start()  ← 阻塞直到窗口关闭                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 关键文件清单

### 启动层
1. `pymain.py` - 应用启动器
2. `pycore/__init__.py` - 依赖管理
3. `pycore/pyfoundations/encyclopedia.py` - 全局缓存

### 启动窗口层
4. `pycore/pyutils/native_ui/startup_window.py` - Tkinter 启动窗口
5. `pycore/pyutils/native_ui/launcher_with_startup.py` - 启动窗口包装器
6. `pycore/pyutils/native_ui/i18n/i18n_manager.py` - 多语言管理

### 主应用层
7. `pyapps/matrix/matrix_main.py` - Matrix 主入口
8. `pyapps/matrix/config.py` - Matrix 配置
9. `pyapps/matrix/controller/matrix_service.py` - Matrix 服务

### PySide6 层
10. `pycore/pyutils/native_ui/pyside6/framework.py` - PySide6 框架
11. `pycore/pyutils/native_ui/pyside6/system_tray.py` - 系统托盘

### 语言包
12. `pycore/pyutils/native_ui/i18n/translations/` - Native UI 语言包
13. `pyapps/matrix/i18n/` - Matrix 应用语言包

---

## 修复的问题

### Issue #1: 缺少 Any 类型导入 ✅
- **文件**: startup_window.py:17
- **修复**: `from typing import Optional, Callable, Any`

### Issue #2: ColorPrint 方法名错误 ✅
- **文件**: i18n_manager.py
- **修复**: 24处替换 (print_info → blue, print_warn → yellow, etc.)

### Issue #3: 进度条定时器泄漏 ✅
- **文件**: startup_window.py:353-358
- **修复**: `self.progress_bar.stop()` before destroy

### Issue #4: 窗口闪现 ✅
- **文件**: startup_window.py:107, 134
- **修复**: `withdraw()` before UI creation, `deiconify()` after

---

## 验证清单

### 启动前检查
- [x] pycore/__init__.py 存在且可导入
- [x] startup_window.py 语法正确
- [x] i18n_manager.py 语法正确
- [x] matrix_main.py 语法正确
- [x] config.py 配置完整

### 启动窗口检查
- [ ] 启动窗口显示 (无闪现)
- [ ] Logo 图片显示
- [ ] 语言选择器显示 (4个单选按钮)
- [ ] 默认选中 "跟随系统"
- [ ] 系统语言自动检测
- [ ] 日志实时显示
- [ ] 进度条动画运行
- [ ] 关闭时无定时器错误

### PySide6 主窗口检查
- [ ] 主窗口显示 (无边框)
- [ ] 标题栏显示 Logo
- [ ] Loading 页面显示
- [ ] WebEngine 加载前端 (http://localhost:3007)
- [ ] 托盘图标显示
- [ ] 托盘菜单可用 (打开前端/API文档)
- [ ] 最小化到托盘功能

### 服务检查
- [ ] Frontend 服务启动 (Port 3007)
- [ ] Backend 服务启动 (Port 8000)
- [ ] 前端页面可访问
- [ ] API 文档可访问 (/docs)

### 关闭检查
- [ ] 关闭窗口触发服务停止
- [ ] 所有进程正常退出
- [ ] 无僵尸进程残留

---

## 启动命令

### 正常启动
```bash
python pymain.py app=matrix
```

### 调试模式
```bash
# 禁用 GPU 检测
set PYCORE_ENABLE_GPU_SETUP=false
python pymain.py app=matrix

# 跳过依赖检查 (开发调试)
set PYCORE_SKIP_DEP_CHECK=1
python pymain.py app=matrix
```

### 测试启动窗口
```bash
python test_startup_window_i18n.py
```

---

## 预期日志输出

### 阶段 1: 依赖检查 (pycore 导入时)
```
[INFO] Checking for required Python packages...
[INFO] Found installed packages: Pillow, adb-shell, av, fastapi, ...
[INFO] All required packages are available.
[INFO] GPU manager not available, skipping GPU setup
```

### 阶段 2: Matrix 启动
```
======================================================================
 MATRIX APPLICATION - STARTING
======================================================================

[I18nManager] Initialized (singleton)
[I18nManager] System locale detected: en_US -> en
[I18nManager] Loaded translations for language: en
[I18nManager] Loaded translations for language: zh
[I18nManager] Loaded translations for language: ja
[Matrix] Initialized i18n with language: zh
```

### 阶段 3: 启动窗口
```
(Tkinter 窗口显示，日志在窗口中实时显示)
```

### 阶段 4: 主应用启动
```
======================================================================
 MATRIX - STARTING SERVICES
======================================================================

Creating launcher configuration...
Creating Matrix service configuration...
Registering Matrix service...
Starting Matrix service (Frontend + Backend)...
Waiting for services to start...

Creating PySide6 UI...
Creating PySide6 framework...

======================================================================
 MATRIX APPLICATION READY
======================================================================

Services:
  - Matrix Service: Running
  - Frontend: http://localhost:3007
  - Backend API: http://0.0.0.0:8000

Close window to stop

======================================================================

[Matrix] Starting PySide6 UI...
```

---

## 故障排除

### 问题: 启动窗口闪现空白窗口
- **原因**: withdraw/deiconify 顺序错误
- **解决**: 已修复 (startup_window.py:107, 134)

### 问题: 进度条 "winfo" 错误
- **原因**: 进度条动画未停止
- **解决**: 已修复 (startup_window.py:354-357)

### 问题: ColorPrint 方法不存在
- **原因**: 使用了 print_info 等不存在的方法
- **解决**: 已修复 (i18n_manager.py - 24处替换)

### 问题: PySide6 导入失败
- **原因**: 依赖未安装
- **解决**: pycore/__init__.py 自动安装

### 问题: 前端无法访问
- **原因**: Frontend 服务未启动或端口被占用
- **检查**:
  ```bash
  netstat -ano | findstr "3007"
  ```

### 问题: 托盘图标不显示
- **原因**: icon.png 文件不存在
- **位置**: `pyapps/matrix/icon.png`

---

## 性能指标

### 启动时间 (预期)
- **冷启动** (首次安装依赖): 5-10秒
- **热启动** (依赖已安装): 3-5秒
  - pycore 导入: < 1秒
  - 启动窗口显示: 2秒
  - 服务启动: 5秒
  - PySide6 UI: 1-2秒

### 内存占用
- **启动窗口**: ~10MB
- **PySide6 主应用**: ~80-120MB
- **Frontend + Backend**: ~100-200MB
- **总计**: ~200-350MB

---

## 文档清单

### 实现文档
1. ✅ `LANGUAGE_SELECTOR_INTEGRATION.md` - 语言选择器实现
2. ✅ `ALL_FIXES_SUMMARY.md` - 所有修复总结
3. ✅ `WINDOW_FLASH_FIX.md` - 窗口闪现修复
4. ✅ `PROGRESSBAR_FIX.md` - 进度条修复
5. ✅ `STARTUP_FLOW_OPTIMIZATION.md` - 启动流程优化
6. ✅ `TRAY_MENU_STATUS.md` - 托盘菜单状态
7. ✅ `FINAL_STATUS_REPORT.md` - 最终状态报告

### 测试脚本
8. ✅ `test_startup_window_i18n.py` - 启动窗口测试

### 检查清单
9. ✅ `MATRIX_STARTUP_CHECKLIST.md` - 本文档

---

## 下一步

### 立即执行
```bash
python pymain.py app=matrix
```

### 预期结果
- ✅ 启动窗口显示 (2秒)
- ✅ PySide6 主窗口启动
- ✅ 前端页面加载
- ✅ 托盘图标显示
- ✅ 所有功能正常

---

**最后更新**: 2025-11-10
**状态**: ✅ 准备启动
**测试**: 待执行
