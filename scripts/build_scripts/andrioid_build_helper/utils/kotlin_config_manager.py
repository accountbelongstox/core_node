#!/usr/bin/env python3
"""
Kotlin Configuration Manager
Handles Kotlin incremental compilation configuration
"""

import os
import re
from pathlib import Path
from typing import Dict, Any, List


class KotlinConfigManager:
    """
    Manages Kotlin configuration for gradle.properties
    """
    
    def __init__(self, project_root: str = ""):
        """
        Initialize Kotlin config manager
        Args:
            project_root: Root directory of the Flutter project
        """
        self.project_root = project_root or os.getcwd()
        self.gradle_properties_path = Path(self.project_root) / "android" / "gradle.properties"
        
        # Kotlin properties to ensure are present
        self.kotlin_properties = [
            "kotlin.incremental=false",
            "kotlin.incremental.android=false", 
            "kotlin.incremental.js=false",
            "kotlin.incremental.multiplatform=false"
        ]
    
    def check_gradle_properties_exists(self) -> bool:
        """
        Check if gradle.properties file exists
        Returns:
            True if file exists, False otherwise
        """
        return self.gradle_properties_path.exists()
    
    def read_gradle_properties(self) -> str:
        """
        Read gradle.properties content
        Returns:
            File content as string
        """
        if not self.check_gradle_properties_exists():
            return ""
        
        try:
            return self.gradle_properties_path.read_text(encoding='utf-8')
        except (OSError, IOError):
            return ""
    
    def check_kotlin_properties(self) -> Dict[str, bool]:
        """
        Check which Kotlin properties are missing
        Returns:
            Dictionary with property names and their presence status
        """
        content = self.read_gradle_properties()
        result = {}
        
        for prop in self.kotlin_properties:
            prop_name = prop.split('=')[0]
            result[prop_name] = prop_name in content
        
        return result
    
    def needs_kotlin_fix(self) -> bool:
        """
        Check if Kotlin fix is needed
        Returns:
            True if any Kotlin properties are missing
        """
        properties_status = self.check_kotlin_properties()
        return not all(properties_status.values())
    
    def add_missing_kotlin_properties(self) -> Dict[str, Any]:
        """
        Add missing Kotlin properties to gradle.properties
        Returns:
            Dictionary with operation results
        """
        result = {
            "success": False,
            "added_properties": [],
            "error": None,
            "file_created": False
        }
        
        try:
            content = self.read_gradle_properties()
            properties_status = self.check_kotlin_properties()
            
            # Find missing properties
            missing_properties = []
            for prop in self.kotlin_properties:
                prop_name = prop.split('=')[0]
                if not properties_status[prop_name]:
                    missing_properties.append(prop)
            
            if missing_properties:
                # Add missing properties
                if content.strip():
                    # File exists, append to it
                    new_content = content.rstrip() + "\n" + "\n".join(missing_properties) + "\n"
                else:
                    # File doesn't exist or is empty, create new content
                    new_content = "\n".join(missing_properties) + "\n"
                    result["file_created"] = True
                
                # Write to file
                self.gradle_properties_path.parent.mkdir(parents=True, exist_ok=True)
                self.gradle_properties_path.write_text(new_content, encoding='utf-8')
                
                result["success"] = True
                result["added_properties"] = missing_properties
            else:
                result["success"] = True  # No missing properties
                
        except Exception as e:
            result["error"] = str(e)
        
        return result
    
    def get_kotlin_config_info(self) -> Dict[str, Any]:
        """
        Get comprehensive Kotlin configuration information
        Returns:
            Dictionary with Kotlin configuration info
        """
        info = {
            "gradle_properties_path": str(self.gradle_properties_path),
            "exists": self.check_gradle_properties_exists(),
            "needs_fix": self.needs_kotlin_fix(),
            "properties_status": self.check_kotlin_properties(),
            "missing_properties": [],
            "all_properties": self.kotlin_properties
        }
        
        # Find missing properties
        for prop in self.kotlin_properties:
            prop_name = prop.split('=')[0]
            if not info["properties_status"][prop_name]:
                info["missing_properties"].append(prop)
        
        return info


def main():
    """
    Main function for command line usage
    """
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python kotlin_config_manager.py <command> [project_root]")
        print("Commands: check, fix, info")
        sys.exit(1)
    
    command = sys.argv[1]
    project_root = sys.argv[2] if len(sys.argv) > 2 else "."
    
    manager = KotlinConfigManager(project_root)
    
    if command == "check":
        needs_fix = manager.needs_kotlin_fix()
        print(f"KOTLIN_FIX_NEEDED={needs_fix}")
        sys.exit(0 if not needs_fix else 1)
    
    elif command == "fix":
        result = manager.add_missing_kotlin_properties()
        if result["success"]:
            if result["added_properties"]:
                print(f"KOTLIN_FIX_SUCCESS=Added {len(result['added_properties'])} properties")
            else:
                print("KOTLIN_FIX_SUCCESS=No missing properties")
        else:
            print(f"KOTLIN_FIX_ERROR={result['error']}")
            sys.exit(1)
    
    elif command == "info":
        info = manager.get_kotlin_config_info()
        print(f"KOTLIN_CONFIG_INFO={info}")
    
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)


if __name__ == "__main__":
    main()
