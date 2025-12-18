# -*- coding: utf-8 -*-
"""
Voice Subtitle Processor

Processes different types of input (text, image, voice) and generates
TTS audio with caching.
"""

import asyncio
import hashlib
from pathlib import Path
from typing import Optional, List, Dict

from pycore import ColorPrint
from pycore.pyfoundations.system_paths import APP_CACHE_DIR
from pycore.pyctl.desktop import get_voice_subtitle_queue
from pycore.pyutils.edge_tts import get_edge_tts_client
from pycore.pyutils.translator import GoogleTranslator
from pycore.pyutils.gemini import gemini_manager
from pycore.pyutils.common.tts_models import clean_tts_text


# ============================================================
# TTS Cache Manager
# ============================================================

class TTSCacheManager:
    """
    TTS cache manager

    Caches TTS audio by paragraph to avoid regenerating.
    Cache key: md5(text + language + voice)
    """

    def __init__(self):
        """Initialize TTS cache manager"""
        self._cache_dir = APP_CACHE_DIR / 'voice_subtitle_tts'
        self._cache_dir.mkdir(parents=True, exist_ok=True)

    def _get_cache_key(self, text: str, lang: str, voice: str) -> str:
        """
        Generate cache key

        Args:
            text: Text content
            lang: Language code
            voice: Voice name

        Returns:
            str: MD5 hash
        """
        # Clean text before MD5 (remove asterisks, etc.)
        cleaned_text = clean_tts_text(text)
        content = f"{cleaned_text}|{lang}|{voice}"
        return hashlib.md5(content.encode('utf-8')).hexdigest()

    def get_cache_path(self, text: str, lang: str, voice: str) -> Path:
        """
        Get cache file path

        Args:
            text: Text content
            lang: Language code
            voice: Voice name

        Returns:
            Path: Cache file path
        """
        cache_key = self._get_cache_key(text, lang, voice)
        return self._cache_dir / f"{cache_key}.mp3"

    def has_cache(self, text: str, lang: str, voice: str) -> bool:
        """Check if cache exists"""
        cache_path = self.get_cache_path(text, lang, voice)
        return cache_path.exists()

    def save_cache(self, text: str, lang: str, voice: str, audio_data: bytes) -> Path:
        """
        Save TTS audio to cache

        Args:
            text: Text content
            lang: Language code
            voice: Voice name
            audio_data: Audio bytes

        Returns:
            Path: Cache file path
        """
        cache_path = self.get_cache_path(text, lang, voice)
        with open(cache_path, 'wb') as f:
            f.write(audio_data)
        return cache_path


# Global TTS cache manager
_tts_cache_manager = TTSCacheManager()


# ============================================================
# TTS Generation
# ============================================================

async def generate_tts_for_paragraph(text: str, lang: str) -> Optional[Path]:
    """
    Generate TTS for a single paragraph with caching

    Args:
        text: Paragraph text
        lang: Language code (e.g., 'en', 'zh')

    Returns:
        Optional[Path]: Path to audio file or None on error
    """
    # Clean text before processing (remove asterisks, etc.)
    cleaned_text = clean_tts_text(text)

    # Voice mapping
    voice_map = {
        'en': 'en-US-AriaNeural',
        'zh': 'zh-CN-XiaoxiaoNeural',
        'ja': 'ja-JP-NanamiNeural',
        'ko': 'ko-KR-SunHiNeural',
    }

    voice = voice_map.get(lang, 'en-US-AriaNeural')

    # Check cache (using cleaned text)
    if _tts_cache_manager.has_cache(cleaned_text, lang, voice):
        ColorPrint.blue(f"[TTS] Using cached audio for: {cleaned_text[:50]}...")
        return _tts_cache_manager.get_cache_path(cleaned_text, lang, voice)

    # Generate TTS (using cleaned text)
    ColorPrint.blue(f"[TTS] Generating audio for ({lang}): {cleaned_text[:50]}...")

    edge_tts_client = get_edge_tts_client()
    cache_path = _tts_cache_manager.get_cache_path(cleaned_text, lang, voice)

    # Ensure cache directory exists
    cache_path.parent.mkdir(parents=True, exist_ok=True)

    # Synthesize with cleaned text (run sync function in thread pool)
    success = await asyncio.to_thread(
        edge_tts_client.synthesize,
        text=cleaned_text,  # Use cleaned text for TTS
        voice=voice,
        output_path=cache_path
    )

    if success and cache_path.exists():
        ColorPrint.green(f"[TTS] Audio generated and cached: {cache_path.name}")
        return cache_path
    else:
        ColorPrint.red(f"[TTS] Failed to generate audio")
        return None


async def generate_tts_for_text(text: str, lang: str) -> List[Dict]:
    """
    Generate TTS for text (split by paragraphs)

    Args:
        text: Full text
        lang: Language code

    Returns:
        List[Dict]: List of {text, audio_path} for each paragraph
    """
    # Split by newlines to get paragraphs
    paragraphs = [p.strip() for p in text.split('\n') if p.strip()]

    results = []
    for paragraph in paragraphs:
        # Clean text before processing
        cleaned_paragraph = clean_tts_text(paragraph)

        audio_path = await generate_tts_for_paragraph(paragraph, lang)
        if audio_path:
            results.append({
                'text': cleaned_paragraph,  # Use cleaned text for display consistency
                'audio_path': str(audio_path)
            })

    return results


# ============================================================
# Text Processing
# ============================================================

async def process_text_input(text: str, langs: List[str], category: str = "normal") -> Dict:
    """
    Process text input

    Steps:
    1. Translate to all target languages
    2. Generate TTS for each language
    3. Add to queue

    Args:
        text: Input text
        langs: Target languages
        category: Queue item category (default: "normal")

    Returns:
        Dict: {success, added_count, items_added, error}
    """
    ColorPrint.green(f"[Processor] ========== Starting text processing ==========")
    ColorPrint.blue(f"[Processor] Input text: {text[:100]}...")
    ColorPrint.blue(f"[Processor] Target languages: {langs}")
    ColorPrint.blue(f"[Processor] Category: {category}")

    items_added = []
    total_items_count = 0

    async with GoogleTranslator() as translator:
        for lang_index, lang in enumerate(langs, 1):
            ColorPrint.cyan(f"[Processor] [{lang_index}/{len(langs)}] Processing language: {lang}")

            # Translate
            ColorPrint.blue(f"[Processor] Translating to {lang}...")
            translate_result = await translator.translate_single(
                text=text,
                src='auto',
                dest=lang
            )

            translated_text = translate_result.translated_text
            ColorPrint.green(f"[Processor] ✓ Translation: {translated_text[:80]}...")

            # Generate TTS
            ColorPrint.blue(f"[Processor] Generating TTS for {lang}...")
            tts_results = await generate_tts_for_text(translated_text, lang)
            ColorPrint.green(f"[Processor] ✓ Generated {len(tts_results)} TTS audio(s)")

            # Add to queue
            queue = get_voice_subtitle_queue()
            for item_index, item in enumerate(tts_results, 1):
                queue.add_item(text=item['text'], audio_path=item['audio_path'], category=category)
                total_items_count += 1
                ColorPrint.green(f"[Processor] ✓ Added [{item_index}/{len(tts_results)}]: {item['text'][:50]}...")
                items_added.append({
                    'lang': lang,
                    'text': item['text'],
                    'audio_path': item['audio_path'],
                    'category': category
                })

    ColorPrint.green(f"[Processor] ========== Processing completed ==========")
    ColorPrint.green(f"[Processor] Total items added: {total_items_count}")

    return {
        'success': True,
        'added_count': total_items_count,
        'items_added': items_added
    }


# ============================================================
# Image Processing
# ============================================================

async def process_image_input(
    image_path: Optional[str] = None,
    image_url: Optional[str] = None,
    image_base64: Optional[str] = None,
    langs: List[str] = ["en"],
    category: str = "normal"
) -> Dict:
    """
    Process image input

    Steps:
    1. Summarize image with Gemini
    2. Translate to all target languages
    3. Generate TTS for each language
    4. Add to queue

    Args:
        image_path: Path to image file
        image_url: URL to image
        image_base64: Base64 encoded image
        langs: Target languages
        category: Queue item category (default: "normal")

    Returns:
        Dict: {success, items_added, error}
    """
    ColorPrint.blue("[VoiceSubtitle] Processing image input...")

    # Step 1: Summarize image with Gemini
    ColorPrint.blue("[VoiceSubtitle] Summarizing image with Gemini...")

    if image_path:
        gemini_result = gemini_manager.summarize_image(
            image_path=image_path,
            detail_level="medium"
        )
    else:
        return {
            'success': False,
            'error': "Only image_path is currently supported"
        }

    if not gemini_result.get('success'):
        return {
            'success': False,
            'error': f"Gemini image summarization failed: {gemini_result.get('error')}"
        }

    summarized_text = gemini_result.get('summary', '')
    if not summarized_text:
        return {
            'success': False,
            'error': "Gemini returned empty summary"
        }

    ColorPrint.green(f"[VoiceSubtitle] Gemini summary: {summarized_text[:100]}...")

    # Step 2-4: Process as text (translate + TTS + add to queue)
    return await process_text_input(summarized_text, langs, category)
