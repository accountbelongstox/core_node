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

class WebTools {
    constructor() {
        this.tools = [
            {
                id: 'json_prettify',
                name: 'JSON Prettify',
                description: 'Format and prettify JSON',
                category: 'web',
                icon: 'align-left',
                endpoint: '/web/json/prettify',
                method: 'POST',
                keywords: ['json', 'format', 'prettify', 'indent']
            },
            {
                id: 'json_minify',
                name: 'JSON Minify',
                description: 'Minify JSON by removing whitespace',
                category: 'web',
                icon: 'compress',
                endpoint: '/web/json/minify',
                method: 'POST',
                keywords: ['json', 'minify', 'compress', 'reduce']
            }
        ];
    }

    getToolList() {
        return this.tools;
    }

    async execute(toolId, params) {
        switch (toolId) {
            case 'json_prettify':
                return this.jsonPrettify(params.json, params.indent);
            case 'json_minify':
                return this.jsonMinify(params.json);
            default:
                throw new Error(`Unknown web tool: ${toolId}`);
        }
    }

    jsonPrettify(jsonString, indent = 2) {
        if (!jsonString) {
            throw new Error('JSON string is required');
        }

        const indentValue = parseInt(indent) || 2;

        if (indentValue < 1 || indentValue > 8) {
            throw new Error('Indent must be between 1 and 8');
        }

        try {
            const parsed = JSON.parse(jsonString);
            const formatted = JSON.stringify(parsed, null, indentValue);

            return {
                formatted: formatted,
                originalLength: jsonString.length,
                formattedLength: formatted.length,
                indent: indentValue
            };
        } catch (error) {
            logger.error(`JSON prettify error: ${error.message}`);
            throw new Error(`Invalid JSON: ${error.message}`);
        }
    }

    jsonMinify(jsonString) {
        if (!jsonString) {
            throw new Error('JSON string is required');
        }

        try {
            const parsed = JSON.parse(jsonString);
            const minified = JSON.stringify(parsed);

            return {
                minified: minified,
                originalLength: jsonString.length,
                minifiedLength: minified.length,
                saved: jsonString.length - minified.length
            };
        } catch (error) {
            logger.error(`JSON minify error: ${error.message}`);
            throw new Error(`Invalid JSON: ${error.message}`);
        }
    }
}

module.exports = WebTools;
