# -*- coding: utf-8 -*-
"""Declarative prompt-source specs and the one discovery implementation.

A ``ToolSpec`` is pure data: the tool id plus its ``SourceSpec`` list. Each
``SourceSpec`` names a source format (how to parse), where to look (home
relative roots, or a root resolver), which files match (globs, or a
non-following recursive walk), and format options (keys, field names, JSON
paths). Product specifics live only in these declarations.
"""

from __future__ import annotations

import fnmatch
import os
from dataclasses import dataclass, field
from glob import glob
from typing import Any, Callable, Dict, List, Mapping, Optional, Tuple, Union

from pycore.pyctl.agent_history.sources.source_kit import file_descriptor

RootResolver = Callable[[str, str], List[str]]

# A fallback spec is read only when the primary specs of the same tool found
# nothing: in the same root (FALLBACK_ROOT) or anywhere in the home (FALLBACK_HOME).
FALLBACK_NONE = ""
FALLBACK_ROOT = "root"
FALLBACK_HOME = "home"

# User-data dirs of VS Code-family editors relative to a home (Windows,
# Linux, macOS), and the remote-server data dirs they install on hosts.
EDITOR_USER_DIR_TEMPLATES = (
    os.path.join("AppData", "Roaming", "{app}", "User"),
    os.path.join(".config", "{app}", "User"),
    os.path.join("Library", "Application Support", "{app}", "User"),
)
EDITOR_SERVER_USER_DIR_TEMPLATE = os.path.join("{server}", "data", "User")


def editor_user_dirs(apps: Tuple[str, ...], servers: Tuple[str, ...] = (), sub: str = "") -> Tuple[str, ...]:
    """Home-relative ``User`` dirs (optionally a sub dir) of the given editors."""
    dirs = [template.format(app=app) for app in apps for template in EDITOR_USER_DIR_TEMPLATES]
    dirs.extend(EDITOR_SERVER_USER_DIR_TEMPLATE.format(server=server) for server in servers)
    return tuple(os.path.join(d, sub) if sub else d for d in dirs)


@dataclass(frozen=True)
class SourceSpec:
    format: str
    roots: Union[Tuple[str, ...], RootResolver]
    patterns: Tuple[str, ...] = ()
    walk: str = ""
    walk_depth: int = 0
    follow_links: bool = True
    exclude: Tuple[str, ...] = ()
    directories: bool = False
    fallback: str = FALLBACK_NONE
    max_bytes: int = 0
    options: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ToolSpec:
    tool: str
    sources: Tuple[SourceSpec, ...]


def _resolve_roots(spec: SourceSpec, home: str, user: str) -> List[str]:
    raw = spec.roots(home, user) if callable(spec.roots) else [os.path.join(home, r) for r in spec.roots]
    roots: List[str] = []
    seen: set[str] = set()
    for root in raw:
        if not root or not os.path.isdir(root):
            continue
        real = os.path.realpath(root)
        if real in seen:
            continue
        seen.add(real)
        roots.append(root)
    return roots


def _walk(root: str, name_pattern: str, max_depth: int, follow_links: bool) -> List[str]:
    found: List[str] = []
    base_depth = root.rstrip(os.sep).count(os.sep)
    for current, dirs, files in os.walk(root, followlinks=follow_links):
        if max_depth and current.count(os.sep) - base_depth >= max_depth:
            dirs[:] = []
        found.extend(os.path.join(current, name) for name in files if fnmatch.fnmatch(name, name_pattern))
    return found


def _root_matches(spec: SourceSpec, root: str) -> List[str]:
    if spec.walk:
        return _walk(root, spec.walk, spec.walk_depth, spec.follow_links)
    paths: List[str] = []
    for pattern in spec.patterns:
        paths.extend(glob(os.path.join(root, pattern), recursive="**" in pattern))
    return paths


def discover_spec(
    spec: SourceSpec,
    home: str,
    user: str,
    describe: Optional[Callable[[str], Optional[Dict[str, Any]]]],
) -> Dict[str, List[Dict[str, Any]]]:
    """Descriptors of one spec, grouped by the root they were found in."""
    by_root: Dict[str, List[Dict[str, Any]]] = {}
    for root in _resolve_roots(spec, home, user):
        out: List[Dict[str, Any]] = []
        for path in _root_matches(spec, root):
            if os.path.basename(path) in spec.exclude:
                continue
            if spec.directories != os.path.isdir(path):
                continue
            desc = describe(path) if describe is not None else file_descriptor(path)
            if not desc:
                continue
            if spec.max_bytes and (not desc["mtime"] or desc["bytes"] > spec.max_bytes):
                continue
            out.append(desc)
        by_root[os.path.realpath(root)] = out
    return by_root


__all__ = [
    "FALLBACK_HOME",
    "FALLBACK_NONE",
    "FALLBACK_ROOT",
    "RootResolver",
    "SourceSpec",
    "ToolSpec",
    "discover_spec",
    "editor_user_dirs",
]
