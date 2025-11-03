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
                description: 'Analyze text for word count, character count, reading time, etc.',
                category: 'text',
                icon: 'chart-bar',
                endpoint: '/text/statistics',
                method: 'POST',
                keywords: ['statistics', 'count', 'analysis', 'text', 'words', 'characters']
            },
            {
                id: 'regex_tester',
                name: 'Regex Tester',
                description: 'Test and debug regular expressions',
                category: 'text',
                icon: 'sliders',
                endpoint: '/text/regex/test',
                method: 'POST',
                keywords: ['regex', 'pattern', 'regular-expression', 'match', 'test']
            },
            {
                id: 'lorem_ipsum_generator',
                name: 'Lorem Ipsum Generator',
                description: 'Generate Lorem Ipsum placeholder text',
                category: 'text',
                icon: 'paragraph',
                endpoint: '/text/lorem',
                method: 'POST',
                keywords: ['lorem', 'ipsum', 'placeholder', 'dummy', 'text']
            },
            {
                id: 'text_diff',
                name: 'Text Diff',
                description: 'Compare two texts and show differences',
                category: 'text',
                icon: 'code-compare',
                endpoint: '/text/diff',
                method: 'POST',
                keywords: ['diff', 'compare', 'difference', 'text', 'merge']
            },
            {
                id: 'markdown_preview',
                name: 'Markdown Preview',
                description: 'Preview Markdown with live rendering',
                category: 'text',
                icon: 'markdown',
                endpoint: '/text/markdown/preview',
                method: 'POST',
                keywords: ['markdown', 'preview', 'render', 'html']
            },
            {
                id: 'string_obfuscator',
                name: 'String Obfuscator',
                description: 'Obfuscate strings for security',
                category: 'text',
                icon: 'shield',
                endpoint: '/text/obfuscate',
                method: 'POST',
                keywords: ['obfuscate', 'encode', 'security', 'hide', 'string']
            },
            {
                id: 'text_to_ascii',
                name: 'Text to ASCII Art',
                description: 'Convert text to ASCII art',
                category: 'text',
                icon: 'font',
                endpoint: '/text/ascii',
                method: 'POST',
                keywords: ['ascii', 'art', 'text', 'banner', 'convert']
            },
            {
                id: 'emoji_picker',
                name: 'Emoji Picker',
                description: 'Search and copy emojis',
                category: 'text',
                icon: 'smile',
                endpoint: '/text/emoji',
                method: 'POST',
                keywords: ['emoji', 'picker', 'unicode', 'emoticon']
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
            case 'regex_tester':
                return this.regexTester(params.pattern, params.text, params.flags);
            case 'lorem_ipsum_generator':
                return this.loremIpsumGenerator(params.paragraphs, params.words);
            case 'text_diff':
                return this.textDiff(params.text1, params.text2);
            case 'markdown_preview':
                return this.markdownPreview(params.markdown);
            case 'string_obfuscator':
                return this.stringObfuscator(params.text, params.method);
            case 'text_to_ascii':
                return this.textToAscii(params.text, params.font);
            case 'emoji_picker':
                return this.emojiPicker(params.search);
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
            const speakingTime = Math.ceil(words / 130);

            const letterCounts = {};
            for (const char of text.toLowerCase()) {
                if (/[a-z]/.test(char)) {
                    letterCounts[char] = (letterCounts[char] || 0) + 1;
                }
            }

            return {
                characters: characters,
                charactersNoSpaces: charactersNoSpaces,
                words: words,
                lines: lines,
                sentences: sentences,
                paragraphs: paragraphs,
                uniqueWords: uniqueWords,
                readingTimeMinutes: readingTime,
                speakingTimeMinutes: speakingTime,
                averageWordLength: words > 0 ? (charactersNoSpaces / words).toFixed(2) : 0,
                letterFrequency: letterCounts
            };
        } catch (error) {
            logger.error(`Text statistics error: ${error.message}`);
            throw new Error(`Failed to analyze text: ${error.message}`);
        }
    }

    regexTester(pattern, text, flags = 'g') {
        if (!pattern) {
            throw new Error('Pattern is required');
        }
        if (!text && text !== '') {
            throw new Error('Text is required');
        }

        try {
            const regex = new RegExp(pattern, flags);
            const matches = [];
            let match;

            if (flags.includes('g')) {
                while ((match = regex.exec(text)) !== null) {
                    matches.push({
                        match: match[0],
                        index: match.index,
                        groups: match.slice(1)
                    });
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

            return {
                matches: matches,
                count: matches.length,
                pattern: pattern,
                flags: flags,
                isValid: true
            };
        } catch (error) {
            logger.error(`Regex test error: ${error.message}`);
            return {
                matches: [],
                count: 0,
                pattern: pattern,
                flags: flags,
                isValid: false,
                error: error.message
            };
        }
    }

    loremIpsumGenerator(paragraphs = 3, wordsPerParagraph = 50) {
        const loremWords = [
            'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
            'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
            'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud',
            'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo',
            'consequat', 'duis', 'aute', 'irure', 'in', 'reprehenderit', 'voluptate',
            'velit', 'esse', 'cillum', 'fugiat', 'nulla', 'pariatur', 'excepteur',
            'sint', 'occaecat', 'cupidatat', 'non', 'proident', 'sunt', 'culpa', 'qui',
            'officia', 'deserunt', 'mollit', 'anim', 'id', 'est', 'laborum'
        ];

        try {
            const paragraphCount = parseInt(paragraphs) || 3;
            const wordsCount = parseInt(wordsPerParagraph) || 50;
            const result = [];

            for (let p = 0; p < paragraphCount; p++) {
                const words = [];
                for (let w = 0; w < wordsCount; w++) {
                    const word = loremWords[Math.floor(Math.random() * loremWords.length)];
                    words.push(w === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word);
                }
                result.push(words.join(' ') + '.');
            }

            const text = result.join('\n\n');

            return {
                text: text,
                paragraphs: paragraphCount,
                words: paragraphCount * wordsCount,
                characters: text.length
            };
        } catch (error) {
            logger.error(`Lorem ipsum generation error: ${error.message}`);
            throw new Error(`Failed to generate lorem ipsum: ${error.message}`);
        }
    }

    textDiff(text1, text2) {
        if (!text1 || !text2) {
            throw new Error('Both texts are required');
        }

        try {
            const lines1 = text1.split('\n');
            const lines2 = text2.split('\n');
            const differences = [];

            const maxLength = Math.max(lines1.length, lines2.length);

            for (let i = 0; i < maxLength; i++) {
                const line1 = lines1[i] || '';
                const line2 = lines2[i] || '';

                if (line1 !== line2) {
                    differences.push({
                        lineNumber: i + 1,
                        type: !line1 ? 'added' : !line2 ? 'removed' : 'changed',
                        from: line1,
                        to: line2
                    });
                }
            }

            return {
                differences: differences,
                count: differences.length,
                identical: differences.length === 0,
                linesAdded: differences.filter(d => d.type === 'added').length,
                linesRemoved: differences.filter(d => d.type === 'removed').length,
                linesChanged: differences.filter(d => d.type === 'changed').length
            };
        } catch (error) {
            logger.error(`Text diff error: ${error.message}`);
            throw new Error(`Failed to compare texts: ${error.message}`);
        }
    }

    markdownPreview(markdown) {
        if (!markdown) {
            throw new Error('Markdown is required');
        }

        try {
            const marked = require('marked');
            const html = marked.parse(markdown);

            return {
                html: html,
                markdown: markdown,
                length: html.length
            };
        } catch (error) {
            logger.error(`Markdown preview error: ${error.message}`);
            throw new Error(`Failed to preview markdown: ${error.message}`);
        }
    }

    stringObfuscator(text, method = 'base64') {
        if (!text) {
            throw new Error('Text is required');
        }

        try {
            let obfuscated;

            switch (method.toLowerCase()) {
                case 'base64':
                    obfuscated = Buffer.from(text).toString('base64');
                    break;
                case 'hex':
                    obfuscated = Buffer.from(text).toString('hex');
                    break;
                case 'reverse':
                    obfuscated = text.split('').reverse().join('');
                    break;
                case 'rot13':
                    obfuscated = text.replace(/[a-zA-Z]/g, char => {
                        const start = char <= 'Z' ? 65 : 97;
                        return String.fromCharCode(start + (char.charCodeAt(0) - start + 13) % 26);
                    });
                    break;
                default:
                    throw new Error('Invalid obfuscation method');
            }

            return {
                obfuscated: obfuscated,
                method: method,
                originalLength: text.length,
                obfuscatedLength: obfuscated.length
            };
        } catch (error) {
            logger.error(`String obfuscation error: ${error.message}`);
            throw new Error(`Failed to obfuscate string: ${error.message}`);
        }
    }

    textToAscii(text, font = 'standard') {
        if (!text) {
            throw new Error('Text is required');
        }

        try {
            const asciiArt = [];
            const chars = text.toUpperCase().split('');

            for (const char of chars) {
                if (char === ' ') {
                    asciiArt.push('   ');
                } else if (/[A-Z]/.test(char)) {
                    asciiArt.push(`[${char}]`);
                } else if (/[0-9]/.test(char)) {
                    asciiArt.push(`(${char})`);
                } else {
                    asciiArt.push(` ${char} `);
                }
            }

            return {
                ascii: asciiArt.join(' '),
                original: text,
                font: font,
                note: 'For full ASCII art support, consider using the figlet library'
            };
        } catch (error) {
            logger.error(`ASCII art error: ${error.message}`);
            throw new Error(`Failed to convert to ASCII art: ${error.message}`);
        }
    }

    emojiPicker(search = '') {
        const emojis = {
            'smile': '😊',
            'laugh': '😂',
            'heart': '❤️',
            'fire': '🔥',
            'star': '⭐',
            'check': '✅',
            'cross': '❌',
            'warning': '⚠️',
            'info': 'ℹ️',
            'rocket': '🚀',
            'thumbs': '👍',
            'clap': '👏',
            'party': '🎉',
            'gift': '🎁',
            'coffee': '☕',
            'pizza': '🍕',
            'beer': '🍺',
            'music': '🎵',
            'camera': '📷',
            'phone': '📱',
            'computer': '💻',
            'email': '📧',
            'lock': '🔒',
            'key': '🔑',
            'light': '💡',
            'flag': '🚩'
        };

        try {
            const searchLower = search.toLowerCase();
            const filtered = {};

            for (const [key, value] of Object.entries(emojis)) {
                if (!search || key.includes(searchLower)) {
                    filtered[key] = value;
                }
            }

            return {
                emojis: filtered,
                count: Object.keys(filtered).length,
                search: search
            };
        } catch (error) {
            logger.error(`Emoji picker error: ${error.message}`);
            throw new Error(`Failed to get emojis: ${error.message}`);
        }
    }
}

module.exports = TextTools;
