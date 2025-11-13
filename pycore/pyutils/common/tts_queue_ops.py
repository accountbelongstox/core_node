#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TTS Queue Operations (Common)

Shared queue operations for TTS tasks.
This is a common module for all utils.
"""

import threading
from typing import Optional, Dict
from queue import Queue

from pycore.pyfoundations.encyclopedia import ENCYCLOPEDIA
from pycore.pyutils.common.tts_models import BaseModel, ItemType, ItemStatus


class TTSQueueOps:
    """
    TTS Queue Operations
    
    Provides operations for managing TTS queues stored in Encyclopedia.
    """
    
    QUEUE_KEY_PREFIX = 'tts_queue_'
    
    @staticmethod
    def _get_queue_key(item_type: ItemType) -> str:
        """Get queue key for item type"""
        return f"{TTSQueueOps.QUEUE_KEY_PREFIX}{item_type.value}"
    
    @staticmethod
    def _get_items_key() -> str:
        """Get items storage key"""
        return f"{TTSQueueOps.QUEUE_KEY_PREFIX}items"
    
    @staticmethod
    def _get_status_key() -> str:
        """Get status storage key"""
        return f"{TTSQueueOps.QUEUE_KEY_PREFIX}status"
    
    @staticmethod
    def _ensure_queue(item_type: ItemType) -> Queue:
        """Ensure queue exists in Encyclopedia"""
        queue_key = TTSQueueOps._get_queue_key(item_type)
        queue = ENCYCLOPEDIA.get(queue_key)
        if queue is None:
            queue = Queue()
            ENCYCLOPEDIA.add(queue_key, queue)
        return queue
    
    @staticmethod
    def _get_items() -> Dict[str, BaseModel]:
        """Get items dictionary"""
        items_key = TTSQueueOps._get_items_key()
        items = ENCYCLOPEDIA.get(items_key)
        if items is None:
            items = {}
            ENCYCLOPEDIA.add(items_key, items)
        return items
    
    @staticmethod
    def _get_status() -> Dict[str, ItemStatus]:
        """Get status dictionary"""
        status_key = TTSQueueOps._get_status_key()
        status = ENCYCLOPEDIA.get(status_key)
        if status is None:
            status = {}
            ENCYCLOPEDIA.add(status_key, status)
        return status
    
    @staticmethod
    def add_document(document: 'DocumentModel') -> bool:
        """Add document to queue"""
        items = TTSQueueOps._get_items()
        status = TTSQueueOps._get_status()
        
        if document.md5 in items:
            return False
        
        items[document.md5] = document
        status[document.md5] = ItemStatus.PENDING
        queue = TTSQueueOps._ensure_queue(ItemType.DOCUMENT)
        queue.put(document)
        return True
    
    @staticmethod
    def add_sentence(sentence: 'SentenceModel') -> bool:
        """Add sentence to queue"""
        items = TTSQueueOps._get_items()
        status = TTSQueueOps._get_status()
        
        if sentence.md5 in items:
            return False
        
        items[sentence.md5] = sentence
        status[sentence.md5] = ItemStatus.PENDING
        queue = TTSQueueOps._ensure_queue(ItemType.SENTENCE)
        queue.put(sentence)
        return True
    
    @staticmethod
    def add_word(word: 'WordModel') -> bool:
        """Add word to queue"""
        items = TTSQueueOps._get_items()
        status = TTSQueueOps._get_status()
        
        if word.md5 in items:
            return False
        
        items[word.md5] = word
        status[word.md5] = ItemStatus.PENDING
        queue = TTSQueueOps._ensure_queue(ItemType.WORD)
        queue.put(word)
        return True
    
    @staticmethod
    def get_document(timeout: Optional[float] = None) -> Optional['DocumentModel']:
        """Get document from queue"""
        queue = TTSQueueOps._ensure_queue(ItemType.DOCUMENT)
        status = TTSQueueOps._get_status()
        
        try:
            item = queue.get(timeout=timeout)
            status[item.md5] = ItemStatus.PROCESSING
            return item
        except:
            return None
    
    @staticmethod
    def get_sentence(timeout: Optional[float] = None) -> Optional['SentenceModel']:
        """Get sentence from queue"""
        queue = TTSQueueOps._ensure_queue(ItemType.SENTENCE)
        status = TTSQueueOps._get_status()
        
        try:
            item = queue.get(timeout=timeout)
            status[item.md5] = ItemStatus.PROCESSING
            return item
        except:
            return None
    
    @staticmethod
    def get_word(timeout: Optional[float] = None) -> Optional['WordModel']:
        """Get word from queue"""
        queue = TTSQueueOps._ensure_queue(ItemType.WORD)
        status = TTSQueueOps._get_status()
        
        try:
            item = queue.get(timeout=timeout)
            status[item.md5] = ItemStatus.PROCESSING
            return item
        except:
            return None
    
    @staticmethod
    def mark_completed(md5: str):
        """Mark item as completed"""
        items = TTSQueueOps._get_items()
        status = TTSQueueOps._get_status()
        
        if md5 in status:
            status[md5] = ItemStatus.COMPLETED
            if md5 in items:
                items[md5].update_timestamp()
    
    @staticmethod
    def mark_failed(md5: str):
        """Mark item as failed"""
        status = TTSQueueOps._get_status()
        if md5 in status:
            status[md5] = ItemStatus.FAILED
    
    @staticmethod
    def get_status(md5: str) -> Optional[ItemStatus]:
        """Get item status"""
        status = TTSQueueOps._get_status()
        return status.get(md5)
    
    @staticmethod
    def get_item(md5: str) -> Optional[BaseModel]:
        """Get item by MD5"""
        items = TTSQueueOps._get_items()
        return items.get(md5)
    
    @staticmethod
    def has_pending() -> bool:
        """Check if there are pending items"""
        doc_queue = TTSQueueOps._ensure_queue(ItemType.DOCUMENT)
        sent_queue = TTSQueueOps._ensure_queue(ItemType.SENTENCE)
        word_queue = TTSQueueOps._ensure_queue(ItemType.WORD)
        
        return not (doc_queue.empty() and sent_queue.empty() and word_queue.empty())
    
    @staticmethod
    def get_queue_sizes() -> Dict[str, int]:
        """Get queue sizes"""
        doc_queue = TTSQueueOps._ensure_queue(ItemType.DOCUMENT)
        sent_queue = TTSQueueOps._ensure_queue(ItemType.SENTENCE)
        word_queue = TTSQueueOps._ensure_queue(ItemType.WORD)
        
        return {
            'documents': doc_queue.qsize(),
            'sentences': sent_queue.qsize(),
            'words': word_queue.qsize(),
        }

