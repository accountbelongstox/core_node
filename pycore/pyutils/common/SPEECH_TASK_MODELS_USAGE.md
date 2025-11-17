# Speech Task Models Usage Guide

## Overview

Unified data models for speech operations (TTS/STT) that integrate with PyHeartbeat GlobalTaskQueue system.

**Location**: `pycore/pyutils/common/speech_task_models.py`

---

## Quick Start

### Import

```python
from pycore.pyutils.common import (
    TTSTaskData, TTSTaskResult,
    STTTaskData, STTTaskResult,
    create_tts_task, create_stt_task
)
```

### TTS Example

```python
from pycore.pyutils.common import TTSTaskData, create_tts_task
from pycore.pyfoundations import TaskPriority, get_global_task_queue

# Create task data
task_data = TTSTaskData(
    text="Hello, World!",
    language="en-US",
    provider="edge",
    enable_cache=True
)

# Create task (method 1: using helper function)
task = create_tts_task(task_data, priority=TaskPriority.NORMAL)

# Submit to global queue
task_queue = get_global_task_queue()
task_queue.put(task)

# OR create task manually (method 2)
from pycore.pyfoundations import Task

task = Task(
    task_type='tts',
    task_data=task_data.to_dict(),
    priority=TaskPriority.NORMAL
)
task_queue.put(task)
```

### STT Example

```python
from pycore.pyutils.common import STTTaskData, create_stt_task
from pycore.pyfoundations import TaskPriority, get_global_task_queue

# Create task data
task_data = STTTaskData(
    audio_file="/path/to/audio.wav",
    language="zh-CN",
    provider="auto"
)

# Create and submit task
task = create_stt_task(task_data, priority=TaskPriority.HIGH)
get_global_task_queue().put(task)
```

---

## Task Data Models

### TTSTaskData

**Purpose**: Standardized input for Text-to-Speech tasks

**Fields**:
```python
@dataclass
class TTSTaskData:
    text: str                      # Required: Text to synthesize
    language: str = "zh-CN"        # Language code
    voice: Optional[str] = None    # Voice name (auto-selected if None)
    provider: str = "edge"         # TTS provider (edge/azure/auto)
    return_base64: bool = False    # Return audio as base64
    enable_cache: bool = True      # Use cache if available
    request_id: Optional[str] = None
    client_id: Optional[str] = None
```

**Methods**:
- `to_dict()` - Convert to dictionary
- `from_dict(data)` - Create from dictionary

**Example**:
```python
# Create with all parameters
task_data = TTSTaskData(
    text="你好，世界",
    language="zh-CN",
    voice="zh-CN-XiaoxiaoNeural",
    provider="edge",
    return_base64=False,
    enable_cache=True,
    request_id="req-123",
    client_id="web-client"
)

# Convert to dict
data_dict = task_data.to_dict()
print(data_dict)
# {'text': '你好，世界', 'language': 'zh-CN', ...}

# Create from dict
task_data2 = TTSTaskData.from_dict(data_dict)
```

### STTTaskData

**Purpose**: Standardized input for Speech-to-Text tasks

**Fields**:
```python
@dataclass
class STTTaskData:
    audio_file: Optional[str] = None      # Path to audio file
    audio_base64: Optional[str] = None    # Or base64 encoded audio
    language: str = "zh-CN"               # Language code
    provider: str = "auto"                # STT provider (azure/local/auto)
    request_id: Optional[str] = None
    client_id: Optional[str] = None
```

**Example**:
```python
# Using file path
task_data = STTTaskData(
    audio_file="/tmp/audio.wav",
    language="en-US",
    provider="azure"
)

# Using base64 (for web uploads)
task_data = STTTaskData(
    audio_base64="UklGRiQAA...",
    language="zh-CN",
    provider="local"
)
```

### TTSTaskResult

**Purpose**: Standardized output from TTS tasks

**Fields**:
```python
@dataclass
class TTSTaskResult:
    success: bool                         # Task success status
    audio_file: Optional[str] = None      # Path to generated audio
    audio_base64: Optional[str] = None    # Or base64 audio data
    audio_url: Optional[str] = None       # Or URL to audio
    language: Optional[str] = None        # Used language
    provider: Optional[str] = None        # Used provider
    voice: Optional[str] = None           # Used voice
    cached: bool = False                  # Was result from cache
    duration: Optional[float] = None      # Audio duration (seconds)
    file_size: Optional[int] = None       # File size (bytes)
    error: Optional[str] = None           # Error message if failed
```

**Example**:
```python
# Create result (usually done by TTS provider)
result = TTSTaskResult(
    success=True,
    audio_file="/tmp/output.mp3",
    language="zh-CN",
    provider="edge",
    voice="zh-CN-XiaoxiaoNeural",
    cached=False,
    duration=2.5,
    file_size=48000
)

# Convert to dict for storage in task.metadata
task.metadata['result'] = result.to_dict()
```

### STTTaskResult

**Purpose**: Standardized output from STT tasks

**Fields**:
```python
@dataclass
class STTTaskResult:
    success: bool                         # Task success status
    text: Optional[str] = None            # Recognized text
    language: Optional[str] = None        # Used language
    provider: Optional[str] = None        # Used provider
    confidence: float = 0.0               # Recognition confidence (0-1)
    duration: Optional[float] = None      # Processing duration
    segments: Optional[list] = None       # Segmented results
    error: Optional[str] = None           # Error message if failed
```

---

## Integration with PyHeartbeat

### Architecture Flow

```
Web/CLI → RPC → GlobalTaskQueue → HeartbeatPusher → TTSSwitch/STTSwitch → Provider
                                                                                ↓
                                                                         Process task
                                                                                ↓
                                                                     Store result in task.metadata
```

### TTS Task Processing

```python
# In tts_switch.py
def _process_task(self, task: Task):
    """Process TTS task"""
    from pycore.pyutils.common import TTSTaskData, TTSTaskResult

    # Parse task data
    task_data = TTSTaskData.from_dict(task.task_data)

    # Route to provider
    try:
        audio_file = self._synthesize(task_data)

        # Create result
        result = TTSTaskResult(
            success=True,
            audio_file=audio_file,
            language=task_data.language,
            provider=task_data.provider,
            cached=False
        )

        # Store in task metadata
        task.metadata['result'] = result.to_dict()
        task.mark_completed()

    except Exception as e:
        result = TTSTaskResult(success=False, error=str(e))
        task.metadata['result'] = result.to_dict()
        task.mark_failed(str(e))

    # Call callback
    if task.callback:
        task.callback(task)
```

### RPC Handler Integration

```python
# In rpc_service.py
def _handle_tts(self, params: Dict, request_id: str, context: Dict):
    """Handle TTS request"""
    from pycore.pyutils.common import TTSTaskData, create_tts_task

    # Create task data from params
    task_data = TTSTaskData(
        text=params.get('text'),
        language=params.get('language', 'zh-CN'),
        voice=params.get('voice'),
        provider=params.get('provider', 'edge'),
        request_id=request_id,
        client_id=context.get('client_id')
    )

    # Create task
    priority = self._parse_priority(params.get('priority', 'normal'))
    task = create_tts_task(task_data, priority=priority)

    # Submit to queue
    self.task_queue.put(task)

    return {
        'success': True,
        'task_id': task.task_id,
        'status': 'accepted'
    }
```

---

## Advanced Usage

### Custom Priority

```python
from pycore.pyfoundations import TaskPriority

# High priority TTS
task_data = TTSTaskData(text="Urgent message", language="en-US")
task = create_tts_task(task_data, priority=TaskPriority.HIGH)

# Low priority STT
task_data = STTTaskData(audio_file="/tmp/background_audio.wav")
task = create_stt_task(task_data, priority=TaskPriority.LOW)
```

### With Callbacks

```python
from pycore.pyfoundations import Task

def on_tts_complete(task: Task):
    """Called when TTS task completes"""
    result = task.metadata.get('result', {})
    if result.get('success'):
        audio_file = result.get('audio_file')
        print(f"TTS completed: {audio_file}")
    else:
        print(f"TTS failed: {result.get('error')}")

def on_tts_error(task: Task):
    """Called when TTS task fails"""
    print(f"TTS error: {task.error}")

# Create task with callbacks
task_data = TTSTaskData(text="Test", language="en-US")
task = create_tts_task(task_data)
task.callback = on_tts_complete
task.error_callback = on_tts_error

get_global_task_queue().put(task)
```

### Batch Processing

```python
from pycore.pyutils.common import TTSTaskData, create_tts_task
from pycore.pyfoundations import get_global_task_queue

# Batch TTS tasks
texts = ["Text 1", "Text 2", "Text 3"]
task_queue = get_global_task_queue()

for text in texts:
    task_data = TTSTaskData(text=text, language="zh-CN")
    task = create_tts_task(task_data)
    task_queue.put(task)
```

---

## Type Safety Benefits

### Before (Dictionary):
```python
# Easy to make mistakes
task_data = {
    'txt': 'Hello',      # Typo: should be 'text'
    'lang': 'en-US'      # Typo: should be 'language'
}
```

### After (Dataclass):
```python
# Type-safe, autocomplete support
task_data = TTSTaskData(
    text='Hello',        # ✓ Correct field name
    language='en-US'     # ✓ Correct field name
)
# IDE will show errors if you use wrong field names
```

---

## Best Practices

1. **Always use task data models** - Don't create raw dictionaries
2. **Use helper functions** - `create_tts_task()`, `create_stt_task()`
3. **Set appropriate priorities** - HIGH for urgent, NORMAL for regular, LOW for background
4. **Handle results properly** - Check `success` field before using result data
5. **Use callbacks for async operations** - Don't block waiting for results
6. **Enable caching** - Set `enable_cache=True` for TTS tasks to avoid redundant synthesis

---

## Migration from Old Code

### Before

```python
# Old dictionary-based approach
task = Task(
    task_type='tts',
    task_data={
        'text': 'Hello',
        'language': 'en-US',
        'voice': None,  # Easy to forget fields
        'provider': 'edge'
    }
)
```

### After

```python
# New dataclass-based approach
from pycore.pyutils.common import TTSTaskData, create_tts_task

task_data = TTSTaskData(text='Hello', language='en-US')
task = create_tts_task(task_data)  # Cleaner, type-safe
```

---

## Troubleshooting

### Import Error

If you get:
```
ImportError: cannot import name 'TTSTaskData'
```

Solution:
```python
# Make sure you import from the correct path
from pycore.pyutils.common import TTSTaskData  # ✓ Correct

# NOT from:
from pycore.pyutils.common.speech_task_models import TTSTaskData  # Also works
```

### Dataclass Error

If you get errors about dataclass fields:
```python
# Make sure all required fields are provided
task_data = TTSTaskData()  # ✗ Error: missing required argument 'text'

task_data = TTSTaskData(text="Hello")  # ✓ Correct
```

---

## API Reference

### Helper Functions

#### `create_tts_task(data, priority=None)`
Create TTS task for GlobalTaskQueue

**Args**:
- `data` (TTSTaskData): Task data
- `priority` (TaskPriority, optional): Task priority (default: NORMAL)

**Returns**: Task instance

**Example**:
```python
task = create_tts_task(
    TTSTaskData(text="Hello"),
    priority=TaskPriority.HIGH
)
```

#### `create_stt_task(data, priority=None)`
Create STT task for GlobalTaskQueue

**Args**:
- `data` (STTTaskData): Task data
- `priority` (TaskPriority, optional): Task priority (default: NORMAL)

**Returns**: Task instance

**Example**:
```python
task = create_stt_task(
    STTTaskData(audio_file="/tmp/audio.wav"),
    priority=TaskPriority.NORMAL
)
```

---

**Version**: 1.0.0
**Last Updated**: 2025-11-17
**Dependencies**: `pycore.pyfoundations`
