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
import shutil
from tools.pyprint import Print
from provider import build_provider

def scan_files_for_replacement(root_dir, keyword=None):

    skip_dirs = build_provider.SKIP_DIRS_FOR_REPLACE
    result = []
    for dirpath, dirnames, filenames in os.walk(root_dir):
        # Remove skip_dirs from dirnames in-place to skip them
        dirnames[:] = [d for d in dirnames if d not in skip_dirs]
        for filename in filenames:
            filepath = os.path.join(dirpath, filename)
            if keyword and keyword not in filepath:
                continue
            result.append(filepath)
    return result

def replace_in_files(file_list, old, new):

    changed = []
    for path in file_list:
        try:
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            if old not in content:
                continue
            content = content.replace(old, new)
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)
            changed.append(path)
        except Exception:
            continue
    return changed

def read_file_utf8(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def write_file_utf8(path, content):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

# Built-in directories to skip during deletion

def clear_directory_recursive(path, is_skip_dir=True):

    if not os.path.isdir(path):
        return
    for filename in os.listdir(path):
        file_path = os.path.join(path, filename)
        try:
            if os.path.isfile(file_path) or os.path.islink(file_path):
                os.unlink(file_path)
            elif os.path.isdir(file_path):
                if is_skip_dir and filename in build_provider.COPY_SKIP_DIRS:
                    Print.warn(f"Skipping directory: {file_path}")
                    continue
                shutil.rmtree(file_path, ignore_errors=False)
        except Exception as e:
            Print.warn(f"Warning: Could not delete {file_path}: {e}")
