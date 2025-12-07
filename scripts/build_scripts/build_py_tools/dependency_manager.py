#!/usr/bin/env python3

"""
Dependency Manager Module
Checks dependency status and generates installation commands for shell execution.
Follows architecture rule: Python only analyzes and organizes data, no command execution.
"""

import json
from pathlib import Path
from typing import Dict, List, Tuple
from keys_center import KeysCenter
from file_var_handler import FileVarHandler


class DependencyManager:
    """Manages dependency checking and generates installation commands"""

    def __init__(self):
        self.var_handler = FileVarHandler()

    def check_dependencies(self, project_path: str, project_type: str,
                          validation_info: Dict) -> Tuple[bool, Dict]:
        """
        Checks if project dependencies are installed and need updating.

        Args:
            project_path: Absolute path to project directory
            project_type: Project type constant from KeysCenter
            validation_info: Info dict from project validation

        Returns:
            Tuple of (dependencies_ok, dependency_status)
        """
        project_path = Path(project_path)

        status = {
            "installed": False,
            "missing": [],
            "package_manager": None,
            "install_command": None,
            "check_commands": [],
            "recommendations": [],
        }

        if project_type in [KeysCenter.PROJECT_TYPE_NUXT, KeysCenter.PROJECT_TYPE_NEXT,
                            KeysCenter.PROJECT_TYPE_REACT, KeysCenter.PROJECT_TYPE_REACT_NATIVE,
                            KeysCenter.PROJECT_TYPE_VUE, KeysCenter.PROJECT_TYPE_VITE]:
            return self._check_node_dependencies(project_path, validation_info, status)

        elif project_type == KeysCenter.PROJECT_TYPE_FLUTTER:
            return self._check_flutter_dependencies(project_path, status)

        elif project_type == KeysCenter.PROJECT_TYPE_LARAVEL:
            return self._check_laravel_dependencies(project_path, status)

        return True, status

    def _check_node_dependencies(self, project_path: Path,
                                 validation_info: Dict, status: Dict) -> Tuple[bool, Dict]:
        """Checks Node.js project dependencies"""

        node_modules = project_path / "node_modules"
        package_json = project_path / "package.json"

        # Get package manager from validation
        package_manager = validation_info.get("package_manager", "npm")
        status["package_manager"] = package_manager

        # Add check commands for shell script
        status["check_commands"] = [
            {"tool": "node", "check": "node --version"},
            {package_manager: True, "check": f"{package_manager} --version"},
        ]

        # Check if node_modules exists and is populated
        if not node_modules.exists() or not any(node_modules.iterdir()):
            status["installed"] = False
            status["missing"].append("node_modules")

            # Generate install command
            if package_manager == "pnpm":
                status["install_command"] = "pnpm install"
                status["recommendations"].append(
                    "Using pnpm (detected from pnpm-lock.yaml)"
                )
            elif package_manager == "yarn":
                status["install_command"] = "yarn install"
                status["recommendations"].append(
                    "Using yarn (detected from yarn.lock)"
                )
            else:
                status["install_command"] = "npm install"
                status["recommendations"].append(
                    "Using npm (detected from package-lock.json or default)"
                )

            return False, status

        # Check for critical dependencies
        if package_json.exists():
            try:
                with open(package_json, 'r', encoding='utf-8') as f:
                    pkg_data = json.load(f)
                    dependencies = pkg_data.get("dependencies", {})
                    dev_dependencies = pkg_data.get("devDependencies", {})

                    # Check if critical packages are installed
                    critical_missing = self._check_critical_packages(
                        node_modules, dependencies, dev_dependencies
                    )

                    if critical_missing:
                        status["installed"] = False
                        status["missing"].extend(critical_missing)
                        status["install_command"] = f"{package_manager} install"
                        status["recommendations"].append(
                            f"Missing critical packages: {', '.join(critical_missing[:5])}"
                        )
                        return False, status

            except Exception as e:
                status["recommendations"].append(
                    f"Warning: Could not verify package installations: {e}"
                )

        status["installed"] = True
        status["recommendations"].append(
            f"Dependencies are installed using {package_manager}"
        )

        # Check for updates
        lock_files = validation_info.get("lock_files", [])
        if len(lock_files) > 1:
            status["recommendations"].append(
                f"Warning: Multiple lock files detected ({', '.join(lock_files)}). "
                f"Consider using only {package_manager}"
            )

        return True, status

    def _check_critical_packages(self, node_modules: Path,
                                 dependencies: Dict, dev_dependencies: Dict) -> List[str]:
        """Checks if critical packages are installed in node_modules"""

        missing = []
        all_deps = {**dependencies, **dev_dependencies}

        # Sample check for a few critical packages (not all, as that would be slow)
        # Check first 10 dependencies
        for dep_name in list(all_deps.keys())[:10]:
            dep_dir = node_modules / dep_name
            if not dep_dir.exists():
                missing.append(dep_name)

        return missing

    def _check_flutter_dependencies(self, project_path: Path, status: Dict) -> Tuple[bool, Dict]:
        """Checks Flutter project dependencies"""

        status["package_manager"] = "flutter"
        status["check_commands"] = [
            {"tool": "flutter", "check": "flutter --version"},
        ]

        pubspec_lock = project_path / "pubspec.lock"
        if not pubspec_lock.exists():
            status["installed"] = False
            status["missing"].append("pubspec.lock")
            status["install_command"] = "flutter pub get"
            status["recommendations"].append(
                "Run 'flutter pub get' to install Flutter dependencies"
            )
            return False, status

        status["installed"] = True
        status["recommendations"].append("Flutter dependencies appear to be installed")

        return True, status

    def _check_laravel_dependencies(self, project_path: Path, status: Dict) -> Tuple[bool, Dict]:
        """Checks Laravel project dependencies"""

        status["package_manager"] = "composer"
        status["check_commands"] = [
            {"tool": "php", "check": "php --version"},
            {"tool": "composer", "check": "composer --version"},
        ]

        vendor_dir = project_path / "vendor"
        if not vendor_dir.exists() or not any(vendor_dir.iterdir()):
            status["installed"] = False
            status["missing"].append("vendor")
            status["install_command"] = "composer install"
            status["recommendations"].append(
                "Run 'composer install' to install PHP dependencies"
            )
            return False, status

        status["installed"] = True
        status["recommendations"].append("Composer dependencies are installed")

        return True, status

    def generate_install_script(self, project_path: str, dependency_status: Dict) -> str:
        """
        Generates a shell script snippet for dependency installation.

        This follows the architecture rule: Python generates commands for shell to execute.
        """
        lines = []

        project_path = Path(project_path)
        lines.append(f"# Auto-generated dependency installation script")
        lines.append(f"cd \"{project_path}\"")
        lines.append("")

        # Check tool availability
        for cmd_info in dependency_status.get("check_commands", []):
            check_cmd = cmd_info.get("check")
            if check_cmd:
                tool_name = check_cmd.split()[0]
                lines.append(f"if ! command -v {tool_name} &> /dev/null; then")
                lines.append(f"    echo \"Error: {tool_name} is not installed\"")
                lines.append(f"    echo \"Please install {tool_name} first\"")
                lines.append(f"    exit 1")
                lines.append(f"fi")
                lines.append("")

        # Install dependencies
        install_cmd = dependency_status.get("install_command")
        if install_cmd:
            lines.append(f"echo \"Installing dependencies with: {install_cmd}\"")
            lines.append(f"{install_cmd}")
            lines.append("if [ $? -eq 0 ]; then")
            lines.append("    echo \"✓ Dependencies installed successfully\"")
            lines.append("else")
            lines.append("    echo \"✗ Failed to install dependencies\"")
            lines.append("    exit 1")
            lines.append("fi")

        return "\n".join(lines)

    def save_dependency_status(self, project_name: str, dependency_status: Dict):
        """Saves dependency status to file variable for shell script to read"""

        key = f"POLY_APP_DEPENDENCY_{project_name.upper()}"
        result_json = json.dumps(dependency_status)
        self.var_handler.set_var(key, result_json)

    def get_dependency_summary(self, dependency_status: Dict) -> str:
        """Generates a human-readable dependency summary"""

        lines = []

        if dependency_status["installed"]:
            lines.append("✓ Dependencies are installed")
        else:
            lines.append("✗ Dependencies are missing or incomplete")

        if dependency_status["missing"]:
            lines.append(f"\nMissing: {', '.join(dependency_status['missing'])}")

        if dependency_status["package_manager"]:
            lines.append(f"Package Manager: {dependency_status['package_manager']}")

        if dependency_status["install_command"]:
            lines.append(f"\nTo install dependencies, run:")
            lines.append(f"  {dependency_status['install_command']}")

        if dependency_status["recommendations"]:
            lines.append("\nRecommendations:")
            for rec in dependency_status["recommendations"]:
                lines.append(f"  • {rec}")

        return "\n".join(lines)


if __name__ == "__main__":
    import sys
    from pathlib import Path

    if len(sys.argv) < 3:
        print("Usage: python3 dependency_manager.py <project_path> <project_type> [project_name]")
        sys.exit(1)

    project_path = sys.argv[1]
    project_type = sys.argv[2]
    project_name = sys.argv[3] if len(sys.argv) > 3 else Path(project_path).name

    manager = DependencyManager()

    # Try to load validation info from file variable
    validation_key = f"POLY_APP_VALIDATION_{project_name.upper()}"
    validation_json = manager.var_handler.get_var(validation_key, "")

    if validation_json:
        try:
            validation_data = json.loads(validation_json)
            validation_info = validation_data.get("info", {})
        except:
            validation_info = {"package_manager": "npm", "lock_files": []}
    else:
        # Fallback to basic detection
        validation_info = {"package_manager": "npm", "lock_files": []}

    deps_ok, status = manager.check_dependencies(project_path, project_type, validation_info)

    # Save dependency status
    manager.save_dependency_status(project_name, status)

    # Print summary
    print(manager.get_dependency_summary(status))

    if not deps_ok:
        print("\n" + "="*70)
        print("Installation command:")
        print("="*70)
        if status.get("install_command"):
            print(f"cd \"{project_path}\"")
            print(status["install_command"])
        sys.exit(1)
