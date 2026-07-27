#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Thin re-export shim for the canonical ImageTools.

Historically this was a byte-identical 1041-line fork of
pycore/pyutils/image_tools/image_processor.py. It is now a thin re-export so
the flat import used by mcp_tools_image.py::

    from image_tools import image_tools

resolves to the SAME singleton (and ImageTools class) defined in the canonical
pycore.pyutils.image_tools.image_processor module. This keeps a single source
of truth and guarantees singleton identity across the mcp_bridge runtime.

This shim MUST NOT print to stdout: the MCP server speaks JSON-RPC over stdout.
All diagnostics go through logging (stderr) only.
"""

import sys
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# mcp_bridge runs from its own directory, so the flat "image_tools" name
# resolves to this file. pycore is normally already importable from that
# context (the mcp_bridge smoke test `import main` loads pycore modules), but
# add the repo root to sys.path as a defensive fallback so the canonical
# import never fails with ImportError regardless of how the bridge is launched.
# __file__ = .../pycore/pyutils/mcp_bridge_with_laravel/image_tools.py
# parents[3] = repo root (the directory containing pycore/).
try:
    _REPO_ROOT = str(Path(__file__).resolve().parents[3])
    if _REPO_ROOT not in sys.path:
        sys.path.insert(0, _REPO_ROOT)
except Exception as e:  # pragma: no cover - defensive, never fatal
    logger.debug("image_tools shim: could not compute repo root: %s", e)

from pycore.pyutils.image_tools.image_processor import image_tools, ImageTools  # noqa: E402

__all__ = ["image_tools", "ImageTools"]
