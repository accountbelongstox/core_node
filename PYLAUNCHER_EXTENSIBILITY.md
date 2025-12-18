# PyLauncher 可扩展性分析

## Date: 2025-12-18

## 当前架构

### 公开 API（简化后）
```python
__all__ = [
    'launch_with_native_ui',  # 唯一公开方法
]
```

---

## 可扩展性评估

### ✅ 优点

#### 1. 参数化配置（高度可扩展）
```python
def launch_with_native_ui(
    # 120+ 参数，涵盖所有配置
    app_id: str,
    frontend_enabled: bool = False,
    frontend_framework: Optional[str] = None,
    rpc_enabled: bool = False,
    rpc_routers: Optional[List] = None,
    webengine_chromium_flags: Optional[Dict[str, str]] = None,
    ...
):
    # 内部创建 NativeUIConfig
    # 调用 launch_native_app(config)
```

**可扩展方式**:
- ✅ 添加新参数 → 向后兼容（默认值）
- ✅ 支持任意 RPC routers
- ✅ 支持任意前端框架
- ✅ 支持自定义 ChromiumFlags

**示例 - 添加新功能**:
```python
# 现有代码不需要修改
launch_with_native_ui(
    app_id="my_app",
    ...
)

# 新功能 - 只需添加参数
launch_with_native_ui(
    app_id="my_app",
    enable_websocket=True,  # 新参数
    websocket_port=9000,    # 新参数
    ...
)
```

#### 2. 回调机制（高度可扩展）
```python
launch_with_native_ui(
    on_ready_callbacks=[callback1, callback2],
    on_closing_callbacks=[cleanup1, cleanup2],
    rpc_init_callback=init_routes,
    on_restart_callback=restart_handler,
)
```

**可扩展方式**:
- ✅ 支持多个回调（List）
- ✅ 回调链顺序执行
- ✅ 用户可注入自定义逻辑

#### 3. 路由可扩展（Router-based）
```python
launch_with_native_ui(
    rpc_routers=[
        status_router,
        config_router,
        custom_router1,  # 用户自定义
        custom_router2,  # 用户自定义
    ]
)
```

**可扩展方式**:
- ✅ 无限制添加 routers
- ✅ FastAPI 标准，易于理解
- ✅ 支持动态注册

#### 4. 配置对象可扩展（Dict-based）
```python
launch_with_native_ui(
    webengine_chromium_flags={
        '--disable-gpu': None,
        '--custom-flag': 'value',  # 用户自定义
    }
)
```

**可扩展方式**:
- ✅ Dict 可接受任意键值对
- ✅ 不需要修改源代码

---

### ⚠️ 局限性

#### 1. 参数过多（100+ 参数）
```python
def launch_with_native_ui(
    # 必需参数
    app_id: str,
    app_name: str,
    # 可选参数 (100+)
    frontend_enabled: bool = False,
    ...  # 太多参数
):
```

**问题**:
- ⚠️ 函数签名过长
- ⚠️ IDE 自动补全缓慢
- ⚠️ 文档维护困难

**改进方案 1: 使用配置对象**:
```python
@dataclass
class LaunchConfig:
    app_id: str
    app_name: str
    frontend: FrontendConfig = None
    rpc: RPCConfig = None
    ui: UIConfig = None

launch_with_native_ui(config: LaunchConfig)
```

**改进方案 2: 使用 Builder 模式**:
```python
launcher = LauncherBuilder(app_id="my_app")
launcher.with_frontend(framework="vite", port=3000)
launcher.with_rpc(routers=[...])
launcher.with_ui(frameless=True)
launcher.launch()
```

#### 2. 不支持插件化（缺少插件系统）
```python
# 当前：必须在参数中定义所有功能
launch_with_native_ui(
    app_id="my_app",
    frontend_enabled=True,  # 硬编码
    rpc_enabled=True,       # 硬编码
)

# 理想：支持插件
launcher = Launcher(app_id="my_app")
launcher.use(FrontendPlugin(framework="vite"))  # 插件
launcher.use(RPCPlugin(routers=[...]))          # 插件
launcher.use(CustomPlugin())                    # 用户插件
launcher.launch()
```

**改进方案: 插件系统**:
```python
class Plugin:
    def on_before_launch(self, config): ...
    def on_after_launch(self, app): ...
    def on_shutdown(self): ...

class MyPlugin(Plugin):
    def on_before_launch(self, config):
        # 自定义逻辑
        config.custom_setting = "value"

launch_with_native_ui(
    app_id="my_app",
    plugins=[FrontendPlugin(), RPCPlugin(), MyPlugin()]
)
```

#### 3. 模式切换不灵活（参数组合复杂）
```python
# UI 模式
launch_with_native_ui(
    frontend_enabled=True,
    rpc_enabled=True,
    show_on_start=True,
)

# 后端模式
launch_with_native_ui(
    frontend_enabled=False,
    rpc_enabled=True,
    show_on_start=False,
)
```

**改进方案: 预设模式**:
```python
# 方案 1: 模式参数
launch_with_native_ui(
    mode="ui",  # ui | backend | headless | custom
    app_id="my_app",
    ...
)

# 方案 2: 工厂方法
LauncherFactory.create_ui_app(app_id="my_app", ...)
LauncherFactory.create_backend_app(app_id="my_app", ...)
LauncherFactory.create_headless_app(app_id="my_app", ...)
```

---

## 推荐改进方案

### 方案 A: 保持当前设计 + 小改进（推荐）

**优点**:
- ✅ 向后兼容
- ✅ 最小改动
- ✅ 用户熟悉

**改进**:
1. 添加配置预设:
```python
# 预设配置
UI_APP_DEFAULTS = {
    'frontend_enabled': True,
    'rpc_enabled': True,
    'show_on_start': True,
}

BACKEND_APP_DEFAULTS = {
    'frontend_enabled': False,
    'rpc_enabled': True,
    'show_on_start': False,
}

def launch_with_native_ui(
    app_id: str,
    preset: Optional[str] = None,  # "ui_app" | "backend_app"
    **overrides
):
    if preset:
        defaults = PRESETS[preset]
        config = {**defaults, **overrides}
    else:
        config = overrides
```

2. 添加插件钩子:
```python
def launch_with_native_ui(
    ...
    before_launch_hook: Optional[Callable] = None,
    after_launch_hook: Optional[Callable] = None,
    ...
):
    if before_launch_hook:
        before_launch_hook(config)

    # Launch...

    if after_launch_hook:
        after_launch_hook(app)
```

### 方案 B: 全面重构（不推荐 - 破坏性变更）

**不推荐原因**:
- ❌ 破坏向后兼容
- ❌ 需要更新所有代码
- ❌ 学习成本高

---

## 当前可扩展性评分

| 维度 | 评分 | 说明 |
|------|------|------|
| **参数扩展性** | ⭐⭐⭐⭐⭐ (5/5) | 支持任意参数，默认值向后兼容 |
| **回调扩展性** | ⭐⭐⭐⭐⭐ (5/5) | 支持多回调链，用户可注入逻辑 |
| **路由扩展性** | ⭐⭐⭐⭐⭐ (5/5) | 无限制添加 routers |
| **配置扩展性** | ⭐⭐⭐⭐ (4/5) | Dict-based，但参数过多 |
| **插件扩展性** | ⭐⭐ (2/5) | 缺少插件系统 |
| **模式扩展性** | ⭐⭐⭐ (3/5) | 参数组合复杂，缺少预设 |
| **整体评分** | ⭐⭐⭐⭐ (4.2/5) | **良好** - 高度可扩展，但有改进空间 |

---

## 结论

### ✅ 当前设计已经高度可扩展

1. **参数化配置** - 可以无限添加新功能
2. **回调机制** - 支持用户注入自定义逻辑
3. **路由系统** - 支持动态扩展API
4. **Dict配置** - 支持任意自定义配置

### 🎯 建议小改进

1. 添加配置预设（UI/Backend 模式）
2. 添加插件钩子（before_launch/after_launch）
3. 考虑配置对象（可选，保持向后兼容）

### ❌ 不建议大重构

当前设计已经足够好，不需要破坏性变更。

---

## 扩展示例

### 示例 1: 添加 WebSocket 支持
```python
# 步骤 1: 在 native_launcher.py 添加参数
def launch_with_native_ui(
    ...
    enable_websocket: bool = False,
    websocket_port: int = 9000,
    ...
):
    config = NativeUIConfig(
        ...
        enable_websocket=enable_websocket,
        websocket_port=websocket_port,
    )
```

### 示例 2: 添加自定义插件
```python
# 步骤 1: 定义插件接口
launch_with_native_ui(
    app_id="my_app",
    before_launch_hook=lambda config: print("Before launch!"),
    after_launch_hook=lambda app: print("After launch!"),
)
```

### 示例 3: 使用预设配置
```python
# 步骤 1: 使用 UI 模式预设
launch_with_native_ui(
    preset="ui_app",  # 自动设置 UI 相关参数
    app_id="my_app",
    # 覆盖特定参数
    frameless=False,
)
```

---

Date: 2025-12-18
Analyzed by: Claude Code
Overall Rating: ⭐⭐⭐⭐ (4.2/5) - Highly Extensible
