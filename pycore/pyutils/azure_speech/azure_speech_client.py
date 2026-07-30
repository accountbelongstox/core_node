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

from pathlib import Path
from typing import Optional, List, Dict, Any

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party.api import get_third_package_speechsdk
from pycore.pyfoundations.serialized_worker import (
    SerializedSingletonProvider,
    init_serialized_owner,
    serialized_method,
)

speechsdk = get_third_package_speechsdk()
from pycore.pyutils.azure_speech.config import AzureSpeechConfig
from pycore.pyfoundations.speech_models import WordModel, SentenceModel, DocumentModel
from pycore.pyfoundations.speech_queue_ops import TTSQueueOps
from pycore.pyutils.common.azure_speech_quota_state import (
    mark_tts_quota_exceeded,
    clear_tts_quota_issue,
    is_tts_quota_blocked,
)


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
        self._active_tasks = 0
        init_serialized_owner(
            self,
            "azure_speech.client.state",
            "AzureSpeechClientState",
            timeout=300.0,
        )
    
    @serialized_method
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
    
    @serialized_method
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
        
        self._mark_task_start()
        
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
        try:
            if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
                with open(output_path, 'wb') as f:
                    f.write(result.audio_data)
                clear_tts_quota_issue()
                ColorPrint.green(f"[AzureSpeech] Synthesis completed: {output_path}")
                return True
            ColorPrint.red(f"[AzureSpeech] Synthesis failed: {result.reason}")
            if result.reason == speechsdk.ResultReason.Canceled:
                cancellation = speechsdk.SpeechSynthesisCancellationDetails(result)
                ColorPrint.red(f"[AzureSpeech] Cancellation reason: {cancellation.reason}")
                if cancellation.reason == speechsdk.CancellationReason.Error:
                    error_details = cancellation.error_details or ""
                    ColorPrint.red(f"[AzureSpeech] Error details: {error_details}")
                    self._check_quota_failure(error_details)
            return False
        finally:
            self._mark_task_end()
    
    @serialized_method
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

    @serialized_method
    def is_busy(self) -> bool:
        """Return True while synthesis tasks are running."""
        return self._active_tasks > 0

    @serialized_method
    def has_quota_issue(self) -> bool:
        """Expose whether Azure TTS is currently blocked due to quota."""
        blocked, _ = is_tts_quota_blocked()
        return blocked

    def _mark_task_start(self) -> None:
        self._active_tasks += 1

    def _mark_task_end(self) -> None:
        self._active_tasks = max(0, self._active_tasks - 1)

    def _check_quota_failure(self, error_details: str) -> None:
        """Detect quota-related failures from Azure SDK error details."""
        if not error_details:
            return
        lowered = error_details.lower()
        if "quota" in lowered or "exceed" in lowered or "usage limit" in lowered:
            mark_tts_quota_exceeded(error_details)


_AZURE_SPEECH_CLIENT_PROVIDER = SerializedSingletonProvider(
    AzureSpeechClient,
    "azure_speech.client.provider",
    "AzureSpeechClientProvider",
)
azure_speech_client = _AZURE_SPEECH_CLIENT_PROVIDER.get()
