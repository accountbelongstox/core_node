# NUXT APP SCREENCAST WITH NCORE APP SCREENCAST GUIDE

## Application Overview

### Nuxt Application (screencast)
- **Purpose**: Web frontend for displaying real-time screen streaming from up to 100 mobile devices
- **Technology**: Nuxt 4 + Vue 3 + WebSocket + WebCodecs API
- **Key Features**:
  - Virtual scrolling for efficient rendering
  - Dynamic frame rate adjustment (5fps/15fps/30fps)
  - Grid layout with focus mode
  - Real-time device status monitoring

### NCore Application (ScreenCast)
- **Purpose**: Backend service managing ADB connections and FFmpeg streaming
- **Technology**: Node.js + Express + WebSocket + FFmpeg + ADB
- **Key Features**:
  - Multi-device ADB connection management
  - Dynamic stream quality adjustment
  - WebSocket stream distribution
  - Device health monitoring

### Integration Goals
1. Display 100+ device screens simultaneously in a single web page
2. Maintain high frame rates (30fps for focused devices, 15fps for visible, 5fps for background)
3. Efficient bandwidth usage through adaptive streaming
4. Real-time device connection status updates
5. Low latency screen mirroring (< 500ms)

---

## Data Model Definitions

### Shared Data Models

#### Device Model
```typescript
interface Device {
  id: string;                    // Unique device identifier (ADB serial)
  name: string;                  // Device display name
  model: string;                 // Device model (e.g., "Pixel 6")
  resolution: {
    width: number;
    height: number;
  };
  status: DeviceStatus;          // connected | streaming | disconnected | error
  streamUrl: string;             // WebSocket stream URL
  thumbnailUrl: string;          // Thumbnail image URL
  connectionTime: number;        // Unix timestamp
  lastHeartbeat: number;         // Unix timestamp
  metrics: DeviceMetrics;
}

type DeviceStatus = 'connected' | 'streaming' | 'disconnected' | 'error';

interface DeviceMetrics {
  fps: number;                   // Current frame rate
  bitrate: number;              // Current bitrate (kbps)
  latency: number;              // Stream latency (ms)
  frameDrops: number;           // Dropped frames count
}
```

#### Stream Configuration Model
```typescript
interface StreamConfig {
  deviceId: string;
  quality: StreamQuality;        // high | medium | low
  fps: number;                   // 5 | 15 | 30
  bitrate: string;              // e.g., "500k"
  resolution: string;           // e.g., "720x1280"
  codec: string;                // e.g., "h264"
}

type StreamQuality = 'high' | 'medium' | 'low';

interface StreamQualityPreset {
  high: {
    fps: 30;
    bitrate: '800k';
    resolution: '720x1280';
  };
  medium: {
    fps: 15;
    bitrate: '500k';
    resolution: '540x960';
  };
  low: {
    fps: 5;
    bitrate: '200k';
    resolution: '360x640';
  };
}
```

#### WebSocket Message Model
```typescript
interface WSMessage {
  type: WSMessageType;
  timestamp: number;
  data: any;
}

type WSMessageType =
  | 'device_connected'
  | 'device_disconnected'
  | 'stream_started'
  | 'stream_stopped'
  | 'stream_data'
  | 'stream_config_update'
  | 'device_metrics'
  | 'heartbeat';

interface StreamDataMessage extends WSMessage {
  type: 'stream_data';
  data: {
    deviceId: string;
    chunk: ArrayBuffer;      // H.264 encoded video chunk
    timestamp: number;
    sequence: number;
  };
}

interface DeviceMetricsMessage extends WSMessage {
  type: 'device_metrics';
  data: {
    deviceId: string;
    metrics: DeviceMetrics;
  };
}
```

### NCore-Specific Data Models

#### ADB Device Model
```typescript
interface AdbDevice {
  serial: string;              // ADB device serial number
  state: string;               // device state from adb
  model: string;               // device model
  transportId: string;         // ADB transport ID
  product: string;             // Product name
  device: string;              // Device codename
}

interface AdbConnection {
  device: AdbDevice;
  process: ChildProcess | null; // FFmpeg process
  streamConfig: StreamConfig;
  isStreaming: boolean;
  lastError: string | null;
}
```

#### Stream Process Model
```typescript
interface StreamProcess {
  deviceId: string;
  ffmpegProcess: ChildProcess;
  pid: number;
  startTime: number;
  config: StreamConfig;
  outputPath: string;
  wsClients: Set<WebSocket>;   // Connected clients for this stream
}
```

### Nuxt-Specific Data Models

#### Display Grid Model
```typescript
interface GridLayout {
  columns: number;             // Grid columns (e.g., 10)
  rows: number;               // Grid rows (e.g., 10)
  cellWidth: number;          // Cell width in pixels
  cellHeight: number;         // Cell height in pixels
  gap: number;                // Gap between cells
}

interface ViewportState {
  visibleDevices: Set<string>;      // Currently visible device IDs
  focusedDevice: string | null;     // Currently focused device ID
  scrollTop: number;
  scrollLeft: number;
}
```

#### Video Player Model
```typescript
interface VideoPlayer {
  deviceId: string;
  mediaSource: MediaSource;
  sourceBuffer: SourceBuffer;
  videoElement: HTMLVideoElement;
  ws: WebSocket;
  isPlaying: boolean;
  bufferQueue: ArrayBuffer[];
}
```

---

## API Interface Specification

### NCore Provided APIs

#### REST APIs

##### 1. Get All Devices
```
GET /api/screencast/devices
```

**Response:**
```typescript
{
  success: boolean;
  data: Device[];
  timestamp: string;
}
```

##### 2. Get Device Detail
```
GET /api/screencast/devices/:deviceId
```

**Response:**
```typescript
{
  success: boolean;
  data: Device;
  timestamp: string;
}
```

##### 3. Start Device Stream
```
POST /api/screencast/devices/:deviceId/stream/start
```

**Request Body:**
```typescript
{
  quality: StreamQuality;  // optional, defaults to 'medium'
}
```

**Response:**
```typescript
{
  success: boolean;
  data: {
    deviceId: string;
    streamUrl: string;     // WebSocket URL
    config: StreamConfig;
  };
  timestamp: string;
}
```

##### 4. Stop Device Stream
```
POST /api/screencast/devices/:deviceId/stream/stop
```

**Response:**
```typescript
{
  success: boolean;
  message: string;
  timestamp: string;
}
```

##### 5. Update Stream Configuration
```
PUT /api/screencast/devices/:deviceId/stream/config
```

**Request Body:**
```typescript
{
  quality?: StreamQuality;
  fps?: number;
  bitrate?: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  data: StreamConfig;
  timestamp: string;
}
```

##### 6. Refresh ADB Devices
```
POST /api/screencast/adb/refresh
```

**Response:**
```typescript
{
  success: boolean;
  data: {
    newDevices: number;
    disconnectedDevices: number;
    totalDevices: number;
  };
  timestamp: string;
}
```

#### WebSocket APIs

##### Connection URL
```
ws://localhost:15461/stream/:deviceId
```

##### Message Types (Server → Client)

**Stream Data:**
```typescript
{
  type: 'stream_data';
  timestamp: number;
  data: {
    deviceId: string;
    chunk: ArrayBuffer;
    timestamp: number;
    sequence: number;
  };
}
```

**Device Metrics:**
```typescript
{
  type: 'device_metrics';
  timestamp: number;
  data: {
    deviceId: string;
    metrics: DeviceMetrics;
  };
}
```

**Device Status:**
```typescript
{
  type: 'device_connected' | 'device_disconnected';
  timestamp: number;
  data: {
    deviceId: string;
    device?: Device;
  };
}
```

##### Message Types (Client → Server)

**Request Config Update:**
```typescript
{
  type: 'update_config';
  data: {
    quality: StreamQuality;
  };
}
```

**Heartbeat:**
```typescript
{
  type: 'heartbeat';
  timestamp: number;
}
```

---

## Nuxt Application API Calls

### Composables

#### `useScreenCast()`
```typescript
const {
  devices,           // Ref<Device[]>
  loading,          // Ref<boolean>
  error,            // Ref<Error | null>
  fetchDevices,     // () => Promise<void>
  startStream,      // (deviceId: string, quality?: StreamQuality) => Promise<void>
  stopStream,       // (deviceId: string) => Promise<void>
  updateConfig,     // (deviceId: string, config: Partial<StreamConfig>) => Promise<void>
  refreshDevices    // () => Promise<void>
} = useScreenCast();
```

#### `useStreamPlayer(deviceId: string)`
```typescript
const {
  isPlaying,        // Ref<boolean>
  metrics,          // Ref<DeviceMetrics>
  videoRef,         // Ref<HTMLVideoElement | null>
  connect,          // () => Promise<void>
  disconnect,       // () => void
  updateQuality     // (quality: StreamQuality) => Promise<void>
} = useStreamPlayer(deviceId);
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          User Browser                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Nuxt Frontend (Virtual Scroll Grid)                       │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │ │
│  │  │ Device 1 │  │ Device 2 │  │ Device 3 │  ... x100       │ │
│  │  │  30fps   │  │  15fps   │  │  5fps    │                 │ │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘                 │ │
│  │       │             │             │                         │ │
│  │       └─────────────┴─────────────┘                         │ │
│  │                     │                                        │ │
│  │              WebSocket Manager                              │ │
│  │              (100 connections)                              │ │
│  └─────────────────────┼──────────────────────────────────────┘ │
└────────────────────────┼──────────────────────────────────────┘
                         │
                         │ WS (15461) + HTTP (15460)
                         │
┌────────────────────────▼─────────────────────────────────────┐
│              NCore Backend (ScreenCast App)                   │
│  ┌──────────────────────────────────────────────────────────┐│
│  │  WebSocket Server (ws://localhost:15461)                 ││
│  │  - Stream Distribution                                   ││
│  │  - Quality Management                                    ││
│  └──────────────────┬───────────────────────────────────────┘│
│                     │                                          │
│  ┌─────────────────▼────────────────────────────────────────┐│
│  │  Stream Manager                                          ││
│  │  - Dynamic Quality Control                               ││
│  │  - Buffer Management                                     ││
│  │  - Client Priority Management                            ││
│  └─────────────────┬────────────────────────────────────────┘│
│                    │                                          │
│  ┌────────────────▼─────────────────────────────────────────┐│
│  │  ADB Manager                                             ││
│  │  - Device Discovery (adb devices)                        ││
│  │  - Connection Management (100 devices)                   ││
│  │  - Health Monitoring                                     ││
│  └────────────────┬─────────────────────────────────────────┘│
│                   │                                           │
│  ┌───────────────▼──────────────────────────────────────────┐│
│  │  FFmpeg Process Pool                                     ││
│  │  ┌────────┐ ┌────────┐ ┌────────┐                       ││
│  │  │ FFmpeg │ │ FFmpeg │ │ FFmpeg │  ... x100             ││
│  │  │ Proc 1 │ │ Proc 2 │ │ Proc 3 │                       ││
│  │  └───┬────┘ └───┬────┘ └───┬────┘                       ││
│  └──────┼──────────┼──────────┼────────────────────────────┘│
└─────────┼──────────┼──────────┼──────────────────────────────┘
          │          │          │
  ┌───────▼──┐ ┌────▼────┐ ┌──▼──────┐
  │ Device 1 │ │ Device 2│ │ Device 3│  ... x100 via ADB
  │  (USB)   │ │  (USB)  │ │  (USB)  │
  └──────────┘ └─────────┘ └─────────┘
```

---

## Development Collaboration Standards

### Development Order

#### Phase 1: Backend Foundation (NCore)
1. Create ADB device discovery and connection manager
2. Implement FFmpeg process spawning and management
3. Build WebSocket server for stream distribution
4. Add device health monitoring and auto-reconnection

#### Phase 2: Frontend Foundation (Nuxt)
1. Create virtual scroll grid component
2. Implement WebSocket client connection manager
3. Build video player component with MSE/WebCodecs
4. Add device status display

#### Phase 3: Integration
1. Connect Nuxt frontend to NCore WebSocket server
2. Test multi-device streaming (10 devices)
3. Implement dynamic quality switching
4. Performance testing and optimization

#### Phase 4: Scale Testing
1. Test with 50 devices
2. Test with 100 devices
3. Optimize based on performance metrics
4. Add error recovery mechanisms

### Testing Standards

#### Unit Tests
- ADB connection handling
- FFmpeg process management
- WebSocket message handling
- Virtual scroll calculations

#### Integration Tests
- End-to-end device streaming
- Multi-client WebSocket connections
- Quality switching during streaming
- Device reconnection scenarios

#### Performance Tests
- 100 device simultaneous streaming
- Browser memory usage monitoring
- Network bandwidth usage
- CPU usage on server and client

### Deployment Standards

#### Development Environment
```bash
# Start NCore backend
npm run dev app=ScreenCast

# Start Nuxt frontend
cd poly_apps/nuxt_main
yarn dev:screencast
```

#### Production Environment
- Use PM2 for NCore process management
- Enable Nginx reverse proxy for WebSocket
- Configure CDN for static assets
- Set up monitoring and alerting

---

## Technical Implementation Notes

### Critical Performance Optimizations

1. **Virtual Scrolling**: Only render visible devices (20-30 at a time)
2. **Adaptive Streaming**: Adjust quality based on visibility
3. **Connection Pooling**: Reuse WebSocket connections
4. **Hardware Acceleration**: Use WebCodecs API when available
5. **Buffer Management**: Prevent memory leaks from accumulating buffers

### Known Limitations

1. **Browser Limits**: Chrome limits ~100 active WebSocket connections
2. **ADB USB Bandwidth**: Limited by USB hub capabilities
3. **FFmpeg CPU**: Each stream consumes ~5-10% CPU
4. **Memory Usage**: ~50-100MB per active video stream

### Recommended Hardware

#### Server (NCore)
- CPU: 16+ cores (AMD Ryzen 9 or Intel i9)
- RAM: 32GB+
- Storage: SSD 500GB+
- USB Hubs: Multiple powered USB 3.0 hubs (10 ports each)

#### Client (Browser)
- Modern browser (Chrome 90+, Firefox 88+)
- RAM: 8GB+
- GPU: Dedicated GPU recommended for hardware decoding
- Network: 100Mbps+ connection

---

## Future Enhancements

1. **WebRTC Support**: Lower latency alternative to WebSocket
2. **Cloud Streaming**: Support remote device farms
3. **Recording**: Save streams to disk
4. **Interactive Control**: Click to interact with devices
5. **AI Analysis**: Automated testing and anomaly detection
