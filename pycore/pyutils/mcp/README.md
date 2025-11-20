# MCP Network Discovery Tools

Utilities for discovering MCP servers on local networks.

## Components

### 1. NetworkScanner
Detects local network configuration and scans for active hosts.

**Features:**
- Multi-stage local IP detection (fast → fallback → platform-specific)
- Gateway/router detection
- Network segment identification
- Concurrent host scanning (1-255) with 500ms timeout
- Cross-platform support (Windows/Linux)

**Usage:**
```python
from pycore.pyutils.mcp import NetworkScanner

scanner = NetworkScanner(debug=True)

# Detect local IP
local_ip = scanner.detect_local_ip()
print(f"Local IP: {local_ip}")

# Detect network segment
network_info = scanner.detect_network_segment()
print(f"Network: {network_info['network']}")
print(f"Gateway: {network_info['gateway']}")

# Scan for active hosts
active_hosts = scanner.scan_network_segment()
print(f"Found {len(active_hosts)} active hosts")
```

### 2. MCPServerDiscovery
Discovers MCP servers on the local network.

**Features:**
- Automatic network detection
- Parallel server probing
- Quick mode (local + gateway only)
- Full mode (entire network scan)
- Custom port configuration

**Usage:**
```python
from pycore.pyutils.mcp import MCPServerDiscovery

discovery = MCPServerDiscovery(debug=True)

# Quick discovery (fast)
servers = discovery.find_servers_quick()

# Full discovery (thorough)
servers = discovery.find_servers_full()

# Custom discovery
servers = discovery.find_servers(ports=[8767, 8768])

# Print report
discovery.print_discovery_report()
```

## Detection Strategy

### Stage 1: Local IP Detection
1. **Quick**: Socket hostname resolution
2. **Fallback**: Connect to external address (8.8.8.8)
3. **Platform-specific**: Parse system commands (ipconfig/ip addr)

### Stage 2: Gateway Detection
1. Probe common gateway addresses (192.168.x.1, 10.0.0.1, etc.)
2. Parse system routing table

### Stage 3: Network Scanning
1. Detect network segment (e.g., 192.168.1.0/24)
2. Concurrent TCP probe of all IPs (1-255)
3. 500ms timeout per host
4. Check common ports (80, 443, 22)

### Stage 4: MCP Server Discovery
1. Scan active hosts for MCP ports (default: 8767)
2. Verify server response
3. Collect server metadata

## Examples

Run example scripts:
```bash
python -m pycore.pyutils.mcp.example_usage
```

## Architecture

```
pycore/pyutils/mcp/
├── __init__.py                  # Package exports
├── network_scanner.py           # Network detection and scanning
├── mcp_server_discovery.py      # MCP server discovery
├── example_usage.py             # Usage examples
└── README.md                    # This file
```

## Performance

- **Quick Discovery**: ~1-2 seconds
- **Network Scan**: ~30-60 seconds (depends on network size)
- **Full Discovery**: ~1-2 minutes

## Platform Support

- ✅ Windows (tested)
- ✅ Linux (tested)
- ⚠️ macOS (should work, not tested)

## Requirements

- Python 3.10+
- Standard library only (no external dependencies)

## Future Enhancements

- [ ] MCP protocol handshake verification
- [ ] IPv6 support
- [ ] Custom network range scanning
- [ ] Server health monitoring
- [ ] Discovery caching
- [ ] Multicast discovery (mDNS/Bonjour)
