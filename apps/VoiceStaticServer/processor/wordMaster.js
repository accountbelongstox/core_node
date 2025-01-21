const logger = require('#@logger');
const { IS_SERVER, IS_CLIENT, initializeWatcher, ROLE, } = require('../provider/index');
const { addWordBack, getWordCount, getWordFront } = require('../provider/QueueManager.js');
const { initialize_server, startWordProcessingByServer, } = require('./tools/server_initial_words ');
const { checkAllWordValidityWithOpenAI } = require('./tools/server_initial_valid');
const { initialize_not_client } = require('./tools/not_client');
const { startInputOldDataTranslate } = require('./tools/server_initial_trans_input');
const { startInputProcessOldDataTranslate } = require('./tools/server_initial_process_trans_input');
const { initialize_client, startWordProcessingByClient } = require('./tools/client');
const { serverTest } = require('./tools/server_test');
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
                // await checkAllWordValidityWithOpenAI();
                await startInputProcessOldDataTranslate();
                // await startInputOldDataTranslate();
                // await serverTest();
                
                // await initialize_server();
                // logger.success(`Role:${ROLE} initialize server success`);
                // startWordProcessingByServer();
            } else if (IS_CLIENT) {
                logger.success(`Role:${ROLE} initialize client..`);
                await initialize_client();
                logger.success(`Role:${ROLE} initialize client success`);
                startWordProcessingByClient();
            } else {
                logger.success(`Role:${ROLE} initialize not_client..`);
                await initialize_not_client();
                logger.success(`Role:${ROLE} initialize not_client success`);
                // startWordProcessingByNotClient();
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

