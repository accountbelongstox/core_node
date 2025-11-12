# Device Sync - HTTP 迁移指南

## 重大改造说明

Device Sync 已完全重构为基于 HTTP/REST API 的架构！

### 主要变更

#### 1. 协议变更

**之前：自定义 TCP 协议**
- 端口：45679
- 协议：自定义二进制协议
- 请求格式：`DISCOVER`, `GET /list`, `GET /file/<path>`
- 响应格式：自定义

**现在：标准 HTTP/REST API**
- 端口：58923 (统一端口，不易被占用)
- 协议：HTTP 1.1
- 请求格式：标准 HTTP GET 请求
- 响应格式：JSON / Binary

#### 2. 端口变更

| 服务 | 之前 | 现在 | 说明 |
|------|------|------|------|
| 文件同步 | 45679 (TCP) | 58923 (HTTP) | 统一使用 HTTP |
| Web UI | 8080 (HTTP) | 58923 (HTTP) | 合并到同一端口 |
| IPC | 45678 (TCP) | 45678 (TCP) | 保持不变 |

**优势：**
- 只需开放一个端口 (58923)
- 不易与其他服务冲突
- 统一的 HTTP 接口

#### 3. 模块重构

**旧模块 → 新模块：**

| 旧模块 | 新模块 | 说明 |
|--------|--------|------|
| `sync_server.py` | `http_sync_server.py` | HTTP 服务器 |
| `sync_client.py` | `http_sync_client.py` | HTTP 客户端 |
| `discovery.py` | `http_discovery.py` | HTTP 发现 |
| `web_server.py` | (集成到 http_sync_server.py) | 统一服务器 |

### API 端点对比

#### 之前（TCP 自定义协议）

```
DISCOVER           → "PRIMARY"
PING               → "PONG"
GET /list          → JSON file list
GET /file/<path>   → Binary file content
```

#### 现在（HTTP REST API）

```
GET /                       → Web UI Dashboard
GET /api/discover           → {"status": "PRIMARY", "port": 58923}
GET /api/ping               → {"status": "PONG", "timestamp": ...}
GET /api/status             → Server status JSON
GET /api/files              → File list JSON
GET /api/file/<path>        → Binary file download
GET /api/stats              → Statistics JSON
```

### 功能增强

#### 1. 动态模式切换

现在支持随时切换主/副设备模式：

**托盘菜单：**
- ✓ Set as Primary Device (有勾号 = 当前模式)
- Set as Secondary Device
- HTTP Server: 192.168.1.100:58923 (主设备时显示)
- Web UI: http://192.168.1.100:58923 (点击打开)

**切换逻辑：**
```python
# 切换到主设备：停止 HTTP 客户端，启动 HTTP 服务器
def set_as_primary():
    if http_client:
        http_client.stop()

    http_server = HTTPFileSyncServer(port=58923)
    http_server.start()

# 切换到副设备：停止 HTTP 服务器，启动 HTTP 客户端
def set_as_secondary():
    if http_server:
        http_server.stop()

    http_client = HTTPFileSyncClient(port=58923)
    http_client.start()
```

#### 2. 统一的 HTTP 服务器

**单一端口提供所有服务：**
- 文件同步 API
- Web UI 仪表板
- 网络发现
- 健康检查

#### 3. 标准 HTTP 客户端

使用 Python 标准库 `urllib`，无需第三方依赖：

```python
import urllib.request

# 获取文件列表
response = urllib.request.urlopen('http://primary:58923/api/files')
files = json.loads(response.read())

# 下载文件
response = urllib.request.urlopen('http://primary:58923/api/file/path/to/file.txt')
content = response.read()
```

## 使用指南

### 启动测试

```bash
# 1. 停止旧进程
taskkill /F /IM pythonw.exe

# 2. 启动 launcher
python -m pycore.pyutils.launcher.launcher

# 选择 [2] - Launch Device Sync Only
```

### 设置主设备

1. 右键托盘图标
2. 点击 `Set as Primary Device`
3. 查看菜单：
   ```
   ✓ Set as Primary Device
     Set as Secondary Device
   ────────────────────────
     HTTP Server: 192.168.1.100:58923
     Web UI: http://192.168.1.100:58923
   ```

### 访问 Web UI

**方法 1：托盘菜单**
- 点击 `Web UI: http://...`
- 浏览器自动打开

**方法 2：手动访问**
- `http://localhost:58923`
- `http://192.168.1.100:58923` (局域网)

### 设置副设备

1. 右键托盘图标
2. 点击 `Set as Secondary Device`
3. 自动发现主设备
4. 开始同步（默认禁用，需手动启用）

### 切换模式

**主 → 副：**
- 右键托盘图标
- 点击 `Set as Secondary Device`
- HTTP 服务器自动停止
- HTTP 客户端自动启动

**副 → 主：**
- 右键托盘图标
- 点击 `Set as Primary Device`
- HTTP 客户端自动停止
- HTTP 服务器自动启动

## API 文档

### GET /api/discover

网络发现端点。

**请求：**
```
GET http://192.168.1.100:58923/api/discover
```

**响应：**
```json
{
  "status": "PRIMARY",
  "port": 58923
}
```

### GET /api/ping

健康检查端点。

**请求：**
```
GET http://192.168.1.100:58923/api/ping
```

**响应：**
```json
{
  "status": "PONG",
  "timestamp": 1699123456.789
}
```

### GET /api/status

服务器状态。

**请求：**
```
GET http://192.168.1.100:58923/api/status
```

**响应：**
```json
{
  "mode": "primary",
  "running": true,
  "port": 58923,
  "root_dir": "D:\\programing\\core_node",
  "file_count": 150,
  "timestamp": 1699123456.789
}
```

### GET /api/files

文件列表。

**请求：**
```
GET http://192.168.1.100:58923/api/files
```

**响应：**
```json
{
  "status": "ok",
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

### GET /api/file/<path>

下载文件。

**请求：**
```
GET http://192.168.1.100:58923/api/file/pycore/__init__.py
```

**响应：**
```
Content-Type: application/octet-stream
Content-Disposition: attachment; filename="__init__.py"

<文件二进制内容>
```

### GET /api/stats

统计信息。

**请求：**
```
GET http://192.168.1.100:58923/api/stats
```

**响应：**
```json
{
  "file_count": 150,
  "total_size": 26214400,
  "total_size_mb": 25.0
}
```

## 优势总结

### 1. 标准化

- ✅ 使用标准 HTTP 协议
- ✅ RESTful API 设计
- ✅ JSON 数据格式
- ✅ 易于集成和调试

### 2. 统一端口

- ✅ 只需一个端口 (58923)
- ✅ 防火墙配置简单
- ✅ 不易与其他服务冲突

### 3. 灵活切换

- ✅ 动态切换主/副模式
- ✅ HTTP 服务器自动启停
- ✅ 无需重启程序

### 4. 易于调试

- ✅ 浏览器直接访问
- ✅ curl 命令测试
- ✅ 标准 HTTP 工具

### 5. 扩展性强

- ✅ 易于添加新 API
- ✅ 支持更多 HTTP 特性
- ✅ 可集成认证、加密等

## 迁移检查清单

- [x] 协议改为 HTTP
- [x] 端口改为 58923
- [x] 合并 Web UI 到统一端口
- [x] 支持动态切换模式
- [x] 托盘菜单显示勾选状态
- [x] 托盘菜单显示 HTTP 服务器信息
- [x] 实现完整的 REST API
- [x] 网络发现改为 HTTP
- [x] 客户端改为 HTTP 请求
- [x] 冲突检测仍然有效

## 已测试场景

- [ ] 启动为主设备
- [ ] 启动为副设备
- [ ] 主 → 副切换
- [ ] 副 → 主切换
- [ ] Web UI 访问
- [ ] API 调用
- [ ] 文件同步
- [ ] 网络发现
- [ ] 冲突检测

## 下一步测试

请按照以下步骤测试：

1. **启动测试**
   ```bash
   python -m pycore.pyutils.launcher.launcher
   # 选择 [2]
   ```

2. **主设备测试**
   - 设置为主设备
   - 检查托盘菜单（应显示 ✓ 和 HTTP Server 信息）
   - 点击 Web UI 菜单项
   - 验证浏览器打开 http://localhost:58923

3. **API 测试**
   ```bash
   curl http://localhost:58923/api/status
   curl http://localhost:58923/api/files
   curl http://localhost:58923/api/stats
   ```

4. **模式切换测试**
   - 从主设备切换到副设备
   - 验证 HTTP 服务器停止
   - 验证客户端开始发现

5. **副设备测试**
   - 在另一台机器上设置为副设备
   - 验证自动发现主设备
   - 启用同步
   - 验证文件同步

## 端口使用说明

### 为什么选择 58923？

1. **5 万以上端口**
   - 系统保留端口: 0-1023
   - 注册端口: 1024-49151
   - 动态端口: 49152-65535
   - 58923 在动态端口范围内，不易冲突

2. **容易记忆**
   - 58923 = "我发就爱上"（谐音）
   - 独特且不常用

3. **避免冲突**
   - 8080: 常用于 Web 开发
   - 3000: Node.js 默认
   - 5000: Flask 默认
   - 8000: Django 默认
   - 45679: 之前使用，可能冲突

## 故障排除

### Web UI 无法访问

```bash
# 检查端口是否监听
netstat -ano | findstr :58923

# 查看日志
cd D:\programing\core_node\pycore\pyutils\launcher\device_sync
view_log.bat

# 应该看到：
# [HTTPServer] Started on port 58923
```

### 模式切换失败

- 检查是否正确停止旧模式
- 查看日志中的错误信息
- 确保端口未被占用

### 文件同步不工作

- 确认主设备已启动
- 确认副设备已发现主设备
- 确认已启用同步（副设备默认禁用）
- 检查网络连接

## 总结

🎉 Device Sync 现已完全基于 HTTP！

**核心优势：**
- 统一端口 58923
- 标准 HTTP/REST API
- 动态模式切换
- 易于调试和集成
