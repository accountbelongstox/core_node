const https = require('https');
const http = require('http');
const url = require('url');
const { sub_github_config_url, sub_remote_url1, sub_remote_url2 } = require('../provider/global_var');
const logger = require('./log_utils');
const {getConfigValue} = require('./config_utils');

// Define the HTTP and HTTPS agents for mimicking browser behavior
const agentOptions = {
    keepAlive: true,
    timeout: 200,
    rejectUnauthorized: false
};

// Determine if URL is HTTPS or HTTP
function isHttpsUrl(url) {
    return url.startsWith('https://');
}

// Send GET request using either HTTP or HTTPS
function sendGetRequest(url) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const options = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            ...agentOptions
        };

        const protocol = isHttpsUrl(url) ? https : http;

        const req = protocol.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data);
                } else {
                    reject(new Error(`Request failed with status code ${res.statusCode}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.end();
    });
}

async function generateApiUrls(apiUrl) {
    const sub2ClashLocalUrl =  getConfigValue(`sub2ClashLocalUrl`);
    //api https://github.com/nitezs/sub2clash/blob/main/API.md
    const subRemoteUrl1 =  getConfigValue(`subRemoteUrl1`);
    const subRemoteUrl2 =  getConfigValue(`subRemoteUrl2`);

    const subRemoteGitConfigUrl =  getConfigValue(`subRemoteGitConfigUrl`);
    const subRemoteGitTemplateUrl =  getConfigValue(`subRemoteGitTemplateUrl`);


    const encodedUrl = encodeURIComponent(apiUrl);
    const encodedConfigUrl = encodeURIComponent(subRemoteGitConfigUrl);
    const encodedTemplateUrl = encodeURIComponent(subRemoteGitTemplateUrl);

    const sub2ClashLocalSubscribeUrl = `${sub2ClashLocalUrl}/clash?sub=${encodedUrl}`; //&template=${encodedTemplateUrl}
    const subRemoteSubscribeUrl1 = `${subRemoteUrl1}${encodedUrl}&insert=false&config=${encodedConfigUrl}&emoji=true&list=false&xudp=false&udp=false&tfo=false&expand=true&scv=false&fdn=false&new_name=true`;
    return [sub2ClashLocalSubscribeUrl, subRemoteSubscribeUrl1];
}

function isValidContent(content) {
    content = content ? content.trim() : null;
    if (!content) {
        return false;
    }
    const invalidKeywords = ["The following link doesn't contain any valid node info"];
    return !invalidKeywords.some(keyword => content.includes(keyword));
}

// Example usage
if (require.main === module) {
    (async () => {
        try {
            const url = "https://example.com";
            const response = await sendGetRequest(url);
            logger.log("Response: " + response);
        } catch (e) {
            logger.log("Error: " + e.message);
        }
    })();
}

module.exports = {
    sendGetRequest,
    generateApiUrls,
    isValidContent
};