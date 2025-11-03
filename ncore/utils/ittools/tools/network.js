// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

'use strict';

const logger = require('#@logger');

class NetworkTools {
    constructor() {
        this.tools = [
            {
                id: 'ipv4_convert',
                name: 'IPv4 Converter',
                description: 'Convert IPv4 address formats',
                category: 'network',
                icon: 'network',
                endpoint: '/network/ipv4/convert',
                method: 'POST',
                keywords: ['ipv4', 'ip', 'network', 'address']
            }
        ];
    }

    getToolList() {
        return this.tools;
    }

    async execute(toolId, params) {
        switch (toolId) {
            case 'ipv4_convert':
                return this.ipv4Convert(params.ip, params.format);
            default:
                throw new Error(`Unknown network tool: ${toolId}`);
        }
    }

    ipv4Convert(ip, format) {
        if (!ip) {
            throw new Error('IP address is required');
        }

        if (!format || !['decimal', 'binary', 'hex'].includes(format)) {
            throw new Error('Format must be one of: decimal, binary, hex');
        }

        try {
            const octets = ip.split('.');

            if (octets.length !== 4) {
                throw new Error('Invalid IPv4 address format');
            }

            const numbers = octets.map(octet => {
                const num = parseInt(octet, 10);
                if (isNaN(num) || num < 0 || num > 255) {
                    throw new Error(`Invalid octet value: ${octet}`);
                }
                return num;
            });

            let converted = null;

            if (format === 'decimal') {
                const decimal = (numbers[0] << 24) + (numbers[1] << 16) + (numbers[2] << 8) + numbers[3];
                converted = decimal >>> 0;
            } else if (format === 'binary') {
                converted = numbers.map(num => num.toString(2).padStart(8, '0')).join('.');
            } else if (format === 'hex') {
                converted = '0x' + numbers.map(num => num.toString(16).padStart(2, '0')).join('');
            }

            return {
                original: ip,
                format: format,
                converted: converted,
                octets: numbers
            };
        } catch (error) {
            logger.error(`IPv4 convert error: ${error.message}`);
            throw new Error(`Failed to convert IPv4: ${error.message}`);
        }
    }
}

module.exports = NetworkTools;
