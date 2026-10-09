#!/usr/bin/env python3
"""Publish a built app package into the core_node downloads directory (contract: app_downloads).

Layout: <core_node data dir>/<dir_name>/<app>/{manifest.json, <versioned>, <latest>}. A publish is idempotent by
sha256, every file lands through a temp copy plus atomic rename, and only the newest keep_versions per
(platform, build_type) stay.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import socket
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

CORE_NODE_ROOT = Path(__file__).resolve().parents[4]
if str(CORE_NODE_ROOT) not in sys.path:
    sys.path.insert(0, str(CORE_NODE_ROOT))

from pycore.pyfoundations.core_node_dirs import get_core_node_data_dir  # noqa: E402
from pycore.pyfoundations.service_contract import value as contract_value  # noqa: E402

CONTRACT = contract_value("app_downloads")
SERVER_SYNC = CONTRACT["server_sync"]
LARAVEL_BACKEND_PORT = int(contract_value("ports.laravel_api_backend"))
LARAVEL_CLI = CORE_NODE_ROOT / "ncore" / "foundation" / "common" / "laravel_signed_cli.js"
SYNC_TIMEOUT_SECONDS = 300
SYNC_MESSAGE_CHARS = 300
DETAIL_FIELDS = ("version_code", "application_id", "signer_sha256")
PRIMARY_PLATFORM = "android"
PLATFORMS = ("android", "windows", "linux")
BUILD_TYPES = ("debug", "release")
HASH_CHUNK = 1024 * 1024
REPLACE_ATTEMPTS = 20
REPLACE_DELAY_SECONDS = 0.25
STATUS_PUBLISHED = "published"
STATUS_UNCHANGED = "unchanged"


def log(message: str) -> None:
    print(f"[publish] {message}", flush=True)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(HASH_CHUNK), b""):
            digest.update(chunk)
    return digest.hexdigest()


def display_name(app: dict) -> str:
    names = app.get("names") or {}
    return str(names.get("en") or app.get("name") or app["id"])


def extension_of(source: Path) -> str:
    suffixes = source.suffixes
    if len(suffixes) >= 2 and suffixes[-2].lower() == ".tar":
        return "".join(suffixes[-2:]).lstrip(".")
    return source.suffix.lstrip(".")


def download_root(data_dir: Path | None = None) -> Path:
    return (data_dir or get_core_node_data_dir()) / str(CONTRACT["dir_name"])


def render_name(template: str, app_id: str, version: str, build_type: str, platform_id: str, ext: str) -> str:
    name = template.format(app=app_id, version=version, build_type=build_type, ext=ext)
    if platform_id == PRIMARY_PLATFORM:
        return name
    return f"{name[:-len(ext) - 1]}-{platform_id}.{ext}"


def replace_with_retry(temp: Path, target: Path) -> None:
    for attempt in range(REPLACE_ATTEMPTS):
        try:
            os.replace(temp, target)
            return
        except PermissionError:
            if attempt == REPLACE_ATTEMPTS - 1:
                raise
            time.sleep(REPLACE_DELAY_SECONDS)


def temp_path_for(target: Path) -> Path:
    return target.with_name(f".{target.name}.{os.getpid()}.tmp")


def atomic_copy(source: Path, target: Path) -> None:
    temp = temp_path_for(target)
    try:
        with source.open("rb") as reader, temp.open("wb") as writer:
            for chunk in iter(lambda: reader.read(HASH_CHUNK), b""):
                writer.write(chunk)
            writer.flush()
            os.fsync(writer.fileno())
        replace_with_retry(temp, target)
    finally:
        temp.unlink(missing_ok=True)


def atomic_write_text(target: Path, text: str) -> None:
    temp = temp_path_for(target)
    try:
        with temp.open("w", encoding="utf-8", newline="\n") as writer:
            writer.write(text)
            writer.flush()
            os.fsync(writer.fileno())
        replace_with_retry(temp, target)
    finally:
        temp.unlink(missing_ok=True)


def load_manifest(path: Path, app_id: str, name: str) -> dict:
    manifest: dict = {}
    if path.is_file():
        try:
            manifest = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            manifest = {}
    files = manifest.get("files")
    return {
        "app": app_id,
        "name": name,
        "files": [entry for entry in files if isinstance(entry, dict)] if isinstance(files, list) else [],
        "updated_at": str(manifest.get("updated_at") or ""),
    }


def entry_key(entry: dict) -> tuple[str, str]:
    return str(entry.get("platform") or ""), str(entry.get("build_type") or "")


def entries_current(entries: list[dict], key: tuple[str, str]) -> dict | None:
    group = [entry for entry in entries if entry_key(entry) == key]
    return max(group, key=lambda entry: str(entry.get("built_at") or ""), default=None)


def is_current(entry: dict, directory: Path) -> bool:
    versioned = directory / str(entry.get("file") or "")
    latest = directory / str(entry.get("latest") or "")
    return versioned.is_file() and versioned.stat().st_size == entry.get("size") and latest.is_file()


def prune(manifest: dict, directory: Path, keep: int) -> list[str]:
    groups: dict[tuple[str, str], list[dict]] = {}
    for entry in manifest["files"]:
        groups.setdefault(entry_key(entry), []).append(entry)
    kept: list[dict] = []
    removed: list[str] = []
    for entries in groups.values():
        entries.sort(key=lambda entry: str(entry.get("built_at") or ""), reverse=True)
        kept.extend(entries[:keep])
        removed.extend(str(entry.get("file") or "") for entry in entries[keep:])
    protected = {str(entry.get("file") or "") for entry in kept} | {str(entry.get("latest") or "") for entry in kept}
    manifest["files"] = sorted(kept, key=lambda entry: (entry_key(entry), str(entry.get("built_at") or "")))
    deleted: list[str] = []
    for name in removed:
        if name and name not in protected and (directory / name).is_file():
            (directory / name).unlink()
            deleted.append(name)
    return deleted


def entry_has_details(entry: dict, details: dict) -> bool:
    return all(entry.get(field) == details[field] for field in DETAIL_FIELDS if details.get(field) not in (None, ""))


def publish(app: dict, platform_id: str, build_type: str, source: Path, data_dir: Path | None = None,
            details: dict | None = None) -> dict:
    if platform_id not in PLATFORMS:
        raise ValueError(f"Unknown platform '{platform_id}' (expected one of {', '.join(PLATFORMS)})")
    if build_type not in BUILD_TYPES:
        raise ValueError(f"Unknown build type '{build_type}' (expected one of {', '.join(BUILD_TYPES)})")
    if not source.is_file():
        raise FileNotFoundError(f"Package to publish is missing: {source}")
    app_id = str(app["id"])
    version = str(app.get("version") or "0.0.0")
    ext = extension_of(source)
    directory = download_root(data_dir) / app_id
    directory.mkdir(parents=True, exist_ok=True)
    manifest_path = directory / str(CONTRACT["manifest_file"])
    manifest = load_manifest(manifest_path, app_id, display_name(app))
    key = (platform_id, build_type)
    details = {field: details[field] for field in DETAIL_FIELDS if details and details.get(field) not in (None, "")}
    digest = sha256_of(source)
    size = source.stat().st_size

    current = entries_current(manifest["files"], key)
    if current and current.get("version") == version and current.get("sha256") == digest \
            and current.get("size") == size and entry_has_details(current, details) and is_current(current, directory):
        return {"status": STATUS_UNCHANGED, "path": directory / str(current["file"]), "entry": current, "pruned": []}

    versioned = render_name(str(CONTRACT["versioned_file"]), app_id, version, build_type, platform_id, ext)
    latest = render_name(str(CONTRACT["latest_file"]), app_id, version, build_type, platform_id, ext)
    atomic_copy(source, directory / versioned)
    atomic_copy(source, directory / latest)
    entry = {
        "platform": platform_id,
        "build_type": build_type,
        "version": version,
        **details,
        "file": versioned,
        "latest": latest,
        "size": size,
        "sha256": digest,
        "built_at": now_iso(),
    }
    manifest["files"] = [item for item in manifest["files"]
                         if not (entry_key(item) == key and item.get("version") == version)]
    manifest["files"].append(entry)
    manifest["name"] = display_name(app)
    manifest["updated_at"] = entry["built_at"]
    pruned = prune(manifest, directory, int(CONTRACT["keep_versions"]))
    atomic_write_text(manifest_path, json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    return {"status": STATUS_PUBLISHED, "path": directory / versioned, "entry": entry, "pruned": pruned}


def lan_ipv4() -> str:
    probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        probe.connect(("10.255.255.255", 1))
        return str(probe.getsockname()[0])
    except OSError:
        return ""
    finally:
        probe.close()


def mesh_source_urls() -> list[str]:
    """Origins this machine serves url_prefix on: its mesh (headscale/tailscale) host first, then its LAN address."""
    urls: list[str] = []
    try:
        from pycore.pyutils.common.tailnet_peers import current_tailnet_document
        peers = current_tailnet_document().get("peers") or []
        local = socket.gethostname().lower()
        mine = [peer for peer in peers if peer.get("self")] or [
            peer for peer in peers
            if local in (str(peer.get("hostName") or "").lower(), str(peer.get("dnsName") or "").split(".")[0])
        ]
        urls.extend(f"https://{peer['dnsName']}" for peer in mine[:1])
    except Exception as error:  # noqa: BLE001 - mesh discovery is best effort
        log(f"mesh host discovery failed: {error}")
    lan = lan_ipv4()
    if lan:
        urls.append(f"http://{lan}:{LARAVEL_BACKEND_PORT}")
    return urls


def sync_to_server(app_id: str, source_urls: list[str]) -> str:
    """Ask the Laravel server to mirror the app's downloads (contract app_downloads.server_sync); never raises."""
    node = shutil.which("node")
    if not node or not LARAVEL_CLI.is_file():
        return "skipped: node or laravel_signed_cli.js is unavailable"
    if not source_urls:
        return "skipped: this machine has no mesh or LAN origin to offer the server"
    body = json.dumps({"app": app_id, "source_base_urls": source_urls})
    try:
        result = subprocess.run([node, str(LARAVEL_CLI), "request", "POST", str(SERVER_SYNC["endpoint"]), "--json", body],
                                capture_output=True, text=True, timeout=SYNC_TIMEOUT_SECONDS, check=False, encoding="utf-8")
    except (OSError, subprocess.SubprocessError) as error:
        return f"failed: {error}"
    text = (result.stdout or result.stderr or "").strip().replace(chr(10), " ")[:SYNC_MESSAGE_CHARS]
    if result.returncode == 0:
        return f"ok: {text}"
    missing = " (the server does not have this endpoint yet)" if "404" in text or "not found" in text.lower() else ""
    return f"failed{missing}: {text}"


def publish_and_report(app: dict, platform_id: str, build_type: str, source: Path, data_dir: Path | None = None,
                       details: dict | None = None, server_sync: bool = True,
                       source_urls: list[str] | None = None) -> dict:
    result = publish(app, platform_id, build_type, source, data_dir, details)
    entry = result["entry"]
    url = f"{CONTRACT['url_prefix']}{app['id']}/{entry['file']}"
    log(f"{result['status']}: {result['path']} ({url})")
    for name in result["pruned"]:
        log(f"pruned old version: {name}")
    if server_sync:
        offered = source_urls if source_urls else mesh_source_urls()
        outcome = sync_to_server(str(app["id"]), offered)
        result["server_sync"] = outcome
        prefix = "server sync" if outcome.startswith(("ok", "skipped")) else "WARNING: server sync"
        log(f"{prefix} {outcome} (sources: {', '.join(offered) or 'none'})")
    return result


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Publish a built package into the core_node downloads directory.")
    parser.add_argument("--app", required=True, help="app flavor id")
    parser.add_argument("--name", default="", help="display name (defaults to the app id)")
    parser.add_argument("--version", required=True)
    parser.add_argument("--platform", choices=PLATFORMS, default=PRIMARY_PLATFORM)
    parser.add_argument("--build-type", choices=BUILD_TYPES, default="debug")
    parser.add_argument("--file", required=True, help="package file to publish")
    parser.add_argument("--version-code", type=int, default=0, help="android versionCode of the APK")
    parser.add_argument("--application-id", default="", help="android application id of the APK")
    parser.add_argument("--signer-sha256", default="", help="signing certificate SHA-256 of the APK")
    parser.add_argument("--no-server-sync", action="store_true", help="do not ask the Laravel server to mirror the app")
    parser.add_argument("--source-base-url", action="append", default=[],
                        help="origin offered to the server as a download source (repeatable; default: this machine's mesh/LAN)")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    app = {"id": args.app, "name": args.name or args.app, "version": args.version}
    details = {"version_code": args.version_code or None, "application_id": args.application_id,
               "signer_sha256": args.signer_sha256.lower()}
    publish_and_report(app, args.platform, args.build_type, Path(args.file).resolve(), details=details,
                       server_sync=not args.no_server_sync, source_urls=args.source_base_url)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
