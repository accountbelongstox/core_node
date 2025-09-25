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

const logger = require('#@logger');
const { DATA_DIR } = require('#@global_dir');
const { datetool } = require('#@btools');
const config = require('./config/index.js');
const FileWatcher = require('./libs/file_watcher.js');
const TranslationManager = require('./libs/translation_manager.js');
const CacheManager = require('./libs/cache_manager.js');
const ParagraphSplitter = require('./libs/paragraph_splitter.js');
const AITranslator = require('./libs/ai_translator.js');
const path = require('path');

class AITranslatorMain {
    constructor(options = {}) {
        this.isRunning = false;
        this.processLock = false;
        this.translationManager = null;
        this.cacheManager = null;
        this.fileWatcher = null;
        this.config = { ...config, ...options };
        this.databaseDir = this.config.databaseDir;
        this.tempDir = this.config.tempDir;
        this.supportedExtensions = this.config.watchSettings.supportedExtensions;
        this.watchDepth = this.config.watchSettings.watchDepth || 10;
        this.skipFolders = [...(this.config.watchSettings.excludePatterns || []), ...(options.skipFolders || [])];
        this.skipFiles = options.skipFiles || [];
        this.skipExtensions = [...(this.config.watchSettings.skipExtensions || ['.js', '.ts', '.py', '.java', '.cpp', '.c', '.h']), ...(options.skipExtensions || [])];
    }

    async initialize(watchPaths = [], options = {}) {
        if (this.isRunning) {
            logger.warn('[AI Translator] Already running, skipping initialization');
            return false;
        }

        try {
            logger.info('[AI Translator] Initializing AI Translator...');
            
            // Parse options
            const {
                watchExtensions = this.supportedExtensions,
                watchDepth = this.watchDepth,
                skipFolders = this.skipFolders,
                skipFiles = this.skipFiles,
                skipExtensions = this.skipExtensions,
                targetLanguage = 'auto'
            } = options;

            // Update configuration
            this.supportedExtensions = watchExtensions;
            this.watchDepth = watchDepth;
            this.skipFolders = [...this.skipFolders, ...skipFolders];
            this.skipFiles = [...this.skipFiles, ...skipFiles];
            this.skipExtensions = [...this.skipExtensions, ...skipExtensions];
            this.targetLanguage = targetLanguage;

            // Process watchPaths to handle both directories and files
            this.watchPaths = this.processWatchPaths(watchPaths);
            
            // Initialize AI Translator with OpenRouter
            AITranslator.initialize(this.config.openRouterConfig || {});

            this.cacheManager = new CacheManager(this.databaseDir);
            await this.cacheManager.initialize();

            this.translationManager = new TranslationManager(this.databaseDir, this.tempDir);
            await this.translationManager.initialize();

            this.fileWatcher = new FileWatcher(this.watchPaths, this.supportedExtensions, {
                watchDepth: this.watchDepth,
                skipFolders: this.skipFolders,
                skipFiles: this.skipFiles,
                skipExtensions: this.skipExtensions
            });
            await this.fileWatcher.initialize();

            this.isRunning = true;

            logger.info('[AI Translator] Initialization completed');
            logger.info(`[AI Translator] Watching ${this.watchPaths.length} paths`);
            logger.info(`[AI Translator] Supported extensions: ${this.supportedExtensions.join(', ')}`);
            logger.info(`[AI Translator] Skip folders: ${this.skipFolders.join(', ')}`);
            logger.info(`[AI Translator] Skip extensions: ${this.skipExtensions.join(', ')}`);
            
            return true;
        } catch (error) {
            logger.error(`[AI Translator] Initialization failed: ${error.message}`);
            return false;
        }
    }

    processWatchPaths(watchPaths) {
        const processedPaths = [];
        const { freader } = require('#@btools');
        
        for (const watchPath of watchPaths) {
            if (freader.isFile(watchPath)) {
                // If it's a file, add it directly and watch its parent directory
                processedPaths.push(watchPath);
                const parentDir = path.dirname(watchPath);
                if (!processedPaths.includes(parentDir)) {
                    processedPaths.push(parentDir);
                }
            } else if (freader.isExists(watchPath)) {
                // If it's a directory, add it
                processedPaths.push(watchPath);
            } else {
                logger.warn(`[AI Translator] Watch path does not exist: ${watchPath}`);
            }
        }
        
        return processedPaths;
    }

    async startTranslation(watchPaths = [], options = {}) {
        if (this.processLock) {
            logger.warn('[AI Translator] Translation process already running');
            return false;
        }

        if (!this.isRunning) {
            const initialized = await this.initialize(watchPaths, options);
            if (!initialized) {
                return false;
            }
        }

        this.processLock = true;

        try {
            logger.info('[AI Translator] Starting translation process...');

            while (this.isRunning && this.processLock) {
                await this.processTranslationCycle();
                await datetool.sleep(this.config.processingSettings.cycleInterval);
            }

        } catch (error) {
            logger.error(`[AI Translator] Translation process error: ${error.message}`);
        } finally {
            this.processLock = false;
        }

        return true;
    }

    async processTranslationCycle() {
        try {
            const filesToProcess = await this.fileWatcher.getChangedFiles();
            
            if (filesToProcess.length === 0) {
                logger.debug('[AI Translator] No files to process in this cycle');
                return;
            }

            logger.info(`[AI Translator] Processing ${filesToProcess.length} files`);

            for (const filePath of filesToProcess) {
                await this.processFile(filePath);
            }

        } catch (error) {
            logger.error(`[AI Translator] Process cycle error: ${error.message}`);
        }
    }

    async processFile(filePath) {
        try {
            logger.info(`[AI Translator] Processing file: ${filePath}`);

            const fileHash = await this.cacheManager.getFileHash(filePath);
            const existingRecord = await this.cacheManager.getFileRecord(filePath);

            if (existingRecord && existingRecord.source_hash === fileHash) {
                logger.debug(`[AI Translator] File unchanged: ${filePath}`);
                return;
            }

            const content = this.translationManager.readFile(filePath);
            if (!content) {
                logger.warn(`[AI Translator] Could not read file: ${filePath}`);
                return;
            }

            const detectedLanguage = this.detectLanguage(content);
            const targetLang = this.getTargetLanguage(detectedLanguage);

            if (existingRecord) {
                await this.processUpdatedFile(filePath, content, existingRecord, targetLang);
            } else {
                await this.processNewFile(filePath, content, fileHash, targetLang);
            }

        } catch (error) {
            logger.error(`[AI Translator] Error processing file ${filePath}: ${error.message}`);
        }
    }

    async processNewFile(filePath, content, fileHash, targetLanguage) {
        try {
            logger.info(`[AI Translator] Processing new file: ${filePath}`);

            const paragraphs = ParagraphSplitter.split(content, this.config.paragraphSettings);
            logger.info(`[AI Translator] Split into ${paragraphs.length} paragraphs`);

            const record = await this.cacheManager.createFileRecord(filePath, fileHash, targetLanguage);
            
            for (let i = 0; i < paragraphs.length; i++) {
                const paragraph = paragraphs[i];
                const paragraphHash = this.cacheManager.generateHash(paragraph);

                let translation = await this.cacheManager.getParagraphCache(paragraphHash, targetLanguage);
                
                if (!translation) {
                    translation = await AITranslator.translate(paragraph, targetLanguage);
                    await this.cacheManager.saveParagraphCache(paragraphHash, paragraph, translation, targetLanguage);
                }

                await this.cacheManager.saveParagraphRecord(record.id, i, paragraphHash, paragraph, translation);
                
                logger.debug(`[AI Translator] Processed paragraph ${i + 1}/${paragraphs.length}`);
            }

            await this.translationManager.saveTranslationResult(filePath, paragraphs, record.id);
            await this.cacheManager.markFileComplete(record.id);

            logger.info(`[AI Translator] Completed translation: ${filePath}`);

        } catch (error) {
            logger.error(`[AI Translator] Error processing new file ${filePath}: ${error.message}`);
        }
    }

    async processUpdatedFile(filePath, newContent, existingRecord, targetLanguage) {
        try {
            logger.info(`[AI Translator] Processing updated file: ${filePath}`);

            const oldParagraphs = await this.cacheManager.getFileParagraphs(existingRecord.id);
            const newParagraphs = ParagraphSplitter.split(newContent, this.config.paragraphSettings);

            const changes = this.compareContent(oldParagraphs, newParagraphs);
            
            if (changes.length === 0) {
                logger.debug(`[AI Translator] No content changes detected: ${filePath}`);
                return;
            }

            await this.translationManager.backupTranslation(filePath, existingRecord.id);

            for (const change of changes) {
                const { index, paragraph } = change;
                const paragraphHash = this.cacheManager.generateHash(paragraph);

                let translation = await this.cacheManager.getParagraphCache(paragraphHash, targetLanguage);
                
                if (!translation) {
                    translation = await AITranslator.translate(paragraph, targetLanguage);
                    await this.cacheManager.saveParagraphCache(paragraphHash, paragraph, translation, targetLanguage);
                }

                await this.cacheManager.updateParagraphRecord(existingRecord.id, index, paragraphHash, paragraph, translation);
            }

            await this.translationManager.saveTranslationResult(filePath, newParagraphs, existingRecord.id);
            
            const newFileHash = await this.cacheManager.getFileHash(filePath);
            await this.cacheManager.updateFileRecord(existingRecord.id, newFileHash);

            logger.info(`[AI Translator] Updated translation: ${filePath}`);

        } catch (error) {
            logger.error(`[AI Translator] Error processing updated file ${filePath}: ${error.message}`);
        }
    }

    compareContent(oldParagraphs, newParagraphs) {
        const changes = [];
        
        for (let i = 0; i < newParagraphs.length; i++) {
            const newParagraph = newParagraphs[i];
            const oldParagraph = oldParagraphs[i];
            
            if (!oldParagraph || oldParagraph.source_text !== newParagraph) {
                changes.push({
                    index: i,
                    paragraph: newParagraph
                });
            }
        }

        return changes;
    }

    detectLanguage(content) {
        const chinesePattern = /[\u4e00-\u9fff]/;
        return chinesePattern.test(content) ? 'zh' : 'en';
    }

    getTargetLanguage(detectedLanguage) {
        if (this.targetLanguage !== 'auto') {
            return this.targetLanguage;
        }
        return detectedLanguage === 'zh' ? 'en' : 'zh';
    }


    async stop() {
        logger.info('[AI Translator] Stopping translation process...');
        this.isRunning = false;
        this.processLock = false;

        if (this.fileWatcher) {
            await this.fileWatcher.close();
        }

        if (this.cacheManager) {
            await this.cacheManager.close();
        }

        logger.info('[AI Translator] Translation process stopped');
    }

    async getStatus() {
        return {
            isRunning: this.isRunning,
            processLock: this.processLock,
            databaseDir: this.databaseDir,
            tempDir: this.tempDir,
            targetLanguage: this.targetLanguage
        };
    }
}

module.exports = AITranslatorMain;