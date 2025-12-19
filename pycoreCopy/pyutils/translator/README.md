# Google Translator Module

A comprehensive translation utility with intelligent caching system.

## Features

- Google Translate API integration
- MD5-based caching with namespace isolation (src/dest language pairs)
- Single text and batch translation
- Language detection
- JSON configuration file support
- Command-line interface

## Cache Structure

```
{wwwroot}/pycore_db/translator_cache/
├── en_to_ko/
│   ├── abc123def456.json
│   └── xyz789ghi012.json
├── en_to_ja/
│   └── ...
└── ko_to_en/
    └── ...
```

## Installation

```bash
pip install googletrans
```

## Usage

### 1. Command-Line Interface

#### Single Translation
```bash
python -m pycore.pyutils.translator \
    --text "Hello world" \
    --src en \
    --dest ko \
    --output result.json
```

#### Multiple Target Languages
```bash
python -m pycore.pyutils.translator \
    --text "Hello world" \
    --src en \
    --dest ko ja zh-cn \
    --output result.json
```

#### Batch Translation from JSON
```bash
python -m pycore.pyutils.translator \
    --config example_config.json \
    --output results.json
```

#### Without Cache
```bash
python -m pycore.pyutils.translator \
    --text "Hello" \
    --src en \
    --dest ko \
    --no-cache
```

#### Clear Cache
```bash
# Clear specific language pair
python -m pycore.pyutils.translator \
    --clear-cache \
    --src en \
    --dest ko

# Clear all cache
python -m pycore.pyutils.translator --clear-cache
```

### 2. Programmatic Usage

#### Single Translation
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

#### Batch Translation
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

#### Dictionary Configuration
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
```

#### JSON File Configuration
```python
from pycore.pyutils.translator import translate_from_json_file
import asyncio

results = asyncio.run(translate_from_json_file(
    "config.json",
    output_file="results.json"
))
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

- `src`: Source language code (or "auto" for automatic detection)
- `dest`: Target language code(s) - can be a string or array
- `texts`: Text(s) to translate - can be a string or array

## Supported Languages

Common language codes:
- `en`: English
- `ko`: Korean
- `ja`: Japanese
- `zh-cn`: Chinese (Simplified)
- `zh-tw`: Chinese (Traditional)
- `fr`: French
- `es`: Spanish
- `de`: German
- `it`: Italian
- `pt`: Portuguese
- `ru`: Russian
- `ar`: Arabic
- `th`: Thai
- `vi`: Vietnamese
- And many more...

## Cache Management

The translator uses MD5 hashing to cache translations:

1. Cache key format: `md5("{text}:{src}:{dest}")`
2. Namespace isolation: Each language pair has its own directory
3. Cache location: `{wwwroot}/pycore_db/translator_cache/{src}_to_{dest}/`

### Clear Cache Programmatically
```python
from pycore.pyutils.translator import clear_cache

# Clear specific language pair
count = clear_cache('en', 'ko')
print(f"Cleared {count} cache entries")

# Clear all cache
count = clear_cache()
print(f"Cleared {count} total cache entries")
```

## Examples

See `example_config.json` for a sample configuration file.
