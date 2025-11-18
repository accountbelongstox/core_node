#!/usr/bin/env python3
"""
Flutter Design Documentation Tool - Main Server
Multi-file modular architecture
"""

from __future__ import annotations

import json
import threading
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Dict, List
from urllib.parse import urlparse, parse_qs

# Import API modules
from api import app_checker, file_tree, file_reader, folder_opener, file_writer
from utils import path_utils, port_manager

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 5757

STATIC_DIR = Path(__file__).resolve().parent / "static"

# Global shutdown event
shutdown_event = threading.Event()


def read_static_file(relative_path: str) -> bytes:
    """Read static file from static directory"""
    path = STATIC_DIR / relative_path
    if not path.exists():
        raise FileNotFoundError(relative_path)
    return path.read_bytes()


class DesignDocRequestHandler(BaseHTTPRequestHandler):
    """HTTP request handler for design documentation tool"""

    def do_GET(self) -> None:  # noqa: N802
        """Handle GET requests"""
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        query_params = parse_qs(parsed_url.query)

        # Root - serve HTML
        if path == "/":
            self.respond_file("index.html", "text/html")

        # API: Get all apps
        elif path == "/api/apps":
            apps_dir = path_utils.get_apps_dir()
            apps = app_checker.list_apps(apps_dir)
            results = [app_checker.check_app(app) for app in apps]
            self.respond_json(results)

        # API: Get file tree for an app
        elif path.startswith("/api/apps/") and path.endswith("/tree"):
            app_name = path.split("/")[3]
            apps_dir = path_utils.get_apps_dir()
            app_path = apps_dir / app_name

            if not app_path.exists():
                self.send_error(HTTPStatus.NOT_FOUND, "App not found")
                return

            design_dir = path_utils.get_design_dir(app_path)
            if not design_dir.exists():
                self.respond_json({"error": "Design directory not found"})
                return

            tree = file_tree.build_file_tree(design_dir, design_dir.parent)
            self.respond_json(tree)

        # API: Read file content
        elif path == "/api/file/content":
            file_path_str = query_params.get("path", [""])[0]
            if not file_path_str:
                self.send_error(HTTPStatus.BAD_REQUEST, "Missing path parameter")
                return

            file_path = Path(file_path_str)
            apps_dir = path_utils.get_apps_dir()

            # Security check: ensure file is within apps directory
            if not path_utils.is_safe_path(apps_dir, file_path):
                self.send_error(HTTPStatus.FORBIDDEN, "Access denied")
                return

            result = file_reader.read_file_content(file_path)
            self.respond_json(result)

        # Static files
        elif path.startswith("/static/"):
            self.handle_static_file(path)

        else:
            self.send_error(HTTPStatus.NOT_FOUND)

    def do_POST(self) -> None:  # noqa: N802
        """Handle POST requests"""
        # Shutdown server
        if self.path == "/api/shutdown":
            print("\n[SHUTDOWN] Received shutdown request via API")
            self.respond_json({"success": True, "message": "Server shutting down..."})

            # Set shutdown event in a separate thread to allow response to be sent
            def delayed_shutdown():
                import time
                time.sleep(0.5)  # Give time for response to be sent
                shutdown_event.set()

            threading.Thread(target=delayed_shutdown, daemon=True).start()

        # Create missing items for an app
        elif self.path.startswith("/api/apps/") and self.path.endswith("/fix"):
            app_name = self.path.split("/")[3]
            apps_dir = path_utils.get_apps_dir()
            app_path = apps_dir / app_name

            if not app_path.exists():
                self.respond_json({"success": False, "error": "App not found"})
                return

            created = app_checker.create_missing_items(app_path)
            self.respond_json({"success": True, "status": "ok", "created": created})

        # Open folder in explorer
        elif self.path == "/api/folder/open":
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_length)
                data = json.loads(body.decode('utf-8'))

                folder_path_str = data.get("path", "")
                if not folder_path_str:
                    self.respond_json({"success": False, "error": "Missing path parameter"})
                    return

                folder_path = Path(folder_path_str)
                apps_dir = path_utils.get_apps_dir()

                # Security check: ensure folder is within apps directory
                if not path_utils.is_safe_path(apps_dir, folder_path):
                    self.respond_json({"success": False, "error": "Access denied"})
                    return

                result = folder_opener.open_folder(folder_path)
                self.respond_json(result)
            except Exception as e:
                self.respond_json({"success": False, "error": str(e)})

        # Save file content
        elif self.path == "/api/file/save":
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_length)
                data = json.loads(body.decode('utf-8'))

                file_path_str = data.get("path", "")
                content = data.get("content", "")
                validate_json = data.get("validate_json", False)

                if not file_path_str:
                    self.respond_json({"success": False, "error": "Missing path parameter"})
                    return

                file_path = Path(file_path_str)
                apps_dir = path_utils.get_apps_dir()

                # Security check: ensure file is within apps directory
                if not path_utils.is_safe_path(apps_dir, file_path):
                    self.respond_json({"success": False, "error": "Access denied"})
                    return

                # Save file
                result = file_writer.save_file_content(file_path, content, validate_json)
                self.respond_json(result)

            except json.JSONDecodeError as e:
                self.respond_json({"success": False, "error": f"Invalid request JSON: {str(e)}"})
            except Exception as e:
                self.respond_json({"success": False, "error": str(e)})

        else:
            self.respond_json({"success": False, "error": "Endpoint not found"})

    def handle_static_file(self, path: str) -> None:
        """Handle static file requests"""
        filename = path.replace("/static/", "", 1)

        # Determine content type
        content_types = {
            ".html": "text/html",
            ".css": "text/css",
            ".js": "application/javascript",
            ".json": "application/json",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".svg": "image/svg+xml",
        }

        extension = Path(filename).suffix.lower()
        content_type = content_types.get(extension, "application/octet-stream")

        self.respond_file(filename, content_type)

    def respond_file(self, filename: str, content_type: str) -> None:
        """Respond with file content"""
        try:
            payload = read_static_file(filename)
        except FileNotFoundError:
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", f"{content_type}; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def respond_json(self, data: any) -> None:
        """Respond with JSON data"""
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, fmt: str, *args) -> None:  # noqa: A003
        """Suppress default logging"""
        return


def run_server(host: str = DEFAULT_HOST, port: int = DEFAULT_PORT) -> None:
    """Run the HTTP server"""
    apps_dir = path_utils.get_apps_dir()

    # Clean up old server instances on the same port
    if not port_manager.cleanup_old_server(port, auto_kill=True):
        print(f"\n[ERROR] Port {port} is in use and could not be freed.")
        print(f"[ERROR] Please manually stop the process or use a different port.")
        return

    # Wait a moment for port to be fully released
    if not port_manager.wait_for_port_release(port, timeout=3):
        print(f"\n[WARNING] Port {port} may still be in use. Attempting to start anyway...")

    # Auto-initialize all apps on startup
    init_summary = app_checker.auto_initialize_all_apps(apps_dir)

    # Start server
    try:
        server = ThreadingHTTPServer((host, port), DesignDocRequestHandler)
    except OSError as e:
        if "Address already in use" in str(e) or "Only one usage" in str(e):
            print(f"\n[ERROR] Port {port} is still in use after cleanup attempt.")
            print(f"[ERROR] Please wait a few seconds and try again.")
            return
        else:
            raise

    apps = app_checker.list_apps(apps_dir)

    print("Flutter Design Documentation Tool")
    print("=" * 50)
    print(f"Found {len(apps)} apps in {apps_dir}")
    print(f"\nBrowse: http://{host}:{port}")
    print(f"Shutdown: POST to http://{host}:{port}/api/shutdown")
    print("Press Ctrl+C to stop the server")
    print("=" * 50)

    # Run server in a separate thread so we can monitor shutdown event
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    try:
        # Wait for shutdown event or keyboard interrupt
        while not shutdown_event.is_set():
            shutdown_event.wait(timeout=1.0)
    except KeyboardInterrupt:
        print("\n\n[SHUTDOWN] Keyboard interrupt received")
    finally:
        print("[SHUTDOWN] Shutting down server...")
        server.shutdown()
        server.server_close()
        print("[SHUTDOWN] Server stopped successfully")


if __name__ == "__main__":
    run_server()
