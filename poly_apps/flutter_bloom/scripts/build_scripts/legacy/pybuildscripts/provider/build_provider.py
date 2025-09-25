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

import os
import pathlib
from typing import List
import sys
from enum import Enum
from dataclasses import dataclass
from typing import Optional
import re

PROGRAMING_DIR = r'D:/programing/.build_dir'
EXTERNAL_RESOURCES_DIR = os.path.join(PROGRAMING_DIR, 'build_apps_static_resources')
AppNameKey = 'AppName'
def clean_str(s: Optional[str]) -> str:
    if s is None:
        return ""
    cleaned_string = re.sub(r"^[\s\ufeff]+|[\s\ufeff]+$", "", s)
    return cleaned_string

def set_static_resource_var(appname: Optional[str], key: str, val: str):
    global EXTERNAL_RESOURCES_DIR
    """
    Set a static resource variable for the given appname and key.
    If key is 'AppName', appname is ignored (global).
    """
    if key == AppNameKey:
        appname = ""
    clean_base_dir = clean_str(EXTERNAL_RESOURCES_DIR)
    clean_appname = clean_str(appname) if appname else ""
    clean_key = clean_str(key)
    if clean_appname == "":
        base_dir = clean_base_dir
    else:
        base_dir = os.path.join(clean_base_dir, clean_appname)
    cache_dir = os.path.join(base_dir, ".cache")
    gvar_dir = os.path.join(cache_dir, "gvar")
    os.makedirs(gvar_dir, exist_ok=True)
    file_path = os.path.join(gvar_dir, clean_key)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(val)

def get_static_resource_var(appname: Optional[str], key: str) -> Optional[str]:
    global EXTERNAL_RESOURCES_DIR
    """
    Get a static resource variable for the given appname and key.
    If key is 'AppName', appname is ignored (global).
    Returns the value as a string, or None if not found.
    """
    if key == AppNameKey:
        appname = ""
    clean_base_dir = clean_str(EXTERNAL_RESOURCES_DIR)
    clean_appname = clean_str(appname) if appname else ""
    clean_key = clean_str(key)
    if clean_appname == "":
        base_dir = clean_base_dir
    else:
        base_dir = os.path.join(clean_base_dir, clean_appname)
    cache_dir = os.path.join(base_dir, ".cache")
    gvar_dir = os.path.join(cache_dir, "gvar")
    file_path = os.path.join(gvar_dir, clean_key)
    if os.path.isfile(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            val = f.read()
            val = clean_str(val)
            return val
    return None



SCRIPT_DIR: str = os.path.dirname(os.path.abspath(__file__))
CURRENT_FILE_DIR: str = SCRIPT_DIR
PYBUILDSCRIPTS_DIR: str = str(pathlib.Path(SCRIPT_DIR).parent)
CURRENT_FILE_DIR_UP2: str = str(pathlib.Path(SCRIPT_DIR).parent.parent)

# --- Original Flutter Directory (Source) ---
ORIGINAL_FLUTTER_ROOT: str = str(pathlib.Path(SCRIPT_DIR).parent.parent.parent.parent)
ORIGINAL_FLUTTER_ROOT_NAME: str = os.path.basename(ORIGINAL_FLUTTER_ROOT)
ORIGINAL_FLUTTER_LIB_DIR: str = os.path.join(ORIGINAL_FLUTTER_ROOT, 'lib')
ORIGINAL_FLUTTER_ASSETS_DIR: str = os.path.join(ORIGINAL_FLUTTER_ROOT, 'assets')
ORIGINAL_FLUTTER_ANDROID_DIR: str = os.path.join(ORIGINAL_FLUTTER_ROOT, 'android')
ORIGINAL_FLUTTER_ANDROID_APP_DIR: str = os.path.join(ORIGINAL_FLUTTER_ANDROID_DIR, 'app')
ORIGINAL_FLUTTER_ANDROID_SRC_DIR: str = os.path.join(ORIGINAL_FLUTTER_ANDROID_APP_DIR, 'src')
ORIGINAL_FLUTTER_ANDROID_SRC_MAIN_DIR: str = os.path.join(ORIGINAL_FLUTTER_ANDROID_SRC_DIR, 'main')
ORIGINAL_FLUTTER_ANDROID_RES_DIR: str = os.path.join(ORIGINAL_FLUTTER_ANDROID_SRC_MAIN_DIR, 'res')

ORIGINAL_FLUTTER_APP_DIRS = [
    d for d in os.listdir(ORIGINAL_FLUTTER_LIB_DIR)
    if d.startswith("app_") and os.path.isdir(os.path.join(ORIGINAL_FLUTTER_LIB_DIR, d))
]
ORIGINAL_FLUTTER_APP_NAMES = [d.replace("app_", "") for d in ORIGINAL_FLUTTER_APP_DIRS]

def get_app_name() -> Optional[str]:
    if len(sys.argv) > 1:
        appname = sys.argv[1]
    else:
        appname = get_static_resource_var("", AppNameKey)
    if not appname:
        appname = ORIGINAL_FLUTTER_APP_NAMES[0]
    appname = clean_str(appname)
    return appname

APPNAME = get_app_name()
EXTERNAL_CACHE_DIR = os.path.join(EXTERNAL_RESOURCES_DIR, "." + APPNAME + "_cache")
EXTERNAL_APP_ICONS_DIR = os.path.join(EXTERNAL_RESOURCES_DIR, APPNAME + '_icons') if APPNAME else ""
EXTERNAL_APP_IMAGES_DIR = os.path.join(EXTERNAL_RESOURCES_DIR, APPNAME + '_images') if APPNAME else ""
EXTERNAL_APP_LAUNCH_DIR = os.path.join(EXTERNAL_RESOURCES_DIR, APPNAME + '_launch') if APPNAME else ""
ORIGINAL_FLUTTER_ASSETS_ICONS_DIR: str = os.path.join(ORIGINAL_FLUTTER_ASSETS_DIR, APPNAME + '_icons')
ORIGINAL_FLUTTER_ASSETS_IMAGES_DIR: str = os.path.join(ORIGINAL_FLUTTER_ASSETS_DIR, APPNAME + '_images')
ORIGINAL_FLUTTER_ASSETS_LAUNCH_DIR: str = os.path.join(ORIGINAL_FLUTTER_ASSETS_DIR, APPNAME + '_launch')

def set_app_name(appname: str):
    global APPNAME
    """
    Set the global AppName value.
    """
    APPNAME = appname
    set_static_resource_var("", AppNameKey, appname)

BUILD_FLUTTER_ROOT: str = os.path.join(PROGRAMING_DIR, ORIGINAL_FLUTTER_ROOT_NAME + '_' + APPNAME)
BUILD_FLUTTER_LIB_DIR: str = os.path.join(BUILD_FLUTTER_ROOT, 'lib')
BUILD_FLUTTER_ASSETS_DIR: str = os.path.join(BUILD_FLUTTER_ROOT, 'assets')
BUILD_FLUTTER_ASSETS_ICONS_DIR: str = os.path.join(BUILD_FLUTTER_ASSETS_DIR, APPNAME + '_icons')
BUILD_FLUTTER_ASSETS_IMAGES_DIR: str = os.path.join(BUILD_FLUTTER_ASSETS_DIR, APPNAME + '_images')
BUILD_FLUTTER_ASSETS_LAUNCH_DIR: str = os.path.join(BUILD_FLUTTER_ASSETS_DIR, APPNAME + '_launch')
BUILD_FLUTTER_ANDROID_DIR: str = os.path.join(BUILD_FLUTTER_ROOT, 'android')
BUILD_FLUTTER_ANDROID_APP_DIR: str = os.path.join(BUILD_FLUTTER_ANDROID_DIR, 'app')
BUILD_FLUTTER_ANDROID_SRC_DIR: str = os.path.join(BUILD_FLUTTER_ANDROID_APP_DIR, 'src')
BUILD_FLUTTER_ANDROID_SRC_MAIN_DIR: str = os.path.join(BUILD_FLUTTER_ANDROID_SRC_DIR, 'main')
BUILD_FLUTTER_ANDROID_RES_DIR: str = os.path.join(BUILD_FLUTTER_ANDROID_SRC_MAIN_DIR, 'res')
BUILD_FLUTTER_MACOS_DIR: str = os.path.join(BUILD_FLUTTER_ROOT, 'macos')
BUILD_FLUTTER_MACOS_SCHEME_DIR: str = os.path.join(BUILD_FLUTTER_MACOS_DIR, 'Runner.xcodeproj', 'xcshareddata', 'xcschemes')
BUILD_FLUTTER_MACOS_SCHEME_FILE: str = os.path.join(BUILD_FLUTTER_MACOS_SCHEME_DIR, 'Runner.xcscheme')
BUILD_FLUTTER_MACOS_PROJECT_PBXPROJ_FILE: str = os.path.join(BUILD_FLUTTER_MACOS_DIR, 'Runner.xcodeproj', 'project.pbxproj')

# --- Flutter Project Skip Patterns ---
FLUTTER_SKIP_PATTERNS: List[str] = [
    '.plugin_symlinks*',
    '.git*',           # Git repository
    '.dart_tool*',     # Dart tool cache
    '.cursor*',        # Cursor IDE files
    '.cache*',         # Cache files
    '.idea*',          # IDE files
    '.vscode*',        # VS Code files
    '.cxx*',           # C++ build files
    'build',          # Build output
    '*.iml',           # IntelliJ project files
    '*.log',           # Log files
    '*.tmp',           # Temporary files
    '*.bak',           # Backup files
    '*.swp',           # Vim swap files
    '*.swo',           # Vim swap files
    '*.DS_Store',      # macOS system files
    'Thumbs.db',       # Windows thumbnail files
]
ASSETS_BACKUP_NAME = "assets_backup"
# --- Cache and Flags ---
CACHE_BASE: str = os.path.join(os.getenv('APPDATA'), '.build_flutter_bloom')
GVAR_DIR: str = os.path.join(CACHE_BASE, 'global_vars')
if not os.path.exists(CACHE_BASE):
    os.makedirs(CACHE_BASE)
BG_CACHE_DIR: str = os.path.join(CACHE_BASE, 'py_packages')
FLAGS_DIR: str = os.path.join(BG_CACHE_DIR, 'flags')
ASSETS_BACKUP_DIR: str = os.path.join(BG_CACHE_DIR, ASSETS_BACKUP_NAME)

# --- Icon/Asset/Android Resource Constants (migrated from bp_icons.py) ---
ANDROID_RES_DIR = os.path.join(BUILD_FLUTTER_ANDROID_SRC_MAIN_DIR, 'res')
CACHE_DIR = os.path.join(BUILD_FLUTTER_ROOT, '.cache')
ASSETS_BACKUP_DIR = os.path.join(CACHE_DIR, ASSETS_BACKUP_NAME)

class DensityType(Enum):
    DRAWABLE = "drawable"
    MIPMAP = "mipmap"

@dataclass
class IconSpec:
    name: str
    densities: dict
    type: DensityType

DENSITY_SPECS = {
    'mdpi': (1.0, 'Medium'),
    'hdpi': (1.5, 'High'),
    'xhdpi': (2.0, 'Extra High'),
    'xxhdpi': (3.0, 'Extra Extra High'),
    'xxxhdpi': (4.0, 'Extra Extra Extra High')
}

ICON_SPECS = [
    IconSpec(
        name="ic_launcher.png",
        densities={
            'mdpi': (48, 48),
            'hdpi': (72, 72),
            'xhdpi': (96, 96),
            'xxhdpi': (144, 144),
            'xxxhdpi': (192, 192)
        },
        type=DensityType.MIPMAP
    ),
    IconSpec(
        name="notification_icon.png",
        densities={
            'mdpi': (24, 24),
            'hdpi': (36, 36),
            'xhdpi': (48, 48),
            'xxhdpi': (72, 72),
            'xxxhdpi': (96, 96)
        },
        type=DensityType.MIPMAP
    ),
    IconSpec(
        name="splash.png",
        densities={
            'mdpi': (320, 320),
            'hdpi': (480, 480),
            'xhdpi': (640, 640),
            'xxhdpi': (960, 960),
            'xxxhdpi': (1280, 1280)
        },
        type=DensityType.DRAWABLE
    ),
    IconSpec(
        name="background.png",
        densities={
            'mdpi': (720, 1280),
            'hdpi': (1080, 1920),
            'xhdpi': (1440, 2560),
            'xxhdpi': (2160, 3840),
            'xxxhdpi': (2880, 5120)
        },
        type=DensityType.DRAWABLE
    ),
    IconSpec(
        name="brand_logo.png",
        densities={
            'mdpi': (160, 80),
            'hdpi': (240, 120),
            'xhdpi': (320, 160),
            'xxhdpi': (480, 240),
            'xxxhdpi': (640, 320)
        },
        type=DensityType.DRAWABLE
    ),
    IconSpec(
        name="brand_logo_square.png",
        densities={
            'mdpi': (120, 120),
            'hdpi': (180, 180),
            'xhdpi': (240, 240),
            'xxhdpi': (360, 360),
            'xxxhdpi': (480, 480)
        },
        type=DensityType.DRAWABLE
    ),
    IconSpec(
        name="transa_launcher.png",
        densities={
            'mdpi': (48, 48),
            'hdpi': (72, 72),
            'xhdpi': (96, 96),
            'xxhdpi': (144, 144),
            'xxxhdpi': (192, 192)
        },
        type=DensityType.MIPMAP
    ),
]

# Special launch icon filenames for resource placement logic
LAUNCH_ICON_FILENAMES = [
    "background.png",
    "ic_launcher.png",
    "notification_icon.png",
    "transa_launcher.png"
]

SKIP_DIRS_FOR_REPLACE = {'.git', '.dart_tool', '.cache', '__pycache__'}
COPY_SKIP_DIRS = ['.dart_tool', 'build', '.git', '.idea', '.vscode']