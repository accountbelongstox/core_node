const strapi_v4_net_class = require('./util/net/libs/strapi_v4_net.js');
    const { appname, env, appenv } = require('./globalvars.js');
    let strapi_v4_net = null;

    const isEnvVarValid = (key) => {
      const value = env.getEnv(key);
      return value && value.trim() !== '';
    };

    const strapiEnvVars = [
      'STRAPI_URL'
    ];

    const allStrapiEnvVarsValid = strapiEnvVars.every(isEnvVarValid);

    if (allStrapiEnvVarsValid) {
      strapi_v4_net = new strapi_v4_net_class(env);
    }

    // const json = require('./util/json.js');
    // const strtool = require('./util/strtool.js');
    // const tool = require('./util/tool.js');
    // const url = require('./util/urltool.js');
    // const arr = require('./util/arr.js');
    // const file = require('./util/file.js');
    // const fpath = require('./util/fpath.js');
    // const platform = require('./util/platform.js');
    // const htmlparse = require('./util/htmlparse.js');
    // const math_ = require('./util/math.js');
    // const conf = require('./util/conf.js');
    // const log = require('./util/log.js');
    // const plattool = require('./util/plattool.js');
    // const sysarg = require('./util/sysarg.js');
    // const getnode = require('./util/getnode.js');
    // const zip = require('./util/ziptask.js');
    // const porttool = require('./util/porttool.js');
    // const httptool = require('./util/httptool.js');

    // const math = math_;

    module.exports = {
      strapi_v4_net_class,
      strapi_v4_net,
      // json,
      // strtool,
      // arr,
      // tool,
      // url,
      // file,
      // fpath,
      // platform,
      // htmlparse,
      // math,
      // conf,
      // plattool,
      // log,
      // sysarg,
      // zip,
      // getnode,
      // porttool,
      // httptool,
    };