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

import os
import sys
from pycore.pyfoundations.pybasecommon import exec_silent, exec_realtime
from pycore.pyfoundations.serialized_worker import SerializedValue
from pathlib import Path
from typing import Dict, List, Optional

_BATCH_DECRYPTION_ATTEMPTED = SerializedValue(
    False,
    "SecretDecryptionAttemptStateThread",
)


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


# Env vars that can supply the batch-decryption password non-interactively.
# A server / CI / systemd unit has no TTY to prompt on, so without one of these
# the decryption must be SKIPPED (not block on input() and spam errors).
_PASSWORD_ENV_VARS = (
    "CORE_NODE_SECRET_PASSWORD",
    "SECRET_DECRYPT_PASSWORD",
    "SECRET_PASSWORD",
)


def _password_from_env() -> Optional[str]:
    """Return a decryption password from a known env var, or None."""
    for var in _PASSWORD_ENV_VARS:
        val = os.environ.get(var)
        if val and val.strip():
            return val.strip()
    return None


def _is_interactive() -> bool:
    """True only when there is a real TTY on stdin we can prompt a human on."""
    try:
        return bool(sys.stdin) and sys.stdin.isatty()
    except Exception:
        return False


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
    _BATCH_DECRYPTION_ATTEMPTED.set(True)

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
        password = _password_from_env()

    if not password:
        # No password supplied and nothing in the env: only prompt if a human is
        # actually there. On a headless server / CI / systemd unit there is no
        # TTY, so SKIP cleanly instead of blocking on input() and erroring out.
        if not _is_interactive():
            print(
                "[SECRET_MANAGER] Non-interactive environment (no TTY) and no password "
                f"env var set ({', '.join(_PASSWORD_ENV_VARS)}); skipping batch decryption."
            )
            return False
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
            result = exec_silent(
                ['node', str(encrypted_file), 'pwd', password, str(raw_dir)],
                capture_output=True,
                text=True,
                timeout=30
            )

            if result.return_code == 0:
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
    if not key_name:
        return ""

    # Step 0: OS environment variable (so a "Set Special Software Environment
    # Variables" feature — or any external/OS env setup — can supply keys,
    # including indexed names like GOOGLE_API_KEY_1). File-backed secrets below
    # take precedence so an explicitly placed key file always wins.
    env_val = os.environ.get(key_name)
    if env_val and env_val.strip():
        # Defer to a raw file when one exists (keeps file as the source of truth).
        try:
            if not (get_secret_directories()['RAW_DIR'] / key_name).exists():
                return env_val.strip()
        except Exception:
            return env_val.strip()

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
    should_decrypt = (
        encrypted_file.exists()
        and _BATCH_DECRYPTION_ATTEMPTED.compare_and_set(False, True)
    )
    if should_decrypt:
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


def get_secret_key_indexed(base_name: str, max_index: int = 5) -> str:
    """
    Get a secret key by base name, auto-scanning numbered variants.

    Multi-key convention: a logical secret (e.g. an AI provider key) is stored as
    ``<BASE>_1`` .. ``<BASE>_N`` (rotation / multiple accounts), and sometimes as a
    bare ``<BASE>``. Callers must NOT hardcode a single index — if ``_1`` is absent
    the value may live under ``_2``..``_5``. This is the single global loader every
    AI provider (and any other indexed secret) goes through.

    Resolution order (first non-empty wins):
        <BASE>_1, <BASE>_2, ... <BASE>_<max_index>, then bare <BASE>

    Args:
        base_name: Key base without the trailing ``_<n>`` (e.g. "GOOGLE_API_KEY").
        max_index: Highest numbered variant to try (default 5).

    Returns:
        First non-empty secret value found, or empty string if none exist.
    """
    for i in range(1, max_index + 1):
        value = _read_secret_value(f"{base_name}_{i}")
        if value:
            return value
    return _read_secret_value(base_name)


def get_all_secret_keys_indexed(base_name: str, max_index: int = 5) -> List[str]:
    """
    ALL non-empty numbered variants of a base secret, in resolution order.

    Same convention as :func:`get_secret_key_indexed` but returns EVERY key
    found (``<BASE>_1`` .. ``<BASE>_<max_index>`` then bare ``<BASE>``) so callers
    can ROTATE across multiple keys/accounts (e.g. try KEY_1, then KEY_2 on a
    rate-limit / quota error). Duplicates are removed while preserving order.

    Returns:
        List of distinct non-empty secret values (possibly empty).
    """
    found: List[str] = []
    seen = set()
    for i in range(1, max_index + 1):
        value = _read_secret_value(f"{base_name}_{i}")
        if value and value not in seen:
            seen.add(value)
            found.append(value)
    bare = _read_secret_value(base_name)
    if bare and bare not in seen:
        found.append(bare)
    return found


def set_secret_key(key_name: str, value: str) -> bool:
    """
    Write a raw secret value to ``.secret_keys/.secret_ignore/<key_name>``.

    Used by the local key-management API so users can set/rotate AI provider keys
    from the UI. Writes the RAW (decrypted) store — the same place the reader
    checks first. Returns True on success.
    """
    key_name = (key_name or "").strip()
    if not key_name or any(c in key_name for c in "/\\.. "):
        return False
    value = (value or "").strip()
    try:
        raw_dir = get_secret_directories()['RAW_DIR']
        raw_dir.mkdir(parents=True, exist_ok=True)
        (raw_dir / key_name).write_text(value + "\n", encoding="utf-8")
        return True
    except Exception:
        return False


def set_secret_key_indexed(base_name: str, value: str, index: int = 1) -> bool:
    """Write ``<base_name>_<index>`` (the indexed multi-key convention)."""
    base_name = (base_name or "").strip()
    if not base_name:
        return False
    idx = max(1, int(index)) if str(index).isdigit() or isinstance(index, int) else 1
    return set_secret_key(f"{base_name}_{idx}", value)


def delete_secret_key(key_name: str) -> bool:
    """Remove a raw secret file. Returns True if it existed and was removed."""
    key_name = (key_name or "").strip()
    if not key_name or any(c in key_name for c in "/\\.. "):
        return False
    try:
        path = get_secret_directories()['RAW_DIR'] / key_name
        if path.is_file():
            path.unlink()
            return True
    except Exception:
        pass
    return False


def list_secret_key_names() -> List[str]:
    """Names (NOT values) of raw secret files present. For UI presence checks."""
    try:
        raw_dir = get_secret_directories()['RAW_DIR']
        if not raw_dir.exists():
            return []
        return sorted(
            f.name for f in raw_dir.iterdir()
            if f.is_file() and not f.name.startswith('.'))
    except Exception:
        return []


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
    'get_secret_key_indexed',
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
