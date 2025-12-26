#!/usr/bin/env python3
"""
Move pageview images from doc/pageviews to 3_page_designs_detailed
and update pageview_map.json files according to FLUTTER_GUIDE.md specification.
"""

import os
import json
import shutil
import re
from pathlib import Path

# Configuration
APP_NAME = "app_wuy"
SOURCE_DIR = Path(f"poly_apps/flutter_bloom/lib/apps/{APP_NAME}/doc/pageviews")
TARGET_BASE_DIR = Path(f"poly_apps/flutter_bloom/lib/apps/{APP_NAME}/design_docs_and_progress/3_page_designs_detailed")

# Files to exclude (not page images)
EXCLUDE_FILES = {
    "bg.png",
    "logo.png",
    "wuy_screenshots_composite.png",
    "create_composite_image.py",
    "login.html",
    "OCR_RECOGNITION_REPORT.md",
    "screenshots_catalog.md"
}

# Page name mappings (Chinese to English if needed)
PAGE_NAME_MAPPINGS = {
    "profile_page": {"cn": "个人资料页", "en": "profile_page"},
    "about_us_page": {"cn": "关于我们页", "en": "about_us_page"},
    "history_tracking_page": {"cn": "历史追踪页", "en": "history_tracking_page"},
    "map_page": {"cn": "地图页", "en": "map_page"},
    "friend_info_page": {"cn": "好友信息页", "en": "friend_info_page"},
    "friends_list_page": {"cn": "好友列表页", "en": "friends_list_page"},
    "my_profile_page": {"cn": "我的资料页", "en": "my_profile_page"},
    "find_friends_page": {"cn": "查找好友页", "en": "find_friends_page"},
    "registration_page": {"cn": "注册页", "en": "registration_page"},
    "add_friend_page": {"cn": "添加好友页", "en": "add_friend_page"},
    "login_page": {"cn": "登录页", "en": "login_page"},
    "network_records_page": {"cn": "网络记录页", "en": "network_records_page"},
    "chat_page": {"cn": "聊天页", "en": "chat_page"},
    "search_functionality": {"cn": "搜索功能", "en": "search_functionality"},
}


def extract_page_name(filename):
    """Extract page name from filename like '01_profile_page.png' -> 'profile_page'"""
    # Remove extension
    name_without_ext = os.path.splitext(filename)[0]
    # Remove leading numbers and underscore
    match = re.match(r'^\d+_(.+)', name_without_ext)
    if match:
        return match.group(1)
    return name_without_ext


def create_pageview_map_json(page_key, image_filename, page_name_cn, page_name_en):
    """Create pageview_map.json structure according to FLUTTER_GUIDE.md"""
    return {
        "image_file": image_filename,
        "page_key": page_key,
        "descriptions": {
            "purpose": f"{page_key} UI element mapping",
            "page_name_cn": page_name_cn,
            "page_name_en": page_name_en,
            "specifications": {
                "architecture": "Follow MVVM pattern: separate UI layer and Data layer",
                "naming_conventions": {
                    "widgets": "UpperCamelCase for widget classes",
                    "variables": "lowerCamelCase for variables and functions",
                    "files": "snake_case for files and folders",
                    "constants": "UPPER_SNAKE_CASE for constants"
                },
                "ui_guidelines": {
                    "responsive": "Ensure adaptive design for multiple screen sizes",
                    "accessibility": "Support screen readers and semantic labels",
                    "performance": "Use const constructors, avoid rebuilds"
                }
            },
            "version": "2025",
            "reference": "https://docs.flutter.dev/app-architecture"
        },
        "elements": [
            {
                "type": "text",
                "text": "Page elements will be added here",
                "bbox": [0, 0, 0, 0],
                "color": "#000000",
                "widget_mapping": "",
                "notes": "Add UI elements here based on image analysis"
            }
        ]
    }


def process_pageview_images():
    """Main function to process all pageview images"""
    if not SOURCE_DIR.exists():
        print(f"Error: Source directory not found: {SOURCE_DIR}")
        return
    
    if not TARGET_BASE_DIR.exists():
        print(f"Error: Target base directory not found: {TARGET_BASE_DIR}")
        return
    
    # Get all image files
    image_files = [f for f in os.listdir(SOURCE_DIR) 
                   if f.lower().endswith(('.png', '.jpg', '.jpeg')) 
                   and f not in EXCLUDE_FILES]
    
    if not image_files:
        print(f"No pageview images found in {SOURCE_DIR}")
        return
    
    print(f"Found {len(image_files)} pageview images to process")
    
    processed_pages = []
    
    for image_file in sorted(image_files):
        page_name = extract_page_name(image_file)
        
        # Get page name mapping
        if page_name in PAGE_NAME_MAPPINGS:
            page_name_cn = PAGE_NAME_MAPPINGS[page_name]["cn"]
            page_name_en = PAGE_NAME_MAPPINGS[page_name]["en"]
        else:
            # Default mapping
            page_name_cn = page_name.replace("_", " ").title()
            page_name_en = page_name
        
        # Create target directory structure
        target_page_dir = TARGET_BASE_DIR / page_name
        target_images_dir = target_page_dir / "images"
        
        # Create directories
        target_images_dir.mkdir(parents=True, exist_ok=True)
        
        # Copy image file
        source_path = SOURCE_DIR / image_file
        target_image_path = target_images_dir / image_file
        
        if target_image_path.exists():
            print(f"  Warning: {target_image_path} already exists, skipping copy")
        else:
            shutil.copy2(source_path, target_image_path)
            print(f"  Copied: {image_file} -> {target_image_path}")
        
        # Create or update pageview_map.json
        pageview_map_path = target_page_dir / "pageview_map.json"
        
        if pageview_map_path.exists():
            # Update existing file
            with open(pageview_map_path, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
            
            # Update image_file if different
            if existing_data.get("image_file") != image_file:
                existing_data["image_file"] = image_file
                existing_data["page_key"] = page_name
                if "descriptions" in existing_data:
                    existing_data["descriptions"]["page_name_cn"] = page_name_cn
                    existing_data["descriptions"]["page_name_en"] = page_name_en
                
                with open(pageview_map_path, 'w', encoding='utf-8') as f:
                    json.dump(existing_data, f, ensure_ascii=False, indent=2)
                print(f"  Updated: {pageview_map_path}")
        else:
            # Create new file
            pageview_map_data = create_pageview_map_json(
                page_name, image_file, page_name_cn, page_name_en
            )
            
            with open(pageview_map_path, 'w', encoding='utf-8') as f:
                json.dump(pageview_map_data, f, ensure_ascii=False, indent=2)
            print(f"  Created: {pageview_map_path}")
        
        # Create README.md if not exists
        readme_path = target_page_dir / "README.md"
        if not readme_path.exists():
            readme_content = f"""# {page_name_cn} ({page_name_en})

This directory contains detailed design specifications for the {page_name_en} page.

## Files

- `images/{image_file}` - Page design image
- `pageview_map.json` - UI element mapping and specifications
- `design_specs.md` - Detailed design specifications (optional)

## Usage

Refer to `pageview_map.json` for UI element mappings and implementation guidelines.
"""
            with open(readme_path, 'w', encoding='utf-8') as f:
                f.write(readme_content)
            print(f"  Created: {readme_path}")
        
        processed_pages.append(page_name)
    
    print(f"\nProcessed {len(processed_pages)} pages:")
    for page in processed_pages:
        print(f"  - {page}")
    
    print(f"\nAll pageview images have been moved to {TARGET_BASE_DIR}")


if __name__ == "__main__":
    # Change to project root
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    os.chdir(project_root)
    
    print(f"Working directory: {os.getcwd()}")
    print(f"Source: {SOURCE_DIR}")
    print(f"Target: {TARGET_BASE_DIR}\n")
    
    process_pageview_images()

