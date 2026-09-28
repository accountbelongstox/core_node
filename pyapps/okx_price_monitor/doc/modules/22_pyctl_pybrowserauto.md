# pyctl.pybrowserauto - Browser Automation

## Overview

The `pybrowserauto` module provides offline website downloading and browser automation utilities. It enables downloading complete websites for offline viewing with all assets.

## Module Location

```
pycore/pyctl/pybrowserauto/
├── __init__.py
├── controller.py           # CLIController
├── downloader.py           # WebsiteDownloader
├── crawler.py              # PageCrawler
├── asset_handler.py        # AssetHandler
└── config.py               # Configuration
```

## Core Components

### CLIController

Command-line interface:

```python
from pycore.pyctl.pybrowserauto.controller import CLIController

cli = CLIController()

# Download website
cli.download(
    url="https://example.com",
    output_dir="/downloads/example",
    depth=2,
    include_assets=True
)

# With filters
cli.download(
    url="https://docs.example.com",
    output_dir="/downloads/docs",
    depth=3,
    include_patterns=["*.html", "*.css", "*.js"],
    exclude_patterns=["*.pdf", "*.zip"]
)
```

### WebsiteDownloader

Main downloader class:

```python
from pycore.pyctl.pybrowserauto import WebsiteDownloader

downloader = WebsiteDownloader(
    output_dir="/downloads",
    max_depth=3,
    concurrent_downloads=5
)

# Download single page
await downloader.download_page("https://example.com/page1")

# Download entire site
await downloader.download_site(
    "https://example.com",
    include_subdomains=True
)

# Download with progress
async for progress in downloader.download_site_progress("https://example.com"):
    print(f"Progress: {progress.percent}% - {progress.current_url}")
```

### PageCrawler

Page discovery and crawling:

```python
from pycore.pyctl.pybrowserauto import PageCrawler

crawler = PageCrawler(
    start_url="https://example.com",
    max_depth=2,
    same_domain_only=True
)

# Crawl and get all URLs
urls = await crawler.crawl()
for url in urls:
    print(url)

# Crawl with callback
async def on_page(url, depth, html):
    print(f"Found: {url} (depth {depth})")

await crawler.crawl_with_callback(on_page)
```

### AssetHandler

Asset management:

```python
from pycore.pyctl.pybrowserauto import AssetHandler

handler = AssetHandler(output_dir="/downloads/assets")

# Download and localize assets
localized_html = await handler.process_html(
    html_content,
    base_url="https://example.com",
    download_css=True,
    download_js=True,
    download_images=True,
    download_fonts=True
)

# Get asset list
assets = handler.get_downloaded_assets()
```

## Usage Examples

### Download Single Page

```python
from pycore.pyctl.pybrowserauto import WebsiteDownloader
import asyncio

async def main():
    downloader = WebsiteDownloader("/downloads")
    
    await downloader.download_page(
        "https://example.com/article",
        include_assets=True
    )
    
    print("Page downloaded!")

asyncio.run(main())
```

### Download Entire Website

```python
from pycore.pyctl.pybrowserauto import WebsiteDownloader
import asyncio

async def main():
    downloader = WebsiteDownloader(
        output_dir="/downloads/mysite",
        max_depth=3,
        concurrent_downloads=10
    )
    
    await downloader.download_site(
        "https://docs.python.org",
        include_subdomains=False
    )
    
    print(f"Downloaded {downloader.page_count} pages")

asyncio.run(main())
```

### With Progress Tracking

```python
from pycore.pyctl.pybrowserauto import WebsiteDownloader
import asyncio

async def main():
    downloader = WebsiteDownloader("/downloads")
    
    async for progress in downloader.download_site_progress("https://example.com"):
        print(f"\r{progress.percent:3.0f}% | "
              f"Pages: {progress.pages_done}/{progress.pages_total} | "
              f"Assets: {progress.assets_done} | "
              f"Current: {progress.current_url[:50]}", end="")
    
    print("\nDone!")

asyncio.run(main())
```

### CLI Usage

```bash
# Basic download
python -m pycore.pyctl.pybrowserauto download https://example.com -o /downloads

# With depth
python -m pycore.pyctl.pybrowserauto download https://example.com -o /downloads -d 3

# Exclude patterns
python -m pycore.pyctl.pybrowserauto download https://example.com -o /downloads \
    --exclude "*.pdf" --exclude "*.zip"

# Include only HTML/CSS/JS
python -m pycore.pyctl.pybrowserauto download https://example.com -o /downloads \
    --include "*.html" --include "*.css" --include "*.js"
```

## Configuration

```python
from pycore.pyctl.pybrowserauto import DownloaderConfig

config = DownloaderConfig(
    max_depth=3,
    concurrent_downloads=5,
    request_timeout=30,
    retry_count=3,
    retry_delay=1,
    user_agent="Mozilla/5.0 ...",
    include_patterns=["*.html", "*.css"],
    exclude_patterns=["*.pdf"],
    same_domain_only=True,
    download_assets=True,
    localize_urls=True,
    preserve_structure=True
)
```

## Best Practices

1. **Set Max Depth**: Limit crawl depth to avoid excessive downloads
2. **Use Filters**: Include/exclude patterns to target specific content
3. **Concurrent Downloads**: Balance speed vs. server load
4. **Same Domain**: Stay on same domain to avoid external sites
5. **Check Robots.txt**: Respect website rules

## Exports

```python
__all__ = [
    'CLIController',
    'WebsiteDownloader',
    'PageCrawler',
    'AssetHandler',
    'DownloaderConfig',
]
```















