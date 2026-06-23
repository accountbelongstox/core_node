#!/usr/bin/env python3
"""
Build Orchestrator - Build orchestration script
Handles cross-platform differences, generates build commands and configuration
Does not execute shell commands, only generates variable files for Shell to read
"""

import os
import sys
import json
from pathlib import Path
from typing import Dict, List

# Import variable manager and variable definitions
from var_manager import get_instance as get_var_manager
from build_vars import BuildVars


class BuildOrchestrator:
    """Build orchestrator"""

    def __init__(self, project_root: str):
        """Initialize"""
        self.project_root = Path(project_root).resolve()
        self.vm = get_var_manager()
        self.platform = self.vm.platform

        # Path configuration: build in current directory (no _build_dir)
        # project_root: e.g. D:\programing\core_node\apps\mcp-chrome
        # Extension output: <mcp-chrome>/.output/build_extension (wxt outDir + outDirTemplate)
        self.build_output_dir = self.project_root / ".output"
        self.extension_path = self.build_output_dir / "build_extension"
        self.native_path = self.project_root / "app" / "native-server" / "dist"
        self.shared_path = self.project_root / "packages" / "shared" / "dist"

    def detect_environment(self):
        """Detect environment and save to variables"""
        print("Detecting environment...")

        # Basic information
        self.vm.set(BuildVars.PROJECT_ROOT, str(self.project_root))
        self.vm.set(BuildVars.PLATFORM, self.platform)
        self.vm.set(BuildVars.VARS_DIR, self.vm.get_vars_dir_path())

        # Path information
        print(f"  [DEBUG] Writing BUILD_OUTPUT_DIR: {self.build_output_dir}")
        self.vm.set(BuildVars.BUILD_OUTPUT_DIR, str(self.build_output_dir))
        print(f"  [DEBUG] Writing EXTENSION_PATH: {self.extension_path}")
        self.vm.set(BuildVars.EXTENSION_PATH, str(self.extension_path))
        print(f"  [DEBUG] Writing NATIVE_PATH: {self.native_path}")
        self.vm.set(BuildVars.NATIVE_PATH, str(self.native_path))
        print(f"  [DEBUG] Writing SHARED_PATH: {self.shared_path}")
        self.vm.set(BuildVars.SHARED_PATH, str(self.shared_path))

        # Check node_modules
        node_modules = self.project_root / "node_modules"
        self.vm.set(BuildVars.NODE_MODULES_EXISTS, "true" if node_modules.exists() else "false")

        # Native Messaging Host manifest path (platform-specific)
        manifest_path = self._get_manifest_path()
        self.vm.set(BuildVars.MANIFEST_PATH, manifest_path)

        # Build configuration
        self.vm.set(BuildVars.BUILD_RETRY_MAX, "3")

        print(f"  Platform: {self.platform}")
        print(f"  Project Root: {self.project_root}")
        print(f"  Vars Dir: {self.vm.get_vars_dir_path()}")

        # Verify writes by reading back
        print(f"  [DEBUG] Verifying EXTENSION_PATH write...")
        readback = self.vm.get(BuildVars.EXTENSION_PATH)
        print(f"  [DEBUG] Read back EXTENSION_PATH: '{readback}'")

    def _get_real_user_home(self) -> str:
        """Get real user home directory (handle sudo case)"""
        # Check if running as root/sudo
        sudo_user = os.getenv("SUDO_USER")
        if sudo_user:
            # Running via sudo, get the real user's home
            if self.platform == "windows":
                return os.path.join("C:\\Users", sudo_user)
            else:
                return os.path.join("/home", sudo_user)

        # Not running as sudo, use current user
        return str(Path.home())

    def _get_manifest_path(self) -> str:
        """Get Native Messaging Host manifest path using real user home"""
        home = self._get_real_user_home()

        if self.platform == "windows":
            # Use real user's home dir instead of APPDATA
            return os.path.join(home, "AppData", "Roaming", "Google", "Chrome", "NativeMessagingHosts", "com.chromemcp.nativehost.json")
        elif self.platform == "darwin":
            return os.path.join(home, "Library", "Application Support", "Google", "Chrome", "NativeMessagingHosts", "com.chromemcp.nativehost.json")
        else:  # linux
            return os.path.join(home, ".config", "google-chrome", "NativeMessagingHosts", "com.chromemcp.nativehost.json")

    def generate_commands(self):
        """Generate build commands"""
        print("Generating build commands...")

        # Dependency check command (display only, not executed)
        self.vm.set(BuildVars.CMD_CHECK_DEPS, "node --version && pnpm --version")

        # Install dependencies command
        node_modules_exists = self.vm.get(BuildVars.NODE_MODULES_EXISTS) == "true"
        if node_modules_exists:
            self.vm.set(BuildVars.SHOULD_INSTALL, "false")
            self.vm.set(BuildVars.CMD_INSTALL, "")
        else:
            self.vm.set(BuildVars.SHOULD_INSTALL, "true")
            self.vm.set(BuildVars.CMD_INSTALL, "pnpm install")

        # Build commands (cross-platform)
        self.vm.set(BuildVars.CMD_BUILD_SHARED, "pnpm run build:shared")
        self.vm.set(BuildVars.CMD_BUILD_NATIVE, "pnpm run build:native")
        self.vm.set(BuildVars.CMD_BUILD_EXTENSION, "pnpm run build:extension")

        # Register command
        if self.platform == "windows":
            self.vm.set(BuildVars.CMD_REGISTER, "node scripts\\register-local-dev.cjs")
        else:
            self.vm.set(BuildVars.CMD_REGISTER, "node scripts/register-local-dev.cjs")

        print("  Commands generated successfully")

    def generate_ui_strings(self):
        """Generate UI display strings"""
        print("Generating UI strings...")

        if self.platform == "windows":
            title = "Chrome MCP Server - Windows Setup"
        elif self.platform == "darwin":
            title = "Chrome MCP Server - macOS Setup"
        else:
            title = "Chrome MCP Server - Linux Setup"

        try:
            self.vm.set(BuildVars.UI_TITLE, title)
            self.vm.set(BuildVars.UI_STEP_1, "Checking dependencies...")
            self.vm.set(BuildVars.UI_STEP_2, "Installing project dependencies...")
            self.vm.set(BuildVars.UI_STEP_3, "Building shared package...")
            self.vm.set(BuildVars.UI_STEP_4, "Building Native Server...")
            self.vm.set(BuildVars.UI_STEP_5, "Building Chrome Extension...")
            self.vm.set(BuildVars.UI_STEP_6, "Registering Native Messaging Host...")
            print("  UI strings generated successfully")
        except Exception as e:
            print(f"  ERROR: Failed to generate UI strings: {e}", file=sys.stderr)
            raise

    def validate_paths(self) -> bool:
        """Validate paths (no command execution, only check if paths are valid)"""
        print("Validating paths...")

        if not self.project_root.exists():
            error = f"Project root does not exist: {self.project_root}"
            self.vm.set(BuildVars.ERROR, error)
            print(f"  ERROR: {error}")
            return False

        # Check if critical directories exist
        app_dir = self.project_root / "app"
        if not app_dir.exists():
            error = f"App directory does not exist: {app_dir}"
            self.vm.set(BuildVars.ERROR, error)
            print(f"  ERROR: {error}")
            return False

        print("  Paths validated successfully")
        return True

    def run(self) -> int:
        """Run orchestrator"""
        print("=" * 50)
        print("Build Orchestrator - Python")
        print("=" * 50)
        print()

        try:
            # Validate paths
            if not self.validate_paths():
                return 1

            # Detect environment
            self.detect_environment()

            # Generate commands
            self.generate_commands()

            # Generate UI strings
            self.generate_ui_strings()

            print()
            print("=" * 50)
            print("Python processing complete!")
            print(f"Variables saved to: {self.vm.get_vars_dir_path()}")
            print("=" * 50)
            print()

            return 0

        except Exception as e:
            error = f"Python orchestrator failed: {e}"
            self.vm.set(BuildVars.ERROR, error)
            print(f"ERROR: {error}", file=sys.stderr)
            return 1


def main():
    """Main function"""
    # Get project root directory (parent of script directory)
    script_dir = Path(__file__).parent.resolve()
    project_root = script_dir.parent

    orchestrator = BuildOrchestrator(str(project_root))
    exit_code = orchestrator.run()

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
