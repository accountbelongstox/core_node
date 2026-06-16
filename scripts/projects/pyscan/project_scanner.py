#!/usr/bin/env python3
"""
Project Scanner & Download Server
Scans the system for real code projects, packs each into .zip (skipping
node_modules, .git, vendor, __pycache__, etc.), then serves a web page
on 0.0.0.0:<port> where users can browse and download any project zip.

Usage:
    python3 project_scanner.py                  # scan + serve on port 18090
    python3 project_scanner.py --port 9999      # custom port
    python3 project_scanner.py --scan-only      # scan + pack, no server
    python3 project_scanner.py --serve-only     # serve existing zips, no re-scan
"""

import os
import sys
import json
import zipfile
import argparse
import socket
import time
import threading
from pathlib import Path
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import quote, unquote
from datetime import datetime

# =============================================================================
# Configuration
# =============================================================================

DEFAULT_PORT = 18090
SCRIPT_DIR = Path(__file__).resolve().parent
ZIP_DIR = SCRIPT_DIR / "zips"
MANIFEST_FILE = SCRIPT_DIR / "manifest.json"

# Directories to skip when zipping
SKIP_DIRS = {
    "node_modules", ".git", "vendor", "__pycache__", ".venv", "venv", "env",
    ".tox", ".mypy_cache", ".pytest_cache", ".cache", ".next", ".nuxt",
    "target", "dist", "build", "out", ".gradle", ".m2", "bin", "obj",
    ".idea", ".vs", "coverage", ".eggs", "*.egg-info", ".sass-cache",
    ".parcel-cache", ".turbo", ".vercel", ".output", ".svelte-kit",
    ".dart_tool", ".pub-cache", "Pods", ".angular",
}

SKIP_EXTENSIONS = {
    ".pyc", ".pyo", ".o", ".obj", ".so", ".dylib", ".dll", ".exe",
    ".class", ".jar", ".war", ".ear",
    ".log", ".tmp", ".swp", ".swo",
    ".DS_Store", "Thumbs.db",
}

# Max file size to include (50MB)
MAX_FILE_SIZE = 50 * 1024 * 1024

# Noise paths to exclude from scanning
NOISE_PATTERNS = [
    "/.npm/", "/.vscode-server/", "/.claude/plugins/", "/.codex/",
    "/.local/flutter", "/snap/flutter/", "/.config/nvim", "/.local/share/nvim/",
    "/.local/lib/", "/.local/bin/", "/.cargo/registry/", "/.rustup/",
    "/.pyenv/", "/.nvm/", "/.sdkman/", "/_ubuntu_24/go/", "/go/pkg/mod/",
    "/claude-code-", "/.local/share/pnpm/",
]

# Project indicator files
PROJECT_INDICATORS = [
    ".git", "package.json", "requirements.txt", "setup.py", "pyproject.toml",
    "composer.json", "Cargo.toml", "go.mod", "pom.xml", "build.gradle",
    "CMakeLists.txt", "Makefile", "pubspec.yaml",
]

# =============================================================================
# Scanner
# =============================================================================

def is_noise(path_str):
    for pat in NOISE_PATTERNS:
        if pat in path_str:
            return True
    if path_str.startswith("/home/") or path_str.startswith("/root"):
        parts = path_str.rstrip("/").split("/")
        if path_str.startswith("/home/") and len(parts) <= 3:
            return True
        if path_str == "/root":
            return True
    return False


def detect_type(project_dir):
    d = Path(project_dir)
    types = []
    if (d / "package.json").exists():
        types.append("Node")
    if (d / "composer.json").exists():
        types.append("PHP")
    if any((d / f).exists() for f in ["requirements.txt", "setup.py", "pyproject.toml"]):
        types.append("Python")
    if (d / "Cargo.toml").exists():
        types.append("Rust")
    if (d / "go.mod").exists():
        types.append("Go")
    if any((d / f).exists() for f in ["pom.xml", "build.gradle"]):
        types.append("Java")
    if (d / "CMakeLists.txt").exists():
        types.append("C++")
    if (d / "pubspec.yaml").exists():
        types.append("Flutter")
    if any(d.glob("*.sln")) or any(d.glob("*.csproj")):
        types.append("C#")
    if any(d.glob("*.R")) or any(d.glob("*.Rproj")):
        types.append("R")
    if (d / ".git").is_dir():
        types.append("git")
    return types if types else ["Unknown"]


def get_dir_size(path, skip_dirs=None):
    total = 0
    skip_dirs = skip_dirs or SKIP_DIRS
    try:
        for entry in os.scandir(path):
            if entry.is_dir(follow_symlinks=False):
                if entry.name in skip_dirs:
                    continue
                total += get_dir_size(entry.path, skip_dirs)
            elif entry.is_file(follow_symlinks=False):
                total += entry.stat().st_size
    except (PermissionError, OSError):
        pass
    return total


def format_size(size_bytes):
    for unit in ["B", "KB", "MB", "GB"]:
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} TB"


def scan_projects():
    scan_roots = ["/root", "/opt", "/srv", "/www"]
    try:
        for entry in os.scandir("/home"):
            if entry.is_dir():
                scan_roots.append(entry.path)
    except (PermissionError, OSError):
        pass

    projects = {}
    print("[SCAN] Scanning for projects...")

    for root_dir in scan_roots:
        if not os.path.isdir(root_dir):
            continue
        for dirpath, dirnames, filenames in os.walk(root_dir, followlinks=False):
            depth = dirpath.replace(root_dir, "").count(os.sep)
            if depth > 4:
                dirnames.clear()
                continue

            dirnames[:] = [
                d for d in dirnames
                if d not in SKIP_DIRS
                and not d.startswith(".")
                or d == ".git"
            ]

            if is_noise(dirpath):
                dirnames.clear()
                continue

            is_project = False
            for indicator in PROJECT_INDICATORS:
                indicator_path = os.path.join(dirpath, indicator)
                if os.path.exists(indicator_path):
                    is_project = True
                    break

            if is_project and dirpath not in projects:
                projects[dirpath] = True
                dirnames.clear()

    # Filter: remove children if parent is already a project
    sorted_paths = sorted(projects.keys())
    filtered = []
    for p in sorted_paths:
        if not any(p.startswith(parent + "/") for parent in filtered):
            filtered.append(p)

    result = []
    for proj_path in filtered:
        if is_noise(proj_path):
            continue
        types = detect_type(proj_path)
        src_size = get_dir_size(proj_path)
        try:
            mtime = os.path.getmtime(proj_path)
            last_mod = datetime.fromtimestamp(mtime).strftime("%Y-%m-%d")
        except OSError:
            last_mod = "unknown"

        owner = "system"
        if proj_path.startswith("/home/"):
            parts = proj_path.split("/")
            if len(parts) >= 3:
                owner = parts[2]
        elif proj_path.startswith("/root"):
            owner = "root"

        result.append({
            "path": proj_path,
            "name": os.path.basename(proj_path) or proj_path.replace("/", "_"),
            "types": types,
            "source_size": src_size,
            "source_size_human": format_size(src_size),
            "last_modified": last_mod,
            "owner": owner,
            "zip_file": None,
            "zip_size": None,
            "zip_size_human": None,
        })

    print(f"[SCAN] Found {len(result)} real project(s)")
    return result


# =============================================================================
# Zipper
# =============================================================================

def should_skip_file(rel_path):
    parts = Path(rel_path).parts
    for part in parts:
        if part in SKIP_DIRS:
            return True
        if part.endswith(".egg-info"):
            return True
    ext = os.path.splitext(rel_path)[1].lower()
    if ext in SKIP_EXTENSIONS:
        return True
    return False


def zip_project(project_info):
    proj_path = project_info["path"]
    safe_name = proj_path.strip("/").replace("/", "__")
    zip_name = f"{safe_name}.zip"
    zip_path = ZIP_DIR / zip_name

    if zip_path.exists():
        project_info["zip_file"] = zip_name
        sz = zip_path.stat().st_size
        project_info["zip_size"] = sz
        project_info["zip_size_human"] = format_size(sz)
        print(f"  [SKIP] {zip_name} (already exists)")
        return

    print(f"  [ZIP] {proj_path} -> {zip_name}")
    file_count = 0
    try:
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
            base = os.path.basename(proj_path.rstrip("/")) or safe_name
            for dirpath, dirnames, filenames in os.walk(proj_path, followlinks=False):
                dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.endswith(".egg-info")]

                for fname in filenames:
                    fpath = os.path.join(dirpath, fname)
                    rel = os.path.relpath(fpath, os.path.dirname(proj_path))

                    if should_skip_file(rel):
                        continue
                    try:
                        fsize = os.path.getsize(fpath)
                    except OSError:
                        continue
                    if fsize > MAX_FILE_SIZE:
                        continue
                    try:
                        zf.write(fpath, rel)
                        file_count += 1
                    except (PermissionError, OSError):
                        continue

        sz = zip_path.stat().st_size
        project_info["zip_file"] = zip_name
        project_info["zip_size"] = sz
        project_info["zip_size_human"] = format_size(sz)
        print(f"       {format_size(sz)} ({file_count} files)")
    except Exception as e:
        print(f"  [ERROR] {proj_path}: {e}")
        zip_path.unlink(missing_ok=True)


def pack_all(projects):
    ZIP_DIR.mkdir(parents=True, exist_ok=True)
    print(f"\n[PACK] Packing {len(projects)} project(s) to {ZIP_DIR}")
    for i, proj in enumerate(projects, 1):
        print(f"\n[{i}/{len(projects)}]")
        zip_project(proj)
    # Save manifest
    with open(MANIFEST_FILE, "w") as f:
        json.dump(projects, f, indent=2, ensure_ascii=False)
    print(f"\n[PACK] Done. Manifest: {MANIFEST_FILE}")


# =============================================================================
# Web Server
# =============================================================================

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Project Downloads</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
         background: #0f172a; color: #e2e8f0; padding: 20px; }
  h1 { text-align: center; margin: 20px 0; color: #38bdf8; font-size: 1.6em; }
  .info { text-align: center; color: #94a3b8; margin-bottom: 20px; font-size: 0.9em; }
  .search { display: block; margin: 0 auto 20px; padding: 10px 16px; width: 100%%;
            max-width: 600px; border-radius: 8px; border: 1px solid #334155;
            background: #1e293b; color: #e2e8f0; font-size: 1em; outline: none; }
  .search:focus { border-color: #38bdf8; }
  table { width: 100%%; border-collapse: collapse; margin-top: 10px; }
  th { background: #1e293b; color: #38bdf8; padding: 12px 8px; text-align: left;
       font-size: 0.85em; border-bottom: 2px solid #334155; position: sticky; top: 0; }
  td { padding: 10px 8px; border-bottom: 1px solid #1e293b; font-size: 0.85em; }
  tr:hover { background: #1e293b; }
  .type { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.75em;
          margin: 1px 2px; font-weight: 600; }
  .type-Node { background: #065f46; color: #6ee7b7; }
  .type-Python { background: #1e3a5f; color: #60a5fa; }
  .type-PHP { background: #4a1d96; color: #c4b5fd; }
  .type-Rust { background: #7c2d12; color: #fdba74; }
  .type-Go { background: #064e3b; color: #6ee7b7; }
  .type-Java { background: #78350f; color: #fcd34d; }
  .type-Cpp, .type-C\\+\\+ { background: #312e81; color: #a5b4fc; }
  .type-Csharp, .type-C\\# { background: #4a1d96; color: #c4b5fd; }
  .type-Flutter { background: #0c4a6e; color: #7dd3fc; }
  .type-R { background: #1e3a5f; color: #93c5fd; }
  .type-git { background: #374151; color: #9ca3af; }
  .type-Unknown { background: #374151; color: #9ca3af; }
  a.dl { color: #38bdf8; text-decoration: none; padding: 4px 12px; border: 1px solid #38bdf8;
         border-radius: 4px; font-size: 0.85em; white-space: nowrap; }
  a.dl:hover { background: #38bdf8; color: #0f172a; }
  .path { color: #94a3b8; font-family: monospace; font-size: 0.8em; word-break: break-all; }
  .owner { color: #a78bfa; }
  .size { white-space: nowrap; }
  .na { color: #475569; }
  @media (max-width: 768px) { td, th { padding: 6px 4px; font-size: 0.78em; } }
</style>
</head>
<body>
<h1>Project Downloads</h1>
<div class="info">HOST_INFO | TOTAL_PROJECTS projects | Scanned SCAN_TIME</div>
<input class="search" type="text" placeholder="Filter by name, path, type, owner..." id="search"
       oninput="filterTable()">
<table>
<thead>
<tr><th>#</th><th>Project</th><th>Path</th><th>Owner</th><th>Type</th><th>Source</th>
    <th>Zip</th><th>Modified</th><th>Download</th></tr>
</thead>
<tbody id="tbody">
TABLE_ROWS
</tbody>
</table>
<script>
function filterTable() {
  const q = document.getElementById('search').value.toLowerCase();
  document.querySelectorAll('#tbody tr').forEach(r => {
    r.style.display = r.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}
</script>
</body>
</html>"""


def build_html(projects):
    rows = []
    for i, p in enumerate(projects, 1):
        types_html = " ".join(
            f'<span class="type type-{t.replace("+", "p").replace("#", "sharp")}">{t}</span>'
            for t in p["types"]
        )
        if p.get("zip_file"):
            dl_html = f'<a class="dl" href="/download/{quote(p["zip_file"])}">Download</a>'
            zip_size = p["zip_size_human"]
        else:
            dl_html = '<span class="na">-</span>'
            zip_size = '<span class="na">-</span>'

        rows.append(
            f'<tr><td>{i}</td><td><b>{p["name"]}</b></td>'
            f'<td class="path">{p["path"]}</td>'
            f'<td class="owner">{p["owner"]}</td>'
            f'<td>{types_html}</td>'
            f'<td class="size">{p["source_size_human"]}</td>'
            f'<td class="size">{zip_size}</td>'
            f'<td>{p["last_modified"]}</td>'
            f'<td>{dl_html}</td></tr>'
        )

    hostname = socket.gethostname()
    scan_time = datetime.now().strftime("%Y-%m-%d %H:%M")
    html = HTML_TEMPLATE.replace("TABLE_ROWS", "\n".join(rows))
    html = html.replace("HOST_INFO", hostname)
    html = html.replace("TOTAL_PROJECTS", str(len(projects)))
    html = html.replace("SCAN_TIME", scan_time)
    return html


class ProjectHandler(SimpleHTTPRequestHandler):
    projects = []
    html_cache = ""

    def do_GET(self):
        if self.path == "/" or self.path == "/index.html":
            content = ProjectHandler.html_cache.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)

        elif self.path.startswith("/download/"):
            zip_name = unquote(self.path[len("/download/"):])
            zip_path = ZIP_DIR / zip_name
            if not zip_path.exists() or ".." in zip_name:
                self.send_error(404, "File not found")
                return
            self.send_response(200)
            self.send_header("Content-Type", "application/zip")
            self.send_header("Content-Disposition", f'attachment; filename="{zip_name}"')
            self.send_header("Content-Length", str(zip_path.stat().st_size))
            self.end_headers()
            with open(zip_path, "rb") as f:
                while True:
                    chunk = f.read(65536)
                    if not chunk:
                        break
                    self.wfile.write(chunk)

        elif self.path == "/api/projects":
            data = json.dumps(ProjectHandler.projects, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        else:
            self.send_error(404, "Not found")

    def log_message(self, format, *args):
        if "/api/" not in (args[0] if args else ""):
            super().log_message(format, *args)


def get_all_ips():
    ips = []
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if ip not in ips and not ip.startswith("127."):
                ips.append(ip)
    except socket.gaierror:
        pass
    if not ips:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ips.append(s.getsockname()[0])
            s.close()
        except OSError:
            pass
    return ips


def serve(projects, port):
    ProjectHandler.projects = projects
    ProjectHandler.html_cache = build_html(projects)

    server = HTTPServer(("0.0.0.0", port), ProjectHandler)
    ips = get_all_ips()

    print(f"\n{'=' * 60}")
    print(f"  Project Download Server")
    print(f"{'=' * 60}")
    print(f"  Local:    http://localhost:{port}/")
    for ip in ips:
        print(f"  Network:  http://{ip}:{port}/")
    print(f"  Projects: {len(projects)}")
    zipped = sum(1 for p in projects if p.get("zip_file"))
    print(f"  Zipped:   {zipped}")
    total_zip = sum(p.get("zip_size", 0) or 0 for p in projects)
    print(f"  Total:    {format_size(total_zip)}")
    print(f"{'=' * 60}")
    print(f"  Press Ctrl+C to stop\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[SERVER] Shutting down...")
        server.server_close()


# =============================================================================
# Main
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description="Project Scanner & Download Server")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help=f"Server port (default: {DEFAULT_PORT})")
    parser.add_argument("--scan-only", action="store_true", help="Scan and pack only, don't start server")
    parser.add_argument("--serve-only", action="store_true", help="Serve existing zips without re-scanning")
    parser.add_argument("--rescan", action="store_true", help="Force re-scan even if manifest exists")
    args = parser.parse_args()

    if args.serve_only and MANIFEST_FILE.exists():
        print("[SERVE] Loading existing manifest...")
        with open(MANIFEST_FILE) as f:
            projects = json.load(f)
        print(f"[SERVE] {len(projects)} project(s) from manifest")
        serve(projects, args.port)
        return

    if not args.rescan and MANIFEST_FILE.exists() and not args.serve_only:
        mtime = os.path.getmtime(MANIFEST_FILE)
        age_hours = (time.time() - mtime) / 3600
        if age_hours < 1:
            print(f"[SCAN] Manifest is {age_hours:.0f}m old, reusing (use --rescan to force)")
            with open(MANIFEST_FILE) as f:
                projects = json.load(f)
        else:
            projects = scan_projects()
            pack_all(projects)
    else:
        projects = scan_projects()
        pack_all(projects)

    if args.scan_only:
        print("\n[DONE] Scan complete. Zips saved to:", ZIP_DIR)
        return

    serve(projects, args.port)


if __name__ == "__main__":
    main()
