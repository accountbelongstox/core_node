#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Edge TTS Worker Thread

Extends BaseTTSWorkerThread to implement Edge TTS specific processing.
"""

import threading

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus import THREAD_BUS
from pycore.pyutils.edge_tts.worker_thread_base import (
    initialize_tts_worker,
    run_tts_worker,
)
from pycore.pyutils.edge_tts.config import TTSConfig
from pycore.pyutils.edge_tts.edge_tts_client import get_edge_tts_client
from pycore.pyutils.common.tts_models import ItemType, DocumentModel, SentenceModel, WordModel


class EdgeTTSWorkerThread(threading.Thread):
    """
    Edge TTS worker thread
    
    Extends BaseTTSWorkerThread to implement Edge TTS specific processing.
    """
    
    def __init__(self, thread_id: int, item_type: ItemType, interval: float = 1.0):
        """Initialize Edge TTS worker thread"""
        super().__init__(name=f"TTSWorker-{item_type.value}-{thread_id}", daemon=True)
        initialize_tts_worker(self, thread_id, item_type, interval)

    def run(self):
        run_tts_worker(self)

    def stop(self):
        THREAD_BUS.signal(self._stop_signal, True)
    
    def _process_document(self, document: DocumentModel):
        """Process document with Edge TTS"""
        # Document processing: translate and process sentences
        for sentence in document.sentences:
            self._process_sentence(sentence)
    
    def _process_sentence(self, sentence: SentenceModel):
        """Process sentence with Edge TTS"""
        edge_tts = get_edge_tts_client()
        voice_dir = TTSConfig.get_voice_dir(sentence.locale, 'sentence')
        voice_dir.mkdir(parents=True, exist_ok=True)
        
        output_path = voice_dir / f"{sentence.md5}.mp3"
        
        if output_path.exists():
            ColorPrint.blue(f"[EdgeTTS] Voice file exists: {output_path}")
            sentence.voice_files['default'] = str(output_path)
            return
        
        # Get voice
        voice = TTSConfig.get_voice(sentence.locale, 'female')
        if not voice:
            voice = edge_tts.find_voice_by_locale(sentence.locale, 'female')
        
        if voice:
            success = edge_tts.synthesize(
                sentence.content,
                voice,
                output_path
            )
            if success:
                sentence.voice_files['default'] = str(output_path)
    
    def _process_word(self, word: WordModel):
        """Process word with Edge TTS"""
        edge_tts = get_edge_tts_client()
        voice_dir = TTSConfig.get_voice_dir(word.locale, 'word')
        voice_dir.mkdir(parents=True, exist_ok=True)
        
        output_path = voice_dir / f"{word.md5}.mp3"
        
        if output_path.exists():
            word.voice_files['default'] = str(output_path)
            return
        
        voice = TTSConfig.get_voice(word.locale, 'female')
        if not voice:
            voice = edge_tts.find_voice_by_locale(word.locale, 'female')
        
        if voice:
            success = edge_tts.synthesize(
                word.content,
                voice,
                output_path
            )
            if success:
                word.voice_files['default'] = str(output_path)
