#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HTTP Bridge Controller for D3Check
Provides HTTP API endpoints for web-based GUI communication
"""

import sys
import os
import logging
from pathlib import Path
from typing import Dict, Any

current_dir = Path(__file__).parent.parent
sys.path.insert(0, str(current_dir))

from providor.common_imports import ColorPrint, ENCYCLOPEDIA
from providor.providor_index import CONFIG, save_config, load_config
from pycore.pyutils.web.http_bridge import HTTPBridgeServer
from controller.d3_macro_controller import D3MacroController
from share.oauth_callback import notify_oauth_done, notify_ping


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

        self.bridge = HTTPBridgeServer(host, port)

        self._register_handlers()

        ENCYCLOPEDIA['http_bridge_controller'] = self

        ColorPrint.blue(f"[HTTPBridgeController] Initialized on {host}:{port}")

    def _register_handlers(self):
        """Register HTTP request handlers"""
        self.bridge.register_get_handler('/api/status', self._handle_get_status)
        self.bridge.register_get_handler('/api/config', self._handle_get_config)
        self.bridge.register_get_handler('/api/config/skill', self._handle_get_skill_config)
        self.bridge.register_get_handler('/api/config/auxiliary', self._handle_get_auxiliary_config)

        self.bridge.register_post_handler('/api/macro/start', self._handle_macro_start)
        self.bridge.register_post_handler('/api/macro/stop', self._handle_macro_stop)
        self.bridge.register_post_handler('/api/config/update', self._handle_config_update)
        self.bridge.register_post_handler('/api/config/switch', self._handle_config_switch)
        self.bridge.register_post_handler('/api/config/save', self._handle_config_save)
        self.bridge.register_post_handler('/api/login-try/oauth-done', self._handle_login_try_oauth_done)
        self.bridge.register_get_handler('/api/login-try/oauth-done', self._handle_login_try_oauth_done_get)
        self.bridge.register_get_handler('/api/login-try/oauth-ping', self._handle_login_try_oauth_ping)

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
            save_config()
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
        """POST /api/login-try/oauth-done: Tampermonkey notifies web 登录 completed."""
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
        """GET /api/login-try/oauth-ping: Tampermonkey health ping (no oauth_done). UI shows 油猴脚本 已连接."""
        try:
            notify_ping()
            return {'success': True, 'message': 'pong'}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def start(self):
        """Start HTTP bridge server"""
        self.bridge.start()
        ColorPrint.green(f"[HTTPBridgeController] Server started on http://{self.host}:{self.port}")

    def stop(self):
        """Stop HTTP bridge server"""
        self.bridge.stop()
        ColorPrint.blue("[HTTPBridgeController] Server stopped")

    def is_running(self) -> bool:
        """Check if server is running"""
        return self.bridge.is_running()


def get_http_bridge_controller():
    """Get global HTTP bridge controller instance"""
    return ENCYCLOPEDIA.get('http_bridge_controller')
