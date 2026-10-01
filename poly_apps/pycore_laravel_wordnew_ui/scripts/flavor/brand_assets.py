#!/usr/bin/env python3
"""
brand_assets.py - one brand source -> every native size, idempotently.

flavors/<id>/flavor.json names ONE project-relative brand icon (`brand.icon`,
PNG/JPEG/WebP/SVG) plus localized app names (`names`) and launch settings
(`launch.native`). This helper renders the Android launcher icons (legacy,
round, adaptive foreground + background color), the Android 12+ splash icon,
the pre-12 splash bitmaps (portrait/landscape, light/night) and the localized
`app_name` strings into native/<id>/android. Sources are only read.

Idempotent: a fingerprint of the sources + settings + generator version is kept
in native/<id>/android/.core-node-brand.json; an unchanged fingerprint with all
outputs present is a no-op, any source change regenerates every output and
removes outputs the new settings no longer produce.

Usage:
  python scripts/flavor/brand_assets.py --app wordnew [--root <projectDir>] [--force]
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import subprocess
import sys
from pathlib import Path

from brand_preflight import run_preflight

GENERATOR_VERSION = 2
STAMP_FILE = ".core-node-brand.json"
RES_DIR = Path("app") / "src" / "main" / "res"
DENSITIES = {"ldpi": 0.75, "mdpi": 1.0, "hdpi": 1.5, "xhdpi": 2.0, "xxhdpi": 3.0, "xxxhdpi": 4.0}
LAUNCHER_DP = 48
ADAPTIVE_DP = 108
SPLASH_ICON_DP = 288
SPLASH_PORTRAIT_DP = (320, 480)
DEFAULT_ADAPTIVE_SCALE = 0.72
DEFAULT_SPLASH_ICON_SCALE = 0.44
DEFAULT_SPLASH_LOGO_SCALE = 0.28
DEFAULT_BACKGROUND = "#0f172a"
RASTER_SUFFIXES = (".png", ".jpg", ".jpeg", ".webp")
PIP_PACKAGES = {"PIL": "Pillow", "resvg_py": "resvg_py"}
BRAND_VALUES = "core_node_brand.xml"
LAUNCH_STYLE = "AppTheme.NoActionBarLaunch"


def log(message: str) -> None:
    print(f"[brand] {message}", flush=True)


def fail(message: str) -> None:
    log(f"ERROR: {message}")
    raise SystemExit(2)


def ensure_module(module: str) -> None:
    try:
        __import__(module)
    except ImportError:
        package = PIP_PACKAGES[module]
        log(f"Installing missing Python package: {package}")
        subprocess.run([sys.executable, "-m", "pip", "install", "--quiet", package], check=True)


def load_flavor(root: Path, app: str) -> dict:
    path = root / "flavors" / app / "flavor.json"
    if not path.is_file():
        fail(f"No flavor manifest: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def project_file(root: Path, relative: str, label: str) -> Path:
    path = (root / relative).resolve()
    if root.resolve() not in path.parents or not path.is_file():
        fail(f"{label} must be an existing file inside the project: {relative}")
    return path


def brand_settings(root: Path, flavor: dict) -> dict:
    brand = flavor.get("brand") or {}
    launch = (flavor.get("launch") or {}).get("native") or {}
    if not brand.get("icon"):
        fail(f"flavors/{flavor['id']}/flavor.json needs brand.icon (project-relative path)")
    background = launch.get("background") or flavor.get("backgroundColor") or DEFAULT_BACKGROUND
    return {
        "icon": project_file(root, brand["icon"], "brand.icon"),
        "iconBackground": brand.get("iconBackground"),
        "adaptiveScale": float(brand.get("adaptiveScale") or DEFAULT_ADAPTIVE_SCALE),
        "names": app_names(flavor),
        "splashBackground": background,
        "splashBackgroundDark": launch.get("backgroundDark") or background,
        "splashImage": project_file(root, launch["image"], "launch.native.image") if launch.get("image") else None,
        "splashImageFocus": launch.get("imageFocus") or "50% 50%",
        "splashIconScale": float(launch.get("iconScale") or DEFAULT_SPLASH_ICON_SCALE),
        "splashLogoScale": float(launch.get("logoScale") or DEFAULT_SPLASH_LOGO_SCALE),
    }


def app_names(flavor: dict) -> dict[str, str]:
    names = {str(k): str(v) for k, v in (flavor.get("names") or {}).items() if v}
    names.setdefault("default", names.get("en") or flavor.get("name") or flavor["id"])
    return names


def fingerprint(settings: dict) -> str:
    digest = hashlib.sha256(f"v{GENERATOR_VERSION}".encode())
    for key in sorted(settings):
        value = settings[key]
        digest.update(key.encode())
        if isinstance(value, Path):
            digest.update(value.read_bytes())
        else:
            digest.update(json.dumps(value, sort_keys=True).encode())
    return digest.hexdigest()


def render_source(path: Path, size: int):
    from PIL import Image
    if path.suffix.lower() == ".svg":
        import resvg_py
        data = resvg_py.svg_to_bytes(svg_path=str(path), width=size, height=size)
        return Image.open(io.BytesIO(bytes(data))).convert("RGBA")
    if path.suffix.lower() not in RASTER_SUFFIXES:
        fail(f"Unsupported brand source type: {path.name}")
    with Image.open(path) as image:
        return image.convert("RGBA").resize((size, size), Image.LANCZOS)


def hex_rgba(color: str) -> tuple[int, int, int, int]:
    value = color.lstrip("#")
    if len(value) == 3:
        value = "".join(ch * 2 for ch in value)
    return int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16), 255


def edge_color(icon) -> str:
    """Average opaque border color: the adaptive background that blends with the art."""
    width, height = icon.size
    pixels = [icon.getpixel((x, y)) for x in range(width) for y in (0, height - 1)]
    pixels += [icon.getpixel((x, y)) for y in range(height) for x in (0, width - 1)]
    opaque = [p for p in pixels if p[3] > 200]
    if not opaque:
        return "#ffffff"
    r, g, b = (sum(p[i] for p in opaque) // len(opaque) for i in range(3))
    return f"#{r:02x}{g:02x}{b:02x}"


def centered(icon, canvas_size: int, scale: float, background=(0, 0, 0, 0)):
    from PIL import Image
    canvas = Image.new("RGBA", (canvas_size, canvas_size), background)
    side = max(1, round(canvas_size * scale))
    canvas.alpha_composite(icon.resize((side, side), Image.LANCZOS), ((canvas_size - side) // 2,) * 2)
    return canvas


def circle(icon):
    from PIL import Image, ImageDraw
    size = icon.size[0]
    mask = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
    mask = mask.resize((size, size), Image.LANCZOS)
    result = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    result.paste(icon, (0, 0), mask)
    return result


def cover(image, width: int, height: int, focus: str):
    from PIL import Image
    fx, fy = (float(part.strip().rstrip("%")) / 100 for part in (focus.split() + ["50%"])[:2])
    scale = max(width / image.width, height / image.height)
    resized = image.resize((max(width, round(image.width * scale)), max(height, round(image.height * scale))), Image.LANCZOS)
    left = round((resized.width - width) * fx)
    top = round((resized.height - height) * fy)
    return resized.crop((left, top, left + width, top + height))


def splash_bitmap(settings: dict, master, width: int, height: int, background: str):
    from PIL import Image
    canvas = Image.new("RGBA", (width, height), hex_rgba(background))
    if settings["splashImage"]:
        with Image.open(settings["splashImage"]) as photo:
            canvas.alpha_composite(cover(photo.convert("RGBA"), width, height, settings["splashImageFocus"]))
    side = max(1, round(min(width, height) * settings["splashLogoScale"]))
    canvas.alpha_composite(master.resize((side, side), Image.LANCZOS), ((width - side) // 2, (height - side) // 2))
    return canvas.convert("RGB")


def values_dir(language: str) -> str:
    if language == "default":
        return "values"
    parts = language.replace("_", "-").split("-")
    if len(parts) > 1 and len(parts[1]) == 4:
        return "values-b+" + "+".join([parts[0], parts[1].title()] + parts[2:])
    return f"values-{parts[0]}" + (f"-r{parts[1].upper()}" if len(parts) > 1 else "")


def strings_xml(name: str) -> str:
    escaped = name.replace("&", "&amp;").replace("<", "&lt;").replace("'", "\\'")
    return ("<?xml version='1.0' encoding='utf-8'?>\n<resources>\n"
            f"    <string name=\"app_name\">{escaped}</string>\n"
            f"    <string name=\"title_activity_main\">{escaped}</string>\n</resources>\n")


def patch_default_strings(path: Path, name: str) -> None:
    content = path.read_text(encoding="utf-8")
    escaped = name.replace("&", "&amp;").replace("<", "&lt;").replace("'", "\\'")
    for key in ("app_name", "title_activity_main"):
        content = re.sub(rf'(<string name="{key}">)[^<]*(</string>)', rf"\g<1>{escaped}\g<2>", content)
    path.write_text(content, encoding="utf-8")


def patch_launch_style(path: Path) -> None:
    content = path.read_text(encoding="utf-8")
    block = (f'<style name="{LAUNCH_STYLE}" parent="Theme.SplashScreen">\n'
             '        <item name="android:background">@drawable/splash</item>\n'
             '        <item name="windowSplashScreenBackground">@color/core_node_splash_background</item>\n'
             '        <item name="windowSplashScreenAnimatedIcon">@drawable/splash_icon</item>\n'
             '        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>\n'
             '    </style>')
    updated = re.sub(rf'<style name="{re.escape(LAUNCH_STYLE)}"[\s\S]*?</style>', block, content)
    if updated != content:
        path.write_text(updated, encoding="utf-8")


def adaptive_xml() -> str:
    return ('<?xml version="1.0" encoding="utf-8"?>\n'
            '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
            '    <background android:drawable="@color/ic_launcher_background" />\n'
            '    <foreground android:drawable="@mipmap/ic_launcher_foreground" />\n'
            '</adaptive-icon>\n')


def colors_xml(launcher_background: str, splash_background: str) -> str:
    return ('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
            f'    <color name="ic_launcher_background">{launcher_background}</color>\n'
            f'    <color name="core_node_splash_background">{splash_background}</color>\n</resources>\n')


def generate(android_dir: Path, settings: dict) -> list[str]:
    from PIL import Image
    res = android_dir / RES_DIR
    written: list[str] = []

    def save(relative: str, image, fmt: str = "PNG") -> None:
        target = res / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        image.save(target, format=fmt, optimize=True)
        written.append(relative)

    def write(relative: str, text: str) -> None:
        target = res / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text, encoding="utf-8")
        written.append(relative)

    master = render_source(settings["icon"], 1024)
    launcher_background = settings["iconBackground"] or edge_color(master)
    for density, factor in DENSITIES.items():
        launcher = round(LAUNCHER_DP * factor)
        icon = master.resize((launcher, launcher), Image.LANCZOS)
        save(f"mipmap-{density}/ic_launcher.png", icon)
        save(f"mipmap-{density}/ic_launcher_round.png", circle(icon))
        save(f"mipmap-{density}/ic_launcher_foreground.png",
             centered(master, round(ADAPTIVE_DP * factor), settings["adaptiveScale"]))
        save(f"drawable-{density}/splash_icon.png",
             centered(master, round(SPLASH_ICON_DP * factor), settings["splashIconScale"]))
        portrait = tuple(round(dp * factor) for dp in SPLASH_PORTRAIT_DP)
        for orientation, (width, height) in (("port", portrait), ("land", portrait[::-1])):
            save(f"drawable-{orientation}-{density}/splash.png",
                 splash_bitmap(settings, master, width, height, settings["splashBackground"]))
            save(f"drawable-{orientation}-night-{density}/splash.png",
                 splash_bitmap(settings, master, width, height, settings["splashBackgroundDark"]))
    save("drawable/splash.png", splash_bitmap(settings, master, 480, 800, settings["splashBackground"]))
    save("drawable-night/splash.png", splash_bitmap(settings, master, 480, 800, settings["splashBackgroundDark"]))
    write("mipmap-anydpi-v26/ic_launcher.xml", adaptive_xml())
    write("mipmap-anydpi-v26/ic_launcher_round.xml", adaptive_xml())
    write(f"values/{BRAND_VALUES}", colors_xml(launcher_background, settings["splashBackground"]))
    write(f"values-night/{BRAND_VALUES}", colors_xml(launcher_background, settings["splashBackgroundDark"]))
    for language, name in settings["names"].items():
        if language == "default":
            patch_default_strings(res / "values" / "strings.xml", name)
        else:
            write(f"{values_dir(language)}/strings.xml", strings_xml(name))
    patch_launch_style(res / "values" / "styles.xml")
    return written


def remove_legacy(res: Path) -> None:
    """Drop the per-density background bitmaps of the former @capacitor/assets pipeline."""
    for legacy in res.glob("mipmap-*/ic_launcher_background.png"):
        legacy.unlink()
    colors = res / "values" / "ic_launcher_background.xml"
    if colors.is_file():
        colors.unlink()


def sync(root: Path, app: str, force: bool = False) -> None:
    for module in PIP_PACKAGES:
        ensure_module(module)
    flavor = load_flavor(root, app)
    log(f"{app}: source {flavor.get('brand', {}).get('icon')} -> native/{app}/android/{RES_DIR.as_posix()}")
    android_dir = root / "native" / app / "android"
    if not (android_dir / RES_DIR).is_dir():
        fail(f"Android project is missing: {android_dir}")
    settings = brand_settings(root, flavor)
    stamp_path = android_dir / STAMP_FILE
    stamp = json.loads(stamp_path.read_text(encoding="utf-8")) if stamp_path.is_file() else {}
    digest = fingerprint(settings)
    res = android_dir / RES_DIR
    outputs = stamp.get("outputs") or []
    if not force and stamp.get("fingerprint") == digest and outputs and all((res / o).is_file() for o in outputs):
        log(f"{app}: brand assets are up to date ({settings['icon'].relative_to(root)}).")
        return
    log(f"{app}: {'forced' if force else 'source or settings changed'}; rendering launcher icons, splash and names...")
    remove_legacy(res)
    written = generate(android_dir, settings)
    for stale in set(outputs) - set(written):
        target = res / stale
        if target.is_file():
            target.unlink()
            log(f"removed stale output: {stale}")
    stamp_path.write_text(json.dumps({
        "fingerprint": digest,
        "source": str(settings["icon"].relative_to(root)).replace("\\", "/"),
        "outputs": sorted(written),
    }, indent=2) + "\n", encoding="utf-8")
    log(f"{app}: generated {len(written)} assets from {settings['icon'].relative_to(root)} "
        f"(names: {', '.join(f'{k}={v}' for k, v in settings['names'].items())}).")


def main() -> int:
    parser = argparse.ArgumentParser(description="Render a flavor's brand icon, splash and names into its native project.")
    parser.add_argument("--app", required=True)
    parser.add_argument("--root", default=None)
    parser.add_argument("--force", action="store_true", help="regenerate even when the fingerprint is unchanged")
    parser.add_argument("--non-interactive", action="store_true")
    args = parser.parse_args()
    root = Path(args.root).resolve() if args.root else Path(__file__).resolve().parents[2]
    run_preflight(root, args.app, args.non_interactive)
    sync(root, args.app, args.force)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
