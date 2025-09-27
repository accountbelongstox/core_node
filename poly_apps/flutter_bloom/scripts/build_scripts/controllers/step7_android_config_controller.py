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
from core.constants.build_constants import DEFAULT_PACKAGE_ID


class Step7AndroidConfigController:
    """
    Step 7 Controller: Android Configuration Replacement
    Replaces package IDs and app names in Android XML configuration files
    """

    def __init__(self):
        self.step_name = "STEP-7"
        self.step_description = "Android Configuration Replacement"
        self.results = {}
        self.app_name = None
        self.config_reader = None
        self.target_files = []
        self.replacements_made = {}
        self.directory_manager = DirectoryManager()

    def execute(self, **kwargs) -> Dict[str, Any]:
        """Execute Step 7: Android Configuration Replacement"""
        try:
            PrintHelper.header(f"{self.step_name}: {self.step_description}")

            # Get app name from unified variables using correct key
            self.app_name = unified_vars.get_file_variable(unified_vars.KEY_APP_NAME, '')
            if not self.app_name:
                PrintHelper.error("No app name found in unified variables", source=self.step_name)
                return {'success': False, 'error': 'No app name provided'}

            PrintHelper.info(f"Processing Android configuration for app: {self.app_name}", source=self.step_name)

            # Load app configuration
            self.config_reader = AppConfigReader(self.app_name)
            config_data = self.config_reader.load_config()
            self.config_reader.print_config_summary()

            # Get build directory
            build_dir = self._get_build_directory()
            if not build_dir:
                return {'success': False, 'error': 'Build directory not found'}

            # Scan for Android configuration files
            android_files = self._scan_android_files(build_dir)
            self._print_file_inventory(android_files)

            # Perform replacements
            replacement_results = self._perform_replacements(android_files, config_data)

            # Generate summary
            summary = self._generate_summary(replacement_results)

            self.results = {
                'success': True,
                'app_name': self.app_name,
                'config_data': config_data,
                'files_processed': len(android_files),
                'replacements_made': self.replacements_made,
                'summary': summary
            }

            PrintHelper.success(f"{self.step_name} completed successfully", source=self.step_name)
            return self.results

        except Exception as e:
            error_msg = f"Step 7 execution failed: {str(e)}"
            PrintHelper.error(error_msg, source=self.step_name)
            return {'success': False, 'error': error_msg}

    def _get_build_directory(self) -> Optional[Path]:
        """Get the current build directory using directory manager"""
        # Use directory manager to get current directory info
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
            'manifest_files': ['**/AndroidManifest.xml'],
            'gradle_files': ['**/build.gradle', '**/build.gradle.kts'],
            'xml_files': ['**/res/**/*.xml'],
            'kotlin_files': ['**/*.kt'],
            'java_files': ['**/*.java'],
            'strings_files': ['**/res/values/strings.xml', '**/res/values-*/strings.xml']
        }

        PrintHelper.info("Scanning Android configuration files...", source=self.step_name)

        for category, pattern_list in patterns.items():
            for pattern in pattern_list:
                files = list(build_dir.glob(pattern))
                # Filter out backup and cache files
                files = [f for f in files if not any(part.startswith('.') for part in f.parts)]
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
        print(f"[{self.step_name}] Package ID: {DEFAULT_PACKAGE_ID} -> {package_id}")
        print(f"[{self.step_name}] Display Name (CN): -> {display_name_cn}")
        print(f"[{self.step_name}] Display Name (EN): -> {display_name_en}")
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
                    print(f"[{self.step_name}]   ✓ Modified: {', '.join(changes_made)}")
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
                    print(f"[{self.step_name}]   ✓ Modified: {', '.join(changes_made)}")
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
        """Process strings.xml files"""
        results = []

        for strings_file in strings_files:
            try:
                PrintHelper.info(f"Processing strings: {strings_file.name}", source=self.step_name)

                # Determine if this is Chinese or English strings
                is_chinese = 'values-zh' in str(strings_file) or 'values-cn' in str(strings_file)
                target_name = display_name_cn if is_chinese else display_name_en

                # Parse XML
                tree = ET.parse(strings_file)
                root = tree.getroot()
                changes_made = []

                # Look for app_name string resource
                for string_elem in root.findall('.//string[@name="app_name"]'):
                    old_value = string_elem.text
                    string_elem.text = target_name
                    changes_made.append(f"app_name: {old_value} -> {target_name}")
                    if is_chinese:
                        self.replacements_made['display_name_cn'] += 1
                    else:
                        self.replacements_made['display_name_en'] += 1

                # Look for other common app title strings
                title_names = ['title', 'app_title', 'application_name']
                for name in title_names:
                    for string_elem in root.findall(f'.//string[@name="{name}"]'):
                        old_value = string_elem.text
                        string_elem.text = target_name
                        changes_made.append(f"{name}: {old_value} -> {target_name}")

                # Write back if changes were made
                if changes_made:
                    tree.write(str(strings_file), encoding='utf-8', xml_declaration=True)
                    self.replacements_made['files_modified'] += 1
                    print(f"[{self.step_name}]   ✓ Modified: {', '.join(changes_made)}")
                else:
                    print(f"[{self.step_name}]   - No changes needed")

                results.append({
                    'file': str(strings_file),
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
                    print(f"[{self.step_name}]   ✓ {source_file.name}: {', '.join(changes_made)}")

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

        # Calculate success rate
        total_operations = sum(len(results) for results in replacement_results.values())
        successful_operations = sum(
            sum(1 for result in results if result.get('success', False))
            for results in replacement_results.values()
        )

        if total_operations > 0:
            summary['success_rate'] = (successful_operations / total_operations) * 100

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