# PyBrowser - Thread Mode Usage Examples

**Date:** 2025-11-09
**Version:** 2.0 (Thread Mode)

---

## Overview

PyBrowser now uses native `threading.Thread` inheritance. Each browser instance IS a thread from initialization, providing:

- **Self-contained**: Thread management is internal
- **Simple API**: Just create and start
- **Thread-safe**: Built-in command queue pattern
- **Parallel**: Run multiple browsers simultaneously
- **Clean Lifecycle**: Automatic resource management

---

## Table of Contents

1. [Basic Usage](#basic-usage)
2. [Configuration](#configuration)
3. [Multiple Browsers](#multiple-browsers)
4. [Advanced Features](#advanced-features)
5. [Migration Guide](#migration-guide)

---

## Basic Usage

### Example 1: Simple Browser Launch

```python
from pycore.pyutils.pybrowser import BrowserFactory

# Create browser instance (thread not started yet)
browser = BrowserFactory.create(
    browser_type='chrome',
    config={'headless': False}
)

# Start browser thread (launches Chrome)
browser.start()

# Wait for browser to be ready
browser.wait_until_ready()

# Navigate to URL (thread-safe)
browser.navigate('https://google.com')

# Get page information
print(f"Current URL: {browser.get_current_url()}")
print(f"Page Title: {browser.get_title()}")

# Cleanup
browser.stop()
browser.join()  # Wait for thread to finish
```

### Example 2: Auto-Start Browser

```python
from pycore.pyutils.pybrowser import BrowserFactory

# Create and auto-start in one step
browser = BrowserFactory.create(
    browser_type='chrome',
    config={'headless': False},
    auto_start=True  # Automatically starts thread
)

# Wait for ready
browser.wait_until_ready()

# Use browser
browser.navigate('https://github.com')

# Cleanup
browser.stop()
browser.join()
```

---

## Configuration

### Example 3: Chrome with Custom Configuration

```python
from pycore.pyutils.pybrowser import BrowserFactory

config = {
    'headless': False,
    'args': [
        '--start-maximized',
        '--disable-extensions',
        '--incognito'
    ],
    'user_data_dir': 'D:/chrome_profile',
    'download_dir': 'D:/downloads',
    'window_size': (1920, 1080)
}

browser = BrowserFactory.create(
    browser_type='chrome',
    config=config,
    thread_name='MyChrome',
    auto_start=True
)

browser.wait_until_ready()
browser.navigate('https://example.com')

# Take screenshot
browser.screenshot('screenshot.png')

# Execute JavaScript
result = browser.execute_script('return document.title')
print(f"Title from JS: {result}")

browser.stop()
browser.join()
```

### Example 4: Firefox with Preferences

```python
from pycore.pyutils.pybrowser import BrowserFactory

config = {
    'headless': False,
    'preferences': {
        'browser.download.folderList': 2,
        'browser.download.dir': 'D:/downloads',
        'privacy.trackingprotection.enabled': True,
        'dom.webnotifications.enabled': False
    },
    'profile_dir': 'D:/firefox_profile',
    'window_size': (1600, 900)
}

browser = BrowserFactory.create(
    browser_type='firefox',
    config=config,
    auto_start=True
)

browser.wait_until_ready()
browser.navigate('https://example.com')

browser.stop()
browser.join()
```

### Example 5: Edge Browser

```python
from pycore.pyutils.pybrowser import BrowserFactory

config = {
    'headless': True,
    'args': ['--disable-gpu'],
    'window_size': (1366, 768)
}

browser = BrowserFactory.create(
    browser_type='edge',
    config=config,
    auto_start=True
)

browser.wait_until_ready()
browser.navigate('https://example.com')

# Get page content
content = browser.execute_script('return document.body.innerText')
print(content)

browser.stop()
browser.join()
```

---

## Multiple Browsers

### Example 6: Multiple Browsers in Parallel

```python
from pycore.pyutils.pybrowser import BrowserFactory
import time

# Create multiple browsers
browsers = []
urls = [
    'https://google.com',
    'https://github.com',
    'https://stackoverflow.com'
]

for i, url in enumerate(urls):
    browser = BrowserFactory.create(
        browser_type='chrome',
        config={'headless': False},
        thread_name=f'Browser-{i}',
        auto_start=True
    )
    browsers.append(browser)

# Wait for all to be ready
for browser in browsers:
    browser.wait_until_ready()

# Navigate all browsers in parallel
for browser, url in zip(browsers, urls):
    browser.navigate(url)

# Wait a bit
time.sleep(5)

# Get all titles
for i, browser in enumerate(browsers):
    title = browser.get_title()
    print(f"Browser {i}: {title}")

# Cleanup all
for browser in browsers:
    browser.stop()

for browser in browsers:
    browser.join()
```

### Example 7: Using create_multiple()

```python
from pycore.pyutils.pybrowser import BrowserFactory

browser_configs = [
    {
        'browser_type': 'chrome',
        'config': {'headless': False},
        'thread_name': 'Chrome-1'
    },
    {
        'browser_type': 'edge',
        'config': {'headless': True},
        'thread_name': 'Edge-1'
    },
    {
        'browser_type': 'firefox',
        'config': {'headless': False},
        'thread_name': 'Firefox-1'
    }
]

# Create all browsers at once
browsers = BrowserFactory.create_multiple(
    browser_configs,
    auto_start=True
)

# Wait for all
for browser in browsers:
    browser.wait_until_ready()

# All browsers navigate to same URL
for browser in browsers:
    browser.navigate('https://example.com')

# Cleanup
for browser in browsers:
    browser.stop()
    browser.join()
```

---

## Advanced Features

### Example 8: Tab Management

```python
from pycore.pyutils.pybrowser import BrowserFactory

browser = BrowserFactory.create(
    browser_type='chrome',
    auto_start=True
)
browser.wait_until_ready()

# Navigate first tab
browser.navigate('https://google.com')

# Open new tabs
browser.new_tab('https://github.com')
browser.new_tab('https://stackoverflow.com')

# Check tab count
tab_count = browser.get_tab_count()
print(f"Open tabs: {tab_count}")

# Switch to specific tab
browser.switch_to_tab(0)  # Switch to first tab
print(f"Current URL: {browser.get_current_url()}")

browser.switch_to_tab(1)  # Switch to second tab
print(f"Current URL: {browser.get_current_url()}")

# Close current tab
browser.close_current_tab()

print(f"Tabs after close: {browser.get_tab_count()}")

browser.stop()
browser.join()
```

### Example 9: Element Interaction

```python
from pycore.pyutils.pybrowser import BrowserFactory

browser = BrowserFactory.create(
    browser_type='chrome',
    auto_start=True
)
browser.wait_until_ready()

browser.navigate('https://google.com')

# Find element
search_box = browser.find_element('name', 'q')
if search_box:
    # Execute script to interact
    browser.execute_script(
        'arguments[0].value = arguments[1]',
        search_box,
        'Python threading'
    )

# Find multiple elements
links = browser.find_elements('tag', 'a')
print(f"Found {len(links)} links")

browser.stop()
browser.join()
```

### Example 10: Custom Actions with execute()

```python
from pycore.pyutils.pybrowser import BrowserFactory

browser = BrowserFactory.create(
    browser_type='chrome',
    auto_start=True
)
browser.wait_until_ready()

browser.navigate('https://example.com')

# Define custom function
def get_page_info(driver):
    """This function runs in browser thread"""
    return {
        'title': driver.title,
        'url': driver.current_url,
        'cookies': len(driver.get_cookies()),
        'window_size': driver.get_window_size()
    }

# Execute in browser thread
page_info = browser.execute(get_page_info)
print(page_info)

# Another custom function with parameters
def scroll_page(driver, pixels):
    driver.execute_script(f'window.scrollBy(0, {pixels})')
    return driver.execute_script('return window.pageYOffset')

scroll_position = browser.execute(scroll_page, 500)
print(f"Scrolled to: {scroll_position}px")

browser.stop()
browser.join()
```

### Example 11: Cookie Management

```python
from pycore.pyutils.pybrowser import BrowserFactory

browser = BrowserFactory.create(
    browser_type='chrome',
    auto_start=True
)
browser.wait_until_ready()

browser.navigate('https://example.com')

# Add cookie
cookie = {
    'name': 'test_cookie',
    'value': 'test_value',
    'domain': 'example.com'
}
browser.add_cookie(cookie)

# Get all cookies
cookies = browser.get_cookies()
print(f"Cookies: {len(cookies)}")

# Delete all cookies
browser.delete_all_cookies()
print(f"Cookies after delete: {len(browser.get_cookies())}")

browser.stop()
browser.join()
```

### Example 12: Window Management

```python
from pycore.pyutils.pybrowser import BrowserFactory

browser = BrowserFactory.create(
    browser_type='chrome',
    auto_start=True
)
browser.wait_until_ready()

# Set custom window size
browser.set_window_size(1280, 720)

browser.navigate('https://example.com')

# Maximize window
browser.maximize_window()

# Take screenshot
browser.screenshot('maximized_window.png')

browser.stop()
browser.join()
```

---

## Migration Guide

### Old Pattern (Async)

```python
# OLD WAY - Do NOT use
browser = await BrowserFactory.create('chrome', config)
await browser.launch(options)

thread = Thread(target=worker, args=(browser,))
thread.start()
```

### New Pattern (Threaded)

```python
# NEW WAY - Use this
browser = BrowserFactory.create(
    browser_type='chrome',
    config=config,
    auto_start=True
)

browser.wait_until_ready()
browser.navigate('https://example.com')

browser.stop()
browser.join()
```

### Key Differences

| Aspect | Old Pattern | New Pattern |
|--------|-------------|-------------|
| **Initialization** | `await BrowserFactory.create()` | `BrowserFactory.create()` |
| **Launch** | `await browser.launch()` | `browser.start()` (Thread method) |
| **Threading** | External thread management | Built-in (browser IS thread) |
| **Navigation** | `await browser.navigate()` | `browser.navigate()` (thread-safe) |
| **Cleanup** | `await browser.close()` | `browser.stop()` + `browser.join()` |

---

## Best Practices

1. **Always call wait_until_ready()** after starting browser
   ```python
   browser.start()
   browser.wait_until_ready()  # Important!
   ```

2. **Always cleanup** with stop() and join()
   ```python
   browser.stop()
   browser.join()  # Wait for cleanup
   ```

3. **Use thread names** for debugging multiple browsers
   ```python
   browser = BrowserFactory.create(
       browser_type='chrome',
       thread_name='MyChrome-1'  # Helpful for debugging
   )
   ```

4. **Use execute()** for custom actions
   ```python
   def custom_action(driver, arg1, arg2):
       # Your code here
       return result

   result = browser.execute(custom_action, 'value1', 'value2')
   ```

5. **Check if browser is running**
   ```python
   if browser.is_running():
       browser.navigate('https://example.com')
   ```

---

## Error Handling

```python
from pycore.pyutils.pybrowser import BrowserFactory
from pycore import ColorPrint

try:
    browser = BrowserFactory.create(
        browser_type='chrome',
        auto_start=True
    )

    if not browser.wait_until_ready(timeout=30):
        raise TimeoutError("Browser failed to start")

    browser.navigate('https://example.com')

    # Your code here

except Exception as e:
    ColorPrint.print_error(f"Browser error: {e}")
finally:
    if browser.is_running():
        browser.stop()
        browser.join()
```

---

## Complete Working Example

```python
#!/usr/bin/env python3
"""Complete PyBrowser Thread Mode Example"""

from pycore.pyutils.pybrowser import BrowserFactory
from pycore import ColorPrint
import time


def main():
    ColorPrint.print_info("Starting PyBrowser Thread Mode Example")

    # Create browser
    browser = BrowserFactory.create(
        browser_type='chrome',
        config={
            'headless': False,
            'window_size': (1920, 1080)
        },
        thread_name='ExampleBrowser',
        auto_start=True
    )

    try:
        # Wait for browser to be ready
        if not browser.wait_until_ready(timeout=30):
            raise TimeoutError("Browser failed to start")

        ColorPrint.print_success("Browser is ready!")

        # Navigate
        browser.navigate('https://github.com')
        time.sleep(2)

        # Get page info
        title = browser.get_title()
        url = browser.get_current_url()
        ColorPrint.print_info(f"Title: {title}")
        ColorPrint.print_info(f"URL: {url}")

        # Open new tab
        browser.new_tab('https://stackoverflow.com')
        time.sleep(2)

        # Take screenshot
        browser.screenshot('stackoverflow.png')
        ColorPrint.print_success("Screenshot saved!")

        # Execute JavaScript
        result = browser.execute_script(
            'return {title: document.title, links: document.links.length}'
        )
        ColorPrint.print_info(f"Page has {result['links']} links")

        # Switch back to first tab
        browser.switch_to_tab(0)
        ColorPrint.print_info(f"Back to: {browser.get_current_url()}")

    except Exception as e:
        ColorPrint.print_error(f"Error: {e}")
    finally:
        # Cleanup
        ColorPrint.print_info("Cleaning up...")
        browser.stop()
        browser.join()
        ColorPrint.print_success("Browser closed successfully!")


if __name__ == '__main__':
    main()
```

---

**Version:** 2.0
**Last Updated:** 2025-11-09
**Pattern:** Threading.Thread Inheritance
