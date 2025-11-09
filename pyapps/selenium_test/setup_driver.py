#!/usr/bin/env python3
"""
ChromeDriver Setup Helper

Helps download and configure ChromeDriver for offline usage.
Detects Chrome version and downloads matching driver.

Usage:
    python setup_driver.py
    python setup_driver.py --driver-dir D:/custom/path
    python setup_driver.py --check-only
"""

import sys
import os
import json
import subprocess
import platform
import shutil
import zipfile
from pathlib import Path
from typing import Optional, Tuple

PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore import ColorPrint


class ChromeDriverSetup:
    """ChromeDriver setup and configuration helper"""

    def __init__(self, driver_dir: str = None):
        """
        Initialize setup helper

        Args:
            driver_dir: Target directory for driver (default: D:/drivers or /usr/local/bin)
        """
        self.app_dir = Path(__file__).parent
        self.config_dir = self.app_dir / "config"

        # Default driver directory based on OS
        if driver_dir:
            self.driver_dir = Path(driver_dir)
        else:
            if platform.system() == "Windows":
                self.driver_dir = Path("D:/drivers")
            else:
                self.driver_dir = Path("/usr/local/bin")

        self.chrome_version = None
        self.driver_path = None

    def detect_chrome_version(self) -> Optional[str]:
        """
        Detect installed Chrome version

        Returns:
            Chrome version string or None if not found
        """
        ColorPrint.blue("Detecting Chrome version...")

        system = platform.system()

        if system == "Windows":
            # Try Chrome stable path
            chrome_paths = [
                r"C:\Program Files\Google\Chrome\Application\chrome.exe",
                r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
            ]

            for chrome_path in chrome_paths:
                if os.path.exists(chrome_path):
                    # Get version from file
                    result = subprocess.run(
                        [chrome_path, "--version"],
                        capture_output=True,
                        text=True
                    )
                    if result.returncode == 0:
                        version = result.stdout.strip().split()[-1]
                        self.chrome_version = version
                        ColorPrint.green(f"Found Chrome version: {version}")
                        return version

        elif system == "Linux":
            # Try google-chrome command
            result = subprocess.run(
                ["google-chrome", "--version"],
                capture_output=True,
                text=True
            )
            if result.returncode == 0:
                version = result.stdout.strip().split()[-1]
                self.chrome_version = version
                ColorPrint.green(f"Found Chrome version: {version}")
                return version

        elif system == "Darwin":  # macOS
            # Try Chrome app bundle
            chrome_path = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
            if os.path.exists(chrome_path):
                result = subprocess.run(
                    [chrome_path, "--version"],
                    capture_output=True,
                    text=True
                )
                if result.returncode == 0:
                    version = result.stdout.strip().split()[-1]
                    self.chrome_version = version
                    ColorPrint.green(f"Found Chrome version: {version}")
                    return version

        ColorPrint.yellow("Could not detect Chrome version automatically")
        return None

    def check_existing_driver(self) -> Optional[str]:
        """
        Check if ChromeDriver already exists

        Returns:
            Path to existing driver or None
        """
        ColorPrint.blue(f"Checking for existing driver in: {self.driver_dir}")

        driver_name = "chromedriver.exe" if platform.system() == "Windows" else "chromedriver"
        driver_path = self.driver_dir / driver_name

        if driver_path.exists():
            ColorPrint.green(f"Found existing driver: {driver_path}")

            # Check if executable
            if os.access(driver_path, os.X_OK):
                ColorPrint.green("Driver is executable")
            else:
                ColorPrint.yellow("Driver exists but is not executable")

            self.driver_path = str(driver_path)
            return str(driver_path)

        ColorPrint.yellow("No existing driver found")
        return None

    def download_driver(self) -> bool:
        """
        Download ChromeDriver using webdriver_manager

        Returns:
            True if successful, False otherwise
        """
        ColorPrint.blue("\nAttempting to download ChromeDriver...")

        # Check webdriver_manager availability
        from webdriver_manager.chrome import ChromeDriverManager

        # Create driver directory
        self.driver_dir.mkdir(parents=True, exist_ok=True)
        ColorPrint.green(f"Created driver directory: {self.driver_dir}")

        # Download driver
        ColorPrint.blue("Downloading ChromeDriver (this may take a moment)...")
        downloaded_path = ChromeDriverManager().install()

        if downloaded_path:
            ColorPrint.green(f"Downloaded driver to: {downloaded_path}")

            # Copy to target directory
            driver_name = "chromedriver.exe" if platform.system() == "Windows" else "chromedriver"
            target_path = self.driver_dir / driver_name

            shutil.copy2(downloaded_path, target_path)
            ColorPrint.green(f"Copied driver to: {target_path}")

            # Make executable on Linux/Mac
            if platform.system() != "Windows":
                os.chmod(target_path, 0o755)
                ColorPrint.green("Set driver as executable")

            self.driver_path = str(target_path)
            return True

        ColorPrint.red("Failed to download ChromeDriver")
        return False

    def update_configs(self):
        """Update configuration files with driver path"""
        ColorPrint.blue("\nUpdating configuration files...")

        if not self.driver_path:
            ColorPrint.yellow("No driver path to update")
            return

        # Update launcher_config.json
        launcher_config_path = self.config_dir / "launcher_config.json"
        if launcher_config_path.exists():
            with open(launcher_config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)

            if 'selenium_service' in config:
                config['selenium_service']['driver_mode'] = 'local'
                config['selenium_service']['driver_path'] = self.driver_path

                with open(launcher_config_path, 'w', encoding='utf-8') as f:
                    json.dump(config, f, indent=2, ensure_ascii=False)

                ColorPrint.green(f"Updated: {launcher_config_path.name}")

        # Update multi_browser_config.json
        multi_config_path = self.config_dir / "multi_browser_config.json"
        if multi_config_path.exists():
            with open(multi_config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)

            # Update driver_paths
            if 'driver_paths' in config:
                config['driver_paths']['chrome'] = self.driver_path

            # Update browser configs
            if 'browsers' in config:
                for browser in config['browsers']:
                    if browser.get('type') == 'chrome' and 'config' in browser:
                        browser['config']['driver_mode'] = 'local'
                        browser['config']['driver_path'] = self.driver_path

            with open(multi_config_path, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)

            ColorPrint.green(f"Updated: {multi_config_path.name}")

    def print_summary(self):
        """Print setup summary"""
        ColorPrint.green("\n" + "=" * 70)
        ColorPrint.green(" ChromeDriver Setup Summary")
        ColorPrint.green("=" * 70)

        if self.chrome_version:
            ColorPrint.blue(f"Chrome Version: {self.chrome_version}")

        if self.driver_path:
            ColorPrint.blue(f"Driver Path: {self.driver_path}")
            ColorPrint.blue(f"Driver Exists: {os.path.exists(self.driver_path)}")

            if os.path.exists(self.driver_path):
                ColorPrint.blue(f"Driver Executable: {os.access(self.driver_path, os.X_OK)}")

        ColorPrint.green("\nNext Steps:")
        ColorPrint.blue("1. Verify driver path in config files:")
        ColorPrint.blue(f"   - {self.config_dir / 'launcher_config.json'}")
        ColorPrint.blue(f"   - {self.config_dir / 'multi_browser_config.json'}")
        ColorPrint.blue("\n2. Run tests:")
        ColorPrint.blue("   - Single browser: python pymain.py app=selenium_test")
        ColorPrint.blue("   - Multi browser:  python test_multi_browser.py")
        ColorPrint.green("=" * 70 + "\n")

    def run(self, check_only: bool = False):
        """
        Run setup process

        Args:
            check_only: Only check status, don't download
        """
        ColorPrint.green("\n" + "=" * 70)
        ColorPrint.green(" ChromeDriver Setup Helper")
        ColorPrint.green("=" * 70 + "\n")

        # Detect Chrome version
        self.detect_chrome_version()

        # Check existing driver
        existing_driver = self.check_existing_driver()

        if existing_driver:
            ColorPrint.green("\nDriver is ready to use!")

            if not check_only:
                # Update configs with existing driver
                self.driver_path = existing_driver
                self.update_configs()

        elif check_only:
            ColorPrint.yellow("\nNo driver found. Run without --check-only to download.")

        else:
            # Ask user if they want to download
            ColorPrint.yellow("\nNo existing driver found.")
            ColorPrint.blue(f"Download ChromeDriver to: {self.driver_dir}? (y/n): ")

            # For automation, auto-confirm
            response = input().strip().lower()

            if response == 'y' or response == 'yes':
                if self.download_driver():
                    self.update_configs()
                    ColorPrint.green("\nSetup completed successfully!")
                else:
                    ColorPrint.red("\nSetup failed. Please download manually.")
            else:
                ColorPrint.yellow("\nSetup cancelled. Please download driver manually.")
                ColorPrint.blue(f"Download from: https://chromedriver.chromium.org/downloads")
                ColorPrint.blue(f"Place driver in: {self.driver_dir}")

        # Print summary
        self.print_summary()


def main():
    """Main function"""
    import argparse

    parser = argparse.ArgumentParser(description="ChromeDriver Setup Helper")
    parser.add_argument(
        '--driver-dir',
        type=str,
        help='Custom driver directory (default: D:/drivers on Windows, /usr/local/bin on Linux/Mac)'
    )
    parser.add_argument(
        '--check-only',
        action='store_true',
        help='Only check status, do not download'
    )

    args = parser.parse_args()

    setup = ChromeDriverSetup(driver_dir=args.driver_dir)
    setup.run(check_only=args.check_only)


if __name__ == '__main__':
    main()
