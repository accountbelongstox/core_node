#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gancodex tick broadcaster.

Every 20 seconds (one tick) this script prints the next non-empty line from
scripts/gan_codex/gancodex.txt, prefixed with “继续开发以下逻辑：”.
When it reaches the end of the file it loops back to the first line.
"""

from __future__ import annotations

import itertools
import sys
import time
from pathlib import Path

TICK_SECONDS = 20
DATA_PATH = Path("scripts/gan_codex/gancodex.txt")


def load_lines() -> list[str]:
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"无法找到文件: {DATA_PATH}")
    with DATA_PATH.open("r", encoding="utf-8") as handle:
        return [line.strip() for line in handle if line.strip()]


def main() -> int:
    try:
        lines = load_lines()
    except FileNotFoundError as exc:
        print(exc, file=sys.stderr)
        return 1

    if not lines:
        print(f"{DATA_PATH} 文件中没有有效内容。", file=sys.stderr)
        return 1

    try:
        for idx in itertools.count():
            text = lines[idx % len(lines)]
            print(f"继续开发以下逻辑：{text}")
            time.sleep(TICK_SECONDS)
    except KeyboardInterrupt:
        print("\n已停止 Gancodex tick 广播。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
