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
const crypto = require('crypto');
const logger = require('#@logger');
const { freader, fwriter } = require('#@btools');
const { fdir } = require('#@ncore/foundation/utilities/filetoollibs/index.js');
const dbTools = require('#@ncore/foundation/db_utils/main.js');

class CacheManager {
    constructor(databaseDir) {
        this.databaseDir = databaseDir;
        this.dbPath = path.join(databaseDir, 'translation_cache.db');
        this.sequelize = null;
        this.models = {};
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) {
            logger.warn('[Cache Manager] Already initialized');
            return;
        }

        try {
            logger.info('[Cache Manager] Initializing database...');

            // Ensure database directory exists
            fdir.mkdirSync(this.databaseDir);

            // Initialize Sequelize connection
            const dbName = 'translation_cache';
            this.sequelize = await dbTools.obtainInstantiationSequelize(this.dbPath, dbName, false, 'sqlite');

            // Define models
            await this.defineModels();

            // Sync database
            await this.sequelize.sync();

            this.isInitialized = true;
            logger.info('[Cache Manager] Database initialized successfully');

        } catch (error) {
            logger.error(`[Cache Manager] Initialization failed: ${error.message}`);
            throw error;
        }
    }

    async defineModels() {
        // File records table
        this.models.FileRecord = await dbTools.defineSequelizeModelByDefinition(this.sequelize, 'file_records', {
            id: {
                type: 'INTEGER',
                primaryKey: true,
                autoIncrement: true
            },
            file_path: {
                type: 'TEXT',
                allowNull: false,
                unique: true
            },
            source_hash: {
                type: 'TEXT',
                allowNull: false
            },
            target_language: {
                type: 'TEXT',
                allowNull: false
            },
            status: {
                type: 'TEXT',
                defaultValue: 'processing'
            },
            created_at: {
                type: 'DATE',
                defaultValue: new Date()
            },
            updated_at: {
                type: 'DATE',
                defaultValue: new Date()
            }
        });

        // Paragraph records table
        this.models.ParagraphRecord = await dbTools.defineSequelizeModelByDefinition(this.sequelize, 'paragraph_records', {
            id: {
                type: 'INTEGER',
                primaryKey: true,
                autoIncrement: true
            },
            file_record_id: {
                type: 'INTEGER',
                allowNull: false
            },
            paragraph_index: {
                type: 'INTEGER',
                allowNull: false
            },
            paragraph_hash: {
                type: 'TEXT',
                allowNull: false
            },
            source_text: {
                type: 'TEXT',
                allowNull: false
            },
            translated_text: {
                type: 'TEXT',
                allowNull: false
            },
            created_at: {
                type: 'DATE',
                defaultValue: new Date()
            }
        });

        // Translation cache table
        this.models.TranslationCache = await dbTools.defineSequelizeModelByDefinition(this.sequelize, 'translation_cache', {
            id: {
                type: 'INTEGER',
                primaryKey: true,
                autoIncrement: true
            },
            content_hash: {
                type: 'TEXT',
                allowNull: false
            },
            source_text: {
                type: 'TEXT',
                allowNull: false
            },
            translated_text: {
                type: 'TEXT',
                allowNull: false
            },
            source_language: {
                type: 'TEXT',
                allowNull: false
            },
            target_language: {
                type: 'TEXT',
                allowNull: false
            },
            created_at: {
                type: 'DATE',
                defaultValue: new Date()
            },
            usage_count: {
                type: 'INTEGER',
                defaultValue: 1
            }
        });

        // Progress tracking table
        this.models.ProgressTracker = await dbTools.defineSequelizeModelByDefinition(this.sequelize, 'progress_tracker', {
            id: {
                type: 'INTEGER',
                primaryKey: true,
                autoIncrement: true
            },
            file_record_id: {
                type: 'INTEGER',
                allowNull: false
            },
            total_paragraphs: {
                type: 'INTEGER',
                allowNull: false
            },
            completed_paragraphs: {
                type: 'INTEGER',
                defaultValue: 0
            },
            current_paragraph: {
                type: 'INTEGER',
                defaultValue: 0
            },
            status: {
                type: 'TEXT',
                defaultValue: 'in_progress'
            },
            updated_at: {
                type: 'DATE',
                defaultValue: new Date()
            }
        });
    }

    generateHash(content) {
        return crypto.createHash('md5').update(content, 'utf8').digest('hex');
    }

    async getFileHash(filePath) {
        try {
            const content = freader.readText(filePath);
            return this.generateHash(content);
        } catch (error) {
            logger.error(`[Cache Manager] Error reading file for hash: ${error.message}`);
            return null;
        }
    }

    async createFileRecord(filePath, sourceHash, targetLanguage) {
        try {
            const record = await dbTools.dbInsertSingle(this.models.FileRecord, {
                file_path: filePath,
                source_hash: sourceHash,
                target_language: targetLanguage,
                status: 'processing',
                created_at: new Date(),
                updated_at: new Date()
            });

            logger.debug(`[Cache Manager] Created file record: ${filePath}`);
            return record;

        } catch (error) {
            logger.error(`[Cache Manager] Error creating file record: ${error.message}`);
            throw error;
        }
    }

    async getFileRecord(filePath) {
        try {
            const records = await dbTools.dbQuery(this.models.FileRecord, {
                where: { file_path: filePath }
            });

            return records.length > 0 ? records[0] : null;

        } catch (error) {
            logger.error(`[Cache Manager] Error getting file record: ${error.message}`);
            return null;
        }
    }

    async updateFileRecord(recordId, newSourceHash) {
        try {
            await dbTools.dbUpdate(this.models.FileRecord, {
                source_hash: newSourceHash,
                updated_at: new Date()
            }, {
                where: { id: recordId }
            });

            logger.debug(`[Cache Manager] Updated file record: ${recordId}`);

        } catch (error) {
            logger.error(`[Cache Manager] Error updating file record: ${error.message}`);
            throw error;
        }
    }

    async markFileComplete(recordId) {
        try {
            await dbTools.dbUpdate(this.models.FileRecord, {
                status: 'completed',
                updated_at: new Date()
            }, {
                where: { id: recordId }
            });

            logger.debug(`[Cache Manager] Marked file complete: ${recordId}`);

        } catch (error) {
            logger.error(`[Cache Manager] Error marking file complete: ${error.message}`);
            throw error;
        }
    }

    async saveParagraphRecord(fileRecordId, paragraphIndex, paragraphHash, sourceText, translatedText) {
        try {
            const record = await dbTools.dbInsertSingle(this.models.ParagraphRecord, {
                file_record_id: fileRecordId,
                paragraph_index: paragraphIndex,
                paragraph_hash: paragraphHash,
                source_text: sourceText,
                translated_text: translatedText,
                created_at: new Date()
            });

            logger.debug(`[Cache Manager] Saved paragraph record: ${fileRecordId}:${paragraphIndex}`);
            return record;

        } catch (error) {
            logger.error(`[Cache Manager] Error saving paragraph record: ${error.message}`);
            throw error;
        }
    }

    async updateParagraphRecord(fileRecordId, paragraphIndex, paragraphHash, sourceText, translatedText) {
        try {
            await dbTools.dbUpdate(this.models.ParagraphRecord, {
                paragraph_hash: paragraphHash,
                source_text: sourceText,
                translated_text: translatedText
            }, {
                where: { 
                    file_record_id: fileRecordId,
                    paragraph_index: paragraphIndex
                }
            });

            logger.debug(`[Cache Manager] Updated paragraph record: ${fileRecordId}:${paragraphIndex}`);

        } catch (error) {
            logger.error(`[Cache Manager] Error updating paragraph record: ${error.message}`);
            throw error;
        }
    }

    async getFileParagraphs(fileRecordId) {
        try {
            const paragraphs = await dbTools.dbQuery(this.models.ParagraphRecord, {
                where: { file_record_id: fileRecordId },
                order: [['paragraph_index', 'ASC']]
            });

            return paragraphs;

        } catch (error) {
            logger.error(`[Cache Manager] Error getting file paragraphs: ${error.message}`);
            return [];
        }
    }

    async saveParagraphCache(contentHash, sourceText, translatedText, targetLanguage) {
        try {
            const sourceLanguage = this.detectLanguage(sourceText);
            
            // Check if cache already exists
            const existing = await this.getParagraphCache(contentHash, targetLanguage);
            if (existing) {
                // Update usage count
                await dbTools.dbUpdate(this.models.TranslationCache, {
                    usage_count: existing.usage_count + 1
                }, {
                    where: { id: existing.id }
                });
                return existing;
            }

            const cacheRecord = await dbTools.dbInsertSingle(this.models.TranslationCache, {
                content_hash: contentHash,
                source_text: sourceText,
                translated_text: translatedText,
                source_language: sourceLanguage,
                target_language: targetLanguage,
                created_at: new Date(),
                usage_count: 1
            });

            logger.debug(`[Cache Manager] Saved translation cache: ${contentHash}`);
            return cacheRecord;

        } catch (error) {
            logger.error(`[Cache Manager] Error saving translation cache: ${error.message}`);
            throw error;
        }
    }

    async getParagraphCache(contentHash, targetLanguage) {
        try {
            const cacheRecords = await dbTools.dbQuery(this.models.TranslationCache, {
                where: { 
                    content_hash: contentHash,
                    target_language: targetLanguage
                }
            });

            return cacheRecords.length > 0 ? cacheRecords[0].translated_text : null;

        } catch (error) {
            logger.error(`[Cache Manager] Error getting translation cache: ${error.message}`);
            return null;
        }
    }

    detectLanguage(text) {
        const chinesePattern = /[\u4e00-\u9fff]/;
        return chinesePattern.test(text) ? 'zh' : 'en';
    }

    async createProgressTracker(fileRecordId, totalParagraphs) {
        try {
            const tracker = await dbTools.dbInsertSingle(this.models.ProgressTracker, {
                file_record_id: fileRecordId,
                total_paragraphs: totalParagraphs,
                completed_paragraphs: 0,
                current_paragraph: 0,
                status: 'in_progress',
                updated_at: new Date()
            });

            logger.debug(`[Cache Manager] Created progress tracker: ${fileRecordId}`);
            return tracker;

        } catch (error) {
            logger.error(`[Cache Manager] Error creating progress tracker: ${error.message}`);
            throw error;
        }
    }

    async updateProgress(fileRecordId, currentParagraph, completedParagraphs) {
        try {
            await dbTools.dbUpdate(this.models.ProgressTracker, {
                current_paragraph: currentParagraph,
                completed_paragraphs: completedParagraphs,
                updated_at: new Date()
            }, {
                where: { file_record_id: fileRecordId }
            });

            logger.debug(`[Cache Manager] Updated progress: ${fileRecordId} - ${completedParagraphs} completed`);

        } catch (error) {
            logger.error(`[Cache Manager] Error updating progress: ${error.message}`);
            throw error;
        }
    }

    async getProgress(fileRecordId) {
        try {
            const trackers = await dbTools.dbQuery(this.models.ProgressTracker, {
                where: { file_record_id: fileRecordId }
            });

            return trackers.length > 0 ? trackers[0] : null;

        } catch (error) {
            logger.error(`[Cache Manager] Error getting progress: ${error.message}`);
            return null;
        }
    }

    async getCacheStats() {
        try {
            const fileCount = await dbTools.dbQueryCount(this.models.FileRecord, {});
            const paragraphCount = await dbTools.dbQueryCount(this.models.ParagraphRecord, {});
            const cacheCount = await dbTools.dbQueryCount(this.models.TranslationCache, {});

            return {
                files: fileCount,
                paragraphs: paragraphCount,
                cacheEntries: cacheCount
            };

        } catch (error) {
            logger.error(`[Cache Manager] Error getting cache stats: ${error.message}`);
            return { files: 0, paragraphs: 0, cacheEntries: 0 };
        }
    }

    async cleanupOldCache(daysOld = 30) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);

            const deletedCount = await dbTools.dbHardDelete(this.models.TranslationCache, {
                where: {
                    created_at: { [Op.lt]: cutoffDate },
                    usage_count: { [Op.lt]: 2 }
                }
            });

            logger.info(`[Cache Manager] Cleaned up ${deletedCount} old cache entries`);
            return deletedCount;

        } catch (error) {
            logger.error(`[Cache Manager] Error cleaning up cache: ${error.message}`);
            return 0;
        }
    }

    async close() {
        if (this.sequelize) {
            await this.sequelize.close();
            logger.info('[Cache Manager] Database connection closed');
        }
    }
}

module.exports = CacheManager;