#!/usr/bin/env python3
"""
Selenium Test Diagnostic Tool

Checks system configuration and provides specific guidance.
"""

import sys
import os
import shutil
import subprocess
import platform
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore import ColorPrint


def check_chrome():
    """Check Chrome installation"""
    ColorPrint.blue("\n=== Checking Chrome Installation ===")

    if platform.system() == "Windows":
        chrome_paths = [
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        ]
        for path in chrome_paths:
            if os.path.exists(path):
                ColorPrint.green(f"✓ Found Chrome: {path}")
                # Get version
                result = subprocess.run([path, "--version"], capture_output=True, text=True)
                if result.returncode == 0:
                    ColorPrint.green(f"  Version: {result.stdout.strip()}")
                return True

    ColorPrint.red("✗ Chrome not found")
    return False


def check_chromedriver_in_path():
    """Check if chromedriver in PATH"""
    ColorPrint.blue("\n=== Checking ChromeDriver in PATH ===")

    driver = shutil.which('chromedriver')
    if driver:
        ColorPrint.green(f"✓ Found in PATH: {driver}")
        return driver
    else:
        ColorPrint.yellow("✗ ChromeDriver not in system PATH")
        return None


def check_chromedriver_local():
    """Check if chromedriver in D:/drivers"""
    ColorPrint.blue("\n=== Checking Local Driver ===")

    if platform.system() == "Windows":
        driver_path = Path("D:/drivers/chromedriver.exe")
    else:
        driver_path = Path("/usr/local/bin/chromedriver")

    if driver_path.exists():
        ColorPrint.green(f"✓ Found local driver: {driver_path}")
        return str(driver_path)
    else:
        ColorPrint.yellow(f"✗ No driver at: {driver_path}")
        return None


def check_webdriver_manager_cache():
    """Check webdriver_manager cache"""
    ColorPrint.blue("\n=== Checking webdriver_manager Cache ===")

    if platform.system() == "Windows":
        cache_dir = Path(os.environ.get('USERPROFILE', '')) / '.wdm' / 'drivers' / 'chromedriver'
    else:
        cache_dir = Path.home() / '.wdm' / 'drivers' / 'chromedriver'

    if cache_dir.exists():
        drivers = list(cache_dir.rglob('chromedriver*'))
        if drivers:
            ColorPrint.green(f"✓ Found {len(drivers)} cached driver(s):")
            for d in drivers[:3]:  # Show first 3
                ColorPrint.green(f"  - {d}")
            return drivers[0]
        else:
            ColorPrint.yellow(f"✗ Cache directory exists but no drivers found")
    else:
        ColorPrint.yellow(f"✗ No cache directory: {cache_dir}")

    return None


def check_config():
    """Check configuration files"""
    ColorPrint.blue("\n=== Checking Configuration ===")

    import json

    config_file = Path(__file__).parent / "config" / "launcher_config.json"

    if config_file.exists():
        with open(config_file, 'r', encoding='utf-8') as f:
            config = json.load(f)

        selenium_config = config.get('selenium_service', {})
        driver_mode = selenium_config.get('driver_mode', 'NOT SET')
        driver_path = selenium_config.get('driver_path', 'NOT SET')

        ColorPrint.blue(f"Config file: {config_file}")
        ColorPrint.blue(f"  driver_mode: {driver_mode}")
        ColorPrint.blue(f"  driver_path: {driver_path}")

        if driver_mode == 'local':
            if driver_path and driver_path != 'NOT SET':
                if os.path.exists(driver_path):
                    ColorPrint.green(f"  ✓ Driver file exists")
                else:
                    ColorPrint.red(f"  ✗ Driver file NOT found at: {driver_path}")
            else:
                ColorPrint.red(f"  ✗ driver_path not configured")
        elif driver_mode == 'auto_download':
            ColorPrint.yellow(f"  ⚠ auto_download mode requires internet")
    else:
        ColorPrint.red(f"✗ Config file not found: {config_file}")


def provide_solution():
    """Provide specific solution steps"""
    ColorPrint.green("\n" + "=" * 70)
    ColorPrint.green(" SOLUTION")
    ColorPrint.green("=" * 70)

    ColorPrint.blue("\n选项 1: 手动下载 ChromeDriver（推荐，离线可用）")
    ColorPrint.blue("-" * 70)
    ColorPrint.blue("1. 查看 Chrome 版本:")
    ColorPrint.blue("   - 打开 Chrome 浏览器")
    ColorPrint.blue("   - 地址栏输入: chrome://version")
    ColorPrint.blue("   - 记录版本号（如: 131.0.6778.86）")
    ColorPrint.blue("")
    ColorPrint.blue("2. 下载匹配的 ChromeDriver:")
    ColorPrint.blue("   国内镜像(推荐):")
    ColorPrint.blue("   https://registry.npmmirror.com/binary.html?path=chromedriver/")
    ColorPrint.blue("")
    ColorPrint.blue("   官方地址:")
    ColorPrint.blue("   https://googlechromelabs.github.io/chrome-for-testing/")
    ColorPrint.blue("")
    ColorPrint.blue("3. 放置驱动文件:")
    if platform.system() == "Windows":
        ColorPrint.blue("   PowerShell 命令:")
        ColorPrint.blue("   New-Item -ItemType Directory -Path 'D:\\drivers' -Force")
        ColorPrint.blue("   Copy-Item '下载路径\\chromedriver.exe' 'D:\\drivers\\chromedriver.exe'")
    else:
        ColorPrint.blue("   终端命令:")
        ColorPrint.blue("   sudo cp ~/Downloads/chromedriver /usr/local/bin/chromedriver")
        ColorPrint.blue("   sudo chmod +x /usr/local/bin/chromedriver")
    ColorPrint.blue("")
    ColorPrint.blue("4. 验证配置:")
    ColorPrint.blue("   python pyapps/selenium_test/diagnose.py")
    ColorPrint.blue("")

    ColorPrint.blue("\n选项 2: 自动下载（需要网络）")
    ColorPrint.blue("-" * 70)
    ColorPrint.blue("python pyapps/selenium_test/setup_driver.py")
    ColorPrint.blue("")

    ColorPrint.blue("\n详细指南:")
    ColorPrint.blue("-" * 70)
    ColorPrint.blue("查看文件: pyapps/selenium_test/DOWNLOAD_DRIVER_GUIDE.md")
    ColorPrint.green("=" * 70 + "\n")


def main():
    """Main diagnostic function"""
    ColorPrint.green("\n" + "=" * 70)
    ColorPrint.green(" Selenium Test - System Diagnostic")
    ColorPrint.green("=" * 70)

    # Run all checks
    chrome_ok = check_chrome()
    driver_in_path = check_chromedriver_in_path()
    driver_local = check_chromedriver_local()
    driver_cache = check_webdriver_manager_cache()
    check_config()

    # Summary
    ColorPrint.blue("\n=== Summary ===")

    if driver_local or driver_in_path:
        ColorPrint.green("✓ ChromeDriver found!")
        ColorPrint.green("  Next step: Update config to use local driver")
        ColorPrint.green("  Run: python pymain.py app=selenium_test")
    else:
        ColorPrint.yellow("✗ ChromeDriver not found")
        ColorPrint.yellow("  Action required: Download and install ChromeDriver")
        provide_solution()


if __name__ == '__main__':
    main()
