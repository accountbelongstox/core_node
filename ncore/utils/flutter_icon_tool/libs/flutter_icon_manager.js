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
const freader = require('#@freader');
const fwriter = require('#@fwriter');
const globalVars = require('#@global_vars');
const btools = require('#@btools');

const ImageAnalyzer = require('./image_analyzer');
const DirectoryScanner = require('./directory_scanner');
const ImageProcessor = require('./image_processor');

class FlutterIconManager {
    constructor() {
        this.imageAnalyzer = new ImageAnalyzer();
        this.directoryScanner = new DirectoryScanner();
        this.imageProcessor = new ImageProcessor();
        
        this.platformDirs = ['android', 'ios', 'windows', 'web'];
        this.imageExtensions = ['.png', '.jpg', '.jpeg', '.ico', '.icns', '.gif', '.webp', '.svg'];
        
        this.scannedImages = {};
        this.imageAnalysisCache = {};
    }

    async scanFlutterProject(flutterPath, targetDirs = [], selectedApps = []) {
        try {
            logger.info('Starting Flutter project scan', { flutterPath, targetDirs, selectedApps });
            
            const projectPath = path.resolve(flutterPath);
            
            if (!ftools.file.exists(projectPath)) {
                logger.error('Flutter project path does not exist', { projectPath });
                throw new Error(`Flutter project path does not exist: ${projectPath}`);
            }

            this.scannedImages = {};
            const results = {
                projectPath,
                platforms: {},
                totalImages: 0,
                scanTime: new Date().toISOString()
            };

            const scanPlatforms = targetDirs.length > 0 ? targetDirs : this.platformDirs;
            
            for (const platform of scanPlatforms) {
                const platformPath = path.join(projectPath, platform);
                
                if (ftools.file.exists(platformPath)) {
                    logger.info(`Scanning platform: ${platform}`, { platformPath });
                    
                    const platformImages = await this.directoryScanner.scanDirectory(
                        platformPath, 
                        this.imageExtensions
                    );
                    
                    const processedImages = [];
                    for (const imagePath of platformImages) {
                        const imageInfo = await this.getImageInfo(imagePath);
                        if (imageInfo) {
                            processedImages.push(imageInfo);
                        }
                    }
                    
                    this.scannedImages[platform] = processedImages;
                    results.platforms[platform] = {
                        path: platformPath,
                        imageCount: processedImages.length,
                        images: processedImages
                    };
                    
                    results.totalImages += processedImages.length;
                    logger.info(`Found ${processedImages.length} images in ${platform}`);
                } else {
                    logger.warn(`Platform directory not found: ${platformPath}`);
                }
            }

            logger.info('Flutter project scan completed', { 
                totalImages: results.totalImages,
                platforms: Object.keys(results.platforms)
            });
            
            return results;
            
        } catch (error) {
            logger.error('Error scanning Flutter project', { error: error.message, stack: error.stack });
            throw error;
        }
    }

    async getImageInfo(imagePath) {
        try {
            const absolutePath = path.resolve(imagePath);
            
            if (!ftools.file.exists(absolutePath)) {
                return null;
            }

            const stats = fs.statSync(absolutePath);
            const imageInfo = {
                path: absolutePath,
                name: path.basename(absolutePath),
                relativePath: imagePath,
                sizeBytes: stats.size,
                modified: stats.mtime,
                width: null,
                height: null,
                format: path.extname(absolutePath).toUpperCase().replace('.', '')
            };

            const dimensions = await this.imageProcessor.getImageDimensions(absolutePath);
            if (dimensions) {
                imageInfo.width = dimensions.width;
                imageInfo.height = dimensions.height;
            }

            const cacheKey = absolutePath;
            if (!this.imageAnalysisCache[cacheKey]) {
                const classification = this.imageAnalyzer.classifyImage(
                    absolutePath, 
                    imageInfo.width, 
                    imageInfo.height
                );
                
                const sizeRecommendations = imageInfo.width && imageInfo.height 
                    ? this.imageAnalyzer.getSizeRecommendations(
                        absolutePath, 
                        imageInfo.width, 
                        imageInfo.height
                    )
                    : null;
                
                const compressionRecommendations = this.imageAnalyzer.getCompressionRecommendations(
                    absolutePath,
                    imageInfo.sizeBytes,
                    imageInfo.width,
                    imageInfo.height
                );

                this.imageAnalysisCache[cacheKey] = {
                    classification,
                    sizeRecommendations,
                    compressionRecommendations
                };
            }

            const analysis = this.imageAnalysisCache[cacheKey];
            Object.assign(imageInfo, analysis);

            return imageInfo;
            
        } catch (error) {
            logger.error(`Error getting image info for ${imagePath}`, { error: error.message });
            return null;
        }
    }

    async replaceImage(sourcePath, targetPath, options = {}) {
        try {
            const absoluteSourcePath = path.resolve(sourcePath);
            const absoluteTargetPath = path.resolve(targetPath);
            
            if (!ftools.file.exists(absoluteSourcePath)) {
                throw new Error(`Source image does not exist: ${absoluteSourcePath}`);
            }
            
            if (!ftools.file.exists(absoluteTargetPath)) {
                throw new Error(`Target image does not exist: ${absoluteTargetPath}`);
            }

            const backupPath = await this.createBackup(absoluteTargetPath);
            logger.info(`Created backup at: ${backupPath}`);

            if (options.autoResize) {
                const targetInfo = await this.getImageInfo(absoluteTargetPath);
                if (targetInfo && targetInfo.width && targetInfo.height) {
                    await this.imageProcessor.resizeAndCropImage(
                        absoluteSourcePath,
                        absoluteTargetPath,
                        targetInfo.width,
                        targetInfo.height
                    );
                    logger.info(`Resized and replaced image: ${absoluteTargetPath}`);
                    return true;
                }
            }

            await ftools.fcopy.Copy(absoluteSourcePath, absoluteTargetPath);
            logger.info(`Replaced image: ${absoluteTargetPath}`);
            return true;
            
        } catch (error) {
            logger.error('Error replacing image', { 
                sourcePath, 
                targetPath, 
                error: error.message 
            });
            return false;
        }
    }

    async batchReplaceImages(sourcePath, targetPaths, options = {}) {
        try {
            const results = {
                successful: 0,
                failed: 0,
                details: []
            };

            for (const targetPath of targetPaths) {
                const success = await this.replaceImage(sourcePath, targetPath, options);
                if (success) {
                    results.successful++;
                    results.details.push({ target: targetPath, status: 'success' });
                } else {
                    results.failed++;
                    results.details.push({ target: targetPath, status: 'failed' });
                }
            }

            logger.info('Batch replace completed', results);
            return results;
            
        } catch (error) {
            logger.error('Error in batch replace', { error: error.message });
            throw error;
        }
    }

    async compressImage(imagePath, options = {}) {
        try {
            const absolutePath = path.resolve(imagePath);
            const imageInfo = await this.getImageInfo(absolutePath);
            
            if (!imageInfo || !imageInfo.compressionRecommendations?.shouldCompress) {
                logger.info('Image compression not recommended', { imagePath });
                return false;
            }

            const backupPath = await this.createBackup(absolutePath);
            logger.info(`Created backup at: ${backupPath}`);

            const compressionOptions = {
                quality: imageInfo.compressionRecommendations.qualityRecommendation || 85,
                format: imageInfo.compressionRecommendations.formatRecommendation,
                ...options
            };

            await this.imageProcessor.compressImage(absolutePath, compressionOptions);
            logger.info(`Compressed image: ${absolutePath}`);
            return true;
            
        } catch (error) {
            logger.error('Error compressing image', { imagePath, error: error.message });
            return false;
        }
    }

    async createBackup(filePath) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupDir = path.join(globalVars.CACHE_DIR, 'flutter_icon_backups');
            
            if (!ftools.file.exists(backupDir)) {
                ftools.fdir.mkdirSync(backupDir);
            }

            const fileName = path.basename(filePath);
            const backupName = `${fileName}_${timestamp}.bak`;
            const backupPath = path.join(backupDir, backupName);

            await ftools.fcopy.Copy(filePath, backupPath);
            return backupPath;
            
        } catch (error) {
            logger.error('Error creating backup', { filePath, error: error.message });
            throw error;
        }
    }

    async exportReport(outputPath) {
        try {
            const report = {
                scanTime: new Date().toISOString(),
                platforms: {},
                summary: {
                    totalImages: 0,
                    platforms: Object.keys(this.scannedImages)
                }
            };

            for (const [platform, images] of Object.entries(this.scannedImages)) {
                report.platforms[platform] = {
                    imageCount: images.length,
                    images: images.map(img => ({
                        ...img,
                        path: img.path,
                        modified: img.modified.toISOString()
                    }))
                };
                report.summary.totalImages += images.length;
            }

            await fwriter.writeAsync(outputPath, JSON.stringify(report, null, 2));
            logger.info(`Report exported to: ${outputPath}`);
            return report;
            
        } catch (error) {
            logger.error('Error exporting report', { outputPath, error: error.message });
            throw error;
        }
    }

    async copyImageToTargets(sourcePath, targetPlatforms, targetName) {
        try {
            const results = {
                successful: 0,
                failed: 0,
                details: []
            };

            for (const platform of targetPlatforms) {
                if (!this.scannedImages[platform]) {
                    continue;
                }

                const platformImages = this.scannedImages[platform];
                const matchingImages = platformImages.filter(img => 
                    path.basename(img.path).toLowerCase().includes(targetName.toLowerCase())
                );

                for (const targetImage of matchingImages) {
                    const success = await this.replaceImage(sourcePath, targetImage.path, {
                        autoResize: true
                    });
                    
                    if (success) {
                        results.successful++;
                        results.details.push({ 
                            target: targetImage.path, 
                            platform, 
                            status: 'success' 
                        });
                    } else {
                        results.failed++;
                        results.details.push({ 
                            target: targetImage.path, 
                            platform, 
                            status: 'failed' 
                        });
                    }
                }
            }

            logger.info('Copy to targets completed', results);
            return results;
            
        } catch (error) {
            logger.error('Error copying image to targets', { error: error.message });
            throw error;
        }
    }

    getImagesByCategory(category) {
        const result = {};
        
        for (const [platform, images] of Object.entries(this.scannedImages)) {
            const filteredImages = images.filter(img => 
                img.classification && img.classification.category === category
            );
            
            if (filteredImages.length > 0) {
                result[platform] = filteredImages;
            }
        }

        return result;
    }

    getImagesNeedingCompression() {
        const result = {};
        
        for (const [platform, images] of Object.entries(this.scannedImages)) {
            const needCompression = images.filter(img => 
                img.compressionRecommendations && img.compressionRecommendations.shouldCompress
            );
            
            if (needCompression.length > 0) {
                result[platform] = needCompression;
            }
        }

        return result;
    }

    getImagesWithLowCompliance(threshold = 0.8) {
        const result = {};
        
        for (const [platform, images] of Object.entries(this.scannedImages)) {
            const lowCompliance = images.filter(img => 
                img.sizeRecommendations && 
                img.sizeRecommendations.complianceScore < threshold
            );
            
            if (lowCompliance.length > 0) {
                result[platform] = lowCompliance;
            }
        }

        return result;
    }
}

module.exports = FlutterIconManager;