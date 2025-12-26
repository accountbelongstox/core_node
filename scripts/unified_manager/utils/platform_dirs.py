#!/usr/bin/env python3
"""
Cross-Platform Variable Directory Manager
Manages temporary file variables for different operating systems
"""

import os
import sys
import platform
from pathlib import Path


class VariableDirectoryManager:
    """Manages variable directories across different platforms"""

    def __init__(self, app_name: str = "unified_app_manager", prefix: str = "UAPPMAN_"):
        self.app_name = app_name
        self.prefix = prefix
        self.platform = platform.system()

        # Initialize platform-specific paths
        self._init_platform_paths()

    def _init_platform_paths(self):
        """Initialize platform-specific directory paths"""

        if self.platform == "Windows":
            self._init_windows_paths()
        elif self.platform == "Linux":
            self._init_linux_paths()
        elif self.platform == "Darwin":  # macOS
            self._init_macos_paths()
        else:
            self._init_generic_paths()

    def _init_windows_paths(self):
        """Initialize Windows-specific paths"""
        # Try different locations in order of preference

        # 1. APPDATA (Roaming) - User-specific application data
        appdata = os.environ.get('APPDATA')
        if appdata:
            self.base_dir = Path(appdata) / self.app_name
        else:
            # Fallback to LOCALAPPDATA
            localappdata = os.environ.get('LOCALAPPDATA')
            if localappdata:
                self.base_dir = Path(localappdata) / self.app_name
            else:
                # Final fallback to TEMP
                temp = os.environ.get('TEMP', 'C:\\temp')
                self.base_dir = Path(temp) / self.app_name

        # Windows-specific subdirectories
        self.var_dir = self.base_dir / "vars"
        self.cache_dir = self.base_dir / "cache"
        self.temp_dir = self.base_dir / "temp"
        self.log_dir = self.base_dir / "logs"

        # Windows registry alternative (optional)
        self.use_registry = False

    def _init_linux_paths(self):
        """Initialize Linux-specific paths following XDG Base Directory spec"""

        # XDG Base Directory Specification
        xdg_runtime_dir = os.environ.get('XDG_RUNTIME_DIR')
        xdg_cache_home = os.environ.get('XDG_CACHE_HOME',
                                       os.path.expanduser('~/.cache'))
        xdg_data_home = os.environ.get('XDG_DATA_HOME',
                                      os.path.expanduser('~/.local/share'))

        # Use XDG runtime directory for temporary variables (if available)
        if xdg_runtime_dir and os.access(xdg_runtime_dir, os.W_OK):
            self.var_dir = Path(xdg_runtime_dir) / self.app_name
        else:
            # Fallback to cache directory
            self.var_dir = Path(xdg_cache_home) / self.app_name / "vars"

        # Other directories
        self.base_dir = Path(xdg_data_home) / self.app_name
        self.cache_dir = Path(xdg_cache_home) / self.app_name
        self.temp_dir = self.var_dir  # Variables are temporary
        self.log_dir = self.base_dir / "logs"

        # Alternative system-wide location (requires elevated privileges)
        self.system_var_dir = Path('/var/lib') / self.app_name / "vars"

    def _init_macos_paths(self):
        """Initialize macOS-specific paths"""
        home = Path.home()

        # macOS Application Support directory
        self.base_dir = home / "Library" / "Application Support" / self.app_name

        # Temporary variables in user's temporary directory
        self.var_dir = home / "Library" / "Caches" / self.app_name / "vars"
        self.cache_dir = home / "Library" / "Caches" / self.app_name
        self.temp_dir = self.var_dir
        self.log_dir = home / "Library" / "Logs" / self.app_name

    def _init_generic_paths(self):
        """Initialize generic Unix-style paths"""
        home = Path.home()

        # Generic Unix paths
        self.base_dir = home / f".{self.app_name}"
        self.var_dir = self.base_dir / "vars"
        self.cache_dir = self.base_dir / "cache"
        self.temp_dir = self.base_dir / "temp"
        self.log_dir = self.base_dir / "logs"

    def get_var_file_path(self, var_name: str) -> Path:
        """Get path for a specific variable file"""
        return self.var_dir / f"{self.prefix}{var_name}"

    def get_platform_info(self) -> dict:
        """Get comprehensive platform information"""
        return {
            'platform': self.platform,
            'system': platform.system(),
            'release': platform.release(),
            'version': platform.version(),
            'machine': platform.machine(),
            'processor': platform.processor(),
            'architecture': platform.architecture()[0],
            'python_version': platform.python_version(),
            'is_windows': self.platform == "Windows",
            'is_linux': self.platform == "Linux",
            'is_macos': self.platform == "Darwin",
            'username': os.environ.get('USERNAME') or os.environ.get('USER', 'unknown'),
            'home_dir': str(Path.home()),
        }

    def get_directory_info(self) -> dict:
        """Get all directory paths as dictionary"""
        return {
            'platform': self.platform,
            'base_dir': str(self.base_dir),
            'var_dir': str(self.var_dir),
            'cache_dir': str(self.cache_dir),
            'temp_dir': str(self.temp_dir),
            'log_dir': str(self.log_dir),
            'prefix': self.prefix,
        }

    def create_directories(self) -> bool:
        """Create all necessary directories"""
        dirs_to_create = [
            self.base_dir,
            self.var_dir,
            self.cache_dir,
            self.temp_dir,
            self.log_dir
        ]

        success = True
        for directory in dirs_to_create:
            try:
                directory.mkdir(parents=True, exist_ok=True)

                # Set appropriate permissions on Unix-like systems
                if self.platform in ['Linux', 'Darwin']:
                    # User read/write/execute, group and others no access
                    os.chmod(directory, 0o700)

            except (OSError, PermissionError) as e:
                print(f"Warning: Failed to create directory {directory}: {e}")
                success = False

        return success

    def clean_directories(self) -> bool:
        """Clean temporary directories"""
        try:
            # Only clean variable and temp directories, preserve cache and logs
            for var_file in self.var_dir.glob(f"{self.prefix}*"):
                var_file.unlink(missing_ok=True)

            # Clean temp directory
            if self.temp_dir.exists() and self.temp_dir != self.var_dir:
                for temp_file in self.temp_dir.iterdir():
                    if temp_file.is_file():
                        temp_file.unlink(missing_ok=True)

            return True
        except (OSError, PermissionError):
            return False

    def get_alternative_locations(self) -> list:
        """Get list of alternative directory locations for troubleshooting"""
        alternatives = []

        if self.platform == "Windows":
            alternatives = [
                Path(os.environ.get('TEMP', 'C:\\temp')) / self.app_name,
                Path('C:\\ProgramData') / self.app_name,
                Path.cwd() / 'temp' / self.app_name,
            ]
        elif self.platform == "Linux":
            alternatives = [
                Path('/tmp') / self.app_name,
                Path('/var/tmp') / self.app_name,
                Path.cwd() / 'temp' / self.app_name,
            ]

            # Add system location if we have privileges
            if os.geteuid() == 0:  # Running as root
                alternatives.append(self.system_var_dir)

        elif self.platform == "Darwin":
            alternatives = [
                Path('/tmp') / self.app_name,
                Path.cwd() / 'temp' / self.app_name,
            ]

        return [str(alt) for alt in alternatives]


def print_directory_structure():
    """Print directory structure for all platforms"""

    print("=" * 60)
    print("UNIFIED APP MANAGER - VARIABLE DIRECTORY STRUCTURE")
    print("=" * 60)

    platforms = ['Windows', 'Linux', 'Darwin']

    for platform_name in platforms:
        print(f"\n{platform_name.upper()} PLATFORM:")
        print("-" * 40)

        # Mock the platform for demonstration
        original_system = platform.system
        platform.system = lambda: platform_name

        try:
            manager = VariableDirectoryManager()
            info = manager.get_directory_info()

            print(f"Base Directory:     {info['base_dir']}")
            print(f"Variables Directory: {info['var_dir']}")
            print(f"Cache Directory:    {info['cache_dir']}")
            print(f"Temp Directory:     {info['temp_dir']}")
            print(f"Log Directory:      {info['log_dir']}")
            print(f"Variable Prefix:    {info['prefix']}")

            # Show example variable file
            example_var = manager.get_var_file_path("APP_COUNT")
            print(f"Example Variable:   {example_var}")

            # Show alternatives
            alternatives = manager.get_alternative_locations()
            if alternatives:
                print("Alternative Locations:")
                for alt in alternatives:
                    print(f"  - {alt}")

        finally:
            platform.system = original_system

    print("\n" + "=" * 60)
    print("PLATFORM-SPECIFIC NOTES:")
    print("=" * 60)

    print("\nWINDOWS:")
    print("- Uses APPDATA for user-specific data")
    print("- Falls back to LOCALAPPDATA then TEMP")
    print("- Variables stored in Roaming profile (synced across machines)")
    print("- Alternative: Windows Registry for system-wide settings")

    print("\nLINUX:")
    print("- Follows XDG Base Directory Specification")
    print("- Uses XDG_RUNTIME_DIR for session-specific variables")
    print("- Falls back to ~/.cache for variables")
    print("- System-wide: /var/lib/unified_app_manager/vars (root only)")
    print("- Runtime dir cleaned on logout")

    print("\nmacOS:")
    print("- Uses ~/Library/Application Support for permanent data")
    print("- Variables in ~/Library/Caches (user-specific)")
    print("- Logs in ~/Library/Logs")
    print("- Follows Apple's directory conventions")

    print("\nVARIABLE FILE NAMING:")
    print("- All files prefixed with 'UAPPMAN_'")
    print("- Prevents conflicts with other applications")
    print("- Easy cleanup and identification")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "info":
        print_directory_structure()
    else:
        # Test current platform
        manager = VariableDirectoryManager()

        print("Current Platform Configuration:")
        print("-" * 40)

        platform_info = manager.get_platform_info()
        for key, value in platform_info.items():
            print(f"{key}: {value}")

        print("\nDirectory Configuration:")
        print("-" * 40)

        dir_info = manager.get_directory_info()
        for key, value in dir_info.items():
            print(f"{key}: {value}")

        # Test directory creation
        print(f"\nCreating directories...")
        success = manager.create_directories()
        print(f"Creation successful: {success}")

        # Test variable file path
        var_path = manager.get_var_file_path("TEST_VARIABLE")
        print(f"Test variable path: {var_path}")