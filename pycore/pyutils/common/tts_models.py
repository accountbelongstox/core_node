#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TTS Data Models (Common)

Shared data models for TTS operations (documents, sentences, words).
This is a common module for all utils.
"""

import hashlib
import time
from dataclasses import dataclass, field
from typing import Dict, Any, Optional, List
from enum import Enum


class ItemType(Enum):
    """Item type enumeration"""
    DOCUMENT = 'document'
    SENTENCE = 'sentence'
    WORD = 'word'


class ItemStatus(Enum):
    """Item processing status"""
    PENDING = 'pending'
    PROCESSING = 'processing'
    COMPLETED = 'completed'
    FAILED = 'failed'


@dataclass
class BaseModel:
    """Base model for all TTS items"""
    content: str
    md5: str = field(init=False)
    locale: str = 'en-US'
    status: ItemStatus = ItemStatus.PENDING
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def __post_init__(self):
        """Calculate MD5 hash after initialization"""
        if not hasattr(self, 'md5') or not self.md5:
            self.md5 = hashlib.md5(self.content.encode('utf-8')).hexdigest()
    
    def update_timestamp(self):
        """Update timestamp"""
        self.updated_at = time.time()


@dataclass
class WordModel(BaseModel):
    """Word data model"""
    item_type: ItemType = ItemType.WORD
    translation: Optional[Dict[str, str]] = None
    phonetic_us: Optional[str] = None
    phonetic_uk: Optional[str] = None
    voice_files: Dict[str, str] = field(default_factory=dict)
    image_files: Dict[str, str] = field(default_factory=dict)
    query_count: int = 0
    last_query_time: float = field(default_factory=time.time)


@dataclass
class SentenceModel(BaseModel):
    """Sentence data model"""
    item_type: ItemType = ItemType.SENTENCE
    translation: Optional[Dict[str, str]] = None
    voice_files: Dict[str, str] = field(default_factory=dict)
    words: List[WordModel] = field(default_factory=list)
    document_id: Optional[str] = None
    sentence_index: int = 0


@dataclass
class DocumentModel(BaseModel):
    """Document data model"""
    item_type: ItemType = ItemType.DOCUMENT
    source_path: Optional[str] = None
    source_type: str = 'text'  # 'text', 'file', 'url'
    sentences: List[SentenceModel] = field(default_factory=list)
    translation: Optional[Dict[str, List[str]]] = None  # Map of sentence translations
    voice_files: Dict[str, str] = field(default_factory=dict)
    parsed_at: float = field(default_factory=time.time)
    
    def get_sentence_map(self) -> Dict[str, SentenceModel]:
        """Get sentence map by MD5"""
        return {sentence.md5: sentence for sentence in self.sentences}

