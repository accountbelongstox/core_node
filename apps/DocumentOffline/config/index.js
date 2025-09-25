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
  download: {
    timeout: 30000,
    maxRetries: 3,
    maxRedirects: 5,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    delay: 1000
  },
  parser: {
    ignoredExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.ico', '.css', '.js', '.pdf', '.zip', '.rar', '.exe', '.mp3', '.mp4', '.avi', '.mov'],
    maxLinksPerPage: 100
  },
  file: {
    cacheDir: 'cache',
    maxFileSize: 10 * 1024 * 1024, // 10MB
    encoding: 'utf8'
  },
  limits: {
    maxDepth: 3,
    maxPages: 1000,
    maxConcurrent: 5
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