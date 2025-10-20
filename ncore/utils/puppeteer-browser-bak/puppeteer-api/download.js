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

'use strict';

const puppeteerSpiderManager = require('../core/main.js');
const logger = require('#@logger');
const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');

/**
 * Puppeteer Download Class
 * Handles file download functionality with embedded and click-based methods
 */
class PuppeteerDownload {
    constructor() {
        this.defaultInstanceId = 0;
        this.httpServer = null;
        this.downloadPath = null;
        
        // MIME types mapping (based on oldspider/mime.js)
        this.mimeTypes = {
            "323": "text/h323",
            acx: "application/internet-property-stream",
            ai: "application/postscript",
            aif: "audio/x-aiff",
            aifc: "audio/x-aiff",
            aiff: "audio/x-aiff",
            asf: "video/x-ms-asf",
            asr: "video/x-ms-asf",
            asx: "video/x-ms-asf",
            au: "audio/basic",
            avi: "video/x-msvideo",
            axs: "application/olescript",
            bas: "text/plain",
            bcpio: "application/x-bcpio",
            bin: "application/octet-stream",
            bmp: "image/bmp",
            c: "text/plain",
            cat: "application/vnd.ms-pkiseccat",
            cdf: "application/x-cdf",
            cer: "application/x-x509-ca-cert",
            class: "application/octet-stream",
            clp: "application/x-msclip",
            cmx: "image/x-cmx",
            cod: "image/cis-cod",
            cpio: "application/x-cpio",
            crd: "application/x-mscardfile",
            crl: "application/pkix-crl",
            crt: "application/x-x509-ca-cert",
            csh: "application/x-csh",
            css: "text/css",
            dcr: "application/x-director",
            der: "application/x-x509-ca-cert",
            dir: "application/x-director",
            dll: "application/x-msdownload",
            dms: "application/octet-stream",
            doc: "application/msword",
            dot: "application/msword",
            dvi: "application/x-dvi",
            dxr: "application/x-director",
            eps: "application/postscript",
            etx: "text/x-setext",
            evy: "application/envoy",
            exe: "application/octet-stream",
            fif: "application/fractals",
            flr: "x-world/x-vrml",
            gif: "image/gif",
            gtar: "application/x-gtar",
            gz: "application/x-gzip",
            h: "text/plain",
            hdf: "application/x-hdf",
            hlp: "application/winhlp",
            hqx: "application/mac-binhex40",
            hta: "application/hta",
            htc: "text/x-component",
            htm: "text/html",
            html: "text/html",
            htt: "text/webviewhtml",
            ico: "image/x-icon",
            ief: "image/ief",
            iii: "application/x-iphone",
            ins: "application/x-internet-signup",
            isp: "application/x-internet-signup",
            jfif: "image/pipeg",
            jpe: "image/jpeg",
            jpeg: "image/jpeg",
            jpg: "image/jpeg",
            js: "application/x-javascript",
            latex: "application/x-latex",
            lha: "application/octet-stream",
            lsf: "video/x-la-asf",
            lsx: "video/x-la-asf",
            lzh: "application/octet-stream",
            m13: "application/x-msmediaview",
            m14: "application/x-msmediaview",
            m3u: "audio/x-mpegurl",
            man: "application/x-troff-man",
            mdb: "application/x-msaccess",
            me: "application/x-troff-me",
            mht: "message/rfc822",
            mhtml: "message/rfc822",
            mid: "audio/mid",
            mny: "application/x-msmoney",
            mov: "video/quicktime",
            movie: "video/x-sgi-movie",
            mp2: "video/mpeg",
            mp3: "audio/mpeg",
            mpa: "video/mpeg",
            mpe: "video/mpeg",
            mpeg: "video/mpeg",
            mpg: "video/mpeg",
            mpp: "application/vnd.ms-project",
            mpv2: "video/mpeg",
            ms: "application/x-troff-ms",
            mvb: "application/x-msmediaview",
            nws: "message/rfc822",
            oda: "application/oda",
            p10: "application/pkcs10",
            p12: "application/x-pkcs12",
            p7b: "application/x-pkcs7-certificates",
            p7c: "application/x-pkcs7-mime",
            p7m: "application/x-pkcs7-mime",
            p7r: "application/x-pkcs7-certreqresp",
            p7s: "application/x-pkcs7-signature",
            pbm: "image/x-portable-bitmap",
            pdf: "application/pdf",
            pfx: "application/x-pkcs12",
            pgm: "image/x-portable-graymap",
            pko: "application/ynd.ms-pkipko",
            pma: "application/x-perfmon",
            pmc: "application/x-perfmon",
            pml: "application/x-perfmon",
            pmr: "application/x-perfmon",
            pmw: "application/x-perfmon",
            pnm: "image/x-portable-anymap",
            pot: "application/vnd.ms-powerpoint",
            ppm: "image/x-portable-pixmap",
            pps: "application/vnd.ms-powerpoint",
            ppt: "application/vnd.ms-powerpoint",
            prf: "application/pics-rules",
            ps: "application/postscript",
            pub: "application/x-mspublisher",
            qt: "video/quicktime",
            ra: "audio/x-pn-realaudio",
            ram: "audio/x-pn-realaudio",
            ras: "image/x-cmu-raster",
            rgb: "image/x-rgb",
            rmi: "audio/mid",
            roff: "application/x-troff",
            rtf: "application/rtf",
            rtx: "text/richtext",
            scd: "application/x-msschedule",
            sct: "text/scriptlet",
            setpay: "application/set-payment-initiation",
            setreg: "application/set-registration-initiation",
            sh: "application/x-sh",
            shar: "application/x-shar",
            sit: "application/x-stuffit",
            snd: "audio/basic",
            spc: "application/x-pkcs7-certificates",
            spl: "application/futuresplash",
            src: "application/x-wais-source",
            sst: "application/vnd.ms-pkicertstore",
            stl: "application/vnd.ms-pkistl",
            stm: "text/html",
            svg: "text/xml",
            sv4cpio: "application/x-sv4cpio",
            sv4crc: "application/x-sv4crc",
            swf: "application/x-shockwave-flash",
            t: "application/x-troff",
            tar: "application/x-tar",
            tcl: "application/x-tcl",
            tex: "application/x-tex",
            texi: "application/x-texinfo",
            texinfo: "application/x-texinfo",
            tgz: "application/x-compressed",
            tif: "image/tiff",
            tiff: "image/tiff",
            tr: "application/x-troff",
            trm: "application/x-msterminal",
            tsv: "text/tab-separated-values",
            txt: "text/plain",
            uls: "text/iuls",
            ustar: "application/x-ustar",
            vcf: "text/x-vcard",
            vrml: "x-world/x-vrml",
            wav: "audio/x-wav",
            wbmp: "image/vnd.wap.wbmp",
            wcm: "application/vnd.ms-works",
            wdb: "application/vnd.ms-works",
            wks: "application/vnd.ms-works",
            wmf: "application/x-msmetafile",
            wps: "application/vnd.ms-works",
            wri: "application/x-mswrite",
            wrl: "x-world/x-vrml",
            wrz: "x-world/x-vrml",
            xaf: "x-world/x-vrml",
            xbm: "image/x-xbitmap",
            xla: "application/vnd.ms-excel",
            xlc: "application/vnd.ms-excel",
            xlm: "application/vnd.ms-excel",
            xls: "application/vnd.ms-excel",
            xlt: "application/vnd.ms-excel",
            xlw: "application/vnd.ms-excel",
            xml: "text/xml",
            xof: "x-world/x-vrml",
            xpm: "image/x-xpixmap",
            xwd: "image/x-xwindowdump",
            z: "application/x-compress",
            zip: "application/zip"
        };
    }

    /**
     * Get Puppeteer instance by ID
     * @param {number} instanceId - Instance ID (default: 0)
     * @returns {Object} Puppeteer instance
     */
    getInstance(instanceId = this.defaultInstanceId) {
        return puppeteerSpiderManager.getPuppeteerSpiderInstance(instanceId);
    }

    /**
     * Start HTTP server for receiving download data
     * @param {number} port - Port number (default: 8080)
     */
    async startHttpServer(port = 8080) {
        if (this.httpServer) {
            logger.info('HTTP server already running');
            return;
        }

        return new Promise((resolve, reject) => {
            this.httpServer = http.createServer((req, res) => {
                if (req.method === 'POST') {
                    let data = '';
                    req.on('data', chunk => {
                        data += chunk;
                    });
                    req.on('end', () => {
                        try {
                            const downloadData = JSON.parse(data);
                            this.handleDownloadData(downloadData);
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: true }));
                        } catch (error) {
                            logger.error(`Failed to handle download data: ${error.message}`);
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: error.message }));
                        }
                    });
                } else {
                    res.writeHead(405, { 'Content-Type': 'text/plain' });
                    res.end('Method not allowed');
                }
            });

            this.httpServer.listen(port, () => {
                logger.info(`HTTP server started on port ${port}`);
                resolve();
            });

            this.httpServer.on('error', (error) => {
                logger.error(`HTTP server error: ${error.message}`);
                reject(error);
            });
        });
    }

    /**
     * Handle download data received from browser
     * @param {Object} downloadData - Download data object
     */
    async handleDownloadData(downloadData) {
        try {
            const { filename, data, mimeType } = downloadData;
            
            if (!filename || !data) {
                throw new Error('Missing filename or data');
            }

            // Decode base64 data
            const buffer = Buffer.from(data, 'base64');
            
            // Create target directory if it doesn't exist
            const targetDir = path.dirname(this.downloadPath || filename);
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }

            // Write file
            const targetPath = this.downloadPath || filename;
            fs.writeFileSync(targetPath, buffer);
            
            logger.info(`File downloaded successfully: ${targetPath}`);
            return targetPath;

        } catch (error) {
            logger.error(`Failed to handle download data: ${error.message}`);
            throw error;
        }
    }

    /**
     * Extract filename from URL
     * @param {string} url - URL to extract filename from
     * @returns {string} Filename
     */
    extractFilenameFromUrl(url) {
        try {
            const urlObj = new URL(url);
            let filename = path.basename(urlObj.pathname);
            
            // If no filename or invalid filename, use default
            if (!filename || filename === '/' || filename === '') {
                filename = 'index.html';
            }
            
            // Clean filename
            filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
            
            return filename;
        } catch (error) {
            logger.warn(`Failed to extract filename from URL: ${error.message}`);
            return 'index.html';
        }
    }

    /**
     * Get MIME type from file extension
     * @param {string} filename - Filename
     * @returns {string} MIME type
     */
    getMimeType(filename) {
        const ext = path.extname(filename).toLowerCase().substring(1);
        return this.mimeTypes[ext] || 'application/octet-stream';
    }

    /**
     * Download file using embedded JavaScript
     * @param {string} downloadUrl - URL to download
     * @param {string} targetPath - Target path for file
     * @param {number} instanceId - Instance ID (default: 0)
     * @returns {Object} Download result
     */
    async downloadEmbedded(downloadUrl, targetPath = null, instanceId = this.defaultInstanceId) {
        try {
            const instance = this.getInstance(instanceId);
            if (!instance) {
                throw new Error(`Puppeteer instance ${instanceId} not found`);
            }

            // Start HTTP server if not running
            if (!this.httpServer) {
                await this.startHttpServer();
            }

            // Set target path
            this.downloadPath = targetPath;

            const page = await instance.puppeteerBrowser.pages().then(pages => pages[0]);
            if (!page) {
                throw new Error('No page available');
            }

            // Extract filename from URL
            const filename = this.extractFilenameFromUrl(downloadUrl);
            const mimeType = this.getMimeType(filename);

            // Inject JavaScript to download file
            const downloadScript = `
                (async () => {
                    try {
                        const response = await fetch('${downloadUrl}');
                        const blob = await response.blob();
                        const reader = new FileReader();
                        
                        reader.onload = () => {
                            const base64Data = reader.result.split(',')[1];
                            const downloadData = {
                                filename: '${filename}',
                                data: base64Data,
                                mimeType: '${mimeType}'
                            };
                            
                            fetch('http://localhost:8080', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify(downloadData)
                            });
                        };
                        
                        reader.readAsDataURL(blob);
                        return true;
                    } catch (error) {
                        console.error('Download failed:', error);
                        return false;
                    }
                })();
            `;

            const result = await page.evaluate(downloadScript);
            
            if (result) {
                logger.info(`Embedded download initiated: ${downloadUrl}`);
                return { success: true, filename, targetPath };
            } else {
                throw new Error('Download script execution failed');
            }

        } catch (error) {
            logger.error(`Failed to download file ${downloadUrl}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Download file by clicking download link
     * @param {string} downloadUrl - URL to download
     * @param {string} targetPath - Target path for file
     * @param {string} fileName - Custom filename
     * @param {number} instanceId - Instance ID (default: 0)
     * @returns {Object} Download result
     */
    async downloadByClick(downloadUrl, targetPath = null, fileName = null, instanceId = this.defaultInstanceId) {
        try {
            const instance = this.getInstance(instanceId);
            if (!instance) {
                throw new Error(`Puppeteer instance ${instanceId} not found`);
            }

            const page = await instance.puppeteerBrowser.pages().then(pages => pages[0]);
            if (!page) {
                throw new Error('No page available');
            }

            // Create download link and click it
            const clickScript = `
                (() => {
                    const link = document.createElement('a');
                    link.href = '${downloadUrl}';
                    link.download = '${fileName || this.extractFilenameFromUrl(downloadUrl)}';
                    link.style.display = 'none';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    return true;
                })();
            `;

            await page.evaluate(clickScript);
            logger.info(`Click download initiated: ${downloadUrl}`);

            // Wait for file to be downloaded
            const downloadedFile = await this.waitForDownloadedFile();
            
            // Move file to target path if specified
            if (targetPath && downloadedFile) {
                const targetDir = path.dirname(targetPath);
                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true });
                }
                
                fs.renameSync(downloadedFile, targetPath);
                logger.info(`File moved to: ${targetPath}`);
                return { success: true, targetPath };
            }

            return { success: true, downloadedFile };

        } catch (error) {
            logger.error(`Failed to download file by click ${downloadUrl}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Wait for downloaded file to appear in default download directory
     * @returns {string} Path to downloaded file
     */
    async waitForDownloadedFile() {
        // This is a simplified implementation
        // In a real implementation, you would monitor the default download directory
        // and detect new files based on file system events
        
        return new Promise((resolve, reject) => {
            const timeout = 30000; // 30 seconds timeout
            const interval = 1000; // Check every second
            const startTime = Date.now();
            
            const checkForFile = () => {
                // This is a placeholder - you would implement actual file detection
                // based on your system's default download directory
                if (Date.now() - startTime > timeout) {
                    reject(new Error('Download timeout'));
                    return;
                }
                
                // For now, we'll just resolve after a delay
                // In practice, you'd check the download directory for new files
                setTimeout(() => {
                    resolve('/path/to/downloaded/file'); // Placeholder
                }, 2000);
            };
            
            checkForFile();
        });
    }

    /**
     * Stop HTTP server
     */
    stopHttpServer() {
        if (this.httpServer) {
            this.httpServer.close();
            this.httpServer = null;
            logger.info('HTTP server stopped');
        }
    }
}

module.exports = new PuppeteerDownload(); 