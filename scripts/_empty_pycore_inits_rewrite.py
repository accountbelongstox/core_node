# -*- coding: utf-8 -*-
"""
Phase 2-4: rewrite package-facade imports to concrete modules, then empty
all pycore **/__init__.py to the standard marker comment.
"""
from __future__ import annotations

import ast
import re
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

REPO = Path(__file__).resolve().parents[1]
PYCORE = REPO / "pycore"
MARKER = (
    "# Package marker only. FORBIDDEN: re-exports or package organization here.\n"
    "# Import concrete modules directly (see development-guides/PYTHON_PYCORE.md).\n"
)

# (package_dotted, symbol) -> concrete_module_dotted
SymbolMap = Dict[Tuple[str, str], str]

# Packages whose public surface moved out of __init__.py
PACKAGE_DEFAULT_MODULE: Dict[str, str] = {
    "pycore.pyfoundations.thread_bus": "pycore.pyfoundations.thread_bus.bus",
    "pycore.pyfoundations.third_party": "pycore.pyfoundations.third_party.api",
    "pycore.database": "pycore.database.exports",
    "pycore.pyutils.native_ui.step0_i18n": "pycore.pyutils.native_ui.step0_i18n.i18n_manager",
    "pycore.pylauncher": "pycore.pylauncher.launcher",  # refined per-symbol below
}

# Per-symbol overrides (after generic maps)
SYMBOL_OVERRIDES: Dict[Tuple[str, str], str] = {
    ("pycore", "ColorPrint"): "pycore.pyfoundations.pybasecommon.color_print",
    ("pycore", "THREAD_BUS"): "pycore.pyfoundations.thread_bus.bus",
    ("pycore", "ENCYCLOPEDIA"): "pycore.pyfoundations.pybasecommon.encyclopedia",
    ("pycore", "EventBus"): "pycore.pyfoundations.event_bus",
    ("pycore", "EventTypes"): "pycore.pyfoundations.event_bus",
    ("pycore", "Event"): "pycore.pyfoundations.event_bus",
    ("pycore", "UserDataStore"): "pycore.database.repositories.user_data_store",
    ("pycore", "get_user_data_store"): "pycore.database.repositories.user_data_store",
    ("pycore", "GlobalVarManager"): "pycore.pyfoundations.pygvar",
    ("pycore", "get_gpu_info"): "pycore.pyfoundations.pybasecommon.encyclopedia",
    ("pycore.pyfoundations", "THREAD_BUS"): "pycore.pyfoundations.thread_bus.bus",
    ("pycore.pyfoundations", "ColorPrint"): "pycore.pyfoundations.pybasecommon.color_print",
    ("pycore.pyfoundations.thread_bus", "THREAD_BUS"): "pycore.pyfoundations.thread_bus.bus",
    ("pycore.pyfoundations.thread_bus", "ThreadBus"): "pycore.pyfoundations.thread_bus.bus",
    ("pycore.pyfoundations.thread_bus", "ShutdownStack"): "pycore.pyfoundations.thread_bus.shutdown_stack",
    ("pycore.pyfoundations.thread_bus", "EventHandlerRegistry"): "pycore.pyfoundations.thread_bus.event_handler_registry",
    ("pycore.pylauncher", "LauncherConfig"): "pycore.pylauncher.launcher",
    ("pycore.pylauncher", "ServiceLauncher"): "pycore.pylauncher.launcher",
    ("pycore.pylauncher", "on_singleton_superseded"): "pycore.pylauncher.launcher",
    ("pycore.pylauncher", "launch_services"): "pycore.pylauncher.launcher",
    ("pycore.pylauncher", "stop_services"): "pycore.pylauncher.launcher",
    ("pycore.pylauncher", "AppExecutableLauncher"): "pycore.pylauncher.app_executable_launcher",
    ("pycore.pylauncher", "get_app_executable_launcher"): "pycore.pylauncher.app_executable_launcher",
    ("pycore.pylauncher", "launch_with_native_ui"): "pycore.pylauncher.native_launcher",
    ("pycore.pyheartbeat", "CallbackInfo"): "pycore.pyheartbeat.heartbeat",
    ("pycore.pyheartbeat", "HeartbeatPusher"): "pycore.pyheartbeat.heartbeat",
    ("pycore.pyheartbeat", "HeartbeatPusherThread"): "pycore.pyheartbeat.heartbeat",
    ("pycore.pyheartbeat", "HeartbeatSystem"): "pycore.pyheartbeat.heartbeat",
    ("pycore.pyheartbeat", "get_heartbeat_system"): "pycore.pyheartbeat.heartbeat",
    ("pycore.pyheartbeat", "initialize_heartbeat_system"): "pycore.pyheartbeat.heartbeat",
    ("pycore.pyutils.native_ui.step0_i18n", "i18n"): "pycore.pyutils.native_ui.step0_i18n.i18n_manager",
    ("pycore.pyutils.native_ui.step0_i18n", "I18nManager"): "pycore.pyutils.native_ui.step0_i18n.i18n_manager",
    ("pycore.pyutils.native_ui.step0_i18n", "get_i18n_manager"): "pycore.pyutils.native_ui.step0_i18n.i18n_manager",
    ("pycore.pyutils.native_ui.step0_i18n", "I18nKeys"): "pycore.pyutils.native_ui.step0_i18n.i18n_keys",
    ("pycore.pyutils.azure_speech", "speech_recognizer"): "pycore.pyutils.azure_speech.speech_recognizer",
    ("pycore.pyutils.azure_speech", "SPEECH_RECOGNITION_AVAILABLE"): "pycore.pyutils.azure_speech.speech_recognizer",
    ("pycore.pyutils.whisper_stt", "whisper_stt_provider"): "pycore.pyutils.whisper_stt.whisper_provider",
    ("pycore.pyutils.ai_cluster.openrouter", "openrouter_client"): "pycore.pyutils.ai_cluster.openrouter.openrouter_client",
}

# Rename get_gpu_info onto encyclopedia if missing
def ensure_get_gpu_info() -> None:
    enc = PYCORE / "pyfoundations/pybasecommon/encyclopedia.py"
    text = enc.read_text(encoding="utf-8")
    if "def get_gpu_info" not in text:
        text = text.rstrip() + """

def get_gpu_info():
    \"\"\"Return cached GPU information without initializing unrelated features.\"\"\"
    return ENCYCLOPEDIA.get(\"pycore_gpu_info\")
"""
        enc.write_text(text + "\n", encoding="utf-8", newline="\n")
        print("added get_gpu_info to encyclopedia.py")


def path_to_pkg(init_path: Path) -> str:
    rel = init_path.relative_to(PYCORE.parent)
    # pycore/.../__init__.py -> pycore....
    parts = list(rel.parts[:-1])
    return ".".join(parts)


def parse_exports(init_path: Path) -> Dict[str, str]:
    """Return symbol -> module for one __init__.py (best effort)."""
    text = init_path.read_text(encoding="utf-8", errors="replace")
    pkg = path_to_pkg(init_path)
    out: Dict[str, str] = {}

    # Lazy _EXPORTS map via regex (robust to formatting)
    for m in re.finditer(
        r'["\'](\w+)["\']\s*:\s*\(\s*["\']([^"\']+)["\']\s*,\s*["\'](\w+)["\']\s*\)',
        text,
    ):
        sym, mod, _attr = m.group(1), m.group(2), m.group(3)
        out[sym] = mod

    try:
        tree = ast.parse(text)
    except SyntaxError:
        # Broken __init__ (e.g. device) — keep regex hits only
        return out

    for node in tree.body:
        if isinstance(node, ast.ImportFrom):
            parts = pkg.split(".")
            if node.level:
                # level=1 stays in current package; level=2 goes to parent; etc.
                up = node.level - 1
                parent = parts[:-up] if up else list(parts)
                if node.module:
                    mod = ".".join(parent + node.module.split("."))
                else:
                    mod = ".".join(parent)
            else:
                mod = node.module or pkg

            for alias in node.names:
                if alias.name == "*":
                    continue
                name = alias.asname or alias.name
                out[name] = mod

        # Assignments like speech_recognizer = get_speech_recognizer() stay in package
        # until moved — handled by SYMBOL_OVERRIDES / PACKAGE_DEFAULT_MODULE

    return out


def build_symbol_map() -> SymbolMap:
    smap: SymbolMap = {}
    package_exports: Dict[str, Dict[str, str]] = {}

    for init in PYCORE.rglob("__init__.py"):
        pkg = path_to_pkg(init)
        exports = parse_exports(init)
        package_exports[pkg] = exports
        for sym, mod in exports.items():
            smap[(pkg, sym)] = mod

    # Apply known overrides first
    for key, mod in SYMBOL_OVERRIDES.items():
        smap[key] = mod

    # Apply package default module for any symbol still pointing at the package itself
    # and for packages we relocated
    for (pkg, sym), mod in list(smap.items()):
        if mod in PACKAGE_DEFAULT_MODULE:
            smap[(pkg, sym)] = PACKAGE_DEFAULT_MODULE[mod]
        # thread_bus TARGET_BUS fix from pyfoundations map
        if mod == "pycore.pyfoundations.thread_bus":
            smap[(pkg, sym)] = "pycore.pyfoundations.thread_bus.bus"
        if mod == "pycore.pyfoundations.third_party":
            smap[(pkg, sym)] = "pycore.pyfoundations.third_party.api"

    # Transitive resolve: if target is a package that also exports the symbol, follow
    for _ in range(6):
        changed = False
        for (pkg, sym), mod in list(smap.items()):
            # Prefer looking up (mod, sym) then (mod, attr) if different
            if (mod, sym) in smap and smap[(mod, sym)] != mod:
                new = smap[(mod, sym)]
                if new != mod and not new.endswith(sym):  # still a module path
                    # only follow if new looks like a module and differs
                    if new != smap[(pkg, sym)]:
                        smap[(pkg, sym)] = new
                        changed = True
            elif mod in PACKAGE_DEFAULT_MODULE:
                new = PACKAGE_DEFAULT_MODULE[mod]
                if new != smap[(pkg, sym)]:
                    smap[(pkg, sym)] = new
                    changed = True
        if not changed:
            break

    # Final override pass
    for key, mod in SYMBOL_OVERRIDES.items():
        smap[key] = mod

    # Any remaining import of relocated packages without symbol map entry:
    # handled at rewrite time via PACKAGE_DEFAULT_MODULE

    # Force third_party public surface through api.py
    for (pkg, sym), mod in list(smap.items()):
        if mod.startswith("pycore.pyfoundations.third_party._") or mod == "pycore.pyfoundations.third_party":
            smap[(pkg, sym)] = "pycore.pyfoundations.third_party.api"
        if pkg == "pycore.pyfoundations.third_party":
            smap[(pkg, sym)] = "pycore.pyfoundations.third_party.api"

    # Force callmodule.services symbols onto services.* modules (never drop .services)
    for (pkg, sym), mod in list(smap.items()):
        if pkg == "pycore.callmodule.services" and mod.startswith("pycore.callmodule.") and ".services." not in mod:
            if mod != "pycore.callmodule.services":
                tail = mod.rsplit(".", 1)[-1]
                smap[(pkg, sym)] = f"pycore.callmodule.services.{tail}"

    return smap, package_exports


def resolve_symbol(smap: SymbolMap, pkg: str, sym: str) -> Optional[str]:
    if (pkg, sym) in smap:
        return smap[(pkg, sym)]
    if pkg in PACKAGE_DEFAULT_MODULE:
        return PACKAGE_DEFAULT_MODULE[pkg]
    return None


FROM_IMPORT_RE = re.compile(
    r"^(\s*)from\s+([\w.]+)\s+import\s+\(?\s*([\s\S]*?)\s*\)?\s*$",
    re.MULTILINE,
)


def split_import_names(names_blob: str) -> List[Tuple[str, Optional[str]]]:
    """Parse 'A, B as C, D' into [(A,None),(B,C),(D,None)]."""
    names_blob = names_blob.replace("(", "").replace(")", "").replace("\\", " ")
    parts = []
    for chunk in names_blob.split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        if " as " in chunk:
            a, b = chunk.split(" as ", 1)
            parts.append((a.strip(), b.strip()))
        else:
            parts.append((chunk, None))
    return parts


def rewrite_file(path: Path, smap: SymbolMap) -> bool:
    text = path.read_text(encoding="utf-8", errors="replace")
    original = text

    # Skip our own scripts
    if path.name.startswith("_empty_pycore"):
        return False

    # Process from-import lines (including multi-line parenthesized)
    lines = text.splitlines(keepends=True)
    out_lines: List[str] = []
    i = 0
    changed = False

    while i < len(lines):
        line = lines[i]
        stripped = line.lstrip()
        if stripped.startswith("from ") and " import " in stripped:
            # gather continued / parenthesized import
            block = line
            j = i
            open_parens = block.count("(") - block.count(")")
            while open_parens > 0 and j + 1 < len(lines):
                j += 1
                block += lines[j]
                open_parens = block.count("(") - block.count(")")
            # also handle trailing backslash continuations
            while block.rstrip().endswith("\\") and j + 1 < len(lines):
                j += 1
                block += lines[j]

            m = re.match(
                r"^(\s*)from\s+([\w.]+)\s+import\s+([\s\S]+)$",
                block.rstrip("\n"),
            )
            if not m:
                out_lines.append(block if j > i else line)
                i = j + 1
                continue

            indent, pkg, names_blob = m.group(1), m.group(2), m.group(3)
            if not pkg.startswith("pycore"):
                out_lines.extend(lines[i : j + 1])
                i = j + 1
                continue

            # relative? shouldn't appear as absolute pycore
            names = split_import_names(names_blob)
            if any(n == "*" for n, _ in names):
                # star imports from packages: redirect package to default module if known
                if pkg in PACKAGE_DEFAULT_MODULE:
                    new_pkg = PACKAGE_DEFAULT_MODULE[pkg]
                    new_block = f"{indent}from {new_pkg} import {names_blob.strip()}\n"
                    if new_block != block if block.endswith("\n") else new_block != block + "\n":
                        out_lines.append(new_block if new_block.endswith("\n") else new_block + "\n")
                        changed = True
                    else:
                        out_lines.extend(lines[i : j + 1])
                else:
                    out_lines.extend(lines[i : j + 1])
                i = j + 1
                continue

            # Group symbols by resolved module
            groups: Dict[str, List[Tuple[str, Optional[str]]]] = defaultdict(list)
            unresolved: List[Tuple[str, Optional[str]]] = []
            for sym, alias in names:
                target = resolve_symbol(smap, pkg, sym)
                if target is None:
                    # If importing from a package that only had re-exports, try default
                    if pkg in PACKAGE_DEFAULT_MODULE:
                        target = PACKAGE_DEFAULT_MODULE[pkg]
                    elif (PYCORE.parent / Path(*pkg.split(".")) / "__init__.py").exists() and not (
                        PYCORE.parent / Path(*pkg.split("."))
                    ).with_suffix(".py").exists():
                        # still a package — leave for now if no mapping (may be namespace-only OK)
                        # If symbol was only on facade, this will break; log
                        unresolved.append((sym, alias))
                        continue
                    else:
                        # concrete module already — keep
                        groups[pkg].append((sym, alias))
                        continue
                # If target equals pkg, keep as-is (already concrete or unresolved package)
                if target == pkg:
                    # Check if pkg is a package dir with only __init__ — then need override
                    pkg_path = PYCORE.parent / Path(*pkg.split("."))
                    if (pkg_path / "__init__.py").exists() and not any(
                        p.suffix == ".py" and p.name != "__init__.py" for p in pkg_path.glob("*.py")
                    ):
                        unresolved.append((sym, alias))
                    else:
                        # Might still be package with submodules; if symbol not in map, keep
                        groups[pkg].append((sym, alias))
                else:
                    groups[target].append((sym, alias))

            if unresolved and not groups:
                out_lines.extend(lines[i : j + 1])
                i = j + 1
                continue

            if not groups and unresolved:
                out_lines.extend(lines[i : j + 1])
                i = j + 1
                continue

            # Emit one import per target module
            new_blocks: List[str] = []
            for target, items in groups.items():
                # skip rewrite if identical single-group to same pkg
                parts = []
                for sym, alias in items:
                    parts.append(f"{sym} as {alias}" if alias else sym)
                joined = ", ".join(parts)
                if len(parts) > 3:
                    inner = ",\n".join(f"{indent}    {p}" for p in parts)
                    new_blocks.append(f"{indent}from {target} import (\n{inner},\n{indent})\n")
                else:
                    new_blocks.append(f"{indent}from {target} import {joined}\n")

            for sym, alias in unresolved:
                # fallback: leave original symbol on pkg (will fail later if cleared)
                part = f"{sym} as {alias}" if alias else sym
                new_blocks.append(f"{indent}from {pkg} import {part}\n")

            new_text = "".join(new_blocks)
            old_text = "".join(lines[i : j + 1])
            if new_text != old_text:
                changed = True
                # Only rewrite if we actually moved something off the package
                if any(t != pkg for t in groups.keys()) or unresolved:
                    out_lines.append(new_text)
                else:
                    out_lines.extend(lines[i : j + 1])
                    changed = False if new_text == old_text else changed
            else:
                out_lines.extend(lines[i : j + 1])
            i = j + 1
            continue

        out_lines.append(line)
        i += 1

    new_text = "".join(out_lines)
    if new_text != original:
        try:
            path.write_text(new_text, encoding="utf-8")
        except OSError as exc:
            print(f"WRITE FAIL {path}: {exc}")
            return False
        return True
    return False


def empty_all_inits() -> int:
    count = 0
    for init in PYCORE.rglob("__init__.py"):
        init.write_text(MARKER, encoding="utf-8", newline="\n")
        count += 1
    return count


def ensure_register_providers_import() -> None:
    targets = [
        PYCORE / "pycore_module_caller.py",
        PYCORE / "callmodule/callmodule_main.py",
    ]
    needle = "import pycore.pylauncher.register_providers"
    import_line = "import pycore.pylauncher.register_providers  # noqa: F401 — provider registration\n"
    for path in targets:
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        if needle in text:
            continue
        # insert after path bootstrap, before other pylauncher imports
        if "from pycore.pylauncher" in text:
            text = text.replace(
                "from pycore.pylauncher",
                import_line + "from pycore.pylauncher",
                1,
            )
        else:
            text = import_line + text
        path.write_text(text, encoding="utf-8", newline="\n")
        print(f"wired register_providers in {path.relative_to(REPO)}")


def collect_py_files() -> List[Path]:
    files: List[Path] = []
    for base in [PYCORE, REPO / "pyapps", REPO / "poly_apps", REPO / "scripts"]:
        if not base.exists():
            continue
        for p in base.rglob("*.py"):
            if "__pycache__" in p.parts:
                continue
            if p.name == "__init__.py" and PYCORE in p.parents:
                # still rewrite __init__ content before emptying? skip — we'll empty
                continue
            files.append(p)
    return files


def main() -> None:
    ensure_get_gpu_info()
    smap, package_exports = build_symbol_map()
    print(f"symbol map entries: {len(smap)}")
    print(f"packages parsed: {len(package_exports)}")

    # Dump a few key resolutions
    for key in [
        ("pycore", "ColorPrint"),
        ("pycore", "THREAD_BUS"),
        ("pycore.pyfoundations", "ColorPrint"),
        ("pycore.pyfoundations", "THREAD_BUS"),
        ("pycore.database", "StateRepository"),
        ("pycore.pylauncher", "ServiceLauncher"),
        ("pycore.pyheartbeat", "get_heartbeat_system"),
        ("pycore.callmodule.services", "get_translation_worker_service"),
        ("pycore.pyfoundations.third_party", "get_third_package_sqlalchemy"),
    ]:
        print(f"  {key} -> {resolve_symbol(smap, key[0], key[1])}")

    ensure_register_providers_import()

    files = collect_py_files()
    # Also rewrite pycore __init__ files BEFORE emptying so internal relative maps aren't needed
    # Actually we skip __init__; rewrite callers only

    changed = 0
    errors = 0
    for path in files:
        try:
            if rewrite_file(path, smap):
                changed += 1
                print(f"rewrote {path.relative_to(REPO)}")
        except Exception as exc:
            errors += 1
            print(f"ERROR {path.relative_to(REPO)}: {exc}")

    print(f"files rewritten: {changed}/{len(files)} errors={errors}")

    n = empty_all_inits()
    print(f"emptied __init__.py markers: {n}")


if __name__ == "__main__":
    main()
