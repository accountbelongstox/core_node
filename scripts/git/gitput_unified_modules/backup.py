#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Backup module for working directory
"""

import shutil
from pathlib import Path
from datetime import datetime
from gitput_unified_modules.utils import write_color_text, get_core_node_dir


def create_working_backup(backup_enabled: bool = False) -> Optional[Path]:
    """Create working directory backup"""
    if not backup_enabled:
        return None
    
    write_color_text("Creating working directory backup...", "Cyan")
    
    core_node_dir = get_core_node_dir()
    backup_dir = core_node_dir / ".git_backups"
    backup_dir.mkdir(exist_ok=True)
    
    backup_name = f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    backup_path = backup_dir / backup_name
    
    try:
        # Copy directory excluding .git and other unnecessary files
        exclude_patterns = ['.git', '.git_backups', 'node_modules', '.secret_keys']
        
        def ignore_patterns(src, names):
            ignored = []
            for name in names:
                if name in exclude_patterns:
                    ignored.append(name)
                elif any(name.startswith(pattern) for pattern in exclude_patterns):
                    ignored.append(name)
            return ignored
        
        shutil.copytree(
            core_node_dir,
            backup_path,
            ignore=ignore_patterns,
            dirs_exist_ok=True
        )
        
        write_color_text(f"Backup created: {backup_path}", "Green")
        
        # Keep only last 5 backups
        all_backups = sorted(backup_dir.glob("backup_*"), key=lambda p: p.stat().st_mtime, reverse=True)
        for old_backup in all_backups[5:]:
            try:
                shutil.rmtree(old_backup)
                write_color_text(f"Removed old backup: {old_backup.name}", "DarkGray")
            except Exception:
                pass
        
        return backup_path
        
    except Exception as e:
        write_color_text(f"Warning: Failed to create backup: {e}", "Yellow")
        return None

