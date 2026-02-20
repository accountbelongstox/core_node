#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
History parsers - convert raw lines to structured blocks.

Each parser implements a different parsing strategy:
- v1: TAB + content_indent stack (uses rosbot_history_parser)
- v2: Multi-level indent with enhancements
- v3: Two-pass parsing (boundaries then fields)
- v4: State machine with line type classification
- v5: Regex + indent stack
- v6: Multi-level indent (simplified)
"""
from __future__ import annotations

from d3utils.history.parser.parser_v1 import HistoryParserV1
from d3utils.history.parser.parser_v2 import HistoryParserV2
from d3utils.history.parser.parser_v3 import HistoryParserV3
from d3utils.history.parser.parser_v4 import HistoryParserV4
from d3utils.history.parser.parser_v5 import HistoryParserV5
from d3utils.history.parser.parser_v6 import HistoryParserV6

__all__ = [
    "HistoryParserV1",
    "HistoryParserV2",
    "HistoryParserV3",
    "HistoryParserV4",
    "HistoryParserV5",
    "HistoryParserV6",
]
