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
const Base = require('../base/base.js');

class FPath extends Base {
    constructor() {
        super();
    }

    get_base_name(filePath) {
        if(!filePath)return filePath;
        return path.basename(filePath);
    }

    get_base_dir(filePath) {
        return path.dirname(filePath);
    }

    get_ext(filePath) {
        return path.extname(filePath).slice(1);
    }
}

FPath.toString = () => '[class FPath]';
module.exports = new FPath();
