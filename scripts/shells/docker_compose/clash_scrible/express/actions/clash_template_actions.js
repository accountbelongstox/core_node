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

const { readClashTemplate, writeClashTemplate } = require('../../utils/clash_template_utils');
const logger = require('../../utils/log_utils');

async function getClashTemplate() {
    const content = readClashTemplate();
    if (content === null) {
        return [false, 'Failed to read Clash template', 500, null];
    }
    return [true, 'Clash template retrieved successfully', 200, content];
}

async function updateClashTemplate({ content }) {
    if (!content || content.trim() === '') {
        return [false, 'Template content cannot be empty', 400, null];
    }

    const success = writeClashTemplate(content);
    if (success) {
        return [true, 'Clash template updated successfully', 200, content];
    } else {
        return [false, 'Failed to update Clash template', 500, null];
    }
}

module.exports = {
    getClashTemplate,
    updateClashTemplate
};