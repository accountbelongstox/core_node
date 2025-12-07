#!/usr/bin/env python3

"""
Build Validator Module
Validates build requirements and verifies build outputs.
Follows architecture rule: Python only validates and organizes data, no command execution.
"""

import json
from pathlib import Path
from typing import Dict, List, Tuple
from keys_center import KeysCenter
from file_var_handler import FileVarHandler


class BuildValidator:
    """Validates build requirements and outputs"""

    def __init__(self):
        self.var_handler = FileVarHandler()

    def validate_build_requirements(self, project_path: str, project_type: str,
                                    action: str, validation_info: Dict) -> Tuple[bool, Dict]:
        """
        Validates that all requirements for a build are met.

        Args:
            project_path: Absolute path to project directory
            project_type: Project type constant from KeysCenter
            action: Action being performed (debug, build, etc.)
            validation_info: Info dict from project validation

        Returns:
            Tuple of (requirements_met, build_requirements)
        """
        project_path = Path(project_path)

        requirements = {
            "ready_to_build": True,
            "missing_requirements": [],
            "build_command": None,
            "expected_output": None,
            "pre_build_checks": [],
            "warnings": [],
        }

        if project_type in [KeysCenter.PROJECT_TYPE_NUXT, KeysCenter.PROJECT_TYPE_NEXT,
                            KeysCenter.PROJECT_TYPE_REACT, KeysCenter.PROJECT_TYPE_REACT_NATIVE,
                            KeysCenter.PROJECT_TYPE_VUE, KeysCenter.PROJECT_TYPE_VITE]:
            return self._validate_node_build_requirements(
                project_path, project_type, action, validation_info, requirements
            )

        elif project_type == KeysCenter.PROJECT_TYPE_FLUTTER:
            return self._validate_flutter_build_requirements(
                project_path, action, requirements
            )

        return True, requirements

    def _validate_node_build_requirements(self, project_path: Path, project_type: str,
                                         action: str, validation_info: Dict,
                                         requirements: Dict) -> Tuple[bool, Dict]:
        """Validates Node.js build requirements"""

        scripts = validation_info.get("scripts", {})
        package_manager = validation_info.get("package_manager", "npm")

        # Map action to script command
        action_to_script = {
            KeysCenter.ACTION_DEBUG: ["dev", "start"],
            KeysCenter.ACTION_BUILD: ["build"],
            KeysCenter.ACTION_GENERATE: ["generate"],
            KeysCenter.ACTION_PREVIEW: ["preview"],
        }

        required_scripts = action_to_script.get(action, ["build"])

        # Check if required script exists
        script_found = None
        for script_name in required_scripts:
            if script_name in scripts:
                script_found = script_name
                break

        if not script_found:
            requirements["ready_to_build"] = False
            requirements["missing_requirements"].append(
                f"No '{'/'.join(required_scripts)}' script found in package.json"
            )
            return False, requirements

        # Set build command
        requirements["build_command"] = f"{package_manager} run {script_found}"

        # Set expected output based on project type and action
        if action == KeysCenter.ACTION_BUILD or action == KeysCenter.ACTION_GENERATE:
            expected_output = self._get_expected_build_output(project_type)
            requirements["expected_output"] = expected_output

            # Add pre-build checks
            requirements["pre_build_checks"].append({
                "check": "verify_output_dir_cleanup",
                "message": "Ensure old build artifacts are cleaned up",
            })

        # Add warnings for common issues
        if action == KeysCenter.ACTION_BUILD:
            # Check for common build tools
            if project_type in [KeysCenter.PROJECT_TYPE_REACT, KeysCenter.PROJECT_TYPE_VUE]:
                if not validation_info.get("config_file"):
                    requirements["warnings"].append(
                        "No build config file detected - build may fail"
                    )

            # Warn if disk space might be an issue
            requirements["pre_build_checks"].append({
                "check": "disk_space",
                "message": "Verify sufficient disk space for build artifacts",
            })

        return True, requirements

    def _validate_flutter_build_requirements(self, project_path: Path,
                                            action: str, requirements: Dict) -> Tuple[bool, Dict]:
        """Validates Flutter build requirements"""

        requirements["build_command"] = "flutter build"
        requirements["warnings"].append(
            "Flutter builds require Flutter SDK in PATH"
        )

        return True, requirements

    def _get_expected_build_output(self, project_type: str) -> Dict:
        """Returns expected build output directory and files for validation"""

        output_configs = {
            KeysCenter.PROJECT_TYPE_NUXT: {
                "directory": ".output",
                "critical_files": [".output/server/index.mjs"],
                "critical_dirs": [".output/server", ".output/public"],
            },
            KeysCenter.PROJECT_TYPE_NEXT: {
                "directory": ".next",
                "critical_files": [],
                "critical_dirs": [".next/server", ".next/static"],
            },
            KeysCenter.PROJECT_TYPE_REACT: {
                "directory": "dist",
                "alternative_directories": ["build", "out"],
                "critical_files": ["index.html"],
                "critical_dirs": [],
            },
            KeysCenter.PROJECT_TYPE_VUE: {
                "directory": "dist",
                "alternative_directories": ["build"],
                "critical_files": ["index.html"],
                "critical_dirs": [],
            },
            KeysCenter.PROJECT_TYPE_VITE: {
                "directory": "dist",
                "alternative_directories": ["build"],
                "critical_files": ["index.html"],
                "critical_dirs": [],
            },
        }

        return output_configs.get(project_type, {
            "directory": "dist",
            "critical_files": [],
            "critical_dirs": [],
        })

    def validate_build_output(self, project_path: str, project_type: str,
                             expected_output: Dict) -> Tuple[bool, Dict]:
        """
        Validates that build output was created successfully.

        Args:
            project_path: Absolute path to project directory
            project_type: Project type constant from KeysCenter
            expected_output: Expected output config from validate_build_requirements

        Returns:
            Tuple of (build_succeeded, output_validation)
        """
        project_path = Path(project_path)

        validation = {
            "output_exists": False,
            "output_directory": None,
            "missing_critical_files": [],
            "missing_critical_dirs": [],
            "output_size": 0,
            "warnings": [],
        }

        # Check primary output directory
        output_dir = expected_output.get("directory")
        if output_dir:
            primary_path = project_path / output_dir
            if primary_path.exists():
                validation["output_exists"] = True
                validation["output_directory"] = output_dir
            else:
                # Check alternative directories
                alt_dirs = expected_output.get("alternative_directories", [])
                for alt_dir in alt_dirs:
                    alt_path = project_path / alt_dir
                    if alt_path.exists():
                        validation["output_exists"] = True
                        validation["output_directory"] = alt_dir
                        break

        if not validation["output_exists"]:
            return False, validation

        # Check critical files
        critical_files = expected_output.get("critical_files", [])
        for critical_file in critical_files:
            file_path = project_path / critical_file
            if not file_path.exists():
                validation["missing_critical_files"].append(critical_file)

        # Check critical directories
        critical_dirs = expected_output.get("critical_dirs", [])
        for critical_dir in critical_dirs:
            dir_path = project_path / critical_dir
            if not dir_path.exists():
                validation["missing_critical_dirs"].append(critical_dir)

        # Calculate output size
        output_path = project_path / validation["output_directory"]
        if output_path.exists():
            total_size = sum(
                f.stat().st_size for f in output_path.rglob('*') if f.is_file()
            )
            validation["output_size"] = total_size

            # Warn if output seems too small
            if total_size < 1024:  # Less than 1KB
                validation["warnings"].append(
                    f"Build output is very small ({total_size} bytes) - build may be incomplete"
                )

        # Check if build succeeded
        build_succeeded = (
            validation["output_exists"] and
            not validation["missing_critical_files"] and
            not validation["missing_critical_dirs"]
        )

        return build_succeeded, validation

    def save_build_validation(self, project_name: str, validation: Dict):
        """Saves build validation result to file variable for shell script to read"""

        key = f"POLY_APP_BUILD_VALIDATION_{project_name.upper()}"
        result_json = json.dumps(validation)
        self.var_handler.set_var(key, result_json)

    def get_build_validation_summary(self, validation: Dict) -> str:
        """Generates a human-readable build validation summary"""

        lines = []

        if validation.get("output_exists"):
            lines.append(f"✓ Build output found: {validation['output_directory']}")

            if validation.get("output_size"):
                size_mb = validation["output_size"] / (1024 * 1024)
                lines.append(f"  Size: {size_mb:.2f} MB")
        else:
            lines.append("✗ Build output directory not found")

        if validation.get("missing_critical_files"):
            lines.append("\nMissing critical files:")
            for file in validation["missing_critical_files"]:
                lines.append(f"  ✗ {file}")

        if validation.get("missing_critical_dirs"):
            lines.append("\nMissing critical directories:")
            for dir in validation["missing_critical_dirs"]:
                lines.append(f"  ✗ {dir}")

        if validation.get("warnings"):
            lines.append("\nWarnings:")
            for warning in validation["warnings"]:
                lines.append(f"  ⚠ {warning}")

        return "\n".join(lines)

    def get_requirements_summary(self, requirements: Dict) -> str:
        """Generates a human-readable build requirements summary"""

        lines = []

        if requirements["ready_to_build"]:
            lines.append("✓ Ready to build")
        else:
            lines.append("✗ Not ready to build")

        if requirements["missing_requirements"]:
            lines.append("\nMissing requirements:")
            for req in requirements["missing_requirements"]:
                lines.append(f"  ✗ {req}")

        if requirements["build_command"]:
            lines.append(f"\nBuild command: {requirements['build_command']}")

        if requirements["expected_output"]:
            output_dir = requirements["expected_output"].get("directory")
            if output_dir:
                lines.append(f"Expected output: {output_dir}/")

        if requirements["warnings"]:
            lines.append("\nWarnings:")
            for warning in requirements["warnings"]:
                lines.append(f"  ⚠ {warning}")

        return "\n".join(lines)


if __name__ == "__main__":
    import sys
    from pathlib import Path

    if len(sys.argv) < 4:
        print("Usage: python3 build_validator.py <project_path> <project_type> <action> [project_name]")
        sys.exit(1)

    project_path = sys.argv[1]
    project_type = sys.argv[2]
    action = sys.argv[3]
    project_name = sys.argv[4] if len(sys.argv) > 4 else Path(project_path).name

    validator = BuildValidator()

    # Try to load validation info from file variable
    validation_key = f"POLY_APP_VALIDATION_{project_name.upper()}"
    validation_json = validator.var_handler.get_var(validation_key, "")

    if validation_json:
        try:
            validation_data = json.loads(validation_json)
            validation_info = validation_data.get("info", {})
        except:
            validation_info = {"scripts": {}, "package_manager": "npm"}
    else:
        validation_info = {"scripts": {}, "package_manager": "npm"}

    ready, requirements = validator.validate_build_requirements(
        project_path, project_type, action, validation_info
    )

    print(validator.get_requirements_summary(requirements))

    if not ready:
        sys.exit(1)
