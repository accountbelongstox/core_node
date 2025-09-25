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
from provider import build_provider

gradle_path_cache = None

def find_build_gradle():
    """
    Recursively search for build.gradle in BUILD_FLUTTER_ANDROID_APP_DIR, then in BUILD_FLUTTER_ROOT if not found.
    Cache and return the found path.
    """
    global gradle_path_cache
    if gradle_path_cache:
        return gradle_path_cache
    search_dirs = [
        getattr(build_provider, 'BUILD_FLUTTER_ANDROID_APP_DIR', None),
        getattr(build_provider, 'BUILD_FLUTTER_ROOT', None)
    ]
    for base_dir in search_dirs:
        if not base_dir or not os.path.isdir(base_dir):
            continue
        for dirpath, _, filenames in os.walk(base_dir):
            for filename in filenames:
                if filename == 'build.gradle':
                    gradle_path_cache = os.path.join(dirpath, filename)
                    return gradle_path_cache
    return None

def extract_application_id():
    """
    Find build.gradle and extract the applicationId value (e.g., applicationId "com.example.app").
    Returns the applicationId string or None if not found.
    """
    gradle_path = find_build_gradle()
    if not gradle_path or not os.path.isfile(gradle_path):
        return None
    with open(gradle_path, 'r', encoding='utf-8') as f:
        for line in f:
            line_trim = line.strip()
            if line_trim.startswith('applicationId'):
                # Remove 'applicationId' and trim
                value = line_trim[len('applicationId'):].strip()
                # Remove any '=' if present (for compatibility)
                if value.startswith('='):
                    value = value[1:].strip()
                # Remove surrounding quotes (single or double)
                if value.startswith('"') and value.endswith('"'):
                    value = value[1:-1]
                elif value.startswith("'") and value.endswith("'"):
                    value = value[1:-1]
                return value
    return None