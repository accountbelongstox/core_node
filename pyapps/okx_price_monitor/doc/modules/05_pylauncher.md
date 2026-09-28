# pylauncher - Application Launcher with Singleton Detection

## Overview

The `pylauncher` module provides a configuration-driven service launching system with cross-process singleton detection. It ensures only one instance of an application runs at a time and provides unified service management.

## Module Location

```
pycore/pylauncher/
├── __init__.py
├── launcher.py
├── singleton_detector.py
└── README.md
```

## Architecture

### Singleton Detection

```
┌─────────────────────────────────────────────────────────────┐
│                    SingletonDetector                        │
│                                                             │
│  ┌─────────────────┐    ┌─────────────────────────────┐    │
│  │  Port Scanner   │───>│  Protocol Verification      │    │
│  │  (54000-54100)  │    │  JSON-RPC handshake         │    │
│  └─────────────────┘    └─────────────────────────────┘    │
│                                                             │
│  Instance Found? ──Yes──> Send Shutdown Signal ──> Wait    │
│         │                                                   │
│        No                                                   │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────────┐                                       │
│  │  Bind Port      │                                       │
│  │  Start Server   │                                       │
│  └─────────────────┘                                       │
└─────────────────────────────────────────────────────────────┘
```

### Service Launcher

```
┌─────────────────────────────────────────────────────────────┐
│                    ServiceLauncher                          │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ LauncherConfig  │  │ SingletonDetect │                  │
│  │                 │  │                 │                  │
│  └────────┬────────┘  └────────┬────────┘                  │
│           │                    │                            │
│           ▼                    ▼                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Service Registry                        │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐            │   │
│  │  │ rpc_v2   │ │ speech   │ │ ui       │            │   │
│  │  └──────────┘ └──────────┘ └──────────┘            │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### LauncherConfig

Configuration class for service launching:

```python
from pycore.pylauncher import LauncherConfig

# Modern API
config = LauncherConfig(
    app_id="my_app",
    singleton=True,
    shutdown_existing=True,
    services={
        'rpc_v2': {'port': 58100},
        'speech': {'mode': 'single'}
    }
)

# Legacy API (still supported)
config = LauncherConfig(
    enable_rpc_v2=True,
    rpc_v2_port=58100,
    singleton_check=True
)
```

**Configuration Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `app_id` | str | None | Application identifier |
| `singleton` | bool | True | Enable singleton detection |
| `shutdown_existing` | bool | True | Shutdown existing instance |
| `port_start` | int | 54000 | Singleton port range start |
| `port_range` | int | 100 | Number of ports to scan |
| `services` | dict | {} | Services to start |

**Service Configuration:**

```python
services={
    'rpc_v2': {
        'port': 58100,
        'host': '0.0.0.0',
        'enable_discovery': True
    },
    'speech': {
        'mode': 'single',  # 'single' or 'multi'
        'engine': 'edge_tts'
    },
    'ui': {
        'framework': 'pyside6',
        'url': 'http://localhost:3000'
    }
}
```

### ServiceLauncher

Main service launching class:

```python
from pycore.pylauncher import ServiceLauncher, LauncherConfig

config = LauncherConfig(
    app_id="my_app",
    singleton=True,
    services={'rpc_v2': {'port': 58100}}
)

launcher = ServiceLauncher(config)
launcher.start()

# Get service instance
rpc = launcher.get_service('rpc_v2')
rpc.server.route('custom', handler_func, sync=True)

# Stop all services
launcher.stop()
```

**Methods:**

```python
class ServiceLauncher:
    def __init__(self, config: LauncherConfig):
        """Initialize launcher with config"""
    
    def start(self) -> bool:
        """Start all configured services"""
    
    def stop(self):
        """Stop all services"""
    
    def get_service(self, name: str) -> Any:
        """Get service instance by name"""
    
    def is_running(self) -> bool:
        """Check if launcher is running"""
    
    def get_status(self) -> Dict[str, Any]:
        """Get launcher status"""
```

### SingletonDetector

Cross-process singleton detection:

```python
from pycore.pylauncher import SingletonDetector, DetectionResult

detector = SingletonDetector(
    app_id="my_app",
    port_start=54000,
    port_range=100
)

result = detector.detect_and_bind()

if result.existing_instance:
    print(f"Existing instance found on port {result.existing_port}")
    if result.shutdown_sent:
        print("Shutdown signal sent")
else:
    print(f"Bound to port {result.bound_port}")
```

**DetectionResult:**

```python
@dataclass
class DetectionResult:
    existing_instance: bool  # True if existing instance found
    existing_port: int       # Port of existing instance
    shutdown_sent: bool      # True if shutdown signal sent
    bound_port: int          # Port we bound to
    error: Optional[str]     # Error message if any
```

## Protocol

### Singleton Protocol

JSON-RPC based protocol for instance detection:

```python
class ProtocolVersion(Enum):
    V1 = "1.0"

class MessageType(Enum):
    PING = "ping"
    PONG = "pong"
    SHUTDOWN = "shutdown"
    SHUTDOWN_ACK = "shutdown_ack"
    STATUS = "status"
    STATUS_RESPONSE = "status_response"
```

**Handshake Flow:**

```
Client                          Server
  │                               │
  │────── PING ─────────────────>│
  │                               │
  │<───── PONG ─────────────────│
  │     {app_id, pid, uptime}    │
  │                               │
  │────── SHUTDOWN ────────────>│
  │                               │
  │<───── SHUTDOWN_ACK ─────────│
  │                               │
```

**Message Format:**

```python
{
    "jsonrpc": "2.0",
    "method": "ping",  # or pong, shutdown, etc.
    "params": {
        "protocol_version": "1.0",
        "app_id": "my_app"
    },
    "id": "uuid"
}
```

## Usage Examples

### Basic Service Launch

```python
from pycore.pylauncher import LauncherConfig, ServiceLauncher

config = LauncherConfig(
    app_id="my_app",
    singleton=True,
    services={
        'rpc_v2': {'port': 58100}
    }
)

launcher = ServiceLauncher(config)

if launcher.start():
    print("Services started successfully")
    
    # Keep running
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        launcher.stop()
```

### With Multiple Services

```python
config = LauncherConfig(
    app_id="full_app",
    singleton=True,
    shutdown_existing=True,
    services={
        'rpc_v2': {
            'port': 58100,
            'enable_discovery': True
        },
        'speech': {
            'mode': 'single',
            'engine': 'edge_tts'
        },
        'heartbeat': {
            'interval': 1.0
        }
    }
)

launcher = ServiceLauncher(config)
launcher.start()

# Access individual services
rpc = launcher.get_service('rpc_v2')
speech = launcher.get_service('speech')

# Add custom RPC routes
rpc.server.route('custom_handler', my_handler)
```

### Manual Singleton Detection

```python
from pycore.pylauncher import SingletonDetector, detect_singleton

# Quick detection
result = detect_singleton("my_app")
print(f"Existing instance: {result.existing_instance}")

# Full control
detector = SingletonDetector(
    app_id="my_app",
    port_start=54000,
    port_range=100
)

# Just detect, don't bind
result = detector.detect_only()

if result.existing_instance:
    # Manually send shutdown
    detector.send_shutdown(result.existing_port)
    time.sleep(2)  # Wait for shutdown

# Now bind
result = detector.detect_and_bind()
```

### Legacy API Migration

```python
# Old way (still works)
config = LauncherConfig(
    enable_rpc_v2=True,
    rpc_v2_port=58100,
    enable_speech=True,
    speech_mode='single',
    singleton_check=True
)

# New way (recommended)
config = LauncherConfig(
    app_id="my_app",
    singleton=True,
    services={
        'rpc_v2': {'port': 58100},
        'speech': {'mode': 'single'}
    }
)
```

## Convenience Functions

```python
from pycore.pylauncher import launch_services, stop_services

# Quick launch
launcher = launch_services(
    app_id="quick_app",
    rpc_v2_port=58100
)

# Later...
stop_services(launcher)
```

## Service Registry

Available services that can be started:

| Service | Description | Config Options |
|---------|-------------|----------------|
| `rpc_v2` | FastAPI RPC server | port, host, enable_discovery |
| `speech` | Speech (TTS/STT) | mode, engine |
| `heartbeat` | Heartbeat system | interval |
| `ui` | Native UI | framework, url |

### Adding Custom Services

Services are registered in `pycore.pythreadpool.registry`:

```python
from pycore.pythreadpool import register_service

def start_my_service(config: dict) -> Any:
    """Custom service starter"""
    service = MyService(**config)
    service.start()
    return service

register_service(
    name='my_service',
    starter=start_my_service,
    default_config={'param': 'value'}
)
```

## Error Handling

```python
launcher = ServiceLauncher(config)

try:
    if not launcher.start():
        print("Failed to start services")
        print(f"Error: {launcher.get_error()}")
except Exception as e:
    print(f"Launcher error: {e}")
```

## Status Monitoring

```python
launcher = ServiceLauncher(config)
launcher.start()

status = launcher.get_status()
print(f"Running: {status['running']}")
print(f"Uptime: {status['uptime']}s")
print(f"Singleton port: {status['singleton_port']}")

for service_name, service_status in status['services'].items():
    print(f"  {service_name}: {service_status['state']}")
```

## Best Practices

1. **Always Set app_id**: Unique identifier prevents conflicts

2. **Use Singleton Mode**: Prevents multiple instances

3. **Enable Shutdown Existing**: Gracefully replaces old instances

4. **Check Start Result**: Handle startup failures

5. **Implement Graceful Shutdown**: Call `stop()` on exit

## Related Modules

- `pycore.pythreadpool` - Service registry and starters
- `pycore.pyutils.rpc_v2` - RPC server implementation
- `pycore.pyctl.speech` - Speech service
- `pycore.pyheartbeat` - Heartbeat system

## Exports

```python
__all__ = [
    # Service Launcher
    'LauncherConfig',
    'ServiceLauncher',
    'launch_services',
    'stop_services',
    
    # Singleton Detection
    'SingletonDetector',
    'DetectionResult',
    'ProtocolVersion',
    'MessageType',
    'detect_singleton',
]

__version__ = '2.0.0'
```

