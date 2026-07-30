#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Recognition Cache Info

Thin wrapper that prints TTS cache lookup/statistics for a recognized sentence.
"""

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.tts.sentence_audio_cache import (
    lookup_or_none,
    make_key,
    statistics,
)


def print_recognition_cache_info(text: str, language: str, speech_manager=None):
    """
    Print cache information for recognized text

    Args:
        text: Recognized text
        language: Language code
        speech_manager: SpeechManager instance (optional, to show default TTS provider)
    """

    ColorPrint.plain("\n" + "-" * 70)
    ColorPrint.blue("[Cache Info]")
    ColorPrint.plain(f"Sentence: {text}")
    ColorPrint.plain(f"Language: {language}")

    default_provider = None
    if speech_manager and hasattr(speech_manager, "_default_tts_provider"):
        default_provider = speech_manager._default_tts_provider
        ColorPrint.blue(f"Default TTS Provider: {default_provider}")

    providers = [default_provider] if default_provider else ["edge", "azure"]
    for provider in providers:
        cache_key = make_key(text, language, None, None, provider, "mp3", None)
        cache_path = lookup_or_none(
            text=text,
            lang=language,
            speaker=None,
            engine=provider,
            fmt="mp3",
        )
        ColorPrint.plain(f"Cache Key: {cache_key}")
        if cache_path:
            ColorPrint.green(
                f"[{provider.upper()}] TTS Cache: EXISTS - {cache_path.name}"
            )
        else:
            ColorPrint.yellow(f"[{provider.upper()}] TTS Cache: NOT FOUND")

    tts_stats = statistics()
    ColorPrint.plain(f"\nTotal TTS Cache Entries: {tts_stats['total_entries']}")
    ColorPrint.plain(f"Total Cache Size: {tts_stats['total_cache_size_mb']:.2f} MB")

    ColorPrint.plain("-" * 70)
