# pyutils.whisper_stt - Whisper Speech-to-Text

## Overview

The `whisper_stt` module provides speech recognition using OpenAI's Whisper model. It supports multiple input sources including audio files, microphone, system audio, URLs, and video files.

## Module Location

```
pycore/pyutils/whisper_stt/
├── __init__.py
├── whisper_provider.py     # WhisperSTTProvider
├── audio_processor.py      # Audio preprocessing
└── config.py               # Configuration
```

## Core Components

### WhisperSTTProvider

Main STT provider:

```python
from pycore.pyutils.whisper_stt import (
    WhisperSTTProvider,
    whisper_stt_provider,
    get_whisper_stt_provider
)

# Get singleton
provider = whisper_stt_provider

# Or create new
provider = WhisperSTTProvider(
    model_size="base",  # tiny, base, small, medium, large
    device="cuda",      # cuda, cpu
    language="en"       # auto-detect if None
)

# Initialize
provider.initialize()

# Transcribe from file
result = provider.recognize_from_file("audio.mp3")
print(f"Text: {result.text}")
print(f"Confidence: {result.confidence}")

# Transcribe from microphone
provider.recognize_from_microphone(
    on_recognized=lambda text, conf: print(f"Heard: {text}"),
    duration=10  # seconds
)

# Transcribe from URL
result = provider.recognize_from_url("https://example.com/audio.mp3")

# Transcribe from video
result = provider.recognize_from_video("video.mp4")

# System audio (Windows)
provider.recognize_from_system_audio(
    on_recognized=lambda text, conf: print(f"System: {text}")
)
```

### Model Sizes

| Size | Parameters | VRAM | Speed |
|------|------------|------|-------|
| tiny | 39M | ~1GB | Fastest |
| base | 74M | ~1GB | Fast |
| small | 244M | ~2GB | Medium |
| medium | 769M | ~5GB | Slow |
| large | 1550M | ~10GB | Slowest |

### Recognition Result

```python
@dataclass
class RecognitionResult:
    text: str              # Transcribed text
    confidence: float      # Confidence score 0-1
    language: str          # Detected language
    segments: List[dict]   # Time-aligned segments
    duration: float        # Audio duration
```

## Usage Examples

### File Transcription

```python
from pycore.pyutils.whisper_stt import whisper_stt_provider

provider = whisper_stt_provider
provider.initialize()

result = provider.recognize_from_file("podcast.mp3")

print(f"Transcription: {result.text}")
print(f"Language: {result.language}")
print(f"Duration: {result.duration}s")

# With segments
for segment in result.segments:
    print(f"[{segment['start']:.2f}s] {segment['text']}")
```

### Real-time Microphone

```python
from pycore.pyutils.whisper_stt import whisper_stt_provider

provider = whisper_stt_provider
provider.initialize()

def on_speech(text, confidence):
    print(f"[{confidence:.2f}] {text}")

# Listen for 30 seconds
provider.recognize_from_microphone(
    on_recognized=on_speech,
    duration=30
)
```

### Video Transcription

```python
from pycore.pyutils.whisper_stt import whisper_stt_provider

provider = whisper_stt_provider
provider.initialize()

# Extract audio and transcribe
result = provider.recognize_from_video(
    "lecture.mp4",
    language="en"
)

# Create subtitles
with open("subtitles.srt", "w") as f:
    for i, seg in enumerate(result.segments, 1):
        f.write(f"{i}\n")
        f.write(f"{format_time(seg['start'])} --> {format_time(seg['end'])}\n")
        f.write(f"{seg['text']}\n\n")
```

## Best Practices

1. **Choose Model Size**: Balance accuracy vs. speed
2. **GPU Acceleration**: Use CUDA for faster processing
3. **Specify Language**: Improves accuracy when known
4. **Batch Processing**: Process multiple files sequentially

## Exports

```python
__all__ = [
    'WhisperSTTProvider',
    'whisper_stt_provider',
    'get_whisper_stt_provider',
]
```




