#!/usr/bin/env python3
"""
Unified App Manager Core
Cross-platform application management system

This module provides the main logic for the unified app manager,
communicating with shell/PowerShell through global variables.
"""

# Import statements - all at top
import os
import sys
import json
import hashlib
import configparser
import platform
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict

# Import centralized variable management
sys.path.append(str(Path(__file__).parent.parent / "utils"))
from global_variables import GlobalVariableManager, global_vars
from variable_keys import VariableKeys, StatusValues


@dataclass
class AppInfo:
    """Application information structure"""
    name: str
    path: str
    type: str
    framework: str
    available_scripts: List[str]
    current_script: str
    script_index: int
    is_selected: bool
    port: int
    debug_mode: bool


@dataclass
class SystemInfo:
    """System information structure"""
    platform: str
    is_windows: bool
    is_linux: bool
    root_dir: str
    cache_dir: str
    temp_dir: str




class ConfigManager:
    """Manages configuration loading and validation"""

    def __init__(self, config_path: str):
        self.config_path = config_path
        self.config = configparser.ConfigParser()

        if not os.path.exists(config_path):
            raise FileNotFoundError(f"Configuration file not found: {config_path}")

        try:
            self.config.read(config_path, encoding='utf-8')
        except Exception as e:
            raise ValueError(f"Failed to read configuration file {config_path}: {str(e)}")

        self._validate_config()

    def _validate_config(self) -> None:
        """Validate required configuration sections"""
        required_sections = ['general', 'paths', 'ports', 'frameworks', 'commands']

        available_sections = self.config.sections()

        for section in required_sections:
            if not self.config.has_section(section):
                raise ValueError(
                    f"Missing required config section: {section}\n"
                    f"Config file: {self.config_path}\n"
                    f"Available sections: {available_sections}"
                )

    def get(self, section: str, key: str, default: str = "") -> str:
        """Get configuration value"""
        return self.config.get(section, key, fallback=default)

    def getint(self, section: str, key: str, default: int = 0) -> int:
        """Get integer configuration value"""
        return self.config.getint(section, key, fallback=default)

    def getboolean(self, section: str, key: str, default: bool = False) -> bool:
        """Get boolean configuration value"""
        return self.config.getboolean(section, key, fallback=default)

    def get_list(self, section: str, key: str, default: List[str] = None) -> List[str]:
        """Get list configuration value (comma-separated)"""
        value = self.get(section, key)
        if value:
            return [item.strip() for item in value.split(',')]
        return default or []


class FrameworkDetector:
    """Detects application frameworks and types"""

    def __init__(self, config: ConfigManager):
        self.config = config
        self.priority_order = config.get_list('frameworks', 'priority_order')

    def detect_framework(self, app_path: Path) -> str:
        """Detect framework type for application"""

        # Check in priority order
        for framework in self.priority_order:
            if self._check_framework_patterns(app_path, framework):
                return framework

        return "polyLauncher"

    def _check_framework_patterns(self, app_path: Path, framework: str) -> bool:
        """Check if app matches framework patterns"""
        patterns = self.config.get_list('frameworks', f'{framework.lower().replace("start", "")}_patterns')

        if not patterns:
            return False

        # Special case for React Native (check before React)
        if framework == "reactNativeStart":
            package_json = app_path / "package.json"
            android_dir = app_path / "android"
            ios_dir = app_path / "ios"

            if package_json.exists() and (android_dir.exists() or ios_dir.exists()):
                try:
                    with open(package_json, 'r', encoding='utf-8') as f:
                        content = f.read()
                        return "react-native" in content
                except:
                    return False

        # Special case for Nuxt (check before Vue/React)
        elif framework == "nuxtStart":
            return any((app_path / pattern).exists() for pattern in patterns)

        # Special case for React (exclude React Native and Nuxt)
        elif framework == "reactStart":
            package_json = app_path / "package.json"
            if package_json.exists():
                try:
                    with open(package_json, 'r', encoding='utf-8') as f:
                        content = f.read()
                        return "react" in content and "react-native" not in content and "nuxt" not in content
                except:
                    return False

        # Special case for Vue (exclude Nuxt)
        elif framework == "vueStart":
            package_json = app_path / "package.json"
            if package_json.exists():
                try:
                    with open(package_json, 'r', encoding='utf-8') as f:
                        content = f.read()
                        return "vue" in content and "nuxt" not in content
                except:
                    return False

            # Also check for vue config files
            return any((app_path / pattern).exists() for pattern in patterns if pattern != "package.json")

        # Standard pattern checking for other frameworks
        else:
            return any((app_path / pattern).exists() for pattern in patterns)

    def is_debug_mode(self, app_path: Path, framework: str) -> bool:
        """Detect if app should run in debug mode"""

        # Check environment files
        env_files = self.config.get_list('debug_detection', 'env_files')
        env_patterns = self.config.get_list('debug_detection', 'env_patterns')

        for env_file in env_files:
            env_path = app_path / env_file
            if env_path.exists():
                try:
                    content = env_path.read_text(encoding='utf-8')
                    if any(pattern in content for pattern in env_patterns):
                        return True
                except:
                    continue

        # Check framework-specific indicators
        if framework in ["reactStart", "vueStart", "nuxtStart"]:
            vite_configs = ["vite.config.js", "vite.config.ts"]
            if any((app_path / config).exists() for config in vite_configs):
                return True

        # Check development directories
        dev_dirs = self.config.get_list('debug_detection', 'dev_dirs')
        found_dirs = sum(1 for dir_name in dev_dirs if (app_path / dir_name).exists())

        if found_dirs >= 3:
            return True

        # Check workspace patterns
        workspace_patterns = self.config.get_list('debug_detection', 'workspace_patterns')
        path_str = str(app_path)

        return any(pattern in path_str for pattern in workspace_patterns)


class AppScanner:
    """Scans and discovers applications"""

    def __init__(self, config: ConfigManager, detector: FrameworkDetector):
        self.config = config
        self.detector = detector

    def scan_directory(self, directory: Path, app_type: str) -> List[AppInfo]:
        """Scan directory for applications"""
        apps = []

        if not directory.exists():
            return apps

        try:
            for item in directory.iterdir():
                if item.is_dir() and not item.name.startswith('.'):
                    app_info = self._scan_single_app(item, app_type)
                    if app_info:
                        apps.append(app_info)
        except PermissionError:
            pass

        return sorted(apps, key=lambda x: x.name.lower())

    def _scan_single_app(self, app_path: Path, app_type: str) -> Optional[AppInfo]:
        """Scan single application directory"""

        # Skip if no valid entry points
        if not self._has_valid_entry_point(app_path):
            return None

        framework = self.detector.detect_framework(app_path)
        debug_mode = self.detector.is_debug_mode(app_path, framework)

        # Generate available scripts
        available_scripts = self._get_available_scripts(app_path, framework, app_type)

        if not available_scripts:
            return None

        return AppInfo(
            name=app_path.name,
            path=str(app_path),
            type=app_type,
            framework=framework,
            available_scripts=available_scripts,
            current_script=available_scripts[0],
            script_index=0,
            is_selected=False,
            port=0,  # Will be assigned later
            debug_mode=debug_mode
        )

    def _has_valid_entry_point(self, app_path: Path) -> bool:
        """Check if app has valid entry points"""
        entry_points = [
            "main.py", "main.js", "package.json", "composer.json",
            "pubspec.yaml", "index.php", "build.gradle", "build.gradle.kts",
            "nuxt.config.js", "nuxt.config.ts"
        ]

        return any((app_path / entry).exists() for entry in entry_points)

    def _get_available_scripts(self, app_path: Path, framework: str, app_type: str) -> List[str]:
        """Get available startup scripts for app"""
        scripts = []

        # Add framework-specific script
        if framework != "polyLauncher":
            scripts.append(framework)

        # Add unified installer for ncore/pycore apps
        if app_type in ["ncoreApp", "pycoreApp"]:
            scripts.append("Ncore/Pycore/Installer")

        # Check for custom scripts
        script_files = ["start.sh", "install.sh", "deploy.sh"]
        for script_file in script_files:
            if (app_path / script_file).exists():
                scripts.append(script_file.replace('.sh', 'Start'))

        # Default fallback
        if not scripts:
            scripts.append("polyLauncher")

        return scripts


class PortManager:
    """Manages port allocation for applications"""

    def __init__(self, config: ConfigManager):
        self.config = config
        self.base_port = config.getint('ports', 'base_port')
        self.auto_increment = config.getboolean('ports', 'auto_increment')

    def assign_ports(self, apps: List[AppInfo]) -> None:
        """Assign ports to applications"""
        for index, app in enumerate(apps):
            if self.auto_increment:
                app.port = self.base_port + index
            else:
                # Use hash-based allocation for consistency
                hash_value = int(hashlib.md5(app.name.encode()).hexdigest()[:8], 16)
                app.port = self.base_port + (hash_value % self.config.getint('ports', 'range'))


class CommandGenerator:
    """Generates platform-specific commands"""

    def __init__(self, config: ConfigManager, system_info: SystemInfo):
        self.config = config
        self.system_info = system_info

    def generate_command(self, app: AppInfo) -> str:
        """Generate startup command for application"""

        framework_key = app.framework.lower().replace('start', '')
        mode_suffix = '_dev' if app.debug_mode else '_build'

        # Special handling for some frameworks
        if framework_key in ['ncore', 'pycore']:
            framework_key = 'ncore' if 'ncore' in app.type.lower() else 'pycore'
            mode_suffix = '_dev'  # These always use dev mode

        command_key = f"{framework_key}{mode_suffix}"

        # Fallback to dev mode if build command not available
        if not self.config.get('commands', command_key):
            command_key = f"{framework_key}_dev"

        template = self.config.get('commands', command_key)

        if not template:
            return ""

        # Replace placeholders
        return template.format(
            app_path=app.path,
            app_name=app.name,
            port=app.port,
            root_dir=self.system_info.root_dir
        )


class UnifiedAppManager:
    """Main unified application manager"""

    def __init__(self, script_dir: str):
        self.script_dir = Path(script_dir)
        # script_dir is core/ directory, so go up 3 levels to reach project root
        # core/ -> unified_manager/ -> scripts/ -> root/
        self.root_dir = self.script_dir.parent.parent.parent

        # Initialize system info
        self.system_info = SystemInfo(
            platform=platform.system(),
            is_windows=platform.system() == "Windows",
            is_linux=platform.system() == "Linux",
            root_dir=str(self.root_dir),
            cache_dir=str(self.root_dir / "temp" / "unified_manager"),
            temp_dir=str(self.root_dir / "temp" / "unified_manager" / "vars")
        )

        # Initialize components
        # Config file is in unified_manager/config/, not core/config/
        config_path = self.script_dir.parent / "config" / "unified_config.ini"
        self.config = ConfigManager(str(config_path))

        # Set up global variable manager
        self.file_vars = global_vars

        # Initialize modules
        self.detector = FrameworkDetector(self.config)
        self.scanner = AppScanner(self.config, self.detector)
        self.port_manager = PortManager(self.config)
        self.command_gen = CommandGenerator(self.config, self.system_info)

        # Application data
        self.apps: List[AppInfo] = []

    def scan_applications(self) -> None:
        """Scan for all applications"""
        self.apps.clear()

        # Scan different app directories
        app_dirs = [
            (self.root_dir / "apps", "ncoreApp"),
            (self.root_dir / "pyapps", "pycoreApp"),
            (self.root_dir / "poly_apps", "polyApp")
        ]

        for app_dir, app_type in app_dirs:
            if app_dir.exists():
                apps = self.scanner.scan_directory(app_dir, app_type)
                self.apps.extend(apps)

        # Assign ports
        self.port_manager.assign_ports(self.apps)

        # Write results to file variables
        self._write_app_data()
        self._write_system_info()

    def _write_app_data(self) -> None:
        """Write application data to file variables"""

        # Write app count
        self.file_vars.write_app_count(len(self.apps))

        # Write app data
        apps_data = []
        for i, app in enumerate(self.apps):
            app_data = asdict(app)
            apps_data.append(app_data)

            # Generate command
            command = self.command_gen.generate_command(app)

            # Write individual app variables for shell access using centralized method
            self.file_vars.write_app_data(
                index=i,
                name=app.name,
                path=app.path,
                app_type=app.type,
                framework=app.framework,
                port=app.port,
                command=command,
                debug=app.debug_mode
            )

        # Write complete app data as JSON
        self.file_vars.write_var(VariableKeys.APPS_DATA, apps_data)

    def _write_system_info(self) -> None:
        """Write system information to file variables"""
        # Write platform information using centralized method
        self.file_vars.write_platform_info(
            self.system_info.platform,
            self.system_info.is_windows,
            self.system_info.is_linux
        )

        # Write additional system info
        self.file_vars.write_var(VariableKeys.ROOT_DIR, self.system_info.root_dir)
        self.file_vars.write_var(VariableKeys.CACHE_DIR, self.system_info.cache_dir)

        # Write platform-specific feature flags
        if self.system_info.is_windows:
            self.file_vars.write_var(VariableKeys.ENABLE_SYSTEMD, False)
            self.file_vars.write_var(VariableKeys.ENABLE_NGINX, False)
            self.file_vars.write_var(VariableKeys.ENABLE_FIREWALL, False)
            self.file_vars.write_var(VariableKeys.ENABLE_DOMAIN_PROXY, False)
        else:
            self.file_vars.write_var(VariableKeys.ENABLE_SYSTEMD, True)
            self.file_vars.write_var(VariableKeys.ENABLE_NGINX, True)
            self.file_vars.write_var(VariableKeys.ENABLE_FIREWALL, True)
            self.file_vars.write_var(VariableKeys.ENABLE_DOMAIN_PROXY, True)

    def process_command(self, action: str, **kwargs) -> None:
        """Process commands from shell layer"""

        if action == "scan":
            self.scan_applications()
            self.file_vars.write_status(StatusValues.SCAN_COMPLETE)

        elif action == "get_app_command":
            app_index = int(kwargs.get('app_index', 0))
            if 0 <= app_index < len(self.apps):
                app = self.apps[app_index]
                command = self.command_gen.generate_command(app)
                self.file_vars.write_var(VariableKeys.LAUNCH_COMMAND, command)
                self.file_vars.write_status(StatusValues.COMMAND_READY)
            else:
                self.file_vars.write_status(StatusValues.ERROR_INVALID_INDEX)

        elif action == "update_app_selection":
            app_index = int(kwargs.get('app_index', 0))
            script_index = int(kwargs.get('script_index', 0))

            if 0 <= app_index < len(self.apps):
                app = self.apps[app_index]
                if 0 <= script_index < len(app.available_scripts):
                    app.script_index = script_index
                    app.current_script = app.available_scripts[script_index]

                    # Regenerate framework based on new script
                    if app.current_script != "polyLauncher":
                        app.framework = app.current_script

                    # Write updated app data
                    self._write_app_data()
                    self.file_vars.write_status(StatusValues.SELECTION_UPDATED)
                else:
                    self.file_vars.write_status(StatusValues.ERROR_INVALID_SCRIPT)
            else:
                self.file_vars.write_status(StatusValues.ERROR_INVALID_INDEX)


def main():
    """Main entry point"""
    if len(sys.argv) < 2:
        print("Usage: python unified_core.py <action> [args...]", file=sys.stderr)
        sys.exit(1)

    script_dir = Path(__file__).parent
    manager = UnifiedAppManager(str(script_dir))

    action = sys.argv[1]

    # Parse additional arguments
    kwargs = {}
    for arg in sys.argv[2:]:
        if '=' in arg:
            key, value = arg.split('=', 1)
            kwargs[key] = value

    try:
        manager.process_command(action, **kwargs)
    except Exception as e:
        manager.file_vars.write_var(VariableKeys.STATUS, f"error_{str(e)}")
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()