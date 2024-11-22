import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current file path and the parent directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_DIR = path.resolve(__dirname, '..'); // Parent directory

// Maximum scanning depth
const MAX_DEPTH = 3;
// Excluded directories
const EXCLUDE_DIRS = ['.git', 'node_modules'];

// Recursively calculate folder size
async function getFolderSize(dir, depth = 0) {
  if (depth > MAX_DEPTH) return 0;

  let totalSize = 0;
  try {
    const files = await fs.promises.readdir(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      if (EXCLUDE_DIRS.includes(file)) continue;

      const stats = await fs.promises.stat(filePath);
      if (stats.isDirectory()) {
        totalSize += await getFolderSize(filePath, depth + 1);
      } else {
        totalSize += stats.size;
      }
    }
  } catch (error) {
    console.error(`Error reading ${dir}: ${error.message}`);
  }
  return totalSize;
}

// Main function to scan directories
async function scanDirectories(baseDir) {
  const folderSizes = [];
  try {
    const subDirs = await fs.promises.readdir(baseDir);
    for (const dir of subDirs) {
      const dirPath = path.join(baseDir, dir);
      const stats = await fs.promises.stat(dirPath);
      if (stats.isDirectory() && !EXCLUDE_DIRS.includes(dir)) {
        const size = await getFolderSize(dirPath);
        folderSizes.push({ name: dir, size });
      }
    }

    // Sort folders by size in descending order
    folderSizes.sort((a, b) => b.size - a.size);

    // Display folder sizes
    console.log('Folder sizes (sorted by size):');
    folderSizes.forEach(folder => {
      console.log(`${folder.name}: ${formatBytes(folder.size)}`);
    });
  } catch (error) {
    console.error(`Error scanning directories: ${error.message}`);
  }
}

// Helper function to format bytes into a readable format
function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  return `${bytes.toFixed(2)} ${units[i]}`;
}

// Start scanning
scanDirectories(BASE_DIR);
