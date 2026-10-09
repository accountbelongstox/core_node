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
import time
from datetime import datetime, timezone
from pathlib import Path

from android_signing import apk_signer_sha256, ensure_signing
from app_download_publish import publish_and_report
from brand_assets import sync as sync_brand_assets
from brand_preflight import APP_ID_PATTERN, run_preflight
from build_console import StepLog
from live_debug import ensure_live_server, real_user_prefix, restore_ownership


BUILD_TYPES = ("debug", "release")
CHOICES = ("ask", "yes", "no")
CAPACITOR_ANDROID_TEMPLATE = Path("node_modules") / "@capacitor" / "cli" / "assets" / "android-template.tar.gz"
GRADLE_WRAPPER_PREFIXES = ("gradlew", "gradle/wrapper/")
GRADLE_POSIX_WRAPPER = "gradlew"
VERSION_CODE_EPOCH = datetime(2026, 1, 1, tzinfo=timezone.utc)
INT32_MAX = 2**31 - 1
OUTPUT_METADATA = "output-metadata.json"
BUILD_OUTPUTS = ("dist", "artifacts", "capacitor.config.json", "node_modules/.vite-native")


def log(message: str) -> None:
    print(f"[apk] {message}", flush=True)


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


def discover_platform_apps(root: Path, platform_id: str, platform_name: str) -> tuple[list[dict], list[str]]:
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
        if platform_id not in platforms:
            rejected.append(f"{app_id}: {platform_name} is not enabled")
            continue
        if not entry_path or root not in entry_path.parents or not entry_path.is_file():
            rejected.append(f"{app_id}: entry source is missing ({entry or 'unset'})")
            continue
        flavor["_manifest"] = str(manifest_path)
        flavor["_native"] = (root / "native" / app_id / platform_id).is_dir()
        supported.append(flavor)
    return supported, rejected


def discover_android_apps(root: Path) -> tuple[list[dict], list[str]]:
    return discover_platform_apps(root, "android", "Android")


def default_app_index(apps: list[dict]) -> int:
    return next((i for i, app in enumerate(apps) if app.get("_native")), 0)


def select_app(apps: list[dict], requested: str | None, non_interactive: bool) -> dict:
    if not apps:
        fail("No Android app was detected from flavors/*/flavor.json and its entry source.")
    by_id = {str(app["id"]): app for app in apps}
    if requested:
        if requested not in by_id:
            fail(f"App '{requested}' is not Android-buildable. Available: {', '.join(by_id)}")
        return by_id[requested]
    default = default_app_index(apps)
    if len(apps) == 1 or non_interactive or not sys.stdin.isatty():
        return apps[default]
    log("Detected Android apps:")
    for index, app in enumerate(apps, start=1):
        marker = "" if app.get("_native") else "  (no native project yet: it will be created)"
        if not APP_ID_PATTERN.fullmatch(str(app.get("appId") or "")):
            marker += "  (appId needs fixing: you will be asked)"
        log(f"  {index}. {app['id']} - {app.get('name', app['id'])}{marker}")
    try:
        answer = input(f"Select app [{default + 1}]: ").strip()
        selected = int(answer or str(default + 1)) - 1
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


def build_version_code() -> int:
    """Android versionCode of this build: seconds since 2026-01-01 UTC (int32 until 2094), so every build is higher."""
    code = int(time.time() - VERSION_CODE_EPOCH.timestamp())
    if not 0 < code <= INT32_MAX:
        fail(f"The clock gives an invalid versionCode ({code}); check the system date.")
    return code


def gradle_command(android_dir: Path, app: dict) -> list[str]:
    wrapper = android_dir / ("gradlew.bat" if os.name == "nt" else "gradlew")
    if not wrapper.is_file():
        fail(f"Gradle wrapper is missing: {wrapper}")
    version = str(app.get("version") or "0.0.0")
    code = int(app["versionCode"])
    return [str(wrapper), f"-PcoreNodeVersionName={version}", f"-PcoreNodeVersionCode={code}"]


def apk_details(output_root: Path, apk: Path, app: dict, fallback_signer: str) -> dict:
    details = {"version_code": int(app["versionCode"]), "application_id": str(app.get("appId") or ""),
               "signer_sha256": apk_signer_sha256(apk, fallback_signer)}
    metadata = output_root / OUTPUT_METADATA
    try:
        document = json.loads(metadata.read_text(encoding="utf-8"))
        element = (document.get("elements") or [{}])[0]
        details["application_id"] = str(document.get("applicationId") or details["application_id"])
        details["version_code"] = int(element.get("versionCode") or details["version_code"])
    except (OSError, ValueError, IndexError, AttributeError):
        pass
    return details


def collect_apks(root: Path, android_dir: Path, app: dict, build_type: str, publish: bool = True,
                 server_sync: bool = True, fallback_signer: str = "") -> Path:
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
        if publish and index == 1:
            details = apk_details(output_root, destination, app, fallback_signer)
            log(f"versionCode {details['version_code']}, signer SHA-256 {details['signer_sha256'] or 'unknown'}")
            try:
                publish_and_report(app, "android", build_type, destination, details=details, server_sync=server_sync)
            except OSError as error:
                log(f"WARNING: could not publish the APK to the downloads directory: {error}")
    return artifact_dir


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
            prefix = [] if sys.platform == "darwin" else real_user_prefix(root, desktop=True)
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
    parser.add_argument("--assets", choices=CHOICES, default="yes",
                        help="render brand icons/splash/names (idempotent; 'no' skips)")
    parser.add_argument("--clean", choices=CHOICES, default="ask")
    parser.add_argument("--open", dest="open_output", choices=CHOICES, default="ask")
    parser.add_argument("--non-interactive", action="store_true")
    parser.add_argument("--no-publish", action="store_true",
                        help="do not publish the APK into the core_node downloads directory")
    parser.add_argument("--no-server-sync", action="store_true",
                        help="do not ask the Laravel server to mirror the published app")
    parser.add_argument("--live-reload", action="store_true", help="load the app from a Vite dev server (HMR)")
    parser.add_argument("--list", action="store_true")
    parser.add_argument("--list-plain", action="store_true", help="print 'id<TAB>name<TAB>default-flag' per app, no log prefix")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    script_dir = Path(__file__).resolve().parent
    root = Path(args.root).resolve() if args.root else script_dir.parent.parent
    apps, rejected = discover_android_apps(root)
    if args.list_plain:
        default = default_app_index(apps)
        for index, app in enumerate(apps):
            print(f"{app['id']}	{app.get('name', app['id'])}	{'*' if index == default else ''}")
        return 0
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
    generate_assets = args.assets != "no"
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
                             args.live_reload, not args.no_publish, not args.no_server_sync)
    finally:
        restore_ownership(root, owned_paths)
    if open_output:
        open_target(root, open_item)
    return 0


BUILD_STEPS = 8


def build(root: Path, script_dir: Path, app: dict, build_type: str, generate_assets: bool, clean: bool,
          non_interactive: bool, live_reload: bool, publish: bool = True, server_sync: bool = True) -> str | Path:
    steps = StepLog("apk", BUILD_STEPS)
    python = sys.executable
    bun = executable("bun")
    app_id = str(app["id"])
    app["versionCode"] = int(app.get("versionCode") or build_version_code())

    steps.step(f"Check brand inputs (app name, appId, logo) - flavors/{app_id}/flavor.json")
    app.update(run_preflight(root, app_id, non_interactive))

    steps.step("Write capacitor.config.json")
    environment = os.environ.copy()
    environment["VITE_APP_FLAVOR"] = app_id
    environment["VITE_BUILD_TARGET"] = "native"
    signing = ensure_signing(root)
    environment.update(signing.env)
    steps.detail(f"signing: {signing.source}, certificate SHA-256 {signing.cert_sha256 or 'unknown'}; versionCode {app['versionCode']}")
    prepare = [python, str(script_dir / "flavor_build.py"), "--app", app_id, "--root", str(root)]
    live_url = ensure_live_server(root, app, bun, environment) if live_reload else ""
    if live_url:
        steps.detail(f"live reload from {live_url}")
        prepare += ["--server-url", live_url]
    run(prepare, root)

    steps.step("Build the web bundle (vite)")
    if not live_reload or not (root / "dist" / "index.html").is_file():
        run([bun, "x", "vite", "build"], root, environment)
    else:
        steps.detail("skipped: live reload serves the web bundle from the dev server")

    steps.step(f"Native Android project - native/{app_id}/android")
    android_dir = root / "native" / app_id / "android"
    if not android_dir.is_dir():
        if not ask("Android platform is missing. Add it now?", True, non_interactive):
            fail("Android platform is required to build an APK.")
        run([bun, "x", "cap", "add", "android"], root, environment)
    else:
        steps.detail("present")

    steps.step("Render brand icons, splash and localized names")
    if generate_assets:
        sync_brand_assets(root, app_id)
    else:
        steps.detail("skipped (--assets no)")

    steps.step("Copy the web bundle into the native project (cap sync)")
    run([bun, "x", "cap", "sync", "android"], root, environment)
    repair_gradle_wrapper(root, android_dir)

    task = "assembleRelease" if build_type == "release" else "assembleDebug"
    steps.step(f"Gradle {task}" + (" (clean first)" if clean else ""))
    gradle = gradle_command(android_dir, app)
    if clean:
        run(gradle + ["clean"], android_dir, environment)
    if not run(gradle + [task], android_dir, environment, check=clean):
        log("Gradle build failed; cleaning stale outputs and retrying once.")
        run(gradle + ["clean"], android_dir, environment)
        run(gradle + [task], android_dir, environment)

    publish = publish and not live_reload
    steps.step("Collect the APK" + (" and publish it to the downloads directory" if publish else ""))
    artifact_dir = collect_apks(root, android_dir, app, build_type, publish, server_sync, signing.cert_sha256)
    return live_url or artifact_dir


if __name__ == "__main__":
    raise SystemExit(main())
