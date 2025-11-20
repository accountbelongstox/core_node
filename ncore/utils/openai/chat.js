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