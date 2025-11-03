# WebSocket RPC Library

A powerful WebSocket RPC library for Node.js and browser, supporting bidirectional async communication with request-response pattern, HTTP fallback, result caching, and persistent storage.

## Core Concept

The library implements an async callback pattern where:
1. Client generates a unique `requestId` before sending a request
2. Server processes the request and responds with the same `requestId`
3. Client matches the response to the original request using `requestId` and resolves the promise
4. No need for synchronous waiting - completely async callback-based

## Features

### Basic Features
- ✅ Request-response pattern with unique request IDs
- ✅ Bidirectional RPC (server can call client routes)
- ✅ Automatic reconnection with configurable attempts
- ✅ Heartbeat/ping-pong mechanism
- ✅ Request/response interceptors
- ✅ Event broadcasting
- ✅ Message queuing when disconnected
- ✅ TypeScript-friendly (JSDoc annotations)
- ✅ Browser and Node.js support

### Extended Features (New!)
- ✅ **HTTP Fallback**: Automatic fallback to HTTP when WebSocket fails
- ✅ **Result Caching**: Server-side result caching with TTL
- ✅ **Delayed Callbacks**: Execute callbacks at any time with cached results
- ✅ **HTTP Polling**: Client-side polling for long-running operations
- ✅ **Persistent Storage**: localStorage/file-based request persistence
- ✅ **Request Recovery**: Recover pending requests after page refresh/restart
- ✅ **Unified JSON Serialization**: Consistent data format across transports

## Installation

```bash
npm install ws uuid
```

## Usage

### Server Example

```javascript
const { WsRpcServer } = require('./ncore/utils/wsrpc');

const server = new WsRpcServer({
    port: 8081,
    host: 'localhost',
    debug: true
});

// Register routes
server.route('add', async (params) => {
    const { a, b } = params;
    return a + b;
});

server.route('getUserInfo', async (params, context) => {
    const { userId } = params;
    console.log(`Request from client: ${context.clientId}`);
    return {
        id: userId,
        name: 'John Doe',
        email: 'john@example.com'
    };
});

// Listen to connection events
server.on('connection', ({ clientId }) => {
    console.log(`New client connected: ${clientId}`);

    // Server can call client routes
    setTimeout(async () => {
        try {
            const result = await server.callClient('clientInfo', {}, clientId);
            console.log('Client info:', result);
        } catch (error) {
            console.error('Failed to call client:', error.message);
        }
    }, 2000);
});

server.on('disconnect', ({ clientId }) => {
    console.log(`Client disconnected: ${clientId}`);
});

await server.start();
console.log('WebSocket RPC Server is running...');
```

### Node.js Client Example

```javascript
const { WsRpcClient } = require('./ncore/utils/wsrpc');

const client = new WsRpcClient('ws://localhost:8081', {
    debug: true,
    reconnect: true,
    onConnected: async () => {
        console.log('Connected to server!');
    },
    onDisconnected: async () => {
        console.log('Disconnected from server!');
    }
});

// Register routes that server can call
client.route('clientInfo', async (params) => {
    return {
        name: 'Client App',
        version: '1.0.0',
        platform: process.platform
    };
});

// Register event handlers
client.on('customEvent', (data) => {
    console.log('Received custom event:', data);
});

// Connect to server
await client.connect();

// Call server routes
try {
    const sumResult = await client.call('add', { a: 5, b: 3 });
    console.log('Sum result:', sumResult); // 8

    const userInfo = await client.call('getUserInfo', { userId: 123 });
    console.log('User info:', userInfo);
} catch (error) {
    console.error('Error:', error.message);
}
```

### Browser Client Example

```html
<!DOCTYPE html>
<html>
<head>
    <title>WebSocket RPC Browser Client</title>
</head>
<body>
    <script src="example-browser-client.js"></script>
    <script>
        const client = new WsRpcBrowserClient('ws://localhost:8081', {
            debug: true,
            reconnect: true,
            onConnected: async () => {
                console.log('Connected!');
            }
        });

        // Register routes
        client.route('clientInfo', async (params) => {
            return {
                name: 'Browser Client',
                userAgent: navigator.userAgent
            };
        });

        // Connect and call routes
        await client.connect();

        const result = await client.call('add', { a: 10, b: 5 });
        console.log('Result:', result); // 15
    </script>
</body>
</html>
```

## API Reference

### WsRpcServer

#### Constructor Options

```javascript
{
    port: 8081,                    // Server port
    host: 'localhost',             // Server host
    debug: false,                  // Enable debug logging
    requestTimeout: 30000,         // Request timeout in ms
    heartbeatInterval: 30000,      // Heartbeat interval in ms
    heartbeatTimeout: 10000        // Heartbeat timeout in ms
}
```

#### Methods

- `route(routeName, handler)` - Register a route handler
- `callClient(routeName, params, clientId)` - Call a route on a client
- `broadcast(message)` - Broadcast message to all clients
- `triggerEvent(eventName, data, targetClientId?)` - Trigger an event
- `getClients()` - Get list of connected client IDs
- `start()` - Start the server
- `stop()` - Stop the server

#### Events

- `connection` - Fired when a client connects
- `disconnect` - Fired when a client disconnects

### WsRpcClient

#### Constructor Options

```javascript
{
    debug: false,                  // Enable debug logging
    requestTimeout: 30000,         // Request timeout in ms
    reconnect: true,               // Enable auto-reconnect
    reconnectInterval: 3000,       // Reconnect interval in ms
    maxReconnectAttempts: 10,      // Max reconnect attempts
    heartbeatInterval: 30000,      // Heartbeat interval in ms
    heartbeatTimeout: 10000,       // Heartbeat timeout in ms
    enableHeartbeat: true,         // Enable heartbeat
    onConnected: async () => {},   // Connected callback
    onDisconnected: async () => {}, // Disconnected callback
    onError: async (error) => {},  // Error callback
    onReconnecting: async (attempt) => {} // Reconnecting callback
}
```

#### Methods

- `route(routeName, handler)` - Register a route handler
- `on(eventName, handler)` - Register an event handler
- `call(routeName, params)` - Call a server route (returns Promise)
- `connect()` - Connect to server
- `disconnect()` - Disconnect from server
- `authenticate(credentials)` - Authenticate with server
- `addRequestInterceptor(onFulfilled, onRejected)` - Add request interceptor
- `addResponseInterceptor(onFulfilled, onRejected)` - Add response interceptor
- `addErrorInterceptor(handler)` - Add error interceptor

## Request-Response Flow

```
Client Side:
1. Generate unique requestId (UUID)
2. Create request message: { type: 'request', id: requestId, route: 'add', params: {...} }
3. Store promise in pendingRequests[requestId]
4. Send message via WebSocket
5. Wait for response asynchronously (via Promise)

Server Side:
1. Receive request message
2. Execute route handler
3. Send response: { type: 'response', id: requestId, success: true, result: {...} }

Client Side (continued):
1. Receive response message
2. Find pending request by requestId
3. Resolve/reject promise
4. Remove from pendingRequests
```

## Examples

Run the examples:

```bash
# Terminal 1: Start server
node ncore/utils/wsrpc/example-server.js

# Terminal 2: Start Node.js client
node ncore/utils/wsrpc/example-client.js

# Browser: Open example-browser.html in browser
open ncore/utils/wsrpc/example-browser.html
```

## Architecture

### Basic Architecture
```
┌─────────────────┐                    ┌─────────────────┐
│     Client      │                    │     Server      │
├─────────────────┤                    ├─────────────────┤
│ WsRpcClient     │◄──────────────────►│ WsRpcServer     │
│                 │   WebSocket        │                 │
│ - routes        │                    │ - routes        │
│ - pendingReq    │                    │ - pendingReq    │
│ - call()        │                    │ - callClient()  │
│ - route()       │                    │ - route()       │
└─────────────────┘                    └─────────────────┘
```

### Extended Architecture
```
┌────────────────────────┐              ┌────────────────────────┐
│   Extended Client      │              │   Extended Server      │
├────────────────────────┤              ├────────────────────────┤
│ WsRpcClientExtended    │◄──WebSocket─►│ WsRpcServerExtended    │
│                        │              │                        │
│ - WebSocket (primary)  │◄────HTTP────►│ - WebSocket Server     │
│ - HTTP Fallback        │              │ - HTTP API Server      │
│ - localStorage         │              │ - Result Cache         │
│ - Request Persistence  │              │ - Delayed Callbacks    │
│ - HTTP Polling         │              │ - Request Metadata     │
└────────────────────────┘              └────────────────────────┘
         │                                        │
         │ Persists to                            │ Caches to
         ↓                                        ↓
  [localStorage/File]                      [ResultCache Map]
```

## Extended Features Documentation

### 1. HTTP Fallback

When WebSocket connection fails, automatically fall back to HTTP mode:

```javascript
const client = new WsRpcClientExtended('ws://localhost:8081', {
    httpUrl: 'http://localhost:8082',
    enableHttp: true,           // Enable HTTP fallback
    preferWebSocket: true       // Try WebSocket first
});

// Client automatically uses HTTP if WebSocket fails
const result = await client.call('myRoute', { data: 'test' });
```

### 2. Result Caching & Delayed Callbacks

Server can execute callbacks at any time and cache results:

```javascript
// Server side
const server = new WsRpcServerExtended({
    port: 8081,
    httpPort: 8082,
    enableHttp: true,
    cacheMaxSize: 10000,
    cacheTTL: 3600000  // 1 hour
});

// Execute callback with result caching
const { requestId, result } = await server.callWithCallback(
    'clientRoute',
    { data: 'test' },
    clientId
);

// Later, execute delayed callback (e.g., after 5 seconds)
await server.executeDelayedCallback(
    'delayed_req_123',
    'notifyClient',
    { message: 'Ready!' },
    clientId,
    5000  // 5 second delay
);

// Get cached result anytime
const cached = server.getResult(requestId);
```

### 3. Request Persistence

Client persists requests to localStorage/file to survive page refresh:

```javascript
// Browser
const client = new WsRpcBrowserClient('ws://localhost:8081', {
    enablePersistence: true,    // Enable localStorage persistence
    storagePrefix: 'myapp_'     // Custom storage key prefix
});

// Node.js with custom storage
class FileStorage {
    setItem(key, value) { /* save to file */ }
    getItem(key) { /* load from file */ }
    removeItem(key) { /* delete from file */ }
    key(index) { /* get key by index */ }
    get length() { /* return count */ }
}

const client = new WsRpcClientExtended('ws://localhost:8081', {
    enablePersistence: true,
    storage: new FileStorage('./storage.json')
});

// Requests are automatically persisted
await client.call('slowOperation', { data: 'test' });

// After refresh/restart, check persisted requests
const persisted = client.getPersistedRequests();
console.log('Recovered requests:', persisted);

// Clear persisted requests
client.clearPersistedRequests();
```

### 4. HTTP Polling

Client can poll for long-running operation results:

```javascript
// Automatic polling (default)
const result = await client.call('slowOperation', { duration: 5000 }, {
    polling: true,                    // Enable polling (default)
    requestId: 'custom_id_123'       // Optional custom ID
});

// Manual polling
const result = await client.call('slowOperation', { duration: 5000 }, {
    polling: false  // Don't auto-poll, return immediately
});

console.log(result);  // { requestId: '...', status: 'pending' }

// Poll manually later
const status = await client.getStatus(result.requestId);
const finalResult = await client.getResult(result.requestId);
```

### 5. HTTP API Endpoints

Server exposes HTTP endpoints for result retrieval:

```bash
# Health check
GET http://localhost:8082/api/health

# Get cached result
GET http://localhost:8082/api/result?requestId=req_123

# Get request status
GET http://localhost:8082/api/status?requestId=req_123

# Execute request via HTTP
POST http://localhost:8082/api/request
Content-Type: application/json

{
  "requestId": "custom_id",
  "route": "myRoute",
  "params": { "data": "test" },
  "delay": 5000  // Optional delay in ms
}

# Server statistics
GET http://localhost:8082/api/stats
```

### 6. Unified JSON Serialization

All data is automatically serialized/deserialized as JSON:

```javascript
// Client sends
await client.call('complexRoute', {
    nested: { data: [1, 2, 3] },
    timestamp: new Date().toISOString()
});

// Server receives parsed object
server.route('complexRoute', async (params) => {
    console.log(params.nested.data);  // [1, 2, 3]
    return { result: 'processed' };
});

// Client receives parsed object
const result = await client.call('complexRoute', ...);
console.log(result.result);  // 'processed'
```

### 7. Request ID Generation

All requests automatically get unique IDs:

```javascript
// Auto-generated ID
const result = await client.call('myRoute', { data: 'test' });

// Custom ID
const result = await client.call('myRoute', { data: 'test' }, {
    requestId: 'my_custom_id_123'
});

// ID format: req_{timestamp}_{random}
// Example: req_1704067200000_a3f2b9x
```

## Complete Example: Extended Features

### Server (example-extended-server.js)
```bash
node ncore/utils/wsrpc/example-extended-server.js
```

### Client (example-extended-client.js)
```bash
node ncore/utils/wsrpc/example-extended-client.js
```

### Browser (example-extended-browser.html)
```bash
open ncore/utils/wsrpc/example-extended-browser.html
```

## Comparison: Basic vs Extended

| Feature | Basic | Extended |
|---------|-------|----------|
| WebSocket RPC | ✅ | ✅ |
| HTTP Fallback | ❌ | ✅ |
| Result Caching | ❌ | ✅ |
| Delayed Callbacks | ❌ | ✅ |
| Request Persistence | ❌ | ✅ |
| HTTP Polling | ❌ | ✅ |
| HTTP API Endpoints | ❌ | ✅ |
| Request Recovery | ❌ | ✅ |

## Use Cases

### Basic Version
- Real-time chat applications
- Live dashboards
- Simple RPC communication
- Direct request-response patterns

### Extended Version
- Long-running background jobs
- Offline-first applications
- Mission-critical operations requiring persistence
- Systems requiring request audit trails
- Multi-transport fallback scenarios
- Operations requiring result caching

## License

MIT
