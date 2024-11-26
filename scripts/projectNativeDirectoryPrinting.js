import fs from 'fs';
import path from 'path';

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

const ignoredDirectories = ['node_modules', 'build', '.git', '.vscode', 'dist', 'coverage', 'logs'];

// Excluded patterns
const excludePatterns = [
  'node_modules',
  '.yaml',
  '__pycache__'
];

/**
 * Check if a path should be excluded based on the patterns
 * @param {string} filePath - Path to check
 * @returns {boolean} - True if the path should be excluded
 */
const shouldExclude = (filePath) => {
  return excludePatterns.some(pattern => filePath.includes(pattern));
};

// Recursively scan a directory and generate a directory tree string
const scanDirectory = (dir, prefix = '', includeFiles = false) => {
  let output = '';
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  let hasVisibleEntries = false;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const isLast = i === entries.length - 1;
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory() && (entry.name.startsWith('.') || ignoredDirectories.includes(entry.name))) {
      console.log(`Filtered directory: ${fullPath}`);
      continue;
    }

    if (shouldExclude(fullPath)) {
      console.log(`Filtered file: ${fullPath}`);
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
        console.log(`Filtered file: ${fullPath}`);
      } else if (extname === '') {
        console.log(`File without extension: ${fullPath}`);
        hasVisibleEntries = true;
        output += `${prefix}${isLast ? '└──' : '├──'} ${entry.name}\n`;
      } else {
        hasVisibleEntries = true;
        output += `${prefix}${isLast ? '└──' : '├──'} ${entry.name}\n`;
      }
    }
  }

  return hasVisibleEntries ? output : '';
};

// Project path
const projectPath = path.resolve(path.dirname(''), '../');
const outputPath = path.resolve(path.dirname(''), './');

// Create output directory if it doesn't exist
if (!fs.existsSync(outputPath)) {
  fs.mkdirSync(outputPath, { recursive: true });
}

// Output file paths
const outputFilePath = path.join(outputPath, 'project_file_tree.txt');
const outputDirPath = path.join(outputPath, 'project_dir_tree.txt');

// Write directory tree to files
fs.writeFileSync(outputDirPath, scanDirectory(projectPath));
fs.writeFileSync(outputFilePath, scanDirectory(projectPath, '', true));

console.log(`Directory tree saved to: ${outputDirPath}`);
console.log(`File tree saved to: ${outputFilePath}`);
