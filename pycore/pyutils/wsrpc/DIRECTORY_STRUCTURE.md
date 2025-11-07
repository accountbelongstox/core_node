# Directory Structure - WebSocket RPC with Singleton Extension

## Complete Structure

```
D:\programing\core_node\pycore\
│
├── pyutils\
│   ├── wsrpc\                                    # WebSocket RPC Framework
│   │   │
│   │   ├── Core Framework (Existing)
│   │   ├── __init__.py                          # ✅ Updated: Added singleton exports
│   │   ├── ws_rpc_server.py                     # WebSocket RPC Server
│   │   ├── ws_rpc_client.py                     # WebSocket RPC Client
│   │   │
│   │   ├── libs\                                # RPC Libraries
│   │   │   ├── __init__.py
│   │   │   ├── auth_manager.py
│   │   │   ├── heartbeat_manager.py
│   │   │   ├── interceptor_manager.py
│   │   │   ├── message_compressor.py
│   │   │   ├── middleware_chain.py
│   │   │   ├── namespace_manager.py
│   │   │   ├── performance_monitor.py
│   │   │   └── rate_limiter.py
│   │   │
│   │   ├── examples\                            # RPC Examples
│   │   │   ├── __init__.py
│   │   │   ├── client_example.py
│   │   │   └── server_example.py
│   │   │
│   │   ├── Singleton Extension (NEW) ⭐
│   │   ├── singleton_backend.py                 # 🆕 Core singleton detection
│   │   ├── singleton_rpc_example.py             # 🆕 RPC integration + entry point
│   │   ├── test_singleton.py                    # 🆕 Test script
│   │   │
│   │   └── Documentation (NEW) 📚
│   │       ├── SINGLETON_README.md              # 🆕 Complete documentation (~800 lines)
│   │       ├── QUICK_START.md                   # 🆕 Quick start guide (bilingual)
│   │       ├── IMPLEMENTATION_SUMMARY.md        # 🆕 Technical details (~500 lines)
│   │       ├── COMPLETION_REPORT.md             # 🆕 Project completion report
│   │       └── DIRECTORY_STRUCTURE.md           # 🆕 This file
│   │
│   └── singleton_launcher_template.py           # 🆕 Standalone template (copy-paste ready)
│
└── pyfoundations\
    └── gvar\
        └── ws_rpc_constants.py                  # RPC constants (used by framework)
```

## New Files Summary

### Core Implementation (3 files)

1. **`singleton_backend.py`** (~400 lines)
   - Core singleton detection logic
   - `SingletonBackendDetector` class
   - Utility functions: `send_shutdown_signal()`, `get_instance_status()`
   - Only uses Python standard library

2. **`singleton_rpc_example.py`** (~350 lines)
   - Full RPC integration example
   - `SingletonRpcBackend` class
   - Example backend routes (echo, status, process_task, shutdown)
   - Example client routes (notify, update)
   - Entry point: `main()` and `simple_main()`

3. **`singleton_launcher_template.py`** (~400 lines)
   - Standalone template for any project
   - Copy-paste ready (no dependencies on wsrpc)
   - `SingletonLauncher` base class
   - `ExampleApp` with working example
   - Complete inline documentation

### Testing (1 file)

4. **`test_singleton.py`** (~150 lines)
   - Test implementation
   - CLI interface (run, status, shutdown)
   - `TestBackend` example class
   - Verification functions

### Documentation (5 files)

5. **`SINGLETON_README.md`** (~800 lines)
   - Complete technical documentation
   - Architecture diagrams
   - API reference
   - Usage examples
   - Best practices
   - Troubleshooting guide

6. **`QUICK_START.md`** (~300 lines)
   - Bilingual guide (English + Chinese)
   - Quick start examples
   - Architecture overview
   - Common use cases
   - Command reference

7. **`IMPLEMENTATION_SUMMARY.md`** (~500 lines)
   - Design decisions
   - Architecture details
   - Testing results
   - Integration points
   - Future enhancements

8. **`COMPLETION_REPORT.md`** (~200 lines)
   - Requirements fulfillment
   - Deliverables summary
   - Usage guide
   - Quality metrics

9. **`DIRECTORY_STRUCTURE.md`** (this file)
   - Visual directory structure
   - File descriptions
   - Quick navigation

### Updated Files (1 file)

10. **`__init__.py`** (modified)
    - Added singleton exports
    - Updated version to 1.0.1

**Total**: 10 files (9 new + 1 updated)
**Total Lines**: ~3,100 lines of code and documentation

## File Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                    singleton_backend.py                          │
│                  (Core Singleton Logic)                          │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ SingletonBackendDetector                                 │   │
│  │ - check_instance_exists()                                │   │
│  │ - start()                                                 │   │
│  │ - stop()                                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ extends
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  singleton_rpc_example.py                        │
│             (RPC Integration + Examples)                         │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ SingletonRpcBackend(SingletonBackendDetector)           │   │
│  │ - Integrates with ws_rpc_server.py                      │   │
│  │ - Integrates with ws_rpc_client.py                      │   │
│  │ - Example backend routes                                 │   │
│  │ - Example client routes                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ SimpleExample(SingletonBackendDetector)                 │   │
│  │ - Basic example without RPC                              │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              singleton_launcher_template.py                      │
│              (Standalone Template)                               │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ SingletonLauncher                                        │   │
│  │ - Complete standalone implementation                     │   │
│  │ - No wsrpc dependency                                    │   │
│  │ - Copy-paste ready                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ExampleApp(SingletonLauncher)                           │   │
│  │ - Working example                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    test_singleton.py                             │
│                   (Test & Verification)                          │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ TestBackend(SingletonBackendDetector)                   │   │
│  │ - test_basic_functionality()                             │   │
│  │ - test_status_query()                                    │   │
│  │ - test_shutdown_signal()                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Dependencies Graph

```
Python Standard Library (socket, threading, json, time)
    │
    ├─► singleton_backend.py
    │       │
    │       ├─► singleton_rpc_example.py
    │       │       │
    │       │       └─► ws_rpc_server.py (existing)
    │       │       └─► ws_rpc_client.py (existing)
    │       │               └─► websockets (external)
    │       │
    │       └─► test_singleton.py
    │
    └─► singleton_launcher_template.py (independent)
```

## Import Paths

### Option 1: Use from wsrpc package
```python
# Core singleton
from pycore.pyutils.wsrpc import SingletonBackendDetector

# Utility functions
from pycore.pyutils.wsrpc import send_shutdown_signal, get_instance_status

# RPC integration
from pycore.pyutils.wsrpc.singleton_rpc_example import SingletonRpcBackend
```

### Option 2: Use standalone template
```python
# Copy singleton_launcher_template.py to your project first
from your_project.singleton_launcher_template import SingletonLauncher

class YourApp(SingletonLauncher):
    # Your implementation
    pass
```

## Quick Navigation

### Want to understand the concept?
→ Read `QUICK_START.md`

### Want detailed documentation?
→ Read `SINGLETON_README.md`

### Want to see how it's implemented?
→ Read `IMPLEMENTATION_SUMMARY.md`

### Want to integrate with RPC?
→ Check `singleton_rpc_example.py`

### Want standalone template?
→ Copy `singleton_launcher_template.py`

### Want to test it?
→ Run `test_singleton.py`

### Want project summary?
→ Read `COMPLETION_REPORT.md`

## File Sizes

| File | Size | Type |
|------|------|------|
| singleton_backend.py | ~15KB | Code |
| singleton_rpc_example.py | ~13KB | Code + Example |
| singleton_launcher_template.py | ~15KB | Code + Template |
| test_singleton.py | ~5KB | Code + Test |
| SINGLETON_README.md | ~30KB | Documentation |
| QUICK_START.md | ~12KB | Documentation |
| IMPLEMENTATION_SUMMARY.md | ~20KB | Documentation |
| COMPLETION_REPORT.md | ~10KB | Documentation |
| DIRECTORY_STRUCTURE.md | ~8KB | Documentation |
| __init__.py | ~0.5KB | Configuration |

**Total**: ~128KB

## Version Control

```bash
# Git status would show:
M  pycore/pyutils/wsrpc/__init__.py                    # Modified
A  pycore/pyutils/wsrpc/singleton_backend.py           # New
A  pycore/pyutils/wsrpc/singleton_rpc_example.py       # New
A  pycore/pyutils/wsrpc/test_singleton.py              # New
A  pycore/pyutils/wsrpc/SINGLETON_README.md            # New
A  pycore/pyutils/wsrpc/QUICK_START.md                 # New
A  pycore/pyutils/wsrpc/IMPLEMENTATION_SUMMARY.md      # New
A  pycore/pyutils/wsrpc/COMPLETION_REPORT.md           # New
A  pycore/pyutils/wsrpc/DIRECTORY_STRUCTURE.md         # New
A  pycore/pyutils/singleton_launcher_template.py       # New
```

## Usage Flow

```
Developer wants singleton functionality
    │
    ├─► Using with wsrpc?
    │   └─► YES
    │       └─► Import singleton_rpc_example
    │           └─► Extend SingletonRpcBackend
    │               └─► Implement routes
    │                   └─► Start
    │
    └─► Standalone project?
        └─► YES
            └─► Copy singleton_launcher_template.py
                └─► Extend SingletonLauncher
                    └─► Implement run_backend() and run_client_communication()
                        └─► Start
```

## Testing Flow

```
Want to test?
    │
    ├─► Basic functionality
    │   └─► python test_singleton.py
    │
    ├─► Query status
    │   └─► python test_singleton.py status
    │
    ├─► Shutdown instance
    │   └─► python test_singleton.py shutdown
    │
    └─► RPC integration
        └─► python singleton_rpc_example.py
```

## Maintenance

### When adding new features:
1. Update `singleton_backend.py` or create new module
2. Add examples to `singleton_rpc_example.py`
3. Add tests to `test_singleton.py`
4. Update `SINGLETON_README.md`
5. Update `QUICK_START.md` if user-facing
6. Update version in `__init__.py`

### When fixing bugs:
1. Identify affected file
2. Fix in source
3. Update relevant tests
4. Update docs if behavior changes
5. Increment patch version

---

**Structure Version**: 1.0.1
**Last Updated**: 2025-11-07
