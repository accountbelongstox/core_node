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
Asset Processor for Flutter Bloom Build System
Handles asset replacement and processing using modular components
"""

import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from core.constants.build_constants import PLATFORM_DIRS
from .image_processor import ImageProcessor
from .resource_finder import ResourceFinder
from .web_visualizer import WebVisualizer

class AssetProcessor:
    """Handles asset replacement and processing using modular components"""

    def __init__(self, flutter_root_dir: Optional[str] = None):
        self.platform_dirs = PLATFORM_DIRS
        # Ensure ImageProcessor uses the correct flutter root directory
        if flutter_root_dir:
            root_path = Path(flutter_root_dir)
        else:
            # Use current working directory as fallback, but only if we're in a temp/build directory
            root_path = Path.cwd()
            if not (".build_dir" in str(root_path) and "compile_factory" in str(root_path)):
                raise ValueError(f"ERROR: AssetProcessor should only run in temporary build directory, not in: {root_path}")

        self.image_processor = ImageProcessor(root_path)
        self.resource_finder = ResourceFinder()
        self.web_visualizer = WebVisualizer()
    
    def create_backup(self, target_path: str, backup_dir: str) -> str:
        """Create backup of target file"""
        os.makedirs(backup_dir, exist_ok=True)
        backup_path = os.path.join(backup_dir, os.path.basename(target_path))

        try:
            shutil.copy2(target_path, backup_path)
            return backup_path
        except Exception as e:
            print(f"[ERROR] Failed to create backup: {e}")
            return ""
    
    def process_asset_replacement(self, working_dir: str, app_name: str, app_config: Dict, use_external_resources: bool = True) -> Dict:
        """Process asset replacement using modular components"""
        print(f"[INFO] Processing asset replacement for app: {app_name}")

        required_resources = app_config.get("resources", {})

        replacement_results = {
            "timestamp": datetime.now().isoformat(),
            "replacements": [],
            "errors": [],
            "skipped": []
        }

        # Create backup directory
        backup_dir = os.path.join(working_dir, "backup", app_name)

        # Process each platform
        for platform in self.platform_dirs:
            platform_path = os.path.join(working_dir, platform)
            if os.path.exists(platform_path):
                print(f"[INFO] Processing platform: {platform}")

                # Find platform images using resource finder
                platform_images = self.resource_finder.find_platform_images(working_dir, platform)

                for image_path in platform_images:
                    # Skip placeholder images
                    if self.image_processor.is_placeholder_image(image_path):
                        replacement_results["skipped"].append(f"Skipped 1x1 placeholder: {image_path}")
                        continue

                    # Get base filename and map to resource type
                    base_name = os.path.splitext(os.path.basename(image_path))[0]
                    mapped_name = self.resource_finder.map_icon_name(base_name)

                    # Find replacement source
                    replacement_source = None

                    # Check if this is a required resource
                    for resource_key, resource_filename in required_resources.items():
                        resource_base = os.path.splitext(resource_filename)[0]
                        if resource_base == mapped_name or resource_key.replace('_file', '') == mapped_name:
                            # Get prioritized resource list
                            resources = self.resource_finder.get_resource_priority_list(
                                app_name, resource_filename, working_dir, use_external_resources
                            )
                            if resources:
                                replacement_source = resources[0]
                            break

                    if replacement_source and os.path.exists(replacement_source):
                        # Create backup
                        backup_path = self.create_backup(image_path, backup_dir)
                        if not backup_path:
                            replacement_results["errors"].append(f"Failed to backup {image_path}")
                            continue

                        # Process image replacement
                        if self.image_processor.process_image_replacement(replacement_source, image_path):
                            target_size = self.image_processor.get_image_size(image_path)

                            replacement_results["replacements"].append({
                                "source": replacement_source,
                                "target": image_path,
                                "size": target_size,
                                "backup": backup_path,
                                "platform": platform,
                                "resource_type": mapped_name
                            })

                            print(f"[SUCCESS] Replaced {os.path.basename(image_path)} with {os.path.basename(replacement_source)}")
                        else:
                            replacement_results["errors"].append(f"Failed to process replacement for {image_path}")
                    else:
                        replacement_results["skipped"].append(f"No replacement found for {mapped_name} in {platform}")

        # Save replacement results as JSON
        self.save_replacement_results(working_dir, replacement_results)

        # Create and save web visualization
        html_path = self.web_visualizer.save_visualization(working_dir, app_name, replacement_results)
        if html_path:
            replacement_results["visualization_path"] = html_path

        print(f"[SUCCESS] Asset replacement completed")
        print(f"[INFO] Replacements: {len(replacement_results['replacements'])}")
        print(f"[INFO] Errors: {len(replacement_results['errors'])}")
        print(f"[INFO] Skipped: {len(replacement_results['skipped'])}")

        return replacement_results

    def save_replacement_results(self, working_dir: str, replacement_results: Dict) -> None:
        """Save replacement results as JSON"""
        results_path = os.path.join(working_dir, "asset_replacement_results.json")
        try:
            import json
            with open(results_path, 'w', encoding='utf-8') as f:
                json.dump(replacement_results, f, indent=2, ensure_ascii=False)
            print(f"[INFO] Replacement results saved to: {results_path}")
        except Exception as e:
            print(f"[WARNING] Failed to save replacement results: {e}")
