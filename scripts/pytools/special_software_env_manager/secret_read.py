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


def remove_bom_from_bytes(data: bytes) -> bytes:
    """Remove UTF-8 BOM from bytes if present."""
    if data[:3] == b'\xef\xbb\xbf':
        return data[3:]
    return data


def remove_bom_from_string(text: str) -> str:
    """Remove UTF-8 BOM from string if present."""
    if text and text[0] == '\ufeff':
        return text[1:]
    return text


def read_secret_value(key_name: str) -> str:
    """Return first non-empty line from the raw secret file, or empty string."""
    if not key_name:
        return ""

    secret_file = RAW_SECRET_DIR / key_name
    if not secret_file.exists():
        return ""

    try:
        # Read as bytes first to properly detect and remove BOM
        raw_bytes = secret_file.read_bytes()
        raw_bytes = remove_bom_from_bytes(raw_bytes)
        content = raw_bytes.decode("utf-8")
    except (OSError, UnicodeDecodeError):
        return ""

    # Additional safety check for string BOM (should not occur after byte-level removal)
    content = remove_bom_from_string(content)

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

