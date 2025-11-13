#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Azure Speech Client

Provides Azure Cognitive Services Speech SDK integration.
Shares queue and data models with edge_tts via common modules.
"""

import threading
from pathlib import Path
from typing import Optional, List, Dict, Any

from pycore import ColorPrint
from pycore.pyfoundations.third_party import speechsdk
from pycore.pyutils.azure_speech.config import AzureSpeechConfig
from pycore.pyutils.common.tts_models import WordModel, SentenceModel, DocumentModel
from pycore.pyutils.common.tts_queue_ops import TTSQueueOps


class AzureSpeechClient:
    """
    Azure Speech client for text-to-speech conversion
    
    Features:
    - Azure Speech SDK integration
    - Shares queue and data models with edge_tts
    - Voice synthesis
    """
    
    def __init__(self):
        """Initialize Azure Speech client"""
        self._initialized = False
        self._speech_config: Optional[speechsdk.SpeechConfig] = None
    
    def initialize(self) -> bool:
        """
        Initialize Azure Speech client
        
        Returns:
            bool: True if initialized successfully
        """
        if self._initialized:
            return True
        
        if not speechsdk:
            ColorPrint.red("[AzureSpeech] Azure Speech SDK not available")
            return False
        
        key = AzureSpeechConfig.get_key()
        if not key:
            ColorPrint.yellow("[AzureSpeech] Azure Speech key not configured")
            return False
        
        self._speech_config = speechsdk.SpeechConfig(
            subscription=key,
            region=AzureSpeechConfig.AZURE_SPEECH_REGION
        )
        
        self._initialized = True
        ColorPrint.blue(f"[AzureSpeech] Initialized with region: {AzureSpeechConfig.AZURE_SPEECH_REGION}")
        return True
    
    def synthesize(self, text: str, output_path: Path, 
                   voice: Optional[str] = None) -> bool:
        """
        Synthesize text to speech
        
        Args:
            text: Text to synthesize
            voice: Voice name (optional, uses default if not provided)
            output_path: Output audio file path
        
        Returns:
            bool: True if successful
        """
        if not self.initialize():
            return False
        
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        if voice:
            self._speech_config.speech_synthesis_voice_name = voice
        
        synthesizer = speechsdk.SpeechSynthesizer(speech_config=self._speech_config)
        result = synthesizer.speak_text_async(text).get()
        
        if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
            with open(output_path, 'wb') as f:
                f.write(result.audio_data)
            return True
        else:
            ColorPrint.red(f"[AzureSpeech] Synthesis failed: {result.reason}")
            return False
    
    def add_to_queue(self, item: WordModel | SentenceModel | DocumentModel) -> bool:
        """
        Add item to shared queue
        
        Args:
            item: Word, Sentence, or Document model
        
        Returns:
            bool: True if added successfully
        """
        if isinstance(item, DocumentModel):
            return TTSQueueOps.add_document(item)
        elif isinstance(item, SentenceModel):
            return TTSQueueOps.add_sentence(item)
        elif isinstance(item, WordModel):
            return TTSQueueOps.add_word(item)
        return False


# Global Azure Speech client instance
_global_azure_speech_client: Optional[AzureSpeechClient] = None
_client_lock = threading.Lock()


def get_azure_speech_client() -> AzureSpeechClient:
    """Get global Azure Speech client instance"""
    global _global_azure_speech_client
    with _client_lock:
        if _global_azure_speech_client is None:
            _global_azure_speech_client = AzureSpeechClient()
        return _global_azure_speech_client

