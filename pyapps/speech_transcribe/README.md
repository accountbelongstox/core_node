# Speech Transcribe Application

Real-time speech-to-text transcription application powered by Azure Speech Service.

## Features

- Real-time speech recognition from microphone or system audio
- Multiple language support (Chinese, English, Japanese, Korean, etc.)
- Continuous and time-limited recognition modes
- System audio capture (loopback) support
- High accuracy with Azure Cognitive Services

## Architecture

This application follows the pycore project architecture:

```
pyapps/speech_transcribe/           # Application layer
    speech_transcribe_main.py       # Entry point (single pyctl call)
    main.py                         # Fallback entry point

pycore/pyctl/speech/                # Controller layer
    speech_manager.py               # Orchestrates pyutils
    transcription_app.py            # Application logic

pycore/pyutils/speech_recognition/  # Utility layer
    speech_recognizer.py            # Main STT interface
    azure_provider.py               # Azure implementation
    base_provider.py                # Abstract provider interface
```

## Installation

```bash
# Install dependencies
pip install azure-cognitiveservices-speech pyaudiowpatch numpy

# Or use requirements
pip install -r requirements.txt
```

## Configuration

Azure Speech Service credentials are loaded from secret manager:

```
.secret_keys/.secret_ignore/
├── AZURE_SPEECH_KEYA_1    # Azure Speech Key (primary)
├── AZURE_SPEECH_KEYB_1    # Azure Speech Key (backup)
└── AZURE_SPEECH_REGION_1  # Azure Region (e.g., eastus)
```

## Usage

### Unified Entry Point (Recommended) ✨ **NEW!**

```bash
# Unified entry point with configuration caching
python speech_transcribe.py
```

**Features:**
- Interactive mode selection (single/dual)
- **Configuration caching** - saves your preferences
- **Multi-select languages** - choose multiple languages at once
- **Cache info display** - see MD5 hashes and TTS cache status
- Quick restart with cached settings (just press Enter!)

See [CACHE_INTEGRATION_GUIDE.md](CACHE_INTEGRATION_GUIDE.md) for detailed documentation.

### Legacy Entry Points (Still Supported)

```bash
# Single-source mode
python speech_transcribe_main.py

# Dual-source mode
python speech_transcribe_dual_main.py
```

### Feature Highlights

**Dual-Source Features:**
- Simultaneous microphone + system audio transcription
- Independent language settings per source
- Multi-select language support (e.g., English + Japanese for system audio)
- Ctrl+Click: Copy last system audio text to clipboard
- Ctrl+DoubleClick: Replay last system audio text with TTS
- Intelligent silence detection for sentence segmentation

**TTS & Caching Features:**
- **TTS Cache System**: MD5-based caching for instant replay
- **Edge TTS Support**: Free TTS (default), no credentials needed
- **Provider Auto-Selection**: Edge TTS (free) → Azure TTS (premium)
- **Configuration Cache**: Settings persist across sessions
- **Cache Info Display**: View MD5, cache status, hit rate after each recognition

**Additional Guides:**
- [DUAL_SOURCE_GUIDE.md](DUAL_SOURCE_GUIDE.md) - Dual-source transcription guide
- [TTS_CACHE_GUIDE.md](TTS_CACHE_GUIDE.md) - TTS caching system guide
- [CACHE_INTEGRATION_GUIDE.md](CACHE_INTEGRATION_GUIDE.md) - Configuration cache guide

### Workflow

1. **Select Language**
   - Chinese (Simplified)
   - English (US)
   - Japanese
   - Korean

2. **Select Audio Device**
   - System Audio (loopback) - captures computer audio
   - Microphone - captures microphone input

3. **Select Duration Mode**
   - Continuous - runs until Ctrl+C
   - Time limited - runs for specified seconds

4. **Start Transcription**
   - Real-time results appear as you speak/play audio
   - `[RECOGNIZING]` - intermediate results
   - `[RECOGNIZED]` - final results
   - `[CONFIDENCE]` - recognition confidence score

### Example Output

```
[READY] Recognition started
[INFO] Start speaking into microphone

[RECOGNIZING] hello
[RECOGNIZING] hello world
[RECOGNIZED] Hello world.
[CONFIDENCE] 95.24%

[RECOGNIZING] how are
[RECOGNIZING] how are you
[RECOGNIZED] How are you?
[CONFIDENCE] 97.32%
```

## API Usage

You can also use the speech_manager programmatically:

```python
from pycore.pyctl.speech import speech_manager

# Initialize
speech_manager.initialize()

# Recognize from file
result = speech_manager.recognize_from_file("audio.wav", language="zh-CN")
print(result['text'])

# Continuous recognition with callbacks
def on_recognized(text, confidence):
    print(f"[{confidence:.2%}] {text}")

speech_manager.start_continuous_recognition(
    audio_source=None,  # Default microphone
    language="zh-CN",
    on_recognized=on_recognized
)
```

## Supported Languages

- `zh-CN` - Chinese (Simplified)
- `zh-TW` - Chinese (Traditional)
- `en-US` - English (US)
- `en-GB` - English (UK)
- `ja-JP` - Japanese
- `ko-KR` - Korean
- `de-DE` - German
- `fr-FR` - French
- `es-ES` - Spanish
- `ru-RU` - Russian
- `it-IT` - Italian
- `pt-BR` - Portuguese (Brazil)
- `ar-SA` - Arabic
- `hi-IN` - Hindi

[Full language list](https://learn.microsoft.com/en-us/azure/cognitive-services/speech-service/language-support)

## Troubleshooting

### No audio devices found

**Solution**: Ensure audio drivers are installed and devices are enabled

### Azure Speech SDK not available

**Solution**:
```bash
pip install azure-cognitiveservices-speech
```

### Invalid sample rate error

**Solution**: The application automatically resamples audio to 16kHz required by Azure

### Recognition not working

**Solution**:
- Check Azure credentials are correct
- Verify network connection
- Ensure audio device is working
- Try different audio device

## Project Standards Compliance

This application follows `PYTHON_PYCORE_BASE_GUIDE_THIS_FILE_NO_AI_EDIT.md`:

- ✅ Entry point has single pyctl call
- ✅ All logic in pyctl layer
- ✅ Utilities in pyutils layer
- ✅ Threading follows standards (Thread class, no shared state)
- ✅ Imports at file top (stdlib → third-party → internal)
- ✅ No try-except blocks (AI code standard)
- ✅ ColorPrint for error output
- ✅ Singleton pattern for managers

## License

Part of core_node project.
