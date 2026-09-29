const logger = require('#@logger');
const { arrtool } = require('#@btools');
const { IS_SERVER, IS_CLIENT, ROLE, } = require('../provider/constants/StaticData.js');
const { initialize_server, initialize_by_api } = require('./server_init_words.js');
const { checkAllWordValidityWithOpenAI } = require('./server_init_valid.js');
const { initialize_not_client } = require('./not_client.js');
const { startHistoryTrans, readCacheTransDataFromDB } = require('./server_historytrans.js');
const { startOldDbInput } = require('./server_init_olddb.js');
const { initialize_client, startWordProcessingByClient } = require('./client_start.js');
const { serverTest } = require('./server_test.js');
const { OldDirProviderMigrate } = require('./server_migrate.js');
const { start_check_voice } = require('./server_voice_load.js');
const { start_load_static } = require('./server_static_load.js');
const scheduler = require('#@/ncore/utils/schedule.js');

class DictInitController {
    constructor() {
        this.isProcessing = false;
    }

    async start() {
        try {
            await OldDirProviderMigrate();
            if (IS_SERVER) {
                logger.success(`Role:${ROLE} initialize server..`);
                await startOldDbInput();
                await startHistoryTrans();
                await initialize_server();
                await start_load_static();
                // await start_check_voice();
                scheduler.addIntervalTask('start_check_voice', initialize_by_api, 360000, {
                    firstRun: true
                });
                logger.success(`Role:${ROLE} initialize server success`);
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
