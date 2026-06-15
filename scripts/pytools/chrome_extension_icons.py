#!/usr/bin/env python3
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

"""
Chrome extension icons for mcp-chrome public/icon.

- --from-downloads: copy ~/Downloads/chrome.png and/or chrome.svg into public/icon,
  build 16/32/48/96/128 PNGs (PNG resized with Pillow; SVG uses cairosvg/magick/rsvg).

Manifest icons are PNG-only:
https://developer.chrome.com/docs/extensions/reference/manifest/icons
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import traceback
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
CORE_NODE_DIR = SCRIPT_DIR.parent.parent
DEFAULT_EXT_ICON_DIR = (
    CORE_NODE_DIR
    / "apps"
    / "mcp-chrome"
    / "app"
    / "chrome-extension"
    / "public"
    / "icon"
)
DEFAULT_SVG_NAME = "chrome.svg"
SIZES = (16, 32, 48, 96, 128)

EMBEDDED_CHROME_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <path
    d="M510.318357 0.14623q137.090479-1.169839 257.58387 68.508682 132.484239 76.551323 201.066036 212.471963l-423.847203-22.300051q-91.393653-5.118045-167.944976 42.552885t-105.651062 131.095055l-157.635772-242.229737q73.114922-90.808733 177.669261-140.23442t218.759847-50.010607zM83.619672 231.481843l192.51159 378.735296q41.163701 81.669368 120.493391 123.929793t167.360057 25.736453l-131.387515 257.58387q-121.078311-18.86365-219.929685-89.931354t-155.661669-180.520742-56.810294-235.064474q0-152.517727 83.424126-280.468841zM989.513556 327.99354q33.12106 85.690689 33.998439 177.376801t-27.710555 174.817779-87.372332 155.369209-140.52688 119.689127q-131.387515 75.966404-284.490162 67.996877l231.335613-355.850325q50.303066-74.796565 47.159125-165.970873t-60.831615-158.513151zM512 339.472583q71.433279 0 121.95569 50.522411t50.522411 121.95569-50.522411 121.95569-121.95569 50.522411-121.95569-50.522411-50.522411-121.95569 50.522411-121.95569 121.95569-50.522411z"
    fill="#d81e06"
  />
</svg>
"""


def _rasterize_cairosvg(svg_path: Path, out_path: Path, size: int) -> None:
    import cairosvg

    cairosvg.svg2png(
        url=str(svg_path),
        write_to=str(out_path),
        output_width=size,
        output_height=size,
    )


def _rasterize_magick(svg_path: Path, out_path: Path, size: int) -> None:
    cmd = [
        "magick",
        str(svg_path),
        "-background",
        "none",
        "-resize",
        f"{size}x{size}",
        str(out_path),
    ]
    subprocess.run(cmd, check=True)


def _rasterize_rsvg_convert(svg_path: Path, out_path: Path, size: int) -> None:
    cmd = [
        "rsvg-convert",
        "-w",
        str(size),
        "-h",
        str(size),
        "-o",
        str(out_path),
        str(svg_path),
    ]
    subprocess.run(cmd, check=True)


def rasterize_one(svg_path: Path, out_path: Path, size: int) -> None:
    backends: list = []
    try:
        import cairosvg  # noqa: F401

        backends.append(_rasterize_cairosvg)
    except ImportError:
        pass
    if shutil.which("magick"):
        backends.append(_rasterize_magick)
    if shutil.which("rsvg-convert"):
        backends.append(_rasterize_rsvg_convert)
    if not backends:
        raise RuntimeError(
            "No SVG raster backend. Install: pip install cairosvg "
            "or ImageMagick (magick) or librsvg (rsvg-convert)."
        )
    last_exc: Exception | None = None
    for fn in backends:
        try:
            fn(svg_path, out_path, size)
            return
        except Exception as exc:
            last_exc = exc
    raise RuntimeError("All SVG raster backends failed for this size.") from last_exc


def describe_backends() -> str:
    parts: list[str] = []
    try:
        import cairosvg  # noqa: F401

        parts.append("cairosvg=ok")
    except ImportError:
        parts.append("cairosvg=missing")
    parts.append(f"magick={'yes' if shutil.which('magick') else 'no'}")
    parts.append(f"rsvg-convert={'yes' if shutil.which('rsvg-convert') else 'no'}")
    return ", ".join(parts)


def resize_png_to_icon_sizes(png_src: Path, icon_dir: Path) -> None:
    from PIL import Image

    img = Image.open(png_src).convert("RGBA")
    resample = Image.Resampling.LANCZOS if hasattr(Image, "Resampling") else Image.LANCZOS
    for size in SIZES:
        out = img.resize((size, size), resample)
        dest = icon_dir / f"{size}.png"
        out.save(dest, "PNG")
        print(f"[icons] wrote {dest.name} ({dest.stat().st_size} bytes) from Downloads PNG")


def copy_to_downloads(icon_dir: Path, svg_path: Path) -> None:
    downloads = Path.home() / "Downloads"
    downloads.mkdir(parents=True, exist_ok=True)
    dst_svg = downloads / "chrome.svg"
    dst_png = downloads / "chrome.png"
    png_128 = icon_dir / "128.png"
    shutil.copy2(svg_path, dst_svg)
    print(f"[icons] copied SVG to {dst_svg}")
    if png_128.is_file():
        shutil.copy2(png_128, dst_png)
        print(f"[icons] copied 128.png as {dst_png}")
    else:
        print(f"[icons] skip chrome.png in Downloads: missing {png_128}")


def apply_embedded_svg(icon_dir: Path, svg_name: str) -> Path:
    out = (icon_dir / svg_name).resolve()
    icon_dir.mkdir(parents=True, exist_ok=True)
    out.write_text(EMBEDDED_CHROME_SVG.strip() + "\n", encoding="utf-8")
    print(f"[icons] wrote embedded template to {out}")
    return out


def import_from_downloads(icon_dir: Path, downloads_dir: Path) -> bool:
    png_src = downloads_dir / "chrome.png"
    svg_src = downloads_dir / "chrome.svg"
    if not png_src.is_file() and not svg_src.is_file():
        print(
            f"[icons] ERROR: Put chrome.png and/or chrome.svg in: {downloads_dir}",
            file=sys.stderr,
        )
        return False

    icon_dir.mkdir(parents=True, exist_ok=True)
    print(f"[icons] import from Downloads -> {icon_dir}")

    if png_src.is_file():
        try:
            resize_png_to_icon_sizes(png_src, icon_dir)
        except Exception:
            print("[icons] ERROR: Pillow failed to resize PNG. pip install pillow", file=sys.stderr)
            traceback.print_exc()
            return False

    if svg_src.is_file():
        dest_svg = icon_dir / "chrome.svg"
        shutil.copy2(svg_src, dest_svg)
        print(f"[icons] replaced {dest_svg}")

    if png_src.is_file():
        print("[icons] Done (PNG master used for all sizes).")
        return True

    svg_path = icon_dir / "chrome.svg"
    if not svg_path.is_file():
        print("[icons] ERROR: no chrome.svg in icon dir after import.", file=sys.stderr)
        return False

    print(f"[icons] backends: {describe_backends()}")
    failed = False
    for size in SIZES:
        out_path = icon_dir / f"{size}.png"
        print(f"[icons] rasterize {size}x{size} -> {out_path.name}")
        try:
            rasterize_one(svg_path, out_path, size)
            nbytes = out_path.stat().st_size
            print(f"[icons] wrote {out_path.name} ({nbytes} bytes)")
        except Exception:
            failed = True
            traceback.print_exc()

    if failed:
        print("[icons] ERROR: SVG raster failed.", file=sys.stderr)
        return False

    print("[icons] Done (SVG rasterized to all sizes).")
    return True


def generate_from_repo_svg(icon_dir: Path, svg_path: Path) -> bool:
    print(f"[icons] backends: {describe_backends()}")
    icon_dir.mkdir(parents=True, exist_ok=True)
    failed = False
    for size in SIZES:
        out_path = icon_dir / f"{size}.png"
        print(f"[icons] rasterize {size}x{size} -> {out_path.name}")
        try:
            rasterize_one(svg_path, out_path, size)
            nbytes = out_path.stat().st_size
            print(f"[icons] wrote {out_path.name} ({nbytes} bytes)")
        except Exception:
            failed = True
            traceback.print_exc()

    if failed:
        print("[icons] ERROR: one or more PNG writes failed.", file=sys.stderr)
        return False
    return True


def main() -> None:
    parser = argparse.ArgumentParser(
        description="mcp-chrome public/icon: import from Downloads or generate from repo SVG."
    )
    parser.add_argument(
        "--icon-dir",
        type=Path,
        default=DEFAULT_EXT_ICON_DIR,
        help="Extension public/icon directory.",
    )
    parser.add_argument(
        "--svg",
        type=str,
        default=DEFAULT_SVG_NAME,
        help="SVG file name inside icon-dir (generate mode).",
    )
    parser.add_argument(
        "--from-downloads",
        action="store_true",
        help="Copy chrome.png / chrome.svg from Downloads into icon-dir and build all PNG sizes.",
    )
    parser.add_argument(
        "--downloads-dir",
        type=Path,
        default=None,
        help="Override Downloads directory (default: ~/Downloads).",
    )
    parser.add_argument(
        "--apply-embedded-svg",
        action="store_true",
        help="Overwrite icon-dir/chrome.svg with built-in template (generate mode only).",
    )
    parser.add_argument(
        "--copy-to-downloads",
        action="store_true",
        help="After generate mode, also export chrome.svg and 128.png to Downloads.",
    )
    args = parser.parse_args()

    icon_dir = args.icon_dir.resolve()
    downloads_dir = args.downloads_dir
    if downloads_dir is None:
        downloads_dir = Path.home() / "Downloads"
    else:
        downloads_dir = downloads_dir.resolve()

    if args.from_downloads:
        ok = import_from_downloads(icon_dir, downloads_dir)
        if ok:
            print(
                "[icons] Next: pnpm run dev or pnpm run build here, then Reload on chrome://extensions."
            )
        return

    if args.apply_embedded_svg:
        svg_path = apply_embedded_svg(icon_dir, args.svg)
    else:
        svg_path = (icon_dir / args.svg).resolve()

    if not svg_path.is_file():
        print(f"[icons] ERROR: SVG not found: {svg_path}", file=sys.stderr)
        print("[icons] HINT: run with --apply-embedded-svg or --from-downloads.", file=sys.stderr)
        return

    ok = generate_from_repo_svg(icon_dir, svg_path)
    if not ok:
        return

    if args.copy_to_downloads:
        copy_to_downloads(icon_dir, svg_path)

    print("[icons] done.")
    print(
        "[icons] Next: pnpm run dev or pnpm run build here, then Reload on chrome://extensions."
    )


if __name__ == "__main__":
    main()
