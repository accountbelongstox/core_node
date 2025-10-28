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

const fs = require('fs');
const path = require('path');
const logger = require('#@logger');
const { execSync } = require('child_process');

class EdgeFinder {
    constructor() {
        this.platform = process.platform;
        this.edgePaths = this.getEdgePaths();
    }

    // Get Edge paths based on platform
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

    // Find Edge executable
    findEdgeExecutable() {
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
    }

    // Find Edge using which command (Linux/macOS)
    findEdgeWithWhich() {
        try {
            const commands = ['microsoft-edge', 'microsoft-edge-stable', 'msedge'];
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

    // Scan common directories for Edge
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

    // Scan directory for Edge executable
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
                        if (this.platform === 'win32' || fs.accessSync(filePath, fs.constants.X_OK)) {
                            logger.info(`Found Edge executable in directory scan: ${filePath}`);
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

    // Check if subdirectory should be searched
    shouldSearchSubdirectory(dirName) {
        const searchDirs = ['Edge', 'Microsoft', 'msedge', 'Applications'];
        return searchDirs.some(dir => dirName.toLowerCase().includes(dir.toLowerCase()));
    }

    // Check if file is Edge executable
    isEdgeExecutable(fileName) {
        const edgeNames = ['msedge', 'microsoft-edge', 'edge'];
        return edgeNames.some(name => fileName.toLowerCase().includes(name.toLowerCase()));
    }

    // Wide range search for Edge
    wideRangeSearch() {
        logger.info('Performing wide range search for Edge...');
        
        if (this.platform === 'win32') {
            return this.wideRangeSearchWindows();
        } else if (this.platform === 'linux') {
            return this.wideRangeSearchLinux();
        } else if (this.platform === 'darwin') {
            return this.wideRangeSearchMacOS();
        }
        
        return null;
    }

    // Wide range search on Windows
    wideRangeSearchWindows() {
        const searchPaths = [
            'C:\\',
            'D:\\',
            `C:\\Users\\${process.env.USERNAME}\\`
        ];
        
        for (const searchPath of searchPaths) {
            if (fs.existsSync(searchPath)) {
                try {
                    const foundPath = this.findEdgeInPath(searchPath, 'msedge.exe');
                    if (foundPath) {
                        return foundPath;
                    }
                } catch (error) {
                    logger.debug(`Wide search failed for ${searchPath}:`, error.message);
                }
            }
        }
        
        return null;
    }

    // Wide range search on Linux
    wideRangeSearchLinux() {
        const searchPaths = [
            '/usr',
            '/opt',
            '/snap',
            '/home/' + process.env.USER
        ];
        
        for (const searchPath of searchPaths) {
            if (fs.existsSync(searchPath)) {
                try {
                    const foundPath = this.findEdgeInPath(searchPath, 'microsoft-edge');
                    if (foundPath) {
                        return foundPath;
                    }
                } catch (error) {
                    logger.debug(`Wide search failed for ${searchPath}:`, error.message);
                }
            }
        }
        
        return null;
    }

    // Wide range search on macOS
    wideRangeSearchMacOS() {
        const searchPaths = [
            '/Applications',
            '/usr/local',
            '/opt'
        ];
        
        for (const searchPath of searchPaths) {
            if (fs.existsSync(searchPath)) {
                try {
                    const foundPath = this.findEdgeInPath(searchPath, 'Microsoft Edge');
                    if (foundPath) {
                        return foundPath;
                    }
                } catch (error) {
                    logger.debug(`Wide search failed for ${searchPath}:`, error.message);
                }
            }
        }
        
        return null;
    }

    // Find Edge in specific path
    findEdgeInPath(searchPath, executableName) {
        try {
            const command = this.platform === 'win32' 
                ? `dir /s /b "${searchPath}\\${executableName}"`
                : `find "${searchPath}" -name "${executableName}" -type f 2>/dev/null`;
            
            const result = execSync(command, { encoding: 'utf8', timeout: 30000 });
            const lines = result.trim().split('\n').filter(line => line.trim());
            
            for (const line of lines) {
                const filePath = line.trim();
                if (fs.existsSync(filePath)) {
                    logger.info(`Found Edge in wide search: ${filePath}`);
                    return filePath;
                }
            }
        } catch (error) {
            logger.debug(`Failed to search in ${searchPath}:`, error.message);
        }
        
        return null;
    }

    // Get Edge version from Windows registry
    getEdgeVersionFromRegistry() {
        if (this.platform !== 'win32') {
            return null;
        }
        
        try {
            const regQueries = [
                'reg query "HKEY_CURRENT_USER\\Software\\Microsoft\\Edge\\BLBeacon" /v version',
                'reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Edge\\BLBeacon" /v version',
                'reg query "HKEY_CURRENT_USER\\Software\\Microsoft\\Edge\\Update" /v version',
                'reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Edge\\Update" /v version'
            ];
            
            for (const regQuery of regQueries) {
                try {
                    const result = execSync(regQuery, { encoding: 'utf8', timeout: 5000 });
                    const versionMatch = result.match(/version\s+REG_SZ\s+(.+)/);
                    if (versionMatch) {
                        const version = versionMatch[1].trim();
                        logger.info(`Found Edge version in registry: ${version}`);
                        return version;
                    }
                } catch (error) {
                    // Continue to next registry query
                }
            }
        } catch (error) {
            logger.debug('Failed to get Edge version from registry:', error.message);
        }
        
        return null;
    }

    // Get Edge version from executable
    getEdgeVersionFromExecutable(edgePath) {
        try {
            let command;
            
            if (this.platform === 'win32') {
                command = `"${edgePath}" --version`;
            } else {
                command = `${edgePath} --version`;
            }
            
            const result = execSync(command, { encoding: 'utf8', timeout: 5000 });
            const versionMatch = result.match(/(\d+\.\d+\.\d+\.\d+)/);
            if (versionMatch) {
                const version = versionMatch[1];
                logger.info(`Found Edge version from executable: ${version}`);
                return version;
            }
        } catch (error) {
            logger.debug('Failed to get Edge version from executable:', error.message);
        }
        
        return null;
    }

    // Get Edge version
    getEdgeVersion(edgePath = null) {
        if (!edgePath) {
            edgePath = this.findEdgeExecutable();
        }
        
        if (!edgePath) {
            return null;
        }
        
        // Try registry first (Windows only)
        let version = this.getEdgeVersionFromRegistry();
        if (version) {
            return version;
        }
        
        // Try executable
        version = this.getEdgeVersionFromExecutable(edgePath);
        if (version) {
            return version;
        }
        
        logger.warn('Could not determine Edge version');
        return null;
    }

    // Check if Edge is installed
    isEdgeInstalled() {
        const edgePath = this.findEdgeExecutable();
        return edgePath !== null;
    }

    // Get Edge info
    getEdgeInfo() {
        const edgePath = this.findEdgeExecutable();
        if (!edgePath) {
            return null;
        }
        
        const version = this.getEdgeVersion(edgePath);
        
        return {
            executablePath: edgePath,
            version: version || 'unknown',
            browserType: 'edge',
            platform: this.platform,
            isInstalled: true
        };
    }

    // Find all Edge installations
    findAllEdgeInstallations() {
        const installations = [];
        
        for (const edgePath of this.edgePaths) {
            if (fs.existsSync(edgePath)) {
                const version = this.getEdgeVersionFromExecutable(edgePath);
                installations.push({
                    executablePath: edgePath,
                    version: version || 'unknown',
                    browserType: 'edge',
                    platform: this.platform
                });
            }
        }
        
        return installations;
    }
}

module.exports = EdgeFinder;
