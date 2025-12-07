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

#!/usr/bin/env python3
"""
Step 7 Android Configuration Controller
Handles Android package ID and app name replacement in XML files
"""

import os
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any
from xml.dom import minidom

from shared.data_exchange.unified_variable_system import unified_vars
from shared.directory_manager import DirectoryManager
from utils.app_config_reader import AppConfigReader
from utils.print_helper import PrintHelper
from utils.universal_app_name_replacer import (
    UniversalAppNameReplacer,
    ReplacementConfig
)
from core.constants.build_constants import (
    DEFAULT_PACKAGE_ID,
    PLACEHOLDER_PACKAGE_ID,
    PLACEHOLDER_APP_NAME_CN,
    PLACEHOLDER_APP_NAME_EN
)


class Step7AndroidConfigController:
    """
    Step 7 Controller: Universal Multi-Platform App Name Replacement
    Replaces package IDs and app names across ALL platforms (Android, iOS, Web, macOS, Linux, Windows)
    Using enhanced regex-based recursive scanning engine
    """

    def __init__(self):
        self.step_name = "STEP-7"
        self.step_description = "Universal Multi-Platform App Name Replacement"
        self.results = {}
        self.app_name = None
        self.config_reader = None
        self.target_files = []
        self.replacements_made = {}
        self.directory_manager = DirectoryManager()
        self.replacer = None

    def execute(self, **kwargs) -> Dict[str, Any]:
        """Execute Step 7: Universal Multi-Platform App Name Replacement"""
        try:
            PrintHelper.header(f"{self.step_name}: {self.step_description}")

            # Get app name from unified variables using correct key
            self.app_name = unified_vars.get_file_variable(unified_vars.KEY_APP_NAME, '')
            if not self.app_name:
                PrintHelper.error("No app name found in unified variables", source=self.step_name)
                return {'success': False, 'error': 'No app name provided'}

            PrintHelper.info(f"Processing multi-platform app name replacement for: {self.app_name}", source=self.step_name)

            # Get build root directory (parent of android/, ios/, etc.) using DirectoryManager
            build_root = self.directory_manager.get_build_root_directory(**kwargs)
            if not build_root:
                return {'success': False, 'error': 'Build root directory not found'}

            PrintHelper.info(f"Build root: {build_root}", source=self.step_name)

            # Load app configuration
            self.config_reader = AppConfigReader(self.app_name, build_root=build_root)
            config_data = self.config_reader.load_config()
            self.config_reader.print_config_summary()

            # Get configuration values
            package_id = self.config_reader.get_package_id()
            app_name_en = self.config_reader.get_display_name_english()
            app_name_cn = self.config_reader.get_display_name_chinese()

            PrintHelper.info(f"Replacement configuration:", source=self.step_name)
            print(f"[{self.step_name}]   Package ID: {package_id}")
            print(f"[{self.step_name}]   App Name (EN): {app_name_en}")
            print(f"[{self.step_name}]   App Name (CN): {app_name_cn}")
            print()

            # Create replacement configuration
            replacement_config = ReplacementConfig(
                package_id=package_id,
                app_name_en=app_name_en,
                app_name_cn=app_name_cn
            )

            # Create and execute universal replacer with regex-based rules
            self.replacer = UniversalAppNameReplacer(replacement_config)
            platform_results = self.replacer.replace_all_platforms(build_root)

            # Print detailed summary
            self.replacer.print_summary(platform_results, self.step_name)

            # Generate results
            total_files_modified = sum(r.files_modified for r in platform_results.values())
            total_replacements = sum(r.total_replacements for r in platform_results.values())

            self.results = {
                'success': True,
                'app_name': self.app_name,
                'config_data': config_data,
                'package_id': package_id,
                'app_name_en': app_name_en,
                'app_name_cn': app_name_cn,
                'files_modified': total_files_modified,
                'total_replacements': total_replacements,
                'platform_results': {
                    platform: {
                        'files_scanned': result.files_scanned,
                        'files_modified': result.files_modified,
                        'total_replacements': result.total_replacements,
                        'errors': result.errors
                    }
                    for platform, result in platform_results.items()
                }
            }

            PrintHelper.success(f"{self.step_name} completed successfully", source=self.step_name)
            return self.results

        except Exception as e:
            error_msg = f"Step 7 execution failed: {str(e)}"
            PrintHelper.error(error_msg, source=self.step_name)
            import traceback
            traceback.print_exc()
            return {'success': False, 'error': error_msg}

    def _get_build_directory(self, **kwargs) -> Optional[Path]:
        """
        Get the current build directory from parameters or directory manager
        [DEPRECATED - Use _get_build_root_directory instead]
        """
        # First, try to get from kwargs (passed from modern_build_system)
        if 'temp_build_root' in kwargs:
            build_root = Path(kwargs['temp_build_root'])
            android_path = build_root / 'android'
            PrintHelper.info(f"Build root parameter: {build_root}", source=self.step_name)
            PrintHelper.info(f"Android path: {android_path}", source=self.step_name)
            if android_path.exists():
                PrintHelper.info(f"[OK] Android directory found: {android_path}", source=self.step_name)
                return android_path
            else:
                PrintHelper.error(f"[ERROR] Android directory not found: {android_path}", source=self.step_name)

        # Second, try build_root parameter
        if 'build_root' in kwargs:
            build_root = Path(kwargs['build_root'])
            android_path = build_root / 'android'
            if android_path.exists():
                PrintHelper.info(f"Using build root: {android_path}", source=self.step_name)
                return android_path

        # Third, use directory manager to get current directory info
        dir_info = self.directory_manager.get_current_info()

        # Check if we're in temp directory
        if self.directory_manager.is_in_temp:
            current_dir = Path(dir_info['current_dir'])
            android_path = current_dir / 'android'
            if android_path.exists():
                PrintHelper.info(f"Using temp directory: {android_path}", source=self.step_name)
                return android_path

        # Fallback: look for compile_factory directories
        compile_factory = Path(r'D:\programing\.build_dir\compile_factory')
        if compile_factory.exists():
            # Find the most recent build directory
            build_dirs = [d for d in compile_factory.iterdir() if d.is_dir() and 'app_' in d.name]
            if build_dirs:
                latest_build = max(build_dirs, key=lambda x: x.stat().st_mtime)
                android_path = latest_build / 'android'
                if android_path.exists():
                    PrintHelper.info(f"Using fallback directory: {android_path}", source=self.step_name)
                    return android_path

        PrintHelper.error("No valid build directory found", source=self.step_name)
        return None

    def _perform_global_replacement(self, build_dir: Path, config_data: Dict[str, Any]) -> Dict[str, Any]:
        """Perform global text replacement on all text files in the build directory"""
        package_id = self.config_reader.get_package_id()
        display_name_cn = self.config_reader.get_display_name_chinese()
        display_name_en = self.config_reader.get_display_name_english()

        PrintHelper.info(f"Starting global text replacement:", source=self.step_name)
        print(f"[{self.step_name}] Replacement mappings:")
        print(f"[{self.step_name}]   Package ID: '{PLACEHOLDER_PACKAGE_ID}' -> '{package_id}'")
        print(f"[{self.step_name}]   Chinese Name: '{PLACEHOLDER_APP_NAME_CN}' -> '{display_name_cn}'")
        print(f"[{self.step_name}]   English Name: '{PLACEHOLDER_APP_NAME_EN}' -> '{display_name_en}'")
        print()

        # Define replacement mappings
        replacements = {
            PLACEHOLDER_PACKAGE_ID: package_id,
            PLACEHOLDER_APP_NAME_CN: display_name_cn,
            PLACEHOLDER_APP_NAME_EN: display_name_en
        }

        # Define text file extensions to process
        text_extensions = {
            '.xml', '.java', '.kt', '.gradle', '.json', '.properties',
            '.txt', '.md', '.yml', '.yaml', '.sh', '.bat', '.py'
        }

        # Statistics
        stats = {
            'files_scanned': 0,
            'files_modified': 0,
            'text_files_found': 0,
            'utf8_errors': 0,
            'other_errors': 0,
            'replacements_made': {
                PLACEHOLDER_PACKAGE_ID: 0,
                PLACEHOLDER_APP_NAME_CN: 0,
                PLACEHOLDER_APP_NAME_EN: 0
            }
        }

        # Scan all files recursively
        PrintHelper.info(f"Scanning all files in: {build_dir}", source=self.step_name)
        for file_path in build_dir.rglob('*'):
            if not file_path.is_file():
                continue

            stats['files_scanned'] += 1

            # Skip binary files and cache directories
            if self._should_skip_file(file_path):
                continue

            # Check if it's a text file we should process
            if file_path.suffix.lower() not in text_extensions:
                continue

            stats['text_files_found'] += 1

            try:
                # Try to read file with UTF-8 encoding
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                except UnicodeDecodeError as utf8_error:
                    relative_path = file_path.relative_to(build_dir)
                    print(f"[{self.step_name}]   [WARN] UTF-8 decode error in {relative_path}: {utf8_error}")
                    print(f"[{self.step_name}]     Skipping file (likely binary or non-UTF-8 text)")
                    stats['utf8_errors'] += 1
                    continue
                except Exception as read_error:
                    relative_path = file_path.relative_to(build_dir)
                    print(f"[{self.step_name}]   [ERROR] Read error in {relative_path}: {read_error}")
                    stats['other_errors'] += 1
                    continue

                original_content = content
                file_modified = False

                # Apply all replacements
                for old_text, new_text in replacements.items():
                    if old_text in content:
                        content = content.replace(old_text, new_text)
                        replacement_count = original_content.count(old_text)
                        stats['replacements_made'][old_text] += replacement_count
                        file_modified = True

                        relative_path = file_path.relative_to(build_dir)
                        print(f"[{self.step_name}]   [OK] {relative_path}: {replacement_count}x '{old_text}' -> '{new_text}'")

                # Write back if modified
                if file_modified:
                    try:
                        with open(file_path, 'w', encoding='utf-8') as f:
                            f.write(content)
                        stats['files_modified'] += 1
                    except UnicodeEncodeError as utf8_write_error:
                        relative_path = file_path.relative_to(build_dir)
                        print(f"[{self.step_name}]   [ERROR] UTF-8 write error in {relative_path}: {utf8_write_error}")
                        stats['utf8_errors'] += 1
                        continue
                    except Exception as write_error:
                        relative_path = file_path.relative_to(build_dir)
                        print(f"[{self.step_name}]   [ERROR] Write error in {relative_path}: {write_error}")
                        stats['other_errors'] += 1
                        continue

            except Exception as e:
                relative_path = file_path.relative_to(build_dir)
                print(f"[{self.step_name}]   [ERROR] Unexpected error processing {relative_path}: {e}")
                stats['other_errors'] += 1

        # Print summary
        print(f"[{self.step_name}] Global Replacement Summary:")
        print(f"[{self.step_name}]   Files scanned: {stats['files_scanned']}")
        print(f"[{self.step_name}]   Text files found: {stats['text_files_found']}")
        print(f"[{self.step_name}]   Files modified: {stats['files_modified']}")
        print(f"[{self.step_name}]   UTF-8 errors: {stats['utf8_errors']}")
        print(f"[{self.step_name}]   Other errors: {stats['other_errors']}")
        print(f"[{self.step_name}]   Package ID replacements: {stats['replacements_made'][PLACEHOLDER_PACKAGE_ID]}")
        print(f"[{self.step_name}]   Chinese name replacements: {stats['replacements_made'][PLACEHOLDER_APP_NAME_CN]}")
        print(f"[{self.step_name}]   English name replacements: {stats['replacements_made'][PLACEHOLDER_APP_NAME_EN]}")

        # Update class statistics for summary
        self.replacements_made = {
            'package_id': stats['replacements_made'][PLACEHOLDER_PACKAGE_ID],
            'display_name_cn': stats['replacements_made'][PLACEHOLDER_APP_NAME_CN],
            'display_name_en': stats['replacements_made'][PLACEHOLDER_APP_NAME_EN],
            'files_modified': stats['files_modified']
        }

        return {
            'success': True,
            'stats': stats,
            'replacements': replacements
        }

    def _should_skip_file(self, file_path: Path) -> bool:
        """Determine if a file should be skipped during replacement"""
        # Skip files in cache/build directories
        skip_dirs = {'.gradle', 'build', 'node_modules', '.git', '__pycache__'}
        if any(skip_dir in file_path.parts for skip_dir in skip_dirs):
            return True

        # Skip binary files
        binary_extensions = {
            '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp',
            '.so', '.dll', '.exe', '.bin', '.jar', '.zip',
            '.tar', '.gz', '.7z', '.rar', '.class', '.dex'
        }
        if file_path.suffix.lower() in binary_extensions:
            return True

        return False

    def _scan_android_files(self, build_dir: Path) -> Dict[str, List[Path]]:
        """Scan for Android configuration files that need package ID replacement"""
        android_files = {
            'manifest_files': [],
            'gradle_files': [],
            'xml_files': [],
            'kotlin_files': [],
            'java_files': [],
            'strings_files': []
        }

        # Define file patterns to search for
        patterns = {
            'manifest_files': ['AndroidManifest.xml'],
            'gradle_files': ['build.gradle', 'build.gradle.kts'],
            'xml_files': ['*.xml'],
            'kotlin_files': ['*.kt'],
            'java_files': ['*.java'],
            'strings_files': ['strings.xml']
        }

        PrintHelper.info("Scanning Android configuration files...", source=self.step_name)
        PrintHelper.info(f"Scanning in directory: {build_dir}", source=self.step_name)

        # First, let's see what's actually in the android directory
        if build_dir.exists():
            print(f"[{self.step_name}] Directory contents:")
            for item in build_dir.rglob('*'):
                if item.is_file():
                    relative_path = item.relative_to(build_dir)
                    print(f"[{self.step_name}]   FILE: {relative_path}")
                elif item.is_dir():
                    relative_path = item.relative_to(build_dir)
                    print(f"[{self.step_name}]   DIR:  {relative_path}/")

        print(f"[{self.step_name}] {'='*60}")

        for category, pattern_list in patterns.items():
            print(f"[{self.step_name}] Searching for {category}:")
            for pattern in pattern_list:
                print(f"[{self.step_name}]   Pattern: {pattern}")

                # Try both rglob (recursive) and glob
                files_rglob = list(build_dir.rglob(pattern.replace('**/', '')))
                files_glob = list(build_dir.glob(pattern))

                # Combine and deduplicate
                all_files = list(set(files_rglob + files_glob))

                # Filter out only .gradle cache files, but keep important files
                files_before_filter = all_files
                files = [f for f in all_files if not (
                    '.gradle' in str(f) and any(cache_dir in str(f) for cache_dir in [
                        'checksums', 'executionHistory', 'fileChanges', 'fileHashes',
                        'buildOutputCleanup', 'kotlin', 'noVersion', 'vcs-1'
                    ])
                )]

                print(f"[{self.step_name}]   Found with rglob: {len(files_rglob)} files")
                print(f"[{self.step_name}]   Found with glob: {len(files_glob)} files")
                print(f"[{self.step_name}]   Before filter: {len(files_before_filter)} files")
                print(f"[{self.step_name}]   Final filtered: {len(files)} files")

                # Show filtered out files for debugging
                filtered_out = [f for f in files_before_filter if f not in files]
                if filtered_out:
                    print(f"[{self.step_name}]   Filtered out: {len(filtered_out)} files")
                    for f in filtered_out[:3]:  # Show first 3
                        print(f"[{self.step_name}]     FILTERED: {f.relative_to(build_dir)}")
                    if len(filtered_out) > 3:
                        print(f"[{self.step_name}]     ... and {len(filtered_out) - 3} more")

                # Show kept files
                for file in files:
                    relative_path = file.relative_to(build_dir)
                    print(f"[{self.step_name}]     [OK] KEPT: {relative_path}")
                android_files[category].extend(files)

        return android_files

    def _print_file_inventory(self, android_files: Dict[str, List[Path]]):
        """Print inventory of files to be processed"""
        PrintHelper.info("Android Configuration Files Inventory:", source=self.step_name)
        print(f"[{self.step_name}] ={'='*60}")

        total_files = 0
        for category, files in android_files.items():
            count = len(files)
            total_files += count
            print(f"[{self.step_name}] {category.replace('_', ' ').title()}: {count} files")

            if count > 0 and count <= 10:  # Show files if not too many
                for file_path in files:
                    try:
                        # Try to get relative path from build directory
                        rel_path = file_path.relative_to(build_dir) if 'build_dir' in locals() else file_path.name
                        print(f"[{self.step_name}]   - {rel_path}")
                    except:
                        print(f"[{self.step_name}]   - {file_path.name}")
            elif count > 10:
                print(f"[{self.step_name}]   - (Too many files to list, showing first 5)")
                for file_path in files[:5]:
                    try:
                        rel_path = file_path.relative_to(build_dir) if 'build_dir' in locals() else file_path.name
                        print(f"[{self.step_name}]   - {rel_path}")
                    except:
                        print(f"[{self.step_name}]   - {file_path.name}")
                print(f"[{self.step_name}]   - ... and {count - 5} more")

        print(f"[{self.step_name}] ={'='*60}")
        print(f"[{self.step_name}] Total Files to Process: {total_files}")
        print()

    def _perform_replacements(self, android_files: Dict[str, List[Path]], config_data: Dict[str, Any]) -> Dict[str, Any]:
        """Perform package ID and app name replacements"""
        package_id = self.config_reader.get_package_id()
        display_name_cn = self.config_reader.get_display_name_chinese()
        display_name_en = self.config_reader.get_display_name_english()

        PrintHelper.info(f"Starting replacements with:", source=self.step_name)
        print(f"[{self.step_name}] Package ID Replacement:")
        print(f"[{self.step_name}]   FROM: {DEFAULT_PACKAGE_ID}")
        print(f"[{self.step_name}]   TO:   {package_id}")
        print(f"[{self.step_name}] Display Names:")
        print(f"[{self.step_name}]   Chinese (CN): '{display_name_cn}'")
        print(f"[{self.step_name}]   English (EN): '{display_name_en}'")
        print()

        self.replacements_made = {
            'package_id': 0,
            'display_name_cn': 0,
            'display_name_en': 0,
            'files_modified': 0
        }

        results = {
            'manifest_results': self._process_manifest_files(android_files['manifest_files'], package_id, display_name_en),
            'gradle_results': self._process_gradle_files(android_files['gradle_files'], package_id),
            'strings_results': self._process_strings_files(android_files['strings_files'], display_name_cn, display_name_en),
            'source_results': self._process_source_files(android_files['kotlin_files'] + android_files['java_files'], package_id)
        }

        return results

    def _process_manifest_files(self, manifest_files: List[Path], package_id: str, display_name: str) -> List[Dict]:
        """Process AndroidManifest.xml files"""
        results = []

        for manifest_file in manifest_files:
            try:
                PrintHelper.info(f"Processing manifest: {manifest_file.name}", source=self.step_name)

                # Read file content
                content = manifest_file.read_text(encoding='utf-8')
                original_content = content
                changes_made = []

                # Replace package ID
                if DEFAULT_PACKAGE_ID in content:
                    content = content.replace(DEFAULT_PACKAGE_ID, package_id)
                    changes_made.append(f"Package ID: {DEFAULT_PACKAGE_ID} -> {package_id}")
                    self.replacements_made['package_id'] += content.count(package_id) - original_content.count(package_id)

                # Replace app label if found
                label_pattern = r'android:label="[^"]*"'
                if re.search(label_pattern, content):
                    content = re.sub(label_pattern, f'android:label="{display_name}"', content)
                    changes_made.append(f"App label -> {display_name}")
                    self.replacements_made['display_name_en'] += 1

                # Write back if changes were made
                if changes_made:
                    manifest_file.write_text(content, encoding='utf-8')
                    self.replacements_made['files_modified'] += 1
                    print(f"[{self.step_name}]   [OK] Modified: {', '.join(changes_made)}")
                else:
                    print(f"[{self.step_name}]   - No changes needed")

                results.append({
                    'file': str(manifest_file),
                    'changes': changes_made,
                    'success': True
                })

            except Exception as e:
                error_msg = f"Error processing {manifest_file}: {e}"
                PrintHelper.error(error_msg, source=self.step_name)
                results.append({
                    'file': str(manifest_file),
                    'error': str(e),
                    'success': False
                })

        return results

    def _process_gradle_files(self, gradle_files: List[Path], package_id: str) -> List[Dict]:
        """Process build.gradle files"""
        results = []

        for gradle_file in gradle_files:
            try:
                PrintHelper.info(f"Processing gradle: {gradle_file.name}", source=self.step_name)

                content = gradle_file.read_text(encoding='utf-8')
                original_content = content
                changes_made = []

                # Replace applicationId
                app_id_pattern = r'applicationId\s+["\']([^"\']+)["\']'
                if re.search(app_id_pattern, content):
                    content = re.sub(app_id_pattern, f'applicationId "{package_id}"', content)
                    changes_made.append(f"ApplicationId -> {package_id}")
                    self.replacements_made['package_id'] += 1

                # Replace namespace if present
                namespace_pattern = r'namespace\s+["\']([^"\']+)["\']'
                if re.search(namespace_pattern, content):
                    content = re.sub(namespace_pattern, f'namespace "{package_id}"', content)
                    changes_made.append(f"Namespace -> {package_id}")

                # Write back if changes were made
                if changes_made:
                    gradle_file.write_text(content, encoding='utf-8')
                    self.replacements_made['files_modified'] += 1
                    print(f"[{self.step_name}]   [OK] Modified: {', '.join(changes_made)}")
                else:
                    print(f"[{self.step_name}]   - No changes needed")

                results.append({
                    'file': str(gradle_file),
                    'changes': changes_made,
                    'success': True
                })

            except Exception as e:
                error_msg = f"Error processing {gradle_file}: {e}"
                PrintHelper.error(error_msg, source=self.step_name)
                results.append({
                    'file': str(gradle_file),
                    'error': str(e),
                    'success': False
                })

        return results

    def _process_strings_files(self, strings_files: List[Path], display_name_cn: str, display_name_en: str) -> List[Dict]:
        """Process strings.xml files with detailed analysis"""
        results = []

        PrintHelper.info(f"Processing {len(strings_files)} strings.xml files", source=self.step_name)
        print(f"[{self.step_name}] Target Display Names:")
        print(f"[{self.step_name}]   Chinese (CN): '{display_name_cn}'")
        print(f"[{self.step_name}]   English (EN): '{display_name_en}'")

        for strings_file in strings_files:
            try:
                # Determine language based on parent directory
                parent_dir = strings_file.parent.name
                is_chinese = 'values-zh' in parent_dir or 'values-cn' in parent_dir
                target_name = display_name_cn if is_chinese else display_name_en
                language_label = "Chinese" if is_chinese else "English"

                PrintHelper.info(f"Processing strings file: {strings_file}", source=self.step_name)
                print(f"[{self.step_name}]   Directory: {parent_dir}")
                print(f"[{self.step_name}]   Language: {language_label}")
                print(f"[{self.step_name}]   Target name: '{target_name}'")

                # Parse XML and show current content
                tree = ET.parse(strings_file)
                root = tree.getroot()
                changes_made = []

                # Show all string entries in the file
                print(f"[{self.step_name}]   Current string entries:")
                for string_elem in root.findall('.//string'):
                    name = string_elem.get('name', 'UNNAMED')
                    value = string_elem.text or 'EMPTY'
                    print(f"[{self.step_name}]     <string name=\"{name}\">{value}</string>")

                # Look for app_name string resource
                app_name_elements = root.findall('.//string[@name="app_name"]')
                print(f"[{self.step_name}]   Found {len(app_name_elements)} app_name elements")

                for string_elem in app_name_elements:
                    old_value = string_elem.text or 'EMPTY'
                    string_elem.text = target_name
                    changes_made.append(f"app_name: '{old_value}' -> '{target_name}'")
                    if is_chinese:
                        self.replacements_made['display_name_cn'] += 1
                    else:
                        self.replacements_made['display_name_en'] += 1

                # Look for other common app title strings
                title_names = ['title', 'app_title', 'application_name', 'launcher_name']
                for name in title_names:
                    elements = root.findall(f'.//string[@name="{name}"]')
                    if elements:
                        print(f"[{self.step_name}]   Found {len(elements)} '{name}' elements")
                        for string_elem in elements:
                            old_value = string_elem.text or 'EMPTY'
                            string_elem.text = target_name
                            changes_made.append(f"{name}: '{old_value}' -> '{target_name}'")

                # Write back if changes were made
                if changes_made:
                    tree.write(str(strings_file), encoding='utf-8', xml_declaration=True)
                    self.replacements_made['files_modified'] += 1
                    print(f"[{self.step_name}]   [OK] MODIFIED: {len(changes_made)} changes")
                    for change in changes_made:
                        print(f"[{self.step_name}]     - {change}")
                else:
                    print(f"[{self.step_name}]   - NO CHANGES NEEDED")

                results.append({
                    'file': str(strings_file),
                    'language': language_label,
                    'directory': parent_dir,
                    'changes': changes_made,
                    'success': True
                })

            except Exception as e:
                error_msg = f"Error processing {strings_file}: {e}"
                PrintHelper.error(error_msg, source=self.step_name)
                results.append({
                    'file': str(strings_file),
                    'error': str(e),
                    'success': False
                })

        return results

    def _process_source_files(self, source_files: List[Path], package_id: str) -> List[Dict]:
        """Process Kotlin and Java source files"""
        results = []

        for source_file in source_files:
            try:
                content = source_file.read_text(encoding='utf-8')
                original_content = content
                changes_made = []

                # Replace package declarations
                package_pattern = rf'package\s+{re.escape(DEFAULT_PACKAGE_ID)}(\.|;|\s)'
                if re.search(package_pattern, content):
                    content = re.sub(package_pattern, f'package {package_id}\\1', content)
                    changes_made.append(f"Package declaration -> {package_id}")
                    self.replacements_made['package_id'] += 1

                # Replace import statements
                import_pattern = rf'import\s+{re.escape(DEFAULT_PACKAGE_ID)}\.'
                if re.search(import_pattern, content):
                    content = re.sub(import_pattern, f'import {package_id}.', content)
                    changes_made.append(f"Import statements -> {package_id}")

                # Write back if changes were made
                if changes_made:
                    source_file.write_text(content, encoding='utf-8')
                    self.replacements_made['files_modified'] += 1
                    print(f"[{self.step_name}]   [OK] {source_file.name}: {', '.join(changes_made)}")

                results.append({
                    'file': str(source_file),
                    'changes': changes_made,
                    'success': True
                })

            except Exception as e:
                error_msg = f"Error processing {source_file}: {e}"
                PrintHelper.error(error_msg, source=self.step_name)
                results.append({
                    'file': str(source_file),
                    'error': str(e),
                    'success': False
                })

        return results

    def _generate_summary(self, replacement_results: Dict[str, Any]) -> Dict[str, Any]:
        """Generate a summary of the replacement operation"""
        summary = {
            'total_package_id_replacements': self.replacements_made['package_id'],
            'total_display_name_cn_replacements': self.replacements_made['display_name_cn'],
            'total_display_name_en_replacements': self.replacements_made['display_name_en'],
            'total_files_modified': self.replacements_made['files_modified'],
            'success_rate': 0
        }

        # Calculate success rate based on files processed
        stats = replacement_results.get('stats', {})
        files_scanned = stats.get('files_scanned', 0)
        files_modified = stats.get('files_modified', 0)
        utf8_errors = stats.get('utf8_errors', 0)
        other_errors = stats.get('other_errors', 0)

        if files_scanned > 0:
            success_rate = ((files_scanned - utf8_errors - other_errors) / files_scanned) * 100
            summary['success_rate'] = success_rate
        else:
            summary['success_rate'] = 0

        # Print summary
        PrintHelper.info("Replacement Summary:", source=self.step_name)
        print(f"[{self.step_name}] Package ID Replacements: {summary['total_package_id_replacements']}")
        print(f"[{self.step_name}] Display Name (CN) Replacements: {summary['total_display_name_cn_replacements']}")
        print(f"[{self.step_name}] Display Name (EN) Replacements: {summary['total_display_name_en_replacements']}")
        print(f"[{self.step_name}] Files Modified: {summary['total_files_modified']}")
        print(f"[{self.step_name}] Success Rate: {summary['success_rate']:.1f}%")

        return summary

    def get_results(self) -> Dict[str, Any]:
        """Get the results of Step 7 execution"""
        return self.results