const fs = require('fs');
const path = require('path');
const minimatch = require('minimatch');

// 忽略的文件扩展名和目录
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

// 忽略的模式
const excludePatterns = [
  "**/node_modules/**",
  "**/*.yaml"
];

/**
 * Check if a path should be excluded based on the patterns
 * @param {string} filePath - Path to check
 * @returns {boolean} - True if the path should be excluded
 */
function shouldExclude(filePath) {
  return excludePatterns.some(pattern => minimatch(filePath, pattern, { dot: true }));
}

// 递归扫描目录并生成目录树字符串
function scanDirectory(dir, prefix = '', includeFiles = false) {
  let output = '';
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  let hasVisibleEntries = false;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const isLast = i === entries.length - 1;
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory() && (entry.name.startsWith('.') || ignoredDirectories.includes(entry.name))) {
      console.log(`过滤掉目录: ${fullPath}`);
      continue;
    }

    if (shouldExclude(fullPath)) {
      console.log(`过滤掉文件: ${fullPath}`);
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
        console.log(`过滤掉文件: ${fullPath}`);
      } else if (extname === '') {
        console.log(`文件没有扩展名: ${fullPath}`);
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

// 项目路径
const projectPath = path.resolve(__dirname, '../');
const outPath = path.resolve(__dirname, './');

// 创建目录（如果不存在）
if (!fs.existsSync(outPath)) {
  fs.mkdirSync(outPath, { recursive: true });
}

// 输出文件路径
const outputFilePath = path.join(outPath, 'project_file_tree.txt');
const outputDirPath = path.join(outPath, 'project_dir_tree.txt');

// 写入目录树到文件
fs.writeFileSync(outputDirPath, scanDirectory(projectPath));
fs.writeFileSync(outputFilePath, scanDirectory(projectPath, '', true));

console.log(`目录树已保存到文件：${outputFilePath}`);
console.log(`目录树已保存到文件：${outputDirPath}`);
