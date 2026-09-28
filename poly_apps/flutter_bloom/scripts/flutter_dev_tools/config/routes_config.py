#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Routes Configuration - Centralized route definitions
"""

from typing import Dict, List, Callable, Tuple
from dataclasses import dataclass
from enum import Enum


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
        route = RouteDefinition(
            path=path,
            method=method,
            handler=handler,
            description=description
        )
        self.routes.append(route)

    def get_routes_by_method(self, method: HTTPMethod) -> List[RouteDefinition]:
        """Get all routes for specific HTTP method"""
        return [r for r in self.routes if r.method == method]

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


# Singleton instance
_routes_config_instance = None


def get_routes_config() -> RoutesConfig:
    """
    Get singleton RoutesConfig instance

    Returns:
        RoutesConfig instance
    """
    global _routes_config_instance

    if _routes_config_instance is None:
        _routes_config_instance = RoutesConfig()

    return _routes_config_instance
