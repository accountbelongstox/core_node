const fs = require('fs');
const path = require('path');

class ResourceDownloader {
  constructor(downloader, fileMapper, logger) {
    this.downloader = downloader;
    this.fileMapper = fileMapper;
    this.logger = logger;
    this.downloaded = new Set();
  }

  async downloadResource(url, baseDir, onHeaders) {
    const canonical = url;

    if (this.downloaded.has(canonical)) {
      return { skipped: true, reason: 'already_downloaded' };
    }

    try {
      const urlObj = new URL(url);
      const relativePath = this.fileMapper.mapPath(urlObj);
      const finalPath = path.join(baseDir, relativePath);

      if (fs.existsSync(finalPath)) {
        this.downloaded.add(canonical);
        return { skipped: true, reason: 'file_exists', path: finalPath };
      }

      const directory = path.dirname(finalPath);
      this.ensureDirectory(directory);

      let contentType = null;
      const downloadedPath = await this.downloader.HTTPDownload(url, finalPath, {
        onProgress: () => {},
        onHeaders: (headers) => {
          contentType = headers['content-type'] || null;
          if (onHeaders) {
            onHeaders(headers);
          }
        }
      });

      if (!downloadedPath || !fs.existsSync(downloadedPath)) {
        return { success: false, error: 'download_failed' };
      }

      this.downloaded.add(canonical);

      const isTextContent = this.isTextContentType(contentType);
      const content = isTextContent
        ? await fs.promises.readFile(downloadedPath, 'utf8')
        : await fs.promises.readFile(downloadedPath);

      return {
        success: true,
        path: downloadedPath,
        content: content,
        contentType: contentType,
        isText: isTextContent,
        isBinary: !isTextContent
      };

    } catch (error) {
      this.logger.error(`Failed to download resource ${url}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async downloadBatch(urls, baseDir, onProgress) {
    const results = {
      total: urls.length,
      success: 0,
      failed: 0,
      skipped: 0,
      downloads: []
    };

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];

      if (onProgress) {
        onProgress(i + 1, urls.length, url);
      }

      const result = await this.downloadResource(url, baseDir);

      if (result.success) {
        results.success++;
      } else if (result.skipped) {
        results.skipped++;
      } else {
        results.failed++;
      }

      results.downloads.push({
        url: url,
        ...result
      });

      await this.delay(100);
    }

    return results;
  }

  isTextContentType(contentType) {
    if (!contentType) {
      return false;
    }
    const textTypes = [
      'text/',
      'application/json',
      'application/javascript',
      'application/xml',
      'application/xhtml+xml',
      'application/x-javascript'
    ];
    const lowerType = contentType.toLowerCase();
    return textTypes.some(type => lowerType.includes(type));
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

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getDownloadedCount() {
    return this.downloaded.size;
  }

  reset() {
    this.downloaded.clear();
  }
}

module.exports = ResourceDownloader;
