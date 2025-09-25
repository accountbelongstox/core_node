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

from provider import build_provider
import os
from typing import Optional

def find_image_in_external_dirs(filename: str) -> Optional[str]:
    """
    Search for the given image filename in EXTERNAL_APP_ICONS_DIR, EXTERNAL_APP_IMAGES_DIR, and EXTERNAL_APP_LAUNCH_DIR.
    If not found, try the same base name with the other extension (jpg <-> png).
    The search order is: first the extension of the input filename, then the other.
    Returns the full path if found, else None.
    """
    dirs = [
        build_provider.EXTERNAL_APP_ICONS_DIR,
        build_provider.EXTERNAL_APP_IMAGES_DIR,
        build_provider.EXTERNAL_APP_LAUNCH_DIR
    ]
    base, ext = os.path.splitext(filename)
    ext = ext.lower()
    # Determine alternate extension
    if ext == '.png':
        alt_exts = ['.jpg', '.jpeg']
    elif ext in ['.jpg', '.jpeg']:
        alt_exts = ['.png']
    else:
        alt_exts = []
    # Search for the original filename
    for d in dirs:
        if not d or not os.path.isdir(d):
            continue
        candidate = os.path.join(d, filename)
        if os.path.isfile(candidate):
            return candidate
    # Search for alternate extensions
    for alt_ext in alt_exts:
        alt_name = base + alt_ext
        for d in dirs:
            if not d or not os.path.isdir(d):
                continue
            candidate = os.path.join(d, alt_name)
            if os.path.isfile(candidate):
                return candidate
    return None

def find_image_in_internal_dirs(filename: str) -> Optional[str]:
    """
    Search for the given image filename in BUILD_FLUTTER_ASSETS_ICONS_DIR, BUILD_FLUTTER_ASSETS_IMAGES_DIR, and BUILD_FLUTTER_ASSETS_LAUNCH_DIR.
    If not found, try the same base name with the other extension (jpg <-> png).
    The search order is: first the extension of the input filename, then the other.
    Returns the full path if found, else None.
    """
    dirs = [
        build_provider.BUILD_FLUTTER_ASSETS_ICONS_DIR,
        build_provider.BUILD_FLUTTER_ASSETS_IMAGES_DIR,
        build_provider.BUILD_FLUTTER_ASSETS_LAUNCH_DIR
    ]
    base, ext = os.path.splitext(filename)
    ext = ext.lower()
    # Determine alternate extension
    if ext == '.png':
        alt_exts = ['.jpg', '.jpeg']
    elif ext in ['.jpg', '.jpeg']:
        alt_exts = ['.png']
    else:
        alt_exts = []
    # Search for the original filename
    for d in dirs:
        if not d or not os.path.isdir(d):
            continue
        candidate = os.path.join(d, filename)
        if os.path.isfile(candidate):
            return candidate
    # Search for alternate extensions
    for alt_ext in alt_exts:
        alt_name = base + alt_ext
        for d in dirs:
            if not d or not os.path.isdir(d):
                continue
            candidate = os.path.join(d, alt_name)
            if os.path.isfile(candidate):
                return candidate
    return None
