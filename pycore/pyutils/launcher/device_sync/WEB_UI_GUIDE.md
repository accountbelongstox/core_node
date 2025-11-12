# Device Sync - Web UI 使用指南

## 新功能概述

Device Sync 现在提供完整的 Web 界面和 RESTful API！

### 主要功能

1. **托盘菜单勾选状态** ✓
   - 主设备和副设备模式选中时显示勾号
   - 一目了然当前设备模式

2. **主服务器 IP 和端口显示**
   - 托盘菜单直接显示服务器地址
   - 点击即可在浏览器中打开 Web UI

3. **Web UI 仪表板**
   - 精美的现代化界面
   - 实时显示文件统计
   - 服务器状态监控
   - 自动刷新（每 10 秒）

4. **RESTful API**
   - `/api/status` - 服务器状态
   - `/api/files` - 文件列表
   - `/api/stats` - 统计信息

## 使用方法

### 1. 启动 Device Sync

```bash
python -m pycore.pyutils.launcher.launcher
```

选择 `[2] - Launch Device Sync Only`

### 2. 设置为主设备

右键点击系统托盘图标 → `Set as Primary Device`

**托盘菜单将显示：**

```
✓ Set as Primary Device          [有勾号]
  Set as Secondary Device
─────────────────────────────
  Server: 192.168.1.100:45679    [服务器地址]
  Web UI: http://192.168.1.100:8080  [点击打开]
─────────────────────────────
  Restart Service
  Show Status
  Quit Device Sync
```

### 3. 访问 Web UI

**方法 1：通过托盘菜单**
- 右键托盘图标
- 点击 `Web UI: http://...` 菜单项
- 自动在浏览器中打开

**方法 2：手动访问**
- 打开浏览器
- 访问：`http://localhost:8080`
- 或使用局域网 IP：`http://192.168.1.100:8080`

### 4. Web UI 界面

#### 仪表板包含：

**📡 服务器信息**
- Sync Port: 45679
- Web Port: 8080
- Root Directory: D:/programing/core_node

**📁 文件统计**
- Total Files: 文件总数
- Total Size: 总大小（MB）
- Status: 运行状态

**⚙️ 设备模式**
- Mode: PRIMARY
- Function: File Server
- Clients: 就绪状态

**📚 API 端点**
- GET /api/status
- GET /api/files
- GET /api/stats

## API 使用示例

### 1. 获取服务器状态

```bash
curl http://localhost:8080/api/status
```

**响应：**
```json
{
  "mode": "primary",
  "running": true,
  "port": 45679,
  "root_dir": "D:\\programing\\core_node",
  "web_port": 8080
}
```

### 2. 获取文件列表

```bash
curl http://localhost:8080/api/files
```

**响应：**
```json
{
  "count": 150,
  "files": [
    {
      "path": "pycore/__init__.py",
      "size": 1024,
      "mtime": 1699123456.789
    },
    ...
  ]
}
```

### 3. 获取统计信息

```bash
curl http://localhost:8080/api/stats
```

**响应：**
```json
{
  "file_count": 150,
  "total_size_mb": 25.3
}
```

## Python 代码示例

### 调用 API

```python
import requests

# 获取服务器状态
response = requests.get('http://localhost:8080/api/status')
status = response.json()
print(f"Server mode: {status['mode']}")
print(f"Running: {status['running']}")

# 获取文件列表
response = requests.get('http://localhost:8080/api/files')
files = response.json()
print(f"Total files: {files['count']}")

# 获取统计信息
response = requests.get('http://localhost:8080/api/stats')
stats = response.json()
print(f"File count: {stats['file_count']}")
print(f"Total size: {stats['total_size_mb']} MB")
```

## 功能特点

### 1. 托盘菜单改进

**勾选状态：**
- ✓ 主设备选中时显示勾号
- ✓ 副设备选中时显示勾号
- 未选中的模式不显示勾号

**主服务器信息显示：**
- 只在主设备模式下显示
- 显示服务器 IP 和端口
- 显示 Web UI 地址
- 点击 Web UI 菜单项自动打开浏览器

### 2. Web UI 特性

**现代化设计：**
- 响应式布局（支持手机、平板、电脑）
- 渐变背景
- 卡片式设计
- 清晰的数据展示

**实时更新：**
- 每 10 秒自动刷新统计数据
- 无需手动刷新页面
- 使用 JavaScript fetch API

**易于使用：**
- 一键刷新按钮
- 清晰的 API 文档
- 友好的错误提示

### 3. API 设计

**RESTful 标准：**
- GET 请求获取数据
- JSON 格式响应
- 统一的接口设计

**易于集成：**
- 支持所有编程语言
- 标准 HTTP 协议
- CORS 友好

## 端口配置

### 默认端口：

- **同步端口:** 45679
- **Web UI 端口:** 8080
- **IPC 端口:** 45678

### 修改端口：

如果端口冲突，可以在代码中修改：

```python
# sync_server.py
server = FileSyncServer(
    root_dir='D:/programing/core_node',
    port=45679,        # 同步端口
    web_port=8080      # Web UI 端口
)
```

## 安全提示

⚠️ **注意事项：**

1. **局域网访问**
   - Web UI 默认监听 `0.0.0.0`（所有网络接口）
   - 局域网内所有设备都可以访问
   - 建议只在受信任的网络中使用

2. **无认证**
   - 当前版本没有登录验证
   - 任何人都可以访问 Web UI 和 API
   - 不要在公网上暴露

3. **防火墙**
   - 确保端口 8080 在防火墙中开放
   - Windows 可能会弹出防火墙提示

## 故障排除

### Web UI 无法访问

**检查步骤：**

1. 确认已设置为主设备
   ```
   右键托盘图标 → 检查是否有 ✓ Set as Primary Device
   ```

2. 检查 Web 服务器是否启动
   ```bash
   # 查看日志
   view_log.bat

   # 应该看到：[WebServer] Started on port 8080
   ```

3. 检查端口是否被占用
   ```bash
   netstat -ano | findstr :8080
   ```

4. 尝试使用 localhost
   ```
   http://localhost:8080
   ```

5. 检查防火墙
   ```
   Windows 防火墙 → 允许应用通过防火墙 → python.exe
   ```

### API 返回错误

**常见问题：**

1. **404 Not Found**
   - 检查 URL 路径是否正确
   - API 路径：`/api/status`, `/api/files`, `/api/stats`

2. **连接超时**
   - 检查服务器是否运行
   - 检查网络连接
   - 尝试使用 localhost

3. **数据为空**
   - 服务器可能刚启动
   - 文件缓存还未建立
   - 等待几秒后重试

## 开发扩展

### 添加新的 API 端点

在 `web_server.py` 中添加：

```python
def do_GET(self):
    """Handle GET requests."""
    parsed_path = urllib.parse.urlparse(self.path)
    path = parsed_path.path

    if path == '/api/my_endpoint':
        self._serve_my_endpoint()
    # ... 其他路由

def _serve_my_endpoint(self):
    """Your custom endpoint."""
    data = {'message': 'Hello World'}
    self._send_json_response(data)
```

### 自定义 Web UI

修改 `_generate_dashboard_html()` 方法中的 HTML 代码。

## 总结

Device Sync 现在提供完整的 Web 界面和 API，让文件同步管理更加直观和便捷！

**主要优势：**
- ✓ 可视化仪表板
- ✓ 实时状态监控
- ✓ RESTful API
- ✓ 托盘菜单改进
- ✓ 易于集成

**适用场景：**
- 开发环境文件同步
- 局域网文件分发
- 自动化脚本集成
- 远程监控管理
