import fs from 'fs';
import path from 'path';

/**
 * Recursively scan a directory and rename files with '.go' extension to '.go.bak'.
 * @param {string} dir - The directory to scan.
 */
const renameGoFiles = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Recursively scan subdirectories
      renameGoFiles(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.go')) {
      // Construct new file name
      const newFileName = `${entry.name}.bak`;
      const newFullPath = path.join(dir, newFileName);

      // Rename the file
      fs.renameSync(fullPath, newFullPath);
      console.log(`Renamed: ${fullPath} -> ${newFullPath}`);
    }
  }
};

// Define the target directory to scan
const targetDirectory = path.resolve('../'); // Change this to your desired path

// Start the renaming process
renameGoFiles(targetDirectory);
console.log('Renaming process completed.');
