const http = require('http');
const https = require('https');
const { URL } = require('url');

// GET request using native Node.js http/https
function get(url) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const client = parsedUrl.protocol === 'https:' ? https : http;

        const request = client.get(url, (response) => {
            let data = '';

            response.on('data', (chunk) => {
                data += chunk;
            });

            response.on('end', () => {
                resolve(data);
            });
        });

        request.on('error', (error) => {
            reject(error);
        });
    });
}

// POST request using native Node.js http/https
function post(url, postData) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const client = parsedUrl.protocol === 'https:' ? https : http;

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(JSON.stringify(postData))
            }
        };

        const request = client.request(url, options, (response) => {
            let data = '';

            response.on('data', (chunk) => {
                data += chunk;
            });

            response.on('end', () => {
                resolve(data);
            });
        });

        request.on('error', (error) => {
            reject(error);
        });

        request.write(JSON.stringify(postData));
        request.end();
    });
}

// GET request and parse response as JSON
async function getJson(url) {
    try {
        const data = await get(url);
        return JSON.parse(data);
    } catch (error) {
        console.error('Error getting JSON:', error);
        throw error;
    }
}

// GET request with custom headers
function getWithHeaders(url, headers) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const client = parsedUrl.protocol === 'https:' ? https : http;

        const options = {
            headers: headers
        };

        const request = client.get(url, options, (response) => {
            let data = '';

            response.on('data', (chunk) => {
                data += chunk;
            });

            response.on('end', () => {
                resolve(data);
            });
        });

        request.on('error', (error) => {
            reject(error);
        });
    });
}

module.exports = {
    get,
    post,
    getJson,
    getWithHeaders
};