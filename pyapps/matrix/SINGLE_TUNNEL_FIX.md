# Single Tunnel Fix - Official scrcpy Pattern

**Date**: 2025-12-17
**Status**: ✅ **APPLIED** - Critical control socket fix

---

## Root Cause Discovery

After scanning QtScrcpy source code and official scrcpy documentation, discovered:

**Official scrcpy uses ONE tunnel for BOTH video and control sockets, not two!**

### Official Pattern (from scrcpy source code)

**FORWARD Mode** (`adb.c` lines 249-270, `server.c` lines 628-682):
```c
// 1. Create ONE forward tunnel
adb forward tcp:PORT localabstract:scrcpy_<SCID>

// 2. Connect video socket to localhost:PORT (1st connection)
video_socket = connect_to_server(tunnel_host, tunnel_port);

// 3. Connect control socket to localhost:PORT (2nd connection, SAME port)
control_socket = net_socket();
net_connect(&control_socket, tunnel_host, tunnel_port);  // SAME PORT!
```

**REVERSE Mode** (similar pattern):
```c
// 1. Create ONE reverse tunnel
adb reverse localabstract:scrcpy_<SCID> tcp:PORT

// 2. PC listens on ONE port
listen_socket.bind(PORT);
listen_socket.listen();

// 3. Accept twice on SAME listening socket
video_socket = listen_socket.accept();    // 1st accept
control_socket = listen_socket.accept();  // 2nd accept, SAME socket
```

---

## The Bug in Our Implementation

### Before Fix (WRONG):

**File**: `pycore/pyutils/device/scrcpy_device.py`

**Lines 224-228** (WRONG):
```python
# Find free ports for video and control
video_port = self._find_free_port()
control_port = self._find_free_port()  # ❌ ALLOCATES DIFFERENT PORT!
```

**Line 240** (creates ONE tunnel):
```python
tunnel_mode = self._setup_tunnel(video_port, device_socket_name)
# Only creates: adb forward tcp:VIDEO_PORT localabstract:scrcpy_<SCID>
```

**Line 362** (tries to connect to different port):
```python
self._control_socket.connect(('localhost', control_port))  # ❌ NO TUNNEL FOR THIS PORT!
```

**Result**: Control socket hangs because there's no tunnel for `control_port`.

---

## The Fix (CORRECT)

### After Fix:

**Lines 223-229** (FIXED):
```python
# Find free port for tunnel (single tunnel carries both video and control)
# Official scrcpy pattern: ONE forward tunnel, both sockets connect to same local port
video_port = self._find_free_port()
# CRITICAL: In official scrcpy, control socket uses SAME port as video socket
# Both connections route through single tunnel to device's abstract socket
# The device accepts multiple sequential connections on same abstract socket
control_port = video_port  # Same port for both video and control
```

**Line 240** (creates ONE tunnel):
```python
tunnel_mode = self._setup_tunnel(video_port, device_socket_name)
# Creates: adb forward tcp:VIDEO_PORT localabstract:scrcpy_<SCID>
```

**Line 310** (video socket connects):
```python
self._video_socket.connect(('localhost', video_port))  # 1st connection
```

**Line 362** (control socket connects to SAME port):
```python
self._control_socket.connect(('localhost', control_port))
# Since control_port = video_port, this connects to SAME port (2nd connection)
```

**Result**: Both sockets route through single tunnel, matching official scrcpy behavior.

---

## How It Works

### Single Tunnel Architecture:

```
PC Side                         Device Side
-------                         -----------

1. Create tunnel:
   adb forward tcp:64641 -----> localabstract:scrcpy_12345678
                                 (device listens on abstract socket)

2. Video connection:
   socket.connect(64641) -----> (routes through tunnel) -----> device accepts 1st connection

3. Control connection:
   socket.connect(64641) -----> (routes through tunnel) -----> device accepts 2nd connection
   (SAME port 64641!)

Both connections share the single forward tunnel.
Device's abstract socket accepts multiple sequential connections.
```

### Key Insight:

The device opens **ONE** abstract socket (`localabstract:scrcpy_<SCID>`) and accepts **multiple connections** on it:
1. First connection → video socket
2. Second connection → control socket
3. Third connection → audio socket (if enabled)

The PC connects multiple times to the **SAME local port**, and each connection routes through the **SAME tunnel** to reach the device's abstract socket.

---

## Test Results Expected

### Before Fix:
```
[ScrcpyDevice] [OK] Video socket connected to device (FORWARD)
[ScrcpyDevice] Read dummy byte in FORWARD mode: empty
[ScrcpyDevice] Connecting to forwarded control port 64641...
❌ HANGS (no tunnel for control_port)
```

### After Fix:
```
[ScrcpyDevice] [OK] Video socket connected to device (FORWARD)
[ScrcpyDevice] Read dummy byte in FORWARD mode: <byte>
[ScrcpyDevice] Connecting to forwarded control port 64641...
[ScrcpyDevice] [OK] Control socket connected to device (FORWARD)
✅ SUCCESS - Both sockets connected through single tunnel
```

---

## Files Modified

1. **pycore/pyutils/device/scrcpy_device.py**
   - Lines 223-229: Changed `control_port` allocation to use same port as `video_port`
   - Line 238: Updated logging to reflect single tunnel pattern

---

## Technical Details

### Why Two Ports Doesn't Work:

```
❌ WRONG:
video_port = 64641
control_port = 64642  (different!)

Tunnel created: adb forward tcp:64641 -> localabstract:scrcpy_12345678
Video connects: localhost:64641 ✅ (has tunnel)
Control connects: localhost:64642 ❌ (NO tunnel for this port!)
```

### Why Same Port Works:

```
✅ CORRECT:
video_port = 64641
control_port = 64641  (SAME!)

Tunnel created: adb forward tcp:64641 -> localabstract:scrcpy_12345678
Video connects: localhost:64641 ✅ (1st connection through tunnel)
Control connects: localhost:64641 ✅ (2nd connection through SAME tunnel)
```

---

## Reference Sources

1. **Official scrcpy source code**:
   - `D:\programing\core_node\pyapps\matrix\scrcpy_source\app\src\adb\adb_tunnel.c` (lines 78-114)
   - `D:\programing\core_node\pyapps\matrix\scrcpy_source\app\src\server.c` (lines 628-682)

2. **QtScrcpy implementation**:
   - Follows same pattern as official scrcpy
   - Single tunnel for both video and control

3. **Scan results**:
   - Task agent `ae06676` completed comprehensive scan of 20+ files
   - Confirmed single-tunnel pattern across all implementations

---

## Conclusion

**Problem**: Allocated two different ports and created only one tunnel, causing control socket to hang.

**Solution**: Use same port for both video and control sockets, matching official scrcpy pattern.

**Result**: Both sockets route through single tunnel, enabling successful connection.

**Ready for testing with 19 devices!** 🚀
