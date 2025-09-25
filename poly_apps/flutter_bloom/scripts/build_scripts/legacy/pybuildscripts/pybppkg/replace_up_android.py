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
import sys
from pathlib import Path
from PIL import Image
from provider import build_provider
from provider.build_provider import APPNAME, ORIGINAL_FLUTTER_ROOT, BUILD_FLUTTER_ROOT, EXTERNAL_CACHE_DIR
from pybppkg.bp_fileops import BPFileOperations
from tools.pyprint import Print
from gvar.gvar import GVar
import inspect
from pybppkg.check_android_dir import check_original_flutter_dirs, check_build_flutter_dirs
from pybppkg.pubspec_replace import PubspecReplace
from pybppkg.replace_res_android import find_replacement_source_for_all
from tools.create_app_name import generate_flutter_app_id
from tools.images_tool import resize_image_to_min_size, get_image_size, resize_image_to_max_size, crop_image_center_to_size
from tools.ppath_tool import get_path_relative_by_buildroot, clear_directory
from tools.str_tool import get_md5
import os

def upgrade_and_replace_resources():
    """
    Find and upgrade resources by processing the 'source' field of each image item.
    Returns the updated images list.
    """
    images, not_found_filenames = find_replacement_source_for_all()

    if not_found_filenames:
        Print.warn("Some resources were not found:")
        Print.pretty_print(not_found_filenames)
    clear_directory(EXTERNAL_CACHE_DIR)
    for img in images:
        # Only process if source_path exists
        if img.get('source_path'):
            min_width = img.get('original_width')
            min_height = img.get('original_height')
            source_path = img.get('source_path')
            out_source_path = os.path.join(EXTERNAL_CACHE_DIR, get_md5(img.get('source_relative_path'),img.get('original_filename')))
            if min_width and min_height and source_path:
                try:
                    src_w, src_h = get_image_size(source_path)
                    # Decision logic
                    if src_w > min_width and src_h > min_height:
                        Print.info(f"Image '{source_path}' is larger than min size, will shrink proportionally to fit within {min_width}x{min_height}.")
                        resize_image_to_max_size(source_path, min_width, min_height, out_source_path)
                    elif src_w < min_width or src_h < min_height:
                        Print.info(f"Image '{source_path}' is smaller than min size, will enlarge proportionally to at least {min_width}x{min_height}.")
                        resize_image_to_min_size(source_path, min_width, min_height, out_source_path)
                    else:
                        Print.info(f"Image '{source_path}' already fits the required size, copying without resizing.")
                        resize_image_to_min_size(source_path, min_width, min_height, out_source_path)
                    img['out_source_path'] = out_source_path
                    Print.success(f"Processed '{source_path}' to '{out_source_path}' for required size {min_width}x{min_height}.")
                except Exception as e:
                    Print.error(f"Failed to process {source_path}: {e}")
        Print.info(f"Processing resource: {img.get('original_filename')} | Source: {img.get('source')}")
    return images,not_found_filenames

def crop_all_images_to_original_size(images=None, not_found_filenames=None):
    """
    For each image in images, crop the center of out_source_path to original_width x original_height,
    and save to original_path. If images is None, call upgrade_and_replace_resources to get them.
    If original_ignore is True, skip and print a yellow warning with the file path.
    """
    if images is None or not_found_filenames is None:
        images, not_found_filenames = upgrade_and_replace_resources()
    for img in images:
        if img.get('original_ignore'):
            Print.warn(f"Ignored image (original_ignore=True): {img.get('original_path')}")
            continue
        out_source_path = img.get('out_source_path')
        orig_w = img.get('original_width')
        orig_h = img.get('original_height')
        orig_path = img.get('original_path')
        if out_source_path and orig_w and orig_h and orig_path:
            try:
                crop_image_center_to_size(out_source_path, orig_w, orig_h, orig_path)
            except Exception as e:
                Print.error(f"Failed to crop {out_source_path} to {orig_w}x{orig_h} at {orig_path}: {e}")
    return images, not_found_filenames
