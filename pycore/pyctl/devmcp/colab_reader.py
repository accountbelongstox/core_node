# -*- coding: utf-8 -*-
"""Read Colab notebook cell output through a DOM-only evaluation in the Colab tab."""

import re
from typing import Any, Dict, List, Optional

from pycore.pyctl.devmcp.chrome_bridge import chrome_bridge
from pycore.pyctl.devmcp.dev_mcp_constants import ANSI_ESCAPE_PATTERN, COLAB_OUTPUT_SCRIPT


class ColabReader:
    async def read(
        self,
        url_contains: str,
        title_contains: str,
        grep: Optional[str],
        tail: int,
    ) -> Dict[str, Any]:
        pattern = re.compile(grep) if grep else None
        tabs = await chrome_bridge.matching_tabs(0, url_contains, title_contains)
        failures: List[str] = []
        for tab in tabs:
            try:
                page = await chrome_bridge.evaluate(int(tab["tabId"]), COLAB_OUTPUT_SCRIPT)
            except RuntimeError as error:
                failures.append(f"{tab['tabId']}: {error}")
                continue
            lines = ANSI_ESCAPE_PATTERN.sub("", str(page.get("text") or "")).split("\n")
            matched = [line for line in lines if pattern.search(line)] if pattern else lines
            return {
                "tab_id": tab["tabId"],
                "title": tab.get("title"),
                "output_chars": page.get("total"),
                "matched_lines": len(matched),
                "lines": matched[-tail:] if tail > 0 else matched,
            }
        raise LookupError("colab_notebook_model_unavailable: " + "; ".join(failures))


colab_reader = ColabReader()

__all__ = ["ColabReader", "colab_reader"]
