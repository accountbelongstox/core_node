const path = require('path');
const fs = require('fs');
const downloader = require('#@downloader');
const freader = require('#@freader');
const logger = require('#@logger');
const global_dir = require('#@global_dir');

class PageFetcher {
  constructor(fileMapper) {
    if (!fileMapper) {
      logger.error('PageFetcher requires a FileMapper instance');
      this.fileMapper = null;
      this.tempRoot = null;
      return;
    }
    this.fileMapper = fileMapper;
    this.tempRoot = path.join(global_dir.COMMON_CACHE_DIR, 'DocumentOffline', '.tmp_pages');
  }

  ensureTempDir() {
    if (!fs.existsSync(this.tempRoot)) {
      fs.mkdirSync(this.tempRoot, { recursive: true });
    }
  }

  async fetch(url) {
    if (!this.fileMapper) {
      logger.error('PageFetcher is not initialized: missing FileMapper instance');
      return null;
    }
    this.ensureTempDir();
    const parsed = new URL(url);
    const relativePath = this.fileMapper.mapPath(parsed);
    const hostDir = path.join(this.tempRoot, parsed.hostname);
    const tempFile = path.join(hostDir, relativePath);
    this.ensureDirectory(path.dirname(tempFile));

    let contentType = null;
    const downloadedPath = await downloader.HTTPDownload(url, tempFile, {
      onProgress: (received, total) => {
        if (total && !Number.isNaN(total) && total > 0) {
          const percent = ((received * 100) / total).toFixed(2);
          logger.refresh(`Progress: ${percent}% (${received}/${total} bytes)`);
        } else {
          logger.refresh(`Progress: ${received} bytes downloaded`);
        }
      },
      onHeaders: (headers) => {
        contentType = headers['content-type'] || null;
      }
    });

    if (!downloadedPath) {
      throw new Error('Download failed');
    }

    const isTextContent = this.isTextContentType(contentType);
    const content = isTextContent ? await freader.readText(downloadedPath) : await fs.promises.readFile(downloadedPath);

    return {
      content,
      contentType,
      isText: isTextContent,
      isBinary: !isTextContent
    };
  }

  isTextContentType(contentType) {
    if (!contentType) {
      return true;
    }
    const textTypes = [
      'text/',
      'application/json',
      'application/javascript',
      'application/xml',
      'application/xhtml+xml',
      'application/x-javascript'
    ];
    return textTypes.some(type => contentType.toLowerCase().includes(type));
  }

  async safeUnlink(filePath) {
    try {
      await fs.promises.unlink(filePath);
    } catch (error) {
      logger.warn(`Unable to remove temporary file: ${error.message}`);
    }
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
}

module.exports = PageFetcher;
