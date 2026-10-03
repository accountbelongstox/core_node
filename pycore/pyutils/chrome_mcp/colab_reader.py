# -*- coding: utf-8 -*-
"""Read Colab notebook cell output through the user's Chrome (DOM and output frames)."""

import json
import re
from typing import Any, Dict, List, Optional

from pycore.pyutils.chrome_mcp.chrome_mcp_bridge import chrome_bridge
from pycore.pyutils.chrome_mcp.chrome_mcp_constants import (
    ANSI_ESCAPE_PATTERN,
    COLAB_FRAME_TEXT_SCRIPT,
    COLAB_MAX_CHARS,
    COLAB_OUTPUT_FRAME_PAGE,
    COLAB_OUTPUT_SCRIPT,
    COLAB_OUTPUT_SEGMENTS_SCRIPT,
)


class ColabReader:
    async def live_text(self, tab_id: int) -> str:
        """Rendered output of the code cells in DOM order ('' when nothing is rendered)."""
        segments = await chrome_bridge.evaluate(tab_id, COLAB_OUTPUT_SEGMENTS_SCRIPT)
        if isinstance(segments, str):
            segments = json.loads(segments)
        parts: List[str] = []
        for segment in segments or []:
            if "frame" in segment:
                # A frame host can expose several targets; the live one holds the text.
                texts = await chrome_bridge.evaluate_frames(tab_id, segment["frame"], COLAB_FRAME_TEXT_SCRIPT)
                parts.append(max((str(text or "") for text in texts), key=len, default=""))
            else:
                parts.append(str(segment.get("text") or ""))
        return "\n".join(part for part in parts if part.strip())

    async def frames_text(self, tab_id: int) -> str:
        """Every output frame's text, read without the top page (used when the notebook page is too busy to answer)."""
        texts = await chrome_bridge.evaluate_frames(tab_id, COLAB_OUTPUT_FRAME_PAGE, COLAB_FRAME_TEXT_SCRIPT)
        return "\n".join(str(text or "") for text in texts if str(text or "").strip())

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
                try:
                    text = await self.live_text(int(tab["tabId"]))
                except RuntimeError as error:
                    text = await self.frames_text(int(tab["tabId"]))
                    failures.append(f"{tab['tabId']}: top page unavailable, read output frames ({error})")
                if not text:
                    page = await chrome_bridge.evaluate(int(tab["tabId"]), COLAB_OUTPUT_SCRIPT)
                    text = str(page.get("text") or "")
            except RuntimeError as error:
                failures.append(f"{tab['tabId']}: {error}")
                continue
            lines = ANSI_ESCAPE_PATTERN.sub("", text[-COLAB_MAX_CHARS:]).split("\n")
            matched = [line for line in lines if pattern.search(line)] if pattern else lines
            return {
                "tab_id": tab["tabId"],
                "title": tab.get("title"),
                "output_chars": len(text),
                "matched_lines": len(matched),
                "lines": matched[-tail:] if tail > 0 else matched,
            }
        raise LookupError("colab_notebook_model_unavailable: " + "; ".join(failures))


colab_reader = ColabReader()

__all__ = ["ColabReader", "colab_reader"]
