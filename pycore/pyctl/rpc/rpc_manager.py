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
from pathlib import Path
from typing import Dict, Any, Optional, List, Union

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.rpc.server.unified_server import UnifiedRpcServer
from pycore.pyutils.tts_cache import tts_cache_manager
from pycore.pyctl.speech import get_speech_manager


class RpcManager:
    """
    RPC Manager - Provides speech API via RPC server

    Wraps UnifiedRpcServer and registers speech-related routes:
    - /api/tts - Text to speech conversion
    - /api/stt - Speech to text conversion
    - /api/multi_tts - Convert text to multiple languages
    - /api/multi_stt - Convert audio to multiple languages

    Usage:
        from pycore.pyctl.rpc import rpc_manager

        # Start server (auto-starts by default)
        await rpc_manager.start()

        # API endpoints:
        # POST /api/tts - {"text": "hello", "language": "en-US"}
        # POST /api/stt - {"audio": "base64...", "language": "en-US"} or {"audio_path": "/path/to/file"}
        # POST /api/multi_tts - {"text": "hello", "languages": ["en-US", "zh-CN", "ja-JP"]}
        # POST /api/multi_stt - {"audio": "base64...", "languages": ["en-US", "zh-CN"]}
    """

    def __init__(self, port: int = 8765, host: str = "0.0.0.0", auto_start: bool = True):
        """
        Initialize RPC Manager

        Args:
            port: Server port (default: 8765)
            host: Server host (default: 0.0.0.0)
            auto_start: Auto-start server on initialization (default: True)
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

        # Speech manager for TTS/STT operations
        self.speech_manager = get_speech_manager()
        self.speech_manager.initialize()

        # Server state
        self._started = False
        self._server_thread: Optional[threading.Thread] = None
        self._event_loop: Optional[asyncio.AbstractEventLoop] = None

        # Register routes
        self._register_routes()

        # Auto-start if enabled
        if self.auto_start:
            self.start_in_background()

    def _register_routes(self):
        """Register all API routes"""
        # Register TTS route
        self.server.route('tts', self._handle_tts)
        self.server.route('stt', self._handle_stt)
        self.server.route('multi_tts', self._handle_multi_tts)
        self.server.route('multi_stt', self._handle_multi_stt)

        # Register status route
        self.server.route('status', self._handle_status)

        ColorPrint.blue("[RpcManager] Registered API routes: tts, stt, multi_tts, multi_stt, status")

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
        try:
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

            # Create temporary output file
            from pycore.pyutils.tts_cache import tts_cache_manager
            output_file = tts_cache_manager.get_cache_path(provider, text, language)

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
                    return {
                        'success': False,
                        'error': 'TTS synthesis failed'
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

        except Exception as e:
            ColorPrint.red(f"[RpcManager] TTS error: {e}")
            return {
                'success': False,
                'error': str(e)
            }

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
        try:
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
            if audio_base64:
                import tempfile
                audio_data = base64.b64decode(audio_base64)
                with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as f:
                    f.write(audio_data)
                    audio_path = f.name

            # Recognize speech
            result = self.speech_manager.recognize_from_file(
                audio_file=audio_path,
                language=language,
                provider=provider
            )

            # Clean up temp file if created
            if audio_base64 and audio_path:
                try:
                    Path(audio_path).unlink()
                except:
                    pass

            return result

        except Exception as e:
            ColorPrint.red(f"[RpcManager] STT error: {e}")
            return {
                'success': False,
                'error': str(e)
            }

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
        try:
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

        except Exception as e:
            ColorPrint.red(f"[RpcManager] Multi-TTS error: {e}")
            return {
                'success': False,
                'error': str(e)
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
        try:
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

        except Exception as e:
            ColorPrint.red(f"[RpcManager] Multi-STT error: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def _handle_status(self, params: Dict, request_id: str, context: Dict) -> Dict[str, Any]:
        """
        Handle status request

        Returns:
            {
                "server_running": bool,
                "speech_status": dict,
                "available_routes": list[str]
            }
        """
        return {
            'server_running': self._started,
            'speech_status': self.speech_manager.get_status(),
            'available_routes': ['tts', 'stt', 'multi_tts', 'multi_stt', 'status']
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
            try:
                self._event_loop.run_forever()
            except KeyboardInterrupt:
                pass
            finally:
                self._event_loop.run_until_complete(self.server.stop())
                self._event_loop.close()

        self._server_thread = threading.Thread(target=run_server, daemon=True)
        self._server_thread.start()

        # Wait a bit for server to start
        import time
        time.sleep(0.5)

        ColorPrint.green(f"[RpcManager] Server started on {self.host}:{self.port}")
        ColorPrint.blue(f"[RpcManager] HTTP API: http://{self.host}:{self.port}/api/<route>")
        ColorPrint.blue(f"[RpcManager] WebSocket: ws://{self.host}:{self.port}/ws")

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


def get_rpc_manager(port: int = 8765, host: str = "0.0.0.0", auto_start: bool = True) -> RpcManager:
    """
    Get global RPC manager singleton instance

    Args:
        port: Server port (default: 8765)
        host: Server host (default: 0.0.0.0)
        auto_start: Auto-start server (default: True)

    Returns:
        RpcManager instance
    """
    global _global_rpc_manager
    with _manager_lock:
        if _global_rpc_manager is None:
            _global_rpc_manager = RpcManager(port=port, host=host, auto_start=auto_start)
        return _global_rpc_manager
