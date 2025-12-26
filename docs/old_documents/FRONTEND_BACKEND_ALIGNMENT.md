# 前后端视频流对齐文档

## 完整流程

### 步骤1: 设备列表获取

**前端 (DeviceDashboard.tsx:74)**
```typescript
const result = await wsService.callRpc('adb.device.list', {});
// 收到: { devices: [{deviceId: "device_1", serial: "192.168.50.44:5555", ...}], count: 1 }
```

**后端 (main.py:181-204)**
```python
async def list_devices(data, request_id, context):
    service = DeviceService.instance()
    device_id_manager = DeviceIDManager.instance()
    adb_devices = await service.list_devices()

    for device in adb_devices:
        # 建立映射: device_1 -> 192.168.50.44:5555
        device_id = device_id_manager.register_device(device.serial)

        device_dict = {
            "deviceId": device_id,        # "device_1"
            "serial": device.serial,      # "192.168.50.44:5555"
            "status": device.state.value,
            "model": device.model
        }
```

**DeviceIDManager 映射表**
```
device_1 -> 192.168.50.44:5555
device_2 -> 192.168.50.45:5555
...
```

---

### 步骤2: WebSocket 连接

**前端 (DeviceH264Stream.tsx:71)**
```typescript
const wsUrl = `ws://localhost:48000/video/${deviceId}`;
// 例如: ws://localhost:48000/video/device_1
const ws = new WebSocket(wsUrl);
```

**后端 (video_websocket_routes.py:34-76)**
```python
@router.websocket("/video/{device_id}")
async def h264_video_stream(websocket: WebSocket, device_id: str):
    # device_id = "device_1"

    # 解析 device_id -> serial (URL路径解析，但不使用)
    device_id_manager = DeviceIDManager.instance()
    serial = device_id_manager.get_serial(device_id)
    # serial = "192.168.50.44:5555"

    await websocket.accept()
```

---

### 步骤3: start_stream 命令

**前端 (DeviceH264Stream.tsx:83-88)**
```typescript
ws.onopen = () => {
    const startCommand = {
        command: 'start_stream',
        device_id: deviceId  // "device_1"
    };
    ws.send(JSON.stringify(startCommand));
};
```

**后端 (video_websocket_routes.py:89-113)**
```python
while True:
    message = await websocket.receive_text()
    data = json.loads(message)
    command = data.get('command')  # "start_stream"

    if command == 'start_stream':
        # 从命令获取 device_id
        cmd_device_id = data.get('device_id')  # "device_1"

        # 解析 device_id -> serial
        device_id_manager = DeviceIDManager.instance()
        cmd_serial = device_id_manager.get_serial(cmd_device_id)
        # cmd_serial = "192.168.50.44:5555"

        # 启动视频流
        success = await video_service.start_stream(cmd_serial, websocket)
```

---

### 步骤4: 启动 Scrcpy Server

**后端 (video_stream_service.py:82-136)**
```python
async def start_stream(self, serial: str, websocket: WebSocket):
    # serial = "192.168.50.44:5555"

    # 检查设备是否已在 DeviceManager
    device = self.device_manager.get_device(serial)

    if not device:
        # 设备已在 adb devices 中，直接创建 ScrcpyDevice
        # 不需要 adb connect（已连接）

        # 1. 推送 scrcpy-server.jar 到设备
        scrcpy_jar = Path(self.scrcpy_server_jar)
        await push_jar_to_device(serial, scrcpy_jar)

        # 2. 创建 ScrcpyDevice
        device = ScrcpyDevice(serial, server_params, self.adb_path)

        # 3. 启动 scrcpy-server
        await loop.run_in_executor(None, device.start_server)

    # 4. 创建后台流任务
    task = asyncio.create_task(self._stream_video_loop(serial, device, stop_event))
    self.active_streams[serial] = task
```

---

### 步骤5: 视频流广播

**后端 (video_stream_service.py:142-217)**
```python
async def _stream_video_loop(self, serial: str, device, stop_event):
    # 发送 init 消息
    init_message = {
        "type": "video.init",
        "data": {
            "serial": serial,
            "codec": "h264",
            "width": device_info.resolution.width,
            "height": device_info.resolution.height,
            "fps": device.params.max_fps
        }
    }
    await self._broadcast_json(serial, init_message)

    # 循环读取并广播帧
    while not stop_event.is_set():
        frame = await loop.run_in_executor(None, device.read_video_frame)
        await self._broadcast_frame(serial, frame)
```

**前端 (DeviceH264Stream.tsx:93-180)**
```typescript
ws.onmessage = (event) => {
    if (typeof event.data === 'string') {
        const message = JSON.parse(event.data);

        if (message.type === 'stream_started') {
            setIsConnected(true);
        }
        else if (message.type === 'video.init') {
            const info = {
                width: message.data.width,
                height: message.data.height,
                fps: message.data.fps
            };
            initDecoder(info.width, info.height);
        }
    }
    else if (event.data instanceof ArrayBuffer) {
        // 解析 H.264 帧
        const data = new Uint8Array(event.data);

        // 帧格式: [serial_len(1)][serial(N)][pts(8)][size(4)][H.264 data]
        let offset = 0;
        const serialLen = data[offset++];
        const frameSerial = new TextDecoder().decode(data.slice(offset, offset + serialLen));
        offset += serialLen;

        const view = new DataView(event.data, offset);
        const ptsRaw = view.getBigUint64(0, false);
        const isConfig = (ptsRaw & 0x8000000000000000n) !== 0n;
        const isKeyframe = (ptsRaw & 0x4000000000000000n) !== 0n;
        offset += 8;

        const size = view.getUint32(offset, false);
        offset += 4;

        const h264Data = data.slice(offset, offset + size);

        // 解码帧
        const chunk = new EncodedVideoChunk({
            type: isKeyframe ? 'key' : 'delta',
            timestamp: timestamp / 1000,
            data: h264Data
        });
        decoderRef.current.decode(chunk);
    }
};
```

---

## 关键点总结

### ✅ 正确的流程

1. **设备已连接**: 设备通过 ADB 扫描工具自动发现并连接，已在 `adb devices` 列表
2. **DeviceIDManager 映射**: `adb.device.list` 调用时建立 `device_1 -> 192.168.50.44:5555` 映射
3. **前端使用 deviceId**: 前端只知道 `device_1`，不需要知道实际 serial
4. **后端解析 serial**: 后端用 DeviceIDManager 解析 `device_1` -> `192.168.50.44:5555`
5. **直接启动 scrcpy-server**: 不需要 `adb connect`，设备已连接

### ❌ 错误的做法

- ❌ 前端直接传递 serial (绕过 DeviceIDManager)
- ❌ 后端重新执行 `adb connect` (设备已连接)
- ❌ 后端不推送 scrcpy-server.jar (设备需要 jar 文件)
- ❌ URL 路径的 device_id 解析而不是命令的 device_id (应该用命令的)

### 🔧 调试检查点

如果视频流不工作，按顺序检查：

1. **设备是否在 adb devices 中**
   ```bash
   adb devices -l
   # 应该看到: 192.168.50.44:5555     device
   ```

2. **DeviceIDManager 映射是否建立**
   - 后端日志应显示: `[VideoWebSocket] Current mappings: {'device_1': '192.168.50.44:5555'}`

3. **scrcpy-server.jar 是否存在**
   ```
   D:\programing\core_node\resources\scrcpy-server.jar
   ```

4. **scrcpy-server 是否启动成功**
   - 后端日志应显示: `[VideoStreamService] ScrcpyDevice started for 192.168.50.44:5555`

5. **WebSocket 是否收到帧**
   - 前端控制台应显示: `[DeviceH264Stream] Stream started for device_1`
