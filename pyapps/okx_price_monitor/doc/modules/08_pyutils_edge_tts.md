# pyutils.edge_tts - Text-to-Speech Library

## Overview

The `edge_tts` module provides comprehensive text-to-speech functionality using Microsoft Edge TTS. It includes document parsing, sentence extraction, language detection, thread-safe task queues, translation with MD5 caching, and file/web content parsing.

## Module Location

```
pycore/pyutils/edge_tts/
├── __init__.py
├── config.py                # TTSConfig
├── edge_tts_client.py       # EdgeTTSClient
├── edge_tts_worker_thread.py # Worker thread
├── parser.py                # TTSFileParser
├── processor.py             # TTSProcessor
├── thread_manager.py        # TTSThreadManager
├── translator.py            # TTSTranslator
└── TTS架构.txt              # Architecture docs
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    TTS Pipeline                             │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ TTSProcessor│  │TTSTranslator│  │  EdgeTTSClient      │ │
│  │             │─>│             │─>│                     │ │
│  │ Parse Text  │  │ Translate   │  │ Generate Audio      │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│         │                │                   │             │
│         ▼                ▼                   ▼             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              TTSThreadManager                        │   │
│  │  ┌───────────────┐  ┌───────────────┐              │   │
│  │  │ WorkerThread1 │  │ WorkerThread2 │  ...         │   │
│  │  └───────────────┘  └───────────────┘              │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### TTSConfig

TTS configuration settings:

```python
from pycore.pyutils.edge_tts import TTSConfig

config = TTSConfig()

# Voice settings
config.default_voice = "en-US-JennyNeural"
config.default_rate = "+0%"
config.default_volume = "+0%"
config.default_pitch = "+0Hz"

# Audio settings
config.output_format = "audio-24khz-48kbitrate-mono-mp3"
config.sample_rate = 24000

# Processing settings
config.max_workers = 4
config.chunk_size = 1000  # Characters per chunk
config.enable_cache = True
config.cache_dir = "/path/to/cache"

# Translation settings
config.enable_translation = False
config.source_language = "auto"
config.target_language = "en"
```

**Available Voices (examples):**

| Voice ID | Language | Gender | Description |
|----------|----------|--------|-------------|
| en-US-JennyNeural | English (US) | Female | Natural, warm |
| en-US-GuyNeural | English (US) | Male | Professional |
| zh-CN-XiaoxiaoNeural | Chinese | Female | Natural |
| zh-CN-YunxiNeural | Chinese | Male | Natural |
| ja-JP-NanamiNeural | Japanese | Female | Natural |
| ko-KR-SunHiNeural | Korean | Female | Natural |

### EdgeTTSClient

Main TTS client:

```python
from pycore.pyutils.edge_tts import EdgeTTSClient, get_edge_tts_client

# Get singleton instance
client = get_edge_tts_client()

# Or create new instance
client = EdgeTTSClient(
    voice="en-US-JennyNeural",
    rate="+0%",
    volume="+0%",
    pitch="+0Hz"
)

# Synthesize text to file
await client.synthesize(
    text="Hello, world!",
    output_path="/path/to/output.mp3"
)

# Synthesize to bytes
audio_bytes = await client.synthesize_to_bytes("Hello, world!")

# Stream synthesis
async for chunk in client.synthesize_stream("Hello, world!"):
    # Process audio chunk
    pass

# Get available voices
voices = await client.list_voices()
for voice in voices:
    print(f"{voice['ShortName']}: {voice['Locale']} - {voice['Gender']}")
```

**Methods:**

```python
class EdgeTTSClient:
    async def synthesize(
        self, 
        text: str, 
        output_path: str,
        voice: str = None,
        rate: str = None,
        volume: str = None,
        pitch: str = None
    ) -> bool:
        """Synthesize text to audio file"""
    
    async def synthesize_to_bytes(
        self,
        text: str,
        voice: str = None
    ) -> bytes:
        """Synthesize text to bytes"""
    
    async def synthesize_stream(
        self,
        text: str,
        voice: str = None
    ) -> AsyncGenerator[bytes, None]:
        """Stream audio synthesis"""
    
    async def list_voices(self) -> List[dict]:
        """Get available voices"""
    
    def set_voice(self, voice: str):
        """Set default voice"""
    
    def set_rate(self, rate: str):
        """Set speech rate (e.g., '+20%', '-10%')"""
    
    def set_volume(self, volume: str):
        """Set volume (e.g., '+50%')"""
    
    def set_pitch(self, pitch: str):
        """Set pitch (e.g., '+5Hz')"""
```

### TTSProcessor

Text processing and sentence extraction:

```python
from pycore.pyutils.edge_tts import TTSProcessor

processor = TTSProcessor()

# Parse text into sentences
sentences = processor.parse_text("""
This is the first sentence. This is the second one!
What about questions? Yes, they work too.
""")

for sentence in sentences:
    print(f"Sentence: {sentence.text}")
    print(f"  Words: {len(sentence.words)}")

# Parse document
document = processor.parse_document(
    content="Long text content...",
    title="My Document"
)

print(f"Document: {document.title}")
print(f"Sentences: {len(document.sentences)}")

# Get words from sentence
for word in document.sentences[0].words:
    print(f"  Word: {word.text}, Type: {word.type}")
```

### TTSTranslator

Translation with MD5 caching:

```python
from pycore.pyutils.edge_tts import TTSTranslator

translator = TTSTranslator()

# Translate single text
result = await translator.translate(
    text="Hello, world!",
    source="en",
    target="zh"
)
print(f"Translation: {result}")

# Translate with cache
result = await translator.translate(
    text="Hello, world!",
    source="en",
    target="zh",
    use_cache=True
)

# Batch translate
results = await translator.translate_batch(
    texts=["Hello", "World", "Python"],
    source="en",
    target="ko"
)
```

### TTSThreadManager

Thread pool management:

```python
from pycore.pyutils.edge_tts import TTSThreadManager, get_tts_thread_manager

# Get singleton
manager = get_tts_thread_manager()

# Or create new
manager = TTSThreadManager(max_workers=4)

# Start manager
manager.start()

# Add TTS task
task_id = manager.add_task(
    text="Hello, world!",
    output_path="/path/to/output.mp3",
    voice="en-US-JennyNeural",
    callback=on_complete
)

# Check task status
status = manager.get_task_status(task_id)
print(f"Status: {status.state}")

# Wait for completion
result = manager.wait_for_task(task_id, timeout=30)

# Cancel task
manager.cancel_task(task_id)

# Stop manager
manager.stop()
```

### TTSFileParser

File and web content parsing:

```python
from pycore.pyutils.edge_tts import TTSFileParser

parser = TTSFileParser()

# Parse text file
document = parser.parse_file("/path/to/document.txt")

# Parse markdown
document = parser.parse_file("/path/to/readme.md")

# Parse web URL
document = await parser.parse_url("https://example.com/article")

# Parse HTML content
document = parser.parse_html("<p>Hello <b>world</b>!</p>")

# Get plain text
text = parser.extract_text("/path/to/document.pdf")
```

## Data Models

```python
from pycore.pyfoundations.speech_models import (
    DocumentModel,
    SentenceModel,
    WordModel,
    ItemType,
    ItemStatus
)

# Document structure
document = DocumentModel(
    title="My Document",
    sentences=[...],
    metadata={}
)

# Sentence structure
sentence = SentenceModel(
    text="Hello, world!",
    words=[...],
    index=0,
    status=ItemStatus.PENDING
)

# Word structure
word = WordModel(
    text="Hello",
    type=ItemType.WORD,
    start_pos=0,
    end_pos=5
)

# Item types
class ItemType(Enum):
    WORD = "word"
    PUNCTUATION = "punctuation"
    NUMBER = "number"
    SYMBOL = "symbol"

# Item status
class ItemStatus(Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
```

## Queue Operations

```python
from pycore.pyfoundations.speech_queue_ops import TTSQueueOps

queue = TTSQueueOps()

# Add items to queue
queue.add_sentence(sentence)
queue.add_document(document)

# Get next item
item = queue.get_next()

# Mark complete
queue.mark_complete(item.id)

# Get queue stats
stats = queue.get_stats()
print(f"Pending: {stats['pending']}")
print(f"Processing: {stats['processing']}")
print(f"Completed: {stats['completed']}")
```

## Usage Examples

### Basic TTS

```python
import asyncio
from pycore.pyutils.edge_tts import get_edge_tts_client

async def main():
    client = get_edge_tts_client()
    
    # Simple synthesis
    await client.synthesize(
        text="Welcome to the text-to-speech demonstration.",
        output_path="welcome.mp3",
        voice="en-US-JennyNeural"
    )
    
    print("Audio saved to welcome.mp3")

asyncio.run(main())
```

### Multi-Voice Synthesis

```python
import asyncio
from pycore.pyutils.edge_tts import EdgeTTSClient

async def main():
    client = EdgeTTSClient()
    
    # Dialogue with different voices
    dialogue = [
        ("en-US-JennyNeural", "Hello! How are you today?"),
        ("en-US-GuyNeural", "I'm doing great, thank you!"),
        ("en-US-JennyNeural", "That's wonderful to hear."),
    ]
    
    for i, (voice, text) in enumerate(dialogue):
        await client.synthesize(
            text=text,
            output_path=f"dialogue_{i}.mp3",
            voice=voice
        )
    
    print("Dialogue synthesized!")

asyncio.run(main())
```

### Document Reading

```python
from pycore.pyutils.edge_tts import (
    TTSProcessor,
    TTSThreadManager
)

processor = TTSProcessor()
manager = TTSThreadManager(max_workers=4)
manager.start()

# Parse document
document = processor.parse_document("""
Chapter 1: Introduction

This is the beginning of our story. It was a dark and stormy night.
The wind howled through the trees, creating an eerie atmosphere.

Chapter 2: The Journey

Our hero set out on a long journey. Little did they know what awaited them.
""", title="Story")

# Queue all sentences for TTS
for i, sentence in enumerate(document.sentences):
    manager.add_task(
        text=sentence.text,
        output_path=f"sentence_{i}.mp3",
        voice="en-US-JennyNeural"
    )

# Wait for all tasks
manager.wait_all()
manager.stop()

print(f"Generated {len(document.sentences)} audio files")
```

### Real-time Streaming

```python
import asyncio
import pyaudio
from pycore.pyutils.edge_tts import EdgeTTSClient

async def stream_audio(text: str):
    client = EdgeTTSClient(voice="en-US-JennyNeural")
    
    # Initialize PyAudio
    p = pyaudio.PyAudio()
    stream = p.open(
        format=pyaudio.paInt16,
        channels=1,
        rate=24000,
        output=True
    )
    
    # Stream audio chunks
    async for chunk in client.synthesize_stream(text):
        stream.write(chunk)
    
    stream.stop_stream()
    stream.close()
    p.terminate()

asyncio.run(stream_audio("This is streaming text-to-speech!"))
```

### Translation + TTS

```python
import asyncio
from pycore.pyutils.edge_tts import EdgeTTSClient, TTSTranslator

async def translate_and_speak(text: str, source_lang: str, target_lang: str, voice: str):
    translator = TTSTranslator()
    client = EdgeTTSClient()
    
    # Translate
    translated = await translator.translate(
        text=text,
        source=source_lang,
        target=target_lang
    )
    
    # Synthesize
    await client.synthesize(
        text=translated,
        output_path="translated.mp3",
        voice=voice
    )
    
    print(f"Original: {text}")
    print(f"Translated: {translated}")

asyncio.run(translate_and_speak(
    "Hello, how are you?",
    source_lang="en",
    target_lang="ko",
    voice="ko-KR-SunHiNeural"
))
```

## Best Practices

1. **Use Singleton**: Use `get_edge_tts_client()` for shared instance

2. **Batch Processing**: Use thread manager for multiple files

3. **Enable Caching**: Cache translations to reduce API calls

4. **Handle Errors**: Wrap async calls in try-except

5. **Choose Appropriate Voice**: Match voice language to text

## Related Modules

- `pycore.pyutils.azure_speech` - Azure Speech Services
- `pycore.pyutils.whisper_stt` - Speech-to-text
- `pycore.pyctl.speech` - Unified speech management
- `pycore.pyutils.translator` - Translation services

## Exports

```python
__all__ = [
    'TTSConfig',
    'DocumentModel', 'SentenceModel', 'WordModel',
    'ItemType', 'ItemStatus',
    'TTSQueueOps',
    'EdgeTTSClient', 'get_edge_tts_client',
    'TTSProcessor',
    'TTSTranslator',
    'TTSFileParser',
    'TTSThreadManager', 'get_tts_thread_manager',
    'BaseTTSWorkerThread',
    'EdgeTTSWorkerThread',
]
```

