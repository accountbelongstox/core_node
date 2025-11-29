#!/usr/bin/env python3

"""
Phonetic Transcription Module

Provides IPA (International Phonetic Alphabet) transcription for English text.

Converts English words and sentences to IPA phonetic notation, which represents
the actual pronunciation of the text.

Examples:
- hello → /həˈloʊ/
- world → /wɜrld/
- How are you? → /haʊ ɑr ju/
"""

import hashlib
from pathlib import Path
from typing import Optional, List, Dict
from dataclasses import dataclass, asdict

from pycore.pyfoundations.system_paths import map_web_path

try:
    from pycore.pyfoundations.third_party import get_third_package_eng_to_ipa
    eng_to_ipa_module = get_third_package_eng_to_ipa()
    IPA_AVAILABLE = True
except ImportError:
    IPA_AVAILABLE = False
    eng_to_ipa_module = None


@dataclass
class PhoneticResult:
    """Result of phonetic transcription"""
    original_text: str
    phonetic_text: str
    notation: str = "ipa"  # IPA notation
    from_cache: bool = False
    error: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


class PhoneticCache:
    """Cache for phonetic transcription results"""

    def __init__(self):
        self.cache_dir = self._get_cache_dir()
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def _get_cache_dir(self) -> Path:
        base_cache = map_web_path('pycore_db') / 'phonetic_cache'
        return base_cache

    def _get_cache_key(self, text: str, preserve_punctuation: bool) -> str:
        content = f"{text}:preserve_{preserve_punctuation}"
        return hashlib.md5(content.encode('utf-8')).hexdigest()

    def get(self, text: str, preserve_punctuation: bool) -> Optional[dict]:
        cache_key = self._get_cache_key(text, preserve_punctuation)
        cache_file = self.cache_dir / f"{cache_key}.json"
        if cache_file.exists():
            try:
                import json
                with open(cache_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                return None
        return None

    def set(self, text: str, preserve_punctuation: bool, data: dict) -> None:
        cache_key = self._get_cache_key(text, preserve_punctuation)
        cache_file = self.cache_dir / f"{cache_key}.json"
        try:
            import json
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


class PhoneticTranscriber:
    """
    IPA phonetic transcription utility for English text

    Converts English words and sentences to IPA (International Phonetic Alphabet)
    notation, which represents pronunciation.
    """

    def __init__(self):
        if not IPA_AVAILABLE:
            raise ImportError("eng_to_ipa is not installed. Install it with: pip install eng-to-ipa")

        self.cache = PhoneticCache()

    def transcribe(
        self,
        text: str,
        preserve_punctuation: bool = True,
        use_cache: bool = True
    ) -> PhoneticResult:
        """
        Convert English text to IPA phonetic notation

        Args:
            text: English text to transcribe
            preserve_punctuation: Whether to keep punctuation in output
            use_cache: Whether to use cache

        Returns:
            PhoneticResult with original and phonetic text

        Examples:
            >>> transcriber = PhoneticTranscriber()
            >>> result = transcriber.transcribe("hello world")
            >>> print(result.phonetic_text)
            həˈloʊ wɜrld
        """
        if use_cache:
            cached_data = self.cache.get(text, preserve_punctuation)
            if cached_data:
                return PhoneticResult(
                    original_text=cached_data['original_text'],
                    phonetic_text=cached_data['phonetic_text'],
                    notation=cached_data['notation'],
                    from_cache=True
                )

        phonetic_text = eng_to_ipa_module.convert(text, keep_punct=preserve_punctuation)

        result = PhoneticResult(
            original_text=text,
            phonetic_text=phonetic_text,
            notation="ipa",
            from_cache=False
        )

        if use_cache:
            self.cache.set(text, preserve_punctuation, result.to_dict())

        return result

    def transcribe_word(
        self,
        word: str,
        use_cache: bool = True
    ) -> PhoneticResult:
        """
        Convert a single English word to IPA

        Args:
            word: English word to transcribe
            use_cache: Whether to use cache

        Returns:
            PhoneticResult with phonetic transcription
        """
        return self.transcribe(word, preserve_punctuation=False, use_cache=use_cache)

    def transcribe_batch(
        self,
        texts: List[str],
        preserve_punctuation: bool = True,
        use_cache: bool = True
    ) -> List[PhoneticResult]:
        """
        Convert multiple texts to IPA

        Args:
            texts: List of English texts to transcribe
            preserve_punctuation: Whether to keep punctuation
            use_cache: Whether to use cache

        Returns:
            List of PhoneticResult objects
        """
        return [self.transcribe(text, preserve_punctuation, use_cache) for text in texts]

    def transcribe_words(
        self,
        words: List[str],
        use_cache: bool = True
    ) -> List[PhoneticResult]:
        """
        Convert multiple words to IPA

        Args:
            words: List of English words to transcribe
            use_cache: Whether to use cache

        Returns:
            List of PhoneticResult objects
        """
        return [self.transcribe_word(word, use_cache) for word in words]


def text_to_ipa(
    text: str,
    preserve_punctuation: bool = True,
    use_cache: bool = True
) -> Dict:
    """
    Helper function to convert text to IPA

    Args:
        text: English text to transcribe
        preserve_punctuation: Whether to keep punctuation
        use_cache: Whether to use cache

    Returns:
        Dictionary with phonetic transcription result
    """
    transcriber = PhoneticTranscriber()
    result = transcriber.transcribe(text, preserve_punctuation, use_cache)
    return result.to_dict()


def word_to_ipa(
    word: str,
    use_cache: bool = True
) -> Dict:
    """
    Helper function to convert word to IPA

    Args:
        word: English word to transcribe
        use_cache: Whether to use cache

    Returns:
        Dictionary with phonetic transcription result
    """
    transcriber = PhoneticTranscriber()
    result = transcriber.transcribe_word(word, use_cache)
    return result.to_dict()


def batch_to_ipa(
    texts: List[str],
    preserve_punctuation: bool = True,
    use_cache: bool = True
) -> List[Dict]:
    """
    Helper function to convert multiple texts to IPA

    Args:
        texts: List of English texts to transcribe
        preserve_punctuation: Whether to keep punctuation
        use_cache: Whether to use cache

    Returns:
        List of phonetic transcription result dictionaries
    """
    transcriber = PhoneticTranscriber()
    results = transcriber.transcribe_batch(texts, preserve_punctuation, use_cache)
    return [r.to_dict() for r in results]


__all__ = [
    'PhoneticTranscriber',
    'PhoneticResult',
    'PhoneticCache',
    'text_to_ipa',
    'word_to_ipa',
    'batch_to_ipa',
]
