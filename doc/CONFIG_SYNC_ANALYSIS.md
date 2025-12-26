# Configuration Synchronization Consistency Analysis

**Date**: 2025-12-12
**Analyzed by**: Claude Code
**Purpose**: Deep analysis of configuration flow and video stream mode switching consistency

---

## Executive Summary

### Critical Findings

✅ **STRENGTHS**:
1. Configuration persistence is solid (JSON file-based)
2. Frontend-backend sync mechanism works correctly
3. RPC v2 config endpoints are well-designed
4. Config change propagation is implemented

⚠️ **ISSUES IDENTIFIED**:
1. **Video stream mode changes do NOT affect running streams** (backend limitation)
2. **Config updates don't notify active video connections** (missing THREAD_BUS integration)
3. **Frontend auto-reconnect depends on component remount** (fragile timing)
4. **No explicit stream restart mechanism** (relies on implicit reconnection)

---

## 1. Configuration Flow Analysis

### 1.1 Initial Configuration Load

#### Frontend Flow (`configService.ts`)
```typescript
// On initialization
async initialize(): Promise<void> {
  // 1. Start with default config
  this.config = { ...DEFAULT_CONFIG };

  // 2. Try to load from backend if RPC connected
  if (wsService.isRpcConnected()) {
    await this.refresh();
  }
}

// On RPC connection
async onRpcConnected(): Promise<void> {
  await this.refresh(); // Fetch from backend
}

// Refresh from backend
async refresh(): Promise<void> {
  const result = await wsService.callRpc('config.global', {});
  if (result && result.config) {
    this.config = { ...DEFAULT_CONFIG, ...result.config };
    this.notifyListeners(); // Notify all subscribers
  }
}
```

**Default Values**:
```typescript
const DEFAULT_CONFIG: GlobalConfig = {
  max_size: 720,
  bit_rate: 8000000,
  max_fps: 60,
  codec: 'h264',
  control: true,
  locked_video_orientation: -1,
  video_stream_mode: 'yuv',  // Changed from 'h264' to 'yuv'
  hwaccel: 'auto'
};
```

#### Backend Flow (`config_service.py`)
```python
def _load_from_disk(self) -> Dict:
    if self._config_file.exists():
        with self._config_file.open("r", encoding="utf-8") as fp:
            data = json.load(fp)
        return data
    return self._default_config()

def _default_config(self) -> Dict:
    return {
        "global": deepcopy(Config.DEFAULT_DEVICE_PARAMS),
        "devices": {},
    }
```

**Default Values** (`matrix_config/config.py`):
```python
DEFAULT_DEVICE_PARAMS = {
    "max_size": DEFAULT_MAX_SIZE,        # 720
    "bit_rate": DEFAULT_BIT_RATE,        # 8000000
    "max_fps": DEFAULT_MAX_FPS,          # 60
    "codec": DEFAULT_CODEC,              # "h264"
    "control": True,
    "locked_video_orientation": -1,
    "video_stream_mode": DEFAULT_VIDEO_STREAM_MODE,  # "yuv"
}
```

### 1.2 Configuration Consistency Check

✅ **CONSISTENT**: Frontend and backend default configs match
- Both default to `video_stream_mode: 'yuv'`
- All numeric values are identical
- Config structure is aligned

---

## 2. Configuration Update Flow

### 2.1 Frontend Update Process

```typescript
// User changes config in settings panel (App.tsx)
async updateConfig(updates: Partial<GlobalConfig>): Promise<void> {
  // 1. Send to backend via RPC
  await wsService.callRpc('config.global_update', updates);

  // 2. Refresh from backend (ensures consistency)
  await this.refresh();

  // 3. Notify all subscribers
  window.dispatchEvent(new CustomEvent(CONFIG_CHANGE_EVENT, { detail: this.config }));
}
```

### 2.2 Backend Update Process

```python
async def update_global(self, payload: Dict) -> Dict:
    updates = self._sanitise_payload(payload)

    async with self._lock:
        old_config = deepcopy(self._data["global"])
        self._data["global"].update(updates)
        await self._write_locked()  # Write to disk
        new_config = deepcopy(self._data["global"])

    # Log video_stream_mode changes
    if "video_stream_mode" in updates:
        old_mode = old_config.get("video_stream_mode")
        new_mode = new_config.get("video_stream_mode")
        ColorPrint.green(f"Video stream mode changed: {old_mode} -> {new_mode}")

    return new_config
```

### 2.3 RPC Endpoint (`api/main.py`)

```python
async def update_global(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
    service = ConfigService.instance()
    updated = await service.update_global(data)
    return {"success": True, "config": updated}
```

✅ **UPDATE FLOW IS CORRECT**:
1. Frontend sends update via RPC
2. Backend persists to disk
3. Backend returns updated config
4. Frontend refreshes from backend (read-after-write consistency)
5. Frontend notifies all subscribers

---

## 3. Video Stream Mode Change Propagation

### 3.1 Frontend Detection (`DeviceVideoStream.tsx`)

```typescript
useEffect(() => {
  const config = configService.getConfig();
  let prevMode = config?.video_stream_mode;

  // Subscribe to config changes
  const unsubscribe = configService.subscribe((config) => {
    const newMode = config.video_stream_mode;

    // Only force remount if video stream mode actually changed
    if (prevMode && prevMode !== newMode) {
      console.log(`Video mode changed: ${prevMode} -> ${newMode}, remounting...`);
      setConfigKey(prev => prev + 1); // Force remount by changing key
    }

    prevMode = newMode;
    setGlobalConfig(config);
  });

  return () => unsubscribe();
}, [deviceId]);
```

**Remount Mechanism**:
```typescript
// Component render with key prop
if (globalConfig?.video_stream_mode === 'h264') {
  return (
    <DeviceH264Stream
      key={`h264-${deviceId}-${configKey}`}  // ← Key change causes remount
      deviceId={deviceId}
      enabled={enabled}
    />
  );
}
```

### 3.2 useVideoStream Hook Auto-Reconnect

```typescript
useEffect(() => {
  const unsubscribe = configService.subscribe((config: GlobalConfig) => {
    const oldMode = currentStreamModeRef.current;
    const newMode = config.video_stream_mode;

    // If video stream mode changed and we have an active connection, reconnect
    if (oldMode && oldMode !== newMode && enabled) {
      console.log(`Video mode changed: ${oldMode} -> ${newMode}, reconnecting...`);

      // Close old connection
      if (wsRef.current) {
        wsRef.current.close(1000, `Mode changed from ${oldMode} to ${newMode}`);
        wsRef.current = null;
      }

      // Reset connection state
      connectionStateRef.current.isConnected = false;
      connectionStateRef.current.isConnecting = false;

      // Reconnect with new mode after 500ms delay
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connectInternal(newMode, config.hwaccel);
      }, 500);
    }
  });

  return () => unsubscribe();
}, [deviceId, enabled, connectInternal]);
```

⚠️ **FRAGILE RECONNECTION**:
- Relies on frontend detecting config change
- 500ms delay is arbitrary
- No backend notification of mode change
- Race condition possible if user switches modes rapidly

---

## 4. Backend Video Stream Service Analysis

### 4.1 Stream Initialization (`video_stream_service.py`)

```python
async def start_stream(self, serial: str, websocket: WebSocket) -> bool:
    # Get or create device
    device = self.device_manager.get_device(serial)

    if not device:
        # Create device with ServerParams from config
        device = ScrcpyDevice(serial, server_params, self.adb_path)
        await device.start_server()

    # Create background streaming task
    task = asyncio.create_task(self._stream_video_loop(serial, device, stop_event))
    self.active_streams[serial] = task
```

### 4.2 YUV Stream Initialization

```python
async def stream_yuv_to_websocket(self, serial: str, websocket: WebSocket, hwaccel: Optional[str] = None):
    # Get or create device
    device = self.device_manager.get_device(serial)

    if not device.is_connected():
        # Get config from ConfigService
        config_service = ConfigService.instance()
        global_config = await config_service.get_global()

        # Create ServerParams with current config
        params = ServerParams(
            max_size=global_config.get('max_size', 720),
            bit_rate=global_config.get('bit_rate', 8000000),
            max_fps=global_config.get('max_fps', 60),
            codec=VideoCodec.H264,  # Always use H.264 for decoding
            control=global_config.get('control', True),
            locked_video_orientation=global_config.get('locked_video_orientation', -1)
        )

        await device.start_server(jar_path=self.scrcpy_server_jar, params=params)
```

🔴 **CRITICAL ISSUE**: Config is only used during initial stream setup
- Once stream is running, config changes have NO effect
- No mechanism to restart scrcpy-server with new params
- Video stream parameters are fixed until device disconnects

---

## 5. Config-Dependent Behavior Analysis

### 5.1 Device Connection (`device_service.py`)

```python
async def connect_device(self, serial: str, params: Dict[str, Any], device_name_override: Optional[str] = None) -> bool:
    # Merge configuration layers: global -> device -> request overrides
    effective_params = await self.config_service.get_effective_server_params(device_name, overrides)

    server_params = ServerParams(
        max_size=effective_params.get("max_size", Config.DEFAULT_MAX_SIZE),
        bit_rate=effective_params.get("bit_rate", Config.DEFAULT_BIT_RATE),
        max_fps=effective_params.get("max_fps", Config.DEFAULT_MAX_FPS),
        codec=codec_enum,
        control=effective_params.get("control", True),
        locked_video_orientation=effective_params.get("locked_video_orientation", -1),
    )

    # Connect with effective params
    device = await self.device_manager.connect_device(serial, server_params, self.adb_path)
```

✅ **DEVICE CONNECTION USES CONFIG CORRECTLY**:
- Merges global + device-specific + request overrides
- Config is read at connection time

🔴 **BUT**: Once connected, device parameters are immutable until reconnection

---

## 6. Configuration Validation

### 6.1 Frontend Validation (`configService.ts`)

❌ **NO VALIDATION**: Frontend accepts any value for config updates
- No range checks (e.g., max_fps must be > 0)
- No enum validation (e.g., codec must be h264/h265/av1)
- No compatibility checks (e.g., hwaccel options for different platforms)

### 6.2 Backend Validation (`config_service.py`)

```python
def _sanitise_payload(self, payload: Dict) -> Dict:
    """Return allowed keys with non-null values."""
    if not payload:
        return {}
    return {
        key: value
        for key, value in payload.items()
        if key in self._ALLOWED_KEYS and value is not None
    }

_ALLOWED_KEYS = {
    "max_size",
    "bit_rate",
    "max_fps",
    "codec",
    "control",
    "locked_video_orientation",
    "video_stream_mode",
}
```

⚠️ **LIMITED VALIDATION**:
- Only checks if keys are allowed
- No value range validation
- No type checking
- Invalid values can be persisted

---

## 7. Race Conditions & Edge Cases

### 7.1 Rapid Mode Switching

**Scenario**: User switches h264 → yuv → h264 quickly

**Frontend Behavior**:
```typescript
// First switch: h264 → yuv
configService.updateConfig({ video_stream_mode: 'yuv' }); // 500ms reconnect timer starts

// Second switch: yuv → h264 (before 500ms elapses)
configService.updateConfig({ video_stream_mode: 'h264' }); // Previous timer still pending

// Result: Two reconnection attempts may race
```

✅ **HANDLED**: useVideoStream clears pending timeout:
```typescript
// Clear any pending reconnect timeout
if (reconnectTimeoutRef.current) {
  clearTimeout(reconnectTimeoutRef.current);
  reconnectTimeoutRef.current = null;
}
```

### 7.2 Config Update During Active Stream

**Scenario**: User changes bitrate while video is streaming

**Current Behavior**:
1. Frontend sends update to backend ✅
2. Backend persists to disk ✅
3. Frontend refreshes config ✅
4. **Active stream continues with old bitrate** ❌

**Why?**: Video stream service doesn't listen to config changes

---

## 8. Missing Features & Gaps

### 8.1 Stream Parameter Hot-Reload

❌ **NOT IMPLEMENTED**: No way to change stream parameters without reconnection
- Backend could support quality adjustment via control channel
- scrcpy-server may need restart for some params

### 8.2 Config Change Notifications

❌ **NO THREAD_BUS INTEGRATION**: Backend doesn't broadcast config changes
```python
# Recommended: Add to config_service.py
async def update_global(self, payload: Dict) -> Dict:
    # ... existing code ...

    if "video_stream_mode" in updates:
        # Broadcast to all active connections
        from pycore.pythread_bus import THREAD_BUS
        THREAD_BUS.emit('config.mode_changed', {
            'old_mode': old_mode,
            'new_mode': new_mode
        })

    return new_config
```

### 8.3 Config Rollback on Failure

❌ **NO ROLLBACK**: If stream fails to start with new config, old config is lost
- Should validate config before applying
- Should rollback on stream startup failure

---

## 9. Recommendations

### Priority 1: Critical Fixes

1. **Add Config Change Broadcast** (Backend)
   ```python
   # In config_service.py
   async def update_global(self, payload: Dict) -> Dict:
       # After successful update
       THREAD_BUS.emit('config.changed', {
           'old_config': old_config,
           'new_config': new_config
       })
   ```

2. **Add Stream Restart Mechanism** (Backend)
   ```python
   # In video_stream_service.py
   async def restart_stream(self, serial: str, reason: str):
       """Gracefully restart stream with new config"""
       # 1. Stop current stream
       await self.force_stop_stream(serial, reason)

       # 2. Get latest config
       config = await ConfigService.instance().get_global()

       # 3. Reconnect device with new config
       # ... (delegate to device_service)
   ```

3. **Add Config Validation** (Both)
   ```python
   # Backend
   def validate_config(self, config: Dict) -> Tuple[bool, Optional[str]]:
       if config.get('max_fps', 0) <= 0:
           return False, "max_fps must be > 0"
       # ... more checks
       return True, None
   ```

### Priority 2: Enhancements

4. **Add Stream Health Monitoring for Config Changes**
   - Detect when stream quality doesn't match config
   - Auto-restart if mismatch persists

5. **Add Config History/Rollback**
   - Keep last N configs in memory
   - Allow rollback if new config causes issues

6. **Add Per-Stream Config Override**
   - Allow temporary config changes per stream
   - Don't persist unless user confirms

### Priority 3: Nice-to-Have

7. **Add Config Presets**
   - "High Quality", "Balanced", "Low Latency"
   - Quick switching without manual tuning

8. **Add Config Export/Import**
   - Backup/restore user settings
   - Share configs between machines

---

## 10. Conclusion

### Overall Assessment

**Configuration Sync**: ✅ Working correctly
- Frontend-backend sync is reliable
- Persistence is solid
- Read-after-write consistency is maintained

**Mode Switching**: ⚠️ Works but fragile
- Frontend detection is correct
- Auto-reconnect logic is sound
- Backend doesn't participate in mode changes

**Stream Consistency**: 🔴 Broken
- Config changes don't affect running streams
- No way to hot-reload stream parameters
- Manual reconnection required

### Key Takeaway

The configuration system itself is well-designed and works correctly. The main issue is that **video streams don't react to config changes** because:
1. Backend doesn't notify streams of config updates
2. Stream parameters are fixed at connection time
3. Frontend relies on component remount for reconnection (fragile)

The system needs a **"config changed, restart streams"** mechanism to be truly consistent.

---

**End of Analysis**
