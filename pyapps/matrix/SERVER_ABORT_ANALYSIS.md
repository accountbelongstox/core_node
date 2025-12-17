# Server "Aborted" Error - Deep Analysis

**Date**: 2025-12-17
**Status**: 🔍 Root Cause Investigation Complete

---

## Problem Summary

All 19 devices fail with the same error:
```
[ScrcpyDevice] [OK] Video socket connected to device (FORWARD)
[ScrcpyDevice] [ERROR] Connection closed while reading dummy byte!
[ScrcpyDevice] [SERVER STDERR]: Aborted
```

The server accepts socket connections but immediately aborts before sending the dummy byte.

---

## Analysis of scrcpy-server Source Code

### 1. Error Handling Flow

From `Server.java` (lines 212-234):
```java
public static void main(String... args) {
    int status = 0;
    try {
        internalMain(args);
    } catch (Throwable t) {
        Ln.e(t.getMessage(), t);  // Logs exception
        status = 1;
    } finally {
        System.exit(status);  // Exits with error code
    }
}
```

**Key Insight**: When an exception occurs, it's logged via `Ln.e()` which writes to stderr, then the process exits with status 1, causing the shell to print "Aborted".

### 2. Options Parsing

From `Options.java` (lines 292-527):
```java
public static Options parse(String... args) {
    if (args.length < 1) {
        throw new IllegalArgumentException("Missing client version");
    }

    String clientVersion = args[0];
    if (!clientVersion.equals(BuildConfig.VERSION_NAME)) {
        throw new IllegalArgumentException(
            "The server version (" + BuildConfig.VERSION_NAME + ") does not match the client " + "(" + clientVersion + ")");
    }

    // Parse key=value pairs...
}
```

**Critical Check #1**: First argument MUST be "3.3.3" (matches BuildConfig.VERSION_NAME)
**Critical Check #2**: All subsequent arguments must be valid `key=value` pairs

### 3. Socket Connection Expectations

From `DesktopConnection.open()` call in `Server.java` (line 104):
```java
DesktopConnection connection = DesktopConnection.open(scid, tunnelForward, video, audio, control, sendDummyByte);
```

**Expected sockets based on parameters**:
- `video=true, audio=false, control=true`: Server expects 2 sockets (video + control)
- `video=true, audio=true, control=true`: Server expects 3 sockets (video + audio + control)

---

## My Current Command

```bash
CLASSPATH=/data/local/tmp/scrcpy-server.jar app_process / com.genymobile.scrcpy.Server 3.3.3 scid=7e232d6b log_level=debug audio=false max_size=720 max_fps=60 video_bit_rate=8000000 video_codec=h264 tunnel_forward=true
```

### Parameters Sent:
| Parameter | Value | Default | Required? | Valid? |
|-----------|-------|---------|-----------|--------|
| version | 3.3.3 | N/A | ✅ YES | ✅ Matches BuildConfig |
| scid | 7e232d6b (hex) | -1 | ✅ YES (for tunnel mode) | ✅ Valid hex |
| log_level | debug | info | ❌ NO | ✅ Valid (Options.java:322) |
| audio | false | true | ❌ NO | ✅ Valid boolean |
| max_size | 720 | 0 | ❌ NO | ✅ Valid integer |
| max_fps | 60 | 0 | ❌ NO | ⚠️ Should be float but works |
| video_bit_rate | 8000000 | 8000000 | ❌ NO | ✅ Valid integer |
| video_codec | h264 | h264 | ❌ NO | ✅ Valid codec |
| tunnel_forward | true | false | ✅ YES (FORWARD mode) | ✅ Valid boolean |

### Parameters **NOT** Sent (using defaults):
| Parameter | Default Value | Implications |
|-----------|---------------|--------------|
| **video** | **true** | ✅ Correct - we want video |
| **control** | **true** | ✅ Correct - control socket connects |
| send_dummy_byte | true | ✅ Correct - needed in FORWARD mode |
| send_device_meta | true | ✅ Correct - needed for metadata |
| send_frame_meta | true | ✅ Correct - needed for recording |
| send_codec_meta | true | ✅ Correct - needed for codec info |

---

## Possible Causes of "Aborted"

### 1. ❌ Parameter Format Error
**Likelihood**: Low
**Evidence**: All parameters match Options.java parsing logic exactly

### 2. ⚠️ Missing Required Parameter
**Likelihood**: **MEDIUM-HIGH**
**Hypothesis**: There might be an implicit requirement or parameter order issue

### 3. ⚠️ Version Mismatch
**Likelihood**: Medium
**Check**: Is scrcpy-server.jar actually version 3.3.3?
**Test**: Run `adb shell CLASSPATH=/data/local/tmp/scrcpy-server.jar app_process / com.genymobile.scrcpy.Server --version`

### 4. ⚠️ Socket Connection Timing
**Likelihood**: Medium
**Hypothesis**: Server expects control socket immediately after video socket, but we're reading dummy byte first

### 5. ⚠️ SCID Value Issue
**Likelihood**: Medium
**Check**: Is scid value being used correctly?
**From Options.java line 315**: `int scid = Integer.parseInt(value, 0x10);` (parses as hex)
**My value**: `7e232d6b` = 2116263275 decimal (within 31-bit range ✅)

### 6. ⚠️ Network Device Specific Issue
**Likelihood**: Low (all 19 devices fail identically)
**Evidence**: All devices show same error pattern

---

## The stderr Capture Problem

### Why We Only See "Aborted"

From `Ln.java` (lines 88-96):
```java
public static void e(String message, Throwable throwable) {
    if (isEnabled(Level.ERROR)) {
        Log.e(TAG, message, throwable);  // Writes to logcat
        CONSOLE_ERR.print(PREFIX + "ERROR: " + message + '\n');  // Should write to stderr
        if (throwable != null) {
            throwable.printStackTrace(CONSOLE_ERR);  // Should write stack trace
        }
    }
}
```

**Expected stderr output**:
```
[server] ERROR: <exception message>
<stack trace>
```

**Actual stderr output**:
```
Aborted
```

**Problem**: When running `adb shell CLASSPATH=... app_process ...`, the Java process's stderr might not be fully captured by the ADB client before the process exits.

---

## Recommended Next Steps

### Option 1: Capture Logcat Output (MOST RELIABLE)

Add logcat capture to see the actual Java exception:

```python
# In scrcpy_device.py, after starting server process
logcat_cmd = ['adb', '-s', self.device_serial, 'logcat', '-s', 'scrcpy:*', '-d']
logcat_output = subprocess.check_output(logcat_cmd, text=True, timeout=2)
print(f"[ScrcpyDevice] [LOGCAT]: {logcat_output}")
```

### Option 2: Test Server Command Directly

Run the command directly in adb shell to see full error:

```bash
adb -s <serial> shell CLASSPATH=/data/local/tmp/scrcpy-server.jar app_process / com.genymobile.scrcpy.Server 3.3.3 scid=7e232d6b log_level=debug audio=false max_size=720 max_fps=60 video_bit_rate=8000000 video_codec=h264 tunnel_forward=true 2>&1
```

Look for error messages starting with `[server] ERROR:`

### Option 3: Add Missing Parameters Explicitly

Try explicitly setting ALL parameters that might be implicitly required:

```python
cmd = [
    "CLASSPATH=/data/local/tmp/scrcpy-server.jar",
    "app_process",
    "/",
    "com.genymobile.scrcpy.Server",
    "3.3.3",
    f"scid={scid:08x}",
    "log_level=debug",
    "video=true",  # ADD THIS EXPLICITLY
    "audio=false",
    "control=true",  # ADD THIS EXPLICITLY
    f"max_size={self.params.max_size}",
    f"max_fps={self.params.max_fps}",
    f"video_bit_rate={self.params.bit_rate}",
    f"video_codec={self.params.codec.value}",
    "tunnel_forward=true",
    "send_device_meta=true",  # ADD THIS EXPLICITLY
    "send_dummy_byte=true",   # ADD THIS EXPLICITLY
]
```

### Option 4: Compare with QtScrcpy Actual Command

Since QtScrcpyCore source isn't available, test QtScrcpy and capture its actual adb command:

**On Windows:**
1. Use Process Monitor (Procmon) to capture all adb.exe command lines
2. Filter: `Process Name is adb.exe`
3. Start QtScrcpy connection
4. Find the `adb shell CLASSPATH=... app_process ...` command
5. Compare parameter by parameter with our command

**On Linux/Mac:**
```bash
# Monitor adb process arguments
ps aux | grep adb
strace -e execve -f adb <qtscrcpy command> 2>&1 | grep app_process
```

---

## My Recommendation

**IMMEDIATE ACTION**: Run Option 2 (test command directly) to see the actual Java exception message. This will tell us EXACTLY what parameter is wrong.

**THEN**: Based on the error message, apply the appropriate fix.

**Without seeing the actual Java exception, we're guessing blind.** The "Aborted" message is too generic.

---

## What QtScrcpy Must Be Doing Differently

Since QtScrcpy works with 500+ devices, it must either:
1. **Using different parameter values** for some options
2. **Explicitly setting parameters** that we're leaving as default
3. **Using a different scrcpy-server.jar version**
4. **Handling socket connections in a different order**

**The most likely difference**: Parameter values or explicit parameters that we need to identify by capturing QtScrcpy's actual command.
