#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Routes Configuration - Centralized route definitions
"""

from typing import Dict, List, Callable, Tuple
from dataclasses import dataclass
from enum import Enum
import copy

from pycore.pyfoundations.serialized_worker import (
    SerializedSingletonProvider,
    init_serialized_owner,
    serialized_method,
)


class HTTPMethod(Enum):
    """HTTP methods"""
    GET = "GET"
    POST = "POST"
    PUT = "PUT"
    DELETE = "DELETE"


@dataclass
class RouteDefinition:
    """Route definition"""
    path: str
    method: HTTPMethod
    handler: str  # Handler function name or module.function
    description: str = ""


class RoutesConfig:
    """
    Routes configuration manager

    Centralizes all route definitions for easy management and extension
    """

    def __init__(self):
        self.routes: List[RouteDefinition] = []
        self._initialize_routes()
        init_serialized_owner(
            self,
            'flutter_dev_tools.routes.state',
            'FlutterDevToolsRoutesStateThread',
        )

    def _initialize_routes(self) -> None:
        """Initialize all route definitions"""
        # === Static files ===
        self.add_route("/", HTTPMethod.GET, "static.serve_index", "Serve index.html")
        self.add_route("/static/*", HTTPMethod.GET, "static.serve_static", "Serve static files")

        # === App management ===
        self.add_route("/api/apps", HTTPMethod.GET, "app_routes.list_apps", "List all apps")
        self.add_route("/api/apps/:app/tree", HTTPMethod.GET, "app_routes.get_file_tree", "Get app file tree")
        self.add_route("/api/apps/:app/fix", HTTPMethod.POST, "app_routes.fix_missing_items", "Create missing items")
        self.add_route("/api/apps/:app/pageview/stats", HTTPMethod.GET, "pageview_routes.get_stats", "Get pageview stats")

        # === File operations ===
        self.add_route("/api/file/content", HTTPMethod.GET, "file_routes.read_file", "Read file content")
        self.add_route("/api/file/image", HTTPMethod.GET, "file_routes.serve_image", "Serve image file")
        self.add_route("/api/file/save", HTTPMethod.POST, "file_routes.save_file", "Save file content")

        # === Folder operations ===
        self.add_route("/api/folder/open", HTTPMethod.POST, "folder_routes.open_folder", "Open folder in explorer")

        # === PageView operations ===
        self.add_route("/api/apps/:app/pageview/update", HTTPMethod.POST, "pageview_routes.update_pageview_map", "Update pageview map")
        self.add_route("/api/apps/:app/pageview/upload-actual", HTTPMethod.POST, "pageview_routes.upload_actual_image", "Upload actual image")

        # === Comparison operations ===
        self.add_route("/api/apps/:app/comparison/create", HTTPMethod.POST, "comparison_routes.create_comparison", "Create comparison image")
        self.add_route("/api/apps/:app/comparison/list/:page", HTTPMethod.GET, "comparison_routes.list_comparisons", "List comparisons")
        self.add_route("/api/comparison/download/:app/:page/:file", HTTPMethod.GET, "comparison_routes.download_comparison", "Download comparison")

        # === Configuration operations ===
        self.add_route("/api/config", HTTPMethod.GET, "config_routes.get_config", "Get configuration")
        self.add_route("/api/config", HTTPMethod.POST, "config_routes.update_config", "Update configuration")
        self.add_route("/api/config/reset", HTTPMethod.POST, "config_routes.reset_config", "Reset to defaults")

        # === System operations ===
        self.add_route("/api/shutdown", HTTPMethod.POST, "system_routes.shutdown_server", "Shutdown server")
        self.add_route("/api/system/info", HTTPMethod.GET, "system_routes.get_system_info", "Get system information")

    def add_route(self, path: str, method: HTTPMethod, handler: str, description: str = "") -> None:
        """
        Add a route definition

        Args:
            path: URL path (supports :param and * wildcards)
            method: HTTP method
            handler: Handler function reference
            description: Route description
        """
        if hasattr(self, '_serialized_queue_name'):
            self._add_route(path, method, handler, description)
            return
        self.routes.append(RouteDefinition(
            path=path,
            method=method,
            handler=handler,
            description=description
        ))

    @serialized_method
    def _add_route(self, path: str, method: HTTPMethod, handler: str, description: str) -> None:
        self.routes.append(RouteDefinition(path, method, handler, description))

    @serialized_method
    def get_routes_by_method(self, method: HTTPMethod) -> List[RouteDefinition]:
        """Get all routes for specific HTTP method"""
        return copy.deepcopy([r for r in self.routes if r.method == method])

    @serialized_method
    def get_route_patterns(self) -> Dict[HTTPMethod, List[Tuple[str, str]]]:
        """
        Get route patterns grouped by method

        Returns:
            Dict mapping HTTPMethod to list of (path, handler) tuples
        """
        patterns = {method: [] for method in HTTPMethod}

        for route in self.routes:
            patterns[route.method].append((route.path, route.handler))

        return patterns

    @serialized_method
    def print_routes(self) -> None:
        """Print all registered routes"""
        print("\n" + "=" * 80)
        print("Registered Routes")
        print("=" * 80)

        for method in HTTPMethod:
            method_routes = self.get_routes_by_method(method)
            if method_routes:
                print(f"\n{method.value}:")
                for route in method_routes:
                    desc = f" - {route.description}" if route.description else ""
                    print(f"  {route.path}{desc}")

        print("=" * 80 + "\n")


_ROUTES_CONFIG_PROVIDER = SerializedSingletonProvider(
    RoutesConfig,
    'flutter_dev_tools.routes.provider',
    'FlutterDevToolsRoutesProviderThread',
)


def get_routes_config() -> RoutesConfig:
    """
    Get singleton RoutesConfig instance

    Returns:
        RoutesConfig instance
    """
    return _ROUTES_CONFIG_PROVIDER.get()
