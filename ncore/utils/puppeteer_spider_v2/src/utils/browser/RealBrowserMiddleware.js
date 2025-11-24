// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

/**
 * Real Browser Middleware
 *
 * Makes Puppeteer browser appear as a real browser to avoid bot detection.
 * Uses puppeteer-extra with stealth and other anti-detection plugins.
 *
 * NOTE: This is for legitimate testing of our own websites,
 * not for scraping unauthorized content.
 */

const logger = require('#@logger');

// Try to load all packages at startup
let puppeteerExtra = null;
let rebrowserPuppeteer = null;
let puppeteerRealBrowser = null;
let StealthPlugin = null;
let AdblockerPlugin = null;
let AnonymizeUAPlugin = null;
let UserPreferencesPlugin = null;
let addExtra = null;

// Load rebrowser-puppeteer-core
try {
    rebrowserPuppeteer = require('rebrowser-puppeteer-core');
} catch (e) {
    rebrowserPuppeteer = null;
}

// Load puppeteer-real-browser
try {
    puppeteerRealBrowser = require('puppeteer-real-browser');
} catch (e) {
    puppeteerRealBrowser = null;
}

// Load puppeteer-extra
try {
    puppeteerExtra = require('puppeteer-extra');
    addExtra = require('puppeteer-extra').addExtra;
} catch (e) {
    puppeteerExtra = null;
}

// Load stealth plugin
try {
    StealthPlugin = require('puppeteer-extra-plugin-stealth');
} catch (e) {
    StealthPlugin = null;
}

// Load adblocker plugin
try {
    AdblockerPlugin = require('puppeteer-extra-plugin-adblocker');
} catch (e) {
    AdblockerPlugin = null;
}

// Load anonymize-ua plugin
try {
    AnonymizeUAPlugin = require('puppeteer-extra-plugin-anonymize-ua');
} catch (e) {
    AnonymizeUAPlugin = null;
}

// Load user-preferences plugin
try {
    UserPreferencesPlugin = require('puppeteer-extra-plugin-user-preferences');
} catch (e) {
    UserPreferencesPlugin = null;
}

let isInitialized = false;
let initError = null;
let useRebrowser = false;
let usePuppeteerRealBrowser = false;
let configuredPuppeteer = null;

/**
 * Initialize puppeteer with best available option
 * Priority: rebrowser-puppeteer-core > puppeteer-real-browser > puppeteer-extra > puppeteer
 * @returns {Object} Configured puppeteer instance
 */
function initializePuppeteerExtra() {
    if (isInitialized) {
        if (initError) {
            throw initError;
        }
        return configuredPuppeteer;
    }

    try {
        // Try rebrowser-puppeteer-core first (best anti-detection)
        if (rebrowserPuppeteer) {
            useRebrowser = true;
            logger.success('[RealBrowserMiddleware] Using rebrowser-puppeteer-core (best anti-detection)');

            // Try to add puppeteer-extra plugins on top of rebrowser
            if (addExtra) {
                configuredPuppeteer = addExtra(rebrowserPuppeteer);
                loadPuppeteerExtraPlugins();
            } else {
                logger.info('[RealBrowserMiddleware] puppeteer-extra not available, using rebrowser directly');
                configuredPuppeteer = rebrowserPuppeteer;
            }
            isInitialized = true;
            return configuredPuppeteer;
        }

        // Try puppeteer-real-browser
        if (puppeteerRealBrowser) {
            usePuppeteerRealBrowser = true;
            isInitialized = true;
            configuredPuppeteer = puppeteerRealBrowser;
            logger.success('[RealBrowserMiddleware] Using puppeteer-real-browser');
            return configuredPuppeteer;
        }

        // Fall back to puppeteer-extra
        if (puppeteerExtra) {
            loadPuppeteerExtraPlugins();
            isInitialized = true;
            configuredPuppeteer = puppeteerExtra;
            logger.success('[RealBrowserMiddleware] Puppeteer-extra initialized successfully');
            return configuredPuppeteer;
        }

        // Final fallback to standard puppeteer
        configuredPuppeteer = require('puppeteer');
        isInitialized = true;
        logger.info('[RealBrowserMiddleware] Using standard puppeteer');
        return configuredPuppeteer;
    } catch (error) {
        initError = error;
        isInitialized = true;
        logger.error('[RealBrowserMiddleware] Failed to initialize:', error.message);
        return null;
    }
}

/**
 * Load puppeteer-extra plugins
 */
function loadPuppeteerExtraPlugins() {
    if (!configuredPuppeteer || !configuredPuppeteer.use) return;

    // Load stealth plugin
    if (StealthPlugin) {
        try {
            configuredPuppeteer.use(StealthPlugin());
            logger.info('[RealBrowserMiddleware] Stealth plugin loaded');
        } catch (error) {
            logger.warn('[RealBrowserMiddleware] Failed to apply stealth plugin:', error.message);
        }
    }

    // Load adblocker plugin
    if (AdblockerPlugin) {
        try {
            configuredPuppeteer.use(AdblockerPlugin({ blockTrackers: true }));
            logger.info('[RealBrowserMiddleware] Adblocker plugin loaded');
        } catch (error) {
            logger.warn('[RealBrowserMiddleware] Failed to apply adblocker plugin:', error.message);
        }
    }

    // Load anonymize-ua plugin
    if (AnonymizeUAPlugin) {
        try {
            configuredPuppeteer.use(AnonymizeUAPlugin());
            logger.info('[RealBrowserMiddleware] AnonymizeUA plugin loaded');
        } catch (error) {
            logger.warn('[RealBrowserMiddleware] Failed to apply anonymize-ua plugin:', error.message);
        }
    }

    // Load user-preferences plugin
    if (UserPreferencesPlugin) {
        try {
            configuredPuppeteer.use(UserPreferencesPlugin({
                userPrefs: {
                    webkit: {
                        webprefs: {
                            default_font_size: 16
                        }
                    }
                }
            }));
            logger.info('[RealBrowserMiddleware] UserPreferences plugin loaded');
        } catch (error) {
            logger.warn('[RealBrowserMiddleware] Failed to apply user-preferences plugin:', error.message);
        }
    }
}

/**
 * Get screen resolution
 * @returns {Object} {width, height}
 */
function getScreenResolution() {
    const { execSync } = require('child_process');
    const platform = process.platform;
    let width = 1920;
    let height = 1080;

    try {
        if (platform === 'win32') {
            const result = execSync('wmic path Win32_VideoController get CurrentHorizontalResolution,CurrentVerticalResolution /format:csv', { encoding: 'utf8' });
            const lines = result.trim().split('\n').filter(line => line.trim());
            if (lines.length > 1) {
                const parts = lines[1].split(',');
                if (parts.length >= 3) {
                    width = parseInt(parts[1], 10) || 1920;
                    height = parseInt(parts[2], 10) || 1080;
                }
            }
        } else if (platform === 'linux') {
            const result = execSync('xrandr --current 2>/dev/null | grep "*" | head -1', { encoding: 'utf8' });
            const match = result.match(/(\d+)x(\d+)/);
            if (match) {
                width = parseInt(match[1], 10);
                height = parseInt(match[2], 10);
            }
        } else if (platform === 'darwin') {
            const result = execSync('system_profiler SPDisplaysDataType | grep Resolution', { encoding: 'utf8' });
            const match = result.match(/(\d+)\s*x\s*(\d+)/);
            if (match) {
                width = parseInt(match[1], 10);
                height = parseInt(match[2], 10);
            }
        }
    } catch (error) {
        logger.warn('[RealBrowserMiddleware] Failed to detect screen resolution, using default 1920x1080');
    }

    return { width, height };
}

/**
 * Get optimal window size based on screen resolution
 * @returns {Object} {width, height}
 */
function getOptimalWindowSize() {
    const screen = getScreenResolution();
    let windowWidth = 1920;
    let windowHeight = 1080;

    if (screen.width >= 1920 && screen.height >= 1080) {
        windowWidth = 1920;
        windowHeight = 1080;
    } else if (screen.width >= 1366 && screen.height >= 768) {
        windowWidth = 866;
        windowHeight = 600;
    } else {
        windowWidth = Math.max(800, screen.width - 100);
        windowHeight = Math.max(600, screen.height - 100);
    }

    return { width: windowWidth, height: windowHeight };
}

/**
 * Get real browser arguments to avoid detection
 * @param {Object} options - Options for browser args
 * @param {string} options.platform - Platform: 'win32', 'linux', 'darwin'
 * @param {string} options.browserType - Browser type: 'chrome', 'edge'
 * @returns {Array<string>}
 */
function getRealBrowserArgs(options = {}) {
    const platform = options.platform || process.platform;
    const browserType = (options.browserType || 'edge').toLowerCase();
    const isLinux = platform === 'linux';
    const windowSize = getOptimalWindowSize();

    const args = [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        `--window-size=${windowSize.width},${windowSize.height}`,
        '--start-maximized',
        '--ignore-certificate-errors',
        '--ignore-certificate-errors-spki-list',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-sync',
        '--disable-translate',
        '--metrics-recording-only',
        '--mute-audio',
        '--no-default-browser-check',
        '--safebrowsing-disable-auto-update',
        '--disable-features=IsolateOrigins,site-per-process,VizDisplayCompositor'
    ];

    if (isLinux) {
        args.push('--disable-setuid-sandbox');
        args.push('--no-zygote');
    }

    if (browserType === 'edge') {
        args.push('--disable-edge-features=msEdgeSidebarV2');
    }

    return args;
}

/**
 * Get default viewport settings
 * @returns {Object}
 */
function getDefaultViewport() {
    const windowSize = getOptimalWindowSize();
    return {
        width: windowSize.width,
        height: windowSize.height,
        deviceScaleFactor: 1,
        hasTouch: false,
        isLandscape: true,
        isMobile: false
    };
}

/**
 * Apply real browser settings to page
 * @param {Object} page - Puppeteer page
 * @returns {Promise<void>}
 */
async function applyRealBrowserSettings(page) {
    try {
        // Set realistic viewport
        await page.setViewport(getDefaultViewport());

        // Override navigator properties
        await page.evaluateOnNewDocument(() => {
            // Override webdriver property
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });

            // Override plugins
            Object.defineProperty(navigator, 'plugins', {
                get: () => [
                    {
                        0: { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format' },
                        description: 'Portable Document Format',
                        filename: 'internal-pdf-viewer',
                        length: 1,
                        name: 'Chrome PDF Plugin'
                    },
                    {
                        0: { type: 'application/pdf', suffixes: 'pdf', description: '' },
                        description: '',
                        filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
                        length: 1,
                        name: 'Chrome PDF Viewer'
                    },
                    {
                        0: { type: 'application/x-nacl', suffixes: '', description: 'Native Client Executable' },
                        1: { type: 'application/x-pnacl', suffixes: '', description: 'Portable Native Client Executable' },
                        description: '',
                        filename: 'internal-nacl-plugin',
                        length: 2,
                        name: 'Native Client'
                    }
                ]
            });

            // Override languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en', 'zh-CN', 'zh']
            });

            // Override platform
            Object.defineProperty(navigator, 'platform', {
                get: () => 'Win32'
            });

            // Override hardwareConcurrency
            Object.defineProperty(navigator, 'hardwareConcurrency', {
                get: () => 8
            });

            // Override deviceMemory
            Object.defineProperty(navigator, 'deviceMemory', {
                get: () => 8
            });

            // Override permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );

            // Override chrome runtime
            window.chrome = {
                runtime: {},
                loadTimes: function() {},
                csi: function() {},
                app: {}
            };

            // Override WebGL vendor and renderer
            const getParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function(parameter) {
                if (parameter === 37445) {
                    return 'Intel Inc.';
                }
                if (parameter === 37446) {
                    return 'Intel Iris OpenGL Engine';
                }
                return getParameter.apply(this, [parameter]);
            };
        });

        logger.info('[RealBrowserMiddleware] Applied real browser settings to page');
    } catch (error) {
        logger.error('[RealBrowserMiddleware] Failed to apply settings:', error.message);
    }
}

/**
 * Launch browser with real browser middleware
 * @param {Object} options - Launch options
 * @returns {Promise<Object>} Browser instance
 */
async function launchRealBrowser(options = {}) {
    // Special handling for puppeteer-real-browser
    if (usePuppeteerRealBrowser && puppeteerRealBrowser) {
        logger.info('[RealBrowserMiddleware] Launching with puppeteer-real-browser');

        const { browser, page } = await puppeteerRealBrowser.connect({
            headless: options.headless !== false ? 'new' : false,
            args: options.args || [],
            customConfig: {
                userDataDir: options.userDataDir,
                chromePath: options.executablePath
            },
            turnstile: true,
            connectOption: {
                defaultViewport: options.defaultViewport || getDefaultViewport()
            },
            disableXvfb: false,
            ignoreAllFlags: false
        });

        return browser;
    }

    const puppeteer = initializePuppeteerExtra() || require('puppeteer');

    const defaultArgs = getRealBrowserArgs();
    const userArgs = options.args || [];

    // Merge args, avoiding duplicates
    const mergedArgs = [...new Set([...defaultArgs, ...userArgs])];

    const launchOptions = {
        ...options,
        args: mergedArgs,
        ignoreDefaultArgs: ['--enable-automation'],
        defaultViewport: options.defaultViewport || getDefaultViewport()
    };

    logger.info('[RealBrowserMiddleware] Launching browser with anti-detection settings');

    const browser = await puppeteer.launch(launchOptions);

    // Apply settings to all new pages
    browser.on('targetcreated', async (target) => {
        if (target.type() === 'page') {
            const page = await target.page();
            if (page) {
                await applyRealBrowserSettings(page);
            }
        }
    });

    return browser;
}

/**
 * Check if puppeteer-extra is available
 * @returns {boolean}
 */
function isPuppeteerExtraAvailable() {
    try {
        require('puppeteer-extra');
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Get list of loaded plugins
 * @returns {Array<string>}
 */
function getLoadedPlugins() {
    const plugins = [];

    if (StealthPlugin) plugins.push('stealth');
    if (AdblockerPlugin) plugins.push('adblocker');
    if (AnonymizeUAPlugin) plugins.push('anonymize-ua');
    if (UserPreferencesPlugin) plugins.push('user-preferences');

    return plugins;
}

/**
 * Check if using rebrowser
 * @returns {boolean}
 */
function isUsingRebrowser() {
    return useRebrowser;
}

/**
 * Check if using puppeteer-real-browser
 * @returns {boolean}
 */
function isUsingPuppeteerRealBrowser() {
    return usePuppeteerRealBrowser;
}

/**
 * Get current browser engine info
 * @returns {Object}
 */
function getBrowserEngineInfo() {
    return {
        useRebrowser,
        usePuppeteerRealBrowser,
        hasPuppeteerExtra: puppeteerExtra !== null,
        loadedPlugins: getLoadedPlugins()
    };
}

module.exports = {
    initializePuppeteerExtra,
    loadPuppeteerExtraPlugins,
    getRealBrowserArgs,
    getDefaultViewport,
    applyRealBrowserSettings,
    launchRealBrowser,
    isPuppeteerExtraAvailable,
    getLoadedPlugins,
    isUsingRebrowser,
    isUsingPuppeteerRealBrowser,
    getBrowserEngineInfo
};
