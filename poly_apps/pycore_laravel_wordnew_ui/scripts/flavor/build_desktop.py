#!/usr/bin/env python3
"""Build a flavor app as a desktop (Electron) app for this PC (Windows or Linux).

Flow: brand preflight -> `vite build` (VITE_BUILD_TARGET=desktop) -> Electron
runtime (node_modules/electron, its binary fetched only when missing) -> app
folder artifacts/desktop/<app>/<Name>-<os>-<arch> (runtime + resources/app with
native/desktop, desktop.json and the web bundle) -> launch or open it.
"""
from __future__ import annotations

import argparse
import json
import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path

from brand_preflight import run_preflight
from build_apk import CHOICES, choose, default_app_index, discover_platform_apps, executable, fail, open_target, run
from build_console import StepLog


PLATFORM_ID = "desktop"
PLATFORM_NAME = "Desktop"
SHELL_DIR = Path("native") / "desktop"
SHELL_FILES = ("main.cjs", "preload.cjs", "desktop_files.cjs", "desktop_plugins.cjs")
ELECTRON_DIR = Path("node_modules") / "electron"
ELECTRON_DIST = ELECTRON_DIR / "dist"
ELECTRON_INSTALLER = ELECTRON_DIR / "install.js"
ELECTRON_VERSION_FILE = "version"
WEB_FOLDER = "web"
CONFIG_FILE = "desktop.json"
ICON_FILE = "icon.png"
DEFAULT_RESOURCES_ARCHIVE = "default_app.asar"
BUILD_STEPS = 5


def log(message: str) -> None:
    print(f"[desktop] {message}", flush=True)


def select_app(apps: list[dict], requested: str | None) -> dict:
    if not apps:
        fail("No desktop app was detected (flavors/*/flavor.json with \"desktop\" in platforms).")
    by_id = {str(app["id"]): app for app in apps}
    if requested:
        if requested not in by_id:
            fail(f"App '{requested}' is not desktop-buildable. Available: {', '.join(by_id)}")
        return by_id[requested]
    return apps[default_app_index(apps)]


def host_names() -> tuple[str, str]:
    system = "win32" if os.name == "nt" else sys.platform
    machine = platform.machine().lower()
    arch = "arm64" if machine in ("arm64", "aarch64") else "x64"
    return system, arch


def executable_name(product: str) -> str:
    return f"{product}.exe" if os.name == "nt" else product.lower()


def runtime_binary(folder: Path) -> Path:
    return folder / ("electron.exe" if os.name == "nt" else "electron")


def ensure_electron(root: Path, bun: str) -> Path:
    dist = root / ELECTRON_DIST
    if runtime_binary(dist).is_file():
        return dist
    if not (root / ELECTRON_INSTALLER).is_file():
        run([bun, "install"], root)
    run(["node", str(root / ELECTRON_INSTALLER)], root)
    if not runtime_binary(dist).is_file():
        fail(f"Electron runtime is missing after install: {dist}")
    return dist


def copy_runtime(dist: Path, output: Path, product: str) -> Path:
    """Electron runtime copied once per Electron version; the binary carries the product name."""
    binary = output / executable_name(product)
    version = (dist / ELECTRON_VERSION_FILE).read_text(encoding="utf-8").strip()
    current = output / ELECTRON_VERSION_FILE
    if binary.is_file() and current.is_file() and current.read_text(encoding="utf-8").strip() == version:
        return binary
    shutil.copytree(dist, output, dirs_exist_ok=True)
    shutil.move(str(runtime_binary(output)), str(binary))
    (output / "resources" / DEFAULT_RESOURCES_ARCHIVE).unlink(missing_ok=True)
    if os.name != "nt":
        binary.chmod(binary.stat().st_mode | 0o111)
    return binary


def write_json(path: Path, value: dict) -> None:
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def assemble_app(root: Path, app: dict, output: Path, server_url: str) -> None:
    app_dir = output / "resources" / "app"
    app_dir.mkdir(parents=True, exist_ok=True)
    for name in SHELL_FILES:
        shutil.copy2(root / SHELL_DIR / name, app_dir / name)
    web_dir = app_dir / WEB_FOLDER
    if web_dir.exists():
        shutil.rmtree(web_dir)
    shutil.copytree(root / "dist", web_dir)
    icon = str((app.get("brand") or {}).get("icon") or "")
    if icon and (root / icon).is_file():
        shutil.copy2(root / icon, app_dir / ICON_FILE)
    product = display_name(app)
    write_json(app_dir / "package.json", {
        "name": str(app["id"]),
        "productName": product,
        "version": str(app.get("version") or "0.0.0"),
        "description": str(app.get("description") or product),
        "main": "main.cjs",
        "private": True,
    })
    launch = (app.get("launch") or {}).get("native") or {}
    write_json(app_dir / CONFIG_FILE, {
        "id": str(app["id"]),
        "appId": str(app.get("appId") or app["id"]),
        "name": product,
        "background": str(launch.get("background") or app.get("backgroundColor") or "#0f172a"),
        "icon": ICON_FILE if (app_dir / ICON_FILE).is_file() else "",
        "serverUrl": server_url,
    })


def display_name(app: dict) -> str:
    names = app.get("names") or {}
    return str(names.get("en") or app.get("name") or app["id"])


def stop_running(binary: Path) -> None:
    """A running copy of this build holds the single-instance lock: it is closed so the new build starts."""
    if os.name == "nt":
        command = ("Get-Process -Name '{0}' -ErrorAction SilentlyContinue | Where-Object {{ $_.Path -eq '{1}' }} "
                   "| Stop-Process -Force").format(binary.stem, str(binary).replace("'", "''"))
        subprocess.run(["powershell", "-NoProfile", "-Command", command], check=False)
    elif shutil.which("pkill"):
        subprocess.run(["pkill", "-f", str(binary)], check=False)


def launch(binary: Path) -> None:
    log(f"Launching {binary}")
    flags = getattr(subprocess, "DETACHED_PROCESS", 0) | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
    subprocess.Popen([str(binary)], cwd=str(binary.parent), stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                     stderr=subprocess.DEVNULL, creationflags=flags, start_new_session=os.name != "nt")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build a standalone UI app as a desktop (Electron) app.")
    parser.add_argument("--root", default=None, help="UI project root")
    parser.add_argument("--app", default=None, help="app flavor id; auto-detected when omitted")
    parser.add_argument("--web", choices=CHOICES, default="yes", help="build the web bundle ('no' reuses dist/)")
    parser.add_argument("--run", dest="run_app", choices=CHOICES, default="ask", help="launch the app when built")
    parser.add_argument("--open", dest="open_output", choices=CHOICES, default="no", help="open the output folder")
    parser.add_argument("--server-url", default="", help="load the app from a Vite dev server instead of the bundle")
    parser.add_argument("--non-interactive", action="store_true")
    parser.add_argument("--list", action="store_true")
    parser.add_argument("--list-plain", action="store_true", help="print 'id<TAB>name<TAB>default-flag' per app")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    script_dir = Path(__file__).resolve().parent
    root = Path(args.root).resolve() if args.root else script_dir.parent.parent
    apps, rejected = discover_platform_apps(root, PLATFORM_ID, PLATFORM_NAME)
    if args.list_plain:
        default = default_app_index(apps)
        for index, app in enumerate(apps):
            print(f"{app['id']}\t{app.get('name', app['id'])}\t{'*' if index == default else ''}")
        return 0
    if args.list:
        for app in apps:
            log(f"{app['id']}\t{app.get('name', app['id'])}")
        for reason in rejected:
            log(f"skipped\t{reason}")
        return 0
    app = select_app(apps, args.app)
    app_id = str(app["id"])
    steps = StepLog("desktop", BUILD_STEPS)
    bun = executable("bun")

    steps.step(f"Check brand inputs (app name, appId, logo) - flavors/{app_id}/flavor.json")
    app.update(run_preflight(root, app_id, args.non_interactive))

    steps.step("Build the web bundle (vite, target desktop)")
    if args.web == "no" and (root / "dist" / "index.html").is_file():
        steps.detail("skipped: reusing dist/")
    else:
        environment = os.environ.copy()
        environment["VITE_APP_FLAVOR"] = app_id
        environment["VITE_BUILD_TARGET"] = PLATFORM_ID
        run([bun, "x", "vite", "build"], root, environment)

    steps.step("Electron runtime - node_modules/electron")
    dist = ensure_electron(root, bun)
    steps.detail(f"version {(dist / ELECTRON_VERSION_FILE).read_text(encoding='utf-8').strip()}")

    system, arch = host_names()
    product = display_name(app)
    output = root / "artifacts" / "desktop" / app_id / f"{product}-{system}-{arch}"
    steps.step(f"Assemble the app - {output.relative_to(root)}")
    stop_running(output / executable_name(product))
    binary = copy_runtime(dist, output, product)
    assemble_app(root, app, output, args.server_url)
    log(f"App: {binary}")

    steps.step("Launch")
    if choose(args.run_app, "Launch the desktop app now?", True, args.non_interactive):
        launch(binary)
    else:
        steps.detail("skipped")
    if choose(args.open_output, "Open the output folder?", False, args.non_interactive):
        open_target(root, output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
