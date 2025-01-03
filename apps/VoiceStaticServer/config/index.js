const { env } = require("#@/ncore/globalvars.js");
const path = require(`path`)
const config = {
    HTTP_PORT: env.getEnv('HTTP_PORT') || 3001,
    HTTP_HOST: env.getEnv('HTTP_HOST') || '127.0.0.1',
    STATIC_PATHS:{
    }
    
}

module.exports = config;

