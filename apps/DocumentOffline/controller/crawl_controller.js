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

const DomainContext = require('../libs/domain_context.js');
const FileMapper = require('../libs/file_mapper.js');
const UrlQueue = require('../libs/url_queue.js');
const PageFetcher = require('../services/page_fetcher.js');
const UrlRewriter = require('../services/url_rewriter.js');
const SitemapGenerator = require('../services/sitemap_generator.js');
const BackupManager = require('../libs/backup_manager.js');

const ResourceExtractor = require('#@ncore/utils/web_offline/resource_extractor.js');
const ResourceDownloader = require('#@ncore/utils/web_offline/resource_downloader.js');
const CssProcessor = require('#@ncore/utils/web_offline/css_processor.js');

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
    this.fetcher = new PageFetcher(this.fileMapper);
    this.urlRewriter = null;
    this.cssProcessor = null;
    this.resourceExtractor = null;
    this.resourceDownloader = null;
    this.sitemapGenerator = new SitemapGenerator();
    this.backupManager = new BackupManager(5);
  }

  async start(argv = process.argv.slice(2)) {
    const { targetUrl, depth } = this.parseArguments(argv);
    this.domainContext = new DomainContext(targetUrl);
    this.urlRewriter = new UrlRewriter(this.domainContext, this.fileMapper);
    this.cssProcessor = new CssProcessor(this.domainContext, this.fileMapper);
    this.resourceExtractor = new ResourceExtractor(this.domainContext);
    this.resourceDownloader = new ResourceDownloader(downloader, this.fileMapper, logger);
    this.maxDepth = depth;

    logger.info(`Starting document offline analysis for: ${targetUrl}`);
    logger.info(`Recursion depth: ${depth}`);
    logger.info(`Hostname validation: ${this.domainContext.getValidationDomain()}`);
    logger.info(`Primary origin: ${this.domainContext.getOrigin()}`);
    if (this.domainContext.getScopeUrl() !== this.domainContext.getOrigin()) {
      logger.info(`Scope root: ${this.domainContext.getScopeUrl()}`);
    }

    const parsed = new URL(this.domainContext.getOrigin());
    const hostDir = path.join(global_dir.COMMON_CACHE_DIR, 'DocumentOffline', parsed.hostname);

    if (this.backupManager.exists(hostDir)) {
      const shouldContinue = await this.confirmOverwrite(hostDir);
      if (!shouldContinue) {
        logger.info('Download cancelled by user');
        return;
      }
      await this.backupManager.createBackup(hostDir);
    }

    const canonicalTarget = this.domainContext.getStartUrl();
    this.queue.enqueue(canonicalTarget, 0);
    this.urlPool.add(canonicalTarget);

    try {
      await this.processQueue();
      await this.generateSitemap();
      await this.pauseForNextStep();
    } catch (error) {
      logger.error(`Processing failed: ${error.message}`);
      throw error;
    }
  }

  async confirmOverwrite(targetDir) {
    return new Promise((resolve) => {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

      logger.warn(`\nExisting download found: ${targetDir}`);
      logger.warn('Continuing will overwrite previous download.');
      logger.warn('A backup will be created automatically (max 5 backups kept).\n');

      rl.question('Do you want to continue? (yes/no): ', (answer) => {
        rl.close();
        const confirmed = answer.toLowerCase().trim() === 'yes' || answer.toLowerCase().trim() === 'y';
        resolve(confirmed);
      });
    });
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

    if (argv.length > index + 1 && !argv[index + 1].startsWith('--')) {
      const parsedDepth = parseInt(argv[index + 1], 10);
      depth = Number.isNaN(parsedDepth) ? 3 : Math.max(parsedDepth, 0);
    }

    if (!rawUrl || !this.isValidUrl(rawUrl)) {
      this.printUsage();
      throw new Error(`Invalid URL: ${rawUrl}`);
    }

    return { targetUrl: rawUrl, depth };
  }

  printUsage() {
    logger.info('Usage: node main.js app=DocumentOffline <url> [depth]');
    logger.info('Example: node main.js app=DocumentOffline https://example.com 3');
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
      try {
        fetchResult = await this.fetcher.fetch(url);
      } catch (error) {
        logger.error(`Failed to download ${url}: ${error.message}`);
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
    }

    logger.info('Queue completed.');
  }

  async savePage(targetUrl, content, isBinary = false) {
    const canonical = this.domainContext.canonicalize(targetUrl) || targetUrl;
    const parsed = new URL(canonical);
    const relativePath = this.fileMapper.mapPath(parsed);
    const hostDir = path.join(global_dir.COMMON_CACHE_DIR, 'DocumentOffline', parsed.hostname);
    const finalPath = path.join(hostDir, relativePath);

    const directory = path.dirname(finalPath);
    this.ensureDirectory(directory);

    let finalContent = content;
    let resources = null;

    if (!isBinary) {
      if (this.isHtmlContent(relativePath)) {
        resources = this.resourceExtractor.extractFromHtml(content, canonical);
        finalContent = this.urlRewriter.rewriteHtml(content, canonical);
      } else if (this.isCssContent(relativePath)) {
        const cssUrls = this.cssProcessor.extractUrls(content, canonical);
        resources = { css: cssUrls, js: [], images: [], fonts: [], media: [] };
        finalContent = this.cssProcessor.rewriteCss(content, canonical);
      }
    }

    if (isBinary) {
      await fs.promises.writeFile(finalPath, finalContent);
    } else {
      await fs.promises.writeFile(finalPath, finalContent, 'utf8');
    }

    this.sitemapGenerator.addUrl(canonical);

    logger.info(`Saved ${isBinary ? 'binary' : 'text'} file: ${path.relative(hostDir, finalPath)}`);

    if (resources) {
      await this.downloadResources(resources, hostDir);
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

    let downloaded = 0;
    let skipped = 0;
    let failed = 0;

    for (const url of allUrls) {
      const result = await this.resourceDownloader.downloadResource(url, hostDir);

      if (result.success) {
        downloaded++;
        if (result.isText && this.isCssContent(result.path)) {
          const rewrittenCss = this.cssProcessor.rewriteCss(result.content, url);
          await fs.promises.writeFile(result.path, rewrittenCss, 'utf8');
        }
      } else if (result.skipped) {
        skipped++;
      } else {
        failed++;
      }

      await this.delay(50);
    }

    logger.info(`Resources: downloaded=${downloaded}, skipped=${skipped}, failed=${failed}`);
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

  async generateSitemap() {
    const parsed = new URL(this.domainContext.getOrigin());
    const hostDir = path.join(global_dir.COMMON_CACHE_DIR, 'DocumentOffline', parsed.hostname);
    const sitemapPath = path.join(hostDir, 'sitemap.xml');

    try {
      await this.sitemapGenerator.save(sitemapPath);
      logger.success(`Sitemap generated: ${sitemapPath}`);
      logger.info(`Total URLs in sitemap: ${this.sitemapGenerator.getUrlCount()}`);
    } catch (error) {
      logger.error(`Failed to generate sitemap: ${error.message}`);
    }
  }

  async pauseForNextStep() {
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
