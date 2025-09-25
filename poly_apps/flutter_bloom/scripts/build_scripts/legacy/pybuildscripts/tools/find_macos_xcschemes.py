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

import random
import string
from provider import build_provider
import os
import xml.etree.ElementTree as ET

runner_xcscheme_path_cache = None
project_pbxproj_path_cache = None
buildable_names_cache = None

def find_macos_xcscheme_and_pbxproj():
    """
    Recursively search for Runner.xcscheme and project.pbxproj under BUILD_FLUTTER_MACOS_SCHEME_DIR.
    Cache and return their paths as a tuple (runner_xcscheme_path, project_pbxproj_path).
    """
    global runner_xcscheme_path_cache, project_pbxproj_path_cache
    if runner_xcscheme_path_cache and project_pbxproj_path_cache:
        return runner_xcscheme_path_cache, project_pbxproj_path_cache
    base_dir = getattr(build_provider, 'BUILD_FLUTTER_MACOS_SCHEME_DIR', None)
    if not base_dir or not os.path.isdir(base_dir):
        return None, None
    for dirpath, _, filenames in os.walk(base_dir):
        for filename in filenames:
            if filename == 'Runner.xcscheme' and not runner_xcscheme_path_cache:
                runner_xcscheme_path_cache = os.path.join(dirpath, filename)
            if filename == 'project.pbxproj' and not project_pbxproj_path_cache:
                project_pbxproj_path_cache = os.path.join(dirpath, filename)
        if runner_xcscheme_path_cache and project_pbxproj_path_cache:
            break
    return runner_xcscheme_path_cache, project_pbxproj_path_cache

def extract_buildable_names_from_xcscheme():
    """
    Read the Runner.xcscheme XML and extract all BuildableName values, cache and return as a list.
    """
    global buildable_names_cache
    if buildable_names_cache is not None:
        return buildable_names_cache
    runner_xcscheme_path, _ = find_macos_xcscheme_and_pbxproj()
    if not runner_xcscheme_path or not os.path.isfile(runner_xcscheme_path):
        return []
    buildable_names = []
    try:
        tree = ET.parse(runner_xcscheme_path)
        root = tree.getroot()
        for elem in root.iter('BuildableReference'):
            name = elem.attrib.get('BuildableName')
            if name:
                buildable_names.append(name)
        buildable_names_cache = buildable_names
        return buildable_names
    except Exception as e:
        # Optionally log or print error
        return []


