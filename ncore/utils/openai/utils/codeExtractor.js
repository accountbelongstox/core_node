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

const fs = require('fs');
const path = require('path');
const logger = require('#@logger');

/**
 * Extract and parse code content from conversion result
 */
class CodeExtractor {
    static ensureOutDir() {
        const outDir = path.join(__dirname, '..', '..', '..', '..', '.out');
        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
        }
        return outDir;
    }

    static logExtraction(filePath, result, success = true) {
        try {
            const outDir = this.ensureOutDir();
            const logFile = success ? 'successful_extractions.txt' : 'failed_extractions.txt';
            const fullLogPath = path.join(outDir, logFile);
            
            const timestamp = new Date().toISOString();
            const logLine = `[${timestamp}] ${filePath}\n`;

            // Append to log file
            fs.appendFileSync(fullLogPath, logLine, 'utf8');

            // Save details in separate file
            const detailsDir = success ? 'success_details' : 'error_details';
            const detailsFile = path.join(outDir, detailsDir, path.basename(filePath) + (success ? '.success.json' : '.error.json'));
            if (!fs.existsSync(path.dirname(detailsFile))) {
                fs.mkdirSync(path.dirname(detailsFile), { recursive: true });
            }
            
            const details = {
                timestamp,
                filePath,
                status: success ? 'success' : 'error',
                message: success ? 'Code extracted successfully' : 'No code block found in conversion result',
                aiResponse: result
            };
            fs.writeFileSync(detailsFile, JSON.stringify(details, null, 2), 'utf8');

            logger.warn(`${success ? 'Successful' : 'Failed'} extraction logged to: ${fullLogPath}`);
        } catch (error) {
            logger.error('Error logging extraction:', error);
        }
    }

    static extractCode(text, filePath) {
        try {
            // Match code block between ```Node and ``` within converted_code tags
            const regex = /<converted_code>\s*```Node\s*([\s\S]*?)\s*```\s*<\/converted_code>/;
            const match = text.match(regex);
            
            if (!match || !match[1]) {
                logger.error('No code block found in conversion result');
                if (filePath) {
                    this.logExtraction(filePath, text, false);
                }
                return null;
            }

            const code = match[1].trim();
            const lines = code.split('\n');
            
            // Create array of line objects with line numbers and content
            const codeLines = lines.map((line, index) => ({
                lineNumber: index + 1,
                content: line
            }));

            // Log successful extraction
            if (filePath) {
                this.logExtraction(filePath, text, true);
            }

            return {
                totalLines: lines.length,
                lines: codeLines,
                rawCode: code,
                
                getLine(lineNumber) {
                    try {
                        return this.lines.find(line => line.lineNumber === lineNumber);
                    } catch (error) {
                        logger.error('Error getting line:', error);
                        return null;
                    }
                },

                getLines(startLine, endLine) {
                    try {
                        return this.lines.filter(line => 
                            line.lineNumber >= startLine && 
                            line.lineNumber <= endLine
                        );
                    } catch (error) {
                        logger.error('Error getting lines:', error);
                        return [];
                    }
                },

                toString() {
                    try {
                        return this.rawCode;
                    } catch (error) {
                        logger.error('Error converting to string:', error);
                        return '';
                    }
                }
            };
        } catch (error) {
            logger.error('Error extracting code:', error);
            if (filePath) {
                this.logExtraction(filePath, text, false);
            }
            return null;
        }
    }
}

module.exports = CodeExtractor; 