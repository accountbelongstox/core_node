# Matrix 系统托盘菜单配置说明

## 概述

已成功在 Matrix 应用中添加系统托盘菜单支持，托盘功能完全由 `pycore/pyutils/native_ui` 提供，Matrix 应用只需通过配置传递菜单项。

## 架构设计

### 1. 基础架构（pycore/pyutils/native_ui）

**thread_framework.py** 提供托盘集成：
- `NativeUIThreadConfig` 新增托盘配置参数
- `NativeUIThread` 自动创建和管理托盘生命周期
- 与 webview、UI 窗口完全集成

**system_tray.py** 提供托盘功能：
- `SystemTray` 类：托盘管理器
- `TrayMenuItem` 类：菜单项配置
- 跨平台支持（基于 pystray 库）

### 2. 应用层配置（pyapps/matrix）

**matrix_main.py** 只需：
- 导入 `TrayMenuItem`
- 创建菜单项列表
- 配置 `NativeUIThreadConfig` 的托盘参数

## 配置参数说明

### NativeUIThreadConfig 托盘参数

```python
@dataclass
class NativeUIThreadConfig:
    # System Tray settings
    enable_tray: bool = False                    # 启用托盘
    tray_menu_items: Optional[List] = None       # 菜单项列表
    tray_icon_path: Optional[str] = None         # 托盘图标路径
    tray_tooltip: Optional[str] = None           # 托盘提示文字
```

## Matrix 配置示例

### 完整配置代码

```python
from pycore.pyutils.native_ui import NativeUIThread, NativeUIThreadConfig, TrayMenuItem

# 1. 创建 UI 线程引用（用于托盘菜单回调）
ui_thread_ref = [None]

# 2. 辅助函数：打开浏览器
def _open_browser(url):
    import webbrowser
    webbrowser.open(url)
    ColorPrint.blue(f"Opened in browser: {url}")

# 3. 创建托盘菜单项
tray_menu_items = [
    TrayMenuItem(
        text="显示主窗口",
        callback=lambda: ui_thread_ref[0].show_window() if ui_thread_ref[0] else None,
        default=True  # 双击托盘图标时的默认动作
    ),
    TrayMenuItem(
        text="隐藏主窗口",
        callback=lambda: ui_thread_ref[0].hide_window() if ui_thread_ref[0] else None
    ),
    TrayMenuItem.SEPARATOR,  # 分隔符
    TrayMenuItem(
        text="打开前端页面",
        callback=lambda: _open_browser("http://localhost:3007")
    ),
    TrayMenuItem(
        text="打开API文档",
        callback=lambda: _open_browser("http://localhost:8000/docs")
    ),
    TrayMenuItem.SEPARATOR,
    TrayMenuItem(
        text="退出",
        callback=lambda: ui_thread_ref[0].stop() if ui_thread_ref[0] else None
    )
]

# 4. 配置 NativeUIThread
ui_thread_config = NativeUIThreadConfig(
    app_name="Matrix - Android Device Control",
    width=1280,
    height=900,
    ui_source="http://localhost:3007",  # WebView URL

    # 托盘配置
    enable_tray=True,
    tray_menu_items=tray_menu_items,
    tray_tooltip="Matrix - Android Device Control",

    on_ready=lambda: ColorPrint.green("UI is ready!"),
    on_close=lambda: ColorPrint.yellow("UI is closing...")
)

# 5. 创建 UI 线程
ui_thread = NativeUIThread(config=ui_thread_config, thread_name="MatrixUIThread")

# 6. 保存引用供托盘菜单使用
ui_thread_ref[0] = ui_thread

# 7. 启动 UI
ui_thread.start()
ui_thread.wait_until_ready()
```

## 托盘菜单项配置

### TrayMenuItem 参数

```python
@dataclass
class TrayMenuItem:
    text: str                              # 菜单文字
    callback: Optional[Callable] = None    # 点击回调函数
    enabled: bool = True                   # 是否启用
    checked: bool = False                  # 是否显示勾选标记
    default: bool = False                  # 是否为默认动作（双击）
    submenu: Optional[List] = None         # 子菜单项列表
```

### 特殊项：分隔符

```python
TrayMenuItem.SEPARATOR  # 菜单分隔线
```

### 菜单项类型示例

1. **普通菜单项**
```python
TrayMenuItem(
    text="显示窗口",
    callback=lambda: ui_thread.show_window()
)
```

2. **默认动作**（双击托盘图标）
```python
TrayMenuItem(
    text="显示主窗口",
    callback=lambda: ui_thread.show_window(),
    default=True  # 双击托盘图标时执行此操作
)
```

3. **分隔符**
```python
TrayMenuItem.SEPARATOR
```

4. **子菜单**
```python
TrayMenuItem(
    text="更多操作",
    submenu=[
        TrayMenuItem(text="操作1", callback=action1),
        TrayMenuItem(text="操作2", callback=action2)
    ]
)
```

## 托盘功能

### 自动功能

由 `native_ui` 自动提供：

1. **托盘图标显示**
   - 自动创建托盘图标
   - 支持自定义图标（通过 `tray_icon_path`）
   - 默认使用蓝色圆形图标

2. **生命周期管理**
   - UI 启动时自动创建托盘
   - UI 关闭时自动清理托盘
   - 托盘在后台线程运行

3. **事件处理**
   - 左键单击：执行 `on_left_click` 回调
   - 左键双击：执行 `default=True` 的菜单项
   - 右键单击：显示上下文菜单

### 可用的 UI 线程方法

可以在托盘菜单回调中调用：

```python
ui_thread.show_window()    # 显示窗口
ui_thread.hide_window()    # 隐藏窗口
ui_thread.stop()           # 停止 UI（退出应用）
ui_thread.set_title(title) # 设置窗口标题
```

## 完整流程

### 1. 配置传递流程

```
matrix_main.py
  ├── 创建 TrayMenuItem 列表
  ├── 配置 NativeUIThreadConfig
  │   ├── enable_tray=True
  │   ├── tray_menu_items=[...]
  │   └── tray_tooltip="..."
  └── 传递给 NativeUIThread
        ↓
pycore/pyutils/native_ui/thread_framework.py
  ├── 接收配置
  ├── 调用 _start_system_tray()
  └── 创建 SystemTray 实例
        ↓
pycore/pyutils/native_ui/system_tray.py
  ├── 创建托盘图标
  ├── 构建托盘菜单
  └── 启动托盘线程
```

### 2. 运行时序

```
1. matrix_main.py 启动
   ↓
2. 创建 matrix_service (Frontend + Backend)
   ↓
3. 创建托盘菜单配置
   ↓
4. 创建 NativeUIThread 配置（包含托盘）
   ↓
5. 启动 NativeUIThread
   ├── 创建 Tkinter 窗口
   ├── 创建 WebView（显示前端）
   └── 启动系统托盘
   ↓
6. 应用完全启动
   ├── 主窗口显示（WebView）
   └── 托盘图标显示（菜单可用）
```

## 依赖库

托盘功能依赖 `pystray` 库：

```bash
pip install pystray pillow
```

**注意**：`native_ui` 已集成 `check_and_install_dependencies()`，会自动安装缺失的依赖。

## 测试

### 启动应用

```bash
python ./pymain.py app=matrix
```

### 预期行为

1. **主窗口显示**
   - 1280x900 无边框窗口
   - 显示 Matrix 前端界面（WebView）
   - 可以最小化/最大化/关闭

2. **托盘图标显示**
   - 系统托盘出现蓝色圆形图标
   - 鼠标悬停显示 "Matrix - Android Device Control"
   - 右键显示菜单

3. **托盘菜单功能**
   - "显示主窗口" - 恢复窗口显示
   - "隐藏主窗口" - 隐藏窗口（托盘继续运行）
   - "打开前端页面" - 浏览器打开 http://localhost:3007
   - "打开API文档" - 浏览器打开 http://localhost:8000/docs
   - "退出" - 关闭应用

4. **双击托盘图标**
   - 显示主窗口（默认动作）

## 优势总结

### 1. 架构清晰
- ✅ 基础设施在 `pycore` 层
- ✅ 应用配置在 `pyapps` 层
- ✅ 职责分离明确

### 2. 配置简单
- ✅ 只需传递菜单项列表
- ✅ 一行配置启用托盘：`enable_tray=True`
- ✅ 自动处理生命周期

### 3. 可复用性
- ✅ 任何应用可使用相同方式配置托盘
- ✅ 无需重复编写托盘代码
- ✅ 统一的配置接口

### 4. 功能完整
- ✅ 支持所有标准托盘功能
- ✅ 自定义图标和提示
- ✅ 复杂菜单结构（子菜单）
- ✅ 与 UI 窗口集成

## 常见问题

### Q: 如何自定义托盘图标？

```python
ui_thread_config = NativeUIThreadConfig(
    # ...
    tray_icon_path="/path/to/icon.png",  # PNG/ICO 文件
)
```

### Q: 如何创建子菜单？

```python
TrayMenuItem(
    text="设置",
    submenu=[
        TrayMenuItem(text="选项1", callback=action1),
        TrayMenuItem(text="选项2", callback=action2),
    ]
)
```

### Q: 如何禁用某个菜单项？

```python
TrayMenuItem(
    text="正在处理...",
    callback=None,
    enabled=False  # 禁用此菜单项
)
```

### Q: 如何动态更新菜单？

```python
# 通过 SystemTray 实例更新
if ui_thread.system_tray:
    new_menu_items = [...]
    ui_thread.system_tray.update_menu(new_menu_items)
```

## 总结

Matrix 应用现在支持完整的系统托盘功能：

1. ✅ 托盘图标和菜单
2. ✅ 中文菜单支持
3. ✅ 窗口显示/隐藏控制
4. ✅ 快捷操作（打开浏览器）
5. ✅ 优雅退出

所有功能通过配置实现，无需编写托盘相关代码，完全由 `pycore/pyutils/native_ui` 提供支持。
