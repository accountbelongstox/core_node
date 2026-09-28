"""
Migration script for old_travel Vue app to Flutter framework
This script creates the Flutter app structure and migrates resources
"""

import os
import shutil
import json
from pathlib import Path
from typing import List, Dict

# Base paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
OLD_TRAVEL_DIR = PROJECT_ROOT / "old_travel"
LIB_DIR = PROJECT_ROOT / "lib"
ASSETS_DIR = PROJECT_ROOT / "lib" / "assets"

# App configuration
APP_NAME = "travel"
APP_PREFIX = f"app_{APP_NAME}"

# Directory structure definitions
APP_DIRECTORIES = [
    f"apps/{APP_PREFIX}",
    f"apps/{APP_PREFIX}/config_{APP_PREFIX}",
    f"apps/{APP_PREFIX}/resources_{APP_PREFIX}",
    f"apps/{APP_PREFIX}/models_{APP_PREFIX}",
    f"apps/{APP_PREFIX}/features_{APP_PREFIX}",
    f"apps/{APP_PREFIX}/features_{APP_PREFIX}/home",
    f"apps/{APP_PREFIX}/features_{APP_PREFIX}/home/views",
    f"apps/{APP_PREFIX}/features_{APP_PREFIX}/home/widgets",
    f"apps/{APP_PREFIX}/features_{APP_PREFIX}/home/controllers",
    f"apps/{APP_PREFIX}/features_{APP_PREFIX}/city",
    f"apps/{APP_PREFIX}/features_{APP_PREFIX}/city/views",
    f"apps/{APP_PREFIX}/features_{APP_PREFIX}/city/widgets",
    f"apps/{APP_PREFIX}/features_{APP_PREFIX}/city/controllers",
    f"apps/{APP_PREFIX}/features_{APP_PREFIX}/sight",
    f"apps/{APP_PREFIX}/features_{APP_PREFIX}/sight/views",
    f"apps/{APP_PREFIX}/features_{APP_PREFIX}/sight/widgets",
    f"apps/{APP_PREFIX}/features_{APP_PREFIX}/sight/controllers",
    f"apps/{APP_PREFIX}/services_{APP_PREFIX}",
    f"apps/{APP_PREFIX}/repositories_{APP_PREFIX}",
    f"apps/{APP_PREFIX}/utils_{APP_PREFIX}",
    f"apps/{APP_PREFIX}/localization_{APP_PREFIX}",
    f"apps/{APP_PREFIX}/router_{APP_PREFIX}",
    f"apps/{APP_PREFIX}/provider_{APP_PREFIX}",
]

ASSET_DIRECTORIES = [
    f"apps/{APP_PREFIX}",
    f"apps/{APP_PREFIX}/icons",
    f"apps/{APP_PREFIX}/images",
    f"apps/{APP_PREFIX}/images/nav",
    f"apps/{APP_PREFIX}/images/upload",
    f"apps/{APP_PREFIX}/fonts",
    f"apps/{APP_PREFIX}/data",
]


def create_directory_structure():
    """Create Flutter app directory structure"""
    print("\n=== Creating Directory Structure ===")

    # Create lib/apps directories
    for dir_path in APP_DIRECTORIES:
        full_path = LIB_DIR / dir_path
        full_path.mkdir(parents=True, exist_ok=True)
        print(f"Created: {full_path}")

    # Create asset directories
    for dir_path in ASSET_DIRECTORIES:
        full_path = ASSETS_DIR / dir_path
        full_path.mkdir(parents=True, exist_ok=True)
        print(f"Created: {full_path}")

    print("Directory structure created successfully!")


def migrate_resources():
    """Migrate resources from old_travel to Flutter structure"""
    print("\n=== Migrating Resources ===")

    if not OLD_TRAVEL_DIR.exists():
        print(f"Error: Old travel directory not found at {OLD_TRAVEL_DIR}")
        return

    # Migrate images from public/upload
    upload_src = OLD_TRAVEL_DIR / "public" / "upload"
    upload_dst = ASSETS_DIR / f"apps/{APP_PREFIX}/images/upload"

    if upload_src.exists():
        print(f"\nMigrating upload images from {upload_src}")
        copied_count = 0
        for img_file in upload_src.glob("*"):
            if img_file.is_file():
                dst_file = upload_dst / img_file.name
                shutil.copy2(img_file, dst_file)
                copied_count += 1
        print(f"Copied {copied_count} upload images")

    # Migrate navigation images
    nav_src = OLD_TRAVEL_DIR / "src" / "assets" / "images"
    nav_dst = ASSETS_DIR / f"apps/{APP_PREFIX}/images/nav"

    if nav_src.exists():
        print(f"\nMigrating navigation images from {nav_src}")
        copied_count = 0
        for img_file in nav_src.glob("*.png"):
            if img_file.is_file():
                dst_file = nav_dst / img_file.name
                shutil.copy2(img_file, dst_file)
                copied_count += 1
        print(f"Copied {copied_count} navigation images")

    # Migrate data files
    data_src = OLD_TRAVEL_DIR / "public" / "data"
    data_dst = ASSETS_DIR / f"apps/{APP_PREFIX}/data"

    if data_src.exists():
        print(f"\nMigrating data files from {data_src}")
        copied_count = 0
        for data_file in data_src.glob("*.json"):
            if data_file.is_file():
                dst_file = data_dst / data_file.name
                shutil.copy2(data_file, dst_file)
                copied_count += 1
        print(f"Copied {copied_count} data files")

    # Migrate fonts
    fonts_src = OLD_TRAVEL_DIR / "src" / "assets" / "fonts"
    fonts_dst = ASSETS_DIR / f"apps/{APP_PREFIX}/fonts"

    if fonts_src.exists():
        print(f"\nMigrating fonts from {fonts_src}")
        copied_count = 0
        for font_file in fonts_src.glob("iconfont.*"):
            if font_file.is_file():
                dst_file = fonts_dst / font_file.name
                shutil.copy2(font_file, dst_file)
                copied_count += 1
        print(f"Copied {copied_count} font files")

    print("\nResource migration completed!")


def analyze_old_project():
    """Analyze old Vue project structure and generate report"""
    print("\n=== Analyzing Old Project ===")

    report = {
        "app_name": "Travel App",
        "original_framework": "Vue.js + Vite",
        "pages": [],
        "components": {},
        "data_files": [],
        "assets": {
            "images": 0,
            "fonts": 0
        }
    }

    # Analyze pages
    pages_dir = OLD_TRAVEL_DIR / "src" / "pages"
    if pages_dir.exists():
        for page_dir in pages_dir.iterdir():
            if page_dir.is_dir():
                components = []
                components_dir = page_dir / "components"
                if components_dir.exists():
                    components = [c.stem for c in components_dir.glob("*.vue")]

                report["pages"].append({
                    "name": page_dir.name,
                    "components": components
                })
                report["components"][page_dir.name] = components

    # Count data files
    data_dir = OLD_TRAVEL_DIR / "public" / "data"
    if data_dir.exists():
        report["data_files"] = [f.name for f in data_dir.glob("*.json")]

    # Count assets
    upload_dir = OLD_TRAVEL_DIR / "public" / "upload"
    if upload_dir.exists():
        report["assets"]["images"] = len(list(upload_dir.glob("*")))

    fonts_dir = OLD_TRAVEL_DIR / "src" / "assets" / "fonts"
    if fonts_dir.exists():
        report["assets"]["fonts"] = len(list(fonts_dir.glob("iconfont.*")))

    # Save report
    report_file = LIB_DIR / f"apps/{APP_PREFIX}/migration_analysis.json"
    report_file.parent.mkdir(parents=True, exist_ok=True)
    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"Analysis report saved to: {report_file}")
    print(f"\nProject Summary:")
    print(f"  - Pages: {len(report['pages'])}")
    print(f"  - Data files: {len(report['data_files'])}")
    print(f"  - Images: {report['assets']['images']}")
    print(f"  - Font files: {report['assets']['fonts']}")

    return report


def main():
    """Main execution function"""
    print("=" * 60)
    print("Travel App Migration Script")
    print("Vue.js -> Flutter Framework")
    print("=" * 60)

    try:
        # Step 1: Analyze old project
        analysis = analyze_old_project()

        # Step 2: Create directory structure
        create_directory_structure()

        # Step 3: Migrate resources
        migrate_resources()

        print("\n" + "=" * 60)
        print("Migration script completed successfully!")
        print("=" * 60)
        print("\nNext steps:")
        print("1. Review migration_analysis.json in app_travel root")
        print("2. Check migrated resources in lib/assets/apps/app_travel/")
        print("3. Implement Flutter features based on migration plan")
        print("4. Update pubspec.yaml with asset paths")

    except Exception as e:
        print(f"\nError during migration: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
