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