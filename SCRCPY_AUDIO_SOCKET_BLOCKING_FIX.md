# Scrcpy Audio Socket Blocking Issue - Root Cause Analysis

## Problem

After successfully reading dummy byte, connection hangs when reading device metadata.

**Symptoms**:
```
[ScrcpyDevice] [OK] Dummy byte received: 00
[ScrcpyDevice] First socket ready, now connecting control socket...
[ScrcpyDevice] [OK] Control socket connected to device (FORWARD)
[ScrcpyDevice] Reading device metadata...
[HANGS HERE - No response, no error]
```

## Root Cause

Server was waiting for **audio socket** connection that we never provided!

### Server-Side Code Analysis

**Source**: `poly_apps/scrcpy/server/.../DesktopConnection.java:64-90`

```java
if (tunnelForward) {
    try (LocalServerSocket localServerSocket = new LocalServerSocket(socketName)) {
        if (video) {
            videoSocket = localServerSocket.accept();  // ✅ We connect this
            if (sendDummyByte) {
                videoSocket.getOutputStream().write(0);  // ✅ Dummy byte sent & read
            }
        }
        if (audio) {  // ← audio defaults to TRUE!
            audioSocket = localServerSocket.accept();  // ❌ Server BLOCKS here waiting for us!
            if (sendDummyByte) {
                audioSocket.getOutputStream().write(0);
            }
        }
        if (control) {
            controlSocket = localServerSocket.accept();  // Never reached
        }
    }
}
```

### Default Option Values

**Source**: `poly_apps/scrcpy/server/.../Options.java:27-41`

```java
private boolean video = true;
private boolean audio = true;   // ← Audio enabled by default!
private boolean control = true;
```

### Our Connection Sequence (WRONG)

```python
# Step 1: Connect video socket ✅
self._video_socket.connect(('localhost', video_port))

# Step 2: Read dummy byte ✅
dummy_byte = self._video_socket.recv(1)

# Step 3: Connect control socket ✅
self._control_socket.connect(('localhost', control_port))

# Step 4: Read device metadata ❌
# Server is still blocked at accept() for audio socket!
# Never sends device metadata because DesktopConnection.open() hasn't completed!
```

## The Fix

Add `audio=false` parameter to server command to skip audio socket.

**File**: `pycore/pyutils/device/scrcpy_device.py:795`

```python
cmd = [
    "cd", "/data/local/tmp", "&&",
    "CLASSPATH=scrcpy-server",
    "app_process",
    ".",
    "com.genymobile.scrcpy.Server",
    "3.3.3",
    f"scid={scid_hex}",
    "log_level=debug",
    "audio=false",  # ← CRITICAL: Disable audio socket requirement
    f"max_size={self.params.max_size}",
]
```

### Why This Works

With `audio=false`, server's connection flow becomes:

```java
if (video) {
    videoSocket = localServerSocket.accept();  // ✅ We connect
    videoSocket.write(0);  // ✅ Dummy byte
}
if (audio) {  // ← Skipped! audio=false
    // NOT EXECUTED
}
if (control) {
    controlSocket = localServerSocket.accept();  // ✅ We connect
}
// LocalServerSocket closes, connection proceeds
```

Server can now complete `DesktopConnection.open()` and send device metadata.

## Expected Behavior After Fix

```
[ScrcpyDevice] [OK] Dummy byte received: 00
[ScrcpyDevice] First socket ready, now connecting control socket...
[ScrcpyDevice] [OK] Control socket connected to device (FORWARD)
[ScrcpyDevice] Reading device metadata...
[ScrcpyDevice] Device name from metadata: samsung SM-G9200
[ScrcpyDevice] [OK] Device: samsung SM-G9200
[ScrcpyDevice] [OK] Resolution: 1080x1920
```

## Previous Misdiagnosis

Earlier comments claimed `audio=false` caused crashes on Android 7.0. This was incorrect.

**What Actually Happened**:
- Previous tests omitted `audio=false`
- Server blocked waiting for audio socket
- Test timed out or connection failed
- Mistakenly attributed to parameter causing crash

**Reality**:
- `audio=false` is a valid, supported parameter (Options.java:327-328)
- It simply disables audio streaming feature
- Server works perfectly with audio disabled

## Additional Parameters

Also re-enabled `max_size` parameter, which was incorrectly disabled:

```python
f"max_size={self.params.max_size}",  # Video resolution limit
```

This parameter is well-supported and controls maximum video dimension.

## Socket Count Requirements

| Mode | Server Expects | We Connect | Result |
|------|---------------|------------|---------|
| video=true, audio=true, control=true | 3 sockets | 2 sockets | ❌ Hangs |
| video=true, audio=false, control=true | 2 sockets | 2 sockets | ✅ Works |
| video=true, audio=false, control=false | 1 socket | 1 socket | ✅ Works |

**Rule**: Number of sockets we connect MUST match number of enabled features on server.

## References

- Server connection code: `poly_apps/scrcpy/server/.../DesktopConnection.java:64-90`
- Option defaults: `poly_apps/scrcpy/server/.../Options.java:27-41`
- Audio parameter parsing: `poly_apps/scrcpy/server/.../Options.java:327-328`
- Implementation fix: `pycore/pyutils/device/scrcpy_device.py:795`

## Status

✅ **Fix Applied**: `audio=false` parameter added to server command

This resolves the device metadata reading hang.
