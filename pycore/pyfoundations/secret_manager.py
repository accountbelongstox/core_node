"""
Secret Manager for Python

This module provides centralized encryption/decryption management for
secret keys stored in the core_node project.

Directory Structure:
    .secret_keys/
        already_encrypted/  - Encrypted files (*.js)
        .secret_ignore/     - Decrypted raw files (gitignored)

Dependencies:
    - cryptography: For AES encryption/decryption
    - Node.js: For running disguise.js encryption/decryption tool

Main Functions:
    1. decrypt_all_secrets()  - Decrypt all encrypted files
    2. encrypt_all_secrets()  - Encrypt all files to already_encrypted
    3. get_secret_key()       - Get single key value (auto-decrypt if needed)
    4. get_all_secret_keys()  - Get all keys as dictionary
"""

import os
import subprocess
import sys
from pathlib import Path
from typing import Dict, Optional, List
import getpass

# Session state to track if batch decryption has been attempted
_batch_decryption_completed = False


def _get_password(prompt: str = "Enter password: ") -> str:
    """
    Get password with asterisk masking on Windows

    Args:
        prompt: Prompt message to display

    Returns:
        Password string
    """
    if sys.platform == 'win32':
        import msvcrt
        print(prompt, end='', flush=True)
        password = []
        while True:
            key = msvcrt.getch()
            if key == b'\r':  # Enter key
                print()  # New line
                break
            elif key == b'\x08':  # Backspace
                if password:
                    password.pop()
                    # Erase the last asterisk
                    sys.stdout.write('\b \b')
                    sys.stdout.flush()
            elif key == b'\x03':  # Ctrl+C
                print()
                raise KeyboardInterrupt
            else:
                # Try to decode as UTF-8, skip if invalid
                # Check if valid UTF-8 byte
                if len(key) == 1 and 32 <= key[0] <= 126:  # Printable ASCII
                    char = key.decode('utf-8')
                    password.append(char)
                    sys.stdout.write('*')
                    sys.stdout.flush()
        return ''.join(password)
    else:
        # Use standard getpass on Linux/Mac
        return getpass.getpass(prompt)


def get_core_node_dir() -> Path:
    """
    Dynamically determine the core_node root directory

    Returns:
        Path object pointing to core_node root directory

    Raises:
        RuntimeError: If core_node directory cannot be determined
    """
    # Start from current file location
    current_dir = Path(__file__).resolve().parent

    # Search upwards for core_node markers
    max_depth = 10
    for _ in range(max_depth):
        # Check for .secret_keys or package.json
        if (current_dir / '.secret_keys').exists() or (current_dir / 'package.json').exists():
            return current_dir

        # Move to parent directory
        parent = current_dir.parent
        if parent == current_dir:
            break
        current_dir = parent

    # Check global variables
    if 'CORE_NODE_DIR' in os.environ:
        return Path(os.environ['CORE_NODE_DIR'])

    # Fallback to common location
    fallback = Path('D:/programing/core_node')
    if fallback.exists():
        return fallback

    raise RuntimeError("ERROR: Cannot determine core_node directory")


def get_secret_directories() -> Dict[str, Path]:
    """
    Get all secret-related directory paths

    Returns:
        Dictionary with paths:
        - CORE_NODE_DIR: Project root
        - SCRIPTS_DIR: Scripts directory
        - SECRET_KEYS_DIR: .secret_keys directory
        - ENCRYPTED_DIR: already_encrypted directory
        - RAW_DIR: .secret_ignore directory
    """
    core_node_dir = get_core_node_dir()
    scripts_dir = core_node_dir / 'scripts'
    secret_keys_dir = core_node_dir / '.secret_keys'
    encrypted_dir = secret_keys_dir / 'already_encrypted'
    raw_dir = secret_keys_dir / '.secret_ignore'

    return {
        'CORE_NODE_DIR': core_node_dir,
        'SCRIPTS_DIR': scripts_dir,
        'SECRET_KEYS_DIR': secret_keys_dir,
        'ENCRYPTED_DIR': encrypted_dir,
        'RAW_DIR': raw_dir
    }


def find_disguise_tool(scripts_dir: Path) -> Optional[Path]:
    """
    Search for disguise.js in the scripts directory

    Args:
        scripts_dir: Path to scripts directory

    Returns:
        Path to disguise.js if found, None otherwise
    """
    if not scripts_dir.exists():
        return None

    # Search for disguise.js
    for disguise_js in scripts_dir.rglob('disguise.js'):
        return disguise_js

    return None


def find_node_command() -> Optional[str]:
    """
    Find available Node.js command

    Returns:
        'node' or 'nodejs' if found, None otherwise
    """
    for cmd in ['node', 'nodejs']:
        # Test if command exists and works
        result = subprocess.run([cmd, '--version'],
                                capture_output=True,
                                timeout=5)
        if result.returncode == 0:
            return cmd
    return None


def decrypt_all_secrets(output_dir: Optional[Path] = None,
                       password: Optional[str] = None) -> bool:
    """
    Decrypt all encrypted files

    Args:
        output_dir: Target directory for decrypted files (default: .secret_ignore)
        password: Decryption password (if not provided, will prompt)

    Returns:
        True if successful, False otherwise
    """
    dirs = get_secret_directories()

    if output_dir is None:
        output_dir = dirs['RAW_DIR']

    # Create output directory if needed
    if not output_dir.exists():
        # Check if parent directory is writable
        parent_dir = output_dir.parent
        if not parent_dir.exists() or not os.access(parent_dir, os.W_OK):
            print(f"[SECRET_DECRYPT_ALL] ERROR: Cannot create output directory (no write access): {parent_dir}")
            return False

        output_dir.mkdir(parents=True, exist_ok=True)

    # Check encrypted directory exists
    if not dirs['ENCRYPTED_DIR'].exists():
        print(f"[SECRET_DECRYPT_ALL] ERROR: Encrypted directory not found: {dirs['ENCRYPTED_DIR']}")
        return False

    # Find encrypted files
    encrypted_files = list(dirs['ENCRYPTED_DIR'].glob('*.js'))

    if not encrypted_files:
        print(f"[SECRET_DECRYPT_ALL] No encrypted files found in: {dirs['ENCRYPTED_DIR']}")
        return True

    print(f"[SECRET_DECRYPT_ALL] Found {len(encrypted_files)} encrypted files")

    # Find disguise.js tool
    disguise_js = find_disguise_tool(dirs['SCRIPTS_DIR'])

    if not disguise_js or not disguise_js.exists():
        print(f"[SECRET_DECRYPT_ALL] ERROR: disguise.js not found in: {dirs['SCRIPTS_DIR']}")
        return False

    print(f"[SECRET_DECRYPT_ALL] Using decryption tool: {disguise_js}")

    # Find Node.js
    node_cmd = find_node_command()
    if not node_cmd:
        print("[SECRET_DECRYPT_ALL] ERROR: Node.js not found")
        return False

    # Get password
    if not password:
        password = _get_password("[SECRET_DECRYPT_ALL] Enter decryption password: ")

    if not password:
        print("[SECRET_DECRYPT_ALL] ERROR: Password is required")
        return False

    success_count = 0
    fail_count = 0

    # Decrypt each file
    for encrypted_file in encrypted_files:
        file_name = encrypted_file.name
        key_name = encrypted_file.stem  # Remove .js extension

        print(f"[SECRET_DECRYPT_ALL] Decrypting: {file_name} -> {key_name}")

        # Run node disguise.js with pwd mode for decryption
        result = subprocess.run(
            [node_cmd, str(encrypted_file), 'pwd', password, str(output_dir)],
            capture_output=True,
            text=True,
            timeout=30
        )

        if result.returncode == 0:
            print(f"[SECRET_DECRYPT_ALL]    SUCCESS: {key_name}")
            success_count += 1
        else:
            print(f"[SECRET_DECRYPT_ALL]    FAILED: {key_name}")
            if result.stderr:
                print(f"[SECRET_DECRYPT_ALL]   Error: {result.stderr}")
            fail_count += 1

    # Print summary
    print("")
    print("[SECRET_DECRYPT_ALL] " + "=" * 40)
    print("[SECRET_DECRYPT_ALL] Decryption Summary:")
    print(f"[SECRET_DECRYPT_ALL]   Total files: {len(encrypted_files)}")
    print(f"[SECRET_DECRYPT_ALL]   Successful:  {success_count}")
    print(f"[SECRET_DECRYPT_ALL]   Failed:      {fail_count}")
    print(f"[SECRET_DECRYPT_ALL]   Output dir:  {output_dir}")
    print("[SECRET_DECRYPT_ALL] " + "=" * 40)

    # Clear password from memory
    password = None

    return fail_count == 0


def encrypt_all_secrets(source_dir: Path,
                       password: Optional[str] = None) -> bool:
    """
    Encrypt all files to already_encrypted

    Args:
        source_dir: Directory containing files to encrypt
        password: Encryption password (if not provided, will prompt)

    Returns:
        True if successful, False otherwise
    """
    if not source_dir:
        print("[SECRET_ENCRYPT_ALL] ERROR: Source directory parameter is required")
        return False

    if not source_dir.exists():
        print(f"[SECRET_ENCRYPT_ALL] ERROR: Source directory not found: {source_dir}")
        return False

    dirs = get_secret_directories()

    # Create encrypted directory if needed
    if not dirs['ENCRYPTED_DIR'].exists():
        # Check if parent directory is writable
        parent_dir = dirs['ENCRYPTED_DIR'].parent
        if not parent_dir.exists() or not os.access(parent_dir, os.W_OK):
            print(f"[SECRET_ENCRYPT_ALL] ERROR: Cannot create encrypted directory (no write access): {parent_dir}")
            return False

        dirs['ENCRYPTED_DIR'].mkdir(parents=True, exist_ok=True)

    # Find source files (excluding hidden files)
    source_files = [f for f in source_dir.iterdir()
                   if f.is_file() and not f.name.startswith('.')]

    if not source_files:
        print(f"[SECRET_ENCRYPT_ALL] No files found in source directory: {source_dir}")
        return True

    print(f"[SECRET_ENCRYPT_ALL] Found {len(source_files)} files to encrypt")

    # Find disguise.js tool
    disguise_js = find_disguise_tool(dirs['SCRIPTS_DIR'])

    if not disguise_js or not disguise_js.exists():
        print(f"[SECRET_ENCRYPT_ALL] ERROR: disguise.js not found in: {dirs['SCRIPTS_DIR']}")
        return False

    print(f"[SECRET_ENCRYPT_ALL] Using encryption tool: {disguise_js}")

    # Find Node.js
    node_cmd = find_node_command()
    if not node_cmd:
        print("[SECRET_ENCRYPT_ALL] ERROR: Node.js not found")
        return False

    # Get password with confirmation
    if not password:
        password = _get_password("[SECRET_ENCRYPT_ALL] Enter encryption password: ")
        password_confirm = _get_password("[SECRET_ENCRYPT_ALL] Confirm password: ")

        if password != password_confirm:
            print("[SECRET_ENCRYPT_ALL] ERROR: Passwords do not match")
            return False

        password_confirm = None

    if not password:
        print("[SECRET_ENCRYPT_ALL] ERROR: Password is required")
        return False

    success_count = 0
    fail_count = 0

    # Encrypt each file
    for source_file in source_files:
        key_name = source_file.name
        output_file = dirs['ENCRYPTED_DIR'] / f"{key_name}.js"

        print(f"[SECRET_ENCRYPT_ALL] Encrypting: {key_name} -> {key_name}.js")

        # Verify source file exists and is readable
        if not source_file.exists():
            print(f"[SECRET_ENCRYPT_ALL]    FAILED: Source file not found: {source_file}")
            fail_count += 1
            continue

        # Run node disguise.js for encryption
        # disguise.js expects: node disguise.js <inputPath> <password> <outputDir>
        result = subprocess.run(
            [node_cmd, str(disguise_js), str(source_file), password, str(dirs['ENCRYPTED_DIR'])],
            capture_output=True,
            text=True,
            timeout=30
        )

        if result.returncode == 0 and output_file.exists():
            print(f"[SECRET_ENCRYPT_ALL]    SUCCESS: {key_name}.js")
            success_count += 1
        else:
            print(f"[SECRET_ENCRYPT_ALL]    FAILED: {key_name}")
            if result.stderr:
                print(f"[SECRET_ENCRYPT_ALL]   Error: {result.stderr}")
            if result.stdout:
                print(f"[SECRET_ENCRYPT_ALL]   Output: {result.stdout}")
            fail_count += 1

    # Print summary
    print("")
    print("[SECRET_ENCRYPT_ALL] " + "=" * 40)
    print("[SECRET_ENCRYPT_ALL] Encryption Summary:")
    print(f"[SECRET_ENCRYPT_ALL]   Total files: {len(source_files)}")
    print(f"[SECRET_ENCRYPT_ALL]   Successful:  {success_count}")
    print(f"[SECRET_ENCRYPT_ALL]   Failed:      {fail_count}")
    print(f"[SECRET_ENCRYPT_ALL]   Output dir:  {dirs['ENCRYPTED_DIR']}")
    print("[SECRET_ENCRYPT_ALL] " + "=" * 40)

    # Clear password from memory
    password = None

    return fail_count == 0


def get_secret_key(key_name: str) -> Optional[str]:
    """
    Get single secret key value

    Returns raw value if already decrypted, or auto-triggers batch decryption if needed

    Args:
        key_name: Name of the secret key

    Returns:
        Secret value as string, or None if not found/failed
    """
    global _batch_decryption_completed

    if not key_name:
        print("[SECRET_GET_KEY] ERROR: KeyName parameter is required")
        return None

    dirs = get_secret_directories()
    raw_file = dirs['RAW_DIR'] / key_name
    encrypted_file = dirs['ENCRYPTED_DIR'] / f"{key_name}.js"

    # Check if raw file exists
    if raw_file.exists():
        # Check if file is readable
        if os.access(raw_file, os.R_OK):
            content = raw_file.read_text(encoding='utf-8')
            if content:
                return content.strip()

    # Check if encrypted file exists
    if not encrypted_file.exists():
        print(f"[SECRET_GET_KEY] ERROR: Key not found: {key_name}")
        print(f"[SECRET_GET_KEY] Encrypted file missing: {encrypted_file}")
        return None

    # Trigger batch decryption if not done yet
    if not _batch_decryption_completed:
        print("[SECRET_GET_KEY] Raw file not found, triggering batch decryption...")

        if decrypt_all_secrets(output_dir=dirs['RAW_DIR']):
            _batch_decryption_completed = True
        else:
            print("[SECRET_GET_KEY] WARNING: Batch decryption failed or incomplete")

    # Try reading raw file again
    if raw_file.exists():
        # Check if file is readable
        if os.access(raw_file, os.R_OK):
            content = raw_file.read_text(encoding='utf-8')
            if content:
                return content.strip()

    print(f"[SECRET_GET_KEY] ERROR: Failed to retrieve key: {key_name}")
    return None


def get_all_secret_keys() -> Dict[str, str]:
    """
    Get all secret keys as dictionary

    Auto-decrypts if needed and returns all keys in a dictionary

    Returns:
        Dictionary mapping key names to their values
    """
    global _batch_decryption_completed

    dirs = get_secret_directories()

    # Create raw directory if needed
    if not dirs['RAW_DIR'].exists():
        dirs['RAW_DIR'].mkdir(parents=True, exist_ok=True)

    # Get all raw files
    raw_files = [f for f in dirs['RAW_DIR'].iterdir()
                if f.is_file() and not f.name.startswith('.')]

    # If no raw files, trigger batch decryption
    if not raw_files and not _batch_decryption_completed:
        print("[SECRET_GET_ALL] No raw files found, triggering batch decryption...")

        if decrypt_all_secrets(output_dir=dirs['RAW_DIR']):
            _batch_decryption_completed = True
            # Refresh file list
            raw_files = [f for f in dirs['RAW_DIR'].iterdir()
                        if f.is_file() and not f.name.startswith('.')]

    # Build dictionary
    secrets = {}
    for raw_file in raw_files:
        key_name = raw_file.name
        # Check if file is readable
        if not os.access(raw_file, os.R_OK):
            print(f"[SECRET_GET_ALL] WARNING: Cannot read {key_name}: Permission denied")
            continue

        content = raw_file.read_text(encoding='utf-8')
        if content:
            secrets[key_name] = content.strip()

    return secrets


def set_secret_key(key_name: str, value: str, password: Optional[str] = None) -> bool:
    """
    Set a secret key value (encrypt and save)

    Args:
        key_name: Name of the secret key
        value: Value to encrypt and save
        password: Encryption password (if not provided, will prompt ONCE)

    Returns:
        True if successful, False otherwise
    """
    if not key_name:
        print("[SECRET_SET_KEY] ERROR: KeyName parameter is required")
        return False

    if not value:
        print("[SECRET_SET_KEY] ERROR: Value parameter is required")
        return False

    dirs = get_secret_directories()
    disguise_js = find_disguise_tool(dirs['SCRIPTS_DIR'])

    if not disguise_js or not disguise_js.exists():
        print(f"[SECRET_SET_KEY] ERROR: disguise.js not found in: {dirs['SCRIPTS_DIR']}")
        return False

    # Find Node.js
    node_cmd = find_node_command()
    if not node_cmd:
        print("[SECRET_SET_KEY] ERROR: Node.js not found")
        return False

    # Get password if not provided
    if not password:
        password = _get_password("[SECRET_SET_KEY] Enter encryption password: ")
        if not password:
            print("[SECRET_SET_KEY] ERROR: Password is required")
            return False

    # Create temporary directory for the value
    import tempfile
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        temp_file = temp_path / key_name

        # Write value to temporary file
        # Check if temp directory is writable
        if not os.access(temp_path, os.W_OK):
            print(f"[SECRET_SET_KEY] ERROR: Temporary directory not writable: {temp_path}")
            return False

        temp_file.write_text(value, encoding='utf-8')

        # Create encrypted directory if needed
        if not dirs['ENCRYPTED_DIR'].exists():
            # Check if parent directory is writable
            parent_dir = dirs['ENCRYPTED_DIR'].parent
            if not parent_dir.exists() or not os.access(parent_dir, os.W_OK):
                print(f"[SECRET_SET_KEY] ERROR: Cannot create encrypted directory (no write access): {parent_dir}")
                return False

            dirs['ENCRYPTED_DIR'].mkdir(parents=True, exist_ok=True)

        # Encrypt directly using disguise.js
        output_file = dirs['ENCRYPTED_DIR'] / f"{key_name}.js"

        result = subprocess.run(
            [node_cmd, str(disguise_js), str(temp_file), password, str(dirs['ENCRYPTED_DIR'])],
            capture_output=True,
            text=True,
            timeout=30
        )

        if result.returncode == 0 and output_file.exists():
            # Also save to raw directory for immediate access
            raw_file = dirs['RAW_DIR'] / key_name

            # Ensure raw directory exists
            if not dirs['RAW_DIR'].exists():
                dirs['RAW_DIR'].mkdir(parents=True, exist_ok=True)

            # Check if raw directory is writable
            if os.access(dirs['RAW_DIR'], os.W_OK):
                raw_file.write_text(value, encoding='utf-8')
            else:
                print(f"[SECRET_SET_KEY] WARNING: Cannot save to raw directory (no write access): {dirs['RAW_DIR']}")

            return True
        else:
            print(f"[SECRET_SET_KEY] ERROR: Encryption failed")
            if result.stderr:
                print(f"[SECRET_SET_KEY]   Error: {result.stderr}")
            return False


# Module-level exports
__all__ = [
    'get_core_node_dir',
    'get_secret_directories',
    'decrypt_all_secrets',
    'encrypt_all_secrets',
    'get_secret_key',
    'get_all_secret_keys',
    'set_secret_key'
]
