#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Azure Speech Client

Provides Azure Cognitive Services Speech SDK integration.
Shares queue and data models with edge_tts via common modules.

Microsoft Speech SDK Reference:
Package: azure.cognitiveservices.speech

Key Classes Used:
- SpeechConfig: Configuration for speech recognition and synthesis
  - Initialization: from subscription key and region, or from endpoint
  - Properties: speech_synthesis_voice_name, output_format, etc.
  
- SpeechSynthesizer: Text-to-speech synthesizer
  - Methods: speak_text_async(), speak_ssml_async()
  - Events: synthesis_started, synthesis_completed, word_boundary, etc.
  
- SpeechSynthesisResult: Result of synthesis operation
  - Properties: audio_data, audio_length, reason
  - Methods: get_audio_data()
  
- ResultReason: Enum for result reasons
  - Values: SynthesizingAudioCompleted, Canceled, etc.
  
- SpeechSynthesisOutputFormat: Audio output formats
  - Values: Audio16Khz128KBitRateMonoMp3, Audio24Khz48KBitRateMonoMp3, etc.

Available SDK Modules:
- speech: Core speech recognition and synthesis classes
- audio: Audio input/output handling
- translation: Speech translation
- transcription: Conversation transcription
- intent: Intent recognition
- dialog: Dialog service connector
- properties: Property management
- enums: All enumeration types

For full API reference, see:
https://learn.microsoft.com/python/api/azure-cognitiveservices-speech/
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
    
    Wraps Microsoft Speech SDK (azure.cognitiveservices.speech) for TTS operations.
    
    Features:
    - Azure Speech SDK integration (SpeechConfig, SpeechSynthesizer)
    - Shares queue and data models with edge_tts
    - Voice synthesis with configurable voices
    - Audio output in various formats
    
    SDK Classes Used:
    - speechsdk.SpeechConfig: Speech service configuration
    - speechsdk.SpeechSynthesizer: Text-to-speech synthesizer
    - speechsdk.SpeechSynthesisResult: Synthesis operation result
    - speechsdk.ResultReason: Result reason enumeration
    """
    
    def __init__(self):
        """
        Initialize Azure Speech client
        
        Creates uninitialized client. Call initialize() before use.
        """
        self._initialized = False
        self._speech_config: Optional[speechsdk.SpeechConfig] = None
    
    def initialize(self) -> bool:
        """
        Initialize Azure Speech client with SpeechConfig
        
        Creates SpeechConfig from subscription key and region.
        SpeechConfig can be initialized in multiple ways:
        - from subscription: subscription key + region (used here)
        - from endpoint: endpoint URL + optional key
        - from host: host address + optional key
        - from authorization token: token + region
        
        Returns:
            bool: True if initialized successfully, False otherwise
        """
        if self._initialized:
            return True
        
        if not speechsdk:
            ColorPrint.red("[AzureSpeech] Azure Speech SDK not available")
            ColorPrint.yellow("[AzureSpeech] Install with: pip install azure-cognitiveservices-speech")
            return False
        
        key = AzureSpeechConfig.get_key()
        if not key:
            ColorPrint.yellow("[AzureSpeech] Azure Speech key not configured")
            ColorPrint.blue("[AzureSpeech] Set AZURE_SPEECH_KEY1 or AZURE_SPEECH_KEY2 environment variable")
            return False
        
        # Create SpeechConfig from subscription key and region
        # Reference: speechsdk.SpeechConfig class
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
        Synthesize text to speech using SpeechSynthesizer
        
        Uses SpeechSynthesizer.speak_text_async() for asynchronous synthesis.
        Result is checked using ResultReason enum.
        
        Args:
            text: Text to synthesize
            voice: Voice name (optional, uses default if not provided)
                   Format: "locale-voice-gender" (e.g., "en-US-JennyNeural")
            output_path: Output audio file path
        
        Returns:
            bool: True if synthesis completed successfully, False otherwise
        
        SDK Reference:
        - SpeechSynthesizer: Main synthesizer class
        - SpeechSynthesisResult: Contains audio_data and reason
        - ResultReason.SynthesizingAudioCompleted: Success reason
        - ResultReason.Canceled: Cancellation reason (with CancellationDetails)
        """
        if not self.initialize():
            return False
        
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Set voice name if provided
        # Property: SpeechConfig.speech_synthesis_voice_name
        if voice:
            self._speech_config.speech_synthesis_voice_name = voice
        
        # Create SpeechSynthesizer with SpeechConfig
        # Reference: speechsdk.SpeechSynthesizer class
        synthesizer = speechsdk.SpeechSynthesizer(speech_config=self._speech_config)
        
        # Perform asynchronous synthesis
        # Method: SpeechSynthesizer.speak_text_async(text) -> ResultFuture
        # Alternative: speak_ssml_async(ssml) for SSML input
        result = synthesizer.speak_text_async(text).get()
        
        # Check result reason using ResultReason enum
        # Reference: speechsdk.ResultReason enumeration
        if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
            # Write audio data to file
            # Property: SpeechSynthesisResult.audio_data (bytes)
            with open(output_path, 'wb') as f:
                f.write(result.audio_data)
            ColorPrint.green(f"[AzureSpeech] Synthesis completed: {output_path}")
            return True
        else:
            # Handle other result reasons (Canceled, etc.)
            # Reference: speechsdk.CancellationDetails for cancellation info
            ColorPrint.red(f"[AzureSpeech] Synthesis failed: {result.reason}")
            if result.reason == speechsdk.ResultReason.Canceled:
                cancellation = speechsdk.SpeechSynthesisCancellationDetails(result)
                ColorPrint.red(f"[AzureSpeech] Cancellation reason: {cancellation.reason}")
                if cancellation.reason == speechsdk.CancellationReason.Error:
                    ColorPrint.red(f"[AzureSpeech] Error details: {cancellation.error_details}")
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

