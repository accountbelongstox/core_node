#!/usr/bin/env python3
"""
Build Orchestrator - Build configuration script
Handles cross-platform path and UI configuration for the shell launchers.
"""

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
if str(REPOSITORY_ROOT) not in sys.path:
    sys.path.insert(0, str(REPOSITORY_ROOT))

# Import variable manager and variable definitions
from var_manager import get_instance as get_var_manager
from build_vars import BuildVars
from pycore.pyfoundations.service_contract import value as contract_value

NATIVE_HOST_MANIFEST_NAME = f"{contract_value('mcp_chrome.native_host_name')}.json"
SOURCE_STAMP_FILE = contract_value("mcp_chrome.source_stamp_file")
SOURCE_STAMP_CURRENT = "current"
SOURCE_STAMP_STALE = "stale"
# Build inputs: package sources, workspace manifests and the repository contracts they import.
SOURCE_INPUT_PATHS = ("app/chrome-extension", "app/native-server", "packages/shared", "package.json", "bun.lock")
CONTRACT_INPUT_PATHS = ("config/service_contract.json", "config/queue_center_contract.json")
SOURCE_EXCLUDED_DIRS = {"node_modules", "dist", ".wxt", ".output", ".turbo", "logs", "__pycache__"}


class BuildOrchestrator:
    """Build orchestrator"""

    def __init__(self, project_root: str):
        """Initialize"""
        self.project_root = Path(project_root).resolve()
        self.vm = get_var_manager()
        self.platform = self.vm.platform

        # Extension output: <mcp-chrome>/<mcp_chrome.build_output_dir>/<mcp_chrome.extension_dir>
        # (wxt outDir + outDirTemplate, both named in config/service_contract.json)
        self.build_output_dir = self.project_root / contract_value("mcp_chrome.build_output_dir")
        self.extension_path = self.build_output_dir / contract_value("mcp_chrome.extension_dir")
        self.native_path = self.project_root / "app" / "native-server" / "dist"
        self.shared_path = self.project_root / "packages" / "shared" / "dist"
        self.source_stamp_path = self.build_output_dir / SOURCE_STAMP_FILE
        self.build_artifacts = (
            self.shared_path / "index.js",
            self.native_path / "index.js",
            self.extension_path / "manifest.json",
        )

    def _source_files(self):
        input_path = None
        file_path = None

        for input_path in [self.project_root / name for name in SOURCE_INPUT_PATHS] + [REPOSITORY_ROOT / name for name in CONTRACT_INPUT_PATHS]:
            if input_path.is_file():
                yield input_path
                continue
            for file_path in sorted(input_path.rglob("*")):
                if file_path.is_file() and not SOURCE_EXCLUDED_DIRS.intersection(file_path.relative_to(input_path).parts):
                    yield file_path

    def source_fingerprint(self) -> str:
        """Content hash of every build input; identical sources give an identical build."""
        digest = hashlib.sha256()
        file_path = None

        for file_path in self._source_files():
            digest.update(file_path.relative_to(REPOSITORY_ROOT).as_posix().encode("utf-8"))
            digest.update(b"\0")
            digest.update(file_path.read_bytes())
            digest.update(b"\0")
        return digest.hexdigest()

    def source_stamp_status(self) -> str:
        """current when every artifact exists and was built from the present sources."""
        stamp = None

        if not all(artifact.is_file() for artifact in self.build_artifacts) or not self.source_stamp_path.is_file():
            return SOURCE_STAMP_STALE
        try:
            stamp = json.loads(self.source_stamp_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return SOURCE_STAMP_STALE
        return SOURCE_STAMP_CURRENT if stamp.get("fingerprint") == self.source_fingerprint() else SOURCE_STAMP_STALE

    def write_source_stamp(self) -> str:
        """Record the present sources after a build whose artifacts all exist."""
        if not all(artifact.is_file() for artifact in self.build_artifacts):
            return SOURCE_STAMP_STALE
        self.source_stamp_path.parent.mkdir(parents=True, exist_ok=True)
        self.source_stamp_path.write_text(json.dumps({"fingerprint": self.source_fingerprint()}), encoding="utf-8")
        return SOURCE_STAMP_CURRENT

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
            return os.path.join(home, "AppData", "Roaming", "Google", "Chrome", "NativeMessagingHosts", NATIVE_HOST_MANIFEST_NAME)
        elif self.platform == "darwin":
            return os.path.join(home, "Library", "Application Support", "Google", "Chrome", "NativeMessagingHosts", NATIVE_HOST_MANIFEST_NAME)
        else:  # linux
            return os.path.join(home, ".config", "google-chrome", "NativeMessagingHosts", NATIVE_HOST_MANIFEST_NAME)

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
    parser = argparse.ArgumentParser()
    args = None
    # Get project root directory (parent of script directory)
    script_dir = Path(__file__).parent.resolve()
    project_root = script_dir.parent

    parser.add_argument("--source-stamp", choices=["status", "write"])
    args = parser.parse_args()
    orchestrator = BuildOrchestrator(str(project_root))
    # Prints only "current" or "stale" so the shell launchers can read the state.
    if args.source_stamp == "status":
        print(orchestrator.source_stamp_status())
        return
    if args.source_stamp == "write":
        print(orchestrator.write_source_stamp())
        return
    exit_code = orchestrator.run()

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
