#!/usr/bin/env python3
"""Entry point for the Codebase Content Hub MCP application."""

from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from pycore import ColorPrint
from pyapps.codebase_content_hub.service.server import run_server


def start() -> bool:
    """Launch the Codebase Content Hub MCP server."""
    try:
        ColorPrint.blue("Starting Codebase Content Hub MCP service via pycore launcher")
        run_server()
        return True
    except KeyboardInterrupt:
        ColorPrint.yellow("Codebase Content Hub MCP service interrupted")
        return False
    except Exception as exc:  # pylint: disable=broad-except
        ColorPrint.red(f"Failed to start Codebase Content Hub MCP service: {exc}")
        return False


def main() -> None:
    """Compatibility wrapper for direct execution."""
    success = start()
    if not success:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
