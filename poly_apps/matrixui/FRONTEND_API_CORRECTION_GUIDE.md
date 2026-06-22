# 前端 API 数据格式修正指南

**日期**: 2025-12-08
**目标**: 修正前端代码以匹配后端实际数据格式
**前置条件**: 后端已修复 (参见 `BACKEND_DATA_INCONSISTENCY_REPORT.md`)

---

## 1. 数据格式变更摘要

### 1.1 字段名称变更

| API 响应字段 | 旧名称 | 新名称 | 类型 | 说明 |
|------------|--------|--------|------|------|
| 设备连接类型 | `connection_type` | `connection_type` | string | **无变更** |
| 设备 IP 地址 | `ip` | `ip` | string | **无变更** |
| 连接时间 | `connected_at` | `connected_at` | number | **无变更** |

### 1.2 枚举值变更

#### connection_type 枚举 (无变更)
```typescript
type ConnectionType = "usb" | "wifi" | "root";
```

#### state 枚举 (⚠️ 重要变更)
```typescript
// 旧值 (错误)
type DeviceState = "device" | "offline" | "unauthorized" | "no device";

// 新值 (正确)
type DeviceState =
  | "unknown"         // 未知状态
  | "usb_connected"   // USB 已连接
  | "wifi_connected"  // WiFi 已连接
  | "configuring"     // 配置中
  | "disconnected"    // 已断开
  | "error";          // 错误状态
```

---

## 2. TypeScript 类型定义

### 2.1 创建或更新类型文件

**文件**: `poly_apps/matrixui/types/device.ts`

```typescript
/**
 * Matrix RPC v2 Device Types
 *
 * 基于后端实际数据模型:
 * - pyapps/matrix/adb_device_manager/device_table.py
 * - pyapps/matrix/api/main.py
 */

// ============================================================
// Device Connection Type
// ============================================================

/**
 * 设备连接类型
 */
export type DeviceConnectionType =
  | "usb"   // USB 连接
  | "wifi"  // WiFi 连接
  | "root"; // Root 设备 (网络扫描发现)

// ============================================================
// Device State
// ============================================================

/**
 * 设备状态
 */
export type DeviceState =
  | "unknown"         // 未知状态
  | "usb_connected"   // USB 已连接
  | "wifi_connected"  // WiFi 已连接
  | "configuring"     // 配置中 (tcpip 5555)
  | "disconnected"    // 已断开
  | "error";          // 错误状态

// ============================================================
// Device Info
// ============================================================

/**
 * 设备信息
 */
export interface DeviceInfo {
  /** 设备序列号或 IP:PORT */
  serial: string;

  /** IP 地址 (可能为 null) */
  ip: string | null;

  /** 连接类型 */
  connection_type: DeviceConnectionType;

  /** 设备状态 */
  state: DeviceState;

  /** 是否 Root */
  is_root: boolean;

  /** 设备型号 (可能为 null) */
  model: string | null;

  /** Android 版本 (可能为 null) */
  android_version: string | null;

  /** 最后看到时间 (Unix 时间戳, 秒) */
  last_seen: number;

  /** 连接时间 (Unix 时间戳, 秒) */
  connected_at: number;
}

// ============================================================
// Device Statistics
// ============================================================

/**
 * 设备统计信息
 */
export interface DeviceStats {
  /** 总设备数 */
  total_devices: number;

  /** USB 设备数 */
  usb_devices: number;

  /** WiFi 设备数 */
  wifi_devices: number;

  /** Root 设备数 */
  root_devices: number;

  /** 累计添加数 */
  total_added: number;

  /** 累计移除数 */
  total_removed: number;

  /** 状态变更次数 */
  total_state_changes: number;

  /** 按状态分组的设备数 */
  devices_by_state: {
    unknown: number;
    usb_connected: number;
    wifi_connected: number;
    configuring: number;
    disconnected: number;
    error: number;
  };
}

// ============================================================
// API Responses
// ============================================================

/**
 * adb.device.list 响应
 */
export interface AdbDeviceListResponse {
  /** 设备列表 */
  devices: DeviceInfo[];

  /** 设备数量 */
  count: number;

  /** 统计信息 */
  stats: DeviceStats;
}

/**
 * adb.device.stats 响应
 */
export interface AdbDeviceStatsResponse {
  /** 统计信息 */
  stats: DeviceStats;

  /** 心跳是否运行 */
  heartbeat_running: boolean;

  /** 总心跳次数 */
  total_ticks: number;
}

/**
 * adb.devices.update 事件数据
 */
export interface AdbDevicesUpdateEvent {
  /** 设备列表 */
  devices: DeviceInfo[];

  /** 设备数量 */
  count: number;

  /** 统计信息 */
  stats: DeviceStats;

  /** 推送时间戳 (Unix 时间戳, 毫秒) */
  timestamp: number;
}
```

---

## 3. 前端代码修改

### 3.1 设备状态显示

#### 文件: `poly_apps/matrixui/components/DeviceDashboard.tsx`

**需要修改的状态判断逻辑**:

```typescript
// ❌ 旧代码 (错误)
const isOnline = device.state === 'device';
const isOffline = device.state === 'offline';

// ✅ 新代码 (正确)
const isOnline = device.state === 'usb_connected' || device.state === 'wifi_connected';
const isOffline = device.state === 'disconnected';
const isConfiguring = device.state === 'configuring';
const hasError = device.state === 'error';
```

**状态显示函数**:

```typescript
function getDeviceStateLabel(state: DeviceState): string {
  switch (state) {
    case 'unknown':
      return '未知';
    case 'usb_connected':
      return 'USB 已连接';
    case 'wifi_connected':
      return 'WiFi 已连接';
    case 'configuring':
      return '配置中';
    case 'disconnected':
      return '已断开';
    case 'error':
      return '错误';
    default:
      return '未知';
  }
}

function getDeviceStateColor(state: DeviceState): string {
  switch (state) {
    case 'usb_connected':
    case 'wifi_connected':
      return 'text-green-400';
    case 'configuring':
      return 'text-yellow-400';
    case 'disconnected':
      return 'text-gray-400';
    case 'error':
      return 'text-red-400';
    default:
      return 'text-slate-400';
  }
}
```

### 3.2 设备卡片显示

#### 文件: `poly_apps/matrixui/components/UnitGrid.tsx` (或相关组件)

**设备卡片状态指示器**:

```tsx
interface DeviceCardProps {
  device: DeviceInfo;
}

function DeviceCard({ device }: DeviceCardProps) {
  const isOnline = device.state === 'usb_connected' || device.state === 'wifi_connected';
  const isConfiguring = device.state === 'configuring';
  const hasError = device.state === 'error';

  return (
    <div className={`device-card ${isOnline ? 'online' : 'offline'}`}>
      {/* 状态指示器 */}
      <div className={`status-indicator ${getDeviceStateColor(device.state)}`}>
        {getDeviceStateLabel(device.state)}
      </div>

      {/* 设备信息 */}
      <div className="device-info">
        <div className="serial">{device.serial}</div>
        <div className="model">{device.model || '未知型号'}</div>
        <div className="android">Android {device.android_version || '未知'}</div>
      </div>

      {/* 连接类型徽章 */}
      <div className="badges">
        <span className={`badge connection-type ${device.connection_type}`}>
          {device.connection_type.toUpperCase()}
        </span>
        {device.is_root && (
          <span className="badge root">ROOT</span>
        )}
        {isConfiguring && (
          <span className="badge configuring">配置中...</span>
        )}
        {hasError && (
          <span className="badge error">错误</span>
        )}
      </div>

      {/* 时间戳 */}
      <div className="timestamps">
        <div>最后活跃: {formatTimestamp(device.last_seen)}</div>
        <div>连接于: {formatTimestamp(device.connected_at)}</div>
      </div>
    </div>
  );
}

// 时间戳格式化辅助函数
function formatTimestamp(timestamp: number): string {
  // timestamp 是秒级 Unix 时间戳
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('zh-CN');
}
```

### 3.3 TestPage 数据处理

#### 文件: `poly_apps/matrixui/components/TestPage.tsx`

**无需修改**，因为 TestPage 只是显示原始 JSON 响应。但如果要添加设备卡片显示，可以使用以上组件。

### 3.4 API 调用示例

```typescript
import { wsService } from '../services/websocket';
import type { AdbDeviceListResponse, AdbDevicesUpdateEvent } from '../types/device';

// 获取设备列表
async function fetchDeviceList() {
  try {
    const response = await wsService.callRpc<AdbDeviceListResponse>(
      'adb.device.list',
      {}
    );

    console.log('设备列表:', response.devices);
    console.log('设备数量:', response.count);
    console.log('统计信息:', response.stats);

    return response;
  } catch (error) {
    console.error('获取设备列表失败:', error);
    throw error;
  }
}

// 监听设备更新事件
function listenDeviceUpdates() {
  wsService.onRpcEvent('adb.devices.update', (data: AdbDevicesUpdateEvent) => {
    console.log('设备更新事件:', data);
    console.log('设备数量:', data.count);
    console.log('推送时间:', new Date(data.timestamp)); // timestamp 是毫秒

    // 更新 UI
    updateDeviceDisplay(data.devices);
  });
}
```

---

## 4. 样式更新

### 4.1 设备状态颜色

**文件**: `poly_apps/matrixui/index.css` (或 Tailwind 配置)

```css
/* 设备状态颜色 */
.device-state-usb_connected,
.device-state-wifi_connected {
  color: #10b981; /* green-500 */
  background: rgba(16, 185, 129, 0.1);
}

.device-state-configuring {
  color: #f59e0b; /* amber-500 */
  background: rgba(245, 158, 11, 0.1);
}

.device-state-disconnected {
  color: #6b7280; /* gray-500 */
  background: rgba(107, 114, 128, 0.1);
}

.device-state-error {
  color: #ef4444; /* red-500 */
  background: rgba(239, 68, 68, 0.1);
}

.device-state-unknown {
  color: #94a3b8; /* slate-400 */
  background: rgba(148, 163, 184, 0.1);
}
```

---

## 5. 修改清单

### 5.1 必须修改的文件

- [ ] `poly_apps/matrixui/types/device.ts` - 创建/更新类型定义
- [ ] `poly_apps/matrixui/components/DeviceDashboard.tsx` - 更新状态判断逻辑
- [ ] `poly_apps/matrixui/components/UnitGrid.tsx` - 更新设备卡片显示
- [ ] `poly_apps/matrixui/index.css` - 添加新状态样式

### 5.2 可选修改的文件

- [ ] `poly_apps/matrixui/components/TestPage.tsx` - 添加设备卡片显示
- [ ] `poly_apps/matrixui/services/websocket.ts` - 添加类型注解

---

## 6. 测试验证

### 6.1 单元测试

```typescript
describe('Device State Utilities', () => {
  it('should correctly identify online states', () => {
    expect(isOnline('usb_connected')).toBe(true);
    expect(isOnline('wifi_connected')).toBe(true);
    expect(isOnline('disconnected')).toBe(false);
  });

  it('should format device state labels', () => {
    expect(getDeviceStateLabel('usb_connected')).toBe('USB 已连接');
    expect(getDeviceStateLabel('wifi_connected')).toBe('WiFi 已连接');
    expect(getDeviceStateLabel('error')).toBe('错误');
  });

  it('should assign correct state colors', () => {
    expect(getDeviceStateColor('usb_connected')).toContain('green');
    expect(getDeviceStateColor('error')).toContain('red');
  });
});
```

### 6.2 集成测试

1. **测试 API 调用**
   ```bash
   # 启动后端服务
   python pymain.py app=matrix

   # 访问测试页面
   http://localhost:38007/api-test

   # 点击 "1. adb.device.list"
   # 验证: 响应中包含正确的字段名称
   # 验证: state 值为 usb_connected 或 wifi_connected
   ```

2. **测试事件监听**
   ```bash
   # 在测试页面点击 "开始监听"
   # 等待 10 秒
   # 验证: 收到 adb.devices.update 事件
   # 验证: 事件数据包含正确的设备状态
   ```

3. **测试设备显示**
   ```bash
   # 访问主页面
   http://localhost:38007

   # 验证: 设备卡片显示正确状态
   # 验证: 在线/离线颜色正确
   # 验证: Root 徽章显示正确
   ```

---

## 7. 常见问题

### Q1: 为什么 state 不再是 "device" 或 "offline"?
**A**: 后端使用的是更详细的状态枚举，区分 USB 和 WiFi 连接。旧的 "device"/"offline" 是 ADB 命令的原始输出，新的枚举更清晰。

### Q2: connection_type 和 device_type 有什么区别?
**A**: 在后端代码中，DeviceInfo 类使用 `device_type` 字段，但 API 响应中输出为 `connection_type`。前端应使用 `connection_type`。

### Q3: 时间戳是秒还是毫秒?
**A**:
- API 响应中的时间戳 (`last_seen`, `connected_at`) 是**秒**级 Unix 时间戳
- 事件推送中的时间戳 (`timestamp`) 是**毫秒**级 Unix 时间戳

### Q4: ip 字段可能为 null 吗?
**A**: 是的。USB 设备可能没有 IP 地址，此时 `ip` 字段为 `null`。

---

## 8. 迁移路径

### 阶段 1: 类型定义 (立即)
1. 创建 `types/device.ts`
2. 定义所有接口和枚举

### 阶段 2: 核心组件 (优先)
1. 更新 DeviceDashboard 状态判断
2. 更新 UnitGrid 设备卡片
3. 添加状态工具函数

### 阶段 3: 样式和 UI (次要)
1. 更新 CSS 样式
2. 添加新状态指示器
3. 优化视觉反馈

### 阶段 4: 测试和验证 (最后)
1. 编写单元测试
2. 执行集成测试
3. 用户验收测试

---

## 9. 回滚计划

如果更新后出现问题:

1. **检查后端是否已修复**
   - 确认 `pyapps/matrix/api/main.py` 已更新
   - 确认后端服务已重启

2. **检查类型定义**
   - 确认 `types/device.ts` 中的枚举值正确
   - 确认接口字段名称匹配

3. **临时回退**
   ```bash
   git checkout HEAD~1 poly_apps/matrixui/types/device.ts
   git checkout HEAD~1 poly_apps/matrixui/components/DeviceDashboard.tsx
   ```

---

## 10. 参考资源

- **后端数据模型**: `pyapps/matrix/adb_device_manager/device_table.py`
- **API 端点实现**: `pyapps/matrix/api/main.py`
- **不一致性报告**: `poly_apps/matrixui/BACKEND_DATA_INCONSISTENCY_REPORT.md`
- **API 完整文档**: `poly_apps/matrixui/API_ENDPOINTS_COMPLETE.md`

---

**文档状态**: ✅ 完成
**最后更新**: 2025-12-08
**维护者**: Claude Code
