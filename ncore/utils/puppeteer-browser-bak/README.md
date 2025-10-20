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

# Puppeteer Browser Module

A comprehensive browser automation solution with stealth protection, instance management, and organized functional APIs.

## Features

- **Stealth Protection**: All instances use `puppeteer-extra-plugin-stealth` for bot detection evasion
- **Instance Management**: Pool-based instance management with automatic cleanup
- **Chrome Compatibility**: Automatic detection and installation of compatible Chrome browsers
- **Modular Architecture**: Organized into functional modules for better maintainability
- **Timer-based Polling**: Non-blocking wait operations using timer-based polling
- **Comprehensive API**: Unified API for all browser automation operations

## Directory Structure

```
ncore/utils/puppeteer-browser/
├── index.js                    # Main entry point
├── README.md                   # This documentation
├── DEVELOPMENT_ANALYSIS.md     # Technical implementation details
├── core/                       # Core management modules
│   ├── main.js                # Main manager class
│   ├── instance.js            # Individual browser instance management
│   ├── pool.js                # Instance pooling and management
│   └── config.js              # Configuration management
├── puppeteer-api/              # Functional API modules
│   ├── api.js                 # Unified API entry point
│   ├── navigation.js          # URL navigation and tab management
│   ├── script.js              # JavaScript execution and data retrieval
│   ├── download.js            # File download functionality
│   ├── screenshot.js          # Screenshot capabilities
│   └── interaction.js         # User interaction methods
├── utils/                      # Utility modules
│   ├── chrome-finder.js       # Chrome browser detection
│   └── chrome-version.js      # Chrome version compatibility
└── libs/                       # Library files
    ├── mime.js                # MIME type mappings
    └── stealth.min.js         # Stealth evasion library
```

## Dependencies

```bash
# Install Puppeteer and related packages
yarn add puppeteer puppeteer-extra puppeteer-extra-plugin-stealth @puppeteer/browsers user-agents
```

## Quick Start

### Using the Unified API (Recommended)

```javascript
const puppeteerAPI = require('#@puppeteer-api');

// Create instance
const instance = await puppeteerAPI.createInstance({}, 'server');

// Set default instance
puppeteerAPI.setDefaultInstance(instance.id);

// Open URL
await puppeteerAPI.openUrl('https://example.com');

// Take screenshot
await puppeteerAPI.takeScreenshot('screenshot.png', { fullPage: true });

// Click element
await puppeteerAPI.clickElement('button');

// Run JavaScript
const result = await puppeteerAPI.runScript('return document.title;');

// Close all instances
await puppeteerAPI.closeAllInstances();
```

### Using the Original Manager

```javascript
const puppeteerSpiderManager = require('#@puppeteer');

// Create a single instance
const instance = await puppeteerSpiderManager.createPuppeteerSpiderInstance({}, 'server');

// Open URL
const page = await instance.puppeteerInstance.openUrlWithPuppeteer('https://example.com');

// Take screenshot
await instance.puppeteerInstance.takeScreenshotWithPuppeteer('screenshot.png', { fullPage: true });

// Close instance
await instance.puppeteerInstance.closePuppeteerSpiderInstance();
```

## API Reference

### Navigation Functions

- `openUrl(url, instanceId)` - Open URL (switch to existing tab if URL exists)
- `forceOpenUrl(url, instanceId)` - Force open URL (always create new tab)
- `switchToTab(tabIndex, instanceId)` - Switch to tab by index
- `switchToUrl(url, instanceId)` - Switch to page by URL
- `getActivePage(instanceId)` - Get active page
- `closeTab(tabIndex, instanceId)` - Close tab by index
- `closeUrl(url, instanceId)` - Close page by URL

### Script Execution Functions

- `runScript(script, instanceId)` - Execute JavaScript code
- `runScriptFile(filePath, instanceId)` - Execute JavaScript from local file
- `runScriptUrl(url, instanceId)` - Execute JavaScript from remote URL
- `getIndexedDBData(instanceId)` - Get IndexedDB data

### Download Functions

- `downloadEmbedded(url, targetPath, instanceId)` - Download file using embedded JavaScript
- `downloadByClick(url, targetPath, instanceId)` - Download file by clicking download link

### Screenshot Functions

- `takeScreenshot(path, options, instanceId)` - Take full page screenshot
- `takeAreaScreenshot(path, area, instanceId)` - Take screenshot of specific area
- `takeElementScreenshot(path, selector, instanceId)` - Take screenshot of specific element

### Interaction Functions

- `waitForElement(selector, options, instanceId)` - Wait for element to appear
- `clickElement(selector, instanceId)` - Click element
- `typeText(selector, text, instanceId)` - Type text into element
- `dragAndDrop(selector, trajectory, speed, instanceId)` - Drag and drop element
- `getContent(selector, instanceId)` - Get page content
- `getElementText(selector, instanceId)` - Get element text
- `getElementAttribute(selector, attribute, instanceId)` - Get element attribute
- `scrollToElement(selector, instanceId)` - Scroll to element
- `hoverElement(selector, instanceId)` - Hover over element
- `focusElement(selector, instanceId)` - Focus element

### Instance Management Functions

- `createInstance(config, presetMode)` - Create Puppeteer instance
- `createInstances(config, count, presetMode)` - Create multiple instances
- `getInstanceById(instanceId)` - Get instance by ID
- `closeInstance(instanceId)` - Close specific instance
- `closeAllInstances()` - Close all instances
- `getPoolStats()` - Get pool statistics
- `findCompatibleChrome()` - Find compatible Chrome browser
- `ensureCompatibleChrome()` - Ensure compatible Chrome is available
- `setDefaultInstance(instanceId)` - Set default instance ID

## Preset Modes

- `server` - Optimized for server environments
- `desktop` - Optimized for desktop automation
- `mobile` - Optimized for mobile device simulation

## Configuration Options

```javascript
const config = {
    headless: true,                    // Run in headless mode
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Custom User Agent',
    timeout: 30000,                    // Page timeout
    downloadPath: '/path/to/downloads' // Download directory
};
```

## Chrome Compatibility

The module automatically:
- Detects installed Chrome browsers
- Maps Puppeteer versions to compatible Chrome versions
- Installs compatible Chrome if not found
- Handles version compatibility issues

## Error Handling

All functions include comprehensive error handling:
- Instance not found errors
- Page availability checks
- Element existence validation
- Timeout handling for wait operations

## Performance Optimization

- **Instance Pooling**: Reuse browser instances for better performance
- **Timer-based Polling**: Non-blocking wait operations
- **Automatic Cleanup**: Proper resource management
- **Stealth Protection**: Avoid bot detection for better success rates

## Security Features

- **Stealth Protection**: All instances use stealth evasion techniques
- **Input Validation**: Comprehensive parameter validation
- **Error Sanitization**: Safe error messages without sensitive data exposure

## Integration with ncore

This module integrates seamlessly with the ncore framework:
- Uses `#@logger` for consistent logging
- Follows ncore development guidelines
- Exports instances rather than classes
- Compatible with ncore's module system

## Troubleshooting

### Common Issues

1. **Chrome not found**: The module will automatically attempt to install compatible Chrome
2. **Stealth detection**: Ensure all instances use stealth protection
3. **Memory leaks**: Use `closeAllInstances()` to properly clean up resources
4. **Timeout errors**: Adjust timeout values in configuration

### Debug Mode

Enable debug logging by setting the log level:
```javascript
const logger = require('#@logger');
logger.setLevel('debug');
```

## Development

### Adding New Functions

1. Create new function in appropriate API module
2. Add function to unified API in `puppeteer-api/api.js`
3. Update documentation
4. Follow timer-based polling for wait operations

### Testing

The module includes comprehensive error handling and validation. Test with:
- Different preset modes
- Various Chrome versions
- Network conditions
- Error scenarios

## License

This module is part of the ncore framework and follows the project's licensing terms. 