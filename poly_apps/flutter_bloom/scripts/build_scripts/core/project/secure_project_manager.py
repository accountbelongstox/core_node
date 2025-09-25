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
Secure Project Manager
Handles secure project copying to build directory with timestamped naming
"""

import os
import shutil
import time
from datetime import datetime
from typing import Optional

class SecureProjectManager:
    """Manages secure project copying and build directory creation"""
    
    def __init__(self, flutter_bloom_root: str):
        self.flutter_bloom_root = flutter_bloom_root
        self.build_base_dir = r"D:\programing\.build_dir"
        self.compile_factory_dir = os.path.join(self.build_base_dir, "compile_factory")
        self.working_directory = None
    
    def create_secure_build_directory(self, app_name: str) -> str:
        """Create secure build directory with timestamped naming"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        build_dir_name = f"{app_name}_{timestamp}"
        self.working_directory = os.path.join(self.build_base_dir, build_dir_name)
        
        print(f"[INFO] Creating secure build directory: {self.working_directory}")
        
        # Ensure base build directory exists
        os.makedirs(self.build_base_dir, exist_ok=True)
        
        # Create compile factory directory
        os.makedirs(self.compile_factory_dir, exist_ok=True)
        
        # Copy Flutter Bloom project to working directory
        if os.path.exists(self.working_directory):
            print(f"[WARNING] Build directory already exists, removing: {self.working_directory}")
            shutil.rmtree(self.working_directory)
        
        print(f"[INFO] Copying project from {self.flutter_bloom_root} to {self.working_directory}")
        shutil.copytree(self.flutter_bloom_root, self.working_directory, 
                       ignore=shutil.ignore_patterns('*.pyc', '__pycache__', '.git', 'build', '.dart_tool'))
        
        print(f"[SUCCESS] Project copied to: {self.working_directory}")
        return self.working_directory
    
    def verify_project_structure(self) -> bool:
        """Verify that the copied project has the correct structure"""
        if not self.working_directory or not os.path.exists(self.working_directory):
            print(f"[ERROR] Working directory does not exist: {self.working_directory}")
            return False
        
        required_files = [
            "pubspec.yaml",
            "lib",
            "android",
            "web"
        ]
        
        for required_file in required_files:
            file_path = os.path.join(self.working_directory, required_file)
            if not os.path.exists(file_path):
                print(f"[ERROR] Required file/directory missing: {required_file}")
                return False
        
        print(f"[SUCCESS] Project structure verified")
        return True
    
    def cleanup_old_builds(self, max_age_hours: int = 24):
        """Clean up old build directories older than max_age_hours"""
        if not os.path.exists(self.build_base_dir):
            return
        
        current_time = time.time()
        max_age_seconds = max_age_hours * 3600
        
        for item in os.listdir(self.build_base_dir):
            item_path = os.path.join(self.build_base_dir, item)
            
            # Skip compile_factory and other special directories
            if item == "compile_factory" or item == "build_apps_static_resources":
                continue
            
            if os.path.isdir(item_path):
                # Check if directory name matches app_timestamp pattern
                if "_" in item and len(item.split("_")[-1]) == 15:  # timestamp format YYYYMMDD_HHMMSS
                    try:
                        timestamp_str = item.split("_")[-1]
                        timestamp = datetime.strptime(timestamp_str, "%H%M%S")
                        
                        # Get directory creation time
                        dir_time = os.path.getctime(item_path)
                        
                        if current_time - dir_time > max_age_seconds:
                            print(f"[INFO] Removing old build directory: {item}")
                            shutil.rmtree(item_path)
                    except (ValueError, OSError) as e:
                        print(f"[WARNING] Could not process directory {item}: {str(e)}")
    
    def get_external_resources_directory(self) -> str:
        """Get external resources directory path"""
        external_resources_dir = os.path.join(self.build_base_dir, "build_apps_static_resources")
        os.makedirs(external_resources_dir, exist_ok=True)
        return external_resources_dir
    
    def get_working_directory(self) -> Optional[str]:
        """Get current working directory"""
        return self.working_directory
