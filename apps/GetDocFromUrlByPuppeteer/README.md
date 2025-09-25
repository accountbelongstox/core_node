<!-- ### AI SPECIAL ATTENTION RULES START ### -->
<!-- When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES: -->
<!-- - Write all code in English only. -->
<!-- - Never execute, create, or modify test code. -->
<!-- - Never create or update documentation (*.md). -->
<!-- - Never write summaries during development or thinking process. -->
<!-- 5. Declare all variables at the beginning of the file. -->
<!-- 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path). -->
<!-- 7. Do not modify these rules. -->
<!-- VIOLATION OF THESE RULES IS STRICTLY PROHIBITED -->
<!-- ### AI SPECIAL ATTENTION RULES END ### -->

# DocOfflineDownloader

A Node.js application for outputting doc URLs and downloading their content offline using puppeteer-browser.

## Features

- **Doc URL Processing**: Extract and output information from doc websites
- **Offline Download**: Download HTML content and screenshots for offline viewing
- **Link Extraction**: Extract internal links for further processing
- **Configurable**: Flexible configuration for different doc sites
- **Logging**: Comprehensive logging for monitoring and debugging

## Usage

### Starting the Application

```bash
# Start the application
node main.js app=DocOfflineDownloader
```

### Configuration

The application uses the configuration system defined in `config/index.js`. Key configuration options:

```javascript
{
  DocOfflineDownloader: {
    // Enable/disable download functionality
    enableDownload: true,
    
    // List of doc URLs to process
    docUrls: [
      'https://docs.puppeteer.dev/',
      'https://nodejs.org/docs/',
      'https://developer.mozilla.org/en-US/docs/'
    ],
    
    // Puppeteer configuration
    puppeteer: {
      headless: true,
      stealth: true,
      timeout: 30000,
      waitUntil: 'networkidle2'
    }
  }
}
```

## Architecture

### Directory Structure

```
apps/DocOfflineDownloader/
├── main.js                    # Application entry point
├── config/
│   └── index.js              # Application configuration
├── service/
│   └── docProcessor.js       # Doc processing service
├── development_analysis.md   # Development analysis document
└── README.md                 # This file
```

### Components

#### Main Application (`main.js`)
- Application entry point
- Orchestrates the doc processing workflow
- Handles application lifecycle

#### Configuration (`config/index.js`)
- Application-specific configuration
- Merged with main configuration through gconfig
- Defines doc URLs and processing options

#### Doc Processor Service (`service/docProcessor.js`)
- Handles doc URL processing logic
- Extracts doc information using puppeteer
- Downloads content and screenshots
- Outputs doc information

## Output

### Console Output
The application outputs detailed information about each processed doc URL:

```
=== Doc Information ===
URL: https://docs.puppeteer.dev/
Title: Puppeteer
Description: Puppeteer is a Node.js library which provides a high-level API to control Chrome/Chromium over the DevTools Protocol.
Keywords: puppeteer, chrome, headless, automation
Found 45 internal links
Timestamp: 2024-01-01T12:00:00.000Z
```

### File Output
- **HTML Content**: Full HTML pages saved to `public/DocOfflineDownloader/`
- **Screenshots**: Full-page screenshots saved as PNG files
- **Analysis Data**: JSON file with extracted doc information

## Dependencies

### ncore Integration
- **#@logger**: Application logging
- **#@fwriter**: File writing operations
- **#@global_dir**: Directory path management
- **#@gconfig**: Configuration management
- **#@ncore/utils/puppeteer-browser**: Web scraping functionality

### External Dependencies
- Uses existing puppeteer-browser module from ncore
- No additional external dependencies required

## Development

### Adding New Doc URLs
1. Edit `config/index.js`
2. Add URLs to the `docUrls` array
3. Restart the application

### Customizing Output
1. Modify `service/docProcessor.js`
2. Adjust the `extractDocInformation` method
3. Customize the `outputDocInformation` method

### Configuration Options
- `enableDownload`: Enable/disable content downloading
- `puppeteer.headless`: Run browser in headless mode
- `puppeteer.stealth`: Enable stealth mode for anti-detection
- `puppeteer.timeout`: Page load timeout in milliseconds

## Error Handling

The application implements comprehensive error handling:
- Individual URL processing errors don't stop the entire process
- Detailed error logging for debugging
- Graceful handling of network timeouts
- File system error handling

## Performance

- Processes URLs sequentially to avoid overwhelming target servers
- Uses puppeteer instance pooling for efficient resource usage
- Implements proper cleanup of browser instances
- Configurable timeouts and delays

## Security

- Uses stealth mode to avoid detection
- Implements proper URL validation
- Sanitizes filenames for safe file system usage
- Follows ncore security guidelines 