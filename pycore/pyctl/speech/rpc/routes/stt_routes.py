#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
STT RPC Routes

Speech-to-Text endpoints using unified STTTaskData model.
Integrates with PyHeartbeat GlobalTaskQueue for task-based processing.

Endpoints:
- stt: Submit STT task (async/sync)
- stt.recognize: Alias for stt
"""

import uuid
from typing import Dict, Any

from pycore.pyfoundations import ColorPrint, Task, TaskPriority, get_global_task_queue
from pycore.pyfoundations.thread_bus import THREAD_BUS
from pycore.pyutils.common import STTTaskData, create_stt_task


def register_stt_routes(rpc_server, service_instances: Dict[str, Any]):
    """
    Register STT routes on RPC server

    Args:
        rpc_server: ThreadedRpcServer instance
        service_instances: Dict with service instances
    """

    def handle_stt(params: Dict, request_id: str, context: Dict) -> Dict[str, Any]:
        """
        Handle STT request - submits to GlobalTaskQueue

        Request Parameters:
            audio_file (str, optional): Path to audio file
            audio_base64 (str, optional): Base64 encoded audio data
            language (str, optional): Language code (default: zh-CN)
            provider (str, optional): STT provider - 'azure', 'local', 'auto' (default: auto)
            priority (str, optional): Task priority (default: normal)
            async (bool, optional): Async mode (default: true)

        Note: Either audio_file or audio_base64 must be provided

        Returns (async mode):
            {
                "success": true,
                "status": "accepted",
                "task_id": "...",
                "message": "Task submitted to queue"
            }

        Returns (sync mode):
            {
                "success": true,
                "text": "recognized text",
                "language": "zh-CN",
                "provider": "azure",
                "confidence": 0.95
            }
        """
        # Validate input
        audio_file = params.get('audio_file')
        audio_base64 = params.get('audio_base64')

        if not audio_file and not audio_base64:
            return {'success': False, 'error': 'audio_file or audio_base64 is required'}

        # Extract parameters
        language = params.get('language', 'zh-CN')
        provider = params.get('provider', 'auto')
        priority_str = params.get('priority', 'normal')
        async_mode = params.get('async', True)

        # Map priority
        priority_map = {
            'critical': TaskPriority.CRITICAL,
            'urgent': TaskPriority.URGENT,
            'high': TaskPriority.HIGH,
            'normal': TaskPriority.NORMAL,
            'low': TaskPriority.LOW
        }
        priority = priority_map.get(priority_str.lower(), TaskPriority.NORMAL)

        # Get client info
        client_id = context.get('client_id', 'unknown')

        # Create STTTaskData using unified model
        task_data = STTTaskData(
            audio_file=audio_file,
            audio_base64=audio_base64,
            language=language,
            provider=provider,
            request_id=request_id,
            client_id=client_id
        )

        # Create Task object
        task = create_stt_task(task_data, priority=priority)

        # Setup callbacks for sync mode
        if not async_mode:
            response_signal = f"speech.stt.response.{uuid.uuid4().hex}"
            THREAD_BUS.clear_signal(response_signal)

            def on_complete(t: Task):
                THREAD_BUS.signal(response_signal, {
                    'result': t.metadata.get('result', {}),
                    'error': None,
                })

            def on_error(t: Task):
                THREAD_BUS.signal(response_signal, {
                    'result': None,
                    'error': t.error or "Task failed",
                })

            task.callback = on_complete
            task.error_callback = on_error

        # Submit to GlobalTaskQueue
        task_queue = get_global_task_queue()
        task_queue.put(task)

        ColorPrint.blue(f"[STT] Task {task.task_id[:8]}... submitted ({priority_str}, async={async_mode})")

        # Async mode - return task ID
        if async_mode:
            return {
                'success': True,
                'status': 'accepted',
                'task_id': task.task_id,
                'message': 'Task submitted to queue'
            }

        # Sync mode - wait for completion
        ColorPrint.blue(f"[STT] Waiting for task {task.task_id[:8]}... (max 30s)")
        task_result = THREAD_BUS.wait_signal(response_signal, timeout=30.0) or {
            'result': None,
            'error': None,
        }
        THREAD_BUS.clear_signal(response_signal)

        if task_result['error']:
            return {'success': False, 'error': task_result['error']}

        if task_result['result']:
            return {'success': True, **task_result['result']}

        return {'success': False, 'error': 'Task timeout'}

    # Register routes
    rpc_server.route('stt', handle_stt)
    rpc_server.route('stt.recognize', handle_stt)

    ColorPrint.green("[STT Routes] Registered:")
    ColorPrint.blue("  - stt")
    ColorPrint.blue("  - stt.recognize")


__all__ = ['register_stt_routes']
