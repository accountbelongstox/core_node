# -*- coding: utf-8 -*-
"""One-off: copy battlenet_analysis.json from cache to docs/登陆后的战网元素.json"""
import shutil
from pathlib import Path

def main():
    cache_root = Path.home() / ".core_node" / ".d3check" / ".cache" / "battlenet_ui_analyze"
    subdir = "window_analysis_20260201_142849"
    src = cache_root / subdir / "battlenet_analysis.json"
    if not src.is_file():
        print("Source not found:", src)
        return 1
    docs_dir = Path(__file__).resolve().parent.parent / "docs"
    docs_dir.mkdir(parents=True, exist_ok=True)
    dst = docs_dir / "登陆后的战网元素.json"
    shutil.copy2(src, dst)
    print("OK copied to docs")
    return 0

if __name__ == "__main__":
    exit(main())
