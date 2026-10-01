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

import base64
import hashlib
import os
import re
import secrets
import sys
from pycore.pyfoundations.atomic_json_store import atomic_write_text
from pycore.pyfoundations.notebook_policy import local_models_only
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.secret_crypto_batch import (
    record_password_split,
    reference_secret_file,
    run_secret_crypto,
)
from pycore.pyfoundations.serialized_worker import SerializedValue
from pycore.pyfoundations.service_contract import value as service_contract_value
from pathlib import Path
from typing import Dict, List, Optional

_BATCH_DECRYPTION_ATTEMPTED = SerializedValue(
    False,
    "SecretDecryptionAttemptStateThread",
)

# CORE_NODE_CLIENT_KEY (config/service_contract.json#client_key_auth): the shared
# HMAC key every host signs/verifies K3 machine calls with. It is one secret
# among the batch, but a wrong password on it is special-cased below because,
# unlike any other secret, losing it can be repaired by regenerating and
# re-encrypting it (every other host then re-syncs the new encrypted copy).
_CLIENT_KEY_CONTRACT = service_contract_value("client_key_auth")
_CLIENT_KEY_NAME = str(_CLIENT_KEY_CONTRACT["secret_key_sign_name"])
_CLIENT_KEY_BASE = str(_CLIENT_KEY_CONTRACT["secret_key_base"])
_CLIENT_KEY_MIN_BYTES = int(_CLIENT_KEY_CONTRACT["key_min_bytes"])
_CLIENT_KEY_ID_LENGTH = int(re.search(r"first-(\d+)-chars", str(_CLIENT_KEY_CONTRACT["key_id"])).group(1))
_PASSWORD_CONFIRM_ATTEMPTS = 3


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
    except (OSError, ValueError) as exc:
        ColorPrint.gray(f"[SECRET_MANAGER] stdin is not interactive ({exc})")
        return False


def _get_password_with_confirmation() -> Optional[str]:
    """
    Prompt for password with confirmation, plain text input (so a typo is
    visible), retrying on mismatch up to _PASSWORD_CONFIRM_ATTEMPTS times.
    An empty first entry skips immediately (no retry).

    Returns:
        Password string if confirmed, None if skipped/cancelled/exhausted
    """
    for attempt in range(1, _PASSWORD_CONFIRM_ATTEMPTS + 1):
        try:
            password1 = input("[SECRET_MANAGER] Enter decryption password (empty skips): ").strip()
            if not password1:
                return None
            password2 = input("[SECRET_MANAGER] Confirm decryption password: ").strip()
        except KeyboardInterrupt:
            ColorPrint.plain("\n[SECRET_MANAGER] Password input cancelled")
            return None
        except EOFError:
            ColorPrint.plain("\n[SECRET_MANAGER] Password input closed (EOF)")
            return None

        if password1 == password2:
            return password1

        ColorPrint.plain(
            f"[SECRET_MANAGER] ERROR: Passwords do not match ({attempt}/{_PASSWORD_CONFIRM_ATTEMPTS})"
        )

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
        ColorPrint.plain(f"[SECRET_MANAGER] ERROR: Encrypted directory not found: {encrypted_dir}")
        return False

    raw_dir.mkdir(parents=True, exist_ok=True)

    encrypted_files = list(encrypted_dir.glob('*.js'))
    if not encrypted_files:
        ColorPrint.plain(f"[SECRET_MANAGER] No encrypted files found in: {encrypted_dir}")
        return True

    ColorPrint.plain(f"[SECRET_MANAGER] Found {len(encrypted_files)} encrypted files")

    if not password:
        password = _password_from_env()

    if not password:
        # No password supplied and nothing in the env: only prompt if a human is
        # actually there. On a headless server / CI / systemd unit there is no
        # TTY, so SKIP cleanly instead of blocking on input() and erroring out.
        if not _is_interactive():
            ColorPrint.plain(
                "[SECRET_MANAGER] Non-interactive environment (no TTY) and no password "
                f"env var set ({', '.join(_PASSWORD_ENV_VARS)}); skipping batch decryption."
            )
            return False
        password = _get_password_with_confirmation()

    if not password:
        ColorPrint.plain(f"[SECRET_MANAGER] ERROR: Password is required")
        return False

    # One process, one password: decrypts every file in encrypted_dir in
    # parallel. Without --force an existing raw file is left untouched
    # (skipped_exists) instead of being overwritten.
    ColorPrint.plain(f"[SECRET_MANAGER] Decrypting {len(encrypted_files)} file(s) in one batch...")
    result = run_secret_crypto('decrypt', password, [str(encrypted_dir)], out_dir=str(raw_dir))

    if not result.ok:
        ColorPrint.plain(f"[SECRET_MANAGER] ERROR: secret_crypto.js failed to run: {result.run_error}")
        return False

    for name in result.decrypted:
        ColorPrint.plain(f"[SECRET_MANAGER]   SUCCESS: {name}")
    for name in result.skipped_exists:
        ColorPrint.plain(f"[SECRET_MANAGER]   SKIPPED (raw file already exists): {name}")
    for name in result.wrong_password:
        ColorPrint.plain(f"[SECRET_MANAGER]   WRONG PASSWORD (nothing written): {name}")
    for name in result.invalid_file:
        ColorPrint.plain(f"[SECRET_MANAGER]   INVALID FILE: {name} ({result.errors.get(name, '')})")
    for name in result.error:
        ColorPrint.plain(f"[SECRET_MANAGER]   ERROR: {name} ({result.errors.get(name, '')})")

    success_count = len(result.decrypted) + len(result.skipped_exists)
    fail_count = len(result.wrong_password) + len(result.invalid_file) + len(result.error)

    ColorPrint.plain(f"\n[SECRET_MANAGER] ========================================")
    ColorPrint.plain(f"[SECRET_MANAGER] Decryption Summary:")
    ColorPrint.plain(f"[SECRET_MANAGER]   Total files: {len(encrypted_files)}")
    ColorPrint.plain(f"[SECRET_MANAGER]   Successful:  {success_count}")
    ColorPrint.plain(f"[SECRET_MANAGER]   Failed:      {fail_count}")
    ColorPrint.plain(f"[SECRET_MANAGER]   Output dir:  {raw_dir}")
    ColorPrint.plain(f"[SECRET_MANAGER] ========================================")

    split_names = record_password_split(result)
    if split_names:
        ColorPrint.plain(
            f"[SECRET_MANAGER] {len(split_names)} secret(s) use a different password; recorded for dd to "
            f"re-encrypt with the main password: {', '.join(split_names)}"
        )

    _handle_client_key_wrong_password(password, result.wrong_password, encrypted_dir, raw_dir)

    return fail_count == 0


def _client_key_id(raw_key: bytes) -> str:
    """Contract key id: sha256 hex of the decoded key, first N chars."""
    return hashlib.sha256(raw_key).hexdigest()[:_CLIENT_KEY_ID_LENGTH]


def _write_client_key(raw_dir: Path) -> bytes:
    """Write a fresh random CORE_NODE_CLIENT_KEY (contract encoding: base64url,
    no padding, key_min_bytes random bytes), 0600, atomic. Returns raw bytes."""
    raw_key = secrets.token_bytes(_CLIENT_KEY_MIN_BYTES)
    encoded = base64.urlsafe_b64encode(raw_key).decode('ascii').rstrip('=')
    writer = (os.geteuid(), os.getegid()) if os.name != 'nt' else None
    atomic_write_text(raw_dir / _CLIENT_KEY_NAME, encoded, file_mode=0o600, newline='', owner=writer)
    return raw_key


def _confirm(prompt: str) -> bool:
    """[y/N]-style confirmation; default No, cancelled input also counts as No."""
    try:
        answer = input(prompt).strip().lower()
    except (KeyboardInterrupt, EOFError):
        ColorPrint.plain("\n[SECRET_MANAGER] Cancelled")
        return False
    return answer in ('y', 'yes')


def _handle_client_key_wrong_password(
    password: str,
    wrong_password_names: List[str],
    encrypted_dir: Path,
    raw_dir: Path,
) -> None:
    """CORE_NODE_CLIENT_KEY special case (config/service_contract.json#client_key_auth):
    unlike any other secret, a client key that cannot be decrypted can be
    repaired by regenerating it. Interactive only: a non-interactive session
    (server/CI/systemd) only logs the situation, never prompts.
    """
    if _CLIENT_KEY_NAME not in wrong_password_names:
        return

    if not _is_interactive():
        ColorPrint.plain(
            f"[SECRET_MANAGER] {_CLIENT_KEY_NAME} could not be decrypted (non-interactive session); "
            "run this in a terminal to decrypt or regenerate it."
        )
        return

    ColorPrint.plain(f"[SECRET_MANAGER] {_CLIENT_KEY_NAME} cannot be decrypted with this password")
    ColorPrint.plain(
        "[SECRET_MANAGER] Regenerating replaces the shared key: every other host must sync the "
        "new encrypted copy, decrypt it and restart the Laravel workers and pyservice."
    )
    if not _confirm(f"[SECRET_MANAGER] Regenerate {_CLIENT_KEY_NAME} and encrypt it now? [y/N]: "):
        return

    reference_file = reference_secret_file([_CLIENT_KEY_NAME])
    if reference_file is not None:
        verify_result = run_secret_crypto('verify', password, [str(reference_file)])
        if not verify_result.verified:
            ColorPrint.plain(
                f"[SECRET_MANAGER] This password does not decrypt {reference_file.name}; "
                "the other secrets use a different password."
            )
            if not _confirm(f"[SECRET_MANAGER] Encrypt {_CLIENT_KEY_NAME} with it anyway? [y/N]: "):
                return

    raw_key = _write_client_key(raw_dir)
    ColorPrint.plain(
        f"[SECRET_MANAGER] Encrypting the shared client key {_CLIENT_KEY_NAME}: sync "
        f"already_encrypted/{_CLIENT_KEY_NAME}.js to every host, decrypt it there and restart "
        "the Laravel workers and pyservice."
    )
    encrypt_result = run_secret_crypto(
        'encrypt', password, [str(raw_dir / _CLIENT_KEY_NAME)], out_dir=str(encrypted_dir)
    )
    if encrypt_result.encrypted:
        key_id = _client_key_id(raw_key)
        ColorPrint.plain(
            f"[SECRET_MANAGER] Regenerated and encrypted {_CLIENT_KEY_NAME} (key id {key_id}); "
            f"commit {encrypted_dir / (_CLIENT_KEY_NAME + '.js')} and sync it to every host."
        )
    else:
        ColorPrint.plain(f"[SECRET_MANAGER] Regenerated {_CLIENT_KEY_NAME} but encryption failed.")


def _secret_allowed(key_name: str) -> bool:
    """Local-models-only nodes (notebook_policy) read only the client key that
    authenticates to the own server; every third-party key resolves empty."""
    if not local_models_only():
        return True
    return key_name == _CLIENT_KEY_BASE or key_name.startswith(f"{_CLIENT_KEY_BASE}_")


def _read_first_line(path: Path) -> str:
    """First non-empty line of a secret file (BOM stripped); '' when unreadable."""
    try:
        content = path.read_text(encoding='utf-8')
    except (OSError, UnicodeDecodeError) as exc:
        ColorPrint.yellow(f"[SECRET_MANAGER] read {path.name} failed: {exc}")
        return ""
    if content.startswith('\ufeff'):
        content = content[1:]
    for line in content.splitlines():
        line = line.strip()
        if line:
            return line
    return ""


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
    if not key_name or not _secret_allowed(key_name):
        return ""

    # Step 0: OS environment variable (so a "Set Special Software Environment
    # Variables" feature - or any external/OS env setup - can supply keys,
    # including indexed names like GOOGLE_API_KEY_1). File-backed secrets below
    # take precedence so an explicitly placed key file always wins.
    env_val = os.environ.get(key_name)
    if env_val and env_val.strip():
        # Defer to a raw file when one exists (keeps file as the source of truth).
        if not (get_secret_directories()['RAW_DIR'] / key_name).exists():
            return env_val.strip()

    dirs = get_secret_directories()
    raw_file = dirs['RAW_DIR'] / key_name

    # Step 1: Try to read from RAW_DIR first
    if raw_file.exists():
        value = _read_first_line(raw_file)
        if value:
            return value

    # Step 2: If not found in RAW_DIR, check ENCRYPTED_DIR for .js file
    encrypted_file = dirs['ENCRYPTED_DIR'] / f"{key_name}.js"
    should_decrypt = (
        encrypted_file.exists()
        and _BATCH_DECRYPTION_ATTEMPTED.compare_and_set(False, True)
    )
    if should_decrypt:
        # Step 3: File exists but not decrypted yet, trigger auto-decryption
        ColorPrint.plain(f"[SECRET_MANAGER] Key '{key_name}' is encrypted. Triggering batch decryption...")
        if decrypt_all_secrets():
            # Try reading again after decryption
            if raw_file.exists():
                value = _read_first_line(raw_file)
                if value:
                    return value

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
    bare ``<BASE>``. Callers must NOT hardcode a single index - if ``_1`` is absent
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
    from the UI. Writes the RAW (decrypted) store - the same place the reader
    checks first. Returns True on success.
    """
    key_name = (key_name or "").strip()
    if not key_name or any(c in key_name for c in "/\\.. "):
        return False
    value = (value or "").strip()
    raw_dir = get_secret_directories()['RAW_DIR']
    try:
        raw_dir.mkdir(parents=True, exist_ok=True)
        (raw_dir / key_name).write_text(value + "\n", encoding="utf-8")
    except OSError as exc:
        ColorPrint.yellow(f"[SECRET_MANAGER] write {key_name} failed: {exc}")
        return False
    return True


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
    path = get_secret_directories()['RAW_DIR'] / key_name
    if not path.is_file():
        return False
    try:
        path.unlink()
    except OSError as exc:
        ColorPrint.yellow(f"[SECRET_MANAGER] delete {key_name} failed: {exc}")
        return False
    return True


def list_secret_key_names() -> List[str]:
    """Names (NOT values) of raw secret files present. For UI presence checks."""
    raw_dir = get_secret_directories()['RAW_DIR']
    if not raw_dir.exists():
        return []
    try:
        return sorted(
            f.name for f in raw_dir.iterdir()
            if f.is_file() and not f.name.startswith('.'))
    except OSError as exc:
        ColorPrint.yellow(f"[SECRET_MANAGER] list {raw_dir} failed: {exc}")
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
    for key_name in list_secret_key_names():
        secrets[key_name] = _read_secret_value(key_name)

    return secrets


# Module-level exports
__all__ = [
    'get_secret_directories',
    'get_secret_key',
    'get_secret_key_indexed',
    'get_all_secret_keys',
    'decrypt_all_secrets',
    '_get_password_with_confirmation'
]
