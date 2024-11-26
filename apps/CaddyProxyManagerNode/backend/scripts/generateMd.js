import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const writeFile = promisify(fs.writeFile);

// Recursively scan a folder for .go files
async function scanFolder(folderPath) {
  try {
    const files = await readdir(folderPath);

    for (const file of files) {
      const fullPath = path.join(folderPath, file);
      const fileStats = await stat(fullPath);

      if (fileStats.isDirectory()) {
        // Recursively process subdirectories
        await scanFolder(fullPath);
      } else if (fileStats.isFile() && path.extname(fullPath) === '.go') {
        // Process Go file
        await generateMarkdown(fullPath);
      }
    }
  } catch (err) {
    console.error('Error reading folder:', err);
  }
}

// Generate a corresponding .md file with a specific comment
async function generateMarkdown(goFilePath) {
  const mdFilePath = goFilePath.replace(/\.go$/, '.txt');
  const fileNameWithoutExt = path.basename(goFilePath, '.go');
  const commentContent = `<!-- This file documents the functionality and API of the corresponding ${fileNameWithoutExt}.js file -->\n\n`;

  try {
    await writeFile(mdFilePath, commentContent);
    console.log(`Markdown file created: ${mdFilePath}`);
  } catch (err) {
    console.error('Error creating Markdown file:', err);
  }
}

// Specify the target folder to scan
const targetFolder = '../'; // Replace with your actual folder path
scanFolder(targetFolder);
