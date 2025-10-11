# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

#!/usr/bin/env python3
"""
App Configuration Reader
Reads and processes build_config.ini files for Flutter apps
"""

import configparser
import random
import string
import sys
from pathlib import Path
from typing import Dict, Optional, Any

# Add parent directories to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.constants.build_constants import (
    DEFAULT_PACKAGE_ID,
    DEFAULT_APP_DISPLAY_NAME_CN,
    DEFAULT_APP_DISPLAY_NAME_EN
)
from shared.directory_manager import DirectoryManager

class AppConfigReader:
    """Reader for app build configuration files"""

    def __init__(self, app_name: str, build_root: Optional[Path] = None):
        self.app_name = app_name
        self.directory_manager = DirectoryManager()

        # Build config path - prefer build_root if provided, otherwise use current_dir
        if build_root:
            # Use build directory path
            flutter_apps_dir = build_root / "lib" / "apps"
            self.config_path = flutter_apps_dir / app_name / "build_config.ini"
            print(f"[CONFIG] Using build root path: {build_root}")
        else:
            # Use source directory path (original behavior)
            flutter_apps_dir = self.directory_manager.current_dir / "lib" / "apps"
            self.config_path = flutter_apps_dir / app_name / "build_config.ini"
            print(f"[CONFIG] Using source directory path: {self.directory_manager.current_dir}")
        self.config = configparser.ConfigParser()
        self.config_data = {}

    def load_config(self) -> Dict[str, Any]:
        """Load and parse the build configuration file"""
        try:
            print(f"[CONFIG] Looking for config file: {self.config_path}")
            if self.config_path.exists():
                print(f"[CONFIG] ✓ Config file found and loaded: {self.config_path}")
                self.config.read(self.config_path, encoding='utf-8')
                self._parse_config()
            else:
                print(f"[CONFIG] Warning: {self.config_path} not found, using defaults")
                self._set_defaults()

            # Apply randomization if enabled
            self._apply_randomization()

            return self.config_data

        except Exception as e:
            print(f"[CONFIG] Error loading config: {e}")
            self._set_defaults()
            return self.config_data

    def _parse_config(self):
        """Parse configuration sections"""
        # App info section
        app_info = {}
        if self.config.has_section('app_info'):
            app_info['app_name'] = self.config.get('app_info', 'app_name', fallback=self.app_name)
            app_info['display_name_chinese'] = self.config.get('app_info', 'display_name_chinese', fallback=DEFAULT_APP_DISPLAY_NAME_CN)
            app_info['display_name_english'] = self.config.get('app_info', 'display_name_english', fallback=DEFAULT_APP_DISPLAY_NAME_EN)
            app_info['description'] = self.config.get('app_info', 'description', fallback=f"Application for {self.app_name}")
        else:
            app_info = self._get_default_app_info()

        # Package settings section
        package_settings = {}
        if self.config.has_section('package_settings'):
            package_settings['random_package_id'] = self.config.getboolean('package_settings', 'random_package_id', fallback=True)
            package_settings['default_package_id'] = self.config.get('package_settings', 'default_package_id', fallback=DEFAULT_PACKAGE_ID)
            package_settings['random_display_name'] = self.config.getboolean('package_settings', 'random_display_name', fallback=True)
        else:
            package_settings = self._get_default_package_settings()

        # Build settings section
        build_settings = {}
        if self.config.has_section('build_settings'):
            build_settings['build_platforms'] = self.config.get('build_settings', 'build_platforms', fallback='android')
            build_settings['use_external_resources'] = self.config.getboolean('build_settings', 'use_external_resources', fallback=True)
            build_settings['optimize_images'] = self.config.getboolean('build_settings', 'optimize_images', fallback=True)
            build_settings['use_external_safe_build'] = self.config.getboolean('build_settings', 'use_external_safe_build', fallback=True)
        else:
            build_settings = self._get_default_build_settings()

        # Resources section
        resources = {}
        if self.config.has_section('resources'):
            resources['icon_file'] = self.config.get('resources', 'icon_file', fallback='icon.png')
            resources['small_icon_file'] = self.config.get('resources', 'small_icon_file', fallback='notification_icon.png')
            resources['splash_screen_file'] = self.config.get('resources', 'splash_screen_file', fallback='splash.png')
            resources['background_image_file'] = self.config.get('resources', 'background_image_file', fallback='background.png')
        else:
            resources = self._get_default_resources()

        # Splash config section
        splash_config = {}
        if self.config.has_section('splash_config'):
            splash_config = self._parse_splash_config()
        else:
            splash_config = {}

        self.config_data = {
            'app_info': app_info,
            'package_settings': package_settings,
            'build_settings': build_settings,
            'resources': resources,
            'splash_config': splash_config
        }

    def _set_defaults(self):
        """Set default configuration values"""
        self.config_data = {
            'app_info': self._get_default_app_info(),
            'package_settings': self._get_default_package_settings(),
            'build_settings': self._get_default_build_settings(),
            'resources': self._get_default_resources(),
            'splash_config': {}
        }

    def _get_default_app_info(self) -> Dict[str, str]:
        """Get default app info"""
        return {
            'app_name': self.app_name,
            'display_name_chinese': DEFAULT_APP_DISPLAY_NAME_CN,
            'display_name_english': DEFAULT_APP_DISPLAY_NAME_EN,
            'description': f"Application for {self.app_name}"
        }

    def _get_default_package_settings(self) -> Dict[str, Any]:
        """Get default package settings"""
        return {
            'random_package_id': True,
            'default_package_id': DEFAULT_PACKAGE_ID,
            'random_display_name': True
        }

    def _get_default_build_settings(self) -> Dict[str, Any]:
        """Get default build settings"""
        return {
            'build_platforms': 'android',
            'use_external_resources': True,
            'optimize_images': True,
            'use_external_safe_build': True
        }

    def _get_default_resources(self) -> Dict[str, str]:
        """Get default resource settings"""
        return {
            'icon_file': 'icon.png',
            'small_icon_file': 'notification_icon.png',
            'splash_screen_file': 'splash.png',
            'background_image_file': 'background.png'
        }

    def _parse_splash_config(self) -> Dict[str, Any]:
        """Parse splash configuration section"""
        splash_config = {}

        # Basic colors
        if self.config.has_option('splash_config', 'color'):
            splash_config['color'] = self.config.get('splash_config', 'color')
        if self.config.has_option('splash_config', 'color_dark'):
            splash_config['color_dark'] = self.config.get('splash_config', 'color_dark')

        # Background images
        if self.config.has_option('splash_config', 'background_image'):
            splash_config['background_image'] = self.config.get('splash_config', 'background_image')
        if self.config.has_option('splash_config', 'background_image_dark'):
            splash_config['background_image_dark'] = self.config.get('splash_config', 'background_image_dark')

        # Splash logo/image
        if self.config.has_option('splash_config', 'image'):
            splash_config['image'] = self.config.get('splash_config', 'image')
        if self.config.has_option('splash_config', 'image_dark'):
            splash_config['image_dark'] = self.config.get('splash_config', 'image_dark')

        # Branding
        if self.config.has_option('splash_config', 'branding'):
            splash_config['branding'] = self.config.get('splash_config', 'branding')
        if self.config.has_option('splash_config', 'branding_dark'):
            splash_config['branding_dark'] = self.config.get('splash_config', 'branding_dark')
        if self.config.has_option('splash_config', 'branding_mode'):
            splash_config['branding_mode'] = self.config.get('splash_config', 'branding_mode')
        if self.config.has_option('splash_config', 'branding_bottom_padding'):
            splash_config['branding_bottom_padding'] = self.config.getint('splash_config', 'branding_bottom_padding')

        # Android 12+ configuration
        android_12_config = {}
        if self.config.has_option('splash_config', 'android_12_color'):
            android_12_config['color'] = self.config.get('splash_config', 'android_12_color')
        if self.config.has_option('splash_config', 'android_12_color_dark'):
            android_12_config['color_dark'] = self.config.get('splash_config', 'android_12_color_dark')
        if self.config.has_option('splash_config', 'android_12_icon_background_color'):
            android_12_config['icon_background_color'] = self.config.get('splash_config', 'android_12_icon_background_color')
        if self.config.has_option('splash_config', 'android_12_icon_background_color_dark'):
            android_12_config['icon_background_color_dark'] = self.config.get('splash_config', 'android_12_icon_background_color_dark')
        if self.config.has_option('splash_config', 'android_12_image'):
            android_12_config['image'] = self.config.get('splash_config', 'android_12_image')
        if self.config.has_option('splash_config', 'android_12_image_dark'):
            android_12_config['image_dark'] = self.config.get('splash_config', 'android_12_image_dark')
        if android_12_config:
            splash_config['android_12'] = android_12_config

        # Platform toggles
        if self.config.has_option('splash_config', 'android'):
            splash_config['android'] = self.config.getboolean('splash_config', 'android')
        if self.config.has_option('splash_config', 'ios'):
            splash_config['ios'] = self.config.getboolean('splash_config', 'ios')
        if self.config.has_option('splash_config', 'web'):
            splash_config['web'] = self.config.getboolean('splash_config', 'web')

        # Image positioning
        if self.config.has_option('splash_config', 'android_gravity'):
            splash_config['android_gravity'] = self.config.get('splash_config', 'android_gravity')
        if self.config.has_option('splash_config', 'ios_content_mode'):
            splash_config['ios_content_mode'] = self.config.get('splash_config', 'ios_content_mode')
        if self.config.has_option('splash_config', 'web_image_mode'):
            splash_config['web_image_mode'] = self.config.get('splash_config', 'web_image_mode')

        # Fullscreen
        if self.config.has_option('splash_config', 'fullscreen'):
            splash_config['fullscreen'] = self.config.getboolean('splash_config', 'fullscreen')

        # Platform-specific colors
        if self.config.has_option('splash_config', 'color_android'):
            splash_config['color_android'] = self.config.get('splash_config', 'color_android')
        if self.config.has_option('splash_config', 'color_dark_android'):
            splash_config['color_dark_android'] = self.config.get('splash_config', 'color_dark_android')
        if self.config.has_option('splash_config', 'color_ios'):
            splash_config['color_ios'] = self.config.get('splash_config', 'color_ios')
        if self.config.has_option('splash_config', 'color_dark_ios'):
            splash_config['color_dark_ios'] = self.config.get('splash_config', 'color_dark_ios')
        if self.config.has_option('splash_config', 'color_web'):
            splash_config['color_web'] = self.config.get('splash_config', 'color_web')
        if self.config.has_option('splash_config', 'color_dark_web'):
            splash_config['color_dark_web'] = self.config.get('splash_config', 'color_dark_web')

        return splash_config

    def _apply_randomization(self):
        """Apply randomization based on settings"""
        package_settings = self.config_data.get('package_settings', {})
        app_info = self.config_data.get('app_info', {})

        # Randomize package ID if enabled
        if package_settings.get('random_package_id', True):
            self.config_data['package_settings']['generated_package_id'] = self._generate_random_package_id()
        else:
            self.config_data['package_settings']['generated_package_id'] = package_settings.get('default_package_id', DEFAULT_PACKAGE_ID)

        # Randomize display names if enabled
        if package_settings.get('random_display_name', True):
            self.config_data['app_info']['generated_display_name_chinese'] = self._generate_random_chinese_name()
            self.config_data['app_info']['generated_display_name_english'] = self._generate_random_english_name()
        else:
            self.config_data['app_info']['generated_display_name_chinese'] = app_info.get('display_name_chinese', DEFAULT_APP_DISPLAY_NAME_CN)
            self.config_data['app_info']['generated_display_name_english'] = app_info.get('display_name_english', DEFAULT_APP_DISPLAY_NAME_EN)

    def _generate_random_package_id(self) -> str:
        """Generate a random package ID"""
        domains = ['com', 'org', 'net']
        companies = ['tech', 'app', 'soft', 'dev', 'digital', 'systems', 'solutions', 'labs']
        apps = ['mobile', 'app', 'client', 'tool', 'suite', 'platform', 'service']

        domain = random.choice(domains)
        company = random.choice(companies) + ''.join(random.choices(string.ascii_lowercase + string.digits, k=2))
        app_name = random.choice(apps) + ''.join(random.choices(string.ascii_lowercase + string.digits, k=2))

        return f"{domain}.{company}.{app_name}"

    def _generate_random_chinese_name(self) -> str:
        """Generate a random Chinese display name with special characters"""
        prefixes = ['智能', '移动', '数字', '云端', '现代', '创新', '专业', '高效']
        suffixes = ['应用', '工具', '平台', '系统', '服务', '助手', '管家', '专家']
        special_chars = ['★', '◆', '◇', '●', '◉', '▲', '▼', '■', '□', '♦', '♠', '♣', '♥']

        prefix = random.choice(prefixes)
        suffix = random.choice(suffixes)
        special = random.choice(special_chars)

        return f"{special}{prefix}{suffix}"

    def _generate_random_english_name(self) -> str:
        """Generate a random English display name with special characters"""
        prefixes = ['Smart', 'Mobile', 'Digital', 'Cloud', 'Modern', 'Pro', 'Elite', 'Prime']
        suffixes = ['App', 'Tool', 'Suite', 'Hub', 'Center', 'Studio', 'Lab', 'Zone']
        special_chars = ['★', '◆', '◇', '●', '◉', '▲', '▼', '■', '□', '♦', '♠', '♣', '♥']

        prefix = random.choice(prefixes)
        suffix = random.choice(suffixes)
        special = random.choice(special_chars)

        return f"{special} {prefix} {suffix}"

    def get_package_id(self) -> str:
        """Get the final package ID to use"""
        return self.config_data.get('package_settings', {}).get('generated_package_id', DEFAULT_PACKAGE_ID)

    def get_display_name_chinese(self) -> str:
        """Get the final Chinese display name to use"""
        return self.config_data.get('app_info', {}).get('generated_display_name_chinese', DEFAULT_APP_DISPLAY_NAME_CN)

    def get_display_name_english(self) -> str:
        """Get the final English display name to use"""
        return self.config_data.get('app_info', {}).get('generated_display_name_english', DEFAULT_APP_DISPLAY_NAME_EN)

    def print_config_summary(self):
        """Print a summary of the loaded configuration"""
        try:
            print(f"\n[CONFIG] Configuration Summary for {self.app_name}:")
            print(f"[CONFIG] {'='*50}")

            app_info = self.config_data.get('app_info', {})
            package_settings = self.config_data.get('package_settings', {})

            print(f"[CONFIG] App Name: {app_info.get('app_name', 'N/A')}")
            print(f"[CONFIG] Package ID: {self.get_package_id()}")

            # Handle potential encoding issues with display names
            try:
                cn_name = self.get_display_name_chinese()
                print(f"[CONFIG] Display Name (CN): {cn_name}")
            except UnicodeEncodeError:
                print(f"[CONFIG] Display Name (CN): [Contains special characters]")

            try:
                en_name = self.get_display_name_english()
                print(f"[CONFIG] Display Name (EN): {en_name}")
            except UnicodeEncodeError:
                print(f"[CONFIG] Display Name (EN): [Contains special characters]")

            print(f"[CONFIG] Description: {app_info.get('description', 'N/A')}")
            print(f"[CONFIG] Random Package ID: {package_settings.get('random_package_id', True)}")
            print(f"[CONFIG] Random Display Name: {package_settings.get('random_display_name', True)}")

            build_settings = self.config_data.get('build_settings', {})
            print(f"[CONFIG] Build Platforms: {build_settings.get('build_platforms', 'android')}")
            print(f"[CONFIG] External Resources: {build_settings.get('use_external_resources', True)}")
            print(f"[CONFIG] Optimize Images: {build_settings.get('optimize_images', True)}")
            print(f"[CONFIG] External Safe Build: {build_settings.get('use_external_safe_build', True)}")
            print(f"[CONFIG] ={'='*50}\n")
        except Exception as e:
            print(f"[CONFIG] Error printing summary: {e}")