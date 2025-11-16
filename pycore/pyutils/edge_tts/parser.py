#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TTS File Parser

Provides file and web content parsing functionality.
"""

import hashlib
import time
from pathlib import Path
from typing import Optional, Dict, Any
from urllib.parse import urlparse

from pycore import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_requests

requests = get_third_package_requests()
from pycore.pyutils.common.tts_models import DocumentModel
from pycore.pyutils.edge_tts.processor import TTSProcessor
from pycore.pyutils.edge_tts.config import TTSConfig


class TTSFileParser:
    """
    File and web content parser for TTS
    
    Features:
    - File parsing (text, markdown, etc.)
    - Web content downloading
    - Content caching
    - Automatic sentence extraction
    """
    
    def __init__(self):
        """Initialize parser"""
        self._cache_dir = TTSConfig.TTS_CACHE_DIR / "parsed"
        self._cache_dir.mkdir(parents=True, exist_ok=True)
    
    def parse_file(self, file_path: Path, locale: Optional[str] = None) -> Optional[DocumentModel]:
        """
        Parse file into document model
        
        Args:
            file_path: Path to file
            locale: Language locale (optional, auto-detected)
        
        Returns:
            DocumentModel or None
        """
        file_path = Path(file_path)
        if not file_path.exists():
            ColorPrint.red(f"[Parser] File not found: {file_path}")
            return None
        
        # Check cache
        cache_key = hashlib.md5(str(file_path).encode('utf-8')).hexdigest()
        cache_file = self._cache_dir / f"{cache_key}.json"
        
        if cache_file.exists():
            # Load from cache
            import json
            with open(cache_file, 'r', encoding='utf-8') as f:
                cached_data = json.load(f)
                if cached_data.get('mtime') == file_path.stat().st_mtime:
                    return self._load_from_cache(cached_data)
        
        # Read file content
        try:
            content = file_path.read_text(encoding='utf-8')
        except Exception as e:
            ColorPrint.red(f"[Parser] Failed to read file: {e}")
            return None
        
        # Create document
        document = DocumentModel(
            content=content,
            locale=locale or TTSProcessor.detect_language(content),
            source_path=str(file_path),
            source_type='file'
        )
        
        # Extract sentences
        document.sentences = TTSProcessor.create_sentences_from_text(
            content,
            document.locale,
            document.md5
        )
        
        # Save to cache
        self._save_to_cache(document, cache_file, file_path.stat().st_mtime)
        
        return document
    
    def parse_url(self, url: str, locale: Optional[str] = None) -> Optional[DocumentModel]:
        """
        Parse web URL into document model
        
        Args:
            url: URL to parse
            locale: Language locale (optional, auto-detected)
        
        Returns:
            DocumentModel or None
        """
        if not requests:
            ColorPrint.red("[Parser] requests library not available")
            return None
        
        # Check cache
        cache_key = hashlib.md5(url.encode('utf-8')).hexdigest()
        cache_file = self._cache_dir / f"url_{cache_key}.json"
        
        if cache_file.exists():
            # Load from cache
            import json
            with open(cache_file, 'r', encoding='utf-8') as f:
                cached_data = json.load(f)
                return self._load_from_cache(cached_data)
        
        # Download content
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            content = response.text
        except Exception as e:
            ColorPrint.red(f"[Parser] Failed to download URL: {e}")
            return None
        
        # Create document
        document = DocumentModel(
            content=content,
            locale=locale or TTSProcessor.detect_language(content),
            source_path=url,
            source_type='url'
        )
        
        # Extract sentences
        document.sentences = TTSProcessor.create_sentences_from_text(
            content,
            document.locale,
            document.md5
        )
        
        # Save to cache
        self._save_to_cache(document, cache_file, time.time())
        
        return document
    
    def parse_text(self, text: str, locale: Optional[str] = None) -> DocumentModel:
        """
        Parse plain text into document model
        
        Args:
            text: Text content
            locale: Language locale (optional, auto-detected)
        
        Returns:
            DocumentModel
        """
        document = DocumentModel(
            content=text,
            locale=locale or TTSProcessor.detect_language(text),
            source_type='text'
        )
        
        # Extract sentences
        document.sentences = TTSProcessor.create_sentences_from_text(
            text,
            document.locale,
            document.md5
        )
        
        return document
    
    def _save_to_cache(self, document: DocumentModel, cache_file: Path, mtime: float):
        """Save document to cache"""
        import json
        cache_data = {
            'md5': document.md5,
            'content': document.content,
            'locale': document.locale,
            'source_path': document.source_path,
            'source_type': document.source_type,
            'sentences': [
                {
                    'content': s.content,
                    'md5': s.md5,
                    'locale': s.locale,
                    'sentence_index': s.sentence_index,
                }
                for s in document.sentences
            ],
            'mtime': mtime,
            'cached_at': time.time(),
        }
        
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump(cache_data, f, ensure_ascii=False, indent=2)
    
    def _load_from_cache(self, cached_data: Dict[str, Any]) -> DocumentModel:
        """Load document from cache"""
        from pycore.pyutils.common.tts_models import SentenceModel
        
        document = DocumentModel(
            content=cached_data['content'],
            locale=cached_data.get('locale', 'en-US'),
            source_path=cached_data.get('source_path'),
            source_type=cached_data.get('source_type', 'text')
        )
        
        # Restore sentences
        document.sentences = []
        for s_data in cached_data.get('sentences', []):
            sentence = SentenceModel(
                content=s_data['content'],
                locale=s_data.get('locale', document.locale),
                document_id=document.md5,
                sentence_index=s_data.get('sentence_index', 0)
            )
            document.sentences.append(sentence)
        
        return document

