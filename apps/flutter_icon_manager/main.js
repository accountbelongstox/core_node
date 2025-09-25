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

const FlutterIconManager = require('#@ncore/utils/flutter_icon_tool/index.js');
const logger = require('#@logger');
const globalVars = require('#@global_vars');
const config = require('./config/index.js');

class FlutterIconManagerApp {
    constructor() {
        this.flutterIconManager = new FlutterIconManager();
        this.config = config;
    }

    async start() {
        try {
            logger.info('Starting Flutter Icon Manager App', { action: this.config.action });

            const flutterPath = this.config.flutter.projectPath;
            const targetDirs = this.config.scanning.targetDirs;
            const selectedApps = this.config.flutter.selectedApps;
            const action = this.config.action;

            switch (action) {
                case 'scan':
                    return await this.scanProject(flutterPath, targetDirs, selectedApps);
                
                case 'replace':
                    return await this.replaceImage(
                        this.config.processing.sourcePath, 
                        this.config.processing.targetPath, 
                        { autoResize: this.config.output.autoResize }
                    );
                
                case 'batch-replace':
                    return await this.batchReplace(
                        this.config.processing.sourcePath, 
                        this.config.processing.targetPaths, 
                        { autoResize: this.config.output.autoResize }
                    );
                
                case 'compress':
                    return await this.compressImage(
                        this.config.processing.targetPath, 
                        { 
                            quality: this.config.processing.quality, 
                            format: this.config.processing.format 
                        }
                    );
                
                case 'resize':
                    return await this.resizeImage(
                        this.config.processing.sourcePath, 
                        this.config.processing.targetPath, 
                        this.config.processing.width, 
                        this.config.processing.height
                    );
                
                case 'export-report':
                    await this.scanProject(flutterPath, targetDirs, selectedApps);
                    return await this.exportReport(this.config.output.reportPath);
                
                case 'copy-to-platforms':
                    await this.scanProject(flutterPath, targetDirs, selectedApps);
                    return await this.copyToTargetPlatforms(
                        this.config.processing.sourcePath, 
                        this.config.processing.platforms, 
                        this.config.processing.targetName
                    );
                
                case 'analyze':
                    await this.scanProject(flutterPath, targetDirs, selectedApps);
                    return await this.analyzeProject();
                
                default:
                    throw new Error(`Unknown action: ${action}`);
            }
            
        } catch (error) {
            logger.error('Error in Flutter Icon Manager App', { error: error.message, stack: error.stack });
            throw error;
        }
    }

    async scanProject(flutterPath, targetDirs = [], selectedApps = []) {
        try {
            logger.info('Scanning Flutter project for images', { flutterPath, targetDirs, selectedApps });
            
            const scanResults = await this.flutterIconManager.scanFlutterProject(
                flutterPath, 
                targetDirs, 
                selectedApps
            );

            this.printScanSummary(scanResults);
            return scanResults;
            
        } catch (error) {
            logger.error('Error scanning project', { error: error.message });
            throw error;
        }
    }

    async replaceImage(sourcePath, targetPath, options = {}) {
        try {
            logger.info('Replacing image', { sourcePath, targetPath, options });
            
            const success = await this.flutterIconManager.replaceImage(sourcePath, targetPath, options);
            
            if (success) {
                logger.info('Image replaced successfully');
                return { success: true, message: 'Image replaced successfully' };
            } else {
                return { success: false, message: 'Failed to replace image' };
            }
            
        } catch (error) {
            logger.error('Error replacing image', { error: error.message });
            return { success: false, message: error.message };
        }
    }

    async batchReplace(sourcePath, targetPaths, options = {}) {
        try {
            logger.info('Starting batch replace', { sourcePath, targetCount: targetPaths.length });
            
            const results = await this.flutterIconManager.batchReplaceImages(sourcePath, targetPaths, options);
            
            logger.info('Batch replace completed', results);
            return results;
            
        } catch (error) {
            logger.error('Error in batch replace', { error: error.message });
            return { successful: 0, failed: targetPaths.length, error: error.message };
        }
    }

    async compressImage(imagePath, options = {}) {
        try {
            logger.info('Compressing image', { imagePath, options });
            
            const success = await this.flutterIconManager.compressImage(imagePath, options);
            
            if (success) {
                return { success: true, message: 'Image compressed successfully' };
            } else {
                return { success: false, message: 'Image compression not needed or failed' };
            }
            
        } catch (error) {
            logger.error('Error compressing image', { error: error.message });
            return { success: false, message: error.message };
        }
    }

    async resizeImage(sourcePath, targetPath, width, height, options = {}) {
        try {
            logger.info('Resizing image', { sourcePath, targetPath, width, height });
            
            const success = await this.flutterIconManager.imageProcessor.resizeImage(
                sourcePath, 
                targetPath, 
                width, 
                height, 
                options
            );
            
            if (success) {
                return { success: true, message: `Image resized to ${width}x${height}` };
            } else {
                return { success: false, message: 'Failed to resize image' };
            }
            
        } catch (error) {
            logger.error('Error resizing image', { error: error.message });
            return { success: false, message: error.message };
        }
    }

    async exportReport(outputPath) {
        try {
            logger.info('Exporting scan report', { outputPath });
            
            const report = await this.flutterIconManager.exportReport(outputPath);
            
            logger.info('Report exported successfully', { outputPath, totalImages: report.summary.totalImages });
            return { success: true, reportPath: outputPath, summary: report.summary };
            
        } catch (error) {
            logger.error('Error exporting report', { error: error.message });
            return { success: false, message: error.message };
        }
    }

    async copyToTargetPlatforms(sourcePath, platforms, targetName) {
        try {
            logger.info('Copying image to target platforms', { sourcePath, platforms, targetName });
            
            const results = await this.flutterIconManager.copyImageToTargets(sourcePath, platforms, targetName);
            
            logger.info('Copy to platforms completed', results);
            return results;
            
        } catch (error) {
            logger.error('Error copying to platforms', { error: error.message });
            return { successful: 0, failed: 0, error: error.message };
        }
    }

    async analyzeProject() {
        try {
            logger.info('Analyzing Flutter project');
            
            const analysis = {
                timestamp: new Date().toISOString(),
                categories: {},
                compression: {},
                compliance: {},
                recommendations: []
            };

            analysis.categories.icons = this.flutterIconManager.getImagesByCategory('Small Icon');
            analysis.categories.largeIcons = this.flutterIconManager.getImagesByCategory('Large Icon');
            analysis.categories.backgrounds = this.flutterIconManager.getImagesByCategory('Background');
            
            analysis.compression.needCompression = this.flutterIconManager.getImagesNeedingCompression();
            analysis.compliance.lowCompliance = this.flutterIconManager.getImagesWithLowCompliance(0.8);

            const totalCompression = Object.values(analysis.compression.needCompression)
                .reduce((sum, images) => sum + images.length, 0);
            const totalLowCompliance = Object.values(analysis.compliance.lowCompliance)
                .reduce((sum, images) => sum + images.length, 0);

            if (totalCompression > 0) {
                analysis.recommendations.push(
                    `${totalCompression} images need compression to reduce file size`
                );
            }

            if (totalLowCompliance > 0) {
                analysis.recommendations.push(
                    `${totalLowCompliance} images have low compliance scores and may need resizing`
                );
            }

            this.printAnalysisSummary(analysis);
            return analysis;
            
        } catch (error) {
            logger.error('Error analyzing project', { error: error.message });
            return { error: error.message };
        }
    }

    printScanSummary(scanResults) {
        console.log('\n=== Flutter Icon Scan Results ===');
        console.log(`Project Path: ${scanResults.projectPath}`);
        console.log(`Total Images Found: ${scanResults.totalImages}`);
        console.log(`Scan Time: ${scanResults.scanTime}`);
        
        console.log('\nPlatform Breakdown:');
        for (const [platform, data] of Object.entries(scanResults.platforms)) {
            console.log(`  ${platform}: ${data.imageCount} images`);
        }
        
        if (scanResults.totalImages === 0) {
            console.log('\nNo images found in the specified directories.');
            console.log('Make sure the Flutter project path is correct and contains platform directories.');
        }
        
    }

    printAnalysisSummary(analysis) {
        console.log('\n=== Flutter Project Analysis ===');
        console.log(`Analysis Time: ${analysis.timestamp}`);
        
        console.log('\nImage Categories:');
        const totalIcons = Object.values(analysis.categories.icons || {})
            .reduce((sum, images) => sum + images.length, 0);
        const totalLargeIcons = Object.values(analysis.categories.largeIcons || {})
            .reduce((sum, images) => sum + images.length, 0);
        const totalBackgrounds = Object.values(analysis.categories.backgrounds || {})
            .reduce((sum, images) => sum + images.length, 0);
            
        console.log(`  Small Icons: ${totalIcons}`);
        console.log(`  Large Icons: ${totalLargeIcons}`);
        console.log(`  Backgrounds: ${totalBackgrounds}`);
        
        const totalCompression = Object.values(analysis.compression.needCompression || {})
            .reduce((sum, images) => sum + images.length, 0);
        const totalLowCompliance = Object.values(analysis.compliance.lowCompliance || {})
            .reduce((sum, images) => sum + images.length, 0);
            
        console.log(`\nOptimization Opportunities:`);
        console.log(`  Images needing compression: ${totalCompression}`);
        console.log(`  Images with low compliance: ${totalLowCompliance}`);
        
        if (analysis.recommendations.length > 0) {
            console.log('\nRecommendations:');
            analysis.recommendations.forEach((rec, index) => {
                console.log(`  ${index + 1}. ${rec}`);
            });
        }
        
    }

}

async function start() {
    try {
        const app = new FlutterIconManagerApp();
        const result = await app.start();
        
        logger.info('Flutter Icon Manager App completed successfully');
        return result;
        
    } catch (error) {
        logger.error('Flutter Icon Manager App failed', { error: error.message });
        console.error(`Error: ${error.message}`);
        
        console.error('\nAll settings are configured in config/index.js');
        console.error('Please verify the Flutter project path and configuration settings.');
        
        process.exit(1);
    }
}

module.exports = { start };