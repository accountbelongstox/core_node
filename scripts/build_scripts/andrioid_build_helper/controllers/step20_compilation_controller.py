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
import re
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime

from shared.data_exchange.unified_variable_system import unified_vars
from shared.directory_manager import DirectoryManager
from utils.print_helper import PrintHelper
from utils.cache_cleaner import CacheCleaner, normalize_path, adapt_flutter_command, generate_powershell_helpers
from utils.cleanup_manager import CleanupManager
from utils.script_generator import ScriptGenerator
from utils.path_helper import PathHelper


# Helper functions are now imported from utils.cache_cleaner


class Step20CompilationController:
    """Step 20: Flutter Compilation Controller with modular script generation"""
    
    def __init__(self):
        self.step_name = "STEP-20"
        self.step_description = "Final Compilation Preparation"
        self.results = {}
        self.directory_manager = DirectoryManager()
    
    def execute(self, **kwargs) -> Dict[str, Any]:
        """Execute Step 20: Final Compilation Preparation with modular script generation"""
        try:
            PrintHelper.header(f"{self.step_name}: {self.step_description}")

            # Get compilation option from cache
            compilation_option = unified_vars.get_file_variable(unified_vars.KEY_COMPILATION_OPTION, 'debug')
            PrintHelper.info(f"Compilation option: {compilation_option}", source=self.step_name)

            # Get build information
            build_info = self._get_build_information(**kwargs)

            # Generate compilation commands with modular scripts
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

        # Get Flutter command based on compilation option
        flutter_command = self._get_flutter_command(build_platform, build_mode, compilation_option)

        # Note: 'analyze' option removed - analysis is disabled in build scripts to avoid duplicate pub get
        # If needed, run 'flutter analyze' separately

        if compilation_option == 'clean':
            flutter_command = 'flutter clean'
            commands['description'] = f'Clean build cache and rebuild {build_mode} {build_platform.upper()}'

        elif compilation_option == 'debug':
            flutter_command = f'flutter build {self._get_platform_target(build_platform)} --debug'
            commands['description'] = f'Build debug {build_platform.upper()}'

        elif compilation_option == 'profile':
            flutter_command = f'flutter build {self._get_platform_target(build_platform)} --profile'
            commands['description'] = f'Build profile {build_platform.upper()} for performance testing'

        elif compilation_option == 'release':
            flutter_command = self._get_optimized_release_command_only(build_platform)
            commands['description'] = f'Build optimized release {build_platform.upper()} for production'

        elif compilation_option == 'test':
            flutter_command = 'flutter test'
            commands['description'] = 'Run test suite'

        else:
            # Default based on original build mode
            flutter_command = self._get_platform_build_command(build_platform, build_mode)
            commands['description'] = f'Build {build_mode} {build_platform.upper()} (default)'

        # Generate platform-specific commands with modular scripts
        commands.update(self._generate_platform_commands(build_root, flutter_command, build_platform))

        PrintHelper.info(f"Generated commands: {commands}", source=self.step_name)
        return commands

    def _get_flutter_command(self, platform: str, mode: str, compilation_option: str = None) -> str:
        """Get Flutter command based on platform and mode"""
        target = self._get_platform_target(platform)

        if platform.lower() == 'android':
            if mode.lower() == 'debug':
                command = f"flutter build apk --debug"
            elif mode.lower() == 'release':
                command = f"flutter build apk --release"
            else:
                command = f"flutter build apk --{mode}"
        elif platform.lower() == 'ios':
            command = f"flutter build ios --{mode}"
        elif platform.lower() == 'web':
            command = f"flutter build web --{mode}"
        else:
            command = f"flutter build {target} --{mode}"

        # Add entry file from user selection (stored in unified variables)
        entry_file = unified_vars.get_file_variable(unified_vars.KEY_SELECTED_ENTRY_FILE, '')
        if entry_file and entry_file.strip():
            # Use --target parameter (long form) for clarity
            command += f" --target={entry_file}"
            PrintHelper.info(f"Using entry file: {entry_file}", source=self.step_name)
        else:
            PrintHelper.warning("No entry file specified, using Flutter default main.dart", source=self.step_name)

        return command

    def _generate_platform_commands(self, build_root: str, flutter_command: str, platform: str) -> Dict[str, str]:
        """Generate platform-specific commands with modular scripts"""
        import os
        
        commands = {}
        prefix = f"{platform}_"
        
        # Use Python helper functions to pre-process command
        flutter_command = adapt_flutter_command(flutter_command)
        PrintHelper.info(f"Adapted Flutter command: {flutter_command}", source="STEP-20")

        if os.name == 'nt':  # Windows
            # Generate PowerShell script file
            script_filename = f"{prefix}compile_script.ps1"
            script_path = Path(build_root) / script_filename

            # Initialize cache cleaner, cleanup manager, and script generator
            cache_cleaner = CacheCleaner(build_root)
            cleanup_manager = CleanupManager(build_root)
            script_generator = ScriptGenerator(build_root)
            
            # Get cleanup information
            cleanup_info = cache_cleaner.get_comprehensive_cleanup_info()
            retry_info_1 = cache_cleaner.get_retry_cleanup_info(1)
            retry_info_2 = cache_cleaner.get_retry_cleanup_info(2)
            
            # Get cleanup paths
            cleanup_paths = cleanup_manager.get_cleanup_info()
            comprehensive_paths = cleanup_manager.get_cleanup_paths("comprehensive")
            retry_paths = cleanup_manager.get_cleanup_paths("retry")

            # Generate all script files using script generator
            script_files = script_generator.generate_all_scripts(
                cleanup_info=cleanup_info,
                comprehensive_paths=comprehensive_paths,
                retry_paths=retry_paths,
                flutter_command=flutter_command
            )
            
            # Create main orchestrator script content
            # Normalize paths using PathHelper for consistency
            orchestrator_path = PathHelper.normalize_for_powershell(script_files['orchestrator_script'])
            build_root_normalized = PathHelper.normalize_for_powershell(build_root)

            script_content = rf'''# Flutter Build Orchestrator
# Generated by step20_compilation_controller.py

Set-Location "{build_root_normalized}"
Write-Host "[BUILD] Changed to directory: $(Get-Location)" -ForegroundColor Yellow

# Execute main orchestrator script
Write-Host "[BUILD] Starting build orchestration..." -ForegroundColor Yellow
& "{orchestrator_path}"
exit $LASTEXITCODE
'''

            # Write script file
            try:
                script_path.write_text(script_content, encoding='utf-8')
                commands[f'{prefix}script_path'] = str(script_path)
                commands[f'{prefix}command'] = f'powershell -File "{script_path}"'
                commands[f'{prefix}script_files'] = script_files
                
                # Add individual script paths for unified variable system
                commands[f'{prefix}clean_script_path'] = script_files.get('cleanup_script', '')
                commands[f'{prefix}build_script_path'] = script_files.get('build_script', '')
                commands[f'{prefix}debug_script_path'] = script_files.get('orchestrator_script', '')
                
                PrintHelper.info(f"Created Windows orchestrator script: {script_path}", source=self.step_name)
                PrintHelper.info(f"Generated modular scripts: {list(script_files.keys())}", source=self.step_name)
            except Exception as e:
                PrintHelper.error(f"Failed to create Windows script: {e}", source=self.step_name)
                # Fallback to direct command
                commands[f'{prefix}command'] = flutter_command
        else:  # Linux/Unix
            # Generate shell script file
            script_filename = f"{prefix}compile_script.sh"
            script_path = Path(build_root) / script_filename

            script_content = rf'''#!/bin/bash
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

        command = f'flutter build {target} {flag}'

        # Add entry file from user selection
        entry_file = unified_vars.get_file_variable(unified_vars.KEY_SELECTED_ENTRY_FILE, '')
        if entry_file and entry_file.strip():
            command += f' --target={entry_file}'

        return command

    def _get_optimized_release_command(self, build_root: str, platform: str) -> str:
        """Get optimized release build command with compression and obfuscation"""
        target = self._get_platform_target(platform)

        # Get entry file from user selection
        entry_file = unified_vars.get_file_variable(unified_vars.KEY_SELECTED_ENTRY_FILE, '')
        entry_file_param = f' --target={entry_file}' if entry_file and entry_file.strip() else ''

        if platform.lower() == 'android':
            # Android-specific optimizations
            command = (f'cd "{build_root}" && '
                      f'flutter build {target} --release '
                      f'--obfuscate --split-debug-info=build/debug-info '
                      f'--shrink --tree-shake-icons '
                      f'--target-platform android-arm,android-arm64,android-x64')
        elif platform.lower() == 'ios':
            # iOS-specific optimizations
            command = (f'cd "{build_root}" && '
                      f'flutter build {target} --release '
                      f'--obfuscate --split-debug-info=build/debug-info '
                      f'--tree-shake-icons')
        elif platform.lower() == 'web':
            # Web-specific optimizations
            command = (f'cd "{build_root}" && '
                      f'flutter build {target} --release '
                      f'--web-renderer canvaskit '
                      f'--tree-shake-icons')
        else:
            # Default optimizations for other platforms
            command = (f'cd "{build_root}" && '
                      f'flutter build {target} --release '
                      f'--obfuscate --split-debug-info=build/debug-info '
                      f'--tree-shake-icons')

        return command + entry_file_param

    def _get_optimized_release_command_only(self, platform: str) -> str:
        """Get only the Flutter command part for optimized release build"""
        target = self._get_platform_target(platform)

        # Get entry file from user selection
        entry_file = unified_vars.get_file_variable(unified_vars.KEY_SELECTED_ENTRY_FILE, '')
        entry_file_param = f' --target={entry_file}' if entry_file and entry_file.strip() else ''

        if platform.lower() == 'android':
            # Android-specific optimizations
            command = (f'flutter build {target} --release '
                      f'--obfuscate --split-debug-info=build/debug-info '
                      f'--shrink --tree-shake-icons '
                      f'--target-platform android-arm,android-arm64,android-x64')
        elif platform.lower() == 'ios':
            # iOS-specific optimizations
            command = (f'flutter build {target} --release '
                      f'--obfuscate --split-debug-info=build/debug-info '
                      f'--tree-shake-icons')
        elif platform.lower() == 'web':
            # Web-specific optimizations
            command = (f'flutter build {target} --release '
                      f'--web-renderer canvaskit '
                      f'--tree-shake-icons')
        else:
            # Default optimizations for other platforms
            command = (f'flutter build {target} --release '
                      f'--obfuscate --split-debug-info=build/debug-info '
                      f'--tree-shake-icons')

        return command + entry_file_param

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

        # Clear all potential old variables first to prevent using stale data from previous runs
        unified_vars.set_file_variable(unified_vars.KEY_CLEAN_COMMAND, '')
        unified_vars.set_file_variable(unified_vars.KEY_CLEAN_SCRIPT_PATH, '')
        unified_vars.set_file_variable(unified_vars.KEY_BUILD_COMMAND, '')
        unified_vars.set_file_variable(unified_vars.KEY_BUILD_SCRIPT_PATH, '')
        unified_vars.set_file_variable(unified_vars.KEY_COMMAND, '')
        unified_vars.set_file_variable(unified_vars.KEY_SCRIPT_PATH, '')

        # Get main build command - prioritize script-based commands
        PrintHelper.info(f"Available commands keys: {list(commands.keys())}", source=self.step_name)
        PrintHelper.info(f"android_command value: {commands.get('android_command', 'NOT_FOUND')}", source=self.step_name)
        
        main_command = (commands.get('android_command', '') or
                       commands.get('command', '') or
                       commands.get('build_command', '') or
                       commands.get('build', '') or
                       commands.get('analyze', '') or
                       commands.get('test', ''))
        
        PrintHelper.info(f"Final main_command: '{main_command}'", source=self.step_name)

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
        unified_vars.set_file_variable(unified_vars.KEY_BUILD_ROOT, output_paths['build_root'])
        unified_vars.set_file_variable(unified_vars.KEY_CLEAN_COMMAND, clean_command)
        unified_vars.set_file_variable(unified_vars.KEY_BUILD_TIMESTAMP, build_info['build_timestamp'])
        unified_vars.set_file_variable(unified_vars.KEY_APK_FILE_NAME, output_paths['apk_file'])

        # Store script paths for PowerShell access
        script_path = commands.get('android_script_path', '') or commands.get('script_path', '')
        clean_script_path = commands.get('clean_script_path', '')
        build_script_path = commands.get('build_script_path', '')
        debug_script_path = commands.get('debug_script_path', '')

        if script_path:
            unified_vars.set_file_variable(unified_vars.KEY_SCRIPT_PATH, script_path)
        if clean_script_path:
            unified_vars.set_file_variable(unified_vars.KEY_CLEAN_SCRIPT_PATH, clean_script_path)
        if build_script_path:
            unified_vars.set_file_variable(unified_vars.KEY_BUILD_SCRIPT_PATH, build_script_path)
        if debug_script_path:
            unified_vars.set_file_variable(unified_vars.KEY_DEBUG_SCRIPT_PATH, debug_script_path)

        # Store individual commands for fallback
        if commands.get('command'):
            unified_vars.set_file_variable(unified_vars.KEY_COMMAND, commands.get('command'))
        if commands.get('clean_command'):
            unified_vars.set_file_variable(unified_vars.KEY_CLEAN_COMMAND, commands.get('clean_command'))
        if commands.get('build_command'):
            unified_vars.set_file_variable(unified_vars.KEY_BUILD_COMMAND, commands.get('build_command'))

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


def main():
    """Main function for testing"""
    import sys
    if len(sys.argv) < 4:
        print("Usage: python step20_compilation_controller.py <build_root> <platform> <mode> [entry_file]")
        sys.exit(1)
    
    build_root = sys.argv[1]
    platform = sys.argv[2]
    mode = sys.argv[3]
    entry_file = sys.argv[4] if len(sys.argv) > 4 else None
    
    controller = Step20CompilationController()
    result = controller.execute(build_root=build_root, platform=platform, mode=mode, entry_file=entry_file)
    
    print(f"Result: {result}")


if __name__ == "__main__":
    main()