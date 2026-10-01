#!/usr/bin/env python3
"""
flavor_build.py — asset + Capacitor config preparation for a flavor build.

Reads `flavors/<app>/flavor.json` (the single source of truth) and writes
`capacitor.config.json` at the project root (appId / appName / webDir / launch
background) so `bun x cap add|sync` packages the right app. Icons, splash and
localized names are rendered into the native project by brand_assets.py.

Called by build_apk.py / build_app.ps1 BEFORE `vite build`. Pure stdlib.

Usage:
  python scripts/flavor/flavor_build.py --app wordnew [--root <projectDir>]
"""
from __future__ import annotations

import argparse
import json
import os
import sys

from brand_preflight import APP_ID_PATTERN


def log(msg: str) -> None:
    print(f"[flavor] {msg}")


def load_flavor(root: str, app: str) -> dict:
    path = os.path.join(root, "flavors", app, "flavor.json")
    if not os.path.isfile(path):
        available = []
        flavors_dir = os.path.join(root, "flavors")
        if os.path.isdir(flavors_dir):
            available = sorted(
                d for d in os.listdir(flavors_dir)
                if os.path.isfile(os.path.join(flavors_dir, d, "flavor.json"))
            )
        log(f"ERROR: no flavor '{app}'. Available: {', '.join(available) or '(none)'}")
        sys.exit(2)
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def validate_app_id(flavor: dict) -> str:
    app_id = str(flavor.get("appId") or "")
    if not APP_ID_PATTERN.fullmatch(app_id):
        log(f"ERROR: flavors/{flavor['id']}/flavor.json appId '{app_id}' is not a Java package "
            "(letters/digits/underscore segments joined by dots, e.g. com.corenode.app).")
        sys.exit(2)
    return app_id


def display_name(flavor: dict) -> str:
    names = flavor.get("names") or {}
    return str(names.get("en") or flavor.get("name") or flavor["id"])


def write_capacitor_config(root: str, flavor: dict, server_url: str | None = None) -> None:
    background = ((flavor.get("launch") or {}).get("native") or {}).get("background") \
        or flavor.get("backgroundColor", "#0f172a")
    cfg = {
        "appId": validate_app_id(flavor),
        "appName": display_name(flavor),
        "webDir": "dist",
        "backgroundColor": background,
        "server": {"androidScheme": "https", "url": server_url, "cleartext": True} if server_url else {"androidScheme": "https"},
        "android": {"path": f"native/{flavor['id']}/android"},
    }
    out = os.path.join(root, "capacitor.config.json")
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(cfg, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    log(f"wrote capacitor.config.json  (appId={cfg['appId']}, appName={cfg['appName']})")


def main() -> int:
    ap = argparse.ArgumentParser(description="Prepare Capacitor config + resources for a flavor build.")
    ap.add_argument("--app", required=True, help="flavor id (a folder under flavors/)")
    ap.add_argument("--root", default=None, help="project root (default: two levels up from this script)")
    ap.add_argument("--server-url", default=None, help="live-reload dev server URL loaded by the native WebView")
    args = ap.parse_args()

    root = args.root or os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    flavor = load_flavor(root, args.app)
    log(f"flavor '{flavor['id']}' - {flavor.get('name')} ({flavor.get('appId')}) root={flavor.get('rootRoute')}")
    write_capacitor_config(root, flavor, args.server_url)
    log("done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
