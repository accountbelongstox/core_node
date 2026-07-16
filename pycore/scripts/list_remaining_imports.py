# -*- coding: utf-8 -*-
"""List remaining function-body imports in pycore (roots)."""
import ast
from pathlib import Path
from collections import Counter

root = Path(__file__).resolve().parents[1]
skip = {"__pycache__", "bak", "tts_install_assets"}


class F(ast.NodeVisitor):
    def __init__(self):
        self.in_func = 0
        self.hits = []

    def visit_FunctionDef(self, node):
        self.in_func += 1
        self.generic_visit(node)
        self.in_func -= 1

    visit_AsyncFunctionDef = visit_FunctionDef

    def visit_Import(self, n):
        if self.in_func:
            self.hits.append(n)

    def visit_ImportFrom(self, n):
        if self.in_func:
            self.hits.append(n)


def main():
    c = Counter()
    total = 0
    files = 0
    for p in root.rglob("*.py"):
        if any(s in p.parts for s in skip):
            continue
        if "third_party" in p.parts and p.name.startswith("_"):
            continue
        try:
            src = p.read_text(encoding="utf-8")
            tree = ast.parse(src)
        except Exception:
            continue
        f = F()
        f.visit(tree)
        if not f.hits:
            continue
        files += 1
        total += len(f.hits)
        for node in f.hits:
            if isinstance(node, ast.Import):
                c["import " + node.names[0].name.split(".")[0]] += 1
            else:
                mod = node.module or ("." * node.level)
                c["from " + mod.split(".")[0]] += 1
    print(f"remaining files={files} imports={total}")
    for k, v in c.most_common(50):
        print(f"{v:3d} {k}")


if __name__ == "__main__":
    main()
