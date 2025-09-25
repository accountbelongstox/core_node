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

// DocumentOffline usage examples

const DocumentOffline = require('../controller/main.js');

// Example 1: Basic usage
async function basicExample() {
  console.log('=== Basic Usage Example ===');
  
  // Simulate command line arguments
  process.argv = ['node', 'main.js', 'https://example.com', '2'];
  
  try {
    await DocumentOffline.start();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Example 2: Custom configuration
async function customConfigExample() {
  console.log('=== Custom Configuration Example ===');
  
  const ConfigManager = require('../controller/config_manager.js');
  const configManager = new ConfigManager();
  
  // Update configuration
  await configManager.updateConfig({
    'download.timeout': 60000,
    'limits.maxDepth': 5,
    'file.maxFileSize': 20 * 1024 * 1024 // 20MB
  });
  
  console.log('Configuration updated');
}

// Example 3: Direct component usage
async function componentExample() {
  console.log('=== Component Usage Example ===');
  
  const UrlProcessor = require('../controller/url_processor.js');
  const FileManager = require('../controller/file_manager.js');
  const HttpDownloader = require('../controller/http_downloader.js');
  
  const urlProcessor = new UrlProcessor();
  const fileManager = new FileManager();
  const httpDownloader = new HttpDownloader();
  
  const url = 'https://httpbin.org/html';
  
  try {
    // Download page
    console.log(`Downloading: ${url}`);
    const content = await httpDownloader.download(url);
    
    // Convert encoding
    const utf8Content = await fileManager.convertToUtf8(content);
    
    // Save file
    const filename = urlProcessor.urlToFilename(url);
    await fileManager.saveFile(filename, utf8Content);
    
    console.log(`File saved: ${filename}`);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run examples
async function runExamples() {
  console.log('DocumentOffline Usage Examples\n');
  
  // Note: These examples require network connection
  console.log('Note: These examples require network connection to work properly\n');
  
  // Uncomment the lines below to run examples
  // await basicExample();
  // await customConfigExample();
  // await componentExample();
  
  console.log('Examples completed');
}

// If this file is run directly
if (require.main === module) {
  runExamples().catch(console.error);
}

module.exports = {
  basicExample,
  customConfigExample,
  componentExample,
  runExamples
}; 