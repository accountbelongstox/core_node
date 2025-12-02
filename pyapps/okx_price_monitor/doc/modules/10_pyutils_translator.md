# pyutils.translator - Translation Utility Library

## Overview

The `translator` module provides comprehensive translation functionality using Google Translate API. It features MD5-based caching with namespace isolation, single and batch translation, language detection, JSON configuration support, and a command-line interface.

## Module Location

```
pycore/pyutils/translator/
├── __init__.py
├── google_translator.py    # Main translator class
├── cache.py                # Cache management
└── config.json             # Default configuration
```

## Cache Structure

```
{wwwroot}/pycore_db/translator_cache/{src_lang}_to_{dest_lang}/{md5_hash}.json
```

Example:
```
/www/pycore_db/translator_cache/en_to_ko/a1b2c3d4e5f6.json
/www/pycore_db/translator_cache/en_to_ja/9f8e7d6c5b4a.json
```

## Core Components

### GoogleTranslator

Main translator class:

```python
from pycore.pyutils.translator import GoogleTranslator
import asyncio

async def translate():
    async with GoogleTranslator() as translator:
        result = await translator.translate_single(
            text="Hello world",
            src="en",
            dest="ko"
        )
        print(f"{result.original_text} -> {result.translated_text}")
        print(f"From cache: {result.from_cache}")

asyncio.run(translate())
```

**Methods:**

```python
class GoogleTranslator:
    async def translate_single(
        self,
        text: str,
        src: str = "auto",
        dest: str = "en",
        use_cache: bool = True
    ) -> TranslationResult:
        """Translate single text"""
    
    async def translate_batch(
        self,
        texts: List[str],
        src: str = "auto",
        dest: str = "en",
        use_cache: bool = True
    ) -> List[TranslationResult]:
        """Translate multiple texts"""
    
    async def detect_language(
        self,
        text: str
    ) -> str:
        """Detect text language"""
    
    async def get_supported_languages(self) -> List[str]:
        """Get list of supported languages"""
```

### TranslationResult

Result container:

```python
from pycore.pyutils.translator import TranslationResult

@dataclass
class TranslationResult:
    original_text: str      # Original input text
    translated_text: str    # Translated output
    src_lang: str           # Source language
    dest_lang: str          # Destination language
    from_cache: bool        # True if retrieved from cache
    confidence: float       # Detection confidence (if auto-detect)
    timestamp: float        # Translation timestamp
```

### TranslationTask

Task definition:

```python
from pycore.pyutils.translator import TranslationTask

task = TranslationTask(
    text="Hello world",
    src="en",
    dest="ko",
    use_cache=True
)
```

### GoogleTranslatorCache

Cache management:

```python
from pycore.pyutils.translator import GoogleTranslatorCache

cache = GoogleTranslatorCache()

# Get cached translation
result = cache.get("Hello", src="en", dest="ko")

# Store translation
cache.set(
    text="Hello",
    translation="안녕하세요",
    src="en",
    dest="ko"
)

# Check if cached
exists = cache.exists("Hello", src="en", dest="ko")

# Clear cache for language pair
cache.clear(src="en", dest="ko")

# Clear all cache
cache.clear_all()

# Get cache stats
stats = cache.get_stats()
print(f"Total entries: {stats['total']}")
print(f"Cache size: {stats['size_mb']} MB")
```

## Usage Examples

### Single Translation

```python
from pycore.pyutils.translator import GoogleTranslator
import asyncio

async def translate_single():
    async with GoogleTranslator() as translator:
        result = await translator.translate_single(
            text="Hello world",
            src="en",
            dest="ko"
        )
        print(f"Translation: {result.translated_text}")

asyncio.run(translate_single())
```

### Batch Translation

```python
from pycore.pyutils.translator import GoogleTranslator
import asyncio

async def translate_batch():
    async with GoogleTranslator() as translator:
        results = await translator.translate_batch(
            texts=["Hello", "World", "Python"],
            src="en",
            dest="ko"
        )
        for result in results:
            print(f"{result.original_text} -> {result.translated_text}")

asyncio.run(translate_batch())
```

### Multiple Target Languages

```python
from pycore.pyutils.translator import GoogleTranslator
import asyncio

async def translate_multi_lang():
    async with GoogleTranslator() as translator:
        text = "Hello world"
        targets = ["ko", "ja", "zh-cn", "fr", "de"]
        
        for dest in targets:
            result = await translator.translate_single(
                text=text,
                src="en",
                dest=dest
            )
            print(f"{dest}: {result.translated_text}")

asyncio.run(translate_multi_lang())
```

### Dictionary Configuration

```python
from pycore.pyutils.translator import translate_from_dict
import asyncio

config = {
    "src": "en",
    "dest": ["ko", "ja", "zh-cn"],
    "texts": [
        "Hello world",
        "How are you?",
        "Thank you"
    ]
}

results = asyncio.run(translate_from_dict(
    config,
    output_file="output.json",
    use_cache=True
))

for result in results:
    print(f"{result.original_text} ({result.dest_lang}): {result.translated_text}")
```

### JSON File Configuration

```python
from pycore.pyutils.translator import translate_from_json_file
import asyncio

# config.json:
# {
#   "src": "en",
#   "dest": ["ko", "ja"],
#   "texts": ["Hello", "World"]
# }

results = asyncio.run(translate_from_json_file(
    "config.json",
    output_file="results.json"
))
```

### Language Detection

```python
from pycore.pyutils.translator import GoogleTranslator
import asyncio

async def detect():
    async with GoogleTranslator() as translator:
        texts = [
            "Hello world",
            "안녕하세요",
            "こんにちは",
            "你好"
        ]
        
        for text in texts:
            lang = await translator.detect_language(text)
            print(f"'{text}' -> {lang}")

asyncio.run(detect())
```

### Cache Management

```python
from pycore.pyutils.translator import GoogleTranslator, clear_cache
import asyncio

async def with_cache():
    async with GoogleTranslator() as translator:
        # First call - fetches from API
        result1 = await translator.translate_single(
            "Hello", src="en", dest="ko", use_cache=True
        )
        print(f"From cache: {result1.from_cache}")  # False
        
        # Second call - fetches from cache
        result2 = await translator.translate_single(
            "Hello", src="en", dest="ko", use_cache=True
        )
        print(f"From cache: {result2.from_cache}")  # True

asyncio.run(with_cache())

# Clear specific cache
clear_cache(src="en", dest="ko")

# Clear all cache
clear_cache()
```

## Command Line Interface

### Single Translation

```bash
python -m pycore.pyutils.translator \
    --text "Hello world" \
    --src en \
    --dest ko \
    --output result.json
```

### Multiple Target Languages

```bash
python -m pycore.pyutils.translator \
    --text "Hello world" \
    --src en \
    --dest ko ja zh-cn \
    --output result.json
```

### Batch from JSON

```bash
python -m pycore.pyutils.translator \
    --config config.json \
    --output results.json
```

### Without Cache

```bash
python -m pycore.pyutils.translator \
    --text "Hello" \
    --src en \
    --dest ko \
    --no-cache
```

### Clear Cache

```bash
# Clear specific language pair
python -m pycore.pyutils.translator \
    --clear-cache \
    --src en \
    --dest ko

# Clear all cache
python -m pycore.pyutils.translator --clear-cache
```

## JSON Configuration Format

```json
{
    "src": "en",
    "dest": ["ko", "ja", "zh-cn"],
    "texts": [
        "Hello world",
        "How are you?",
        "Thank you"
    ]
}
```

**Fields:**
- `src`: Source language code (or "auto" for detection)
- `dest`: Target language(s), can be string or array
- `texts`: Text(s) to translate, can be string or array

## Supported Languages

| Code | Language |
|------|----------|
| en | English |
| ko | Korean |
| ja | Japanese |
| zh-cn | Chinese (Simplified) |
| zh-tw | Chinese (Traditional) |
| fr | French |
| es | Spanish |
| de | German |
| it | Italian |
| pt | Portuguese |
| ru | Russian |
| ar | Arabic |
| th | Thai |
| vi | Vietnamese |
| ... | and many more |

## Output Format

### JSON Output

```json
{
    "results": [
        {
            "original_text": "Hello world",
            "translated_text": "안녕 세계",
            "src_lang": "en",
            "dest_lang": "ko",
            "from_cache": false,
            "timestamp": 1699123456.789
        }
    ],
    "metadata": {
        "total_count": 1,
        "cached_count": 0,
        "api_count": 1,
        "processing_time": 0.5
    }
}
```

## Error Handling

```python
from pycore.pyutils.translator import GoogleTranslator
import asyncio

async def handle_errors():
    async with GoogleTranslator() as translator:
        result = await translator.translate_single(
            text="Hello",
            src="en",
            dest="ko"
        )
        
        if result.translated_text:
            print(f"Success: {result.translated_text}")
        else:
            print("Translation failed")

asyncio.run(handle_errors())
```

## Performance Tips

1. **Enable Caching**: Always use cache for repeated translations

2. **Batch Requests**: Use `translate_batch()` for multiple texts

3. **Pre-warm Cache**: Translate common phrases during initialization

4. **Rate Limiting**: Add delays between requests to avoid blocking

5. **Language Pairs**: Organize translations by language pair for efficient caching

## Best Practices

1. **Use Auto-Detection Sparingly**: Specify source language when known

2. **Validate Languages**: Check supported languages before translation

3. **Handle Long Texts**: Split long texts into paragraphs

4. **Monitor Cache Size**: Periodically clean old cache entries

5. **Error Recovery**: Implement retry logic for API failures

## Related Modules

- `pycore.pyutils.edge_tts` - Text-to-speech with translation
- `pycore.pyctl.speech` - Speech services
- `pycore.pyutils.native_ui.step0_i18n` - Internationalization

## Exports

```python
__all__ = [
    'GoogleTranslator',
    'GoogleTranslatorCache',
    'TranslationTask',
    'TranslationResult',
    'translate_from_dict',
    'translate_from_json_file',
    'clear_cache',
]
```





