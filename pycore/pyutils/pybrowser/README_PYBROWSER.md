# PyBrowser - Selenium-based Browser Automation Framework

Python equivalent of puppeteer_spider_v2, providing powerful browser automation capabilities using Selenium WebDriver.

## Features

### Core Architecture
- **SpiderEngine**: Main orchestration engine
- **SessionManager**: Browser session lifecycle management
- **ResourcePool**: Browser/page pooling for resource optimization
- **EventBus**: Event-driven communication
- **PluginManager**: Extensible plugin system

### Browser Support
- Chrome (ChromeBrowser)
- Edge (EdgeBrowser)
- Firefox (FirefoxBrowser)

### Page Implementations
- **StandardPage**: Basic page wrapper with Selenium WebDriver
- **EnhancedPage**: Advanced page with resource collection, download handling, tab management

### Plugins

#### Core Plugins
- **ContentPlugin**: Content extraction (text, HTML, images, links, forms, meta)
- **AutomationPlugin**: Page automation (fill forms, select dropdowns, hover, scroll)
- **DownloadPlugin**: Basic file download functionality
- **EnhancedDownloadPlugin**: Advanced download with file monitoring and link detection

#### Extension Plugins
- **FormPlugin**: Advanced form handling
- **ScreenshotPlugin**: Screenshot functionality

### Utilities

#### Page Utils
- PageUtils: Page operations (wait for load, inject script, cookies)
- BrowserUtils: Browser operations (viewport, user agent, browser info)
- CacheManager: Caching with TTL support

#### Data Extraction
- DataExtractionUtils: Table and list extraction
- ElementFinderUtils: Find elements by text, visibility

#### Navigation
- NavigationUtils: Back/forward/refresh operations

#### IFrame Handling
- IFrameUtils: Basic iframe operations
- IframeRecursiveCrawler: Deep iframe traversal and recursive crawling

#### Resource Collection
- ResourceInterceptor: Intercept and track network resources
- DomResourceMapper: Map DOM elements to their resources
- EnhancedResourceCollector: Combine interceptor and mapper for comprehensive resource collection

#### Advanced Control
- BrowserControlUtils: Advanced browser control (screenshots, user agent, cookies, cache)
- EventUtils: Event handling utilities
- PageOperationUtils: Safe page operations with retry logic

#### Utilities
- Logger: Logging with level control
- Validator: Config and data validation
- RetryHandler: Retry logic with backoff
- PerformanceMonitor: Performance metrics tracking

## Installation

```bash
pip install selenium webdriver-manager aiohttp
```

## Quick Start

### Basic Usage

```python
import asyncio
from pycore.pyutils.pybrowser import create_session, shutdown

async def main():
    # Create session
    session = await create_session({
        'preset': 'desktop',
        'browser': 'chrome',
        'headless': False
    })

    # Create page
    page = await session.new_page()

    # Navigate
    await page.goto('https://example.com')

    # Extract content
    content_plugin = session.get_plugin('content')
    content = await content_plugin.extract_all(page)
    print(content)

    # Close
    await session.close()
    await shutdown()

if __name__ == '__main__':
    asyncio.run(main())
```

### Enhanced Page with Resource Collection

```python
from pycore.pyutils.pybrowser import create_session, shutdown

async def main():
    session = await create_session({
        'preset': 'desktop',
        'browser': 'chrome',
        'headless': False,
        'enableResourceCollection': True
    })

    page = await session.new_page()
    await page.goto('https://example.com')

    # Collect resources
    if hasattr(page, 'collect_resources'):
        result = await page.collect_resources()
        print(f"Resources: {result['stats']}")

    await session.close()
    await shutdown()
```

### IframeRecursiveCrawler

```python
from pycore.pyutils.pybrowser import create_session, IframeRecursiveCrawler, shutdown

async def main():
    session = await create_session({'preset': 'desktop', 'browser': 'chrome'})
    page = await session.new_page()
    await page.goto('https://example.com')

    crawler = IframeRecursiveCrawler(page, {
        'maxDepth': 3,
        'delay': 1000,
        'maxLinksPerPage': 10,
        'sameOriginOnly': True,
        'onPageCallback': lambda result, count, depth: print(f"Page {count}: {result['url']}")
    })

    result = await crawler.start()
    print(f"Crawled {result['totalProcessed']} pages")

    await session.close()
    await shutdown()
```

### Download with EnhancedDownloadPlugin

```python
from pycore.pyutils.pybrowser import create_session, shutdown

async def main():
    session = await create_session({'preset': 'desktop', 'browser': 'chrome'})
    download_plugin = session.get_plugin('enhanced_download')

    # Download file
    result = await download_plugin.download_file(
        'https://example.com/file.pdf',
        {'filename': 'downloaded_file.pdf'}
    )

    # Get metrics
    metrics = download_plugin.get_download_metrics()
    print(f"Downloads: {metrics}")

    await session.close()
    await shutdown()
```

### Using Logger, Validator, RetryHandler

```python
from pycore.pyutils.pybrowser import Logger, Validator, RetryHandler, PerformanceMonitor

# Logger
logger = Logger({'level': 'debug', 'prefix': 'MyApp'})
logger.info('Application started')

# Validator
is_valid_url = Validator.is_url('https://example.com')
is_valid_email = Validator.is_email('test@example.com')

config = {'timeout': 5000, 'retries': 3}
schema = {
    'timeout': {'required': True, 'type': int, 'min': 1000},
    'retries': {'required': True, 'type': int, 'min': 1, 'max': 10}
}
validation = Validator.validate_config(config, schema)

# RetryHandler
retry_handler = RetryHandler({'maxAttempts': 3, 'delay': 1000})
result = await retry_handler.execute(async_operation)

# PerformanceMonitor
monitor = PerformanceMonitor()
monitor.start_timer('operation')
# ... do work ...
duration = monitor.end_timer('operation')
```

### Resource Collection

```python
from pycore.pyutils.pybrowser import (
    create_session,
    ResourceInterceptor,
    DomResourceMapper,
    EnhancedResourceCollector,
    shutdown
)

async def main():
    session = await create_session({'preset': 'desktop', 'browser': 'chrome'})
    page = await session.new_page()

    # Using ResourceInterceptor
    interceptor = ResourceInterceptor(page, {
        'resourceTypes': ['image', 'stylesheet'],
        'computeHash': True
    })
    await interceptor.enable()

    await page.goto('https://example.com')

    resources = interceptor.get_intercepted_resources()
    print(f"Intercepted {len(resources)} resources")

    # Using DomResourceMapper
    mapper = DomResourceMapper(page)
    dom_resources = await mapper.extract_dom_resources()
    print(f"Extracted {len(dom_resources)} DOM resources")

    # Using EnhancedResourceCollector
    collector = EnhancedResourceCollector(page)
    await collector.enable()
    result = await collector.collect_resources()
    print(f"Collected: {result['stats']}")

    await session.close()
    await shutdown()
```

## Configuration Presets

### Desktop Preset
```python
{
    'preset': 'desktop',
    'browser': 'chrome',
    'headless': False
}
```

### Headless Preset
```python
{
    'preset': 'headless',
    'browser': 'chrome',
    'headless': True
}
```

### Mobile Preset
```python
{
    'preset': 'mobile',
    'browser': 'chrome',
    'headless': False,
    'mobileEmulation': {'deviceName': 'iPhone 12'}
}
```

## API Reference

See `example.py` and `example_enhanced.py` for comprehensive usage examples.

## Architecture

```
pybrowser/
├── core/                  # Core modules
│   ├── spider_engine.py
│   ├── session_manager.py
│   ├── resource_pool.py
│   ├── event_bus.py
│   └── plugin_manager.py
├── interfaces/            # Interface definitions
│   ├── ibrowser.py
│   ├── ipage.py
│   ├── iplugin.py
│   └── idownloader.py
├── implementations/       # Concrete implementations
│   ├── browsers/
│   │   ├── chrome_browser.py
│   │   ├── edge_browser.py
│   │   └── firefox_browser.py
│   └── pages/
│       ├── standard_page.py
│       └── enhanced_page.py
├── plugins/              # Plugin system
│   ├── core/
│   │   ├── content_plugin.py
│   │   ├── automation_plugin.py
│   │   ├── download_plugin.py
│   │   └── enhanced_download_plugin.py
│   └── extensions/
│       ├── form_plugin.py
│       └── screenshot_plugin.py
├── utils/               # Utility modules
│   ├── base/
│   ├── extraction/
│   ├── finder/
│   ├── navigation/
│   ├── iframe/
│   ├── download/
│   ├── control/
│   ├── events/
│   ├── operations/
│   └── logger.py
├── config/              # Configuration
│   └── config_manager.py
├── factories/           # Factory patterns
│   └── browser_factory.py
├── main.py             # Main entry point
├── example.py          # Basic examples
└── example_enhanced.py # Advanced examples
```

## License

Same as parent project

## Credits

Inspired by puppeteer_spider_v2 (Node.js)
