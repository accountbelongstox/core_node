const fs = require('fs');
const path = require('path');
const minimatch = require('minimatch');
const { copyFile, mkdir, stat, readdir } = fs.promises;

const {appname} = require(`./ncore/globalvars`);

const excludeExtensions = ['.ts'];
const excludeDirs = ['.git'];
const copyObjects = [
  { src: '.', dist: '.ncore' }
];

const excludePatterns = [
  "**/ncore/**",
  "**/.ncore/**",
  "**/.github/**",
  "**/.doc/**",
  "**/.audit/**",
  "**/.idea/**",
  "**/node_modules/**",
];

/**
 * Check if a path should be excluded based on the patterns
 * @param {string} filePath - Path to check
 * @returns {boolean} - True if the path should be excluded
 */
function shouldExclude(filePath) {
  const isExcluded = excludePatterns.some(pattern => minimatch(filePath, pattern, { dot: true }));
  if (isExcluded) {
    // console.log(`Excluding: ${filePath}`);
  }
  return isExcluded;
}

/**
 * Recursively copy files from src to dist
 * @param {string} src - Source directory
 * @param {string} dist - Destination directory
 */
async function copyRecursive(src, dist) {
  // Create the destination directory if it doesn't exist
  await mkdir(dist, { recursive: true });

  // Read the contents of the source directory
  const entries = await readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const distPath = path.join(dist, entry.name);

    // Exclude directories and extensions
    if (excludeDirs.includes(entry.name) || excludeExtensions.includes(path.extname(entry.name))) {
      continue;
    }

    // Check if the path matches any exclude patterns
    if (shouldExclude(srcPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      // Recursively copy directories
      await copyRecursive(srcPath, distPath);
    } else {
      // Check if the destination file exists
      let srcStat = await stat(srcPath);
      let distStat;
      try {
        distStat = await stat(distPath);
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
      }

      // Copy file if it doesn't exist or if the source file is newer
      if (!distStat || srcStat.mtime > distStat.mtime) {
        await copyFile(srcPath, distPath);
        let reason = !distStat ? 'Destination file does not exist' : 'Source file is newer';
        console.log(`Copied ${srcPath} to ${distPath} (${reason})`);
      }
    }
  }
}

/**
 * Main function to copy objects based on copyObjects array
 */
async function main() {
  for (const { src, dist } of copyObjects) {
    const srcPath = path.resolve(src);
    const distPath = path.resolve(dist);
    await copyRecursive(srcPath, distPath);
  }
}

main().catch(err => console.error(err));
