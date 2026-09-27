const fs = require('fs');
const path = require('path');
const { out_dir } = require('../provider/global_var');
const logger = require('./log_utils');

// Create directory recursively
function mkdir(dirPath) {
    try {
        fs.mkdirSync(dirPath, { recursive: true });
        logger.log(`Directory created: ${dirPath}`);
    } catch (error) {
        logger.logRed(`Error creating directory ${dirPath}: ${error.message}`);
        throw error;
    }
}


function unlink(targetPath) {
  try {
    if (fs.existsSync(targetPath)) {
      const stats = fs.statSync(targetPath);
      if (stats.isDirectory()) {
        const files = fs.readdirSync(targetPath);
        for (const file of files) {
          const subPath = path.join(targetPath, file);
          unlink(subPath);
        }
        fs.rmdirSync(targetPath);
      } else {
        fs.unlinkSync(targetPath);
      }
    }
  } catch (error) {
    console.error(`Error deleting ${targetPath}:`, error.message);
  }
}

function ensureDirectoryExists(directory) {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
    }
}

// Ensure JSON file exists
function ensureJsonFile(filePath, template = null) {
    if (!fs.existsSync(filePath)) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(template || {}, null, 2), 'utf-8');
        logger.log(`Created new JSON file at ${filePath}.`);
    }
}

// Check if a file exists
function fileExists(filePath) {
    return fs.existsSync(filePath);
}

// Format file name
function formatFileName(fileName) {
    return fileName
        .replace(/[^a-zA-Z0-9_.-]/g, '_') // 替换特殊符号为下划线
        .replace(/_{2,}/g, '_')           // 替换多个下划线为一个
        .replace(/^_+|_+$/g, '')          // 去掉开头和结尾的下划线
        .trim();                          // 去掉前后空格
}

// Read the first line of the file
function readFirstLine(filePath) {
    const fileHandle = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(1024);
    const bytesRead = fs.readSync(fileHandle, buffer, 0, 1024, 0);
    fs.closeSync(fileHandle);
    return buffer.toString('utf8', 0, bytesRead).split('\n')[0].trim();
}

// Write content to YAML file
function writeYamlFile(filePath, content) {
    fs.writeFileSync(filePath, content, 'utf-8');
}

// Function to check if the file is older than one minute
function isFileOlderThanOneMinute(fileName) {
    const timestampPattern = /^config_(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\.yaml$/;
    const match = fileName.match(timestampPattern);

    if (match) {
        const [, year, month, day, hour, minute, second] = match.map(Number);
        const fileTime = new Date(year, month - 1, day, hour, minute, second);
        const currentTime = new Date();

        const diffInSeconds = (currentTime - fileTime) / 1000;
        const oneMinuteInSeconds = 60; // One minute in seconds
        return diffInSeconds > oneMinuteInSeconds;
    }

    return false;
}

// Function to clean up old files in the out directory
function cleanUpOldFiles() {
    const files = fs.readdirSync(out_dir);
    for (const file of files) {
        const filePath = path.join(out_dir, file);
        const stats = fs.statSync(filePath);
        if (stats.isFile() && isFileOlderThanOneMinute(file)) {
            try {
                fs.unlinkSync(filePath);
                logger.log(`Deleted old file: ${file}`);
            } catch (e) {
                logger.logRed(`Error deleting file ${file}: ${e}`);
            }
        }
    }
}

// Helper function to read a file as UTF-8 and return its lines
function readFileLines(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return content.split('\n');
    } catch (err) {
        logger.logRed(`Error reading file: ${filePath}, ${err}`);
        return [];
    }
}

// Function to get the file's last modified time and calculate expiry time (one month after modification)
function getFileExpiryDate(filePath) {
    try {
        const stats = fs.statSync(filePath);
        const lastModified = stats.mtime;

        // Calculate expiry date (one month after last modification)
        const expiryDate = new Date(lastModified.getTime() + 30 * 24 * 60 * 60 * 1000);
        const today = new Date();
        const isExpired = today > expiryDate;

        return {
            lastModified,
            expiryDate,
            isExpired
        };
    } catch (err) {
        logger.logRed(`Error getting file stats: ${filePath}, ${err}`);
        return null;
    }
}

// Function to get file details including expiry and remaining days
function getFileDetails(filePath) {
    const fileLines = readFileLines(filePath);
    const expiryInfo = getFileExpiryDate(filePath);

    let remainingDays = null;
    if (expiryInfo && expiryInfo.expiryDate) {
        const timeDiff = expiryInfo.expiryDate - new Date();
        remainingDays = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    }
    return {
        lines: fileLines,
        lastModified: expiryInfo ? expiryInfo.lastModified : null,
        expiryDate: expiryInfo ? expiryInfo.expiryDate : null,
        isExpired: expiryInfo ? expiryInfo.isExpired : null,
        remainingDays
    };
}

function getAbsolutePath(relativePath) {
    return path.resolve(__dirname, relativePath);
}

// Generic JSON loading function
function loadJson(filePath, defaultValue = null) {
    try {
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        return defaultValue;
    }
}

// Generic JSON saving function
function saveJson(filePath, data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

module.exports = {
    ensureDirectoryExists,
    ensureJsonFile,
    fileExists,
    formatFileName,
    readFirstLine,
    writeYamlFile,
    isFileOlderThanOneMinute,
    cleanUpOldFiles,
    readFileLines,
    getFileExpiryDate,
    getFileDetails,
    getAbsolutePath,
    loadJson,
    saveJson,
    mkdir,
    unlink,
};

// Example usage (optional)
if (require.main === module) {
    const exampleFile = 'path/to/your/file.txt';
    if (fileExists(exampleFile)) {
        const details = getFileDetails(exampleFile);
        logger.log(details);
    }
}
