#!/usr/bin/env python3

"""
Translation Utility Library

Provides comprehensive translation functionality including:
- Google Translate API integration
- MD5-based caching system with namespace isolation (src/dest language pairs)
- Single text and batch translation
- Language detection
- JSON configuration file support
- Command-line interface

Cache Structure:
    {wwwroot}/pycore_db/translator_cache/{src_lang}_to_{dest_lang}/{md5_hash}.json

Usage Examples:

1. Programmatic Usage (Single Translation):
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

2. Programmatic Usage (Batch Translation):
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

3. Dictionary Configuration:
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

4. JSON File Configuration:
    ```python
    from pycore.pyutils.translator import translate_from_json_file
    import asyncio
    
    # config.json format:
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

5. Command-Line Usage:
    ```bash
    # Single translation with parameters
    python -m pycore.pyutils.translator \\
        --text "Hello world" \\
        --src en \\
        --dest ko \\
        --output result.json
    
    # Multiple target languages
    python -m pycore.pyutils.translator \\
        --text "Hello world" \\
        --src en \\
        --dest ko ja zh-cn \\
        --output result.json
    
    # Batch translation from JSON config
    python -m pycore.pyutils.translator \\
        --config config.json \\
        --output results.json
    
    # Without cache
    python -m pycore.pyutils.translator \\
        --text "Hello" \\
        --src en \\
        --dest ko \\
        --no-cache
    
    # Clear cache for specific language pair
    python -m pycore.pyutils.translator \\
        --clear-cache \\
        --src en \\
        --dest ko
    
    # Clear all cache
    python -m pycore.pyutils.translator --clear-cache
    ```

JSON Configuration Format:
    {
        "src": "en",                    // Source language (or "auto" for detection)
        "dest": ["ko", "ja", "zh-cn"],  // Target language(s), can be string or array
        "texts": [                       // Text(s) to translate, can be string or array
            "Hello world",
            "How are you?",
            "Thank you"
        ]
    }

Supported Languages (examples):
    - en: English
    - ko: Korean
    - ja: Japanese
    - zh-cn: Chinese (Simplified)
    - zh-tw: Chinese (Traditional)
    - fr: French
    - es: Spanish
    - de: German
    - it: Italian
    - pt: Portuguese
    - ru: Russian
    - ar: Arabic
    - th: Thai
    - vi: Vietnamese
    - ... and many more
"""

from pycore.pyutils.translator.google_translator import (
    GoogleTranslator,
    GoogleTranslatorCache,
    TranslationTask,
    TranslationResult,
    translate_from_dict,
    translate_from_json_file,
    clear_cache,
)

from pycore.pyutils.translator.romanization import (
    Romanizer,
    RomanizationResult,
    RomanizationCache,
    romanize_text,
    romanize_batch,
)

from pycore.pyutils.translator.phonetic import (
    PhoneticTranscriber,
    PhoneticResult,
    PhoneticCache,
    text_to_ipa,
    word_to_ipa,
    batch_to_ipa,
)

__all__ = [
    # Translation
    'GoogleTranslator',
    'GoogleTranslatorCache',
    'TranslationTask',
    'TranslationResult',
    'translate_from_dict',
    'translate_from_json_file',
    'clear_cache',
    # Romanization
    'Romanizer',
    'RomanizationResult',
    'RomanizationCache',
    'romanize_text',
    'romanize_batch',
    # Phonetic (IPA)
    'PhoneticTranscriber',
    'PhoneticResult',
    'PhoneticCache',
    'text_to_ipa',
    'word_to_ipa',
    'batch_to_ipa',
]
