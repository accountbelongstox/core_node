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

const path = require('path');
const logger = require('#@logger');
const { freader, fwriter } = require('#@btools');
const { fdir } = require('#@ncore/foundation/utilities/filetoollibs/index.js');
const { DATA_DIR } = require('#@global_dir');

class TranslationManager {
    constructor(databaseDir, tempDir) {
        this.databaseDir = databaseDir;
        this.tempDir = tempDir;
        this.translationOutputDir = path.join(databaseDir, 'translations');
        this.backupDir = path.join(databaseDir, 'backups');
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) {
            logger.warn('[Translation Manager] Already initialized');
            return;
        }

        try {
            logger.info('[Translation Manager] Initializing translation manager...');

            // Ensure all directories exist
            fdir.mkdirSync(this.databaseDir);
            fdir.mkdirSync(this.tempDir);
            fdir.mkdirSync(this.translationOutputDir);
            fdir.mkdirSync(this.backupDir);

            this.isInitialized = true;
            logger.info('[Translation Manager] Translation manager initialized');

        } catch (error) {
            logger.error(`[Translation Manager] Initialization failed: ${error.message}`);
            throw error;
        }
    }

    async readFile(filePath) {
        try {
            if (!freader.isFile(filePath)) {
                logger.warn(`[Translation Manager] File does not exist: ${filePath}`);
                return null;
            }

            const content = freader.readText(filePath);
            if (!content) {
                logger.warn(`[Translation Manager] File is empty: ${filePath}`);
                return null;
            }

            logger.debug(`[Translation Manager] Read file: ${filePath} (${content.length} chars)`);
            return content;

        } catch (error) {
            logger.error(`[Translation Manager] Error reading file ${filePath}: ${error.message}`);
            return null;
        }
    }

    async saveTranslationResult(sourceFilePath, translatedParagraphs, fileRecordId) {
        try {
            const relativePath = this.getRelativeOutputPath(sourceFilePath);
            const outputPath = path.join(this.translationOutputDir, relativePath);
            
            // Ensure output directory exists
            const outputDir = path.dirname(outputPath);
            await fwriter.ensureDir(outputDir);

            // Combine paragraphs into full translated content
            const translatedContent = translatedParagraphs
                .map(paragraph => paragraph.translated_text || paragraph)
                .join('\n\n');

            // Add metadata header
            const metadata = this.generateMetadata(sourceFilePath, fileRecordId);
            const finalContent = metadata + '\n\n' + translatedContent;

            // Write translation result
            fwriter.writeText(outputPath, finalContent);

            logger.info(`[Translation Manager] Saved translation result: ${outputPath}`);
            return outputPath;

        } catch (error) {
            logger.error(`[Translation Manager] Error saving translation result: ${error.message}`);
            throw error;
        }
    }

    async backupTranslation(sourceFilePath, fileRecordId) {
        try {
            const relativePath = this.getRelativeOutputPath(sourceFilePath);
            const currentOutputPath = path.join(this.translationOutputDir, relativePath);
            
            if (!freader.isFile(currentOutputPath)) {
                logger.debug(`[Translation Manager] No existing translation to backup: ${currentOutputPath}`);
                return null;
            }

            // Create backup filename with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFileName = `${path.basename(relativePath, path.extname(relativePath))}_backup_${timestamp}${path.extname(relativePath)}`;
            const backupPath = path.join(this.backupDir, path.dirname(relativePath), backupFileName);

            // Ensure backup directory exists
            const backupDirPath = path.dirname(backupPath);
            await fwriter.ensureDir(backupDirPath);

            // Copy current translation to backup
            const currentContent = freader.readText(currentOutputPath);
            fwriter.writeText(backupPath, currentContent);

            logger.info(`[Translation Manager] Created backup: ${backupPath}`);
            return backupPath;

        } catch (error) {
            logger.error(`[Translation Manager] Error creating backup: ${error.message}`);
            return null;
        }
    }

    getRelativeOutputPath(sourceFilePath) {
        // Create a relative path structure for organized output
        const pathParts = sourceFilePath.split(path.sep);
        const fileName = pathParts[pathParts.length - 1];
        const baseName = path.basename(fileName, path.extname(fileName));
        const ext = path.extname(fileName);
        
        // Add translated suffix
        const translatedFileName = `${baseName}_translated${ext}`;
        
        // Create directory structure based on source path
        if (pathParts.length > 1) {
            const dirStructure = pathParts.slice(-3, -1).join(path.sep); // Last 2 directories
            return path.join(dirStructure, translatedFileName);
        }
        
        return translatedFileName;
    }

    generateMetadata(sourceFilePath, fileRecordId) {
        const timestamp = new Date().toISOString();
        
        return `<!-- Translation Metadata
Source File: ${sourceFilePath}
Record ID: ${fileRecordId}
Translated At: ${timestamp}
Generated By: AI Translator Utility
-->`;
    }

    async getTranslationHistory(sourceFilePath) {
        try {
            const relativePath = this.getRelativeOutputPath(sourceFilePath);
            const backupPattern = path.join(
                this.backupDir,
                path.dirname(relativePath),
                `${path.basename(relativePath, path.extname(relativePath))}_backup_*${path.extname(relativePath)}`
            );

            const backupFiles = fdir.glob(backupPattern);
            
            const history = [];
            for (const backupFile of backupFiles) {
                const stats = freader.getFileStats(backupFile);
                if (stats) {
                    history.push({
                        filePath: backupFile,
                        timestamp: stats.mtime,
                        size: stats.size
                    });
                }
            }

            // Sort by timestamp (newest first)
            history.sort((a, b) => b.timestamp - a.timestamp);
            
            return history;

        } catch (error) {
            logger.error(`[Translation Manager] Error getting translation history: ${error.message}`);
            return [];
        }
    }

    async cleanupOldBackups(daysToKeep = 30) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

            const allBackups = fdir.scanDirectoryDeep(this.backupDir, {
                onlyFiles: true
            });

            let deletedCount = 0;
            for (const backupFile of allBackups) {
                const stats = freader.getFileStats(backupFile);
                if (stats && stats.mtime < cutoffDate) {
                    try {
                        fwriter.deleteFile(backupFile);
                        deletedCount++;
                    } catch (error) {
                        logger.warn(`[Translation Manager] Could not delete old backup: ${backupFile}`);
                    }
                }
            }

            logger.info(`[Translation Manager] Cleaned up ${deletedCount} old backup files`);
            return deletedCount;

        } catch (error) {
            logger.error(`[Translation Manager] Error cleaning up old backups: ${error.message}`);
            return 0;
        }
    }

    async getTranslationStatus(sourceFilePath) {
        try {
            const relativePath = this.getRelativeOutputPath(sourceFilePath);
            const outputPath = path.join(this.translationOutputDir, relativePath);

            if (!freader.isFile(outputPath)) {
                return {
                    exists: false,
                    outputPath: null,
                    lastModified: null,
                    size: 0
                };
            }

            const stats = freader.getFileStats(outputPath);
            return {
                exists: true,
                outputPath: outputPath,
                lastModified: stats.mtime,
                size: stats.size
            };

        } catch (error) {
            logger.error(`[Translation Manager] Error getting translation status: ${error.message}`);
            return {
                exists: false,
                outputPath: null,
                lastModified: null,
                size: 0,
                error: error.message
            };
        }
    }

    async exportTranslations(exportFormat = 'markdown') {
        try {
            const exportDir = path.join(this.databaseDir, 'exports');
            await fwriter.ensureDir(exportDir);

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const exportFile = path.join(exportDir, `translations_export_${timestamp}.${exportFormat}`);

            const allTranslations = fdir.scanDirectoryDeep(this.translationOutputDir, {
                onlyFiles: true
            });

            let exportContent = this.generateExportHeader(exportFormat);

            for (const translationFile of allTranslations) {
                const content = freader.readText(translationFile);
                const relativePath = path.relative(this.translationOutputDir, translationFile);
                
                exportContent += this.formatTranslationForExport(
                    relativePath,
                    content,
                    exportFormat
                );
            }

            fwriter.writeText(exportFile, exportContent);

            logger.info(`[Translation Manager] Exported translations to: ${exportFile}`);
            return exportFile;

        } catch (error) {
            logger.error(`[Translation Manager] Error exporting translations: ${error.message}`);
            throw error;
        }
    }

    generateExportHeader(format) {
        const timestamp = new Date().toISOString();
        
        if (format === 'markdown') {
            return `# Translation Export\n\nGenerated: ${timestamp}\n\n---\n\n`;
        } else if (format === 'html') {
            return `<!DOCTYPE html>
<html>
<head>
    <title>Translation Export</title>
    <meta charset="utf-8">
</head>
<body>
    <h1>Translation Export</h1>
    <p>Generated: ${timestamp}</p>
    <hr>
`;
        }
        
        return `Translation Export - Generated: ${timestamp}\n\n`;
    }

    formatTranslationForExport(relativePath, content, format) {
        if (format === 'markdown') {
            return `## ${relativePath}\n\n${content}\n\n---\n\n`;
        } else if (format === 'html') {
            return `<h2>${relativePath}</h2>\n<div>${content.replace(/\n/g, '<br>')}</div>\n<hr>\n`;
        }
        
        return `=== ${relativePath} ===\n${content}\n\n`;
    }

    async getManagerStats() {
        try {
            const translationFiles = fdir.scanDirectoryDeep(this.translationOutputDir, {
                onlyFiles: true
            });

            const backupFiles = fdir.scanDirectoryDeep(this.backupDir, {
                onlyFiles: true
            });

            let totalSize = 0;
            for (const file of translationFiles) {
                const stats = freader.getFileStats(file);
                if (stats) {
                    totalSize += stats.size;
                }
            }

            return {
                translationCount: translationFiles.length,
                backupCount: backupFiles.length,
                totalSize: totalSize,
                databaseDir: this.databaseDir,
                tempDir: this.tempDir
            };

        } catch (error) {
            logger.error(`[Translation Manager] Error getting manager stats: ${error.message}`);
            return {
                translationCount: 0,
                backupCount: 0,
                totalSize: 0,
                databaseDir: this.databaseDir,
                tempDir: this.tempDir,
                error: error.message
            };
        }
    }
}

module.exports = TranslationManager;