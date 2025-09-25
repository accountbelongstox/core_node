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

const urltool = require('#@ncore/utils/urltool.js');
const HtmlParse = require('#@ncore/utils/htmltool/libs/htmlparse.js');
const encodingtool = require('#@ncore/utils/encodingtool.js');
const logger = require('#@logger');
const freader = require('#@freader');
const fwriter = require('#@fwriter');
const global_vars = require('#@global_vars');
const global_dir = require('#@global_dir');
const downloader = require('#@downloader');
const path = require('path');
const fs = require('fs');
const { URL } = require('url');

class DownloadManager {
  constructor() {
    this.urlTool = urltool;
    this.downloadedUrls = new Set();
    this.downloadQueue = [];
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    this.timeout = 30000;
    this.maxRedirects = 5;
    
    // Use COMMON_CACHE_DIR as base directory
    this.baseDownloadDir = path.join(global_dir.COMMON_CACHE_DIR, 'DocumentOffline');
  }

  async startDownload(startUrl, maxDepth, downloadResources = true) {
    // Ensure URL has protocol
    if (!startUrl.startsWith('http://') && !startUrl.startsWith('https://')) {
      startUrl = 'https://' + startUrl;
    }
    
    const baseDomain = this.urlTool.getMainDomain(startUrl);
    
    logger.info(`Starting download for: ${startUrl}`);
    logger.info(`Base domain: ${baseDomain}`);
    logger.info(`Base download directory: ${this.baseDownloadDir}`);
    logger.info(`Download resources: ${downloadResources}`);
    
    // Ensure cache directory exists
    await this.ensureCacheDir();
    
    try {
      // Start with the initial URL
      await this.downloadRecursive(startUrl, 0, maxDepth, baseDomain, downloadResources);
      
      // Process download queue
      while (this.downloadQueue.length > 0) {
        const item = this.downloadQueue.shift();
        await this.downloadRecursive(item.url, item.depth, maxDepth, baseDomain, downloadResources);
      }
      
      logger.info('Download completed successfully');
    } catch (error) {
      logger.error(`Download failed: ${error.message}`);
      throw error;
    }
  }

  async downloadRecursive(url, currentDepth, maxDepth, baseDomain, downloadResources) {
    if (this.downloadedUrls.has(url) || currentDepth > maxDepth) {
      return;
    }

    this.downloadedUrls.add(url);
    logger.info(`Downloading (depth ${currentDepth}): ${url}`);

    try {
      // Download page content
      const content = await this.downloadContent(url);
      if (!content) {
        logger.warn(`Failed to download: ${url}`);
        return;
      }
      
      // Convert to UTF-8 using encoding tool
      const utf8Content = encodingtool.convertToUtf8(content);
      
      // Parse URL and save file
      const parsedUrl = new URL(url);
      const webDownloadDir = path.join(this.baseDownloadDir, parsedUrl.hostname);
      const relativePath = this.getRelativePath(parsedUrl);
      const filePath = path.join(webDownloadDir, relativePath);
      
      // Ensure directory exists
      const dirPath = path.dirname(filePath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      // Save file
      await fwriter.saveText(filePath, utf8Content);
      logger.info(`Saved: ${path.relative(this.baseDownloadDir, filePath)}`);

      // If there's still depth, parse HTML and extract links
      if (currentDepth < maxDepth) {
        const links = this.extractLinks(utf8Content, url);
        const sameDomainLinks = this.filterSameDomain(links, baseDomain);
        
        logger.info(`Found ${sameDomainLinks.length} same-domain links`);
        
        // Add to download queue
        for (const link of sameDomainLinks) {
          if (!this.downloadedUrls.has(link)) {
            this.downloadQueue.push({
              url: link,
              depth: currentDepth + 1
            });
          }
        }
      }
    } catch (error) {
      logger.error(`Error downloading ${url}: ${error.message}`);
    }
  }

  getRelativePath(parsedUrl) {
    let pathname = parsedUrl.pathname;
    
    // Remove trailing slash for directory URLs
    if (pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    
    // If pathname is empty or just '/', return 'index.html'
    if (!pathname || pathname === '/') {
      return 'index.html';
    }
    
    // Check if pathname has a file extension
    const ext = path.extname(pathname);
    if (ext && ext !== '/') {
      return pathname;
    }
    
    // If no extension, treat as directory and add index.html
    return path.join(pathname, 'index.html');
  }

  async downloadContent(url) {
    try {
      // Add protocol if missing
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      
      // Validate URL structure
      try {
        new URL(url);
      } catch (error) {
        throw new Error(`Invalid URL format: ${url}`);
      }
      
      logger.info(`Starting download: ${url}`);
      
      const tempDir = global_dir.APP_TMP_DIR || path.join(global_dir.CWD, '.temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const tempFile = path.join(tempDir, `download_${Date.now()}.tmp`);
      
      const downloadedPath = await downloader.HTTPDownload(url, tempFile, {
        timeout: this.timeout,
        userAgent: this.userAgent,
        maxRedirects: this.maxRedirects,
        onProgress: (received, total) => {
          if (total && !isNaN(total) && total > 0) {
            const percent = ((received * 100) / total).toFixed(2);
            logger.refresh(`Progress: ${percent}% (${received}/${total} bytes)`);
          } else {
            logger.refresh(`Progress: ${received} bytes downloaded`);
          }
        }
      });
      
      if (!downloadedPath) {
        throw new Error('Download failed');
      }
      
      const content = await freader.readText(downloadedPath);
      
      try {
        fs.unlinkSync(downloadedPath);
      } catch (error) {
        logger.warn(`Failed to clean temp file: ${error.message}`);
      }
      
      return Buffer.from(content, 'utf8');
    } catch (error) {
      logger.error(`Failed to download ${url}: ${error.message}`);
      throw new Error(`Failed to download ${url}: ${error.message}`);
    }
  }

  extractLinks(htmlContent, baseUrl) {
    try {
      const htmlParser = new HtmlParse(htmlContent, baseUrl);
      const links = [];

      // Extract anchor links only (not resources)
      const anchorLinks = htmlParser.getAllAnchorHrefs(true);
      links.push(...anchorLinks);

      // Filter out invalid URLs and remove duplicates
      const validLinks = links.filter(link => {
        if (!link) return false;
        
        // Skip data URLs, javascript, mailto, etc.
        if (link.startsWith('data:') || 
            link.startsWith('javascript:') || 
            link.startsWith('mailto:') ||
            link.startsWith('tel:') ||
            link.startsWith('#') ||
            link.startsWith('blob:')) {
          return false;
        }
        
        // Try to validate URL format
        try {
          // Handle relative URLs
          if (link.startsWith('/')) {
            const baseUrlObj = new URL(baseUrl);
            link = `${baseUrlObj.protocol}//${baseUrlObj.host}${link}`;
          } else if (!link.startsWith('http://') && !link.startsWith('https://')) {
            // Relative URL, resolve against baseUrl
            const baseUrlObj = new URL(baseUrl);
            link = new URL(link, baseUrl).href;
          }
          
          new URL(link);
          return true;
        } catch (error) {
          return false;
        }
      });

      return [...new Set(validLinks)];
    } catch (error) {
      logger.error(`Error extracting links: ${error.message}`);
      return [];
    }
  }

  filterSameDomain(urls, baseDomain) {
    return urls.filter(url => {
      const domain = this.urlTool.getMainDomain(url);
      return domain === baseDomain;
    });
  }

  async ensureCacheDir() {
    if (!fs.existsSync(this.baseDownloadDir)) {
      fs.mkdirSync(this.baseDownloadDir, { recursive: true });
    }
    logger.info(`Cache directory ready: ${this.baseDownloadDir}`);
  }

  async saveFile(filename, content) {
    const filePath = path.join(this.baseDownloadDir, filename);
    const dirPath = path.dirname(filePath);
    
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    await fwriter.saveText(filePath, content);
    logger.info(`Saved: ${filename}`);
  }
}

module.exports = DownloadManager; 