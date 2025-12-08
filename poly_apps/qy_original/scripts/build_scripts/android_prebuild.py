#!/usr/bin/env python3
import os
import sys
import configparser
import shutil
import argparse
from pathlib import Path
from typing import Dict, List, Tuple, Optional

if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("Warning: PIL (Pillow) is required for icon generation")
    print("Install it with: pip install Pillow")
    print("Skipping icon replacement...")
    sys.exit(0)

PROJECT_ROOT = None
BUILD_CONFIG_PATH = None
ANDROID_DIR = None
ASSETS_DIR = None

MIPMAP_SIZES = {
    'mdpi': 48,
    'hdpi': 72,
    'xhdpi': 96,
    'xxhdpi': 144,
    'xxxhdpi': 192
}

def parse_arguments():
    parser = argparse.ArgumentParser(description='Android prebuild processor for React Native')
    parser.add_argument('project_root', type=str, help='Project root directory path')
    return parser.parse_args()

def initialize_paths(project_root: str):
    global PROJECT_ROOT, BUILD_CONFIG_PATH, ANDROID_DIR, ASSETS_DIR

    PROJECT_ROOT = Path(project_root).resolve()

    if not PROJECT_ROOT.exists():
        print(f"Error: Project root does not exist: {PROJECT_ROOT}")
        sys.exit(1)

    BUILD_CONFIG_PATH = PROJECT_ROOT / 'build_config.ini'
    ANDROID_DIR = PROJECT_ROOT / 'android'
    ASSETS_DIR = PROJECT_ROOT / 'assets'

def read_build_config() -> configparser.ConfigParser:
    config = configparser.ConfigParser()

    if not BUILD_CONFIG_PATH.exists():
        print(f"Info: build_config.ini not found at {BUILD_CONFIG_PATH}")
        print("Using default settings")
        return config

    try:
        config.read(BUILD_CONFIG_PATH, encoding='utf-8')
        print(f"[OK] Loaded build_config.ini")
        return config
    except Exception as e:
        print(f"Warning: Error reading build_config.ini: {e}")
        print("Using default settings")
        return config

def find_logo_image() -> Optional[Path]:
    logo_dir = ASSETS_DIR / 'logo'

    if logo_dir.exists():
        for logo_file in logo_dir.glob('*.png'):
            if 'logo' in logo_file.name.lower() or 'icon' in logo_file.name.lower():
                print(f"[OK] Found logo: {logo_file.relative_to(PROJECT_ROOT)}")
                return logo_file

    if ASSETS_DIR.exists():
        print(f"[INFO] Logo not found in assets/logo/, searching recursively in assets/...")
        for logo_file in ASSETS_DIR.rglob('*.png'):
            if 'logo' in logo_file.name.lower() or 'icon' in logo_file.name.lower():
                print(f"[OK] Found logo: {logo_file.relative_to(PROJECT_ROOT)}")
                return logo_file

    print(f"[SKIP] No logo image found in {ASSETS_DIR}")
    return None

def find_icon_files(android_dir: Path) -> List[Path]:
    icon_files = []

    if not android_dir.exists():
        print(f"[SKIP] Android directory not found at {android_dir}")
        return icon_files

    res_dir = android_dir / 'app' / 'src' / 'main' / 'res'
    if not res_dir.exists():
        print(f"[SKIP] Resources directory not found at {res_dir}")
        return icon_files

    for mipmap_dir in res_dir.glob('mipmap-*'):
        if not mipmap_dir.is_dir():
            continue

        for icon_file in mipmap_dir.glob('*.png'):
            if 'ic_launcher' in icon_file.name:
                icon_files.append(icon_file)

    return icon_files

def create_rounded_icon(image: Image.Image, size: int) -> Image.Image:
    mask = Image.new('L', (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size, size), fill=255)

    rounded = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    rounded.paste(image, (0, 0))
    rounded.putalpha(mask)

    return rounded

def resize_and_replace_icon(source_image: Image.Image, target_path: Path, size: int, is_round: bool = False):
    try:
        resized = source_image.resize((size, size), Image.Resampling.LANCZOS)

        if is_round:
            resized = create_rounded_icon(resized, size)

        target_path.parent.mkdir(parents=True, exist_ok=True)
        resized.save(target_path, 'PNG', optimize=True)

        return True
    except Exception as e:
        print(f"  [FAIL] Failed to replace {target_path.name}: {e}")
        return False

def get_icon_size_from_path(icon_path: Path) -> int:
    parent_name = icon_path.parent.name.lower()

    for density, size in MIPMAP_SIZES.items():
        if f'mipmap-{density}' in parent_name:
            return size

    return 96

def replace_icons(logo_path: Path, icon_files: List[Path], config: configparser.ConfigParser):
    if not logo_path or not logo_path.exists():
        print(f"[SKIP] Icon replacement: No logo file available")
        return

    try:
        logo_image = Image.open(logo_path).convert('RGBA')
    except Exception as e:
        print(f"[FAIL] Error loading logo image: {e}")
        return

    success_count = 0
    fail_count = 0

    for icon_file in icon_files:
        is_round = 'round' in icon_file.name
        size = get_icon_size_from_path(icon_file)

        if resize_and_replace_icon(logo_image, icon_file, size, is_round):
            success_count += 1
        else:
            fail_count += 1

    if success_count > 0:
        print(f"[OK] Icon replacement: {success_count} icons updated")
    if fail_count > 0:
        print(f"[WARN] Icon replacement: {fail_count} icons failed")

def process_app_info(config: configparser.ConfigParser):
    if not config.has_section('app_info'):
        return

    app_name = config.get('app_info', 'app_name', fallback=None)
    display_name_chinese = config.get('app_info', 'display_name_chinese', fallback=None)
    display_name_english = config.get('app_info', 'display_name_english', fallback=None)

    if app_name:
        print(f"[INFO] App Name: {app_name}")
    if display_name_chinese:
        print(f"[INFO] Display Name (Chinese): {display_name_chinese}")
    if display_name_english:
        print(f"[INFO] Display Name (English): {display_name_english}")

def process_package_settings(config: configparser.ConfigParser):
    if not config.has_section('package_settings'):
        return

    random_package_id = config.getboolean('package_settings', 'random_package_id', fallback=False)
    default_package_id = config.get('package_settings', 'default_package_id', fallback=None)

    if default_package_id:
        print(f"[INFO] Package ID: {default_package_id}")

def process_build_settings(config: configparser.ConfigParser):
    if not config.has_section('build_settings'):
        return

    build_platforms = config.get('build_settings', 'build_platforms', fallback='android')
    optimize_images = config.getboolean('build_settings', 'optimize_images', fallback=True)

    print(f"[INFO] Build Platforms: {build_platforms}")
    print(f"[INFO] Optimize Images: {optimize_images}")

def main():
    args = parse_arguments()
    initialize_paths(args.project_root)

    print("=" * 60)
    print("Android Prebuild Processor")
    print("=" * 60)
    print(f"Project Root: {PROJECT_ROOT}")
    print(f"Android Dir:  {ANDROID_DIR}")
    print(f"Assets Dir:   {ASSETS_DIR}")
    print("=" * 60)
    print()

    config = read_build_config()

    process_app_info(config)
    process_package_settings(config)
    process_build_settings(config)

    print()
    print("[STEP 1/2] Processing icons...")
    logo_path = find_logo_image()
    icon_files = find_icon_files(ANDROID_DIR)

    if icon_files:
        print(f"[INFO] Found {len(icon_files)} icon files to process")
        replace_icons(logo_path, icon_files, config)
    else:
        print("[SKIP] No icon files found")

    print()
    print("[STEP 2/2] Additional preprocessing...")
    print("[OK] Preprocessing completed")
    print()
    print("=" * 60)
    print("Android prebuild process finished successfully")
    print("=" * 60)

if __name__ == '__main__':
    main()
