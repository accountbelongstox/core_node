
import { DeviceInfo, WSRequest, WSResponse, SystemHealth } from '../types/api';

// --- Initial Mock Data ---
const MOCK_DEVICES: DeviceInfo[] = Array.from({ length: 24 }).map((_, i) => ({
  serial: `D-2025-${1000 + i}`,
  status: i % 3 === 0 ? 'offline' : 'device', // 'device' maps to 'online' in our UI logic usually
  model: i % 3 === 0 ? 'Pixel 7' : i % 2 === 0 ? 'Samsung S23' : 'Xiaomi 13',
  manufacturer: i % 3 === 0 ? 'Google' : i % 2 === 0 ? 'Samsung' : 'Xiaomi',
  android_version: '13'
}));

export class MockBackend {
  private devices = [...MOCK_DEVICES];

  public processMessage(msg: WSRequest): WSResponse {
    const { namespace, action, messageId, data } = msg;
    let responseData: any = {};

    // --- System Namespace ---
    if (namespace === 'system') {
      if (action === 'health') {
        const health: SystemHealth = {
          status: 'healthy',
          service: 'pyMatrix',
          version: '1.1.0',
          timestamp: new Date().toISOString()
        };
        responseData = health;
      }
      else if (action === 'info') {
        responseData = {
          message: "pyMatrix API Server",
          version: "1.1.0",
          description: "Mocked Backend",
          protocol: "Unified WebSocket",
          endpoints: { websocket: "/ws", documentation: "/docs" },
          namespaces: ["system", "device", "screen", "file", "recording", "group", "config", "control", "video"]
        };
      }
    }

    // --- Device Namespace ---
    else if (namespace === 'device') {
      if (action === 'list') {
        responseData = {
          devices: this.devices,
          count: this.devices.length
        };
      }
      else if (action === 'connect') {
        // Mock connection logic
        const dev = this.devices.find(d => d.serial === data.serial);
        if (dev) {
          dev.status = 'device';
          responseData = { success: true, message: `Device ${data.serial} connected successfully` };
        } else {
          responseData = { error: { code: 'DEVICE_NOT_FOUND', message: 'Serial not found' } };
        }
      }
      else if (action === 'disconnect') {
        const dev = this.devices.find(d => d.serial === data.serial);
        if (dev) {
           // In reality, disconnecting might not change 'status' to offline immediately in DB, 
           // but for visual feedback let's toggle it or just return success
           // dev.status = 'offline'; 
           responseData = { success: true, message: `Device ${data.serial} disconnected successfully` };
        } else {
           responseData = { error: { code: 'DEVICE_NOT_FOUND', message: 'Serial not found' } };
        }
      }
      else if (action === 'get') {
         const dev = this.devices.find(d => d.serial === data.serial);
         if (dev) {
            responseData = {
               device: {
                  ...dev,
                  sdk_version: '33',
                  resolution: { width: 1080, height: 2400 },
                  dpi: 420
               }
            };
         } else {
            responseData = { error: { code: 'DEVICE_NOT_FOUND', message: 'Device not found' } };
         }
      }
    }

    return {
      namespace,
      action,
      data: responseData,
      messageId
    };
  }
}
