# DocumentOffline Development Guide

## Development Environment Setup

### Prerequisites

- Python 3.10+
- Git
- Chrome/Edge/Firefox browser (for browser modes)

### Installation

```bash
# Clone repository
cd D:\programing\core_node

# Install pycore dependencies
# Dependencies are auto-installed via third_party.py

# Verify installation
python -c "from pycore.pyctl.document_offline import offline_manager; print('OK')"
```

---

## Development Workflow

### Phase 1: Core Foundation (P0)

Priority: **MUST HAVE**

#### 1.1 DomainContext

**File:** `pycore/pyctl/document_offline/core/domain_context.py`

```python
from urllib.parse import urlparse, urljoin
from pycore.pyfoundations.color_print import ColorPrint

class DomainContext:
    """Domain context for URL validation and scope management"""

    def __init__(self, start_url, scope_type='full'):
        """
        Initialize domain context

        Args:
            start_url: Starting URL
            scope_type: 'full' or 'path'
        """
        self.start_url = start_url
        self.scope_type = scope_type
        self.parsed = urlparse(start_url)
        self.origin = f"{self.parsed.scheme}://{self.parsed.hostname}"
        self.scope_url = self.origin if scope_type == 'full' else start_url.rstrip('/')

    def canonicalize(self, url):
        """Normalize URL (remove fragments, trailing slashes)"""
        if not url:
            return None

        # Remove fragment
        url = url.split('#')[0]

        # Parse and reconstruct
        parsed = urlparse(url)
        canonical = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"

        # Remove trailing slash (except root)
        if canonical.endswith('/') and parsed.path != '/':
            canonical = canonical.rstrip('/')

        # Add query if exists
        if parsed.query:
            canonical += f"?{parsed.query}"

        return canonical

    def is_internal_link(self, url):
        """Check if URL is same-origin"""
        if not url:
            return False

        parsed = urlparse(url)
        url_origin = f"{parsed.scheme}://{parsed.hostname}"
        return url_origin == self.origin

    def is_within_scope(self, url):
        """Check if URL is within path scope"""
        if self.scope_type == 'full':
            return self.is_internal_link(url)

        if not self.is_internal_link(url):
            return False

        return url.startswith(self.scope_url)

    def resolve_href(self, base_url, href):
        """Resolve relative URL"""
        if not href:
            return None

        absolute = urljoin(base_url, href)
        canonical = self.canonicalize(absolute)

        return {
            'url': absolute,
            'canonical': canonical
        }

    def get_origin(self):
        """Get base origin"""
        return self.origin

    def get_scope_url(self):
        """Get scope root URL"""
        return self.scope_url
```

**Testing:**
```python
# Test canonicalize
ctx = DomainContext('https://example.com/docs/')
assert ctx.canonicalize('https://example.com/docs/#section') == 'https://example.com/docs'
assert ctx.canonicalize('https://example.com/docs/page/') == 'https://example.com/docs/page'

# Test is_internal_link
assert ctx.is_internal_link('https://example.com/page') == True
assert ctx.is_internal_link('https://other.com/page') == False

# Test scope
ctx_path = DomainContext('https://example.com/docs/', scope_type='path')
assert ctx_path.is_within_scope('https://example.com/docs/api') == True
assert ctx_path.is_within_scope('https://example.com/blog') == False
```

#### 1.2 URLQueue

**File:** `pycore/pyctl/document_offline/core/url_queue.py`

```python
import threading
from pycore.pyfoundations.color_print import ColorPrint

class URLQueue:
    """Thread-safe URL queue with deduplication"""

    def __init__(self):
        self.pending = []
        self.processed = set()
        self.lock = threading.Lock()

    def enqueue(self, url, depth):
        """Add URL to queue"""
        if not url or not isinstance(url, str):
            return False

        # Normalize (remove fragment)
        normalized = url.split('#')[0].strip()
        if not normalized:
            return False

        with self.lock:
            # Check if already processed
            if normalized in self.processed:
                return False

            # Check if already in queue
            for item in self.pending:
                if item['url'] == normalized:
                    return False

            # Add to queue
            self.pending.append({'url': normalized, 'depth': depth})
            return True

    def requeue(self, item):
        """Requeue failed item (to front)"""
        if not item or not item.get('url'):
            return False

        with self.lock:
            url = item['url']
            if url in self.processed:
                return False

            # Check if already in queue
            for existing in self.pending:
                if existing['url'] == url:
                    return False

            # Add to front
            self.pending.insert(0, item)
            return True

    def dequeue(self):
        """Get next URL from queue"""
        with self.lock:
            if not self.pending:
                return None
            return self.pending.pop(0)

    def mark_processed(self, url):
        """Mark URL as processed"""
        if url:
            with self.lock:
                self.processed.add(url)

    def has_processed(self, url):
        """Check if URL was processed"""
        if not url:
            return False
        normalized = url.split('#')[0]
        with self.lock:
            return normalized in self.processed

    def has_pending(self):
        """Check if queue has pending URLs"""
        with self.lock:
            return len(self.pending) > 0

    def size(self):
        """Get pending queue size"""
        with self.lock:
            return len(self.pending)

    def processed_count(self):
        """Get processed count"""
        with self.lock:
            return len(self.processed)
```

**Testing:**
```python
queue = URLQueue()

# Test enqueue
assert queue.enqueue('https://example.com/page1', 1) == True
assert queue.enqueue('https://example.com/page1', 1) == False  # Duplicate

# Test dequeue
item = queue.dequeue()
assert item['url'] == 'https://example.com/page1'
assert item['depth'] == 1

# Test processed
queue.mark_processed('https://example.com/page1')
assert queue.has_processed('https://example.com/page1') == True
assert queue.has_processed('https://example.com/page1#section') == True  # Fragment ignored
```

#### 1.3 FileMapper

**File:** `pycore/pyctl/document_offline/core/file_mapper.py`

```python
import os
from urllib.parse import urlparse
from pycore.pyfoundations.color_print import ColorPrint

class FileMapper:
    """Maps URLs to local file paths"""

    DEFAULT_EXTENSIONS = {
        '.html', '.htm', '.xhtml', '.xml', '.json', '.txt', '.csv',
        '.pdf', '.zip', '.gz', '.rar', '.7z',
        '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico',
        '.css', '.js',
        '.mp3', '.mp4', '.avi', '.mov', '.m4v', '.webm',
        '.woff', '.woff2', '.ttf', '.otf', '.eot'
    }

    def __init__(self, supported_extensions=None):
        self.supported_extensions = supported_extensions or self.DEFAULT_EXTENSIONS

    def map_path(self, url_or_parsed):
        """Map URL to local file path"""
        if isinstance(url_or_parsed, str):
            parsed = urlparse(url_or_parsed)
        else:
            parsed = url_or_parsed

        path = parsed.path.lstrip('/')

        # Handle root path
        if not path or path == '':
            return 'index.html'

        # Handle directory path (ends with /)
        if path.endswith('/'):
            return f"{path}index.html"

        # Check if has extension
        ext = os.path.splitext(path)[1].lower()

        # If no extension or unknown extension, add .html
        if not ext or ext not in self.supported_extensions:
            return f"{path}/index.html"

        return path

    def is_supported_extension(self, ext):
        """Check if extension is supported"""
        return ext.lower() in self.supported_extensions
```

**Testing:**
```python
mapper = FileMapper()

# Test basic mapping
assert mapper.map_path('https://example.com/docs/api.html') == 'docs/api.html'
assert mapper.map_path('https://example.com/images/logo.png') == 'images/logo.png'

# Test directory paths
assert mapper.map_path('https://example.com/') == 'index.html'
assert mapper.map_path('https://example.com/docs/') == 'docs/index.html'

# Test paths without extension
assert mapper.map_path('https://example.com/about') == 'about/index.html'

# Test supported extensions
assert mapper.is_supported_extension('.html') == True
assert mapper.is_supported_extension('.exe') == False
```

---

### Phase 2: HTTP Fetcher (P0)

#### 2.1 HTTPFetcher

**File:** `pycore/pyctl/document_offline/fetcher/http_fetcher.py`

```python
import os
import time
from pathlib import Path
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_requests

requests = get_third_package_requests()

class HTTPFetcher:
    """HTTP-based page fetcher"""

    def __init__(self, file_mapper, timeout=30000):
        self.file_mapper = file_mapper
        self.timeout = timeout / 1000  # Convert to seconds
        self.temp_dir = None

    def fetch(self, url):
        """Fetch URL via HTTP"""
        ColorPrint.info(f"Fetching: {url}")

        response = requests.get(url, timeout=self.timeout, stream=True)
        response.raise_for_status()

        content_type = response.headers.get('Content-Type', '')
        is_text = self.is_text_content_type(content_type)

        if is_text:
            content = response.text
        else:
            content = response.content

        return {
            'content': content,
            'content_type': content_type,
            'is_text': is_text,
            'is_binary': not is_text
        }

    def is_text_content_type(self, content_type):
        """Check if content type is text"""
        if not content_type:
            return True

        text_types = [
            'text/',
            'application/json',
            'application/javascript',
            'application/xml',
            'application/xhtml+xml',
            'application/x-javascript'
        ]

        content_type_lower = content_type.lower()
        for text_type in text_types:
            if text_type in content_type_lower:
                return True

        return False

    def cleanup(self):
        """Cleanup fetcher resources"""
        pass
```

**Testing:**
```python
from pycore.pyctl.document_offline.fetcher import HTTPFetcher
from pycore.pyctl.document_offline.core import FileMapper

mapper = FileMapper()
fetcher = HTTPFetcher(mapper, timeout=30000)

# Test fetch HTML
result = fetcher.fetch('https://example.com')
assert result['is_text'] == True
assert len(result['content']) > 0

# Test fetch image
result = fetcher.fetch('https://example.com/logo.png')
assert result['is_binary'] == True
```

---

### Phase 3: Resource Processor (P0)

#### 3.1 ResourceProcessor

**File:** `pycore/pyctl/document_offline/processor/resource_processor.py`

```python
import os
import re
from pathlib import Path
from urllib.parse import urljoin, urlparse
from concurrent.futures import ThreadPoolExecutor
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_requests, get_third_package_beautifulsoup4

requests = get_third_package_requests()
bs4 = get_third_package_beautifulsoup4()

class ResourceProcessor:
    """Unified resource processor"""

    def __init__(self, domain_context, file_mapper, max_workers=5):
        self.domain_context = domain_context
        self.file_mapper = file_mapper
        self.max_workers = max_workers
        self.resource_map = {
            'css': set(),
            'js': set(),
            'images': set(),
            'fonts': set(),
            'media': set()
        }

    def process_page_resources(self, html, base_url, host_dir):
        """Process all page resources"""
        # Extract resources
        resources = self.extract_resources(html, base_url)

        # Download resources
        stats = self.download_resources(resources, host_dir)

        # Rewrite URLs
        rewritten_html = self.rewrite_html(html, base_url)

        return {
            'html': rewritten_html,
            'resources_processed': stats['downloaded'],
            'stats': stats
        }

    def extract_resources(self, html, base_url):
        """Extract all resources from HTML"""
        soup = bs4.BeautifulSoup(html, 'html.parser')
        resources = {
            'css': [],
            'js': [],
            'images': [],
            'fonts': [],
            'media': []
        }

        # Extract CSS
        for link in soup.find_all('link', rel='stylesheet'):
            href = link.get('href')
            if href:
                absolute_url = urljoin(base_url, href)
                resources['css'].append(absolute_url)
                self.resource_map['css'].add(absolute_url)

        # Extract JS
        for script in soup.find_all('script', src=True):
            src = script.get('src')
            if src:
                absolute_url = urljoin(base_url, src)
                resources['js'].append(absolute_url)
                self.resource_map['js'].add(absolute_url)

        # Extract images
        for img in soup.find_all('img', src=True):
            src = img.get('src')
            if src and not src.startswith('data:'):
                absolute_url = urljoin(base_url, src)
                resources['images'].append(absolute_url)
                self.resource_map['images'].add(absolute_url)

        return resources

    def download_resources(self, resources, host_dir):
        """Download resources in parallel"""
        all_urls = []
        for resource_type in resources:
            all_urls.extend(resources[resource_type])

        if not all_urls:
            return {'downloaded': 0, 'skipped': 0, 'failed': 0}

        downloaded = 0
        skipped = 0
        failed = 0

        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = [executor.submit(self.download_resource, url, host_dir) for url in all_urls]
            for future in futures:
                result = future.result()
                if result == 'downloaded':
                    downloaded += 1
                elif result == 'skipped':
                    skipped += 1
                else:
                    failed += 1

        return {
            'downloaded': downloaded,
            'skipped': skipped,
            'failed': failed
        }

    def download_resource(self, url, host_dir):
        """Download single resource"""
        parsed = urlparse(url)
        local_path = self.file_mapper.map_path(parsed)
        output_path = os.path.join(host_dir, local_path)

        # Check if already exists
        if os.path.exists(output_path):
            return 'skipped'

        # Create directory
        output_dir = os.path.dirname(output_path)
        os.makedirs(output_dir, exist_ok=True)

        # Download
        response = requests.get(url, timeout=30, stream=True)
        response.raise_for_status()

        with open(output_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)

        return 'downloaded'

    def rewrite_html(self, html, base_url):
        """Rewrite URLs in HTML"""
        soup = bs4.BeautifulSoup(html, 'html.parser')

        # Rewrite CSS links
        for link in soup.find_all('link', rel='stylesheet'):
            href = link.get('href')
            if href:
                new_href = self.get_relative_path(base_url, href)
                link['href'] = new_href

        # Rewrite JS scripts
        for script in soup.find_all('script', src=True):
            src = script.get('src')
            if src:
                new_src = self.get_relative_path(base_url, src)
                script['src'] = new_src

        # Rewrite images
        for img in soup.find_all('img', src=True):
            src = img.get('src')
            if src and not src.startswith('data:'):
                new_src = self.get_relative_path(base_url, src)
                img['src'] = new_src

        return str(soup)

    def get_relative_path(self, from_url, to_url):
        """Get relative path from one URL to another"""
        absolute_to = urljoin(from_url, to_url)
        parsed_to = urlparse(absolute_to)

        # Map to local path
        local_path = self.file_mapper.map_path(parsed_to)

        # Calculate relative path
        from_path = self.file_mapper.map_path(from_url)
        from_dir = os.path.dirname(from_path)

        if from_dir:
            rel_path = os.path.relpath(local_path, from_dir)
        else:
            rel_path = local_path

        # Convert to forward slashes
        rel_path = rel_path.replace('\\', '/')

        return rel_path
```

---

### Phase 4: Crawl Controller (P0)

#### 4.1 CrawlController

**File:** `pycore/pyctl/document_offline/controller/crawl_controller.py`

```python
import os
import time
import threading
from pathlib import Path
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyctl.document_offline.core import DomainContext, URLQueue, FileMapper
from pycore.pyctl.document_offline.fetcher import HTTPFetcher
from pycore.pyctl.document_offline.processor import ResourceProcessor

class CrawlController(threading.Thread):
    """Main crawl controller thread"""

    def __init__(self):
        threading.Thread.__init__(self, name="CrawlController", daemon=True)
        self.domain_context = None
        self.queue = None
        self.file_mapper = None
        self.fetcher = None
        self.processor = None
        self.max_depth = 3
        self.output_dir = None
        self.downloaded_urls = []
        self.failed_urls = []
        self.running = False

    def start_crawl(self, url, depth=3, output_dir=None):
        """Start crawling"""
        self.domain_context = DomainContext(url)
        self.queue = URLQueue()
        self.file_mapper = FileMapper()
        self.fetcher = HTTPFetcher(self.file_mapper)
        self.processor = ResourceProcessor(self.domain_context, self.file_mapper)
        self.max_depth = depth
        self.output_dir = output_dir or self.get_default_output_dir(url)

        # Enqueue starting URL
        self.queue.enqueue(url, 0)

        # Start thread
        self.running = True
        self.start()

    def run(self):
        """Thread entry point"""
        while self.running and self.queue.has_pending():
            item = self.queue.dequeue()
            if not item:
                break

            url = item['url']
            depth = item['depth']

            if depth > self.max_depth:
                continue

            if self.queue.has_processed(url):
                continue

            self.queue.mark_processed(url)
            self.process_url(url, depth)

            time.sleep(0.1)  # Small delay

        ColorPrint.success("Crawl completed")
        self.running = False

    def process_url(self, url, depth):
        """Process single URL"""
        ColorPrint.info(f"[Depth {depth}] {url}")

        # Fetch
        fetch_result = self.fetcher.fetch(url)

        if not fetch_result['is_text']:
            self.save_binary(url, fetch_result['content'])
            return

        # Process resources
        html = fetch_result['content']
        result = self.processor.process_page_resources(html, url, self.output_dir)

        # Save HTML
        self.save_html(url, result['html'])

        # Extract and enqueue links
        if depth < self.max_depth:
            links = self.extract_links(result['html'], url)
            for link in links:
                if self.domain_context.is_internal_link(link):
                    self.queue.enqueue(link, depth + 1)

    def extract_links(self, html, base_url):
        """Extract all links from HTML"""
        from pycore.pyfoundations.third_party import get_third_package_beautifulsoup4
        from urllib.parse import urljoin

        bs4 = get_third_package_beautifulsoup4()
        soup = bs4.BeautifulSoup(html, 'html.parser')

        links = []
        for anchor in soup.find_all('a', href=True):
            href = anchor['href']
            absolute_url = urljoin(base_url, href)
            links.append(absolute_url)

        return links

    def save_html(self, url, html):
        """Save HTML to file"""
        from urllib.parse import urlparse

        parsed = urlparse(url)
        local_path = self.file_mapper.map_path(parsed)
        output_path = os.path.join(self.output_dir, local_path)

        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html)

        self.downloaded_urls.append(url)
        ColorPrint.success(f"Saved: {local_path}")

    def save_binary(self, url, content):
        """Save binary content"""
        from urllib.parse import urlparse

        parsed = urlparse(url)
        local_path = self.file_mapper.map_path(parsed)
        output_path = os.path.join(self.output_dir, local_path)

        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        with open(output_path, 'wb') as f:
            f.write(content)

        self.downloaded_urls.append(url)

    def get_default_output_dir(self, url):
        """Get default output directory"""
        from urllib.parse import urlparse

        parsed = urlparse(url)
        hostname = parsed.hostname

        base_dir = Path.home() / 'Downloads' / 'DocumentOffline'
        output_dir = base_dir / hostname

        return str(output_dir)

    def stop_crawl(self):
        """Stop crawling"""
        self.running = False
```

**Testing:**
```python
from pycore.pyctl.document_offline.controller import CrawlController

controller = CrawlController()
controller.start_crawl('https://example.com', depth=2)
controller.join()  # Wait for completion

print(f"Downloaded: {len(controller.downloaded_urls)} pages")
```

---

### Development Best Practices

#### 1. Follow pycore Guidelines

**Import Order:**
```python
# 1. Standard library
import os
import time
import threading

# 2. Third-party (lazy loading)
from pycore.pyfoundations.third_party import get_third_package_requests

# 3. Pycore internal
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyctl.document_offline.core import DomainContext
```

**NO try-except:**
```python
# ❌ Bad
try:
    result = download(url)
except Exception as e:
    ColorPrint.red(f"Error: {e}")

# ✅ Good
result = download(url)
if not result.get('success'):
    ColorPrint.red(f"Failed: {result.get('error')}")
    return None
```

**Use ColorPrint:**
```python
ColorPrint.info("Processing...")
ColorPrint.success("Completed")
ColorPrint.warn("Warning message")
ColorPrint.red("Error occurred")
```

#### 2. Threading Rules

**All threads inherit threading.Thread:**
```python
class MyWorker(threading.Thread):
    def __init__(self):
        threading.Thread.__init__(self, name="MyWorker", daemon=True)

    def run(self):
        # Thread work here
        pass
```

**Use THREAD_BUS for communication:**
```python
from pycore.pyfoundations.thread_bus import THREAD_BUS

# Publisher
THREAD_BUS.publish('document_offline.page_downloaded', {'url': url})

# Subscriber
def on_page_downloaded(data):
    ColorPrint.success(f"Downloaded: {data['url']}")

THREAD_BUS.subscribe('document_offline.page_downloaded', on_page_downloaded)
```

#### 3. Testing Strategy

**Write unit tests for each module:**
```python
# tests/test_domain_context.py
def test_canonicalize():
    ctx = DomainContext('https://example.com')
    assert ctx.canonicalize('https://example.com/page#hash') == 'https://example.com/page'

def test_is_internal():
    ctx = DomainContext('https://example.com')
    assert ctx.is_internal_link('https://example.com/page') == True
    assert ctx.is_internal_link('https://other.com') == False
```

**Integration tests:**
```python
# tests/test_integration.py
def test_full_crawl():
    controller = CrawlController()
    controller.start_crawl('https://example.com', depth=1)
    controller.join()
    assert len(controller.downloaded_urls) > 0
```

---

## Debugging Tips

### Enable Debug Mode

```python
# In code
ColorPrint.debug("Debug message")

# Or set environment variable
import os
os.environ['PYCORE_DEBUG'] = '1'
```

### Common Issues

**Issue: Import errors**
```
Solution: Check third_party.py has registered the package
```

**Issue: URLs not being downloaded**
```
Solution: Check domain_context.is_internal_link() and is_within_scope()
```

**Issue: Resources not found**
```
Solution: Check file_mapper.map_path() is generating correct paths
```

---

## Next Steps

After completing P0 (core foundation):

1. **P1**: Implement BrowserFetcher (PyBrowser integration)
2. **P2**: Implement IframeFetcher (iframe recursion)
3. **P3**: Implement TampermonkeyFetcher (WebSocket server)
4. **P4**: Add reporters (sitemap, mapsite, failed_urls)

See ARCHITECTURE.md for complete roadmap.
