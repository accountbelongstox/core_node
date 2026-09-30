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
import tarfile
from pathlib import Path

from live_debug import ensure_live_server


BUILD_TYPES = ("debug", "release")
CHOICES = ("ask", "yes", "no")
CAPACITOR_ANDROID_TEMPLATE = Path("node_modules") / "@capacitor" / "cli" / "assets" / "android-template.tar.gz"
GRADLE_WRAPPER_PREFIXES = ("gradlew", "gradle/wrapper/")
GRADLE_POSIX_WRAPPER = "gradlew"
OWNERSHIP_HELPER = Path("scripts") / "shells" / "linux" / "common" / "fs_perm_helpers.sh"
BUILD_OUTPUTS = ("dist", "resources", "artifacts", "capacitor.config.json", "node_modules/.vite-native")
DEFAULT_X_DISPLAY = ":0"


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


def run(command: list[str], root: Path, environment: dict[str, str] | None = None, check: bool = True) -> bool:
    log("Running: " + " ".join(command))
    result = subprocess.run(command, cwd=root, env=environment, check=False)
    if result.returncode != 0 and check:
        fail(f"Command failed with exit code {result.returncode}: {' '.join(command)}", result.returncode)
    return result.returncode == 0


def repair_gradle_wrapper(root: Path, android_dir: Path) -> None:
    with tarfile.open(root / CAPACITOR_ANDROID_TEMPLATE, "r:gz") as archive:
        for member in archive.getmembers():
            name = member.name.removeprefix("./")
            if not member.isfile() or not name.startswith(GRADLE_WRAPPER_PREFIXES):
                continue
            target = android_dir / name
            if target.is_file():
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.extractfile(member).read())
            log(f"Restored Gradle wrapper file from the Capacitor template: {name}")
    script = android_dir / GRADLE_POSIX_WRAPPER
    content = script.read_bytes()
    if b"\r\n" in content:
        script.write_bytes(content.replace(b"\r\n", b"\n"))
        log(f"Normalized {GRADLE_POSIX_WRAPPER} line endings to LF.")
    if os.name != "nt" and script.stat().st_mode & 0o111 != 0o111:
        script.chmod(script.stat().st_mode | 0o111)


def foreign_owned(paths: list[Path]) -> bool:
    uid = os.geteuid()
    if uid == 0:
        return True
    for path in paths:
        if not path.exists():
            continue
        if path.stat().st_uid != uid:
            return True
        for current, directories, files in os.walk(path):
            for name in directories + files:
                entry = Path(current) / name
                if not entry.is_symlink() and entry.stat().st_uid != uid:
                    return True
    return False


def restore_ownership(root: Path, paths: list[Path]) -> None:
    if os.name == "nt" or not foreign_owned(paths):
        return
    helper = root.parents[1] / OWNERSHIP_HELPER
    for path in paths:
        if path.exists():
            subprocess.run(
                ["bash", "-c", 'source "$1" && repair_owned_tree_777 "$2"', "bash", str(helper), str(path)],
                check=False,
            )


def version_code(version: str) -> int:
    parts = [int(part) if part.isdigit() else 0 for part in version.split(".")[:3]]
    parts += [0] * (3 - len(parts))
    return max(1, parts[0] * 10000 + parts[1] * 100 + parts[2])


def gradle_command(android_dir: Path, app: dict) -> list[str]:
    wrapper = android_dir / ("gradlew.bat" if os.name == "nt" else "gradlew")
    if not wrapper.is_file():
        fail(f"Gradle wrapper is missing: {wrapper}")
    version = str(app.get("version") or "0.0.0")
    code = int(app.get("versionCode") or version_code(version))
    return [str(wrapper), f"-PcoreNodeVersionName={version}", f"-PcoreNodeVersionCode={code}"]


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


def desktop_user_prefix(root: Path) -> list[str]:
    if os.geteuid() != 0 or not shutil.which("runuser"):
        return []
    import pwd

    helper = root.parents[1] / OWNERSHIP_HELPER
    owner = subprocess.run(
        ["bash", "-c", 'source "$1" >/dev/null 2>&1 && resolve_active_permission_owner', "bash", str(helper)],
        capture_output=True, text=True, check=False,
    ).stdout.strip().splitlines()
    if not owner or owner[-1] == "root":
        return []
    runtime_dir = Path("/run/user") / str(pwd.getpwnam(owner[-1]).pw_uid)
    session = [
        f"XDG_RUNTIME_DIR={runtime_dir}",
        f"DBUS_SESSION_BUS_ADDRESS=unix:path={runtime_dir / 'bus'}",
        f"DISPLAY={os.environ.get('DISPLAY') or DEFAULT_X_DISPLAY}",
    ]
    wayland = sorted(entry.name for entry in runtime_dir.glob("wayland-*") if not entry.name.endswith(".lock"))
    if wayland:
        session.append(f"WAYLAND_DISPLAY={wayland[0]}")
    return ["runuser", "-u", owner[-1], "--", "env", *session]


def open_target(root: Path, target: str | Path) -> None:
    is_url = isinstance(target, str)
    resolved = target if is_url else str(Path(target).resolve())
    try:
        if os.name == "nt":
            os.startfile(resolved)  # type: ignore[attr-defined]
            return
        if "microsoft" in platform.release().lower() and shutil.which("explorer.exe"):
            native = resolved if is_url else subprocess.check_output(["wslpath", "-w", resolved], text=True).strip()
            subprocess.Popen(["explorer.exe", native])
            return
        opener = "open" if sys.platform == "darwin" else "xdg-open"
        if shutil.which(opener):
            prefix = [] if sys.platform == "darwin" else desktop_user_prefix(root)
            subprocess.Popen(prefix + [opener, resolved], stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                             stderr=subprocess.DEVNULL, start_new_session=True)
            log(f"Opened: {resolved}")
            return
        log(f"Open manually: {resolved}")
    except (OSError, subprocess.SubprocessError) as error:
        log(f"Could not open {resolved} automatically: {error}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Detect and build a standalone UI app as an Android APK.")
    parser.add_argument("--root", default=None, help="UI project root")
    parser.add_argument("--app", default=None, help="app flavor id; auto-detected when omitted")
    parser.add_argument("--build-type", choices=("ask",) + BUILD_TYPES, default="ask")
    parser.add_argument("--assets", choices=CHOICES, default="ask")
    parser.add_argument("--clean", choices=CHOICES, default="ask")
    parser.add_argument("--open", dest="open_output", choices=CHOICES, default="ask")
    parser.add_argument("--non-interactive", action="store_true")
    parser.add_argument("--live-reload", action="store_true", help="load the app from a Vite dev server (HMR)")
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
        build_type = "debug" if ask("Build a debug APK (installable without a signing key)?", True, args.non_interactive) else "release"
    generate_assets = choose(args.assets, "Generate Android icons and splash resources?", True, args.non_interactive)
    clean = choose(args.clean, "Clean stale Gradle outputs first (idempotent, most reliable)?", True, args.non_interactive)
    open_prompt = "Open the live-reload dev server in the browser when ready?" if args.live_reload \
        else "Open the APK output directory when complete?"
    open_output = choose(args.open_output, open_prompt, True, args.non_interactive)
    log(f"Selected app: {app['id']} ({app.get('appId')})")
    log(f"Build type: {build_type}")

    owned_paths = [root / "native" / str(app["id"])] + [root / name for name in BUILD_OUTPUTS]
    restore_ownership(root, owned_paths)
    try:
        open_item = build(root, script_dir, app, build_type, generate_assets, clean, args.non_interactive,
                             args.live_reload)
    finally:
        restore_ownership(root, owned_paths)
    if open_output:
        open_target(root, open_item)
    return 0


def build(root: Path, script_dir: Path, app: dict, build_type: str, generate_assets: bool, clean: bool,
          non_interactive: bool, live_reload: bool) -> str | Path:
    python = sys.executable
    bun = executable("bun")
    prepare_script = script_dir / "flavor_build.py"
    environment = os.environ.copy()
    environment["VITE_APP_FLAVOR"] = str(app["id"])
    environment["VITE_BUILD_TARGET"] = "native"
    prepare = [python, str(prepare_script), "--app", str(app["id"]), "--root", str(root)]
    live_url = ensure_live_server(root, app, bun, environment) if live_reload else ""
    if live_url:
        prepare += ["--server-url", live_url]
    run(prepare, root)

    if not live_reload or not (root / "dist" / "index.html").is_file():
        run([bun, "x", "vite", "build"], root, environment)

    android_dir = root / "native" / str(app["id"]) / "android"
    if not android_dir.is_dir():
        if not ask("Android platform is missing. Add it now?", True, non_interactive):
            fail("Android platform is required to build an APK.")
        run([bun, "x", "cap", "add", "android"], root, environment)
    if generate_assets:
        run([
            bun, "x", "@capacitor/assets@3.0.5", "generate", "--android",
            "--assetPath", "resources",
            "--androidProject", str(android_dir.relative_to(root)),
            "--iconBackgroundColor", str(app.get("themeColor") or "#ffffff"),
            "--splashBackgroundColor", str(app.get("backgroundColor") or "#ffffff"),
        ], root, environment)
    run([bun, "x", "cap", "sync", "android"], root, environment)
    repair_gradle_wrapper(root, android_dir)

    gradle = gradle_command(android_dir, app)
    if clean:
        run(gradle + ["clean"], android_dir, environment)
    task = "assembleRelease" if build_type == "release" else "assembleDebug"
    if not run(gradle + [task], android_dir, environment, check=clean):
        log("Gradle build failed; cleaning stale outputs and retrying once.")
        run(gradle + ["clean"], android_dir, environment)
        run(gradle + [task], android_dir, environment)
    artifact_dir = collect_apks(root, android_dir, app, build_type)
    return live_url or artifact_dir


if __name__ == "__main__":
    raise SystemExit(main())
