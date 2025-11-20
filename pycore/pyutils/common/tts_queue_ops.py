#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TTS Queue Operations

Centralized queue helpers for document, sentence, and word level
text-to-speech processing. Provides thread-safe enqueue/dequeue
operations plus status tracking to prevent duplicate submissions.
"""

from collections import deque
import threading
from typing import Deque, Dict, Optional

from pycore.pyfoundations import ColorPrint
from pycore.pyutils.common.tts_models import (
    DocumentModel,
    SentenceModel,
    WordModel,
    ItemStatus,
    ItemType,
)

TTSItem = DocumentModel | SentenceModel | WordModel


class TTSQueueOps:
    """Manage shared queues for TTS processing."""

    _max_queue_size: int = 100
    _document_queue: Deque[DocumentModel] = deque()
    _sentence_queue: Deque[SentenceModel] = deque()
    _word_queue: Deque[WordModel] = deque()
    _status_map: Dict[str, ItemStatus] = {}
    _item_type_map: Dict[str, ItemType] = {}
    _lock = threading.RLock()

    @classmethod
    def configure(cls, max_queue_size: int) -> None:
        """Update max queue capacity (applies to future enqueue operations)."""
        if max_queue_size > 0:
            cls._max_queue_size = max_queue_size

    @classmethod
    def add_document(cls, document: DocumentModel) -> bool:
        """Enqueue document for processing."""
        document.status = ItemStatus.PENDING
        return cls._enqueue(cls._document_queue, document, ItemType.DOCUMENT)

    @classmethod
    def add_sentence(cls, sentence: SentenceModel) -> bool:
        """Enqueue sentence for processing."""
        sentence.status = ItemStatus.PENDING
        return cls._enqueue(cls._sentence_queue, sentence, ItemType.SENTENCE)

    @classmethod
    def add_word(cls, word: WordModel) -> bool:
        """Enqueue word for processing."""
        word.status = ItemStatus.PENDING
        return cls._enqueue(cls._word_queue, word, ItemType.WORD)

    @classmethod
    def get_document(cls, timeout: float = 0.0) -> Optional[DocumentModel]:
        """Retrieve next document if available."""
        item = cls._dequeue(cls._document_queue, ItemType.DOCUMENT)
        if item:
            item.status = ItemStatus.PROCESSING
        return item

    @classmethod
    def get_sentence(cls, timeout: float = 0.0) -> Optional[SentenceModel]:
        """Retrieve next sentence if available."""
        item = cls._dequeue(cls._sentence_queue, ItemType.SENTENCE)
        if item:
            item.status = ItemStatus.PROCESSING
        return item

    @classmethod
    def get_word(cls, timeout: float = 0.0) -> Optional[WordModel]:
        """Retrieve next word if available."""
        item = cls._dequeue(cls._word_queue, ItemType.WORD)
        if item:
            item.status = ItemStatus.PROCESSING
        return item

    @classmethod
    def mark_completed(cls, item_md5: str) -> None:
        """Mark item as completed and clear tracking."""
        with cls._lock:
            if item_md5 in cls._status_map:
                cls._status_map[item_md5] = ItemStatus.COMPLETED
                cls._item_type_map.pop(item_md5, None)

    @classmethod
    def mark_failed(cls, item_md5: str) -> None:
        """Mark item as failed but keep record for diagnostics."""
        with cls._lock:
            if item_md5 in cls._status_map:
                cls._status_map[item_md5] = ItemStatus.FAILED

    @classmethod
    def get_status(cls, item_md5: str) -> Optional[ItemStatus]:
        """Return status for a tracked item."""
        return cls._status_map.get(item_md5)

    @classmethod
    def queue_size(cls, item_type: ItemType) -> int:
        """Return queue size for a given type."""
        if item_type == ItemType.DOCUMENT:
            return len(cls._document_queue)
        if item_type == ItemType.SENTENCE:
            return len(cls._sentence_queue)
        if item_type == ItemType.WORD:
            return len(cls._word_queue)
        return 0

    @classmethod
    def _enqueue(cls, queue_obj: Deque[TTSItem], item: TTSItem, item_type: ItemType) -> bool:
        """Shared enqueue logic using deque."""
        item_md5 = getattr(item, "md5", "")
        if not item_md5:
            return False
        with cls._lock:
            if item_md5 in cls._item_type_map:
                ColorPrint.yellow(f"[TTSQueue] Duplicate {item_type.value} ignored: {item_md5[:8]}")
                return False
            if len(queue_obj) >= cls._max_queue_size:
                ColorPrint.yellow(f"[TTSQueue] {item_type.value.capitalize()} queue full (max {cls._max_queue_size})")
                return False
            queue_obj.append(item)
            cls._item_type_map[item_md5] = item_type
            cls._status_map[item_md5] = ItemStatus.PENDING
        return True

    @classmethod
    def _dequeue(cls, queue_obj: Deque[TTSItem], item_type: ItemType) -> Optional[TTSItem]:
        """Shared dequeue logic using deque."""
        with cls._lock:
            if not queue_obj:
                return None
            item = queue_obj.popleft()
            cls._status_map[item.md5] = ItemStatus.PROCESSING
        return item


__all__ = [
    'TTSQueueOps',
]
