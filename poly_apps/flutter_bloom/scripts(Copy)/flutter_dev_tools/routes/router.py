#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Router - Route matching and dispatching
"""

import re
import threading
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Callable

# Import from pycore following standards
from pycore.pyfoundations import ColorPrint

# Import route handlers
from routes.app_routes import AppRoutesHandler
from routes.file_routes import FileRoutesHandler
from routes.folder_routes import FolderRoutesHandler
from routes.pageview_routes import PageViewRoutesHandler
from routes.comparison_routes import ComparisonRoutesHandler
from routes.config_routes import ConfigRoutesHandler
from routes.system_routes import SystemRoutesHandler
from routes.static_routes import StaticRoutesHandler


class Router:
    """
    Router for HTTP requests

    Matches URL paths to handler functions
        Supports path parameters (e.g., /api/apps/:app_name/tree)
    """

    def __init__(self, static_dir: Path, shutdown_event: threading.Event):
        """
        Initialize router

        Args:
            static_dir: Static files directory
            shutdown_event: Event for server shutdown
        """
        self.static_dir = static_dir
        self.shutdown_event = shutdown_event

        # Route patterns (path_pattern, handler_method, method)
        self.routes: List[Tuple[str, str, str]] = []

        self._initialize_routes()

    def _initialize_routes(self) -> None:
        """Initialize all routes"""
        # Static routes
        self.routes.append(("/", "static.serve_index", "GET"))
        self.routes.append(("/static/*", "static.serve_static", "GET"))

        # App routes
        self.routes.append(("/api/apps", "app.list_apps", "GET"))
        self.routes.append(("/api/apps/:app_name/tree", "app.get_file_tree", "GET"))
        self.routes.append(("/api/apps/:app_name/fix", "app.fix_missing_items", "POST"))

        # File routes
        self.routes.append(("/api/file/content", "file.read_file", "GET"))
        self.routes.append(("/api/file/image", "file.serve_image", "GET"))
        self.routes.append(("/api/file/save", "file.save_file", "POST"))

        # Folder routes
        self.routes.append(("/api/folder/open", "folder.open_folder", "POST"))

        # PageView routes
        self.routes.append(("/api/apps/:app_name/pageview/stats", "pageview.get_stats", "GET"))
        self.routes.append(("/api/apps/:app_name/pageview/update", "pageview.update_pageview_map", "POST"))
        self.routes.append(("/api/apps/:app_name/pageview/upload-actual", "pageview.upload_actual_image", "POST"))

        # Comparison routes
        self.routes.append(("/api/apps/:app_name/comparison/create", "comparison.create_comparison", "POST"))
        self.routes.append(("/api/apps/:app_name/comparison/list/:page_key", "comparison.list_comparisons", "GET"))
        self.routes.append(("/api/comparison/download/:app_name/:page_key/*", "comparison.download_comparison", "GET"))

        # Config routes
        self.routes.append(("/api/config", "config.get_config", "GET"))
        self.routes.append(("/api/config", "config.update_config", "POST"))
        self.routes.append(("/api/config/reset", "config.reset_config", "POST"))

        # System routes
        self.routes.append(("/api/shutdown", "system.shutdown_server", "POST"))
        self.routes.append(("/api/system/info", "system.get_system_info", "GET"))

    def _pattern_to_regex(self, pattern: str) -> Tuple[re.Pattern, List[str]]:
        """
        Convert URL pattern to regex

        Args:
            pattern: URL pattern (e.g., "/api/apps/:app_name/tree")

        Returns:
            (compiled regex, list of parameter names)
        """
        param_names = []
        regex_pattern = pattern

        # Replace :param with named group
        def replace_param(match):
            param_name = match.group(1)
            param_names.append(param_name)
            return f"(?P<{param_name}>[^/]+)"

        regex_pattern = re.sub(r':(\w+)', replace_param, regex_pattern)

        # Replace * wildcard
        regex_pattern = regex_pattern.replace('*', '.*')

        # Anchor pattern
        regex_pattern = f"^{regex_pattern}$"

        return re.compile(regex_pattern), param_names

    def match_route(
        self,
        path: str,
        method: str
    ) -> Optional[Tuple[str, Dict[str, str]]]:
        """
        Match path to route handler

        Args:
            path: Request path
            method: HTTP method

        Returns:
            (handler_name, params_dict) or None
        """
        for pattern, handler, route_method in self.routes:
            if route_method != method:
                continue

            regex, param_names = self._pattern_to_regex(pattern)
            match = regex.match(path)

            if match:
                params = match.groupdict()
                # Handle wildcard captures
                if '*' in pattern:
                    # Extract remaining path for wildcard
                    if path.startswith('/static/'):
                        params['filename'] = path.replace('/static/', '', 1)
                    elif '/comparison/download/' in path:
                        parts = path.split('/')
                        if len(parts) >= 7:
                            params['filename'] = '/'.join(parts[6:])

                return handler, params

        return None

    def dispatch(self, request_handler: BaseHTTPRequestHandler, method: str) -> None:
        """
        Dispatch request to appropriate handler

        Args:
            request_handler: HTTP request handler
            method: HTTP method
        """
        path = request_handler.path.split('?')[0]  # Remove query string

        match_result = self.match_route(path, method)

        if not match_result:
            ColorPrint.yellow(f"[Router] No route found for {method} {path}")
            request_handler.send_error(404, "Not Found")
            return

        handler_name, params = match_result
        ColorPrint.blue(f"[Router] {method} {path} -> {handler_name}")

        # Get handler
        try:
            handler_obj = self._get_handler(request_handler, handler_name.split('.')[0])
            method_name = handler_name.split('.')[1]

            # Call handler method with params
            if params:
                # Pass params as arguments
                getattr(handler_obj, method_name)(**params)
            else:
                getattr(handler_obj, method_name)()

        except Exception as e:
            ColorPrint.red(f"[Router] Handler error: {e}")
            import traceback
            traceback.print_exc()
            request_handler.send_error(500, "Internal Server Error")

    def _get_handler(self, request_handler: BaseHTTPRequestHandler, handler_type: str):
        """
        Get handler instance

        Args:
            request_handler: HTTP request handler
            handler_type: Handler type name

        Returns:
            Handler instance
        """
        handlers = {
            'app': AppRoutesHandler(request_handler),
            'file': FileRoutesHandler(request_handler),
            'folder': FolderRoutesHandler(request_handler),
            'pageview': PageViewRoutesHandler(request_handler),
            'comparison': ComparisonRoutesHandler(request_handler),
            'config': ConfigRoutesHandler(request_handler),
            'system': SystemRoutesHandler(request_handler, self.shutdown_event),
            'static': StaticRoutesHandler(request_handler, self.static_dir),
        }

        return handlers.get(handler_type)
