const fs = require('fs');
const path = require('path');
const { data_dir } = require('../provider/global_var');
const logger = require('./log_utils');

// Helper function to check if a URL is valid
function isValidUrl(urlString) {
    try {
        const result = new URL(urlString);
        return !!result.protocol && !!result.host;
    } catch (error) {
        return false;
    }
}

function isValidStringWithProxies(inputString) {
    return typeof inputString === 'string' && inputString.length > 0 && inputString.includes('proxies');
}

// Helper function to extract the hostname from a URL
function extractHostname(urlString) {
    try {
        const parsedUrl = new URL(urlString);
        return parsedUrl.hostname;
    } catch (err) {
        logger.logRed(`Invalid URL: ${urlString}, Error: ${err}`);
        return null;
    }
}

// Function to check if a URL is expired or near expiry
function checkExpiry(submissionTime, expiryTime) {
    const now = new Date();
    const expiryDate = new Date(expiryTime);
    const timeDifference = expiryDate - now;
    const oneDayInSeconds = 24 * 60 * 60 * 1000; // One day in milliseconds

    if (now > expiryDate) {
        logger.logRed(`URL has expired. Expiry Time: ${expiryTime}`);
        return 'expired';
    } else if (timeDifference <= oneDayInSeconds) {
        logger.logRed(`Warning: URL is near expiry. Expiry Time: ${expiryTime}`);
        return 'nearExpiry';
    } else {
        return 'valid';
    }
}

// Function to read the first line from a file
function readFirstLine(filePath) {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const firstLine = fileContent.split('\n')[0];
    return firstLine.trim();
}

// Function to get the file's last modified time and calculate expiry time (one month after modification)
function getFileExpiryTime(filePath) {
    const stats = fs.statSync(filePath);
    const lastModifiedTime = new Date(stats.mtime);
    const expiryTime = new Date(lastModifiedTime.getTime() + 30 * 24 * 60 * 60 * 1000); // Expire one month later
    return expiryTime.toISOString();
}

function fileExists(filePath) {
    try {
        fs.accessSync(filePath);
        return true;
    } catch {
        return false;
    }
}

function loadData(dataFile) {
    if (fileExists(dataFile)) {
        const data = fs.readFileSync(dataFile, 'utf-8');
        return JSON.parse(data);
    } else {
        return {};
    }
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

function saveData(fileName, data) {
    const filePath = path.join(data_dir, fileName);
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        logger.log(`Data saved to ${filePath}`);
    } catch (error) {
        logger.logRed(`Error saving data to ${filePath}:`, error);
    }
}

function loadData(fileName) {
    const filePath = path.join(data_dir, fileName);
    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        logger.logRed(`Error loading data from ${filePath}:`, error);
    }
    return null;
}

module.exports = {
    isValidUrl,
    isValidStringWithProxies,
    extractHostname,
    checkExpiry,
    readFirstLine,
    getFileExpiryTime,
    fileExists,
    loadData,
    loadJson,
    saveJson,
    saveData,
    loadData
};