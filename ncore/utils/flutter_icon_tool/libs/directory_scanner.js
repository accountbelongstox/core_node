// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

const path = require('path');
const fs = require('fs');
const logger = require('#@logger');
const ftools = require('#@ftools');

class DirectoryScanner {
    constructor() {
        this.defaultIgnorePatterns = [
            'node_modules',
            '.git',
            '.dart_tool',
            'build',
            '.flutter-plugins',
            '.flutter-plugins-dependencies'
        ];
    }

    async scanDirectory(dirPath, extensions = [], ignorePatterns = []) {
        try {
            const absolutePath = path.resolve(dirPath);
            
            if (!ftools.file.exists(absolutePath)) {
                logger.warn('Directory does not exist', { dirPath: absolutePath });
                return [];
            }

            const allIgnorePatterns = [...this.defaultIgnorePatterns, ...ignorePatterns];
            const foundImages = [];

            await this.recursiveScan(absolutePath, extensions, allIgnorePatterns, foundImages);
            
            logger.info(`Found ${foundImages.length} images in ${dirPath}`);
            return foundImages;
            
        } catch (error) {
            logger.error('Error scanning directory', { dirPath, error: error.message });
            return [];
        }
    }

    async recursiveScan(dirPath, extensions, ignorePatterns, foundImages) {
        try {
            const entries = fs.readdirSync(dirPath);
            
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry);
                
                if (this.shouldIgnore(entry, ignorePatterns)) {
                    continue;
                }

                const stats = fs.statSync(fullPath);
                
                if (stats.isDirectory()) {
                    await this.recursiveScan(fullPath, extensions, ignorePatterns, foundImages);
                } else if (stats.isFile()) {
                    const ext = path.extname(entry).toLowerCase();
                    if (extensions.length === 0 || extensions.includes(ext)) {
                        foundImages.push(fullPath);
                    }
                }
            }
        } catch (error) {
            logger.warn('Error scanning subdirectory', { dirPath, error: error.message });
        }
    }

    shouldIgnore(entryName, ignorePatterns) {
        return ignorePatterns.some(pattern => {
            if (pattern.includes('*') || pattern.includes('?')) {
                return this.matchesGlob(entryName, pattern);
            }
            return entryName === pattern || entryName.includes(pattern);
        });
    }

    matchesGlob(str, pattern) {
        const regex = pattern
            .replace(/\./g, '\\.')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');
        
        return new RegExp(`^${regex}$`, 'i').test(str);
    }

    async scanFlutterPlatforms(projectPath, platforms = ['android', 'ios', 'windows', 'web'], extensions = []) {
        try {
            const results = {};
            const projectDir = path.resolve(projectPath);
            
            if (!ftools.file.exists(projectDir)) {
                throw new Error(`Project directory does not exist: ${projectDir}`);
            }

            for (const platform of platforms) {
                const platformDir = path.join(projectDir, platform);
                
                if (ftools.file.exists(platformDir)) {
                    logger.info(`Scanning platform: ${platform}`, { platformDir });
                    results[platform] = await this.scanDirectory(platformDir, extensions);
                } else {
                    logger.warn(`Platform directory not found: ${platformDir}`);
                    results[platform] = [];
                }
            }

            return results;
            
        } catch (error) {
            logger.error('Error scanning Flutter platforms', { projectPath, error: error.message });
            throw error;
        }
    }

    async scanSpecificDirectories(baseDir, targetDirs, extensions = []) {
        try {
            const results = {};
            const basePath = path.resolve(baseDir);
            
            for (const targetDir of targetDirs) {
                const fullPath = path.join(basePath, targetDir);
                
                if (ftools.file.exists(fullPath)) {
                    const images = await this.scanDirectory(fullPath, extensions);
                    results[targetDir] = images;
                    logger.info(`Scanned ${targetDir}: found ${images.length} images`);
                } else {
                    logger.warn(`Target directory not found: ${fullPath}`);
                    results[targetDir] = [];
                }
            }

            return results;
            
        } catch (error) {
            logger.error('Error scanning specific directories', { baseDir, targetDirs, error: error.message });
            throw error;
        }
    }

    getDirectoryStructure(dirPath, maxDepth = 3) {
        try {
            const absolutePath = path.resolve(dirPath);
            
            if (!ftools.file.exists(absolutePath)) {
                return null;
            }

            return this.buildDirectoryTree(absolutePath, 0, maxDepth);
            
        } catch (error) {
            logger.error('Error getting directory structure', { dirPath, error: error.message });
            return null;
        }
    }

    buildDirectoryTree(dirPath, currentDepth, maxDepth) {
        if (currentDepth >= maxDepth) {
            return { name: path.basename(dirPath), type: 'directory', truncated: true };
        }

        try {
            const entries = fs.readdirSync(dirPath);
            const tree = {
                name: path.basename(dirPath),
                type: 'directory',
                path: dirPath,
                children: []
            };

            for (const entry of entries) {
                if (this.shouldIgnore(entry, this.defaultIgnorePatterns)) {
                    continue;
                }

                const fullPath = path.join(dirPath, entry);
                const stats = fs.statSync(fullPath);

                if (stats.isDirectory()) {
                    const subtree = this.buildDirectoryTree(fullPath, currentDepth + 1, maxDepth);
                    tree.children.push(subtree);
                } else {
                    tree.children.push({
                        name: entry,
                        type: 'file',
                        path: fullPath,
                        size: stats.size
                    });
                }
            }

            return tree;
            
        } catch (error) {
            logger.warn('Error building directory tree', { dirPath, error: error.message });
            return {
                name: path.basename(dirPath),
                type: 'directory',
                error: error.message
            };
        }
    }

    async findImagesByPattern(dirPath, patterns, extensions = []) {
        try {
            const images = await this.scanDirectory(dirPath, extensions);
            const matchingImages = [];

            for (const imagePath of images) {
                const fileName = path.basename(imagePath).toLowerCase();
                const relativePath = path.relative(dirPath, imagePath).toLowerCase();
                
                const matches = patterns.some(pattern => {
                    if (typeof pattern === 'string') {
                        return fileName.includes(pattern.toLowerCase()) || 
                               relativePath.includes(pattern.toLowerCase());
                    } else if (pattern instanceof RegExp) {
                        return pattern.test(fileName) || pattern.test(relativePath);
                    }
                    return false;
                });

                if (matches) {
                    matchingImages.push(imagePath);
                }
            }

            logger.info(`Found ${matchingImages.length} images matching patterns`, { patterns });
            return matchingImages;
            
        } catch (error) {
            logger.error('Error finding images by pattern', { dirPath, patterns, error: error.message });
            return [];
        }
    }

    async getImagesByDensity(androidDir) {
        try {
            const densityDirs = {
                'ldpi': [],
                'mdpi': [],
                'hdpi': [],
                'xhdpi': [],
                'xxhdpi': [],
                'xxxhdpi': [],
                'nodpi': []
            };

            if (!ftools.file.exists(androidDir)) {
                return densityDirs;
            }

            const images = await this.scanDirectory(androidDir, ['.png', '.jpg', '.jpeg', '.webp']);
            
            for (const imagePath of images) {
                const relativePath = path.relative(androidDir, imagePath).toLowerCase();
                
                for (const density of Object.keys(densityDirs)) {
                    if (relativePath.includes(density)) {
                        densityDirs[density].push(imagePath);
                        break;
                    }
                }
            }

            logger.info('Grouped Android images by density', { 
                counts: Object.fromEntries(
                    Object.entries(densityDirs).map(([key, value]) => [key, value.length])
                )
            });
            
            return densityDirs;
            
        } catch (error) {
            logger.error('Error grouping images by density', { androidDir, error: error.message });
            return {};
        }
    }

    async getIosImagesByScale(iosDir) {
        try {
            const scaleGroups = {
                '1x': [],
                '2x': [],
                '3x': []
            };

            if (!ftools.file.exists(iosDir)) {
                return scaleGroups;
            }

            const images = await this.scanDirectory(iosDir, ['.png', '.jpg', '.jpeg']);
            
            for (const imagePath of images) {
                const fileName = path.basename(imagePath);
                
                if (fileName.includes('@3x')) {
                    scaleGroups['3x'].push(imagePath);
                } else if (fileName.includes('@2x')) {
                    scaleGroups['2x'].push(imagePath);
                } else {
                    scaleGroups['1x'].push(imagePath);
                }
            }

            logger.info('Grouped iOS images by scale', { 
                counts: Object.fromEntries(
                    Object.entries(scaleGroups).map(([key, value]) => [key, value.length])
                )
            });
            
            return scaleGroups;
            
        } catch (error) {
            logger.error('Error grouping iOS images by scale', { iosDir, error: error.message });
            return {};
        }
    }

    async findDuplicateImageNames(dirPath, extensions = []) {
        try {
            const images = await this.scanDirectory(dirPath, extensions);
            const nameGroups = {};
            
            for (const imagePath of images) {
                const fileName = path.basename(imagePath).toLowerCase();
                
                if (!nameGroups[fileName]) {
                    nameGroups[fileName] = [];
                }
                nameGroups[fileName].push(imagePath);
            }

            const duplicates = Object.entries(nameGroups)
                .filter(([name, paths]) => paths.length > 1)
                .reduce((acc, [name, paths]) => {
                    acc[name] = paths;
                    return acc;
                }, {});

            logger.info(`Found ${Object.keys(duplicates).length} duplicate image names`);
            return duplicates;
            
        } catch (error) {
            logger.error('Error finding duplicate image names', { dirPath, error: error.message });
            return {};
        }
    }
}

module.exports = DirectoryScanner;