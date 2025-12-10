# Matrix API Test Console Guide

## Overview

The `test_api.html` file provides a comprehensive WebSocket testing console for the Matrix RPC v2 API. It allows you to test all API endpoints and listen to real-time device push notifications.

## Features

### 1. WebSocket Connection Management
- Connect/Disconnect buttons for WebSocket management
- Real-time connection status indicator
- Automatic client ID generation and display
- Automatic reconnection on connection loss

### 2. API Testing

#### ADB Device Manager (New)
- **`adb.device.list`** - Get auto-discovered devices from the ADB heartbeat thread
  - Returns complete device information (serial, IP, connection type, state, model, Android version)
  - Includes device statistics

- **`adb.device.stats`** - Get ADB device manager statistics
  - Returns heartbeat status, thread information, and device counts

#### Device Management (Existing)
- **`device.list`** - List all managed devices
- **`device.info`** - Get detailed device information

### 3. Real-time Device Push Events

#### Listen to `adb.devices.update`
This is the new **device push service** that broadcasts device list updates every 10 seconds:

**Event Format:**
```json
{
  "devices": [
    {
      "serial": "192.168.1.100:5555",
      "ip": "192.168.1.100",
      "connection_type": "network",
      "state": "device",
      "is_root": true,
      "model": "Pixel 6",
      "android_version": "13",
      "last_seen": 1702000000.0,
      "connected_at": 1701999000.0
    }
  ],
  "count": 1,
  "stats": {
    "total": 1,
    "connected": 1,
    "disconnected": 0
  },
  "timestamp": 1702000000000
}
```

The test console displays device cards with:
- Serial/IP address
- Model name
- Android version
- Connection status (green=connected, gray=offline)
- Root status badge

### 4. Testing Tools
- **Test All APIs** - Run all API endpoints sequentially with automatic delays
- **Get System Info** - Display browser system information
- **Clear Logs** - Clear the event log

## How to Use

### Step 1: Start the Matrix Application
```bash
cd D:\programing\core_node
python pymain.py app=matrix
```

The application will start on:
- **WebSocket API**: `ws://localhost:48000/rpc/ws`
- **Frontend**: `http://localhost:38007` (dev) or `http://localhost:48000` (prod)

### Step 2: Open the Test Console
1. Open the Matrix application
2. The test console can be accessed at:
   - Development: `http://localhost:38007/test_api.html`
   - Or directly: Open `pyapps/matrix/test_api.html` in your browser

### Step 3: Connect WebSocket
1. Click the **"Connect"** button
2. Wait for the connection status to show "Connected" (green indicator)
3. Your client ID will be displayed

### Step 4: Test APIs

#### Test Single API
Click any button in the "API Endpoints" panel:
- Response data appears in the "Last Response Details" panel
- Event log shows the result status and timestamp

#### Test All APIs
Click **"Test All APIs"** to run all endpoints with 500ms delays between calls.

### Step 5: Monitor Device Push Events

#### Option A: Automatic Monitoring
1. Make sure you're connected
2. Click **"Listen: adb.devices.update"**
3. The console will start receiving device updates every 10 seconds
4. Device cards are displayed in the "Last Response Details" panel

#### Option B: Manual Testing
1. Connect USB devices or configure network ADB
2. Click **"adb.device.list"** to get current devices
3. Click **"Listen: adb.devices.update"** to watch for changes

## Understanding the Response Panel

### Device Cards
Each connected device shows:
```
[Serial/IP]
Model Name
Android Version
[Connection Status]
IP: x.x.x.x (if available)
✓ Root (if rooted)
```

### Status Indicators
- **Green border**: Device is currently connected (`state: "device"`)
- **Gray border + opacity**: Device is offline
- **Green icon**: Device has root access

### Metrics
- **Total Devices**: Count of all discovered devices
- **Last Update**: Timestamp of the last push update

## Log Panel

The left panel shows all API calls and events with timestamps:

- **Blue logs**: API calls and responses
- **Green logs**: Successful operations
- **Red logs**: Errors and failed operations
- **Light green logs**: Real-time events (adb.devices.update)

## Troubleshooting

### Connection Failed
**Problem**: "Connection failed: ... refused"
**Solution**:
1. Make sure Matrix application is running
2. Check if port 48000 is available
3. Browser firewall might be blocking: try localhost vs 127.0.0.1

### No Device Updates
**Problem**: Device push events not appearing
**Solution**:
1. Click **"adb.device.list"** first to check if ADB manager is running
2. Click **"adb.device.stats"** to check heartbeat status
3. Make sure "Listen: adb.devices.update" button is active
4. Check Matrix application logs for errors

### WebSocket Auto-Reconnect
The client automatically attempts to reconnect on disconnection:
- Up to 10 reconnection attempts
- 3 second interval between attempts
- Status indicator shows real-time connection state

## API Response Examples

### adb.device.list Response
```json
{
  "devices": [
    {
      "serial": "192.168.1.100:5555",
      "ip": "192.168.1.100",
      "connection_type": "network",
      "state": "device",
      "is_root": true,
      "model": "Pixel 6",
      "android_version": "13",
      "last_seen": 1702000000.0,
      "connected_at": 1701999000.0
    }
  ],
  "count": 1,
  "stats": {
    "total": 1,
    "connected": 1,
    "disconnected": 0
  }
}
```

### adb.device.stats Response
```json
{
  "total_devices": 1,
  "connected_devices": 1,
  "disconnected_devices": 0,
  "last_scan": 1702000000.0,
  "heartbeat_status": "running",
  "uptime": 3600.5
}
```

## Advanced Features

### Enable Debug Logging
Edit the JavaScript connection code:
```javascript
client = new FastAPIRpcClient(baseUrl, {
    debug: true,  // Enable verbose console logging
    reconnect: true,
    reconnectInterval: 3000
});
```

### Custom API Calls
You can add custom API tests by modifying the HTML:
```javascript
async function myCustomTest() {
    const result = await client.call('my.api.route', { param: 'value' });
    displayResult(result);
}
```

### Monitor Network Activity
Use browser DevTools (F12) Network tab to see:
- WebSocket frames
- Message size and timing
- Connection status
- Error responses

## Performance Notes

- **Max Log Items**: Console keeps last 100 log entries to prevent slowdown
- **Push Interval**: Device updates are broadcast every 10 seconds
- **Reconnect Attempts**: 10 max attempts with 3s interval
- **Heartbeat**: Client sends heartbeat every 5 seconds (1s fast heartbeat during active calls)

## Files Referenced

- **Client Library**: `pycore/pyutils/rpc_v2/client/unified_rpc_client.js`
- **RPC Server**: `pycore/pyutils/native_ui/rpc_v2_server.py`
- **ADB Manager**: `pyapps/matrix/adb_device_manager/`
- **Device Push Service**: `pyapps/matrix/adb_device_manager/device_push_service.py`
- **Matrix API**: `pyapps/matrix/api/main.py`

## Related Documentation

- [Device Push Service Architecture](docs/DEVICE_PUSH_SERVICE.md)
- [ADB Device Manager Guide](docs/ADB_DEVICE_MANAGER.md)
- [RPC v2 Protocol Specification](../../pycore/pyutils/rpc_v2/docs/)
