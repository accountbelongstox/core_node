#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TTS Data Models

Provides shared data structures for document, sentence, and word level
text-to-speech operations. These models are lightweight containers used
across edge_tts, azure_speech, and queue utilities.
"""

from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional

import re



def clean_tts_text(text: str) -> str:
    """
    Clean text for TTS processing.

    - Replace asterisks (*) with spaces (asterisks are pronounced by TTS)
    - Normalize whitespace

    Args:
        text: Input text

    Returns:
        str: Cleaned text
    """
    # Replace asterisks with spaces
    text = text.replace('*', ' ')
    # Normalize multiple spaces to single space
    text = re.sub(r'\s+', ' ', text)
    # Strip leading/trailing whitespace
    return text.strip()


def _build_md5(*parts: str) -> str:
    """
    Create a stable identifier from multiple string fragments.

    IMPORTANT: Text parts are cleaned before MD5 calculation to ensure
    consistency between cache key and actual TTS generation.
    """
    # Clean each part before joining
    cleaned_parts = [clean_tts_text(part) if part else "" for part in parts]
    joined = "|".join(cleaned_parts)
    return hashlib.md5(joined.encode('utf-8')).hexdigest()


class ItemType(Enum):
    """Queue item categories."""
    DOCUMENT = "document"
    SENTENCE = "sentence"
    WORD = "word"


class ItemStatus(Enum):
    """Processing states for queue items."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class DocumentModel:
    """High-level document representation for TTS workflows."""
    content: str
    locale: str = "en-US"
    source_path: Optional[str] = None
    source_type: str = "text"
    created_at: float = field(default_factory=time.time)
    md5: str = field(init=False)
    sentences: List['SentenceModel'] = field(default_factory=list)
    words: List['WordModel'] = field(default_factory=list)
    translation: Optional[Dict[str, Dict[str, str]]] = None
    voice_files: Dict[str, str] = field(default_factory=dict)
    status: ItemStatus = ItemStatus.PENDING
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        fingerprint_source = self.source_path or self.source_type
        self.md5 = _build_md5(self.content, self.locale, str(fingerprint_source), str(self.created_at))


@dataclass
class SentenceModel:
    """Sentence-level representation with voice output metadata."""
    content: str
    locale: str = "en-US"
    document_id: Optional[str] = None
    sentence_index: int = 0
    created_at: float = field(default_factory=time.time)
    md5: str = field(init=False)
    words: List['WordModel'] = field(default_factory=list)
    translation: Optional[Dict[str, str]] = None
    voice_files: Dict[str, str] = field(default_factory=dict)
    status: ItemStatus = ItemStatus.PENDING

    def __post_init__(self):
        base_id = self.document_id or ""
        self.md5 = _build_md5(self.content, self.locale, base_id, str(self.sentence_index))


@dataclass
class WordModel:
    """Word-level representation used for granular synthesis."""
    content: str
    locale: str = "en-US"
    document_id: Optional[str] = None
    sentence_id: Optional[str] = None
    created_at: float = field(default_factory=time.time)
    md5: str = field(init=False)
    voice_files: Dict[str, str] = field(default_factory=dict)
    status: ItemStatus = ItemStatus.PENDING
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        base_sentence = self.sentence_id or ""
        base_document = self.document_id or ""
        self.md5 = _build_md5(self.content, self.locale, base_sentence, base_document, str(self.created_at))


__all__ = [
    'clean_tts_text',
    'DocumentModel',
    'SentenceModel',
    'WordModel',
    'ItemType',
    'ItemStatus',
]
