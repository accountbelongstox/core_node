"""High-level media compressor implementation."""

from __future__ import annotations

import os
import socket
import sys
import time
from pathlib import Path

# Add current directory to path for direct script execution
_current_dir = Path(__file__).parent
if str(_current_dir) not in sys.path:
    sys.path.insert(0, str(_current_dir))
# Add pycore to path for FileLockManager
_pycore_dir = Path(__file__).parent.parent.parent.parent / 'pycore'
if _pycore_dir.exists() and str(_pycore_dir) not in sys.path:
    sys.path.insert(0, str(_pycore_dir))

try:
    from .colors import Colors
    from pyfoundations.file_lock_manager import SplitFileStore as ThreadSafeJsonStore
    from .subsystems import (
        CacheMixin,
        CompressionMixin,
        DedupMixin,
        IntegrityMixin,
        ProcessingMixin,
        ReportingMixin,
        ScannerMixin,
        TransferMixin,
    )
except ImportError:
    # Fallback for direct script execution
    from colors import Colors
    from pyfoundations.file_lock_manager import SplitFileStore as ThreadSafeJsonStore
    from subsystems import (
        CacheMixin,
        CompressionMixin,
        DedupMixin,
        IntegrityMixin,
        ProcessingMixin,
        ReportingMixin,
        ScannerMixin,
        TransferMixin,
    )

try:
    from pycore.pyutils import MediaCompressor as UnifiedMediaCompressor

    UNIFIED_COMPRESSOR_AVAILABLE = True
except ImportError:  # pragma: no cover - optional dependency
    UnifiedMediaCompressor = None
    UNIFIED_COMPRESSOR_AVAILABLE = False
    print("Warning: pycore.pyutils.MediaCompressor not available")
    print("Falling back to legacy compression methods")

__all__ = ["MediaCompressor"]


class MediaCompressor(
    CacheMixin,
    ReportingMixin,
    ScannerMixin,
    CompressionMixin,
    ProcessingMixin,
    DedupMixin,
    TransferMixin,
    IntegrityMixin,
):
    """Concrete compressor that stitches together subsystem mixins."""

    SOURCE_DIR = Path(r"E:\Evidences")
    TMP_DIR = Path(r"E:\Evidences\_tmp")
    COMPRESS_DIR = Path(r"E:\Evidences\_compress")
    CACHE_JSON = SOURCE_DIR / "compression_cache.json"
    PRIORITY_DIR = SOURCE_DIR / "evident"

    IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".gif", ".webp", ".tiff"}
    VIDEO_EXTENSIONS = {
        ".mp4",
        ".avi",
        ".mkv",
        ".mov",
        ".wmv",
        ".flv",
        ".webm",
        ".m4v",
    }
    AUDIO_EXTENSIONS = {".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a", ".wma"}

    IMAGE_MAX_DIMENSION = 1080
    IMAGE_MAX_SIZE_KB = 500
    IMAGE_QUALITY = 85

    VIDEO_CRF = 28
    VIDEO_PRESET = "medium"
    VIDEO_MAX_DIMENSION = 720

    AUDIO_BITRATE = "128k"

    def __init__(self) -> None:
        self._ensure_directories()

        self.total_source_size = 0
        self.total_compressed_size = 0
        self.total_files_processed = 0

        self.unified_compressor = None
        if UNIFIED_COMPRESSOR_AVAILABLE:
            try:
                self.unified_compressor = UnifiedMediaCompressor(verbose=False)
                print("✓ Unified MediaCompressor initialized (with GPU detection)")
            except Exception as exc:  # pragma: no cover - diagnostics only
                print(f"Warning: Failed to initialize UnifiedMediaCompressor: {exc}")
                self.unified_compressor = None

        self.client_id = f"{socket.gethostname()}_{os.getpid()}_{int(time.time())}"
        self.lock_timeout_seconds = 3600
        print(f"{Colors.CYAN}Client ID: {self.client_id}{Colors.RESET}")
        print(
            f"{Colors.CYAN}Task lock timeout: {self.lock_timeout_seconds // 60} minutes{Colors.RESET}"
        )

        self.cache_store = ThreadSafeJsonStore(
            self.SOURCE_DIR,
            self._create_empty_cache,
            max_retries=20,
            retry_delay=1.0,
            verbose=False,
        )
        self.cache_store.ensure_file()

    def _ensure_directories(self) -> None:
        """Ensure working directories exist."""

        self.TMP_DIR.mkdir(parents=True, exist_ok=True)
        self.COMPRESS_DIR.mkdir(parents=True, exist_ok=True)
