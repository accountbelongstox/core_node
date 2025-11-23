#!/usr/bin/env python3
"""
Secret Manager Module

Handles secret loading from encrypted files and .secret_ignore directory.
"""

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

    def _read_raw_value(self, key_name):
        target_file = self.raw_dir / key_name
        if target_file.exists():
            try:
                content = target_file.read_text(encoding='utf-8').strip()
                if content:
                    return content
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

        success_count = 0
        for enc_file in pending_files:
            ColorMessage.write(f'  Decrypting {enc_file.name} ...', 'info')
            result = subprocess.run(
                [self.node_command, str(enc_file), 'pwd', password, str(self.raw_dir)],
                capture_output=True,
                text=True,
                timeout=60
            )

            if result.returncode == 0:
                success_count += 1
                ColorMessage.write('    OK', 'success')
            else:
                ColorMessage.write('    FAILED', 'warning')
                details = (result.stderr or result.stdout or '').strip()
                if details:
                    ColorMessage.write(f'    {details}', 'warning')

        password = None
        self.batch_attempted = True

        if success_count == len(pending_files):
            ColorMessage.write('All secret files decrypted successfully.', 'success')
            return True

        ColorMessage.write(
            f'Decrypted {success_count}/{len(pending_files)} secret files. Missing values may persist.',
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


def resolve_secret_value(secret_key_name):
    """Load a secret value using pyfoundations or the local fallback"""
    if not secret_key_name:
        return None

    value = None

    try:
        from pyfoundations import get_secret_key
        value = get_secret_key(secret_key_name)
    except Exception as exc:
        ColorMessage.write(f"Secret manager error for {secret_key_name}: {exc}", 'warning')
        value = None

    if value:
        return value

    return LOCAL_SECRET_MANAGER.get_secret(secret_key_name)


__all__ = ['LocalSecretManager', 'LOCAL_SECRET_MANAGER', 'resolve_secret_value']

