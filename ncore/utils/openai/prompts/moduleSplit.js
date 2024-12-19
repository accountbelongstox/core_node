const path = require('path');

/**
 * Prompt template for code modularization
 */
function getModuleSplitPrompt(filePath, fileContent) {
    // Calculate suggested number of modules based on file size
    const lines = fileContent.split('\n');
    const totalLines = lines.length;
    const suggestedModules = Math.max(1, Math.ceil(totalLines / 200));

    // Get base name without extension for libs directory
    const baseFileName = path.basename(filePath, path.extname(filePath));
    const libsDir = `${baseFileName}_libs`;

    return `
Here is a large Node.js file that needs to be modularized:
\`\`\`javascript:${filePath}
${fileContent}
\`\`\`

Please analyze this code and split it into logical modules. This file has ${totalLines} lines, suggesting approximately ${suggestedModules} modules (targeting ~200 lines per module).

Requirements:
1. Split the code into smaller, focused modules (around 200 lines each)
2. Keep all functionality unchanged
3. Use CommonJS module system
4. Maintain proper dependencies between modules
5. Keep the original file as the main entry point
6. Place all modules in the '${libsDir}' directory

Please provide the result in the following XML format:

<modularization_result>
    <original_file>
        <file_path>${filePath}</file_path>
        <new_content>
        \`\`\`javascript
        // Main file that imports and coordinates all modules
        const configManager = require('./${libsDir}/configManager');
        const dataHandler = require('./${libsDir}/dataHandler');
        // ... additional modules with descriptive names
        \`\`\`
        </new_content>
    </original_file>

    <modules>
        <!-- Repeat this section for each module (approximately ${suggestedModules} modules) -->
        <module>
            <file_path>${path.join(path.dirname(filePath), libsDir, '[descriptive_name].js')}</file_path>
            <content>
            \`\`\`javascript
            // Module code here
            module.exports = {
                // exported functions
            };
            \`\`\`
            </content>
            <description>Describe module responsibility</description>
            <line_count>Approximate number of lines in this module</line_count>
            <suggested_name>Suggested descriptive name for this module based on its functionality</suggested_name>
        </module>
    </modules>

    <changes_made>
        <change>1. Created '${libsDir}' directory for modules</change>
        <change>2. Identified main code sections</change>
        <change>3. Split into ${suggestedModules} modules based on functionality and size</change>
        <change>4. Updated main file to import modules from '${libsDir}'</change>
    </changes_made>
</modularization_result>

Guidelines for modularization:
1. Each module should have a single responsibility
2. Target approximately 200 lines per module
3. Group related functions and classes together
4. Minimize dependencies between modules
5. Use descriptive names that reflect module purpose (e.g., 'configManager', 'dataHandler')
6. Maintain proper error handling across modules
7. Ensure all original functionality remains accessible
8. Consider logical grouping over strict line count
9. Place all modules in the '${libsDir}' directory
`.trim();
}

module.exports = {
    getModuleSplitPrompt
}; 