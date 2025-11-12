# Device Sync - 快速测试指南

## 新功能测试

### 已实现的功能

1. ✅ **托盘菜单勾选状态** - 主/副设备选中时显示 ✓
2. ✅ **主服务器 IP 和端口显示** - 托盘菜单中显示服务器地址
3. ✅ **Web UI 仪表板** - 精美的 Web 界面
4. ✅ **RESTful API** - 提供 JSON API 接口
5. ✅ **一键打开 Web UI** - 点击托盘菜单项自动打开浏览器

## 立即测试

### 步骤 1: 启动 Device Sync

```bash
# 停止旧进程
taskkill /F /IM pythonw.exe

# 启动 launcher
python -m pycore.pyutils.launcher.launcher
```

选择 `[2] - Launch Device Sync Only`

### 步骤 2: 设置为主设备

1. 在系统托盘找到 Device Sync 图标（可能在隐藏区域，点击 `^` 箭头）
2. 右键点击图标
3. 点击 `Set as Primary Device`

### 步骤 3: 查看托盘菜单

再次右键点击图标，你应该看到：

```
✓ Set as Primary Device          [有勾号！]
  Set as Secondary Device
─────────────────────────────
  Server: 192.168.x.x:45679      [你的 IP 地址]
  Web UI: http://192.168.x.x:8080  [Web 地址]
─────────────────────────────
  Restart Service
  Show Status
  Quit Device Sync
```

### 步骤 4: 打开 Web UI

**方法 1（推荐）：**
- 点击托盘菜单中的 `Web UI: http://...` 项
- 浏览器自动打开 Web 界面

**方法 2：**
- 手动打开浏览器
- 访问：`http://localhost:8080`

### 步骤 5: 查看 Web 仪表板

你应该看到一个精美的仪表板，包含：

- **服务器信息**
  - Sync Port: 45679
  - Web Port: 8080
  - Root Directory: D:/programing/core_node

- **文件统计**
  - Total Files: （文件数量）
  - Total Size: （总大小）
  - Status: Active

- **设备模式**
  - Mode: PRIMARY
  - Function: File Server
  - Clients: Ready

- **API 端点**
  - GET /api/status
  - GET /api/files
  - GET /api/stats

### 步骤 6: 测试 API

打开新的命令行窗口：

```bash
# 测试状态 API
curl http://localhost:8080/api/status

# 测试文件列表 API
curl http://localhost:8080/api/files

# 测试统计 API
curl http://localhost:8080/api/stats
```

或在浏览器中直接访问：
- http://localhost:8080/api/status
- http://localhost:8080/api/files
- http://localhost:8080/api/stats

## 预期结果

### 托盘菜单

- ✅ 主设备模式有勾号
- ✅ 显示服务器 IP 和端口
- ✅ 显示 Web UI 地址
- ✅ 点击 Web UI 菜单项打开浏览器

### Web UI

- ✅ 精美的渐变背景
- ✅ 卡片式布局
- ✅ 实时数据显示
- ✅ 每 10 秒自动刷新统计

### API

- ✅ `/api/status` 返回服务器状态
- ✅ `/api/files` 返回文件列表
- ✅ `/api/stats` 返回统计信息
- ✅ JSON 格式响应

## 故障排除

### 问题 1: 托盘图标不显示

```bash
# 运行诊断
cd D:\programing\core_node\pycore\pyutils\launcher\device_sync
python diagnose.py
```

### 问题 2: Web UI 无法访问

```bash
# 查看日志
cd D:\programing\core_node\pycore\pyutils\launcher\device_sync
view_log.bat

# 应该看到：
# [WebServer] Started on port 8080
# [WebServer] Access at: http://localhost:8080
```

### 问题 3: 端口被占用

```bash
# 检查端口
netstat -ano | findstr :8080

# 如果被占用，可以修改端口
# 编辑 sync_server.py，修改 web_port 参数
```

## 功能演示

### 1. 勾选状态演示

**主设备模式：**
```
✓ Set as Primary Device    [勾选]
  Set as Secondary Device  [未勾选]
```

**副设备模式：**
```
  Set as Primary Device    [未勾选]
✓ Set as Secondary Device  [勾选]
```

### 2. IP 地址显示

主设备模式下托盘菜单额外显示：
```
Server: 192.168.1.100:45679
Web UI: http://192.168.1.100:8080
```

### 3. Web UI 截图说明

仪表板包含：
- 顶部：标题 "Device Sync - Primary Server" + 绿色运行状态
- 三个卡片：服务器信息、文件统计、设备模式
- API 文档区域
- 刷新按钮

### 4. API 响应示例

**GET /api/status**
```json
{
  "mode": "primary",
  "running": true,
  "port": 45679,
  "root_dir": "D:\\programing\\core_node",
  "web_port": 8080
}
```

**GET /api/stats**
```json
{
  "file_count": 150,
  "total_size_mb": 25.3
}
```

## 下一步

测试完成后，你可以：

1. **局域网访问**
   - 其他设备访问：`http://你的IP:8080`
   - 例如：`http://192.168.1.100:8080`

2. **集成到自动化脚本**
   ```python
   import requests
   response = requests.get('http://localhost:8080/api/stats')
   print(response.json())
   ```

3. **开发扩展功能**
   - 添加新的 API 端点
   - 自定义 Web UI
   - 集成其他工具

## 完整功能清单

- [x] 托盘菜单勾选标记
- [x] 主服务器 IP 显示
- [x] Web UI 仪表板
- [x] RESTful API
- [x] 自动打开浏览器
- [x] 实时数据刷新
- [x] 响应式设计
- [x] API 文档
- [x] 错误处理
- [x] 日志记录

🎉 所有功能已实现并可测试！
