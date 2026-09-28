"""VOC annotator project configuration persistence."""

import json
from pathlib import Path
from typing import Any, Dict, Iterable


def load_project_config(config_path: str) -> Dict[str, Any]:
    path = Path(config_path)
    if not path.is_file():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return data if isinstance(data, dict) else {}


def save_project_config(config_path: str, project_name: str, classes: Iterable[str]) -> Dict[str, Any]:
    path = Path(config_path)
    data = load_project_config(config_path)
    data["project_name"] = str(project_name)
    data["classes"] = [str(name) for name in classes]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return data


__all__ = ["load_project_config", "save_project_config"]
