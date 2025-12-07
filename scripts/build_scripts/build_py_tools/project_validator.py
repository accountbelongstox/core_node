#!/usr/bin/env python3

"""
Project Validator Module
Validates project configuration and structure before build operations.
Follows architecture rule: Python only validates and organizes data, no command execution.
"""

import json
from pathlib import Path
from typing import Dict, List, Tuple
from keys_center import KeysCenter
from file_var_handler import FileVarHandler


class ProjectValidator:
    """Validates project state and configuration files"""

    def __init__(self):
        self.var_handler = FileVarHandler()
        self.validation_results = {}

    def validate_project(self, project_path: str, project_type: str) -> Tuple[bool, Dict]:
        """
        Validates a project's configuration and structure.

        Args:
            project_path: Absolute path to project directory
            project_type: Project type constant from KeysCenter

        Returns:
            Tuple of (is_valid, validation_details)
        """
        project_path = Path(project_path)

        validation = {
            "valid": True,
            "errors": [],
            "warnings": [],
            "info": {},
        }

        # Check if project directory exists
        if not project_path.exists():
            validation["valid"] = False
            validation["errors"].append({
                "code": "PROJECT_NOT_FOUND",
                "message": f"Project directory does not exist: {project_path}",
                "solution": "Verify the project path is correct"
            })
            return False, validation

        # Validate based on project type
        if project_type in [KeysCenter.PROJECT_TYPE_NUXT, KeysCenter.PROJECT_TYPE_NEXT,
                            KeysCenter.PROJECT_TYPE_REACT, KeysCenter.PROJECT_TYPE_REACT_NATIVE,
                            KeysCenter.PROJECT_TYPE_VUE, KeysCenter.PROJECT_TYPE_VITE]:
            self._validate_node_project(project_path, project_type, validation)

        elif project_type == KeysCenter.PROJECT_TYPE_FLUTTER:
            self._validate_flutter_project(project_path, validation)

        elif project_type == KeysCenter.PROJECT_TYPE_LARAVEL:
            self._validate_laravel_project(project_path, validation)

        return validation["valid"], validation

    def _validate_node_project(self, project_path: Path, project_type: str, validation: Dict):
        """Validates Node.js-based projects"""

        # Check package.json
        package_json = project_path / "package.json"
        if not package_json.exists():
            validation["valid"] = False
            validation["errors"].append({
                "code": "PACKAGE_JSON_NOT_FOUND",
                "message": "package.json file not found",
                "solution": "Ensure the project is a valid Node.js project"
            })
            return

        # Parse package.json
        try:
            with open(package_json, 'r', encoding='utf-8') as f:
                pkg_data = json.load(f)
                validation["info"]["package_name"] = pkg_data.get("name", "unknown")
                validation["info"]["version"] = pkg_data.get("version", "unknown")
                validation["info"]["scripts"] = pkg_data.get("scripts", {})
                validation["info"]["dependencies"] = pkg_data.get("dependencies", {})
                validation["info"]["devDependencies"] = pkg_data.get("devDependencies", {})
        except json.JSONDecodeError as e:
            validation["valid"] = False
            validation["errors"].append({
                "code": "PACKAGE_JSON_INVALID",
                "message": f"package.json is not valid JSON: {e}",
                "solution": "Fix JSON syntax errors in package.json"
            })
            return
        except Exception as e:
            validation["valid"] = False
            validation["errors"].append({
                "code": "PACKAGE_JSON_READ_ERROR",
                "message": f"Failed to read package.json: {e}",
                "solution": "Check file permissions and encoding"
            })
            return

        # Check for framework-specific config files
        self._validate_framework_configs(project_path, project_type, validation)

        # Check node_modules
        node_modules = project_path / "node_modules"
        if not node_modules.exists():
            validation["warnings"].append({
                "code": "NODE_MODULES_MISSING",
                "message": "node_modules directory not found",
                "solution": "Run 'npm install' or 'pnpm install' to install dependencies",
                "auto_fixable": True
            })
            validation["info"]["dependencies_installed"] = False
        else:
            # Check if node_modules is empty or incomplete
            if not any(node_modules.iterdir()):
                validation["warnings"].append({
                    "code": "NODE_MODULES_EMPTY",
                    "message": "node_modules directory is empty",
                    "solution": "Run 'npm install' or 'pnpm install' to install dependencies",
                    "auto_fixable": True
                })
                validation["info"]["dependencies_installed"] = False
            else:
                validation["info"]["dependencies_installed"] = True

        # Detect package manager
        package_manager = self._detect_package_manager(project_path)
        validation["info"]["package_manager"] = package_manager
        validation["info"]["lock_files"] = self._detect_lock_files(project_path)

        # Validate build scripts
        scripts = validation["info"].get("scripts", {})
        if not scripts.get("build"):
            validation["warnings"].append({
                "code": "BUILD_SCRIPT_MISSING",
                "message": "No 'build' script found in package.json",
                "solution": "Add a 'build' script to package.json"
            })

        if not scripts.get("dev") and not scripts.get("start"):
            validation["warnings"].append({
                "code": "DEV_SCRIPT_MISSING",
                "message": "No 'dev' or 'start' script found in package.json",
                "solution": "Add a 'dev' or 'start' script to package.json"
            })

    def _validate_framework_configs(self, project_path: Path, project_type: str, validation: Dict):
        """Validates framework-specific configuration files"""

        config_checks = {
            KeysCenter.PROJECT_TYPE_NUXT: ["nuxt.config.ts", "nuxt.config.js"],
            KeysCenter.PROJECT_TYPE_NEXT: ["next.config.js", "next.config.ts"],
            KeysCenter.PROJECT_TYPE_VITE: ["vite.config.js", "vite.config.ts"],
            KeysCenter.PROJECT_TYPE_REACT: ["vite.config.js", "vite.config.ts", "webpack.config.js"],
            KeysCenter.PROJECT_TYPE_VUE: ["vite.config.js", "vite.config.ts", "vue.config.js"],
        }

        required_configs = config_checks.get(project_type, [])
        if required_configs:
            config_found = False
            for config_file in required_configs:
                if (project_path / config_file).exists():
                    config_found = True
                    validation["info"]["config_file"] = config_file
                    break

            if not config_found:
                validation["warnings"].append({
                    "code": "CONFIG_FILE_MISSING",
                    "message": f"No configuration file found for {project_type}",
                    "expected": required_configs,
                    "solution": f"Create a configuration file: {required_configs[0]}"
                })

    def _detect_package_manager(self, project_path: Path) -> str:
        """Detects the recommended package manager based on lock files"""

        lock_files = self._detect_lock_files(project_path)

        if "pnpm-lock.yaml" in lock_files:
            return "pnpm"
        elif "yarn.lock" in lock_files:
            return "yarn"
        elif "package-lock.json" in lock_files:
            return "npm"
        else:
            # No lock file, default to npm
            return "npm"

    def _detect_lock_files(self, project_path: Path) -> List[str]:
        """Detects which lock files are present"""

        lock_files = []
        possible_locks = ["pnpm-lock.yaml", "yarn.lock", "package-lock.json"]

        for lock_file in possible_locks:
            if (project_path / lock_file).exists():
                lock_files.append(lock_file)

        return lock_files

    def _validate_flutter_project(self, project_path: Path, validation: Dict):
        """Validates Flutter projects"""

        pubspec = project_path / "pubspec.yaml"
        if not pubspec.exists():
            validation["valid"] = False
            validation["errors"].append({
                "code": "PUBSPEC_NOT_FOUND",
                "message": "pubspec.yaml file not found",
                "solution": "Ensure the project is a valid Flutter project"
            })
            return

        # Check for Flutter SDK in environment
        validation["info"]["project_type"] = "flutter"
        validation["warnings"].append({
            "code": "FLUTTER_SDK_CHECK_REQUIRED",
            "message": "Flutter SDK availability should be verified",
            "solution": "Shell script should run 'flutter --version' to verify SDK"
        })

    def _validate_laravel_project(self, project_path: Path, validation: Dict):
        """Validates Laravel projects"""

        composer_json = project_path / "composer.json"
        if not composer_json.exists():
            validation["valid"] = False
            validation["errors"].append({
                "code": "COMPOSER_JSON_NOT_FOUND",
                "message": "composer.json file not found",
                "solution": "Ensure the project is a valid Laravel project"
            })
            return

        artisan = project_path / "artisan"
        if not artisan.exists():
            validation["valid"] = False
            validation["errors"].append({
                "code": "ARTISAN_NOT_FOUND",
                "message": "artisan file not found",
                "solution": "Ensure the project is a valid Laravel project"
            })
            return

        vendor_dir = project_path / "vendor"
        if not vendor_dir.exists():
            validation["warnings"].append({
                "code": "VENDOR_DIR_MISSING",
                "message": "vendor directory not found",
                "solution": "Run 'composer install' to install dependencies",
                "auto_fixable": True
            })
            validation["info"]["dependencies_installed"] = False
        else:
            validation["info"]["dependencies_installed"] = True

    def save_validation_result(self, project_name: str, validation: Dict):
        """Saves validation result to file variable for shell script to read"""

        key = f"POLY_APP_VALIDATION_{project_name.upper()}"
        result_json = json.dumps(validation)
        self.var_handler.set_var(key, result_json)

    def get_validation_summary(self, validation: Dict) -> str:
        """Generates a human-readable validation summary"""

        lines = []

        if validation["valid"]:
            lines.append("✓ Project validation passed")
        else:
            lines.append("✗ Project validation failed")

        if validation["errors"]:
            lines.append("\nErrors:")
            for error in validation["errors"]:
                lines.append(f"  ✗ [{error['code']}] {error['message']}")
                lines.append(f"    Solution: {error['solution']}")

        if validation["warnings"]:
            lines.append("\nWarnings:")
            for warning in validation["warnings"]:
                lines.append(f"  ⚠ [{warning['code']}] {warning['message']}")
                lines.append(f"    Solution: {warning['solution']}")

        if validation["info"]:
            lines.append("\nProject Info:")
            for key, value in validation["info"].items():
                if isinstance(value, (list, dict)) and value:
                    lines.append(f"  {key}: {json.dumps(value, indent=2)}")
                elif not isinstance(value, (list, dict)):
                    lines.append(f"  {key}: {value}")

        return "\n".join(lines)


if __name__ == "__main__":
    import sys
    from pathlib import Path

    if len(sys.argv) < 3:
        print("Usage: python3 project_validator.py <project_path> <project_type> [project_name]")
        sys.exit(1)

    project_path = sys.argv[1]
    project_type = sys.argv[2]
    project_name = sys.argv[3] if len(sys.argv) > 3 else Path(project_path).name

    validator = ProjectValidator()
    is_valid, validation = validator.validate_project(project_path, project_type)

    # Save validation result to file variable
    validator.save_validation_result(project_name, validation)

    # Print summary
    print(validator.get_validation_summary(validation))

    if not is_valid:
        sys.exit(1)
