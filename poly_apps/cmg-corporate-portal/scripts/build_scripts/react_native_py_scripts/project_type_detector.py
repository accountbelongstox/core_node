"""
Project Type Detector
Detects project type by analyzing configuration files and dependencies
"""

import json
from pathlib import Path
from typing import Optional, Dict


class ProjectTypeDetector:
    """Detects project type from project directory"""
    
    PROJECT_TYPES = {
        "react": "React (Vite/CRA)",
        "react-native": "React Native",
        "nuxt": "Nuxt.js",
        "next": "Next.js",
        "vue": "Vue.js",
        "vite": "Vite",
        "unknown": "Unknown"
    }
    
    def __init__(self, project_path: str):
        """
        Initialize detector
        
        Args:
            project_path: Path to project root directory
        """
        self.project_path = Path(project_path)
    
    def detect(self) -> str:
        """
        Detect project type
        
        Returns:
            Project type key (e.g., "react", "nuxt", "next")
        """
        # Check for Nuxt.js
        if self._has_file("nuxt.config.ts") or self._has_file("nuxt.config.js"):
            return "nuxt"
        
        # Check for Next.js
        if self._has_file("next.config.js") or self._has_file("next.config.ts"):
            return "next"
        
        # Check package.json for dependencies
        package_json = self.project_path / "package.json"
        if package_json.exists():
            try:
                with open(package_json, 'r', encoding='utf-8') as f:
                    pkg_data = json.load(f)
                    dependencies = pkg_data.get("dependencies", {})
                    dev_dependencies = pkg_data.get("devDependencies", {})
                    all_deps = {**dependencies, **dev_dependencies}
                    
                    # Check for React Native
                    if "react-native" in all_deps:
                        if self._has_dir("android") or self._has_dir("ios"):
                            return "react-native"
                    
                    # Check for Vite
                    if self._has_file("vite.config.js") or self._has_file("vite.config.ts"):
                        if "react" in all_deps:
                            return "react"
                        elif "vue" in all_deps:
                            return "vue"
                        else:
                            return "vite"
                    
                    # Check for React (CRA or other)
                    if "react" in all_deps:
                        return "react"
                    
                    # Check for Vue
                    if "vue" in all_deps:
                        return "vue"
                        
            except Exception as e:
                print(f"[Warning] Error reading package.json: {e}")
        
        return "unknown"
    
    def get_package_manager(self) -> str:
        """
        Detect package manager from lock files
        
        Returns:
            Package manager name: "pnpm", "yarn", or "npm"
        """
        if self._has_file("pnpm-lock.yaml"):
            return "pnpm"
        elif self._has_file("yarn.lock"):
            return "yarn"
        elif self._has_file("package-lock.json"):
            return "npm"
        else:
            # Default to npm if no lock file found
            return "npm"
    
    def get_project_info(self) -> Dict[str, str]:
        """
        Get complete project information
        
        Returns:
            Dictionary with project type, package manager, and display name
        """
        project_type = self.detect()
        package_manager = self.get_package_manager()
        
        return {
            "type": project_type,
            "type_display": self.PROJECT_TYPES.get(project_type, "Unknown"),
            "package_manager": package_manager,
            "project_path": str(self.project_path)
        }
    
    def _has_file(self, filename: str) -> bool:
        """Check if file exists in project path"""
        return (self.project_path / filename).exists()
    
    def _has_dir(self, dirname: str) -> bool:
        """Check if directory exists in project path"""
        return (self.project_path / dirname).is_dir()


def detect_project_type(project_path: str) -> Dict[str, str]:
    """
    Convenience function to detect project type
    
    Args:
        project_path: Path to project root directory
        
    Returns:
        Dictionary with project information
    """
    detector = ProjectTypeDetector(project_path)
    return detector.get_project_info()


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python project_type_detector.py <project_path>")
        sys.exit(1)
    
    project_path = sys.argv[1]
    info = detect_project_type(project_path)
    
    print(f"Project Type: {info['type_display']} ({info['type']})")
    print(f"Package Manager: {info['package_manager']}")
    print(f"Project Path: {info['project_path']}")

