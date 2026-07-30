"""Patch-image source management stored in annotator_config.json."""

import json
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple


IMAGE_EXTENSIONS = {".bmp", ".jpeg", ".jpg", ".png", ".webp"}


def load_patch_dir(directory: str) -> List[Tuple[str, str]]:
    root = Path(directory)
    if not root.is_dir():
        return []
    return [
        (path.name, path.stem)
        for path in sorted(root.iterdir())
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    ]


def add_patch_source(config_path: str, base_dir: str, items: Iterable[Tuple[str, str]]) -> None:
    data = _load_config(config_path)
    sources = data.get("patch_sources")
    if not isinstance(sources, list):
        sources = []
    normalized_items = [
        {"file": str(filename), "name": str(name)}
        for filename, name in items
        if str(filename).strip()
    ]
    source = {"base_dir": str(Path(base_dir).resolve()), "items": normalized_items}
    sources = [entry for entry in sources if isinstance(entry, dict) and entry.get("base_dir") != source["base_dir"]]
    sources.append(source)
    data["patch_sources"] = sources
    _save_config(config_path, data)


def load_patch_data(config_path: str) -> Tuple[str, List[Tuple[str, str]]]:
    sources = _load_config(config_path).get("patch_sources")
    if not isinstance(sources, list) or not sources:
        return "", []
    source = sources[-1] if isinstance(sources[-1], dict) else {}
    return str(source.get("base_dir") or ""), _source_items(source)


def get_patch_items_flat(config_path: str) -> List[Tuple[str, str, str]]:
    sources = _load_config(config_path).get("patch_sources")
    if not isinstance(sources, list):
        return []
    result = []
    for source in sources:
        if not isinstance(source, dict):
            continue
        base_dir = str(source.get("base_dir") or "")
        result.extend((base_dir, filename, name) for filename, name in _source_items(source))
    return result


def _source_items(source: Dict[str, Any]) -> List[Tuple[str, str]]:
    items = source.get("items")
    if not isinstance(items, list):
        return []
    result = []
    for item in items:
        if isinstance(item, dict) and item.get("file"):
            result.append((str(item["file"]), str(item.get("name") or Path(str(item["file"])).stem)))
    return result


def _load_config(config_path: str) -> Dict[str, Any]:
    path = Path(config_path)
    if not path.is_file():
        return {}
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return value if isinstance(value, dict) else {}


def _save_config(config_path: str, data: Dict[str, Any]) -> None:
    path = Path(config_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


__all__ = ["add_patch_source", "get_patch_items_flat", "load_patch_data", "load_patch_dir"]
