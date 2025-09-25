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
import shutil

def normalize_path(path: str) -> str:
    normalized_path = os.path.normpath(path)
    linux_path = normalized_path.replace('\\', '/')
    return linux_path

def get_path_relative_by_buildroot(full_path: str) -> str:

    normalized_full_path = normalize_path(full_path)
    normalized_root = normalize_path(build_provider.BUILD_FLUTTER_ROOT)

    # Ensure the root path ends with a slash for consistent comparison
    if not normalized_root.endswith('/'):
        normalized_root += '/'

    if normalized_full_path.startswith(normalized_root):
        relative_path = normalized_full_path[len(normalized_root):]
        return relative_path
    else:
        return normalized_full_path
    
def get_path_relative_by_external_dir(full_path: str) -> str:

    normalized_full_path = normalize_path(full_path)
    normalized_root = normalize_path(build_provider.PROGRAMING_DIR)

    # Ensure the root path ends with a slash for consistent comparison
    if not normalized_root.endswith('/'):
        normalized_root += '/'

    if normalized_full_path.startswith(normalized_root):
        relative_path = normalized_full_path[len(normalized_root):]
        return relative_path
    else:
        return normalized_full_path

def is_relative_path(path: str) -> bool:
    return not os.path.isabs(path)

def is_absolute_path(path: str) -> bool:
    return os.path.isabs(path)

def clear_directory(path: str):
    """
    Recursively clear all contents of the directory at 'path'.
    If the directory does not exist, do nothing. No error if already empty or files are missing.
    """
    if os.path.isdir(path):
        for filename in os.listdir(path):
            file_path = os.path.join(path, filename)
            try:
                if os.path.isfile(file_path) or os.path.islink(file_path):
                    os.unlink(file_path)
                elif os.path.isdir(file_path):
                    shutil.rmtree(file_path, ignore_errors=True)
            except Exception:
                pass    