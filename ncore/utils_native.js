const sysarg = require('./utils/systool/libs/sysarg.js');
const getnode_linux = require('./utils/dev_tool/lang_compiler_deploy/getnode_liunx.js');
const getnode_win = require('./utils/dev_tool/lang_compiler_deploy/getnode_win.js');
const getpython_win = require('./utils/dev_tool/lang_compiler_deploy/getpython_win.js');
const getenvironments_win = require('./utils/dev_tool/lang_compiler_deploy/getenvironments_win.js');
const getgolang_win = require('./utils/dev_tool/lang_compiler_deploy/getgolang_win.js');
const getjava_win = require('./utils/dev_tool/lang_compiler_deploy/getjava_win.js');
const turn_feature = require('./utils/dev_tool/utils/turn_feature.js');
const getrust_win = require('./utils/dev_tool/lang_compiler_deploy/getrust_win.js');
const getruby_win = require('./utils/dev_tool/lang_compiler_deploy/getruby_win.js');
const getphp_win = require('./utils/dev_tool/lang_compiler_deploy/getphp_win.js');
const flink = require('./utils/ftool/libs/flink.js');
const wsl_activator = require('./utils/dev_tool/wsl-uitls/libs/wsl_activator.js');
const winpath = require('./utils/win_tool/libs/winpath.js');
const run = require('./utils/win_tool/libs/run.js');
const requests = require('./utils/net/libs/requests.js');
const conf = require('./utils/conf.js');

// Export all utilities
module.exports = {
    run,
    winpath,
    getruby_win,
    getphp_win,
    getrust_win,
    turn_feature,
    requests,
    getjava_win,
    wsl_activator,
    sysarg,
    getnode_linux,
    getnode_win,
    getgolang_win,
    getpython_win,
    getenvironments_win,
    flink,
    conf
};
