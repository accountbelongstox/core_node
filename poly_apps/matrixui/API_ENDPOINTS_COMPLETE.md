# Matrix RPC v2 完整 API 端点列表

**服务器**: `http://localhost:48000`
**WebSocket**: `ws://localhost:48000/rpc/ws`
**客户端库**: `http://localhost:48000/rpc/src/unified_rpc_client.js`

---

## 📊 端点统计

- **总端点数**: 47
- **健康和系统**: 3 个
- **设备管理**: 7 个
- **屏幕控制**: 7 个
- **文件管理**: 3 个
- **录制和截图**: 4 个
- **群组批量操作**: 7 个
- **配置管理**: 6 个
- **设备控制**: 7 个
- **视频流**: 3 个

---

## 1. 健康和系统路由 (3)

### 1.1 health
- **路由**: `health`
- **同步**: `sync=True`
- **参数**: `{}`
- **响应**:
```json
{
  "status": "healthy",
  "service": "Matrix",
  "version": "2.0.0",
  "protocol": "RPC v2 WebSocket",
  "timestamp": "2025-12-08T..."
}
```

### 1.2 health.detailed
- **路由**: `health.detailed`
- **同步**: `sync=True`
- **参数**: `{}`
- **响应**: 包含系统资源信息（CPU、内存、磁盘）

### 1.3 heartbeat.info
- **路由**: `heartbeat.info`
- **同步**: `sync=True`
- **参数**: `{}`
- **响应**:
```json
{
  "success": true,
  "total_ticks": 12345,
  "uptime_seconds": 3600.5,
  "last_heartbeat_time": "2025-12-08T..."
}
```

---

## 2. 设备管理路由 (7)

### 2.1 device.list
- **路由**: `device.list`
- **同步**: `sync=True`
- **参数**: `{}`
- **响应**:
```json
{
  "devices": [
    {
      "serial": "192.168.1.100:5555",
      "status": "device",
      "model": "Pixel 6",
      "manufacturer": "Google"
    }
  ],
  "count": 1
}
```

### 2.2 device.info
- **路由**: `device.info`
- **同步**: `sync=False`
- **参数**: `{"serial": "设备序列号"}`
- **响应**:
```json
{
  "device": {
    "serial": "192.168.1.100:5555",
    "model": "Pixel 6",
    "manufacturer": "Google",
    "android_version": "13",
    "sdk_version": "33",
    "resolution": {"width": 1080, "height": 2400},
    "dpi": 420
  }
}
```

### 2.3 device.connect
- **路由**: `device.connect`
- **同步**: `sync=False`
- **参数**:
```json
{
  "serial": "设备序列号",
  "max_size": 720,
  "bit_rate": 8000000,
  "max_fps": 60,
  "codec": "h264",
  "control": true,
  "locked_video_orientation": -1,
  "device_name": "自定义名称"
}
```

### 2.4 device.disconnect
- **路由**: `device.disconnect`
- **同步**: `sync=False`
- **参数**: `{"serial": "设备序列号"}`

### 2.5 device.batch_configure
- **路由**: `device.batch_configure`
- **同步**: `sync=True`
- **参数**:
```json
{
  "devices": ["serial1", "serial2"],
  "config": {
    "screenPower": "on",
    "brightness": 200,
    "screenRotation": 0
  }
}
```

### 2.6 adb.device.list ⭐
- **路由**: `adb.device.list`
- **同步**: `sync=True`
- **参数**: `{}`
- **描述**: 获取 ADB 心跳线程自动发现的设备列表
- **响应**:
```json
{
  "devices": [
    {
      "serial": "192.168.1.100:5555",
      "ip": "192.168.1.100",
      "connection_type": "network",
      "state": "device",
      "is_root": true,
      "model": "Pixel 6",
      "android_version": "13",
      "last_seen": 1702000000.0,
      "connected_at": 1701999000.0
    }
  ],
  "count": 1,
  "stats": {
    "total": 1,
    "connected": 1,
    "disconnected": 0
  }
}
```

### 2.7 adb.device.stats ⭐
- **路由**: `adb.device.stats`
- **同步**: `sync=True`
- **参数**: `{}`
- **描述**: 获取 ADB 设备管理器统计信息
- **响应**:
```json
{
  "stats": {
    "total": 1,
    "connected": 1,
    "disconnected": 0
  },
  "heartbeat_running": true,
  "total_ticks": 12345
}
```

---

## 3. 屏幕控制路由 (7)

### 3.1 screen.power
- **路由**: `screen.power`
- **同步**: `sync=False`
- **参数**: `{"serial": "设备序列号", "action": "on|off|toggle"}`

### 3.2 screen.brightness.set
- **路由**: `screen.brightness.set`
- **同步**: `sync=False`
- **参数**: `{"serial": "设备序列号", "level": 200}`  (0-255)

### 3.3 screen.brightness.get
- **路由**: `screen.brightness.get`
- **同步**: `sync=False`
- **参数**: `{"serial": "设备序列号"}`

### 3.4 screen.rotation.set
- **路由**: `screen.rotation.set`
- **同步**: `sync=False`
- **参数**: `{"serial": "设备序列号", "rotation": 0}`  (0, 90, 180, 270)

### 3.5 screen.rotation.get
- **路由**: `screen.rotation.get`
- **同步**: `sync=False`
- **参数**: `{"serial": "设备序列号"}`

### 3.6 screen.rotation.auto_enable
- **路由**: `screen.rotation.auto_enable`
- **同步**: `sync=False`
- **参数**: `{"serial": "设备序列号"}`

### 3.7 screen.rotation.auto_disable
- **路由**: `screen.rotation.auto_disable`
- **同步**: `sync=False`
- **参数**: `{"serial": "设备序列号"}`

---

## 4. 文件管理路由 (3)

### 4.1 file.packages
- **路由**: `file.packages`
- **同步**: `sync=False`
- **参数**: `{"serial": "设备序列号", "filter": "可选过滤模式"}`

### 4.2 file.apk_uninstall
- **路由**: `file.apk_uninstall`
- **同步**: `sync=False`
- **参数**: `{"serial": "设备序列号", "packageName": "com.example.app"}`

### 4.3 file.transfer_status
- **路由**: `file.transfer_status`
- **同步**: `sync=False`
- **参数**: `{"taskId": "任务ID"}`

---

## 5. 录制和截图路由 (4)

### 5.1 recording.start
- **路由**: `recording.start`
- **同步**: `sync=False`
- **参数**:
```json
{
  "serial": "设备序列号",
  "quality": "high",
  "maxDuration": 1800
}
```

### 5.2 recording.stop
- **路由**: `recording.stop`
- **同步**: `sync=False`
- **参数**: `{"serial": "设备序列号"}`

### 5.3 recording.status
- **路由**: `recording.status`
- **同步**: `sync=False`
- **参数**: `{"serial": "设备序列号"}`

### 5.4 screenshot.capture
- **路由**: `screenshot.capture`
- **同步**: `sync=False`
- **参数**: `{"serial": "设备序列号", "format": "png"}`

---

## 6. 群组批量操作路由 (7)

### 6.1 group.batch_screenshot
- **路由**: `group.batch_screenshot`
- **同步**: `sync=False`
- **参数**: `{"groupId": "群组ID", "format": "png"}`

### 6.2 group.batch_start_recording
- **路由**: `group.batch_start_recording`
- **同步**: `sync=False`
- **参数**:
```json
{
  "groupId": "群组ID",
  "quality": "high",
  "maxDuration": 1800
}
```

### 6.3 group.batch_stop_recording
- **路由**: `group.batch_stop_recording`
- **同步**: `sync=False`
- **参数**: `{"groupId": "群组ID"}`

### 6.4 group.batch_system_key
- **路由**: `group.batch_system_key`
- **同步**: `sync=False`
- **参数**: `{"groupId": "群组ID", "action": "home|back|recent|power|volume_up|volume_down"}`

### 6.5 group.batch_screen_control
- **路由**: `group.batch_screen_control`
- **同步**: `sync=False`
- **参数**:
```json
{
  "groupId": "群组ID",
  "controlType": "power|brightness|rotation",
  "params": {}
}
```

### 6.6 group.tree
- **路由**: `group.tree`
- **同步**: `sync=True`
- **参数**: `{}`

### 6.7 group.tree_update
- **路由**: `group.tree_update`
- **同步**: `sync=True`
- **参数**: `{"tree": {...}}`

---

## 7. 配置管理路由 (6)

### 7.1 config.full
- **路由**: `config.full`
- **同步**: `sync=True`
- **参数**: `{}`

### 7.2 config.global
- **路由**: `config.global`
- **同步**: `sync=True`
- **参数**: `{}`

### 7.3 config.global_update
- **路由**: `config.global_update`
- **同步**: `sync=True`
- **参数**: `{配置对象}`

### 7.4 config.device
- **路由**: `config.device`
- **同步**: `sync=False`
- **参数**: `{"deviceName": "设备名称"}`

### 7.5 config.device_update
- **路由**: `config.device_update`
- **同步**: `sync=False`
- **参数**: `{"deviceName": "设备名称", "config": {...}}`

### 7.6 config.device_delete
- **路由**: `config.device_delete`
- **同步**: `sync=False`
- **参数**: `{"deviceName": "设备名称"}`

---

## 8. 设备控制路由 (7)

### 8.1 control.touch
- **路由**: `control.touch`
- **同步**: `sync=False`
- **参数**:
```json
{
  "serial": "设备序列号",
  "action": "down|move|up",
  "pointerId": 0,
  "x": 100,
  "y": 200,
  "pressure": 1.0,
  "screenWidth": 1080,
  "screenHeight": 2400
}
```

### 8.2 control.key
- **路由**: `control.key`
- **同步**: `sync=False`
- **参数**:
```json
{
  "serial": "设备序列号",
  "action": "down|up",
  "keyCode": 4,
  "metaState": 0
}
```

### 8.3 control.text
- **路由**: `control.text`
- **同步**: `sync=False`
- **参数**: `{"serial": "设备序列号", "text": "输入文本"}`

### 8.4 control.swipe
- **路由**: `control.swipe`
- **同步**: `sync=False`
- **参数**:
```json
{
  "serial": "设备序列号",
  "startX": 500,
  "startY": 1000,
  "endX": 500,
  "endY": 500,
  "duration": 300,
  "screenWidth": 1080,
  "screenHeight": 2400
}
```

### 8.5 control.systemkey
- **路由**: `control.systemkey`
- **同步**: `sync=False`
- **参数**: `{"serial": "设备序列号", "action": "home|back|recent|power|volume_up|volume_down"}`

### 8.6 control.clipboard_set
- **路由**: `control.clipboard_set`
- **同步**: `sync=False`
- **参数**: `{"serial": "设备序列号", "text": "剪贴板内容"}`

### 8.7 control.clipboard_get
- **路由**: `control.clipboard_get`
- **同步**: `sync=False`
- **参数**: `{"serial": "设备序列号"}`

---

## 9. 视频流路由 (3)

### 9.1 video.quality
- **路由**: `video.quality`
- **同步**: `sync=False`
- **参数**:
```json
{
  "serial": "设备序列号",
  "max_size": 720,
  "bit_rate": 4000000,
  "max_fps": 60
}
```

### 9.2 video.pause
- **路由**: `video.pause`
- **同步**: `sync=False`
- **参数**: `{"serial": "设备序列号"}`

### 9.3 video.resume
- **路由**: `video.resume`
- **同步**: `sync=False`
- **参数**: `{"serial": "设备序列号"}`

---

## 10. 实时事件推送

### 10.1 adb.devices.update ⭐
- **事件名**: `adb.devices.update`
- **触发频率**: 每 10 秒自动推送
- **监听方法**:
```javascript
client.onEvent('adb.devices.update', (data) => {
  console.log('设备列表更新:', data);
});
```
- **事件数据格式**:
```json
{
  "devices": [
    {
      "serial": "192.168.1.100:5555",
      "ip": "192.168.1.100",
      "connection_type": "network",
      "state": "device",
      "is_root": true,
      "model": "Pixel 6",
      "android_version": "13",
      "last_seen": 1702000000.0,
      "connected_at": 1701999000.0
    }
  ],
  "count": 1,
  "stats": {
    "total": 1,
    "connected": 1,
    "disconnected": 0
  },
  "timestamp": 1702000000000
}
```

---

## 11. 使用示例

### 基础连接

```javascript
// 引入客户端库
<script src="http://localhost:48000/rpc/src/unified_rpc_client.js"></script>

// 创建客户端
const client = new FastAPIRpcClient('http://localhost:48000', {
  debug: true,
  reconnect: true,
  reconnectInterval: 3000,
  maxReconnectAttempts: 10
});

// 连接
await client.connect();
```

### 调用同步端点

```javascript
// 健康检查
const health = await client.call('health', {});
console.log(health);

// 获取设备列表
const devices = await client.call('adb.device.list', {});
console.log(devices);

// 获取统计信息
const stats = await client.call('adb.device.stats', {});
console.log(stats);
```

### 调用异步端点

```javascript
// 获取设备详情
const deviceInfo = await client.call('device.info', {
  serial: '192.168.1.100:5555'
});

// 控制屏幕亮度
const result = await client.call('screen.brightness.set', {
  serial: '192.168.1.100:5555',
  level: 200
});

// 截图
const screenshot = await client.call('screenshot.capture', {
  serial: '192.168.1.100:5555',
  format: 'png'
});
```

### 监听事件

```javascript
// 监听设备推送
client.onEvent('adb.devices.update', (data) => {
  console.log('收到设备更新:', data);
  console.log('设备数量:', data.count);
  console.log('时间戳:', new Date(data.timestamp));
});

// 停止监听
client.offEvent('adb.devices.update');
```

---

## 12. 端点分类索引

### 推荐优先测试的端点 ⭐

| 端点 | 分类 | 说明 |
|------|------|------|
| `health` | 健康检查 | 验证服务器连接 |
| `adb.device.list` | 设备管理 | 获取自动发现的设备 |
| `adb.device.stats` | 设备管理 | 获取心跳统计 |
| `device.list` | 设备管理 | 列出所有设备 |
| `device.info` | 设备管理 | 获取设备详情 |
| `adb.devices.update` (事件) | 实时推送 | 10秒设备更新 |

### 常用设备操作端点

| 端点 | 说明 |
|------|------|
| `device.connect` | 连接设备 |
| `device.disconnect` | 断开设备 |
| `device.batch_configure` | 批量配置设备 |
| `screenshot.capture` | 截图 |
| `recording.start` | 开始录屏 |
| `recording.stop` | 停止录屏 |

### 完整端点清单

共 **47 个 RPC v2 端点** + **1 个实时推送事件**

---

## 13. 附录

### 错误处理

所有端点遵循统一的错误格式：

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述"
  }
}
```

### 时间戳格式

- **API 返回**: Unix 时间戳，单位为**秒** (例如: `1702000000.0`)
- **事件推送**: Unix 时间戳，单位为**毫秒** (例如: `1702000000000`)

### 设备状态枚举

- `"device"`: 设备在线
- `"offline"`: 设备离线
- `"unauthorized"`: 设备未授权

### 连接类型枚举

- `"network"`: 网络连接 (TCP/IP)
- `"usb"`: USB 连接

---

**文档版本**: 1.1
**最后更新**: 2025-12-08
**源文件**: `pyapps/matrix/api/main.py`
