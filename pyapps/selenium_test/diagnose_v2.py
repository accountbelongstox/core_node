#!/usr/bin/env python3
"""
Enhanced Selenium Test Diagnostic Tool

Uses the browser_finder module to check for Edge and Chrome browsers/drivers.
"""

import sys
import os
import json
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore import ColorPrint
from pycore.pyutils.pybrowser.utils.browser_finder import (
    find_browser,
    find_driver,
    EdgeFinder,
    ChromeFinder,
    BROWSER_DRIVER_MAP
)


def check_browser_installation(browser_type='edge'):
    """Check browser installation using browser_finder"""
    ColorPrint.blue(f"\n=== Checking {browser_type.upper()} Installation ===")

    browser_path = find_browser(browser_type)
    if browser_path:
        ColorPrint.green(f"✓ Found {browser_type}: {browser_path}")
        return True
    else:
        ColorPrint.red(f"✗ {browser_type.upper()} not found")
        return False


def check_driver_installation(browser_type='edge'):
    """Check driver installation using browser_finder"""
    driver_info = BROWSER_DRIVER_MAP.get(browser_type)
    if not driver_info:
        ColorPrint.red(f"✗ Unknown browser type: {browser_type}")
        return None

    driver_name = driver_info['driver_name']
    ColorPrint.blue(f"\n=== Checking {driver_name} Installation ===")

    driver_path = find_driver(browser_type)
    if driver_path:
        ColorPrint.green(f"✓ Found driver: {driver_path}")
        return driver_path
    else:
        ColorPrint.yellow(f"✗ {driver_name} not found")
        return None


def check_config():
    """Check configuration files"""
    ColorPrint.blue("\n=== Checking Configuration ===")

    config_file = Path(__file__).parent / "config" / "launcher_config.json"

    if config_file.exists():
        with open(config_file, 'r', encoding='utf-8') as f:
            config = json.load(f)

        selenium_config = config.get('selenium_service', {})
        browser_type = selenium_config.get('browser_type', 'NOT SET')
        driver_mode = selenium_config.get('driver_mode', 'NOT SET')
        driver_path = selenium_config.get('driver_path', 'NOT SET')

        ColorPrint.blue(f"Config file: {config_file}")
        ColorPrint.blue(f"  browser_type: {browser_type}")
        ColorPrint.blue(f"  driver_mode: {driver_mode}")
        ColorPrint.blue(f"  driver_path: {driver_path}")

        # Check if driver_mode is optimal
        if driver_mode == 'auto':
            ColorPrint.green("  ✓ Using 'auto' mode (recommended)")
        elif driver_mode == 'local':
            if driver_path and driver_path != 'NOT SET':
                if os.path.exists(driver_path):
                    ColorPrint.green(f"  ✓ Driver file exists")
                else:
                    ColorPrint.red(f"  ✗ Driver file NOT found at: {driver_path}")
            else:
                ColorPrint.red(f"  ✗ driver_path not configured")
        elif driver_mode == 'auto_download':
            ColorPrint.yellow(f"  ⚠ auto_download mode requires internet")

        return browser_type
    else:
        ColorPrint.red(f"✗ Config file not found: {config_file}")
        return 'edge'  # default


def show_browser_finder_results():
    """Show detailed results from browser_finder"""
    ColorPrint.blue("\n=== Browser Finder Module Results ===")

    for browser_type in ['edge', 'chrome']:
        ColorPrint.blue(f"\n{browser_type.upper()}:")

        # Find browser
        browser_path = find_browser(browser_type)
        if browser_path:
            ColorPrint.green(f"  Browser: {browser_path}")
        else:
            ColorPrint.yellow(f"  Browser: Not found")

        # Find driver
        driver_path = find_driver(browser_type)
        if driver_path:
            ColorPrint.green(f"  Driver:  {driver_path}")
        else:
            ColorPrint.yellow(f"  Driver:  Not found")


def provide_solution(browser_type='edge'):
    """Provide specific solution steps"""
    driver_info = BROWSER_DRIVER_MAP.get(browser_type, BROWSER_DRIVER_MAP['edge'])
    driver_name = driver_info['driver_name']
    driver_exe = driver_info['driver_executable']

    ColorPrint.green("\n" + "=" * 70)
    ColorPrint.green(" SOLUTION")
    ColorPrint.green("=" * 70)

    ColorPrint.blue(f"\n推荐方案: 使用 'auto' 模式（自动检测）")
    ColorPrint.blue("-" * 70)
    ColorPrint.blue("1. 更新配置文件:")
    ColorPrint.blue("   文件: pyapps/selenium_test/config/launcher_config.json")
    ColorPrint.blue("")
    ColorPrint.blue('   {')
    ColorPrint.blue('     "selenium_service": {')
    ColorPrint.blue(f'       "browser_type": "{browser_type}",')
    ColorPrint.blue('       "driver_mode": "auto"')
    ColorPrint.blue('     }')
    ColorPrint.blue('   }')
    ColorPrint.blue("")
    ColorPrint.blue("2. 运行测试:")
    ColorPrint.blue("   python pymain.py app=selenium_test")
    ColorPrint.blue("")
    ColorPrint.blue("   'auto' 模式会自动:")
    ColorPrint.blue("   - 检测系统中的 Edge/Chrome 浏览器")
    ColorPrint.blue("   - 查找本地驱动文件")
    ColorPrint.blue("   - 如果需要，自动下载匹配的驱动")
    ColorPrint.blue("")

    ColorPrint.blue(f"\n备选方案 1: 手动下载 {driver_name}")
    ColorPrint.blue("-" * 70)
    if browser_type == 'edge':
        ColorPrint.blue("1. Edge 驱动下载:")
        ColorPrint.blue("   https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver/")
        ColorPrint.blue("")
        ColorPrint.blue("2. 放置驱动:")
        ColorPrint.blue(f"   D:\\drivers\\{driver_exe}")
    else:
        ColorPrint.blue("1. Chrome 驱动下载:")
        ColorPrint.blue("   国内镜像: https://registry.npmmirror.com/binary.html?path=chromedriver/")
        ColorPrint.blue("   官方: https://googlechromelabs.github.io/chrome-for-testing/")
        ColorPrint.blue("")
        ColorPrint.blue("2. 放置驱动:")
        ColorPrint.blue(f"   D:\\drivers\\{driver_exe}")

    ColorPrint.blue("")
    ColorPrint.blue("3. 更新配置:")
    ColorPrint.blue('   {')
    ColorPrint.blue('     "selenium_service": {')
    ColorPrint.blue(f'       "browser_type": "{browser_type}",')
    ColorPrint.blue('       "driver_mode": "local",')
    ColorPrint.blue(f'       "driver_path": "D:/drivers/{driver_exe}"')
    ColorPrint.blue('     }')
    ColorPrint.blue('   }')
    ColorPrint.blue("")

    ColorPrint.blue("\n备选方案 2: 添加到系统 PATH")
    ColorPrint.blue("-" * 70)
    ColorPrint.blue(f"1. 下载并放置 {driver_name} 到任意位置")
    ColorPrint.blue("2. 添加到系统 PATH 环境变量")
    ColorPrint.blue("3. 更新配置:")
    ColorPrint.blue('   {')
    ColorPrint.blue('     "selenium_service": {')
    ColorPrint.blue(f'       "browser_type": "{browser_type}",')
    ColorPrint.blue('       "driver_mode": "system_path"')
    ColorPrint.blue('     }')
    ColorPrint.blue('   }')
    ColorPrint.green("=" * 70 + "\n")


def main():
    """Main diagnostic function"""
    ColorPrint.green("\n" + "=" * 70)
    ColorPrint.green(" Enhanced Selenium Test - System Diagnostic")
    ColorPrint.green("=" * 70)

    # Check config first to know which browser to focus on
    browser_type = check_config()

    # Check browser installations
    edge_ok = check_browser_installation('edge')
    chrome_ok = check_browser_installation('chrome')

    # Check driver installations
    edge_driver = check_driver_installation('edge')
    chrome_driver = check_driver_installation('chrome')

    # Show browser_finder results
    show_browser_finder_results()

    # Summary
    ColorPrint.blue("\n=== Summary ===")

    if browser_type == 'edge':
        if edge_ok and edge_driver:
            ColorPrint.green("✓ Edge browser and driver found!")
            ColorPrint.green("  Recommendation: Set driver_mode='auto' in config")
            ColorPrint.green("  Run: python pymain.py app=selenium_test")
        elif edge_ok:
            ColorPrint.yellow("✓ Edge browser found, but driver missing")
            ColorPrint.yellow("  Action: Use 'auto' mode to download driver automatically")
            provide_solution('edge')
        else:
            ColorPrint.red("✗ Edge browser not found")
            if chrome_ok:
                ColorPrint.yellow("  Note: Chrome is available, consider switching browser_type='chrome'")
            provide_solution('edge')
    else:  # chrome
        if chrome_ok and chrome_driver:
            ColorPrint.green("✓ Chrome browser and driver found!")
            ColorPrint.green("  Recommendation: Set driver_mode='auto' in config")
            ColorPrint.green("  Run: python pymain.py app=selenium_test")
        elif chrome_ok:
            ColorPrint.yellow("✓ Chrome browser found, but driver missing")
            ColorPrint.yellow("  Action: Use 'auto' mode to download driver automatically")
            provide_solution('chrome')
        else:
            ColorPrint.red("✗ Chrome browser not found")
            if edge_ok:
                ColorPrint.yellow("  Note: Edge is available, consider switching browser_type='edge'")
            provide_solution('chrome')


if __name__ == '__main__':
    main()
