# Device Sync - Unified Architecture

## 架构概述

新的统一架构实现了以下关键特性：

1. **统一HTTP服务器** - 始终运行，无需重启
2. **模式切换** - 通过全局配置标志切换，不重启服务
3. **自动网络发现** - SECONDARY模式自动扫描PRIMARY服务器
4. **SQLite记录** - 所有操作记录到数据库
5. **单一线程模型** - 启动时创建HTTP服务器线程，之后不再创建新线程

## 核心组件

### 1. UnifiedHTTPServer (`server/unified.py`)

统一的HTTP服务器，根据 `global_config.isPrimaryServer` 提供不同功能：

**PUBLIC端点**（两种模式都可用）：
- `GET /` - 仪表盘（显示当前模式）
- `GET /api/status` - 当前状态
- `GET /api/devices` - 在线设备列表

**PRIMARY模式专用端点**：
- `GET /api/files` - 文件列表
- `GET /api/file/{path}` - 文件下载

**SECONDARY模式专用端点**：
- `GET /api/sync/status` - 同步状态
- `POST /api/sync/start` - 开始同步
- `POST /api/sync/stop` - 停止同步

### 2. SimpleDeviceScanner (`core/scanner.py`)

网络扫描器，自动发现PRIMARY服务器：
- 扫描本地网段（.1-.254）
- 检查每个IP的 `/api/status` 端点
- 更新 `global_config.online_devices`
- SECONDARY模式下每30秒自动扫描

### 3. GlobalConfig (`core/config.py`)

全局配置对象，所有组件共享：

**关键属性**：
- `isPrimaryServer`: 当前模式（PRIMARY/SECONDARY）
- `sync_enabled`: 同步是否启用
- `api_enabled`: API访问是否启用
- `online_devices`: 所有在线设备
- `primary_servers`: PRIMARY服务器列表
- `file_cache`: 文件缓存
- `connected_clients`: 已连接客户端

**计算属性**（新增）：
- `file_cache_count`: 缓存文件数量
- `connected_clients_count`: 连接客户端数量
- `online_devices_count`: 在线设备数量

### 4. SimpleTrayMenu (`ui/tray.py`)

系统托盘菜单，支持无重启模式切换：

**菜单项**：
- **Mode** → Set as PRIMARY / SECONDARY
- **Enable API Access** (PRIMARY模式)
- **Scan node_modules** (PRIMARY模式)
- **Enable Sync** (SECONDARY模式)
- **Scan Network** (SECONDARY模式)
- **Open Web UI**
- **Status**
- **Exit**

## 启动流程

```python
# main.py
def main():
    # 1. 初始化配置
    config = init_global_config(root_dir, port)

    # 2. 创建统一HTTP服务器
    server = UnifiedHTTPServer()
    server.start()

    # 3. 在单独线程运行HTTP服务器（这是唯一的threading.Thread）
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    # 4. 获取网络扫描器
    scanner = get_network_scanner()

    # 5. 初始扫描
    scanner.scan_if_needed(force=True)

    # 6. 启动托盘菜单（阻塞）
    tray = SimpleTrayMenu(server, scanner)
    tray.start()
```

## 模式切换

### PRIMARY → SECONDARY

```python
def _on_set_secondary():
    # 1. 更新配置（HTTP服务器继续运行）
    config.set_as_secondary()

    # 2. 立即扫描网络
    scanner.scan_if_needed(force=True)

    # 3. 更新UI
    icon.title = get_title()
```

### SECONDARY → PRIMARY

```python
def _on_set_primary():
    # 1. 更新配置（HTTP服务器继续运行）
    config.set_as_primary()

    # 2. 禁用同步
    if config.sync_enabled:
        config.disable_sync()

    # 3. 更新UI
    icon.title = get_title()
```

## 同步启用条件

在SECONDARY模式下，同步只能在以下条件全部满足时启用：

1. ✅ 当前是SECONDARY模式
2. ✅ 网络上有且仅有1台PRIMARY服务器
3. ✅ PRIMARY服务器不是本机
4. ✅ PRIMARY服务器API已启用

条件验证在 `UnifiedHTTPHandler._can_enable_sync()` 中实现。

## 网络扫描

### 自动扫描（SECONDARY模式）

托盘菜单启动时会创建一个后台线程（`_setup_periodic_scan`），每5秒检查一次是否需要扫描：

```python
def periodic_scan():
    while icon.visible:
        # 如果距上次扫描超过30秒，自动扫描
        scanner.scan_if_needed(interval=30.0)

        # 更新图标标题
        icon.title = get_title()

        time.sleep(5)
```

### 手动扫描

用户可以通过 "Scan Network" 菜单项强制立即扫描。

## 数据库记录

所有操作都记录到SQLite数据库（`~/.core_node/.device_sync/sync_history.db`）：

### 表结构

1. **sync_sessions** - 同步会话
2. **file_transfers** - 文件传输记录
3. **scan_history** - 扫描历史
4. **connections** - 连接历史

### 记录时机

- 文件下载：`/api/file/{path}` 访问时
- 客户端连接：`/api/files` 访问时
- 网络扫描：扫描完成时
- 文件缓存构建：扫描文件系统时

## 线程模型

整个应用只使用以下线程：

1. **主线程** - 运行托盘菜单
2. **HTTP服务器线程** - 运行统一HTTP服务器（启动时创建，永不停止）
3. **定时扫描线程** - 后台网络扫描（托盘菜单启动时创建）

**不再动态创建线程** - 所有线程在启动时创建，之后不再创建新线程。

## 通信协议

### 服务器状态查询

```http
GET /api/status HTTP/1.1
Host: 192.168.50.x:58923

Response:
{
  "mode": "primary" | "secondary",
  "isPrimaryServer": true | false,
  "sync_enabled": true | false,
  "api_enabled": true | false,
  "device_id": "uuid",
  "hostname": "DESKTOP-XXX",
  "ip": "192.168.50.x",
  "http_port": 58923,
  "online_devices_count": 2,
  "primary_servers_count": 1
}
```

### 文件列表（PRIMARY）

```http
GET /api/files HTTP/1.1
Host: 192.168.50.x:58923

Response:
{
  "status": "ok",
  "count": 1234,
  "files": [
    {
      "path": "src/main.js",
      "size": 12345,
      "mtime": 1234567890.123
    },
    ...
  ]
}
```

### 文件下载（PRIMARY）

```http
GET /api/file/src/main.js HTTP/1.1
Host: 192.168.50.x:58923

Response:
Content-Type: application/octet-stream
Content-Length: 12345

<file content>
```

### 同步状态（SECONDARY）

```http
GET /api/sync/status HTTP/1.1
Host: 192.168.50.x:58923

Response:
{
  "sync_enabled": true | false,
  "can_sync": true | false,
  "reason": "OK" | "error message",
  "primary_server_ip": "192.168.50.x",
  "primary_servers_count": 1,
  "primary_servers": [...]
}
```

## 配置持久化

配置存储在 `~/.core_node/.device_sync/` 目录：

- `device_id.txt` - 设备唯一ID
- `sync_history.db` - SQLite数据库

## Web UI

访问 `http://localhost:58923/` 可以查看Web仪表盘：

- 自动刷新（每30秒）
- 显示当前模式
- 统计信息
- 文件传输历史
- 在线设备列表
- 连接客户端列表（PRIMARY模式）
- PRIMARY服务器列表（SECONDARY模式）

## 故障排除

### 无法启用同步

检查以下条件：
1. 是否是SECONDARY模式？
2. 网络上是否有且仅有1台PRIMARY服务器？
3. PRIMARY服务器是否是本机？
4. PRIMARY服务器API是否启用？

手动扫描网络：托盘菜单 → Scan Network

### HTTP服务器无法启动

检查端口是否被占用：
```bash
netstat -ano | findstr :58923
```

### 网络扫描找不到设备

1. 检查网络配置：托盘菜单 → Status
2. 确认在同一网段
3. 检查防火墙设置

## 升级指南

### 从旧架构迁移

旧架构使用独立的 `primary.py` 和 `secondary.py`。新架构使用统一的 `unified.py`。

**不需要数据迁移** - 数据库和配置文件位置不变。

**需要更新的导入**：
```python
# 旧
from ..server.primary import SimplePrimaryServer
from ..client.secondary import SimpleClient

# 新
from ..server.unified import UnifiedHTTPServer
from ..core.scanner import get_network_scanner
```

## 性能优化

1. **网络扫描**：并发扫描（最多50个线程），超时0.5秒
2. **文件缓存**：构建一次，重复使用
3. **数据库**：批量写入，索引优化
4. **HTTP服务器**：Keep-Alive连接

## 安全考虑

1. **API访问控制**：PRIMARY模式可以禁用API访问
2. **自连接防护**：SECONDARY模式不能连接到自己
3. **多服务器检测**：只允许一台PRIMARY服务器
4. **文件路径验证**：防止路径遍历攻击

## 未来扩展

1. **增量同步**：只同步变化的文件
2. **文件监控**：使用watchdog监控文件变化
3. **压缩传输**：使用gzip压缩大文件
4. **断点续传**：支持大文件断点续传
5. **冲突解决**：处理文件冲突

## 总结

统一架构的优势：

- ✅ **简化部署** - 单一HTTP服务器，始终运行
- ✅ **无缝切换** - 模式切换不需要重启
- ✅ **自动发现** - SECONDARY模式自动找PRIMARY服务器
- ✅ **健壮性** - 错误验证，防止误操作
- ✅ **可观测性** - 完整的数据库记录
- ✅ **易维护** - 代码更清晰，逻辑更简单
