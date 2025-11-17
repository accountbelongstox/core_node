#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cookie Persistence Example

Demonstrates the new cookie persistence features in pybrowser.
"""

from pycore.pyutils.pybrowser import BrowserFactory
from pycore import ColorPrint
import time


def example_1_basic_usage():
    """
    Example 1: Basic Cookie Persistence (Zero Config)

    Cookies are automatically loaded and saved using the 'default' profile.
    """
    ColorPrint.green("\n" + "=" * 60)
    ColorPrint.green("Example 1: Basic Cookie Persistence")
    ColorPrint.green("=" * 60 + "\n")

    # Create browser (cookie persistence enabled by default)
    browser = BrowserFactory.create('chrome', config={
        'headless': False
    })

    browser.start()
    browser.wait_until_ready()

    ColorPrint.blue("Browser started. Cookies will be loaded from 'default' profile.")

    # Navigate to a website
    browser.navigate('https://www.example.com')
    time.sleep(2)

    # Get current cookies
    cookies = browser.get_cookies()
    ColorPrint.blue(f"Current cookies: {len(cookies)} cookie(s)")

    # Cookies will be automatically saved when browser closes
    ColorPrint.yellow("Closing browser... Cookies will be saved automatically.")
    browser.stop()
    browser.join()

    ColorPrint.green("\n[OK] Cookies saved to 'default' profile")


def example_2_load_latest():
    """
    Example 2: Load Latest Cookie Profile

    Loads the most recently updated cookie profile.
    """
    ColorPrint.green("\n" + "=" * 60)
    ColorPrint.green("Example 2: Load Latest Cookies")
    ColorPrint.green("=" * 60 + "\n")

    browser = BrowserFactory.create('chrome', config={
        'headless': False,
        'cookie_config': {
            'load_strategy': 'latest',  # Load most recent profile
            'auto_save': True
        }
    })

    browser.start()
    browser.wait_until_ready()

    # List available profiles
    profiles = browser.list_cookie_profiles()
    ColorPrint.blue(f"Available cookie profiles: {profiles}")

    browser.navigate('https://www.example.com')
    time.sleep(2)

    browser.stop()
    browser.join()

    ColorPrint.green("\n[OK] Example completed")


def example_3_multiple_sessions():
    """
    Example 3: Multiple Cookie Sessions (Profiles)

    Demonstrates managing multiple cookie sessions for different accounts.
    """
    ColorPrint.green("\n" + "=" * 60)
    ColorPrint.green("Example 3: Multiple Cookie Sessions")
    ColorPrint.green("=" * 60 + "\n")

    # Session 1: Account A
    ColorPrint.blue("Creating session for Account A...")
    browser_a = BrowserFactory.create('chrome', config={
        'headless': False,
        'cookie_config': {
            'load_strategy': 'specified',
            'load_profile': 'account_a',
            'save_strategy': 'specified',
            'save_profile': 'account_a'
        }
    }, thread_name='Browser-AccountA')

    browser_a.start()
    browser_a.wait_until_ready()
    browser_a.navigate('https://www.example.com')
    time.sleep(2)

    ColorPrint.blue("Saving cookies for Account A...")
    browser_a.stop()
    browser_a.join()

    # Session 2: Account B
    ColorPrint.blue("\nCreating session for Account B...")
    browser_b = BrowserFactory.create('chrome', config={
        'headless': False,
        'cookie_config': {
            'load_strategy': 'specified',
            'load_profile': 'account_b',
            'save_strategy': 'specified',
            'save_profile': 'account_b'
        }
    }, thread_name='Browser-AccountB')

    browser_b.start()
    browser_b.wait_until_ready()
    browser_b.navigate('https://www.example.com')
    time.sleep(2)

    ColorPrint.blue("Saving cookies for Account B...")
    browser_b.stop()
    browser_b.join()

    ColorPrint.green("\n[OK] Two separate cookie sessions created: account_a, account_b")


def example_4_realtime_save():
    """
    Example 4: Real-time Cookie Saving

    Saves cookies after every navigation.
    """
    ColorPrint.green("\n" + "=" * 60)
    ColorPrint.green("Example 4: Real-time Cookie Saving")
    ColorPrint.green("=" * 60 + "\n")

    browser = BrowserFactory.create('chrome', config={
        'headless': False,
        'cookie_config': {
            'load_strategy': 'default',
            'save_strategy': 'default',
            'realtime_save': True  # Enable real-time saving
        }
    })

    browser.start()
    browser.wait_until_ready()

    # Each navigation will trigger cookie save
    ColorPrint.blue("Navigating to example.com (cookies will be saved)...")
    browser.navigate('https://www.example.com')
    time.sleep(2)

    ColorPrint.blue("Navigating to google.com (cookies will be saved again)...")
    browser.navigate('https://www.google.com')
    time.sleep(2)

    browser.stop()
    browser.join()

    ColorPrint.green("\n[OK] Cookies saved in real-time after each navigation")


def example_5_manual_control():
    """
    Example 5: Manual Cookie Control

    Manually save/load cookies at any time.
    """
    ColorPrint.green("\n" + "=" * 60)
    ColorPrint.green("Example 5: Manual Cookie Control")
    ColorPrint.green("=" * 60 + "\n")

    browser = BrowserFactory.create('chrome', config={
        'headless': False,
        'cookie_config': {
            'load_strategy': 'none',  # Don't load cookies on start
            'auto_save': False  # Don't auto-save on close
        }
    })

    browser.start()
    browser.wait_until_ready()

    browser.navigate('https://www.example.com')
    time.sleep(2)

    # Manually save cookies
    ColorPrint.blue("Manually saving cookies to 'my_session'...")
    profile_name = browser.save_cookies_manual('my_session')
    ColorPrint.green(f"[OK] Cookies saved to profile: {profile_name}")

    # Manually load cookies
    ColorPrint.blue("\nManually loading cookies from 'my_session'...")
    success = browser.load_cookies_manual('my_session')
    if success:
        ColorPrint.green("[OK] Cookies loaded successfully")

    # List all profiles
    profiles = browser.list_cookie_profiles()
    ColorPrint.blue(f"\nAll cookie profiles: {profiles}")

    browser.stop()
    browser.join()


def example_6_new_session():
    """
    Example 6: Create New Session with Timestamp

    Creates a new cookie profile with timestamp for each run.
    """
    ColorPrint.green("\n" + "=" * 60)
    ColorPrint.green("Example 6: Create New Session")
    ColorPrint.green("=" * 60 + "\n")

    browser = BrowserFactory.create('chrome', config={
        'headless': False,
        'cookie_config': {
            'load_strategy': 'none',  # Start fresh
            'save_strategy': 'new',  # Create new profile with timestamp
            'auto_save': True
        }
    })

    browser.start()
    browser.wait_until_ready()

    browser.navigate('https://www.example.com')
    time.sleep(2)

    # The profile will be named like: session_20250117_143022
    ColorPrint.blue("New session profile will be created automatically on close")

    browser.stop()
    browser.join()

    # Show all profiles
    browser2 = BrowserFactory.create('chrome', config={'headless': True})
    browser2.start()
    browser2.wait_until_ready()

    profiles = browser2.list_cookie_profiles()
    ColorPrint.green(f"\n[OK] New session created. All profiles: {profiles}")

    browser2.stop()
    browser2.join()


def example_7_profile_management():
    """
    Example 7: Cookie Profile Management

    Demonstrates profile listing, info, and cleanup.
    """
    ColorPrint.green("\n" + "=" * 60)
    ColorPrint.green("Example 7: Cookie Profile Management")
    ColorPrint.green("=" * 60 + "\n")

    browser = BrowserFactory.create('chrome', config={'headless': True})
    browser.start()
    browser.wait_until_ready()

    if browser.cookie_manager:
        # List all profiles
        profiles = browser.list_cookie_profiles()
        ColorPrint.blue(f"All cookie profiles: {profiles}")

        # Get info for each profile
        for profile in profiles[:3]:  # Show first 3
            info = browser.cookie_manager.get_profile_info(profile)
            if info:
                ColorPrint.yellow(
                    f"\nProfile '{profile}':\n"
                    f"  - Cookies: {info.get('cookie_count', 0)}\n"
                    f"  - Created: {info.get('created_at', 'unknown')}\n"
                    f"  - Last Updated: {info.get('last_updated', 'unknown')}"
                )

        # Cleanup old profiles (keep 10 most recent)
        ColorPrint.blue("\nCleaning up old profiles (keeping 10 most recent)...")
        deleted = browser.cookie_manager.cleanup_old_profiles(keep_count=10)
        ColorPrint.green(f"[OK] Deleted {deleted} old profiles")

    browser.stop()
    browser.join()


def example_8_disable_persistence():
    """
    Example 8: Disable Cookie Persistence

    Demonstrates disabling the cookie persistence feature.
    """
    ColorPrint.green("\n" + "=" * 60)
    ColorPrint.green("Example 8: Disable Cookie Persistence")
    ColorPrint.green("=" * 60 + "\n")

    browser = BrowserFactory.create('chrome', config={
        'headless': False,
        'cookie_config': {
            'enabled': False  # Disable cookie persistence
        }
    })

    browser.start()
    browser.wait_until_ready()

    ColorPrint.blue("Cookie persistence is disabled")
    ColorPrint.blue("Cookies will NOT be loaded or saved automatically")

    browser.navigate('https://www.example.com')
    time.sleep(2)

    browser.stop()
    browser.join()

    ColorPrint.green("\n[OK] Browser ran without cookie persistence")


def main():
    """Run all examples"""
    ColorPrint.green("\n" + "=" * 70)
    ColorPrint.green(" Cookie Persistence Examples")
    ColorPrint.green("=" * 70)

    examples = [
        ("Basic Usage", example_1_basic_usage),
        ("Load Latest", example_2_load_latest),
        ("Multiple Sessions", example_3_multiple_sessions),
        ("Real-time Save", example_4_realtime_save),
        ("Manual Control", example_5_manual_control),
        ("New Session", example_6_new_session),
        ("Profile Management", example_7_profile_management),
        ("Disable Persistence", example_8_disable_persistence),
    ]

    print("\nAvailable examples:")
    for i, (name, _) in enumerate(examples, 1):
        print(f"  {i}. {name}")

    print("\nPress Enter to run all examples, or enter a number (1-8) to run specific example:")
    choice = input("> ").strip()

    if choice == "":
        # Run all examples
        for name, func in examples:
            func()
            time.sleep(2)
    elif choice.isdigit() and 1 <= int(choice) <= len(examples):
        # Run specific example
        name, func = examples[int(choice) - 1]
        func()
    else:
        ColorPrint.red("Invalid choice")

    ColorPrint.green("\n" + "=" * 70)
    ColorPrint.green(" Examples Completed")
    ColorPrint.green("=" * 70 + "\n")


if __name__ == '__main__':
    main()
