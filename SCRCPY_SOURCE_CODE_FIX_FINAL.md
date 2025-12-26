# Scrcpy Source Code Analysis & Fix Summary

## Problem Overview

The scrcpy-server connection in FORWARD mode was failing with:
```
RuntimeError: Connection closed while reading dummy byte from first socket (FORWARD mode)
```

## Root Cause Analysis (From Source Code)

### 1. PRIMARY ISSUE: SCID Parameter Format

**Source**: `poly_apps/scrcpy/server/src/main/java/com/genymobile/scrcpy/Options.java:315`

```java
case "scid":
    int scid = Integer.parseInt(value, 0x10);  // 0x10 = 16 (hexadecimal radix)
```

**Problem**:
- Server expects **hexadecimal string** (e.g., "1a2b3c4d")
- We were passing **decimal integer** (e.g., "1038041919")
- Result: `NumberFormatException` → Server failed to start

**Fix**:
```python
# Generate SCID as hexadecimal string
scid = random.randint(0, 0x7FFFFFFF)
scid_hex = f"{scid:08x}"  # e.g., "1a2b3c4d"

# Pass hex string to server
cmd = [..., f"scid={scid_hex}", ...]  # CRITICAL: Must be hex string!
```

### 2. SECONDARY ISSUE: tunnel_forward Parameter Logic

**Source**: `poly_apps/scrcpy/server/src/main/java/com/genymobile/scrcpy/device/DesktopConnection.java:64-101`

```java
public static DesktopConnection open(..., boolean tunnelForward, ...) {
    if (tunnelForward) {
        // Server creates LocalServerSocket and WAITS for connections
        LocalServerSocket localServerSocket = new LocalServerSocket(socketName);
        videoSocket = localServerSocket.accept();
        if (sendDummyByte) {
            videoSocket.getOutputStream().write(0);  // Send dummy byte
            sendDummyByte = false;
        }
        // ... accept audio, control sockets
    } else {
        // Server CONNECTS to socket as client
        videoSocket = connect(socketName);
        // No dummy byte sent
    }
}
```

**Parameter Meaning**:
- `tunnel_forward=true` → FORWARD mode (adb forward) → Server WAITS → Dummy byte IS sent
- `tunnel_forward=false` → REVERSE mode (adb reverse) → Server CONNECTS → NO dummy byte

**Fix**:
```python
if tunnel_mode == "forward":
    cmd.append("tunnel_forward=true")  # Server waits and sends dummy byte
# For reverse mode, omit parameter (defaults to false)
```

### 3. Connection Sequence in FORWARD Mode

**Source**: `DesktopConnection.java:64-90`

Server accepts sockets **sequentially** using a **single** `LocalServerSocket`:

```java
try (LocalServerSocket localServerSocket = new LocalServerSocket(socketName)) {
    if (video) {
        videoSocket = localServerSocket.accept();  // 1st connection
        if (sendDummyByte) {
            videoSocket.getOutputStream().write(0);  // Send dummy byte
            sendDummyByte = false;  // Only send once
        }
    }
    if (audio) {
        audioSocket = localServerSocket.accept();  // 2nd connection
        // No dummy byte (already sent)
    }
    if (control) {
        controlSocket = localServerSocket.accept();  // 3rd connection
        // No dummy byte (already sent)
    }
}  // LocalServerSocket closes here (but connections remain alive)
```

**Client Connection Sequence (video=true, audio=false, control=true)**:

```
1. PC connects video socket    → Server accepts
2. Server sends dummy byte      → PC MUST read it immediately
3. PC connects control socket   → Server accepts
4. LocalServerSocket closes     → Connections stay alive
5. Server sends device metadata → PC reads from video socket
```

**Fix**:
```python
# After connecting video socket in FORWARD mode
if tunnel_mode == "forward":
    # MUST read dummy byte before connecting control socket
    dummy_byte = self._video_socket.recv(1)
    if not dummy_byte:
        raise RuntimeError("Connection closed while reading dummy byte")

# Then connect control socket
```

## Android 7.0 Compatibility Requirements

From source code analysis and testing on SM-G9200 (Android 7.0):

### 1. CLASSPATH Must Be Relative Path
```bash
cd /data/local/tmp && CLASSPATH=scrcpy-server app_process . ...
# NOT: CLASSPATH=/data/local/tmp/scrcpy-server
```

### 2. File Name Without .jar Extension
```bash
# Push file as: scrcpy-server (NOT scrcpy-server.jar)
adb push scrcpy-server.jar /data/local/tmp/scrcpy-server

# Use in CLASSPATH: scrcpy-server
CLASSPATH=scrcpy-server
```

### 3. SCID Must Be 8-Digit Hex String
```bash
scid=1a2b3c4d  # Hexadecimal string
# NOT: scid=445206861  # Decimal integer
```

### 4. Limited Parameter Support on Android 7.0
```bash
# Safe parameters (tested on Android 7.0):
scid=<hex_string>
log_level=debug
audio=false
max_size=720
tunnel_forward=true

# UNSAFE parameters (cause "Aborted" crash):
max_fps=60          # NOT supported on Android 7.0
video_bit_rate=...  # NOT supported on Android 7.0
video_codec=h264    # NOT supported on Android 7.0
```

## Dummy Byte Protocol (From Official Documentation)

**Source**: https://github.com/genymobile/scrcpy/blob/master/doc/develop.md

> "On the _first_ socket opened (whichever it is), if the tunnel is _forward_, then
> a [dummy byte] is sent from the device to the client."

**Key Points**:
1. Dummy byte is sent **only in FORWARD mode** (`tunnel_forward=true`)
2. Sent on **first socket only** (video, audio, or control - whichever connects first)
3. Sent **immediately after accept()** completes
4. Client **must read it** before the socket can be used for normal data
5. Purpose: Detect connection errors early (PC connection succeeds even if device isn't listening)

## Implementation Fixes

### File: `pycore/pyutils/device/scrcpy_device.py`

#### Fix 1: Generate SCID as Hex String (Line 237-242)
```python
# Generate random SCID (Session ID)
scid = random.randint(0, 0x7FFFFFFF)  # 31-bit random number
scid_hex = f"{scid:08x}"  # e.g., "1a2b3c4d"
# CRITICAL: Both device socket name AND scid parameter use hex format!
# Server parses scid with Integer.parseInt(value, 0x10) - expects hex string!
device_socket_name = f"scrcpy_{scid_hex}"  # e.g., scrcpy_1a2b3c4d
```

#### Fix 2: Pass Hex SCID to Server Command (Line 734-760)
```python
def _build_server_command(self, scid_hex: str, tunnel_mode: str) -> list:
    """
    Args:
        scid_hex: Session ID in 8-digit hex format (e.g., "1a2b3c4d")
        tunnel_mode: "reverse" or "forward"
    """
    cmd = [
        "cd", "/data/local/tmp", "&&",
        "CLASSPATH=scrcpy-server",
        "app_process",
        ".",
        "com.genymobile.scrcpy.Server",
        "3.3.3",
        f"scid={scid_hex}",  # CRITICAL: Must be HEX string!
        "log_level=debug",
        "audio=false",
        f"max_size={self.params.max_size}",
    ]
    # ...
```

#### Fix 3: Read Dummy Byte in FORWARD Mode (Line 335-353)
```python
elif tunnel_mode == "forward":
    # Connect video socket
    self._video_socket.connect(('localhost', video_port))

    # FORWARD mode uses tunnel_forward=true
    # According to DesktopConnection.java:68-71, when tunnel_forward=true:
    # - Server creates LocalServerSocket and waits
    # - After accept(), dummy byte IS sent on first socket
    # So we MUST read the dummy byte here
    print(f"[ScrcpyDevice] Reading dummy byte from first socket (FORWARD mode)...")
    import select
    ready_sockets, _, _ = select.select([self._video_socket], [], [], 5.0)

    if not ready_sockets:
        print(f"[ScrcpyDevice] [ERROR] Timeout waiting for dummy byte!")
        raise RuntimeError("Timeout waiting for dummy byte from first socket")

    dummy_byte = self._video_socket.recv(1)
    if not dummy_byte:
        print(f"[ScrcpyDevice] [ERROR] Connection closed while reading dummy byte!")
        raise RuntimeError("Connection closed while reading dummy byte")

    print(f"[ScrcpyDevice] [OK] Dummy byte received: {dummy_byte.hex()}")
```

#### Fix 4: Correct tunnel_forward Parameter (Line 784-801)
```python
# CRITICAL: tunnel_forward parameter controls server socket behavior
# Based on official scrcpy source code analysis (DesktopConnection.java:64-101):
#   - tunnel_forward=true  → Server creates LocalServerSocket and WAITS (FORWARD mode)
#   - tunnel_forward=false → Server CONNECTS to socket as client (REVERSE mode)
#
# Tunnel modes explained correctly:
#   - FORWARD mode (adb forward): PC CONNECTS to localhost:PORT → ADB forwards to device
#     → Device server WAITS (LocalServerSocket.accept()) → tunnel_forward=true
#     → Dummy byte IS sent after accept()
#   - REVERSE mode (adb reverse): PC LISTENS on localhost:PORT ← ADB forwards from device
#     → Device server CONNECTS (LocalSocket.connect()) → tunnel_forward=false
#     → NO dummy byte
#
if tunnel_mode == "forward":
    cmd.append("tunnel_forward=true")
    # Server creates LocalServerSocket and waits for PC to connect via adb forward tunnel
    # Dummy byte is sent after accept() on first socket
```

## OTG Mode & Root Mode (Not Related to This Fix)

### OTG Mode (USB On-The-Go)
- Used for USB peripheral control (keyboard/mouse emulation)
- Does NOT involve video streaming
- Does NOT use scrcpy-server
- Uses HID (Human Interface Device) protocol
- **Not related to SCID parameter parsing or dummy byte protocol**

### Root Mode
- Affects permissions for:
  - Screen recording (Android 10+)
  - Audio capture (Android 11+)
  - System-level control
- For **Android 7.0**: Root is NOT required for basic scrcpy operation
- **Does NOT change scrcpy-server parameter parsing logic**
- **Does NOT affect dummy byte sending/receiving**

## Verification Scripts Created

### 1. `debug_server_startup.py`
- Full connection test including dummy byte and metadata reading
- Shows server stderr output in real-time
- Verifies correct SCID format and connection sequence

### 2. `debug_server_simple.py`
- Simple server startup test
- Captures stderr to diagnose startup failures
- Helped identify the SCID parsing error

## Key Takeaways

1. **Always check source code** for parameter parsing logic
2. **SCID must be hexadecimal string**, not decimal integer
3. **Dummy byte is sent in FORWARD mode** (`tunnel_forward=true`)
4. **Must read dummy byte** before connecting additional sockets
5. **Connection sequence matters**: video → dummy byte → control → metadata
6. **Android 7.0 has limited parameter support** - avoid max_fps, video_bit_rate, video_codec

## Files Modified

- `pycore/pyutils/device/scrcpy_device.py` - Main implementation file

## Documentation Created

- `SCRCPY_FORWARD_MODE_FIX_SUMMARY.md` - Detailed problem analysis (Chinese)
- `SCRCPY_CONNECTION_SEQUENCE_ANALYSIS.md` - Connection sequence analysis
- `SCRCPY_SOURCE_CODE_FIX_FINAL.md` - This file (English summary)

## Source Code References

- `poly_apps/scrcpy/server/src/main/java/com/genymobile/scrcpy/Options.java`
- `poly_apps/scrcpy/server/src/main/java/com/genymobile/scrcpy/device/DesktopConnection.java`
- `poly_apps/scrcpy/server/src/main/java/com/genymobile/scrcpy/Server.java`
- Official documentation: https://github.com/genymobile/scrcpy/blob/master/doc/develop.md
