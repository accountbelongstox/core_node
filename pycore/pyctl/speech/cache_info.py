#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Recognition Cache Info

Thin wrapper that prints TTS cache lookup/statistics for a recognized sentence.

TODO: consolidate with the cache helpers in speech_manager (deferred reuse batch).
"""

from pathlib import Path

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

import hashlib
from pycore.database import database_manager, DATABASE_AVAILABLE
from pycore.database.models import SpeechTTSCacheModel, TableKeys



def print_recognition_cache_info(text: str, language: str, speech_manager=None):
    """
    Print cache information for recognized text

    Args:
        text: Recognized text
        language: Language code
        speech_manager: SpeechManager instance (optional, to show default TTS provider)
    """

    # Calculate MD5 for text
    md5_hash = hashlib.md5(text.encode('utf-8')).hexdigest()

    print("\n" + "-" * 70)
    ColorPrint.blue("[Cache Info]")
    print(f"Sentence: {text}")
    print(f"MD5: {md5_hash}")
    print(f"Language: {language}")

    if not DATABASE_AVAILABLE:
        ColorPrint.yellow("Database not available for cache lookup")
        print("-" * 70)
        return

    try:
        # Initialize database if needed
        if not database_manager.is_database_registered("speech"):
            database_manager.register_database("speech")
            database_manager.load_tables(
                database_name="speech",
                table_keys=[TableKeys.SPEECH_TTS_CACHE],
                models=[SpeechTTSCacheModel]
            )

        # Get default TTS provider if speech_manager is available
        default_provider = None
        if speech_manager and hasattr(speech_manager, '_default_tts_provider'):
            default_provider = speech_manager._default_tts_provider
            ColorPrint.blue(f"Default TTS Provider: {default_provider}")

        # Check cache using database
        with database_manager.get_connection("speech") as conn:
            # Check cache for default provider first (if available)
            if default_provider:
                record = SpeechTTSCacheModel.query_cache(conn, md5_hash, language, default_provider, verify_file=True)
                if record:
                    ColorPrint.green(f"[{default_provider.upper()}] TTS Cache: EXISTS - {Path(record['file_path']).name}")
                else:
                    ColorPrint.yellow(f"[{default_provider.upper()}] TTS Cache: NOT FOUND")
            else:
                # No default provider, check both
                edge_record = SpeechTTSCacheModel.query_cache(conn, md5_hash, language, "edge", verify_file=True)
                azure_record = SpeechTTSCacheModel.query_cache(conn, md5_hash, language, "azure", verify_file=True)

                if edge_record:
                    ColorPrint.green(f"Edge TTS Cache: EXISTS - {Path(edge_record['file_path']).name}")
                else:
                    ColorPrint.yellow(f"Edge TTS Cache: NOT FOUND")

                if azure_record:
                    ColorPrint.green(f"Azure TTS Cache: EXISTS - {Path(azure_record['file_path']).name}")
                else:
                    ColorPrint.yellow(f"Azure TTS Cache: NOT FOUND")

            # Print overall cache stats
            tts_stats = SpeechTTSCacheModel.get_cache_statistics(conn)
            print(f"\nTotal TTS Cache Entries: {tts_stats['total_entries']}")
            print(f"Total Cache Size: {tts_stats['total_cache_size_mb']:.2f} MB")

    except Exception as e:
        ColorPrint.yellow(f"Cache lookup failed: {e}")

    print("-" * 70)
