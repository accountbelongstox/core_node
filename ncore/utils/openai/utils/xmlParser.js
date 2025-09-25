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

const { XMLParser } = require('fast-xml-parser');
const logger = require('#@logger');

function parseConversionResult(result) {
    try {
        // Clean up the response to get just the XML part
        const xmlMatch = result.match(/<conversion_result>[\s\S]*<\/conversion_result>/);
        if (!xmlMatch) {
            logger.error('No XML content found in response');
            return null;
        }

        const xmlContent = xmlMatch[0];
        
        // Parse XML
        const parser = new XMLParser({
            ignoreAttributes: false,
            trimValues: true
        });
        
        const parsed = parser.parse(xmlContent);
        
        // Extract code from markdown code block
        if (parsed.conversion_result.converted_code) {
            const codeMatch = parsed.conversion_result.converted_code.match(/```Node\s*([\s\S]*?)\s*```/);
            if (codeMatch) {
                parsed.conversion_result.converted_code = codeMatch[1].trim();
            }
        }

        return parsed.conversion_result;
    } catch (error) {
        logger.error('Error parsing conversion result:', error);
        return null;
    }
}

module.exports = {
    parseConversionResult
}; 