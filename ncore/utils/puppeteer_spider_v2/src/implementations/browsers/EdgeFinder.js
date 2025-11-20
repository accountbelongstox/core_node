// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

'use strict';

const logger = require('#@logger');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class EdgeFinder {
    constructor() {
        this.platform = process.platform;
        this.edgePaths = this.getEdgePaths();
    }

    getEdgePaths() {
        const paths = [];
        
        if (this.platform === 'win32') {
            // Common paths first
            paths.push(
                'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
                'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
                `C:\\Users\\${process.env.USERNAME}\\AppData\\Local\\Microsoft\\Edge\\Application\\msedge.exe`
            );
            
            // Custom applications directory
            paths.push(
                'D:\\applications\\Microsoft\\Edge\\Application\\msedge.exe',
                'D:\\applications\\Edge\\Application\\msedge.exe',
                'D:\\applications\\msedge.exe'
            );
            
            // Additional paths
            paths.push(
                `C:\\Users\\${process.env.USERNAME}\\AppData\\Local\\Microsoft\\Edge Beta\\Application\\msedge.exe`,
                `C:\\Users\\${process.env.USERNAME}\\AppData\\Local\\Microsoft\\Edge Dev\\Application\\msedge.exe`
            );
        } else if (this.platform === 'linux') {
            // Common paths first
            paths.push(
                '/usr/bin/microsoft-edge',
                '/usr/bin/microsoft-edge-stable',
                '/snap/bin/microsoft-edge'
            );
            
            // Additional paths
            paths.push(
                '/usr/bin/microsoft-edge-beta',
                '/usr/bin/microsoft-edge-dev',
                '/opt/microsoft/msedge/msedge',
                '/opt/microsoft/msedge-beta/msedge',
                '/opt/microsoft/msedge-dev/msedge',
                '/usr/local/bin/microsoft-edge',
                '/usr/local/bin/microsoft-edge-stable'
            );
        } else if (this.platform === 'darwin') {
            paths.push(
                '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
                '/Applications/Microsoft Edge Beta.app/Contents/MacOS/Microsoft Edge Beta',
                '/Applications/Microsoft Edge Dev.app/Contents/MacOS/Microsoft Edge Dev'
            );
        }
        
        return paths;
    }

    async find() {
        try {
            logger.info('Searching for Microsoft Edge executable...');
            
            // Step 1: Try which command (Linux/macOS)
            if (this.platform === 'linux' || this.platform === 'darwin') {
                const whichPath = this.findEdgeWithWhich();
                if (whichPath) {
                    return whichPath;
                }
            }
            
            // Step 2: Check common paths
            for (const edgePath of this.edgePaths) {
                if (fs.existsSync(edgePath)) {
                    logger.info(`Found Edge executable: ${edgePath}`);
                    return edgePath;
                }
            }
            
            // Step 3: Scan common directories
            const scannedPath = this.scanCommonDirectories();
            if (scannedPath) {
                return scannedPath;
            }
            
            // Step 4: Wide range search
            const wideSearchPath = this.wideRangeSearch();
            if (wideSearchPath) {
                return wideSearchPath;
            }
            
            logger.warn('Microsoft Edge executable not found');
            return null;
        } catch (error) {
            logger.error('Failed to find Edge browser:', error);
            throw error;
        }
    }

    findEdgeWithWhich() {
        try {
            const commands = ['microsoft-edge', 'microsoft-edge-stable', 'msedge', 'edge'];
            for (const cmd of commands) {
                try {
                    const result = execSync(`which ${cmd}`, { encoding: 'utf8', timeout: 5000 });
                    const path = result.trim();
                    if (path && fs.existsSync(path)) {
                        logger.info(`Found Edge via which command: ${path}`);
                        return path;
                    }
                } catch (error) {
                    // Continue to next command
                }
            }
        } catch (error) {
            logger.debug('which command failed:', error.message);
        }
        return null;
    }

    scanCommonDirectories() {
        const commonDirs = [];
        
        if (this.platform === 'win32') {
            commonDirs.push(
                'C:\\Program Files\\Microsoft',
                'C:\\Program Files (x86)\\Microsoft',
                'D:\\applications',
                'D:\\applications\\Microsoft',
                `C:\\Users\\${process.env.USERNAME}\\AppData\\Local\\Microsoft`
            );
        } else if (this.platform === 'linux') {
            commonDirs.push(
                '/usr/bin',
                '/usr/local/bin',
                '/opt',
                '/snap/bin',
                '/home/' + process.env.USER + '/.local/bin'
            );
        } else if (this.platform === 'darwin') {
            commonDirs.push(
                '/Applications',
                '/usr/local/bin',
                '/opt/homebrew/bin'
            );
        }
        
        for (const dir of commonDirs) {
            if (fs.existsSync(dir)) {
                const foundPath = this.scanDirectoryForEdge(dir);
                if (foundPath) {
                    return foundPath;
                }
            }
        }
        
        return null;
    }

    scanDirectoryForEdge(dir) {
        try {
            const files = fs.readdirSync(dir, { withFileTypes: true });
            
            for (const file of files) {
                if (file.isDirectory()) {
                    // Recursively search subdirectories (limited depth)
                    const subDir = path.join(dir, file.name);
                    if (this.shouldSearchSubdirectory(file.name)) {
                        const foundPath = this.scanDirectoryForEdge(subDir);
                        if (foundPath) {
                            return foundPath;
                        }
                    }
                } else if (file.isFile()) {
                    // Check if file is Edge executable
                    if (this.isEdgeExecutable(file.name)) {
                        const filePath = path.join(dir, file.name);
                        if (this.isValidPath(filePath)) {
                            logger.info(`Found Edge via directory scan: ${filePath}`);
                            return filePath;
                        }
                    }
                }
            }
        } catch (error) {
            logger.debug(`Failed to scan directory ${dir}:`, error.message);
        }
        return null;
    }

    shouldSearchSubdirectory(dirName) {
        const edgeKeywords = ['edge', 'microsoft', 'msedge'];
        return edgeKeywords.some(keyword => 
            dirName.toLowerCase().includes(keyword)
        );
    }

    isEdgeExecutable(fileName) {
        const edgeNames = ['msedge.exe', 'microsoft-edge', 'edge'];
        return edgeNames.some(name => 
            fileName.toLowerCase().includes(name.toLowerCase())
        );
    }

    wideRangeSearch() {
        try {
            logger.info('Performing wide range search for Edge...');
            
            if (this.platform === 'win32') {
                return this.wideRangeSearchWindows();
            } else if (this.platform === 'linux') {
                return this.wideRangeSearchLinux();
            } else if (this.platform === 'darwin') {
                return this.wideRangeSearchMacOS();
            }
        } catch (error) {
            logger.debug('Wide range search failed:', error.message);
        }
        return null;
    }

    wideRangeSearchWindows() {
        try {
            // Use where command
            const result = execSync('where msedge', { encoding: 'utf8', timeout: 10000 });
            const paths = result.trim().split('\n');
            for (const path of paths) {
                if (path.trim() && this.isValidPath(path.trim())) {
                    return path.trim();
                }
            }
        } catch (error) {
            logger.debug('Windows wide search failed:', error.message);
        }
        return null;
    }

    wideRangeSearchLinux() {
        try {
            // Use find command
            const commands = [
                'find /usr -name "*edge*" -type f 2>/dev/null',
                'find /opt -name "*edge*" -type f 2>/dev/null',
                'find /snap -name "*edge*" -type f 2>/dev/null'
            ];
            
            for (const cmd of commands) {
                try {
                    const result = execSync(cmd, { encoding: 'utf8', timeout: 15000 });
                    const paths = result.trim().split('\n');
                    for (const path of paths) {
                        if (path.trim() && this.isValidPath(path.trim())) {
                            return path.trim();
                        }
                    }
                } catch (error) {
                    // Continue to next command
                }
            }
        } catch (error) {
            logger.debug('Linux wide search failed:', error.message);
        }
        return null;
    }

    wideRangeSearchMacOS() {
        try {
            // Use find command
            const commands = [
                'find /Applications -name "*Edge*" -type f 2>/dev/null',
                'find /usr/local -name "*edge*" -type f 2>/dev/null',
                'find /opt/homebrew -name "*edge*" -type f 2>/dev/null'
            ];
            
            for (const cmd of commands) {
                try {
                    const result = execSync(cmd, { encoding: 'utf8', timeout: 15000 });
                    const paths = result.trim().split('\n');
                    for (const path of paths) {
                        if (path.trim() && this.isValidPath(path.trim())) {
                            return path.trim();
                        }
                    }
                } catch (error) {
                    // Continue to next command
                }
            }
        } catch (error) {
            logger.debug('macOS wide search failed:', error.message);
        }
        return null;
    }

    async isValidPath(edgePath) {
        try {
            if (fs.existsSync(edgePath)) {
                const stats = fs.statSync(edgePath);
                if (stats.isFile() && this.isExecutable(edgePath)) {
                    return true;
                }
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    isExecutable(filePath) {
        try {
            if (this.platform === 'win32') {
                return filePath.toLowerCase().endsWith('.exe');
            } else {
                const stats = fs.statSync(filePath);
                return !!(stats.mode & parseInt('111', 8));
            }
        } catch (error) {
            return false;
        }
    }

    async getVersion(edgePath) {
        try {
            if (!edgePath) {
                edgePath = await this.find();
            }
            
            if (!edgePath) {
                return null;
            }
            
            const version = execSync(`"${edgePath}" --version`, { 
                encoding: 'utf8', 
                timeout: 10000 
            });
            
            return version.trim();
        } catch (error) {
            logger.error('Failed to get Edge version:', error);
            return null;
        }
    }

    getInfo() {
        return {
            platform: this.platform,
            searchPaths: this.edgePaths.length,
            paths: this.edgePaths
        };
    }
}

module.exports = EdgeFinder;