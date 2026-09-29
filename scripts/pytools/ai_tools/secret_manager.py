#!/usr/bin/env python3

"""
Standalone Secret Manager for AI Tools

This is a simplified, standalone version that only reads secret keys from
.secret_ignore directory without importing pycore to avoid third-party
dependencies.

Directory Structure:
    .secret_keys/
        .secret_ignore/     - Decrypted raw files (gitignored)
        already_encrypted/  - Encrypted .js files
"""

from pathlib import Path
from typing import Optional


def get_secret_directories():
    """
    Get secret-related directory paths using relative positioning.

    Uses relative path from current file: ../../../.secret_keys/
    (scripts/pytools/ai_tools -> project_root)

    Returns:
        Dictionary with paths:
        - SECRET_KEYS_DIR: .secret_keys directory
        - ENCRYPTED_DIR: already_encrypted directory
        - RAW_DIR: .secret_ignore directory
    """
    current_file = Path(__file__).resolve()
    project_root = current_file.parent.parent.parent.parent
    secret_keys_dir = project_root / '.secret_keys'
    encrypted_dir = secret_keys_dir / 'already_encrypted'
    raw_dir = secret_keys_dir / '.secret_ignore'

    return {
        'SECRET_KEYS_DIR': secret_keys_dir,
        'ENCRYPTED_DIR': encrypted_dir,
        'RAW_DIR': raw_dir
    }


def get_secret_key(key_name: str) -> str:
    """
    Get single secret key value from .secret_ignore directory.

    Args:
        key_name: Name of the secret key

    Returns:
        Secret value as string (first non-empty line) or empty string if not available
    """
    if not key_name:
        return ""

    dirs = get_secret_directories()
    raw_file = dirs['RAW_DIR'] / key_name

    if raw_file.exists():
        try:
            content = raw_file.read_text(encoding='utf-8')
            if content.startswith('\ufeff'):
                content = content[1:]
            for line in content.splitlines():
                line = line.strip()
                if line:
                    return line
        except Exception:
            pass

    return ""


__all__ = ['get_secret_key', 'get_secret_directories']
