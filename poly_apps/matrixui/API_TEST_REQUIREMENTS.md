# Matrix RPC v2 API 测试需求文档

## 1. 测试目标

创建一个独立的API测试页面，用于测试 Matrix 应用的 RPC v2 WebSocket API。该测试页面应能够：
- 连接到 RPC v2 WebSocket 服务器
- 测试所有已实现的 API 端点
- 监听实时设备推送事件
- 显示 API 响应结果
- 提供清晰的连接状态和错误信息

## 2. 技术要求

### 2.1 WebSocket 客户端
- **使用库**: `pycore/pyutils/rpc_v2/client/unified_rpc_client.js`
- **连接地址**: `ws://localhost:48000/rpc/ws`
- **协议**: RPC v2 (请求/响应 + ACK 机制)

### 2.2 框架选择
- 使用 **React + TypeScript + Vite** (与 matrixui 项目一致)
- 使用 Tailwind CSS 进行样式设计
- 可选：使用现有的 UI 组件库 (Ant Design, Shadcn/ui 等)

### 2.3 文件位置
- 主测试页面组件: `poly_apps/matrixui/components/ApiTestPage.tsx`
- 路由配置: 在 `poly_apps/matrixui/App.tsx` 中添加 `/api-test` 路由

## 3. 需要测试的 API 端点

### 3.1 ADB 设备管理器 API (新增)

#### 3.1.1 获取自动发现的设备列表
- **路由**: `adb.device.list`
- **描述**: 获取 ADB 心跳线程自动发现的设备列表
- **请求参数**: `{}` (空对象)
- **响应格式**:
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

#### 3.1.2 获取设备管理器统计信息
- **路由**: `adb.device.stats`
- **描述**: 获取 ADB 设备管理器的统计信息和心跳状态
- **请求参数**: `{}` (空对象)
- **响应格式**:
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

### 3.2 设备管理 API (现有)

#### 3.2.1 列出所有设备
- **路由**: `device.list`
- **描述**: 列出所有管理的 ADB 设备
- **请求参数**: `{}` (空对象)

#### 3.2.2 获取设备详细信息
- **路由**: `device.info`
- **描述**: 获取指定设备的详细信息
- **请求参数**:
```json
{
  "serial": "设备序列号"
}
```

### 3.3 实时事件监听 (核心功能)

#### 3.3.1 设备列表推送事件
- **事件名**: `adb.devices.update`
- **描述**: 服务器每 10 秒自动推送设备列表更新
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

## 4. UI 功能需求

### 4.1 WebSocket 连接管理区域
显示内容：
- WebSocket 连接状态指示器 (已连接/未连接/连接中)
- WebSocket URL 显示 (`ws://localhost:48000/rpc/ws`)
- 客户端 ID 显示
- 连接/断开连接按钮

### 4.2 API 测试区域
分组显示 API 端点：

#### 组 1: ADB 设备管理器
- 按钮: "获取设备列表" (`adb.device.list`)
- 按钮: "获取管理器统计" (`adb.device.stats`)

#### 组 2: 设备管理
- 按钮: "列出所有设备" (`device.list`)
- 按钮: "获取设备信息" (`device.info`)

#### 组 3: 实时事件监听
- 按钮: "开始监听设备推送" (监听 `adb.devices.update`)
- 按钮: "停止监听"
- 显示: 最后接收到的事件时间戳

#### 组 4: 批量测试
- 按钮: "测试所有 API" (依次调用所有端点)

### 4.3 响应显示区域

#### 4.3.1 日志面板
显示所有 API 调用和事件的日志：
- 时间戳
- 操作类型 (请求/响应/事件/错误)
- 路由名称
- 简短的状态描述
- 颜色编码:
  - 请求: 蓝色
  - 成功响应: 绿色
  - 错误: 红色
  - 事件: 紫色/黄色

#### 4.3.2 详细响应面板
显示最后一次 API 响应的详细信息：
- JSON 格式化显示
- 语法高亮
- 可折叠/展开

#### 4.3.3 设备卡片显示 (针对设备相关 API)
当调用设备相关 API 时，以卡片形式显示设备：
- 设备序列号/IP
- 设备型号
- Android 版本
- 连接状态 (在线/离线)
- Root 状态
- 最后看到时间

显示要求：
- 使用网格布局 (Grid)
- 在线设备：绿色边框
- 离线设备：灰色边框，降低透明度
- Root 设备：显示 Root 徽章

### 4.4 统计信息区域
显示实时统计：
- 总设备数
- 在线设备数
- 离线设备数
- 最后更新时间
- API 调用次数
- 接收到的事件数

## 5. 测试用例

### 5.1 WebSocket 连接测试
1. 点击"连接"按钮
2. 验证连接状态指示器变为"已连接"
3. 验证客户端 ID 已生成并显示

### 5.2 API 端点测试
依次测试每个 API 端点：

#### 测试 `adb.device.list`
1. 点击"获取设备列表"按钮
2. 验证日志显示请求已发送
3. 验证响应成功返回
4. 验证设备卡片正确显示设备信息
5. 验证统计信息更新

#### 测试 `adb.device.stats`
1. 点击"获取管理器统计"按钮
2. 验证日志显示请求已发送
3. 验证响应成功返回
4. 验证统计信息显示正确

#### 测试 `device.list`
1. 点击"列出所有设备"按钮
2. 验证响应返回设备列表

### 5.3 实时推送测试
1. 点击"开始监听设备推送"按钮
2. 等待 10 秒
3. 验证收到 `adb.devices.update` 事件
4. 验证设备卡片自动更新
5. 验证统计信息自动更新
6. 验证最后接收时间显示正确
7. 点击"停止监听"按钮
8. 验证不再接收事件

### 5.4 批量测试
1. 点击"测试所有 API"按钮
2. 验证所有 API 依次被调用
3. 验证每个 API 都有响应
4. 验证日志显示所有调用记录

### 5.5 错误处理测试
1. 未连接时点击 API 按钮
2. 验证显示"未连接"错误
3. 连接后，测试无效参数
4. 验证显示错误响应

### 5.6 断开重连测试
1. 建立连接后点击"断开连接"
2. 验证连接状态变为"未连接"
3. 点击"连接"按钮重新连接
4. 验证可以继续使用 API

## 6. 代码集成要求

### 6.1 使用 unified_rpc_client.js
```typescript
import { FastAPIRpcClient } from '../../pycore/pyutils/rpc_v2/client/unified_rpc_client';

// 创建客户端实例
const client = new FastAPIRpcClient('http://localhost:48000', {
  debug: true,
  reconnect: true,
  reconnectInterval: 3000,
  maxReconnectAttempts: 10
});

// 连接
await client.connect();

// 调用 API
const result = await client.call('adb.device.list', {});

// 监听事件
client.onEvent('adb.devices.update', (data) => {
  console.log('Device update:', data);
});
```

### 6.2 TypeScript 类型定义
```typescript
// API 响应类型
interface AdbDevice {
  serial: string;
  ip: string;
  connection_type: string;
  state: string;
  is_root: boolean;
  model: string;
  android_version: string;
  last_seen: number;
  connected_at: number;
}

interface AdbDeviceListResponse {
  devices: AdbDevice[];
  count: number;
  stats: {
    total: number;
    connected: number;
    disconnected: number;
  };
}

interface AdbDeviceStatsResponse {
  total_devices: number;
  connected_devices: number;
  disconnected_devices: number;
  last_scan: number;
  heartbeat_status: string;
  uptime: number;
}

interface DevicePushEvent {
  devices: AdbDevice[];
  count: number;
  stats: {
    total: number;
    connected: number;
    disconnected: number;
  };
  timestamp: number;
}
```

### 6.3 状态管理
使用 React Hooks 管理状态：
```typescript
const [connected, setConnected] = useState(false);
const [devices, setDevices] = useState<AdbDevice[]>([]);
const [logs, setLogs] = useState<LogEntry[]>([]);
const [lastResponse, setLastResponse] = useState<any>(null);
const [listening, setListening] = useState(false);
const [stats, setStats] = useState({
  totalApiCalls: 0,
  totalEvents: 0,
  lastEventTime: null
});
```

## 7. UI 设计要求

### 7.1 布局
- 使用现代化的卡片式布局
- 响应式设计 (支持桌面和移动设备)
- 深色主题优先

### 7.2 颜色方案
- 主色调: 蓝色 (#1677ff)
- 成功: 绿色 (#52c41a)
- 错误: 红色 (#ff4d4f)
- 警告: 橙色 (#faad14)
- 信息: 蓝色 (#1890ff)
- 背景: 深色 (#141414)

### 7.3 交互反馈
- 按钮点击有加载状态
- API 调用时显示加载指示器
- 事件接收时显示动画效果
- 错误时显示 Toast 通知

### 7.4 性能要求
- 日志最多保留 100 条 (自动清理旧日志)
- 设备卡片使用虚拟滚动 (如果设备数量超过 50)
- JSON 显示支持折叠大对象

## 8. 开发步骤建议

### 步骤 1: 创建基础组件结构
- 创建 `ApiTestPage.tsx` 主组件
- 创建 `ConnectionPanel` 连接管理组件
- 创建 `ApiButtons` API 测试按钮组件
- 创建 `LogPanel` 日志显示组件
- 创建 `ResponsePanel` 响应显示组件
- 创建 `DeviceCard` 设备卡片组件

### 步骤 2: 集成 RPC 客户端
- 导入 `unified_rpc_client.js`
- 实现连接管理逻辑
- 实现 API 调用逻辑
- 实现事件监听逻辑

### 步骤 3: 实现 UI 交互
- 实现连接/断开按钮
- 实现 API 测试按钮
- 实现事件监听开关
- 实现日志记录

### 步骤 4: 实现响应显示
- 实现 JSON 格式化显示
- 实现设备卡片渲染
- 实现统计信息更新

### 步骤 5: 测试和优化
- 测试所有 API 端点
- 测试事件监听
- 测试错误处理
- 优化性能

## 9. 参考文件

- RPC v2 客户端: `pycore/pyutils/rpc_v2/client/unified_rpc_client.js`
- 后端 API 实现: `pyapps/matrix/api/main.py`
- 设备推送服务: `pyapps/matrix/adb_device_manager/device_push_service.py`
- 现有 WebSocket 服务: `poly_apps/matrixui/services/websocket.ts`

## 10. 预期交付物

1. **主要组件**: `poly_apps/matrixui/components/ApiTestPage.tsx`
2. **子组件**:
   - `ConnectionPanel.tsx`
   - `ApiTestButtons.tsx`
   - `LogPanel.tsx`
   - `ResponsePanel.tsx`
   - `DeviceCard.tsx`
3. **类型定义**: `poly_apps/matrixui/types/apiTest.ts`
4. **工具函数**: `poly_apps/matrixui/utils/apiTestUtils.ts`
5. **路由集成**: 更新 `App.tsx` 添加 `/api-test` 路由

## 11. 额外需求

### 11.1 导出功能
- 支持导出日志为 JSON 文件
- 支持导出设备列表为 CSV 文件

### 11.2 过滤功能
- 日志按类型过滤 (请求/响应/事件/错误)
- 设备按状态过滤 (在线/离线)
- 设备按连接类型过滤 (USB/网络)

### 11.3 搜索功能
- 在日志中搜索关键字
- 在设备列表中搜索序列号/IP

### 11.4 清空功能
- 清空日志按钮
- 清空响应面板按钮

## 12. 注意事项

1. **确保使用 `unified_rpc_client.js` 而不是现有的 Mock WebSocket 服务**
2. **所有 API 调用需要等待 WebSocket 连接建立**
3. **事件监听需要使用 `client.onEvent()` 方法**
4. **响应数据格式可能与文档略有不同，需要动态适配**
5. **错误处理要完整，包括网络错误、超时、API 错误等**
6. **UI 要清晰明了，方便开发者快速测试 API**
7. **代码要有良好的注释和类型定义**
8. **组件要可复用，便于后续扩展**

## 13. 成功标准

测试页面开发完成后应满足：
- ✅ 能够成功连接到 RPC v2 WebSocket 服务器
- ✅ 能够调用所有文档中列出的 API 端点
- ✅ 能够接收实时设备推送事件
- ✅ UI 清晰、响应迅速、无明显卡顿
- ✅ 错误处理完善，用户体验良好
- ✅ 代码结构清晰，类型定义完整
- ✅ 符合 React + TypeScript 最佳实践
- ✅ 样式美观，与 Matrix 应用整体风格一致
