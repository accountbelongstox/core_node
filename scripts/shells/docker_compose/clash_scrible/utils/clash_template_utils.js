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
const { clash_template,custom_template } = require('../provider/global_var');
const logger = require('./log_utils');

function readClashTemplate() {
    try {
        return fs.readFileSync(clash_template, 'utf8');
    } catch (error) {
        logger.logRed('Error reading Clash template:', error);
        return null;
    }
}

function writeClashTemplate(content) {
    if (!content || content.trim() === '') {
        logger.logRed('Error: Cannot write empty content to Clash template');
        return false;
    }

    try {
        fs.writeFileSync(clash_template, content, 'utf8');
        return true;
    } catch (error) {
        logger.logRed('Error writing Clash template:', error);
        return false;
    }
}

module.exports = {
    readClashTemplate,
    writeClashTemplate,
};
