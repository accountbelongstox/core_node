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
from tools.find_gradle_file_id import extract_application_id
from tools.create_app_name import generate_flutter_app_id
from tools.pyprint import Print
from tools.file_tool import scan_files_for_replacement, replace_in_files

def main(root_dir=None):
    """
    Replace the Android applicationId project-wide:
    - Extract the current applicationId from build.gradle
    - Generate a new applicationId using generate_flutter_app_id (use the last segment of the old ID as app_name)
    - Recursively replace all occurrences in all text files under root_dir, skipping .git, .dart_tool, .cache, __pycache__
    - Print progress and summary
    """
    old_id = extract_application_id()
    if not old_id:
        Print.error("Could not find applicationId in build.gradle.")
        return
    app_name = old_id.split('.')[-1]
    new_id = generate_flutter_app_id(app_name)
    if root_dir is None:
        root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    skip_dirs = {'.git', '.dart_tool', '.cache', '__pycache__'}
    file_list = scan_files_for_replacement(root_dir, keyword=None, skip_dirs=skip_dirs)
    replaced_files = replace_in_files(file_list, old_id, new_id)
    for filepath in replaced_files:
        Print.print_single_line_info(f"Replaced in: {filepath}")
    Print.info(f"\nReplacement complete. Old applicationId: {old_id}, New applicationId: {new_id}")
    Print.info(f"Total files replaced: {len(replaced_files)}")
    if replaced_files:
        Print.info("Files replaced:")
        Print.print_categorized_items(list(replaced_files), title="Replaced Files")

if __name__ == "__main__":
    main()
