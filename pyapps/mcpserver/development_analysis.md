# mcpserver - Development Analysis

**Application:** mcpserver (MCP Server - Unified Backend)
**Date:** 2025-11-09
**Status:** Active Development
**Architecture:** Singleton Pattern + WebSocket RPC

---

## Executive Summary

The **mcpserver** application is a unified MCP (Model Context Protocol) server that consolidates multiple services into a single backend using WebSocket RPC. This analysis evaluates the current implementation against pycore architecture standards and identifies areas for improvement.

---

## Architecture Overview

### Current Structure

```
pyapps/mcpserver/
├── mcpserver_main.py          # Main entry point (Singleton RPC backend)
├── config/                    # ✅ Application configuration
│   └── __init__.py
├── controllers/               # Business logic layer
│   └── document_offline/      # Document offline controller
├── services/                  # RPC service layer
│   ├── document_offline_service.py
│   ├── webview_service.py
│   └── icon_info_service.py
├── scripts/                   # ✅ Deployment scripts
│   ├── start.ps1
│   ├── stop.ps1
│   ├── install.ps1
│   └── deploy.ps1
└── examples/                  # Usage examples
```

### Application Responsibilities

**mcpserver** serves as:
1. **Service Aggregator** - Combines multiple MCP services into one backend
2. **RPC Gateway** - Provides WebSocket RPC interface for all services
3. **Singleton Manager** - Ensures only one backend instance runs
4. **Service Router** - Routes requests to appropriate service handlers

---

## pycore vs app Code Distribution

### What Should Stay in `pyapps/mcpserver/`

#### 1. Application Entry Point
- **File:** `mcpserver_main.py`
- **Responsibility:** Initialize and start the unified MCP server
- **Justification:** App-specific startup logic, service registration

#### 2. Service Layer
- **Files:** `services/*.py`
- **Responsibility:** RPC route registration and request delegation
- **Justification:** App-specific service orchestration, not reusable utilities

#### 3. Controllers
- **Files:** `controllers/**/*.py`
- **Responsibility:** Business logic for specific features (document offline, etc.)
- **Justification:** App-specific domain logic

#### 4. Configuration
- **Files:** `config/__init__.py`
- **Responsibility:** Application-specific configuration (ports, features, etc.)
- **Justification:** App-level settings, not global constants

#### 5. Deployment Scripts
- **Files:** `scripts/*.ps1`
- **Responsibility:** Start, stop, install, deploy operations
- **Justification:** Required by unified management system

---

### What Should Be in `pycore/`

#### 1. WebSocket RPC Framework ✅
- **Location:** `pycore/pyutils/wsrpc/`
- **Current Status:** Already implemented
- **Usage:** `from pycore.pyutils.wsrpc.singleton_rpc_example import SingletonRpcBackend`

#### 2. Singleton Pattern Utilities ✅
- **Location:** `pycore/pyutils/wsrpc/libs/singleton_lock.py`
- **Current Status:** Already implemented
- **Usage:** Used internally by SingletonRpcBackend

#### 3. Webview Launcher ✅
- **Location:** `pycore/pyutils/web/webview_launcher.py`
- **Current Status:** Already implemented
- **Usage:** `from pycore.pyutils.web.webview_launcher import create_webview_launcher`

#### 4. Icon Analysis Tools ✅
- **Location:** `pycore/pyutils/icon_analyzer.py`, `pycore/pyutils/image_tools.py`
- **Current Status:** Already implemented
- **Usage:** `from pycore.pyutils.icon_analyzer import create_icon_analyzer`

---

### What Needs to Be Added to `pycore/`

#### 1. Global Constants in `pygvar` ⚠️
- **Status:** MISSING - `pygvar` is currently empty
- **Required Constants:**
  ```python
  # Project paths
  PROJECT_ROOT: Path
  APP_NAME: str

  # Directory paths
  CACHE_DIR: Path
  TMP_DIR: Path
  PUBLIC_DIR: Path
  LOG_DIR: Path

  # App-specific directories
  APP_RUNTIME_CACHE_DIR: Path
  APP_RUNTIME_TMP_DIR: Path
  APP_LARGE_FILES_CACHE_DIR: Path
  APP_LARGE_FILES_TMP_DIR: Path

  # Binary paths (if applicable)
  PYTHON_PATH: Path
  ```

**Recommendation:** Populate `pycore/pygvar/__init__.py` with these constants to eliminate hardcoded paths.

#### 2. Service Registry Pattern (Optional)
- **Status:** Not implemented
- **Purpose:** Auto-discovery and registration of MCP services
- **Location:** Could be `pycore/pyutils/service_registry.py`
- **Justification:** If multiple apps need service registration, this should be in pyutils

**Decision:** Currently NOT needed. Service registration is app-specific and simple enough to stay in `mcpserver_main.py`.

---

## Dependency Analysis

### pycore Dependencies Used

| Module | Usage | Status |
|--------|-------|--------|
| `pycore.ColorPrint` | Logging and console output | ✅ Used correctly |
| `pycore.pyutils.wsrpc` | WebSocket RPC framework | ✅ Used correctly |
| `pycore.pyutils.web.webview_launcher` | Webview GUI | ✅ Used correctly |
| `pycore.pyutils.icon_analyzer` | Icon analysis | ✅ Used correctly |
| `pycore.pyutils.image_tools` | Image manipulation | ✅ Used correctly |
| `pycore.pygvar` | Global constants | ❌ NOT USED (pygvar empty) |

### External Dependencies

- `websockets` - WebSocket protocol support
- `pydantic` - Data validation (if used)
- `pywebview` - Native window support (optional)

**Action:** Document these in root `requirements.txt` with comments explaining their purpose.

---

## Code Quality Assessment

### ✅ Strengths

1. **Clean Architecture** - Clear separation of services, controllers, and main entry
2. **Singleton Pattern** - Prevents multiple backend instances
3. **Lazy Loading** - Services loaded on-demand for performance
4. **Absolute Imports** - Fixed in latest revision (2025-11-09)
5. **ColorPrint Usage** - Fixed in latest revision (2025-11-09)
6. **Configuration Module** - Centralized config management
7. **Deployment Scripts** - Complete set of management scripts

### ⚠️ Areas for Improvement

1. **pygvar Usage** - Should use global constants instead of hardcoded paths
2. **Test Organization** - Test files should move to `tests/` in project root
3. **Error Handling** - Some places still raise exceptions instead of using ColorPrint
4. **Service Loading** - Mix of direct instantiation and lazy loading (should be consistent)

---

## Recommended Actions

### High Priority (Implement Now)

1. **✅ DONE - Fix Absolute Imports**
   - Replace all relative imports with absolute imports
   - Status: COMPLETED 2025-11-09

2. **✅ DONE - Replace print() with ColorPrint**
   - Ensure consistent logging across all files
   - Status: COMPLETED 2025-11-09

3. **✅ DONE - Create config/ directory**
   - Centralize configuration management
   - Status: COMPLETED 2025-11-09

4. **✅ DONE - Create scripts/ directory**
   - Add start.ps1, stop.ps1, install.ps1, deploy.ps1
   - Status: COMPLETED 2025-11-09

### Medium Priority (Next Sprint)

5. **Populate pygvar**
   - Add global constants to `pycore/pygvar/__init__.py`
   - Replace hardcoded `PROJECT_ROOT` calculations
   - Update mcpserver to use pygvar constants

6. **Move Test Files**
   - Move `test_*.py` files from `pyapps/mcpserver/` to `tests/mcpserver/`
   - Update test imports accordingly

7. **Standardize Service Loading**
   - Use consistent lazy loading pattern for all services
   - Remove direct instantiation in `__init__`

### Low Priority (Future Enhancement)

8. **Add Type Hints**
   - Improve type hints for better IDE support
   - Add return type annotations

9. **Add Docstring Examples**
   - Add usage examples to service docstrings
   - Document RPC route parameters

10. **Performance Monitoring**
    - Add request timing and statistics
    - Implement service health checks

---

## Integration with pycore

### How mcpserver Uses pycore

```python
# Foundation utilities
from pycore import ColorPrint                    # Logging
from pycore.pyutils.wsrpc import SingletonRpcBackend  # RPC framework
from pycore.pyutils.web.webview_launcher import create_webview_launcher  # GUI

# Service-specific utilities
from pycore.pyutils.icon_analyzer import create_icon_analyzer  # Icon analysis
from pycore.pyutils.image_tools import ImageTools  # Image processing
```

### What mcpserver Should NOT Do

❌ Implement generic utilities (belongs in pyutils)
❌ Define global constants (belongs in pygvar)
❌ Duplicate existing pycore functionality
❌ Use relative imports
❌ Use print() for logging
❌ Raise exceptions without logging

---

## Testing Strategy

### Current Status
- Test files exist but are in app directory (should move)
- Tests for controllers and services

### Recommended Test Structure

```
tests/
└── mcpserver/
    ├── test_mcpserver_main.py
    ├── test_services.py
    ├── test_controllers.py
    └── integration/
        └── test_rpc_integration.py
```

### Test Coverage Goals
- Unit tests: 80%+ coverage
- Integration tests: Key RPC routes
- Service tests: All service methods

---

## Deployment Checklist

### Pre-deployment
- [ ] All dependencies in `requirements.txt`
- [x] Configuration in `config/__init__.py`
- [x] Scripts in `scripts/` directory
- [ ] Tests pass
- [x] Absolute imports used
- [x] ColorPrint used for logging

### Deployment
- [x] `scripts/install.ps1` installs dependencies
- [x] `scripts/deploy.ps1` validates setup
- [x] `scripts/start.ps1` launches server
- [x] `scripts/stop.ps1` stops server

### Post-deployment
- [ ] Health check endpoint responds
- [ ] Services register correctly
- [ ] Singleton lock works
- [ ] Multiple clients can connect

---

## Future Enhancements

### Phase 1: Core Improvements
1. Complete pygvar population
2. Move test files to proper location
3. Standardize error handling

### Phase 2: Feature Additions
1. Add metrics and monitoring
2. Implement service discovery
3. Add authentication/authorization

### Phase 3: Performance
1. Optimize service loading
2. Add caching layer
3. Implement connection pooling

---

## Conclusion

The **mcpserver** application demonstrates good architecture with clear separation of concerns. Recent fixes have brought it into compliance with pycore development standards. The main remaining work is:

1. **Populate pygvar** with global constants
2. **Move test files** to project root
3. **Standardize patterns** across services

Overall, the app is well-structured and ready for production use with minor improvements.

---

**Document Version:** 1.0
**Last Updated:** 2025-11-09
**Next Review:** 2025-11-16
