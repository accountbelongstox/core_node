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
const pathtool = require('./pathtool.js');
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
    pathtool,
};
