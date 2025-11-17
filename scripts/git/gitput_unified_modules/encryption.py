#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Encryption check module for sensitive files
"""

import subprocess
from pathlib import Path
from typing import List, Optional
from gitput_unified_modules.utils import (
    write_color_text,
    get_core_node_dir,
    read_masked_password,
)
from pycore.pyfoundations.pybasecommon import Commander


def find_disguise_js() -> Optional[Path]:
    """Find disguise.js in scripts directory"""
    core_node_dir = get_core_node_dir()
    scripts_dir = core_node_dir / "scripts"
    
    if not scripts_dir.exists():
        return None
    
    disguise_js = list(scripts_dir.rglob("disguise.js"))
    if disguise_js:
        return disguise_js[0]
    return None


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


def encrypt_file(file_path: Path, password: str, output_dir: Path) -> bool:
    """Encrypt a file using disguise.js"""
    disguise_js = find_disguise_js()
    if not disguise_js:
        write_color_text("WARNING: disguise.js not found in scripts directory.", "Yellow")
        return False
    
    try:
        write_color_text(f"Encrypting: {file_path.name}", "Cyan")
        
        masked_password = "*" * len(password)
        write_color_text("Encryption parameters:", "DarkGray")
        write_color_text(f"  - Tool: {disguise_js}", "DarkGray")
        write_color_text(f"  - Input: {file_path}", "DarkGray")
        write_color_text(f"  - Password: {masked_password}", "DarkGray")
        write_color_text(f"  - Output Dir: {output_dir}", "DarkGray")
        
        # Use Commander for execution
        result = Commander.exec_silent(
            ["node", str(disguise_js), str(file_path), password, str(output_dir)],
            info=False,
            cwd=None
        )
        
        # Check output for success (recommended approach)
        output = result.get_output().lower()
        if result.success and ("success" in output or "encrypted" in output or result.return_code == 0):
            write_color_text(f"SUCCESS: Encrypted {file_path.name}", "Green")
            return True
        else:
            write_color_text(f"WARNING: Failed to encrypt {file_path.name}", "Yellow")
            write_color_text(f"Error: {result.get_output()}", "Yellow")
            return False
            
    except Exception as e:
        write_color_text(f"Error encrypting {file_path.name}: {e}", "Red")
        return False


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
    
    write_color_text("Starting automatic encryption using disguise.js...", "Cyan")
    
    disguise_js = find_disguise_js()
    if not disguise_js:
        write_color_text("WARNING: disguise.js not found in scripts directory.", "Yellow")
        write_color_text("Continuing with git push. Please encrypt sensitive files manually.", "Yellow")
        return True
    
    write_color_text(f"Found disguise.js at: {disguise_js}", "Green")
    
    # Get password once for all files
    write_color_text("Enter encryption password for all sensitive files:", "Yellow")
    global_password = None
    
    while True:
        password1 = read_masked_password("Enter encryption password: ")
        
        if not password1:
            write_color_text("ERROR: Password cannot be empty. Please try again.", "Red")
            continue
        
        password2 = read_masked_password("Confirm encryption password: ")
        
        if password1 == password2:
            global_password = password1
            break
        else:
            write_color_text("ERROR: Passwords do not match. Please try again.", "Red")
    
    # Encrypt each file
    core_node_dir = get_core_node_dir()
    secret_keys_encrypted_dir = core_node_dir / ".secret_keys" / "already_encrypted"
    secret_keys_encrypted_dir.mkdir(parents=True, exist_ok=True)
    
    encryption_failed = False
    for file in unencrypted_files:
        if not encrypt_file(file, global_password, secret_keys_encrypted_dir):
            encryption_failed = True
    
    if encryption_failed:
        write_color_text("WARNING: Some files failed to encrypt, but continuing with git push.", "Yellow")
        write_color_text("Please manually encrypt failed files later.", "Yellow")
    else:
        write_color_text("SUCCESS: All files encrypted successfully.", "Green")
    
    return True

