#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Clipboard Recognition Sync

Syncs speech recognition results to clipboard database for real-time sharing.
"""

from typing import Optional
from pycore.pyfoundations.color_print import ColorPrint


def add_recognition_to_clipboard(
    text: str,
    language: str = "unknown",
    source: str = "recognition",
    client_id: str = "speech_recognition",
    confidence: Optional[float] = None
) -> bool:
    """
    Add speech recognition result to clipboard database

    Args:
        text: Recognized text
        language: Language code (e.g., 'zh-CN', 'en-US')
        source: Recognition source ('recognition', 'microphone', 'system')
        client_id: Client identifier
        confidence: Recognition confidence (0.0-1.0)

    Returns:
        True if added successfully, False otherwise
    """
    try:
        from pycore.database import database_manager
        from pycore.database.models import ClipboardHistoryModel

        # Prepare content with metadata
        content = text.strip()
        if not content:
            return False

        # Check if clipboard database is initialized (by checking if engine exists)
        if "clipboard" not in database_manager.engines:
            # Clipboard database not loaded - skip silently in non-critical contexts
            # This happens when clipboard module is used without explicit database initialization
            return False

        # Add metadata to client_id for tracking
        full_client_id = f"{client_id}_{source}"

        # Add to clipboard database
        with database_manager.get_connection("clipboard") as conn:
            item_id = ClipboardHistoryModel.add_clipboard_item(
                conn,
                content=content,
                client_id=full_client_id,
                content_type="text",
                file_path=None,
                file_name=f"Recognition_{language}.txt" if language != "unknown" else "Recognition.txt",
                file_size=len(content.encode('utf-8'))
            )

        if item_id is None:
            # Duplicate item (already in recent history)
            return False

        ColorPrint.green(f"[ClipboardSync] Added to clipboard database: {content[:50]}...")
        if confidence is not None:
            ColorPrint.blue(f"[ClipboardSync] Language: {language}, Confidence: {confidence:.2%}")
        else:
            ColorPrint.blue(f"[ClipboardSync] Language: {language}")

        return True

    except Exception as e:
        ColorPrint.red(f"[ClipboardSync] Failed to add to clipboard: {e}")
        return False


def get_recognition_sync_callback(
    language: str,
    source: str = "recognition",
    client_id: str = "speech_recognition"
):
    """
    Create a callback function for recognition sync

    Args:
        language: Language code
        source: Recognition source
        client_id: Client identifier

    Returns:
        Callback function that can be used with on_recognized
    """
    def sync_callback(text: str, confidence: float):
        """Sync recognition result to clipboard"""
        add_recognition_to_clipboard(
            text=text,
            language=language,
            source=source,
            client_id=client_id,
            confidence=confidence
        )

    return sync_callback
