#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
"""
File Processor MCP Server - thin entry shim.

All implementation was split into sibling modules under this directory:
package_manager, document_converter, document_parser, image_pixel_analysis,
mcp_tools_document, mcp_tools_ocr, mcp_tools_image, mcp_tools_code, and
server. This file only boots the server so the existing
`python main.py` (run from this directory) launcher keeps working.

Flat sibling imports (e.g. `from ocr_engines import ...`) resolve because this
directory is on sys.path when launched from here; the split keeps that intact.
"""

# Importing server registers all MCP tools as a side effect (register_*_tools
# calls + analyze_image_pixels + health_check) and starts the OCR queue / package
# initialization, exactly as the original main.py did at module load.
from server import (  # noqa: F401  (re-exported for backward compatibility)
    main, mcp, logger, OCR_AVAILABLE,
    PackageManager, DocumentConverter, DocumentParser,
    parser, converter, health_check,
)

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        # logger may not be fully usable if import itself failed; guard with stderr.
        try:
            logger.error(f"Server error: {e}")
        except Exception:
            print(f"Server error: {e}", file=sys.stderr)
        sys.exit(1)
