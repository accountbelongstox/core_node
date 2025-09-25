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

const DownloadManager = require('./controller/download_manager.js');
const urltool = require('#@ncore/utils/urltool.js');
const logger = require('#@logger');
const commander = require('#@commander');
const gconfig = require('#@gconfig');
const global_vars = require('#@global_vars');
const global_dir = require('#@global_dir');

class DocumentOfflineController {
  constructor() {
    this.downloadManager = new DownloadManager();
    this.urlTool = urltool;
  }

  async start() {
    const args = process.argv.slice(2);
    
    // Parse arguments correctly for ncore app format
    let url = null;
    let depth = 3;
    let downloadResources = true;
    
    // Skip app parameter if present
    let argIndex = 0;
    if (args.length > 0 && args[0].startsWith('app=')) {
      argIndex = 1;
    }
    
    if (args.length <= argIndex) {
      logger.info('Usage: node main.js app=DocumentOffline <url> [depth] [--no-resources]');
      logger.info('Example: node main.js app=DocumentOffline https://example.com 3');
      logger.info('Example: node main.js app=DocumentOffline https://example.com 3 --no-resources');
      process.exit(1);
    }
    
    url = args[argIndex];
    
    // Parse depth parameter
    if (args.length > argIndex + 1 && !args[argIndex + 1].startsWith('--')) {
      depth = parseInt(args[argIndex + 1]) || 3;
      argIndex++;
    }
    
    // Parse options
    for (let i = argIndex + 1; i < args.length; i++) {
      if (args[i] === '--no-resources') {
        downloadResources = false;
      }
    }

    // Validate URL format
    if (!url || !this.isValidUrl(url)) {
      logger.error(`Invalid URL: ${url}`);
      logger.info('Usage: node main.js app=DocumentOffline <url> [depth] [--no-resources]');
      logger.info('Example: node main.js app=DocumentOffline https://example.com 3');
      logger.info('Example: node main.js app=DocumentOffline https://example.com 3 --no-resources');
      process.exit(1);
    }

    logger.info(`Starting document offline download for: ${url}`);
    logger.info(`Recursion depth: ${depth}`);
    logger.info(`Download resources: ${downloadResources}`);

    try {
      await this.downloadManager.startDownload(url, depth, downloadResources);
    } catch (error) {
      logger.error(`Download failed: ${error.message}`);
      process.exit(1);
    }
  }

  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = new DocumentOfflineController(); 