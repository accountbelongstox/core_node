import fs from 'fs';
import path from 'path';

/**
 * Recursively scan a directory and rename files with '.go.md' extension to '.go.to.js.md'.
 * @param {string} dir - The directory to scan.
 */
const renameGoMdFiles = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Recursively scan subdirectories
      renameGoMdFiles(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.go.md')) {
      // Construct new file name
      const newFileName = entry.name.replace(/\.go\.md$/, '.go.to.js.md');
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
renameGoMdFiles(targetDirectory);
console.log('Renaming process completed.');
