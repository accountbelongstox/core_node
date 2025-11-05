"""Entry point for the media compression CLI."""

from __future__ import annotations

from menu import main as _run_main


def main() -> None:
    """Launch the interactive compressor menu."""
    _run_main()


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nProgram interrupted by user")
    except Exception as exc:  # pragma: no cover - defensive entry point guard
        print(f"\nProgram error: {exc}")
        import traceback

        traceback.print_exc()
