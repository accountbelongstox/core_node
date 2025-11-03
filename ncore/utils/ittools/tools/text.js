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

class TextTools {
    constructor() {
        this.tools = [
            {
                id: 'text_statistics',
                name: 'Text Statistics',
                description: 'Analyze text for word count, character count, etc.',
                category: 'text',
                icon: 'chart-bar',
                endpoint: '/text/statistics',
                method: 'POST',
                keywords: ['statistics', 'count', 'analysis', 'text']
            },
            {
                id: 'regex_test',
                name: 'Regex Tester',
                description: 'Test regular expressions',
                category: 'text',
                icon: 'sliders',
                endpoint: '/text/regex/test',
                method: 'POST',
                keywords: ['regex', 'pattern', 'regular-expression', 'match']
            }
        ];
    }

    getToolList() {
        return this.tools;
    }

    async execute(toolId, params) {
        switch (toolId) {
            case 'text_statistics':
                return this.textStatistics(params.text);
            case 'regex_test':
                return this.regexTest(params.pattern, params.text, params.flags);
            default:
                throw new Error(`Unknown text tool: ${toolId}`);
        }
    }

    textStatistics(text) {
        if (!text && text !== '') {
            throw new Error('Text is required');
        }

        try {
            const characters = text.length;
            const charactersNoSpaces = text.replace(/\s/g, '').length;
            const words = text.trim() ? text.trim().split(/\s+/).length : 0;
            const lines = text.split(/\r\n|\r|\n/).length;
            const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
            const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;

            const wordArray = text.toLowerCase().match(/\b\w+\b/g) || [];
            const uniqueWords = new Set(wordArray).size;

            const readingTime = Math.ceil(words / 200);

            return {
                characters: characters,
                charactersNoSpaces: charactersNoSpaces,
                words: words,
                lines: lines,
                sentences: sentences,
                paragraphs: paragraphs,
                uniqueWords: uniqueWords,
                readingTimeMinutes: readingTime,
                averageWordLength: words > 0 ? (charactersNoSpaces / words).toFixed(2) : 0
            };
        } catch (error) {
            logger.error(`Text statistics error: ${error.message}`);
            throw new Error(`Failed to analyze text: ${error.message}`);
        }
    }

    regexTest(pattern, text, flags = 'g') {
        if (!pattern) {
            throw new Error('Pattern is required');
        }

        if (!text && text !== '') {
            throw new Error('Text is required');
        }

        try {
            const regex = new RegExp(pattern, flags || '');
            const matches = [];
            let match = null;

            if (flags && flags.includes('g')) {
                while ((match = regex.exec(text)) !== null) {
                    matches.push({
                        match: match[0],
                        index: match.index,
                        groups: match.slice(1)
                    });

                    if (matches.length > 1000) {
                        break;
                    }
                }
            } else {
                match = regex.exec(text);
                if (match) {
                    matches.push({
                        match: match[0],
                        index: match.index,
                        groups: match.slice(1)
                    });
                }
            }

            const isMatch = matches.length > 0;

            return {
                isMatch: isMatch,
                matches: matches,
                matchCount: matches.length,
                pattern: pattern,
                flags: flags || ''
            };
        } catch (error) {
            logger.error(`Regex test error: ${error.message}`);
            throw new Error(`Invalid regex pattern: ${error.message}`);
        }
    }
}

module.exports = TextTools;
