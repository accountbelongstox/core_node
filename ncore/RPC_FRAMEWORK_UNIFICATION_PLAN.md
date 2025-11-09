# RPC Framework Unification Plan

## Date: 2025-11-05

## Problem Analysis

### Current Situation

**1. express_utils (foundation/express_utils/)**
```
foundation/express_utils/
├── libs/ExpressManager.js     - Express app lifecycle
├── libs/WsManager.js           - Basic WebSocket server
├── libs/RouterManager.js       - HTTP route management
├── libs/MiddlewareUtil.js      - Middleware utilities
├── libs/StaticServer.js        - Static file serving
└── libs/res_helper.js          - Response helpers
```

**Features**:
- Creates Express app
- Creates WebSocket server attached to HTTP server
- Basic message wrapping (event + timestamp)
- Simple broadcast and send functions
- No RPC protocol

**2. ws_rpc (utils/ws_rpc/)**
```
utils/ws_rpc/
├── WsRpcServer.js              - WebSocket RPC server
├── WsRpcClient.js              - WebSocket RPC client
├── libs/AuthManager.js         - Authentication
├── libs/HeartbeatManager.js    - Connection health
├── libs/NamespaceManager.js    - Client grouping
├── libs/RateLimiter.js         - Rate limiting
├── libs/InterceptorManager.js  - Request/response interception
├── libs/PerformanceMonitor.js  - Performance tracking
└── libs/MessageCompressor.js   - Message compression
```

**Features**:
- Full RPC protocol (REQUEST/RESPONSE/EVENT)
- Creates standalone WebSocket server
- Advanced features (auth, heartbeat, namespace, etc.)
- Client tracking with UUID
- Middleware chain support

---

## Conflict Points

### 1. WebSocket Server Creation Conflict

**express_utils/WsManager.js**:
```javascript
// Line 147: Attaches to HTTP server
this.server = http.createServer(app);
wss = new WebSocket.Server({ server: this.server });
```

**ws_rpc/WsRpcServer.js**:
```javascript
// Line 93: Creates standalone WebSocket server
this.wss = new WebSocket.Server({
    host: this.host,
    port: this.port
});
```

**Problem**: Cannot use both simultaneously on same port.

---

### 2. Client Management Conflict

**express_utils/WsManager.js**:
```javascript
// Line 20: Simple Set-based client tracking
const clients = new Set();
```

**ws_rpc/WsRpcServer.js**:
```javascript
// Line 46: Map-based with UUID tracking
this.clients = new Map();  // clientId -> WebSocket
```

**Problem**: Different client management approaches, cannot share state.

---

### 3. Message Protocol Conflict

**express_utils/WsManager.js**:
```javascript
// Simple message format
{
    event: 'message',
    timestamp: 1234567890,
    data: { ... }
}
```

**ws_rpc/WsRpcServer.js**:
```javascript
// RPC message format
{
    type: 'REQUEST',      // REQUEST/RESPONSE/EVENT
    id: 'uuid',
    route: 'methodName',
    params: { ... },
    timestamp: 1234567890
}
```

**Problem**: Incompatible message formats.

---

### 4. Functionality Overlap

Both libraries implement:
- Client connection handling
- Message broadcasting
- Client disconnection handling
- Basic message sending

---

## Proposed Solution

### Option 1: Minimal Integration (RECOMMENDED)

**Goal**: Make ws_rpc work with express_utils without breaking existing code.

**Changes**:

#### A. Modify ws_rpc to support existing WebSocket server

**File**: `ncore/utils/ws_rpc/WsRpcServer.js`

Add constructor option to accept existing WebSocket.Server:

```javascript
constructor(wssOrOptions = {}) {
    super();

    // NEW: Support passing existing WebSocket.Server
    if (wssOrOptions instanceof WebSocket.Server) {
        this.wss = wssOrOptions;
        this.externalWss = true;  // Don't manage lifecycle
        this.options = {};
    } else {
        // Existing behavior for standalone mode
        const options = wssOrOptions;
        this.port = options.port || DEFAULTS.SERVER_PORT;
        this.host = options.host || DEFAULTS.SERVER_HOST;
        this.wss = null;
        this.externalWss = false;
        this.options = options;
    }

    // ... rest of constructor
}

start() {
    return new Promise((resolve, reject) => {
        try {
            // NEW: If external wss provided, attach handlers only
            if (this.externalWss) {
                this._attachHandlers();
                logger.success('WebSocket RPC Server attached to existing server');
                resolve();
                return;
            }

            // Existing behavior for standalone mode
            this.wss = new WebSocket.Server({
                host: this.host,
                port: this.port
            });

            this._attachHandlers();

            this.wss.on('listening', () => {
                logger.success(`WebSocket RPC Server listening on ${this.host}:${this.port}`);
                resolve();
            });
        } catch (error) {
            reject(error);
        }
    });
}

_attachHandlers() {
    this.wss.on('connection', (ws, req) => {
        this._handleConnection(ws, req);
    });

    this.wss.on('error', (error) => {
        logger.error('WsRpcServer error:', error);
        this.emit('error', error);
    });
}

stop() {
    return new Promise((resolve) => {
        this.heartbeat.stopAll();

        this.clients.forEach((ws, clientId) => {
            ws.close();
        });
        this.clients.clear();

        // ... rest of cleanup

        // NEW: Only close wss if we created it
        if (this.wss && !this.externalWss) {
            this.wss.close(() => {
                logger.info('WebSocket RPC Server stopped');
                resolve();
            });
        } else {
            resolve();
        }
    });
}
```

#### B. Update express_utils to export WebSocket server

**File**: `ncore/foundation/express_utils/libs/WsManager.js`

```javascript
class WsManager {
    constructor() {
        this.server = null;
        this.wss = null;  // NEW: Store wss instance
    }

    async start(portOrConfig) {
        let port = portOrConfig.HTTP_PORT;
        this.server = http.createServer(app);
        this.wss = new WebSocket.Server({ server: this.server });  // NEW: Store in this.wss

        // ... existing connection handling
    }

    // NEW: Get WebSocket server instance
    getWebSocketServer() {
        return this.wss;
    }

    // ... rest of methods
}

module.exports = new WsManager();
module.exports.broadcastWs = broadcastWs;
module.exports.sendToWsClient = sendToWsClient;
```

**File**: `ncore/foundation/express_utils/index.js`

```javascript
const getWebSocketServer = () => WsManager.getWebSocketServer();

module.exports = {
    getConfig,
    updateConfig,
    broadcastWs,
    sendToWsClient,
    startExpressServer,
    getWebSocketServer  // NEW: Export getter
};
```

#### C. Usage pattern

```javascript
const expressUtils = require('#@ncore/foundation/express_utils');
const { WsRpcServer } = require('#@ncore/utils/ws_rpc');

// Start Express + basic WebSocket
await expressUtils.startExpressServer(config);

// Get the WebSocket server
const wss = expressUtils.getWebSocketServer();

// Attach RPC to existing WebSocket server
const rpcServer = new WsRpcServer(wss);
await rpcServer.start();

// Register RPC routes
rpcServer.route('translateText', async (params, clientId) => {
    return { translated: 'result' };
});
```

---

### Option 2: Full Unification (FUTURE)

Create new unified RPC framework in `ncore/utils/rpc_framework/`.

**Not recommended now** because:
- Large refactoring effort
- Breaks existing code
- Need migration path

---

## HTTP RPC Design

Create `ncore/utils/http_rpc/` with same RPC protocol as WebSocket RPC.

### Architecture

```
ncore/utils/http_rpc/
├── HttpRpcServer.js           - HTTP RPC server
├── HttpRpcClient.js           - HTTP RPC client
├── libs/
│   ├── SessionManager.js      - Session tracking (HTTP is stateless)
│   ├── LongPolling.js         - Long polling support for events
│   ├── AuthManager.js         - Authentication (reuse from ws_rpc)
│   ├── RateLimiter.js         - Rate limiting (reuse from ws_rpc)
│   ├── PerformanceMonitor.js  - Performance tracking (reuse from ws_rpc)
│   └── RequestValidator.js    - Request validation
└── index.js                   - Entry point
```

### Protocol Design

**Same message format as WebSocket RPC**:

```javascript
// Request
POST /rpc HTTP/1.1
Content-Type: application/json

{
    type: 'REQUEST',
    id: 'uuid',
    route: 'translateText',
    params: {
        text: 'Hello world',
        targetLang: 'zh'
    },
    timestamp: 1234567890
}

// Response
HTTP/1.1 200 OK
Content-Type: application/json

{
    type: 'RESPONSE',
    id: 'uuid',
    success: true,
    result: {
        translated: '你好世界'
    },
    timestamp: 1234567891
}
```

### Key Differences from WebSocket RPC

| Feature | WebSocket RPC | HTTP RPC |
|---------|---------------|----------|
| Connection | Persistent | Request-response |
| Client ID | Generated on connect | Session-based (cookie/token) |
| Events | Server push | Long polling or SSE |
| Heartbeat | Built-in | Not applicable |
| Bidirectional | Yes | No (client -> server only) |
| Real-time | Yes | No (unless long polling) |

### Implementation Plan

#### 1. HttpRpcServer.js

```javascript
class HttpRpcServer {
    constructor(expressApp, options = {}) {
        this.app = expressApp;
        this.routes = new Map();
        this.basePath = options.basePath || '/rpc';
        this.auth = new AuthManager(options.auth);
        this.rateLimiter = new RateLimiter(options.rateLimit);
        this.performance = new PerformanceMonitor(options.performance);
        this.sessions = new SessionManager(options.session);
        this.middleware = new MiddlewareChain();
        this.interceptors = new InterceptorManager();
    }

    start() {
        // Register HTTP POST endpoint
        this.app.post(this.basePath, async (req, res) => {
            await this._handleRequest(req, res);
        });

        // Optional: Long polling endpoint for events
        this.app.get(`${this.basePath}/events`, async (req, res) => {
            await this._handleLongPolling(req, res);
        });
    }

    route(routeName, handler) {
        this.routes.set(routeName, handler);
        return this;
    }

    async _handleRequest(req, res) {
        try {
            const message = req.body;
            const sessionId = this._getSessionId(req);

            // Validate message format
            if (message.type !== 'REQUEST') {
                return this._sendError(res, 400, 'Invalid message type');
            }

            // Rate limiting
            const rateLimitCheck = this.rateLimiter.check(sessionId);
            if (!rateLimitCheck.allowed) {
                return this._sendError(res, 429, 'Rate limit exceeded');
            }

            // Authentication
            if (this.auth.enabled && !this.auth.isAuthenticated(sessionId)) {
                return this._sendError(res, 401, 'Authentication required');
            }

            // Find handler
            const handler = this.routes.get(message.route);
            if (!handler) {
                return this._sendError(res, 404, `Route not found: ${message.route}`);
            }

            // Execute handler
            const context = {
                sessionId,
                requestId: message.id,
                route: message.route,
                params: message.params,
                req,
                res
            };

            const result = await this.middleware.execute(context, async (ctx) => {
                return await Promise.resolve(handler(ctx.params, ctx.sessionId, ctx));
            });

            // Send response
            this._sendResponse(res, message.id, true, result);

        } catch (error) {
            this._sendError(res, 500, error.message);
        }
    }

    _sendResponse(res, requestId, success, result = null, code = null, error = null) {
        res.json({
            type: 'RESPONSE',
            id: requestId,
            success,
            result,
            code,
            error,
            timestamp: Date.now()
        });
    }

    _sendError(res, httpCode, message) {
        res.status(httpCode).json({
            type: 'ERROR',
            code: httpCode,
            error: message,
            timestamp: Date.now()
        });
    }

    _getSessionId(req) {
        // Get session ID from cookie, header, or token
        return req.session?.id ||
               req.headers['x-session-id'] ||
               req.cookies?.sessionId ||
               'anonymous';
    }
}
```

#### 2. HttpRpcClient.js

```javascript
class HttpRpcClient {
    constructor(baseUrl, options = {}) {
        this.baseUrl = baseUrl;
        this.basePath = options.basePath || '/rpc';
        this.timeout = options.timeout || 30000;
        this.sessionId = options.sessionId || uuidv4();
        this.headers = options.headers || {};
    }

    async call(route, params) {
        const requestId = uuidv4();
        const message = {
            type: 'REQUEST',
            id: requestId,
            route,
            params,
            timestamp: Date.now()
        };

        try {
            const response = await fetch(`${this.baseUrl}${this.basePath}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-ID': this.sessionId,
                    ...this.headers
                },
                body: JSON.stringify(message),
                timeout: this.timeout
            });

            const data = await response.json();

            if (data.type === 'ERROR') {
                throw new Error(data.error);
            }

            if (data.success) {
                return data.result;
            } else {
                throw new Error(data.error || 'Request failed');
            }
        } catch (error) {
            throw new Error(`HTTP RPC call failed: ${error.message}`);
        }
    }

    // Helper methods for common patterns
    async batch(calls) {
        const promises = calls.map(({ route, params }) => this.call(route, params));
        return Promise.all(promises);
    }
}
```

#### 3. Usage Example

```javascript
const express = require('express');
const { HttpRpcServer } = require('#@ncore/utils/http_rpc');

const app = express();
app.use(express.json());

// Create HTTP RPC server
const rpcServer = new HttpRpcServer(app, {
    basePath: '/rpc',
    auth: { enabled: false },
    rateLimit: {
        enabled: true,
        maxRequests: 100,
        windowMs: 60000
    }
});

// Register routes
rpcServer.route('translateText', async (params, sessionId) => {
    const { text, targetLang } = params;
    const result = await translate(text, targetLang);
    return { translated: result };
});

rpcServer.route('getStatus', async (params, sessionId) => {
    return { status: 'ok', sessionId };
});

// Start server
rpcServer.start();
app.listen(3000);
```

#### 4. Client Usage

```javascript
const { HttpRpcClient } = require('#@ncore/utils/http_rpc');

const client = new HttpRpcClient('http://localhost:3000');

// Single call
const result = await client.call('translateText', {
    text: 'Hello world',
    targetLang: 'zh'
});

// Batch calls
const results = await client.batch([
    { route: 'translateText', params: { text: 'Hello', targetLang: 'zh' } },
    { route: 'translateText', params: { text: 'World', targetLang: 'zh' } },
    { route: 'getStatus', params: {} }
]);
```

---

## Shared Components

Both WebSocket RPC and HTTP RPC can share:

### 1. Protocol Definitions

**File**: `ncore/utils/rpc_common/protocol.js`

```javascript
const MESSAGE_TYPES = {
    REQUEST: 'REQUEST',
    RESPONSE: 'RESPONSE',
    EVENT: 'EVENT',
    ERROR: 'ERROR',
    AUTH: 'AUTH',
    AUTH_RESPONSE: 'AUTH_RESPONSE'
};

const ERROR_CODES = {
    ROUTE_NOT_FOUND: 404,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    INTERNAL_ERROR: 500,
    PAYLOAD_TOO_LARGE: 413,
    CANCELLED: 499
};

module.exports = { MESSAGE_TYPES, ERROR_CODES };
```

### 2. Managers (can be reused)

- AuthManager
- RateLimiter
- PerformanceMonitor
- InterceptorManager
- MiddlewareChain

**Move to**: `ncore/utils/rpc_common/libs/`

---

## Implementation Priority

### Phase 1: Minimal Integration (HIGH PRIORITY)
1. Modify ws_rpc to accept existing WebSocket.Server
2. Update express_utils to export WebSocket server
3. Update documentation and examples
4. Test compatibility

**Estimated effort**: 2-4 hours

---

### Phase 2: HTTP RPC Implementation (MEDIUM PRIORITY)
1. Create http_rpc directory structure
2. Implement HttpRpcServer
3. Implement HttpRpcClient
4. Add shared component extraction to rpc_common
5. Add tests and examples

**Estimated effort**: 1-2 days

---

### Phase 3: Full Unification (LOW PRIORITY / FUTURE)
1. Create unified rpc_framework
2. Migrate existing code
3. Deprecate old APIs
4. Update all dependent apps

**Estimated effort**: 1-2 weeks

---

## Benefits

### For AI Translator App

**Before** (Conflict):
```javascript
// Cannot use both
await expressUtils.startExpressServer(config);  // Basic WebSocket
// OR
const rpcServer = new WsRpcServer(options);     // RPC WebSocket
await rpcServer.start();
```

**After** (Unified):
```javascript
// Use both together
await expressUtils.startExpressServer(config);
const wss = expressUtils.getWebSocketServer();
const wsRpc = new WsRpcServer(wss);
const httpRpc = new HttpRpcServer(app);

await wsRpc.start();
httpRpc.start();

// Register same routes for both transports
const routes = {
    'translateText': translateHandler,
    'getStatus': statusHandler
};

Object.entries(routes).forEach(([route, handler]) => {
    wsRpc.route(route, handler);
    httpRpc.route(route, handler);
});

// Clients can use either WebSocket or HTTP
```

### General Benefits

1. **No breaking changes**: Existing code continues to work
2. **Flexible deployment**: WebSocket OR HTTP OR both
3. **Code reuse**: Same handlers for both transports
4. **Consistent protocol**: Same message format across transports
5. **Feature parity**: Auth, rate limiting, etc. work everywhere

---

## Migration Guide

### For Existing express_utils Users

**Before**:
```javascript
const expressUtils = require('#@ncore/foundation/express_utils');
await expressUtils.startExpressServer(config);
expressUtils.broadcastWs({ message: 'Hello' });
```

**After** (No changes needed, backward compatible):
```javascript
const expressUtils = require('#@ncore/foundation/express_utils');
await expressUtils.startExpressServer(config);
expressUtils.broadcastWs({ message: 'Hello' });  // Still works

// Optional: Add RPC features
const wss = expressUtils.getWebSocketServer();
const rpc = new WsRpcServer(wss);
await rpc.start();
rpc.route('myMethod', handler);
```

### For Existing ws_rpc Users

**Before**:
```javascript
const { WsRpcServer } = require('#@ncore/utils/ws_rpc');
const server = new WsRpcServer({ port: 3000 });
await server.start();
```

**After** (No changes needed, backward compatible):
```javascript
const { WsRpcServer } = require('#@ncore/utils/ws_rpc');
const server = new WsRpcServer({ port: 3000 });  // Still works
await server.start();

// OR: Attach to existing server
const expressUtils = require('#@ncore/foundation/express_utils');
await expressUtils.startExpressServer({ HTTP_PORT: 3000 });
const wss = expressUtils.getWebSocketServer();
const server = new WsRpcServer(wss);  // Attach mode
await server.start();
```

---

## Testing Plan

### Unit Tests

1. WsRpcServer in standalone mode (existing behavior)
2. WsRpcServer in attached mode (new behavior)
3. HttpRpcServer basic functionality
4. Protocol compatibility between WS and HTTP
5. Shared managers (Auth, RateLimit, etc.)

### Integration Tests

1. Express + WsRpcServer integration
2. Express + HttpRpcServer integration
3. Both WebSocket and HTTP RPC simultaneously
4. Client compatibility tests

### Performance Tests

1. WebSocket RPC throughput
2. HTTP RPC throughput
3. Overhead of shared managers
4. Memory usage with multiple transports

---

## Summary

**Recommended Approach**: Option 1 (Minimal Integration)

**Key Changes**:
1. Modify `ws_rpc/WsRpcServer.js` to accept existing WebSocket.Server
2. Update `express_utils` to export WebSocket server instance
3. Create new `http_rpc` with same protocol
4. Extract shared components to `rpc_common`

**Advantages**:
- Backward compatible
- No breaking changes
- Quick implementation
- Solves AI translator app requirements
- Enables future unification

**Next Steps**:
1. Implement Phase 1 changes
2. Test with AI translator app
3. Document usage patterns
4. Plan Phase 2 (HTTP RPC)
