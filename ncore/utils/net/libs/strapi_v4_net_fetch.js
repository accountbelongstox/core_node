// const https = require('https');
    // const http = require('http');
    const path = require('path');
    const fs = require('fs');
    const Base = require('#@base');
    const { getEnvValue } = require('#@baseTool');
    const { env } = require('#@globalvars');

    const __filename = __filename;
    const __dirname = path.dirname(__filename);

    class StrapiV4Net extends Base {
        constructor(cunstom_env) {
            super();
            if (!cunstom_env) cunstom_env = env;
            this.apiUrl = getEnvValue(cunstom_env, 'STRAPI_URL', 'https://localhost:1337');
            console.log(`this.apiUrl`, this.apiUrl, cunstom_env);
            this.publicToken = getEnvValue(cunstom_env, 'PUBLIC_TOKEN', null);
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
            try {
                const url = new URL(`${this.apiUrl}/api/${endpoint}`);
                Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

                const headers = {
                    'Content-Type': 'application/json'
                };
                const authHeader = this.getAuthorizationHeader();
                if (authHeader) {
                    headers['Authorization'] = authHeader;
                }

                const response = await fetch(url, { method: 'GET', headers });
                if (!response.ok) {
                    throw new Error(`Error fetching data: ${response.statusText}`);
                }
                return await response.json();
            } catch (error) {
                console.error('Error fetching data:', error);
                throw error;
            }
        }

        async pushData(endpoint, data) {
            try {
                const url = `${this.apiUrl}/api/${endpoint}`;
                const headers = {
                    'Content-Type': 'application/json'
                };
                const authHeader = this.getAuthorizationHeader();
                if (authHeader) {
                    headers['Authorization'] = authHeader;
                }

                const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(data) });
                if (!response.ok) {
                    throw new Error(`Error pushing data: ${response.statusText}`);
                }
                return await response.json();
            } catch (error) {
                console.error('Error pushing data:', error);
                throw error;
            }
        }

        async deleteData(endpoint, params = {}) {
            try {
                const url = new URL(`${this.apiUrl}/api/${endpoint}`);
                Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

                const headers = {
                    'Content-Type': 'application/json'
                };
                const authHeader = this.getAuthorizationHeader();
                if (authHeader) {
                    headers['Authorization'] = authHeader;
                }

                const response = await fetch(url, { method: 'DELETE', headers });
                if (!response.ok) {
                    throw new Error(`Error deleting data: ${response.statusText}`);
                }
                return await response.json();
            } catch (error) {
                console.error('Error deleting data:', error);
                throw error;
            }
        }

        async updateData(endpoint, data) {
            try {
                const url = `${this.apiUrl}/api/${endpoint}`;
                const headers = {
                    'Content-Type': 'application/json'
                };
                const authHeader = this.getAuthorizationHeader();
                if (authHeader) {
                    headers['Authorization'] = authHeader;
                }

                const response = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(data) });
                if (!response.ok) {
                    throw new Error(`Error updating data: ${response.statusText}`);
                }
                return await response.json();
            } catch (error) {
                console.error('Error updating data:', error);
                throw error;
            }
        }

        async login(identifier, password) {
            try {
                const url = `${this.apiUrl}/auth/local`;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ identifier, password })
                });

                if (!response.ok) {
                    throw new Error(`Error during login: ${response.statusText}`);
                }

                const tokenData = await response.json();
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
                const url = `${this.apiUrl}/auth/local/register`;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, email, password })
                });

                if (!response.ok) {
                    throw new Error(`Error during registration: ${response.statusText}`);
                }

                return await response.json();
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
                const response = await fetch(url, { method: 'HEAD' });
                return response.ok;
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