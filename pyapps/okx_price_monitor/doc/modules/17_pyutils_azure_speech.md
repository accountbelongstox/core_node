# pyutils.azure_speech - Azure Speech Services

## Overview

The `azure_speech` module provides integration with Microsoft Azure Speech Services for speech recognition (STT). It supports real-time and batch transcription with high accuracy.

## Module Location

```
pycore/pyutils/azure_speech/
├── __init__.py
├── azure_speech_client.py    # AzureSpeechClient
├── speech_recognizer.py      # SpeechRecognizer
├── stt_provider.py           # AzureSpeechRecognitionProvider
├── stt_base_provider.py      # BaseSpeechRecognitionProvider
├── config.py                 # AzureSpeechConfig
└── quota_state.py            # Quota management
```

## Core Components

### AzureSpeechClient

Main Azure Speech client:

```python
from pycore.pyutils.azure_speech import (
    AzureSpeechClient,
    get_azure_speech_client
)

# Get singleton
client = get_azure_speech_client()

# Or create new
client = AzureSpeechClient(
    subscription_key="your_key",
    region="eastus"
)

# Recognize from file
result = await client.recognize_from_file("audio.wav")
print(f"Text: {result.text}")

# Recognize from microphone
result = await client.recognize_from_microphone()
print(f"Heard: {result.text}")

# Continuous recognition
async for result in client.recognize_continuous():
    print(f"[{result.offset}] {result.text}")
```

### SpeechRecognizer

High-level recognizer:

```python
from pycore.pyutils.azure_speech import (
    SpeechRecognizer,
    get_speech_recognizer,
    speech_recognizer
)

# Get singleton
recognizer = speech_recognizer

# Initialize
recognizer.initialize()

# Recognize speech
result = await recognizer.recognize()
print(f"Recognition: {result.text}")
print(f"Confidence: {result.confidence}")

# With language
result = await recognizer.recognize(language="en-US")

# Continuous
recognizer.start_continuous(
    on_recognized=lambda r: print(f"Text: {r.text}"),
    on_error=lambda e: print(f"Error: {e}")
)

# Stop
recognizer.stop_continuous()
```

### AzureSpeechConfig

Configuration:

```python
from pycore.pyutils.azure_speech import AzureSpeechConfig

config = AzureSpeechConfig(
    subscription_key="your_key",
    region="eastus",
    language="en-US",
    output_format="detailed",
    profanity="masked",
    enable_dictation=True
)
```

### AzureSpeechRecognitionProvider

Provider interface:

```python
from pycore.pyutils.azure_speech import AzureSpeechRecognitionProvider

provider = AzureSpeechRecognitionProvider(config)

# From file
result = await provider.recognize_from_file("audio.wav")

# From microphone
result = await provider.recognize_from_microphone()

# From stream
result = await provider.recognize_from_stream(audio_stream)
```

## Usage Examples

### Basic Recognition

```python
from pycore.pyutils.azure_speech import speech_recognizer
import asyncio

async def main():
    recognizer = speech_recognizer
    recognizer.initialize()
    
    print("Speak now...")
    result = await recognizer.recognize()
    
    if result.success:
        print(f"You said: {result.text}")
    else:
        print(f"Error: {result.error}")

asyncio.run(main())
```

### Continuous Recognition

```python
from pycore.pyutils.azure_speech import speech_recognizer
import asyncio

def on_recognized(result):
    print(f"[{result.timestamp}] {result.text}")

def on_error(error):
    print(f"Error: {error}")

async def main():
    recognizer = speech_recognizer
    recognizer.initialize()
    
    recognizer.start_continuous(
        on_recognized=on_recognized,
        on_error=on_error
    )
    
    # Run for 60 seconds
    await asyncio.sleep(60)
    
    recognizer.stop_continuous()

asyncio.run(main())
```

### File Transcription

```python
from pycore.pyutils.azure_speech import get_azure_speech_client
import asyncio

async def main():
    client = get_azure_speech_client()
    
    result = await client.recognize_from_file(
        "meeting.wav",
        language="en-US"
    )
    
    print(f"Transcription: {result.text}")
    print(f"Duration: {result.duration}s")

asyncio.run(main())
```

## Supported Languages

| Language | Code |
|----------|------|
| English (US) | en-US |
| English (UK) | en-GB |
| Chinese (Mandarin) | zh-CN |
| Japanese | ja-JP |
| Korean | ko-KR |
| German | de-DE |
| French | fr-FR |
| Spanish | es-ES |

## Best Practices

1. **Store Keys Securely**: Use secret manager
2. **Handle Quota**: Monitor usage limits
3. **Choose Region**: Use closest region
4. **Specify Language**: Improves accuracy

## Exports

```python
__all__ = [
    "AzureSpeechClient",
    "get_azure_speech_client",
    "AzureSpeechConfig",
    "BaseSpeechRecognitionProvider",
    "AzureSpeechRecognitionProvider",
    "SpeechRecognizer",
    "get_speech_recognizer",
    "speech_recognizer",
    "SPEECH_RECOGNITION_AVAILABLE",
]
```















