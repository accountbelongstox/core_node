#!/usr/bin/env python3
"""Flutter design documentation inspection server."""

from __future__ import annotations

import json
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Dict, List

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = (SCRIPT_DIR / "../../..").resolve()
FLUTTER_APPS_DIR = PROJECT_ROOT / "poly_apps" / "flutter_bloom" / "lib" / "apps"
DESIGN_DIR_NAME = "design_docs_and_progress"
STATIC_DIR = SCRIPT_DIR / "static"

REQUIRED_SUBDIRS = [
    "concept_notes",
    "wireframes",
    "flows",
    "final_designs",
    "progress_logs",
    "feature_progress",
    "backend_bridge",
]
PROGRESS_FILES = [
    ("progress_logs", "concept_progress.md"),
    ("progress_logs", "wireframe_progress.md"),
    ("progress_logs", "flow_progress.md"),
    ("progress_logs", "design_progress.md"),
    ("progress_logs", "ui_dev_progress.md"),
]
MAP_FILE = ("final_designs", "pageview_map.json")
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 5757
PROGRESS_TEMPLATE = "# Progress Log\n\nDescribe progress milestones here.\n"
MAP_PLACEHOLDER = {
    "image_file": "",
    "page_key": "",
    "elements": [
        {
            "type": "text",
            "text": "",
            "bbox": [0, 0, 0, 0],
            "color": "#000000",
            "notes": "Add details here"
        }
    ]
}


def list_apps() -> List[Path]:
    if not FLUTTER_APPS_DIR.exists():
        return []
    return sorted(p for p in FLUTTER_APPS_DIR.iterdir() if p.is_dir())


def has_child_directory(path: Path) -> bool:
    if not path.exists():
        return False
    return any(child.is_dir() and not child.name.startswith('.') for child in path.iterdir())


def build_missing_entry(path: Path) -> str:
    return str(path)


def check_app(app_path: Path) -> Dict[str, List[str]]:
    issues: List[str] = []
    missing: List[str] = []
    design_dir = app_path / DESIGN_DIR_NAME
    if not design_dir.exists():
        issues.append(f"missing directory: {DESIGN_DIR_NAME}")
        missing.append(build_missing_entry(design_dir))
        return {
            "app": app_path.name,
            "design_path": str(design_dir),
            "issues": issues,
            "missing": missing,
        }

    for sub in REQUIRED_SUBDIRS:
        sub_path = design_dir / sub
        if not sub_path.exists():
            issues.append(f"missing subdirectory: {DESIGN_DIR_NAME}/{sub}")
            missing.append(build_missing_entry(sub_path))

    for parent, filename in PROGRESS_FILES:
        parent_path = design_dir / parent
        if parent_path.exists():
            file_path = parent_path / filename
            if not file_path.exists():
                issues.append(f"missing progress file: {DESIGN_DIR_NAME}/{parent}/{filename}")
                missing.append(build_missing_entry(file_path))
        else:
            issues.append(f"missing progress directory: {DESIGN_DIR_NAME}/{parent}")
            missing.append(build_missing_entry(parent_path))

    map_parent, map_name = MAP_FILE
    map_path = design_dir / map_parent / map_name
    if not map_path.exists():
        issues.append(f"missing OCR map: {DESIGN_DIR_NAME}/{map_parent}/{map_name}")
        missing.append(build_missing_entry(map_path))

    func_dir = design_dir / "feature_progress"
    backend_dir = design_dir / "backend_bridge"
    if func_dir.exists() and not has_child_directory(func_dir):
        issues.append("feature_progress folder should contain at least one module subdirectory")
        missing.append(build_missing_entry(func_dir / "sample_module"))
    if backend_dir.exists() and not has_child_directory(backend_dir):
        issues.append("backend_bridge folder should contain subsystem subdirectories")
        missing.append(build_missing_entry(backend_dir / "sample_bridge"))

    return {
        "app": app_path.name,
        "design_path": str(design_dir),
        "issues": issues,
        "missing": missing,
    }


def collect_results() -> List[Dict[str, List[str]]]:
    return [check_app(app) for app in list_apps()]


def create_missing_items(app_path: Path) -> List[str]:
    created: List[str] = []
    design_dir = app_path / DESIGN_DIR_NAME
    if not design_dir.exists():
        design_dir.mkdir(parents=True, exist_ok=True)
        created.append(str(design_dir))

    for sub in REQUIRED_SUBDIRS:
        sub_path = design_dir / sub
        if not sub_path.exists():
            sub_path.mkdir(parents=True, exist_ok=True)
            created.append(str(sub_path))

    for parent, filename in PROGRESS_FILES:
        parent_path = design_dir / parent
        parent_path.mkdir(parents=True, exist_ok=True)
        file_path = parent_path / filename
        if not file_path.exists():
            file_path.write_text(PROGRESS_TEMPLATE, encoding="utf-8")
            created.append(str(file_path))

    map_parent, map_name = MAP_FILE
    map_parent_path = design_dir / map_parent
    map_parent_path.mkdir(parents=True, exist_ok=True)
    map_path = map_parent_path / map_name
    if not map_path.exists():
        map_path.write_text(json.dumps(MAP_PLACEHOLDER, indent=2), encoding="utf-8")
        created.append(str(map_path))

    feature_dir = design_dir / "feature_progress"
    if not has_child_directory(feature_dir):
        sample_module = feature_dir / "sample_module"
        sample_module.mkdir(parents=True, exist_ok=True)
        progress_file = sample_module / "progress.md"
        if not progress_file.exists():
            progress_file.write_text(PROGRESS_TEMPLATE, encoding="utf-8")
        created.append(str(sample_module))

    backend_dir = design_dir / "backend_bridge"
    if not has_child_directory(backend_dir):
        sample_bridge = backend_dir / "sample_bridge"
        sample_bridge.mkdir(parents=True, exist_ok=True)
        progress_file = sample_bridge / "progress.md"
        if not progress_file.exists():
            progress_file.write_text(PROGRESS_TEMPLATE, encoding="utf-8")
        created.append(str(sample_bridge))

    return created


def read_static_file(relative_path: str) -> bytes:
    path = STATIC_DIR / relative_path
    if not path.exists():
        raise FileNotFoundError(relative_path)
    return path.read_bytes()


class DesignDocRequestHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/":
            self.respond_file("index.html", "text/html")
        elif self.path == "/api/apps":
            self.respond_json(collect_results())
        elif self.path.startswith("/static/"):
            filename = self.path.replace("/static/", "", 1)
            if filename.endswith(".css"):
                self.respond_file(filename, "text/css")
            elif filename.endswith(".js"):
                self.respond_file(filename, "application/javascript")
            else:
                self.send_error(HTTPStatus.NOT_FOUND)
        else:
            self.send_error(HTTPStatus.NOT_FOUND)

    def do_POST(self) -> None:  # noqa: N802
        prefix = "/api/apps/"
        suffix = "/fix"
        if self.path.startswith(prefix) and self.path.endswith(suffix):
            app_name = self.path[len(prefix) : -len(suffix)]
            if not app_name:
                self.send_error(HTTPStatus.BAD_REQUEST)
                return
            app_path = FLUTTER_APPS_DIR / app_name
            if not app_path.exists():
                self.send_error(HTTPStatus.NOT_FOUND, "App not found")
                return
            created = create_missing_items(app_path)
            self.respond_json({"status": "ok", "created": created})
        else:
            self.send_error(HTTPStatus.NOT_FOUND)

    def respond_file(self, filename: str, content_type: str) -> None:
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

    def respond_json(self, data: List[Dict[str, List[str]]]) -> None:
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, fmt: str, *args) -> None:  # noqa: A003
        return


def run_server(host: str = DEFAULT_HOST, port: int = DEFAULT_PORT) -> None:
    server = ThreadingHTTPServer((host, port), DesignDocRequestHandler)
    apps = list_apps()
    print("Flutter design docs inspector")
    print(f"Found {len(apps)} apps under {FLUTTER_APPS_DIR}")
    print(f"Browse: http://{host}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down inspector...")
    finally:
        server.server_close()


if __name__ == "__main__":
    run_server()
