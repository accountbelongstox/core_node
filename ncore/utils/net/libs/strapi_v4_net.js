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

const path = require('path');
    const fs = require('fs');
    const axios = require('axios');
    const Base = require('#@base');
    const { getEnvValue } = require('#@baseTool');
    const { env } = require('#@global_vars');

    const __filename = __filename;
    const __dirname = path.dirname(__filename);

    class StrapiV4Net extends Base {
        constructor(cunstom_env) {
            super();
            process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
            if (!cunstom_env) cunstom_env = env;
            this.apiUrl = getEnvValue(cunstom_env, 'STRAPI_URL', 'https://localhost:1337');
            this.publicToken = getEnvValue(cunstom_env, 'STRAPI_TOKEN', null);
            console.log(`apiUrl`, this.apiUrl);
            console.log(`publicToken`, this.publicToken);
            this.privateToken = this.loadTokenFromCache() || null;
        }

        loadTokenFromCache() {
            const cacheFilePath = path.join(__dirname, 'strapi_jwt_cache.json');
            if (fs.existsSync(cacheFilePath)) {
                const tokenData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf-8'));
                return tokenData;
            }
            return null;
        }

        saveTokenToCache(tokenData) {
            const cacheFilePath = path.join(__dirname, 'strapi_jwt_cache.json');
            fs.writeFileSync(cacheFilePath, JSON.stringify(tokenData, null, 2));
        }

        getAuthorizationHeader() {
            if (this.privateToken) {
                return `Bearer ${this.privateToken.jwt}`;
            } else if (this.publicToken) {
                return `Bearer ${this.publicToken}`;
            }
            return null;
        }

        async fetchData(endpoint, params = {}) {
            const url = `${this.apiUrl}/api/${endpoint}`;
            console.log(`apiUrl-fetchData: ${url}`)
            try {
                const headers = { 'Content-Type': 'application/json' };
                const authHeader = this.getAuthorizationHeader();
                if (authHeader) headers['Authorization'] = authHeader;

                const response = await axios.get(url, { headers, params });
                return response.data;
            } catch (error) {
                this.printError(error,url)
                return null;
            }
        }

        async pushData(endpoint, data) {
            const url = `${this.apiUrl}/api/${endpoint}`;
            console.log(`apiUrl-pushData: ${url}`)
            try {
                const headers = { 'Content-Type': 'application/json' };
                const authHeader = this.getAuthorizationHeader();
                if (authHeader) headers['Authorization'] = authHeader;
                const response = await axios.post(url, data, { headers });
                return response.data;
            } catch (error) {
                this.printError(error,url)
                return null;
            }
        }

        printError(error,url){
            console.error(`\nError:`);
            console.error(`----------------${url}------------------`);
            console.error('data:', error.response?.data);
            console.error('code:', error.code);
            console.error('response-simple:', {
                status: error.response?.status,
                statusText: error.response?.statusText,
                configData: error.response?.config?.data ? error.response.config.data.substring(0, 100) : ''
            });
            console.error(`-----------------------------------------\n`);
        }

        async deleteData(endpoint, params = {}) {
            try {
                const url = `${this.apiUrl}/api/${endpoint}`;
                const headers = { 'Content-Type': 'application/json' };
                const authHeader = this.getAuthorizationHeader();
                if (authHeader) headers['Authorization'] = authHeader;

                const response = await axios.delete(url, { headers, params });
                return response.data;
            } catch (error) {
                console.error('Error deleting data:', error);
                throw error;
            }
        }

        async updateData(endpoint, data) {
            try {
                const url = `${this.apiUrl}/api/${endpoint}`;
                const headers = { 'Content-Type': 'application/json' };
                const authHeader = this.getAuthorizationHeader();
                if (authHeader) headers['Authorization'] = authHeader;

                const response = await axios.put(url, data, { headers });
                return response.data;
            } catch (error) {
                console.error('Error updating data:', error);
                throw error;
            }
        }

        async login(identifier, password) {
            try {
                const url = `${this.apiUrl}/api/auth/local`;
                const response = await axios.post(url, {
                    identifier,
                    password,
                });
                const tokenData = response.data;
                this.privateToken = tokenData;
                this.saveTokenToCache(tokenData);
                return tokenData;
            } catch (error) {
                console.error('Error during login:', error);
                throw error;
            }
        }

        async register(username, email, password) {
            try {
                const url = `${this.apiUrl}/api/auth/local/register`;
                const response = await axios.post(url, {
                    username,
                    email,
                    password,
                });
                return response.data;
            } catch (error) {
                console.error('Error during registration:', error);
                throw error;
            }
        }

        async getJwt() {
            return this.privateToken?.jwt || this.publicToken || null;
        }

        async testUrlExists(url) {
            try {
                const response = await axios.head(url);
                return response.status === 200;
            } catch (error) {
                console.error('Error testing URL:', error);
                return false;
            }
        }

        async testEndpointExists(endpoint) {
            const url = `${this.apiUrl}/api/${endpoint}`;
            return await this.testUrlExists(url);
        }
    }

    module.exports = new StrapiV4Net();