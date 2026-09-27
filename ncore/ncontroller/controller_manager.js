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
