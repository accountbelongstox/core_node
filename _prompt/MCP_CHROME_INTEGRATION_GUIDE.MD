# MCP Chrome Integration Development Guide

> **Merged from**: `MCP客户端.txt`, `CHROME桥接MCP开发.md`, `MCPCHROME服务端开发.md`
> **Last Updated**: 2025-01-XX

## Table of Contents
1. [MCP Client Development](#mcp-client-development)
2. [Chrome Extension Bridging](#chrome-extension-bridging)
3. [Server Development](#server-development)
4. [System Architecture and Workflow](#system-architecture-and-workflow)
5. [Feature Extensions](#feature-extensions)

---

## MCP Client Development

### PyCore Module Caller

**File**: `python .\pycore_module_caller.py`

**Features**:
- MCP integration with `pycore_module_caller`
- Call tray system
- Display system tray menu on Windows

### Singleton Pattern Extension

**Involved Files**:
- `pycore\pylauncher\launcher.py`
- `pycore\pylauncher\singleton_detector.py`
- RPC v2 endpoint of `python .\pycore_module_caller.py`

**Requirements**:
1. Add a protocol exit port
2. Give `pycore_module_caller` a global transaction state
3. Can be placed in thread bus:
   - Reject exit when busy
   - Exit when idle
   - When starting a new endpoint, if port is occupied, send protocol inquiry
   - If previous one refuses to exit, continue using previous one

**Global Busy State**:
- Set by specific task classes
- Can be set when there are tasks being processed
- Document in code

**Notes**: 
- Use only one singleton globally
- Do not duplicate logic in tray
- Reuse previous code, scan old code first to see content

### Thread Bus System

Use standard thread bus system, change tray menu to:
- Open web interface
- Restart
- Exit

**Platform Differences**:
- Further check if Windows/Linux differences are complete

---

## Chrome Extension Bridging

### Project Location

`apps\mcp-chrome`

**Requirements**:
- Do not need .git dependencies (already in main project)
- All code in English

### Path Mapping

Find Windows map path web and Linux equivalent map path web, map to project root directory.

**Modify Extension**:
- Change to not start `npm install -g mcp-chrome-bridge`
- Instead start project compilation (non-debug)

### Compilation Output

`.output` output modified to `www/programing/_build_dir`

**Notes**:
- Directory is automatically created
- Based on relative paths, not hardcoded
- Same on Windows and Linux
- Server unchanged, only extension output directory changed for easy import

### Permission Handling

Find `./scripts/shells/linux/common/get_real_user.sh` to get actual user.

**Call in compilation script**:
- Automatically correct permissions to regular user when creating under root
- Also correct permissions after compilation
- Compilation runs under root, use sudo for creating directories, then correct permissions

### API Recovery

Extend API recovery option, recovered API is same-origin with domain:
- Browser accesses whichever URL it is
- Could be IP or domain
- Provided as auto-detection method, not string

### Compilation Script

`./apps/mcp-chrome/scripts/start.sh`

---

## Server Development

### Service Startup Flow

#### 1. How Extension Starts Service

**Startup Flow Sequence Diagram**:

```
User clicks Connect button
    ↓
[Popup UI] testNativeConnection()
    ↓ chrome.runtime.sendMessage({ type: 'connectNative', port: 12306 })
    ↓
[Background] chrome.runtime.onMessage.addListener()
    ↓ Receives 'connectNative' message
    ↓
[Background] connectNativeHost(12306)
    ↓ chrome.runtime.connectNative('com.chromemcp.nativehost')
    ↓
[Chrome Browser] Find Native Messaging Host configuration
    ↓ Read:
~/.config/google-chrome/NativeMessagingHosts/com.chromemcp.nativehost.json
    ↓ path: /www/programing/core_node/apps/mcp-chrome/app/native-server/dist/run_host.sh
    ↓
[Chrome Browser] Start Node.js process
    ↓ Execute: run_host.sh → node index.js
    ↓
[Native Server] index.js starts
    ↓ Create server and nativeMessagingHost instances
    ↓ nativeMessagingHost.start() listens to stdin
    ↓
[Background] nativePort.postMessage({ type: 'start', payload: { port: 12306 } })
    ↓ Send START message via stdin
    ↓
[Native Server] handleMessage(START)
    ↓ Call startServer(12306)
    ↓ fastify.listen({ port: 12306, host: '127.0.0.1' })
    ↓
[HTTP Server] Started successfully, listening on http://127.0.0.1:12306
    ↓
[Native Server] sendMessage({ type: 'server_started', payload: { port: 12306 } })
    ↓ Return startup success message via stdout
    ↓
[Background] nativePort.onMessage.addListener()
    ↓ Receive SERVER_STARTED message
    ↓ Update currentServerStatus = { isRunning: true, port: 12306 }
    ↓ broadcastServerStatusChange() broadcast status
    ↓
[Popup UI] Receive status update
    ↓ Display "Service running on port 12306"
    ✓ Startup complete
```

#### 2. How AI Connects to MCP

**MCP Connection Flow**:

```
[Claude/AI Client] Read MCP configuration
    ↓
Configuration file:
{
  "mcpServers": {
    "chrome": {
      "type": "streamable-http",
      "url": "http://127.0.0.1:12306/mcp"
    }
  }
}
    ↓
[AI Client] Send initialize request
    ↓ POST http://127.0.0.1:12306/mcp
    ↓ Body: { jsonrpc: '2.0', method: 'initialize', ... }
    ↓
[Fastify Server] POST /mcp route
    ↓ Check mcp-session-id header (undefined on first request)
    ↓ Detect initialize request
    ↓
[Server] Create new session
    ↓ sessionId = randomUUID()
    ↓ transport = new StreamableHTTPServerTransport(...)
    ↓ transportsMap.set(sessionId, transport)
    ↓
[Server] Connect MCP Server
    ↓ await getMcpServer().connect(transport)
    ↓ Return capabilities (tools list)
    ↓
[AI Client] Receive initialize response
    ↓ Save mcp-session-id
    ↓ Connection established successfully
    ✓
```

**Subsequent Requests**:

```
[AI Client] Call tool
    ↓ POST /mcp
    ↓ Headers: mcp-session-id: <uuid>
    ↓ Body: { method: 'tools/call', params: { name: 'screenshot', ... } }
    ↓
[Server] Find session
    ↓ transport = transportsMap.get(sessionId)
    ↓ Route to established MCP connection
    ↓
[MCP Server] Process tool call
    ↓ Send to Chrome Extension via Native Messaging
    ↓ Extension executes browser operation
    ↓ Return result
    ↓
[AI Client] Receive tool execution result
    ✓
```

### MCP Configuration Verification

Confirm that starting `ncore_module_caller.js` will start MCP.

**Configuration Format**:
```json
{
  "type": "streamableHttp",
  "url": "http://127.0.0.1:xxxxx/mcp"
}
```

Check if this URL exists after startup.

---

## System Architecture and Workflow

### Overall Architecture

1. **Chrome Extension** (Frontend)
   - Popup UI
   - Background Script
   - Content Script

2. **Native Messaging Host** (Bridge Layer)
   - Node.js process
   - Communicate with Extension via stdin/stdout
   - Start HTTP server

3. **MCP Server** (Server)
   - Fastify HTTP server
   - Handle MCP protocol
   - Manage sessions

4. **AI Client** (External)
   - Connect to MCP Server via HTTP
   - Call tools to execute browser operations

### Communication Protocols

1. **Extension ↔ Native Host**: Native Messaging Protocol (JSON over stdin/stdout)
2. **Native Host ↔ MCP Server**: Internal (same process)
3. **MCP Server ↔ AI Client**: HTTP (Streamable HTTP Transport)

---

## Feature Extensions

### Audio Features

**MCP Tools**:
- Listen to audio (simultaneously listen to microphone):
  - 1 minute
  - 10 minutes
  - Record until current audio ends (30 seconds of no audio stream)

**Tool Functions**:
- `chrome_audio_start`
- `chrome_audio_stop`
- `chrome_audio_status`
- `chrome_during`

**Audio Stream Processing**:
- Audio stream can be obtained by AI tools
- Can also be streamed to API server after plugin management panel is enabled
- Can enable real-time streaming
- Push recorded files
- Multiple API servers can be configured
- Can design streaming method separately for each

### Console Tool Improvements

Improve existing `chrome_console` tool:
- Default is to output all information
- Include error information for AI

### Plugin Panel Features

**Settings Center**:
- Switch API using settings API
- Whether to start local tasks (API request tasks completed locally, and pause)
- Use unified state center
- Standardize panel overall, do not have unrelated pieces scattered around

**API Features**:
- Change API features to be integrated in plugin panel
- Can save to store
- Panel also has: enable database listening and send to API option

**AI-powered chat assistant**:
- Display as a grid
- Each extension as a cell
- Cell shows introduction and on/off switch
- Has start task and stop at the top
- Can pause after starting
- View current global task system
- Start timed pulsing after startup
- Start each task on hook (checked ones start)
- Each grid click can show current extension details
- Pay attention to beautification

---

## Development Notes

### Code Standards

1. **All English Code**: All code must be in English
2. **Path Mapping**: Use map path web mapping, support Windows/Linux
3. **Permission Handling**: Automatically correct permissions to regular user when running under root
4. **Relative Paths**: Use relative paths, do not hardcode
5. **Singleton Pattern**: Use only one singleton globally, do not duplicate logic in tray

### Testing and Verification

1. Confirm `ncore_module_caller.js` starts MCP
2. Verify `http://127.0.0.1:xxxxx/mcp` URL exists
3. Test Extension and Native Host communication
4. Test MCP Server and AI client connection
5. Test tool call flow

---

## Related Documents

- `apps/mcp-chrome/README.md` - Original project documentation
- MCP official documentation
- Chrome Native Messaging documentation

