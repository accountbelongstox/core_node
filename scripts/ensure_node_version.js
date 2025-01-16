const { execCmd, execCmdResultText } = require('#@/ncore/utils/basic/commander.js');
const { getSoftwarePath } = require('../ncore/gvar/tool/soft-install');

let log;
try {
    const logger = require('#@/ncore/utils/logger/index.js');
    log = logger;
} catch (error) {
    log = {
        info: (...args) => console.log('[INFO]', ...args),
        warn: (...args) => console.warn('[WARN]', ...args),
        error: (...args) => console.error('[ERROR]', ...args),
        success: (...args) => console.log('[SUCCESS]', ...args),
        debug: (...args) => console.log('[DEBUG]', ...args)
    };
}

class NodeVersionManager {
    constructor() {
        this.isWindows = process.platform === 'win32';
    }

    async ensureNpx() {
        try {
            const npxPath = await getSoftwarePath('npx', 2, true);
            if (npxPath) {
                log.success('Found npx at:', npxPath);
                return npxPath;
            }

            log.info('npx not found, please install Node.js first');
            throw new Error('npx not found');
        } catch (error) {
            log.error('Failed to ensure npx:', error.message);
            throw error;
        }
    }

    async switchNodeVersion(version) {
        if (!version) {
            throw new Error('Node version must be specified (e.g., 16.14.0)');
        }

        try {
            await this.ensureNpx();
            log.info(`Switching Node.js to version ${version}...`);
            
            // Use npx to run n and switch version
            await execCmd(`npx n ${version}`, true, null);
            
            // Verify the switch
            const currentVersion = await execCmdResultText('node -v', true, null);
            if (currentVersion.includes(version)) {
                log.success(`Successfully switched to Node.js ${currentVersion}`);
                return true;
            } else {
                throw new Error(`Failed to switch to Node.js ${version}, current version is ${currentVersion}`);
            }
        } catch (error) {
            log.error('Failed to switch Node version:', error.message);
            throw error;
        }
    }

    printUsage() {
        log.info('Usage: node ensure_node_version.js <version>');
        log.info('Example: node ensure_node_version.js 16.14.0');
        log.info('This script will:');
        log.info('1. Ensure npx is available');
        log.info('2. Use npx to run n and switch to the specified Node version');
    }
}

const manager = new NodeVersionManager();

// Export for use as a module
module.exports = manager;

// Run as script
if (require.main === module) {
    async function main() {
        const version = process.argv[2];
        
        if (!version) {
            manager.printUsage();
            process.exit(1);
        }

        try {
            await manager.switchNodeVersion(version);
        } catch (error) {
            log.error('Script failed:', error.message);
            process.exit(1);
        }
    }

    main();
} 