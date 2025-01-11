// const mysqlClass = require('./util/db_tool/libs/mysql.js');
// const sqliteClass = require('./util/db_tool/libs/sqlite.js');
const { appname, env } = require('./globalvars.js');
const http = require('./utils/express/index.js');

// const strapi_v4_net = require('./util/net/libs/strapi_v4_net.js');
// const json = require('./util/tool/libs/json.js');
// const strtool = require('./util/tool/libs/strtool.js');
// const tool = require('./util/plattool/libs/tool.js');
// const urltool = require('./util/urltool.js');
// const arr = require('./util/tool/libs/arr.js');
// const file = require('./util/ftool/libs/file.js');
// const fpath = require('./util/ftool/libs/fpath.js');
// const platform = require('./util/plattool/libs/platform.js');
// const htmlparse = require('./util/htmltool/libs/htmlparse.js');
// const math_ = require('./util/tool/libs/math.js');
// const conf = require('./util/conf.js');
// const log = require('./util/log.js');
// const plattool = require('./util/plattool/libs/plattool.js');
const sysarg = require('./utils/systool/libs/sysarg.js');
// const setenv = require('./util/win_tool/libs/setenv.js');
// const zip = require('./util/ziptask.j/s');
// const getnode = require('./util/dev_tool/libs/getnode_liunx.js');
const porttool = require('./util/porttool.js');
const httptool = require('./util/htmltool/libs/httptool.js');
module.exports = {
  http,
  sysarg,
};