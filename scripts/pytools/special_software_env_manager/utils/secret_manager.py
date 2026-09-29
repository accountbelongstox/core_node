#!/usr/bin/env python3
"""
Secret Manager Module

Handles secret loading from encrypted files and .secret_ignore directory.
"""

import os
# Reading a secret must NEVER trigger the ML dependency installer. This module imports
# pyfoundations (lazily, in resolve_secret_value) only for get_secret_key; importing it runs
# third_party.py's import-time check_and_install_dependencies(). Skip it so any tool that
# reuses this secret loader stays lightweight.
os.environ.setdefault('PYCORE_SKIP_DEP_CHECK', '1')

import sys
import shutil
import subprocess
import getpass
from pathlib import Path

# Add pycore to path for pyfoundations import
_current_file = Path(__file__).resolve()
_project_root = _current_file.parent.parent.parent.parent.parent
_pycore_path = _project_root / 'pycore'
if _pycore_path.exists() and str(_pycore_path) not in sys.path:
    sys.path.insert(0, str(_pycore_path))

from utils.common_utils import ColorMessage, get_project_root
from config.path_config import get_path_config

# Placeholder the password runner replaces with the password read from stdin.
SECRET_PASSWORD_ARG = '--password-stdin'
# secret_crypto.js decrypts/encrypts/verifies any number of files in ONE process
# with ONE password (parallel key derivation); a wrong password writes nothing.
# This module stays independent of pycore (see the comment above), so it talks
# to the tool directly instead of importing pycore.pyfoundations.secret_crypto_batch.
SECRET_CRYPTO_RESULT_TAG = 'SECRET_CRYPTO'
SECRET_CRYPTO_FORCE_FLAG = '--force'
SECRET_CRYPTO_TIMEOUT_SECONDS = 120


class LocalSecretManager:
    """Lightweight secret loader that works directly with encrypted files"""

    def __init__(self):
        self.path_config = get_path_config()
        self.project_root = self.path_config.project_root
        self.secret_keys_dir = self.path_config.secret_keys_dir
        self.raw_dir = self.path_config.raw_secret_dir
        self.encrypted_dir = self.path_config.encrypted_secret_dir
        self.batch_attempted = False
        self.node_command = self._detect_node_command()

    def _detect_node_command(self):
        for candidate in ('node', 'nodejs'):
            if shutil.which(candidate):
                return candidate
        return None

    @staticmethod
    def _remove_bom_from_bytes(data: bytes) -> bytes:
        """Remove UTF-8 BOM from bytes if present."""
        if data[:3] == b'\xef\xbb\xbf':
            return data[3:]
        return data

    @staticmethod
    def _remove_bom_from_string(text: str) -> str:
        """Remove UTF-8 BOM from string if present."""
        if text and text[0] == '\ufeff':
            return text[1:]
        return text

    def _read_raw_value(self, key_name):
        target_file = self.raw_dir / key_name
        if target_file.exists():
            try:
                # Read as bytes first to properly detect and remove BOM
                raw_bytes = target_file.read_bytes()
                raw_bytes = self._remove_bom_from_bytes(raw_bytes)
                content = raw_bytes.decode('utf-8').strip()

                # Additional safety check for string BOM
                content = self._remove_bom_from_string(content)

                if content:
                    return content
                # If file exists but is empty, return None
                return None
            except UnicodeDecodeError:
                # File is corrupted, replace with empty file instead of deleting
                try:
                    target_file.write_text('', encoding='utf-8')
                except OSError:
                    # If we can't write, try to delete
                    try:
                        target_file.unlink()
                    except OSError:
                        pass
                return None
            except OSError:
                return None
        return None

    def _encrypted_file_exists(self, key_name):
        lower = self.encrypted_dir / f"{key_name}.js"
        upper = self.encrypted_dir / f"{key_name}.JS"
        return lower.exists() or upper.exists()

    def _gather_pending_files(self):
        if not self.encrypted_dir.exists():
            return []

        files = list(self.encrypted_dir.glob('*.js')) + list(self.encrypted_dir.glob('*.JS'))
        pending = []
        for enc_file in files:
            if not enc_file.is_file():
                continue
            if not (self.raw_dir / enc_file.stem).exists():
                pending.append(enc_file)
        return pending

    def _prompt_for_password(self):
        try:
            return getpass.getpass('Enter password to decrypt secret files: ')
        except (EOFError, KeyboardInterrupt):
            return None

    @staticmethod
    def _parse_secret_crypto_output(stdout, returncode):
        """Group secret_crypto.js's per-file result lines by status.
        See scripts/encryption_tools/secret_crypto.js for the STATUS values."""
        by_status = {}
        errors = {}
        for line in (stdout or '').splitlines():
            parts = line.split('\t')
            if len(parts) < 3 or parts[0] != SECRET_CRYPTO_RESULT_TAG:
                continue
            status, name = parts[1], parts[2]
            by_status.setdefault(status, []).append(name)
            if len(parts) > 3:
                errors[name] = parts[3]
        ok = bool(by_status) or returncode == 0
        return by_status, errors, ok

    def _run_secret_crypto(self, command, password, sources, out_dir=None, force=False):
        """Run secret_crypto.js once for every source; the password goes to
        secret_password_runner.js's stdin, never on the command line."""
        args = [
            self.node_command, str(self.path_config.secret_password_runner),
            str(self.path_config.secret_crypto_js), command, SECRET_PASSWORD_ARG,
        ]
        if out_dir is not None:
            args.append(str(out_dir))
        if force:
            args.append(SECRET_CRYPTO_FORCE_FLAG)
        args.extend(str(source) for source in sources)

        result = subprocess.run(
            args, input=password, capture_output=True, text=True,
            timeout=SECRET_CRYPTO_TIMEOUT_SECONDS,
        )
        by_status, errors, ok = self._parse_secret_crypto_output(result.stdout, result.returncode)
        if not ok:
            details = (result.stderr or result.stdout or '').strip()
            ColorMessage.write(f'secret_crypto.js failed to run: {details}', 'error')
        return by_status, errors, ok

    def _trigger_batch_decryption(self):
        pending_files = self._gather_pending_files()
        if not pending_files:
            self.batch_attempted = True
            return True

        if not self.node_command:
            ColorMessage.write('Node.js is required to decrypt secret files. Please install node.', 'warning')
            self.batch_attempted = True
            return False

        if not sys.stdin.isatty():
            ColorMessage.write('Cannot prompt for secret password (non-interactive session).', 'warning')
            self.batch_attempted = True
            return False

        ColorMessage.write('Encrypted secret files detected. A password is required to decrypt them.', 'info')
        password = self._prompt_for_password()
        if not password:
            ColorMessage.write('No password provided. Skipping decryption.', 'warning')
            self.batch_attempted = True
            return False

        try:
            self.raw_dir.mkdir(parents=True, exist_ok=True)
        except OSError as exc:
            ColorMessage.write(f'Unable to create {self.raw_dir}: {exc}', 'error')
            self.batch_attempted = True
            return False

        # One process, one password, the whole already_encrypted directory at
        # once (secret_crypto.js walks it and derives every key in parallel,
        # which is what makes the batch faster than a per-file node spawn).
        # Without --force (never passed here) a wrong password writes nothing
        # and an existing raw file is never overwritten, so a bad password can
        # never clobber a good key; files already decrypted just come back
        # skipped_exists.
        ColorMessage.write(f'Decrypting {len(pending_files)} file(s) in one batch...', 'info')
        by_status, _errors, ok = self._run_secret_crypto(
            'decrypt', password, [str(self.encrypted_dir)], out_dir=self.raw_dir,
        )
        password = None
        self.batch_attempted = True

        if not ok:
            return False

        decrypted = by_status.get('decrypted', [])
        wrong_password = by_status.get('wrong_password', [])
        for name in decrypted:
            ColorMessage.write(f'  OK: {name}', 'success')
        for name in wrong_password:
            ColorMessage.write(f'  WRONG PASSWORD (nothing written): {name}', 'warning')
        for name in by_status.get('invalid_file', []) + by_status.get('error', []):
            ColorMessage.write(f'  FAILED: {name}', 'warning')

        if len(decrypted) == len(pending_files):
            ColorMessage.write('All secret files decrypted successfully.', 'success')
            return True

        ColorMessage.write(
            f'Decrypted {len(decrypted)}/{len(pending_files)} secret files. Missing values may persist.',
            'warning'
        )
        return False

    def get_secret(self, key_name):
        if not key_name or not self.secret_keys_dir.exists():
            return None

        value = self._read_raw_value(key_name)
        if value:
            return value

        if not self._encrypted_file_exists(key_name):
            return None

        if not self.batch_attempted:
            self._trigger_batch_decryption()
            return self._read_raw_value(key_name)

        return self._read_raw_value(key_name)


LOCAL_SECRET_MANAGER = LocalSecretManager()

# Track pyfoundations availability to avoid repeated error messages
_pyfoundations_available = None
_pyfoundations_error_logged = False


def resolve_secret_value(secret_key_name):
    """Load a secret value using pyfoundations or the local fallback"""
    global _pyfoundations_available, _pyfoundations_error_logged
    
    if not secret_key_name:
        return None

    value = None

    # Try pyfoundations only if we haven't determined it's unavailable
    if _pyfoundations_available is not False:
        try:
            from pyfoundations import get_secret_key
            _pyfoundations_available = True
            value = get_secret_key(secret_key_name)
        except ImportError as exc:
            # Only log import errors once
            if not _pyfoundations_error_logged:
                _pyfoundations_error_logged = True
            _pyfoundations_available = False
            value = None
        except Exception as exc:
            # For other errors, try local fallback silently
            value = None

    if value:
        return value

    # Try local secret manager
    local_value = LOCAL_SECRET_MANAGER.get_secret(secret_key_name)
    if local_value:
        return local_value
    
    # Return None if no value found (file will be handled by _read_raw_value if corrupted)
    return None


__all__ = ['LocalSecretManager', 'LOCAL_SECRET_MANAGER', 'resolve_secret_value']

