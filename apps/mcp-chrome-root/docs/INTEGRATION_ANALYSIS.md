# Chrome Recorder Extension - Feature Analysis & Integration Plan

## 📊 Discovered Features Overview

**Source:** `scripts/dev/chrome_extensions/chrome-recorder-extension`

**Extension Name:** Browser Bridge - Remote Control
**Version:** 2.0
**Type:** Remote browser automation + Audio recording

---

## 🔍 Complete Feature List

### 1. **Audio Recording & Streaming** 🎵

#### Core Capabilities:
- **Tab Audio Capture**: Record audio from current browser tab
- **Microphone Input**: Simultaneous mic recording with noise suppression
- **Audio Processing**:
  - Echo cancellation
  - Noise suppression
  - Auto gain control
  - Customized gain levels (1.0x tab, 1.5x mic)
- **Dual Streaming Modes**:
  - **WebSocket**: Real-time binary audio streaming
  - **HTTP**: Chunked upload with FormData
- **Local Save**: Optional local file download (WebM format)
- **Background Recording**: Uses offscreen documents for continuous recording

#### Files:
- `offscreen.js` - Audio mixing and streaming logic
- `offscreen.html` - Offscreen document for background processing

---

### 2. **Remote Command Execution** 🎮

#### API Architecture:
- **Polling Mode**: HTTP polling for commands (configurable interval)
- **WebSocket Mode**: Real-time bidirectional communication
- **Device Registration**: Unique device ID tracking
- **Status Reporting**: Real-time task execution status

#### Supported Commands:

##### Tab Management:
- `open_url` - Open URL in new/current tab
- `close_url` - Close tabs by URL pattern
- `close_tab` - Close specific tab by ID
- `switch_tab` - Switch to tab by ID or URL
- `get_tabs` - List all open tabs with metadata
- `navigate` - Navigate to URL
- `reload` - Reload tab

##### Content Capture:
- `screenshot` - Capture visible area or full page
  - Format: PNG/JPEG
  - Quality control
  - Real-time streaming support
- `get_html` - Extract page HTML
  - Full page or by CSS selector
  - Returns outerHTML
- `get_console` - Capture console logs
  - Intercepts console.log/warn/error/info
  - Buffer management (500 entries max)
  - Optional clear after capture

##### Script Execution:
- `execute_script` - Run arbitrary JavaScript in tab context
  - Function execution
  - Returns result

##### Interaction:
- `click` - Click elements (via script execution)
- `input` - Fill input fields

##### Audio Control:
- `start_audio` - Start audio recording/streaming
- `stop_audio` - Stop recording and download/upload

#### Files:
- `command-handler.js` - Command execution engine
- `service-worker.js` - Background event handling

---

### 3. **Service Discovery** 🔎

#### Network Scanning:
- Auto-discover API servers on local network
- Scan common ports (3000, 8000, 8080, etc.)
- Test connectivity and display available services
- One-click service selection

#### Features:
- IP range scanning
- Connection testing
- Service list caching
- Auto-configuration

#### Files:
- `popup.js` - UI and discovery logic

---

### 4. **Daily Check-in Automation** ⏰

#### Auto-Refresh System:
- Schedule daily site visits
- Configurable time (hour/minute)
- Multi-site support
- Enable/disable per site
- Last check-in tracking

#### Default Sites:
- AnyRouter (example implementation)

#### Features:
- Tab detection (reuse existing if open)
- New tab creation if needed
- Check-in status tracking
- Scheduled execution via alarms

#### Files:
- `daily-checkin.js` - Check-in manager

---

### 5. **Quick Actions** ⚡

- Clear browser cache
- Reload extension
- Close other tabs
- Quick screenshot

---

## 🏗️ Architecture Comparison

### Current Extension Architecture:
```
┌─────────────────────┐
│   Remote Client     │ (Python/Node.js)
└──────┬──────────────┘
       │ HTTP/WebSocket
       ↓
┌─────────────────────┐
│  Service Worker     │ - Command routing
│  (Background)       │ - Device registration
└──────┬──────────────┘
       │
       ├─► Offscreen Doc (Audio processing)
       │
       ├─► Content Scripts (Page interaction)
       │
       └─► Chrome APIs (Tabs, Capture, etc.)
```

### MCP-Chrome Architecture:
```
┌─────────────────┐
│  MCP Client     │ (Claude/Cursor)
└────────┬────────┘
         │ MCP Protocol
         ↓
┌─────────────────────────┐
│  Fastify HTTP Server    │ - MCP protocol handling
│  (Native Server)        │ - Tool registration
└────────┬────────────────┘
         │ Native Messaging
         ↓
┌─────────────────────┐
│  Chrome Extension   │ - Background script
│                     │ - Tool execution
└─────────────────────┘
```

---

## 🔄 Integration Strategy

### Phase 1: Audio Recording Features ⭐ **HIGH VALUE**

#### New MCP Tools to Add:

1. **`chrome_audio_start`**
   ```typescript
   {
     tabId?: number,
     includeMicrophone: boolean,
     streamingMode: 'none' | 'websocket' | 'http',
     streamingUrl?: string,
     saveLocal: boolean,
     chunkInterval: number
   }
   ```

2. **`chrome_audio_stop`**
   ```typescript
   {
     returnData: boolean  // Return audio blob or just confirm
   }
   ```

3. **`chrome_audio_status`**
   ```typescript
   // Returns recording status, duration, chunk count
   ```

#### Implementation:
- **Extension Side** (`app/chrome-extension/`):
  - Copy `offscreen.js` → `entrypoints/offscreen/audio-recorder.ts`
  - Add audio tool handlers in `background/tools/audio.ts`
  - Register offscreen document capability

- **Server Side** (`app/native-server/`):
  - Add tool schemas in `packages/shared/src/tools.ts`
  - Handle audio streaming in server routes
  - Support WebSocket audio forwarding

#### Why Integrate:
- ✅ Unique capability not in original MCP-Chrome
- ✅ Useful for voice transcription, meeting recording
- ✅ Can integrate with AI audio analysis

---

### Phase 2: Console Logging **MEDIUM VALUE**

#### New MCP Tool:

**`chrome_get_console_logs`**
```typescript
{
  tabId?: number,
  clear: boolean,
  types: ('log' | 'warn' | 'error' | 'info')[]
}
```

#### Implementation:
- **Extension Side**:
  - Add console interceptor in `background/tools/console.ts`
  - Inject monitoring script into tabs

- **Server Side**:
  - Add tool schema
  - Handle log retrieval requests

#### Why Integrate:
- ✅ **Already exists** in MCP-Chrome as `chrome_console` tool!
- ✅ But can enhance with better buffering from recorder extension
- ✅ Add filtering by log type

---

### Phase 3: Service Discovery **LOW VALUE**

#### Analysis:
- ❌ MCP-Chrome uses Native Messaging, not HTTP polling
- ❌ Service discovery not needed (fixed connection)
- ⚠️ **Not recommended for integration**

---

### Phase 4: Daily Check-in **LOW VALUE**

#### Analysis:
- ❌ Too specific to original extension's use case
- ❌ Can be achieved with MCP tools + external scheduler
- ⚠️ **Not recommended for integration**

---

### Phase 5: Remote Command Polling **REDUNDANT**

#### Analysis:
- ❌ MCP protocol already handles command routing
- ❌ Polling is less efficient than MCP's request/response
- ❌ Device registration redundant with MCP sessions
- ⚠️ **Not recommended - MCP is superior**

---

## 📋 Integration Checklist

### **Recommended Features to Integrate:**

- [x] ⭐ **Audio Recording & Streaming** (Phase 1)
  - [ ] Copy offscreen audio processing
  - [ ] Add MCP tool schemas
  - [ ] Implement streaming endpoints
  - [ ] Add WebSocket support for audio
  - [ ] Test with real audio capture

- [x] 🔄 **Enhanced Console Logging** (Phase 2)
  - [ ] Review existing `chrome_console` tool
  - [ ] Add log type filtering
  - [ ] Improve buffer management
  - [ ] Add clear functionality

### **Not Recommended:**

- ❌ Service Discovery (use Native Messaging config instead)
- ❌ Daily Check-in (use external cron + MCP tools)
- ❌ Remote Polling (MCP protocol is better)

---

## 🛠️ Implementation Steps

### Step 1: Add Audio Recording Support

#### 1.1 Extension Changes

**File:** `app/chrome-extension/entrypoints/offscreen/audio-recorder.html`
```html
<!DOCTYPE html>
<html>
<head>
  <title>Audio Recorder Offscreen</title>
</head>
<body>
  <script src="./audio-recorder.ts"></script>
</body>
</html>
```

**File:** `app/chrome-extension/entrypoints/offscreen/audio-recorder.ts`
```typescript
// Port the core logic from offscreen.js
// Convert to TypeScript
// Add MCP-compatible message handlers
```

**File:** `app/chrome-extension/entrypoints/background/tools/audio.ts`
```typescript
import { sendNativeMessage } from '../native-host';

export async function handleAudioStart(params: {
  tabId?: number;
  includeMicrophone?: boolean;
  streamingMode?: 'websocket' | 'http' | 'none';
  streamingUrl?: string;
  saveLocal?: boolean;
  chunkInterval?: number;
}) {
  // 1. Create offscreen document if needed
  // 2. Get tab audio stream ID
  // 3. Send config to offscreen recorder
  // 4. Return success
}

export async function handleAudioStop() {
  // 1. Stop recording
  // 2. Close offscreen document
  // 3. Return recorded data or confirmation
}
```

#### 1.2 Server Changes

**File:** `packages/shared/src/tools.ts`
```typescript
// Add audio tool schemas
export const AUDIO_TOOLS = {
  chrome_audio_start: {
    name: 'chrome_audio_start',
    description: 'Start recording audio from browser tab and/or microphone',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: { type: 'number' },
        includeMicrophone: { type: 'boolean', default: true },
        streamingMode: {
          type: 'string',
          enum: ['websocket', 'http', 'none'],
          default: 'none'
        },
        streamingUrl: { type: 'string' },
        saveLocal: { type: 'boolean', default: true },
        chunkInterval: { type: 'number', default: 1000 }
      }
    }
  },
  // ... other audio tools
};
```

**File:** `app/native-server/src/server/index.ts`
```typescript
// Add WebSocket endpoint for audio streaming
this.fastify.get('/audio-stream', { websocket: true }, (connection, req) => {
  connection.on('message', (message) => {
    // Forward audio chunks to MCP client or external service
  });
});
```

#### 1.3 Documentation

**File:** `docs/TOOLS.md`
```markdown
### Audio Recording

#### chrome_audio_start
Start recording audio from browser tab and/or microphone.

**Parameters:**
- `tabId` (optional): Tab ID to record. Defaults to active tab.
- `includeMicrophone` (boolean): Include microphone input. Default: true
- `streamingMode` ('websocket' | 'http' | 'none'): How to stream audio
- `streamingUrl` (string): URL for streaming (if mode is websocket/http)
- `saveLocal` (boolean): Save recording locally. Default: true
- `chunkInterval` (number): Chunk size in ms. Default: 1000

**Returns:**
```json
{
  "success": true,
  "data": {
    "recording": true,
    "tabId": 123,
    "includeMicrophone": true
  }
}
```
```

---

## 💡 Benefits of Integration

### Audio Recording:
1. **AI Audio Analysis**: Feed audio to Claude for transcription, analysis
2. **Meeting Capture**: Record browser-based meetings (Zoom, Google Meet)
3. **Tutorial Creation**: Capture narrated web browsing
4. **Voice Commands**: Process voice input with AI

### Enhanced Console Logging:
1. **Better Debugging**: Filter and search console output
2. **Error Tracking**: Monitor specific error patterns
3. **Performance Monitoring**: Track performance warnings

---

## 🚫 Why Not Integrate Everything?

### Service Discovery:
- MCP uses Native Messaging (fixed connection)
- No need for dynamic server discovery
- Would complicate configuration

### Daily Check-in:
- Too specialized
- Better handled by external scheduler
- MCP tools can already navigate and click

### Remote Polling:
- MCP protocol is superior (request/response)
- Polling wastes resources
- Real-time communication via MCP

---

## 📈 Estimated Effort

### Audio Recording Integration:
- **Extension Work**: 2-3 days
  - Port offscreen document
  - Add tool handlers
  - Test audio capture

- **Server Work**: 1-2 days
  - Add tool schemas
  - WebSocket streaming support
  - Documentation

- **Total**: ~1 week

### Enhanced Console Logging:
- **Extension Work**: 1 day
  - Enhance existing tool
  - Add filtering

- **Server Work**: 0.5 day
  - Update schemas
  - Documentation

- **Total**: ~1-2 days

---

## 🎯 Recommendation

**Prioritize Phase 1 (Audio Recording)** for the following reasons:

1. ✅ **Unique Capability**: Not available in current MCP-Chrome
2. ✅ **High AI Integration Value**: Audio transcription, analysis
3. ✅ **Clean Architecture**: Offscreen document pattern fits well
4. ✅ **Real-time Streaming**: WebSocket support enables live processing
5. ✅ **Reasonable Effort**: ~1 week implementation

**Phase 2 (Console Logging)** can be done as enhancement to existing tool.

**Skip Phases 3-5** as they don't fit MCP architecture or add significant value.
