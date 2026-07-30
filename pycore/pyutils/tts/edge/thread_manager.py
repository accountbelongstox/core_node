#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TTS Thread Manager

Manages worker threads for TTS processing.

THREAD_BUS Integration:
- Uses set_thread_state for thread status tracking
- Checks is_shutdown_requested() in worker loops
- TTSThreadManager.stop_all() registered as shutdown handler
- Triggers tts.worker.completed events on item completion
- Backwards compatible: keeps existing functionality
"""

import threading
from contextlib import nullcontext
from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
)
from typing import Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.speech_models import ItemType
from pycore.pyutils.tts.edge.worker_base import BaseTTSWorkerThread

from pycore.pyutils.tts.edge.worker_thread import EdgeTTSWorkerThread



class TTSNetworkThread(threading.Thread):
    """Network thread for API requests"""
    
    def __init__(self, thread_id: int, api_url: str, interval: float = 60.0):
        """
        Initialize network thread
        
        Args:
            thread_id: Thread ID
            api_url: API endpoint URL
            interval: Polling interval in seconds
        """
        super().__init__(name=f"TTSNetwork-{thread_id}", daemon=True)
        self._config_signal = f"tts.network.config.{id(self)}"
        self._stop_signal = f"tts.network.stop.{id(self)}"
        THREAD_BUS.signal(self._config_signal, {
            "thread_id": thread_id,
            "api_url": api_url,
            "interval": interval,
        })
        THREAD_BUS.clear_signal(self._stop_signal)

    @property
    def interval(self) -> float:
        return float(THREAD_BUS.get_signal(self._config_signal, {})["interval"])
    
    def run(self):
        """
        Thread main loop

        THREAD_BUS Integration:
        - Checks is_shutdown_requested() for graceful shutdown
        """
        THREAD_BUS.set_thread_state(self.name, 'starting')
        ColorPrint.blue(f"[TTSNetwork] {self.name} started")

        THREAD_BUS.set_thread_state(self.name, 'running')

        while not THREAD_BUS.get_signal(self._stop_signal, False):
            # THREAD_BUS Integration: Check if global shutdown was requested
            if THREAD_BUS.is_shutdown_requested():
                ColorPrint.yellow(f"[TTSNetwork] {self.name} THREAD_BUS shutdown detected, stopping...")
                break

            try:
                # Request model data from API
                self._request_model_data()

                # Wait for interval
                THREAD_BUS.wait_signal(self._stop_signal, timeout=self.interval)

            except Exception as e:
                ColorPrint.red(f"[TTSNetwork] {self.name} error: {e}")
                THREAD_BUS.wait_signal(self._stop_signal, timeout=self.interval)

        THREAD_BUS.set_thread_state(self.name, 'stopped')
        ColorPrint.blue(f"[TTSNetwork] {self.name} stopped")
    
    def _request_model_data(self):
        """Request model data from API"""
        # TODO: Implement API request logic
        pass
    
    def stop(self):
        """Stop thread"""
        THREAD_BUS.signal(self._stop_signal, True)


class TTSThreadManager:
    """
    Manager for TTS worker threads

    Features:
    - Start/stop worker threads by number
    - Manage thread lifecycle
    - Monitor thread status

    THREAD_BUS Integration:
    - stop_all() registered as shutdown handler (priority=75)
    - Gracefully stops all worker threads during shutdown
    """

    def __init__(self):
        """Initialize thread manager"""
        self._threads: Dict[str, threading.Thread] = {}
        init_serialized_owner(
            self,
            'pyutils.edge_tts.thread_manager',
            'TTSThreadManagerStateThread',
        )
        self._state_scope = nullcontext()
        self._shutdown_registered = False

    def _ensure_shutdown_handler(self):
        """
        Ensure shutdown handler is registered (called on first worker start)

        THREAD_BUS Integration:
        - Registers stop_all() as shutdown handler once
        """
        if not self._shutdown_registered:
            THREAD_BUS.register_shutdown_handler(
                self.stop_all,
                priority=75,
                name="tts_thread_manager"
            )
            ColorPrint.blue("[TTSThreadManager] Registered THREAD_BUS shutdown handler (priority=75)")
            self._shutdown_registered = True
    
    @serialized_method
    def start_worker(self, thread_id: int, item_type: ItemType, interval: float = 1.0) -> bool:
        """
        Start a worker thread

        Args:
            thread_id: Thread ID
            item_type: Type of items to process
            interval: Polling interval

        Returns:
            bool: True if started successfully
        """
        with self._state_scope:
            # Ensure shutdown handler is registered (first worker start)
            self._ensure_shutdown_handler()

            thread_name = f"TTSWorker-{item_type.value}-{thread_id}"

            if thread_name in self._threads:
                ColorPrint.yellow(f"[TTSThreadManager] Thread {thread_name} already exists")
                return False

            # Use base thread - subclasses should extend BaseTTSWorkerThread
            # For edge_tts, use EdgeTTSWorkerThread from edge_tts_worker_thread.py
            thread = EdgeTTSWorkerThread(thread_id, item_type, interval)
            thread.start()
            self._threads[thread_name] = thread

            ColorPrint.green(f"[TTSThreadManager] Started {thread_name}")
            return True
    
    @serialized_method
    def start_network_thread(self, thread_id: int, api_url: str, interval: float = 60.0) -> bool:
        """
        Start a network thread

        Args:
            thread_id: Thread ID
            api_url: API endpoint URL
            interval: Polling interval

        Returns:
            bool: True if started successfully
        """
        with self._state_scope:
            # Ensure shutdown handler is registered (first thread start)
            self._ensure_shutdown_handler()

            thread_name = f"TTSNetwork-{thread_id}"

            if thread_name in self._threads:
                ColorPrint.yellow(f"[TTSThreadManager] Thread {thread_name} already exists")
                return False

            thread = TTSNetworkThread(thread_id, api_url, interval)
            thread.start()
            self._threads[thread_name] = thread

            ColorPrint.green(f"[TTSThreadManager] Started {thread_name}")
            return True
    
    @serialized_method
    def stop_thread(self, thread_name: str) -> bool:
        """
        Stop a thread
        
        Args:
            thread_name: Thread name
        
        Returns:
            bool: True if stopped successfully
        """
        with self._state_scope:
            if thread_name not in self._threads:
                return False
            
            thread = self._threads[thread_name]
            if hasattr(thread, 'stop'):
                thread.stop()
            
            thread.join(timeout=5.0)
            del self._threads[thread_name]
            
            ColorPrint.blue(f"[TTSThreadManager] Stopped {thread_name}")
            return True
    
    @serialized_method
    def stop_all(self):
        """Stop all threads"""
        with self._state_scope:
            for thread_name in list(self._threads.keys()):
                self.stop_thread(thread_name)
    
    @serialized_method
    def get_thread_status(self) -> Dict[str, str]:
        """Get status of all threads"""
        with self._state_scope:
            status = {}
            for thread_name, thread in self._threads.items():
                state = THREAD_BUS.get_thread_state(thread_name)
                status[thread_name] = state or 'unknown'
            return status

