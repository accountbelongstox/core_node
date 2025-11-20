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

const os = require('os');

class SmartCompressionConfig {
    constructor() {
        this.defaults = this.getDefaultConfiguration();
        this.current = { ...this.defaults };
    }

    getDefaultConfiguration() {
        const cpuCores = os.cpus().length;
        const totalMemory = os.totalmem();
        
        return {
            // Parallel processing limits
            maxParallelSize: 100 * 1024 * 1024, // 100MB
            maxParallelTasks: Math.max(2, Math.min(4, Math.floor(cpuCores * 0.75))),
            largeFileThreshold: 50 * 1024 * 1024, // 50MB
            
            // System monitoring thresholds
            cpuThreshold: 75, // Percentage
            memoryThreshold: 80, // Percentage
            monitoringInterval: 2000, // 2 seconds
            
            // Compression settings
            defaultCompressionLevel: 'normal',
            compressionLevels: {
                fastest: 1,
                fast: 3,
                normal: 5,
                maximum: 7,
                ultra: 9
            },
            
            // Queue management
            maxQueueSize: 1000,
            taskTimeout: 30 * 60 * 1000, // 30 minutes
            retryAttempts: 3,
            retryDelay: 5000, // 5 seconds
            
            // File handling
            defaultForceOverwrite: false,
            tempDirectory: os.tmpdir(),
            backupOriginals: false,
            
            // Logging and monitoring
            enableDetailedLogging: true,
            logCompressionRatios: true,
            logSystemMetrics: false,
            
            // Performance optimization
            adaptiveScheduling: true,
            dynamicPriorityAdjustment: true,
            systemLoadAwareness: true,
            
            // File size categories
            fileSizeCategories: {
                tiny: 1024 * 1024,        // 1MB
                small: 10 * 1024 * 1024,  // 10MB
                medium: 50 * 1024 * 1024, // 50MB
                large: 100 * 1024 * 1024, // 100MB
                huge: 500 * 1024 * 1024   // 500MB
            },
            
            // Processing strategies by file size
            processingStrategies: {
                tiny: {
                    allowParallel: true,
                    maxConcurrent: Math.min(8, cpuCores),
                    compressionLevel: 'maximum'
                },
                small: {
                    allowParallel: true,
                    maxConcurrent: Math.min(4, Math.floor(cpuCores * 0.75)),
                    compressionLevel: 'normal'
                },
                medium: {
                    allowParallel: true,
                    maxConcurrent: Math.min(2, Math.floor(cpuCores * 0.5)),
                    compressionLevel: 'normal'
                },
                large: {
                    allowParallel: false,
                    maxConcurrent: 1,
                    compressionLevel: 'fast'
                },
                huge: {
                    allowParallel: false,
                    maxConcurrent: 1,
                    compressionLevel: 'fastest'
                }
            }
        };
    }

    get(key) {
        return this.current[key];
    }

    set(key, value) {
        if (this.defaults.hasOwnProperty(key)) {
            this.current[key] = value;
            return true;
        }
        return false;
    }

    update(config) {
        Object.keys(config).forEach(key => {
            if (this.defaults.hasOwnProperty(key)) {
                this.current[key] = config[key];
            }
        });
    }

    reset() {
        this.current = { ...this.defaults };
    }

    resetKey(key) {
        if (this.defaults.hasOwnProperty(key)) {
            this.current[key] = this.defaults[key];
            return true;
        }
        return false;
    }

    getFileSizeCategory(sizeInBytes) {
        const categories = this.current.fileSizeCategories;
        
        if (sizeInBytes <= categories.tiny) return 'tiny';
        if (sizeInBytes <= categories.small) return 'small';
        if (sizeInBytes <= categories.medium) return 'medium';
        if (sizeInBytes <= categories.large) return 'large';
        return 'huge';
    }

    getProcessingStrategy(sizeInBytes) {
        const category = this.getFileSizeCategory(sizeInBytes);
        return this.current.processingStrategies[category];
    }

    getOptimalSettings(systemLoad, queueSize, averageFileSize) {
        const baseSettings = { ...this.current };
        
        // Adjust based on system load
        if (systemLoad && systemLoad.underLoad) {
            baseSettings.maxParallelTasks = 1;
            baseSettings.maxParallelSize = baseSettings.maxParallelSize * 0.5;
        } else if (systemLoad && systemLoad.currentCPU < 30) {
            baseSettings.maxParallelTasks = Math.min(
                baseSettings.maxParallelTasks * 1.5,
                os.cpus().length
            );
        }
        
        // Adjust based on queue size
        if (queueSize > 50) {
            baseSettings.defaultCompressionLevel = 'fast';
        } else if (queueSize < 10) {
            baseSettings.defaultCompressionLevel = 'maximum';
        }
        
        // Adjust based on average file size
        if (averageFileSize > baseSettings.largeFileThreshold) {
            baseSettings.maxParallelTasks = Math.max(1, Math.floor(baseSettings.maxParallelTasks * 0.5));
        }
        
        return baseSettings;
    }

    validateConfiguration() {
        const errors = [];
        const warnings = [];
        
        // Validate numeric ranges
        if (this.current.maxParallelTasks < 1) {
            errors.push('maxParallelTasks must be at least 1');
        }
        
        if (this.current.maxParallelSize < 1024 * 1024) {
            warnings.push('maxParallelSize is very small (< 1MB)');
        }
        
        if (this.current.cpuThreshold < 0 || this.current.cpuThreshold > 100) {
            errors.push('cpuThreshold must be between 0 and 100');
        }
        
        if (this.current.memoryThreshold < 0 || this.current.memoryThreshold > 100) {
            errors.push('memoryThreshold must be between 0 and 100');
        }
        
        // Validate compression levels
        const validLevels = Object.keys(this.current.compressionLevels);
        if (!validLevels.includes(this.current.defaultCompressionLevel)) {
            errors.push(`defaultCompressionLevel must be one of: ${validLevels.join(', ')}`);
        }
        
        // System-specific validations
        const cpuCores = os.cpus().length;
        if (this.current.maxParallelTasks > cpuCores * 2) {
            warnings.push(`maxParallelTasks (${this.current.maxParallelTasks}) is much higher than CPU cores (${cpuCores})`);
        }
        
        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    exportConfiguration() {
        return {
            timestamp: new Date().toISOString(),
            system: {
                platform: os.platform(),
                arch: os.arch(),
                cpus: os.cpus().length,
                totalMemory: os.totalmem()
            },
            configuration: { ...this.current }
        };
    }

    importConfiguration(configData) {
        if (!configData || !configData.configuration) {
            throw new Error('Invalid configuration data');
        }
        
        const validation = this.validateConfiguration();
        if (!validation.isValid) {
            throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
        }
        
        this.update(configData.configuration);
        return true;
    }

    getSystemRecommendations() {
        const cpuCores = os.cpus().length;
        const totalMemoryGB = Math.round(os.totalmem() / (1024 * 1024 * 1024));
        
        const recommendations = {
            maxParallelTasks: Math.max(2, Math.min(4, Math.floor(cpuCores * 0.75))),
            maxParallelSize: Math.min(200 * 1024 * 1024, totalMemoryGB * 50 * 1024 * 1024),
            largeFileThreshold: Math.min(100 * 1024 * 1024, totalMemoryGB * 25 * 1024 * 1024),
            reasoning: {
                cpuCores: `System has ${cpuCores} CPU cores`,
                memory: `System has ${totalMemoryGB}GB RAM`,
                recommendation: cpuCores >= 8 ? 'High-performance system' : 
                               cpuCores >= 4 ? 'Medium-performance system' : 
                               'Low-performance system'
            }
        };
        
        return recommendations;
    }

    formatSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let size = bytes;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }

    toString() {
        const config = this.exportConfiguration();
        return JSON.stringify(config, null, 2);
    }
}

module.exports = SmartCompressionConfig;
