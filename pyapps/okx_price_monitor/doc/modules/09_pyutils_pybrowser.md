# pyutils.pybrowser - Selenium-based Browser Automation

## Overview

The `pybrowser` module is a comprehensive Selenium-based browser automation framework, serving as the Python equivalent of puppeteer_spider_v2. It provides session management, browser abstraction, plugin architecture, and utilities for web scraping and automation.

## Module Location

```
pycore/pyutils/pybrowser/
├── __init__.py
├── main.py                     # Main exports
├── core/
│   ├── spider_engine.py        # SpiderEngine
│   ├── session_manager.py      # SessionManager
│   ├── resource_pool.py        # ResourcePool
│   ├── event_bus.py            # EventBus
│   └── plugin_manager.py       # PluginManager
├── browser/
│   ├── browser_factory.py      # BrowserFactory
│   ├── chrome_browser.py       # ChromeBrowser
│   ├── edge_browser.py         # EdgeBrowser
│   ├── firefox_browser.py      # FirefoxBrowser
│   └── interfaces.py           # IBrowser, IPage
├── plugins/
│   ├── content_plugin.py       # ContentPlugin
│   ├── automation_plugin.py    # AutomationPlugin
│   ├── download_plugin.py      # DownloadPlugin
│   ├── form_plugin.py          # FormPlugin
│   └── screenshot_plugin.py    # ScreenshotPlugin
├── utils/
│   ├── page_utils.py           # PageUtils
│   ├── browser_utils.py        # BrowserUtils
│   ├── data_extraction.py      # DataExtractionUtils
│   ├── element_finder.py       # ElementFinderUtils
│   ├── navigation.py           # NavigationUtils
│   └── iframe_utils.py         # IFrameUtils
└── config/
    └── config_manager.py       # ConfigManager
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SpiderEngine                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              SessionManager                          │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐            │   │
│  │  │ Session1 │ │ Session2 │ │ Session3 │  ...       │   │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘            │   │
│  └───────┼────────────┼────────────┼────────────────────┘   │
│          │            │            │                        │
│          ▼            ▼            ▼                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              BrowserFactory                          │   │
│  │  ┌────────┐  ┌────────┐  ┌─────────┐               │   │
│  │  │ Chrome │  │  Edge  │  │ Firefox │               │   │
│  │  └────────┘  └────────┘  └─────────┘               │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                │
│                            ▼                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              PluginManager                           │   │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐  │   │
│  │  │ Content │ │Automation│ │ Download │ │ Form   │  │   │
│  │  └─────────┘ └──────────┘ └──────────┘ └────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### SpiderEngine

Main engine for browser automation:

```python
from pycore.pyutils.pybrowser import SpiderEngine, create_spider_engine

# Create engine
engine = create_spider_engine()

# Or get default singleton
engine = get_default_engine()

# Create session
session = engine.create_session(
    browser_type="chrome",
    headless=True,
    proxy=None
)

# Navigate
session.navigate("https://example.com")

# Get page content
content = session.get_content()

# Close session
session.close()

# Shutdown engine
engine.shutdown()
```

### SessionManager

Manages browser sessions:

```python
from pycore.pyutils.pybrowser import SessionManager, Session

manager = SessionManager()

# Create session
session = manager.create_session(
    name="main",
    browser_type="chrome",
    options={
        "headless": True,
        "window_size": (1920, 1080)
    }
)

# Get session by name
session = manager.get_session("main")

# List sessions
sessions = manager.list_sessions()

# Close session
manager.close_session("main")

# Close all
manager.close_all()
```

### Session

Individual browser session:

```python
from pycore.pyutils.pybrowser import Session

session = Session(browser_type="chrome", headless=True)

# Navigation
session.navigate("https://example.com")
session.back()
session.forward()
session.refresh()

# Content
html = session.get_content()
text = session.get_text()
title = session.get_title()
url = session.get_url()

# Elements
element = session.find_element("css", "#login-button")
elements = session.find_elements("xpath", "//div[@class='item']")

# Actions
session.click("#button")
session.type("#input", "text")
session.submit("#form")
session.scroll_to(0, 1000)

# Wait
session.wait_for_element("#loaded", timeout=10)
session.wait_for_text("Success")

# Screenshot
session.screenshot("page.png")

# Execute JavaScript
result = session.execute_script("return document.title")

# Cookies
cookies = session.get_cookies()
session.set_cookie({"name": "token", "value": "abc123"})
session.delete_cookie("token")

# Close
session.close()
```

### BrowserFactory

Creates browser instances:

```python
from pycore.pyutils.pybrowser import BrowserFactory

# Create Chrome browser
browser = BrowserFactory.create(
    browser_type="chrome",
    headless=True,
    options={
        "window_size": (1920, 1080),
        "user_agent": "Custom UA",
        "proxy": "http://proxy:8080",
        "disable_images": True,
        "disable_javascript": False,
        "download_dir": "/downloads"
    }
)

# Create Edge browser
browser = BrowserFactory.create(
    browser_type="edge",
    headless=True
)

# Create Firefox browser
browser = BrowserFactory.create(
    browser_type="firefox",
    headless=True
)
```

### Browser Classes

#### ChromeBrowser

```python
from pycore.pyutils.pybrowser import ChromeBrowser

browser = ChromeBrowser(
    headless=True,
    user_data_dir=None,
    extensions=["/path/to/extension"],
    binary_location=None
)

# Chrome-specific options
browser.set_download_behavior("/downloads")
browser.enable_devtools_protocol()
browser.set_network_conditions(
    offline=False,
    latency=100,
    download_throughput=1000000,
    upload_throughput=500000
)
```

#### EdgeBrowser

```python
from pycore.pyutils.pybrowser import EdgeBrowser

browser = EdgeBrowser(headless=True)
```

#### FirefoxBrowser

```python
from pycore.pyutils.pybrowser import FirefoxBrowser

browser = FirefoxBrowser(
    headless=True,
    profile_path=None
)
```

## Plugins

### ContentPlugin

Content extraction:

```python
from pycore.pyutils.pybrowser import ContentPlugin

plugin = ContentPlugin(session)

# Extract text
text = plugin.extract_text("#article")

# Extract links
links = plugin.extract_links()

# Extract images
images = plugin.extract_images()

# Extract table
table_data = plugin.extract_table("#data-table")

# Extract structured data
data = plugin.extract_json_ld()
```

### AutomationPlugin

Automation utilities:

```python
from pycore.pyutils.pybrowser import AutomationPlugin

plugin = AutomationPlugin(session)

# Human-like typing
plugin.human_type("#input", "text", delay_range=(50, 150))

# Random mouse movement
plugin.random_mouse_move()

# Scroll with human-like behavior
plugin.human_scroll(direction="down", distance=500)

# Wait random time
plugin.random_wait(1, 3)

# Avoid detection
plugin.stealth_mode()
```

### DownloadPlugin

File downloads:

```python
from pycore.pyutils.pybrowser import DownloadPlugin, EnhancedDownloadPlugin

plugin = DownloadPlugin(session, download_dir="/downloads")

# Download file
file_path = plugin.download_file("https://example.com/file.pdf")

# Download with name
file_path = plugin.download_file(
    "https://example.com/file.pdf",
    filename="my_file.pdf"
)

# Wait for download
plugin.wait_for_download(timeout=60)

# Enhanced download
enhanced = EnhancedDownloadPlugin(session)
enhanced.download_all_links(".download-link", "/downloads")
```

### FormPlugin

Form handling:

```python
from pycore.pyutils.pybrowser import FormPlugin

plugin = FormPlugin(session)

# Fill form
plugin.fill_form("#login-form", {
    "username": "user@example.com",
    "password": "secret123"
})

# Select dropdown
plugin.select_option("#country", "US")

# Check checkbox
plugin.check("#agree-terms")

# Upload file
plugin.upload_file("#file-input", "/path/to/file.pdf")

# Submit form
plugin.submit("#login-form")
```

### ScreenshotPlugin

Screenshots:

```python
from pycore.pyutils.pybrowser import ScreenshotPlugin

plugin = ScreenshotPlugin(session)

# Full page screenshot
plugin.screenshot_full_page("full_page.png")

# Element screenshot
plugin.screenshot_element("#header", "header.png")

# Viewport screenshot
plugin.screenshot_viewport("viewport.png")

# Screenshot with highlight
plugin.screenshot_with_highlight("#button", "highlight.png")
```

## Utility Classes

### PageUtils

```python
from pycore.pyutils.pybrowser import PageUtils

utils = PageUtils(session)

# Wait for page load
utils.wait_for_load()

# Wait for network idle
utils.wait_for_network_idle()

# Scroll to element
utils.scroll_to_element("#target")

# Scroll to bottom
utils.scroll_to_bottom()

# Get page metrics
metrics = utils.get_page_metrics()
```

### ElementFinderUtils

```python
from pycore.pyutils.pybrowser import ElementFinderUtils

finder = ElementFinderUtils(session)

# Find by text
element = finder.find_by_text("Click me")

# Find by partial text
element = finder.find_by_partial_text("Click")

# Find visible elements
elements = finder.find_visible_elements(".item")

# Find clickable element
element = finder.find_clickable("#button")

# Find within element
child = finder.find_within(parent, ".child")
```

### DataExtractionUtils

```python
from pycore.pyutils.pybrowser import DataExtractionUtils

extractor = DataExtractionUtils(session)

# Extract structured data
data = extractor.extract_structured_data("#product", {
    "name": ".product-name",
    "price": ".product-price",
    "description": ".product-desc"
})

# Extract list data
items = extractor.extract_list(".item-list .item", {
    "title": ".title",
    "link": "a@href"
})

# Extract table to dict
table = extractor.table_to_dict("#data-table")
```

### IFrameUtils

```python
from pycore.pyutils.pybrowser import IFrameUtils, IframeRecursiveCrawler

utils = IFrameUtils(session)

# Switch to iframe
utils.switch_to_frame("#iframe")

# Switch to parent
utils.switch_to_parent()

# Switch to main
utils.switch_to_main()

# Recursive crawler
crawler = IframeRecursiveCrawler(session)
all_content = crawler.crawl_all_frames()
```

## Advanced Features

### Resource Interception

```python
from pycore.pyutils.pybrowser import ResourceInterceptor

interceptor = ResourceInterceptor(session)

# Block resources
interceptor.block_resources(["image", "stylesheet", "font"])

# Intercept requests
def on_request(request):
    if "analytics" in request.url:
        request.abort()
    else:
        request.continue_()

interceptor.intercept_requests(on_request)

# Intercept responses
def on_response(response):
    print(f"Response: {response.url} - {response.status}")

interceptor.intercept_responses(on_response)
```

### DOM Resource Mapper

```python
from pycore.pyutils.pybrowser import DomResourceMapper

mapper = DomResourceMapper(session)

# Map all resources
resources = mapper.map_resources()

for resource in resources:
    print(f"Type: {resource.type}, URL: {resource.url}")
```

### Fetcher

```python
from pycore.pyutils.pybrowser import Fetcher

fetcher = Fetcher()

# Fetch with browser context
response = fetcher.fetch(
    "https://api.example.com/data",
    session=session,
    headers={"Authorization": "Bearer token"}
)

print(response.json())
```

## Usage Examples

### Basic Web Scraping

```python
from pycore.pyutils.pybrowser import create_spider_engine

engine = create_spider_engine()

session = engine.create_session(browser_type="chrome", headless=True)
session.navigate("https://news.ycombinator.com")

# Extract titles
titles = session.find_elements("css", ".titleline > a")
for title in titles[:10]:
    print(title.text)

session.close()
engine.shutdown()
```

### Login Automation

```python
from pycore.pyutils.pybrowser import create_session, FormPlugin

session = create_session(browser_type="chrome", headless=False)
form = FormPlugin(session)

session.navigate("https://example.com/login")

form.fill_form("#login-form", {
    "email": "user@example.com",
    "password": "secret123"
})

form.submit("#login-form")
session.wait_for_element("#dashboard", timeout=10)

print("Login successful!")
session.close()
```

### Multi-Page Crawling

```python
from pycore.pyutils.pybrowser import SpiderEngine

engine = SpiderEngine()

def crawl_page(url):
    session = engine.create_session(headless=True)
    session.navigate(url)
    
    # Get all links
    links = session.find_elements("css", "a[href]")
    urls = [link.get_attribute("href") for link in links]
    
    # Get content
    content = session.get_text()
    
    session.close()
    return content, urls

# Crawl starting page
content, urls = crawl_page("https://example.com")

# Crawl linked pages
for url in urls[:5]:
    if url.startswith("https://example.com"):
        content, _ = crawl_page(url)
        print(f"Crawled: {url}")

engine.shutdown()
```

## Best Practices

1. **Use Headless Mode**: Enable for better performance in automation

2. **Implement Waits**: Always wait for elements before interacting

3. **Handle Popups**: Close cookie banners and popups

4. **Rotate User Agents**: Avoid detection in scraping

5. **Close Sessions**: Always close sessions to free resources

## Related Modules

- `pycore.pyctl.pybrowserauto` - Offline web downloader
- `pycore.pyutils.device` - Mobile automation via ADB
- `pycore.pyutils.image_tools` - Screenshot processing

## Exports

```python
__all__ = [
    'SpiderEngine', 'SessionManager', 'Session', 'ResourcePool',
    'EventBus', 'PluginManager',
    'IBrowser', 'IPage', 'IPlugin', 'IDownloader',
    'BrowserFactory', 'ConfigManager',
    'ContentPlugin', 'AutomationPlugin', 'DownloadPlugin',
    'EnhancedDownloadPlugin', 'FormPlugin', 'ScreenshotPlugin',
    'ChromeBrowser', 'EdgeBrowser', 'FirefoxBrowser',
    'StandardPage', 'EnhancedPage',
    'PageUtils', 'BrowserUtils', 'CacheManager', 'BaseUtils',
    'DataExtractionUtils', 'ElementFinderUtils', 'NavigationUtils',
    'IFrameUtils', 'IframeRecursiveCrawler',
    'ResourceInterceptor', 'DomResourceMapper',
    'EnhancedResourceCollector', 'ResourceDownloadUtils',
    'ResourceProxyServer', 'BrowserControlUtils',
    'EventUtils', 'PageOperationUtils', 'TampermonkeyServer',
    'Logger', 'Validator', 'RetryHandler', 'PerformanceMonitor',
    'LegacyAdapter', 'MigrationTool', 'Fetcher',
    'create_spider_engine', 'get_default_engine',
    'create_session', 'get_session', 'close_session', 'shutdown',
]
```



