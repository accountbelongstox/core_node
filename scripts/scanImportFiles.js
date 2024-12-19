const fs = require('fs');
const path = require('path');

// Function to scan directory recursively
function scanDirectory(dir, results = []) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            // Recursively scan subdirectories
            scanDirectory(fullPath, results);
        } else if (file.endsWith('.js')) {
            // Check if file contains import statement
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('import ')) {
                results.push(fullPath);
            }
        }
    }
    
    return results;
}

// Function to scan multiple directories
function scanPaths(paths, outputFile) {
    const results = [];
    
    // Scan each path
    for (const dirPath of paths) {
        if (fs.existsSync(dirPath)) {
            console.log(`Scanning directory: ${dirPath}`);
            const foundFiles = scanDirectory(dirPath);
            results.push(...foundFiles);
        } else {
            console.warn(`Warning: Path does not exist: ${dirPath}`);
        }
    }
    
    // Write results to file with spacing and separator every 2 files
    if (results.length > 0) {
        const outputContent = results
            .map((file, index) => {
                // if ((index + 1) % 2 === 0 && index < results.length - 1) {
                //     return file + '\n以上文件改为COMMONJS, 不要删除任何代码，代码全英文，你只需要处理import和__dirname的路径\n';
                // }
                return file;
            })
            .join('\n');
            
        fs.writeFileSync(outputFile, outputContent, 'utf8');
        console.log(`Found ${results.length} files with import statements`);
        console.log(`Results written to: ${outputFile}`);
    } else {
        console.log('No files with import statements found');
    }
    
    return results;
}

// Paths to scan
const pathsToScan = [
    path.join(__dirname, '..', 'ncore'),
    path.join(__dirname, '..', 'apps')
];

const outputFile = path.join(__dirname, 'import_files.txt');
scanPaths(pathsToScan, outputFile); 