#!/usr/bin/env python3
"""
Webview Service for MCP Server

Provides webview launcher functionality through the MCP server.
Uses pycore.pyutils.web.webview_launcher for webview operations.
"""

from typing import Optional, Dict, Any, List

# Import webview launcher from pycore
from pycore.pyutils.web.webview_launcher import (
    WebviewGUILauncher,
    create_webview_launcher,
    get_webview_launcher,
    launch_pymatrix_gui
)


class WebviewService:
    """
    Webview Service for MCP Server

    Provides webview launcher functionality:
    - Create and manage webview windows
    - Launch applications with webview GUI
    - Control webview windows (reload, close, etc.)
    """

    def __init__(self):
        """Initialize webview service"""
        self.launchers: Dict[str, WebviewGUILauncher] = {}
        self.active_launcher: Optional[WebviewGUILauncher] = None

    async def create_launcher(self, params: dict) -> dict:
        """
        Create a new webview launcher

        Args:
            params: {
                'app_name': str,  # Application name
                'frontend_url': str,  # Frontend URL to display
                'bridge_host': str,  # Optional, default '127.0.0.1'
                'bridge_port': int,  # Optional, default 8765
                'window_title': str,  # Optional, defaults to app_name
                'window_width': int,  # Optional, default 1280
                'window_height': int,  # Optional, default 800
                'resizable': bool,  # Optional, default True
                'fullscreen': bool,  # Optional, default False
                'use_webview': bool,  # Optional, default True
            }

        Returns:
            dict: {
                'success': bool,
                'launcher_id': str,
                'message': str
            }
        """
        try:
            app_name = params.get('app_name', 'WebviewApp')
            frontend_url = params.get('frontend_url')

            if not frontend_url:
                return {
                    'success': False,
                    'error': 'frontend_url is required'
                }

            # Create launcher with provided parameters
            launcher = create_webview_launcher(
                app_name=app_name,
                frontend_url=frontend_url,
                bridge_host=params.get('bridge_host', '127.0.0.1'),
                bridge_port=params.get('bridge_port', 8765),
                window_title=params.get('window_title'),
                window_width=params.get('window_width', 1280),
                window_height=params.get('window_height', 800),
                resizable=params.get('resizable', True),
                fullscreen=params.get('fullscreen', False),
                use_webview=params.get('use_webview', True)
            )

            # Store launcher
            launcher_id = app_name
            self.launchers[launcher_id] = launcher
            self.active_launcher = launcher

            return {
                'success': True,
                'launcher_id': launcher_id,
                'message': f'Webview launcher created for {app_name}',
                'config': {
                    'app_name': app_name,
                    'frontend_url': frontend_url,
                    'webview_available': launcher.webview_available
                }
            }

        except Exception as e:
            return {
                'success': False,
                'error': f'Failed to create launcher: {str(e)}'
            }

    async def start_launcher(self, params: dict) -> dict:
        """
        Start a webview launcher

        Args:
            params: {
                'launcher_id': str,  # Optional, uses active launcher if not provided
                'open_window': bool  # Optional, default True
            }

        Returns:
            dict: {
                'success': bool,
                'message': str
            }
        """
        try:
            launcher_id = params.get('launcher_id')
            open_window = params.get('open_window', True)

            # Get launcher
            if launcher_id:
                launcher = self.launchers.get(launcher_id)
                if not launcher:
                    return {
                        'success': False,
                        'error': f'Launcher {launcher_id} not found'
                    }
            else:
                launcher = self.active_launcher
                if not launcher:
                    return {
                        'success': False,
                        'error': 'No active launcher found'
                    }

            # Start launcher
            launcher.start(open_window=open_window)

            return {
                'success': True,
                'message': f'Launcher started successfully',
                'launcher_id': launcher_id or 'active'
            }

        except Exception as e:
            return {
                'success': False,
                'error': f'Failed to start launcher: {str(e)}'
            }

    async def stop_launcher(self, params: dict) -> dict:
        """
        Stop a webview launcher

        Args:
            params: {
                'launcher_id': str  # Optional, uses active launcher if not provided
            }

        Returns:
            dict: {
                'success': bool,
                'message': str
            }
        """
        try:
            launcher_id = params.get('launcher_id')

            # Get launcher
            if launcher_id:
                launcher = self.launchers.get(launcher_id)
                if not launcher:
                    return {
                        'success': False,
                        'error': f'Launcher {launcher_id} not found'
                    }
            else:
                launcher = self.active_launcher
                if not launcher:
                    return {
                        'success': False,
                        'error': 'No active launcher found'
                    }

            # Stop launcher
            launcher.stop()

            return {
                'success': True,
                'message': f'Launcher stopped successfully',
                'launcher_id': launcher_id or 'active'
            }

        except Exception as e:
            return {
                'success': False,
                'error': f'Failed to stop launcher: {str(e)}'
            }

    async def reload_webview(self, params: dict) -> dict:
        """
        Reload webview window

        Args:
            params: {
                'launcher_id': str  # Optional, uses active launcher if not provided
            }

        Returns:
            dict: {
                'success': bool,
                'message': str
            }
        """
        try:
            launcher_id = params.get('launcher_id')

            # Get launcher
            if launcher_id:
                launcher = self.launchers.get(launcher_id)
                if not launcher:
                    return {
                        'success': False,
                        'error': f'Launcher {launcher_id} not found'
                    }
            else:
                launcher = self.active_launcher
                if not launcher:
                    return {
                        'success': False,
                        'error': 'No active launcher found'
                    }

            # Reload webview
            launcher.reload_webview()

            return {
                'success': True,
                'message': 'Webview reloaded successfully',
                'launcher_id': launcher_id or 'active'
            }

        except Exception as e:
            return {
                'success': False,
                'error': f'Failed to reload webview: {str(e)}'
            }

    async def launch_pymatrix(self, params: dict) -> dict:
        """
        Launch pyMatrix application with webview GUI

        Args:
            params: {
                'backend_host': str,  # Optional, default '127.0.0.1'
                'backend_port': int,  # Optional, default 8000
                'frontend_url': str,  # Optional, default 'http://localhost:3007'
                'bridge_port': int,  # Optional, default 8765
                'window_title': str,  # Optional
            }

        Returns:
            dict: {
                'success': bool,
                'message': str,
                'launcher_id': str
            }
        """
        try:
            backend_host = params.get('backend_host', '127.0.0.1')
            backend_port = params.get('backend_port', 8000)
            frontend_url = params.get('frontend_url', 'http://localhost:3007')
            bridge_port = params.get('bridge_port', 8765)
            window_title = params.get('window_title', 'pyMatrix - Android Device Control')

            # Launch pyMatrix GUI
            launcher = launch_pymatrix_gui(
                backend_host=backend_host,
                backend_port=backend_port,
                frontend_url=frontend_url,
                bridge_port=bridge_port,
                window_title=window_title
            )

            # Store launcher
            launcher_id = 'pyMatrix'
            self.launchers[launcher_id] = launcher
            self.active_launcher = launcher

            return {
                'success': True,
                'message': 'pyMatrix GUI launched successfully',
                'launcher_id': launcher_id,
                'config': {
                    'backend_host': backend_host,
                    'backend_port': backend_port,
                    'frontend_url': frontend_url
                }
            }

        except Exception as e:
            return {
                'success': False,
                'error': f'Failed to launch pyMatrix: {str(e)}'
            }

    async def list_launchers(self, params: dict) -> dict:
        """
        List all active launchers

        Returns:
            dict: {
                'success': bool,
                'launchers': List[dict],
                'active_launcher_id': str
            }
        """
        try:
            launchers_info = []

            for launcher_id, launcher in self.launchers.items():
                launchers_info.append({
                    'launcher_id': launcher_id,
                    'app_name': launcher.app_name,
                    'frontend_url': launcher.frontend_url,
                    'webview_available': launcher.webview_available,
                    'is_active': launcher == self.active_launcher
                })

            active_id = None
            if self.active_launcher:
                for launcher_id, launcher in self.launchers.items():
                    if launcher == self.active_launcher:
                        active_id = launcher_id
                        break

            return {
                'success': True,
                'launchers': launchers_info,
                'active_launcher_id': active_id,
                'total_launchers': len(self.launchers)
            }

        except Exception as e:
            return {
                'success': False,
                'error': f'Failed to list launchers: {str(e)}'
            }

    async def get_launcher_status(self, params: dict) -> dict:
        """
        Get status of a webview launcher

        Args:
            params: {
                'launcher_id': str  # Optional, uses active launcher if not provided
            }

        Returns:
            dict: {
                'success': bool,
                'status': dict
            }
        """
        try:
            launcher_id = params.get('launcher_id')

            # Get launcher
            if launcher_id:
                launcher = self.launchers.get(launcher_id)
                if not launcher:
                    return {
                        'success': False,
                        'error': f'Launcher {launcher_id} not found'
                    }
            else:
                launcher = self.active_launcher
                if not launcher:
                    return {
                        'success': False,
                        'error': 'No active launcher found'
                    }

            return {
                'success': True,
                'status': {
                    'app_name': launcher.app_name,
                    'frontend_url': launcher.frontend_url,
                    'window_title': launcher.window_title,
                    'webview_available': launcher.webview_available,
                    'bridge_running': launcher.bridge.is_running() if hasattr(launcher, 'bridge') else False
                }
            }

        except Exception as e:
            return {
                'success': False,
                'error': f'Failed to get launcher status: {str(e)}'
            }
