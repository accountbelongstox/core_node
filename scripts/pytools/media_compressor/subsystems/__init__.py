"""Subsystem mixins for the media compressor."""

import sys
from pathlib import Path

# Add parent directory to path for direct script execution
_parent_dir = Path(__file__).parent.parent
if str(_parent_dir) not in sys.path:
    sys.path.insert(0, str(_parent_dir))

try:
    from .cache_mixin import CacheMixin  # noqa: F401
    from .compression_mixin import CompressionMixin  # noqa: F401
    from .dedup_mixin import DedupMixin  # noqa: F401
    from .integrity_mixin import IntegrityMixin  # noqa: F401
    from .processing_mixin import ProcessingMixin  # noqa: F401
    from .reporting_mixin import ReportingMixin  # noqa: F401
    from .scanner_mixin import ScannerMixin  # noqa: F401
    from .transfer_mixin import TransferMixin  # noqa: F401
except ImportError:
    # Fallback for direct script execution
    from subsystems.cache_mixin import CacheMixin  # noqa: F401
    from subsystems.compression_mixin import CompressionMixin  # noqa: F401
    from subsystems.dedup_mixin import DedupMixin  # noqa: F401
    from subsystems.integrity_mixin import IntegrityMixin  # noqa: F401
    from subsystems.processing_mixin import ProcessingMixin  # noqa: F401
    from subsystems.reporting_mixin import ReportingMixin  # noqa: F401
    from subsystems.scanner_mixin import ScannerMixin  # noqa: F401
    from subsystems.transfer_mixin import TransferMixin  # noqa: F401
