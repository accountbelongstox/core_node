#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Session Cookies Example

Demonstrates the new session/persistent cookie separation features in pybrowser v2.1.0+
"""

from pycore.pyutils.pybrowser import BrowserFactory
from pycore import ColorPrint
import time


def example_1_default_behavior():
    """
    Example 1: Default Behavior - Save session, but don't load

    This is the RECOMMENDED and most secure approach.
    """
    ColorPrint.green("\n" + "=" * 70)
    ColorPrint.green("Example 1: Default Behavior (Recommended)")
    ColorPrint.green("=" * 70 + "\n")

    # Default configuration
    browser = BrowserFactory.create('chrome', config={
        'headless': False,
        'cookie_config': {
            'load_strategy': 'default',
            'include_session_cookies': False,  # Don't load session cookies (default)
            'save_session_cookies': True       # But save them for analysis (default)
        }
    })

    browser.start()
    browser.wait_until_ready()

    ColorPrint.blue("Navigating to example.com...")
    browser.navigate('https://www.example.com')
    time.sleep(2)

    # Get current cookies
    cookies = browser.get_cookies()
    session_count = sum(1 for c in cookies if 'expiry' not in c)
    persistent_count = len(cookies) - session_count

    ColorPrint.blue(
        f"Current cookies: {len(cookies)} total "
        f"({persistent_count} persistent, {session_count} session)"
    )

    # On close:
    # - All cookies (including session) will be saved to disk
    # - But session cookies won't be loaded on next startup
    ColorPrint.yellow("Closing browser... Cookies will be saved (including session)")
    browser.stop()
    browser.join()

    ColorPrint.green("\n[OK] Next startup will only load persistent cookies")


def example_2_include_session():
    """
    Example 2: Include Session Cookies - For automation/testing

    [WARN] Use only in controlled environments (automation, testing)
    """
    ColorPrint.green("\n" + "=" * 70)
    ColorPrint.green("Example 2: Include Session Cookies (Testing/Automation)")
    ColorPrint.green("=" * 70 + "\n")

    browser = BrowserFactory.create('chrome', config={
        'headless': False,
        'cookie_config': {
            'load_strategy': 'default',
            'include_session_cookies': True,  # <-  Load session cookies
            'save_session_cookies': True,
            'realtime_save': True  # Keep session fresh
        }
    })

    browser.start()
    browser.wait_until_ready()

    ColorPrint.blue("This browser will load session cookies from previous run")
    ColorPrint.yellow("[WARN] Note: Session may be invalid if server-side session expired")

    browser.navigate('https://www.example.com')
    time.sleep(2)

    browser.stop()
    browser.join()

    ColorPrint.green("\n[OK] Session cookies preserved across restarts")


def example_3_no_session_save():
    """
    Example 3: Don't Save Session Cookies - Maximum security

    Most strict mode: session cookies never touch disk
    """
    ColorPrint.green("\n" + "=" * 70)
    ColorPrint.green("Example 3: Don't Save Session Cookies (Maximum Security)")
    ColorPrint.green("=" * 70 + "\n")

    browser = BrowserFactory.create('chrome', config={
        'headless': False,
        'cookie_config': {
            'include_session_cookies': False,  # Don't load
            'save_session_cookies': False      # <-  Don't save either
        }
    })

    browser.start()
    browser.wait_until_ready()

    ColorPrint.blue("Session cookies will never be persisted to disk")
    ColorPrint.blue("Only persistent cookies will be saved")

    browser.navigate('https://www.example.com')
    time.sleep(2)

    browser.stop()
    browser.join()

    ColorPrint.green("\n[OK] Maximum security: session cookies never stored")


def example_4_manual_control():
    """
    Example 4: Manual Control - Override defaults per operation
    """
    ColorPrint.green("\n" + "=" * 70)
    ColorPrint.green("Example 4: Manual Control")
    ColorPrint.green("=" * 70 + "\n")

    browser = BrowserFactory.create('chrome', config={
        'headless': False,
        'cookie_config': {
            'enabled': True
        }
    })

    browser.start()
    browser.wait_until_ready()

    browser.navigate('https://www.example.com')
    time.sleep(2)

    # Save with different settings
    ColorPrint.blue("Saving cookies WITH session...")
    browser.save_cookies_manual('with_session', save_session=True)

    ColorPrint.blue("Saving cookies WITHOUT session...")
    browser.save_cookies_manual('without_session', save_session=False)

    # Load with different settings
    ColorPrint.blue("\nLoading cookies WITHOUT session (safe)...")
    browser.load_cookies_manual('with_session', include_session=False)

    ColorPrint.blue("Loading cookies WITH session (risky)...")
    browser.load_cookies_manual('with_session', include_session=True)

    browser.stop()
    browser.join()

    ColorPrint.green("\n[OK] Manual control allows per-operation flexibility")


def example_5_inspect_cookies():
    """
    Example 5: Inspect Cookie Types

    Analyze what types of cookies a website uses
    """
    ColorPrint.green("\n" + "=" * 70)
    ColorPrint.green("Example 5: Inspect Cookie Types")
    ColorPrint.green("=" * 70 + "\n")

    browser = BrowserFactory.create('chrome', config={
        'headless': False,
        'cookie_config': {
            'save_session_cookies': True  # Save for inspection
        }
    })

    browser.start()
    browser.wait_until_ready()

    browser.navigate('https://www.example.com')
    time.sleep(2)

    # Get and analyze cookies
    cookies = browser.get_cookies()

    session_cookies = []
    persistent_cookies = []

    for cookie in cookies:
        if 'expiry' in cookie:
            persistent_cookies.append(cookie)
            ColorPrint.green(
                f"[Persistent] {cookie['name']}: "
                f"expires at {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(cookie['expiry']))}"
            )
        else:
            session_cookies.append(cookie)
            ColorPrint.yellow(f"[Session] {cookie['name']}: no expiry (browser session only)")

    ColorPrint.blue(
        f"\n[STATS] Summary: {len(cookies)} total "
        f"({len(persistent_cookies)} persistent, {len(session_cookies)} session)"
    )

    # Save and inspect file
    profile_name = browser.save_cookies_manual('inspection_demo')

    ColorPrint.blue(f"\n[OK] Cookies saved to: {profile_name}")
    ColorPrint.blue(f"Check file: D:/www/pycore_db/cookies/{profile_name}.json")

    browser.stop()
    browser.join()


def example_6_multi_profile_session_handling():
    """
    Example 6: Multi-Profile with Different Session Handling

    Different profiles can have different session cookie policies
    """
    ColorPrint.green("\n" + "=" * 70)
    ColorPrint.green("Example 6: Multi-Profile Session Handling")
    ColorPrint.green("=" * 70 + "\n")

    # Profile 1: Production (no session)
    ColorPrint.blue("Creating production profile (no session cookies)...")
    browser1 = BrowserFactory.create('chrome', config={
        'headless': True,
        'cookie_config': {
            'load_strategy': 'specified',
            'load_profile': 'production',
            'save_strategy': 'specified',
            'save_profile': 'production',
            'include_session_cookies': False,  # Production: no session
            'save_session_cookies': False
        }
    }, thread_name='Browser-Production')

    browser1.start()
    browser1.wait_until_ready()
    browser1.navigate('https://www.example.com')
    time.sleep(1)
    browser1.stop()
    browser1.join()

    ColorPrint.green("[OK] Production profile: persistent cookies only")

    # Profile 2: Testing (with session)
    ColorPrint.blue("\nCreating testing profile (with session cookies)...")
    browser2 = BrowserFactory.create('chrome', config={
        'headless': True,
        'cookie_config': {
            'load_strategy': 'specified',
            'load_profile': 'testing',
            'save_strategy': 'specified',
            'save_profile': 'testing',
            'include_session_cookies': True,   # Testing: include session
            'save_session_cookies': True
        }
    }, thread_name='Browser-Testing')

    browser2.start()
    browser2.wait_until_ready()
    browser2.navigate('https://www.example.com')
    time.sleep(1)
    browser2.stop()
    browser2.join()

    ColorPrint.green("[OK] Testing profile: all cookies including session")

    ColorPrint.blue("\n[OK] Two profiles with different session cookie policies created")


def example_7_inspect_saved_format():
    """
    Example 7: Inspect Saved Cookie File Format

    See the new separated format
    """
    ColorPrint.green("\n" + "=" * 70)
    ColorPrint.green("Example 7: Inspect Saved Cookie File Format")
    ColorPrint.green("=" * 70 + "\n")

    import json
    from pathlib import Path

    browser = BrowserFactory.create('chrome', config={'headless': True})
    browser.start()
    browser.wait_until_ready()
    browser.navigate('https://www.example.com')
    time.sleep(1)

    # Save cookies
    profile_name = browser.save_cookies_manual('format_demo')
    browser.stop()
    browser.join()

    # Inspect file
    cookie_path = Path('D:/www/pycore_db/cookies') / f'{profile_name}.json'

    if cookie_path.exists():
        with open(cookie_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        if 'persistent_cookies' in data:
            ColorPrint.green("[OK] New format detected!")
            ColorPrint.blue(f"  - Persistent cookies: {data.get('persistent_count', 0)}")
            ColorPrint.blue(f"  - Session cookies: {data.get('session_count', 0)}")
            ColorPrint.blue(f"  - Session saved: {data.get('session_saved', False)}")
            ColorPrint.blue(f"  - Total count: {data.get('total_count', 0)}")
            ColorPrint.blue(f"  - Saved at: {data.get('saved_at', 'unknown')}")

            # Show sample cookies
            if data['persistent_cookies']:
                ColorPrint.yellow("\nSample persistent cookie:")
                print(json.dumps(data['persistent_cookies'][0], indent=2))

            if data['session_cookies']:
                ColorPrint.yellow("\nSample session cookie:")
                print(json.dumps(data['session_cookies'][0], indent=2))
        else:
            ColorPrint.yellow("[WARN] Legacy format detected")
            ColorPrint.blue(f"  - Total cookies: {data.get('count', 0)}")
    else:
        ColorPrint.red(f"[ERROR] File not found: {cookie_path}")


def main():
    """Run all examples"""
    ColorPrint.green("\n" + "=" * 80)
    ColorPrint.green(" Session Cookies Examples - pybrowser v2.1.0+")
    ColorPrint.green("=" * 80)

    examples = [
        ("Default Behavior (Recommended)", example_1_default_behavior),
        ("Include Session Cookies", example_2_include_session),
        ("Don't Save Session Cookies", example_3_no_session_save),
        ("Manual Control", example_4_manual_control),
        ("Inspect Cookie Types", example_5_inspect_cookies),
        ("Multi-Profile Session Handling", example_6_multi_profile_session_handling),
        ("Inspect Saved Format", example_7_inspect_saved_format),
    ]

    print("\nAvailable examples:")
    for i, (name, _) in enumerate(examples, 1):
        print(f"  {i}. {name}")

    print("\nPress Enter to run all, or enter a number (1-7) to run specific example:")
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

    ColorPrint.green("\n" + "=" * 80)
    ColorPrint.green(" Examples Completed")
    ColorPrint.green("=" * 80 + "\n")


if __name__ == '__main__':
    main()
