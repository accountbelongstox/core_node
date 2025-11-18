# Singleton Detection DEBUG Guide

## Overview

The singleton detector now supports detailed DEBUG output via the `SINGLETON_DEBUG` environment variable.

## Quick Start

### Enable DEBUG Mode

```bash
# Linux/Mac
export SINGLETON_DEBUG=1
python scripts/test_mcpctl_launcher.py

# Windows PowerShell
$env:SINGLETON_DEBUG="1"
python scripts/test_mcpctl_launcher.py

# Windows CMD
set SINGLETON_DEBUG=1
python scripts/test_mcpctl_launcher.py
```

### What DEBUG Shows

When `SINGLETON_DEBUG=1` is set, you'll see detailed information about:

1. **Initialization**
   ```
   [DEBUG] Initialized for app_id='pycore_mcp_proxy', port range 58000-58099
   [DEBUG] Protocol: PYCORE_SINGLETON_V1, Timeout: 1.0s
   ```

2. **Port Scanning**
   ```
   [DEBUG] [1/100] Checking port 58000...
   [DEBUG] Trying to connect to port 58000...
   [DEBUG] Port 58000: Not in use (connection refused/timeout) - ConnectionRefusedError
   [DEBUG] Port 58000 is available, attempting to bind...
   ```

3. **Protocol Verification** (when existing instance found)
   ```
   [DEBUG] Sending CHECK message to port 58000: {'protocol': 'PYCORE_SINGLETON_V1', ...}
   [DEBUG] Received response from port 58000: {"protocol": "PYCORE_SINGLETON_V1"...
   [DEBUG] Parsed response: protocol=PYCORE_SINGLETON_V1, app_id=pycore_mcp_proxy, type=ALIVE
   [SUCCESS] Port 58000: Found valid instance (PID 12345)
   [FOUND] Existing instance detected (SECONDARY mode)
   ```

4. **Binding Success**
   ```
   [SUCCESS] Bound to port 58000 (PRIMARY instance)
   [DEBUG]   Bound to port: 58000
   [DEBUG]   Listener thread started
   ```

## Test Scenarios

### Scenario 1: First Instance (Becomes PRIMARY)

```bash
export SINGLETON_DEBUG=1
python pyapps/mcp/main_with_singleton.py
```

**Expected Output:**
- Scans port 58000
- Port not in use
- Binds to port 58000
- Becomes PRIMARY instance
- Listener thread starts

### Scenario 2: Second Instance (shutdown_existing=True)

**Terminal 1:** (First instance running)
```bash
export SINGLETON_DEBUG=1
python pyapps/mcp/main_with_singleton.py
```

**Terminal 2:** (Launch second instance)
```bash
export SINGLETON_DEBUG=1
python pyapps/mcp/main_with_singleton.py
```

**Expected Flow:**
1. Second instance scans port 58000
2. Finds existing instance via protocol verification
3. Sends SHUTDOWN message
4. First instance receives SHUTDOWN and exits
5. Second instance waits 1.5s
6. Second instance retries and binds to port 58000
7. Becomes new PRIMARY instance

### Scenario 3: Second Instance (shutdown_existing=False)

```bash
export SINGLETON_DEBUG=1
python scripts/test_mcpctl_launcher.py --no-shutdown-existing
```

**Expected Output:**
- Scans port 58000
- Finds existing instance
- Does NOT send SHUTDOWN
- Exits with "existing instance found" message

## DEBUG Output Format

```
[TIMESTAMP] [LEVEL] SingletonDetector(APP_ID): MESSAGE
```

**Levels:**
- `[DEBUG]` - Detailed debug information (only when SINGLETON_DEBUG=1)
- `[INFO]` - Standard information
- `[WARNING]` - Warnings (protocol mismatch, other program on port)
- `[ERROR]` - Errors (failed to bind, no ports available)
- `[SUCCESS]` - Success markers (bound port, found instance)
- `[FOUND]` - Found existing instance

## Understanding the Detection Flow

### Flow Diagram with DEBUG Points

```
Start Detection
    |
    v
[DEBUG] Initialize (app_id, port_range, protocol, timeout)
    |
    v
For each port in range (58000-58099)
    |
    v
[DEBUG] Checking port N...
    |
    v
Try to connect to port
    |
    +--[Connection Refused]--+
    |                        |
    v                        v
[DEBUG] Not in use      [DEBUG] Connection successful
    |                        |
    v                        v
Try to bind             [DEBUG] Send CHECK message
    |                        |
    v                        v
[SUCCESS] Bound         [DEBUG] Receive response
PRIMARY mode                 |
    |                        v
    |                   [DEBUG] Parse & validate
    |                        |
    |                        v
    |                   Protocol match?
    |                        |
    |                +-------+-------+
    |                |YES            |NO (other program)
    |                v               v
    |           [FOUND]         [DEBUG] Invalid protocol
    |           SECONDARY       Try next port
    |           mode
    v
END
```

## Troubleshooting with DEBUG

### Problem: Two instances both become PRIMARY

**Symptom:** Both show `[SUCCESS] Bound to port XXXX`

**Diagnosis with DEBUG:**
1. Check if they're using different app_ids
   ```
   [DEBUG] Initialized for app_id='app1'  # Instance 1
   [DEBUG] Initialized for app_id='app2'  # Instance 2
   ```
2. Check if they're using different port ranges
   ```
   [DEBUG] port range 58000-58099  # Instance 1
   [DEBUG] port range 59000-59099  # Instance 2
   ```

**Solution:** Ensure both use same app_id and port_start

### Problem: Instance always finds "existing" but none running

**Symptom:** `[FOUND] Existing instance detected` but no process running

**Diagnosis with DEBUG:**
1. Check which port it's detecting
   ```
   [DEBUG] Trying to connect to port 58000...
   [SUCCESS] Port 58000: Found valid instance (PID 12345)
   ```
2. Check if another program is using that port
   ```
   [DEBUG] Parsed response: protocol=OTHER_PROTOCOL  # Not ours!
   [DEBUG] Port 58000: Invalid protocol (other program)
   ```

**Solution:** Check `netstat` or `lsof` for port occupation

### Problem: "No available ports in range"

**Symptom:** `[FAILED] No available port in range`

**Diagnosis with DEBUG:**
```
[DEBUG] Scanned all 100 ports, none available
```

**Solution:**
- Increase port_range
- Use different port_start
- Check for port conflicts

## Integration Examples

### Basic Usage

```python
from pycore.pylauncher import SingletonDetector

# Debug enabled via environment variable
detector = SingletonDetector(
    app_id="my_app",
    port_start=58000,
    port_range=100
)

result = detector.detect_and_bind()
```

### Programmatic DEBUG

```python
# Force debug mode programmatically
detector = SingletonDetector(
    app_id="my_app",
    port_start=58000,
    port_range=100,
    debug=True  # Override environment variable
)
```

### With mcpctl Launcher

```python
import os
os.environ['SINGLETON_DEBUG'] = '1'

from pycore.pyctl.mcpctl.mcp_launcher import launch_mcp_service

launch_mcp_service(shutdown_existing=True)
```

## Performance Notes

**DEBUG Impact:**
- Minimal performance overhead
- Only affects logging output
- Does NOT change detection logic
- Safe to use in production debugging

**When to Enable:**
- Initial deployment
- Troubleshooting multi-instance issues
- Verifying shutdown_existing behavior
- Understanding port conflicts

## See Also

- `pycore/pylauncher/singleton_detector.py` - Implementation
- `pycore/pyctl/mcpctl/mcp_launcher.py` - MCP launcher using singleton
- `scripts/test_mcpctl_launcher.py` - Test script with examples
