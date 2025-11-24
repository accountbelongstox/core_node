// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

const logger = require('#@logger');

class ModeResolver {
    constructor() {
        this.name = 'ModeResolver';
        this.version = '1.0.0';
    }

    resolve(config) {
        const launchMode = config.launch_mode;
        const modeConfig = config.mode || {};
        const windowConfig = config.window || {};
        const trayConfig = config.tray || {};

        let enableTray = true;
        let enableWindow = true;
        let showWindowOnStart = false;
        let reason = '';

        if (launchMode) {
            switch (launchMode) {
                case 'tray':
                    enableTray = true;
                    enableWindow = false;
                    reason = 'launch_mode=tray';
                    break;

                case 'window':
                    enableTray = false;
                    enableWindow = true;
                    showWindowOnStart = true;
                    reason = 'launch_mode=window';
                    break;

                case 'both':
                    enableTray = true;
                    enableWindow = true;
                    showWindowOnStart = windowConfig.showOnStart !== false;
                    reason = 'launch_mode=both';
                    break;

                default:
                    logger.warn(`Unknown launch_mode: ${launchMode}, using default (both)`);
                    enableTray = true;
                    enableWindow = true;
                    showWindowOnStart = false;
                    reason = 'launch_mode=unknown, fallback to both';
            }
        } else if (modeConfig.trayOnly) {
            enableTray = true;
            enableWindow = false;
            reason = 'mode.trayOnly=true';
        } else if (modeConfig.windowOnly) {
            enableTray = false;
            enableWindow = true;
            showWindowOnStart = true;
            reason = 'mode.windowOnly=true';
        } else {
            enableTray = trayConfig.enabled !== false;
            enableWindow = windowConfig.enabled !== false;
            showWindowOnStart = windowConfig.showOnStart === true;
            reason = 'default configuration';
        }

        const resolved = {
            enableTray,
            enableWindow,
            showWindowOnStart,
            reason
        };

        logger.info(`[ModeResolver] Resolved launch mode: tray=${enableTray}, window=${enableWindow}, showOnStart=${showWindowOnStart} (${reason})`);

        return resolved;
    }

    validate(config) {
        const errors = [];

        if (config.launch_mode && !['tray', 'window', 'both'].includes(config.launch_mode)) {
            errors.push(`Invalid launch_mode: ${config.launch_mode}. Must be 'tray', 'window', or 'both'.`);
        }

        if (config.mode?.trayOnly && config.mode?.windowOnly) {
            errors.push('Cannot set both mode.trayOnly and mode.windowOnly to true');
        }

        if (errors.length > 0) {
            logger.error(`[ModeResolver] Configuration validation failed:`);
            errors.forEach(err => logger.error(`  - ${err}`));
            return false;
        }

        return true;
    }
}

let instance = null;

function getInstance() {
    if (!instance) {
        instance = new ModeResolver();
    }
    return instance;
}

module.exports = {
    getInstance,
    ModeResolver
};
