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

class ModuleExtractor {
    static extractModules(text) {
        try {
            // Extract all modules
            const modulePattern = /<module>[\s\S]*?<file_path>(.*?)<\/file_path>[\s\S]*?<content>\s*```javascript\s*([\s\S]*?)\s*```\s*<\/content>[\s\S]*?<\/module>/g;
            const modules = [];
            let match;

            while ((match = modulePattern.exec(text)) !== null) {
                const filePath = match[1].trim();
                const content = match[2].trim();
                modules.push({
                    filePath,
                    content
                });
            }

            // Extract original file content
            const originalFilePattern = /<original_file>[\s\S]*?<file_path>(.*?)<\/file_path>[\s\S]*?<new_content>\s*```javascript\s*([\s\S]*?)\s*```\s*<\/new_content>[\s\S]*?<\/original_file>/;
            const originalMatch = text.match(originalFilePattern);
            
            if (!originalMatch) {
                logger.error('No original file content found');
                return null;
            }

            return {
                originalFile: {
                    filePath: originalMatch[1].trim(),
                    content: originalMatch[2].trim()
                },
                modules,
                
                // Helper method to save all files
                async saveFiles() {
                    try {
                        // Save original file
                        const originalDir = path.dirname(this.originalFile.filePath);
                        fs.writeFileSync(this.originalFile.filePath, this.originalFile.content, 'utf8');
                        
                        // Create libs directory and save modules
                        for (const module of this.modules) {
                            const moduleDir = path.dirname(module.filePath);
                            if (!fs.existsSync(moduleDir)) {
                                fs.mkdirSync(moduleDir, { recursive: true });
                            }
                            fs.writeFileSync(module.filePath, module.content, 'utf8');
                        }
                        return true;
                    } catch (error) {
                        logger.error('Error saving files:', error);
                        return false;
                    }
                },

                // Helper method to get module by file path
                getModule(filePath) {
                    return this.modules.find(m => m.filePath === filePath);
                }
            };
        } catch (error) {
            logger.error('Error extracting modules:', error);
            return null;
        }
    }
}

module.exports = ModuleExtractor; 