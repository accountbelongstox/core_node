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
Step 20 Compilation Controller
Final step that generates compilation commands and prepares variables for external triggers
"""

import os
import json
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime

from shared.data_exchange.unified_variable_system import unified_vars
from shared.directory_manager import DirectoryManager
from utils.print_helper import PrintHelper


class Step20CompilationController:
    """
    Step 20 Controller: Final Compilation Preparation
    Generates compilation commands and writes variables for external triggers
    """

    def __init__(self):
        self.step_name = "STEP-20"
        self.step_description = "Final Compilation Preparation"
        self.results = {}
        self.directory_manager = DirectoryManager()

    def execute(self, **kwargs) -> Dict[str, Any]:
        """Execute Step 20: Final Compilation Preparation"""
        try:
            PrintHelper.header(f"{self.step_name}: {self.step_description}")

            # Get compilation option from cache
            compilation_option = unified_vars.get_file_variable(unified_vars.KEY_COMPILATION_OPTION, 'debug')
            PrintHelper.info(f"Compilation option: {compilation_option}", source=self.step_name)

            # Get build information
            build_info = self._get_build_information(**kwargs)

            # Generate compilation commands
            compilation_commands = self._generate_compilation_commands(compilation_option, build_info)

            # Prepare output paths
            output_paths = self._prepare_output_paths(build_info, compilation_option)

            # Write variables to file for external triggers
            self._write_compilation_variables(compilation_commands, output_paths, build_info)

            # Generate summary
            summary = self._generate_summary(compilation_option, compilation_commands, output_paths)

            self.results = {
                'success': True,
                'compilation_option': compilation_option,
                'compilation_commands': compilation_commands,
                'output_paths': output_paths,
                'build_info': build_info,
                'summary': summary
            }

            PrintHelper.success(f"{self.step_name} completed successfully", source=self.step_name)
            return self.results

        except Exception as e:
            error_msg = f"Step 20 execution failed: {str(e)}"
            PrintHelper.error(error_msg, source=self.step_name)
            return {'success': False, 'error': error_msg}

    def _get_build_information(self, **kwargs) -> Dict[str, Any]:
        """Get build information from parameters and directory manager"""
        # Get from kwargs (passed from build system)
        temp_build_root = kwargs.get('temp_build_root')
        app_name = kwargs.get('app_name')

        # Get from unified variables
        if not app_name:
            app_name = unified_vars.get_file_variable(unified_vars.KEY_APP_NAME, '')

        # Get platform and build mode from initial app selection
        selected_platform = unified_vars.get_file_variable(unified_vars.KEY_SELECTED_PLATFORM, 'Android')
        build_action = unified_vars.get_file_variable(unified_vars.KEY_BUILD_ACTION, 'Debug')

        # Get directory info
        dir_info = self.directory_manager.get_current_info()

        build_info = {
            'app_name': app_name,
            'temp_build_root': str(temp_build_root) if temp_build_root else dir_info['current_dir'],
            'build_platform': selected_platform.lower(),
            'build_mode': build_action.lower(),  # Debug/Release/Build
            'build_timestamp': datetime.now().strftime('%Y%m%d_%H%M%S'),
            'project_root': dir_info['origin_dir'],
            'working_dir': dir_info['working_dir']
        }

        PrintHelper.info(f"Build info: {build_info}", source=self.step_name)
        return build_info

    def _generate_compilation_commands(self, compilation_option: str, build_info: Dict[str, Any]) -> Dict[str, str]:
        """Generate Flutter compilation commands based on the selected option"""
        commands = {}

        build_root = build_info['temp_build_root']
        build_platform = build_info['build_platform']
        build_mode = build_info['build_mode']

        # Determine platform-specific build command
        platform_cmd = self._get_platform_build_command(build_platform, build_mode)

        if compilation_option == 'analyze':
            commands.update(self._generate_platform_commands(build_root, f'flutter analyze'))
            commands['description'] = 'Run static analysis on the codebase'

        elif compilation_option == 'clean':
            clean_commands = self._generate_platform_commands(build_root, f'flutter clean', prefix='clean_')
            commands.update(clean_commands)
            build_commands = self._generate_platform_commands(build_root, platform_cmd, prefix='build_')
            commands.update(build_commands)
            commands['description'] = f'Clean build cache and rebuild {build_mode} {build_platform.upper()}'

        elif compilation_option == 'debug':
            flutter_cmd = f'flutter build {self._get_platform_target(build_platform)} --debug'
            commands.update(self._generate_platform_commands(build_root, flutter_cmd))
            commands['description'] = f'Build debug {build_platform.upper()}'

        elif compilation_option == 'profile':
            flutter_cmd = f'flutter build {self._get_platform_target(build_platform)} --profile'
            commands.update(self._generate_platform_commands(build_root, flutter_cmd))
            commands['description'] = f'Build profile {build_platform.upper()} for performance testing'

        elif compilation_option == 'release':
            release_cmd = self._get_optimized_release_command_only(build_platform)
            commands.update(self._generate_platform_commands(build_root, release_cmd))
            commands['description'] = f'Build optimized release {build_platform.upper()} for production'

        elif compilation_option == 'test':
            commands.update(self._generate_platform_commands(build_root, f'flutter test'))
            commands['description'] = 'Run test suite'

        else:
            # Default based on original build mode
            commands.update(self._generate_platform_commands(build_root, platform_cmd))
            commands['description'] = f'Build {build_mode} {build_platform.upper()} (default)'

        PrintHelper.info(f"Generated commands: {commands}", source=self.step_name)
        return commands

    def _generate_platform_commands(self, build_root: str, flutter_command: str, prefix: str = '') -> Dict[str, str]:
        """Generate platform-specific commands (Windows script files vs Linux command strings)"""
        import os

        # Calculate entry file from app name
        # Rule: app_bank -> lib\apps\app_bank\main_app_bank.dart
        app_name = unified_vars.get_file_variable(unified_vars.KEY_SELECTED_APP, '')
        if app_name and app_name.strip():
            # Check if prefix is clean command - don't add -t parameter for clean commands
            if not prefix.startswith('clean'):
                # Extract the suffix from app name (e.g., app_bank -> bank)
                app_suffix = app_name.replace('app_', '') if app_name.startswith('app_') else app_name
                entry_file = f"lib\\apps\\{app_name}\\main_app_{app_suffix}.dart"
                flutter_command = f"{flutter_command} -t {entry_file}"
                PrintHelper.info(f"Using entry file: {entry_file}", source="STEP-20")
            else:
                PrintHelper.info(f"Skipping -t parameter for clean command: {prefix}", source="STEP-20")

        commands = {}

        if os.name == 'nt':  # Windows
            # Generate PowerShell script file
            script_filename = f"{prefix}compile_script.ps1"
            script_path = Path(build_root) / script_filename

            # Create PowerShell script content with pre-cleanup and APK scanning
            script_content = f'''# Flutter Compilation Script
# Generated by step20_compilation_controller.py

Set-Location "{build_root}"
Write-Host "[BUILD] Changed to directory: $(Get-Location)" -ForegroundColor Yellow

# Pre-compilation cleanup - remove old build artifacts
Write-Host "[BUILD] Cleaning old build artifacts..." -ForegroundColor Yellow
$cleanupPaths = @(
    "build\\app\\outputs\\flutter-apk\\*.apk",
    "build\\app\\outputs\\apk\\release\\*.apk",
    "build\\app\\outputs\\apk\\debug\\*.apk",
    "build\\app\\outputs\\bundle\\release\\*.aab"
)

foreach ($cleanupPath in $cleanupPaths) {{
    $fullCleanupPath = Join-Path (Get-Location) $cleanupPath
    $filesToClean = Get-ChildItem -Path $fullCleanupPath -ErrorAction SilentlyContinue
    foreach ($file in $filesToClean) {{
        try {{
            Remove-Item $file.FullName -Force
            Write-Host "[BUILD] Removed old artifact: $($file.Name)" -ForegroundColor Gray
        }} catch {{
            Write-Host "[BUILD] Could not remove: $($file.Name)" -ForegroundColor Yellow
        }}
    }}
}}

# Clean root cache directory only (preserve lib/common/cache_manager)
$rootCacheDir = Join-Path (Get-Location) "cache"
if (Test-Path $rootCacheDir) {{
    try {{
        Remove-Item $rootCacheDir -Recurse -Force
        Write-Host "[BUILD] Removed root cache directory" -ForegroundColor Gray
    }} catch {{
        Write-Host "[BUILD] Could not remove root cache directory" -ForegroundColor Yellow
    }}
}}

Write-Host "[BUILD] Executing: {flutter_command}" -ForegroundColor Cyan

# Execute Flutter command directly
{flutter_command}

$exitCode = $LASTEXITCODE

if ($exitCode -eq 0) {{
    Write-Host "[BUILD] Command completed successfully" -ForegroundColor Green

    # Scan for APK files after successful build
    Write-Host "[BUILD] Scanning for APK files..." -ForegroundColor Cyan
    $apkSearchPaths = @(
        "build\\app\\outputs\\flutter-apk",
        "build\\app\\outputs\\apk\\release",
        "build\\app\\outputs\\apk\\debug"
    )

    $foundApks = @()
    foreach ($searchPath in $apkSearchPaths) {{
        $fullPath = Join-Path (Get-Location) $searchPath
        if (Test-Path $fullPath) {{
            $apkFiles = Get-ChildItem -Path $fullPath -Filter "*.apk" -File
            foreach ($apk in $apkFiles) {{
                $foundApks += @{{
                    "File" = $apk.Name
                    "Path" = $apk.FullName
                    "Directory" = $apk.DirectoryName
                    "Size" = [math]::Round($apk.Length / 1MB, 2)
                }}
                Write-Host "[BUILD] Found APK: $($apk.Name) ($([math]::Round($apk.Length / 1MB, 2)) MB)" -ForegroundColor Green
                Write-Host "[BUILD] Location: $($apk.FullName)" -ForegroundColor Gray
            }}
        }}
    }}

    if ($foundApks.Count -gt 0) {{
        Write-Host "[BUILD] Total APK files found: $($foundApks.Count)" -ForegroundColor Yellow

        # Auto-open directories containing APK files AFTER compilation is complete
        Write-Host "[BUILD] Opening output directories..." -ForegroundColor Cyan
        $uniqueDirectories = $foundApks | ForEach-Object {{ $_.Directory }} | Sort-Object -Unique
        foreach ($directory in $uniqueDirectories) {{
            Write-Host "[BUILD] Opening directory: $directory" -ForegroundColor Cyan
            try {{
                Start-Process "explorer.exe" -ArgumentList $directory
            }} catch {{
                Write-Host "[BUILD] Could not open directory: $directory" -ForegroundColor Red
            }}
        }}
    }} else {{
        Write-Host "[BUILD] No APK files found in expected locations" -ForegroundColor Yellow
        Write-Host "[BUILD] Searched in:" -ForegroundColor Gray
        foreach ($searchPath in $apkSearchPaths) {{
            Write-Host "[BUILD]   - $searchPath" -ForegroundColor Gray
        }}
    }}

}} else {{
    Write-Host "[BUILD] Command failed with exit code: $exitCode" -ForegroundColor Red
    exit $exitCode
}}
'''

            # Write script file
            try:
                script_path.write_text(script_content, encoding='utf-8')
                commands[f'{prefix}script_path'] = str(script_path)
                commands[f'{prefix}command'] = f'powershell -File "{script_path}"'
                PrintHelper.info(f"Created Windows script: {script_path}", source=self.step_name)
            except Exception as e:
                PrintHelper.error(f"Failed to create Windows script: {e}", source=self.step_name)
                # Fallback to direct command
                commands[f'{prefix}command'] = flutter_command
        else:  # Linux/Unix
            # Generate shell script file
            script_filename = f"{prefix}compile_script.sh"
            script_path = Path(build_root) / script_filename

            # Create shell script content with real-time output
            script_content = f'''#!/bin/bash
# Flutter Compilation Script
# Generated by step20_compilation_controller.py

cd "{build_root}"
echo "[BUILD] Changed to directory: $(pwd)"
echo "[BUILD] Executing: {flutter_command}"
echo "[BUILD] Starting real-time output..."

# Execute with real-time output
{flutter_command}

exit_code=$?

if [ $exit_code -eq 0 ]; then
    echo "[BUILD] Command completed successfully"
else
    echo "[BUILD] Command failed with exit code: $exit_code"
    exit $exit_code
fi
'''

            # Write script file
            try:
                script_path.write_text(script_content, encoding='utf-8')
                # Make script executable
                import stat
                script_path.chmod(script_path.stat().st_mode | stat.S_IEXEC)
                commands[f'{prefix}script_path'] = str(script_path)
                commands[f'{prefix}command'] = f'bash "{script_path}"'
                PrintHelper.info(f"Created Linux script: {script_path}", source=self.step_name)
            except Exception as e:
                PrintHelper.error(f"Failed to create Linux script: {e}", source=self.step_name)
                # Fallback to direct command
                commands[f'{prefix}command'] = f'cd "{build_root}" && {flutter_command}'

        return commands

    def _get_platform_target(self, platform: str) -> str:
        """Get Flutter build target for platform"""
        platform_map = {
            'android': 'apk',
            'ios': 'ios',
            'web': 'web',
            'windows': 'windows',
            'macos': 'macos',
            'linux': 'linux'
        }
        return platform_map.get(platform.lower(), 'apk')

    def _get_platform_build_command(self, platform: str, build_mode: str) -> str:
        """Get platform-specific build command based on original selection"""
        target = self._get_platform_target(platform)

        # Map build modes to Flutter flags with optimization
        if build_mode in ['debug']:
            flag = '--debug'
        elif build_mode in ['release', 'build']:  # 'Build' mode should be release
            flag = '--release --obfuscate --split-debug-info=build/debug-info'
        else:
            flag = '--debug'  # Default

        return f'flutter build {target} {flag}'

    def _get_optimized_release_command(self, build_root: str, platform: str) -> str:
        """Get optimized release build command with compression and obfuscation"""
        target = self._get_platform_target(platform)

        if platform.lower() == 'android':
            # Android-specific optimizations
            return (f'cd "{build_root}" && '
                   f'flutter build {target} --release '
                   f'--obfuscate --split-debug-info=build/debug-info '
                   f'--shrink --tree-shake-icons '
                   f'--target-platform android-arm,android-arm64,android-x64')
        elif platform.lower() == 'ios':
            # iOS-specific optimizations
            return (f'cd "{build_root}" && '
                   f'flutter build {target} --release '
                   f'--obfuscate --split-debug-info=build/debug-info '
                   f'--tree-shake-icons')
        elif platform.lower() == 'web':
            # Web-specific optimizations
            return (f'cd "{build_root}" && '
                   f'flutter build {target} --release '
                   f'--web-renderer canvaskit '
                   f'--tree-shake-icons')
        else:
            # Default optimizations for other platforms
            return (f'cd "{build_root}" && '
                   f'flutter build {target} --release '
                   f'--obfuscate --split-debug-info=build/debug-info '
                   f'--tree-shake-icons')

    def _get_optimized_release_command_only(self, platform: str) -> str:
        """Get only the Flutter command part for optimized release build"""
        target = self._get_platform_target(platform)

        if platform.lower() == 'android':
            # Android-specific optimizations
            return (f'flutter build {target} --release '
                   f'--obfuscate --split-debug-info=build/debug-info '
                   f'--shrink --tree-shake-icons '
                   f'--target-platform android-arm,android-arm64,android-x64')
        elif platform.lower() == 'ios':
            # iOS-specific optimizations
            return (f'flutter build {target} --release '
                   f'--obfuscate --split-debug-info=build/debug-info '
                   f'--tree-shake-icons')
        elif platform.lower() == 'web':
            # Web-specific optimizations
            return (f'flutter build {target} --release '
                   f'--web-renderer canvaskit '
                   f'--tree-shake-icons')
        else:
            # Default optimizations for other platforms
            return (f'flutter build {target} --release '
                   f'--obfuscate --split-debug-info=build/debug-info '
                   f'--tree-shake-icons')

    def _prepare_output_paths(self, build_info: Dict[str, Any], compilation_option: str) -> Dict[str, str]:
        """Prepare output paths for build artifacts"""
        build_root = Path(build_info['temp_build_root'])
        app_name = build_info['app_name']

        output_paths = {
            'build_root': str(build_root),
            'android_build_dir': str(build_root / 'build' / 'app' / 'outputs' / 'flutter-apk'),
            'app_name': app_name
        }

        # Determine APK output path based on compilation option and build mode
        build_mode = build_info.get('build_mode', 'debug').lower()

        # Determine actual build type based on compilation option and build mode
        if compilation_option == 'debug':
            apk_type = 'debug'
        elif compilation_option == 'profile':
            apk_type = 'profile'
        elif compilation_option in ['release', 'clean']:
            # For clean and release options, check if build mode suggests release
            if build_mode in ['build', 'release']:
                apk_type = 'release'
            else:
                apk_type = 'debug'
        else:
            # Default based on build mode
            if build_mode in ['build', 'release']:
                apk_type = 'release'
            else:
                apk_type = 'debug'

        output_paths['apk_file'] = f'app-{apk_type}.apk'
        output_paths['apk_path'] = str(build_root / 'build' / 'app' / 'outputs' / 'flutter-apk' / f'app-{apk_type}.apk')

        # Cache paths in unified variables
        unified_vars.set_file_variable(unified_vars.KEY_BUILD_OUTPUT_DIR, output_paths['android_build_dir'])
        unified_vars.set_file_variable(unified_vars.KEY_APK_OUTPUT_PATH, output_paths['apk_path'])
        unified_vars.set_file_variable(unified_vars.KEY_COMPILATION_PLATFORM, 'android')

        PrintHelper.info(f"Output paths: {output_paths}", source=self.step_name)
        return output_paths

    def _write_compilation_variables(self, commands: Dict[str, str], output_paths: Dict[str, str], build_info: Dict[str, Any]):
        """Write compilation variables using unified_variable_system for PowerShell sharing"""

        # Get main build command - prioritize script-based commands
        main_command = (commands.get('command', '') or
                       commands.get('build_command', '') or
                       commands.get('build', '') or
                       commands.get('analyze', '') or
                       commands.get('test', ''))

        # Get clean command - prioritize script-based commands
        clean_command = (commands.get('clean_command', '') or
                        commands.get('clean', ''))

        compilation_option = unified_vars.get_file_variable(unified_vars.KEY_COMPILATION_OPTION, 'debug')

        # Store all variables in unified_variable_system using defined KEYs
        unified_vars.set_file_variable(unified_vars.KEY_COMPILATION_COMMAND, main_command)
        unified_vars.set_file_variable(unified_vars.KEY_BUILD_OUTPUT_DIR, output_paths['android_build_dir'])
        unified_vars.set_file_variable(unified_vars.KEY_APK_OUTPUT_PATH, output_paths['apk_path'])
        unified_vars.set_file_variable(unified_vars.KEY_COMPILATION_PLATFORM, build_info['build_platform'])

        # Store additional build information using existing or new KEYs
        unified_vars.set_file_variable(unified_vars.KEY_APP_NAME, build_info['app_name'])
        unified_vars.set_file_variable('KEY_BUILD_ROOT', output_paths['build_root'])
        unified_vars.set_file_variable('KEY_CLEAN_COMMAND', clean_command)
        unified_vars.set_file_variable('KEY_BUILD_TIMESTAMP', build_info['build_timestamp'])
        unified_vars.set_file_variable('KEY_APK_FILE_NAME', output_paths['apk_file'])

        # Store script paths for PowerShell access
        script_path = commands.get('script_path', '')
        clean_script_path = commands.get('clean_script_path', '')
        build_script_path = commands.get('build_script_path', '')

        if script_path:
            unified_vars.set_file_variable('script_path', script_path)
        if clean_script_path:
            unified_vars.set_file_variable('clean_script_path', clean_script_path)
        if build_script_path:
            unified_vars.set_file_variable('build_script_path', build_script_path)

        # Store individual commands for fallback
        if commands.get('command'):
            unified_vars.set_file_variable('command', commands.get('command'))
        if commands.get('clean_command'):
            unified_vars.set_file_variable('clean_command', commands.get('clean_command'))

        # Log the stored variables
        PrintHelper.info("Variables stored in unified_variable_system:", source=self.step_name)
        print(f"[{self.step_name}] {unified_vars.KEY_COMPILATION_COMMAND} = {main_command}")
        print(f"[{self.step_name}] {unified_vars.KEY_BUILD_OUTPUT_DIR} = {output_paths['android_build_dir']}")
        print(f"[{self.step_name}] {unified_vars.KEY_APK_OUTPUT_PATH} = {output_paths['apk_path']}")
        print(f"[{self.step_name}] {unified_vars.KEY_COMPILATION_PLATFORM} = {build_info['build_platform']}")
        print(f"[{self.step_name}] KEY_BUILD_ROOT = {output_paths['build_root']}")
        print(f"[{self.step_name}] KEY_CLEAN_COMMAND = {clean_command}")

        PrintHelper.info(f"All compilation variables cached for PowerShell access", source=self.step_name)

    def _generate_summary(self, compilation_option: str, commands: Dict[str, str], output_paths: Dict[str, str]) -> Dict[str, Any]:
        """Generate a summary of the compilation preparation"""
        # Get main command - prioritize script-based commands
        main_command = (commands.get('command', '') or
                       commands.get('build_command', '') or
                       commands.get('build', '') or
                       commands.get('analyze', '') or
                       commands.get('test', '') or
                       'N/A')

        summary = {
            'compilation_option': compilation_option,
            'commands_generated': len([k for k in commands.keys() if k not in ['description']]),
            'main_command': main_command,
            'expected_output': output_paths['apk_path'] if output_paths['apk_path'] != 'N/A' else 'No APK output',
            'build_directory': output_paths['build_root'],
            'ready_for_compilation': True
        }

        # Print summary
        PrintHelper.info("Compilation Preparation Summary:", source=self.step_name)
        print(f"[{self.step_name}] Compilation Option: {summary['compilation_option']}")
        print(f"[{self.step_name}] Commands Generated: {summary['commands_generated']}")
        print(f"[{self.step_name}] Main Command: {summary['main_command']}")
        print(f"[{self.step_name}] Expected Output: {summary['expected_output']}")
        print(f"[{self.step_name}] Build Directory: {summary['build_directory']}")
        print(f"[{self.step_name}] Ready for Compilation: {summary['ready_for_compilation']}")

        return summary

    def get_results(self) -> Dict[str, Any]:
        """Get the results of Step 20 execution"""
        return self.results