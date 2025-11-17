# TTS Configuration & Cache Usage Example

## Overview

The TTS system now includes:
1. **TTSCacheManager** - Caches TTS audio files (existing)
2. **TTSConfigManager** - Manages TTS configuration in database (new)
3. **SpeechTTSConfigModel** - Database model for TTS config (new)
4. **SpeechTTSCacheModel** - Database model for TTS cache (existing)

---

## Quick Start

### 1. Basic Configuration Management

```python
from pycore.pyutils.tts_cache import tts_config_manager

# Get configuration
provider = tts_config_manager.get('default_provider')  # 'edge'
language = tts_config_manager.get('default_language')  # 'zh-CN'

# Set configuration
tts_config_manager.set('default_provider', 'azure')
tts_config_manager.set('default_voice_zh_CN', 'zh-CN-XiaoxiaoNeural')

# Get with default fallback
timeout = tts_config_manager.get('synthesis_timeout', 30)

# Get all configurations
all_configs = tts_config_manager.get_all()
print(all_configs)

# Print all configurations
tts_config_manager.print_all()
```

### 2. Working with Both Cache and Config

```python
from pycore.pyutils.tts_cache import tts_cache_manager, tts_config_manager

# Get configuration settings
cache_enabled = tts_config_manager.get('cache_enabled', True)
provider = tts_config_manager.get('default_provider', 'edge')
language = tts_config_manager.get('default_language', 'zh-CN')

# Use cache if enabled
if cache_enabled:
    # Check cache first
    cached_audio = tts_cache_manager.get_cache(
        provider=provider,
        text="Hello World",
        language=language
    )

    if cached_audio:
        print(f"Using cached audio: {cached_audio}")
    else:
        # Synthesize and cache
        # ... TTS synthesis logic ...
        audio_file = "/path/to/synthesized.mp3"
        tts_cache_manager.save_cache(
            provider=provider,
            text="Hello World",
            language=language,
            source_file=audio_file
        )
```

### 3. Database Integration

```python
# The configuration is automatically stored in database
# Database: D:/www/pycore_db/speech.db
# Table: util_speech_tts_config

# Direct database access (if needed)
from pycore.database import database_manager
from pycore.database.models import SpeechTTSConfigModel, TableKeys

# Get database connection
with database_manager.get_connection("speech") as conn:
    # Get config directly from database
    value = SpeechTTSConfigModel.get_config(conn, 'default_provider')

    # Set config directly in database
    SpeechTTSConfigModel.set_config(conn, 'custom_setting', 'custom_value')

    # Get all configs
    all_configs = SpeechTTSConfigModel.get_all_configs(conn)

    # Check if key exists
    exists = SpeechTTSConfigModel.key_exists(conn, 'default_provider')
```

### 4. Default Configurations

The following default configurations are automatically initialized:

```python
DEFAULT_CONFIG = {
    # Provider settings
    'default_provider': 'edge',
    'edge_tts_enabled': True,
    'azure_tts_enabled': False,

    # Language settings
    'default_language': 'zh-CN',
    'supported_languages': ['zh-CN', 'en-US', 'ja-JP', 'ko-KR', 'lo-LA'],

    # Voice settings
    'default_voice_zh_CN': 'zh-CN-XiaoxiaoNeural',
    'default_voice_en_US': 'en-US-JennyNeural',
    'default_voice_ja_JP': 'ja-JP-NanamiNeural',
    'default_voice_ko_KR': 'ko-KR-SunHiNeural',

    # Cache settings
    'cache_enabled': True,
    'cache_max_size_mb': 1000,
    'cache_ttl_days': 30,

    # Performance settings
    'max_queue_size': 50,
    'synthesis_timeout': 30,
    'retry_attempts': 3,

    # Audio settings
    'audio_format': 'mp3',
    'audio_quality': 'high',
    'sample_rate': 24000,

    # Advanced settings
    'enable_ssml': False,
    'enable_preprocessing': True,
    'enable_postprocessing': False,
}
```

### 5. Reset to Defaults

```python
# Reset all configurations to default values
tts_config_manager.reset_to_defaults()
```

### 6. Get Statistics

```python
# Get configuration statistics
stats = tts_config_manager.get_statistics()
print(stats)
# Output:
# {
#     'total_configs': 20,
#     'database_enabled': True,
#     'initialized': True,
#     'by_type': {'string': 10, 'bool': 5, 'int': 3, 'list': 2}
# }
```

---

## Integration with TTS Providers

### Edge TTS Example

```python
from pycore.pyutils.tts_cache import tts_config_manager, tts_cache_manager
from pycore.pyutils.edge_tts import EdgeTTSClient

# Get configuration
language = tts_config_manager.get('default_language', 'zh-CN')
voice = tts_config_manager.get(f'default_voice_{language.replace("-", "_")}')
cache_enabled = tts_config_manager.get('cache_enabled', True)

# Initialize TTS client
tts_client = EdgeTTSClient()

# Synthesize with configuration
text = "你好，世界"

# Check cache first
if cache_enabled:
    cached_audio = tts_cache_manager.get_cache('edge', text, language)
    if cached_audio:
        print(f"Using cached audio: {cached_audio}")
        # Use cached audio...
        exit()

# Not in cache, synthesize
audio_file = tts_client.synthesize(text, language, voice)

# Save to cache
if cache_enabled:
    tts_cache_manager.save_cache('edge', text, language, audio_file)
```

### Azure TTS Example

```python
# Similar to Edge TTS, but check if Azure is enabled first
azure_enabled = tts_config_manager.get('azure_tts_enabled', False)

if not azure_enabled:
    print("Azure TTS is disabled in configuration")
    exit()

# ... rest of Azure TTS logic ...
```

---

## Database Schema

### TTS Config Table (util_speech_tts_config)

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| key | VARCHAR(255) | Config key (unique) |
| value | TEXT | Config value (JSON string) |
| value_type | VARCHAR(50) | Type hint (string, int, bool, list, dict) |
| description | VARCHAR(500) | Config description |
| created_at | DATETIME | Creation timestamp |
| updated_at | DATETIME | Last update timestamp |

### TTS Cache Table (util_speech_tts_cache)

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| text_md5 | VARCHAR(32) | MD5 hash of text |
| text | TEXT | Original text |
| language | VARCHAR(20) | Language code |
| provider | VARCHAR(20) | TTS provider |
| file_path | VARCHAR(500) | Cached audio file path |
| file_size | INTEGER | File size in bytes |
| file_exists | BOOLEAN | File existence flag |
| created_at | DATETIME | Creation timestamp |
| last_accessed_at | DATETIME | Last access timestamp |
| access_count | INTEGER | Access count |

---

## Advanced Usage

### Custom Database Name

```python
from pycore.pyutils.tts_cache import TTSConfigManager

# Use custom database name
custom_config = TTSConfigManager(database_enabled=True, database_name="my_tts_db")

# Use custom config manager
custom_config.set('my_setting', 'my_value')
value = custom_config.get('my_setting')
```

### In-Memory Mode (No Database)

```python
# Disable database (useful for testing)
memory_config = TTSConfigManager(database_enabled=False)

# Configurations are stored in memory only
memory_config.set('temp_setting', 'temp_value')
```

### Singleton Access

```python
from pycore.pyutils.tts_cache import get_tts_config_manager

# Get global singleton instance
config_manager = get_tts_config_manager()

# All calls to get_tts_config_manager() return the same instance
config_manager2 = get_tts_config_manager()
assert config_manager is config_manager2  # True
```

---

## Best Practices

1. **Use singleton instance** - Import `tts_config_manager` directly for convenience
2. **Check cache before synthesis** - Always check cache first to avoid redundant synthesis
3. **Enable database mode** - Use database for persistent configuration storage
4. **Set meaningful descriptions** - Add descriptions when setting configs for better documentation
5. **Use get with default** - Always provide default values when getting configs

---

## Troubleshooting

### Database Not Available

If you see:
```
[TTSConfig] Database not available, using in-memory config
```

Solution:
```bash
pip install sqlalchemy
```

### Config Not Persisting

If configurations are not saved after restart, check:
1. Database is enabled: `tts_config_manager.database_enabled == True`
2. Database file exists: `D:/www/pycore_db/speech.db`
3. No errors in console during initialization

### Cache Not Working

If cache is not working:
1. Check if cache is enabled: `tts_config_manager.get('cache_enabled')`
2. Check cache statistics: `tts_cache_manager.get_statistics()`
3. Verify database integration: `tts_cache_manager.database_enabled`

---

**Version**: 1.0.0
**Last Updated**: 2025-11-17
**Dependencies**: `sqlalchemy`, `pycore.database`
