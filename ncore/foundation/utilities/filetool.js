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

const dcopy = require('./filetoollibs/dcopy.js');
const fcopy = require('./filetoollibs/fcopy.js');
const fdir = require('./filetoollibs/fdir.js');
const file = require('./filetoollibs/file.js');
const flink = require('./filetoollibs/flink.js');
const Fmonitor = require('./filetoollibs/fmonitor.js');
const fnet = require('./filetoollibs/fnet.js');
const fpath = require('./filetoollibs/fpath.js');
const ftype = require('./filetoollibs/ftype.js');
const movedir = require('./filetoollibs/movedir.js');
const pfile = require('./filetoollibs/pfile.js');
const freader = require('./filetoollibs/freader.js');
const fwriter = require('./filetoollibs/fwriter.js');


module.exports = {
    dcopy,
    fcopy,
    fdir,
    file,
    flink,
    Fmonitor,
    fnet,
    fpath,
    flink,
    ftype,
    movedir,
    pfile,
    freader,
    fwriter
};
