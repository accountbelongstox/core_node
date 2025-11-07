"""Entry point for the media compression CLI."""

from __future__ import annotations

import sys
from pathlib import Path

# Add current directory to path for direct script execution
if __name__ == "__main__":
    _current_dir = Path(__file__).parent
    if str(_current_dir) not in sys.path:
        sys.path.insert(0, str(_current_dir))

    # Add pycore to path for FileLockManager
    _pycore_dir = Path(__file__).parent.parent.parent.parent / 'pycore'
    if _pycore_dir.exists() and str(_pycore_dir) not in sys.path:
        sys.path.insert(0, str(_pycore_dir))

try:
    from .menu import main as _run_main
except ImportError:
    # Fallback for direct script execution
    from menu import main as _run_main


def main() -> None:
    """Launch the interactive compressor menu."""
    _run_main()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nProgram interrupted by user")
    except Exception as exc:  # pragma: no cover - defensive entry point guard
        print(f"\nProgram error: {exc}")
        import traceback

        traceback.print_exc()
