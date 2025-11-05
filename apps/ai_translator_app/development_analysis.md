# AI Translator App - Development Analysis and Architecture Plan

## Analysis Date: 2025-11-05

## 1. Requirements Analysis

### Current State
- Existing app: `apps/ai_translator_app`
- Uses OpenRouter API for translation
- File watching functionality
- Basic HTTP web interface

### New Requirements
1. WebSocket + HTTP services running simultaneously
2. API process for external API access (OpenRouter)
3. Multiple model processes (DeepSeek-VL local models)
4. Client ID management with callback system

---

## 2. ncore Libraries Analysis

### 2.1 Libraries to USE Directly (No Extension Needed)

#### A. WebSocket + HTTP Server Foundation
**Location**: `ncore/foundation/express_utils/`
**Alias**: Can use `#@ncore/foundation/express_utils/index.js`

**Key Components**:
```
foundation/express_utils/
├── libs/ExpressManager.js     - Express app lifecycle management
├── libs/WsManager.js           - WebSocket server management
├── libs/RouterManager.js       - Route registration and management
├── libs/MiddlewareUtil.js      - Middleware utilities
├── libs/StaticServer.js        - Static file serving
├── libs/res_helper.js          - Response helpers
└── index.js                    - Unified entry point
```

**Usage in App**:
- Use `ExpressManager` to create and manage Express app
- Use `WsManager` to create WebSocket server on same port as HTTP
- Use `RouterManager` to register HTTP routes
- Use `MiddlewareUtil` for CORS, body parsing, etc.

**Reasoning**: Production-ready Express + WebSocket integration following ncore conventions. No need to reimplement.

---

#### B. WebSocket RPC System
**Location**: `ncore/utils/ws_rpc/`

**Key Components**:
```
utils/ws_rpc/
├── WsRpcServer.js              - Server-side RPC implementation
├── WsRpcClient.js              - Client-side RPC implementation
├── libs/AuthManager.js         - Authentication management
├── libs/HeartbeatManager.js    - Connection health monitoring
├── libs/NamespaceManager.js    - Client namespace/group management
├── libs/RateLimiter.js         - Rate limiting
├── libs/InterceptorManager.js  - Request/response interception
├── libs/PerformanceMonitor.js  - Performance tracking
└── libs/MessageCompressor.js   - Message compression
```

**Usage in App**:
- Use `WsRpcServer` for RPC method registration and handling
- Use `NamespaceManager` for client ID tracking and grouping
- Use `HeartbeatManager` to detect client disconnections
- Use `RateLimiter` to protect API endpoints
- Use `AuthManager` if authentication is needed

**Reasoning**: Complete RPC system with client management, perfect for client ID tracking and callbacks. Has all features needed.

**Alternative**: `ncore/utils/wsrpc/` exists but `ws_rpc` has more features.

**Constants Available**: `ncore/global_vars/gcommon/ws_rpc_constants.js` provides standard message types.

**Integration Update** (Phase 1 Completed):
WsRpcServer now supports attaching to existing WebSocket server from express_utils:

```javascript
// Start Express + basic WebSocket
await expressUtils.startExpressServer(config);

// Get WebSocket server instance
const wss = expressUtils.getWebSocketServer();

// Attach RPC to existing server
const wsRpc = new WsRpcServer(wss);
await wsRpc.start();

// Register routes
wsRpc.route('translateText', handler);
```

---

#### B2. HTTP RPC System (NEW - Phase 1 Completed)
**Location**: `ncore/utils/http_rpc/`

**Key Components**:
```
utils/http_rpc/
├── HttpRpcServer.js            - HTTP RPC server implementation
├── HttpRpcClient.js            - HTTP RPC client implementation
├── index.js                    - Entry point
├── example_usage.js            - Server usage example
└── example_client.js           - Client usage example
```

**Features**:
- HTTP-based RPC with same protocol as WebSocket RPC
- Stateless request-response pattern
- Built-in rate limiting, authentication support
- Performance monitoring
- Middleware and interceptor support
- Batch requests support
- Auto-retry mechanism
- Health check endpoint

**Usage in App**:
```javascript
const { HttpRpcServer } = require('#@ncore/utils/http_rpc');

// Create HTTP RPC server
const httpRpc = new HttpRpcServer(app, {
    basePath: '/rpc',
    rateLimit: {
        enabled: true,
        maxRequests: 100,
        windowMs: 60000
    }
});

// Register routes
httpRpc.route('translateText', async (params, sessionId) => {
    return await translationService.translate(params);
});

httpRpc.start();
```

**Client Usage**:
```javascript
const { HttpRpcClient } = require('#@ncore/utils/http_rpc');

const client = new HttpRpcClient('http://localhost:3000', {
    basePath: '/rpc',
    timeout: 5000,
    retryCount: 2
});

// Single call
const result = await client.call('translateText', {
    text: 'Hello world',
    targetLang: 'zh'
});

// Batch calls
const results = await client.batch([
    { route: 'translateText', params: { text: 'Hello', targetLang: 'zh' } },
    { route: 'translateText', params: { text: 'World', targetLang: 'es' } }
]);
```

**Unified Transport Example**:
```javascript
// Setup both WebSocket and HTTP RPC with same handlers
const expressUtils = require('#@ncore/foundation/express_utils');
const { WsRpcServer } = require('#@ncore/utils/ws_rpc');
const { HttpRpcServer } = require('#@ncore/utils/http_rpc');

await expressUtils.startExpressServer(config);

const wss = expressUtils.getWebSocketServer();
const app = expressUtils.getConfig().app;

const wsRpc = new WsRpcServer(wss);
const httpRpc = new HttpRpcServer(app);

await wsRpc.start();
httpRpc.start();

// Register same handler for both transports
const translateHandler = async (params, clientId) => {
    return await translationService.translate(params);
};

wsRpc.route('translateText', translateHandler);
httpRpc.route('translateText', translateHandler);

// Clients can now choose:
// - WebSocket: Real-time, bidirectional, persistent connection
// - HTTP: Stateless, request-response, firewall-friendly
```

**Reasoning**:
- Provides HTTP alternative for clients that cannot use WebSocket
- Same RPC protocol ensures consistency across transports
- Reuses components from ws_rpc (AuthManager, RateLimiter, etc.)
- Enables flexible deployment (WebSocket OR HTTP OR both)
- Better compatibility with firewalls and proxies

---

#### C. Stream Translator with DeepSeek Support
**Location**: `ncore/utils/stream_translator/`

**Key Components**:
```
utils/stream_translator/
├── libs/StreamTranslatorManager.js  - Session-based translation management
├── libs/DeepSeekTranslator.js       - Local DeepSeek model integration
├── libs/ModelInitializer.js         - Cross-platform model initialization
├── libs/TranslatorAPI.js            - Multi-provider translation API
├── libs/TriggerWordsDetector.js     - Context-aware translation triggering
├── libs/SentenceBuffer.js           - Sentence segmentation and buffering
├── libs/CodeDetector.js             - Code detection in text
├── libs/CommandExecutor.js          - Command execution utilities
└── libs/deepseek_server.py          - Python DeepSeek server
```

**Usage in App**:
```javascript
const streamTranslator = require('#@ncore/utils/stream_translator');

// Configure DeepSeek provider
streamTranslator.setTranslationProvider('deepseek', {
    modelPath: 'deepseek-ai/deepseek-vl-1.3b-chat',
    modelDir: 'D:\\programing\\DeepSeek-VL'
});

// Create session and translate
const sessionId = 'client_123';
streamTranslator.appendData(sessionId, 'Text to translate\n');
streamTranslator.flushSession(sessionId);

// Get result
streamTranslator.onTranslationReady((data) => {
    console.log('Translation ready:', data);
});
```

**Reasoning**:
- Already supports DeepSeek local models
- Multi-process architecture (Python subprocess)
- Session-based management
- Stream-based translation (perfect for real-time)
- No need to reimplement DeepSeek integration

---

#### D. Process Management
**Location**: `ncore/foundation/common/commander.js`
**Alias**: `#@commander`

**Usage in App**:
- Spawn API process for OpenRouter
- Spawn model processes for DeepSeek
- Manage process lifecycle
- IPC communication between processes

**Reasoning**: Standard ncore process spawning, avoids using child_process directly.

---

#### E. Global Constants
**Location**: `ncore/global_vars/gcommon/ws_rpc_constants.js`

**Usage in App**:
- Standard WebSocket RPC message types
- Error codes
- Status constants

**Reasoning**: Consistency with ncore WebSocket RPC conventions.

---

#### F. Foundation Utilities
**Aliases to use**:
- `#@logger` - Logging (`ncore/foundation/common/logger.js`)
- `#@freader` - File reading (`ncore/foundation/utilities/filetoollibs/freader.js`)
- `#@fwriter` - File writing (`ncore/foundation/utilities/filetoollibs/fwriter.js`)
- `#@ftools` - File tools (`ncore/foundation/utilities/filetool.js`)
- `#@global_vars` - Global constants (`ncore/global_vars/index.js`)
- `#@global_dir` - Directory constants (`ncore/global_vars/global_dir/globaldir.js`)
- `#@gconfig` - Configuration (`ncore/global_vars/tool/gconfig.js`)

**Reasoning**: Standard ncore foundation, must use instead of reimplementing.

---

### 2.2 Libraries to EXTEND

#### A. Extend `ncore/utils/ai_translator/`
**Current State**:
- Uses OpenRouter API only
- File watching with translation
- Basic HTTP web interface
- No WebSocket support
- No local model support

**Extensions Needed**:
1. **Add WebSocket RPC Support**
   - File: `web/web_server.js` - Replace basic HTTP with Express + WebSocket
   - File: `web/controller/translation_controller.js` - Add RPC method handlers

2. **Integrate stream_translator**
   - File: `libs/translation_manager.js` - Add DeepSeek provider option
   - Allow switching between OpenRouter and DeepSeek

3. **Add Client Session Management**
   - File: `libs/translation_manager.js` - Track client sessions
   - Support multiple concurrent client translations

4. **Add Callback System**
   - File: `libs/translation_manager.js` - Emit events for translation completion
   - Support WebSocket callbacks to clients

**Evaluation**: These extensions belong in `utils/ai_translator/` because:
- WebSocket support is general utility functionality
- DeepSeek integration makes it multi-provider
- Can be reused by other apps

**Alternative Approach**: If extensions are complex, keep `utils/ai_translator/` as-is and create new integration in app layer.

---

### 2.3 Components NOT in ncore (Create in App)

#### A. Multi-Process Architecture
**Why not in ncore**: App-specific orchestration logic

**Create in**: `apps/ai_translator_app/processes/`

**Files to create**:
```
processes/
├── ProcessManager.js       - Manages all child processes
├── ApiProcessHandler.js    - Handles OpenRouter API process
└── ModelProcessHandler.js  - Handles DeepSeek model processes
```

**Responsibilities**:
- Spawn and manage API process lifecycle
- Spawn and manage model process lifecycle
- Load balancing across model processes
- IPC message routing
- Process health monitoring
- Graceful shutdown

---

#### B. Service Layer
**Why not in ncore**: App-specific business logic

**Create in**: `apps/ai_translator_app/service/`

**Files to create**:
```
service/
├── TranslationService.js   - Orchestrates translation workflow
├── ClientManager.js        - Tracks client IDs and routing
└── CallbackManager.js      - Manages client callbacks
```

**Responsibilities**:
- Decide which process handles which translation (API vs DeepSeek)
- Track client connections and sessions
- Route callbacks to correct clients
- Handle translation queue

---

#### C. WebSocket + HTTP Controllers
**Why not in ncore**: App-specific request handling

**Create in**: `apps/ai_translator_app/controller/`

**Files to create**:
```
controller/
├── WebSocketTranslationController.js  - WebSocket RPC handlers
└── HttpTranslationController.js       - HTTP REST handlers
```

**Responsibilities**:
- Handle WebSocket RPC methods (translateText, getStatus, etc.)
- Handle HTTP REST endpoints
- Validate requests
- Call service layer
- Return responses

---

#### D. Routes
**Why not in ncore**: App-specific route definitions

**Create in**: `apps/ai_translator_app/routes/`

**Files to create**:
```
routes/
├── websocket_routes.js  - WebSocket RPC method registration
└── http_routes.js       - HTTP REST route registration
```

---

## 3. Architecture Design

### 3.1 Process Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Main Process (Node.js)                                          │
│  - Express + WebSocket Server (foundation/express_utils)        │
│  - WebSocket RPC Server (utils/ws_rpc)                          │
│  - Client connection management                                  │
│  - Request routing                                               │
└────────────┬────────────────────────────────────────────────────┘
             │
             │ IPC Messages (JSON)
             │
             ├──────────── Service Layer ─────────────┐
             │                                         │
             │   ┌────────────────────────────────┐   │
             │   │  TranslationService            │   │
             │   │  - Route to API or Model       │   │
             │   │  - Manage translation queue    │   │
             │   │  - Handle callbacks            │   │
             │   └──────┬─────────────────────────┘   │
             │          │                              │
             │          │ Process Selection Logic      │
             │          │                              │
             ├──────────┼──── API Process ────────────┤
             │          │                              │
             │   ┌──────▼──────────────────────┐      │
             │   │  ApiProcessHandler          │      │
             │   │  (Child Process)            │      │
             │   │                             │      │
             │   │  - OpenRouter API client    │      │
             │   │  - utils/ai_translator      │      │
             │   │  - Request queue            │      │
             │   └─────────────────────────────┘      │
             │                                         │
             └──────────┼──── Model Processes ────────┤
                        │                              │
                 ┌──────▼────────────────────────┐    │
                 │  ModelProcessHandler #1       │    │
                 │  (Child Process)              │    │
                 │                               │    │
                 │  - DeepSeek-VL 1.3B           │    │
                 │  - utils/stream_translator    │    │
                 │  - Python subprocess          │    │
                 └───────────────────────────────┘    │
                        │                              │
                 ┌──────▼────────────────────────┐    │
                 │  ModelProcessHandler #2       │    │
                 │  (Child Process)              │    │
                 │                               │    │
                 │  - DeepSeek-VL 1.3B           │    │
                 │  - utils/stream_translator    │    │
                 │  - Python subprocess          │    │
                 └───────────────────────────────┘    │
                        │                              │
                        ... (More model processes)     │
                                                       │
             All communicate via IPC (JSON messages)  │
└────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Interaction Flow

```
Client Request Flow:
1. Client connects via WebSocket
2. WsRpcServer (ws_rpc) manages connection
3. Client sends RPC request: { method: "translateText", params: {...} }
4. WebSocketTranslationController receives request
5. TranslationService determines process (API or Model)
6. Request forwarded to ApiProcessHandler or ModelProcessHandler
7. Process performs translation
8. Result returned via IPC
9. TranslationService receives result
10. CallbackManager sends callback to client via WebSocket
11. Client receives result
```

### 3.3 Client ID Management

```
Client Lifecycle:
1. Client connects -> Generate unique clientId (UUID)
2. Register in ClientManager
3. Store client metadata:
   - clientId
   - connectionTime
   - websocket reference
   - active translations
   - preferences (API vs DeepSeek)
4. On translation request:
   - Associate translation with clientId
   - Track translation status
5. On translation complete:
   - Lookup clientId
   - Send callback via WebSocket
6. On client disconnect:
   - Cleanup active translations
   - Remove from ClientManager
```

---

## 4. File Structure Plan

### 4.1 Complete App Directory Structure

```
apps/ai_translator_app/
├── main.js                      # MODIFY - Main entry point
│   - Initialize Express + WebSocket server
│   - Spawn API and model processes
│   - Start all services
│
├── config/
│   └── index.js                 # EXTEND - Add new configs
│       - websocketConfig (port, path, etc.)
│       - processConfig (API process, model processes)
│       - modelConfig (DeepSeek settings)
│
├── processes/                   # NEW DIRECTORY
│   ├── ProcessManager.js        # NEW - Process lifecycle manager
│   ├── ApiProcessHandler.js     # NEW - API process wrapper
│   └── ModelProcessHandler.js   # NEW - Model process wrapper
│
├── service/                     # NEW DIRECTORY
│   ├── TranslationService.js    # NEW - Translation orchestration
│   ├── ClientManager.js         # NEW - Client tracking
│   └── CallbackManager.js       # NEW - Callback handling
│
├── controller/                  # NEW DIRECTORY
│   ├── WebSocketTranslationController.js  # NEW - WS RPC handlers
│   └── HttpTranslationController.js       # NEW - HTTP handlers
│
├── routes/                      # NEW DIRECTORY
│   ├── websocket_routes.js      # NEW - WS RPC method registration
│   └── http_routes.js           # NEW - HTTP route registration
│
├── scripts/                     # EXISTING - MODIFY
│   ├── start.ps1                # MODIFY - Start all processes
│   ├── stop.ps1                 # MODIFY - Stop all processes
│   ├── deploy.ps1               # MODIFY - Deployment script
│   └── install.ps1              # MODIFY - Install dependencies
│
└── development_analysis.md      # THIS FILE
```

### 4.2 Modified Files Details

#### `main.js` (MODIFY)
**Changes**:
- Remove direct usage of `utils/ai_translator/web/index.js`
- Initialize Express + WebSocket using `foundation/express_utils`
- Initialize WebSocket RPC using `utils/ws_rpc`
- Initialize ProcessManager to spawn child processes
- Initialize TranslationService, ClientManager, CallbackManager
- Register WebSocket RPC methods
- Register HTTP routes
- Start all services

#### `config/index.js` (EXTEND)
**Add configurations**:
```javascript
{
    // Existing configs...

    // NEW: WebSocket configuration
    websocketConfig: {
        enabled: true,
        path: '/ws',
        heartbeatInterval: 30000,
        clientTimeout: 60000,
        maxConnections: 1000
    },

    // NEW: Process configuration
    processConfig: {
        apiProcess: {
            enabled: true,
            count: 1,
            restartOnCrash: true
        },
        modelProcesses: {
            enabled: true,
            count: 2,  // Number of DeepSeek processes
            restartOnCrash: true,
            modelType: 'deepseek',
            modelPath: 'D:\\programing\\DeepSeek-VL'
        }
    },

    // NEW: Model configuration
    modelConfig: {
        deepseek: {
            enabled: true,
            modelDir: 'D:\\programing\\DeepSeek-VL',
            modelPath: 'deepseek-ai/deepseek-vl-1.3b-chat',
            timeout: 60000
        }
    },

    // NEW: Client management
    clientConfig: {
        enableClientTracking: true,
        clientTimeout: 300000,  // 5 minutes
        maxTranslationsPerClient: 10
    }
}
```

---

## 5. Implementation Plan

### Phase 1: Core Infrastructure (Priority: HIGH)
**Files to create**:
1. `processes/ProcessManager.js`
2. `service/ClientManager.js`
3. `config/index.js` (extend)

**Tasks**:
- Implement process spawning and lifecycle
- Implement client connection tracking
- Update configuration

**Dependencies**: None

---

### Phase 2: Service Layer (Priority: HIGH)
**Files to create**:
1. `service/TranslationService.js`
2. `service/CallbackManager.js`
3. `processes/ApiProcessHandler.js`
4. `processes/ModelProcessHandler.js`

**Tasks**:
- Implement translation routing logic
- Implement callback system
- Implement process wrappers

**Dependencies**: Phase 1

---

### Phase 3: WebSocket + HTTP Integration (Priority: HIGH)
**Files to create**:
1. `controller/WebSocketTranslationController.js`
2. `controller/HttpTranslationController.js`
3. `routes/websocket_routes.js`
4. `routes/http_routes.js`
5. `main.js` (modify)

**Tasks**:
- Setup Express + WebSocket server
- Setup WebSocket RPC
- Implement controllers
- Register routes
- Update main entry point

**Dependencies**: Phase 2

---

### Phase 4: Testing & Deployment (Priority: MEDIUM)
**Files to modify**:
1. `scripts/start.ps1`
2. `scripts/stop.ps1`
3. `scripts/install.ps1`

**Tasks**:
- Update deployment scripts
- Add process monitoring
- Add health checks

**Dependencies**: Phase 3

---

## 6. Integration Examples

### 6.1 Using stream_translator for DeepSeek

```javascript
// In ModelProcessHandler.js
const streamTranslator = require('#@ncore/utils/stream_translator');
const logger = require('#@logger');

class ModelProcessHandler {
    constructor(processId, modelConfig) {
        this.processId = processId;
        this.modelConfig = modelConfig;
        this.isReady = false;
    }

    async initialize() {
        logger.info(`[Model Process ${this.processId}] Initializing DeepSeek...`);

        streamTranslator.setTranslationProvider('deepseek', {
            modelDir: this.modelConfig.modelDir,
            modelPath: this.modelConfig.modelPath
        });

        // Initialize DeepSeek model
        const status = await streamTranslator.initDeepSeek();
        this.isReady = status.isReady;

        logger.info(`[Model Process ${this.processId}] DeepSeek ready: ${this.isReady}`);
    }

    async translate(sessionId, text) {
        if (!this.isReady) {
            throw new Error('Model not ready');
        }

        streamTranslator.appendData(sessionId, text);
        streamTranslator.flushSession(sessionId);

        return new Promise((resolve) => {
            streamTranslator.onTranslationReady((data) => {
                if (data.sessionId === sessionId) {
                    const result = streamTranslator.getFullText(sessionId);
                    resolve(result);
                }
            });
        });
    }
}

module.exports = ModelProcessHandler;
```

### 6.2 Using ws_rpc for Client Management

```javascript
// In main.js
const { WsRpcServer } = require('#@ncore/utils/ws_rpc');
const expressUtils = require('#@ncore/foundation/express_utils');

// Create Express + WebSocket server
const { app, server } = expressUtils.createExpressApp(config);
const wss = expressUtils.createWebSocketServer(server, {
    path: config.websocketConfig.path
});

// Create WebSocket RPC server
const wsRpc = new WsRpcServer(wss, {
    enableAuth: false,
    enableHeartbeat: true,
    heartbeatInterval: config.websocketConfig.heartbeatInterval,
    enableNamespace: true
});

// Register RPC methods
wsRpc.register('translateText', async (params, clientInfo) => {
    const { text, targetLanguage, provider } = params;
    const clientId = clientInfo.clientId;

    // Use TranslationService
    const result = await translationService.translate({
        clientId,
        text,
        targetLanguage,
        provider
    });

    return result;
});

wsRpc.register('getStatus', async (params, clientInfo) => {
    return {
        status: 'ok',
        clientId: clientInfo.clientId
    };
});
```

### 6.3 Using express_utils for HTTP Server

```javascript
// In main.js
const expressUtils = require('#@ncore/foundation/express_utils');
const httpRoutes = require('./routes/http_routes.js');

// Create Express app
const config = {
    port: 3000,
    host: '0.0.0.0',
    cors: {
        enabled: true,
        origins: ['*']
    }
};

const { app, server } = expressUtils.createExpressApp(config);

// Register HTTP routes
expressUtils.registerRoutes(app, httpRoutes);

// Start server
server.listen(config.port, config.host, () => {
    logger.info(`Server listening on ${config.host}:${config.port}`);
});
```

---

## 7. ncore Convention Compliance Checklist

### 7.1 Foundation Usage
- [x] Use `#@logger` for all logging
- [x] Use `#@commander` for process spawning
- [x] Use `#@freader`, `#@fwriter`, `#@ftools` for file operations
- [x] Use `#@gconfig` for configuration
- [x] Use `#@global_vars` and `#@global_dir` for constants

### 7.2 Express + WebSocket
- [x] Use `foundation/express_utils` for Express + WebSocket server
- [x] Do not reimplement Express or WebSocket management

### 7.3 WebSocket RPC
- [x] Use `utils/ws_rpc` for WebSocket RPC
- [x] Use `gcommon/ws_rpc_constants.js` for message types
- [x] Do not reimplement RPC protocol

### 7.4 Stream Translator
- [x] Use `utils/stream_translator` for DeepSeek integration
- [x] Do not reimplement DeepSeek Python interface

### 7.5 App Structure
- [x] Main entry: `main.js` with `start()` function
- [x] Configuration: `config/index.js`
- [x] Business logic: `controller/` and `service/`
- [x] No `package.json` in app directory
- [x] Use root `package.json` aliases

### 7.6 Deployment Scripts
- [x] Create `scripts/start.ps1`
- [x] Create `scripts/stop.ps1`
- [x] Create `scripts/deploy.ps1`
- [x] Create `scripts/install.ps1`

### 7.7 Third-party Packages
- [ ] Verify all packages are in root `package.json`
- [ ] Add any new packages to root README.md

---

## 8. Risk Analysis

### 8.1 High Risk Areas

**Risk 1: Process IPC Communication**
- Challenge: Reliable IPC between main and child processes
- Mitigation: Use JSON message protocol, implement retry and timeout

**Risk 2: DeepSeek Model Memory**
- Challenge: DeepSeek models consume significant RAM
- Mitigation: Limit number of model processes, implement process pooling

**Risk 3: Client Disconnection Handling**
- Challenge: Clients may disconnect during translation
- Mitigation: Use heartbeat monitoring, cleanup orphaned sessions

### 8.2 Medium Risk Areas

**Risk 4: Translation Queue Overflow**
- Challenge: Too many concurrent translation requests
- Mitigation: Implement queue with max size, rate limiting

**Risk 5: Process Crash Recovery**
- Challenge: Child processes may crash
- Mitigation: Implement auto-restart, health monitoring

---

## 9. Performance Considerations

### 9.1 Scalability

**Horizontal Scaling**:
- Model processes: Increase `processConfig.modelProcesses.count`
- API processes: Increase `processConfig.apiProcess.count`

**Load Balancing**:
- Round-robin across model processes
- Queue-based distribution

### 9.2 Resource Limits

**Memory**:
- Each DeepSeek process: ~3-4GB RAM
- Max model processes: Total RAM / 4GB

**CPU**:
- Model processes are CPU-intensive
- Limit to CPU core count

---

## 10. Summary

### Libraries to Use (No Changes)
1. `foundation/express_utils` - HTTP + WebSocket server
2. `utils/ws_rpc` - WebSocket RPC + client management
3. `utils/stream_translator` - DeepSeek integration
4. `#@commander` - Process management
5. All foundation utilities (`#@logger`, `#@ftools`, etc.)

### Libraries to Extend
1. `utils/ai_translator` - Optional: Add WebSocket RPC support

### New Components in App
1. `processes/` - Multi-process management
2. `service/` - Business logic orchestration
3. `controller/` - Request handlers
4. `routes/` - Route definitions

### Implementation Priority
1. Phase 1: Core infrastructure (ProcessManager, ClientManager)
2. Phase 2: Service layer (TranslationService, process handlers)
3. Phase 3: WebSocket + HTTP integration
4. Phase 4: Testing and deployment

This architecture follows ncore conventions and provides a scalable, multi-service translation system with support for both cloud (OpenRouter) and local (DeepSeek) models.
