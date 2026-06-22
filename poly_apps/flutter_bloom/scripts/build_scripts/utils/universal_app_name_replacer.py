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
Universal App Name Replacer - Enhanced Multi-Platform Application Name Replacement Engine

Supports recursive scanning and regex-based replacement for:
- Android (AndroidManifest.xml, build.gradle, strings.xml)
- iOS (Info.plist, xcconfig, InfoPlist.strings)
- macOS (Info.plist, xcconfig)
- Linux (CMakeLists.txt, .desktop)
- Windows (CMakeLists.txt, .rc)
- Web (index.html, manifest.json)
"""

import os
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any, Set
from dataclasses import dataclass, field


@dataclass
class RegexRule:
    """Defines a regex-based replacement rule"""
    pattern: str
    file_pattern: str
    description: str
    use_cn_for_chinese_files: bool = True


@dataclass
class ReplacementConfig:
    """Configuration for app name replacement"""
    package_id: str
    app_name_en: str
    app_name_cn: str
    app_name_default: str = None

    def __post_init__(self):
        if self.app_name_default is None:
            self.app_name_default = self.app_name_en


@dataclass
class ReplacementResult:
    """Result of a single file replacement operation"""
    file_path: str
    platform: str
    success: bool
    replacements_made: int = 0
    changes: List[str] = field(default_factory=list)
    error: Optional[str] = None


@dataclass
class PlatformScanResult:
    """Result of scanning and replacing for a platform"""
    platform: str
    files_scanned: int = 0
    files_modified: int = 0
    total_replacements: int = 0
    results: List[ReplacementResult] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)


class UniversalAppNameReplacer:
    """
    Universal regex-based application name replacement engine

    Uses powerful regex patterns to find and replace app names across all platforms.
    Automatically detects Chinese locale files and uses appropriate app name.
    """

    def __init__(self, config: ReplacementConfig):
        self.config = config

        self.skip_dirs = {
            '.git', '.gradle', '.dart_tool', 'build', 'node_modules',
            '__pycache__', '.idea', '.vscode', 'Pods', 'DerivedData',
            'xcuserdata', '.vs', 'obj', 'bin', 'target', 'dist'
        }

        self.binary_extensions = {
            '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.ico',
            '.so', '.dll', '.exe', '.bin', '.jar', '.zip', '.tar',
            '.gz', '.7z', '.rar', '.class', '.dex', '.dylib', '.a',
            '.ttf', '.otf', '.woff', '.woff2', '.eot'
        }

        self.text_extensions = {
            '.xml', '.gradle', '.java', '.kt', '.kts', '.swift', '.m', '.h',
            '.plist', '.strings', '.xcconfig', '.cmake', '.txt', '.rc',
            '.html', '.json', '.js', '.ts', '.dart', '.yaml', '.yml',
            '.ini', '.properties', '.desktop', '.md', '.sh', '.bat', '.ps1'
        }

        self.regex_rules = self._build_regex_rules()

    def _is_chinese_locale_file(self, file_path: Path) -> bool:
        """Check if file is in Chinese locale directory using regex"""
        path_str = str(file_path)
        chinese_patterns = [
            r'[/\\]values-zh[/\\]',
            r'[/\\]zh-Hans\.lproj[/\\]',
            r'[/\\]zh-Hant\.lproj[/\\]',
            r'[/\\]zh\.lproj[/\\]',
            r'[/\\]zh_CN[/\\]',
            r'[/\\]zh_TW[/\\]'
        ]
        return any(re.search(pattern, path_str) for pattern in chinese_patterns)

    def _build_regex_rules(self) -> List[RegexRule]:
        """Build comprehensive regex rules for all platforms"""
        rules = []

        rules.append(RegexRule(
            pattern=r'(<string\s+name=["\']app_name["\']>)([^<]+)(</string>)',
            file_pattern='**/strings.xml',
            description='Android strings.xml app_name'
        ))

        rules.append(RegexRule(
            pattern=r'(android:label\s*=\s*["\'])([^"\']+)(["\'])',
            file_pattern='**/AndroidManifest.xml',
            description='Android AndroidManifest.xml label'
        ))

        rules.append(RegexRule(
            pattern=r'(resValue\s+["\']string["\']\s*,\s*["\']app_name["\']\s*,\s*["\'])([^"\']+)(["\'])',
            file_pattern='**/build.gradle',
            description='Android build.gradle resValue'
        ))

        rules.append(RegexRule(
            pattern=r'(CFBundleDisplayName\s*=\s*["\'])([^"\']+)(["\'];)',
            file_pattern='**/*.strings',
            description='iOS InfoPlist.strings CFBundleDisplayName'
        ))

        rules.append(RegexRule(
            pattern=r'(CFBundleName\s*=\s*["\'])([^"\']+)(["\'];)',
            file_pattern='**/*.strings',
            description='iOS InfoPlist.strings CFBundleName'
        ))

        rules.append(RegexRule(
            pattern=r'(<key>CFBundleDisplayName</key>\s*<string>)([^<]+)(</string>)',
            file_pattern='**/Info.plist',
            description='iOS Info.plist CFBundleDisplayName'
        ))

        rules.append(RegexRule(
            pattern=r'(<key>CFBundleName</key>\s*<string>)([^<]+)(</string>)',
            file_pattern='**/Info.plist',
            description='iOS Info.plist CFBundleName'
        ))

        rules.append(RegexRule(
            pattern=r'(PRODUCT_NAME\s*=\s*)([^;\s]+)(;)',
            file_pattern='**/*.xcconfig',
            description='iOS xcconfig PRODUCT_NAME'
        ))

        rules.append(RegexRule(
            pattern=r'(<title>)([^<]+)(</title>)',
            file_pattern='**/index.html',
            description='Web index.html title'
        ))

        rules.append(RegexRule(
            pattern=r'(["\']name["\']\s*:\s*["\'])([^"\']+)(["\'])',
            file_pattern='**/manifest.json',
            description='Web manifest.json name'
        ))

        rules.append(RegexRule(
            pattern=r'(["\']short_name["\']\s*:\s*["\'])([^"\']+)(["\'])',
            file_pattern='**/manifest.json',
            description='Web manifest.json short_name'
        ))

        rules.append(RegexRule(
            pattern=r'(set\s*\(\s*BINARY_NAME\s+["\'])([^"\']+)(["\'])',
            file_pattern='**/CMakeLists.txt',
            description='Linux/Windows CMakeLists.txt BINARY_NAME'
        ))

        rules.append(RegexRule(
            pattern=r'(set\s*\(\s*APPLICATION_NAME\s+["\'])([^"\']+)(["\'])',
            file_pattern='**/CMakeLists.txt',
            description='Linux/Windows CMakeLists.txt APPLICATION_NAME'
        ))

        rules.append(RegexRule(
            pattern=r'(^Name\s*=\s*)(.+)($)',
            file_pattern='**/*.desktop',
            description='Linux .desktop file Name'
        ))

        return rules

    def _should_skip_path(self, path: Path) -> bool:
        """Check if path should be skipped"""
        for skip_dir in self.skip_dirs:
            if skip_dir in path.parts:
                return True
        return False

    def _is_text_file(self, file_path: Path) -> bool:
        """Check if file is a text file based on extension"""
        if file_path.suffix.lower() in self.binary_extensions:
            return False
        if file_path.suffix.lower() in self.text_extensions:
            return True
        if not file_path.suffix:
            return True
        return False

    def _match_file_pattern(self, file_path: Path, pattern: str) -> bool:
        """Check if file matches glob pattern"""
        from fnmatch import fnmatch
        path_str = str(file_path).replace('\\', '/')
        return fnmatch(path_str, pattern.replace('\\', '/'))

    def _replace_in_file(self, file_path: Path, platform: str) -> ReplacementResult:
        """
        Perform regex-based replacements in a single file

        Args:
            file_path: Path to file
            platform: Platform name

        Returns:
            Replacement result
        """
        result = ReplacementResult(
            file_path=str(file_path),
            platform=platform,
            success=False
        )

        try:
            content = file_path.read_text(encoding='utf-8', errors='ignore')
            original_content = content
            total_replacements = 0

            is_chinese_locale = self._is_chinese_locale_file(file_path)
            new_name = self.config.app_name_cn if is_chinese_locale else self.config.app_name_en

            for rule in self.regex_rules:
                if not self._match_file_pattern(file_path, rule.file_pattern):
                    continue

                matches = list(re.finditer(rule.pattern, content, re.MULTILINE))
                if matches:
                    for match in reversed(matches):
                        if len(match.groups()) >= 3:
                            prefix = match.group(1)
                            old_value = match.group(2)
                            suffix = match.group(3)

                            replacement = f"{prefix}{new_name}{suffix}"
                            content = content[:match.start()] + replacement + content[match.end():]
                            total_replacements += 1

                    result.changes.append(f"{rule.description}: {len(matches)} replacements")

            if total_replacements > 0:
                file_path.write_text(content, encoding='utf-8')
                result.success = True
                result.replacements_made = total_replacements
            else:
                result.success = True
                result.replacements_made = 0

        except Exception as e:
            result.success = False
            result.error = str(e)

        return result

    def replace_platform(self, platform: str, platform_dir: Path) -> PlatformScanResult:
        """
        Replace app names in all text files within a platform directory using regex rules

        Args:
            platform: Platform name
            platform_dir: Platform directory path

        Returns:
            Scan result with statistics
        """
        result = PlatformScanResult(platform=platform)

        print(f"[REPLACER] Processing {platform} directory: {platform_dir}")
        print(f"[REPLACER] Using {len(self.regex_rules)} regex rules for replacement")

        files_processed = []

        for file_path in platform_dir.rglob('*'):
            if not file_path.is_file():
                continue

            if self._should_skip_path(file_path):
                continue

            if not self._is_text_file(file_path):
                continue

            file_result = self._replace_in_file(file_path, platform)
            result.results.append(file_result)
            files_processed.append(file_path)

            if file_result.success and file_result.replacements_made > 0:
                result.files_modified += 1
                result.total_replacements += file_result.replacements_made
                print(f"[REPLACER]   [OK] {file_path.name}: {file_result.replacements_made} replacements")

            if not file_result.success:
                result.errors.append(f"{file_path}: {file_result.error}")

        result.files_scanned = len(files_processed)
        print(f"[REPLACER] {platform} summary: {result.files_scanned} files scanned, {result.files_modified} files modified, {result.total_replacements} total replacements")

        return result

    def replace_all_platforms(self, build_root: Path) -> Dict[str, PlatformScanResult]:
        """
        Replace app names across all platforms

        Args:
            build_root: Root directory of the build (contains android/, ios/, etc.)

        Returns:
            Dictionary mapping platform name to scan results
        """
        results = {}

        print(f"\n[REPLACER] ======== Universal App Name Replacer ========")
        print(f"[REPLACER] Configuration:")
        print(f"[REPLACER]   Package ID: {self.config.package_id}")
        print(f"[REPLACER]   App Name (EN): {self.config.app_name_en}")
        print(f"[REPLACER]   App Name (CN): {self.config.app_name_cn}")
        print(f"[REPLACER] Scanning build root: {build_root}")
        print(f"[REPLACER] Build root exists: {build_root.exists()}")

        for platform in ['android', 'ios', 'macos', 'linux', 'windows', 'web']:
            platform_dir = build_root / platform
            print(f"[REPLACER] Checking {platform} directory: {platform_dir}")
            print(f"[REPLACER] {platform} directory exists: {platform_dir.exists()}")

            if platform_dir.exists():
                results[platform] = self.replace_platform(platform, platform_dir)
            else:
                results[platform] = PlatformScanResult(
                    platform=platform,
                    errors=[f"Platform directory not found: {platform_dir}"]
                )

        return results

    def print_summary(self, results: Dict[str, PlatformScanResult], step_name: str = "APP-NAME-REPLACEMENT"):
        """
        Print a detailed summary of replacement results

        Args:
            results: Dictionary of platform results
            step_name: Step name for logging prefix
        """
        print(f"[{step_name}] {'='*70}")
        print(f"[{step_name}] Universal App Name Replacement Summary")
        print(f"[{step_name}] {'='*70}")

        total_files_scanned = 0
        total_files_modified = 0
        total_replacements = 0

        for platform, result in results.items():
            print(f"[{step_name}] ")
            print(f"[{step_name}] Platform: {platform.upper()}")
            print(f"[{step_name}]   Files scanned: {result.files_scanned}")
            print(f"[{step_name}]   Files modified: {result.files_modified}")
            print(f"[{step_name}]   Total replacements: {result.total_replacements}")

            if result.errors:
                print(f"[{step_name}]   Errors: {len(result.errors)}")
                for error in result.errors[:3]:  # Show first 3 errors
                    print(f"[{step_name}]     - {error}")
                if len(result.errors) > 3:
                    print(f"[{step_name}]     ... and {len(result.errors) - 3} more errors")

            # Show modified files
            modified_files = [r for r in result.results if r.replacements_made > 0]
            if modified_files:
                print(f"[{step_name}]   Modified files:")
                for file_result in modified_files[:5]:  # Show first 5
                    rel_path = Path(file_result.file_path).name
                    print(f"[{step_name}]     [OK] {rel_path}: {file_result.replacements_made} changes")
                if len(modified_files) > 5:
                    print(f"[{step_name}]     ... and {len(modified_files) - 5} more files")

            total_files_scanned += result.files_scanned
            total_files_modified += result.files_modified
            total_replacements += result.total_replacements

        print(f"[{step_name}] ")
        print(f"[{step_name}] {'='*70}")
        print(f"[{step_name}] OVERALL TOTALS:")
        print(f"[{step_name}]   Total files scanned: {total_files_scanned}")
        print(f"[{step_name}]   Total files modified: {total_files_modified}")
        print(f"[{step_name}]   Total replacements: {total_replacements}")
        print(f"[{step_name}] {'='*70}")
