# Migration Notes: Node.js to Python

Complete reference for migrating DocumentOffline from Node.js to Python.

---

## Language Feature Mapping

### Async/Await → Threading

**Node.js (async/await):**
```javascript
async function fetchPage(url) {
    const result = await downloader.HTTPDownload(url);
    return result;
}

await fetchPage('https://example.com');
```

**Python (threading):**
```python
import threading

class FetcherThread(threading.Thread):
    def __init__(self, url):
        threading.Thread.__init__(self)
        self.url = url
        self.result = None

    def run(self):
        self.result = download_http(self.url)

thread = FetcherThread('https://example.com')
thread.start()
thread.join()
result = thread.result
```

### Promises → THREAD_BUS Events

**Node.js (EventEmitter):**
```javascript
const EventEmitter = require('events');
const emitter = new EventEmitter();

emitter.on('page_downloaded', (data) => {
    console.log(`Downloaded: ${data.url}`);
});

emitter.emit('page_downloaded', { url: 'https://example.com' });
```

**Python (THREAD_BUS):**
```python
from pycore.pyfoundations.thread_bus import THREAD_BUS

def on_page_downloaded(data):
    ColorPrint.success(f"Downloaded: {data['url']}")

THREAD_BUS.subscribe('document_offline.page_downloaded', on_page_downloaded)
THREAD_BUS.publish('document_offline.page_downloaded', {'url': 'https://example.com'})
```

### Module Imports

**Node.js (require/import):**
```javascript
const DomainContext = require('./libs/domain_context.js');
const PageFetcher = require('./services/page_fetcher.js');
```

**Python (import):**
```python
from pycore.pyctl.document_offline.core import DomainContext
from pycore.pyctl.document_offline.fetcher import HTTPFetcher
```

---

## Module Mapping

### Core Modules

| Node.js | Python | Notes |
|---------|--------|-------|
| `libs/domain_context.js` | `core/domain_context.py` | URL validation |
| `libs/url_queue.js` | `core/url_queue.py` | Queue management |
| `libs/file_mapper.js` | `core/file_mapper.py` | File path mapping |
| `services/url_rewriter.js` | `core/url_rewriter.py` | URL rewriting |
| `libs/backup_manager.js` | `core/backup_manager.py` | Backup management |

### Fetchers

| Node.js | Python | Notes |
|---------|--------|-------|
| `services/page_fetcher.js` | `fetcher/http_fetcher.py` | HTTP mode |
| `PuppeteerSpiderModule.Fetcher` | `fetcher/browser_fetcher.py` | Browser mode |
| `fetcher.fetchIframeContentRecursive()` | `fetcher/iframe_fetcher.py` | Iframe mode |
| `TampermonkeyServer` | `server/websocket_server.py` | Tampermonkey mode |

### Processors

| Node.js | Python | Notes |
|---------|--------|-------|
| `UnifiedResourceProcessor` | `processor/resource_processor.py` | Resource processing |
| N/A | `processor/html_processor.py` | HTML processing |
| N/A | `processor/css_processor.py` | CSS processing |

### Reporters

| Node.js | Python | Notes |
|---------|--------|-------|
| `services/sitemap_generator.js` | `reporter/sitemap_generator.py` | Sitemap XML |
| N/A | `reporter/mapsite_generator.py` | Mapsite JSON |
| N/A | `reporter/failed_urls_reporter.py` | Failed URLs |
| `utils/progress.js` | `reporter/progress_tracker.py` | Progress tracking |

---

## Class/Function Comparison

### DomainContext

**Node.js:**
```javascript
class DomainContext {
    constructor(startUrl) {
        this.startUrl = startUrl;
        this.parsedUrl = new URL(startUrl);
        this.origin = `${this.parsedUrl.protocol}//${this.parsedUrl.hostname}`;
    }

    canonicalize(url) {
        return url.split('#')[0].replace(/\/$/, '');
    }

    isInternalLink(url) {
        const parsed = new URL(url);
        return `${parsed.protocol}//${parsed.hostname}` === this.origin;
    }
}
```

**Python:**
```python
from urllib.parse import urlparse

class DomainContext:
    def __init__(self, start_url):
        self.start_url = start_url
        self.parsed = urlparse(start_url)
        self.origin = f"{self.parsed.scheme}://{self.parsed.hostname}"

    def canonicalize(self, url):
        return url.split('#')[0].rstrip('/')

    def is_internal_link(self, url):
        parsed = urlparse(url)
        return f"{parsed.scheme}://{parsed.hostname}" == self.origin
```

### URLQueue

**Node.js:**
```javascript
class UrlQueue {
    constructor() {
        this.pending = [];
        this.processed = new Set();
    }

    enqueue(url, depth) {
        if (this.processed.has(url)) return;
        this.pending.push({ url, depth });
    }

    dequeue() {
        return this.pending.shift();
    }

    markProcessed(url) {
        this.processed.add(url);
    }
}
```

**Python:**
```python
import threading

class URLQueue:
    def __init__(self):
        self.pending = []
        self.processed = set()
        self.lock = threading.Lock()

    def enqueue(self, url, depth):
        with self.lock:
            if url in self.processed:
                return
            self.pending.append({'url': url, 'depth': depth})

    def dequeue(self):
        with self.lock:
            if not self.pending:
                return None
            return self.pending.pop(0)

    def mark_processed(self, url):
        with self.lock:
            self.processed.add(url)
```

### FileMapper

**Node.js:**
```javascript
class FileMapper {
    constructor(supportedExtensions) {
        this.supportedExtensions = supportedExtensions;
    }

    mapPath(parsedUrl) {
        let path = parsedUrl.pathname.slice(1);
        if (!path || path === '') return 'index.html';
        if (path.endsWith('/')) return `${path}index.html`;

        const ext = require('path').extname(path);
        if (!ext || !this.supportedExtensions.has(ext)) {
            return `${path}/index.html`;
        }
        return path;
    }
}
```

**Python:**
```python
import os

class FileMapper:
    def __init__(self, supported_extensions):
        self.supported_extensions = supported_extensions

    def map_path(self, url_or_parsed):
        if isinstance(url_or_parsed, str):
            from urllib.parse import urlparse
            parsed = urlparse(url_or_parsed)
        else:
            parsed = url_or_parsed

        path = parsed.path.lstrip('/')
        if not path:
            return 'index.html'
        if path.endswith('/'):
            return f"{path}index.html"

        ext = os.path.splitext(path)[1]
        if not ext or ext not in self.supported_extensions:
            return f"{path}/index.html"
        return path
```

---

## HTTP Requests

### Downloading Files

**Node.js (downloader.HTTPDownload):**
```javascript
const downloader = require('#@downloader');

const filePath = await downloader.HTTPDownload(url, tempFile, {
    onProgress: (received, total) => {
        console.log(`${received}/${total}`);
    },
    onHeaders: (headers) => {
        const contentType = headers['content-type'];
    }
});
```

**Python (requests):**
```python
from pycore.pyfoundations.third_party import get_third_package_requests

requests = get_third_package_requests()

response = requests.get(url, stream=True)
content_type = response.headers.get('Content-Type')

with open(temp_file, 'wb') as f:
    for chunk in response.iter_content(chunk_size=8192):
        if chunk:
            f.write(chunk)
```

---

## HTML Parsing

### Extracting Resources

**Node.js (jsdom/cheerio):**
```javascript
const cheerio = require('cheerio');

const $ = cheerio.load(html);
const cssFiles = [];
$('link[rel="stylesheet"]').each((i, el) => {
    const href = $(el).attr('href');
    if (href) cssFiles.push(href);
});
```

**Python (BeautifulSoup):**
```python
from pycore.pyfoundations.third_party import get_third_package_beautifulsoup4

bs4 = get_third_package_beautifulsoup4()
soup = bs4.BeautifulSoup(html, 'html.parser')

css_files = []
for link in soup.find_all('link', rel='stylesheet'):
    href = link.get('href')
    if href:
        css_files.append(href)
```

### URL Resolution

**Node.js:**
```javascript
const url = require('url');

const absoluteUrl = url.resolve(baseUrl, relativeUrl);
```

**Python:**
```python
from urllib.parse import urljoin

absolute_url = urljoin(base_url, relative_url)
```

---

## File System Operations

### Creating Directories

**Node.js:**
```javascript
const fs = require('fs');
const path = require('path');

const dir = path.dirname(filePath);
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}
```

**Python:**
```python
import os

dir = os.path.dirname(file_path)
os.makedirs(dir, exist_ok=True)
```

### Reading/Writing Files

**Node.js:**
```javascript
const fs = require('fs');

// Read text
const content = await fs.promises.readFile(filePath, 'utf8');

// Write text
await fs.promises.writeFile(filePath, content, 'utf8');

// Read binary
const buffer = await fs.promises.readFile(filePath);

// Write binary
await fs.promises.writeFile(filePath, buffer);
```

**Python:**
```python
# Read text
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Write text
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

# Read binary
with open(file_path, 'rb') as f:
    data = f.read()

# Write binary
with open(file_path, 'wb') as f:
    f.write(data)
```

---

## Browser Automation

### Puppeteer → PyBrowser

**Node.js (Puppeteer):**
```javascript
const PuppeteerSpiderModule = require('#@puppeteer');

const fetcher = new PuppeteerSpiderModule.Fetcher();
await fetcher.initialize('edge', { headless: false });
const result = await fetcher.fetch(url);
const html = result.content;
await fetcher.cleanup();
```

**Python (PyBrowser):**
```python
from pycore.pyutils.pybrowser import BrowserFactory

browser = BrowserFactory.create('chrome', auto_start=True)
browser.wait_until_ready()
page = browser.new_page()
page.goto(url)
html = page.get_content()
browser.close()
```

### Screenshot

**Node.js:**
```javascript
await fetcher.takeScreenshot(screenshotPath, {
    fullPage: true,
    quality: 80
});
```

**Python:**
```python
page.screenshot(screenshot_path, options={
    'full_page': True,
    'quality': 80
})
```

### Resource Collection

**Node.js:**
```javascript
const resources = await fetcher.collectResources({
    waitForNetwork: true,
    waitTime: 1000,
    includeIframes: false
});
```

**Python:**
```python
# Using ContentPlugin
from pycore.pyutils.pybrowser import ContentPlugin

content_plugin = ContentPlugin()
content_plugin.initialize(session)
resources = content_plugin.extract_all(page)
```

---

## Iframe Recursive Fetching

### Node.js

**Node.js (Puppeteer):**
```javascript
const result = await fetcher.fetchIframeContentRecursive(url, {
    maxDepth: 10,
    delay: 1000,
    sameOriginOnly: true,
    onPageCallback: async (pageResult, totalProcessed, depth) => {
        await savePage(pageResult.url, pageResult.content);
    },
    onFailedCallback: async (failedResult) => {
        console.error(`Failed: ${failedResult.targetUrl}`);
    }
});
```

**Python (IframeFetcher):**
```python
from pycore.pyctl.document_offline.fetcher import IframeFetcher

fetcher = IframeFetcher('chrome')
fetcher.initialize()

def on_page(page_data, total, depth):
    save_page(page_data['url'], page_data['content'])

def on_failed(failed_data):
    ColorPrint.red(f"Failed: {failed_data['url']}")

fetcher.fetch_iframe_recursive(
    url,
    {
        'max_depth': 10,
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

## Tampermonkey WebSocket Server

### Node.js

**Node.js (TampermonkeyServer):**
```javascript
const TampermonkeyServer = require('#@ncore/utils/puppeteer_spider_v2/src/utils/tampermonkey/TampermonkeyServer.js');

const server = TampermonkeyServer.getInstance();
await server.ensureStarted();

server.on('page', (pageData) => {
    console.log(`Received page: ${pageData.url}`);
});

server.on('complete', (payload) => {
    console.log(`Completed: ${payload.totalPages} pages`);
});

server.broadcastConfig({
    startUrl: url,
    maxDepth: 3,
    scopeType: 'full'
});

server.sendCommand('startPageCrawl', { url, maxDepth: 3 });
```

**Python (WebSocketServer):**
```python
from pycore.pyctl.document_offline.server import WebSocketServer
from pycore.pyfoundations.thread_bus import THREAD_BUS

# Start server
server = WebSocketServer(port=8765)
server.start()

# Subscribe to events
def on_page_received(data):
    ColorPrint.info(f"Received page: {data['url']}")

def on_complete(data):
    ColorPrint.success(f"Completed: {data['total_pages']} pages")

THREAD_BUS.subscribe('document_offline.page_received', on_page_received)
THREAD_BUS.subscribe('document_offline.crawl_complete', on_complete)

# Send config
server.broadcast_config({
    'start_url': url,
    'max_depth': 3,
    'scope_type': 'full'
})

# Send command
server.send_command('startPageCrawl', {'url': url, 'maxDepth': 3})

# Wait for completion
# (handled by THREAD_BUS events)
```

---

## Configuration Management

### Node.js

**Node.js (config/index.js):**
```javascript
const path = require('path');
const freader = require('#@freader');
const fwriter = require('#@fwriter');

async function loadConfig() {
    const configPath = path.join(__dirname, 'config.json');
    if (fs.existsSync(configPath)) {
        const data = await freader.readText(configPath);
        return JSON.parse(data);
    }
    return defaultConfig;
}
```

**Python (config/config_manager.py):**
```python
import os
import json
from pathlib import Path

def load_config(config_path=None):
    if not config_path:
        config_path = Path(__file__).parent / 'config.json'

    if os.path.exists(config_path):
        with open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)

    return default_config
```

---

## Progress Tracking

### Node.js

**Node.js (ProgressTracker):**
```javascript
class ProgressTracker {
    start(total) {
        this.total = total;
        this.current = 0;
    }

    increment() {
        this.current++;
        process.stdout.write(`\rProgress: ${this.current}/${this.total}`);
    }
}
```

**Python (ProgressTracker):**
```python
import sys

class ProgressTracker:
    def start(self, total):
        self.total = total
        self.current = 0

    def increment(self):
        self.current += 1
        sys.stdout.write(f"\rProgress: {self.current}/{self.total}")
        sys.stdout.flush()
```

---

## Error Handling

### Node.js (try/catch)

**Node.js:**
```javascript
try {
    const result = await fetcher.fetch(url);
    return result;
} catch (error) {
    logger.error(`Failed to fetch ${url}: ${error.message}`);
    throw error;
}
```

### Python (NO try/except per pycore guidelines)

**Python:**
```python
# ❌ Do NOT use try/except
# try:
#     result = fetcher.fetch(url)
# except Exception as e:
#     ColorPrint.red(f"Error: {e}")

# ✅ Use conditional checks
result = fetcher.fetch(url)
if not result or not result.get('success'):
    ColorPrint.red(f"Failed to fetch {url}")
    return None
```

---

## Logging

### Node.js (logger)

**Node.js:**
```javascript
const logger = require('#@logger');

logger.info('Processing...');
logger.success('Completed');
logger.warn('Warning');
logger.error('Error occurred');
```

**Python (ColorPrint):**
```python
from pycore.pyfoundations.color_print import ColorPrint

ColorPrint.info('Processing...')
ColorPrint.success('Completed')
ColorPrint.warn('Warning')
ColorPrint.red('Error occurred')
```

---

## Summary Table

| Feature | Node.js | Python |
|---------|---------|--------|
| **Async** | `async/await` | `threading.Thread` |
| **Events** | `EventEmitter` | `THREAD_BUS` |
| **HTTP** | `downloader`, `axios` | `requests` |
| **HTML Parse** | `jsdom`, `cheerio` | `beautifulsoup4` |
| **Browser** | `Puppeteer` | `PyBrowser (Selenium)` |
| **File I/O** | `fs.promises` | `open()`, `os`, `pathlib` |
| **JSON** | `JSON.parse/stringify` | `json.load/dump` |
| **URL Parse** | `new URL()`, `url.resolve` | `urlparse`, `urljoin` |
| **Logging** | `logger` | `ColorPrint` |
| **Config** | `freader/fwriter` | `json`, `open()` |

---

## Migration Checklist

- [ ] Replace `async/await` with `threading.Thread`
- [ ] Replace `EventEmitter` with `THREAD_BUS`
- [ ] Replace `require()` with `from ... import ...`
- [ ] Replace `downloader.HTTPDownload` with `requests`
- [ ] Replace `cheerio` with `BeautifulSoup`
- [ ] Replace `Puppeteer` with `PyBrowser`
- [ ] Replace `logger` with `ColorPrint`
- [ ] Remove all `try/except` blocks
- [ ] Add `threading.Lock` for shared state
- [ ] Update file paths (forward slashes → os.path)
- [ ] Register third-party packages in `third_party.py`
- [ ] Use lazy loading for third-party packages
- [ ] Follow pycore import order
- [ ] Use `ColorPrint` for all output
- [ ] Use `THREAD_BUS` for inter-thread communication

---

## Common Pitfalls

### 1. Forgetting Thread Safety

**❌ Bad:**
```python
class URLQueue:
    def __init__(self):
        self.pending = []  # Not thread-safe!

    def enqueue(self, url):
        self.pending.append(url)  # Race condition!
```

**✅ Good:**
```python
import threading

class URLQueue:
    def __init__(self):
        self.pending = []
        self.lock = threading.Lock()

    def enqueue(self, url):
        with self.lock:
            self.pending.append(url)
```

### 2. Using try/except

**❌ Bad:**
```python
try:
    result = download(url)
except Exception as e:
    print(f"Error: {e}")
```

**✅ Good:**
```python
result = download(url)
if not result.get('success'):
    ColorPrint.red(f"Failed: {result.get('error')}")
```

### 3. Direct Third-Party Imports

**❌ Bad:**
```python
import requests  # Direct import
```

**✅ Good:**
```python
from pycore.pyfoundations.third_party import get_third_package_requests
requests = get_third_package_requests()
```

### 4. Relative Imports

**❌ Bad:**
```python
from .core import DomainContext  # Relative import
```

**✅ Good:**
```python
from pycore.pyctl.document_offline.core import DomainContext  # Absolute import
```

---

## References

- [Python pycore Development Guide](../../../development-guides/PYTHON_PYCORE_BASE_GUIDE_THIS_FILE_NO_AI_EDIT.md)
- [PyBrowser Documentation](../../pyutils/pybrowser/README.md)
- [THREAD_BUS Documentation](../../pyfoundations/thread_bus.py)
- [ColorPrint Documentation](../../pyfoundations/color_print.py)
