#!/usr/bin/env python3
"""Generate common English vocabulary lists using wordfreq."""

from __future__ import annotations

from pathlib import Path
from typing import Dict, List

from wordfreq import top_n_list

TARGET_SIZES = [3000, 5000, 8000]
OUTPUT_DIR = Path(__file__).resolve().parent / "vocabulary"
TABLE_PATH = OUTPUT_DIR / "summary_table.md"


def generate_lists() -> Dict[int, List[str]]:
    data = {}
    for size in TARGET_SIZES:
        words = top_n_list("en", size)
        data[size] = words
    return data


def write_files(word_map: Dict[int, List[str]]) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    rows = ["| 词库名称 | 词量 | 文件路径 | 示例前五个单词 |", "| --- | --- | --- | --- |"]
    for size, words in sorted(word_map.items()):
        filename = OUTPUT_DIR / f"common_{size}.txt"
        with filename.open("w", encoding="utf-8") as handle:
            handle.write("\n".join(words))
        sample = ", ".join(words[:5])
        rows.append(f"| 常用 {size} 词库 | {size} | {filename.relative_to(Path.cwd())} | {sample} |")
    TABLE_PATH.write_text("\n".join(rows), encoding="utf-8")


def main() -> None:
    word_map = generate_lists()
    write_files(word_map)
    print(f"已生成词库并写入 {OUTPUT_DIR}")
    print(f"摘要表: {TABLE_PATH}")


if __name__ == "__main__":
    main()
