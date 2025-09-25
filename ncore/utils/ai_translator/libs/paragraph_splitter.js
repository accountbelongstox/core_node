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

const logger = require('#@logger');

class ParagraphSplitter {
    static split(content, options = {}) {
        const {
            maxLength = 2000,
            minLength = 50,
            preserveCodeBlocks = true,
            preserveHeaders = true,
            preserveLists = true
        } = options;

        if (!content || typeof content !== 'string') {
            logger.warn('[Paragraph Splitter] Invalid content provided');
            return [];
        }

        try {
            const paragraphs = this.intelligentSplit(content, {
                maxLength,
                minLength,
                preserveCodeBlocks,
                preserveHeaders,
                preserveLists
            });

            logger.debug(`[Paragraph Splitter] Split content into ${paragraphs.length} paragraphs`);
            return paragraphs;

        } catch (error) {
            logger.error(`[Paragraph Splitter] Error splitting content: ${error.message}`);
            return [content]; // Return original content as fallback
        }
    }

    static intelligentSplit(content, options) {
        const { maxLength, minLength, preserveCodeBlocks, preserveHeaders, preserveLists } = options;
        
        // Normalize line endings
        content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        
        // Handle different content types
        if (this.isMarkdown(content)) {
            return this.splitMarkdown(content, options);
        } else {
            return this.splitPlainText(content, options);
        }
    }

    static isMarkdown(content) {
        const markdownPatterns = [
            /^#{1,6}\s+/m,           // Headers
            /```[\s\S]*?```/,        // Code blocks
            /`[^`]+`/,               // Inline code
            /\*\*[^*]+\*\*/,         // Bold
            /\*[^*]+\*/,             // Italic
            /\[[^\]]+\]\([^)]+\)/,   // Links
            /^\s*[-*+]\s+/m,         // Lists
            /^\s*\d+\.\s+/m          // Numbered lists
        ];

        return markdownPatterns.some(pattern => pattern.test(content));
    }

    static splitMarkdown(content, options) {
        const { maxLength, minLength } = options;
        const paragraphs = [];
        
        // Split by major sections first
        const sections = this.splitByHeaders(content);
        
        for (const section of sections) {
            if (section.length <= maxLength) {
                paragraphs.push(section.trim());
            } else {
                // Further split large sections
                const subsections = this.splitLargeSection(section, maxLength, minLength);
                paragraphs.push(...subsections);
            }
        }

        return paragraphs.filter(p => p.trim().length >= minLength);
    }

    static splitByHeaders(content) {
        const lines = content.split('\n');
        const sections = [];
        let currentSection = [];

        for (const line of lines) {
            if (this.isHeader(line) && currentSection.length > 0) {
                sections.push(currentSection.join('\n'));
                currentSection = [line];
            } else {
                currentSection.push(line);
            }
        }

        if (currentSection.length > 0) {
            sections.push(currentSection.join('\n'));
        }

        return sections;
    }

    static isHeader(line) {
        return /^#{1,6}\s+/.test(line.trim());
    }

    static splitLargeSection(content, maxLength, minLength) {
        const paragraphs = [];
        
        // Try to split by code blocks first
        const codeBlockSplit = this.splitByCodeBlocks(content);
        
        for (const part of codeBlockSplit) {
            if (part.length <= maxLength) {
                paragraphs.push(part.trim());
            } else {
                // Split by paragraphs (double newlines)
                const subParts = this.splitByParagraphs(part, maxLength, minLength);
                paragraphs.push(...subParts);
            }
        }

        return paragraphs;
    }

    static splitByCodeBlocks(content) {
        const codeBlockRegex = /```[\s\S]*?```/g;
        const parts = [];
        let lastIndex = 0;
        let match;

        while ((match = codeBlockRegex.exec(content)) !== null) {
            // Add content before code block
            if (match.index > lastIndex) {
                const beforeCode = content.substring(lastIndex, match.index);
                if (beforeCode.trim()) {
                    parts.push(beforeCode);
                }
            }

            // Add code block as separate part
            parts.push(match[0]);
            lastIndex = match.index + match[0].length;
        }

        // Add remaining content
        if (lastIndex < content.length) {
            const remaining = content.substring(lastIndex);
            if (remaining.trim()) {
                parts.push(remaining);
            }
        }

        return parts.length > 0 ? parts : [content];
    }

    static splitByParagraphs(content, maxLength, minLength) {
        const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim());
        const result = [];

        for (const paragraph of paragraphs) {
            if (paragraph.length <= maxLength) {
                result.push(paragraph.trim());
            } else {
                // Split by sentences if still too long
                const sentences = this.splitBySentences(paragraph, maxLength, minLength);
                result.push(...sentences);
            }
        }

        return result;
    }

    static splitBySentences(content, maxLength, minLength) {
        const sentenceEnders = /[.!?。！？]/;
        const sentences = content.split(sentenceEnders);
        const result = [];
        let currentChunk = '';

        for (let i = 0; i < sentences.length; i++) {
            const sentence = sentences[i].trim();
            if (!sentence) continue;

            const potentialChunk = currentChunk ? 
                currentChunk + (sentenceEnders.test(content.charAt(content.indexOf(sentence) + sentence.length)) ? 
                    content.charAt(content.indexOf(sentence) + sentence.length) : '') + ' ' + sentence :
                sentence;

            if (potentialChunk.length <= maxLength) {
                currentChunk = potentialChunk;
            } else {
                if (currentChunk && currentChunk.length >= minLength) {
                    result.push(currentChunk.trim());
                }
                currentChunk = sentence;
            }
        }

        if (currentChunk && currentChunk.length >= minLength) {
            result.push(currentChunk.trim());
        }

        return result.length > 0 ? result : [content];
    }

    static splitPlainText(content, options) {
        const { maxLength, minLength } = options;
        
        // Split by paragraphs first
        const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim());
        const result = [];

        for (const paragraph of paragraphs) {
            if (paragraph.length <= maxLength) {
                result.push(paragraph.trim());
            } else {
                const sentences = this.splitBySentences(paragraph, maxLength, minLength);
                result.push(...sentences);
            }
        }

        return result.filter(p => p.length >= minLength);
    }

    static estimateTokens(text) {
        // Rough estimation: 1 token ≈ 4 characters for English, 1 token ≈ 1.5 characters for Chinese
        const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
        const otherChars = text.length - chineseChars;
        
        return Math.ceil(chineseChars / 1.5 + otherChars / 4);
    }

    static optimizeForTokenLimit(paragraphs, tokenLimit = 1500) {
        const optimized = [];
        
        for (const paragraph of paragraphs) {
            const tokens = this.estimateTokens(paragraph);
            
            if (tokens <= tokenLimit) {
                optimized.push(paragraph);
            } else {
                // Further split if exceeds token limit
                const subParagraphs = this.splitBySentences(paragraph, tokenLimit * 3, 30);
                optimized.push(...subParagraphs);
            }
        }
        
        return optimized;
    }
}

module.exports = ParagraphSplitter;