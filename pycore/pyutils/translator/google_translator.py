#!/usr/bin/env python3

import asyncio
import json
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party.api import get_third_package_googletrans_Translator
from pycore.pyutils.common.model_boot import ThirdPartyServiceBlocked, third_party_block_reason
from pycore.pyutils.translator.google_batch_client import google_batch_client
from pycore.pyutils.translator.translation_cache import translation_cache

GOOGLE_TRANSLATE_SERVICE = "google"
GOOGLETRANS_LANGUAGE_ALIASES = {"zh": "zh-cn", "zh-hans": "zh-cn", "zh-hant": "zh-tw", "he": "iw"}


def googletrans_translator_class() -> Optional[Any]:
    """googletrans.Translator, resolved on first use; None when the package is unavailable."""
    try:
        return get_third_package_googletrans_Translator()
    except ImportError as import_error:
        ColorPrint.yellow(f"[GoogleTranslator] googletrans unavailable: {import_error}")
        return None


def googletrans_available() -> bool:
    return googletrans_translator_class() is not None


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

    def cache_payload(self) -> dict:
        return {
            'original_text': self.original_text,
            'translated_text': self.translated_text,
            'src_lang': self.src_lang,
            'dest_lang': self.dest_lang,
            'pronunciation': self.pronunciation,
        }

    @staticmethod
    def from_cache_payload(data: dict) -> 'TranslationResult':
        return TranslationResult(
            original_text=data['original_text'],
            translated_text=data['translated_text'],
            src_lang=data['src_lang'],
            dest_lang=data['dest_lang'],
            pronunciation=data.get('pronunciation'),
            from_cache=True,
        )

    @staticmethod
    def from_googletrans(translation: Any) -> 'TranslationResult':
        return TranslationResult(
            original_text=translation.origin,
            translated_text=translation.text,
            src_lang=translation.src,
            dest_lang=translation.dest,
            pronunciation=getattr(translation, 'pronunciation', None),
        )


class GoogleTranslator:
    """Google translation: keyless batch endpoint first, googletrans (gtx) for what it missed."""

    def __init__(self, service_urls: Optional[List[str]] = None):
        policy_reason = third_party_block_reason(GOOGLE_TRANSLATE_SERVICE)
        if policy_reason:
            raise ThirdPartyServiceBlocked(policy_reason)

        # Standard keyless Google Translate endpoint.
        self.service_urls = service_urls or [
            'translate.googleapis.com'
        ]
        self._translator = None

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self._translator:
            await self._translator.__aexit__(exc_type, exc_val, exc_tb)
            self._translator = None

    async def _googletrans(self) -> Optional[Any]:
        if self._translator is None:
            translator_class = googletrans_translator_class()
            if translator_class is None:
                return None
            self._translator = translator_class(service_urls=self.service_urls, raise_exception=True)
            await self._translator.__aenter__()
        return self._translator

    @staticmethod
    def googletrans_language(language: str) -> str:
        value = str(language or '').strip().lower().replace('_', '-')
        return GOOGLETRANS_LANGUAGE_ALIASES.get(value, value)

    async def translate_single(
        self,
        text: str,
        src: str = 'auto',
        dest: str = 'en',
        use_cache: bool = True
    ) -> TranslationResult:
        results = await self.translate_batch([text], src=src, dest=dest, use_cache=use_cache)
        return results[0]

    async def translate_batch(
        self,
        texts: List[str],
        src: str = 'auto',
        dest: str = 'en',
        use_cache: bool = True
    ) -> List[TranslationResult]:
        results: List[Optional[TranslationResult]] = []
        uncached_indices: List[int] = []
        for index, text in enumerate(texts):
            cached = translation_cache.get(text, src, dest) if use_cache else None
            results.append(TranslationResult.from_cache_payload(cached) if cached else None)
            if not cached:
                uncached_indices.append(index)
        if not uncached_indices:
            return results

        errors: Dict[int, str] = {}
        pending = list(uncached_indices)
        batch_pairs = await asyncio.to_thread(
            google_batch_client.translate, [texts[index] for index in pending], src, dest
        )
        still_pending: List[int] = []
        for index, (translated, detected) in zip(pending, batch_pairs):
            if translated:
                results[index] = TranslationResult(
                    original_text=texts[index], translated_text=translated,
                    src_lang=detected or src, dest_lang=dest,
                )
            else:
                still_pending.append(index)
        if still_pending:
            await self._translate_with_googletrans(texts, still_pending, src, dest, results, errors)

        for index in uncached_indices:
            result = results[index]
            if result is None:
                results[index] = TranslationResult(
                    original_text=texts[index], translated_text='', src_lang=src, dest_lang=dest,
                    error=errors.get(index) or 'google translate returned no result',
                )
            elif use_cache and result.translated_text and not result.error:
                translation_cache.set(texts[index], src, dest, result.cache_payload())
        return results

    async def _translate_with_googletrans(
        self,
        texts: List[str],
        indices: List[int],
        src: str,
        dest: str,
        results: List[Optional[TranslationResult]],
        errors: Dict[int, str],
    ) -> None:
        pending_texts = [texts[index] for index in indices]
        try:
            translator = await self._googletrans()
            if translator is None:
                raise ImportError('googletrans is not installed')
            translations = await translator.translate(
                pending_texts, src=self.googletrans_language(src), dest=self.googletrans_language(dest)
            )
        except Exception as exc:  # googletrans surfaces transport errors as arbitrary exceptions
            ColorPrint.yellow(f"[GoogleTranslator] googletrans failed src={src} dest={dest} count={len(pending_texts)}: {exc}")
            for index in indices:
                errors[index] = str(exc)
            return

        if not isinstance(translations, list):
            translations = [translations]
        for index, translation in zip(indices, translations):
            if translation.text:
                results[index] = TranslationResult.from_googletrans(translation)

    async def detect_language(self, text: str) -> Dict[str, Any]:
        try:
            translator = await self._googletrans()
            if translator is None:
                raise ImportError('googletrans is not installed')
            result = await translator.detect(text)
        except Exception as exc:  # googletrans surfaces transport errors as arbitrary exceptions
            ColorPrint.yellow(f"[GoogleTranslator] detect failed chars={len(text)}: {exc}")
            return {'language': 'unknown', 'confidence': 0.0, 'text': text, 'error': str(exc)}
        return {'language': result.lang, 'confidence': result.confidence, 'text': text}


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


__all__ = [
    'GoogleTranslator',
    'TranslationResult',
    'translate_from_dict',
    'translate_from_json_file',
]
