# 前端视频解码错误修复指南

## 问题总结

切换UI时出现大量视频解码错误。后端已经实施了修复方案，现在前端需要验证和优化。

---

## ✅ 已完成的后端修复

1. **智能关键帧等待** - 解码器会自动跳过非关键帧，等待同步
2. **错误日志限流** - 减少日志刷屏（从每帧错误→每2秒1次）
3. **解码器状态跟踪** - 追踪错误次数和成功解码次数
4. **flush时重置状态** - 恢复流时重置解码器状态为"等待关键帧"

---

## 前端需要验证的功能

### 1. 验证 visibilitychange 事件（高优先级）⚠️

**位置**: `poly_apps/matrixui/hooks/useVideoStream.ts:475-506`

**需要验证**:
```typescript
// 确认这个 useEffect 依赖正确
useEffect(() => {
  if (!enabled || !wsRef.current) return;

  const handleVisibilityChange = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    if (document.hidden) {
      console.log(`[useVideoStream] Page hidden, pausing stream for ${deviceId}`);
      wsRef.current.send(JSON.stringify({ command: 'pause' }));
    } else {
      console.log(`[useVideoStream] Page visible, resuming stream for ${deviceId}`);
      wsRef.current.send(JSON.stringify({ command: 'resume' }));
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, [enabled, deviceId]); // ✅ 依赖正确
```

**测试步骤**:
1. 打开浏览器控制台
2. 打开有视频流的页面
3. 切换到另一个标签页
4. 检查控制台是否打印: `[useVideoStream] Page hidden, pausing stream for device_X`
5. 切换回视频流标签页
6. 检查控制台是否打印: `[useVideoStream] Page visible, resuming stream for device_X`

**预期结果**:
- ✅ 切换走时看到 "Page hidden" 日志
- ✅ 切换回时看到 "Page visible" 日志
- ✅ 后端日志显示 `[VideoStreamService] Stream paused/resumed`
- ❌ 如果看不到这些日志，说明 visibilitychange 没有触发

---

### 2. 检查 WebSocket 状态（高优先级）⚠️

**问题**: 可能在 WebSocket 还未完全打开时就尝试发送命令

**修复方案**:
```typescript
// 在 useVideoStream.ts 的 handleVisibilityChange 中添加额外检查
const handleVisibilityChange = () => {
  // ✅ 添加更详细的状态检查
  if (!wsRef.current) {
    console.warn(`[useVideoStream] Cannot pause/resume: WebSocket is null for ${deviceId}`);
    return;
  }

  if (wsRef.current.readyState !== WebSocket.OPEN) {
    console.warn(`[useVideoStream] Cannot pause/resume: WebSocket not open (state: ${wsRef.current.readyState}) for ${deviceId}`);
    return;
  }

  if (document.hidden) {
    console.log(`[useVideoStream] Page hidden, pausing stream for ${deviceId}`);
    try {
      wsRef.current.send(JSON.stringify({ command: 'pause' }));
      console.log(`[useVideoStream] ✓ Pause command sent for ${deviceId}`);
    } catch (error) {
      console.error(`[useVideoStream] ✗ Failed to send pause command for ${deviceId}:`, error);
    }
  } else {
    console.log(`[useVideoStream] Page visible, resuming stream for ${deviceId}`);
    try {
      wsRef.current.send(JSON.stringify({ command: 'resume' }));
      console.log(`[useVideoStream] ✓ Resume command sent for ${deviceId}`);
    } catch (error) {
      console.error(`[useVideoStream] ✗ Failed to send resume command for ${deviceId}:`, error);
    }
  }
};
```

---

### 3. 添加连接状态显示（中优先级）📊

**建议**: 在视频组件上显示当前状态

**位置**: `poly_apps/matrixui/components/DeviceVideoStream.tsx`

```typescript
export const DeviceVideoStream: React.FC<DeviceVideoStreamProps> = ({
  deviceId,
  enabled,
  onError,
  onInit
}) => {
  const [isPaused, setIsPaused] = useState(false);

  // ... existing code ...

  // Listen to page visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPaused(document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <div className="w-full h-full relative">
      <canvas ref={canvasRef} className="w-full h-full object-cover" />

      {/* 添加暂停指示器 */}
      {isPaused && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <div className="text-white text-sm font-mono">
            Stream Paused
          </div>
        </div>
      )}

      {/* 现有的连接状态显示 */}
      {isConnected && (
        <div className="absolute top-2 left-2 px-2 py-1 bg-green-500/20 border border-green-500/50 rounded text-[9px] font-mono text-green-400">
          ● CONNECTED
        </div>
      )}
    </div>
  );
};
```

---

### 4. 优化页面切换时的行为（低优先级）

**问题**: 某些UI切换可能不触发 visibilitychange

**解决方案**: 添加自定义暂停逻辑

```typescript
// 创建新 hook: hooks/useVideoPauseControl.ts
import { useEffect, useRef } from 'react';

export const useVideoPauseControl = (enabled: boolean, onPause: () => void, onResume: () => void) => {
  const isVisible = useRef(true);

  useEffect(() => {
    // Listen to visibility changes
    const handleVisibilityChange = () => {
      const wasVisible = isVisible.current;
      const nowVisible = !document.hidden;

      if (wasVisible && !nowVisible) {
        // Became hidden
        console.log('[VideoPauseControl] Page hidden, triggering pause');
        onPause();
      } else if (!wasVisible && nowVisible) {
        // Became visible
        console.log('[VideoPauseControl] Page visible, triggering resume');
        onResume();
      }

      isVisible.current = nowVisible;
    };

    // Listen to blur/focus events (additional safety net)
    const handleBlur = () => {
      console.log('[VideoPauseControl] Window blur, triggering pause');
      onPause();
    };

    const handleFocus = () => {
      console.log('[VideoPauseControl] Window focus, triggering resume');
      onResume();
    };

    if (enabled) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('blur', handleBlur);
      window.addEventListener('focus', handleFocus);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [enabled, onPause, onResume]);
};
```

---

## 测试清单

### 测试场景1: 标签页切换
- [ ] 打开视频流页面
- [ ] 切换到其他标签页
- [ ] 等待5秒
- [ ] 切换回来
- [ ] 检查: 视频正常播放，无解码错误

### 测试场景2: 窗口最小化
- [ ] 打开视频流页面
- [ ] 最小化浏览器窗口
- [ ] 等待10秒
- [ ] 恢复窗口
- [ ] 检查: 视频正常恢复，无解码错误

### 测试场景3: 多设备视频流
- [ ] 打开多个设备的视频流
- [ ] 切换标签页
- [ ] 切换回来
- [ ] 检查: 所有设备视频流正常，无交叉干扰

### 测试场景4: 快速切换
- [ ] 打开视频流
- [ ] 快速切换标签页（3秒内切换5次）
- [ ] 检查: 视频流稳定，无崩溃或错误

---

## 预期效果对比

### 修复前 ❌
```
[VideoDecoder] ✗ Decode error for 192.168.50.240:5555: Invalid data...
[VideoDecoder] ✗ Decode error for 192.168.50.240:5555: Invalid data...
[VideoDecoder] ✗ Decode error for 192.168.50.240:5555: Invalid data...
[VideoDecoder] ✗ Decode error for 192.168.50.240:5555: Invalid data...
... (重复几十次)
```

### 修复后 ✅
```
[VideoDecoder] Creating H.264 decoder for 192.168.50.240:5555...
[VideoDecoder] ✓ Decoder created successfully
[VideoDecoder] ⚠ Waiting for key frame for 192.168.50.240:5555, skipping non-keyframe...
[VideoDecoder] ✓ Key frame received and decoded for 192.168.50.240:5555, decoder synchronized
[VideoDecoder] ✓ First frame decoded: 720x1280

// 页面隐藏时
[useVideoStream] Page hidden, pausing stream for device_1
[VideoStreamService] Stream paused for client on 192.168.50.240:5555

// 页面显示时
[useVideoStream] Page visible, resuming stream for device_1
[VideoStreamService] Stream resumed for client on 192.168.50.240:5555
[VideoDecoder] Decoder flushed and reset for 192.168.50.240:5555
[VideoDecoder] Decoder state reset for 192.168.50.240:5555, waiting for keyframe
[VideoDecoder] ✓ Key frame received and decoded, decoder synchronized
```

---

## 如果还有问题

如果实施后仍有解码错误，收集以下信息：

1. **前端日志**:
   ```
   打开浏览器控制台，筛选 [useVideoStream] 和 [DeviceVideoStream]
   ```

2. **后端日志**:
   ```
   筛选 [VideoDecoder] 和 [VideoStreamService]
   ```

3. **重现步骤**:
   - 详细描述如何触发错误
   - 是否每次都能重现
   - 是否只在特定设备上出现

4. **环境信息**:
   - 浏览器版本
   - 设备数量
   - 视频分辨率设置

---

## 紧急回退方案

如果修复导致更严重的问题，可以临时禁用智能关键帧等待：

**修改后端**: `pyapps/matrix/services/video_decoder_service.py:175-182`

```python
# 临时注释掉关键帧检测
# if state['waiting_for_keyframe'] and not is_keyframe:
#     import time
#     current_time = time.time()
#     if current_time - state['last_error_time'] > 2.0:
#         print(f"[VideoDecoder] ⚠ Waiting for key frame for {serial}, skipping non-keyframe...")
#         state['last_error_time'] = current_time
#     continue
```

但建议先收集日志分析问题，而不是直接回退。

---

## 支持

如果需要帮助，提供:
- 完整的前端控制台日志
- 完整的后端日志（至少包含连接建立到出错的完整过程）
- 操作录屏（可选但有帮助）
