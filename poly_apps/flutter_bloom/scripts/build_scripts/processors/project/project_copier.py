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
Project Copier for Flutter Bloom Build System
Handles secure project copying to build directory
"""

import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional

from core.constants.build_constants import COMPILE_FACTORY_DIR, ORIGINAL_FLUTTER_ROOT
from core.gvar.variable_manager import VariableManager

class ProjectCopier:
    """Handles secure project copying for safe compilation"""
    
    def __init__(self):
        self.flutter_root = Path(ORIGINAL_FLUTTER_ROOT)
        self.compile_factory = Path(COMPILE_FACTORY_DIR)
        
        # Ensure compile factory directory exists
        self.compile_factory.mkdir(exist_ok=True)
    
    def generate_working_directory_name(self, app_name: str) -> str:
        """Generate working directory name with timestamp"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return f"flutter_bloom_{app_name}_{timestamp}"
    
    def copy_project_to_build_dir(self, app_name: str) -> Optional[str]:
        """Copy Flutter project to build directory for safe compilation"""
        working_dir_name = self.generate_working_directory_name(app_name)
        working_dir = self.compile_factory / working_dir_name
        
        print(f"[INFO] Copying Flutter project to: {working_dir}")
        print(f"[INFO] Source: {self.flutter_root}")
        
        try:
            # Copy entire Flutter project
            shutil.copytree(
                str(self.flutter_root),
                str(working_dir),
                ignore=shutil.ignore_patterns(
                    '.git', '.dart_tool', 'build', '.cache',
                    '*.log', '__pycache__', '*.pyc', '.vscode',
                    '.idea', '*.tmp', '*.temp'
                )
            )
            
            print("[SUCCESS] Project copied successfully")
            
            # Store working directory in variable system
            VariableManager.set("working_directory", str(working_dir))
            VariableManager.set("copy_timestamp", datetime.now().isoformat())
            VariableManager.set("source_directory", str(self.flutter_root))
            
            return str(working_dir)
            
        except Exception as e:
            print(f"[ERROR] Failed to copy project: {e}")
            return None
    
    def cleanup_old_builds(self, keep_count: int = 5) -> None:
        """Clean up old build directories, keeping only the most recent ones"""
        try:
            # Get all flutter_bloom directories
            build_dirs = []
            for item in self.compile_factory.iterdir():
                if item.is_dir() and item.name.startswith("flutter_bloom_"):
                    build_dirs.append(item)
            
            # Sort by modification time (newest first)
            build_dirs.sort(key=lambda x: x.stat().st_mtime, reverse=True)
            
            # Remove old directories
            for old_dir in build_dirs[keep_count:]:
                print(f"[INFO] Cleaning up old build: {old_dir.name}")
                shutil.rmtree(str(old_dir))
            
            print(f"[INFO] Cleanup completed, kept {min(len(build_dirs), keep_count)} recent builds")
            
        except Exception as e:
            print(f"[WARNING] Failed to cleanup old builds: {e}")
    
    def create_backup_info(self, working_dir: str, app_name: str) -> None:
        """Create backup information file"""
        backup_info = {
            "app_name": app_name,
            "source_directory": str(self.flutter_root),
            "working_directory": working_dir,
            "copy_timestamp": datetime.now().isoformat(),
            "build_parameters": VariableManager.get_build_parameters()
        }
        
        backup_file = os.path.join(working_dir, "build_info.json")
        
        try:
            import json
            with open(backup_file, 'w', encoding='utf-8') as f:
                json.dump(backup_info, f, indent=2, ensure_ascii=False)
            
            print(f"[INFO] Build info saved to: {backup_file}")
            
        except Exception as e:
            print(f"[WARNING] Failed to save build info: {e}")
    
    def verify_copy_integrity(self, working_dir: str) -> bool:
        """Verify that the copied project is complete"""
        required_files = [
            "pubspec.yaml",
            "lib/main.dart",
            "android/app/build.gradle"
        ]
        
        for required_file in required_files:
            file_path = os.path.join(working_dir, required_file)
            if not os.path.exists(file_path):
                print(f"[ERROR] Missing required file: {required_file}")
                return False
        
        print("[SUCCESS] Copy integrity verified")
        return True
