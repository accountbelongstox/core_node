# Scrcpy Server Buffer Blocking Issue - Critical Discovery

## Problem

When using `subprocess.PIPE` for stdout/stderr, the scrcpy-server process would block and fail to send the dummy byte, causing connection failures.

## Root Cause

### From Python subprocess documentation:
https://docs.python.org/3/library/subprocess.html#subprocess.Popen

> **Warning**: Use `communicate()` rather than `.stdin.write`, `.stdout.read` or `.stderr.read` to avoid deadlocks due to any of the other OS pipe buffers filling up and blocking the child process.

### What Happens:

1. **Server starts with `log_level=debug`**
   - Produces large amounts of debug output to stderr
   - scrcpy-server writes continuously to stderr

2. **Subprocess with PIPE**
   ```python
   subprocess.Popen(..., stdout=subprocess.PIPE, stderr=subprocess.PIPE)
   ```
   - Creates OS pipes with limited buffer (~64KB on most systems)
   - No code reading from the pipes

3. **Buffer fills up**
   - stderr buffer fills to ~64KB
   - Server's `write()` system call **blocks**
   - Server cannot continue execution

4. **Dummy byte never sent**
   - Server is blocked in `write()` call
   - Cannot reach the code that sends dummy byte
   - Client connection times out or closes

## The Fix

### Change from PIPE to DEVNULL:

```python
# BEFORE (WRONG - causes blocking):
self._server_process = subprocess.Popen(
    adb_cmd,
    env=env,
    stdout=subprocess.PIPE,   # ❌ Buffer will fill up!
    stderr=subprocess.PIPE,   # ❌ Buffer will fill up!
    stdin=subprocess.PIPE
)

# AFTER (CORRECT - no blocking):
self._server_process = subprocess.Popen(
    adb_cmd,
    env=env,
    stdout=subprocess.DEVNULL,  # ✅ Output discarded, no buffer
    stderr=subprocess.DEVNULL,  # ✅ Output discarded, no buffer
    stdin=subprocess.DEVNULL    # ✅ Server doesn't need stdin
)
```

## Why This Works

### subprocess.DEVNULL behavior:
- Redirects output to `/dev/null` (Unix) or `NUL` (Windows)
- **No buffer** - output is immediately discarded
- Server's `write()` calls **never block**
- Server can continue execution and send dummy byte

## Alternative Solutions (Not Recommended)

### 1. Use communicate() (Blocks until process exits)
```python
# This would block the main thread until server exits
stdout, stderr = process.communicate()
```
**Problem**: Server runs indefinitely, so this doesn't work for our use case.

### 2. Read pipes in separate threads
```python
def read_pipe(pipe):
    for line in iter(pipe.readline, b''):
        pass  # Discard output

threading.Thread(target=read_pipe, args=(process.stdout,)).start()
threading.Thread(target=read_pipe, args=(process.stderr,)).start()
```
**Problem**: Adds complexity, wastes CPU cycles, no benefit since we don't need the output.

### 3. Use asyncio subprocess
```python
proc = await asyncio.create_subprocess_exec(
    *adb_cmd,
    stdout=asyncio.subprocess.DEVNULL,
    stderr=asyncio.subprocess.DEVNULL
)
```
**Problem**: Requires refactoring to async code, but achieves same result as DEVNULL.

## Lessons Learned

1. **Always redirect unused subprocess output** to DEVNULL
2. **PIPE is dangerous** when output is not consumed
3. **Debug output** can be surprisingly large and cause buffer issues
4. **Test with verbose logging** to catch buffer-related bugs

## Related Issues in Other Projects

This is a common pitfall:
- https://stackoverflow.com/questions/375427/a-non-blocking-read-on-a-subprocess-pipe-in-python
- https://thraxil.org/users/anders/posts/2008/03/13/Subprocess-Hanging-PIPE-is-your-enemy/
- Python subprocess documentation warns about this explicitly

## Timeline of Discovery

1. **Initial symptom**: "Connection closed while reading dummy byte"
2. **First hypothesis**: SCID format wrong → Fixed, still failed
3. **Second hypothesis**: tunnel_forward logic wrong → Fixed, still failed
4. **Third hypothesis**: Dummy byte reading order wrong → Fixed, still failed
5. **Real cause discovered**: Buffer blocking prevented server from running!

The fix was simple once identified: change PIPE to DEVNULL.

## Verification

After applying the fix:
- Server can write unlimited debug output
- No buffer fills up
- Server continues execution normally
- Dummy byte is sent successfully
- Connection succeeds
