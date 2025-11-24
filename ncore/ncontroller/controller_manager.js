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
const { documentController } = require('./controllers/document_controller');
const { deepseekChatController } = require('./controllers/deepseek_chat_controller');

class ControllerManager {
    constructor() {
        this.controllers = new Map();
        this.initialized = false;
    }

    async initialize() {
        logger.info('[ControllerManager] Initializing...');

        this.registerController(documentController);
        this.registerController(deepseekChatController);

        for (const controller of this.controllers.values()) {
            if (controller.initialize) {
                await controller.initialize();
            }
        }

        this.initialized = true;
        logger.success('[ControllerManager] All controllers initialized');
    }

    registerController(controller) {
        const name = controller.getName();
        if (this.controllers.has(name)) {
            logger.warn(`[ControllerManager] Controller '${name}' already registered`);
            return false;
        }

        this.controllers.set(name, controller);
        logger.info(`[ControllerManager] Registered controller: ${name}`);
        return true;
    }

    getController(name) {
        return this.controllers.get(name);
    }

    getAllControllers() {
        return Array.from(this.controllers.values());
    }

    getStatus() {
        const status = {
            initialized: this.initialized,
            controllers: {}
        };

        for (const [name, controller] of this.controllers) {
            status.controllers[name] = controller.getStatus ? controller.getStatus() : { name };
        }

        return status;
    }

    async shutdown() {
        logger.info('[ControllerManager] Shutting down all controllers...');

        for (const controller of this.controllers.values()) {
            if (controller.close) {
                try {
                    await controller.close();
                } catch (error) {
                    logger.error(`[ControllerManager] Error closing controller:`, error.message);
                }
            }
        }

        logger.success('[ControllerManager] All controllers shut down');
    }
}

const controllerManager = new ControllerManager();

module.exports = {
    ControllerManager,
    controllerManager
};
