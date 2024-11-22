import fs from 'fs';
import path from 'path';

// Specify directories to ignore
const ignoreDirs = ['node_modules', 'dist', '.git', 'build'];

function scanDir(dir, largeFileSizeMB = 1) {
    const filesAndDirs = fs.readdirSync(dir);

    filesAndDirs.forEach(fileOrDir => {
        const fullPath = path.join(dir, fileOrDir);

        // Skip ignored directories
        if (ignoreDirs.some(ignoreDir => fullPath.includes(ignoreDir))) {
            return;
        }

        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            // Recursively scan subdirectories
            scanDir(fullPath, largeFileSizeMB);
        } else if (stat.isFile()) {
            const fileSizeMB = stat.size / (1024 * 1024); // Convert bytes to megabytes

            if (fileSizeMB > largeFileSizeMB) {
                console.log(`Large file found: ${fullPath} (${fileSizeMB.toFixed(2)} MB)`);
            }
        }
    });
}

// Start scanning from the parent directory
scanDir(path.resolve(path.dirname(''), '../'));
