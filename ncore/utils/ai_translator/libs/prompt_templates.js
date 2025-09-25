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

class PromptTemplates {
    static buildTranslationPrompt(text, sourceLanguage, targetLanguage, options = {}) {
        const {
            preserveFormatting = true,
            preserveCodeBlocks = true,
            preserveTechnicalTerms = true,
            translationStyle = 'natural',
            context = ''
        } = options;

        const systemPrompt = this.getSystemPrompt(sourceLanguage, targetLanguage, {
            preserveFormatting,
            preserveCodeBlocks,
            preserveTechnicalTerms,
            translationStyle
        });

        const userPrompt = this.buildUserPrompt(text, sourceLanguage, targetLanguage, context);

        return {
            systemPrompt,
            userPrompt
        };
    }

    static getSystemPrompt(sourceLanguage, targetLanguage, options = {}) {
        const {
            preserveFormatting = true,
            preserveCodeBlocks = true,
            preserveTechnicalTerms = true,
            translationStyle = 'natural'
        } = options;

        const sourceLangName = this.getLanguageName(sourceLanguage);
        const targetLangName = this.getLanguageName(targetLanguage);

        let systemPrompt = `You are a professional translator specializing in ${sourceLangName} to ${targetLangName} translation.

Your task is to translate text accurately while maintaining the original meaning and tone.

IMPORTANT REQUIREMENTS:
1. Translate from ${sourceLangName} to ${targetLangName}
2. Maintain ${translationStyle} and fluent language flow
3. Return ONLY the translated text in the specified XML format
4. Do NOT add explanations, comments, or additional text`;

        if (preserveFormatting) {
            systemPrompt += `
5. Preserve all original formatting (line breaks, indentation, spacing)`;
        }

        if (preserveCodeBlocks) {
            systemPrompt += `
6. Keep code blocks, technical syntax, and programming elements unchanged`;
        }

        if (preserveTechnicalTerms) {
            systemPrompt += `
7. Preserve technical terms, proper nouns, and specialized vocabulary when appropriate`;
        }

        systemPrompt += `

OUTPUT FORMAT REQUIREMENT:
You must return your translation wrapped in XML tags exactly as shown:
<translation>
[Your translated text here]
</translation>

CRITICAL: Only return the XML-wrapped translation. No other text allowed.`;

        return systemPrompt;
    }

    static buildUserPrompt(text, sourceLanguage, targetLanguage, context = '') {
        const sourceLangName = this.getLanguageName(sourceLanguage);
        const targetLangName = this.getLanguageName(targetLanguage);

        let userPrompt = `Translate the following text from ${sourceLangName} to ${targetLangName}:

SOURCE TEXT:
${text}`;

        if (context) {
            userPrompt += `

CONTEXT:
${context}`;
        }

        userPrompt += `

Please provide the translation in the required XML format.`;

        return userPrompt;
    }

    static buildBatchTranslationPrompt(texts, sourceLanguage, targetLanguage, options = {}) {
        const {
            preserveFormatting = true,
            preserveCodeBlocks = true,
            preserveTechnicalTerms = true,
            translationStyle = 'natural'
        } = options;

        const sourceLangName = this.getLanguageName(sourceLanguage);
        const targetLangName = this.getLanguageName(targetLanguage);

        const systemPrompt = `You are a professional translator specializing in ${sourceLangName} to ${targetLangName} translation.

BATCH TRANSLATION TASK:
- Translate multiple text segments from ${sourceLangName} to ${targetLangName}
- Maintain consistency across all translations
- Preserve the original meaning and ${translationStyle} tone`;

        if (preserveFormatting) {
            systemPrompt += `
- Preserve all original formatting for each segment`;
        }

        if (preserveCodeBlocks) {
            systemPrompt += `
- Keep code blocks and technical elements unchanged`;
        }

        if (preserveTechnicalTerms) {
            systemPrompt += `
- Preserve technical terms and proper nouns consistently`;
        }

        let userPrompt = `Translate the following ${texts.length} text segments:

BATCH OUTPUT FORMAT REQUIREMENT:
<batch_translation>
<segment id="1">
[Translation of segment 1]
</segment>
<segment id="2">
[Translation of segment 2]
</segment>
<!-- Continue for all segments -->
</batch_translation>

SOURCE SEGMENTS:`;

        texts.forEach((text, index) => {
            userPrompt += `

SEGMENT ${index + 1}:
${text}`;
        });

        userPrompt += `

Please provide all translations in the required XML batch format.`;

        return {
            systemPrompt,
            userPrompt
        };
    }

    static buildDocumentTranslationPrompt(content, sourceLanguage, targetLanguage, documentType = 'general', options = {}) {
        const {
            preserveStructure = true,
            preserveMetadata = true,
            translationStyle = 'natural'
        } = options;

        const sourceLangName = this.getLanguageName(sourceLanguage);
        const targetLangName = this.getLanguageName(targetLanguage);

        let systemPrompt = `You are a professional document translator specializing in ${sourceLangName} to ${targetLangName} translation.

DOCUMENT TYPE: ${documentType.toUpperCase()}

TRANSLATION REQUIREMENTS:
- Translate the entire document from ${sourceLangName} to ${targetLangName}
- Maintain professional ${translationStyle} tone appropriate for ${documentType} documents
- Ensure consistency throughout the document`;

        if (preserveStructure) {
            systemPrompt += `
- Preserve document structure (headers, paragraphs, lists, etc.)`;
        }

        if (preserveMetadata) {
            systemPrompt += `
- Keep metadata, timestamps, and reference information intact`;
        }

        if (documentType === 'technical') {
            systemPrompt += `
- Preserve technical terminology and maintain accuracy
- Keep code examples, commands, and technical syntax unchanged`;
        } else if (documentType === 'legal') {
            systemPrompt += `
- Maintain legal terminology precision
- Preserve formal language structure and legal concepts`;
        } else if (documentType === 'medical') {
            systemPrompt += `
- Preserve medical terminology accuracy
- Maintain clinical precision and professional tone`;
        }

        systemPrompt += `

DOCUMENT OUTPUT FORMAT:
<document_translation>
<metadata>
  <source_language>${sourceLangName}</source_language>
  <target_language>${targetLangName}</target_language>
  <document_type>${documentType}</document_type>
</metadata>
<content>
[Translated document content here]
</content>
</document_translation>`;

        const userPrompt = `Translate the following ${documentType} document:

DOCUMENT CONTENT:
${content}

Please provide the complete translation in the required XML document format.`;

        return {
            systemPrompt,
            userPrompt
        };
    }

    static extractTranslationFromResponse(response, format = 'single') {
        if (!response || typeof response !== 'string') {
            return format === 'batch' ? [] : '';
        }

        try {
            if (format === 'single') {
                return this.extractSingleTranslation(response);
            } else if (format === 'batch') {
                return this.extractBatchTranslation(response);
            } else if (format === 'document') {
                return this.extractDocumentTranslation(response);
            }
        } catch (error) {
            // Fallback to simple extraction if XML parsing fails
            return this.fallbackExtraction(response, format);
        }

        return format === 'batch' ? [] : '';
    }

    static extractSingleTranslation(response) {
        const translationMatch = response.match(/<translation>([\s\S]*?)<\/translation>/);
        if (translationMatch) {
            return translationMatch[1].trim();
        }

        // Fallback extraction
        return this.fallbackExtraction(response, 'single');
    }

    static extractBatchTranslation(response) {
        const batchMatch = response.match(/<batch_translation>([\s\S]*?)<\/batch_translation>/);
        if (!batchMatch) {
            return this.fallbackExtraction(response, 'batch');
        }

        const batchContent = batchMatch[1];
        const segmentMatches = batchContent.match(/<segment id="\d+">([\s\S]*?)<\/segment>/g);
        
        if (!segmentMatches) {
            return this.fallbackExtraction(response, 'batch');
        }

        return segmentMatches.map(segment => {
            const contentMatch = segment.match(/<segment id="\d+">([\s\S]*?)<\/segment>/);
            return contentMatch ? contentMatch[1].trim() : '';
        });
    }

    static extractDocumentTranslation(response) {
        const docMatch = response.match(/<document_translation>([\s\S]*?)<\/document_translation>/);
        if (!docMatch) {
            return this.fallbackExtraction(response, 'document');
        }

        const contentMatch = docMatch[1].match(/<content>([\s\S]*?)<\/content>/);
        const metadataMatch = docMatch[1].match(/<metadata>([\s\S]*?)<\/metadata>/);

        return {
            content: contentMatch ? contentMatch[1].trim() : '',
            metadata: metadataMatch ? metadataMatch[1] : ''
        };
    }

    static fallbackExtraction(response, format) {
        // Remove common AI response patterns
        let cleaned = response.trim();
        cleaned = cleaned.replace(/^(Translation:|Translated text:|Here is the translation:)\s*/i, '');
        cleaned = cleaned.replace(/^(Here are the translations:|Batch translation results:)\s*/i, '');

        // Remove quotes if wrapped
        if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || 
            (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
            cleaned = cleaned.slice(1, -1);
        }

        if (format === 'batch') {
            // Try to split by common delimiters for batch
            const lines = cleaned.split(/\n\s*\n|\n\d+\.\s*|\n-\s*/);
            return lines.filter(line => line.trim()).map(line => line.trim());
        } else if (format === 'document') {
            return {
                content: cleaned,
                metadata: ''
            };
        }

        return cleaned.trim();
    }

    static getLanguageName(code) {
        const languageNames = {
            'zh': 'Chinese',
            'zh-cn': 'Simplified Chinese',
            'zh-tw': 'Traditional Chinese',
            'en': 'English',
            'ja': 'Japanese',
            'ko': 'Korean',
            'fr': 'French',
            'de': 'German',
            'es': 'Spanish',
            'ru': 'Russian',
            'pt': 'Portuguese',
            'it': 'Italian',
            'ar': 'Arabic',
            'hi': 'Hindi',
            'th': 'Thai',
            'vi': 'Vietnamese',
            'nl': 'Dutch',
            'sv': 'Swedish',
            'no': 'Norwegian',
            'da': 'Danish',
            'fi': 'Finnish',
            'pl': 'Polish',
            'cs': 'Czech',
            'hu': 'Hungarian',
            'ro': 'Romanian',
            'bg': 'Bulgarian',
            'hr': 'Croatian',
            'sk': 'Slovak',
            'sl': 'Slovenian',
            'et': 'Estonian',
            'lv': 'Latvian',
            'lt': 'Lithuanian',
            'mt': 'Maltese',
            'tr': 'Turkish',
            'he': 'Hebrew',
            'fa': 'Persian',
            'ur': 'Urdu',
            'bn': 'Bengali',
            'ta': 'Tamil',
            'te': 'Telugu',
            'ml': 'Malayalam',
            'kn': 'Kannada',
            'gu': 'Gujarati',
            'pa': 'Punjabi',
            'mr': 'Marathi',
            'ne': 'Nepali',
            'si': 'Sinhala',
            'my': 'Myanmar',
            'km': 'Khmer',
            'lo': 'Lao',
            'ka': 'Georgian',
            'am': 'Amharic',
            'sw': 'Swahili',
            'zu': 'Zulu',
            'af': 'Afrikaans',
            'sq': 'Albanian',
            'az': 'Azerbaijani',
            'be': 'Belarusian',
            'bs': 'Bosnian',
            'eu': 'Basque',
            'gl': 'Galician',
            'is': 'Icelandic',
            'ga': 'Irish',
            'mk': 'Macedonian',
            'ms': 'Malay',
            'sr': 'Serbian',
            'uk': 'Ukrainian',
            'cy': 'Welsh'
        };

        return languageNames[code.toLowerCase()] || code;
    }

    static validatePromptInputs(text, sourceLanguage, targetLanguage) {
        const errors = [];

        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            errors.push('Text is required and must be a non-empty string');
        }

        if (!sourceLanguage || typeof sourceLanguage !== 'string') {
            errors.push('Source language is required');
        }

        if (!targetLanguage || typeof targetLanguage !== 'string') {
            errors.push('Target language is required');
        }

        if (sourceLanguage === targetLanguage) {
            errors.push('Source and target languages cannot be the same');
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    static estimateTokens(text) {
        // Rough estimation for different languages
        const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
        const japaneseChars = (text.match(/[\u3040-\u309f\u30a0-\u30ff]/g) || []).length;
        const koreanChars = (text.match(/[\uac00-\ud7af]/g) || []).length;
        const otherChars = text.length - chineseChars - japaneseChars - koreanChars;
        
        // Different token ratios for different languages
        return Math.ceil(
            chineseChars / 1.5 + 
            japaneseChars / 2 + 
            koreanChars / 2 + 
            otherChars / 4
        );
    }
}

module.exports = PromptTemplates;