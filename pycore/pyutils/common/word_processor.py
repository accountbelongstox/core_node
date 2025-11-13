#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Word Processor (Common)

Powerful word processing utilities for text analysis.
Based on wdoc.py, voice.py, and bdict.py patterns.
"""

import re
import threading
from typing import List, Dict, Set, Optional, Tuple
from collections import Counter


class WordProcessor:
    """
    Word processing utilities
    
    Features:
    - Word extraction and normalization
    - English vocabulary validation
    - Word frequency counting
    - Compound word detection
    - Chinese/English detection
    - Sentence analysis
    """
    
    # Common English single letters
    VALID_SINGLE_LETTERS = {'a', 'i', 'o', 'x', 'y'}
    
    def __init__(self):
        """Initialize word processor"""
        self._nltk_words: Optional[Set[str]] = None
    
    def modify_word(self, word: str) -> str:
        """
        Normalize and modify word
        
        Args:
            word: Input word
        
        Returns:
            str: Modified word
        """
        # Capitalize first letter if needed
        pattern = re.compile(r"^[A-Z][a-z]+")
        if re.match(pattern, word):
            word = word.lower()
        
        # Strip quotes and whitespace
        word = word.strip("'").strip()
        return word
    
    def is_chinese(self, word: str) -> bool:
        """
        Check if word contains Chinese characters
        
        Args:
            word: Input word
        
        Returns:
            bool: True if contains Chinese characters
        """
        pattern = re.compile(r"[\u4e00-\u9fff]|[\ufe30-\uffa0]|[\u4e00-\uffa5]")
        return bool(pattern.search(word))
    
    def is_english(self, word: str) -> bool:
        """
        Check if word is English
        
        Args:
            word: Input word
        
        Returns:
            bool: True if English word
        """
        return self.english_vocabulary(word)
    
    def english_vocabulary(self, word: str) -> bool:
        """
        Validate English vocabulary
        
        Args:
            word: Input word
        
        Returns:
            bool: True if valid English word
        """
        if not isinstance(word, str):
            return False
        
        word = word.strip()
        pattern = r'^[a-zA-Z\'\-]+$'
        
        if not re.match(pattern, word):
            return False
        
        # Check first and last characters
        if not word:
            return False
        
        first = word[0]
        tail = word[-1]
        
        if not re.match(r'[a-zA-Z]', first):
            return False
        if not re.match(r'[a-zA-Z\']', tail):
            return False
        
        word_lower = word.lower()
        word_len = len(word)
        
        # Single letter validation
        if word_len == 1:
            return word_lower in self.VALID_SINGLE_LETTERS
        
        # Check for repeated letters (e.g., "aaa")
        pattern_repeat = re.compile(r'^([a-zA-Z])\1*$')
        if re.match(pattern_repeat, word):
            return False
        
        return True
    
    def extract_words(self, text: str, splits_symbol: Optional[re.Pattern] = None) -> Tuple[List[str], List[str], Dict[str, int]]:
        """
        Extract words from text
        
        Args:
            text: Input text
            splits_symbol: Custom split pattern (optional)
        
        Returns:
            Tuple of (words, exclude_words, word_frequency)
        """
        exclude_words = []
        normal_words = []
        
        if splits_symbol is None:
            splits_symbol = re.compile(
                r'(?<=[a-z])(?=[A-Z])|[^a-zA-Z\'\-]+|(?<=[^a-zA-Z])\'(?!\s)|(?<!\s)\'(?=[^a-zA-Z])|(?<=[^a-zA-Z])-(?![a-zA-Z])|(?<![a-zA-Z])-(?=[^a-zA-Z])|(?<=[A-Z]{2})(?=[a-z])'
            )
        
        origin_words = re.split(splits_symbol, text)
        
        for word in origin_words:
            if not word.strip():
                continue
            
            if self.english_vocabulary(word):
                normal_words.append(self.modify_word(word))
            else:
                if word not in exclude_words:
                    exclude_words.append(word)
        
        word_frequency = self.count_word_frequency(normal_words)
        words = list(set(normal_words))  # Deduplication
        
        return words, exclude_words, word_frequency
    
    def count_word_frequency(self, word_list: List[str]) -> Dict[str, int]:
        """
        Count word frequency
        
        Args:
            word_list: List of words
        
        Returns:
            Dict[str, int]: Word frequency dictionary
        """
        return dict(Counter(word_list))
    
    def is_compound_word(self, word: str) -> bool:
        """
        Check if word is compound word
        
        Args:
            word: Input word
        
        Returns:
            bool: True if compound word
        """
        # Check for hyphen
        if '-' in word:
            return True
        
        # Check if all uppercase (acronym)
        if word.isupper():
            return True
        
        return False
    
    def sentence_filter(self, sentence: str) -> bool:
        """
        Filter valid sentences
        
        Args:
            sentence: Input sentence
        
        Returns:
            bool: True if valid sentence
        """
        # Too long
        if len(sentence) > 1000:
            return False
        
        # Contains Chinese
        if self.is_chinese(sentence):
            return False
        
        # Trim left non-alphabetic
        sentence = self.trim_word_left(sentence)
        
        # Remove patterns like "F = form"
        form = re.compile(r'^[a-zA-Z]*\s+[^0-9a-zA-Z]+\s*')
        while form.search(sentence):
            sentence = re.sub(form, '', sentence)
        
        # Remove patterns like "= Ed."
        form = re.compile(r'\s*[^0-9a-zA-Z]+\s+[a-zA-Z]+[^0-9a-zA-Z]*')
        while form.search(sentence):
            sentence = re.sub(form, '', sentence)
        
        # Remove patterns like "f heb."
        form = re.compile(r'^\s*[^aAiI]{1}\s+[a-zA-Z]+[^0-9a-zA-Z]*$')
        sentence = re.sub(form, '', sentence)
        
        sentence = self.trim_word_left(sentence)
        
        # Check alphabet count
        alphabet = re.compile(r'[a-zA-Z]')
        numbers = re.compile(r"\d")
        all_numbers = re.compile(r'^\d+$')
        
        alph_len = len(alphabet.findall(sentence))
        
        # Check for repeated patterns (e.g., "axx axx axx")
        first_alphabets = list(set(re.compile(r'^[a-zA-Z]{1}|(?<=\s)[a-zA-Z]{1}').findall(sentence)))
        for first_alphabet in first_alphabets:
            form = re.compile(
                r'(^|\s)' + first_alphabet + r'[a-z]*\s+' + first_alphabet + r'[a-z]*\s+' + first_alphabet + r'[a-z]*',
                re.IGNORECASE
            )
            if form.search(sentence):
                return False
        
        # Too few letters
        if alph_len <= 1:
            return False
        
        # No spaces
        if not re.search(r'\s', sentence):
            return False
        
        # Too many numbers
        num_len = len(numbers.findall(sentence))
        if num_len > 0:
            rate = (num_len / alph_len) * 100
            if rate > 20:
                return False
        
        # Pattern like "00. 0. s"
        form = re.compile(r'[\d]\.\s')
        if form.search(sentence):
            return False
        
        # Check word count
        words = re.compile(r'[^a-zA-Z0-9]+').split(sentence)
        words = list(set(words))
        if len(words) < 4:
            for word in words:
                if all_numbers.search(word):
                    return False
        
        return True
    
    def trim_word_left(self, text: str) -> str:
        """
        Trim non-alphabetic characters from left
        
        Args:
            text: Input text
        
        Returns:
            str: Trimmed text
        """
        form = re.compile(r'^[^a-zA-Z]+')
        text = re.sub(form, '', text)
        return text.strip()
    
    def sentence_modify(self, sentence: str) -> str:
        """
        Modify and clean sentence
        
        Args:
            sentence: Input sentence
        
        Returns:
            str: Modified sentence
        """
        # Remove "00 And" pattern
        form = re.compile(r'^\d+\s+(?=[A-Z])')
        sentence = re.sub(form, '', sentence)
        
        # Remove unclosed brackets
        sentence = re.sub(r'^[^]]*\]', '', sentence)
        sentence = re.sub(r'\[[^[]*$', '', sentence)
        sentence = re.sub(r'\[[^\]]*\]', '', sentence)
        
        # Trim left
        sentence = self.trim_word_left(sentence)
        
        return sentence
    
    def analyze_doc_to_sentence(self, doc: str) -> Tuple[List[str], List[str]]:
        """
        Analyze document and split into sentences
        
        Args:
            doc: Input document
        
        Returns:
            Tuple of (sentences, exclude_sentences)
        """
        exclude_sentence = []
        
        # Normalize line breaks
        doc = re.sub(r'\r+', '', doc)
        doc = re.sub(r'\n+', ' ', doc)
        doc = re.sub(r'\s+', ' ', doc)
        
        # Split by punctuation
        doc = re.sub(r'[\,\，]+', ',\n', doc)
        doc = re.sub(r'[\;\；]+', ';\n', doc)
        doc = re.sub(r'[\?\？]+', '?\n', doc)
        doc = re.sub(r'(?<=[^\d])\.(?=[^\d])', '.\n', doc)
        doc = re.sub(r'[\。]+', '.\n', doc)
        
        sentences = re.split(r'\n+', doc)
        
        new_sentence = []
        for simple in sentences:
            is_add_sentence = False
            if self.sentence_filter(simple):
                simple = self.sentence_modify(simple)
                if simple:
                    is_add_sentence = True
                    new_sentence.append(simple)
            
            if not is_add_sentence:
                exclude_sentence.append(simple)
        
        return new_sentence, exclude_sentence


# Global word processor instance
_global_word_processor: Optional[WordProcessor] = None
_processor_lock = threading.Lock()


def get_word_processor() -> WordProcessor:
    """Get global word processor instance"""
    global _global_word_processor
    with _processor_lock:
        if _global_word_processor is None:
            _global_word_processor = WordProcessor()
        return _global_word_processor

