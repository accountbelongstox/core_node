# ScreenCast System - 100 Device Screen Mirroring Technical Solution

## Executive Summary

This document outlines a complete technical solution for real-time screen mirroring of 100+ mobile devices through a single web interface, using ADB and FFmpeg as the underlying streaming infrastructure.

**Feasibility Conclusion**: ✅ **Achievable** with intelligent optimization strategies

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Web Browser Client                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │         Nuxt 4 Frontend Application                        │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │  Virtual Scroll Grid (10x10 visible grid)           │  │ │
│  │  │  - Render only 20-30 visible devices                │  │ │
│  │  │  - Dynamic quality switching                         │  │ │
│  │  │  - WebCodecs hardware decoding                       │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  │                                                              │ │
│  │  WebSocket Manager (100 concurrent connections)             │ │
│  │  - Connection pooling                                       │ │
│  │  - Automatic reconnection                                   │ │
│  │  - Heartbeat management                                     │ │
│  └──────────────────────────────────────────────────────────────┘│
└────────────────────────┬───────────────────────────────────────┘
                         │ HTTP/WS
                         │
┌────────────────────────▼──────────────────────────────────────┐
│                  Node.js Backend Server                        │
│                   (NCore ScreenCast App)                       │
│  ┌───────────────────────────────────────────────────────────┐│
│  │  Express HTTP Server (Port 15460)                         ││
│  │  - Device management API                                  ││
│  │  - Stream control API                                     ││
│  │  - Health check endpoints                                 ││
│  └───────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐│
│  │  WebSocket Server (Port 15461)                            ││
│  │  - Multi-client stream distribution                       ││
│  │  - Binary data transmission (H.264)                       ││
│  │  - Quality adaptation per client                          ││
│  └───────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐│
│  │  Stream Manager                                            ││
│  │  - FFmpeg process pool (100 processes)                    ││
│  │  - Dynamic quality control                                ││
│  │  - Resource allocation                                    ││
│  │  - Buffer management                                      ││
│  └───────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐│
│  │  ADB Manager                                               ││
│  │  - Device discovery (adb devices -l)                      ││
│  │  - Connection management (100 devices)                    ││
│  │  - Health monitoring (periodic checks)                    ││
│  │  - Auto-reconnection                                      ││
│  └───────────────────────────────────────────────────────────┘│
└─────────────────────────┬─────────────────────────────────────┘
                          │ USB / Network ADB
                          │
┌─────────────────────────▼─────────────────────────────────────┐
│                    Mobile Device Farm                          │
│  ┌────────┐ ┌────────┐ ┌────────┐                             │
│  │Device 1│ │Device 2│ │Device 3│  ... x100                   │
│  │ USB 1  │ │ USB 2  │ │ USB 3  │                             │
│  └────────┘ └────────┘ └────────┘                             │
│                                                                 │
│  Connected via:                                                 │
│  - 10x USB 3.0 Powered Hubs (10 devices each)                 │
│  - Network ADB (optional for wireless devices)                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Technical Challenges and Solutions

### Challenge 1: Bandwidth Requirements

**Problem**: 100 devices × 500-800 kbps = 50-80 Mbps total bandwidth

**Solution**: Three-Tier Quality Strategy

| Tier | Scenario | FPS | Resolution | Bitrate | Bandwidth per device |
|------|----------|-----|------------|---------|---------------------|
| **High** | Focused device (1) | 30fps | 720x1280 | 800kbps | 800kbps |
| **Medium** | Visible devices (20-30) | 15fps | 540x960 | 500kbps | 500kbps |
| **Low** | Background devices (70-80) | 5fps | 360x640 | 200kbps | 200kbps |

**Effective Bandwidth**: 1×800 + 30×500 + 70×200 = 800 + 15,000 + 14,000 = **29.8 Mbps** (60% reduction)

---

### Challenge 2: Browser Rendering Performance

**Problem**: Rendering 100 video streams simultaneously causes browser freeze

**Solution**: Virtual Scrolling + Lazy Rendering

```typescript
// Only render devices in viewport + buffer zone
const visibleDevices = calculateVisibleDevices({
  scrollTop: viewport.scrollTop,
  viewportHeight: viewport.height,
  bufferZone: 200, // pixels
  totalDevices: 100
});

// Result: Only 20-30 DOM elements at any time
// 70-80 devices remain as placeholders (no video element)
```

**Implementation**:
- Use `IntersectionObserver` API to detect visibility
- Destroy video elements when scrolled out of view
- Maintain WebSocket connection but pause rendering
- Reconstruct video element when scrolled back into view

---

### Challenge 3: WebSocket Connection Limits

**Problem**: Chrome limits ~256 concurrent WebSockets, Firefox ~200

**Solution**: Connection Pooling with Priority Management

```typescript
interface ConnectionPool {
  active: Map<deviceId, WebSocket>;      // Currently streaming
  paused: Map<deviceId, WebSocket>;      // Connected but paused
  maxActive: 30;                         // Maximum active streams
  maxTotal: 100;                         // Maximum total connections
}

// Priority system
enum Priority {
  FOCUSED = 3,    // User clicked/focused device
  VISIBLE = 2,    // Device in viewport
  BACKGROUND = 1  // Device outside viewport
}
```

**Strategy**:
1. Maintain all 100 WebSocket connections
2. Only request stream data for visible + focused devices (30 max)
3. Other connections remain idle (control messages only)
4. When user scrolls, dynamically switch active streams

---

### Challenge 4: Server CPU/Memory Load

**Problem**: 100 FFmpeg processes consuming 500-1000% CPU total

**Solution**: Optimized FFmpeg Configuration

```bash
# Ultra-fast preset for low CPU usage
ffmpeg -f android_screencap -i - \
  -vcodec libx264 \
  -preset ultrafast \
  -tune zerolatency \
  -g 60 \
  -sc_threshold 0 \
  -b:v 500k \
  -maxrate 500k \
  -bufsize 1000k \
  -r 15 \
  -s 540x960 \
  -f mpegts \
  pipe:1
```

**Key optimizations**:
- `ultrafast` preset: Minimal CPU usage per stream (~3-5% per process)
- `zerolatency` tune: Minimize buffering for real-time streaming
- `mpegts` format: Streamable container (no seeking required)
- Adaptive GOP size based on frame rate

**Expected CPU usage**: 100 devices × 5% = 500% (6 cores fully loaded on 16-core CPU)

---

### Challenge 5: ADB Connection Stability

**Problem**: USB devices randomly disconnect, ADB daemon crashes

**Solution**: Robust Connection Management

```typescript
class AdbManager {
  async monitorDevices() {
    setInterval(async () => {
      // 1. Health check all devices
      const currentDevices = await this.listDevices();

      // 2. Detect disconnections
      const disconnected = this.detectDisconnections(currentDevices);
      disconnected.forEach(device => this.handleDisconnection(device));

      // 3. Detect new devices
      const newDevices = this.detectNewDevices(currentDevices);
      newDevices.forEach(device => this.handleNewDevice(device));

      // 4. Restart failed streams
      this.restartFailedStreams();

    }, 10000); // Every 10 seconds
  }

  async handleDisconnection(device: Device) {
    // 1. Kill FFmpeg process
    await this.killStream(device.id);

    // 2. Update device status
    device.status = 'disconnected';

    // 3. Notify clients via WebSocket
    this.broadcastDeviceStatus(device);
  }

  async restartFailedStreams() {
    const failedStreams = this.getFailedStreams();

    for (const stream of failedStreams) {
      if (stream.retryCount < 3) {
        await this.restartStream(stream.deviceId);
        stream.retryCount++;
      }
    }
  }
}
```

---

## Detailed Implementation Plan

### Backend (NCore ScreenCast App)

#### 1. ADB Manager (`server_controller/AdbManager.js`)

**Responsibilities**:
- Discover connected devices via `adb devices -l`
- Parse device information (serial, model, state)
- Monitor device connections (polling every 10s)
- Provide device list to API layer

**Key Methods**:
```javascript
class AdbManager {
  async initialize()
  async listDevices()
  async getDeviceInfo(serial)
  async monitorDevices()
  async restartAdbServer()
}
```

#### 2. Stream Manager (`server_controller/StreamManager.js`)

**Responsibilities**:
- Spawn and manage FFmpeg processes
- Control stream quality per device
- Handle stream lifecycle (start/stop/restart)
- Monitor FFmpeg output and errors

**Key Methods**:
```javascript
class StreamManager {
  async startStream(deviceId, config)
  async stopStream(deviceId)
  async updateStreamQuality(deviceId, quality)
  async getStreamMetrics(deviceId)
  getActiveStreams()
}
```

**FFmpeg Command Builder**:
```javascript
buildFFmpegCommand(deviceId, config) {
  const { fps, bitrate, resolution, codec } = config;

  return [
    'adb', '-s', deviceId, 'exec-out', 'screenrecord',
    '--output-format=h264',
    `--bit-rate=${parseBitrate(bitrate)}`,
    '--size', resolution,
    '-'
  ].concat([
    '|', 'ffmpeg',
    '-i', 'pipe:0',
    '-vcodec', codec,
    '-preset', 'ultrafast',
    '-tune', 'zerolatency',
    '-r', fps.toString(),
    '-f', 'mpegts',
    'pipe:1'
  ]);
}
```

#### 3. WebSocket Server (`server_controller/WebSocketServer.js`)

**Responsibilities**:
- Accept client WebSocket connections
- Stream H.264 data to clients
- Handle client quality change requests
- Broadcast device status updates

**Key Methods**:
```javascript
class WebSocketServer {
  start(port)
  handleConnection(ws, deviceId)
  broadcastStreamData(deviceId, chunk)
  broadcastDeviceStatus(device)
  handleClientMessage(ws, message)
}
```

#### 4. HTTP API (`http_controller/ScreenCastController.js`)

**Endpoints**:
```javascript
GET    /api/screencast/devices
GET    /api/screencast/devices/:id
POST   /api/screencast/devices/:id/stream/start
POST   /api/screencast/devices/:id/stream/stop
PUT    /api/screencast/devices/:id/stream/config
POST   /api/screencast/adb/refresh
GET    /api/screencast/health
```

---

### Frontend (Nuxt App screencast)

#### 1. Virtual Scroll Grid Component (`components/DeviceGrid.vue`)

```vue
<template>
  <div
    ref="scrollContainer"
    class="device-grid-container"
    @scroll="handleScroll"
  >
    <div
      :style="{ height: totalHeight + 'px' }"
      class="grid-content"
    >
      <DeviceCard
        v-for="device in visibleDevices"
        :key="device.id"
        :device="device"
        :style="getDevicePosition(device)"
        @focus="handleFocus"
      />
    </div>
  </div>
</template>

<script setup>
const visibleDevices = computed(() => {
  const startIndex = Math.floor(scrollTop.value / cellHeight) * columns;
  const endIndex = startIndex + (visibleRows * columns);

  return devices.value.slice(
    Math.max(0, startIndex - bufferSize),
    Math.min(devices.value.length, endIndex + bufferSize)
  );
});
</script>
```

**Key Features**:
- Calculate visible devices based on scroll position
- Render buffer zone above/below viewport
- Absolute positioning for smooth scrolling
- Intersection Observer for accurate visibility detection

#### 2. Video Player Component (`components/DevicePlayer.vue`)

```vue
<template>
  <div class="device-player">
    <video
      ref="videoElement"
      autoplay
      muted
      playsinline
    />
    <div class="metrics">
      {{ metrics.fps }}fps | {{ metrics.latency }}ms
    </div>
  </div>
</template>

<script setup>
const props = defineProps(['device']);
const { connect, disconnect, metrics } = useStreamPlayer(props.device.id);

onMounted(async () => {
  await connect();
});

onBeforeUnmount(() => {
  disconnect();
});
</script>
```

#### 3. WebSocket Stream Composable (`composables/useStreamPlayer.ts`)

```typescript
export function useStreamPlayer(deviceId: string) {
  const videoElement = ref<HTMLVideoElement | null>(null);
  const mediaSource = ref<MediaSource | null>(null);
  const sourceBuffer = ref<SourceBuffer | null>(null);
  const ws = ref<WebSocket | null>(null);
  const metrics = ref<DeviceMetrics>({
    fps: 0,
    bitrate: 0,
    latency: 0,
    frameDrops: 0
  });

  const connect = async () => {
    // 1. Create MediaSource
    mediaSource.value = new MediaSource();
    videoElement.value!.src = URL.createObjectURL(mediaSource.value);

    // 2. Wait for MediaSource to be ready
    await new Promise(resolve => {
      mediaSource.value!.addEventListener('sourceopen', resolve);
    });

    // 3. Create SourceBuffer
    sourceBuffer.value = mediaSource.value!.addSourceBuffer(
      'video/mp2t; codecs="avc1.42E01E"' // H.264 Baseline
    );

    // 4. Connect WebSocket
    ws.value = new WebSocket(`ws://localhost:15461/stream/${deviceId}`);
    ws.value.binaryType = 'arraybuffer';

    ws.value.onmessage = (event) => {
      const message = parseMessage(event.data);

      if (message.type === 'stream_data') {
        appendToBuffer(message.data.chunk);
      } else if (message.type === 'device_metrics') {
        metrics.value = message.data.metrics;
      }
    };
  };

  const appendToBuffer = (chunk: ArrayBuffer) => {
    if (sourceBuffer.value && !sourceBuffer.value.updating) {
      try {
        sourceBuffer.value.appendBuffer(chunk);
      } catch (e) {
        console.error('Buffer append error:', e);
      }
    }
  };

  const disconnect = () => {
    ws.value?.close();
    mediaSource.value?.endOfStream();
    URL.revokeObjectURL(videoElement.value!.src);
  };

  const updateQuality = async (quality: StreamQuality) => {
    ws.value?.send(JSON.stringify({
      type: 'update_config',
      data: { quality }
    }));
  };

  return {
    videoElement,
    metrics,
    connect,
    disconnect,
    updateQuality
  };
}
```

#### 4. Device Management Composable (`composables/useScreenCast.ts`)

```typescript
export function useScreenCast() {
  const devices = ref<Device[]>([]);
  const loading = ref(false);
  const error = ref<Error | null>(null);

  const fetchDevices = async () => {
    loading.value = true;
    try {
      const response = await $fetch('/api/screencast/devices');
      devices.value = response.data;
    } catch (e) {
      error.value = e;
    } finally {
      loading.value = false;
    }
  };

  const startStream = async (deviceId: string, quality = 'medium') => {
    await $fetch(`/api/screencast/devices/${deviceId}/stream/start`, {
      method: 'POST',
      body: { quality }
    });

    await fetchDevices();
  };

  const stopStream = async (deviceId: string) => {
    await $fetch(`/api/screencast/devices/${deviceId}/stream/stop`, {
      method: 'POST'
    });

    await fetchDevices();
  };

  return {
    devices,
    loading,
    error,
    fetchDevices,
    startStream,
    stopStream
  };
}
```

---

## Performance Optimization Strategies

### 1. Client-Side Optimizations

#### WebCodecs API (Hardware Acceleration)
```typescript
// Use WebCodecs for hardware-accelerated H.264 decoding
if ('VideoDecoder' in window) {
  const decoder = new VideoDecoder({
    output: (frame) => {
      ctx.drawImage(frame, 0, 0);
      frame.close();
    },
    error: (e) => console.error('Decode error:', e)
  });

  decoder.configure({
    codec: 'avc1.42E01E',
    codedWidth: 540,
    codedHeight: 960
  });
}
```

**Benefits**:
- 5-10x faster decoding than software
- Lower CPU usage (10-15% vs 40-50%)
- Smoother playback at higher frame rates

#### RequestAnimationFrame for Smooth Rendering
```typescript
const renderLoop = () => {
  // Update visible devices
  updateVisibleDevices();

  // Process pending buffer chunks
  processPendingBuffers();

  // Request next frame
  requestAnimationFrame(renderLoop);
};
```

#### Web Workers for Message Processing
```typescript
// Offload WebSocket message parsing to worker
const worker = new Worker('/workers/stream-processor.js');

ws.onmessage = (event) => {
  worker.postMessage(event.data);
};

worker.onmessage = (event) => {
  const { deviceId, chunk } = event.data;
  appendToBuffer(deviceId, chunk);
};
```

---

### 2. Server-Side Optimizations

#### FFmpeg Process Pooling
```javascript
class FFmpegPool {
  constructor(maxProcesses = 100) {
    this.maxProcesses = maxProcesses;
    this.activeProcesses = new Map();
    this.processQueue = [];
  }

  async spawn(deviceId, config) {
    if (this.activeProcesses.size >= this.maxProcesses) {
      // Wait for available slot or kill low-priority stream
      await this.waitForSlot();
    }

    const process = this.createFFmpegProcess(deviceId, config);
    this.activeProcesses.set(deviceId, process);

    return process;
  }

  async killLowestPriority() {
    // Kill background quality streams first
    const backgroundStreams = Array.from(this.activeProcesses.entries())
      .filter(([_, p]) => p.quality === 'low')
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

    if (backgroundStreams.length > 0) {
      const [deviceId] = backgroundStreams[0];
      await this.kill(deviceId);
    }
  }
}
```

#### Adaptive Bitrate Control
```javascript
class BitrateController {
  adjustBitrate(deviceId, networkCondition) {
    const currentBitrate = this.getStreamBitrate(deviceId);

    if (networkCondition === 'poor') {
      // Reduce bitrate by 30%
      return Math.floor(currentBitrate * 0.7);
    } else if (networkCondition === 'excellent') {
      // Increase bitrate by 20% (max 800k)
      return Math.min(800, Math.floor(currentBitrate * 1.2));
    }

    return currentBitrate;
  }

  detectNetworkCondition() {
    // Monitor WebSocket buffer size
    const bufferSize = this.getTotalBufferSize();

    if (bufferSize > 10 * 1024 * 1024) { // 10MB
      return 'poor';
    } else if (bufferSize < 1 * 1024 * 1024) { // 1MB
      return 'excellent';
    }

    return 'normal';
  }
}
```

---

## Hardware Requirements

### Server Specifications

| Component | Minimum | Recommended | Optimal |
|-----------|---------|-------------|---------|
| **CPU** | 8 cores (i7-9700K) | 12 cores (Ryzen 9 3900X) | 16+ cores (Ryzen 9 5950X) |
| **RAM** | 16GB | 32GB | 64GB |
| **Storage** | 256GB SSD | 512GB NVMe SSD | 1TB NVMe SSD |
| **Network** | 1 Gbps | 1 Gbps | 10 Gbps |
| **USB Hubs** | 10x USB 3.0 (10-port) | 10x USB 3.0 powered | 10x USB 3.1 powered |
| **OS** | Ubuntu 20.04 | Ubuntu 22.04 | Ubuntu 22.04 |

### Client Specifications

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **Browser** | Chrome 90+ | Chrome 110+ |
| **RAM** | 4GB | 8GB+ |
| **CPU** | Dual-core | Quad-core+ |
| **GPU** | Integrated | Dedicated |
| **Network** | 50 Mbps | 100+ Mbps |

---

## Deployment Architecture

### Development Environment

```yaml
# docker-compose.yml
version: '3.8'

services:
  ncore-screencast:
    build: ./apps/ScreenCast
    ports:
      - "15460:15460"  # HTTP API
      - "15461:15461"  # WebSocket
    volumes:
      - /dev/bus/usb:/dev/bus/usb  # USB device access
    privileged: true
    environment:
      - NODE_ENV=development
      - MAX_DEVICES=100

  nuxt-frontend:
    build: ./poly_apps/nuxt_main
    ports:
      - "3001:3001"
    environment:
      - APP_ENTRY=screencast
      - API_URL=http://ncore-screencast:15460
      - WS_URL=ws://ncore-screencast:15461
```

### Production Environment

```
┌───────────────────────────────────────────────┐
│              Nginx Load Balancer               │
│  - SSL termination                             │
│  - WebSocket proxy                             │
│  - Static asset caching                        │
└─────────────┬─────────────────────────────────┘
              │
    ┌─────────┴──────────┐
    │                    │
┌───▼────────┐    ┌──────▼──────┐
│ Nuxt       │    │ NCore       │
│ Frontend   │    │ Backend     │
│ (PM2)      │    │ (PM2)       │
└────────────┘    └──────┬──────┘
                         │
                  ┌──────▼──────┐
                  │ USB Device  │
                  │    Farm     │
                  │ (100 phones)│
                  └─────────────┘
```

**Nginx Configuration**:
```nginx
upstream screencast_backend {
    server localhost:15460;
}

upstream screencast_ws {
    server localhost:15461;
}

server {
    listen 443 ssl http2;
    server_name screencast.example.com;

    # WebSocket proxy
    location /stream/ {
        proxy_pass http://screencast_ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # API proxy
    location /api/screencast/ {
        proxy_pass http://screencast_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Frontend
    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
    }
}
```

---

## Testing Strategy

### Phase 1: Single Device Testing
- Verify ADB connection
- Test FFmpeg streaming
- Validate WebSocket data transmission
- Check frontend video playback

### Phase 2: 10 Device Testing
- Performance baseline measurements
- CPU/RAM usage monitoring
- Network bandwidth verification
- Quality switching validation

### Phase 3: 50 Device Testing
- Stress test system resources
- Identify bottlenecks
- Optimize FFmpeg parameters
- Test virtual scrolling performance

### Phase 4: 100 Device Testing
- Full system integration test
- Long-duration stability test (24h)
- Failover and recovery testing
- Load balancing verification

### Performance Metrics to Track

| Metric | Target | Critical Threshold |
|--------|--------|--------------------|
| Stream latency | < 500ms | < 1000ms |
| Frame drop rate | < 1% | < 5% |
| CPU usage | < 70% | < 85% |
| RAM usage | < 24GB | < 30GB |
| Network usage | < 30 Mbps | < 50 Mbps |
| Browser FPS | > 55fps | > 30fps |

---

## Risk Mitigation

### Risk 1: USB Hub Bandwidth Limitations
**Mitigation**:
- Use USB 3.0 powered hubs (5Gbps per hub)
- Distribute devices across multiple USB controllers
- Monitor per-hub bandwidth usage

### Risk 2: ADB Connection Instability
**Mitigation**:
- Implement automatic reconnection logic
- Use TCP/IP ADB for wireless devices
- Maintain connection health monitoring
- Keep spare devices as hot backups

### Risk 3: Browser Memory Leaks
**Mitigation**:
- Properly dispose MediaSource and SourceBuffer objects
- Limit buffer size (max 10MB per device)
- Periodic garbage collection triggers
- Monitor memory usage with Performance API

### Risk 4: FFmpeg Process Crashes
**Mitigation**:
- Wrap FFmpeg in process monitor (PM2)
- Automatic restart on failure (max 3 retries)
- Log all FFmpeg errors for analysis
- Implement graceful degradation

---

## Future Enhancements

### Phase 2 Features
1. **Interactive Control**: Click to interact with device screen (ADB input tap)
2. **Recording**: Save streams to MP4 files
3. **Playback**: Replay recorded sessions
4. **Multi-user Support**: Multiple clients viewing same streams

### Phase 3 Features
1. **WebRTC Migration**: Lower latency alternative to WebSocket
2. **AI-powered Analysis**: Automated UI testing and anomaly detection
3. **Cloud Integration**: Support remote device farms (AWS Device Farm)
4. **Mobile App**: Native iOS/Android viewer apps

---

## Conclusion

This solution provides a **robust, scalable architecture** for real-time streaming of 100+ mobile device screens through a single web interface.

**Key Success Factors**:
1. ✅ Adaptive quality streaming reduces bandwidth by 60%
2. ✅ Virtual scrolling enables smooth browser rendering
3. ✅ Optimized FFmpeg configuration keeps CPU usage manageable
4. ✅ Robust error handling ensures high availability
5. ✅ Hardware-accelerated decoding provides smooth playback

**Expected Performance**:
- 30fps for focused device
- 15fps for 30 visible devices
- 5fps for 70 background devices
- Total bandwidth: ~30 Mbps
- Server CPU: 50-70%
- Browser memory: 2-4GB

**Timeline**: 4-6 weeks for full implementation and testing
