# pyutils.rpc_v2

`rpc_v2` is the shared HTTP-first RPC stack. HTTP controllers are the primary request transport; WebSocket reuses the same dispatcher for bidirectional calls and event delivery.

## Public components

- `RpcServer`: application composition, controller registration, HTTP endpoints, WebSocket transport, and event delivery.
- `RpcServerRunner`: uvicorn lifecycle integration with `THREAD_BUS`.
- `rpc_delivery_service`: process-wide event and log publisher for active RPC servers.
- `RpcServiceScanner`: optional LAN discovery through the protocol status endpoint.
- `HttpEventService`: isolated HTTP event journal used by standalone processes that cannot import pycore.

## Server setup

```python
from pycore.pyutils.rpc_v2.runner import RpcServerRunner


runner = RpcServerRunner(host="0.0.0.0", port=59000)


async def get_status(params, request_id):
    return {"status": "ok"}


runner.route("status", get_status, description="Return service status")
runner.start()
```

Use `RpcServer` directly when an existing launcher owns the ASGI lifecycle:

```python
from pycore.pyutils.rpc_v2.server import RpcServer


server = RpcServer({"host": "0.0.0.0", "port": 59000})
server.route("status", get_status)
app = server.app
```

## Transport endpoints

- `POST /api/controller/{name}`: primary RPC request endpoint.
- `GET /api/controller/{name}`: query-string RPC request endpoint.
- `GET /api/controllers`: registered controller metadata.
- `GET /rpc/status`: discovery and health status.
- `GET /rpc/info`: protocol information.
- `GET /rpc/routes`: shared route metadata.
- `WS /rpc/ws`: full-duplex RPC and event transport.
- `GET /api/events`: compatibility long-poll event stream.
- `POST /api/events/ack`: compatibility event acknowledgement.

HTTP and WebSocket calls resolve through the same route table. A handler may be synchronous or asynchronous and may accept no arguments, `params`, `(params, request_id)`, or `(params, request_id, context)`.

## Publishing events

```python
from pycore.pyutils.rpc_v2.delivery import rpc_delivery_service


rpc_delivery_service.publish_topic(
    "service.updated",
    {"service_id": "worker-1"},
)
```

Durable events carry `event_id` and `seq`. Clients acknowledge the latest sequence, and reconnecting clients replay journal entries after their acknowledged cursor. `client_id` can restrict an event to one client.

## Discovery

```python
from pycore.pyutils.rpc_v2.discovery import rpc_service_scanner


hosts = rpc_service_scanner.scan_network_segment()
```

Discovery checks `/rpc/status` on the configured pycore HTTP port. It is optional and is not part of server startup.

## Removed legacy APIs

The old config, address-provider, protocol-client, shared-table, translator-module, and nested server packages were removed. Import concrete components from the paths shown above.
