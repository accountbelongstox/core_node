# pyctl.speech - Speech Management

## Overview

The `pyctl.speech` module provides unified speech management combining TTS, STT, RPC endpoints, and AI features. It orchestrates multiple pyutils modules for a complete speech solution.

## Module Location

```
pycore/pyctl/speech/
├── __init__.py
├── speech_manager.py       # SpeechManager
├── rpc/                    # RPC endpoints
│   ├── __init__.py
│   ├── tts_routes.py
│   └── stt_routes.py
└── ai/                     # AI features
    ├── __init__.py
    ├── chat.py
    ├── parse.py
    └── translate.py
```

## Core Components

### SpeechManager

Central speech manager:

```python
from pycore.pyctl.speech import get_speech_manager

# Get singleton
speech = get_speech_manager()

# Initialize
speech.initialize()

# TTS - Speak text
speech.speak("Hello, world!")

# TTS - Speak with options
speech.speak(
    text="Important message",
    voice="en-US-JennyNeural",
    rate="+10%",
    volume="+20%"
)

# TTS - Queue multiple
speech.queue_speak([
    "First sentence.",
    "Second sentence.",
    "Third sentence."
])

# STT - Listen for speech
result = await speech.listen()
print(f"Heard: {result.text}")

# STT - Continuous listening
speech.start_listening(
    on_recognized=lambda text: print(f"Heard: {text}")
)
speech.stop_listening()

# Translation
translated = await speech.translate("Hello", dest="ko")

# Stop all
speech.stop()
```

### RPC Manager

RPC endpoints for speech services:

```python
from pycore.pyctl.speech.rpc import get_rpc_manager

rpc = get_rpc_manager(auto_start=True)

# RPC routes are automatically registered:
# - /tts/speak
# - /tts/queue
# - /tts/stop
# - /stt/listen
# - /stt/start_continuous
# - /stt/stop_continuous
# - /translate

# Get RPC server
server = rpc.server

# Add custom route
@server.route("custom_speech")
def custom_handler(data):
    return {"status": "ok"}
```

### Speech AI

AI-powered features:

```python
from pycore.pyctl.speech.ai import (
    chat_with_speech,
    parse_command,
    expand_text,
    translate_speech
)

# Chat with speech output
response = await chat_with_speech(
    "What is the weather today?",
    speak_response=True
)

# Parse voice command
command = parse_command("Turn on the lights in the living room")
# Returns: {"action": "turn_on", "device": "lights", "location": "living_room"}

# Expand abbreviation
expanded = expand_text("btw")  # "by the way"

# Translate and speak
await translate_speech(
    "Hello, how are you?",
    source="en",
    target="ko",
    speak=True
)
```

## Usage Examples

### Basic TTS

```python
from pycore.pyctl.speech import get_speech_manager

speech = get_speech_manager()
speech.initialize()

# Simple speak
speech.speak("Hello, this is a test message.")

# With voice selection
speech.speak(
    text="Important announcement",
    voice="en-US-GuyNeural"
)

# Queue multiple messages
speech.queue_speak([
    "Welcome to the system.",
    "Please wait while we process your request.",
    "Thank you for your patience."
])
```

### Basic STT

```python
from pycore.pyctl.speech import get_speech_manager
import asyncio

async def main():
    speech = get_speech_manager()
    speech.initialize()
    
    print("Speak now...")
    result = await speech.listen()
    
    print(f"You said: {result.text}")
    print(f"Confidence: {result.confidence}")

asyncio.run(main())
```

### Continuous Listening

```python
from pycore.pyctl.speech import get_speech_manager
import time

speech = get_speech_manager()
speech.initialize()

def on_speech(text):
    print(f"Heard: {text}")
    
    # Respond with TTS
    if "hello" in text.lower():
        speech.speak("Hello! How can I help you?")
    elif "goodbye" in text.lower():
        speech.speak("Goodbye!")
        speech.stop_listening()

speech.start_listening(on_recognized=on_speech)

# Keep running
try:
    while speech.is_listening():
        time.sleep(1)
except KeyboardInterrupt:
    speech.stop_listening()
```

### Voice Assistant

```python
from pycore.pyctl.speech import get_speech_manager
from pycore.pyctl.speech.ai import chat_with_speech

speech = get_speech_manager()
speech.initialize()

async def voice_assistant():
    speech.speak("Hello! I'm your voice assistant. How can I help?")
    
    while True:
        result = await speech.listen()
        
        if "exit" in result.text.lower():
            speech.speak("Goodbye!")
            break
        
        response = await chat_with_speech(
            result.text,
            speak_response=True
        )

asyncio.run(voice_assistant())
```

### RPC Integration

```python
from pycore.pyctl.speech.rpc import get_rpc_manager

# Start RPC server with speech endpoints
rpc = get_rpc_manager(auto_start=True)

print("Speech RPC server running...")
print("Available endpoints:")
print("  - POST /tts/speak {text, voice, rate}")
print("  - POST /tts/queue {texts}")
print("  - POST /tts/stop")
print("  - POST /stt/listen")
print("  - POST /translate {text, dest}")

# Server runs until stopped
```

## Configuration

```python
from pycore.pyctl.speech import SpeechConfig

config = SpeechConfig(
    # TTS settings
    tts_engine="edge_tts",      # edge_tts, azure
    default_voice="en-US-JennyNeural",
    default_rate="+0%",
    default_volume="+0%",
    
    # STT settings
    stt_engine="whisper",       # whisper, azure
    stt_model="base",
    stt_language="en",
    
    # RPC settings
    rpc_port=58100,
    enable_rpc=True,
    
    # AI settings
    enable_ai=True,
    ai_model="gpt-4"
)

speech = get_speech_manager(config=config)
```

## Best Practices

1. **Initialize Once**: Call initialize() at startup
2. **Use Queue**: For multiple messages, use queue_speak()
3. **Handle Errors**: Wrap listen() in try-except
4. **Stop Properly**: Always call stop() on shutdown
5. **Choose Engine**: Select appropriate TTS/STT engine

## Related Modules

- `pycore.pyutils.edge_tts` - Edge TTS
- `pycore.pyutils.azure_speech` - Azure Speech
- `pycore.pyutils.whisper_stt` - Whisper STT
- `pycore.pyutils.translator` - Translation

## Exports

```python
__all__ = [
    'SpeechManager',
    'get_speech_manager',
    'SpeechConfig',
]
```















