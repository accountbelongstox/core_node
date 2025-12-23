# -*- coding: utf-8 -*-
"""
TTS Queue Poller Service

Polls Laravel TTS queue via PyHeartbeat callback mechanism.
Designed for idempotent operation and heartbeat interceptor control.
"""

import requests
from typing import List, Dict, Any, Optional
from pycore import ColorPrint


class TTSQueuePollerService:
    """
    TTS Queue Poller Service (Singleton)

    Architecture:
    - Registers with PyHeartbeat (interval=60s)
    - Controlled via enable/disable (interceptor pattern)
    - Polls Laravel API when enabled
    - Idempotent: Can be initialized multiple times safely
    """

    _instance: Optional['TTSQueuePollerService'] = None

    def __new__(cls, *args, **kwargs):
        """Singleton pattern - ensure only one instance exists"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self, laravel_api_url: str = "http://localhost:8000"):
        """
        Initialize TTS Queue Poller Service (Idempotent)

        Args:
            laravel_api_url: Laravel API base URL

        Note:
            This method is idempotent - calling it multiple times
            will not reinitialize if already initialized.
        """
        # Idempotent check - skip if already initialized
        if hasattr(self, '_initialized') and self._initialized:
            return

        self.api_url = laravel_api_url
        self.batch_size = 10
        self._initialized = True

        ColorPrint.green(f"[TTSQueuePoller] Service initialized (API: {self.api_url})")

    def poll_and_process(self):
        """
        Heartbeat callback function (called every 60 seconds when enabled)

        This function is registered with PyHeartbeat and executed
        when the callback is enabled via interceptor.

        Idempotent: Safe to call multiple times.
        """
        try:
            # Fetch pending tasks from Laravel
            pending_tasks = self._fetch_pending_tasks()

            if not pending_tasks:
                ColorPrint.blue("[TTSQueuePoller] No pending tasks")
                return

            ColorPrint.green(f"[TTSQueuePoller] Found {len(pending_tasks)} pending tasks")

            # Process tasks
            for task in pending_tasks:
                self._process_task(task)

        except Exception as e:
            ColorPrint.red(f"[TTSQueuePoller] Polling error: {e}")

    def _fetch_pending_tasks(self) -> List[Dict[str, Any]]:
        """
        Fetch pending tasks from Laravel API

        Returns:
            List of pending tasks (empty list on error)
        """
        try:
            response = requests.get(
                f"{self.api_url}/api/app_qy_v1/ai_tools/tts/queue/summary",
                params={
                    'status': 'pending',
                    'per_page': self.batch_size
                },
                timeout=5
            )

            if response.status_code == 200:
                data = response.json()
                tasks = data.get('data', {}).get('tasks', [])
                return tasks

        except Exception as e:
            ColorPrint.red(f"[TTSQueuePoller] API fetch error: {e}")

        return []

    def _process_task(self, task: Dict[str, Any]):
        """
        Process single TTS task

        Args:
            task: Task data from Laravel

        Note:
            This is a placeholder implementation.
            Actual TTS processing logic should be added here.
        """
        task_id = task.get('task_id')
        content = task.get('content_text')
        language = task.get('language')

        ColorPrint.blue(f"[TTSQueuePoller] Processing task #{task_id}: {content[:30]}...")

        # TODO: Implement actual TTS processing logic using Edge TTS
        # For now, just log the task
        ColorPrint.yellow(f"[TTSQueuePoller] Task #{task_id} processing (placeholder)")

    def get_status(self) -> Dict[str, Any]:
        """
        Get service status

        Returns:
            Service status information
        """
        return {
            'service': 'TTS Queue Poller',
            'api_url': self.api_url,
            'batch_size': self.batch_size,
            'initialized': self._initialized
        }


# Global singleton accessor function
def get_tts_queue_poller_service(laravel_api_url: str = "http://localhost:8000") -> TTSQueuePollerService:
    """
    Get TTS Queue Poller Service singleton (Idempotent)

    Args:
        laravel_api_url: Laravel API base URL

    Returns:
        TTSQueuePollerService singleton instance

    Note:
        This function is idempotent - calling it multiple times
        will return the same instance.
    """
    return TTSQueuePollerService(laravel_api_url)
