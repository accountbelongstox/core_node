# Speech Switch Architecture Analysis & Redesign

**Date**: 2025-11-17
**Scope**: TTS/STT Provider Architecture Unification
**Objective**: Merge TTSSwitch and STTSwitch into unified SpeechSwitch

---

## 📊 Current Architecture Analysis

### Component Overview

```
┌─────────────────────┐
│ GlobalTaskQueue     │  (Thread-safe priority queue)
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│ HeartbeatPusher     │  (Polls queue every 1 second)
└──────────┬──────────┘
           │
           ├───────────────────┐
           ↓                   ↓
    ┌─────────────┐     ┌─────────────┐
    │ TTSSwitch   │     │ STTSwitch   │
    └──────┬──────┘     └──────┬──────┘
           │                   │
    Internal Queue      Internal Queue
           │                   │
    Worker Thread       Worker Thread
           │                   │
           ↓                   ↓
    ┌──────────────┐    ┌──────────────┐
    │ TTS Provider │    │ STT Provider │
    │  - Edge TTS  │    │  - Azure STT │
    │  - Azure TTS │    │  - Local STT │
    └──────────────┘    └──────────────┘
```

---

## 🔍 Current Implementation Details

### 1. TTSSwitch (`pycore/pyutils/common/tts_switch.py`)

**Responsibilities**:
- Routes TTS tasks to available providers
- Maintains internal task queue (max 50)
- Runs dedicated worker thread
- Checks provider availability on init
- Registers with GlobalThreadPool

**Structure**:
```python
class TTSSwitch:
    def __init__(self, max_queue_size=50):
        self.task_queue = queue.Queue(maxsize=50)
        self._worker_thread = None
        self._edge_available = False
        self._azure_available = False

    def initialize(self):
        self._check_edge_tts()
        self._check_azure_tts()
        self._start_worker()

    def register_with_heartbeat(self):
        thread_pool.register_thread(
            name='tts_switch',
            task_handlers={
                'tts': self.accept_task,
                'audio_synthesis': self.accept_task,
                'text_to_speech': self.accept_task
            }
        )

    def accept_task(self, task: Task) -> bool:
        # Called by HeartbeatPusher
        self.task_queue.put(task)
        return True

    def _worker_loop(self):
        while running:
            task = self.task_queue.get()
            self._process_task(task)

    def _process_task(self, task):
        # Route to edge_tts or azure_tts
        pass
```

**Issues**:
- ❌ Duplicates queue management
- ❌ Duplicates worker thread pattern
- ❌ Provider status not centralized
- ❌ No status updates to common module

---

### 2. STTSwitch (`pycore/pyutils/common/stt_switch.py`)

**Responsibilities**:
- Routes STT tasks to available providers
- Maintains internal task queue (max 50)
- Runs dedicated worker thread
- Checks provider availability on init
- Registers with GlobalThreadPool

**Structure**:
```python
class STTSwitch:
    def __init__(self, max_queue_size=50):
        self.task_queue = queue.Queue(maxsize=50)
        self._worker_thread = None
        self._azure_available = False
        self._local_available = False

    def initialize(self):
        self._check_providers()
        self._start_worker()

    def accept_task(self, task: Task) -> bool:
        # Called by HeartbeatPusher
        self.task_queue.put(task)
        return True

    def _worker_loop(self):
        while running:
            task = self.task_queue.get()
            self._process_task(task)

    def _process_task(self, task):
        # Route to azure_stt or local_stt
        pass
```

**Issues**:
- ❌ Almost identical to TTSSwitch
- ❌ Code duplication (~80% similar)
- ❌ Separate worker thread for similar task
- ❌ Independent provider checking

---

### 3. HeartbeatPusher (`pycore/pyheartbeat/heartbeat_pusher.py`)

**Current Flow**:
```python
def _tick(self):
    task = global_task_queue.get()

    # Get registered handlers for task_type
    handlers = thread_pool.get_handlers_for_task_type(task.task_type)

    for thread_info, handler_fn in handlers:
        accepted = handler_fn(task)  # Calls TTSSwitch.accept_task or STTSwitch.accept_task
        if accepted:
            return
```

**Observations**:
- ✅ Simple polling mechanism
- ✅ Routes tasks to registered handlers
- ✅ Handles multiple handlers per task_type
- ⚠️  Currently routes to Switch, which then queues internally (extra layer)

---

### 4. Providers (edge_tts, speech_recognition)

**Current State**:
- ✅ Already pure processing units
- ✅ No internal task queues
- ✅ Called synchronously by Switch
- ✅ Return results directly

**Example**:
```python
# Edge TTS Provider (simplified)
async def communicate(text, voice):
    # Generate TTS audio
    return audio_data

# Speech Recognition Provider (simplified)
def recognize(audio_file, language):
    # Recognize speech
    return text
```

**Status**: ✅ No changes needed (already follows desired pattern)

---

## 🚨 Problems with Current Architecture

### Problem 1: Unnecessary Queue Duplication

**Current Flow**:
```
GlobalTaskQueue → HeartbeatPusher → TTSSwitch.accept_task
                                          ↓
                                   TTSSwitch.task_queue  ← EXTRA QUEUE
                                          ↓
                                   Worker Thread
                                          ↓
                                   Provider
```

**Issue**: Two levels of queuing
- GlobalTaskQueue already handles queuing
- Switch internal queue adds unnecessary layer
- Extra latency and complexity

**Why it exists**:
- Allows Switch to control its own backlog
- Provides isolation between HeartbeatPusher and Provider

**Better approach**:
- HeartbeatPusher directly calls Switch processing
- Switch processes synchronously (or async if needed)
- No intermediate queuing

---

### Problem 2: Code Duplication

**Similarity Matrix**:
| Component | TTSSwitch | STTSwitch | Similarity |
|-----------|-----------|-----------|------------|
| Queue management | ✓ | ✓ | 100% |
| Worker thread | ✓ | ✓ | 95% |
| accept_task | ✓ | ✓ | 100% |
| Provider checking | ✓ | ✓ | 80% |
| Registration | ✓ | ✓ | 90% |

**Total duplicate code**: ~400+ lines

---

### Problem 3: No Centralized Status Management

**Current**:
- TTSSwitch._edge_available
- TTSSwitch._azure_available
- STTSwitch._azure_available
- STTSwitch._local_available

**Issues**:
- ❌ Status scattered across two classes
- ❌ No single source of truth
- ❌ Other modules can't query status
- ❌ No status change notifications
- ❌ Can't update status from providers (if they fail at runtime)

**Need**:
```python
# In pycore/pyutils/common/provider_status.py
class ProviderStatus:
    def get_tts_status(self):
        return {
            'edge': available,
            'azure': available
        }

    def get_stt_status(self):
        return {
            'azure': available,
            'local': available
        }

    def update_status(self, provider, available):
        # Update and notify listeners
        pass
```

---

### Problem 4: No Runtime Status Updates

**Scenario**:
1. App starts → Azure TTS available ✓
2. User exhausts quota during runtime
3. Azure fails with 1007 error
4. **Switch still thinks Azure is available**
5. Continues routing to Azure
6. All tasks fail

**Current**: Only check on initialization
**Need**: Update status when provider fails

---

## 💡 Proposed Architecture

### New Unified Design

```
┌─────────────────────┐
│ GlobalTaskQueue     │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│ HeartbeatPusher     │  (Routes by task_type)
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│ SpeechSwitch        │  (Unified TTS/STT Router)
│                     │
│ ┌─────────────────┐ │
│ │ ProviderStatus  │ │  ← Status management
│ └─────────────────┘ │
│                     │
│ ┌─────────────────┐ │
│ │ Route to        │ │
│ │ Provider        │ │  ← Direct call (no queue)
│ └─────────────────┘ │
└──────────┬──────────┘
           │
           ├─────────────────┬─────────────────┐
           ↓                 ↓                 ↓
    ┌───────────┐     ┌───────────┐     ┌───────────┐
    │ Edge TTS  │     │ Azure STT │     │ Local STT │
    └───────────┘     └───────────┘     └───────────┘
         Pure              Pure              Pure
       Processor         Processor         Processor
```

---

## 🔧 New Architecture Components

### 1. Unified SpeechSwitch

**Location**: `pycore/pyutils/common/speech_switch.py`

**Design**:
```python
class SpeechSwitch:
    """
    Unified Speech Router (TTS + STT)

    No internal queue - processes tasks synchronously when called by HeartbeatPusher.
    Routes based on task_type and provider availability.
    """

    def __init__(self):
        # NO internal queue
        # NO worker thread
        self._provider_status = ProviderStatus()
        self._tts_providers = {}
        self._stt_providers = {}

    def initialize(self):
        """Initialize providers and check availability"""
        self._init_tts_providers()
        self._init_stt_providers()
        self._provider_status.update_all()

    def register_with_heartbeat(self):
        """Register task handlers with GlobalThreadPool"""
        thread_pool.register_thread(
            name='speech_switch',
            instance=None,  # No dedicated thread
            task_handlers={
                # TTS task types
                'tts': self.process_task,
                'audio_synthesis': self.process_task,
                'text_to_speech': self.process_task,
                # STT task types
                'stt': self.process_task,
                'speech_recognition': self.process_task,
                'speech_to_text': self.process_task
            }
        )

    def process_task(self, task: Task) -> bool:
        """
        Process task synchronously (called by HeartbeatPusher)

        No queuing - execute immediately in HeartbeatPusher thread.
        If processing is slow, provider should return quickly and use callback.
        """
        if task.task_type in ['tts', 'audio_synthesis', 'text_to_speech']:
            return self._process_tts_task(task)
        elif task.task_type in ['stt', 'speech_recognition', 'speech_to_text']:
            return self._process_stt_task(task)
        return False

    def _process_tts_task(self, task: Task) -> bool:
        """Route TTS task to available provider"""
        status = self._provider_status.get_tts_status()

        # Try Edge TTS first (free)
        if status['edge']:
            try:
                result = self._call_edge_tts(task.task_data)
                task.mark_completed(result)
                return True
            except Exception as e:
                # Update status if provider failed
                self._provider_status.mark_unavailable('edge_tts', str(e))

        # Fallback to Azure
        if status['azure']:
            try:
                result = self._call_azure_tts(task.task_data)
                task.mark_completed(result)
                return True
            except Exception as e:
                self._provider_status.mark_unavailable('azure_tts', str(e))

        # No providers available
        task.mark_failed("No TTS providers available")
        return False

    def _process_stt_task(self, task: Task) -> bool:
        """Route STT task to available provider"""
        status = self._provider_status.get_stt_status()

        # Try Azure first (better quality)
        if status['azure']:
            try:
                result = self._call_azure_stt(task.task_data)
                task.mark_completed(result)
                return True
            except Exception as e:
                self._provider_status.mark_unavailable('azure_stt', str(e))

        # Fallback to local
        if status['local']:
            try:
                result = self._call_local_stt(task.task_data)
                task.mark_completed(result)
                return True
            except Exception as e:
                self._provider_status.mark_unavailable('local_stt', str(e))

        task.mark_failed("No STT providers available")
        return False
```

**Key Differences**:
- ✅ No internal queue
- ✅ No worker thread
- ✅ Synchronous processing in HeartbeatPusher context
- ✅ Uses centralized ProviderStatus
- ✅ Runtime status updates on failure

---

### 2. ProviderStatus (Centralized)

**Location**: `pycore/pyutils/common/provider_status.py`

**Design**:
```python
class ProviderStatus:
    """
    Centralized provider status management

    Tracks availability of all speech providers (TTS/STT).
    Can be queried by any module.
    Updates when providers fail at runtime.
    """

    def __init__(self):
        self._status = {
            'tts': {
                'edge': {'available': False, 'error': None, 'last_check': None},
                'azure': {'available': False, 'error': None, 'last_check': None}
            },
            'stt': {
                'azure': {'available': False, 'error': None, 'last_check': None},
                'local': {'available': False, 'error': None, 'last_check': None}
            }
        }
        self._lock = threading.Lock()
        self._listeners = []

    def check_tts_providers(self):
        """Check all TTS providers"""
        with self._lock:
            # Check Edge TTS
            try:
                edge_tts = get_third_package_edge_tts()
                self._status['tts']['edge']['available'] = edge_tts is not None
                self._status['tts']['edge']['last_check'] = time.time()
            except Exception as e:
                self._status['tts']['edge']['available'] = False
                self._status['tts']['edge']['error'] = str(e)

            # Check Azure TTS
            try:
                from pycore.pyutils.azure_speech import get_azure_speech_client
                client = get_azure_speech_client()
                self._status['tts']['azure']['available'] = client.initialize()
                self._status['tts']['azure']['last_check'] = time.time()
            except Exception as e:
                self._status['tts']['azure']['available'] = False
                self._status['tts']['azure']['error'] = str(e)

    def check_stt_providers(self):
        """Check all STT providers"""
        with self._lock:
            # Check Azure STT
            try:
                from pycore.pyfoundations.third_party import get_third_package_speechsdk
                speechsdk = get_third_package_speechsdk()
                self._status['stt']['azure']['available'] = speechsdk is not None
                self._status['stt']['azure']['last_check'] = time.time()
            except Exception as e:
                self._status['stt']['azure']['available'] = False
                self._status['stt']['azure']['error'] = str(e)

            # Check Local STT
            try:
                from pycore.pyutils.speech_recognition import SpeechRecognizer
                self._status['stt']['local']['available'] = True
                self._status['stt']['local']['last_check'] = time.time()
            except Exception as e:
                self._status['stt']['local']['available'] = False
                self._status['stt']['local']['error'] = str(e)

    def get_tts_status(self) -> Dict[str, bool]:
        """Get TTS provider availability"""
        with self._lock:
            return {
                'edge': self._status['tts']['edge']['available'],
                'azure': self._status['tts']['azure']['available']
            }

    def get_stt_status(self) -> Dict[str, bool]:
        """Get STT provider availability"""
        with self._lock:
            return {
                'azure': self._status['stt']['azure']['available'],
                'local': self._status['stt']['local']['available']
            }

    def mark_unavailable(self, provider_name: str, error: str):
        """
        Mark provider as unavailable (called when provider fails)

        Args:
            provider_name: 'edge_tts', 'azure_tts', 'azure_stt', 'local_stt'
            error: Error message
        """
        with self._lock:
            if provider_name == 'edge_tts':
                self._status['tts']['edge']['available'] = False
                self._status['tts']['edge']['error'] = error
            elif provider_name == 'azure_tts':
                self._status['tts']['azure']['available'] = False
                self._status['tts']['azure']['error'] = error
            elif provider_name == 'azure_stt':
                self._status['stt']['azure']['available'] = False
                self._status['stt']['azure']['error'] = error
            elif provider_name == 'local_stt':
                self._status['stt']['local']['available'] = False
                self._status['stt']['local']['error'] = error

            # Notify listeners
            self._notify_listeners(provider_name, False, error)

    def mark_available(self, provider_name: str):
        """Mark provider as available again"""
        with self._lock:
            # Update status...
            self._notify_listeners(provider_name, True, None)

    def add_listener(self, callback):
        """Add status change listener"""
        self._listeners.append(callback)

    def _notify_listeners(self, provider_name: str, available: bool, error: Optional[str]):
        """Notify listeners of status change"""
        for listener in self._listeners:
            try:
                listener(provider_name, available, error)
            except Exception:
                pass

    def get_full_status(self) -> Dict:
        """Get full status for all providers"""
        with self._lock:
            return {
                'tts': {
                    'edge': self._status['tts']['edge'],
                    'azure': self._status['tts']['azure']
                },
                'stt': {
                    'azure': self._status['stt']['azure'],
                    'local': self._status['stt']['local']
                }
            }


# Global singleton
_provider_status = None

def get_provider_status() -> ProviderStatus:
    """Get global provider status instance"""
    global _provider_status
    if _provider_status is None:
        _provider_status = ProviderStatus()
    return _provider_status
```

---

## 📋 Migration Plan

### Phase 1: Create ProviderStatus (Week 1)
1. Create `pycore/pyutils/common/provider_status.py`
2. Implement status checking logic
3. Test provider detection
4. Add status change listeners

### Phase 2: Create Unified SpeechSwitch (Week 1-2)
1. Create `pycore/pyutils/common/speech_switch.py`
2. Implement TTS routing logic
3. Implement STT routing logic
4. Integrate with ProviderStatus
5. Register with HeartbeatPusher

### Phase 3: Update Dependencies (Week 2)
1. Update imports in `pycore/pyutils/common/__init__.py`
2. Update launcher to use new SpeechSwitch
3. Update tests

### Phase 4: Deprecate Old Switches (Week 2)
1. Rename `tts_switch.py` → `tts_switch_OLD.py`
2. Rename `stt_switch.py` → `stt_switch_OLD.py`
3. Add deprecation warnings
4. Remove after 1 release cycle

---

## ✅ Benefits of New Architecture

| Aspect | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Code Lines** | ~800 lines | ~400 lines | 50% reduction |
| **Queues** | 3 (Global + 2 internal) | 1 (Global only) | 66% reduction |
| **Worker Threads** | 2 | 0 | No dedicated threads |
| **Provider Checks** | 2 locations | 1 centralized | Single source |
| **Status Updates** | Init only | Runtime updates | Dynamic |
| **Code Duplication** | ~80% | 0% | Eliminated |
| **Latency** | 2-3 queue hops | Direct call | Faster |
| **Maintainability** | 2 files to sync | 1 unified file | Easier |

---

## 🎯 Summary

**Current Issues**:
1. ❌ Two separate switches with 80% duplicate code
2. ❌ Unnecessary internal queuing layer
3. ❌ No centralized provider status management
4. ❌ No runtime status updates
5. ❌ Complexity: 3 queue levels

**New Solution**:
1. ✅ Single unified SpeechSwitch
2. ✅ Direct processing (no internal queue)
3. ✅ Centralized ProviderStatus in common
4. ✅ Runtime status updates on failure
5. ✅ Simplicity: 1 queue level

**Next Steps**:
1. Review and approve architecture
2. Implement ProviderStatus
3. Implement SpeechSwitch
4. Migrate and deprecate old code

---

**Recommendation**: Proceed with unified architecture to reduce complexity and improve maintainability.
