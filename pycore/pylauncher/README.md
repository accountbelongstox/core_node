# PyLauncher - Service Launcher

Configuration-driven service launcher with singleton detection.

## Overview

PyLauncher provides a simple, configuration-driven way to launch and manage multiple PyCore services:

1. **Heartbeat System** - Task scheduling and distribution
2. **RPC v2 Service** - FastAPI-based RPC server
3. **Speech Service** - Speech transcription
4. **UI Service** - Native UI

## Architecture

```
ServiceLauncher (Thin Wrapper)
├── Singleton Detection (Optional)
│   └── Port-based instance detection
├── Thread Scheduling
│   ├── Heartbeat (Always enabled)
│   ├── RPC v2 (Optional)
│   ├── Speech (Optional)
│   └── UI (Optional)
└── Service Access
    └── get_service() for thread-specific API
```

Each service runs in an independent thread managed by `pythreadpool`.

## Quick Start

### Basic Usage

```python
from pycore.pylauncher import LauncherConfig, ServiceLauncher

# Create configuration
config = LauncherConfig(
    services={
        'rpc_v2': {'port': 58100, 'host': '0.0.0.0', 'debug': True}
    }
)

# Launch services
launcher = ServiceLauncher(config)
launcher.start()

# Access service instance
rpc = launcher.get_service('rpc_v2')
```

### With Singleton Detection

```python
config = LauncherConfig(
    app_id="my_app",
    singleton=True,              # Enable singleton detection
    shutdown_existing=True,      # Auto-shutdown old instance
    services={
        'rpc_v2': {'port': 58100}
    }
)

launcher = ServiceLauncher(config)
if launcher.start():
    print("Successfully became PRIMARY instance")
```

## Configuration

### LauncherConfig

Main configuration class with unified API.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `services` | Dict[str, Dict] | {} | Services to launch with their configs |
| `app_id` | str | "default_app" | Application ID for singleton detection |
| `app_name` | str | "Application" | Application display name |
| `singleton` | bool | False | Enable singleton detection |
| `singleton_port_start` | int | 54000 | Starting port for singleton detection |
| `singleton_port_range` | int | 100 | Port range for detection |
| `force_launch` | bool | False | Launch even if instance exists |
| `shutdown_existing` | bool | False | Shutdown existing instance before launch |

### Service Configurations

#### RPC v2 Service

```python
services={
    'rpc_v2': {
        'port': 58100,
        'host': '0.0.0.0',
        'debug': True
    }
}
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `port` | int | 58100 | RPC server port |
| `host` | str | "0.0.0.0" | Server host |
| `debug` | bool | True | Debug mode |

#### Speech Service

```python
services={
    'speech': {
        'mode': 'single',
        'mic_language': 'zh-CN',
        'system_language': 'en-US'
    }
}
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `mode` | str | "single" | Speech mode |
| `mic_language` | str | - | Microphone language |
| `system_language` | str | - | System language |

#### UI Service

```python
services={
    'ui': {}
}
```

UI service uses default configuration from UI thread implementation.

## Usage Examples

### Example 1: RPC v2 Only

```python
from pycore.pylauncher import LauncherConfig, ServiceLauncher

config = LauncherConfig.rpc_v2_only(port=58100, singleton=True)
launcher = ServiceLauncher(config)
launcher.start()
```

### Example 2: RPC v2 Route Extension

```python
# Start launcher
config = LauncherConfig(services={'rpc_v2': {'port': 58100}})
launcher = ServiceLauncher(config)
launcher.start()

# Get RPC instance
rpc = launcher.get_service('rpc_v2')

# Register custom route (see FastAPIRPCServer docs)
def handle_task(params):
    return {'status': 'completed', 'result': params}

rpc.server.route('process_task', handle_task, sync=True)

# Call: POST http://localhost:58100/rpc/process_task
```

### Example 3: Multiple Services

```python
config = LauncherConfig(
    app_id="multi_service_app",
    singleton=True,
    services={
        'rpc_v2': {'port': 58100},
        'speech': {'mode': 'single'}
    }
)

launcher = ServiceLauncher(config)
launcher.start()

# Access multiple services
rpc = launcher.get_service('rpc_v2')
speech = launcher.get_service('speech')
```

### Example 4: Legacy API (Backward Compatible)

```python
# Old code style still works
config = LauncherConfig(
    enable_rpc_v2=True,
    rpc_v2_port=58100,
    enable_speech=True,
    speech_mode='single',
    singleton_check=True
)

launcher = ServiceLauncher(config)
launcher.start()
```

## API Reference

### ServiceLauncher

#### Methods

**`start() -> bool`**

Start all configured services.

Returns True if services started successfully.

**`stop() -> bool`**

Stop all services via THREAD_BUS shutdown stack.

**`get_service(name: str)`**

Get service instance by name.

- `name`: Service name ('rpc_v2', 'heartbeat', 'speech', 'ui')

Returns the actual thread instance or None.

**`is_running() -> bool`**

Check if launcher is running.

### LauncherConfig Quick Configs

**`LauncherConfig.rpc_v2_only(port, singleton)`**

Quick config for RPC v2 only.

**`LauncherConfig.speech_only(mode, singleton)`**

Quick config for Speech only.

## Service-Specific Documentation

For service-specific functionality (route registration, task submission, etc.), see:

- **RPC v2**: `pycore/pyutils/rpc_v2/` - FastAPIRPCServer
- **Heartbeat**: `pycore/pyheartbeat/` - HeartbeatSystem
- **Speech**: `pycore/pyctl/speech/` - SpeechTranscriptionThread
- **Thread Pool**: `pycore/pythreadpool/` - Service starters and registry

## Responsibility Boundaries

**Launcher is ONLY responsible for:**

1. Singleton Detection - Detecting and managing single instance
2. Thread Scheduling - Starting services in correct order

**Launcher is NOT responsible for:**

- Thread-specific functionality (route registration, task submission, etc.)
- Service configuration details
- Service implementation

Use `get_service()` to access service instances for specific operations.

## Shutdown Behavior

Services shutdown in priority order (via THREAD_BUS shutdown stack):

1. RPC v2 (priority 50) - Shutdown first
2. Speech (priority 75)
3. UI (priority 90)
4. Heartbeat (priority 100) - Shutdown last

```python
launcher.stop()  # Triggers orderly shutdown
```

## Notes

1. **Heartbeat Always Enabled**: Heartbeat system is always started
2. **Singleton Detection**: Uses port-based protocol for instance detection
3. **Service Access**: Use `get_service()` to access thread-specific APIs
4. **Thread Safety**: All services managed by GlobalThreadPool

## Dependencies

- pycore.pyfoundations
- pycore.pythreadpool
- pycore.pyheartbeat
- pycore.pyutils.rpc_v2
- pycore.pyctl.speech

## Version

Current version: 2.0.0

## License

MIT License
