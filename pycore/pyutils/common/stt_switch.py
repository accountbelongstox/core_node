#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
STT Switch - Speech-to-Text Task Router

Routes STT tasks to available providers (Azure, Local).
Symmetric design with TTSSwitch.
Integrates with PyHeartbeat GlobalThreadPool.

Architecture:
    GlobalTaskQueue -> HeartbeatPusher -> STTSwitch -> Provider -> Result
"""

import threading
import queue
import time
from typing import Dict, Any, Optional, List
from enum import Enum

from pycore.pyfoundations import ColorPrint
from pycore.pyfoundations import Task, TaskPriority
from pycore.pyutils.common.speech_task_models import STTTaskData, STTTaskResult


class STTProvider(Enum):
    """Available STT providers"""
    AZURE = 'azure'
    LOCAL = 'local'
    AUTO = 'auto'


class STTSwitch:
    """
    STT Switch - Routes STT tasks to available providers

    Integrates with PyHeartbeat:
    - Registers with GlobalThreadPool
    - Accepts tasks from HeartbeatPusher
    - Routes to available STT providers
    """

    def __init__(
        self,
        max_queue_size: int = 50,
        default_provider: STTProvider = STTProvider.AUTO
    ):
        """
        Initialize STT Switch

        Args:
            max_queue_size: Maximum task queue size
            default_provider: Default STT provider
        """
        self._initialized = False
        self.max_queue_size = max_queue_size
        self.default_provider = default_provider

        # Task queue
        self.task_queue: queue.Queue = queue.Queue(maxsize=max_queue_size)

        # Provider availability
        self._azure_available = False
        self._local_available = False

        # Worker thread
        self._worker_thread: Optional[threading.Thread] = None
        self._stop_flag = False

        # Statistics
        self._tasks_processed = 0
        self._tasks_failed = 0

    def initialize(self) -> bool:
        """
        Initialize STT Switch

        Returns:
            True if initialized successfully
        """
        if self._initialized:
            return True

        ColorPrint.blue("[STTSwitch] Initializing...")

        # Check provider availability
        self._check_providers()

        if not self._azure_available and not self._local_available:
            ColorPrint.yellow("[STTSwitch] No STT providers available")
            ColorPrint.yellow("[STTSwitch] Azure SDK or local recognizer required")

        # Start worker thread
        self._start_worker()

        self._initialized = True
        ColorPrint.green(f"[STTSwitch] Initialized (azure={self._azure_available}, local={self._local_available})")

        return True

    def _check_providers(self):
        """Check which STT providers are available"""
        # Check Azure STT
        try:
            from pycore.pyfoundations.third_party import get_third_package_speechsdk
            speechsdk = get_third_package_speechsdk()
            if speechsdk:
                self._azure_available = True
                ColorPrint.green("[STTSwitch] Azure STT available")
        except Exception:
            self._azure_available = False
            ColorPrint.yellow("[STTSwitch] Azure STT not available")

        # Check local STT (speech_recognition library)
        try:
            from pycore.pyutils.speech_recognition import SpeechRecognizer
            self._local_available = True
            ColorPrint.green("[STTSwitch] Local STT available")
        except Exception:
            self._local_available = False
            ColorPrint.yellow("[STTSwitch] Local STT not available")

    def _start_worker(self):
        """Start worker thread"""
        self._worker_thread = threading.Thread(
            target=self._worker_loop,
            name="STTSwitchWorker",
            daemon=True
        )
        self._worker_thread.start()
        ColorPrint.blue("[STTSwitch] Worker thread started")

    def _worker_loop(self):
        """Worker thread main loop"""
        while not self._stop_flag:
            try:
                # Get task from queue (with timeout)
                task = self.task_queue.get(timeout=1.0)

                if task is None:
                    continue

                # Process task
                self._process_task(task)

            except queue.Empty:
                continue
            except Exception as e:
                ColorPrint.red(f"[STTSwitch] Worker error: {e}")

    def _process_task(self, task: Task):
        """
        Process STT task

        Args:
            task: Task object with STT request
        """
        ColorPrint.blue(f"[STTSwitch] Processing task: {task.task_id}")

        try:
            # Parse task data using STTTaskData model
            task_data = STTTaskData.from_dict(task.task_data)

            # Validate input
            if not task_data.audio_file and not task_data.audio_base64:
                self._fail_task_with_result(task, "audio_file or audio_base64 is required")
                return

            # Select provider
            if task_data.provider:
                provider_enum = STTProvider(task_data.provider)
            else:
                provider_enum = self.default_provider

            # Route to provider
            result_dict = self._route_to_provider(
                task_data.audio_file,
                task_data.language,
                provider_enum
            )

            # Create structured result
            result = STTTaskResult(
                success=True,
                text=result_dict.get('text', ''),
                language=result_dict.get('language', task_data.language),
                provider=result_dict.get('provider', task_data.provider),
                confidence=result_dict.get('confidence', 0.0)
            )

            # Store result and mark completed
            task.metadata['result'] = result.to_dict()
            task.mark_completed()

            if task.callback:
                task.callback(task)

            self._tasks_processed += 1
            ColorPrint.green(f"[STTSwitch] Task completed: {task.task_id}")

        except Exception as e:
            self._fail_task_with_result(task, str(e))

    def _route_to_provider(
        self,
        audio_file: str,
        language: str,
        provider: STTProvider
    ) -> Dict[str, Any]:
        """
        Route STT request to provider

        Args:
            audio_file: Path to audio file
            language: Language code
            provider: STT provider

        Returns:
            Recognition result dict
        """
        if provider == STTProvider.AUTO:
            # Auto-select: Azure first, then local
            if self._azure_available:
                return self._process_azure(audio_file, language)
            elif self._local_available:
                return self._process_local(audio_file, language)
            else:
                raise RuntimeError("No STT provider available")

        elif provider == STTProvider.AZURE:
            if not self._azure_available:
                raise RuntimeError("Azure STT not available")
            return self._process_azure(audio_file, language)

        elif provider == STTProvider.LOCAL:
            if not self._local_available:
                raise RuntimeError("Local STT not available")
            return self._process_local(audio_file, language)

        else:
            raise ValueError(f"Unknown provider: {provider}")

    def _process_azure(self, audio_file: str, language: str) -> Dict[str, Any]:
        """Process with Azure Speech SDK"""
        ColorPrint.blue(f"[STTSwitch] Processing with Azure STT: {audio_file}")

        from pycore.pyctl.speech import get_speech_manager
        speech_manager = get_speech_manager()

        result = speech_manager.recognize_from_file(audio_file, language=language)

        return {
            'provider': 'azure',
            'text': result.get('text', ''),
            'confidence': result.get('confidence', 0.0),
            'language': language
        }

    def _process_local(self, audio_file: str, language: str) -> Dict[str, Any]:
        """Process with local speech recognition"""
        ColorPrint.blue(f"[STTSwitch] Processing with Local STT: {audio_file}")

        from pycore.pyutils.speech_recognition import SpeechRecognizer
        recognizer = SpeechRecognizer()

        result = recognizer.recognize_file(audio_file, language=language)

        return {
            'provider': 'local',
            'text': result.get('text', ''),
            'confidence': result.get('confidence', 0.0),
            'language': language
        }

    def _fail_task_with_result(self, task: Task, error_msg: str):
        """Mark task as failed with structured result"""
        result = STTTaskResult(
            success=False,
            error=error_msg
        )

        task.metadata['result'] = result.to_dict()
        task.mark_failed(error_msg)

        if task.error_callback:
            task.error_callback(task)

        self._tasks_failed += 1
        ColorPrint.red(f"[STTSwitch] Task failed: {task.task_id} - {error_msg}")

    def accept_task(self, task: Task) -> bool:
        """
        Accept task from HeartbeatPusher

        Args:
            task: Task object

        Returns:
            True if accepted, False if queue full
        """
        if self.task_queue.qsize() < self.max_queue_size:
            try:
                self.task_queue.put(task, block=False)
                task.mark_running()
                ColorPrint.blue(f"[STTSwitch] Accepted task: {task.task_id}")
                return True
            except queue.Full:
                ColorPrint.yellow(f"[STTSwitch] Queue full, rejecting task: {task.task_id}")
                return False
        else:
            ColorPrint.yellow(f"[STTSwitch] Queue full, rejecting task: {task.task_id}")
            return False

    def register_with_heartbeat(self) -> bool:
        """
        Register with GlobalThreadPool

        Returns:
            True if registered successfully
        """
        try:
            from pycore.pyheartbeat import get_global_thread_pool

            thread_pool = get_global_thread_pool()
            thread_pool.register_thread(
                name='stt_switch',
                instance=self._worker_thread,
                task_handlers={
                    'stt': self.accept_task,
                    'speech_recognition': self.accept_task,
                    'speech_to_text': self.accept_task
                },
                metadata={
                    'type': 'stt_processor',
                    'providers': self.get_available_providers(),
                    'max_queue_size': self.max_queue_size
                }
            )

            ColorPrint.green("[STTSwitch] Registered with GlobalThreadPool")
            return True

        except Exception as e:
            ColorPrint.red(f"[STTSwitch] Failed to register with GlobalThreadPool: {e}")
            return False

    def get_available_providers(self) -> List[str]:
        """Get list of available providers"""
        providers = []
        if self._azure_available:
            providers.append('azure')
        if self._local_available:
            providers.append('local')
        return providers

    def get_status(self) -> Dict[str, Any]:
        """Get STT switch status"""
        return {
            'initialized': self._initialized,
            'azure_available': self._azure_available,
            'local_available': self._local_available,
            'queue_size': self.task_queue.qsize(),
            'max_queue_size': self.max_queue_size,
            'tasks_processed': self._tasks_processed,
            'tasks_failed': self._tasks_failed,
            'worker_alive': self._worker_thread.is_alive() if self._worker_thread else False
        }

    def stop(self):
        """Stop STT switch"""
        self._stop_flag = True
        if self._worker_thread:
            self._worker_thread.join(timeout=5.0)
        ColorPrint.blue("[STTSwitch] Stopped")


# Global singleton
_global_stt_switch: Optional[STTSwitch] = None
_stt_lock = threading.Lock()


def get_stt_switch() -> STTSwitch:
    """Get global STT switch instance"""
    global _global_stt_switch
    with _stt_lock:
        if _global_stt_switch is None:
            _global_stt_switch = STTSwitch()
        return _global_stt_switch


def initialize_stt_switch(
    max_queue_size: int = 50,
    default_provider: STTProvider = STTProvider.AUTO,
    register_heartbeat: bool = True
) -> STTSwitch:
    """
    Initialize global STT switch

    Args:
        max_queue_size: Maximum task queue size
        default_provider: Default STT provider
        register_heartbeat: Register with GlobalThreadPool

    Returns:
        STTSwitch instance
    """
    stt_switch = get_stt_switch()

    if not stt_switch._initialized:
        stt_switch.max_queue_size = max_queue_size
        stt_switch.default_provider = default_provider
        stt_switch.initialize()

        if register_heartbeat:
            stt_switch.register_with_heartbeat()

    return stt_switch


__all__ = [
    'STTProvider',
    'STTSwitch',
    'get_stt_switch',
    'initialize_stt_switch'
]
