'use strict';
const http = require('http');
const https = require('https');
const url = require('url');
const dns = require('dns');
const net = require('net');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { promisify } = require('util');

// Convert DNS functions to promises
const dnsLookup = promisify(dns.lookup);
const dnsResolve = promisify(dns.resolve);
const dnsReverse = promisify(dns.reverse);

/**
 * Check if a port is available on a host
 * @param {number} port - Port number to check
 * @param {string} host - Host to check (default: localhost)
 * @returns {Promise<boolean>} True if port is available
 */
async function isPortAvailable(port, host = 'localhost') {
    return new Promise(resolve => {
        const server = net.createServer();
        server.once('error', () => {
            resolve(false);
        });
        server.once('listening', () => {
            server.close();
            resolve(true);
        });
        server.listen(port, host);
    });
}

/**
 * Find the next available port starting from a given port
 * @param {number} startPort - Port to start checking from
 * @param {string} host - Host to check (default: localhost)
 * @returns {Promise<number>} First available port
 */
async function findAvailablePort(startPort = 3000, host = 'localhost') {
    let port = startPort;
    while (!(await isPortAvailable(port, host))) {
        port++;
    }
    return port;
}

/**
 * Parse a URL and return its components
 * @param {string} urlString - URL to parse
 * @returns {Object} Parsed URL components
 */
function parseUrl(urlString) {
    try {
        const parsed = new URL(urlString);
        return {
            protocol: parsed.protocol.replace(':', ''),
            host: parsed.hostname,
            port: parsed.port || (parsed.protocol === 'https:' ? '443' : '80'),
            path: parsed.pathname,
            query: Object.fromEntries(parsed.searchParams),
            hash: parsed.hash.replace('#', ''),
            auth: parsed.username ? {
                username: parsed.username,
                password: parsed.password
            } : null
        };
    } catch (error) {
        return null;
    }
}

/**
 * Build a URL from components
 * @param {Object} components - URL components
 * @returns {string} Constructed URL
 */
function buildUrl(components) {
    try {
        const url = new URL('placeholder://placeholder');
        url.protocol = components.protocol || 'http';
        url.hostname = components.host || 'localhost';
        url.port = components.port || '';
        url.pathname = components.path || '';
        if (components.query) {
            Object.entries(components.query).forEach(([key, value]) => {
                url.searchParams.set(key, value);
            });
        }
        if (components.hash) {
            url.hash = components.hash;
        }
        if (components.auth) {
            url.username = components.auth.username || '';
            url.password = components.auth.password || '';
        }
        return url.toString().replace('placeholder:', components.protocol + ':');
    } catch (error) {
        return null;
    }
}

/**
 * Make an HTTP/HTTPS request
 * @param {string|Object} options - URL string or request options
 * @param {Object} [data] - Request body data
 * @returns {Promise<Object>} Response data
 */
async function request(options, data = null) {
    return new Promise((resolve, reject) => {
        const requestOptions = typeof options === 'string' ? url.parse(options) : options;
        const isHttps = requestOptions.protocol === 'https:';
        const requestFn = isHttps ? https.request : http.request;

        const req = requestFn(requestOptions, (res) => {
            let responseData = '';
            res.setEncoding('utf8');
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = {
                        statusCode: res.statusCode,
                        headers: res.headers,
                        data: responseData
                    };
                    
                    // Try to parse JSON response
                    try {
                        response.data = JSON.parse(responseData);
                    } catch {
                        // Keep as string if not JSON
                    }
                    
                    resolve(response);
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on('error', reject);

        if (data) {
            const postData = typeof data === 'string' ? data : JSON.stringify(data);
            req.write(postData);
        }

        req.end();
    });
}

/**
 * Check if a host is reachable
 * @param {string} host - Host to check
 * @param {number} [timeout=5000] - Timeout in milliseconds
 * @returns {Promise<boolean>} True if host is reachable
 */
async function isHostReachable(host, timeout = 5000) {
    try {
        await Promise.race([
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout)),
            dnsLookup(host)
        ]);
        return true;
    } catch {
        return false;
    }
}

/**
 * Get IP addresses for a hostname
 * @param {string} hostname - Hostname to resolve
 * @returns {Promise<Object>} IP addresses (IPv4 and IPv6)
 */
async function resolveHostname(hostname) {
    try {
        const [ipv4] = await Promise.all([
            dnsResolve(hostname, 'A'),
            dnsResolve(hostname, 'AAAA')
        ]);
        
        return {
            ipv4: ipv4 || [],
            ipv6: ipv6 || []
        };
    } catch (error) {
        return {
            ipv4: [],
            ipv6: []
        };
    }
}

/**
 * Get hostname from IP address
 * @param {string} ip - IP address to reverse lookup
 * @returns {Promise<string[]>} Array of hostnames
 */
async function reverseIpLookup(ip) {
    try {
        return await dnsReverse(ip);
    } catch {
        return [];
    }
}

/**
 * Check if a string is a valid IP address
 * @param {string} ip - String to check
 * @param {number} [version] - IP version to check (4 or 6)
 * @returns {boolean} True if string is a valid IP address
 */
function isValidIp(ip, version) {
    if (version === 4 || !version) {
        const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (ipv4Regex.test(ip)) {
            const parts = ip.split('.');
            return parts.every(part => {
                const num = parseInt(part, 10);
                return num >= 0 && num <= 255;
            });
        }
    }
    
    if (version === 6 || !version) {
        const ipv6Regex = /^(?:[A-F0-9]{1,4}:){7}[A-F0-9]{1,4}$/i;
        return ipv6Regex.test(ip);
    }
    
    return false;
}

/**
 * Get local IP addresses
 * @param {string} [family] - IP family ('IPv4' or 'IPv6')
 * @returns {Object} Local IP addresses
 */
function getLocalIps(family) {
    const interfaces = require('os').networkInterfaces();
    const addresses = {
        ipv4: [],
        ipv6: []
    };

    Object.values(interfaces).forEach(iface => {
        iface.forEach(addr => {
            if (addr.family === 'IPv4') {
                addresses.ipv4.push(addr.address);
            } else if (addr.family === 'IPv6') {
                addresses.ipv6.push(addr.address);
            }
        });
    });

    if (family === 'IPv4') return addresses.ipv4;
    if (family === 'IPv6') return addresses.ipv6;
    return addresses;
}

/**
 * Mount a network share as a drive letter
 * @param {string} shareUrl - Network share URL with optional credentials (format: //server/share:username:password)
 * @returns {string|null} Drive letter if successful, null if failed
 */
function mountNetworkShare(shareUrl) {
    const { url, username, password } = parseShareCredentials(shareUrl);
    const networkDriveKey = `networkDrive_${url.replace(/[\/\\]+/g, '_')}`;
    let driveLetter;

    if (hasStoredDriveLetter(networkDriveKey)) {
        driveLetter = getStoredDriveLetter(networkDriveKey);
        if (fs.existsSync(`${driveLetter}/`)) {
            return driveLetter;
        }
        driveLetter = getNextAvailableDriveLetter();
    } else {
        driveLetter = getNextAvailableDriveLetter();
    }

    if (!driveLetter) {
        console.log(`No available drive letters`);
        return null;
    }

    const { serverPath, sharePath } = parseSharePath(url);
    const mountCommand = `net use ${driveLetter} ${serverPath} ${password} /user:${username}`;

    try {
        execSync(mountCommand);
        storeDriveLetter(networkDriveKey, driveLetter);
        return driveLetter;
    } catch (error) {
        console.log(`Failed to mount network share: ${error.message}`);
        return null;
    }
}

/**
 * Parse network share path into server and share components
 * @param {string} sharePath - Network share path
 * @returns {Object} Parsed server and share paths
 */
function parseSharePath(sharePath) {
    sharePath = sharePath.replace(/^[\/\\]+|[\/\\]+$/g, '');
    const pathParts = sharePath.split(/[\/\\]+/);
    const serverPath = `\\\\${pathParts.slice(0, 2).join('\\')}`;
    let relativePath = pathParts.slice(2).join('\\');
    relativePath = relativePath.replace(/^[\/\\]+|[\/\\]+$/g, '');
    return {
        serverPath,
        sharePath: relativePath
    };
}

/**
 * Parse share URL with credentials
 * @param {string} shareUrl - Network share URL with credentials
 * @returns {Object} Parsed URL and credentials
 */
function parseShareCredentials(shareUrl) {
    let url = shareUrl.split(/[a-zA-Z0-9]+\:[a-zA-Z0-9]+/)[0];
    url = url.replace(/\/+$/, '');
    
    const credentialsMatch = /([a-zA-Z0-9]+)\:([a-zA-Z0-9]+)/.exec(shareUrl);
    let username = '', password = '';
    
    if (credentialsMatch) {
        username = credentialsMatch[1];
        password = credentialsMatch[2] || '';
    }

    return {
        url,
        username,
        password
    };
}

/**
 * List contents of a network share directory
 * @param {string} shareUrl - Network share URL with credentials
 * @param {string} directory - Directory to list
 * @returns {string[]|null} Array of file names or null if failed
 */
function listNetworkDirectory(shareUrl, directory) {
    const driveLetter = mountNetworkShare(shareUrl);
    if (!driveLetter) {
        console.log(`Failed to mount network share`);
        return null;
    }

    try {
        return fs.readdirSync(path.join(driveLetter, directory));
    } catch (error) {
        console.log(`Failed to list directory: ${error.message}`);
        return null;
    }
}

/**
 * Read a file from network share
 * @param {string} shareUrl - Network share URL with credentials
 * @param {string} filePath - Path to file relative to share
 * @returns {string} File contents or empty string if failed
 */
function readNetworkFile(shareUrl, filePath) {
    const { url } = parseShareCredentials(shareUrl);
    const { serverPath, sharePath } = parseSharePath(url);
    const driveLetter = mountNetworkShare(shareUrl);
    const fullPath = path.join(driveLetter, sharePath, filePath);

    if (fs.existsSync(fullPath)) {
        return fs.readFileSync(fullPath, 'utf8');
    }
    return '';
}

/**
 * Get full local path for a network share file
 * @param {string} shareUrl - Network share URL with credentials
 * @param {string} filePath - Optional relative path within share
 * @returns {string} Full local path to the network file
 */
function getNetworkFilePath(shareUrl, filePath) {
    const { url } = parseShareCredentials(shareUrl);
    const { serverPath, sharePath } = parseSharePath(url);
    const driveLetter = mountNetworkShare(shareUrl);
    let fullPath = path.join(driveLetter, sharePath);
    if (filePath) {
        fullPath = path.join(fullPath, filePath);
    }
    return fullPath;
}

/**
 * Read and parse JSON file from network share
 * @param {string} shareUrl - Network share URL with credentials
 * @param {string} filePath - Path to JSON file
 * @returns {Object} Parsed JSON object or empty object if failed
 */
function readNetworkJson(shareUrl, filePath) {
    const content = readNetworkFile(shareUrl, filePath);
    try {
        return JSON.parse(content);
    } catch (error) {
        return {};
    }
}

// Storage functions for drive letter persistence
function hasStoredDriveLetter(key) {
    // Implementation depends on your storage mechanism
    return false;
}

function getStoredDriveLetter(key) {
    // Implementation depends on your storage mechanism
    return null;
}

function storeDriveLetter(key, driveLetter) {
    // Implementation depends on your storage mechanism
}

function getNextAvailableDriveLetter() {
    // Implementation depends on your system
    const usedDrives = new Set();
    for (let i = 67; i <= 90; i++) { // C to Z
        const driveLetter = String.fromCharCode(i) + ':';
        if (fs.existsSync(driveLetter)) {
            usedDrives.add(driveLetter);
        }
    }
    for (let i = 67; i <= 90; i++) {
        const driveLetter = String.fromCharCode(i) + ':';
        if (!usedDrives.has(driveLetter)) {
            return driveLetter;
        }
    }
    return null;
}

module.exports = {
    isPortAvailable,
    findAvailablePort,
    parseUrl,
    buildUrl,
    request,
    isHostReachable,
    resolveHostname,
    reverseIpLookup,
    isValidIp,
    getLocalIps,
    mountNetworkShare,
    parseSharePath,
    parseShareCredentials,
    listNetworkDirectory,
    readNetworkFile,
    getNetworkFilePath,
    readNetworkJson
};