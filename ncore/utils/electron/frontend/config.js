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

/**
 * Frontend Configuration
 *
 * Ported from pycore/pyutils/native_ui/step9_frontend/frontend_config.py
 * Adapted for Electron environment with ncore standards
 *
 * Usage:
 *   const { FrontendConfig } = require('./config');
 *   const config = new FrontendConfig({
 *       enabled: true,
 *       framework: 'vite',
 *       appDir: '/path/to/app',
 *       mode: 'dev'
 *   });
 */

const path = require('path');
const fs = require('fs');
const logger = require('#@logger');

class FrontendConfig {
    constructor(options = {}) {
        this.enabled = options.enabled !== undefined ? options.enabled : false;
        this.framework = options.framework || 'vite';
        this.appDir = options.appDir || null;
        this.mode = options.mode || 'production';

        this.port = options.port || 3000;
        this.host = options.host || '0.0.0.0';

        this.autoInstall = options.autoInstall !== false;
        this.packageManager = options.packageManager || 'pnpm';
        this.skipBuild = options.skipBuild || false;
        this.forceRebuild = options.forceRebuild || false;
        this.smartBuild = options.smartBuild !== false;

        this.devCommand = options.devCommand || null;
        this.buildCommand = options.buildCommand || null;
        this.installCommand = options.installCommand || null;

        this.staticDir = options.staticDir || null;
        this.outputDir = options.outputDir || null;

        this.healthPath = options.healthPath || '/';
        this.healthCheckTimeout = options.healthCheckTimeout || 120;

        this.showOutput = options.showOutput !== false;
        this.blockUntilReady = options.blockUntilReady || false;

        this.envVars = options.envVars || null;

        if (this.enabled) {
            this._validate();
        }
    }

    _validate() {
        if (!this.appDir) {
            throw new Error('[FrontendConfig] appDir is required when enabled=true');
        }

        const validFrameworks = ['nuxt', 'react', 'react-native', 'vite', 'vue', 'next', 'nexus'];
        if (!validFrameworks.includes(this.framework)) {
            throw new Error(`[FrontendConfig] Invalid framework: ${this.framework}. Supported: ${validFrameworks.join(', ')}`);
        }

        const validModes = ['dev', 'production'];
        if (!validModes.includes(this.mode)) {
            throw new Error(`[FrontendConfig] Invalid mode: ${this.mode}`);
        }

        this.appDir = path.resolve(this.appDir);
        if (!fs.existsSync(this.appDir)) {
            throw new Error(`[FrontendConfig] appDir does not exist: ${this.appDir}`);
        }

        if (!this.staticDir) {
            this.staticDir = this._getDefaultStaticDir();
        } else {
            if (!path.isAbsolute(this.staticDir)) {
                this.staticDir = path.join(this.appDir, this.staticDir);
            }
        }

        if (!this.outputDir) {
            this.outputDir = this._getDefaultOutputDir();
        } else {
            if (!path.isAbsolute(this.outputDir)) {
                this.outputDir = path.join(this.appDir, this.outputDir);
            }
        }

        logger.info(`[FrontendConfig] Validated: ${this.framework} (${this.mode}) at ${this.appDir}`);
    }

    _getDefaultStaticDir() {
        const dirs = {
            'nuxt': path.join(this.appDir, '.output', 'public'),
            'next': path.join(this.appDir, '.next', 'static'),
            'nexus': path.join(this.appDir, '.next', 'static'),
            'vue': path.join(this.appDir, 'dist'),
            'react-native': path.join(this.appDir, 'web-build'),
            'react': path.join(this.appDir, 'dist'),
            'vite': path.join(this.appDir, 'dist')
        };

        return dirs[this.framework] || path.join(this.appDir, 'dist');
    }

    _getDefaultOutputDir() {
        const dirs = {
            'nuxt': path.join(this.appDir, '.output'),
            'next': path.join(this.appDir, '.next'),
            'nexus': path.join(this.appDir, '.next'),
            'vue': path.join(this.appDir, 'dist'),
            'react-native': path.join(this.appDir, 'web-build'),
            'react': path.join(this.appDir, 'dist'),
            'vite': path.join(this.appDir, 'dist')
        };

        return dirs[this.framework] || path.join(this.appDir, 'dist');
    }

    getDevUrl() {
        return `http://localhost:${this.port}`;
    }

    getDevCommand() {
        if (this.devCommand) {
            return this.devCommand;
        }

        const pm = this.packageManager;
        const commands = {
            'vite': [pm, 'run', 'dev'],
            'nuxt': [pm, 'run', 'dev'],
            'next': [pm, 'run', 'dev'],
            'nexus': [pm, 'run', 'dev'],
            'react': [pm, 'start'],
            'react-native': [pm, 'run', 'web'],
            'vue': [pm, 'run', 'dev']
        };

        return commands[this.framework] || [pm, 'run', 'dev'];
    }

    getBuildCommand() {
        if (this.buildCommand) {
            return this.buildCommand;
        }

        const pm = this.packageManager;
        const commands = {
            'vite': [pm, 'run', 'build'],
            'nuxt': [pm, 'run', 'build'],
            'next': [pm, 'run', 'build'],
            'nexus': [pm, 'run', 'build'],
            'react': [pm, 'run', 'build'],
            'react-native': [pm, 'run', 'web:build'],
            'vue': [pm, 'run', 'build']
        };

        return commands[this.framework] || [pm, 'run', 'build'];
    }

    getInstallCommand() {
        if (this.installCommand) {
            return this.installCommand;
        }

        return [this.packageManager, 'install'];
    }

    toJSON() {
        return {
            enabled: this.enabled,
            framework: this.framework,
            appDir: this.appDir,
            mode: this.mode,
            port: this.port,
            host: this.host,
            autoInstall: this.autoInstall,
            staticDir: this.staticDir,
            blockUntilReady: this.blockUntilReady
        };
    }
}

module.exports = {
    FrontendConfig
};
