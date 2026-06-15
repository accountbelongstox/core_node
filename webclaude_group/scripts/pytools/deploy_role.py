#!/usr/bin/env python3
"""
Resolve WebClaude deploy role (which services to run), persist under data dir, emit shell exports.

Cache file: <data-dir>/deploy_role.json (synced to disk immediately on change).

Usage:
  python3 deploy_role.py --shell ... >tmpfile && set -a && . tmpfile && set +a
  (start.sh writes stdout to a temp file and sources it; avoids eval quirks.)

Env:
  WEBCLAUDE_DATA_DIR   default data root (group .data)
  WEBCLAUDE_NON_INTERACTIVE  if 1: no prompts; missing cache -> all services
"""

from __future__ import annotations

import argparse
import json
import os
import shlex
import sys
from datetime import datetime, timezone

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SCRIPTS_DIR = os.path.dirname(SCRIPT_DIR)
GROUP_ROOT = os.path.dirname(SCRIPTS_DIR)

ORDER = ("center", "gateway", "website", "host")
ALIASES = {
    "center": "center",
    "server": "center",
    "gateway": "gateway",
    "gw": "gateway",
    "website": "website",
    "web": "website",
    "host": "host",
    "claude": "host",
    "hostclaude": "host",
}


def emit(key: str, value: str) -> None:
    # One assignment per line; safe for: set -a && . file && set +a
    print(f"{key}={shlex.quote(str(value))}", flush=True)


def default_data_dir() -> str:
    return os.environ.get("WEBCLAUDE_DATA_DIR") or os.path.join(GROUP_ROOT, ".data")


def ensure_dirs(data_dir: str) -> None:
    os.makedirs(data_dir, exist_ok=True)
    os.makedirs(os.path.join(data_dir, "cache"), exist_ok=True)


def role_path(data_dir: str) -> str:
    return os.path.join(data_dir, "deploy_role.json")


def parse_services_csv(s: str) -> list[str]:
    s = (s or "").strip().lower()
    if not s or s == "all":
        return list(ORDER)
    out: list[str] = []
    for part in s.split(","):
        part = part.strip().lower()
        if not part:
            continue
        key = ALIASES.get(part)
        if key and key not in out:
            out.append(key)
    return out


def services_to_csv(services: list[str]) -> str:
    seen = set()
    ordered: list[str] = []
    for x in ORDER:
        if x in services and x not in seen:
            ordered.append(x)
            seen.add(x)
    return ",".join(ordered) if ordered else "center,gateway,website,host"


def load_role(data_dir: str) -> dict | None:
    path = role_path(data_dir)
    if not os.path.isfile(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def save_role(data_dir: str, services: list[str], preset: str) -> None:
    ensure_dirs(data_dir)
    path = role_path(data_dir)
    payload = {
        "services": services_to_csv(services).split(",") if services else list(ORDER),
        "preset": preset,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
        f.write("\n")
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)


def prompt_line(msg: str) -> str:
    sys.stderr.flush()
    try:
        return input(msg).strip()
    except EOFError:
        return ""


def interactive_choose(data_dir: str, existing: dict | None) -> tuple[list[str], str]:
    if existing and existing.get("services"):
        cur = [x for x in existing["services"] if x in ORDER]
        cur_csv = services_to_csv(cur)
        sys.stderr.write(f"\n  Current deploy role: {cur_csv}\n")
        sys.stderr.write("  [Enter] keep  |  [m] change role\n")
        ch = prompt_line("  > ").lower()
        if ch != "m":
            return cur, str(existing.get("preset") or "custom")

    sys.stderr.write("\n  Select deploy role:\n")
    sys.stderr.write("    1) Full stack (center + gateway + website + host)\n")
    sys.stderr.write("    2) Website only\n")
    sys.stderr.write("    3) Gateway only\n")
    sys.stderr.write("    4) Claude Host only\n")
    sys.stderr.write("    5) Center only\n")
    sys.stderr.write(
        "    6) Custom mix — letters c/g/w/h; examples: cg (2), cgw (3), cgwh (4)\n"
    )
    choice = prompt_line("  Enter 1-6: ").strip()

    if choice == "2":
        return ["website"], "website"
    if choice == "3":
        return ["gateway"], "gateway"
    if choice == "4":
        return ["host"], "host"
    if choice == "5":
        return ["center"], "center"
    if choice == "1" or not choice:
        return list(ORDER), "all"

    if choice != "6":
        sys.stderr.write("  Invalid choice; using full stack.\n")
        return list(ORDER), "all"

    sys.stderr.write("  Letters: c=center, g=gateway, w=website, h=host (order in input is ignored).\n")
    sys.stderr.write(
        "  Examples — 2 services: cg, wh, gw  |  3: cgw, gwh, cwh  |  4: cgwh (same as full stack)\n"
    )
    raw = prompt_line("  > ").lower().replace(",", "").replace(" ", "")
    mp = {"c": "center", "g": "gateway", "w": "website", "h": "host"}
    picked: list[str] = []
    for ch in raw:
        k = mp.get(ch)
        if k and k not in picked:
            picked.append(k)
    if len(picked) < 1:
        sys.stderr.write("  No components selected; using full stack.\n")
        return list(ORDER), "all"
    return picked, "custom"


def resolve(
    data_dir: str,
    cli_services: str | None,
    non_interactive: bool,
) -> tuple[list[str], str]:
    ensure_dirs(data_dir)

    if cli_services is not None and str(cli_services).strip() != "":
        sv = parse_services_csv(cli_services)
        if not sv:
            sv = list(ORDER)
        preset = "cli"
        save_role(data_dir, sv, preset)
        return sv, preset

    loaded = load_role(data_dir)
    if non_interactive:
        if loaded and loaded.get("services"):
            sv = [x for x in loaded["services"] if x in ORDER]
            if sv:
                return sv, str(loaded.get("preset") or "custom")
        save_role(data_dir, list(ORDER), "all")
        return list(ORDER), "all"

    if sys.stdin.isatty():
        sv, preset = interactive_choose(data_dir, loaded)
        save_role(data_dir, sv, preset)
        return sv, preset

    if loaded and loaded.get("services"):
        sv = [x for x in loaded["services"] if x in ORDER]
        if sv:
            return sv, str(loaded.get("preset") or "custom")
    save_role(data_dir, list(ORDER), "all")
    return list(ORDER), "all"


def main() -> None:
    ap = argparse.ArgumentParser(description="WebClaude deploy role resolver")
    ap.add_argument("--data-dir", default="", help="Data directory (default: WEBCLAUDE_DATA_DIR or group/.data)")
    ap.add_argument("--cli-services", default="", help="Override services CSV or 'all' (saved to cache)")
    ap.add_argument("--shell", action="store_true", help="Emit KEY='value' lines for shell eval")
    args = ap.parse_args()

    data_dir = args.data_dir.strip() or default_data_dir()
    non_interactive = os.environ.get("WEBCLAUDE_NON_INTERACTIVE", "").strip() in ("1", "true", "yes", "on")
    cli = args.cli_services.strip() if args.cli_services else ""

    services, preset = resolve(
        data_dir,
        cli if cli else None,
        non_interactive,
    )
    csv = services_to_csv(services)
    log_dir = os.path.join(data_dir, "cache", "logs")

    if args.shell:
        emit("WEBCLAUDE_DATA_DIR", data_dir)
        emit("WEBCLAUDE_DEPLOY_ROLE_FILE", role_path(data_dir))
        emit("WEBCLAUDE_LOG_DIR", log_dir)
        emit("SERVICES", csv)
        emit("DEPLOY_PRESET", preset)
        sys.stdout.flush()
        return

    print(
        json.dumps(
            {
                "data_dir": data_dir,
                "services": csv.split(",") if csv else [],
                "services_csv": csv,
                "preset": preset,
                "log_dir": log_dir,
                "role_file": role_path(data_dir),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
