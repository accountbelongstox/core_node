"""Local host configuration (stored in data dir, git-ignored)."""

import json
from pathlib import Path

CONFIG_DIR = Path(__file__).parent.parent / "data"
CONFIG_FILE = CONFIG_DIR / "host-config.json"

_DEFAULT_CONFIG = {
    "bridge_enabled": False,
    "bridge_gateway_id": "",
    "bridge_gateway_url": "",
}


def load_config() -> dict:
    """Load bridge configuration from the local data directory."""
    if CONFIG_FILE.is_file():
        content = CONFIG_FILE.read_text(encoding="utf-8").strip()
        if content:
            data = json.loads(content)
            if isinstance(data, dict):
                return data
    return dict(_DEFAULT_CONFIG)


def save_config(config: dict):
    """Persist bridge configuration to the local data directory."""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2)


def is_bridge_enabled() -> bool:
    """Return True if bridge mode is currently active."""
    return load_config().get("bridge_enabled", False)
