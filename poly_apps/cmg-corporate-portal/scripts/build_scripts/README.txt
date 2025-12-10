# Build Scripts Directory

This directory contains prebuild scripts that are automatically executed during the build process.

## Scripts

### android_prebuild.py
Automatically processes Android resources before building:
- Reads build_config.ini from project root
- Processes app information (name, package ID, etc.)
- Automatically finds and replaces app icons from assets/logo/ directory
- Handles all mipmap densities (mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi)
- Creates rounded icons automatically

## Usage

These scripts are automatically invoked by start.ps1 during build/debug operations.

### Manual Execution
python android_prebuild.py <project_root_path>

Example:
python android_prebuild.py "D:/programing/core_node/poly_apps/react_init"

## Requirements

- Python 3.x
- Pillow (PIL) library: pip install Pillow

## Asset Structure

Place your logo in:
  ./assets/logo/logo.png  (preferred)

Or anywhere in:
  ./assets/  (will be found recursively)

## Configuration

Edit build_config.ini in the project root to customize:
- App name and display names
- Package ID
- Build platforms
- Image optimization settings
- And more...
