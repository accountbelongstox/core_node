# Google Translator - Usage Examples

## 1. Command-Line Usage

### Single Translation
```bash
python -m pycore.pyutils.translator \
    --text "Hello world" \
    --src en \
    --dest ko \
    --output result.json
```

**Output:**
```
================================================================================
Translation Results
================================================================================

[1] [FRESH] en -> ko
    Original: Hello world
    Translated: 안녕하세요 세계

================================================================================
Total: 1 | Success: 1 | From Cache: 0
================================================================================

✓ Results saved to: result.json
```

### Multiple Target Languages
```bash
python -m pycore.pyutils.translator \
    --text "Hello world" \
    --src en \
    --dest ko ja zh-cn \
    --output result.json
```

**Output:**
```
[1] [FRESH] en -> ko
    Original: Hello world
    Translated: 안녕하세요 세계

[2] [FRESH] en -> ja
    Original: Hello world
    Translated: こんにちは世界

[3] [FRESH] en -> zh-cn
    Original: Hello world
    Translated: 你好世界
```

### Batch Translation from JSON
Create a config file `config.json`:
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

Run translation:
```bash
python -m pycore.pyutils.translator \
    --config config.json \
    --output results.json
```

### Without Cache (Force Fresh Translation)
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

### Show Examples
```bash
python -m pycore.pyutils.translator --examples
```

---

## 2. Programmatic Usage

### Single Translation
```python
#!/usr/bin/env python3
import asyncio
from pycore.pyutils.translator import GoogleTranslator

async def main():
    async with GoogleTranslator() as translator:
        result = await translator.translate_single(
            text="Hello world",
            src="en",
            dest="ko"
        )
        print(f"Original: {result.original_text}")
        print(f"Translated: {result.translated_text}")
        print(f"From cache: {result.from_cache}")

asyncio.run(main())
```

### Batch Translation
```python
#!/usr/bin/env python3
import asyncio
from pycore.pyutils.translator import GoogleTranslator

async def main():
    texts = ["Hello", "World", "Python", "Programming"]
    
    async with GoogleTranslator() as translator:
        results = await translator.translate_batch(
            texts=texts,
            src="en",
            dest="ko"
        )
        
        for result in results:
            print(f"{result.original_text} -> {result.translated_text}")

asyncio.run(main())
```

**Output:**
```
Hello -> 안녕하세요
World -> 세계
Python -> 파이썬
Programming -> 프로그래밍
```

### Multiple Target Languages
```python
#!/usr/bin/env python3
import asyncio
from pycore.pyutils.translator import translate_from_dict

async def main():
    config = {
        "src": "en",
        "dest": ["ko", "ja", "zh-cn"],
        "texts": [
            "Hello",
            "Thank you"
        ]
    }
    
    results = await translate_from_dict(
        config,
        output_file="output.json",
        use_cache=True
    )
    
    for result in results:
        print(f"{result.src_lang} -> {result.dest_lang}")
        print(f"  {result.original_text} -> {result.translated_text}")

asyncio.run(main())
```

### JSON File Configuration
```python
#!/usr/bin/env python3
import asyncio
from pycore.pyutils.translator import translate_from_json_file

async def main():
    results = await translate_from_json_file(
        "config.json",
        output_file="results.json"
    )
    
    print(f"Translated {len(results)} texts")

asyncio.run(main())
```

### Language Detection
```python
#!/usr/bin/env python3
import asyncio
from pycore.pyutils.translator import GoogleTranslator

async def main():
    test_texts = [
        "Hello world",
        "안녕하세요",
        "こんにちは",
        "Bonjour",
        "你好"
    ]
    
    async with GoogleTranslator() as translator:
        for text in test_texts:
            result = await translator.detect_language(text)
            print(f"'{text}' -> {result['language']} (confidence: {result['confidence']:.2f})")

asyncio.run(main())
```

**Output:**
```
'Hello world' -> en (confidence: 0.76)
'안녕하세요' -> ko (confidence: 1.00)
'こんにちは' -> ja (confidence: 1.00)
'Bonjour' -> fr (confidence: 0.95)
'你好' -> zh-CN (confidence: 1.00)
```

### Cache Management
```python
from pycore.pyutils.translator import clear_cache

# Clear specific language pair
count = clear_cache('en', 'ko')
print(f"Cleared {count} cache entries for en -> ko")

# Clear all cache
count = clear_cache()
print(f"Cleared {count} total cache entries")
```

---

## 3. JSON Configuration Format

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

### Field Descriptions:
- `src`: Source language code (or "auto" for automatic detection)
- `dest`: Target language code(s) - can be a string or array
- `texts`: Text(s) to translate - can be a string or array

---

## 4. Cache System

### Cache Directory Structure
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

### Cache Key Generation
```python
import hashlib

def generate_cache_key(text, src, dest):
    content = f"{text}:{src}:{dest}"
    return hashlib.md5(content.encode('utf-8')).hexdigest()

# Example
cache_key = generate_cache_key("Hello", "en", "ko")
# Result: "5d41402abc4b2a76b9719d911017c592"
```

### Cache Entry Format
```json
{
  "original_text": "Hello world",
  "translated_text": "안녕하세요 세계",
  "src_lang": "en",
  "dest_lang": "ko",
  "pronunciation": "annyeonghaseyo segye"
}
```

---

## 5. Output File Format

When using `--output` or `output_file` parameter, results are saved in JSON format:

```json
[
  {
    "original_text": "Hello world",
    "translated_text": "안녕하세요 세계",
    "src_lang": "en",
    "dest_lang": "ko",
    "pronunciation": "annyeonghaseyo segye",
    "from_cache": false,
    "error": null
  },
  {
    "original_text": "Hello world",
    "translated_text": "こんにちは世界",
    "src_lang": "en",
    "dest_lang": "ja",
    "pronunciation": "kon'nichiwa sekai",
    "from_cache": false,
    "error": null
  }
]
```

---

## 6. Supported Languages

### Common Language Codes:
- `en` - English
- `ko` - Korean
- `ja` - Japanese
- `zh-cn` - Chinese (Simplified)
- `zh-tw` - Chinese (Traditional)
- `fr` - French
- `es` - Spanish
- `de` - German
- `it` - Italian
- `pt` - Portuguese
- `ru` - Russian
- `ar` - Arabic
- `th` - Thai
- `vi` - Vietnamese
- `nl` - Dutch
- `sv` - Swedish
- `pl` - Polish
- `tr` - Turkish
- `hi` - Hindi
- `id` - Indonesian

And many more...

---

## 7. Error Handling

### Translation Error
```python
async with GoogleTranslator() as translator:
    result = await translator.translate_single(
        text="",  # Empty text
        src="en",
        dest="ko"
    )
    
    if result.error:
        print(f"Error: {result.error}")
    else:
        print(f"Translated: {result.translated_text}")
```

### Network Error Handling
```python
try:
    async with GoogleTranslator() as translator:
        result = await translator.translate_single("Hello", "en", "ko")
except Exception as e:
    print(f"Network error: {e}")
```

---

## 8. Performance Tips

1. **Use Batch Translation**: Translate multiple texts in one call for better performance
   ```python
   # Good: Batch translation
   results = await translator.translate_batch(texts, src="en", dest="ko")
   
   # Bad: Multiple single translations
   for text in texts:
       result = await translator.translate_single(text, src="en", dest="ko")
   ```

2. **Enable Cache**: Cache significantly speeds up repeated translations
   ```python
   # With cache (default)
   results = await translate_from_dict(config, use_cache=True)
   
   # Without cache
   results = await translate_from_dict(config, use_cache=False)
   ```

3. **Reuse Translator Instance**: Use context manager to reuse connections
   ```python
   # Good: Reuse connection
   async with GoogleTranslator() as translator:
       result1 = await translator.translate_single("Hello", "en", "ko")
       result2 = await translator.translate_single("World", "en", "ko")
   ```

---

## 9. Integration Examples

### Flask Web API
```python
from flask import Flask, request, jsonify
import asyncio
from pycore.pyutils.translator import GoogleTranslator

app = Flask(__name__)

@app.route('/translate', methods=['POST'])
def translate():
    data = request.json
    text = data.get('text')
    src = data.get('src', 'auto')
    dest = data.get('dest', 'en')
    
    async def do_translate():
        async with GoogleTranslator() as translator:
            return await translator.translate_single(text, src, dest)
    
    result = asyncio.run(do_translate())
    return jsonify(result.to_dict())

if __name__ == '__main__':
    app.run(debug=True)
```

### FastAPI Async API
```python
from fastapi import FastAPI
from pycore.pyutils.translator import GoogleTranslator

app = FastAPI()

@app.post("/translate")
async def translate(text: str, src: str = "auto", dest: str = "en"):
    async with GoogleTranslator() as translator:
        result = await translator.translate_single(text, src, dest)
        return result.to_dict()
```

---

## 10. Troubleshooting

### Issue: googletrans not installed
```bash
pip install googletrans
```

### Issue: Slow first translation
**Cause**: No cache available
**Solution**: Wait for first translation, subsequent calls will be cached

### Issue: Translation failed
**Possible causes**:
1. Network connectivity issues
2. Google Translate API blocked your IP
3. Invalid language codes

**Solutions**:
1. Check network connection
2. Use proxy or VPN
3. Verify language codes are correct

### Issue: Cache not working
**Check**:
1. Cache directory exists and is writable
2. `use_cache=True` is set
3. Text, src, and dest are identical for cache hit
