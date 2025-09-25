#!/usr/bin/env node

/**
 * Gemini MCP Integration Script
 * Handles MCP server configuration integration with Gemini CLI settings.json
 * Ensures ASCII-only output and proper JSON formatting without BOM
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class GeminiMcpIntegrator {
    constructor() {
        this.logPrefix = '[GEMINI_MCP_JS]';
    }

    log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        console.log(`${timestamp} ${this.logPrefix} [${level}] ${message}`);
    }

    error(message) {
        this.log(message, 'ERROR');
    }

    success(message) {
        this.log(message, 'SUCCESS');
    }

    /**
     * Get Gemini CLI settings path
     */
    getGeminiSettingsPath() {
        const possiblePaths = [
            path.join(os.homedir(), '.gemini', 'settings.json'),
            path.join(os.homedir(), '.config', 'gemini', 'settings.json'),
            path.join(process.env.APPDATA || '', 'gemini', 'settings.json')
        ];

        for (const settingsPath of possiblePaths) {
            const dir = path.dirname(settingsPath);
            if (fs.existsSync(dir)) {
                return settingsPath;
            }
        }

        // Default to first path and create directory
        const defaultPath = possiblePaths[0];
        const defaultDir = path.dirname(defaultPath);
        
        try {
            fs.mkdirSync(defaultDir, { recursive: true });
            this.log(`Created Gemini CLI directory: ${defaultDir}`);
            return defaultPath;
        } catch (error) {
            this.error(`Failed to create Gemini CLI directory: ${error.message}`);
            throw error;
        }
    }

    /**
     * Read JSON file safely
     */
    readJsonFile(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                return {};
            }
            
            const content = fs.readFileSync(filePath, 'utf8');
            // Remove BOM if present
            const cleanContent = content.replace(/^\uFEFF/, '');
            return JSON.parse(cleanContent);
        } catch (error) {
            this.error(`Failed to read JSON file ${filePath}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Write JSON file safely without BOM
     */
    writeJsonFile(filePath, data) {
        try {
            const jsonContent = JSON.stringify(data, null, 2);
            // Write without BOM using Buffer to ensure UTF-8 without BOM
            const buffer = Buffer.from(jsonContent, 'utf8');
            fs.writeFileSync(filePath, buffer);
            this.success(`Successfully wrote JSON file: ${filePath}`);
        } catch (error) {
            this.error(`Failed to write JSON file ${filePath}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Integrate MCP configuration with Gemini settings
     */
    integrate(mcpConfigPath) {
        try {
            this.log('Starting Gemini MCP integration');

            // Validate MCP config path
            if (!fs.existsSync(mcpConfigPath)) {
                throw new Error(`MCP configuration file not found: ${mcpConfigPath}`);
            }

            // Read MCP configuration
            const mcpConfig = this.readJsonFile(mcpConfigPath);
            if (!mcpConfig.mcpServers) {
                throw new Error('Invalid MCP configuration: missing mcpServers section');
            }

            // Get Gemini settings path
            const geminiSettingsPath = this.getGeminiSettingsPath();
            this.log(`Target Gemini settings path: ${geminiSettingsPath}`);

            // Read existing Gemini settings or create new
            let geminiSettings = {};
            if (fs.existsSync(geminiSettingsPath)) {
                geminiSettings = this.readJsonFile(geminiSettingsPath);
                this.log('Loaded existing Gemini settings');
            } else {
                this.log('Creating new Gemini settings file');
            }

            // Ensure mcpServers section exists
            if (!geminiSettings.mcpServers) {
                geminiSettings.mcpServers = {};
            }

            // Convert and merge MCP servers
            let mergedCount = 0;
            for (const [serverName, serverConfig] of Object.entries(mcpConfig.mcpServers)) {
                this.log(`Processing MCP server: ${serverName}`);

                // Convert server configuration to Gemini format
                const geminiServerConfig = {};
                
                // Copy all properties from MCP config
                for (const [key, value] of Object.entries(serverConfig)) {
                    geminiServerConfig[key] = value;
                }

                geminiSettings.mcpServers[serverName] = geminiServerConfig;
                mergedCount++;
            }

            // Write updated Gemini settings
            this.writeJsonFile(geminiSettingsPath, geminiSettings);

            this.success(`Successfully integrated ${mergedCount} MCP servers into Gemini CLI`);
            this.success(`Gemini settings updated at: ${geminiSettingsPath}`);

            return true;

        } catch (error) {
            this.error(`Error during Gemini MCP integration: ${error.message}`);
            return false;
        }
    }
}

// Main execution
function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 1) {
        console.error('Usage: node gemini_mcp_integration.js <mcp-config-path>');
        process.exit(1);
    }

    const mcpConfigPath = args[0];
    const integrator = new GeminiMcpIntegrator();
    
    const success = integrator.integrate(mcpConfigPath);
    process.exit(success ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = GeminiMcpIntegrator;
