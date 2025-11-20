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

/**
 * Prompt template for code conversion
 */
function getConversionPrompt(filePath, fileContent) {
    return `
Here is a Node.js file content:
\`\`\`javascript:${filePath}
${fileContent}
\`\`\`

Please convert this code to CommonJS format. You must convert ALL of the following ES6 features:
Please provide the result in the following XML format:

<conversion_result>
    <file_path>${filePath}</file_path>
    <converted_code>
    \`\`\`Node
    // Your converted code here...
    \`\`\`
    </converted_code>
    <changes_made>
        <change>1. Changed import X to require()</change>
        <change>2. Changed export to module.exports</change>
        <change>3. Removed import.meta.url, using __dirname</change>
        <!-- List all specific changes -->
    </changes_made>
</conversion_result>

Requirements:
1. Module System:
   - Convert 'import' statements to require()
   - Convert 'export default' to module.exports =
   - Convert 'export const/let/function' to exports.name =
   - Convert 'export { x, y }' to multiple exports.x = assignments
   - Remove import.meta.url
   - Remove fileURLToPath
   - Use Node.js native __dirname and __filename directly
   - Remove all code that likely 'import.meta.url/__dirname/__filename'
2. Convert ALL ES6+ features to CommonJS/ES5 equivalents
3. Keep all code in English
4. Do not add any new package dependencies

The XML format will help with automated parsing of the results.
`.trim();
}

module.exports = {
    getConversionPrompt
}; 