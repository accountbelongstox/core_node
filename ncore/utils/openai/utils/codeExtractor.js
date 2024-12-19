const fs = require('fs');
const path = require('path');

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

            console.warn(`${success ? 'Successful' : 'Failed'} extraction logged to: ${fullLogPath}`);
        } catch (error) {
            console.error('Error logging extraction:', error);
        }
    }

    static extractCode(text, filePath) {
        try {
            // Match code block between ```Node and ``` within converted_code tags
            const regex = /<converted_code>\s*```Node\s*([\s\S]*?)\s*```\s*<\/converted_code>/;
            const match = text.match(regex);
            
            if (!match || !match[1]) {
                console.error('No code block found in conversion result');
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
                        console.error('Error getting line:', error);
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
                        console.error('Error getting lines:', error);
                        return [];
                    }
                },

                toString() {
                    try {
                        return this.rawCode;
                    } catch (error) {
                        console.error('Error converting to string:', error);
                        return '';
                    }
                }
            };
        } catch (error) {
            console.error('Error extracting code:', error);
            if (filePath) {
                this.logExtraction(filePath, text, false);
            }
            return null;
        }
    }
}

module.exports = CodeExtractor; 