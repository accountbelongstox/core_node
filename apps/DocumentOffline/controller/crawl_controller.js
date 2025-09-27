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
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const DomainContext = require('../libs/domain_context.js');
const FileMapper = require('../libs/file_mapper.js');
const UrlQueue = require('../libs/url_queue.js');
const PageFetcher = require('../services/page_fetcher.js');

class CrawlController {
  constructor() {
    this.domainContext = null;
    this.queue = new UrlQueue();
    this.urlPool = new Set();
    this.maxDepth = 3;
    this.fileMapper = new FileMapper(new Set([
      '.html', '.htm', '.xhtml', '.xml', '.json', '.txt', '.csv',
      '.pdf', '.zip', '.gz', '.rar', '.7z', '.png', '.jpg', '.jpeg', '.gif',
      '.svg', '.webp', '.css', '.js', '.mp3', '.mp4', '.avi', '.mov', '.m4v', '.webm'
    ]));
    this.fetcher = new PageFetcher(this.fileMapper);
  }

  async start(argv = process.argv.slice(2)) {
    const { targetUrl, depth } = this.parseArguments(argv);
    this.domainContext = new DomainContext(targetUrl);
    this.maxDepth = depth;

    logger.info(`Starting document offline analysis for: ${targetUrl}`);
    logger.info(`Recursion depth: ${depth}`);
    logger.info(`Hostname validation: ${this.domainContext.getValidationDomain()}`);
    logger.info(`Primary origin: ${this.domainContext.getOrigin()}`);
    if (this.domainContext.getScopeUrl() !== this.domainContext.getOrigin()) {
      logger.info(`Scope root: ${this.domainContext.getScopeUrl()}`);
    }

    const canonicalTarget = this.domainContext.getStartUrl();
    this.queue.enqueue(canonicalTarget, 0);
    this.urlPool.add(canonicalTarget);

    try {
      await this.processQueue();
      await this.pauseForNextStep();
    } catch (error) {
      logger.error(`Processing failed: ${error.message}`);
      throw error;
    }
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

      let content;
      try {
        content = await this.fetcher.fetch(url);
      } catch (error) {
        logger.error(`Failed to download ${url}: ${error.message}`);
        continue;
      }

      try {
        await this.savePage(url, content);
      } catch (error) {
        logger.error(`Failed to save ${url}: ${error.message}`);
        this.queue.requeue(item);
        continue;
      }

      if (depth < this.maxDepth) {
        await this.analysePage(url, content, depth);
      }
    }

    logger.info('Queue completed.');
  }

  async savePage(targetUrl, htmlContent) {
    const canonical = this.domainContext.canonicalize(targetUrl) || targetUrl;
    const parsed = new URL(canonical);
    const relativePath = this.fileMapper.mapPath(parsed);
    const hostDir = path.join(global_dir.COMMON_CACHE_DIR, 'DocumentOffline', parsed.hostname);
    const finalPath = path.join(hostDir, relativePath);

    const directory = path.dirname(finalPath);
    this.ensureDirectory(directory);

    await fs.promises.writeFile(finalPath, htmlContent, 'utf8');
    logger.info(`Saved page: ${path.relative(hostDir, finalPath)}`);
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
    const sample = Array.from(this.urlPool).slice(0, 10);
    if (sample.length > 0) {
      logger.info('Sample internal URLs:');
      sample.forEach((link, index) => {
        logger.info(`  [${index + 1}] ${link}`);
      });
    }
    logger.info(`Pending queue size: ${this.queue.size()}, processed: ${this.queue.processedCount()}`);
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
