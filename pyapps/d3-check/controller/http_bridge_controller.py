#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HTTP Bridge Controller for D3Check
Provides HTTP API endpoints for web-based GUI communication.
"""

import json
import logging
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Dict, Any, Callable, Optional
from urllib.parse import parse_qs, urlsplit

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.encyclopedia import ENCYCLOPEDIA
from providor.providor_index import CONFIG, queue_config_save, load_config
from controller.d3_macro_controller import D3MacroController
from share.oauth_callback import notify_oauth_done, notify_ping, get_and_consume_step1_received

try:
    from d3utils.yolo_record import (
        run_gameaisdk_start_record,
        stop_record as yolo_stop_record,
        is_recording as yolo_is_recording,
        list_segments as yolo_list_segments,
        segment_info as yolo_segment_info,
        compose_segment_to_frames as yolo_compose_segment_to_frames,
        delete_segment as yolo_delete_segment,
    )
except ImportError:
    run_gameaisdk_start_record = None
    yolo_stop_record = None
    yolo_is_recording = None
    yolo_list_segments = None
    yolo_segment_info = None
    yolo_compose_segment_to_frames = None
    yolo_delete_segment = None

Handler = Callable[[Dict[str, Any]], Dict[str, Any]]


class HTTPBridgeController:
    """HTTP Bridge Controller for D3Check"""

    def __init__(self, host: str = '127.0.0.1', port: int = 8765, macro_controller: D3MacroController = None):
        """
        Initialize HTTP bridge controller

        Args:
            host: Server host address
            port: Server port number
            macro_controller: Optional shared D3MacroController; if None, creates one (for bridge-only mode).
        """
        self.logger = logging.getLogger(__name__)
        self.host = host
        self.port = port
        self.macro_controller = macro_controller if macro_controller is not None else D3MacroController()
        self._get_handlers: Dict[str, Handler] = {}
        self._post_handlers: Dict[str, Handler] = {}
        self._server: Optional[ThreadingHTTPServer] = None
        self._thread: Optional[threading.Thread] = None

        self._register_handlers()

        ENCYCLOPEDIA['http_bridge_controller'] = self

        ColorPrint.blue(f"[HTTPBridgeController] Initialized on {host}:{port}")

    def _register_handlers(self):
        """Register HTTP request handlers"""
        self._get_handlers['/api/status'] = self._handle_get_status
        self._get_handlers['/api/config'] = self._handle_get_config
        self._get_handlers['/api/config/skill'] = self._handle_get_skill_config
        self._get_handlers['/api/config/auxiliary'] = self._handle_get_auxiliary_config

        self._post_handlers['/api/macro/start'] = self._handle_macro_start
        self._post_handlers['/api/macro/stop'] = self._handle_macro_stop
        self._post_handlers['/api/config/update'] = self._handle_config_update
        self._post_handlers['/api/config/switch'] = self._handle_config_switch
        self._post_handlers['/api/config/save'] = self._handle_config_save
        self._post_handlers['/api/login-try/oauth-done'] = self._handle_login_try_oauth_done
        self._get_handlers['/api/login-try/oauth-done'] = self._handle_login_try_oauth_done_get
        self._get_handlers['/api/login-try/oauth-ping'] = self._handle_login_try_oauth_ping
        self._get_handlers['/api/login-try/oauth-step1-received'] = self._handle_login_try_oauth_step1_received

        # YOLO recording (DOT client calls Python to run GameAISDK video recording)
        self._get_handlers['/api/yolo/record/status'] = self._handle_yolo_record_status
        self._post_handlers['/api/yolo/record/start'] = self._handle_yolo_record_start
        self._post_handlers['/api/yolo/record/stop'] = self._handle_yolo_record_stop
        self._get_handlers['/api/yolo/segments'] = self._handle_yolo_segments_get
        self._post_handlers['/api/yolo/segments'] = self._handle_yolo_segments
        self._post_handlers['/api/yolo/segment/info'] = self._handle_yolo_segment_info
        self._post_handlers['/api/yolo/segment/export'] = self._handle_yolo_segment_export
        self._post_handlers['/api/yolo/segment/delete'] = self._handle_yolo_segment_delete

        ColorPrint.green("[HTTPBridgeController] All handlers registered")

    def _handle_get_status(self, query_params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle GET /api/status"""
        return {
            'success': True,
            'data': {
                'macro_running': self.macro_controller.macro_running,
                'current_config': self.macro_controller.current_skill_config,
                'server_version': '1.0.0'
            }
        }

    def _handle_get_config(self, query_params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle GET /api/config"""
        return {
            'success': True,
            'data': self.macro_controller.get_current_config()
        }

    def _handle_get_skill_config(self, query_params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle GET /api/config/skill"""
        config_name = query_params.get('name', [self.macro_controller.current_skill_config])[0]
        return {
            'success': True,
            'data': self.macro_controller.get_skill_config(config_name)
        }

    def _handle_get_auxiliary_config(self, query_params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle GET /api/config/auxiliary"""
        return {
            'success': True,
            'data': self.macro_controller.get_auxiliary_config()
        }

    def _handle_macro_start(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle POST /api/macro/start"""
        try:
            self.macro_controller.start_macro()
            return {
                'success': True,
                'message': 'Macro started successfully'
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    def _handle_macro_stop(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle POST /api/macro/stop"""
        try:
            self.macro_controller.stop_macro()
            return {
                'success': True,
                'message': 'Macro stopped successfully'
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    def _handle_config_update(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle POST /api/config/update"""
        try:
            config_name = request_data.get('config_name')
            config_data = request_data.get('config_data')

            if not config_name or not config_data:
                return {
                    'success': False,
                    'error': 'Missing config_name or config_data'
                }

            self.macro_controller.update_skill_config(config_name, config_data)
            return {
                'success': True,
                'message': f'Configuration {config_name} updated successfully'
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    def _handle_config_switch(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle POST /api/config/switch"""
        try:
            config_name = request_data.get('config_name')

            if not config_name:
                return {
                    'success': False,
                    'error': 'Missing config_name'
                }

            self.macro_controller.switch_skill_config(config_name)
            return {
                'success': True,
                'message': f'Switched to configuration {config_name}'
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    def _handle_config_save(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle POST /api/config/save"""
        try:
            queue_config_save()
            return {
                'success': True,
                'message': 'Configuration saved successfully'
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    def _handle_login_try_oauth_done(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """POST /api/login-try/oauth-done: Tampermonkey notifies web that login completed."""
        try:
            notify_oauth_done()
            return {'success': True, 'message': 'oauth_done'}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _handle_login_try_oauth_done_get(self, query_params: Dict[str, Any]) -> Dict[str, Any]:
        """GET /api/login-try/oauth-done (same)."""
        try:
            notify_oauth_done()
            return {'success': True, 'message': 'oauth_done'}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _handle_login_try_oauth_ping(self, query_params: Dict[str, Any]) -> Dict[str, Any]:
        """GET /api/login-try/oauth-ping: Tampermonkey health ping (no oauth_done). UI shows script connected."""
        try:
            notify_ping()
            return {'success': True, 'message': 'pong'}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _handle_login_try_oauth_step1_received(self, query_params: Dict[str, Any]) -> Dict[str, Any]:
        """GET /api/login-try/oauth-step1-received: flow/end page (account.battlenet.com.cn) queries whether step1 (oauth-done) was just submitted; consumed once."""
        try:
            received, at = get_and_consume_step1_received()
            if received and at is not None:
                return {'success': True, 'received': True, 'at': at}
            return {'success': True, 'received': False}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _handle_yolo_record_status(self, query_params: Dict[str, Any]) -> Dict[str, Any]:
        """GET /api/yolo/record/status: whether Python is currently recording (GameAISDK)."""
        if yolo_is_recording is None:
            return {'success': False, 'error': 'yolo_record not available', 'data': {'recording': False}}
        try:
            recording = yolo_is_recording()
            return {'success': True, 'data': {'recording': recording}}
        except Exception as e:
            return {'success': False, 'error': str(e), 'data': {'recording': False}}

    def _handle_yolo_record_start(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """POST /api/yolo/record/start: project_path (required), serial (window hwnd as int, required for Windows)."""
        if run_gameaisdk_start_record is None:
            return {'success': False, 'error': 'yolo_record not available'}
        project_path = (request_data.get('project_path') or '').strip()
        serial = request_data.get('serial')
        if not project_path or not os.path.isdir(project_path):
            return {'success': False, 'error': 'project_path required and must be an existing directory'}
        try:
            hwnd = int(serial) if serial is not None else 0
        except (TypeError, ValueError):
            return {'success': False, 'error': 'serial (window handle) required as integer'}
        if hwnd == 0:
            return {'success': False, 'error': 'serial (window handle) required for Windows recording'}
        try:
            ok, msg, out_project = run_gameaisdk_start_record(project=project_path, serial=hwnd)
            if ok:
                return {'success': True, 'message': msg or 'recording started', 'project_path': out_project}
            return {'success': False, 'error': msg or 'start failed'}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _handle_yolo_record_stop(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """POST /api/yolo/record/stop: stop current recording."""
        if yolo_stop_record is None:
            return {'success': False, 'error': 'yolo_record not available'}
        try:
            yolo_stop_record()
            return {'success': True, 'message': 'recording stopped'}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _handle_yolo_segments_get(self, query_params: Dict[str, Any]) -> Dict[str, Any]:
        """GET /api/yolo/segments?project_path=... -> list of {segment_id, segment_path}."""
        project_path = (query_params.get('project_path') or [None])[0] or ''
        return self._yolo_segments_impl(project_path.strip())

    def _handle_yolo_segments(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """POST /api/yolo/segments: project_path -> list of {segment_id, segment_path}."""
        project_path = (request_data.get('project_path') or '').strip()
        return self._yolo_segments_impl(project_path)

    def _yolo_segments_impl(self, project_path: str) -> Dict[str, Any]:
        if yolo_list_segments is None:
            return {'success': False, 'error': 'yolo_record not available', 'data': []}
        if not project_path:
            return {'success': True, 'data': []}
        try:
            pairs = yolo_list_segments(project_path)
            data = [{'segment_id': seg_id, 'segment_path': seg_path} for seg_id, seg_path in pairs]
            return {'success': True, 'data': data}
        except Exception as e:
            return {'success': False, 'error': str(e), 'data': []}

    def _handle_yolo_segment_info(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """POST /api/yolo/segment/info: segment_path -> frames_count, has_video, status, size_mb."""
        if yolo_segment_info is None:
            return {'success': False, 'error': 'yolo_record not available'}
        segment_path = (request_data.get('segment_path') or '').strip()
        if not segment_path or not os.path.isdir(segment_path):
            return {'success': False, 'error': 'segment_path required and must be an existing directory'}
        try:
            info = yolo_segment_info(segment_path)
            return {'success': True, 'data': info}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _handle_yolo_segment_export(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """POST /api/yolo/segment/export: segment_path, output_subdir (default frames), skip_frames (default 1)."""
        if yolo_compose_segment_to_frames is None:
            return {'success': False, 'error': 'yolo_record not available'}
        segment_path = (request_data.get('segment_path') or '').strip()
        if not segment_path or not os.path.isdir(segment_path):
            return {'success': False, 'error': 'segment_path required and must be an existing directory'}
        output_subdir = request_data.get('output_subdir') or 'frames'
        skip_frames = int(request_data.get('skip_frames', 1))
        if skip_frames < 1:
            skip_frames = 1
        try:
            ok, msg, frames_dir = yolo_compose_segment_to_frames(
                segment_path, output_subdir=output_subdir, skip_frames=skip_frames
            )
            if ok:
                return {'success': True, 'message': msg, 'frames_dir': frames_dir}
            return {'success': False, 'error': msg or 'export failed'}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _handle_yolo_segment_delete(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """POST /api/yolo/segment/delete: segment_path -> delete segment directory."""
        if yolo_delete_segment is None:
            return {'success': False, 'error': 'yolo_record not available'}
        segment_path = (request_data.get('segment_path') or '').strip()
        if not segment_path or not os.path.isdir(segment_path):
            return {'success': False, 'error': 'segment_path required and must be an existing directory'}
        try:
            ok, msg = yolo_delete_segment(segment_path)
            if ok:
                return {'success': True, 'message': msg or 'deleted'}
            return {'success': False, 'error': msg or 'delete failed'}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def start(self):
        """Start HTTP bridge server"""
        if self.is_running():
            return

        controller = self

        class RequestHandler(BaseHTTPRequestHandler):
            def do_OPTIONS(self) -> None:
                self.send_response(204)
                self._send_common_headers()
                self.end_headers()

            def do_GET(self) -> None:
                route = urlsplit(self.path)
                handler = controller._get_handlers.get(route.path)
                if handler is None:
                    self._send_json(404, {'success': False, 'error': 'Route not found'})
                    return
                self._invoke(handler, parse_qs(route.query, keep_blank_values=True))

            def do_POST(self) -> None:
                route = urlsplit(self.path)
                handler = controller._post_handlers.get(route.path)
                if handler is None:
                    self._send_json(404, {'success': False, 'error': 'Route not found'})
                    return
                content_length = int(self.headers.get('Content-Length', '0') or 0)
                raw_body = self.rfile.read(content_length) if content_length else b'{}'
                try:
                    payload = json.loads(raw_body.decode('utf-8'))
                except (UnicodeDecodeError, json.JSONDecodeError):
                    self._send_json(400, {'success': False, 'error': 'Invalid JSON body'})
                    return
                if not isinstance(payload, dict):
                    self._send_json(400, {'success': False, 'error': 'JSON body must be an object'})
                    return
                self._invoke(handler, payload)

            def _invoke(self, handler: Handler, payload: Dict[str, Any]) -> None:
                try:
                    result = handler(payload)
                except Exception as exc:
                    self._send_json(500, {'success': False, 'error': str(exc)})
                    return
                response = result if isinstance(result, dict) else {'success': True, 'data': result}
                self._send_json(200, response)

            def _send_json(self, status: int, payload: Dict[str, Any]) -> None:
                body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
                self.send_response(status)
                self._send_common_headers()
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def _send_common_headers(self) -> None:
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
                self.send_header('Access-Control-Allow-Headers', 'Content-Type')

            def log_message(self, format_string: str, *args: Any) -> None:
                return

        self._server = ThreadingHTTPServer((self.host, self.port), RequestHandler)
        self._thread = threading.Thread(
            target=self._server.serve_forever,
            name=f'HTTPBridge-{self.host}:{self.port}',
            daemon=True,
        )
        self._thread.start()
        ColorPrint.green(f"[HTTPBridgeController] Server started on http://{self.host}:{self.port}")

    def stop(self):
        """Stop HTTP bridge server"""
        server = self._server
        thread = self._thread
        self._server = None
        self._thread = None
        if server is None:
            return
        server.shutdown()
        server.server_close()
        if thread is not None and thread is not threading.current_thread():
            thread.join(timeout=2.0)
        ColorPrint.blue("[HTTPBridgeController] Server stopped")

    def is_running(self) -> bool:
        """Check if server is running"""
        return self._server is not None and self._thread is not None and self._thread.is_alive()


