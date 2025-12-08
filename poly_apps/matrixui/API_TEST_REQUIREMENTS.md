# Matrix RPC v2 API 测试需求

## 1. 服务器信息

- **后端地址**: `http://localhost:48000`
- **WebSocket 地址**: `ws://localhost:48000/rpc/ws`
- **协议**: RPC v2 (基于 WebSocket 的请求/响应协议)

## 2. RPC 客户端使用

### 2.1 客户端库路径
```
pycore/pyutils/rpc_v2/client/unified_rpc_client.js
```

### 2.2 基本使用方法

```javascript
// 1. 引入客户端库
// 在浏览器中：
<script src="../../pycore/pyutils/rpc_v2/client/unified_rpc_client.js"></script>

// 2. 创建客户端实例
const client = new FastAPIRpcClient('http://localhost:48000', {
  debug: true,                    // 开启调试日志
  reconnect: true,                // 自动重连
  reconnectInterval: 3000,        // 重连间隔 3秒
  maxReconnectAttempts: 10       // 最大重连次数
});

// 3. 连接到 WebSocket
await client.connect();

// 4. 调用 API (返回 Promise)
const result = await client.call('路由名称', 参数对象);

// 5. 监听服务器推送事件
client.onEvent('事件名称', (data) => {
  console.log('收到事件:', data);
});

// 6. 停止监听事件
client.offEvent('事件名称');
```

## 3. API 端点列表

### 3.1 ADB 设备管理器

#### 3.1.1 获取设备列表
- **路由**: `adb.device.list`
- **方法**: `client.call('adb.device.list', {})`
- **参数**: `{}` (空对象)
- **返回数据格式**:
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

**字段说明**:
- `devices`: 设备列表数组
  - `serial`: 设备序列号
  - `ip`: 设备 IP 地址
  - `connection_type`: 连接类型 (`"network"` 或 `"usb"`)
  - `state`: 设备状态 (`"device"` 表示在线, `"offline"` 表示离线)
  - `is_root`: 是否 Root (布尔值)
  - `model`: 设备型号
  - `android_version`: Android 版本
  - `last_seen`: 最后看到时间 (Unix 时间戳，秒)
  - `connected_at`: 连接时间 (Unix 时间戳，秒)
- `count`: 设备总数
- `stats`: 统计信息
  - `total`: 总设备数
  - `connected`: 在线设备数
  - `disconnected`: 离线设备数

#### 3.1.2 获取管理器统计
- **路由**: `adb.device.stats`
- **方法**: `client.call('adb.device.stats', {})`
- **参数**: `{}` (空对象)
- **返回数据格式**:
```json
{
  "total_devices": 1,
  "connected_devices": 1,
  "disconnected_devices": 0,
  "last_scan": 1702000000.0,
  "heartbeat_status": "running",
  "uptime": 3600.5
}
```

**字段说明**:
- `total_devices`: 总设备数
- `connected_devices`: 在线设备数
- `disconnected_devices`: 离线设备数
- `last_scan`: 最后扫描时间 (Unix 时间戳，秒)
- `heartbeat_status`: 心跳状态 (`"running"` 或 `"stopped"`)
- `uptime`: 运行时长 (秒)

### 3.2 设备管理

#### 3.2.1 列出所有设备
- **路由**: `device.list`
- **方法**: `client.call('device.list', {})`
- **参数**: `{}` (空对象)
- **返回数据格式**: (根据实际实现)
```json
{
  "devices": [
    {
      "serial": "设备序列号",
      "status": "online"
    }
  ]
}
```

#### 3.2.2 获取设备信息
- **路由**: `device.info`
- **方法**: `client.call('device.info', { serial: '设备序列号' })`
- **参数**:
```json
{
  "serial": "192.168.1.100:5555"
}
```
- **返回数据格式**: (根据实际实现)
```json
{
  "serial": "192.168.1.100:5555",
  "info": { ... }
}
```

### 3.3 实时事件推送

#### 3.3.1 设备列表更新事件
- **事件名**: `adb.devices.update`
- **触发频率**: 每 10 秒自动推送一次
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

**字段说明**:
- `devices`: 设备列表 (格式同 `adb.device.list`)
- `count`: 设备总数
- `stats`: 统计信息
- `timestamp`: 推送时间戳 (Unix 时间戳，**毫秒**)

## 4. 测试要求

### 4.1 基础连接测试
1. 创建客户端实例
2. 调用 `client.connect()` 建立 WebSocket 连接
3. 验证连接成功 (返回的 Promise resolve)
4. 显示客户端 ID (`client.options.clientId`)

### 4.2 API 调用测试

#### 测试 `adb.device.list`
```javascript
const result = await client.call('adb.device.list', {});
console.log('设备列表:', result);
```
**验证点**:
- 返回数据包含 `devices` 数组
- 返回数据包含 `count` 和 `stats`
- 每个设备包含 `serial`, `state`, `model` 等字段

#### 测试 `adb.device.stats`
```javascript
const result = await client.call('adb.device.stats', {});
console.log('统计信息:', result);
```
**验证点**:
- 返回数据包含 `total_devices`, `connected_devices`
- 返回数据包含 `heartbeat_status` (应为 `"running"`)
- 返回数据包含 `uptime`

#### 测试 `device.list`
```javascript
const result = await client.call('device.list', {});
console.log('所有设备:', result);
```

#### 测试 `device.info`
```javascript
const result = await client.call('device.info', {
  serial: '192.168.1.100:5555'
});
console.log('设备详情:', result);
```

### 4.3 事件监听测试

#### 监听设备推送
```javascript
// 开始监听
client.onEvent('adb.devices.update', (data) => {
  console.log('收到设备更新事件:', data);
  console.log('设备数量:', data.count);
  console.log('时间戳:', new Date(data.timestamp));
});

// 等待至少 10 秒，应该收到至少 1 次推送

// 停止监听
client.offEvent('adb.devices.update');
```

**验证点**:
- 每 10 秒收到一次推送事件
- 事件数据格式正确
- `timestamp` 字段为毫秒级时间戳
- 设备列表随实际设备连接变化而更新

### 4.4 错误处理测试

#### 测试未连接时调用
```javascript
// 不调用 connect()
try {
  const result = await client.call('adb.device.list', {});
} catch (error) {
  console.error('预期错误:', error.message); // 应显示未连接错误
}
```

#### 测试无效路由
```javascript
try {
  const result = await client.call('invalid.route', {});
} catch (error) {
  console.error('预期错误:', error.message); // 应显示路由不存在错误
}
```

### 4.5 断开重连测试
```javascript
// 1. 建立连接
await client.connect();

// 2. 调用 API
const result1 = await client.call('adb.device.list', {});

// 3. 断开连接
client.ws.close();

// 4. 等待自动重连 (reconnect: true)
await new Promise(resolve => setTimeout(resolve, 3500));

// 5. 再次调用 API
const result2 = await client.call('adb.device.list', {});
```

## 5. 完整测试示例

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Matrix API Test</title>
</head>
<body>
  <h1>Matrix RPC v2 API 测试</h1>

  <div id="status">状态: 未连接</div>
  <div id="clientId">客户端ID: -</div>

  <button onclick="testConnect()">1. 连接</button>
  <button onclick="testDeviceList()">2. 获取设备列表</button>
  <button onclick="testDeviceStats()">3. 获取统计信息</button>
  <button onclick="testListen()">4. 开始监听推送</button>
  <button onclick="testStopListen()">5. 停止监听</button>

  <h2>日志</h2>
  <pre id="log"></pre>

  <h2>最后响应</h2>
  <pre id="response"></pre>

  <script src="../../pycore/pyutils/rpc_v2/client/unified_rpc_client.js"></script>
  <script>
    let client = null;

    function log(message) {
      const logEl = document.getElementById('log');
      const time = new Date().toLocaleTimeString();
      logEl.textContent += `[${time}] ${message}\n`;
      console.log(message);
    }

    function showResponse(data) {
      document.getElementById('response').textContent = JSON.stringify(data, null, 2);
    }

    async function testConnect() {
      try {
        log('正在连接到 ws://localhost:48000/rpc/ws ...');

        client = new FastAPIRpcClient('http://localhost:48000', {
          debug: true,
          reconnect: true,
          reconnectInterval: 3000,
          maxReconnectAttempts: 10
        });

        await client.connect();

        document.getElementById('status').textContent = '状态: 已连接';
        document.getElementById('clientId').textContent = '客户端ID: ' + client.options.clientId;

        log('✓ 连接成功');
      } catch (error) {
        log('✗ 连接失败: ' + error.message);
      }
    }

    async function testDeviceList() {
      try {
        log('调用 adb.device.list ...');
        const result = await client.call('adb.device.list', {});
        log(`✓ 成功获取设备列表: ${result.count} 个设备`);
        showResponse(result);
      } catch (error) {
        log('✗ 失败: ' + error.message);
      }
    }

    async function testDeviceStats() {
      try {
        log('调用 adb.device.stats ...');
        const result = await client.call('adb.device.stats', {});
        log(`✓ 成功获取统计: ${result.total_devices} 个设备, 状态=${result.heartbeat_status}`);
        showResponse(result);
      } catch (error) {
        log('✗ 失败: ' + error.message);
      }
    }

    function testListen() {
      if (!client) {
        log('✗ 请先连接');
        return;
      }

      log('开始监听 adb.devices.update 事件...');

      client.onEvent('adb.devices.update', (data) => {
        const time = new Date(data.timestamp).toLocaleTimeString();
        log(`✓ 收到设备推送事件: ${data.count} 个设备, 时间=${time}`);
        showResponse(data);
      });

      log('监听已启动，等待服务器推送 (每10秒)');
    }

    function testStopListen() {
      if (!client) {
        log('✗ 请先连接');
        return;
      }

      client.offEvent('adb.devices.update');
      log('已停止监听 adb.devices.update');
    }
  </script>
</body>
</html>
```

## 6. 数据格式说明

### 6.1 时间戳格式
- **API 返回**: Unix 时间戳，单位为**秒** (例如: `1702000000.0`)
- **事件推送**: Unix 时间戳，单位为**毫秒** (例如: `1702000000000`)

JavaScript 转换示例:
```javascript
// API 返回的秒级时间戳
const lastSeen = 1702000000.0;
const date1 = new Date(lastSeen * 1000); // 需要乘以 1000

// 事件推送的毫秒级时间戳
const timestamp = 1702000000000;
const date2 = new Date(timestamp); // 直接使用
```

### 6.2 设备状态枚举
- `"device"`: 设备在线
- `"offline"`: 设备离线
- `"unauthorized"`: 设备未授权
- `"no device"`: 设备不存在

### 6.3 连接类型枚举
- `"network"`: 网络连接 (TCP/IP)
- `"usb"`: USB 连接

## 7. 测试验收标准

测试页面应满足以下要求:

✅ **连接测试**
- 能够成功连接到 `ws://localhost:48000/rpc/ws`
- 显示连接状态和客户端 ID

✅ **API 调用测试**
- 能够调用 `adb.device.list` 并显示设备列表
- 能够调用 `adb.device.stats` 并显示统计信息
- 能够调用 `device.list` 和 `device.info`
- 正确处理和显示返回的 JSON 数据

✅ **事件监听测试**
- 能够监听 `adb.devices.update` 事件
- 每 10 秒自动接收到设备更新推送
- 能够停止监听
- 正确显示事件数据

✅ **错误处理**
- 未连接时调用 API 显示错误提示
- 无效路由显示错误提示
- 网络错误显示友好提示

✅ **日志记录**
- 记录所有 API 调用和响应
- 记录所有事件接收
- 显示时间戳

✅ **数据展示**
- 清晰显示最后一次 API 响应的完整数据
- JSON 格式化显示
- 设备信息易于阅读

## 8. 参考资源

- **RPC 客户端源码**: `pycore/pyutils/rpc_v2/client/unified_rpc_client.js`
- **后端 API 实现**: `pyapps/matrix/api/main.py`
- **设备推送服务**: `pyapps/matrix/adb_device_manager/device_push_service.py`
- **简单 HTML 测试页面**: `pyapps/matrix/test_api.html` (参考)
