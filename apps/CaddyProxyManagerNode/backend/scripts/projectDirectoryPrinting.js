import fs from 'fs';
import path from 'path';

class DirectoryPrinter {
    constructor(startPath) {
        this.startPath = startPath;
        this.indentString = '    ';
        this.excludedDirs = new Set([
            'node_modules',
            '.git',
            'dist',
            'build',
            'coverage'
        ]);
    }

    /**
     * Generate directory tree structure
     * @returns {string} Directory tree as string
     */
    generateTree() {
        return this.processDirectory(this.startPath);
    }

    /**
     * Process a directory and its contents
     * @param {string} dirPath - Path to process
     * @param {number} level - Current indentation level
     * @returns {string} Formatted directory contents
     */
    processDirectory(dirPath, level = 0) {
        let output = '';
        const items = fs.readdirSync(dirPath);

        items.forEach((item, index) => {
            const fullPath = path.join(dirPath, item);
            const stats = fs.statSync(fullPath);
            const isLast = index === items.length - 1;

            if (this.shouldSkip(item)) {
                return;
            }

            output += this.getIndentation(level, isLast);
            output += item;
            output += '\n';

            if (stats.isDirectory()) {
                output += this.processDirectory(fullPath, level + 1);
            }
        });

        return output;
    }

    /**
     * Check if item should be skipped
     * @param {string} item - Item name to check
     * @returns {boolean} True if should skip
     */
    shouldSkip(item) {
        return this.excludedDirs.has(item) || item.startsWith('.');
    }

    /**
     * Generate indentation string
     * @param {number} level - Indentation level
     * @param {boolean} isLast - If item is last in list
     * @returns {string} Formatted indentation
     */
    getIndentation(level, isLast) {
        let indent = '';
        
        for (let i = 0; i < level; i++) {
            indent += this.indentString;
        }

        return level === 0 ? '' : `${indent}${isLast ? '└── ' : '├── '}`;
    }

    /**
     * Save tree to file
     * @param {string} outputPath - Path to save file
     */
    saveToFile(outputPath) {
        try {
            const tree = this.generateTree();
            fs.writeFileSync(outputPath, tree);
            console.log('Directory tree saved successfully!');
        } catch (error) {
            console.error('Error saving directory tree:', error);
        }
    }
}

// Usage example
const projectRoot = '../';
const outputFile = '../DocumentTable.md';

const printer = new DirectoryPrinter(projectRoot);
printer.saveToFile(outputFile);

export default DirectoryPrinter;
