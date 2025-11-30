#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Commit message management module
"""

import os
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Optional
from gitput_unified_modules.utils import write_color_text


class CommitMessageManager:
    """Manage commit messages within a session"""
    
    def __init__(self):
        self._commit_message: Optional[str] = None
        self._commit_file = Path(tempfile.gettempdir()) / f"git_commit_message_{os.getpid()}"
    
    def get_commit_message(self) -> str:
        """Get commit message (reuse if already set in this session)"""
        # Check if we have a stored commit message
        if self._commit_file.exists():
            stored_message = self._commit_file.read_text(encoding='utf-8').strip()
            if stored_message:
                write_color_text(f"Reusing commit message from this session: {stored_message}", "Cyan")
                self._commit_message = stored_message
                return self._commit_message
        
        # If we already have a message in this session, use it
        if self._commit_message:
            return self._commit_message
        
        # Ask user for input
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        try:
            write_color_text("Enter commit message (press Enter to use timestamp): ", "Yellow")
            user_input = input().strip()
            
            if not user_input:
                self._commit_message = timestamp
                write_color_text(f"Using timestamp as commit message: {timestamp}", "Cyan")
            else:
                self._commit_message = user_input
                write_color_text(f"Using custom commit message: {user_input}", "Green")
        except (EOFError, KeyboardInterrupt):
            self._commit_message = timestamp
            write_color_text(f"Using timestamp as commit message: {timestamp}", "Cyan")
        
        # Store the commit message in a file
        try:
            self._commit_file.write_text(self._commit_message, encoding='utf-8')
        except Exception:
            pass
        
        return self._commit_message


# Global instance
_commit_message_manager = CommitMessageManager()


def get_commit_message() -> str:
    """Get commit message (session-scoped)"""
    return _commit_message_manager.get_commit_message()

