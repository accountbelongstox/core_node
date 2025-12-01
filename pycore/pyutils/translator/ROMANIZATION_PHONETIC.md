# Romanization and Phonetic Transcription

This document describes the romanization and phonetic transcription features of the translator utility.

## Features

### 1. Romanization (Transliteration)
Convert non-Latin scripts to Latin characters while preserving pronunciation.

**Supported Languages:**
- Chinese (Simplified/Traditional) → Pinyin
- Japanese (Hiragana/Katakana) → Romaji
- Korean (Hangul) → Romanized Korean
- Russian (Cyrillic) → Latin
- Arabic → Latin
- Thai → Latin
- And many more...

### 2. IPA Phonetic Transcription
Convert English text to IPA (International Phonetic Alphabet) notation.

**Features:**
- Word-level transcription
- Sentence-level transcription
- Batch processing
- Punctuation preservation option

## Installation

Required dependencies are automatically installed through `third_party.py`:
- `googletrans` - For romanization
- `eng-to-ipa` - For IPA phonetic transcription

## Usage

### Romanization

#### Basic Usage

```python
from pycore.pyutils.translator import romanize_text
import asyncio

async def example():
    # Chinese to Pinyin
    result = await romanize_text("你好，世界", src="zh-cn")
    print(f"{result['original_text']} → {result['romanized_text']}")
    # Output: 你好，世界 → nǐ hǎo, shì jiè

asyncio.run(example())
```

#### Batch Romanization

```python
from pycore.pyutils.translator import romanize_batch
import asyncio

async def example():
    texts = ["你好", "谢谢", "再见"]
    results = await romanize_batch(texts, src="zh-cn")

    for result in results:
        print(f"{result['original_text']} → {result['romanized_text']}")

asyncio.run(example())
```

#### Using Romanizer Class

```python
from pycore.pyutils.translator import Romanizer
import asyncio

async def example():
    async with Romanizer() as romanizer:
        # Auto-detect language
        result = await romanizer.romanize("こんにちは", src='auto')
        print(f"{result.original_text} → {result.romanized_text}")
        print(f"Detected language: {result.src_lang}")

asyncio.run(example())
```

### IPA Phonetic Transcription

#### Basic Usage

```python
from pycore.pyutils.translator import text_to_ipa

# Sentence
result = text_to_ipa("Hello, world!")
print(f"{result['original_text']} → /{result['phonetic_text']}/")
# Output: Hello, world! → /həˈloʊ, wɜrld!/
```

#### Word Transcription

```python
from pycore.pyutils.translator import word_to_ipa

result = word_to_ipa("python")
print(f"{result['original_text']} → /{result['phonetic_text']}/")
# Output: python → /ˈpaɪθɑn/
```

#### Batch Processing

```python
from pycore.pyutils.translator import batch_to_ipa

words = ["hello", "world", "python"]
results = batch_to_ipa(words, preserve_punctuation=False)

for result in results:
    print(f"{result['original_text']} → /{result['phonetic_text']}/")
```

#### Using PhoneticTranscriber Class

```python
from pycore.pyutils.translator import PhoneticTranscriber

transcriber = PhoneticTranscriber()

# Single word
result = transcriber.transcribe_word("hello")
print(f"/{result.phonetic_text}/")

# Multiple words
words = ["cat", "dog", "bird"]
results = transcriber.transcribe_words(words)

for result in results:
    print(f"{result.original_text} → /{result.phonetic_text}/")

# Sentences
sentences = ["How are you?", "Thank you!"]
results = transcriber.transcribe_batch(sentences, preserve_punctuation=True)

for result in results:
    print(f"{result.original_text}")
    print(f"/{result.phonetic_text}/\n")
```

## API Reference

### Romanization

#### `romanize_text(text, src='auto', use_cache=True)`
Convert text to romanized form.

**Parameters:**
- `text` (str): Text to romanize
- `src` (str): Source language code (default: 'auto')
- `use_cache` (bool): Whether to use cache (default: True)

**Returns:** Dictionary with romanization result

#### `romanize_batch(texts, src='auto', use_cache=True)`
Romanize multiple texts.

**Parameters:**
- `texts` (List[str]): List of texts to romanize
- `src` (str): Source language code
- `use_cache` (bool): Whether to use cache

**Returns:** List of romanization result dictionaries

#### `Romanizer` Class
Main romanization class.

**Methods:**
- `romanize(text, src='auto', use_cache=True)` → RomanizationResult
- `romanize_batch(texts, src='auto', use_cache=True)` → List[RomanizationResult]

### IPA Phonetic Transcription

#### `text_to_ipa(text, preserve_punctuation=True, use_cache=True)`
Convert text to IPA notation.

**Parameters:**
- `text` (str): English text to transcribe
- `preserve_punctuation` (bool): Keep punctuation (default: True)
- `use_cache` (bool): Whether to use cache (default: True)

**Returns:** Dictionary with phonetic result

#### `word_to_ipa(word, use_cache=True)`
Convert a word to IPA notation.

**Parameters:**
- `word` (str): English word to transcribe
- `use_cache` (bool): Whether to use cache

**Returns:** Dictionary with phonetic result

#### `batch_to_ipa(texts, preserve_punctuation=True, use_cache=True)`
Convert multiple texts to IPA.

**Parameters:**
- `texts` (List[str]): List of texts to transcribe
- `preserve_punctuation` (bool): Keep punctuation
- `use_cache` (bool): Whether to use cache

**Returns:** List of phonetic result dictionaries

#### `PhoneticTranscriber` Class
Main IPA transcription class.

**Methods:**
- `transcribe(text, preserve_punctuation=True, use_cache=True)` → PhoneticResult
- `transcribe_word(word, use_cache=True)` → PhoneticResult
- `transcribe_batch(texts, preserve_punctuation=True, use_cache=True)` → List[PhoneticResult]
- `transcribe_words(words, use_cache=True)` → List[PhoneticResult]

## Data Structures

### RomanizationResult
```python
@dataclass
class RomanizationResult:
    original_text: str      # Original text
    romanized_text: str     # Romanized text
    src_lang: str          # Source language code
    from_cache: bool       # Whether result came from cache
    error: Optional[str]   # Error message if failed
```

### PhoneticResult
```python
@dataclass
class PhoneticResult:
    original_text: str     # Original text
    phonetic_text: str     # IPA phonetic notation
    notation: str          # "ipa"
    from_cache: bool       # Whether result came from cache
    error: Optional[str]   # Error message if failed
```

## Caching

Both romanization and phonetic transcription use MD5-based caching:

**Romanization cache location:**
```
{wwwroot}/pycore_db/romanization_cache/{src_lang}/{md5_hash}.json
```

**Phonetic cache location:**
```
{wwwroot}/pycore_db/phonetic_cache/{md5_hash}.json
```

**Clear cache:**
```python
from pycore.pyutils.translator import RomanizationCache, PhoneticCache

# Clear romanization cache
cache = RomanizationCache('zh-cn')
count = cache.clear()
print(f"Cleared {count} cache files")

# Clear phonetic cache
cache = PhoneticCache()
count = cache.clear()
print(f"Cleared {count} cache files")
```

## Examples

Run the examples file:
```bash
python pycore/pyutils/translator/examples_romanization_phonetic.py
```

## Language Codes for Romanization

Common language codes:
- `zh-cn`: Chinese (Simplified)
- `zh-tw`: Chinese (Traditional)
- `ja`: Japanese
- `ko`: Korean
- `ru`: Russian
- `ar`: Arabic
- `th`: Thai
- `hi`: Hindi
- `auto`: Auto-detect language

## IPA Notation

The IPA notation uses standard International Phonetic Alphabet symbols:
- Vowels: /i/, /ɪ/, /e/, /ɛ/, /æ/, /ɑ/, /ɔ/, /o/, /ʊ/, /u/, /ʌ/, /ɜ/, /ə/
- Consonants: /p/, /b/, /t/, /d/, /k/, /g/, /f/, /v/, /θ/, /ð/, /s/, /z/, /ʃ/, /ʒ/, /h/, /m/, /n/, /ŋ/, /l/, /r/, /w/, /j/
- Stress: /ˈ/ (primary), /ˌ/ (secondary)

## Limitations

### Romanization
- Requires internet connection (uses Google Translate API)
- Some languages may have limited romanization support
- Results depend on Google Translate's romanization algorithm

### IPA Transcription
- Only supports English text
- Works offline (no API required)
- Some proper nouns may not transcribe accurately
- Regional pronunciation variations not supported

## Integration with Translation

Both features can be used alongside the main translation functionality:

```python
from pycore.pyutils.translator import GoogleTranslator, romanize_text, text_to_ipa
import asyncio

async def example():
    # Translate
    async with GoogleTranslator() as translator:
        translation = await translator.translate_single("Hello", src="en", dest="zh-cn")
        print(f"Translation: {translation.translated_text}")

    # Romanize translation result
    romanization = await romanize_text(translation.translated_text, src="zh-cn")
    print(f"Romanized: {romanization['romanized_text']}")

    # IPA of original
    phonetic = text_to_ipa(translation.original_text)
    print(f"IPA: /{phonetic['phonetic_text']}/")

asyncio.run(example())
```

## References

- [International Phonetic Alphabet (IPA)](https://www.internationalphoneticalphabet.org/)
- [Romanization Systems](https://en.wikipedia.org/wiki/Romanization)
- [eng-to-ipa Library](https://pypi.org/project/eng-to-ipa/)
- [googletrans Library](https://py-googletrans.readthedocs.io/)
