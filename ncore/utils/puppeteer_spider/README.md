# Puppeteer Spider

A comprehensive Puppeteer wrapper library that provides advanced browser automation capabilities with multi-instance management, browser detection, installation, and high-level wrappers.

## Features

- **Multi-Instance Management**: Create and manage multiple Puppeteer instances simultaneously
- **Browser Detection & Installation**: Automatic detection and installation of Chrome and Edge browsers
- **Cross-Platform Support**: Windows, Linux, and macOS support
- **Version Mapping**: Automatic version mapping between Puppeteer and browser versions
- **Driver Management**: Automatic download and management of browser drivers
- **High-Level Wrappers**: Advanced climber wrappers for common automation tasks
- **Edge-First Approach**: Edge browser as default with Chrome fallback

## Installation

```bash
npm install puppeteer
```

## Quick Start

### Basic Usage

```javascript
const { PuppeteerSpider, instanceManager } = require('./main.js');

// Create a new spider instance
const spider = new PuppeteerSpider({
    headless: false,
    viewport: { width: 1920, height: 1080 }
});

// Initialize with Edge browser (default)
await spider.initialize();

// Get the page and navigate
const page = spider.getPage();
await page.goto('https://example.com');

// Close when done
await spider.close();
```

### Multiple Instances

```javascript
// Create multiple instances with different browsers
const spider1 = new PuppeteerSpider(config1, 'spider1');
const spider2 = new PuppeteerSpider(config2, 'spider2');

await spider1.initialize('edge');
await spider2.initialize('chrome');

// Use both instances simultaneously
const page1 = spider1.getPage();
const page2 = spider2.getPage();

await Promise.all([
    page1.goto('https://site1.com'),
    page2.goto('https://site2.com')
]);
```

### Using Climber Wrappers

```javascript
const { PuppeteerDriver, instanceManager } = require('./main.js');

// Create an instance
const instance = await instanceManager.createInstance();

// Create a driver wrapper
const driver = await PuppeteerDriver.createForInstance(instance);

// Use high-level methods
await driver.navigateTo('https://example.com');
await driver.takeScreenshot({ path: 'screenshot.png' });
await driver.clickElement('#button');
await driver.typeText('#input', 'Hello World');

// Download files
await driver.downloadFile('https://example.com/file.pdf', 'downloaded.pdf');
```

## Configuration

### Default Configuration

```javascript
const DEFAULT_CONFIG = {
    headless: true,
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
    ],
    timeout: 30000,
    viewport: {
        width: 1920,
        height: 1080
    },
    browserType: 'edge' // Default to Edge browser
};
```

### Custom Configuration

```javascript
const customConfig = {
    headless: false,
    devtools: true,
    slowMo: 100,
    args: ['--start-maximized'],
    viewport: { width: 1366, height: 768 }
};

const spider = new PuppeteerSpider(customConfig);
```

## Browser Management

### Browser Detection

```javascript
const { EdgeFinder, ChromeFinder } = require('./main.js');

// Check if Edge is installed
const edgeFinder = new EdgeFinder();
const edgeInfo = edgeFinder.getEdgeInfo();
console.log('Edge installed:', !!edgeInfo);

// Check if Chrome is installed
const chromeFinder = new ChromeFinder();
const chromeInfo = chromeFinder.getChromeInfo();
console.log('Chrome installed:', !!chromeInfo);
```

### Browser Installation

```javascript
const { EdgeInstaller, ChromeInstaller } = require('./main.js');

// Install Edge
const edgeInstaller = new EdgeInstaller();
if (!(await edgeInstaller.isInstalled())) {
    await edgeInstaller.install();
}

// Install Chrome
const chromeInstaller = new ChromeInstaller();
if (!(await chromeInstaller.isInstalled())) {
    await chromeInstaller.install();
}
```

## Version Management

### Version Mapping

```javascript
const { ChromeVersionMapper, EdgeVersionMapper } = require('./main.js');

const chromeMapper = new ChromeVersionMapper();
const edgeMapper = new EdgeVersionMapper();

// Get Chrome version for Puppeteer version
const chromeVersion = chromeMapper.getChromeVersion('23.4.1');
console.log('Chrome version:', chromeVersion);

// Get Edge version for Puppeteer version
const edgeVersion = edgeMapper.getEdgeVersion('23.4.1');
console.log('Edge version:', edgeVersion);
```

### Driver Management

```javascript
const { DriverDownloader } = require('./main.js');

const driverDownloader = new DriverDownloader();

// Download Chrome driver
const chromeDriver = await driverDownloader.downloadChromeDriver('23.4.1');

// Download Edge driver
const edgeDriver = await driverDownloader.downloadEdgeDriver('23.4.1');

// Check driver info
const driverInfo = driverDownloader.getDriverInfo();
console.log('Driver info:', driverInfo);
```

## Instance Management

### Global Instance Manager

```javascript
const { instanceManager } = require('./main.js');

// Create instances
const instance1 = await instanceManager.createInstance(config1, 'instance1');
const instance2 = await instanceManager.createInstance(config2, 'instance2');

// Get all instances
const allInstances = instanceManager.getAllInstances();

// Get specific instance
const instance = instanceManager.getInstance('instance1');

// Close specific instance
await instanceManager.closeInstance('instance1');

// Close all instances
await instanceManager.closeAllInstances();
```

### Instance Information

```javascript
// Get instance info
const info = instanceManager.getInstanceInfo('instance1');
console.log('Instance info:', info);

// Get all instances info
const allInfo = instanceManager.getInstanceInfo();
console.log('All instances:', allInfo);
```

## Advanced Usage

### Custom Wrapper Creation

```javascript
class CustomWrapper {
    constructor(instance) {
        this.instance = instance;
    }
    
    async customMethod() {
        const page = this.instance.page;
        // Custom automation logic
        return await page.evaluate(() => document.title);
    }
}

// Attach to instance
const instance = await instanceManager.createInstance();
instance.wrappers.set('custom', new CustomWrapper(instance));

// Use custom wrapper
const customWrapper = instance.wrappers.get('custom');
const title = await customWrapper.customMethod();
```

### Error Handling

```javascript
try {
    const spider = new PuppeteerSpider();
    await spider.initialize();
    
    const page = spider.getPage();
    await page.goto('https://example.com');
    
} catch (error) {
    console.error('Error:', error.message);
} finally {
    if (spider) {
        await spider.close();
    }
}
```

## API Reference

### PuppeteerSpider

- `constructor(config, id)` - Create new spider instance
- `initialize(browserType)` - Initialize with specified browser
- `getPage()` - Get current page
- `getBrowser()` - Get current browser
- `close()` - Close spider instance

### PuppeteerInstanceManager

- `createInstance(config, id, browserType)` - Create new instance
- `getInstance(id)` - Get instance by ID
- `getAllInstances()` - Get all instances
- `closeInstance(id)` - Close specific instance
- `closeAllInstances()` - Close all instances
- `getInstanceInfo(id)` - Get instance information

### PuppeteerDriver

- `createForInstance(instance)` - Create driver for instance
- `createForInstanceId(instanceId, instanceManager)` - Create driver by instance ID
- `navigateTo(url, options)` - Navigate to URL
- `takeScreenshot(options)` - Take screenshot
- `clickElement(selector, options)` - Click element
- `typeText(selector, text, options)` - Type text
- `downloadFile(url, filename, options)` - Download file

## Examples

### Web Scraping

```javascript
const { PuppeteerSpider } = require('./main.js');

const spider = new PuppeteerSpider({ headless: true });
await spider.initialize();

const page = spider.getPage();
await page.goto('https://example.com');

const data = await page.evaluate(() => {
    return {
        title: document.title,
        links: Array.from(document.querySelectorAll('a')).map(a => a.href)
    };
});

console.log('Scraped data:', data);
await spider.close();
```

### Form Automation

```javascript
const { PuppeteerDriver, instanceManager } = require('./main.js');

const instance = await instanceManager.createInstance({ headless: false });
const driver = await PuppeteerDriver.createForInstance(instance);

await driver.navigateTo('https://example.com/form');
await driver.typeText('#name', 'John Doe');
await driver.typeText('#email', 'john@example.com');
await driver.clickElement('#submit');

await driver.close();
```

### Multi-Tab Management

```javascript
const { PuppeteerSpider } = require('./main.js');

const spider = new PuppeteerSpider();
await spider.initialize();

const browser = spider.getBrowser();
const page1 = await browser.newPage();
const page2 = await browser.newPage();

await Promise.all([
    page1.goto('https://site1.com'),
    page2.goto('https://site2.com')
]);

// Work with multiple tabs
const title1 = await page1.title();
const title2 = await page2.title();

console.log('Titles:', { title1, title2 });
await spider.close();
```

## Troubleshooting

### Common Issues

1. **Browser not found**: The library will automatically attempt to install missing browsers
2. **Permission errors**: Ensure proper permissions for browser installation
3. **Driver issues**: Drivers are automatically downloaded and managed
4. **Memory issues**: Close unused instances to free memory

### Debug Mode

```javascript
const spider = new PuppeteerSpider({
    headless: false,
    devtools: true,
    slowMo: 100
});
```

## Contributing

This library is part of the core_node project. Please refer to the project documentation for contribution guidelines.

## License

This project is licensed under the same terms as the core_node project.
