# Device Sync - 全面重构设计

**设计日期：** 2025-01-12
**版本：** 3.0.0

## 核心需求

### 1. 设备发现（端口5892）
- ✅ 每个设备广播自己的存在（UDP）
- ✅ 接收其他设备的广播
- ✅ 维护在线设备列表
- ✅ 自动检测设备离线

### 2. 实时通信（WebSocket，端口58923）
- ✅ 所有设备运行WebSocket服务器
- ✅ 设备间实时通信
- ✅ 主设备可以推送通知到所有副设备
- ✅ 状态变更实时同步

### 3. Web UI（HTTP，端口58923）
- ✅ 每个设备都能打开Web UI
- ✅ 显示所有在线设备列表
- ✅ 根据设备状态显示不同界面
- ✅ 主/副设备秒切

### 4. 同步控制
- ✅ 设备切换时自动关闭同步
- ✅ 需要手动重新启用
- ✅ 启用前验证唯一主设备
- ✅ 冲突检测和预防

## 新架构设计

### 端口分配

| 端口 | 协议 | 用途 |
|------|------|------|
| 5892 | UDP | 设备发现广播 |
| 58923 | HTTP/WebSocket | Web UI + 实时通信 |
| 45678 | TCP | IPC（单实例检测） |

### 架构层次

```
┌─────────────────────────────────────────────┐
│           Tray Menu / Web UI                │
│        (用户界面 + 控制面板)                │
└────────────────┬────────────────────────────┘
                 │
┌────────────────┴────────────────────────────┐
│         Device Manager (设备管理器)         │
│  - 设备状态管理                             │
│  - 模式切换控制                             │
│  - 同步启停控制                             │
└────┬─────────┬──────────┬──────────────────┘
     │         │          │
     ▼         ▼          ▼
┌─────────┐ ┌──────────┐ ┌────────────────┐
│ Device  │ │WebSocket │ │ File Sync      │
│Discovery│ │ Server   │ │ Service        │
│(UDP:5892)│ │(WS:58923)│ │ (HTTP API)     │
└─────────┘ └──────────┘ └────────────────┘
```

## 详细设计

### 1. 设备发现（device_discovery.py）

**功能：**
- UDP广播自身信息（每3秒）
- 监听其他设备广播
- 维护在线设备列表
- 自动移除离线设备（超时15秒）

**广播数据格式：**
```json
{
  "device_id": "uuid-xxx-xxx",
  "hostname": "DESKTOP-PC1",
  "ip": "192.168.1.100",
  "mode": "primary",  // or "secondary"
  "http_port": 58923,
  "ws_port": 58923,
  "timestamp": 1699123456.789,
  "sync_enabled": false
}
```

**实现：**
```python
class DeviceDiscovery:
    def __init__(self, port=5892):
        self.port = port
        self.device_id = self._generate_device_id()
        self.online_devices = {}  # {device_id: device_info}

    def start_broadcast(self):
        """Start broadcasting device info"""

    def start_listening(self):
        """Start listening for other devices"""

    def get_online_devices(self) -> List[Dict]:
        """Get all online devices"""
```

### 2. WebSocket服务器（websocket_server.py）

**功能：**
- 接受WebSocket连接
- 实时推送设备状态变更
- 主设备广播通知
- 双向通信

**消息格式：**
```json
{
  "type": "status_change",
  "from": "device-id-1",
  "data": {
    "mode": "primary",
    "sync_enabled": false
  },
  "timestamp": 1699123456.789
}
```

**消息类型：**
- `device_online` - 设备上线
- `device_offline` - 设备离线
- `status_change` - 状态变更（主/副切换）
- `sync_start` - 同步开始
- `sync_stop` - 同步停止
- `primary_announce` - 主设备宣告
- `conflict_detected` - 冲突检测

**实现：**
```python
class WebSocketDeviceServer:
    def __init__(self, port=58923):
        self.port = port
        self.clients = set()  # WebSocket连接集合

    async def broadcast(self, message: dict):
        """广播消息到所有连接的设备"""

    async def handle_message(self, websocket, message: dict):
        """处理接收到的消息"""
```

### 3. 设备管理器（device_manager.py）

**功能：**
- 管理设备状态（主/副）
- 控制同步启停
- 验证主设备唯一性
- 处理模式切换

**状态机：**
```
初始状态: IDLE
  │
  ├─→ PRIMARY (主设备)
  │     ├─ Sync: DISABLED (默认)
  │     └─ Sync: ENABLED (手动启用)
  │
  └─→ SECONDARY (副设备)
        ├─ Sync: DISABLED (默认)
        └─ Sync: ENABLED (手动启用，需验证唯一主设备)
```

**切换规则：**
1. 任何模式切换 → 自动关闭同步
2. 启用同步前 → 验证唯一主设备
3. 检测到多主 → 立即关闭同步
4. 主设备离线 → 副设备可以升级

**实现：**
```python
class DeviceManager:
    def __init__(self):
        self.mode = None  # 'primary' or 'secondary'
        self.sync_enabled = False
        self.device_discovery = DeviceDiscovery()
        self.websocket_server = WebSocketDeviceServer()

    def set_mode(self, mode: str):
        """设置设备模式（自动关闭同步）"""
        # 1. 关闭同步
        self.sync_enabled = False
        # 2. 切换模式
        self.mode = mode
        # 3. 广播状态变更
        self.websocket_server.broadcast({
            'type': 'status_change',
            'data': {'mode': mode, 'sync_enabled': False}
        })

    def enable_sync(self) -> bool:
        """启用同步（验证唯一主设备）"""
        if self.mode == 'secondary':
            # 验证唯一主设备
            primary_count = self._count_primary_devices()
            if primary_count != 1:
                return False  # 多主冲突或无主设备

        self.sync_enabled = True
        return True

    def _count_primary_devices(self) -> int:
        """统计主设备数量"""
        devices = self.device_discovery.get_online_devices()
        return sum(1 for d in devices if d['mode'] == 'primary')
```

### 4. Web UI重构

**主页（index.html）：**
```html
<!DOCTYPE html>
<html>
<head>
    <title>Device Sync - Dashboard</title>
</head>
<body>
    <h1>Device Sync Dashboard</h1>

    <!-- 当前设备状态 -->
    <div id="current-device">
        <h2>Current Device</h2>
        <p>Mode: <span id="mode">-</span></p>
        <p>Sync: <span id="sync-status">-</span></p>
        <button onclick="setMode('primary')">Set as Primary</button>
        <button onclick="setMode('secondary')">Set as Secondary</button>
        <button onclick="toggleSync()">Toggle Sync</button>
    </div>

    <!-- 在线设备列表 -->
    <div id="online-devices">
        <h2>Online Devices</h2>
        <table id="device-table">
            <thead>
                <tr>
                    <th>Hostname</th>
                    <th>IP</th>
                    <th>Mode</th>
                    <th>Sync</th>
                    <th>Last Seen</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    </div>

    <script>
        // WebSocket连接
        const ws = new WebSocket('ws://localhost:58923/ws');

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            handleMessage(data);
        };

        function setMode(mode) {
            fetch('/api/mode', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({mode: mode})
            });
        }

        function toggleSync() {
            fetch('/api/sync/toggle', {method: 'POST'});
        }

        // 实时更新设备列表
        function handleMessage(data) {
            if (data.type === 'device_list') {
                updateDeviceTable(data.devices);
            }
        }
    </script>
</body>
</html>
```

### 5. API端点重构

**新增API：**

```
GET  /api/devices              → 获取所有在线设备
POST /api/mode                 → 设置模式（自动关闭同步）
POST /api/sync/enable          → 启用同步（验证主设备）
POST /api/sync/disable         → 禁用同步
GET  /api/sync/validate        → 验证主设备唯一性
WS   /ws                       → WebSocket连接
```

**保留API：**
```
GET  /api/discover             → 网络发现
GET  /api/ping                 → 健康检查
GET  /api/status               → 服务器状态
GET  /api/files                → 文件列表
GET  /api/file/<path>          → 下载文件
GET  /api/stats                → 统计信息
```

## 实现步骤

### Phase 1: 设备发现（UDP）
1. ✅ 创建 `device_discovery.py`
2. ✅ 实现UDP广播
3. ✅ 实现设备列表维护
4. ✅ 集成到设备管理器

### Phase 2: WebSocket通信
1. ✅ 创建 `websocket_server.py`
2. ✅ 实现WebSocket服务器
3. ✅ 实现消息广播
4. ✅ 集成HTTP服务器

### Phase 3: 设备管理器
1. ✅ 创建 `device_manager.py`
2. ✅ 实现模式切换逻辑
3. ✅ 实现同步控制
4. ✅ 实现主设备验证

### Phase 4: Web UI
1. ✅ 重构Web UI
2. ✅ 添加设备列表显示
3. ✅ 添加WebSocket实时更新
4. ✅ 添加控制按钮

### Phase 5: 托盘菜单集成
1. ✅ 集成设备管理器
2. ✅ 更新托盘菜单逻辑
3. ✅ 添加设备列表子菜单

### Phase 6: 测试
1. ✅ 单设备测试
2. ✅ 多设备测试
3. ✅ 模式切换测试
4. ✅ 同步验证测试
5. ✅ 冲突检测测试

## 技术栈

### 核心库
- `asyncio` - 异步IO
- `websockets` - WebSocket服务器
- `socket` - UDP广播
- `threading` - 后台任务（最小化使用）

### 数据流

**设备上线流程：**
```
1. 设备启动
   ↓
2. 启动UDP广播（端口5892）
   ↓
3. 启动HTTP/WebSocket服务器（端口58923）
   ↓
4. 广播自己的存在
   ↓
5. 接收其他设备广播
   ↓
6. 更新在线设备列表
   ↓
7. WebSocket通知所有设备
```

**模式切换流程：**
```
1. 用户点击"Set as Primary"
   ↓
2. 调用 device_manager.set_mode('primary')
   ↓
3. 自动关闭同步
   ↓
4. 切换模式标志
   ↓
5. 通过WebSocket广播状态变更
   ↓
6. 更新Web UI
   ↓
7. 更新托盘菜单
```

**同步启用流程：**
```
1. 用户点击"Enable Sync"
   ↓
2. 调用 device_manager.enable_sync()
   ↓
3. 验证主设备唯一性
   ├─ 唯一 → 继续
   └─ 多个/无 → 拒绝并提示
   ↓
4. 启用同步标志
   ↓
5. 通过WebSocket广播
   ↓
6. 开始文件同步
```

## 安全性

### 验证机制
1. **主设备唯一性验证**
   - 启用同步前检查
   - 定期检查（每10秒）
   - 检测到多主立即停止

2. **设备身份验证**
   - 使用设备ID（UUID）
   - IP地址验证
   - 心跳超时检测

3. **同步冲突预防**
   - 同步前验证
   - 同步中监控
   - 冲突自动停止

## 性能优化

### 广播频率
- UDP广播：每3秒
- 心跳超时：15秒
- WebSocket心跳：30秒

### 资源管理
- 设备列表自动清理
- WebSocket连接池管理
- 日志文件轮转

## 测试场景

### 场景1: 双设备正常同步
```
设备A: 主设备，启用同步
设备B: 副设备，启用同步
结果: 文件正常同步
```

### 场景2: 主设备切换
```
设备A: 主设备 → 副设备
设备B: 副设备 → 主设备
结果: 同步自动关闭，需要重新启用
```

### 场景3: 多主冲突
```
设备A: 主设备
设备B: 主设备（错误）
结果: 设备B无法启用同步，显示警告
```

### 场景4: 主设备离线
```
设备A: 主设备（离线）
设备B: 副设备
结果: 检测到无主设备，可以升级为主设备
```

## 总结

这次全面重构将实现：

1. ✅ **真正的P2P架构** - 所有设备平等，互相发现
2. ✅ **实时通信** - WebSocket替代HTTP轮询
3. ✅ **即时切换** - 主/副设备秒切
4. ✅ **安全同步** - 严格验证，自动保护
5. ✅ **完整可视化** - Web UI显示所有设备

**技术亮点：**
- UDP广播发现（端口5892）
- WebSocket实时通信（端口58923）
- 异步架构（asyncio）
- 状态机管理
- 冲突自动检测

---

**开始实现！** 🚀
