#!/usr/bin/env python3

from pycore.pyfoundations.third_party import (
"""
Romanization Module

Provides romanization (transliteration to Latin script) functionality
for various languages using Google Translate API.

Romanization converts non-Latin scripts to Latin characters while preserving
pronunciation. For example:
- Chinese: 你好 → nǐ hǎo
- Japanese: こんにちは → konnichiwa
- Korean: 안녕하세요 → annyeonghaseyo
- Russian: Привет → Privet
- Arabic: مرحبا → marhaban
"""

import asyncio
import hashlib
from pathlib import Path
from typing import Optional, List, Dict
from dataclasses import dataclass, asdict

from pycore.pyfoundations.system_paths import map_web_path

try:
        get_third_package_googletrans_Translator,
    )
    Translator = get_third_package_googletrans_Translator()
    GOOGLETRANS_AVAILABLE = True
except ImportError:
    GOOGLETRANS_AVAILABLE = False
    Translator = None

import json



@dataclass
class RomanizationResult:
    """Result of romanization operation"""
    original_text: str
    romanized_text: str
    src_lang: str
    from_cache: bool = False
    error: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


class RomanizationCache:
    """Cache for romanization results"""

    def __init__(self, src_lang: str):
        self.src_lang = src_lang
        self.cache_dir = self._get_cache_dir()
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def _get_cache_dir(self) -> Path:
        base_cache = map_web_path('pycore_db') / 'romanization_cache'
        namespace_dir = base_cache / self.src_lang
        return namespace_dir

    def _get_cache_key(self, text: str) -> str:
        content = f"{text}:{self.src_lang}"
        return hashlib.md5(content.encode('utf-8')).hexdigest()

    def get(self, text: str) -> Optional[dict]:
        cache_key = self._get_cache_key(text)
        cache_file = self.cache_dir / f"{cache_key}.json"
        if cache_file.exists():
            try:
                with open(cache_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                return None
        return None

    def set(self, text: str, data: dict) -> None:
        cache_key = self._get_cache_key(text)
        cache_file = self.cache_dir / f"{cache_key}.json"
        try:
            with open(cache_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

    def clear(self) -> int:
        count = 0
        if self.cache_dir.exists():
            for cache_file in self.cache_dir.glob('*.json'):
                try:
                    cache_file.unlink()
                    count += 1
                except Exception:
                    pass
        return count


class Romanizer:
    """
    Romanization utility using Google Translate API

    Converts non-Latin text to Latin script (romanization/transliteration).
    """

    def __init__(self, service_urls: Optional[List[str]] = None):
        if not GOOGLETRANS_AVAILABLE:
            raise ImportError("googletrans is not installed. Install it with: pip install googletrans")

        self.service_urls = service_urls or ['translate.googleapis.com']
        self._translator = None

    async def __aenter__(self):
        self._translator = Translator(service_urls=self.service_urls)
        await self._translator.__aenter__()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self._translator:
            await self._translator.__aexit__(exc_type, exc_val, exc_tb)

    async def romanize(
        self,
        text: str,
        src: str = 'auto',
        use_cache: bool = True
    ) -> RomanizationResult:
        """
        Romanize text from source language

        Args:
            text: Text to romanize
            src: Source language code (e.g., 'zh-cn', 'ja', 'ko', 'ru', 'ar')
                 Use 'auto' for automatic detection
            use_cache: Whether to use cache

        Returns:
            RomanizationResult with original and romanized text
        """
        if use_cache:
            cache = RomanizationCache(src)
            cached_data = cache.get(text)
            if cached_data:
                return RomanizationResult(
                    original_text=cached_data['original_text'],
                    romanized_text=cached_data['romanized_text'],
                    src_lang=cached_data['src_lang'],
                    from_cache=True
                )

        result = await self._translator.translate(text, src=src, dest='en')

        romanized = result.pronunciation if hasattr(result, 'pronunciation') and result.pronunciation else result.text

        romanization_result = RomanizationResult(
            original_text=result.origin,
            romanized_text=romanized,
            src_lang=result.src,
            from_cache=False
        )

        if use_cache:
            cache = RomanizationCache(result.src)
            cache.set(text, romanization_result.to_dict())

        return romanization_result

    async def romanize_batch(
        self,
        texts: List[str],
        src: str = 'auto',
        use_cache: bool = True
    ) -> List[RomanizationResult]:
        """
        Romanize multiple texts

        Args:
            texts: List of texts to romanize
            src: Source language code
            use_cache: Whether to use cache

        Returns:
            List of RomanizationResult objects
        """
        tasks = [self.romanize(text, src, use_cache) for text in texts]
        return await asyncio.gather(*tasks)


async def romanize_text(
    text: str,
    src: str = 'auto',
    use_cache: bool = True
) -> Dict:
    """
    Helper function to romanize text

    Args:
        text: Text to romanize
        src: Source language code
        use_cache: Whether to use cache

    Returns:
        Dictionary with romanization result
    """
    async with Romanizer() as romanizer:
        result = await romanizer.romanize(text, src, use_cache)
        return result.to_dict()


async def romanize_batch(
    texts: List[str],
    src: str = 'auto',
    use_cache: bool = True
) -> List[Dict]:
    """
    Helper function to romanize multiple texts

    Args:
        texts: List of texts to romanize
        src: Source language code
        use_cache: Whether to use cache

    Returns:
        List of romanization result dictionaries
    """
    async with Romanizer() as romanizer:
        results = await romanizer.romanize_batch(texts, src, use_cache)
        return [r.to_dict() for r in results]


__all__ = [
    'Romanizer',
    'RomanizationResult',
    'RomanizationCache',
    'romanize_text',
    'romanize_batch',
]
