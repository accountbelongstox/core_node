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

const path = require('path');
const fs = require('fs');
const downloader = require('#@downloader');
const freader = require('#@freader');
const logger = require('#@logger');
const global_dir = require('#@global_dir');

class PageFetcher {
  constructor(fileMapper) {
    if (!fileMapper) {
      throw new Error('PageFetcher requires a FileMapper instance');
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
    this.ensureTempDir();
    const parsed = new URL(url);
    const relativePath = this.fileMapper.mapPath(parsed);
    const hostDir = path.join(this.tempRoot, parsed.hostname);
    const tempFile = path.join(hostDir, relativePath);
    this.ensureDirectory(path.dirname(tempFile));

    const downloadedPath = await downloader.HTTPDownload(url, tempFile, {
      onProgress: (received, total) => {
        if (total && !Number.isNaN(total) && total > 0) {
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

    return content;
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
