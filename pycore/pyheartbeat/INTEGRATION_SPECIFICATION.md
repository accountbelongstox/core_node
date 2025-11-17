# PyHeartbeat Integration Specification

## Overview

This document specifies how to integrate PyHeartbeat with existing subsystems:
- **pyutils/rpc** - Web/WebSocket RPC server
- **pyutils/edge_tts** - Text-to-Speech synthesis
- **pyutils/speech_recognition** - Speech-to-Text recognition
- **pyctl/speech** - High-level speech orchestration

## Architecture: Web Request → Queue → Heartbeat → Thread → Response

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Client (Browser/App)                                │
│                                                                             │
│   POST /rpc/tts                    WebSocket message                        │
│   {text: "Hello", voice: "zh-CN"}  {type: "request", route: "stt", ...}   │
└─────────────┬───────────────────────────────┬───────────────────────────────┘
              │ HTTP                          │ WebSocket
              ▼                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       UnifiedRpcServer (async aiohttp)                      │
│                                                                             │
│   1. Receive request                                                        │
│   2. Create RequestEvent in RequestEventTable                               │
│   3. Create Task with request_id as correlation                             │
│   4. Submit Task to GlobalTaskQueue                                         │
│   5. Return "accepted" status immediately                                   │
└─────────────┬───────────────────────────────────────────────────────────────┘
              │ task.put()
              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GlobalTaskQueue (pyfoundations)                          │
│                                                                             │
│   Thread-safe priority queue                                                │
│   Task {                                                                    │
│       task_id: "uuid",                                                      │
│       task_type: "tts" | "stt" | "translate",                              │
│       task_data: {text, voice, request_id, client_id},                     │
│       priority: HIGH | NORMAL | LOW,                                        │
│       callback: update_request_event_table                                  │
│   }                                                                         │
└─────────────┬───────────────────────────────────────────────────────────────┘
              │ heartbeat tick (1s)
              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      HeartbeatPusher (1-second loop)                        │
│                                                                             │
│   1. Poll GlobalTaskQueue                                                   │
│   2. Get task.task_type (e.g., "tts")                                      │
│   3. Look up handlers in GlobalThreadPool                                   │
│   4. Call handler_fn(task) for matching threads                            │
│   5. If accepted (True), task dispatched                                   │
│   6. If rejected (False), requeue task                                     │
└─────────────┬───────────────────────────────────────────────────────────────┘
              │ handler_fn(task)
              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                GlobalThreadPool + Encyclopedia                              │
│                                                                             │
│   Registered Threads:                                                       │
│   - "tts_worker" -> task_handlers: {"tts": accept_tts}                     │
│   - "stt_worker" -> task_handlers: {"stt": accept_stt}                     │
│   - "translate_worker" -> task_handlers: {"translate": accept_translate}   │
│                                                                             │
│   State synced to Encyclopedia:                                             │
│   - heartbeat.thread_pool.threads                                          │
│   - heartbeat.thread_pool.task_type_handlers                               │
└─────────────┬───────────────────────────────────────────────────────────────┘
              │ process task
              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Worker Threads                                         │
│                                                                             │
│   TTSWorkerThread / STTWorkerThread:                                       │
│   1. Accept task from heartbeat (handler_fn returns True)                  │
│   2. Process task (synthesize/recognize)                                   │
│   3. Mark task completed with result                                       │
│   4. Call task.callback() - updates RequestEventTable                      │
│   5. Update heartbeat                                                       │
└─────────────┬───────────────────────────────────────────────────────────────┘
              │ task.callback()
              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    RequestEventTable Update                                 │
│                                                                             │
│   - Status: PROCESSING → COMPLETED                                          │
│   - Result: {audio_path, text, confidence, ...}                            │
│   - Trigger notification                                                    │
└─────────────┬───────────────────────────────────────────────────────────────┘
              │ notify
              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                  Client Notification                                        │
│                                                                             │
│   HTTP: Client polls /rpc/query/{request_id}                               │
│         Returns result from RequestEventTable                              │
│                                                                             │
│   WebSocket: Server pushes notification via AckManager                     │
│              {type: "response", id: request_id, result: {...}}             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Core Integration Layer

#### 1.1 RPC-to-Queue Bridge

Create a bridge that connects RPC route handlers to GlobalTaskQueue.

**File: `pycore/pyutils/rpc/server/heartbeat_bridge.py`**

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RPC-Heartbeat Bridge

Bridges RPC requests to PyHeartbeat GlobalTaskQueue.
"""

import asyncio
from typing import Dict, Any, Optional, Callable
from pycore.pyfoundations import Task, TaskPriority, get_global_task_queue
from pycore.pyutils.rpc.common.request_event_table import RequestEventTable, RequestStatus


class RPCHeartbeatBridge:
    """
    Bridge between RPC server and PyHeartbeat system

    Converts RPC requests into tasks for the heartbeat queue.
    """

    def __init__(
        self,
        request_event_table: RequestEventTable,
        task_queue = None
    ):
        self.request_event_table = request_event_table
        self.task_queue = task_queue or get_global_task_queue()

    def submit_task(
        self,
        request_id: str,
        task_type: str,
        task_data: Dict[str, Any],
        client_id: str,
        client_type: str = 'http',
        priority: TaskPriority = TaskPriority.NORMAL
    ) -> str:
        """
        Submit RPC request as task to heartbeat queue

        Args:
            request_id: RPC request ID (for correlation)
            task_type: Task type ('tts', 'stt', 'translate')
            task_data: Task payload
            client_id: Client identifier
            client_type: 'http' or 'websocket'
            priority: Task priority

        Returns:
            Task ID
        """
        # Create callback to update RequestEventTable
        def on_task_complete(task: Task):
            self._update_request_event(
                request_id=request_id,
                task=task
            )

        def on_task_error(task: Task):
            self._update_request_event_error(
                request_id=request_id,
                task=task
            )

        # Enrich task_data with RPC context
        task_data['request_id'] = request_id
        task_data['client_id'] = client_id
        task_data['client_type'] = client_type

        # Create task
        task = Task(
            task_type=task_type,
            task_data=task_data,
            priority=priority,
            callback=on_task_complete,
            error_callback=on_task_error
        )

        # Submit to queue
        self.task_queue.put(task)

        return task.task_id

    def _update_request_event(self, request_id: str, task: Task):
        """Update RequestEventTable with task result"""
        result = task.metadata.get('result', {})

        self.request_event_table.complete_event(
            request_id=request_id,
            result=result
        )

    def _update_request_event_error(self, request_id: str, task: Task):
        """Update RequestEventTable with task error"""
        error = task.metadata.get('error', str(task.error_message))

        self.request_event_table.fail_event(
            request_id=request_id,
            error=error
        )


# Global bridge instance
_global_bridge = None


def get_rpc_heartbeat_bridge(request_event_table: RequestEventTable = None):
    """Get global RPC-Heartbeat bridge"""
    global _global_bridge
    if _global_bridge is None:
        if request_event_table is None:
            raise ValueError("request_event_table required for first initialization")
        _global_bridge = RPCHeartbeatBridge(request_event_table)
    return _global_bridge
```

#### 1.2 TTS Worker Thread Integration

Modify TTS worker to register with GlobalThreadPool.

**File: `pycore/pyutils/edge_tts/heartbeat_worker.py`**

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Edge TTS Heartbeat Worker Thread

TTS worker that integrates with PyHeartbeat system.
"""

import queue
import threading
import asyncio
from pathlib import Path
from typing import Optional

from pycore.pyfoundations import Task, ColorPrint
from pycore.pyfoundations.third_party import get_third_package_edge_tts
from pycore.pyheartbeat import get_global_thread_pool
from pycore.pyutils.tts_cache import tts_cache_manager

edge_tts_module = get_third_package_edge_tts()


class EdgeTTSHeartbeatWorker(threading.Thread):
    """
    Edge TTS worker thread integrated with PyHeartbeat

    Registers with GlobalThreadPool and accepts tasks from HeartbeatPusher.
    """

    def __init__(
        self,
        max_queue_size: int = 20,
        daemon: bool = True
    ):
        super().__init__(name='tts_worker', daemon=daemon)

        self.task_queue = queue.Queue(maxsize=max_queue_size)
        self.max_queue_size = max_queue_size
        self._stop_event = threading.Event()

        # Default voices
        self.default_voices = {
            "zh-CN": "zh-CN-XiaoxiaoNeural",
            "zh-TW": "zh-TW-HsiaoChenNeural",
            "en-US": "en-US-JennyNeural",
            "en-GB": "en-GB-SoniaNeural",
            "ja-JP": "ja-JP-NanamiNeural",
            "ko-KR": "ko-KR-SunHiNeural",
        }

    def run(self):
        """Main thread loop"""
        ColorPrint.green("[TTSHeartbeatWorker] Starting...")

        # Register with GlobalThreadPool
        thread_pool = get_global_thread_pool()
        thread_pool.register_thread(
            name=self.name,
            instance=self,
            task_handlers={
                'tts': self.accept_tts_task,
                'audio_synthesis': self.accept_tts_task
            },
            metadata={
                'max_queue_size': self.max_queue_size,
                'description': 'Edge TTS synthesis worker',
                'provider': 'edge_tts'
            }
        )

        ColorPrint.green(f"[TTSHeartbeatWorker] Registered with GlobalThreadPool")

        # Process tasks
        while not self._stop_event.is_set():
            try:
                task = self.task_queue.get(timeout=1.0)
                self._process_tts_task(task)
                thread_pool.update_heartbeat(self.name)
            except queue.Empty:
                thread_pool.update_heartbeat(self.name)
                continue
            except Exception as e:
                ColorPrint.red(f"[TTSHeartbeatWorker] Error: {e}")
                thread_pool.update_heartbeat(self.name)

        # Unregister on stop
        thread_pool.unregister_thread(self.name)
        ColorPrint.blue("[TTSHeartbeatWorker] Stopped")

    def accept_tts_task(self, task: Task) -> bool:
        """
        Handler for 'tts' task type

        Called by HeartbeatPusher to offer a task.

        Args:
            task: Task to process

        Returns:
            True if accepted, False if busy
        """
        try:
            if self.task_queue.qsize() < self.max_queue_size:
                self.task_queue.put(task, block=False)
                task.mark_running()
                ColorPrint.blue(f"[TTSHeartbeatWorker] Accepted task {task.task_id[:8]}...")
                return True
            return False
        except queue.Full:
            return False

    def _process_tts_task(self, task: Task):
        """Process TTS synthesis task"""
        try:
            text = task.task_data.get('text', '')
            voice = task.task_data.get('voice')
            language = task.task_data.get('language', 'zh-CN')
            output_path = task.task_data.get('output_path')
            use_cache = task.task_data.get('use_cache', True)

            if not text:
                task.mark_failed("No text provided")
                if task.error_callback:
                    task.error_callback(task)
                return

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

            # Check cache
            if use_cache:
                if tts_cache_manager.copy_from_cache('edge', text, language, output_path):
                    ColorPrint.green(f"[TTSHeartbeatWorker] Cache hit: {output_path.name}")
                    task.mark_completed()
                    task.metadata['result'] = {
                        'success': True,
                        'audio_path': str(output_path),
                        'cached': True,
                        'text': text,
                        'voice': voice,
                        'language': language
                    }
                    if task.callback:
                        task.callback(task)
                    return

            # Synthesize
            success = self._synthesize_edge_tts(text, output_path, voice)

            if success:
                # Save to cache
                if use_cache and output_path.exists():
                    tts_cache_manager.save_cache('edge', text, language, output_path)

                task.mark_completed()
                task.metadata['result'] = {
                    'success': True,
                    'audio_path': str(output_path),
                    'cached': False,
                    'text': text,
                    'voice': voice,
                    'language': language
                }

                if task.callback:
                    task.callback(task)
            else:
                task.mark_failed("TTS synthesis failed")
                if task.error_callback:
                    task.error_callback(task)

        except Exception as e:
            task.mark_failed(str(e))
            if task.error_callback:
                task.error_callback(task)

    def _synthesize_edge_tts(self, text: str, output_path: Path, voice: str) -> bool:
        """Perform Edge TTS synthesis"""
        if edge_tts_module is None:
            return False

        async def _do_synthesis():
            communicate = edge_tts_module.Communicate(text, voice)
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

            return True
        except Exception as e:
            ColorPrint.red(f"[TTSHeartbeatWorker] Synthesis error: {e}")
            return False

    def stop(self):
        """Stop worker"""
        self._stop_event.set()


def start_tts_heartbeat_worker(max_queue_size: int = 20) -> EdgeTTSHeartbeatWorker:
    """Start TTS heartbeat worker thread"""
    worker = EdgeTTSHeartbeatWorker(max_queue_size=max_queue_size)
    worker.start()
    return worker
```

#### 1.3 STT Worker Thread Integration

**File: `pycore/pyutils/speech_recognition/heartbeat_worker.py`**

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Speech Recognition Heartbeat Worker Thread

STT worker that integrates with PyHeartbeat system.
"""

import queue
import threading
from pathlib import Path
from typing import Optional

from pycore.pyfoundations import Task, ColorPrint
from pycore.pyheartbeat import get_global_thread_pool
from pycore.pyutils.speech_recognition import speech_recognizer


class STTHeartbeatWorker(threading.Thread):
    """
    Speech Recognition worker thread integrated with PyHeartbeat

    Registers with GlobalThreadPool and accepts tasks from HeartbeatPusher.
    """

    def __init__(
        self,
        max_queue_size: int = 10,
        daemon: bool = True
    ):
        super().__init__(name='stt_worker', daemon=daemon)

        self.task_queue = queue.Queue(maxsize=max_queue_size)
        self.max_queue_size = max_queue_size
        self._stop_event = threading.Event()

    def run(self):
        """Main thread loop"""
        ColorPrint.green("[STTHeartbeatWorker] Starting...")

        # Initialize speech recognizer
        if not speech_recognizer.initialize():
            ColorPrint.red("[STTHeartbeatWorker] Failed to initialize speech recognizer")
            return

        # Register with GlobalThreadPool
        thread_pool = get_global_thread_pool()
        thread_pool.register_thread(
            name=self.name,
            instance=self,
            task_handlers={
                'stt': self.accept_stt_task,
                'speech_recognition': self.accept_stt_task,
                'transcribe': self.accept_stt_task
            },
            metadata={
                'max_queue_size': self.max_queue_size,
                'description': 'Speech Recognition worker',
                'providers': speech_recognizer.get_available_providers()
            }
        )

        ColorPrint.green(f"[STTHeartbeatWorker] Registered with GlobalThreadPool")

        # Process tasks
        while not self._stop_event.is_set():
            try:
                task = self.task_queue.get(timeout=1.0)
                self._process_stt_task(task)
                thread_pool.update_heartbeat(self.name)
            except queue.Empty:
                thread_pool.update_heartbeat(self.name)
                continue
            except Exception as e:
                ColorPrint.red(f"[STTHeartbeatWorker] Error: {e}")
                thread_pool.update_heartbeat(self.name)

        # Unregister on stop
        thread_pool.unregister_thread(self.name)
        ColorPrint.blue("[STTHeartbeatWorker] Stopped")

    def accept_stt_task(self, task: Task) -> bool:
        """
        Handler for 'stt' task type

        Called by HeartbeatPusher to offer a task.
        """
        try:
            if self.task_queue.qsize() < self.max_queue_size:
                self.task_queue.put(task, block=False)
                task.mark_running()
                ColorPrint.blue(f"[STTHeartbeatWorker] Accepted task {task.task_id[:8]}...")
                return True
            return False
        except queue.Full:
            return False

    def _process_stt_task(self, task: Task):
        """Process speech recognition task"""
        try:
            audio_file = task.task_data.get('audio_file')
            language = task.task_data.get('language', 'zh-CN')
            provider = task.task_data.get('provider')

            if not audio_file:
                task.mark_failed("No audio file provided")
                if task.error_callback:
                    task.error_callback(task)
                return

            # Perform recognition
            result = speech_recognizer.recognize_from_file(
                audio_file=audio_file,
                language=language,
                provider=provider
            )

            if result.get('success'):
                task.mark_completed()
                task.metadata['result'] = result

                if task.callback:
                    task.callback(task)
            else:
                task.mark_failed(result.get('error', 'Recognition failed'))
                if task.error_callback:
                    task.error_callback(task)

        except Exception as e:
            task.mark_failed(str(e))
            if task.error_callback:
                task.error_callback(task)

    def stop(self):
        """Stop worker"""
        self._stop_event.set()


def start_stt_heartbeat_worker(max_queue_size: int = 10) -> STTHeartbeatWorker:
    """Start STT heartbeat worker thread"""
    worker = STTHeartbeatWorker(max_queue_size=max_queue_size)
    worker.start()
    return worker
```

### Phase 2: RPC Route Handlers

#### 2.1 TTS Route Handler

**File: `pycore/pyctl/speech/rpc/tts_routes.py`**

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TTS RPC Route Handlers

RPC routes that submit tasks to PyHeartbeat queue.
"""

from typing import Dict, Any
from pycore.pyfoundations import TaskPriority
from pycore.pyutils.rpc.server.heartbeat_bridge import get_rpc_heartbeat_bridge


def register_tts_routes(rpc_server, request_event_table):
    """
    Register TTS routes with RPC server

    Args:
        rpc_server: UnifiedRpcServer instance
        request_event_table: RequestEventTable instance
    """
    bridge = get_rpc_heartbeat_bridge(request_event_table)

    def tts_synthesize(params: Dict, request_id: str, context: Dict) -> Dict[str, Any]:
        """
        TTS synthesis route handler

        Submits task to heartbeat queue instead of processing directly.

        Request params:
            text: str - Text to synthesize
            voice: str (optional) - Voice name
            language: str (optional) - Language code (default: zh-CN)
            priority: str (optional) - 'high', 'normal', 'low'

        Returns:
            Dict with task_id and accepted status
        """
        text = params.get('text', '')
        if not text:
            return {'error': 'text is required'}

        voice = params.get('voice')
        language = params.get('language', 'zh-CN')
        priority_str = params.get('priority', 'normal')

        # Map priority
        priority_map = {
            'high': TaskPriority.HIGH,
            'normal': TaskPriority.NORMAL,
            'low': TaskPriority.LOW
        }
        priority = priority_map.get(priority_str, TaskPriority.NORMAL)

        # Get client info from context
        client_id = context.get('client_id', 'unknown')
        client_type = 'websocket' if 'ws' in context else 'http'

        # Submit to heartbeat queue
        task_id = bridge.submit_task(
            request_id=request_id,
            task_type='tts',
            task_data={
                'text': text,
                'voice': voice,
                'language': language
            },
            client_id=client_id,
            client_type=client_type,
            priority=priority
        )

        return {
            'status': 'accepted',
            'task_id': task_id,
            'request_id': request_id,
            'message': 'TTS task queued for processing'
        }

    # Register route
    rpc_server.route('tts', tts_synthesize)
    rpc_server.route('tts.synthesize', tts_synthesize)


def register_stt_routes(rpc_server, request_event_table):
    """
    Register STT routes with RPC server
    """
    bridge = get_rpc_heartbeat_bridge(request_event_table)

    def stt_recognize(params: Dict, request_id: str, context: Dict) -> Dict[str, Any]:
        """
        STT recognition route handler

        Request params:
            audio_file: str - Path to audio file
            language: str (optional) - Language code
            provider: str (optional) - STT provider
        """
        audio_file = params.get('audio_file')
        if not audio_file:
            return {'error': 'audio_file is required'}

        language = params.get('language', 'zh-CN')
        provider = params.get('provider')
        priority_str = params.get('priority', 'normal')

        priority_map = {
            'high': TaskPriority.HIGH,
            'normal': TaskPriority.NORMAL,
            'low': TaskPriority.LOW
        }
        priority = priority_map.get(priority_str, TaskPriority.NORMAL)

        client_id = context.get('client_id', 'unknown')
        client_type = 'websocket' if 'ws' in context else 'http'

        task_id = bridge.submit_task(
            request_id=request_id,
            task_type='stt',
            task_data={
                'audio_file': audio_file,
                'language': language,
                'provider': provider
            },
            client_id=client_id,
            client_type=client_type,
            priority=priority
        )

        return {
            'status': 'accepted',
            'task_id': task_id,
            'request_id': request_id,
            'message': 'STT task queued for processing'
        }

    rpc_server.route('stt', stt_recognize)
    rpc_server.route('stt.recognize', stt_recognize)
```

### Phase 3: Application Launcher

#### 3.1 Unified Application Entry Point

**File: `pycore/pylauncher/speech_service_launcher.py`**

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Speech Service Launcher

Launches the complete speech service stack with PyHeartbeat integration.
"""

import asyncio
from pycore.pyfoundations import ColorPrint
from pycore.pyheartbeat import initialize_heartbeat_system
from pycore.pyutils.rpc import UnifiedRpcServer
from pycore.pyutils.edge_tts.heartbeat_worker import start_tts_heartbeat_worker
from pycore.pyutils.speech_recognition.heartbeat_worker import start_stt_heartbeat_worker
from pycore.pyctl.speech.rpc.tts_routes import register_tts_routes, register_stt_routes


async def launch_speech_service(
    port: int = 8080,
    host: str = '0.0.0.0',
    tts_workers: int = 2,
    stt_workers: int = 1
):
    """
    Launch complete speech service

    Args:
        port: RPC server port
        host: RPC server host
        tts_workers: Number of TTS worker threads
        stt_workers: Number of STT worker threads
    """
    ColorPrint.green("=== Speech Service Launcher ===")

    # Step 1: Initialize PyHeartbeat system
    ColorPrint.blue("[Launcher] Initializing PyHeartbeat...")
    heartbeat_system = initialize_heartbeat_system()
    heartbeat_system.start()
    ColorPrint.green("[Launcher] PyHeartbeat started")

    # Step 2: Start worker threads
    ColorPrint.blue("[Launcher] Starting TTS worker threads...")
    tts_workers_list = []
    for i in range(tts_workers):
        worker = start_tts_heartbeat_worker(max_queue_size=20)
        tts_workers_list.append(worker)
    ColorPrint.green(f"[Launcher] Started {tts_workers} TTS workers")

    ColorPrint.blue("[Launcher] Starting STT worker threads...")
    stt_workers_list = []
    for i in range(stt_workers):
        worker = start_stt_heartbeat_worker(max_queue_size=10)
        stt_workers_list.append(worker)
    ColorPrint.green(f"[Launcher] Started {stt_workers} STT workers")

    # Step 3: Create RPC server
    ColorPrint.blue("[Launcher] Creating RPC server...")
    rpc_server = UnifiedRpcServer({
        'port': port,
        'host': host,
        'debug': True
    })

    # Step 4: Register routes
    ColorPrint.blue("[Launcher] Registering routes...")
    register_tts_routes(rpc_server, rpc_server.request_event_table)
    register_stt_routes(rpc_server, rpc_server.request_event_table)

    # Step 5: Start RPC server
    ColorPrint.blue("[Launcher] Starting RPC server...")
    await rpc_server.start()

    ColorPrint.green(f"=== Speech Service Running ===")
    ColorPrint.blue(f"  RPC Server: http://{host}:{port}")
    ColorPrint.blue(f"  WebSocket: ws://{host}:{port}/rpc/ws")
    ColorPrint.blue(f"  TTS Workers: {tts_workers}")
    ColorPrint.blue(f"  STT Workers: {stt_workers}")
    ColorPrint.blue(f"  Heartbeat: 1s tick")

    # Keep running
    try:
        while True:
            await asyncio.sleep(10)

            # Optional: Print stats
            stats = heartbeat_system.get_stats()
            ColorPrint.blue(f"[Stats] Queue: {stats['task_queue']['size']}, "
                          f"Pushed: {stats['heartbeat_pusher']['tasks_pushed']}")

    except KeyboardInterrupt:
        ColorPrint.yellow("\n[Launcher] Shutting down...")

    finally:
        # Cleanup
        await rpc_server.stop()
        heartbeat_system.stop()

        for worker in tts_workers_list:
            worker.stop()

        for worker in stt_workers_list:
            worker.stop()

        ColorPrint.blue("[Launcher] Shutdown complete")


def main():
    """Main entry point"""
    asyncio.run(launch_speech_service())


if __name__ == '__main__':
    main()
```

## Client Usage Examples

### HTTP Client

```javascript
// Request TTS synthesis
fetch('http://localhost:8080/rpc/tts', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
        id: 'request-123',
        params: {
            text: 'Hello, world!',
            language: 'en-US',
            priority: 'high'
        }
    })
})
.then(r => r.json())
.then(result => {
    console.log('Task accepted:', result);
    // Poll for result
    const requestId = result.request_id;
    // ... poll /rpc/query/{requestId}
});
```

### WebSocket Client

```javascript
const ws = new WebSocket('ws://localhost:8080/rpc/ws');

ws.onopen = () => {
    // Send TTS request
    ws.send(JSON.stringify({
        type: 'request',
        id: 'request-123',
        route: 'tts',
        params: {
            text: 'Hello, world!',
            language: 'en-US'
        }
    }));
};

ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    if (msg.type === 'response' && msg.id === 'request-123') {
        console.log('TTS Result:', msg.result);
        // Result contains: audio_path, text, voice, language

        // Send ACK
        ws.send(JSON.stringify({
            type: 'ack',
            id: msg.id
        }));
    }
};
```

## Data Flow Summary

1. **Web Request** → RPC server receives request
2. **RequestEventTable** → Request stored with unique ID
3. **HeartbeatBridge** → Creates Task with correlation ID
4. **GlobalTaskQueue** → Task enqueued (priority-based)
5. **HeartbeatPusher** → 1-second tick polls queue
6. **GlobalThreadPool** → Routes task to handler by task_type
7. **Worker Thread** → Accepts task (handler returns True)
8. **Task Processing** → TTS synthesis / STT recognition
9. **Task Callback** → Updates RequestEventTable with result
10. **Client Notification** → HTTP polling or WebSocket push

## Key Benefits

1. **Decoupled Architecture**: Web server doesn't block on processing
2. **Load Balancing**: Multiple workers share task load
3. **Priority Support**: High-priority tasks processed first
4. **Global Visibility**: Thread pool state in Encyclopedia
5. **Reliability**: ACK mechanism ensures delivery
6. **Scalability**: Add more workers without code changes
7. **Monitoring**: Real-time stats and health checks

## Next Steps

1. Implement `RequestEventTable.complete_event()` and `fail_event()` methods
2. Add retry mechanism for failed tasks
3. Implement task timeout handling
4. Add WebSocket push notification on task completion
5. Create monitoring dashboard using Encyclopedia data
6. Add audio file upload endpoint for STT
7. Implement streaming TTS with chunked audio delivery
