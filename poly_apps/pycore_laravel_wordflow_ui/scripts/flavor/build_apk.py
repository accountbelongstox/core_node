#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import platform
import re
import shutil
import subprocess
import sys
from pathlib import Path


BUILD_TYPES = ("debug", "release")
CHOICES = ("ask", "yes", "no")


def log(message: str) -> None:
    print(f"[apk] {message}")


def fail(message: str, code: int = 2) -> None:
    log(f"ERROR: {message}")
    raise SystemExit(code)


def ask(message: str, default: bool, non_interactive: bool) -> bool:
    if non_interactive or not sys.stdin.isatty():
        return default
    marker = "Y/n" if default else "y/N"
    try:
        answer = input(f"{message} [{marker}] ").strip().lower()
    except EOFError:
        return default
    if not answer:
        return default
    return answer.startswith("y")


def choose(value: str, message: str, default: bool, non_interactive: bool) -> bool:
    if value == "yes":
        return True
    if value == "no":
        return False
    return ask(message, default, non_interactive)


def load_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        fail(f"Cannot read {path}: {error}")


def discover_android_apps(root: Path) -> tuple[list[dict], list[str]]:
    flavors_dir = root / "flavors"
    supported: list[dict] = []
    rejected: list[str] = []
    if not flavors_dir.is_dir():
        return supported, ["flavors directory is missing"]
    for manifest_path in sorted(flavors_dir.glob("*/flavor.json")):
        flavor = load_json(manifest_path)
        app_id = str(flavor.get("id") or manifest_path.parent.name)
        platforms = flavor.get("platforms") or ["web"]
        entry = str(flavor.get("entry") or "")
        entry_path = (root / entry).resolve() if entry else None
        if not re.fullmatch(r"[a-z][a-z0-9-]*", app_id):
            rejected.append(f"{app_id}: invalid app id")
            continue
        if "android" not in platforms:
            rejected.append(f"{app_id}: Android is not enabled")
            continue
        if not entry_path or root not in entry_path.parents or not entry_path.is_file():
            rejected.append(f"{app_id}: entry source is missing ({entry or 'unset'})")
            continue
        flavor["_manifest"] = str(manifest_path)
        supported.append(flavor)
    return supported, rejected


def select_app(apps: list[dict], requested: str | None, non_interactive: bool) -> dict:
    if not apps:
        fail("No Android app was detected from flavors/*/flavor.json and its entry source.")
    by_id = {str(app["id"]): app for app in apps}
    if requested:
        if requested not in by_id:
            fail(f"App '{requested}' is not Android-buildable. Available: {', '.join(by_id)}")
        return by_id[requested]
    if len(apps) == 1 or non_interactive or not sys.stdin.isatty():
        return apps[0]
    log("Detected Android apps:")
    for index, app in enumerate(apps, start=1):
        log(f"  {index}. {app['id']} - {app.get('name', app['id'])}")
    try:
        answer = input("Select app [1]: ").strip()
        selected = int(answer or "1") - 1
    except (EOFError, ValueError):
        selected = 0
    if selected < 0 or selected >= len(apps):
        fail("Invalid app selection.")
    return apps[selected]


def executable(name: str) -> str:
    windows_name = name + ".cmd" if os.name == "nt" else name
    resolved = shutil.which(windows_name) or shutil.which(name)
    if not resolved:
        fail(f"Required command is missing: {name}")
    return resolved


def run(command: list[str], root: Path, environment: dict[str, str] | None = None) -> None:
    log("Running: " + " ".join(command))
    result = subprocess.run(command, cwd=root, env=environment, check=False)
    if result.returncode != 0:
        fail(f"Command failed with exit code {result.returncode}: {' '.join(command)}", result.returncode)


def gradle_command(android_dir: Path) -> list[str]:
    wrapper = android_dir / ("gradlew.bat" if os.name == "nt" else "gradlew")
    if not wrapper.is_file():
        fail(f"Gradle wrapper is missing: {wrapper}")
    return [str(wrapper)]


def collect_apks(root: Path, android_dir: Path, app: dict, build_type: str) -> Path:
    output_root = android_dir / "app" / "build" / "outputs" / "apk" / build_type
    source_apks = sorted(output_root.rglob("*.apk")) if output_root.is_dir() else []
    if not source_apks:
        fail(f"Gradle completed but no APK was found under {output_root}")
    artifact_dir = root / "artifacts" / "apk" / str(app["id"]) / build_type
    artifact_dir.mkdir(parents=True, exist_ok=True)
    version = str(app.get("version") or "0.0.0")
    for index, source in enumerate(source_apks, start=1):
        suffix = "" if len(source_apks) == 1 else f"-{index}"
        destination = artifact_dir / f"{app['id']}-{version}-{build_type}{suffix}.apk"
        shutil.copy2(source, destination)
        log(f"APK: {destination}")
    return artifact_dir


def open_directory(path: Path) -> None:
    resolved = str(path.resolve())
    try:
        if os.name == "nt":
            os.startfile(resolved)  # type: ignore[attr-defined]
            return
        if "microsoft" in platform.release().lower() and shutil.which("explorer.exe"):
            wsl_path = subprocess.check_output(["wslpath", "-w", resolved], text=True).strip()
            subprocess.Popen(["explorer.exe", wsl_path])
            return
        opener = "open" if sys.platform == "darwin" else "xdg-open"
        if shutil.which(opener):
            subprocess.Popen([opener, resolved])
            return
        log(f"Output directory: {resolved}")
    except (OSError, subprocess.SubprocessError) as error:
        log(f"Could not open the output directory automatically: {error}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Detect and build a standalone UI app as an Android APK.")
    parser.add_argument("--root", default=None, help="UI project root")
    parser.add_argument("--app", default=None, help="app flavor id; auto-detected when omitted")
    parser.add_argument("--build-type", choices=("ask",) + BUILD_TYPES, default="ask")
    parser.add_argument("--assets", choices=CHOICES, default="ask")
    parser.add_argument("--clean", choices=CHOICES, default="ask")
    parser.add_argument("--open", dest="open_output", choices=CHOICES, default="ask")
    parser.add_argument("--non-interactive", action="store_true")
    parser.add_argument("--list", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    script_dir = Path(__file__).resolve().parent
    root = Path(args.root).resolve() if args.root else script_dir.parent.parent
    apps, rejected = discover_android_apps(root)
    if args.list:
        for app in apps:
            log(f"{app['id']}\t{app.get('name', app['id'])}\t{app.get('appId', '')}")
        for reason in rejected:
            log(f"skipped\t{reason}")
        return 0
    app = select_app(apps, args.app, args.non_interactive)
    build_type = args.build_type
    if build_type == "ask":
        build_type = "release" if ask("Build a release APK?", False, args.non_interactive) else "debug"
    generate_assets = choose(args.assets, "Generate Android icons and splash resources?", True, args.non_interactive)
    clean = choose(args.clean, "Clean the Android Gradle project first?", False, args.non_interactive)
    open_output = choose(args.open_output, "Open the APK output directory when complete?", True, args.non_interactive)
    log(f"Selected app: {app['id']} ({app.get('appId')})")
    log(f"Build type: {build_type}")

    python = sys.executable
    pnpm = executable("pnpm")
    npx = executable("npx")
    prepare_script = script_dir / "flavor_build.py"
    run([python, str(prepare_script), "--app", str(app["id"]), "--root", str(root)], root)

    environment = os.environ.copy()
    environment["VITE_APP_FLAVOR"] = str(app["id"])
    environment["VITE_BUILD_TARGET"] = "native"
    run([pnpm, "exec", "vite", "build"], root, environment)

    android_dir = root / "native" / str(app["id"]) / "android"
    if not android_dir.is_dir():
        if not ask("Android platform is missing. Add it now?", True, args.non_interactive):
            fail("Android platform is required to build an APK.")
        run([npx, "cap", "add", "android"], root, environment)
    if generate_assets:
        run([
            npx, "--yes", "@capacitor/assets@3.0.5", "generate", "--android",
            "--assetPath", "resources",
            "--androidProject", str(android_dir.relative_to(root)),
            "--iconBackgroundColor", str(app.get("themeColor") or "#ffffff"),
            "--splashBackgroundColor", str(app.get("backgroundColor") or "#ffffff"),
        ], root, environment)
    run([npx, "cap", "sync", "android"], root, environment)

    gradle = gradle_command(android_dir)
    if clean:
        run(gradle + ["clean"], android_dir, environment)
    task = "assembleRelease" if build_type == "release" else "assembleDebug"
    run(gradle + [task], android_dir, environment)
    artifact_dir = collect_apks(root, android_dir, app, build_type)
    if open_output:
        open_directory(artifact_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
