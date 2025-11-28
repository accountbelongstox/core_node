# pyutils.clipboard - Clipboard Utilities

## Overview

The `clipboard` module provides cross-platform clipboard operations with history tracking, monitoring, and synchronization capabilities.

## Module Location

```
pycore/pyutils/clipboard/
├── __init__.py
├── clipboard_manager.py    # clipboard_manager singleton
├── clipboard_history.py    # ClipboardHistory
├── clipboard_monitor.py    # ClipboardMonitor
└── clipboard_sync.py       # Recognition sync
```

## Core Components

### clipboard_manager

Singleton clipboard manager:

```python
from pycore.pyutils.clipboard import clipboard_manager

# Copy text
clipboard_manager.copy("Hello World")

# Paste text
text = clipboard_manager.paste()
print(text)

# Copy with format
clipboard_manager.copy_html("<b>Bold</b>")

# Get clipboard content
content = clipboard_manager.get_content()

# Clear clipboard
clipboard_manager.clear()

# Check if contains text
has_text = clipboard_manager.has_text()

# Check if contains image
has_image = clipboard_manager.has_image()

# Get image
image = clipboard_manager.get_image()

# Copy image
clipboard_manager.copy_image(image)
```

### ClipboardHistory

Clipboard history tracking:

```python
from pycore.pyutils.clipboard import ClipboardHistory, get_clipboard_history

# Get singleton
history = get_clipboard_history()

# Or create new
history = ClipboardHistory(max_items=100)

# Start tracking
history.start()

# Get history
items = history.get_all()
for item in items:
    print(f"[{item.timestamp}] {item.content[:50]}...")

# Get recent items
recent = history.get_recent(10)

# Search history
matches = history.search("keyword")

# Clear history
history.clear()

# Stop tracking
history.stop()
```

### ClipboardMonitor

Real-time clipboard monitoring:

```python
from pycore.pyutils.clipboard import ClipboardMonitor, get_clipboard_monitor

monitor = get_clipboard_monitor()

# Set callback
def on_clipboard_change(content: str):
    print(f"Clipboard changed: {content}")

monitor.set_callback(on_clipboard_change)

# Start monitoring
monitor.start()

# Check status
is_running = monitor.is_running()

# Stop monitoring
monitor.stop()
```

### Recognition Sync

Sync recognition results to clipboard:

```python
from pycore.pyutils.clipboard import (
    add_recognition_to_clipboard,
    get_recognition_sync_callback
)

# Add recognition result
add_recognition_to_clipboard("Recognized text")

# Get callback for STT/OCR integration
callback = get_recognition_sync_callback()
# Use callback in recognition systems
```

## Usage Examples

### Basic Copy/Paste

```python
from pycore.pyutils.clipboard import clipboard_manager

# Copy
clipboard_manager.copy("Hello from Python!")

# Paste
content = clipboard_manager.paste()
print(content)  # Hello from Python!
```

### History Management

```python
from pycore.pyutils.clipboard import get_clipboard_history

history = get_clipboard_history()
history.start()

# Use clipboard normally
clipboard_manager.copy("Item 1")
clipboard_manager.copy("Item 2")
clipboard_manager.copy("Item 3")

# Get history
for item in history.get_recent(3):
    print(f"{item.timestamp}: {item.content}")

history.stop()
```

### Monitor Changes

```python
from pycore.pyutils.clipboard import get_clipboard_monitor
import time

monitor = get_clipboard_monitor()

def handle_change(content):
    print(f"New clipboard content: {content}")
    # Process content...

monitor.set_callback(handle_change)
monitor.start()

try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    monitor.stop()
```

## Best Practices

1. **Use Singleton**: Use provided singletons for consistency
2. **Stop Monitors**: Always stop monitors on shutdown
3. **Limit History**: Set appropriate max_items
4. **Handle Images**: Check has_image() before get_image()

## Exports

```python
__all__ = [
    'clipboard_manager',
    'ClipboardHistory',
    'get_clipboard_history',
    'ClipboardMonitor',
    'get_clipboard_monitor',
    'add_recognition_to_clipboard',
    'get_recognition_sync_callback'
]
```


