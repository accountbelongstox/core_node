#!/usr/bin/env python3
"""
brand_preflight.py - make sure a flavor declares everything a native build needs
(English app name, a valid appId, an existing brand logo) BEFORE building.

Interactive terminal: each missing item pauses with an explanation (press any
key), then prompts for the value; Enter keeps the shown default. For the logo
it names the exact folder/file to drop the image into, then re-checks it. The
answers are written back to flavors/<id>/flavor.json, so the next build asks
nothing. Non-interactive: every missing item is listed and the build stops.

Usage:
  python scripts/flavor/brand_preflight.py --app wordnew [--root <projectDir>] [--non-interactive]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from build_console import ask_choice, ask_text, interactive, pause_any_key

APP_ID_PATTERN = re.compile(r"[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+")
LOGO_SUFFIXES = (".png", ".jpg", ".jpeg", ".webp", ".svg")
LOGO_MIN_PX = 512
PLACEHOLDER_PX = 1024
TAG = "preflight"


def log(message: str) -> None:
    print(f"[{TAG}] {message}", flush=True)


def manifest_path(root: Path, app: str) -> Path:
    return root / "flavors" / app / "flavor.json"


def default_logo(root: Path, app: str) -> str:
    """Brand logos live with the app's own assets when the app has a folder."""
    if (root / "apps" / app).is_dir():
        return f"apps/{app}/assets/{app}-logo-source.png"
    return f"flavors/{app}/icon.png"


def default_app_id(app: str) -> str:
    return "com.corenode." + re.sub(r"[^a-zA-Z0-9_]", "", app).lower()


def logo_problem(root: Path, relative: str | None) -> str:
    if not relative:
        return "brand.icon is not declared"
    path = (root / relative).resolve()
    if root.resolve() not in path.parents:
        return f"{relative} is outside the project"
    if not path.is_file():
        return f"{relative} does not exist"
    if path.suffix.lower() not in LOGO_SUFFIXES:
        return f"{relative} is not one of {', '.join(LOGO_SUFFIXES)}"
    return ""


def describe_logo(root: Path, relative: str) -> None:
    path = root / relative
    if path.suffix.lower() == ".svg":
        log(f"logo: {relative} (vector)")
        return
    try:
        from PIL import Image
        with Image.open(path) as image:
            width, height = image.size
    except Exception:
        log(f"logo: {relative}")
        return
    log(f"logo: {relative} ({width}x{height})")
    if width != height:
        log(f"WARNING: the logo is not square ({width}x{height}); it will be stretched to a square.")
    if min(width, height) < LOGO_MIN_PX:
        log(f"WARNING: the logo is smaller than {LOGO_MIN_PX}px; large launcher/splash sizes will look soft.")


def generate_placeholder(root: Path, relative: str, flavor: dict) -> None:
    from PIL import Image, ImageDraw, ImageFont
    color = str(flavor.get("themeColor") or "#4f46e5").lstrip("#")
    background = tuple(int(color[i:i + 2], 16) for i in (0, 2, 4))
    image = Image.new("RGB", (PLACEHOLDER_PX, PLACEHOLDER_PX), background)
    draw = ImageDraw.Draw(image)
    letter = str((flavor.get("names") or {}).get("en") or flavor.get("name") or flavor["id"])[:1].upper()
    font = ImageFont.load_default(size=PLACEHOLDER_PX // 2)
    box = draw.textbbox((0, 0), letter, font=font)
    position = ((PLACEHOLDER_PX - (box[2] - box[0])) / 2 - box[0], (PLACEHOLDER_PX - (box[3] - box[1])) / 2 - box[1])
    draw.text(position, letter, fill=(255, 255, 255), font=font)
    target = root / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target)
    log(f"generated placeholder logo -> {relative}")


def resolve_names(flavor: dict, missing: list[str], prompting: bool) -> bool:
    names = dict(flavor.get("names") or {})
    if names.get("en"):
        log(f"app name: {', '.join(f'{k}={v}' for k, v in names.items())}")
        return False
    if not prompting:
        missing.append("names.en (English app name) in flavor.json")
        return False
    fallback = str(flavor.get("name") or flavor["id"].replace("-", " ").title())
    pause_any_key(f"\n[{TAG}] The app has no English display name (names.en); it is used for the launcher label.")
    names["en"] = ask_text("App name (English)", fallback)
    zh = ask_text("App name (Chinese, optional)", str(names.get("zh") or ""))
    if zh:
        names["zh"] = zh
    flavor["names"] = names
    flavor.setdefault("name", names["en"])
    return True


def resolve_app_id(flavor: dict, missing: list[str], prompting: bool) -> bool:
    app_id = str(flavor.get("appId") or "")
    if APP_ID_PATTERN.fullmatch(app_id):
        log(f"appId: {app_id}")
        return False
    if not prompting:
        missing.append(f"appId '{app_id}' is not a Java package (e.g. {default_app_id(flavor['id'])})")
        return False
    pause_any_key(f"\n[{TAG}] appId '{app_id or '(empty)'}' is invalid: use letters/digits/underscore "
                  "segments joined by dots, e.g. com.corenode.app.")
    while True:
        value = ask_text("appId", default_app_id(flavor["id"]))
        if APP_ID_PATTERN.fullmatch(value):
            flavor["appId"] = value
            return True
        log(f"'{value}' is still not a valid appId.")


def resolve_logo(root: Path, flavor: dict, missing: list[str], prompting: bool) -> bool:
    brand = dict(flavor.get("brand") or {})
    declared = brand.get("icon")
    problem = logo_problem(root, declared)
    if not problem:
        describe_logo(root, declared)
        return False
    target = declared or default_logo(root, flavor["id"])
    if not prompting:
        missing.append(f"brand logo: {problem} (place a square PNG/SVG at {(root / target).resolve()})")
        return False
    pause_any_key(
        f"\n[{TAG}] Brand logo missing: {problem}.\n"
        f"[{TAG}] Put a square PNG/JPG/WebP/SVG (>= {LOGO_MIN_PX}px) here:\n"
        f"[{TAG}]     {(root / target).resolve()}\n"
        f"[{TAG}] (folder: {(root / target).resolve().parent})\n"
        f"[{TAG}] It is the ONE source for the launcher icons, splash and favicon.")
    while True:
        relative = ask_text("Logo path (project-relative)", target).replace("\\", "/")
        problem = logo_problem(root, relative)
        if not problem:
            break
        log(f"Not usable: {problem}.")
        choice = ask_choice("What now?", {"r": "retry after placing the file", "g": f"generate a placeholder at {relative}",
                                          "a": "abort the build"}, "r")
        if choice == "a":
            raise SystemExit(2)
        if choice == "g" and Path(relative).suffix.lower() in LOGO_SUFFIXES[:-1]:
            generate_placeholder(root, relative, flavor)
            break
        if choice == "g":
            log("A placeholder needs a .png/.jpg/.webp path.")
        target = relative
    describe_logo(root, relative)
    brand["icon"] = relative
    flavor["brand"] = brand
    return True


def run_preflight(root: Path, app: str, non_interactive: bool = False) -> dict:
    """Check (and interactively complete) the flavor's brand inputs; returns the flavor."""
    path = manifest_path(root, app)
    flavor = json.loads(path.read_text(encoding="utf-8"))
    prompting = not non_interactive and interactive()
    missing: list[str] = []
    changed = resolve_names(flavor, missing, prompting)
    changed = resolve_app_id(flavor, missing, prompting) or changed
    changed = resolve_logo(root, flavor, missing, prompting) or changed
    if missing:
        for item in missing:
            log(f"MISSING: {item}")
        log(f"Fix {path} (or run in a terminal to be prompted), then build again.")
        raise SystemExit(2)
    if changed:
        path.write_text(json.dumps(flavor, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        log(f"saved answers to {path.relative_to(root)}")
    log("brand inputs complete.")
    return flavor


def main() -> int:
    parser = argparse.ArgumentParser(description="Check and complete a flavor's app name, appId and logo.")
    parser.add_argument("--app", required=True)
    parser.add_argument("--root", default=None)
    parser.add_argument("--non-interactive", action="store_true")
    args = parser.parse_args()
    root = Path(args.root).resolve() if args.root else Path(__file__).resolve().parents[2]
    run_preflight(root, args.app, args.non_interactive)
    return 0


if __name__ == "__main__":
    sys.exit(main())
