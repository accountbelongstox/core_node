#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TTS Switch - Unified TTS Task Router

Routes TTS tasks to available providers (edge_tts, azure_tts, or both).
Integrates with PyHeartbeat GlobalTaskQueue system.

Usage:
    from pycore.pyutils.common.tts_switch import TTSSwitch, get_tts_switch
    from pycore.pyfoundations import Task

    # Get singleton
    switch = get_tts_switch()

    # Register with GlobalThreadPool
    switch.register_with_heartbeat()

    # Manual task submission (bypassing heartbeat)
    task = Task(task_type='tts', task_data={'text': 'Hello'})
    switch.accept_task(task)
"""

import queue
import threading
import asyncio
from pathlib import Path
from typing import Optional, Dict, Any, List
from enum import Enum

from pycore.pyfoundations import ColorPrint, Task
from pycore.pyfoundations.third_party import get_third_package_edge_tts
from pycore.pyutils.common.speech_task_models import TTSTaskData, TTSTaskResult


class TTSProvider(Enum):
    """Available TTS providers"""
    EDGE = "edge"
    AZURE = "azure"
    BOTH = "both"


class TTSSwitch:
    """
    TTS Switch - Routes tasks to available TTS providers

    Features:
    - Accepts unified Task objects from PyHeartbeat
    - Routes to edge_tts, azure_tts, or both
    - Non-blocking task processing
    - Provider health monitoring
    - Automatic fallback

    Architecture:
    - Registers with GlobalThreadPool as 'tts_switch'
    - Accepts 'tts' task_type from HeartbeatPusher
    - Routes to internal provider queue
    - Worker thread processes tasks
    """

    def __init__(
        self,
        max_queue_size: int = 50,
        default_provider: TTSProvider = TTSProvider.EDGE
    ):
        """
        Initialize TTS Switch

        Args:
            max_queue_size: Maximum internal queue size
            default_provider: Default TTS provider
        """
        self.max_queue_size = max_queue_size
        self.default_provider = default_provider

        # Internal task queue
        self.task_queue = queue.Queue(maxsize=max_queue_size)

        # Provider availability
        self._edge_available = False
        self._azure_available = False

        # Worker thread
        self._worker_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._running = False

        # Default voices by language
        self.default_voices = {
            "zh-CN": "zh-CN-XiaoxiaoNeural",
            "zh-TW": "zh-TW-HsiaoChenNeural",
            "en-US": "en-US-JennyNeural",
            "en-GB": "en-GB-SoniaNeural",
            "ja-JP": "ja-JP-NanamiNeural",
            "ko-KR": "ko-KR-SunHiNeural",
        }

        # Statistics
        self._tasks_processed = 0
        self._tasks_failed = 0

        # Edge TTS module reference
        self._edge_tts_module = None

    def initialize(self) -> bool:
        """
        Initialize TTS Switch

        Checks provider availability and starts worker thread.

        Returns:
            True if at least one provider is available
        """
        ColorPrint.blue("[TTSSwitch] Initializing...")

        # Check Edge TTS
        self._edge_available = self._check_edge_tts()

        # Check Azure TTS
        self._azure_available = self._check_azure_tts()

        if not self._edge_available and not self._azure_available:
            ColorPrint.red("[TTSSwitch] No TTS providers available")
            return False

        # Start worker thread
        self._start_worker()

        ColorPrint.green(f"[TTSSwitch] Initialized (edge={self._edge_available}, azure={self._azure_available})")
        return True

    def _check_edge_tts(self) -> bool:
        """Check if Edge TTS is available"""
        self._edge_tts_module = get_third_package_edge_tts()
        if self._edge_tts_module is None:
            ColorPrint.yellow("[TTSSwitch] Edge TTS not installed")
            return False
        ColorPrint.green("[TTSSwitch] Edge TTS available")
        return True

    def _check_azure_tts(self) -> bool:
        """Check if Azure TTS is available"""
        try:
            from pycore.pyutils.azure_speech import get_azure_speech_client
            client = get_azure_speech_client()
            if client.initialize():
                ColorPrint.green("[TTSSwitch] Azure TTS available")
                return True
            ColorPrint.yellow("[TTSSwitch] Azure TTS credentials missing")
            return False
        except Exception:
            ColorPrint.yellow("[TTSSwitch] Azure TTS not available")
            return False

    def _start_worker(self):
        """Start internal worker thread"""
        if self._running:
            return

        self._stop_event.clear()
        self._worker_thread = threading.Thread(
            target=self._worker_loop,
            name="TTSSwitch-Worker",
            daemon=True
        )
        self._worker_thread.start()
        self._running = True
        ColorPrint.blue("[TTSSwitch] Worker thread started")

    def _worker_loop(self):
        """Worker thread main loop"""
        while not self._stop_event.is_set():
            try:
                task = self.task_queue.get(timeout=1.0)
                self._process_task(task)
            except queue.Empty:
                continue
            except Exception as e:
                ColorPrint.red(f"[TTSSwitch] Worker error: {e}")

        ColorPrint.blue("[TTSSwitch] Worker thread stopped")

    def register_with_heartbeat(self) -> bool:
        """
        Register with GlobalThreadPool for PyHeartbeat integration

        Returns:
            True if registered successfully
        """
        try:
            from pycore.pyheartbeat import get_global_thread_pool

            if not self._running:
                self.initialize()

            thread_pool = get_global_thread_pool()
            thread_pool.register_thread(
                name='tts_switch',
                instance=self._worker_thread,
                task_handlers={
                    'tts': self.accept_task,
                    'audio_synthesis': self.accept_task,
                    'text_to_speech': self.accept_task
                },
                metadata={
                    'max_queue_size': self.max_queue_size,
                    'description': 'TTS Switch - Routes to available providers',
                    'edge_available': self._edge_available,
                    'azure_available': self._azure_available,
                    'default_provider': self.default_provider.value
                }
            )

            ColorPrint.green("[TTSSwitch] Registered with GlobalThreadPool")
            return True

        except Exception as e:
            ColorPrint.red(f"[TTSSwitch] Failed to register: {e}")
            return False

    def accept_task(self, task: Task) -> bool:
        """
        Accept task handler for HeartbeatPusher

        Called by HeartbeatPusher to offer a task.

        Args:
            task: Task from PyHeartbeat

        Returns:
            True if accepted, False if busy
        """
        try:
            if self.task_queue.qsize() < self.max_queue_size:
                self.task_queue.put(task, block=False)
                task.mark_running()
                ColorPrint.blue(f"[TTSSwitch] Accepted task {task.task_id[:8]}...")
                return True
            return False
        except queue.Full:
            return False

    def _process_task(self, task: Task):
        """
        Process TTS task

        Routes to appropriate provider based on task_data.

        Args:
            task: Task to process
        """
        try:
            # Parse task data using TTSTaskData model
            task_data = TTSTaskData.from_dict(task.task_data)

            if not task_data.text:
                self._fail_task_with_result(task, "No text provided")
                return

            # Get provider preference
            provider = self._resolve_provider(task_data.provider)

            # Extract fields
            text = task_data.text
            language = task_data.language
            voice = task_data.voice
            use_cache = task_data.enable_cache

            # Get output_path from original dict (not part of TTSTaskData)
            output_path = task.task_data.get('output_path')

            # Determine voice
            if not voice:
                voice = self.default_voices.get(language, 'en-US-JennyNeural')

            # Generate output path if not provided
            if not output_path:
                import hashlib
                import tempfile
                text_hash = hashlib.md5(text.encode()).hexdigest()[:16]
                output_path = Path(tempfile.gettempdir()) / f"tts_{text_hash}.mp3"
            else:
                output_path = Path(output_path)

            # Check cache first
            if use_cache:
                if self._check_cache(task_data.provider, text, language, output_path):
                    ColorPrint.green(f"[TTSSwitch] Cache hit: {output_path.name}")
                    self._complete_task_with_result(
                        task, output_path, task_data, voice, cached=True
                    )
                    return

            # Route to provider
            success = False

            if provider == TTSProvider.BOTH:
                # Try both providers
                success = self._synthesize_both(text, output_path, voice, language)
            elif provider == TTSProvider.EDGE and self._edge_available:
                success = self._synthesize_edge(text, output_path, voice)
            elif provider == TTSProvider.AZURE and self._azure_available:
                success = self._synthesize_azure(text, output_path, voice)
            else:
                # Fallback to available provider
                if self._edge_available:
                    success = self._synthesize_edge(text, output_path, voice)
                elif self._azure_available:
                    success = self._synthesize_azure(text, output_path, voice)

            if success:
                # Save to cache
                if use_cache and output_path.exists():
                    self._save_cache(task_data.provider, text, language, output_path)

                self._complete_task_with_result(
                    task, output_path, task_data, voice, cached=False
                )
                self._tasks_processed += 1
            else:
                self._fail_task_with_result(task, "TTS synthesis failed")

        except Exception as e:
            self._fail_task_with_result(task, str(e))

    def _resolve_provider(self, provider_str: str) -> TTSProvider:
        """Resolve provider string to TTSProvider enum"""
        provider_map = {
            'edge': TTSProvider.EDGE,
            'azure': TTSProvider.AZURE,
            'both': TTSProvider.BOTH
        }
        return provider_map.get(provider_str.lower(), self.default_provider)

    def _synthesize_edge(self, text: str, output_path: Path, voice: str) -> bool:
        """Synthesize using Edge TTS"""
        if not self._edge_available or not self._edge_tts_module:
            return False

        async def _do_synthesis():
            communicate = self._edge_tts_module.Communicate(text, voice)
            await communicate.save(str(output_path))

        try:
            try:
                loop = asyncio.get_running_loop()
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(asyncio.run, _do_synthesis())
                    future.result()
            except RuntimeError:
                asyncio.run(_do_synthesis())

            ColorPrint.green(f"[TTSSwitch] Edge TTS synthesized: {output_path.name}")
            return True
        except Exception as e:
            ColorPrint.red(f"[TTSSwitch] Edge TTS error: {e}")
            return False

    def _synthesize_azure(self, text: str, output_path: Path, voice: str) -> bool:
        """Synthesize using Azure TTS"""
        if not self._azure_available:
            return False

        try:
            from pycore.pyutils.azure_speech import get_azure_speech_client
            client = get_azure_speech_client()
            success = client.synthesize(text, output_path, voice)

            if success:
                ColorPrint.green(f"[TTSSwitch] Azure TTS synthesized: {output_path.name}")
            return success
        except Exception as e:
            ColorPrint.red(f"[TTSSwitch] Azure TTS error: {e}")
            return False

    def _synthesize_both(self, text: str, output_path: Path, voice: str, language: str) -> bool:
        """
        Synthesize using both providers

        Tries Edge first (free), then Azure as fallback.
        """
        if self._edge_available:
            if self._synthesize_edge(text, output_path, voice):
                return True

        if self._azure_available:
            return self._synthesize_azure(text, output_path, voice)

        return False

    def _check_cache(self, provider: str, text: str, language: str, output_path: Path) -> bool:
        """Check TTS cache"""
        try:
            from pycore.pyutils.tts_cache import tts_cache_manager
            return tts_cache_manager.copy_from_cache(provider, text, language, output_path)
        except Exception:
            return False

    def _save_cache(self, provider: str, text: str, language: str, output_path: Path):
        """Save to TTS cache"""
        try:
            from pycore.pyutils.tts_cache import tts_cache_manager
            tts_cache_manager.save_cache(provider, text, language, output_path)
        except Exception:
            pass

    def _complete_task_with_result(
        self,
        task: Task,
        output_path: Path,
        task_data: TTSTaskData,
        voice: str,
        cached: bool
    ):
        """Mark task as completed with structured result"""
        # Get file size if exists
        file_size = output_path.stat().st_size if output_path.exists() else None

        # Create structured result
        result = TTSTaskResult(
            success=True,
            audio_file=str(output_path),
            language=task_data.language,
            provider=task_data.provider,
            voice=voice,
            cached=cached,
            file_size=file_size
        )

        # Store result in task metadata
        task.metadata['result'] = result.to_dict()
        task.mark_completed()

        if task.callback:
            task.callback(task)

    def _fail_task_with_result(self, task: Task, error_msg: str):
        """Mark task as failed with structured result"""
        result = TTSTaskResult(
            success=False,
            error=error_msg
        )

        task.metadata['result'] = result.to_dict()
        task.mark_failed(error_msg)

        if task.error_callback:
            task.error_callback(task)

        self._tasks_failed += 1

    def stop(self):
        """Stop TTS Switch"""
        self._stop_event.set()
        self._running = False

        if self._worker_thread and self._worker_thread.is_alive():
            self._worker_thread.join(timeout=5.0)

        ColorPrint.blue("[TTSSwitch] Stopped")

    def get_status(self) -> Dict[str, Any]:
        """Get TTS Switch status"""
        return {
            'running': self._running,
            'edge_available': self._edge_available,
            'azure_available': self._azure_available,
            'default_provider': self.default_provider.value,
            'queue_size': self.task_queue.qsize(),
            'max_queue_size': self.max_queue_size,
            'tasks_processed': self._tasks_processed,
            'tasks_failed': self._tasks_failed
        }

    def get_available_providers(self) -> List[str]:
        """Get list of available providers"""
        providers = []
        if self._edge_available:
            providers.append('edge')
        if self._azure_available:
            providers.append('azure')
        return providers


# Singleton instance
_global_tts_switch: Optional[TTSSwitch] = None
_switch_lock = threading.Lock()


def get_tts_switch() -> TTSSwitch:
    """
    Get global TTS Switch singleton

    Returns:
        TTSSwitch instance
    """
    global _global_tts_switch
    with _switch_lock:
        if _global_tts_switch is None:
            _global_tts_switch = TTSSwitch()
        return _global_tts_switch


def initialize_tts_switch(
    max_queue_size: int = 50,
    default_provider: str = "edge",
    register_heartbeat: bool = False
) -> TTSSwitch:
    """
    Initialize global TTS Switch

    Args:
        max_queue_size: Maximum queue size
        default_provider: Default provider ('edge', 'azure', 'both')
        register_heartbeat: Register with GlobalThreadPool

    Returns:
        Initialized TTSSwitch instance
    """
    global _global_tts_switch
    with _switch_lock:
        provider_map = {
            'edge': TTSProvider.EDGE,
            'azure': TTSProvider.AZURE,
            'both': TTSProvider.BOTH
        }

        _global_tts_switch = TTSSwitch(
            max_queue_size=max_queue_size,
            default_provider=provider_map.get(default_provider, TTSProvider.EDGE)
        )

        _global_tts_switch.initialize()

        if register_heartbeat:
            _global_tts_switch.register_with_heartbeat()

        return _global_tts_switch


__all__ = [
    'TTSProvider',
    'TTSSwitch',
    'get_tts_switch',
    'initialize_tts_switch'
]
