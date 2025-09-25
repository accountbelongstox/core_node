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

#!/usr/bin/env python3
from pathlib import Path
from provider import build_provider
from tools.pyprint import Print
import re
import os
import sys
import threading
import time
from tools.find_res_by_build_dir import find_image_in_external_dirs, find_image_in_internal_dirs
from tools.images_tool import is_image_fully_transparent, get_image_size
from tools.ignore_res_image import should_ignore_image
from tools.ppath_tool import get_path_relative_by_buildroot,normalize_path,get_path_relative_by_external_dir

LAUNCH_ICON_FILENAMES = getattr(build_provider, 'LAUNCH_ICON_FILENAMES', [
    "background.png", "ic_launcher.png", "notification_icon.png", "transa_launcher.png"
])

def find_replacement_source_for_all(images=None):
    """
    For each image object in images, find and attach the replacement source info.
    If images is None, scan_and_print_all_images will be called to generate it.
    Returns a tuple: (list of image objects with replacement info, list of not found filenames).
    If any files are not found, print a yellow warning listing all such filenames, and for each, suggest a recommended external and internal directory path for where to create the file.
    """
    if images is None:
        images = scan_and_print_all_images(return_only=True)
    external_dirs = [
        build_provider.EXTERNAL_APP_ICONS_DIR,
        build_provider.EXTERNAL_APP_IMAGES_DIR,
        build_provider.EXTERNAL_APP_LAUNCH_DIR
    ]
    internal_dirs = [
        build_provider.BUILD_FLUTTER_ASSETS_ICONS_DIR,
        build_provider.BUILD_FLUTTER_ASSETS_IMAGES_DIR,
        build_provider.BUILD_FLUTTER_ASSETS_LAUNCH_DIR
    ]
    # Only warn once for missing external dirs
    missing_external_dirs = [d for d in external_dirs if d and not os.path.isdir(d)]
    if missing_external_dirs:
        Print.warn(
            f"External resource directories are not found and will be skipped: {', '.join(missing_external_dirs)}\n"
            f"[External] resource directories are used for static resources that should not be visible to others or uploaded to github. "
            f"At least the following directories are needed: ..._icons, ..._images, ..._launch.\n"
            f"Press Y to automatically create these directories, or wait 5 seconds to skip."
        )
        user_input = {'value': None}
        def get_input():
            try:
                user_input['value'] = input("Create missing external directories? (Y/n): ").strip().lower()
            except Exception:
                user_input['value'] = None
        t = threading.Thread(target=get_input)
        t.daemon = True
        t.start()
        t.join(timeout=5)
        if user_input['value'] == 'y':
            for d in missing_external_dirs:
                try:
                    os.makedirs(d, exist_ok=True)
                    Print.success(f"Created external resource directory: {d}")
                except Exception as e:
                    Print.error(f"Failed to create directory {d}: {e}")
        else:
            Print.info("Skipped creating external resource directories.")
    not_found_filenames = []
    not_found_basenames = set()
    for img_obj in images:
        filename = img_obj['original_filename']
        ext = os.path.splitext(filename)[1].lower()
        basename = os.path.splitext(filename)[0]
        found_path = find_image_in_external_dirs(filename)
        if found_path:
            found_path = normalize_path(found_path)
            source_relative_path = get_path_relative_by_external_dir(found_path)
            img_obj.update({'source_path': found_path, 'source_relative_path': source_relative_path, 'source_type': 'external', 'completeness': 100})
            continue
        found_path = find_image_in_internal_dirs(filename)
        if found_path:
            found_path = normalize_path(found_path)
            source_relative_path = get_path_relative_by_buildroot(found_path)
            img_obj.update({'source_path': found_path, 'source_relative_path': source_relative_path, 'source_type': 'internal', 'completeness': 50})
            continue
        img_obj.update({
            'source_path': 'NOT_FOUND',
            'source_type': 'none',
            'completeness': 0,
            'source_search_info': {
                'external_dirs': [d for d in external_dirs if d],
                'internal_dirs': [d for d in internal_dirs if d],
                'message': f"No replacement found for {filename} after searching all external and internal asset directories."
            }
        })
        not_found_filenames.append(filename)
        not_found_basenames.add(basename)
    if not_found_basenames:
        msg_lines = [
            f"The following image files were NOT found in any external or internal asset directories:",
            "",
        ]
        shown_basenames = set()
        for fn in not_found_filenames:
            basename = os.path.splitext(fn)[0]
            if basename in shown_basenames:
                continue
            shown_basenames.add(basename)
            ext = os.path.splitext(fn)[1].lower()
            if fn in LAUNCH_ICON_FILENAMES:
                ext_dir = build_provider.EXTERNAL_APP_LAUNCH_DIR or '[external_launch_dir]'
                int_dir = build_provider.BUILD_FLUTTER_ASSETS_LAUNCH_DIR or '[internal_launch_dir]'
            elif ext in ['.png', '.svg']:
                ext_dir = build_provider.EXTERNAL_APP_ICONS_DIR or '[external_icons_dir]'
                int_dir = build_provider.BUILD_FLUTTER_ASSETS_ICONS_DIR or '[internal_icons_dir]'
            elif ext in ['.jpg', '.jpeg', '.webp', '.gif', '.bmp']:
                ext_dir = build_provider.EXTERNAL_APP_IMAGES_DIR or '[external_images_dir]'
                int_dir = build_provider.BUILD_FLUTTER_ASSETS_IMAGES_DIR or '[internal_images_dir]'
            else:
                ext_dir = build_provider.EXTERNAL_APP_IMAGES_DIR or '[external_images_dir]'
                int_dir = build_provider.BUILD_FLUTTER_ASSETS_IMAGES_DIR or '[internal_images_dir]'
            msg_lines.append(f"  - {fn}")
            msg_lines.append(f"    Recommended: create in external directory: {os.path.join(ext_dir, fn)}")
            msg_lines.append(f"    Or create in internal directory: {os.path.join(int_dir, fn)}")
            # Add xxhdpi size recommendation if available
            xxhdpi_size = None
            for spec in getattr(build_provider, 'ICON_SPECS', []):
                if spec.name == fn:
                    xxhdpi_size = spec.densities.get('xxhdpi')
                    break
            if xxhdpi_size:
                msg_lines.append(f"    Recommended size for xxhdpi: {xxhdpi_size[0]}x{xxhdpi_size[1]}")
        Print.warn("\n".join(msg_lines))
    return images, not_found_filenames

def scan_and_print_all_images(return_only=False):
    """
    Recursively scan BUILD_FLUTTER_ANDROID_RES_DIR for all image files, extract filename, type, density, and return as objects.
    relative_path is always computed relative to BUILD_FLUTTER_ROOT.
    """
    res_dir = Path(build_provider.BUILD_FLUTTER_ANDROID_RES_DIR)
    build_flutter_root = Path(build_provider.BUILD_FLUTTER_ROOT)
    image_exts = {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'}
    pattern = re.compile(r'^(mipmap|drawable)(?:-([a-zA-Z0-9]+))?$')
    results = []
    for file in res_dir.rglob('*'):
        if file.is_file() and file.suffix.lower() in image_exts:
            type_ = 'general'
            density = 'general'
            for part in file.parts:
                match = pattern.fullmatch(part)
                if match:
                    type_ = match.group(1)
                    density = match.group(2) if match.group(2) else 'general'
                    break
            try:
                rel_path = str(Path(file).relative_to(build_flutter_root))
            except ValueError:
                rel_path = str(file)
            fully_transparent = False
            ignore = False
            try:
                fully_transparent = is_image_fully_transparent(str(file))
                if fully_transparent:
                    ignore = True
                else:
                    ignore = should_ignore_image(str(file))
            except Exception:
                fully_transparent = False
                ignore = False
            width = None
            height = None
            try:
                width, height = get_image_size(str(file))
            except Exception:
                width, height = None, None
            obj = {
                'original_filename': file.name,
                'original_type': type_,
                'original_density': density,
                'original_path': normalize_path(str(file)),
                'original_relative_path': get_path_relative_by_buildroot(str(file)),
                'original_fully_transparent': fully_transparent,
                'original_ignore': ignore,
                'original_width': width,
                'original_height': height
            }
            results.append(obj)
    if not return_only:
        Print.info(f"\nSummary of all found images:")
        Print.pretty_print(results)
    return results
