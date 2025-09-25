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

class CodeAnalyzer {
    static hasES6Features(code) {
        const es6Patterns = {
            import: /\b(import\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s*['"][^'"]+['"]|import\s+['"][^'"]+['"])/,
            export: /\b(export\s+(?:default\s+)?(?:class|function|const|let|var|async)?)/,
            arrowFunction: /=>/,
            destructuring: /(?:const|let|var)\s*\{[^}]+\}\s*=/,
            spreadOperator: /\.{3}\w+/,
            templateLiteral: /`[^`]*`/
        };

        const features = [];
        for (const [feature, pattern] of Object.entries(es6Patterns)) {
            if (pattern.test(code)) {
                features.push(feature);
            }
        }

        return {
            hasES6: features.length > 0,
            features: features,
            needsConversion: features.includes('import') || features.includes('export')
        };
    }

    static getAnalysisMessage(analysis, filePath) {
        if (!analysis.hasES6) {
            return `Skipping ${filePath} - No ES6 features detected`;
        }
        if (!analysis.needsConversion) {
            return `Skipping ${filePath} - Has ES6 features (${analysis.features.join(', ')}) but no import/export`;
        }
        return `Processing ${filePath} - Found ES6 features: ${analysis.features.join(', ')}`;
    }
}

module.exports = CodeAnalyzer; 