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
const { yamls_dir } = require('../provider/global_var');
const { generateMd5 } = require('./str_utils');
const logger = require('./log_utils');

function saveYamlFile(fileName, content, group) {
    const groupMd5 = generateMd5(group);
    const groupDir = path.join(yamls_dir, groupMd5);
    
    if (!fs.existsSync(groupDir)) {
        fs.mkdirSync(groupDir, { recursive: true });
    }
    
    const filePath = path.join(groupDir, fileName);
    fs.writeFileSync(filePath, content, 'utf8');
}

function deleteYamlFile(fileName, group) {
    const groupMd5 = generateMd5(group);
    const groupDir = path.join(yamls_dir, groupMd5);
    const filePath = path.join(groupDir, fileName);
    
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.log(`Deleted YAML file: ${filePath}`);
    } else {
        logger.logYellow(`YAML file not found: ${filePath}`);
    }
}

module.exports = {
    saveYamlFile,
    deleteYamlFile
};