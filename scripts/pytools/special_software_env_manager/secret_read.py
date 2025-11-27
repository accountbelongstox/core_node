"""
Simple secret reader.

Reads plaintext secrets from .secret_keys/.secret_ignore without triggering
decryption. Use dd.cmd / SecretDecryptionCheck.ps1 to decrypt beforehand.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Optional


PROJECT_ROOT = Path(__file__).resolve().parents[3]
RAW_SECRET_DIR = PROJECT_ROOT / ".secret_keys" / ".secret_ignore"


def read_secret_value(key_name: str) -> str:
    """Return first non-empty line from the raw secret file, or empty string."""
    if not key_name:
        return ""

    secret_file = RAW_SECRET_DIR / key_name
    if not secret_file.exists():
        return ""

    try:
        content = secret_file.read_text(encoding="utf-8")
    except OSError:
        return ""

    if content.startswith("\ufeff"):
        content = content[1:]

    for line in content.splitlines():
        line = line.strip()
        if line:
            return line
    return ""


def main(argv: Optional[list[str]] = None) -> int:
    args = list(argv) if argv is not None else sys.argv[1:]
    if not args:
        return 1

    value = read_secret_value(args[0])
    if value:
        print(value)
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())

