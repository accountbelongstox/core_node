#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pre-Build Checker
Comprehensive checks before compilation to ensure everything is ready
Provides detailed prompts for AI to fix issues
"""

import os
import json
import subprocess
import platform
import configparser
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass

from utils.key_center import (
    VERSION_CONFIG,
    get_java_requirements,
    KEY_REQUIRED_JAVA_VERSION,
    KEY_REQUIRED_AGP_VERSION,
    KEY_REQUIRED_GRADLE_VERSION,
    KEY_REQUIRED_COMPILE_SDK,
    KEY_REQUIRED_TARGET_SDK
)


@dataclass
class CheckResult:
    """Result of a single check"""
    name: str
    passed: bool
    message: str
    severity: str  # 'error', 'warning', 'info'
    fix_suggestions: List[str] = None
    file_paths: List[str] = None


class PreBuildChecker:
    """Comprehensive pre-build checker"""
    
    def __init__(self, project_root: Path, android_path: Path, assets_path: Path, build_config_path: Path):
        """
        Initialize pre-build checker
        
        Args:
            project_root: Root directory of the project
            android_path: Android platform directory
            assets_path: Assets directory
            build_config_path: build_config.ini path
        """
        self.project_root = project_root
        self.android_path = android_path
        self.assets_path = assets_path
        self.build_config_path = build_config_path
        self.package_json_path = project_root / "package.json"
        self.capacitor_config_path = project_root / "capacitor.config.ts"
        self.android_manifest_path = android_path / "app" / "src" / "main" / "AndroidManifest.xml"
        
        self.checks: List[CheckResult] = []
        self.version_config = VERSION_CONFIG
        self.java_req = get_java_requirements()
    
    def run_all_checks(self) -> Tuple[bool, List[CheckResult]]:
        """
        Run all pre-build checks
        
        Returns:
            Tuple of (all_passed, list of check results)
        """
        self.checks = []
        
        # 1. Platform checks
        self._check_android_platform()
        self._check_package_json()
        self._check_capacitor_config()
        
        # 2. Configuration checks
        self._check_build_config()
        self._check_android_manifest()
        
        # 3. Resource checks
        self._check_resource_files()
        
        # 4. Dependency checks
        self._check_node_modules()
        self._check_capacitor_version()
        
        # 5. Android build configuration checks
        self._check_gradle_files()
        self._check_java_version()
        self._check_android_sdk_versions()
        
        # 6. Code quality checks
        self._check_safe_area_config()
        self._check_status_bar_config()
        
        # Determine if all critical checks passed
        critical_errors = [c for c in self.checks if c.severity == 'error' and not c.passed]
        all_passed = len(critical_errors) == 0
        
        return all_passed, self.checks
    
    def _check_android_platform(self):
        """Check if Android platform exists"""
        if not self.android_path.exists():
            self.checks.append(CheckResult(
                name="Android Platform",
                passed=False,
                severity="error",
                message="Android platform directory not found",
                fix_suggestions=[
                    "Run 'npx cap add android' to add Android platform",
                    "Or use build script Option 1: Install Capacitor"
                ],
                file_paths=[str(self.android_path)]
            ))
        else:
            self.checks.append(CheckResult(
                name="Android Platform",
                passed=True,
                severity="info",
                message=f"Android platform found at {self.android_path}"
            ))
    
    def _check_package_json(self):
        """Check package.json exists and has required dependencies"""
        if not self.package_json_path.exists():
            self.checks.append(CheckResult(
                name="package.json",
                passed=False,
                severity="error",
                message="package.json not found",
                fix_suggestions=[
                    "Ensure you are in the correct project directory",
                    "Run 'npm init' or 'pnpm init' to create package.json"
                ],
                file_paths=[str(self.package_json_path)]
            ))
            return
        
        try:
            with open(self.package_json_path, 'r', encoding='utf-8') as f:
                package_data = json.load(f)
            
            # Check for Capacitor core
            deps = {**package_data.get('dependencies', {}), **package_data.get('devDependencies', {})}
            required_packages = [
                '@capacitor/core',
                '@capacitor/android',
                '@capacitor/cli'
            ]
            
            missing = [pkg for pkg in required_packages if pkg not in deps]
            
            if missing:
                self.checks.append(CheckResult(
                    name="package.json Dependencies",
                    passed=False,
                    severity="error",
                    message=f"Missing required Capacitor packages: {', '.join(missing)}",
                    fix_suggestions=[
                        f"Run 'pnpm add {' '.join(missing)}'",
                        "Or use build script Option 1: Install Capacitor"
                    ],
                    file_paths=[str(self.package_json_path)]
                ))
            else:
                self.checks.append(CheckResult(
                    name="package.json Dependencies",
                    passed=True,
                    severity="info",
                    message="All required Capacitor packages found"
                ))
        except Exception as e:
            self.checks.append(CheckResult(
                name="package.json",
                passed=False,
                severity="error",
                message=f"Error reading package.json: {str(e)}",
                fix_suggestions=["Check package.json syntax"],
                file_paths=[str(self.package_json_path)]
            ))
    
    def _check_capacitor_config(self):
        """Check capacitor.config.ts exists and is valid"""
        if not self.capacitor_config_path.exists():
            self.checks.append(CheckResult(
                name="capacitor.config.ts",
                passed=False,
                severity="error",
                message="capacitor.config.ts not found",
                fix_suggestions=[
                    "Run 'npx cap init' to create capacitor.config.ts",
                    "Or use build script Option 1: Install Capacitor"
                ],
                file_paths=[str(self.capacitor_config_path)]
            ))
            return
        
        try:
            with open(self.capacitor_config_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Basic validation
            if 'appId' not in content:
                self.checks.append(CheckResult(
                    name="capacitor.config.ts",
                    passed=False,
                    severity="warning",
                    message="capacitor.config.ts may be missing appId",
                    fix_suggestions=[
                        "Ensure capacitor.config.ts contains appId field",
                        "Example: appId: 'com.example.app'"
                    ],
                    file_paths=[str(self.capacitor_config_path)]
                ))
            else:
                self.checks.append(CheckResult(
                    name="capacitor.config.ts",
                    passed=True,
                    severity="info",
                    message="capacitor.config.ts found and appears valid"
                ))
        except Exception as e:
            self.checks.append(CheckResult(
                name="capacitor.config.ts",
                passed=False,
                severity="error",
                message=f"Error reading capacitor.config.ts: {str(e)}",
                file_paths=[str(self.capacitor_config_path)]
            ))
    
    def _check_build_config(self):
        """Check build_config.ini exists and has required sections"""
        if not self.build_config_path.exists():
            self.checks.append(CheckResult(
                name="build_config.ini",
                passed=False,
                severity="warning",
                message="build_config.ini not found - will use defaults",
                fix_suggestions=[
                    "Run build script to auto-generate build_config.ini",
                    "Or manually create build_config.ini with required sections"
                ],
                file_paths=[str(self.build_config_path)]
            ))
            return
        
        try:
            config = configparser.ConfigParser()
            config.read(str(self.build_config_path), encoding='utf-8')
            
            required_sections = ['app_info']
            missing_sections = [s for s in required_sections if s not in config]
            
            if missing_sections:
                self.checks.append(CheckResult(
                    name="build_config.ini",
                    passed=False,
                    severity="warning",
                    message=f"Missing sections: {', '.join(missing_sections)}",
                    fix_suggestions=[
                        f"Add [{s}] section to build_config.ini" for s in missing_sections
                    ],
                    file_paths=[str(self.build_config_path)]
                ))
            else:
                self.checks.append(CheckResult(
                    name="build_config.ini",
                    passed=True,
                    severity="info",
                    message="build_config.ini found with required sections"
                ))
        except Exception as e:
            self.checks.append(CheckResult(
                name="build_config.ini",
                passed=False,
                severity="warning",
                message=f"Error reading build_config.ini: {str(e)}",
                file_paths=[str(self.build_config_path)]
            ))
    
    def _check_android_manifest(self):
        """Check AndroidManifest.xml exists and has required configurations"""
        if not self.android_path.exists():
            return  # Skip if Android platform doesn't exist
        
        if not self.android_manifest_path.exists():
            self.checks.append(CheckResult(
                name="AndroidManifest.xml",
                passed=False,
                severity="error",
                message="AndroidManifest.xml not found",
                fix_suggestions=[
                    "Run 'npx cap sync android' to generate AndroidManifest.xml",
                    "Or re-add Android platform"
                ],
                file_paths=[str(self.android_manifest_path)]
            ))
            return
        
        try:
            with open(self.android_manifest_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            issues = []
            suggestions = []
            
            # Check for fitsSystemWindows (safe area support)
            if 'fitsSystemWindows' not in content:
                issues.append("Missing android:fitsSystemWindows=\"true\"")
                suggestions.append(
                    "Add android:fitsSystemWindows=\"true\" to MainActivity in AndroidManifest.xml"
                )
            
            # Check for required permissions
            if 'INTERNET' not in content:
                issues.append("Missing INTERNET permission")
                suggestions.append(
                    "Add <uses-permission android:name=\"android.permission.INTERNET\" />"
                )
            
            if issues:
                self.checks.append(CheckResult(
                    name="AndroidManifest.xml Configuration",
                    passed=False,
                    severity="warning",
                    message=f"Issues found: {', '.join(issues)}",
                    fix_suggestions=suggestions,
                    file_paths=[str(self.android_manifest_path)]
                ))
            else:
                self.checks.append(CheckResult(
                    name="AndroidManifest.xml Configuration",
                    passed=True,
                    severity="info",
                    message="AndroidManifest.xml appears correctly configured"
                ))
        except Exception as e:
            self.checks.append(CheckResult(
                name="AndroidManifest.xml",
                passed=False,
                severity="error",
                message=f"Error reading AndroidManifest.xml: {str(e)}",
                file_paths=[str(self.android_manifest_path)]
            ))
    
    def _check_resource_files(self):
        """Check if required resource files exist"""
        if not self.build_config_path.exists():
            return  # Skip if no build config
        
        try:
            config = configparser.ConfigParser()
            config.read(str(self.build_config_path), encoding='utf-8')
            
            if 'app_info' not in config:
                return
            
            app_logo_src = config['app_info'].get('app_logo_src', 'logo.png')
            splash_src = config['app_info'].get('splash_src', 'splash.png')
            
            logo_path = self.assets_path / app_logo_src
            splash_path = self.assets_path / splash_src
            
            missing = []
            suggestions = []
            
            if not logo_path.exists():
                missing.append(f"App logo: {app_logo_src}")
                suggestions.append(f"Place {app_logo_src} in {self.assets_path}")
            
            if not splash_path.exists():
                missing.append(f"Splash screen: {splash_src}")
                suggestions.append(f"Place {splash_src} in {self.assets_path}")
            
            if missing:
                self.checks.append(CheckResult(
                    name="Resource Files",
                    passed=False,
                    severity="error",
                    message=f"Missing resource files: {', '.join(missing)}",
                    fix_suggestions=suggestions,
                    file_paths=[str(logo_path), str(splash_path)]
                ))
            else:
                self.checks.append(CheckResult(
                    name="Resource Files",
                    passed=True,
                    severity="info",
                    message="All required resource files found"
                ))
        except Exception as e:
            self.checks.append(CheckResult(
                name="Resource Files",
                passed=False,
                severity="warning",
                message=f"Could not check resource files: {str(e)}"
            ))
    
    def _check_node_modules(self):
        """Check if node_modules exists"""
        node_modules_path = self.project_root / "node_modules"
        
        if not node_modules_path.exists():
            self.checks.append(CheckResult(
                name="node_modules",
                passed=False,
                severity="error",
                message="node_modules directory not found",
                fix_suggestions=[
                    "Run 'pnpm install' to install dependencies",
                    "Or use build script Option 1: Install Capacitor"
                ],
                file_paths=[str(node_modules_path)]
            ))
        else:
            # Check if @capacitor packages are installed
            capacitor_core = node_modules_path / "@capacitor" / "core"
            if not capacitor_core.exists():
                self.checks.append(CheckResult(
                    name="node_modules",
                    passed=False,
                    severity="error",
                    message="Capacitor packages not installed in node_modules",
                    fix_suggestions=[
                        "Run 'pnpm install' to install dependencies"
                    ],
                    file_paths=[str(node_modules_path)]
                ))
            else:
                self.checks.append(CheckResult(
                    name="node_modules",
                    passed=True,
                    severity="info",
                    message="node_modules found with Capacitor packages"
                ))
    
    def _check_capacitor_version(self):
        """Check Capacitor version compatibility"""
        try:
            package_json_path = self.project_root / "package.json"
            if not package_json_path.exists():
                return
            
            with open(package_json_path, 'r', encoding='utf-8') as f:
                package_data = json.load(f)
            
            deps = {**package_data.get('dependencies', {}), **package_data.get('devDependencies', {})}
            core_version = deps.get('@capacitor/core', '')
            
            if not core_version:
                self.checks.append(CheckResult(
                    name="Capacitor Version",
                    passed=False,
                    severity="error",
                    message="@capacitor/core not found in package.json",
                    fix_suggestions=[
                        "Add @capacitor/core to package.json dependencies"
                    ]
                ))
                return
            
            # Extract major version
            try:
                major_version = int(core_version.replace('^', '').split('.')[0])
                required_major = self.version_config['capacitor']['required_major_version']
                
                if major_version < required_major:
                    self.checks.append(CheckResult(
                        name="Capacitor Version",
                        passed=False,
                        severity="warning",
                        message=f"Capacitor version {major_version}.x may be outdated (recommended: {required_major}.x+)",
                        fix_suggestions=[
                            f"Update @capacitor/core to ^{required_major}.0.0",
                            "Run 'pnpm update @capacitor/core @capacitor/android @capacitor/cli'"
                        ]
                    ))
                else:
                    self.checks.append(CheckResult(
                        name="Capacitor Version",
                        passed=True,
                        severity="info",
                        message=f"Capacitor version {major_version}.x is compatible"
                    ))
            except ValueError:
                self.checks.append(CheckResult(
                    name="Capacitor Version",
                    passed=False,
                    severity="warning",
                    message=f"Could not parse Capacitor version: {core_version}",
                    fix_suggestions=["Check package.json version format"]
                ))
        except Exception as e:
            self.checks.append(CheckResult(
                name="Capacitor Version",
                passed=False,
                severity="warning",
                message=f"Error checking Capacitor version: {str(e)}"
            ))
    
    def _check_gradle_files(self):
        """Check Gradle configuration files"""
        if not self.android_path.exists():
            return
        
        gradle_wrapper_props = self.android_path / "gradle" / "wrapper" / "gradle-wrapper.properties"
        build_gradle = self.android_path / "build.gradle"
        app_build_gradle = self.android_path / "app" / "build.gradle"
        
        missing = []
        if not gradle_wrapper_props.exists():
            missing.append("gradle-wrapper.properties")
        if not build_gradle.exists():
            missing.append("build.gradle (project)")
        if not app_build_gradle.exists():
            missing.append("build.gradle (app)")
        
        if missing:
            self.checks.append(CheckResult(
                name="Gradle Files",
                passed=False,
                severity="error",
                message=f"Missing Gradle files: {', '.join(missing)}",
                fix_suggestions=[
                    "Run 'npx cap sync android' to regenerate Gradle files",
                    "Or re-add Android platform"
                ],
                file_paths=[str(self.android_path)]
            ))
        else:
            self.checks.append(CheckResult(
                name="Gradle Files",
                passed=True,
                severity="info",
                message="Gradle configuration files found"
            ))
    
    def _check_java_version(self):
        """Check Java version"""
        try:
            result = subprocess.run(
                ['java', '-version'],
                capture_output=True,
                text=True,
                stderr=subprocess.STDOUT,
                timeout=5
            )
            
            if result.returncode != 0:
                self.checks.append(CheckResult(
                    name="Java Installation",
                    passed=False,
                    severity="error",
                    message="Java is not installed or not in PATH",
                    fix_suggestions=[
                        f"Install Java {self.java_req.get(KEY_REQUIRED_JAVA_VERSION, '17')}+",
                        "Download from: https://adoptium.net/",
                        "Or use Android Studio's bundled JDK"
                    ]
                ))
                return
            
            # Parse Java version from output
            output = result.stdout or result.stderr
            version_info = self.java_req.get(KEY_REQUIRED_JAVA_VERSION, '17')
            
            self.checks.append(CheckResult(
                name="Java Installation",
                passed=True,
                severity="info",
                message=f"Java is installed (check version manually - requires {version_info}+)"
            ))
        except (subprocess.TimeoutExpired, FileNotFoundError):
            self.checks.append(CheckResult(
                name="Java Installation",
                passed=False,
                severity="error",
                message="Java command not found",
                fix_suggestions=[
                    f"Install Java {self.java_req.get(KEY_REQUIRED_JAVA_VERSION, '17')}+",
                    "Add Java to PATH environment variable"
                ]
            ))
        except Exception as e:
            self.checks.append(CheckResult(
                name="Java Installation",
                passed=False,
                severity="warning",
                message=f"Could not check Java version: {str(e)}"
            ))
    
    def _check_android_sdk_versions(self):
        """Check Android SDK version configuration"""
        if not self.android_path.exists():
            return
        
        app_build_gradle = self.android_path / "app" / "build.gradle"
        if not app_build_gradle.exists():
            return
        
        try:
            with open(app_build_gradle, 'r', encoding='utf-8') as f:
                content = f.read()
            
            required_compile_sdk = self.java_req.get(KEY_REQUIRED_COMPILE_SDK, '35')
            required_target_sdk = self.java_req.get(KEY_REQUIRED_TARGET_SDK, '35')
            
            issues = []
            suggestions = []
            
            if f'compileSdk {required_compile_sdk}' not in content and f'compileSdkVersion {required_compile_sdk}' not in content:
                issues.append(f"compileSdk should be {required_compile_sdk}")
                suggestions.append(f"Update compileSdk to {required_compile_sdk} in app/build.gradle")
            
            if f'targetSdk {required_target_sdk}' not in content and f'targetSdkVersion {required_target_sdk}' not in content:
                issues.append(f"targetSdk should be {required_target_sdk}")
                suggestions.append(f"Update targetSdk to {required_target_sdk} in app/build.gradle")
            
            if issues:
                self.checks.append(CheckResult(
                    name="Android SDK Versions",
                    passed=False,
                    severity="warning",
                    message=f"SDK version issues: {', '.join(issues)}",
                    fix_suggestions=suggestions,
                    file_paths=[str(app_build_gradle)]
                ))
            else:
                self.checks.append(CheckResult(
                    name="Android SDK Versions",
                    passed=True,
                    severity="info",
                    message="Android SDK versions appear correct"
                ))
        except Exception as e:
            self.checks.append(CheckResult(
                name="Android SDK Versions",
                passed=False,
                severity="warning",
                message=f"Could not check SDK versions: {str(e)}"
            ))
    
    def _check_safe_area_config(self):
        """Check if safe area configuration is present in code"""
        index_html = self.project_root / "index.html"
        app_tsx = self.project_root / "App.tsx"
        
        issues = []
        suggestions = []
        
        # Check index.html for safe area CSS
        if index_html.exists():
            with open(index_html, 'r', encoding='utf-8') as f:
                html_content = f.read()
            
            if 'safe-area-inset-top' not in html_content and 'pt-safe-top' not in html_content:
                issues.append("Missing safe area CSS in index.html")
                suggestions.append("Add safe-area-inset-top CSS classes to index.html")
        
        # Check App.tsx for safe area usage
        if app_tsx.exists():
            with open(app_tsx, 'r', encoding='utf-8') as f:
                tsx_content = f.read()
            
            if 'pt-safe-top' not in tsx_content and 'safe-area' not in tsx_content.lower():
                issues.append("Missing safe area padding in App.tsx header")
                suggestions.append("Add pt-safe-top class to header element in App.tsx")
        
        if issues:
            self.checks.append(CheckResult(
                name="Safe Area Configuration",
                passed=False,
                severity="warning",
                message=f"Issues: {', '.join(issues)}",
                fix_suggestions=suggestions,
                file_paths=[str(index_html), str(app_tsx)]
            ))
        else:
            self.checks.append(CheckResult(
                name="Safe Area Configuration",
                passed=True,
                severity="info",
                message="Safe area configuration found"
            ))
    
    def _check_status_bar_config(self):
        """Check if StatusBar plugin is configured"""
        app_tsx = self.project_root / "App.tsx"
        
        if not app_tsx.exists():
            return
        
        try:
            with open(app_tsx, 'r', encoding='utf-8') as f:
                content = f.read()
            
            if '@capacitor/status-bar' not in content and 'StatusBar' not in content:
                self.checks.append(CheckResult(
                    name="StatusBar Configuration",
                    passed=False,
                    severity="info",
                    message="StatusBar plugin not configured (optional but recommended)",
                    fix_suggestions=[
                        "Import StatusBar from '@capacitor/status-bar'",
                        "Initialize StatusBar in App component useEffect"
                    ],
                    file_paths=[str(app_tsx)]
                ))
            else:
                self.checks.append(CheckResult(
                    name="StatusBar Configuration",
                    passed=True,
                    severity="info",
                    message="StatusBar plugin appears configured"
                ))
        except Exception as e:
            self.checks.append(CheckResult(
                name="StatusBar Configuration",
                passed=False,
                severity="warning",
                message=f"Could not check StatusBar config: {str(e)}"
            ))
    
    def print_report(self):
        """Print comprehensive check report"""
        print("\n" + "=" * 80)
        print("🔍 PRE-BUILD CHECK REPORT")
        print("=" * 80)
        
        # Group checks by severity
        errors = [c for c in self.checks if c.severity == 'error' and not c.passed]
        warnings = [c for c in self.checks if c.severity == 'warning' and not c.passed]
        info_passed = [c for c in self.checks if c.passed]
        
        # Print errors
        if errors:
            print("\n❌ ERRORS (Must Fix Before Build):")
            print("-" * 80)
            for i, check in enumerate(errors, 1):
                print(f"\n{i}. {check.name}")
                print(f"   {check.message}")
                if check.file_paths:
                    print(f"   Files: {', '.join(check.file_paths)}")
                if check.fix_suggestions:
                    print("   💡 Fix Suggestions:")
                    for suggestion in check.fix_suggestions:
                        print(f"      - {suggestion}")
        
        # Print warnings
        if warnings:
            print("\n⚠️  WARNINGS (Recommended to Fix):")
            print("-" * 80)
            for i, check in enumerate(warnings, 1):
                print(f"\n{i}. {check.name}")
                print(f"   {check.message}")
                if check.file_paths:
                    print(f"   Files: {', '.join(check.file_paths)}")
                if check.fix_suggestions:
                    print("   💡 Fix Suggestions:")
                    for suggestion in check.fix_suggestions:
                        print(f"      - {suggestion}")
        
        # Print passed checks summary
        if info_passed:
            print("\n✅ PASSED CHECKS:")
            print("-" * 80)
            for check in info_passed:
                print(f"   ✓ {check.name}: {check.message}")
        
        # Summary
        print("\n" + "=" * 80)
        total = len(self.checks)
        passed = len(info_passed)
        failed = len(errors) + len(warnings)
        
        print(f"SUMMARY: {passed}/{total} checks passed, {failed} issues found")
        
        if errors:
            print("\n🚫 BUILD BLOCKED: Please fix errors before proceeding")
            print("=" * 80)
            return False
        elif warnings:
            print("\n⚠️  BUILD CAN PROCEED: But consider fixing warnings")
            print("=" * 80)
            return True
        else:
            print("\n✅ ALL CHECKS PASSED: Ready to build!")
            print("=" * 80)
            return True

