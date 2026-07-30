#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TTS RPC Routes

Text-to-Speech endpoints using unified TTSTaskData model.
Integrates with PyHeartbeat GlobalTaskQueue for task-based processing.

Endpoints:
- tts: Submit TTS task (async/sync)
- tts.synthesize: Alias for tts
"""

import uuid
from typing import Dict, Any

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.tasks import Task, TaskPriority
from pycore.pyfoundations.tasks import get_global_task_queue
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.speech_task_models import TTSTaskData, create_tts_task


def register_tts_routes(rpc_server, service_instances: Dict[str, Any]):
    """
    Register TTS routes on RPC server

    Args:
        rpc_server: HttpServerRunner instance
        service_instances: Dict with 'tts_switch', 'stt_switch', etc.
    """

    def handle_tts(params: Dict, request_id: str, context: Dict) -> Dict[str, Any]:
        """
        Handle TTS request - submits to GlobalTaskQueue

        Request Parameters:
            text (str, required): Text to synthesize
            language (str, optional): Language code (default: zh-CN)
            voice (str, optional): Voice name (auto-selected if not provided)
            provider (str, optional): TTS provider - 'edge', 'azure', 'both' (default: edge)
            return_base64 (bool, optional): Return audio as base64 (default: false)
            enable_cache (bool, optional): Use cache if available (default: true)
            priority (str, optional): Task priority - 'high', 'normal', 'low' (default: normal)
            async (bool, optional): Async mode (default: true)

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
                "audio_file": "/path/to/audio.mp3",
                "audio_base64": "...",  # if return_base64=true
                "language": "zh-CN",
                "provider": "edge",
                "voice": "zh-CN-XiaoxiaoNeural",
                "cached": false,
                "file_size": 48000
            }
        """
        # Validate required parameters
        text = params.get('text', '').strip()
        if not text:
            return {'success': False, 'error': 'text is required'}

        # Extract parameters
        language = params.get('language', 'zh-CN')
        voice = params.get('voice')
        provider = params.get('provider', 'edge')
        return_base64 = params.get('return_base64', False)
        enable_cache = params.get('enable_cache', True)
        priority_str = params.get('priority', 'normal')
        async_mode = params.get('async', True)

        # Map priority string to TaskPriority enum
        priority_map = {
            'critical': TaskPriority.CRITICAL,
            'urgent': TaskPriority.URGENT,
            'high': TaskPriority.HIGH,
            'normal': TaskPriority.NORMAL,
            'low': TaskPriority.LOW
        }
        priority = priority_map.get(priority_str.lower(), TaskPriority.NORMAL)

        # Get client info from context
        client_id = context.get('client_id', 'unknown')

        # Create TTSTaskData using unified model
        task_data = TTSTaskData(
            text=text,
            language=language,
            voice=voice,
            provider=provider,
            return_base64=return_base64,
            enable_cache=enable_cache,
            request_id=request_id,
            client_id=client_id
        )

        # Create Task object
        task = create_tts_task(task_data, priority=priority)

        # Setup callbacks for sync mode
        if not async_mode:
            response_signal = f"speech.tts.response.{uuid.uuid4().hex}"
            response_guard = f"{response_signal}.waiting"
            THREAD_BUS.signal(response_guard, True)

            def on_complete(t: Task):
                THREAD_BUS.signal_if_present(
                    response_guard,
                    response_signal,
                    {
                        'result': t.metadata.get('result', {}),
                        'error': None,
                    },
                )

            def on_error(t: Task):
                THREAD_BUS.signal_if_present(
                    response_guard,
                    response_signal,
                    {
                        'result': None,
                        'error': t.error or "Task failed",
                    },
                )

            task.callback = on_complete
            task.error_callback = on_error

        # Submit to GlobalTaskQueue
        # HeartbeatPusher will route to the unified SpeechSwitch
        task_queue = get_global_task_queue()
        task_queue.put(task)

        ColorPrint.blue(f"[TTS] Task {task.task_id[:8]}... submitted ({priority_str}, async={async_mode})")

        # Async mode - return task ID immediately
        if async_mode:
            return {
                'success': True,
                'status': 'accepted',
                'task_id': task.task_id,
                'message': 'Task submitted to queue'
            }

        # Sync mode - wait for completion
        ColorPrint.blue(f"[TTS] Waiting for task {task.task_id[:8]}... (max 30s)")
        task_result = THREAD_BUS.wait_signal(response_signal, timeout=30.0) or {
            'result': None,
            'error': None,
        }
        THREAD_BUS.clear_signal(response_signal)

        if task_result['error']:
            return {'success': False, 'error': task_result['error']}

        if task_result['result']:
            # Return the result data directly
            return {'success': True, **task_result['result']}

        return {'success': False, 'error': 'Task timeout'}

    # Register routes
    rpc_server.post('tts', handle_tts)
    rpc_server.post('tts/synthesize', handle_tts)

    ColorPrint.green("[TTS Routes] Registered:")
    ColorPrint.blue("  - tts")
    ColorPrint.blue("  - tts.synthesize")


__all__ = ['register_tts_routes']
