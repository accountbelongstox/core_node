import strapi_v4_net_class from './util/net/libs/strapi_v4_net.js';
import { appname, env, appenv } from './globalvars.js';
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

// import json from './util/json.js';
// import strtool from './util/strtool.js';
// import tool from './util/tool.js';
// import url from './util/urltool.js';
// import arr from './util/arr.js';
// import file from './util/file.js';
// import fpath from './util/fpath.js';
// import platform from './util/platform.js';
// import htmlparse from './util/htmlparse.js';
// import math_ from './util/math.js';
// import conf from './util/conf.js';
// import log from './util/log.js';
// import plattool from './util/plattool.js';
// import sysarg from './util/sysarg.js';
// import getnode from './util/getnode.js';
// import zip from './util/ziptask.js';
// import porttool from './util/porttool.js';
// import httptool from './util/httptool.js';

// const math=math_;

export {
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
}
