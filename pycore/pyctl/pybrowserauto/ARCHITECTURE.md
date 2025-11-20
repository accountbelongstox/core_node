# DocumentOffline Architecture Design

## Overview

DocumentOffline is a comprehensive web page offline downloader module built for pycore. It supports multiple fetching modes and provides powerful resource processing capabilities.

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    Public API Layer                          │
│              (offline_manager singleton)                     │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Controller Layer                           │
│         CrawlController  │  CLIController                    │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Processor Layer                            │
│  ResourceProcessor │ HTMLProcessor │ CSSProcessor           │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     Core Layer                               │
│  DomainContext │ URLQueue │ FileMapper │ URLRewriter        │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Foundation Layer (PyBrowser)                │
│  PyBrowser.fetchers (HTTP, Browser, Iframe, Tampermonkey)   │
│         ColorPrint │ THREAD_BUS │ Threading                  │
└─────────────────────────────────────────────────────────────┘
```

**Important Architecture Note:**
Fetcher functionality has been integrated into PyBrowser core library (`pycore/pyutils/pybrowser/fetchers/`).
DocumentOffline uses PyBrowser fetchers directly instead of implementing its own fetchers.

## Directory Structure

```
pycore/pyctl/document_offline/
├── __init__.py                          # Export offline_manager
├── offline_manager.py                   # Main manager (public interface)
│
├── config/                              # Configuration management
│   ├── __init__.py
│   ├── default_config.py               # Default configuration
│   └── config_manager.py               # Config loader/saver
│
├── core/                                # Core functionality
│   ├── __init__.py
│   ├── domain_context.py               # Domain context (URL validation)
│   ├── file_mapper.py                  # URL to file path mapping
│   ├── url_queue.py                    # URL queue management
│   ├── url_rewriter.py                 # URL rewriting
│   └── backup_manager.py               # Backup management
│
├── processor/                           # Processors
│   ├── __init__.py
│   ├── resource_processor.py           # Resource processing
│   ├── html_processor.py               # HTML processing
│   └── css_processor.py                # CSS URL rewriting
│
├── reporter/                            # Report generation
│   ├── __init__.py
│   ├── sitemap_generator.py            # Sitemap XML generator
│   ├── mapsite_generator.py            # Mapsite JSON generator
│   ├── failed_urls_reporter.py         # Failed URLs reporter
│   └── progress_tracker.py             # Progress tracking
│
└── controller/                          # Controllers
    ├── __init__.py
    ├── crawl_controller.py             # Main crawl controller
    └── cli_controller.py               # CLI argument parser

# Fetchers are located in PyBrowser (external dependency):
pycore/pyutils/pybrowser/fetchers/
├── __init__.py                          # Export all fetchers
├── base_fetcher.py                     # Base fetcher class
├── http_fetcher.py                     # HTTP mode (requests)
├── browser_fetcher.py                  # Browser mode (Selenium)
├── iframe_fetcher.py                   # Iframe recursive mode
└── tampermonkey_fetcher.py             # Tampermonkey WebSocket mode
```

## Component Details

### 1. Core Components

#### DomainContext
Manages URL validation and scope checking.

**Key Methods:**
- `canonicalize(url)` - Normalize URLs (remove fragments, trailing slashes)
- `is_internal_link(url)` - Check if URL is same-origin
- `is_within_scope(url)` - Check if URL is within path scope
- `resolve_href(base, href)` - Resolve relative URLs
- `get_origin()` - Get base origin (protocol + hostname)
- `get_scope_url()` - Get scope root URL

**Scope Modes:**
- `full` - Download entire domain
- `path` - Download only URLs under specific path

#### URLQueue
Thread-safe URL queue with deduplication.

**Features:**
- Depth tracking for each URL
- Processed URLs tracking (Set-based)
- Auto-deduplication (fragment removal)
- Requeue support for failed downloads

**Key Methods:**
- `enqueue(url, depth)` - Add URL to queue
- `dequeue()` - Get next URL
- `mark_processed(url)` - Mark as processed
- `has_processed(url)` - Check if already processed

#### FileMapper
Maps URLs to local file paths.

**Features:**
- Handles 30+ file extensions
- Auto-adds `index.html` for directories
- Preserves URL structure in local filesystem
- Cross-platform path handling

**Example:**
```
https://example.com/docs/api.html  →  docs/api.html
https://example.com/docs/          →  docs/index.html
https://example.com/img/logo.png   →  img/logo.png
```

### 2. Fetcher Layer (PyBrowser Integration)

**Important:** All fetchers are implemented in `pycore/pyutils/pybrowser/fetchers/`.
DocumentOffline imports and uses them directly.

**Import Pattern:**
```python
from pycore.pyutils.pybrowser.fetchers import (
    HTTPFetcher, BrowserFetcher, IframeFetcher, TampermonkeyFetcher
)
```

#### BaseFetcher (Abstract)
Base class for all fetchers located in `pycore/pyutils/pybrowser/fetchers/base_fetcher.py`.

**Interface:**
```python
class BaseFetcher:
    def initialize(self, options: Dict[str, Any] = None) -> bool
    def fetch(self, url: str, options: Dict[str, Any] = None) -> FetchResult
    def cleanup(self) -> bool
    def get_info(self) -> Dict[str, Any]
```

#### HTTPFetcher
Fastest mode, gets source HTML without JS execution.
**Location:** `pycore/pyutils/pybrowser/fetchers/http_fetcher.py`

**Technology:**
- Uses `requests` library (lazy-loaded via `get_third_package_requests()`)
- Synchronous HTTP requests
- No try-except blocks (follows pycore guidelines)
- ColorPrint for logging

**Features:**
- Session-based requests (cookie persistence)
- Custom headers support
- Timeout configuration
- Content-Type detection
- HTTP/HTTPS support

**Use Cases:**
- Static websites
- Documentation sites
- Blogs

#### BrowserFetcher
Uses PyBrowser SpiderEngine for JS execution and rendered content.
**Location:** `pycore/pyutils/pybrowser/fetchers/browser_fetcher.py`

**Technology:**
- PyBrowser SpiderEngine
- ThreadedBrowser pattern (threading.Thread-based)
- Session management
- No async/await (follows pycore guidelines)

**Features:**
- JS execution
- Browser automation (Edge/Chrome/Firefox)
- Headless mode support
- Custom viewport configuration
- Wait strategies (networkidle, domcontentloaded)

**Use Cases:**
- Single Page Applications (SPA)
- Dynamic content
- JS-rendered pages

#### IframeFetcher
Specialized for recursive iframe content extraction.
**Location:** `pycore/pyutils/pybrowser/fetchers/iframe_fetcher.py`

**Technology:**
- PyBrowser SpiderEngine with Session management
- Synchronous link clicking and navigation
- Same-origin-only mode for security
- Depth tracking and URL normalization

**Features:**
- Recursive iframe link traversal (configurable max depth)
- Click links inside iframes
- Auto-detect iframe origin
- Page callback on each capture
- Failed URL tracking
- Browser back navigation between pages

**Flow:**
```
1. Navigate to page and wait for load
2. Get all <a> links on page
3. For each link:
   a. Filter by same-origin (optional)
   b. Click link and wait for navigation
   c. Capture page content
   d. Recursively process new page (depth + 1)
   e. Navigate back
4. Return all captured pages
```

**Use Cases:**
- Sites with nested iframe documentation
- Multi-frame applications
- Complex nested content structures

#### TampermonkeyFetcher
WebSocket-based fetcher for browser extension integration.
**Location:** `pycore/pyutils/pybrowser/fetchers/tampermonkey_fetcher.py`

**Technology:**
- HTTP server (threading.Thread-based)
- WebSocket-like communication via HTTP POST
- Event-driven architecture (page/complete/error events)
- No async/await (follows pycore guidelines)

**Architecture:**
```
Python Process           Browser (with Tampermonkey Extension)
    │                              │
    ├─ Start HTTP Server           │
    │  (port 8765)                 │
    │                              │
    │<──── POST /page ──────────────┤ (Send page data)
    │                              │
    ├─ Store page data             ├─ Navigate pages
    │                              ├─ Extract content
    │                              │
    │<──── POST /page ──────────────┤
    │                              │
    │<──── POST /complete ──────────┤ (Crawl finished)
    │                              │
    ├─ Signal completion           │
    │                              │
    └─ Stop WS Server              │
```

**Components:**
1. **HTTP Server** (Python, default port 8765)
   - Threading.Thread-based HTTP server
   - REST endpoints: GET /status, GET /ping, POST /page, POST /complete
   - CORS enabled for browser access
   - Event callback system (page/complete/error)
   - Located in `pycore/pyutils/pybrowser/utils/tampermonkey/tampermonkey_server.py`

2. **Tampermonkey Userscript** (JavaScript)
   - Runs in logged-in browser session
   - Navigates pages automatically
   - Extracts and sends rendered HTML via HTTP POST
   - User provides custom script or uses template

**Features:**
- Wait for completion with timeout
- Collect all received pages
- Statistics tracking (total pages, bytes)
- Threading.Event for synchronization
- No async/await (synchronous callbacks)

**HTTP Endpoints:**
- `GET /status` - Get server status and statistics
- `GET /ping` - Health check
- `POST /page` - Receive page data from userscript
- `POST /complete` - Receive completion signal

**Use Cases:**
- Sites requiring authentication/login
- Logged-in user content
- Protected documentation
- Session-based content

### 3. Processor Layer

#### ResourceProcessor
Unified resource processing (extract → download → rewrite).

**Pipeline:**
```
HTML Input
    ↓
Extract Resources
    ├─ CSS files
    ├─ JS files
    ├─ Images
    ├─ Fonts
    └─ Media
    ↓
Download Resources (Threading)
    ├─ Internal resources
    └─ External resources
    ↓
Rewrite URLs
    ├─ HTML attributes (src, href)
    ├─ Inline styles (background-image)
    └─ CSS @import, url()
    ↓
HTML Output
```

**Resource Types:**
- CSS files (`<link>`, `@import`)
- JS files (`<script>`)
- Images (`<img>`, `background-image`)
- Fonts (`@font-face`)
- Media (`<video>`, `<audio>`)

#### HTMLProcessor
HTML-specific processing.

**Features:**
- Remove `<script>` tags (optional)
- Extract all anchor links
- Parse inline styles
- Handle base64 data URLs

#### CSSProcessor
CSS URL rewriting.

**Patterns:**
- `url("image.png")` → `url("../images/image.png")`
- `@import "style.css"` → `@import "../css/style.css"`
- Preserves relative paths
- Handles absolute URLs

### 4. Reporter Layer

#### SitemapGenerator
Generates XML sitemap.

**Format:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/page</loc>
    <lastmod>2025-11-17</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>
</urlset>
```

#### MapsiteGenerator
Generates JSON mapsite with metadata.

**Structure:**
```json
{
  "timestamp": "2025-11-17T10:00:00Z",
  "domain": "https://example.com",
  "totalUrls": 100,
  "resourceStats": {
    "css": 20,
    "js": 15,
    "images": 50,
    "fonts": 10,
    "media": 5
  },
  "screenshotEnabled": true,
  "urls": [
    {
      "url": "https://example.com/page",
      "localPath": "page/index.html",
      "fetchedAt": "2025-11-17T10:05:00Z",
      "screenshot": "page|index.jpg"
    }
  ]
}
```

#### FailedUrlsReporter
Reports failed URLs with error details.

**Structure:**
```json
{
  "timestamp": "2025-11-17T10:00:00Z",
  "totalFailed": 5,
  "fetcherMode": "browser",
  "failedUrls": [
    {
      "url": "https://example.com/broken",
      "linkText": "Broken Link",
      "error": "404 Not Found",
      "depth": 2,
      "timestamp": "2025-11-17T10:03:00Z",
      "mode": "browser"
    }
  ]
}
```

### 5. Server Layer (Tampermonkey Support)

#### WebSocketServer
WebSocket server for browser communication.

**Architecture:**
```python
class WebSocketServer(threading.Thread):
    """WebSocket server thread"""

    def __init__(self, port=8765):
        threading.Thread.__init__(self)
        self.port = port
        self.clients = []

    def run(self):
        # Start WebSocket server
        # Use websockets library
        pass

    def broadcast_config(self, config):
        """Broadcast config to all clients"""
        # Send via WebSocket
        pass

    def send_command(self, command, data):
        """Send command to browser"""
        # Command types: focus-url, startPageCrawl, stopCrawl
        pass
```

**Event Flow:**
```
Server Thread  →  THREAD_BUS.publish('document_offline.page_received', data)
                 THREAD_BUS.publish('document_offline.crawl_complete', stats)
                 THREAD_BUS.publish('document_offline.crawl_error', error)
```

## Threading Model

### Thread Architecture

```
Main Thread
    │
    ├─ CrawlController
    │   ├─ URLQueue (thread-safe)
    │   └─ ProcessingLoop
    │
    ├─ PyBrowser Thread (if browser mode)
    │   └─ ThreadedBrowser.run()
    │
    ├─ WebSocket Server Thread (if tampermonkey mode)
    │   └─ WebSocketServer.run()
    │
    └─ Download Threads Pool
        ├─ Resource Download Thread 1
        ├─ Resource Download Thread 2
        └─ Resource Download Thread N
```

### Thread Communication

**THREAD_BUS Events:**
```python
# Register keys
document_offline.page_received
document_offline.crawl_complete
document_offline.crawl_error
document_offline.resource_downloaded
document_offline.progress_update
```

**Example:**
```python
from pycore.pyfoundations.thread_bus import THREAD_BUS

# Publisher (WebSocket Server)
THREAD_BUS.publish('document_offline.page_received', {
    'url': url,
    'content': html,
    'depth': 2
})

# Subscriber (Crawl Controller)
def on_page_received(data):
    url = data['url']
    content = data['content']
    # Process page

THREAD_BUS.subscribe('document_offline.page_received', on_page_received)
```

## Configuration System

### Default Configuration

```python
DEFAULT_CONFIG = {
    'debug': False,
    'download': {
        'timeout': 30000,           # Request timeout (ms)
        'max_retries': 3,           # Max retry attempts
        'max_redirects': 5,         # Max redirects
        'user_agent': 'Mozilla/5.0...',
        'delay': 1000,              # Delay between requests (ms)
        'retry_delay': 2000,        # Retry delay (ms)
        'retry_backoff': 2,         # Backoff multiplier
        'download_resources': True  # Download resources
    },
    'parser': {
        'ignored_extensions': ['.exe', '.dmg', '.pkg', '.deb', '.rpm'],
        'max_links_per_page': 1000,
        'extract_resources': True,
        'resource_types': {
            'css': True,
            'js': True,
            'images': True,
            'fonts': True,
            'media': False
        }
    },
    'file': {
        'cache_dir': 'cache',
        'max_file_size': 50 * 1024 * 1024,  # 50MB
        'encoding': 'utf-8'
    },
    'limits': {
        'max_depth': 3,
        'max_pages': 10000,
        'max_concurrent': 5,
        'max_queue_size': 50000
    },
    'filters': {
        'exclude_patterns': ['/admin/', '/login', '/logout', '/api/', '/oauth/', '/auth/'],
        'include_patterns': []
    }
}
```

### Configuration Loading

```python
from pycore.pyctl.document_offline.config import config_manager

# Load config
config = config_manager.load_config()

# Merge with user config
config = config_manager.merge_config(DEFAULT_CONFIG, user_config)

# Save config
config_manager.save_config(config)
```

## Error Handling

### Error Strategy

**NO try-except blocks** (per pycore guidelines)

Instead, use:
1. **Conditional checks**
   ```python
   if not url:
       ColorPrint.red("URL is required")
       return None
   ```

2. **Return error status**
   ```python
   def fetch(url):
       if not url:
           return {'success': False, 'error': 'URL is required'}
       # ...
       return {'success': True, 'content': html}
   ```

3. **ColorPrint for errors**
   ```python
   ColorPrint.red(f"Failed to download {url}")
   ```

4. **Let errors propagate**
   - Natural error propagation
   - Easier debugging
   - Clear error messages

### Retry Logic

```python
def download_with_retry(url, max_retries=3):
    """Download with exponential backoff"""
    for attempt in range(1, max_retries + 1):
        result = download(url)
        if result['success']:
            return result

        if attempt < max_retries:
            delay = RETRY_DELAY * (RETRY_BACKOFF ** (attempt - 1))
            ColorPrint.warn(f"Retry {attempt}/{max_retries} after {delay}ms")
            time.sleep(delay / 1000)

    ColorPrint.red(f"Failed after {max_retries} attempts")
    return {'success': False, 'error': 'Max retries exceeded'}
```

## Performance Optimization

### 1. Threading Strategy

**Resource Downloads:**
```python
import threading
from concurrent.futures import ThreadPoolExecutor

def download_resources(resources, max_workers=5):
    """Download resources in parallel"""
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(download_resource, res) for res in resources]
        results = [f.result() for f in futures]
    return results
```

### 2. Caching Strategy

**URL Deduplication:**
```python
class URLQueue:
    def __init__(self):
        self.processed = set()  # Fast O(1) lookup

    def has_processed(self, url):
        return url in self.processed
```

**Resource Mapping:**
```python
class ResourceProcessor:
    def __init__(self):
        self.resource_map = {
            'css': set(),
            'js': set(),
            'images': set()
        }  # Set-based deduplication
```

### 3. Memory Management

**Stream Large Files:**
```python
def download_large_file(url, dest):
    """Stream download for large files"""
    response = requests.get(url, stream=True)
    with open(dest, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            if chunk:
                f.write(chunk)
```

**Limit Queue Size:**
```python
MAX_QUEUE_SIZE = 50000

def enqueue(url, depth):
    if len(self.pending) >= MAX_QUEUE_SIZE:
        ColorPrint.warn("Queue size limit reached")
        return False
    # ...
```

## Testing Strategy

### Unit Tests
```python
# tests/test_domain_context.py
def test_canonicalize():
    ctx = DomainContext('https://example.com/path/')
    assert ctx.canonicalize('https://example.com/path') == 'https://example.com/path'
    assert ctx.canonicalize('https://example.com/path#hash') == 'https://example.com/path'

# tests/test_file_mapper.py
def test_map_path():
    mapper = FileMapper()
    assert mapper.map_path('https://example.com/docs/api.html') == 'docs/api.html'
    assert mapper.map_path('https://example.com/docs/') == 'docs/index.html'
```

### Integration Tests
```python
# tests/test_crawl_controller.py
def test_full_crawl():
    controller = CrawlController()
    result = controller.start(['https://example.com', '2', '--fetcher=http'])
    assert result['success'] == True
    assert result['downloaded'] > 0
```

## Migration from Node.js

See MIGRATION_NOTES.md for detailed comparison.

**Key Differences:**
- `async/await` → `threading.Thread`
- `Promise` → `THREAD_BUS` events
- `EventEmitter` → `THREAD_BUS.publish/subscribe`
- `require()` → `from pycore.pyctl.document_offline import ...`

## Future Enhancements

1. **Database Integration**
   - Store crawl history in SQLite
   - Track URL changes over time
   - Deduplicate content

2. **Incremental Updates**
   - Only download changed pages
   - Compare checksums
   - Update timestamps

3. **Search Functionality**
   - Full-text search
   - Indexing with Whoosh
   - Search API

4. **Export Formats**
   - PDF export
   - EPUB export
   - Archive formats

5. **Plugin System**
   - Custom fetchers
   - Custom processors
   - Custom reporters
