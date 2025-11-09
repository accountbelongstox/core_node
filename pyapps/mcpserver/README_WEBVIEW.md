# Webview Service Integration

## 概述

MCP Server 现在集成了 Webview 启动器服务，基于 `pycore.pyutils.web.webview_launcher` 实现。

## 架构

```
pyapps/mcpserver/
├── services/
│   └── webview_service.py         # Webview 服务实现
├── examples/
│   └── webview_example.py         # 使用示例
├── mcpserver_main.py              # 主服务器（已注册 webview 路由）
└── README_WEBVIEW.md              # 本文档
```

## 功能特性

### 1. 创建 Webview 启动器
- 创建自定义 webview 窗口
- 配置窗口大小、标题等属性
- 支持多个启动器实例

### 2. 启动和停止
- 启动 webview 窗口
- 关闭 webview 窗口
- 管理启动器生命周期

### 3. 窗口控制
- 重新加载 webview 窗口
- 更新窗口标题
- 获取启动器状态

### 4. pyMatrix 集成
- 快速启动 pyMatrix 应用
- 预配置的 pyMatrix 设置
- 与 pyMatrix 后端集成

## 依赖关系

### 核心依赖
- `pycore.pyutils.web.webview_launcher` - Webview 启动器实现
- `pycore.pyutils.web.universal_gui_launcher` - 通用 GUI 启动器基类
- `pycore.pyutils.wsrpc` - WebSocket RPC 框架

### 可选依赖
- `pywebview` - 原生 webview 窗口支持
- `PyQt5` (Linux) - Linux 平台 webview 后端

### 安装依赖
```bash
# Windows/macOS
pip install pywebview

# Linux (需要额外的图形后端)
pip install pywebview PyQt5
```

## API 文档

### RPC 路由

#### 1. `webview.create_launcher`
创建新的 webview 启动器

**参数:**
```json
{
  "app_name": "MyApp",           // 应用名称
  "frontend_url": "http://...",  // 前端 URL
  "bridge_host": "127.0.0.1",    // 可选，桥接主机
  "bridge_port": 8765,           // 可选，桥接端口
  "window_title": "My App",      // 可选，窗口标题
  "window_width": 1280,          // 可选，窗口宽度
  "window_height": 800,          // 可选，窗口高度
  "resizable": true,             // 可选，是否可调整大小
  "fullscreen": false,           // 可选，是否全屏
  "use_webview": true            // 可选，是否使用 webview
}
```

**返回:**
```json
{
  "success": true,
  "launcher_id": "MyApp",
  "message": "Webview launcher created for MyApp",
  "config": {
    "app_name": "MyApp",
    "frontend_url": "http://...",
    "webview_available": true
  }
}
```

#### 2. `webview.start_launcher`
启动 webview 启动器

**参数:**
```json
{
  "launcher_id": "MyApp",  // 可选，不提供则使用活动启动器
  "open_window": true      // 可选，是否打开窗口
}
```

#### 3. `webview.stop_launcher`
停止 webview 启动器

**参数:**
```json
{
  "launcher_id": "MyApp"  // 可选，不提供则使用活动启动器
}
```

#### 4. `webview.reload_webview`
重新加载 webview 窗口

**参数:**
```json
{
  "launcher_id": "MyApp"  // 可选，不提供则使用活动启动器
}
```

#### 5. `webview.launch_pymatrix`
启动 pyMatrix 应用

**参数:**
```json
{
  "backend_host": "127.0.0.1",      // 可选，后端主机
  "backend_port": 8000,             // 可选，后端端口
  "frontend_url": "http://...",     // 可选，前端 URL
  "bridge_port": 8765,              // 可选，桥接端口
  "window_title": "pyMatrix"        // 可选，窗口标题
}
```

#### 6. `webview.list_launchers`
列出所有活动的启动器

**参数:** `{}`

**返回:**
```json
{
  "success": true,
  "launchers": [
    {
      "launcher_id": "MyApp",
      "app_name": "MyApp",
      "frontend_url": "http://...",
      "webview_available": true,
      "is_active": true
    }
  ],
  "active_launcher_id": "MyApp",
  "total_launchers": 1
}
```

#### 7. `webview.get_status`
获取启动器状态

**参数:**
```json
{
  "launcher_id": "MyApp"  // 可选，不提供则使用活动启动器
}
```

**返回:**
```json
{
  "success": true,
  "status": {
    "app_name": "MyApp",
    "frontend_url": "http://...",
    "window_title": "My App",
    "webview_available": true,
    "bridge_running": true
  }
}
```

## 使用示例

### 1. 启动 MCP Server

```bash
# 进入项目根目录
cd D:\programing\core_node

# 启动 MCP Server
python pyapps/mcpserver/mcpserver_main.py
```

### 2. 运行示例

```bash
# 创建并启动启动器示例
python pyapps/mcpserver/examples/webview_example.py create

# 启动 pyMatrix 示例
python pyapps/mcpserver/examples/webview_example.py pymatrix

# 列出所有启动器
python pyapps/mcpserver/examples/webview_example.py list

# 重新加载 webview
python pyapps/mcpserver/examples/webview_example.py reload

# 获取启动器状态
python pyapps/mcpserver/examples/webview_example.py status

# 运行所有示例
python pyapps/mcpserver/examples/webview_example.py all
```

### 3. Python 代码示例

```python
from pycore.pyutils.wsrpc.ws_rpc_client import WsRpcClient

async def example():
    # 创建 RPC 客户端
    client = WsRpcClient(
        server_url='ws://localhost:8767',
        client_id='my_client'
    )

    # 连接到服务器
    await client.connect()

    # 创建启动器
    result = await client.call('webview.create_launcher', {
        'app_name': 'MyApp',
        'frontend_url': 'http://localhost:3000',
        'window_width': 1200,
        'window_height': 800
    })

    if result['success']:
        # 启动启动器
        await client.call('webview.start_launcher', {
            'launcher_id': result['launcher_id']
        })

    # 断开连接
    await client.disconnect()
```

## 技术细节

### 1. 服务架构

```
WebviewService
├── 管理多个 WebviewGUILauncher 实例
├── 提供 RPC 接口
└── 处理启动器生命周期

WebviewGUILauncher (from pycore.pyutils.web.webview_launcher)
├── 创建 webview 窗口
├── 管理 HTTP 桥接
├── 系统托盘集成
└── 跨平台支持
```

### 2. 实现位置

- **服务定义**: `pyapps/mcpserver/services/webview_service.py`
- **路由注册**: `pyapps/mcpserver/mcpserver_main.py:L229-L266`
- **核心实现**: `pycore/pyutils/web/webview_launcher.py`
- **基类**: `pycore/pyutils/web/universal_gui_launcher.py`

### 3. 依赖链

```
mcpserver_main.py
└── webview_service.py
    └── pycore.pyutils.web.webview_launcher
        ├── WebviewGUILauncher
        ├── create_webview_launcher
        ├── get_webview_launcher
        └── launch_pymatrix_gui
```

## 注意事项

1. **Webview 可用性**: 如果 `pywebview` 未安装，会自动回退到浏览器模式
2. **平台差异**: Linux 需要额外的图形后端 (PyQt5 或 PyGObject)
3. **多实例**: 支持同时管理多个 webview 启动器
4. **活动启动器**: 默认操作作用于最近创建的启动器

## 故障排除

### 1. Webview 不可用

**问题**: `webview_available: false`

**解决方案**:
```bash
# 安装 pywebview
pip install pywebview

# Linux 需要额外安装
pip install PyQt5
```

### 2. 无法连接到 MCP Server

**问题**: 连接失败

**解决方案**:
1. 确保 MCP Server 正在运行
2. 检查端口 8767 是否可用
3. 验证防火墙设置

### 3. 窗口无法打开

**问题**: 启动器创建成功但窗口不显示

**解决方案**:
1. 检查 `use_webview` 参数是否为 `true`
2. 验证 frontend_url 是否可访问
3. 查看 MCP Server 日志

## 扩展开发

### 添加自定义启动器

```python
# 在 webview_service.py 中添加新方法
async def launch_custom_app(self, params: dict) -> dict:
    """Launch custom application"""
    launcher = create_webview_launcher(
        app_name='CustomApp',
        frontend_url=params.get('url'),
        # ... 其他配置
    )

    self.launchers['CustomApp'] = launcher
    launcher.start()

    return {'success': True, 'launcher_id': 'CustomApp'}
```

### 注册新路由

```python
# 在 mcpserver_main.py 的 _register_backend_routes 方法中
@self.rpc_server.route('webview.launch_custom')
async def webview_launch_custom(params):
    """Launch custom application"""
    return await self.webview_service.launch_custom_app(params)
```

## 参考资料

- [pywebview 文档](https://pywebview.flowrl.com/)
- [WebSocket RPC 文档](../pycore/pyutils/wsrpc/README.md)
- [Universal GUI Launcher](../pycore/pyutils/web/universal_gui_launcher.py)
