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

import sys
import os
from provider import build_provider
from tools.pyprint import Print

def check_original_flutter_dirs():
    """
    Check if all ORIGINAL_FLUTTER_ROOT related directories exist.
    If any directory does not exist, print an error in red and exit the program.
    """
    original_dirs = [
        build_provider.ORIGINAL_FLUTTER_ROOT,
        build_provider.ORIGINAL_FLUTTER_LIB_DIR,
        build_provider.ORIGINAL_FLUTTER_ASSETS_DIR,
        build_provider.ORIGINAL_FLUTTER_ASSETS_ICONS_DIR,
        build_provider.ORIGINAL_FLUTTER_ASSETS_IMAGES_DIR,
        build_provider.ORIGINAL_FLUTTER_ASSETS_LAUNCH_DIR,
        build_provider.ORIGINAL_FLUTTER_ANDROID_DIR,
        build_provider.ORIGINAL_FLUTTER_ANDROID_APP_DIR,
        build_provider.ORIGINAL_FLUTTER_ANDROID_SRC_DIR,
        build_provider.ORIGINAL_FLUTTER_ANDROID_SRC_MAIN_DIR,
        build_provider.ORIGINAL_FLUTTER_ANDROID_RES_DIR,
    ]
    for d in original_dirs:
        if not os.path.exists(d):
            Print.error(f"[ORIGINAL_FLUTTER] Directory does not exist: {d}")
            sys.exit(1)
    Print.success("All ORIGINAL_FLUTTER_ROOT related directories exist!")

def check_build_flutter_dirs():
    """
    Check if all BUILD_FLUTTER related directories exist.
    If any directory does not exist, print an error in red and exit the program.
    """
    build_dirs = [
        build_provider.BUILD_FLUTTER_ROOT,
        build_provider.BUILD_FLUTTER_LIB_DIR,
        build_provider.BUILD_FLUTTER_ASSETS_DIR,
        build_provider.BUILD_FLUTTER_ASSETS_ICONS_DIR,
        build_provider.BUILD_FLUTTER_ASSETS_IMAGES_DIR,
        build_provider.BUILD_FLUTTER_ASSETS_LAUNCH_DIR,
        build_provider.BUILD_FLUTTER_ANDROID_DIR,
        build_provider.BUILD_FLUTTER_ANDROID_APP_DIR,
        build_provider.BUILD_FLUTTER_ANDROID_SRC_DIR,
        build_provider.BUILD_FLUTTER_ANDROID_SRC_MAIN_DIR,
        build_provider.BUILD_FLUTTER_ANDROID_RES_DIR,
    ]
    for d in build_dirs:
        if not os.path.exists(d):
            Print.error(f"[BUILD_FLUTTER] Directory does not exist: {d}")
            sys.exit(1)
    Print.success("All BUILD_FLUTTER related directories exist!")
