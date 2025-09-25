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

"""
Build Coordinator for Flutter Bloom Build System
Coordinates all build steps using existing pybuildscripts infrastructure
"""

import os
import sys
import json
import shutil
import subprocess
from datetime import datetime
from pathlib import Path

# Add pybuildscripts to path
current_dir = os.path.dirname(os.path.abspath(__file__))
pybuildscripts_dir = os.path.join(current_dir, "pybuildscripts")
sys.path.append(pybuildscripts_dir)

# Import build system modules
from gvar.gvar import GVar
from provider.build_provider import (
    PROGRAMING_DIR, EXTERNAL_RESOURCES_DIR, ORIGINAL_FLUTTER_ROOT,
    ORIGINAL_FLUTTER_APP_DIRS, set_static_resource_var, get_static_resource_var
)
from tools.images_tool import get_image_size, resize_image_to_min_size
from tools.find_res_by_build_dir import find_image_in_external_dirs, find_image_in_internal_dirs
from tools.pyprint import Print

class BuildCoordinator:
    """Coordinates the complete build process"""
    
    def __init__(self):
        self.flutter_bloom_root = Path(ORIGINAL_FLUTTER_ROOT)
        self.build_dir = Path(PROGRAMING_DIR)
        self.compile_factory_dir = self.build_dir / "compile_factory"
        self.external_resources_dir = Path(EXTERNAL_RESOURCES_DIR)
        
        # Ensure directories exist
        self.build_dir.mkdir(exist_ok=True)
        self.compile_factory_dir.mkdir(exist_ok=True)
        self.external_resources_dir.mkdir(exist_ok=True)
        
        # Platform directories
        self.platform_dirs = ["android", "web", "windows", "macos", "ios"]
        
        # Image extensions
        self.image_extensions = ['.png', '.jpg', '.jpeg', '.ico', '.icns', '.gif', '.webp']
    
    def get_working_directory_name(self, app_name):
        """Generate working directory name with timestamp"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return f"flutter_bloom_{app_name}_{timestamp}"
    
    def copy_project(self, app_name, platform):
        """Copy Flutter project to working directory"""
        working_dir_name = self.get_working_directory_name(app_name)
        working_dir = self.compile_factory_dir / working_dir_name
        
        Print.info(f"Copying Flutter project to: {working_dir}")
        
        try:
            # Copy entire Flutter project
            shutil.copytree(
                str(self.flutter_bloom_root),
                str(working_dir),
                ignore=shutil.ignore_patterns(
                    '.git', '.dart_tool', 'build', '.cache',
                    '*.log', '__pycache__', '*.pyc'
                )
            )
            
            Print.success("Project copied successfully")
            
            # Store in GVar system
            GVar.set("working_directory", str(working_dir))
            GVar.set("app_name", app_name)
            GVar.set("platform", platform)
            GVar.set("copy_timestamp", datetime.now().isoformat())
            
            return str(working_dir)
            
        except Exception as e:
            Print.error(f"Failed to copy project: {e}")
            return None
    
    def modify_pubspec(self, working_dir, app_name):
        """Modify pubspec.yaml to comment out other apps' assets"""
        pubspec_path = os.path.join(working_dir, "pubspec.yaml")
        
        if not os.path.exists(pubspec_path):
            Print.error(f"pubspec.yaml not found at: {pubspec_path}")
            return False
        
        Print.info(f"Modifying pubspec.yaml for app: {app_name}")
        
        try:
            # Read original file
            with open(pubspec_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            # Create backup
            backup_path = f"{pubspec_path}.backup"
            with open(backup_path, 'w', encoding='utf-8') as f:
                f.writelines(lines)
            
            # Get patterns to exclude (other apps)
            exclude_patterns = []
            for app_dir in ORIGINAL_FLUTTER_APP_DIRS:
                if app_dir != app_name:
                    exclude_patterns.extend([
                        f"assets/apps/{app_dir}/",
                        f"assets/.internal_{app_dir}/",
                        f"assets/{app_dir}/"
                    ])
            
            # Process lines
            modified_lines = []
            in_assets_section = False
            assets_indent_level = 0
            
            for line in lines:
                stripped = line.strip()
                
                # Detect assets section
                if stripped == 'assets:':
                    in_assets_section = True
                    assets_indent_level = len(line) - len(line.lstrip())
                    modified_lines.append(line)
                    continue
                
                if in_assets_section:
                    current_indent = len(line) - len(line.lstrip())
                    
                    # Check if we're still in assets section
                    if current_indent <= assets_indent_level and stripped and not stripped.startswith('#'):
                        in_assets_section = False
                        modified_lines.append(line)
                        continue
                    
                    # Check if this line should be commented out
                    should_comment = False
                    for pattern in exclude_patterns:
                        if pattern in line:
                            should_comment = True
                            break
                    
                    if should_comment and not stripped.startswith('#'):
                        # Comment out the line
                        indent = ' ' * current_indent
                        content = line[current_indent:]
                        commented_line = f"{indent}# {content}"
                        modified_lines.append(commented_line)
                        Print.info(f"Commented out: {stripped}")
                    else:
                        modified_lines.append(line)
                else:
                    modified_lines.append(line)
            
            # Write modified file
            with open(pubspec_path, 'w', encoding='utf-8') as f:
                f.writelines(modified_lines)
            
            Print.success("pubspec.yaml modified successfully")
            return True
            
        except Exception as e:
            Print.error(f"Failed to modify pubspec.yaml: {e}")
            return False
    
    def process_asset_replacement(self, working_dir, app_name, app_config_path):
        """Process asset replacement using existing tools"""
        Print.info(f"Processing asset replacement for app: {app_name}")
        
        # Load build configuration
        try:
            with open(app_config_path, 'r', encoding='utf-8') as f:
                build_config = json.load(f)
        except Exception as e:
            Print.error(f"Failed to load build config: {e}")
            return False
        
        # Get required assets
        required_assets = build_config.get("required_assets", {})
        use_external_assets = build_config.get("use_external_assets", True)
        
        replacement_results = {
            "timestamp": datetime.now().isoformat(),
            "replacements": [],
            "errors": [],
            "skipped": []
        }
        
        # Set app name in static resource system
        set_static_resource_var(app_name, "AppName", app_name)
        
        # Process each platform
        for platform in self.platform_dirs:
            platform_path = os.path.join(working_dir, platform)
            if os.path.exists(platform_path):
                Print.info(f"Processing platform: {platform}")
                
                # Find platform images
                platform_images = self.find_images_in_directory(platform_path)
                
                for image_path in platform_images:
                    # Skip 1x1 placeholder images
                    try:
                        size = get_image_size(image_path)
                        if size[0] <= 1 and size[1] <= 1:
                            replacement_results["skipped"].append(f"Skipped 1x1 placeholder: {image_path}")
                            continue
                    except:
                        continue
                    
                    # Get base filename
                    base_name = os.path.splitext(os.path.basename(image_path))[0]
                    
                    # Map common icon names
                    icon_mappings = {
                        "ic_launcher": "icon",
                        "launcher_icon": "icon",
                        "app_icon": "icon",
                        "ic_notification": "notification_icon",
                        "notification": "notification_icon"
                    }
                    
                    mapped_name = icon_mappings.get(base_name, base_name)
                    
                    # Find replacement source
                    replacement_source = None
                    
                    # Check if this is a required asset
                    for asset_key, asset_filename in required_assets.items():
                        if os.path.splitext(asset_filename)[0] == mapped_name:
                            # Try to find in external resources first
                            if use_external_assets:
                                replacement_source = find_image_in_external_dirs(asset_filename)
                            
                            # Fallback to internal resources
                            if not replacement_source:
                                replacement_source = find_image_in_internal_dirs(asset_filename)
                            
                            break
                    
                    if replacement_source and os.path.exists(replacement_source):
                        # Create backup
                        backup_dir = os.path.join(working_dir, "backup", app_name)
                        os.makedirs(backup_dir, exist_ok=True)
                        backup_path = os.path.join(backup_dir, os.path.basename(image_path))
                        shutil.copy2(image_path, backup_path)
                        
                        # Get target size
                        try:
                            target_size = get_image_size(image_path)
                            
                            # Resize and replace
                            resize_image_to_min_size(
                                replacement_source, 
                                target_size[0], 
                                target_size[1], 
                                image_path
                            )
                            
                            replacement_results["replacements"].append({
                                "source": replacement_source,
                                "target": image_path,
                                "size": target_size,
                                "backup": backup_path
                            })
                            
                            Print.success(f"Replaced {image_path} with {replacement_source}")
                            
                        except Exception as e:
                            replacement_results["errors"].append(f"Failed to replace {image_path}: {e}")
                    else:
                        replacement_results["skipped"].append(f"No replacement found for {mapped_name}")
        
        # Save replacement results
        results_path = os.path.join(working_dir, "asset_replacement_results.json")
        with open(results_path, 'w', encoding='utf-8') as f:
            json.dump(replacement_results, f, indent=2, ensure_ascii=False)
        
        Print.success(f"Asset replacement completed")
        Print.info(f"Replacements: {len(replacement_results['replacements'])}")
        Print.info(f"Errors: {len(replacement_results['errors'])}")
        Print.info(f"Skipped: {len(replacement_results['skipped'])}")
        
        return True
    
    def find_images_in_directory(self, directory):
        """Find all image files in directory recursively"""
        images = []
        
        for root, dirs, files in os.walk(directory):
            for file in files:
                if any(file.lower().endswith(ext) for ext in self.image_extensions):
                    images.append(os.path.join(root, file))
        
        return images
    
    def execute_build_process(self, app_name, platform, app_config_path):
        """Execute the complete build process"""
        Print.info(f"Starting build process for {app_name} on {platform}")
        
        try:
            # Step 1: Copy project
            working_dir = self.copy_project(app_name, platform)
            if not working_dir:
                return False
            
            # Step 2: Modify pubspec.yaml
            if not self.modify_pubspec(working_dir, app_name):
                return False
            
            # Step 3: Process asset replacement
            if not self.process_asset_replacement(working_dir, app_name, app_config_path):
                return False
            
            Print.success("Build preparation completed successfully")
            return True
            
        except Exception as e:
            Print.error(f"Build process failed: {e}")
            return False

def main():
    """Main execution function"""
    try:
        # Get parameters from GVar
        app_name = GVar.get("app_name", "")
        platform = GVar.get("platform", "")
        app_config_path = GVar.get("app_config_path", "")
        
        if not app_name or not platform:
            Print.error(f"Missing parameters. App: '{app_name}', Platform: '{platform}'")
            sys.exit(1)
        
        Print.info(f"Build Coordinator - App: {app_name}, Platform: {platform}")
        
        # Initialize coordinator
        coordinator = BuildCoordinator()
        
        # Execute build process
        success = coordinator.execute_build_process(app_name, platform, app_config_path)
        
        if success:
            Print.success("Build coordination completed successfully")
            sys.exit(0)
        else:
            Print.error("Build coordination failed")
            sys.exit(1)
            
    except Exception as e:
        Print.error(f"Build coordinator failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
