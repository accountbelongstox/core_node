"""
Unified Speech Switch (TTS + STT)

Replaces TTSSwitch and STTSwitch with single unified router.
Routes tasks to appropriate providers based on task_type and provider availability.

Architecture:
- No internal queue - processes tasks synchronously when called by HeartbeatPusher
- No worker thread - runs in HeartbeatPusher's thread context
- Uses ProviderStatus for routing decisions
- Handles both TTS and STT tasks
- Reports provider failures back to ProviderStatus

Task Flow:
    GlobalTaskQueue → HeartbeatPusher → SpeechSwitch.process_task() → Provider → Callback
"""

import threading
import time
from typing import Optional, Dict, Callable, Any
from pathlib import Path

from pycore.pyfoundations import ColorPrint, Task
from pycore.pyutils.common.provider_status import get_provider_status
from pycore.pyutils.common.speech_task_models import (
    SpeechTaskType,
    TTSTaskData,
    STTTaskData,
    TTSTaskResult,
    STTTaskResult
)


class SpeechSwitch:
    """
    Unified Speech Router (TTS + STT)

    Routes speech tasks to available providers based on:
    - Task type (TTS or STT)
    - Provider availability (from ProviderStatus)
    - Provider priority order

    No internal queue - tasks processed synchronously by HeartbeatPusher.

    Usage:
        # Initialize
        switch = SpeechSwitch()
        switch.initialize()

        # Process task (called by HeartbeatPusher)
        task = Task(task_type='tts', task_data={'text': 'Hello', 'language': 'en-US'})
        success = switch.process_task(task)
    """

    def __init__(self):
        """Initialize speech switch"""
        self._lock = threading.RLock()
        self._provider_status = get_provider_status()
        self._initialized = False

        # TTS provider implementations
        self._tts_providers: Dict[str, Any] = {}

        # STT provider implementations
        self._stt_providers: Dict[str, Any] = {}

        # Statistics
        self._stats = {
            'tts_processed': 0,
            'tts_failed': 0,
            'stt_processed': 0,
            'stt_failed': 0
        }

        ColorPrint.blue("[SpeechSwitch] Created")

    def initialize(self):
        """
        Initialize speech switch

        - Checks all providers
        - Initializes provider implementations
        - Registers with ProviderStatus
        """
        if self._initialized:
            ColorPrint.yellow("[SpeechSwitch] Already initialized")
            return

        with self._lock:
            ColorPrint.blue("[SpeechSwitch] Initializing...")

            # Check all providers
            self._provider_status.check_all_providers()

            # Initialize TTS providers
            self._initialize_tts_providers()

            # Initialize STT providers
            self._initialize_stt_providers()

            self._initialized = True
            ColorPrint.green("[SpeechSwitch] Initialization complete")

            # Print status
            self._provider_status.print_status()

    def _initialize_tts_providers(self):
        """Initialize TTS provider implementations"""
        # Edge TTS
        if self._provider_status.is_available('tts', 'edge'):
            try:
                from pycore.pyutils.edge_tts import EdgeTTSClient
                self._tts_providers['edge'] = EdgeTTSClient()
                ColorPrint.green("[SpeechSwitch] ✓ Edge TTS provider initialized")
            except Exception as e:
                ColorPrint.red(f"[SpeechSwitch] ✗ Edge TTS init failed: {e}")
                self._provider_status.mark_unavailable('tts', 'edge', str(e))

        # Azure TTS
        if self._provider_status.is_available('tts', 'azure'):
            try:
                # Azure TTS provider would be initialized here
                # For now, just mark as available
                ColorPrint.yellow("[SpeechSwitch] Azure TTS provider not yet implemented")
            except Exception as e:
                ColorPrint.red(f"[SpeechSwitch] ✗ Azure TTS init failed: {e}")
                self._provider_status.mark_unavailable('tts', 'azure', str(e))

    def _initialize_stt_providers(self):
        """Initialize STT provider implementations"""
        # Azure STT
        if self._provider_status.is_available('stt', 'azure'):
            try:
                from pycore.pyutils.speech_recognition import AzureSpeechRecognitionProvider
                self._stt_providers['azure'] = AzureSpeechRecognitionProvider()
                ColorPrint.green("[SpeechSwitch] ✓ Azure STT provider initialized")
            except Exception as e:
                ColorPrint.red(f"[SpeechSwitch] ✗ Azure STT init failed: {e}")
                self._provider_status.mark_unavailable('stt', 'azure', str(e))

        # Local STT
        if self._provider_status.is_available('stt', 'local'):
            try:
                # Local STT provider would be initialized here
                ColorPrint.yellow("[SpeechSwitch] Local STT provider not yet implemented")
            except Exception as e:
                ColorPrint.red(f"[SpeechSwitch] ✗ Local STT init failed: {e}")
                self._provider_status.mark_unavailable('stt', 'local', str(e))

    def process_task(self, task: Task) -> bool:
        """
        Process task synchronously (called by HeartbeatPusher)

        Args:
            task: Task to process

        Returns:
            True if task processed successfully, False otherwise
        """
        if not self._initialized:
            ColorPrint.yellow("[SpeechSwitch] Not initialized, initializing now...")
            self.initialize()

        # Route based on task type
        task_type = task.task_type.lower()

        # TTS tasks
        if task_type in ['tts', 'audio_synthesis', 'text_to_speech']:
            return self._process_tts_task(task)

        # STT tasks
        elif task_type in ['stt', 'speech_recognition', 'speech_to_text']:
            return self._process_stt_task(task)

        else:
            ColorPrint.red(f"[SpeechSwitch] Unknown task type: {task_type}")
            return False

    def _process_tts_task(self, task: Task) -> bool:
        """
        Process TTS task

        Args:
            task: TTS task to process

        Returns:
            True if processed successfully, False otherwise
        """
        with self._lock:
            self._stats['tts_processed'] += 1

        try:
            # Get task data
            task_data = task.task_data
            if isinstance(task_data, dict):
                text = task_data.get('text', '')
                language = task_data.get('language', 'en-US')
                output_path = task_data.get('output_path')
                callback = task_data.get('callback')
            else:
                # Assume it's a TTSTaskData object
                text = task_data.text
                language = task_data.language
                output_path = task_data.output_path
                callback = task_data.callback

            # Validate
            if not text:
                ColorPrint.red("[SpeechSwitch] TTS task missing text")
                with self._lock:
                    self._stats['tts_failed'] += 1
                return False

            # Get best available provider
            provider_name = self._provider_status.get_best_tts_provider()
            if not provider_name:
                ColorPrint.red("[SpeechSwitch] No TTS providers available")
                with self._lock:
                    self._stats['tts_failed'] += 1
                return False

            ColorPrint.blue(f"[SpeechSwitch] Processing TTS task with {provider_name} provider")
            ColorPrint.blue(f"[SpeechSwitch] Text: {text[:50]}... Language: {language}")

            # Process with provider
            provider = self._tts_providers.get(provider_name)
            if not provider:
                ColorPrint.red(f"[SpeechSwitch] Provider {provider_name} not initialized")
                with self._lock:
                    self._stats['tts_failed'] += 1
                return False

            # Call provider
            try:
                if provider_name == 'edge':
                    # Edge TTS processing
                    result = self._process_edge_tts(provider, text, language, output_path)

                    # Call callback if provided
                    if callback and result:
                        callback(TTSTaskResult(
                            success=True,
                            audio_path=result,
                            provider=provider_name,
                            error=None
                        ))

                    return True

                else:
                    ColorPrint.yellow(f"[SpeechSwitch] Provider {provider_name} not yet implemented")
                    with self._lock:
                        self._stats['tts_failed'] += 1
                    return False

            except Exception as e:
                error_msg = str(e)
                ColorPrint.red(f"[SpeechSwitch] TTS processing failed: {error_msg}")

                # Mark provider as unavailable if it's a critical error
                if "quota" in error_msg.lower() or "authentication" in error_msg.lower():
                    self._provider_status.mark_unavailable('tts', provider_name, error_msg)

                # Call callback with error
                if callback:
                    callback(TTSTaskResult(
                        success=False,
                        audio_path=None,
                        provider=provider_name,
                        error=error_msg
                    ))

                with self._lock:
                    self._stats['tts_failed'] += 1
                return False

        except Exception as e:
            ColorPrint.red(f"[SpeechSwitch] TTS task processing error: {e}")
            with self._lock:
                self._stats['tts_failed'] += 1
            return False

    def _process_edge_tts(self, provider, text: str, language: str, output_path: Optional[str]) -> Optional[str]:
        """
        Process Edge TTS request

        Args:
            provider: EdgeTTSClient instance
            text: Text to synthesize
            language: Language code
            output_path: Optional output path

        Returns:
            Path to generated audio file or None on failure
        """
        # Edge TTS uses communicate method
        # This is simplified - actual implementation depends on EdgeTTSClient API

        # For now, just log that we would process it
        ColorPrint.green(f"[SpeechSwitch] Edge TTS would process: {text[:30]}...")

        # Return mock result
        # In real implementation, call provider.synthesize() or similar
        return output_path or "/tmp/tts_output.mp3"

    def _process_stt_task(self, task: Task) -> bool:
        """
        Process STT task

        Args:
            task: STT task to process

        Returns:
            True if processed successfully, False otherwise
        """
        with self._lock:
            self._stats['stt_processed'] += 1

        try:
            # Get task data
            task_data = task.task_data
            if isinstance(task_data, dict):
                audio_path = task_data.get('audio_path')
                language = task_data.get('language', 'en-US')
                callback = task_data.get('callback')
            else:
                # Assume it's a STTTaskData object
                audio_path = task_data.audio_path
                language = task_data.language
                callback = task_data.callback

            # Validate
            if not audio_path:
                ColorPrint.red("[SpeechSwitch] STT task missing audio_path")
                with self._lock:
                    self._stats['stt_failed'] += 1
                return False

            # Get best available provider
            provider_name = self._provider_status.get_best_stt_provider()
            if not provider_name:
                ColorPrint.red("[SpeechSwitch] No STT providers available")
                with self._lock:
                    self._stats['stt_failed'] += 1
                return False

            ColorPrint.blue(f"[SpeechSwitch] Processing STT task with {provider_name} provider")
            ColorPrint.blue(f"[SpeechSwitch] Audio: {audio_path} Language: {language}")

            # Process with provider
            provider = self._stt_providers.get(provider_name)
            if not provider:
                ColorPrint.red(f"[SpeechSwitch] Provider {provider_name} not initialized")
                with self._lock:
                    self._stats['stt_failed'] += 1
                return False

            # Call provider
            try:
                if provider_name == 'azure':
                    # Azure STT processing
                    result = self._process_azure_stt(provider, audio_path, language)

                    # Call callback if provided
                    if callback and result:
                        callback(STTTaskResult(
                            success=True,
                            text=result,
                            provider=provider_name,
                            error=None
                        ))

                    return True

                else:
                    ColorPrint.yellow(f"[SpeechSwitch] Provider {provider_name} not yet implemented")
                    with self._lock:
                        self._stats['stt_failed'] += 1
                    return False

            except Exception as e:
                error_msg = str(e)
                ColorPrint.red(f"[SpeechSwitch] STT processing failed: {error_msg}")

                # Mark provider as unavailable if it's a critical error
                if "quota" in error_msg.lower() or "authentication" in error_msg.lower():
                    self._provider_status.mark_unavailable('stt', provider_name, error_msg)

                # Call callback with error
                if callback:
                    callback(STTTaskResult(
                        success=False,
                        text=None,
                        provider=provider_name,
                        error=error_msg
                    ))

                with self._lock:
                    self._stats['stt_failed'] += 1
                return False

        except Exception as e:
            ColorPrint.red(f"[SpeechSwitch] STT task processing error: {e}")
            with self._lock:
                self._stats['stt_failed'] += 1
            return False

    def _process_azure_stt(self, provider, audio_path: str, language: str) -> Optional[str]:
        """
        Process Azure STT request

        Args:
            provider: AzureSpeechRecognitionProvider instance
            audio_path: Path to audio file
            language: Language code

        Returns:
            Recognized text or None on failure
        """
        # Azure STT processing
        # This is simplified - actual implementation depends on provider API

        # For now, just log that we would process it
        ColorPrint.green(f"[SpeechSwitch] Azure STT would process: {audio_path}")

        # Return mock result
        # In real implementation, call provider.recognize() or similar
        return "Mock transcription result"

    def accept_task(self, task: Task) -> bool:
        """
        Accept task for processing (compatibility method)

        This method exists for compatibility with HeartbeatPusher's task routing.
        It simply calls process_task() synchronously.

        Args:
            task: Task to process

        Returns:
            True if task accepted (processed), False otherwise
        """
        return self.process_task(task)

    def register_with_heartbeat(self) -> bool:
        """
        Register with GlobalThreadPool for PyHeartbeat integration

        Returns:
            True if registered successfully
        """
        try:
            from pycore.pyheartbeat import get_global_thread_pool
            import threading

            if not self._initialized:
                self.initialize()

            thread_pool = get_global_thread_pool()

            # Use current thread as placeholder (SpeechSwitch runs in HeartbeatPusher's thread)
            current_thread = threading.current_thread()

            thread_pool.register_thread(
                name='speech_switch',
                instance=current_thread,
                task_handlers={
                    # TTS task types
                    'tts': self.accept_task,
                    'audio_synthesis': self.accept_task,
                    'text_to_speech': self.accept_task,
                    # STT task types
                    'stt': self.accept_task,
                    'speech_recognition': self.accept_task,
                    'speech_to_text': self.accept_task
                },
                metadata={
                    'description': 'Unified Speech Switch - Routes TTS and STT tasks',
                    'provider_status': self._provider_status.get_all_status(),
                    'stats': self._stats.copy()
                }
            )

            ColorPrint.green("[SpeechSwitch] Registered with GlobalThreadPool")
            return True

        except Exception as e:
            ColorPrint.red(f"[SpeechSwitch] Failed to register: {e}")
            return False

    def get_status(self) -> Dict:
        """
        Get switch status

        Returns:
            Dict with status information
        """
        with self._lock:
            return {
                'initialized': self._initialized,
                'provider_status': self._provider_status.get_all_status(),
                'stats': self._stats.copy()
            }

    def print_status(self):
        """Print status (for debugging)"""
        status = self.get_status()

        ColorPrint.blue("\n" + "="*70)
        ColorPrint.blue("SpeechSwitch Status")
        ColorPrint.blue("="*70)

        ColorPrint.yellow(f"Initialized: {status['initialized']}")
        ColorPrint.yellow(f"\nStatistics:")
        ColorPrint.yellow(f"  TTS processed: {status['stats']['tts_processed']}")
        ColorPrint.yellow(f"  TTS failed: {status['stats']['tts_failed']}")
        ColorPrint.yellow(f"  STT processed: {status['stats']['stt_processed']}")
        ColorPrint.yellow(f"  STT failed: {status['stats']['stt_failed']}")

        ColorPrint.blue("="*70 + "\n")

        # Print provider status
        self._provider_status.print_status()


# Global singleton instance
_speech_switch: Optional[SpeechSwitch] = None
_speech_switch_lock = threading.Lock()


def get_speech_switch() -> SpeechSwitch:
    """
    Get global SpeechSwitch singleton

    Returns:
        SpeechSwitch instance
    """
    global _speech_switch

    if _speech_switch is None:
        with _speech_switch_lock:
            if _speech_switch is None:
                _speech_switch = SpeechSwitch()

    return _speech_switch


def initialize_speech_switch() -> SpeechSwitch:
    """
    Initialize global SpeechSwitch singleton

    Returns:
        SpeechSwitch instance
    """
    switch = get_speech_switch()
    switch.initialize()
    return switch


# Export
__all__ = [
    'SpeechSwitch',
    'get_speech_switch',
    'initialize_speech_switch'
]
