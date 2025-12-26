# Removed Unnecessary Exception Blocks

## Problem

Exception blocks were catching and re-wrapping errors, hiding the original stack traces and making debugging impossible.

## Removed Blocks

### 1. Device Metadata Reading (Line 415-416)

**BEFORE** (Bad - hides original error):
```python
try:
    self._read_device_metadata()
    print(f"[ScrcpyDevice] [OK] Device: {self.info.model}")
except Exception as e:
    raise RuntimeError(f"Failed to read device metadata from {self.serial}: {e}")
```

**AFTER** (Good - shows real error):
```python
self._read_device_metadata()
print(f"[ScrcpyDevice] [OK] Device: {self.info.model}")
```

### 2. Video Codec Metadata Reading (Line 423-424)

**BEFORE** (Bad - hides original error):
```python
try:
    self._read_video_codec_metadata()
    print(f"[ScrcpyDevice] [OK] Resolution: {self.info.resolution.width}x{self.info.resolution.height}")
except Exception as e:
    raise RuntimeError(f"Failed to read video codec metadata from {self.serial}: {e}")
```

**AFTER** (Good - shows real error):
```python
self._read_video_codec_metadata()
print(f"[ScrcpyDevice] [OK] Resolution: {self.info.resolution.width}x{self.info.resolution.height}")
```

## Why This Is Better

### Original Error Messages Are Preserved

**With except block**:
```
RuntimeError: Failed to read device metadata from 192.168.31.116:5555: Connection closed
```
- Only shows wrapped message
- Loses original exception type
- Loses stack trace details

**Without except block**:
```
ConnectionError: Connection closed
  File "scrcpy_device.py", line 810, in _read_device_metadata
    name_bytes = self._recv_exactly(self._video_socket, 64)
  File "scrcpy_device.py", line 880, in _recv_exactly
    raise ConnectionError("Connection closed")
```
- Shows exact error type
- Shows exact line where error occurred
- Shows full stack trace

## Kept Exception Blocks (Necessary Ones)

These exception blocks are **necessary** and should be kept:

### 1. Socket Timeouts (Lines 309-311, 382-384)
```python
except socket.timeout:
    # Specific exception handling for timeout case
    raise RuntimeError(f"Timeout waiting...")
```
**Why keep**: Converts specific socket.timeout to meaningful message

### 2. Connection Retry Logic (Lines 337-343, 402-408)
```python
except (ConnectionRefusedError, OSError) as e:
    if retry < max_retries - 1:
        time.sleep(retry_interval)  # Retry logic
    else:
        raise RuntimeError(...)
```
**Why keep**: Implements retry mechanism, not just re-wrapping

### 3. Tunnel Fallback (Lines 666-701)
```python
except Exception as reverse_error:
    # Try FORWARD mode as fallback
    except Exception as forward_error:
        raise RuntimeError(f"Both modes failed...")
```
**Why keep**: Implements fallback logic between REVERSE and FORWARD modes

### 4. Queue Worker (Lines 86-91)
```python
except Exception as e:
    result_container['error'] = e  # Pass error to waiting thread
```
**Why keep**: Error passing mechanism for queue communication

### 5. Cleanup Operations (Lines 569-591)
```python
except Exception as e:
    print(f"[WARN] Cleanup failed: {e}")  # Don't fail on cleanup
```
**Why keep**: Cleanup failures shouldn't prevent main operation

## Impact

After removing unnecessary except blocks, **real errors will propagate** with full details:
- Exact exception type visible
- Complete stack trace preserved
- Easier to identify root cause
- No information loss

## Testing Note

Now when the connection fails, we'll see the **actual** error instead of generic "Failed to read device metadata" message!
