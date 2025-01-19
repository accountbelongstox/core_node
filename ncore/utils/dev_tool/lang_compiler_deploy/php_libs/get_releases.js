const https = require('https');
    const { Buffer } = require('buffer');
    const zlib = require('zlib');
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const { request_headers } = require('#@globalvars');
    // const { execCmd } = require('#@commander');

    class PhpReleasesFetcher {
        constructor() {
            this.baseUrl = 'https://windows.php.net/downloads/releases/';
            this.releases = null;
            this.cacheFile = this._getCacheFilePath();
            this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        }

        _getCacheFilePath() {
            const isWin = process.platform === 'win32';
            const cacheDir = isWin ? 
                path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'PhpReleases') :
                path.join(os.homedir(), '.cache', 'php-releases');

            if (!fs.existsSync(cacheDir)) {
                fs.mkdirSync(cacheDir, { recursive: true });
            }

            return path.join(cacheDir, 'php-releases-cache.json');
        }

        _isCacheValid() {
            try {
                if (!fs.existsSync(this.cacheFile)) return false;

                const cacheStats = fs.statSync(this.cacheFile);
                const cacheAge = Date.now() - cacheStats.mtime.getTime();
                return cacheAge < this.cacheExpiry;
            } catch (error) {
                console.error('Error checking cache:', error);
                return false;
            }
        }

        async fetchReleases() {
            if (this.releases) {
                return this.releases;
            }

            try {
                const html = await this._fetchHtmlContent();
                const releases = this._parseVersions(html);
                return releases;
            } catch (error) {
                console.error('Error fetching PHP releases:', error);
                return [];
            }
        }

        async _fetchHtmlContent() {
            // Try to read from cache first
            if (this._isCacheValid()) {
                try {
                    const cacheData = JSON.parse(fs.readFileSync(this.cacheFile, 'utf8'));
                    return cacheData.html;
                } catch (error) {
                    console.error('Error reading cache:', error);
                }
            }

            // Fetch fresh data if cache is invalid or missing
            const options = {
                headers: request_headers
            };

            return new Promise((resolve, reject) => {
                https.get(this.baseUrl, options, (res) => {
                    const { statusCode, headers } = res;
                    if (statusCode !== 200) {
                        reject(new Error(`Request Failed. Status Code: ${statusCode}`));
                        return;
                    }

                    const encoding = headers['content-encoding'];
                    let buffer = [];

                    res.on('data', (chunk) => {
                        buffer.push(chunk);
                    });

                    res.on('end', () => {
                        const data = Buffer.concat(buffer);
                        try {
                            let output;
                            if (encoding === 'gzip') {
                                output = zlib.gunzipSync(data);
                            } else if (encoding === 'br') {
                                output = zlib.brotliDecompressSync(data);
                            } else if (encoding === 'deflate') {
                                output = zlib.inflateSync(data);
                            } else if (encoding === 'zstd') {
                                output = data;
                            } else {
                                output = data;
                            }
                            
                            const html = output.toString('utf8');
                            
                            // Save to cache
                            try {
                                fs.writeFileSync(this.cacheFile, JSON.stringify({
                                    html,
                                    timestamp: Date.now()
                                }));
                            } catch (error) {
                                console.error('Error writing cache:', error);
                            }

                            resolve(html);
                        } catch (error) {
                            reject(new Error(`Failed to decode content: ${error.message}`));
                        }
                    });
                }).on('error', (err) => {
                    reject(err);
                });
            });
        }

        _parseVersions(html) {
            // Match basic version numbers (e.g., 8.0.30)
            const basicVersionRegex = /(\d+\.\d+\.\d+)/g;
            const versionsSet = new Set();
            const results = [];
            
            // Find all matches first
            const matches = Array.from(html.matchAll(basicVersionRegex));

            // Process matches in reverse order
            for (let i = matches.length - 1; i >= 0; i--) {
                const match = matches[i];
                const fullVersion = match[1];
                const majorVersion = fullVersion.split('.').slice(0, 2).join('.');
                
                // Skip if we've already processed this version
                if (versionsSet.has(fullVersion)) continue;
                versionsSet.add(fullVersion);
                
                const pos = match.index;
                const fileNames = [];
                
                // Find all file names containing this version
                let searchStart = 0;
                while (true) {
                    // Find next occurrence of version number
                    const versionPos = html.indexOf(fullVersion, searchStart);
                    if (versionPos === -1) break;
                    
                    // Find surrounding quotes
                    const quoteLeft = html.lastIndexOf('"', versionPos);
                    const quoteRight = html.indexOf('"', versionPos);
                    
                    if (quoteLeft !== -1 && quoteRight !== -1) {
                        const fileName = html.substring(quoteLeft + 1, quoteRight);
                        // Only add file name if it contains the version and doesn't have < or >
                        if (fileName.includes(fullVersion) && !fileName.includes('<') && !fileName.includes('>')) {
                            fileNames.push(fileName);
                        }
                    }
                    
                    searchStart = quoteRight + 1;
                }

                results.push({
                    majorVersion,
                    fullVersion,
                    fileNames
                });
            }

            return results;
        }

        _isNewerVersion(version1, version2) {
            return this._compareVersions(version1, version2) > 0;
        }

        _compareVersions(v1, v2) {
            const parts1 = v1.split('.').map(Number);
            const parts2 = v2.split('.').map(Number);
            
            for (let i = 0; i < 3; i++) {
                if (parts1[i] > parts2[i]) return 1;
                if (parts1[i] < parts2[i]) return -1;
            }
            return 0;
        }

        async getLatestVersions() {
            const releases = await this.fetchReleases();
            return releases;
        }

        async getVersionsByMajor(major) {
            const releases = await this.fetchReleases();
            return releases.filter(release => release.majorVersion.startsWith(`${major}.`));
        }

        /**
         * Get version info by major version number
         * @param {string} majorVersion - Major version number (e.g., "8.0")
         * @returns {Promise<{majorVersion: string, fullVersion: string, fileName: string}|null>}
         */
        async getVersionByMajor(majorVersion) {
            const releases = await this.fetchReleases();
            return releases.find(release => release.majorVersion === majorVersion) || null;
        }

        /**
         * Get the latest version info based on major version number
         * @returns {Promise<{majorVersion: string, fullVersion: string, fileNames: string[]}|null>}
         */
        async getLatestMajorVersion() {
            const releases = await this.fetchReleases();
            if (!releases || releases.length === 0) return null;

            // Convert majorVersion to float and find the highest
            const latest = releases.reduce((prev, current) => {
                const prevVersion = parseFloat(prev.majorVersion);
                const currentVersion = parseFloat(current.majorVersion);
                return currentVersion > prevVersion ? current : prev;
            });

            return latest;
        }
    }

    module.exports = new PhpReleasesFetcher();

    // Usage example:
    /*
    const fetcher = new PhpReleasesFetcher();

    // Get all versions
    fetcher.getLatestVersions().then(versions => {
        console.log('All PHP versions:', versions);
    });

    // Get PHP 8.x versions
    fetcher.getVersionsByMajor(8).then(versions => {
        console.log('PHP 8.x versions:', versions);
    });
    */