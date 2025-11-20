# Code Duplication Analysis Report

## Files Analyzed
- `pycore/pylauncher/launcher.py` (331 lines)
- `pycore/pylauncher/singleton_detector.py` (617 lines)

## Summary

✅ **No duplicate definitions found** after refactoring.

## Changes Made

### 1. Eliminated Duplication in launcher.py

**Before:** SingletonDetector creation code appeared twice (lines 196-203 and 217-224)

```python
# Appeared twice with identical code:
self.singleton_detector = SingletonDetector(
    app_id=self.config.app_id,
    port_start=self.config.singleton_port_start,
    port_range=self.config.singleton_port_range,
    debug=True,
    on_message=on_msg,
    state_checker=state_checker
)
detection = self.singleton_detector.detect_and_bind()
```

**After:** Extracted to helper method `_create_singleton_detector()`

```python
def _create_singleton_detector(self, on_msg, state_checker):
    """Create and bind singleton detector (extracted to avoid duplication)"""
    detector = SingletonDetector(...)
    return detector, detector.detect_and_bind()

# Used in two places:
self.singleton_detector, detection = self._create_singleton_detector(on_msg, state_checker)
```

**Saved:** ~10 lines of duplicate code

## Architectural Separation

### launcher.py (Orchestration Layer)
**Responsibilities:**
- Configuration management (LauncherConfig)
- Service coordination (ServiceLauncher)
- Singleton detection orchestration
- THREAD_BUS integration

**Key Classes:**
- `LauncherConfig` - Unified configuration
- `ServiceLauncher` - Main launcher

**Dependencies:**
- `pycore.THREAD_BUS`
- `pycore.ColorPrint`
- `pycore.pythreadpool`
- `pycore.pylauncher.singleton_detector`

### singleton_detector.py (Detection Layer)
**Responsibilities:**
- Port-based singleton detection
- Protocol verification
- Instance communication

**Key Classes:**
- `ProtocolVersion` - Protocol constants
- `MessageType` - Message type enum
- `DetectionResult` - Detection result data
- `SingletonDetector` - Core detector logic

**Dependencies:**
- ✅ **Zero external dependencies** (only Python stdlib)
- Uses only: `socket`, `json`, `threading`, `time`, `os`

## Shared Constants Analysis

### Port Default (54000)

**Appears in both files but NOT duplicate:**

1. **launcher.py:** Configuration default
   ```python
   singleton_port_start: int = 54000  # User-facing config default
   ```

2. **singleton_detector.py:** Implementation default
   ```python
   port_start: int = 54000  # Fallback if not specified
   ```

**Reason:** These serve different layers:
- Config layer: What users set
- Implementation layer: What implementation uses

**Data flow:** `LauncherConfig.singleton_port_start` → `SingletonDetector(port_start=...)`

The config value always overrides the implementation default, so there's only one effective source.

### Could we extract to constant?

**No benefit because:**
1. Values are layer-specific defaults
2. launcher.py passes its value to singleton_detector.py
3. No actual duplication - config value always wins
4. Extracting would add unnecessary indirection

## Code Reuse Analysis

### Successfully Reused Code

1. **singleton_detector.py: `_send_message_and_wait_response()`**
   - Extracted from `_try_connect_and_verify()`
   - Now used by: `_try_connect_and_verify()`, `send_shutdown_to_existing()`
   - **Eliminated:** ~25 lines of socket communication duplication

2. **launcher.py: `_create_singleton_detector()`**
   - Extracted from `_singleton_detect()`
   - Used for: initial detection + retry after shutdown
   - **Eliminated:** ~10 lines of instantiation duplication

3. **THREAD_BUS: `set_busy()`, `is_busy()`, `get_busy_reason()`**
   - Reused existing `set_thread_state()` and `get_thread_state()`
   - **No new storage mechanism needed**
   - **Eliminated:** Need for separate busy state tracking

## Responsibility Boundaries

### launcher.py ONLY handles:
1. ✅ Singleton orchestration (when to detect, when to retry)
2. ✅ Service lifecycle management
3. ✅ THREAD_BUS integration

### singleton_detector.py ONLY handles:
1. ✅ Low-level port scanning
2. ✅ Protocol verification
3. ✅ Instance communication

**No overlap** - clean separation of concerns.

## Callback Functions (Not Duplication)

### `on_msg` and `state_checker` in launcher.py

```python
def on_msg(msg):
    if msg.get('type') == 'SHUTDOWN':
        THREAD_BUS.request_shutdown(...)

def state_checker():
    is_busy = THREAD_BUS.is_busy()
    return {'can_shutdown': not is_busy, ...}
```

**Why these are NOT duplication:**
- These are **callbacks** that connect singleton_detector to launcher's environment
- They provide **integration logic** specific to launcher's needs
- singleton_detector is **generic** and doesn't know about THREAD_BUS
- Different applications using singleton_detector would have different callbacks

**Analogy:** Like event handlers in GUI frameworks - they're not duplicate code, they're integration points.

## Metrics

### Before Refactoring
- Duplicate socket code: ~25 lines (in singleton_detector.py)
- Duplicate instantiation: ~10 lines (in launcher.py)
- **Total duplication:** ~35 lines

### After Refactoring
- Duplicate socket code: **0 lines** (extracted to `_send_message_and_wait_response`)
- Duplicate instantiation: **0 lines** (extracted to `_create_singleton_detector`)
- **Total duplication:** **0 lines**

### Code Quality Improvements
1. ✅ DRY principle followed
2. ✅ Single Responsibility maintained
3. ✅ Clean layer separation
4. ✅ Zero external dependencies for singleton_detector
5. ✅ Callback pattern for integration (not duplication)

## Potential Future Optimizations

### None needed currently because:

1. **Port default (54000):**
   - Already correctly separated by layer
   - Config value always overrides implementation
   - No benefit to extracting constant

2. **Message type strings:**
   - Centralized in `MessageType` enum
   - Used via enum, not string literals
   - Already following best practice

3. **Timeout values:**
   - Different contexts need different timeouts
   - Making them configurable is correct
   - No magic numbers in critical paths

## Conclusion

✅ **Zero code duplication** between launcher.py and singleton_detector.py

✅ **Clean architectural separation:**
- launcher.py = orchestration + integration
- singleton_detector.py = pure detection logic

✅ **Proper code reuse:**
- Internal helper methods eliminate duplication
- Existing THREAD_BUS mechanisms reused
- Callback pattern for integration

✅ **No unnecessary abstractions:**
- Every piece of code serves a clear purpose
- No over-engineering
- Follows YAGNI principle

## Summary Table

| Aspect | Status | Notes |
|--------|--------|-------|
| Duplicate code blocks | ✅ None | Extracted to helpers |
| Duplicate logic | ✅ None | Proper separation |
| Shared constants | ⚠️ 54000 | Different layers (OK) |
| Code reuse | ✅ Good | Helper methods used |
| Layer separation | ✅ Clean | No cross-dependencies |
| Dependencies | ✅ Minimal | singleton_detector has zero |
| Maintainability | ✅ High | Clear responsibilities |

**Final verdict:** Code is clean, no duplication issues.
