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
from tools.find_macos_xcschemes import find_macos_xcscheme_and_pbxproj, extract_buildable_names_from_xcscheme
from tools.create_app_name import generate_macos_app_name
from tools.pyprint import Print
from tools.file_tool import scan_files_for_replacement, replace_in_files
from provider import build_provider

def replace_macos_xcschemes(root_dir=None):
    _, _ = find_macos_xcscheme_and_pbxproj()
    old_names = extract_buildable_names_from_xcscheme()
    if not old_names:
        Print.error("Could not find any BuildableName in Runner.xcscheme.")
        return
    if root_dir is None:
        root_dir = build_provider.BUILD_FLUTTER_ROOT
    total_replaced = 0
    replaced_files_set = set()
    name_map = {}
    for old_name in old_names:
        new_name = generate_macos_app_name()
        name_map[old_name] = new_name
        file_list = scan_files_for_replacement(root_dir, keyword=None)
        replaced_files = replace_in_files(file_list, old_name, new_name)
        for filepath in replaced_files:
            Print.print_single_line_info(f"Replaced in: {filepath}")
            replaced_files_set.add(filepath)
        total_replaced += len(replaced_files)
    Print.info(f"\nReplacement complete. BuildableName replacements:")
    for old_name, new_name in name_map.items():
        Print.info(f"  {old_name} -> {new_name}")
    Print.info(f"Total files replaced: {len(replaced_files_set)} (total replacements: {total_replaced})")
    if replaced_files_set:
        Print.info("Files replaced:")
        Print.print_categorized_items(list(replaced_files_set), title="Replaced Files")

if __name__ == "__main__":
    replace_macos_xcschemes()
