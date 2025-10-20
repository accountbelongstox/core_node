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

class CrawlController {
  constructor() {
    this.domainContext = null;
    this.queue = new UrlQueue();
    this.urlPool = new Set();
    this.maxDepth = 3;
    this.fileMapper = new FileMapper(new Set([
      '.html', '.htm', '.xhtml', '.xml', '.json', '.txt', '.csv',
      '.pdf', '.zip', '.gz', '.rar', '.7z', '.png', '.jpg', '.jpeg', '.gif',
      '.svg', '.webp', '.css', '.js', '.mp3', '.mp4', '.avi', '.mov', '.m4v', '.webm',
      '.woff', '.woff2', '.ttf', '.otf', '.eot'
    ]));
    this.fetcher = null;
    this.fetcherType = 'http';
    this.resourceProcessor = null;
    this.sitemapGenerator = new SitemapGenerator();
    this.backupManager = new BackupManager(5);
    this.autoOpenFolder = true;
    this.downloadedUrls = [];
    this.finalHostDir = null;
  }

  openFolderInExplorer(folderPath) {
    if (!fs.existsSync(folderPath)) {
      logger.warn(`Folder does not exist: ${folderPath}`);
      return;
    }

    const platform = os.platform();
    let command;

    try {
      if (platform === 'win32') {
        command = `explorer /select,"${folderPath}"`;
        exec(command, (error) => {
          if (error) {
            logger.error(`Failed to open folder: ${error.message}`);
          } else {
            logger.success(`Opened folder: ${folderPath}`);
          }
        });
      } else if (platform === 'darwin') {
        command = `open "${folderPath}"`;
        exec(command, (error) => {
          if (error) {
            logger.error(`Failed to open folder: ${error.message}`);
          } else {
            logger.success(`Opened folder: ${folderPath}`);
          }
        });
      } else if (platform === 'linux') {
        command = `xdg-open "${folderPath}"`;
        exec(command, (error) => {
          if (error) {
            logger.error(`Failed to open folder: ${error.message}`);
          } else {
            logger.success(`Opened folder: ${folderPath}`);
          }
        });
      }
    } catch (error) {
      logger.error(`Error opening folder: ${error.message}`);
    }
  }

  async start(argv = process.argv.slice(2)) {
    const { targetUrl, depth, fetcherType, scopeType, autoConfirm, autoOpenFolder } = this.parseArguments(argv);
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

    const parsed = new URL(this.domainContext.getOrigin());
    const hostDir = path.join(global_dir.COMMON_CACHE_DIR, 'DocumentOffline', parsed.hostname);
    this.finalHostDir = await this.prepareDownloadDirectory(hostDir);

    this.ensureDirectory(this.finalHostDir);
    if (this.autoOpenFolder) {
      logger.info(`Auto-open folder enabled, opening: ${this.finalHostDir}`);
      this.openFolderInExplorer(this.finalHostDir);
    }

    const canonicalTarget = this.domainContext.getStartUrl();
    this.queue.enqueue(canonicalTarget, 0);
    this.urlPool.add(canonicalTarget);

    try {
      await this.processQueue();
      await this.generateSitemap(this.finalHostDir);
      await this.generateMapsite(this.finalHostDir);
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
    if (fetcherType === 'http' || fetcherType === 'puppeteer') {
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
      logger.info('========================================\n');

      rl.question('Enter your choice (1 or 2, default is 1): ', async (answer) => {
        rl.close();

        const choice = answer.trim() || '1';
        const selectedType = choice === '2' ? 'puppeteer' : 'http';

        await this.applyFetcherType(selectedType);

        resolve();
      });
    });
  }

  async applyFetcherType(fetcherType) {
    if (fetcherType === 'puppeteer') {
      this.fetcherType = 'puppeteer';
      this.fetcher = new PuppeteerSpiderModule.Fetcher();
      await this.fetcher.initialize();
      logger.success('Using Puppeteer Browser for fetching (renders JavaScript)');
    } else {
      this.fetcherType = 'http';
      this.fetcher = new PageFetcher(this.fileMapper);
      logger.success('Using HTTP Request for fetching (source HTML only)');
    }
  }

  async cleanupFetcher() {
    if (this.fetcherType === 'puppeteer' && this.fetcher && this.fetcher.cleanup) {
      try {
        await this.fetcher.cleanup();
      } catch (error) {
        logger.error(`Failed to cleanup fetcher: ${error.message}`);
      }
    }
  }

  async prepareDownloadDirectory(baseHostDir) {
    const parentDir = path.dirname(baseHostDir);
    const dirName = path.basename(baseHostDir);

    if (!fs.existsSync(baseHostDir)) {
      return baseHostDir;
    }

    const stats = fs.statSync(baseHostDir);
    if (!stats.isDirectory()) {
      return baseHostDir;
    }

    const files = fs.readdirSync(baseHostDir);
    if (files.length === 0) {
      return baseHostDir;
    }

    logger.warn('\n========================================');
    logger.warn('Existing downloads found:');
    logger.warn('========================================');

    const entries = fs.readdirSync(parentDir, { withFileTypes: true });
    const conflictingDirs = entries
      .filter(entry => entry.isDirectory() && entry.name === dirName)
      .map(entry => ({
        name: entry.name,
        path: path.join(parentDir, entry.name),
        mtime: fs.statSync(path.join(parentDir, entry.name)).mtime
      }));

    for (const dir of conflictingDirs) {
      logger.warn(`  📁 ${dir.name} (modified: ${dir.mtime.toISOString()})`);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').substring(0, 19);
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
      autoOpenFolder
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
    logger.info('  --fetcher=<type>        Fetcher type: http, puppeteer (default: prompt)');
    logger.info('  --scope=<type>          Download scope: full, path (default: prompt)');
    logger.info('  --auto-confirm, -y      Auto-confirm without prompts');
    logger.info('  --no-open               Do NOT open folder in explorer after download');
    logger.info('');
    logger.info('Examples:');
    logger.info('  node main.js app=DocumentOffline https://example.com 3');
    logger.info('  node main.js app=DocumentOffline https://example.com --fetcher=http');
    logger.info('  node main.js app=DocumentOffline https://example.com --scope=path');
    logger.info('  node main.js app=DocumentOffline https://example.com 2 --fetcher=puppeteer --scope=full -y');
    logger.info('  node main.js app=DocumentOffline https://example.com --fetcher=puppeteer -y --no-open');
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
          fetchResult = await this.fetcher.fetch(url);
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
        continue;
      }

      try {
        await this.savePage(url, fetchResult.content, fetchResult.isBinary);
      } catch (error) {
        logger.error(`Failed to save ${url}: ${error.message}`);
        this.queue.requeue(item);
        continue;
      }

      if (depth < this.maxDepth && fetchResult.isText) {
        await this.analysePage(url, fetchResult.content, depth);
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    logger.info('Queue completed.');
  }

  async savePage(targetUrl, content, isBinary = false) {
    const canonical = this.domainContext.canonicalize(targetUrl) || targetUrl;
    const parsed = new URL(canonical);
    const relativePath = this.fileMapper.mapPath(parsed);
    const finalPath = path.join(this.finalHostDir, relativePath);

    const directory = path.dirname(finalPath);
    this.ensureDirectory(directory);

    let finalContent = content;
    let resources = null;

    if (!isBinary) {
      if (this.isHtmlContent(relativePath)) {
        const isFullMode = this.scopeType === 'full';
        resources = this.resourceProcessor.extractAllResources(content, canonical, isFullMode);
        finalContent = this.resourceProcessor.rewriteHtml(content, canonical);
      } else if (this.isCssContent(relativePath)) {
        const cssUrls = this.resourceProcessor.extractCssUrls(content, canonical);
        resources = { css: cssUrls, js: [], images: [], fonts: [], media: [] };
        finalContent = this.resourceProcessor.rewriteCss(content, canonical);
      }
    }

    if (isBinary) {
      await fs.promises.writeFile(finalPath, finalContent);
    } else {
      await fs.promises.writeFile(finalPath, finalContent, 'utf8');
    }

    this.sitemapGenerator.addUrl(canonical);
    this.downloadedUrls.push(canonical);

    logger.info(`Saved ${isBinary ? 'binary' : 'text'} file: ${path.relative(this.finalHostDir, finalPath)}`);

    if (resources) {
      await this.downloadResources(resources, this.finalHostDir);
    }
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
      const mapsitePath = this.resourceProcessor.generateMapsite(this.downloadedUrls, hostDir);
      logger.success(`Mapsite generated: ${mapsitePath}`);
      logger.info(`Total URLs in mapsite: ${this.downloadedUrls.length}`);
    } catch (error) {
      logger.error(`Failed to generate mapsite: ${error.message}`);
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

    logger.info(`Total URLs downloaded: ${this.downloadedUrls.length}`);
    logger.info(`Queue status: processed=${this.queue.processedCount()}`);
    logger.info('');

    logger.info('Resources discovered:');
    logger.info(`  CSS files:         ${resourceStats.css.size}`);
    logger.info(`  JavaScript files:  ${resourceStats.js.size}`);
    logger.info(`  Images:            ${resourceStats.images.size}`);
    logger.info(`    - Background:    ${resourceStats.backgroundImages.size}`);
    logger.info(`    - HTTPS direct:  ${resourceStats.httpsImages.size}`);
    logger.info(`  Fonts:             ${resourceStats.fonts.size}`);
    logger.info(`  Media:             ${resourceStats.media.size}`);
    logger.info(`  Total:             ${totalResources}`);
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
