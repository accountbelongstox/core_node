#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TTS Text Processor

Provides language detection, sentence splitting, and word extraction.
"""

import re
import string
from typing import List, Dict, Optional, Tuple

from pycore import ColorPrint
from pycore.pyutils.common.tts_models import SentenceModel, WordModel, clean_tts_text


class TTSProcessor:
    """
    Text processing utilities for TTS
    
    Features:
    - Language detection
    - Sentence splitting
    - Word extraction
    - Text normalization
    """
    
    # Common sentence endings
    SENTENCE_ENDINGS = ['.', '!', '?', '。', '！', '？', '…']
    
    # Word separators
    WORD_SEPARATORS = string.whitespace + string.punctuation
    
    @staticmethod
    def detect_language(text: str) -> str:
        """
        Detect language from text
        
        Args:
            text: Input text
        
        Returns:
            str: Language locale (e.g., 'en-US', 'zh-CN')
        """
        # Simple heuristic-based detection
        # Check for Chinese characters
        if re.search(r'[\u4e00-\u9fff]', text):
            return 'zh-CN'
        
        # Check for Japanese characters
        if re.search(r'[\u3040-\u309f\u30a0-\u30ff]', text):
            return 'ja-JP'
        
        # Check for Korean characters
        if re.search(r'[\uac00-\ud7a3]', text):
            return 'ko-KR'
        
        # Check for Arabic characters
        if re.search(r'[\u0600-\u06ff]', text):
            return 'ar-SA'
        
        # Check for Cyrillic characters
        if re.search(r'[\u0400-\u04ff]', text):
            return 'ru-RU'
        
        # Default to English
        return 'en-US'
    
    @staticmethod
    def split_sentences(text: str, locale: Optional[str] = None) -> List[str]:
        """
        Split text into sentences
        
        Args:
            text: Input text
            locale: Language locale (optional, auto-detected if not provided)
        
        Returns:
            List[str]: List of sentences
        """
        if not locale:
            locale = TTSProcessor.detect_language(text)
        
        # Normalize text
        text = text.strip()
        if not text:
            return []
        
        sentences = []
        
        # For Chinese/Japanese/Korean, use different splitting
        if locale.startswith('zh') or locale.startswith('ja') or locale.startswith('ko'):
            # Split by Chinese sentence endings
            pattern = r'([。！？…]+)'
            parts = re.split(pattern, text)
            current_sentence = ''
            for part in parts:
                current_sentence += part
                if part in TTSProcessor.SENTENCE_ENDINGS:
                    sentence = current_sentence.strip()
                    if sentence:
                        sentences.append(sentence)
                    current_sentence = ''
            if current_sentence.strip():
                sentences.append(current_sentence.strip())
        else:
            # For English and other languages, use standard splitting
            # Split by sentence endings, but keep the endings
            pattern = r'([.!?]+)\s+'
            parts = re.split(pattern, text)
            current_sentence = ''
            for i, part in enumerate(parts):
                current_sentence += part
                if i < len(parts) - 1 and parts[i + 1] in TTSProcessor.SENTENCE_ENDINGS:
                    current_sentence += parts[i + 1]
                    sentence = current_sentence.strip()
                    if sentence:
                        sentences.append(sentence)
                    current_sentence = ''
                    i += 1
            if current_sentence.strip():
                sentences.append(current_sentence.strip())
        
        # Filter out empty sentences
        sentences = [s.strip() for s in sentences if s.strip()]
        return sentences
    
    @staticmethod
    def extract_words(text: str, locale: Optional[str] = None) -> List[str]:
        """
        Extract words from text
        
        Args:
            text: Input text
            locale: Language locale (optional)
        
        Returns:
            List[str]: List of words
        """
        if not locale:
            locale = TTSProcessor.detect_language(text)
        
        # For Chinese/Japanese/Korean, characters are words
        if locale.startswith('zh') or locale.startswith('ja') or locale.startswith('ko'):
            # Extract all non-whitespace, non-punctuation characters
            words = re.findall(r'[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7a3]+', text)
            return words
        
        # For English and other languages, split by word separators
        words = re.findall(r'\b\w+\b', text)
        return words
    
    @staticmethod
    def normalize_text(text: str) -> str:
        """
        Normalize text for processing

        Args:
            text: Input text

        Returns:
            str: Normalized text
        """
        # Clean text (remove asterisks, normalize whitespace)
        return clean_tts_text(text)
    
    @staticmethod
    def create_sentences_from_text(text: str, locale: Optional[str] = None,
                                   document_id: Optional[str] = None) -> List[SentenceModel]:
        """
        Create sentence models from text

        Args:
            text: Input text
            locale: Language locale (optional)
            document_id: Document ID (optional)

        Returns:
            List[SentenceModel]: List of sentence models
        """
        # Clean text before processing (remove asterisks, etc.)
        cleaned_text = clean_tts_text(text)

        if not locale:
            locale = TTSProcessor.detect_language(cleaned_text)

        sentences_text = TTSProcessor.split_sentences(cleaned_text, locale)
        sentences = []

        for index, sentence_text in enumerate(sentences_text):
            sentence = SentenceModel(
                content=sentence_text,
                locale=locale,
                document_id=document_id,
                sentence_index=index
            )
            sentences.append(sentence)

        return sentences
    
    @staticmethod
    def create_words_from_text(text: str, locale: Optional[str] = None) -> List[WordModel]:
        """
        Create word models from text

        Args:
            text: Input text
            locale: Language locale (optional)

        Returns:
            List[WordModel]: List of word models
        """
        # Clean text before processing (remove asterisks, etc.)
        cleaned_text = clean_tts_text(text)

        if not locale:
            locale = TTSProcessor.detect_language(cleaned_text)

        words_text = TTSProcessor.extract_words(cleaned_text, locale)
        words = []

        for word_text in words_text:
            word = WordModel(
                content=word_text,
                locale=locale
            )
            words.append(word)

        return words

