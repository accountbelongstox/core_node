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
const SpiderEngine = require('../core/SpiderEngine');

class LegacyAdapter {
    constructor() {
        this.newSpider = null;
        this.session = null;
        this.isInitialized = false;
    }

    async initialize(browserType = 'edge') {
        try {
            this.newSpider = new SpiderEngine();
            await this.newSpider.initialize();
            
            this.session = await this.newSpider.createSession({
                browser: browserType
            });
            
            this.isInitialized = true;
            logger.info('LegacyAdapter initialized');
            return this;
        } catch (error) {
            logger.error('Failed to initialize LegacyAdapter:', error);
            throw error;
        }
    }

    getPage() {
        if (!this.session) {
            throw new Error('Session not initialized. Call initialize() first.');
        }
        return this.session.getCurrentPage();
    }

    getBrowser() {
        if (!this.session) {
            throw new Error('Session not initialized. Call initialize() first.');
        }
        return this.session.getBrowser();
    }

    async close() {
        try {
            if (this.session) {
                await this.session.close();
                this.session = null;
            }
            if (this.newSpider) {
                await this.newSpider.shutdown();
                this.newSpider = null;
            }
            this.isInitialized = false;
            logger.info('LegacyAdapter closed');
        } catch (error) {
            logger.error('Failed to close LegacyAdapter:', error);
            throw error;
        }
    }

    getInfo() {
        return {
            isInitialized: this.isInitialized,
            session: this.session ? this.session.getInfo() : null,
            spider: this.newSpider ? this.newSpider.getInfo() : null
        };
    }
}

class MigrationTool {
    static migrateOldConfig(oldConfig) {
        try {
            const newConfig = {
                browser: oldConfig.browserType || 'edge',
                headless: oldConfig.headless !== false,
                viewport: oldConfig.viewport || { width: 1920, height: 1080 },
                timeout: oldConfig.timeout || 30000,
                retries: oldConfig.retries || 3,
                delay: oldConfig.delay || 1000
            };

            // Migrate browser-specific options
            if (oldConfig.browserOptions) {
                newConfig.browserOptions = oldConfig.browserOptions;
            }

            // Migrate session options
            if (oldConfig.sessionOptions) {
                newConfig.sessionOptions = oldConfig.sessionOptions;
            }

            logger.info('Old config migrated to new format');
            return newConfig;
        } catch (error) {
            logger.error('Failed to migrate old config:', error);
            throw error;
        }
    }

    static migrateOldCode(oldCode) {
        try {
            let migratedCode = oldCode;

            // Replace class instantiation
            migratedCode = migratedCode.replace(
                /new PuppeteerSpider\(/g, 
                'new SpiderEngine('
            );

            // Replace initialization calls
            migratedCode = migratedCode.replace(
                /\.initialize\(/g, 
                '.createSession('
            );

            // Replace page access
            migratedCode = migratedCode.replace(
                /\.getPage\(\)/g, 
                '.getCurrentPage()'
            );

            // Replace browser access
            migratedCode = migratedCode.replace(
                /\.getBrowser\(\)/g, 
                '.getBrowser()'
            );

            // Replace instance manager calls
            migratedCode = migratedCode.replace(
                /PuppeteerInstanceManager/g, 
                'SessionManager'
            );

            // Replace global instances
            migratedCode = migratedCode.replace(
                /GLOBAL_INSTANCES/g, 
                'SpiderRegistry'
            );

            logger.info('Old code migrated to new API');
            return migratedCode;
        } catch (error) {
            logger.error('Failed to migrate old code:', error);
            throw error;
        }
    }

    static migrateOldWrapper(wrapperCode) {
        try {
            let migratedCode = wrapperCode;

            // Replace wrapper imports
            migratedCode = migratedCode.replace(
                /require\('\.\.\/driver'\)/g,
                "require('../implementations/pages/StandardPage')"
            );

            // Replace wrapper class usage
            migratedCode = migratedCode.replace(
                /PuppeteerDriver/g,
                'StandardPage'
            );

            // Replace wrapper methods
            migratedCode = migratedCode.replace(
                /\.getPage\(\)/g,
                '.getCurrentPage()'
            );

            logger.info('Old wrapper code migrated');
            return migratedCode;
        } catch (error) {
            logger.error('Failed to migrate old wrapper:', error);
            throw error;
        }
    }

    static generateMigrationReport(oldFiles) {
        try {
            const report = {
                totalFiles: oldFiles.length,
                migratedFiles: 0,
                errors: [],
                suggestions: []
            };

            for (const file of oldFiles) {
                try {
                    const migratedCode = this.migrateOldCode(file.content);
                    report.migratedFiles++;
                } catch (error) {
                    report.errors.push({
                        file: file.path,
                        error: error.message
                    });
                }
            }

            // Add suggestions
            report.suggestions.push(
                'Update imports to use new module structure',
                'Replace PuppeteerSpider with SpiderEngine',
                'Use session-based API instead of global instances',
                'Update plugin usage to new plugin system',
                'Migrate configuration to new config format'
            );

            logger.info(`Migration report generated: ${report.migratedFiles}/${report.totalFiles} files migrated`);
            return report;
        } catch (error) {
            logger.error('Failed to generate migration report:', error);
            throw error;
        }
    }

    static validateMigration(migratedCode) {
        try {
            const issues = [];

            // Check for old API usage
            if (migratedCode.includes('PuppeteerSpider')) {
                issues.push('Found old PuppeteerSpider class usage');
            }

            if (migratedCode.includes('PuppeteerInstanceManager')) {
                issues.push('Found old PuppeteerInstanceManager usage');
            }

            if (migratedCode.includes('GLOBAL_INSTANCES')) {
                issues.push('Found old GLOBAL_INSTANCES usage');
            }

            if (migratedCode.includes('.initialize(')) {
                issues.push('Found old initialize() method usage');
            }

            if (migratedCode.includes('.getPage()')) {
                issues.push('Found old getPage() method usage');
            }

            return {
                isValid: issues.length === 0,
                issues: issues
            };
        } catch (error) {
            logger.error('Failed to validate migration:', error);
            throw error;
        }
    }
}

module.exports = {
    LegacyAdapter,
    MigrationTool
};
