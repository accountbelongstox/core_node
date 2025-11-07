// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

const HtmlParse = require('#@ncore/utils/htmltool/libs/htmlparse.js');
const logger = require('#@logger');
const global_dir = require('#@global_dir');
const downloader = require('#@downloader');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { exec } = require('child_process');
const os = require('os');
const cheerio = require('cheerio');

const DomainContext = require('../libs/domain_context.js');
const FileMapper = require('../libs/file_mapper.js');
const UrlQueue = require('../libs/url_queue.js');
const PageFetcher = require('../services/page_fetcher.js');
const PuppeteerBrowser = require('#@puppeteer');
const UrlRewriter = require('../services/url_rewriter.js');
const SitemapGenerator = require('../services/sitemap_generator.js');
const BackupManager = require('../libs/backup_manager.js');

const UnifiedResourceProcessor = require('#@ncore/utils/web_offline/unified_resource_processor.js');

const PuppeteerSpiderModule = require('#@puppeteer');
const { ResourceProxyServer, ResourceDownloadUtils } = require('#@ncore/utils/puppeteer_spider_v2/main.js');
const TampermonkeyServer = require('#@ncore/utils/puppeteer_spider_v2/src/utils/tampermonkey/TampermonkeyServer.js');

class CrawlController {
  constructor() {
    this.domainContext = null;
    this.queue = new UrlQueue();
    this.urlPool = new Set();
    this.maxDepth = 3;
    this.fileMapper = new FileMapper(new Set([
      '.html', '.htm', '.xhtml', '.xml', '.json', '.txt', '.csv',
      '.pdf', '.zip', '.gz', '.rar', '.7z', '.png', '.jpg', '.jpeg', '.gif',
      '.svg', '.webp', '.ico', '.css', '.js', '.mp3', '.mp4', '.avi', '.mov', '.m4v', '.webm',
      '.woff', '.woff2', '.ttf', '.otf', '.eot'
    ]));
    this.fetcher = null;
    this.fetcherType = 'http';
    this.resourceProcessor = null;
    this.sitemapGenerator = new SitemapGenerator();
    this.backupManager = new BackupManager(5);
    this.autoOpenFolder = true;
    this.downloadedUrls = [];
    this.failedUrls = [];
    this.finalHostDir = null;
    this.disableJs = false;
    this.screenshot = false;
    this.screenshotsDir = null;
    this.pageScreenshots = new Map();
    this.proxyServer = null;
    this.resourceDownloadUtils = null;
    this.tampermonkeyServer = null;
    this.tampermonkeySessionPromise = null;
    this.tampermonkeySessionResolver = null;
    this.tampermonkeySessionRejecter = null;
    this.tampermonkeyPagesReceived = 0;
    this.tampermonkeyCompletionData = null;
    this.tampermonkeyPageHandler = null;
    this.tampermonkeyCompleteHandler = null;
    this.tampermonkeyErrorHandler = null;
    this.tampermonkeySessionActive = false;
  }

  openFolderInExplorer(folderPath) {
    if (!fs.existsSync(folderPath)) {
      logger.warn(`Folder does not exist yet, will be created during download`);
      return;
    }

    const platform = os.platform();
    let command;

    try {
      if (platform === 'win32') {
        command = `explorer "${folderPath}"`;
      } else if (platform === 'darwin') {
        command = `open "${folderPath}"`;
      } else if (platform === 'linux') {
        command = `xdg-open "${folderPath}"`;
      }

      if (command) {
        exec(command);
        logger.warn(`Opening download folder in system explorer...`);
      }
    } catch (error) {
      logger.warn(`Could not auto-open folder, please navigate to: ${folderPath}`);
    }
  }

  async start(argv = process.argv.slice(2)) {
    const { targetUrl, depth, fetcherType, scopeType, autoConfirm, autoOpenFolder, disableJs, screenshot, debug } = this.parseArguments(argv);
    this.domainContext = new DomainContext(targetUrl);
    this.resourceProcessor = new UnifiedResourceProcessor(
      this.domainContext,
      this.fileMapper,
      downloader,
      logger
    );
    this.maxDepth = depth;
    this.autoConfirm = autoConfirm;
    this.autoOpenFolder = autoOpenFolder;
    this.disableJs = disableJs;
    this.screenshot = screenshot;
    this.debug = debug;
    this.downloadedUrls = [];

    logger.info(`Starting document offline analysis for: ${targetUrl}`);
    logger.info(`Recursion depth: ${depth}`);
    logger.info(`Hostname validation: ${this.domainContext.getValidationDomain()}`);
    logger.info(`Primary origin: ${this.domainContext.getOrigin()}`);
    if (this.domainContext.getScopeUrl() !== this.domainContext.getOrigin()) {
      logger.info(`Scope root: ${this.domainContext.getScopeUrl()}`);
    }

    await this.selectDownloadScope(scopeType);
    await this.selectFetcherMethod(fetcherType);
    await this.selectJsDisabling();
    await this.selectScreenshot();

    const parsed = new URL(this.domainContext.getOrigin());
    const hostDir = path.join(global_dir.COMMON_CACHE_DIR, 'DocumentOffline', parsed.hostname);
    this.finalHostDir = await this.prepareDownloadDirectory(hostDir);

    if (this.screenshot && this.fetcherType === 'puppeteer') {
      this.screenshotsDir = path.join(this.finalHostDir, 'screenshots');
      this.ensureDirectory(this.screenshotsDir);
      logger.success(`Screenshots directory created: ${this.screenshotsDir}`);
    }

    this.ensureDirectory(this.finalHostDir);
    if (this.autoOpenFolder) {
      logger.info(`Auto-open folder enabled, opening: ${this.finalHostDir}`);
      this.openFolderInExplorer(this.finalHostDir);
    }

    const canonicalTarget = this.domainContext.getStartUrl();
    this.queue.enqueue(canonicalTarget, 0);
    this.urlPool.add(canonicalTarget);

    if (this.fetcherType === 'iframe' || this.fetcherType === 'puppeteer') {
      await this.initializeProxyServer();
    }

    try {
      if (this.fetcherType === 'tampermonkey') {
        await this.runTampermonkeyFlow(canonicalTarget);
      } else {
        await this.processQueue();
      }
      await this.generateSitemap(this.finalHostDir);
      await this.generateMapsite(this.finalHostDir);
      await this.saveFailedUrlsReport(this.finalHostDir);
      this.printDownloadSummary();
      await this.pauseForNextStep();
    } catch (error) {
      logger.error(`Processing failed: ${error.message}`);
      throw error;
    } finally {
      await this.cleanupFetcher();
    }
  }

  async selectDownloadScope(scopeType) {
    if (scopeType === 'full' || scopeType === 'path') {
      this.applyScopeType(scopeType);
      logger.success(`Download scope set to: ${scopeType === 'full' ? 'Full Site' : 'Current Path Only'}`);
      return;
    }

    return new Promise((resolve) => {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

      logger.info('\n========================================');
      logger.info('Select Download Scope:');
      logger.info('========================================');
      logger.info('1. Full Site (download entire domain)');
      logger.info('2. Current Path Only (download only URLs under the specified path)');
      logger.info('========================================');
      logger.info(`Target URL: ${this.domainContext.getStartUrl()}`);
      logger.info(`Domain: ${this.domainContext.getOrigin()}`);
      logger.info(`Path Scope: ${this.domainContext.getScopeUrl()}`);
      logger.info('========================================\n');

      rl.question('Enter your choice (1 or 2, default is 1): ', (answer) => {
        rl.close();

        const choice = answer.trim() || '1';
        const selectedScope = choice === '2' ? 'path' : 'full';

        this.applyScopeType(selectedScope);
        logger.success(`Download scope set to: ${selectedScope === 'full' ? 'Full Site' : 'Current Path Only'}`);

        resolve();
      });
    });
  }

  applyScopeType(scopeType) {
    this.scopeType = scopeType;

    if (scopeType === 'path') {
      logger.info(`Path scope validation enabled: only URLs under path ${this.domainContext.getScopeUrl()} will be downloaded`);
    } else {
      const originalIsWithinScope = this.domainContext.isWithinScope.bind(this.domainContext);
      this.domainContext.isWithinScope = () => true;
      logger.info(`Full site scope enabled: all URLs under domain ${this.domainContext.getOrigin()} will be downloaded (path restriction removed)`);
    }
  }

  async selectFetcherMethod(fetcherType) {
    if (fetcherType === 'http' || fetcherType === 'puppeteer' || fetcherType === 'iframe' || fetcherType === 'tampermonkey') {
      await this.applyFetcherType(fetcherType);
      return;
    }

    return new Promise((resolve) => {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

      logger.info('\n========================================');
      logger.info('Select Fetcher Method:');
      logger.info('========================================');
      logger.info('1. HTTP Request (faster, gets source HTML)');
      logger.info('2. Puppeteer Browser (slower, gets rendered HTML with JavaScript execution)');
      logger.info('3. Iframe Force Download (extracts iframe content by clicking all links inside)');
      logger.info('4. Tampermonkey Browser Session (use logged-in browser with userscript bridge)');
      logger.info('========================================\n');

      rl.question('Enter your choice (1, 2, 3, or 4, default is 1): ', async (answer) => {
        rl.close();

        const choice = answer.trim() || '1';
        let selectedType = 'http';
        if (choice === '2') {
          selectedType = 'puppeteer';
        } else if (choice === '3') {
          selectedType = 'iframe';
        } else if (choice === '4') {
          selectedType = 'tampermonkey';
        }

        await this.applyFetcherType(selectedType);

        resolve();
      });
    });
  }

  async applyFetcherType(fetcherType) {
    if (fetcherType === 'puppeteer') {
      this.fetcherType = 'puppeteer';
      this.fetcher = new PuppeteerSpiderModule.Fetcher();
      await this.fetcher.initialize('edge', { headless: !this.debug });
      logger.success(`Using Puppeteer Browser for fetching (renders JavaScript)${this.debug ? ' [DEBUG MODE: Browser Visible]' : ''}`);
    } else if (fetcherType === 'iframe') {
      this.fetcherType = 'iframe';
      this.fetcher = new PuppeteerSpiderModule.Fetcher();
      await this.fetcher.initialize('edge', { headless: !this.debug });
      logger.success(`Using Iframe Force Download mode (extracts iframe content with link clicking)${this.debug ? ' [DEBUG MODE: Browser Visible]' : ''}`);
    } else if (fetcherType === 'tampermonkey') {
      this.fetcherType = 'tampermonkey';
      this.fetcher = null;
      logger.success('Using Tampermonkey Browser workflow (userscript bridge will push rendered HTML)');
    } else {
      this.fetcherType = 'http';
      this.fetcher = new PageFetcher(this.fileMapper);
      logger.success('Using HTTP Request for fetching (source HTML only)');
    }
  }

  async selectJsDisabling() {
    if (this.disableJs === true) {
      logger.success('JavaScript disabling: ENABLED (script tags will be removed from HTML)');
      return;
    }

    if (this.autoConfirm) {
      logger.info('JavaScript disabling: DISABLED (auto-confirm mode)');
      return;
    }

    return new Promise((resolve) => {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

      logger.info('\n========================================');
      logger.info('Remove JavaScript Tags from HTML?');
      logger.info('========================================');
      logger.info('Note: Script tags will be removed from HTML');
      logger.info('      but JavaScript files will still be downloaded locally');
      logger.info('========================================\n');

      rl.question('Remove JavaScript tags from HTML? (y/n, default is n): ', (answer) => {
        rl.close();

        const choice = answer.trim().toLowerCase() || 'n';
        this.disableJs = choice === 'y' || choice === 'yes';

        if (this.disableJs) {
          logger.success('JavaScript disabling: ENABLED (script tags will be removed from HTML)');
        } else {
          logger.success('JavaScript disabling: DISABLED (script tags will be kept)');
        }

        resolve();
      });
    });
  }

  stripScriptTags(html) {
    const $ = cheerio.load(html, { decodeEntities: false });
    $('script').remove();
    return $.html();
  }

  async selectScreenshot() {
    if (this.fetcherType === 'http' || this.fetcherType === 'tampermonkey') {
      logger.info('Screenshot feature is only available with Puppeteer fetcher');
      this.screenshot = false;
      return;
    }

    if (this.screenshot === true) {
      logger.success('Screenshot feature: ENABLED (will capture screenshots of each HTML page)');
      return;
    }

    if (this.autoConfirm) {
      logger.info('Screenshot feature: DISABLED (auto-confirm mode)');
      return;
    }

    return new Promise((resolve) => {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

      logger.info('\n========================================');
      logger.info('Capture Screenshots of HTML Pages?');
      logger.info('========================================');
      logger.info('Note: Screenshots will be captured using Puppeteer browser');
      logger.info('      and saved in a "screenshots" directory');
      logger.info('========================================\n');

      rl.question('Capture screenshots of HTML pages? (y/n, default is n): ', (answer) => {
        rl.close();

        const choice = answer.trim().toLowerCase() || 'n';
        this.screenshot = choice === 'y' || choice === 'yes';

        if (this.screenshot) {
          logger.success('Screenshot feature: ENABLED (will capture screenshots of each HTML page)');
        } else {
          logger.success('Screenshot feature: DISABLED');
        }

        resolve();
      });
    });
  }

  resetTampermonkeySession() {
    this.tampermonkeySessionPromise = null;
    this.tampermonkeySessionResolver = null;
    this.tampermonkeySessionRejecter = null;
    this.tampermonkeyPagesReceived = 0;
    this.tampermonkeyCompletionData = null;
    this.tampermonkeySessionActive = false;
  }

  async setupTampermonkeyServer() {
    await this.shutdownTampermonkeyServer();
    this.resetTampermonkeySession();

    this.tampermonkeyServer = TampermonkeyServer.getInstance();
    await this.tampermonkeyServer.ensureStarted();

    this.tampermonkeyPageHandler = async (pageData) => {
      await this.handleTampermonkeyPage(pageData);
    };
    this.tampermonkeyCompleteHandler = async (payload) => {
      await this.handleTampermonkeyCompletion(payload);
    };
    this.tampermonkeyErrorHandler = (error) => {
      this.handleTampermonkeyError(error);
    };

    this.tampermonkeyServer.on('page', this.tampermonkeyPageHandler);
    this.tampermonkeyServer.on('complete', this.tampermonkeyCompleteHandler);
    this.tampermonkeyServer.on('error', this.tampermonkeyErrorHandler);
    this.tampermonkeySessionActive = true;

    logger.success('[TAMPERMONKEY] Bridge ready on http://127.0.0.1:8765 (WS enabled)');
    return this.tampermonkeyServer;
  }

  async runTampermonkeyFlow(initialUrl) {
    const server = await this.setupTampermonkeyServer();
    this.logTampermonkeyInstructions(initialUrl);
    this.openUrlInBrowser(initialUrl);
    server.broadcastConfig({
      startUrl: initialUrl,
      maxDepth: this.maxDepth,
      scopeType: this.scopeType,
      sameOriginOnly: true,
      skipHashLinks: true
    });
    server.sendCommand('focus-url', { url: initialUrl });
    server.sendCommand('startPageCrawl', {
      url: initialUrl,
      maxDepth: this.maxDepth,
      trigger: 'cli'
    });
    logger.info('[TAMPERMONKEY] Waiting for browser script to send pages...');
    await this.waitForTampermonkeyCompletion();
    logger.success(`[TAMPERMONKEY] Session completed. Pages received: ${this.tampermonkeyPagesReceived}`);
  }

  waitForTampermonkeyCompletion() {
    if (!this.tampermonkeySessionPromise) {
      this.tampermonkeySessionPromise = new Promise((resolve, reject) => {
        this.tampermonkeySessionResolver = resolve;
        this.tampermonkeySessionRejecter = reject;
      });
    }
    return this.tampermonkeySessionPromise;
  }

  async handleTampermonkeyPage(pageData) {
    if (!this.tampermonkeySessionActive) {
      logger.info('[TAMPERMONKEY] Ignoring page payload (session inactive)');
      return;
    }

    try {
      const sourceUrl = pageData?.url || pageData?.originalUrl;
      if (!sourceUrl || !pageData?.content) {
        logger.warn('[TAMPERMONKEY] Received invalid payload without URL or content, skipping');
        return;
      }

      const canonicalUrl = this.domainContext.canonicalize(sourceUrl) || sourceUrl;

      if (!this.domainContext.isInternalLink(canonicalUrl)) {
        if (this.scopeType === 'path' && !this.domainContext.isWithinScope(canonicalUrl)) {
          logger.warn(`[TAMPERMONKEY] Skipping out-of-scope URL: ${sourceUrl}`);
          return;
        }
        logger.warn(`[TAMPERMONKEY] External domain detected from browser payload: ${sourceUrl}`);
      }

      const descriptor = pageData.sourceType === 'iframe' ? 'Iframe page' : 'Page';
      logger.info(`[TAMPERMONKEY] ${descriptor} depth=${pageData.depth ?? 0}: ${canonicalUrl}`);

      await this.savePage(canonicalUrl, pageData.content, false);
      this.tampermonkeyPagesReceived += 1;
    } catch (error) {
      const failedUrl = pageData?.url || pageData?.originalUrl || 'unknown';
      logger.error(`[TAMPERMONKEY] Failed to persist ${failedUrl}: ${error.message}`);
      this.failedUrls.push({
        url: failedUrl,
        linkText: pageData?.linkText || '',
        error: error.message,
        timestamp: new Date().toISOString(),
        mode: 'tampermonkey'
      });
    }
  }

  async handleTampermonkeyCompletion(payload) {
    const reported = payload?.totalPages ?? 0;
    logger.success(`[TAMPERMONKEY] Browser workflow reported completion. Pages: ${reported}`);

    this.tampermonkeySessionActive = false;

    if (Array.isArray(payload?.failedUrls)) {
      payload.failedUrls.forEach((url) => {
        this.failedUrls.push({
          url: url,
          linkText: '',
          error: 'Tampermonkey script reported failure',
          timestamp: new Date().toISOString(),
          mode: 'tampermonkey'
        });
      });
      if (payload.failedUrls.length > 0) {
        logger.warn(`[TAMPERMONKEY] Script reported ${payload.failedUrls.length} failed URLs`);
      }
    }

    this.tampermonkeyCompletionData = payload || null;
    if (this.tampermonkeySessionResolver) {
      this.tampermonkeySessionResolver(payload);
      this.tampermonkeySessionResolver = null;
    }
  }

  handleTampermonkeyError(error) {
    logger.error(`[TAMPERMONKEY] Server error: ${error.message}`);
    this.tampermonkeySessionActive = false;
    if (this.tampermonkeySessionRejecter) {
      this.tampermonkeySessionRejecter(error);
      this.tampermonkeySessionRejecter = null;
    }
  }

  async shutdownTampermonkeyServer() {
    if (!this.tampermonkeyServer) {
      this.resetTampermonkeySession();
      return;
    }

    if (this.tampermonkeyPageHandler) {
      this.tampermonkeyServer.off('page', this.tampermonkeyPageHandler);
      this.tampermonkeyPageHandler = null;
    }

    if (this.tampermonkeyCompleteHandler) {
      this.tampermonkeyServer.off('complete', this.tampermonkeyCompleteHandler);
      this.tampermonkeyCompleteHandler = null;
    }

    if (this.tampermonkeyErrorHandler) {
      this.tampermonkeyServer.off('error', this.tampermonkeyErrorHandler);
      this.tampermonkeyErrorHandler = null;
    }

    this.tampermonkeyServer = null;
    this.resetTampermonkeySession();
  }

  logTampermonkeyInstructions(initialUrl) {
    const scriptPath = 'ncore/utils/puppeteer_spider_v2/src/utils/tampermonkey/DocumentOffline_Crawler.user.js';
    logger.info('\n========================================');
    logger.info('Tampermonkey Browser Workflow');
    logger.info('========================================');
    logger.info('1. Install/enable the DocumentOffline Tampermonkey script:');
    logger.info(`   ${scriptPath}`);
    logger.info('2. Confirm the script WS endpoint points to ws://127.0.0.1:8765/ws');
    logger.info(`3. The target URL will open automatically: ${initialUrl}`);
    logger.info('4. The floating panel will reflect server commands automatically.');
    logger.info('5. Progress is streamed into this app; close the panel when finished.');
    logger.info('========================================\n');
  }

  openUrlInBrowser(targetUrl) {
    try {
      const platform = os.platform();
      let command = null;

      if (platform === 'win32') {
        command = `start "" "${targetUrl}"`;
      } else if (platform === 'darwin') {
        command = `open "${targetUrl}"`;
      } else {
        command = `xdg-open "${targetUrl}"`;
      }

      if (command) {
        exec(command, { shell: true }, (error) => {
          if (error) {
            logger.warn(`[TAMPERMONKEY] Unable to open browser automatically: ${error.message}`);
          } else {
            logger.info('[TAMPERMONKEY] Opening target URL in default browser...');
          }
        });
      }
    } catch (error) {
      logger.warn(`[TAMPERMONKEY] Could not launch browser: ${error.message}`);
    }
  }

  generateScreenshotName(htmlPath) {
    const parsed = new URL(htmlPath);
    let pathName = this.fileMapper.mapPath(parsed);

    if (pathName === 'index.html') {
      return 'index.jpg';
    }

    return pathName.replace(/\.html?$/, '').replace(/\//g, '|') + '.jpg';
  }

  async capturePageScreenshot(url) {
    if (!this.screenshot || this.fetcherType !== 'puppeteer' || !this.screenshotsDir) {
      return null;
    }

    const screenshotName = this.generateScreenshotName(url);
    const screenshotPath = path.join(this.screenshotsDir, screenshotName);

    try {
      const screenshotDir = path.dirname(screenshotPath);
      this.ensureDirectory(screenshotDir);

      // CRITICAL: Switch to the URL's page before taking screenshot
      // The Puppeteer spider may have multiple tabs open, and we need to ensure
      // we're capturing the correct page
      if (this.fetcher && this.fetcher.driver && this.fetcher.driver.encapsulatedPageFuncs) {
        const pageFuncs = this.fetcher.driver.encapsulatedPageFuncs;

        try {
          // Find and switch to the page that has this URL loaded
          await pageFuncs.switchToPageByUrl(url);
          logger.info(`[DEBUG-SCREENSHOT] Switched to page for URL: ${url}`);

          // Give a brief moment for page to settle after switching
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (switchError) {
          logger.warn(`[DEBUG-SCREENSHOT] Could not switch to page for ${url}: ${switchError.message}, proceeding with current active page`);
        }
      }

      await this.fetcher.takeScreenshot(screenshotPath, {
        fullPage: true,
        quality: 80
      });
      logger.info(`Screenshot captured: ${screenshotName}`);
      this.pageScreenshots.set(url, screenshotName);
      return screenshotName;
    } catch (error) {
      logger.warn(`Failed to capture screenshot for ${url}: ${error.message}`);
      return null;
    }
  }

  async initializeProxyServer() {
    try {
      this.proxyServer = new ResourceProxyServer({
        host: 'localhost',
        port: 0,
        tempDir: path.join(this.finalHostDir, '.temp_resources')
      });

      const serverInfo = await this.proxyServer.start();
      logger.success(`[PROXY] Resource proxy server started at ${serverInfo.url}`);

      if (this.resourceProcessor && this.fetcher) {
        const page = await this.fetcher.getPage();
        this.resourceProcessor.setProxyServer(this.proxyServer, page);
        logger.info('[PROXY] Proxy server configured with resource processor');
      }

      return serverInfo;
    } catch (error) {
      logger.error(`Failed to initialize proxy server: ${error.message}`);
      throw error;
    }
  }

  async cleanupFetcher() {
    if (this.proxyServer && this.proxyServer.isRunning) {
      try {
        await this.proxyServer.stop();
        this.proxyServer.cleanupTempFiles();
        logger.info('[PROXY] Resource proxy server stopped and cleaned up');
      } catch (error) {
        logger.error(`Failed to cleanup proxy server: ${error.message}`);
      }
    }

    if (this.fetcherType === 'puppeteer' && this.fetcher && this.fetcher.cleanup) {
      try {
        await this.fetcher.cleanup();
      } catch (error) {
        logger.error(`Failed to cleanup fetcher: ${error.message}`);
      }
    }

    if (this.tampermonkeyServer) {
      await this.shutdownTampermonkeyServer();
    }
  }

  async prepareDownloadDirectory(baseHostDir) {
    const parentDir = path.dirname(baseHostDir);
    const dirName = path.basename(baseHostDir);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').substring(0, 19);

    if (!fs.existsSync(baseHostDir)) {
      logger.info(`Creating new download directory: ${dirName}`);
      return baseHostDir;
    }

    const stats = fs.statSync(baseHostDir);
    if (!stats.isDirectory()) {
      logger.warn(`Path exists but is not a directory, creating timestamped directory`);
      const newDirName = `${dirName}_${timestamp}`;
      return path.join(parentDir, newDirName);
    }

    const files = fs.readdirSync(baseHostDir);
    if (files.length === 0) {
      logger.info(`Directory exists but is empty, reusing: ${dirName}`);
      return baseHostDir;
    }

    logger.warn('\n========================================');
    logger.warn('Existing downloads found:');
    logger.warn('========================================');

    const entries = fs.readdirSync(parentDir, { withFileTypes: true });
    const relatedDirs = entries
      .filter(entry => entry.isDirectory() && (entry.name === dirName || entry.name.startsWith(dirName + '_')))
      .map(entry => ({
        name: entry.name,
        path: path.join(parentDir, entry.name),
        mtime: fs.statSync(path.join(parentDir, entry.name)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime);

    for (const dir of relatedDirs) {
      logger.warn(`  📁 ${dir.name} (modified: ${dir.mtime.toISOString()})`);
    }

    const newDirName = `${dirName}_${timestamp}`;
    const newHostDir = path.join(parentDir, newDirName);

    logger.info('========================================');
    logger.success(`Creating new directory with timestamp:`);
    logger.success(`  📂 ${newDirName}`);
    logger.info('========================================\n');

    return newHostDir;
  }

  parseArguments(argv) {
    let index = 0;
    if (argv.length > 0 && argv[0].startsWith('app=')) {
      index = 1;
    }

    if (argv.length <= index) {
      this.printUsage();
      throw new Error('Missing URL argument');
    }

    const rawUrl = argv[index];
    let depth = 3;
    let fetcherType = null;
    let scopeType = null;
    let autoConfirm = false;
    let autoOpenFolder = true;
    let disableJs = false;
    let screenshot = false;
    let debug = false;

    for (let i = index + 1; i < argv.length; i++) {
      const arg = argv[i];

      if (arg.startsWith('--fetcher=')) {
        fetcherType = arg.substring('--fetcher='.length).toLowerCase();
      } else if (arg.startsWith('--scope=')) {
        scopeType = arg.substring('--scope='.length).toLowerCase();
      } else if (arg === '--auto-confirm' || arg === '-y' || arg === '--yes') {
        autoConfirm = true;
      } else if (arg === '--no-open' || arg === '--no-explorer') {
        autoOpenFolder = false;
      } else if (arg === '--no-js' || arg === '--disable-js') {
        disableJs = true;
      } else if (arg === '--screenshot') {
        screenshot = true;
      } else if (arg === '--debug' || arg === '-d') {
        debug = true;
      } else if (!arg.startsWith('--') && !arg.startsWith('-')) {
        const parsedDepth = parseInt(arg, 10);
        if (!Number.isNaN(parsedDepth)) {
          depth = Math.max(parsedDepth, 0);
        }
      }
    }

    if (!rawUrl || !this.isValidUrl(rawUrl)) {
      this.printUsage();
      throw new Error(`Invalid URL: ${rawUrl}`);
    }

    return {
      targetUrl: rawUrl,
      depth,
      fetcherType,
      scopeType,
      autoConfirm,
      autoOpenFolder,
      disableJs,
      screenshot,
      debug
    };
  }

  printUsage() {
    logger.info('Usage: node main.js app=DocumentOffline <url> [depth] [options]');
    logger.info('');
    logger.info('Arguments:');
    logger.info('  <url>                   Target URL to download');
    logger.info('  [depth]                 Recursion depth (default: 3)');
    logger.info('');
    logger.info('Options:');
    logger.info('  --fetcher=<type>        Fetcher type: http, puppeteer, iframe, tampermonkey (default: prompt)');
    logger.info('  --scope=<type>          Download scope: full, path (default: prompt)');
    logger.info('  --no-js                 Remove all script tags from HTML (default: keep JS)');
    logger.info('  --disable-js            Same as --no-js');
    logger.info('  --screenshot            Capture screenshots for HTML pages (puppeteer only)');
    logger.info('  --debug, -d             Show browser window (non-headless mode)');
    logger.info('  --auto-confirm, -y      Auto-confirm without prompts');
    logger.info('  --no-open               Do NOT open folder in explorer after download');
    logger.info('');
    logger.info('Examples:');
    logger.info('  node main.js app=DocumentOffline https://example.com 3');
    logger.info('  node main.js app=DocumentOffline https://example.com --fetcher=http');
    logger.info('  node main.js app=DocumentOffline https://example.com --no-js -y');
    logger.info('  node main.js app=DocumentOffline https://example.com --fetcher=puppeteer --debug');
    logger.info('  node main.js app=DocumentOffline https://example.com --fetcher=iframe --debug --screenshot');
    logger.info('  node main.js app=DocumentOffline https://secure.example.com --fetcher=tampermonkey');
  }

  isValidUrl(value) {
    try {
      new URL(value);
      return true;
    } catch (error) {
      return false;
    }
  }

  async processQueue() {
    const maxRetries = 3;
    const retryDelay = 1000;

    while (this.queue.hasPending()) {
      const item = this.queue.dequeue();
      if (!item) {
        break;
      }

      const { url, depth } = item;
      if (depth > this.maxDepth) {
        continue;
      }
      if (this.queue.hasProcessed(url)) {
        continue;
      }

      this.queue.markProcessed(url);
      logger.info(`Processing depth ${depth}: ${url}`);

      let fetchResult;
      let lastError;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          if (this.fetcherType === 'iframe') {
            const self = this;
            let iframeDomain = null;

            fetchResult = await this.fetcher.fetchIframeContentRecursive(url, {
              maxDepth: 10,
              delay: 1000,
              maxLinksPerPage: Infinity,
              sameOriginOnly: true,
              skipHashLinks: true,
              onPageCallback: async (pageResult, totalProcessed, depth) => {
                const content = pageResult.content;
                const len = content.length;
                const head = content.substring(0, 100).replace(/\s+/g, ' ');
                const mid = len > 200 ? content.substring(Math.floor(len / 2) - 25, Math.floor(len / 2) + 25).replace(/\s+/g, ' ') : '';
                const tail = len > 100 ? content.substring(len - 50).replace(/\s+/g, ' ') : '';
                logger.info(`[RECURSIVE] Depth ${depth}, Page ${totalProcessed}: len=${len} | head="${head}" | mid="${mid}" | tail="${tail}"`);

                const pageUrl = pageResult.url || pageResult.originalUrl;

                if (!iframeDomain) {
                  try {
                    const parsedUrl = new URL(pageUrl);
                    iframeDomain = `${parsedUrl.protocol}//${parsedUrl.hostname}`;
                    logger.info(`[IFRAME-RECURSIVE] Detected iframe domain: ${iframeDomain}`);
                  } catch (error) {
                    logger.warn(`[IFRAME-RECURSIVE] Could not parse iframe URL: ${pageUrl}`);
                  }
                }

                let isInternal = false;
                if (iframeDomain) {
                  try {
                    const parsedPageUrl = new URL(pageUrl);
                    const pageDomain = `${parsedPageUrl.protocol}//${parsedPageUrl.hostname}`;
                    isInternal = pageDomain === iframeDomain;
                  } catch (error) {
                    isInternal = false;
                  }
                } else {
                  isInternal = self.domainContext.isInternalLink(pageUrl);
                }

                if (isInternal) {
                  await self.savePage(pageUrl, content, false);
                } else {
                  logger.warn(`[IFRAME-RECURSIVE] Skipping external link: ${pageUrl} (iframe domain: ${iframeDomain})`);
                }
              },
              onFailedCallback: async (failedResult) => {
                const targetUrl = failedResult.targetUrl || failedResult.linkHref;
                const linkText = failedResult.linkText || '';
                const error = failedResult.error || 'Unknown error';
                const depth = failedResult.depth || 0;

                logger.error(`[IFRAME-RECURSIVE-FAILED] Depth ${depth}: "${linkText}" -> ${targetUrl} (${error})`);

                self.failedUrls.push({
                  url: targetUrl,
                  linkText: linkText,
                  error: error,
                  depth: depth,
                  timestamp: new Date().toISOString(),
                  mode: 'iframe-recursive'
                });
              }
            });
          } else {
            fetchResult = await this.fetcher.fetch(url);
          }
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          if (attempt < maxRetries) {
            const delay = retryDelay * Math.pow(2, attempt - 1);
            logger.warn(`Retry ${attempt}/${maxRetries} for ${url} after ${delay}ms. Error: ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            logger.error(`Failed to download ${url} after ${maxRetries} attempts: ${error.message}`);
          }
        }
      }

      if (lastError) {
        this.failedUrls.push({
          url: url,
          linkText: '',
          error: lastError.message,
          timestamp: new Date().toISOString(),
          mode: this.fetcherType
        });
        continue;
      }

      try {
        if (this.fetcherType === 'iframe') {
          logger.info(`[DEBUG] Iframe content extracted, pages will be saved as they were processed`);
        } else {
          await this.savePage(url, fetchResult.content, fetchResult.isBinary);
        }
      } catch (error) {
        logger.error(`Failed to save ${url}: ${error.message}`);
        logger.error(`Stack trace: ${error.stack}`);
        this.queue.requeue(item);
        continue;
      }

      if (this.fetcherType !== 'iframe' && depth < this.maxDepth && fetchResult.isText) {
        await this.analysePage(url, fetchResult.content, depth);
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    logger.info('Queue completed.');
  }


  async savePage(targetUrl, content, isBinary = false) {
    logger.info(`[DEBUG-SAVE-1] Saving: ${targetUrl}, isBinary=${isBinary}`);

    const canonical = this.domainContext.canonicalize(targetUrl) || targetUrl;
    const parsed = new URL(canonical);
    const relativePath = this.fileMapper.mapPath(parsed);

    let hostDir = this.finalHostDir;
    const isExternal = !this.domainContext.isInternalLink(canonical);
    if (isExternal) {
      const parentDir = path.dirname(this.finalHostDir);
      hostDir = path.join(parentDir, parsed.hostname);
      logger.info(`[DEBUG-SAVE-1.5] External domain detected: ${parsed.hostname}, using hostDir: ${hostDir}`);
    }

    const finalPath = path.join(hostDir, relativePath);

    const directory = path.dirname(finalPath);
    this.ensureDirectory(directory);

    let finalContent = content;
    let collectedResources = null;

    if (!isBinary && this.isHtmlContent(relativePath)) {
      if ((this.fetcherType === 'puppeteer' || this.fetcherType === 'iframe') && this.fetcher && typeof this.fetcher.collectResources === 'function') {
        logger.info(`[RESOURCE-COLLECTION] Collecting resources with xpath mapping for: ${canonical}`);
        try {
          collectedResources = await this.fetcher.collectResources({
            waitForNetwork: true,
            waitTime: 1000,
            includeIframes: this.fetcherType === 'iframe',
            includeDataUrls: false
          });

          if (collectedResources) {
            logger.success(`[RESOURCE-COLLECTION] Collected ${collectedResources.stats.total} resources (${collectedResources.stats.matched} matched with interception)`);
            logger.info(`[RESOURCE-COLLECTION] By source: ${JSON.stringify(collectedResources.stats.bySourceType)}`);

            const resourceMapFile = path.join(hostDir, `.resource_map_${path.basename(relativePath, path.extname(relativePath))}.json`);
            const collector = this.fetcher.getResourceCollector();
            if (collector) {
              const jsonOutput = collector.exportToJson(false);
              await fs.promises.writeFile(resourceMapFile, JSON.stringify(jsonOutput, null, 2), 'utf8');
              logger.info(`[RESOURCE-COLLECTION] Resource map saved to: ${path.basename(resourceMapFile)}`);
            }
          }
        } catch (error) {
          logger.warn(`[RESOURCE-COLLECTION] Failed to collect resources: ${error.message}`);
        }
      }

      logger.info(`[DEBUG-SAVE-2] Processing HTML: extracting, downloading, and rewriting resources`);
      const result = await this.resourceProcessor.processPageResources(content, canonical, hostDir);
      finalContent = result.html;
      logger.info(`[DEBUG-SAVE-3] Processed ${result.resourcesProcessed} resources for: ${canonical}`);

      if (this.disableJs) {
        logger.info(`[DEBUG-SAVE-3.5] Removing JavaScript tags from HTML`);
        finalContent = this.stripScriptTags(finalContent);
        logger.info(`[DEBUG-SAVE-3.7] JavaScript tags removed from HTML`);
      }
    } else if (!isBinary && this.isCssContent(relativePath)) {
      logger.info(`[DEBUG-SAVE-4] Processing CSS: rewriting URLs`);
      finalContent = this.resourceProcessor.rewriteCss(content, canonical);
      logger.info(`[DEBUG-SAVE-5] CSS rewritten: ${canonical}`);
    }

    logger.info(`[DEBUG-SAVE-6] Writing file to: ${finalPath}`);
    if (isBinary) {
      await fs.promises.writeFile(finalPath, finalContent);
    } else {
      await fs.promises.writeFile(finalPath, finalContent, 'utf8');
    }
    logger.info(`[DEBUG-SAVE-7] File saved: ${path.relative(this.finalHostDir, finalPath)}`);

    if (!isBinary && this.isHtmlContent(relativePath) && this.screenshot && this.fetcherType === 'puppeteer') {
      logger.info(`[DEBUG-SAVE-8] Capturing screenshot for: ${canonical}`);
      await this.capturePageScreenshot(canonical);
    }

    this.sitemapGenerator.addUrl(canonical);
    this.downloadedUrls.push(canonical);
  }

  isHtmlContent(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ['.html', '.htm', '.xhtml'].includes(ext);
  }

  isCssContent(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.css';
  }

  async downloadResources(resources, hostDir) {
    const allUrls = [
      ...resources.css,
      ...resources.js,
      ...resources.images,
      ...resources.fonts,
      ...resources.media
    ];

    if (allUrls.length === 0) {
      return;
    }

    logger.info(`Found ${allUrls.length} resources to download (CSS: ${resources.css.length}, JS: ${resources.js.length}, Images: ${resources.images.length}, Fonts: ${resources.fonts.length}, Media: ${resources.media.length})`);

    const stats = await this.resourceProcessor.downloadResources(resources, hostDir);
    logger.info(`Resources: downloaded=${stats.downloaded}, skipped=${stats.skipped}, failed=${stats.failed}`);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  ensureDirectory(directory) {
    if (fs.existsSync(directory)) {
      const stats = fs.lstatSync(directory);
      if (stats.isDirectory()) {
        return;
      }
      fs.unlinkSync(directory);
    }
    fs.mkdirSync(directory, { recursive: true });
  }

  async analysePage(baseUrl, htmlContent, currentDepth) {
    const parser = new HtmlParse(htmlContent, baseUrl);
    const rawAnchors = parser.getAllAnchorHrefs(true);
    const uniqueAnchors = Array.from(new Set(rawAnchors));

    let internalCount = 0;
    let externalCount = 0;

    for (const link of uniqueAnchors) {
      const resolved = this.domainContext.resolveHref(baseUrl, link);
      if (!resolved) {
        continue;
      }

      if (resolved.canonical && this.domainContext.isInternalLink(resolved.url)) {
        internalCount++;
        this.urlPool.add(resolved.canonical);
        if (currentDepth + 1 <= this.maxDepth) {
          this.queue.enqueue(resolved.canonical, currentDepth + 1);
        }
      } else {
        externalCount++;
      }
    }

    logger.info(`Links discovered: total=${uniqueAnchors.length}, internal=${internalCount}, external=${externalCount}`);

    const processedUrls = Array.from(this.queue.processed).slice(-10);
    if (processedUrls.length > 0) {
      logger.info(`Recently downloaded (last ${processedUrls.length}):`);
      processedUrls.forEach((url, index) => {
        logger.info(`  ✓ [${index + 1}] ${url}`);
      });
    }

    const pendingUrls = this.queue.pending.slice(0, 10);
    if (pendingUrls.length > 0) {
      logger.info(`Pending queue (next ${pendingUrls.length}):`);
      pendingUrls.forEach((item, index) => {
        logger.info(`  ⏳ [${index + 1}] depth=${item.depth} ${item.url}`);
      });
    }

    logger.info(`Queue status: pending=${this.queue.size()}, processed=${this.queue.processedCount()}`);
  }

  async generateSitemap(hostDir) {
    const sitemapPath = path.join(hostDir, 'sitemap.xml');

    try {
      await this.sitemapGenerator.save(sitemapPath);
      logger.success(`Sitemap generated: ${sitemapPath}`);
      logger.info(`Total URLs in sitemap: ${this.sitemapGenerator.getUrlCount()}`);
    } catch (error) {
      logger.error(`Failed to generate sitemap: ${error.message}`);
    }
  }

  async generateMapsite(hostDir) {
    try {
      const mapsitePath = path.join(hostDir, 'mapsite.json');

      const mapsiteData = {
        timestamp: new Date().toISOString(),
        domain: this.domainContext.getOrigin(),
        totalUrls: this.downloadedUrls.length,
        resourceStats: this.resourceProcessor.resourceMap ? {
          css: this.resourceProcessor.resourceMap.css.size,
          js: this.resourceProcessor.resourceMap.js.size,
          images: this.resourceProcessor.resourceMap.images.size,
          fonts: this.resourceProcessor.resourceMap.fonts.size,
          media: this.resourceProcessor.resourceMap.media.size,
          backgroundImages: this.resourceProcessor.resourceMap.backgroundImages.size,
          httpsImages: this.resourceProcessor.resourceMap.httpsImages.size
        } : {},
        screenshotEnabled: this.screenshot,
        urls: this.downloadedUrls.map(url => {
          const entry = {
            url: url,
            localPath: this.fileMapper.mapPath(new URL(url)),
            fetchedAt: new Date().toISOString()
          };

          if (this.screenshot && this.pageScreenshots.has(url)) {
            entry.screenshot = this.pageScreenshots.get(url);
          }

          return entry;
        })
      };

      fs.writeFileSync(mapsitePath, JSON.stringify(mapsiteData, null, 2), 'utf8');
      logger.success(`Mapsite generated: ${mapsitePath}`);
      logger.info(`Total URLs in mapsite: ${this.downloadedUrls.length}`);
      if (this.screenshot) {
        logger.info(`Total screenshots captured: ${this.pageScreenshots.size}`);
      }
    } catch (error) {
      logger.error(`Failed to generate mapsite: ${error.message}`);
    }
  }

  async saveFailedUrlsReport(hostDir) {
    try {
      if (this.failedUrls.length === 0) {
        logger.info('No failed URLs to report');
        return;
      }

      const failedReportPath = path.join(hostDir, 'failed_urls.json');

      const failedReport = {
        timestamp: new Date().toISOString(),
        totalFailed: this.failedUrls.length,
        fetcherMode: this.fetcherType,
        failedUrls: this.failedUrls
      };

      fs.writeFileSync(failedReportPath, JSON.stringify(failedReport, null, 2), 'utf8');
      logger.warn(`Failed URLs report saved: ${failedReportPath}`);
      logger.warn(`Total failed URLs: ${this.failedUrls.length}`);
    } catch (error) {
      logger.error(`Failed to save failed URLs report: ${error.message}`);
    }
  }

  printDownloadSummary() {
    logger.info('\n========================================');
    logger.info('DOWNLOAD SUMMARY');
    logger.info('========================================');

    const resourceStats = this.resourceProcessor.resourceMap;
    const totalResources =
      resourceStats.css.size +
      resourceStats.js.size +
      resourceStats.images.size +
      resourceStats.fonts.size +
      resourceStats.media.size;

    const totalExternal =
      resourceStats.externalCss.size +
      resourceStats.externalJs.size +
      resourceStats.externalImages.size +
      resourceStats.externalFonts.size +
      resourceStats.externalMedia.size;

    logger.info(`Total URLs downloaded: ${this.downloadedUrls.length}`);
    logger.info(`Queue status: processed=${this.queue.processedCount()}`);
    logger.info('');

    logger.info('Internal Resources discovered:');
    logger.info(`  CSS files:         ${resourceStats.css.size}`);
    logger.info(`  JavaScript files:  ${resourceStats.js.size}`);
    logger.info(`  Images:            ${resourceStats.images.size}`);
    logger.info(`    - Background:    ${resourceStats.backgroundImages.size}`);
    logger.info(`    - HTTPS direct:  ${resourceStats.httpsImages.size}`);
    logger.info(`  Fonts:             ${resourceStats.fonts.size}`);
    logger.info(`  Media:             ${resourceStats.media.size}`);
    logger.info(`  Total:             ${totalResources}`);
    logger.info('');

    logger.info('External Resources found:');
    logger.info(`  CSS files:         ${resourceStats.externalCss.size}`);
    logger.info(`  JavaScript files:  ${resourceStats.externalJs.size}`);
    logger.info(`  Images:            ${resourceStats.externalImages.size}`);
    logger.info(`  Fonts:             ${resourceStats.externalFonts.size}`);
    logger.info(`  Media:             ${resourceStats.externalMedia.size}`);
    logger.info(`  Total:             ${totalExternal}`);
    logger.info('');

    const recentUrls = Array.from(this.queue.processed).slice(-5);
    if (recentUrls.length > 0) {
      logger.info('Recently processed (last 5):');
      recentUrls.forEach((url, index) => {
        logger.info(`  [${index + 1}] ${url}`);
      });
    }

    const pendingUrls = this.queue.pending.slice(0, 5);
    if (pendingUrls.length > 0) {
      logger.info('Pending queue (next 5):');
      pendingUrls.forEach((item, index) => {
        logger.info(`  [${index + 1}] depth=${item.depth} ${item.url}`);
      });
    }

    logger.info('========================================\n');
  }

  async pauseForNextStep() {
    if (this.autoConfirm) {
      logger.info('Auto-confirm enabled, skipping pause');
      return;
    }

    return new Promise((resolve) => {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question('Analysis complete. Press Enter to continue...', () => {
        rl.close();
        resolve();
      });
    });
  }
}

module.exports = CrawlController;
