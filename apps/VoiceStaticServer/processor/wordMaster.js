const logger = require('#@/ncore/utils/logger/index.js');
const { IS_SERVER, IS_CLIENT, initializeWatcher, ROLE, } = require('../provider/index');
const { addWordBack, getWordCount, getWordFront } = require('../provider/QueueManager.js');
const { initialize_server,} = require('./tools/server');
const { initialize_not_client } = require('./tools/not_client');
const { initialize_client } = require('./tools/client');
class DictInitController {
    constructor() {
        this.isProcessing = false;
    }

    async start() {
        logger.success(`Role:${ROLE} initialize watcher..`);
        await initializeWatcher();
        logger.success(`Role:${ROLE} initialize watcher success`);
        try {
            if (IS_SERVER) {
                logger.success(`Role:${ROLE} initialize server..`);
                await initialize_server();
                logger.success(`Role:${ROLE} initialize server success`);
                //     startWordProcessingByServer();
            } else if (IS_CLIENT) {
                logger.success(`Role:${ROLE} initialize client..`);
                await initialize_client();
                logger.success(`Role:${ROLE} initialize client success`);
                //     startWordProcessingByClient();
            } else {
                logger.success(`Role:${ROLE} initialize not_client..`);
                await initialize_not_client();
                logger.success(`Role:${ROLE} initialize not_client success`);
                //     startWordProcessingByNotClient();
            }
        } catch (error) {
            logger.error('Error initializing dictionary:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}


module.exports = new DictInitController();

