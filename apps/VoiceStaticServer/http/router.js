import { RouterBase } from '#@ncore/utils/http/libs/RouterBase.js';
import { logger } from '#@utils';

class VoiceRouter extends RouterBase {
    initializeRoutes() {
        // Service status endpoint
        this.addGet('/status', async () => ({
            status: 'ok',
            service: 'voice'
        }));

        // Voice processing endpoint
        this.addPost('/process', async (req) => {
            logger.info('Processing voice request');
            return { processed: true };
        });

        // Mount router to application
        this.mount('/api/voice');
    }
}

// Export router instance
export default new VoiceRouter(); 