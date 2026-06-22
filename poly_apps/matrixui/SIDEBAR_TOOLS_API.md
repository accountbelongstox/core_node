# Matrix UI Sidebar Tools - Backend API Documentation

This document provides complete API documentation for implementing the sidebar tool functionalities in the Matrix UI frontend.

## Connection Setup

All RPC v2 API calls use WebSocket connection to:
```
ws://localhost:48000/rpc/ws
```

### RPC v2 Message Format

**Request:**
```typescript
{
  type: "request",
  id: string,           // Unique request ID (e.g., "req-001")
  route: string,        // API route (e.g., "screenshot.capture")
  data: object,         // Request parameters
  timestamp: number     // Unix timestamp in milliseconds
}
```

**Response:**
```typescript
{
  type: "response",
  id: string,           // Matches request ID
  data: object,         // Response data
  timestamp: number
}
```

**Error Response:**
```typescript
{
  type: "response",
  id: string,
  data: {
    error: {
      code: string,
      message: string
    }
  },
  timestamp: number
}
```

---

## Sidebar Tools Overview

| Tool | Icon | Functionality | Backend Required |
|------|------|---------------|-----------------|
| 大屏 (Zoom) | ph-arrows-out | CSS-only zoom layout | ❌ No |
| View | ph-eye | Open fullscreen viewer | ❌ No (Frontend only) |
| Shell | ph-terminal-window | Execute shell commands | ✅ Yes |
| Files | ph-folder-open | File browser | ✅ Yes |
| Camera | ph-camera | Screenshot capture | ✅ Yes |
| Config | ph-gear | Device configuration | ✅ Yes |
| Reboot | ph-power | Reboot device | ✅ Yes |

---

## 1. 大屏 (Zoom) - No Backend Required

**Implementation:** Pure CSS zoom using state management

```typescript
const [zoomedDeviceId, setZoomedDeviceId] = useState<string | null>(null);

// Toggle zoom
const handleZoomToggle = (deviceId: string) => {
  setZoomedDeviceId(zoomedDeviceId === deviceId ? null : deviceId);
};

// CSS classes (already implemented in DeviceDashboard.tsx)
className={`
  ${zoomedDeviceId === device.deviceId
    ? 'fixed inset-4 z-50 w-auto h-auto'
    : zoomedDeviceId
      ? 'h-[160px] w-[100px] opacity-50'
      : 'h-[320px] w-[200px]'
  }
`}
```

---

## 2. View - No Backend Required

**Implementation:** Frontend routing to fullscreen viewer

```typescript
const handleView = (device: Device) => {
  // Navigate to fullscreen viewer page
  onOpenDevice(device);
};
```

---

## 3. Shell - Terminal Access

### 3.1 Execute Shell Command

**Route:** `shell.execute`

**Request:**
```typescript
{
  deviceId: string,     // Device ID (e.g., "device_1")
  command: string,      // Shell command to execute
  timeout?: number      // Optional timeout in seconds (default: 30)
}
```

**Response:**
```typescript
{
  success: true,
  command: string,      // Echoed command
  output: string,       // Command output
  deviceId: string
}
```

**Example Usage:**
```typescript
const executeShellCommand = async (deviceId: string, command: string) => {
  const request = {
    type: "request",
    id: `shell-${Date.now()}`,
    route: "shell.execute",
    data: {
      deviceId,
      command,
      timeout: 30
    },
    timestamp: Date.now()
  };

  const response = await sendRpcRequest(request);

  if (response.data.error) {
    console.error("Command failed:", response.data.error);
    return null;
  }

  return response.data.output;
};

// Example: List files
const output = await executeShellCommand("device_1", "ls -la /sdcard/");
console.log(output);
```

### 3.2 Get Device System Information

**Route:** `shell.info`

**Request:**
```typescript
{
  deviceId: string
}
```

**Response:**
```typescript
{
  success: true,
  deviceId: string,
  systemInfo: {
    cpu: string,        // CPU hardware info
    memory: string,     // Total memory
    battery: string,    // Battery level
    disk: string        // Disk usage
  }
}
```

**Frontend UI Recommendations:**
- Implement a terminal-like interface with command input and output display
- Show command history
- Support common shortcuts (Ctrl+C to cancel, up/down for history)
- Display system info panel with CPU, memory, battery, disk stats

---

## 4. Files - File Browser

### 4.1 List Directory

**Route:** `file.list`

**Request:**
```typescript
{
  deviceId: string,
  path?: string         // Default: "/sdcard/"
}
```

**Response:**
```typescript
{
  success: true,
  path: string,         // Current directory path
  files: Array<{
    name: string,
    isDirectory: boolean,
    size: number,       // Size in bytes (0 for directories)
    permissions: string // e.g., "drwxrwx---"
  }>,
  count: number
}
```

**Example:**
```typescript
const listFiles = async (deviceId: string, path: string = "/sdcard/") => {
  const request = {
    type: "request",
    id: `file-list-${Date.now()}`,
    route: "file.list",
    data: { deviceId, path },
    timestamp: Date.now()
  };

  const response = await sendRpcRequest(request);
  return response.data;
};
```

### 4.2 Delete File/Directory

**Route:** `file.delete`

**Request:**
```typescript
{
  deviceId: string,
  path: string          // Full path to file/directory
}
```

**Response:**
```typescript
{
  success: true,
  message: string       // "Deleted /sdcard/file.txt"
}
```

**Example:**
```typescript
const deleteFile = async (deviceId: string, path: string) => {
  const request = {
    type: "request",
    id: `file-delete-${Date.now()}`,
    route: "file.delete",
    data: { deviceId, path },
    timestamp: Date.now()
  };

  const response = await sendRpcRequest(request);
  return response.data.success;
};
```

### 4.3 Pull File from Device

**Route:** `file.pull`

**Request:**
```typescript
{
  deviceId: string,
  remotePath: string,   // Path on device
  localPath?: string    // Optional local path (default: downloads/)
}
```

**Response:**
```typescript
{
  success: true,
  remotePath: string,
  localPath: string,    // Where file was saved
  message: string
}
```

### 4.4 List Installed Packages

**Route:** `file.packages`

**Request:**
```typescript
{
  deviceId: string,
  filter?: string       // Optional filter pattern (e.g., "com.example")
}
```

**Response:**
```typescript
{
  success: true,
  packages: string[],   // Array of package names
  count: number
}
```

### 4.5 Uninstall APK

**Route:** `file.apk_uninstall`

**Request:**
```typescript
{
  deviceId: string,
  packageName: string
}
```

**Response:**
```typescript
{
  success: true,
  packageName: string
}
```

**Frontend UI Recommendations:**
- File tree view with breadcrumb navigation
- Icons for different file types (folder, APK, image, video, document)
- Right-click context menu (delete, download, rename)
- File size formatting (KB, MB, GB)
- Show permissions and modification dates
- Package manager tab showing installed apps with uninstall button

---

## 5. Camera - Screenshot Capture

### 5.1 Capture Screenshot

**Route:** `screenshot.capture`

**Request:**
```typescript
{
  deviceId: string,
  format?: string       // "png" | "jpg" (default: "png")
}
```

**Response:**
```typescript
{
  success: true,
  screenshotId: string, // Unique screenshot ID
  filePath: string,     // Local file path where screenshot is saved
  timestamp: string     // ISO8601 timestamp
}
```

**Example:**
```typescript
const captureScreenshot = async (deviceId: string) => {
  const request = {
    type: "request",
    id: `screenshot-${Date.now()}`,
    route: "screenshot.capture",
    data: {
      deviceId,
      format: "png"
    },
    timestamp: Date.now()
  };

  const response = await sendRpcRequest(request);

  if (response.data.success) {
    console.log("Screenshot saved to:", response.data.filePath);
    // Show notification to user
    showNotification({
      type: "success",
      message: `Screenshot saved: ${response.data.filePath}`
    });
  }

  return response.data;
};
```

**Frontend UI Recommendations:**
- Show loading indicator while capturing
- Display success notification with file path
- Optional: Show thumbnail preview of captured screenshot
- Maintain screenshot history/gallery

---

## 6. Config - Device Configuration

### 6.1 Get Device Configuration

**Route:** `config.device`

**Request:**
```typescript
{
  deviceName: string    // Note: This is device name, not deviceId
}
```

**Response:**
```typescript
{
  success: true,
  device: string,
  config: {
    // Device-specific configuration
    max_size?: number,
    bit_rate?: number,
    max_fps?: number,
    // ... other config options
  }
}
```

### 6.2 Update Device Configuration

**Route:** `config.device_update`

**Request:**
```typescript
{
  deviceName: string,
  config: {
    max_size?: number,      // Video resolution (e.g., 720, 1080)
    bit_rate?: number,      // Video bitrate (e.g., 8000000)
    max_fps?: number,       // Max FPS (e.g., 60)
    // ... other config options
  }
}
```

**Response:**
```typescript
{
  success: true,
  device: string,
  config: object          // Updated configuration
}
```

### 6.3 Get Global Configuration

**Route:** `config.global`

**Response:**
```typescript
{
  success: true,
  config: {
    // Global application settings
  }
}
```

### 6.4 Update Global Configuration

**Route:** `config.global_update`

**Request:**
```typescript
{
  // Global configuration parameters
  adb_path?: string,
  default_max_size?: number,
  // ... other global settings
}
```

**Frontend UI Recommendations:**
- Settings panel with form inputs
- Video quality presets (Low, Medium, High)
- Save/Cancel buttons
- Show current values
- Validation for numeric inputs

---

## 7. Reboot - Device Reboot

### 7.1 Reboot Device

**Route:** `control.reboot`

**Request:**
```typescript
{
  deviceId: string
}
```

**Response:**
```typescript
{
  success: true,
  message: string       // "Reboot command sent to device {deviceId}"
}
```

**Example:**
```typescript
const rebootDevice = async (deviceId: string) => {
  // Show confirmation dialog first
  const confirmed = await showConfirmDialog({
    title: "Reboot Device",
    message: "Are you sure you want to reboot this device?",
    confirmText: "Reboot",
    cancelText: "Cancel"
  });

  if (!confirmed) return;

  const request = {
    type: "request",
    id: `reboot-${Date.now()}`,
    route: "control.reboot",
    data: { deviceId },
    timestamp: Date.now()
  };

  const response = await sendRpcRequest(request);

  if (response.data.success) {
    showNotification({
      type: "success",
      message: "Reboot command sent successfully"
    });
  }

  return response.data;
};
```

**Frontend UI Recommendations:**
- Show confirmation dialog before rebooting
- Display warning icon
- Show loading state after confirmation
- Notify user when device goes offline
- Auto-reconnect when device comes back online

---

## Error Handling

All API endpoints may return error responses:

```typescript
{
  error: {
    code: string,       // Error code (e.g., "MISSING_DEVICE_ID")
    message: string     // Human-readable error message
  }
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `MISSING_DEVICE_ID` | Device ID not provided in request |
| `UNKNOWN_DEVICE_ID` | Device ID not found in registry |
| `DEVICE_NOT_FOUND` | Device not connected or offline |
| `COMMAND_FAILED` | Shell command execution failed |
| `LIST_DIRECTORY_FAILED` | Failed to list directory contents |
| `DELETE_FAILED` | Failed to delete file/directory |
| `SCREENSHOT_FAILED` | Failed to capture screenshot |
| `REBOOT_FAILED` | Failed to send reboot command |
| `CONFIG_NOT_FOUND` | Configuration not found |

**Example Error Handling:**
```typescript
const handleApiCall = async (route: string, data: any) => {
  try {
    const request = {
      type: "request",
      id: `${route}-${Date.now()}`,
      route,
      data,
      timestamp: Date.now()
    };

    const response = await sendRpcRequest(request);

    if (response.data.error) {
      showNotification({
        type: "error",
        message: response.data.error.message
      });
      return null;
    }

    return response.data;
  } catch (error) {
    console.error("API call failed:", error);
    showNotification({
      type: "error",
      message: "Network error occurred"
    });
    return null;
  }
};
```

---

## Integration with Existing Sidebar

### Current Sidebar Implementation

Location: `poly_apps/matrixui/components/DeviceDashboard.tsx:559-579`

```typescript
{/* Enhanced Sidebar Tools Slide-out */}
<div className="absolute right-0 top-12 bottom-12 flex flex-col gap-1.5 p-2 translate-x-full opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300 ease-out z-20 pointer-events-auto">
  {[
    { icon: 'ph-arrows-out', title: '大屏', action: () => { /* zoom */ }, color: 'text-[#ffd60a]...' },
    { icon: 'ph-eye', title: 'View', action: () => onOpenDevice(device), color: 'text-[#00f2ff]...' },
    { icon: 'ph-terminal-window', title: 'Shell', action: () => {}, color: 'text-[#05ffa1]...' },
    { icon: 'ph-folder-open', title: 'Files', action: () => onQuickAction?.(device, 'files'), color: 'text-[#bd00ff]...' },
    { icon: 'ph-camera', title: t('control.actions.snap'), action: () => {}, color: 'text-white...' },
    { icon: 'ph-gear', title: 'Config', action: () => onQuickAction?.(device, 'config'), color: 'text-slate-300...' },
    { icon: 'ph-power', title: 'Reboot', action: () => {}, color: 'text-[#ff2a6d]...' },
  ].map((tool, i) => (
    <button onClick={(e) => { e.stopPropagation(); tool.action(); }} ... >
      <i className={`ph ${tool.icon} text-sm`}></i>
    </button>
  ))}
</div>
```

### Recommended Implementation

1. **Create RPC Service Hook:**

```typescript
// hooks/useRpcService.ts
import { useState, useCallback } from 'react';

interface RpcRequest {
  type: 'request';
  id: string;
  route: string;
  data: any;
  timestamp: number;
}

export const useRpcService = (wsUrl: string = 'ws://localhost:48000/rpc/ws') => {
  const [ws, setWs] = useState<WebSocket | null>(null);

  const sendRequest = useCallback(async (route: string, data: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const requestId = `${route}-${Date.now()}`;
      const request: RpcRequest = {
        type: 'request',
        id: requestId,
        route,
        data,
        timestamp: Date.now()
      };

      // Set up response listener
      const handleMessage = (event: MessageEvent) => {
        const response = JSON.parse(event.data);
        if (response.id === requestId) {
          ws.removeEventListener('message', handleMessage);
          if (response.data.error) {
            reject(response.data.error);
          } else {
            resolve(response.data);
          }
        }
      };

      ws.addEventListener('message', handleMessage);
      ws.send(JSON.stringify(request));
    });
  }, [ws]);

  return { sendRequest };
};
```

2. **Update Sidebar Actions:**

```typescript
const { sendRequest } = useRpcService();

const sidebarTools = [
  {
    icon: 'ph-arrows-out',
    title: '大屏',
    action: () => setZoomedDeviceId(zoomedDeviceId === device.deviceId ? null : device.deviceId),
    color: 'text-[#ffd60a]...'
  },
  {
    icon: 'ph-eye',
    title: 'View',
    action: () => onOpenDevice(device),
    color: 'text-[#00f2ff]...'
  },
  {
    icon: 'ph-terminal-window',
    title: 'Shell',
    action: async () => {
      // Open shell dialog/modal
      setActiveDialog({ type: 'shell', deviceId: device.deviceId });
    },
    color: 'text-[#05ffa1]...'
  },
  {
    icon: 'ph-folder-open',
    title: 'Files',
    action: async () => {
      // Open file browser dialog/modal
      setActiveDialog({ type: 'files', deviceId: device.deviceId });
    },
    color: 'text-[#bd00ff]...'
  },
  {
    icon: 'ph-camera',
    title: 'Screenshot',
    action: async () => {
      try {
        const result = await sendRequest('screenshot.capture', {
          deviceId: device.deviceId,
          format: 'png'
        });
        showNotification({ type: 'success', message: `Screenshot saved: ${result.filePath}` });
      } catch (error) {
        showNotification({ type: 'error', message: `Screenshot failed: ${error.message}` });
      }
    },
    color: 'text-white...'
  },
  {
    icon: 'ph-gear',
    title: 'Config',
    action: () => {
      // Open config dialog/modal
      setActiveDialog({ type: 'config', deviceId: device.deviceId });
    },
    color: 'text-slate-300...'
  },
  {
    icon: 'ph-power',
    title: 'Reboot',
    action: async () => {
      const confirmed = await showConfirmDialog({
        title: 'Reboot Device',
        message: 'Are you sure you want to reboot this device?'
      });
      if (confirmed) {
        try {
          await sendRequest('control.reboot', { deviceId: device.deviceId });
          showNotification({ type: 'success', message: 'Reboot command sent' });
        } catch (error) {
          showNotification({ type: 'error', message: `Reboot failed: ${error.message}` });
        }
      }
    },
    color: 'text-[#ff2a6d]...'
  },
];
```

3. **Create Modal/Dialog Components:**

Create separate modal components for:
- `ShellDialog.tsx` - Terminal interface
- `FileBrowserDialog.tsx` - File browser
- `ConfigDialog.tsx` - Configuration panel

---

## Testing

### Test Shell Command
```bash
# Send via RPC v2 WebSocket
{
  "type": "request",
  "id": "test-1",
  "route": "shell.execute",
  "data": {
    "deviceId": "device_1",
    "command": "ls -la /sdcard/"
  },
  "timestamp": 1733200000000
}
```

### Test Screenshot
```bash
{
  "type": "request",
  "id": "test-2",
  "route": "screenshot.capture",
  "data": {
    "deviceId": "device_1",
    "format": "png"
  },
  "timestamp": 1733200000000
}
```

### Test File List
```bash
{
  "type": "request",
  "id": "test-3",
  "route": "file.list",
  "data": {
    "deviceId": "device_1",
    "path": "/sdcard/"
  },
  "timestamp": 1733200000000
}
```

---

## Summary

### Backend APIs Completed ✅

1. **Shell Access**
   - `shell.execute` - Execute commands
   - `shell.info` - Get system info

2. **File Management**
   - `file.list` - List directory
   - `file.delete` - Delete files
   - `file.pull` - Download files
   - `file.packages` - List installed apps
   - `file.apk_uninstall` - Uninstall apps

3. **Screenshot**
   - `screenshot.capture` - Capture screenshot

4. **Configuration**
   - `config.device` - Get device config
   - `config.device_update` - Update device config
   - `config.global` - Get global config
   - `config.global_update` - Update global config

5. **Device Control**
   - `control.reboot` - Reboot device

### Frontend Tasks 📝

1. Create `useRpcService` hook for WebSocket communication
2. Implement modal components:
   - `ShellDialog.tsx` (Terminal UI)
   - `FileBrowserDialog.tsx` (File tree, operations)
   - `ConfigDialog.tsx` (Settings form)
3. Add confirmation dialogs for destructive actions
4. Implement notification system
5. Update sidebar tool actions with API calls
6. Add loading states and error handling
7. Create screenshot gallery/history (optional)

---

## Support

For backend issues, check:
- `pyapps/matrix/api/main.py` - RPC route definitions
- `pyapps/matrix/services/` - Service implementations

For frontend issues, check:
- `poly_apps/matrixui/components/DeviceDashboard.tsx` - Sidebar implementation
- RPC v2 WebSocket connection at `ws://localhost:48000/rpc/ws`
