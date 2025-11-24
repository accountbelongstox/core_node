"""
Secret Manager for Python

Simplified version that only reads secret keys from .secret_ignore directory.

Directory Structure:
    .secret_keys/
        .secret_ignore/     - Decrypted raw files (gitignored)
        already_encrypted/  - Encrypted .js files

Main Functions:
    1. get_secret_key()       - Get single key value from .secret_ignore
    2. get_all_secret_keys()  - Get all keys as dictionary from .secret_ignore
    3. decrypt_all_secrets()  - Decrypt all encrypted files
"""

import sys
import subprocess
from pathlib import Path
from typing import Dict, Optional

BATCH_DECRYPTION_ATTEMPTED = False


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


def find_disguise_tool() -> Optional[Path]:
    """Find disguise.js encryption/decryption tool"""
    current_file = Path(__file__).resolve()
    project_root = current_file.parent.parent.parent
    scripts_dir = project_root / 'scripts'

    disguise_js = scripts_dir / 'disguise.js'
    if disguise_js.exists():
        return disguise_js

    for js_file in scripts_dir.rglob('disguise.js'):
        return js_file

    return None


def _get_password_with_confirmation() -> Optional[str]:
    """
    Prompt for password with confirmation and plain text input

    Returns:
        Password string if confirmed, None if failed
    """
    try:
        password1 = input("[SECRET_MANAGER] Enter decryption password: ").strip()
        password2 = input("[SECRET_MANAGER] Confirm decryption password: ").strip()

        if password1 != password2:
            print("[SECRET_MANAGER] ERROR: Passwords do not match")
            return None

        if not password1:
            print("[SECRET_MANAGER] ERROR: Password cannot be empty")
            return None

        return password1
    except KeyboardInterrupt:
        print("\n[SECRET_MANAGER] Password input cancelled")
        return None
    except Exception as e:
        print(f"[SECRET_MANAGER] ERROR: Failed to read password: {e}")
        return None


def decrypt_all_secrets(password: Optional[str] = None) -> bool:
    """
    Decrypt all encrypted files from already_encrypted to .secret_ignore

    Args:
        password: Decryption password (if not provided, will prompt)

    Returns:
        True if successful, False otherwise
    """
    global BATCH_DECRYPTION_ATTEMPTED
    BATCH_DECRYPTION_ATTEMPTED = True

    dirs = get_secret_directories()
    encrypted_dir = dirs['ENCRYPTED_DIR']
    raw_dir = dirs['RAW_DIR']

    if not encrypted_dir.exists():
        print(f"[SECRET_MANAGER] ERROR: Encrypted directory not found: {encrypted_dir}")
        return False

    raw_dir.mkdir(parents=True, exist_ok=True)

    encrypted_files = list(encrypted_dir.glob('*.js'))
    if not encrypted_files:
        print(f"[SECRET_MANAGER] No encrypted files found in: {encrypted_dir}")
        return True

    print(f"[SECRET_MANAGER] Found {len(encrypted_files)} encrypted files")

    disguise_js = find_disguise_tool()
    if not disguise_js:
        print(f"[SECRET_MANAGER] ERROR: disguise.js not found")
        return False

    print(f"[SECRET_MANAGER] Using decryption tool: {disguise_js}")

    if not password:
        password = _get_password_with_confirmation()

    if not password:
        print(f"[SECRET_MANAGER] ERROR: Password is required")
        return False

    success_count = 0
    fail_count = 0

    for encrypted_file in encrypted_files:
        key_name = encrypted_file.stem
        print(f"[SECRET_MANAGER] Decrypting: {encrypted_file.name} -> {key_name}")

        try:
            result = subprocess.run(
                ['node', str(encrypted_file), 'pwd', password, str(raw_dir)],
                capture_output=True,
                text=True,
                timeout=30
            )

            if result.returncode == 0:
                print(f"[SECRET_MANAGER]   SUCCESS: {key_name}")
                success_count += 1
            else:
                print(f"[SECRET_MANAGER]   FAILED: {key_name}")
                if result.stderr:
                    print(f"[SECRET_MANAGER]   Error: {result.stderr}")
                fail_count += 1
        except Exception as e:
            print(f"[SECRET_MANAGER]   FAILED: {key_name}")
            print(f"[SECRET_MANAGER]   Error: {e}")
            fail_count += 1

    print(f"\n[SECRET_MANAGER] ========================================")
    print(f"[SECRET_MANAGER] Decryption Summary:")
    print(f"[SECRET_MANAGER]   Total files: {len(encrypted_files)}")
    print(f"[SECRET_MANAGER]   Successful:  {success_count}")
    print(f"[SECRET_MANAGER]   Failed:      {fail_count}")
    print(f"[SECRET_MANAGER]   Output dir:  {raw_dir}")
    print(f"[SECRET_MANAGER] ========================================")

    return fail_count == 0


def _read_secret_value(key_name: str) -> str:
    """
    Internal function to read secret value using standard protocol:
    1. First try to read from RAW_DIR
    2. If not found, check ENCRYPTED_DIR for .js file
    3. If .js exists, trigger auto-decryption

    Args:
        key_name: Name of the secret key

    Returns:
        Secret value as string (first non-empty line) or empty string if not available
    """
    global BATCH_DECRYPTION_ATTEMPTED

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
    if encrypted_file.exists() and not BATCH_DECRYPTION_ATTEMPTED:
        # Step 3: File exists but not decrypted yet, trigger auto-decryption
        print(f"[SECRET_MANAGER] Key '{key_name}' is encrypted. Triggering batch decryption...")
        if decrypt_all_secrets():
            # Try reading again after decryption
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
    'get_all_secret_keys',
    'decrypt_all_secrets',
    'find_disguise_tool',
    '_get_password_with_confirmation'
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
