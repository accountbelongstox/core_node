# Unified Message Types

**Created**: 2025‑11‑18  
**Scope**: Applies to `pycore/pyutils/rpc_v2` WebSocket and HTTP transports.

---

## 1. Core Principles

1. Every payload (WebSocket push, HTTP poll response, inventory replay) uses **exactly** the same envelope.
2. `type` identifies the semantic meaning of the message; consumers branch on it instead of inspecting ad‑hoc fields.
3. `id` always refers to the original `request_id`. Even heartbeat responses include the ID list for pending events.
4. `queue` is optional and may be `null`. When present it contains queue diagnostics but never replaces the envelope.
5. No transport implements custom timeout envelopes—long running tasks reuse this structure until they resolve.

---

## 2. Envelope Definition

```typescript
type MessageType =
    | 'request'
    | 'response'
    | 'event'
    | 'error'
    | 'welcome'
    | 'ping'
    | 'pong'
    | 'ack'
    | 'inventory';

type TaskStatus = 'accepted' | 'pending' | 'processing' | 'completed' | 'failed';

interface QueueInfo {
    position?: number;
    total?: number;
    estimated_time?: number;
    completed_tasks?: Array<{
        id: string;
        status: TaskStatus;
        result?: any;
        error?: string;
        timestamp: number;
    }>;
}

interface UnifiedMessage {
    type: MessageType;
    id: string;
    route?: string;
    event?: string;
    status?: TaskStatus;
    success?: boolean;
    result?: any;
    error?: string | null;
    params?: Record<string, any>;
    data?: any;
    requires_ack?: boolean;
    queue?: QueueInfo | null;
    timestamp?: number;
    from_inventory?: boolean;
}
```

---

## 3. Transport Examples

### 3.1 WebSocket Request

```json
{
  "type": "request",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "route": "queue_stats",
  "params": { "scope": "speech" }
}
```

### 3.2 WebSocket Response

```json
{
  "type": "response",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "route": "queue_stats",
  "status": "completed",
  "success": true,
  "result": { "pending": 0, "workers": 3 },
  "requires_ack": true,
  "queue": null,
  "timestamp": 1700000000000
}
```

### 3.3 HTTP Poll Reply (still pending)

```json
{
  "type": "response",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "route": "speech_tts",
  "status": "processing",
  "success": false,
  "result": null,
  "queue": {
    "position": 4,
    "total": 7,
    "estimated_time": 32.5
  },
  "requires_ack": true
}
```

### 3.4 Inventory Replay

```json
{
  "type": "inventory",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "route": "speech_tts",
  "status": "completed",
  "success": true,
  "result": { "file_path": "..." },
  "from_inventory": true,
  "requires_ack": true
}
```

### 3.5 Event Push

```json
{
  "type": "event",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "route": "request_accepted",
  "event": "request_accepted",
  "data": { "status": "accepted" },
  "requires_ack": true
}
```

---

## 4. Client Handling Template

```javascript
switch (message.type) {
    case 'response': {
        const pending = pendingRequests.get(message.id);
        if (pending) {
            pendingRequests.delete(message.id);
            message.success ? pending.resolve(message.result)
                            : pending.reject(new Error(message.error || 'RPC error'));
        }
        if (message.requires_ack) sendAck(message.id);
        break;
    }
    case 'event': {
        const handler = routeHandlers.get(message.route || message.event);
        if (handler) handler(message.data || message);
        if (message.requires_ack) sendAck(message.id);
        break;
    }
    case 'inventory': {
        // Treat exactly like 'response' but mark as replayed.
        break;
    }
    case 'error': {
        console.error('[RPC] server error', message);
        break;
    }
    default:
        break;
}
```

---

## 5. Compliance Notes

- HTTP pollers and WebSocket clients must never invent alternative payloads or change the `type` semantics.
- Long running jobs never time out on the client; they rely on the server to signal completion/failure.
- Whenever a new `type` is introduced it must be documented here and in `RPC_PROTOCOL_SPECIFICATION.md`.

This unified envelope keeps the RPC stack symmetrical and guarantees that inventory replay, event queues, and heartbeat delivery always agree across transports.

