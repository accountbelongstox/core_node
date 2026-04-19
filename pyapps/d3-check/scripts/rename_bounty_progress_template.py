#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Rename screenshot to images/d3_bounty_progress.png so Fragment2 template matcher finds it. Deletes existing d3_bounty_progress.png then renames source. Run from pyapps/d3-check."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IMAGES = ROOT / "images"
SRC = IMAGES / "ScreenShot_2026-01-30_053028_172.png"
DST = IMAGES / "d3_bounty_progress.png"

def main():
    if not SRC.exists():
        print(f"Source not found: {SRC}")
        return 1
    if DST.exists():
        DST.unlink()
        print(f"Deleted existing {DST.name}")
    SRC.rename(DST)
    print(f"Renamed {SRC.name} -> {DST.name}")
    return 0

if __name__ == "__main__":
    exit(main())
