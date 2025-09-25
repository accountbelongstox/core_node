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
from tools.parse_pubspec import PubspecParser
from tools.pyprint import Print
from tools.create_app_name import generate_flutter_app_name
from tools.file_tool import scan_files_for_replacement, replace_in_files

class PubspecReplace:
    def __init__(self):
        self.pubspec_path = os.path.join(build_provider.BUILD_FLUTTER_ROOT, 'pubspec.yaml')
        self.output_path = os.path.join(build_provider.BUILD_FLUTTER_ROOT, 'pubspec_test.yaml')
        self.parser = PubspecParser(self.pubspec_path)

    def run_all_replace(self):
        self.filter_assets_by_appname(build_provider.APPNAME)
        self.ensure_app_assets_exist(build_provider.APPNAME)
        self.generate_description_for_app(build_provider.APPNAME)
        self.replace_flutter_package_name(build_provider.BUILD_FLUTTER_ROOT)
        # self.parser.set_name(f"{build_provider.APPNAME}app")
        self.parser.save(self.output_path)

    def filter_assets_by_appname(self, appname: str):
        """
        Keep only assets that start with the given appname (e.g., 'achat_') or 'common_' in the assets list.
        For each kept asset, ensure the directory exists in BUILD_FLUTTER_ASSETS_DIR, warn and create if not.
        For each filtered asset (not appname or common_), warn and delete the directory if it exists.
        """
        assets = self.parser.get_assets()
        prefix = f"assets/{appname}_"
        common_prefix = "assets/common_"
        filtered = []
        deleted_dirs = []
        for a in assets:
            asset_dir = os.path.join(build_provider.BUILD_FLUTTER_ASSETS_DIR, os.path.basename(a.rstrip('/')))
            if a.startswith(prefix) or a.startswith(common_prefix):
                filtered.append(a)
                if not os.path.exists(asset_dir):
                    Print.warn(f"Directory does not exist, creating: {asset_dir}")
                    os.makedirs(asset_dir, exist_ok=True)
            else:
                if os.path.exists(asset_dir):
                    try:
                        import shutil
                        shutil.rmtree(asset_dir)
                        deleted_dirs.append(asset_dir)
                    except Exception as e:
                        Print.warn(f"Failed to delete {asset_dir}: {e}")
        if deleted_dirs:
            Print.warn(
                "Filtered out and deleted the following directories (only kept app/common assets):\n  " +
                "\n  ".join(deleted_dirs)
            )
        self.parser.set_assets(filtered)

    def ensure_app_assets_exist(self, appname: str):
        """
        Ensure that assets for '{appname}_launch', '{appname}_images', '{appname}_icons' exist in the assets list, adding them if missing.
        """
        assets = self.parser.get_assets()
        required = [
            f"assets/{appname}_launch/",
            f"assets/{appname}_images/",
            f"assets/{appname}_icons/"
        ]
        for r in required:
            if r not in assets:
                assets.append(r)
        self.parser.set_assets(assets)

    def generate_description_for_app(self, appname: str):
        """
        Generate a nice description for the app and set it in the pubspec.
        """
        desc = f"{appname.capitalize()} - A modern Flutter application for Android, iOS, and Web. Enjoy a seamless experience across all platforms."
        self.parser.set_description(desc)

    def replace_flutter_package_name(self, root_dir=None, keyword=None):
        """
        Replace the Flutter package name project-wide:
        - Get the old name from pubspec
        - Generate a new name
        - Set and save the new name in pubspec
        - Recursively replace all occurrences in all text files under root_dir (optionally filter by keyword)
        - Print progress and summary
        """
        old_name = self.parser.get_name()
        new_name = generate_flutter_app_name()
        self.parser.set_name(new_name)
        self.parser.save(self.pubspec_path)
        if root_dir is None:
            root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        file_list = scan_files_for_replacement(root_dir, keyword)
        replaced_files = replace_in_files(file_list, old_name, new_name)
        replaced_files_set = set(replaced_files)
        for filepath in replaced_files:
            Print.print_single_line_info(f"Replaced in: {filepath}")
        Print.info(f"\nReplacement complete. Old name: {old_name}, New name: {new_name}")
        Print.info(f"Total files replaced: {len(replaced_files_set)}")
        if replaced_files_set:
            Print.info("Files replaced:")
            Print.print_categorized_items(list(replaced_files_set), title="Replaced Files")

    # Method 4 reserved for future use
