#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TTS Translator

Provides translation functionality with MD5-based caching.
"""

import hashlib
import json
import time
from pathlib import Path
from typing import Dict, Optional, List

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.database_base import DatabaseBase
from pycore.pyutils.edge_tts.config import TTSConfig
from pycore.pyutils.common.tts_models import SentenceModel, WordModel, DocumentModel


class TTSTranslator:
    """
    Translator for TTS items with SQLite caching
    
    Features:
    - MD5-based translation caching
    - Sentence-level translation
    - Document translation (sentence map)
    - SQLite storage
    """
    
    def __init__(self):
        """Initialize translator"""
        self.db: Optional[DatabaseBase] = None
        self._initialized = False
    
    def initialize(self) -> bool:
        """Initialize translator database"""
        if self._initialized:
            return True
        
        db_path = TTSConfig.TTS_CACHE_TRANSLATE_DB
        self.db = DatabaseBase(db_path)
        self.db.connect()
        
        # Create cache_translate table
        schema = {
            'content': 'TEXT',
            'md5': 'TEXT PRIMARY KEY',
            'translation': 'TEXT',  # JSON string
            'done': 'INTEGER DEFAULT 0',
            'done_at': 'REAL',
            'created_at': 'REAL DEFAULT (strftime(\'%s\', \'now\'))',
        }
        self.db.create_table('cache_translate', schema)
        
        self._initialized = True
        return True
    
    def get_translation(self, content: str) -> Optional[Dict[str, str]]:
        """
        Get translation from cache
        
        Args:
            content: Content to translate
        
        Returns:
            Dict[str, str]: Translation map or None if not found
        """
        if not self.initialize():
            return None
        
        md5 = hashlib.md5(content.encode('utf-8')).hexdigest()
        query = "SELECT translation, done FROM cache_translate WHERE md5 = ?"
        result = self.db.fetchone(query, (md5,))
        
        if result and result['done']:
            translation_json = result['translation']
            if translation_json:
                return json.loads(translation_json)
        
        return None
    
    def save_translation(self, content: str, translation: Dict[str, str]) -> bool:
        """
        Save translation to cache
        
        Args:
            content: Original content
            translation: Translation map
        
        Returns:
            bool: True if saved successfully
        """
        if not self.initialize():
            return False
        
        md5 = hashlib.md5(content.encode('utf-8')).hexdigest()
        translation_json = json.dumps(translation, ensure_ascii=False)
        
        with self.db.transaction():
            # Check if exists
            existing = self.db.fetchone("SELECT md5 FROM cache_translate WHERE md5 = ?", (md5,))
            
            if existing:
                # Update
                query = "UPDATE cache_translate SET translation = ?, done = 1, done_at = ? WHERE md5 = ?"
                self.db.execute(query, (translation_json, time.time(), md5))
            else:
                # Insert
                query = "INSERT INTO cache_translate (content, md5, translation, done, done_at) VALUES (?, ?, ?, 1, ?)"
                self.db.execute(query, (content, md5, translation_json, time.time()))
        
        return True
    
    def translate_sentence(self, sentence: SentenceModel) -> Optional[Dict[str, str]]:
        """
        Translate sentence (with caching)
        
        Args:
            sentence: Sentence model
        
        Returns:
            Dict[str, str]: Translation map or None
        """
        # Check cache first
        translation = self.get_translation(sentence.content)
        if translation:
            sentence.translation = translation
            return translation
        
        # TODO: Implement actual translation API call
        # For now, return None (translation not implemented)
        return None
    
    def translate_document(self, document: DocumentModel) -> Optional[Dict[str, List[str]]]:
        """
        Translate document (sentence by sentence)
        
        Args:
            document: Document model
        
        Returns:
            Dict[str, List[str]]: Map of sentence MD5 to translations
        """
        translations = {}
        
        for sentence in document.sentences:
            translation = self.translate_sentence(sentence)
            if translation:
                translations[sentence.md5] = translation
        
        if translations:
            document.translation = translations
        
        return translations if translations else None

