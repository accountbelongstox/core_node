# Stage 4 API 规范总结报告

**创建时间**: 2025-11-10
**作者**: Frontend AI
**任务**: 基于 scrcpy_web_test 的正确实现，定义 app_pymatrix 前端与后端的 API 契约

---

## 📋 任务完成情况

### ✅ 已完成任务

1. **分析 app_pymatrix 项目结构** ✅
   - 读取项目树文件 `app_pymatrix_tree_code_assets.txt`
   - 理解 Nuxt 多应用架构
   - 分析现有的前端实现

2. **研究 scrcpy_web_test 参考实现** ✅
   - 分析 `server.py` (763 行) - Python 后端实现
   - 研究 `README.md` - 项目说明
   - 阅读 `VIDEO_STREAMING_EXPLAINED.md` - 技术细节

3. **定义完整的 API 规范** ✅
   - 创建 `FRONTEND_API_SPECIFICATION.md` (500+ 行详细规范)
   - 定义 HTTP REST API 端点
   - 定义 WebSocket 协议
   - 定义二进制视频帧格式
   - 提供 TypeScript 类型定义

4. **更新桥接文件** ✅
   - 创建 `stage4_api_specification.json` - Stage 4 详细规范
   - 更新 `AI_COLLABORATION_BRIDGE.json` - 主索引文件
   - 添加参考实现路径

---

## 📚 创建的文档

### 1. FRONTEND_API_SPECIFICATION.md

**位置**: `D:/programing/core_node/pyapps/matrix/ai_briage/bridge_with_nuxt_pyMatrix/FRONTEND_API_SPECIFICATION.md`

**内容概览**:
- **概述**: 技术栈、核心功能
- **基础架构**: 端口配置、URL 结构
- **HTTP API 端点**:
  - `GET /api/devices` - 设备列表
  - `GET /api/devices/{serial}/info` - 设备详情
  - 其他设备操作端点（剪贴板、屏幕控制等）
- **WebSocket 协议**:
  - 连接端点: `ws://localhost:8000/ws`
  - 命令: `start_stream`, `stop_stream`, `touch_event`
  - 服务器推送: 视频帧、截图、错误
- **视频流二进制协议**:
  - 帧格式详细说明
  - PTS 标志位解析
  - 前端解析实现代码
- **数据类型定义**: TypeScript 类型
- **错误处理**: 错误代码和响应格式
- **实现参考**: scrcpy_web_test 关键文件
- **测试清单**: HTTP API 和 WebSocket 测试

**行数**: 500+ 行

### 2. stage4_api_specification.json

**位置**: `D:/programing/core_node/pyapps/matrix/ai_briage/bridge_with_nuxt_pyMatrix/stage4_api_specification.json`

**内容概览**:
- **元数据**: stageId, title, purpose, status
- **API 端点详细规范**:
  - HTTP endpoints (GET_DEVICES, GET_DEVICE_INFO)
  - WebSocket commands (START_STREAM, STOP_STREAM, TOUCH_EVENT)
  - Server push (VIDEO_FRAME, SCREENSHOT, ERROR)
- **前端实现状态**: 关键文件和所需更改
- **后端实现要求**:
  - 必需组件 (DeviceScanner, VideoStreamManager, etc.)
  - 参考实现路径
  - 关键方法
- **测试清单**: HTTP API 和 WebSocket 测试用例
- **通信协议**: 前端问题、后端职责
- **参考文档**: 文档和代码文件路径

**格式**: JSON (结构化数据)

### 3. AI_COLLABORATION_BRIDGE.json (更新)

**位置**: `D:/programing/core_node/pyapps/matrix/ai_briage/AI_COLLABORATION_BRIDGE.json`

**更新内容**:
- 添加 Stage 4 到 `stagePipeline.stages`
- 更新 `createdFrom` 数组
- 更新 `lastUpdate` 时间戳
- 添加规范文档路径和参考实现路径

---

## 🔑 关键发现

### 1. 设备获取方式（基于 scrcpy_web_test）

#### HTTP API
```http
GET /api/devices
```

#### 实现方式
```python
# 使用 ADB 命令扫描设备
subprocess.run(["adb", "devices", "-l"])

# 获取设备属性
subprocess.run(["adb", "-s", serial, "shell", "getprop", prop])
```

#### 响应格式
```json
{
  "devices": [
    {
      "serial": "R4RCHEKBRWFEEYB6",
      "model": "PEAT00",
      "manufacturer": "OPPO",
      "android_version": "12",
      "status": "device"
    }
  ],
  "count": 1
}
```

### 2. 流接收方式（WebSocket + 二进制帧）

#### WebSocket 端点
```
ws://localhost:8000/ws
```

#### 启动流命令
```json
{
  "command": "start_stream",
  "serial": "R4RCHEKBRWFEEYB6"
}
```

#### 视频帧格式
```
+-------------------+------------------+------------------+------------------+------------------+
| Serial Length (1) | Serial (N bytes) | PTS (8 bytes)    | Size (4 bytes)   | H.264 Data (N)   |
+-------------------+------------------+------------------+------------------+------------------+
```

#### 帧解析代码
```typescript
const view = new DataView(event.data);
let offset = 0;

// 1. 读取序列号长度
const serialLength = view.getUint8(offset);
offset += 1;

// 2. 读取序列号
const serialBytes = new Uint8Array(event.data, offset, serialLength);
const serial = new TextDecoder('utf-8').decode(serialBytes);
offset += serialLength;

// 3. 读取 PTS (Big Endian)
const ptsHigh = view.getUint32(offset, false);
const ptsLow = view.getUint32(offset + 4, false);
const pts = (BigInt(ptsHigh) << 32n) | BigInt(ptsLow);
offset += 8;

// 4. 读取大小
const size = view.getUint32(offset, false);
offset += 4;

// 5. 提取 H.264 数据
const h264Data = event.data.slice(offset, offset + size);
```

### 3. 触摸事件注入

#### 命令格式
```json
{
  "command": "touch_event",
  "serial": "R4RCHEKBRWFEEYB6",
  "action": "down",
  "x": 540,
  "y": 960,
  "pressure": 1.0,
  "pointerId": 0
}
```

#### 动作类型
- `down` - 按下
- `move` - 移动
- `up` - 抬起
- `double_tap` - 双击（自动处理）

### 4. 截图推送

#### 服务器每秒推送
```json
{
  "type": "screenshot",
  "serial": "R4RCHEKBRWFEEYB6",
  "data": "iVBORw0KGgoAAAANS..." // PNG base64
}
```

---

## 🎯 与 app_pymatrix 的对比

### 差异点

| 特性 | app_pymatrix (当前) | scrcpy_web_test (正确) |
|------|-------------------|---------------------|
| WebSocket 端点 | `/ws/video/{serial}` (多端点) | `/ws` (单端点) |
| 命令方式 | 不同端点 | JSON 命令区分 |
| HTTP 端点 | `/api/devices/list` | `/api/devices` |
| 二进制帧格式 | ❓ 需验证 | ✅ 明确定义 |
| 截图推送 | ❓ | ✅ 每秒一次 |

### app_pymatrix 需要更新的地方

#### 1. useDeviceList.ts
```typescript
// 当前
const response = await $fetch(`${this.baseUrl}/api/devices/list`)

// 应改为
const response = await $fetch(`${this.baseUrl}/api/devices`)
```

#### 2. useVideoStream.ts
```typescript
// 当前使用多个端点
buildVideoWsUrl(serial) // -> /ws/video/{serial}
buildControlWsUrl(serial) // -> /ws/control/{serial}

// 应改为单一端点 + 命令
buildWsUrl() // -> /ws
// 发送命令: { command: "start_stream", serial: "..." }
```

#### 3. 二进制帧解析
- ✅ 已实现（useWSRPC.ts 支持 ArrayBuffer）
- ⚠️ 需验证帧格式是否匹配规范

---

## 📦 后端实现要求

### 必需组件

#### 1. DeviceScanner
```python
class DeviceScanner:
    def scan_devices(self) -> List[Dict]:
        # ADB 设备扫描
        subprocess.run(["adb", "devices", "-l"])

    def _get_device_property(self, serial: str, prop: str) -> str:
        # 获取设备属性
        subprocess.run(["adb", "-s", serial, "shell", "getprop", prop])
```

**参考**: `scrcpy_web_test/server.py:32-74`

#### 2. VideoStreamManager
```python
class VideoStreamManager:
    async def start_stream(
        self, serial: str, ws: WebSocket, enable_recording: bool
    ) -> Tuple[bool, bool, Optional[Dict]]:
        # 启动视频流

    async def stop_stream(
        self, serial: str, ws: Optional[WebSocket], force: bool
    ) -> Tuple[bool, bool]:
        # 停止视频流

    async def _stream_video(
        self, serial: str, device: ScrcpyDevice, stop_event: asyncio.Event
    ):
        # 读取并广播视频帧

    async def _broadcast_frame(self, serial: str, frame: Dict):
        # 广播帧到 WebSocket 客户端
        # 格式: [serial_length][serial][pts][size][h264_data]

    async def handle_touch_event(
        self, serial: str, ws: WebSocket,
        action: str, x: int, y: int, pressure: float, pointer_id: int
    ) -> Tuple[bool, Optional[str]]:
        # 注入触摸事件
```

**参考**: `scrcpy_web_test/server.py:78-541`

#### 3. HTTP Handlers
```python
async def handle_devices(request):
    """GET /api/devices"""
    devices = scanner.scan_devices()
    return web.json_response({
        'devices': devices,
        'count': len(devices)
    })
```

**参考**: `scrcpy_web_test/server.py:589-595`

#### 4. WebSocket Handler
```python
async def handle_websocket(request):
    """WS /ws"""
    ws = web.WebSocketResponse()
    await ws.prepare(request)

    async for msg in ws:
        data = json.loads(msg.data)
        command = data.get('command')

        if command == 'start_stream':
            # 处理启动流
        elif command == 'stop_stream':
            # 处理停止流
        elif command == 'touch_event':
            # 处理触摸事件
```

**参考**: `scrcpy_web_test/server.py:598-707`

---

## 🧪 测试指南

### 1. 测试参考实现

```bash
# 1. 启动 scrcpy_web_test 服务器
cd D:/programing/core_node/pyapps/scrcpy_web_test
python server.py

# 2. 测试设备列表 API
curl http://localhost:27880/api/devices

# 3. 打开浏览器测试 WebSocket
# 访问: http://localhost:27880
```

### 2. 验证 API 端点

#### HTTP API
```bash
# 设备列表
curl http://localhost:8000/api/devices

# 设备详情
curl http://localhost:8000/api/devices/R4RCHEKBRWFEEYB6/info
```

#### WebSocket
```javascript
const ws = new WebSocket('ws://localhost:8000/ws');
ws.binaryType = 'arraybuffer';

// 启动流
ws.send(JSON.stringify({
  command: 'start_stream',
  serial: 'R4RCHEKBRWFEEYB6'
}));

// 监听消息
ws.onmessage = (event) => {
  if (event.data instanceof ArrayBuffer) {
    console.log('Received video frame:', event.data.byteLength, 'bytes');
  } else {
    const msg = JSON.parse(event.data);
    console.log('Message:', msg);
  }
};
```

---

## 📖 参考资料

### 文档
1. **FRONTEND_API_SPECIFICATION.md** - 完整 API 规范
2. **VIDEO_STREAMING_EXPLAINED.md** - 视频流技术说明
3. **scrcpy_web_test/README.md** - 项目概览

### 代码
1. **scrcpy_web_test/server.py** - 后端参考实现
2. **scrcpy_web_test/index.html** - 前端参考实现
3. **app_pymatrix/composables_app_pymatrix/** - 前端 Nuxt 实现

### 桥接文件
1. **AI_COLLABORATION_BRIDGE.json** - 主索引
2. **stage4_api_specification.json** - Stage 4 详细规范

---

## 🚀 下一步行动

### 后端 AI 任务
1. ✅ 阅读 `FRONTEND_API_SPECIFICATION.md`
2. ✅ 研究 `scrcpy_web_test/server.py` 参考实现
3. ⏳ 实现 HTTP API 端点
   - `GET /api/devices`
   - `GET /api/devices/{serial}/info`
4. ⏳ 实现 WebSocket 处理
   - 单一端点 `/ws`
   - 命令: `start_stream`, `stop_stream`, `touch_event`
   - 推送: 视频帧、截图、错误
5. ⏳ 实现二进制帧广播
   - 格式: `[serial_length][serial][pts][size][h264_data]`
6. ⏳ 测试所有端点

### 前端 AI 任务（可选）
1. ✅ API 规范已完成
2. ⏳ 验证现有实现是否符合规范
3. ⏳ 更新不匹配的部分（如 API 端点路径）
4. ⏳ 测试与后端的集成

---

## 📝 备注

1. ⚠️ **关键**: 后端必须严格遵循此规范实现
2. ⚠️ **参考**: scrcpy_web_test 是经过测试的正确实现
3. ⚠️ **WebSocket**: 使用单一端点 `/ws`，不是多个端点
4. ⚠️ **帧格式**: 必须包含 serial_length prefix
5. ⚠️ **截图**: 每秒推送一次 PNG base64

---

## ✅ 任务完成

- [x] 分析 app_pymatrix 项目结构
- [x] 研究 scrcpy_web_test 实现
- [x] 定义完整 API 规范
- [x] 创建 FRONTEND_API_SPECIFICATION.md
- [x] 创建 stage4_api_specification.json
- [x] 更新 AI_COLLABORATION_BRIDGE.json
- [x] 编写总结报告

**状态**: ✅ 所有任务完成
**下一步**: 等待后端 AI 实现规范中的端点

---

**Frontend AI**
2025-11-10
