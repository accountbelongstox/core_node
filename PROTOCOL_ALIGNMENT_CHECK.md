# 前后端视频帧协议对齐检查

## 协议格式（完全匹配 scrcpy_web_test）

```
[Byte 0]: serial_len (1 byte, uint8)
[Byte 1..N]: serial (N bytes, UTF-8 encoded string)
[Byte N+1..N+8]: pts (8 bytes, big-endian uint64)
    - Bit 63 (0x8000000000000000): is_config flag
    - Bit 62 (0x4000000000000000): is_keyframe flag
    - Bit 0-61: actual timestamp
[Byte N+9..N+12]: size (4 bytes, big-endian uint32)
[Byte N+13..]: H.264 frame data (size bytes)
```

---

## 后端实现 (Python)

**文件**: `pyapps/matrix/services/video_stream_service.py:268-293`

```python
def _pack_frame(self, serial: str, frame: Dict) -> bytes:
    # Step 1: Encode serial
    serial_bytes = serial.encode('utf-8')
    if len(serial_bytes) > 255:
        serial_bytes = serial_bytes[:255]

    # Step 2: Pack PTS with flags
    pts = frame['pts'] & 0x3FFFFFFFFFFFFFFF  # Clear upper 2 bits
    if frame.get('is_config'):
        pts |= 0x8000000000000000  # Set bit 63
    if frame.get('is_keyframe'):
        pts |= 0x4000000000000000  # Set bit 62

    # Step 3: Pack header (12 bytes total)
    # >Q = big-endian unsigned 64-bit (8 bytes)
    # >I = big-endian unsigned 32-bit (4 bytes)
    header = struct.pack(">QI", pts, frame['size'])

    # Step 4: Combine all parts
    prefix = bytes([len(serial_bytes)]) + serial_bytes + header
    payload = prefix + frame['data']

    return payload
```

---

## 前端实现 (TypeScript)

**文件**: `poly_apps/matrixui/components/DeviceH264Stream.tsx:242-272`

```typescript
ws.onmessage = (event) => {
  if (event.data instanceof ArrayBuffer) {
    const data = new Uint8Array(event.data);

    // Step 1: Parse serial
    let offset = 0;
    const serialLen = data[offset++];  // Read 1 byte
    const frameSerial = new TextDecoder().decode(
      data.slice(offset, offset + serialLen)
    );
    offset += serialLen;  // Move past serial (N bytes)

    // Step 2: Parse header (12 bytes)
    const headerOffset = offset;
    const header = new DataView(event.data, headerOffset, 12);

    // Read pts as two 32-bit values (big-endian)
    const ptsHigh = header.getUint32(0, false);  // Bytes 0-3
    const ptsLow = header.getUint32(4, false);   // Bytes 4-7
    const size = header.getUint32(8, false);     // Bytes 8-11

    // Step 3: Combine into 64-bit pts
    const ptsRaw = (BigInt(ptsHigh) << 32n) | BigInt(ptsLow);
    const isConfig = (ptsRaw & 0x8000000000000000n) !== 0n;   // Bit 63
    const isKeyframe = (ptsRaw & 0x4000000000000000n) !== 0n; // Bit 62
    const timestamp = Number(ptsRaw & 0x3FFFFFFFFFFFFFFFn);   // Bits 0-61

    // Step 4: Extract payload
    const payloadOffset = headerOffset + 12;
    const h264Data = data.slice(payloadOffset, payloadOffset + size);

    // ... decode frame ...
  }
};
```

---

## 字节序验证

### Python `struct.pack(">QI", ...)`
- `>` = Big-endian byte order
- `Q` = Unsigned 64-bit integer (8 bytes)
- `I` = Unsigned 32-bit integer (4 bytes)

### JavaScript `DataView.getUint32(offset, false)`
- `false` = Big-endian byte order (default is also big-endian)
- Reads 4 bytes as unsigned 32-bit integer

**✅ 字节序完全匹配：都是 Big-endian**

---

## 测试示例

假设后端发送帧：
- Serial: `"192.168.50.44:5555"` (18 bytes)
- PTS: `1234567890` (0x499602D2)
- is_config: `True` (set bit 63)
- is_keyframe: `False`
- Size: `1024` (0x00000400)
- Data: `[0x00, 0x00, 0x00, 0x01, 0x67, ...]` (H.264 SPS)

### 后端打包结果：
```
Byte 0: 0x12 (18, serial length)
Byte 1-18: "192.168.50.44:5555" (UTF-8)
Byte 19-26: 0x80 0x00 0x00 0x00 0x49 0x96 0x02 0xD2 (pts with bit 63 set)
Byte 27-30: 0x00 0x00 0x04 0x00 (size = 1024)
Byte 31+: H.264 data
```

### 前端解析结果：
```typescript
serialLen = 18
frameSerial = "192.168.50.44:5555"
ptsHigh = 0x80000000  // Upper 32 bits
ptsLow = 0x499602D2   // Lower 32 bits
ptsRaw = 0x80000000499602D2n
isConfig = true       // Bit 63 is set
isKeyframe = false    // Bit 62 is not set
timestamp = 1234567890 // Lower 62 bits
size = 1024
h264Data = Uint8Array[1024]
```

**✅ 解析结果完全正确**

---

## 对比 scrcpy_web_test

### scrcpy_web_test 后端 (server.py:375-393)
```python
header = struct.pack(">QI", pts, frame['size'])
prefix = bytes([len(serial_bytes)]) + serial_bytes + header
payload = prefix + frame['data']
```
**✅ 完全一致**

### scrcpy_web_test 前端 (index.html:806-834)
```javascript
const headerOffset = 1 + serialLen;
const header = new DataView(buffer, headerOffset, 12);
const ptsHigh = header.getUint32(0);  // Default = big-endian
const ptsLow = header.getUint32(4);
const packetSize = header.getUint32(8);
const ptsRaw = (BigInt(ptsHigh) << 32n) | BigInt(ptsLow);
```
**✅ 完全一致**（我的代码显式指定了 `false` 更清晰）

---

## 检查清单

- [x] 协议格式匹配
- [x] 字节序匹配（Big-endian）
- [x] PTS 标志位匹配
- [x] 帧大小解析正确
- [x] Payload 提取正确
- [x] 与 scrcpy_web_test 完全一致

---

## 故障排查

如果仍然看到错误的数据（如 3.6GB 大小），请：

1. **硬刷新浏览器**：`Ctrl + Shift + R` (清除缓存)
2. **检查编译时间**：确认前端 build 是最新的
3. **查看浏览器控制台**：检查是否有解析错误
4. **添加调试日志**：
   ```typescript
   console.log('Frame:', {
     serialLen,
     frameSerial,
     ptsHigh: ptsHigh.toString(16),
     ptsLow: ptsLow.toString(16),
     size,
     isConfig,
     isKeyframe,
     timestamp
   });
   ```

---

## 总结

✅ **前后端协议完全对齐，与 scrcpy_web_test 一致**

如果还有问题，是缓存或其他前端逻辑问题，而不是协议问题。
