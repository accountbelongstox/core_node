#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TTS Queue Operations

Centralized queue helpers for document, sentence, and word level
text-to-speech processing. Provides thread-safe enqueue/dequeue
operations plus status tracking to prevent duplicate submissions.
"""

from collections import deque
from typing import Deque, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.speech_models import (
    DocumentModel,
    SentenceModel,
    WordModel,
    ItemStatus,
    ItemType,
)
from pycore.pyfoundations.serialized_worker import (
    SerializedWorkerThread,
    call_serialized,
)


_TTS_QUEUE_STATE = 'pyutils.common.tts_queue_ops'
_TTS_QUEUE_WORKER = SerializedWorkerThread(
    _TTS_QUEUE_STATE,
    'TTSQueueOpsThread',
)
_TTS_QUEUE_WORKER.start()

TTSItem = DocumentModel | SentenceModel | WordModel


class TTSQueueOps:
    """Manage shared queues for TTS processing."""

    _max_queue_size: int = 100
    _document_queue: Deque[DocumentModel] = deque()
    _sentence_queue: Deque[SentenceModel] = deque()
    _word_queue: Deque[WordModel] = deque()
    _status_map: Dict[str, ItemStatus] = {}
    _item_type_map: Dict[str, ItemType] = {}

    @classmethod
    def configure(cls, max_queue_size: int) -> None:
        """Update max queue capacity (applies to future enqueue operations)."""
        call_serialized(_TTS_QUEUE_STATE, cls._configure, max_queue_size)

    @classmethod
    def _configure(cls, max_queue_size: int) -> None:
        """Configure on the queue-owner thread."""
        if max_queue_size > 0:
            cls._max_queue_size = max_queue_size

    @classmethod
    def add_document(cls, document: DocumentModel) -> bool:
        """Enqueue document for processing."""
        document.status = ItemStatus.PENDING
        return call_serialized(
            _TTS_QUEUE_STATE,
            cls._enqueue,
            document,
            ItemType.DOCUMENT,
        )

    @classmethod
    def add_sentence(cls, sentence: SentenceModel) -> bool:
        """Enqueue sentence for processing."""
        sentence.status = ItemStatus.PENDING
        return call_serialized(
            _TTS_QUEUE_STATE,
            cls._enqueue,
            sentence,
            ItemType.SENTENCE,
        )

    @classmethod
    def add_word(cls, word: WordModel) -> bool:
        """Enqueue word for processing."""
        word.status = ItemStatus.PENDING
        return call_serialized(
            _TTS_QUEUE_STATE,
            cls._enqueue,
            word,
            ItemType.WORD,
        )

    @classmethod
    def get_document(cls, timeout: float = 0.0) -> Optional[DocumentModel]:
        """Retrieve next document if available."""
        item = call_serialized(_TTS_QUEUE_STATE, cls._dequeue, ItemType.DOCUMENT)
        if item:
            item.status = ItemStatus.PROCESSING
        return item

    @classmethod
    def get_sentence(cls, timeout: float = 0.0) -> Optional[SentenceModel]:
        """Retrieve next sentence if available."""
        item = call_serialized(_TTS_QUEUE_STATE, cls._dequeue, ItemType.SENTENCE)
        if item:
            item.status = ItemStatus.PROCESSING
        return item

    @classmethod
    def get_word(cls, timeout: float = 0.0) -> Optional[WordModel]:
        """Retrieve next word if available."""
        item = call_serialized(_TTS_QUEUE_STATE, cls._dequeue, ItemType.WORD)
        if item:
            item.status = ItemStatus.PROCESSING
        return item

    @classmethod
    def mark_completed(cls, item_md5: str) -> None:
        """Mark item as completed and clear tracking."""
        call_serialized(_TTS_QUEUE_STATE, cls._mark_completed, item_md5)

    @classmethod
    def _mark_completed(cls, item_md5: str) -> None:
        """Complete an item on the queue-owner thread."""
        if item_md5 in cls._status_map:
            cls._status_map[item_md5] = ItemStatus.COMPLETED
            cls._item_type_map.pop(item_md5, None)

    @classmethod
    def mark_failed(cls, item_md5: str) -> None:
        """Mark item as failed but keep record for diagnostics."""
        call_serialized(_TTS_QUEUE_STATE, cls._mark_failed, item_md5)

    @classmethod
    def _mark_failed(cls, item_md5: str) -> None:
        """Fail an item on the queue-owner thread."""
        if item_md5 in cls._status_map:
            cls._status_map[item_md5] = ItemStatus.FAILED

    @classmethod
    def get_status(cls, item_md5: str) -> Optional[ItemStatus]:
        """Return status for a tracked item."""
        return call_serialized(_TTS_QUEUE_STATE, cls._status_map.get, item_md5)

    @classmethod
    def queue_size(cls, item_type: ItemType) -> int:
        """Return queue size for a given type."""
        return call_serialized(_TTS_QUEUE_STATE, cls._queue_size, item_type)

    @classmethod
    def _queue_size(cls, item_type: ItemType) -> int:
        """Read queue size on the queue-owner thread."""
        if item_type == ItemType.DOCUMENT:
            return len(cls._document_queue)
        if item_type == ItemType.SENTENCE:
            return len(cls._sentence_queue)
        if item_type == ItemType.WORD:
            return len(cls._word_queue)
        return 0

    @classmethod
    def _enqueue(cls, item: TTSItem, item_type: ItemType) -> bool:
        """Shared enqueue logic using deque."""
        queue_obj = cls._queue_for(item_type)
        item_md5 = getattr(item, "md5", "")
        if not item_md5:
            return False
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
    def _dequeue(cls, item_type: ItemType) -> Optional[TTSItem]:
        """Shared dequeue logic using deque."""
        queue_obj = cls._queue_for(item_type)
        if not queue_obj:
            return None
        item = queue_obj.popleft()
        cls._status_map[item.md5] = ItemStatus.PROCESSING
        return item

    @classmethod
    def _queue_for(cls, item_type: ItemType) -> Deque[TTSItem]:
        """Return the owner-thread queue for one item type."""
        if item_type == ItemType.DOCUMENT:
            return cls._document_queue
        if item_type == ItemType.SENTENCE:
            return cls._sentence_queue
        return cls._word_queue


__all__ = [
    'TTSQueueOps',
]
