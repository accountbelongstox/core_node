# Matrix 项目架构分析

## 1. 项目启动调用链

### 1.1 入口点
```
python pymain.py app=matrix
```

### 1.2 完整调用链

```
pymain.py
  ↓ (AppLauncher.start())
pycore/pyfoundations/app_launcher.py
  ↓ (动态加载 matrix_main.py)
pyapps/matrix/matrix_main.py
  ↓ (start() 函数)
  ├── compile_frontend_if_needed()  # 编译前端 (生产模式)
  ├── build_matrix_launcher_config()  # 构建启动配置
  ↓ (ServiceLauncher.start())
pycore/pylauncher/launcher.py
  ↓ (调用各个服务启动器)
pycore/pythreadpool/starters.py
  ├── start_heartbeat()      # 心跳系统
  ├── start_rpc_v2()         # RPC v2 服务 (FastAPI + Uvicorn)
  ├── start_ui()             # UI 服务 (PySide6)
  └── start_tray()           # 系统托盘
```

### 1.3 各组件详细说明

#### A. RPC v2 服务启动 (Web 后端)
```python
# 位置: pycore/pythreadpool/starters.py:113
def start_rpc_v2(config: Dict[str, Any]) -> Any:
    """
    启动 FastAPI + Uvicorn 服务器

    功能：
    - HTTP API 端点
    - WebSocket 支持
    - 静态文件服务 (前端静态文件)
    - 自动挂载 FastAPI 路由
    """
    from pycore.pyutils.rpc_v2 import FastAPIRPCServerRunner

    instance = FastAPIRPCServerRunner(
        host=config.get('host', '0.0.0.0'),
        port=config.get('port', 8000),
        fastapi_routers=[...],      # Matrix API 路由
        static_mounts=[...]          # 前端静态文件挂载
    )
    instance.start()  # 启动 Uvicorn 服务器
```

**RPC v2 实现：**
- 文件：`pycore/pyutils/rpc_v2/server/fastapi_server.py`
- 使用 FastAPI + Uvicorn
- 默认监听：`http://0.0.0.0:8000`
- **当前不支持 HTTPS**（仅 HTTP）

#### B. UI 服务启动 (桌面窗口)
```python
# 位置: pycore/pythreadpool/starters.py:205
def start_ui(config: Dict[str, Any]) -> Any:
    """
    启动 PySide6 WebView 窗口

    功能：
    - 创建原生窗口（可无边框）
    - 嵌入 WebView 加载前端
    - 自定义标题栏
    - 窗口管理（最小化/最大化/关闭）
    """
    from pycore.pyutils.native_ui.step5_main_ui.pyside6 import PySide6UIThread

    ui_thread = PySide6UIThread(
        ui_config=ui_config,
        startup_config=startup_config,
        daemon=True
    )
    ui_thread.start()  # 启动 Qt 事件循环
```

**UI 实现：**
- 框架：PySide6 (Qt for Python)
- WebView URL：`http://localhost:8000` (连接到 RPC v2)
- **WebView 仅支持 HTTP**（不支持 HTTPS 自签名证书）

## 2. 前端启动系统

### 2.1 当前前端架构

**旧配置（Nuxt）：**
```python
# pyapps/matrix/controller/launcher_builder.py:85
from pycore.pyutils.frontend_launcher import NuxtLauncher, FrontendConfig

temp_config = FrontendConfig(
    app_name='pymatrix',
    port=38007,
    mode='production',
    project_root=project_root
)
temp_launcher = NuxtLauncher(config=temp_config)
static_dir = temp_launcher.static_dir  # .output/public
```

**新前端（React + Vite）：**
```
poly_apps/matrix_ui_react/
├── package.json          # 使用 Vite
├── vite.config.ts        # Vite 配置
├── App.tsx               # React 主组件
├── dist/                 # 生产构建输出 (vite build)
└── scripts/              # 构建脚本
```

### 2.2 前端启动库对比

#### 方案 A: NuxtLauncher（当前使用）
- **位置**: `pycore/pyutils/frontend_launcher/nuxt_launcher.py`
- **支持**: 仅 Nuxt
- **输出**: `.output/public/`
- **状态**: ❌ 不适用于 React + Vite

#### 方案 B: UniversalFrontendLauncher（推荐）
- **位置**: `pycore/pyutils/frontend_launcher/universal_launcher.py`
- **支持**: Nuxt | React | Vite | Next
- **输出**: 自动检测（dist/ 或 .output/public/）
- **状态**: ✅ 完美支持 React + Vite

### 2.3 UniversalFrontendLauncher 特性

```python
@dataclass
class UniversalFrontendConfig:
    """
    统一前端配置

    支持的框架：
    - nuxt: Nuxt.js
    - react: Create React App / Vite React
    - vite: 通用 Vite 项目
    - next: Next.js
    """
    app_name: str
    framework: str          # "react" | "nuxt" | "vite" | "next"
    app_dir: Path          # 前端项目根目录
    port: int = 3000       # 开发服务器端口
    mode: str = "production"  # "dev" | "production"

    # 生产模式
    static_dir: Optional[Path] = None    # 默认: dist/
    skip_build: bool = False             # 跳过构建（使用已有）
    force_rebuild: bool = False          # 强制重新构建
    auto_install: bool = True            # 自动安装依赖
    smart_build: bool = True             # 智能构建（仅源码更新时）

    # 开发模式
    dev_command: Optional[List[str]] = None    # 自定义开发命令
    health_check_timeout: int = 120            # 健康检查超时
```

**关键功能：**
1. ✅ 自动依赖安装（pnpm install）
2. ✅ 智能构建检测（仅必要时构建）
3. ✅ 实时输出捕获
4. ✅ HTTP 健康检查
5. ✅ 内置静态文件服务器
6. ✅ 支持自定义构建命令

## 3. 推荐的解决方案

### 3.1 修改 Matrix 配置以使用 React + Vite

**文件**: `pyapps/matrix/controller/launcher_builder.py`

**当前代码（第 84-106 行）：**
```python
if frontend_mode == 'production':
    from pycore.pyutils.frontend_launcher import NuxtLauncher, FrontendConfig

    temp_config = FrontendConfig(
        app_name='pymatrix',
        port=frontend_port,
        mode='production',
        project_root=project_root
    )
    temp_launcher = NuxtLauncher(config=temp_config)

    if temp_launcher.static_dir.exists():
        static_mounts.append({
            'url_prefix': '/',
            'directory': str(temp_launcher.static_dir),
            'name': 'frontend'
        })
```

**推荐修改为：**
```python
if frontend_mode == 'production':
    from pycore.pyutils.frontend_launcher import (
        UniversalFrontendLauncher,
        UniversalFrontendConfig
    )

    # 配置 React + Vite 前端
    frontend_config = UniversalFrontendConfig(
        app_name='matrix',
        framework='vite',  # 或 'react'
        app_dir=project_root / 'poly_apps' / 'matrix_ui_react',
        port=frontend_port,
        mode='production',
        static_dir='dist',  # Vite 默认输出目录
        skip_build=False,   # 首次启动时构建
        force_rebuild=False,
        auto_install=True,  # 自动运行 pnpm install
        smart_build=True,   # 仅源码更新时重新构建
    )

    # 创建启动器
    launcher = UniversalFrontendLauncher(config=frontend_config)

    # 生产模式：构建并验证
    if launcher.build_production():
        static_mount = launcher.get_static_mount(url_prefix='/')
        if static_mount:
            static_mounts.append(static_mount)
            ColorPrint.green(f"[Matrix] Frontend static files: {static_mount['directory']}")
    else:
        ColorPrint.yellow("[Matrix] Frontend build failed")
```

### 3.2 完整的 Matrix 配置示例

```python
def build_matrix_launcher_config(
    project_root: Path,
    frontend_port: int = 3000,
    backend_port: int = 8000,
    backend_host: str = '0.0.0.0',
    frontend_mode: str = 'production'
):
    """构建 Matrix 启动配置"""

    # ============================================================
    # 1. 前端配置（React + Vite）
    # ============================================================
    static_mounts = []

    if frontend_mode == 'production':
        from pycore.pyutils.frontend_launcher import (
            UniversalFrontendLauncher,
            UniversalFrontendConfig
        )

        # 配置前端
        frontend_config = UniversalFrontendConfig(
            app_name='matrix',
            framework='vite',
            app_dir=project_root / 'poly_apps' / 'matrix_ui_react',
            port=frontend_port,
            mode='production',
            auto_install=True,
            smart_build=True,
        )

        # 构建前端
        launcher = UniversalFrontendLauncher(config=frontend_config)
        if launcher.build_production():
            mount = launcher.get_static_mount(url_prefix='/')
            if mount:
                static_mounts.append(mount)

    # ============================================================
    # 2. 服务配置
    # ============================================================
    services = {
        # 心跳系统
        'heartbeat': {},

        # RPC v2 服务（后端 API + 前端静态文件）
        'rpc_v2': {
            'port': backend_port,
            'host': backend_host,
            'debug': True,
            'fastapi_routers': [
                # Matrix API 路由
                health_router,
                device_router,
                screen_router,
                # ...
            ],
            'static_mounts': static_mounts  # 挂载前端静态文件
        },

        # UI 服务（PySide6 WebView）
        'ui': {
            'app_name': 'Matrix',
            'window_size': (1400, 900),
            'webview_url': f'http://localhost:{backend_port}',
            'frameless': True,
            'show_on_start': True,
        },

        # 系统托盘
        'tray': {
            'app_name': 'Matrix',
            'icon_path': str(icon_path),
            'menu_items': [...]
        }
    }

    return LauncherConfig(
        app_id='matrix',
        app_name='Matrix',
        singleton=True,
        services=services
    )
```

## 4. HTTPS 支持分析

### 4.1 当前状态
- **RPC v2 (FastAPI + Uvicorn)**: ❌ 当前仅支持 HTTP
- **PySide6 WebView**: ⚠️ 支持 HTTPS，但需要有效证书

### 4.2 添加 HTTPS 支持的方案

#### 方案 A: 修改 FastAPIRPCServerRunner 支持 HTTPS

**文件**: `pycore/pyutils/rpc_v2/server/fastapi_server.py`

需要修改 `FastAPIRPCServerRunner.start()` 方法：

```python
class FastAPIRPCServerRunner:
    def __init__(
        self,
        host: str = "0.0.0.0",
        port: int = 58100,
        ssl_keyfile: Optional[str] = None,     # 新增
        ssl_certfile: Optional[str] = None,    # 新增
        ssl_ca_certs: Optional[str] = None,    # 新增
        **kwargs
    ):
        self.ssl_keyfile = ssl_keyfile
        self.ssl_certfile = ssl_certfile
        self.ssl_ca_certs = ssl_ca_certs
        # ...

    def start(self):
        """启动服务器"""
        uvicorn_config = {
            "host": self.host,
            "port": self.port,
            "log_level": "debug" if self.debug else "info",
        }

        # 添加 SSL 支持
        if self.ssl_keyfile and self.ssl_certfile:
            uvicorn_config.update({
                "ssl_keyfile": self.ssl_keyfile,
                "ssl_certfile": self.ssl_certfile,
                "ssl_ca_certs": self.ssl_ca_certs,
            })
            ColorPrint.green(f"[RPC v2] HTTPS enabled")

        uvicorn.run(self.app, **uvicorn_config)
```

**使用示例：**
```python
services = {
    'rpc_v2': {
        'port': 8443,
        'host': '0.0.0.0',
        'ssl_keyfile': str(certs_dir / 'server.key'),
        'ssl_certfile': str(certs_dir / 'server.crt'),
        # ...
    }
}
```

#### 方案 B: 使用反向代理（生产推荐）

```
[Client/UI]
    ↓ HTTPS
[Nginx/Caddy] (反向代理，自动 HTTPS)
    ↓ HTTP (内网)
[FastAPI/Uvicorn] (localhost:8000)
```

**优势：**
- 不需要修改 Python 代码
- 自动证书管理（Let's Encrypt）
- 更好的性能和安全性
- 生产环境标准做法

**Nginx 配置示例：**
```nginx
server {
    listen 443 ssl;
    server_name matrix.local;

    ssl_certificate /path/to/cert.crt;
    ssl_certificate_key /path/to/cert.key;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket 支持
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 4.3 本地开发 HTTPS 证书

**生成自签名证书：**
```bash
# 生成私钥
openssl genrsa -out server.key 2048

# 生成证书签名请求
openssl req -new -key server.key -out server.csr

# 生成自签名证书（有效期 365 天）
openssl x509 -req -days 365 -in server.csr -signkey server.key -out server.crt
```

**使用 mkcert（推荐本地开发）：**
```bash
# 安装 mkcert
choco install mkcert  # Windows
brew install mkcert   # macOS

# 安装本地 CA
mkcert -install

# 生成证书
mkcert localhost 127.0.0.1 ::1

# 输出: localhost+2.pem, localhost+2-key.pem
```

## 5. 完整的项目启动流程总结

### 5.1 生产模式启动流程

```
1. python pymain.py app=matrix
   ↓
2. 检查前端构建
   - 运行 pnpm install (如需要)
   - 运行 vite build (如需要)
   - 验证 dist/ 目录存在
   ↓
3. 启动 RPC v2 服务
   - 启动 Uvicorn (http://0.0.0.0:8000)
   - 挂载 Matrix API 路由
   - 挂载前端静态文件 (dist/ -> /)
   ↓
4. 启动 UI 服务
   - 启动 PySide6 窗口
   - WebView 加载 http://localhost:8000
   ↓
5. 启动系统托盘
   - 显示托盘图标
   - 注册菜单项事件
   ↓
6. 应用运行中
   - 用户通过 WebView 访问前端
   - 前端通过 HTTP/WebSocket 调用 API
```

### 5.2 开发模式启动流程

```
1. python pymain.py app=matrix (设置 FRONTEND_MODE=dev)
   ↓
2. 启动前端开发服务器
   - 运行 vite dev
   - 监听 http://localhost:3000
   - 热模块替换 (HMR)
   ↓
3. 启动 RPC v2 服务
   - 启动 Uvicorn (http://0.0.0.0:8000)
   - 仅挂载 API 路由
   ↓
4. 启动 UI 服务
   - WebView 加载 http://localhost:3000 (前端开发服务器)
   ↓
5. 开发中
   - 前端修改自动刷新
   - API 修改需要重启
```

## 6. 文件位置索引

### 核心文件
| 文件 | 位置 | 说明 |
|------|------|------|
| 入口点 | `pymain.py` | 主入口 |
| App Launcher | `pycore/pyfoundations/app_launcher.py` | 应用加载器 |
| Matrix 入口 | `pyapps/matrix/matrix_main.py` | Matrix 主程序 |
| 启动配置 | `pyapps/matrix/controller/launcher_builder.py` | 配置构建器 |
| 服务启动器 | `pycore/pythreadpool/starters.py` | 各服务启动函数 |

### 前端启动库
| 文件 | 位置 | 支持框架 |
|------|------|----------|
| NuxtLauncher | `pycore/pyutils/frontend_launcher/nuxt_launcher.py` | Nuxt 专用 |
| UniversalLauncher | `pycore/pyutils/frontend_launcher/universal_launcher.py` | Nuxt/React/Vite/Next |

### RPC 服务
| 文件 | 位置 | 说明 |
|------|------|------|
| FastAPI 服务器 | `pycore/pyutils/rpc_v2/server/fastapi_server.py` | RPC v2 实现 |
| RPC 配置 | `pycore/pyutils/rpc_v2/config.py` | RPC 常量和配置 |

### UI 服务
| 文件 | 位置 | 说明 |
|------|------|------|
| PySide6 框架 | `pycore/pyutils/native_ui/step5_main_ui/pyside6/framework.py` | UI 框架实现 |
| UI 线程 | `pycore/pyutils/native_ui/step5_main_ui/pyside6/ui_thread.py` | UI 线程封装 |

### 前端项目
| 文件 | 位置 | 说明 |
|------|------|------|
| React 前端 | `poly_apps/matrix_ui_react/` | React + Vite 项目 |
| 旧 Nuxt 前端 | `poly_apps/nuxt_main/` | Nuxt 项目（已弃用？） |

## 7. 下一步行动建议

### 优先级 1: 切换到 UniversalFrontendLauncher
- [ ] 修改 `pyapps/matrix/controller/launcher_builder.py`
- [ ] 将 NuxtLauncher 替换为 UniversalFrontendLauncher
- [ ] 配置 framework='vite', app_dir='matrix_ui_react'
- [ ] 测试生产构建和开发模式

### 优先级 2: 添加 HTTPS 支持（可选）
- [ ] 方案 A: 修改 FastAPIRPCServerRunner 添加 SSL 参数
- [ ] 方案 B: 配置 Nginx 反向代理（生产环境）
- [ ] 生成本地开发证书（mkcert）
- [ ] 更新 Matrix 配置以使用 HTTPS

### 优先级 3: 文档和规范
- [ ] 更新 Matrix 开发文档
- [ ] 添加前端启动流程说明
- [ ] 记录 HTTPS 配置步骤
- [ ] 更新 DEVELOPMENT_GUIDE

## 8. 常见问题

### Q1: 为什么前端不启动？
**A**: 检查以下项：
1. `node_modules/` 是否存在（运行 `pnpm install`）
2. `dist/` 是否存在（运行 `vite build`）
3. `vite.config.ts` 配置是否正确
4. 端口是否被占用

### Q2: WebView 显示空白？
**A**: 检查：
1. RPC v2 是否成功启动（检查端口 8000）
2. 静态文件是否正确挂载（查看日志）
3. 浏览器控制台错误（启用 dev tools）
4. CORS 配置是否正确

### Q3: 如何启用 HTTPS？
**A**:
1. 本地开发：使用 mkcert 生成证书
2. 生产环境：使用反向代理（Nginx + Let's Encrypt）
3. 直接支持：修改 FastAPIRPCServerRunner 添加 SSL 参数

### Q4: 如何调试前端？
**A**:
1. 开发模式：`FRONTEND_MODE=dev python pymain.py app=matrix`
2. 启用 Dev Tools：`enable_dev_tools=True` in UI config
3. 查看 Vite 输出：单独运行 `cd matrix_ui_react && npm run dev`

---

**文档版本**: v1.0
**最后更新**: 2025-12-07
**作者**: Claude Code
