#!/usr/bin/env python3
"""
flavor_build.py — asset + Capacitor config preparation for a flavor build.

Reads `flavors/<app>/flavor.json` (the single source of truth) and:
  1. writes `capacitor.config.json` at the project root (appId / appName / webDir
     / theme + background colors) so `npx cap sync` packages the right app;
  2. prepares `resources/icon.png` (1024) + `resources/splash.png` (2732) for
     `npx @capacitor/assets generate` — copied from the flavor folder when a PNG
     is supplied, else rasterized from the flavor's themeColor + initial (when
     Pillow is available), else a clear instruction is printed.

Called by build_app.ps1 BEFORE `vite build`. Pure-stdlib except the OPTIONAL
Pillow import used only to synthesize placeholder art.

Usage:
  python scripts/flavor/flavor_build.py --app wordnew [--root <projectDir>]
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys


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


def write_capacitor_config(root: str, flavor: dict) -> None:
    cfg = {
        "appId": flavor.get("appId", "com.corenode." + flavor["id"]),
        "appName": flavor.get("name", flavor["id"]),
        "webDir": "dist",
        "backgroundColor": flavor.get("backgroundColor", "#0f172a"),
        "server": {"androidScheme": "https"},
        "plugins": {
            "SplashScreen": {
                "backgroundColor": flavor.get("backgroundColor", "#0f172a"),
                "launchAutoHide": True,
            }
        },
    }
    out = os.path.join(root, "capacitor.config.json")
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(cfg, fh, indent=2)
        fh.write("\n")
    log(f"wrote capacitor.config.json  (appId={cfg['appId']}, appName={cfg['appName']})")


def _hex_to_rgb(h: str):
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _try_pillow():
    try:
        from PIL import Image, ImageDraw, ImageFont  # type: ignore
        return Image, ImageDraw, ImageFont
    except Exception:
        return None


def prepare_resources(root: str, app: str, flavor: dict) -> None:
    flavor_dir = os.path.join(root, "flavors", app)
    res_dir = os.path.join(root, "resources")
    os.makedirs(res_dir, exist_ok=True)

    def ensure(kind: str, size: int, dest_name: str) -> None:
        src_png = os.path.join(flavor_dir, f"{kind}.png")
        dest = os.path.join(res_dir, dest_name)
        if os.path.isfile(src_png):
            shutil.copyfile(src_png, dest)
            log(f"copied {kind}.png -> resources/{dest_name}")
            return
        pil = _try_pillow()
        if pil is None:
            log(f"NOTE: no {kind}.png for '{app}' and Pillow not installed — "
                f"provide flavors/{app}/{kind}.png ({size}x{size}) then re-run, "
                f"or `pip install Pillow`.")
            return
        Image, ImageDraw, ImageFont = pil
        bg = _hex_to_rgb(flavor.get("themeColor" if kind == "icon" else "backgroundColor", "#4f46e5"))
        img = Image.new("RGB", (size, size), bg)
        draw = ImageDraw.Draw(img)
        letter = (flavor.get("shortName") or flavor.get("name") or app)[:1].upper()
        try:
            font = ImageFont.truetype("arial.ttf", int(size * 0.5))
        except Exception:
            font = ImageFont.load_default()
        try:
            bbox = draw.textbbox((0, 0), letter, font=font)
            tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
            draw.text(((size - tw) / 2 - bbox[0], (size - th) / 2 - bbox[1]), letter, fill=(255, 255, 255), font=font)
        except Exception:
            draw.text((size / 2, size / 2), letter, fill=(255, 255, 255))
        img.save(dest)
        log(f"generated placeholder {kind} -> resources/{dest_name} ({size}px, {flavor.get('themeColor')})")

    ensure("icon", 1024, "icon.png")
    ensure("splash", 2732, "splash.png")


def main() -> int:
    ap = argparse.ArgumentParser(description="Prepare Capacitor config + resources for a flavor build.")
    ap.add_argument("--app", required=True, help="flavor id (a folder under flavors/)")
    ap.add_argument("--root", default=None, help="project root (default: two levels up from this script)")
    args = ap.parse_args()

    root = args.root or os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    flavor = load_flavor(root, args.app)
    log(f"flavor '{flavor['id']}' - {flavor.get('name')} ({flavor.get('appId')}) root={flavor.get('rootRoute')}")
    write_capacitor_config(root, flavor)
    prepare_resources(root, args.app, flavor)
    log("done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
