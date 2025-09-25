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

const arrtool = require('./arrtool.js');
const jsontool = require('./jsontool.js');
const mathtool = require('./mathtool.js');
const strtool = require('./strtool.js');
const urltool = require('./urltool.js');
const datetool = require(`./datetool.js`)
const parameter_tool = require('./parameter_tool.js');
const porttool = require('./porttool.js');
const sysargtool = require('./sysargtool.js');
const platformtool = require('./platformtool.js');
const filetool = require('./filetool.js');
const inspect = require('./inspect.js');
const {
    dcopy,
    fcopy,
    fdir,
    file,
    flink,
    Fmonitor,
    fnet,
    fpath,
    ftype,
    movedir,
    pfile,
    freader,
    fwriter,
} = filetool;
module.exports = {
    arrtool, jsontool,
    mathtool, strtool,
    urltool, parameter_tool,
    porttool, sysargtool,
    platformtool,
    filetool,
    dcopy,
    fcopy,
    fdir,
    file,
    flink,
    Fmonitor,
    dcopy,
    fcopy,
    fdir,
    file,
    flink,
    Fmonitor,
    fnet,
    fpath,
    ftype,
    movedir,
    pfile,
    freader,
    fwriter,
    datetool,
    inspect,
};
