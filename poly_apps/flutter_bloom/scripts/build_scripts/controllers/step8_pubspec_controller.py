#!/usr/bin/env python3
"""
Step 8 Pubspec Controller
Manages pubspec.yaml asset configuration based on selected app
"""

import os
import re
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple

from shared.data_exchange.unified_variable_system import unified_vars
from utils.print_helper import PrintHelper


class Step8PubspecController:
    """
    Step 8 Controller: Pubspec Asset Management
    Manages pubspec.yaml asset configuration for selected app
    """

    def __init__(self):
        self.step_name = "STEP-8"
        self.step_description = "Pubspec Asset Management"
        self.results = {}
        self.temp_build_root = None
        self.app_name = None
        self.selected_app_name = None
        self.pubspec_path = None

    def _scan_all_apps(self) -> List[str]:
        """
        Scan lib/apps directory to get all available apps

        Returns:
            List[str]: List of all app names found in lib/apps directory
        """
        all_apps = []

        try:
            lib_apps_dir = self.temp_build_root / "lib" / "apps"

            if lib_apps_dir.exists() and lib_apps_dir.is_dir():
                for app_dir in lib_apps_dir.iterdir():
                    if app_dir.is_dir() and app_dir.name.startswith('app_'):
                        all_apps.append(app_dir.name)

                PrintHelper.info(f"Found {len(all_apps)} apps in lib/apps: {all_apps}", source=self.step_name)
            else:
                PrintHelper.warning(f"lib/apps directory not found: {lib_apps_dir}", source=self.step_name)
                # Fallback: try to extract from pubspec.yaml if lib/apps doesn't exist
                all_apps = self._extract_apps_from_pubspec()

        except Exception as e:
            PrintHelper.error(f"Failed to scan lib/apps directory: {e}", source=self.step_name)
            # Fallback: try to extract from pubspec.yaml
            all_apps = self._extract_apps_from_pubspec()

        return all_apps

    def _extract_apps_from_pubspec(self) -> List[str]:
        """
        Extract app names from existing pubspec.yaml as fallback

        Returns:
            List[str]: List of app names found in pubspec.yaml
        """
        apps = set()

        try:
            if self.pubspec_path and self.pubspec_path.exists():
                with open(self.pubspec_path, 'r', encoding='utf-8') as f:
                    content = f.read()

                # Find all app_xxx patterns in asset paths
                import re
                app_pattern = r'app_\w+'
                matches = re.findall(app_pattern, content)

                for match in matches:
                    apps.add(match)

                PrintHelper.info(f"Extracted {len(apps)} apps from pubspec.yaml: {list(apps)}", source=self.step_name)

        except Exception as e:
            PrintHelper.error(f"Failed to extract apps from pubspec.yaml: {e}", source=self.step_name)

        return list(apps)

    def initialize(self, temp_build_root: Path, app_name: str) -> bool:
        """
        Initialize Step 8 controller with build parameters

        Args:
            temp_build_root: Path to temporary build directory
            app_name: Name of the application being built

        Returns:
            bool: True if initialization successful, False otherwise
        """
        try:
            PrintHelper.info(f"Initializing {self.step_description}", source=self.step_name)
            PrintHelper.info(f"Build Root: {temp_build_root}", source=self.step_name)
            PrintHelper.info(f"App Name: {app_name}", source=self.step_name)

            self.temp_build_root = temp_build_root
            self.app_name = app_name
            self.pubspec_path = temp_build_root / "pubspec.yaml"

            # Get selected app from unified variables
            self.selected_app_name = unified_vars.get_file_variable(unified_vars.KEY_SELECTED_APP, "")
            if not self.selected_app_name:
                # Try alternative variable names
                self.selected_app_name = unified_vars.get_file_variable(unified_vars.KEY_SELECTED_APP_NAME, "")

            if not self.selected_app_name:
                # Fallback to provided app_name
                self.selected_app_name = app_name

            PrintHelper.info(f"Selected app for pubspec management: {self.selected_app_name}", source=self.step_name)

            # Validate pubspec.yaml exists
            if not self.pubspec_path.exists():
                PrintHelper.error(f"pubspec.yaml not found: {self.pubspec_path}", source=self.step_name)
                return False

            PrintHelper.info(f"Step 8 controller initialized successfully", source=self.step_name)
            return True

        except Exception as e:
            PrintHelper.error(f"Failed to initialize Step 8 controller: {e}", source=self.step_name)
            return False

    def execute(self, **kwargs) -> Dict[str, Any]:
        """Execute Step 8: Pubspec Asset Management"""
        try:
            PrintHelper.header(f"{self.step_name}: {self.step_description}")

            # Scan all available apps
            all_apps = self._scan_all_apps()
            if not all_apps:
                PrintHelper.warning("No apps found to process", source=self.step_name)

            # Extract app name without prefix
            target_app_suffix = self._extract_app_suffix(self.selected_app_name)
            PrintHelper.info(f"Target app suffix: {target_app_suffix}", source=self.step_name)
            PrintHelper.info(f"All available apps: {all_apps}", source=self.step_name)

            # Generate pattern variations for ALL apps
            all_app_patterns = {}
            for app in all_apps:
                app_suffix = self._extract_app_suffix(app)
                patterns = self._generate_app_patterns(app_suffix)
                all_app_patterns[app_suffix] = patterns

            PrintHelper.info(f"Generated patterns for all apps: {all_app_patterns}", source=self.step_name)

            # Read pubspec.yaml content
            pubspec_content = self._read_pubspec_content()
            if pubspec_content is None:
                return self._create_error_result("Failed to read pubspec.yaml")

            # Process asset lines for ALL apps
            processed_content, changes_made = self._process_all_app_asset_lines(
                pubspec_content, all_app_patterns, target_app_suffix)

            if changes_made:
                # Write updated content back to pubspec.yaml
                success = self._write_pubspec_content(processed_content)
                if not success:
                    return self._create_error_result("Failed to write updated pubspec.yaml")

                PrintHelper.success(f"pubspec.yaml updated successfully", source=self.step_name)
            else:
                PrintHelper.info(f"No changes needed in pubspec.yaml", source=self.step_name)

            # Generate results
            self.results = {
                'success': True,
                'step': 8,
                'step_name': self.step_name,
                'step_description': self.step_description,
                'selected_app': self.selected_app_name,
                'target_app_suffix': target_app_suffix,
                'all_apps': all_apps,
                'all_app_patterns': all_app_patterns,
                'changes_made': changes_made,
                'pubspec_path': str(self.pubspec_path),
                'summary': self._generate_summary(changes_made, target_app_suffix, len(all_apps))
            }

            PrintHelper.success(f"{self.step_name} completed successfully", source=self.step_name)
            return self.results

        except Exception as e:
            error_msg = f"Step 8 execution failed: {str(e)}"
            PrintHelper.error(error_msg, source=self.step_name)
            return self._create_error_result(error_msg)

    def _extract_app_suffix(self, app_name: str) -> str:
        """
        Extract app suffix by removing 'app_' prefix

        Args:
            app_name: Full app name (e.g., 'app_achat')

        Returns:
            str: App suffix (e.g., 'achat')
        """
        if app_name.startswith('app_'):
            return app_name[4:]  # Remove 'app_' prefix
        return app_name

    def _generate_app_patterns(self, app_suffix: str) -> List[str]:
        """
        Generate pattern variations for app suffix

        Args:
            app_suffix: App suffix (e.g., 'achat')

        Returns:
            List[str]: Pattern variations for asset path matching
        """
        patterns = []

        # Primary app directory pattern (most common)
        patterns.append(f"app_{app_suffix}")     # app_achat

        # Extra assets directory pattern
        patterns.append(f".extra_{app_suffix}")  # .extra_achat

        # Underscore variations (for edge cases)
        patterns.append(f"_{app_suffix}/")       # _achat/ (with slash for path matching)
        patterns.append(f"{app_suffix}_/")       # achat_/ (with slash for path matching)

        return patterns

    def _process_all_app_asset_lines(self, content: List[str], all_app_patterns: Dict[str, List[str]], target_app_suffix: str) -> Tuple[List[str], bool]:
        """
        Process asset lines for ALL apps in pubspec.yaml content

        Args:
            content: Original content lines
            all_app_patterns: Dictionary mapping app_suffix -> patterns for ALL apps
            target_app_suffix: Target app suffix for enabling

        Returns:
            Tuple[List[str], bool]: (Updated content, whether changes were made)
        """
        updated_content = []
        changes_made = False

        PrintHelper.info(f"Processing {len(content)} lines for ALL apps asset management", source=self.step_name)
        PrintHelper.info(f"Target app: {target_app_suffix}", source=self.step_name)

        for line_num, line in enumerate(content, 1):
            original_line = line
            processed_line = line

            # Only process asset lines (containing "assets/" and "- ")
            if "assets/" in line and "- " in line:

                # Check which app this line belongs to (if any)
                matching_app = self._identify_app_from_line(line, all_app_patterns)

                if matching_app:
                    # This line belongs to a specific app
                    is_target_app = (matching_app == target_app_suffix)

                    # Get line without leading whitespace for comment checking
                    stripped_line = line.lstrip()
                    is_commented = stripped_line.startswith('#')

                    PrintHelper.info(f"Line {line_num}: App={matching_app}, {'Target' if is_target_app else 'Other'}, "
                                    f"{'Commented' if is_commented else 'Active'}: {line.strip()}", source=self.step_name)

                    if is_target_app:
                        # This is the target app - should be uncommented (active)
                        if is_commented:
                            # Remove the comment
                            processed_line = self._uncomment_line(line)
                            changes_made = True
                            PrintHelper.info(f"Line {line_num}: ✅ ENABLED target app ({matching_app}): {processed_line.strip()}", source=self.step_name)
                    else:
                        # This is another app - should be commented (inactive)
                        if not is_commented:
                            # Add comment
                            processed_line = self._comment_line(line)
                            changes_made = True
                            PrintHelper.info(f"Line {line_num}: 🚫 DISABLED other app ({matching_app}): {processed_line.strip()}", source=self.step_name)

            updated_content.append(processed_line)

        PrintHelper.info(f"Asset processing complete for ALL apps. Changes made: {changes_made}", source=self.step_name)
        return updated_content, changes_made

    def _identify_app_from_line(self, line: str, all_app_patterns: Dict[str, List[str]]) -> Optional[str]:
        """
        Identify which app a line belongs to based on patterns

        Args:
            line: Asset line to check
            all_app_patterns: Dictionary mapping app_suffix -> patterns for ALL apps

        Returns:
            Optional[str]: App suffix if found, None otherwise
        """
        # Skip common resources that are managed by other build steps
        if self._is_common_resource_line(line):
            PrintHelper.info(f"Skipping common resource (managed by other steps): {line.strip()}", source=self.step_name)
            return None

        for app_suffix, patterns in all_app_patterns.items():
            for pattern in patterns:
                if pattern in line:
                    return app_suffix

        return None

    def _is_common_resource_line(self, line: str) -> bool:
        """
        Check if line contains common resources that should not be managed by pubspec

        Common resources are handled by other build steps:
        - common/launch: Launch screen assets copied directly to Android
        - common/icons: Icon assets processed by image replacement steps

        Args:
            line: Asset line to check

        Returns:
            bool: True if this is a common resource line
        """
        common_patterns = [
            "common/launch",
            "common/icons",
            "assets/common/launch",
            "assets/common/icons"
        ]

        for pattern in common_patterns:
            if pattern in line:
                PrintHelper.info(f"Detected common resource pattern '{pattern}' - these assets are managed by image replacement steps, not pubspec.yaml", source=self.step_name)
                return True

        return False

    def _read_pubspec_content(self) -> Optional[List[str]]:
        """
        Read pubspec.yaml content as list of lines

        Returns:
            Optional[List[str]]: Lines of pubspec.yaml or None if failed
        """
        try:
            with open(self.pubspec_path, 'r', encoding='utf-8') as f:
                content = f.readlines()

            PrintHelper.info(f"Read {len(content)} lines from pubspec.yaml", source=self.step_name)
            return content

        except Exception as e:
            PrintHelper.error(f"Failed to read pubspec.yaml: {e}", source=self.step_name)
            return None

    def _write_pubspec_content(self, content: List[str]) -> bool:
        """
        Write updated content back to pubspec.yaml

        Args:
            content: Updated content lines

        Returns:
            bool: True if successful, False otherwise
        """
        try:
            with open(self.pubspec_path, 'w', encoding='utf-8') as f:
                f.writelines(content)

            PrintHelper.info(f"Written {len(content)} lines to pubspec.yaml", source=self.step_name)
            return True

        except Exception as e:
            PrintHelper.error(f"Failed to write pubspec.yaml: {e}", source=self.step_name)
            return False

    def _process_asset_lines(self, content: List[str], app_patterns: List[str], target_app_suffix: str) -> Tuple[List[str], bool]:
        """
        Process asset lines in pubspec.yaml content

        Args:
            content: Original content lines
            app_patterns: List of patterns to search for
            target_app_suffix: Target app suffix for enabling

        Returns:
            Tuple[List[str], bool]: (Updated content, whether changes were made)
        """
        updated_content = []
        changes_made = False

        PrintHelper.info(f"Processing {len(content)} lines for asset management", source=self.step_name)

        for line_num, line in enumerate(content, 1):
            original_line = line
            processed_line = line

            # Only process asset lines (containing "assets/" and "- ")
            if "assets/" in line and "- " in line:
                # Check if line contains any app pattern
                matched_patterns = []
                for pattern in app_patterns:
                    if pattern in line:
                        matched_patterns.append(pattern)

                # Also check for any app names (app_xxx format) in asset lines
                app_name_matches = []
                app_name_pattern = r'app_\w+'
                app_matches = re.findall(app_name_pattern, line)
                for match in app_matches:
                    app_name_matches.append(match)

                # Also check for .extra_xxx format
                extra_pattern = r'\.extra_\w+'
                extra_matches = re.findall(extra_pattern, line)

            # Process this line if it's an asset line with app-related content
            if "assets/" in line and "- " in line and (matched_patterns or app_name_matches or extra_matches):
                # This line contains app-related patterns
                is_target_app = self._is_target_app_line(line, target_app_suffix, app_patterns)

                # Get line without leading whitespace for comment checking
                stripped_line = line.lstrip()
                is_commented = stripped_line.startswith('#')

                PrintHelper.debug(f"Line {line_num}: {'Target' if is_target_app else 'Other'} app, "
                                f"{'Commented' if is_commented else 'Active'}: {line.strip()}", source=self.step_name)

                if is_target_app:
                    # This is the target app - should be uncommented (active)
                    if is_commented:
                        # Remove the comment
                        processed_line = self._uncomment_line(line)
                        changes_made = True
                        PrintHelper.info(f"Line {line_num}: Enabled target app asset: {processed_line.strip()}", source=self.step_name)
                else:
                    # This is another app - should be commented (inactive)
                    if not is_commented:
                        # Add comment
                        processed_line = self._comment_line(line)
                        changes_made = True
                        PrintHelper.info(f"Line {line_num}: Disabled other app asset: {processed_line.strip()}", source=self.step_name)

            updated_content.append(processed_line)

        PrintHelper.info(f"Asset processing complete. Changes made: {changes_made}", source=self.step_name)
        return updated_content, changes_made

    def _is_target_app_line(self, line: str, target_app_suffix: str, app_patterns: List[str]) -> bool:
        """
        Check if a line belongs to the target app

        Args:
            line: Line to check
            target_app_suffix: Target app suffix
            app_patterns: Target app patterns

        Returns:
            bool: True if line belongs to target app
        """
        # Only check asset lines (containing "assets/" and "-")
        if "assets/" not in line or "- " not in line:
            return False

        # Check for target app patterns
        for pattern in app_patterns:
            if pattern in line:
                return True

        return False

    def _comment_line(self, line: str) -> str:
        """
        Add comment to a line while preserving indentation

        Args:
            line: Original line

        Returns:
            str: Commented line
        """
        # Find the indentation
        stripped = line.lstrip()
        indent = line[:len(line) - len(stripped)]

        # Add comment after indentation
        return f"{indent}# {stripped}"

    def _uncomment_line(self, line: str) -> str:
        """
        Remove comment from a line while preserving indentation

        Args:
            line: Original commented line

        Returns:
            str: Uncommented line
        """
        # Find the indentation
        stripped = line.lstrip()
        indent = line[:len(line) - len(stripped)]

        # Remove comment marker and any following space
        if stripped.startswith('# '):
            uncommented = stripped[2:]  # Remove '# '
        elif stripped.startswith('#'):
            uncommented = stripped[1:]  # Remove '#'
        else:
            uncommented = stripped  # No comment marker found

        return f"{indent}{uncommented}"

    def _generate_summary(self, changes_made: bool, target_app_suffix: str, total_apps: int) -> Dict[str, Any]:
        """Generate summary of pubspec processing"""
        return {
            'target_app': target_app_suffix,
            'total_apps_processed': total_apps,
            'changes_made': changes_made,
            'pubspec_updated': changes_made,
            'action_taken': f'Enabled assets for {target_app_suffix}, disabled {total_apps-1} other apps' if changes_made else 'No changes needed'
        }

    def _create_error_result(self, error_msg: str) -> Dict[str, Any]:
        """Create error result"""
        return {
            'success': False,
            'step': 8,
            'step_name': self.step_name,
            'step_description': self.step_description,
            'error': error_msg,
            'pubspec_path': str(self.pubspec_path) if self.pubspec_path else '',
            'summary': {}
        }

    def get_results(self) -> Dict[str, Any]:
        """Get the results of Step 8 execution"""
        return self.results

    def print_step8_summary(self) -> None:
        """Print a concise summary of Step 8 results"""
        try:
            if not self.results:
                PrintHelper.info(f"[SUMMARY] No results available", source=self.step_name)
                return

            PrintHelper.info(f"\n[SUMMARY] STEP 8 COMPLETION SUMMARY", source=self.step_name)
            PrintHelper.info(f"{'-' * 60}")

            if self.results.get('success', False):
                PrintHelper.info(f"Status: SUCCESS", source=self.step_name)
                PrintHelper.info(f"Target App: {self.results.get('target_app_suffix', 'N/A')}", source=self.step_name)
                PrintHelper.info(f"Changes Made: {self.results.get('changes_made', False)}", source=self.step_name)
                PrintHelper.info(f"Pubspec Path: {self.results.get('pubspec_path', 'N/A')}", source=self.step_name)

                summary = self.results.get('summary', {})
                action = summary.get('action_taken', 'N/A')
                PrintHelper.info(f"Action: {action}", source=self.step_name)

            else:
                PrintHelper.info(f"Status: FAILED", source=self.step_name)
                PrintHelper.info(f"Error: {self.results.get('error', 'Unknown error')}", source=self.step_name)

            PrintHelper.info(f"{'-' * 60}")

        except Exception as e:
            PrintHelper.error(f"Failed to print summary: {e}", source=self.step_name)


def main():
    """Main function for testing Step 8 controller"""
    PrintHelper.info("[TEST] Step 8 Pubspec Controller - Standalone Test", source="STEP-8")

    # Test with current directory
    current_dir = Path.cwd()
    controller = Step8PubspecController()

    if controller.initialize(current_dir, "app_achat"):
        results = controller.execute()
        controller.print_step8_summary()
    else:
        PrintHelper.info("[TEST] Initialization failed", source="STEP-8")


if __name__ == "__main__":
    main()