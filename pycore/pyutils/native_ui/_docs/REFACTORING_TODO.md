# Native UI 重构计划

## 当前问题

1. **端口配置暴露给用户**：用户需要手动指定 port_start 和 port_range
2. **启动流程复杂**：用户需要显式调用 NativeUILauncher → launch_app_with_startup
3. **配置分散**：UI 配置在多个地方（matrix_config, PySide6UIConfig）
4. **参数过多**：需要传递很多参数

## 重构目标

### 1. 简化 API - 单一入口点

```python
from pycore.pyutils.native_ui import launch_native_app

def start():
    launch_native_app(
        # 基础配置
        app_id="matrix",                    # 应用唯一标识（用于单例检测）
        app_name="Matrix Application",     # 应用显示名称（支持 i18n key）
        main_entry=main_app_entry,         # 主应用入口函数

        # Debug 窗口
        show_debug_window=True,             # 是否显示 debug 日志窗口
        debug_window_width=650,             # Debug 窗口宽度
        debug_window_height=500,            # Debug 窗口高度
        min_display_time=2.0,               # 最小显示时间

        # 托盘配置
        enable_tray=True,                   # 是否启动系统托盘
        tray_type="pyside6",                # 托盘类型: "tk" | "pyside6"
        tray_menu_items=[                   # 托盘菜单项
            {
                "text": "打开前端",          # 菜单文本（支持 i18n key）
                "callback": callback_func    # 回调函数
            }
        ],
        minimize_to_tray=True,              # 最小化到托盘

        # 主窗口 URL 配置
        url="http://localhost:3000",        # 主窗口 URL
        url_type="remote",                  # URL 类型（见下方说明）
        # 或者: url="app_pymatrix", url_type="nuxt_app"

        # UI 样式
        window_size=(1280, 900),            # 窗口大小（或 "fullscreen"）
        frameless=True,                     # 无边框窗口
        loading_style=10,                   # 加载动画样式 (1-14)

        # 图标和 Logo
        icon_path="path/to/icon.png",       # 窗口图标
        logo_path="path/to/logo.png",       # Logo 图片
        logo_size=24,                       # Logo 大小

        # 多语言
        enable_language_selector=True,      # 启用语言选择器

        # 回调函数
        on_ready=lambda: print("Ready"),    # 准备就绪回调
        on_closed=lambda: print("Closed"),  # 关闭回调
        on_closing=cleanup_func,            # 关闭前回调（用于清理资源）

        # 高级选项
        force=False,                        # 强制关闭已有实例
        debug=True                          # 调试模式
    )
```

### 2. URL 类型支持

**url_type 选项**：

1. **"remote"** - 远程 URL
   - `url="http://localhost:3000"`
   - 直接加载远程地址

2. **"static"** - 静态 HTML 文件
   - `url="file:///path/to/index.html"`
   - 加载本地静态页面

3. **"nuxt_app"** - Nuxt 应用（本项目）
   - `url="app_pymatrix"` (应用名)
   - 自动启动 Nuxt dev server (开发模式)
   - 或加载编译后的文件 (生产模式)

4. **"vue_dist"** - Vue 编译目录
   - `url="/path/to/dist"`
   - 加载 Vue 编译后的 dist 目录

5. **"auto"** - 自动检测（默认）
   - 根据 url 字符串自动判断类型

### 3. 自动处理的内容

**端口分配**（自动）：
- 根据 app_id 自动分配端口范围
- 内置端口映射表：
  - matrix: 54100-54199
  - mcp: 54200-54299
  - 其他应用: 54300+ (自动分配)

**启动流程**（自动）：
1. 单例检测（自动）
2. 显示 debug 窗口（如果 show_debug_window=True）
3. 检查依赖（自动）
4. 启动服务（如果需要 - 如 Nuxt）
5. 创建主窗口（PySide6）
6. 创建托盘（如果 enable_tray=True）
7. 调用 main_entry()
8. 进入事件循环

**i18n 初始化**（自动）：
- 自动检测 `pyapps/{appname}/{appname}_i18n/` 目录
- 自动初始化 i18n（如果目录存在）
- 用户不需要手动初始化

**资源路径查找**（自动）：
- 自动根据 app_id 查找图标: `pyapps/{appname}/icon.png`
- 自动查找 i18n 目录
- 自动查找配置目录

### 4. 重构文件清单

#### 新增文件

- [x] `pycore/pyutils/native_ui/REFACTORING_TODO.md` - 本文件
- [ ] `pycore/pyutils/native_ui/launch_native_app.py` - 新的主入口点
- [ ] `pycore/pyutils/native_ui/url_handler.py` - URL 类型处理
- [ ] `pycore/pyutils/native_ui/port_allocator.py` - 端口自动分配
- [ ] `pycore/pyutils/native_ui/app_config.py` - 统一配置类

#### 需要修改的文件

- [ ] `pycore/pylauncher/launcher.py` - 集成到新 API 或标记为 deprecated
- [ ] `pycore/pyutils/native_ui/launcher_with_startup.py` - 重构为内部实现
- [ ] `pycore/pyutils/native_ui/pyside6/framework.py` - 支持 URL 类型
- [ ] `pyapps/matrix/matrix_main.py` - 使用新 API
- [ ] `development-guides/PYTHON_PYCORE_BASE_GUIDE_THIS_FILE_NO_AI_EDIT.md` - 更新文档

### 5. 实现步骤

#### Phase 1: 核心架构（当前）
- [x] 创建 TODO 文件
- [ ] 设计配置数据类
- [ ] 实现端口自动分配
- [ ] 实现 URL 类型处理

#### Phase 2: 主入口点
- [ ] 实现 `launch_native_app()` 函数
- [ ] 集成现有组件
- [ ] 自动 i18n 初始化

#### Phase 3: 测试和迁移
- [ ] 更新 matrix 应用使用新 API
- [ ] 测试所有功能
- [ ] 标记旧 API 为 deprecated

#### Phase 4: 文档
- [ ] 更新开发指南
- [ ] 添加示例代码
- [ ] 更新 README

### 6. 向后兼容性

**策略**：
- 保留旧 API，标记为 deprecated
- 新项目使用新 API
- 逐步迁移现有项目

### 7. 配置数据类设计

```python
@dataclass
class NativeUIConfig:
    """Native UI 统一配置"""

    # 基础
    app_id: str
    app_name: str
    main_entry: Callable

    # Debug 窗口
    show_debug_window: bool = True
    debug_window_width: int = 650
    debug_window_height: int = 500
    min_display_time: float = 2.0

    # 托盘
    enable_tray: bool = False
    tray_type: Literal["tk", "pyside6"] = "pyside6"
    tray_menu_items: List[Dict] = field(default_factory=list)
    minimize_to_tray: bool = True

    # URL
    url: str = ""
    url_type: Literal["remote", "static", "nuxt_app", "vue_dist", "auto"] = "auto"

    # UI 样式
    window_size: Union[Tuple[int, int], Literal["fullscreen"]] = (1280, 900)
    frameless: bool = True
    loading_style: int = 10

    # 图标
    icon_path: Optional[str] = None
    logo_path: Optional[str] = None
    logo_size: int = 24

    # 多语言
    enable_language_selector: bool = True

    # 回调
    on_ready: Optional[Callable] = None
    on_closed: Optional[Callable] = None
    on_closing: Optional[Callable] = None

    # 高级
    force: bool = False
    debug: bool = False
```

### 8. 优先级标记

**P0 - 必须实现**：
- [ ] 端口自动分配
- [ ] 主入口点 `launch_native_app()`
- [ ] 基本 URL 处理（remote）
- [ ] 自动 i18n 初始化

**P1 - 重要功能**：
- [ ] Nuxt app 支持
- [ ] 配置数据类
- [ ] 自动资源路径查找

**P2 - 增强功能**：
- [ ] Vue dist 支持
- [ ] Static HTML 支持
- [ ] 样式自定义

## 注意事项

1. **保持向后兼容**：旧代码继续工作
2. **渐进式重构**：一步步迁移
3. **充分测试**：每个功能都要测试
4. **文档先行**：先设计 API，再实现
