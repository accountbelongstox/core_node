#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RPC Manager

Encapsulates pyutils.rpc.UnifiedRpcServer to provide speech-related API endpoints.
Provides API access for text/audio conversion with multi-language support.

Features:
- Text-to-Speech (TTS) API
- Speech-to-Text (STT) API
- Multi-language support
- Batch processing (convert multiple languages at once)
- Auto-start capability
"""

import asyncio
import threading
import base64
import time
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List, Union

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pygvar import PYTOOLS_TMP_DIR
from pycore.pyutils.rpc.server.unified_server import UnifiedRpcServer
from pycore.pyutils.tts_cache import TTSCacheManager
from pycore.pyctl.speech import get_speech_manager
from pycore.pyutils.clipboard import get_clipboard_history, get_clipboard_monitor
from pycore.pyutils.config_cache import global_config_cache
from pycore.database import database_manager
from pycore.database.models import ClipboardHistoryModel, TableKeys

# PyHeartbeat task system (replaces old task_queue)
from pycore.pyfoundations import Task, TaskPriority as PyTaskPriority, get_global_task_queue
from pycore.pyutils.common import get_tts_switch, initialize_tts_switch


class RpcManager:
    """
    RPC Manager - Provides speech API via RPC server with PyHeartbeat integration

    Uses PyHeartbeat GlobalTaskQueue and TTSSwitch for task-based processing.
    Tasks are routed through HeartbeatPusher to registered handlers.

    Architecture:
        Web Request → RPC Server → GlobalTaskQueue → HeartbeatPusher → TTSSwitch → Provider → Response

    Wraps UnifiedRpcServer and registers speech-related routes:
    - /rpc/tts - Text to speech conversion (via GlobalTaskQueue)
    - /rpc/stt - Speech to text conversion (via GlobalTaskQueue)
    - /rpc/multi_tts - Convert text to multiple languages
    - /rpc/multi_stt - Convert audio to multiple languages
    - /rpc/task_status - Get task status from queue
    - /rpc/queue_stats - Get PyHeartbeat statistics

    Usage:
        from pycore.pyctl.speech.rpc import get_rpc_manager

        # Start server
        rpc_manager = get_rpc_manager(auto_start=True)

        # Or use launch_speech_rpc_service for integrated startup
        from pycore.pyctl.speech import launch_speech_rpc_service
        instances = launch_speech_rpc_service(port=59000)

        # API endpoints:
        # POST /rpc/tts - {"text": "hello", "language": "en-US", "async": true}
        # POST /rpc/stt - {"audio_path": "/path/to/file", "language": "zh-CN"}
        # GET /rpc/queue_stats - PyHeartbeat statistics
    """

    def __init__(self, port: int = 8765, host: str = "0.0.0.0", auto_start: bool = False):
        """
        Initialize RPC Manager

        Args:
            port: Server port (default: 8765)
            host: Server host (default: 0.0.0.0)
            auto_start: Auto-start server on initialization (default: False)
        """
        self.port = port
        self.host = host
        self.auto_start = auto_start

        # Initialize RPC server
        self.server = UnifiedRpcServer(options={
            'port': port,
            'host': host,
            'debug': True
        })

        # Add web interface static directory
        web_dir = Path(__file__).parent / 'web'
        self.server.add_static_dir('/web', str(web_dir))

        # Speech manager for TTS/STT operations
        self.speech_manager = get_speech_manager()
        self.speech_manager.initialize()

        # Initialize TTS cache manager with database support
        self.tts_cache_manager = TTSCacheManager(
            database_enabled=True,
            database_name="speech"
        )

        # Initialize clipboard with database support
        self.clipboard_history = get_clipboard_history()
        self.clipboard_monitor = get_clipboard_monitor(client_id="server")

        # Initialize clipboard database
        self._initialize_clipboard_database()

        # Initialize PyHeartbeat task system
        self._initialize_task_system()

        # Server state
        self._started = False
        self._server_thread: Optional[threading.Thread] = None
        self._event_loop: Optional[asyncio.AbstractEventLoop] = None

        # PyHeartbeat task queue
        self._task_queue = get_global_task_queue()
        self._tts_switch = None

        # Register routes
        self._register_routes()

        # Auto-start if enabled
        if self.auto_start:
            self.start_in_background()

    def _initialize_clipboard_database(self):
        """Initialize clipboard database"""
        # Register clipboard database
        database_manager.register_database("clipboard")

        # Load clipboard tables
        database_manager.load_tables(
            database_name="clipboard",
            table_keys=[TableKeys.CLIPBOARD_HISTORY],
            models=[ClipboardHistoryModel]
        )

        ColorPrint.green("[RpcManager] Clipboard database initialized")

    def _initialize_task_system(self):
        """Initialize PyHeartbeat task system"""
        try:
            # Initialize PyHeartbeat system
            from pycore.pyheartbeat import initialize_heartbeat_system
            heartbeat_system = initialize_heartbeat_system()
            heartbeat_system.start()

            # Initialize TTSSwitch with PyHeartbeat integration
            self._tts_switch = initialize_tts_switch(
                max_queue_size=50,
                default_provider='edge',
                register_heartbeat=True  # Register with GlobalThreadPool
            )

            ColorPrint.green("[RpcManager] PyHeartbeat task system initialized")
            ColorPrint.blue(f"  TTS providers: {self._tts_switch.get_available_providers()}")
        except Exception as e:
            ColorPrint.red(f"[RpcManager] Failed to initialize PyHeartbeat: {e}")
            import traceback
            traceback.print_exc()

    def _on_task_completed(self, task):
        """
        Task completion callback (called by task queue)

        Pushes WebSocket event to notify client when task completes.
        Uses state-based checking instead of exception handling.

        Args:
            task: Completed Task object
        """
        # Extract client_id from task metadata
        client_id = task.metadata.get('client_id') if task.metadata else None

        if not client_id:
            # No client_id means no WebSocket push needed
            return

        # Prepare event data
        event_data = {
            'task_id': task.task_id,
            'type': task.task_type.value.upper(),
            'status': task.status.value,
            'duration': task.get_duration() if hasattr(task, 'get_duration') else 0
        }

        # Add result data
        if task.status.value == 'completed' and task.result:
            event_data['data'] = task.result.data if hasattr(task.result, 'data') else task.result
            event_data['error'] = None
        elif task.status.value == 'failed':
            event_data['data'] = None
            event_data['error'] = task.error or 'Task failed'
        else:
            event_data['data'] = None
            event_data['error'] = task.error

        # Prepare message
        message = {
            'type': 'event',  # RPC WebSocket event type
            'event': 'task_completed',
            'id': task.task_id,
            'data': event_data
        }

        # ✅ NEW: Use ClientManager.safe_send() with state checking (NO TRY-EXCEPT)
        async def send_notification():
            """Send WebSocket notification using state-based checking"""
            ColorPrint.blue(
                f"[RpcManager] Pushing task completion event to client {client_id[:8]}... "
                f"(task={task.task_id[:8]}, status={task.status.value})"
            )

            # Use ClientManager's safe_send - it handles all state checks internally
            # Queue message if client is RECONNECTING (they might come back!)
            success = await self.server.client_manager.safe_send(
                client_id=client_id,
                message=message,
                queue_if_disconnected=True  # Queue for reconnecting clients
            )

            if success:
                ColorPrint.green(
                    f"[RpcManager] Successfully pushed event for task {task.task_id[:8]}"
                )
            else:
                # safe_send returns False if client not CONNECTED
                # If RECONNECTING, message was queued
                # No exception thrown - just log
                client = self.server.client_manager.get_client(client_id)
                if client and client.status.value == 'reconnecting':
                    ColorPrint.yellow(
                        f"[RpcManager] Client {client_id[:8]} reconnecting, "
                        f"message queued (queue size: {len(client.pending_messages)})"
                    )
                else:
                    ColorPrint.yellow(
                        f"[RpcManager] Could not send to client {client_id[:8]} "
                        f"(not connected or WebSocket closed)"
                    )

        # Schedule async send
        import asyncio
        try:
            asyncio.create_task(send_notification())
        except RuntimeError:
            # Event loop not running - try to get loop
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    loop.create_task(send_notification())
                else:
                    ColorPrint.yellow(
                        f"[RpcManager] Event loop not running, cannot send notification"
                    )
            except Exception as e:
                ColorPrint.red(f"[RpcManager] Cannot create async task: {e}")

    def _register_routes(self):
        """Register all API routes"""
        # Speech routes (queue-based)
        self.server.route('tts', self._handle_tts_queue)
        self.server.route('stt', self._handle_stt_queue)
        self.server.route('multi_tts', self._handle_multi_tts)
        self.server.route('multi_stt', self._handle_multi_stt)

        # Task management routes
        self.server.route('task_status', self._handle_task_status)
        self.server.route('queue_stats', self._handle_queue_stats)

        # Clipboard routes
        self.server.route('clipboard_add', self._handle_clipboard_add)
        self.server.route('clipboard_get', self._handle_clipboard_get)
        self.server.route('clipboard_search', self._handle_clipboard_search)
        self.server.route('clipboard_sync', self._handle_clipboard_sync)

        # Config routes
        self.server.route('config_get', self._handle_config_get)
        self.server.route('config_set', self._handle_config_set)

        # Status route
        self.server.route('status', self._handle_status)

        ColorPrint.blue("[RpcManager] Registered API routes")
        ColorPrint.blue("  - Speech: tts, stt, multi_tts, multi_stt")
        ColorPrint.blue("  - Clipboard: clipboard_add, clipboard_get, clipboard_search, clipboard_sync")
        ColorPrint.blue("  - Config: config_get, config_set")
        ColorPrint.blue("  - Status: status")

    @staticmethod
    def _sanitize_for_json(data):
        """
        Sanitize data for JSON serialization (convert datetime to timestamps)

        Args:
            data: Data to sanitize (dict, list, or primitive)

        Returns:
            JSON-serializable data
        """
        if isinstance(data, dict):
            return {key: RpcManager._sanitize_for_json(value) for key, value in data.items()}
        elif isinstance(data, list):
            return [RpcManager._sanitize_for_json(item) for item in data]
        elif isinstance(data, datetime):
            return data.timestamp()
        else:
            return data

    @staticmethod
    def create_response(
        success: bool = True,
        data: Any = None,
        error: Optional[str] = None,
        message: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Create unified response wrapper for all API endpoints

        Args:
            success: Whether the operation succeeded
            data: Response data (will be sanitized for JSON)
            error: Error message (if failed)
            message: Success message (optional)
            **kwargs: Additional fields to include in response

        Returns:
            Standardized response dictionary:
            {
                "success": bool,
                "data": any (sanitized for JSON),
                "error": str (if failed),
                "message": str (optional),
                "timestamp": float,
                ...additional kwargs
            }
        """
        response = {
            'success': success,
            'timestamp': time.time()
        }

        # Add data (sanitized)
        if data is not None:
            response['data'] = RpcManager._sanitize_for_json(data)

        # Add error
        if error is not None:
            response['error'] = error
            response['success'] = False  # Force success to False if error exists

        # Add message
        if message is not None:
            response['message'] = message

        # Add additional fields
        response.update(kwargs)

        return response

    @staticmethod
    def create_error(error: str, **kwargs) -> Dict[str, Any]:
        """
        Create error response (shorthand for create_response with success=False)

        Args:
            error: Error message
            **kwargs: Additional fields

        Returns:
            Error response dictionary
        """
        return RpcManager.create_response(success=False, error=error, **kwargs)

    @staticmethod
    def create_success(data: Any = None, message: Optional[str] = None, **kwargs) -> Dict[str, Any]:
        """
        Create success response (shorthand for create_response with success=True)

        Args:
            data: Response data
            message: Success message
            **kwargs: Additional fields

        Returns:
            Success response dictionary
        """
        return RpcManager.create_response(success=True, data=data, message=message, **kwargs)

    def _handle_tts_queue(self, params: Dict, request_id: str, context: Dict) -> Dict[str, Any]:
        """
        Handle TTS request using PyHeartbeat GlobalTaskQueue

        Args:
            params: {
                "text": str - Text to synthesize
                "language": str - Language code (default: zh-CN)
                "voice": str - Voice name (optional)
                "provider": str - TTS provider (default: edge)
                "return_base64": bool - Return audio as base64 (default: True)
                "async": bool - Async mode (default: True)
                "priority": str - Task priority: LOW, NORMAL, HIGH, URGENT (default: NORMAL)
            }
            request_id: Request ID
            context: Request context

        Returns:
            Async mode: {"task_id": str, "status": "pending"}
            Sync mode: {"success": bool, "audio_base64": str, ...}
        """
        text = params.get('text', '')
        language = params.get('language', 'zh-CN')
        voice = params.get('voice')
        provider = params.get('provider', 'edge')
        return_base64 = params.get('return_base64', True)
        async_mode = params.get('async', True)
        priority_str = params.get('priority', 'NORMAL')

        if not text:
            return self.create_error('Text is required', error_code='MISSING_PARAM')

        # Parse priority (PyHeartbeat TaskPriority)
        priority_map = {
            'LOW': PyTaskPriority.LOW,
            'NORMAL': PyTaskPriority.NORMAL,
            'HIGH': PyTaskPriority.HIGH,
            'URGENT': PyTaskPriority.URGENT
        }
        priority = priority_map.get(priority_str.upper(), PyTaskPriority.NORMAL)

        # Create completion callback for sync mode
        completed_event = threading.Event()
        task_result = {'result': None, 'error': None}

        def on_complete(task: Task):
            task_result['result'] = task.metadata.get('result', {})
            self._on_task_completed(task)  # WebSocket push
            completed_event.set()

        def on_error(task: Task):
            task_result['error'] = task.error_message or "Task failed"
            self._on_task_completed(task)  # WebSocket push
            completed_event.set()

        # Create PyHeartbeat Task
        task = Task(
            task_type='tts',
            task_data={
                'text': text,
                'language': language,
                'voice': voice,
                'provider': provider,
                'return_base64': return_base64,
                'request_id': request_id
            },
            priority=priority,
            callback=on_complete if not async_mode else on_complete,  # Always notify WebSocket
            error_callback=on_error if not async_mode else on_error
        )

        # Store client_id for WebSocket push
        client_id = context.get('client_id')
        if client_id:
            task.metadata['client_id'] = client_id

        # Submit to GlobalTaskQueue (HeartbeatPusher will route to TTSSwitch)
        self._task_queue.put(task)

        # Async mode - return task_id immediately
        if async_mode:
            return self.create_success(
                data={'task_id': task.task_id},
                message='Task submitted to PyHeartbeat queue',
                status='pending'
            )

        # Sync mode - wait for completion
        if completed_event.wait(timeout=30.0):
            if task_result['error']:
                return self.create_error(
                    task_result['error'],
                    error_code='TASK_FAILED',
                    task_id=task.task_id
                )
            if task_result['result']:
                result_data = task_result['result']
                result_data['task_id'] = task.task_id
                return self.create_success(data=result_data)

        return self.create_error('Task timeout', error_code='TIMEOUT', task_id=task.task_id)

    def _handle_stt_queue(self, params: Dict, request_id: str, context: Dict) -> Dict[str, Any]:
        """
        Handle STT request using PyHeartbeat GlobalTaskQueue

        Args:
            params: {
                "audio": str - Base64 encoded audio (optional)
                "audio_path": str - Path to audio file (optional)
                "language": str - Language code (default: zh-CN)
                "provider": str - STT provider (optional)
                "async": bool - Async mode (default: True)
                "priority": str - Task priority (default: NORMAL)
            }
            request_id: Request ID
            context: Request context

        Returns:
            Async mode: {"task_id": str, "status": "pending"}
            Sync mode: {"success": bool, "text": str, ...}
        """
        audio_data = params.get('audio')
        audio_path = params.get('audio_path')
        language = params.get('language', 'zh-CN')
        provider = params.get('provider')
        async_mode = params.get('async', True)
        priority_str = params.get('priority', 'NORMAL')

        if not audio_data and not audio_path:
            return self.create_error(
                'Either audio or audio_path is required',
                error_code='MISSING_PARAM'
            )

        # Parse priority (PyHeartbeat TaskPriority)
        priority_map = {
            'LOW': PyTaskPriority.LOW,
            'NORMAL': PyTaskPriority.NORMAL,
            'HIGH': PyTaskPriority.HIGH,
            'URGENT': PyTaskPriority.URGENT
        }
        priority = priority_map.get(priority_str.upper(), PyTaskPriority.NORMAL)

        # Create completion callback
        completed_event = threading.Event()
        task_result = {'result': None, 'error': None}

        def on_complete(task: Task):
            task_result['result'] = task.metadata.get('result', {})
            self._on_task_completed(task)
            completed_event.set()

        def on_error(task: Task):
            task_result['error'] = task.error_message or "Task failed"
            self._on_task_completed(task)
            completed_event.set()

        # Create PyHeartbeat Task
        task = Task(
            task_type='stt',
            task_data={
                'audio_data': audio_data,
                'audio_path': audio_path,
                'language': language,
                'provider': provider,
                'request_id': request_id
            },
            priority=priority,
            callback=on_complete,
            error_callback=on_error
        )

        # Store client_id for WebSocket push
        client_id = context.get('client_id')
        if client_id:
            task.metadata['client_id'] = client_id

        # Submit to GlobalTaskQueue
        self._task_queue.put(task)

        # Async mode - return task_id immediately
        if async_mode:
            return self.create_success(
                data={'task_id': task.task_id},
                message='Task submitted to PyHeartbeat queue',
                status='pending'
            )

        # Sync mode - wait for completion
        if completed_event.wait(timeout=30.0):
            if task_result['error']:
                return self.create_error(
                    task_result['error'],
                    error_code='TASK_FAILED',
                    task_id=task.task_id
                )
            if task_result['result']:
                result_data = task_result['result']
                result_data['task_id'] = task.task_id
                return self.create_success(data=result_data)

        return self.create_error('Task timeout', error_code='TIMEOUT', task_id=task.task_id)

    def _handle_task_status(self, params: Dict, request_id: str, context: Dict) -> Dict[str, Any]:
        """
        Get task status from GlobalTaskQueue

        Args:
            params: {
                "task_id": str - Task ID
            }

        Returns:
            Task status information
        """
        task_id = params.get('task_id')

        if not task_id:
            return self.create_error('Task ID is required', error_code='MISSING_PARAM')

        task = self._task_queue.get_task(task_id)

        if not task:
            return self.create_error('Task not found', error_code='TASK_NOT_FOUND')

        # Convert Task to dict
        task_status = task.to_dict()
        return self.create_success(data=task_status)

    def _handle_queue_stats(self, params: Dict, request_id: str, context: Dict) -> Dict[str, Any]:
        """
        Get PyHeartbeat queue statistics

        Returns:
            Queue and heartbeat statistics
        """
        from pycore.pyheartbeat import get_heartbeat_system
        from pycore.pyfoundations import ENCYCLOPEDIA
        from pycore.pyheartbeat import THREAD_POOL_THREADS_KEY

        heartbeat_system = get_heartbeat_system()
        stats = heartbeat_system.get_stats() if heartbeat_system else {}

        # Add TTSSwitch status
        tts_switch_status = self._tts_switch.get_status() if self._tts_switch else {}

        # Add Encyclopedia data
        threads_data = ENCYCLOPEDIA.get(THREAD_POOL_THREADS_KEY) or {}

        return self.create_success(data={
            'heartbeat': stats,
            'tts_switch': tts_switch_status,
            'thread_pool': threads_data,
            'queue_size': self._task_queue.size()
        })

    def _handle_tts(self, params: Dict, request_id: str, context: Dict) -> Dict[str, Any]:
        """
        Handle TTS (Text-to-Speech) request

        Args:
            params: {
                "text": str - Text to synthesize
                "language": str - Language code (default: zh-CN)
                "voice": str - Voice name (optional)
                "provider": str - TTS provider (default: edge)
                "return_base64": bool - Return audio as base64 (default: True)
            }
            request_id: Request ID
            context: Request context

        Returns:
            {
                "success": bool,
                "audio_base64": str (if return_base64=True),
                "audio_path": str (if return_base64=False),
                "language": str,
                "provider": str,
                "error": str (if failed)
            }
        """
        text = params.get('text', '')
        language = params.get('language', 'zh-CN')
        voice = params.get('voice')
        provider = params.get('provider', 'edge')
        return_base64 = params.get('return_base64', True)

        if not text:
            return {
                'success': False,
                'error': 'Text is required'
            }

        # Get cache path
        output_file = self.tts_cache_manager.get_cache_path(provider, text, language)

        # Check cache first
        if output_file.exists():
            ColorPrint.green(f"[RpcManager] TTS cache hit: {output_file.name}")
        else:
            # Synthesize
            success = self.speech_manager.synthesize_to_file(
                text=text,
                output_file=output_file,
                voice=voice,
                provider=provider,
                language=language,
                use_cache=True
            )

            if not success:
                ColorPrint.red("[RpcManager] TTS synthesis failed")
                return {
                    'success': False,
                    'error': 'TTS synthesis failed'
                }

        # Check if file exists after synthesis
        if not output_file.exists():
            ColorPrint.red(f"[RpcManager] Output file not found: {output_file}")
            return {
                'success': False,
                'error': 'Output file not generated'
            }

        # Return result
        result = {
            'success': True,
            'language': language,
            'provider': provider
        }

        if return_base64:
            # Read file and encode as base64
            with open(output_file, 'rb') as f:
                audio_data = f.read()
            result['audio_base64'] = base64.b64encode(audio_data).decode('utf-8')
        else:
            result['audio_path'] = str(output_file)

        return result

    def _handle_stt(self, params: Dict, request_id: str, context: Dict) -> Dict[str, Any]:
        """
        Handle STT (Speech-to-Text) request

        Args:
            params: {
                "audio": str - Base64 encoded audio data (optional)
                "audio_path": str - Path to audio file (optional)
                "language": str - Language code (default: zh-CN)
                "provider": str - STT provider (optional)
            }
            request_id: Request ID
            context: Request context

        Returns:
            {
                "success": bool,
                "text": str,
                "confidence": float,
                "language": str,
                "provider": str,
                "error": str (if failed)
            }
        """
        audio_base64 = params.get('audio')
        audio_path = params.get('audio_path')
        language = params.get('language', 'zh-CN')
        provider = params.get('provider')

        if not audio_base64 and not audio_path:
            return {
                'success': False,
                'error': 'Either audio or audio_path is required'
            }

        # If audio is base64, decode and save to temp file
        temp_file_created = False
        if audio_base64:
            audio_data = base64.b64decode(audio_base64)
            with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as f:
                f.write(audio_data)
                audio_path = f.name
                temp_file_created = True

        # Recognize speech
        result = self.speech_manager.recognize_from_file(
            audio_file=audio_path,
            language=language,
            provider=provider
        )

        # Clean up temp file if created
        if temp_file_created and audio_path:
            temp_path = Path(audio_path)
            if temp_path.exists():
                temp_path.unlink()

        return result

    def _handle_multi_tts(self, params: Dict, request_id: str, context: Dict) -> Dict[str, Any]:
        """
        Handle multi-language TTS request

        Args:
            params: {
                "text": str - Text to synthesize
                "languages": list[str] - Language codes
                "provider": str - TTS provider (default: edge)
                "return_base64": bool - Return audio as base64 (default: True)
            }
            request_id: Request ID
            context: Request context

        Returns:
            {
                "success": bool,
                "results": {
                    "zh-CN": {"success": bool, "audio_base64": str, ...},
                    "en-US": {"success": bool, "audio_base64": str, ...},
                    ...
                },
                "error": str (if failed)
            }
        """
        text = params.get('text', '')
        languages = params.get('languages', [])
        provider = params.get('provider', 'edge')
        return_base64 = params.get('return_base64', True)

        if not text:
            return {
                'success': False,
                'error': 'Text is required'
            }

        if not languages:
            return {
                'success': False,
                'error': 'Languages list is required'
            }

        results = {}

        # Process each language
        for language in languages:
            tts_result = self._handle_tts(
                params={
                    'text': text,
                    'language': language,
                    'provider': provider,
                    'return_base64': return_base64
                },
                request_id=f"{request_id}_{language}",
                context=context
            )
            results[language] = tts_result

        return {
            'success': True,
            'results': results
        }

    def _handle_multi_stt(self, params: Dict, request_id: str, context: Dict) -> Dict[str, Any]:
        """
        Handle multi-language STT request

        Args:
            params: {
                "audio": str - Base64 encoded audio data (optional)
                "audio_path": str - Path to audio file (optional)
                "languages": list[str] - Language codes
                "provider": str - STT provider (optional)
            }
            request_id: Request ID
            context: Request context

        Returns:
            {
                "success": bool,
                "results": {
                    "zh-CN": {"success": bool, "text": str, ...},
                    "en-US": {"success": bool, "text": str, ...},
                    ...
                },
                "error": str (if failed)
            }
        """
        audio_base64 = params.get('audio')
        audio_path = params.get('audio_path')
        languages = params.get('languages', [])
        provider = params.get('provider')

        if not audio_base64 and not audio_path:
            return {
                'success': False,
                'error': 'Either audio or audio_path is required'
            }

        if not languages:
            return {
                'success': False,
                'error': 'Languages list is required'
            }

        results = {}

        # Process each language
        for language in languages:
            stt_result = self._handle_stt(
                params={
                    'audio': audio_base64,
                    'audio_path': audio_path,
                    'language': language,
                    'provider': provider
                },
                request_id=f"{request_id}_{language}",
                context=context
            )
            results[language] = stt_result

        return {
            'success': True,
            'results': results
        }

    def _handle_status(self, params: Dict, request_id: str, context: Dict) -> Dict[str, Any]:
        """
        Handle status request

        Returns:
            {
                "server_running": bool,
                "speech_status": dict,
                "clipboard_stats": dict,
                "available_routes": list[str],
                "supported_languages": list[str]
            }
        """
        # Get clipboard stats
        clipboard_stats = {}
        with database_manager.get_connection("clipboard") as conn:
            clipboard_stats = ClipboardHistoryModel.get_statistics(conn)

        return {
            'server_running': self._started,
            'speech_status': self.speech_manager.get_status(),
            'clipboard_stats': clipboard_stats,
            'available_routes': [
                'tts', 'stt', 'multi_tts', 'multi_stt',
                'clipboard_add', 'clipboard_get', 'clipboard_search', 'clipboard_sync',
                'config_get', 'config_set', 'status'
            ],
            'supported_languages': [
                'zh-CN', 'en-US', 'ja-JP', 'ko-KR', 'lo-LA'  # Added Lao
            ]
        }

    def _handle_clipboard_add(self, params: Dict, request_id: str, context: Dict) -> Dict[str, Any]:
        """
        Add item to clipboard history

        Args:
            params: {
                "content": str - Clipboard content
                "client_id": str - Client identifier (optional)
                "content_type": str - Content type: text, file, image (default: text)
                "file_path": str - File path (optional)
                "file_name": str - File name (optional)
            }

        Returns:
            {
                "success": bool,
                "item_id": int,
                "error": str (if failed)
            }
        """
        content = params.get('content', '')
        client_id = params.get('client_id', 'unknown')
        content_type = params.get('content_type', 'text')
        file_path = params.get('file_path')
        file_name = params.get('file_name')
        file_size = params.get('file_size')

        if not content:
            return {
                'success': False,
                'error': 'Content is required'
            }

        with database_manager.get_connection("clipboard") as conn:
            item_id = ClipboardHistoryModel.add_clipboard_item(
                conn,
                content=content,
                client_id=client_id,
                content_type=content_type,
                file_path=file_path,
                file_name=file_name,
                file_size=file_size
            )

        if item_id is None:
            return {
                'success': False,
                'error': 'Duplicate item (skipped)'
            }

        return {
            'success': True,
            'item_id': item_id
        }

    def _handle_clipboard_get(self, params: Dict, request_id: str, context: Dict) -> Dict[str, Any]:
        """
        Get clipboard history

        Args:
            params: {
                "limit": int - Maximum items to return (default: 50)
                "client_id": str - Filter by client ID (optional)
                "content_type": str - Filter by content type (optional)
            }

        Returns:
            {
                "success": bool,
                "items": list[dict],
                "error": str (if failed)
            }
        """
        limit = params.get('limit', 50)
        client_id = params.get('client_id')
        content_type = params.get('content_type')

        with database_manager.get_connection("clipboard") as conn:
            items = ClipboardHistoryModel.get_recent_items(
                conn,
                limit=limit,
                client_id=client_id,
                content_type=content_type
            )

        return {
            'success': True,
            'items': self._sanitize_for_json(items)
        }

    def _handle_clipboard_search(self, params: Dict, request_id: str, context: Dict) -> Dict[str, Any]:
        """
        Search clipboard history

        Args:
            params: {
                "query": str - Search query
                "limit": int - Maximum results (default: 20)
                "client_id": str - Filter by client ID (optional)
            }

        Returns:
            {
                "success": bool,
                "items": list[dict],
                "error": str (if failed)
            }
        """
        query = params.get('query', '')
        limit = params.get('limit', 20)
        client_id = params.get('client_id')

        if not query:
            return {
                'success': False,
                'error': 'Query is required'
            }

        with database_manager.get_connection("clipboard") as conn:
            items = ClipboardHistoryModel.search_items(
                conn,
                query=query,
                limit=limit,
                client_id=client_id
            )

        return {
            'success': True,
            'items': self._sanitize_for_json(items)
        }

    def _handle_clipboard_sync(self, params: Dict, request_id: str, context: Dict) -> Dict[str, Any]:
        """
        Sync clipboard (get updates since timestamp)

        Args:
            params: {
                "since": float - Unix timestamp
                "client_id": str - Client identifier (optional)
            }

        Returns:
            {
                "success": bool,
                "items": list[dict],
                "server_time": float
            }
        """
        since = params.get('since', 0.0)
        client_id = params.get('client_id')

        with database_manager.get_connection("clipboard") as conn:
            items = ClipboardHistoryModel.get_items_since(
                conn,
                timestamp=since,
                client_id=client_id
            )

        return {
            'success': True,
            'items': self._sanitize_for_json(items),
            'server_time': time.time()
        }

    def _handle_config_get(self, params: Dict, request_id: str, context: Dict) -> Dict[str, Any]:
        """
        Get configuration

        Args:
            params: {
                "key": str - Config key (optional, returns all if not specified)
            }

        Returns:
            {
                "success": bool,
                "config": dict or value,
                "error": str (if failed)
            }
        """
        try:
            key = params.get('key')

            if key:
                # Get specific key
                value = global_config_cache.get(key)
                if value is None and not global_config_cache.has_key(key):
                    return {
                        'success': False,
                        'error': f'Config key "{key}" not found'
                    }
                return {
                    'success': True,
                    'config': value
                }
            else:
                # Get all config
                return {
                    'success': True,
                    'config': global_config_cache.get_all()
                }
        except Exception as e:
            ColorPrint.red(f"[RpcManager] Config get error: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def _handle_config_set(self, params: Dict, request_id: str, context: Dict) -> Dict[str, Any]:
        """
        Set configuration

        Args:
            params: {
                "key": str - Config key
                "value": any - Config value
            }

        Returns:
            {
                "success": bool,
                "error": str (if failed)
            }
        """
        try:
            key = params.get('key')
            value = params.get('value')

            if not key:
                return {
                    'success': False,
                    'error': 'Key is required'
                }

            # Set config value
            success = global_config_cache.set(key, value)

            if success:
                return {
                    'success': True,
                    'message': f'Config {key} set successfully'
                }
            else:
                return {
                    'success': False,
                    'error': 'Failed to save configuration'
                }
        except Exception as e:
            ColorPrint.red(f"[RpcManager] Config set error: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def start_in_background(self):
        """Start RPC server in background thread"""
        if self._started:
            ColorPrint.yellow("[RpcManager] Server already started")
            return

        def run_server():
            """Run server in event loop"""
            self._event_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self._event_loop)

            self._event_loop.run_until_complete(self.server.start())
            self._started = True

            # Keep loop running
            self._event_loop.run_forever()

        self._server_thread = threading.Thread(target=run_server, daemon=True)
        self._server_thread.start()

        # Wait a bit for server to start
        time.sleep(0.5)

        ColorPrint.green(f"[RpcManager] Server started on {self.host}:{self.port}")
        ColorPrint.blue(f"[RpcManager] HTTP API: http://{self.host}:{self.port}/api/<route>")
        ColorPrint.blue(f"[RpcManager] WebSocket: ws://{self.host}:{self.port}/rpc/ws")

    async def start(self):
        """Start RPC server (async)"""
        if self._started:
            ColorPrint.yellow("[RpcManager] Server already started")
            return

        await self.server.start()
        self._started = True

    async def stop(self):
        """Stop RPC server"""
        if not self._started:
            return

        await self.server.stop()
        self._started = False

        if self._event_loop and self._event_loop.is_running():
            self._event_loop.stop()

    def is_running(self) -> bool:
        """Check if server is running"""
        return self._started


# Global singleton instance
_global_rpc_manager: Optional[RpcManager] = None
_manager_lock = threading.Lock()


def get_rpc_manager(port: int = 8765, host: str = "0.0.0.0", auto_start: bool = False) -> RpcManager:
    """
    Get global RPC manager singleton instance

    Args:
        port: Server port (default: 8765)
        host: Server host (default: 0.0.0.0)
        auto_start: Auto-start server (default: False)

    Returns:
        RpcManager instance
    """
    global _global_rpc_manager
    with _manager_lock:
        if _global_rpc_manager is None:
            _global_rpc_manager = RpcManager(port=port, host=host, auto_start=auto_start)
        return _global_rpc_manager
