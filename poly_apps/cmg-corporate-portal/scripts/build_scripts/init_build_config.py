#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Build Configuration Initializer
Initializes or reads build_config.ini for Capacitor projects
"""

import os
import sys
import configparser
import json
from pathlib import Path

# Fix Windows console encoding issues
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')


def generate_app_name(folder_name):
    """Generate app name from folder name"""
    # Remove special characters and convert to lowercase
    clean_name = folder_name.replace('-', '_').replace(' ', '_').lower()
    return f"app_{clean_name}"


def generate_package_id(folder_name):
    """Generate package ID with com.dd. prefix"""
    # Remove special characters and convert to lowercase
    clean_name = folder_name.replace('-', '').replace('_', '').replace(' ', '').lower()
    return f"com.dd.{clean_name}"


def generate_display_name(folder_name):
    """Generate display name from folder name"""
    # Convert kebab-case to Title Case
    words = folder_name.replace('-', ' ').replace('_', ' ').split()
    return ' '.join(word.capitalize() for word in words)


def create_default_config(project_root, folder_name):
    """Create default build_config.ini file"""
    config = configparser.ConfigParser()

    # App Info Section
    config['app_info'] = {
        'app_name': generate_app_name(folder_name),
        'display_name_chinese': generate_display_name(folder_name),
        'display_name_english': generate_display_name(folder_name),
        'description': 'Application built with Capacitor',
        'app_logo_src': 'logo.png',
        'splash_src': 'splash.png'
    }

    # Package Settings Section
    config['package_settings'] = {
        'random_package_id': 'false',
        'default_package_id': generate_package_id(folder_name),
        'random_display_name': 'false'
    }

    # Build Settings Section
    config['build_settings'] = {
        'build_platforms': 'android',
        'use_external_resources': 'false',
        'optimize_images': 'true',
        'use_external_safe_build': 'false'
    }

    # Resources Section
    config['resources'] = {
        '# icon_file': 'icon.png (default)',
        '# splash_screen_file': 'splash.png (default)',
        '# Uncomment and modify to override defaults': ''
    }

    # External Resources Section
    config['external_resources'] = {
        '# external_resource_directory': 'D:\\programing\\.build_dir\\build_apps_static_resources\\{app_name}\\',
        '# icon/': 'Contains icon files',
        '# splash/': 'Contains splash screen files',
        '# assets/': 'Contains other static assets'
    }

    # Splash Config Section
    config['splash_config'] = {
        'background_image': '',
        'background_image_dark': '',
        'color_android': '#667eea',
        'color_dark_android': '#121212',
        'color_ios': '#667eea',
        'color_dark_ios': '#121212',
        'color_web': '#667eea',
        'color_dark_web': '#121212'
    }

    # Write to file
    config_path = os.path.join(project_root, 'build_config.ini')
    with open(config_path, 'w', encoding='utf-8') as configfile:
        # Add header comments
        configfile.write('# Build Configuration for Capacitor Project\n')
        configfile.write('# Auto-generated configuration file\n')
        configfile.write('# Modify values as needed\n\n')
        config.write(configfile)

    return config


def read_config(config_path):
    """Read existing build_config.ini file"""
    config = configparser.ConfigParser()
    config.read(config_path, encoding='utf-8')
    return config


def extract_config_info(config):
    """Extract important configuration information"""
    info = {}

    # Extract app info
    if 'app_info' in config:
        info['app_name'] = config.get('app_info', 'app_name', fallback='')
        info['display_name_chinese'] = config.get('app_info', 'display_name_chinese', fallback='')
        info['display_name_english'] = config.get('app_info', 'display_name_english', fallback='')
        info['description'] = config.get('app_info', 'description', fallback='')
        info['app_logo_src'] = config.get('app_info', 'app_logo_src', fallback='logo.png')
        info['splash_src'] = config.get('app_info', 'splash_src', fallback='splash.png')

    # Extract package settings
    if 'package_settings' in config:
        info['package_id'] = config.get('package_settings', 'default_package_id', fallback='')
        info['random_package_id'] = config.get('package_settings', 'random_package_id', fallback='false')

    # Extract build settings
    if 'build_settings' in config:
        info['build_platforms'] = config.get('build_settings', 'build_platforms', fallback='android')

    return info


def print_config_info(info, is_new=False):
    """Print configuration information in a formatted way"""
    print("\n" + "=" * 60)
    if is_new:
        print("BUILD CONFIG CREATED")
    else:
        print("BUILD CONFIG LOADED")
    print("=" * 60)

    print(f"\nApp Name:          {info.get('app_name', 'N/A')}")
    print(f"Display Name (CN): {info.get('display_name_chinese', 'N/A')}")
    print(f"Display Name (EN): {info.get('display_name_english', 'N/A')}")
    print(f"Package ID:        {info.get('package_id', 'N/A')}")
    print(f"Description:       {info.get('description', 'N/A')}")
    print(f"Build Platforms:   {info.get('build_platforms', 'N/A')}")
    print(f"App Logo Source:   {info.get('app_logo_src', 'logo.png')}")
    print(f"Splash Source:     {info.get('splash_src', 'splash.png')}")

    print("\n" + "=" * 60)


def output_json(info):
    """Output configuration as JSON for PowerShell to parse"""
    print("\n__JSON_OUTPUT_START__")
    print(json.dumps(info, ensure_ascii=False))
    print("__JSON_OUTPUT_END__")


def main():
    if len(sys.argv) < 2:
        print("Error: Project root path required", file=sys.stderr)
        sys.exit(1)

    project_root = sys.argv[1]

    # Get folder name
    folder_name = os.path.basename(project_root)

    # Check if build_config.ini exists
    config_path = os.path.join(project_root, 'build_config.ini')
    is_new = False

    if os.path.exists(config_path):
        print(f"[Python] Found existing build_config.ini")
        config = read_config(config_path)
    else:
        print(f"[Python] build_config.ini not found, creating new one...")
        config = create_default_config(project_root, folder_name)
        is_new = True
        print(f"[Python] Created build_config.ini at: {config_path}")

    # Extract and print information
    info = extract_config_info(config)
    print_config_info(info, is_new)

    # Output JSON for PowerShell
    output_json(info)


if __name__ == '__main__':
    main()
