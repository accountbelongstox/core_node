#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TTS Cache Manager

Manages cached TTS audio files with MD5-based naming for efficient reuse.
Supports provider-specific namespaces (azure, edge) and language separation.

Database Integration (Optional):
- Fast cache lookup via database index
- File existence verification
- Automatic cleanup of orphaned records
"""

import hashlib
import shutil
from pathlib import Path
from typing import Optional, Dict, Any
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pygvar import CACHE_DIR


class TTSCacheManager:
    """
    TTS Cache Manager

    Features:
    - MD5-based file naming for text content
    - Provider-specific namespaces (azure, edge)
    - Language-specific subdirectories
    - Automatic cache directory creation
    - Cache hit/miss tracking
    - Optional database integration for fast lookup

    Database Mode (if enabled):
    - Query database first (faster than filesystem scan)
    - Verify file existence (file is source of truth)
    - Auto-cleanup orphaned records
    """

    def __init__(
        self,
        cache_root: Optional[Path] = None,
        database_enabled: bool = False,
        database_name: str = "speech"
    ):
        """
        Initialize TTS cache manager

        Args:
            cache_root: Root directory for cache storage (default: CACHE_DIR/tts)
            database_enabled: Enable database integration for fast lookup
            database_name: Database name for cache lookup table
        """
        if cache_root is None:
            cache_root = Path(CACHE_DIR) / "tts"

        self.cache_root = Path(cache_root)
        self.cache_root.mkdir(parents=True, exist_ok=True)

        # Statistics
        self.cache_hits = 0
        self.cache_misses = 0

        # Database integration
        self.database_enabled = database_enabled
        self.database_name = database_name
        self._db_manager = None
        self._db_model = None

        # Initialize database if enabled
        if self.database_enabled:
            self._initialize_database()

        mode = "with database" if self.database_enabled else "file-only"
        ColorPrint.blue(f"[TTSCache] Initialized at: {self.cache_root} ({mode})")

    def _initialize_database(self):
        """Initialize database connection and load table"""
        try:
            from pycore.database import database_manager, DATABASE_AVAILABLE
            from pycore.database.models import SpeechTTSCacheModel, TableKeys

            if not DATABASE_AVAILABLE:
                ColorPrint.yellow("[TTSCache] Database not available, falling back to file-only mode")
                self.database_enabled = False
                return

            # Register database
            database_manager.register_database(self.database_name)

            # Load table (need both table_keys and models arrays)
            database_manager.load_tables(
                database_name=self.database_name,
                table_keys=[TableKeys.SPEECH_TTS_CACHE],
                models=[SpeechTTSCacheModel]
            )

            self._db_manager = database_manager
            self._db_model = SpeechTTSCacheModel

            ColorPrint.green("[TTSCache] Database integration enabled")

        except Exception as e:
            ColorPrint.yellow(f"[TTSCache] Failed to initialize database: {e}")
            ColorPrint.yellow("[TTSCache] Falling back to file-only mode")
            self.database_enabled = False

    def _get_text_hash(self, text: str) -> str:
        """
        Calculate MD5 hash of text

        Args:
            text: Text to hash

        Returns:
            MD5 hash string (32 characters)
        """
        return hashlib.md5(text.encode('utf-8')).hexdigest()

    def _get_cache_dir(self, provider: str, language: str) -> Path:
        """
        Get cache directory for provider and language

        Directory structure: {cache_root}/{provider}/{language}/

        Args:
            provider: TTS provider name (e.g., 'azure', 'edge')
            language: Language code (e.g., 'zh-CN', 'en-US')

        Returns:
            Path to cache directory
        """
        cache_dir = self.cache_root / provider / language
        cache_dir.mkdir(parents=True, exist_ok=True)
        return cache_dir

    def _get_cache_filename(self, text: str, language: str, extension: str = "mp3") -> str:
        """
        Generate cache filename

        Format: {language}_{md5}.{extension}

        Args:
            text: Text content
            language: Language code
            extension: File extension (default: mp3)

        Returns:
            Cache filename
        """
        text_hash = self._get_text_hash(text)
        # Use short language code (e.g., zh-CN -> zh_CN)
        lang_safe = language.replace('-', '_')
        return f"{lang_safe}_{text_hash}.{extension}"

    def get_cache_path(self, provider: str, text: str, language: str,
                       extension: str = "mp3") -> Path:
        """
        Get full cache file path for given parameters

        Args:
            provider: TTS provider name
            text: Text content
            language: Language code
            extension: File extension

        Returns:
            Full path to cache file
        """
        cache_dir = self._get_cache_dir(provider, language)
        filename = self._get_cache_filename(text, language, extension)
        return cache_dir / filename

    def has_cache(self, provider: str, text: str, language: str,
                  extension: str = "mp3") -> bool:
        """
        Check if cache exists for given parameters

        Database mode (if enabled):
        1. Query database first (faster)
        2. Verify file exists (file is source of truth)
        3. If file missing, delete database record

        File-only mode:
        1. Check if file exists directly

        Args:
            provider: TTS provider name
            text: Text content
            language: Language code
            extension: File extension

        Returns:
            True if cache file exists
        """
        # Database mode: Query database first
        if self.database_enabled and self._db_model:
            try:
                text_md5 = self._get_text_hash(text)

                with self._db_manager.get_connection(self.database_name) as conn:
                    # Query cache with file verification
                    record = self._db_model.query_cache(
                        conn,
                        text_md5=text_md5,
                        language=language,
                        provider=provider,
                        verify_file=True  # File is source of truth
                    )

                    if record:
                        self.cache_hits += 1
                        ColorPrint.green(f"[TTSCache] DB Cache HIT: {Path(record['file_path']).name}")
                        return True
                    else:
                        self.cache_misses += 1
                        ColorPrint.yellow(f"[TTSCache] DB Cache MISS: {text_md5}")
                        return False

            except Exception as e:
                ColorPrint.yellow(f"[TTSCache] Database query failed: {e}, falling back to file check")
                # Fall through to file-only mode

        # File-only mode: Direct file check
        cache_path = self.get_cache_path(provider, text, language, extension)
        exists = cache_path.exists()

        if exists:
            self.cache_hits += 1
            ColorPrint.green(f"[TTSCache] File Cache HIT: {cache_path.name}")
        else:
            self.cache_misses += 1
            ColorPrint.yellow(f"[TTSCache] File Cache MISS: {cache_path.name}")

        return exists

    def get_cache(self, provider: str, text: str, language: str,
                  extension: str = "mp3") -> Optional[Path]:
        """
        Get cache file path if it exists

        Args:
            provider: TTS provider name
            text: Text content
            language: Language code
            extension: File extension

        Returns:
            Path to cache file if exists, None otherwise
        """
        if self.has_cache(provider, text, language, extension):
            return self.get_cache_path(provider, text, language, extension)
        return None

    def save_cache(self, provider: str, text: str, language: str,
                   source_file: Path, extension: str = "mp3") -> Path:
        """
        Save file to cache

        Database mode (if enabled):
        1. Save file to cache directory
        2. Add/update database record

        Args:
            provider: TTS provider name
            text: Text content
            language: Language code
            source_file: Source audio file to cache
            extension: File extension

        Returns:
            Path to cached file
        """
        cache_path = self.get_cache_path(provider, text, language, extension)

        # Copy source file to cache
        shutil.copy2(source_file, cache_path)

        ColorPrint.blue(f"[TTSCache] Saved: {cache_path.name}")
        ColorPrint.blue(f"[TTSCache] Size: {cache_path.stat().st_size} bytes")

        # Database mode: Add to database
        if self.database_enabled and self._db_model:
            try:
                text_md5 = self._get_text_hash(text)

                with self._db_manager.get_connection(self.database_name) as conn:
                    self._db_model.add_cache_entry(
                        conn,
                        text_md5=text_md5,
                        text=text,
                        language=language,
                        provider=provider,
                        file_path=str(cache_path.absolute())
                    )

            except Exception as e:
                ColorPrint.yellow(f"[TTSCache] Failed to add database entry: {e}")
                # Continue even if database update fails (file is still cached)

        return cache_path

    def copy_from_cache(self, provider: str, text: str, language: str,
                        output_file: Path, extension: str = "mp3") -> bool:
        """
        Copy cached file to output location

        Args:
            provider: TTS provider name
            text: Text content
            language: Language code
            output_file: Output file path
            extension: File extension

        Returns:
            True if successfully copied from cache
        """
        cache_file = self.get_cache(provider, text, language, extension)

        if cache_file:
            shutil.copy2(cache_file, output_file)
            ColorPrint.green(f"[TTSCache] Copied from cache to: {output_file}")
            return True

        return False

    def get_statistics(self) -> Dict[str, Any]:
        """
        Get cache statistics

        Returns:
            Dictionary with cache statistics (includes database stats if enabled)
        """
        total_requests = self.cache_hits + self.cache_misses
        hit_rate = (self.cache_hits / total_requests * 100) if total_requests > 0 else 0

        # Count total cached files
        total_files = 0
        total_size = 0

        if self.cache_root.exists():
            for file_path in self.cache_root.rglob("*.mp3"):
                total_files += 1
                total_size += file_path.stat().st_size

        stats = {
            'cache_hits': self.cache_hits,
            'cache_misses': self.cache_misses,
            'hit_rate': hit_rate,
            'total_cached_files': total_files,
            'total_cache_size_bytes': total_size,
            'total_cache_size_mb': total_size / (1024 * 1024),
            'database_enabled': self.database_enabled
        }

        # Add database statistics if enabled
        if self.database_enabled and self._db_model:
            try:
                with self._db_manager.get_connection(self.database_name) as conn:
                    db_stats = self._db_model.get_cache_statistics(conn)
                    stats['database_stats'] = db_stats
            except Exception as e:
                ColorPrint.yellow(f"[TTSCache] Failed to get database stats: {e}")

        return stats

    def clear_cache(self, provider: Optional[str] = None,
                    language: Optional[str] = None):
        """
        Clear cache files

        Args:
            provider: Specific provider to clear (None = all)
            language: Specific language to clear (None = all)
        """
        if provider and language:
            # Clear specific provider + language
            cache_dir = self._get_cache_dir(provider, language)
            if cache_dir.exists():
                shutil.rmtree(cache_dir)
                cache_dir.mkdir(parents=True, exist_ok=True)
                ColorPrint.yellow(f"[TTSCache] Cleared: {provider}/{language}")
        elif provider:
            # Clear specific provider
            provider_dir = self.cache_root / provider
            if provider_dir.exists():
                shutil.rmtree(provider_dir)
                provider_dir.mkdir(parents=True, exist_ok=True)
                ColorPrint.yellow(f"[TTSCache] Cleared: {provider}")
        else:
            # Clear all
            if self.cache_root.exists():
                shutil.rmtree(self.cache_root)
                self.cache_root.mkdir(parents=True, exist_ok=True)
                ColorPrint.yellow("[TTSCache] Cleared all cache")

        # Reset statistics
        self.cache_hits = 0
        self.cache_misses = 0

    def verify_database_files(self):
        """
        Verify all database cache entries have corresponding files

        Only works if database is enabled.
        Deletes database records where files are missing.
        """
        if not self.database_enabled or not self._db_model:
            ColorPrint.yellow("[TTSCache] Database not enabled")
            return

        try:
            with self._db_manager.get_connection(self.database_name) as conn:
                stats = self._db_model.verify_all_files(conn)

            ColorPrint.blue("\n[TTSCache] Database File Verification:")
            ColorPrint.blue(f"  Mode: Database-enabled")
            ColorPrint.blue(f"  Total records checked: {stats['total']}")
            ColorPrint.green(f"  Files exist: {stats['exists']}")
            ColorPrint.yellow(f"  Files missing (deleted): {stats['missing']}")

        except Exception as e:
            ColorPrint.red(f"[TTSCache] Database verification failed: {e}")

    def print_statistics(self):
        """Print cache statistics"""
        stats = self.get_statistics()

        ColorPrint.blue("\n" + "=" * 70)
        ColorPrint.blue("[TTS Cache Statistics]")
        ColorPrint.blue("=" * 70)
        print(f"Mode: {'Database-enabled' if stats['database_enabled'] else 'File-only'}")
        print(f"Cache Hits: {stats['cache_hits']}")
        print(f"Cache Misses: {stats['cache_misses']}")
        print(f"Hit Rate: {stats['hit_rate']:.2f}%")
        print(f"Total Cached Files: {stats['total_cached_files']}")
        print(f"Total Cache Size: {stats['total_cache_size_mb']:.2f} MB")

        # Print database statistics if available
        if 'database_stats' in stats:
            db_stats = stats['database_stats']
            ColorPrint.blue("\n[Database Cache Statistics]")
            print(f"Total DB Entries: {db_stats['total_entries']}")
            print(f"Average Access Count: {db_stats['avg_access_count']:.2f}")

            if db_stats['by_language']:
                print("\nBy Language:")
                for lang, count in db_stats['by_language'].items():
                    print(f"  {lang}: {count}")

            if db_stats['by_provider']:
                print("\nBy Provider:")
                for provider, count in db_stats['by_provider'].items():
                    print(f"  {provider}: {count}")

        ColorPrint.blue("=" * 70 + "\n")


# Global singleton instance
tts_cache_manager = TTSCacheManager()
