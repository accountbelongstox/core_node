# DocumentOffline

An ncore-based CLI tool to download web documents offline into a local cache.

## Features

- 🔗 Recursively download linked pages
- 🌐 Smart same-origin URL filtering
- 📁 Automatic UTF-8 encoding conversion
- 💾 Local cache management
- 📊 Download progress display
- ⚙️ Configurable parameters

## Installation

```bash
# Install third-party dependencies
yarn add iconv-lite jsdom

# Or use npm
npm install iconv-lite jsdom
```

## Usage

### Basic Usage

```bash
# Install dependencies first
yarn add iconv-lite jsdom

# Start the application
node main.js app=DocumentOffline <url> [depth]

# Examples
node main.js app=DocumentOffline https://example.com 3
node main.js app=DocumentOffline www.baidu.com 2
node main.js app=DocumentOffline https://github.com 1
```

### Parameters

- **url**: The URL to start downloading from (required)
  - Can be with or without protocol (https:// will be added automatically if missing)
  - Examples: `https://example.com`, `www.baidu.com`, `github.com`
- **depth**: Recursion depth (optional, default: 3)
  - How many levels deep to follow links
  - Range: 1-10 (recommended)

### Examples

```bash
# Download a single page
node main.js app=DocumentOffline https://example.com 1

# Download with 3 levels of recursion (default)
node main.js app=DocumentOffline https://example.com

# Download with custom depth
node main.js app=DocumentOffline https://example.com 5

# Download from domain without protocol
node main.js app=DocumentOffline www.baidu.com 2
```

## Project Structure

```
DocumentOffline/
├── main.js                 # App entry
├── package.json            # Project config
├── README.md              # Documentation
├── controller/            # Controllers
│   ├── main.js           # Main controller
│   ├── download_manager.js # Download manager
│   ├── url_processor.js   # URL processor
│   ├── file_manager.js    # File manager
│   ├── http_downloader.js # HTTP downloader
│   ├── html_parser.js     # HTML parser
│   └── config_manager.js  # Config manager
├── config/               # Config
│   └── config.json       # Config file
├── utils/                # Utilities
│   ├── logger.js         # Logger
│   └── progress.js       # Progress UI
├── cache/                # Cache (auto-created)
└── logs/                 # Logs (auto-created)
```

## Configuration

Settings in `config/config.json`:

### Download
- `timeout`: Request timeout (ms)
- `maxRetries`: Max retries
- `maxRedirects`: Max redirects
- `userAgent`: User-Agent string
- `delay`: Delay between requests (ms)

### Parsing
- `ignoredExtensions`: Ignored file extensions
- `maxLinksPerPage`: Max links per page

### Files
- `cacheDir`: Cache directory
- `maxFileSize`: Max file size (bytes)
- `encoding`: File encoding

### Limits
- `maxDepth`: Max recursion depth
- `maxPages`: Max pages
- `maxConcurrent`: Max concurrent downloads

## Roadmap

### Phase 1: Basics ✅
- [x] CLI argument parsing
- [x] HTTP downloader
- [x] URL processor
- [x] File manager
- [x] HTML parser
- [x] Config management

### Phase 2: Enhancements 🔄
- [ ] Concurrent downloads
- [ ] Resume downloads
- [ ] Archive support
- [ ] More file formats
- [ ] Download history

### Phase 3: Advanced 📋
- [ ] Web UI
- [ ] Search
- [ ] Export
- [ ] Plugin system
- [ ] Performance tuning

## Stack

- Node.js
- iconv-lite (encoding)
- jsdom (HTML parsing)
- Native HTTP/HTTPS modules

## License

MIT License 
