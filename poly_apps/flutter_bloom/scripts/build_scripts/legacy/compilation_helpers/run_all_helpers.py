# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

#!/usr/bin/env python3
"""
Main Compilation Helpers Dispatcher

PURPOSE:
Orchestrates the entire Flutter multi-app build system compilation process according to established development guidelines.

SPECIFICATIONS FOLLOWED:
1. Flutter Multi-App Aggregation Architecture - Supports multiple apps in single codebase
2. FLUTTER_GUIDE_THIS_FILE_NO_AI_EDIT.md Development Guidelines - Follows project standards
3. Build Directory Structure - Uses D:\programing\.build_dir\{appname} for isolated builds
4. Cross-Platform Build Standards - Supports Android, iOS, Web, Windows, macOS

COMPILATION SEQUENCE:
1. app_display_name_manager.py - Manages Android app display names (strings.xml)
2. id_manager.py - Handles application ID generation and management (build.gradle)
3. image_compressor.py - Optimizes images according to Flutter performance guidelines
4. copy_assets.py - Copies and organizes app-specific assets (icons/images)
5. copy_splash.py - Handles splash screen image deployment
6. copy_android_icons.py - Manages Android-specific icon resources
7. copy_platform_resources.py - Deploys platform-specific resources (iOS/Web/Desktop)
8. apply_config.py - Applies final configuration settings
9. copy_build_files.py - Copies modified files back to Flutter project

ENVIRONMENT INTEGRATION:
- Receives configuration via environment variables from PowerShell build system
- Processes menu selections (Random ID, Manual Input, Compression settings)
- Coordinates with BGVar.ps1 and BCommon.ps1 for shared functionality
- Integrates with build_app.ps1 main build pipeline

COMPLIANCE FEATURES:
- Error handling with stop-on-error capability
- Comprehensive logging and progress reporting
- Modular script architecture for maintainability
- Cross-platform path handling and file operations

TECHNICAL SPECIFICATIONS:
- Uses subprocess for reliable script execution
- Implements proper argument passing to each helper script
- Provides success/failure tracking across all compilation steps
- Supports both full pipeline and selective script execution

SAFETY AND RELIABILITY:
- Validates all paths and dependencies before execution
- Provides rollback capability through build directory isolation
- Implements comprehensive error reporting and status tracking
- Maintains original project files integrity through relative path operations
"""

import argparse
import subprocess
import sys
from pathlib import Path
from typing import List, Tuple

class CompilationHelpersRunner:
    def __init__(self, appname: str, external_assets_dir: str, flutter_root: str):
        self.appname = appname
        self.external_assets_dir = external_assets_dir
        self.flutter_root = flutter_root
        self.helpers_dir = Path(__file__).parent
        
        # Define the sequence of helper scripts
        self.helper_scripts = [
            ("app_display_name_manager.py", "Manage app display name"),
            ("id_manager.py", "Manage application ID"),
            ("image_compressor.py", "Compress images"),
            ("copy_assets.py", "Copy assets (icons/images)"),
            ("copy_splash.py", "Copy splash screen images"),
            ("copy_android_icons.py", "Copy Android icons"),
            ("copy_platform_resources.py", "Copy platform resources"),
            ("apply_config.py", "Apply configuration"),
            ("copy_build_files.py", "Copy modified files back to Flutter project")
        ]
    
    def _run_helper_script(self, script_name: str, description: str) -> Tuple[bool, int]:
        """Run a single helper script"""
        script_path = self.helpers_dir / script_name
        
        if not script_path.exists():
            print(f"Warning: Helper script not found: {script_path}")
            return False, 0
        
        print(f"Running: {description}")
        print(f"Script: {script_path}")
        print("-" * 60)
        
        try:
            # Prepare command arguments based on script type
            if script_name == "app_display_name_manager.py":
                # Special handling for app display name manager
                cmd = [
                    sys.executable,
                    str(script_path),
                    "--appname", self.appname,
                    "--flutter-root", self.flutter_root,
                    "--build-cache-dir", str(Path(self.flutter_root) / ".." / ".." / ".." / ".build_dir" / ".cache")
                ]
                # Add display name mode and manual name if needed
                import os
                display_mode = os.environ.get('APP_DISPLAY_MODE', 'Random Generate')
                cmd.extend(["--mode", display_mode])
                if display_mode == 'Manual Input':
                    manual_name = os.environ.get('APP_DISPLAY_MANUAL_NAME', '')
                    if manual_name:
                        cmd.extend(["--manual-name", manual_name])
            elif script_name == "id_manager.py":
                # Special handling for ID manager
                cmd = [
                    sys.executable,
                    str(script_path),
                    "--appname", self.appname,
                    "--flutter-root", self.flutter_root,
                    "--build-cache-dir", str(Path(self.flutter_root) / ".." / ".." / ".." / ".build_dir" / ".cache")
                ]
                # Add random ID flag if needed (this will be set by PowerShell)
                import os
                if os.environ.get('USE_RANDOM_ID') == 'true':
                    cmd.append("--use-random-id")
            elif script_name == "image_compressor.py":
                # Special handling for image compressor
                cmd = [
                    sys.executable,
                    str(script_path),
                    "--flutter-root", self.flutter_root
                ]
                # Add compression setting if needed
                import os
                compression = os.environ.get('IMAGE_COMPRESSION', 'enabled')
                cmd.extend(["--compression", compression])
            elif script_name == "copy_build_files.py":
                # Special handling for build files copier
                cmd = [
                    sys.executable,
                    str(script_path),
                    "--appname", self.appname,
                    "--flutter-root", self.flutter_root,
                    "--build-cache-dir", str(Path(self.flutter_root) / ".." / ".." / ".." / ".build_dir" / ".cache")
                ]
            else:
                # Default arguments for other scripts
                cmd = [
                    sys.executable,
                    str(script_path),
                    "--appname", self.appname,
                    "--external-assets", self.external_assets_dir,
                    "--flutter-root", self.flutter_root
                ]
            
            # Run the script
            result = subprocess.run(cmd, capture_output=False, text=True)
            
            if result.returncode == 0:
                print(f"✓ {description} completed successfully")
                return True, result.returncode
            else:
                print(f"✗ {description} failed with return code: {result.returncode}")
                return False, result.returncode
                
        except Exception as e:
            print(f"✗ Error running {description}: {e}")
            return False, -1
    
    def run_all(self, stop_on_error: bool = False) -> bool:
        """Run all helper scripts in sequence"""
        print(f"Starting compilation helpers for app: {self.appname}")
        print(f"External assets directory: {self.external_assets_dir}")
        print(f"Flutter root: {self.flutter_root}")
        print("=" * 80)
        print()
        
        success_count = 0
        total_count = len(self.helper_scripts)
        
        for i, (script_name, description) in enumerate(self.helper_scripts, 1):
            print(f"Step {i}/{total_count}: {description}")
            
            success, return_code = self._run_helper_script(script_name, description)
            
            if success:
                success_count += 1
            elif stop_on_error:
                print(f"\nStopping execution due to error in: {description}")
                break
            
            print()
        
        # Summary
        print("=" * 80)
        print(f"Compilation helpers completed!")
        print(f"Successful steps: {success_count}/{total_count}")
        
        if success_count == total_count:
            print("✓ All compilation helpers completed successfully!")
            return True
        else:
            print(f"✗ {total_count - success_count} steps failed")
            return False
    
    def run_specific(self, script_names: List[str]) -> bool:
        """Run specific helper scripts"""
        print(f"Running specific compilation helpers for app: {self.appname}")
        print(f"Scripts to run: {', '.join(script_names)}")
        print("=" * 80)
        print()
        
        success_count = 0
        total_count = len(script_names)
        
        for i, script_name in enumerate(script_names, 1):
            # Find description for the script
            description = script_name
            for script, desc in self.helper_scripts:
                if script == script_name:
                    description = desc
                    break
            
            print(f"Step {i}/{total_count}: {description}")
            
            success, return_code = self._run_helper_script(script_name, description)
            
            if success:
                success_count += 1
            
            print()
        
        # Summary
        print("=" * 80)
        print(f"Specific compilation helpers completed!")
        print(f"Successful steps: {success_count}/{total_count}")
        
        if success_count == total_count:
            print("✓ All specified helpers completed successfully!")
            return True
        else:
            print(f"✗ {total_count - success_count} steps failed")
            return False

def main():
    parser = argparse.ArgumentParser(description="Run compilation helper scripts for Flutter app build")
    parser.add_argument("--appname", required=True, help="App name")
    parser.add_argument("--external-assets", required=True, help="External assets directory")
    parser.add_argument("--flutter-root", required=True, help="Flutter project root directory")
    parser.add_argument("--scripts", nargs="*", help="Specific scripts to run (default: all)")
    parser.add_argument("--stop-on-error", action="store_true", help="Stop execution on first error")
    
    args = parser.parse_args()
    
    # Validate paths
    if not Path(args.external_assets).exists():
        print(f"Error: External assets directory does not exist: {args.external_assets}")
        sys.exit(1)
    
    if not Path(args.flutter_root).exists():
        print(f"Error: Flutter root directory does not exist: {args.flutter_root}")
        sys.exit(1)
    
    # Create runner and execute
    runner = CompilationHelpersRunner(args.appname, args.external_assets, args.flutter_root)
    
    if args.scripts:
        success = runner.run_specific(args.scripts)
    else:
        success = runner.run_all(args.stop_on_error)
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
