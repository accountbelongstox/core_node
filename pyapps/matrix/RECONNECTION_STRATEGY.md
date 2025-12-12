# 视频流重连策略 (Video Stream Reconnection Strategy)

> 完整的前后端重连架构，解决设备连接断开问题

## 📋 目录

1. [问题分析](#问题分析)
2. [架构设计](#架构设计)
3. [后端实现](#后端实现)
4. [前端实现](#前端实现)
5. [测试流程](#测试流程)
6. [故障排查](#故障排查)

---

## 问题分析

### 原始问题

```
ConnectionError: Connection closed
  at pycore/pyutils/device/scrcpy_device.py:561 in _recv_exactly()
```

### 调用链分析

```
pymain.py
  └→ AppLauncher
      └→ matrix_main.py::matrix_main_entry()
          └→ 初始化 ADB 服务 + 视频流服务
              └→ FastAPI WebSocket 路由
                  └→ video_websocket_routes.py::yuv_video_stream()
                      └→ VideoStreamService.stream_yuv_to_websocket()
                          └→ ScrcpyDevice.read_video_frame() (阻塞在 executor)
                              └→ _recv_exactly(_video_socket, 12) ← 💥 连接断开
```

### 根本原因

1. ✗ **设备侧 scrcpy-server 崩溃**
2. ✗ **ADB 连接断开**（USB/网络不稳定）
3. ✗ **设备休眠或低电量**
4. ✗ **长时间运行后网络超时**
5. ✗ **缺少心跳检测和自动重连**

---

## 架构设计

### 🎯 设计目标

- ✅ **主动检测**：定期检查设备连接健康状态
- ✅ **自动恢复**：检测到断开后自动尝试重连
- ✅ **前后端同步**：通过 WebSocket 实时通知状态变化
- ✅ **用户友好**：显示清晰的状态指示和重连进度

### 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Unified Heartbeat System                  │
│                  (每秒 tick，全局统一)                       │
└────────────────────┬────────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
   ┌─────▼──────┐        ┌──────▼─────┐
   │ ADB Scan   │        │ Video      │
   │ (5s/30s)   │        │ Health     │
   │            │        │ (10s)      │
   └────────────┘        └──────┬─────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
           ┌────────▼────────┐    ┌────────▼────────┐
           │ Check Socket    │    │ Check Data      │
           │ Check ADB       │    │ Timeout (30s)   │
           └────────┬────────┘    └────────┬────────┘
                    │                       │
                    └───────────┬───────────┘
                                │
                       ┌────────▼────────┐
                       │ Reconnect Logic │
                       │ (指数退避: 1s,  │
                       │  2s, 4s)        │
                       └────────┬────────┘
                                │
                       ┌────────▼────────┐
                       │ WebSocket       │
                       │ Broadcast       │
                       │ Status Update   │
                       └─────────────────┘
                                │
                                ▼
                        Frontend UI Update
```

---

## 后端实现

### 1️⃣ 视频流健康检查服务

**文件**: `pyapps/matrix/services/video_stream_health_service.py`

#### 核心功能

```python
class VideoStreamHealthService:
    """
    视频流健康监控服务

    集成到统一心跳系统，执行周期性健康检查和自动重连
    """

    def check_all_devices(self):
        """由心跳系统每10秒调用"""
        for serial in self.active_stream_devices:
            self._check_device_health(serial, current_time)

    def _check_device_health(self, serial: str, current_time: float):
        """
        健康检查三步骤:
        1. Socket 有效性检查
        2. 数据超时检查 (30s 无数据 = 警告)
        3. ADB 设备列表检查
        """
```

#### 健康状态

| 状态 | 描述 | 操作 |
|------|------|------|
| `healthy` | 正常运行 | 继续监控 |
| `warning` | 30秒无数据 | 尝试重连 |
| `error` | Socket断开 | 立即重连 |
| `reconnecting` | 重连中 | 等待结果 |

#### 重连策略

```python
# 指数退避
attempt 1: delay = 1s
attempt 2: delay = 2s
attempt 3: delay = 4s
max_attempts = 3
```

### 2️⃣ 集成到心跳系统

**文件**: `pyapps/matrix/matrix_main.py`

```python
def matrix_main_entry():
    # 初始化健康服务
    video_health_service = get_video_stream_health_service()
    if _rpc_server:
        video_health_service.set_rpc_server(_rpc_server)

    # 注册到心跳系统
    heartbeat = get_heartbeat_system()
    heartbeat.register_callback(
        name='video_stream_health_check',
        callback=lambda: video_health_service.check_all_devices(),
        interval=10  # 10秒检查一次
    )
```

### 3️⃣ VideoStreamService 集成

**文件**: `pyapps/matrix/services/video_stream_service.py`

#### 关键集成点

```python
class VideoStreamService:
    def __init__(self):
        # 集成健康服务
        from pyapps.matrix.services.video_stream_health_service import get_video_stream_health_service
        self.health_service = get_video_stream_health_service()

    async def start_stream(self, serial: str, websocket: WebSocket):
        # 注册设备为活跃
        self.health_service.mark_device_active(serial)

    async def _stream_video_loop(self, serial: str, device, stop_event):
        # 每次收到帧时更新时间戳
        self.health_service.update_data_timestamp(serial)

    async def stop_stream(self, serial: str, websocket: WebSocket):
        # 标记设备为非活跃
        self.health_service.mark_device_inactive(serial)
```

---

## 前端实现

### 1️⃣ 自动重连逻辑

**文件**: `poly_apps/matrixui/components/DeviceH264Stream.tsx`

#### 重连状态管理

```typescript
const [isConnected, setIsConnected] = useState(false);
const [isReconnecting, setIsReconnecting] = useState(false);
const [connectionError, setConnectionError] = useState<string | null>(null);

// 重连配置
const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
const reconnectAttemptsRef = useRef(0);
const maxReconnectAttempts = 10;
const reconnectDelays = [1000, 2000, 4000, 8000, 16000, 30000]; // 最大30秒
```

#### 连接函数

```typescript
const connect = useCallback(() => {
    const ws = new WebSocket(`ws://localhost:48000/video/${deviceId}`);

    ws.onopen = () => {
        reconnectAttemptsRef.current = 0; // 重置计数
        setIsReconnecting(false);
    };

    ws.onclose = (event) => {
        if (enabled && reconnectAttemptsRef.current < maxReconnectAttempts) {
            // 指数退避重连
            const delayIndex = Math.min(reconnectAttemptsRef.current, reconnectDelays.length - 1);
            const delay = reconnectDelays[delayIndex];
            reconnectAttemptsRef.current++;

            setIsReconnecting(true);
            reconnectTimeoutRef.current = setTimeout(() => {
                connect();
            }, delay);
        }
    };
}, [browserSupport, deviceId, enabled]);
```

#### 后端状态监听

```typescript
ws.onmessage = (event) => {
    if (typeof event.data === 'string') {
        const msg = JSON.parse(event.data);

        if (msg.type === 'device.status') {
            // 处理后端设备状态更新
            if (msg.data.status === 'error' || msg.data.status === 'reconnecting') {
                setConnectionError(msg.data.error_message);
            } else if (msg.data.status === 'healthy') {
                setConnectionError(null);
            }
        }
    }
};
```

### 2️⃣ UI 状态指示器

#### 连接成功

```tsx
{isConnected && !connectionError && (
    <div className="absolute top-2 left-2 px-2 py-1 bg-[#05ffa1]/20 border border-[#05ffa1]/50">
        ● H.264 CONNECTED
    </div>
)}
```

#### 重连中

```tsx
{isReconnecting && (
    <div className="absolute top-2 left-2 px-2 py-1 bg-yellow-500/20 border border-yellow-500/50">
        ↻ RECONNECTING ({reconnectAttemptsRef.current}/{maxReconnectAttempts})
    </div>
)}
```

#### 连接错误

```tsx
{connectionError && !isReconnecting && (
    <div className="absolute top-2 left-2 px-2 py-1 bg-[#ff2a6d]/20 border border-[#ff2a6d]/50">
        ✗ {connectionError}
    </div>
)}
```

#### 手动重连按钮

```tsx
{connectionError && reconnectAttemptsRef.current >= maxReconnectAttempts && (
    <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
        <button onClick={() => {
            reconnectAttemptsRef.current = 0;
            connect();
        }}>
            Retry Connection
        </button>
    </div>
)}
```

---

## 测试流程

### 🧪 测试场景

#### 1. 模拟设备断开

```bash
# 断开 USB 设备
# 或杀死 scrcpy-server 进程
adb -s <SERIAL> shell pkill -f scrcpy
```

**预期行为**:
- ✅ 后端健康检查在 10 秒内检测到断开
- ✅ 前端 WebSocket 收到状态更新
- ✅ 前端显示 "RECONNECTING" 指示器
- ✅ 后端尝试重连（最多 3 次，间隔 1s/2s/4s）
- ✅ 前端尝试 WebSocket 重连（最多 10 次，指数退避）

#### 2. 模拟网络抖动

```bash
# 短暂断开网络
# 然后恢复
```

**预期行为**:
- ✅ 前端自动重连成功
- ✅ 后端恢复健康状态
- ✅ 视频流继续播放

#### 3. 长时间无数据

```bash
# 暂停设备或锁屏 > 30 秒
```

**预期行为**:
- ✅ 后端检测到数据超时（30秒无数据）
- ✅ 标记为 WARNING 状态
- ✅ 尝试重连

### 📊 监控日志

#### 后端日志关键词

```python
[VideoStreamHealth] Checking N active devices...
[VideoStreamHealth] Device X socket invalid
[VideoStreamHealth] Device X no data for 30.5s
[VideoStreamHealth] Attempting reconnection for X (attempt 1/3, delay=1s)
[VideoStreamHealth] Device X recovered
```

#### 前端日志关键词

```javascript
[H264Stream] WebSocket closed
[H264Stream] Reconnecting in 2000ms (attempt 2/10)
[H264Stream] WebSocket opened
[H264Stream] Stream started
[H264Stream] Device status update: { status: 'reconnecting' }
```

---

## 故障排查

### 问题: 前端无法重连

#### 可能原因
1. ❌ 后端服务未启动
2. ❌ WebSocket 端口被占用
3. ❌ 浏览器 WebSocket 限制

#### 解决方法
```bash
# 检查后端服务
curl http://localhost:48000/health

# 检查 WebSocket 端口
netstat -an | grep 48000

# 查看浏览器控制台
# 检查 WebSocket 连接错误
```

### 问题: 后端检测不到断开

#### 可能原因
1. ❌ 健康检查未注册到心跳系统
2. ❌ 设备未标记为活跃
3. ❌ Socket 检查逻辑错误

#### 解决方法
```python
# 检查心跳系统
heartbeat = get_heartbeat_system()
stats = heartbeat.get_stats()
print(stats['callbacks'])  # 应包含 'video_stream_health_check'

# 检查活跃设备
health_service = get_video_stream_health_service()
print(health_service.active_stream_devices)
```

### 问题: 重连后视频无法播放

#### 可能原因
1. ❌ 解码器未重置
2. ❌ 缺少 SPS/PPS 配置帧
3. ❌ PTS 时间戳不连续

#### 解决方法
```typescript
// 重连后清除解码器
if (decoderRef.current) {
    decoderRef.current.close();
    decoderRef.current = null;
    decoderConfigured.current = false;
}

// 等待新的配置帧
// 后端会在重连后首先发送配置帧
```

---

## 📈 性能指标

### 正常运行

| 指标 | 目标值 |
|------|--------|
| 健康检查间隔 | 10 秒 |
| 数据超时阈值 | 30 秒 |
| 前端 WebSocket 心跳 | 30 秒 |
| 视频帧率 | 30-60 fps |

### 重连性能

| 指标 | 目标值 |
|------|--------|
| 断开检测延迟 | < 10 秒 |
| 首次重连尝试 | 1 秒后 |
| 完整重连周期 | < 7 秒 (1+2+4) |
| 前端重连周期 | < 63 秒 (1+2+4+8+16+30) |

---

## 🎉 总结

### 已实现功能

- ✅ 统一心跳系统集成
- ✅ 后端主动健康检查（10秒周期）
- ✅ 设备状态追踪（healthy/warning/error/reconnecting）
- ✅ 自动重连（后端3次，前端10次，指数退避）
- ✅ WebSocket 状态广播
- ✅ 前端自动重连（指数退避）
- ✅ UI 状态指示器（连接/重连/错误）
- ✅ 手动重连按钮
- ✅ 错误信息显示

### 架构优势

1. **统一管理**: 基于心跳系统，无额外线程
2. **主动检测**: 不依赖被动错误，提前发现问题
3. **自动恢复**: 无需用户干预，自动重连
4. **用户友好**: 清晰的状态显示和重连进度
5. **可扩展**: 易于添加新的健康检查项

### 未来改进

- 🔮 更智能的重连策略（根据断开原因调整）
- 🔮 设备优先级管理（优先重连重要设备）
- 🔮 重连成功率统计
- 🔮 用户可配置重连参数
- 🔮 设备健康历史记录

---

**文档版本**: 1.0
**创建日期**: 2025-12-12
**维护**: Matrix Team
