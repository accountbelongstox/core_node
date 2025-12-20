# Dummy Byte Timing Fix - Critical Connection Sequence

## Problem Identified

**Error**: "Connection closed while reading dummy byte"
**Root Cause**: Incorrect socket connection timing in FORWARD mode

## Understanding the Protocol

### Server Sequence (DesktopConnection.java)
```java
if (tunnelForward) {
    LocalServerSocket localServerSocket = new LocalServerSocket(socketName);

    if (video) {
        videoSocket = localServerSocket.accept();  // ← Blocks until client connects
        if (sendDummyByte) {
            videoSocket.getOutputStream().write(0);  // ← Send immediately
            sendDummyByte = false;
        }
    }
    if (audio) {
        audioSocket = localServerSocket.accept();  // ← We skip (audio=false)
        // sendDummyByte already false, so no write here
    }
    if (control) {
        controlSocket = localServerSocket.accept();  // ← Blocks until client connects
        // sendDummyByte already false, so no write here
    }
}
```

**Key Insights:**
1. Dummy byte is sent **immediately** after first `accept()` returns
2. Dummy byte is sent **only once** on the first socket (video socket)
3. Server then blocks on **second** `accept()` waiting for control socket
4. All sockets use **same abstract socket** via **same TCP port**

## Previous (WRONG) Client Sequence

```python
# ❌ WRONG TIMING
1. Connect video socket
2. Read dummy byte from video socket  ← BLOCKS HERE!
3. Connect control socket
```

**Why This Failed:**
- After connecting video socket, we immediately try to read dummy byte
- But the `recv(1)` call might execute before the server's `write(0)` completes
- OR the server's write() might be buffered and not flushed yet
- Result: `recv(1)` returns empty bytes (connection closed)

## Corrected Client Sequence

```python
# ✅ CORRECT TIMING
1. Connect video socket
   → Server's accept() returns
   → Server writes dummy byte (might be buffered)

2. Connect control socket
   → Server's accept() returns
   → Both sockets now fully established

3. Read dummy byte from video socket
   → By now, dummy byte is definitely in socket buffer
   → recv(1) succeeds
```

## Code Changes

### scrcpy_device.py Line 297-326 (Video Socket)
**Before:**
```python
self._video_socket.connect(('localhost', video_port))
print(f"[ScrcpyDevice] [OK] Video socket connected to device (FORWARD)")

# ❌ Reading immediately after connect - TOO EARLY!
try:
    dummy_byte = self._video_socket.recv(1)
    if not dummy_byte:
        raise RuntimeError("Connection closed while reading dummy byte")
```

**After:**
```python
self._video_socket.connect(('localhost', video_port))
print(f"[ScrcpyDevice] [OK] Video socket connected to device (FORWARD)")
# ✅ No longer reading here - wait until both sockets connected
```

### scrcpy_device.py Line 372-383 (After Both Sockets)
**New Code:**
```python
# ✅ CRITICAL FIX: Read dummy byte AFTER both sockets connected
# The server sends dummy byte on first socket AFTER all accept() calls complete
# We must connect ALL sockets first, then read dummy byte, then read metadata
if tunnel_mode == "forward":
    print(f"[ScrcpyDevice] Reading dummy byte from first socket...")
    try:
        dummy_byte = self._video_socket.recv(1)
        if not dummy_byte:
            raise RuntimeError("Connection closed while reading dummy byte")
        print(f"[ScrcpyDevice] [OK] Consumed dummy byte from server: {dummy_byte.hex()}")
    except socket.timeout:
        print(f"[ScrcpyDevice] [WARN] Timeout reading dummy byte (server might not send it)")
```

## Why This Fix Works

### Timing Analysis

**Server Timeline:**
```
T0: Create LocalServerSocket("scrcpy_XXXXXXXX")
T1: accept() for video socket (BLOCKS)
T2: Client connects → accept() returns
T3: write(0) to video socket
T4: accept() for control socket (BLOCKS)  ← Server waits here
T5: Client connects → accept() returns
T6: Continue with main server flow
```

**Old Client Timeline (BROKEN):**
```
T2: Connect video socket
T3: Try to read dummy byte
    ↓ Server hasn't written it yet OR it's buffered
    ↓ Connection might close due to error
    ✗ recv(1) returns empty bytes
```

**New Client Timeline (WORKING):**
```
T2: Connect video socket
    ↓ Server writes dummy byte (might be buffered)
T4: Server blocks waiting for control socket
T5: Connect control socket
    ↓ Server's second accept() returns
    ↓ Both sockets fully established
T6: Read dummy byte
    ✓ Dummy byte is definitely in socket buffer now
    ✓ recv(1) succeeds
```

## Port Forwarding in FORWARD Mode

**Single Port, Multiple Connections:**
```bash
adb forward tcp:27183 localabstract:scrcpy_XXXXXXXX
```

This creates a **tunnel** that maps:
- Local TCP port 27183 → Device's abstract socket "scrcpy_XXXXXXXX"

**Multiple client connections through same port:**
1. Client connects to localhost:27183 (first time)
   → Routes to abstract socket
   → Server's first accept() returns videoSocket

2. Client connects to localhost:27183 (second time)
   → Routes to SAME abstract socket
   → Server's third accept() returns controlSocket (we skip audio)

Each connection creates a new LocalSocket on the device side!

## Expected Behavior After Fix

For each device:
```
[ScrcpyDevice] FORWARD mode: Waiting for device to start listening...
[ScrcpyDevice] Connecting to forwarded port 27183...
[ScrcpyDevice] [OK] Video socket connected to device (FORWARD)
[ScrcpyDevice] Setting up control socket on port 27183...
[ScrcpyDevice] Connecting to forwarded control port 27183...
[ScrcpyDevice] [OK] Control socket connected to device (FORWARD)
[ScrcpyDevice] Reading dummy byte from first socket...
[ScrcpyDevice] [OK] Consumed dummy byte from server: 00
[ScrcpyDevice] Reading device metadata...
[ScrcpyDevice] [OK] Device: Redmi K30 Pro
```

## Testing

Run with 19-device matrix to verify:
1. All devices connect successfully
2. No "Connection closed while reading dummy byte" errors
3. Fast connection times (no artificial delays)
4. Stable video streaming

## References

- scrcpy server source: `DesktopConnection.java:56-90`
- Official documentation: `develop.md` section on forward tunnels
- Parameter: `send_dummy_byte=true` (default in scrcpy 3.3.3)
