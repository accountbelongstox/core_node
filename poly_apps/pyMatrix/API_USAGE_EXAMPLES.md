# pyMatrix API Usage Examples

**Version**: 1.0.0
**Last Updated**: 2025-11-02
**Base URL**: `http://localhost:8000`

---

## 📋 Table of Contents

1. [Authentication & Headers](#authentication--headers)
2. [Device Management](#device-management)
3. [Recording & Screenshots](#recording--screenshots)
4. [Screen Control](#screen-control)
5. [Clipboard Sync](#clipboard-sync)
6. [Group Batch Operations](#group-batch-operations)
7. [File Management](#file-management)
8. [WebSocket Communication](#websocket-communication)
9. [Health Check](#health-check)
10. [Error Handling](#error-handling)

---

## Authentication & Headers

### Standard Request Headers
```http
Content-Type: application/json
Accept: application/json
```

### File Upload Headers
```http
Content-Type: multipart/form-data
```

---

## Device Management

### List All Devices
```bash
# Request
curl -X GET "http://localhost:8000/api/devices/list"

# Response
{
  "success": true,
  "devices": [
    {
      "serial": "ABC123",
      "model": "Pixel 6",
      "status": "connected"
    }
  ]
}
```

### Connect Device
```bash
# Request
curl -X POST "http://localhost:8000/api/devices/ABC123/connect"

# Response
{
  "success": true,
  "serial": "ABC123",
  "message": "Device connected successfully"
}
```

### Disconnect Device
```bash
# Request
curl -X POST "http://localhost:8000/api/devices/ABC123/disconnect"

# Response
{
  "success": true,
  "serial": "ABC123",
  "message": "Device disconnected"
}
```

---

## Recording & Screenshots

### Start Recording
```bash
# Request
curl -X POST "http://localhost:8000/api/devices/ABC123/recording/start" \
  -H "Content-Type: application/json" \
  -d '{
    "quality": "high",
    "maxDuration": 1800
  }'

# Response
{
  "success": true,
  "recordingId": "rec_20251102_143020",
  "startTime": "2025-11-02T14:30:20Z",
  "quality": "high"
}
```

### Stop Recording
```bash
# Request
curl -X POST "http://localhost:8000/api/devices/ABC123/recording/stop"

# Response
{
  "success": true,
  "recordingId": "rec_20251102_143020",
  "duration": 125,
  "fileSize": 45678900,
  "filePath": "/recordings/device_ABC123_20251102_143020.mp4"
}
```

### Capture Screenshot
```bash
# Request
curl -X POST "http://localhost:8000/api/devices/ABC123/screenshot" \
  -H "Content-Type: application/json" \
  -d '{
    "format": "png"
  }'

# Response
{
  "success": true,
  "screenshotId": "shot_20251102_143520",
  "filePath": "/screenshots/device_ABC123_20251102_143520.png",
  "timestamp": "2025-11-02T14:35:20Z"
}
```

---

## Screen Control

### Control Screen Power
```bash
# Power On
curl -X POST "http://localhost:8000/api/devices/ABC123/screen/power" \
  -H "Content-Type: application/json" \
  -d '{"action": "on"}'

# Power Off
curl -X POST "http://localhost:8000/api/devices/ABC123/screen/power" \
  -H "Content-Type: application/json" \
  -d '{"action": "off"}'

# Toggle
curl -X POST "http://localhost:8000/api/devices/ABC123/screen/power" \
  -H "Content-Type: application/json" \
  -d '{"action": "toggle"}'

# Response
{
  "success": true,
  "state": "on"
}
```

### Control Brightness
```bash
# Request (0-255)
curl -X POST "http://localhost:8000/api/devices/ABC123/screen/brightness" \
  -H "Content-Type: application/json" \
  -d '{"level": 128}'

# Response
{
  "success": true,
  "level": 128
}
```

### Control Rotation
```bash
# Request (0, 90, 180, 270)
curl -X POST "http://localhost:8000/api/devices/ABC123/screen/rotation" \
  -H "Content-Type: application/json" \
  -d '{"rotation": 90}'

# Response
{
  "success": true,
  "rotation": 90
}
```

---

## Clipboard Sync

### WebSocket Clipboard Messages

#### Set Clipboard
```javascript
// JavaScript example
const ws = new WebSocket('ws://localhost:8000/ws/control/ABC123');

ws.send(JSON.stringify({
  type: 'clipboard.set',
  data: {
    text: 'Hello from PC!'
  }
}));

// Response
{
  "type": "clipboard.set_ack",
  "data": {
    "success": true
  }
}
```

#### Get Clipboard
```javascript
ws.send(JSON.stringify({
  type: 'clipboard.get',
  data: {}
}));

// Response
{
  "type": "clipboard.data",
  "data": {
    "text": "Hello from device!"
  }
}
```

---

## Group Batch Operations

### Batch Screenshot
```bash
# Request
curl -X POST "http://localhost:8000/api/groups/group_001/batch/screenshot" \
  -H "Content-Type: application/json" \
  -d '{
    "format": "png"
  }'

# Response
{
  "success": true,
  "groupId": "group_001",
  "totalDevices": 5,
  "successful": 5,
  "failed": 0,
  "results": [
    {
      "success": true,
      "screenshotId": "shot_ABC123_20251102",
      "filePath": "/screenshots/ABC123.png"
    }
    // ... more results
  ]
}
```

### Batch Start Recording
```bash
# Request
curl -X POST "http://localhost:8000/api/groups/group_001/batch/recording/start" \
  -H "Content-Type: application/json" \
  -d '{
    "quality": "medium",
    "maxDuration": 600
  }'

# Response
{
  "success": true,
  "groupId": "group_001",
  "totalDevices": 5,
  "successful": 5,
  "failed": 0,
  "results": [...]
}
```

### Batch System Key
```bash
# Request (home, back, recent, power, volume_up, volume_down)
curl -X POST "http://localhost:8000/api/groups/group_001/batch/systemkey" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "home"
  }'

# Response
{
  "success": true,
  "groupId": "group_001",
  "action": "home",
  "totalDevices": 5,
  "successful": 5,
  "failed": 0
}
```

### Batch Screen Control
```bash
# Brightness Control
curl -X POST "http://localhost:8000/api/groups/group_001/batch/screen-control" \
  -H "Content-Type: application/json" \
  -d '{
    "controlType": "brightness",
    "params": {
      "level": 200
    }
  }'

# Power Control
curl -X POST "http://localhost:8000/api/groups/group_001/batch/screen-control" \
  -H "Content-Type: application/json" \
  -d '{
    "controlType": "power",
    "params": {
      "action": "off"
    }
  }'

# Rotation Control
curl -X POST "http://localhost:8000/api/groups/group_001/batch/screen-control" \
  -H "Content-Type: application/json" \
  -d '{
    "controlType": "rotation",
    "params": {
      "rotation": 90
    }
  }'

# Response
{
  "success": true,
  "groupId": "group_001",
  "controlType": "brightness",
  "totalDevices": 5,
  "successful": 5,
  "failed": 0
}
```

---

## File Management

### Push File to Device
```bash
# Request
curl -X POST "http://localhost:8000/api/files/devices/ABC123/push" \
  -F "file=@/path/to/local/file.txt" \
  -F "remotePath=/sdcard/Download/file.txt"

# Response
{
  "success": true,
  "taskId": "task_abc123def",
  "localPath": "/tmp/pymatrix_uploads/20251102_143000_file.txt",
  "remotePath": "/sdcard/Download/file.txt",
  "fileSize": 1024
}
```

### Install APK
```bash
# Request
curl -X POST "http://localhost:8000/api/files/devices/ABC123/apk/install" \
  -F "file=@/path/to/app.apk" \
  -F "reinstall=false"

# Response
{
  "success": true,
  "taskId": "task_xyz789abc",
  "apkPath": "/tmp/pymatrix_uploads/20251102_143500_app.apk",
  "output": "Success"
}
```

### Uninstall APK
```bash
# Request
curl -X DELETE "http://localhost:8000/api/files/devices/ABC123/apk/uninstall" \
  -H "Content-Type: application/json" \
  -d '{
    "packageName": "com.example.app"
  }'

# Response
{
  "success": true,
  "packageName": "com.example.app"
}
```

### List Installed Packages
```bash
# Request (with optional filter)
curl -X GET "http://localhost:8000/api/files/devices/ABC123/packages?filter=com.google"

# Response
{
  "success": true,
  "packages": [
    "com.google.android.gms",
    "com.google.android.apps.photos",
    "com.google.android.youtube"
  ],
  "count": 3
}
```

### Get Transfer Status
```bash
# Request
curl -X GET "http://localhost:8000/api/files/transfer/task_abc123def"

# Response
{
  "success": true,
  "type": "push",
  "deviceSerial": "ABC123",
  "localPath": "/tmp/file.txt",
  "remotePath": "/sdcard/Download/file.txt",
  "fileSize": 1024,
  "status": "completed",
  "startTime": "2025-11-02T14:30:00Z",
  "endTime": "2025-11-02T14:30:05Z"
}
```

---

## WebSocket Communication

### Video Streaming
```javascript
const videoWs = new WebSocket('ws://localhost:8000/ws/video/ABC123');

videoWs.onmessage = (event) => {
  // event.data contains video frame data (binary)
  const blob = new Blob([event.data], { type: 'image/jpeg' });
  const img = document.getElementById('video-frame');
  img.src = URL.createObjectURL(blob);
};
```

### Device Control
```javascript
const controlWs = new WebSocket('ws://localhost:8000/ws/control/ABC123');

// Touch event
controlWs.send(JSON.stringify({
  type: 'control.touch',
  data: {
    x: 500,
    y: 800,
    action: 'down'
  }
}));

// Text input
controlWs.send(JSON.stringify({
  type: 'control.text',
  data: {
    text: 'Hello World'
  }
}));

// System key
controlWs.send(JSON.stringify({
  type: 'system',
  data: {
    key: 'home'
  }
}));
```

---

## Health Check

### Basic Health Check
```bash
curl -X GET "http://localhost:8000/api/health"

# Response
{
  "status": "healthy",
  "service": "pyMatrix",
  "version": "1.0.0",
  "timestamp": "2025-11-02T14:30:00Z"
}
```

### Detailed Health Check
```bash
curl -X GET "http://localhost:8000/api/health/detailed"

# Response
{
  "status": "healthy",
  "service": {
    "name": "pyMatrix",
    "version": "1.0.0",
    "description": "Android Device Mirroring and Group Control System"
  },
  "timestamp": "2025-11-02T14:30:00Z",
  "uptime_seconds": 3600,
  "system": {
    "platform": "Windows",
    "platform_version": "10.0.26200",
    "python_version": "3.11.5",
    "architecture": "AMD64"
  },
  "resources": {
    "cpu": {
      "usage_percent": 15.5,
      "cores": 8
    },
    "memory": {
      "total_mb": 16384.0,
      "available_mb": 8192.0,
      "used_percent": 50.0
    },
    "disk": {
      "total_gb": 500.0,
      "free_gb": 200.0,
      "used_percent": 60.0
    }
  },
  "performance_metrics": {
    "/api/devices/list": {
      "request_count": 150,
      "avg_duration_ms": 25.5,
      "error_count": 0,
      "error_rate_percent": 0.0
    }
  }
}
```

---

## Error Handling

### Standard Error Response Format
```json
{
  "success": false,
  "error": "Error description here"
}
```

### Common HTTP Status Codes
- `200 OK` - Request successful
- `400 Bad Request` - Invalid request parameters
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

### Error Examples

#### Device Not Found
```json
{
  "detail": "Device ABC123 not found"
}
```

#### Invalid Parameter
```json
{
  "detail": "Invalid rotation value. Must be 0, 90, 180, or 270 degrees"
}
```

#### Operation Failed
```json
{
  "success": false,
  "error": "Failed to start recording: Device not connected"
}
```

---

## Frontend Integration Example (TypeScript)

### API Service Class
```typescript
// pymatrix-api.ts
export class PyMatrixAPI {
  private baseURL: string;

  constructor(baseURL: string = 'http://localhost:8000') {
    this.baseURL = baseURL;
  }

  // Device Management
  async listDevices() {
    const response = await fetch(`${this.baseURL}/api/devices/list`);
    return response.json();
  }

  async connectDevice(serial: string) {
    const response = await fetch(
      `${this.baseURL}/api/devices/${serial}/connect`,
      { method: 'POST' }
    );
    return response.json();
  }

  // Recording
  async startRecording(serial: string, quality: string = 'high') {
    const response = await fetch(
      `${this.baseURL}/api/devices/${serial}/recording/start`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quality, maxDuration: 1800 })
      }
    );
    return response.json();
  }

  // File Upload
  async pushFile(serial: string, file: File, remotePath: string) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('remotePath', remotePath);

    const response = await fetch(
      `${this.baseURL}/api/files/devices/${serial}/push`,
      {
        method: 'POST',
        body: formData
      }
    );
    return response.json();
  }

  // Group Operations
  async batchScreenshot(groupId: string, format: string = 'png') {
    const response = await fetch(
      `${this.baseURL}/api/groups/${groupId}/batch/screenshot`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format })
      }
    );
    return response.json();
  }
}
```

---

## Rate Limiting & Best Practices

### Recommended Practices
1. **Implement retry logic** for failed requests
2. **Use WebSocket** for real-time operations (video, control)
3. **Batch operations** when controlling multiple devices
4. **Monitor performance** using `/api/health/detailed`
5. **Handle errors** gracefully with user feedback

### Performance Tips
- Use batch endpoints for group operations
- Limit video frame rate for bandwidth management
- Close WebSocket connections when not in use
- Use appropriate quality settings for recordings

---

**For more information, visit:**
- Swagger Documentation: `http://localhost:8000/docs`
- ReDoc Documentation: `http://localhost:8000/redoc`
