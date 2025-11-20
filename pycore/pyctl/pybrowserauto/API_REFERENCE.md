# DocumentOffline API Reference

## Table of Contents

1. [Public API](#public-api)
2. [Core Module](#core-module)
3. [Fetcher Module](#fetcher-module)
4. [Processor Module](#processor-module)
5. [Reporter Module](#reporter-module)
6. [Server Module](#server-module)
7. [Controller Module](#controller-module)
8. [Configuration](#configuration)

---

## Public API

### OfflineManager

Main interface for document offline operations.

**Import:**
```python
from pycore.pyctl.document_offline import offline_manager
```

#### Methods

##### `start(argv=None)`
Start offline download with command-line arguments.

**Parameters:**
- `argv` (list, optional): Command-line arguments (default: sys.argv)

**Example:**
```python
from pycore.pyctl.document_offline import offline_manager

offline_manager.start(['https://example.com', '3', '--fetcher=browser'])
```

##### `download_site(url, **options)`
Download a website programmatically.

**Parameters:**
- `url` (str): Target URL
- `depth` (int): Recursion depth (default: 3)
- `fetcher` (str): Fetcher type ('http'|'browser'|'iframe'|'tampermonkey')
- `scope` (str): Download scope ('full'|'path')
- `no_js` (bool): Remove JavaScript tags (default: False)
- `screenshot` (bool): Capture screenshots (default: False)
- `output_dir` (str): Output directory (default: auto)

**Returns:**
- `dict`: Download result

**Example:**
```python
result = offline_manager.download_site(
    'https://example.com',
    depth=2,
    fetcher='browser',
    scope='path',
    screenshot=True
)

print(f"Downloaded {result['total_urls']} pages")
print(f"Failed: {result['failed_urls']}")
```

##### `get_status()`
Get current download status.

**Returns:**
- `dict`: Status information

**Example:**
```python
status = offline_manager.get_status()
print(f"Progress: {status['processed']}/{status['total']}")
print(f"Queue size: {status['queue_size']}")
```

##### `stop()`
Stop current download.

**Example:**
```python
offline_manager.stop()
```

---

## Core Module

### DomainContext

Manages URL validation and domain scope.

**Import:**
```python
from pycore.pyctl.document_offline.core import DomainContext
```

#### Constructor

```python
ctx = DomainContext(start_url, scope_type='full')
```

**Parameters:**
- `start_url` (str): Starting URL
- `scope_type` (str): 'full' or 'path' (default: 'full')

#### Methods

##### `canonicalize(url)`
Normalize URL (remove fragments, trailing slashes).

**Parameters:**
- `url` (str): URL to normalize

**Returns:**
- `str`: Canonical URL

**Example:**
```python
ctx = DomainContext('https://example.com')
canonical = ctx.canonicalize('https://example.com/path/#section')
# Returns: 'https://example.com/path'
```

##### `is_internal_link(url)`
Check if URL is same-origin.

**Parameters:**
- `url` (str): URL to check

**Returns:**
- `bool`: True if internal

**Example:**
```python
ctx = DomainContext('https://example.com')
ctx.is_internal_link('https://example.com/page')  # True
ctx.is_internal_link('https://other.com/page')    # False
```

##### `is_within_scope(url)`
Check if URL is within path scope.

**Parameters:**
- `url` (str): URL to check

**Returns:**
- `bool`: True if within scope

**Example:**
```python
ctx = DomainContext('https://example.com/docs/', scope_type='path')
ctx.is_within_scope('https://example.com/docs/api')  # True
ctx.is_within_scope('https://example.com/blog')      # False
```

##### `resolve_href(base_url, href)`
Resolve relative URL.

**Parameters:**
- `base_url` (str): Base URL
- `href` (str): Relative or absolute URL

**Returns:**
- `dict`: {'url': absolute_url, 'canonical': canonical_url}

**Example:**
```python
ctx = DomainContext('https://example.com')
result = ctx.resolve_href('https://example.com/docs/', '../api/v1')
# Returns: {'url': 'https://example.com/api/v1', 'canonical': 'https://example.com/api/v1'}
```

##### `get_origin()`
Get base origin (protocol + hostname).

**Returns:**
- `str`: Origin URL

**Example:**
```python
ctx = DomainContext('https://example.com/path/page')
ctx.get_origin()  # Returns: 'https://example.com'
```

##### `get_scope_url()`
Get scope root URL.

**Returns:**
- `str`: Scope URL

**Example:**
```python
ctx = DomainContext('https://example.com/docs/api/', scope_type='path')
ctx.get_scope_url()  # Returns: 'https://example.com/docs/api'
```

---

### URLQueue

Thread-safe URL queue with deduplication.

**Import:**
```python
from pycore.pyctl.document_offline.core import URLQueue
```

#### Constructor

```python
queue = URLQueue()
```

#### Methods

##### `enqueue(url, depth)`
Add URL to queue.

**Parameters:**
- `url` (str): URL to add
- `depth` (int): Current depth

**Example:**
```python
queue = URLQueue()
queue.enqueue('https://example.com/page1', 1)
queue.enqueue('https://example.com/page2', 2)
```

##### `dequeue()`
Get next URL from queue.

**Returns:**
- `dict`: {'url': url, 'depth': depth} or None

**Example:**
```python
item = queue.dequeue()
if item:
    print(f"URL: {item['url']}, Depth: {item['depth']}")
```

##### `mark_processed(url)`
Mark URL as processed.

**Parameters:**
- `url` (str): URL to mark

**Example:**
```python
queue.mark_processed('https://example.com/page1')
```

##### `has_processed(url)`
Check if URL was already processed.

**Parameters:**
- `url` (str): URL to check

**Returns:**
- `bool`: True if processed

**Example:**
```python
if not queue.has_processed(url):
    queue.enqueue(url, depth)
```

##### `has_pending()`
Check if queue has pending URLs.

**Returns:**
- `bool`: True if not empty

**Example:**
```python
while queue.has_pending():
    item = queue.dequeue()
    # Process item
```

##### `size()`
Get pending queue size.

**Returns:**
- `int`: Number of pending URLs

##### `processed_count()`
Get processed URLs count.

**Returns:**
- `int`: Number of processed URLs

---

### FileMapper

Maps URLs to local file paths.

**Import:**
```python
from pycore.pyctl.document_offline.core import FileMapper
```

#### Constructor

```python
mapper = FileMapper(supported_extensions=None)
```

**Parameters:**
- `supported_extensions` (set, optional): Set of supported file extensions

#### Methods

##### `map_path(url_or_parsed)`
Map URL to local file path.

**Parameters:**
- `url_or_parsed` (str or ParseResult): URL or parsed URL object

**Returns:**
- `str`: Local file path

**Example:**
```python
from urllib.parse import urlparse

mapper = FileMapper()
path = mapper.map_path('https://example.com/docs/api.html')
# Returns: 'docs/api.html'

parsed = urlparse('https://example.com/images/logo.png')
path = mapper.map_path(parsed)
# Returns: 'images/logo.png'
```

##### `is_supported_extension(ext)`
Check if file extension is supported.

**Parameters:**
- `ext` (str): File extension (with dot)

**Returns:**
- `bool`: True if supported

**Example:**
```python
mapper = FileMapper()
mapper.is_supported_extension('.html')  # True
mapper.is_supported_extension('.exe')   # False
```

---

### URLRewriter

Rewrites URLs in HTML and CSS.

**Import:**
```python
from pycore.pyctl.document_offline.core import URLRewriter
```

#### Methods

##### `rewrite_html(html, base_url, domain_context, file_mapper)`
Rewrite all URLs in HTML.

**Parameters:**
- `html` (str): HTML content
- `base_url` (str): Base URL
- `domain_context` (DomainContext): Domain context
- `file_mapper` (FileMapper): File mapper

**Returns:**
- `str`: Rewritten HTML

**Example:**
```python
from pycore.pyctl.document_offline.core import URLRewriter, DomainContext, FileMapper

rewriter = URLRewriter()
ctx = DomainContext('https://example.com')
mapper = FileMapper()

html = '<img src="https://example.com/img/logo.png">'
rewritten = rewriter.rewrite_html(html, 'https://example.com', ctx, mapper)
# Returns: '<img src="../img/logo.png">'
```

##### `rewrite_css(css, base_url, domain_context, file_mapper)`
Rewrite all URLs in CSS.

**Parameters:**
- `css` (str): CSS content
- `base_url` (str): Base URL
- `domain_context` (DomainContext): Domain context
- `file_mapper` (FileMapper): File mapper

**Returns:**
- `str`: Rewritten CSS

**Example:**
```python
css = 'background: url("https://example.com/bg.png");'
rewritten = rewriter.rewrite_css(css, 'https://example.com/styles/', ctx, mapper)
# Returns: 'background: url("../bg.png");'
```

---

### BackupManager

Manages backup creation and cleanup.

**Import:**
```python
from pycore.pyctl.document_offline.core import BackupManager
```

#### Constructor

```python
manager = BackupManager(max_backups=5)
```

**Parameters:**
- `max_backups` (int): Maximum number of backups to keep

#### Methods

##### `create_backup(source_dir)`
Create timestamped backup.

**Parameters:**
- `source_dir` (str): Directory to backup

**Returns:**
- `str`: Backup directory path or None

**Example:**
```python
manager = BackupManager(max_backups=3)
backup_path = manager.create_backup('/path/to/download')
print(f"Backup created: {backup_path}")
```

##### `list_backups(parent_dir)`
List all backups in directory.

**Parameters:**
- `parent_dir` (str): Parent directory

**Returns:**
- `list`: List of backup info dicts

**Example:**
```python
backups = manager.list_backups('/path/to/parent')
for backup in backups:
    print(f"{backup['name']} - {backup['mtime']}")
```

##### `delete_old_backups(parent_dir)`
Clean up old backups.

**Parameters:**
- `parent_dir` (str): Parent directory

**Example:**
```python
manager.delete_old_backups('/path/to/parent')
```

---

## Fetcher Module

### BaseFetcher (Abstract)

Base class for all fetchers.

**Import:**
```python
from pycore.pyctl.document_offline.fetcher import BaseFetcher
```

#### Methods (Abstract)

##### `fetch(url)`
Fetch URL content.

**Parameters:**
- `url` (str): URL to fetch

**Returns:**
- `dict`: Fetch result {'content': str, 'is_binary': bool, 'is_text': bool}

##### `cleanup()`
Cleanup fetcher resources.

---

### HTTPFetcher

HTTP-based fetcher (fastest mode).

**Import:**
```python
from pycore.pyctl.document_offline.fetcher import HTTPFetcher
```

#### Constructor

```python
fetcher = HTTPFetcher(file_mapper, timeout=30000)
```

**Parameters:**
- `file_mapper` (FileMapper): File mapper instance
- `timeout` (int): Request timeout in milliseconds

#### Methods

##### `fetch(url)`
Fetch URL via HTTP request.

**Parameters:**
- `url` (str): URL to fetch

**Returns:**
- `dict`: {'content': content, 'is_binary': bool, 'is_text': bool, 'content_type': str}

**Example:**
```python
from pycore.pyctl.document_offline.fetcher import HTTPFetcher
from pycore.pyctl.document_offline.core import FileMapper

mapper = FileMapper()
fetcher = HTTPFetcher(mapper, timeout=30000)
result = fetcher.fetch('https://example.com/page.html')

if result['is_text']:
    print(f"HTML length: {len(result['content'])}")
```

---

### BrowserFetcher

PyBrowser-based fetcher (JS execution).

**Import:**
```python
from pycore.pyctl.document_offline.fetcher import BrowserFetcher
```

#### Constructor

```python
fetcher = BrowserFetcher(browser_type='chrome', headless=True)
```

**Parameters:**
- `browser_type` (str): 'chrome', 'edge', or 'firefox'
- `headless` (bool): Run in headless mode

#### Methods

##### `initialize()`
Initialize browser instance.

**Example:**
```python
fetcher = BrowserFetcher('chrome', headless=True)
fetcher.initialize()
```

##### `fetch(url)`
Fetch URL using browser.

**Parameters:**
- `url` (str): URL to fetch

**Returns:**
- `dict`: {'content': html, 'is_binary': False, 'is_text': True}

**Example:**
```python
result = fetcher.fetch('https://example.com/spa')
print(f"Rendered HTML: {result['content']}")
```

##### `take_screenshot(url, output_path, options=None)`
Capture page screenshot.

**Parameters:**
- `url` (str): URL to capture
- `output_path` (str): Output file path
- `options` (dict): Screenshot options

**Options:**
- `full_page` (bool): Capture full page (default: True)
- `quality` (int): JPEG quality 0-100 (default: 80)

**Example:**
```python
fetcher.take_screenshot(
    'https://example.com',
    '/path/to/screenshot.jpg',
    {'full_page': True, 'quality': 90}
)
```

##### `collect_resources(options=None)`
Collect page resources.

**Parameters:**
- `options` (dict): Collection options

**Options:**
- `wait_for_network` (bool): Wait for network idle
- `wait_time` (int): Wait time in milliseconds
- `include_iframes` (bool): Include iframe resources
- `include_data_urls` (bool): Include data URLs

**Returns:**
- `dict`: Resource collection results

**Example:**
```python
resources = fetcher.collect_resources({
    'wait_for_network': True,
    'include_iframes': False
})
print(f"Total resources: {resources['stats']['total']}")
```

##### `cleanup()`
Cleanup browser instance.

**Example:**
```python
fetcher.cleanup()
```

---

### IframeFetcher

Specialized iframe content fetcher.

**Import:**
```python
from pycore.pyctl.document_offline.fetcher import IframeFetcher
```

#### Constructor

```python
fetcher = IframeFetcher(browser_type='chrome', headless=True)
```

#### Methods

##### `fetch_iframe_recursive(url, options, callbacks)`
Recursively fetch iframe content.

**Parameters:**
- `url` (str): Initial URL with iframes
- `options` (dict): Fetch options
- `callbacks` (dict): Callback functions

**Options:**
- `max_depth` (int): Maximum recursion depth (default: 10)
- `delay` (int): Delay between requests (ms)
- `max_links_per_page` (int): Max links to follow
- `same_origin_only` (bool): Only same-origin iframes
- `skip_hash_links` (bool): Skip hash-only links

**Callbacks:**
- `on_page_callback(page_data, total_processed, depth)`: Called for each page
- `on_failed_callback(failed_data)`: Called for failed pages

**Example:**
```python
fetcher = IframeFetcher('chrome')
fetcher.initialize()

def on_page(page_data, total, depth):
    print(f"Page {total} at depth {depth}: {page_data['url']}")

def on_failed(failed_data):
    print(f"Failed: {failed_data['url']} - {failed_data['error']}")

fetcher.fetch_iframe_recursive(
    'https://example.com/with-iframes',
    {
        'max_depth': 5,
        'delay': 1000,
        'same_origin_only': True
    },
    {
        'on_page_callback': on_page,
        'on_failed_callback': on_failed
    }
)
```

---

### TampermonkeyFetcher

Browser extension fetcher with WebSocket.

**Import:**
```python
from pycore.pyctl.document_offline.fetcher import TampermonkeyFetcher
```

#### Constructor

```python
fetcher = TampermonkeyFetcher(port=8765)
```

**Parameters:**
- `port` (int): WebSocket server port

#### Methods

##### `start_server()`
Start WebSocket server.

**Returns:**
- `dict`: Server info {'url': ws_url, 'port': port}

**Example:**
```python
fetcher = TampermonkeyFetcher()
server_info = fetcher.start_server()
print(f"WebSocket server: {server_info['url']}")
```

##### `send_config(config)`
Send configuration to browser.

**Parameters:**
- `config` (dict): Crawl configuration

**Config Keys:**
- `start_url` (str): Starting URL
- `max_depth` (int): Maximum depth
- `scope_type` (str): 'full' or 'path'
- `same_origin_only` (bool): Same-origin only
- `skip_hash_links` (bool): Skip hash links

**Example:**
```python
fetcher.send_config({
    'start_url': 'https://example.com',
    'max_depth': 3,
    'scope_type': 'full'
})
```

##### `send_command(command, data)`
Send command to browser.

**Parameters:**
- `command` (str): Command name
- `data` (dict): Command data

**Commands:**
- `focus-url` - Focus on URL
- `startPageCrawl` - Start crawling
- `stopCrawl` - Stop crawling

**Example:**
```python
fetcher.send_command('startPageCrawl', {
    'url': 'https://example.com',
    'maxDepth': 3
})
```

##### `wait_for_completion()`
Wait for crawl completion.

**Returns:**
- `dict`: Completion data

**Example:**
```python
result = fetcher.wait_for_completion()
print(f"Total pages: {result['total_pages']}")
print(f"Failed URLs: {len(result['failed_urls'])}")
```

##### `stop_server()`
Stop WebSocket server.

**Example:**
```python
fetcher.stop_server()
```

---

## Processor Module

### ResourceProcessor

Unified resource processing.

**Import:**
```python
from pycore.pyctl.document_offline.processor import ResourceProcessor
```

#### Constructor

```python
processor = ResourceProcessor(domain_context, file_mapper, max_workers=5)
```

**Parameters:**
- `domain_context` (DomainContext): Domain context
- `file_mapper` (FileMapper): File mapper
- `max_workers` (int): Max download threads

#### Methods

##### `process_page_resources(html, base_url, host_dir)`
Process all page resources.

**Parameters:**
- `html` (str): HTML content
- `base_url` (str): Page base URL
- `host_dir` (str): Host output directory

**Returns:**
- `dict`: {'html': rewritten_html, 'resources_processed': count, 'stats': stats}

**Example:**
```python
processor = ResourceProcessor(ctx, mapper)
result = processor.process_page_resources(
    html_content,
    'https://example.com/page',
    '/output/example.com'
)
print(f"Rewritten HTML saved, {result['resources_processed']} resources processed")
```

##### `extract_resources(html, base_url)`
Extract all resources from HTML.

**Parameters:**
- `html` (str): HTML content
- `base_url` (str): Base URL

**Returns:**
- `dict`: {'css': [...], 'js': [...], 'images': [...], 'fonts': [...], 'media': [...]}

##### `download_resources(resources, host_dir)`
Download resources in parallel.

**Parameters:**
- `resources` (dict): Resources dict from extract_resources
- `host_dir` (str): Output directory

**Returns:**
- `dict`: {'downloaded': count, 'skipped': count, 'failed': count}

---

### HTMLProcessor

HTML-specific processing.

**Import:**
```python
from pycore.pyctl.document_offline.processor import HTMLProcessor
```

#### Methods

##### `remove_script_tags(html)`
Remove all <script> tags.

**Parameters:**
- `html` (str): HTML content

**Returns:**
- `str`: HTML without script tags

**Example:**
```python
from pycore.pyctl.document_offline.processor import HTMLProcessor

processor = HTMLProcessor()
clean_html = processor.remove_script_tags(html_with_scripts)
```

##### `extract_links(html, base_url)`
Extract all anchor links.

**Parameters:**
- `html` (str): HTML content
- `base_url` (str): Base URL

**Returns:**
- `list`: List of absolute URLs

---

### CSSProcessor

CSS URL rewriting.

**Import:**
```python
from pycore.pyctl.document_offline.processor import CSSProcessor
```

#### Methods

##### `rewrite_css_urls(css, base_url, domain_context, file_mapper)`
Rewrite all URLs in CSS.

**Parameters:**
- `css` (str): CSS content
- `base_url` (str): CSS file base URL
- `domain_context` (DomainContext): Domain context
- `file_mapper` (FileMapper): File mapper

**Returns:**
- `str`: Rewritten CSS

**Example:**
```python
from pycore.pyctl.document_offline.processor import CSSProcessor

processor = CSSProcessor()
rewritten_css = processor.rewrite_css_urls(
    css_content,
    'https://example.com/styles/main.css',
    ctx,
    mapper
)
```

---

## Reporter Module

### SitemapGenerator

Generates XML sitemap.

**Import:**
```python
from pycore.pyctl.document_offline.reporter import SitemapGenerator
```

#### Constructor

```python
generator = SitemapGenerator()
```

#### Methods

##### `add_url(url, lastmod=None, changefreq='weekly', priority='0.5')`
Add URL to sitemap.

**Parameters:**
- `url` (str): URL
- `lastmod` (str or datetime): Last modification date
- `changefreq` (str): Change frequency
- `priority` (str): Priority

**Example:**
```python
from datetime import datetime

generator = SitemapGenerator()
generator.add_url('https://example.com/page1')
generator.add_url('https://example.com/page2', lastmod=datetime.now())
```

##### `save(output_path)`
Save sitemap to file.

**Parameters:**
- `output_path` (str): Output file path

**Example:**
```python
generator.save('/output/sitemap.xml')
```

##### `get_url_count()`
Get total URL count.

**Returns:**
- `int`: URL count

---

### MapsiteGenerator

Generates JSON mapsite.

**Import:**
```python
from pycore.pyctl.document_offline.reporter import MapsiteGenerator
```

#### Methods

##### `generate(urls, resource_stats, domain, screenshot_enabled=False)`
Generate mapsite JSON.

**Parameters:**
- `urls` (list): List of URL dicts
- `resource_stats` (dict): Resource statistics
- `domain` (str): Domain
- `screenshot_enabled` (bool): Whether screenshots are enabled

**Returns:**
- `dict`: Mapsite data

**Example:**
```python
generator = MapsiteGenerator()
mapsite = generator.generate(
    urls=[
        {'url': 'https://example.com/page1', 'local_path': 'page1/index.html'}
    ],
    resource_stats={'css': 10, 'js': 5, 'images': 20},
    domain='https://example.com'
)
```

##### `save(data, output_path)`
Save mapsite to file.

**Parameters:**
- `data` (dict): Mapsite data
- `output_path` (str): Output file path

---

### FailedUrlsReporter

Reports failed URLs.

**Import:**
```python
from pycore.pyctl.document_offline.reporter import FailedUrlsReporter
```

#### Methods

##### `generate_report(failed_urls, fetcher_mode)`
Generate failed URLs report.

**Parameters:**
- `failed_urls` (list): List of failed URL dicts
- `fetcher_mode` (str): Fetcher mode

**Returns:**
- `dict`: Report data

##### `save(data, output_path)`
Save report to file.

**Parameters:**
- `data` (dict): Report data
- `output_path` (str): Output file path

---

### ProgressTracker

Tracks and displays progress.

**Import:**
```python
from pycore.pyctl.document_offline.reporter import ProgressTracker
```

#### Constructor

```python
tracker = ProgressTracker()
```

#### Methods

##### `start(total)`
Start tracking.

**Parameters:**
- `total` (int): Total items

**Example:**
```python
tracker = ProgressTracker()
tracker.start(100)
```

##### `increment(count=1)`
Increment progress.

**Parameters:**
- `count` (int): Increment amount

**Example:**
```python
tracker.increment()  # +1
tracker.increment(5)  # +5
```

##### `complete()`
Mark as complete.

**Example:**
```python
tracker.complete()
```

---

## Configuration

### ConfigManager

Manages configuration loading and saving.

**Import:**
```python
from pycore.pyctl.document_offline.config import config_manager
```

#### Methods

##### `load_config(config_path=None)`
Load configuration.

**Parameters:**
- `config_path` (str, optional): Config file path

**Returns:**
- `dict`: Configuration

**Example:**
```python
config = config_manager.load_config()
print(f"Max depth: {config['limits']['max_depth']}")
```

##### `save_config(config, config_path=None)`
Save configuration.

**Parameters:**
- `config` (dict): Configuration to save
- `config_path` (str, optional): Config file path

##### `merge_config(base, override)`
Merge configurations.

**Parameters:**
- `base` (dict): Base configuration
- `override` (dict): Override configuration

**Returns:**
- `dict`: Merged configuration

### Default Configuration

See `config/default_config.py` for complete default configuration.

**Key Sections:**
- `download` - Download settings
- `parser` - Parser settings
- `file` - File settings
- `limits` - Limit settings
- `filters` - Filter patterns
