const VideoCompressionScanner = require('./libs/videoCompressionScanner');

/**
 * Scan directory for video files and analyze compression status
 * @param {string} dirPath - Directory path to scan
 * @returns {Promise<Object>} Scan results containing lists of files needing compression and already compressed files
 */
async function scanVideoDirectory(dirPath) {
    const scanner = new VideoCompressionScanner();
    return await scanner.scanDirectory(dirPath);
}

module.exports = {
    scanVideoDirectory
};
