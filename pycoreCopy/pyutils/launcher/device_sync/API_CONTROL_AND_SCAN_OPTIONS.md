# API 访问控制和文件扫描选项

## Date: 2025-01-12

## 概述

实现了以下功能：
1. ✅ API 访问控制（toggle 变量控制）
2. ✅ Web 页面始终可访问
3. ✅ 文件扫描选项（是否扫描 node_modules 等目录）
4. ✅ .git 目录始终扫描（永不排除）
5. ✅ 移除命令行参数，全部使用预设值

## 新增配置项

### global_config.py

```python
# API 访问控制
config.api_enabled: bool = True  # 默认启用 API

# 文件扫描选项
config.scan_node_modules: bool = False  # 默认不扫描 node_modules
# .git 始终扫描（永不排除）
```

### 预设常量

```python
DEFAULT_HTTP_PORT = 58923
DEFAULT_SYNC_INTERVAL = 5  # seconds
DEFAULT_ROOT_DIR = "../.."  # 相对于 device_sync 模块目录
```

## API 访问控制

### 工作原理

1. **Web 页面 (`/`) - 始终可访问**
   - 无论 `api_enabled` 状态如何，都可以访问
   - 提供简单的仪表板界面

2. **状态 API (`/api/status`) - 始终可访问**
   - 无论 `api_enabled` 状态如何，都可以访问
   - 返回设备状态，包括 `api_enabled` 状态

3. **其他 API (`/api/*`) - 受控制**
   - 当 `api_enabled = False` 时返回 403 错误
   - 包括：
     - `/api/files` - 文件列表
     - `/api/file/{path}` - 文件下载
     - `/api/devices` - 在线设备列表

### 代码实现

```python
# simple_primary_server.py
def do_GET(self):
    config = get_global_config()

    # Check API access control (except for root and status)
    if path.startswith('/api/') and path != '/api/status':
        if not config.api_enabled:
            self.send_error(403, "API access is disabled")
            return

    # Route handling...
```

### Tray 菜单控制

```
Menu:
├── Mode
│   ├── Set as PRIMARY [Radio]
│   └── Set as SECONDARY [Radio]
├── ─────────────────
├── Enable API Access [Toggle] (仅 PRIMARY 可见)
├── Scan node_modules [Toggle] (仅 PRIMARY 可见)
├── ─────────────────
├── Enable Sync [Toggle] (仅 SECONDARY 可见)
├── ─────────────────
├── Status
└── Exit
```

**特点：**
- Tray 菜单只 toggle 变量（修改 `config.api_enabled`）
- Server 读取变量来拦截 API 请求
- 简单清晰的职责分离

## 文件扫描选项

### 扫描规则

#### 始终扫描（永不排除）
- ✅ `.git/` - Git 仓库目录（始终包含）
- ✅ `env/` - 环境配置目录
- ✅ `.env/` - 环境配置目录
- ✅ `build/` - 构建输出
- ✅ `dist/` - 分发目录
- ✅ `public/` - 公共资源
- ✅ 所有普通源代码目录

#### 默认排除（当 `scan_node_modules = False` 时）
- ❌ `node_modules/` - Node.js 依赖
- ❌ `__pycache__/` - Python 缓存
- ❌ `.pytest_cache/` - Pytest 缓存
- ❌ `.mypy_cache/` - MyPy 缓存
- ❌ `.tox/` - Tox 测试
- ❌ `venv/` - Python 虚拟环境
- ❌ `.venv/` - Python 虚拟环境
- ❌ `.next/` - Next.js 缓存
- ❌ `.nuxt/` - Nuxt.js 缓存
- ❌ `target/` - Rust/Java 构建输出
- ❌ `vendor/` - 第三方依赖
- ❌ `.dart_tool/` - Dart 工具临时文件
- ❌ `.flutter-plugins` - Flutter 插件
- ❌ `.flutter-plugins-dependencies` - Flutter 依赖

### 代码实现

```python
def _should_exclude_path(self, path: Path) -> bool:
    """检查路径是否应该被排除"""
    path_str = str(path).replace('\\', '/')
    parts = path_str.split('/')

    # .git 永不排除
    if '.git' in parts:
        return False

    # 定义排除目录
    exclude_dirs = [
        'node_modules', '__pycache__', 'venv', '.venv',
        '.dart_tool', '.next', '.nuxt', ...
    ]

    # 如果 scan_node_modules 为 False，排除这些目录
    if not self.scan_node_modules:
        for exclude_dir in exclude_dirs:
            if exclude_dir in parts:
                return True

    return False
```

### 扫描流程

1. **PRIMARY 服务器启动**
   - HTTP 服务器立即启动
   - 文件缓存**不会**自动构建

2. **收到同步请求**
   - SECONDARY 设备请求 `/api/files`
   - PRIMARY 检查 `config.file_cache` 是否为空
   - 如果为空，调用 `config.build_file_cache()`
   - 根据 `scan_node_modules` 设置扫描文件

3. **切换扫描选项**
   - 用户在 Tray 菜单切换 "Scan node_modules"
   - 清空 `config.file_cache`
   - 下次同步请求时重新构建缓存

## 使用示例

### 场景 1：PRIMARY 服务器（默认设置）

```python
# 1. 启动 PRIMARY 服务器
# Tray Menu -> Mode -> Set as PRIMARY

# 配置状态：
config.isPrimaryServer = True
config.api_enabled = True  # 默认启用
config.scan_node_modules = False  # 默认不扫描

# 2. SECONDARY 请求 /api/files
# - PRIMARY 扫描目录（排除 node_modules）
# - 构建缓存并返回

# 3. Web 页面始终可访问
# http://192.168.50.88:58923/  ← 始终可以访问
```

### 场景 2：禁用 API 访问

```python
# 1. 在 Tray 菜单禁用 API
# Tray Menu -> Enable API Access (取消勾选)

config.api_enabled = False

# 2. SECONDARY 请求 /api/files
# Response: 403 Forbidden - API access is disabled

# 3. Web 页面和状态 API 仍可访问
# http://192.168.50.88:58923/          ← 可访问
# http://192.168.50.88:58923/api/status ← 可访问
```

### 场景 3：扫描包含 node_modules

```python
# 1. 在 Tray 菜单启用 node_modules 扫描
# Tray Menu -> Scan node_modules (勾选)

config.scan_node_modules = True
config.file_cache = []  # 清空缓存

# 2. 下次同步请求时
# - 扫描所有目录（包括 node_modules）
# - .git 始终包含
# - 构建完整缓存
```

## 命令行使用（移除参数）

### 之前（有参数）

```bash
# 需要指定目录和端口
python -m pycore.pyutils.launcher.device_sync.simple_main D:/programing/core_node --port 58923
```

### 现在（全预设）

```bash
# 无需任何参数，使用预设值
python -m pycore.pyutils.launcher.device_sync.simple_main
```

**预设值：**
- Root Dir: `../..` (相对于 device_sync 模块)
- HTTP Port: `58923`
- Sync Interval: `5s`

## 测试验证

### 测试 1：API 访问控制

```python
config = init_global_config('D:/programing/core_node', 58923)

# 默认启用
assert config.api_enabled == True

# 禁用
config.disable_api()
assert config.api_enabled == False

# 启用
config.enable_api()
assert config.api_enabled == True

# ✓ 测试通过
```

### 测试 2：文件扫描排除

```python
# 默认不扫描 node_modules
config.scan_node_modules = False

# 测试路径
assert config._should_exclude_path(Path('node_modules/test.js')) == True  # 排除
assert config._should_exclude_path(Path('.git/config')) == False  # 包含
assert config._should_exclude_path(Path('build/app.js')) == False  # 包含
assert config._should_exclude_path(Path('env/config.py')) == False  # 包含

# 启用 node_modules 扫描
config.scan_node_modules = True
assert config._should_exclude_path(Path('node_modules/test.js')) == False  # 包含

# ✓ 所有测试通过
```

### 测试 3：Web 页面访问

```python
# Server always serves root page
# GET / -> 200 OK (无论 api_enabled 状态)

# Status API always accessible
# GET /api/status -> 200 OK (无论 api_enabled 状态)

# Other APIs controlled by api_enabled
# GET /api/files -> 403 Forbidden (when api_enabled = False)

# ✓ 访问控制正确
```

## 优势总结

### 1. 简单的 Toggle 控制
- ✅ Tray 菜单只修改变量
- ✅ Server 读取变量拦截请求
- ✅ 职责清晰分离

### 2. 智能文件扫描
- ✅ 默认排除大型依赖目录
- ✅ .git 始终包含（重要）
- ✅ build、dist、env 等按需包含
- ✅ 支持 Flutter/Dart 项目

### 3. 按需构建缓存
- ✅ 启动时不扫描（快速启动）
- ✅ 收到请求时才构建
- ✅ 切换选项后自动重建

### 4. Web 页面始终可用
- ✅ 管理界面不受 API 控制影响
- ✅ 可以随时查看状态
- ✅ 即使禁用 API 也能访问

### 5. 预设配置
- ✅ 无需命令行参数
- ✅ 配置集中管理
- ✅ 易于维护和修改

## 文件变更总结

### 修改的文件
1. **global_config.py**
   - 添加 `api_enabled`、`scan_node_modules` 配置
   - 添加 `DEFAULT_ROOT_DIR` 常量
   - 实现 `_should_exclude_path()` 逻辑
   - 更新 `build_file_cache()` 支持排除规则

2. **simple_primary_server.py**
   - 实现 API 访问控制检查
   - Web 页面和 /api/status 始终可访问

3. **simple_tray_menu.py**
   - 添加 "Enable API Access" toggle
   - 添加 "Scan node_modules" toggle
   - 更新状态显示

4. **simple_main.py**
   - 移除命令行参数解析
   - 使用预设值初始化

5. **simple_client.py**
   - 使用 `DEFAULT_SYNC_INTERVAL` 常量

## 结论

成功实现了：
- ✅ API 访问控制（toggle 控制，server 拦截）
- ✅ Web 页面始终可访问
- ✅ 智能文件扫描（.git 始终包含，支持 Flutter）
- ✅ 按需构建缓存
- ✅ 预设配置（无需参数）
- ✅ 所有测试通过

系统更加灵活、高效、易用！
