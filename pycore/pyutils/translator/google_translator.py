#!/usr/bin/env python3

import asyncio
import hashlib
import json
import os
import threading
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.system_paths import map_web_path
from pycore.pyfoundations.third_party import get_third_package_googletrans_Translator

try:
    Translator = get_third_package_googletrans_Translator()
    GOOGLETRANS_AVAILABLE = True
except ImportError:
    GOOGLETRANS_AVAILABLE = False
    Translator = None


@dataclass
class TranslationTask:
    text: str
    src: str
    dest: str
    
    def cache_key(self) -> str:
        content = f"{self.text}:{self.src}:{self.dest}"
        return hashlib.md5(content.encode('utf-8')).hexdigest()


@dataclass
class TranslationResult:
    original_text: str
    translated_text: str
    src_lang: str
    dest_lang: str
    pronunciation: Optional[str] = None
    from_cache: bool = False
    error: Optional[str] = None
    
    def to_dict(self) -> dict:
        return asdict(self)


class GoogleTranslatorCache:
    def __init__(self, src_lang: str, dest_lang: str):
        self.src_lang = src_lang
        self.dest_lang = dest_lang
        self.cache_dir = self._get_cache_dir()
        self.cache_dir.mkdir(parents=True, exist_ok=True)
    
    def _get_cache_dir(self) -> Path:
        base_cache = map_web_path('pycore_db') / 'translator_cache'
        namespace_dir = base_cache / f"{self.src_lang}_to_{self.dest_lang}"
        return namespace_dir
    
    def get(self, cache_key: str) -> Optional[dict]:
        cache_file = self.cache_dir / f"{cache_key}.json"
        if cache_file.exists():
            try:
                with open(cache_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                return None
        return None
    
    def set(self, cache_key: str, data: dict) -> None:
        cache_file = self.cache_dir / f"{cache_key}.json"
        temp_file = cache_file.with_suffix(
            f".{os.getpid()}.{threading.get_ident()}.tmp"
        )
        try:
            with open(temp_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            os.replace(temp_file, cache_file)
        except Exception:
            temp_file.unlink(missing_ok=True)
    
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


class GoogleTranslator:
    def __init__(self, service_urls: Optional[List[str]] = None):
        if not GOOGLETRANS_AVAILABLE:
            raise ImportError("googletrans is not installed. Install it with: pip install googletrans")

        # Standard keyless Google Translate endpoint.
        self.service_urls = service_urls or [
            'translate.googleapis.com'
        ]
        self._translator = None
    
    async def __aenter__(self):
        self._translator = Translator(service_urls=self.service_urls)
        await self._translator.__aenter__()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self._translator:
            await self._translator.__aexit__(exc_type, exc_val, exc_tb)
    
    async def translate_single(
        self,
        text: str,
        src: str = 'auto',
        dest: str = 'en',
        use_cache: bool = True
    ) -> TranslationResult:
        task = TranslationTask(text=text, src=src, dest=dest)
        cache_key = task.cache_key()
        
        if use_cache:
            cache = GoogleTranslatorCache(src, dest)
            cached_data = cache.get(cache_key)
            if cached_data:
                return TranslationResult(
                    original_text=cached_data['original_text'],
                    translated_text=cached_data['translated_text'],
                    src_lang=cached_data['src_lang'],
                    dest_lang=cached_data['dest_lang'],
                    pronunciation=cached_data.get('pronunciation'),
                    from_cache=True
                )
        
        try:
            result = await self._translator.translate(text, src=src, dest=dest)
            
            translation_result = TranslationResult(
                original_text=result.origin,
                translated_text=result.text,
                src_lang=result.src,
                dest_lang=result.dest,
                pronunciation=result.pronunciation if hasattr(result, 'pronunciation') else None,
                from_cache=False
            )
            
            if use_cache:
                cache.set(cache_key, {
                    'original_text': translation_result.original_text,
                    'translated_text': translation_result.translated_text,
                    'src_lang': translation_result.src_lang,
                    'dest_lang': translation_result.dest_lang,
                    'pronunciation': translation_result.pronunciation
                })
            
            return translation_result
            
        except Exception as e:
            return TranslationResult(
                original_text=text,
                translated_text='',
                src_lang=src,
                dest_lang=dest,
                error=str(e)
            )
    
    async def translate_batch(
        self,
        texts: List[str],
        src: str = 'auto',
        dest: str = 'en',
        use_cache: bool = True
    ) -> List[TranslationResult]:
        results = []
        cache = GoogleTranslatorCache(src, dest) if use_cache else None
        
        uncached_texts = []
        uncached_indices = []
        
        for i, text in enumerate(texts):
            task = TranslationTask(text=text, src=src, dest=dest)
            cache_key = task.cache_key()
            
            if use_cache and cache:
                cached_data = cache.get(cache_key)
                if cached_data:
                    results.append(TranslationResult(
                        original_text=cached_data['original_text'],
                        translated_text=cached_data['translated_text'],
                        src_lang=cached_data['src_lang'],
                        dest_lang=cached_data['dest_lang'],
                        pronunciation=cached_data.get('pronunciation'),
                        from_cache=True
                    ))
                    continue
            
            uncached_texts.append(text)
            uncached_indices.append(i)
            results.append(None)
        
        if uncached_texts:
            try:
                translations = await self._translator.translate(uncached_texts, src=src, dest=dest)
                
                for idx, translation in zip(uncached_indices, translations):
                    translation_result = TranslationResult(
                        original_text=translation.origin,
                        translated_text=translation.text,
                        src_lang=translation.src,
                        dest_lang=translation.dest,
                        pronunciation=translation.pronunciation if hasattr(translation, 'pronunciation') else None,
                        from_cache=False
                    )
                    
                    results[idx] = translation_result
                    
                    if use_cache and cache:
                        task = TranslationTask(text=translation.origin, src=src, dest=dest)
                        cache_key = task.cache_key()
                        cache.set(cache_key, {
                            'original_text': translation_result.original_text,
                            'translated_text': translation_result.translated_text,
                            'src_lang': translation_result.src_lang,
                            'dest_lang': translation_result.dest_lang,
                            'pronunciation': translation_result.pronunciation
                        })
                        
            except Exception as e:
                for idx in uncached_indices:
                    if results[idx] is None:
                        results[idx] = TranslationResult(
                            original_text=texts[idx],
                            translated_text='',
                            src_lang=src,
                            dest_lang=dest,
                            error=str(e)
                        )
        
        return results
    
    async def detect_language(self, text: str) -> Dict[str, Any]:
        try:
            result = await self._translator.detect(text)
            return {
                'language': result.lang,
                'confidence': result.confidence,
                'text': text
            }
        except Exception as e:
            return {
                'language': 'unknown',
                'confidence': 0.0,
                'text': text,
                'error': str(e)
            }


async def translate_from_dict(
    config: Dict[str, Any],
    output_file: Optional[str] = None,
    use_cache: bool = True
) -> List[TranslationResult]:
    src = config.get('src', 'auto')
    dest_langs = config.get('dest', ['en'])
    if isinstance(dest_langs, str):
        dest_langs = [dest_langs]
    
    texts = config.get('texts', [])
    if isinstance(texts, str):
        texts = [texts]
    
    all_results = []
    
    for dest in dest_langs:
        async with GoogleTranslator() as translator:
            results = await translator.translate_batch(texts, src=src, dest=dest, use_cache=use_cache)
            all_results.extend(results)
    
    if output_file:
        output_path = Path(output_file)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump([r.to_dict() for r in all_results], f, ensure_ascii=False, indent=2)
    
    return all_results


async def translate_from_json_file(
    json_file: str,
    output_file: Optional[str] = None,
    use_cache: bool = True
) -> List[TranslationResult]:
    with open(json_file, 'r', encoding='utf-8') as f:
        config = json.load(f)
    
    return await translate_from_dict(config, output_file, use_cache)


def clear_cache(src_lang: str = None, dest_lang: str = None) -> int:
    if src_lang and dest_lang:
        cache = GoogleTranslatorCache(src_lang, dest_lang)
        return cache.clear()
    else:
        base_cache = map_web_path('pycore_db') / 'translator_cache'
        count = 0
        if base_cache.exists():
            for namespace_dir in base_cache.iterdir():
                if namespace_dir.is_dir():
                    for cache_file in namespace_dir.glob('*.json'):
                        try:
                            cache_file.unlink()
                            count += 1
                        except Exception:
                            pass
        return count


__all__ = [
    'GoogleTranslator',
    'GoogleTranslatorCache',
    'TranslationTask',
    'TranslationResult',
    'translate_from_dict',
    'translate_from_json_file',
    'clear_cache',
]
