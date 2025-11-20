"""
Secret Manager for Python

Simplified version that only reads secret keys from .secret_ignore directory.

Directory Structure:
    .secret_keys/
        .secret_ignore/     - Decrypted raw files (gitignored)

Main Functions:
    1. get_secret_key()       - Get single key value from .secret_ignore
    2. get_all_secret_keys()  - Get all keys as dictionary from .secret_ignore
"""

import sys
from pathlib import Path
from typing import Dict


def get_secret_directories() -> Dict[str, Path]:
    """
    Get secret-related directory paths using relative positioning.
    
    Uses relative path from current file: ../../.secret_keys/

    Returns:
        Dictionary with paths:
        - SECRET_KEYS_DIR: .secret_keys directory
        - ENCRYPTED_DIR: already_encrypted directory
        - RAW_DIR: .secret_ignore directory
    """
    # Get current file directory and go up two levels to project root
    current_file = Path(__file__).resolve()
    # pycore/pyfoundations/secret_manager.py -> project_root
    project_root = current_file.parent.parent.parent
    secret_keys_dir = project_root / '.secret_keys'
    encrypted_dir = secret_keys_dir / 'already_encrypted'
    raw_dir = secret_keys_dir / '.secret_ignore'

    return {
        'SECRET_KEYS_DIR': secret_keys_dir,
        'ENCRYPTED_DIR': encrypted_dir,
        'RAW_DIR': raw_dir
    }


def _read_secret_value(key_name: str) -> str:
    """
    Internal function to read secret value using standard protocol:
    1. First try to read from RAW_DIR
    2. If not found, check ENCRYPTED_DIR for .js file
    3. If .js exists, prompt to decrypt first and return empty string

    Args:
        key_name: Name of the secret key

    Returns:
        Secret value as string (first non-empty line) or empty string if not available
    """
    if not key_name:
        return ""

    dirs = get_secret_directories()
    raw_file = dirs['RAW_DIR'] / key_name

    # Step 1: Try to read from RAW_DIR first
    if raw_file.exists():
        try:
            content = raw_file.read_text(encoding='utf-8')
            # Remove BOM if present
            if content.startswith('\ufeff'):
                content = content[1:]
            # Get first non-empty line
            for line in content.splitlines():
                line = line.strip()
                if line:
                    return line
        except Exception:
            pass

    # Step 2: If not found in RAW_DIR, check ENCRYPTED_DIR for .js file
    encrypted_file = dirs['ENCRYPTED_DIR'] / f"{key_name}.js"
    if encrypted_file.exists():
        # Step 3: File exists but not decrypted yet, prompt and return empty string
        print(f"[SECRET_MANAGER] WARNING: Key '{key_name}' is encrypted. Please decrypt first.")
        return ""

    # Not found in either location
    return ""


def get_secret_key(key_name: str) -> str:
    """
    Get single secret key value using standard reading protocol.

    Args:
        key_name: Name of the secret key

    Returns:
        Secret value as string (first non-empty line) or empty string if not available
    """
    return _read_secret_value(key_name)


def get_all_secret_keys() -> Dict[str, str]:
    """
    Get all secret keys as dictionary from .secret_ignore directory

    Returns:
        Dictionary mapping key names to their values
    """
    dirs = get_secret_directories()
    secrets = {}

    # Check if raw directory exists
    if not dirs['RAW_DIR'].exists():
        return secrets

    # Get all raw files
    try:
        raw_files = [f for f in dirs['RAW_DIR'].iterdir()
                    if f.is_file() and not f.name.startswith('.')]

        # Build dictionary using common read function
        for raw_file in raw_files:
            key_name = raw_file.name
            value = _read_secret_value(key_name)
            secrets[key_name] = value
    except Exception:
        pass

    return secrets


# Module-level exports
__all__ = [
    'get_secret_directories',
    'get_secret_key',
    'get_all_secret_keys'
]


def main():
    """Command-line interface for secret_manager"""
    if len(sys.argv) < 2:
        print("[SECRET_MANAGER] ERROR: Command is required")
        sys.exit(1)

    command = sys.argv[1]

    if command == 'get_secret_key':
        if len(sys.argv) < 3:
            print("[SECRET_MANAGER] ERROR: Key name is required")
            sys.exit(1)

        key_name = sys.argv[2]
        value = get_secret_key(key_name)
        print(value)
        sys.exit(0 if value else 1)

    elif command == 'get_all_secret_keys':
        secrets = get_all_secret_keys()
        for key, value in secrets.items():
            print(f"{key}={value}")
        sys.exit(0)

    else:
        print(f"[SECRET_MANAGER] ERROR: Unknown command: {command}")
        sys.exit(1)


if __name__ == '__main__':
    main()
