# Scrcpy Connection Closed Issue - Root Cause Analysis

## Symptom

```
[ScrcpyDevice] [OK] Video socket connected to device (FORWARD)
[ScrcpyDevice] Reading dummy byte from first socket (FORWARD mode)...
[ScrcpyDevice] [ERROR] Connection closed while reading dummy byte from first socket!
```

- Connection succeeds ✓
- But recv(1) returns 0 bytes → **Server closed the connection**

## Critical Discovery from Source Code

### Problem: Server May Be Crashing Silently

With `stdout=subprocess.DEVNULL` and `stderr=subprocess.DEVNULL`, we **cannot see** if the server is crashing!

### Possible Causes

#### 1. Server Exception After Sending Dummy Byte

From `DesktopConnection.java:64-90`:
```java
try (LocalServerSocket localServerSocket = new LocalServerSocket(socketName)) {
    videoSocket = localServerSocket.accept();
    videoSocket.getOutputStream().write(0);  // Dummy byte sent

    controlSocket = localServerSocket.accept();  // If this throws exception...
}  catch (IOException e) {
    // Exception causes try block to exit
    // LocalServerSocket closes
    // All accepted sockets may be affected!
}
```

If `accept()` for control socket throws an exception, the try-with-resources block exits, closing everything.

#### 2. Android 7.0 Parameter Incompatibility

Our command:
```bash
scid=078f40fd log_level=debug audio=false max_size=720 tunnel_forward=true
```

What if `log_level=debug` or another parameter is **not supported** on Android 7.0 and causes immediate crash?

#### 3. Server Process Exit

If server process exits for ANY reason (crash, unhandled exception, etc.), all sockets close immediately.

## Recommended Diagnostic Steps

### Step 1: Capture Server Output Temporarily

Modify `scrcpy_device.py` line 284-289 **temporarily** for diagnosis:

```python
# TEMPORARY for debugging - will cause buffer blocking but we need to see errors!
self._server_process = subprocess.Popen(
    adb_cmd,
    env=env,
    stdout=subprocess.PIPE,  # TEMP: Capture output
    stderr=subprocess.PIPE,  # TEMP: Capture output
    stdin=subprocess.DEVNULL
)

# Immediately start reading in separate thread to prevent blocking
import threading
def read_output(pipe, name):
    for line in iter(pipe.readline, b''):
        print(f"[SERVER-{name}] {line.decode('utf-8', errors='ignore').rstrip()}")

threading.Thread(target=read_output, args=(self._server_process.stdout, "OUT"), daemon=True).start()
threading.Thread(target=read_output, args=(self._server_process.stderr, "ERR"), daemon=True).start()
```

This will show **exactly** what error the server is producing.

### Step 2: Simplify Server Parameters

Try minimal parameters to isolate the issue:

```python
cmd = [
    "cd", "/data/local/tmp", "&&",
    "CLASSPATH=scrcpy-server",
    "app_process",
    ".",
    "com.genymobile.scrcpy.Server",
    "3.3.3",
    f"scid={scid_hex}",
    # Remove all other parameters to test
]
```

If this works, add parameters one by one to find which causes the crash.

### Step 3: Test Different log_level Values

```python
# Try these one at a time:
"log_level=info"    # Less verbose
"log_level=warn"    # Even less
"log_level=error"   # Minimal
# Or omit log_level entirely (defaults to info)
```

### Step 4: Check Server Version Compatibility

Verify scrcpy-server.jar version matches:
- Server JAR version: Should be 3.3.3
- Server command version parameter: `3.3.3`

Mismatch causes immediate server exit.

### Step 5: Verify File Permissions

On Android 7.0, check if server file has execute permissions:
```bash
adb -s 192.168.31.116:5555 shell ls -l /data/local/tmp/scrcpy-server
```

Should show: `-rwxr-xr-x` (readable and executable)

## Alternative Approach: Connect Control Socket First

Based on source code, we could try connecting **both sockets before reading dummy byte**:

```python
# Connect video socket
self._video_socket.connect(('localhost', video_port))

# Connect control socket IMMEDIATELY (don't read dummy byte yet!)
self._control_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
self._control_socket.settimeout(10.0)
self._control_socket.connect(('localhost', control_port))

# NOW both sockets are connected, server is past all accept() calls
# Now read dummy byte (it was sent after first accept)
dummy_byte = self._video_socket.recv(1)
```

This ensures server completes ALL accept() calls before we try to read.

## Expected Server Behavior (When Working)

From source code, server should:
1. Create LocalServerSocket ✓
2. Accept video socket ✓
3. Send dummy byte (0x00) ✓
4. Block waiting for control socket → **This is where it should be now**
5. Accept control socket
6. LocalServerSocket closes (but connections stay alive)
7. Send device metadata on video socket

If dummy byte read fails, server never reached step 4, meaning it crashed at step 3 or earlier.

## Critical Questions to Answer

1. **Is server crashing?** → Check with PIPE output
2. **Which parameter causes crash?** → Remove parameters one by one
3. **Is it Android 7.0 specific?** → Test on newer Android
4. **Is file corrupted?** → Re-push scrcpy-server.jar

## Implementation Priority

1. **FIRST**: Add temporary PIPE output capture to see actual error
2. **SECOND**: Try minimal parameters
3. **THIRD**: Test connecting both sockets before reading dummy byte

Without seeing server output, we're debugging blindly!
