# Deprecated Files Archive

This directory contains deprecated code that has been replaced by newer implementations.

## Deprecation Date
2025-01-12

## Why Deprecated

### Old Discovery Mechanisms (_old_discovery/)
These files implemented device discovery mechanisms that have been replaced:

- **device_discovery_udp.py** - UDP broadcast approach (had issues with network compatibility)
- **discovery.py** - Old TCP discovery (replaced by device_discovery_scanner.py)
- **http_discovery.py** - HTTP discovery (functionality merged into simple_device_scanner.py)

**Replaced by:**
- `device_discovery_scanner.py` - TCP scanner with network caching
- `simple_device_scanner.py` - Core scanning logic
- `network_cache.py` - Network configuration cache

### Old Server Implementations (_old_servers/)
These files implemented separate server components that have been unified:

- **sync_server.py** - Old sync server
- **http_sync_server.py** - HTTP sync server
- **web_server.py** - Web server
- **websocket_server.py** - WebSocket server
- **sync_client.py** - Old sync client

**Replaced by:**
- `unified_server.py` - Unified HTTP + WebSocket + File server
- `http_sync_client.py` - Modern HTTP sync client

### Test Files (_tests/)
Old test files that may still be useful for reference:

- Various test_*.py files
- Diagnostic tools

## Current Architecture

### Core Components (Active)
```
device_sync/
├── __main__.py              # Entry point
├── daemon.py                # Background process manager
├── tray_menu.py            # System tray UI
├── device_manager.py        # Central coordinator
│
├── device_discovery_scanner.py  # Device discovery (TCP scan)
├── simple_device_scanner.py     # Core scanning logic
├── network_cache.py             # Network config cache
│
├── unified_server.py        # HTTP + WebSocket + File server
├── http_sync_client.py     # Sync client
│
├── logging_config.py        # Logging
├── sync_history.py         # History tracking
└── ipc_server.py           # IPC communication
```

## Recovery

If you need to recover any deprecated file:
1. Copy from `_deprecated/` back to parent directory
2. Check for import compatibility with current code
3. May require code modifications to work with current architecture
