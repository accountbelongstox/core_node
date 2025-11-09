# Matrix UI Startup Fix - Step by Step

## Problem Analysis

原始启动存在的问题：
1. 无法获取 `service_instance` - Matrix service 启动时未正确返回实例
2. UI 启动方式不正确 - 直接使用 pylauncher 的 `ui_thread_service` 而不是自定义 UI
3. 缺少 webview 内容创建逻辑

## Solution Steps

### Step 1: 分析 ui_thread_test 实现

参考了 `pyapps/ui_thread_test` 的正确实现方式：

**关键发现：**
- 使用 `NativeUIThread` 和 `NativeUIThreadConfig`
- 通过 `on_create_content` 回调创建自定义 UI 内容
- 在自定义服务入口函数中管理 UI 线程生命周期

### Step 2: 创建 MatrixUIController

**文件：** `pyapps/matrix/controller/ui_controller.py`

**功能：**
- 创建 webview UI 内容
- 支持多种 webview 库（tkinterweb、tkhtmlview）
- 降级处理（无 webview 时显示信息和打开浏览器按钮）

**关键方法：**
```python
class MatrixUIController:
    def __init__(self, frontend_url: str)
    def create_ui_content(self, content_frame: tk.Frame)  # UI 内容创建回调
    def _create_webview(self, parent: tk.Frame)           # 创建 webview
    def _show_webview_unavailable(...)                    # 降级处理
```

### Step 3: 重写 matrix_main.py

**架构变化：**

之前（错误方式）：
```python
# 错误：期望从 service_instance 获取 MatrixService
matrix_service_thread = launcher.services.get('matrix_service')
if matrix_service_thread and matrix_service_thread.service_instance:
    matrix_service = matrix_service_thread.service_instance
    # 使用 pylauncher 的默认 ui_thread_service
    launcher.start_service('ui_thread_service')
```

现在（正确方式）：
```python
# 1. 注册并启动 Matrix service
launcher.register_custom_service('matrix_service', ...)
launcher.start_service('matrix_service')

# 2. 创建 UI controller
ui_controller = MatrixUIController(frontend_url="http://localhost:3007")

# 3. 定义自定义 UI 入口函数
def custom_ui_entry(ui_config):
    ui_thread_config = NativeUIThreadConfig(
        on_create_content=ui_controller.create_ui_content,  # 关键：内容创建回调
        on_ready=lambda: ColorPrint.green("UI ready!"),
        on_close=lambda: ColorPrint.yellow("UI closing...")
    )

    ui_thread = NativeUIThread(config=ui_thread_config)
    ui_thread.start()
    ui_thread.wait_until_ready()

    # 保持线程运行
    while ui_thread.is_running():
        time.sleep(0.1)

    return ui_thread

# 4. 注册并启动自定义 UI service
launcher.register_custom_service('matrix_ui', custom_ui_entry, ...)
launcher.start_service('matrix_ui')
```

### Step 4: 服务架构

**两个独立的服务：**

1. **matrix_service** (Matrix 核心服务)
   - 启动 Frontend (Nuxt)
   - 启动 Backend (FastAPI)
   - 等待 Frontend 就绪
   - 独立运行，不依赖 UI

2. **matrix_ui** (UI 服务)
   - 创建 Native UI 窗口
   - 嵌入 webview
   - 加载 Frontend URL
   - 独立于 Matrix service

**优点：**
- 服务解耦，职责清晰
- Matrix service 可以独立运行（无 UI 模式）
- UI 可以独立重启
- 更容易调试和维护

## Updated File Structure

```
pyapps/matrix/
├── controller/
│   ├── __init__.py                   # 更新：添加 MatrixUIController
│   ├── frontend_controller.py        # 不变
│   ├── backend_controller.py         # 不变
│   ├── matrix_service.py             # 不变
│   └── ui_controller.py              # 新增：UI 内容创建
├── matrix_main.py                     # 重写：正确使用 NativeUIThread
├── STEP_BY_STEP_UI_FIX.md            # 新增：本文档
└── ... (其他文件)
```

## Key Differences

### Before (Incorrect)

```python
# matrix_main.py (旧版)
def start():
    # ... 启动 matrix_service ...

    # 错误：尝试从 service_instance 获取 MatrixService
    matrix_service_thread = launcher.services.get('matrix_service')
    if matrix_service_thread and matrix_service_thread.service_instance:
        matrix_service = matrix_service_thread.service_instance

        # 错误：使用默认 UI service，没有自定义内容
        launcher.start_service('ui_thread_service')
```

**问题：**
1. `service_instance` 可能为 None（service 还在初始化）
2. 默认 UI service 没有加载 webview 的逻辑
3. 依赖 service_instance 导致耦合度高

### After (Correct)

```python
# matrix_main.py (新版)
def start():
    # 1. 启动 matrix_service
    launcher.start_service('matrix_service')

    # 2. 创建 UI controller（独立）
    ui_controller = MatrixUIController(...)

    # 3. 定义自定义 UI 入口（包含内容创建逻辑）
    def custom_ui_entry(ui_config):
        ui_thread_config = NativeUIThreadConfig(
            on_create_content=ui_controller.create_ui_content
        )
        ui_thread = NativeUIThread(config=ui_thread_config)
        # ... 启动和保持运行 ...

    # 4. 注册并启动自定义 UI service
    launcher.register_custom_service('matrix_ui', custom_ui_entry, ...)
    launcher.start_service('matrix_ui')
```

**优点：**
1. 不依赖 service_instance
2. UI 内容创建逻辑清晰（通过回调）
3. 服务独立，松耦合
4. 遵循 pycore 架构模式

## Testing Instructions

### 1. 测试完整启动

```bash
python ./pymain.py app=matrix
```

**期望结果：**
1. ✅ Matrix service 启动（Frontend + Backend）
2. ✅ Native UI 窗口出现
3. ✅ Webview 加载 http://localhost:3007
4. ✅ 前端界面正常显示

### 2. 测试无 webview 库的情况

**模拟：** 暂时卸载 webview 库
```bash
pip uninstall tkinterweb tkhtmlview -y
```

**运行：**
```bash
python ./pymain.py app=matrix
```

**期望结果：**
1. ✅ UI 窗口仍然打开
2. ✅ 显示信息："WebView library not available"
3. ✅ 显示安装提示
4. ✅ 显示 "Open http://localhost:3007 in Browser" 按钮
5. ✅ 点击按钮可以打开浏览器

**恢复：**
```bash
pip install tkinterweb
```

### 3. 测试服务独立性

**场景 1：** Backend 启动失败
- Matrix service 应该失败
- UI service 可以继续启动（显示无法连接）

**场景 2：** Frontend 未就绪
- Matrix service 等待超时
- UI service 仍然启动（webview 显示加载中）

**场景 3：** UI 关闭
- 关闭 UI 窗口
- Matrix service 继续运行
- Frontend 和 Backend 仍然可访问

## Benefits

1. **正确的架构**
   - 遵循 NativeUIThread 的正确使用方式
   - 参考了 ui_thread_test 的最佳实践
   - 服务职责清晰

2. **更好的可维护性**
   - UI 逻辑分离到 MatrixUIController
   - 服务独立，松耦合
   - 易于调试和测试

3. **降级处理**
   - 无 webview 库时仍可使用
   - 提供友好的错误提示
   - 提供打开浏览器的选项

4. **扩展性**
   - 易于添加系统托盘（后续）
   - 易于添加多种 UI 模式（webview/custom）
   - 易于支持无 UI 模式

## Next Steps

### Immediate (已完成)
- ✅ 创建 MatrixUIController
- ✅ 重写 matrix_main.py
- ✅ 更新 controller/__init__.py
- ✅ 编写本文档

### Short Term (后续)
- [ ] 添加系统托盘菜单
- [ ] 添加 UI 控制（最小化、最大化）
- [ ] 添加 Python-JavaScript 桥接
- [ ] 添加前端状态监控

### Long Term (未来)
- [ ] 支持多种 UI 模式（webview/custom/browser）
- [ ] 支持无 UI 模式（server only）
- [ ] 添加 UI 主题切换
- [ ] 添加配置 UI

## Troubleshooting

### 问题 1: UI 窗口不出现

**检查：**
1. 确认 matrix_ui service 已启动
2. 查看控制台输出：`[MatrixUI] Starting UI thread`
3. 检查是否有错误信息

**解决：**
```bash
# 查看详细日志
python ./pymain.py app=matrix 2>&1 | tee matrix.log
```

### 问题 2: Webview 显示空白

**检查：**
1. Frontend 是否已启动：访问 http://localhost:3007
2. Webview 库是否安装：`pip list | grep tkinter`
3. 查看 MatrixUIController 输出

**解决：**
```bash
# 安装 webview 库
pip install tkinterweb

# 或使用降级方案（浏览器）
# 无需任何操作，UI 会自动显示打开浏览器按钮
```

### 问题 3: Frontend 加载慢

**原因：**
- Nuxt dev server 启动需要时间（编译）
- 首次访问需要编译 Vue 组件

**解决：**
- 增加等待时间：`time.sleep(5)` → `time.sleep(10)`
- 或者：先启动 Frontend，等完全就绪后再启动 UI

## Reference

- **ui_thread_test**: `pyapps/ui_thread_test/main.py`
- **NativeUIThread**: `pycore/pyutils/native_ui/thread_framework.py`
- **NativeUIThreadConfig**: `pycore/pyutils/native_ui/thread_framework.py`
- **pylauncher**: `pycore/pylauncher/launcher.py`

## Summary

本次修复的核心：
1. **学习正确方式** - 参考 ui_thread_test 实现
2. **创建 UI 控制器** - MatrixUIController 负责内容创建
3. **使用回调机制** - on_create_content 创建 webview
4. **独立服务架构** - matrix_service 和 matrix_ui 解耦
5. **降级处理** - 无 webview 时友好提示

现在可以正常启动了！🎉
