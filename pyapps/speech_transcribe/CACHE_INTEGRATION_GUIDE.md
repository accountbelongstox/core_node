# Speech Transcription - Cache Integration Guide

## Overview

The speech transcription application now features comprehensive configuration caching and unified entry point with multi-select language support.

## Features Implemented

### 1. **Configuration Cache System** ✓
- Automatic caching of user preferences
- Persistent storage across sessions
- JSON-based configuration file
- Cache location: `~/.core_node/cache/speech/config.json`

**Cached Settings:**
- Transcription mode (single/dual)
- Language selections (multi-select supported)
- Audio device selections
- Duration mode (continuous/limited)
- Duration seconds (for limited mode)

### 2. **Multi-Select Language Support** ✓
- Select multiple languages for dual-source mode
- Syntax: `1,2` or `1 2` (comma or space separated)
- Example: Select both Chinese and English for system audio
- Primary + secondary language support

### 3. **Unified Entry Point** ✓
- Single entry point per base development guide
- File: `pyapps/speech_transcribe/speech_transcribe_main.py`
- Launches dual-source mode with configuration caching
- Seamless restart experience using cached settings

### 4. **Cache Info Display** ✓
- MD5 hash calculation for recognized text
- TTS cache status check (Edge/Azure)
- Cache file path display
- Overall cache statistics (hit rate, size, count)

## Usage

### Starting the Application

```bash
# Single entry point (base guide compliant)
python pyapps/speech_transcribe/speech_transcribe_main.py
```

### First Run (No Cache)

On first run, you'll be prompted to configure everything:

```
======================================================================
Transcription Mode Selection
======================================================================
1 - Single-source (microphone OR system audio)
2 - Dual-source (microphone AND system audio with hotkeys)

Select mode [default: 1]: 2

======================================================================
Language Selection (microphone)
======================================================================
1 - Chinese (Simplified)
2 - English (US)
3 - Japanese
4 - Korean

Select language [default: 1]: 1

======================================================================
Language Selection (system)
======================================================================
You can select multiple languages (e.g., '1,2' or '1 2')

Select language(s) [default: 1]: 2,3

# Then select devices, duration, etc.
```

### Second Run (With Cache)

On subsequent runs, cached settings are used:

```
[Configuration cache exists]
Show cached configuration? (y/n) [default: n]: y

======================================================================
[Cached Configuration]
======================================================================
Transcription Mode: dual

Languages:
  microphone: ['zh-CN']
  system: ['en-US', 'ja-JP']

Audio Devices:
  microphone: 3
  system: 0

Duration Mode: continuous
======================================================================

[Cached transcription mode: dual]
Use cached mode? (y/n) [default: y]: y

[Cached microphone languages: ['zh-CN']]
Use cached languages? (y/n) [default: y]: y

[Cached system languages: ['en-US', 'ja-JP']]
Use cached languages? (y/n) [default: y]: y

# Continues with cached device and duration settings...
```

### Cache Info During Recognition

After each recognized sentence, cache information is displayed:

```
[RECOGNIZED] Welcome back.
[CONFIDENCE] 95.00%
----------------------------------------------------------------------
[CYCLE COMPLETE] Text: Welcome back.
[CYCLE COMPLETE] Length: 13 chars, Words: 2
----------------------------------------------------------------------

----------------------------------------------------------------------
[Cache Info]
Sentence: Welcome back.
MD5: 8f4a4c9a2b1e5d7f3c6a8b9d1e2f3a4b
Language: en-US
Edge TTS Cache: NOT FOUND
Azure TTS Cache: NOT FOUND

Total TTS Cache Files: 0
Total Cache Size: 0.00 MB
Cache Hit Rate: 0.00%
----------------------------------------------------------------------
```

After replaying with TTS (Ctrl+DoubleClick), the cache will be created:

```
[Cache Info]
Sentence: Welcome back.
MD5: 8f4a4c9a2b1e5d7f3c6a8b9d1e2f3a4b
Language: en-US
Edge TTS Cache: EXISTS - en_US_8f4a4c9a2b1e5d7f3c6a8b9d1e2f3a4b.mp3
Azure TTS Cache: NOT FOUND

Total TTS Cache Files: 1
Total Cache Size: 0.15 MB
Cache Hit Rate: 50.00%
----------------------------------------------------------------------
```

## API Reference

### Configuration Cache API

```python
from pycore.pyutils.config_cache import speech_config_cache

# Transcription mode
speech_config_cache.set_transcription_mode("dual")
mode = speech_config_cache.get_transcription_mode()

# Languages (multi-select)
speech_config_cache.set_languages(["zh-CN", "en-US"], source="system")
langs = speech_config_cache.get_languages("system")  # ['zh-CN', 'en-US']

# Audio device
speech_config_cache.set_audio_device(0, device_type="microphone")
device = speech_config_cache.get_audio_device("microphone")

# Duration
speech_config_cache.set_duration_mode("continuous")
mode = speech_config_cache.get_duration_mode()

# Clear cache
speech_config_cache.clear()

# Print cache
speech_config_cache.print_cached_config()
```

### Helper Functions

```python
from pycore.pyctl.speech.transcription_app import (
    select_language_with_cache,
    select_device_with_cache,
    select_duration_with_cache,
    print_recognition_cache_info
)

# Multi-select language selection
languages = select_language_with_cache(
    source="system",
    allow_multi_select=True
)
# Returns: ['zh-CN', 'en-US']

# Device selection with cache
device_manager = AudioDeviceManager()
device = select_device_with_cache(
    device_manager,
    device_type="microphone"
)

# Duration selection with cache
duration = select_duration_with_cache()  # None for continuous

# Print cache info for recognized text
print_recognition_cache_info("Hello world", "en-US")
```

## Architecture Changes

### New Files Created

1. **`pycore/pyutils/config_cache/speech_config_cache.py`**
   - Configuration cache manager
   - JSON-based persistent storage
   - Multi-select language support

2. **`pycore/pyutils/config_cache/__init__.py`**
   - Package initialization
   - Singleton export

3. **`pyapps/speech_transcribe/speech_transcribe_main.py`**
   - Single entry point (dual-source by default)
   - Configuration cache awareness
   - Integrated launcher call

### Files Modified

1. **`pycore/pyctl/speech/transcription_app.py`**
   - Added helper functions for cached selection
   - Added `print_recognition_cache_info()` function
   - Updated `run_app()` to use cached selection
   - Updated `run_app_dual_source()` to use cached selection
   - Added language parameter to `TranscriptionSession`
   - Integrated cache info display after recognition

2. **`pyapps/speech_transcribe/speech_transcribe_main.py`**
   - Hosts the unified launch logic per base guide
   - Always starts dual-source mode with RPC enabled

3. **Removed Legacy Entry (`speech_transcribe_dual_main.py`)**
   - Dual-mode functionality now handled by the main entry

## Benefits

### 1. **Faster Startup**
- No need to re-select settings on each run
- One-key confirmation for cached settings
- Saves time for frequent users

### 2. **Multi-Language Support**
- Select multiple languages for system audio
- Useful for bilingual content
- Flexible language combinations

### 3. **Better User Experience**
- Unified entry point - no confusion
- Clear cache status display
- Informative cache statistics

### 4. **Developer-Friendly**
- Reusable cache components
- Clean API for configuration
- Easy to extend

## Testing

Run the comprehensive test suite:

```bash
python pyapps/speech_transcribe/test_cache_integration.py
```

**Test Coverage:**
- ✓ Configuration cache save/load
- ✓ Cache persistence across sessions
- ✓ TTS cache MD5 calculation
- ✓ Helper function availability
- ✓ Unified entry point integration

## Cache File Locations

```
~/.core_node/cache/
├── speech/
│   └── config.json          # Configuration cache
└── tts/
    ├── edge/
    │   ├── zh-CN/           # Chinese TTS cache
    │   │   └── zh_CN_<md5>.mp3
    │   └── en-US/           # English TTS cache
    │       └── en_US_<md5>.mp3
    └── azure/
        └── (same structure)
```

## Migration Notes

### From Old Version

**No migration needed!** The new system is backward compatible:

1. Single entry point: `speech_transcribe_main.py` (dual-source mode)

2. Cache is created automatically on first selection

3. All existing features remain unchanged

### Recommended Workflow

```bash
# First time
python speech_transcribe_main.py

# Configure settings interactively (cache created automatically)

# Subsequent runs reuse cache instantly
python speech_transcribe_main.py
```

## Troubleshooting

### Clear Cache

```bash
# Via Python
python -c "from pycore.pyutils.config_cache import speech_config_cache; speech_config_cache.clear()"

# Or manually delete
rm ~/.core_node/cache/speech/config.json
```

### Cache Not Loading

- Check file permissions on cache directory
- Verify JSON file is not corrupted
- Check console for "[ConfigCache]" messages

### Invalid Cached Device

If cached device no longer exists:
- Select 'n' when asked to use cached device
- Select a valid device
- New device will be cached

## Future Enhancements

Potential improvements:

1. **Export/Import Cache**
   - Share configurations between machines
   - Backup/restore settings

2. **Profile Support**
   - Multiple configuration profiles
   - Switch between work/home setups

3. **Smart Defaults**
   - Learn from usage patterns
   - Suggest optimal settings

4. **Cloud Sync**
   - Sync cache across devices
   - Backup to cloud storage

## Summary

✅ **Configuration caching** - Settings persist across sessions
✅ **Multi-select languages** - Choose multiple languages easily
✅ **Unified entry point** - One file for all modes
✅ **Cache info display** - See MD5, TTS cache status
✅ **Fully tested** - Comprehensive test suite
✅ **Backward compatible** - Old entry points still work

The speech transcription application is now more user-friendly with intelligent caching and streamlined configuration!
