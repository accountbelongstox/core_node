const path = require('path');
const https = require('https');
const config_index = require('./config/index.js');
console.log(config_index)
const config = require('./config/open_config');
const { api } = config;

const options = {
    hostname: api.hostname,
    path: api.getFullPath(api.completionsPath),
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.getApiKey()}`
    },
    timeout: api.timeout
};
console.log(options);

class OpenAIChat {
    constructor() {
    }

    async streamChat(prompt, onDataCallback = console.log,printResult = true) {

        const data = {
            model: api.defaultModel,
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
                                    if(printResult) onDataCallback(content);
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
}

module.exports = OpenAIChat; 