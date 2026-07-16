# -*- coding: utf-8 -*-
"""
Idempotent hoist of function-body imports to file top (PYTHON_PYCORE.md §1).

Rules:
  - stdlib + absolute ``from pycore...`` / ``import pycore...`` -> module top
  - relative ``from .x`` -> absolute ``from pycore.<pkg>...`` then hoist
  - third-party with a getter -> import getter at top; replace body import
    with ``name = get_third_package_*(...)`` assignment (lazy load stays)
  - third-party without getter -> top-level try/except ImportError + *_AVAILABLE
  - skip if already present at module top (idempotent)
  - skip name clashes (different source/same local name) — leave body import
  - never rewrite third_party/_*.py (lazy machinery lives there)
  - skip bak/, tts_install_assets/

Usage:
  python -m pycore.scripts.hoist_imports [--dry-run] [--root PATH]
"""

from __future__ import annotations

import argparse
import ast
import os
import sys
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple


SKIP_DIR_NAMES = {"__pycache__", "bak", "tts_install_assets", ".git"}

# Map bare package / from-module root -> (getter_name, assign_expr factory)
# assign_expr: local name -> statement text after getter imported
GETTER_MAP: Dict[str, Tuple[str, str]] = {
    "torch": ("get_third_package_torch", "torch = get_third_package_torch()"),
    "numpy": ("get_third_package_numpy", "numpy = get_third_package_numpy()"),
    "np": ("get_third_package_numpy", "np = get_third_package_numpy()"),
    "cv2": ("get_third_package_cv2", "cv2 = get_third_package_cv2()"),
    "requests": ("get_third_package_requests", "requests = get_third_package_requests()"),
    "yaml": ("get_third_package_yaml", "yaml = get_third_package_yaml()"),
    "psutil": ("get_third_package_psutil", "psutil = get_third_package_psutil()"),
    "aiohttp": ("get_third_package_aiohttp", "aiohttp = get_third_package_aiohttp()"),
    "websockets": ("get_third_package_websockets", "websockets = get_third_package_websockets()"),
    "uvicorn": ("get_third_package_uvicorn", "uvicorn = get_third_package_uvicorn()"),
    "fastapi": ("get_third_package_fastapi", "fastapi = get_third_package_fastapi()"),
    "httpx": ("get_third_package_httpx", "httpx = get_third_package_httpx()"),
    "pystray": ("get_third_package_pystray", "pystray = get_third_package_pystray()"),
    "pyautogui": ("get_third_package_pyautogui", "pyautogui = get_third_package_pyautogui()"),
    "mss": ("get_third_package_mss", "mss = get_third_package_mss()"),
    "av": ("get_third_package_av", "av = get_third_package_av()"),
    "openai": ("get_third_package_openai", "openai = get_third_package_openai()"),
    "edge_tts": ("get_third_package_edge_tts", "edge_tts = get_third_package_edge_tts()"),
    "whisper": ("get_third_package_whisper", "whisper = get_third_package_whisper()"),
    "sherpa_onnx": ("get_third_package_sherpa_onnx", "sherpa_onnx = get_third_package_sherpa_onnx()"),
    "watchdog": ("get_third_package_watchdog", "watchdog = get_third_package_watchdog()"),
    "pyaudio": ("get_third_package_pyaudio", "pyaudio = get_third_package_pyaudio()"),
    "tkinter": ("get_third_package_tkinter", "tkinter = get_third_package_tkinter()"),
    "PySide6": ("get_third_package_pyside6", "PySide6 = get_third_package_pyside6()"),
    "win32gui": ("get_third_package_win32gui", "win32gui = get_third_package_win32gui()"),
    "win32con": ("get_third_package_win32con", "win32con = get_third_package_win32con()"),
    "win32api": ("get_third_package_win32api", "win32api = get_third_package_win32api()"),
    "win32process": ("get_third_package_win32process", "win32process = get_third_package_win32process()"),
    "win32ui": ("get_third_package_win32ui", "win32ui = get_third_package_win32ui()"),
    "pywinauto": ("get_third_package_pywinauto", "pywinauto = get_third_package_pywinauto()"),
    "cnocr": ("get_third_package_cnocr", "cnocr = get_third_package_cnocr()"),
    "ultralytics": ("get_third_package_ultralytics", "ultralytics = get_third_package_ultralytics()"),
    "matplotlib": ("get_third_package_matplotlib", "matplotlib = get_third_package_matplotlib()"),
    "sklearn": ("get_third_package_sklearn", "sklearn = get_third_package_sklearn()"),
    "cryptography": ("get_third_package_cryptography", "cryptography = get_third_package_cryptography()"),
    "PIL": ("get_third_package_PIL", "PIL = get_third_package_PIL()"),
    "docx": ("get_third_package_docx", "docx = get_third_package_docx()"),
    "ebooklib": ("get_third_package_ebooklib", "ebooklib = get_third_package_ebooklib()"),
    "bs4": ("get_third_package_bs4", "bs4 = get_third_package_bs4()"),
    "pypdf": ("get_third_package_pypdf", "pypdf = get_third_package_pypdf()"),
    "pdfplumber": ("get_third_package_pdfplumber", "pdfplumber = get_third_package_pdfplumber()"),
    "openpyxl": ("get_third_package_openpyxl", "openpyxl = get_third_package_openpyxl()"),
    "pptx": ("get_third_package_pptx", "pptx = get_third_package_pptx()"),
    "googletrans": ("get_third_package_googletrans", "googletrans = get_third_package_googletrans()"),
    "huggingface_hub": ("get_third_package_huggingface_hub", "huggingface_hub = get_third_package_huggingface_hub()"),
    "pythoncom": ("get_third_package_pythoncom", "pythoncom = get_third_package_pythoncom()"),
}

# from X import Y mappings for common third-party
FROM_GETTER_MAP: Dict[Tuple[str, str], Tuple[str, str]] = {
    ("PIL", "Image"): ("get_third_package_PIL_Image", "Image = get_third_package_PIL_Image()"),
    ("PIL", "ImageDraw"): ("get_third_package_PIL_ImageDraw", "ImageDraw = get_third_package_PIL_ImageDraw()"),
    ("PIL", "ImageFont"): ("get_third_package_PIL_ImageFont", "ImageFont = get_third_package_PIL_ImageFont()"),
    ("PIL", "ImageTk"): ("get_third_package_PIL_ImageTk", "ImageTk = get_third_package_PIL_ImageTk()"),
    ("PIL", "ImageGrab"): ("get_third_package_PIL_ImageGrab", "ImageGrab = get_third_package_PIL_ImageGrab()"),
    ("PIL", "ImageEnhance"): ("get_third_package_PIL_ImageEnhance", "ImageEnhance = get_third_package_PIL_ImageEnhance()"),
    ("PIL", "ImageFilter"): ("get_third_package_PIL_ImageFilter", "ImageFilter = get_third_package_PIL_ImageFilter()"),
    ("PIL", "ImageOps"): ("get_third_package_PIL_ImageOps", "ImageOps = get_third_package_PIL_ImageOps()"),
    ("PIL", "ImageStat"): ("get_third_package_PIL_ImageStat", "ImageStat = get_third_package_PIL_ImageStat()"),
    ("numpy", "ndarray"): ("get_third_package_numpy", "np = get_third_package_numpy()"),
}

STDLIB_ROOTS = {
    "os", "sys", "re", "json", "time", "pathlib", "typing", "threading", "subprocess",
    "argparse", "collections", "functools", "itertools", "dataclasses", "enum", "abc",
    "copy", "hashlib", "hmac", "base64", "uuid", "socket", "struct", "tempfile",
    "shutil", "glob", "fnmatch", "logging", "traceback", "inspect", "importlib",
    "pkgutil", "platform", "multiprocessing", "concurrent", "asyncio", "contextlib",
    "warnings", "weakref", "queue", "signal", "stat", "math", "random", "datetime",
    "urllib", "http", "email", "csv", "io", "string", "textwrap", "binascii", "zlib",
    "gzip", "zipfile", "tarfile", "pickle", "shelve", "sqlite3", "xml", "html",
    "configparser", "secrets", "ssl", "select", "errno", "ctypes", "array", "mmap",
    "gc", "atexit", "bisect", "heapq", "types", "operator", "pprint", "difflib",
    "calendar", "locale", "getpass", "ntpath", "posixpath", "winreg", "pwd", "grp",
    "fcntl", "resource", "termios", "tty", "pty", "selectors", "dataclasses",
    "importlib.util", "importlib.machinery", "concurrent.futures", "multiprocessing.pool",
    "ctypes", "unittest", "unittest.mock",
}


def _pkg_path_for_file(file_path: Path, pycore_root: Path) -> str:
    """Return dotted pycore package path for a file's directory."""
    rel = file_path.parent.relative_to(pycore_root)
    parts = ["pycore"] + list(rel.parts)
    return ".".join(parts)


def _resolve_relative(node: ast.ImportFrom, file_path: Path, pycore_root: Path) -> Optional[str]:
    if not node.level:
        return node.module
    base_parts = list(file_path.parent.relative_to(pycore_root).parts)
    # level=1 -> current package; level=2 -> parent, etc.
    up = node.level - 1
    if up > len(base_parts):
        return None
    if up:
        base_parts = base_parts[:-up]
    prefix = ["pycore"] + base_parts
    if node.module:
        return ".".join(prefix + node.module.split("."))
    return ".".join(prefix)


def _import_key(node: ast.AST, abs_module: Optional[str] = None) -> Tuple:
    if isinstance(node, ast.Import):
        return ("import", tuple((a.name, a.asname) for a in node.names))
    assert isinstance(node, ast.ImportFrom)
    mod = abs_module if abs_module is not None else (node.module or "")
    return ("from", mod, tuple((a.name, a.asname) for a in node.names))


def _bound_names(node: ast.AST) -> List[str]:
    if isinstance(node, ast.Import):
        return [a.asname or a.name.split(".")[0] for a in node.names]
    assert isinstance(node, ast.ImportFrom)
    return [a.asname or a.name for a in node.names]


def _format_from(mod: str, names: List[ast.alias]) -> str:
    parts = []
    for a in names:
        parts.append(f"{a.name} as {a.asname}" if a.asname else a.name)
    joined = ", ".join(parts)
    if len(joined) > 80 and len(names) > 1:
        inner = ",\n    ".join(parts)
        return f"from {mod} import (\n    {inner},\n)"
    return f"from {mod} import {joined}"


def _format_import(names: List[ast.alias]) -> str:
    parts = []
    for a in names:
        parts.append(f"{a.name} as {a.asname}" if a.asname else a.name)
    return "import " + ", ".join(parts)


def _module_top_import_keys(tree: ast.Module) -> Dict[str, Tuple]:
    """Map local name -> import key for module-level imports (incl. try bodies)."""
    name_to_key: Dict[str, Tuple] = {}

    def record(node: ast.AST, abs_mod: Optional[str] = None) -> None:
        key = _import_key(node, abs_mod)
        for n in _bound_names(node):
            name_to_key.setdefault(n, key)

    for stmt in tree.body:
        if isinstance(stmt, (ast.Import, ast.ImportFrom)):
            record(stmt)
        elif isinstance(stmt, ast.Try):
            for s in stmt.body:
                if isinstance(s, (ast.Import, ast.ImportFrom)):
                    record(s)
    return name_to_key


def _find_insert_index(lines: List[str], tree: ast.Module) -> int:
    """Line index (0-based) after the initial docstring + import block."""
    last_import_end = 0
    # Skip module docstring
    body = tree.body
    start_idx = 0
    if body and isinstance(body[0], ast.Expr) and isinstance(getattr(body[0], "value", None), ast.Constant):
        start_idx = 1
        last_import_end = body[0].end_lineno or body[0].lineno

    i = start_idx
    while i < len(body):
        stmt = body[i]
        if isinstance(stmt, (ast.Import, ast.ImportFrom)):
            last_import_end = max(last_import_end, stmt.end_lineno or stmt.lineno)
            i += 1
            continue
        if isinstance(stmt, ast.Try):
            only_imports = all(isinstance(s, (ast.Import, ast.ImportFrom, ast.Assign)) for s in stmt.body)
            if only_imports or any(isinstance(s, (ast.Import, ast.ImportFrom)) for s in stmt.body):
                last_import_end = max(last_import_end, stmt.end_lineno or stmt.lineno)
                i += 1
                continue
        if isinstance(stmt, ast.If):
            # TYPE_CHECKING / platform guards with imports
            test = stmt.test
            is_type_checking = isinstance(test, ast.Name) and test.id == "TYPE_CHECKING"
            if is_type_checking or any(
                isinstance(s, (ast.Import, ast.ImportFrom)) for s in stmt.body
            ):
                # Only consume if still in "header" region (no prior non-import real code)
                # Stop if we already passed real defs — handled by breaking below if Class/Func
                pass
        if isinstance(stmt, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            break
        # Assignments / constants often sit after imports; stop before them if no more imports
        # Keep scanning only trailing try-import blocks already handled
        if isinstance(stmt, (ast.Assign, ast.AnnAssign, ast.Expr)):
            # allow future.annotations already done; stop
            break
        i += 1

    if last_import_end <= 0:
        # After docstring or line 0
        if body and isinstance(body[0], ast.Expr):
            return body[0].end_lineno or 1
        return 0
    return last_import_end


class BodyImportCollector(ast.NodeVisitor):
    def __init__(self) -> None:
        self.in_func = 0
        self.nodes: List[ast.AST] = []

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        self.in_func += 1
        self.generic_visit(node)
        self.in_func -= 1

    visit_AsyncFunctionDef = visit_FunctionDef

    def visit_Import(self, node: ast.Import) -> None:
        if self.in_func:
            self.nodes.append(node)

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        if self.in_func:
            self.nodes.append(node)


def _parent_try_is_import_guard(tree: ast.AST, target: ast.AST) -> bool:
    """True if import sits directly in try body that catches ImportError."""
    for node in ast.walk(tree):
        if not isinstance(node, ast.Try):
            continue
        if target not in node.body:
            continue
        for h in node.handlers:
            if h.type is None:
                return True
            if isinstance(h.type, ast.Name) and h.type.id in ("ImportError", "ModuleNotFoundError", "Exception"):
                return True
            if isinstance(h.type, ast.Tuple):
                for elt in h.type.elts:
                    if isinstance(elt, ast.Name) and elt.id in ("ImportError", "ModuleNotFoundError", "Exception"):
                        return True
        return False
    return False


def _classify(
    node: ast.AST,
    file_path: Path,
    pycore_root: Path,
) -> Tuple[str, Optional[str], Optional[str]]:
    """
    Returns (kind, hoist_statement_or_None, replace_statement_or_None).
    kind: hoist | getter_replace | optional_top | skip
    """
    if isinstance(node, ast.Import):
        if len(node.names) != 1:
            return ("skip", None, None)
        alias = node.names[0]
        root = alias.name.split(".")[0]
        local = alias.asname or root
        if root == "pycore" or alias.name.startswith("pycore."):
            return ("hoist", _format_import(node.names), None)
        if alias.name in STDLIB_ROOTS or root in STDLIB_ROOTS:
            return ("hoist", _format_import(node.names), None)
        # getter by imported name or asname
        key = alias.asname or root
        if key in GETTER_MAP:
            gname, assign = GETTER_MAP[key]
            return ("getter_replace", f"from pycore.pyfoundations.third_party import {gname}", assign)
        if root in GETTER_MAP:
            gname, assign = GETTER_MAP[root]
            # fix assign local name if aliased
            if alias.asname:
                assign = f"{alias.asname} = {gname}()"
            return ("getter_replace", f"from pycore.pyfoundations.third_party import {gname}", assign)
        # unknown third-party: optional top
        flag = f"_{local.upper()}_AVAILABLE" if not local.isupper() else f"{local}_AVAILABLE"
        block = (
            f"try:\n"
            f"    {_format_import(node.names)}\n"
            f"    {flag} = True\n"
            f"except ImportError:\n"
            f"    {local} = None\n"
            f"    {flag} = False"
        )
        return ("optional_top", block, None)

    assert isinstance(node, ast.ImportFrom)
    abs_mod = _resolve_relative(node, file_path, pycore_root)
    if abs_mod is None:
        return ("skip", None, None)

    # relative -> absolute hoist
    if node.level:
        return ("hoist", _format_from(abs_mod, node.names), None)

    root = abs_mod.split(".")[0]
    if abs_mod.startswith("pycore.") or abs_mod == "pycore":
        return ("hoist", _format_from(abs_mod, node.names), None)
    if abs_mod in STDLIB_ROOTS or root in STDLIB_ROOTS:
        return ("hoist", _format_from(abs_mod, node.names), None)

    # from X import Y with getter
    if len(node.names) == 1:
        a = node.names[0]
        fk = (root, a.name)
        if fk in FROM_GETTER_MAP:
            gname, assign = FROM_GETTER_MAP[fk]
            if a.asname:
                assign = f"{a.asname} = {gname}()"
            return ("getter_replace", f"from pycore.pyfoundations.third_party import {gname}", assign)
        if abs_mod in GETTER_MAP and a.name == abs_mod.split(".")[-1]:
            gname, assign = GETTER_MAP[abs_mod]
            return ("getter_replace", f"from pycore.pyfoundations.third_party import {gname}", assign)

    # azure speech special
    if abs_mod.startswith("azure.cognitiveservices.speech"):
        gname, assign = GETTER_MAP["azure.cognitiveservices.speech"]
        local = node.names[0].asname or node.names[0].name if len(node.names) == 1 else "speechsdk"
        if len(node.names) == 1 and (node.names[0].asname or node.names[0].name) != "speechsdk":
            # import as speechsdk style: `import azure... as speechsdk` handled above
            assign = f"{local} = get_third_package_speechsdk()"
        return ("getter_replace", f"from pycore.pyfoundations.third_party import {gname}", assign)

    # optional third-party from-import
    if len(node.names) == 1:
        local = node.names[0].asname or node.names[0].name
        flag = f"_{local.upper()}_AVAILABLE"
        block = (
            f"try:\n"
            f"    {_format_from(abs_mod, node.names)}\n"
            f"    {flag} = True\n"
            f"except ImportError:\n"
            f"    {local} = None\n"
            f"    {flag} = False"
        )
        return ("optional_top", block, None)

    return ("skip", None, None)


def process_file(file_path: Path, pycore_root: Path, dry_run: bool) -> Tuple[int, int, List[str]]:
    """
    Returns (hoisted_count, skipped_count, messages).
    """
    msgs: List[str] = []
    try:
        src = file_path.read_text(encoding="utf-8")
    except OSError as e:
        return (0, 0, [f"read fail {file_path}: {e}"])

    try:
        tree = ast.parse(src)
    except SyntaxError as e:
        return (0, 0, [f"syntax {file_path}: {e}"])

    collector = BodyImportCollector()
    collector.visit(tree)
    if not collector.nodes:
        return (0, 0, [])

    top_names = _module_top_import_keys(tree)
    # also track getters already imported
    top_src_keys: Set[Tuple] = set()
    for stmt in tree.body:
        if isinstance(stmt, (ast.Import, ast.ImportFrom)):
            top_src_keys.add(_import_key(stmt))
        elif isinstance(stmt, ast.Try):
            for s in stmt.body:
                if isinstance(s, (ast.Import, ast.ImportFrom)):
                    top_src_keys.add(_import_key(s))

    lines = src.splitlines(keepends=True)
    # Work on line ops from bottom to top for deletions/replacements
    # Plan: list of (lineno_start, lineno_end, replacement_lines_or_None_to_delete)
    edits: List[Tuple[int, int, Optional[List[str]]]] = []
    hoist_stmts: List[str] = []  # preserve order, unique
    seen_hoist: Set[str] = set()
    hoisted = 0
    skipped = 0

    # Sort nodes by lineno descending for safe edits
    nodes_sorted = sorted(collector.nodes, key=lambda n: n.lineno, reverse=True)

    for node in nodes_sorted:
        kind, hoist_stmt, replace_stmt = _classify(node, file_path, pycore_root)

        # ImportError-guarded third-party: only process via getters (lazy call).
        # Internal pycore/relative MUST hoist (spec: never lazy/try-except).
        guarded = _parent_try_is_import_guard(tree, node)
        is_internal = False
        if isinstance(node, ast.ImportFrom):
            abs_mod = _resolve_relative(node, file_path, pycore_root)
            if abs_mod and (abs_mod == "pycore" or abs_mod.startswith("pycore.")):
                is_internal = True
            elif node.level:
                is_internal = True
        elif isinstance(node, ast.Import):
            if any(a.name == "pycore" or a.name.startswith("pycore.") for a in node.names):
                is_internal = True
        if guarded and not is_internal and kind != "getter_replace":
            # Stdlib still hoists (always present); platform-specific use optional_top.
            if kind == "hoist":
                pass  # continue processing
            elif kind == "optional_top":
                pass
            else:
                skipped += 1
                msgs.append(
                    f"SKIP_GUARD {file_path.relative_to(pycore_root)}:{node.lineno}"
                )
                continue

        if kind == "skip" or hoist_stmt is None:
            skipped += 1
            msgs.append(f"SKIP {file_path.relative_to(pycore_root)}:{node.lineno}")
            continue

        names = _bound_names(node)
        abs_mod = None
        if isinstance(node, ast.ImportFrom):
            abs_mod = _resolve_relative(node, file_path, pycore_root)
        key = _import_key(node, abs_mod)

        # Conflict check for hoist/optional: same local name, different key
        conflict = False
        for n in names:
            if n in top_names and top_names[n] != key:
                # Allow if we're doing getter replace into same name from third_party
                if kind != "getter_replace":
                    conflict = True
                    break
        if conflict:
            skipped += 1
            msgs.append(
                f"CONFLICT {file_path.relative_to(pycore_root)}:{node.lineno} names={names}"
            )
            continue

        start = node.lineno
        end = node.end_lineno or node.lineno

        if kind == "hoist":
            # Idempotent: add to top only if not already there
            if hoist_stmt not in seen_hoist and key not in top_src_keys:
                # also check textual presence of same names from same module
                need = False
                for n in names:
                    if n not in top_names:
                        need = True
                        break
                if need or key not in top_src_keys:
                    hoist_stmts.append(hoist_stmt)
                    seen_hoist.add(hoist_stmt)
                    for n in names:
                        top_names[n] = key
                    top_src_keys.add(key)
            edits.append((start, end, None))  # delete body import
            hoisted += 1

        elif kind == "getter_replace":
            if hoist_stmt not in seen_hoist:
                # check if getter already imported
                gname = hoist_stmt.rsplit(" ", 1)[-1]
                if gname not in top_names:
                    hoist_stmts.append(hoist_stmt)
                    seen_hoist.add(hoist_stmt)
                    top_names[gname] = ("from", "pycore.pyfoundations.third_party", ((gname, None),))
            assert replace_stmt is not None
            # Match indentation of the import line
            raw = lines[start - 1]
            indent = raw[: len(raw) - len(raw.lstrip())]
            repl = [indent + replace_stmt + ("\n" if not replace_stmt.endswith("\n") else "")]
            edits.append((start, end, repl))
            hoisted += 1

        elif kind == "optional_top":
            if hoist_stmt not in seen_hoist:
                # if name already at top, just delete body import
                all_present = all(n in top_names for n in names)
                if not all_present:
                    hoist_stmts.append(hoist_stmt)
                    seen_hoist.add(hoist_stmt)
                    for n in names:
                        top_names[n] = key
            edits.append((start, end, None))
            hoisted += 1

    if not edits and not hoist_stmts:
        return (0, skipped, msgs)

    def _needs_pass_after_delete(start: int, end: int) -> bool:
        """If deleting the only stmt in a try/except/if/for/while/with body, keep pass."""
        raw = lines[start - 1]
        indent = raw[: len(raw) - len(raw.lstrip())]
        # Look upward for a compound header with smaller indent
        header_indent = None
        for i in range(start - 2, -1, -1):
            s = lines[i]
            if not s.strip() or s.lstrip().startswith("#"):
                continue
            ind = s[: len(s) - len(s.lstrip())]
            if len(ind) < len(indent) and s.rstrip().endswith(":"):
                header = s.strip()
                if header.startswith(("try:", "except", "finally:", "else:", "elif ", "if ", "for ", "while ", "with ")):
                    header_indent = ind
                break
            if len(ind) < len(indent):
                break
        if header_indent is None:
            return False
        # Any other sibling stmt at same indent between header and except/else?
        for i in range(start - 2, -1, -1):
            s = lines[i]
            if not s.strip():
                continue
            ind = s[: len(s) - len(s.lstrip())]
            if len(ind) == len(header_indent) and s.rstrip().endswith(":"):
                break
            if len(ind) == len(indent) and i + 1 != start:
                # another body stmt above
                if not s.lstrip().startswith("#"):
                    return False
        for i in range(end, len(lines)):
            s = lines[i]
            if not s.strip():
                continue
            ind = s[: len(s) - len(s.lstrip())]
            if len(ind) == len(indent):
                return False  # another body stmt below
            if len(ind) <= len(header_indent):
                return True  # hit except/else/outdent with empty body
            break
        return True

    # Apply body edits (already descending by lineno)
    edits.sort(key=lambda e: e[0], reverse=True)
    for start, end, repl in edits:
        before = lines[: start - 1]
        after = lines[end:]
        if repl is None:
            if _needs_pass_after_delete(start, end):
                raw = lines[start - 1]
                indent = raw[: len(raw) - len(raw.lstrip())]
                repl = [indent + "pass\n"]
                lines = before + repl + after
            else:
                lines = before + after
        else:
            lines = before + repl + after

    # Insert hoist block after import header — re-parse line count shifts
    # Recompute insert index from original tree then adjust by net deleted lines above insert?
    # Simpler: recompute from still-valid approximate: use original insert index,
    # then count how many deleted lines before that index.
    insert_at = _find_insert_index(src.splitlines(keepends=True), tree)
    deleted_before = 0
    for start, end, repl in edits:
        if end <= insert_at:
            old_len = end - start + 1
            new_len = 0 if repl is None else len(repl)
            deleted_before += old_len - new_len
        elif start <= insert_at < end:
            # import straddled header — rare
            pass
    insert_at = max(0, insert_at - deleted_before)

    if hoist_stmts:
        # reverse so that first collected stays first after sequential insert? 
        # We collected while scanning bottom-up — reverse hoist_stmts to restore top-down order
        ordered = list(reversed(hoist_stmts))
        block_lines: List[str] = []
        # Deduplicate again idempotently against current file text
        current_text = "".join(lines)
        for stmt in ordered:
            # For multi-line optional blocks, check first line
            first = stmt.splitlines()[0]
            if first in current_text and stmt.startswith("try:"):
                # fragile; check flag name
                continue
            if stmt in current_text and not stmt.startswith("try:"):
                continue
            if not stmt.endswith("\n"):
                stmt_out = stmt + "\n"
            else:
                stmt_out = stmt
            if stmt.startswith("try:"):
                for sub in stmt.splitlines():
                    block_lines.append(sub + "\n")
            else:
                block_lines.append(stmt_out)
        if block_lines:
            # Ensure blank line before following code
            nl = ["\n"] if insert_at < len(lines) and lines[insert_at - 1:insert_at] and not lines[insert_at - 1].endswith("\n\n") else []
            # single newline separation
            sep_before = []
            if insert_at > 0 and lines[insert_at - 1].strip() != "":
                sep_before = ["\n"]
            sep_after = ["\n"]
            lines = lines[:insert_at] + sep_before + block_lines + sep_after + lines[insert_at:]

    new_src = "".join(lines)
    # Validate syntax
    try:
        ast.parse(new_src)
    except SyntaxError as e:
        msgs.append(f"ABORT syntax after edit {file_path}: {e}")
        return (0, skipped + hoisted, msgs)

    if not dry_run and new_src != src:
        file_path.write_text(new_src, encoding="utf-8")

    return (hoisted, skipped, msgs)


def iter_py_files(pycore_root: Path) -> List[Path]:
    out: List[Path] = []
    for p in pycore_root.rglob("*.py"):
        if any(part in SKIP_DIR_NAMES for part in p.parts):
            continue
        if "third_party" in p.parts and p.name.startswith("_"):
            continue
        if p.name == "hoist_imports.py":
            continue
        out.append(p)
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description="Idempotent hoist of pycore function-body imports")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--root",
        default=str(Path(__file__).resolve().parents[1]),
        help="pycore root directory",
    )
    parser.add_argument("--limit", type=int, default=0, help="Max files to modify (0=all)")
    args = parser.parse_args()
    pycore_root = Path(args.root).resolve()

    total_h = 0
    total_s = 0
    changed_files = 0
    all_msgs: List[str] = []
    files = iter_py_files(pycore_root)
    modified = 0
    for fp in files:
        h, s, msgs = process_file(fp, pycore_root, dry_run=args.dry_run)
        if h or s or msgs:
            if h:
                changed_files += 1
                modified += 1
            total_h += h
            total_s += s
            all_msgs.extend(msgs)
            rel = fp.relative_to(pycore_root)
            print(f"[{'DRY' if args.dry_run else 'OK'}] {rel}: hoisted={h} skipped={s}")
        if args.limit and modified >= args.limit:
            break

    print(f"\nSUMMARY files_touched={changed_files} hoisted={total_h} skipped={total_s}")
    conflicts = [m for m in all_msgs if m.startswith("CONFLICT") or m.startswith("ABORT")]
    if conflicts:
        print(f"CONFLICTS/ABORTS ({len(conflicts)}):")
        for m in conflicts[:40]:
            print(" ", m)
    return 0


if __name__ == "__main__":
    sys.exit(main())
