"""
预览 ROSBOT_FLOW_MERMAID.md 中的 Mermaid 图：导出为 SVG 并可选打开。
依赖：pip install mermaid-cli
使用：python pyapps/d3-check/docs/preview_mermaid.py
或：python preview_mermaid.py（在 docs 目录下执行）
"""
from __future__ import annotations

import os
import re
import sys
import asyncio

from pycore.pyutils.common.system_launcher import open_file

try:
    from mermaid_cli import render_mermaid
except ImportError:
    print("pip install mermaid-cli 后再运行")
    sys.exit(1)

doc_dir = os.path.dirname(os.path.abspath(__file__))
md_path = os.path.join(doc_dir, "ROSBOT_FLOW_MERMAID.md")
out_dir = os.path.join(doc_dir, "mermaid_preview")
os.makedirs(out_dir, exist_ok=True)
out_svg = os.path.join(out_dir, "ROSBOT_FLOW.svg")

with open(md_path, "r", encoding="utf-8") as f:
    md = f.read()
m = re.search(r"```mermaid\n([\s\S]*?)```", md)
if not m:
    print("No mermaid block in", md_path)
    sys.exit(1)
definition = m.group(1).strip()


async def run():
    _title, _desc, svg_data = await render_mermaid(
        definition,
        output_format="svg",
        mermaid_config={"theme": "neutral"},
        background_color="transparent",
    )
    with open(out_svg, "wb") as f:
        f.write(svg_data)
    print("Wrote:", out_svg)


asyncio.run(run())

open_file(out_svg)
