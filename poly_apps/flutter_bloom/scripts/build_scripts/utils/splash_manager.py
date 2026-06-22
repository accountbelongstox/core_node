#!/usr/bin/env python3
"""
Flutter Bloom - Splash Manager Library (Python)
This library provides functionality to update splash screen configuration for different apps

NOTE: This library uses hardcoded imports from shared modules for data consistency:
- Uses directory_manager.py for project root management (origin_dir = project_root)
- Uses project_constants.py for path and image constants
- Uses unified_variable_system.py for file variable exchange with PowerShell
"""

import os
import sys
from pathlib import Path
from typing import Dict, List, Optional

# Hardcoded imports for data consistency
sys.path.insert(0, str(Path(__file__).parent.parent / "shared"))
from directory_manager import DirectoryManager
from project_constants import project_constants

# Import unified variable system for file variable exchange
sys.path.insert(0, str(Path(__file__).parent.parent / "shared" / "data_exchange"))
from unified_variable_system import unified_vars

# Import image processor for format conversion
from image_processor import SplashImageProcessor

# Import app config reader for INI configuration
from app_config_reader import AppConfigReader


class SplashConfigManager:
    """Manages splash screen configuration for Flutter apps"""

    def __init__(self, app_name: str):
        """
        Initialize the SplashConfigManager

        Args:
            app_name: Name of the Flutter app
        """
        self.app_name = app_name
        print(f"[DEBUG] Initializing SplashConfigManager for app: {app_name}")

        # Initialize directory manager for project root
        print(f"[DEBUG] Loading DirectoryManager...")
        self.directory_manager = DirectoryManager()
        self.project_root = self.directory_manager.origin_dir
        print(f"[DEBUG] Project root detected: {self.project_root}")

        # Initialize constants
        self.constants = project_constants
        print(f"[DEBUG] Project constants loaded")

        # Initialize image processor for format conversion
        self.image_processor = SplashImageProcessor(self.project_root)
        print(f"[DEBUG] SplashImageProcessor initialized")

        # Initialize app config reader
        self.app_config = AppConfigReader(app_name)
        print(f"[DEBUG] AppConfigReader initialized")

        # Initialize paths using shared constants if available
        self._initialize_paths()

        # Template path
        self.template_path = self.project_root / "scripts" / "build_scripts" / "shared" / "splash_template" / "flutter_native_splash_template.yaml"
        print(f"[DEBUG] Template path: {self.template_path}")

    def _initialize_paths(self):
        """Initialize directory paths using shared constants"""
        print(f"[DEBUG] Initializing paths from constants...")

        # Use shared constants
        self.assets_root = self.project_root / self.constants.ASSETS_DIR
        self.common_assets_root = self.assets_root / self.constants.COMMON_DIR
        self.common_launch_path = self.common_assets_root / self.constants.LAUNCH_DIR
        self.common_icons_path = self.common_assets_root / self.constants.ICONS_DIR
        self.splash_config_path = self.project_root / self.constants.SPLASH_CONFIG_FILE

        print(f"[DEBUG] Path initialization complete:")
        print(f"[DEBUG]   Assets root: {self.assets_root}")
        print(f"[DEBUG]   Common assets: {self.common_assets_root}")
        print(f"[DEBUG]   Common launch: {self.common_launch_path}")
        print(f"[DEBUG]   Common icons: {self.common_icons_path}")
        print(f"[DEBUG]   Splash config: {self.splash_config_path}")

        # Use shared patterns
        self.background_patterns = self.constants.SPLASH_BACKGROUND_PATTERNS
        self.supported_extensions = self.constants.SUPPORTED_IMAGE_EXTENSIONS

        print(f"[DEBUG] Pattern configuration:")
        print(f"[DEBUG]   Background patterns: {self.background_patterns}")
        print(f"[DEBUG]   Supported extensions: {self.supported_extensions}")

    def _get_app_launch_path(self) -> Path:
        """Get the launch directory path for the app"""
        return self.assets_root / self.constants.APPS_DIR / self.app_name / self.constants.LAUNCH_DIR

    def _get_app_icons_path(self) -> Path:
        """Get the icons directory path for the app"""
        return self.assets_root / self.constants.APPS_DIR / self.app_name / self.constants.ICONS_DIR

    def _directory_exists(self, path: Path) -> bool:
        """Check if directory exists"""
        return path.exists() and path.is_dir()

    def _find_splash_files(self, launch_path: Path) -> List[Path]:
        """Find all splash-related files (background, logo, branding) in the given launch directory"""
        if not self._directory_exists(launch_path):
            print(f"[DEBUG] Launch path does not exist: {launch_path}")
            return []

        print(f"[DEBUG] Scanning directory: {launch_path}")
        splash_files = []
        all_files = []

        try:
            for file_path in launch_path.iterdir():
                if file_path.is_file():
                    all_files.append(file_path.name)
                    file_name = file_path.name
                    file_ext = file_path.suffix.lower()

                    # Check if file is any splash-related image (background/logo/branding)
                    image_type = self.constants.classify_splash_image(file_name)

                    if image_type:
                        # Check if format is supported
                        is_supported_format = self.constants.is_supported_image_extension(file_name)

                        if is_supported_format:
                            splash_files.append(file_path)
                            print(f"[DEBUG]   [OK] Matched {image_type}: {file_name}")
                        else:
                            # Unsupported format - try to convert
                            print(f"[DEBUG]   [CONVERT] Found {image_type} with unsupported format: {file_name} ({file_ext})")

                            converted_file = self._convert_unsupported_image(file_path)
                            if converted_file:
                                splash_files.append(converted_file)
                                print(f"[DEBUG]   [OK] Converted and matched: {converted_file.name}")
                            else:
                                print(f"[DEBUG]   [SKIP] Conversion failed for: {file_name}")
                    else:
                        print(f"[DEBUG]   [SKIP] Skipped file: {file_name} (not splash-related)")

            print(f"[DEBUG] Total files found: {len(all_files)}, Splash files matched: {len(splash_files)}")
        except Exception as e:
            print(f"[ERROR] Error scanning directory {launch_path}: {e}")
            import traceback
            traceback.print_exc()

        return splash_files

    def _convert_unsupported_image(self, file_path: Path) -> Optional[Path]:
        """
        Convert unsupported image format to PNG

        Args:
            file_path: Path to unsupported image file

        Returns:
            Path to converted PNG file or None if conversion failed
        """
        try:
            print(f"\n[IMAGE-CONVERT] Converting unsupported format to PNG")
            print(f"[IMAGE-CONVERT]   Source: {file_path}")

            # Convert image in place (same directory), keep original
            result = self.image_processor.convert_splash_image_in_place(
                input_path=file_path,
                output_format='.png',
                compress=True,  # Enable compression for quality optimization
                keep_original=True  # Keep original as backup
            )

            if result['success'] and result['converted_path']:
                converted_path = Path(result['converted_path'])
                print(f"[IMAGE-CONVERT]   Converted: {converted_path.name}")
                print(f"[IMAGE-CONVERT]   Original size: {result['original_size']:,} bytes")
                print(f"[IMAGE-CONVERT]   Converted size: {result['converted_size']:,} bytes")
                if result['compression_ratio'] > 0:
                    print(f"[IMAGE-CONVERT]   Size reduction: {result['compression_ratio']:.1f}%")
                print(f"[IMAGE-CONVERT]   Original backed up: {result['original_kept']}")
                return converted_path
            else:
                print(f"[IMAGE-CONVERT]   Conversion failed: {result.get('error', 'Unknown error')}")
                return None

        except Exception as e:
            print(f"[IMAGE-CONVERT] Error converting image: {e}")
            import traceback
            traceback.print_exc()
            return None

    def find_best_splash_files(self) -> Dict[str, Path]:
        """
        Find the best splash files for the app (background, logo, branding)

        Logo files: search in icons directory
        Background/Branding: search in launch directory

        Returns:
            Dictionary mapping file names to their full paths
        """
        print(f"\n[INFO] Searching for splash-related files for app: {self.app_name}")
        print(f"[DEBUG] Project root: {self.project_root}")
        print(f"[DEBUG] Supported image extensions: {', '.join(self.supported_extensions)}")
        print(f"[DEBUG] Logo files: search in icons directory")
        print(f"[DEBUG] Background/Branding: search in launch directory")

        selected_files = {}

        # 1. Search for logo files in icons directory
        app_icons_path = self._get_app_icons_path()

        print(f"\n[DEBUG] === Searching for logo files ===")
        print(f"[DEBUG] Checking app-specific icons path: {app_icons_path}")
        if self._directory_exists(app_icons_path):
            print(f"[INFO] [OK] Found app-specific icons directory")
            app_logo_files = self._find_splash_files(app_icons_path)

            if app_logo_files:
                print(f"[INFO] [OK] Found {len(app_logo_files)} logo file(s) in app-specific icons")
                for file_path in app_logo_files:
                    selected_files[file_path.name] = file_path
                    print(f"[DEBUG]   Selected: {file_path.name} -> {file_path}")
        else:
            print(f"[DEBUG] [SKIP] App-specific icons directory not found")

            # Fallback to common icons directory
            print(f"[DEBUG] Checking common icons path: {self.common_icons_path}")
            if self._directory_exists(self.common_icons_path):
                print(f"[INFO] [OK] Using common icons as fallback")
                common_logo_files = self._find_splash_files(self.common_icons_path)

                if common_logo_files:
                    print(f"[DEBUG] Found {len(common_logo_files)} logo file(s) in common icons")
                    for file_path in common_logo_files:
                        selected_files[file_path.name] = file_path
                        print(f"[DEBUG]   Selected: {file_path.name} -> {file_path}")
            else:
                print(f"[DEBUG] [SKIP] Common icons directory not found")

        # 2. Search for background/branding files in launch directory
        app_launch_path = self._get_app_launch_path()

        print(f"\n[DEBUG] === Searching for background/branding files ===")
        print(f"[DEBUG] Checking app-specific launch path: {app_launch_path}")
        if self._directory_exists(app_launch_path):
            print(f"[INFO] [OK] Found app-specific launch directory")
            app_launch_files = self._find_splash_files(app_launch_path)

            if app_launch_files:
                print(f"[INFO] [OK] Found {len(app_launch_files)} file(s) in app-specific launch")
                for file_path in app_launch_files:
                    selected_files[file_path.name] = file_path
                    print(f"[DEBUG]   Selected: {file_path.name} -> {file_path}")
        else:
            print(f"[DEBUG] [SKIP] App-specific launch directory not found")

            # Fallback to common launch directory
            print(f"[DEBUG] Checking common launch path: {self.common_launch_path}")
            if self._directory_exists(self.common_launch_path):
                print(f"[INFO] [OK] Using common launch files as fallback")
                common_launch_files = self._find_splash_files(self.common_launch_path)

                if common_launch_files:
                    print(f"[DEBUG] Found {len(common_launch_files)} file(s) in common launch")
                    for file_path in common_launch_files:
                        selected_files[file_path.name] = file_path
                        print(f"[DEBUG]   Selected: {file_path.name} -> {file_path}")
            else:
                print(f"[DEBUG] [SKIP] Common launch directory not found")

        if not selected_files:
            print(f"[WARNING] No splash files found in any directory")

        print(f"\n[DEBUG] Total files selected: {len(selected_files)}")
        return selected_files

    def _get_file_priority(self, filename: str, image_type: str) -> int:
        """
        Get priority score for file selection (lower is better)

        Priority rules:
        - Simple names (logo.png, splash.png) get higher priority
        - Files with _bak, _old, backup get lower priority
        - Shorter names get higher priority
        """
        filename_lower = filename.lower()
        score = 100

        # Penalize backup/old files
        if any(keyword in filename_lower for keyword in ['_bak', '_old', 'backup', '_backup', '.backup']):
            score += 50

        # Penalize placeholder files
        if 'placeholder' in filename_lower:
            score += 30

        # Prefer exact matches
        exact_matches = {
            'background': ['background.png', 'splash.png'],
            'background_dark': ['background_dark.png', 'splash_dark.png'],
            'image': ['logo.png', 'icon.png'],
            'image_dark': ['logo_dark.png', 'icon_dark.png'],
            'branding': ['branding.png', 'brand.png'],
            'branding_dark': ['branding_dark.png', 'brand_dark.png']
        }

        if image_type in exact_matches and filename_lower in exact_matches[image_type]:
            score -= 30

        # Shorter names get better score (within reason)
        score += min(len(filename), 20)

        return score

    def _classify_and_fallback_images(self, splash_files: Dict[str, Path]) -> Dict[str, str]:
        """
        Classify splash images and apply fallback logic for missing dark variants

        When multiple files of the same type are found, selects the best one based on priority

        Returns:
            Dictionary mapping YAML keys to relative paths
        """
        print(f"\n[DEBUG] Classifying {len(splash_files)} splash file(s):")

        # Store all candidates for each type
        candidates = {}

        # First pass: classify all images and collect candidates
        for file_name, file_path in splash_files.items():
            relative_path = self._get_relative_path(file_path)
            image_type = self.constants.classify_splash_image(file_name)

            if image_type:
                if image_type not in candidates:
                    candidates[image_type] = []
                priority = self._get_file_priority(file_name, image_type)
                candidates[image_type].append((priority, file_name, relative_path))
                print(f"[DEBUG]   {file_name} -> {image_type}: {relative_path} (priority: {priority})")

        # Select best candidate for each type
        classified = {}
        print(f"\n[DEBUG] Selecting best candidates:")
        for image_type, candidate_list in candidates.items():
            # Sort by priority (lower is better)
            sorted_candidates = sorted(candidate_list, key=lambda x: x[0])
            best_priority, best_file, best_path = sorted_candidates[0]

            classified[image_type] = best_path
            if len(sorted_candidates) > 1:
                print(f"[DEBUG]   {image_type}: Selected '{best_file}' (priority {best_priority}) from {len(sorted_candidates)} candidates")
            else:
                print(f"[DEBUG]   {image_type}: '{best_file}' (only candidate)")

        # Second pass: apply fallback logic for missing dark variants
        fallback_pairs = [
            ("background", "background_dark"),
            ("image", "image_dark"),
            ("branding", "branding_dark")
        ]

        print(f"\n[DEBUG] Applying fallback logic for missing dark variants:")
        for light_key, dark_key in fallback_pairs:
            if light_key in classified and dark_key not in classified:
                classified[dark_key] = classified[light_key]
                print(f"[DEBUG]   {dark_key} not found, using {light_key} as fallback: {classified[light_key]}")
            elif dark_key in classified and light_key not in classified:
                classified[light_key] = classified[dark_key]
                print(f"[DEBUG]   {light_key} not found, using {dark_key} as fallback: {classified[dark_key]}")

        # Map to actual YAML keys
        yaml_mapping = {
            "background": "background_image",
            "background_dark": "background_image_dark",
            "image": "image",
            "image_dark": "image_dark",
            "branding": "branding",
            "branding_dark": "branding_dark"
        }

        result = {}
        for img_type, path in classified.items():
            yaml_key = yaml_mapping.get(img_type)
            if yaml_key:
                result[yaml_key] = path

        print(f"\n[DEBUG] Final classification results:")
        for key, value in result.items():
            print(f"[DEBUG]   {key}: {value}")

        return result

    def _get_relative_path(self, full_path: Path) -> str:
        """Get relative path from project root"""
        try:
            return str(full_path.relative_to(self.project_root)).replace("\\", "/")
        except ValueError:
            return str(full_path).replace("\\", "/")

    def _load_yaml_template(self) -> str:
        """
        Load YAML template from file or create it with hardcoded content

        Returns:
            Template content as string
        """
        # Try to read template from file
        if self.template_path.exists():
            print(f"[DEBUG] Loading template from: {self.template_path}")
            try:
                template_content = self.template_path.read_text(encoding='utf-8')
                print(f"[DEBUG] Template loaded successfully ({len(template_content)} bytes)")
                return template_content
            except Exception as e:
                print(f"\033[93m[WARNING] Failed to read template file: {e}\033[0m")
                print(f"\033[93m[WARNING] Using hardcoded template instead\033[0m")
        else:
            print(f"\033[93m[WARNING] Template file not found: {self.template_path}\033[0m")
            print(f"\033[93m[WARNING] Creating template from hardcoded content\033[0m")

        # Hardcoded template content (fallback)
        hardcoded_template = '''flutter_native_splash:
  # Basic splash screen configuration
  # Either color or background_image is required
  color: "#667eea"
  #background_image: "assets/common/launch/splash_bg.png"

  # Splash screen logo/image
  #image: "assets/common/launch/splash_logo.png"

  # Branding image (appears at bottom)
  #branding: "assets/common/launch/branding.png"
  #branding_mode: bottom
  #branding_bottom_padding: 24

  # Dark mode variants
  color_dark: "#121212"
  #background_image_dark: "assets/common/launch/splash_bg_dark.png"
  #image_dark: "assets/common/launch/splash_logo_dark.png"
  #branding_dark: "assets/common/launch/branding_dark.png"

  # Android 12+ specific configuration
  android_12:
    color: "#667eea"
    color_dark: "#121212"
    icon_background_color: "#667eea"
    icon_background_color_dark: "#121212"
    #image: "assets/common/launch/splash_logo.png"
    #image_dark: "assets/common/launch/splash_logo_dark.png"
    #branding: "assets/common/launch/branding.png"

  # Platform toggles
  android: true
  ios: true
  web: true

  # Image positioning
  #android_gravity: center
  #ios_content_mode: center
  #web_image_mode: center

  # Fullscreen mode
  fullscreen: true

  # Platform-specific colors
  #color_android: "#667eea"
  #color_dark_android: "#121212"
  #color_ios: "#667eea"
  #color_dark_ios: "#121212"
  #color_web: "#667eea"
  #color_dark_web: "#121212"

  # Platform-specific images
  #image_android: "assets/common/launch/splash_logo.png"
  #image_dark_android: "assets/common/launch/splash_logo_dark.png"
  #image_ios: "assets/common/launch/splash_logo.png"
  #image_dark_ios: "assets/common/launch/splash_logo_dark.png"
  #image_web: "assets/common/launch/splash_logo.png"
  #image_dark_web: "assets/common/launch/splash_logo_dark.png"

  # Platform-specific background images
  #background_image_android: "assets/common/launch/splash_bg.png"
  #background_image_dark_android: "assets/common/launch/splash_bg_dark.png"
  #background_image_ios: "assets/common/launch/splash_bg.png"
  #background_image_dark_ios: "assets/common/launch/splash_bg_dark.png"
  #background_image_web: "assets/common/launch/splash_bg.png"
  #background_image_dark_web: "assets/common/launch/splash_bg_dark.png"

  # Platform-specific branding
  #branding_android: "assets/common/launch/branding.png"
  #branding_bottom_padding_android: 24
  #branding_dark_android: "assets/common/launch/branding_dark.png"
  #branding_ios: "assets/common/launch/branding.png"
  #branding_bottom_padding_ios: 24
  #branding_dark_ios: "assets/common/launch/branding_dark.png"
  #branding_web: "assets/common/launch/branding.png"
  #branding_dark_web: "assets/common/launch/branding_dark.png"
'''

        # Create template file if it doesn't exist
        try:
            self.template_path.parent.mkdir(parents=True, exist_ok=True)
            self.template_path.write_text(hardcoded_template, encoding='utf-8')
            print(f"[INFO] Template file created: {self.template_path}")
        except Exception as e:
            print(f"\033[93m[WARNING] Failed to create template file: {e}\033[0m")

        return hardcoded_template

    def _is_path_config(self, key: str) -> bool:
        """Check if config key is a path-type configuration"""
        # Exclude color-related keys even if they contain "background"
        if 'color' in key.lower():
            return False

        path_keywords = ["image", "branding", "background"]
        key_lower = key.lower()
        return any(keyword in key_lower for keyword in path_keywords)

    def _get_recommended_value(self, key: str, current_value: Optional[str] = None) -> Optional[str]:
        """
        Get recommended value for a configuration key

        Args:
            key: Configuration key
            current_value: Current value from auto-detection (for path types)

        Returns:
            Recommended value or None
        """
        # For path types, use auto-detected value only
        if self._is_path_config(key):
            return current_value

        # For non-path types, use recommended defaults
        recommendations = {
            "color": "#667eea",
            "color_dark": "#121212",
            "color_android": "#667eea",
            "color_dark_android": "#121212",
            "color_ios": "#667eea",
            "color_dark_ios": "#121212",
            "color_web": "#667eea",
            "color_dark_web": "#121212",
            "android": True,
            "ios": True,
            "web": True,
            "fullscreen": True,
            "android_gravity": "fill",
            "ios_content_mode": "center",
            "web_image_mode": "center",
            "branding_mode": "bottom",
            "branding_bottom_padding": 24,
        }

        # For android_12 section
        android_12_recommendations = {
            "color": "#667eea",
            "color_dark": "#121212",
            "icon_background_color": "#667eea",
            "icon_background_color_dark": "#121212",
        }

        return recommendations.get(key, android_12_recommendations.get(key))

    def _merge_config_into_template(self, template: str, config: Dict, auto_detected: Dict[str, str]) -> str:
        """
        Merge configuration values into YAML template

        Rules:
        1. Only process keys that are activated in INI or template
        2. Path types (activated):
           - Priority: auto-detected > INI value > disable with comment
           - If not found, show warning
        3. Path types (not activated but auto-detected):
           - Keep commented but replace value
           - Show yellow warning
        4. Non-path types: Use INI value or recommended default

        Args:
            template: YAML template content
            config: Configuration values from INI file
            auto_detected: Auto-detected file paths

        Returns:
            Merged YAML content
        """
        print(f"\n[DEBUG] Merging configuration into template:")
        print(f"[DEBUG]   Config values from INI: {len(config)} items")
        print(f"[DEBUG]   Auto-detected files: {len(auto_detected)} items")

        lines = template.split('\n')
        updated_lines = []

        # Separate path and non-path configs from INI
        path_configs_from_ini = {k: v for k, v in config.items() if self._is_path_config(k) and k != 'android_12'}
        non_path_configs = {k: v for k, v in config.items() if not self._is_path_config(k) and k != 'android_12'}

        # Extract android_12 nested config
        android_12_config_from_ini = config.get('android_12', {})

        print(f"\n[DEBUG] Configuration breakdown:")
        print(f"[DEBUG]   Auto-detected paths: {len(auto_detected)} items")
        for k, v in auto_detected.items():
            print(f"[DEBUG]     {k} = {v}")
        print(f"[DEBUG]   Path configs from INI: {len(path_configs_from_ini)} items")
        for k, v in path_configs_from_ini.items():
            print(f"[DEBUG]     {k} = {v}")
        print(f"[DEBUG]   Non-path configs from INI: {len(non_path_configs)} items")
        for k, v in non_path_configs.items():
            print(f"[DEBUG]     {k} = {v}")
        if android_12_config_from_ini:
            print(f"[DEBUG]   Android 12+ config from INI: {len(android_12_config_from_ini)} items")
            for k, v in android_12_config_from_ini.items():
                print(f"[DEBUG]     android_12.{k} = {v}")

        # Find activated keys in template (uncommented lines)
        activated_in_template = set()
        for line in lines:
            stripped = line.strip()
            if ':' in stripped and not stripped.startswith('#'):
                key_part = stripped.split(':', 1)[0].strip()
                if key_part and key_part not in ['flutter_native_splash', 'android_12']:
                    activated_in_template.add(key_part)

        # Activated keys = keys uncommented in INI or template
        activated_keys = activated_in_template.copy()
        activated_keys.update(config.keys())

        print(f"\n[DEBUG] Activated configuration keys: {len(activated_keys)}")
        for key in sorted(activated_keys):
            source = []
            if key in config:
                source.append("INI")
            if key in activated_in_template:
                source.append("Template")
            print(f"[DEBUG]   - {key} (from: {', '.join(source)})")

        # Track android_12 section
        in_android_12_section = False
        android_12_indent = 0

        # Process each line
        for line in lines:
            stripped = line.strip()
            updated = False

            # Track android_12 section boundaries
            if stripped == 'android_12:':
                in_android_12_section = True
                android_12_indent = len(line) - len(line.lstrip())
                updated_lines.append(line)
                updated = True
                continue
            elif in_android_12_section and stripped and not stripped.startswith('#'):
                # Check if we've exited android_12 section (less indentation)
                current_indent = len(line) - len(line.lstrip())
                if current_indent <= android_12_indent and ':' in stripped:
                    in_android_12_section = False

            # Check for commented lines
            if stripped.startswith('#') and ':' in stripped:
                key_part = stripped[1:].split(':', 1)[0].strip()
                indent = len(line) - len(line.lstrip())

                # Check if this is a path type
                is_path = self._is_path_config(key_part)

                # Get config source based on section
                if in_android_12_section:
                    # In android_12 section: use android_12 config from INI
                    section_path_configs = {}
                    section_non_path_configs = {}
                    for k, v in android_12_config_from_ini.items():
                        if self._is_path_config(k):
                            section_path_configs[k] = v
                        else:
                            section_non_path_configs[k] = v
                    # Check if activated in INI
                    is_activated = key_part in android_12_config_from_ini
                else:
                    section_path_configs = path_configs_from_ini
                    section_non_path_configs = non_path_configs
                    is_activated = key_part in activated_keys

                if is_path:
                    # Path type: ALWAYS try to use auto-detected or INI value
                    value_to_use = auto_detected.get(key_part) or section_path_configs.get(key_part)

                    if is_activated:
                        # Activated: uncomment and set value
                        if value_to_use:
                            updated_lines.append(f"{' ' * indent}{key_part}: {value_to_use}")
                            source = "auto-detected" if key_part in auto_detected else "INI"
                            print(f"[INFO] [OK] Activated path {key_part}: {value_to_use} (from {source})")
                            updated = True
                        else:
                            # Activated but no value found - disable with explanation
                            updated_lines.append(f"{' ' * indent}# {key_part} is enabled but no resource found - leaving disabled")
                            updated_lines.append(line)
                            print(f"\033[93m[WARNING] Path '{key_part}' is activated but no resource found (neither auto-detected nor in INI). Keeping disabled.\033[0m")
                            updated = True
                    elif value_to_use:
                        # Not activated but has value: keep commented, replace value
                        updated_lines.append(f"{' ' * indent}#{key_part}: {value_to_use}")
                        source = "auto-detected" if key_part in auto_detected else "INI"
                        print(f"\033[93m[INFO] Path '{key_part}' not activated, but resource found ({source}): {value_to_use}. Keeping commented.\033[0m")
                        updated = True
                else:
                    # Non-path type: only process if activated
                    if is_activated:
                        value_to_use = section_non_path_configs.get(key_part) or self._get_recommended_value(key_part)

                        if value_to_use is not None:
                            # Format value
                            if isinstance(value_to_use, bool):
                                value_str = 'true' if value_to_use else 'false'
                            elif isinstance(value_to_use, (int, float)):
                                value_str = str(value_to_use)
                            else:
                                value_str = str(value_to_use)

                            updated_lines.append(f"{' ' * indent}{key_part}: {value_str}")
                            if in_android_12_section:
                                source = "INI" if key_part in android_12_config_from_ini else "recommended default"
                                print(f"[INFO] [OK] Activated android_12.{key_part}: {value_str} (from {source})")
                            else:
                                source = "INI" if key_part in non_path_configs else "recommended default"
                                print(f"[INFO] [OK] Activated non-path {key_part}: {value_str} (from {source})")
                            updated = True

            # Check for uncommented key-value pairs
            elif ':' in stripped and not stripped.startswith('#'):
                key_part = stripped.split(':', 1)[0].strip()

                # Skip section headers
                if key_part in ['flutter_native_splash', 'android_12']:
                    updated_lines.append(line)
                    updated = True
                else:
                    indent = len(line) - len(line.lstrip())
                    is_path = self._is_path_config(key_part)

                    # Get config source based on section
                    if in_android_12_section:
                        section_path_configs = {}
                        section_non_path_configs = {}
                        for k, v in android_12_config_from_ini.items():
                            if self._is_path_config(k):
                                section_path_configs[k] = v
                            else:
                                section_non_path_configs[k] = v
                    else:
                        section_path_configs = path_configs_from_ini
                        section_non_path_configs = non_path_configs

                    if is_path:
                        # Path type: use auto-detected > INI value
                        value_to_use = auto_detected.get(key_part) or section_path_configs.get(key_part)

                        if value_to_use:
                            updated_lines.append(f"{' ' * indent}{key_part}: {value_to_use}")
                            source = "auto-detected" if key_part in auto_detected else "INI"
                            print(f"[INFO] [OK] Updated path {key_part}: {value_to_use} (from {source})")
                            updated = True
                        else:
                            # Activated but no value - disable with comment
                            updated_lines.append(f"{' ' * indent}# {key_part} is enabled but no resource found - disabling")
                            updated_lines.append(f"{' ' * indent}#{key_part}: ")
                            print(f"\033[93m[WARNING] Path '{key_part}' is activated but no resource found. Disabling.\033[0m")
                            updated = True
                    else:
                        # Non-path type: use INI or recommended value
                        value_to_use = section_non_path_configs.get(key_part) or self._get_recommended_value(key_part)

                        if value_to_use is not None:
                            # Format value
                            if isinstance(value_to_use, bool):
                                value_str = 'true' if value_to_use else 'false'
                            elif isinstance(value_to_use, (int, float)):
                                value_str = str(value_to_use)
                            else:
                                value_str = str(value_to_use)

                            updated_lines.append(f"{' ' * indent}{key_part}: {value_str}")
                            if in_android_12_section:
                                source = "INI" if key_part in android_12_config_from_ini else "recommended default"
                                print(f"[INFO] [OK] Updated android_12.{key_part}: {value_str} (from {source})")
                            else:
                                source = "INI" if key_part in non_path_configs else "recommended default"
                                print(f"[INFO] [OK] Updated non-path {key_part}: {value_str} (from {source})")
                            updated = True

            if not updated:
                updated_lines.append(line)

        return '\n'.join(updated_lines)

    def backup_current_config(self) -> bool:
        """Backup the current splash configuration"""
        print(f"\n[DEBUG] Checking for existing config to backup: {self.splash_config_path}")
        if self.splash_config_path.exists():
            # Use shared constants for backup path
            backup_path = self.splash_config_path.with_suffix(self.constants.SPLASH_BACKUP_SUFFIX)
            print(f"[DEBUG] Backup path: {backup_path}")

            try:
                config_content = self.splash_config_path.read_text(encoding='utf-8')
                print(f"[DEBUG] Config file size: {len(config_content)} bytes")
                backup_path.write_text(config_content, encoding='utf-8')
                print(f"[INFO] [OK] Backed up current splash config to: {backup_path.name}")
                return True
            except Exception as e:
                print(f"[ERROR] Failed to backup splash config: {e}")
                import traceback
                traceback.print_exc()
                return False
        else:
            print(f"[DEBUG] No existing config file found, skipping backup")
        return True

    def update_splash_config(self, splash_files: Dict[str, Path]) -> bool:
        """
        Update splash configuration using template-based approach

        Args:
            splash_files: Dictionary of splash files found

        Returns:
            True if successful, False otherwise
        """
        print(f"\n[DEBUG] Starting template-based splash config update")

        # Step 1: Load YAML template
        print(f"\n[STEP 1/4] Loading YAML template...")
        template_content = self._load_yaml_template()

        # Step 2: Load app configuration from INI
        print(f"\n[STEP 2/4] Loading app configuration from build_config.ini...")
        try:
            # Load config but avoid calling print_config_summary (encoding issues)
            self.app_config.config.read(self.app_config.config_path, encoding='utf-8')
            self.app_config._parse_config()

            splash_config = self.app_config.config_data.get('splash_config', {})
            print(f"[DEBUG] Loaded splash config from INI: {len(splash_config)} items")
            if splash_config:
                for key, value in splash_config.items():
                    try:
                        print(f"[DEBUG]   {key} = {value}")
                    except UnicodeEncodeError:
                        print(f"[DEBUG]   {key} = [value contains special characters]")
            else:
                print(f"[DEBUG] No splash_config section found in INI (using defaults)")
        except Exception as e:
            print(f"[WARNING] Failed to load app config: {e}")
            import traceback
            traceback.print_exc()
            splash_config = {}

        # Step 3: Classify and auto-detect all splash images (background, logo, branding)
        print(f"\n[STEP 3/4] Classifying and auto-detecting splash images...")
        auto_detected_config = self._classify_and_fallback_images(splash_files)

        # Step 4: Merge all configurations into template
        print(f"\n[STEP 4/4] Merging configurations into template...")
        final_yaml = self._merge_config_into_template(
            template=template_content,
            config=splash_config,
            auto_detected=auto_detected_config
        )

        # Write final YAML to config file
        print(f"\n[DEBUG] Writing final YAML to: {self.splash_config_path}")
        try:
            self.splash_config_path.write_text(final_yaml, encoding='utf-8')
            print(f"[DEBUG] Config file written successfully ({len(final_yaml)} bytes)")
        except Exception as e:
            print(f"[ERROR] Failed to write config file: {e}")
            import traceback
            traceback.print_exc()
            return False

        print(f"\n[SUCCESS] Splash configuration updated successfully for app: {self.app_name}")
        print(f"[SUCCESS]   Template-based: YES")
        print(f"[SUCCESS]   INI config items: {len(splash_config)}")
        print(f"[SUCCESS]   Auto-detected files: {len(auto_detected_config)}")
        return True

    def update_app_splash(self) -> bool:
        """
        Complete splash update process for the app

        Returns:
            True if successful, False otherwise
        """
        print("=" * 50)
        print(f"Splash Update Process for App: {self.app_name}")
        print("=" * 50)

        # Find splash files for the app
        splash_files = self.find_best_splash_files()

        if not splash_files:
            print(f"[WARNING] No splash files found for app: {self.app_name}")
            return False

        print(f"[INFO] Found {len(splash_files)} splash file(s):")
        for file_name, file_path in splash_files.items():
            print(f"  - {file_name} : {file_path}")

        # Backup current config
        if not self.backup_current_config():
            print("[ERROR] Failed to backup current configuration")
            return False

        # Update splash configuration
        if not self.update_splash_config(splash_files):
            print("[ERROR] Failed to update splash configuration")
            return False

        print(f"[SUCCESS] Splash configuration updated successfully for app: {self.app_name}")
        return True


def main():
    """Main function using file variable system (no arguments required)"""
    print(f"[DEBUG] Script started with {len(sys.argv)} argument(s)")
    print(f"[DEBUG] Arguments: {sys.argv}")
    print(f"[DEBUG] Python version: {sys.version}")
    print(f"[DEBUG] Script location: {__file__}")

    # Read app name from file variable system (shared with PowerShell)
    print(f"\n[DEBUG] Reading variables from file variable system...")
    print(f"[DEBUG] File variable directory: {unified_vars.gvar_exchange_dir}")

    app_name = unified_vars.get_file_variable(unified_vars.KEY_SELECTED_APP, "")
    selected_action = unified_vars.get_file_variable(unified_vars.KEY_SELECTED_ACTION, "")
    selected_platform = unified_vars.get_file_variable(unified_vars.KEY_SELECTED_PLATFORM, "")
    script_path = unified_vars.get_file_variable(unified_vars.KEY_SCRIPT_PATH, "")

    print(f"[DEBUG] File variables read:")
    print(f"[DEBUG]   KEY_SELECTED_APP = '{app_name}'")
    print(f"[DEBUG]   KEY_SELECTED_ACTION = '{selected_action}'")
    print(f"[DEBUG]   KEY_SELECTED_PLATFORM = '{selected_platform}'")
    print(f"[DEBUG]   KEY_SCRIPT_PATH = '{script_path}'")

    if not app_name:
        print("[ERROR] No app selected. Please run from PowerShell start script first.")
        print(f"[ERROR] Expected file variable: {unified_vars.KEY_SELECTED_APP}")
        sys.exit(1)

    print(f"[DEBUG] Target app from file variables: {app_name}")

    # Create manager with app name (project root and constants are handled internally)
    print(f"\n[DEBUG] Initializing SplashConfigManager...")
    manager = SplashConfigManager(app_name)
    print(f"[DEBUG] Manager initialized successfully")

    success = manager.update_app_splash()

    print(f"\n[DEBUG] Script finished with exit code: {0 if success else 1}")
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()