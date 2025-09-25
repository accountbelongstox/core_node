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
const gconfig = require('#@gconfig');
const { WWWROOT_DIR, SKIP_DIRS } = gconfig;

function getSubDirs(parent = '/') {
    const absParent = path.join(WWWROOT_DIR, '.' + parent);
    let dirs = [];
    if (fs.existsSync(absParent)) {
        const entries = fs.readdirSync(absParent, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory() && !SKIP_DIRS.includes(entry.name)) {
                dirs.push(entry.name);
            }
        }
    }
    return dirs;
}

module.exports = { getSubDirs }; 