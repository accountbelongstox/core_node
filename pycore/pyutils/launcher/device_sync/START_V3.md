# Device Sync v3.0 - 快速开始指南

**版本：** 3.0.0 (全面重构)
**更新日期：** 2025-01-12

## 🎉 新特性

### 1. UDP设备发现 (端口5892)
- ✅ 自动发现局域网所有设备
- ✅ 实时显示在线/离线状态
- ✅ 每3秒广播，15秒超时

### 2. 统一HTTP+WebSocket服务器 (端口58923)
- ✅ HTTP API + WebSocket 实时通信
- ✅ 每个设备都能访问Web UI
- ✅ 实时查看所有在线设备
- ✅ 双向通信，主设备可推送通知

### 3. 智能模式切换
- ✅ 主/副设备秒切
- ✅ 切换时自动关闭同步
- ✅ 需要手动重新启用
- ✅ 启用前验证唯一主设备

### 4. 冲突预防
- ✅ 同步前验证主设备唯一性
- ✅ 检测到多主设备自动禁用同步
- ✅ 实时通知警告

## 🚀 快速启动

### 步骤 1: 安装依赖

```bash
pip install aiohttp websockets pystray pillow
```

### 步骤 2: 启动程序

```bash
cd D:\programing\core_node
python -m pycore.pyutils.launcher.launcher

# 选择 [2] - Launch Device Sync Only
```

### 步骤 3: 设置主设备

1. 在系统托盘找到图标
2. 右键点击 → `Set as Primary Device` (会有勾✓)
3. 注意：同步已自动关闭，需要手动启用

### 步骤 4: 访问Web UI

**打开浏览器访问：**
```
http://localhost:58923
```

**或点击托盘菜单：**
```
Web UI: http://192.168.x.x:58923
```

**Web UI功能：**
- 📊 实时显示所有在线设备
- 🔄 查看每个设备的模式和同步状态
- ⚡ 实时更新（WebSocket）
- 🎯 一键切换主/副模式
- ✅ 一键启用/禁用同步

### 步骤 5: 设置副设备（另一台机器）

1. 在另一台电脑上启动程序
2. 右键托盘图标 → `Set as Secondary Device`
3. 查看 Web UI - 应该能看到主设备
4. **重要：** 点击 `Enable Sync` 前，确保只有一台主设备

## 📊 端口使用

| 端口 | 协议 | 用途 |
|------|------|------|
| 5892 | UDP | 设备发现广播 |
| 58923 | HTTP/WebSocket | Web UI + API + 实时通信 |
| 45678 | TCP | IPC (单实例检测) |

## 🔧 核心操作

### 模式切换

**主设备 → 副设备：**
1. 托盘菜单 → `Set as Secondary Device`
2. 同步自动关闭 ✅
3. 需要手动重新启用同步

**副设备 → 主设备：**
1. 托盘菜单 → `Set as Primary Device`
2. 同步自动关闭 ✅
3. **主设备不需要启用同步**（只提供文件服务）

### 启用同步

**重要说明：**
- ✅ **主设备 (Primary)** - 不需要启用同步，只提供HTTP文件服务
- ✅ **副设备 (Secondary)** - 需要启用同步，从主设备下载文件
- ⚠️ 托盘菜单中，主设备不会显示"Enable Sync"选项

**启用前必须满足以下条件（仅副设备）：**
- ✅ 网络上有且仅有一台主设备
- ✅ 能够发现主设备
- ✅ 当前设备已设置为Secondary模式

**步骤（仅副设备）：**
1. 托盘菜单 → `Enable Sync`
2. 系统自动验证主设备唯一性
3. 验证通过 → 同步启用 ✅
4. 验证失败 → 显示错误提示 ❌

### 查看日志

**托盘菜单 → `Show Logs`**

日志位置：
- Windows: `C:\Users\{用户}\.device_sync\logs\`
- Linux/Mac: `~/.device_sync/logs/`

## 🌐 Web UI使用

### 访问方式

**本地访问：**
```
http://localhost:58923
```

**局域网访问（任意设备）：**
```
http://192.168.x.x:58923
```

### 功能说明

**当前设备面板：**
- 显示：主机名、IP、模式、同步状态
- 按钮：切换模式、启用/禁用同步

**在线设备表格：**
- 实时显示所有设备
- 列：状态、主机名、IP、模式、同步状态、最后心跳
- WebSocket 实时更新

## ⚠️ 重要注意事项

### 1. 唯一主设备规则

**✅ 正确：**
```
设备A: Primary (Sync: ON)
设备B: Secondary (Sync: ON)
设备C: Secondary (Sync: OFF)
```

**❌ 错误 - 多主设备：**
```
设备A: Primary (Sync: ON)  ← 冲突！
设备B: Primary (Sync: ON)  ← 冲突！
```

**结果：** 所有副设备无法启用同步，显示错误

### 2. 模式切换自动关闭同步

```
用户操作: Set as Primary
       ↓
系统自动: Sync → OFF (自动关闭)
       ↓
用户需要: 手动点击 "Enable Sync"
```

### 3. 同步启用验证

```
用户点击: Enable Sync
       ↓
系统验证: 主设备数量
       ├─ == 1 → 允许启用 ✅
       ├─ > 1  → 拒绝 (多主冲突) ❌
       └─ == 0 → 拒绝 (无主设备) ❌
```

## 🧪 测试场景

### 场景1: 单主单副 (正常)

```
设备A: Set as Primary (自动提供文件服务，无需Enable Sync)
设备B: Set as Secondary → Enable Sync
结果: ✅ 同步正常工作（B从A同步文件）
```

### 场景2: 模式切换

```
设备A: Primary → Secondary
结果:
  - Sync 自动关闭 ✅
  - 需要重新启用
  - Web UI 实时更新
```

### 场景3: 多主冲突

```
设备A: Primary (Sync: ON)
设备B: Primary (Sync: ON) ← 错误！
设备C: Secondary → Enable Sync
结果: ❌ 提示 "Multiple primary devices detected"
```

### 场景4: Web UI查看

```
打开: http://localhost:58923
可以看到:
  - 当前设备信息
  - 所有在线设备列表
  - 实时更新状态
  - 一键控制
```

## 📁 文件结构

```
device_sync/
├── device_manager.py          # 设备管理器 (核心)
├── device_discovery_udp.py    # UDP 设备发现
├── unified_server.py          # HTTP + WebSocket 服务器
├── tray_menu.py              # 托盘菜单
├── logging_config.py         # 日志配置
└── http_sync_client.py       # HTTP 同步客户端
```

## 🆘 故障排查

### 问题1: 看不到其他设备

**检查：**
```bash
# 1. 确认端口开放
netstat -ano | findstr :5892
netstat -ano | findstr :58923

# 2. 检查防火墙
# Windows: 允许 Python 通过防火墙
# Linux: sudo ufw allow 5892/udp && sudo ufw allow 58923/tcp

# 3. 查看日志
# 托盘菜单 → Show Logs
```

### 问题2: 无法启用同步

**原因：**
- 多个主设备 (检查 Web UI)
- 无主设备 (设置一台为主设备)
- 网络不通 (ping 测试)

**解决：**
1. 打开 Web UI 查看设备列表
2. 确保只有一台 Primary 设备
3. 检查网络连接

### 问题3: Web UI 无法访问

**检查：**
```bash
# 1. 测试本地
curl http://localhost:58923/api/status

# 2. 查看日志
cat ~/.device_sync/logs/device_sync_*.log | grep "Unified server"
```

## 🎯 最佳实践

### 推荐配置

**办公室场景：**
```
台式机: Primary (固定，提供文件服务)
笔记本: Secondary (移动，Sync: ON/OFF 按需)
```

**多设备开发：**
```
开发主机: Primary (提供文件服务)
测试机1: Secondary (Sync: ON)
测试机2: Secondary (Sync: OFF) - 独立测试
```

### 操作流程

**1. 首次设置：**
```
1. 所有设备启动程序
2. 设置一台为 Primary（自动提供文件服务）
3. 其他设置为 Secondary
4. 在Secondary设备上逐个启用同步
```

**2. 日常使用：**
```
1. 打开 Web UI 检查设备状态
2. 确认同步状态
3. 需要时切换模式
4. 遇到问题查看日志
```

**3. 故障恢复：**
```
1. 查看 Web UI 设备列表
2. 检查是否有多主设备
3. 禁用所有同步
4. 重新逐个启用
```

## 📖 API 文档

### HTTP API

```bash
# 获取在线设备
GET /api/devices

# 获取当前设备状态
GET /api/status

# 设置模式
POST /api/mode
{"mode": "primary"}  # or "secondary"

# 启用同步
POST /api/sync/enable

# 禁用同步
POST /api/sync/disable

# 文件列表
GET /api/files

# 下载文件
GET /api/file/{path}
```

### WebSocket

```javascript
// 连接
const ws = new WebSocket('ws://localhost:58923/ws');

// 接收消息
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'device_list') {
    // 设备列表更新
    console.log(data.devices);
  }

  if (data.type === 'status_change') {
    // 状态变更
    console.log(data.data);
  }
};

// 发送消息
ws.send(JSON.stringify({
  type: 'get_devices'
}));
```

## 🎉 总结

✅ **全面重构完成！**

**核心改进：**
1. UDP 自动设备发现 (端口 5892)
2. HTTP + WebSocket 统一服务器 (端口 58923)
3. 实时 Web UI 显示所有设备
4. 智能模式切换 + 同步验证
5. 冲突自动检测和预防

**立即开始：**
```bash
python -m pycore.pyutils.launcher.launcher
# 选择 [2]
# 右键托盘 → Set as Primary Device
# 打开 http://localhost:58923
# 享受全新的设备同步体验！
```

---

**需要帮助？** 查看日志文件：托盘菜单 → Show Logs
