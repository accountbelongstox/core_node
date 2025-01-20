const logger = require('#@logger');
// const { streamChat } = require('#@/ncore/utils/openai/chat.js');
const { smartDelayForEach } = require('#@/ncore/utils/tool/libs/arrtool.js');
const { get7zExecutable } = require('#@/ncore/gvar/bdir.js');


async function testLoggerWarnInterval() {
    const messages = [
        'Database connection timeout',
        'Memory usage exceeds threshold',
        'High CPU load detected',
        'Network latency is high',
        'Cache miss rate increasing'
    ];

    let counter = 0;
    const intervalId = setInterval(() => {
        const messageIndex = counter % messages.length;
        const currentMessage = `Warning ${counter + 1}: ${messages[messageIndex]}`;
        logger.warn(currentMessage);
        
        counter++;
        if (counter >= 40000) {
            clearInterval(intervalId);
            logger.info('Logger warn interval test completed');
        }
    }, 200); // Send warning every 200ms
}

async function serverTest() {
    const exe = await get7zExecutable();
    logger.info(`7z executable: ${exe}`);
}

module.exports = {
    serverTest,
};
