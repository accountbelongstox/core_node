# -*- coding: utf-8 -*-
"""
Code Sync filter settings — what to exclude from the synced/scanned tree.

Two-tier, exactly like peer_config:
  * PRESETS below  — the code-frozen defaults (single source of truth; what ships).
  * OVERRIDE file   — per-machine `<core_node>/.data/pycore/codesync/sync_settings.json`
                      (gitignored). Loaded with priority; only the keys present in
                      the override replace the presets, so each machine can tweak
                      filters WITHOUT touching code, and edits never churn the repo.

Settings:
  excluded_dirs            — directory NAMES pruned at any depth (e.g. node_modules).
  excluded_files           — file NAMES excluded at any depth.
  excluded_extensions      — file suffixes excluded (".pyc", ".log", ...).
  excluded_path_substrings — exclude any path whose posix relpath CONTAINS the string
                             (catch-all for "anywhere in a sub-path").
  apply_gitignore          — also honour the repo root `.gitignore` (best-effort,
                             stdlib glob→regex; default off).

Stdlib only: paths/log via `.runtime`; no pycore import, no third_party.
"""

import json
import os
import re
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional

from .runtime import log as ColorPrint, get_core_node_root

# --------------------------------------------------------------------------- #
# Presets (code-frozen defaults) — the single source of truth.                #
# --------------------------------------------------------------------------- #
PRESET_EXCLUDED_DIRS: List[str] = [
    "__pycache__", ".git", ".hg", ".svn",
    "node_modules", ".next", ".nuxt", "dist", "build", "out",
    ".cache", ".vite", ".turbo", ".parcel-cache",
    ".dart_tool", "flutter_build",
    "venv", "env", ".venv", "__pypackages__",
    ".pytest_cache", ".mypy_cache", ".ruff_cache",
    "target",          # Rust
    "bin", "obj",      # C#
    ".gradle", ".m2",  # Java
    ".idea", ".vscode",
    "coverage", ".nyc_output", ".runtime_cache",
    ".data", ".ai_state", "temp", "tmp", "logs",
]

# The peer config replicates over the mesh (peer_mesh.py), NOT the file-sync,
# so it must never be transferred as a normal code file.
PRESET_EXCLUDED_FILES: List[str] = [
    "code_sync_peers.json",
    "sync_settings.json",
]

PRESET_EXCLUDED_EXTENSIONS: List[str] = [
    ".pyc", ".pyo", ".pyd", ".so", ".dll", ".dylib", ".exe",
    ".log", ".sqlite", ".sqlite3", ".db", ".tmp", ".swp", ".bak",
    ".class", ".o", ".a", ".lib",
]

PRESET_EXCLUDED_PATH_SUBSTRINGS: List[str] = []

PRESET_APPLY_GITIGNORE: bool = False

# Directories the dev watches/pushes. Empty = the project root (get_core_node_root).
# Each entry maps to the client under its path relative to the core_node root (a dir
# outside the root maps under its basename), so subdirs become the client's subdirs.
PRESET_WATCH_DIRS: List[str] = []

_KEYS = ("excluded_dirs", "excluded_files", "excluded_extensions",
         "excluded_path_substrings", "apply_gitignore", "watch_dirs")


def get_sync_settings_file() -> Path:
    """Per-machine override (gitignored)."""
    return get_core_node_root() / ".data" / "pycore" / "codesync" / "sync_settings.json"


def presets() -> Dict[str, Any]:
    return {
        "excluded_dirs": sorted(set(PRESET_EXCLUDED_DIRS)),
        "excluded_files": sorted(set(PRESET_EXCLUDED_FILES)),
        "excluded_extensions": sorted(set(PRESET_EXCLUDED_EXTENSIONS)),
        "excluded_path_substrings": list(PRESET_EXCLUDED_PATH_SUBSTRINGS),
        "apply_gitignore": PRESET_APPLY_GITIGNORE,
        "watch_dirs": list(PRESET_WATCH_DIRS),
    }


# --------------------------------------------------------------------------- #
# Best-effort .gitignore matcher (stdlib glob -> regex).                       #
# --------------------------------------------------------------------------- #
class _GitIgnore:
    """Compiles the repo-root .gitignore into regexes. Best-effort: supports
    comments, blank lines, `!` negation, trailing `/` (dir-only), leading `/`
    (anchored), `*`, `?`, and `**`. Nested .gitignore files are not read."""

    def __init__(self, root: Path):
        self._rules: List[tuple] = []  # (compiled_regex, dir_only, negate)
        self._load(Path(root) / ".gitignore")

    def _load(self, path: Path) -> None:
        try:
            if not path.exists():
                return
            for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
                line = raw.strip()
                if not line or line.startswith("#"):
                    continue
                negate = line.startswith("!")
                if negate:
                    line = line[1:]
                dir_only = line.endswith("/")
                line = line.rstrip("/")
                anchored = line.startswith("/")
                if anchored:
                    line = line[1:]
                if not line:
                    continue
                self._rules.append((self._compile(line, anchored), dir_only, negate))
        except Exception as exc:
            ColorPrint.yellow(f"[SyncSettings] .gitignore parse failed: {exc}")

    @staticmethod
    def _compile(pattern: str, anchored: bool) -> "re.Pattern":
        out: List[str] = []
        i, n = 0, len(pattern)
        while i < n:
            if pattern[i:i + 3] == "**/":
                out.append("(?:.*/)?"); i += 3
            elif pattern[i:i + 2] == "**":
                out.append(".*"); i += 2
            elif pattern[i] == "*":
                out.append("[^/]*"); i += 1
            elif pattern[i] == "?":
                out.append("[^/]"); i += 1
            elif pattern[i] == "/":
                out.append("/"); i += 1
            else:
                out.append(re.escape(pattern[i])); i += 1
        body = "".join(out)
        # Anchored or containing a slash -> match from the repo root; otherwise the
        # name may match at any depth.
        prefix = "^" if (anchored or "/" in pattern) else "(?:^|.*/)"
        return re.compile(prefix + body + r"(?:/.*)?$")

    def ignored(self, rel_posix: str, is_dir: bool) -> bool:
        result = False
        for rx, dir_only, negate in self._rules:
            if dir_only and not is_dir:
                continue
            if rx.match(rel_posix):
                result = not negate  # last matching rule wins (gitignore semantics)
        return result


# --------------------------------------------------------------------------- #
# Excluder — applied during a single scan (server + stats share this).         #
# --------------------------------------------------------------------------- #
class Excluder:
    def __init__(self, root: Path, settings: Dict[str, Any]):
        self.root = Path(root)
        self._dirs = set(settings.get("excluded_dirs") or [])
        self._files = set(settings.get("excluded_files") or [])
        self._exts = tuple(settings.get("excluded_extensions") or [])
        self._subs = [s for s in (settings.get("excluded_path_substrings") or []) if s]
        self._gi = _GitIgnore(self.root) if settings.get("apply_gitignore") else None

    def _rel(self, path) -> str:
        try:
            return Path(path).resolve().relative_to(self.root.resolve()).as_posix()
        except Exception:
            return Path(path).name

    def dir_excluded(self, name: str, path) -> bool:
        if name in self._dirs:
            return True
        rel = self._rel(path)
        if any(s in rel for s in self._subs):
            return True
        if self._gi and self._gi.ignored(rel, True):
            return True
        return False

    def file_excluded(self, name: str, path) -> bool:
        if name in self._files:
            return True
        if self._exts and name.endswith(self._exts):
            return True
        rel = self._rel(path)
        if any(s in rel for s in self._subs):
            return True
        if self._gi and self._gi.ignored(rel, False):
            return True
        return False


# --------------------------------------------------------------------------- #
# Store (two-tier, singleton).                                                 #
# --------------------------------------------------------------------------- #
class SyncSettings:
    def __init__(self, override_path: Optional[Path] = None):
        self._override_path = Path(override_path) if override_path else get_sync_settings_file()
        self._lock = threading.RLock()
        self._cache: Optional[Dict[str, Any]] = None

    def _load_override(self) -> Dict[str, Any]:
        try:
            if self._override_path.exists():
                d = json.loads(self._override_path.read_text(encoding="utf-8"))
                if isinstance(d, dict):
                    return d
        except Exception as exc:
            ColorPrint.yellow(f"[SyncSettings] read {self._override_path} failed: {exc}")
        return {}

    def get(self) -> Dict[str, Any]:
        """Presets overlaid by the per-machine override (per key)."""
        with self._lock:
            if self._cache is not None:
                return {k: (list(v) if isinstance(v, list) else v) for k, v in self._cache.items()}
            merged = presets()
            ovr = self._load_override()
            for k in _KEYS:
                if k in ovr and ovr[k] is not None:
                    merged[k] = ovr[k]
            for k in ("excluded_dirs", "excluded_files", "excluded_extensions",
                      "excluded_path_substrings", "watch_dirs"):
                merged[k] = sorted({str(x).strip() for x in (merged.get(k) or []) if str(x).strip()})
            merged["apply_gitignore"] = bool(merged.get("apply_gitignore"))
            self._cache = merged
            return self.get()

    def get_with_source(self) -> Dict[str, Any]:
        return {"settings": self.get(), "presets": presets(),
                "override_path": str(self._override_path),
                "overridden": self._override_path.exists()}

    def update(self, patch: Dict[str, Any]) -> Dict[str, Any]:
        with self._lock:
            ovr = self._load_override()
            for k in _KEYS:
                if k in patch and patch[k] is not None:
                    ovr[k] = patch[k]
            try:
                self._override_path.parent.mkdir(parents=True, exist_ok=True)
                tmp = self._override_path.with_suffix(self._override_path.suffix + ".tmp")
                tmp.write_text(json.dumps(ovr, ensure_ascii=False, indent=2, sort_keys=True),
                               encoding="utf-8")
                os.replace(str(tmp), str(self._override_path))
            except Exception as exc:
                ColorPrint.red(f"[SyncSettings] save failed: {exc}")
            self._cache = None
            return self.get()

    def reset(self) -> Dict[str, Any]:
        """Drop the override -> back to code presets."""
        with self._lock:
            try:
                if self._override_path.exists():
                    self._override_path.unlink()
            except Exception:
                pass
            self._cache = None
            return self.get()

    def build_excluder(self, root) -> Excluder:
        return Excluder(root, self.get())


_instance: Optional[SyncSettings] = None
_inst_lock = threading.Lock()


def get_sync_settings() -> SyncSettings:
    global _instance
    if _instance is None:
        with _inst_lock:
            if _instance is None:
                _instance = SyncSettings()
    return _instance


def build_excluder(root) -> Excluder:
    return get_sync_settings().build_excluder(root)
