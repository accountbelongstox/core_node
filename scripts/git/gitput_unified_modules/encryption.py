#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Encryption check module for sensitive files
"""

from pathlib import Path
from typing import List
from gitput_unified_modules.utils import (
    write_color_text,
    get_core_node_dir,
    read_masked_password,
)
from pycore.pyfoundations.secret_crypto_batch import password_is_main, run_secret_crypto


def check_unencrypted_files() -> List[Path]:
    """Check for unencrypted sensitive files"""
    core_node_dir = get_core_node_dir()
    secret_keys_dir = core_node_dir / ".secret_keys"
    secret_keys_raw_dir = secret_keys_dir / ".secret_ignore"
    secret_keys_encrypted_dir = secret_keys_dir / "already_encrypted"
    
    if not secret_keys_raw_dir.exists():
        return []
    
    write_color_text(f"Scanning directory: {secret_keys_raw_dir}", "Cyan")
    
    unencrypted_files = []
    
    for raw_file in secret_keys_raw_dir.iterdir():
        if not raw_file.is_file():
            continue
        
        encrypted_file = secret_keys_encrypted_dir / f"{raw_file.name}.js"
        
        # Check if raw file needs encryption
        if not encrypted_file.exists():
            unencrypted_files.append(raw_file)
        elif raw_file.stat().st_mtime > encrypted_file.stat().st_mtime:
            unencrypted_files.append(raw_file)
    
    return unencrypted_files


def encrypt_files(file_paths: List[Path], password: str, output_dir: Path) -> bool:
    """Encrypt every file in one secret_crypto.js batch call (one password,
    parallel key derivation). Returns True only if all files encrypted."""
    write_color_text(f"Encrypting {len(file_paths)} file(s) in one batch...", "Cyan")

    result = run_secret_crypto('encrypt', password, [str(path) for path in file_paths], out_dir=str(output_dir))
    if not result.ok:
        write_color_text(f"WARNING: secret_crypto.js failed to run: {result.run_error}", "Yellow")
        return False

    for name in result.encrypted:
        write_color_text(f"SUCCESS: Encrypted {name}", "Green")
    for name in result.error:
        write_color_text(f"WARNING: Failed to encrypt {name}: {result.errors.get(name, '')}", "Yellow")

    return len(result.encrypted) == len(file_paths)


def process_encryption() -> bool:
    """Process encryption for unencrypted files"""
    unencrypted_files = check_unencrypted_files()
    
    if not unencrypted_files:
        write_color_text("SUCCESS: No unencrypted sensitive files found.", "Green")
        return True
    
    write_color_text("WARNING: Unencrypted sensitive files detected!", "Yellow")
    write_color_text(f"[SECRET] Found {len(unencrypted_files)} unencrypted sensitive files:", "Red")
    for file in unencrypted_files:
        write_color_text(f"  - {file}", "Yellow")
    print("")
    
    # Ask for encryption confirmation
    try:
        encrypt_confirm = input("Do you want to encrypt these files before pushing? (Y/n): ").strip()
        if encrypt_confirm and encrypt_confirm.lower() not in ['y', 'yes']:
            write_color_text("Skipping encryption. Continuing with git push.", "Yellow")
            write_color_text("WARNING: Sensitive files will be pushed unencrypted!", "Red")
            return True
    except (EOFError, KeyboardInterrupt):
        write_color_text("Skipping encryption due to user cancellation.", "Yellow")
        return True
    
    write_color_text("Starting automatic encryption...", "Cyan")

    # Get password once for all files
    write_color_text("Enter encryption password for all sensitive files:", "Yellow")
    global_password = None
    
    while True:
        password1 = read_masked_password("Enter encryption password: ")
        
        if not password1:
            write_color_text("ERROR: Password cannot be empty. Please try again.", "Red")
            continue
        
        password2 = read_masked_password("Confirm encryption password: ")
        
        if password1 != password2:
            write_color_text("ERROR: Passwords do not match. Please try again.", "Red")
            continue
        # A matching pair can still be a different password than the existing
        # secrets use; encrypting with it would split the secret store.
        if not password_is_main(password1, [path.name for path in unencrypted_files]):
            write_color_text("ERROR: This password does not decrypt the existing secrets; enter the main secret password.", "Red")
            continue
        global_password = password1
        break
    
    # Encrypt all files in one batch
    core_node_dir = get_core_node_dir()
    secret_keys_encrypted_dir = core_node_dir / ".secret_keys" / "already_encrypted"
    secret_keys_encrypted_dir.mkdir(parents=True, exist_ok=True)

    encryption_failed = not encrypt_files(unencrypted_files, global_password, secret_keys_encrypted_dir)

    if encryption_failed:
        write_color_text("WARNING: Some files failed to encrypt, but continuing with git push.", "Yellow")
        write_color_text("Please manually encrypt failed files later.", "Yellow")
    else:
        write_color_text("SUCCESS: All files encrypted successfully.", "Green")
    
    return True

