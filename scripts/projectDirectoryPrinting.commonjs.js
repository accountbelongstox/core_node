const fs = require('fs');
const path = require('path');
const minimatch = require('minimatch');
const logger = require('#@utils_logger');

// Ignored file extensions and directories
const ignoredExtensions = [
    '.log', '.woff2', '.txt', '.md', '.gz', '.gitkeep', '.map', '.vue', '.html', '.mmdb', '.ico',
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp',
    '.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm',
    '.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.zip', '.rar', '.7z', '.tar', '.bz2',
    '.exe', '.dll', '.iso', '.bin',
    '.eot', '.ttf', '.woff',
    '.toml', '.conf', '.sh', '.bat', '.css', '.yaml', '.dockerfile',
    '.cache'
];

const ignoredDirectories = [
    'node_modules', 'build', '.git', '.vscode', 'dist', 'coverage', 'logs'
];

// Exclude patterns
const excludePatterns = [
    '**/node_modules/**',
    '**/*.yaml'
];

/**
 * Check if a path should be excluded based on patterns
 * @param {string} filePath - Path to check
 * @returns {boolean} - True if the path should be excluded
 */
function shouldExclude(filePath) {
    return excludePatterns.some(pattern => minimatch(filePath, pattern, { dot: true }));
}

/**
 * Recursively scan directory and generate directory tree string
 * @param {string} dir - Directory to scan
 * @param {string} prefix - Current line prefix
 * @param {boolean} includeFiles - Whether to include files in output
 * @returns {string} - Generated tree string
 */
function scanDirectory(dir, prefix = '', includeFiles = false) {
    let output = '';
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    let hasVisibleEntries = false;

    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const isLast = i === entries.length - 1;
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory() && (entry.name.startsWith('.') || ignoredDirectories.includes(entry.name))) {
            logger.debug(`Filtered directory: ${fullPath}`);
            continue;
        }

        if (shouldExclude(fullPath)) {
            logger.debug(`Filtered file: ${fullPath}`);
            continue;
        }

        if (entry.isDirectory()) {
            const subdirOutput = scanDirectory(
                fullPath,
                `${prefix}${isLast ? '    ' : '│   '}`,
                includeFiles
            );
            if (subdirOutput) {
                hasVisibleEntries = true;
                output += `${prefix}${isLast ? '└──' : '├──'} ${entry.name}\n`;
                output += subdirOutput;
            }
        } else if (includeFiles) {
            const extname = path.extname(entry.name);
            if (ignoredExtensions.includes(extname)) {
                logger.debug(`Filtered file: ${fullPath}`);
            } else if (extname === '') {
                logger.debug(`File without extension: ${fullPath}`);
                hasVisibleEntries = true;
                output += `${prefix}${isLast ? '└──' : '├──'} ${entry.name}\n`;
            } else {
                hasVisibleEntries = true;
                output += `${prefix}${isLast ? '└──' : '├──'} ${entry.name}\n`;
            }
        }
    }

    return hasVisibleEntries ? output : '';
}

/**
 * Generate and save project directory trees
 * @param {Object} options - Configuration options
 */
function generateProjectTree(options = {}) {
    const {
        projectPath = path.resolve(path.dirname(''), '../'),
        outputPath = path.resolve(path.dirname(''), './'),
        includeFiles = true
    } = options;

    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
    }

    // Output file paths
    const outputFilePath = path.join(outputPath, 'project_file_tree.txt');
    const outputDirPath = path.join(outputPath, 'project_dir_tree.txt');

    // Generate and write trees
    fs.writeFileSync(outputDirPath, scanDirectory(projectPath));
    fs.writeFileSync(outputFilePath, scanDirectory(projectPath, '', includeFiles));

    logger.success(`Directory tree saved to: ${outputDirPath}`);
    logger.success(`File tree saved to: ${outputFilePath}`);
}

// Export functions
module.exports = {
    scanDirectory,
    generateProjectTree,
    shouldExclude,
    ignoredExtensions,
    ignoredDirectories,
    excludePatterns
};

// Execute if run directly
if (require.main === module) {
    generateProjectTree({
        projectPath: path.resolve(__dirname, '../'),
        outputPath: __dirname,
        includeFiles: true
    });
} 