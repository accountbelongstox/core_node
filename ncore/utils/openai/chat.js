const https = require('https');
const config = require('./config/index.js');
const { getModuleSplitPrompt } = require('./prompts/moduleSplit.js');
const { getConversionPrompt } = require('./prompts/codeConversion.js');
const { wrapPromptWithJsonFormat } = require('./utils/promptWrapper.js');
const logger = require('#@logger');

function getExamplePrompt() {
    const splitPrompt = getModuleSplitPrompt();
    const conversionPrompt = getConversionPrompt();
    logger.info('Example prompts generated');
    console.log(splitPrompt);
    console.log(conversionPrompt);
    return {
        splitPrompt,
        conversionPrompt
    };
}


const options = {
    hostname: `${config.hostname}`,
    path: config.basePath + config.completionsPath,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.o_secret}`
    },
    timeout: config.timeout
}

/**
 * Stream chat with OpenAI API
 * @param {string} prompt - The prompt to send to OpenAI
 * @param {boolean} printResult - Whether to print the result
 * @returns {Promise<string>} The complete response text
 */
async function streamChat(prompt, printResult = true) {
    prompt = wrapPromptWithJsonFormat(prompt);
    const data = {
        model: config.defaultModel,
        messages: [{ role: "user", content: prompt }],
        stream: true
    };

    return new Promise((resolve, reject) => {
        let fullText = '';

        const req = https.request(options, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP Error: ${res.statusCode}`));
                return;
            }

            res.on('data', (chunk) => {
                try {
                    const lines = chunk.toString().split('\n');
                    for (const line of lines) {
                        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                            const jsonData = JSON.parse(line.replace('data: ', ''));
                            const content = jsonData.choices[0]?.delta?.content;
                            if (content) {
                                fullText += content;
                                if (printResult) {
                                    logger.info(content);
                                };
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error processing chunk:', error);
                }
            });

            res.on('end', () => {
                resolve(fullText);
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(JSON.stringify(data));
        req.end();
    });
}

module.exports = {
    streamChat,
    getExamplePrompt
}; 