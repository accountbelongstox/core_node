
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