# -*- coding: utf-8 -*-
"""Per-provider AI key health: the last probe verdict bound to a key fingerprint.

The probe records ok / unauthorized / forbidden together with a short SHA-256 of
the key it used (never the key). ``key-status`` lists providers whose last probe
was rejected AND whose key is still the same; a replaced key reads as
``unchecked`` until the next probe, so the startup warning stops by itself.

    python -m pycore.pyctl.ai.key_health key-status [--all]

Output: one tab-separated line per provider: provider, secret name, status, checked_at.
"""

import argparse
import hashlib
import re
import sys
import threading
import time
from typing import Any, Dict, List, Optional

from pycore.pyctl.ai.ai_state import ai_state_dir
from pycore.pyfoundations.atomic_json_store import AtomicJsonStore
from pycore.pyfoundations.secret_manager import peek_secret_key

STORE_FILE_NAME = "ai_key_health.json"
FINGERPRINT_LENGTH = 12
STATUS_OK = "ok"
STATUS_UNAUTHORIZED = "unauthorized"
STATUS_FORBIDDEN = "forbidden"
STATUS_UNCHECKED = "unchecked"
FAILING_STATUSES = (STATUS_UNAUTHORIZED, STATUS_FORBIDDEN)
CHECKED_AT_FORMAT = "%Y-%m-%d %H:%M:%S"
UNAUTHORIZED_MARKERS = ("unauthorized", "invalid api key", "invalid_api_key", "api_key_invalid", "api key not valid")
HTTP_401 = re.compile(r"(?<!\d)401(?!\d)")
HTTP_403 = re.compile(r"(?<!\d)403(?!\d)")
COMMAND_KEY_STATUS = "key-status"

_write_lock = threading.Lock()


def key_fingerprint(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:FINGERPRINT_LENGTH]


def classify_error(error: Optional[str]) -> str:
    """Auth verdict of a probe error: unauthorized / forbidden, or '' when inconclusive."""
    text = str(error or "").lower()
    if HTTP_401.search(text):
        return STATUS_UNAUTHORIZED
    if HTTP_403.search(text):
        return STATUS_FORBIDDEN
    if any(marker in text for marker in UNAUTHORIZED_MARKERS):
        return STATUS_UNAUTHORIZED
    return ""


def _store() -> AtomicJsonStore:
    return AtomicJsonStore(ai_state_dir() / STORE_FILE_NAME, lambda: {"providers": {}})


def _secret_name_of(provider: str, fingerprint: str) -> str:
    from pycore.pyctl.ai.ai_keys import PROVIDERS, secret_names

    for name in secret_names(provider):
        value = peek_secret_key(name)
        if value and key_fingerprint(value) == fingerprint:
            return name
    return str(PROVIDERS.get(provider, {}).get("key_base") or "")


def record_probe(provider: str, key: str, error: Optional[str]) -> None:
    """Store the verdict of one live probe; an inconclusive failure (network, parse) keeps the previous verdict."""
    status = STATUS_OK if error is None else classify_error(error)
    if not key or not status:
        return
    fingerprint = key_fingerprint(key)
    entry = {
        "provider": provider,
        "secret_name": _secret_name_of(provider, fingerprint),
        "status": status,
        "checked_at": time.strftime(CHECKED_AT_FORMAT),
        "fingerprint": fingerprint,
    }
    store = _store()
    with _write_lock:
        doc = store.read()
        doc.setdefault("providers", {})[provider] = entry
        store.write(doc)


def key_status() -> List[Dict[str, Any]]:
    """Every recorded provider with its effective status: the stored verdict while the
    secret still holds the probed key, ``unchecked`` once it was replaced or removed."""
    rows: List[Dict[str, Any]] = []
    for provider, entry in sorted((_store().read().get("providers") or {}).items()):
        secret_name = str(entry.get("secret_name") or "")
        current = peek_secret_key(secret_name) if secret_name else ""
        same_key = bool(current) and key_fingerprint(current) == entry.get("fingerprint")
        rows.append({
            "provider": provider,
            "secret_name": secret_name,
            "status": str(entry.get("status") or "") if same_key else STATUS_UNCHECKED,
            "checked_at": str(entry.get("checked_at") or ""),
        })
    return rows


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(prog="pycore.pyctl.ai.key_health")
    parser.add_argument("command", choices=(COMMAND_KEY_STATUS,))
    parser.add_argument("--all", action="store_true", help="include ok and unchecked providers")
    args = parser.parse_args(argv)
    try:
        rows = key_status()
    except (OSError, ValueError):
        return 0
    for row in rows:
        if args.all or row["status"] in FAILING_STATUSES:
            sys.stdout.write("\t".join((row["provider"], row["secret_name"], row["status"], row["checked_at"])) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
