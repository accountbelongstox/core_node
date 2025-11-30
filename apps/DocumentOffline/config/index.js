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

const path = require('path');
const freader = require('#@freader');
const fwriter = require('#@fwriter');
const fs = require('fs');

// Default configuration
const defaultConfig = {
  debug: true,
  download: {
    timeout: 30000,
    maxRetries: 3,
    maxRedirects: 5,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    delay: 1000,
    retryDelay: 2000,
    retryBackoffMultiplier: 2,
    downloadResources: true
  },
  parser: {
    ignoredExtensions: ['.exe', '.dmg', '.pkg', '.deb', '.rpm'],
    maxLinksPerPage: 1000,
    extractResources: true,
    resourceTypes: {
      css: true,
      js: true,
      images: true,
      fonts: true,
      media: false
    }
  },
  file: {
    cacheDir: 'cache',
    maxFileSize: 50 * 1024 * 1024,
    encoding: 'utf8'
  },
  limits: {
    maxDepth: 3,
    maxPages: 10000,
    maxConcurrent: 5,
    maxQueueSize: 50000
  },
  filters: {
    excludePatterns: [
      '/admin/',
      '/login',
      '/logout',
      '/api/',
      '/oauth/',
      '/auth/'
    ],
    includePatterns: []
  },
  statistics: {
    enabled: true,
    showProgress: true,
    logInterval: 5000
  }
};

// Configuration file path
const configPath = path.join(__dirname, 'config.json');

// Load configuration
async function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const configData = await freader.readText(configPath);
      return { ...defaultConfig, ...JSON.parse(configData) };
    } else {
      // Create default configuration file
      await fwriter.saveJSON(configPath, defaultConfig);
      return defaultConfig;
    }
  } catch (error) {
    console.error('Error loading config:', error.message);
    return defaultConfig;
  }
}

// Save configuration
async function saveConfig(config) {
  try {
    await fwriter.saveJSON(configPath, config);
  } catch (error) {
    console.error('Error saving config:', error.message);
  }
}

module.exports = {
  loadConfig,
  saveConfig,
  defaultConfig,
  configPath
}; 
