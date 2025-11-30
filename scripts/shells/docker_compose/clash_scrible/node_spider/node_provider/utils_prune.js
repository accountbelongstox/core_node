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

const date = require('./util/date.js');
const json = require('./util/json.js');
const strtool = require('./util/strtool.js');
const tool = require('./util/tool.js');
const url = require('./util/urltool.js');
const arr = require('./util/arr.js');
const file = require('./util/file.js');
const fpath = require('./util/fpath.js');
const platform = require('./util/platform.js');
const htmlparse = require('./util/htmlparse.js');
const math_ = require('./util/math.js');
const conf = require('./util/conf.js');
const log = require('./util/log.js');
const plattool = require('./util/plattool.js');
const sysarg = require('./util/sysarg.js');
const env = require('./util/env.js');
const getnode = require('./util/getnode.js');
const zip = require('./util/zip.js');
const porttool = require('./util/porttool.js');
const httptool = require('./util/httptool.js');

module.exports = {
    toString: () => '[class UtilPrune]',
    date,
    json,
    strtool,
    arr,
    tool,
    url,
    file,
    fpath,
    platform,
    htmlparse,
    math:math_,
    conf:conf,
    plattool,
    log,
    sysarg,
    env,
    zip,
    getnode,
    porttool,
    httptool,
};
