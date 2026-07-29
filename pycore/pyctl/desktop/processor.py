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

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import await_bus_task
from pycore.pyfoundations.system_paths import APP_CACHE_DIR
from pycore.pyctl.desktop.queue_manager import get_voice_subtitle_queue
from pycore.pyctl.desktop.ai_hooks import ai_describe_image
from pycore.pyutils.ocr_cluster.ocr.ocr_orchestrator import extract_text as ocr_extract_text
from pycore.pyutils.tts.tts_orchestrator import synthesize as tts_synthesize
from pycore.pyutils.translator.google_translator import GoogleTranslator
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

    cache_path = _tts_cache_manager.get_cache_path(cleaned_text, lang, voice)

    # Ensure cache directory exists
    cache_path.parent.mkdir(parents=True, exist_ok=True)

    # Synthesize via the multi-engine orchestrator (by priority: edge -> sherpa
    # -> melotts -> gptsovits). edge-tts is serialized + rate-aware internally;
    # rate=None uses EDGE_TTS_RATE / the -20% default. Run the blocking call in a
    # thread so the event loop stays free.
    result = await await_bus_task(
        tts_synthesize,
        cleaned_text,   # text
        lang,
        cache_path,     # output_path (.mp3)
    )

    if result.get("success") and cache_path.exists():
        ColorPrint.green(
            f"[TTS] Audio generated via {result.get('engine')} and cached: {cache_path.name}")
        return cache_path
    else:
        ColorPrint.red(f"[TTS] Failed to generate audio ({result.get('error')})")
        return None


def _is_speakable(text: str) -> bool:
    """
    True if the text has at least one pronounceable character (letter / digit /
    CJK). Pure punctuation/symbol lines ("×", "+", ".", "X") make edge-tts return
    "No audio was received" — they are skipped instead of attempted.
    """
    for ch in (text or ""):
        if ch.isalnum():
            return True
        # CJK / Hiragana / Katakana / Hangul ranges.
        o = ord(ch)
        if (0x3040 <= o <= 0x30FF) or (0x3400 <= o <= 0x9FFF) or (0xAC00 <= o <= 0xD7A3):
            return True
    return False


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

        # Skip lines with nothing to say (pure punctuation/symbols) — they only
        # produce "No audio was received" and clutter the queue.
        if not _is_speakable(cleaned_paragraph):
            ColorPrint.gray(f"[TTS] Skipping non-speakable segment: {paragraph[:30]!r}")
            continue

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

async def process_text_input(text: str, langs: List[str], category: str = "normal",
                             ai_provider: str = "", ai_model: str = "") -> Dict:
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
        ai_provider: AI that produced ``text`` ("" = plain user input) — stored
                     on the queue items so the UI can attribute the task
        ai_model: model id used by that provider

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
                queue.add_item(text=item['text'], audio_path=item['audio_path'], category=category,
                               ai_provider=ai_provider, ai_model=ai_model)
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
    Process image input (the full-screen auto-subtitle path).

    Flow — OCR FIRST, AI second:
    1. OCR the screenshot with the best available LOCAL engine
       (windows -> easyocr -> cnocr). The screen is mostly text, so we want the
       on-screen text verbatim, and a local engine works with no AI quota.
    2. If no local OCR engine produced text, fall back to AI-VISION OCR: ask a
       vision provider (via the gateway) to TRANSCRIBE the visible text. This is
       the last resort and keeps working when no local engine is installed.
    3. Translate the extracted text to all target languages.
    4. Generate TTS for each language and add to the queue.

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

    if not image_path:
        return {
            'success': False,
            'error': "Only image_path is currently supported"
        }

    # The recognition language drives BOTH the OCR model and the output: the
    # first target language is the single unified parameter from the UI.
    ocr_lang = (langs or ['en'])[0]

    # Step 1: local OCR (windows -> easyocr -> cnocr; skips unavailable engines).
    # Run OFF the event loop: the screenshot pipeline already runs inside
    # asyncio.run(), and the Windows OCR engine drives its own loop — calling it
    # in a worker thread keeps both safe.
    ColorPrint.blue(f"[VoiceSubtitle] Running OCR on screenshot (lang={ocr_lang})...")
    ocr = await await_bus_task(ocr_extract_text, image_path, ocr_lang)
    extracted_text = (ocr.get('text') or '').strip() if ocr.get('success') else ''
    source_label = f"ocr:{ocr.get('engine')}" if extracted_text else ''
    ai_provider = ''
    ai_model = ''

    # Step 2: AI-vision OCR fallback (transcribe visible text verbatim) only when
    # no local engine produced text.
    if not extracted_text:
        ColorPrint.yellow(
            f"[VoiceSubtitle] Local OCR yielded no text "
            f"(tried: {ocr.get('tried') or 'none'}); falling back to AI-vision OCR...")
        ai_result = ai_describe_image(
            image_path,
            prompt=(
                "Transcribe all the visible text in this image verbatim, in "
                "reading order. Output only the transcribed text — no commentary, "
                "labels, or description. If there is no text, reply with an empty line."
            ),
            source="image-ocr",
        )
        if not ai_result.get('success'):
            return {
                'success': False,
                'error': f"OCR failed and AI-vision fallback failed: {ai_result.get('error')}"
            }
        extracted_text = (ai_result.get('text') or '').strip()
        ai_provider = ai_result.get('provider', '')
        ai_model = ai_result.get('model', '')
        source_label = f"ocr:ai-vision/{ai_provider}"

    if not extracted_text:
        return {
            'success': False,
            'error': "No text could be extracted from the image (OCR + AI-vision both empty)"
        }

    ColorPrint.green(
        f"[VoiceSubtitle] {source_label} extracted: {extracted_text[:100]}...")

    # Step 3-4: Process as text (translate + TTS + add to queue), attributed to
    # the engine/AI that produced the text.
    return await process_text_input(
        extracted_text, langs, category,
        ai_provider=ai_provider, ai_model=ai_model)
