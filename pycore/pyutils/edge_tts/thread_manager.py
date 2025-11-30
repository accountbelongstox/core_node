#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TTS Thread Manager

Manages worker threads for TTS processing.
"""

import threading
import time
from typing import Dict, Optional

from pycore import ColorPrint
from pycore.pyfoundations.thread_bus import THREAD_BUS
from pycore.pyutils.common.tts_queue_ops import TTSQueueOps
from pycore.pyutils.common.tts_models import ItemType, ItemStatus
from pycore.pyutils.edge_tts.edge_tts_client import get_edge_tts_client
from pycore.pyutils.edge_tts.translator import TTSTranslator


class BaseTTSWorkerThread(threading.Thread):
    """
    Base worker thread for TTS processing
    
    This is a base class that should be extended by TTS libraries
    (e.g., edge_tts, azure_speech) to implement their specific processing logic.
    """
    
    def __init__(self, thread_id: int, item_type: ItemType, interval: float = 1.0):
        """
        Initialize worker thread
        
        Args:
            thread_id: Thread ID
            item_type: Type of items to process
            interval: Polling interval in seconds
        """
        super().__init__(name=f"TTSWorker-{item_type.value}-{thread_id}", daemon=True)
        self.thread_id = thread_id
        self.item_type = item_type
        self.interval = interval
        self._stop_event = threading.Event()
        self.translator = TTSTranslator()
        self.translator.initialize()
    
    def run(self):
        """Thread main loop"""
        THREAD_BUS.set_thread_state(self.name, 'starting')
        ColorPrint.blue(f"[TTSWorker] {self.name} started")
        
        THREAD_BUS.set_thread_state(self.name, 'running')
        
        while not self._stop_event.is_set():
            try:
                # Get item from queue
                if self.item_type == ItemType.DOCUMENT:
                    item = TTSQueueOps.get_document(timeout=self.interval)
                elif self.item_type == ItemType.SENTENCE:
                    item = TTSQueueOps.get_sentence(timeout=self.interval)
                elif self.item_type == ItemType.WORD:
                    item = TTSQueueOps.get_word(timeout=self.interval)
                else:
                    item = None
                
                if item:
                    self._process_item(item)
                else:
                    # No item, wait a bit
                    time.sleep(self.interval)
            
            except Exception as e:
                ColorPrint.red(f"[TTSWorker] {self.name} error: {e}")
                time.sleep(self.interval)
        
        THREAD_BUS.set_thread_state(self.name, 'stopped')
        ColorPrint.blue(f"[TTSWorker] {self.name} stopped")
    
    def _process_item(self, item):
        """
        Process a single item
        
        This method should be overridden by subclasses to implement
        specific TTS processing logic.
        """
        ColorPrint.blue(f"[TTSWorker] Processing {self.item_type.value}: {item.md5[:8]}...")
        
        # Process based on item type
        if self.item_type == ItemType.DOCUMENT:
            self._process_document(item)
        elif self.item_type == ItemType.SENTENCE:
            self._process_sentence(item)
        elif self.item_type == ItemType.WORD:
            self._process_word(item)
        
        TTSQueueOps.mark_completed(item.md5)
    
    def _process_document(self, document):
        """
        Process document
        
        Should be overridden by subclasses.
        """
        pass
    
    def _process_sentence(self, sentence):
        """
        Process sentence
        
        Should be overridden by subclasses.
        """
        pass
    
    def _process_word(self, word):
        """
        Process word
        
        Should be overridden by subclasses.
        """
        pass
    
    def stop(self):
        """Stop thread"""
        self._stop_event.set()


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
        self.thread_id = thread_id
        self.api_url = api_url
        self.interval = interval
        self._stop_event = threading.Event()
    
    def run(self):
        """Thread main loop"""
        THREAD_BUS.set_thread_state(self.name, 'starting')
        ColorPrint.blue(f"[TTSNetwork] {self.name} started")
        
        THREAD_BUS.set_thread_state(self.name, 'running')
        
        while not self._stop_event.is_set():
            try:
                # Request model data from API
                self._request_model_data()
                
                # Wait for interval
                self._stop_event.wait(self.interval)
            
            except Exception as e:
                ColorPrint.red(f"[TTSNetwork] {self.name} error: {e}")
                self._stop_event.wait(self.interval)
        
        THREAD_BUS.set_thread_state(self.name, 'stopped')
        ColorPrint.blue(f"[TTSNetwork] {self.name} stopped")
    
    def _request_model_data(self):
        """Request model data from API"""
        # TODO: Implement API request logic
        pass
    
    def stop(self):
        """Stop thread"""
        self._stop_event.set()


class TTSThreadManager:
    """
    Manager for TTS worker threads
    
    Features:
    - Start/stop worker threads by number
    - Manage thread lifecycle
    - Monitor thread status
    """
    
    def __init__(self):
        """Initialize thread manager"""
        self._threads: Dict[str, threading.Thread] = {}
        self._lock = threading.RLock()
    
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
        with self._lock:
            thread_name = f"TTSWorker-{item_type.value}-{thread_id}"
            
            if thread_name in self._threads:
                ColorPrint.yellow(f"[TTSThreadManager] Thread {thread_name} already exists")
                return False
            
            # Use base thread - subclasses should extend BaseTTSWorkerThread
            # For edge_tts, use EdgeTTSWorkerThread from edge_tts_worker_thread.py
            from pycore.pyutils.edge_tts.edge_tts_worker_thread import EdgeTTSWorkerThread
            thread = EdgeTTSWorkerThread(thread_id, item_type, interval)
            thread.start()
            self._threads[thread_name] = thread
            
            ColorPrint.green(f"[TTSThreadManager] Started {thread_name}")
            return True
    
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
        with self._lock:
            thread_name = f"TTSNetwork-{thread_id}"
            
            if thread_name in self._threads:
                ColorPrint.yellow(f"[TTSThreadManager] Thread {thread_name} already exists")
                return False
            
            thread = TTSNetworkThread(thread_id, api_url, interval)
            thread.start()
            self._threads[thread_name] = thread
            
            ColorPrint.green(f"[TTSThreadManager] Started {thread_name}")
            return True
    
    def stop_thread(self, thread_name: str) -> bool:
        """
        Stop a thread
        
        Args:
            thread_name: Thread name
        
        Returns:
            bool: True if stopped successfully
        """
        with self._lock:
            if thread_name not in self._threads:
                return False
            
            thread = self._threads[thread_name]
            if hasattr(thread, 'stop'):
                thread.stop()
            
            thread.join(timeout=5.0)
            del self._threads[thread_name]
            
            ColorPrint.blue(f"[TTSThreadManager] Stopped {thread_name}")
            return True
    
    def stop_all(self):
        """Stop all threads"""
        with self._lock:
            for thread_name in list(self._threads.keys()):
                self.stop_thread(thread_name)
    
    def get_thread_status(self) -> Dict[str, str]:
        """Get status of all threads"""
        with self._lock:
            status = {}
            for thread_name, thread in self._threads.items():
                state = THREAD_BUS.get_thread_state(thread_name)
                status[thread_name] = state or 'unknown'
            return status


# Global thread manager instance
_global_thread_manager: Optional[TTSThreadManager] = None
_manager_lock = threading.Lock()


def get_tts_thread_manager() -> TTSThreadManager:
    """Get global TTS thread manager instance"""
    global _global_thread_manager
    with _manager_lock:
        if _global_thread_manager is None:
            _global_thread_manager = TTSThreadManager()
        return _global_thread_manager

